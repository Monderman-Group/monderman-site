// Public copy + actual checkout-module regression. All services are local mocks.
// This does not create a Checkout Session, authenticate a person, or certify tax setup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let assertions=0;
const check=(condition,label)=>{assert.ok(condition,label);assertions++;};
const checkout=read('checkout.html');
const script=checkout.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
check(Boolean(script),'one actual checkout module found');
check(/id="annualCommitmentAccepted" required/.test(checkout),'annual acknowledgment is required');
check(!/id="annualCommitmentAccepted"[^>]*checked/.test(checkout),'not prechecked');
check(checkout.includes('annual_commitment_acceptance_required'),'server missing-acceptance error is explained');
check(/\.billing-field\{display:flex;flex-direction:column;min-width:0;gap:5px\}/.test(checkout),'helper text does not stretch independent label and control tracks');
check(/\.billing-field input,\.billing-field select\{[^}]*height:46px;min-height:44px/.test(checkout),'all billing controls share a fixed accessible touch height');
check(/\.billing-field label\{min-height:2\.8em/.test(checkout)&&checkout.includes('.billing-field label{min-height:1.4em}'),'paired desktop labels align and single-column phone labels use natural spacing');

async function mount({tier='signal',interval='monthly',session=true,organizations=[{id:'org-A',name:'Workspace A'}],response={ok:true,status:200,body:{url:'https://checkout.example.test/mock'}}}={}){
  const elements=new Map(), requests=[], storage=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{
    value:'',checked:false,disabled:false,hidden:false,style:{},textContent:'',innerHTML:'',
    listeners:{},valid:true,focused:false,checkValidity(){return this.valid;},focus(){this.focused=true;},
    addEventListener(event,fn){this.listeners[event]=fn;},replaceChildren(){},add(){}
  });return elements.get(id);};
  element('billingCountry').value='US'; element('billingRegion').value='sd';
  const location={search:'?tier='+tier+'&interval='+interval,href:'',replace(url){this.href=url;}};
  const context={
    window:{mondermanWorkspaceAccessReady:Promise.resolve({allowed:true}),mondermanGetSupabaseClient:async()=>({auth:{getSession:async()=>({data:{session:session?{access_token:'LOCAL-MOCK-TOKEN'}:null}})}})},
    document:{getElementById:element},location,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    URLSearchParams,console,Option:class{constructor(text,value){Object.assign(this,{text,value});}},
    fetch:async(url,options={})=>{
      requests.push({url,options});
      if(url.includes('/api/billing/organizations?'))return {ok:organizations.length>0,json:async()=>({ok:organizations.length>0,organizations,error:organizations.length?'':'checkout_requires_admin'})};
      check(url.endsWith('/api/billing/create-checkout-session'),'only expected checkout POST in mock');
      return {ok:response.ok,status:response.status,json:async()=>response.body};
    }
  };
  await vm.runInNewContext('(async()=>{'+script+'})()',context);
  for(let i=0;i<20;i++)await Promise.resolve();
  return {el:element,requests,location,storage,async change(id){await element(id).listeners.change?.();},async click(){await element('payBtn').listeners.click?.();}};
}
for(const [tier,interval,price,total] of [
  ['signal','monthly','$2,000','$24,000'],['signal','annual','$21,600','12 months'],
  ['pattern','monthly','$4,500','$54,000'],['pattern','annual','$48,600','12 months']
]){
  const m=await mount({tier,interval});
  check(m.el('priceLine').innerHTML.includes(price)&&m.el('priceLine').innerHTML.includes(total),tier+'/'+interval+' exact display');
  check(m.el('payBtn').disabled,'unchecked cannot pay');
  await m.click();
  check(m.requests.length===1&&m.el('annualCommitmentAccepted').focused,'unchecked click does not create checkout');
  m.el('annualCommitmentAccepted').checked=true;await m.change('annualCommitmentAccepted');
  check(!m.el('payBtn').disabled,'checked authorized Workspace can continue');
  m.el('billingEmail').value='invalid';m.el('billingEmail').valid=false;await m.el('billingEmail').listeners.input();
  check(m.el('payBtn').disabled,'invalid optional email still prevents button');
  m.el('billingEmail').value='';await m.el('billingEmail').listeners.input();
  await m.click();
  const post=m.requests.at(-1),body=JSON.parse(post.options.body);
  check(post.options.method==='POST'&&post.options.headers.authorization==='Bearer LOCAL-MOCK-TOKEN','auth transport retained');
  check(body.annual_commitment_accepted===true&&body.organization_id==='org-A'&&body.tier===tier&&body.interval===interval,'server acknowledgment and exact selected Workspace sent');
  check(body.billing_country==='US'&&body.billing_region==='SD'&&!('amount' in body)&&!('price' in body),'location preserved; no browser-authoritative amount');
  check(m.location.href==='https://checkout.example.test/mock','only mock checkout redirect');
}
for(const opts of [{interval:'quarterly'},{tier:'unrecognized'},{session:false},{organizations:[]}]){
  const m=await mount(opts);m.el('annualCommitmentAccepted').checked=true;await m.change('annualCommitmentAccepted');await m.click();
  check(!m.requests.some(r=>r.url.endsWith('/create-checkout-session')),'invalid selection/session/admin eligibility does not create checkout');
}
const rejected=await mount({response:{ok:false,status:400,body:{error:'annual_commitment_acceptance_required'}}});
rejected.el('annualCommitmentAccepted').checked=true;await rejected.change('annualCommitmentAccepted');await rejected.click();
check(rejected.el('errorPanel').textContent.includes('12-month subscription commitment'),'server rechecks acceptance');
check(!rejected.location.href,'server rejection does not redirect');

for(const [f,prices,pool,synth] of [
  ['plan-signal.html',['$2,000','$24,000','$21,600'],'2,400','60'],
  ['plan-pattern.html',['$4,500','$54,000','$48,600'],'6,000','300']
]){
  const s=read(f);
  for(const price of prices)check(s.includes(price),f+' price '+price);
  check(s.includes(pool+' completed participant responses a year')&&s.includes(synth+' new Syntheses'),f+' annual capacity');
  check(s.includes('full allowance')&&s.includes('start of each annual term'),f+' capacity upfront');
  check(s.includes('authorized Workspace users are unlimited'),f+' self-runs');
  check(s.includes('Reopening and exporting saved reports does not use'),f+' saved reading not new Synthesis');
  check(s.includes('not installments owed for the current annual commitment'),f+' cancellation annual not monthly');
  check(!s.includes('interval=quarterly')&&!s.includes('effective end of the paid period')&&!s.includes('each billing period'),f+' no stale quarterly/month-to-month offer');
}
const matrix=read('platform-services.html');
for(const phrase of ['2,400','6,000','60 new Syntheses','300 new Syntheses','$21,600','$48,600','No automatic overage','Diagnostic scores do not supply a recovery percentage'])check(matrix.includes(phrase),'matrix '+phrase);
check(!/5(?:–|-|&ndash;| to )42/.test(matrix),'no assigned score-based recovery percentage');
for(const f of ['pilot.html','pattern-trial.html']){
  const s=read(f);
  check(s.includes('500')&&s.includes('300 new Syntheses')&&s.includes('separate from'),f+' pilot capacity remains distinct');
  check(/unlimited/i.test(s)&&s.includes('30-day'),f+' existing temporary unlimited Synthesis policy retained');
}
for(const [f,key] of [['structural-clarity','sc'],['decision-velocity','dv'],['operational-systems','os'],['institutional-performance','ip']]){
  const s=read(f+'-article.html');
  check(s.includes('sample-report.html#'+key),'actual sample link '+key);
  check(!s.includes('Example score')&&!s.includes('Example band'),'no arbitrary example score '+key);
  check(s.includes('realistic example responses')&&s.includes('One participant can complete more than one Diagnostic'),key+' scope explanation');
}
for(const f of ['security.html','pilot.html','pattern-trial.html']){
  check(read(f).includes('Anthropic')&&!read(f).includes('Claude '),f+' provider disclosure without model name');
}
check(read('privacy.html')===read('privacy-2026-09-12-ai-source-evidence-v2.html'),'accepted Privacy edition remains byte-identical; provider brand is not a model version');
for(const f of ['index.html','research.html','why-monderman.html']){
  const text=read(f).replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ');
  check(!/peer-reviewed.{0,60}(?:book|Routledge)/i.test(text),f+' authorship not validation');
}
const method=read('diagnostics.html'),brief=read('Monderman_Platform_Brief.html');
for(const s of [method,brief])for(const link of ['https://aapor.org/standards-and-ethics/standard-definitions/','https://www.gao.gov/products/gao-20-195g'])check(s.includes(link),'selected guidance source link retained');
check(method.includes('not endorsement, certification, or validation'),'no methodological endorsement claim');
check(read('terms.html').includes('Existing customers retain the pricing, billing intervals and allowances'),'legacy terms preserved');
check(!read('institutional-performance.html').includes('formerly inline 42/28 cutoffs'),'non-executable old recipe comment removed');
const markPattern=/<svg\b[^>]*class="[^"]*monderman-lockup__mark[^"]*"[^>]*>[\s\S]*?<\/svg>/g;
const approvedMark=[...read('site-shell/header.html').matchAll(markPattern)][0]?.[0];
check(Boolean(approvedMark),'approved shared header mark exists');
for(const file of ['signin.html','workspace.html','workspace-actions.html','workspace-analysis.html','workspace-diagnostics.html','workspace-settings.html']){
  const marks=[...read(file).matchAll(markPattern)];
  check(marks.length===1&&marks[0][0]===approvedMark,file+' uses the exact approved even-bottom mark');
}
console.log(JSON.stringify({status:'PASS',assertions,checkoutModuleScenarios:9,networkCalls:0,providerCalls:0,paymentSessionsCreated:0}));
