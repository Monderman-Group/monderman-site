import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox = {window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const report = sandbox.window.MondermanReport;
const make = extra => ({tool_type:'institutional_performance',score:72,band:'Compounding',...extra});
const historical = make({});
const historicalBefore = JSON.stringify(historical);
const oldHtml = report.buildReportHtml(report.fromRun(historical));
assert.equal(report.fromRun(historical).toolLabel,'Institutional Performance');
assert.match(oldHtml,/Questionnaire version<\/dt><dd>Not recorded/);
assert.match(oldHtml,/Report wording version<\/dt><dd>Not recorded/);
assert.match(oldHtml,/Current display version/);
assert.equal(JSON.stringify(historical),historicalBefore,'viewing historical results must not backfill provenance');
const current = make({questionnaire_version:'1.3.0',config_version:'1.3.0',scorer_version:'original-scorer',report_language:{origin_version:'diagnostic-report-language-20260908',generation_version:'diagnostic-report-language-20260908'}});
const currentBefore = JSON.stringify(current);
const currentHtml = report.buildReportHtml(report.fromRun(current));
assert.doesNotMatch(currentHtml,/Why this option appears here/,'independent remedy and priority lists must not invent an array-index evidence pairing');
for (const text of ['1.3.0','original-scorer','diagnostic-report-language-20260908','diagnostic-renderer-ai-20260909.3']) assert.ok(currentHtml.includes(text),text);
assert.equal(JSON.stringify(current),currentBefore);
// Real populated, deliberately different lists: an empty fixture cannot catch
// reintroducing the former array-position evidence pairing.
const independent = make({
  priority_ladder:[{focus:'Measured stability',severity:40,priority:'First'}],
  remedy_paths:[{label:'Small test',summary:'Test one change.',actions:['Name an owner.'],benefit:'Learn before extending the change.'}]
});
const independentBefore = JSON.stringify(independent);
const independentHtml = report.buildReportHtml(report.fromRun(independent));
assert.match(independentHtml,/mr-run-remedy/,'populated recommendation fixture must render');
assert.match(independentHtml,/Measured stability/,'measured priority must remain visible');
assert.match(independentHtml,/do not correspond one-to-one/,'independent lists need an explicit interpretation boundary');
assert.doesNotMatch(independentHtml,/<div class="mr-remedy-evidence"|Why this option appears here/,'do not manufacture evidence by array position');
assert.equal(JSON.stringify(independent),independentBefore);
const migrated = make({report_language:{origin_version:'diagnostic-report-language-pre-20260908',generation_version:'diagnostic-report-language-20260908',migration:{from_version:'diagnostic-report-language-pre-20260908'}}});
assert.match(report.buildReportHtml(report.fromRun(migrated)),/Report wording was generated with a newer template/);
const hostile = make({report_language:{generation_version:'<script>alert(1)</script>'},questionnaire_version:'<img src=x onerror=alert(1)>'});
const escaped = report.buildReportHtml(report.fromRun(hostile));
assert.doesNotMatch(escaped,/<script>alert|<img src=x/);
assert.match(escaped,/&lt;script&gt;/);
console.log('REPORT_LANGUAGE_PROVENANCE_PASS: unknown historical, current, explicitly migrated, escaped metadata; source objects unchanged.');
