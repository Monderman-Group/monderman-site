// One display label only. Saved answers, scores, priority evidence and AI text remain exact.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function sourceBeforeRenderer42(source){
 if(!source.includes('diagnostic-renderer-evidence-reading-20260914.42'))return source;
 const label='    "Accountability clarity": "Clarity about who is accountable",\n    "Compensatory dependence": "Extra effort and management support"';
 assert.equal(source.split(label).length,2);source=source.replace(label,'    "Accountability clarity": "Clarity about who is accountable"');
 source=source.replace('diagnostic-renderer-evidence-reading-20260914.42','diagnostic-renderer-evidence-reading-20260914.41');
 assert.equal(sha(source),'ade13a2f1ca4b5e1b9f7c1814f08b9af2ae0436fb5dfc71b228f985d17e955cb');return source;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(import.meta.dirname,'..'),source=fs.readFileSync(root+'/monderman-report.js','utf8'),old=sourceBeforeRenderer42(source);
 const load=s=>{const c={window:{}};vm.runInNewContext(fs.readFileSync(root+'/participant-evidence-safety.js','utf8'),c);vm.runInNewContext(s,c);return c.window.MondermanReport;};
 const R=load(source),prior=load(old);let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
 const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
 for(const label of ['Compensatory dependence','Unmapped label','A participant wrote: Compensatory dependence']){
  const input=freeze({tool_type:'institutional_performance',score:48,score_band:'Drag',canonical_descriptor:{dominant_burden_label:label,priority_ladder:[{focus:label,key:'compensation',severity:48}]},key_findings:['Original evidence: '+label],answers:{note:label},ai_report:{status:'unavailable',report:{interpretation:{summary:label}}}}),before=JSON.stringify(input),m=R.fromRun(input),p=prior.fromRun(input);
  eq(m.primarySignal,label==='Compensatory dependence'?'Extra effort and management support':label);eq(m.source,input);eq(JSON.stringify(input),before);eq(m.score,p.score);eq(m.band,p.band);eq(m.priorityLadder,p.priorityLadder);eq(m.aiReport,input.ai_report);eq(m.source.answers.note,label);
 }
 assert.throws(()=>sourceBeforeRenderer42(source+'\nUNREVIEWED'));checks++;
 console.log(JSON.stringify({status:'PASS',checks,priorRendererSha256:sha(old),savedInputsUnchanged:true,authoredProseUnchanged:true,providerCalls:0}));
}
