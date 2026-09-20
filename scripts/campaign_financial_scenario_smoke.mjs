// Actual candidate form and onReport callback, with local-only transport mocks.
// No login, customer records, provider, database writes or saved-report claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {createCampaignUiMock} from './campaign_ui_mock_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..'),origin='http://scenario-ui.test';
const out=fs.mkdtempSync('/tmp/monderman-financial-scenario-ui-');
const source=fs.readFileSync(path.join(root,'campaign-analysis.js'),'utf8'),styles=fs.readFileSync(path.join(root,'campaign-analysis.css'),'utf8');
const workspace=fs.readFileSync(path.join(root,'workspace-analysis.html'),'utf8');
const callback=workspace.match(/onReport:async\(evidence,financialScenarioInput\)=>\{([\s\S]*?)\n        \}\}\);/)?.[1];
assert.ok(callback,'Exercise the current workspace callback, not a rewritten approximation');
const calculator=process.env.FINANCIAL_SCENARIO_MODULE?await import(pathToFileURL(path.resolve(process.env.FINANCIAL_SCENARIO_MODULE))):null;
const scope={id:'scope-mock',organizationId:'org-mock',label:'MOCK operational records',campaignIds:['campaign-mock'],population:{size:12},
  window:{start:'2026-09-01T00:00:00Z',end:'2026-09-12T00:00:00Z'},lenses:{decision_velocity:{}}};
const mock=createCampaignUiMock({scope,getRecords:()=>[]});
const keys=['schemaVersion','title','horizonMonths','capacity','spendingReduction','spendingAvoidance','implementationCashCost','implementationCapacityCost','subscriptionCost','costBasis','scopeConfirmed','overlapReviewed'];
const activityKeys=['id','label','measuredHours','sourceBasis','sourceReference','loadedHourlyCost','reductionPercent','adoptionPercent','changeBasis'];
const expenseKeys=['id','resourceId','label','kind','unit','baselineMonthlyUnits','unitCost','startMonth','endMonth','reductionPercent','adoptionPercent','sourceReference','changeBasis','capacityActivityId'];
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,blocked=0;const screenshots=[],states=[],errors=[];
const check=(value,message)=>{assert.ok(value,message);checks++;};const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [320,390,834,1440]){
    let ready=false,readRequests=0;
    const current=()=>{const item={ok:true,scope,snapshot:'b'.repeat(64),...mock.current()};
      Object.assign(item.readiness,{scopeId:scope.id,scope:{organizationId:scope.organizationId},scopeDigest:'c'.repeat(64)});
      item.readiness.depth.status=ready?'satisfied':'in_progress';return item;};
    const original=JSON.stringify(current()),page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin==='https://mock.monderman.invalid'){
        check(route.request().method()==='GET','Scenario edits never make campaign writes');readRequests++;
        const body=url.pathname.includes('/scopes/')?current():{ok:true,campaigns:[{id:'campaign-mock',tool_type:'decision_velocity',name:'MOCK campaign'}],scopes:[scope]};
        await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});return;
      }
      if(url.origin!==origin){blocked++;await route.abort();return;}
      const file=path.resolve(root,'.'+url.pathname);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'font/woff2',body:fs.readFileSync(file)});
    });
    await page.goto(origin+'/campaign-analysis.css');
    if(calculator)await page.exposeFunction('validateFinancialScenario',input=>{const ctx=current();try{calculator.calculateFinancialPlanningScenario(input,{scope,readiness:ctx.readiness,snapshot:ctx.snapshot,actorId:'actor-mock',createdAt:'2026-09-13T12:00:00Z'});return {ok:true};}catch(error){return {ok:false,message:error.message};}});
    await page.evaluate(async({origin,callback})=>{
      document.head.innerHTML=`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="${origin}/campaign-analysis.css"><style>@font-face{font-family:NHG;src:url(${origin}/55font.woff2)}body{font-family:NHG,Arial,sans-serif;margin:0;--text:#183f47;--muted:#53676e;--line:#dce5e8;--panel:#fff;--bg:#fff}main{max-width:1100px;margin:auto;padding:12px}</style>`;
      document.body.innerHTML='<main><p>MOCK operational records and transport. No actual campaign or saved report.</p><section id="mount"></section><div id="synthResult"></div></main>';
      window.sent=[];window.prepared=[];window.completed=[];window.savedLocation={href:''};window.rejectReport=false;window.savedReport=false;window.rendered=[];
      const actual=new (Object.getPrototypeOf(async()=>{}).constructor)('evidence','financialScenarioInput','supabase','ws5OrgId','API_BASE','synthesisRequestStore','fetch','location','loadSynthesisRuns','renderSynthResult','$',callback);
      const onReport=(evidence,input)=>actual(evidence,input,{auth:{getSession:async()=>({data:{session:{access_token:'MOCK-NO-AUTH',user:{id:'actor-mock'}}}})}},'org-mock','https://report.mock.invalid',
        {prepare:async(org,actor,body)=>{window.prepared.push(structuredClone(body));return {requestId:'mock-'+window.prepared.length};},complete:ticket=>window.completed.push(ticket.requestId)},
        async(url,options)=>{const body=JSON.parse(options.body);window.sent.push({url,body});if(window.validateScenarioWithCalculator&&body.financial_scenario_input){const validation=await window.validateFinancialScenario(body.financial_scenario_input);if(!validation.ok)return {ok:false,json:async()=>({message:validation.message})};}return {ok:!window.rejectReport,json:async()=>window.rejectReport?{message:'MOCK server rejected the operational source basis.'}:{result:{kind:window.savedReport?'synthesis_planning_scenario':'early_planning_scenario'},...(window.savedReport?{synthesis:{id:'saved-mock'}}:{})}};},
        window.savedLocation,async()=>{},result=>window.rendered.push(result),id=>document.getElementById(id));
      const {mountCampaignAnalysis}=await import(origin+'/campaign-analysis.js');
      window.mount=mountCampaignAnalysis({element:document.getElementById('mount'),organizationId:'org-mock',role:'admin',getToken:async()=>'MOCK-NO-AUTH',apiBase:'https://mock.monderman.invalid',onReport});
    },{origin,callback});
    await page.locator('[data-ca-financial]').waitFor();await page.evaluate(()=>document.fonts.ready);
    const form=page.locator('[data-ca-financial-form]'),build=page.locator('[data-ca-build]');
    const settled=()=>page.waitForFunction(()=>!document.getElementById('mount').hasAttribute('aria-busy'));
    const sendCount=()=>page.evaluate(()=>window.sent.length);
    const clickBuild=async()=>{await build.click();await settled();};
    const checkReportErrorVisible=async()=>{
      eq(await page.locator('[data-ca-message]').evaluate(el=>el===document.activeElement),true,'Report rejection focuses its explanation');
      check(await page.locator('[data-ca-message]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Report rejection explanation is inside the viewport');
    };
    const input=(container,name)=>container.locator(`[name="${name}"]`);
    const fillRange=async(container,key,values)=>{for(const[level,value]of Object.entries(values))await input(container,key+'.'+level).fill(String(value));};
    async function fillActivity(row,label='MOCK duplicate-entry review'){
      for(const[key,value]of Object.entries({label,measuredHours:'8',sourceReference:'MOCK time-study record set',loadedHourlyCost:'50',changeBasis:'MOCK bounded trial assumptions for this activity only.'}))await input(row,key).fill(value);
      await input(row,'sourceBasis').selectOption('time_study');
      await fillRange(row,'reductionPercent',{low:10,central:20,high:30});await fillRange(row,'adoptionPercent',{low:50,central:75,high:100});
    }
    const expense=key=>page.locator(`[data-ca-spending-items="${key}"] [data-ca-expense]`).first();
    async function fillExpense(row,label='MOCK current license expense',resourceId='MOCK license budget'){
      await input(row,'kind').selectOption('non_labor');
      for(const[key,value]of Object.entries({label,resourceId,unit:'licenses',baselineMonthlyUnits:'10',unitCost:'100',startMonth:'1',endMonth:'1',sourceReference:'MOCK expense ledger reference',changeBasis:'MOCK documented expense cancellation after the proposed change.'}))await input(row,key).fill(value);
      await fillRange(row,'reductionPercent',{low:10,central:20,high:30});await fillRange(row,'adoptionPercent',{low:100,central:100,high:100});
    }
    async function fillScenario(){
      for(const[key,status]of Object.entries({capacity:'estimated',spendingReduction:'estimated',spendingAvoidance:'none_identified'})){await input(form,key+'.status').selectOption(status);await input(form,key+'.basis').fill('MOCK explicit review of separate operating records.');}
      for(const[key,value]of Object.entries({title:'MOCK operational planning',measurementStart:'2026-09-01T00:00',measurementEnd:'2026-09-02T00:00',measuredPeople:'2',horizonMonths:'1',subscriptionCost:'5',costBasis:'MOCK one-month costs with internal staff time separate from cash.'}))await input(form,key).fill(value);
      await fillActivity(page.locator('[data-ca-activity]').first());
      await fillExpense(expense('spendingReduction'));
      await fillRange(form,'implementationCashCost',{low:10,central:20,high:30});await fillRange(form,'implementationCapacityCost',{low:40,central:50,high:60});
      await input(form,'scopeConfirmed').check();await input(form,'overlapReviewed').check();
    }
    await settled();eq(readRequests,2,'Only initial authorized-read mocks');eq(await page.locator('[data-ca-financial]').evaluate(el=>el.open),false,'Optional form starts collapsed');
    eq(await input(form,'includeScenario').isChecked(),false,'No opt-in inferred');eq(await form.locator('input[type=number]').evaluateAll(nodes=>nodes.every(el=>el.value==='')),true,'No assumptions inferred or prefilled');
    for(const key of ['capacity','spendingReduction','spendingAvoidance']){eq(await input(form,key+'.status').inputValue(),'','Each category needs an explicit status');eq(await input(form,key+'.status').locator('option').allTextContents(),['Choose a status','Enter an estimate','Reviewed — none identified ($0)','Not estimated'],'Unknown and reviewed zero have distinct choices');}
    await clickBuild();eq(await sendCount(),1,'Explicit report still works without scenario');check(!Object.hasOwn((await page.evaluate(()=>window.sent[0].body)),'financial_scenario_input'),'Skipped scenario absent from request');
    await page.locator('[data-ca-financial]>summary').focus();await page.keyboard.press('Enter');eq(await page.locator('[data-ca-financial]').evaluate(el=>el.open),true,'Keyboard opens optional form');
    await input(form,'includeScenario').focus();await page.keyboard.press('Space');eq(await form.locator('[data-ca-financial-fields]').isDisabled(),false,'Keyboard enables explicit entry');eq(readRequests,2,'Opening and opting in do not write or read readiness');
    await page.locator('[data-ca-financial]>summary').click();
    const before=await sendCount();await clickBuild();eq(await sendCount(),before,'Blank required input cannot submit');eq(await page.locator('[data-ca-financial]').evaluate(el=>el.open),true,'Validation reopens a collapsed opted-in form');
    eq(await input(form,'title').evaluate(el=>el===document.activeElement),true,'Validation focuses first missing field');
    await page.waitForFunction(()=>{const r=document.querySelector('[data-ca-financial-form] [name="title"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});checks++;
    if(width===390){const shot=`${name}-${width}-required-field.png`;await page.screenshot({path:path.join(out,shot)});screenshots.push(shot);}
    await fillScenario();await input(form,'title').press('Enter');await settled();eq(await sendCount(),before,'Enter in a text input does not build');
    await input(form,'implementationCashCost.central').fill('9');await clickBuild();eq(await sendCount(),before,'Unordered range cannot submit');
    eq(await input(form,'implementationCashCost.central').evaluate(el=>el===document.activeElement),true,'Range error focuses field');await input(form,'implementationCashCost.central').fill('20');
    await page.locator('[data-ca-financial-add]').click();eq(await input(page.locator('[data-ca-activity]').last(),'label').evaluate(el=>el===document.activeElement),true,'Add focuses new activity');
    await fillActivity(page.locator('[data-ca-activity]').last(),' MOCK DUPLICATE-ENTRY REVIEW ');await clickBuild();eq(await sendCount(),before,'Trimmed, case-insensitive duplicate activity label rejected');
    await page.locator('[data-ca-financial-remove]').last().click();eq(await page.locator('[data-ca-activity]').count(),1,'Remove leaves one row');
    for(let i=1;i<12;i++)await page.locator('[data-ca-financial-add]').click();eq(await page.locator('[data-ca-activity]').count(),12,'Twelve activities supported');check(await page.locator('[data-ca-financial-add]').isDisabled(),'Thirteenth activity unavailable');
    for(let i=12;i>1;i--)await page.locator('[data-ca-financial-remove]').last().click();check(await page.locator('[data-ca-financial-remove]').isDisabled(),'Keep at least one activity when opted in');
    await input(form,'measurementEnd').fill('2026-09-01T12:00');await clickBuild();eq(await sendCount(),before,'Less than one measured day rejected');await input(form,'measurementEnd').fill('2026-09-02T00:00');
    await input(form,'measuredPeople').fill('13');await clickBuild();eq(await sendCount(),before,'Measured people cannot exceed the recorded scope');await input(form,'measuredPeople').fill('2');
    await input(page.locator('[data-ca-activity]').first(),'measuredHours').fill('49');await clickBuild();eq(await sendCount(),before,'Total hours cannot exceed measured people and period');await input(page.locator('[data-ca-activity]').first(),'measuredHours').fill('8');
    await clickBuild();eq(await sendCount(),before+1,'One explicit valid scenario submission');
    const sent=await page.evaluate(()=>window.sent.at(-1).body),scenario=sent.financial_scenario_input;
    eq(sent.analysis_mode,'descriptive','Early scenario does not unlock synthesis');eq(Object.keys(scenario),keys,'Exact top-level input only');eq(scenario.schemaVersion,'operational-planning-input-20260919.2','Explicit v2 contract');eq(Object.keys(scenario.capacity),['status','basis','measurementStart','measurementEnd','measuredPeople','activities'],'Exact capacity fields');eq(Object.keys(scenario.capacity.activities[0]),activityKeys,'Exact activity input only');eq(Object.keys(scenario.spendingReduction),['status','basis','items'],'Exact spending-category fields');eq(Object.keys(scenario.spendingReduction.items[0]),expenseKeys,'Exact expense fields');
    eq(scenario.capacity.measuredPeople,2,'Use entered measured people, not twelve campaign participants');eq(scenario.capacity.activities[0].measuredHours,8,'Do not multiply total measured hours');
    eq(scenario.spendingAvoidance.status,'none_identified','Reviewed zero preserved as an explicit status');eq(scenario.spendingAvoidance.items,[],'Reviewed zero does not invent expense rows');eq(scenario.spendingReduction.items[0].capacityActivityId,null,'Non-labor expense needs no fabricated activity link');
    eq(scenario.implementationCashCost,{low:10,central:20,high:30},'Cash cost retained separately');eq(scenario.implementationCapacityCost,{low:40,central:50,high:60},'Staff-time value retained separately');
    check(!['readiness','scope','authority','outputs','totals'].some(key=>Object.hasOwn(scenario,key)),'Browser cannot supply authority or calculated outputs');
    eq(await page.evaluate(()=>window.prepared.at(-1).financial_scenario_input),scenario,'Scenario participates in existing idempotency preparation');
    const calculate=input=>{const ctx=current();return calculator.calculateFinancialPlanningScenario(input,{scope,readiness:ctx.readiness,snapshot:ctx.snapshot,actorId:'actor-mock',createdAt:'2026-09-13T12:00:00Z'});};
    if(calculator){const result=calculate(scenario);eq(result.totals.netCashEffect,{low:65,central:175,high:285},'Actual server calculator accepts UI input without counting absorbed labor as cash');eq(result.kind,'early_planning_scenario','Actual calculator preserves early status');}
    // Cash-only estimates must never need invented people or time records.
    await input(form,'capacity.status').selectOption('not_estimated');await input(form,'measurementStart').evaluate(el=>{el.value='';});await input(form,'measuredPeople').evaluate(el=>{el.value='';});await clickBuild();
    const cashOnly=await page.evaluate(()=>window.sent.at(-1).body.financial_scenario_input);
    eq(cashOnly.capacity,{status:'not_estimated',basis:'MOCK explicit review of separate operating records.',measurementStart:null,measurementEnd:null,measuredPeople:null,activities:[]},'Cash-only entry has an honest unestimated capacity category');
    if(calculator){const result=calculate(cashOnly);eq(result.benefits.staffCapacity.amount,null,'Unknown capacity is not zero');eq(result.benefits.spendingAvoidance.amount,{low:0,central:0,high:0},'Reviewed zero is zero');eq(result.coverage.complete,false,'Partial coverage remains explicit');}
    let invalidBefore=await sendCount();
    await input(form,'spendingAvoidance.status').selectOption('estimated');await fillExpense(expense('spendingAvoidance'),'MOCK future purchase',' mock   LICENSE budget ');await clickBuild();eq(await sendCount(),invalidBefore,'Normalized underlying expense cannot be claimed twice across categories');
    await input(expense('spendingAvoidance'),'resourceId').fill('MOCK future budget');await input(expense('spendingAvoidance'),'label').fill(' mock  CURRENT license expense ');await clickBuild();eq(await sendCount(),invalidBefore,'Normalized expense label cannot be claimed twice');
    await input(expense('spendingAvoidance'),'label').fill('MOCK future purchase');await input(expense('spendingAvoidance'),'endMonth').fill('2');await clickBuild();eq(await sendCount(),invalidBefore,'Expense cannot extend past planning horizon');
    await input(expense('spendingAvoidance'),'endMonth').fill('1');for(const unit of ['hours','FTEs','full-time equivalents','staffhours']){await input(expense('spendingAvoidance'),'unit').fill(unit);await clickBuild();eq(await sendCount(),invalidBefore,'Labor units cannot be entered as non-labor spending: '+unit);}
    await input(expense('spendingAvoidance'),'kind').selectOption('labor');eq(await input(expense('spendingAvoidance'),'unit').inputValue(),'hours','Choosing labor declares hours');check(await input(expense('spendingAvoidance'),'unit').evaluate(el=>el.readOnly),'Labor unit cannot silently diverge');await clickBuild();eq(await sendCount(),invalidBefore,'Labor cannot submit without estimated linked capacity');
    await input(form,'capacity.status').selectOption('estimated');await input(form,'measurementStart').fill('2026-09-01T00:00');await input(form,'measuredPeople').fill('2');
    const activityId=await page.locator('[data-ca-activity]').first().getAttribute('data-ca-activity');await input(expense('spendingAvoidance'),'capacityActivityId').selectOption(activityId);await input(expense('spendingAvoidance'),'baselineMonthlyUnits').fill('0.25');await input(expense('spendingAvoidance'),'unitCost').fill('50');await fillRange(expense('spendingAvoidance'),'reductionPercent',{low:100,central:100,high:100});await clickBuild();eq(await sendCount(),invalidBefore+1,'Explicit labor link submits alongside independent current spending');
    const linked=await page.evaluate(()=>window.sent.at(-1).body.financial_scenario_input);eq(linked.spendingAvoidance.items[0].capacityActivityId,activityId,'Exact stable activity link reaches server');
    if(calculator){const result=calculate(linked);eq(result.activities[0].hoursUsedForSpendingAvoidance,{low:0.25,central:0.25,high:0.25},'Actual calculator allocates claimed labor hours');for(const k of ['low','central','high'])check(Math.abs(result.activities[0].grossHoursFreed[k]-result.activities[0].potentialHoursFreed[k]-.25)<.011,'Labor removed before retained capacity value');}
    if(calculator){
      await page.evaluate(()=>window.validateScenarioWithCalculator=true);await input(expense('spendingAvoidance'),'baselineMonthlyUnits').fill('1000');const completedBefore=await page.evaluate(()=>window.completed.length),requestsBefore=await sendCount();await clickBuild();
      check((await page.locator('[data-ca-message]').textContent()).includes('Labor spending benefits exceed the linked activity hours in a planning month'),'Actual allocation error gives an actionable explanation');eq(await page.evaluate(()=>window.completed.length),completedBefore,'Actual calculator rejection never completes a report');eq(await input(expense('spendingAvoidance'),'baselineMonthlyUnits').inputValue(),'1000','Rejected allocation remains editable');
      await checkReportErrorVisible();eq(await sendCount(),requestsBefore+1,'Revealing actual validation error does not retry the report');
      await input(expense('spendingAvoidance'),'baselineMonthlyUnits').fill('0.25');await clickBuild();eq(await page.evaluate(()=>window.completed.length),completedBefore+1,'Corrected allocation succeeds through actual calculator boundary');
    }
    await input(page.locator('[data-ca-activity]').first(),'label').fill('MOCK renamed measured activity');eq(await input(expense('spendingAvoidance'),'capacityActivityId').inputValue(),activityId,'Renaming activity preserves the link');check((await input(expense('spendingAvoidance'),'capacityActivityId').locator('option:checked').textContent()).includes('renamed'),'Linked option label stays understandable');
    await page.locator('[data-ca-financial-add]').click();await fillActivity(page.locator('[data-ca-activity]').last(),'MOCK second activity');await page.locator('[data-ca-financial-remove]').first().click();eq(await input(expense('spendingAvoidance'),'capacityActivityId').inputValue(),'','Deleting activity clears its expense link');invalidBefore=await sendCount();await clickBuild();eq(await sendCount(),invalidBefore,'Deleted activity cannot leave a stale labor link');
    await input(form,'spendingAvoidance.status').selectOption('not_estimated');await clickBuild();const partial=await page.evaluate(()=>window.sent.at(-1).body.financial_scenario_input);eq(partial.spendingAvoidance.items,[],'Unestimated expense category omits stale entered amounts');
    await input(form,'capacity.status').selectOption('none_identified');await input(form,'spendingReduction.status').selectOption('none_identified');await clickBuild();const explicitZero=await page.evaluate(()=>window.sent.at(-1).body.financial_scenario_input);eq(explicitZero.capacity.activities,[],'Reviewed zero capacity has no invented activity');eq(explicitZero.capacity.measuredPeople,null,'Reviewed zero capacity has no invented population');eq(explicitZero.spendingReduction.items,[],'Reviewed zero spending has no invented rows');
    await fillScenario();
    eq(JSON.stringify(current()),original,'Editing did not change scope, readiness or records');
    await page.evaluate(()=>window.rejectReport=true);const completed=await page.evaluate(()=>window.completed.length),requestsBeforeRejection=await sendCount();await clickBuild();
    const rejectionMessage=await page.locator('[data-ca-message]').textContent();check(rejectionMessage.includes('MOCK server rejected'),'Server rejection displayed safely: '+rejectionMessage+' '+JSON.stringify(await form.locator('input:invalid,select:invalid,textarea:invalid').evaluateAll(nodes=>nodes.map(el=>({name:el.name,value:el.value,message:el.validationMessage})))));eq(await page.evaluate(()=>window.completed.length),completed,'Rejected report not completed or saved');eq(await input(form,'title').inputValue(),'MOCK operational planning','Server error retains editable input');
    await checkReportErrorVisible();eq(await sendCount(),requestsBeforeRejection+1,'Revealing server rejection does not retry the report');
    await page.evaluate(()=>window.rejectReport=false);await input(form,'includeScenario').uncheck();await clickBuild();check(!Object.hasOwn(await page.evaluate(()=>window.sent.at(-1).body),'financial_scenario_input'),'Unchecking omits even previously entered data');
    ready=true;await page.locator('[data-ca-refresh]').click();await settled();eq(await input(form,'includeScenario').isChecked(),false,'Refresh clears unsaved opt-in');eq(await input(form,'title').inputValue(),'','Refresh clears unsaved input');
    await page.locator('[data-ca-financial]>summary').click();await input(form,'includeScenario').check();await fillScenario();await page.evaluate(()=>window.savedReport=true);await clickBuild();
    eq(await page.evaluate(()=>window.sent.at(-1).body.analysis_mode),'synthesis','Only existing readiness selects saved synthesis');check((await page.evaluate(()=>window.savedLocation.href)).includes('id=saved-mock'),'Actual callback retains saved-report navigation');
    eq(await form.locator('input[type=text],textarea').evaluateAll(nodes=>nodes.every(el=>el.getAttribute('aria-describedby')==='ca-financial-privacy')),true,'Every free-text field points to privacy warning');
    eq(await input(form,'includeScenario').evaluate(el=>getComputedStyle(el).accentColor),'rgb(23, 111, 121)','Opt-in uses the existing teal palette');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Form fits viewport');
    eq(await form.locator('input,select,textarea,button').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length&&el.type!=='checkbox'&&el.getBoundingClientRect().height<44).map(el=>({name:el.name||el.textContent,type:el.type,height:el.getBoundingClientRect().height}))),[],'Visible inputs and buttons retain usable targets');
    eq(await form.locator('.ca-financial-range:visible').evaluateAll(nodes=>nodes.flatMap(field=>[...field.querySelectorAll('input')].filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(el=>el.name))),[],'All Low/Central/High controls fit the viewport');
    if(width===320||width===1440){
      await page.locator('[data-ca-benefit="capacity"]').screenshot({path:path.join(out,`${name}-${width}-capacity-category.png`)});screenshots.push(`${name}-${width}-capacity-category.png`);
      await page.locator('[data-ca-benefit="spendingReduction"]').screenshot({path:path.join(out,`${name}-${width}-spending-category.png`)});screenshots.push(`${name}-${width}-spending-category.png`);
    }
    const shot=`${name}-${width}-financial-form.png`;await page.locator('[data-ca-financial]').screenshot({path:path.join(out,shot)});screenshots.push(shot);
    states.push({browser:name,width,reportRequests:await sendCount(),readRequests});await page.close();
  }}finally{await browser.close();}
}
eq(errors,[],'No browser errors');eq(fs.readFileSync(path.join(root,'campaign-analysis.js'),'utf8'),source,'Candidate source unchanged during test');eq(fs.readFileSync(path.join(root,'campaign-analysis.css'),'utf8'),styles,'Candidate styles unchanged during test');eq(fs.readFileSync(path.join(root,'workspace-analysis.html'),'utf8'),workspace,'Actual callback unchanged during test');
const receipt={status:'PASS',checks,states,screenshots,blockedExternalRequests:blocked,productionCalls:0,providerCalls:0,databaseWrites:0,
  actualCalculator:calculator?sha(fs.readFileSync(process.env.FINANCIAL_SCENARIO_MODULE)):null,
  sources:{'campaign-analysis.js':sha(source),'campaign-analysis.css':sha(styles),'workspace-analysis.html':sha(workspace)},
  proofScope:'Local actual UI/callback with scripted transport; optional actual pure calculator. No real persistence or deployment proof.'};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({status:'PASS',checks,output:out,states:states.length,actualCalculator:!!calculator}));
