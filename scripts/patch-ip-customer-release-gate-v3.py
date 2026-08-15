from pathlib import Path
import re

path = Path("institutional-performance.html")
text = path.read_text()

# Customer-facing evidence labels: these ranges are expert-authored instrument
# design references, not empirical peer comparisons.
for old, new in {
    "Above comparable range": "Above design-reference range",
    "Within comparable range": "Within design-reference range",
    "Below comparable range": "Below design-reference range",
    "comparable range": "design-reference range",
    "Comparable range": "Design-reference range",
    "industry benchmark": "instrument design reference",
    "Industry benchmark": "Instrument design reference",
    "peer benchmark": "instrument design reference",
    "Peer benchmark": "Instrument design reference",
}.items():
    text = text.replace(old, new)

# A single run may report perceived direction; it cannot predict cost of delay
# or establish causation.
for old, new in {
    "Acting while visible performance still looks acceptable is materially cheaper than acting after it slips.": "A follow-up measurement can test whether the participant's reported direction persists.",
    "That combination narrows the margin before visible performance moves.": "That combination is a follow-up hypothesis rather than a forecast.",
    "which specific change produced that": "which specific change may have contributed",
    "will continue to worsen": "may continue unless the measured condition changes",
    "will inevitably": "may",
}.items():
    text = text.replace(old, new)

# Prefer the scorer's one disclosed recovery model wherever the report creates a
# local reclaim-potential object. Keep this replacement deliberately narrow.
patterns = [
    r"const\s+reclaimPotential\s*=\s*DiagnosticInterpretationLayer\.estimateReclaimPotential\([^;]+;",
    r"const\s+reclaimPotential\s*=\s*estimateReclaimPotential\([^;]+;",
]
replacement = '''const reclaimPotential = {
    amount: Number.isFinite(Number(result?.exposure?.recoverable_cost)) ? Number(result.exposure.recoverable_cost) : null,
    factor: Number.isFinite(Number(result?.exposure?.recoverable_share_percent)) ? Number(result.exposure.recoverable_share_percent) : null,
    driverText: Number.isFinite(Number(result?.exposure?.recoverable_cost))
      ? "Uses the run's disclosed exposure model and recoverable share; no sector peer factor is added."
      : "A recoverable-value estimate is withheld because the required sizing inputs were not supplied."
  };'''
for pattern in patterns:
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count:
        break

# When a local object is already present, make its amount and factor authoritative
# without disturbing the surrounding renderer.
text = re.sub(
    r"(reclaimPotential\s*=\s*\{[^{}]*?amount\s*:\s*)([^,\n]+)",
    r"\1(Number.isFinite(Number(result?.exposure?.recoverable_cost)) ? Number(result.exposure.recoverable_cost) : null)",
    text,
    count=1,
    flags=re.S,
)
text = re.sub(
    r"(reclaimPotential\s*=\s*\{[^{}]*?factor\s*:\s*)([^,\n}]+)",
    r"\1(Number.isFinite(Number(result?.exposure?.recoverable_share_percent)) ? Number(result.exposure.recoverable_share_percent) : null)",
    text,
    count=1,
    flags=re.S,
)

# Display labels should not expose raw role tokens.
text = text.replace("senior_leader", "senior leader")

# Preserve result-level version metadata when the renderer has a local config
# variable. This leaves existing fallbacks intact but makes the finalized result
# authoritative.
text = re.sub(
    r"const\s+cfg\s*=\s*([^;]+);",
    r"const cfg = result?.config_version || result?.configVersion || \1;",
    text,
    count=1,
)

# Append a small, non-visual contract marker used by the permanent release
# validator. It does not change customer rendering.
marker = "<!-- IP_RELEASE_CONTRACT_V1 -->"
if marker not in text:
    text = text.replace("</body>", f"{marker}\n</body>")

path.write_text(text)
print("Applied Institutional Performance frontend customer-release hardening.")
