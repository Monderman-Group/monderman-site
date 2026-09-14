// Display-policy regression: source answers are not organizational economics.
// Fixture prose is fabricated; this test makes no model-quality claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const report=sandbox.window.MondermanReport;
let checks=0;const check=fn=>{fn();checks++;};
for(const tool of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
 for(const exposure of [
  {annual_hours:null,annual_cost:null,priceable:false,unpriced_reason:'missing_sizing_inputs'},
  {annual_hours:0,annual_cost:0,recoverable_cost:0,priceable:true},
  {annual_hours:120,annual_cost:null,priceable:false,unpriced_reason:'missing_hourly_rate'},
  {annual_hours:null,annual_cost:800,priceable:false},
  {annual_hours:99000,annual_cost:9876543,recoverable_cost:654321,recoverable_hours:12345,priceable:true},
  {annual_hours:null,annual_cost:null,unpriced_reason:'PRIVATE_INTERNAL_CODE<script>alert(1)</script>'},
 ]){
  const run={tool_type:tool,score:51,band:'Measured',business_unit:'team',exposure,
   dimensions:{example:60},measurement_coverage:{dimensions:{example:{status:'measured',evidence_count:1}}},
   priority_actions:['Review one work example before proposing a change.']};
  const before=JSON.stringify(run),html=report.buildReportHtml(report.fromRun(run));
  check(()=>assert.equal(JSON.stringify(run),before));
  check(()=>assert.doesNotMatch(html,/Modeled annual time|Annual exposure|Modeled annual labor|Modeled annual hours|Observed recoverable estimate|9876543|9,876,543|654,321|PRIVATE_INTERNAL_CODE|<script>alert/));
  check(()=>assert.doesNotMatch(html,/Time not calculated|Labor cost not calculated|Required sizing inputs|Hourly labor rate is missing|\[object Object\]|\bNaN\b/));
  check(()=>assert.match(html,/One run does not establish organizational savings or recoverable time/));
  check(()=>assert.match(html,/Review one work example before proposing a change/));
  check(()=>assert.match(html,/51/));
 }
}
const state={status:'complete',report:{composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'},
 financial_output_policy:{version:'single-run-financial-policy-20260913.1'},
 evidence:[...['Modeled annual hours of exposure','Modeled annual labor-cost exposure','Scenario recovery hours','Scenario recovery cost'].map(label=>({label,value:null,provenance:'modeled_scenario'})),
  {label:'Reason an exposure estimate was withheld',value:'Single-run organizational financial projections are withheld by policy',provenance:'deterministic_sizing_status'}],
 interpretation:{summary:'The participant reports spending 7 hours per week preparing updates. This is a reported answer, not time recovered.',observations:[],hypotheses:[],recommendations:[],limitations:[]},
 limitations:[],sources:[],benchmark:{explanation:'No peer benchmark.'}}};
const before=JSON.stringify(state),html=report.buildAIInterpretation(state);
check(()=>assert.match(html,/7 hours per week preparing updates/));
check(()=>assert.doesNotMatch(html,/Time and cost estimates are unavailable|sizing inputs/));
check(()=>assert.equal(JSON.stringify(state),before));
console.log(JSON.stringify({status:'PASS',checks,scope:'All four single-run renderers with missing, zero, partial and populated legacy financials; score/actions and recorded time preserved; no provider calls.'}));
