// Read-projection display only. Synthetic inputs; no provider, API or PDF calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const report=sandbox.window.MondermanReport;
let checks=0;
const check=fn=>{fn();checks++;};
for(const tool_type of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const source={tool_type,score:72,band:'Recorded',dimensions:{available:70},financial_legacy_view:{status:'updated_interpretation_required',omitted_display_fields:3,
    explanation:'Earlier unverified prose is withheld. Original stored scores and answers are unchanged.'}};
  const before=JSON.stringify(source),html=report.buildReportHtml(report.fromRun(source));
  check(()=>assert.equal(JSON.stringify(source),before));
  check(()=>assert.equal((html.match(/<aside class="mr-compatibility-notice mr-financial-legacy-notice"/g)||[]).length,1));
  check(()=>assert.match(html,/Earlier interpretation withheld/));
  check(()=>assert.match(html,/Earlier unverified prose is withheld/));
  check(()=>assert.match(html,/>72<\/div>/));
  check(()=>{const decision=/<section\b[^>]*class="mr-section mr-run-decision"[^>]*>/.exec(html);assert.ok(decision);assert.ok(html.indexOf('Earlier interpretation withheld')<decision.index);});
  check(()=>assert.doesNotMatch(html,/Time, cost, and capacity figures are estimates based on stated assumptions/));
  const current={...source};delete current.financial_legacy_view;
  check(()=>assert.doesNotMatch(report.buildReportHtml(report.fromRun(current)),/mr-financial-legacy-notice|Earlier interpretation withheld/));
  for(const status of ['complete','unknown','',null]){
    const candidate={...source,financial_legacy_view:{...source.financial_legacy_view,status}};
    check(()=>assert.doesNotMatch(report.buildReportHtml(report.fromRun(candidate)),/mr-financial-legacy-notice/));
  }
  const hostile={...source,financial_legacy_view:{status:'updated_interpretation_required',explanation:'<img src=x onerror=bad()> Original data remains unchanged.'}};
  const escaped=report.buildReportHtml(report.fromRun(hostile));
  check(()=>assert.doesNotMatch(escaped,/<img src=x onerror=bad\(\)>/));
  check(()=>assert.match(escaped,/&lt;img src=x onerror=bad\(\)&gt;/));
  const fallback={...source,financial_legacy_view:{status:'updated_interpretation_required'}};
  check(()=>assert.match(report.buildReportHtml(report.fromRun(fallback)),/The earlier interpretation requires an update under the current financial policy/));
}
console.log(JSON.stringify({status:'PASS',checks,scope:'Legacy financial omission notice, scores, immutability and escaping',providerCalls:0,liveWrites:0}));
