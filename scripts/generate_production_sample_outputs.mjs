import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const API_COMMIT = "379ff62eee8157efe0115ee825933adbefc493d2";
const apiRoot = process.env.MONDERMAN_API_ROOT;
if (!apiRoot) throw new Error("MONDERMAN_API_ROOT is required");

const SOURCE_BLOBS = {
  "scoreOperationalSystems.js": "b23647f9d8828787bb036aed3942046448fb6049",
  "scoreDecisionVelocity.js": "a4d9bdfd7741b60cf9851d4f807bf68725716cbd",
  "scoreStructuralClarity.js": "917abe51106acbbeafa63013a00fe22af66cdedf",
  "scoreInstitutionalPerformance.js": "559858278de552f73707d064cb8016407fef3dfd",
  "buildCanonicalDescriptor.js": "916ff588328f483e34824aaf2a4d420610ccd03e",
  "buildCanonicalDescriptorDV.js": "f844bf35b5b02637923c6e6b7e515744e0ba2c7a",
  "buildCanonicalDescriptorSC.js": "d363651a2a57e0d07edb7fcd2b97bdfc7fdd380f",
  "buildCanonicalDescriptorIP.js": "38f967d5229ebb711e567458aaa2a2a4726b0a6e",
  "narrativeBuilders.js": "74a71de9b202f5860bd0c77b38b40842e1c9894d",
  "dvNarrativeBuilders.js": "725503df31e9d606863e41d503f750152eaedd65",
  "scNarrativeBuilders.js": "404157f72070703199c1ebc96c49046da3b9ef47",
  "ipNarrativeBuilders.js": "bd820789817d05bde9582bc6964c76ba913881d6",
  "participantEvidence.js": "591449d786f24391b1bb988ebb30be99ad60d821",
  "remedyPaths.js": "659a70f3d40de51f6fa77f40e3220ec5af7c31f9"
};

function gitBlobSha(file) {
  const body = fs.readFileSync(file);
  return crypto.createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}
for (const [file, expected] of Object.entries(SOURCE_BLOBS)) {
  const actual = gitBlobSha(path.join(apiRoot, file));
  if (actual !== expected) throw new Error(`${file} does not match API ${API_COMMIT}: ${actual}`);
}

const load = async (file) => import(pathToFileURL(path.join(apiRoot, file)).href);
const cfg = (file) => JSON.parse(fs.readFileSync(path.join(apiRoot, file), "utf8"));
const ROLES = ["operational", "managerial", "senior_leader"];
const depth = 60;
const role = "managerial";

function itemsFor(config) {
  return config.items.filter((item) => {
    const depths = Array.isArray(item.depth) ? item.depth.map(Number) : [];
    const roles = Array.isArray(item.role) ? item.role : ROLES;
    return depths.includes(depth) && roles.includes(role);
  });
}

function pickMid(item) {
  const options = Array.isArray(item.options) ? item.options : [];
  if (item.questionType === "numeric" || options.length === 0) {
    const keyed = {
      ip_n1_people_impacted: 18,
      ip_n2_annual_cycles: 96,
      ip_n3_hourly_cost: 78
    };
    return keyed[item.id] ?? 6;
  }
  if (item.questionType === "multi_select") return options.slice(0, Math.min(2, options.length)).map((o) => o.value);
  return options[Math.floor((options.length - 1) / 2)].value;
}

function buildRunState(config) {
  const answeredItems = {};
  itemsFor(config).forEach((item) => {
    answeredItems[item.id] = { itemId: item.id, value: pickMid(item) };
  });
  return { answeredItems, role, depth, participantMode: role };
}

const context = {
  organizationName: "Representative organization",
  processName: "capital approval pathway",
  functionName: "Procurement and Operations",
  businessUnit: "Procurement and Operations",
  unitName: "Capital approvals",
  industry: "other",
  sector: "other",
  organizationSize: "enterprise",
  orgSize: "enterprise",
  employeeCount: 2500,
  regulatoryIntensity: "moderate",
  decisionType: "operational",
  confidenceLevel: "moderate",
  peopleInvolved: 18,
  peopleAffected: 18,
  peopleImpacted: 18,
  people_involved: 18,
  annualVolume: 96,
  annualCycles: 96,
  annual_cycles: 96,
  hourlyCost: 78,
  hourly_cost: 78,
  meetingHours: 32,
  meeting_hours: 32
};

const instruments = [
  {
    key: "operational_systems", label: "Operational Systems",
    config: "configs/operationalSystemsRoutingConfig.json",
    adapter: ["diagnostics/operational-systems/legacy-adapter.v1.js", "adaptRunStateToLegacyPayload"],
    scorer: ["scoreOperationalSystems.js", "scoreOperationalSystems"],
    descriptor: ["buildCanonicalDescriptor.js", "buildCanonicalDescriptor"],
    prose: ["narrativeBuilders.js", "buildInterpretiveProse"]
  },
  {
    key: "decision_velocity", label: "Decision Velocity",
    config: "configs/decisionVelocityRoutingConfig.json",
    adapter: ["diagnostics/decision-velocity/legacy-adapter-dv.v1.js", "adaptRunStateToLegacyPayloadDV"],
    scorer: ["scoreDecisionVelocity.js", "scoreDecisionVelocity"],
    descriptor: ["buildCanonicalDescriptorDV.js", "buildCanonicalDescriptorDV"],
    prose: ["dvNarrativeBuilders.js", "buildInterpretiveProseDV"]
  },
  {
    key: "structural_clarity", label: "Structural Clarity",
    config: "configs/structuralClarityRoutingConfig.json",
    adapter: ["diagnostics/structural-clarity/legacy-adapter-sc.v1.js", "adaptRunStateToSCPayload"],
    scorer: ["scoreStructuralClarity.js", "scoreStructuralClarity"],
    descriptor: ["buildCanonicalDescriptorSC.js", "buildCanonicalDescriptorSC"],
    prose: ["scNarrativeBuilders.js", "buildInterpretiveProseSC"]
  },
  {
    key: "institutional_performance", label: "Institutional Performance",
    config: "configs/institutionalPerformanceRoutingConfig.json",
    adapter: ["diagnostics/institutional-performance/legacy-adapter-ip.v1.js", "adaptRunStateToIPPayload"],
    scorer: ["scoreInstitutionalPerformance.js", "scoreInstitutionalPerformance"],
    descriptor: ["buildCanonicalDescriptorIP.js", "buildCanonicalDescriptorIP"],
    prose: ["ipNarrativeBuilders.js", "buildInterpretiveProseIP"],
    ip: true
  }
];

const sector = await load("sectorIntelligence.js");
const outputs = {};
function publicResult(result) {
  const descriptor = result.canonical_descriptor || {};
  const prose = result.interpretive_prose || {};
  return {
    tool_type: result.tool_type,
    tool_label: result.tool_label,
    score: result.score,
    score_band: result.score_band ?? result.band ?? null,
    score_band_note: result.score_band_note ?? null,
    dimensions: result.dimensions ?? {},
    burden_breakdown: result.burden_breakdown ?? {},
    benchmark: result.benchmark ?? null,
    benchmark_position: result.benchmark_position ?? result.benchmarkPosition ?? null,
    trajectory: result.trajectory ?? null,
    exposure: result.exposure ?? null,
    primary_constraint: result.primary_constraint ?? null,
    primary_driver: result.primary_driver ?? result.primary_burden_source ?? null,
    patterns: result.patterns ?? [],
    contradictions: result.contradictions ?? [],
    key_findings: result.key_findings ?? [],
    watch_items: result.watch_items ?? [],
    participant_evidence: result.participant_evidence ?? [],
    participant_mode: result.participant_mode ?? result.participantMode ?? role,
    insight_depth: result.insight_depth ?? null,
    measurement_coverage: result.measurement_coverage ?? null,
    dimension_coverage: result.dimension_coverage ?? null,
    input_confidence_label: result.input_confidence_label ?? null,
    quadrant_interpretation_text: result.quadrant_interpretation_text ?? null,
    sector_context: result.sector_context ?? null,
    reclaim_potential: result.reclaim_potential ?? null,
    canonical_descriptor: {
      score: descriptor.score ?? result.score,
      composition: descriptor.composition ?? null,
      dimension_display: descriptor.dimension_display ?? null,
      priority_ladder: descriptor.priority_ladder ?? descriptor.intervention_priority_ladder ?? [],
      dominant_burden_label: descriptor.dominant_burden_label ?? null,
      dominant_burden_pct: descriptor.dominant_burden_pct ?? null,
      dominant_burden_note: descriptor.dominant_burden_note ?? null,
      burden_distribution_type: descriptor.burden_distribution_type ?? null,
      primary_constraint_key: descriptor.primary_constraint_key ?? null,
      primary_constraint_label: descriptor.primary_constraint_label ?? null,
      primary_constraint_note: descriptor.primary_constraint_note ?? null,
      legibility_failure_mode: descriptor.legibility_failure_mode ?? null,
      institutional_condition: descriptor.institutional_condition ?? null,
      dominant_is_material: descriptor.dominant_is_material ?? null,
      evidence_limits: descriptor.evidence_limits ?? null,
      governance_context: descriptor.governance_context ?? null,
      reference_range: descriptor.reference_range ?? null,
      opportunity_range: descriptor.opportunity_range ?? null,
      score_band_text: descriptor.score_band_text ?? null,
      benchmark_text: descriptor.benchmark_text ?? null,
      trajectory_text: descriptor.trajectory_text ?? null,
      trajectory_note: descriptor.trajectory_note ?? null
    },
    interpretive_prose: {
      executive_summary: prose.executive_summary ?? null,
      benchmark_interpretation: prose.benchmark_interpretation ?? null,
      priority_actions: prose.priority_actions ?? [],
      remedy_paths: prose.remedy_paths ?? [],
      harmonized_narrative: prose.harmonized_narrative ?? null,
      governance_context: prose.governance_context ?? null,
      reclaim_potential: prose.reclaim_potential ?? null
    }
  };
}
for (const instrument of instruments) {
  const config = cfg(instrument.config);
  const [adapterModule, scorerModule, descriptorModule, proseModule] = await Promise.all([
    load(instrument.adapter[0]), load(instrument.scorer[0]), load(instrument.descriptor[0]), load(instrument.prose[0])
  ]);
  const payload = adapterModule[instrument.adapter[1]]({ config, runState: buildRunState(config), role, depth, context });
  const scoringPayload = {
    ...payload,
    ...context,
    tool_type: instrument.key,
    participantMode: role,
    participant_mode: role,
    diagnosticDepth: depth,
    diagnostic_depth: depth,
    rawExperience: {},
    raw_experience: {},
    experientialLayer: {},
    experiential_layer: {}
  };
  const result = scorerModule[instrument.scorer[1]](scoringPayload);
  result.tool_type = instrument.key;
  result.tool_label = instrument.label;
  result.sector_context = sector.buildSectorContext(scoringPayload);
  result.reclaim_potential = sector.estimateReclaimPotential(result, scoringPayload);
  const descriptor = instrument.ip
    ? descriptorModule[instrument.descriptor[1]](result, scoringPayload, {})
    : descriptorModule[instrument.descriptor[1]](result);
  result.canonical_descriptor = descriptor;
  const prose = instrument.ip
    ? proseModule[instrument.prose[1]](result, descriptor, null, scoringPayload)
    : proseModule[instrument.prose[1]](result, null, scoringPayload);
  result.interpretive_prose = prose;
  outputs[instrument.key] = { input_context: context, result: publicResult(result) };
}

const artifact = {
  contract: "monderman-public-diagnostic-sample-output/v1",
  engine_commit: API_COMMIT,
  generated_at: "2026-08-23T00:00:00.000Z",
  generation_mode: "production scorer, canonical descriptor, and deterministic interpretive-prose builders; no customer data and no model-authored claims",
  source_blobs: SOURCE_BLOBS,
  outputs
};
const canonical = JSON.stringify(artifact);
artifact.artifact_sha256 = crypto.createHash("sha256").update(canonical).digest("hex");
const output = JSON.stringify(artifact, null, 2) + "\n";
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) {
  const destination = process.argv[outIndex + 1];
  if (!destination) throw new Error("--out requires a path");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, output, "utf8");
} else {
  process.stdout.write(output);
}
