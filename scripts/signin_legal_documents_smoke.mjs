// Actual page helpers and continuation handlers; fabricated DOM/auth/API only.
// No HTTP, credentials, acceptance records, billing or Workspace writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
    console:{warn:(...x)=>warnings.push(x)},supabase:{auth:{signOut:async()=>{signouts++;return {};}}},
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
  eq(calls.length,2);eq(calls[1].url,'https://mock.invalid/api/legal/acceptance');
  eq(JSON.parse(calls[1].options.body),{agreed:true,source:'signup',terms_version:termsVersion,privacy_notice_version:version});
  eq(forwarded,scenario==='acceptance_failed'?0:1,'failure cannot forward');
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
console.log(JSON.stringify({status:'PASS_MOCK_ONLY',checks,networkCalls:0,acceptancesCreated:0,billingCalls:0,scope:'Both exact archive helpers, actual sign-in continuation/decline/submit and complete trial module with fabricated transports; no real consent or activation.'}));
