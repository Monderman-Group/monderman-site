from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")

errors = []
def req(cond, msg):
    if not cond: errors.append(msg)

# Typography and renderer isolation.
req('font-family:Georgia' not in report and 'Times New Roman' not in report, 'shared report renderer still specifies serif body typography')
req('class="mr-report"><div class="mr-page"' in report, 'shared renderer is not isolated under mr-report/mr-page')
req('.mr-report h1,.mr-report h2,.mr-report h3' in report, 'heading rules are not scoped to report root')
req('.mr-report p{' in report, 'paragraph rules are not scoped to report root')
req('font-size:clamp(2.15rem,4.2vw,3rem)!important' in report, 'Synthesis cover title has not been restrained to source-aligned scale')
req('font-size:clamp(1.55rem,2.5vw,1.9rem)!important' in report, 'Synthesis section hierarchy remains too weak')

# The interpretation boundary belongs at the beginning of the read, not as a footer afterthought.
req('return coverBlock + buildReportBoundary(m) + renderMetaSynthesis(m);' in report, 'Synthesis interpretation boundary is not immediately below the cover')
req('mr-report-boundary' in report and 'border-left:4px solid #0C6E78' in report, 'integrated interpretation-boundary treatment missing')

# Current code must expose the structured fields as real visuals, without adding a new score.
for token in [
    'function renderDepthDistributionGraphic',
    'aria-label="Depth Synthesis score distribution"',
    'function renderCrossLensGraphic',
    'aria-label="Cross-Lens Diagnostic score comparison"',
    'function renderEvidenceIntegrityGraphic',
    'aria-label="Synthesis evidence integrity map"',
    'function renderSignalLensMatrix',
    'aria-label="Cross-Lens recurring signal map"',
    'function renderExposureGraphic',
    'aria-label="Source-backed pathway exposure ranges"',
    'mr-action-grid',
    'mr-vantage-grid',
    'mr-indicator-grid',
]:
    req(token in report, f'missing Synthesis presentation primitive: {token}')

# Evidence comes before agreement/exposure/action interpretation.
order = [
    report.find('      renderDepthDistribution,'),
    report.find('      renderLensSummary,'),
    report.find('      renderMetaFinding,'),
    report.find('      renderMetaEvidence,'),
    report.find('      renderMetaSignals,'),
    report.find('      renderMetaExposure,'),
    report.find('      renderMetaActions,'),
]
req(all(x >= 0 for x in order), 'Synthesis renderer sequence not found')
if all(x >= 0 for x in order):
    req(order == sorted(order), 'Synthesis evidence and interpretation sequence is out of order')

# Sample library must remain representative and use the exact shared Synthesis renderer.
req('Representative product outputs — not customer data.' in sample, 'top representative-output disclosure missing')
req('synthesis-report-stage' in sample, 'Synthesis report stage wrapper missing')
req('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, 'Cross-Lens sample is not using shared customer renderer')
req('MondermanReport.fromSynthesis(fixtures.depth)' in sample, 'Depth sample is not using shared customer renderer')

# Existing Diagnostic and Synthesis product fidelity remains mandatory.
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
