// Actual page helpers and continuation handlers; fabricated DOM/auth/API only.
// No HTTP, credentials, acceptance records, billing or Workspace writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sourceBeforeSigninSessionRefresh,SIGNIN_SESSION_PRIOR_SHA256} from './signin_session_refresh_inverse.mjs';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const manifest = JSON.parse(read('legal-document-manifest.json'));
const v1 = '2026-09-11-ai-evidence-v1', v2 = '2026-09-12-ai-source-evidence-v2';
const currentTerms = '2026-09-19-invitation-access', v3 = currentTerms;
const docs = (version,termsVersion=currentTerms) => ({ok:true, requiresAcceptance:true, termsVersion, privacyNoticeVersion:version});
let checks = 0;
const eq = (a,b,label) => {assert.deepEqual(a,b,label);checks++;};
const ok = (value,label) => {assert.ok(value,label);checks++;};
const plain = value => JSON.parse(JSON.stringify(value));
function between(source,start,end){const i=source.indexOf(start),j=source.indexOf(end,i);assert(i>=0&&j>i);return source.slice(i,j);}
function element(){
  const classes=new Set();return {href:'',hidden:false,checked:false,disabled:false,value:'',textContent:'',dataset:{},listeners:{},
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},
    addEventListener(name,fn){this.listeners[name]=fn;},focus(){this.focused=true;}};
}
const helpers=[];
for(const file of ['signin.html','pattern-trial.html']){
  const source=read(file),helper=between(source,'    function legalDocumentPath(kind, version){','    function setExactLegalDocumentLinks');
  helpers.push(helper);const ctx=vm.createContext({});vm.runInContext(helper,ctx);
  const actual=[];
  for(const [version,record] of Object.entries(manifest.documents))for(const [kind,key] of [['terms','terms_file'],['privacy','privacy_notice_file']]){
    if(record[key]){eq(ctx.legalDocumentPath(kind,version),record[key],file+' exact archive');ok(fs.existsSync(new URL('../'+record[key],import.meta.url)));actual.push(record[key]);}
    else{assert.throws(()=>ctx.legalDocumentPath(kind,version),/invalid_legal_document_version/);checks++;}
  }
  eq(actual.length,19,'complete explicit archive inventory');
  for(const [kind,version] of [['privacy','2099-01-01-beta'],['privacy','2026-09-12-ai-source-evidence-v3'],['terms',v2],['privacy','../privacy'],['privacy',v2+'.html'],['privacy',v2+'?x=1'],['privacy',v2+'#x'],['privacy',' '+v2],['privacy',null],['privacy',{}],['__proto__',v2],['constructor',v2],['unknown',v2],[null,v2],[new String('privacy'),v2]]){
    assert.throws(()=>ctx.legalDocumentPath(kind,version),/invalid_legal_document_version/);checks++;
  }
}
eq(helpers[0],helpers[1],'both actual link helpers have the same closed mapping');
const signin=read('signin.html');
const priorSignin=sourceBeforeSigninSessionRefresh('signin.html',signin);
eq(createHash('sha256').update(priorSignin).digest('hex'),SIGNIN_SESSION_PRIOR_SHA256,'Historical sign-in pin is preserved exactly');
eq(sourceBeforeSigninSessionRefresh('pattern-trial.html','untouched'),'untouched','Inverse is scoped to sign-in only');
for(const mutated of [signin+'\n',signin.replace('attempt < 2','attempt < 3'),signin.replace('response.status === 401','response.status === 403'),signin.replace('revision !== legalAuthRevision','revision === legalAuthRevision'),priorSignin]){
  assert.throws(()=>sourceBeforeSigninSessionRefresh('signin.html',mutated),/Only the exact reviewed sign-in source/);checks++;
}
const signCode=between(signin,'    let revealTimer;','    // Are we returning from an OAuth provider?');
for(const scenario of ['v3','v2','v1','beta','legacy_terms','unknown','decline','acceptance_failed']){
  const ui=Object.fromEntries(['legalTermsLink','legalPrivacyLink','sessionCheck','google','emailForm','otpForm','legalAcceptance','legalAgree','legalSubmit','legalDecline','invitationRecovery','emailInput'].map(k=>[k,element()]));
  const calls=[],redirects=[],warnings=[];let forwarded=0,signouts=0;
  const termsVersion=scenario==='legacy_terms'?'2026-09-09-beta':currentTerms;
  const version=scenario==='v1'?v1:scenario==='beta'?'2026-09-10-beta':scenario==='unknown'?'2099-01-01-beta':scenario==='v2'?v2:v3;
  const ctx=vm.createContext({ui,forwarded:false,nextTarget:'workspace.html',invitationMode:false,API_BASE:'https://mock.invalid',
    URLSearchParams,clearTimeout(){},clearPendingOtp(){},revealForm(){},setStatus(){},acceptanceContext:()=>({source:'signup'}),
    forwardOn:()=>forwarded++,document:{querySelector:()=>element()},window:{location:{replace:x=>redirects.push(x)}},
    sessionStorage:{removeItem(){}},INVITE_STORAGE_KEY:'mock',AUTH_CONTEXT_STORAGE_KEY:'mock',
    console:{warn:(...x)=>warnings.push(x)},supabase:{auth:{signOut:async()=>{signouts++;return {};},getSession:async()=>({data:{session:{user:{id:'mock-user'},access_token:'mock-token'}}})}},
    fetch:async(url,options={})=>{calls.push({url,options});const failed=options.method==='POST'&&scenario==='acceptance_failed';return {ok:!failed,json:async()=>options.method==='POST'?{ok:!failed}:docs(version,termsVersion)};}});
  vm.runInContext(signCode,ctx);
  await ctx.continueAfterAuth({user:{id:'mock-user'},access_token:'mock-token'});
  eq(calls.length,1,'link discovery cannot record acceptance');
  eq(ui.legalAgree.checked,false,'no automatic acknowledgement');
  if(scenario==='unknown'){
    eq(ui.legalAcceptance.classList.contains('show'),false);eq(vm.runInContext('currentDocuments',ctx),null);
    ui.legalAgree.checked=true;await ui.legalSubmit.listeners.click();eq(calls.length,1);eq(forwarded,0);ok(warnings.length>0);continue;
  }
  eq(ui.legalAcceptance.classList.contains('show'),true,'current edition reaches actual acknowledgement form');
  eq(ui.legalPrivacyLink.href,'privacy-'+version+'.html');eq(ui.legalTermsLink.href,'terms-'+termsVersion+'.html');ok(ui.legalAgree.focused);
  await ui.legalSubmit.listeners.click();eq(calls.length,1,'unchecked submit cannot record');
  if(scenario==='decline'){await ui.legalDecline.listeners.click();eq(signouts,1);eq(redirects,['index.html']);eq(calls.length,1);eq(forwarded,0);continue;}
  ui.legalAgree.checked=true;await ui.legalAgree.listeners.change();await ui.legalSubmit.listeners.click();
  eq(calls.length,3);eq(calls[2].url,'https://mock.invalid/api/legal/acceptance');
  eq(JSON.parse(calls[2].options.body),{agreed:true,source:'signup',terms_version:termsVersion,privacy_notice_version:version});
  eq(forwarded,scenario==='acceptance_failed'?0:1,'failure cannot forward');
}
// Execute the released page's actual acceptance and auth-event handlers. The
// SDK/API boundary is synthetic; no copied implementation or live acceptance.
const authEvents=between(signin,'    supabase.auth.onAuthStateChange((event, session) => {','    // Safety net:');
const session=(token='current-token',id='mock-user')=>({user:{id},access_token:token});
const response=(status=200,body={ok:true})=>({ok:status>=200&&status<300,status,json:async()=>body});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function signInHarness(options={}){
  const ui=Object.fromEntries(['legalTermsLink','legalPrivacyLink','sessionCheck','google','emailForm','otpForm','legalAcceptance','legalAgree','legalSubmit','legalDecline','invitationRecovery','emailInput'].map(k=>[k,element()]));
  const calls=[],redirects=[],statuses=[],timers=[];let current=session('page-load-token'),refreshes=0,reads=0,authEvent;
  const auth={
    getSession:async()=>{reads++;return options.getSession?options.getSession(reads,current):{data:{session:current}};},
    refreshSession:async()=>{refreshes++;if(options.refresh)return options.refresh(current);current=session('refreshed-token');authEvent('TOKEN_REFRESHED',current);return {data:{session:current}};},
    onAuthStateChange:fn=>{authEvent=fn;},signOut:async()=>{current=null;authEvent('SIGNED_OUT',null);return {};}
  };
  const ctx=vm.createContext({ui,forwarded:false,nextTarget:'workspace-diagnostics.html#campaigns',invitationMode:true,API_BASE:'https://mock.invalid',
    URLSearchParams,clearTimeout(){},setTimeout(fn){timers.push(fn);},clearPendingOtp(){},revealForm(){},
    setStatus:(...x)=>statuses.push(x),acceptanceContext:()=>({source:'invite',inviteToken:'mock-private-invitation'}),
    forwardOn:()=>{ctx.forwarded=true;redirects.push(ctx.nextTarget);},document:{querySelector:()=>element()},
    window:{location:{replace:x=>redirects.push(x)},MondermanDVJourneyRecovery:{bindAuthenticatedReturn:options.bind||(()=>{}),clearPending(){}}},
    sessionStorage:{removeItem(){}},INVITE_STORAGE_KEY:'mock-invite',AUTH_CONTEXT_STORAGE_KEY:'mock-auth',console:{warn(){}},supabase:{auth},
    fetch:async(url,request={})=>{
      calls.push({url,request});
      if(calls.length===1&&!options.initialResponse)return response(200,docs(v3));
      if(calls.length===1)return options.initialResponse();
      if(options.fetch){const value=await options.fetch(url,request,calls);if(value)return value;}
      return response(200,request.method==='POST'?{ok:true}:docs(v3));
    }});
  vm.runInContext(signCode+'\n'+authEvents,ctx);
  const h={ui,calls,redirects,statuses,ctx,
    setSession(value){current=value;},event(event,value){current=value;authEvent(event,value);},
    async flush(){while(timers.length){timers.shift()();await new Promise(r=>setImmediate(r));}},
    get refreshes(){return refreshes;},get reads(){return reads;},
    posts:()=>calls.filter(x=>x.request.method==='POST'),
    check(){ui.legalAgree.checked=true;ui.legalAgree.listeners.change();},
    click:()=>ui.legalSubmit.listeners.click(),
    start:()=>ctx.continueAfterAuth(session('page-load-token'))};
  if(!options.deferStart)await h.start();
  return h;
}
let sessionCases=0;
function invariant(h){
  for(const call of h.calls){
    const url=new URL(call.url);eq(url.origin,'https://mock.invalid');
    if(call.request.method==='POST'){
      eq(url.pathname,'/api/legal/acceptance');
      eq(JSON.parse(call.request.body),{agreed:true,source:'invite',invite_token:'mock-private-invitation',terms_version:currentTerms,privacy_notice_version:v3});
    }else{eq(url.pathname,'/api/legal/acceptance/status');eq(url.searchParams.get('source'),'invite');eq(url.searchParams.get('invite_token'),'mock-private-invitation');}
  }
  sessionCases++;
}
{
  const h=await signInHarness();h.setSession(session('auto-refreshed-token'));
  eq(h.posts().length,0);h.check();await h.click();
  eq(h.posts().length,1);eq(h.posts()[0].request.headers.authorization,'Bearer auto-refreshed-token');
  eq(h.refreshes,0);eq(h.redirects,['workspace-diagnostics.html#campaigns']);invariant(h);
}
for(const expiredAt of ['status','post']){
  let failed=false;
  const h=await signInHarness({fetch:async(_url,req)=>{if(!failed&&(expiredAt==='post')===(req.method==='POST')){failed=true;return response(401,{ok:false,error:'sign_in_required'});}}});
  h.check();await h.click();eq(h.refreshes,1);eq(h.posts().length,expiredAt==='post'?2:1);
  eq(h.posts().at(-1).request.headers.authorization,'Bearer refreshed-token');eq(h.redirects.length,1);invariant(h);
}
{
  const h=await signInHarness({fetch:async()=>response(401,{ok:false,error:'sign_in_required'})});
  h.check();await h.click();eq(h.refreshes,1);eq(h.calls.length,3);eq(h.posts().length,0);eq(h.redirects.length,0);invariant(h);
}
{
  let statusCalls=0;
  const h=await signInHarness({fetch:async(_url,req)=>{if(req.method==='POST')return response(401,{ok:false});if(++statusCalls===1)return response(401,{ok:false});}});
  h.check();await h.click();eq(h.refreshes,1);eq(h.posts().length,1);eq(h.redirects.length,0);invariant(h);
}
for(const next of [null,session('wrong-user-token','other-user'),{user:{id:'mock-user'}}]){
  const h=await signInHarness();h.setSession(next);h.check();await h.click();
  eq(h.calls.length,1);eq(h.posts().length,0);eq(h.refreshes,0);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
for(const refresh of [async()=>({error:Error('refresh failed'),data:{session:null}}),async()=>({data:{session:null}}),async()=>({data:{session:session('wrong-user','other-user')}}),async()=>{throw Error('refresh transport');}]){
  const h=await signInHarness({fetch:async()=>response(401,{ok:false}),refresh});h.check();await h.click();
  eq(h.refreshes,1);eq(h.calls.length,2);eq(h.posts().length,0);eq(h.redirects.length,0);invariant(h);
}
for(const status of [400,403,409,429,500,503])for(const stage of ['status','post']){
  const h=await signInHarness({fetch:async(_url,req)=>{if((stage==='post')===(req.method==='POST'))return response(status,{ok:false,error:'rejected'});}});
  h.check();await h.click();eq(h.refreshes,0);eq(h.posts().length,stage==='post'?1:0);eq(h.redirects.length,0);invariant(h);
}
for(const stage of ['status','post']){
  const h=await signInHarness({fetch:async(_url,req)=>{if((stage==='post')===(req.method==='POST'))throw TypeError('network failure');}});
  h.check();await h.click();eq(h.refreshes,0);eq(h.posts().length,stage==='post'?1:0);eq(h.redirects.length,0);invariant(h);
}
for(const changed of [docs(v2),docs(v3,'2026-09-19-invited-evaluation'),docs('2099-01-01-beta')]){
  const h=await signInHarness({fetch:async()=>response(200,changed)});h.check();await h.click();
  eq(h.posts().length,0);eq(h.ui.legalAgree.checked,false);eq(h.ui.legalSubmit.disabled,true);eq(h.refreshes,0);eq(h.redirects.length,0);invariant(h);
}
for(const version of [v3,v2]){
  const h=await signInHarness({fetch:async(_url,req)=>!req.method?response(200,{...docs(version),requiresAcceptance:false}):undefined});
  h.check();await h.click();eq(h.posts().length,version===v3?1:0);eq(h.redirects.length,version===v3?1:0);
  if(version!==v3)eq(h.ui.legalAgree.checked,false);invariant(h);
}
{
  const h=await signInHarness({getSession:async(n)=>({data:{session:n===1?session():session('changed-before-post','other-user')}})});
  h.check();await h.click();eq(h.calls.length,2);eq(h.posts().length,0);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
{
  const h=await signInHarness({getSession:async()=>({data:{session:null},error:Error('session unavailable')})});
  h.check();await h.click();eq(h.posts().length,0);eq(h.refreshes,0);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
for(const readNumber of [1,2]){
  let h;
  h=await signInHarness({getSession:async(n)=>{
    const value=session();
    if(n===readNumber)Object.defineProperty(value,'access_token',{get(){queueMicrotask(()=>h.event('SIGNED_OUT',null));return 'same-user-token';}});
    return {data:{session:value}};
  }});
  h.check();await h.click();eq(h.calls.length,readNumber);eq(h.posts().length,0);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
{
  let posts=0;
  const h=await signInHarness({fetch:async(_url,req)=>req.method==='POST'?(posts++,response(401,{ok:false})):response(200,posts?docs(v2):docs(v3))});
  h.check();await h.click();eq(h.posts().length,1);eq(h.refreshes,1);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
{
  const h=await signInHarness({fetch:async(_url,req)=>req.method==='POST'?response(409,{ok:false,error:'legal_document_version_changed'}):undefined});
  h.check();await h.click();eq(h.posts().length,1);eq(h.refreshes,0);eq(h.ui.legalAgree.checked,false);eq(h.ui.legalSubmit.disabled,true);eq(h.redirects.length,0);invariant(h);
}
{
  const gate=deferred();const h=await signInHarness({getSession:async()=>gate.promise});h.check();
  const first=h.click();await h.click();await h.ui.legalDecline.listeners.click();
  eq(h.ui.legalAgree.disabled,true);eq(h.ui.legalDecline.disabled,true);eq(h.reads,1);
  gate.resolve({data:{session:session()}});await first;eq(h.posts().length,1);eq(h.redirects.length,1);invariant(h);
}
for(const event of ['SIGNED_OUT','SIGNED_IN'])for(const stage of ['session','status','post','refresh']){
  const gate=deferred();let held=false;
  const h=await signInHarness({
    getSession:async(_n,value)=>{if(stage==='session'&&!held){held=true;return gate.promise;}return {data:{session:value}};},
    refresh:stage==='refresh'?async()=>{held=true;return gate.promise;}:undefined,
    fetch:async(_url,req)=>{if(stage==='refresh')return response(401,{ok:false});if(!held&&((stage==='post'&&req.method==='POST')||(stage==='status'&&!req.method))){held=true;return gate.promise;}}
  });
  h.check();const pending=h.click();while(!held)await new Promise(r=>setImmediate(r));
  h.event(event,event==='SIGNED_OUT'?null:session('new-account','other-user'));
  gate.resolve(stage==='session'||stage==='refresh'?{data:{session:session('stale')}}:response(200,stage==='post'?{ok:true}:docs(v3)));
  await pending;eq(h.posts().length,stage==='post'?1:0);eq(h.ui.legalAgree.checked,false);eq(h.redirects.length,0);invariant(h);
}
{
  const gate=deferred();let held=false;
  const h=await signInHarness({fetch:async(_url,req)=>{if(req.method==='POST'&&!held){held=true;return {ok:true,status:200,json:()=>gate.promise};}}});
  h.check();const pending=h.click();while(!held)await new Promise(r=>setImmediate(r));
  h.event('SIGNED_IN',session('other-account','other-user'));await h.flush();
  eq(h.ui.legalAgree.checked,false);eq(h.ui.legalSubmit.disabled,true);
  gate.resolve({ok:true});await pending;eq(h.redirects.length,0);eq(h.ui.legalAgree.checked,false);eq(h.ui.legalSubmit.disabled,true);invariant(h);
}
{
  const h=await signInHarness();h.check();h.event('TOKEN_REFRESHED',session('event-refreshed'));await h.flush();
  eq(h.ui.legalAgree.checked,true);eq(h.calls.length,1);eq(h.posts().length,0);await h.click();
  eq(h.posts()[0].request.headers.authorization,'Bearer event-refreshed');invariant(h);
}
{
  const h=await signInHarness();h.check();h.event('SIGNED_OUT',null);h.event('SIGNED_IN',session('same-user-new-signin'));await h.flush();
  eq(h.ui.legalAgree.checked,false);await h.click();eq(h.posts().length,0);eq(h.redirects.length,0);invariant(h);
}
{
  const gate=deferred();const h=await signInHarness({deferStart:true,initialResponse:()=>gate.promise});
  const pending=h.start();await new Promise(r=>setImmediate(r));h.event('SIGNED_OUT',null);gate.resolve(response(200,{...docs(v3),requiresAcceptance:false}));
  await pending;eq(h.redirects.length,0);eq(h.ui.legalAcceptance.classList.contains('show'),false);invariant(h);
}
{
  const gate=deferred();const h=await signInHarness({deferStart:true,bind:()=>gate.promise});
  const pending=h.start();h.event('SIGNED_OUT',null);gate.resolve();await pending;
  eq(h.calls.length,0);eq(h.redirects.length,0);invariant(h);
}
{
  const h=await signInHarness({deferStart:true});h.event('SIGNED_IN',session());h.event('SIGNED_OUT',null);await h.flush();
  eq(h.calls.length,0);eq(h.posts().length,0);eq(h.redirects.length,0);invariant(h);
}
// Execute the complete existing trial module, including initial discovery and
// its real guarded click handler. All API responses below are explicit mocks.
const trial=read('pattern-trial.html').match(/<script type="module">([\s\S]*?)<\/script>/)[1];
for(const scenario of ['v3','v2','v1','changed','legacy_terms','terms_changed','unknown','acceptance_failed']){
  const els=new Map(),get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
  get('organizationSelect').hidden=true;get('ackStart').disabled=true;
  const calls=[],redirects=[];let rpcCalls=0;
  const termsVersion=['legacy_terms','terms_changed'].includes(scenario)?'2026-09-09-beta':currentTerms;
  const initial=scenario==='unknown'?'2099-01-01-beta':scenario==='v1'||scenario==='changed'?v1:scenario==='v2'?v2:v3;
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'mock-user'},access_token:'mock-token'}}})},rpc:async()=>{rpcCalls++;throw Error('unexpected mock RPC');}};
  const ctx=vm.createContext({window:{supabase:{createClient:()=>client}},document:{getElementById:get},
    location:{search:'',replace:x=>redirects.push(x)},sessionStorage:{getItem:()=>null,setItem(){}},URLSearchParams,Date,
    setTimeout(){},fetch:async(url,options={})=>{
      calls.push({url,options});let body;
      if(url.includes('/pattern-pilot-invitation'))body={ok:true,invitation:{recipientName:'MOCK'}};
      else if(url.includes('/legal/acceptance/status'))body=docs(url.includes('source=trial')&&scenario==='changed'?v3:initial,url.includes('source=trial')&&scenario==='terms_changed'?currentTerms:termsVersion);
      else if(url.includes('/billing/organizations?'))body={ok:true,organizations:[{id:'mock-org',name:'MOCK Workspace'}]};
      else if(url.endsWith('/legal/acceptance'))body={ok:scenario!=='acceptance_failed'};
      else if(url.endsWith('/start-pattern-trial'))body={ok:true};else throw Error('unexpected mock URL');
      return {ok:body.ok,status:body.ok?200:503,json:async()=>body};
    }});
  await vm.runInContext('(async()=>{'+trial+'})()',ctx);
  eq(calls.filter(x=>x.options.method==='POST').length,0,'trial discovery cannot activate or record');
  eq(get('ackStart').checked,false);await get('startBtn').listeners.click();eq(calls.filter(x=>x.options.method==='POST').length,0);
  if(scenario==='unknown'){eq(get('ackStart').disabled,true);eq(get('startBtn').disabled,true);eq(calls.length,2);continue;}
  eq(get('trialPrivacyLink').href,'privacy-'+initial+'.html');eq(get('ackStart').disabled,false);
  get('ackStart').checked=true;await get('ackStart').listeners.change();await get('startBtn').listeners.click();
  const posts=calls.filter(x=>x.options.method==='POST');
  if(scenario==='changed'||scenario==='terms_changed'){
    eq(posts.length,0,'version transition requires another explicit choice');eq(get('ackStart').checked,false);eq(get('startBtn').disabled,true);eq(get('trialPrivacyLink').href,'privacy-'+v3+'.html');eq(get('trialTermsLink').href,'terms-'+currentTerms+'.html');
  }else{
    eq(posts.length,scenario==='acceptance_failed'?1:2);
    eq(JSON.parse(posts[0].options.body),{agreed:true,source:'trial',organization_id:'mock-org',terms_version:termsVersion,privacy_notice_version:initial});
    if(posts.length===2){eq(posts[1].url,'https://monderman-api.onrender.com/api/billing/start-pattern-trial');eq(JSON.parse(posts[1].options.body),{organization_id:'mock-org'});}
  }
  eq(rpcCalls,0);eq(redirects,[]);
}
console.log(JSON.stringify({status:'PASS_MOCK_ONLY',checks,sessionCases,networkCalls:0,acceptancesCreated:0,billingCalls:0,scope:'Both exact archive helpers, actual sign-in continuation/decline/submit/auth events, bounded refresh and race cases, and complete trial module with fabricated transports; no real consent or activation.'}));
