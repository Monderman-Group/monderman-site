from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
report_path = ROOT / "monderman-report.js"
sample_path = ROOT / "sample-report.html"

src = report_path.read_text(encoding="utf-8")

# 1) Preserve the actual published Synthesis score. Cross-Lens composites can be
# fractional; rounding 55.5 to 56 made the cover contradict the chart and prose.
old = '      headlineScore: scorePublished ? Math.round(score) : "—",'
new = '      headlineScore: scorePublished ? (Number.isInteger(score) ? String(score) : fmt1(score)) : "—",'
if old in src:
    src = src.replace(old, new, 1)
elif new not in src:
    raise SystemExit("could not locate Synthesis headline-score assignment")

# 2) Put the evidence-bearing visual first. The old renderer made buyers read a
# long evidence matrix and narrative before they reached the first chart.
old_order = '''    const renderers = [
      renderMetaEvidence,
      renderMetaFinding,
      renderDepthDistribution,
      renderLensSummary,
      renderMetaSignals,
      renderMetaExposure,
      renderRequirements,
      renderMetaActions,
      renderMetaExperience,
      renderMetaIndicators,
      renderMetaMethod
    ];'''
new_order = '''    const renderers = [
      renderDepthDistribution,
      renderLensSummary,
      renderMetaFinding,
      renderMetaSignals,
      renderMetaExposure,
      renderMetaActions,
      renderMetaExperience,
      renderMetaIndicators,
      renderMetaEvidence,
      renderRequirements,
      renderMetaMethod
    ];'''
if old_order in src:
    src = src.replace(old_order, new_order, 1)
elif new_order not in src:
    raise SystemExit("could not locate Synthesis renderer order")

# 3) Replace the generic text-first cover/body wrapper with the same deliberate
# dark/white report architecture used by the four Diagnostic Executive Reports.
start = src.find('  function buildReportBody(model) {')
end = src.find('\n\n  var REPORT_CSS =', start)
if start < 0 or end < 0:
    raise SystemExit("could not locate report-body block")

new_body = r'''  function buildReportCover(model) {
    const m = obj(model);
    const meta = arr(m.meta);
    const productLabel = m.product === "depth" ? "Depth Synthesis" : m.product === "cross_lens" ? "Cross-Lens Synthesis" : firstStr(m.mastline).replace(/^Monderman\s*[•·]\s*/i, "") || "Diagnostic";
    const scoreLabel = m.product === "depth" ? "Median Diagnostic Score" : m.product === "cross_lens" ? "Cross-Lens Composite Score" : "Diagnostic Score";
    const evidenceLabel = m.kind === "meta-synthesis" ? firstStr(m.evidenceLabel) : "";
    const metaHtml = meta.map((x) => '<span><strong>' + esc(x.label) + '</strong>' + esc(x.value) + '</span>').join("");
    const statusPills = [
      m.headlineBand ? '<span class="mr-cover-pill mr-cover-pill-accent">' + esc(m.headlineBand) + '</span>' : '',
      evidenceLabel ? '<span class="mr-cover-pill">' + esc(evidenceLabel) + ' evidence</span>' : ''
    ].filter(Boolean).join("");
    return '<section class="mr-cover">' +
      '<div class="mr-cover-dark"><p class="mr-cover-mark">MONDERMAN · ' + esc(productLabel) + '</p><div class="mr-cover-rule"></div>' +
      '<h1 class="mr-cover-title">' + esc(m.title) + '</h1><p class="mr-cover-sub">' + esc(m.subtitle) + '</p></div>' +
      '<div class="mr-cover-stripe"></div>' +
      '<div class="mr-cover-white"><p class="mr-cover-kicker">Executive Report</p>' +
      '<div class="mr-cover-score-row"><div class="mr-cover-score">' + esc(m.headlineScore == null ? "—" : m.headlineScore) + '</div>' +
      '<div class="mr-cover-score-copy"><div class="mr-cover-score-label">' + esc(scoreLabel) + '</div><div class="mr-cover-score-band">' + esc(m.headlineBand || "") + '</div></div></div>' +
      (statusPills ? '<div class="mr-cover-pills">' + statusPills + '</div>' : '') +
      (metaHtml ? '<div class="mr-cover-meta">' + metaHtml + '</div>' : '') +
      (m.coverBody ? '<p class="mr-cover-body">' + esc(m.coverBody) + '</p>' : '') +
      '</div></section>';
  }

  function buildReportBoundary(model) {
    const m = obj(model);
    if (!m.footnote) return "";
    return '<aside class="mr-report-boundary"><div class="mr-report-boundary-mark"></div><div><p class="mr-report-boundary-label">Interpretation boundary</p><p>' + esc(m.footnote) + '</p></div></aside>';
  }

  function buildReportBody(model) {
    const m = obj(model);
    const coverBlock = buildReportCover(m);

    if (m.kind === "meta-synthesis") {
      return coverBlock + renderMetaSynthesis(m) + buildReportBoundary(m);
    }

    const kvs = arr(m.kvs).map((x) => '<div class="k">' + esc(x.k) + "</div><div>" + esc(x.v) + "</div>").join("");
    let n = 0;
    const secHtml =
      '<section class="mr-section"><h2>1. Executive summary</h2><p class="mr-exec-lede">' + esc(m.execSummary) + "</p>" +
      '<div class="callout"><p><strong>Bottom line for leadership.</strong> ' + esc(m.bottomLine) + "</p></div>" +
      (kvs ? '<div class="kvs">' + kvs + "</div>" : "") + '</section>' +
      arr(m.sections).map((s) => '<section class="mr-section">' + sectionHtml(s, (n += 1) + 1) + '</section>').join("") +
      '<section class="mr-section"><h2>' + (n + 2) + '. Conclusion and next step</h2><p>This Executive Report is a directional read of the measured condition. Use the reported evidence, limitations, and recommended first moves as the basis for a bounded operating decision and like-for-like remeasurement.</p></section>';

    return coverBlock + secHtml + buildReportBoundary(m);
  }'''
src = src[:start] + new_body + src[end:]

# 4) Scope every generic rule to the report root. The previous REPORT_CSS
# injected body/h1/p/.footer rules into the host page, changing the entire
# Sample Reports site to Georgia and corrupting the site footer/disclaimer.
replacements = {
    "':root{--ink:#18191C;--soft:#6E6F73;--muted:#9A9892;--accent:#0C6E78;--line:#EAE6DD;--paper:#fff;--page:#F6F3EC}'": "'.mr-report{--ink:#18191C;--soft:#6E6F73;--muted:#9A9892;--accent:#0C6E78;--line:#EAE6DD;--paper:#fff;--page:#F6F3EC}'",
    "'*{box-sizing:border-box}'": "'.mr-report,.mr-report *{box-sizing:border-box}'",
    "'body{margin:0;background:var(--page);color:var(--ink);font-family:Georgia,\"Times New Roman\",serif}'": "'.mr-report{margin:0;background:var(--page);color:var(--ink);font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}'",
    "'.page{max-width:920px;margin:0 auto;background:var(--paper);padding:54px 68px 64px;box-shadow:0 18px 48px rgba(15,23,32,.08)}'": "'.mr-report .mr-page{max-width:960px;margin:0 auto;background:var(--paper);padding:48px 54px 64px;box-shadow:0 18px 48px rgba(15,23,32,.08)}'",
    "'h1,h2,h3{font-family:\"Helvetica Neue\",Arial,sans-serif;color:var(--ink);margin:0}'": "'.mr-report h1,.mr-report h2,.mr-report h3{font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;color:var(--ink);margin:0}'",
    "'h1{font-size:2.25rem;line-height:1.02;letter-spacing:-.04em}'": "'.mr-report h1{font-size:2.25rem;line-height:1.02;letter-spacing:-.04em}'",
    "'h2{font-size:1.18rem;line-height:1.18;letter-spacing:-.02em;margin-top:34px}'": "'.mr-report h2{font-size:1.28rem;line-height:1.18;letter-spacing:-.025em;margin-top:34px}'",
    "'p{font-size:1rem;line-height:1.75;margin:0 0 14px}'": "'.mr-report p{font-size:1rem;line-height:1.67;margin:0 0 14px}'",
    "'.sub{color:var(--soft);max-width:42em}'": "'.mr-report .sub{color:var(--soft);max-width:42em}'",
    "'.meta{display:flex;flex-wrap:wrap;gap:10px 14px;margin:18px 0 0;font-family:\"Helvetica Neue\",Arial,sans-serif;font-size:.83rem;color:var(--soft)}'": "'.mr-report .meta{display:flex;flex-wrap:wrap;gap:10px 14px;margin:18px 0 0;font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:.83rem;color:var(--soft)}'",
    "'.callout{margin:18px 0;padding:18px 20px;border-left:4px solid var(--accent);background:#F8FAFD}'": "'.mr-report .callout{margin:18px 0;padding:18px 20px;border-left:4px solid var(--accent);background:#F6F3EC;border-radius:0 10px 10px 0}'",
    "'.kvs{display:grid;grid-template-columns:190px 1fr;gap:8px 20px;margin:16px 0 8px}'": "'.mr-report .kvs{display:grid;grid-template-columns:190px 1fr;gap:8px 20px;margin:16px 0 8px}'",
    "'.kvs div{font-size:.98rem;line-height:1.7}.kvs .k{font-family:\"Helvetica Neue\",Arial,sans-serif;color:var(--muted)}'": "'.mr-report .kvs div{font-size:.98rem;line-height:1.65}.mr-report .kvs .k{font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;color:var(--muted)}'",
    "'ul{margin:8px 0 0 20px;padding:0}li{margin:0 0 8px;line-height:1.7}'": "'.mr-report ul{margin:8px 0 0 20px;padding:0}.mr-report li{margin:0 0 8px;line-height:1.65}'",
    "'.footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:.85rem;color:var(--soft)}'": "'.mr-report .mr-report-boundary{margin-top:42px;padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:#FAFAF8;color:var(--soft)}'",
    "'.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:\"Helvetica Neue\",Arial,sans-serif}'": "'.mr-report .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif}'",
    "'.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:168px;padding:0 24px;border-radius:7px;font-size:15px;font-weight:500;white-space:nowrap;background:#FFF;color:#18191C;border:1px solid rgba(24,25,28,.12);box-shadow:none;cursor:pointer}'": "'.mr-report .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:168px;padding:0 24px;border-radius:7px;font-size:15px;font-weight:500;white-space:nowrap;background:#FFF;color:#18191C;border:1px solid rgba(24,25,28,.12);box-shadow:none;cursor:pointer}'",
    "'.btn-accent{background:#0C6E78;color:#FFF;border-color:rgba(12,110,120,.18)}'": "'.mr-report .btn-accent{background:#0C6E78;color:#FFF;border-color:rgba(12,110,120,.18)}'",
    "'@media print{body{background:#fff}.page{box-shadow:none;max-width:none;padding:34px 42px}.actions{display:none!important}}'": "'@media print{.mr-report{background:#fff}.mr-report .mr-page{box-shadow:none;max-width:none;padding:28px 32px}.mr-report .actions{display:none!important}}'"
}
for a, b in replacements.items():
    if a in src:
        src = src.replace(a, b, 1)
    elif b not in src:
        raise SystemExit(f"missing CSS anchor: {a[:70]}")

# Add the cover/report-boundary visual system to the existing unique mr-* CSS.
marker = '    // ═══ Synthesis crown-jewel section styles ═══\n    `\n'
cover_css = r'''    // ═══ Synthesis crown-jewel section styles ═══
    `
    @font-face{font-family:"Neue Haas Grotesk";src:url("https://www.monderman.com/55font.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap}
    @font-face{font-family:"Neue Haas Grotesk";src:url("https://www.monderman.com/65font.woff2") format("woff2");font-style:normal;font-weight:500;font-display:swap}
    @font-face{font-family:"Neue Haas Grotesk";src:url("https://www.monderman.com/75font.woff2") format("woff2");font-style:normal;font-weight:700;font-display:swap}
    .mr-cover{background:#04181B;color:#FAFAF8;border-radius:18px;overflow:hidden;margin:0 0 42px;border:1px solid rgba(24,25,28,.08)}
    .mr-cover-dark{padding:50px 48px 42px}
    .mr-cover-mark{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif!important;font-size:.67rem!important;line-height:1.2!important;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.48)!important;font-weight:700;margin:0 0 18px!important}
    .mr-cover-rule{height:2px;width:42px;background:#0C6E78;margin:0 0 24px}
    .mr-cover-title{font-size:clamp(2.3rem,5vw,3.65rem)!important;line-height:.98!important;letter-spacing:-.05em!important;color:#FAFAF8!important;max-width:15ch}
    .mr-cover-sub{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif!important;margin:16px 0 0!important;max-width:62ch;color:rgba(255,255,255,.68)!important;font-size:1rem!important;line-height:1.55!important}
    .mr-cover-stripe{height:3px;background:linear-gradient(90deg,#0C6E78 0%,#0C6E78 58%,rgba(12,110,120,.22) 100%)}
    .mr-cover-white{background:#FFF;color:#18191C;padding:32px 48px 38px}
    .mr-cover-kicker{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif!important;margin:0 0 12px!important;font-size:.67rem!important;letter-spacing:.22em;text-transform:uppercase;color:#6E6F73!important;font-weight:700}
    .mr-cover-score-row{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap}
    .mr-cover-score{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:4.6rem;line-height:.82;font-weight:700;letter-spacing:-.07em;color:#18191C;font-variant-numeric:tabular-nums}
    .mr-cover-score-copy{padding-bottom:3px;min-width:220px;max-width:520px}
    .mr-cover-score-label{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:#0C6E78;font-weight:700;margin-bottom:5px}
    .mr-cover-score-band{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.97rem;line-height:1.35;color:#6E6F73}
    .mr-cover-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:20px}
    .mr-cover-pill{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;padding:5px 11px;border-radius:999px;font-size:.74rem;line-height:1.2;border:1px solid rgba(24,25,28,.12);color:#6E6F73;background:#FFF}
    .mr-cover-pill-accent{border-color:rgba(12,110,120,.22);color:#0C6E78;background:rgba(12,110,120,.06)}
    .mr-cover-meta{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 18px;margin-top:24px;padding-top:18px;border-top:1px solid #EAE6DD}
    .mr-cover-meta span{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.79rem;line-height:1.35;color:#6E6F73;min-width:0}
    .mr-cover-meta strong{display:block;font-size:.61rem;letter-spacing:.13em;text-transform:uppercase;color:#9A9892;margin-bottom:4px}
    .mr-cover-body{margin:22px 0 0!important;padding-top:18px;border-top:1px solid #EAE6DD;color:#18191C!important;font-size:1.02rem!important;line-height:1.6!important;max-width:70ch}
    .mr-report-boundary{display:grid!important;grid-template-columns:5px 1fr;gap:14px;align-items:start}
    .mr-report-boundary-mark{width:5px;min-height:100%;border-radius:4px;background:#0C6E78}
    .mr-report-boundary-label{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif!important;font-size:.68rem!important;line-height:1.2!important;letter-spacing:.16em;text-transform:uppercase;color:#0C6E78!important;font-weight:700;margin:1px 0 7px!important}
    .mr-report-boundary p:last-child{margin:0!important;font-size:.88rem!important;line-height:1.55!important;color:#6E6F73!important}
    .mr-exec-lede{font-size:1.08rem!important;line-height:1.65!important;max-width:70ch}
    .mr-section{padding-top:8px}
    .mr-section + .mr-section{border-top:1px solid rgba(234,230,221,.65);padding-top:32px}
    .mr-section h2{font-size:1.32rem!important;margin-bottom:14px!important}
    .mr-viz-panel{box-shadow:0 8px 24px rgba(8,56,62,.04)}
    .mr-synth-chart{min-height:180px}
    @media(max-width:760px){.mr-cover-dark{padding:38px 28px 32px}.mr-cover-white{padding:28px}.mr-cover-title{font-size:2.35rem!important}.mr-cover-score{font-size:3.8rem}.mr-cover-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
if marker in src:
    src = src.replace(marker, cover_css, 1)
elif '.mr-cover-dark{' not in src:
    raise SystemExit("could not locate report CSS template marker")

# 5) Use an isolated root/mr-page in both standalone and embedded report paths.
src = src.replace("'<div class=\"page\">' + buildReportBody(model)", "'<div class=\"mr-report\"><div class=\"mr-page\">' + buildReportBody(model)", 1)
src = src.replace("\"</div></body></html>\";", "\"</div></div></body></html>\";", 1)
src = src.replace("node.innerHTML = '<div class=\"page\" style=\"box-shadow:none;margin:0;max-width:none\">' + buildReportBody(model) + \"</div>\";", "node.innerHTML = '<div class=\"mr-report\"><div class=\"mr-page\" style=\"box-shadow:none;margin:0;max-width:none\">' + buildReportBody(model) + \"</div></div>\";", 1)
if 'class="mr-report"><div class="mr-page"' not in src:
    raise SystemExit("report root isolation not applied")

report_path.write_text(src, encoding="utf-8")

# 6) Strengthen the marketing disclosure as a designed introduction rather than
# a legalistic tail note. Do not change the representative fixtures or invent data.
sample = sample_path.read_text(encoding="utf-8")
old_notice = '<strong>These are representative samples, not customer reports.</strong>'
new_notice = '<strong>Representative product outputs — not customer data.</strong>'
if old_notice in sample:
    sample = sample.replace(old_notice, new_notice, 1)
elif new_notice not in sample:
    raise SystemExit("could not locate sample disclosure")

# The shared renderer is now isolated, so make the mount feel like a report sheet,
# not a blank marketing div floating in the page.
sample = sample.replace('  <div style="max-width:980px;margin:0 auto;padding:46px 28px 90px;">\n    <div id="sampleCrossLensRendered"></div>\n  </div>', '  <div class="synthesis-report-stage">\n    <div id="sampleCrossLensRendered"></div>\n  </div>', 1)
sample = sample.replace('  <div style="max-width:980px;margin:0 auto;padding:46px 28px 90px;">\n    <div id="sampleDepthRendered"></div>\n  </div>', '  <div class="synthesis-report-stage">\n    <div id="sampleDepthRendered"></div>\n  </div>', 1)

stage_css_anchor = '    .report-shell[hidden] { display: none; }'
stage_css = '''    .report-shell[hidden] { display: none; }\n    .synthesis-report-stage { max-width: 1060px; margin: 0 auto; padding: 42px 28px 96px; }\n    .synthesis-report-stage .mr-report { border-radius: 20px; }\n    @media (max-width: 760px) { .synthesis-report-stage { padding: 28px 14px 72px; } }'''
if stage_css_anchor in sample:
    sample = sample.replace(stage_css_anchor, stage_css, 1)
elif '.synthesis-report-stage {' not in sample:
    raise SystemExit("could not locate sample report-shell CSS anchor")

sample_path.write_text(sample, encoding="utf-8")
print("FORENSIC_REPORT_REBUILD_APPLIED")
