// Offline regression for the actual DV page's output helpers and both export
// templates. Synthetic availability variants are not new diagnostic results.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../decision-velocity.html', import.meta.url), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const sandbox = {detectQualitativeOverride: () => ({type:'none'})};
vm.runInNewContext(
  between('function hasMeasuredDecisionTiming(', 'function derivePrimaryBurdenSource(') +
  between('function buildPrimaryReadSummary(', 'function buildExecutiveReportHtml('), sandbox);
let checks = 0;
const check = fn => {fn(); checks++;};
const harmonized = {diagnosisReads:{burdenRead:'Recorded timing.', sourceRead:'Recorded source.', diagnosisRead:'Recorded qualification.'}};
for (const score of [20, 78, 83, 99]) {
  for (const value of [undefined, null, '', '0', false, NaN, Infinity, 0, 45, 100]) {
    for (const status of [undefined, 'measured', 'not_measured']) {
      const result = {score, dimensions:{cycle_velocity:value}, measurement_coverage:{dimensions:{cycle_velocity:{status}}}};
      const before = JSON.stringify(result);
      const expected = Number.isFinite(value) && status !== 'not_measured';
      check(() => assert.equal(sandbox.hasMeasuredDecisionTiming(result), expected));
      const context = sandbox.buildDecisionTimingContext(result);
      const diagnosis = sandbox.buildDisplayedDecisionDiagnosis(result, {label:'Mixed burden pattern'}, harmonized);
      const summary = sandbox.buildPrimaryReadSummary(result);
      const row = sandbox.displayedDecisionDimensionValue(result, 'cycle_velocity');
      check(() => assert.equal(row, status === 'not_measured' ? 'Not measured' : Number.isFinite(value) ? `${Math.round(value)} / 100` : 'Score unavailable'));
      check(() => assert.doesNotMatch(JSON.stringify(diagnosis), /Mixed burden pattern is|proportionate|otherwise healthy|largest residual|Measured decision velocity is strong/));
      check(() => assert.doesNotMatch(summary, /otherwise healthy|pathway that is working|no clear easing signal/));
      if (!expected) {
        check(() => assert.match(context, /do not establish whether decisions are fast or slow/));
        check(() => assert.equal(diagnosis.burdenRead, context));
        check(() => assert.match(summary, /do not establish whether decisions are fast or slow/));
      } else if (score < 83) check(() => assert.equal(diagnosis, harmonized.diagnosisReads));
      check(() => assert.equal(JSON.stringify(result), before, 'display changes must not mutate a saved result'));
    }
  }
}
for (const section of ['executive', 'experience', 'composition', 'quadrant', 'remedy']) {
  const question = sandbox.buildLeadershipQuestion({}, {}, section);
  check(() => assert.ok(question.endsWith('?')));
  check(() => assert.doesNotMatch(question, /remove surgically|before it spreads|overbuilt|normalized compensating|underpowered|masking gaps|absorbing the capacity|buying responsiveness|need to admit|will stick/));
}
check(() => assert.equal((source.match(/displayedDecisionDimensionValue\(result, key\)/g) || []).length, 3, 'helper plus actual screen and PDF rows'));
check(() => assert.match(between('function renderResults(', 'const trajectoryWrap ='), /buildDisplayedDecisionDiagnosis\(result, burdenConstraint, harmonized\)/));
check(() => assert.match(between('function buildExecutiveReportHtml(', 'async function '), /buildDecisionTimingContext\(result\)/));
check(() => assert.equal((source.match(/Higher responsiveness,<br>/g) || []).length, 4, 'screen and export quadrant labels'));
check(() => assert.doesNotMatch(source, /Fast movement,<br>|Slow movement,<br>|Where the drag is coming from|productive capacity being absorbed by sustaining/));
check(() => assert.match(source, /When usable sizing inputs are supplied, it also models a possible share of capacity/));
console.log(JSON.stringify({passed:true, checks, variants:120, providerCalls:0, scope:'Actual DV display helpers and screen/export wiring. Not a live journey, browser layout, model approval or re-scoring test.'}));
