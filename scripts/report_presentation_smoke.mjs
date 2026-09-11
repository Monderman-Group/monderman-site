import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-presentation-smoke';
fs.mkdirSync(out, { recursive: true });
const artifact=JSON.parse(fs.readFileSync(new URL('../sample-data/production-diagnostic-samples.json',import.meta.url),'utf8'));
const crossSource=artifact.outputs.cross_lens_synthesis.source, depthSource=artifact.outputs.depth_synthesis.source;
const crossScore=String(crossSource.cross_diagnostic_score??crossSource.aggregate_score), depthScore=String(depthSource.aggregate_score);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
// Exportable reports use absolute production font URLs so downloaded HTML can
// render outside the site. During localhost certification, serve those exact
// font requests from the checked-out candidate instead of depending on CORS
// headers from the live site.
async function useCandidateFonts(target) {
await target.route(/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/, async route => {
  const filename = new URL(route.request().url()).pathname.slice(1);
  await route.fulfill({
    status: 200,
    contentType: 'font/woff2',
    body: fs.readFileSync(path.resolve(filename)),
  });
});
}
await useCandidateFonts(page);
async function loadStandalone(target, html) {
  await useCandidateFonts(target);
  target.on('pageerror', e => errors.push(`standalone pageerror: ${e.message}`));
  target.on('console', m => { if (m.type() === 'error') errors.push(`standalone console: ${m.text()}`); });
  await target.setContent(html, {waitUntil:'networkidle'});
  await target.evaluate(async () => { await document.fonts.ready; });
  assert(await target.evaluate(() => document.fonts.check('16px "Neue Haas Grotesk"')), 'standalone candidate font did not load');
}
function assert(ok, msg) { if (!ok) throw new Error(msg); }
function isActualSerif(font) { return /Georgia|Times New Roman/i.test(font); }
function isMondermanFont(font) { return /Neue Haas Grotesk/i.test(font); }
async function settleMedia(target, media) {
  await target.waitForFunction(mode => matchMedia(mode).matches, media);
  // Media matching can precede style/layout updates; preserve the exact assertions
  // below, but read them after two rendering frames in the requested medium.
  await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

await page.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });
await page.locator('body.production-samples-ready').waitFor({ state: 'attached', timeout: 30000 });

const hostTypography = await page.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  brand: getComputedStyle(document.querySelector('.brand')).fontFamily,
  intro: getComputedStyle(document.querySelector('.sample-library-heading')).fontFamily,
}));
for (const [where, font] of Object.entries(hostTypography)) {
  assert(!isActualSerif(font), `${where} contaminated by shared report serif CSS: ${font}`);
  assert(/Neue Haas|Helvetica|Arial/i.test(font), `${where} no longer uses Monderman sans typography: ${font}`);
}
assert((await page.locator('body').textContent()).includes('Representative product outputs, not customer data.'), 'designed representative-output disclosure missing');

async function openTab(key) {
  await page.locator(`[data-target="${key}"]`).click();
  await page.waitForTimeout(250);
  const shell = page.locator(`[data-report="${key}"]`);
  assert(await shell.isVisible(), `${key} shell not visible`);
  return shell;
}

async function assertNoHorizontalOverflow(target, label) {
  const geometry = await target.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  assert(geometry.documentWidth <= geometry.viewport + 1, `${label} overflows horizontally: ${geometry.documentWidth}px document in ${geometry.viewport}px viewport`);
}

// The four Diagnostic samples must be the live projection of the locked
// production-engine artifact, not the legacy hand-authored report markup.
const diagnostics = Object.fromEntries(Object.entries({os:'operational_systems',dv:'decision_velocity',sc:'structural_clarity',ip:'institutional_performance'}).map(([tab,key])=>{
  const source=artifact.outputs[key].source;
  return [tab,{score:String(source.score),dimensions:Object.keys(source.dimensions).length,source}];
}));
for (const [key, expected] of Object.entries(diagnostics)) {
  const shell = await openTab(key);
  const report = shell.locator('.psr-wrap');
  assert(await report.getAttribute('data-engine-commit') === artifact.engine_commit, `${key} engine revision mismatch`);
  assert(await report.getAttribute('data-artifact-sha256') === artifact.artifact_sha256, `${key} artifact digest mismatch`);
  assert((await shell.locator('.mr-run-score-stamp strong').textContent()).trim() === expected.score, `${key} score mismatch`);
  assert(await shell.locator('.mr-dimension-row').count() === expected.dimensions, `${key} dimension profile mismatch`);
  assert(await shell.locator('.mr-run-remedy').count() === 0, `${key} completed AI duplicates fallback remedy paths`);
  assert(await shell.locator('.mr-ai-action').count() === expected.source.ai_report.report.interpretation.recommendations.filter(a=>a.action?.trim()).length, `${key} accepted AI action count mismatch`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy sample remains in the live DOM`);
  const text = await shell.textContent();
  for (const token of ['Decision summary','Dimension profile',key==='sc'?'Clarity indicator distribution':'Where the measured issue appears','Evidence in this run',key==='sc'?'Review order and clarity indicators':'Priority order and measured severity','Method and limits','Interpretation boundary','No written participant notes are included.','AI-assisted interpretation']) {
    assert(text.includes(token), `${key} production-contract section missing: ${token}`);
  }
  for (const action of expected.source.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim())) {
    assert(text.includes(action.action), `${key} accepted next step differs from source`);
  }
  await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true });
}

// Cross-Lens: verify not just presence but hierarchy, typography, evidence-map
// integration, source-backed visual density, and de-duplication.
const cross = await openTab('synthesis');
assert(await cross.locator('.mr-cover').isVisible(), 'Cross-Lens source-aligned report cover not visible');
assert((await cross.locator('.mr-cover-score').textContent()).trim() === crossScore, 'Cross-Lens cover differs from current saved score');
assert((await cross.locator('.mr-cover-score-label').textContent()).trim() === 'Cross-Lens Composite Score', 'Cross-Lens cover is not showing the certified score label');
assert((await cross.locator('.mr-cover-score-band').textContent()).trim() === crossSource.condition_band, 'Cross-Lens condition line differs from saved condition');
assert(crossSource.condition_band !== crossSource.score_label, 'Cross-Lens condition must not duplicate the score label');
assert(await cross.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Cross-Lens interpretation boundary is not integrated into the opening cover');
const coverBoundaryText = await cross.locator('.mr-cover .mr-cover-boundary').textContent();
assert(/not a proven causal model/i.test(coverBoundaryText), 'Cross-Lens cover boundary lost its causal-interpretation limit');

const crossFirstHeading = (await cross.locator('.mr-section h2').first().textContent()).trim();
assert(await cross.locator('.mr-ai-interpretation').evaluate(el => el === el.parentElement.querySelector('.mr-section')), 'Accepted AI interpretation must lead the current report');
assert(await cross.locator('.mr-system-read').evaluate(el => el === [...el.parentElement.querySelectorAll(':scope > .mr-section')].find(node=>!node.classList.contains('mr-ai-interpretation'))), `Cross-Lens system read is not first measured section: ${crossFirstHeading}`);
const crossSystem = cross.locator('svg[aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"]');
assert(await crossSystem.isVisible(), 'Cross-Lens system picture not visible');
assert(await crossSystem.locator('circle').count() >= 2, 'Cross-Lens system picture lacks a substantive composite graphic');
const compositeLabelBox = await crossSystem.locator('.mr-system-composite-label').evaluate(el => {
  const box = el.getBBox();
  return { x:box.x, y:box.y, right:box.x + box.width, bottom:box.y + box.height, width:box.width, height:box.height };
});
assert(compositeLabelBox.x >= 290 && compositeLabelBox.right <= 430 && compositeLabelBox.bottom <= 258, `Cross-Lens composite label escapes its circle: ${JSON.stringify(compositeLabelBox)}`);
assert(await cross.locator('.mr-system-metrics .mr-run-metric').count() === 4, 'Cross-Lens system read does not expose four board metrics');
const crossChart = cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await crossChart.isVisible(), 'Cross-Lens comparison chart not visible');
const crossChartFont = await crossChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(crossChartFont), `Cross-Lens chart bypasses Neue Haas Grotesk: ${crossChartFont}`);
const crossTop = await crossSystem.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
// Promotional navigation and export controls sit outside the generated report.
// Measure the report hierarchy from the production renderer's document root so
// shell chrome cannot create a false regression in the executive-layout gate.
const crossStart = await cross.locator('.mr-report').evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const crossAIHeight=await cross.locator('.mr-ai-interpretation').evaluate(el=>el.getBoundingClientRect().height);
assert(crossTop - crossStart - crossAIHeight < 1150, `Cross-Lens chart is buried after the accepted interpretation`);

const crossText = await cross.textContent();
assert(crossText.includes('Executive synthesis'), 'Cross-Lens executive synthesis missing');
assert(crossText.includes('Agreements and differences'), 'Cross-Lens agreements/differences missing');
assert(crossText.includes('AI-assisted interpretation'), 'Cross-Lens accepted interpretation missing');
const crossActions=crossSource.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim()).map(row=>row.action);
assert(await cross.locator('.mr-ai-action').count()===crossActions.length, 'Cross-Lens accepted action count differs');
for(const action of crossActions)assert(crossText.includes(action),'Cross-Lens accepted action text differs');
assert(!crossText.includes('Source-backed remedy paths'), 'Cross-Lens rendered source remedy prose even though the source-prose contract withholds it');
assert(crossText.includes('Results by participant perspective'), 'Cross-Lens vantage-evidence layer missing');
assert(await cross.locator('.mr-remedy-card').count() === 0, 'Cross-Lens rendered remedy cards without eligible source remedy prose');
assert(crossText.includes('Diagnostic lenses at a glance'), 'Cross-Lens comparison picture label missing');
assert(await cross.locator('.mr-action-path .mr-action-step').count() === 0, 'Cross-Lens duplicates fallback actions beside accepted AI');
assert(await cross.locator('.mr-evidence-ladder .mr-evidence-step').count() === 4, 'Cross-Lens evidence ladder incomplete');
assert(await cross.locator('.psr-toc a').count() >= 10, 'Cross-Lens Contents rail is incomplete');

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
await crossSystem.screenshot({ path: path.join(out, 'cross-lens-system.png') });
await crossChart.screenshot({ path: path.join(out, 'cross-lens-chart.png') });
await evidenceMap.screenshot({ path: path.join(out, 'cross-lens-evidence-map.png') });
await exposureGraphic.screenshot({ path: path.join(out, 'cross-lens-exposure.png') });

// Depth: preserve the same typography, opening-boundary integration, and
// substantive distribution visualization.
const depth = await openTab('depth');
assert(await depth.locator('.mr-cover').isVisible(), 'Depth source-aligned report cover not visible');
assert((await depth.locator('.mr-cover-score').textContent()).trim() === depthScore, 'Depth cover differs from current saved score');
assert(depthSource.score_type === 'within_lens_median', 'Depth must preserve its within-diagnostic median basis');
assert((await depth.locator('.mr-cover-score-label').textContent()).trim() === depthSource.score_label, 'Depth cover differs from the saved diagnostic-specific median score label');
assert(await depth.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Depth interpretation boundary is not integrated into the opening cover');
const depthFirstHeading = (await depth.locator('.mr-section h2').first().textContent()).trim();
assert(await depth.locator('.mr-depth-system-read').isVisible(), `Depth executive distribution read is not first substantive section: ${depthFirstHeading}`);
const depthChart = depth.locator('svg[aria-label="Depth Synthesis score distribution"]');
assert(await depthChart.isVisible(), 'Depth distribution chart not visible');
const depthChartFont = await depthChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(depthChartFont), `Depth chart bypasses Neue Haas Grotesk: ${depthChartFont}`);
const depthTop = await depthChart.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const depthStart = await depth.locator('.mr-report').evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const depthAIHeight=await depth.locator('.mr-ai-interpretation').evaluate(el=>el.getBoundingClientRect().height);
assert(depthTop - depthStart - depthAIHeight < 1150, 'Depth chart is buried after the accepted interpretation');
assert((await depth.textContent()).includes(depthSource.sample_reads[0].vantage_gap.statement), 'Depth recorded perspective gap not visible');
assert((await depth.textContent()).includes('AI-assisted interpretation'), 'Depth accepted interpretation missing');
const depthActions=depthSource.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim()).map(row=>row.action);
assert(await depth.locator('.mr-ai-action').count()===depthActions.length, 'Depth accepted action count differs');
for(const action of depthActions)assert((await depth.textContent()).includes(action),'Depth accepted action text differs');
assert(!(await depth.textContent()).includes('Source-backed remedy paths'), 'Depth rendered source remedy prose even though the source-prose contract withholds it');
assert((await depth.textContent()).includes('Results by participant perspective'), 'Depth vantage-evidence layer missing');
assert(await depth.locator('.mr-remedy-card').count() === 0, 'Depth rendered remedy cards without eligible source remedy prose');
assert((await depth.textContent()).includes('Agreement, divergence, and coverage'), 'Depth agreement/divergence section missing');
assert(await depth.locator('.mr-depth-metrics .mr-run-metric').count() === 4, 'Depth opening read does not show four executive metrics');
assert(await depth.locator('.mr-action-path .mr-action-step').count() === 0, 'Depth duplicates fallback actions beside accepted AI');
assert(await depth.locator('.mr-evidence-ladder .mr-evidence-step').count() === 4, 'Depth evidence ladder incomplete');
assert(await depth.locator('.psr-toc a').count() >= 10, 'Depth Contents rail is incomplete');
assert(await depth.locator('.mr-report-boundary').isVisible(), 'Depth end interpretation boundary missing');
await page.screenshot({ path: path.join(out, 'depth-full.png'), fullPage: true });
await depth.locator('.mr-cover').screenshot({ path: path.join(out, 'depth-cover.png') });
await depthChart.screenshot({ path: path.join(out, 'depth-chart.png') });

const afterTypography = await page.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  brand: getComputedStyle(document.querySelector('.brand')).fontFamily,
  intro: getComputedStyle(document.querySelector('.sample-library-heading')).fontFamily,
}));
for (const [where, font] of Object.entries(afterTypography)) {
  assert(!isActualSerif(font), `${where} contaminated after report render: ${font}`);
}

// Standalone HTML/print surface must retain the same presentation contract.
const standaloneHtml = await page.evaluate(artifact => window.MondermanReport.buildReportHtml(window.MondermanPublicSamples.model(artifact.outputs.cross_lens_synthesis,artifact)),artifact);
const standalone = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await loadStandalone(standalone, standaloneHtml);
assert(await standalone.locator('.mr-cover').isVisible(), 'standalone report cover missing');
assert((await standalone.locator('.mr-cover-score').textContent()).trim() === crossScore, 'standalone Cross-Lens score differs from recorded value');
assert(await standalone.locator('.mr-cover .mr-cover-boundary').isVisible(), 'standalone cover interpretation boundary missing');
const standaloneChart = standalone.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await standaloneChart.isVisible(), 'standalone Cross-Lens chart missing');
assert(await standalone.locator('svg[aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"]').isVisible(), 'standalone Cross-Lens system picture missing');
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

// The authenticated report engine is certified independently of the public
// sample renderer. These pages use the locked production-scorer artifact as
// input, but render through the same MondermanReport.fromRun path used by
// Workspace. Samples are deliberately not used as an implementation proxy.
const authenticatedArtifact = JSON.parse(
  fs.readFileSync(new URL('../test-fixtures/authenticated-report-engine-runs.json', import.meta.url), 'utf8'),
);
const authenticatedRunHtml = await page.evaluate((artifact) => {
  return Object.fromEntries(Object.entries(artifact.outputs).map(([key, run]) => [
    key,
    window.MondermanReport.buildReportHtml(window.MondermanReport.fromRun(run)),
  ]));
}, authenticatedArtifact);
const authenticatedRunChecks = [];
const runDimensions = { operational_systems:6, decision_velocity:4, structural_clarity:5, institutional_performance:6 };
const viewports = [
  { name:'mobile', width:390, height:844 },
  { name:'tablet', width:768, height:1024 },
  { name:'desktop', width:1440, height:1100 },
];
for (const [key, html] of Object.entries(authenticatedRunHtml)) {
  const runPage = await browser.newPage({ viewport: { width:1440, height:1100 } });
  await loadStandalone(runPage, html);
  assert(await runPage.locator('.mr-run-decision').isVisible(), `${key} authenticated executive brief missing`);
  assert(await runPage.locator('.mr-run-decision').evaluate(el => el === document.querySelector('.mr-section')), `${key} executive brief is not first`);
  assert(await runPage.locator('.mr-dimension-row').count() === runDimensions[key], `${key} authenticated dimension profile mismatch`);
  assert(await runPage.locator('.mr-constraint-view').isVisible(), `${key} constraint concentration visual missing`);
  assert(await runPage.locator('.mr-exposure-flow').isVisible(), `${key} capacity/burden visual missing`);
  assert(await runPage.locator('.mr-priority-matrix').isVisible(), `${key} priority matrix missing`);
  assert(await runPage.locator('.mr-run-remedy').count() === 3, `${key} differentiated intervention paths missing`);
  assert(await runPage.locator('.mr-leadership-close').isVisible(), `${key} leadership handoff missing`);
  assert(await runPage.locator('.mr-leadership-close').evaluate(el => el === [...document.querySelectorAll('.mr-section')].at(-1)), `${key} leadership handoff is not the final substantive section`);
  assert(await runPage.locator('.mr-report-boundary').count() === 1, `${key} must contain one complete interpretation boundary`);
  assert(await runPage.locator('.mr-run-close-group > .mr-leadership-close + .mr-report-boundary').count() === 1, `${key} closing handoff and boundary must stay together in order`);
  // The scorer returns independently ordered priorities and options. Pairing
  // their array positions would manufacture a recommendation/evidence link.
  assert(await runPage.locator('.mr-run-remedy .mr-remedy-evidence').count() === 0, `${key} invents an option-to-priority evidence pairing`);
  assert((await runPage.locator('.mr-run-action-board .mr-lede').textContent()).includes('do not correspond one-to-one'), `${key} independent option/priority disclosure missing`);
  const reportText = await runPage.locator('.mr-report').textContent();
  assert(!/\[object Object\]|\bundefined\b|\bNaN\b/.test(reportText), `${key} exposes an invalid serialized value`);
  assert(!/None of this looks like an emergency/i.test(reportText), `${key} retains the rejected generic caveat`);
  const leadershipImplication = (await runPage.locator('.mr-run-decision-story > div').first().textContent()).trim();
  assert(leadershipImplication.length < 900, `${key} opening leadership implication is still an unedited prose wall`);

  for (const viewport of viewports) {
    await runPage.setViewportSize({ width:viewport.width, height:viewport.height });
    await runPage.emulateMedia({ media:'screen' });
    await settleMedia(runPage, 'screen');
    await assertNoHorizontalOverflow(runPage, `${key} ${viewport.name}`);
    assert(await runPage.locator('.mr-run-score-stamp').isVisible(), `${key} score stamp hidden at ${viewport.name}`);
    assert(await runPage.locator('.mr-priority-matrix').isVisible(), `${key} priority matrix hidden at ${viewport.name}`);
    await runPage.screenshot({ path:path.join(out, `authenticated-${key}-${viewport.name}.png`), fullPage:true });
  }

  // Letter minus two 60pt margins: 656 x 896 CSS pixels. Atomic cards must fit
  // that real printable area, not merely a wide desktop viewport.
  await runPage.setViewportSize({width:656,height:896});
  await runPage.emulateMedia({ media:'print' });
  await settleMedia(runPage, 'print');
  // Keep complete options within one printable page. Text extraction alone
  // does not establish appearance; use independent PDF rasterizers to separate
  // actual pagination defects from resolution-specific preview artifacts.
  const optionPrintFlow = await runPage.locator('.mr-run-remedy').evaluateAll(cards => cards.map(card => ({
    display:getComputedStyle(card).display,
    position:getComputedStyle(card).position,
    height:card.getBoundingClientRect().height,
    itemBreaks:[...card.querySelectorAll('li')].map(item => getComputedStyle(item).breakInside),
  })));
  assert(optionPrintFlow.every(card => card.display === 'inline-block' && card.position === 'static' && card.itemBreaks.every(value => value === 'auto')), `${key} unsafe nested option print fragmentation returned`);
  assert(optionPrintFlow.every(card => card.height <= 872), `${key} option is too tall for one printed page including margins`);
  await assertNoHorizontalOverflow(runPage, `${key} print`);
  assert(await runPage.locator('.mr-run-score-stamp').isVisible(), `${key} score stamp hidden in print`);
  assert(await runPage.locator('.mr-leadership-close').isVisible(), `${key} leadership handoff hidden in print`);
  await runPage.pdf({ path:path.join(out, `authenticated-${key}.pdf`), printBackground:true, preferCSSPageSize:true });
  authenticatedRunChecks.push(key);
  await runPage.close();
}

// Depth and Cross-Lens receive the same viewport and print/PDF contract. Their
// charts must remain early, visible, and truthful when the page reflows.
const synthesisHtml = await page.evaluate(artifact => ({
  cross_lens: window.MondermanReport.buildReportHtml(window.MondermanPublicSamples.model(artifact.outputs.cross_lens_synthesis,artifact)),
  depth: window.MondermanReport.buildReportHtml(window.MondermanPublicSamples.model(artifact.outputs.depth_synthesis,artifact)),
}),artifact);
const synthesisResponsiveChecks = [];
// Pin the recorded representative-fixture values, independently of renderer
// output. Compact screen text replaces the SVG at <=800px; it is not optional.
const fmt=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:1});
const read=depthSource.sample_reads[0], stats=read.score;
const compactSynthesisExpected = {
  cross_lens: {
    composite:['Equal-lens Composite',crossScore],stats:[],
    segments:crossSource.source_groups.map(g=>({label:g.tool_label,count:g.submitted_runs+' submitted runs',stats:[['Mean',fmt(g.mean_score)]]})),
  },
  depth: {
    composite:[],
    stats:[['Median',fmt(stats.median)],['Mean',fmt(stats.mean)],['Range',fmt(stats.min)+'–'+fmt(stats.max)],['Interquartile range',stats.iqr.map(fmt).join(' – ')],['Sample standard deviation',fmt(stats.sd)]],
    segments:read.segments.map(s=>({label:{operational:'Operational',managerial:'Managerial',senior_leader:'Senior Leader'}[s.participant_mode],count:s.n+' submitted runs',stats:[['Mean',fmt(s.mean_score)],['Median',fmt(s.median_score)]]})),
  },
};
for (const [key, html] of Object.entries(synthesisHtml)) {
  const synthesisPage = await browser.newPage({ viewport:{ width:1440, height:1100 } });
  await loadStandalone(synthesisPage, html);
  const primaryVisual = key === 'cross_lens'
    ? synthesisPage.locator('svg[aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"]')
    : synthesisPage.locator('svg[aria-label="Depth Synthesis score distribution"]');
  const primaryPanel = synthesisPage.locator(key === 'cross_lens' ? '.mr-system-panel' : '.mr-depth-distribution-panel');
  const compactVisual = primaryPanel.locator(':scope > .mr-synth-compact');
  assert(await primaryVisual.isVisible(), `${key} primary visual missing`);
  for (const viewport of viewports) {
    await synthesisPage.setViewportSize({ width:viewport.width, height:viewport.height });
    await synthesisPage.emulateMedia({ media:'screen' });
    await settleMedia(synthesisPage, 'screen');
    await assertNoHorizontalOverflow(synthesisPage, `${key} ${viewport.name}`);
    const compactExpected = viewport.width <= 800;
    assert(await primaryPanel.isVisible(), `${key} primary panel hidden at ${viewport.name}`);
    assert(await primaryVisual.isVisible() === !compactExpected, `${key} incorrect SVG visibility at ${viewport.name}`);
    assert(await compactVisual.isVisible() === compactExpected, `${key} incorrect compact visibility at ${viewport.name}`);
    if (compactExpected) {
      const actual = await compactVisual.evaluate(el => {
        const stats = parent => [...parent.querySelectorAll(':scope > .mr-synth-stat-list > div')]
          .map(row => [row.querySelector('dt').textContent.trim(),row.querySelector('dd').textContent.trim()]);
        return {
          composite: [...el.querySelectorAll('.mr-system-compact-composite > strong, .mr-system-compact-composite > span')].map(node => node.textContent.trim()),
          stats: stats(el),
          segments: [...el.querySelectorAll('.mr-synth-segment')].map(segment => ({
            label: segment.querySelector(':scope > strong').textContent.trim(),
            count: segment.querySelector(':scope > span').textContent.trim(), stats: stats(segment),
          })),
        };
      });
      assert(JSON.stringify(actual) === JSON.stringify(compactSynthesisExpected[key]), `${key} compact values differ from the stored fixture at ${viewport.name}: ${JSON.stringify(actual)}`);
      assert(await compactVisual.evaluate(el => {
        const panel = el.parentElement.getBoundingClientRect();
        return [...el.querySelectorAll('dt,dd,strong,span')].every(node => {
          const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
            && parseFloat(style.fontSize) >= 14 && rect.left >= panel.left - 1 && rect.right <= panel.right + 1
            && node.scrollWidth <= node.clientWidth + 1;
        });
      }), `${key} compact values are hidden, clipped or unreadable at ${viewport.name}`);
    }
    await synthesisPage.screenshot({ path:path.join(out, `${key}-${viewport.name}.png`), fullPage:true });
  }
  await synthesisPage.emulateMedia({ media:'print' });
  await settleMedia(synthesisPage, 'print');
  assert(await synthesisPage.locator('.mr-evidence-grid .mr-lens-card').evaluateAll(cards => cards.length > 0 && cards.every(card => getComputedStyle(card).display === 'block' && getComputedStyle(card).breakInside === 'avoid')), `${key} evidence rows no longer use intact block print flow`);
  await assertNoHorizontalOverflow(synthesisPage, `${key} print`);
  assert(await primaryVisual.isVisible(), `${key} primary visual hidden in print`);
  assert(!await compactVisual.isVisible(), `${key} duplicates compact values alongside the print chart`);
  await synthesisPage.pdf({ path:path.join(out, `${key}.pdf`), printBackground:true, preferCSSPageSize:true });
  synthesisResponsiveChecks.push(key);
  await synthesisPage.close();
}

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
  authenticatedRunChecks,
  synthesisResponsiveChecks,
  qualityChecks:{
    coverBoundaryIntegrated:true,
    crossLensEvidenceMap:true,
    crossLensSignalsDeduplicated:true,
    sourceBackedExposureVisual:true,
    singleRunInsightDepth:true,
    synthesisContentsNavigation:true,
    executiveDecisionFrame:true,
    crossLensSystemPicture:true,
    evidenceStrengthLadder:true,
    acceptedAIActionsWithoutFallbackDuplicates:true,
    synthesisChartsUseNeueHaas:true,
    standaloneParity:true,
  },
}, null, 2));
console.log('REPORT_PRESENTATION_RENDER_PASS');
await browser.close();
