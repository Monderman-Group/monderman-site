from pathlib import Path
import re

path = Path("institutional-performance.html")
text = path.read_text()

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
    "Acting while visible performance still looks acceptable is materially cheaper than acting after it slips.": "A follow-up measurement can test whether the participant's reported direction persists.",
    "That combination narrows the margin before visible performance moves.": "That combination is a follow-up hypothesis rather than a forecast.",
    "which specific change produced that": "which specific change may have contributed",
    "will continue to worsen": "may continue unless the measured condition changes",
    "will inevitably": "may",
}.items():
    text = text.replace(old, new)

# Use the scorer's disclosed recovery amount and percentage. Do not derive a
# second sector-adjusted figure in the browser.
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
    candidate, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count:
        text = candidate
        break

# If the page builds reclaimPotential as a literal, rewrite only its amount and
# factor expressions. No other report fields are touched.
text = re.sub(
    r"(const\s+reclaimPotential\s*=\s*\{[\s\S]{0,600}?\bamount\s*:\s*)([^,\n]+)",
    r"\1(Number.isFinite(Number(result?.exposure?.recoverable_cost)) ? Number(result.exposure.recoverable_cost) : null)",
    text,
    count=1,
)
text = re.sub(
    r"(const\s+reclaimPotential\s*=\s*\{[\s\S]{0,800}?\bfactor\s*:\s*)([^,\n}]+)",
    r"\1(Number.isFinite(Number(result?.exposure?.recoverable_share_percent)) ? Number(result.exposure.recoverable_share_percent) : null)",
    text,
    count=1,
)

# Make the finalized result version authoritative where the report has a basis
# variable. Do not rewrite configuration objects used by the questionnaire.
if "result?.config_version || result?.configVersion" not in text:
    basis_patterns = [
        r"const\s+cfg\s*=\s*\(typeof state !== \"undefined\"[^;]+;",
        r"const\s+configVersion\s*=\s*([^;]+);",
    ]
    for pattern in basis_patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        original = match.group(0)
        name = "cfg" if original.lstrip().startswith("const cfg") else "configVersion"
        rhs = original.split("=", 1)[1].rsplit(";", 1)[0].strip()
        new = f"const {name} = result?.config_version || result?.configVersion || ({rhs});"
        text = text[:match.start()] + new + text[match.end():]
        break

marker = "<!-- IP_RELEASE_CONTRACT_V1 -->"
if marker not in text:
    text = text.replace("</body>", f"{marker}\n</body>")

path.write_text(text)
print("Applied Institutional Performance frontend customer-release hardening v4.")
