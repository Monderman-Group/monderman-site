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
for (const text of ['1.3.0','original-scorer','diagnostic-report-language-20260908','diagnostic-renderer-ai-screen-20260909.20']) assert.ok(currentHtml.includes(text),text);
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
for (const status of ['pending','deferred','failed','complete']) {
  const run=make({priority_actions:['GENERIC_FIRST_TEST_FIXTURE'],ai_report:{status,report:{interpretation:{summary:'Reviewed tailored interpretation.',observations:[],hypotheses:[],recommendations:[],limitations:[]}}}});
  const before=JSON.stringify(run);
  const html=report.buildReportHtml(report.fromRun(run));
  if(status==='complete')assert.doesNotMatch(html,/GENERIC_FIRST_TEST_FIXTURE/,'completed AI recommendations must not compete with the generic first move');
  else assert.match(html,/GENERIC_FIRST_TEST_FIXTURE/,'keep the deterministic fallback when reviewed AI is unavailable');
  assert.equal(JSON.stringify(run),before);
}
const migrated = make({report_language:{origin_version:'diagnostic-report-language-pre-20260908',generation_version:'diagnostic-report-language-20260908',migration:{from_version:'diagnostic-report-language-pre-20260908'}}});
assert.match(report.buildReportHtml(report.fromRun(migrated)),/Report wording was generated with a newer template/);
const hostile = make({report_language:{generation_version:'<script>alert(1)</script>'},questionnaire_version:'<img src=x onerror=alert(1)>'});
const escaped = report.buildReportHtml(report.fromRun(hostile));
assert.doesNotMatch(escaped,/<script>alert|<img src=x/);
assert.match(escaped,/&lt;script&gt;/);
// OS historical display compatibility: direct probes are not answer conflicts.
const osLegacy='Some submitted answers conflict about formal-system burden and reported operating experience; broader evidence is needed.';
const onePattern='The saved result flags one response pattern. Review its recorded condition and qualification before drawing a conclusion.';
const twoPatterns='The saved result flags 2 response patterns. Review each recorded condition and qualification before drawing a conclusion.';
const unknownPattern='The saved report includes a caution flag, but this view does not establish which responses or conditions it concerns.';
const directProbe={code:'probe_work_happens_off_path',message:'The submitted answer reports that a lot of the work happens outside the official path. This run does not measure the complete workflow record.'};
const comparison={code:'burden_experience_comparison',message:'A comparison flag is recorded; it does not establish a cause.'};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
for(const [contradictions,expected] of [
  [[directProbe],onePattern],[[comparison],onePattern],[[directProbe,comparison],twoPatterns],
  [['recorded flag'],onePattern],[[{label:'Recorded condition'}],onePattern],
  [undefined,unknownPattern],[null,unknownPattern],[[],unknownPattern],[{},unknownPattern],
  [[{}],unknownPattern],[[null],unknownPattern],[[' '],unknownPattern],[[directProbe,{}],unknownPattern]
]){
  for(const field of ['key_findings','flags','findings']){
    const source=freeze({tool_type:'operational_systems',score:27,band:'Constrained',dimensions:{burden:27},[field]:['Unrelated wording is unchanged.',osLegacy],contradictions});
    const before=JSON.stringify(source),model=report.fromRun(source),html=report.buildReportHtml(model);
    assert.equal(model.findings[0],'Unrelated wording is unchanged.');
    assert.equal(model.findings[1],expected);assert.ok(html.includes(expected));assert.ok(!html.includes(osLegacy));
    assert.equal(model.score,27);assert.equal(JSON.stringify(source),before,'display must not mutate frozen scores, findings, or flags');
    if(contradictions?.[0]===directProbe)assert.ok(html.includes(directProbe.message),'preserve the recorded qualification');
  }
}
for(const tool_type of ['decision_velocity','structural_clarity','institutional_performance']){
  const source=freeze({tool_type,score:27,key_findings:[osLegacy],contradictions:[directProbe]});
  assert.equal(report.fromRun(source).findings[0],osLegacy,'exact OS compatibility must not rewrite other diagnostics');
}
const osNonTarget=freeze({tool_type:'operational_systems',key_findings:[osLegacy+' ',{message:osLegacy},'Already qualified wording.'],contradictions:[directProbe]});
assert.equal(JSON.stringify(report.fromRun(osNonTarget).findings),JSON.stringify(osNonTarget.key_findings),'only the exact legacy string is adapted');
console.log('REPORT_LANGUAGE_PROVENANCE_PASS: historical/current/migrated metadata, escaping, bounded OS flag display; frozen source objects and scores unchanged.');
