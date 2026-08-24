import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("monderman-report.js", root), "utf8");
const fixture = JSON.parse(readFileSync(new URL("test-fixtures/authenticated-report-engine-runs.json", root), "utf8"));
const sandbox = { window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout };
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename:"monderman-report.js" });
const Report = sandbox.window.MondermanReport;

assert.equal(fixture.engine_commit, "fbbadb70b4d0c480f5d4ae58c4b6285b3164fccc");
assert.ok(Report?.fromRun && Report?.buildReportHtml, "authenticated report API missing");

const expected = {
  operational_systems: { score:44, dimensions:6, signal:"Reporting burden" },
  decision_velocity: { score:51, dimensions:4, signal:"Coordination burden" },
  structural_clarity: { score:51, dimensions:5, signal:"Handoff integrity" },
  institutional_performance: { score:48, dimensions:6, signal:"Compensatory dependence" },
};

for (const [key, contract] of Object.entries(expected)) {
  const run = fixture.outputs[key];
  assert.ok(run, `${key} fixture missing`);
  const model = Report.fromRun(run);
  assert.equal(model.score, contract.score, `${key} score changed`);
  assert.equal(model.dimensionEntries.length, contract.dimensions, `${key} dimension count changed`);
  assert.equal(model.primarySignal, contract.signal, `${key} primary signal changed`);
  assert.equal(model.processName, "capital approval pathway", `${key} operating scope changed`);
  assert.equal(model.headline, `${contract.signal} is the clearest measured constraint in the capital approval pathway.`);
  assert.equal(model.remedyPaths.length, 3, `${key} remedy-path count changed`);
  assert.ok(model.bottomLine.split(/[.!?]+/).filter(Boolean).length <= 2, `${key} leadership implication is not concise`);

  const html = Report.buildReportHtml(model);
  const required = [
    "Executive decision brief", "Dimension profile", "Constraint concentration",
    "How the disclosed scenario becomes exposure", "Priority map", "Measured evidence link",
    "Turn the read into a bounded operating decision", "Remeasurement discipline",
  ];
  for (const token of required) assert.match(html, new RegExp(token), `${key} missing ${token}`);
  assert.equal((html.match(/class="mr-card mr-remedy-card mr-run-remedy"/g) || []).length, 3, `${key} intervention paths changed`);
  assert.equal((html.match(/class="mr-remedy-evidence"/g) || []).length, 3, `${key} evidence links changed`);
  const decisionAt = html.indexOf("mr-run-decision");
  const leadershipAt = html.indexOf("mr-leadership-close");
  const methodAt = html.indexOf("mr-run-method");
  assert.ok(decisionAt >= 0 && methodAt > decisionAt && leadershipAt > methodAt, `${key} report hierarchy changed`);
  assert.doesNotMatch(html, /\[object Object\]|\bundefined\b|\bNaN\b|\ba\s+the\b|None of this looks like an emergency/i);
  assert.match(html, /@media print/);
}

// Reopened Workspace rows may carry the operating scope on the persisted result
// rather than the outer input_context envelope. The report must preserve it.
const persistedOnly = structuredClone(fixture.outputs.operational_systems.result);
persistedOnly.process_name = "persisted operating scope";
const persistedModel = Report.fromRun(persistedOnly);
assert.equal(persistedModel.processName, "persisted operating scope");
assert.match(persistedModel.headline, /the persisted operating scope/);

console.log(JSON.stringify({
  ok:true,
  api_engine:fixture.engine_commit,
  diagnostics:Object.keys(expected).length,
  scores:Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, value.score])),
  report_contract:"premium authenticated engine",
}, null, 2));
console.log("Authenticated report engine fixture regression passed.");
