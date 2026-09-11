from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")
renderer = (ROOT / "sample-report-production.js").read_text(encoding="utf-8")
styles = (ROOT / "sample-report-production.css").read_text(encoding="utf-8")
shared = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
public_model = (ROOT / "public-sample-model.js").read_text(encoding="utf-8")
artifact = json.loads((ROOT / "sample-data" / "production-diagnostic-samples.json").read_text(encoding="utf-8"))
engine_fixture = json.loads((ROOT / "test-fixtures" / "authenticated-report-engine-runs.json").read_text(encoding="utf-8"))

failures = []


def require(condition, message):
    if not condition:
        failures.append(message)


# Current public reports are six independently reviewed saved outputs. The
# adapter validates final release pins, complete AI, stripped-source digests,
# product identity, original dates, no mutation, and submitted-run semantics.
try:
    subprocess.run(
        ["node", str(ROOT / "scripts" / "public_sample_fixture.mjs"), "--check", "--root", str(ROOT)],
        check=True, capture_output=True, text=True,
    )
except subprocess.CalledProcessError as exc:
    require(False, "current public sample approval/renderer gate failed: " + (exc.stderr or exc.stdout)[-2000:])

# Keep the existing authenticated-engine regression fixture immutable and
# independently certified. It is historical coverage, not the public artifact.
expected_commit = "07328e2a15ee16262e98e573e97c6bfd65659260"
expected_digest = "447cdd78f6fceecdecfdd8f31ef99de048b96aace73de835757ff51cc79be6d7"
require(engine_fixture.get("contract") == "monderman-public-diagnostic-sample-output/v1", "unexpected production sample engine_fixture contract")
require(engine_fixture.get("engine_commit") == expected_commit, "sample engine_fixture is not locked to the reviewed API main revision")
require(engine_fixture.get("artifact_sha256") == expected_digest, "historical fixture digest is not the reviewed digest")
digest_input = dict(engine_fixture)
digest_input.pop("artifact_sha256", None)
canonical = json.dumps(digest_input, separators=(",", ":"), ensure_ascii=False)
require(hashlib.sha256(canonical.encode("utf-8")).hexdigest() == expected_digest, "sample engine_fixture content does not match its digest")
require("no customer data and no model-authored claims" in engine_fixture.get("generation_mode", ""), "sample generation mode is not bounded")
require(engine_fixture.get("claims_policy", {}).get("version") == "bounded-nonclaims-v2", "sample claims-policy version is missing")
require(engine_fixture.get("claims_policy", {}).get("status") == "passed", "sample claims-policy gate did not pass")
require(len(engine_fixture.get("source_blobs", {})) >= 14, "engine-source provenance is incomplete")

expected = {
    "operational_systems": {"score": 44, "band": "Drag", "dimensions": 6, "hours": 1690, "cost": 131820, "drag": 5},
    "decision_velocity": {"score": 51, "band": "Heavy", "dimensions": 4, "hours": 1198, "cost": 93444, "drag": 4},
    "structural_clarity": {"score": 51, "band": "Heavy", "dimensions": 5, "hours": 1198, "cost": 93444, "drag": 4},
    "institutional_performance": {"score": 48, "band": "Drag", "dimensions": 6, "hours": 1690, "cost": 131820, "drag": 5},
}
outputs = engine_fixture.get("outputs", {})
require(set(outputs) == set(expected), "historical engine fixture must contain exactly the four Diagnostic outputs")
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

require(re.search(r'sample-report-production\.css\?v=[^"\s]+', sample), "sample page does not load the versioned production-contract presentation")
require(re.search(r'sample-report-production\.js\?v=[^"\s]+', sample), "sample page does not load the versioned production-contract renderer")
require(re.search(r'sample-data/production-diagnostic-samples\.json\?v=[^"\s]+', renderer), "renderer does not load a versioned public artifact")
require(re.search(r'<script src="public-sample-model\.js\?v=[^"]+"', sample), "shared public model adapter is not loaded")
for key in ["operational_systems", "decision_velocity", "structural_clarity", "institutional_performance", "depth_synthesis", "cross_lens_synthesis"]:
    require(key in renderer, f"renderer omits {key}")
for token in [
    "MondermanReport", "MondermanPublicSamples.model(entry, artifact)", "Report.render(stage, model)",
    "Report.downloadHtml(model)", "Report.downloadJson(source", "Report.downloadPdf(model)",
    "Download HTML", "Download JSON", "Print or save PDF",
    "data-engine-commit", "data-artifact-sha256", "psr-doc-shell", "psr-toc-mobile", "psr-toc",
]:
    require(token in renderer, f"shared production renderer bridge missing: {token}")
for token in ["Report.fromRun(entry.source)", "Report.fromSynthesis(entry.source)", "sampleProvenance", "approved_output_sha256"]:
    require(token in public_model, f"source-preserving public adapter missing: {token}")
for stale in ["Competing readings", "What would update this read"]:
    require(stale not in renderer, f"outdated standalone section required by production renderer: {stale}")
for stale in ["MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES", "installExecutiveVisualSystem", "fromSynthesis(fixtures.", "cross_diagnostic_score:", "aggregate_score:"]:
    require(stale not in sample, f"hand-authored public Synthesis fixture remains: {stale}")
tabs = ["os", "dv", "sc", "ip", "synthesis", "depth"]
for tab in tabs:
    require(len(re.findall(r'id="report-' + tab + r'"', sample)) == 1, f"{tab} report shell must occur exactly once")
    require(f'aria-controls="report-{tab}"' in sample, f"{tab} accessible tab target missing")
    shell = re.search(r'<section\b[^>]*\bid="report-' + tab + r'"[^>]*>(.*?)</section>', sample, re.S)
    require(shell is not None and "psr-loading" in shell.group(1) and "<noscript>" in shell.group(1), f"{tab} generated-report loading/no-script state missing")
    require(shell is not None and re.search(r'<(?:table|svg|article)\b|class="(?:mr-|report-cover)', shell.group(1)) is None, f"{tab} retains a hand-authored report body")
require('<script src="monderman-report.js?v=' in sample, "sample does not load the shared Synthesis renderer")
for token in ["Cross-Lens Composite Score Withheld", "Agreement, divergence, and coverage", "Source-backed remedy paths", "Interpretation boundary"]:
    require(token in shared, f"shared Synthesis renderer missing: {token}")

for token in [
    '@media (max-width:640px)', '.psr-toolbar-actions { width:100%;',
    '.psr-wrap { padding:0 10px;', '@media (max-width:1080px)', '@media print', 'print-color-adjust:exact',
]:
    require(token in styles, f"responsive/print report protection missing: {token}")
require('overflow-wrap:anywhere' in styles, "long report text lacks a bleed guard")

if failures:
    print("SAMPLE_PRODUCT_FIDELITY_FAIL")
    for item in failures:
        print("-", item)
    raise SystemExit(1)
print("SAMPLE_PRODUCT_FIDELITY_PASS")
