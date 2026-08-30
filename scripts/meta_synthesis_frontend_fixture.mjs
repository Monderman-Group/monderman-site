import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../monderman-report.js", import.meta.url), "utf8");
const sandbox = {
  window: {},
  console,
  Intl,
  Date,
  Number,
  String,
  Array,
  Object,
  Math,
  JSON,
  WeakSet,
  Blob,
  URL,
  setTimeout,
  clearTimeout,
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: "monderman-report.js" });
const Report = sandbox.window.MondermanReport;
assert.ok(Report?.fromSynthesis && Report?.buildReportHtml, "shared report API missing");

function evidence(overrides = {}) {
  return {
    evidence_band: "large_observed_set",
    evidence_label: "Large observed respondent set",
    evidence_description: "The depth read summarizes 2,500 observed runs from one diagnostic lens. Sample size strengthens description of the observed set; it does not by itself establish population representativeness.",
    score_allowed: true,
    composite_allowed: false,
    scope: { status: "anchored", label: "Scope aligned", statement: "The submitted runs share one campaign anchor." },
    versions: { status: "verified", label: "Instrument versions aligned", conflicting_lenses: [] },
    time_window: { status: "aligned", statement: "The observed runs fall within a 30-day window." },
    source_identity: { status: "verified", statement: "Every submitted result carries a unique source-run identifier." },
    representativeness: { status: "observed_set", label: "Observed respondent set", statement: "The read describes the respondents included. It should not be generalized to the full population without a documented sampling frame." },
    lens_balance: { status: "not_applicable", ratio: 1 },
    next_band_requirements: [{ type: "sampling_frame", text: "Document the invited population and sampling method before generalizing beyond the observed respondent set." }],
    ...overrides,
  };
}

function commonExposure(overrides = {}) {
  return {
    status: "available",
    label: "Observed pathway exposure",
    basis: "Repeated estimates are summarized, not added together.",
    total_runs: 2500,
    priceable_runs: 2500,
    annual_hours: 1000,
    annual_hours_low: 900,
    annual_hours_high: 1100,
    annual_cost: 125000,
    annual_cost_low: 112000,
    annual_cost_high: 136000,
    capacity_drag_percent: 5.2,
    recoverable_cost: 30000,
    recoverable_cost_low: 26000,
    recoverable_cost_high: 34000,
    ...overrides,
  };
}

const depth = {
  synthesis_product: "depth_synthesis",
  synthesis_mode: "depth",
  tool_label: "Depth Synthesis",
  generated_at: "2026-08-15T20:00:00.000Z",
  respondent_count: 2500,
  lens_count: 1,
  score_status: "published",
  cross_diagnostic_score: 65,
  score_label: "Institutional Performance median score",
  score_basis: "Median of the submitted same-instrument scores.",
  condition_band: "Mixed observed condition",
  evidence_assessment: evidence(),
  readiness_label: "Large observed respondent set",
  primary_pattern: "The strongest recurring Institutional Performance signal is institutional resilience and consistency strain.",
  diagnosis: { name: "Observed same-instrument pattern", type: "Large observed respondent set · within-lens synthesis", body: "This result summarizes 2,500 submitted runs from Institutional Performance." },
  executive_briefing: { lede: "Large observed respondent set: 2,500 submitted runs from one diagnostic lens.", paragraphs: ["This is a same-instrument depth synthesis."] },
  sample_reads: [{
    tool_type: "institutional_performance",
    tool_label: "Institutional Performance",
    n: 2500,
    observed_set_label: "Large observed respondent set",
    score: { mean: 65, median: 65, sd: 6.3, min: 52, max: 79, iqr: [61, 69] },
    consensus: { read: "mixed", detail: "The observed runs show moderate variation." },
    segments: [
      { participant_mode: "operational", n: 1200, mean_score: 62, median_score: 62 },
      { participant_mode: "managerial", n: 800, mean_score: 66, median_score: 66 },
      { participant_mode: "senior_leader", n: 500, mean_score: 70, median_score: 70 },
    ],
    vantage_gap: { gap: 8, low_segment: "operational", high_segment: "senior_leader", statement: "The observed senior-leader mean is 8 points above the operational mean." },
    interpretation_limit: "These statistics describe the submitted runs.",
  }],
  source_groups: [{ tool_type: "institutional_performance", tool_label: "Institutional Performance", respondents: 2500, mean_score: 65, median_score: 65, score_iqr: [61, 69], score_range: [52, 79], modal_driver_pattern: "institutional_fragility" }],
  convergence_signals: [{ label: "Mixed observed set", text: "Institutional Performance shows moderate variation across 2,500 submitted runs.", tools: ["institutional_performance"], scope: "depth_consensus", interpretation_limit: "This is repetition within one instrument, not cross-lens triangulation." }],
  contradictions: [],
  pathway_exposure: commonExposure(),
  priority_actions: [{ label: "Read the distribution", text: "Review the distribution and vantage segments alongside the median.", tier: "evidence" }],
  experiential: { managers: "Observed managers segment evidence: Institutional Performance: n=800, mean 66, median 66.", interpretation_limit: "Only measured segment statistics are reported." },
  leading_indicators: [{ lens_label: "Depth · Institutional Performance", name: "Like-for-like depth remeasurement", watch_for: "whether the observed median and spread move", description: "Repeat the same instrument and scope." }],
  narrative: { executive_summary: "2,500 submitted Institutional Performance runs produce a median score of 65.", leadership_implication: "The read shows how the submitted respondents cluster and vary.", sequenced_action_logic: "Suggested first step: read the distribution." },
  what_would_strengthen_the_read: [{ type: "sampling_frame", text: "Document the invited population and sampling method before generalizing beyond the observed respondent set." }],
};

const depthModel = Report.fromSynthesis(depth);
assert.equal(depthModel.kind, "meta-synthesis");
assert.equal(depthModel.product, "depth");
assert.equal(depthModel.headlineScore, 65);
const depthHtml = Report.buildReportHtml(depthModel);
assert.match(depthHtml, /Depth Synthesis Executive Report/);
assert.match(depthHtml, /Agreement, divergence, and coverage/);
assert.match(depthHtml, /Median Diagnostic Score/);
assert.match(depthHtml, /2,500/);
assert.match(depthHtml, /Observed respondent set/);
assert.match(depthHtml, /Population generalization requires a documented sampling frame/);
assert.match(depthHtml, /aria-label="Depth Synthesis score distribution"/);
assert.match(depthHtml, /Interquartile range/);
assert.match(depthHtml, /Perspective difference/);
assert.match(depthHtml, /Agreement versus divergence/);
assert.match(depthHtml, /Outlier status/);
assert.match(depthHtml, /Not classified from aggregate source data/);
assert.match(depthHtml, /Vantage difference/);

const divided = structuredClone(depth);
divided.sample_reads[0].consensus = { read: "divided", detail: "The observed runs form two materially separated score groups.", split: { lower_share_pct: 45, upper_share_pct: 55 } };
divided.diagnosis = { name: "Divided observed respondent pattern", type: "Distribution finding", body: "The score distribution separates into two materially different groups." };
const dividedHtml = Report.buildReportHtml(Report.fromSynthesis(divided));
assert.match(dividedHtml, /Divided observed respondent pattern/);
assert.match(dividedHtml, /two materially different groups/);

const comparison = {
  synthesis_product: "cross_lens_synthesis",
  synthesis_mode: "mixed",
  tool_label: "Cross-Lens Synthesis",
  respondent_count: 171,
  lens_count: 3,
  score_status: "withheld",
  cross_diagnostic_score: null,
  aggregate_score: null,
  score_label: "Cross-lens composite withheld",
  score_basis: "The source lenses can be compared, but one coherent composite is withheld.",
  condition_band: "Composite withheld",
  evidence_assessment: evidence({
    evidence_band: "directional",
    evidence_label: "Directional cross-lens read",
    evidence_description: "The source lenses support a working cross-lens hypothesis, but the evidence is too uneven for one composite score.",
    score_allowed: false,
    composite_allowed: false,
    lens_balance: { status: "severely_imbalanced", ratio: 25 },
    representativeness: { status: "per_lens_only", label: "Representativeness assessed within each lens", statement: "Cross-lens breadth does not substitute for a sampling frame." },
    next_band_requirements: [
      { type: "runs", tool_type: "operational_systems", current_runs: 6, target_runs: 38, additional_runs_needed: 32, text: "Operational Systems needs 32 additional runs to reach 38 and satisfy the next balance floor." },
      { type: "runs", tool_type: "institutional_performance", current_runs: 15, target_runs: 38, additional_runs_needed: 23, text: "Institutional Performance needs 23 additional runs to reach 38 and satisfy the next balance floor." },
    ],
  }),
  readiness_label: "Directional cross-lens read",
  primary_pattern: "No single cross-lens diagnosis is claimed at the current evidence band.",
  diagnosis: { name: "Lens comparison—not a composite diagnosis", type: "Directional cross-lens read · composite withheld", body: "The submitted lenses can be compared, but one cross-lens condition score is withheld." },
  executive_briefing: { lede: "Directional cross-lens read: the lenses can be compared, but one composite condition score is withheld.", paragraphs: ["The source lenses remain separately interpretable."] },
  source_groups: [
    { tool_type: "decision_velocity", tool_label: "Decision Velocity", respondents: 150, mean_score: 62, median_score: 62, score_iqr: [58, 66], score_range: [48, 78], modal_driver_pattern: "approval_density" },
    { tool_type: "operational_systems", tool_label: "Operational Systems", respondents: 6, mean_score: 55, median_score: 55, score_iqr: [52, 59], score_range: [49, 61], modal_driver_pattern: "operating_burden" },
    { tool_type: "institutional_performance", tool_label: "Institutional Performance", respondents: 15, mean_score: 60, median_score: 60, score_iqr: [56, 64], score_range: [50, 70], modal_driver_pattern: "institutional_fragility" },
  ],
  convergence_signals: [{ label: "Review and operating overhead", text: "Decision Velocity and Operational Systems both point to review activity and recurring administrative work.", tools: ["decision_velocity", "operational_systems"], scope: "cross_lens", interpretation_limit: "This is a recurring cross-lens signal, not proof of cause or direction." }],
  contradictions: ["Decision Velocity averages 62, while Operational Systems averages 55. This is a lens difference, not proof that one lens is masking or causing the other."],
  pathway_exposure: { status: "withheld", label: "Pathway exposure withheld", withheld_reason: "The submitted runs do not describe one bounded operating pathway." },
  priority_actions: [{ label: "Operational Systems depth", text: "Operational Systems needs 32 additional runs to reach 38 and satisfy the next balance floor.", tier: "evidence" }],
  experiential: { interpretation_limit: "Only segment statistics carried by the submitted runs are reported." },
  leading_indicators: [{ lens_label: "Cross-lens validation", name: "Shared-scope evidence review", watch_for: "whether the same bounded teams and cases carry the signal", description: "Use the evidence requirements as the measurement contract." }],
  narrative: { executive_summary: "The submitted runs allow a directional cross-lens read. One cross-lens condition score is withheld.", leadership_implication: "Use the result as a structured lens comparison, not as one organization-wide diagnosis." },
  what_would_strengthen_the_read: [
    { type: "runs", tool_type: "operational_systems", current_runs: 6, target_runs: 38, additional_runs_needed: 32, text: "Operational Systems needs 32 additional runs to reach 38 and satisfy the next balance floor." },
    { type: "runs", tool_type: "institutional_performance", current_runs: 15, target_runs: 38, additional_runs_needed: 23, text: "Institutional Performance needs 23 additional runs to reach 38 and satisfy the next balance floor." },
  ],
};

const comparisonModel = Report.fromSynthesis(comparison);
assert.equal(comparisonModel.product, "cross_lens");
assert.equal(comparisonModel.scorePublished, false);
assert.equal(comparisonModel.headlineScore, "Unavailable");
assert.equal(comparisonModel.headlineBand, "Composite withheld");
const comparisonHtml = Report.buildReportHtml(comparisonModel);
assert.match(comparisonHtml, /Lens comparison—not a composite diagnosis/);
assert.match(comparisonHtml, /Composite withheld/);
assert.match(comparisonHtml, /Operational Systems needs 32 additional runs/);
assert.match(comparisonHtml, /Pathway exposure withheld/);
assert.match(comparisonHtml, /aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"/);
assert.match(comparisonHtml, /COMPOSITE WITHHELD/);
assert.match(comparisonHtml, /Lens interaction evidence/);
assert.match(comparisonHtml, /Review and operating overhead/);
assert.match(comparisonHtml, /Compounding constraints to investigate/);
assert.match(comparisonHtml, /Co-occurrence supports a systems hypothesis; it does not establish a causal chain/);
assert.doesNotMatch(comparisonHtml, /Severe observed strain/);

const coherent = structuredClone(comparison);
coherent.respondent_count = 20;
coherent.lens_count = 2;
coherent.score_status = "published";
coherent.cross_diagnostic_score = 60;
coherent.aggregate_score = 60;
coherent.score_label = "Equal-lens composite condition score";
coherent.score_basis = "Arithmetic mean of the contributing lens means. Each diagnostic lens receives one vote regardless of respondent count.";
coherent.condition_band = "Mixed observed condition";
coherent.evidence_assessment = evidence({
  evidence_band: "coherent",
  evidence_label: "Coherent cross-lens read",
  evidence_description: "The source lenses are sufficiently balanced and scope-aligned to support one directional composite condition score.",
  score_allowed: true,
  composite_allowed: true,
  lens_balance: { status: "strong", ratio: 1 },
  representativeness: { status: "per_lens_only", label: "Representativeness assessed within each lens", statement: "Cross-lens breadth does not substitute for a documented sampling frame." },
  next_band_requirements: [{ type: "lens", text: "Add a third diagnostic lens to qualify for the strong cross-lens band." }],
});
coherent.readiness_label = "Coherent cross-lens read";
coherent.diagnosis = { name: "Coherent cross-lens pattern", type: "Coherent cross-lens read · directional composite", body: "The contributing lenses form a coherent directional pattern." };
coherent.source_groups = [
  { tool_type: "structural_clarity", tool_label: "Structural Clarity", respondents: 10, mean_score: 70, median_score: 70, score_iqr: [68, 72], score_range: [65, 75], modal_driver_pattern: "structural_ambiguity" },
  { tool_type: "decision_velocity", tool_label: "Decision Velocity", respondents: 10, mean_score: 50, median_score: 50, score_iqr: [48, 52], score_range: [45, 55], modal_driver_pattern: "approval_density" },
];
coherent.pathway_exposure = commonExposure({ total_runs: 20, priceable_runs: 20 });
coherent.what_would_strengthen_the_read = [{ type: "lens", text: "Add a third diagnostic lens to qualify for the strong cross-lens band." }];
const coherentHtml = Report.buildReportHtml(Report.fromSynthesis(coherent));
assert.match(coherentHtml, /Equal-lens composite condition score/);
assert.match(coherentHtml, /Each diagnostic lens receives one vote/);
assert.match(coherentHtml, />60</);
assert.match(coherentHtml, /EQUAL-LENS COMPOSITE/);
assert.match(coherentHtml, /Strongest observed lens/);
assert.match(coherentHtml, /Weakest observed lens/);

const missingEconomics = structuredClone(coherent);
missingEconomics.pathway_exposure = { status: "unavailable", label: "Pathway exposure unavailable", withheld_reason: "The submitted results do not contain source-backed exposure estimates." };
const missingHtml = Report.buildReportHtml(Report.fromSynthesis(missingEconomics));
assert.match(missingHtml, /Pathway exposure unavailable/);
assert.match(missingHtml, /do not contain source-backed exposure estimates/);
assert.doesNotMatch(missingHtml, /\$0/);

const allHtml = [depthHtml, dividedHtml, comparisonHtml, coherentHtml, missingHtml].join("\n");
assert.doesNotMatch(allHtml, /poll[_ -]?grade|population read|compensation hours|compounded exposure|correction horizon|root cause|\[object Object\]|undefined|NaN/i);
assert.doesNotMatch(allHtml, /Structural corrections must precede behavioral ones|Reversing the order regenerates|Visible operating performance is intact/i);

console.log(JSON.stringify({
  ok: true,
  fixtures: 5,
  depth_runs: 2500,
  withheld_composite_preserved: true,
  equal_lens_basis_present: true,
  missing_economics_withheld: true,
}, null, 2));
console.log("Meta-synthesis shared report fixture regression passed.");
