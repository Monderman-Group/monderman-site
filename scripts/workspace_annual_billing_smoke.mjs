// Actual HTML module helpers in their own lexical scope; services are local mocks.
// No auth, provider, Stripe session, or subscription operation is performed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
let assertions=0;
const check=(ok,label)=>{assert.ok(ok,label);assertions++;};
const c={offerVersion:'2026-09-15-annual-v1',termStartedAt:'2026-09-15T12:00:00Z',termEndsAt:'2027-09-15T12:00:00Z',annualCommitment:2400000,currency:'usd',paymentInterval:'monthly',cancellationScheduled:false,cancellationAt:null,respondentPool:2400,synthesisLimit:60};
const baseOrg={id:'org-A',plan:'signal',run_limit:null,respondent_pool:2400,respondents_used:7,aggregation_limit:60,aggregations_used:2};
async function moduleHarness(file,{role='admin',org=baseOrg,commercial=c,session=true,confirm=true,code=null,status=503,deferred=null}={}){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const body=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  check(Boolean(body),file+' module found');
  const settings=file==='workspace-settings.html';
  const entry=settings?'    boot();':'    initialize();';
  check(body.split(entry).length===2,'exactly one module entrypoint');
  const expose=settings?'state,loadBilling,cancelAnnualRenewal,openBillingPortal,renderBilling,validCommercial':'state,renderEntitlements,loadCommercialSummary';
  const source=body.replace(entry,'globalThis.probe={'+expose+'};');
  const nodes=new Map(),requests=[],dialogs=[];
  const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',style:{},dataset:{},listeners:{},classList:{add(){},remove(){}},addEventListener(e,fn){this.listeners[e]=fn;},querySelector(){return null;},appendChild(){}});return nodes.get(id);};
  let activeCommercial=commercial,failCode=code;
  const context={
    window:{mondermanWorkspaceAccessReady:Promise.resolve({allowed:true}),mondermanGetSupabaseClient:async()=>({auth:{getSession:async()=>({data:{session:session?{access_token:'MOCK-ONLY'}:null}})}}),confirm(message){dialogs.push(message);return confirm;},location:{href:''}},
    document:{getElementById:el,createElement:()=>({style:{}})},console,URL,Intl,Date,Number,String,Array,Object,Math,JSON,setTimeout:()=>0,clearTimeout(){},sessionStorage:{setItem(){}},
    fetch:async(url,options)=>{
      requests.push({url,options});
      if(deferred)return deferred(url,options);
      if(failCode)return {ok:false,status,json:async()=>({ok:false,error:failCode})};
      if(url.endsWith('/cancel-renewal'))activeCommercial={...activeCommercial,cancellationScheduled:true,cancellationAt:activeCommercial.termEndsAt};
      const body=url.endsWith('/portal-session')?{ok:true,url:'https://billing.example.test/mock'}:{ok:true,commercial:activeCommercial,nextInstallmentAt:activeCommercial?.paymentInterval==='monthly'?'2026-10-15T12:00:00Z':null,testMode:false};
      return {ok:true,status:200,json:async()=>body};
    }
  };
  await vm.runInNewContext('(async()=>{'+source+'})()',context);
  const p=context.probe;
  Object.assign(p.state,settings?{orgId:org.id,org:{...org},role}:{organization:{...org},role});
  return {p,el,requests,dialogs,context,setError(v){failCode=v;},setCommercial(v){activeCommercial=v;}};
}
for(const interval of ['monthly','annual']){
  const annual=interval==='annual';
  const h=await moduleHarness('workspace-settings.html',{commercial:{...c,paymentInterval:interval,annualCommitment:annual?2160000:2400000}});
  await h.p.loadBilling();
  check(h.el('billingSummary').textContent.includes(annual?'21,600':'24,000'),'correct actual commitment');
  check(h.el('billingTerm').textContent.includes('2027'),'annual end not next installment');
  check(h.el('billingTerm').textContent.includes(annual?'no monthly installments':'Next installment'),'payment option distinct');
  check(h.el('billingRenewal').textContent.includes('installments owed')===!annual,'renewal reminder mentions installments only for monthly payments');
  if(annual)check(h.el('billingRenewal').textContent.includes('current prepaid term'),'prepaid renewal reminder describes the prepaid term');
  check(h.el('billingAllowance').textContent.includes('2,400')&&h.el('billingAllowance').textContent.includes('60')&&h.el('billingAllowance').textContent.includes('no monthly reset'),'capacity upfront');
  check(h.el('billingAllowance').textContent.includes('self-runs are unlimited')&&h.el('billingAllowance').textContent.includes('does not use another Synthesis'),'self vs campaign vs saved report');
  check(!h.el('cancelAnnualRenewal').hidden,'only confirmed current offer shows cancellation');
  await h.p.cancelAnnualRenewal();
  check(h.dialogs.length===1&&h.dialogs[0].includes('Installments owed')===!annual,'confirmation distinguishes prepaid term from outstanding installments');
  check(h.dialogs[0].includes('Access continues until'),'confirmation retains the access end date');
  const post=h.requests.find(r=>r.url.endsWith('/cancel-renewal'));
  check(post.options.method==='POST'&&JSON.parse(post.options.body).organization_id==='org-A','only exact active Workspace cancel body');
  check(post.options.headers.Authorization==='Bearer MOCK-ONLY'&&post.options.headers['X-Monderman-Organization-Id']==='org-A','authenticated tenant binding');
  check(h.el('billingRenewal').textContent.includes('Renewal is off')&&h.el('cancelAnnualRenewal').hidden,'confirmed scheduled state rendered');
  check(h.el('billingRenewal').textContent.includes('Installments owed')===!annual,'scheduled renewal state mentions installments only for monthly payments');
  check(h.el('billingMsg').innerHTML.includes('installments remain payable')===!annual,'success notice mentions installments only for monthly payments');
  if(annual)check(h.el('billingMsg').innerHTML.includes('Access continues until'),'prepaid success notice retains access end date');
  await h.p.cancelAnnualRenewal();
  check(h.requests.filter(r=>r.url.endsWith('/cancel-renewal')).length===1,'no repeat after scheduled');
}
for(const role of ['analyst','member','viewer']){
  const h=await moduleHarness('workspace-settings.html',{role});
  await h.p.loadBilling();await h.p.cancelAnnualRenewal();await h.p.openBillingPortal();
  check(h.requests.length===0&&h.el('billingSummary').textContent.includes('Only a Workspace admin'),'no admin UI request for '+role);
}
for(const org of [{...baseOrg,plan:'trial'},{...baseOrg,plan:'pattern',subscription_status:'trialing',pattern_trial_ends_at:'2099-01-01T00:00:00Z'},{...baseOrg,plan:'pattern',respondent_pool:500,aggregation_limit:null}]){
  const h=await moduleHarness('workspace-settings.html',{org,commercial:null});await h.p.loadBilling();await h.p.cancelAnnualRenewal();
  check(h.el('cancelAnnualRenewal').hidden&&!h.el('billingSummary').textContent.includes('24,000'),'legacy/trial not assigned new annual contract');
  check(!h.requests.some(r=>r.url.endsWith('/cancel-renewal')),'legacy/trial no new cancellation');
  if(org.subscription_status==='trialing')check(h.el('billingAllowance').textContent.includes('500')&&h.el('billingAllowance').textContent.includes('unlimited eligible'),'pilot unchanged');
  if(org.plan==='pattern'&&!org.subscription_status){await h.p.openBillingPortal();check(h.context.window.location.href==='https://billing.example.test/mock','legacy portal retained');}
}
const declined=await moduleHarness('workspace-settings.html',{confirm:false});await declined.p.loadBilling();await declined.p.cancelAnnualRenewal();
check(declined.requests.length===1,'declined confirmation sends no POST');
for(const [code,status,text] of [['permission_denied',403,'Only a Workspace admin'],['session_required',401,'Sign in again'],['organization_selection_required',409,'Choose a Workspace'],['annual_cancellation_requires_support',409,'existing cancellation schedule'],['subscription_not_active',409,'not active'],['annual_billing_portal_unavailable',503,'term and payment obligations are unchanged'],['cancel_renewal_failed',503,'No change is confirmed']]){
  const h=await moduleHarness('workspace-settings.html',{status});await h.p.loadBilling();h.setError(code);await h.p.cancelAnnualRenewal();
  check(h.el('billingMsg').innerHTML.includes(text),'explicit error '+code);
  check(!h.el('billingMsg').innerHTML.includes('was turned off'),'failure no successful cancellation claim');
  const before=h.requests.length;await h.p.cancelAnnualRenewal();check(h.requests.length===before,'unknown/failed cancellation requires refresh');
}
const missing=await moduleHarness('workspace-settings.html',{session:false});await missing.p.loadBilling();
check(missing.requests.length===0&&missing.el('billingSummary').textContent.includes('Sign in again'),'missing session no request');
for(const commercial of [{...c,annualCommitment:'2400000'},{...c,termEndsAt:null},{...c,offerVersion:'other'},{...c,cancellationScheduled:true,cancellationAt:null}]){
  const h=await moduleHarness('workspace-settings.html',{commercial});await h.p.loadBilling();
  check(h.el('cancelAnnualRenewal').hidden&&h.el('billingSummary').textContent.includes('could not be confirmed'),'malformed summary fails closed');
}
let resolveRead;
const stale=await moduleHarness('workspace-settings.html',{deferred:()=>new Promise(resolve=>{resolveRead=resolve;})});
const waiting=stale.p.loadBilling();for(let i=0;i<5;i++)await Promise.resolve();
stale.p.state.orgId='org-B';resolveRead({ok:true,status:200,json:async()=>({ok:true,commercial:c})});await waiting;
check(stale.p.state.billingOrgId===null&&stale.el('cancelAnnualRenewal').hidden,'old Workspace response never arms another Workspace');
for(const [plan,pool,synth,commercial] of [['signal',2400,60,c],['pattern',6000,300,{...c,respondentPool:6000,synthesisLimit:300}],['pattern',500,null,null],['trial',0,1,null]]){
  const org={...baseOrg,plan,respondent_pool:pool,aggregation_limit:synth,run_limit:plan==='trial'?3:null};
  const h=await moduleHarness('workspace.html',{org,commercial});h.p.renderEntitlements();await h.p.loadCommercialSummary();
  check(h.el('wsPlanStrip').innerHTML.includes(plan==='trial'?'self-runs used':'Unlimited self-runs'),'overview self allowance '+plan);
  check(h.el('wsManageLink').href===(plan==='trial'?'platform-services.html?organization_id=org-A':'workspace-settings.html#billing'),'overview routes to right billing surface');
  check(h.el('wsAnnualSummary').textContent.includes('no monthly reset')===Boolean(commercial),'overview annual only from confirmed edition');
}
const scripts=fs.readFileSync(path.join(root,'workspace-settings.html'),'utf8');
check(scripts.includes('async function workspaceDeletionRequest(method, body)')&&scripts.includes('"/api/account/workspace-deletion"'),'deletion route remains separate');
console.log(JSON.stringify({status:'PASS',assertions,networkCalls:0,subscriptionMutations:0,scope:'actual module mock behavior; not live billing proof'}));
