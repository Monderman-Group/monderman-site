// Deterministic renderer regression. No model, network or scoring changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const report=sandbox.window.MondermanReport;
let checks=0;
const render=(tool,exposure)=>{
 const run={tool_type:tool,score:51,band:'Measured',business_unit:'team',exposure};
 const before=JSON.stringify(run),html=report.buildReportHtml(report.fromRun(run));
 assert.equal(JSON.stringify(run),before,'display must not modify saved measurements');
 assert.doesNotMatch(html,/Cost not calculated modeled annual labor cost|missing_sizing_inputs|missing_hourly_rate|\[object Object\]|\bNaN\b/);
 return html;
};
const timeMetric=html=>html.match(/Modeled annual time<\/div>([\s\S]*?)<\/div>\s*<div class="mr-run-metric"/)?.[1];
for(const tool of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
 const missing=render(tool,{annual_hours:null,annual_cost:null,priceable:false,unpriced_reason:'missing_sizing_inputs'});
 assert.match(timeMetric(missing),/Time not calculated/);assert.match(timeMetric(missing),/Labor cost not calculated/);
 assert.match(missing,/Required sizing inputs are missing or unusable\./);checks++;
 const zero=render(tool,{annual_hours:0,annual_cost:0,priceable:true,recoverable_cost:0});
 assert.match(timeMetric(zero),/0 hrs/);assert.match(timeMetric(zero),/\$0 modeled annual labor cost/);
 assert.doesNotMatch(timeMetric(zero),/not calculated/);checks++;
 const hours=render(tool,{annual_hours:120,annual_cost:null,priceable:false,unpriced_reason:'missing_hourly_rate'});
 assert.match(timeMetric(hours),/120 hrs/);assert.doesNotMatch(timeMetric(hours),/Time not calculated/);
 assert.match(hours,/Hourly labor rate is missing or unusable\./);checks++;
 const cost=render(tool,{annual_hours:null,annual_cost:800,priceable:false});
 assert.match(timeMetric(cost),/Time not calculated/);assert.match(timeMetric(cost),/\$800 modeled annual labor cost/);checks++;
 const unknown=render(tool,{annual_hours:null,annual_cost:null,priceable:false,unpriced_reason:'PRIVATE_INTERNAL_CODE<script>alert(1)</script>'});
 assert.doesNotMatch(unknown,/PRIVATE_INTERNAL_CODE|<script>alert/);assert.match(unknown,/An explanation for the unavailable estimate was not recorded\./);checks++;
 for(const [reason,text] of Object.entries({missing_hours_per_run:'Time per run is missing or unusable.',missing_annual_cycles:'Annual frequency is missing or unusable.',missing_hourly_cost:'Hourly labor cost is missing or unusable.',input_saturation:'The modeled hours meet or exceed the available capacity used in the calculation.',attributed_hours_exceed_available_capacity:'Attributed hours exceed the supplied available capacity.'})){
  const html=render(tool,{annual_hours:null,annual_cost:null,priceable:false,unpriced_reason:reason});
  assert(html.includes(text),reason);assert(!html.includes(reason),reason);checks++;
 }
 for(const reason of [null,{toString:0},['missing_sizing_inputs']]){
  const html=render(tool,{annual_hours:null,annual_cost:null,priceable:false,unpriced_reason:reason});
  assert(html.includes('An explanation for the unavailable estimate was not recorded.'));checks++;
 }
}
console.log(`REPORT_MISSING_ESTIMATE_PASS: ${checks} cases; four lenses, zero/missing/partial values, safe reason labels, immutable inputs.`);
