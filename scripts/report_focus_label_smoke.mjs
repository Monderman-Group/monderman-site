// One display label only. Saved answers, scores, priority evidence and AI text remain exact.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {sourceBeforeCustomerMetadata} from './report_customer_metadata_inverse.mjs';
import {sourceBeforeOverviewPresentation} from './report_overview_presentation_inverse.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const COMPOSITE_CLEARANCE_DELTA=[
 `      // Leave each score row clear of the reference line, regardless of its x-position.
      for (let index = 0; index <= groups.length; index++) {
        const y1 = index === 0 ? 36 : top + (index-1) * rowH + 12;
        const y2 = index === groups.length ? H-28 : top + index * rowH - 12;
        svg += '<line x1="' + X(m.score) + '" y1="' + y1 + '" x2="' + X(m.score) + '" y2="' + y2 + '" stroke="#08383E" stroke-width="2.5" stroke-dasharray="5 4"/>';
      }`,
 `      svg += '<line x1="' + X(m.score) + '" y1="36" x2="' + X(m.score) + '" y2="' + (H-28) + '" stroke="#08383E" stroke-width="2.5" stroke-dasharray="5 4"/>';`
];
// Keep historical renderer43/42/41 proofs exact after the display-only line clearance.
export function sourceBeforeCompositeClearance(source){
 source=sourceBeforeCustomerMetadata(source);
 if(source.includes(COMPOSITE_CLEARANCE_DELTA[0])){
  assert.equal(source.split(COMPOSITE_CLEARANCE_DELTA[0]).length,2,'Exact Composite clearance delta');
  source=source.replace(...COMPOSITE_CLEARANCE_DELTA);
 }
 assert.equal(sha(source),'f9ef16fdad67694f795e960d64a0acdac4271db56d0dab338d47cef31651f6d2');return source;
}
const PRINT43_DELTA=[
 ['.mr-run-close-group>.mr-leadership-close{margin-top:0!important;padding:14px 24px!important}', '.mr-run-close-group>.mr-leadership-close{margin-top:0!important}'],
 ['.mr-leadership-sequence li{padding-bottom:12px}\n      .mr-run-close-group .mr-leadership-sequence li{padding-bottom:8px}', '.mr-leadership-sequence li{padding-bottom:12px}']
];
// Revert only the two approved print-spacing rules, including their placement.
// HTML parity uses the same finite inverse as the complete source-hash proof.
export function restoreRenderer42PrintSpacing(text){
 for(const[now,before]of PRINT43_DELTA){assert.equal(text.split(now).length,2,'Exact renderer43 print-only delta');text=text.replace(now,before);}
 return text;
}
export function sourceBeforeRenderer43(source){
 source=sourceBeforeOverviewPresentation(source);
 if(!source.includes('diagnostic-renderer-evidence-reading-20260914.43'))return source;
 source=sourceBeforeCompositeClearance(source);
 source=restoreRenderer42PrintSpacing(source).replace('diagnostic-renderer-evidence-reading-20260914.43','diagnostic-renderer-evidence-reading-20260914.42');
 assert.equal(sha(source),'a9a4c77fc8099f78d0ec9a0a74d2a5eeca6f6bb387ea90043cfc79e6d212a2af');return source;
}
export function sourceBeforeRenderer42(source){
 source=sourceBeforeRenderer43(source);
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
 eq(R.rendererVersion,'diagnostic-renderer-change-wording-20260925.1');
 const priorClearance=sourceBeforeCompositeClearance(source);
 eq(sourceBeforeCompositeClearance(priorClearance),priorClearance,'Historical input passes idempotently');
 for(const mutate of [s=>s.replace('rowH + 12;','rowH + 11;'),s=>s.replace(COMPOSITE_CLEARANCE_DELTA[0],COMPOSITE_CLEARANCE_DELTA[0]+COMPOSITE_CLEARANCE_DELTA[0])]){
  const changed=mutate(source);assert.notEqual(changed,source);assert.throws(()=>sourceBeforeCompositeClearance(changed));checks++;
 }
 eq(sha(sourceBeforeRenderer43(source)),'a9a4c77fc8099f78d0ec9a0a74d2a5eeca6f6bb387ea90043cfc79e6d212a2af');
 const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
 for(const label of ['Compensatory dependence','Unmapped label','A participant wrote: Compensatory dependence']){
  const input=freeze({tool_type:'institutional_performance',score:48,score_band:'Drag',canonical_descriptor:{dominant_burden_label:label,priority_ladder:[{focus:label,key:'compensation',severity:48}]},key_findings:['Original evidence: '+label],answers:{note:label},ai_report:{status:'unavailable',report:{interpretation:{summary:label}}}}),before=JSON.stringify(input),m=R.fromRun(input),p=prior.fromRun(input);
  eq(m.primarySignal,label==='Compensatory dependence'?'Extra effort and management support':label);eq(m.source,input);eq(JSON.stringify(input),before);eq(m.score,p.score);eq(m.band,p.band);eq(m.priorityLadder,p.priorityLadder);eq(m.aiReport,input.ai_report);eq(m.source.answers.note,label);
 }
 assert.throws(()=>sourceBeforeRenderer42(source+'\nUNREVIEWED'));checks++;
 for(const mutate of [
  s=>s.replace('padding:14px 24px!important','padding:15px 24px!important'),
  s=>s.replace(PRINT43_DELTA[0][0],PRINT43_DELTA[0][1]),
  s=>s.replace(PRINT43_DELTA[0][0],PRINT43_DELTA[0][0]+PRINT43_DELTA[0][0]),
  s=>s.replace(PRINT43_DELTA[1][0],PRINT43_DELTA[1][1]),
  s=>s.replace(PRINT43_DELTA[1][0],PRINT43_DELTA[1][0]+PRINT43_DELTA[1][0]),
  s=>s.replace('padding-bottom:8px','padding-bottom:7px'),
  s=>s.replace('.mr-leadership-sequence li{padding-bottom:12px}','.mr-leadership-sequence li{padding-bottom:11px}'),
  s=>s.replace('.mr-leadership-close>h2{font-size:22pt!important','.mr-leadership-close>h2{font-size:21pt!important')
 ]){const changed=mutate(source);assert.notEqual(changed,source);assert.throws(()=>sourceBeforeRenderer42(changed));checks++;}
 console.log(JSON.stringify({status:'PASS',checks,priorRendererSha256:sha(old),savedInputsUnchanged:true,authoredProseUnchanged:true,providerCalls:0}));
}
