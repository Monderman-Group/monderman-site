from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "monderman-report.js"
s = p.read_text(encoding="utf-8")


def replace_func(src, name, new):
    start = src.index(f"  function {name}(")
    nxt = re.search(r"\n  function \w+\(", src[start + 5:])
    if not nxt:
        raise RuntimeError(f"cannot locate end of {name}")
    end = start + 5 + nxt.start()
    return src[:start] + new.rstrip() + "\n\n" + src[end:]

helpers = r'''  function evidenceVisualValue(label, value, detail) {
    return { label: label, value: firstStr(value, "—"), detail: firstStr(detail) };
  }

  function renderEvidenceIntegrityGraphic(m) {
    const scope = obj(m.scope), versions = obj(m.versions), identity = obj(m.sourceIdentity);
    const timeWindow = obj(m.timeWindow), balance = obj(m.lensBalance), representative = obj(m.representativeness);
    const items = [
      evidenceVisualValue("Evidence", m.evidenceLabel, m.evidenceDescription),
      evidenceVisualValue("Scope", firstStr(scope.label, humanize(scope.status)), scope.statement),
      evidenceVisualValue("Versions", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? "Conflicts: " + versions.conflicting_lenses.map(humanize).join(", ") : ""),
      evidenceVisualValue("Source identity", humanize(identity.status), identity.statement),
      evidenceVisualValue("Window", humanize(timeWindow.status), timeWindow.statement),
      evidenceVisualValue(m.product === "depth" ? "Observed set" : "Lens balance", m.product === "depth" ? firstStr(representative.label, humanize(representative.status)) : firstStr(humanize(balance.status), "Not applicable"), m.product === "depth" ? representative.statement : (strictFinite(balance.ratio) ? "Strongest-to-weakest ratio " + fmt1(balance.ratio) + ":1" : ""))
    ];
    const W = 680, cols = 3, gap = 12, cellW = (W - gap * (cols - 1)) / cols, cellH = 86, top = 28;
    const rows = Math.ceil(items.length / cols), H = top + rows * cellH + (rows - 1) * gap + 18;
    let svg = '<svg class="mr-synth-chart mr-evidence-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Synthesis evidence integrity map" style="display:block;width:100%;height:auto;font-family:Neue Haas Grotesk,Helvetica Neue,Arial,sans-serif">';
    svg += '<text x="0" y="13" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#6E6F73">EVIDENCE INTEGRITY</text>';
    items.forEach((item, index) => {
      const col = index % cols, row = Math.floor(index / cols), x = col * (cellW + gap), y = top + row * (cellH + gap);
      svg += '<rect x="' + x + '" y="' + y + '" width="' + cellW + '" height="' + cellH + '" rx="10" fill="#FAFAF8" stroke="#EAE6DD"/>';
      svg += '<rect x="' + x + '" y="' + y + '" width="4" height="' + cellH + '" rx="2" fill="#0C6E78"/>';
      svg += '<text x="' + (x+15) + '" y="' + (y+22) + '" font-size="9.5" font-weight="700" letter-spacing="1.1" fill="#9A9892">' + esc(item.label.toUpperCase()) + '</text>';
      svg += '<text x="' + (x+15) + '" y="' + (y+47) + '" font-size="14" font-weight="700" fill="#18191C">' + esc(item.value.length > 25 ? item.value.slice(0,24) + "…" : item.value) + '</text>';
      if (item.detail) svg += '<text x="' + (x+15) + '" y="' + (y+68) + '" font-size="9.5" fill="#6E6F73">' + esc(item.detail.length > 32 ? item.detail.slice(0,31) + "…" : item.detail) + '</text>';
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel mr-viz-evidence">' + svg + '<p class="mr-copy">These are the evidence conditions carried by the Synthesis result. They govern what the report may claim; they are not combined into a second score.</p></div>';
  }

  function renderSignalLensMatrix(m) {
    if (m.product !== "cross_lens") return "";
    const signals = arr(m.signals).filter((signal) => arr(signal.tools).length);
    const lenses = arr(m.sourceGroups);
    if (!signals.length || !lenses.length) return "";
    const W = 680, labelW = 250, right = 18, colW = (W - labelW - right) / lenses.length;
    const rowH = 58, top = 66, H = top + signals.length * rowH + 30;
    let svg = '<svg class="mr-synth-chart mr-signal-matrix" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cross-Lens recurring signal map" style="display:block;width:100%;height:auto;font-family:Neue Haas Grotesk,Helvetica Neue,Arial,sans-serif">';
    svg += '<text x="0" y="14" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#6E6F73">WHICH DIAGNOSTICS CARRY EACH RECURRING SIGNAL</text>';
    lenses.forEach((lens, i) => {
      const x = labelW + i * colW + colW/2;
      const short = lens.toolLabel.replace("Institutional Performance","Institutional").replace("Operational Systems","Operational").replace("Structural Clarity","Structural").replace("Decision Velocity","Decision");
      svg += '<text x="' + x + '" y="43" text-anchor="middle" font-size="10" font-weight="700" fill="#0C6E78">' + esc(short) + '</text>';
    });
    signals.forEach((signal, r) => {
      const y = top + r * rowH;
      svg += '<line x1="0" y1="' + (y+rowH-8) + '" x2="' + W + '" y2="' + (y+rowH-8) + '" stroke="#EAE6DD"/>';
      const label = firstStr(signal.label,"Shared signal");
      svg += '<text x="0" y="' + (y+12) + '" font-size="11.5" font-weight="700" fill="#18191C">' + esc(label.length > 38 ? label.slice(0,37)+"…" : label) + '</text>';
      svg += '<text x="0" y="' + (y+30) + '" font-size="9.5" fill="#6E6F73">' + esc((signal.text||"").length > 58 ? signal.text.slice(0,57)+"…" : (signal.text||"")) + '</text>';
      const toolSet = new Set(arr(signal.tools).map((x)=>String(x)));
      lenses.forEach((lens, i) => {
        const x = labelW + i * colW + colW/2;
        const on = toolSet.has(lens.toolType);
        svg += '<circle cx="' + x + '" cy="' + (y+18) + '" r="' + (on ? 7 : 3.5) + '" fill="' + (on ? '#0C6E78' : '#EAE6DD') + '"/>';
      });
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel"><div class="mr-viz-title">Recurring-signal map</div>' + svg + '<p class="mr-copy">Filled markers show which contributing Diagnostics carry each API-returned recurring signal. The matrix does not assert causation; it makes the cross-lens evidence structure visible.</p></div>';
  }

  function renderExposureGraphic(m) {
    const exp = obj(m.exposure);
    if (exp.status !== "available") return "";
    const tracks = [
      { label:"Annual burden hours", low:exp.annual_hours_low, mid:exp.annual_hours, high:exp.annual_hours_high, fmt:fmtWhole },
      { label:"Annual labor cost", low:exp.annual_cost_low, mid:exp.annual_cost, high:exp.annual_cost_high, fmt:fmtMoney }
    ].filter((t)=>strictFinite(t.low)&&strictFinite(t.mid)&&strictFinite(t.high));
    if (!tracks.length) return "";
    const W=680,L=188,R=40,plotW=W-L-R,rowH=62,H=46+tracks.length*rowH+(strictFinite(exp.capacity_drag_percent)?54:16);
    let svg='<svg class="mr-synth-chart mr-exposure-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Source-backed pathway exposure ranges" style="display:block;width:100%;height:auto;font-family:Neue Haas Grotesk,Helvetica Neue,Arial,sans-serif">';
    svg += '<text x="0" y="14" font-size="10.5" font-weight="700" letter-spacing="1.4" fill="#6E6F73">SOURCE-BACKED EXPOSURE</text>';
    tracks.forEach((t,i)=>{
      const y=46+i*rowH, span=Math.max(1,Number(t.high)-Number(t.low));
      const x=(v)=>L+((Number(v)-Number(t.low))/span)*plotW;
      svg += '<text x="0" y="'+(y+5)+'" font-size="12" font-weight="700" fill="#18191C">'+esc(t.label)+'</text>';
      svg += '<line x1="'+L+'" y1="'+y+'" x2="'+(L+plotW)+'" y2="'+y+'" stroke="#EAE6DD" stroke-width="8" stroke-linecap="round"/>';
      svg += '<line x1="'+x(t.low)+'" y1="'+y+'" x2="'+x(t.high)+'" y2="'+y+'" stroke="rgba(12,110,120,.28)" stroke-width="8" stroke-linecap="round"/>';
      svg += '<circle cx="'+x(t.mid)+'" cy="'+y+'" r="7" fill="#0C6E78" stroke="#fff" stroke-width="2"/>';
      svg += '<text x="'+L+'" y="'+(y+25)+'" font-size="10" fill="#9A9892">'+esc(t.fmt(t.low))+'</text>';
      svg += '<text x="'+(L+plotW)+'" y="'+(y+25)+'" text-anchor="end" font-size="10" fill="#9A9892">'+esc(t.fmt(t.high))+'</text>';
      svg += '<text x="'+x(t.mid)+'" y="'+(y-13)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#0C6E78">median '+esc(t.fmt(t.mid))+'</text>';
    });
    if (strictFinite(exp.capacity_drag_percent)) {
      const y=46+tracks.length*rowH;
      svg += '<text x="0" y="'+(y+5)+'" font-size="12" font-weight="700" fill="#18191C">Median capacity drag</text>';
      svg += '<rect x="'+L+'" y="'+(y-7)+'" width="'+plotW+'" height="14" rx="7" fill="#EAE6DD"/>';
      svg += '<rect x="'+L+'" y="'+(y-7)+'" width="'+Math.max(2,plotW*Math.max(0,Math.min(100,Number(exp.capacity_drag_percent)))/100)+'" height="14" rx="7" fill="rgba(12,110,120,.58)"/>';
      svg += '<text x="'+(L+plotW)+'" y="'+(y+5)+'" text-anchor="end" font-size="11" font-weight="700" fill="#18191C">'+esc(fmtPercent(exp.capacity_drag_percent))+'</text>';
    }
    svg += '</svg>';
    return '<div class="mr-viz-panel">'+svg+'<p class="mr-copy">Each track uses its own unit and observed range. Repeated estimates are summarized rather than added across runs or Diagnostics.</p></div>';
  }
'''

insert_at = s.index("  function renderMetaEvidence(")
if "function renderEvidenceIntegrityGraphic" not in s:
    s = s[:insert_at] + helpers + "\n" + s[insert_at:]

s = replace_func(s, "renderMetaEvidence", r'''  function renderMetaEvidence(m, n) {
    const scope = obj(m.scope), versions = obj(m.versions), identity = obj(m.sourceIdentity);
    const timeWindow = obj(m.timeWindow), balance = obj(m.lensBalance), representative = obj(m.representativeness);
    const cards = [
      evidenceCard("Evidence strength", m.evidenceLabel, m.evidenceDescription),
      evidenceCard(m.product === "depth" ? "Median Diagnostic Score" : "Cross-Lens Composite Score", m.scorePublished ? "Published" : "Withheld", m.scoreBasis),
      evidenceCard("Scope", firstStr(scope.label, humanize(scope.status)), firstStr(scope.statement)),
      evidenceCard("Lens balance", firstStr(humanize(balance.status), "Not applicable"), strictFinite(balance.ratio) ? "Strongest-to-weakest lens ratio: " + fmt1(balance.ratio) + ":1" : "Not applicable to one-Diagnostic Depth Synthesis."),
      evidenceCard("Diagnostic/scorer versions", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? "Conflicting Diagnostics: " + versions.conflicting_lenses.map(humanize).join(", ") : ""),
      evidenceCard("Source identity", humanize(identity.status), firstStr(identity.statement)),
      evidenceCard("Measurement window", humanize(timeWindow.status), firstStr(timeWindow.statement)),
      evidenceCard("Representativeness", firstStr(representative.label, humanize(representative.status)), firstStr(representative.statement))
    ].filter(Boolean).join("");
    return '<section class="mr-section"><h2>' + n + '. Evidence status</h2>' + renderEvidenceIntegrityGraphic(m) +
      '<div class="mr-evidence-callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this Synthesis is allowed to claim.") + '</p></div>' +
      '<div class="mr-evidence-detail-grid">' + cards + '</div></section>';
  }''')

s = replace_func(s, "renderMetaSignals", r'''  function renderMetaSignals(m, n) {
    const signals = arr(m.signals);
    const differences = arr(m.differences);
    if (!signals.length && !differences.length) return "";
    let html = '<section class="mr-section"><h2>' + n + '. Agreements and differences</h2>' + renderSignalLensMatrix(m);
    if (signals.length) html += '<div class="mr-signal-copy-grid">' + signals.map((signal) => '<div class="mr-card"><div class="mr-lens-label">Recurring signal</div><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' + (signal.tools.length ? '<div>' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') + (signal.limit ? '<p class="mr-copy">' + esc(signal.limit) + '</p>' : '') + '</div>').join("") + '</div>';
    if (differences.length) html += '<div class="mr-difference-panel"><div class="mr-lens-label">Differences to keep visible</div><ul>' + differences.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>';
    return html + '</section>';
  }''')

s = replace_func(s, "renderMetaExposure", r'''  function renderMetaExposure(m, n) {
    const exp = obj(m.exposure);
    if (!exp.status) return "";
    if (exp.status === "withheld" || exp.status === "unavailable") return '<section class="mr-section"><h2>' + n + '. Pathway exposure</h2><div class="mr-evidence-callout"><p><strong>' + esc(firstStr(exp.label, "Exposure withheld")) + '.</strong> ' + esc(firstStr(exp.withheld_reason, "The submitted runs do not contain enough source-backed economic data.")) + '</p></div></section>';
    const metrics = [["Priceable runs", fmtWhole(exp.priceable_runs) + " of " + fmtWhole(exp.total_runs)],["Median annual hours", fmtWhole(exp.annual_hours)],["Median annual labor cost", fmtMoney(exp.annual_cost)],["Median capacity drag", fmtPercent(exp.capacity_drag_percent)],["Observed hours IQR", strictFinite(exp.annual_hours_low) && strictFinite(exp.annual_hours_high) ? fmtWhole(exp.annual_hours_low) + " – " + fmtWhole(exp.annual_hours_high) : "—"],["Observed cost IQR", strictFinite(exp.annual_cost_low) && strictFinite(exp.annual_cost_high) ? fmtMoney(exp.annual_cost_low) + " – " + fmtMoney(exp.annual_cost_high) : "—"],["Recoverable range", strictFinite(exp.recoverable_cost_low) && strictFinite(exp.recoverable_cost_high) ? fmtMoney(exp.recoverable_cost_low) + " – " + fmtMoney(exp.recoverable_cost_high) : "—"]];
    return '<section class="mr-section"><h2>' + n + '. Source-backed pathway exposure</h2>' + renderExposureGraphic(m) + '<div class="mr-metric-grid">' + metrics.map(([k,v]) => '<div class="mr-metric"><div class="mr-lens-label">' + esc(k) + '</div><div class="mr-metric-value">' + esc(v) + '</div></div>').join("") + '</div><div class="mr-evidence-callout"><p><strong>Aggregation rule.</strong> ' + esc(firstStr(exp.basis, "Repeated estimates are summarized, not added together.")) + '</p></div></section>';
  }''')

s = replace_func(s, "renderMetaActions", r'''  function renderMetaActions(m, n) {
    const actions = arr(m.actions);
    if (!actions.length) return "";
    return '<section class="mr-section"><h2>' + n + '. Evidence-proportionate actions</h2><div class="mr-action-grid">' + actions.map((action, index) => '<div class="mr-action-card"><div class="mr-action-step">' + (index + 1) + '</div><div class="mr-action-content"><div class="mr-lens-label">' + (action.tier ? esc(humanize(action.tier)) : 'Action') + '</div><h3>' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p>' + (action.source ? '<p class="mr-copy"><strong>Evidence source:</strong> ' + esc(action.source) + '</p>' : '') + '</div></div>').join("") + '</div>' + (m.sequencingLogic ? '<div class="mr-evidence-callout"><p><strong>Sequencing logic.</strong> ' + esc(m.sequencingLogic) + '</p></div>' : '') + '</section>';
  }''')

s = replace_func(s, "renderMetaExperience", r'''  function renderMetaExperience(m, n) {
    const experience = obj(m.experiential);
    const entries = [["Operational", firstStr(experience.operational_staff)],["Managerial", firstStr(experience.managers)],["Senior Leader", firstStr(experience.senior_leaders)]].filter(([, value]) => value);
    if (!entries.length && !experience.interpretation_limit) return "";
    return '<section class="mr-section"><h2>' + n + '. Vantage evidence</h2><div class="mr-vantage-grid">' + entries.map(([label, value]) => '<div class="mr-vantage-card"><div class="mr-lens-label">' + esc(label) + '</div><p>' + esc(value) + '</p></div>').join("") + '</div>' + (experience.interpretation_limit ? '<p class="mr-copy mr-limit-copy">' + esc(experience.interpretation_limit) + '</p>' : '') + '</section>';
  }''')

s = replace_func(s, "renderMetaIndicators", r'''  function renderMetaIndicators(m, n) {
    const indicators = arr(m.indicators);
    if (!indicators.length) return "";
    return '<section class="mr-section"><h2>' + n + '. What to watch next</h2><div class="mr-indicator-grid">' + indicators.map((indicator) => '<div class="mr-indicator-card"><div class="mr-lens-label">' + esc(indicator.lens || "Measurement") + '</div><h3>' + esc(indicator.name) + '</h3>' + (indicator.watchFor ? '<p><strong>Watch for:</strong> ' + esc(indicator.watchFor) + '</p>' : '') + (indicator.description ? '<p class="mr-copy">' + esc(indicator.description) + '</p>' : '') + '</div>').join("") + '</div></section>';
  }''')

old_order = '''    const renderers = [\n      renderDepthDistribution,\n      renderLensSummary,\n      renderMetaFinding,\n      renderMetaSignals,\n      renderMetaExposure,\n      renderMetaActions,\n      renderMetaExperience,\n      renderMetaIndicators,\n      renderMetaEvidence,\n      renderRequirements,\n      renderMetaMethod\n    ];'''
new_order = '''    const renderers = [\n      renderDepthDistribution,\n      renderLensSummary,\n      renderMetaFinding,\n      renderMetaEvidence,\n      renderMetaSignals,\n      renderMetaExposure,\n      renderMetaActions,\n      renderMetaExperience,\n      renderMetaIndicators,\n      renderRequirements,\n      renderMetaMethod\n    ];'''
if old_order in s:
    s = s.replace(old_order, new_order)

s = s.replace('return coverBlock + renderMetaSynthesis(m) + buildReportBoundary(m);', 'return coverBlock + buildReportBoundary(m) + renderMetaSynthesis(m);')

css = r'''
    /* Synthesis executive-report presentation: source-aligned hierarchy and denser visual encoding. */
    .mr-report .mr-page{max-width:980px;padding:50px 62px 68px}
    .mr-cover-dark{padding:46px 48px 38px}.mr-cover-title{font-size:clamp(2.15rem,4.2vw,3rem)!important;line-height:1!important;max-width:17ch}.mr-cover-sub{font-size:.98rem!important;max-width:66ch}.mr-cover-white{padding:30px 48px 34px}
    .mr-report .mr-report-boundary{margin:-18px 0 46px;padding:20px 22px;background:#F6F3EC;border:1px solid rgba(12,110,120,.18);border-left:4px solid #0C6E78;border-radius:0 12px 12px 0}.mr-report .mr-report-boundary-mark{display:none}.mr-report .mr-report-boundary-label{font-size:.7rem!important;letter-spacing:.17em}
    .mr-section{margin-top:54px;padding-top:0}.mr-section + .mr-section{border-top:0;padding-top:0}.mr-section h2{font-size:clamp(1.55rem,2.5vw,1.9rem)!important;line-height:1.08!important;letter-spacing:-.035em!important;margin-bottom:20px!important}.mr-section h3{font-size:1.02rem;line-height:1.25}
    .mr-card{border-radius:14px;padding:21px 23px;margin:14px 0;background:#FFF}.mr-viz-panel{padding:26px 26px 22px;border-radius:16px;margin:18px 0 24px;background:#FCFBF8;box-shadow:none}.mr-lens-grid{gap:14px}.mr-lens-card{padding:19px 20px;border-radius:12px;background:#FFF}
    .mr-evidence-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.mr-evidence-detail-grid .mr-lens-card{margin:0}.mr-evidence-callout{margin:18px 0;padding:18px 20px;border-left:3px solid #0C6E78;background:#F6F3EC;border-radius:0 10px 10px 0}.mr-evidence-callout p{margin:0!important}
    .mr-signal-copy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mr-signal-copy-grid .mr-card{margin:0}.mr-difference-panel{margin-top:18px;padding:21px 23px;border:1px solid #EAE6DD;border-radius:14px;background:#FAFAF8}.mr-difference-panel ul{margin-top:12px}
    .mr-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}.mr-metric{padding:15px 16px;border:1px solid #EAE6DD;border-radius:12px;background:#FFF;min-width:0}.mr-metric-value{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:1.12rem;font-weight:700;letter-spacing:-.02em;margin-top:6px;overflow-wrap:anywhere}
    .mr-action-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.mr-action-card{position:relative;padding:22px 20px 20px;border:1px solid #EAE6DD;border-radius:14px;background:#FFF;min-width:0}.mr-action-step{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#0C6E78;color:#FFF;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:700;margin-bottom:16px}.mr-action-content h3{margin:6px 0 10px!important}.mr-action-content p:last-child{margin-bottom:0!important}
    .mr-vantage-grid,.mr-indicator-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.mr-vantage-card,.mr-indicator-card{padding:20px 21px;border:1px solid #EAE6DD;border-radius:14px;background:#FFF}.mr-vantage-card p,.mr-indicator-card p{font-size:.94rem!important;line-height:1.6!important}.mr-indicator-card h3{margin:7px 0 10px!important}.mr-limit-copy{margin-top:14px!important;padding-left:14px;border-left:2px solid rgba(12,110,120,.25)}
    @media(max-width:760px){.mr-report .mr-page{padding:28px 24px 44px}.mr-evidence-detail-grid,.mr-signal-copy-grid,.mr-action-grid,.mr-vantage-grid,.mr-indicator-grid,.mr-metric-grid{grid-template-columns:1fr}.mr-cover-dark{padding:34px 28px 30px}.mr-cover-white{padding:26px 28px}.mr-cover-title{font-size:2.25rem!important}.mr-report .mr-report-boundary{margin:-14px 0 34px}}
'''
if "Synthesis executive-report presentation: source-aligned hierarchy" not in s:
    needle = '    @media(max-width:760px){.mr-cover-dark{padding:38px 28px 32px}'
    pos = s.find(needle)
    if pos < 0:
        raise RuntimeError("cannot locate Synthesis CSS insertion point")
    s = s[:pos] + css + s[pos:]

p.write_text(s, encoding="utf-8")
print("SYNTHESIS_REPORT_VISUAL_DENSITY_REPAIR_APPLIED")
