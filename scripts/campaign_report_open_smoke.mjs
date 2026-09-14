// The complete, real campaign ES module runs alone. Only its automatic boot
// call is replaced by an export of renderTracking; browser/auth/API I/O is MOCK.
// In particular, the preceding saved-run module is NEVER merged or evaluated.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('..',import.meta.url));
const revision=process.env.CAMPAIGN_REPORT_SOURCE_REVISION;
if(revision)assert.match(revision,/^[a-f0-9]{40}$/);
const html=revision?execFileSync('git',['show',`${revision}:workspace-diagnostics.html`],{cwd:root,encoding:'utf8'}):readFileSync(new URL('../workspace-diagnostics.html',import.meta.url),'utf8');
const modules=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(modules.length,2);
assert.match(modules[0],/function reserveWorkspaceReportWindow\(/);
assert.match(modules[1],/function renderTracking\(/);
assert.match(modules[1],/\n    boot\(\);\s*$/);
const source=modules[1].replace(/\n    boot\(\);\s*$/,'\nexport {renderTracking};');
const renderer=readFileSync(new URL('../monderman-report.js',import.meta.url),'utf8');
const reserveSource=renderer.match(/  function reserveReportWindow\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(reserveSource,'exercise the actual synchronous renderer reservation');
const sha=b=>createHash('sha256').update(b).digest('hex');
let checks=5;
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;}
const globals=['window','document','fetch'];
const originals=Object.fromEntries(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const runId='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
const result={tool_type:'structural_clarity',marker:'MOCK saved report, no generation'};
const scenarios=['success','blocked','missing_renderer','reserve_throws','http_failure','network_failure','malformed_response','render_failure','json'];
try{for(const scenario of scenarios){
  const events=[],requests=[],opened=[],downloads=[],feedback={hidden:true,textContent:''};
  let releaseSession;const sessionGate=new Promise(resolve=>releaseSession=resolve);
  let closeCalls=0,stopCalls=0;
  const popup={closed:false,opener:'MOCK',document:{title:'',body:{innerHTML:''}}};
  const row={querySelector(selector){assert.equal(selector,'.rcp-report-error');return feedback;}};
  const makeButton=kind=>({textContent:kind==='report'?'Report':'JSON',disabled:false,dataset:{[kind]:runId,tt:'structural_clarity'},
    addEventListener(event,handler){assert.equal(event,'click');this.click=handler;},
    closest(selector){assert.equal(selector,'.rcp-row');return row;}});
  const reportButton=makeButton('report'),jsonButton=makeButton('json');
  const board={innerHTML:'',querySelectorAll(selector){return selector==='[data-report]'?[reportButton]:selector==='[data-json]'?[jsonButton]:[];}};
  globalThis.document={getElementById(id){assert.equal(id,'trackBody','feedback must not target hidden runMsg or composer messages');return board;}};
  globalThis.window={__mondermanActiveOrganizationId:org,
    mondermanWorkspaceAccessReady:Promise.resolve({allowed:true}),
    mondermanGetSupabaseClient:async()=>({auth:{getSession:async()=>{events.push('session');await sessionGate;return {data:{session:{access_token:'MOCK-NOT-A-CREDENTIAL'}}};}}}),
    open(url,target){events.push('reserve');eq(url,'about:blank');eq(target,'_blank');
      if(scenario==='reserve_throws')throw new Error('MOCK window unavailable');
      return scenario==='blocked'?null:popup;}};
  const reserve=vm.runInNewContext(`(${reserveSource})`,{window});
  if(scenario!=='missing_renderer')window.MondermanReport={
    reserveReportWindow:reserve,
    closeReservedReportWindow(value){eq(value,popup);popup.closed=true;closeCalls++;},
    fromRun(value){eq(value,result,'exact authorized saved response reaches the adapter');if(scenario==='render_failure')throw new Error('MOCK rendering failed');return {saved:value};},
    openReport(model,value){opened.push({model,popup:value});},
    downloadJson(value,tool){downloads.push({value,tool});}};
  globalThis.fetch=async(url,options)=>{
    events.push('fetch');requests.push({url,options});
    eq(url,`https://monderman-api.onrender.com/api/runs/${runId}/report`,'only this saved report GET');
    eq(options.method??'GET','GET','no generation or mutation');
    eq(options.headers.Authorization,'Bearer MOCK-NOT-A-CREDENTIAL');
    eq(options.headers['X-Monderman-Organization-Id'],org,'organization binding unchanged');
    if(scenario==='network_failure')throw new Error('MOCK network failure');
    return {ok:scenario!=='http_failure',status:scenario==='http_failure'?403:200,
      json:async()=>scenario==='http_failure'?{error:'MOCK access denied'}:scenario==='malformed_response'?{}:{result}};
  };
  eq(typeof globalThis.reserveWorkspaceReportWindow,'undefined','saved-run helper unavailable in the campaign module');
  const imported=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+scenario);
  imported.renderTracking([{id:'MOCK-assignment',run_id:runId,tool_type:'structural_clarity',participant_lens:'managerial',
    recipient_email:'fixture@example.test',campaign_id:'MOCK-campaign',campaign_label:'MOCK campaign',
    created_at:'2026-09-14T12:00:00Z',completed_at:'2026-09-14T12:05:00Z',status:'completed'}]);
  const button=scenario==='json'?jsonButton:reportButton;
  // This listener was registered by the production renderTracking function.
  button.click({stopPropagation(){stopCalls++;}});
  eq(stopCalls,1);
  eq(requests.length,0,'synchronous click cannot fetch before session resolves');
  if(['blocked','missing_renderer','reserve_throws'].includes(scenario)){
    eq(events,scenario==='missing_renderer'?[]:['reserve'],'failed reservation must not request auth or data');
    eq(feedback.hidden,false,'persistent campaign-row alert is visible');
    assert.match(feedback.textContent,scenario==='blocked'?/browser could not open.*Allow pop-ups/:scenario==='missing_renderer'?/Report module didn’t load/:/MOCK window unavailable/);checks++;
    eq(button.disabled,false);eq(button.textContent,'Report');
  }else{
    eq(events,scenario==='json'?['session']:['reserve','session'],'reservation remains inside synchronous click, before auth await');
    eq(button.disabled,true);eq(button.textContent,'…');
    if(scenario!=='json'){eq(popup.opener,null);assert.match(popup.document.body.innerHTML,/Preparing report/);checks++;}
  }
  releaseSession();await new Promise(resolve=>setImmediate(resolve));
  if(['blocked','missing_renderer','reserve_throws'].includes(scenario)){
    eq(requests.length,0);eq(opened.length,0);eq(closeCalls,0);
  }else{
    eq(requests.length,1);eq(button.disabled,false);eq(button.textContent,scenario==='json'?'JSON':'Report');
    if(scenario==='success'){
      eq(opened,[{model:{saved:result},popup}],'reserved window passed to renderer');eq(feedback.hidden,true);eq(closeCalls,0);
    }else if(scenario==='json'){
      eq(downloads,[{value:result,tool:'structural_clarity'}]);eq(opened.length,0);eq(feedback.hidden,true);eq(closeCalls,0);
    }else{
      eq(opened.length,0);eq(closeCalls,1);eq(popup.closed,true);eq(feedback.hidden,false);
      assert.match(feedback.textContent,/Couldn’t open that report:/);checks++;
    }
  }
  assert.match(board.innerHTML,/<p class="note bad rcp-report-error" role="alert" hidden><\/p>/);checks++;
  eq(downloads.length,scenario==='json'?1:0);
  // Real feedback code uses plain text, not HTML. The alert spans its own row.
  assert.match(source,/feedback\.textContent=message; feedback\.hidden=!message/);checks++;
  assert.match(html,/\.rcp-report-error\{grid-column:1\/-1;margin:0;overflow-wrap:anywhere\}/);checks++;
}}catch(error){
  // A data-URL stack would dump the entire module into CI logs. Keep the real
  // failure type/message, while the source digest identifies the exact module.
  throw new Error(`Isolated campaign module ${sha(modules[1])}: ${error.name}: ${error.message}`);
}
finally{for(const key of globals){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}}
console.log(JSON.stringify({status:'PASS_MOCK_ONLY',checks,scenarios:scenarios.length,sourceSha256:sha(html),campaignModuleSha256:sha(modules[1]),rendererSha256:sha(renderer),
  boundary:'Actual isolated campaign ES module and registered click listener; real reservation helper; MOCK DOM/session/saved-report API, no preceding module, no browser/provider/database/credential access.'}));
