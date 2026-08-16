import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/forensic-report-smoke';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function isActualSerif(font) { return /Georgia|Times New Roman/i.test(font); }

await page.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });

const hostTypography = await page.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  brand: getComputedStyle(document.querySelector('.brand')).fontFamily,
  intro: getComputedStyle(document.querySelector('.intro-pin h1')).fontFamily,
}));
for (const [where, font] of Object.entries(hostTypography)) {
  assert(!isActualSerif(font), `${where} contaminated by shared report serif CSS: ${font}`);
  assert(/Neue Haas|Helvetica|Arial/i.test(font), `${where} no longer uses Monderman sans typography: ${font}`);
}
assert((await page.locator('body').textContent()).includes('Representative product outputs — not customer data.'), 'designed representative-output disclosure missing');

async function openTab(key) {
  await page.locator(`[data-target="${key}"]`).click();
  await page.waitForTimeout(250);
  const shell = page.locator(`[data-report="${key}"]`);
  assert(await shell.isVisible(), `${key} shell not visible`);
  return shell;
}

const diagnostics = ['os','dv','sc','ip'];
for (const key of diagnostics) {
  const shell = await openTab(key);
  const svgCount = await shell.locator('svg[role="img"]').count();
  assert(svgCount >= 4, `${key} has only ${svgCount} evidence graphics`);
  const quadrant = shell.locator(`#${key}-quadrant .sample-production-quadrant-wrap`);
  assert(await quadrant.isVisible(), `${key} production quadrant not visible`);
  assert(await quadrant.locator('.sample-production-quadrant-box').isVisible(), `${key} production quadrant box not visible`);
  assert(await quadrant.locator('.sample-quadrant-dot').isVisible(), `${key} production quadrant marker not visible`);
  assert(await shell.locator('svg[aria-label="Burden composition — share of total"]').first().isVisible(), `${key} composition graphic not visible`);
  assert(await shell.locator('svg[aria-label="Burden severity by dimension"]').first().isVisible(), `${key} severity graphic not visible`);
  assert(await shell.locator('svg[aria-label="Intervention order"]').first().isVisible(), `${key} intervention graphic not visible`);
  await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true });
}

const cross = await openTab('synthesis');
assert(await cross.locator('.mr-cover').isVisible(), 'Cross-Lens source-aligned report cover not visible');
assert((await cross.locator('.mr-cover-score').textContent()).trim() === '55.5', 'Cross-Lens cover does not preserve the published 55.5 score');
const crossFirstHeading = (await cross.locator('.mr-section h2').first().textContent()).trim();
assert(/Contributing Diagnostic lens/i.test(crossFirstHeading), `Cross-Lens visual is not first substantive section: ${crossFirstHeading}`);
const crossChart = cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await crossChart.isVisible(), 'Cross-Lens comparison chart not visible');
const crossTop = await crossChart.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const crossStart = await cross.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(crossTop - crossStart < 1150, `Cross-Lens chart is still buried ${Math.round(crossTop-crossStart)}px into report`);
assert((await cross.textContent()).includes('Executive synthesis'), 'Cross-Lens executive synthesis missing');
assert((await cross.textContent()).includes('Agreements and differences'), 'Cross-Lens agreements/differences missing');
assert((await cross.textContent()).includes('Evidence-proportionate actions'), 'Cross-Lens actions missing');
const crossBoundary = cross.locator('.mr-report-boundary');
assert(await crossBoundary.isVisible(), 'Cross-Lens interpretation boundary missing');
const boundaryStyle = await crossBoundary.evaluate(el => ({ bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color }));
assert(!/rgb\(4, 24, 27\)|rgb\(7, 51, 56\)|rgb\(8, 56, 62\)/.test(boundaryStyle.bg), `Cross-Lens boundary remains dark/afterthought styling: ${boundaryStyle.bg}`);
await page.screenshot({ path: path.join(out, 'cross-lens-full.png'), fullPage: true });
await cross.locator('.mr-cover').screenshot({ path: path.join(out, 'cross-lens-cover.png') });
await crossChart.screenshot({ path: path.join(out, 'cross-lens-chart.png') });

const depth = await openTab('depth');
assert(await depth.locator('.mr-cover').isVisible(), 'Depth source-aligned report cover not visible');
assert((await depth.locator('.mr-cover-score').textContent()).trim() === '56', 'Depth cover score changed unexpectedly');
const depthFirstHeading = (await depth.locator('.mr-section h2').first().textContent()).trim();
assert(/Observed participant distribution/i.test(depthFirstHeading), `Depth distribution is not first substantive section: ${depthFirstHeading}`);
const depthChart = depth.locator('svg[aria-label="Depth Synthesis score distribution"]');
assert(await depthChart.isVisible(), 'Depth distribution chart not visible');
const depthTop = await depthChart.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const depthStart = await depth.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(depthTop - depthStart < 1150, `Depth chart is still buried ${Math.round(depthTop-depthStart)}px into report`);
assert((await depth.textContent()).includes('15.8'), 'Depth vantage gap not visible');
assert((await depth.textContent()).includes('Evidence-proportionate actions'), 'Depth actions missing');
assert(await depth.locator('.mr-report-boundary').isVisible(), 'Depth interpretation boundary missing');
await page.screenshot({ path: path.join(out, 'depth-full.png'), fullPage: true });
await depth.locator('.mr-cover').screenshot({ path: path.join(out, 'depth-cover.png') });
await depthChart.screenshot({ path: path.join(out, 'depth-chart.png') });

const afterTypography = await page.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  brand: getComputedStyle(document.querySelector('.brand')).fontFamily,
  intro: getComputedStyle(document.querySelector('.intro-pin h1')).fontFamily,
}));
for (const [where, font] of Object.entries(afterTypography)) {
  assert(!isActualSerif(font), `${where} contaminated after report render: ${font}`);
}

const standaloneHtml = await page.evaluate(() => {
  const fx = window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES.crossLens;
  return window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(fx));
});
const standalone = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await standalone.setContent(standaloneHtml, { waitUntil: 'domcontentloaded' });
assert(await standalone.locator('.mr-cover').isVisible(), 'standalone report cover missing');
assert((await standalone.locator('.mr-cover-score').textContent()).trim() === '55.5', 'standalone Cross-Lens score rounded');
assert(await standalone.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]').isVisible(), 'standalone Cross-Lens chart missing');
assert(await standalone.locator('.mr-report-boundary').isVisible(), 'standalone interpretation boundary missing');
const standaloneFont = await standalone.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
assert(!isActualSerif(standaloneFont), `standalone report still uses serif typography: ${standaloneFont}`);
await standalone.screenshot({ path: path.join(out, 'standalone-cross-lens.png'), fullPage: true });
await standalone.close();

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ ok:true, hostTypography, afterTypography, boundaryStyle, diagnosticTabs:4, synthesisTabs:2 }, null, 2));
console.log('FORENSIC_REPORT_RENDER_PASS');
await browser.close();
