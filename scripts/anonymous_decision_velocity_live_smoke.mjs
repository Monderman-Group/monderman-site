// Retired public-entry harness. Keep offline recovery predicates for historical
// sessions; live anonymous admission is forbidden under invitation-only access.
import assert from 'node:assert/strict';

const API = 'https://monderman-api.onrender.com';
const AUTH = 'https://ptkxrzgmeldalrkfruth.supabase.co';
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CONFIDENCE_TEXT_BY_VERSION = Object.freeze({
  '1.0.0':'How confident are you in the accuracy of the information you provided across this run?',
  '1.1.0':'How confident are you that the answers you provided are accurate?'
});

function confidenceForInitialResponse(initial) {
  // Pin the expectation to server-saved provenance, never the visible question
  // or the current site release. Alias-only, unknown, and conflicting versions
  // must fail rather than silently selecting the newest wording.
  const version = initial?.questionnaire_version;
  assert.equal(typeof version,'string','missing_questionnaire_version');
  assert.ok(Object.hasOwn(CONFIDENCE_TEXT_BY_VERSION,version),'unknown_questionnaire_version');
  const aliases = [initial.configVersion,initial.routingMeta?.configVersion,
    initial.routingVersion,initial.config_version,initial.currentVersion].filter(value=>value!=null);
  assert.ok(aliases.every(value=>value===version),'conflicting_questionnaire_version');
  return {version,text:CONFIDENCE_TEXT_BY_VERSION[version]};
}

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
  // Offline coverage of the historical recovery predicate and orchestration.
  // No Playwright import, browser, HTTP request, or production admission.
  const {runInNewContext} = await import('node:vm');
  for (const [version,text] of [
    ['1.0.0','How confident are you in the accuracy of the information you provided across this run?'],
    ['1.1.0','How confident are you that the answers you provided are accurate?']
  ]) {
    assert.deepEqual(confidenceForInitialResponse({questionnaire_version:version,routingVersion:version}),{version,text});
    assert.deepEqual(confidenceForInitialResponse({questionnaire_version:version}),{version,text});
  }
  for (const initial of [undefined,null,{}, {routingVersion:'1.1.0'},
    {questionnaire_version:1.1},{questionnaire_version:''},{questionnaire_version:'1.2.0'},
    {questionnaire_version:'__proto__'},{questionnaire_version:'1.1.0',routingVersion:'1.0.0'},
    {questionnaire_version:'1.1.0',routingMeta:{configVersion:'1.0.0'}}]) {
    assert.throws(()=>confidenceForInitialResponse(initial),assert.AssertionError);
  }
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
  const {spawnSync}=await import('node:child_process');
  const rejected=spawnSync(process.execPath,[new URL(import.meta.url).pathname],{encoding:'utf8',
    env:{...process.env,RUN_LIVE_ANONYMOUS_SMOKE:'1',APPROVED_SITE_REVISION:'a'.repeat(40),APPROVED_API_REVISION:'b'.repeat(40)}});
  assert.equal(rejected.status,2,'old live approval flags cannot re-enable anonymous admission');
  assert.match(rejected.stderr,/ANONYMOUS_ENTRY_RETIRED/);
  console.log('ANONYMOUS_DV_LOCAL_REGRESSION_PASS: exact 1.0.0/1.1.0 confidence mapping; missing/unknown/conflicting version rejection; delayed response, matched title/type, busy/transition/disabled controls, local prompts, OPTIONS exclusion, no browser or network.');
}

if (process.argv.includes('--local-regression') || process.argv.includes('--self-test')) {
  await localRegression();
  process.exit(0);
}
console.error('ANONYMOUS_ENTRY_RETIRED: new diagnostics require an invited Workspace or a valid campaign invitation. This retired harness only supports --local-regression; no browser, network request, or admission was attempted.');
process.exit(2);
