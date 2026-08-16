from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")

errors = []
def req(cond, msg):
    if not cond: errors.append(msg)

req('font-family:Georgia' not in report and 'Times New Roman' not in report, 'shared report renderer still specifies serif body typography')
req('class="mr-report"><div class="mr-page"' in report, 'shared renderer is not isolated under mr-report/mr-page')
req('.mr-report h1,.mr-report h2,.mr-report h3' in report, 'heading rules are not scoped to report root')
req('.mr-report p{' in report, 'paragraph rules are not scoped to report root')
req('mr-report-boundary' in report, 'integrated interpretation-boundary component missing')
req('mr-cover-dark' in report and 'mr-cover-white' in report and 'mr-cover-stripe' in report, 'source-aligned dark/white report cover missing')
req('Number.isInteger(score) ? score : Math.round(score * 10) / 10' in report, 'fractional published Synthesis score is not preserved as a number')

# The evidence-bearing visual must lead the Synthesis, not trail the evidence matrix.
order = [
    report.find('      renderDepthDistribution,'),
    report.find('      renderLensSummary,'),
    report.find('      renderMetaFinding,'),
    report.find('      renderMetaEvidence,'),
]
req(all(x >= 0 for x in order), 'Synthesis renderer sequence not found')
if all(x >= 0 for x in order):
    req(order[0] < order[2] and order[1] < order[2] and order[2] < order[3], 'Synthesis evidence chart does not precede narrative/evidence matrix')

req('Representative product outputs — not customer data.' in sample, 'top representative-output disclosure missing')
req('synthesis-report-stage' in sample, 'Synthesis report stage wrapper missing')
req('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, 'Cross-Lens sample is not using shared customer renderer')
req('MondermanReport.fromSynthesis(fixtures.depth)' in sample, 'Depth sample is not using shared customer renderer')

# Existing product fidelity requirements remain mandatory.
for token in [
    'aria-label="Burden composition — share of total"',
    'aria-label="Burden severity by dimension"',
    'aria-label="Intervention order"',
    'aria-label="Score in sector context"',
    'sample-production-quadrant',
    'cross_diagnostic_score: 55.5',
    'evidence_label: "Strong"',
    'aggregate_score: 56',
    'evidence_label: "Substantial"',
]:
    req(token in sample, f'missing product-fidelity token: {token}')

if errors:
    print('REPORT_PRESENTATION_STATIC_FAIL')
    for e in errors: print('-', e)
    raise SystemExit(1)
print('REPORT_PRESENTATION_STATIC_PASS')
