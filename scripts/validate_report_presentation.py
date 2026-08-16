from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")

errors = []
def req(cond, msg):
    if not cond:
        errors.append(msg)

# Typography must be internally consistent, not merely sans-serif. The renderer
# declares Neue Haas Grotesk and every report surface—including generated SVG
# charts—must inherit/use that family before falling back.
req('font-family:Georgia' not in report and 'Times New Roman' not in report, 'shared report renderer still specifies serif body typography')
req('font-family:Helvetica Neue,Arial,sans-serif' not in report, 'Synthesis SVG still forces Helvetica instead of the report font')
req('font-family:\\"Helvetica Neue\\",Arial,sans-serif' not in report, 'report component still forces Helvetica instead of Neue Haas')
req('font-family:"Neue Haas Grotesk"' in report, 'Neue Haas Grotesk is not declared in shared report renderer')

# Shared report isolation and source-aligned cover.
req('class="mr-report"><div class="mr-page"' in report, 'shared renderer is not isolated under mr-report/mr-page')
req('.mr-report h1,.mr-report h2,.mr-report h3' in report, 'heading rules are not scoped to report root')
req('.mr-report p{' in report, 'paragraph rules are not scoped to report root')
req('mr-report-boundary' in report, 'end-of-report interpretation-boundary component missing')
req('mr-cover-boundary' in report, 'cover-level interpretation boundary missing')
req('mr-cover-dark' in report and 'mr-cover-white' in report and 'mr-cover-stripe' in report, 'source-aligned dark/white report cover missing')
req('scoreBandDisplay' in report, 'cover does not separate the score label from the condition-band display')
req('firstStr(m.scoreLabel, defaultScoreLabel)' in report, 'cover discards the API-provided score label')
req('Number.isInteger(score) ? score : Math.round(score * 10) / 10' in report, 'fractional published Synthesis score is not preserved as a number')

# Evidence-bearing visuals must be substantive and use only existing certified
# fields. Cross-Lens needs both a comparison chart and an evidence map; source-
# backed economics need a bounded range visual when the fields are available.
for token, msg in [
    ('aria-label="Cross-Lens Diagnostic score comparison"', 'Cross-Lens comparison visual missing'),
    ('aria-label="Depth Synthesis score distribution"', 'Depth distribution visual missing'),
    ('function renderCrossLensEvidenceMap', 'Cross-Lens evidence map renderer missing'),
    ('Cross-lens evidence map', 'Cross-Lens evidence map label missing'),
    ('it does not assert a causal pathway', 'Cross-Lens evidence map lacks explicit non-causal boundary'),
    ('function renderExposureRangeGraphic', 'source-backed exposure-range visual missing'),
    ('Observed exposure ranges', 'exposure-range visual label missing'),
    ('bar lengths should not be compared across the two metrics', 'exposure-range local-scale warning missing'),
]:
    req(token in report, msg)

# Do not render the same Cross-Lens convergence narrative twice. Depth keeps its
# ordinary recurring-signal cards; Cross-Lens carries those signals in the map.
req('const crossLensMapped = m.product === "cross_lens";' in report, 'Cross-Lens mapped-signal de-duplication guard missing')
req('signals.length && !crossLensMapped' in report, 'Cross-Lens recurring signals can still be duplicated below the evidence map')

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

# Marketing sample disclosure and renderer parity.
req('Representative product outputs — not customer data.' in sample, 'top representative-output disclosure missing')
req('synthesis-report-stage' in sample, 'Synthesis report stage wrapper missing')
req('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, 'Cross-Lens sample is not using shared customer renderer')
req('MondermanReport.fromSynthesis(fixtures.depth)' in sample, 'Depth sample is not using shared customer renderer')

# Existing product fidelity requirements remain mandatory for the four certified
# Diagnostics. These samples must retain production visualization primitives.
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
    for e in errors:
        print('-', e)
    raise SystemExit(1)
print('REPORT_PRESENTATION_STATIC_PASS')
