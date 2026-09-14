// Real saved-report handlers and renderer, MOCK saved GET/auth/DOM only.
// No browser, credentials, provider, database, or timestamp fabrication.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=fileURLToPath(new URL('..',import.meta.url));
const revision=process.env.SAVED_REPORT_DATE_SOURCE_REVISION;
if(revision)assert.match(revision,/^[a-f0-9]{40}$/);
const read=file=>revision?execFileSync('git',['show',`${revision}:${file}`],{cwd:root,encoding:'utf8'}):readFileSync(new URL('../'+file,import.meta.url),'utf8');
const workspace=read('workspace-diagnostics.html'),dv=read('decision-velocity.html'),renderer=read('monderman-report.js');
const modules=[...workspace.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(modules.length,2);
const runSource=modules[0].match(/    async function exportRun\([\s\S]*?\n    \}/)?.[0];
const campaignSource=modules[1].match(/    async function exportAssignmentRun\([\s\S]*?\n    \}/)?.[0];
const journey=dv.match(/const journeyReady = \(async \(\) => \{[\s\S]*?\n\}\)\(\);/)?.[0];
assert.ok(runSource&&campaignSource&&journey,'all production saved-report opening/rebuilding paths are present');
const rendererContext=vm.createContext({window:{}});
vm.runInContext(renderer,rendererContext,{filename:'monderman-report.js'});
const fromRun=rendererContext.window.MondermanReport.fromRun;
const clone=x=>JSON.parse(JSON.stringify(x));
const sha=x=>createHash('sha256').update(x).digest('hex');
let checks=2;
function eq(actual,expected,label){assert.deepEqual(clone(actual),clone(expected),label);checks++;}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const savedAt='2026-09-14T23:50:00Z',old='2026-08-01T01:00:00Z',older='2026-07-01T01:00:00Z';
const cases=[
  ['server savedAt',{},savedAt,'September 14, 2026'],
  ['generated precedence',{generated_at:old,completed_at:older,created_at:older},savedAt,'August 1, 2026'],
  ['completed precedence',{completed_at:old,created_at:older},savedAt,'August 1, 2026'],
  ['created precedence',{created_at:old,provenance:{generated_at:older}},savedAt,'August 1, 2026'],
  ['provenance precedence',{provenance:{generated_at:old},report_provenance:{generated_at:older}},savedAt,'August 1, 2026'],
  ['provenance_json precedence',{provenance_json:{generated_at:old}},savedAt,'August 1, 2026'],
  ['report provenance fallback',{report_provenance:{generated_at:old}},savedAt,'August 1, 2026'],
  ['issuance beats report provenance',{generated_at:old,report_provenance:{generated_at:older}},savedAt,'August 1, 2026'],
  ['invalid generated keeps completed',{generated_at:'not-a-date',completed_at:old},savedAt,'August 1, 2026'],
  ['invalid provenance falls through',{provenance:{generated_at:'not-a-date'},report_provenance:{generated_at:old}},savedAt,'August 1, 2026'],
  ['invalid legacy dates use savedAt',{generated_at:0,created_at:'bad',provenance:{generated_at:'bad'}},savedAt,'September 14, 2026'],
  ['renderer provenance object precedence',{provenance:{},provenance_json:{generated_at:old}},savedAt,'September 14, 2026'],
  ['missing server date',{},undefined,'Not recorded'],
  ['null server date',{},null,'Not recorded'],
  ['invalid server date',{},'not-a-date','Not recorded'],
  ['non ISO server date',{},'09/14/2026','Not recorded'],
  ['numeric server date',{},Date.parse(savedAt),'Not recorded'],
  ['no server date preserves legacy',{generated_at:old},undefined,'August 1, 2026'],
  ['missing legacy tool type',{tool_type:undefined},savedAt,'September 14, 2026'],
  ['null legacy tool type',{tool_type:null},savedAt,'September 14, 2026'],
  ['empty legacy tool type',{tool_type:''},savedAt,'September 14, 2026']
];
const runId='11111111-1111-4111-8111-111111111111',orgId='22222222-2222-4222-8222-222222222222';
function result(fields,tool='structural_clarity',status='complete'){
  return freeze({tool_type:tool,score:76,primary_signal:'MOCK exact signal',input_context:{process_name:'MOCK work'},
    ai_report:{status,interpretation:{summary:'MOCK saved prose, never regenerated'}},...fields});
}
function verifyModel(model,raw,expected,label){
  eq(model.meta.find(row=>row.label==='Recorded')?.value,expected,label+' recorded date');
  const before=clone(fromRun(raw)),after=clone(model);
  for(const value of [before,after]){
    value.meta=value.meta.filter(row=>row.label!=='Recorded');
    // The renderer retains the presentation argument as model.source. Only
    // its date fallback may differ; its saved scores/prose/provenance may not.
    delete value.source.created_at;
  }
  eq(after,before,label+' every non-date model field unchanged');
}
for(const [label,fields,date,expected] of cases){
  for(const [name,source] of [['run history',runSource],['campaign',campaignSource]]){
    for(const mode of ['report','json']){
      const raw=result(fields),payload=freeze({ok:true,runId,result:raw,savedAt:date}),before=JSON.stringify(payload);
      const models=[],downloads=[],inputs=[],requests=[],popup={};
      const Report={fromRun(value){inputs.push(value);return fromRun(value);},
        openReport(model,window){assert.equal(window,popup);models.push(model);},
        downloadJson(value){downloads.push(value);},closeReservedReportWindow(){throw new Error('unexpected failed report');}};
      const context=vm.createContext({window:{MondermanReport:Report},state:{orgId},API_BASE:'https://fixture.invalid',
        supabase:{auth:{getSession:async()=>({data:{session:{access_token:'MOCK'}}})}},
        apiAuthHeaders:async()=>({Authorization:'Bearer MOCK','X-Monderman-Organization-Id':orgId}),
        campaignReportFeedback(){},flash(){throw new Error('unexpected saved report error');},
        fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>payload};}});
      const handler=vm.runInContext(`(${source})`,context);
      const button={textContent:'Report',disabled:false};
      await (name==='run history'?handler(runId,mode,button,popup):handler(runId,'structural_clarity',mode,button,popup));
      eq(requests.length,1,label+' exact one saved GET');
      eq(requests[0].url,`https://fixture.invalid/api/runs/${runId}/report`);
      eq(requests[0].options.headers,{'Authorization':'Bearer MOCK','X-Monderman-Organization-Id':orgId});
      eq(JSON.stringify(payload),before,label+' original payload is immutable');
      eq(button,{textContent:'Report',disabled:false});
      if(mode==='json'){
        eq(downloads,[raw],label+' portable JSON stays original');eq(models.length,0);eq(inputs.length,0);
      }else{
        eq(downloads.length,0);eq(models.length,1);
        const rawFields=clone(inputs[0]),originalFields=clone(raw);delete rawFields.created_at;delete originalFields.created_at;
        eq(rawFields,originalFields,label+' presentation copy retains every other raw field');
        verifyModel(models[0],raw,expected,name+' '+label);
      }
    }
  }
  // Execute the complete production saved-report recovery branch, including
  // its identity check, initial rendering, AI-complete poll, and export model.
  const first=result(fields,'decision_velocity','pending'),last=result(fields,'decision_velocity');
  const initial=freeze({ok:true,runId,result:first,savedAt:date}),complete=freeze({ok:true,runId,result:last,savedAt:date});
  const before=JSON.stringify([initial,complete]),models=[],exports=[],requests=[];
  let poll;
  const elements=[];
  function element(){const node={children:[],classList:{add(){}},appendChild(child){this.children.push(child);},
    addEventListener(event,callback){this[event]=callback;},querySelector(){throw new Error('saved recovery unexpectedly failed');}};elements.push(node);return node;}
  const Report={fromRun,render(_node,model){models.push(model);},mountAIInterpretation(_node,raw,callback){assert.equal(raw,first);poll=callback;},
    downloadHtml(model){exports.push(model);},downloadPdf(model){exports.push(model);}};
  const context=vm.createContext({window:{MondermanReport:Report,mondermanWorkspaceAccessReady:Promise.resolve(),
      mondermanGetSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'MOCK-user'}}})}}),
      MondermanDVJourneyRecovery:{watchVerifiedIdentity(_client,identity){assert.equal(identity,'MOCK-user');}}},
    document:{readyState:'complete',createElement:element},location:{search:'?saved_report='+runId},URLSearchParams,
    state:{journeyInvalidated:false},processingStage:element(),pageLoader:element(),showStage(){},setHeader(){},
    API_BASE:'https://fixture.invalid',FINALIZE_TIMEOUT_MS:1000,
    fetchWithTimeout:async(url)=>{requests.push(url);return {ok:true,json:async()=>requests.length===1?initial:complete};}});
  await vm.runInContext(journey+'\njourneyReady;',context);
  eq(models.length,1,label+' DV initial report rendered');verifyModel(models[0],first,expected,'DV initial '+label);
  assert.equal(typeof poll,'function');checks++;
  assert.equal(await poll(),last);checks++;
  eq(models.length,2,label+' DV completed report rendered');verifyModel(models[1],last,expected,'DV completed '+label);
  const buttons=elements.filter(node=>node.textContent==='Download full report (HTML)'||node.textContent==='Print / save PDF');
  eq(buttons.length,2);buttons.forEach(button=>button.click());
  eq(exports,[models[1],models[1]],label+' downloads use latest dated model');
  eq(requests,[`https://fixture.invalid/api/runs/${runId}/report`,`https://fixture.invalid/api/runs/${runId}/report`]);
  eq(JSON.stringify([initial,complete]),before,label+' DV originals unchanged');
}
console.log(JSON.stringify({status:'PASS_MOCK_ONLY',checks,dateCases:cases.length,renderPaths:4,
  workspaceSha256:sha(workspace),dvSha256:sha(dv),rendererSha256:sha(renderer),
  boundary:'Real handler bodies isolated by module; full DV saved recovery branch and unchanged renderer. Synthetic immutable saved responses only; JSON and non-date fields identical. No actual browser, API, provider, or credential access.'}));
