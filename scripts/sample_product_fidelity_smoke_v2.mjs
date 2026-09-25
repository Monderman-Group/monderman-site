import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readPublicSampleFixture,publicResult} from './public_sample_fixture.mjs';

const base = process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';
const out = process.env.SAMPLE_OUT || '/tmp/sample-product-fidelity-smoke';
fs.mkdirSync(out, { recursive: true });
// Verify the public SDK against the page's SRI before replaying it locally.
// No live authentication or application-service request belongs in this test.
const sdkUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
const sdkResponse=await fetch(sdkUrl);
if(!sdkResponse.ok)throw Error('Public SDK download failed');
const sdk=Buffer.from(await sdkResponse.arrayBuffer());
const sdkIntegrity='sha384-'+createHash('sha384').update(sdk).digest('base64');
if(!fs.readFileSync('sample-report.html','utf8').includes('src="'+sdkUrl+'" integrity="'+sdkIntegrity+'"'))throw Error('Public SDK integrity differs from sample-report.html');

// A stale or unapproved artifact must fail before browser layout is mistaken
// for current-output fidelity. Never repin or replace it with mocked prose.
const {artifact}=readPublicSampleFixture();
const expectedArtifact = artifact.artifact_sha256;
const generationEngineCommits=Object.fromEntries(Object.entries(artifact.outputs).map(([key,entry])=>[key,entry.provenance.engine_commit]));
const expected = Object.fromEntries(Object.entries({os:'operational_systems',dv:'decision_velocity',sc:'structural_clarity',ip:'institutional_performance'}).map(([tab,key])=>{
  const entry=artifact.outputs[key],result=publicResult(entry);
  assert(entry.kind==='response_comparison'&&result.report_kind==='response_comparison',key+' must be the reviewed response comparison');
  assert(result.source_groups.length===1&&result.source_groups[0].tool_type===key,key+' comparison lens differs');
  assert(result.participant_count===15&&result.submitted_run_count===15,key+' included participant count differs');
  assert(result.campaign_evidence.depth.status==='in_progress'&&!result.recommended_path_available,key+' must remain below Synthesis readiness');
  assert(!result.financial_scenario,key+' comparison cannot acquire a financial scenario');
  return [tab,{source:key,score:String(result.aggregate_score),result,engineCommit:entry.provenance.engine_commit}];
}));

function assert(value, message) {
  if (!value) throw new Error(message);
}
async function assertPromotionalBoundary(shell,key) {
  assert(await shell.locator('.psr-wrap').getAttribute('data-engine-commit')===artifact.outputs[key].provenance.engine_commit,
    `${key} original generation revision differs from the entry provenance`);
  const text=await shell.textContent();
  assert(!text.includes('About this example'),`${key} retains the redundant promotional provenance section`);
  const disclosure=shell.locator('.mr-sample-disclosure');
  assert(await disclosure.count()===1&&await disclosure.isVisible(),`${key} must identify example data once on the cover`);
  assert((await disclosure.innerText()).trim()==='Sample report · Example data',`${key} approved example-data label differs`);
  assert(await shell.locator('.mr-run-method,.mr-meta-method').count()===1,`${key} promotional simplification removed the real report method`);
  // Paired rendering uses the same actual source without the promotional
  // marker. It proves genuine-report method retention, not a customer run.
  const entry=artifact.outputs[key];
  const paired=await shell.evaluate((_node,entry)=>{
    const report=window.MondermanReport;
    const model=entry.kind==='diagnostic'?report.fromRun(entry.source):report.fromSynthesis(entry.source);
    const doc=new DOMParser().parseFromString(report.buildReportHtml(model),'text/html');
    return {method:doc.querySelectorAll('.mr-run-method,.mr-meta-method').length,fictionalDisclosure:doc.querySelectorAll('.mr-sample-disclosure').length};
  },entry);
  assert(paired.method===1&&paired.fictionalDisclosure===0,`${key} genuine-report method or promotional-marker boundary regressed`);
}
async function emulateMediaAndSettle(page, media) {
  await page.emulateMedia({ media });
  await page.waitForFunction(mode => matchMedia(mode).matches, media);
  // The toolbar's print visibility must be read after the media styles settle.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.context().route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
await page.context().route(sdkUrl,route=>route.fulfill({contentType:'text/javascript',body:sdk,headers:{'Access-Control-Allow-Origin':'*'}}));
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' && !/supabase|connect|assistant/i.test(message.text())) errors.push(`console: ${message.text()}`);
});
// Downloadable report HTML points to the production font URLs. The localhost
// certification server should exercise the same files without relying on the
// live site's cross-origin font policy.
await page.context().route(/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/, async route => {
  const filename = new URL(route.request().url()).pathname.slice(1);
  await route.fulfill({
    status: 200,
    contentType: 'font/woff2',
    body: fs.readFileSync(path.resolve(filename)),
  });
});

await page.goto(`${base}/sample-report.html#os`, { waitUntil: 'networkidle', timeout: 90000 });
await page.locator('body.production-samples-ready').waitFor({ state: 'attached', timeout: 30000 });
// The current public comparisons do not replace individual-report coverage.
// These four historical deterministic engine inputs are separate test data;
// report_presentation_smoke also exercises their full responsive/print layout.
const individualFixture=JSON.parse(fs.readFileSync(new URL('../test-fixtures/authenticated-report-engine-runs.json',import.meta.url),'utf8'));
const individualChecks=await page.evaluate(fixture=>Object.entries(fixture.outputs).map(([key,source])=>{
  const model=MondermanReport.fromRun(source),doc=new DOMParser().parseFromString(MondermanReport.buildReportHtml(model),'text/html');
  return {key,kind:model.kind,score:doc.querySelector('.mr-run-score-stamp strong')?.textContent.trim(),dimensions:doc.querySelectorAll('.mr-dimension-row').length,
    notes:doc.querySelectorAll('.mr-run-evidence .mr-evidence-quote').length,expectedNotes:model.participantEvidence.length,
    method:doc.querySelectorAll('.mr-run-method').length,sampleMarkers:doc.querySelectorAll('.mr-sample-disclosure').length};
}),individualFixture);
assert(individualChecks.length===4,'Separate individual fixture inventory changed');
for(const row of individualChecks){
  const source=individualFixture.outputs[row.key].result;
  assert(row.kind==='run'&&row.score===String(source.score),row.key+' individual score path differs');
  assert(row.dimensions===Object.keys(source.dimensions).length,row.key+' individual dimension profile differs');
  assert(row.notes===row.expectedNotes&&row.method===1&&row.sampleMarkers===0,row.key+' individual evidence/method boundary differs');
}
assert(await page.locator('.report-shell select[aria-label="Jump to report section"]').count() === 6, 'all six generated reports require an accessible section navigator');
assert(await page.locator('main').count() === 1, 'sample library must expose exactly one main landmark');
assert(await page.locator('h1:visible').count() === 1, 'active sample must expose exactly one visible h1');
assert(await page.locator('.skip-link').getAttribute('href') === '#main-content', 'sample library skip link is missing');

await page.locator('#tab-os').focus();
await page.keyboard.press('ArrowRight');
assert(await page.locator('#tab-dv').getAttribute('aria-selected') === 'true', 'ArrowRight does not activate the next report tab');
assert(await page.locator('#tab-dv').getAttribute('tabindex') === '0', 'active report tab is not the roving tab stop');
assert(await page.locator('.dx-tab[tabindex="0"]').count() === 1, 'report tabs expose more than one roving tab stop');
await page.keyboard.press('End');
assert(await page.locator('#tab-depth').getAttribute('aria-selected') === 'true', 'End does not activate the final report tab');
await page.keyboard.press('Home');
assert(await page.locator('#tab-os').getAttribute('aria-selected') === 'true', 'Home does not activate the first report tab');

for (const [key, contract] of Object.entries(expected)) {
  await page.locator(`#tab-${key}`).click();
  const shell = page.locator(`#report-${key}`);
  assert(await shell.isVisible(), `${key} report shell is not visible`);
  const report = shell.locator('.psr-wrap');
  assert(await report.count() === 1, `${key} production-contract report is missing or duplicated`);
  assert(await shell.locator('.psr-doc-shell').count() === 1, `${key} shared promotional report frame is missing or duplicated`);
  assert(await shell.locator('.psr-toc a').count() >= 8, `${key} desktop contents rail is incomplete`);
  assert(await report.getAttribute('data-engine-commit') === contract.engineCommit, `${key} original generation revision mismatch`);
  assert(await report.getAttribute('data-artifact-sha256') === expectedArtifact, `${key} artifact digest mismatch`);
  assert(await report.getAttribute('data-source-key') === contract.source, `${key} source identity mismatch`);
  assert((await shell.locator('.mr-cover-score').innerText()).trim() === contract.score, `${key} included-response median mismatch`);
  assert((await shell.locator('.mr-cover-score-label').innerText()).trim() === contract.result.score_label, `${key} median label mismatch`);
  assert(await shell.locator('.mr-depth-distribution-panel').isVisible(), `${key} saved score distribution missing`);
  assert(await shell.locator('.mr-run-score-stamp,.mr-dimension-row,.mr-run-remedy,.mr-recommended-path,.mr-report-options').count() === 0, `${key} comparison became an individual report or recommended change path`);
  assert(await shell.locator('.mr-ai-action').count() === contract.result.ai_report.report.interpretation.recommendations.filter(a=>a.action?.trim()).length, `${key} is missing accepted AI actions`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy hand-authored report remains in the live DOM`);
  const executiveRead = shell.locator('.mr-depth-system-read');
  assert(await executiveRead.isVisible(), `${key} executive headline block is not visible`);
  const text = await shell.textContent();
  for (const token of [
    'Response comparison', 'Included responses only', 'Agreement, divergence, and coverage',
    'Results by participant perspective', 'Evidence in this run',
    'Interpretation and next steps', 'Method and limits', 'Interpretation boundary',
  ]) assert(text.includes(token), `${key} missing production-equivalent content: ${token}`);
  assert(await shell.locator('.mr-exposure-flow,.mr-exposure-range,.mr-financial-scenario,.mr-benefit-assumptions').count()===0,`${key} comparison displays a recovery estimate or financial scenario`);
  assert(!text.includes('How the time and cost estimate is built'),`${key} comparison retains the retired recovery section`);
  await assertPromotionalBoundary(shell,contract.source);
  const notes=contract.result.experiential_records||[],selection=contract.result.experiential_selection;
  assert(notes.length===12&&selection.available===15&&selection.incorporated===12&&selection.exhaustive===false,`${key} bounded observation selection differs`);
  const quoted=(contract.result.ai_report.report.interpretation.observations||[]).filter(row=>row.experiential_block).map(row=>row.experiential_block);
  const blocks=shell.locator('.mr-experience-evidence');
  assert(await blocks.count()===quoted.length,`${key} authored attributed-account count differs`);
  for(const [index,note]of quoted.entries()){
    assert((await blocks.nth(index).locator('blockquote').textContent())==='“'+note.text+'”',`${key} authored participant account was rewritten`);
    assert((await blocks.nth(index).locator('.mr-experience-scope').textContent())==='Scope: '+note.scope_label,`${key} account scope differs`);
  }
  for (const stale of ['Competing readings', 'What would update this read', 'Sample Depth Synthesis Report']) {
    assert(!text.includes(stale), `${key} still renders outdated content: ${stale}`);
  }
  await shell.locator('.psr-downloads summary').click();
  assert(await shell.getByRole('button', { name: 'Download HTML' }).isVisible(), `${key} HTML control missing`);
  assert(await shell.getByRole('button', { name: 'Download JSON' }).isVisible(), `${key} JSON control missing`);
  assert(await shell.getByRole('button', { name: 'Download PDF', exact:true }).isVisible(), `${key} print/PDF control missing`);
  await page.screenshot({ path: path.join(out, `${key}-desktop.png`), fullPage: true });
}

await page.locator('#tab-os').click();
const [htmlDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('#report-os').getByRole('button', { name: 'Download HTML' }).click(),
]);
assert(htmlDownload.suggestedFilename().endsWith('-executive-report.html'), 'public HTML export filename changed');
const [jsonDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('#report-os').getByRole('button', { name: 'Download JSON' }).click(),
]);
assert(jsonDownload.suggestedFilename().endsWith('.json'), 'public JSON export filename changed');
const [printReport] = await Promise.all([
  page.waitForEvent('popup'),
  page.locator('#report-os').getByRole('button', { name: 'Download PDF', exact:true }).click(),
]);
await printReport.waitForLoadState('domcontentloaded');
assert(await printReport.locator('.mr-report').isVisible(), 'public print/PDF report did not open');
await printReport.close();

await page.locator('#tab-synthesis').click();
const cross = page.locator('#report-synthesis');
assert(await cross.locator('.psr-doc-shell').count() === 1, 'Cross-Lens shared promotional report frame is missing');
assert(await cross.locator('.psr-toolbar').isVisible(), 'Cross-Lens shared report controls are missing');
const crossText = await cross.textContent();
assert(artifact.outputs.cross_lens_synthesis.source.score_type === 'equal_lens_mean', 'Cross-Lens must preserve its equal-lens mean basis');
assert(crossText.includes(artifact.outputs.cross_lens_synthesis.source.score_basis), 'Cross-Lens saved score basis is missing');
for (const token of ['Cross-Lens Composite Score', String(artifact.outputs.cross_lens_synthesis.source.cross_diagnostic_score), artifact.outputs.cross_lens_synthesis.source.evidence_assessment.evidence_label, 'equal-lens mean', 'Interpretation and next steps', 'Interpretation boundary']) {
  assert(crossText.includes(token), `Cross-Lens sample missing ${token}`);
}
assert(!crossText.includes('Source-backed remedy paths'), 'Cross-Lens sample rendered remedy prose that its source-prose contract withholds');
const crossActions=artifact.outputs.cross_lens_synthesis.source.ai_report.report.interpretation.recommendations.filter(row=>row.action?.trim()).map(row=>row.action);
assert(await cross.locator('.mr-report-nextsteps .mr-ai-action').count()===crossActions.length, 'Cross-Lens accepted next-step count differs');
assert(await cross.locator('.mr-report-options .mr-ai-action').count()===(artifact.outputs.cross_lens_synthesis.source.ai_report.report.interpretation.action_options||[]).length, 'Cross-Lens accepted alternatives count differs');
for(const action of crossActions)assert(crossText.includes(action), 'Cross-Lens accepted action text differs');
assert(await cross.locator('.mr-action-path .mr-action-step').count()===0, 'Cross-Lens duplicates fallback actions beside accepted AI');
assert(await cross.locator('.mr-remedy-card').count() === 0, 'Cross-Lens sample rendered remedy cards without eligible source prose');
await assertPromotionalBoundary(cross,'cross_lens_synthesis');
assert(await cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]').isVisible(), 'Cross-Lens comparison visual is not visible');
const crossCompositeLabel = await cross.locator('.mr-system-composite-label').evaluate((el) => {
  const box = el.getBBox();
  return { x:box.x, right:box.x + box.width, bottom:box.y + box.height };
});
assert(crossCompositeLabel.x >= 290 && crossCompositeLabel.right <= 430 && crossCompositeLabel.bottom <= 258, `Cross-Lens composite label escapes its circle: ${JSON.stringify(crossCompositeLabel)}`);
const crossTocTarget = cross.locator('.psr-toc a').nth(1);
await crossTocTarget.click();
assert(await cross.isVisible(), 'Cross-Lens contents navigation switched to another report');
assert(await page.locator('#tab-synthesis').getAttribute('aria-selected') === 'true', 'Cross-Lens contents navigation changed the selected product');
assert(new URL(page.url()).hash === '#synthesis', 'Cross-Lens contents navigation replaced the product hash');

await page.locator('#tab-depth').click();
const depth = page.locator('#report-depth');
assert(await depth.locator('.psr-doc-shell').count() === 1, 'Depth shared promotional report frame is missing');
assert(await depth.locator('.psr-toolbar').isVisible(), 'Depth shared report controls are missing');
const depthText = await depth.textContent();
await assertPromotionalBoundary(depth,'depth_synthesis');
for (const token of ['Median Diagnostic Score', String(artifact.outputs.depth_synthesis.source.aggregate_score), artifact.outputs.depth_synthesis.source.evidence_assessment.evidence_label, String(artifact.outputs.depth_synthesis.source.submitted_run_count), 'Agreement, divergence, and coverage', 'Interpretation boundary']) {
  assert(depthText.includes(token), `Depth sample missing ${token}`);
}
assert(await depth.locator('svg[aria-label="Depth Synthesis score distribution"]').isVisible(), 'Depth distribution visual is not visible');

const sampleViewports = [
  { name:'mobile', width:390, height:844 },
  { name:'tablet', width:768, height:1024 },
  { name:'desktop', width:1440, height:1100 },
];
for (const viewport of sampleViewports) {
  await page.setViewportSize({ width:viewport.width, height:viewport.height });
  for (const key of ['os', 'dv', 'sc', 'ip', 'synthesis', 'depth']) {
    await page.locator(`#tab-${key}`).click();
    const shell = page.locator(`#report-${key}`);
    const fit = await shell.evaluate((node) => ({
      shellClient: node.clientWidth,
      shellScroll: node.scrollWidth,
      rootClient: document.documentElement.clientWidth,
      rootScroll: document.documentElement.scrollWidth,
    }));
    assert(fit.shellScroll <= fit.shellClient, `${key} report overflows its ${viewport.width}px shell`);
    assert(fit.rootScroll <= fit.rootClient, `${key} creates horizontal page overflow at ${viewport.width}px`);
    assert(await shell.locator('.psr-doc-shell').count() === 1, `${key} loses the shared frame at ${viewport.name}`);
    if (viewport.width < 1080) {
      assert(await shell.locator('.psr-toc-mobile').isVisible(), `${key} mobile/tablet section navigator is hidden at ${viewport.name}`);
      assert(await shell.locator('.psr-toc').isVisible() === false, `${key} desktop rail remains visible at ${viewport.name}`);
    } else {
      assert(await shell.locator('.psr-toc').isVisible(), `${key} desktop contents rail is hidden`);
      assert(await shell.locator('.psr-toc-mobile').isVisible() === false, `${key} compact navigator remains visible on desktop`);
    }
  }
}
await page.setViewportSize({ width:390, height:844 });
await page.locator('#tab-os').click();
await page.screenshot({ path: path.join(out, 'os-390px.png'), fullPage: true });

await emulateMediaAndSettle(page, 'print');
assert(await page.locator('#report-os .mr-report').isVisible(), 'Response comparison disappears in print media');
assert(await page.locator('#report-os .psr-toolbar').isVisible() === false, 'interactive toolbar remains visible in print media');
await emulateMediaAndSettle(page, 'screen');

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
  ok: true,
  assembly_engine_commit: artifact.engine_commit,
  generation_engine_commits: generationEngineCommits,
  artifact_sha256: expectedArtifact,
  response_comparison_products: 4,
  separate_historical_individual_checks: individualChecks,
  synthesis_products: 2,
  responsive_widths: sampleViewports.map(viewport => viewport.width),
  console_errors: errors,
}, null, 2));
console.log('PRODUCTION_SAMPLE_PRODUCT_FIDELITY_PASS_6_OF_6');
await browser.close();
