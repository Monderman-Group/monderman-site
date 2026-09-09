// Display-only regression coverage for the four Diagnostics and the shared
// saved-report renderer. This test does not call an API, open a browser, write
// customer data, or change the stored result objects supplied to the renderer.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(SITE_ROOT, name), "utf8");

const PAGE_EXPECTATIONS = Object.freeze({
  "structural-clarity.html": {
    topics: {
      role_clarity: "Roles and responsibilities",
      decision_rights_clarity: "Decision authority",
      handoff_clarity: "Handoffs",
      accountability_clarity: "Accountability",
      duplicate_approvals_inverse: "Approval requirements",
      exposure: "Time and cost inputs",
      cross_dimensional: "Overall picture",
      trajectory: "Change over the past year",
      input_confidence: "Confidence in your answers"
    },
    patterns: {
      ownership_blur_pattern: "Ownership or accountability is unclear",
      authority_gap_pattern: "Decision authority is unclear",
      handoff_breakdown_pattern: "Handoffs are unclear",
      governance_overweight_pattern: "Review or approval requirements are heavy",
      mixed_clarity_condition: "No single clarity issue dominates",
      insufficient_measured_data: "Not enough measured data"
    }
  },
  "decision-velocity.html": {
    topics: {
      approval: "Approvals",
      coordination: "Coordination",
      handoff: "Handoffs",
      escalation: "Escalation",
      rework: "Repeated work",
      key_person: "Reliance on key people",
      cross_dimensional: "Overall picture",
      trajectory: "Change over the past year",
      input_confidence: "Confidence in your answers"
    },
    patterns: {
      approval_layering_pattern: "Several approval steps contribute to delay",
      compensatory_coordination_pattern: "High coordination effort and lower execution stability appear together",
      unstable_pathway_pattern: "Lower execution stability appears with conflicting answers",
      balanced_pathway_pattern: "No specific burden pattern was flagged in this run"
    }
  },
  "operational-systems.html": {
    topics: {
      process_density: "Process steps",
      systems_friction: "Work across systems",
      reporting_exception_burden: "Reporting and exceptions",
      workaround_dependence: "Workarounds",
      control_load: "Control requirements",
      upkeep_burden: "Administrative upkeep",
      cross_dimensional: "Overall picture",
      trajectory: "Change over the past year",
      input_confidence: "Confidence in your answers"
    },
    patterns: {
      process_density_pattern: "Many process or reporting steps",
      systems_friction_pattern: "Friction between systems",
      manual_workaround_pattern: "Reliance on manual workarounds",
      control_accumulation_pattern: "Heavy control requirements",
      balanced_operating_environment: "No specific operating burden pattern was flagged in this run"
    }
  },
  "institutional-performance.html": {
    topics: {
      execution_coherence: "Execution",
      decision_reliability: "Decision reliability",
      adaptive_capacity: "Ability to adapt",
      institutional_confidence: "Confidence in how the organization works",
      performance_stability: "Performance stability",
      compensatory_dependence: "Reliance on extra effort",
      cross_dimensional: "Overall picture",
      trajectory: "Change over the past year",
      input_confidence: "Confidence in your answers"
    },
    patterns: {
      "effort-compensates": "Results depend on extra effort",
      "informal-dependence": "Personal relationships fill gaps in official systems",
      "execution-fragment": "Intended direction and action do not match",
      "issues-recur": "The same problems keep returning",
      "confidence-low": "Confidence in official systems is low",
      "change-loses-momentum": "Change efforts lose momentum",
      "coordination-load": "Coordination takes too much effort",
      balanced_condition_pattern: "No specific institutional weakness was flagged in this run"
    }
  }
});

const SCORER_LABELS = Object.freeze({
  structural_clarity_high_score_good_2026_08_11_methodology_v4: "Structural Clarity scoring method, methodology version 4, August 11, 2026",
  decision_velocity_high_score_good_2026_08_12_release_v3: "Decision Velocity scoring method, release 3, August 12, 2026",
  operational_systems_high_score_good_2026_08_13_experience_neutral_v3: "Operational Systems scoring method, experience-neutral release 3, August 13, 2026",
  institutional_performance_high_score_good_2026_08_10_missingness_v2: "Institutional Performance scoring method, missing-data version 2, August 10, 2026"
});

function pageDisplayFunctions(source, name) {
  const start = source.indexOf("const QUESTION_TOPIC_LABELS = Object.freeze({");
  const end = source.indexOf("function toIndustryKey", start);
  assert.ok(start >= 0 && end > start, `${name}: display helper block not found`);
  const sandbox = {};
  vm.runInNewContext(`
    function humanize(value) {
      return String(value || "").replace(/[_-]+/g, " ").replace(/\\b\\w/g, (character) => character.toUpperCase());
    }
    ${source.slice(start, end)}
    globalThis.__display = {
      topic: (dimension, id, isExperienceLayer) => displayQuestionTopic({ dimension, id, isExperienceLayer }),
      pattern: displayPatternLabel,
      scorer: displayScoringVersion
    };
  `, sandbox, { filename: `${name}:display-helpers` });
  return sandbox.__display;
}

for (const [name, expected] of Object.entries(PAGE_EXPECTATIONS)) {
  const source = read(name);
  const display = pageDisplayFunctions(source, name);
  for (const [key, label] of Object.entries(expected.topics)) {
    assert.equal(display.topic(key), label, `${name}: topic ${key}`);
  }
  for (const [key, label] of Object.entries(expected.patterns)) {
    assert.equal(display.pattern(key), label, `${name}: pattern ${key}`);
  }
  for (const [key, label] of Object.entries(SCORER_LABELS)) {
    assert.equal(display.scorer(key), label, `${name}: scorer ${key}`);
  }
  assert.equal(display.topic("", "**confidenceLevel**", false), "Confidence in your answers", `${name}: confidence topic`);
  assert.equal(display.topic("", "experience-1", true), "Your observations", `${name}: observation topic`);
  assert.equal(display.topic("future_internal_code"), "Diagnostic question", `${name}: unknown question code must not leak`);
  assert.equal(display.pattern("future_pattern_code"), "Future Pattern Code", `${name}: unknown pattern fallback must be readable`);
  assert.equal(display.scorer("future_scorer_v1"), "future_scorer_v1", `${name}: unknown scorer version must remain exact`);
  assert.match(source, /const dimLabel = displayQuestionTopic\(item\);/, `${name}: question heading is not wired to display dictionary`);
  assert.match(source, /const dimension = displayQuestionTopic\(state\.currentItem\);/, `${name}: progress heading is not wired to display dictionary`);
  assert.match(source, /asArray\(result\.patterns\)\.map\(displayPatternLabel\)/, `${name}: result patterns are not wired to display dictionary`);
  assert.match(source, /Scoring version: \$\{safe\(displayScoringVersion\(result\.scorer_version\)\)\}/, `${name}: exported report exposes scorer identifier`);
  assert.match(source, /const scorer = displayScoringVersion\(result && result\.scorer_version\);/, `${name}: result basis exposes scorer identifier`);
  assert.doesNotMatch(source, /Adaptive question path active\.|Question path active|CROSS DIMENSIONAL|TRAJECTORY|INPUT CONFIDENCE|Basis of this read|Disclosed inputs|Depth · vantage/, `${name}: stale display language remains`);
}

const rendererSource = read("monderman-report.js");
const rendererSandbox = { window: {} };
vm.runInNewContext(rendererSource, rendererSandbox, { filename: "monderman-report.js" });
const Report = rendererSandbox.window.MondermanReport;
assert.ok(Report, "shared report renderer did not initialize");
assert.equal(Report.rendererVersion, "diagnostic-renderer-ai-20260909.2", "display version was not advanced");

const RUN_CASES = Object.freeze({
  decision_velocity: {
    scorer: "decision_velocity_high_score_good_2026_08_12_release_v3",
    dimensions: { cycle_velocity: 82, approval_efficiency: 71, coordination_load: 69, execution_stability: 77 },
    labels: { cycle_velocity: "Decision timing", approval_efficiency: "Approval efficiency", coordination_load: "Coordination", execution_stability: "Execution stability" }
  },
  structural_clarity: {
    scorer: "structural_clarity_high_score_good_2026_08_11_methodology_v4",
    dimensions: { role_clarity: 60, decision_rights_clarity: 61, handoff_clarity: 62, accountability_clarity: 63, duplicate_approvals_inverse: 64 },
    labels: { role_clarity: "Role clarity", decision_rights_clarity: "Decision authority", handoff_clarity: "Handoff clarity", accountability_clarity: "Accountability", duplicate_approvals_inverse: "Avoidance of duplicate approvals" }
  },
  operational_systems: {
    scorer: "operational_systems_high_score_good_2026_08_13_experience_neutral_v3",
    dimensions: { process_density: 40, systems_friction: 41, reporting_exception_burden: 42, workaround_dependence: 43, control_load: 44, upkeep_burden: 45 },
    labels: { process_density: "Process steps", systems_friction: "Work across systems", reporting_exception_burden: "Reporting and exception handling", workaround_dependence: "Work outside the usual process", control_load: "Control requirements", upkeep_burden: "Administrative maintenance" }
  },
  institutional_performance: {
    scorer: "institutional_performance_high_score_good_2026_08_10_missingness_v2",
    dimensions: { execution_coherence: 51, decision_reliability: 52, adaptive_capacity: 53, institutional_confidence: 54, performance_stability: 55, compensatory_effort: 56 },
    labels: { execution_coherence: "Execution", decision_reliability: "Decision reliability", adaptive_capacity: "Ability to adapt", institutional_confidence: "Confidence in formal systems", performance_stability: "Performance stability", compensatory_effort: "Extra effort required" }
  }
});

for (const [tool, spec] of Object.entries(RUN_CASES)) {
  const source = {
    tool_type: tool,
    score: 64,
    score_band: "Compounding",
    dimensions: structuredClone(spec.dimensions),
    scorer_version: spec.scorer,
    exposure: { model: { model_type: "directional_scenario_not_empirical_benchmark", version: "scenario-v1" } }
  };
  const before = JSON.stringify(source);
  const model = Report.fromRun(source);
  assert.deepEqual(
    Object.fromEntries(model.dimensionEntries.map((entry) => [entry.key, { label: entry.label, score: entry.score }])),
    Object.fromEntries(Object.entries(spec.labels).map(([key, label]) => [key, { label, score: spec.dimensions[key] }])),
    `${tool}: dimension labels or values changed`
  );
  const html = Report.buildReportHtml(model);
  assert.match(html, new RegExp(SCORER_LABELS[spec.scorer].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${tool}: readable scorer version absent`);
  assert.match(html, /Directional planning scenario, not an empirical benchmark/, `${tool}: readable calculation method absent`);
  assert.doesNotMatch(html, /high_score_good|directional_scenario_not_empirical_benchmark/, `${tool}: internal metadata identifier visible`);
  assert.equal(JSON.stringify(source), before, `${tool}: display adapter mutated source result`);
}

const remedySource = {
  tool_type: "decision_velocity",
  score: 71,
  score_band: "Compounding",
  dimensions: { cycle_velocity: 82, approval_efficiency: 71, coordination_load: 69 },
  exposure: {
    annual_hours: 100,
    annual_cost: 6000,
    recoverable_cost: 720,
    recoverable_share_percent: 12,
    average_hourly_cost: 60,
    model: { model_type: "directional_scenario_not_empirical_benchmark", version: "scenario-v1" }
  },
  interpretive_prose: {
    remedy_paths: [
      { label: "First option", benefit: "Creates evidence before a wider change. Directional reclaim band: $5,000–$10,000**." },
      { label: "Second option", benefit: "Defines a repeated measure. Scenario value band: $5,000–$10,000; this is not observed or protected value." },
      { label: "Third option", benefit: "May avoid a separate $321 expense if the test succeeds." }
    ]
  }
};
const remedyBefore = JSON.stringify(remedySource);
const remedyHtml = Report.buildReportHtml(Report.fromRun(remedySource));
assert.match(remedyHtml, /Modeled recovery scenario[\s\S]*\$720/, "report-wide recovery scenario missing");
assert.match(remedyHtml, /Creates evidence before a wider change\./, "substantive benefit was removed with generated range");
assert.match(remedyHtml, /Defines a repeated measure\./, "substantive benefit was removed with scenario value range");
assert.match(remedyHtml, /May avoid a separate \$321 expense if the test succeeds\./, "unrelated customer-supplied currency was removed");
assert.match(remedyHtml, /The report-wide modeled recovery scenario is not divided among these options\./, "remedy range correction was not disclosed");
assert.doesNotMatch(remedyHtml, /\$5,000|\$10,000|Directional reclaim band|Scenario value band|\*\*/, "generated remedy-level range remained visible");
assert.equal(JSON.stringify(remedySource), remedyBefore, "remedy display correction mutated stored result");

const unpricedRemedySource = structuredClone(remedySource);
unpricedRemedySource.interpretive_prose.remedy_paths = [
  { label: "Unpriced option", benefit: "Directional reclaim band: Not estimated*." }
];
const unpricedBefore = JSON.stringify(unpricedRemedySource);
const unpricedHtml = Report.buildReportHtml(Report.fromRun(unpricedRemedySource));
assert.doesNotMatch(unpricedHtml, /Directional reclaim band|Not estimated\*/, "unpriced generated option range remained visible");
assert.match(unpricedHtml, /The report-wide modeled recovery scenario is not divided among these options\./, "unpriced option correction was not disclosed");
assert.equal(JSON.stringify(unpricedRemedySource), unpricedBefore, "unpriced remedy display correction mutated stored result");

const controlledFixturePath = path.resolve(SITE_ROOT, "../../output/diagnostic-language-20260908/controlled-saved-report-actual.json");
let controlledFixtureChecked = false;
if (fs.existsSync(controlledFixturePath)) {
  const fixture = JSON.parse(fs.readFileSync(controlledFixturePath, "utf8"));
  assert.equal(fixture.syntheticOnly, true, "controlled saved-report fixture must be explicitly synthetic");
  const actualSource = {
    ...structuredClone(fixture.full_result_json),
    ai_report: { status: "complete", report: structuredClone(fixture.ai_report) }
  };
  const before = JSON.stringify(actualSource);
  const model = Report.fromRun(actualSource);
  const html = Report.buildReportHtml(model);
  assert.equal(model.score, 71, "controlled saved result score changed");
  assert.equal(model.band, "Compounding", "controlled saved result band changed");
  assert.match(html, /Decision Velocity: Executive Report/, "canonical instrument name missing from controlled saved report");
  assert.match(html, /AI-assisted interpretation/, "accepted AI sidecar did not render");
  assert.match(html, /Prepared with Claude Opus 5/, "AI model display label is not readable");
  assert.match(html, /Decision timing/, "controlled saved dimension label is not readable");
  assert.match(html, /Modeled recovery scenario[\s\S]*\$720/, "controlled saved report recovery value changed");
  assert.match(html, /works but drags/, "actual accepted AI summary was silently rewritten");
  assert.match(html, /Approvals add a sequential wait/, "actual accepted AI observation was silently rewritten");
  assert.doesNotMatch(html, /decision_velocity|directional_scenario_not_empirical_benchmark|high_score_good|\$5,000|\$10,000/, "controlled saved report exposes an internal identifier or invented option amount");
  assert.equal(JSON.stringify(actualSource), before, "controlled saved report or AI sidecar was mutated by display code");
  controlledFixtureChecked = true;
}

assert.doesNotMatch(rendererSource, /Treat this as a directional read of the measured condition\./, "stale direct-run fallback wording remains");

console.log(`DIAGNOSTIC_DISPLAY_LANGUAGE_PASS pages=${Object.keys(PAGE_EXPECTATIONS).length} runTools=${Object.keys(RUN_CASES).length} controlledFixture=${controlledFixtureChecked ? "checked" : "not-present"}`);
