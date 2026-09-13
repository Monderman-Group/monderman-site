// Actual deterministic calculator + renderer with fabricated operational data.
// No AI approval, customer record, external request, persistence or publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..'),rendererPath=path.join(root,'monderman-report.js');
const calculatorPath=path.resolve(process.env.FINANCIAL_SCENARIO_MODULE||'');
assert.ok(process.env.FINANCIAL_SCENARIO_MODULE,'Provide the actual local pure calculator explicitly');
const renderer=fs.readFileSync(rendererPath,'utf8'),calculatorSource=fs.readFileSync(calculatorPath,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex'),clone=value=>structuredClone(value);
const {calculateFinancialPlanningScenario}=await import(pathToFileURL(calculatorPath));
const out=fs.mkdtempSync('/tmp/report-financial-scenario-'),print=process.argv.includes('--print');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(renderer,sandbox);const report=sandbox.window.MondermanReport;
const scope={id:'qa-operational-scope',organizationId:'qa-organization',label:'QA fabricated operations, no customer data',population:{size:30},
  window:{start:'2026-08-01T00:00:00Z',end:'2026-08-31T00:00:00Z'},lenses:{decision_velocity:{}}};
const range=(low,central,high)=>({low,central,high});
const input={title:'QA operational scenario - fabricated records, no AI approval',measurementStart:'2026-08-01T00:00:00Z',measurementEnd:'2026-08-29T00:00:00Z',
  measuredPeople:30,horizonMonths:12,activities:[
    {id:'qa_activity_1',label:'QA duplicate-entry activity',measuredHours:280,sourceBasis:'time_study',sourceReference:'QA time study A - fabricated reference',loadedHourlyCost:50,
      reductionPercent:range(10,20,30),adoptionPercent:range(50,75,100),changeBasis:'QA bounded-change sensitivity assumptions; no measured effectiveness.',avoidableNonLaborCash:range(0,0,0),cashBasis:'No non-labor cash saving assumed.'},
    {id:'qa_activity_2',label:'QA distinct review activity',measuredHours:140,sourceBasis:'operational_records',sourceReference:'QA record set B - fabricated reference',loadedHourlyCost:70,
      reductionPercent:range(5,10,15),adoptionPercent:range(40,60,80),changeBasis:'QA independent activity; no overlap with duplicate entry.',avoidableNonLaborCash:range(0,0,0),cashBasis:'No non-labor cash saving assumed.'}],
  implementationCashCost:range(1000,2000,3000),implementationCapacityCost:range(500,1000,1500),subscriptionCost:36000,
  costBasis:'QA full annual subscription; additional cash and absorbed staff time shown separately.',scopeConfirmed:true,overlapReviewed:true};
const context=ready=>({scope,readiness:{scopeId:scope.id,scope:{organizationId:scope.organizationId},scopeDigest:'c'.repeat(64),evidenceDigest:'a'.repeat(64),depth:{status:ready?'satisfied':'in_progress',reasons:ready?[]:[{text:'QA participation still incomplete.'}]}},snapshot:'b'.repeat(64),actorId:'qa-actor',createdAt:'2026-09-13T12:00:00Z'});
const make=ready=>({synthesis_product:'depth_synthesis',source_mode:'campaign',report_kind:ready?'depth_synthesis':'response_comparison',
  aggregate_score:61,score_status:'published',score_label:'Median Diagnostic Score',condition_band:'QA recorded band',submitted_run_count:10,source_result_count:10,participant_count:10,lens_count:1,
  generated_at:'2026-09-13T12:00:00Z',campaign_evidence:{scopeId:scope.id},campaign_scope_label:scope.label,
  executive_briefing:{lede:'QA display only: fabricated operational inputs, actual calculator, no AI provider or approval.'},
  priority_actions:[{label:'QA inspect the operational record',text:'QA compare the stated hours with the cited measurement record before using the scenario.',tier:'operational'}],
  source_groups:[{tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:10,median_score:61,mean_score:61,score_range:[52,70],score_iqr:[58,64],config_versions:['QA-NO-INSTRUMENT-RUN']}],
  pathway_exposure:{annual_hours:987654,annual_cost:123456789,recoverable_cost:111111},
  financial_scenario:calculateFinancialPlanningScenario(input,context(ready))});
let checks=0,blocked=0;const screenshots=[],pdfs=[],states=[],errors=[];
const check=(value,label)=>{assert.ok(value,label);checks++;},eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const build=raw=>{const before=JSON.stringify(raw),model=report.fromSynthesis(raw),html=report.buildReportHtml(model);eq(JSON.stringify(raw),before,'Rendering preserves source records');return {model,html};};
const fractionalInput=clone(input);Object.assign(fractionalInput.activities[0],{measuredHours:0.25,loadedHourlyCost:0.25,reductionPercent:range(0.01,0.1,0.25),adoptionPercent:range(0.01,0.1,0.25)});
fractionalInput.implementationCapacityCost=range(0.01,0.25,0.5);
const fractionalRaw=make(true);fractionalRaw.financial_scenario=calculateFinancialPlanningScenario(fractionalInput,context(true));
const cases=[{key:'early',raw:make(false)},{key:'eligible',raw:make(true)},{key:'fractional',raw:fractionalRaw}].map(item=>({...item,...build(item.raw)}));
for(const {key,raw,html}of cases){
  check(!raw.ai_report,'No fabricated AI completion metadata');eq(raw.financial_scenario.totals.netCashEffect,range(-39000,-38000,-37000),'Cash excludes absorbed labor and has no invented saving');
  check(html.includes('mr-financial-scenario'),'Same-scope scenario renders');check(!html.includes('$123,456,789')&&!html.includes('$111,111'),'Legacy score-derived money is not displayed');
  for(const phrase of [input.title,scope.label,input.costBasis,...input.activities.flatMap(a=>[a.label,a.sourceReference,a.changeBasis,a.cashBasis]),raw.financial_scenario.notice])check(html.includes(phrase),'Source input/disclosure retained: '+key);
}
const negatives=[['wrong scope',r=>r.financial_scenario.scope.scopeId='other'],['bad identity',r=>r.financial_scenario.digest='invalid'],['unknown version',r=>r.financial_scenario.version='unknown'],
  ['self-run',r=>{r.source_mode='own_saved_runs';r.report_kind='self_run_synthesis';}],['missing result range',r=>delete r.financial_scenario.totals.netCashEffect],
  ['unordered cost',r=>r.financial_scenario.inputs.implementationCashCost=range(3,2,1)],['too many activities',r=>r.financial_scenario.inputs.activities=Array(13).fill(r.financial_scenario.inputs.activities[0])]];
for(const [label,change]of negatives){const raw=clone(cases[1].raw);change(raw);check(!build(raw).html.includes('<section class="mr-section mr-financial-scenario">'),'Reject unsupported display attachment: '+label);}
for(const tool_type of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const raw={tool_type,score:51,band:'QA recorded band',business_unit:scope.label,answers:{reported_hours:8},key_findings:['QA recorded answer: 8 hours during the last week.'],
    dimensions:{[{structural_clarity:'role_clarity',decision_velocity:'execution_stability',operational_systems:'process_density',institutional_performance:'execution_coherence'}[tool_type]]:51},
    exposure:{annual_hours:987654,annual_cost:123456789,recoverable_hours:333,recoverable_cost:111111}};
  const before=JSON.stringify(raw),model=report.fromRun(raw),html=report.buildReportHtml(model);
  eq(JSON.stringify(raw),before,'Raw single-run time/score/exposure unchanged');eq(model.source.answers.reported_hours,8,'Recorded time remains in export source');
  check(html.includes('8 hours during the last week'),'Reported time can remain evidence, not recovery');
  check(!html.includes('mr-run-exposure"><')&&!html.includes('$123,456,789')&&!html.includes('$111,111'),'No single-run financial estimate cards');
}
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440])for(const item of cases){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{const url=new URL(route.request().url()),font=url.pathname.match(/^\/(55|65|75)font\.woff2$/);
      if(url.hostname==='www.monderman.com'&&font)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,font[0].slice(1)))});
      blocked++;await route.abort();});
    await page.setContent(item.html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const section=page.locator('.mr-financial-scenario');eq(await section.count(),1,'One separate scenario section');
    eq(await section.locator('.mr-scenario-metric').count(),7,'All seven capacity/cash/cost metrics');eq(await section.locator('.mr-scenario-assumption').count(),3,'Two distinct activities plus complete implementation costs');
    const cash=section.locator('.mr-scenario-metric').filter({has:page.getByRole('heading',{name:'Net cash effect',exact:true})});
    eq(await cash.locator('dd').allTextContents(),Object.values(item.raw.financial_scenario.totals.netCashEffect).map(money),'Every low/central/high cash result displayed exactly');
    eq(await cash.locator('dt').allTextContents(),['Low scenario','Central scenario','High scenario'],'Scenario levels explicit');
    for(const [index,key]of ['potentialHoursFreed','capacityValue','avoidableNonLaborCash','cashInvestment','totalImplementationAndSubscriptionCost','netCashEffect','netCapacityAndCashValue'].entries()){
      const shown=await section.locator('.mr-scenario-metric').nth(index).locator('dd').allTextContents();eq(shown.map(v=>Number(v.replace(/[$,]/g,''))),Object.values(item.raw.financial_scenario.totals[key]),'Display retains actual calculated precision: '+key);
    }
    if(item.key==='fractional'){
      const activity=section.locator('.mr-scenario-assumption').first();eq(await activity.locator('.mr-scenario-facts>div').first().locator('dd').textContent(),'0.25','Fractional measured hours not rounded away');
      eq(await activity.locator('.mr-scenario-facts>div').nth(3).locator('dd').textContent(),'$0.25','Fractional hourly cost not rounded away');
      eq(await activity.locator('.mr-scenario-values').first().locator('dd').allTextContents(),['0.01%','0.1%','0.25%'],'Small declared percentages not rounded to zero');
    }
    check((await section.innerText()).includes(item.raw.financial_scenario.participation.statement),'Readiness limitation remains visible');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal viewport overflow');
    check(await section.locator('h2,h3,h4,p,dt,dd').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})),'All financial copy stays inside viewport');
    check(await section.locator('.mr-scenario-values>div').evaluateAll(nodes=>nodes.every(el=>{const a=el.querySelector('dt').getBoundingClientRect(),b=el.querySelector('dd').getBoundingClientRect();return a.right<=b.left+1||a.bottom<=b.top+1;})),'Metric labels and values never overlap');
    const actionLink=page.locator('.mr-screen-shortcuts a[data-report-link-role="guidance"]');eq(await actionLink.count(),1,'Existing report action navigation remains available');
    const actionTarget=await actionLink.getAttribute('href');await actionLink.click();eq(await page.evaluate(id=>document.activeElement.id===id,actionTarget.slice(1)),true,'Action link still focuses its report section');
    check(await page.getByText('QA compare the stated hours with the cited measurement record before using the scenario.',{exact:true}).isVisible(),'Original bounded action remains visible');
    const gao=page.locator('.mr-meta-method a[href="https://www.gao.gov/products/gao-20-195g"]');
    eq(await gao.evaluate(el=>getComputedStyle(el).color),'rgb(12, 110, 120)','Method source link is teal');await gao.hover();
    eq(await gao.evaluate(el=>getComputedStyle(el).color),'rgb(8, 56, 62)','Method source hover stays dark teal');
    await page.mouse.move(0,0);await page.keyboard.press('Tab');await gao.focus();await page.keyboard.press('ArrowRight');
    check(await gao.evaluate(el=>el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=2),'Method link has visible keyboard focus');await gao.blur();
    if(item.key==='fractional'){
      const shot=`${name}-${width}-net-cash.png`;await cash.screenshot({path:path.join(out,shot)});screenshots.push(shot);
      const assumptions=`${name}-${width}-activity.png`;await section.locator('.mr-scenario-assumption').first().screenshot({path:path.join(out,assumptions)});screenshots.push(assumptions);
    }
    await page.emulateMedia({media:'print'});eq(await cash.evaluate(el=>getComputedStyle(el).breakInside),'avoid','Print keeps each metric together');
    eq(await gao.evaluate(el=>getComputedStyle(el).color),'rgb(12, 110, 120)','Print method source link remains teal');
    if(print&&name==='chromium'&&width===1440&&item.key==='fractional'){
      const dir=path.join(out,'tmp','pdfs');fs.mkdirSync(dir,{recursive:true,mode:0o700});const target=path.join(dir,'financial-scenario-qa.pdf');
      await page.pdf({path:target,printBackground:true,preferCSSPageSize:true});
      check(fs.readFileSync(target).subarray(0,5).toString()==='%PDF-','Print creates actual PDF');
      const text=execFileSync(process.env.PDFTOTEXT||'pdftotext',[target,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
      for(const phrase of [input.title,'Operational planning scenario','Not measured savings or a forecast.','Net cash effect',...Object.values(item.raw.financial_scenario.totals.netCashEffect).map(money),...input.activities.flatMap(a=>[a.label,a.sourceReference]),input.costBasis])check(text.includes(phrase),'PDF retains exact fact/disclosure: '+phrase);
      check(!text.includes('$123,456,789')&&!text.includes('$111,111'),'PDF omits old modeled recovery amounts');
      for(const value of ['$0.25','0.01%','0.25%'])check(text.includes(value),'PDF preserves fractional declared input: '+value);
      execFileSync(process.env.PDFTOPPM||'pdftoppm',['-r','70','-png',target,path.join(dir,'page')]);
      pdfs.push({file:target,sha256:sha(fs.readFileSync(target)),pages:fs.readdirSync(dir).filter(f=>/^page-\d+\.png$/.test(f))});
    }
    states.push({browser:name,width,kind:item.raw.financial_scenario.kind});await page.close();
  }}finally{await browser.close();}
}
eq(errors,[],'No browser runtime errors');eq(fs.readFileSync(rendererPath,'utf8'),renderer,'Renderer unchanged during checks');eq(fs.readFileSync(calculatorPath,'utf8'),calculatorSource,'Calculator unchanged during checks');
const receipt={status:'PASS',checks,states,screenshots,pdfs,blockedRequests:blocked,rendererSha256:sha(renderer),calculatorSha256:sha(calculatorSource),
  productionCalls:0,providerCalls:0,databaseWrites:0,proofScope:'Fabricated operational inputs through actual pure calculator and current renderer. No AI approval, persistence, source audit or publication claim.'};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:'PASS',checks,states:states.length,output:out,pdfs:pdfs.length}));
