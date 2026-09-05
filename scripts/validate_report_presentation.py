import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
sample = (ROOT / "sample-report.html").read_text(encoding="utf-8")
engine_fixture = json.loads((ROOT / "test-fixtures" / "authenticated-report-engine-runs.json").read_text(encoding="utf-8"))
render_smoke = (ROOT / "scripts" / "report_presentation_smoke.mjs").read_text(encoding="utf-8")
generator = (ROOT / "scripts" / "generate_production_sample_outputs.mjs").read_text(encoding="utf-8")

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
cross_sequence = report.find('      renderCrossLensSystemRead,')
cross_lenses = report.find('      renderLensSummary,', cross_sequence)
cross_narrative = report.find('      renderMetaFinding,', cross_lenses)
depth_sequence = report.find('      renderDepthDistribution,', cross_narrative)
req(min(cross_sequence, cross_lenses, cross_narrative, depth_sequence) >= 0, 'Synthesis renderer sequence not found')
if min(cross_sequence, cross_lenses, cross_narrative, depth_sequence) >= 0:
    req(cross_sequence < cross_lenses < cross_narrative < depth_sequence, 'Cross-Lens system visual does not lead its narrative or Depth distribution is missing')

# Synthesis editorial-family requirements. The engine supplies structured evidence;
# the renderer must not turn prose/evidence/action sections into a wall of dashboard tiles.
for token, msg in [
    ('mr-evidence-grid', 'Synthesis evidence status is not rendered as a continuous evidence table'),
    ('mr-diagnosis-block', 'Executive synthesis diagnosis is not rendered as an editorial lead block'),
    ('mr-depth-stats', 'Depth statistics are not rendered as a continuous statistics block'),
    ('mr-editorial-row', 'Synthesis prose/action rows are still using undifferentiated card presentation'),
    ('Synthesis is an executive report, not a dashboard', 'editorial-family CSS contract missing'),
    ('The operating system in one view', 'Cross-Lens lacks an early system picture'),
    ('mr-system-map', 'Cross-Lens system picture is not rendered as a substantive visual'),
    ('mr-decision-frame', 'Synthesis decision metrics are not rendered'),
    ('mr-evidence-ladder', 'Synthesis evidence strength ladder is missing'),
    ('mr-action-path', 'Synthesis action sequence visual is missing'),
]:
    req(token in report, msg)

# Marketing sample disclosure and production-artifact renderer parity.
production_renderer = (ROOT / "sample-report-production.js").read_text(encoding="utf-8")
production_styles = (ROOT / "sample-report-production.css").read_text(encoding="utf-8")
req('Representative product outputs, not customer data.' in sample, 'top representative-output disclosure missing')
req('synthesis-report-stage' in sample, 'Synthesis report stage wrapper missing')
req('sample-report-production.js?v=20260824-sample-alignment2' in sample, 'aligned production sample renderer missing')
req('sample-report-production.css?v=20260824-sample-alignment' in sample, 'aligned production sample presentation missing')
req('sample-data/production-diagnostic-samples.json?v=eed3e2819589' in production_renderer, 'production artifact URL mismatch')
req('data-engine-commit' in production_renderer and 'data-artifact-sha256' in production_renderer, 'visible sample provenance missing')
for token in ['Report.fromRun(source)','Report.render(stage, model)','Report.downloadHtml(model)','Report.downloadJson(source','Report.downloadPdf(model)']:
    req(token in production_renderer, f'public Diagnostic sample bypasses the certified engine bridge: {token}')
for token in ['Executive decision brief','Dimension profile','Capacity exposure','Leadership read','Evidence status','Action architecture','Method and limits','Leadership handoff','Interpretation boundary']:
    req(token in report, f'authenticated Diagnostic presentation missing: {token}')
req('No usable participant notes are presented.' in report, 'empty or quarantined participant-evidence state is not explicit')
for token in ['mr-run-decision','mr-dimension-profile','mr-constraint-view','mr-exposure-flow','mr-priority-matrix','mr-priority-ladder','mr-remedy-grid','mr-remedy-evidence','mr-run-method','mr-leadership-close']:
    req(token in report, f'premium Diagnostic visual contract missing: {token}')
for token in ['mr-depth-system-read','mr-depth-metrics','mr-interaction-grid','mr-system-metrics']:
    req(token in report, f'premium Synthesis visual contract missing: {token}')
req(engine_fixture.get('engine_commit') == 'fbbadb70b4d0c480f5d4ae58c4b6285b3164fccc', 'authenticated report fixture is not locked to the corrected API engine')
req(set(engine_fixture.get('outputs', {})) == {'operational_systems','decision_velocity','structural_clarity','institutional_performance'}, 'authenticated report fixture does not cover all four Diagnostics')
req('a the instrument design reference' not in json.dumps(engine_fixture).lower(), 'authenticated report fixture retains the stacked-article prose defect')
req('test-fixtures/authenticated-report-engine-runs.json' in render_smoke, 'visual gate does not render the authenticated engine fixture')
req("{ name:'mobile', width:390" in render_smoke and "{ name:'tablet', width:768" in render_smoke and "{ name:'desktop', width:1440" in render_smoke, 'visual gate does not cover mobile, tablet, and desktop')
req("emulateMedia({ media:'print' })" in render_smoke and '.pdf' in render_smoke, 'visual gate does not cover print/PDF output')
req('fbbadb70b4d0c480f5d4ae58c4b6285b3164fccc' in generator and 'a8b90ace4cfb8201a8149280bdde75e162359a32' in generator, 'fixture generator is not locked to the corrected API engine and narrative blob')
req('@media (max-width:640px)' in production_styles and '@media print' in production_styles, 'production sample responsive/print protections missing')
req('overflow-wrap:anywhere' in production_styles, 'production sample lacks text-bleed protection')
req('Source-backed remedy paths' in report and 'mr-remedy-card' in report, 'source-backed remedy renderer missing')
req('.mr-card.mr-remedy-card{background:#fff}' in report, 'Synthesis remedy cards do not override the generic cream card surface')
req('border-top:3px solid #C9821F' not in report and '.mr-remedy-card:nth-child(' not in report, 'Synthesis remedy cards still carry option-specific top borders')
req('gap:56px;' in sample and '.synthesis-report-stage .mr-page{box-shadow:0 20px 54px rgba(8,56,62,.07)!important;}' in sample, 'Synthesis sample canvas does not match the Diagnostic viewer grid and frame')
req('.synthesis-report-stage .mr-card.mr-remedy-card{border-top:1px solid #EAE6DD!important;}' in sample, 'sample page does not preserve neutral remedy-card borders')
req('MondermanSampleReportShell.mount' in sample, 'Synthesis samples bypass the shared promotional frame')
req('psr-doc-shell' in production_renderer and 'psr-toc-mobile' in production_renderer and 'psr-toc' in production_renderer, 'all-six responsive contents navigation missing')
req('mr-system-composite-label' in report and '["EQUAL-LENS", "COMPOSITE"]' in report, 'Cross-Lens composite label is not bounded to two lines')
req('MondermanReport.fromSynthesis(fixtures.crossLens)' in sample, 'Cross-Lens sample is not using shared customer renderer')
req('MondermanReport.fromSynthesis(fixtures.depth)' in sample, 'Depth sample is not using shared customer renderer')
req('Sankey' not in sample, 'sample library labels an allocation view as a Sankey')

# Existing Synthesis fidelity requirements remain mandatory.
for token in [
    'cross_diagnostic_score: 55.5', 'evidence_label: "Strong"',
    'aggregate_score: 56', 'evidence_label: "Substantial"',
]:
    req(token in sample, f'missing product-fidelity token: {token}')

if errors:
    print('REPORT_PRESENTATION_STATIC_FAIL')
    for e in errors:
        print('-', e)
    raise SystemExit(1)
print('REPORT_PRESENTATION_STATIC_PASS')
