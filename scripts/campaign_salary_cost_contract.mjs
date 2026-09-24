import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../campaign-analysis.js',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../workspace-analysis.html',import.meta.url),'utf8');
const module=vm.runInNewContext(source.replace(/^export /gm,'')+'\n({campaignSalaryCostRequest,campaignSalaryCostAvailable})',{});
const request=module.campaignSalaryCostRequest;
const evidence={scope:{id:'scope-controlled',label:'Controlled group',population:{size:12},lenses:{decision_velocity:{}},window:{start:'2026-09-01T00:00:00Z',end:'2026-09-12T00:00:00Z'}},readiness:{salary_cost_available:true,evidenceDigest:'controlled',depth:{status:'satisfied'}}};
const baseScenario={schemaVersion:'operational-planning-input-20260919.2',capacity:{status:'estimated',measuredPeople:12,activities:[{id:'activity_1'}]}};
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};const rejects=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
eq(request(evidence,baseScenario,undefined),undefined,'manual mode adds no root flag');
eq(JSON.parse(JSON.stringify(request(evidence,baseScenario,{use:true,scope_match_confirmed:true}))),{use:true,scope_match_confirmed:true});
for(const value of [undefined,false,'true',1,null])rejects(()=>request({...evidence,readiness:{...evidence.readiness,salary_cost_available:value}},baseScenario,{use:true,scope_match_confirmed:true}),/not available/);
for(const selection of [null,{},true,[],{use:true},{use:true,scope_match_confirmed:false},{use:'true',scope_match_confirmed:true},{use:true,scope_match_confirmed:true,rate:900}])rejects(()=>request(evidence,baseScenario,selection),/Confirm/);
for(const scenario of [undefined,{...baseScenario,schemaVersion:'older'},{...baseScenario,capacity:{...baseScenario.capacity,status:'none_identified'}},{...baseScenario,capacity:{...baseScenario.capacity,measuredPeople:11}},{...baseScenario,capacity:{...baseScenario.capacity,activities:[{id:'activity_1',loadedHourlyCost:0}]}},{...baseScenario,capacity:{...baseScenario.capacity,activities:[]}}])rejects(()=>request(evidence,scenario,{use:true,scope_match_confirmed:true}),/entire named|combine/);
rejects(()=>request({...evidence,scope:{...evidence.scope,population:{size:4}}},{...baseScenario,capacity:{...baseScenario.capacity,measuredPeople:4}},{use:true,scope_match_confirmed:true}),/entire named/);

// Exercise the real controls and scenario reader, using lightweight field
// doubles instead of a browser. No readiness calculator or salary is invented.
const usingSource=source.match(/    const usingCampaignSalaryCost=[^\n]+/)[0];
const updateSource=source.match(/    function updateSalaryCostControls\([^]*?\n    }/)[0];
const readerStart=source.indexOf('    const readScenario=()=>{'),readerEnd=source.indexOf('    return readScenario;',readerStart);
assert.ok(readerStart>0&&readerEnd>readerStart);
function fixture(options={}){
  const {mode='manual',included=true}=options,available=Object.hasOwn(options,'available')?options.available:true;
  const inputs=new Map();
  const field=(name,value='',minLength=0)=>{const input={name,value:String(value),minLength,disabled:false,checked:false,required:false,setCustomValidity(message){this.validationMessage=message;},focus(){},scrollIntoView(){},reportValidity(){}};Object.defineProperty(input,'valueAsNumber',{get(){return Number(this.value);}});return input;};
  const values={title:'Controlled planning',horizonMonths:1,'capacity.status':'estimated','capacity.basis':'Operating records',measurementStart:'2026-09-01T00:00',measurementEnd:'2026-09-02T00:00',measuredPeople:12,'spendingReduction.status':'none_identified','spendingReduction.basis':'Reviewed current expenses','spendingAvoidance.status':'not_estimated','spendingAvoidance.basis':'Future expenses not estimated',subscriptionCost:0,costBasis:'Controlled planning costs',campaignSalaryCostSource:mode};
  for(const [name,value]of Object.entries(values))inputs.set(name,field(name,value));
  for(const name of ['implementationCashCost','implementationCapacityCost'])for(const level of ['low','central','high'])inputs.set(`${name}.${level}`,field(`${name}.${level}`,0));
  const confirmation=field('campaignSalaryScopeConfirmed');inputs.set(confirmation.name,confirmation);
  const row={dataset:{caActivity:'activity_1'},inputs:new Map()};
  for(const [name,value]of Object.entries({label:'Record review',measuredHours:24,sourceBasis:'operational_records',sourceReference:'Controlled record reference',loadedHourlyCost:42.56,changeBasis:'Controlled assumptions'}))row.inputs.set(name,field(name,value));
  for(const name of ['reductionPercent','adoptionPercent'])for(const level of ['low','central','high'])row.inputs.set(`${name}.${level}`,field(`${name}.${level}`,10));
  const container={hidden:true},activities={children:[row],firstElementChild:row,querySelectorAll(){return this.children.map(item=>item.inputs.get('loadedHourlyCost'));}};
  const form={elements:{includeScenario:{checked:included},scopeConfirmed:{checked:true},overlapReviewed:{checked:true}},querySelectorAll(){return [...inputs.values(),...activities.children.flatMap(item=>[...item.inputs.values()])];},checkValidity(){return !confirmation.required||confirmation.checked;},querySelector(selector){if(selector==='[data-ca-salary-confirmation]')return container;if(selector.includes(':invalid'))return confirmation;throw new Error('Unexpected selector '+selector);}};
  const context={current:{...evidence,readiness:{...evidence.readiness,salary_cost_available:available}},salaryCostAvailable:available===true,form,activities,details:{},value:(owner,name)=>owner===form?inputs.get(name):owner.inputs.get(name),campaignSalaryCostRequest:request};
  const handlers=vm.runInNewContext(`${usingSource}\n${updateSource}\n${source.slice(readerStart,readerEnd)}\n({readScenario,updateSalaryCostControls,usingCampaignSalaryCost});`,context);
  handlers.updateSalaryCostControls();
  return{...handlers,form,inputs,row,activities,confirmation,container};
}
const manual=fixture();
eq(manual.row.inputs.get('loadedHourlyCost').disabled,false);
eq(manual.readScenario().capacity.activities[0].loadedHourlyCost,42.56);
eq(manual.readScenario.campaignSalaryCost(manual.readScenario()),undefined);
const selected=fixture({mode:'campaign'});
eq(selected.row.inputs.get('loadedHourlyCost').disabled,true);
eq(selected.confirmation.checked,false,'confirmation cannot be inferred');
rejects(()=>selected.readScenario(),/highlighted/);
selected.confirmation.checked=true;
const scenario=selected.readScenario();
eq(Object.hasOwn(scenario.capacity.activities[0],'loadedHourlyCost'),false,'manual rate omitted, not sent as zero');
eq(Object.hasOwn(scenario,'campaign_salary_cost'),false,'authorization is a separate root field, not financial scenario input');
eq(JSON.parse(JSON.stringify(selected.readScenario.campaignSalaryCost(scenario))),{use:true,scope_match_confirmed:true});
eq(/42\.56|annual_base_salary|hourly_rate/.test(JSON.stringify(scenario)),false,'no raw or derived salary inputs leave this reader');
selected.inputs.get('measuredPeople').value='11';rejects(()=>selected.readScenario(),/entire named campaign/);selected.inputs.get('measuredPeople').value='12';
selected.inputs.get('campaignSalaryCostSource').value='manual';selected.updateSalaryCostControls(true);
eq(selected.row.inputs.get('loadedHourlyCost').disabled,false);eq(selected.row.inputs.get('loadedHourlyCost').value,'42.56','manual input remains available after opt-out');
eq(selected.confirmation.checked,false);eq(selected.container.hidden,true);
eq(selected.readScenario().capacity.activities[0].loadedHourlyCost,42.56);
selected.inputs.get('campaignSalaryCostSource').value='campaign';selected.updateSalaryCostControls(true);selected.confirmation.checked=true;
selected.inputs.get('capacity.status').value='not_estimated';selected.updateSalaryCostControls(true);
eq(selected.readScenario.campaignSalaryCost(selected.readScenario()),undefined,'cash-only scenario cannot opt in to salary costs');
selected.form.elements.includeScenario.checked=false;eq(selected.readScenario(),undefined);
for(const available of [false,undefined,'true',1]){
  const closed=fixture({available,mode:'campaign'});eq(closed.usingCampaignSalaryCost(),false);eq(closed.row.inputs.get('loadedHourlyCost').disabled,false);
}
for(const status of [undefined,'in_progress','needs_attention','not_started']){
  const notReady={...evidence,readiness:{...evidence.readiness,depth:{status}}};
  eq(module.campaignSalaryCostAvailable(notReady),false,'unsaved response comparison cannot use salary costs');
  rejects(()=>request(notReady,baseScenario,{use:true,scope_match_confirmed:true}),/not available/);
}
const cross={...evidence,scope:{...evidence.scope,lenses:{decision_velocity:{},structural_clarity:{}}},readiness:{...evidence.readiness,crossLens:{status:'in_progress'}}};
eq(module.campaignSalaryCostAvailable(cross),false,'Cross-Lens Synthesis needs its own readiness');
eq(module.campaignSalaryCostAvailable({...cross,readiness:{...cross.readiness,crossLens:{status:'satisfied'}}}),true);
const many=fixture({mode:'campaign'});
for(let i=2;i<=12;i++){
  const inputs=new Map([...many.row.inputs].map(([name,input])=>[name,{...input,valueAsNumber:input.valueAsNumber}]));
  inputs.get('label').value=`Distinct activity ${i}`;
  many.activities.children.push({dataset:{caActivity:`activity_${i}`},inputs});
}
many.updateSalaryCostControls();many.confirmation.checked=true;
eq(many.activities.children.every(row=>row.inputs.get('loadedHourlyCost').disabled),true,'all twelve hourly-cost inputs disabled');
const full=many.readScenario();eq(full.capacity.activities.length,12);
eq(full.capacity.activities.every(activity=>!Object.hasOwn(activity,'loadedHourlyCost')),true,'all twelve hourly-cost inputs omitted');
eq(JSON.parse(JSON.stringify(many.readScenario.campaignSalaryCost(full))),{use:true,scope_match_confirmed:true});
many.inputs.get('campaignSalaryCostSource').value='manual';many.updateSalaryCostControls(true);
eq(many.activities.children.every(row=>!row.inputs.get('loadedHourlyCost').disabled&&row.inputs.get('loadedHourlyCost').value==='42.56'),true,'all manually entered costs restored on opt-out');

// Execute the actual Workspace callback to verify the root request shape and
// inclusion in its existing idempotency preparation, before any report call.
const callback=workspace.match(/onReport:async\(evidence,financialScenarioInput,campaignSalaryCost\)=>\{([\s\S]*?)\n        \}\}\);/)?.[1];assert.ok(callback);
const prepared=[],sent=[];
const run=vm.runInNewContext(`async(evidence,financialScenarioInput,campaignSalaryCost)=>{${callback}}`,{
  campaignSalaryCostRequest:request,supabase:{auth:{getSession:async()=>({data:{session:{access_token:'controlled',user:{id:'actor'}}}})}},ws5OrgId:'org-controlled',API_BASE:'https://no-network.invalid',
  synthesisRequestStore:{prepare:async(org,actor,body)=>{prepared.push(structuredClone(body));return{requestId:'controlled-request'};},complete(){}},
  fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return{ok:true,json:async()=>({result:{},synthesis:{id:'controlled-report'}})};},location:{href:''}
});
await run(evidence,scenario,{use:true,scope_match_confirmed:true});
eq(sent.length,1);eq(prepared[0].campaign_salary_cost,{use:true,scope_match_confirmed:true});
eq(sent[0].campaign_salary_cost,prepared[0].campaign_salary_cost);
eq(Object.hasOwn(sent[0].financial_scenario_input.capacity.activities[0],'loadedHourlyCost'),false);
await assert.rejects(()=>run(evidence,scenario,{use:true,scope_match_confirmed:true,hourlyCost:900}),/Confirm/);checks++;
eq(prepared.length,1,'malformed selection rejected before request identity or report submission');
await run(evidence,manual.readScenario(),undefined);eq(Object.hasOwn(sent[1],'campaign_salary_cost'),false);
await assert.rejects(()=>run(cross,scenario,{use:true,scope_match_confirmed:true}),/not available/);checks++;
eq(sent.length,2,'ineligible Cross-Lens state cannot submit a salary-backed report');
assert.match(source,/const salaryCostChoice=salaryCostAvailable\?/);checks++;
assert.match(source,/name="campaignSalaryScopeConfirmed" disabled>/);checks++;
assert.doesNotMatch(source,/localStorage|sessionStorage/);checks++;
// Exercise the shared HTML/print renderer. The disclosure is renderer-owned
// prose, never a free-text metadata field or an individual employee's salary.
const rendererSource=readFileSync(new URL('../monderman-report.js',import.meta.url),'utf8');
const safetySource=readFileSync(new URL('../participant-evidence-safety.js',import.meta.url),'utf8');
const samples=JSON.parse(readFileSync(new URL('../sample-data/production-diagnostic-samples.json',import.meta.url),'utf8'));
function renderer(code){
  const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
  vm.runInNewContext(safetySource,context);vm.runInNewContext(code,context);
  return context.window.MondermanReport;
}
const sharedRenderer=renderer(rendererSource);
const disclosureLine=rendererSource.split('\n').find(line=>line.includes("if(obj(s.method).capacityCostSource==='matched_campaign_population')html+="));
assert.ok(disclosureLine);checks++;
const withoutDisclosure=renderer(rendererSource.replace(disclosureLine+'\n',''));
const modelFor=(R,entry)=>entry.kind==='diagnostic'?R.fromRun(entry.source):R.fromSynthesis(entry.source);
for(const [name,entry]of Object.entries(samples.outputs)){
  const before=JSON.stringify(entry);
  const actual=sharedRenderer.buildReportHtml(modelFor(sharedRenderer,entry));
  eq(actual,withoutDisclosure.buildReportHtml(modelFor(withoutDisclosure,entry)),name+': ordinary report remains byte-for-byte unchanged by this addition');
  eq(actual.includes('class="mr-employment-cost-basis"'),false,name+': ordinary source never implies uploaded salaries');
  eq(JSON.stringify(entry),before,name+': saved input remains unchanged');
}
for(const name of ['depth_synthesis','cross_lens_synthesis']){
  const raw=structuredClone(samples.outputs[name].source);
  raw.financial_scenario.method.capacityCostSource='matched_campaign_population';
  raw.financial_scenario.method.employmentCostBasis='<img src=x onerror=alert(1)> fabricated salary';
  raw.financial_scenario.method.extrapolation='<script>alert("unsafe")</script>';
  const before=JSON.stringify(raw),model=sharedRenderer.fromSynthesis(raw);
  const body=sharedRenderer.buildReportBody(model),html=sharedRenderer.buildReportHtml(model);
  const paragraph=body.match(/<p class="mr-employment-cost-basis">([^]*?)<\/p>/)?.[0];
  assert.ok(paragraph);checks++;
  eq((html.match(/class="mr-employment-cost-basis"/g)||[]).length,1,name+': disclosure appears once in full report');
  eq(html.includes(paragraph),true,name+': same disclosure retained in full HTML/print body');
  for(const phrase of ['entire named campaign population','uploaded annual base salaries','annual working hours and benefits/overhead','Each person is counted once across lenses','typical mix of work','not cash savings']){assert.ok(paragraph.includes(phrase));checks++;}
  eq(body.includes('fabricated salary'),false,'untrusted disclosure metadata is not rendered');
  eq(body.includes('<script>alert("unsafe")</script>'),false,'untrusted method text cannot create markup');
  eq(body.includes('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;'),true,'existing method text remains escaped');
  eq(JSON.stringify(raw),before,'salary-backed report source is not mutated');
  raw.financial_scenario.method.capacityCostSource='<img src=x onerror=alert(1)>';
  const forged=sharedRenderer.buildReportBody(sharedRenderer.fromSynthesis(raw));
  eq(forged.includes('class="mr-employment-cost-basis"'),false,'disclosure requires the exact supported source marker');
  eq(forged.includes('<img src=x'),false,'unsupported source marker cannot inject HTML');
}
console.log(JSON.stringify({ok:true,checks,networkCalls:0,browserChecks:0,scope:'actual scenario reader, whole-group controls, strict request selection, Workspace handoff and shared HTML/print salary-source disclosure'}));
