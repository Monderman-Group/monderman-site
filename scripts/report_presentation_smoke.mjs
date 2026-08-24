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
function isMondermanFont(font) { return /Neue Haas Grotesk/i.test(font); }

await page.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });
await page.locator('body.production-samples-ready').waitFor({ state: 'attached', timeout: 30000 });

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

// The four Diagnostic samples must be the live projection of the locked
// production-engine artifact, not the legacy hand-authored report markup.
const diagnostics = {
  os:{score:'44',dimensions:6}, dv:{score:'51',dimensions:4},
  sc:{score:'51',dimensions:5}, ip:{score:'48',dimensions:6}
};
for (const [key, expected] of Object.entries(diagnostics)) {
  const shell = await openTab(key);
  const report = shell.locator('.psr-wrap');
  assert(await report.getAttribute('data-engine-commit') === '379ff62eee8157efe0115ee825933adbefc493d2', `${key} engine revision mismatch`);
  assert(await report.getAttribute('data-artifact-sha256') === '611188e3ab10e20c62a3229604f03dbf39d6fa02f2ed14ffa2d787a55681b982', `${key} artifact digest mismatch`);
  assert((await shell.locator('.psr-score strong').textContent()).trim() === expected.score, `${key} score mismatch`);
  assert(await shell.locator('.psr-dimension').count() === expected.dimensions, `${key} dimension profile mismatch`);
  assert(await shell.locator('.psr-remedy').count() === 3, `${key} remedy-path count mismatch`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy sample remains in the live DOM`);
  const text = await shell.textContent();
  for (const token of ['Production-engine-generated representative output','Executive headline','Observed burden','Evidence status','Action ladder','Method and limits','Interpretation boundary','No participant notes were supplied']) {
    assert(text.includes(token), `${key} production-contract section missing: ${token}`);
  }
  await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true });
}

// Cross-Lens: verify not just presence but hierarchy, typography, evidence-map
// integration, source-backed visual density, and de-duplication.
const cross = await openTab('synthesis');
assert(await cross.locator('.mr-cover').isVisible(), 'Cross-Lens source-aligned report cover not visible');
assert((await cross.locator('.mr-cover-score').textContent()).trim() === '55.5', 'Cross-Lens cover does not preserve the published 55.5 score');
assert((await cross.locator('.mr-cover-score-label').textContent()).trim() === 'Cross-Lens Composite Score', 'Cross-Lens cover is not showing the certified score label');
assert((await cross.locator('.mr-cover-score-band').textContent()).trim() === 'Observed cross-lens condition', 'Cross-Lens condition line is still duplicating the score label');
assert(await cross.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Cross-Lens interpretation boundary is not integrated into the opening cover');
const coverBoundaryText = await cross.locator('.mr-cover .mr-cover-boundary').textContent();
assert(/not a proven causal model/i.test(coverBoundaryText), 'Cross-Lens cover boundary lost its causal-interpretation limit');

const crossFirstHeading = (await cross.locator('.mr-section h2').first().textContent()).trim();
assert(/Contributing Diagnostic lens/i.test(crossFirstHeading), `Cross-Lens visual is not first substantive section: ${crossFirstHeading}`);
const crossChart = cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await crossChart.isVisible(), 'Cross-Lens comparison chart not visible');
const crossChartFont = await crossChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(crossChartFont), `Cross-Lens chart bypasses Neue Haas Grotesk: ${crossChartFont}`);
const crossTop = await crossChart.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const crossStart = await cross.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(crossTop - crossStart < 1150, `Cross-Lens chart is still buried ${Math.round(crossTop-crossStart)}px into report`);

const crossText = await cross.textContent();
assert(crossText.includes('Executive synthesis'), 'Cross-Lens executive synthesis missing');
assert(crossText.includes('Agreements and differences'), 'Cross-Lens agreements/differences missing');
assert(crossText.includes('Evidence-proportionate actions'), 'Cross-Lens actions missing');
assert(crossText.includes('Source-backed remedy paths'), 'Cross-Lens remedy paths missing');
assert(crossText.includes('What participants reported'), 'Cross-Lens participant-reported layer missing');
assert(await cross.locator('.mr-remedy-card').count() === 3, 'Cross-Lens does not show three remedy alternatives');
assert(crossText.includes('Executive decision frame'), 'Cross-Lens executive decision frame missing');
assert(await cross.locator('.mr-decision-metric').count() === 4, 'Cross-Lens decision frame does not show four executive metrics');
assert(await cross.locator('.mr-action-path .mr-action-step').count() >= 3, 'Cross-Lens visual action sequence is too thin');
assert(await cross.locator('.mr-evidence-ladder .mr-evidence-step').count() === 4, 'Cross-Lens evidence ladder incomplete');
assert(await cross.locator('#synthesisToc a').count() >= 10, 'Cross-Lens Contents rail is incomplete');

const evidenceMap = cross.locator('.mr-cross-lens-map');
assert(await evidenceMap.isVisible(), 'Cross-Lens evidence map not visible');
assert(await evidenceMap.locator('.mr-map-lens').count() === 4, 'Cross-Lens evidence map does not preserve all four contributing lenses');
assert(await evidenceMap.locator('.mr-map-signal').count() >= 2, 'Cross-Lens evidence map is too thin to show recurring signals');
assert((await evidenceMap.textContent()).includes('does not assert a causal pathway'), 'Cross-Lens evidence map lost the non-causal interpretation boundary');
assert(await cross.getByText('Recurring signals', { exact: true }).count() === 0, 'Cross-Lens signal narrative is duplicated below the evidence map');

const exposureGraphic = cross.locator('.mr-exposure-range');
assert(await exposureGraphic.isVisible(), 'Cross-Lens source-backed exposure visual not visible');
assert(await exposureGraphic.locator('.mr-range-row').count() === 2, 'Cross-Lens exposure visual does not show both source-backed ranges');
assert((await exposureGraphic.textContent()).includes('bar lengths should not be compared across the two metrics'), 'Cross-Lens exposure visual lost the separate-scale warning');

const crossBoundary = cross.locator('.mr-report-boundary');
assert(await crossBoundary.isVisible(), 'Cross-Lens end interpretation boundary missing');
const boundaryStyle = await crossBoundary.evaluate(el => ({ bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color }));
assert(!/rgb\(4, 24, 27\)|rgb\(7, 51, 56\)|rgb\(8, 56, 62\)/.test(boundaryStyle.bg), `Cross-Lens boundary remains dark/afterthought styling: ${boundaryStyle.bg}`);
await page.screenshot({ path: path.join(out, 'cross-lens-full.png'), fullPage: true });
await cross.locator('.mr-cover').screenshot({ path: path.join(out, 'cross-lens-cover.png') });
await crossChart.screenshot({ path: path.join(out, 'cross-lens-chart.png') });
await evidenceMap.screenshot({ path: path.join(out, 'cross-lens-evidence-map.png') });
await exposureGraphic.screenshot({ path: path.join(out, 'cross-lens-exposure.png') });

// Depth: preserve the same typography, opening-boundary integration, and
// substantive distribution visualization.
const depth = await openTab('depth');
assert(await depth.locator('.mr-cover').isVisible(), 'Depth source-aligned report cover not visible');
assert((await depth.locator('.mr-cover-score').textContent()).trim() === '56', 'Depth cover score changed unexpectedly');
assert((await depth.locator('.mr-cover-score-label').textContent()).trim() === 'Median Diagnostic Score', 'Depth cover lost the certified median score label');
assert(await depth.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Depth interpretation boundary is not integrated into the opening cover');
const depthFirstHeading = (await depth.locator('.mr-section h2').first().textContent()).trim();
assert(/Observed participant distribution/i.test(depthFirstHeading), `Depth distribution is not first substantive section: ${depthFirstHeading}`);
const depthChart = depth.locator('svg[aria-label="Depth Synthesis score distribution"]');
assert(await depthChart.isVisible(), 'Depth distribution chart not visible');
const depthChartFont = await depthChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(depthChartFont), `Depth chart bypasses Neue Haas Grotesk: ${depthChartFont}`);
const depthTop = await depthChart.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const depthStart = await depth.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
assert(depthTop - depthStart < 1150, `Depth chart is still buried ${Math.round(depthTop-depthStart)}px into report`);
assert((await depth.textContent()).includes('15.8'), 'Depth vantage gap not visible');
assert((await depth.textContent()).includes('Evidence-proportionate actions'), 'Depth actions missing');
assert((await depth.textContent()).includes('Source-backed remedy paths'), 'Depth remedy paths missing');
assert((await depth.textContent()).includes('What participants reported'), 'Depth participant-reported layer missing');
assert(await depth.locator('.mr-remedy-card').count() === 3, 'Depth does not show three remedy alternatives');
assert((await depth.textContent()).includes('Executive decision frame'), 'Depth executive decision frame missing');
assert(await depth.locator('.mr-decision-metric').count() === 4, 'Depth decision frame does not show four executive metrics');
assert(await depth.locator('.mr-action-path .mr-action-step').count() >= 3, 'Depth visual action sequence is too thin');
assert(await depth.locator('.mr-evidence-ladder .mr-evidence-step').count() === 4, 'Depth evidence ladder incomplete');
assert(await depth.locator('#depthToc a').count() >= 10, 'Depth Contents rail is incomplete');
assert(await depth.locator('.mr-report-boundary').isVisible(), 'Depth end interpretation boundary missing');
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

// Standalone HTML/print surface must retain the same presentation contract.
const standaloneHtml = await page.evaluate(() => {
  const fx = window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES.crossLens;
  return window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(fx));
});
const standalone = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await standalone.setContent(standaloneHtml, { waitUntil: 'domcontentloaded' });
assert(await standalone.locator('.mr-cover').isVisible(), 'standalone report cover missing');
assert((await standalone.locator('.mr-cover-score').textContent()).trim() === '55.5', 'standalone Cross-Lens score rounded');
assert(await standalone.locator('.mr-cover .mr-cover-boundary').isVisible(), 'standalone cover interpretation boundary missing');
const standaloneChart = standalone.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await standaloneChart.isVisible(), 'standalone Cross-Lens chart missing');
const standaloneChartFont = await standaloneChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(standaloneChartFont), `standalone chart bypasses Neue Haas Grotesk: ${standaloneChartFont}`);
assert(await standalone.locator('.mr-cross-lens-map').isVisible(), 'standalone Cross-Lens evidence map missing');
assert(await standalone.locator('.mr-exposure-range').isVisible(), 'standalone Cross-Lens exposure visual missing');
assert(await standalone.locator('.mr-report-boundary').isVisible(), 'standalone end interpretation boundary missing');
const standaloneFont = await standalone.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
assert(!isActualSerif(standaloneFont), `standalone report still uses serif typography: ${standaloneFont}`);
assert(isMondermanFont(standaloneFont), `standalone report is not using Neue Haas Grotesk: ${standaloneFont}`);
await standalone.screenshot({ path: path.join(out, 'standalone-cross-lens.png'), fullPage: true });
await standalone.close();

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
  ok:true,
  hostTypography,
  afterTypography,
  crossChartFont,
  depthChartFont,
  boundaryStyle,
  diagnosticTabs:4,
  synthesisTabs:2,
  qualityChecks:{
    coverBoundaryIntegrated:true,
    crossLensEvidenceMap:true,
    crossLensSignalsDeduplicated:true,
    sourceBackedExposureVisual:true,
    singleRunInsightDepth:true,
    synthesisContentsNavigation:true,
    executiveDecisionFrame:true,
    evidenceStrengthLadder:true,
    visualActionSequence:true,
    synthesisChartsUseNeueHaas:true,
    standaloneParity:true,
  },
}, null, 2));
console.log('REPORT_PRESENTATION_RENDER_PASS');
await browser.close();
