import fs from 'node:fs';
import path from 'node:path';
import {readPublicSampleFixture,publicResult} from './public_sample_fixture.mjs';

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-presentation-smoke';
// Current publication coverage requires the reviewed six-output artifact.
// Assembly identity must not replace an entry's original generation identity.
const {artifact}=readPublicSampleFixture();
const crossSource=publicResult(artifact.outputs.cross_lens_synthesis), depthSource=publicResult(artifact.outputs.depth_synthesis);
const crossScore=String(crossSource.cross_diagnostic_score??crossSource.aggregate_score), depthScore=String(depthSource.aggregate_score);

// Sample-shell correction only: no renderer, report text, PDF or saved-data
// normalization. The browser checks below independently exercise its geometry.
const desktopShellCss = `  @media(min-width:1081px){
    :is(#report-synthesis,#report-depth) .psr-doc-shell { grid-template-columns:minmax(0,1fr); }
    :is(#report-synthesis,#report-depth) .psr-toc { position:static; }
    :is(#report-synthesis,#report-depth) .mr-screen-contents { display:block; }
  }`;
function assertDesktopShellSource(css) {
  assert(css.split(desktopShellCss).length===2,'Exactly one scoped desktop Synthesis shell correction is required');
  assert(!css.replace(desktopShellCss,'').includes(':is(#report-synthesis,#report-depth)'), 'No additional Synthesis-only shell overrides are permitted');
}
const sampleCss=fs.readFileSync(new URL('../sample-report-production.css',import.meta.url),'utf8');
assertDesktopShellSource(sampleCss);
let shellNegativeControls=0;
for(const changed of [
  sampleCss.replace('min-width:1081px','min-width:1080px'),
  sampleCss.replace('grid-template-columns:minmax(0,1fr); }','grid-template-columns:minmax(0,1fr) 240px; }'),
  sampleCss.replace('.psr-toc { position:static; }','.psr-toc { display:none; }'),
  sampleCss.replace('.mr-screen-contents { display:block; }','.mr-screen-contents { display:none; }'),
  sampleCss.replaceAll(':is(#report-synthesis,#report-depth) ',''),
]) {
  let rejected=false;try{assertDesktopShellSource(changed);}catch{rejected=true;}
  assert(rejected,'Sample shell guard accepted a changed scope, column, retained contents or native menu');shellNegativeControls++;
}
if(process.argv.includes('--sample-shell-only')) {
  console.log(JSON.stringify({status:'PASS',sourceChecks:1,negativeControls:shellNegativeControls,publicProducts:Object.keys(artifact.outputs).length,browserCoverage:'NOT_RUN',providerCalls:0}));
  process.exit(0);
}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(out, { recursive: true });
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
assert((await page.locator('body').textContent()).includes('These reports use realistic example responses to demonstrate Monderman’s analysis and reporting.'), 'designed representative-output disclosure missing');

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

async function assertDesktopSynthesisShell(shell,label) {
  for(const width of [1440,1121]) {
    await page.setViewportSize({width,height:1100});
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
    const geometry=await shell.evaluate(root=>{
      const frame=root.querySelector('.psr-doc-shell'),main=root.querySelector('.psr-main'),rail=root.querySelector('.psr-toc');
      const style=getComputedStyle(frame),frameRect=frame.getBoundingClientRect(),mainRect=main.getBoundingClientRect(),railRect=rail.getBoundingClientRect();
      const cards=[...root.querySelectorAll('.mr-overview-tile')].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
      const remaining=[...root.querySelectorAll('.mr-overview-sankey-outcome>span')].filter(node=>node.textContent.trim()==='Remaining').map(node=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length;});
      const contents=root.querySelector('.mr-screen-contents');
      return {columns:style.gridTemplateColumns.split(/\s+/).length,mainLeft:mainRect.left,mainRight:mainRect.right,
        frameLeft:frameRect.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),frameRight:frameRect.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),
        mainBottom:mainRect.bottom,railTop:railRect.top,railPosition:getComputedStyle(rail).position,railLinks:rail.querySelectorAll('a').length,
        menuDisplay:getComputedStyle(contents).display,menuLinkCount:contents.querySelectorAll('a').length,menuLinks:[...contents.querySelectorAll('a')].every(link=>root.contains(document.getElementById(link.hash.slice(1)))),cards,remaining};
    });
    assert(geometry.columns===1&&Math.abs(geometry.mainLeft-geometry.frameLeft)<=1&&Math.abs(geometry.mainRight-geometry.frameRight)<=1,label+' report does not fill its desktop shell at '+width+': '+JSON.stringify(geometry));
    assert(geometry.railPosition==='static'&&geometry.railTop>=geometry.mainBottom-1&&geometry.railLinks>=10,label+' complete contents must remain below the report');
    assert(geometry.menuDisplay!=='none'&&geometry.menuLinkCount>=10&&geometry.menuLinks,label+' native full section menu is unavailable');
    const [a,b,c,d]=geometry.cards;
    assert(geometry.cards.length===4&&Math.abs(a.top-b.top)<=1&&Math.abs(c.top-d.top)<=1&&b.left>a.left&&d.left>c.left&&c.top>=Math.max(a.bottom,b.bottom),label+' approved desktop 2×2 overview changed');
    assert(geometry.remaining.length===2&&geometry.remaining.every(lines=>lines===1),label+' Remaining chart labels split at '+width);
    await assertNoHorizontalOverflow(page,label+' desktop shell '+width);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function assertAuthoredSections(shell,source,label) {
  const interpretation=source.ai_report.report.interpretation;
  assert((await shell.locator('.mr-ai-interpretation > h2').textContent()).trim()==='Interpretation and next steps',label+' interpretation heading differs');
  for(const [field,selector]of [['recommendations','.mr-report-nextsteps'],['action_options','.mr-report-options']]){
    const expected=(interpretation[field]||[]).filter(item=>item.action?.trim()),cards=shell.locator(selector+' .mr-ai-action');
    assert(await cards.count()===expected.length,label+' '+field+' count differs');
    for(const [index,item]of expected.entries()){
      const card=cards.nth(index);
      assert((await card.locator('.mr-action-proposal').textContent()).trim()===item.action,label+' '+field+' action differs');
      assert((await card.textContent()).includes(item.reason),label+' '+field+' reason differs');
    }
  }
  assert(await shell.locator('.mr-ai-action').count()===(interpretation.recommendations||[]).length+(interpretation.action_options||[]).length,label+' extra action cards outside their source sections');
  const preferred=interpretation.recommended_option;
  assert(await shell.locator('.mr-recommended-path').count()===(preferred?1:0),label+' preferred option presence differs');
  if(preferred)assert((await shell.locator('.mr-recommended-path').textContent()).includes(preferred.reason),label+' preferred option reason differs');
  const records=(interpretation.observations||[]).filter(item=>item.experiential_block).map(item=>item.experiential_block);
  const blocks=shell.locator('.mr-experience-evidence');assert(await blocks.count()===records.length,label+' attributed account count differs');
  for(const [index,record]of records.entries()){
    assert((await blocks.nth(index).locator('blockquote').textContent())==='“'+record.text+'”',label+' attributed account differs');
    assert((await blocks.nth(index).locator('.mr-experience-scope').textContent())==='Scope: '+record.scope_label,label+' attributed scope differs');
  }
}

async function assertOperationalScenario(shell,source,label) {
  if(source.financial_scenario?.version==='operational-planning-scenario-20260919.2'){
    const scenario=source.financial_scenario,section=shell.locator('.mr-benefit-assumptions'),brief=shell.locator('.mr-financial-brief');
    assert(scenario.scope.scopeId===source.campaign_evidence.scopeId,label+' scenario is not bound to the saved campaign scope');
    assert(await section.isVisible(),label+' three-benefit assumptions not visible');
    assert(await shell.locator('.mr-exposure-range,.mr-exposure-flow,.mr-financial-scenario').count()===0,label+' retired or legacy financial output displayed beside v2');
    const rows=[['Lower current spending',scenario.benefits.spendingReduction.amount],['Avoided future spending',scenario.benefits.spendingAvoidance.amount],['Retained staff capacity',scenario.benefits.staffCapacity.amount],
      ['Retained staff hours',scenario.totals.potentialHoursFreed],['Cash investment',scenario.totals.cashInvestment,true],['Total cost including internal staff time',scenario.totals.totalImplementationAndSubscriptionCost,true],
      ['Net current-spending effect',scenario.totals.netExistingCashEffect],['Net spending versus baseline',scenario.totals.netCashEffect],['Net planning value',scenario.totals.netCapacityAndCashValue],['Entered benefit subtotal',scenario.totals.knownBenefitSubtotal],['Entered subtotal less full cost',scenario.totals.netKnownBenefitSubtotal]];
    const tableRows=brief.locator('.mr-benefit-screen-summary tbody tr');
    assert(await tableRows.count()===rows.length,label+' three-benefit comparison must retain every saved total');
    for(const [index,[title,values,paired]]of rows.entries()){
      const row=tableRows.nth(index);
      assert((await row.locator('th').textContent()).trim()===title,label+' '+title+' comparison label differs');
      for(const level of ['low','central','high']){
        const key=paired?({low:'high',central:'central',high:'low'})[level]:level;
        assert(await row.locator('[data-case="'+level+'"]').getAttribute('data-saved-value')===String(values[key]),label+' '+title+' '+level+' differs from saved case/cost pairing');
      }
    }
    const text=await section.textContent();
    for(const value of [scenario.inputs.costBasis,...Object.values(scenario.benefits).map(b=>b.basis),...scenario.inputs.capacity.activities.flatMap(a=>[a.label,a.sourceReference,a.changeBasis]),...['spendingReduction','spendingAvoidance'].flatMap(key=>scenario.inputs[key].items.flatMap(a=>[a.label,a.resourceId,a.sourceReference,a.changeBasis]))])assert(text.includes(value),label+' saved three-benefit source/assumption missing');
    assert(text.includes('Month-by-month capacity allocation'),label+' saved monthly reconciliation missing');
    assert((await brief.textContent()).includes('not confidence intervals or measured savings'),label+' planning boundary missing');
    return section;
  }
  const scenario=source.financial_scenario,section=shell.locator('.mr-financial-scenario');
  assert(scenario?.version==='operational-planning-scenario-20260913.1',label+' saved operational scenario missing');
  assert(scenario.scope.scopeId===source.campaign_evidence.scopeId,label+' scenario is not bound to the saved campaign scope');
  assert(await section.isVisible(),label+' operational scenario not visible');
  assert(await shell.locator('.mr-exposure-range,.mr-exposure-flow').count()===0,label+' retired score-derived exposure displayed');
  const number=value=>Number(value).toLocaleString('en-US',{maximumSignificantDigits:15});
  const money=value=>(Number(value)<0?'-$':'$')+number(Math.abs(Number(value)));
  const metrics=[['potentialHoursFreed','Potential time freed',number,'hours'],['capacityValue','Value of potential staff capacity',money,'Not cash savings'],
    ['avoidableNonLaborCash','Potential non-labor cash avoided',money,['low','central','high'].every(key=>scenario.totals.avoidableNonLaborCash[key]===0)?'No direct cash saving assumed.':'Separate expenditure'],['cashInvestment','Implementation cash and subscription cost',money,'Cash cost'],
    ['totalImplementationAndSubscriptionCost','Total implementation and subscription cost',money,'Includes internal staff time'],
    ['netCashEffect','Net cash effect',money,'Cash avoided minus cash cost'],['netCapacityAndCashValue','Net capacity and cash scenario value',money,'Includes staff capacity, not a cash return']];
  const cards=section.locator(':scope > .mr-scenario-metric');assert(await cards.count()===7,label+' requires all seven scenario metrics');
  for(const [index,[key,title,format,detail]]of metrics.entries()){
    const card=cards.nth(index),values=scenario.totals[key];
    assert((await card.locator('h3').textContent()).trim()===title,label+' '+key+' label differs');
    assert((await card.locator('.mr-copy').textContent()).trim()===detail,label+' '+key+' capacity/cash/cost qualification differs');
    assert(JSON.stringify(await card.locator('dt').allTextContents())===JSON.stringify(['Low scenario','Central scenario','High scenario']),label+' '+key+' scenario order differs');
    assert(JSON.stringify(await card.locator('dd').allTextContents())===JSON.stringify(['low','central','high'].map(k=>format(values[k]))),label+' '+key+' saved values differ');
  }
  const scopeValues=await section.locator(':scope > .mr-scenario-facts > div').evaluateAll(rows=>rows.filter(row=>row.querySelector('dt')?.textContent==='Scope').map(row=>row.querySelector('dd').textContent));
  assert(JSON.stringify(scopeValues)===JSON.stringify([scenario.scope.label]),label+' displayed scope differs');
  const text=await section.textContent();for(const value of [scenario.title,scenario.notice,...scenario.inputs.activities.flatMap(a=>[a.label,a.sourceReference,a.changeBasis,a.cashBasis])])assert(text.includes(value),label+' saved scenario source/assumption missing');
  return section;
}

async function assertFinancialReadingOrder(shell,source,measuredSelector,label) {
  const threeBenefit=source.financial_scenario?.version==='operational-planning-scenario-20260919.2';
  assert(threeBenefit||source.financial_scenario?.version==='operational-planning-scenario-20260913.1',label+' requires its saved valid financial scenario');
  assert(source.financial_scenario.scope.scopeId===source.campaign_evidence.scopeId,label+' financial scope differs from campaign');
  const brief=shell.locator('.mr-financial-brief');
  assert(await brief.count()===1,label+' requires exactly one financial brief');
  assert(await brief.isVisible(),label+' financial brief is not visible');
  assert(await brief.getAttribute(threeBenefit?'data-three-benefit-version':'data-financial-presentation')===(threeBenefit?'20260919.1':'financial-presentation-20260915.1'),label+' financial component version differs');
  if(threeBenefit)assert(await brief.evaluate(el=>window.MondermanReport?el.getAttribute('data-three-benefit-version')==='20260919.1':document.querySelector('meta[name="monderman-three-benefit-presentation-version"]')?.content==='three-benefit-presentation-20260919.1'),label+' runtime or standalone three-benefit component version differs');
  else assert(await brief.evaluate(()=>window.MondermanReport?window.MondermanReport.financialPresentationVersion:document.querySelector('meta[name="monderman-financial-presentation-version"]')?.content)==='financial-presentation-20260915.1',label+' runtime or standalone financial component version differs');
  assert((await brief.locator('h2').textContent()).trim()===(threeBenefit?'Decision brief: three sources of value':'Decision brief'),label+' first section heading differs');
  assert(await brief.evaluate((el,measuredSelector)=>{
    const sections=[...el.parentElement.querySelectorAll(':scope > .mr-section')];
    return sections[0]===el&&sections[1]?.matches('.mr-ai-interpretation')&&sections[2]?.matches(measuredSelector);
  },measuredSelector),label+' must begin financial brief, AI interpretation, then measured section in that exact order');
}

// The four lens samples are descriptive comparisons. Independent individual
// report coverage below continues to use the authenticated engine fixture.
const comparisons = Object.fromEntries(Object.entries({os:'operational_systems',dv:'decision_velocity',sc:'structural_clarity',ip:'institutional_performance'}).map(([tab,key])=>{
  const entry=artifact.outputs[key],source=publicResult(entry);
  assert(entry.kind==='response_comparison'&&source.report_kind==='response_comparison',key+' must be the reviewed response comparison');
  assert(source.source_groups.length===1&&source.source_groups[0].tool_type===key,key+' comparison lens differs');
  assert(source.participant_count===15&&source.submitted_run_count===15,key+' comparison participant count differs');
  assert(source.campaign_evidence.depth.status==='in_progress'&&source.recommended_path_available===false,key+' must remain below Synthesis readiness');
  assert(!source.financial_scenario,key+' comparison must not acquire a financial scenario');
  return [tab,{score:String(source.aggregate_score),source,engineCommit:entry.provenance.engine_commit}];
}));
for (const [key, expected] of Object.entries(comparisons)) {
  const shell = await openTab(key);
  const report = shell.locator('.psr-wrap');
  assert(await report.getAttribute('data-engine-commit') === expected.engineCommit, `${key} original generation revision mismatch`);
  assert(await report.getAttribute('data-artifact-sha256') === artifact.artifact_sha256, `${key} artifact digest mismatch`);
  assert((await shell.locator('.mr-cover-score').textContent()).trim() === expected.score, `${key} included-response median mismatch`);
  assert((await shell.locator('.mr-cover-score-label').textContent()).trim() === expected.source.score_label, `${key} median label mismatch`);
  assert(await shell.locator('.mr-depth-distribution-panel').isVisible(), `${key} score distribution missing`);
  assert(await shell.locator('.mr-run-score-stamp,.mr-dimension-row,.mr-run-remedy,.mr-recommended-path,.mr-report-options').count() === 0, `${key} comparison became an individual report or recommended change path`);
  await assertAuthoredSections(shell,expected.source,key);
  assert(await shell.locator('.mr-exposure-flow,.mr-exposure-range,.mr-financial-scenario,.mr-benefit-assumptions').count()===0,`${key} comparison displays a recovery estimate or financial scenario`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy sample remains in the live DOM`);
  const text = await shell.textContent();
  for (const token of ['Response comparison','Included responses only','Agreement, divergence, and coverage','Results by participant perspective','Evidence in this run','Method and limits','Interpretation boundary','Interpretation and next steps']) {
    assert(text.includes(token), `${key} production-contract section missing: ${token}`);
  }
  assert(expected.source.experiential_records.length===12&&expected.source.experiential_selection.available===15&&expected.source.experiential_selection.exhaustive===false,`${key} selected-observation disclosure differs`);
  for (const action of expected.source.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim())) {
    assert(text.includes(action.action), `${key} accepted next step differs from source`);
  }
  await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true });
}

// Cross-Lens: verify not just presence but hierarchy, typography, evidence-map
// integration, source-backed visual density, and de-duplication.
const cross = await openTab('synthesis');
await assertDesktopSynthesisShell(cross,'Cross-Lens');
assert(await cross.locator('.mr-cover').isVisible(), 'Cross-Lens source-aligned report cover not visible');
assert((await cross.locator('.mr-cover-score').textContent()).trim() === crossScore, 'Cross-Lens cover differs from current saved score');
assert((await cross.locator('.mr-cover-score-label').textContent()).trim() === 'Cross-Lens Composite Score', 'Cross-Lens cover is not showing the certified score label');
assert((await cross.locator('.mr-cover-score-band').textContent()).trim() === crossSource.condition_band, 'Cross-Lens condition line differs from saved condition');
assert(crossSource.condition_band !== crossSource.score_label, 'Cross-Lens condition must not duplicate the score label');
assert(await cross.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Cross-Lens interpretation boundary is not integrated into the opening cover');
const coverBoundaryText = await cross.locator('.mr-cover .mr-cover-boundary').textContent();
assert(/not a proven causal model/i.test(coverBoundaryText), 'Cross-Lens cover boundary lost its causal-interpretation limit');

await assertFinancialReadingOrder(cross,crossSource,'.mr-system-read','Cross-Lens');
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
// Cover and authored interpretation are source-length-dependent. The measured
// section must immediately follow the interpretation, with its chart near the
// section's beginning; don't charge the cover's content to chart placement.
async function assertEarlyMeasuredChart(shell, sectionSelector, chart, label) {
  const section=await shell.locator(sectionSelector).boundingBox();
  const interpretation=await shell.locator('.mr-ai-interpretation').boundingBox();
  const visual=await chart.boundingBox();
  assert(section&&interpretation&&visual,label+' measured geometry missing');
  const geometry={gap:section.y-interpretation.y-interpretation.height,chartOffset:visual.y-section.y};
  assert(geometry.gap>=-1&&geometry.gap<=64,label+' measured section separated from interpretation: '+JSON.stringify(geometry));
  assert(geometry.chartOffset>=0&&geometry.chartOffset<1150,label+' chart is buried within measured section: '+JSON.stringify(geometry));
}
await assertEarlyMeasuredChart(cross,'.mr-system-read',crossSystem,'Cross-Lens');

const crossText = await cross.textContent();
assert(crossText.includes('Executive synthesis'), 'Cross-Lens executive synthesis missing');
assert(crossText.includes('Agreements and differences'), 'Cross-Lens agreements/differences missing');
await assertAuthoredSections(cross,crossSource,'Cross-Lens');
const crossActions=crossSource.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim()).map(row=>row.action);
assert(await cross.locator('.mr-report-nextsteps .mr-ai-action').count()===crossActions.length, 'Cross-Lens accepted next-step count differs');
for(const action of crossActions)assert(crossText.includes(action),'Cross-Lens accepted action text differs');
assert(!crossText.includes('Source-backed remedy paths'), 'Cross-Lens rendered source remedy prose even though the source-prose contract withholds it');
assert(crossText.includes('Results by participant perspective'), 'Cross-Lens vantage-evidence layer missing');
assert(await cross.locator('.mr-remedy-card').count() === 0, 'Cross-Lens rendered remedy cards without eligible source remedy prose');
assert(crossText.includes('Diagnostic lenses at a glance'), 'Cross-Lens comparison picture label missing');
assert(await cross.locator('.mr-action-path .mr-action-step').count() === 0, 'Cross-Lens duplicates fallback actions beside accepted AI');
async function assertCampaignReadinessExplanation(shell,source,label) {
  assert(source.campaign_evidence?.depth,label+' fixture lacks campaign readiness');
  assert(await shell.locator('.mr-evidence-ladder').count()===0,label+' campaign readiness replaced by legacy evidence-size ladder');
  assert((await shell.textContent()).includes('Campaign readiness checks the declared population, compatible measurements and the possible effect of missing responses. Passing these checks is not scientific validation or a probability of accuracy.'),label+' campaign readiness explanation missing');
}
await assertCampaignReadinessExplanation(cross,crossSource,'Cross-Lens');
assert(await cross.locator('.psr-toc a').count() >= 10, 'Cross-Lens Contents rail is incomplete');

const evidenceMap = cross.locator('.mr-cross-lens-map');
assert(await evidenceMap.isVisible(), 'Cross-Lens evidence map not visible');
assert(await evidenceMap.locator('.mr-map-lens').count() === 4, 'Cross-Lens evidence map does not preserve all four contributing lenses');
assert(await evidenceMap.locator('.mr-map-signal').count() >= 2, 'Cross-Lens evidence map is too thin to show recurring signals');
assert((await evidenceMap.textContent()).includes('does not assert a causal pathway'), 'Cross-Lens evidence map lost the non-causal interpretation boundary');
assert(await cross.getByText('Recurring signals', { exact: true }).count() === 0, 'Cross-Lens signal narrative is duplicated below the evidence map');

const scenarioGraphic=await assertOperationalScenario(cross,crossSource,'Cross-Lens');

const crossBoundary = cross.locator('.mr-report-boundary');
assert(await crossBoundary.isVisible(), 'Cross-Lens end interpretation boundary missing');
const boundaryStyle = await crossBoundary.evaluate(el => ({ bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color }));
assert(!/rgb\(4, 24, 27\)|rgb\(7, 51, 56\)|rgb\(8, 56, 62\)/.test(boundaryStyle.bg), `Cross-Lens boundary remains dark/afterthought styling: ${boundaryStyle.bg}`);
await page.screenshot({ path: path.join(out, 'cross-lens-full.png'), fullPage: true });
await cross.locator('.mr-cover').screenshot({ path: path.join(out, 'cross-lens-cover.png') });
await crossSystem.screenshot({ path: path.join(out, 'cross-lens-system.png') });
await crossChart.screenshot({ path: path.join(out, 'cross-lens-chart.png') });
await evidenceMap.screenshot({ path: path.join(out, 'cross-lens-evidence-map.png') });
await scenarioGraphic.screenshot({ path: path.join(out, 'cross-lens-operational-scenario.png') });

// Depth: preserve the same typography, opening-boundary integration, and
// substantive distribution visualization.
const depth = await openTab('depth');
await assertDesktopSynthesisShell(depth,'Depth');
assert(await depth.locator('.mr-cover').isVisible(), 'Depth source-aligned report cover not visible');
assert((await depth.locator('.mr-cover-score').textContent()).trim() === depthScore, 'Depth cover differs from current saved score');
assert(depthSource.score_type === 'within_lens_median', 'Depth must preserve its within-diagnostic median basis');
assert((await depth.locator('.mr-cover-score-label').textContent()).trim() === depthSource.score_label, 'Depth cover differs from the saved diagnostic-specific median score label');
assert(await depth.locator('.mr-cover .mr-cover-boundary').isVisible(), 'Depth interpretation boundary is not integrated into the opening cover');
await assertFinancialReadingOrder(depth,depthSource,'.mr-depth-system-read','Depth');
assert(await depth.locator('.mr-depth-system-read').isVisible(), 'Depth executive distribution read is not visible');
const depthChart = depth.locator('svg[aria-label="Depth Synthesis score distribution"]');
assert(await depthChart.isVisible(), 'Depth distribution chart not visible');
const depthChartFont = await depthChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(depthChartFont), `Depth chart bypasses Neue Haas Grotesk: ${depthChartFont}`);
await assertEarlyMeasuredChart(depth,'.mr-depth-system-read',depthChart,'Depth');
assert((await depth.textContent()).includes(depthSource.sample_reads[0].vantage_gap.statement), 'Depth recorded perspective gap not visible');
await assertAuthoredSections(depth,depthSource,'Depth');
await assertOperationalScenario(depth,depthSource,'Depth');
const depthActions=depthSource.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim()).map(row=>row.action);
assert(await depth.locator('.mr-report-nextsteps .mr-ai-action').count()===depthActions.length, 'Depth accepted next-step count differs');
for(const action of depthActions)assert((await depth.textContent()).includes(action),'Depth accepted action text differs');
assert(!(await depth.textContent()).includes('Source-backed remedy paths'), 'Depth rendered source remedy prose even though the source-prose contract withholds it');
assert((await depth.textContent()).includes('Results by participant perspective'), 'Depth vantage-evidence layer missing');
assert(await depth.locator('.mr-remedy-card').count() === 0, 'Depth rendered remedy cards without eligible source remedy prose');
assert((await depth.textContent()).includes('Agreement, divergence, and coverage'), 'Depth agreement/divergence section missing');
assert(await depth.locator('.mr-depth-metrics .mr-run-metric').count() === 4, 'Depth opening read does not show four executive metrics');
assert(await depth.locator('.mr-action-path .mr-action-step').count() === 0, 'Depth duplicates fallback actions beside accepted AI');
await assertCampaignReadinessExplanation(depth,depthSource,'Depth');
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
await assertFinancialReadingOrder(standalone,crossSource,'.mr-system-read','Standalone Cross-Lens');
assert(await standalone.locator('.mr-cover').isVisible(), 'standalone report cover missing');
assert((await standalone.locator('.mr-cover-score').textContent()).trim() === crossScore, 'standalone Cross-Lens score differs from recorded value');
assert(await standalone.locator('.mr-cover .mr-cover-boundary').isVisible(), 'standalone cover interpretation boundary missing');
const standaloneChart = standalone.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]');
assert(await standaloneChart.isVisible(), 'standalone Cross-Lens chart missing');
assert(await standalone.locator('svg[aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"]').isVisible(), 'standalone Cross-Lens system picture missing');
const standaloneChartFont = await standaloneChart.evaluate(el => getComputedStyle(el).fontFamily);
assert(isMondermanFont(standaloneChartFont), `standalone chart bypasses Neue Haas Grotesk: ${standaloneChartFont}`);
assert(await standalone.locator('.mr-cross-lens-map').isVisible(), 'standalone Cross-Lens evidence map missing');
await assertOperationalScenario(standalone, crossSource, 'Standalone Cross-Lens');
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
  assert(await runPage.locator('.mr-exposure-flow').count()===0, `${key} historical single-run modeled exposure must remain undisplayed`);
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
  await assertFinancialReadingOrder(synthesisPage,key==='cross_lens'?crossSource:depthSource,key==='cross_lens'?'.mr-system-read':'.mr-depth-system-read',key+' standalone');
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
  responseComparisonTabs:4,
  synthesisTabs:2,
  authenticatedRunChecks,
  synthesisResponsiveChecks,
  qualityChecks:{
    coverBoundaryIntegrated:true,
    crossLensEvidenceMap:true,
    crossLensSignalsDeduplicated:true,
    savedOperationalScenarioMetricsAndCasePairing:true,
    financialScenarioVersions:[...new Set([crossSource,depthSource].map(source=>source.financial_scenario.version))],
    singleRunInsightDepth:true,
    synthesisContentsNavigation:true,
    executiveDecisionFrame:true,
    crossLensSystemPicture:true,
    campaignReadinessWithoutLegacySizeLadder:true,
    acceptedAIActionsWithoutFallbackDuplicates:true,
    synthesisChartsUseNeueHaas:true,
    standaloneParity:true,
  },
}, null, 2));
console.log('REPORT_PRESENTATION_RENDER_PASS');
await browser.close();
