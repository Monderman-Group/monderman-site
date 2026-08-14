from pathlib import Path
import re

page = Path("operational-systems.html").read_text()
harness = Path("operational-systems-acceptance-harness.html").read_text()

assert "estimatedAdminLoad" not in page
assert "const capacityComposition = calculateCapacityComposition(exposure);" in page
assert "The participant reported that burden has grown over the stated period." in page
assert "cost of waiting compounds" not in page
assert "limited input depth" not in page
assert "Harness build 2026-08-14.1" in harness
assert "no sector peer factor is added" in harness
assert '.primary-read strong' in harness
assert 'authoritativeQualitativeType!=="none"' in harness
assert 'reference\\s+(?:range|of)' in harness
assert 'result?.config_version || result?.configVersion' in page
assert 'displayPerspectiveLabel(mode)' in page
assert page.count('function detectQualitativeOverride(payload = {}, result = {})') == 1
assert 'detectQualitativeOverride(payload, result)' in page
assert 'detectQualitativeOverride(payload || {}, result || {})' in page
assert 'toLocaleString("en-US")} employees' in page
assert "inputs governs" not in page
assert "aggressive paths buy more capacity" not in page
assert "Experiential bypass signals" not in page
assert "becomes increasingly expensive to sustain" not in page
assert "Qualitative signals, when present" in page
assert "may be more expensive to sustain than the visible output suggests" in page
assert '"recommended_interventions","experiential_synthesis"' in harness
assert "particularly\\s+susceptible" in harness
assert "every\\s+(?:quarter|cycle|month|year)\\s+of\\s+delay" in harness
for check in [
    "Full-report capacity allocation reconciles to the exposure model",
    "Governance interpretation preserves the scenario context",
    "Experiential synthesis acknowledges supplied participant notes",
    "Customer experiential signal matches API classification",
    "Experiential synthesis preserves single-participant provenance",
    "Self-reported trajectory does not predict a rising cost of delay",
    "Basis of read preserves version and display metadata",
    "Generated claims do not invent an ideal capacity benchmark",
    "Generated claims do not assign unsupported hours to a burden source",
    "Generated claims avoid outcome certainty and intervention forecasts",
    "Generated burden scope matches measured severities",
    "Static report copy remains mechanically and analytically calibrated",
    "Remedy paths keep cross-dimension effects and workaround causality directional",
    "Update evidence does not request measurements already supplied",
    "One disclosed recoverable model feeds the report",
]:
    assert check in harness, check

annual_hours = 1980
capacity_hours = 32400
recoverable_share = 39
total_drag = annual_hours / capacity_hours * 100
recoverable = total_drag * recoverable_share / 100
admin = total_drag - recoverable
productive = 100 - total_drag
assert (round(productive), round(admin), round(recoverable)) == (94, 4, 2)
print("PASS: Operational Systems frontend output-integrity regressions.")
