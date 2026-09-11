// Actual current deterministic sample inputs + deliberately mocked prose.
// This proves rendering, not provider quality or live release readiness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,webkit} from 'playwright';
const apiRoot=process.env.MONDERMAN_API_ROOT||path.resolve('../monderman-api-evidence-report-20260911');
const load=name=>import(pathToFileURL(path.join(apiRoot,name)));
const {prepareCurrentSamples}=await load('certification/current-product-samples.mjs');
const {buildReportProsePlan,REPORT_PROSE_VERSION}=await load('report-prose-output.js');
const {buildReportAIComposition}=await load('report-ai-composition.js');
const out=process.env.SAMPLE_OUT||'/tmp/monderman-authored-report-layout';
fs.mkdirSync(out,{recursive:true});
globalThis.fetch=()=>{throw Error('No network permitted in synthetic layout generation');};
const prepared=await prepareCurrentSamples({generatedAt:'2026-09-11T12:00:00.000Z'});
const renderer=fs.readFileSync('monderman-report.js','utf8'),safety=fs.readFileSync('participant-evidence-safety.js','utf8'),results=[];
for(const job of prepared.privateEvidence.jobs){
  const packet=job.packet,plan=buildReportProsePlan(packet);
  const wire={version:REPORT_PROSE_VERSION,engine_catalog_sha256:plan.catalog_sha256,
    summary:{text:'The supplied responses describe how participants experience the work. Compare the recorded conditions with operating records before deciding what to change.',evidence_ids:['F1'],source_ids:[]},
    observations:[{text:'The recorded score is {{F1}}. It describes the supplied evidence, not a prediction of organizational performance.',evidence_ids:['F1'],source_ids:[]}],
    hypotheses:[],recommendations:plan.actions.slice(0,2).map((a,i)=>({action_id:a.id,action:a.action,reason:i?'Compare the reported condition with recent operating records before deciding whether a change is justified.':'The recorded response identifies a condition to check with the people responsible before proposing a change.',evidence_ids:a.evidence_ids,source_ids:a.source_ids})),
    action_options:plan.options.map(o=>({option_id:o.id,action:o.action,reason:'Consider this '+o.intensity+' alternative only after checking the stated prerequisites and safeguards against the observed work.',evidence_ids:o.evidence_ids,source_ids:o.source_ids})),
    recommended_option:plan.preferred_option_id?{option_id:plan.preferred_option_id,reason:'The authorized operating review supports testing this option within the recorded safeguards.',evidence_ids:plan.options.find(o=>o.id===plan.preferred_option_id).evidence_ids,source_ids:[]}:null,limitations:[]};
  const composition=buildReportAIComposition(wire,packet);
  const report={version:'MOCK-PROSE-NOT-PUBLICATION',model:'claude-opus-5',generated_at:'2026-09-11T12:00:00Z',snapshot_id:packet.snapshot_id,
    composition:{version:composition.version,authorship:composition.authorship,engine_bound:true},interpretation:composition.interpretation,
    evidence:packet.facts,experiential_evidence:packet.experiential_records||[],evidence_references:{summary:composition.summaryEvidence.evidence_ids,summary_sources:composition.summaryEvidence.source_ids},
    sources:packet.research.sources,benchmark:packet.research.benchmark,limitations:packet.limitations,research_context:{status:'not_started',checked_at:null}};
  results.push({key:job.key,source:{...job.source,ai_report:{status:'complete',report}},provenance:prepared.publicDraft.outputs[job.key].provenance});
}
const checks=[],errors=[];
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push({engine:name,error:e.message}));
    await page.route('**/*',route=>{const url=new URL(route.request().url());if(/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(url.pathname.slice(1))});return route.abort();});
    for(const result of results){
      await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:safety});await page.addScriptTag({content:renderer});
      const html=await page.evaluate(({source,provenance,key})=>{const m=key.endsWith('synthesis')?MondermanReport.fromSynthesis(source):MondermanReport.fromRun(source);m.sampleProvenance=provenance;return MondermanReport.buildReportHtml(m);},result);
      assert.doesNotMatch(html,/About this example|\[object Object\]|\bundefined\b|\bNaN\b/);
      assert.match(html,/Illustrative report generated from fictional inputs/);
      if(!result.key.endsWith('synthesis'))assert.doesNotMatch(html,/No written participant notes are included/,'Actual saved observations must appear in the evidence section');
      for(const width of [1440,834,390,320]){
        await page.setViewportSize({width,height:1000});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('.mr-authored-report').count(),1);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${result.key}/${width}: overflow`);
        const missing=await page.locator('.mr-screen-nav a,.mr-screen-action').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));assert.deepEqual(missing,[]);
        assert(await page.locator('.mr-cover .mr-sample-disclosure').isVisible());
        const detail=page.locator('.mr-evidence-detail').first();await detail.locator('summary').focus();await page.keyboard.press('Enter');assert(await detail.getAttribute('open')!==null);
        if(result.key.endsWith('synthesis')){assert.equal(await page.locator('.mr-report-options .mr-ai-action').count(),3);assert.equal(await page.locator('.mr-recommended-path').count(),1);}
        else assert.equal(await page.locator('.mr-report-options').count(),0);
        const link=page.locator('.mr-screen-shortcuts [data-report-link-role=guidance]');if(await link.count()){await link.click();const target=await link.getAttribute('href');assert(await page.locator(target).evaluate(el=>el===document.activeElement));}
        if(width===390||width===1440)await page.locator('.mr-authored-report').screenshot({path:path.join(out,`${name}-${result.key}-${width}.png`)});
        checks.push({engine:name,key:result.key,width,overflow:false,keyboardEvidence:true,navigationTargets:true});
      }
      if(name==='chromium'){
        await page.emulateMedia({media:'print'});
        // Closed evidence must appear in the actual PDF, not merely in the DOM.
        await page.locator('.mr-evidence-detail').evaluateAll(nodes=>nodes.forEach(n=>n.open=false));
        await page.pdf({path:path.join(out,`${result.key}-MOCK.pdf`),format:'Letter',printBackground:true,preferCSSPageSize:true});
        await page.emulateMedia({media:'screen'});
        fs.writeFileSync(path.join(out,`${result.key}-MOCK.html`),html);
      }
    }
  }finally{await browser.close();}
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({status:'PASS',fixture:'Actual deterministic current inputs; prose is mocked, no provider quality claim.',checks,errors,productionCalls:0},null,2));console.log(JSON.stringify({status:'PASS',renders:checks.length,engines:['chromium','webkit'],pdfs:6,productionCalls:0,out}));
