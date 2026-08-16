from pathlib import Path

report_path = Path("monderman-report.js")
s = report_path.read_text(encoding="utf-8")


def rep(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f"missing expected renderer pattern: {label}")
    s = s.replace(old, new, 1)


if "mr-editorial-row" not in s:
    rep(
        "return '<section class=\"mr-section\"><h2>' + n + '. Evidence status</h2>' +",
        "return '<section class=\"mr-section mr-evidence-status\"><h2>' + n + '. Evidence status</h2>' +",
        "evidence section class",
    )
    rep(
        "'<div class=\"mr-lens-grid\">' + cards + '</div></section>';",
        "'<div class=\"mr-lens-grid mr-evidence-grid\">' + cards + '</div></section>';",
        "evidence grid class",
    )
    rep(
        "return '<section class=\"mr-section\"><h2>' + n + '. Executive synthesis</h2>' +",
        "return '<section class=\"mr-section mr-executive-synthesis\"><h2>' + n + '. Executive synthesis</h2>' +",
        "executive synthesis class",
    )
    rep(
        "'<div class=\"mr-card\"><h3>' + esc(firstStr(diagnosis.name, m.product === \"depth\" ? \"Observed same-Diagnostic pattern\" : \"Cross-Lens finding\")) + '</h3>' +",
        "'<div class=\"mr-card mr-diagnosis-block\"><h3>' + esc(firstStr(diagnosis.name, m.product === \"depth\" ? \"Observed same-Diagnostic pattern\" : \"Cross-Lens finding\")) + '</h3>' +",
        "diagnosis block class",
    )
    rep(
        "return renderDepthDistributionGraphic(read) + '<div class=\"mr-card\"><h3>' + esc(read.toolLabel) + '</h3>' +",
        "return renderDepthDistributionGraphic(read) + '<div class=\"mr-card mr-depth-stats\"><h3>' + esc(read.toolLabel) + '</h3>' +",
        "depth stats class",
    )
    rep(
        "'<div class=\"mr-card\"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +",
        "'<div class=\"mr-card mr-editorial-row mr-signal-row\"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +",
        "depth signal row class",
    )
    rep(
        "requirements.map((item) => '<div class=\"mr-card\"><span class=\"mr-pill\">' + esc(humanize(item.type)) + '</span><p style=\"margin-top:10px\">' + esc(item.text) + '</p></div>').join(\"\") + '</section>';",
        "requirements.map((item) => '<div class=\"mr-card mr-editorial-row mr-requirement-row\"><span class=\"mr-pill\">' + esc(humanize(item.type)) + '</span><p style=\"margin-top:10px\">' + esc(item.text) + '</p></div>').join(\"\") + '</section>';",
        "requirement row class",
    )
    rep(
        "actions.map((action, index) => '<div class=\"mr-card\"><div class=\"mr-lens-label\">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style=\"margin-top:8px\">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join(\"\") +",
        "actions.map((action, index) => '<div class=\"mr-card mr-editorial-row mr-action-row\"><div class=\"mr-lens-label\">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style=\"margin-top:8px\">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join(\"\") +",
        "action row class",
    )
    rep(
        "entries.map(([label, value]) => '<div class=\"mr-card\"><h3>' + esc(label) + '</h3><p>' + esc(value) + '</p></div>').join(\"\") +",
        "entries.map(([label, value]) => '<div class=\"mr-card mr-editorial-row mr-vantage-row\"><h3>' + esc(label) + '</h3><p>' + esc(value) + '</p></div>').join(\"\") +",
        "vantage row class",
    )
    rep(
        "'<div class=\"mr-card\"><div class=\"mr-lens-label\">' + esc(indicator.lens || \"Measurement\") + '</div><h3 style=\"margin-top:8px\">' + esc(indicator.name) + '</h3>' +",
        "'<div class=\"mr-card mr-editorial-row mr-indicator-row\"><div class=\"mr-lens-label\">' + esc(indicator.lens || \"Measurement\") + '</div><h3 style=\"margin-top:8px\">' + esc(indicator.name) + '</h3>' +",
        "indicator row class",
    )

    css_anchor = "    @media (max-width:640px) {"
    if css_anchor not in s:
        raise SystemExit("missing CSS insertion anchor")
    editorial_css = r'''
    /* Synthesis is an executive report, not a dashboard. Keep discrete cards for
       genuinely discrete evidence (Diagnostic lenses) and visual panels, while
       prose, actions, vantages, and evidence status read as a continuous document. */
    .mr-report .mr-section>h2{font-size:1.65rem;line-height:1.12;letter-spacing:-.035em;margin-bottom:18px;max-width:32ch}
    .mr-report .mr-section+.mr-section{margin-top:48px;padding-top:38px}
    .mr-evidence-grid{grid-template-columns:1fr;gap:0;margin-top:18px;border-top:1px solid #EAE6DD}
    .mr-evidence-grid .mr-lens-card{display:grid;grid-template-columns:180px minmax(0,1fr);column-gap:24px;row-gap:2px;background:transparent;border:0;border-bottom:1px solid #EAE6DD;border-radius:0;padding:15px 0;margin:0}
    .mr-evidence-grid .mr-lens-card>.mr-lens-label{grid-column:1;grid-row:1 / span 2;margin:3px 0 0;color:#6E6F73}
    .mr-evidence-grid .mr-lens-card>div:not(.mr-lens-label){grid-column:2;grid-row:1;margin:0!important;font-size:1rem!important}
    .mr-evidence-grid .mr-lens-card>.mr-copy{grid-column:2;grid-row:2;margin:4px 0 0!important;max-width:64ch}
    .mr-diagnosis-block{background:transparent!important;border:0!important;border-left:3px solid #0C6E78!important;border-radius:0!important;padding:3px 0 3px 22px!important;margin:20px 0 24px!important}
    .mr-diagnosis-block h3{font-size:1.22rem!important;line-height:1.3;margin-bottom:10px!important}
    .mr-diagnosis-block p{font-size:1.04rem!important;line-height:1.65!important;max-width:68ch}
    .mr-depth-stats{background:transparent!important;border:0!important;border-radius:0!important;padding:0 0 6px!important;margin:26px 0 4px!important}
    .mr-depth-stats>h3{font-size:1.1rem!important;margin:0 0 12px!important}
    .mr-depth-stats>.kvs{border-top:1px solid #EAE6DD;border-bottom:1px solid #EAE6DD;padding:14px 0;margin:0 0 18px}
    .mr-editorial-row{background:transparent!important;border:0!important;border-top:1px solid #EAE6DD!important;border-radius:0!important;padding:18px 0!important;margin:0!important}
    .mr-editorial-row:last-of-type{border-bottom:1px solid #EAE6DD!important}
    .mr-editorial-row h3{font-size:1.08rem!important;line-height:1.35;margin-bottom:7px!important}
    .mr-editorial-row p{max-width:68ch}
    .mr-editorial-row .mr-lens-label{color:#6E6F73}
    .mr-requirement-row .mr-pill{margin-bottom:2px}
    @media(max-width:640px){
      .mr-evidence-grid .mr-lens-card{grid-template-columns:1fr;gap:4px;padding:14px 0}
      .mr-evidence-grid .mr-lens-card>.mr-lens-label,.mr-evidence-grid .mr-lens-card>div:not(.mr-lens-label),.mr-evidence-grid .mr-lens-card>.mr-copy{grid-column:1;grid-row:auto}
      .mr-report .mr-section>h2{font-size:1.45rem}
    }
'''
    s = s.replace(css_anchor, editorial_css + css_anchor, 1)
    report_path.write_text(s, encoding="utf-8")

validator_path = Path("scripts/validate_report_presentation.py")
v = validator_path.read_text(encoding="utf-8")
marker = "# Synthesis editorial-family requirements."
if marker not in v:
    anchor = "# Marketing sample disclosure and renderer parity."
    if anchor not in v:
        raise SystemExit("missing validator insertion anchor")
    block = '''# Synthesis editorial-family requirements. The engine supplies structured evidence;
# the renderer must not turn prose/evidence/action sections into a wall of dashboard tiles.
for token, msg in [
    ('mr-evidence-grid', 'Synthesis evidence status is not rendered as a continuous evidence table'),
    ('mr-diagnosis-block', 'Executive synthesis diagnosis is not rendered as an editorial lead block'),
    ('mr-depth-stats', 'Depth statistics are not rendered as a continuous statistics block'),
    ('mr-editorial-row', 'Synthesis prose/action rows are still using undifferentiated card presentation'),
    ('Synthesis is an executive report, not a dashboard', 'editorial-family CSS contract missing'),
]:
    req(token in report, msg)
req('requirements.map((item) => \'<div class="mr-card"><span' not in report, 'evidence-strengthening items regressed to stacked cards')
req('actions.map((action, index) => \'<div class="mr-card"><div class="mr-lens-label">Step ' not in report, 'Synthesis actions regressed to stacked cards')
req('entries.map(([label, value]) => \'<div class="mr-card"><h3>' not in report, 'vantage evidence regressed to stacked cards')

'''
    v = v.replace(anchor, block + anchor, 1)
    validator_path.write_text(v, encoding="utf-8")

print("SYNTHESIS_EDITORIAL_PATCH_APPLIED")
