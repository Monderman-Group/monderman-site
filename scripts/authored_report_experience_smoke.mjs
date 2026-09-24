// Public CI: actual approved public samples only, no private engine source.
// Explicit private release mode: committed engine inputs + mocked prose.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {loadEvidenceApi,verifyEvidenceFixture,EVIDENCE_MANIFEST} from './evidence_api_fixture.mjs';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
const privateMode=Boolean(process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR);
const out=process.env.SAMPLE_OUT||'/tmp/monderman-authored-report-layout';
fs.mkdirSync(out,{recursive:true});
globalThis.fetch=()=>{throw Error('No network permitted in synthetic layout generation');};
const renderer=fs.readFileSync('monderman-report.js','utf8'),safety=fs.readFileSync('participant-evidence-safety.js','utf8'),results=[];
const sha256=value=>createHash('sha256').update(value).digest('hex');
const harnessFile=new URL(import.meta.url);
const sourceBindings={renderer_sha256:sha256(renderer),safety_sha256:sha256(safety),harness_sha256:sha256(fs.readFileSync(harnessFile)),fixture_manifest_sha256:null};
let sourceCommit,fixtureLabel,fixtureManifestFile;
if(privateMode){
const verifiedFixture=verifyEvidenceFixture(process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR);
fixtureManifestFile=path.join(verifiedFixture.directory,EVIDENCE_MANIFEST);
sourceBindings.fixture_manifest_sha256=sha256(fs.readFileSync(fixtureManifestFile));
const {prepareCurrentSamples,buildReportProsePlan,REPORT_PROSE_VERSION,buildReportAIComposition,publicAIState}=await loadEvidenceApi();
sourceCommit=verifiedFixture.manifest.source_commit;
const prepared=await prepareCurrentSamples({generatedAt:'2026-09-11T12:00:00.000Z',engineCommit:sourceCommit});
fixtureLabel='PRIVATE release gate: actual committed deterministic inputs and private/public projections; prose is MOCK, not live output evidence.';
for(const job of prepared.privateEvidence.jobs){
  const packet=job.packet,plan=buildReportProsePlan(packet);
  const wire={version:REPORT_PROSE_VERSION,engine_catalog_sha256:plan.catalog_sha256,
    summary:{text:'The supplied responses describe how participants experience the work. Compare the recorded conditions with operating records before deciding what to change.',evidence_ids:['F1'],source_ids:[]},
    observations:[{text:'The recorded score is {{F1}}. It describes the supplied evidence, not a prediction of organizational performance.',evidence_ids:['F1'],source_ids:[]}],
    hypotheses:[],recommendations:plan.actions.slice(0,2).map((a,i)=>({action_id:a.id,action:a.action,reason:i?'Compare the reported condition with recent operating records before deciding whether a change is justified.':'The recorded response identifies a condition to check with the people responsible before proposing a change.',evidence_ids:a.evidence_ids,source_ids:a.source_ids})),
    action_options:plan.options.map(o=>({option_id:o.id,action:o.action,reason:'Consider this '+o.intensity+' alternative only after checking the stated prerequisites and safeguards against the observed work.',evidence_ids:o.evidence_ids,source_ids:o.source_ids})),
    recommended_option:plan.preferred_option_id?{option_id:plan.preferred_option_id,reason:'The authorized operating review supports testing this option within the recorded safeguards.',evidence_ids:plan.options.find(o=>o.id===plan.preferred_option_id).evidence_ids,source_ids:[]}:null,limitations:[]};
  const composition=buildReportAIComposition(wire,packet);
  const groupFacts=new Map((packet.campaign_source_evidence?.groups||[]).flatMap(group=>Object.values(group.measures).map(id=>[id,{group_ref:group.group_ref,group_label:group.label}])));
  const report={version:'MOCK-PROSE-NOT-PUBLICATION',model:'claude-opus-5',generated_at:'2026-09-11T12:00:00Z',snapshot_id:packet.snapshot_id,
    composition:{version:composition.version,authorship:composition.authorship,engine_bound:true},interpretation:composition.interpretation,
    evidence:packet.facts.map(f=>({...f,...(groupFacts.get(f.id)||{})})),experiential_evidence:packet.experiential_records||[],evidence_references:{summary:composition.summaryEvidence.evidence_ids,summary_sources:composition.summaryEvidence.source_ids},
    ...(packet.campaign_source_evidence?{campaign_answer_evidence:structuredClone(packet.campaign_source_evidence)}:{}),
    sources:packet.research.sources,benchmark:packet.research.benchmark,limitations:packet.limitations,research_context:{status:'not_started',checked_at:null}};
  const ai={status:'complete',report},entry=prepared.publicDraft.outputs[job.key];
  results.push({key:job.key,kind:entry.kind,projection:'private',source:{...job.source,ai_report:ai},provenance:entry.provenance});
  // Exercise the actual committed public projection, not only the richer
  // private packet. Missing evidence references must fail this same display
  // gate; mocked prose remains explicitly non-publication in both variants.
  results.push({key:job.key,kind:entry.kind,projection:'public',source:{...entry.source,ai_report:publicAIState(ai)},provenance:entry.provenance});
}
}else{
  const {artifact}=readPublicSampleFixture();sourceCommit=artifact.engine_commit;
  fixtureLabel='PUBLIC CI: actual reviewed public sample artifact and public display only; no private source or private engine execution.';
  for(const [key,entry]of Object.entries(artifact.outputs))results.push({key,kind:entry.kind,projection:'public',source:entry.source,provenance:entry.provenance});
}
const outputLabel=privateMode?'MOCK':'REVIEWED-PUBLIC';
const checks=[],errors=[];
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push({engine:name,error:e.message}));
    await page.route('**/*',route=>{const url=new URL(route.request().url());if(/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(url.pathname.slice(1))});return route.abort();});
    for(const result of results){
      await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:safety});await page.addScriptTag({content:renderer});
      assert.ok(['diagnostic','response_comparison','synthesis'].includes(result.kind));
      const html=await page.evaluate(({source,provenance,kind})=>{const m=kind==='diagnostic'?MondermanReport.fromRun(source):MondermanReport.fromSynthesis(source);m.sampleProvenance=provenance;return MondermanReport.buildReportHtml(m);},result);
      assert.doesNotMatch(html,/About this example|\[object Object\]|\bundefined\b|\bNaN\b/);
      assert.match(html,/Sample report · Example data/);
      assert.doesNotMatch(html,/fictional inputs|Neither review establishes scientific validity or guarantees a result/);
      if(result.kind==='diagnostic')assert.doesNotMatch(html,/No written participant notes are included/,'Actual saved observations must appear in the evidence section');
      if(result.kind==='response_comparison'){
        assert.equal(result.source.report_kind,'response_comparison');
        assert.match(html,/response comparison/);
        assert.equal(result.source.recommended_path_available,false);
      }
      for(const width of [1440,834,390,320]){
        await page.setViewportSize({width,height:1000});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('.mr-authored-report').count(),1);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${result.projection}/${result.key}/${width}: overflow`);
        const missing=await page.locator('.mr-screen-nav a,.mr-screen-action').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));assert.deepEqual(missing,[]);
        assert(await page.locator('.mr-cover .mr-sample-disclosure').isVisible());
        assert(await page.locator('.mr-evidence-detail').count()>0,`${result.projection}/${result.key}: saved supporting evidence is missing`);
        const detail=page.locator('.mr-evidence-detail').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');assert(await detail.getAttribute('open')!==null);
        if(result.kind==='synthesis'){assert.equal(await page.locator('.mr-report-options .mr-ai-action').count(),3);assert.equal(await page.locator('.mr-recommended-path').count(),1);}
        else {assert.equal(await page.locator('.mr-report-options').count(),0);assert.equal(await page.locator('.mr-recommended-path').count(),0);}
        const link=page.locator('.mr-screen-shortcuts [data-report-link-role=guidance]');if(await link.count()){await link.click();const target=await link.getAttribute('href');assert(await page.locator(target).evaluate(el=>el===document.activeElement));}
        if(width===390||width===1440)await page.locator('.mr-authored-report').screenshot({path:path.join(out,`${name}-${result.projection}-${result.key}-${width}.png`)});
        checks.push({engine:name,projection:result.projection,key:result.key,kind:result.kind,width,overflow:false,keyboardEvidence:true,navigationTargets:true});
      }
      if(name==='chromium'){
        await page.emulateMedia({media:'print'});
        // Closed evidence must appear in the actual PDF, not merely in the DOM.
        await page.locator('.mr-evidence-detail').evaluateAll(nodes=>nodes.forEach(n=>n.open=false));
        await page.pdf({path:path.join(out,`${result.projection}-${result.key}-${outputLabel}.pdf`),format:'Letter',printBackground:true,preferCSSPageSize:true});
        await page.emulateMedia({media:'screen'});
        fs.writeFileSync(path.join(out,`${result.projection}-${result.key}-${outputLabel}.html`),html);
      }
    }
  }finally{await browser.close();}
}
// A passing receipt must identify the bytes actually rendered, and must not
// survive a concurrent candidate/fixture edit during this multi-browser run.
assert.deepEqual({renderer_sha256:sha256(fs.readFileSync('monderman-report.js')),safety_sha256:sha256(fs.readFileSync('participant-evidence-safety.js')),harness_sha256:sha256(fs.readFileSync(harnessFile)),fixture_manifest_sha256:fixtureManifestFile?sha256(fs.readFileSync(fixtureManifestFile)):null},sourceBindings,'Rendering sources changed during the run; discard these artifacts and rerun');
if(privateMode)assert.equal(verifyEvidenceFixture(process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR).manifest.source_commit,sourceCommit);
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({receipt_version:'authored-report-experience/v2',status:'PASS',sourceCommit,sourceBindings,fixture:fixtureLabel,checks,errors,productionCalls:0},null,2));console.log(JSON.stringify({status:'PASS',mode:privateMode?'private-engine-mock-prose':'reviewed-public-samples',renders:checks.length,engines:['chromium','webkit'],projections:privateMode?['private','public']:['public'],pdfs:results.length,productionCalls:0,out}));
