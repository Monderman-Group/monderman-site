from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "monderman-report.js"
text = PATH.read_text(encoding="utf-8")
original = text


def replace_block(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")


text = text.replace(
    "• MondermanReport.fromSynthesis(synthResult) — a cross-diagnostic synthesis result (the /cross-diagnostic-synthesis payload; /cross-assessment-synthesis kept as a legacy alias)",
    "• MondermanReport.fromSynthesis(synthResult) — a depth or cross-lens synthesis result (the /cross-diagnostic-synthesis payload; /cross-assessment-synthesis kept as a legacy alias)",
)

FROM_SYNTHESIS = r'''  // ---- adapter: depth / cross-lens synthesis result --> model ---------------
  function fromSynthesis(result) {
    const r = obj(result);
    const strictNum = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))) ? Number(v) : null;
    const product = r.synthesis_product === "depth_synthesis" || r.synthesis_mode === "depth" ? "depth" : "cross_lens";
    const evidence = obj(r.evidence_assessment);
    const scope = obj(evidence.scope);
    const versions = obj(evidence.versions);
    const timeWindow = obj(evidence.time_window);
    const identity = obj(evidence.source_identity);
    const balance = obj(evidence.lens_balance);
    const representative = obj(evidence.representativeness);
    const exposure = obj(r.pathway_exposure || r.compounded_exposure);
    const narrative = obj(r.narrative);
    const diagnosis = obj(r.diagnosis);
    const briefing = obj(r.executive_briefing);
    const confidence = obj(r.confidence);
    const score = strictNum(r.cross_diagnostic_score ?? r.aggregate_score);
    const scorePublished = r.score_status === "published" && score !== null;
    const sourceGroups = arr(r.source_groups).map((group) => {
      const g = obj(group);
      return {
        toolType: firstStr(g.tool_type),
        toolLabel: firstStr(g.tool_label, g.tool_type),
        n: strictNum(g.respondents ?? g.n),
        mean: strictNum(g.mean_score),
        median: strictNum(g.median_score),
        iqr: arr(g.score_iqr),
        range: arr(g.score_range),
        driver: firstStr(g.modal_driver_pattern),
        participantModes: obj(g.participant_mode_counts),
        sourceIdCount: strictNum(g.source_id_count),
        configVersions: arr(g.config_versions),
        scorerVersions: arr(g.scorer_versions)
      };
    });
    const sampleReads = arr(r.sample_reads).map((item) => {
      const read = obj(item);
      const scores = obj(read.score);
      return {
        toolType: firstStr(read.tool_type),
        toolLabel: firstStr(read.tool_label, read.tool_type),
        n: strictNum(read.n),
        observedBand: firstStr(read.observed_set_label, read.observed_set_band),
        mean: strictNum(scores.mean),
        median: strictNum(scores.median),
        sd: strictNum(scores.sd),
        min: strictNum(scores.min),
        max: strictNum(scores.max),
        iqr: arr(scores.iqr),
        consensus: obj(read.consensus),
        segments: arr(read.segments),
        vantageGap: obj(read.vantage_gap),
        interpretationLimit: firstStr(read.interpretation_limit)
      };
    });
    const signals = arr(r.convergence_signals).map((item) => {
      const signal = typeof item === "string" ? { text: item } : obj(item);
      return {
        label: firstStr(signal.label, signal.key, "Shared signal"),
        text: firstStr(signal.text, signal.message),
        tools: arr(signal.tools),
        scope: firstStr(signal.scope),
        limit: firstStr(signal.interpretation_limit)
      };
    }).filter((item) => item.text || item.label);
    const differences = arr(r.contradictions).map((item) => firstStr(
      typeof item === "string" ? item : "",
      obj(item).text,
      obj(item).message,
      obj(item).label
    )).filter(Boolean);
    const requirements = arr(r.what_would_strengthen_the_read || evidence.next_band_requirements).map((item) => {
      const requirement = typeof item === "string" ? { text: item } : obj(item);
      return {
        type: firstStr(requirement.type, "evidence"),
        text: firstStr(requirement.text, requirement.message),
        toolType: firstStr(requirement.tool_type),
        currentRuns: strictNum(requirement.current_runs),
        targetRuns: strictNum(requirement.target_runs),
        additionalRuns: strictNum(requirement.additional_runs_needed)
      };
    }).filter((item) => item.text);
    const actions = arr(r.priority_actions).map((item) => {
      const action = typeof item === "string" ? { text: item } : obj(item);
      return {
        label: firstStr(action.label, "Action"),
        text: firstStr(action.text, action.summary),
        tier: firstStr(action.tier),
        source: firstStr(action.source)
      };
    }).filter((item) => item.text);
    const indicators = arr(r.leading_indicators).map((item) => {
      const indicator = obj(item);
      return {
        lens: firstStr(indicator.lens_label, indicator.lens),
        name: firstStr(indicator.name),
        watchFor: firstStr(indicator.watch_for),
        description: firstStr(indicator.description),
        status: firstStr(indicator.current_status)
      };
    }).filter((item) => item.name || item.watchFor);
    const experiential = obj(r.experiential);
    const briefParagraphs = arr(briefing.paragraphs).map(firstStr).filter(Boolean);
    const modeLabel = product === "depth" ? "Depth Synthesis" : "Cross-Lens Synthesis";
    const reads = strictNum(r.respondent_count) ?? sourceGroups.reduce((sum, group) => sum + (group.n || 0), 0);
    const lensCount = strictNum(r.lens_count) ?? sourceGroups.length;
    const evidenceLabel = firstStr(evidence.evidence_label, r.readiness_label, "Evidence band unavailable");
    const conditionBand = firstStr(r.condition_band, scorePublished ? "Observed condition" : "Composite withheld");
    const coverBody = firstStr(narrative.executive_summary, briefing.lede, diagnosis.body, r.primary_pattern);
    const filenameStem = product === "depth"
      ? "depth-synthesis-" + slug(sourceGroups[0]?.toolType || "diagnostic") + "-n" + (reads || "x")
      : "cross-lens-synthesis-n" + (reads || "x");

    return {
      kind: "meta-synthesis",
      product: product,
      mastline: "Monderman • " + modeLabel,
      title: product === "depth" ? "Depth Synthesis Executive Report" : "Cross-Lens Synthesis Executive Report",
      subtitle: product === "depth"
        ? "A same-instrument read across multiple respondents — reporting the observed median, distribution, segment differences, and evidence limits."
        : "A multi-lens read that separates lens comparison from a coherent composite and states exactly what evidence supports each conclusion.",
      meta: [
        { label: "Generated", value: nowLabel() },
        { label: "Product", value: modeLabel },
        { label: "Runs", value: reads == null ? "—" : num(reads) },
        { label: "Lenses", value: lensCount == null ? "—" : num(lensCount) },
        { label: "Evidence", value: evidenceLabel }
      ],
      headlineScore: scorePublished ? Math.round(score) : "—",
      headlineBand: scorePublished ? conditionBand : "Composite withheld",
      coverBody: coverBody,
      scorePublished: scorePublished,
      score: score,
      scoreLabel: firstStr(r.score_label),
      scoreBasis: firstStr(r.score_basis),
      conditionBand: conditionBand,
      conditionSpread: obj(r.condition_spread),
      evidence: evidence,
      evidenceLabel: evidenceLabel,
      evidenceDescription: firstStr(evidence.evidence_description),
      scope: scope,
      versions: versions,
      timeWindow: timeWindow,
      sourceIdentity: identity,
      lensBalance: balance,
      representativeness: representative,
      requirements: requirements,
      diagnosis: diagnosis,
      primaryPattern: firstStr(r.primary_pattern, diagnosis.body),
      primaryPatternClaimLevel: firstStr(r.primary_pattern_claim_level),
      briefing: { lede: firstStr(briefing.lede), paragraphs: briefParagraphs },
      narrative: narrative,
      sourceGroups: sourceGroups,
      sampleReads: sampleReads,
      signals: signals,
      differences: differences,
      exposure: exposure,
      actions: actions,
      experiential: experiential,
      indicators: indicators,
      leadership: firstStr(narrative.leadership_implication),
      sequencingLogic: firstStr(narrative.sequenced_action_logic),
      confidence: confidence,
      reads: reads,
      lensCount: lensCount,
      footnote: product === "depth"
        ? "This report describes the submitted same-instrument runs. Population generalization requires a documented sampling frame and response coverage."
        : "This report is a directional cross-lens synthesis. A published composite is not a proven causal model; source evidence and alternative explanations remain necessary.",
      filenameBase: filenameStem,
      source: r
    };
  }

  // ---- adapter: single diagnostic run --> model'''

replace_block(
    r'  // ---- adapter: cross-diagnostic synthesis result --> model -----------------\n  function fromSynthesis\(result\) \{.*?\n  // ---- adapter: single diagnostic run --> model',
    FROM_SYNTHESIS,
    "fromSynthesis adapter",
)

META_RENDERERS = r'''  // ──────────────────────────────────────────────────────────────────────
  // Depth and cross-lens synthesis renderers. Condition and evidence strength
  // are deliberately separate: a lens comparison may be valuable while its
  // composite score remains withheld.
  // ──────────────────────────────────────────────────────────────────────

  function strictFinite(v) {
    return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  }
  function fmt1(v) { return strictFinite(v) ? (Math.round(Number(v) * 10) / 10).toLocaleString("en-US") : "—"; }
  function fmtWhole(v) { return strictFinite(v) ? Math.round(Number(v)).toLocaleString("en-US") : "—"; }
  function fmtMoney(v) { return strictFinite(v) ? cur(Number(v)) : "—"; }
  function fmtPercent(v) { return strictFinite(v) ? (Math.round(Number(v) * 10) / 10).toLocaleString("en-US") + "%" : "—"; }
  function fmtPair(values, formatter) {
    const pair = arr(values);
    if (pair.length < 2 || !strictFinite(pair[0]) || !strictFinite(pair[1])) return "—";
    return formatter(pair[0]) + " – " + formatter(pair[1]);
  }
  function humanize(v) {
    return String(v || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function evidenceCard(label, value, detail) {
    if (!value && !detail) return "";
    return '<div class="mr-lens-card"><div class="mr-lens-label">' + esc(label) + '</div>' +
      '<div style="font-family:\"Helvetica Neue\",Arial,sans-serif;font-size:1rem;font-weight:700;margin:7px 0 6px">' + esc(value || "—") + '</div>' +
      (detail ? '<p class="mr-copy">' + esc(detail) + '</p>' : '') + '</div>';
  }
  function textItem(item) {
    if (item == null) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") return firstStr(item.text, item.message, item.label);
    return String(item);
  }

  function renderMetaEvidence(m) {
    const scope = obj(m.scope), versions = obj(m.versions), identity = obj(m.sourceIdentity);
    const timeWindow = obj(m.timeWindow), balance = obj(m.lensBalance), representative = obj(m.representativeness);
    const cards = [
      evidenceCard("Evidence band", m.evidenceLabel, m.evidenceDescription),
      evidenceCard("Composite score", m.scorePublished ? "Published" : "Withheld", m.scoreBasis),
      evidenceCard("Scope", firstStr(scope.label, humanize(scope.status)), firstStr(scope.statement)),
      evidenceCard("Lens balance", firstStr(humanize(balance.status), "Not applicable"), strictFinite(balance.ratio) ? "Strongest-to-weakest lens ratio: " + fmt1(balance.ratio) + ":1" : "Not applicable to one-lens depth synthesis."),
      evidenceCard("Instrument versions", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? "Conflicting lenses: " + versions.conflicting_lenses.map(humanize).join(", ") : ""),
      evidenceCard("Source identity", humanize(identity.status), firstStr(identity.statement)),
      evidenceCard("Measurement window", humanize(timeWindow.status), firstStr(timeWindow.statement)),
      evidenceCard("Representativeness", firstStr(representative.label, humanize(representative.status)), firstStr(representative.statement))
    ].filter(Boolean).join("");
    return '<section class="mr-section"><h2>1. Evidence status</h2>' +
      '<div class="callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this synthesis is allowed to claim.") + '</p></div>' +
      '<div class="mr-lens-grid">' + cards + '</div></section>';
  }

  function renderMetaFinding(m) {
    const diagnosis = obj(m.diagnosis);
    const paragraphs = arr(m.briefing?.paragraphs).map(textItem).filter(Boolean);
    return '<section class="mr-section"><h2>2. What this read says</h2>' +
      '<div class="mr-card"><h3>' + esc(firstStr(diagnosis.name, m.product === "depth" ? "Observed same-instrument pattern" : "Cross-lens finding")) + '</h3>' +
      (diagnosis.type ? '<span class="mr-pill">' + esc(diagnosis.type) + '</span>' : '') +
      '<p>' + esc(firstStr(diagnosis.body, m.primaryPattern, m.briefing?.lede)) + '</p></div>' +
      (m.briefing?.lede ? '<p class="mr-lede">' + esc(m.briefing.lede) + '</p>' : '') +
      paragraphs.map((p) => '<p>' + esc(p) + '</p>').join("") +
      (m.scoreBasis ? '<div class="callout"><p><strong>Score basis.</strong> ' + esc(m.scoreBasis) + '</p></div>' : '') +
      '</section>';
  }

  function renderDepthDistribution(m) {
    if (m.product !== "depth" || !arr(m.sampleReads).length) return "";
    const cards = arr(m.sampleReads).map((read) => {
      const consensus = obj(read.consensus);
      const segments = arr(read.segments).map((segment) => {
        const s = obj(segment);
        return '<div class="k">' + esc(humanize(s.participant_mode)) + ' · n=' + esc(fmtWhole(s.n)) + '</div><div>Mean ' + esc(fmt1(s.mean_score)) + ' · median ' + esc(fmt1(s.median_score)) + '</div>';
      }).join("");
      return '<div class="mr-card"><h3>' + esc(read.toolLabel) + '</h3>' +
        '<div class="kvs">' +
          '<div class="k">Observed runs</div><div>' + esc(fmtWhole(read.n)) + '</div>' +
          '<div class="k">Median score</div><div>' + esc(fmt1(read.median)) + '</div>' +
          '<div class="k">Mean score</div><div>' + esc(fmt1(read.mean)) + '</div>' +
          '<div class="k">Observed range</div><div>' + esc(fmt1(read.min)) + ' – ' + esc(fmt1(read.max)) + '</div>' +
          '<div class="k">Interquartile range</div><div>' + esc(fmtPair(read.iqr, fmt1)) + '</div>' +
          '<div class="k">Sample standard deviation</div><div>' + esc(fmt1(read.sd)) + '</div>' +
        '</div>' +
        (consensus.detail ? '<div class="callout"><p><strong>' + esc(humanize(consensus.read)) + '.</strong> ' + esc(consensus.detail) + '</p></div>' : '') +
        (segments ? '<h3 style="margin-top:20px">Observed vantage segments</h3><div class="kvs">' + segments + '</div>' : '') +
        (read.vantageGap?.statement ? '<p class="mr-copy"><strong>Segment difference:</strong> ' + esc(read.vantageGap.statement) + '</p>' : '') +
        (read.interpretationLimit ? '<p class="mr-copy">' + esc(read.interpretationLimit) + '</p>' : '') +
      '</div>';
    }).join("");
    return '<section class="mr-section"><h2>3. Respondent distribution</h2>' + cards + '</section>';
  }

  function renderLensSummary(m) {
    if (!arr(m.sourceGroups).length) return "";
    const cards = arr(m.sourceGroups).map((lens) => {
      return '<div class="mr-lens-card"><div class="mr-lens-label">' + esc(lens.toolLabel) + '</div>' +
        '<div style="font-family:\"Helvetica Neue\",Arial,sans-serif;font-size:2rem;font-weight:700;margin:8px 0 4px">' + esc(fmt1(lens.mean)) + '</div>' +
        '<p class="mr-copy">Mean score · median ' + esc(fmt1(lens.median)) + ' · n=' + esc(fmtWhole(lens.n)) + '</p>' +
        '<p class="mr-copy">IQR ' + esc(fmtPair(lens.iqr, fmt1)) + ' · range ' + esc(fmtPair(lens.range, fmt1)) + '</p>' +
        (lens.driver ? '<span class="mr-pill">' + esc(humanize(lens.driver)) + '</span>' : '') +
      '</div>';
    }).join("");
    return '<section class="mr-section"><h2>' + (m.product === "depth" ? '4' : '3') + '. Contributing lens' + (m.sourceGroups.length === 1 ? '' : 'es') + '</h2>' +
      '<div class="mr-lens-grid">' + cards + '</div></section>';
  }

  function renderMetaSignals(m) {
    const signals = arr(m.signals);
    const differences = arr(m.differences);
    if (!signals.length && !differences.length) return "";
    let html = '<section class="mr-section"><h2>' + (m.product === "depth" ? '5' : '4') + '. Agreements and interpretation limits</h2>';
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

  function renderMetaExposure(m) {
    const exp = obj(m.exposure);
    const sectionNumber = m.product === "depth" ? 6 : 5;
    if (!exp.status) return "";
    if (exp.status === "withheld" || exp.status === "unavailable") {
      return '<section class="mr-section"><h2>' + sectionNumber + '. Pathway exposure</h2><div class="callout"><p><strong>' + esc(firstStr(exp.label, "Exposure withheld")) + '.</strong> ' + esc(firstStr(exp.withheld_reason, "The submitted runs do not contain enough source-backed economic data.")) + '</p></div></section>';
    }
    const kvs = [
      ["Status", humanize(exp.status)],
      ["Priceable runs", fmtWhole(exp.priceable_runs) + " of " + fmtWhole(exp.total_runs)],
      ["Median annual hours", fmtWhole(exp.annual_hours)],
      ["Observed hours IQR", strictFinite(exp.annual_hours_low) && strictFinite(exp.annual_hours_high) ? fmtWhole(exp.annual_hours_low) + " – " + fmtWhole(exp.annual_hours_high) : "—"],
      ["Median annual labor cost", fmtMoney(exp.annual_cost)],
      ["Observed cost IQR", strictFinite(exp.annual_cost_low) && strictFinite(exp.annual_cost_high) ? fmtMoney(exp.annual_cost_low) + " – " + fmtMoney(exp.annual_cost_high) : "—"],
      ["Median capacity drag", fmtPercent(exp.capacity_drag_percent)],
      ["Recoverable range across lens medians", strictFinite(exp.recoverable_cost_low) && strictFinite(exp.recoverable_cost_high) ? fmtMoney(exp.recoverable_cost_low) + " – " + fmtMoney(exp.recoverable_cost_high) : "—"]
    ].map(([k, v]) => '<div class="k">' + esc(k) + '</div><div>' + esc(v) + '</div>').join("");
    return '<section class="mr-section"><h2>' + sectionNumber + '. Source-backed pathway exposure</h2><div class="kvs">' + kvs + '</div>' +
      '<div class="callout"><p><strong>Aggregation rule.</strong> ' + esc(firstStr(exp.basis, "Repeated estimates are summarized, not added together.")) + '</p></div></section>';
  }

  function renderRequirements(m) {
    const requirements = arr(m.requirements);
    if (!requirements.length) return "";
    const sectionNumber = m.product === "depth" ? 7 : 6;
    return '<section class="mr-section"><h2>' + sectionNumber + '. What would strengthen the read</h2>' +
      requirements.map((item) => '<div class="mr-card"><span class="mr-pill">' + esc(humanize(item.type)) + '</span><p style="margin-top:10px">' + esc(item.text) + '</p></div>').join("") + '</section>';
  }

  function renderMetaActions(m) {
    const actions = arr(m.actions);
    if (!actions.length) return "";
    const sectionNumber = m.product === "depth" ? 8 : 7;
    return '<section class="mr-section"><h2>' + sectionNumber + '. Evidence-proportionate actions</h2>' +
      actions.map((action, index) => '<div class="mr-card"><div class="mr-lens-label">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style="margin-top:8px">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join("") +
      (m.sequencingLogic ? '<p class="mr-copy">' + esc(m.sequencingLogic) + '</p>' : '') + '</section>';
  }

  function renderMetaExperience(m) {
    const experience = obj(m.experiential);
    const entries = [
      ["Operational staff", firstStr(experience.operational_staff)],
      ["Managers", firstStr(experience.managers)],
      ["Senior leaders", firstStr(experience.senior_leaders)]
    ].filter(([, value]) => value);
    if (!entries.length && !experience.interpretation_limit) return "";
    const sectionNumber = m.product === "depth" ? 9 : 8;
    return '<section class="mr-section"><h2>' + sectionNumber + '. Measured segment evidence</h2>' +
      entries.map(([label, value]) => '<div class="mr-card"><h3>' + esc(label) + '</h3><p>' + esc(value) + '</p></div>').join("") +
      (experience.interpretation_limit ? '<p class="mr-copy">' + esc(experience.interpretation_limit) + '</p>' : '') + '</section>';
  }

  function renderMetaIndicators(m) {
    const indicators = arr(m.indicators);
    if (!indicators.length) return "";
    const sectionNumber = m.product === "depth" ? 10 : 9;
    return '<section class="mr-section"><h2>' + sectionNumber + '. Suggested measures</h2>' + indicators.map((indicator) =>
      '<div class="mr-card"><div class="mr-lens-label">' + esc(indicator.lens || "Measurement") + '</div><h3 style="margin-top:8px">' + esc(indicator.name) + '</h3>' +
      (indicator.watchFor ? '<p><strong>Watch for:</strong> ' + esc(indicator.watchFor) + '</p>' : '') +
      (indicator.description ? '<p class="mr-copy">' + esc(indicator.description) + '</p>' : '') + '</div>'
    ).join("") + '</section>';
  }

  function renderMetaMethod(m) {
    const sectionNumber = m.product === "depth" ? 11 : 10;
    const method = m.product === "depth"
      ? "The published condition is the median of the submitted scores from one diagnostic lens. The observed distribution, segment differences, scope, source identity, versions, measurement window, and sampling frame are reported separately. Sample size alone does not establish population representativeness."
      : "When the coherence band is met, the published composite is the arithmetic mean of the contributing lens means, so each diagnostic lens receives one vote regardless of respondent count. Respondent depth governs evidence strength and balance. A comparison-only or directional read withholds the composite. Lens disagreement remains visible and is not subtracted from the condition score.";
    return '<section class="mr-section"><h2>' + sectionNumber + '. Method and limits</h2><p>' + esc(method) + '</p>' +
      (m.leadership ? '<div class="callout"><p><strong>Leadership implication.</strong> ' + esc(m.leadership) + '</p></div>' : '') + '</section>';
  }

  function renderMetaSynthesis(m) {
    return renderMetaEvidence(m) +
      renderMetaFinding(m) +
      renderDepthDistribution(m) +
      renderLensSummary(m) +
      renderMetaSignals(m) +
      renderMetaExposure(m) +
      renderRequirements(m) +
      renderMetaActions(m) +
      renderMetaExperience(m) +
      renderMetaIndicators(m) +
      renderMetaMethod(m);
  }

'''

start_marker = "  // ──────────────────────────────────────────────────────────────────────\n  // Synthesis crown-jewel renderers"
end_marker = "  function sectionHtml(s, n) {"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise RuntimeError("synthesis renderer boundaries not found")
text = text[:start] + META_RENDERERS + text[end:]

BUILD_REPORT_BODY = r'''  function buildReportBody(model) {
    const m = obj(model);
    const meta = arr(m.meta).map((x) => "<span>" + esc(x.label) + ": " + esc(x.value) + "</span>").join("");
    const coverBlock =
      '<div class="mast">' + esc(m.mastline) + '</div>' +
      '<div class="rule"></div>' +
      "<h1>" + esc(m.title) + "</h1>" +
      '<p class="sub">' + esc(m.subtitle) + "</p>" +
      '<div class="meta">' + meta + "</div>" +
      '<div class="cover-score"><div class="score-line">' +
        '<div class="score-num">' + esc(m.headlineScore == null ? "—" : m.headlineScore) + "</div>" +
        '<div class="score-band">' + esc(m.headlineBand) + "</div>" +
      "</div>" + (m.coverBody ? "<p>" + esc(m.coverBody) + "</p>" : "") + "</div>";

    if (m.kind === "meta-synthesis") {
      return coverBlock + renderMetaSynthesis(m) + '<div class="footer">' + esc(m.footnote) + "</div>";
    }

    const kvs = arr(m.kvs).map((x) => '<div class="k">' + esc(x.k) + "</div><div>" + esc(x.v) + "</div>").join("");
    let n = 0;
    const secHtml =
      "<h2>1. Executive summary</h2><p>" + esc(m.execSummary) + "</p>" +
      '<div class="callout"><p><strong>Bottom line for leadership.</strong> ' + esc(m.bottomLine) + "</p></div>" +
      (kvs ? '<div class="kvs">' + kvs + "</div>" : "") +
      arr(m.sections).map((s) => sectionHtml(s, (n += 1) + 1)).join("") +
      "<h2>" + (n + 2) + ". Conclusion and next step</h2><p>This report is a directional read, not a substitute for independent review or audited analysis. Its strongest value is clarifying where the measured condition is pointing and what to address first.</p>";

    return coverBlock + secHtml + '<div class="footer">' + esc(m.footnote) + "</div>";
  }

  var REPORT_CSS ='''

replace_block(
    r'  function buildReportBody\(model\) \{.*?\n  var REPORT_CSS =',
    BUILD_REPORT_BODY,
    "buildReportBody",
)

for forbidden in (
    "function svgHeroMap",
    "function svgCascade",
    "function renderComposite",
    "function renderSampleDepth",
    "m.kind === \"synthesis\"",
):
    if forbidden in text:
        raise RuntimeError(f"obsolete active synthesis renderer remains: {forbidden}")

if "kind: \"meta-synthesis\"" not in text or "function renderMetaSynthesis" not in text:
    raise RuntimeError("new meta-synthesis report contract missing")
if text == original:
    raise RuntimeError("monderman-report.js was not changed")

PATH.write_text(text, encoding="utf-8")
print("Patched the shared report renderer for depth and cross-lens synthesis.")
