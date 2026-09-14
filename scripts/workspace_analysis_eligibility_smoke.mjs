import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../workspace-analysis.html',import.meta.url),'utf8');
const start=html.indexOf('    function isAnalysisEligible(run){');
const end=html.indexOf('    function renderTrust(',start);
assert.ok(start>=0&&end>start);
assert.match(html,/SYNTH_RUNS=rows\.filter\(isAnalysisEligible\)/);
const context=vm.createContext({Date,Number,Set,normalizeVantage:value=>value});
vm.runInContext(html.slice(start,end),context);
const eligible={status:'promoted',included_in_aggregates:true,normalization_status:'included',report_available:true,
  locked:false,tool_type:'decision_velocity',diagnostic_depth:10,participant_mode:'managerial',created_at:new Date().toISOString()};
const rows=[eligible,{...eligible,participant_mode:'senior_leader'},
  ...['structural_clarity','operational_systems','institutional_performance'].map(tool_type=>({...eligible,tool_type})),
  ...Array.from({length:6},()=>({...eligible,status:'staged',normalization_status:null,included_in_aggregates:false,diagnostic_depth:60})),
  {...eligible,status:'archived',normalization_status:null,diagnostic_depth:60}];
const before=JSON.stringify(rows),result=context.computeTrust(rows);
assert.equal(JSON.stringify(rows),before);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{total:12,incl:5,caut:0,excl:0,screened:5,inAggN:5,
  topTool:'decision_velocity',topN:2,depths:1,vants:2,recent:5});
let checks=1;
for(const patch of [{status:'staged'},{status:'archived'},{status:null},{included_in_aggregates:false},
  {included_in_aggregates:null},{normalization_status:null},{normalization_status:'excluded_from_aggregates'},
  {normalization_status:'unknown'},{report_available:false},{report_available:null},{locked:true}]){
  const row={...eligible,...patch};
  assert.equal(context.isAnalysisEligible(row),false);
  assert.equal(context.computeTrust([row]).inAggN,0);checks++;
}
const caution={...eligible,normalization_status:'included_with_caution'};
assert.equal(context.isAnalysisEligible(caution),true);
assert.equal(context.computeTrust([caution]).caut,1);checks++;
for(const created_at of [null,'invalid','2999-01-01T00:00:00Z','2020-01-01T00:00:00Z']){
  assert.equal(context.computeTrust([{...eligible,created_at}]).recent,0);checks++;
}
assert.equal(context.computeTrust([]).inAggN,0);checks++;
assert(html.includes('${t.screened} of ${t.total} runs have a recorded quality status.'),'stored quality counts must not claim a fresh screening');
assert(html.includes('Unusual answers are not automatically excluded.'),'quality boundary missing');
assert(html.includes("analysis_mode:'self_run_synthesis'"),'self-run request must use bounded mode');
assert(html.includes('run.self_run_owned_by_caller===true&&selected.has'),'self-run selection requires server-owned provenance');
assert.doesNotMatch(html,/const inAgg=st!=="excluded_from_aggregates"/);
console.log(`PASS workspace eligibility: ${checks} cases; actual inline summary/picker predicate; synthetic records only, no network or writes.`);

// Exercise the real boot, tab activation, loader and list wrapper with deferred
// auth/membership. Other analysis renderers are inert; no browser or API runs.
function sourceBetween(first,last){
  const a=html.indexOf(first),b=html.indexOf(last,a+first.length);
  assert.ok(a>=0&&b>a,first);return html.slice(a,b);
}
const bootSources=[
  sourceBetween('    let ws5OrgId =','    const synthesisRequestStore='),
  sourceBetween('    let SYNTH_RUNS =','    function sEsc('),
  sourceBetween('    async function loadSynthesisRuns(){','    function selectLens('),
  sourceBetween('    function wireTabs(){','    // ---- Trust / data-quality layer'),
  sourceBetween('    async function fetchWorkspaceRuns(orgId){','    // The summary and Synthesis picker'),
  sourceBetween('    function isAnalysisEligible(run){','    function computeTrust('),
  sourceBetween('    async function boot(){','    boot();')
].join('\n');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};}
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function bootCase({hash='',earlyClick=false,membership='present',arrayResponse=false,failHistory=false,noUser=false}={}){
  const auth=deferred(),member=deferred(),calls=[],timers=[],lookups=[],mounts=[],painted=[];
  const nodes=new Map();
  const element=id=>{
    if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',addEventListener(){},classList:{toggle(){}},querySelector(){return null}});
    return nodes.get(id);
  };
  function tab(lens,active=false){return {dataset:{lens},active,handlers:{},
    classList:{toggle(name,value){if(name==='active')this.owner.active=value;},owner:null},
    addEventListener(name,fn){this.handlers[name]=fn;}};}
  const tabs=[tab('across-lenses',true),tab('synthesis')];tabs.forEach(t=>{t.classList.owner=t;});
  const sections=tabs.map(t=>({dataset:t.dataset,hidden:!t.active}));
  const user={id:'fixture-person',email:'fixture@example.invalid',user_metadata:{}};
  const expectedOrg='272a9dad-96d0-4d55-a97c-59be2ef11437';
  const fixtureRows=[{...eligible,id:'own',self_run_owned_by_caller:true},{...eligible,id:'unowned',self_run_owned_by_caller:false},
    {...eligible,id:'excluded',included_in_aggregates:false}];
  const sandbox={console,Date,Number,Set,Map,API_BASE:'https://fixture.invalid',
    window:{__mondermanActiveOrganizationId:expectedOrg,location:{href:''}},
    location:{hash,replace(value){sandbox.redirect=value;}},
    document:{getElementById:element,querySelectorAll(selector){return selector==='.subtabs a'?tabs:selector==='.lens'?sections:[];},
      querySelector(selector){return selector==='.subtabs a.active'?tabs.find(t=>t.active):null;}},
    $:element,setTimeout(fn){timers.push(fn);},wireTrust(){},setText(){},cap:x=>x,initials:()=>'',renderRailPlan(){},
    normalizeVantage:x=>x,emptyHTML:(title,message)=>title+' | '+message,loadAndRenderTrust(){},
    mountCampaignAnalysis(args){mounts.push(args.organizationId);},renderAll(){},
    supabase:{auth:{getUser:()=>auth.promise,getSession:async()=>({data:{session:{user,access_token:'offline-fixture'}}})},
      from(table){const q={select(){return q},eq(column,value){lookups.push({table,column,value});return q},not(){return q},order(){return q},
        maybeSingle:()=>member.promise,then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q;}},
    fetch:async(url,options)=>{
      const u=new URL(url);calls.push({path:u.pathname,headers:options?.headers});
      if(u.pathname.startsWith('/api/normalization/workspace-runs/')){
        const correct=u.pathname===`/api/normalization/workspace-runs/${expectedOrg}`;
        return {ok:correct,status:correct?200:403,json:async()=>correct?(arrayResponse?fixtureRows:{ok:true,runs:fixtureRows}):{error:'not_a_member_of_this_organization'}};
      }
      assert.equal(u.pathname,'/api/synthesis-runs');
      return {ok:!failHistory,status:failHistory?503:200,json:async()=>({syntheses:[]})};
    },
    renderSynthPicker(){painted.push(vm.runInContext('SYNTH_RUNS.map(r=>r.id)',ctx));element('synthBody').innerHTML='picker';}}
  sandbox.window.location=sandbox.location;
  const ctx=vm.createContext(sandbox);
  vm.runInContext('let SAVED_SYNTHESES=[],SNAPS=[],ACTION_LINKS=[];\n'+bootSources,ctx);
  const boot=ctx.boot();
  if(earlyClick)tabs[1].handlers.click({preventDefault(){}});
  while(timers.length)timers.shift()();
  await settle();
  assert.equal(calls.length,0,'No request while getUser is unresolved');
  assert.equal(vm.runInContext('SYNTH_RUNS',ctx),null,'Pre-auth selection must not poison the cache');
  auth.resolve({data:{user:noUser?null:user}});await settle();
  assert.equal(calls.length,0,'No request while membership is unresolved');
  if(noUser){await boot;assert.equal(sandbox.redirect,'signin.html?next=workspace-analysis.html');return;}
  assert.ok(lookups.some(x=>x.table==='organization_members'&&x.column==='organization_id'&&x.value===expectedOrg));
  if(membership==='error')member.resolve({data:null,error:{message:'offline membership unavailable'}});
  else member.resolve({data:membership==='present'?{role:'admin',organization_id:expectedOrg,organizations:{}}:null,error:null});
  await boot;await settle();
  const requests=()=>calls.filter(c=>c.path.startsWith('/api/normalization/workspace-runs/'));
  const requested=hash==='#synthesis'||earlyClick;
  if(membership!=='present'){
    assert.equal(requests().length,0,'Missing membership must never request /null or /undefined');
    tabs[1].handlers.click({preventDefault(){}});await settle();
    assert.equal(requests().length,0);
    assert.match(element('synthBody').innerHTML,/Workspace unavailable/);
    assert.equal(vm.runInContext('SYNTH_RUNS',ctx),null);return;
  }
  assert.equal(requests().length,requested?1:0);
  if(!requested){tabs[1].handlers.click({preventDefault(){}});await settle();}
  assert.equal(requests().length,1);
  assert.equal(requests()[0].path,`/api/normalization/workspace-runs/${expectedOrg}`);
  assert.equal(requests()[0].headers.Authorization,'Bearer offline-fixture');
  assert.equal(element('synthBody').innerHTML,'picker');
  assert.deepEqual(JSON.parse(JSON.stringify(painted)),[['own','unowned']],'Existing aggregate eligibility remains unchanged');
  assert.deepEqual(mounts,[expectedOrg],'Campaign readiness receives the same resolved tenant');
  tabs[1].handlers.click({preventDefault(){}});await settle();
  assert.equal(requests().length,1,'A successful cached load must not be duplicated');
}
for(const scenario of [
  {hash:'#synthesis'},{earlyClick:true},{hash:'#synthesis',earlyClick:true},{},
  {hash:'#synthesis',membership:'missing'},{earlyClick:true,membership:'error'},
  {hash:'#synthesis',noUser:true},{hash:'#synthesis',arrayResponse:true},{hash:'#synthesis',failHistory:true}
])await bootCase(scenario);
console.log('PASS workspace boot: 9 deferred-auth/tenant cases; actual boot/tab/load/fetch functions; no external requests or writes.');
