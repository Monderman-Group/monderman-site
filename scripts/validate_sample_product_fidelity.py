from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")
renderer = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
repair = (ROOT / "scripts/rebuild_sample_product_fidelity.py").read_text(encoding="utf-8")
quadrant_alignment = (ROOT / "scripts/align_sample_quadrants_to_production.py").read_text(encoding="utf-8")

failures = []

def require(cond, msg):
    if not cond:
        failures.append(msg)

# Diagnostic marketing reports must use the same quadrant concepts, geometry,
# threshold rules, and coordinate clamp as the customer Diagnostic component.
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
        require('data-production-component="diagnostic-quadrant"' in body, f"{section_id} is not marked as the production quadrant component")
        require(f'data-y-threshold="{y_threshold}"' in body, f"{section_id} does not use production y-threshold {y_threshold}")
        require("sample-production-quadrant-box" in body, f"{section_id} lacks production quadrant geometry")
        require("sample-quadrant-dot" in body, f"{section_id} has no plotted quadrant dot")
        require("role=\"img\"" in body, f"{section_id} quadrant is not exposed as a graphic")
        require("Representative plotted values:" in body, f"{section_id} lacks disclosed representative axis values")

for token in [
    'height:320px',
    'width:22px;height:22px',
    'calc(50% - 1px)',
    'calc(67% - 1px)',
    'max(8, min(92, cfg["x"]))',
    'max(8, min(92, 100 - cfg["y"]))',
]:
    require(token in quadrant_alignment, f"production quadrant alignment missing rule: {token}")

# The Diagnostic samples retain production visualization primitives/snapshots.
for token in [
    'aria-label="Burden composition — share of total"',
    'aria-label="Burden severity by dimension"',
    'aria-label="Intervention order"',
    'aria-label="Score in sector context"',
    'aria-label="Where annual labor capacity goes"',
]:
    require(token in sample, f"missing Diagnostic production visual: {token}")

# Synthesis samples must be rendered through the exact customer renderer.
require('<script src="monderman-report.js"></script>' in sample, "sample does not load shared customer report renderer")
require('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, "Cross-Lens sample does not use MondermanReport.fromSynthesis")
require('MondermanReport.fromSynthesis(fixtures.depth)' in sample, "Depth sample does not use MondermanReport.fromSynthesis")
require('MondermanReport.render("sampleCrossLensRendered"' in sample, "Cross-Lens sample not rendered through MondermanReport")
require('MondermanReport.render("sampleDepthRendered"' in sample, "Depth sample not rendered through MondermanReport")

# Flagship Cross-Lens marketing example must be a legitimate publishable case.
for token in [
    'score_status: "published"',
    'cross_diagnostic_score: 55.5',
    'evidence_label: "Strong"',
    'respondent_count: 48',
    'lens_count: 4',
    'Structural Clarity',
    'Decision Velocity',
    'Operational Systems',
    'Institutional Performance',
    'Strong evidence · published composite',
]:
    require(token in sample, f"Cross-Lens flagship missing: {token}")
require('Composite Score withheld' not in sample, "flagship sample still defaults to a withheld Composite Score")
require('Comparison Only' not in sample, "flagship sample still presents Comparison Only evidence")

# Depth must be analytically substantive and use fields the live API already returns.
for token in [
    'aggregate_score: 56',
    'evidence_label: "Substantial"',
    'respondent_count: 18',
    'observed_set_label: "Substantial"',
    'mean: 57.2',
    'median: 56',
    'sd: 9.4',
    'min: 41',
    'max: 74',
    'iqr: [50, 64]',
    'participant_mode: "operational"',
    'participant_mode: "managerial"',
    'participant_mode: "senior_leader"',
    'gap: 15.8',
    'priority_actions:',
    'leading_indicators:',
    'Substantial evidence · 18 eligible runs',
]:
    require(token in sample, f"Depth sample missing substantive field: {token}")

# The actual production Synthesis renderer must now expose these visuals and richer sections.
for token in [
    'aria-label="Depth Synthesis score distribution"',
    'aria-label="Cross-Lens Diagnostic score comparison"',
    'Observed participant distribution',
    'Executive synthesis',
    'Agreements and differences',
    'Evidence-proportionate actions',
    'What to watch next',
    'same-Diagnostic',
]:
    require(token in renderer, f"production Synthesis renderer missing: {token}")
require('same-instrument read across multiple respondents' not in renderer, "stale same-instrument Synthesis copy remains")

# Repair must be deterministic: production renderer and sample are generated,
# then the sample quadrant is normalized to the exact live component geometry.
require('monderman-report.js' in repair and 'sample-report.html' in repair, "repair does not update renderer and samples together")
require('sample-report.html' in quadrant_alignment, "quadrant alignment does not deterministically target sample report")

if failures:
    print("SAMPLE_PRODUCT_FIDELITY_FAIL")
    for item in failures:
        print("-", item)
    raise SystemExit(1)

print("SAMPLE_PRODUCT_FIDELITY_PASS")
