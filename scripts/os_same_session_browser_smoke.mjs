// Offline browser contract: actual OS page/UI + registry-derived banks; service
// responses are synthetic. Real routing/revision semantics have API tests too.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site=path.resolve(import.meta.dirname,'..');
const sourceFiles=['operational-systems.html','self-diagnostic-draft.js','assignment-draft.js','scripts/os_same_session_browser_smoke.mjs','test-fixtures/os-questionnaire-registry-contract.json'];
const readSourcePins=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(site,file))).digest('hex')]));
const sourcePins=readSourcePins();
const contract=JSON.parse(fs.readFileSync(path.join(site,'test-fixtures/os-questionnaire-registry-contract.json')));
assert.equal(contract.format,'os-questionnaire-registry-contract-v1');
const versions=Object.values(contract.versions);
assert.equal(new Set(versions).size,versions.length);
const api=process.env.OS_API_ROOT;
if(api){
  for(const [file,sha]of Object.entries(contract.sourcePins))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(api,file))).digest('hex'),sha,file);
  const registry=await import(pathToFileURL(path.join(path.resolve(api),'questionnaire-version-registry.js')));
  assert.deepEqual(contract.versions,registry.QUESTIONNAIRE_VERSIONS.operational_systems);
  for(const version of versions)assert.deepEqual(contract.banks[version],registry.questionnaireConfigForVersion('operational_systems',version));
}
const html=fs.readFileSync(path.join(site,'operational-systems.html'),'utf8');
const fields=vm.runInNewContext(html.match(/const PRESTART_FIELDS = (\[[\s\S]*?\n\]);/)[1]);
const mapBlock=html.slice(html.indexOf('const EXPERIENCE_PROMPT_SETS ='),html.indexOf('function assertCachedStaticQuestion('));
const pins=vm.createContext({state:{runId:'11111111-1111-4111-8111-111111111111',configVersion:null}});
vm.runInContext(mapBlock+'\nglobalThis.maps={experience:Object.keys(EXPERIENCE_PROMPT_SETS_BY_VERSION),confidence:Object.keys(CONFIDENCE_TEXT_BY_VERSION),pin:pinQuestionnaireVersion};',pins);
assert.deepEqual([...pins.maps.experience],versions);assert.deepEqual([...pins.maps.confidence],versions);
for(const version of versions){pins.state.configVersion=null;assert.equal(pins.maps.pin({questionnaire_version:version,configVersion:version,routingVersion:version}),version);}
assert.throws(()=>pins.maps.pin({questionnaire_version:'unknown'}));
assert.throws(()=>pins.maps.pin({questionnaire_version:versions[0],configVersion:versions[1]}));
const output=path.resolve(process.env.OS_BROWSER_OUT || path.join(site,'output/os-same-session-browser'));
fs.mkdirSync(output,{recursive:true});
const results=[],failures=[];
const userId='11111111-1111-4111-8111-111111111111',orgId='22222222-2222-4222-8222-222222222222';
const runId='33333333-3333-4333-8333-333333333333',otherRun='44444444-4444-4444-8444-444444444444';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(site,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let content=fs.readFileSync(file);
  if(file.endsWith('.html'))content=Buffer.from(content.toString().replace('const ACTIVE_QUESTIONNAIRE_COPY_VERSION = undefined;','const ACTIVE_QUESTIONNAIRE_COPY_VERSION = "diagnostic-language-20260908";').replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(content);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const gate=`window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId='${orgId}';window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'workspace'});window.__mondermanReveal?.();`;
function clone(value){return JSON.parse(JSON.stringify(value));}
async function runCase(browser,engine,version,role,depth,kind='matrix'){
  const bank=contract.banks[version],eligible=bank.items.filter(item=>item.role.includes(role)&&item.depth.includes(depth));
  const choices=eligible.filter(item=>item.questionType==='single_select');
  const numbers=eligible.filter(item=>item.questionType==='numeric');
  assert.ok(choices.length>=2&&numbers.length>=2);
  const [first,last]=choices,[number,alternate]=numbers;
  const questionItems=[first,number,last,alternate];
  const state={revision:1,history:[],starts:0,reads:0,writes:0,receipts:new Map(),failedAnswer:false,failedRevision:false,unknown:kind==='unknown-start'};
  const requests=[],errors=[];
  const contextData={processName:'Fabricated browser process',businessUnit:'Fixture unit',industry:'technology_software',description:'',employeeCount:250,peopleAffected:8,hourlyCost:90,annualVolume:24,meetingHours:3,decisionType:'program',regulatoryIntensity:'moderate'};
  function next(){
    if(!state.history.length)return first;
    if(state.history[0].value!==first.options[0].value)return state.history.length===1?alternate:null;
    return [first,number,last][state.history.length]||null;
  }
  const metadata=()=>({questionnaire_version:state.unknown?'unsupported-future':version,configVersion:state.unknown?'unsupported-future':version,routingVersion:state.unknown?'unsupported-future':version});
  const snapshot=()=>({ok:true,runId,role,depth,context:contextData,...metadata(),sessionRevision:state.revision,answerHistory:clone(state.history),finalized:false,nextItem:clone(next()),shouldStop:!next(),progress:{progressPercent:state.history.length*20}});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(({userId})=>{
    window.__fixtureAuth={auth:{getSession:async()=>({data:{session:{access_token:'offline-fixture-token',user:{id:userId}}}}),getUser:async()=>({data:{user:{id:userId}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
    window.supabase={createClient:()=>window.__fixtureAuth};
  },{userId});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(url.pathname==='/workspace-access-gate.js')return route.fulfill({contentType:'application/javascript',body:gate});
    if(url.origin===base)return route.continue();
    if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* local auth fixture */'});
    if(url.hostname!=='monderman-api.onrender.com')return route.abort();
    const data=req.postData()?JSON.parse(req.postData()):{};
    requests.push({method:req.method(),path:url.pathname,body:data});
    if(!url.pathname.startsWith('/api/operational-systems/run/'))return json(200,{ok:true,requiresAcceptance:false});
    assert.equal(req.headers().authorization,'Bearer offline-fixture-token');
    assert.equal(req.headers()['x-monderman-organization-id'],orgId);
    if(url.pathname.endsWith('/start')){state.starts++;assert.equal(data.questionnaire_copy_version,'diagnostic-language-20260908');return json(200,snapshot());}
    if(req.method()==='GET'){
      state.reads++;
      if(url.pathname.endsWith(otherRun)||kind==='denied')return json(403,{ok:false});
      assert.ok(url.pathname.endsWith(runId));return json(200,snapshot());
    }
    if(url.pathname.endsWith('/answer')){
      const old=state.history.find(entry=>entry.itemId===data.itemId);
      if(old&&JSON.stringify(old.value)===JSON.stringify(data.value)&&JSON.stringify(old.meta)===JSON.stringify(data.meta))return json(200,{...snapshot(),idempotentReplay:true});
      assert.equal(data.expectedRevision,state.revision);assert.equal(data.itemId,next().id);
      state.history.push({itemId:data.itemId,item:clone(next()),value:data.value,meta:data.meta});state.revision++;state.writes++;
      if(!state.failedAnswer){state.failedAnswer=true;return route.abort();}
      return json(200,snapshot());
    }
    if(url.pathname.endsWith('/revise')){
      if(state.receipts.has(data.mutationId))return json(200,{...snapshot(),idempotentReplay:true});
      assert.equal(data.expectedRevision,state.revision);
      const i=state.history.findIndex(entry=>entry.itemId===data.itemId);assert.ok(i>=0);assert.deepEqual(data.expectedValue,state.history[i].value);
      state.history=state.history.slice(0,i+1);state.history[i]={...state.history[i],value:data.value,meta:data.meta};
      state.revision++;state.writes++;state.receipts.set(data.mutationId,clone(data));
      if(!state.failedRevision){state.failedRevision=true;return route.abort();}
      return json(200,snapshot());
    }
    throw new Error('Unexpected mutation '+url.pathname);
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  const text=item=>typeof item.text==='string'?item.text:item.text[role];
  async function question(item){await page.waitForFunction(expected=>document.getElementById('questionTitle')?.textContent===expected,text(item));await page.waitForTimeout(180);}
  async function pick(option,double=false){const button=page.getByRole('button',{name:option.label,exact:true});if(double)await button.evaluate(el=>{el.click();el.click();});else await button.click();}
  async function numeric(value){await page.locator('#questionBody input').fill(String(value));await page.locator('#continueBtn').evaluate(el=>{el.click();el.click();});}
  async function start(){
    await page.locator(`[data-lane="${role==='senior_leader'?'executive':role}"]`).click();
    await page.locator(`[data-depth="${depth}"]`).click();
    await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
    for(let i=0;i<fields.length;i++){
      const field=page.locator('#preflightContextMount .field:visible'),id=await field.getAttribute('data-field-id');
      const definition=fields.find(f=>f.id===id);
      if(definition.kind==='select'){
        const option=definition.options.find(o=>o.value&&o.value!=='other');await field.locator(`[data-val="${option.value}"]`).click();
      }else await field.locator('input,textarea').first().fill(definition.kind==='number'?'12':id==='description'?'':'Fabricated browser '+id);
      await page.locator('.preflight-next').click();
    }
  }
  try{
    const fresh=version===contract.versions.current&&kind!=='denied';
    await page.goto(base+'/operational-systems.html'+(fresh?'':'?resume_run='+runId),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__mondermanTestHooks&&(!document.getElementById('pageLoader')||getComputedStyle(document.getElementById('pageLoader')).visibility==='hidden'));
    if(fresh)await start();else await page.locator('#resumeSavedRunBtn').click();
    if(kind==='denied'){
      await page.waitForFunction(()=>document.getElementById('questionTitle')?.textContent==='Your saved questionnaire needs verification');
      assert.equal(await page.locator('#questionBody .choice,#questionBody input').count(),0);assert.equal(state.starts,0);assert.equal(state.writes,0);return;
    }
    if(kind==='unknown-start'){
      await page.waitForFunction(()=>document.getElementById('questionTitle')?.textContent==='Your saved questionnaire needs verification');
      assert.equal(await page.locator('#questionBody .choice,#questionBody input').count(),0);
      assert.equal(new URL(page.url()).searchParams.get('resume_run'),runId);assert.equal(state.starts,1);
      state.unknown=false;await page.locator('#resumeSavedRunBtn').click();await question(first);
      assert.equal(state.starts,1);assert.equal(state.writes,0);return;
    }
    await question(first);
    const expectedStarts=fresh?1:0;
    assert.equal(new URL(page.url()).searchParams.get('resume_run'),runId);
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('#selfDiagnosticDraftResume').click();await question(first);
    assert.equal(state.starts,expectedStarts);assert.equal(state.writes,0);
    await pick(first.options[0],true);await question(number);assert.equal(state.history.length,1);
    await numeric(5);await question(last);
    await page.locator('#backBtn').click();await question(number);await numeric(6);await question(last);
    assert.equal(state.history[1].value,6);
    await page.locator('#backBtn').click();await question(number);await page.locator('#backBtn').click();await question(first);
    await pick(first.options[1],true);await question(alternate);assert.equal(state.history.length,1);
    await numeric(3);
    for(let i=0;i<3;i++){
      await page.locator('#questionBody textarea').waitFor();await page.locator('#skipBtn').click();
    }
    await page.waitForFunction(()=>document.getElementById('questionTitle')?.textContent.includes('How confident'));
    const confidence=await page.locator('#questionTitle').textContent();
    assert.ok(confidence.includes(version===contract.versions.legacy?'accuracy of the information':'answers you provided'));
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('#selfDiagnosticDraftResume').click();
    await page.waitForFunction(()=>document.getElementById('questionTitle')?.textContent.includes('How confident'));
    assert.equal(state.starts,expectedStarts);assert.equal(state.writes,5);
    assert.ok(requests.filter(r=>r.path.endsWith('/revise')).length>=3);
    // A link for another run must neither reveal this run nor erase its draft.
    const before=await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(k=>k.startsWith('monderman.selfDiagnosticDraft.')).map(k=>[k,sessionStorage.getItem(k)])));
    await page.goto(base+'/operational-systems.html?resume_run='+otherRun,{waitUntil:'domcontentloaded'});
    await page.locator('#resumeSavedRunBtn').click();
    await page.waitForFunction(()=>document.getElementById('questionTitle')?.textContent==='Your saved questionnaire needs verification');
    const after=await page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(k=>k.startsWith('monderman.selfDiagnosticDraft.')).map(k=>[k,sessionStorage.getItem(k)])));
    assert.deepEqual(after,before,'different-run link must not erase the existing draft');
    assert.deepEqual(errors,[]);
  }catch(error){failures.push({engine,version,role,depth,kind,error:error.stack,errors,requests});await page.screenshot({path:path.join(output,['FAIL',engine,version,role,depth,kind].join('-')+'.png')}).catch(()=>{});throw error;}
  finally{results.push({engine,version,role,depth,kind,passed:!failures.some(f=>f.engine===engine&&f.version===version&&f.role===role&&f.depth===depth&&f.kind===kind),starts:state.starts,reads:state.reads,writes:state.writes,requests});await context.close();}
}
let browser;
try{
  for(const [engine,type]of[['chromium',chromium],['webkit',webkit]]){
    browser=await type.launch({headless:true});
    const jobs=[];
    for(const version of versions)for(const role of ['operational','managerial','senior_leader'])for(const depth of [10,30,60])jobs.push(()=>runCase(browser,engine,version,role,depth));
    jobs.push(()=>runCase(browser,engine,contract.versions.current,'operational',10,'unknown-start'));
    jobs.push(()=>runCase(browser,engine,contract.versions.current,'operational',10,'denied'));
    const limit=Number(process.env.OS_BROWSER_CASE_LIMIT||jobs.length);
    for(let i=0;i<Math.min(jobs.length,limit);i+=3)await Promise.all(jobs.slice(i,Math.min(i+3,limit)).map(job=>job()));
    await browser.close();browser=null;
  }
  assert.deepEqual(readSourcePins(),sourcePins,'tested source must remain unchanged throughout the browser run');
  console.log(JSON.stringify({status:'OS_SAME_SESSION_BROWSER_PASS',cases:results.length,sourceMode:api?'actual-registry-byte-parity':'sealed-registry-derived-contract',sourceCommit:contract.sourceCommit,productionCalls:0}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({scope:'offline browser contract, synthetic API/auth; not a live canary',sourceCommit:contract.sourceCommit,sourcePins,sourcePinsAfter:readSourcePins(),results,failures},null,2));}
