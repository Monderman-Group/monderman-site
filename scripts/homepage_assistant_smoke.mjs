import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true });
async function newLocalPage(viewport) {
  const page = await browser.newPage({ viewport });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)
      ? route.continue() : route.abort();
  });
  return page;
}

try {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    const page = await newLocalPage(viewport);
    let assistantRequest = null;
    await page.route('https://monderman-api.onrender.com/api/site-assistant', async route => {
      assistantRequest = route.request();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Test reply' }) });
    });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });

    // The accessible main landmark owns the homepage editorial sequence. Keep
    // retired legacy sections absent or hidden and preserve one white
    // repeat-measurement section at every supported viewport.
    const editorial = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      const legacy = main?.querySelector(':scope > .differentiators-compact');
      const measurementLoop = main?.querySelector(':scope > .measurement-loop');
      const visibleSecondReadHeadings = [...document.querySelectorAll('h2')].filter((heading) => {
        if (heading.textContent.trim() !== 'Measure once to see the condition. Return to learn whether it changed.') return false;
        const section = heading.closest('section');
        return section && getComputedStyle(section).display !== 'none';
      });
      const visibleSections = [...(main?.querySelectorAll(':scope > section') || [])]
        .filter((section) => getComputedStyle(section).display !== 'none')
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map((section) => section.classList[0]);
      return {
        mainExists: Boolean(main),
        legacyDisplay: legacy ? getComputedStyle(legacy).display : null,
        measurementDisplay: measurementLoop ? getComputedStyle(measurementLoop).display : null,
        measurementBackground: measurementLoop ? getComputedStyle(measurementLoop).backgroundColor : null,
        visibleSecondReadHeadings: visibleSecondReadHeadings.length,
        visibleSections,
      };
    });
    assert.equal(editorial.mainExists, true, `${viewport.name}: homepage main landmark missing`);
    assert.ok([null, 'none'].includes(editorial.legacyDisplay), `${viewport.name}: retired deep-cream differentiator section is visible`);
    assert.equal(editorial.measurementDisplay, 'block', `${viewport.name}: intended measurement loop is not visible`);
    assert.equal(editorial.measurementBackground, 'rgb(255, 255, 255)', `${viewport.name}: intended second-read section is not white`);
    assert.equal(editorial.visibleSecondReadHeadings, 1, `${viewport.name}: duplicate second-read headings are visible`);
    assert.deepEqual(editorial.visibleSections, [
      'hero',
      'measurement-loop',
      'approach',
      'first-run-moments',
      'proof-band',
      'mxidx-band',
      'systems-analysis-bridge',
      'home-output-band',
      'book-band',
      'latest',
      'connect',
    ], `${viewport.name}: homepage editorial sequence changed`);

    const launcher = page.locator('#mnd-launcher');
    const connect = page.locator('.mdn-cn-launch');
    await launcher.waitFor({ state: 'attached' });
    await connect.waitFor({ state: 'attached' });
    const compact = viewport.width <= 1180;
    const support = page.locator('.site-support');
    const assistantAction = support.locator('[data-site-widget-action="assistant"]');
    const contactAction = support.locator('[data-site-widget-action="contact"]');
    assert.equal(await launcher.isVisible(), false, `${viewport.name}: assistant still floats over page content`);
    assert.equal(await connect.isVisible(), false, `${viewport.name}: Contact still floats over page content`);
    assert.equal(await page.locator('#siteHeader .site-widget-action').count(), 0, `${viewport.name}: support controls remain in the header`);
    assert.equal(await support.count(), 1, `${viewport.name}: one footer support region is required`);
    assert.equal(await support.evaluate(node => node.nextElementSibling?.matches('.mond-footer')), true, `${viewport.name}: support region is not immediately before the footer`);
    assert.equal(await support.locator('.site-widget-action').count(), 2, `${viewport.name}: footer support controls are duplicated or missing`);
    assert.equal(await assistantAction.textContent().then(text => text.trim()), 'Chat with Monderman');
    assert.equal(await contactAction.textContent().then(text => text.trim()), 'Connect');
    await support.scrollIntoViewIfNeeded();
    await assistantAction.waitFor({ state: 'visible' });
    await contactAction.waitFor({ state: 'visible' });
    const actionBoxes = await Promise.all([assistantAction.boundingBox(), contactAction.boundingBox()]);
    assert(actionBoxes.every((box) => box && box.height >= 48 && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height),
      `${viewport.name}: footer support actions are clipped or undersized`);
    assert.equal(await support.evaluate(node => ['static', 'relative'].includes(getComputedStyle(node).position)), true, `${viewport.name}: footer support must remain in normal page flow`);

    await assistantAction.focus();
    assert.equal(await assistantAction.evaluate(node => document.activeElement === node), true, `${viewport.name}: assistant trigger cannot receive focus`);
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

    if (!compact) {
      await contactAction.click();
      await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#mnd-panel').isVisible(), false, `${viewport.name}: Contact opens on top of the assistant`);
      await assistantAction.click();
      await page.locator('#mnd-panel.mnd-open').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#mdn-cn-panel').getAttribute('aria-hidden'), 'true', `${viewport.name}: assistant opens on top of Contact`);
    }

    await page.locator('#mnd-close').click();
    assert.equal(await assistantAction.evaluate(node => document.activeElement === node && node.getClientRects().length > 0), true, `${viewport.name}: assistant close does not return visible focus to its footer action`);
    await contactAction.click();
    await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
    assert.equal(await launcher.isVisible(), false, `${viewport.name}: assistant launcher collides with open Connect panel`);
    await page.locator('.mdn-cn-close').click();
    assert.equal(await contactAction.evaluate(node => document.activeElement === node && node.getClientRects().length > 0), true, `${viewport.name}: Connect close does not return visible focus to its footer action`);
    await page.close();
  }

  const assistantFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await assistantFallbackPage.route('**/assistant.js*', route => route.abort());
  await assistantFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await assistantFallbackPage.locator('#mnd-launcher').count(), 0, 'assistant failure fixture did not block the widget');
  await assistantFallbackPage.locator('[data-site-widget-action="assistant"]').click();
  await assistantFallbackPage.locator('.site-search-overlay.is-open').waitFor({ state: 'visible' });
  await assistantFallbackPage.close();

  const contactFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await contactFallbackPage.route('**/connect-widget.js*', route => route.abort());
  await contactFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await contactFallbackPage.locator('.mdn-cn-launch').count(), 0, 'Contact failure fixture did not block the widget');
  await contactFallbackPage.locator('[data-site-widget-action="contact"]').click();
  await contactFallbackPage.waitForURL(/\/connect\.html$/, { timeout: 10000 });
  await contactFallbackPage.close();

  console.log('homepage assistant smoke: passed');
} finally {
  await browser.close();
}
