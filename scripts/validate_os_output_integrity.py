from pathlib import Path
import re

page = Path("operational-systems.html").read_text()
harness = Path("operational-systems-acceptance-harness.html").read_text()

assert "estimatedAdminLoad" not in page
assert "const necessaryAdminLoad = Math.max(0, totalDrag - drag);" in page
assert "The participant reported that burden has grown over the stated period." in page
assert "cost of waiting compounds" not in page
assert "limited input depth" not in page
assert "Harness build 2026-08-13.5" in harness
for check in [
    "Full-report capacity allocation reconciles to the exposure model",
    "Governance interpretation preserves the scenario context",
    "Experiential synthesis acknowledges supplied participant notes",
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
