from pathlib import Path

p = Path('monderman-report.js')
s = p.read_text(encoding='utf-8')
original = s

# Typography: Neue Haas is already licensed/served and declared by this
# renderer. Several components and both synthesis SVGs nevertheless force
# Helvetica Neue, creating the visible mixed-font result. Make the renderer's
# declared family authoritative everywhere.
replacements = [
    ('font-family:\\"Helvetica Neue\\",Arial,sans-serif', 'font-family:\\"Neue Haas Grotesk\\",\\"Helvetica Neue\\",Helvetica,Arial,sans-serif'),
    ('font-family:\"Helvetica Neue\",Arial,sans-serif', 'font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif'),
    ('font-family:Helvetica Neue,Arial,sans-serif', "font-family:'Neue Haas Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif"),
]
for old, new in replacements:
    s = s.replace(old, new)

# The score label is already printed directly beside the score. The old band
# line repeated the label, and the cover pill then repeated the condition again.
old = 'headlineBand: scorePublished ? (firstStr(r.score_label, conditionBand) + " · " + conditionBand) : "Composite withheld",'
new = 'headlineBand: scorePublished ? conditionBand : "Composite withheld",'
if old not in s:
    raise SystemExit('headlineBand contract not found')
s = s.replace(old, new, 1)

old = '''    const statusPills = [
      m.headlineBand ? '<span class="mr-cover-pill mr-cover-pill-accent">' + esc(m.headlineBand) + '</span>' : '',
      evidenceLabel ? '<span class="mr-cover-pill">' + esc(evidenceLabel) + ' evidence</span>' : ''
    ].filter(Boolean).join("");'''
new = '''    const statusPills = [
      evidenceLabel ? '<span class="mr-cover-pill mr-cover-pill-accent">' + esc(evidenceLabel) + ' evidence</span>' : ''
    ].filter(Boolean).join("");'''
if old not in s:
    raise SystemExit('cover status pills contract not found')
s = s.replace(old, new, 1)

# Put the interpretation boundary where the executive encounters the score,
# while retaining the full final boundary. This changes presentation, not the
# claim or evidence contract.
old = '''      (m.coverBody ? '<p class="mr-cover-body">' + esc(m.coverBody) + '</p>' : '') +
      '</div></section>';'''
new = '''      (m.coverBody ? '<p class="mr-cover-body">' + esc(m.coverBody) + '</p>' : '') +
      (m.kind === "meta-synthesis" && m.footnote ? '<div class="mr-cover-boundary"><div class="mr-cover-boundary-label">Interpretation boundary</div><p>' + esc(m.footnote) + '</p></div>' : '') +
      '</div></section>';'''
if old not in s:
    raise SystemExit('cover body tail not found')
s = s.replace(old, new, 1)

# Cross-Lens evidence map. Every element here is already present in the
# certified API payload: source groups, their observed means/drivers, recurring
# convergence signals, and the primary observed pattern. The caption explicitly
# prevents the visual from being read as a causal pathway.
marker = '\n  function renderMetaSignals(m, n) {'
if marker not in s:
    raise SystemExit('renderMetaSignals marker not found')
evidence_map = r'''
  function renderCrossLensEvidenceMap(m) {
    if (m.product !== "cross_lens" || !arr(m.sourceGroups).length) return "";
    const groups = arr(m.sourceGroups).filter((lens) => strictFinite(lens.mean));
    const signals = arr(m.signals).slice(0, 4);
    const pattern = firstStr(m.primaryPattern, obj(m.diagnosis).body);
    const lenses = groups.map((lens) =>
      '<div class="mr-map-lens"><div class="mr-map-lens-name">' + esc(lens.toolLabel) + '</div>' +
      '<div class="mr-map-lens-score">' + esc(fmt1(lens.mean)) + '</div>' +
      (lens.driver ? '<div class="mr-map-lens-driver">' + esc(humanize(lens.driver)) + '</div>' : '') + '</div>'
    ).join("");
    const signalRows = signals.map((signal) =>
      '<div class="mr-map-signal"><div><div class="mr-map-signal-label">' + esc(signal.label) + '</div>' +
      '<p>' + esc(signal.text) + '</p></div>' +
      (signal.tools.length ? '<div class="mr-map-tools">' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') + '</div>'
    ).join("");
    return '<div class="mr-viz-panel mr-cross-lens-map"><div class="mr-viz-title">Cross-lens evidence map</div>' +
      '<p class="mr-copy">This map shows which submitted Diagnostic evidence participates in recurring signals. It organizes the evidence; it does not assert a causal pathway.</p>' +
      '<div class="mr-map-lenses">' + lenses + '</div>' +
      (pattern ? '<div class="mr-map-pattern"><div class="mr-lens-label">Observed cross-lens pattern</div><p>' + esc(pattern) + '</p></div>' : '') +
      (signalRows ? '<div class="mr-map-signals">' + signalRows + '</div>' : '') + '</div>';
  }
'''
s = s.replace(marker, evidence_map + marker, 1)

old = '''    let html = '<section class="mr-section"><h2>' + n + '. Agreements and differences</h2>';
    if (signals.length) {'''
new = '''    let html = '<section class="mr-section"><h2>' + n + '. Agreements and differences</h2>';
    html += renderCrossLensEvidenceMap(m);
    if (signals.length) {'''
if old not in s:
    raise SystemExit('renderMetaSignals opening not found')
s = s.replace(old, new, 1)

# Source-backed exposure ranges. These are the existing low/median/high values
# from the certified synthesis payload; nothing is inferred or stacked. Hours
# and cost use separate local scales and the caption says not to compare lengths.
marker = '\n  function renderMetaExposure(m, n) {'
if marker not in s:
    raise SystemExit('renderMetaExposure marker not found')
helper = r'''
  function renderExposureRangeGraphic(exp) {
    const rows = [];
    function row(label, low, mid, high, formatter) {
      if (!strictFinite(low) || !strictFinite(mid) || !strictFinite(high) || Number(high) <= 0) return;
      const hi = Number(high), lo = Math.max(0, Number(low)), md = Math.max(0, Number(mid));
      const left = Math.max(0, Math.min(100, (lo / hi) * 100));
      const width = Math.max(1.5, Math.min(100 - left, ((hi - lo) / hi) * 100));
      const median = Math.max(0, Math.min(100, (md / hi) * 100));
      rows.push('<div class="mr-range-row"><div class="mr-range-head"><strong>' + esc(label) + '</strong><span>' + esc(formatter(lo)) + ' – ' + esc(formatter(hi)) + '</span></div>' +
        '<div class="mr-range-track"><span class="mr-range-iqr" style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%"></span><span class="mr-range-median" style="left:' + median.toFixed(2) + '%"></span></div>' +
        '<div class="mr-range-foot">Median ' + esc(formatter(md)) + '</div></div>');
    }
    row('Annual burden hours', exp.annual_hours_low, exp.annual_hours, exp.annual_hours_high, fmtWhole);
    row('Annual labor cost', exp.annual_cost_low, exp.annual_cost, exp.annual_cost_high, fmtMoney);
    if (!rows.length) return "";
    return '<div class="mr-viz-panel mr-exposure-range"><div class="mr-viz-title">Observed exposure ranges</div>' + rows.join("") + '<p class="mr-copy">Range bars summarize the submitted priceable runs. Hours and cost use separate local scales; bar lengths should not be compared across the two metrics.</p></div>';
  }
'''
s = s.replace(marker, helper + marker, 1)

old = '''    return '<section class="mr-section"><h2>' + n + '. Source-backed pathway exposure</h2><div class="kvs">' + kvs + '</div>' +'''
new = '''    return '<section class="mr-section"><h2>' + n + '. Source-backed pathway exposure</h2>' + renderExposureRangeGraphic(exp) + '<div class="kvs">' + kvs + '</div>' +'''
if old not in s:
    raise SystemExit('exposure return not found')
s = s.replace(old, new, 1)

# Visual support for the opening boundary, evidence map, and exposure ranges.
anchor = '    .mr-synth-chart{min-height:180px}\n'
if anchor not in s:
    raise SystemExit('synthesis chart CSS anchor not found')
css = r'''    .mr-synth-chart{min-height:180px;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}
    .mr-cover-boundary{margin:20px 0 0;padding:14px 16px;border-left:3px solid #0C6E78;background:#FAFAF8;border-radius:0 8px 8px 0}
    .mr-cover-boundary-label{font-size:.66rem;letter-spacing:.15em;text-transform:uppercase;color:#0C6E78;font-weight:700;margin:0 0 6px}
    .mr-cover-boundary p{font-size:.84rem!important;line-height:1.5!important;color:#6E6F73!important;margin:0!important}
    .mr-cross-lens-map{padding:24px!important}
    .mr-map-lenses{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:18px 0}
    .mr-map-lens{border:1px solid #EAE6DD;border-top:3px solid #0C6E78;border-radius:9px;padding:12px;background:#FAFAF8;min-width:0}
    .mr-map-lens-name{font-size:.66rem;line-height:1.25;letter-spacing:.09em;text-transform:uppercase;color:#6E6F73;font-weight:700}
    .mr-map-lens-score{font-size:1.65rem;line-height:1;font-weight:700;color:#18191C;margin:9px 0 5px;font-variant-numeric:tabular-nums}
    .mr-map-lens-driver{font-size:.76rem;line-height:1.35;color:#6E6F73}
    .mr-map-pattern{margin:16px 0;padding:16px 18px;border-left:4px solid #08383E;background:#F6F3EC;border-radius:0 10px 10px 0}
    .mr-map-pattern p{margin:0!important;font-size:.96rem!important;line-height:1.55!important}
    .mr-map-signals{display:grid;gap:10px;margin-top:12px}
    .mr-map-signal{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;border:1px solid #EAE6DD;border-radius:9px;padding:14px 16px;background:#FFF}
    .mr-map-signal-label{font-size:.82rem;font-weight:700;color:#18191C;margin-bottom:5px}
    .mr-map-signal p{font-size:.86rem!important;line-height:1.5!important;color:#6E6F73!important;margin:0!important}
    .mr-map-tools{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:230px}
    .mr-exposure-range{padding:22px 24px!important}
    .mr-range-row{margin:16px 0 20px}
    .mr-range-head{display:flex;justify-content:space-between;gap:14px;align-items:baseline;font-size:.88rem;color:#18191C}
    .mr-range-head span{color:#6E6F73;font-variant-numeric:tabular-nums}
    .mr-range-track{position:relative;height:12px;border-radius:999px;background:#EAE6DD;margin-top:9px;overflow:visible}
    .mr-range-iqr{position:absolute;top:0;height:12px;border-radius:999px;background:rgba(12,110,120,.30)}
    .mr-range-median{position:absolute;top:-4px;width:3px;height:20px;border-radius:2px;background:#08383E;transform:translateX(-1.5px)}
    .mr-range-foot{margin-top:7px;font-size:.76rem;color:#6E6F73}
    @media(max-width:760px){.mr-map-lenses{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-map-signal{grid-template-columns:1fr}.mr-map-tools{justify-content:flex-start;max-width:none}}
'''
s = s.replace(anchor, css, 1)

if s == original:
    raise SystemExit('repair made no changes')

for required in [
    'mr-cover-boundary',
    'renderCrossLensEvidenceMap',
    'Cross-lens evidence map',
    'renderExposureRangeGraphic',
    'Observed exposure ranges',
]:
    if required not in s:
        raise SystemExit('missing repaired surface: ' + required)

p.write_text(s, encoding='utf-8')
print('byte-level Synthesis report repair applied')
