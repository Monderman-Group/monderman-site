import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    let assistantRequest = null;
    await page.route('https://monderman-api.onrender.com/api/site-assistant', async route => {
      assistantRequest = route.request();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Test reply' }) });
    });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });

    const launcher = page.locator('#mnd-launcher');
    const connect = page.locator('.mdn-cn-launch');
    await launcher.waitFor({ state: 'visible' });
    await connect.waitFor({ state: 'visible' });

    const assistantBox = await launcher.boundingBox();
    const connectBox = await connect.boundingBox();
    assert(assistantBox && connectBox, `${viewport.name}: launcher geometry unavailable`);
    assert(connectBox.y + connectBox.height <= assistantBox.y, `${viewport.name}: assistant and Connect launchers overlap`);

    await launcher.focus();
    assert.equal(await launcher.evaluate(node => document.activeElement === node), true, `${viewport.name}: launcher cannot receive focus`);
    await page.keyboard.press('Enter');
    await page.locator('#mnd-panel.mnd-open').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mnd-input').evaluate(node => document.activeElement === node), true, `${viewport.name}: opening does not focus input`);
    assert.equal(await connect.isVisible(), false, `${viewport.name}: Connect launcher collides with open assistant`);

    await page.locator('#mnd-input').fill('Endpoint contract check');
    await page.keyboard.press('Enter');
    await page.getByText('Test reply').waitFor({ state: 'visible' });
    assert(assistantRequest, `${viewport.name}: assistant request was not sent`);
    assert.equal(assistantRequest.method(), 'POST', `${viewport.name}: assistant endpoint method changed`);
    assert.equal(assistantRequest.postDataJSON().messages.at(-1)?.content, 'Endpoint contract check', `${viewport.name}: assistant endpoint payload changed`);

    await page.locator('#mnd-close').click();
    await launcher.waitFor({ state: 'visible' });
    await connect.click();
    await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
    assert.equal(await launcher.isVisible(), false, `${viewport.name}: assistant launcher collides with open Connect panel`);
    await page.locator('.mdn-cn-close').click();
    await launcher.waitFor({ state: 'visible' });
    await page.close();
  }
  console.log('homepage assistant smoke: passed');
} finally {
  await browser.close();
}
