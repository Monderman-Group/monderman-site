from pathlib import Path
import re


def replace_all_known(text: str, replacements: dict[str, str]) -> str:
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


page_path = Path("institutional-performance.html")
page = page_path.read_text()

# Visible evidence labels and the exact unsupported trajectory claims that were
# duplicated in the page's deterministic fallback copy.
page = replace_all_known(page, {
    "Above comparable range": "Above instrument design-reference range",
    "Within comparable range": "Within instrument design-reference range",
    "Below comparable range": "Below instrument design-reference range",
    "above comparable range": "above the instrument design-reference range",
    "within comparable range": "within the instrument design-reference range",
    "below comparable range": "below the instrument design-reference range",
    "peer benchmark": "instrument design reference",
    "Peer benchmark": "Instrument design reference",
    "industry benchmark": "instrument design reference",
    "Industry benchmark": "Instrument design reference",
    "Acting while visible performance still looks acceptable is materially cheaper than acting after it slips.": "A follow-up run can test whether the reported direction persists and which condition is moving.",
    "That combination narrows the margin before visible performance moves.": "That combination warrants timely follow-up measurement.",
})

# Give the live report an explicit output-contract marker for the acceptance
# runner without exposing a public test surface.
if 'data-ip-output-contract="2026-08-14.1"' not in page:
    page = page.replace('<body', '<body data-ip-output-contract="2026-08-14.1"', 1)

# The page carried the same secondary sector-adjusted recovery calculation as
# the API. Replace each local copy with the scorer's disclosed exposure values.
start_marker = '  estimateReclaimPotential(result, payload) {'
end_marker = '\n  },\n};'
search_from = 0
replacements = 0
while True:
    start = page.find(start_marker, search_from)
    if start < 0:
        break
    end = page.find(end_marker, start)
    if end < 0:
        raise SystemExit("Could not close a frontend IP reclaim estimator")
    replacement = '''  estimateReclaimPotential(result, _payload) {
    const amountRaw = result?.exposure?.recoverable_cost;
    const factorRaw = result?.exposure?.recoverable_share_percent;
    return {
      amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : null,
      factor: Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : null,
      basis: "run_exposure_model",
      empirical_benchmark: false,
      driverText: "Uses the run's disclosed recoverable-share scenario; no sector peer factor is added."
    };
  },'''
    page = page[:start] + replacement + page[end:]
    search_from = start + len(replacement)
    replacements += 1

# Metadata display: prefer the finalized payload, format headcount, and never
# expose the raw role token to a customer.
page = re.sub(
    r'const\s+cfg\s*=\s*\(typeof\s+state\s*!==\s*["\']undefined["\']\s*&&\s*state\.configVersion\)\s*\?\s*state\.configVersion\s*:\s*["\']—["\'];',
    'const cfg = result?.config_version || result?.configVersion || payload?.routing_meta?.configVersion || ((typeof state !== "undefined" && state.configVersion) ? state.configVersion : "—");',
    page,
)
page = page.replace('inputs.push(`organization of ${orgN}`);', 'inputs.push(`${Number(orgN).toLocaleString("en-US")} employees`);')
page = page.replace('String(mode)', 'String(mode).replace(/_/g, " ")')

# Make the reference basis explicit anywhere the page builds a benchmark object.
page = page.replace('empirical_benchmark: true', 'empirical_benchmark: false')
page = page.replace('benchmark_basis: "peer"', 'benchmark_basis: "expert-authored instrument design reference"')
page = page.replace('benchmark_basis: "industry"', 'benchmark_basis: "expert-authored instrument design reference"')

page_path.write_text(page)

validator_path = Path("scripts/validate_ip_output_integrity.py")
validator_path.write_text(r'''from pathlib import Path
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

# The production page must retain the four artifact paths.
for required in ["Download PDF", "Executive summary", "Full report", "JSON"]:
    assert required.lower() in page.lower(), required

# Any local reclaim estimator must be the passthrough implementation.
for match in re.finditer(r'estimateReclaimPotential\(result, _payload\)', page):
    window = page[match.start():match.start() + 700]
    assert "result?.exposure?.recoverable_cost" in window
    assert "result?.exposure?.recoverable_share_percent" in window

print("Institutional Performance frontend output-integrity regression passed.")
''')
