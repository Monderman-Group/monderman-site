import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../workspace-analysis.html',import.meta.url),'utf8');
const start=html.indexOf('    function isAnalysisEligible(run){');
const end=html.indexOf('    function renderTrust(',start);
assert.ok(start>=0&&end>start);
assert.match(html,/SYNTH_RUNS=rows\.filter\(isAnalysisEligible\)/);
const context=vm.createContext({Date,Number,Set,normalizeVantage:value=>value});
vm.runInContext(html.slice(start,end),context);
const eligible={status:'promoted',included_in_aggregates:true,normalization_status:'included',report_available:true,
  locked:false,tool_type:'decision_velocity',diagnostic_depth:10,participant_mode:'managerial',created_at:new Date().toISOString()};
const rows=[eligible,{...eligible,participant_mode:'senior_leader'},
  ...['structural_clarity','operational_systems','institutional_performance'].map(tool_type=>({...eligible,tool_type})),
  ...Array.from({length:6},()=>({...eligible,status:'staged',normalization_status:null,included_in_aggregates:false,diagnostic_depth:60})),
  {...eligible,status:'archived',normalization_status:null,diagnostic_depth:60}];
const before=JSON.stringify(rows),result=context.computeTrust(rows);
assert.equal(JSON.stringify(rows),before);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{total:12,incl:5,caut:0,excl:0,screened:5,inAggN:5,
  topTool:'decision_velocity',topN:2,depths:1,vants:2,recent:5});
let checks=1;
for(const patch of [{status:'staged'},{status:'archived'},{status:null},{included_in_aggregates:false},
  {included_in_aggregates:null},{normalization_status:null},{normalization_status:'excluded_from_aggregates'},
  {normalization_status:'unknown'},{report_available:false},{report_available:null},{locked:true}]){
  const row={...eligible,...patch};
  assert.equal(context.isAnalysisEligible(row),false);
  assert.equal(context.computeTrust([row]).inAggN,0);checks++;
}
const caution={...eligible,normalization_status:'included_with_caution'};
assert.equal(context.isAnalysisEligible(caution),true);
assert.equal(context.computeTrust([caution]).caut,1);checks++;
for(const created_at of [null,'invalid','2999-01-01T00:00:00Z','2020-01-01T00:00:00Z']){
  assert.equal(context.computeTrust([{...eligible,created_at}]).recent,0);checks++;
}
assert.equal(context.computeTrust([]).inAggN,0);checks++;
assert(html.includes('${t.screened} of ${t.total} runs have a recorded quality status.'),'stored quality counts must not claim a fresh screening');
assert(html.includes('Unusual answers are not automatically excluded.'),'quality boundary missing');
assert(html.includes("analysis_mode:'self_run_synthesis'"),'self-run request must use bounded mode');
assert(html.includes('run.self_run_owned_by_caller===true&&selected.has'),'self-run selection requires server-owned provenance');
assert.doesNotMatch(html,/const inAgg=st!=="excluded_from_aggregates"/);
console.log(`PASS workspace eligibility: ${checks} cases; actual inline summary/picker predicate; synthetic records only, no network or writes.`);
