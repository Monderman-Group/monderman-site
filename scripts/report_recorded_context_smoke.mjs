// Application-written qualifications must not depend on model selections.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const Report=sandbox.window.MondermanReport;
const fact=(label,value,provenance)=>({label,value,provenance});
const scenario=['Modeled annual hours of exposure','Modeled annual labor-cost exposure','Scenario recovery hours','Scenario recovery cost'];
const evidence=[fact('Decision timing evidence coverage','Not measured','deterministic_coverage'),
  ...scenario.map(label=>fact(label,null,'modeled_scenario')),
  fact('Reason an exposure estimate was withheld','Required sizing inputs missing or unusable','deterministic_sizing_status'),
  fact('Contradictions flagged',1,'deterministic_result'),
  fact('Eligible questions without a supplied answer',16,'deterministic_answer_coverage')];
const state=rows=>({status:'complete',report:{model:'claude-opus-5',composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'},evidence:rows,
  interpretation:{summary:'Saved result.',observations:[],hypotheses:[],recommendations:[{action:'Review a permitted example.',reason:'Recorded answer.',prerequisite:'Permission is required.',risk:'Do not generalize.',success_check:'Record what is found.',source_ids:[]}],limitations:[]},
  limitations:['Missing evidence remains unknown.'],sources:[],benchmark:{explanation:'No peer benchmark.'}}});
let checks=0;
function check(fn){fn();checks++;}
const full=state(evidence),before=JSON.stringify(full),html=Report.buildAIInterpretation(full);
check(()=>assert.match(html,/Not measured: Decision timing\. No score is available for this dimension\. Related answers may still be reported separately\./));
check(()=>assert.match(html,/Time and cost estimates are unavailable\. Recorded reason: Required sizing inputs missing or unusable\./));
check(()=>assert.match(html,/records one contradiction flag\. A flag does not establish that answers conflict or identify a cause, person, or answer pair\./));
check(()=>assert.ok(html.indexOf('Important context from the saved result')<html.indexOf('Suggested next steps')));
check(()=>assert.doesNotMatch(html,/16|incomplete run|missed required|time per run|labor rate/));
check(()=>assert.equal(JSON.stringify(full),before));
const mixedIP=state([fact('Extra effort required evidence coverage','Not measured','deterministic_coverage'),fact('Results depend on extra effort','Results depend on extra effort','participant_structured_answer')]);
mixedIP.report.interpretation.observations=[{text:'The recorded answer says results depend on extra effort.',source_ids:[]}];
const mixedBefore=JSON.stringify(mixedIP),mixedHTML=Report.buildAIInterpretation(mixedIP);
check(()=>assert.match(mixedHTML,/Not measured: Extra effort required\. No score is available for this dimension/));
check(()=>assert.match(mixedHTML,/The recorded answer says results depend on extra effort/));
check(()=>assert.doesNotMatch(mixedHTML,/condition remains unknown|conditions remain unknown/));
check(()=>assert.equal(JSON.stringify(mixedIP),mixedBefore));
check(()=>assert.doesNotMatch(Report.buildAIInterpretation(state([])),/mr-ai-recorded-context/));
check(()=>assert.doesNotMatch(Report.buildAIInterpretation(state([evidence.at(-1)])),/mr-ai-recorded-context/));
check(()=>assert.match(Report.buildAIInterpretation(state([fact(scenario[0],null,'modeled_scenario')])),/Some modeled time or cost estimates are unavailable/));
check(()=>assert.doesNotMatch(Report.buildAIInterpretation(state(scenario.map(label=>fact(label,0,'modeled_scenario')))),/mr-ai-recorded-context/));
for(const value of [0,-1,1.5,'1',null,Number.NaN,Number.POSITIVE_INFINITY])check(()=>assert.doesNotMatch(Report.buildAIInterpretation(state([fact('Contradictions flagged',value,'deterministic_result')])),/contradiction flag/));
check(()=>assert.match(Report.buildAIInterpretation(state([fact('Contradictions flagged',2,'deterministic_result')])),/records 2 contradiction flags/));
for(const item of evidence)check(()=>assert.doesNotMatch(Report.buildAIInterpretation(state([{...item,provenance:'participant_structured_answer'}])),/mr-ai-recorded-context/));
check(()=>assert.equal((Report.buildAIInterpretation(state([evidence[0],evidence[0]])).match(/Not measured: Decision timing/g)||[]).length,1));
const hostile=state([fact('<script>bad()</script> evidence coverage','Not measured','deterministic_coverage'),fact(scenario[0],null,'modeled_scenario'),fact('Reason an exposure estimate was withheld','<img src=x onerror=bad()>','deterministic_sizing_status')]);
check(()=>assert.doesNotMatch(Report.buildAIInterpretation(hostile),/<script>|<img /));
check(()=>assert.match(Report.buildAIInterpretation(hostile),/&lt;script&gt;/));
const historical=state(evidence);delete historical.report.composition;
check(()=>assert.doesNotMatch(Report.buildAIInterpretation(historical),/mr-ai-recorded-context/));
for(const tool of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const run={tool_type:tool,score:70,band:'Compounding',dimensions:{available:80,unknown:null},measurement_coverage:{dimensions:{available:{status:'measured',evidence_count:1},unknown:{status:'not_measured',evidence_count:0},omitted:{status:'not_measured',evidence_count:0}}}};
  const original=JSON.stringify(run),m=Report.fromRun(run),page=Report.buildReportHtml(m);
  check(()=>assert.equal(m.dimensionEntries.length,3));
  check(()=>assert.equal(m.dimensionEntries.filter(row=>row.score===null).length,2));
  check(()=>assert.equal((page.match(/class="mr-dimension-row is-unmeasured"/g)||[]).length,2));
  check(()=>assert.equal((page.match(/class="mr-dimension-track"/g)||[]).length,1));
  check(()=>assert.match(page,/No score is available for this dimension\. Related answers may still be reported separately/));
  check(()=>assert.equal(JSON.stringify(run),original));
}
for(const coverage of [{status:'measured',value:80},{status:'measured'},{}]){
 const raw={tool_type:'decision_velocity',score:70,dimensions:{unavailable:null},measurement_coverage:{dimensions:{unavailable:coverage}}};
 const page=Report.buildReportHtml(Report.fromRun(raw));
 check(()=>assert.match(page,/is-unavailable/));
 check(()=>assert.match(page,/Score unavailable/));
 check(()=>assert.doesNotMatch(page,/is-unmeasured|>Not measured</));
}
console.log(JSON.stringify({passed:true,checks,scope:'Saved-evidence context, unknown dimension rows, escaping and immutability; no model quality or live-path claim',providerCalls:0}));
