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
  function sentenceLead(value, maxSentences) {
    const text = firstStr(value);
    if (!text) return "";
    const limit = Math.max(1, Number(maxSentences) || 1);
    const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
    return (sentences && sentences.length ? sentences : [text])
      .slice(0, limit).map((sentence) => sentence.trim()).filter(Boolean).join(" ");
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
        outliers: arr(read.outliers || scores.outliers),
        outlierCount: strictNum(read.outlier_count ?? scores.outlier_count),
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
    const remedyBlock = obj(r.remedy_paths);
    const remedyPaths = arr(remedyBlock.paths).map((item) => {
      const path = obj(item);
      return {
        kicker: firstStr(path.kicker),
        label: firstStr(path.label),
        summary: firstStr(path.summary),
        actions: arr(path.actions).map(firstStr).filter(Boolean),
        benefit: firstStr(path.benefit),
        risk: firstStr(path.risk),
        sourceLens: firstStr(path.source_tool_label),
        supportingRuns: strictNum(path.supporting_runs)
      };
    }).filter((item) => item.label || item.summary || item.actions.length);
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
      reads: reads,
      lensCount: lensCount,
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
      remedyPaths: remedyPaths,
      remedyStatement: firstStr(remedyBlock.statement),
      experiential: experiential,
      indicators: indicators,
      organizationalImplication: firstStr(narrative.organizational_implication, narrative.leadership_implication),
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
  // Customer reports express directional state as organizational health direction,
  // not as the direction of a negative condition. Internal scorer direction values
  // remain untouched: `up` still means more burden/drag/strain and therefore maps
  // to Worsening; `down` maps to Improving. Structural Clarity is a change-pressure
  // risk signal rather than a trend signal, so its scorer label remains explicit.
  function labelFromTrajectory(toolType, t) {
    if (!t || typeof t !== "object") return "";
    const raw = typeof t.label === "string" ? t.label.trim() : "";
    const toolKey = String(toolType || "").toLowerCase().replace(/[-\s]+/g, "_");
    if (toolKey === "structural_clarity") return raw;
    if (t.self_reported === false || t.measurement_basis === "not_measured" || t.delta === null || /not established/i.test(raw)) return "Not established";
    if (t.stated === "unsure" || /unclear/i.test(raw)) return "Direction unclear";
    const dir = String(t.direction || "").toLowerCase();
    if (dir === "up") return "Worsening";
    if (dir === "down") return "Improving";
    if (dir === "flat") return "Steady";
    return raw;
  }

  function fromRun(run) {
    const envelope = obj(run);
    const r = obj(envelope.result).tool_type ? obj(envelope.result) : envelope;
    const context = obj(envelope.input_context || r.input_context);
    const provenance = obj(envelope.provenance);
    const exposure = obj(r.exposure);
    const descriptor = obj(r.canonical_descriptor);
    const prose = obj(r.interpretive_prose);
    const summaryBlock = obj(prose.executive_summary);
    const narrative = obj(prose.harmonized_narrative || r.narrative);
    const coverage = obj(r.measurement_coverage || r.dimension_coverage);
    const insightDepth = obj(r.insight_depth);
    const dimensions = obj(r.dimensions || r.dimension_scores);
    const dimensionLabels = obj(descriptor.dimension_display || r.dimension_labels);

    const toolType = firstStr(r.tool_type);
    const toolLabel = firstStr(r.tool_label, toolType);
    const score = r.score != null ? r.score : (r.cross_diagnostic_score != null ? r.cross_diagnostic_score : "—");
    const band = firstStr(r.band, r.score_band, r.condition_band, "—");
    const benchmark = firstStr(r.benchmark_position, r.benchmarkPosition, r.peer_position, "—");
    const trajectory = firstStr(labelFromTrajectory(toolType, r.trajectory), r.trajectory_label, r.trajectory_signal, r.trajectory, "—");
    const driver = firstStr(
      r.primary_driver, r.primary_constraint, r.primary_exposure_source,
      r.primary_burden_source, r.primary_structural_weakness, "—"
    );
    const findings = arr(r.key_findings).length ? arr(r.key_findings)
      : (arr(r.flags).length ? arr(r.flags) : arr(r.findings));
    const watch = arr(r.watch_items).length ? arr(r.watch_items) : arr(r.contradictions);
    const actions = arr(prose.priority_actions).length ? arr(prose.priority_actions)
      : (arr(r.priority_actions).length ? arr(r.priority_actions)
        : (arr(r.intervention_priorities).length ? arr(r.intervention_priorities) : arr(r.recommendations)));
    const priorityLadder = arr(descriptor.priority_ladder).length ? arr(descriptor.priority_ladder) : arr(r.priority_ladder);
    const remedyPaths = arr(prose.remedy_paths).length ? arr(prose.remedy_paths) : arr(r.remedy_paths);
    const participantEvidence = arr(r.participant_evidence);

    const annualHours = firstStr(exposure.annual_hours, r.annual_hours, r.annualHours, r.directionalHours);
    const annualCost = firstStr(exposure.annual_cost, r.annual_cost, r.annualCost);
    const drag = firstStr(exposure.capacity_drag_percent, r.capacity_drag_percent, r.capacityDragPercent);
    const depth = firstStr(r.diagnostic_depth, r.diagnosticDepth);

    const summary = firstStr(
      summaryBlock.body, narrative.executive, narrative.headlineFinding,
      r.executive_summary, r.summary,
      "This executive read summarizes the diagnostic's quantified condition, its primary structural signal, and the recommended first moves."
    );
    const headline = firstStr(summaryBlock.headline, narrative.headlineFinding, r.score_band_note, summary);
    const bottomLine = sentenceLead(firstStr(
      narrative.opportunity, narrative.organizational_implication, r.organizational_implication,
      narrative.leadership_implication, r.leadership_implication, driver !== "—" ? driver : "",
      "Treat this as a directional read of the measured condition."
    ), 2);

    const sections = [
      { h: "Key findings", items: findings, empty: "No specific findings were returned." },
      { h: "Watch items", items: watch, omitIfEmpty: true },
      { h: "Priority actions", items: actions, empty: "No priority actions were returned." }
    ];
    if (firstStr(narrative.sequenced_action_logic)) {
      sections.push({ h: "Sequencing logic", paragraph: firstStr(narrative.sequenced_action_logic) });
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

    const metaScope = firstStr(
      context.functionName, context.businessUnit, context.business_unit,
      r.business_unit, r.businessUnit, r.assessment_scope, r.pathway_name
    );
    const processName = firstStr(
      context.processName, context.process_name, context.pathwayName,
      r.process_name, r.processName, r.pathway_name, metaScope
    );
    const participantMode = humanize(firstStr(r.participant_mode, context.participantMode, context.participant_mode, "managerial"));
    const dimensionEntries = Object.keys(dimensions).map((key) => ({
      key: key,
      label: firstStr(dimensionLabels[key], humanize(key)),
      score: strictFinite(dimensions[key]) ? Number(dimensions[key]) : null,
      coverage: obj(obj(coverage.dimensions)[key])
    })).filter((item) => item.score !== null);
    const primarySignal = firstStr(
      descriptor.primary_constraint_label, descriptor.dominant_burden_label,
      r.primary_driver, r.primary_constraint, driver
    );
    const trajectoryObject = obj(r.trajectory);
    const evidenceBand = firstStr(insightDepth.band, r.input_confidence_label, context.confidenceLevel, "Directional single-run evidence")
      .replace(/\s+-\s+/g, ", ");
    const opportunity = firstStr(summaryBlock.opportunity, narrative.opportunity);
    const benchmarkDetail = firstStr(prose.benchmark_interpretation, narrative.benchmark, benchmark);
    const tradeoff = firstStr(narrative.tradeoff, r.score_band_note);
    const firstMove = firstStr(textItem(actions[0]));
    const findingScope = firstStr(processName, metaScope, "the assessed operating scope");
    const findingScopeWithArticle = /^[a-z]/.test(findingScope) && !/^(?:the|this|that)\b/i.test(findingScope)
      ? "the " + findingScope : findingScope;
    const centralFinding = primarySignal && primarySignal !== "—"
      ? primarySignal + " is the clearest measured constraint in " + findingScopeWithArticle + "."
      : sentenceLead(headline, 1);

    return {
      kind: "run",
      product: "diagnostic",
      mastline: "Monderman • " + (toolLabel || "Diagnostic"),
      title: (toolLabel || "Diagnostic") + " — Executive Report",
      subtitle: "An organizational read of this diagnostic: its quantified condition, primary structural signal, and recommended first moves.",
      meta: [
        { label: "Generated", value: nowLabel() },
        { label: "Instrument", value: toolLabel || "—" }
      ].concat(metaScope ? [{ label: "Scope", value: metaScope }] : []),
      headlineScore: score,
      headlineBand: band,
      coverBody: centralFinding,
      headline: centralFinding,
      sourceHeadline: headline,
      execSummary: sentenceLead(summary, 2),
      fullExecSummary: summary,
      bottomLine: bottomLine,
      opportunity: opportunity,
      firstMove: firstMove,
      score: strictFinite(score) ? Number(score) : null,
      band: band,
      toolType: toolType,
      toolLabel: toolLabel,
      context: context,
      processName: processName,
      scopeLabel: metaScope,
      participantMode: participantMode,
      evidenceBand: evidenceBand,
      descriptor: descriptor,
      prose: prose,
      narrative: narrative,
      exposure: exposure,
      coverage: coverage,
      insightDepth: insightDepth,
      trajectoryObject: trajectoryObject,
      trajectoryLabel: trajectory,
      trajectoryNote: firstStr(descriptor.trajectory_note, trajectoryObject.note),
      benchmarkDetail: benchmarkDetail,
      tradeoff: tradeoff,
      quadrant: firstStr(r.quadrant_interpretation_text),
      primarySignal: primarySignal,
      primarySignalNote: firstStr(descriptor.primary_constraint_note, descriptor.dominant_burden_note),
      dimensionEntries: dimensionEntries,
      priorityLadder: priorityLadder,
      remedyPaths: remedyPaths,
      participantEvidence: participantEvidence,
      findings: findings,
      watch: watch,
      actions: actions,
      provenance: provenance,
      kvs: kvs,
      sections: sections,
      footnote: "This is one bounded Diagnostic run. It supports a directional operating read and an action hypothesis; it does not establish prevalence, population representativeness, causation, or verified returned capacity. Time, cost, and capacity figures, where shown, are directional scenario estimates.",
      filenameBase: slug(toolType || "diagnostic"),
      source: obj(envelope.result).tool_type ? envelope : r
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

  function renderExecutiveDecisionFrame(m, n) {
    const exp = obj(m.exposure);
    const diagnosis = obj(m.diagnosis);
    const firstAction = arr(m.actions)[0] || {};
    const annualCost = strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Not priceable";
    const annualHours = strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " hrs" : "Not priceable";
    const scoreValue = m.scorePublished && strictFinite(m.score) ? fmt1(m.score) : "Withheld";
    const metrics = [
      ["Condition", scoreValue, m.product === "depth" ? "Observed median" : "Equal-lens composite"],
      ["Evidence", firstStr(m.evidenceLabel, "Unavailable"), "Claim strength"],
      ["Included runs", strictFinite(m.reads) ? fmtWhole(m.reads) : "—", m.product === "depth" ? "One Diagnostic" : fmtWhole(m.lensCount) + " Diagnostics"],
      ["Annual exposure", annualCost, annualHours]
    ].map((item) => '<div class="mr-decision-metric"><div class="mr-lens-label">' + esc(item[0]) + '</div><div class="mr-decision-value">' + esc(item[1]) + '</div><div class="mr-copy">' + esc(item[2]) + '</div></div>').join("");
    const finding = firstStr(diagnosis.body, m.primaryPattern, m.briefing?.lede);
    const actionText = firstStr(firstAction.text);
    const actionLabel = firstStr(firstAction.label, "First evidence-proportionate move");
    return '<section class="mr-section mr-decision-section"><h2>' + n + '. Executive decision frame</h2>' +
      '<p class="mr-lede">The decision frame brings the condition, evidence strength, observed exposure, and first supported move into one view. The detailed sections below preserve the underlying distributions, differences, and limits.</p>' +
      '<div class="mr-decision-frame">' + metrics + '</div>' +
      '<div class="mr-decision-story">' +
        (finding ? '<div><div class="mr-lens-label">What the evidence says</div><p>' + esc(finding) + '</p></div>' : '') +
        (actionText ? '<div><div class="mr-lens-label">First supported move</div><h3>' + esc(actionLabel) + '</h3><p>' + esc(actionText) + '</p></div>' : '') +
      '</div></section>';
  }

  function renderEvidenceLadder(m) {
    const labels = m.product === "depth"
      ? ["Minimal", "Developing", "Substantial", "Large"]
      : ["Comparison", "Directional", "Coherent", "Strong"];
    const active = String(m.evidenceLabel || "").toLowerCase();
    const steps = labels.map((label) => {
      const selected = active.includes(label.toLowerCase()) || (label === "Comparison" && active.includes("comparison only"));
      return '<div class="mr-evidence-step' + (selected ? ' is-active' : '') + '"><span></span><b>' + esc(label) + '</b></div>';
    }).join("");
    const note = m.product === "depth"
      ? "Observed-set size strengthens the same-Diagnostic read; it does not by itself establish population representativeness."
      : "The evidence gate controls whether a Composite Score may be published. Comparison remains available below that threshold.";
    return '<div class="mr-evidence-ladder" aria-label="Evidence strength ladder">' + steps + '</div><p class="mr-copy">' + esc(note) + '</p>';
  }

  function renderMetaEvidence(m, n) {
    const scope = obj(m.scope), versions = obj(m.versions), identity = obj(m.sourceIdentity);
    const timeWindow = obj(m.timeWindow), balance = obj(m.lensBalance), representative = obj(m.representativeness);
    const cards = [
      evidenceCard("Evidence strength", m.evidenceLabel, m.evidenceDescription),
      evidenceCard(
        m.product === "depth" ? "Median Diagnostic Score" : (m.scorePublished ? "Cross-Lens Composite Score" : "Cross-Lens Composite Score Withheld"),
        m.scorePublished ? "Published" : "Withheld",
        m.scoreBasis
      ),
      evidenceCard("Scope", firstStr(scope.label, humanize(scope.status)), firstStr(scope.statement)),
      evidenceCard("Lens balance", firstStr(humanize(balance.status), "Not applicable"), strictFinite(balance.ratio) ? "Strongest-to-weakest lens ratio: " + fmt1(balance.ratio) + ":1" : "Not applicable to one-Diagnostic Depth Synthesis."),
      evidenceCard("Diagnostic/scorer versions", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? "Conflicting Diagnostics: " + versions.conflicting_lenses.map(humanize).join(", ") : ""),
      evidenceCard("Source identity", humanize(identity.status), firstStr(identity.statement)),
      evidenceCard("Measurement window", humanize(timeWindow.status), firstStr(timeWindow.statement)),
      evidenceCard("Representativeness", firstStr(representative.label, humanize(representative.status)), firstStr(representative.statement))
    ].filter(Boolean).join("");
    return '<section class="mr-section mr-evidence-status"><h2>' + n + '. Evidence status</h2>' +
      '<div class="callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this Synthesis is allowed to claim.") + '</p></div>' +
      renderEvidenceLadder(m) +
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
      const outlierRead = strictFinite(read.outlierCount) ? fmtWhole(read.outlierCount) + " classified" : (read.outliers.length ? fmtWhole(read.outliers.length) + " supplied" : "Not classified from aggregate source data");
      return '<div class="mr-card mr-depth-stats"><h3>' + esc(read.toolLabel) + '</h3>' +
        '<div class="kvs">' +
          '<div class="k">Eligible runs</div><div>' + esc(fmtWhole(read.n)) + '</div>' +
          '<div class="k">Median score</div><div>' + esc(fmt1(read.median)) + '</div>' +
          '<div class="k">Mean score</div><div>' + esc(fmt1(read.mean)) + '</div>' +
          '<div class="k">Observed range</div><div>' + esc(fmt1(read.min)) + ' – ' + esc(fmt1(read.max)) + '</div>' +
          '<div class="k">Interquartile range</div><div>' + esc(fmtPair(read.iqr, fmt1)) + '</div>' +
          '<div class="k">Sample standard deviation</div><div>' + esc(fmt1(read.sd)) + '</div>' +
          '<div class="k">Outlier status</div><div>' + esc(outlierRead) + '</div>' +
        '</div>' +
        (consensus.detail ? '<div class="callout"><p><strong>' + esc(humanize(consensus.read)) + '.</strong> ' + esc(consensus.detail) + '</p></div>' : '') +
        (segments ? '<h3 style="margin-top:20px">Observed vantage segments</h3><div class="kvs">' + segments + '</div>' : '') +
        (read.vantageGap?.statement ? '<p class="mr-copy"><strong>Vantage difference:</strong> ' + esc(read.vantageGap.statement) + '</p>' : '') +
        (read.interpretationLimit ? '<p class="mr-copy">' + esc(read.interpretationLimit) + '</p>' : '') +
      '</div>';
    }).join("");
    return '<section class="mr-section mr-depth-detail"><h2>' + n + '. Agreement, divergence, and coverage</h2>' + cards + '</section>';
  }

  function renderDepthSystemRead(m, n) {
    if (m.product !== "depth" || !arr(m.sampleReads).length) return "";
    const read = m.sampleReads[0];
    const gap = obj(read.vantageGap);
    const meanMedianGap = strictFinite(read.mean) && strictFinite(read.median) ? Math.abs(Number(read.mean) - Number(read.median)) : null;
    const diagnosis = obj(m.diagnosis);
    return '<section class="mr-section mr-depth-system-read"><div class="mr-section-index">0' + n + ' · Depth read</div><h2>' + esc(firstStr(diagnosis.name, "The median and the pattern around it")) + '</h2>' +
      '<p class="mr-exec-lede">' + esc(firstStr(diagnosis.body, m.primaryPattern, m.briefing?.lede)) + '</p>' + renderDepthDistributionGraphic(read) +
      '<div class="mr-depth-metrics">' +
        runMetric("Median Diagnostic Score", fmt1(read.median), firstStr(read.observedBand, m.conditionBand), "teal") +
        runMetric("Interquartile range", fmtPair(read.iqr, fmt1), "Middle 50% of eligible runs", "ink") +
        runMetric("Perspective difference", strictFinite(gap.gap) ? fmt1(gap.gap) + " pts" : "Not established", strictFinite(gap.gap) ? humanize(gap.low_segment) + " to " + humanize(gap.high_segment) : "No published vantage gap", "amber") +
        runMetric("Coverage", strictFinite(read.n) ? fmtWhole(read.n) + " runs" : fmtWhole(m.reads) + " runs", m.evidenceLabel, "green") +
      '</div><div class="mr-depth-reading-grid"><div><div class="mr-lens-label">Agreement versus divergence</div><p>' + esc(firstStr(obj(read.consensus).detail, "The distribution should be read with its spread and perspective segments, not as a uniform participant experience.")) + '</p></div>' +
      '<div><div class="mr-lens-label">Center stability</div><strong>' + esc(strictFinite(meanMedianGap) ? fmt1(meanMedianGap) + " pt mean–median gap" : "Not calculable") + '</strong><p>' + esc(strictFinite(meanMedianGap) && meanMedianGap <= 2 ? "The mean and median are closely aligned in the submitted set." : "The difference between mean and median should remain visible when interpreting the center.") + '</p></div></div></section>';
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

  function splitSvgLabel(label) {
    const words = String(label || "Diagnostic").split(/\s+/);
    if (words.length < 2) return [words[0] || "Diagnostic", ""];
    let first = "", second = "";
    words.forEach((word) => {
      if (!second && (first + " " + word).trim().length <= 13) first = (first + " " + word).trim();
      else second = (second + " " + word).trim();
    });
    return [first, second];
  }

  function renderCrossLensSystemGraphic(m) {
    const groups = arr(m.sourceGroups).filter((lens) => strictFinite(lens.mean)).slice(0, 4);
    if (!groups.length) return "";
    const positions = [[118, 92], [602, 92], [118, 288], [602, 288]];
    const centerX = 360, centerY = 190;
    const compositeAccessibleLabel = m.scorePublished ? "EQUAL-LENS COMPOSITE" : "COMPOSITE WITHHELD";
    const compositeLabel = m.scorePublished ? ["EQUAL-LENS", "COMPOSITE"] : ["COMPOSITE", "WITHHELD"];
    let svg = '<svg class="mr-system-map" viewBox="0 0 720 390" role="img" aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score">';
    svg += '<desc>Center label: ' + esc(compositeAccessibleLabel) + '</desc>';
    svg += '<defs><linearGradient id="mr-system-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0C6E78"/><stop offset="1" stop-color="#08383E"/></linearGradient></defs>';
    groups.forEach((lens, index) => {
      const point = positions[index];
      svg += '<path d="M' + point[0] + ' ' + point[1] + ' L' + centerX + ' ' + centerY + '" stroke="rgba(12,110,120,.26)" stroke-width="2" fill="none"/>';
    });
    svg += '<circle cx="' + centerX + '" cy="' + centerY + '" r="76" fill="url(#mr-system-gradient)"/>';
    svg += '<circle cx="' + centerX + '" cy="' + centerY + '" r="83" fill="none" stroke="rgba(12,110,120,.16)" stroke-width="2"/>';
    svg += '<text x="' + centerX + '" y="' + (centerY - 23) + '" text-anchor="middle" fill="#A9CED1" font-size="10" font-weight="700" letter-spacing="1.6">CROSS-LENS</text>';
    svg += '<text x="' + centerX + '" y="' + (centerY + 15) + '" text-anchor="middle" fill="#FFF" font-size="38" font-weight="700" letter-spacing="-2">' + esc(m.scorePublished ? fmt1(m.score) : "—") + '</text>';
    svg += '<text class="mr-system-composite-label" x="' + centerX + '" y="' + (centerY + 35) + '" text-anchor="middle" fill="#A9CED1" font-size="9.5" font-weight="700" letter-spacing=".55">';
    compositeLabel.forEach((line, index) => {
      svg += '<tspan x="' + centerX + '" dy="' + (index ? 13 : 0) + '">' + esc(line) + '</tspan>';
    });
    svg += '</text>';
    groups.forEach((lens, index) => {
      const point = positions[index], label = splitSvgLabel(lens.toolLabel);
      const x = point[0] - 96, y = point[1] - 43;
      svg += '<rect x="' + x + '" y="' + y + '" width="192" height="86" rx="11" fill="#FFF" stroke="#DCD8CF"/>';
      svg += '<rect x="' + x + '" y="' + y + '" width="4" height="86" rx="2" fill="#0C6E78"/>';
      svg += '<text x="' + (x + 18) + '" y="' + (y + 24) + '" fill="#6E6F73" font-size="10" font-weight="700" letter-spacing=".7">' + esc(label[0].toUpperCase()) + '</text>';
      if (label[1]) svg += '<text x="' + (x + 18) + '" y="' + (y + 38) + '" fill="#6E6F73" font-size="10" font-weight="700" letter-spacing=".7">' + esc(label[1].toUpperCase()) + '</text>';
      svg += '<text x="' + (x + 18) + '" y="' + (y + 69) + '" fill="#18191C" font-size="25" font-weight="700">' + esc(fmt1(lens.mean)) + '</text>';
      svg += '<text x="' + (x + 70) + '" y="' + (y + 68) + '" fill="#9A9892" font-size="10">mean · n=' + esc(fmtWhole(lens.n)) + '</text>';
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel mr-system-panel"><div class="mr-viz-title">The operating system in one view</div>' + svg + '<p class="mr-copy">Every Diagnostic receives one vote in the center Composite; participant volume changes evidence strength, not lens weight. Connectors show composition, not causation.</p></div>';
  }

  function renderCrossLensInteractionMatrix(m) {
    const groups = arr(m.sourceGroups).slice(0, 4);
    const signals = arr(m.signals).filter((signal) => arr(signal.tools).length).slice(0, 5);
    if (!groups.length || !signals.length) return "";
    const header = '<div class="mr-interaction-label"></div>' + groups.map((group) => '<div class="mr-interaction-head">' + esc(group.toolLabel.replace(/\s+/g, " ")) + '</div>').join("");
    const rows = signals.map((signal) => {
      const tools = arr(signal.tools).map((tool) => String(tool).toLowerCase().replace(/[-\s]+/g, "_"));
      return '<div class="mr-interaction-label"><strong>' + esc(signal.label) + '</strong><span>' + esc(signal.text) + '</span></div>' + groups.map((group) => {
        const key = String(group.toolType || group.toolLabel).toLowerCase().replace(/[-\s]+/g, "_");
        const active = tools.includes(key) || tools.some((tool) => key.includes(tool) || tool.includes(key));
        return '<div class="mr-interaction-cell"><i class="' + (active ? "is-active" : "") + '"></i><span class="sr-only">' + (active ? "Included" : "Not included") + '</span></div>';
      }).join("");
    }).join("");
    const compounding = signals.filter((signal) => arr(signal.tools).length >= 2).slice(0, 3);
    return '<div class="mr-viz-panel mr-interaction-panel"><div class="mr-viz-title">Lens interaction evidence</div><div class="mr-interaction-grid" style="--lens-count:' + groups.length + '">' + header + rows + '</div>' +
      (compounding.length ? '<div class="mr-compounding-read"><div class="mr-lens-label">Compounding constraints to investigate</div>' + compounding.map((signal) => '<p><strong>' + esc(signal.label) + '.</strong> ' + esc(signal.text) + '</p>').join("") + '</div>' : '') +
      '<p class="mr-copy">Filled marks show which Diagnostic evidence participates in each recurring signal. Co-occurrence supports a systems hypothesis; it does not establish a causal chain.</p></div>';
  }

  function renderCrossLensSystemRead(m, n) {
    if (m.product !== "cross_lens") return "";
    const groups = arr(m.sourceGroups).filter((lens) => strictFinite(lens.mean));
    const values = groups.map((lens) => Number(lens.mean));
    const highest = groups.reduce((best, lens) => !best || Number(lens.mean) > Number(best.mean) ? lens : best, null);
    const lowest = groups.reduce((best, lens) => !best || Number(lens.mean) < Number(best.mean) ? lens : best, null);
    const spread = values.length ? Math.max.apply(null, values) - Math.min.apply(null, values) : null;
    const exp = obj(m.exposure), firstAction = arr(m.actions)[0] || {};
    return '<section class="mr-section mr-system-read"><div class="mr-section-index">0' + n + ' · System read</div><h2>' + esc(firstStr(obj(m.diagnosis).name, "Cross-Lens operating pattern")) + '</h2>' +
      '<p class="mr-exec-lede">' + esc(firstStr(obj(m.diagnosis).body, m.primaryPattern, m.briefing?.lede)) + '</p>' + renderCrossLensSystemGraphic(m) + renderCrossLensInteractionMatrix(m) +
      '<div class="mr-system-metrics">' +
        runMetric("Composite condition", m.scorePublished ? fmt1(m.score) : "Withheld", firstStr(m.conditionBand, m.scoreBasis), "teal") +
        runMetric("Strongest observed lens", highest ? highest.toolLabel : "—", highest ? fmt1(highest.mean) + " mean" : "", "green") +
        runMetric("Weakest observed lens", lowest ? lowest.toolLabel : "—", lowest ? fmt1(lowest.mean) + " mean" : "", "amber") +
        runMetric("Observed spread", strictFinite(spread) ? fmt1(spread) + " pts" : "—", m.evidenceLabel, "ink") +
      '</div><div class="mr-system-decision">' +
        (firstAction.text ? '<div><div class="mr-lens-label">First evidence-proportionate move</div><h3>' + esc(firstStr(firstAction.label, "First supported move")) + '</h3><p>' + esc(firstAction.text) + '</p></div>' : '') +
        '<div><div class="mr-lens-label">Source-backed exposure</div><strong>' + esc(strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Not priceable") + '</strong><p>' + esc(strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " median annual burden hours" : "Exposure is withheld or unavailable for the submitted runs.") + '</p></div>' +
      '</div></section>';
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
    const path = '<div class="mr-action-path" aria-label="Evidence-proportionate action sequence">' + actions.slice(0, 4).map((action, index) =>
      '<div class="mr-action-step" data-tier="' + esc(action.tier || "structural") + '"><div class="mr-action-step-num">' + (index + 1) + '</div><div><div class="mr-lens-label">' + esc(humanize(action.tier || "action")) + '</div><strong>' + esc(action.label) + '</strong></div></div>'
    ).join("") + '</div>';
    return '<section class="mr-section"><h2>' + n + '. Evidence-proportionate actions</h2>' + path +
      actions.map((action, index) => '<div class="mr-card mr-editorial-row mr-action-row"><div class="mr-lens-label">Step ' + (index + 1) + (action.tier ? ' · ' + esc(humanize(action.tier)) : '') + '</div><h3 style="margin-top:8px">' + esc(action.label) + '</h3><p>' + esc(action.text) + '</p></div>').join("") +
      (m.sequencingLogic ? '<div class="callout"><p><strong>Sequencing logic.</strong> ' + esc(m.sequencingLogic) + '</p></div>' : '') + '</section>';
  }

  function renderMetaRemedyPaths(m, n) {
    const paths = arr(m.remedyPaths);
    if (!paths.length) return "";
    const evidenceBasis = (path) => {
      const parts = [];
      if (path.sourceLens) parts.push(path.sourceLens);
      if (strictFinite(path.supportingRuns)) parts.push(fmtWhole(path.supportingRuns) + " supporting runs");
      if (!parts.length) parts.push(m.product === "depth" ? "Eligible same-Diagnostic evidence" : "Contributing Diagnostic remedy paths");
      return parts.join(" · ");
    };
    return '<section class="mr-section"><h2>' + n + '. Source-backed remedy paths</h2>' +
      (m.remedyStatement ? '<p class="mr-copy">' + esc(m.remedyStatement) + '</p>' : '') +
      '<div class="mr-remedy-grid">' + paths.map((path, index) =>
        '<div class="mr-card mr-remedy-card">' +
          '<div class="mr-remedy-head"><span class="mr-remedy-number">0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(path.kicker || path.sourceLens || "Candidate path") + '</div>' +
          '<h3>' + esc(path.label || "Remedy path") + '</h3>' +
          '</div></div>' +
          (path.summary ? '<p>' + esc(path.summary) + '</p>' : '') +
          (path.actions.length ? '<div class="mr-remedy-actions"><div class="mr-remedy-field-label">Recommended actions</div><ol>' + path.actions.map((action) => '<li>' + esc(action) + '</li>').join("") + '</ol></div>' : '') +
          '<div class="mr-remedy-tradeoffs">' +
            (path.benefit ? '<div><div class="mr-remedy-field-label">Potential benefit</div><p>' + esc(path.benefit) + '</p></div>' : '') +
            (path.risk ? '<div><div class="mr-remedy-field-label">Tradeoff</div><p>' + esc(path.risk) + '</p></div>' : '') +
          '</div>' +
          '<div class="mr-remedy-evidence"><span>Evidence basis</span><strong>' + esc(evidenceBasis(path)) + '</strong></div>' +
        '</div>'
      ).join("") + '</div></section>';
  }

  function renderMetaExperience(m, n) {
    const experience = obj(m.experiential);
    const entries = [
      ["Operational", firstStr(experience.operational, experience.operational_staff)],
      ["Managerial", firstStr(experience.managerial, experience.managers)],
      ["Senior Leader", firstStr(experience.senior_leader, experience.senior_leaders)]
    ].filter(([, value]) => value);
    if (!entries.length && !experience.interpretation_limit) return "";
    const heading = experience.participant_reports_available ? "What participants reported" : "Vantage evidence";
    return '<section class="mr-section"><h2>' + n + '. ' + heading + '</h2>' +
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
      (m.organizationalImplication ? '<div class="callout"><p><strong>Organizational implication.</strong> ' + esc(m.organizationalImplication) + '</p></div>' : '') + '</section>';
  }

  function renderMetaSynthesis(m) {
    const renderers = m.product === "cross_lens" ? [
      renderCrossLensSystemRead,
      renderLensSummary,
      renderMetaFinding,
      renderMetaSignals,
      renderMetaExposure,
      renderMetaActions,
      renderMetaRemedyPaths,
      renderMetaExperience,
      renderMetaIndicators,
      renderMetaEvidence,
      renderRequirements,
      renderMetaMethod
    ] : [
      renderDepthSystemRead,
      renderDepthDistribution,
      renderMetaFinding,
      renderMetaSignals,
      renderMetaExposure,
      renderMetaActions,
      renderMetaRemedyPaths,
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

  // ──────────────────────────────────────────────────────────────────────
  // Single-Diagnostic report. This uses only fields already returned by the
  // scorer; presentation never manufactures evidence, benchmarks, or claims.
  // ──────────────────────────────────────────────────────────────────────
  function runMetric(label, value, detail, tone) {
    return '<div class="mr-run-metric" data-tone="' + esc(tone || "teal") + '"><div class="mr-lens-label">' + esc(label) + '</div>' +
      '<div class="mr-run-metric-value">' + esc(value || "—") + '</div>' +
      (detail ? '<p class="mr-copy">' + esc(detail) + '</p>' : '') + '</div>';
  }

  function renderRunDecisionBrief(m, n) {
    const exp = obj(m.exposure);
    const score = strictFinite(m.score) ? fmt1(m.score) : "—";
    const hours = strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " hrs" : "Not priceable";
    const cost = strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Not priceable";
    const drag = strictFinite(exp.capacity_drag_percent) ? fmtPercent(exp.capacity_drag_percent) : "Not estimated";
    return '<section class="mr-section mr-run-decision"><div class="mr-section-index">0' + n + ' · Executive decision brief</div>' +
      '<div class="mr-run-headline"><div><h2>' + esc(m.headline || "Measured operating condition") + '</h2><p class="mr-exec-lede">' + esc(m.execSummary) + '</p></div>' +
      '<div class="mr-run-score-stamp"><span>Diagnostic score</span><strong>' + esc(score) + '</strong><em>' + esc(m.band) + '</em></div></div>' +
      '<div class="mr-run-metrics">' +
        runMetric("Primary measured focus", m.primarySignal, m.primarySignalNote, "teal") +
        runMetric("Annual burden", hours, cost + " directional labor exposure", "ink") +
        runMetric("Capacity equivalent", drag, strictFinite(exp.total_capacity_hours) ? fmtWhole(exp.total_capacity_hours) + " disclosed annual capacity hours" : "Scenario estimate", "amber") +
        runMetric("Evidence depth", m.evidenceBand, m.participantMode + " perspective", "green") +
      '</div>' +
      '<div class="mr-run-decision-story">' +
        '<div><div class="mr-lens-label">Leadership implication</div><p>' + esc(m.bottomLine) + '</p></div>' +
        (m.firstMove ? '<div><div class="mr-lens-label">First supported move</div><p>' + esc(m.firstMove) + '</p></div>' : '') +
      '</div></section>';
  }

  function renderConstraintConcentration(m) {
    const composition = obj(obj(m.descriptor).composition);
    const segments = arr(composition.segments).filter((segment) => strictFinite(obj(segment).pct)).slice(0, 8);
    if (!segments.length) return "";
    const palette = ["#08383E", "#0C6E78", "#3E8A92", "#7FB0B6", "#A9CED1", "#C9DCDE", "#DDE8E9", "#EAE6DD"];
    const bar = segments.map((segment, index) => '<span style="width:' + Math.max(0, Math.min(100, Number(segment.pct))).toFixed(2) + '%;background:' + palette[index % palette.length] + '" title="' + esc(firstStr(segment.label, humanize(segment.key)) + ": " + fmt1(segment.pct) + "% of measured constraint") + '"></span>').join("");
    const legend = segments.map((segment, index) => '<div><i style="background:' + palette[index % palette.length] + '"></i><span>' + esc(firstStr(segment.label, humanize(segment.key))) + '</span><strong>' + esc(fmt1(segment.pct)) + '%</strong></div>').join("");
    const primary = obj(composition.primary);
    return '<div class="mr-constraint-view"><div class="mr-viz-title">Constraint concentration</div><div class="mr-constraint-bar" role="img" aria-label="Measured constraint composition by dimension">' + bar + '</div>' +
      '<div class="mr-constraint-legend">' + legend + '</div><div class="mr-constraint-read"><div><div class="mr-lens-label">Profile shape</div><strong>' + esc(humanize(firstStr(composition.shape, obj(m.descriptor).burden_distribution_type, "Not classified"))) + '</strong></div>' +
      '<p>' + esc(firstStr(obj(m.descriptor).dominant_burden_note, primary.label ? primary.label + " carries the largest measured share of the constraint profile." : "The chart shows how the measured constraint is distributed across dimensions.")) + '</p></div></div>';
  }

  function renderRunDimensions(m, n) {
    const dimensions = arr(m.dimensionEntries);
    if (!dimensions.length) return "";
    const rows = dimensions.map((dimension) => {
      const score = Math.max(0, Math.min(100, Number(dimension.score)));
      const evidenceCount = strictFinite(dimension.coverage.evidence_count) ? fmtWhole(dimension.coverage.evidence_count) + " scored inputs" : "Measured dimension";
      const isPrimary = String(dimension.label).toLowerCase() === String(m.primarySignal).toLowerCase();
      return '<div class="mr-dimension-row' + (isPrimary ? ' is-primary' : '') + '">' +
        '<div class="mr-dimension-copy"><strong>' + esc(dimension.label) + '</strong><span>' + esc(fmt1(score)) + '</span></div>' +
        '<div class="mr-dimension-track" role="img" aria-label="' + esc(dimension.label + " score " + fmt1(score) + " of 100") + '"><span style="width:' + score.toFixed(2) + '%"></span><i style="left:' + score.toFixed(2) + '%"></i></div>' +
        '<div class="mr-dimension-detail">' + esc(evidenceCount) + (isPrimary ? '<b>Primary measured focus</b>' : '') + '</div></div>';
    }).join("");
    const findings = arr(m.findings).map(textItem).filter(Boolean);
    return '<section class="mr-section mr-run-dimensions"><div class="mr-section-index">0' + n + ' · Measured condition</div>' +
      '<h2>Dimension profile</h2><p class="mr-lede">The profile keeps the total score and its contributing dimensions visible together. Lower values indicate the areas carrying the greatest measured constraint in this Diagnostic.</p>' +
      '<div class="mr-dimension-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>' +
      '<div class="mr-dimension-profile">' + rows + '</div>' + renderConstraintConcentration(m) +
      (findings.length ? '<div class="mr-run-findings"><div class="mr-lens-label">Scorer findings</div><ul>' + findings.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>' : '') + '</section>';
  }

  function renderRunExposure(m, n) {
    const exp = obj(m.exposure), model = obj(exp.model), context = obj(m.context);
    const hasExposure = strictFinite(exp.annual_hours) || strictFinite(exp.annual_cost) || exp.priceable === false;
    if (!hasExposure) return "";
    const people = context.peopleInvolved ?? context.people_involved;
    const cycles = context.annualCycles ?? context.annual_cycles;
    const meetingHours = context.meetingHours ?? context.meeting_hours;
    const hourlyCost = exp.average_hourly_cost ?? exp.hourly_cost ?? context.hourlyCost ?? context.hourly_cost;
    const steps = [
      ["01", "Disclosed workload", strictFinite(people) ? fmtWhole(people) + " people" : "Bounded scope", [strictFinite(cycles) ? fmtWhole(cycles) + " annual cycles" : "", strictFinite(meetingHours) ? fmt1(meetingHours) + " hours per run" : ""].filter(Boolean).join(" · ")],
      ["02", "Attributed burden", strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " hours" : "Not priceable", firstStr(model.formula, exp.unpriced_reason, "Directional scenario")],
      ["03", "Labor exposure", strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Not priceable", strictFinite(hourlyCost) ? fmtMoney(hourlyCost) + " loaded hourly cost" : firstStr(exp.unpriced_reason)],
      ["04", "Potentially reclaimable", strictFinite(exp.recoverable_cost) ? fmtMoney(exp.recoverable_cost) : "Not established", strictFinite(exp.recoverable_share_percent) ? fmtPercent(exp.recoverable_share_percent) + " modeled share" : "Not claimed"]
    ];
    return '<section class="mr-section mr-run-exposure"><div class="mr-section-index">0' + n + ' · Capacity exposure</div><h2>How the disclosed scenario becomes exposure</h2>' +
      '<p class="mr-lede">Workload assumptions, attributed burden, labor exposure, and reclaimable potential remain separate so the estimate can be audited instead of mistaken for an empirical benchmark.</p>' +
      '<div class="mr-exposure-flow">' + steps.map((step) => '<div class="mr-exposure-step"><span>' + step[0] + '</span><div class="mr-lens-label">' + esc(step[1]) + '</div><strong>' + esc(step[2]) + '</strong><p>' + esc(step[3]) + '</p></div>').join("") + '</div>' +
      (model.note ? '<p class="mr-model-note">' + esc(model.note) + '</p>' : '') + '</section>';
  }

  function renderRunGovernance(m, n) {
    if (!m.benchmarkDetail && !m.tradeoff && !m.trajectoryLabel && !m.quadrant) return "";
    return '<section class="mr-section mr-run-leadership"><div class="mr-section-index">0' + n + ' · Leadership read</div><h2>What leadership should—and should not—take from the result</h2>' +
      '<div class="mr-leadership-grid">' +
        (m.benchmarkDetail ? '<div><div class="mr-lens-label">Design-reference context</div><p>' + esc(m.benchmarkDetail) + '</p></div>' : '') +
        (m.tradeoff ? '<div><div class="mr-lens-label">Tradeoff to preserve</div><p>' + esc(m.tradeoff) + '</p></div>' : '') +
        (m.quadrant ? '<div><div class="mr-lens-label">Governance × execution interpretation</div><p>' + esc(m.quadrant) + '</p></div>' : '') +
        (m.trajectoryLabel ? '<div><div class="mr-lens-label">Directional signal</div><strong>' + esc(m.trajectoryLabel) + '</strong>' + (m.trajectoryNote ? '<p>' + esc(m.trajectoryNote) + '</p>' : '') + '</div>' : '') +
      '</div></section>';
  }

  function renderRunEvidence(m, n) {
    const evidence = arr(m.participantEvidence);
    const watch = arr(m.watch).map(textItem).filter(Boolean);
    const coverage = obj(m.coverage);
    const measured = coverage.measured_dimension_count;
    const total = coverage.total_dimension_count;
    const evidenceHtml = evidence.length ? evidence.map((item) => {
      const row = obj(item);
      return '<div class="mr-evidence-quote"><div class="mr-lens-label">' + esc(humanize(firstStr(row.participant_mode, row.perspective, "Participant evidence"))) + '</div><p>' + esc(firstStr(row.text, row.message, row.summary)) + '</p></div>';
    }).join("") : '<div class="mr-evidence-empty"><div class="mr-lens-label">Participant evidence</div><h3>No participant notes were supplied.</h3><p>The report therefore makes no participant-statement or experiential claim.</p></div>';
    return '<section class="mr-section mr-run-evidence"><div class="mr-section-index">0' + n + ' · Evidence status</div><h2>What evidence is—and is not—in this run</h2>' +
      '<div class="mr-evidence-summary">' +
        runMetric("Evidence depth", m.evidenceBand, "Single-run claim strength", "teal") +
        runMetric("Measured dimensions", strictFinite(measured) && strictFinite(total) ? fmtWhole(measured) + " of " + fmtWhole(total) : fmtWhole(arr(m.dimensionEntries).length), "Scored condition coverage", "ink") +
        runMetric("Perspective", m.participantMode, "Reported separately from scored inputs", "green") +
      '</div><div class="mr-run-evidence-grid"><div>' + evidenceHtml + '</div>' +
      (watch.length ? '<div><div class="mr-lens-label">What to watch next</div><ul>' + watch.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>' : '<div class="mr-evidence-clean"><div class="mr-lens-label">Watch items</div><p>No additional watch item was returned for this representative run.</p></div>') +
      '</div></section>';
  }

  function renderPriorityMatrix(m) {
    const ladder = arr(m.priorityLadder).slice(0, 5);
    if (!ladder.length) return "";
    const yPositions = [24, 52, 78, 88, 94];
    const points = ladder.map((item, index) => {
      const row = obj(item);
      const severity = strictFinite(row.severity) ? Number(row.severity) : (strictFinite(row.weakness) ? Number(row.weakness) : 50);
      const x = 28 + (Math.max(0, Math.min(100, severity)) / 100) * 64;
      const y = yPositions[index] || 94;
      return '<div class="mr-priority-point" style="left:' + x.toFixed(2) + '%;top:' + y + '%" data-rank="' + (index + 1) + '"><span>' + (index + 1) + '</span><div><strong>' + esc(firstStr(row.focus, row.label, "Measured focus")) + '</strong><small>' + esc(firstStr(row.priority, "Priority")) + ' · ' + esc(fmt1(severity)) + '</small></div></div>';
    }).join("");
    return '<div class="mr-priority-matrix"><div class="mr-viz-title">Priority map · scorer sequence × measured constraint</div><div class="mr-priority-plot" role="img" aria-label="Priority sequence plotted against measured constraint severity"><span class="mr-priority-axis-y">Earlier in sequence</span><span class="mr-priority-axis-x">Greater measured constraint →</span><i class="mr-priority-grid-x"></i><i class="mr-priority-grid-y"></i>' + points + '</div><p class="mr-copy">Horizontal position uses the returned weakness or severity value. Vertical position preserves the scorer’s returned action sequence; it is not a separately calculated risk score.</p></div>';
  }

  function renderRunActions(m, n) {
    const ladder = arr(m.priorityLadder), actions = arr(m.actions).map(textItem).filter(Boolean), remedies = arr(m.remedyPaths);
    if (!ladder.length && !actions.length && !remedies.length) return "";
    const ladderHtml = ladder.length ? '<div class="mr-priority-ladder">' + ladder.map((item, index) => {
      const row = obj(item);
      const severity = strictFinite(row.severity) ? row.severity : (strictFinite(row.weakness) ? row.weakness : null);
      return '<div class="mr-priority-row"><span>0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(firstStr(row.priority, "Priority")) + '</div><strong>' + esc(firstStr(row.focus, row.label, "Measured focus")) + '</strong></div><em>' + esc(severity === null ? "—" : fmt1(severity)) + '</em></div>';
    }).join("") + '</div>' : '';
    const remediesHtml = remedies.length ? '<div class="mr-remedy-grid">' + remedies.slice(0, 3).map((item, index) => {
      const path = obj(item);
      const evidenceRow = obj(ladder[Math.min(index, Math.max(0, ladder.length - 1))]);
      const evidenceSeverity = strictFinite(evidenceRow.severity) ? evidenceRow.severity : evidenceRow.weakness;
      const evidenceBasis = firstStr(evidenceRow.focus, evidenceRow.label, m.primarySignal) + (strictFinite(evidenceSeverity) ? " · " + fmt1(evidenceSeverity) + " measured constraint" : "");
      return '<article class="mr-card mr-remedy-card mr-run-remedy" data-path-depth="' + (index + 1) + '"><div class="mr-remedy-head"><span class="mr-remedy-number">0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(firstStr(path.kicker, "Candidate path")) + '</div><h3>' + esc(firstStr(path.label, "Remedy path")) + '</h3></div></div>' +
        (path.summary ? '<p>' + esc(path.summary) + '</p>' : '') +
        (arr(path.actions).length ? '<div class="mr-remedy-actions"><div class="mr-remedy-field-label">Engine-generated actions</div><ol>' + arr(path.actions).map((action) => '<li>' + esc(textItem(action)) + '</li>').join("") + '</ol></div>' : '') +
        '<div class="mr-remedy-tradeoffs">' + (path.benefit ? '<div><div class="mr-remedy-field-label">Potential benefit</div><p>' + esc(path.benefit) + '</p></div>' : '') + (path.risk ? '<div><div class="mr-remedy-field-label">Tradeoff</div><p>' + esc(path.risk) + '</p></div>' : '') + '</div><div class="mr-remedy-evidence"><span>Measured evidence link</span><strong>' + esc(evidenceBasis) + '</strong></div></article>';
    }).join("") + '</div>' : '';
    return '<section class="mr-section mr-run-action-board"><div class="mr-section-index">0' + n + ' · Action architecture</div><h2>Priorities and graduated remedy paths</h2>' +
      '<p class="mr-lede">The priority ladder identifies what to address first. Remedy paths increase intervention depth without changing the measured result.</p>' + renderPriorityMatrix(m) + ladderHtml +
      (actions.length ? '<div class="mr-run-actions"><div class="mr-lens-label">Recommended sequence</div><ol>' + actions.map((action) => '<li>' + esc(action) + '</li>').join("") + '</ol></div>' : '') + remediesHtml + '</section>';
  }

  function renderRunMethod(m, n) {
    const p = obj(m.provenance), c = obj(m.context), model = obj(obj(m.exposure).model);
    const rows = [
      ["Instrument", m.toolLabel], ["Operating scope", firstStr(m.processName, m.scopeLabel)],
      ["Participant perspective", m.participantMode], ["Input depth", firstStr(obj(m.source).input_confidence_label, c.confidenceLevel, c.confidence_level)],
      ["Trajectory", m.trajectoryLabel], ["Exposure model", firstStr(model.version, model.model_type)],
      ["Engine revision", firstStr(p.engine_commit)], ["Artifact digest", firstStr(p.artifact_sha256)]
    ].filter((row) => row[1]);
    return '<section class="mr-section mr-run-method"><div class="mr-section-index">0' + n + ' · Method and limits</div><h2>Basis of this read</h2><dl>' +
      rows.map((row) => '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>').join("") + '</dl>' +
      '<p class="mr-method-copy">The Diagnostic score and dimensions come from the submitted scored inputs. Participant statements, where present, remain separate and do not reweight the score. Design-reference language is instrument calibration, not a sampled peer benchmark.</p></section>';
  }

  function renderRunLeadershipClose(m, n) {
    const ladder = arr(m.priorityLadder);
    const indicators = ladder.slice(0, 3).map((item) => firstStr(obj(item).focus, obj(item).label)).filter(Boolean);
    const scope = firstStr(m.processName, m.scopeLabel, "the measured operating scope");
    const scopeWithArticle = /^[a-z]/.test(scope) && !/^(?:the|this|that)\b/i.test(scope) ? "the " + scope : scope;
    const firstAction = firstStr(m.firstMove, textItem(arr(m.actions)[0]));
    const questions = [
      "Who has the authority to change " + firstStr(m.primarySignal, "the primary measured constraint") + " in " + scopeWithArticle + "?",
      "What observable result will count as improvement—and what would show that burden was only displaced?",
      "Which owner will preserve the same scope and inputs for like-for-like remeasurement?"
    ];
    return '<section class="mr-section mr-leadership-close"><div class="mr-section-index">0' + n + ' · Leadership handoff</div><h2>Turn the read into a bounded operating decision</h2>' +
      '<div class="mr-leadership-close-grid"><div class="mr-leadership-sequence"><div class="mr-lens-label">Sequence</div><ol>' +
        '<li><strong>Assign ownership.</strong><span>Name one accountable owner for ' + esc(firstStr(m.primarySignal, "the primary measured constraint")) + '.</span></li>' +
        '<li><strong>Run the first bounded move.</strong><span>' + esc(firstAction || "Select the smallest returned action that can test the diagnosis without adding new operating burden.") + '</span></li>' +
        '<li><strong>Watch the measured indicators.</strong><span>' + esc(indicators.length ? indicators.join(" · ") : "The score, primary dimension, burden estimate, and any returned watch items") + '</span></li>' +
        '<li><strong>Remeasure like for like.</strong><span>Repeat the same Diagnostic with the same scope and comparable inputs; compare the score, dimensions, and exposure before attributing improvement.</span></li>' +
      '</ol></div><div class="mr-ownership-questions"><div class="mr-lens-label">Questions leadership must answer</div>' + questions.map((question, index) => '<div><span>0' + (index + 1) + '</span><p>' + esc(question) + '</p></div>').join("") + '</div></div>' +
      '<div class="mr-remeasurement-note"><div class="mr-lens-label">Remeasurement discipline</div><p>A lower score or burden estimate is decision-useful only when the scope, participant perspective, configuration, and key workload assumptions remain comparable. Record any material change rather than treating unlike runs as a trend.</p></div></section>';
  }

  function renderRunReport(m) {
    const renderers = [renderRunDecisionBrief, renderRunDimensions, renderRunExposure, renderRunGovernance, renderRunEvidence, renderRunActions, renderRunMethod, renderRunLeadershipClose];
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

    if (m.kind === "run") {
      return coverBlock + renderRunReport(m) + buildReportBoundary(m);
    }

    const kvs = arr(m.kvs).map((x) => '<div class="k">' + esc(x.k) + "</div><div>" + esc(x.v) + "</div>").join("");
    let n = 0;
    const secHtml =
      '<section class="mr-section"><h2>1. Executive summary</h2><p class="mr-exec-lede">' + esc(m.execSummary) + "</p>" +
      '<div class="callout"><p><strong>Organizational implication.</strong> ' + esc(m.bottomLine) + "</p></div>" +
      (kvs ? '<div class="kvs">' + kvs + "</div>" : "") + '</section>' +
      arr(m.sections).map((s) => '<section class="mr-section">' + sectionHtml(s, (n += 1) + 1) + '</section>').join("") +
      '<section class="mr-section"><h2>' + (n + 2) + '. Conclusion and next step</h2><p>This Executive Report is a directional read of the measured condition. Use the reported evidence, limitations, and recommended first moves as the basis for a bounded operating decision and like-for-like remeasurement.</p></section>';

    return coverBlock + secHtml + buildReportBoundary(m);
  }

  var REPORT_CSS =
    '.mr-report{--ink:#18191C;--soft:#6E6F73;--muted:#9A9892;--accent:#0C6E78;--line:#EAE6DD;--paper:#fff;--page:#F6F3EC}' +
    '.mr-remedy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px;counter-reset:remedy}.mr-remedy-card{display:flex;flex-direction:column;background:#fff;overflow:hidden}.mr-remedy-head{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start}.mr-remedy-number{color:rgba(12,110,120,.22);font-size:2rem;line-height:.9;font-weight:700;letter-spacing:-.06em}.mr-remedy-card h3{margin:6px 0 10px}.mr-remedy-actions{margin:12px 0 0;padding-top:12px;border-top:1px solid var(--line)}.mr-remedy-card ol{margin:8px 0 0;padding-left:20px}.mr-remedy-card li{margin:6px 0}.mr-remedy-field-label{font-size:.68rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}.mr-remedy-tradeoffs{display:grid;gap:10px;margin-top:14px}.mr-remedy-tradeoffs>div{padding:11px 12px;background:#F6F3EC;border-radius:8px}.mr-remedy-tradeoffs p{margin:5px 0 0;font-size:.9rem;line-height:1.5}.mr-remedy-evidence{display:grid;gap:4px;margin-top:auto;padding-top:14px;border-top:1px solid var(--line);font-size:.76rem;color:var(--soft)}.mr-remedy-evidence span{font-size:.64rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}.mr-remedy-evidence strong{font-weight:600;color:var(--soft)}@media(max-width:760px){.mr-remedy-grid{grid-template-columns:1fr}}.mr-report,.mr-report *{box-sizing:border-box}' +
    '.mr-report{margin:0;background:var(--page);color:var(--ink);font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}' +
    '.mr-report .mr-page{max-width:1080px;margin:0 auto;background:var(--paper);padding:48px 54px 64px;border:1px solid rgba(24,25,28,.13);border-radius:20px;box-shadow:0 20px 54px rgba(8,56,62,.07)}' +
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
    '.mr-card{border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:12px 0;background:#FCFBF8}.mr-card.mr-remedy-card{background:#fff}' +
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
    '@media print{.mr-report{background:#fff}.mr-report .mr-page{border:0;border-radius:0;box-shadow:none;max-width:none;padding:28px 32px}.mr-report .actions{display:none!important}}' +

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
    .mr-system-read>h2{font-size:clamp(1.9rem,3.8vw,3.1rem)!important;line-height:1.02!important;letter-spacing:-.045em!important;max-width:22ch!important}
    .mr-system-read{display:flex;flex-direction:column}.mr-system-read>.mr-system-panel{order:-1;margin-bottom:28px}
    .mr-system-panel{padding:22px 24px 18px!important;background:linear-gradient(180deg,#FAFAF8 0,#FFF 100%)}
    .mr-system-map{display:block;width:100%;height:auto;min-height:310px;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}
    .mr-system-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #E0DCD3;border-radius:12px;overflow:hidden;margin:16px 0}
    .mr-system-decision{display:grid;grid-template-columns:1.3fr .7fr;border:1px solid #E0DCD3;border-radius:12px;overflow:hidden}.mr-system-decision>div{padding:22px 24px;background:#FFF}.mr-system-decision>div+div{border-left:1px solid #E0DCD3;background:#F7F5F0}.mr-system-decision h3{font-size:1.05rem!important;margin:8px 0!important}.mr-system-decision p{font-size:.9rem!important;line-height:1.57!important;margin:7px 0 0!important}.mr-system-decision strong{display:block;font-size:1.65rem;line-height:1.1;letter-spacing:-.03em;margin:9px 0 4px}
    .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    .mr-interaction-panel{padding:24px!important}.mr-interaction-grid{display:grid;grid-template-columns:minmax(190px,1.4fr) repeat(var(--lens-count),minmax(72px,.55fr));border-top:1px solid #EAE6DD;border-left:1px solid #EAE6DD;margin:18px 0}.mr-interaction-grid>div{border-right:1px solid #EAE6DD;border-bottom:1px solid #EAE6DD}.mr-interaction-head{display:flex;align-items:end;justify-content:center;padding:12px 8px;color:#6E6F73;font-size:.62rem;line-height:1.25;letter-spacing:.08em;text-align:center;text-transform:uppercase;font-weight:700;background:#FAFAF8}.mr-interaction-label{padding:13px 14px}.mr-interaction-label strong{display:block;font-size:.82rem}.mr-interaction-label span{display:block;margin-top:4px;color:#6E6F73;font-size:.72rem;line-height:1.4}.mr-interaction-cell{display:grid;place-items:center;min-height:68px}.mr-interaction-cell i{width:10px;height:10px;border-radius:50%;background:#E0DCD3}.mr-interaction-cell i.is-active{width:16px;height:16px;background:#0C6E78;box-shadow:0 0 0 5px rgba(12,110,120,.09)}.mr-compounding-read{margin:18px 0;padding:18px 20px;border-left:3px solid #08383E;background:#F7F5F0}.mr-compounding-read p{font-size:.86rem!important;line-height:1.55!important;margin:8px 0 0!important}
    .mr-depth-system-read>h2{font-size:clamp(1.9rem,3.8vw,3.1rem)!important;line-height:1.02!important;letter-spacing:-.045em!important;max-width:22ch!important}.mr-depth-system-read{display:flex;flex-direction:column}.mr-depth-system-read>.mr-viz-panel{order:-1;margin-bottom:28px}.mr-depth-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #E0DCD3;border-radius:12px;overflow:hidden;margin:16px 0}.mr-depth-reading-grid{display:grid;grid-template-columns:1.2fr .8fr;border:1px solid #E0DCD3;border-radius:12px;overflow:hidden}.mr-depth-reading-grid>div{padding:20px 22px}.mr-depth-reading-grid>div+div{border-left:1px solid #E0DCD3;background:#F7F5F0}.mr-depth-reading-grid p{font-size:.9rem!important;line-height:1.58!important;margin:7px 0 0!important}.mr-depth-reading-grid strong{display:block;font-size:1.2rem;margin:8px 0 4px}
    .mr-decision-frame{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0 16px}
    .mr-decision-metric{padding:16px 15px;border:1px solid #EAE6DD;border-top:3px solid #0C6E78;border-radius:9px;background:#FAFAF8;min-width:0}
    .mr-decision-metric:nth-child(2){border-top-color:#C9821F}.mr-decision-metric:nth-child(3){border-top-color:#3C8A60}.mr-decision-metric:nth-child(4){border-top-color:#08383E}
    .mr-decision-value{font-size:1.55rem;line-height:1.05;letter-spacing:-.035em;font-weight:700;color:#18191C;margin:8px 0 5px;overflow-wrap:anywhere}
    .mr-decision-story{display:grid;grid-template-columns:1.15fr .85fr;gap:0;margin-top:14px;border:1px solid #EAE6DD;border-radius:11px;overflow:hidden}
    .mr-decision-story>div{padding:20px 22px;background:#FFF}.mr-decision-story>div+div{border-left:1px solid #EAE6DD;background:#F6F3EC}
    .mr-decision-story h3{font-size:1.05rem!important;margin:8px 0 8px!important}.mr-decision-story p{font-size:.94rem!important;line-height:1.58!important;margin:7px 0 0!important}
    .mr-evidence-ladder{display:grid;grid-template-columns:repeat(4,1fr);margin:22px 0 10px;gap:0}
    .mr-evidence-step{position:relative;text-align:center;padding-top:17px;color:#9A9892;font-size:.72rem}.mr-evidence-step:before{content:"";position:absolute;left:0;right:0;top:6px;height:2px;background:#EAE6DD}
    .mr-evidence-step:first-child:before{left:50%}.mr-evidence-step:last-child:before{right:50%}.mr-evidence-step span{position:absolute;left:50%;top:1px;width:12px;height:12px;border-radius:50%;transform:translateX(-50%);background:#D8D5CE;border:2px solid #FFF;box-shadow:0 0 0 1px #D8D5CE}
    .mr-evidence-step.is-active{color:#0C6E78}.mr-evidence-step.is-active span{background:#0C6E78;box-shadow:0 0 0 2px rgba(12,110,120,.18)}
    .mr-action-path{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 24px}
    .mr-action-step{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;padding:14px 14px;border:1px solid #EAE6DD;border-top:3px solid #0C6E78;border-radius:9px;background:#FAFAF8}
    .mr-action-step[data-tier="behavioral"]{border-top-color:#C9821F}.mr-action-step[data-tier="cultural"]{border-top-color:#3C8A60}
    .mr-action-step-num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#08383E;color:#FFF;font-size:.78rem;font-weight:700}
    .mr-action-step strong{display:block;font-size:.83rem;line-height:1.35;color:#18191C;margin-top:5px}
    @media(max-width:760px){.mr-decision-frame{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-decision-story{grid-template-columns:1fr}.mr-decision-story>div+div{border-left:0;border-top:1px solid #EAE6DD}.mr-action-path{grid-template-columns:1fr}}
    .mr-exposure-range{padding:22px 24px!important}
    .mr-range-row{margin:16px 0 20px}
    .mr-range-head{display:flex;justify-content:space-between;gap:14px;align-items:baseline;font-size:.88rem;color:#18191C}
    .mr-range-head span{color:#6E6F73;font-variant-numeric:tabular-nums}
    .mr-range-track{position:relative;height:12px;border-radius:999px;background:#EAE6DD;margin-top:9px;overflow:visible}
    .mr-range-iqr{position:absolute;top:0;height:12px;border-radius:999px;background:rgba(12,110,120,.30)}
    .mr-range-median{position:absolute;top:-4px;width:3px;height:20px;border-radius:2px;background:#08383E;transform:translateX(-1.5px)}
    .mr-range-foot{margin-top:7px;font-size:.76rem;color:#6E6F73}
    @media(max-width:760px){.mr-map-lenses{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-map-signal{grid-template-columns:1fr}.mr-map-tools{justify-content:flex-start;max-width:none}.mr-system-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-system-metrics .mr-run-metric:nth-child(3){border-left:0}.mr-system-decision{grid-template-columns:1fr}.mr-system-decision>div+div{border-left:0;border-top:1px solid #E0DCD3}}
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

    /* Single-Diagnostic product report — the same renderer powers Workspace and
       the public production-contract samples. */
    .mr-section-index{font-size:.67rem;line-height:1.3;letter-spacing:.17em;text-transform:uppercase;color:#0C6E78;font-weight:700;margin:0 0 10px}
    .mr-run-headline{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:38px;align-items:start;margin-bottom:24px}
    .mr-run-headline h2{font-size:clamp(1.8rem,3.7vw,3.2rem)!important;line-height:1.01!important;letter-spacing:-.047em!important;max-width:22ch!important;margin:0 0 16px!important}
    .mr-run-score-stamp{display:grid;justify-items:end;padding:4px 0 14px;border-bottom:3px solid #0C6E78;font-variant-numeric:tabular-nums}
    .mr-run-score-stamp span{font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;color:#6E6F73;font-weight:700}
    .mr-run-score-stamp strong{font-size:4.5rem;line-height:.84;letter-spacing:-.07em;margin:12px 0 7px}
    .mr-run-score-stamp em{font-style:normal;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:#0C6E78;font-weight:700}
    .mr-run-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #E0DCD3;border-radius:12px;overflow:hidden;background:#FFF}
    .mr-run-metric{position:relative;padding:19px 18px;min-width:0;border-top:3px solid #0C6E78}
    .mr-run-metric+ .mr-run-metric{border-left:1px solid #EAE6DD}.mr-run-metric[data-tone="ink"]{border-top-color:#08383E}.mr-run-metric[data-tone="amber"]{border-top-color:#C9821F}.mr-run-metric[data-tone="green"]{border-top-color:#3C8A60}
    .mr-run-metric-value{font-size:1.38rem;line-height:1.08;letter-spacing:-.03em;font-weight:700;margin:9px 0 7px;overflow-wrap:anywhere}
    .mr-run-metric .mr-copy{font-size:.78rem!important;line-height:1.45!important;margin:0!important}
    .mr-run-decision-story{display:grid;grid-template-columns:1fr 1fr;margin-top:16px;border-radius:12px;overflow:hidden;border:1px solid #EAE6DD}
    .mr-run-decision-story>div{padding:22px 24px;background:#F7F5F0}.mr-run-decision-story>div+div{border-left:1px solid #E0DCD3;background:#FFF}
    .mr-run-decision-story p{font-size:.95rem!important;line-height:1.58!important;margin:7px 0 0!important}
    .mr-dimension-axis{display:grid;grid-template-columns:repeat(5,1fr);margin:25px 6px 4px 246px;color:#9A9892;font-size:.65rem;font-variant-numeric:tabular-nums;text-align:center}.mr-dimension-axis span:first-child{text-align:left}.mr-dimension-axis span:last-child{text-align:right}
    .mr-dimension-profile{border-top:1px solid #EAE6DD}
    .mr-dimension-row{display:grid;grid-template-columns:226px minmax(0,1fr);gap:10px 20px;padding:17px 4px;border-bottom:1px solid #EAE6DD;align-items:center}
    .mr-dimension-copy{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.mr-dimension-copy strong{font-size:.9rem;line-height:1.35}.mr-dimension-copy span{color:#0C6E78;font-weight:700;font-variant-numeric:tabular-nums}
    .mr-dimension-track{position:relative;height:10px;border-radius:999px;background:linear-gradient(90deg,#EEEAE2 0,#EEEAE2 25%,#E8E4DB 25%,#E8E4DB 50%,#E1DDD4 50%,#E1DDD4 75%,#DAD6CD 75%);overflow:visible}
    .mr-dimension-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#08383E,#0C6E78)}.mr-dimension-track i{position:absolute;top:-4px;width:2px;height:18px;background:#08383E;transform:translateX(-1px)}
    .mr-dimension-detail{grid-column:2;font-size:.7rem;color:#9A9892;margin-top:-4px}.mr-dimension-detail b{float:right;color:#0C6E78;text-transform:uppercase;letter-spacing:.1em;font-size:.61rem}
    .mr-dimension-row.is-primary{background:linear-gradient(90deg,transparent 0,rgba(12,110,120,.045) 24%,rgba(12,110,120,.045) 100%)}
    .mr-constraint-view{margin-top:28px;padding:24px;border:1px solid #E0DCD3;border-radius:12px;background:#FAFAF8}.mr-constraint-bar{display:flex;height:30px;border-radius:7px;overflow:hidden;background:#EAE6DD}.mr-constraint-bar span{display:block;height:100%;border-right:1px solid rgba(255,255,255,.65)}.mr-constraint-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 28px;margin:18px 0}.mr-constraint-legend>div{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:9px;align-items:center;font-size:.76rem}.mr-constraint-legend i{width:10px;height:10px;border-radius:2px}.mr-constraint-legend strong{font-variant-numeric:tabular-nums;color:#0C6E78}.mr-constraint-read{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;padding-top:17px;border-top:1px solid #E0DCD3}.mr-constraint-read strong{font-size:1.08rem}.mr-constraint-read p{font-size:.86rem!important;line-height:1.55!important;color:#6E6F73!important;margin:0!important}
    .mr-run-findings{display:grid;grid-template-columns:190px minmax(0,1fr);gap:24px;margin-top:25px;padding:22px 24px;background:#F7F5F0;border-left:3px solid #0C6E78}.mr-run-findings ul{margin:0!important}
    .mr-exposure-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:22px;border-top:1px solid #DCD8CF;border-bottom:1px solid #DCD8CF}
    .mr-exposure-step{position:relative;padding:24px 22px 22px;min-width:0}.mr-exposure-step+ .mr-exposure-step{border-left:1px solid #EAE6DD}.mr-exposure-step>span{display:block;color:rgba(12,110,120,.22);font-size:1.8rem;font-weight:700;line-height:1;margin-bottom:16px}.mr-exposure-step strong{display:block;font-size:1.28rem;line-height:1.1;letter-spacing:-.025em;margin:9px 0}.mr-exposure-step p{font-size:.76rem!important;color:#6E6F73!important;line-height:1.45!important;margin:0!important}.mr-exposure-step:not(:last-child)::after{content:"→";position:absolute;right:-10px;top:50%;z-index:1;padding:2px;background:#FFF;color:#0C6E78;font-weight:700}
    .mr-model-note{font-size:.78rem!important;line-height:1.55!important;color:#6E6F73!important;margin:16px 0 0!important}
    .mr-leadership-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #DCD8CF;margin-top:22px}.mr-leadership-grid>div{padding:22px 24px 22px 0;border-bottom:1px solid #EAE6DD}.mr-leadership-grid>div:nth-child(even){padding-left:24px;border-left:1px solid #EAE6DD}.mr-leadership-grid p{font-size:.94rem!important;line-height:1.62!important;margin:8px 0 0!important}.mr-leadership-grid strong{display:block;font-size:1.16rem;margin:9px 0 4px}
    .mr-evidence-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #E0DCD3;border-radius:12px;overflow:hidden;margin:20px 0}.mr-evidence-summary .mr-run-metric{border-top-width:3px}
    .mr-run-evidence-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:26px;margin-top:22px}.mr-evidence-empty,.mr-evidence-clean,.mr-evidence-quote{padding:20px 22px;border:1px solid #E0DCD3;border-radius:10px;background:#FFF}.mr-evidence-empty h3{font-size:1.1rem!important;margin:9px 0 7px!important}.mr-evidence-empty p,.mr-evidence-clean p,.mr-evidence-quote p{font-size:.9rem!important;line-height:1.58!important;margin:7px 0 0!important}.mr-evidence-quote+ .mr-evidence-quote{margin-top:10px}
    .mr-evidence-boundary{display:grid;grid-template-columns:5px minmax(0,1fr);gap:14px;margin-top:24px;padding:18px 20px;border:1px solid #E0DCD3;border-radius:10px;background:#FAFAF8}.mr-evidence-boundary>span{border-radius:5px;background:#0C6E78}.mr-evidence-boundary p{font-size:.86rem!important;color:#6E6F73!important;line-height:1.55!important;margin:6px 0 0!important}
    .mr-priority-ladder{border-top:1px solid #DCD8CF;margin:23px 0 28px}.mr-priority-row{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:16px;align-items:center;padding:17px 4px;border-bottom:1px solid #EAE6DD}.mr-priority-row>span{font-size:1.8rem;font-weight:700;color:rgba(12,110,120,.2)}.mr-priority-row strong{font-size:1rem}.mr-priority-row em{font-style:normal;font-size:1.25rem;font-weight:700;color:#0C6E78;font-variant-numeric:tabular-nums}
    .mr-priority-matrix{margin:22px 0;padding:22px 24px;border:1px solid #E0DCD3;border-radius:12px;background:#FAFAF8}.mr-priority-plot{position:relative;height:280px;margin:24px 8px 12px 86px;border-left:1px solid #9A9892;border-bottom:1px solid #9A9892;background:linear-gradient(90deg,transparent 49.7%,rgba(24,25,28,.06) 50%,transparent 50.3%),linear-gradient(180deg,transparent 49.7%,rgba(24,25,28,.06) 50%,transparent 50.3%)}.mr-priority-axis-y{position:absolute;left:-79px;top:8px;width:70px;color:#6E6F73;font-size:.63rem;line-height:1.25;text-transform:uppercase;letter-spacing:.08em}.mr-priority-axis-x{position:absolute;right:0;bottom:-25px;color:#6E6F73;font-size:.63rem;text-transform:uppercase;letter-spacing:.08em}.mr-priority-point{position:absolute;transform:translate(-14px,-14px);display:flex;align-items:center;gap:8px;z-index:1}.mr-priority-point>span{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#0C6E78;color:#FFF;font-size:.75rem;font-weight:700;box-shadow:0 0 0 5px rgba(12,110,120,.1)}.mr-priority-point>div{display:none;position:absolute;left:37px;top:-5px;width:155px;padding:7px 9px;border:1px solid #E0DCD3;border-radius:7px;background:#FFF;box-shadow:0 4px 12px rgba(8,56,62,.08)}.mr-priority-point:nth-of-type(-n+4)>div{display:block}.mr-priority-point strong{display:block;font-size:.72rem;line-height:1.3}.mr-priority-point small{display:block;color:#6E6F73;font-size:.62rem;margin-top:3px}.mr-run-remedy{position:relative;border-top:4px solid #7FB0B6!important}.mr-run-remedy[data-path-depth="2"]{border-top-color:#0C6E78!important}.mr-run-remedy[data-path-depth="3"]{border-top-color:#08383E!important}
    .mr-run-actions{margin:0 0 28px;padding:22px 24px 20px;border-left:3px solid #0C6E78;background:#F7F5F0}.mr-run-actions ol{margin-top:13px!important;padding-left:22px!important}.mr-run-actions li{padding-left:5px}
    .mr-run-method dl{margin:20px 0;border-top:1px solid #DCD8CF}.mr-run-method dl>div{display:grid;grid-template-columns:190px minmax(0,1fr);gap:22px;padding:13px 0;border-bottom:1px solid #EAE6DD}.mr-run-method dt{font-size:.68rem;letter-spacing:.11em;text-transform:uppercase;color:#6E6F73}.mr-run-method dd{margin:0;font-size:.83rem;line-height:1.5;overflow-wrap:anywhere}.mr-method-copy{margin-top:22px!important;font-size:.9rem!important;color:#6E6F73!important;max-width:72ch}
    .mr-leadership-close{padding:32px!important;border:1px solid #0C6E78!important;border-radius:14px;background:linear-gradient(145deg,#F7FAF9,#FFF)!important}.mr-leadership-close>h2{font-size:clamp(1.8rem,3.4vw,2.8rem)!important;line-height:1.03!important;letter-spacing:-.04em!important;max-width:19ch!important}.mr-leadership-close-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;margin-top:24px}.mr-leadership-sequence ol{list-style:none;margin:14px 0 0!important;padding:0!important;counter-reset:handoff}.mr-leadership-sequence li{position:relative;padding:0 0 18px 39px;margin:0!important;counter-increment:handoff}.mr-leadership-sequence li:not(:last-child)::before{content:"";position:absolute;left:13px;top:25px;bottom:0;width:1px;background:#B8D1D3}.mr-leadership-sequence li::after{content:counter(handoff);position:absolute;left:0;top:0;display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#08383E;color:#FFF;font-size:.72rem;font-weight:700}.mr-leadership-sequence li strong{display:block;font-size:.9rem}.mr-leadership-sequence li span{display:block;margin-top:4px;color:#6E6F73;font-size:.8rem;line-height:1.5}.mr-ownership-questions>div:not(.mr-lens-label){display:grid;grid-template-columns:31px 1fr;gap:10px;padding:13px 0;border-bottom:1px solid #EAE6DD}.mr-ownership-questions>div>span{color:rgba(12,110,120,.3);font-size:1.25rem;font-weight:700}.mr-ownership-questions p{font-size:.85rem!important;line-height:1.5!important;margin:0!important}.mr-remeasurement-note{margin-top:22px;padding:17px 19px;border-left:3px solid #0C6E78;background:#F7F5F0}.mr-remeasurement-note p{font-size:.84rem!important;line-height:1.55!important;margin:6px 0 0!important}

    @media(max-width:800px){
      .mr-run-metrics,.mr-exposure-flow,.mr-depth-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-run-metric:nth-child(3),.mr-run-metric:nth-child(4){border-top:1px solid #EAE6DD}.mr-run-metric:nth-child(3){border-left:0}.mr-exposure-step:nth-child(3){border-left:0;border-top:1px solid #EAE6DD}.mr-exposure-step:nth-child(4){border-top:1px solid #EAE6DD}.mr-exposure-step::after{display:none}.mr-dimension-axis{margin-left:196px}.mr-dimension-row{grid-template-columns:176px minmax(0,1fr)}.mr-leadership-close-grid{grid-template-columns:1fr}.mr-interaction-grid{grid-template-columns:minmax(150px,1.3fr) repeat(var(--lens-count),minmax(56px,.5fr))}
    }
    @media(max-width:640px){
      .mr-evidence-grid .mr-lens-card{grid-template-columns:1fr;gap:4px;padding:14px 0}
      .mr-evidence-grid .mr-lens-card>.mr-lens-label,.mr-evidence-grid .mr-lens-card>div:not(.mr-lens-label),.mr-evidence-grid .mr-lens-card>.mr-copy{grid-column:1;grid-row:auto}
      .mr-report .mr-section>h2{font-size:1.45rem}
      .mr-report .mr-page{padding:24px 20px 38px;border-radius:0;border-left:0;border-right:0}.mr-run-headline{grid-template-columns:1fr;gap:16px}.mr-run-score-stamp{justify-items:start;width:130px}.mr-run-metrics,.mr-evidence-summary,.mr-exposure-flow,.mr-leadership-grid,.mr-run-evidence-grid,.mr-run-decision-story{grid-template-columns:1fr}.mr-run-metric+ .mr-run-metric{border-left:0;border-top:1px solid #EAE6DD}.mr-run-decision-story>div+div{border-left:0;border-top:1px solid #EAE6DD}.mr-dimension-axis{display:none}.mr-dimension-row{grid-template-columns:1fr;gap:9px}.mr-dimension-detail{grid-column:1;margin:0}.mr-run-findings{grid-template-columns:1fr;gap:8px}.mr-exposure-step+ .mr-exposure-step{border-left:0;border-top:1px solid #EAE6DD}.mr-leadership-grid>div,.mr-leadership-grid>div:nth-child(even){padding:18px 0;border-left:0}.mr-evidence-summary .mr-run-metric{border-left:0}.mr-run-method dl>div{grid-template-columns:1fr;gap:5px}.mr-cover-meta{grid-template-columns:1fr 1fr}
      .mr-system-map{min-height:0}.mr-system-panel{padding:16px 10px!important}.mr-system-metrics,.mr-depth-metrics{grid-template-columns:1fr}.mr-system-metrics .mr-run-metric,.mr-depth-metrics .mr-run-metric{border-left:0}.mr-system-decision>div{padding:18px}.mr-interaction-panel{padding:17px 12px!important;overflow:hidden}.mr-interaction-grid{grid-template-columns:minmax(120px,1.2fr) repeat(var(--lens-count),minmax(36px,.45fr));font-size:.65rem}.mr-interaction-head{writing-mode:vertical-rl;transform:rotate(180deg);min-height:112px;justify-content:flex-start}.mr-interaction-label{padding:10px}.mr-interaction-label span{display:none}.mr-interaction-cell{min-height:54px}.mr-depth-reading-grid{grid-template-columns:1fr}.mr-depth-reading-grid>div+div{border-left:0;border-top:1px solid #E0DCD3}.mr-constraint-legend{grid-template-columns:1fr}.mr-constraint-read{grid-template-columns:1fr;gap:8px}.mr-priority-matrix{padding:17px 12px}.mr-priority-plot{margin-left:57px}.mr-priority-axis-y{left:-54px;width:48px}.mr-priority-point>div{display:none!important}.mr-leadership-close{padding:24px 20px!important}
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
    @page{size:A4;margin:13mm}
    @media print{
      html,body{background:#FFF!important;margin:0!important}.mr-report .mr-page{padding:0!important}.mr-cover{break-after:page}.mr-section{break-before:auto}.mr-section h2,.mr-section-index{break-after:avoid}.mr-run-metric,.mr-dimension-row,.mr-exposure-step,.mr-remedy-card,.mr-priority-row,.mr-evidence-quote,.mr-viz-panel{break-inside:avoid}.mr-run-metrics,.mr-exposure-flow,.mr-evidence-summary,.mr-remedy-grid{break-inside:avoid}.mr-run-decision-story{break-inside:avoid}.mr-report-boundary{break-inside:avoid}.mr-report .mr-section+.mr-section{margin-top:34px;padding-top:28px}
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

  function reserveReportWindow() {
    const reportWindow = window.open("about:blank", "_blank");
    if (!reportWindow) return null;
    try {
      reportWindow.opener = null;
      reportWindow.document.title = "Preparing Monderman report";
      reportWindow.document.body.innerHTML = '<main style="font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:12vh auto;padding:2rem;color:#17333a"><p style="letter-spacing:.14em;text-transform:uppercase;font-size:.75rem">Monderman</p><h1 style="font-size:1.6rem">Preparing report…</h1><p>The saved result is loading securely.</p></main>';
    } catch (_error) {}
    return reportWindow;
  }

  function closeReservedReportWindow(reportWindow) {
    try { if (reportWindow && !reportWindow.closed) reportWindow.close(); } catch (_error) {}
  }

  function openReport(model, reportWindow) {
    const art = createArtifact(model);
    const url = URL.createObjectURL(art.blob);
    if (reportWindow && !reportWindow.closed) reportWindow.location.replace(url);
    else window.open(url, "_blank", "noopener,noreferrer");
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
    reserveReportWindow: reserveReportWindow,
    closeReservedReportWindow: closeReservedReportWindow,
    openReport: openReport,
    downloadHtml: downloadHtml,
    downloadPdf: downloadPdf,
    downloadJson: downloadJson
  };
})();
