import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-presentation-smoke';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function isActualSerif(font) { return /Georgia|Times New Roman/i.test(font); }

await page.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });
await page.evaluate(() => document.fonts?.ready);

const hostTypography = await page.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  brand: getComputedStyle(document.querySelector('.brand')).fontFamily,
  intro: getComputedStyle(document.querySelector('.intro-pin h1')).fontFamily,
}));
for (const [where, font] of Object.entries(hostTypography)) {
  assert(!isActualSerif(font), `${where} contaminated by serif CSS: ${font}`);
  assert(/Neue Haas|Helvetica|Arial/i.test(font), `${where} no longer uses Monderman sans typography: ${font}`);
}
assert((await page.locator('body').textContent()).includes('Representative product outputs — not customer data.'), 'representative-output disclosure missing');

async function openTab(key) {
  await page.locator(`[data-target="${key}"]`).click();
  await page.waitForTimeout(250);
  const shell = page.locator(`[data-report="${key}"]`);
  assert(await shell.isVisible(), `${key} shell not visible`);
  return shell;
}

for (const key of ['os','dv','sc','ip']) {
  const shell = await openTab(key);
  const svgCount = await shell.locator('svg[role="img"]').count();
  assert(svgCount >= 4, `${key} has only ${svgCount} evidence graphics`);
  assert(await shell.locator(`#${key}-quadrant .sample-production-quadrant-wrap`).isVisible(), `${key} production quadrant not visible`);
  assert(await shell.locator('svg[aria-label="Burden composition — share of total"]').first().isVisible(), `${key} composition graphic not visible`);
  assert(await shell.locator('svg[aria-label="Burden severity by dimension"]').first().isVisible(), `${key} severity graphic not visible`);
  assert(await shell.locator('svg[aria-label="Intervention order"]').first().isVisible(), `${key} intervention graphic not visible`);
  await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true });
}

const cross = await openTab('synthesis');
assert(await cross.locator('.mr-cover').isVisible(), 'Cross-Lens report cover not visible');
assert((await cross.locator('.mr-cover-score').textContent()).trim() === '55.5', 'Cross-Lens cover does not preserve 55.5');
const crossFont = await cross.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
assert(/Neue Haas/i.test(crossFont), `Cross-Lens report is not rendering Neue Haas: ${crossFont}`);
const crossTitleSize = parseFloat(await cross.locator('.mr-cover-title').evaluate(el => getComputedStyle(el).fontSize));
assert(crossTitleSize <= 50.5, `Cross-Lens cover title remains oversized: ${crossTitleSize}px`);
const crossH2 = parseFloat(await cross.locator('.mr-section h2').first().evaluate(el => getComputedStyle(el).fontSize));
assert(crossH2 >= 24, `Cross-Lens section hierarchy remains weak: ${crossH2}px`);
const crossBoundary = cross.locator('.mr-report-boundary');
assert(await crossBoundary.isVisible(), 'Cross-Lens interpretation boundary missing');
const crossStart = await cross.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const boundaryTop = await crossBoundary.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(boundaryTop - crossStart < 900, `Cross-Lens interpretation boundary remains a footer afterthought at ${Math.round(boundaryTop-crossStart)}px`);
for (const aria of [
  'Cross-Lens Diagnostic score comparison',
  'Synthesis evidence integrity map',
  'Cross-Lens recurring signal map',
  'Source-backed pathway exposure ranges',
]) {
  assert(await cross.locator(`svg[aria-label="${aria}"]`).isVisible(), `Cross-Lens visual missing: ${aria}`);
}
assert(await cross.locator('.mr-action-grid').isVisible(), 'Cross-Lens action sequence not visible');
assert(await cross.locator('.mr-vantage-grid').isVisible(), 'Cross-Lens vantage evidence grid not visible');
assert(await cross.locator('.mr-indicator-grid').isVisible(), 'Cross-Lens leading-indicator grid not visible');
assert((await cross.textContent()).includes('Executive synthesis'), 'Cross-Lens executive synthesis missing');
assert((await cross.textContent()).includes('Agreements and differences'), 'Cross-Lens agreements/differences missing');
assert((await cross.textContent()).includes('Evidence-proportionate actions'), 'Cross-Lens actions missing');
await page.screenshot({ path: path.join(out, 'cross-lens-full.png'), fullPage: true });
await cross.locator('.mr-cover').screenshot({ path: path.join(out, 'cross-lens-cover.png') });

const depth = await openTab('depth');
assert(await depth.locator('.mr-cover').isVisible(), 'Depth report cover not visible');
assert((await depth.locator('.mr-cover-score').textContent()).trim() === '56', 'Depth cover score changed unexpectedly');
const depthFont = await depth.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
assert(/Neue Haas/i.test(depthFont), `Depth report is not rendering Neue Haas: ${depthFont}`);
const depthBoundary = depth.locator('.mr-report-boundary');
assert(await depthBoundary.isVisible(), 'Depth interpretation boundary missing');
const depthStart = await depth.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const depthBoundaryTop = await depthBoundary.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(depthBoundaryTop - depthStart < 900, `Depth interpretation boundary remains a footer afterthought at ${Math.round(depthBoundaryTop-depthStart)}px`);
for (const aria of [
  'Depth Synthesis score distribution',
  'Synthesis evidence integrity map',
  'Source-backed pathway exposure ranges',
]) {
  assert(await depth.locator(`svg[aria-label="${aria}"]`).isVisible(), `Depth visual missing: ${aria}`);
}
assert((await depth.textContent()).includes('15.8'), 'Depth vantage gap not visible');
assert(await depth.locator('.mr-action-grid').isVisible(), 'Depth action sequence not visible');
assert(await depth.locator('.mr-vantage-grid').isVisible(), 'Depth vantage evidence grid not visible');
assert(await depth.locator('.mr-indicator-grid').isVisible(), 'Depth leading-indicator grid not visible');
await page.screenshot({ path: path.join(out, 'depth-full.png'), fullPage: true });
await depth.locator('.mr-cover').screenshot({ path: path.join(out, 'depth-cover.png') });

const standaloneHtml = await page.evaluate(() => {
  const fx = window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES.crossLens;
  return window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(fx));
});
const standalone = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await standalone.setContent(standaloneHtml, { waitUntil: 'domcontentloaded' });
await standalone.evaluate(() => document.fonts?.ready);
assert(await standalone.locator('.mr-cover').isVisible(), 'standalone report cover missing');
assert((await standalone.locator('.mr-cover-score').textContent()).trim() === '55.5', 'standalone Cross-Lens score rounded');
for (const aria of ['Cross-Lens Diagnostic score comparison','Synthesis evidence integrity map','Cross-Lens recurring signal map','Source-backed pathway exposure ranges']) {
  assert(await standalone.locator(`svg[aria-label="${aria}"]`).isVisible(), `standalone Cross-Lens visual missing: ${aria}`);
}
assert(await standalone.locator('.mr-report-boundary').isVisible(), 'standalone interpretation boundary missing');
const standaloneFont = await standalone.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
assert(!isActualSerif(standaloneFont), `standalone report still uses serif typography: ${standaloneFont}`);
await standalone.screenshot({ path: path.join(out, 'standalone-cross-lens.png'), fullPage: true });
await standalone.close();

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ ok:true, hostTypography, crossTitleSize, crossH2, crossVisuals:4, depthVisuals:3 }, null, 2));
console.log('REPORT_PRESENTATION_RENDER_PASS');
await browser.close();
