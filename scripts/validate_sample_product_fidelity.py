from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")
renderer = (ROOT / "sample-report-production.js").read_text(encoding="utf-8")
styles = (ROOT / "sample-report-production.css").read_text(encoding="utf-8")
shared = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
artifact = json.loads((ROOT / "sample-data" / "production-diagnostic-samples.json").read_text(encoding="utf-8"))

failures = []


def require(condition, message):
    if not condition:
        failures.append(message)


expected_commit = "379ff62eee8157efe0115ee825933adbefc493d2"
expected_digest = "611188e3ab10e20c62a3229604f03dbf39d6fa02f2ed14ffa2d787a55681b982"
require(artifact.get("contract") == "monderman-public-diagnostic-sample-output/v1", "unexpected production sample artifact contract")
require(artifact.get("engine_commit") == expected_commit, "sample artifact is not locked to the reviewed API main revision")
require(artifact.get("artifact_sha256") == expected_digest, "sample artifact digest is not the reviewed digest")
digest_input = dict(artifact)
digest_input.pop("artifact_sha256", None)
canonical = json.dumps(digest_input, separators=(",", ":"), ensure_ascii=False)
require(hashlib.sha256(canonical.encode("utf-8")).hexdigest() == expected_digest, "sample artifact content does not match its digest")
require("no customer data and no model-authored claims" in artifact.get("generation_mode", ""), "sample generation mode is not bounded")
require(len(artifact.get("source_blobs", {})) >= 14, "engine-source provenance is incomplete")

expected = {
    "operational_systems": {"score": 44, "band": "Drag", "dimensions": 6, "hours": 1690, "cost": 131820, "drag": 5},
    "decision_velocity": {"score": 51, "band": "Heavy", "dimensions": 4, "hours": 1198, "cost": 93444, "drag": 4},
    "structural_clarity": {"score": 51, "band": "Heavy", "dimensions": 5, "hours": 1198, "cost": 93444, "drag": 4},
    "institutional_performance": {"score": 48, "band": "Drag", "dimensions": 6, "hours": 1690, "cost": 131820, "drag": 5},
}
outputs = artifact.get("outputs", {})
require(set(outputs) == set(expected), "artifact must contain exactly the four public Diagnostic outputs")
for key, contract in expected.items():
    source = outputs.get(key, {})
    result = source.get("result", {})
    require(result.get("tool_type") == key, f"{key} tool identity mismatch")
    require(result.get("score") == contract["score"], f"{key} score is not the generated score")
    require(result.get("score_band") == contract["band"], f"{key} band is not the generated band")
    require(len(result.get("dimensions", {})) == contract["dimensions"], f"{key} dimension count mismatch")
    exposure = result.get("exposure", {})
    require(exposure.get("annual_hours") == contract["hours"], f"{key} annual hours mismatch")
    require(exposure.get("annual_cost") == contract["cost"], f"{key} annual cost mismatch")
    require(exposure.get("capacity_drag_percent") == contract["drag"], f"{key} capacity drag mismatch")
    require(len(result.get("interpretive_prose", {}).get("remedy_paths", [])) == 3, f"{key} does not carry three engine-generated remedy paths")
    require(len(result.get("interpretive_prose", {}).get("priority_actions", [])) >= 3, f"{key} action ladder is incomplete")
    require(result.get("measurement_coverage", {}).get("coverage_percent") == 100, f"{key} measurement coverage mismatch")
    require(result.get("participant_evidence") == [], f"{key} unexpectedly contains participant statements")
    require(result.get("interpretive_prose", {}).get("executive_summary"), f"{key} executive summary missing")
    require(result.get("canonical_descriptor", {}).get("priority_ladder"), f"{key} canonical priority ladder missing")

require('sample-report-production.css?v=611188e3ab10' in sample, "sample page does not load the production-contract presentation")
require('sample-report-production.js?v=611188e3ab10' in sample, "sample page does not load the production-contract renderer")
require('sample-data/production-diagnostic-samples.json?v=611188e3ab10' in renderer, "renderer does not load the reviewed artifact")
for key in ["operational_systems", "decision_velocity", "structural_clarity", "institutional_performance"]:
    require(key in renderer, f"renderer omits {key}")
for token in [
    "Executive headline", "Dimension profile", "Observed burden", "Governance and capacity",
    "Evidence status", "Action ladder", "Method and limits", "Interpretation boundary",
    "No participant notes were supplied", "Download representative JSON", "Print or save PDF",
    "data-engine-commit", "data-artifact-sha256",
]:
    require(token in renderer, f"production Diagnostic renderer missing: {token}")
for stale in ["Competing readings", "What would update this read"]:
    require(stale not in renderer, f"outdated standalone section required by production renderer: {stale}")

require('Decision-pathway drag · 4 dimensions' in sample, "Decision Velocity tab does not match the engine dimension count")
require('Institutional condition · 6 dimensions' in sample, "Institutional Performance tab does not match the engine dimension count")
require('<script src="monderman-report.js?v=' in sample, "sample does not load the shared Synthesis renderer")
require('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, "Cross-Lens sample is not using the shared renderer")
require('MondermanReport.fromSynthesis(fixtures.depth)' in sample, "Depth sample is not using the shared renderer")
for token in [
    'score_type: "within_lens_median"', 'aggregate_score: 56', 'respondent_count: 18',
    'score_type: "equal_lens_mean"', 'cross_diagnostic_score: 55.5', 'respondent_count: 48',
    'score_status: "published"', 'evidence_label: "Strong"', 'evidence_label: "Substantial"',
]:
    require(token in sample, f"Synthesis fixture contract missing: {token}")
for token in ["Cross-Lens Composite Score Withheld", "Agreement, divergence, and coverage", "Source-backed remedy paths", "Interpretation boundary"]:
    require(token in shared, f"shared Synthesis renderer missing: {token}")

for token in [
    '@media (max-width:640px)', '.psr-remedy-grid { grid-template-columns:1fr; }',
    '.psr-wrap { padding:0 10px;', '@media print', 'print-color-adjust:exact',
]:
    require(token in styles, f"responsive/print report protection missing: {token}")
require('overflow-wrap:anywhere' in styles, "long report text lacks a bleed guard")

if failures:
    print("SAMPLE_PRODUCT_FIDELITY_FAIL")
    for item in failures:
        print("-", item)
    raise SystemExit(1)
print("SAMPLE_PRODUCT_FIDELITY_PASS")
