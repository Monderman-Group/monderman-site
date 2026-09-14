// Display-only regression. Small diagnostic counterexamples, not generated or
// approved reports. Actual sample35 prompted the cases (immutable receipt
// 80bd4e83b35f68e1882d50dc4c296c567b572224fbfdb967c1fc8ad10c8accb1).
// No providers, browser, storage, artifact writes or scoring operations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'participant-evidence-safety.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(root, 'monderman-report.js'), 'utf8'), context);
const report = context.window.MondermanReport;
let checks = 0;
const check = fn => {fn(); checks++;};
const frozen = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
};
const labels = [
  ['operational_systems', 'workaround_dependence', 'Off-formal-path execution', 'Work outside the standard process'],
  ['decision_velocity', 'escalation', 'Escalation dependence', 'Decisions referred to a higher level'],
  ['structural_clarity', 'accountability_clarity', 'Accountability clarity', 'Clarity about who is accountable'],
  ['institutional_performance', 'compensation', 'Compensatory dependence', 'Extra effort and management support']
];
const benchmark = "This reference comes from the instrument's design, not customer or industry data. It does not change the score or the modeled recovery scenario. Use the workload assumptions, measured dimensions, and repeated measurements when deciding what to do.";
const relationship = 'Those measured conditions co-occur; any time, cost, or capacity figures elsewhere in the report are modeled from submitted inputs, not observed consumption or realized loss.';

for (const [tool, key, original, display] of labels) {
  for (const direction of ['up', 'down', 'flat', 'unknown']) {
    const source = frozen({tool_type: tool, score: 53, band: 'Recorded band', process_name: 'QA local scope',
      dimensions: {[key]: 53},
      answers: {time_comparison: 'About the same'},
      trajectory: {direction, label: 'Legacy direction conclusion', delta: 3,
        self_reported: true, evidence_type: 'self_reported_change_signal', longitudinal_measurement: false,
        note: 'No self-reported change evidence was recorded.'},
      canonical_descriptor: {dominant_burden_label: original, primary_constraint_key: key,
        trajectory_note: 'Legacy inferred change note',
        priority_ladder: [{key, focus: original, priority: 'Monitor', severity: 53}]},
      key_findings: ['Recorded answer to the past-year comparison: About the same.', 'Original evidence label: ' + original],
      participant_evidence: [{label: 'Managerial', text: 'The participant reports less work in the stated comparison period; this is their account.'}],
      interpretive_prose: {benchmark_interpretation: benchmark}, quadrant_interpretation_text: relationship});
    const before = JSON.stringify(source), model = report.fromRun(source), html = report.buildReportHtml(model);
    check(() => assert.equal(JSON.stringify(source), before, 'Stored result unchanged'));
    check(() => assert.equal(model.source, source, 'Exact source object retained'));
    check(() => assert.equal(model.score, 53));
    check(() => assert.equal(model.band, 'Recorded band'));
    check(() => assert.equal(model.trajectoryObject, source.trajectory, 'Legacy trajectory remains available as source'));
    check(() => assert.equal(model.trajectoryLabel, 'Not established by this run'));
    check(() => assert.equal(model.trajectoryNote, ''));
    check(() => assert.match(html, /Change over time/));
    check(() => assert.doesNotMatch(html, /Participant reports more|Participant reports less|Participant reports little change|Participant-reported change|No self-reported change evidence was recorded|Legacy inferred change note|Legacy direction conclusion/));
    check(() => assert.ok(html.includes('Recorded answer to the past-year comparison: About the same.')));
    check(() => assert.ok(html.includes(source.participant_evidence[0].text), 'Attributed temporal account remains exact'));
    check(() => assert.equal(model.primarySignal, display));
    check(() => assert.ok(model.coverBody.includes(display)));
    check(() => assert.equal(model.descriptor.primary_constraint_key, key));
    check(() => assert.equal(model.priorityLadder[0].focus, original, 'No global replacement of original evidence labels'));
    check(() => assert.ok(html.includes('Original evidence label: ' + original)));
    check(() => assert.equal(model.benchmarkDetail, "This reference comes from the instrument's design, not customer or industry data. It does not change the score. Use the recorded answers, measured dimensions, and repeated measurements when deciding what to do."));
    check(() => assert.equal(model.quadrant, 'Those measured conditions co-occur.'));
    check(() => assert.doesNotMatch(html, /modeled recovery scenario|figures elsewhere in the report are modeled/));
  }
}

for (const trajectory of [undefined, null, 'Participant reports more delay', {}, {direction: 'down', measurement_basis: 'not_measured'},
  {direction: 'flat', label: 'Stable'}, {direction: 'up', label: 'Elevated change-pressure risk'}]) {
  const source = frozen({tool_type: 'institutional_performance', score: 62, trajectory,
    trajectory_label: 'Unsupported alternate label', trajectory_signal: 'Unsupported alternate signal',
    canonical_descriptor: {dominant_burden_label: '<script>unmapped</script>'},
    interpretive_prose: {benchmark_interpretation: 'A separate, recorded sentence about cost.'},
    quadrant_interpretation_text: 'Recorded relationship statement.'});
  const model = report.fromRun(source), html = report.buildReportHtml(model);
  check(() => assert.equal(model.trajectoryLabel, 'Not established by this run'));
  check(() => assert.doesNotMatch(html, /Unsupported alternate|Elevated change-pressure risk|Participant reports more delay/));
  check(() => assert.equal(model.benchmarkDetail, 'A separate, recorded sentence about cost.', 'No arbitrary financial prose rewrite'));
  check(() => assert.equal(model.quadrant, 'Recorded relationship statement.'));
  check(() => assert.ok(html.includes('&lt;script&gt;unmapped&lt;/script&gt;')));
  check(() => assert.ok(!html.includes('<script>unmapped</script>')));
}
// No automatic rewriting of an AI graph, even when its wording mentions a
// legacy label or change. Semantic approval belongs to its independent audit.
const ai = frozen({status: 'unavailable', interpretation: {summary: {text: 'Exact legacy label: Off-formal-path execution.'}}});
const source = frozen({tool_type: 'operational_systems', score: 53, ai_report: ai});
check(() => assert.equal(report.fromRun(source).aiReport, ai));
check(() => assert.equal(JSON.stringify(report.fromRun(source).source), JSON.stringify(source)));
console.log(JSON.stringify({status: 'PASS', checks, scope: 'Single-run display source fidelity; diagnostic fixtures only', providerCalls: 0, writes: 0, pdfs: 0}));
