import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
const {chromium,webkit}=await import('playwright');
const site=path.resolve(process.env.SITE_ROOT || path.resolve(import.meta.dirname,'..'));
const here=import.meta.dirname;
const out=process.env.HISTORY_TEST_OUTPUT || path.resolve('output/authoritative-history-browser');fs.mkdirSync(out,{recursive:true});
const tools=['operational-systems','structural-clarity','institutional-performance'];
const osRegistry=JSON.parse(fs.readFileSync(path.join(site,'test-fixtures/os-questionnaire-registry-contract.json')));
const versionsFor=tool=>tool==='operational-systems'?Object.values(osRegistry.versions):tool==='decision-velocity'?['1.0.0','1.1.0']:['1.2.0','1.3.0'];
const runId='11111111-1111-4111-8111-111111111111',assignmentId='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333',organizationId='44444444-4444-4444-8444-444444444444';
const token='fixture-assignment-exact-credential';
const results=[],errors=[];
const hook=String.raw`queueMicrotask(()=>{window.__historyTest={
  snapshot(){return JSON.parse(JSON.stringify({runId:state.runId,configVersion:state.configVersion,currentItem:state.currentItem,questionHistory:state.questionHistory,answerCache:state.answerCache,experiential:state.experiential,confidence:state.preflight.confidenceLevel,sessionRevision:state.sessionRevision,result:state.result,renderPayload:state.renderPayload}));},
  prepareStart(){
    state.mode='managerial';state.depth='60';state.roleForText='managerial';state.runId=null;state.configVersion=null;
    for(const field of PRESTART_FIELDS)state.preflight[field.id]=field.kind==='select'?(field.options.find(option=>option.value && option.value!=='other')?.value||''):field.kind==='number'?12:'Fixture description';
    renderPreflightForm();preStartConsent.checked=true;showStage(introStage,{scroll:false});beginBtn.disabled=false;
    beginBtn.click();
  }
};});
`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html');
 let file=path.resolve(site,'.'+pathname);
 if(!(file.startsWith(site+path.sep)||file.startsWith(here+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 let body=fs.readFileSync(file);
 if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1').replace('function renderQuestion() {',hook+'function renderQuestion() {'));
 res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const clone=value=>JSON.parse(JSON.stringify(value));
function staticItem(tool,version,type) {
 const source=fs.readFileSync(path.join(site,tool+'.html'),'utf8');
 const block=source.slice(source.indexOf('function buildConfidenceQuestion()'),source.indexOf('\nasync function refineExperientialLayerForOutput('));
 const context=vm.createContext({state:{configVersion:version,mode:'managerial'},window:{}});
 vm.runInContext(block+'\nglobalThis.item='+(type==='confidence'?'buildConfidenceQuestion()':'buildExperienceQuestion(1)')+';',context);
 return clone(context.item);
}
function numeric(id,text){return {id,scorerField:id,dimension:'coordination',secondaryDimension:null,role:['managerial'],depth:[60],questionType:'numeric',text:{managerial:text},options:[],isOptional:false};}
function fixture(tool,version,kind,controller) {
 const q1=numeric('accepted-number',version+' original accepted numeric question');
 const qChoice={...numeric('accepted-choice',version+' original accepted choice question'),questionType:'single_select',options:[{value:'yes',label:version+' original yes label'},{value:'no',label:version+' original no label'}]};
 const next=numeric('frontier-number',version+' original next question');
 const history=[{itemId:q1.id,item:q1,value:7,meta:{source:'intake'}},{itemId:qChoice.id,item:qChoice,value:'yes',meta:{source:'participant'}}];
 const staticKind=['optional','confidence','static-mismatch'].includes(kind);
 const finalized=kind==='finalized'||kind==='reused-finalized';
 const remote={ok:true,runId,role:'managerial',depth:60,questionnaire_version:version,configVersion:version,routingVersion:version,
  questionnaire_copy_version:version=== '1.2.0'||version==='1.0.0'?'diagnostic-language-pre-20260908':'diagnostic-language-20260908',
  nextItem:staticKind||finalized?null:next,shouldStop:staticKind||finalized,sessionRevision:3,finalized,
  progress:{answered:2,total:12,progressPercent:17},answerHistory:finalized?[]:history};
 if(kind==='missing-history')delete remote.answerHistory;
 let current=clone(next);
 if(staticKind)current=staticItem(tool,kind==='static-mismatch'?(version==='1.2.0'?'1.3.0':'1.2.0'):version,kind);
 if(kind==='changed-frontier')current.text.managerial='FORGED cached frontier question';
 const stale={...clone(qChoice),text:{managerial:'FORGED cached accepted choice question'},options:[{value:'wrong',label:'FORGED choice'}]};
 const state={mode:'managerial',depth:'60',started:true,runId,configVersion:version,currentItem:current,currentProgress:{answered:99},roleForText:'managerial',
  preflight:{processName:'Fixture unit',businessUnit:'Fixture team',industry:'professional_services',description:'Fixture description',employeeCount:100,peopleInvolved:10,hourlyCost:50,annualVolume:24,meetingHours:2,confidenceLevel:'high',decisionType:'cross_functional',regulatoryIntensity:'moderate'},
  answerCache:{[q1.id]:999,[qChoice.id]:'wrong','phantom-item':'FORGED phantom', [next.id]:'47.25','_*experience*self':'My exact accepted optional note.','**confidenceLevel**':'high'},
  questionHistory:[{item:{...clone(q1),text:{managerial:'FORGED numeric'}},value:999},{item:stale,value:'wrong'},{item:numeric('phantom-item','FORGED phantom question'),value:500}],
  experienceIndex:1,experienceComplete:kind==='confidence',experiential:{self:'My exact accepted optional note.',observedOperational:'My exact unfinished optional note.',observedManagerial:'',observedSeniorLeader:''}};
 if(staticKind && kind!=='confidence')state.answerCache[current.id]='My exact unfinished optional note.';
 const controls=[{root:'questionStage',id:'field_'+current.id,name:'',index:0,nameIndex:-1,type:staticKind?'textarea':'text',value:staticKind?'My exact unfinished optional note.':'48.25',checked:false}];
 const toolType=tool.replaceAll('-','_');
 let key,saved,indexKey;
 if(controller==='assignment'){
  key='monderman.assignmentDraft.v1.'+assignmentId;indexKey='monderman.assignmentDraft.activeKey.v1';
  saved={version:1,assignment_id:assignmentId,tool_type:toolType,anonymous:finalized,saved_at:new Date().toISOString(),active_stage:'questionStage',state,controls};
 }else{
  const prefix='monderman.selfDiagnosticDraft.v1.'+userId+'.'+organizationId+'.'+toolType+'.';
  key=prefix+version+'.'+runId;indexKey=prefix+'active';
  saved={version:1,key,user_id:userId,organization_id:organizationId,tool:toolType,config_version:version,draft_id:runId,saved_at:new Date().toISOString(),state};
 }
 return {remote,history,next,current,state,key,indexKey,saved,raw:JSON.stringify(saved),toolType,finalized};
}
async function runCase(browser,engine,tool,version,kind,controller='assignment') {
 const f=fixture(tool,version,kind,controller),requests=[],pageErrors=[],observed=[];
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(({userId,organizationId,seed})=>{
  window.__fixtureAuth={auth:{getSession:async()=>({data:{session:{access_token:'fixture-auth-only',user:{id:userId}}}}),getUser:async()=>({data:{user:{id:userId}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
  window.supabase={createClient:()=>window.__fixtureAuth};
  window.__mondermanActiveOrganizationId=organizationId;
  if(seed){sessionStorage.setItem(seed.key,seed.raw);sessionStorage.setItem(seed.indexKey,seed.key);}
  window.__seenQuestionTexts=[];window.__seenReport=false;
  document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(()=>{
    const text=document.getElementById('questionTitle')?.textContent;if(text && window.__seenQuestionTexts.at(-1)!==text)window.__seenQuestionTexts.push(text);
    if(document.getElementById('resultsStage')?.classList.contains('active'))window.__seenReport=true;
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});});
 },{userId,organizationId,seed:kind.startsWith('reused')?null:{key:f.key,raw:f.raw,indexKey:f.indexKey}});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:`window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'workspace'});window.__mondermanReveal?.();`});
  if(url.origin===base)return route.continue();
  if(url.hostname==='monderman-api.onrender.com'){
   requests.push({method:request.method(),path:url.pathname,headers:request.headers(),body:request.postDataJSON()});
   if(url.pathname.startsWith('/api/assignments/resolve/'))return json({ok:true,assignment:{id:assignmentId,tool_type:f.toolType,participant_lens:'managerial',depth:60,depth_choice:false,is_anonymous_response:f.finalized,show_results_to_assignee:true,interview_mode:'guided'}});
   if(url.pathname.startsWith('/api/assignments/complete/'))return json({ok:true,already_completed:true});
   if(url.pathname===`/api/${tool}/run/${runId}`)return json(f.remote);
   if(url.pathname===`/api/${tool}/run/start`)return json(f.remote);
   if(url.pathname===`/api/${tool}/run/${runId}/finalize`)return json({...f.remote,resultWithheld:true,locked:true,reason:'assignment_results_withheld',savedRunId:null});
   return json({ok:true,requiresAcceptance:false});
  }
  if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* mocked */'});
  return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>pageErrors.push(error.message));
 try{
  await page.goto(base+'/'+tool+'.html'+(controller==='assignment'?'?assignment_token='+token:''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__historyTest && (!document.getElementById('pageLoader')||getComputedStyle(document.getElementById('pageLoader')).visibility==='hidden'));
  if(kind.startsWith('reused')){
   await page.waitForFunction(()=>window.MondermanAssignment?.active());
   await page.evaluate(()=>window.__historyTest.prepareStart());
  }else if(controller==='self')await page.locator('#selfDiagnosticDraftResume').click();
  const blocked=['static-mismatch','missing-history'].includes(kind);
  if(blocked){
   await page.waitForFunction(()=>document.getElementById('questionTitle').textContent==='Your saved questionnaire needs verification');
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),f.key),f.raw);
   assert.equal(await page.locator('#questionBody input,#questionBody button,#questionBody textarea').count(),0);
   assert.equal(await page.locator('#beginBtn').isDisabled(),true);
  }else if(f.finalized){
   await page.locator('#ma-overlay h2').waitFor();
   assert.match(await page.locator('#ma-overlay h2').textContent(),/perspective is recorded/);
   const state=await page.evaluate(()=>window.__historyTest.snapshot());
   assert.deepEqual(state.questionHistory,[]);assert.deepEqual(state.answerCache,{});assert.equal(state.currentItem,null);
   assert.equal(state.result,null);assert.equal(state.renderPayload,null);
   const finalize=requests.filter(req=>req.path.endsWith('/finalize'));
   assert.equal(finalize.length,1);assert.equal(finalize[0].path,`/api/${tool}/run/${runId}/finalize`);assert.equal(finalize[0].body.assignment_token,token);
   const complete=requests.filter(req=>req.path.startsWith('/api/assignments/complete/'));
   assert.equal(complete.length,1);assert.equal(complete[0].path,'/api/assignments/complete/'+token);
   assert.equal(await page.evaluate(()=>window.__seenReport),false);
   assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),f.key),null);
  }else{
   const expected=['optional','confidence'].includes(kind)?f.current:f.next;
   await page.waitForFunction(text=>document.getElementById('questionTitle').textContent===text,expected.text.managerial);
   await page.waitForTimeout(210);
   const state=await page.evaluate(()=>window.__historyTest.snapshot());
   assert.equal(state.configVersion,version);assert.equal(state.sessionRevision,3);
   assert.deepEqual(state.questionHistory.map(entry=>({item:entry.item,value:entry.value,meta:entry.meta})),f.history.map(entry=>({item:entry.item,value:entry.value,meta:entry.meta})));
   assert.equal(state.answerCache['accepted-number'],7);assert.equal(state.answerCache['accepted-choice'],'yes');assert.equal(Object.hasOwn(state.answerCache,'phantom-item'),false);
   if(kind==='ordinary')assert.equal(await page.locator('#questionBody input').inputValue(),controller==='assignment'?'48.25':'47.25');
   if(kind==='changed-frontier'||kind==='reused')assert.equal(await page.locator('#questionBody input').inputValue(),'');
   if(kind==='optional'){
    assert.equal(await page.locator('#questionBody textarea').inputValue(),'My exact unfinished optional note.');
    assert.equal(state.experiential.self,'My exact accepted optional note.');
   }
   if(kind==='confidence')assert.equal(state.confidence,'high');
   await page.locator('#backBtn').click();
   await page.waitForFunction(text=>document.getElementById('questionTitle').textContent===text,f.history[1].item.text.managerial);
   assert.equal(await page.locator('#questionBody .choice.selected').textContent(),version+' original yes label');
   await page.locator('#backBtn').click();
   await page.waitForFunction(text=>document.getElementById('questionTitle').textContent===text,f.history[0].item.text.managerial);
   assert.equal(await page.locator('#questionBody input').inputValue(),'7');
  }
  observed.push(...await page.evaluate(()=>window.__seenQuestionTexts));
  assert.equal(observed.some(text=>text.includes('FORGED')),false,'cached question text must never become visible');
  const starts=requests.filter(req=>req.path.endsWith('/run/start'));
  assert.equal(starts.length,kind.startsWith('reused')?1:0);
  if(starts.length){assert.equal(starts[0].body.assignment_token,token);assert.equal(starts[0].body.questionnaire_copy_version,process.env.EXPECT_QUESTIONNAIRE_COPY_VERSION || undefined);}
  // Ignore only mocked telemetry; keep an exact inventory of all mutations.
  const expectedMutations=[];
  if(kind.startsWith('reused'))expectedMutations.push(`/api/${tool}/run/start`);
  if(f.finalized)expectedMutations.push(`/api/${tool}/run/${runId}/finalize`,'/api/assignments/complete/'+token);
  assert.deepEqual(requests.filter(req=>req.method==='POST' && req.path!=='/api/first-run-events').map(req=>req.path).sort(),expectedMutations.sort());
  const reads=requests.filter(req=>req.method==='GET'&&req.path===`/api/${tool}/run/${runId}`);
  if(!kind.startsWith('reused')){
   assert.equal(reads.length,1);
   if(controller==='assignment')assert.equal(reads[0].headers['x-monderman-assignment-token'],token);
  }
  assert.deepEqual(pageErrors,[]);
  if(kind==='ordinary'||f.finalized||blocked)await page.screenshot({path:path.join(out,[engine,tool,version,controller,kind].join('-')+'.png')});
  results.push({engine,tool,version,controller,kind,passed:true,observed,requests:requests.map(({headers,...request})=>request)});
  console.log([engine,tool,version,controller,kind,'PASS'].join(' '));
 }catch(error){
  errors.push({engine,tool,version,controller,kind,message:error.stack,pageErrors,requests,observed:await page.evaluate(()=>window.__seenQuestionTexts).catch(()=>[])});
  await page.screenshot({path:path.join(out,'FAILED-'+[engine,tool,version,controller,kind].join('-')+'.png')}).catch(()=>{});
  throw error;
 }finally{await context.close();}
}
let browser;
try{
 for(const [engine,type]of[['chromium',chromium],['webkit',webkit]]){
  browser=await type.launch({headless:true});
  const jobs=[];
  for(const tool of tools)for(const version of versionsFor(tool)){
   for(const controller of ['assignment','self']){
    jobs.push(()=>runCase(browser,engine,tool,version,'ordinary',controller));
    jobs.push(()=>runCase(browser,engine,tool,version,'optional',controller));
   }
   jobs.push(()=>runCase(browser,engine,tool,version,'confidence','self'));
   for(const kind of ['changed-frontier','static-mismatch','missing-history','finalized'])jobs.push(()=>runCase(browser,engine,tool,version,kind));
  }
  for(const tool of [...tools,'decision-velocity'])for(const version of versionsFor(tool)){
   jobs.push(()=>runCase(browser,engine,tool,version,'reused'));
   jobs.push(()=>runCase(browser,engine,tool,version,'reused-finalized'));
  }
  for(let index=0;index<jobs.length;index+=4)await Promise.all(jobs.slice(index,index+4).map(job=>job()));
  await browser.close();browser=null;
 }
 console.log('AUTHORITATIVE_HISTORY_BROWSER_PASS '+results.length+' cases');
}finally{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({mode:'read-only source server with mocked API, assignment and auth; no live operations',passed:errors.length===0,results,errors},null,2));
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
