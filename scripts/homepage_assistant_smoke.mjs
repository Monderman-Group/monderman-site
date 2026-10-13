import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Assistant verification remains loopback-only');
const root = path.resolve(import.meta.dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['index.html', 'marketing-refresh.css', 'marketing-refresh.js', 'assistant.js', 'connect-widget.js', 'scripts/homepage_assistant_smoke.mjs', 'scripts/inject-public-shell.mjs', 'site-shell/header.html', 'site-shell/footer.html', 'site-shell/widgets.html'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const rawBaselineHomepage = sourceAtMarketingRefreshBaseline('index.html', fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
assert.equal(sha(rawBaselineHomepage), 'fc50896dc63825ce7a54bdfff80af41220b635eae8b5a8b76f9c724efd36e874', 'Historical edition is exact reviewed 14e homepage source');
// Full widget/search checks require the real static-build shell, not raw source.
// Reproduce it through the unchanged official injector, with no private fixture.
const baselineDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'homepage-assistant-14e-'));
let baselineHomepage;
try {
  fs.writeFileSync(path.join(baselineDirectory, 'index.html'), rawBaselineHomepage, {mode: 0o600});
  execFileSync(process.execPath, [path.join(root, 'scripts/inject-public-shell.mjs'), baselineDirectory], {cwd: root, encoding: 'utf8'});
  baselineHomepage = fs.readFileSync(path.join(baselineDirectory, 'index.html'), 'utf8');
  assert.equal(sha(baselineHomepage), 'a341d2544606b647ea78ffd35f11b1f000ff08e66407d7332e7a236ccecef278', 'Historical widget edition is exact authoritative 14e built homepage');
} finally {
  fs.rmSync(baselineDirectory, {recursive: true, force: true});
}
const currentEditorialSequence = ['hero', 'mr-scenario', 'measurement-loop', 'approach', 'first-run-moments', 'proof-band', 'mxidx-band', 'systems-analysis-bridge', 'home-output-band', 'book-band', 'latest', 'connect'];
const expectedIllustrationLabel = 'Qualitative illustration · Not a scored result or customer case';
function assertCurrentEditorialSequence(sections, scene) {
  assert.deepEqual(sections, currentEditorialSequence, 'Current twelve-section sequence includes exactly the approved scenario immediately after hero');
  assert.deepEqual(scene.domSections, currentEditorialSequence, 'Accessible DOM and rendered editorial sequence agree exactly');
  assert.equal(scene.count, 1, 'Exactly one direct-main scenario exists, including hidden DOM');
  assert.equal(scene.visible, true, 'The scenario is actually displayed');
  assert.equal(scene.label, expectedIllustrationLabel, 'The displayed scenario has the exact qualitative boundary');
  assert.equal(scene.labelVisible, true, 'The qualitative boundary remains visible');
  assert.equal(scene.heroLabel, 'Sample report · Example data', 'The hero report remains qualified as example data');
}
const validScene = {domSections: currentEditorialSequence, count: 1, visible: true, label: expectedIllustrationLabel, labelVisible: true, heroLabel: 'Sample report · Example data'};
const invalidSequences = [
  ['missing scenario', currentEditorialSequence.filter((_, index) => index !== 1)],
  ['moved scenario', ['hero', 'measurement-loop', 'mr-scenario', ...currentEditorialSequence.slice(3)]],
  ['duplicated scenario', [...currentEditorialSequence.slice(0, 2), 'mr-scenario', ...currentEditorialSequence.slice(2)]],
  ['missing old section', currentEditorialSequence.filter(section => section !== 'proof-band')],
  ['reordered old sections', [...currentEditorialSequence.slice(0, 2), 'approach', 'measurement-loop', ...currentEditorialSequence.slice(4)]],
  ['unknown added section', [...currentEditorialSequence, 'unapproved-section']],
];
for (const [label, sections] of invalidSequences) assert.throws(() => assertCurrentEditorialSequence(sections, validScene), undefined, 'Reject ' + label);
const invalidScenes = [
  ['hidden duplicate scenario', {...validScene, count: 2}],
  ['zero direct-main scenarios', {...validScene, count: 0}],
  ['wrong accessible DOM order', {...validScene, domSections: ['mr-scenario', 'hero', ...currentEditorialSequence.slice(2)]}],
  ['hidden scenario', {...validScene, visible: false}],
  ['missing qualitative boundary', {...validScene, label: ''}],
  ['false measured-result claim', {...validScene, label: 'Measured customer outcome'}],
  ['hidden qualitative boundary', {...validScene, labelVisible: false}],
  ['unqualified hero report', {...validScene, heroLabel: 'Customer result'}],
];
for (const [label, scene] of invalidScenes) assert.throws(() => assertCurrentEditorialSequence(currentEditorialSequence, scene), undefined, 'Reject ' + label);
let edition = 'baseline';
const receipts = [], unexpectedWrites = [];
let mockedAssistantPosts = 0;
const browser = await chromium.launch({ headless: true });
async function newLocalPage(viewport) {
  const page = await browser.newPage({ viewport });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) {
      unexpectedWrites.push({method: request.method(), origin: url.origin, path: url.pathname});
      return route.abort();
    }
    if (edition === 'baseline' && url.origin === origin && url.pathname === '/index.html') return route.fulfill({status: 200, contentType: 'text/html', body: baselineHomepage});
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
async function checkFixedAnchors(page, viewport) {
  const edge = viewport.width <= 480 ? 16 : 20;
  const actions = await page.locator('#mnd-launcher,.mdn-cn-launch').evaluateAll(nodes => nodes.map(node => ({
    connect: node.matches('.mdn-cn-launch'), box: node.getBoundingClientRect().toJSON(),
  })));
  for (const { connect, box } of actions) {
    assert(Math.abs(box.right - (viewport.width - edge)) <= 1.5
      && Math.abs(box.bottom - (viewport.height - edge - (connect ? 60 : 0))) <= 1.5,
    `${viewport.name}: support control left its fixed bottom-right anchor (${JSON.stringify({ connect, box })})`);
  }
}
async function findClearLauncherPosition(page) {
  // The first phone viewport can contain primary page actions at this corner.
  // Exercise launchers only after reaching naturally unobstructed content.
  for (let top = 0; top <= 1800; top += 120) {
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
    await page.waitForTimeout(240);
    if (await page.locator('#mnd-launcher,.mdn-cn-launch').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => getComputedStyle(node).visibility === 'visible')))
      return await page.evaluate(() => scrollY);
  }
  assert.fail('No unobstructed launch position found for keyboard and dialog checks');
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
  for (edition of ['baseline', 'current']) {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    const page = await newLocalPage(viewport);
    let assistantRequest = null;
    await page.route('https://monderman-api.onrender.com/api/site-assistant', async route => {
      assistantRequest = route.request();
      mockedAssistantPosts++;
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
        if (heading.textContent.trim() !== 'Compare results on the same basis.') return false;
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
    if (edition === 'current') {
      const scenario = page.locator('#main-content > .mr-scenario');
      const scene = {
        domSections: await page.locator('#main-content > section').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').map(node => node.classList[0])),
        count: await scenario.count(), visible: await scenario.isVisible(),
        label: (await scenario.locator('.mr-demo-heading > span').innerText()).replace(/\s+/g, ' ').trim(),
        labelVisible: await scenario.locator('.mr-demo-heading > span').isVisible(),
        heroLabel: await page.locator('.mr-proof-label').innerText(),
      };
      assertCurrentEditorialSequence(editorial.visibleSections, scene);
      // Only after proving the complete exact current sequence, project its
      // single known index1 addition into the unchanged historical assertion.
      editorial.visibleSections = [editorial.visibleSections[0], ...editorial.visibleSections.slice(2)];
    }
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
    await checkFixedAnchors(page, viewport);
    const clearScrollY = await findClearLauncherPosition(page);
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
    await checkFixedAnchors(page, viewport);

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
    await waitForNativeVisibility(page, false);
    await checkFixedAnchors(page, viewport);
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await waitForNativeVisibility(page, false);
    await checkFixedAnchors(page, viewport);
    await page.locator('.mond-footer a[href="connect.html"]').click({ trial: true });
    await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), clearScrollY);
    await waitForNativeVisibility(page, true);
    await checkFixedAnchors(page, viewport);
    for (const [trigger, panelSelector, closeSelector] of [
      [launcher, '#mnd-panel.mnd-open', '#mnd-close'],
      [connect, '#mdn-cn-panel.mdn-cn-open', '.mdn-cn-close'],
    ]) {
      await trigger.click();
      await page.locator(panelSelector).waitFor({ state: 'visible' });
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.locator(closeSelector).click();
      await waitForNativeVisibility(page, false);
      const returnedToVisiblePageControl = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active.closest('#mnd-panel,#mdn-cn-panel,[inert]')) return false;
        const box = active.getBoundingClientRect();
        return getComputedStyle(active).visibility === 'visible' && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
      });
      assert.equal(returnedToVisiblePageControl, true, `${viewport.name}: closing after a footer scroll loses keyboard focus`);
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), clearScrollY);
      await waitForNativeVisibility(page, true);
      await checkFixedAnchors(page, viewport);
    }
    receipts.push({edition, viewport, homepageFunctionalChecksPassed: true, assistantRequestMocked: true, editorialSections: edition === 'current' ? 12 : 11});
    await page.close();

    const fieldPage = await newLocalPage(viewport);
    await fieldPage.goto(`${base}/connect.html`, { waitUntil: 'networkidle', timeout: 90000 });
    await fieldPage.locator('#mnd-launcher').waitFor({ state: 'attached' });
    await fieldPage.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
    await fieldPage.locator('#fullName').focus();
    await waitForNativeVisibility(fieldPage, false);
    await fieldPage.locator('#fullName').evaluate(node => node.blur());
    await findClearLauncherPosition(fieldPage);
    await checkFixedAnchors(fieldPage, viewport);
    await fieldPage.close();
    receipts.push({edition, viewport, contactFieldFocusChecksPassed: true});
  }

  const assistantFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await assistantFallbackPage.route('**/assistant.js*', route => route.abort());
  await assistantFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await assistantFallbackPage.locator('#mnd-launcher').count(), 0, 'assistant failure fixture did not block the widget');
  assert.equal(await assistantFallbackPage.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0, 'failed assistant leaves a dead proxy control');
  await assistantFallbackPage.locator('.site-search-button').click();
  await assistantFallbackPage.locator('.site-search-overlay.is-open').waitFor({ state: 'visible' });
  await assistantFallbackPage.close();
  receipts.push({edition, assistantFallbackPassed: true});

  const contactFallbackPage = await newLocalPage({ width: 1440, height: 900 });
  await contactFallbackPage.route('**/connect-widget.js*', route => route.abort());
  await contactFallbackPage.goto(`${base}/index.html`, { waitUntil: 'networkidle', timeout: 90000 });
  assert.equal(await contactFallbackPage.locator('.mdn-cn-launch').count(), 0, 'Contact failure fixture did not block the widget');
  assert.equal(await contactFallbackPage.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0, 'failed Connect leaves a dead proxy control');
  await contactFallbackPage.locator('.mond-footer a[href="connect.html"]').click();
  await contactFallbackPage.waitForURL(/\/connect\.html$/, { timeout: 10000 });
  await contactFallbackPage.close();
  receipts.push({edition, contactFallbackPassed: true});

  console.log('homepage assistant smoke: passed');
  console.log('HOMEPAGE_ASSISTANT_EDITION_PASS ' + edition);
  }
  assert.equal(mockedAssistantPosts, 6, 'All six edition/viewport endpoint checks were intercepted locally');
  assert.deepEqual(unexpectedWrites, [], 'No other write request was attempted or allowed');
  for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(sha(fs.readFileSync(path.join(root, file))), hash, 'Executed source stayed frozen: ' + file);
  const receipt = {passed: true, checkedAt: new Date().toISOString(), base, historicalRawSourceSha256: sha(rawBaselineHomepage), historicalBuiltBaselineSha256: sha(baselineHomepage), domOrderEvidence: 'Visible direct-main DOM order and rendered section order; not a separate accessibility-tree audit. Original actual keyboard/focus checks run in both editions.', sourceHashes, editions: 2, homepageFunctionalStates: 6, contactFieldFocusStates: 6, fallbackStates: 4, negativeControls: invalidSequences.length + invalidScenes.length, mockedAssistantPosts, unexpectedWrites, receipts};
  if (process.env.ASSISTANT_SMOKE_OUT) {
    fs.mkdirSync(process.env.ASSISTANT_SMOKE_OUT, {recursive: true});
    fs.writeFileSync(path.join(process.env.ASSISTANT_SMOKE_OUT, 'RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600});
  }
  console.log('HOMEPAGE_ASSISTANT_DUAL_PASS ' + JSON.stringify({editions: 2, homepageStates: 6, fieldStates: 6, fallbacks: 4, negativeControls: receipt.negativeControls, mockedAssistantPosts, unexpectedWrites: 0}));
} finally {
  await browser.close();
}
