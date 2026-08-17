from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")
renderer = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
quadrant_alignment = (ROOT / "scripts/align_sample_quadrants_to_production.py").read_text(encoding="utf-8")
products = {
    "os": (ROOT / "operational-systems.html").read_text(encoding="utf-8"),
    "dv": (ROOT / "decision-velocity.html").read_text(encoding="utf-8"),
    "sc": (ROOT / "structural-clarity.html").read_text(encoding="utf-8"),
    "ip": (ROOT / "institutional-performance.html").read_text(encoding="utf-8"),
}

failures = []
def require(cond, msg):
    if not cond:
        failures.append(msg)

# Diagnostic marketing reports must retain the customer quadrant concepts and geometry.
expected_quadrants = {
    "os-quadrant": ("Governance weight &times; execution responsiveness", 50),
    "dv-quadrant": ("Governance weight &times; execution responsiveness", 50),
    "sc-quadrant": ("Governance weight &times; structural legibility", 67),
    "ip-quadrant": ("Institutional condition &times; compensatory dependence", 67),
}
for section_id, (heading, y_threshold) in expected_quadrants.items():
    match = re.search(rf'<section class="section" id="{re.escape(section_id)}">(.*?)</section>', sample, re.S)
    require(bool(match), f"missing {section_id}")
    if match:
        body = match.group(1)
        require(heading in body, f"{section_id} heading does not match production concept")
        require('data-production-component="diagnostic-quadrant"' in body, f"{section_id} is not marked as production quadrant")
        require(f'data-y-threshold="{y_threshold}"' in body, f"{section_id} y-threshold mismatch")
        require("sample-production-quadrant-box" in body and "sample-quadrant-dot" in body, f"{section_id} geometry incomplete")
        require("Representative plotted values:" in body, f"{section_id} lacks disclosed representative axis values")
for token in ['height:320px','width:22px;height:22px','calc(50% - 1px)','calc(67% - 1px)','max(8, min(92, cfg["x"]))','max(8, min(92, 100 - cfg["y"]))']:
    require(token in quadrant_alignment, f"production quadrant alignment missing rule: {token}")

# Diagnostic samples retain evidence visuals, but capacity must use the CURRENT
# production semantics: productive work / necessary administrative load /
# recoverable drag. The obsolete dollar-apportioned Sankey must never return.
for token in ['aria-label="Burden composition — share of total"','aria-label="Burden severity by dimension"','aria-label="Intervention order"','aria-label="Score in sector context"']:
    require(token in sample, f"missing Diagnostic evidence visual: {token}")
require(sample.count('aria-label="Capacity allocation"') == 4, "each Diagnostic sample must show one current capacity-allocation visual")
require('aria-label="Where annual labor capacity goes"' not in sample, "obsolete sample capacity-flow visual remains")
require('Dimension dollars apportion the recoverable burden' not in sample, "obsolete dimension-dollar allocation claim remains")

# Current representative economics. These are hypothetical sample inputs but the
# arithmetic must be values the live scorers can actually produce.
expected_economics = {
    "os": ["5,280 annual burden hours", "$485,760", "capacity drag around 24%", "Productive work 76%", "Necessary administrative load 16%", "Recoverable drag 8%", "12 people per normal run", "600 runs/yr", "16 coordination hrs/run", "55% modeled burden attribution"],
    "dv": ["3,128 annual burden hours", "$344,080", "capacity drag around 22%", "Productive work 78%", "Necessary administrative load 17%", "Recoverable drag 5%", "8 people per normal decision run", "1,150 decisions/yr", "8 coordination hrs/run", "34% score-responsive attribution"],
    "sc": ["960 annual burden hours", "$74,880", "capacity drag around 7%", "Productive work 93%", "Necessary administrative load 5%", "Recoverable drag 2%", "8 people per normal run", "600 runs/yr", "4 ambiguity-driven coordination hrs/run", "40% score-responsive attribution"],
    "ip": ["8,448 annual burden hours", "$844,800", "capacity drag around 26%", "Productive work 74%", "Necessary administrative load 17%", "Recoverable drag 9%", "18 people per normal run", "240 tasking cycles/yr", "64 coordination hrs/run", "55% modeled burden attribution"],
}
for product, tokens in expected_economics.items():
    for token in tokens:
        require(token in sample, f"{product} sample missing current-model economics token: {token}")
for stale in ["31,500 annual burden hours","$2.9M*","5,500 annual burden hours","$600,930*","2,000 annual burden hours","$153,894*","58,800 annual burden hours","$5,875,200*","$29.4M  ·  294K hrs"]:
    require(stale not in sample, f"stale sample economics remain: {stale}")

# Sample provenance must identify the currently certified scorer/config pair.
for token in [
    "config 1.2.0 · scorer operational_systems_high_score_good_2026_08_13_experience_neutral_v3",
    "config 1.0.0 · scorer decision_velocity_high_score_good_2026_08_12_release_v3",
    "config 1.2.0 · scorer structural_clarity_high_score_good_2026_08_11_methodology_v4",
    "config 1.2.0 · scorer institutional_performance_high_score_good_2026_08_10_missingness_v2",
]: require(token in sample, f"sample provenance missing current pair: {token}")

# A single run may contain self-reported direction or change-pressure evidence;
# it may not be visualized or narrated as a measured time series.
fake_series = "[18,20,22,25,28,31]"
for key in ["os", "sc", "ip"]:
    require(fake_series not in products[key], f"{key} still fabricates historical sparkline points")
    require("A single run cannot supply a time series" in products[key], f"{key} lacks non-temporal change glyph contract")
require("Self-reported change: --" in products["os"], "OS customer surface still labels single-run change as Trajectory")
require("Change-pressure risk: --" in products["sc"], "SC customer surface lost change-pressure risk label")
require("Self-reported change: --" in products["ip"], "IP customer surface still labels single-run change as Trajectory")
require("cost of waiting compounds" not in products["ip"], "IP still turns a single-run signal into compounding trend language")
require("not a measured longitudinal trend or forecast" in products["ip"], "IP lacks explicit non-longitudinal/non-predictive boundary")
require("Design reference: --" in products["ip"], "IP export surface still labels design reference as Benchmark")
require("<strong>Condition profile</strong>" in products["ip"], "IP condition-profile tooltip is mislabeled")

# Marketing copy must obey the same single-run and benchmark boundaries.
for token in ["<strong>Self-reported change.</strong> Operational creep is rising.", "<strong>Self-reported change.</strong> Rising drag pressure.", "<strong>Change-pressure risk.</strong> No elevated change-pressure signal.", "<strong>Self-reported change.</strong> Rising strain."]:
    require(token in sample, f"sample missing bounded change language: {token}")
require("likely to continue accumulating" not in sample, "DV sample still predicts future accumulation from one run")
require("Against comparable institutions" not in sample, "IP sample still presents the design reference as empirical peer comparison")
require("Degraded institutional condition" in sample, "IP score 47 is not using its current certified band")

# Synthesis samples remain rendered through the exact shared customer renderer.
require('<script src="monderman-report.js"></script>' in sample, "sample does not load shared customer report renderer")
require('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample and 'MondermanReport.fromSynthesis(fixtures.depth)' in sample, "Synthesis sample adapter parity broken")
require(sample.count('class="sample-depth-read"') == 4, "all four Diagnostic samples must expose insight_depth")
for token in ['6 / 8','7 / 8','5 / 8','single-run ceiling','score is not out of 100']:
    require(token in sample, f"single-run evidence-context fidelity missing: {token}")
require(sample.count('class="toc-rail synthesis-toc"') == 2, "Synthesis Contents rails missing")
require('buildSynthesisContents' in sample, "Synthesis Contents generation missing")
for token in ['score_status: "published"','cross_diagnostic_score: 55.5','evidence_label: "Strong"','respondent_count: 48','lens_count: 4','aggregate_score: 56','evidence_label: "Substantial"','respondent_count: 18']:
    require(token in sample, f"Synthesis fixture fidelity missing: {token}")
for token in ['aria-label="Depth Synthesis score distribution"','aria-label="Cross-Lens Diagnostic score comparison"','Executive decision frame','mr-decision-frame','mr-evidence-ladder','mr-action-path','Executive synthesis','Agreements and differences','Evidence-proportionate actions','What to watch next']:
    require(token in renderer, f"production Synthesis renderer missing: {token}")

if failures:
    print("SAMPLE_PRODUCT_FIDELITY_FAIL")
    for item in failures: print("-", item)
    raise SystemExit(1)
print("SAMPLE_PRODUCT_FIDELITY_PASS")
