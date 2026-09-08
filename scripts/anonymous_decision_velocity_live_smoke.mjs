// Explicitly approved production smoke: one fabricated anonymous run per
// invocation, no signup, credentials, route interception, or automatic restart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://www.monderman.com';
const API = 'https://monderman-api.onrender.com';
const AUTH = 'https://ptkxrzgmeldalrkfruth.supabase.co';
const revisionPattern = /^[a-f0-9]{40}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function classify(request) {
  // A successful CORS preflight (204) is not an answer or a second admission.
  if (request.method() === 'OPTIONS') return null;
  const url = new URL(request.url());
  if (url.origin === API) {
    if (url.pathname === '/api/decision-velocity/run/start') return {operation:'start'};
    const run = url.pathname.match(/^\/api\/decision-velocity\/run\/([a-f0-9-]{36})(?:\/(answer|revise|finalize))?$/i);
    if (run && uuidPattern.test(run[1])) return {operation:run[2] || 'snapshot',runId:run[1]};
  }
  if (url.origin === AUTH && !['GET','HEAD'].includes(request.method())) return {operation:'auth_mutation'};
  return null;
}

// Serializable browser predicate. The API-confirmed title AND control type
// must match, and neither render phase nor disabled controls may remain.
function questionReady({expected, previousTitle}) {
  const stage = document.querySelector('#questionStage.active');
  const body = document.getElementById('questionBody');
  const card = document.querySelector('#questionStage .question-card');
  const title = document.getElementById('questionTitle')?.textContent;
  if (!stage || stage.getAttribute('aria-busy') === 'true' || !body?.children.length
    || card?.classList.contains('question-transitioning') || card?.classList.contains('question-entered')) return false;
  if (previousTitle && title === previousTitle) return false;
  const type = body.querySelector('[data-numeric-input]') ? 'numeric' : body.querySelector('textarea') ? 'text'
    : body.querySelector('.ms-box') ? 'multi_select' : body.querySelector('.choice') ? 'single_select' : null;
  if (!type || Array.from(body.querySelectorAll('button,input,textarea,select')).some(el => el.disabled)) return false;
  return !expected || (title === expected.title && type === expected.type);
}

async function answerThenWait(waitForResponse, action, readResponse, waitUntilReady, previous) {
  const pending = waitForResponse('answer');
  // Closing a failed UI action must not print an unhandled waiter rejection.
  void pending.catch(() => {});
  await action(previous);
  const data = await readResponse(await pending);
  const next = itemView(data.nextItem);
  await waitUntilReady(next, next ? null : previous.title);
  return next;
}

function itemView(item) {
  if (!item) return null;
  assert.ok(['single_select','multi_select','numeric','text'].includes(item.questionType),'unexpected_question_type');
  const title = item.text?.managerial || item.text?.senior_leader || item.text?.operational;
  assert.equal(typeof title,'string','missing_question_title');
  return {id:item.id,type:item.questionType,optional:item.isOptional === true,title};
}

async function localRegression() {
  // Offline coverage of the exact predicate and orchestration used below.
  // No Playwright import, browser, HTTP request, or production admission.
  const {runInNewContext} = await import('node:vm');
  const id = '11111111-1111-4111-8111-111111111111';
  const request = (method, suffix='answer') => ({method:()=>method,url:()=>`${API}/api/decision-velocity/run/${id}/${suffix}`});
  assert.equal(classify(request('OPTIONS')),null);
  assert.equal(classify(request('OPTIONS','start')),null);
  assert.equal(classify({method:()=> 'OPTIONS',url:()=>`${AUTH}/auth/v1/otp`}),null);
  assert.deepEqual(classify(request('POST')),{operation:'answer',runId:id});
  assert.deepEqual(classify({method:()=> 'POST',url:()=>`${API}/api/decision-velocity/run/start`}),{operation:'start'});
  assert.deepEqual(classify({method:()=> 'GET',url:()=>`${API}/api/decision-velocity/run/${id}`}),{operation:'snapshot',runId:id});
  assert.deepEqual(classify({method:()=> 'POST',url:()=>`${AUTH}/auth/v1/otp`}),{operation:'auth_mutation'});
  const state = {active:true,busy:false,transition:null,disabled:false,title:'Numeric question',type:'numeric'};
  const selectors = {'[data-numeric-input]':'numeric',textarea:'text','.ms-box':'multi_select','.choice':'single_select'};
  const document = {getElementById:name=>name==='questionTitle'?{textContent:state.title}:{children:[{}],
    querySelector:s=>state.type===selectors[s]?{}:null,querySelectorAll:()=>[{disabled:state.disabled}]},
    querySelector:s=>s==='#questionStage.active'?(state.active?{getAttribute:()=>String(state.busy)}:null):{classList:{contains:value=>state.transition===value}}};
  const ready = runInNewContext(`(${questionReady.toString()})`,{document,Array});
  const expected = {title:'Numeric question',type:'numeric'};
  assert.equal(ready({expected}),true);
  for (const [key,value] of [['active',false],['busy',true],['transition','question-transitioning'],['transition','question-entered'],['disabled',true],['title','Old choice'],['type','single_select']]) {
    const before=state[key];state[key]=value;assert.equal(ready({expected}),false,`must await ${key}`);state[key]=before;
  }
  assert.equal(ready({expected:null,previousTitle:'Numeric question'}),false,'local prompts must advance');
  let release, actionCount=0, readyCalls=0, settled=false;
  const delayed = new Promise(resolve=>{release=resolve;});
  const pending = answerThenWait(()=>delayed,async()=>{actionCount+=1;},async value=>value,
    async next=>{readyCalls+=1;assert.equal(next.type,'numeric');}, {title:'Old choice'}).then(value=>{settled=true;return value;});
  // Deliberately exceed the obsolete 450ms assumption. No second action and
  // no readiness check is allowed before the corresponding answer response.
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(settled,false);assert.equal(actionCount,1);assert.equal(readyCalls,0);
  release({nextItem:{id:'next',questionType:'numeric',text:{managerial:'Numeric question'}}});
  assert.equal((await pending).id,'next');assert.equal(readyCalls,1);assert.equal(actionCount,1);
  console.log('ANONYMOUS_DV_LOCAL_REGRESSION_PASS: delayed response, matched title/type, busy/transition/disabled controls, local prompts, OPTIONS exclusion, no browser or network.');
}

if (process.argv.includes('--local-regression')) {
  await localRegression();
  process.exit(0);
}
if (process.env.RUN_LIVE_ANONYMOUS_SMOKE !== '1'
  || !revisionPattern.test(process.env.APPROVED_SITE_REVISION || '')
  || !revisionPattern.test(process.env.APPROVED_API_REVISION || '')
  || (process.env.SITE_BASE && process.env.SITE_BASE !== SITE)
  || (process.env.SMOKE_BROWSER && !['chromium','webkit'].includes(process.env.SMOKE_BROWSER))
  || process.env.DEBUG || process.env.PWDEBUG || process.env.SIGNUP_EMAIL) {
  console.error('GATE_REJECTED: require explicit deployment approval, RUN_LIVE_ANONYMOUS_SMOKE=1, exact approved site/API revisions and public origin; no signup/debug environment. Creates one fabricated anonymous production run, not an email test. No live request made.');
  process.exit(2);
}

const engine = process.env.SMOKE_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const evidenceRoot = path.resolve('output/anonymous-dv-live');
fs.mkdirSync(evidenceRoot,{recursive:true});
const output = fs.mkdtempSync(path.join(evidenceRoot,`${engine}-`));
const summary = {engine,siteRevision:process.env.APPROVED_SITE_REVISION,apiRevision:process.env.APPROVED_API_REVISION,
  stage:'initializing',passed:false,sessionRunId:null,score:null,pageErrors:0,traffic:[],screenshots:[],
  cleanup:'Any fabricated run created is retained. No account creation, deletion, or silent restart.'};
let browser, context, page;
const requests = new WeakMap(), captures = new Set();
const count = operation => summary.traffic.filter(row=>row.operation===operation).length;
const stage = name => {summary.stage=name;console.log(JSON.stringify({stage:name,engine}));};
function healthy() {
  assert.equal(summary.pageErrors,0,'browser_page_error');
  assert.ok(count('start')<=1,'unexpected_second_admission');
  assert.equal(count('auth_mutation'),0,'unexpected_signup_or_auth_mutation');
  assert.equal(context.pages().length,1,'unexpected_new_tab');
  assert.ok(summary.traffic.every(row=>!row.failed && (row.status==null || row.status===200)),'service_request_failed');
  if(summary.sessionRunId) assert.ok(summary.traffic.every(row=>!row.runId || row.runId===summary.sessionRunId),'unexpected_other_session');
}
function responseFor(operation) {
  const pending = page.waitForResponse(response=>classify(response.request())?.operation===operation
    && response.request().method()===(operation==='snapshot'?'GET':'POST'),{timeout:120000});
  void pending.catch(()=>{});return pending;
}
async function responseJson(response) {
  assert.equal(response.status(),200,'unexpected_response_status');
  const data=await response.json();assert.equal(data.ok,true,'response_not_ok');
  if(data.runId && summary.sessionRunId) assert.equal(data.runId,summary.sessionRunId,'response_changed_session');
  return data; // Memory only: never emit responses, capabilities or headers.
}
async function readyQuestion(expected=null,previousTitle=null) {
  await page.waitForFunction(questionReady,{expected,previousTitle},{timeout:45000});
  assert.equal(await page.locator('#requiredNotice.show').count(),0,'question_validation_failure');healthy();
}
async function answer(item) {
  if(item.type==='single_select') await page.locator('#questionBody .choice').first().click();
  else if(item.type==='multi_select') {
    await page.locator('#questionBody .choice').first().click();await page.locator('#continueBtn').click();
  } else if(item.type==='text' && item.optional) await page.locator('#skipBtn').click();
  else {
    await page.locator(item.type==='numeric'?'#questionBody [data-numeric-input]':'#questionBody textarea').fill(item.type==='numeric'?'5':'Fabricated readiness observation only.');
    await page.locator('#continueBtn').click();
  }
}
async function screenshot(name) {
  const file=`${name}.png`;
  await page.screenshot({path:path.join(output,file),fullPage:true,
    mask:[page.locator('input'),page.locator('textarea'),page.locator('.toast'),page.locator('#requiredNotice')]});
  summary.screenshots.push(file);
}

try {
  const {chromium,webkit}=await import('playwright');
  browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
  context=await browser.newContext({viewport:engine==='webkit'?{width:390,height:844}:{width:1440,height:1000}});
  page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',()=>{summary.pageErrors+=1;});
  page.on('request',request=>{
    const classified=classify(request);if(!classified)return;
    const row={...classified,method:request.method(),status:null};summary.traffic.push(row);requests.set(request,row);
    if(row.runId && !summary.sessionRunId)summary.sessionRunId=row.runId;
  });
  page.on('response',response=>{
    const row=requests.get(response.request());if(!row)return;row.status=response.status();
    if(row.operation==='start' && row.status===200){
      const pending=response.json().then(data=>{if(uuidPattern.test(data?.runId))summary.sessionRunId=data.runId;}).catch(()=>{});
      captures.add(pending);void pending.finally(()=>captures.delete(pending));
    }
  });
  page.on('requestfailed',request=>{const row=requests.get(request);if(row)row.failed=true;});
  stage('RELEASE_GATE');
  const site=await context.request.get(`${SITE}/.well-known/monderman-release.json`);
  assert.equal(site.status(),200,'site_release_unavailable');
  assert.equal((await site.json()).revision,summary.siteRevision,'site_revision_mismatch');
  const api=await context.request.get(`${API}/api/health`);
  assert.equal(api.status(),200,'api_release_unavailable');
  assert.equal((await api.json()).release?.revision,summary.apiRevision,'api_revision_mismatch');
  stage('HOMEPAGE_AND_FABRICATED_INTAKE');
  await page.goto(`${SITE}/index.html`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.hero-actions a[href="decision-velocity.html?source=homepage"]').click();
  await page.locator('[data-lane="managerial"]').click();await page.locator('#laneContinueBtn').click();
  await page.locator('[data-depth="10"]').click();await page.locator('#depthContinueBtn').click();
  await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
  const values={processName:'Fabricated vendor exception approval',businessUnit:'Fabricated Pilot Operations',
    description:'Fabricated anonymous readiness path; not evidence about a real organization.',employeeCount:'250',peopleInvolved:'8',hourlyCost:'90',annualVolume:'24',meetingHours:'3'};
  const choices={industry:'technology_software',regulatoryIntensity:'moderate',decisionType:'program'};
  let startResponse;
  for(let index=0;index<11;index+=1){
    const field=page.locator('#preflightContextMount .field:visible'),id=await field.getAttribute('data-field-id');
    assert.ok(Object.hasOwn(values,id)||Object.hasOwn(choices,id),'unexpected_intake_field');
    if(choices[id])await field.locator(`.opt-choice[data-val="${choices[id]}"]`).click();
    else await field.locator('input:not([hidden]), textarea').first().fill(values[id]);
    if(index===10)startResponse=responseFor('start');
    await page.locator('.preflight-next').click();
  }
  const initial=await responseJson(await startResponse);assert.ok(uuidPattern.test(initial.runId),'missing_session_identifier');
  summary.sessionRunId=initial.runId;let frontier=itemView(initial.nextItem);assert.ok(frontier,'missing_initial_question');
  stage('RESPONSE_DRIVEN_ANSWERS');
  for(let turn=0;frontier && turn<80;turn+=1){
    await readyQuestion(frontier);const before=count('answer');
    frontier=await answerThenWait(responseFor,answer,responseJson,readyQuestion,frontier);
    assert.equal(count('answer'),before+1,'duplicate_answer_request');assert.equal(count('start'),1,'unexpected_admission_count');
  }
  assert.equal(frontier,null,'adaptive_question_budget_exceeded');
  stage('LOCAL_EXPERIENCE_AND_CONFIDENCE');
  for(let index=0;index<4;index+=1){
    await readyQuestion();if(!await page.locator('#questionBody textarea').count())break;
    const title=await page.locator('#questionTitle').textContent();assert.match(title,/^Optional:/,'unexpected_local_prompt');
    const before=summary.traffic.length;await page.locator('#skipBtn').click();await readyQuestion(null,title);
    assert.equal(summary.traffic.length,before,'local_prompt_made_service_request');
  }
  assert.equal(await page.locator('#questionTitle').textContent(),'How confident are you in the accuracy of the information you provided across this run?','unexpected_confidence_prompt');
  const finalize=responseFor('finalize');await page.locator('#questionBody .choice').first().click();
  const teaser=await responseJson(await finalize);assert.equal(teaser.reason,'signup_required','expected_anonymous_teaser');
  assert.ok(Number.isFinite(teaser.teaser?.score),'missing_teaser_score');summary.score=teaser.teaser.score;
  const panel=page.locator('.dv-result-dialog__panel');await panel.waitFor({state:'visible',timeout:120000});
  const teaserText=await panel.innerText();assert.match(teaserText,/\b\d{1,3}\b\s*\/\s*100/);
  assert.match(teaserText,/Create account \/ sign in/);assert.equal(await panel.locator('a[href^="signin.html"]').count(),1,'signup_link_missing');
  await screenshot('completed-teaser');healthy();
  stage('TEASER_REFRESH');
  const before=Object.fromEntries(['start','answer','revise','finalize','snapshot'].map(op=>[op,count(op)]));
  const snapshot=responseFor('snapshot'),refinalize=responseFor('finalize');
  await page.reload({waitUntil:'domcontentloaded'});await responseJson(await snapshot);
  const refreshed=await responseJson(await refinalize);assert.equal(refreshed.reason,'signup_required','refreshed_teaser_not_anonymous');
  assert.equal(refreshed.teaser?.score,summary.score,'teaser_refresh_changed_score');
  await panel.waitFor({state:'visible',timeout:120000});assert.equal(await panel.innerText(),teaserText,'teaser_refresh_changed_content');
  for(const op of ['start','answer','revise'])assert.equal(count(op),before[op],'refresh_repeated_admission_or_answers');
  assert.equal(count('snapshot'),before.snapshot+1,'duplicate_refresh_snapshot');
  assert.equal(count('finalize'),before.finalize+1,'duplicate_refresh_finalize');
  assert.equal(count('start'),1,'unexpected_admission_count');healthy();
  assert.ok(summary.traffic.every(row=>row.status===200),'incomplete_service_request');
  await screenshot('refreshed-teaser');
  if(process.env.SCREENSHOT_OUT)await page.screenshot({path:process.env.SCREENSHOT_OUT,fullPage:true});
  summary.passed=true;stage('ANONYMOUS_DECISION_VELOCITY_LIVE_PASS');
}catch(error){
  summary.failureType=['AssertionError','TimeoutError'].includes(error?.name)?error.name:'Error';
  const assertionLabel=String(error?.message||'').split('\n')[0];
  if(error?.name==='AssertionError' && /^[a-z][a-z0-9_]{2,90}$/.test(assertionLabel))summary.failureCheck=assertionLabel;
  // Never emit Playwright errors, entered text, URLs, headers or response data.
  if(page && !page.isClosed())await screenshot('failure-masked').catch(()=>{});
  process.exitCode=1;
}finally{
  await Promise.allSettled([...captures]);
  summary.counts=Object.fromEntries(['start','answer','revise','finalize','snapshot','auth_mutation'].map(op=>[op,count(op)]));
  fs.writeFileSync(path.join(output,'safe-result.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({gate:summary.passed?'ANONYMOUS_DECISION_VELOCITY_LIVE_PASS':'ANONYMOUS_DECISION_VELOCITY_LIVE_FAIL',stage:summary.stage,engine,sessionRunId:summary.sessionRunId,counts:summary.counts,failureType:summary.failureType,failureCheck:summary.failureCheck,output}));
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
}
