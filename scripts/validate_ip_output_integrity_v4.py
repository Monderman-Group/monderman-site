from pathlib import Path
import re

page = Path("institutional-performance.html").read_text()
lower = page.lower()

assert "IP_RELEASE_CONTRACT_V1" in page
assert "design-reference range" in lower
assert "comparable range" not in lower
assert "industry benchmark" not in lower
assert "peer benchmark" not in lower
assert "result?.exposure?.recoverable_cost" in page
assert "result?.exposure?.recoverable_share_percent" in page
assert "no sector peer factor is added" in page
assert "materially cheaper than acting after" not in page
assert "narrows the margin before visible performance moves" not in page
assert "which specific change produced that" not in page
assert "result?.config_version || result?.configVersion" in page
# Raw role tokens may exist in routing logic, but customer-facing labels must be
# passed through the display-label helper rather than printed directly.
assert "displayPerspectiveLabel" in page or "humanize" in page

scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", page, re.S | re.I)
inline = [s for s in scripts if s.strip()]
Path("/tmp/ip-inline-scripts.js").write_text("\n;\n".join(inline))
print("Institutional Performance frontend integrity regression v4 passed.")
