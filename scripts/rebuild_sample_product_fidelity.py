from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing replacement anchor: {label}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# 1. Upgrade the actual shared Synthesis Executive Report renderer.
# -----------------------------------------------------------------------------
report_path = ROOT / "monderman-report.js"
report = report_path.read_text(encoding="utf-8")
report = report.replace(
    "A same-instrument read across multiple respondents — reporting the observed median, distribution, segment differences, and evidence limits.",
    "A same-Diagnostic read across multiple eligible runs — reporting the observed median, distribution, vantage differences, and evidence limits.",
)
report = report.replace(
    "This report describes the submitted same-instrument runs. Population generalization requires a documented sampling frame and response coverage.",
    "This report describes the submitted same-Diagnostic runs. Population generalization requires a documented sampling frame and response coverage.",
)

start = report.find("  function renderMetaEvidence(m) {")
end = report.find("  function sectionHtml(s, n) {", start)
if start < 0 or end < 0:
    raise SystemExit("could not locate Synthesis renderer block")

new_renderer = r'''  function renderMetaEvidence(m, n) {
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
    return '<section class="mr-section"><h2>' + n + '. Evidence status</h2>' +
      '<div class="callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this Synthesis is allowed to claim.") + '</p></div>' +
      '<div class="mr-lens-grid">' + cards + '</div></section>';
  }

  function renderMetaFinding(m, n) {
    const diagnosis = obj(m.diagnosis);
    const paragraphs = arr(m.briefing?.paragraphs).map(textItem).filter(Boolean);
    return '<section class="mr-section"><h2>' + n + '. Executive synthesis</h2>' +
      '<div class="mr-card"><h3>' + esc(firstStr(diagnosis.name, m.product === "depth" ? "Observed same-Diagnostic pattern" : "Cross-Lens finding")) + '</h3>' +
      (diagnosis.type ? '<span class="mr-pill">' + esc(humanize(diagnosis.type)) + '</span>' : '') +
      '<p>' + esc(firstStr(diagnosis.body, m.primaryPattern, m.briefing?.lede)) + '</p></div>' +
      (m.briefing?.lede ? '<p class="mr-lede">' + esc(m.briefing.lede) + '</p>' : '') +
      paragraphs.map((p) => '<p>' + esc(p) + '</p>').join("") +
      (m.scoreBasis ? '<div class="callout"><p><strong>Score basis.</strong> ' + esc(m.scoreBasis) + '</p></div>' : '') +
      '</section>';
  }

  function synthAxisX(v, left, width) {
    const x = Number(v);
    const bounded = Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 0;
    return left + (bounded / 100) * width;
  }

  function renderDepthDistributionGraphic(read) {
    const iqr = arr(read.iqr);
    if (!strictFinite(read.min) || !strictFinite(read.max) || !strictFinite(read.median) || iqr.length < 2 || !strictFinite(iqr[0]) || !strictFinite(iqr[1])) return "";
    const W = 680, L = 52, R = 28, plotW = W - L - R;
    const segments = arr(read.segments).filter((s) => strictFinite(obj(s).mean_score) || strictFinite(obj(s).median_score));
    const H = 148 + segments.length * 36;
    const axisY = 72;
    const X = (v) => synthAxisX(v, L, plotW);
    let svg = '<svg class="mr-synth-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Depth Synthesis score distribution" style="display:block;width:100%;height:auto;font-family:Helvetica Neue,Arial,sans-serif">';
    [0,25,50,75,100].forEach((tick) => {
      svg += '<line x1="' + X(tick) + '" y1="46" x2="' + X(tick) + '" y2="' + (H - 18) + '" stroke="rgba(24,25,28,.07)"/>';
      svg += '<text x="' + X(tick) + '" y="36" text-anchor="middle" font-size="11" fill="#9A9892">' + tick + '</text>';
    });
    svg += '<text x="' + L + '" y="17" font-size="11" font-weight="700" letter-spacing="1.2" fill="#6E6F73">OBSERVED DISTRIBUTION</text>';
    svg += '<line x1="' + X(read.min) + '" y1="' + axisY + '" x2="' + X(read.max) + '" y2="' + axisY + '" stroke="#6E6F73" stroke-width="2"/>';
    svg += '<line x1="' + X(read.min) + '" y1="' + (axisY-8) + '" x2="' + X(read.min) + '" y2="' + (axisY+8) + '" stroke="#6E6F73" stroke-width="2"/>';
    svg += '<line x1="' + X(read.max) + '" y1="' + (axisY-8) + '" x2="' + X(read.max) + '" y2="' + (axisY+8) + '" stroke="#6E6F73" stroke-width="2"/>';
    svg += '<rect x="' + X(iqr[0]) + '" y="' + (axisY-14) + '" width="' + Math.max(3, X(iqr[1]) - X(iqr[0])) + '" height="28" rx="5" fill="rgba(12,110,120,.16)" stroke="#0C6E78"/>';
    svg += '<line x1="' + X(read.median) + '" y1="' + (axisY-18) + '" x2="' + X(read.median) + '" y2="' + (axisY+18) + '" stroke="#08383E" stroke-width="3"/>';
    if (strictFinite(read.mean)) svg += '<circle cx="' + X(read.mean) + '" cy="' + axisY + '" r="5" fill="#C9821F" stroke="#fff" stroke-width="1.5"/>';
    svg += '<text x="' + X(read.median) + '" y="' + (axisY+34) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#08383E">median ' + esc(fmt1(read.median)) + '</text>';
    svg += '<text x="' + L + '" y="' + (axisY+55) + '" font-size="11" fill="#6E6F73">Range ' + esc(fmt1(read.min)) + '–' + esc(fmt1(read.max)) + ' · IQR ' + esc(fmtPair(read.iqr, fmt1)) + (strictFinite(read.sd) ? ' · sample sd ' + esc(fmt1(read.sd)) : '') + '</text>';
    segments.forEach((segment, index) => {
      const s = obj(segment);
      const y = 146 + index * 36;
      const mean = strictFinite(s.mean_score) ? Number(s.mean_score) : Number(s.median_score);
      const med = strictFinite(s.median_score) ? Number(s.median_score) : mean;
      svg += '<text x="' + L + '" y="' + (y+4) + '" font-size="12" font-weight="600" fill="#18191C">' + esc(humanize(s.participant_mode)) + ' · n=' + esc(fmtWhole(s.n)) + '</text>';
      svg += '<line x1="' + X(0) + '" y1="' + (y+14) + '" x2="' + X(100) + '" y2="' + (y+14) + '" stroke="rgba(24,25,28,.09)"/>';
      svg += '<circle cx="' + X(mean) + '" cy="' + (y+14) + '" r="6" fill="#0C6E78"/>';
      svg += '<circle cx="' + X(med) + '" cy="' + (y+14) + '" r="3" fill="#fff" stroke="#08383E" stroke-width="2"/>';
      svg += '<text x="' + Math.min(W-R, X(mean)+12) + '" y="' + (y+18) + '" font-size="11" fill="#6E6F73">mean ' + esc(fmt1(mean)) + ' · median ' + esc(fmt1(med)) + '</text>';
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel"><div class="mr-viz-title">Distribution at a glance</div>' + svg + '<p class="mr-copy">Box = interquartile range; dark line = median; amber dot = mean. Vantage dots describe observed segments and do not reweight the Median Diagnostic Score.</p></div>';
  }

  function renderDepthDistribution(m, n) {
    if (m.product !== "depth" || !arr(m.sampleReads).length) return "";
    const cards = arr(m.sampleReads).map((read) => {
      const consensus = obj(read.consensus);
      const segments = arr(read.segments).map((segment) => {
        const s = obj(segment);
        return '<div class="k">' + esc(humanize(s.participant_mode)) + ' · n=' + esc(fmtWhole(s.n)) + '</div><div>Mean ' + esc(fmt1(s.mean_score)) + ' · median ' + esc(fmt1(s.median_score)) + '</div>';
      }).join("");
      return renderDepthDistributionGraphic(read) + '<div class="mr-card"><h3>' + esc(read.toolLabel) + '</h3>' +
        '<div class="kvs">' +
          '<div class="k">Eligible runs</div><div>' + esc(fmtWhole(read.n)) + '</div>' +
          '<div class="k">Median score</div><div>' + esc(fmt1(read.median)) + '</div>' +
          '<div class="k">Mean score</div><div>' + esc(fmt1(read.mean)) + '</div>' +
          '<div class="k">Observed range</div><div>' + esc(fmt1(read.min)) + ' – ' + esc(fmt1(read.max)) + '</div>' +
          '<div class="k">Interquartile range</div><div>' + esc(fmtPair(read.iqr, fmt1)) + '</div>' +
          '<div class="k">Sample standard deviation</div><div>' + esc(fmt1(read.sd)) + '</div>' +
        '</div>' +
        (consensus.detail ? '<div class="callout"><p><strong>' + esc(humanize(consensus.read)) + '.</strong> ' + esc(consensus.detail) + '</p></div>' : '') +
        (segments ? '<h3 style="margin-top:20px">Observed vantage segments</h3><div class="kvs">' + segments + '</div>' : '') +
        (read.vantageGap?.statement ? '<p class="mr-copy"><strong>Vantage difference:</strong> ' + esc(read.vantageGap.statement) + '</p>' : '') +
        (read.interpretationLimit ? '<p class="mr-copy">' + esc(read.interpretationLimit) + '</p>' : '') +
      '</div>';
    }).join("");
    return '<section class="mr-section"><h2>' + n + '. Observed participant distribution</h2>' + cards + '</section>';
  }

  function renderCrossLensGraphic(m) {
    if (m.product !== "cross_lens" || !arr(m.sourceGroups).length) return "";
    const groups = arr(m.sourceGroups).filter((lens) => strictFinite(lens.mean));
    if (!groups.length) return "";
    const W = 680, labelW = 182, R = 42, plotW = W - labelW - R;
    const rowH = 46, top = 64, H = top + groups.length * rowH + 42;
    const X = (v) => synthAxisX(v, labelW, plotW);
    let svg = '<svg class="mr-synth-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cross-Lens Diagnostic score comparison" style="display:block;width:100%;height:auto;font-family:Helvetica Neue,Arial,sans-serif">';
    [0,25,50,75,100].forEach((tick) => {
      svg += '<line x1="' + X(tick) + '" y1="38" x2="' + X(tick) + '" y2="' + (H-28) + '" stroke="rgba(24,25,28,.07)"/>';
      svg += '<text x="' + X(tick) + '" y="28" text-anchor="middle" font-size="11" fill="#9A9892">' + tick + '</text>';
    });
    if (m.scorePublished && strictFinite(m.score)) {
      svg += '<line x1="' + X(m.score) + '" y1="36" x2="' + X(m.score) + '" y2="' + (H-28) + '" stroke="#08383E" stroke-width="2.5" stroke-dasharray="5 4"/>';
      svg += '<text x="' + X(m.score) + '" y="14" text-anchor="middle" font-size="11" font-weight="700" fill="#08383E">Composite ' + esc(fmt1(m.score)) + '</text>';
    }
    groups.forEach((lens, index) => {
      const y = top + index * rowH;
      svg += '<text x="' + (labelW-12) + '" y="' + (y+4) + '" text-anchor="end" font-size="12" font-weight="700" fill="#18191C">' + esc(lens.toolLabel) + '</text>';
      if (arr(lens.iqr).length >= 2 && strictFinite(lens.iqr[0]) && strictFinite(lens.iqr[1])) {
        svg += '<line x1="' + X(lens.iqr[0]) + '" y1="' + y + '" x2="' + X(lens.iqr[1]) + '" y2="' + y + '" stroke="rgba(12,110,120,.38)" stroke-width="7" stroke-linecap="round"/>';
      }
      svg += '<circle cx="' + X(lens.mean) + '" cy="' + y + '" r="7" fill="#0C6E78" stroke="#fff" stroke-width="1.5"/>';
      svg += '<text x="' + Math.min(W-R+6, X(lens.mean)+12) + '" y="' + (y+4) + '" font-size="12" font-weight="700" fill="#18191C">' + esc(fmt1(lens.mean)) + '</text>';
      svg += '<text x="' + (labelW-12) + '" y="' + (y+20) + '" text-anchor="end" font-size="10.5" fill="#9A9892">median ' + esc(fmt1(lens.median)) + ' · n=' + esc(fmtWhole(lens.n)) + '</text>';
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel"><div class="mr-viz-title">Diagnostic lenses on one scale</div>' + svg + '<p class="mr-copy">Dots are per-Diagnostic mean scores; horizontal marks show each lens IQR when available. The dashed Composite line is the equal-lens mean. Participant volume strengthens evidence but does not give a larger lens more weight.</p></div>';
  }

  function renderLensSummary(m, n) {
    if (!arr(m.sourceGroups).length) return "";
    const cards = arr(m.sourceGroups).map((lens) => {
      return '<div class="mr-lens-card"><div class="mr-lens-label">' + esc(lens.toolLabel) + '</div>' +
        '<div style="font-family:\"Helvetica Neue\",Arial,sans-serif;font-size:2rem;font-weight:700;margin:8px 0 4px">' + esc(fmt1(lens.mean)) + '</div>' +
        '<p class="mr-copy">Mean score · median ' + esc(fmt1(lens.median)) + ' · n=' + esc(fmtWhole(lens.n)) + '</p>' +
        '<p class="mr-copy">IQR ' + esc(fmtPair(lens.iqr, fmt1)) + ' · range ' + esc(fmtPair(lens.range, fmt1)) + '</p>' +
        (lens.driver ? '<span class="mr-pill">' + esc(humanize(lens.driver)) + '</span>' : '') +
      '</div>';
    }).join("");
    const graphic = m.product === "cross_lens" ? renderCrossLensGraphic(m) : "";
    return '<section class="mr-section"><h2>' + n + '. Contributing Diagnostic lens' + (m.sourceGroups.length === 1 ? '' : 'es') + '</h2>' + graphic +
      '<div class="mr-lens-grid">' + cards + '</div></section>';
  }

  function renderMetaSignals(m, n) {
    const signals = arr(m.signals);
    const differences = arr(m.differences);
    if (!signals.length && !differences.length) return "";
    let html = '<section class="mr-section"><h2>' + n + '. Agreements and differences</h2>';
    if (signals.length) {
      html += '<h3 style="margin-top:14px">Recurring signals</h3>' + signals.map((signal) =>
        '<div class="mr-card"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +
        (signal.tools.length ? '<div>' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') +
        (signal.limit ? '<p class="mr-copy">' + esc(signal.limit) + '</p>' : '') + '</div>'
      ).join("");
    }
    if (differences.length) {
      html += '<h3 style="margin-top:22px">Differences to keep visible</h3><ul>' + differences.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul>';
    }
    return html + '</section>';
  }

  function renderMetaExposure(m, n) {
    const exp = obj(m.exposure);
    if (!exp.status) return "";
    if (exp.status === "withheld" || exp.status === "unavailable") {
      return '<section class="mr-section"><h2>' + n + '. Pathway exposure</h2><div class="callout"><p><strong>' + esc(firstStr(exp.label, "Exposure withheld")) + '.</strong> ' + esc(firstStr(exp.withheld_reason, "The submitted runs do not contain enough source-backed economic data.")) + '</p></div></section>';
    }
    const kvs = [
      ["Status", humanize(exp.status)],
      ["Priceable runs", fmtWhole(exp.priceable_runs) + " of " + fmtWhole(exp.total_runs)],
      ["Median annual hours", fmtWhole(exp.annual_hours)],
      ["Observed hours IQR", strictFinite(exp.annual_hours_low) && strictFinite(exp.annual_hours_high) ? fmtWhole(exp.annual_hours_low) + " – " + fmtWhole(exp.annual_hours_high) : "—"],
      ["Median annual labor cost", fmtMoney(exp.annual_cost)],
      ["Observed cost IQR", strictFinite(exp.annual_cost_low) && strictFinite(exp.annual_cost_high) ? fmtMoney(exp.annual_cost_low) + " – " + fmtMoney(exp.annual_cost_high) : "—"],
      ["Median capacity drag", fmtPercent(exp.capacity_drag_percent)],
      ["Recoverable range across Diagnostic medians", strictFinite(exp.recoverable_cost_low) && strictFinite(exp.recoverable_cost_high) ? fmtMoney(exp.recoverable_cost_low) + " – " + fmtMoney(exp.recoverable_cost_high) : "—"]
    ].map(([k, v]) => '<div class="k">' + esc(k) + '</div><div>' + esc(v) + '</div>').join("");
    return '<section class="mr-section"><h2>' + n + '. Source-backed pathway exposure</h2><div class="kvs">' + kvs + '</div>' +
      '<div class="callout"><p><strong>Aggregation rule.</strong> ' + esc(firstStr(exp.basis, "Repeated estimates are summarized, not added together.")) + '</p></div></section>';
  }

  function renderRequirements(m, n) {
    const requirements = arr(m.requirements);
    if (!requirements.length) return "";
    return '<section class="mr-section"><h2>' + n + '. What would strengthen the read</h2>' +
      requirements.map((item) => '<div class="mr-card"><span class="mr-pill">' + esc(humanize(item.type)) + '</span><p style="margin-top:10px">' + esc(item.text) + '</p></div>').join("") + '</section>';
  }

  function renderMetaActions(m, n) {
    const actions = arr(m.actions);
    if (!actions.length) return "";
    return '<section class="mr-section"><h2>' + n + '. Evidence-proportionate actions</h2>' +
      actions.map((action, index) => '<div class="mr-card"><div class="mr-lens-label">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style="margin-top:8px">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join("") +
      (m.sequencingLogic ? '<div class="callout"><p><strong>Sequencing logic.</strong> ' + esc(m.sequencingLogic) + '</p></div>' : '') + '</section>';
  }

  function renderMetaExperience(m, n) {
    const experience = obj(m.experiential);
    const entries = [
      ["Operational", firstStr(experience.operational_staff)],
      ["Managerial", firstStr(experience.managers)],
      ["Senior Leader", firstStr(experience.senior_leaders)]
    ].filter(([, value]) => value);
    if (!entries.length && !experience.interpretation_limit) return "";
    return '<section class="mr-section"><h2>' + n + '. Vantage evidence</h2>' +
      entries.map(([label, value]) => '<div class="mr-card"><h3>' + esc(label) + '</h3><p>' + esc(value) + '</p></div>').join("") +
      (experience.interpretation_limit ? '<p class="mr-copy">' + esc(experience.interpretation_limit) + '</p>' : '') + '</section>';
  }

  function renderMetaIndicators(m, n) {
    const indicators = arr(m.indicators);
    if (!indicators.length) return "";
    return '<section class="mr-section"><h2>' + n + '. What to watch next</h2>' + indicators.map((indicator) =>
      '<div class="mr-card"><div class="mr-lens-label">' + esc(indicator.lens || "Measurement") + '</div><h3 style="margin-top:8px">' + esc(indicator.name) + '</h3>' +
      (indicator.watchFor ? '<p><strong>Watch for:</strong> ' + esc(indicator.watchFor) + '</p>' : '') +
      (indicator.description ? '<p class="mr-copy">' + esc(indicator.description) + '</p>' : '') + '</div>'
    ).join("") + '</section>';
  }

  function renderMetaMethod(m, n) {
    const method = m.product === "depth"
      ? "The published condition is the median of the submitted scores from one Diagnostic. The observed distribution, vantage differences, scope, source identity, versions, measurement window, and sampling frame are reported separately. Sample size alone does not establish population representativeness."
      : "When the Coherent or Strong evidence threshold is met, the published composite is the arithmetic mean of the contributing Diagnostic means, so each Diagnostic receives one vote regardless of participant count. Participant depth governs evidence strength and balance. A Comparison Only or Directional read withholds the composite. Diagnostic disagreement remains visible and is not subtracted from the condition score.";
    return '<section class="mr-section"><h2>' + n + '. Method and limits</h2><p>' + esc(method) + '</p>' +
      (m.leadership ? '<div class="callout"><p><strong>Leadership implication.</strong> ' + esc(m.leadership) + '</p></div>' : '') + '</section>';
  }

  function renderMetaSynthesis(m) {
    const renderers = [
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
    ];
    let html = "", n = 1;
    renderers.forEach((renderer) => {
      const block = renderer(m, n);
      if (block) { html += block; n += 1; }
    });
    return html;
  }

'''

report = report[:start] + new_renderer + report[end:]
report_path.write_text(report, encoding="utf-8")


# -----------------------------------------------------------------------------
# 2. Rebuild Sample Reports so Synthesis is generated by the live renderer and
#    every Diagnostic quadrant is a real production output form.
# -----------------------------------------------------------------------------
sample_path = ROOT / "sample-report.html"
sample = sample_path.read_text(encoding="utf-8")


def quadrant_section(section_id, heading, x_label, y_label, x_value, y_value, labels, paragraph):
    top = 100 - y_value
    return f'''    <section class="section" id="{section_id}">
      <p class="section-eyebrow">Two axes, one position <span class="pg">Page 5</span></p>
      <h2>{heading}</h2>
      <div class="panel" style="display:flex;gap:28px;flex-wrap:wrap;align-items:center;">
        <div class="sample-quadrant" role="img" aria-label="{heading}: {x_label} {x_value}, {y_label} {y_value}" style="flex:0 1 390px;min-width:300px;max-width:100%;">
          <div style="display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center;">
            <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6E6F73;text-align:center;">{y_label}</div>
            <div style="position:relative;height:250px;border:1px solid rgba(24,25,28,.16);border-radius:10px;background:linear-gradient(90deg,rgba(60,138,96,.035) 0 50%,rgba(201,130,31,.045) 50% 100%);overflow:hidden;">
              <div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px solid rgba(24,25,28,.12);"></div>
              <div style="position:absolute;top:50%;left:0;right:0;border-top:1px solid rgba(24,25,28,.12);"></div>
              <span style="position:absolute;left:12px;top:10px;font-size:10.5px;color:#6E6F73;line-height:1.25;">{labels[0]}</span>
              <span style="position:absolute;right:12px;top:10px;font-size:10.5px;color:#6E6F73;line-height:1.25;text-align:right;">{labels[1]}</span>
              <span style="position:absolute;left:12px;bottom:10px;font-size:10.5px;color:#6E6F73;line-height:1.25;">{labels[2]}</span>
              <span style="position:absolute;right:12px;bottom:10px;font-size:10.5px;color:#6E6F73;line-height:1.25;text-align:right;">{labels[3]}</span>
              <span class="sample-quadrant-dot" style="position:absolute;left:{x_value}%;top:{top}%;width:16px;height:16px;border-radius:50%;background:#0C6E78;border:3px solid #fff;box-shadow:0 0 0 2px rgba(12,110,120,.22);transform:translate(-50%,-50%);"></span>
            </div>
          </div>
          <div style="margin:8px 0 0 36px;text-align:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6E6F73;">{x_label}</div>
          <p class="muted" style="margin:8px 0 0 36px;font-size:.8rem;">Representative plotted values: {x_label} {x_value}/100 · {y_label} {y_value}/100.</p>
        </div>
        <p style="flex:1;min-width:260px;margin:0;">{paragraph}</p>
      </div>
    </section>'''

quadrants = {
    "os-quadrant": quadrant_section(
        "os-quadrant", "Governance weight &times; execution responsiveness", "Governance weight", "Execution responsiveness", 68, 44,
        ("Fast movement,<br>lighter governance", "Fast movement,<br>heavier governance", "Slow movement,<br>lighter governance", "Slow movement,<br>heavier governance"),
        "This representative run sits in the heavier-governance / lower-responsiveness half of the matrix. The organization is still getting movement, but it is buying that movement with reconciliation, duplicate approval, and workaround effort. The task is to remove non-proportionate weight without weakening control quality."
    ),
    "dv-quadrant": quadrant_section(
        "dv-quadrant", "Governance weight &times; execution responsiveness", "Governance weight", "Execution responsiveness", 64, 52,
        ("Fast movement,<br>lighter governance", "Fast movement,<br>heavier governance", "Slow movement,<br>lighter governance", "Slow movement,<br>heavier governance"),
        "The representative pathway is still moving, but governance weight is consuming responsiveness. Four sequential approvals and recurring senior touches keep routine decisions near the middle of the matrix instead of in the lighter-governance / faster-movement quadrant."
    ),
    "sc-quadrant": quadrant_section(
        "sc-quadrant", "Governance weight &times; structural legibility", "Governance weight", "Structural legibility", 56, 50,
        ("High legibility,<br>lighter governance", "High legibility,<br>heavier governance", "Low legibility,<br>lighter governance", "Low legibility,<br>heavier governance"),
        "This representative run lands near the boundary between low and high legibility while carrying heavier governance. That combination is consistent with the sample's 50 Diagnostic score and duplicate-approval burden: the structure eventually resolves ambiguity, but only after extra interpretation and review."
    ),
    "ip-quadrant": quadrant_section(
        "ip-quadrant", "Institutional condition &times; compensatory dependence", "Compensatory dependence", "Institutional condition", 55, 47,
        ("Sound condition<br>Low compensation", "Sound condition<br>High compensation", "Weak condition<br>Low compensation", "Weak condition<br>High compensation"),
        "This representative run sits in the exposed lower-right quadrant: Institutional Performance is 47 while compensatory effort is 55. Visible output is being sustained by informal effort and management absorption rather than by a condition strong enough to carry the work on its own."
    ),
}

for section_id, replacement in quadrants.items():
    pattern = re.compile(rf'    <section class="section" id="{re.escape(section_id)}">.*?    </section>', re.S)
    sample, count = pattern.subn(replacement, sample, count=1)
    if count != 1:
        raise SystemExit(f"failed to replace {section_id}")

sample = re.sub(
    r'(<button class="dx-tab[^>]*data-target="synthesis".*?<span class="dx-tab-desc">).*?(</span>)',
    r'\1Strong evidence · published composite\2', sample, count=1, flags=re.S
)
sample = re.sub(
    r'(<button class="dx-tab[^>]*data-target="depth".*?<span class="dx-tab-desc">).*?(</span>)',
    r'\1Substantial evidence · 18 eligible runs\2', sample, count=1, flags=re.S
)

synth_start = sample.find('<section class="report-shell" data-report="synthesis"')
depth_start = sample.find('<section class="report-shell" data-report="depth"', synth_start)
tab_script = sample.find('<script>\n  (function () {', depth_start)
if synth_start < 0 or depth_start < 0 or tab_script < 0:
    raise SystemExit("could not locate Synthesis sample block")

fixtures = r'''<section class="report-shell" data-report="synthesis" hidden id="report-synthesis" role="tabpanel" aria-labelledby="tab-synthesis">
  <div style="max-width:980px;margin:0 auto;padding:46px 28px 90px;">
    <div id="sampleCrossLensRendered"></div>
  </div>
</section>

<section class="report-shell" data-report="depth" hidden id="report-depth" role="tabpanel" aria-labelledby="tab-depth">
  <div style="max-width:980px;margin:0 auto;padding:46px 28px 90px;">
    <div id="sampleDepthRendered"></div>
  </div>
</section>

<script src="monderman-report.js"></script>
<script>
  window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES = {
    crossLens: {
      synthesis_product: "cross_lens_synthesis",
      synthesis_mode: "cross_lens",
      score_status: "published",
      cross_diagnostic_score: 55.5,
      score_label: "Cross-Lens Composite Score",
      score_basis: "Equal-lens mean: Structural Clarity 52 + Decision Velocity 63 + Operational Systems 49 + Institutional Performance 58, divided by four = 55.5. Each Diagnostic receives one vote.",
      condition_band: "Observed cross-lens condition",
      respondent_count: 48,
      lens_count: 4,
      evidence_assessment: {
        evidence_band: "strong",
        evidence_label: "Strong",
        evidence_description: "Four Diagnostic lenses each contain 12 eligible unique runs in one bounded operating scope. The lenses are balanced 1:1, versions and source identities are verified, the measurement window is aligned, and more than one participant vantage is represented.",
        scope: { status: "anchored", label: "Scope aligned", statement: "All contributing runs describe the same capital-equipment approval pathway in Procurement & Clinical Operations." },
        versions: { status: "verified", label: "Diagnostic/scorer versions aligned", conflicting_lenses: [] },
        time_window: { status: "aligned", span_days: 28, maximum_days: 180, statement: "All contributing runs fall within a 28-day measurement window." },
        source_identity: { status: "verified", explicit_source_ids: 48, total_runs: 48, statement: "Every contributing run carries a unique source-run identifier." },
        representativeness: { status: "per_lens_only", label: "Observed participant sets by Diagnostic", statement: "The Synthesis describes the Included participant sets. Population claims still require a documented sampling frame within each Diagnostic." },
        lens_balance: { status: "strong", ratio: 1, weakest_lens_n: 12, strongest_lens_n: 12 },
        next_band_requirements: []
      },
      source_groups: [
        { tool_type: "structural_clarity", tool_label: "Structural Clarity", respondents: 12, mean_score: 52, median_score: 51, score_iqr: [47, 57], score_range: [42, 65], modal_driver_pattern: "handoff_ambiguity", source_id_count: 12, config_versions: ["sc-1.1"], scorer_versions: ["scorer-2026-08"] },
        { tool_type: "decision_velocity", tool_label: "Decision Velocity", respondents: 12, mean_score: 63, median_score: 62, score_iqr: [57, 69], score_range: [49, 76], modal_driver_pattern: "escalation_dependence", source_id_count: 12, config_versions: ["dv-1.1"], scorer_versions: ["scorer-2026-08"] },
        { tool_type: "operational_systems", tool_label: "Operational Systems", respondents: 12, mean_score: 49, median_score: 48, score_iqr: [44, 55], score_range: [39, 61], modal_driver_pattern: "process_density", source_id_count: 12, config_versions: ["os-1.1"], scorer_versions: ["scorer-2026-08"] },
        { tool_type: "institutional_performance", tool_label: "Institutional Performance", respondents: 12, mean_score: 58, median_score: 57, score_iqr: [52, 64], score_range: [45, 70], modal_driver_pattern: "compensatory_effort", source_id_count: 12, config_versions: ["ip-1.1"], scorer_versions: ["scorer-2026-08"] }
      ],
      diagnosis: {
        name: "Control is being preserved by borrowing execution capacity",
        type: "cross_lens_pattern",
        body: "The four Diagnostics point to one bounded operating problem from different directions: ownership is readable only after repeated handoffs, routine cases still climb the approval chain, administrative burden is concentrated in process density, and informal effort is compensating for the formal design. The condition is not that every system is weak; it is that governance weight and execution friction are reinforcing one another."
      },
      primary_pattern: "Governance weight and execution friction reinforce one another across the bounded pathway.",
      executive_briefing: {
        lede: "The pathway is functioning, but it is using managerial and senior attention as a hidden operating resource.",
        paragraphs: [
          "Structural Clarity and Decision Velocity locate the immediate mechanism: ownership blurs at handoffs, then routine cases escalate to recover certainty. Operational Systems shows what that recovery costs in repeated coordination and process density. Institutional Performance shows the consequence: people compensate for design weaknesses to preserve visible output.",
          "The 55.5 Composite Score is therefore useful as a directional condition summary, not as a substitute for the four lens results. Decision Velocity is the strongest lens at 63; Operational Systems is the weakest at 49. Keeping that 14-point spread visible is essential because it tells leadership where the aggregate condition is being produced."
        ]
      },
      convergence_signals: [
        { label: "Handoff ambiguity is driving escalation", text: "Structural Clarity and Decision Velocity both locate friction where ownership passes between teams. The shared signal is not simply delay; it is the need for additional authority touches to restore certainty after a handoff.", tools: ["structural_clarity", "decision_velocity"] },
        { label: "Informal effort is protecting visible throughput", text: "Operational Systems and Institutional Performance both show people absorbing work that the formal pathway does not carry cleanly. That compensation keeps output moving while making the underlying design look healthier than it is.", tools: ["operational_systems", "institutional_performance"] }
      ],
      contradictions: [
        "Decision Velocity is materially stronger than Operational Systems. That difference suggests delay is concentrated in authority and handoff design rather than uniformly distributed across the entire operating system.",
        "Senior-leader observations describe control as stable while operational observations describe recurring workaround effort. The Synthesis preserves that vantage difference instead of treating it as noise."
      ],
      pathway_exposure: {
        status: "available",
        priceable_runs: 44,
        total_runs: 48,
        annual_hours: 7800,
        annual_hours_low: 6100,
        annual_hours_high: 9600,
        annual_cost: 702000,
        annual_cost_low: 558000,
        annual_cost_high: 864000,
        capacity_drag_percent: 18.5,
        recoverable_cost_low: 185000,
        recoverable_cost_high: 310000,
        basis: "Repeated economic estimates are summarized by median and interquartile range. They are not added across Diagnostics or participants."
      },
      priority_actions: [
        { label: "Make the handoff owner explicit", text: "Name one accountable owner at the highest-friction transfer point and publish the decision rights that move with the work. Do this before adding automation or another approval layer.", tier: "structural", source: "Structural Clarity + Decision Velocity" },
        { label: "Lower routine escalation out of the senior path", text: "Define the exception conditions that genuinely require senior review and move routine cases below that threshold. Track the share of cases that still climb above it.", tier: "behavioral", source: "Decision Velocity" },
        { label: "Retire the workaround, not the people using it", text: "Use the informal tracker and reconciliation steps as design evidence. Rebuild the formal path to carry the information people currently preserve manually, then remove the duplicate mechanism.", tier: "structural", source: "Operational Systems + Institutional Performance" }
      ],
      experiential: {
        operational_staff: "Operational participants describe locating work through side channels and checking more than one system to know where an approval actually sits.",
        managers: "Managers describe pre-briefing approvers and personally reconciling queue state so routine cases do not restart or disappear between teams.",
        senior_leaders: "Senior leaders describe the controls as necessary but cannot consistently identify which approval layer changes an outcome versus which one confirms a decision already made.",
        interpretation_limit: "Vantage evidence is interpretive and does not alter the quantitative scores. It helps locate why the four Diagnostic lenses differ."
      },
      leading_indicators: [
        { lens_label: "Decision Velocity", name: "Routine cases requiring senior escalation", watch_for: "A sustained decline after authority thresholds are reset.", description: "If the redesign is working, routine approvals should stop consuming senior calendar time before the Composite Score materially moves." },
        { lens_label: "Structural Clarity", name: "Handoffs requiring ownership clarification", watch_for: "Fewer transfers that trigger a manager message or meeting to establish who owns the next step.", description: "This is the earliest operational test of whether ownership became legible." },
        { lens_label: "Operational Systems", name: "Duplicate tracking or reconciliation touches", watch_for: "Shadow-tracker use and manual queue reconciliation falling without a rise in missed cases.", description: "This tests whether burden was removed rather than displaced." }
      ],
      narrative: {
        executive_summary: "Across four balanced Diagnostic lenses, the pathway shows a coherent pattern of governance weight, handoff ambiguity, escalation, and compensatory effort. The Strong evidence band supports a published Cross-Lens Composite Score of 55.5 while preserving the 14-point spread between the strongest and weakest Diagnostic lenses.",
        leadership_implication: "Treat senior attention as a scarce operating resource. The near-term opportunity is not to remove control; it is to stop using escalation and workaround effort to compensate for unclear ownership and duplicated process.",
        sequenced_action_logic: "Clarify ownership first, reset routine escalation second, then remove the duplicate operating path. Re-measure after the first full operating cycle so movement can be tested in the same four Diagnostic lenses."
      },
      confidence: { label: "Strong evidence within the submitted scope" }
    },

    depth: {
      synthesis_product: "depth_synthesis",
      synthesis_mode: "depth",
      score_status: "published",
      aggregate_score: 56,
      score_label: "Median Diagnostic Score",
      score_basis: "The published condition is the median of 18 eligible Structural Clarity run scores. Vantage differences are reported separately and do not reweight the median.",
      condition_band: "Observed Structural Clarity condition",
      respondent_count: 18,
      lens_count: 1,
      evidence_assessment: {
        evidence_band: "substantial_observed_set",
        evidence_label: "Substantial",
        evidence_description: "This Depth Synthesis summarizes 18 eligible Structural Clarity runs from one bounded operating scope. The observed set is large enough for a substantially richer description of the submitted participants, but sample size alone does not establish population representativeness.",
        scope: { status: "anchored", label: "Scope aligned", statement: "All 18 runs describe the same capital-equipment approval pathway in Procurement & Clinical Operations." },
        versions: { status: "verified", label: "Diagnostic/scorer versions aligned", conflicting_lenses: [] },
        time_window: { status: "aligned", span_days: 21, maximum_days: 180, statement: "All 18 runs fall within a 21-day measurement window." },
        source_identity: { status: "verified", explicit_source_ids: 18, total_runs: 18, statement: "Every contributing run carries a unique source-run identifier." },
        representativeness: { status: "observed_set", label: "Observed participant set", statement: "The read describes the 18 Included participants. Generalization to the broader population requires a documented sampling frame and response coverage." },
        lens_balance: { status: "not_applicable", ratio: 1, weakest_lens_n: 18, strongest_lens_n: 18 },
        next_band_requirements: [
          { type: "runs", current_runs: 18, target_runs: 50, additional_runs_needed: 32, text: "32 additional unique runs would move this Depth Synthesis into the Large observed-set band." },
          { type: "sampling_frame", text: "Document the invited population and sampling method before generalizing beyond the observed participant set." }
        ]
      },
      source_groups: [
        { tool_type: "structural_clarity", tool_label: "Structural Clarity", respondents: 18, mean_score: 57.2, median_score: 56, score_iqr: [50, 64], score_range: [41, 74], modal_driver_pattern: "handoff_ambiguity", source_id_count: 18, config_versions: ["sc-1.1"], scorer_versions: ["scorer-2026-08"] }
      ],
      sample_reads: [
        {
          tool_type: "structural_clarity",
          tool_label: "Structural Clarity",
          n: 18,
          observed_set_label: "Substantial",
          score: { mean: 57.2, median: 56, sd: 9.4, min: 41, max: 74, iqr: [50, 64] },
          consensus: { read: "mixed", detail: "The observed runs show moderate variation rather than one uniform experience. The median is stable enough to summarize the set, but the vantage pattern matters to interpretation." },
          segments: [
            { participant_mode: "operational", n: 6, mean_score: 49.5, median_score: 49 },
            { participant_mode: "managerial", n: 6, mean_score: 56.8, median_score: 56 },
            { participant_mode: "senior_leader", n: 6, mean_score: 65.3, median_score: 65 }
          ],
          vantage_gap: { high_segment: "senior_leader", high_mean: 65.3, low_segment: "operational", low_mean: 49.5, gap: 15.8, statement: "Senior Leader and Operational mean scores differ by 15.8 points. The gap is large enough to investigate as a real vantage difference rather than hide inside the overall median." },
          interpretation_limit: "These statistics describe the 18 submitted runs. Population claims require a documented sampling frame and response coverage."
        }
      ],
      diagnosis: {
        name: "Ownership is clear at the top and ambiguous at the handoff",
        type: "same_Diagnostic_pattern",
        body: "The 18 Structural Clarity runs do not describe a uniformly unclear organization. They describe a specific break: senior leaders see a reasonably legible structure, while operational participants experience ownership becoming ambiguous when work moves between teams. That 15.8-point vantage gap is the most decision-relevant feature of the distribution."
      },
      primary_pattern: "Handoff ownership deteriorates as the work moves away from the senior-leader view of the structure.",
      executive_briefing: {
        lede: "The median score of 56 matters less than where the distribution separates.",
        paragraphs: [
          "Across 18 eligible runs, the middle half of scores sits between 50 and 64. That is not a collapsed distribution, but it is also not random noise. Operational participants cluster materially below Senior Leaders, and the recurring narrative evidence locates the gap at cross-team handoffs rather than at basic role descriptions.",
          "The practical implication is narrower than 'clarify roles.' The evidence supports fixing the ownership transfer point: who owns the case after approval, what authority moves with it, and what condition returns it to the prior owner. If those rules become legible, the next Depth Synthesis should show the Operational segment move before the Senior Leader segment does."
        ]
      },
      convergence_signals: [
        { label: "Handoff ownership is the recurring break", text: "Across the observed runs, ambiguity concentrates where responsibility crosses team boundaries. Participants generally understand their own role; they disagree about who owns the next state of the work.", tools: ["structural_clarity"] },
        { label: "The vantage gap is directional, not cosmetic", text: "Senior Leaders score the structure more favorably than Operational participants. The difference is large enough that a single organization-wide interpretation would conceal the operating experience closest to the handoff.", tools: ["structural_clarity"] }
      ],
      contradictions: [
        "Managerial scores sit near the overall median rather than forming a second extreme. That makes a simple 'leadership versus staff' explanation incomplete; the break appears to sharpen closest to execution.",
        "Not every low-scoring run reports duplicate approval burden. The recurring signal is ownership transfer, so control reduction should not be treated as the only remedy."
      ],
      pathway_exposure: {
        status: "available",
        priceable_runs: 16,
        total_runs: 18,
        annual_hours: 6100,
        annual_hours_low: 4800,
        annual_hours_high: 7900,
        annual_cost: 549000,
        annual_cost_low: 432000,
        annual_cost_high: 711000,
        capacity_drag_percent: 14.8,
        recoverable_cost_low: 120000,
        recoverable_cost_high: 210000,
        basis: "Repeated estimates are summarized by median and interquartile range. They are not added across participants."
      },
      what_would_strengthen_the_read: [
        { type: "runs", current_runs: 18, target_runs: 50, additional_runs_needed: 32, text: "32 additional unique runs would move this Depth Synthesis into the Large observed-set band." },
        { type: "sampling_frame", text: "Document the invited population and sampling method before treating the observed set as representative of the full pathway population." }
      ],
      priority_actions: [
        { label: "Define the ownership transfer point", text: "Write one explicit rule for when responsibility moves from the initiating team to the receiving team, including the authority and information that move with it.", tier: "structural", source: "Structural Clarity" },
        { label: "Test the rule against the six lowest operational reads", text: "Use the specific handoffs described in the lowest-scoring Operational runs as acceptance tests. If the new rule cannot resolve those cases without managerial interpretation, it is not yet clear enough.", tier: "behavioral", source: "Operational segment" },
        { label: "Re-measure the same pathway after one full cycle", text: "Run the same Structural Clarity Diagnostic across the same vantages after the ownership rule has been in use long enough to affect real handoffs. Look first for movement in the Operational segment and a narrowing vantage gap.", tier: "structural", source: "Depth Synthesis" }
      ],
      experiential: {
        operational_staff: "Operational participants repeatedly describe cases that are technically approved but still require messages or meetings to establish who owns the next action.",
        managers: "Managers describe becoming the translation layer when two teams can each explain their own responsibilities but disagree about the transfer point between them.",
        senior_leaders: "Senior Leaders generally describe the formal role structure as clear and are more likely to see the problem as isolated exception handling rather than a recurring ownership-transfer issue.",
        interpretation_limit: "These vantage narratives help locate the quantitative gap. They do not change the Median Diagnostic Score."
      },
      leading_indicators: [
        { lens_label: "Structural Clarity", name: "Handoffs requiring manager clarification", watch_for: "A sustained reduction in cases where a manager must establish the next owner after work changes teams.", description: "This should improve before the overall median moves materially." },
        { lens_label: "Structural Clarity", name: "Operational-to-Senior Leader vantage gap", watch_for: "The 15.8-point mean gap narrowing while the Senior Leader segment remains stable.", description: "A narrowing gap would indicate that the formal structure is becoming more legible at the point of execution rather than simply being redescribed at the top." },
        { lens_label: "Structural Clarity", name: "Same-day ownership reversals", watch_for: "Fewer cases in which two teams give different answers about who owns the next step.", description: "This is a direct behavioral test of whether the handoff rule is working."
        }
      ],
      narrative: {
        executive_summary: "Eighteen eligible Structural Clarity runs produce a Median Diagnostic Score of 56 with Substantial evidence. The dominant feature is not the median alone but a 15.8-point difference between Senior Leader and Operational mean scores, concentrated around cross-team ownership handoffs.",
        leadership_implication: "Do not launch a broad role-clarity program. Fix the ownership transfer point that the distribution actually isolates, then re-measure whether Operational experience moves toward the structure Senior Leaders already believe exists.",
        sequenced_action_logic: "Define the handoff rule, test it against the lowest-scoring operational cases, then re-measure the same scope and vantages."
      },
      confidence: { label: "Substantial observed-set evidence" }
    }
  };

  (function renderRepresentativeSyntheses() {
    function go() {
      if (!window.MondermanReport) throw new Error("MondermanReport renderer unavailable on Sample Reports");
      const fixtures = window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES;
      MondermanReport.render("sampleCrossLensRendered", MondermanReport.fromSynthesis(fixtures.crossLens));
      MondermanReport.render("sampleDepthRendered", MondermanReport.fromSynthesis(fixtures.depth));
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
    else go();
  })();
</script>

'''

sample = sample[:synth_start] + fixtures + sample[tab_script:]
sample_path.write_text(sample, encoding="utf-8")

print("SAMPLE_PRODUCT_FIDELITY_REPAIR_APPLIED")
