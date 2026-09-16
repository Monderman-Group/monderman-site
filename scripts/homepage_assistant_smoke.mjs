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
async function waitForNativeVisibility(page, visible) {
  await page.waitForFunction(expected => {
    const buttons = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')];
    return buttons.length === 2 && buttons.every(node => {
      const style = getComputedStyle(node);
      return expected ? style.display !== 'none' && style.visibility === 'visible'
        : (style.display === 'none' || style.visibility === 'hidden') && style.pointerEvents === 'none';
    });
  }, visible);
}
async function checkShortViewportPanel(page, selector, viewport) {
  // A real viewport resize exercises the responsive/visualViewport listener.
  // It is not a claim of native iOS software-keyboard testing.
  await page.setViewportSize({ width: viewport.width, height: 420 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator(selector).evaluate(async node => {
    await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const bounds = await page.locator(selector).boundingBox();
  assert(bounds && bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= -1 && bounds.y + bounds.height <= 421,
    `${viewport.name}: ${selector} escapes the reduced-height viewport (${JSON.stringify(bounds)})`);
  await waitForNativeVisibility(page, false);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
    assert.equal(await page.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0, `${viewport.name}: retired support strip or proxy controls remain`);
    await launcher.waitFor({ state: 'visible' });
    await connect.waitFor({ state: 'visible' });
    assert.equal((await launcher.textContent()).trim(), 'Chat');
    assert.equal((await connect.textContent()).trim(), 'Connect');
    assert.match(await launcher.getAttribute('aria-label'), /chat/i, `${viewport.name}: Chat visible label is absent from its accessible name`);
    assert.match(await connect.getAttribute('aria-label'), /connect/i, `${viewport.name}: Connect visible label is absent from its accessible name`);
    const actionBoxes = await Promise.all([launcher.boundingBox(), connect.boundingBox()]);
    assert(actionBoxes.every((box) => box && box.height >= 48 && box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height),
      `${viewport.name}: floating support controls are clipped or undersized`);
    const [topAction, bottomAction] = [...actionBoxes].sort((a, b) => a.y - b.y);
    assert(topAction.x > viewport.width / 2 && Math.abs(topAction.width - bottomAction.width) <= 1
      && Math.abs(topAction.x + topAction.width - bottomAction.x - bottomAction.width) <= 1
      && bottomAction.y - topAction.y - topAction.height >= 11.5,
    `${viewport.name}: native controls are not a balanced bottom-right stack with a 12px gap`);
    for (const action of [launcher, connect]) {
      assert.equal(await action.evaluate(node => getComputedStyle(node).position), 'fixed', `${viewport.name}: support control stopped floating`);
    }

    const compact = viewport.width <= 1180;
    if (compact) {
      await page.locator('.site-menu-button').click();
      await waitForNativeVisibility(page, false);
    }
    await page.locator('.site-search-button').click();
    await page.locator('.site-search-overlay.is-open').waitFor({ state: 'visible' });
    await waitForNativeVisibility(page, false);
    await page.keyboard.press('Escape');
    if (compact) {
      await waitForNativeVisibility(page, false);
      await page.keyboard.press('Escape');
    }
    await waitForNativeVisibility(page, true);

    await launcher.focus();
    assert.equal(await launcher.evaluate(node => document.activeElement === node), true, `${viewport.name}: assistant trigger cannot receive focus`);
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
    await checkShortViewportPanel(page, '#mnd-panel', viewport);

    // A user cannot activate the opposing hidden launcher. Exercise the
    // component guard explicitly as well, so a scripted activation cannot
    // leave two dialogs open at once.
    await connect.evaluate(node => node.click());
    await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mnd-panel').isVisible(), false, `${viewport.name}: Connect opens on top of the assistant`);
    await launcher.evaluate(node => node.click());
    await page.locator('#mnd-panel.mnd-open').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mdn-cn-panel').getAttribute('aria-hidden'), 'true', `${viewport.name}: assistant opens on top of Connect`);

    await page.locator('#mnd-close').click();
    assert.equal(await launcher.evaluate(node => document.activeElement === node && getComputedStyle(node).visibility === 'visible'), true, `${viewport.name}: assistant close does not return visible focus to its native launcher`);
    await connect.click();
    await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
    assert.equal(await launcher.isVisible(), false, `${viewport.name}: assistant launcher collides with open Connect panel`);
    await checkShortViewportPanel(page, '#mdn-cn-panel', viewport);
    await page.locator('.mdn-cn-close').click();
    assert.equal(await connect.evaluate(node => document.activeElement === node && getComputedStyle(node).visibility === 'visible'), true, `${viewport.name}: Connect close does not return visible focus to its native launcher`);

    await page.evaluate(() => {
      const footer = document.querySelector('.mond-footer');
      window.scrollTo({ top: scrollY + footer.getBoundingClientRect().top - (innerHeight - 40), behavior: 'instant' });
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => {
      const footerTop = document.querySelector('.mond-footer').getBoundingClientRect().top;
      return footerTop < innerHeight && [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => getComputedStyle(node).visibility === 'visible' && node.getBoundingClientRect().bottom <= footerTop - 15.5);
    });
    const dockedBoxes = await Promise.all([launcher.boundingBox(), connect.boundingBox()]);
    const firstFooterTop = await page.locator('.mond-footer').evaluate(node => node.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(previousTop => {
      const footerTop = document.querySelector('.mond-footer').getBoundingClientRect().top;
      return footerTop < previousTop - 1 && [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => getComputedStyle(node).visibility === 'visible' && node.getBoundingClientRect().bottom <= footerTop - 15.5);
    }, firstFooterTop);
    const advancedBoxes = await Promise.all([launcher.boundingBox(), connect.boundingBox()]);
    assert(advancedBoxes.every((box, index) => box.y < dockedBoxes[index].y), `${viewport.name}: controls did not move upward as the footer advanced (${JSON.stringify({ firstFooterTop, dockedBoxes, advancedBoxes })})`);
    await page.close();

    const fieldPage = await newLocalPage(viewport);
    await fieldPage.goto(`${base}/connect.html`, { waitUntil: 'networkidle', timeout: 90000 });
    await fieldPage.locator('#mnd-launcher').waitFor({ state: 'attached' });
    await fieldPage.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
    await fieldPage.locator('#fullName').focus();
    await waitForNativeVisibility(fieldPage, false);
    await fieldPage.locator('#fullName').evaluate(node => node.blur());
    await fieldPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await waitForNativeVisibility(fieldPage, true);
    await fieldPage.close();
  }

  const assistantFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await assistantFallbackPage.route('**/assistant.js*', route => route.abort());
  await assistantFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await assistantFallbackPage.locator('#mnd-launcher').count(), 0, 'assistant failure fixture did not block the widget');
  assert.equal(await assistantFallbackPage.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0, 'failed assistant leaves a dead proxy control');
  await assistantFallbackPage.locator('.site-search-button').click();
  await assistantFallbackPage.locator('.site-search-overlay.is-open').waitFor({ state: 'visible' });
  await assistantFallbackPage.close();

  const contactFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await contactFallbackPage.route('**/connect-widget.js*', route => route.abort());
  await contactFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await contactFallbackPage.locator('.mdn-cn-launch').count(), 0, 'Contact failure fixture did not block the widget');
  assert.equal(await contactFallbackPage.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0, 'failed Connect leaves a dead proxy control');
  await contactFallbackPage.locator('.mond-footer a[href="connect.html"]').click();
  await contactFallbackPage.waitForURL(/\/connect\.html$/, { timeout: 10000 });
  await contactFallbackPage.close();

  console.log('homepage assistant smoke: passed');
} finally {
  await browser.close();
}
