import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Executes the shipped controller, restore hook, Back/answer handlers and
// finalizer against isolated synthetic responses. No network or live writes.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('decision-velocity.html');
const helper = read('assignment-draft.js');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `source boundary ${start}`);
  return html.slice(a, b);
}
const restore = section('async function restoreAssignedDecisionVelocityDraft()', 'const participantDraft =');
const applyHistory = section('function applyAnswerHistory(', 'function answerFailureMessage(');
const answers = section('async function submitAnswer(', '// Legacy callers');
const back = section('backBtn.addEventListener("click"', 'skipBtn.addEventListener("click"');
const finalizer = section('async function renderAssignedCompletionAcknowledgment(', 'function confirmRestart()');
const clone = value => JSON.parse(JSON.stringify(value));
const id = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const token = '0123456789abcdef0123456789abcdef';
const key = `monderman.assignmentDraft.v1.${id}`;
function remote() {
  return {ok:true, runId, role:'managerial', depth:10, configVersion:'dv.v1.2',
    sessionRevision:7, finalized:false, shouldStop:false, progress:{answered:2},
    nextItem:{id:'server-q3', questionType:'numeric'},
    answerHistory:[{itemId:'q1',item:{id:'q1'},value:'first'}, {itemId:'q2',item:{id:'q2'},value:2}]};
}
function deferred() { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function runtime({anonymous=false, optIn=true, hasRun=true, tool='decision_velocity', depthChoice=false}={}) {
  const calls=[], timers=[], intervals=[], renders=[], notices=[], storage=new Map(), listeners={};
  const state={mode:'managerial',depth:'10',started:hasRun,runId:hasRun?runId:null,
    configVersion:null,sessionRevision:null,preflight:{confidenceLevel:'high'},
    currentItem:{id:'stale-reviewed-item'}, questionHistory:[{item:{id:'stale-q'},value:'stale'}],
    answerCache:{'stale-q':'stale'}, experiential:{self:'local note'},experienceIndex:0,
    experienceComplete:false,result:null,renderPayload:null};
  const cfg={id,tool_type:tool,participant_lens:'managerial',depth:'10',depth_choice:depthChoice,is_anonymous_response:anonymous};
  const fixture={active:true,token,remote:remote(),status:200,gate:null,post:null,completeOk:true,retire:false};
  const elements={};
  for (const name of ['introStage','questionStage','resultsStage','processingStage','persistenceNotice',
    'questionBody','questionTitle','questionCopy','beginBtn','backBtn','continueBtn','skipBtn','restartBtn']) {
    elements[name]={id:name,textContent:'',style:{},disabled:false,children:[],
      classList:{contains:()=>false}, querySelectorAll:()=>[],setAttribute(){},
      replaceChildren(){this.children=[];},addEventListener(type,fn){listeners[`${name}:${type}`]=fn;}};
  }
  const doc={getElementById:name=>elements[name]||null,querySelector:()=>elements.questionStage,addEventListener(){}};
  const win={location:{search:`?assignment_token=${token}`},sessionStorage:{
    getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},
    setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},addEventListener(){},
    MondermanAssignment:{active:()=>fixture.active,token:()=>fixture.token,config:()=>cfg,
      complete:async savedRunId=>{calls.push({ack:savedRunId});if(fixture.completeOk){storage.delete(key);if(fixture.retire)fixture.active=false;}return {ok:fixture.completeOk};},
      renderCompletion:()=>renders.push('ack'),renderCompletionFailed:retry=>{fixture.retry=retry;renders.push('ack-failed');},
      showsResults:()=>true}};
  const context=vm.createContext({window:win,location:win.location,document:doc,URLSearchParams,encodeURIComponent,
    JSON,Promise,Set,Object,Number,String,Array,console,Event:class{},crypto:{randomUUID:()=> 'synthetic-mutation'},
    setTimeout:win.setTimeout,clearTimeout:win.clearTimeout,state,API_BASE:'https://api.invalid',
    ANSWER_TIMEOUT_MS:25000,FINALIZE_TIMEOUT_MS:60000,reviewingHistoryItemId:null,reviewFrontierItem:null,
    ...elements,journeyRecovery:null,selfDraft:null,
    setAnswerControlsBusy:busy=>{for(const name of ['backBtn','continueBtn','skipBtn','restartBtn'])elements[name].disabled=!!(busy||state.journeyInvalidated);},
    showStage:stage=>notices.push(stage.id),renderQuestion:()=>renders.push(state.currentItem?.id),
    resetExperientialLayer:()=>{state.experienceComplete=false;state.experienceIndex=0;state.experiential={};},
    queueExperienceQuestion:()=>renders.push('experience'),queueConfidenceQuestion:()=>renders.push('confidence'),
    saveJourneyProgress(){},clearQuestionRequired(){},showQuestionRequired:message=>notices.push(message),
    showToast:message=>notices.push(message),answerFailureMessage:()=> 'synthetic failure',
    resetProcessingUI(){},setProcessingStep(){},showRunsExhausted:()=>renders.push('exhausted'),
    showSignupTeaser:()=>renders.push('teaser'),renderResults:()=>renders.push('report'),
    fetchWithTimeout:async (url,options={})=>{
      calls.push({url,...clone(options)});
      if(options.method==='POST') {
        const body=fixture.post || {...remote(),sessionRevision:8};
        return {ok:true,status:200,json:async()=>clone(body),text:async()=>JSON.stringify(body)};
      }
      if(fixture.gate) await fixture.gate.promise;
      return {ok:fixture.status===200,status:fixture.status,json:async()=>clone(fixture.remote)};
    }});
  vm.runInContext(helper,context,{filename:'assignment-draft.js'});
  vm.runInContext(`${applyHistory}\n${answers}\n${back}\n${finalizer}\n${restore}`,context,{filename:'decision-velocity recovery and handlers'});
  const storedState=clone(state);
  // Mirrors the actual historical allowlist: no revision/config/capability.
  delete storedState.sessionRevision;delete storedState.configVersion;
  storage.set(key,JSON.stringify({version:1,assignment_id:id,tool_type:tool,anonymous,
    state:storedState,controls:[{root:'questionStage',id:'stale-answer',value:'stale'}]}));
  let restorePromise;
  const controller=win.MondermanAssignmentDraft.createController({tool,state,
    stages:{question:elements.questionStage,intro:elements.introStage},
    showStage:stage=>notices.push(stage.id),renderQuestion:()=>renders.push('cached-question'),
    renderPreflight:()=>renders.push('preflight'),authoritativeRunRestore:optIn,
    onRestore:()=>{restorePromise=context.restoreAssignedDecisionVelocityDraft();return restorePromise;}});
  context.participantDraft=controller;
  return {state,cfg,fixture,calls,timers,intervals,renders,notices,storage,elements,controller,context,
    activate:()=>controller.activate(cfg),done:()=>restorePromise,
    tick:()=>intervals.forEach(fn=>fn()),back:()=>listeners['backBtn:click']()};
}

const pending=runtime();pending.fixture.gate=deferred();
assert.equal(pending.activate(),true,'activation owns the restore path synchronously; init must not start another');
assert.equal(pending.state.answerInFlight,true);
assert.equal(pending.elements.backBtn.disabled,true);
assert.equal(pending.elements.beginBtn.disabled,true);
assert.equal(pending.state.currentItem,null);
assert.equal(pending.state.questionHistory.length,0);
assert.deepEqual(pending.renders,[],'no cached question or interview presentation before GET');
assert.deepEqual(pending.timers,[],'no delayed cached-control restoration');
const savedBefore=pending.storage.get(key);pending.tick();
assert.equal(pending.storage.get(key),savedBefore,'autosave cannot replace draft while verification is pending');
await pending.back();await pending.context.submitAnswer('stale-reviewed-item','changed');
assert.equal(pending.calls.length,1,'immediate input during recovery creates no mutation');
assert.equal(pending.calls[0].url,`https://api.invalid/api/decision-velocity/run/${runId}`);
assert.deepEqual(pending.calls[0].headers,{'X-Monderman-Assignment-Token':token});
pending.fixture.gate.resolve();assert.equal(await pending.done(),true);await flush();
assert.equal(pending.state.sessionRevision,7);
assert.equal(pending.state.currentItem.id,'server-q3');
assert.deepEqual(pending.renders,['server-q3']);
pending.tick();assert.equal(JSON.parse(pending.storage.get(key)).state.currentItem.id,'server-q3');

// Reload followed immediately by Back + changed numeric answer must revise
// this same run with the server revision and expected prior value.
await pending.back();assert.equal(pending.state.currentItem.id,'q2');
await pending.context.submitAnswer('q2',5);
const revision=pending.calls.find(call=>call.url?.endsWith('/revise'));
assert.ok(revision);assert.equal(revision.method,'POST');
assert.deepEqual(JSON.parse(revision.body),{itemId:'q2',value:5,meta:{},expectedRevision:7,
  expectedValue:2,mutationId:'synthetic-mutation',assignment_token:token});
assert.equal(pending.state.sessionRevision,8);
assert.equal(pending.calls.filter(call=>call.url?.includes('/start')).length,0);

// A lost answer ACK or reload during Back-review must use the remote frontier,
// never the cached reviewed/current question or ambiguous pending mutation.
const lost=runtime();lost.state.pendingAnswerMutation={intent:'old'};
lost.activate();assert.equal(await lost.done(),true);
assert.equal(lost.state.currentItem.id,'server-q3');assert.equal(lost.state.pendingAnswerMutation,null);
assert.equal(lost.state.answerCache.q2,2);assert.equal(lost.state.answerCache['stale-q'],undefined);
await lost.back();await lost.context.submitAnswer('q2',2);
assert.equal(lost.calls.length,1,'unchanged review navigation must not POST or consume admission');

for(const status of [401,403]) {
  const env=runtime();env.fixture.status=status;const before=env.storage.get(key);
  env.activate();assert.equal(await env.done(),false);await flush();env.tick();
  assert.equal(env.state.journeyInvalidated,true);assert.equal(env.elements.backBtn.disabled,true);
  assert.equal(env.state.currentItem,null);assert.equal(env.state.questionHistory.length,0);
  assert.equal(env.storage.get(key),before,'failed verification preserves retryable original draft');
  assert.match(env.elements.questionCopy.textContent,/Refresh.*No new diagnostic/);
  await env.context.submitAnswer('q2',10);assert.equal(env.calls.length,1);
  // Fresh page retry succeeds with the original same-run draft; no start path.
  const retry=runtime();retry.storage.set(key,env.storage.get(key));retry.activate();
  assert.equal(await retry.done(),true);assert.equal(retry.state.runId,runId);
}
for(const [label,change] of [
  ['run identity',r=>r.runId='wrong'],['revision',r=>r.sessionRevision=null],
  ['role',r=>r.role='operational'],['depth',r=>r.depth=30],
  ['config',r=>r.configVersion=''],['history',r=>r.answerHistory[0].item.id='wrong'],
  ['duplicate history',r=>r.answerHistory.push(clone(r.answerHistory[0]))],
  ['answered frontier',r=>r.nextItem={id:'q1'}],['finalized frontier',r=>r.finalized=true],
  ['missing frontier',r=>r.nextItem=null]
]) {
  const env=runtime();change(env.fixture.remote);env.activate();
  assert.equal(await env.done(),false,label);assert.equal(env.state.journeyInvalidated,true,label);
}
for(const change of [e=>{e.cfg.participant_lens='operational';},e=>{e.fixture.token='changed';},
  e=>{e.fixture.active=false;},e=>{e.cfg.is_anonymous_response=true;},e=>{e.cfg.depth_choice=true;}]) {
  const env=runtime();env.fixture.gate=deferred();env.activate();change(env);env.fixture.gate.resolve();
  assert.equal(await env.done(),false,'assignment must remain identical while awaiting GET');
}
const version=runtime();version.state.configVersion='old-version';version.activate();
assert.equal(await version.done(),false,'known config mismatch must fail closed');

// Execute the real finalizer, including its early locked branch. Both a
// withheld completion and a repeated anonymous success acknowledge, never
// show runs-exhausted, suppressed history, or a report. Completing must stop
// autosave even when complete() deactivates the assignment.
for(const body of [
  {ok:true,locked:true,reason:'assignment_results_withheld',completionState:'complete',resultWithheld:true},
  {ok:true,completionState:'complete',result:{secret:'must not render'}}
]) {
  const env=runtime({anonymous:true});env.fixture.remote={...remote(),finalized:true,shouldStop:true,nextItem:null,answerHistory:[]};
  env.fixture.post=body;env.fixture.retire=true;
  env.activate();assert.equal(await env.done(),true);await flush();env.tick();
  assert.deepEqual(env.renders,['ack']);assert.equal(env.state.result,null);assert.equal(env.state.renderPayload,null);
  assert.equal(env.state.questionHistory.length,0);assert.equal(env.storage.has(key),false);
  assert.equal(env.state.journeyInvalidated,undefined,'normal completion may retire assignment');
  assert.equal(env.calls.filter(c=>c.url?.endsWith('/finalize')).length,1);
  assert.equal(JSON.parse(env.calls.find(c=>c.url?.endsWith('/finalize')).body).expectedRevision,7);
}
const ackRetry=runtime({anonymous:true});ackRetry.fixture.remote={...remote(),finalized:true,shouldStop:true,nextItem:null,answerHistory:[]};
ackRetry.fixture.post={ok:true,locked:true,reason:'assignment_results_withheld',resultWithheld:true};
ackRetry.fixture.completeOk=false;ackRetry.activate();assert.equal(await ackRetry.done(),true);
assert.deepEqual(ackRetry.renders,['ack-failed']);ackRetry.fixture.completeOk=true;
assert.equal(await ackRetry.fixture.retry(),true);await flush();ackRetry.tick();
assert.equal(ackRetry.storage.has(key),false,'ack retry clears and stops autosave too');

// The hook is opt-in. Other diagnostics and preflight-only DV drafts retain
// their previous cached rendering and control restoration schedules.
for(const tool of ['structural_clarity','operational_systems','institutional_performance']) {
  const env=runtime({tool,optIn:false});env.activate();
  assert.ok(env.renders.includes('cached-question'));assert.deepEqual(env.timers.map(t=>t.ms),[0,160]);
  await env.done();
}
const preflight=runtime({hasRun:false});assert.equal(preflight.activate(),true);await preflight.done();
assert.deepEqual(preflight.renders,['preflight']);assert.deepEqual(preflight.timers.map(t=>t.ms),[0,160]);
assert.equal(preflight.calls.length,0);
assert.match(html,/authoritativeRunRestore: true,\s*onRestore: restoreAssignedDecisionVelocityDraft/);
assert.doesNotMatch(restore,/\/start|startAdaptiveRun\(|restartDiagnostic\(/);
assert.ok(html.indexOf('await renderAssignedCompletionAcknowledgment(data.savedRunId)') < html.indexOf('if ((data && data.locked === true)'));
console.log('DV assignment recovery smoke passed: authoritative reload, Back revision, lost ACK, fail-closed identity, anonymous acknowledgment, no admission, opt-in compatibility.');
