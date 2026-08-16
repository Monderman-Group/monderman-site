/* ============================================================================
   Monderman — shared executive report renderer  (classic script → window.MondermanReport)
   ----------------------------------------------------------------------------
   ONE renderer for the whole product. It turns a canonical "report model" into:
     • an on-screen executive read           MondermanReport.render(el, model)
     • a printable / PDF report (new tab)     MondermanReport.openReport(model)   (user hits Save/Print PDF)
     • a downloadable standalone HTML file    MondermanReport.downloadHtml(model)
     • a portable JSON export                 MondermanReport.downloadJson(rawResult, filenameBase)

   Two adapters feed the model so every surface honors the four Diagnostics-tab
   promises (executive PDF read · quantified score · primary signal · portable JSON):
     • MondermanReport.fromRun(runResult)         — a single diagnostic run (its full_result_json / export shape)
     • MondermanReport.fromSynthesis(synthResult) — a depth or cross-lens synthesis result (the /cross-diagnostic-synthesis payload; /cross-assessment-synthesis kept as a legacy alias)

   No dependencies. The PDF path is the browser's own print-to-PDF of the styled
   report, exactly as the original synthesis tool did it.
   ============================================================================ */
(function () {
  "use strict";

  // ---- small helpers --------------------------------------------------------
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toLocaleString("en-US") : "—";
  }
  function cur(n) {
    const x = Number(n);
    return Number.isFinite(x)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x)
      : "—";
  }
  function pct(n) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x) + "%" : "—";
  }
  function nowLabel() {
    try {
      return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function firstStr() {
    for (let i = 0; i < arguments.length; i++) {
      const s = arguments[i];
      // 8 Aug 2026: objects and arrays are skipped, never stringified. Scorer
      // results carry structured fields (trajectory, exposure) in slots this
      // helper scans, and String(object) is "[object Object]" — which is what
      // reopened workspace reports were printing in the Trajectory row.
      if (s == null || typeof s === "object") continue;
      if (String(s).trim()) return String(s).trim();
    }
    return "";
  }
  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
  }

  // ---- canonical report model ----------------------------------------------
  // {
  //   kind, mastline, title, subtitle,
  //   meta: [{label,value}], headlineScore, headlineBand, coverBody,
  //   execSummary, bottomLine,
  //   kvs: [{k,v}],
  //   sections: [{h, items:[...]}  OR  {h, paragraph:"..."}],
  //   footnote, filenameBase, source (the raw result, for JSON export)
  // }

  // ---- adapter: depth / cross-lens synthesis result --> model ---------------
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
        ? "A same-Diagnostic read across multiple eligible runs — reporting the observed median, distribution, vantage differences, and evidence limits."
        : "A multi-lens read that separates lens comparison from a coherent composite and states exactly what evidence supports each conclusion.",
      meta: [
        { label: "Generated", value: nowLabel() },
        { label: "Product", value: modeLabel },
        { label: "Runs", value: reads == null ? "—" : num(reads) },
        { label: "Lenses", value: lensCount == null ? "—" : num(lensCount) },
        { label: "Evidence", value: evidenceLabel }
      ],
      headlineScore: scorePublished ? (Number.isInteger(score) ? score : Math.round(score * 10) / 10) : "—",
      headlineBand: scorePublished ? (firstStr(r.score_label, conditionBand) + " · " + conditionBand) : "Composite withheld",
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
        ? "This report describes the submitted same-Diagnostic runs. Population generalization requires a documented sampling frame and response coverage."
        : "This report is a directional cross-lens synthesis. A published composite is not a proven causal model; source evidence and alternative explanations remain necessary.",
      filenameBase: filenameStem,
      source: r
    };
  }

  // ---- adapter: single diagnostic run --> model -----------------------------
  // Reads the run's exported result shape (full_result_json) with broad fallbacks,
  // mirroring the synthesis lib's extractor so field names line up.
  // All four scorers emit `trajectory` as an object ({direction, label, ...}).
  // Pull the human label out of it; fall back to plain direction words.
  function labelFromTrajectory(t) {
    if (!t || typeof t !== "object") return "";
    if (typeof t.label === "string" && t.label.trim()) return t.label.trim();
    const dir = String(t.direction || "").toLowerCase();
    if (dir === "up") return "Rising";
    if (dir === "down") return "Easing";
    if (dir === "flat") return "Holding steady";
    return "";
  }

  function fromRun(run) {
    const r = obj(run);
    const exposure = obj(r.exposure);
    const nar = obj(r.narrative);

    const toolType = firstStr(r.tool_type);
    const toolLabel = firstStr(r.tool_label, toolType);
    const score = r.score != null ? r.score : (r.cross_diagnostic_score != null ? r.cross_diagnostic_score : "—");
    const band = firstStr(r.band, r.score_band, r.condition_band, "—");
    const benchmark = firstStr(r.benchmark_position, r.benchmarkPosition, r.peer_position, "—");
    const trajectory = firstStr(r.trajectory_label, r.trajectory_signal, labelFromTrajectory(r.trajectory), r.trajectory, "—");
    const driver = firstStr(
      r.primary_driver, r.primary_constraint, r.primary_exposure_source,
      r.primary_burden_source, r.primary_structural_weakness, "—"
    );
    const findings = arr(r.key_findings).length ? arr(r.key_findings)
      : (arr(r.flags).length ? arr(r.flags) : arr(r.findings));
    const watch = arr(r.watch_items).length ? arr(r.watch_items) : arr(r.contradictions);
    const actions = arr(r.priority_actions).length ? arr(r.priority_actions)
      : (arr(r.intervention_priorities).length ? arr(r.intervention_priorities) : arr(r.recommendations));

    const annualHours = firstStr(exposure.annual_hours, r.annual_hours, r.annualHours, r.directionalHours);
    const annualCost = firstStr(exposure.annual_cost, r.annual_cost, r.annualCost);
    const drag = firstStr(exposure.capacity_drag_percent, r.capacity_drag_percent, r.capacityDragPercent);
    const depth = firstStr(r.diagnostic_depth, r.diagnosticDepth);

    const summary = firstStr(
      nar.executive_summary, nar.summary, r.executive_summary, r.summary,
      "This executive read summarizes the diagnostic's quantified condition, its primary structural signal, and the recommended first moves."
    );
    const bottomLine = firstStr(
      nar.leadership_implication, r.leadership_implication, driver !== "—" ? driver : "",
      "Treat this as a directional read of the measured condition."
    );

    const sections = [
      { h: "Key findings", items: findings, empty: "No specific findings were returned." },
      { h: "Watch items", items: watch, omitIfEmpty: true },
      { h: "Priority actions", items: actions, empty: "No priority actions were returned." }
    ];
    if (firstStr(nar.sequenced_action_logic)) {
      sections.push({ h: "Sequencing logic", paragraph: firstStr(nar.sequenced_action_logic) });
    }

    const kvs = [
      { k: "Primary signal", v: driver },
      { k: "Benchmark position", v: benchmark },
      { k: "Trajectory", v: trajectory }
    ];
    if (annualHours) kvs.push({ k: "Annual hours*", v: num(annualHours) });
    if (annualCost) kvs.push({ k: "Annual cost*", v: cur(annualCost) });
    if (drag) kvs.push({ k: "Capacity drag*", v: pct(drag) });
    if (depth) kvs.push({ k: "Depth", v: depth + "-minute diagnostic" });

    const metaScope = firstStr(r.business_unit, r.businessUnit, r.assessment_scope, r.pathway_name);

    return {
      kind: "run",
      mastline: "Monderman • " + (toolLabel || "Diagnostic"),
      title: (toolLabel || "Diagnostic") + " — Executive Report",
      subtitle: "A leadership read of this diagnostic: its quantified condition, primary structural signal, and recommended first moves.",
      meta: [
        { label: "Generated", value: nowLabel() },
        { label: "Instrument", value: toolLabel || "—" }
      ].concat(metaScope ? [{ label: "Scope", value: metaScope }] : []),
      headlineScore: score,
      headlineBand: band,
      coverBody: summary,
      execSummary: summary,
      bottomLine: bottomLine,
      kvs: kvs,
      sections: sections,
      footnote: "* Time, cost, and capacity figures, where shown, are directional estimates derived from this diagnostic.",
      filenameBase: slug(toolType || "diagnostic"),
      source: r
    };
  }

  // ---- the executive report HTML (body + full document) ---------------------
  // ──────────────────────────────────────────────────────────────────────
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
      '<div style="font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:1rem;font-weight:700;margin:7px 0 6px">' + esc(value || "—") + '</div>' +
      (detail ? '<p class="mr-copy">' + esc(detail) + '</p>' : '') + '</div>';
  }
  function textItem(item) {
    if (item == null) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") return firstStr(item.text, item.message, item.label);
    return String(item);
  }

  function renderMetaEvidence(m, n) {
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
    return '<section class="mr-section mr-evidence-status"><h2>' + n + '. Evidence status</h2>' +
      '<div class="callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this Synthesis is allowed to claim.") + '</p></div>' +
      '<div class="mr-lens-grid mr-evidence-grid">' + cards + '</div></section>';
  }

  function renderMetaFinding(m, n) {
    const diagnosis = obj(m.diagnosis);
    const paragraphs = arr(m.briefing?.paragraphs).map(textItem).filter(Boolean);
    return '<section class="mr-section mr-executive-synthesis"><h2>' + n + '. Executive synthesis</h2>' +
      '<div class="mr-card mr-diagnosis-block"><h3>' + esc(firstStr(diagnosis.name, m.product === "depth" ? "Observed same-Diagnostic pattern" : "Cross-Lens finding")) + '</h3>' +
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
    let svg = '<svg class="mr-synth-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Depth Synthesis score distribution" style="display:block;width:100%;height:auto;font-family:Neue Haas Grotesk,Helvetica Neue,Helvetica,Arial,sans-serif">';
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
      return renderDepthDistributionGraphic(read) + '<div class="mr-card mr-depth-stats"><h3>' + esc(read.toolLabel) + '</h3>' +
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
    let svg = '<svg class="mr-synth-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cross-Lens Diagnostic score comparison" style="display:block;width:100%;height:auto;font-family:Neue Haas Grotesk,Helvetica Neue,Helvetica,Arial,sans-serif">';
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
        '<div style="font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:2rem;font-weight:700;margin:8px 0 4px">' + esc(fmt1(lens.mean)) + '</div>' +
        '<p class="mr-copy">Mean score · median ' + esc(fmt1(lens.median)) + ' · n=' + esc(fmtWhole(lens.n)) + '</p>' +
        '<p class="mr-copy">IQR ' + esc(fmtPair(lens.iqr, fmt1)) + ' · range ' + esc(fmtPair(lens.range, fmt1)) + '</p>' +
        (lens.driver ? '<span class="mr-pill">' + esc(humanize(lens.driver)) + '</span>' : '') +
      '</div>';
    }).join("");
    const graphic = m.product === "cross_lens" ? renderCrossLensGraphic(m) : "";
    return '<section class="mr-section"><h2>' + n + '. Contributing Diagnostic lens' + (m.sourceGroups.length === 1 ? '' : 'es') + '</h2>' + graphic +
      '<div class="mr-lens-grid">' + cards + '</div></section>';
  }

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

  function renderMetaSignals(m, n) {
    const signals = arr(m.signals);
    const differences = arr(m.differences);
    if (!signals.length && !differences.length) return "";
    let html = '<section class="mr-section"><h2>' + n + '. Agreements and differences</h2>';
    const crossLensMapped = m.product === "cross_lens";
    html += renderCrossLensEvidenceMap(m);
    if (signals.length && !crossLensMapped) {
      html += '<h3 style="margin-top:14px">Recurring signals</h3>' + signals.map((signal) =>
        '<div class="mr-card mr-editorial-row mr-signal-row"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +
        (signal.tools.length ? '<div>' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') +
        (signal.limit ? '<p class="mr-copy">' + esc(signal.limit) + '</p>' : '') + '</div>'
      ).join("");
    }
    if (differences.length) {
      html += '<h3 style="margin-top:22px">Differences to keep visible</h3><ul>' + differences.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul>';
    }
    return html + '</section>';
  }

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
    return '<section class="mr-section"><h2>' + n + '. Source-backed pathway exposure</h2>' + renderExposureRangeGraphic(exp) + '<div class="kvs">' + kvs + '</div>' +
      '<div class="callout"><p><strong>Aggregation rule.</strong> ' + esc(firstStr(exp.basis, "Repeated estimates are summarized, not added together.")) + '</p></div></section>';
  }

  function renderRequirements(m, n) {
    const requirements = arr(m.requirements);
    if (!requirements.length) return "";
    return '<section class="mr-section"><h2>' + n + '. What would strengthen the read</h2>' +
      requirements.map((item) => '<div class="mr-card mr-editorial-row mr-requirement-row"><span class="mr-pill">' + esc(humanize(item.type)) + '</span><p style="margin-top:10px">' + esc(item.text) + '</p></div>').join("") + '</section>';
  }

  function renderMetaActions(m, n) {
    const actions = arr(m.actions);
    if (!actions.length) return "";
    return '<section class="mr-section"><h2>' + n + '. Evidence-proportionate actions</h2>' +
      actions.map((action, index) => '<div class="mr-card mr-editorial-row mr-action-row"><div class="mr-lens-label">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style="margin-top:8px">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join("") +
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
      entries.map(([label, value]) => '<div class="mr-card mr-editorial-row mr-vantage-row"><h3>' + esc(label) + '</h3><p>' + esc(value) + '</p></div>').join("") +
      (experience.interpretation_limit ? '<p class="mr-copy">' + esc(experience.interpretation_limit) + '</p>' : '') + '</section>';
  }

  function renderMetaIndicators(m, n) {
    const indicators = arr(m.indicators);
    if (!indicators.length) return "";
    return '<section class="mr-section"><h2>' + n + '. What to watch next</h2>' + indicators.map((indicator) =>
      '<div class="mr-card mr-editorial-row mr-indicator-row"><div class="mr-lens-label">' + esc(indicator.lens || "Measurement") + '</div><h3 style="margin-top:8px">' + esc(indicator.name) + '</h3>' +
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
    ];
    let html = "", n = 1;
    renderers.forEach((renderer) => {
      const block = renderer(m, n);
      if (block) { html += block; n += 1; }
    });
    return html;
  }

  function sectionHtml(s, n) {
  let inner;
  if (s.paragraph != null) {
    inner = "<p>" + esc(s.paragraph) + "</p>";
  } else {
    const items = arr(s.items);
    if (!items.length) {
      if (s.omitIfEmpty) return "";
      inner = "<ul><li>" + esc(s.empty || "Nothing returned.") + "</li></ul>";
    } else {
      // Defensive: items may be strings (legacy shape) or objects (new shape
      // per the cross-synth backend enhancement — {text, label, tools} for
      // convergence signals, {text, label, tier} for priority actions).
      // Coerce each item to a display string so we never render [object Object].
      const asText = (i) => {
        if (i == null) return "";
        if (typeof i === "string") return i;
        if (typeof i === "object") {
          const label = i.label ? String(i.label) : "";
          // 8 Aug 2026: contradiction objects carry their prose in `message`
          // ({code, severity, message}); without it, SC watch items rendered
          // as blank bullets.
          const text = i.text ? String(i.text) : (i.message ? String(i.message) : "");
          if (label && text) return label + " — " + text;
          return text || label || "";
        }
        return String(i);
      };
      inner = "<ul>" + items.map((i) => "<li>" + esc(asText(i)) + "</li>").join("") + "</ul>";
    }
  }
  return "<h2>" + n + ". " + esc(s.h) + "</h2>" + inner;
}

  function buildReportCover(model) {
    const m = obj(model);
    const meta = arr(m.meta);
    const productLabel = m.product === "depth" ? "Depth Synthesis" : m.product === "cross_lens" ? "Cross-Lens Synthesis" : firstStr(m.mastline).replace(/^Monderman\s*[•·]\s*/i, "") || "Diagnostic";
    const defaultScoreLabel = m.product === "depth" ? "Median Diagnostic Score" : m.product === "cross_lens" ? "Cross-Lens Composite Score" : "Diagnostic Score";
    const scoreLabel = m.kind === "meta-synthesis" ? firstStr(m.scoreLabel, defaultScoreLabel) : defaultScoreLabel;
    const evidenceLabel = m.kind === "meta-synthesis" ? firstStr(m.evidenceLabel) : "";
    const scoreBandDisplay = m.kind === "meta-synthesis" ? firstStr(m.conditionBand, m.headlineBand) : firstStr(m.headlineBand);
    const metaHtml = meta.map((x) => '<span><strong>' + esc(x.label) + '</strong>' + esc(x.value) + '</span>').join("");
    const statusPills = [
      evidenceLabel ? '<span class="mr-cover-pill mr-cover-pill-accent">' + esc(evidenceLabel) + ' evidence</span>' : ''
    ].filter(Boolean).join("");
    return '<section class="mr-cover">' +
      '<div class="mr-cover-dark"><p class="mr-cover-mark">MONDERMAN · ' + esc(productLabel) + '</p><div class="mr-cover-rule"></div>' +
      '<h1 class="mr-cover-title">' + esc(m.title) + '</h1><p class="mr-cover-sub">' + esc(m.subtitle) + '</p></div>' +
      '<div class="mr-cover-stripe"></div>' +
      '<div class="mr-cover-white"><p class="mr-cover-kicker">Executive Report</p>' +
      '<div class="mr-cover-score-row"><div class="mr-cover-score">' + esc(m.headlineScore == null ? "—" : m.headlineScore) + '</div>' +
      '<div class="mr-cover-score-copy"><div class="mr-cover-score-label">' + esc(scoreLabel) + '</div><div class="mr-cover-score-band">' + esc(scoreBandDisplay) + '</div></div></div>' +
      (statusPills ? '<div class="mr-cover-pills">' + statusPills + '</div>' : '') +
      (metaHtml ? '<div class="mr-cover-meta">' + metaHtml + '</div>' : '') +
      (m.coverBody ? '<p class="mr-cover-body">' + esc(m.coverBody) + '</p>' : '') +
      (m.kind === "meta-synthesis" && m.footnote ? '<div class="mr-cover-boundary"><div class="mr-cover-boundary-label">Interpretation boundary</div><p>' + esc(m.footnote) + '</p></div>' : '') +
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
  }

  var REPORT_CSS =
    '.mr-report{--ink:#18191C;--soft:#6E6F73;--muted:#9A9892;--accent:#0C6E78;--line:#EAE6DD;--paper:#fff;--page:#F6F3EC}' +
    '.mr-report,.mr-report *{box-sizing:border-box}' +
    '.mr-report{margin:0;background:var(--page);color:var(--ink);font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}' +
    '.mr-report .mr-page{max-width:960px;margin:0 auto;background:var(--paper);padding:48px 54px 64px;box-shadow:0 18px 48px rgba(15,23,32,.08)}' +
    '.mast{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.78rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}' +
    '.rule{height:2px;background:var(--accent);opacity:.22;margin:10px 0 28px}' +
    '.mr-report h1,.mr-report h2,.mr-report h3{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--ink);margin:0}' +
    '.mr-report h1{font-size:2.25rem;line-height:1.02;letter-spacing:-.04em}' +
    '.mr-report h2{font-size:1.28rem;line-height:1.18;letter-spacing:-.025em;margin-top:34px}' +
    '.mr-report p{font-size:1rem;line-height:1.67;margin:0 0 14px}' +
    '.mr-report .sub{color:var(--soft);max-width:42em}' +
    '.mr-report .meta{display:flex;flex-wrap:wrap;gap:10px 14px;margin:18px 0 0;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.83rem;color:var(--soft)}' +
    '.cover-score{margin-top:30px;padding:18px 0 0;border-top:1px solid var(--line)}' +
    '.score-line{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}' +
    '.score-num{font-size:4rem;line-height:.9;font-weight:700;letter-spacing:-.08em}' +
    '.mr-section{margin-top:34px}' +
    '.mr-section h2{margin-top:0}' +
    '.mr-card{border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:12px 0;background:#FCFBF8}' +
    '.mr-card h3{font-size:1rem;margin-bottom:8px}' +
    '.mr-copy{font-size:.95rem;color:var(--soft);margin:0 0 8px}' +
    '.mr-pill{display:inline-block;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:.76rem;padding:3px 10px;border:1px solid var(--line);border-radius:999px;color:var(--soft);margin:2px 4px 2px 0}' +
    '.score-band{font-size:1rem;color:var(--soft);padding-bottom:8px}' +
    '.mr-report .callout{margin:18px 0;padding:18px 20px;border-left:4px solid var(--accent);background:#F6F3EC;border-radius:0 10px 10px 0}' +
    '.mr-report .kvs{display:grid;grid-template-columns:190px 1fr;gap:8px 20px;margin:16px 0 8px}' +
    '.mr-report .kvs div{font-size:.98rem;line-height:1.65}.mr-report .kvs .k{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--muted)}' +
    '.mr-report ul{margin:8px 0 0 20px;padding:0}.mr-report li{margin:0 0 8px;line-height:1.65}' +
    '.mr-report .mr-report-boundary{margin-top:42px;padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:#FAFAF8;color:var(--soft)}' +
    '.mr-report .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}' +
    '.mr-report .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:168px;padding:0 24px;border-radius:7px;font-size:15px;font-weight:500;white-space:nowrap;background:#FFF;color:#18191C;border:1px solid rgba(24,25,28,.12);box-shadow:none;cursor:pointer}' +
    '.mr-report .btn-accent{background:#0C6E78;color:#FFF;border-color:rgba(12,110,120,.18)}' +
    '@media print{.mr-report{background:#fff}.mr-report .mr-page{box-shadow:none;max-width:none;padding:28px 32px}.mr-report .actions{display:none!important}}' +

    // ═══ Synthesis crown-jewel section styles ═══
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
    .mr-synth-chart{min-height:180px;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}
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
    @media(max-width:760px){.mr-cover-dark{padding:38px 28px 32px}.mr-cover-white{padding:28px}.mr-cover-title{font-size:2.35rem!important}.mr-cover-score{font-size:3.8rem}.mr-cover-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .mr-diag-section { margin: 24px 0 36px; }
    .mr-diag-hero { background:#F6F3EC; border:1px solid rgba(12,110,120,0.20); border-left:4px solid #0C6E78; border-radius:14px; padding:40px 44px 32px; }
    .mr-diag-eyebrow { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:0.72rem; letter-spacing:0.24em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin:0 0 14px; }
    .mr-diag-title { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:2rem; line-height:1.02; letter-spacing:-0.032em; color:#18191C; font-weight:700; margin:0 0 8px; }
    .mr-diag-type { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:0.94rem; color:#6E6F73; font-weight:500; margin:0 0 20px; }
    .mr-diag-rule { height:2px; width:40px; background:#0C6E78; margin:0 0 20px; }
    .mr-diag-body { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1.04rem; line-height:1.65; color:#18191C; margin:0 0 24px; }
    .mr-diag-meta { display:flex; flex-wrap:wrap; gap:18px 36px; padding-top:20px; border-top:1px solid rgba(12,110,120,0.16); font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; }
    .mr-diag-meta-item { font-size:0.9rem; color:#18191C; }
    .mr-diag-meta-item strong { display:block; font-size:0.68rem; letter-spacing:0.16em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin-bottom:4px; }

    .mr-briefing-section { margin:24px 0 32px; }
    .mr-briefing-block { background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #08383E; border-radius:12px; padding:32px 40px; font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; }
    .mr-briefing-lede { font-size:1.28rem; line-height:1.42; font-weight:600; color:#18191C; margin:0 0 20px; letter-spacing:-0.012em; }
    .mr-briefing-body { font-size:1rem; line-height:1.7; color:#18191C; margin:0 0 16px; }
    .mr-briefing-body:last-child { margin-bottom:0; }

    .mr-composite-section { margin:24px 0 32px; }
    .mr-viz-panel { background:#FFF; border:1px solid #EAE6DD; border-radius:14px; padding:28px 24px; margin:20px 0; }
    .mr-viz-hero { padding:28px 24px 24px; }
    .mr-viz-gauge { text-align:center; }
    .mr-viz-title { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:0.8rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#6E6F73; margin:0 0 12px; }
    .mr-lede { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1.05rem; line-height:1.55; color:#6E6F73; margin:8px 0 16px; }
    .mr-svg-gauge, .mr-svg-lensbar, .mr-svg-hero, .mr-svg-cascade, .mr-svg-timeline, .mr-svg-matrix, .mr-svg-exposure { display:block; width:100%; height:auto; max-width:100%; }
    .mr-svg-gauge { max-width:240px; margin:0 auto; }

    .mr-lenses-section { margin:24px 0 32px; }
    .mr-lens-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:16px; font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; }
    .mr-lens-card { background:#FFF; border:1px solid #EAE6DD; border-radius:10px; padding:16px 18px; }
    .mr-lens-label { font-size:0.68rem; letter-spacing:0.16em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin:0 0 6px; }
    .mr-lens-score { font-size:2rem; font-weight:700; color:#18191C; letter-spacing:-0.03em; margin:0 0 4px; }
    .mr-lens-band { font-size:0.85rem; color:#6E6F73; margin:0 0 4px; }
    .mr-lens-driver { font-size:0.85rem; color:#18191C; margin:0; }

    .mr-convergence-section { margin:24px 0 32px; }
    .mr-signal { display:grid; grid-template-columns:40px 1fr; gap:16px; margin:16px 0; padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-radius:10px; }
    .mr-signal-num { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1.5rem; font-weight:700; color:#0C6E78; letter-spacing:-0.02em; }
    .mr-signal-body p { margin:0 0 8px; font-size:0.98rem; line-height:1.65; }
    .mr-signal-tags { display:flex; flex-wrap:wrap; gap:6px 8px; margin-top:8px; }
    .mr-tag { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:0.72rem; font-weight:600; letter-spacing:0.06em; padding:2px 8px; border-radius:20px; background:rgba(12,110,120,0.08); color:#0C6E78; border:1px solid rgba(12,110,120,0.20); }

    .mr-contradictions-section { margin:24px 0 32px; }
    .mr-contradiction { padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #C9821F; border-radius:10px; margin:12px 0; }
    .mr-contradiction p { margin:0; font-size:0.98rem; line-height:1.65; }

    .mr-actions-section { margin:24px 0 32px; }
    .mr-action { display:grid; grid-template-columns:40px 1fr; gap:16px; margin:12px 0; padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #0C6E78; border-radius:10px; }
    .mr-action[data-tier="structural"] { border-left-color:#0C6E78; }
    .mr-action[data-tier="behavioral"] { border-left-color:#C9821F; }
    .mr-action[data-tier="cultural"] { border-left-color:#3C8A60; }
    .mr-action-num { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1.5rem; font-weight:700; color:#0C6E78; letter-spacing:-0.02em; }
    .mr-action[data-tier="behavioral"] .mr-action-num { color:#C9821F; }
    .mr-action[data-tier="cultural"] .mr-action-num { color:#3C8A60; }
    .mr-action-body p { margin:0 0 6px; font-size:0.98rem; line-height:1.65; }
    .mr-action-label { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:#6E6F73; font-weight:700; margin:0 0 8px !important; }
    .mr-viz-timeline { padding:20px 20px 24px; }

    .mr-experiential-section { margin:24px 0 32px; }
    .mr-experiential-section h3 { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1.05rem; font-weight:600; color:#18191C; margin:18px 0 8px; border-left:2px solid rgba(12,110,120,0.32); padding-left:14px; }

    .mr-indicators-section { margin:24px 0 32px; }
    .mr-indicators-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:16px; font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; }
    .mr-indicator-tile { background:#FFF; border:1px solid #EAE6DD; border-radius:12px; padding:18px 20px; }
    .mr-indicator-tile[data-lens="os"] { border-left:3px solid #0C6E78; }
    .mr-indicator-tile[data-lens="dv"] { border-left:3px solid #08383E; }
    .mr-indicator-tile[data-lens="sc"] { border-left:3px solid #C9821F; }
    .mr-indicator-tile[data-lens="ip"] { border-left:3px solid #3C8A60; }
    .mr-indicator-tile[data-lens="cross"] { border-left:3px solid #6E6F73; }
    .mr-indicator-lens { font-size:0.66rem; letter-spacing:0.16em; text-transform:uppercase; color:#6E6F73; font-weight:700; margin:0 0 4px; }
    .mr-indicator-name { font-size:1rem; font-weight:600; color:#18191C; margin:4px 0 6px; }
    .mr-indicator-detail { font-size:0.88rem; line-height:1.55; color:#6E6F73; margin:0 0 8px; }
    .mr-indicator-current { font-size:0.82rem; color:#18191C; margin:0; padding-top:8px; border-top:1px solid #EAE6DD; }

    .mr-leadership-section { margin:24px 0 32px; }
    .mr-leadership-section h3 { font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; font-size:1rem; font-weight:600; color:#18191C; margin:16px 0 8px; }

    .mr-confidence-section { margin:24px 0 32px; }
    .mr-confidence-panel { background:#FFF; border:1px solid #EAE6DD; border-radius:12px; padding:20px 24px; font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif; }
    .mr-confidence-row { display:grid; grid-template-columns:minmax(0,1fr) 120px 100px; gap:16px; padding:12px 4px; border-bottom:1px solid #EAE6DD; align-items:center; }
    .mr-confidence-row:last-child { border-bottom:none; }
    .mr-confidence-label { font-size:0.94rem; line-height:1.4; color:#18191C; }
    .mr-confidence-label strong { color:#0C6E78; font-weight:700; }
    .mr-confidence-bar { height:8px; border-radius:4px; }
    .mr-confidence-tier { font-size:0.7rem; letter-spacing:0.14em; font-weight:700; text-align:right; color:#6E6F73; }

    .mr-method-section { margin:24px 0 8px; }
    .mr-method-section p { font-size:0.94rem; line-height:1.65; color:#18191C; }


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
    @media (max-width:640px) {
      .mr-diag-hero { padding:32px 28px 28px; }
      .mr-diag-title { font-size:1.5rem; }
      .mr-briefing-block { padding:24px 22px; }
      .mr-briefing-lede { font-size:1.14rem; }
      .mr-lens-grid { grid-template-columns:1fr; }
      .mr-indicators-grid { grid-template-columns:1fr; }
      .mr-signal { grid-template-columns:32px 1fr; gap:12px; }
      .mr-action { grid-template-columns:32px 1fr; gap:12px; }
      .mr-confidence-row { grid-template-columns:1fr; gap:8px; }
      .mr-confidence-tier { text-align:left; }
    }
    `;

  function buildReportHtml(model) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
      "<title>Monderman | Executive Report</title><style>" + REPORT_CSS + "</style></head><body>" +
      '<div class="mr-report"><div class="mr-page">' + buildReportBody(model) +
      '<div class="actions"><button class="btn btn-accent" onclick="window.print()">Save / Print PDF</button>' +
      '<button class="btn" onclick="window.close()">Close report</button></div>' +
      "</div></div></body></html>";
  }

  // ---- artifacts + actions --------------------------------------------------
  function createArtifact(model) {
    const html = buildReportHtml(model);
    return {
      html: html,
      blob: new Blob([html], { type: "text/html;charset=utf-8" }),
      filename: "monderman-" + slug(obj(model).filenameBase) + "-executive-report.html"
    };
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function openReport(model) {
    const art = createArtifact(model);
    const url = URL.createObjectURL(art.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function downloadHtml(model) {
    const art = createArtifact(model);
    triggerDownload(art.blob, art.filename);
  }

  function downloadPdf(model) { openReport(model); } // print-to-PDF from the opened report

  function safeStringify(o) {
    const seen = new WeakSet();
    return JSON.stringify(o, function (k, v) {
      if (v && typeof v === "object") { if (seen.has(v)) return undefined; seen.add(v); }
      return v;
    }, 2);
  }

  function downloadJson(rawResult, filenameBase) {
    const data = (rawResult && rawResult.export_payload) ? rawResult.export_payload : rawResult;
    const blob = new Blob([safeStringify(data)], { type: "application/json;charset=utf-8" });
    triggerDownload(blob, "monderman-" + slug(filenameBase || "result") + ".json");
  }

  function render(el, model) {
    const node = typeof el === "string" ? document.getElementById(el) : el;
    if (!node) return;
    if (!document.getElementById("mr-style")) {
      const st = document.createElement("style");
      st.id = "mr-style"; st.textContent = REPORT_CSS;
      document.head.appendChild(st);
    }
    node.innerHTML = '<div class="mr-report"><div class="mr-page" style="box-shadow:none;margin:0;max-width:none">' + buildReportBody(model) + "</div></div>";
  }

  window.MondermanReport = {
    fromRun: fromRun,
    fromSynthesis: fromSynthesis,
    buildReportBody: buildReportBody,
    buildReportHtml: buildReportHtml,
    createArtifact: createArtifact,
    render: render,
    openReport: openReport,
    downloadHtml: downloadHtml,
    downloadPdf: downloadPdf,
    downloadJson: downloadJson
  };
})();
