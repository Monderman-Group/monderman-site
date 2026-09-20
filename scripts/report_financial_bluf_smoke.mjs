// Read-only source fixtures through the candidate renderer. No publication
// approval, source alteration, provider call, account or billing mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import {sourceBeforeFinancialPresentation,restoreFinancialPresentationStyles,PRIOR_FINANCIAL_RENDERER_SHA256} from './report_financial_presentation_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..');
const sourcePath=path.join(root,'sample-data/production-diagnostic-samples.json');
const rendererPath=path.join(root,'monderman-report.js');
const source=fs.readFileSync(sourcePath,'utf8'),renderer=fs.readFileSync(rendererPath,'utf8');
// This is the historical v1 compatibility gate. Current three-benefit sources
// have their own substantive gate in report_three_benefit_smoke.mjs.
const historicalFixtureCommit='b06b72083442f03f7a1e2cadeb5239e4f0449515';
const historicalSource=execFileSync('git',['show',historicalFixtureCommit+':sample-data/production-diagnostic-samples.json'],{cwd:root,encoding:'utf8',maxBuffer:32e6});
const artifact=JSON.parse(historicalSource),clone=value=>structuredClone(value),sha=value=>createHash('sha256').update(value).digest('hex');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(renderer,sandbox);const report=sandbox.window.MondermanReport;
const out=process.env.REPORT_FINANCIAL_BLUF_OUT?path.resolve(process.env.REPORT_FINANCIAL_BLUF_OUT):fs.mkdtempSync('/tmp/report-financial-bluf-'),print=process.argv.includes('--print');
fs.mkdirSync(out,{recursive:true,mode:0o700});
let checks=0,blockedRequests=0;const screenshots=[],pdfs=[],states=[],errors=[];
const ok=(value,label)=>{assert.ok(value,label);checks++;},eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const build=raw=>{const before=JSON.stringify(raw),model=report.fromSynthesis(raw),html=report.buildReportHtml(model);eq(JSON.stringify(raw),before,'Rendering leaves saved source unchanged');return {model,html};};
const briefPattern=/<section\b[^>]*class="mr-section mr-financial-brief"[\s\S]*?<\/section>/;
const fullPattern=/<section\b[^>]*class="mr-section mr-financial-scenario"[\s\S]*?<\/section>/;
const cases=['depth_synthesis','cross_lens_synthesis'].map(key=>{const raw=clone(artifact.outputs[key].source);return {key,raw,...build(raw)};});
const number=value=>Number(value).toLocaleString('en-US',Math.abs(value)>0&&Math.abs(value)<1?{maximumSignificantDigits:3}:{maximumFractionDigits:0});
const money=value=>(value<0?'-$':'$')+number(Math.abs(value));
const costLevel={low:'high',central:'central',high:'low'};
const metricKeys=['potentialHoursFreed','capacityValue','avoidableNonLaborCash','cashInvestment','totalImplementationAndSubscriptionCost','netCashEffect','netCapacityAndCashValue'];
eq(report.rendererVersion,'diagnostic-renderer-evidence-reading-20260914.43','Measured-report adapter edition retained');
eq(report.financialPresentationVersion,'financial-presentation-20260915.1','New financial display has explicit component edition');
const priorSource=sourceBeforeFinancialPresentation(renderer);
eq(sha(priorSource),PRIOR_FINANCIAL_RENDERER_SHA256,'Exact inverse preserves entire previous renderer source');
eq(sourceBeforeFinancialPresentation(priorSource),priorSource,'Prior source is idempotent');
for(const mutate of [s=>s+'\nUNREVIEWED',s=>s.replace('scopeConfirmed!==true','scopeConfirmed===true'),s=>s.replace('costLevel[level]:level','level:level'),s=>s.replace('financial-presentation-20260915.1','financial-presentation-20260915.2')]){
  const changed=mutate(renderer);ok(changed!==renderer,'Mutation really changes source');assert.throws(()=>sourceBeforeFinancialPresentation(changed));checks++;
}
const priorSandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(priorSource,priorSandbox);const priorReport=priorSandbox.window.MondermanReport;
for(const item of cases){
  const {html,model}=item;ok(briefPattern.test(html),'Current '+item.key+' has decision brief');
  ok(html.indexOf('class="mr-section mr-financial-brief"')<html.indexOf('class="mr-section mr-ai-interpretation'),'Financial summary precedes long AI text');
  ok(model.coverBody.includes('These estimates are withheld.'),'Source cover text unchanged');
  const cover=html.match(/<section\b[^>]*class="mr-cover"[\s\S]*?<\/section>/)[0];
  ok(!cover.includes('These estimates are withheld.'),'Valid scenario cover no longer wrongly suggests no financial output');
  ok(cover.includes('separate operational planning scenario'),'Cover keeps the score/scenario distinction');
  ok(fullPattern.test(html),'Full detailed scenario retained');
  ok(html.match(briefPattern)[0].includes('No direct cash saving assumed.'),'Explicit all-zero cash explanation');
  for(const phrase of ['Low pairs lower benefits with higher costs','These are assumption-based cases, not probabilities or a forecast','Exact values, activity records and assumptions remain'])ok(html.includes(phrase),'Interpretation boundary: '+phrase);
}
const negatives=[
  ['missing scenario',r=>delete r.financial_scenario],['null scenario',r=>r.financial_scenario=null],
  ['wrong scope',r=>r.financial_scenario.scope.scopeId='other'],['bad identity',r=>r.financial_scenario.source_identity_digest='invalid'],
  ['unknown version',r=>r.financial_scenario.version='unknown'],['self-run',r=>{r.source_mode='own_saved_runs';r.report_kind='self_run_synthesis';}],
  ['missing cash total',r=>delete r.financial_scenario.totals.avoidableNonLaborCash],['missing cash number',r=>delete r.financial_scenario.totals.avoidableNonLaborCash.central],
  ['null not zero',r=>r.financial_scenario.totals.avoidableNonLaborCash.central=null],['boolean not zero',r=>r.financial_scenario.totals.avoidableNonLaborCash.central=false],
  ['string not zero',r=>r.financial_scenario.totals.avoidableNonLaborCash.central='0'],['NaN',r=>r.financial_scenario.totals.capacityValue.central=NaN],
  ['infinity',r=>r.financial_scenario.totals.potentialHoursFreed.high=Infinity],['unordered costs',r=>r.financial_scenario.inputs.implementationCashCost={low:3,central:2,high:1}],
  ['missing population',r=>delete r.financial_scenario.inputs.measuredPeople],['missing horizon',r=>delete r.financial_scenario.inputs.horizonMonths],
  ['scope not confirmed',r=>r.financial_scenario.inputs.scopeConfirmed=false],['overlap not reviewed',r=>r.financial_scenario.inputs.overlapReviewed=false],
  ['score-derived',r=>r.financial_scenario.method.usesDiagnosticScores=true],['confidence interval',r=>r.financial_scenario.method.isConfidenceInterval=true],
  ['missing costs',r=>delete r.financial_scenario.inputs.implementationCapacityCost],['missing activities',r=>r.financial_scenario.inputs.activities=[]]
];
for(const [label,change]of negatives){const raw=clone(cases[0].raw);change(raw);const {html}=build(raw);ok(!briefPattern.test(html),'Brief rejects '+label);ok(!fullPattern.test(html),'Detailed scenario shares rejection: '+label);if(label!=='self-run')ok(html.includes('These estimates are withheld.'),'Invalid attachment preserves withholding: '+label);}
for(const key of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const raw=clone(artifact.outputs[key].source),payload=raw.result?.tool_type?raw.result:raw;
  payload.financial_scenario=clone(cases[0].raw.financial_scenario);
  const html=report.buildReportHtml(report.fromRun(raw));ok(!briefPattern.test(html),'Single '+key+' never acquires organizational financial brief');
  eq(report.buildReportBody(report.fromRun(raw)),priorReport.buildReportBody(priorReport.fromRun(raw)),'Actual '+key+' single-run body is byte-identical');
  eq(restoreFinancialPresentationStyles(html),priorReport.buildReportHtml(priorReport.fromRun(raw)),'Actual '+key+' full HTML differs only by exact new financial CSS');
  ok(!html.includes('meta name="monderman-financial-presentation-version"'),'Single-run HTML has no financial summary edition');
}
const zero=clone(cases[0].raw);for(const key of metricKeys)zero.financial_scenario.totals[key]={low:0,central:0,high:0};
const zeroBuilt=build(zero);ok(briefPattern.test(zeroBuilt.html),'Explicit zero result remains available');ok(zeroBuilt.html.includes('equals total cost.'),'Zero net not missing');
const loss=clone(cases[0].raw);loss.financial_scenario.totals.netCapacityAndCashValue={low:-20,central:-10,high:0};
const lossBuilt=build(loss);ok(lossBuilt.html.includes('falls short of total cost by $10.'),'Negative central economic result remains visible');
const decimals=clone(cases[0].raw);decimals.financial_scenario.totals.avoidableNonLaborCash={low:0.001,central:0.25,high:0.75};
const decimalsBuilt=build(decimals);ok(decimalsBuilt.html.match(briefPattern)[0].includes('$0.001'),'Small positive cash not rounded to zero');
ok(!decimalsBuilt.html.match(briefPattern)[0].includes('No direct cash saving assumed.'),'Nonzero cash not described as absent');
const early=clone(cases[0].raw);early.report_kind='response_comparison';early.financial_scenario.kind='early_planning_scenario';
ok(build(early).html.includes('This scenario does not unlock Synthesis.'),'Early participation boundary is explicit');

for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440])for(const item of cases){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{const url=new URL(route.request().url()),font=url.pathname.match(/^\/(55|65|75)font\.woff2$/);
      if(url.hostname==='www.monderman.com'&&font)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,font[0].slice(1)))});
      blockedRequests++;await route.abort();});
    await page.setContent(item.html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const section=page.locator('.mr-financial-brief'),totals=item.raw.financial_scenario.totals;
    eq(await section.count(),1,'One financial decision brief');
    eq(await section.getAttribute('data-financial-presentation'),report.financialPresentationVersion,'BLUF declares its component edition');
    eq(await page.locator('meta[name="monderman-financial-presentation-version"]').getAttribute('content'),report.financialPresentationVersion,'Portable HTML records current financial display edition');
    eq(await page.locator('.mr-section').first().getAttribute('class'),'mr-section mr-financial-brief','First substantive section is financial BLUF');
    eq(await section.locator('[data-financial-central="hours"]').textContent(),number(totals.potentialHoursFreed.central)+' hours','Central hours match source');
    eq(await section.locator('[data-financial-central="capacity"]').textContent(),money(totals.capacityValue.central),'Central value matches source');
    for(const key of metricKeys)for(const level of ['low','central','high']){
      const cost=['cashInvestment','totalImplementationAndSubscriptionCost'].includes(key),value=totals[key][cost?costLevel[level]:level];
      eq(await section.locator(`[data-financial-metric="${key}"][data-financial-case="${level}"]`).textContent(),key==='potentialHoursFreed'?number(value):money(value),'Outcome-aligned saved value: '+key+' '+level);
    }
    ok((await section.innerText()).includes(money(totals.netCapacityAndCashValue.low)),'Downside remains in brief');
    ok((await section.innerText()).includes('No direct cash saving assumed.'),'Zero explained in browser');
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No viewport overflow');
    ok(await section.locator('h2,p,strong,th,td').evaluateAll(nodes=>nodes.every(el=>{
      // Closed native details can retain table geometry without painting it.
      if(el.closest('details:not([open])')&&!el.closest('summary'))return true;
      const r=el.getBoundingClientRect();if(!r.width)return true;
      // Wide numeric comparisons are contained by their intentional scrollport.
      const scroll=el.closest('.mr-planning-table-scroll');
      if(scroll){const s=scroll.getBoundingClientRect();return getComputedStyle(scroll).overflowX==='auto'&&s.left>=-1&&s.right<=innerWidth+1&&r.left>=s.left-scroll.scrollLeft-1;}
      return r.left>=-1&&r.right<=innerWidth+1;
    })),'All painted BLUF content stays in the viewport or its bounded table scrollport');
    const nav=page.locator('.mr-screen-shortcuts a[data-report-link-role="financial-summary"]');eq(await nav.count(),1,'Decision brief is directly navigable');
    const target=await nav.getAttribute('href');await nav.click();ok(await page.evaluate(id=>document.activeElement.id===id,target.slice(1)),'Keyboard target focuses summary');
    await page.evaluate(()=>document.activeElement?.blur());
    const shot=`${name}-${width}-${item.key}.png`;await section.screenshot({path:path.join(out,shot)});screenshots.push(shot);
    await page.emulateMedia({media:'print'});eq(await section.evaluate(el=>getComputedStyle(el).breakBefore),'page','PDF summary starts a content page');
    if(print&&name==='chromium'&&width===1440){
      const target=path.join(out,item.key+'-candidate.pdf');await page.pdf({path:target,printBackground:true,preferCSSPageSize:true});
      const python=process.env.PDF_PYTHON||'python3';
      const pages=JSON.parse(execFileSync(python,['-c','import json,sys; from pypdf import PdfReader; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',target],{encoding:'utf8'}));
      const summaryPages=pages.map((text,index)=>({text:text.replace(/\s+/g,' '),page:index+1})).filter(p=>p.text.includes('Decision brief'));
      eq(summaryPages.length,1,'Exactly one PDF decision-brief page');eq(summaryPages[0].page,2,'Financial BLUF is page two, directly after cover');
      for(const phrase of ['Three planning cases','No direct cash saving assumed.',money(totals.capacityValue.central),money(totals.netCapacityAndCashValue.low),'Exact values, activity records and assumptions'])ok(summaryPages[0].text.includes(phrase),'Full BLUF fits one page: '+phrase);
      // The approved shared renderer now places all three planning cases after
      // the unchanged page-two brief. Printing must not omit the unselected
      // native-radio cases or move long AI prose ahead of the financial read.
      for(const [index,level]of ['low','central','high'].entries()){
        const title=level[0].toUpperCase()+level.slice(1)+' planning case';
        const casePages=pages.map((text,page)=>({text:text.replace(/\s+/g,' '),page:page+1})).filter(row=>row.text.includes(title));
        eq(casePages.length,1,'Exactly one printed '+level+' planning case');
        eq(casePages[0].page,index+3,'Planning cases immediately follow the brief in Low/Central/High order');
        for(const key of metricKeys){
          const cost=['cashInvestment','totalImplementationAndSubscriptionCost'].includes(key);
          const value=totals[key][cost?costLevel[level]:level];
          ok(casePages[0].text.includes(key==='potentialHoursFreed'?number(value):money(value)),'Printed case retains exact table display: '+level+' '+key);
        }
      }
      const breakdownPages=pages.map((text,index)=>({text:text.replace(/\s+/g,' '),page:index+1})).filter(row=>row.text.includes('Activity and cost breakdown'));
      eq(breakdownPages.length,1,'Exactly one complete printed activity and cost breakdown');
      eq(breakdownPages[0].page,6,'Activity and cost breakdown immediately follows the three planning cases');
      for(const label of ['Implementation cash','Internal staff-time implementation cost','Subscription allocation',...item.raw.financial_scenario.activities.map(activity=>activity.label)])ok(breakdownPages[0].text.includes(label),'Printed breakdown retains each activity and cost component: '+label);
      ok(!breakdownPages[0].text.includes('Interpretation and next steps'),'Interpretation does not crowd the activity and cost breakdown');
      ok(pages[6].includes('Interpretation and next steps'),'AI interpretation follows the complete financial brief, three planning cases and activity/cost breakdown');
      const fullText=pages.join('\n');for(const value of [totals.capacityValue.low,totals.capacityValue.central,totals.capacityValue.high])ok(fullText.includes(value.toLocaleString('en-US')),'Exact detailed dollar values retained in PDF');
      execFileSync(process.env.PDFTOPPM||'pdftoppm',['-f','2','-l','2','-scale-to','1400','-png','-singlefile',target,path.join(out,item.key+'-page-2')]);
      pdfs.push({file:target,sha256:sha(fs.readFileSync(target)),pages:pages.length,summaryPage:2});
    }
    states.push({browser:name,width,product:item.key});await page.close();
  }}finally{await browser.close();}
}
eq(errors,[],'No browser exceptions');eq(fs.readFileSync(sourcePath,'utf8'),source,'Public source fixture unchanged');eq(fs.readFileSync(rendererPath,'utf8'),renderer,'Candidate renderer unchanged during test');
const receipt={status:'PASS',checks,states,screenshots,pdfs,blockedRequests,rendererSha256:sha(renderer),sampleSourceSha256:sha(historicalSource),historicalFixtureCommit,unchangedCurrentSampleSha256:sha(source),harnessSha256:sha(fs.readFileSync(import.meta.filename)),providerCalls:0,productionCalls:0,sourceChanges:0,publicationApproval:false};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks,states:states.length,output:out,pdfs:pdfs.length}));
