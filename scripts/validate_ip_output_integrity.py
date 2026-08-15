from pathlib import Path
import re

page = Path("institutional-performance.html").read_text()

assert 'data-ip-output-contract="2026-08-14.1"' in page
assert "run_exposure_model" in page
assert "recoverable_cost" in page
assert "recoverable_share_percent" in page
assert "no sector peer factor is added" in page
assert "empirical_benchmark: true" not in page
assert "Above comparable range" not in page
assert "Within comparable range" not in page
assert "Below comparable range" not in page
assert "materially cheaper than acting after it slips" not in page
assert "narrows the margin before visible performance moves" not in page
assert "organization of ${orgN}" not in page
assert "config_version" in page
assert "interpretive_state" in page
assert "instrument design-reference range" in page

for required in ["pdf", "executive summary", "full report", "json"]:
    assert required in page.lower(), required

for match in re.finditer(r"estimateReclaimPotential\(result, _payload\)", page):
    window = page[match.start():match.start() + 700]
    assert "result?.exposure?.recoverable_cost" in window
    assert "result?.exposure?.recoverable_share_percent" in window

print("Institutional Performance frontend output-integrity regression passed.")
