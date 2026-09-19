// Saved operational inputs through the same renderer used by real and sample
// reports. No provider call, customer record or publication mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceBeforeSankeyPresentation,restoreSankeyPresentationStyles,PRIOR_SANKEY_RENDERER_SHA256} from './report_sankey_presentation_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const fixtureSource=fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'),'utf8');
const artifact=JSON.parse(fixtureSource),clone=structuredClone;
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),context);
vm.runInNewContext(source,context);
vm.runInNewContext(fs.readFileSync(path.join(root,'public-sample-model.js'),'utf8'),context);
const report=context.window.MondermanReport;
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;},eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const priorSource=sourceBeforeSankeyPresentation(source),priorContext={...context,window:{}};
eq(createHash('sha256').update(priorSource).digest('hex'),PRIOR_SANKEY_RENDERER_SHA256,'Exact historical source recovered');
vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),priorContext);
vm.runInNewContext(priorSource,priorContext);
vm.runInNewContext(fs.readFileSync(path.join(root,'public-sample-model.js'),'utf8'),priorContext);
for(const mutate of [s=>s+'\nUNREVIEWED',s=>s.replace('scopeConfirmed!==true','scopeConfirmed===true'),s=>s.replace('amount/flowTotal*ribbonHeight','amount/total*ribbonHeight')]){assert.throws(()=>sourceBeforeSankeyPresentation(mutate(source)));checks++;}
const caption='Directional estimates based on reported operating data and the assumptions shown. Figures indicate potential time and capacity gains, not measured savings.';
const figure=html=>html.match(/<figure class="mr-operational-sankey"[\s\S]*?<\/figure>/)?.[0]||'';
const build=(raw,sample=false)=>{const before=JSON.stringify(raw);const model=report.fromSynthesis(raw);if(sample)model.sampleProvenance={synthetic:true};const html=report.buildReportHtml(model);eq(JSON.stringify(raw),before,'Source records unchanged');return {model,html};};
const cases=['depth_synthesis','cross_lens_synthesis'].flatMap(key=>[false,true].map(sample=>{
  if(!sample)return {key,sample,...build(clone(artifact.outputs[key].source))};
  const model=context.window.MondermanPublicSamples.model(artifact.outputs[key],artifact);
  return {key,sample,model,html:report.buildReportHtml(model)};
}));
for(const item of cases){
  const chart=figure(item.html);ok(chart,'Sankey present: '+item.key+' '+item.sample);ok(chart.includes(caption),'Approved directional caption');
  eq(chart.includes('Illustrative example.'),item.sample,'Illustrative disclosure only for sample');
  ok(chart.includes('3,495.96'),'Source central hours');ok(chart.includes('$364,989.11'),'Capacity value remains separate');
  ok(chart.includes('626.14')&&chart.includes('5,341.78'),'Low/high hours remain visible');
  ok(chart.includes('scope="row"')&&chart.includes('scope="col"'),'Accessible tabular equivalent');
  const bands=[...chart.matchAll(/data-sankey-hours="([^"]+)"/g)].map(m=>Number(m[1]));eq(bands,[2191.5,1304.46],'Distinct activity bands use saved hours');
  ok(!chart.includes('Productive effort')&&!chart.includes('Structural overhead')&&!chart.includes('Recoverable burden'),'No old score-derived semantics');
  const prior=priorContext.window.MondermanReport;
  const priorModel=item.sample?priorContext.window.MondermanPublicSamples.model(artifact.outputs[item.key],artifact):prior.fromSynthesis(artifact.outputs[item.key].source);
  eq(restoreSankeyPresentationStyles(item.html).replace(chart,''),prior.buildReportHtml(priorModel),'Entire report outside new chart and exact CSS is unchanged');
}
const negative=[['no financial data',r=>delete r.financial_scenario],['wrong scope',r=>r.financial_scenario.scope.scopeId='other'],['self run',r=>{r.source_mode='own_saved_runs';r.report_kind='self_run_synthesis';}],
  ['scores used',r=>r.financial_scenario.method.usesDiagnosticScores=true],['overlap not reviewed',r=>r.financial_scenario.inputs.overlapReviewed=false],['duplicate activity',r=>r.financial_scenario.activities[1]=clone(r.financial_scenario.activities[0])],
  ['missing activity',r=>r.financial_scenario.activities.pop()],['unknown activity',r=>r.financial_scenario.activities[0].id='unknown'],['missing range',r=>delete r.financial_scenario.activities[0].potentialHoursFreed],
  ['mismatched hour sum',r=>r.financial_scenario.activities[0].potentialHoursFreed.central+=100],['mismatched capacity sum',r=>r.financial_scenario.activities[0].capacityValue.central+=100],['null activity',r=>r.financial_scenario.activities[0]=null],
  ['negative hours',r=>r.financial_scenario.activities[0].potentialHoursFreed.low=-1],['NaN hours',r=>r.financial_scenario.activities[0].potentialHoursFreed.central=NaN],['unordered range',r=>r.financial_scenario.activities[0].potentialHoursFreed.high=0]];
for(const [label,change]of negative){const raw=clone(artifact.outputs.depth_synthesis.source);change(raw);ok(!figure(build(raw).html),'Invalid chart withheld: '+label);}
const missing=clone(artifact.outputs.depth_synthesis.source);missing.financial_scenario.activities.pop();ok(build(missing).html.includes('saved activity breakdown is not complete enough'),'Incomplete data explains missing chart');
const zero=clone(artifact.outputs.depth_synthesis.source);for(const a of zero.financial_scenario.activities)for(const key of ['potentialHoursFreed','capacityValue'])a[key]={low:0,central:0,high:0};for(const key of ['potentialHoursFreed','capacityValue'])zero.financial_scenario.totals[key]={low:0,central:0,high:0};ok(build(zero).html.includes('central assumptions show no staff time released'),'Zero is not drawn as fabricated nonzero flow');
for(const key of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const model=report.fromRun(artifact.outputs[key].source);ok(!figure(report.buildReportHtml(model)),'No single-run financial Sankey: '+key);
}
// More than four activities remain explicit in the table while the graphic
// combines only its last ribbon, and extreme labels cannot become markup.
const many=clone(artifact.outputs.cross_lens_synthesis.source),s=many.financial_scenario;
s.inputs.activities=Array.from({length:12},(_,i)=>({...clone(s.inputs.activities[0]),id:'activity-'+i,label:'A long recorded activity description for operating work across departments '+i}));
s.activities=s.inputs.activities.map((a,i)=>({id:a.id,label:a.label,potentialHoursFreed:{low:10,central:20,high:30},capacityValue:{low:100,central:200,high:300}}));
for(const key of ['potentialHoursFreed','capacityValue'])s.totals[key]=Object.fromEntries(['low','central','high'].map(k=>[k,s.activities.reduce((n,a)=>n+a[key][k],0)]));
const manyCase={key:'many-activities',sample:false,...build(many)};eq((figure(manyCase.html).match(/data-sankey-hours=/g)||[]).length,4,'Four visual ribbons maximum');ok(figure(manyCase.html).includes('Other distinct activities (9)'),'Aggregate labeled');
const hostile=clone(many);hostile.financial_scenario.activities[0].label='<img src=x onerror=alert(1)>';ok(!figure(build(hostile).html).includes('<img'),'Activity labels escaped');
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({status:'PASS',checks,providerCalls:0}));process.exit(0);}
const out=process.env.REPORT_SANKEY_OUT||fs.mkdtempSync('/tmp/report-operational-sankey-');fs.mkdirSync(out,{recursive:true});
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const results=[],pdfs=[],errors=[],unexpected=[];
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [320,390,834,1440])for(const item of [...cases,manyCase]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,match[1]+'font.woff2'))});unexpected.push(route.request().url());return route.abort();});
    await page.setContent(item.html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const chart=page.locator('.mr-operational-sankey');eq(await chart.count(),1,'One chart');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No viewport overflow: '+engine+' '+width+' '+item.key);
    ok(await chart.locator('p,h3,th,td,figcaption,.mr-sankey-source,.mr-sankey-total').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})),'Sankey content contained');
    ok(await chart.locator('.mr-sankey-source').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return [...el.children].every(child=>{const c=child.getBoundingClientRect();return c.top>=r.top-1&&c.bottom<=r.bottom+1;});})),'Activity label and hours fit assigned row');
    eq(await chart.locator('figcaption').innerText(),(item.sample?'Illustrative example. ':'')+caption,'Visible exact caption');
    eq(await chart.locator('tbody tr').count(),item.key==='many-activities'?12:2,'Every distinct activity accessible');
    const shot=engine+'-'+width+'-'+item.key+(item.sample?'-sample':'-real')+'.png';await chart.screenshot({path:path.join(out,shot)});
    if(process.argv.includes('--print')&&engine==='chromium'&&width===1440&&item.sample){
      const file=path.join(out,item.key+'.pdf');await page.pdf({path:file,printBackground:true,preferCSSPageSize:true});
      const pages=JSON.parse(execFileSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',file],{encoding:'utf8'}));
      const compact=text=>text.replace(/\s+/g,'');
      const chartPages=pages.map((text,i)=>({text:compact(text),page:i+1})).filter(p=>p.text.includes(compact('Where time could be released')));
      eq(chartPages.length,1,'PDF has one Sankey');ok(chartPages[0].text.includes(compact(caption)),'PDF caption stays with chart');
      for(const expected of ['3,495.96','$364,989.11','2,191.5','1,304.46','Illustrative example.'])ok(chartPages[0].text.includes(compact(expected)),'PDF Sankey exact fact: '+expected);
      ok(pages[1].includes('Decision brief'),'BLUF retained immediately after cover');
      execFileSync(process.env.PDFTOPPM||'pdftoppm',['-f',String(chartPages[0].page),'-l',String(chartPages[0].page),'-scale-to','1400','-png','-singlefile',file,path.join(out,item.key+'-sankey-page')]);
      pdfs.push({file,pages:pages.length,sankeyPage:chartPages[0].page,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
    }
    results.push({engine,width,key:item.key,sample:item.sample,screenshot:shot});await page.close();
  }}finally{await browser.close();}
}
eq(errors,[],'No browser errors');eq(unexpected,[],'No service calls');eq(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'),'utf8'),fixtureSource,'Published inputs remain unchanged');
const receipt={status:'PASS',checks,results,pdfs,rendererSha256:createHash('sha256').update(source).digest('hex'),sourceSha256:createHash('sha256').update(fixtureSource).digest('hex'),providerCalls:0,productionCalls:0};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks,states:results.length,pdfs:pdfs.length,out}));
