/* ============================================================================
   Monderman: shared executive report renderer  (classic script → window.MondermanReport)
   ----------------------------------------------------------------------------
   ONE renderer for the whole product. It turns a canonical "report model" into:
     • an on-screen executive read           MondermanReport.render(el, model)
     • a printable / PDF report (new tab)     MondermanReport.openReport(model)   (user hits Save/Print PDF)
     • a downloadable standalone HTML file    MondermanReport.downloadHtml(model)
     • a portable JSON export                 MondermanReport.downloadJson(rawResult, filenameBase)

   Two adapters feed the model so every surface honors the four Diagnostics-tab
   promises (executive PDF read · quantified score · primary signal · portable JSON):
     • MondermanReport.fromRun(runResult): a single diagnostic run (its full_result_json / export shape)
     • MondermanReport.fromSynthesis(synthResult): a depth or cross-lens synthesis result (the /cross-diagnostic-synthesis payload; /cross-assessment-synthesis kept as a legacy alias)

   No dependencies. The PDF path is the browser's own print-to-PDF of the styled
   report, exactly as the original synthesis tool did it.
   ============================================================================ */
(function () {
  "use strict";
  // This identifies the code displaying/exporting the report now, not the
  // renderer that may have displayed a historical run when it was created.
  const RENDERER_VERSION = "diagnostic-renderer-evidence-reading-20260914.43";
  // The measured-report adapter stays at r43; financial reading order and
  // summary presentation have their own explicit, independently tested edition.
  const FINANCIAL_PRESENTATION_VERSION = "financial-presentation-20260915.1";

  // ---- small helpers --------------------------------------------------------
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toLocaleString("en-US") : "Unavailable";
  }
  function cur(n) {
    const x = Number(n);
    return Number.isFinite(x)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x)
      : "Unavailable";
  }
  function pct(n) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x) + "%" : "Unavailable";
  }
  function recordedDate(...values) {
    const value=values.find(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(v)&&Number.isFinite(Date.parse(v)));
    return value?new Date(value).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):'Not recorded';
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  function firstStr() {
    for (let i = 0; i < arguments.length; i++) {
      const s = arguments[i];
      // 8 Aug 2026: objects and arrays are skipped, never stringified. Scorer
      // results carry structured fields (trajectory, exposure) in slots this
      // helper scans, and String(object) is "[object Object]", which is what
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
  function safeParticipantEvidence(value) {
    const safety = window.MondermanParticipantEvidence;
    return safety && typeof safety.sanitizeEvidenceArray === "function"
      ? safety.sanitizeEvidenceArray(arr(value))
      : [];
  }
  function recordedParticipantEvidence(result) {
    const r = obj(result);
    if (arr(r.participant_evidence).length) return safeParticipantEvidence(r.participant_evidence);
    const layer = obj(r.experientialLayer || r.experiential_layer);
    const entries = arr(layer.entries).length ? layer.entries : ["self", "observedManagerial", "observedOperational", "observedSeniorLeader"].flatMap(key => {
      const entry = obj(layer[key]);
      return entry.text || entry.cleaned ? [{...entry, key, label: firstStr(entry.label, "Participant observation")}]: [];
    });
    return safeParticipantEvidence(entries);
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
  // Display compatibility for three exact deterministic identity caveats only.
  // Never traverse saved source, participant accounts, or AI-authored prose.
  function displayDepthIdentityCopy(value) {
    if (typeof value !== "string") return value;
    return value
      .replaceAll("This is not independent proof of unique physical people, a representative sample or an accurate population declaration.", "This is not independent proof of distinct people, a representative sample or an accurate population declaration.")
      .replaceAll("These are recorded account or invitation identities, not independently verified physical people.", "These are recorded account or invitation identities, not independently verified distinct people.")
      .replaceAll("Account and invitation records are not independent proof of unique physical people or of the declared population.", "Account and invitation records are not independent proof of distinct people or of the declared population.");
  }

  function fromSynthesis(result) {
    const r = obj(result);
    const compatibility = obj(r._claims_compatibility);
    const strictNum = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))) ? Number(v) : null;
    const product = r.synthesis_product === "depth_synthesis" || r.synthesis_mode === "depth" ? "depth" : "cross_lens";
    const evidence = obj(r.evidence_assessment);
    const scope = obj(evidence.scope);
    const versions = obj(evidence.versions);
    const timeWindow = obj(evidence.time_window);
    const identity = obj(evidence.source_identity);
    const balance = obj(evidence.lens_balance);
    const identityCopy = r.synthesis_product === "depth_synthesis" && obj(r.report_language).generation_version === "synthesis-report-language-20260910.3"
      ? displayDepthIdentityCopy : value => value;
    const representative = { ...obj(evidence.representativeness), statement: identityCopy(obj(evidence.representativeness).statement) };
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
        n: strictNum(g.submitted_runs ?? g.respondents ?? g.n),
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
    // Display-only compatibility for recognized legacy coverage labels. Never
    // rewrite saved action records or infer a label for an unknown action.
    const legacyCoverageLabels = {
      "structural_clarity depth": "Structural Clarity coverage",
      "decision_velocity depth": "Decision Velocity coverage",
      "operational_systems depth": "Operational Systems coverage",
      "institutional_performance depth": "Institutional Performance coverage"
    };
    const actions = arr(r.priority_actions).map((item) => {
      const action = typeof item === "string" ? { text: item } : obj(item);
      const label = firstStr(action.label, "Action");
      return {
        label: Object.prototype.hasOwnProperty.call(legacyCoverageLabels, label) ? legacyCoverageLabels[label] : label,
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
    const experiential = { ...obj(r.experiential) };
    for (const role of ["operational", "managerial", "senior_leader"]) {
      const detail = obj(obj(experiential.detail)[role]);
      if (experiential.participant_reports_available === false && detail.basis === "segment_statistics_only" && detail.text === experiential[role]) experiential[role] = identityCopy(experiential[role]);
    }
    const briefParagraphs = arr(briefing.paragraphs).map(firstStr).filter(Boolean).map(identityCopy);
    const selfRun = r.source_mode==='own_saved_runs' && ['self_run_synthesis','self_run_response_comparison'].includes(r.report_kind);
    const comparisonOnly = ['response_comparison','self_run_response_comparison'].includes(r.report_kind);
    const modeLabel = selfRun ? (comparisonOnly ? 'Self-run comparison' : 'Self-run Synthesis') : comparisonOnly ? 'Response comparison' : product === "depth" ? "Depth Synthesis" : "Cross-Lens Synthesis";
    const reads = strictNum(r.submitted_run_count ?? r.source_result_count ?? r.respondent_count) ?? sourceGroups.reduce((sum, group) => sum + (group.n || 0), 0);
    const lensCount = strictNum(r.lens_count) ?? sourceGroups.length;
    const evidenceLabel = firstStr(evidence.evidence_label, r.readiness_label, "Evidence band unavailable");
    const conditionBand = firstStr(r.condition_band, scorePublished ? "Observed condition" : "Composite withheld");
    const coverBody = firstStr(identityCopy(narrative.executive_summary), briefing.lede, diagnosis.body, r.primary_pattern);
    const filenameStem = product === "depth"
      ? "depth-synthesis-" + slug(sourceGroups[0]?.toolType || "diagnostic") + "-n" + (reads || "x")
      : "cross-lens-synthesis-n" + (reads || "x");

    return {
      kind: "meta-synthesis",
      aiReport: obj(r.ai_report),
      campaignEvidence:obj(r.campaign_evidence),
      comparisonOnly,
      selfRun,
      compatibility: compatibility,
      product: product,
      mastline: "Monderman. " + modeLabel,
      title: selfRun ? 'Your saved runs, considered together' : comparisonOnly ? 'Campaign response comparison' : product === "depth" ? "Depth Synthesis Executive Report" : "Cross-Lens Synthesis Executive Report",
      subtitle: selfRun ? 'A comparison of your own recorded views.' : comparisonOnly ? 'What the included participants reported, where their views differ and what to investigate next. This is not a population conclusion or an unlocked Synthesis.' : product === "depth"
        ? "Results from eligible runs of one Diagnostic, showing the median, score distribution, differences between participant perspectives and limits of the evidence."
        : "Results across Diagnostics, showing where findings agree, where they differ and whether the evidence supports a combined score.",
      meta: [
        { label: "Recorded", value: recordedDate(r.generated_at,r.saved_at,r.created_at) },
        { label: "Product", value: modeLabel },
        { label: "Runs", value: reads == null ? "Unavailable" : num(reads) },
        { label: "Lenses", value: lensCount == null ? "Unavailable" : num(lensCount) },
        { label: "Evidence", value: evidenceLabel }
      ],
      headlineScore: scorePublished ? (Number.isInteger(score) ? score : Math.round(score * 10) / 10) : selfRun ? 'Your comparison' : "Unavailable",
      headlineBand: selfRun ? (scorePublished?'Your selected scores only':'No combined score') : scorePublished ? (firstStr(r.score_label, conditionBand) + " · " + conditionBand) : "Composite withheld",
      coverBody: coverBody,
      scorePublished: scorePublished,
      score: score,
      scoreLabel: firstStr(r.score_label),
      scoreBasis: firstStr(r.score_basis),
      conditionBand: conditionBand,
      conditionSpread: obj(r.condition_spread),
      evidence: evidence,
      reads: reads,
      runCountNote: firstStr(identityCopy(r.participant_count_note), "Counts refer to submitted runs, not verified distinct people. One person may contribute more than one run."),
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
      financialScenario: obj(r.financial_scenario),
      ...(r.financial_benefit_assessment ? { financialBenefitAssessment: obj(r.financial_benefit_assessment) } : {}),
      actions: actions,
      remedyPaths: remedyPaths,
      outputPolicy: obj(r.output_policy),
      remedyStatement: firstStr(remedyBlock.statement),
      experiential: experiential,
      indicators: indicators,
      organizationalImplication: firstStr(narrative.organizational_implication, narrative.leadership_implication),
      sequencingLogic: firstStr(narrative.sequenced_action_logic),
      confidence: confidence,
      reads: reads,
      lensCount: lensCount,
      footnote: selfRun ? 'All selected runs belong to one account. This report supports reflection and further checks, not population conclusions, a Cross-Lens Composite Score, combined savings or an organization-wide preferred action.' : product === "depth"
        ? "These results describe the submitted runs of one Diagnostic. Applying them to a wider population requires a documented sampling plan and response coverage."
        : "This report is a directional cross-lens synthesis. A published composite is not a proven causal model; source evidence and alternative explanations remain necessary.",
      filenameBase: filenameStem,
      source: r
    };
  }

  // ---- adapter: single diagnostic run --> model -----------------------------
  // Reads the run's exported result shape (full_result_json) with broad fallbacks,
  // mirroring the synthesis lib's extractor so field names line up.
  // Legacy trajectory combines static scored conditions; its direction, label
  // and self-reported flag do not bind a compatible time comparison. Keep that
  // source intact, but do not turn it into a participant's claim of change.
  // Exact temporal answers remain available in the evidence and reviewed prose.
  const RUN_FOCUS_LABELS = Object.freeze({
    "Off-formal-path execution": "Work outside the standard process",
    "Escalation dependence": "Decisions referred to a higher level",
    "Accountability clarity": "Clarity about who is accountable",
    "Compensatory dependence": "Extra effort and management support"
  });

  function displayRunFocusLabel(value) {
    return Object.prototype.hasOwnProperty.call(RUN_FOCUS_LABELS, value) ? RUN_FOCUS_LABELS[value] : value;
  }

  function displayRunFinancialBoilerplate(value) {
    // Only these known generated clauses are adapted. Do not rewrite recorded
    // answers, reviewed prose, or arbitrary financial language in a saved report.
    return value
      .replace("It does not change the score or the modeled recovery scenario.", "It does not change the score.")
      .replace("Use the workload assumptions, measured dimensions, and repeated measurements when deciding what to do.", "Use the recorded answers, measured dimensions, and repeated measurements when deciding what to do.")
      .replace("; any time, cost, or capacity figures elsewhere in the report are modeled from submitted inputs, not observed consumption or realized loss.", ".");
  }

  const RUN_DIMENSION_LABELS = Object.freeze({
    decision_velocity: Object.freeze({
      cycle_velocity: "Decision timing",
      approval_efficiency: "Approval efficiency",
      coordination_load: "Coordination",
      execution_stability: "Execution stability"
    }),
    structural_clarity: Object.freeze({
      role_clarity: "Role clarity",
      decision_rights_clarity: "Decision authority",
      handoff_clarity: "Handoff clarity",
      accountability_clarity: "Accountability",
      duplicate_approvals_inverse: "Avoidance of duplicate approvals"
    }),
    operational_systems: Object.freeze({
      process_density: "Process steps",
      systems_friction: "Work across systems",
      reporting_exception_burden: "Reporting and exception handling",
      workaround_dependence: "Work outside the usual process",
      control_load: "Control requirements",
      upkeep_burden: "Administrative maintenance"
    }),
    institutional_performance: Object.freeze({
      execution_coherence: "Execution",
      decision_reliability: "Decision reliability",
      adaptive_capacity: "Ability to adapt",
      institutional_confidence: "Confidence in formal systems",
      performance_stability: "Performance stability",
      compensatory_effort: "Extra effort required"
    })
  });

  function displayRunDimensionLabel(toolType, key, fallback) {
    const toolKey = String(toolType || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
    const dimensionKey = String(key || "").trim().toLowerCase();
    return firstStr(RUN_DIMENSION_LABELS[toolKey]?.[dimensionKey], fallback, humanize(key));
  }

  function displayCalculationMethod(value) {
    const method = firstStr(value);
    if (method === "directional_scenario_not_empirical_benchmark") {
      return "Directional planning scenario, not an empirical benchmark";
    }
    return method ? humanize(method) : "";
  }

  const SCORING_VERSION_LABELS = Object.freeze({
    structural_clarity_high_score_good_2026_08_11_methodology_v4: "Structural Clarity scoring method, methodology version 4, August 11, 2026",
    decision_velocity_high_score_good_2026_08_12_release_v3: "Decision Velocity scoring method, release 3, August 12, 2026",
    operational_systems_high_score_good_2026_08_13_experience_neutral_v3: "Operational Systems scoring method, experience-neutral release 3, August 13, 2026",
    institutional_performance_high_score_good_2026_08_10_missingness_v2: "Institutional Performance scoring method, missing-data version 2, August 10, 2026"
  });

  function displayScoringVersion(value) {
    const version = firstStr(value);
    return firstStr(SCORING_VERSION_LABELS[version], version, "Not recorded");
  }

  const REPORTED_CONFIDENCE_LABELS = Object.freeze({
    high: "High",
    moderate: "Moderate",
    limited: "Limited"
  });

  function displayReportedAnswerConfidence(insightDepth, context) {
    const insight = obj(insightDepth);
    const savedContext = obj(context);
    const raw = Object.prototype.hasOwnProperty.call(insight, "confidence_level")
      ? insight.confidence_level
      : (Object.prototype.hasOwnProperty.call(savedContext, "confidenceLevel")
        ? savedContext.confidenceLevel
        : savedContext.confidence_level);
    if (typeof raw !== "string") return "Not recorded";
    const key = raw.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(REPORTED_CONFIDENCE_LABELS, key)
      ? REPORTED_CONFIDENCE_LABELS[key]
      : "Not recorded";
  }

  function hasGeneratedRemedyRecoveryRange(value) {
    const text = firstStr(value);
    return /\bDirectional reclaim band:\s*(?:\$[\d,.]+(?:\s*[–-]\s*\$[\d,.]+)?|Not estimated)\*{0,2}\.?\s*$/i.test(text)
      || /\bScenario value band:\s*(?:\$[\d,.]+(?:\s*[–-]\s*\$[\d,.]+)?|Not estimated);\s*this is not observed or protected value\.?\s*$/i.test(text)
      || /^(?:Scenario comparison band:|Low-disruption test\.\s*The scenario model shows up to|Targeted redesign test\.\s*The scenario model shows up to|Broadest scenario test\.\s*The model shows up to)/i.test(text);
  }

  function displayRemedyBenefit(value) {
    const text = firstStr(value);
    if (!text) return "";
    const withoutGeneratedSuffix = text
      .replace(/\s+Directional reclaim band:\s*(?:\$[\d,.]+(?:\s*[–-]\s*\$[\d,.]+)?|Not estimated)\*{0,2}\.?\s*$/i, "")
      .replace(/\s+Scenario value band:\s*(?:\$[\d,.]+(?:\s*[–-]\s*\$[\d,.]+)?|Not estimated);\s*this is not observed or protected value\.?\s*$/i, "")
      .trim();
    if (withoutGeneratedSuffix !== text) return withoutGeneratedSuffix;
    return hasGeneratedRemedyRecoveryRange(text) ? "" : text;
  }

  function displayRunFindings(toolType, result, values) {
    // Historical OS results used one sentence for both comparison flags and
    // single-answer probes. A flag alone does not establish conflicting answers.
    // Adapt that exact display sentence without changing the saved result.
    if (toolType !== "operational_systems") return values;
    const legacy = "Some submitted answers conflict about formal-system burden and reported operating experience; broader evidence is needed.";
    const flags = result.contradictions;
    const validFlags = Array.isArray(flags) && flags.length > 0 && flags.every(flag =>
      (typeof flag === "string" && flag.trim().length > 0)
      || (flag && typeof flag === "object" && !Array.isArray(flag)
        && [flag.code, flag.message, flag.label].some(value => typeof value === "string" && value.trim().length > 0))
    );
    const replacement = !validFlags
      ? "The saved report includes a caution flag, but this view does not establish which responses or conditions it concerns."
      : flags.length === 1
        ? "The saved result flags one response pattern. Review its recorded condition and qualification before drawing a conclusion."
        : "The saved result flags " + flags.length + " response patterns. Review each recorded condition and qualification before drawing a conclusion.";
    return values.map(value => value === legacy ? replacement : value);
  }

  function fromRun(run) {
    const envelope = obj(run);
    const r = obj(envelope.result).tool_type ? obj(envelope.result) : envelope;
    const compatibility = obj(r._claims_compatibility);
    const context = obj(envelope.input_context || r.input_context);
    const provenance = obj(envelope.provenance || envelope.provenance_json || r.provenance || r.provenance_json);
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
    const canonicalToolLabels = {
      decision_velocity: "Decision Velocity", structural_clarity: "Structural Clarity",
      operational_systems: "Operational Systems", institutional_performance: "Institutional Performance"
    };
    const toolLabel = firstStr(canonicalToolLabels[toolType], r.tool_label, toolType);
    const score = r.score != null ? r.score : (r.cross_diagnostic_score != null ? r.cross_diagnostic_score : "Unavailable");
    const band = firstStr(r.band, r.score_band, r.condition_band, "Unavailable");
    const benchmark = firstStr(r.benchmark_position, r.benchmarkPosition, r.peer_position, "Unavailable");
    const trajectory = "Not established by this run";
    const driver = firstStr(
      r.primary_driver, r.primary_constraint, r.primary_exposure_source,
      r.primary_burden_source, r.primary_structural_weakness, "Unavailable"
    );
    const findings = displayRunFindings(toolType, r, arr(r.key_findings).length ? arr(r.key_findings)
      : (arr(r.flags).length ? arr(r.flags) : arr(r.findings)));
    const watch = arr(r.watch_items).length ? arr(r.watch_items) : arr(r.contradictions);
    const actions = arr(prose.priority_actions).length ? arr(prose.priority_actions)
      : (arr(r.priority_actions).length ? arr(r.priority_actions)
        : (arr(r.intervention_priorities).length ? arr(r.intervention_priorities) : arr(r.recommendations)));
    const priorityLadder = arr(descriptor.priority_ladder).length ? arr(descriptor.priority_ladder) : arr(r.priority_ladder);
    const remedyPaths = arr(prose.remedy_paths).length ? arr(prose.remedy_paths) : arr(r.remedy_paths);
    const participantEvidence = recordedParticipantEvidence(r);

    const depth = firstStr(r.diagnostic_depth, r.diagnosticDepth);

    const summary = firstStr(
      summaryBlock.body, narrative.executive, narrative.headlineFinding,
      r.executive_summary, r.summary,
      toolType === "structural_clarity" ? "This summary explains the score, the main measured focus, and the first checks to consider." : "This summary explains the score, the main measured issue, and the first actions to consider."
    );
    const headline = firstStr(summaryBlock.headline, narrative.headlineFinding, r.score_band_note, summary);
    const bottomLine = sentenceLead(firstStr(
      narrative.opportunity, narrative.organizational_implication, r.organizational_implication,
      narrative.leadership_implication, r.leadership_implication, driver !== "Unavailable" ? driver : "",
      "Treat this as an initial interpretation of the measured condition."
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
      { k: "Change over time", v: trajectory }
    ];
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
    const dimensionEntries = Object.keys({...obj(coverage.dimensions),...dimensions}).map((key) => ({
      key: key,
      label: displayRunDimensionLabel(toolType, key, dimensionLabels[key]),
      score: strictFinite(dimensions[key]) ? Number(dimensions[key]) : null,
      coverage: obj(obj(coverage.dimensions)[key])
    }));
    const primarySignal = displayRunFocusLabel(firstStr(
      descriptor.primary_constraint_label, descriptor.dominant_burden_label,
      r.primary_driver, r.primary_constraint, driver
    ));
    const trajectoryObject = obj(r.trajectory);
    const evidenceBand = firstStr(insightDepth.band, r.input_confidence_label, context.confidenceLevel, "Directional single-run evidence")
      .replace(/\s+-\s+/g, ", ");
    const opportunity = firstStr(summaryBlock.opportunity, narrative.opportunity);
    const benchmarkDetail = displayRunFinancialBoilerplate(firstStr(prose.benchmark_interpretation, narrative.benchmark, benchmark));
    const tradeoff = firstStr(narrative.tradeoff, r.score_band_note);
    const firstMove = firstStr(textItem(actions[0]));
    const findingScope = firstStr(processName, metaScope, "the work described");
    const findingScopeWithArticle = /^[a-z]/.test(findingScope) && !/^(?:the|this|that)\b/i.test(findingScope)
      ? "the " + findingScope : findingScope;
    const centralFinding = primarySignal && primarySignal !== "Unavailable"
      ? "Main measured focus for " + findingScopeWithArticle + ": " + primarySignal + "."
      : sentenceLead(headline, 1);

    return {
      kind: "run",
      aiReport: obj(r.ai_report),
      compatibility: compatibility,
      product: "diagnostic",
      mastline: "Monderman. " + (toolLabel || "Diagnostic"),
      title: (toolLabel || "Diagnostic") + ": Executive Report",
      subtitle: "What this run measured, what the result may mean, what remains uncertain, and what to test next.",
      meta: [
        { label: "Recorded", value: recordedDate(r.generated_at,r.completed_at,r.created_at,envelope.created_at,provenance.generated_at) },
        { label: "Instrument", value: toolLabel || "Unavailable" }
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
      trajectoryNote: "",
      benchmarkDetail: benchmarkDetail,
      tradeoff: tradeoff,
      quadrant: displayRunFinancialBoilerplate(firstStr(r.quadrant_interpretation_text)),
      primarySignal: primarySignal,
      primarySignalNote: firstStr(descriptor.primary_constraint_note, descriptor.dominant_burden_note),
      dimensionEntries: dimensionEntries,
      priorityLadder: priorityLadder,
      remedyPaths: remedyPaths,
      outputPolicy: obj(r.output_policy),
      participantEvidence: participantEvidence,
      findings: findings,
      watch: watch,
      actions: actions,
      provenance: provenance,
      questionnaireVersion: firstStr(r.questionnaire_version, r.config_version, provenance.questionnaire_version, provenance.config_version),
      scorerVersion: firstStr(r.scorer_version, provenance.scorer_version),
      reportLanguage: obj(r.report_language || provenance.report_language),
      presentationCompatibility: obj(r._presentation_compatibility),
      financialLegacyView: obj(r.financial_legacy_view),
      kvs: kvs,
      sections: sections,
      footnote: "This report is based on one participant's answers for the stated scope. " + (toolType === "structural_clarity" ? "It identifies dimensions to compare and checks to consider; a comparison alone does not establish a need for change. " : "It suggests issues to investigate and changes to test. ") + "It does not show how common these conditions are, prove their causes or predict performance. Organizational time and money estimates require separate operational measurements beyond a single run.",
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
  function fmt1(v) { return strictFinite(v) ? (Math.round(Number(v) * 10) / 10).toLocaleString("en-US") : "Unavailable"; }
  function fmtWhole(v) { return strictFinite(v) ? Math.round(Number(v)).toLocaleString("en-US") : "Unavailable"; }
  function fmtMoney(v) { return strictFinite(v) ? cur(Number(v)) : "Unavailable"; }
  function fmtPercent(v) { return strictFinite(v) ? (Math.round(Number(v) * 10) / 10).toLocaleString("en-US") + "%" : "Unavailable"; }
  function fmtPair(values, formatter) {
    const pair = arr(values);
    if (pair.length < 2 || !strictFinite(pair[0]) || !strictFinite(pair[1])) return "Unavailable";
    return formatter(pair[0]) + " – " + formatter(pair[1]);
  }
  function humanize(v) {
    return String(v || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function evidenceCard(label, value, detail) {
    if (!value && !detail) return "";
    return '<div class="mr-lens-card"><div class="mr-lens-label">' + esc(label) + '</div>' +
      '<div style="font-family:\"Neue Haas Grotesk\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:1rem;font-weight:700;margin:7px 0 6px">' + esc(value || "Unavailable") + '</div>' +
      (detail ? '<p class="mr-copy">' + esc(detail) + '</p>' : '') + '</div>';
  }
  function textItem(item) {
    if (item == null) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") return firstStr(item.text, item.message, item.label);
    return String(item);
  }

  // These are explanations of stored scorer statuses, not deductions about
  // which answers a participant omitted. Never expose internal status keys or
  // turn an unavailable value into zero.
  function exposureReason(value) {
    const reasons = {
      missing_sizing_inputs: "Required sizing inputs are missing or unusable.",
      missing_hours_per_run: "Time per run is missing or unusable.",
      missing_annual_cycles: "Annual frequency is missing or unusable.",
      missing_hourly_cost: "Hourly labor cost is missing or unusable.",
      missing_hourly_rate: "Hourly labor rate is missing or unusable.",
      input_saturation: "The modeled hours meet or exceed the available capacity used in the calculation.",
      attributed_hours_exceed_available_capacity: "Attributed hours exceed the supplied available capacity."
    };
    return typeof value === 'string' && Object.hasOwn(reasons, value) ? reasons[value] : "An explanation for the unavailable estimate was not recorded.";
  }

  function renderExecutiveDecisionFrame(m, n) {
    const exp = obj(m.exposure);
    const diagnosis = obj(m.diagnosis);
    const firstAction = arr(m.actions)[0] || {};
    const annualCost = strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Cost not calculated";
    const annualHours = strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " hrs" : "Time not calculated";
    const scoreValue = m.scorePublished && strictFinite(m.score) ? fmt1(m.score) : "Withheld";
    const metrics = [
      ["Condition", scoreValue, m.product === "depth" ? "Observed median" : "Equal-lens composite"],
      ["Evidence", firstStr(m.evidenceLabel, "Unavailable"), "Claim strength"],
      ["Included runs", strictFinite(m.reads) ? fmtWhole(m.reads) : "Unavailable", m.product === "depth" ? "One Diagnostic" : fmtWhole(m.lensCount) + " Diagnostics"],
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
        (actionText ? '<div><div class="mr-lens-label">First thing to test</div><h3>' + esc(actionLabel) + '</h3><p>' + esc(actionText) + '</p></div>' : '') +
      '</div></section>';
  }

  function renderEvidenceLadder(m) {
    if(m.campaignEvidence?.depth)return '<p class="mr-copy">Campaign readiness checks the declared population, compatible measurements and the possible effect of missing responses. Passing these checks is not scientific validation or a probability of accuracy.</p>';
    const labels = m.product === "depth"
      ? ["Limited", "Developing", "Substantial", "Large"]
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
      evidenceCard("Evidence strength", m.evidenceLabel, ""),
      evidenceCard(
        m.product === "depth" ? "Median Diagnostic Score" : (m.scorePublished ? "Cross-Lens Composite Score" : "Cross-Lens Composite Score Withheld"),
        m.scorePublished ? "Published" : "Withheld",
        m.scoreBasis
      ),
      evidenceCard("Scope", firstStr(scope.label, humanize(scope.status)), firstStr(scope.statement)),
      evidenceCard("Run-count balance across Diagnostics", firstStr(humanize(balance.status), "Not applicable"), strictFinite(balance.ratio) ? "Largest-to-smallest submitted-run count ratio: " + fmt1(balance.ratio) + ":1" : "Not applicable to one-Diagnostic Depth Synthesis."),
      evidenceCard("Questionnaire and scoring versions", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? "Conflicting Diagnostics: " + versions.conflicting_lenses.map(humanize).join(", ") : ""),
      evidenceCard("Identifiers for submitted runs", humanize(identity.status), firstStr(identity.statement)),
      evidenceCard("Measurement window", humanize(timeWindow.status), firstStr(timeWindow.statement)),
      evidenceCard("Representativeness", firstStr(representative.label, humanize(representative.status)), firstStr(representative.statement))
    ].filter(Boolean);
    const cardGroups = [cards.slice(0, 4), cards.slice(4)].filter((group) => group.length)
      .map((group) => '<div class="mr-evidence-group">' + group.join("") + '</div>').join("");
    return '<section class="mr-section mr-evidence-status"><h2>' + n + '. Evidence in this run</h2>' +
      '<div class="callout"><p><strong>' + esc(m.evidenceLabel) + '.</strong> ' + esc(m.evidenceDescription || "The evidence band governs what this Synthesis is allowed to claim.") + '</p></div>' +
      '<p class="mr-copy mr-run-count-note">'+esc(m.runCountNote)+'</p>'+renderEvidenceLadder(m) +
      '<div class="mr-lens-grid mr-evidence-grid">' + cardGroups + '</div></section>';
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
    const segmentRows = segments.map((segment) => {
      const s = obj(segment), hasMean = strictFinite(s.mean_score), hasMedian = strictFinite(s.median_score);
      // A missing statistic is not interchangeable with the other statistic.
      // Long or right-edge value labels get their own row within the chart.
      const labelBelow = !hasMean || !hasMedian || Number(s.mean_score) > 70;
      return { s, hasMean, hasMedian, labelBelow, height: labelBelow ? 54 : 36 };
    });
    const H = 148 + segmentRows.reduce((height, row) => height + row.height, 0);
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
    let segmentY = 146;
    segmentRows.forEach(({ s, hasMean, hasMedian, labelBelow, height }) => {
      const y = segmentY;
      segmentY += height;
      const mean = hasMean ? Number(s.mean_score) : null;
      const med = hasMedian ? Number(s.median_score) : null;
      svg += '<g class="mr-depth-segment-plot">';
      svg += '<text x="' + L + '" y="' + (y+4) + '" font-size="12" font-weight="600" fill="#18191C">' + esc(humanize(s.participant_mode)) + ' · ' + esc(fmtWhole(s.n)) + ' runs</text>';
      svg += '<line x1="' + X(0) + '" y1="' + (y+14) + '" x2="' + X(100) + '" y2="' + (y+14) + '" stroke="rgba(24,25,28,.09)"/>';
      if (hasMean) svg += '<circle class="mr-depth-segment-mean" cx="' + X(mean) + '" cy="' + (y+14) + '" r="6" fill="#0C6E78"/>';
      if (hasMedian) svg += '<circle class="mr-depth-segment-median" cx="' + X(med) + '" cy="' + (y+14) + '" r="3" fill="#fff" stroke="#08383E" stroke-width="2"/>';
      svg += '<text class="mr-depth-segment-label" x="' + (labelBelow ? W-R : X(mean)+12) + '" y="' + (y+(labelBelow ? 36 : 18)) + '" text-anchor="' + (labelBelow ? 'end' : 'start') + '" font-size="11" fill="#6E6F73">mean ' + esc(hasMean ? fmt1(mean) : 'Not available') + ' · median ' + esc(hasMedian ? fmt1(med) : 'Not available') + '</text></g>';
    });
    svg += '</svg>';
    // A fixed-width SVG scaled into a phone panel makes its labels unreadable.
    // The compact view presents the same recorded values as native text.
    const summary = '<div class="mr-synth-compact"><dl class="mr-synth-stat-list">' +
      [['Median', fmt1(read.median)], ['Mean', strictFinite(read.mean) ? fmt1(read.mean) : 'Not available'],
        ['Range', fmt1(read.min) + '–' + fmt1(read.max)], ['Interquartile range', fmtPair(read.iqr, fmt1)],
        ...(strictFinite(read.sd) ? [['Sample standard deviation', fmt1(read.sd)]] : [])]
        .map(([label,value]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>').join('') + '</dl>' +
      (segments.length ? '<div class="mr-synth-segment-list">' + segments.map((segment) => {
        const s = obj(segment);
        const mean = strictFinite(s.mean_score) ? fmt1(s.mean_score) : 'Not available';
        const median = strictFinite(s.median_score) ? fmt1(s.median_score) : 'Not available';
        return '<div class="mr-synth-segment"><strong>' + esc(humanize(s.participant_mode)) + '</strong><span>' +
          esc(fmtWhole(s.n)) + (Number(s.n) === 1 ? ' submitted run' : ' submitted runs') + '</span><dl class="mr-synth-stat-list"><div><dt>Mean</dt><dd>' +
          esc(mean) + '</dd></div><div><dt>Median</dt><dd>' + esc(median) + '</dd></div></dl></div>';
      }).join('') + '</div>' : '') + '</div>';
    return '<div class="mr-viz-panel mr-depth-distribution-panel"><div class="mr-viz-title">Distribution at a glance</div>' + svg + summary + '<p class="mr-copy"><span class="mr-synth-wide-caption">Box = interquartile range; dark line = median; amber dot = mean. </span>Results by participant perspective describe the submitted groups; they do not change how the Median Diagnostic Score is calculated.</p></div>';
  }

  function renderDepthDistribution(m, n) {
    if (m.product !== "depth" || !arr(m.sampleReads).length) return "";
    const cards = arr(m.sampleReads).map((read) => {
      const consensus = obj(read.consensus);
      const segments = arr(read.segments).map((segment) => {
        const s = obj(segment);
        return '<div class="k">' + esc(humanize(s.participant_mode)) + ' · ' + esc(fmtWhole(s.n)) + ' runs</div><div>Mean ' + esc(fmt1(s.mean_score)) + ' · median ' + esc(fmt1(s.median_score)) + '</div>';
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
        '</div><div class="mr-depth-stat-interpretation">' +
        (consensus.detail ? '<div class="callout"><p><strong>' + esc(humanize(consensus.read)) + '.</strong> ' + esc(consensus.detail) + '</p></div>' : '') +
        (segments ? '<h3 style="margin-top:20px">Results by participant perspective</h3><div class="kvs">' + segments + '</div>' : '') +
        (read.vantageGap?.statement ? '<p class="mr-copy"><strong>Difference between perspectives:</strong> ' + esc(read.vantageGap.statement) + '</p>' : '') +
        (read.interpretationLimit ? '<p class="mr-copy">' + esc(read.interpretationLimit) + '</p>' : '') +
      '</div></div>';
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
        runMetric("Perspective difference", strictFinite(gap.gap) ? fmt1(gap.gap) + " pts" : "Not established", strictFinite(gap.gap) ? humanize(gap.low_segment) + " to " + humanize(gap.high_segment) : "No published difference between participant perspectives", "amber") +
        runMetric("Coverage", strictFinite(read.n) ? fmtWhole(read.n) + " runs" : fmtWhole(m.reads) + " runs", m.evidenceLabel, "green") +
      '</div><div class="mr-depth-reading-grid"><div><div class="mr-lens-label">Agreement versus divergence</div><p>' + esc(firstStr(obj(read.consensus).detail, "The distribution should be read with its spread and perspective segments, not as a uniform participant experience.")) + '</p></div>' +
      '<div><div class="mr-lens-label">Mean and median</div><strong>' + esc(strictFinite(meanMedianGap) ? fmt1(meanMedianGap) + " pt mean–median gap" : "Not calculable") + '</strong><p>' + esc(strictFinite(meanMedianGap) && meanMedianGap <= 2 ? "The mean and median are closely aligned in the submitted set." : "Consider the difference between the mean and median when reading the overall result.") + '</p></div></div></section>';
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
    const showComposite = m.scorePublished && strictFinite(m.score);
    if (showComposite) {
      // Leave each score row clear of the reference line, regardless of its x-position.
      for (let index = 0; index <= groups.length; index++) {
        const y1 = index === 0 ? 36 : top + (index-1) * rowH + 12;
        const y2 = index === groups.length ? H-28 : top + index * rowH - 12;
        svg += '<line x1="' + X(m.score) + '" y1="' + y1 + '" x2="' + X(m.score) + '" y2="' + y2 + '" stroke="#08383E" stroke-width="2.5" stroke-dasharray="5 4"/>';
      }
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
      svg += '<text x="' + (labelW-12) + '" y="' + (y+20) + '" text-anchor="end" font-size="10.5" fill="#9A9892">median ' + esc(fmt1(lens.median)) + ' · ' + esc(fmtWhole(lens.n)) + ' runs</text>';
    });
    svg += '</svg>';
    return '<div class="mr-viz-panel mr-cross-lens-comparison"><div class="mr-viz-title">Diagnostic lenses on one scale</div>' + svg + '<p class="mr-copy">Dots are per-Diagnostic mean scores; horizontal marks show each lens IQR when available. ' + (showComposite ? 'The dashed Composite line is the equal-lens mean. ' : '') + 'Run count does not change a lens\'s weight in a published Composite score.</p></div>';
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
    svg += '<circle class="mr-system-hub" cx="' + centerX + '" cy="' + centerY + '" r="76" fill="url(#mr-system-gradient)"/>';
    svg += '<circle cx="' + centerX + '" cy="' + centerY + '" r="83" fill="none" stroke="rgba(12,110,120,.16)" stroke-width="2"/>';
    svg += '<text x="' + centerX + '" y="' + (centerY - 23) + '" text-anchor="middle" fill="#A9CED1" font-size="10" font-weight="700" letter-spacing="1.6">CROSS-LENS</text>';
    // The lower label already states COMPOSITE WITHHELD. Repeating the long
    // word "Unavailable" in the fixed-width hub clips at report/PDF sizes, so
    // the score position uses the site's compact N/A convention.
    svg += '<text class="mr-system-score" x="' + centerX + '" y="' + (centerY + 15) + '" text-anchor="middle" fill="#FFF" font-size="38" font-weight="700" letter-spacing="-.5">' + esc(m.scorePublished ? fmt1(m.score) : "N/A") + '</text>';
    svg += '<text class="mr-system-composite-label" x="' + centerX + '" y="' + (centerY + 35) + '" text-anchor="middle" fill="#A9CED1" font-size="9.5" font-weight="700" letter-spacing=".55">';
    compositeLabel.forEach((line, index) => {
      svg += '<tspan x="' + centerX + '" dy="' + (index ? 13 : 0) + '">' + esc(line) + '</tspan>';
    });
    svg += '</text>';
    groups.forEach((lens, index) => {
      const point = positions[index], label = splitSvgLabel(lens.toolLabel);
      const x = point[0] - 96, y = point[1] - 56;
      svg += '<rect x="' + x + '" y="' + y + '" width="192" height="112" rx="11" fill="#FFF" stroke="#DCD8CF"/>';
      svg += '<rect x="' + x + '" y="' + y + '" width="4" height="112" rx="2" fill="#0C6E78"/>';
      svg += '<text x="' + (x + 18) + '" y="' + (y + 24) + '" fill="#6E6F73" font-size="10" font-weight="700" letter-spacing=".7">' + esc(label[0].toUpperCase()) + '</text>';
      if (label[1]) svg += '<text x="' + (x + 18) + '" y="' + (y + 38) + '" fill="#6E6F73" font-size="10" font-weight="700" letter-spacing=".7">' + esc(label[1].toUpperCase()) + '</text>';
      svg += '<text class="mr-system-lens-value" x="' + (x + 18) + '" y="' + (y + 69) + '" fill="#18191C" font-size="25" font-weight="700">' + esc(fmt1(lens.mean)) + '</text>';
      svg += '<text class="mr-system-lens-meta" x="' + (x + 18) + '" y="' + (y + 93) + '" fill="#6E6F73" font-size="11">mean · ' + esc(fmtWhole(lens.n)) + ' runs</text>';
    });
    svg += '</svg>';
    const summary = '<div class="mr-synth-compact"><div class="mr-system-compact-composite"><strong>' +
      esc(m.scorePublished ? 'Equal-lens Composite' : 'Composite withheld') + '</strong><span>' +
      esc(m.scorePublished ? fmt1(m.score) : 'Unavailable') + '</span></div><div class="mr-synth-segment-list">' +
      groups.map((lens) => '<div class="mr-synth-segment"><strong>' + esc(lens.toolLabel) + '</strong><span>' +
        esc(fmtWhole(lens.n)) + (Number(lens.n) === 1 ? ' submitted run' : ' submitted runs') + '</span><dl class="mr-synth-stat-list"><div><dt>Mean</dt><dd>' +
        esc(fmt1(lens.mean)) + '</dd></div></dl></div>').join('') + '</div></div>';
    return '<div class="mr-viz-panel mr-system-panel"><div class="mr-viz-title">Diagnostic lenses at a glance</div>' + svg + summary + '<p class="mr-copy">Every Diagnostic receives one vote in the Composite. Submitted run counts affect evidence coverage, not lens weight; they do not establish how many distinct people responded.<span class="mr-synth-wide-caption"> Connectors show composition, not causation.</span></p></div>';
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
    return '<div class="mr-viz-panel mr-interaction-panel"><div class="mr-viz-title">Signals appearing across Diagnostics</div><div class="mr-interaction-grid" style="--lens-count:' + groups.length + '">' + header + rows + '</div>' +
      (compounding.length ? '<div class="mr-compounding-read"><div class="mr-lens-label">Signals appearing in more than one Diagnostic</div>' + compounding.map((signal) => '<p><strong>' + esc(signal.label) + '.</strong> ' + esc(signal.text) + '</p>').join("") + '</div>' : '') +
      '<p class="mr-copy">Filled marks show which Diagnostic evidence participates in each recurring signal. A signal appearing in more than one Diagnostic is a reason to investigate it across lenses; it does not establish a causal chain.</p></div>';
  }

  function renderCrossLensSystemRead(m, n) {
    if (m.product !== "cross_lens") return "";
    const groups = arr(m.sourceGroups).filter((lens) => strictFinite(lens.mean));
    const values = groups.map((lens) => Number(lens.mean));
    const highest = values.length ? Math.max.apply(null, values) : null;
    const lowest = values.length ? Math.min.apply(null, values) : null;
    // Equal means do not establish a single strongest or weakest lens.
    // Keep every joint extreme, independent of the submitted group order.
    const highestLabels = groups.filter((lens) => Number(lens.mean) === highest).map((lens) => lens.toolLabel).sort();
    const lowestLabels = groups.filter((lens) => Number(lens.mean) === lowest).map((lens) => lens.toolLabel).sort();
    const spread = values.length ? Math.max.apply(null, values) - Math.min.apply(null, values) : null;
    const exp = obj(m.exposure), firstAction = arr(m.actions)[0] || {};
    return '<section class="mr-section mr-system-read"><div class="mr-section-index">0' + n + ' · Diagnostic comparison</div><h2>' + esc(firstStr(obj(m.diagnosis).name, "Cross-Lens operating pattern")) + '</h2>' +
      '<p class="mr-exec-lede">' + esc(firstStr(obj(m.diagnosis).body, m.primaryPattern, m.briefing?.lede)) + '</p>' + renderCrossLensSystemGraphic(m) + renderCrossLensInteractionMatrix(m) +
      '<div class="mr-system-metrics">' +
        runMetric("Composite condition", m.scorePublished ? fmt1(m.score) : "Withheld", firstStr(m.conditionBand, m.scoreBasis), "teal") +
        runMetric(highestLabels.length > 1 ? "Joint highest mean" : "Highest mean", highestLabels.join(", ") || "Unavailable", highestLabels.length ? fmt1(highest) + " mean" : "", "green") +
        runMetric(lowestLabels.length > 1 ? "Joint lowest mean" : "Lowest mean", lowestLabels.join(", ") || "Unavailable", lowestLabels.length ? fmt1(lowest) + " mean" : "", "amber") +
        runMetric("Observed spread", strictFinite(spread) ? fmt1(spread) + " pts" : "Unavailable", m.evidenceLabel, "ink") +
      '</div><div class="mr-system-decision">' +
        (firstAction.text ? '<div><div class="mr-lens-label">First evidence-proportionate move</div><h3>' + esc(firstStr(firstAction.label, "First thing to test")) + '</h3><p>' + esc(firstAction.text) + '</p></div>' : '') +
        '<div><div class="mr-lens-label">From findings to action</div><strong>Check the work behind the result</strong><p>Use the reported patterns to choose a bounded test. Any financial scenario requires separate operational records and explicit assumptions.</p></div>' +
      '</div></section>';
  }

  function renderLensSummary(m, n) {
    if (!arr(m.sourceGroups).length) return "";
    const isCrossLens = m.product === "cross_lens";
    const cards = arr(m.sourceGroups).map((lens) => {
      return '<div class="mr-lens-card"' + (isCrossLens ? ' role="listitem"' : '') + '><div class="mr-lens-label"' + (isCrossLens ? ' role="heading" aria-level="3"' : '') + '>' + esc(lens.toolLabel) + '</div>' +
        '<div class="mr-contributing-score' + (strictFinite(lens.mean) ? '' : ' is-unavailable') + '">' + esc(fmt1(lens.mean)) + '<span>Mean score</span></div>' +
        '<p class="mr-copy mr-contributing-meta"><span>Median score: ' + esc(fmt1(lens.median)) + '</span><span>Submitted runs: ' + esc(fmtWhole(lens.n)) + '</span></p>' +
        '<p class="mr-copy">Middle half of scores: ' + esc(fmtPair(lens.iqr, fmt1)) + '<br>Full score range: ' + esc(fmtPair(lens.range, fmt1)) + '</p>' +
        (lens.driver ? '<span class="mr-pill">' + esc(humanize(lens.driver)) + '</span>' : '') +
      '</div>';
    }).join("");
    const graphic = isCrossLens ? renderCrossLensGraphic(m) : "";
    return '<section class="mr-section' + (isCrossLens ? ' mr-cross-lens-summary' : '') + '"><h2>' + n + '. Contributing Diagnostic lens' + (m.sourceGroups.length === 1 ? '' : 'es') + '</h2>' + graphic +
      '<div class="mr-lens-grid"' + (isCrossLens ? ' role="list" aria-label="Contributing Diagnostic lenses"' : '') + '>' + cards + '</div></section>';
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
      // Serialize the two endpoints before deriving the width. Rounding the
      // complementary percentages independently can otherwise emit a strip
      // whose right edge is 100.01% (for example, low 1 / high 32).
      const serializedLeft = Number(left.toFixed(2));
      const serializedWidth = Number(Math.max(0, 100 - serializedLeft).toFixed(2));
      const median = Math.max(0, Math.min(100, (md / hi) * 100));
      const pointClass = serializedWidth === 0
        ? ' is-point' + (serializedLeft === 0 ? ' is-left-edge' : serializedLeft === 100 ? ' is-right-edge' : '')
        : '';
      rows.push('<div class="mr-range-row"><div class="mr-range-head"><strong>' + esc(label) + '</strong><span>' + esc(formatter(lo)) + ' – ' + esc(formatter(hi)) + '</span></div>' +
        '<div class="mr-range-track"><span class="mr-range-iqr' + pointClass + '" style="left:' + serializedLeft.toFixed(2) + '%;width:' + serializedWidth.toFixed(2) + '%"></span><span class="mr-range-median" style="left:' + median.toFixed(2) + '%"></span></div>' +
        '<div class="mr-range-foot">Median ' + esc(formatter(md)) + '</div></div>');
    }
    row('Modeled annual hours', exp.annual_hours_low, exp.annual_hours, exp.annual_hours_high, fmtWhole);
    row('Modeled annual labor cost', exp.annual_cost_low, exp.annual_cost, exp.annual_cost_high, fmtMoney);
    if (!rows.length) return "";
    return '<div class="mr-viz-panel mr-exposure-range"><div class="mr-viz-title">Range of modeled estimates</div>' + rows.join("") + '<p class="mr-copy">Range bars summarize modeled estimates from runs with enough data for a cost estimate. Hours and cost use separate local scales; bar lengths should not be compared across the two metrics.</p></div>';
  }

  // BEGIN THREE BENEFIT PRESENTATION 20260919.1
  const THREE_BENEFIT_KEYS = ['spendingReduction', 'spendingAvoidance', 'staffCapacity'];
  const THREE_BENEFIT_LABELS = {spendingReduction:'Lower current spending',spendingAvoidance:'Avoided future spending',staffCapacity:'Retained staff capacity'};
  const THREE_BENEFIT_CASES = ['low','central','high'];
  const THREE_BENEFIT_COST_CASE = {low:'high',central:'central',high:'low'};
  const threeBenefitNumber = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
  const threeBenefitMoney = value => (value<0?'-$':'$')+threeBenefitNumber(Math.abs(value));
  const threeBenefitHeadlineMoney = value => (value<0?'-$':'$')+Math.abs(value).toLocaleString('en-US',{maximumFractionDigits:0});

  function threeBenefitPresentation(m) {
    const s=obj(m.financialScenario),i=obj(s.inputs),t=obj(s.totals),levels=THREE_BENEFIT_CASES;
    if(m.kind!=='meta-synthesis'||m.selfRun||s.version!=='operational-planning-scenario-20260919.2'||i.schemaVersion!=='operational-planning-input-20260919.2'
      ||!['early_planning_scenario','synthesis_planning_scenario'].includes(s.kind)||s.currency!=='USD'
      ||!m.campaignEvidence?.scopeId||obj(s.scope).scopeId!==m.campaignEvidence.scopeId
      ||!/^[a-f0-9]{64}$/.test(s.digest||(s.publication_projection==='three-benefit-scenario-public-20260919.1'?s.source_identity_digest:'')||'')||!Number.isFinite(Date.parse(s.createdAt))
      ||i.scopeConfirmed!==true||i.overlapReviewed!==true||obj(s.method).usesDiagnosticScores!==false||obj(s.method).isConfidenceInterval!==false)return null;
    const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e14;
    const text=(v,max=500,min=3)=>typeof v==='string'&&v.trim()===v&&v.length>=min&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
    const range=(v,negative=false,ordered=false,max=1e14)=>v&&levels.every(k=>finite(v[k])&&(negative||v[k]>=0)&&Math.abs(v[k])<=max)&&(!ordered||(v.low<=v.central&&v.central<=v.high));
    // Each saved row is rounded once to cents. Reconcile using an explicit,
    // row-count-bounded half-cent allowance, not percentage-based tolerance.
    const close=(actual,expected,rows=1)=>finite(actual)&&finite(expected)&&Math.abs(actual-expected)<=.005*(rows+1)+.000001;
    const same=(a,b,n=1)=>range(a,true)&&range(b,true)&&levels.every(k=>close(a[k],b[k],n));
    const sum=(rows,key,k)=>rows.reduce((v,row)=>v+row[key][k],0);
    const normalize=v=>String(v).trim().toLowerCase().replace(/\s+/g,' ');
    if(!Number.isInteger(i.horizonMonths)||i.horizonMonths<1||i.horizonMonths>36||!text(i.title,120)||!text(i.costBasis)
      ||!range(i.implementationCashCost,false,true,1e12)||!range(i.implementationCapacityCost,false,true,1e12)
      ||!finite(i.subscriptionCost)||i.subscriptionCost<0||i.subscriptionCost>1e12)return null;
    const cap=obj(i.capacity),benefits=obj(s.benefits),coverage=obj(s.coverage),statuses=['estimated','none_identified','not_estimated'];
    for(const key of THREE_BENEFIT_KEYS){
      const category=obj(key==='staffCapacity'?cap:i[key]),b=obj(benefits[key]);
      if(!statuses.includes(category.status)||!text(category.basis)||b.status!==category.status||b.basis!==category.basis||!Array.isArray(b.missingInputs)||!b.missingInputs.every(v=>text(v)))return null;
      if(category.status==='not_estimated'){if(b.amount!==null||!b.missingInputs.length||(key==='staffCapacity'&&b.hours!==null))return null;}
      else if(!range(b.amount)||(key==='staffCapacity'&&!range(b.hours)))return null;
      if(category.status==='none_identified'&&levels.some(k=>b.amount[k]!==0||(key==='staffCapacity'&&b.hours[k]!==0)))return null;
    }
    const categorySet=(field,status)=>Array.isArray(coverage[field])&&coverage[field].length===THREE_BENEFIT_KEYS.filter(k=>benefits[k].status===status).length&&new Set(coverage[field]).size===coverage[field].length&&coverage[field].every(k=>THREE_BENEFIT_KEYS.includes(k)&&benefits[k].status===status);
    if(!categorySet('estimatedCategories','estimated')||!categorySet('zeroCategories','none_identified')||!categorySet('missingCategories','not_estimated')||coverage.complete!==(coverage.missingCategories.length===0))return null;
    if(!Array.isArray(cap.activities)||!Array.isArray(s.activities)||s.activities.length!==cap.activities.length||s.activities.length>12)return null;
    const activityIds=new Set(),activityLabels=new Set(),calculated=new Map();
    if(cap.status==='estimated'){
      const start=Date.parse(cap.measurementStart),end=Date.parse(cap.measurementEnd),days=(end-start)/86400000;
      if(!Number.isFinite(start)||!Number.isFinite(end)||days<1||days>366||end>Date.parse(s.createdAt)||!Number.isSafeInteger(cap.measuredPeople)||cap.measuredPeople<1||!cap.activities.length)return null;
      for(const a of cap.activities){
        if(!a||!text(a.id,64)||!/^[A-Za-z0-9_-]{3,64}$/.test(a.id)||!text(a.label,120)||activityIds.has(normalize(a.id))||activityLabels.has(normalize(a.label))||!finite(a.measuredHours)||a.measuredHours<0||a.measuredHours>1e9
          ||!finite(a.loadedHourlyCost)||a.loadedHourlyCost<0||a.loadedHourlyCost>10000||!['operational_records','time_study','bounded_test'].includes(a.sourceBasis)
          ||!text(a.sourceReference,240)||!text(a.changeBasis)||!range(a.reductionPercent,false,true,100)||!range(a.adoptionPercent,false,true,100))return null;
        activityIds.add(normalize(a.id));activityLabels.add(normalize(a.label));
        const r=s.activities.find(row=>row?.id===a.id);
        if(!r||r.label!==a.label||!['grossHoursFreed','hoursUsedForSpendingReduction','hoursUsedForSpendingAvoidance','potentialHoursFreed','capacityValue'].every(k=>range(r[k])))return null;
        const gross=Object.fromEntries(levels.map(k=>[k,a.measuredHours*(i.horizonMonths*365.25/12)/days*a.reductionPercent[k]/100*a.adoptionPercent[k]/100]));
        if(!same(r.grossHoursFreed,gross)||!levels.every(k=>close(r.potentialHoursFreed[k],r.grossHoursFreed[k]-r.hoursUsedForSpendingReduction[k]-r.hoursUsedForSpendingAvoidance[k],3)))return null;
        calculated.set(a.id,{input:a,row:r,gross});
      }
      if(cap.activities.reduce((n,a)=>n+a.measuredHours,0)>cap.measuredPeople*days*24)return null;
    }else if(cap.activities.length||s.activities.length||cap.measurementStart!==null||cap.measurementEnd!==null||cap.measuredPeople!==null)return null;
    const ids=new Set(),resources=new Set(),labels=new Set(),expenseInputs=[];
    for(const key of ['spendingReduction','spendingAvoidance']){
      const category=i[key];
      if(!Array.isArray(category.items)||category.items.length>12||(category.status==='estimated'?category.items.length<1:category.items.length!==0))return null;
      for(const item of category.items){
        if(!item||!text(item.id,64)||!/^[A-Za-z0-9_-]{3,64}$/.test(item.id)||!text(item.resourceId,120)||!text(item.label,120)||ids.has(normalize(item.id))||resources.has(normalize(item.resourceId))||labels.has(normalize(item.label))
          ||!['labor','non_labor'].includes(item.kind)||!text(item.unit,40,1)||!finite(item.baselineMonthlyUnits)||item.baselineMonthlyUnits<0||item.baselineMonthlyUnits>1e9||!finite(item.unitCost)||item.unitCost<0||item.unitCost>1e9
          ||!Number.isInteger(item.startMonth)||!Number.isInteger(item.endMonth)||item.startMonth<1||item.endMonth<item.startMonth||item.endMonth>i.horizonMonths
          ||!range(item.reductionPercent,false,true,100)||!range(item.adoptionPercent,false,true,100)||!text(item.sourceReference,240)||!text(item.changeBasis))return null;
        if(item.kind==='labor'?(item.unit!=='hours'||!calculated.has(item.capacityActivityId)):(item.capacityActivityId!==null||/(?:^|\s)(?:h|hrs?|hours?|mins?|minutes?|days?|weeks?|months?|years?|ftes?|staff|people|persons?|employees?|workers?|manhours?|personhours?|staffhours?|workhours?|persondays?|mandays?|workdays?|full\s*time\s*equivalents?)(?:\s|$)/i.test(normalize(item.unit).replace(/[-_./]+/g,' '))))return null;
        ids.add(normalize(item.id));resources.add(normalize(item.resourceId));labels.add(normalize(item.label));expenseInputs.push({...item,category:key});
      }
    }
    if(!Array.isArray(s.spendingItems)||s.spendingItems.length!==expenseInputs.length)return null;
    for(const a of expenseInputs){
      const r=s.spendingItems.find(row=>row?.id===a.id),months=a.endMonth-a.startMonth+1;
      if(!r||['id','resourceId','label','category','kind','unit','capacityActivityId'].some(k=>r[k]!==a[k])||r.activeMonths!==months||!range(r.amount)||!range(r.allocatedHours))return null;
      for(const k of levels){const units=a.baselineMonthlyUnits*months*a.reductionPercent[k]/100*a.adoptionPercent[k]/100;if(!close(r.amount[k],units*a.unitCost)||!close(r.allocatedHours[k],a.kind==='labor'?units:0))return null;}
      if(!Array.isArray(r.monthlyAllocations)||r.monthlyAllocations.length!==(a.kind==='labor'?months:0))return null;
      for(const [index,month] of r.monthlyAllocations.entries())if(!month||typeof month!=='object'||Array.isArray(month)||month.month!==a.startMonth+index||!range(month.allocatedHours)||!levels.every(k=>close(month.allocatedHours[k],a.baselineMonthlyUnits*a.reductionPercent[k]/100*a.adoptionPercent[k]/100)))return null;
    }
    for(const {input:a,row:r,gross} of calculated.values()){
      if(!Array.isArray(r.monthlyReconciliation)||r.monthlyReconciliation.length!==i.horizonMonths)return null;
      for(const [index,month] of r.monthlyReconciliation.entries()){
        if(!month||typeof month!=='object'||Array.isArray(month)||month.month!==index+1||!['grossHoursFreed','hoursUsedForSpendingReduction','hoursUsedForSpendingAvoidance','potentialHoursFreed'].every(k=>range(month[k])))return null;
        for(const k of levels){
          const allocated=category=>expenseInputs.filter(x=>x.capacityActivityId===a.id&&x.category===category&&x.startMonth<=month.month&&x.endMonth>=month.month).reduce((n,x)=>n+x.baselineMonthlyUnits*x.reductionPercent[k]/100*x.adoptionPercent[k]/100,0);
          if(!close(month.grossHoursFreed[k],gross[k]/i.horizonMonths)||!close(month.hoursUsedForSpendingReduction[k],allocated('spendingReduction'))||!close(month.hoursUsedForSpendingAvoidance[k],allocated('spendingAvoidance'))||!close(month.potentialHoursFreed[k],gross[k]/i.horizonMonths-allocated('spendingReduction')-allocated('spendingAvoidance')))return null;
        }
      }
      for(const k of levels){
      for(let month=1;month<=i.horizonMonths;month++){
        const allocated=expenseInputs.filter(x=>x.capacityActivityId===a.id&&x.startMonth<=month&&x.endMonth>=month).reduce((n,x)=>n+x.baselineMonthlyUnits*x.reductionPercent[k]/100*x.adoptionPercent[k]/100,0);
        if(allocated>gross[k]/i.horizonMonths+.000001)return null;
      }
      const reduction=sum(s.spendingItems.filter(x=>x.capacityActivityId===a.id&&x.category==='spendingReduction'),'allocatedHours',k),avoidance=sum(s.spendingItems.filter(x=>x.capacityActivityId===a.id&&x.category==='spendingAvoidance'),'allocatedHours',k);
      if(!close(r.hoursUsedForSpendingReduction[k],reduction,s.spendingItems.length)||!close(r.hoursUsedForSpendingAvoidance[k],avoidance,s.spendingItems.length)
        ||!close(r.capacityValue[k],(gross[k]-expenseInputs.filter(x=>x.capacityActivityId===a.id).reduce((n,x)=>n+x.baselineMonthlyUnits*(x.endMonth-x.startMonth+1)*x.reductionPercent[k]/100*x.adoptionPercent[k]/100,0))*a.loadedHourlyCost))return null;
      }
    }
    const fields={spendingReduction:'existingSpendingReduction',spendingAvoidance:'futureSpendingAvoidance',staffCapacity:'capacityValue'};
    for(const key of THREE_BENEFIT_KEYS){
      const b=benefits[key],field=fields[key];
      if(b.status==='not_estimated'){if(t[field]!==null)return null;}
      else {const rows=key==='staffCapacity'?s.activities:s.spendingItems.filter(x=>x.category===key),measure=key==='staffCapacity'?'capacityValue':'amount';if(!same(t[field],b.amount)||!levels.every(k=>close(t[field][k],sum(rows,measure,k),rows.length)))return null;}
    }
    if(cap.status==='not_estimated'){if(t.grossPotentialHoursFreed!==null||t.potentialHoursFreed!==null)return null;}
    else if(!range(t.grossPotentialHoursFreed)||!same(t.potentialHoursFreed,benefits.staffCapacity.hours)||!levels.every(k=>close(t.grossPotentialHoursFreed[k],sum(s.activities,'grossHoursFreed',k),s.activities.length)&&close(t.potentialHoursFreed[k],sum(s.activities,'potentialHoursFreed',k),s.activities.length)))return null;
    if(!range(t.cashInvestment)||!range(t.totalImplementationAndSubscriptionCost)||!range(t.knownBenefitSubtotal)||!range(t.netKnownBenefitSubtotal,true))return null;
    for(const k of levels){
      const c=THREE_BENEFIT_COST_CASE[k];
      if(!close(t.cashInvestment[k],i.implementationCashCost[k]+i.subscriptionCost)||!close(t.totalImplementationAndSubscriptionCost[k],t.cashInvestment[k]+i.implementationCapacityCost[k]))return null;
      const known=THREE_BENEFIT_KEYS.filter(key=>benefits[key].status!=='not_estimated').reduce((n,key)=>n+benefits[key].amount[k],0);
      if(!close(t.knownBenefitSubtotal[k],known,3)||!close(t.netKnownBenefitSubtotal[k],known-t.totalImplementationAndSubscriptionCost[c],4))return null;
      for(const [field,required,cost] of [['netExistingCashEffect',['spendingReduction'],'cashInvestment'],['netCashEffect',['spendingReduction','spendingAvoidance'],'cashInvestment'],['netCapacityAndCashValue',THREE_BENEFIT_KEYS,'totalImplementationAndSubscriptionCost']]){
        if(required.some(key=>benefits[key].status==='not_estimated')){if(t[field]!==null)return null;}
        else if(!range(t[field],true)||!close(t[field][k],required.reduce((n,key)=>n+benefits[key].amount[k],0)-t[cost][c],4))return null;
      }
    }
    return {s,input:i};
  }

  const THREE_BENEFIT_CSS = `<style data-three-benefit-style="20260919.1">
    .mr-three-benefit{min-width:0;overflow-wrap:anywhere}.mr-three-benefit fieldset{min-width:0;border:0;padding:0;margin:20px 0}.mr-three-benefit legend{font-weight:700;margin-bottom:10px}.mr-benefit-radio{position:absolute;opacity:0;width:1px;height:1px}.mr-benefit-choice{display:inline-block;cursor:pointer;padding:10px 20px;margin:0 8px 12px 0;border:1px solid #0C6E78;border-radius:6px;color:#08383E}.mr-benefit-radio:checked+label{background:#0C6E78;color:white}.mr-benefit-radio:focus-visible+label{outline:3px solid #C9A227;outline-offset:3px}.mr-benefit-panel{display:none;min-width:0}.mr-benefit-radio-low:checked~.mr-benefit-panels>.mr-benefit-low,.mr-benefit-radio-central:checked~.mr-benefit-panels>.mr-benefit-central,.mr-benefit-radio-high:checked~.mr-benefit-panels>.mr-benefit-high{display:block}.mr-benefit-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.mr-benefit-card{padding:18px;border:1px solid #C9DCDD;border-top:4px solid #0C6E78;border-radius:8px;min-width:0;background:#F4F8F7}.mr-benefit-card strong{display:block;font-size:1.65rem;line-height:1.15;margin:10px 0;overflow-wrap:anywhere}.mr-benefit-card h4{margin:0}.mr-benefit-card small{display:block}.mr-benefit-coverage{padding:16px;border-left:4px solid #C9A227;background:#FBF6EA;margin:18px 0}.mr-benefit-net{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mr-benefit-net>div{padding:14px;background:#F4F6F6;border-radius:6px}.mr-benefit-net strong{display:block;font-size:1.3rem;margin-top:5px}.mr-benefit-scroll{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;margin:20px 0}.mr-benefit-scroll:focus-visible{outline:2px solid #0C6E78;outline-offset:2px}.mr-benefit-table{width:100%;min-width:550px;border-collapse:collapse;font-size:.82rem}.mr-benefit-table caption{text-align:left;font-weight:700;margin-bottom:12px}.mr-benefit-table th,.mr-benefit-table td{padding:10px;border-bottom:1px solid #DCE5E8;text-align:right;vertical-align:top}.mr-benefit-table th:first-child{text-align:left;min-width:170px}.mr-benefit-table td{white-space:nowrap;overflow-wrap:normal;word-break:normal}.mr-benefit-assumption{padding:18px 0;border-bottom:1px solid #DCE5E8}.mr-benefit-assumption h3,.mr-benefit-assumption h4{break-after:avoid}.mr-benefit-assumption dl{display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,2fr);gap:8px 18px}.mr-benefit-assumption dt{color:#53676E}.mr-benefit-assumption dd{margin:0;min-width:0}.mr-benefit-flow{min-width:680px;position:relative;margin:14px 0}.mr-benefit-flow svg{display:block;width:100%;height:100%}.mr-benefit-flow-labels{position:absolute;inset:0;pointer-events:none}.mr-benefit-flow-node{position:absolute;width:32%;min-height:48px;line-height:1.2;font-size:.74rem;background:#fff;border-left:4px solid #0C6E78;padding:6px 8px;box-sizing:border-box}.mr-benefit-flow-node.is-right{right:0;border-color:#C9A227}.mr-benefit-flow-node strong{display:block;margin-top:3px;white-space:nowrap}.mr-benefit-flow-node span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mr-benefit-chart-note{font-size:.8rem;color:#53676E}.mr-benefit-missing li+li{margin-top:8px}
    .mr-benefit-print-summary,.mr-benefit-compact-flow{display:none}.mr-benefit-flow{min-width:0;height:calc(var(--benefit-rows)*62px + 16px)!important}.mr-benefit-flow-node{width:38%;top:calc(var(--benefit-row)*62px + 8px)!important}.mr-benefit-node-type{display:block;font-size:.65rem;color:#53676E;margin-top:2px}
    @media screen and (max-width:640px){.mr-benefit-cards,.mr-benefit-net{grid-template-columns:1fr}.mr-benefit-card strong{font-size:1.6rem}.mr-benefit-choice{padding:10px 17px}.mr-benefit-assumption dl{grid-template-columns:1fr;gap:4px}.mr-benefit-assumption dd{margin-bottom:10px}.mr-benefit-flow-node{font-size:12px;padding:4px;border-left-width:2px}.mr-benefit-flow-node strong{font-size:12px}.mr-benefit-chart{margin-left:0;margin-right:0}.mr-benefit-chart>.mr-benefit-scroll{overflow:visible}}
    @media print{.mr-benefit-radio,.mr-benefit-choice,.mr-three-benefit legend{display:none!important}.mr-three-benefit .mr-benefit-panels>.mr-benefit-panel{display:none!important;break-before:auto}.mr-three-benefit .mr-benefit-panels>.mr-benefit-panel.mr-benefit-central{display:block!important}.mr-benefit-cards{grid-template-columns:repeat(3,minmax(0,1fr))}.mr-benefit-card{padding:10px}.mr-benefit-card strong{font-size:17px}.mr-benefit-card p{font-size:9px}.mr-benefit-net{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-benefit-scroll{overflow:visible;margin:14px 0}.mr-benefit-table{min-width:0;font-size:9px;table-layout:fixed}.mr-benefit-table th,.mr-benefit-table td{padding:6px 4px}.mr-benefit-table th:first-child{min-width:0;width:42%}.mr-benefit-table tr{break-inside:avoid}.mr-benefit-flow{min-width:0!important}.mr-benefit-flow-node{font-size:8px;padding:4px;min-height:36px}.mr-benefit-flow-node strong{font-size:9px}.mr-benefit-coverage{padding:8px}.mr-benefit-assumption{break-inside:avoid}.mr-benefit-chart{break-before:auto;break-inside:avoid}.mr-benefit-assumptions{break-before:page}.mr-benefit-scroll-hint{display:none}}
    @media print{.mr-benefit-print-summary{display:block;break-inside:avoid}.mr-benefit-print-summary>.mr-benefit-scroll{margin:10px 0}.mr-benefit-print-summary .mr-benefit-table caption{margin-bottom:7px}.mr-benefit-print-summary .mr-benefit-table th,.mr-benefit-print-summary .mr-benefit-table td{padding:4px}.mr-report .mr-benefit-print-summary>p{font-size:9px;line-height:1.4;margin:8px 0}.mr-benefit-screen-summary{display:none}.mr-benefit-flow{height:calc(var(--benefit-rows)*42px + 16px)!important}.mr-benefit-flow-node{top:calc(var(--benefit-row)*42px + 8px)!important}.mr-benefit-node-type{font-size:7px}.mr-benefit-flow-node span{-webkit-line-clamp:2}.mr-benefit-compact-flow{display:none}}
    @media print{.mr-benefit-month-ledger{break-before:page}}
  </style>`;

  function threeBenefitTable(caption, rows) {
    return '<div class="mr-benefit-scroll" role="region" tabindex="0" aria-label="'+esc(caption)+'"><table class="mr-benefit-table"><caption>'+esc(caption)+'</caption><thead><tr><th scope="col">Measure</th>'+THREE_BENEFIT_CASES.map(k=>'<th scope="col">'+humanize(k)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(([label,range,format=threeBenefitMoney,paired=false])=>'<tr><th scope="row">'+esc(label)+'</th>'+THREE_BENEFIT_CASES.map(k=>'<td data-case="'+k+'"'+(range!==null?' data-saved-value="'+range[paired?THREE_BENEFIT_COST_CASE[k]:k]+'"':'')+'>'+esc(range===null?'Not estimated':format(range[paired?THREE_BENEFIT_COST_CASE[k]:k]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }

  function renderThreeBenefitFlow(s,level) {
    if(!s.coverage.complete)return '';
    const input=s.inputs,colors={remaining:'#C4D0D2',spendingReduction:'#0C6E78',spendingAvoidance:'#C9A227',staffCapacity:'#4E8991'},groups=[];
    // Only the baseline is reconstructed. Benefits and hour allocations come
    // unchanged from the reconciled saved scenario, never from scores.
    for(const [key,kind,title] of [['spendingReduction','current-spending','Current spending'],['spendingAvoidance','planned-spending','Planned spending']]){
      const sources=input[key].items.map(a=>{const r=s.spendingItems.find(x=>x.id===a.id);return {id:a.id,label:a.label,change:a.changeBasis,baseline:a.baselineMonthlyUnits*a.unitCost*(a.endMonth-a.startMonth+1),released:r.amount[level],flows:{[key]:r.amount[level]}};});
      groups.push({kind,title,unit:'USD',sources,roles:['remaining',key],labels:{remaining:key==='spendingReduction'?'Spending that remains':'Planned spending still needed',[key]:key==='spendingReduction'?'Potential current savings':'Potential future spending avoided'}});
    }
    const cap=input.capacity,days=(Date.parse(cap.measurementEnd)-Date.parse(cap.measurementStart))/86400000;
    groups.push({kind:'workload',title:'Staff time',unit:'hours',roles:['remaining','spendingReduction','spendingAvoidance','staffCapacity'],labels:{remaining:'Work time that remains',spendingReduction:'Time reducing current spending',spendingAvoidance:'Time covering planned spending',staffCapacity:'Time available for other work'},sources:cap.activities.map(a=>{const r=s.activities.find(x=>x.id===a.id);return {id:a.id,label:a.label,change:a.changeBasis,baseline:a.measuredHours*(input.horizonMonths*365.25/12)/days,released:r.grossHoursFreed[level],flows:{spendingReduction:r.hoursUsedForSpendingReduction[level],spendingAvoidance:r.hoursUsedForSpendingAvoidance[level],staffCapacity:r.potentialHoursFreed[level]}};})});
    const bound=v=>Number.isFinite(v)&&v>=0&&v<=1e14,number=v=>Number(v).toLocaleString('en-US',v>0&&v<1?{maximumSignificantDigits:3}:{maximumFractionDigits:0}),notes=[],panels=[];
    const difference=(a,b)=>{const v=a-b;return v<0&&Math.abs(v)<=8*Number.EPSILON*Math.max(1,a,b)?0:v;};
    const attrs=row=>' data-baseline-value="'+row.baseline+'" data-residual-value="'+row.residual+'" data-released-value="'+row.released+'"';
    const keyboard="if(event.target===this&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();this.scrollTo({left:event.key==='Home'?0:event.key==='End'?this.scrollWidth:this.scrollLeft+(event.key==='ArrowLeft'?-80:80),behavior:'instant'});}";
    for(const group of groups){
      if(!group.sources.length)continue; // No baseline supplied is not zero burden.
      for(const row of group.sources){row.residual=difference(row.baseline,row.released);row.flows.remaining=row.residual;}
      const baseline=group.sources.reduce((n,r)=>n+r.baseline,0),released=group.sources.reduce((n,r)=>n+r.released,0),residual=difference(baseline,released);
      if(!bound(baseline)||!bound(residual)||group.sources.some(r=>!bound(r.baseline)||!bound(r.residual))){notes.push(group.title+': the baseline cannot be drawn reliably. Refer to the saved inputs and planning table.');continue;}
      if(baseline===0)continue;
      // Independently rounded hour components may differ by a centihour from
      // their saved gross total. Reconcile WIDTHS only, proportionally; labels
      // and data-burden-amount keep the exact saved component values.
      let drawable=true;
      for(const row of group.sources){
        row.drawnFlows={...row.flows};
        if(group.unit==='hours'){
          const sum=row.flows.spendingReduction+row.flows.spendingAvoidance+row.flows.staffCapacity;
          if((sum===0)!==(row.released===0)){drawable=false;break;}
          for(const key of ['spendingReduction','spendingAvoidance','staffCapacity'])row.drawnFlows[key]=sum?row.flows[key]*row.released/sum:0;
        }
      }
      if(!drawable){notes.push(group.title+': rounded components are too small to draw reliably. Refer to the saved inputs and planning table.');continue;}
      const fmt=v=>group.unit==='USD'?threeBenefitHeadlineMoney(v):number(v)+' h',exact=v=>group.unit==='USD'?threeBenefitMoney(v):threeBenefitNumber(v)+' hours';
      const ordered=group.sources.slice().sort((a,b)=>b.baseline-a.baseline||String(a.id).localeCompare(String(b.id))),shown=ordered.length>4?ordered.slice(0,3):ordered.slice();
      if(ordered.length>4){const rest=ordered.slice(3);shown.push({label:'Other recorded '+(group.unit==='hours'?'activities':'expenses')+' ('+rest.length+')',baseline:rest.reduce((n,r)=>n+r.baseline,0),flows:Object.fromEntries(group.roles.map(key=>[key,rest.reduce((n,r)=>n+r.flows[key],0)])),drawnFlows:Object.fromEntries(group.roles.map(key=>[key,rest.reduce((n,r)=>n+r.drawnFlows[key],0)]))});}
      // One denominator and scale for all three cases. Neutral ribbons keep
      // the unchanged workload/spend visible; they are not called waste.
      const scale=220/baseline,dest=group.roles.map(key=>({key,label:group.labels[key],amount:group.sources.reduce((n,r)=>n+r.flows[key],0),drawnAmount:group.sources.reduce((n,r)=>n+r.drawnFlows[key],0)}));
      const extent=items=>items.reduce((n,item)=>n+Math.max(82,item.drawnAmount*scale),0)+24*(items.length-1);
      const sources=shown.map(row=>({...row,amount:row.baseline,drawnAmount:row.baseline})),height=Math.max(extent(sources),extent(dest))+24;
      const position=items=>{let y=(height-extent(items))/2;for(const item of items){const h=Math.max(82,item.drawnAmount*scale);item.center=y+h/2;item.offset=item.center-item.drawnAmount*scale/2;y+=h+24;}};
      position(sources);position(dest);
      const label=(item,right)=>'<div class="mr-benefit-flow-node'+(right?' is-right':'')+'" style="--benefit-node-center:'+(item.center/height*100)+'%;--benefit-color:'+colors[right?item.key:'remaining']+'"><span>'+esc(item.label)+'</span><strong>'+esc(fmt(item.amount))+'</strong></div>';
      let paths='',nodes='';
      for(const source of sources){let start=source.offset;for(const target of dest){const amount=source.flows[target.key],drawnAmount=source.drawnFlows[target.key],width=drawnAmount*scale;if(amount>0){const end=target.offset;paths+='<path d="M228 '+start+' C344 '+start+',456 '+end+',572 '+end+' L572 '+(end+width)+' C456 '+(end+width)+',344 '+(start+width)+',228 '+(start+width)+' Z" fill="'+colors[target.key]+'" data-burden-role="'+target.key+'" data-burden-amount="'+amount+'" data-burden-drawn-amount="'+drawnAmount+'"><title>'+esc(source.label+' → '+target.label+': '+exact(amount))+'</title></path>';start+=width;target.offset+=width;}}nodes+=label(source,false);}
      nodes+=dest.map(item=>label(item,true)).join('');
      const detail=group.sources.map(row=>'<li data-burden-source="'+esc(row.id)+'"'+attrs(row)+(group.unit==='hours'?' data-spending-reduction-hours="'+row.flows.spendingReduction+'" data-spending-avoidance-hours="'+row.flows.spendingAvoidance+'" data-retained-hours="'+row.flows.staffCapacity+'"':'')+'><strong>'+esc(row.label)+'</strong><span>'+esc('Baseline '+exact(row.baseline)+' · remains '+exact(row.residual)+' · potential '+(group.unit==='hours'?'time released ':'saving ')+exact(row.released))+'</span><span>'+esc(row.change)+'</span></li>').join('');
      panels.push('<section class="mr-burden-section" data-burden-kind="'+group.kind+'" data-burden-unit="'+group.unit+'" data-burden-case="'+level+'" data-burden-scale="'+scale+'"'+attrs({baseline,residual,released})+'><h5>'+group.title+'</h5><p class="mr-burden-summary"><strong>'+esc(fmt(baseline))+'</strong> '+(group.unit==='hours'?'recorded-work baseline':'entered expense baseline')+' → <strong>'+esc(fmt(residual))+'</strong> remains; <strong>'+esc(fmt(released))+'</strong> '+(group.unit==='hours'?'could be released':'could be saved')+'.</p><div class="mr-benefit-flow-heading"><span>Baseline · '+input.horizonMonths+' months</span><span>After the proposed changes</span></div><div class="mr-benefit-scroll" role="region" tabindex="0" onkeydown="'+esc(keyboard)+'" aria-label="'+esc(humanize(level)+' '+group.title+' Sankey')+'"><div class="mr-benefit-flow" style="--burden-height:'+height+'px"><svg viewBox="0 0 800 '+height+'" preserveAspectRatio="none" role="img" aria-label="'+esc(group.title+': baseline to remaining and potential savings')+'"><desc>'+esc('Baseline '+exact(baseline)+'. '+dest.map(item=>item.label+' '+exact(item.amount)).join('; '))+'.</desc>'+paths+'</svg><div class="mr-benefit-flow-labels">'+nodes+'</div></div></div><details class="mr-burden-source-details"><summary>Sources and proposed changes</summary><ul>'+detail+'</ul></details>'+(group.kind==='workload'?'<p class="mr-benefit-chart-note">Released time assigned to current or planned spending is excluded from time available for other work. The hours and dollars describe related effects; do not add them together.</p>':'')+'</section>');
    }
    if(!panels.length)return notes.length?'<p class="mr-benefit-chart-note">'+notes.map(esc).join(' ')+'</p>':'';
    const style='<style>.mr-benefit-chart[data-flow-version="20260921.1"]{margin:28px 0}.mr-burden-section{padding:22px 0;border-top:1px solid #DCE5E8}.mr-burden-section h5{font-size:1.05rem;margin:0 0 8px}.mr-burden-summary{font-size:.9rem;line-height:1.5}.mr-burden-summary strong{color:#08383E}.mr-benefit-chart[data-flow-version] .mr-benefit-scroll{overflow-x:auto;overflow-y:hidden;margin:12px 0 16px}.mr-benefit-chart[data-flow-version] .mr-benefit-flow{min-width:800px;height:var(--burden-height)!important}.mr-benefit-chart[data-flow-version] .mr-benefit-flow-node{top:var(--benefit-node-center)!important;transform:translateY(-50%);width:27%;min-height:0;padding:6px 10px;font-size:13px;line-height:1.3;border-color:var(--benefit-color)}.mr-benefit-chart[data-flow-version] .mr-benefit-flow-node span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.mr-benefit-chart[data-flow-version] .mr-benefit-flow-node strong{font-size:17px}.mr-benefit-flow-heading{display:flex;justify-content:space-between;gap:20px;font-size:.8rem;font-weight:700;color:#53676E;margin-top:18px}.mr-benefit-flow-heading span:last-child{text-align:right}.mr-benefit-flow-hint{font-size:12px;color:#53676E}.mr-burden-source-details{font-size:.8rem}.mr-burden-source-details summary{cursor:pointer;color:#0C6E78;padding:10px 0;min-height:44px}.mr-burden-source-details li{margin:10px 0}.mr-burden-source-details li>span{display:block;margin-top:4px}@media screen and (min-width:1000px){.mr-benefit-flow-hint{display:none}}@media print{.mr-benefit-chart[data-flow-version]{break-inside:auto}.mr-burden-section{break-inside:avoid;padding:12px 0}.mr-burden-section h5{font-size:11px}.mr-report .mr-burden-summary{font-size:9px;margin:6px 0}.mr-benefit-chart[data-flow-version] .mr-benefit-flow{min-width:0;height:calc(var(--burden-height)*.60)!important}.mr-benefit-chart[data-flow-version] .mr-benefit-scroll{overflow:visible;margin:8px 0}.mr-benefit-chart[data-flow-version] .mr-benefit-flow-node{font-size:8px;line-height:1.2;padding:3px 5px}.mr-benefit-chart[data-flow-version] .mr-benefit-flow-node strong{font-size:10px}.mr-benefit-flow-heading{font-size:8px;margin-top:6px}.mr-benefit-flow-hint,.mr-burden-source-details{display:none}}</style>';
    return '<figure class="mr-benefit-chart" data-flow-version="20260921.1">'+style+'<h4>'+humanize(level)+' case: from current demands to potential savings</h4><p class="mr-benefit-chart-note">See where recorded time and spending could change, and what remains. These are potential benefits before costs. Costs and net value are shown separately. The baseline covers the entered activities and expenses, not all organizational work or spending.</p><p class="mr-benefit-flow-hint">Swipe across each diagram, or focus it and use the arrow keys. The summary above each diagram gives the same totals.</p>'+panels.join('')+notes.map(note=>'<p class="mr-benefit-chart-note">'+esc(note)+'</p>').join('')+'<figcaption class="mr-benefit-chart-note">Directional estimates based on collected self-reported sample data, recorded operational inputs and stated assumptions. Each diagram uses one unit and a fixed scale across Low, Central and High. Ribbon widths reconcile minor rounding differences; the tables retain the saved values. Staff time is not automatically cash savings.</figcaption></figure>';
  }

  function renderThreeBenefitBrief(m) {
    if(m.kind!=='meta-synthesis'||m.selfRun)return '';
    const validated=threeBenefitPresentation(m);
    if(!validated)return '<section class="mr-section mr-financial-brief mr-three-benefit">'+THREE_BENEFIT_CSS+'<h2>Financial benefit assessment</h2><p>The three benefit categories have not been estimated with complete, reconciled inputs for this scope.</p><div class="mr-benefit-cards">'+THREE_BENEFIT_KEYS.map(key=>'<article class="mr-benefit-card"><h4>'+THREE_BENEFIT_LABELS[key]+'</h4><strong>Not estimated</strong><p>'+({spendingReduction:'Enter current expense units, rates, months and the proposed change.',spendingAvoidance:'Enter documented planned expense units, rates, months and the proposed change.',staffCapacity:'Enter measured activity hours, labor rates, time-reduction and adoption assumptions.'}[key])+'</p></article>').join('')+'</div><p>No missing category is treated as zero. Review the saved inputs before using a financial estimate.</p></section>';
    const {s,input}=validated,t=s.totals,complete=s.coverage.complete;
    const panels=THREE_BENEFIT_CASES.map(level=>{
      const cards=THREE_BENEFIT_KEYS.map(key=>{const b=s.benefits[key];return '<article class="mr-benefit-card" data-benefit="'+key+'" data-status="'+b.status+'"><h4>'+THREE_BENEFIT_LABELS[key]+'</h4><strong'+(b.amount!==null?' data-saved-value="'+b.amount[level]+'"':'')+'>'+esc(b.amount===null?'Not estimated':threeBenefitHeadlineMoney(b.amount[level]))+'</strong><small>'+esc(b.status==='none_identified'?'Reviewed: none identified':b.status==='not_estimated'?'Inputs still needed':key==='staffCapacity'?b.hours[level].toLocaleString('en-US',{maximumFractionDigits:0})+' retained hours; not cash savings':'Potential change against the stated spending baseline')+'</small><p>'+esc(b.basis)+'</p></article>';}).join('');
      return '<div class="mr-benefit-panel mr-benefit-'+level+'" data-three-benefit-case="'+level+'"><h3>'+humanize(level)+' planning case</h3><div class="mr-benefit-cards">'+cards+'</div><div class="mr-benefit-net"><div>Total cost, including internal staff time<strong data-saved-value="'+t.totalImplementationAndSubscriptionCost[THREE_BENEFIT_COST_CASE[level]]+'">'+esc(threeBenefitHeadlineMoney(t.totalImplementationAndSubscriptionCost[THREE_BENEFIT_COST_CASE[level]]))+'</strong></div><div>'+(complete?'Net planning value':'Net of entered benefits only')+'<strong data-saved-value="'+t.netKnownBenefitSubtotal[level]+'">'+esc(threeBenefitHeadlineMoney(t.netKnownBenefitSubtotal[level]))+'</strong><small>'+(complete?'Includes retained staff capacity; not a cash return.':'Incomplete subtotal, not complete ROI.')+'</small></div></div>'+renderThreeBenefitFlow(s,level)+'</div>';
    }).join('');
    const coverage=(complete?'All three benefit categories are covered.': 'Partial estimate: '+s.coverage.missingCategories.map(key=>THREE_BENEFIT_LABELS[key].toLowerCase()).join(', ')+' '+(s.coverage.missingCategories.length===1?'is':'are')+' not estimated.')+' Summary and chart values are rounded. Detailed tables retain cents and fractional hours.';
    const rows=THREE_BENEFIT_KEYS.map(key=>[THREE_BENEFIT_LABELS[key],s.benefits[key].amount]);
    rows.push(['Retained staff hours',t.potentialHoursFreed,threeBenefitNumber],['Cash investment',t.cashInvestment,threeBenefitMoney,true],['Total cost including internal staff time',t.totalImplementationAndSubscriptionCost,threeBenefitMoney,true],['Net current-spending effect',t.netExistingCashEffect],['Net spending versus baseline',t.netCashEffect],[complete?'Net planning value':'Complete net planning value',t.netCapacityAndCashValue],['Entered benefit subtotal',t.knownBenefitSubtotal],['Entered subtotal less full cost',t.netKnownBenefitSubtotal]);
    const comparison=threeBenefitTable('Three planning cases',rows);
    return '<section class="mr-section mr-financial-brief mr-three-benefit" data-three-benefit-version="20260919.1">'+THREE_BENEFIT_CSS+'<p class="mr-financial-eyebrow">Operational value</p><h2>Decision brief: three sources of value</h2><p>'+esc(s.title)+' · '+input.horizonMonths+' months</p><p class="mr-benefit-coverage">'+esc(coverage)+(complete?'':' Missing information is not zero, and the entered subtotal is not complete ROI.')+'</p><fieldset><legend>Choose a planning case</legend>'+THREE_BENEFIT_CASES.map(k=>'<input class="mr-benefit-radio mr-benefit-radio-'+k+'" id="mr-planning-benefit-'+k+'" name="mr-planning-benefit" type="radio" value="'+k+'"'+(k==='central'?' checked':'')+'><label class="mr-benefit-choice" for="mr-planning-benefit-'+k+'">'+humanize(k)+'</label>').join('')+'<div class="mr-benefit-panels">'+panels+'</div></fieldset><div class="mr-benefit-print-summary">'+comparison+'<p>Low pairs low benefit assumptions with high costs; high pairs high assumptions with low costs. Labor assigned to spending reductions is removed from retained capacity first, so retained capacity can be lower in a stronger spending case. These are planning cases, not confidence intervals or measured savings.</p></div><div class="mr-benefit-screen-summary">'+comparison+'</div>'+(complete?'':'<ul class="mr-benefit-missing">'+s.coverage.missingCategories.map(key=>'<li><strong>'+THREE_BENEFIT_LABELS[key]+':</strong> '+s.benefits[key].missingInputs.map(esc).join(' ')+'</li>').join('')+'</ul>')+'<p class="mr-benefit-screen-summary">Low pairs low benefit assumptions with high costs; high pairs high assumptions with low costs. Labor assigned to spending reductions is removed from retained capacity first, so retained capacity can be lower in a stronger spending case. These are planning cases, not confidence intervals or measured savings.</p>'+(s.kind==='early_planning_scenario'?'<p>This early planning scenario does not unlock Synthesis. Complete the campaign readiness checks separately.</p>':'')+'</section>';
  }

  function renderThreeBenefitAssumptions(m,n) {
    const valid=threeBenefitPresentation(m);if(!valid)return '';
    const {s,input:i}=valid,percent=v=>threeBenefitNumber(v)+'%',facts=rows=>'<dl>'+rows.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
    let html='<section class="mr-section mr-three-benefit mr-benefit-assumptions"><h2>'+n+'. Operational inputs and reconciliation</h2><p>Each value comes from the saved scenario, not from a diagnostic score. Spending reductions use an existing expense baseline; avoided future spending uses a documented planned expense. Retained staff capacity excludes every hour assigned to either spending category.</p><p>'+esc(obj(s.method).extrapolation)+'</p>';
    for(const key of THREE_BENEFIT_KEYS)html+='<h3>'+THREE_BENEFIT_LABELS[key]+'</h3><p>'+esc(s.benefits[key].basis)+' · '+esc(humanize(s.benefits[key].status))+'</p>';
    for(const a of i.capacity.activities){const r=s.activities.find(x=>x.id===a.id);html+='<article class="mr-benefit-assumption"><h3>'+esc(a.label)+'</h3>'+facts([['Measurement window',i.capacity.measurementStart+' to '+i.capacity.measurementEnd],['People covered by records',i.capacity.measuredPeople],['Measured activity hours',threeBenefitNumber(a.measuredHours)],['Loaded hourly cost',threeBenefitMoney(a.loadedHourlyCost)],['Source basis',humanize(a.sourceBasis)],['Source reference',a.sourceReference],['Proposed change',a.changeBasis]])+threeBenefitTable('Activity assumptions',[['Reduction assumption',a.reductionPercent,percent],['Adoption assumption',a.adoptionPercent,percent]])+threeBenefitTable('Saved activity reconciliation',[['Gross hours freed',r.grossHoursFreed,threeBenefitNumber],['Hours assigned to current spending',r.hoursUsedForSpendingReduction,threeBenefitNumber],['Hours assigned to future spending',r.hoursUsedForSpendingAvoidance,threeBenefitNumber],['Retained staff hours',r.potentialHoursFreed,threeBenefitNumber],['Retained capacity value',r.capacityValue]])+'</article>';}
    for(const key of ['spendingReduction','spendingAvoidance'])for(const item of i[key].items){const r=s.spendingItems.find(x=>x.id===item.id);html+='<article class="mr-benefit-assumption"><h3>'+esc(item.label)+'</h3>'+facts([['Benefit category',THREE_BENEFIT_LABELS[key]],['Resource reference',item.resourceId],['Expense type',humanize(item.kind)],['Baseline each month',threeBenefitNumber(item.baselineMonthlyUnits)+' '+item.unit],['Cost per unit',threeBenefitMoney(item.unitCost)],['Active planning months',item.startMonth+' to '+item.endMonth+' ('+r.activeMonths+' months)'],['Linked capacity activity',item.capacityActivityId||'Not applicable: non-labor expense'],['Source reference',item.sourceReference],['Proposed change',item.changeBasis]])+threeBenefitTable('Spending assumptions',[['Reduction assumption',item.reductionPercent,percent],['Adoption assumption',item.adoptionPercent,percent]])+threeBenefitTable('Saved spending benefit',[['Spending benefit',r.amount],['Capacity hours assigned to this expense',r.allocatedHours,threeBenefitNumber]])+'</article>';}
    // Group only adjacent months whose saved values are exactly identical.
    // Do not divide totals to invent a monthly record or silently fill gaps.
    const monthGroups=records=>records.reduce((groups,row)=>{const {month,...values}=row,last=groups[groups.length-1],signature=JSON.stringify(values);if(last&&last.end+1===month&&last.signature===signature)last.end=month;else groups.push({start:month,end:month,signature,values});return groups;},[]);
    const monthLabel=g=>(g.start===g.end?'Month '+g.start:'Months '+g.start+' to '+g.end)+' - hours in each month';
    if(s.activities.length)html+='<div class="mr-benefit-month-ledger"><h3>Month-by-month capacity allocation</h3><p>Identical consecutive months are shown together. Each row still shows one month, not the total for that month range.</p>';
    for(const a of s.activities)html+='<article class="mr-benefit-assumption"><h4>'+esc(a.label)+'</h4>'+monthGroups(a.monthlyReconciliation).map(g=>threeBenefitTable(monthLabel(g),[['Gross hours freed',g.values.grossHoursFreed,threeBenefitNumber],['Assigned to current spending',g.values.hoursUsedForSpendingReduction,threeBenefitNumber],['Assigned to future spending',g.values.hoursUsedForSpendingAvoidance,threeBenefitNumber],['Retained capacity hours',g.values.potentialHoursFreed,threeBenefitNumber]])).join('')+'</article>';
    for(const item of s.spendingItems.filter(x=>x.kind==='labor'))html+='<article class="mr-benefit-assumption"><h4>'+esc(item.label)+' - allocated capacity</h4>'+monthGroups(item.monthlyAllocations).map(g=>threeBenefitTable(monthLabel(g),[['Hours allocated to this expense',g.values.allocatedHours,threeBenefitNumber]])).join('')+'</article>';
    if(s.activities.length)html+='</div>';
    html+='<article class="mr-benefit-assumption"><h3>Implementation and subscription</h3>'+threeBenefitTable('Cost input ranges (lower to higher costs)',[['Implementation cash',i.implementationCashCost],['Internal implementation capacity',i.implementationCapacityCost]])+'<p>Subscription allocation: '+esc(threeBenefitMoney(i.subscriptionCost))+'</p><p>'+esc(i.costBasis)+'</p></article><p>Gross recovered activity hours are spread evenly across the planning months. Labor expense benefits allocate hours only in their stated active months. Current and future expense allocations share the same capacity limit each month.</p><p>'+esc(obj(s.participation).statement)+'</p>'+arr(s.limitations).map(value=>'<p>'+esc(value)+'</p>').join('')+'</section>';
    return html;
  }
  // END THREE BENEFIT PRESENTATION 20260919.1

  function financialScenarioPresentation(m) {
    // Diagnostic score distributions never become recovery estimates. Only a
    // separately calculated, same-scope operational scenario is displayable.
    // The decision brief, cover and detailed tables share this exact boundary.
    const s=obj(m.financialScenario),input=obj(s.inputs);
    if(m.kind!=='meta-synthesis'||m.selfRun||s.version!=='operational-planning-scenario-20260913.1'||!['early_planning_scenario','synthesis_planning_scenario'].includes(s.kind)
      ||s.currency!=='USD'||!m.campaignEvidence?.scopeId||obj(s.scope).scopeId!==m.campaignEvidence.scopeId
      ||!/^[a-f0-9]{64}$/.test(s.digest||(s.publication_projection==='operational-scenario-public-20260913.1'?s.source_identity_digest:'')||''))return null;
    const finite=value=>typeof value==='number'&&Number.isFinite(value);
    const validRange=value=>value&&['low','central','high'].every(k=>finite(value[k]))&&value.low<=value.central&&value.central<=value.high;
    const keys=['potentialHoursFreed','capacityValue','avoidableNonLaborCash','cashInvestment','totalImplementationAndSubscriptionCost','netCashEffect','netCapacityAndCashValue'];
    if(!keys.every(key=>validRange(obj(s.totals)[key]))||!arr(s.activities).length||!arr(input.activities).length||arr(input.activities).length>12
      ||!validRange(input.implementationCashCost)||!validRange(input.implementationCapacityCost)||!finite(input.subscriptionCost)
      ||!arr(input.activities).every(a=>a&&finite(a.measuredHours)&&finite(a.loadedHourlyCost)&&validRange(a.reductionPercent)&&validRange(a.adoptionPercent)&&validRange(a.avoidableNonLaborCash))
      ||!Number.isSafeInteger(input.measuredPeople)||input.measuredPeople<=0||!Number.isSafeInteger(input.horizonMonths)||input.horizonMonths<=0
      ||input.scopeConfirmed!==true||input.overlapReviewed!==true||obj(s.method).usesDiagnosticScores!==false||obj(s.method).isConfidenceInterval!==false)return null;
    return {s,input};
  }

  function renderFinancialDecisionBrief(m) {
    if (obj(m.financialScenario).version === 'operational-planning-scenario-20260919.2' || (!obj(m.financialScenario).version && obj(m.financialBenefitAssessment).version === 'three-benefit-assessment-20260919.1')) return renderThreeBenefitBrief(m);
    const validated=financialScenarioPresentation(m);
    if(!validated)return '';
    const {s,input}=validated,t=s.totals;
    // Rounded display only. Preserve small nonzero amounts and the exact saved
    // calculation in the detailed tables, export payload and source record.
    const number=value=>Number(value).toLocaleString('en-US',Math.abs(value)>0&&Math.abs(value)<1?{maximumSignificantDigits:3}:{maximumFractionDigits:0});
    const money=value=>(value<0?'-$':'$')+number(Math.abs(value));
    const noCash=['low','central','high'].every(k=>t.avoidableNonLaborCash[k]===0);
    const centralNet=t.netCapacityAndCashValue.central;
    const interpretation=centralNet>0?'In the central case, potential capacity and cash value exceeds total cost by '+money(centralNet)+'.':centralNet<0?'In the central case, potential capacity and cash value falls short of total cost by '+money(Math.abs(centralNet))+'.':'In the central case, potential capacity and cash value equals total cost.';
    const labels={low:'Low',central:'Central',high:'High'},costLevel={low:'high',central:'central',high:'low'};
    const metrics=[['potentialHoursFreed','Potential staff hours freed',number,false],['capacityValue','Staff capacity value',money,false],
      ['avoidableNonLaborCash','Direct cash saving assumed',money,false],['cashInvestment','Cash investment, including subscription',money,true],
      ['totalImplementationAndSubscriptionCost','Total cost, including internal staff time',money,true],['netCashEffect','Net cash effect',money,false],
      ['netCapacityAndCashValue','Net capacity and cash value',money,false]];
    const rows=metrics.map(([key,label,format,cost])=>'<tr><th scope="row">'+label+'</th>'+['low','central','high'].map(level=>'<td data-case="'+labels[level]+'" data-financial-metric="'+key+'" data-financial-case="'+level+'">'+esc(format(t[key][cost?costLevel[level]:level]))+'</td>').join('')+'</tr>').join('');
    return '<section class="mr-section mr-financial-brief" data-financial-presentation="'+FINANCIAL_PRESENTATION_VERSION+'"><p class="mr-financial-eyebrow">Operational value</p><h2>Decision brief</h2>'+
      '<p class="mr-financial-scope">'+esc(firstStr(obj(s.scope).label,s.title))+' · '+fmtWhole(input.measuredPeople)+' people · '+fmtWhole(input.horizonMonths)+' months</p>'+
      '<div class="mr-financial-headlines"><div><span>Potential staff time · central case</span><strong data-financial-central="hours">'+esc(number(t.potentialHoursFreed.central))+' hours</strong></div><div><span>Staff capacity value · central case</span><strong data-financial-central="capacity">'+esc(money(t.capacityValue.central))+'</strong><small>Value of staff time, not cash savings.</small></div></div>'+
      '<p class="mr-financial-conclusion">'+esc(interpretation)+' This includes staff-time value, not a cash return.'+'</p>'+
      (noCash?'<p class="mr-financial-cash-note">No direct cash saving assumed. The opportunity in this scenario is staff capacity that can be used for other work.</p>':'<p class="mr-financial-cash-note">Direct cash savings are shown separately from staff capacity. They require the stated expenditure reductions to occur.</p>')+
      '<table class="mr-financial-comparison"><caption>Three planning cases</caption><thead><tr><th scope="col">Over the planning period</th><th scope="col">Low</th><th scope="col">Central</th><th scope="col">High</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<p class="mr-financial-pairing">Low pairs lower benefits with higher costs; high pairs higher benefits with lower costs. Central uses the central inputs. These are assumption-based cases, not probabilities or a forecast.</p>'+
      '<p class="mr-financial-detail-note">Summary figures are rounded. Exact values, activity records and assumptions remain in the operational planning scenario below. Diagnostic scores do not calculate these financial values.</p>'+
      (s.kind==='early_planning_scenario'?'<p class="mr-financial-early">Early planning scenario: campaign participation checks are not yet satisfied. This scenario does not unlock Synthesis.</p>':'')+renderOperationalSankey(m)+'</section>';
  }

  // BEGIN PLANNING CASE SANKEY PRESENTATION 20260919.3
  function renderOperationalSankey(m) {
    const validated=financialScenarioPresentation(m);
    if(!validated)return '';
    const {s,input}=validated,levels=['low','central','high'],costLevel={low:'high',central:'central',high:'low'};
    const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
    const range=value=>value&&levels.every(k=>finite(value[k]))&&value.low<=value.central&&value.central<=value.high;
    const measured=new Map(input.activities.map(a=>[a.id,a]));
    const rows=arr(s.activities);
    // A digest identifies the saved scenario, not its integrity. Reconcile
    // distinct saved activity results to the saved total before drawing them.
    // Never calculate a flow from diagnostic scores, lens medians or headcount.
    const valid=rows.every(a=>a&&typeof a==='object')&&rows.length===measured.size&&rows.length===input.activities.length&&new Set(rows.map(a=>a.id)).size===rows.length
      &&rows.every(a=>a&&typeof a.id==='string'&&a.id&&measured.has(a.id)&&typeof a.label==='string'&&a.label.trim()&&range(a.potentialHoursFreed)&&range(a.capacityValue)&&range(a.avoidableNonLaborCash))
      &&['potentialHoursFreed','capacityValue','avoidableNonLaborCash'].every(key=>levels.every(k=>finite(s.totals[key][k])&&Math.abs(rows.reduce((sum,a)=>sum+a[key][k],0)-s.totals[key][k])<=0.005*(rows.length+1)+Number.EPSILON*Math.abs(s.totals[key][k])*8));
    const unavailable=()=>'<aside class="mr-sankey-unavailable"><h3>Planning value chart</h3><p>The saved activity breakdown or planning totals are not complete enough to draw this chart. Review the operational inputs and save the scenario again.</p></aside>';
    if(!valid||!range(input.implementationCashCost)||!range(input.implementationCapacityCost)||!finite(input.subscriptionCost))return unavailable();
    const t=s.totals,labels={low:'Low',central:'Central',high:'High'};
    // Use the table's exact saved values, outcome/cost pairing and formatter.
    // Arithmetic below only reconciles the saved record and lays out ribbons;
    // it does not calculate a new scenario, estimate, cost or recommendation.
    const number=value=>Number(value).toLocaleString('en-US',Math.abs(value)>0&&Math.abs(value)<1?{maximumSignificantDigits:3}:{maximumFractionDigits:0});
    const money=value=>(value<0?'-$':'$')+number(Math.abs(value));
    const metrics=[['potentialHoursFreed','Potential staff hours freed',number,false],['capacityValue','Staff capacity value',money,false],
      ['avoidableNonLaborCash','Direct cash saving assumed',money,false],['cashInvestment','Cash investment, including subscription',money,true],
      ['totalImplementationAndSubscriptionCost','Total cost, including internal staff time',money,true],['netCashEffect','Net cash effect',money,false],
      ['netCapacityAndCashValue','Net capacity and cash value',money,false]];
    // Rank by the saved central case once, so switching cases never changes
    // which activities are named. A bounded aggregate keeps large campaigns
    // legible; the complete, unabridged breakdown follows the chart.
    const activityGroups=key=>{
      const ranked=rows.map((a,index)=>({a,index})).filter(({a})=>key==='capacityValue'||levels.some(k=>a[key][k]>0))
        .sort((a,b)=>b.a[key].central-a.a[key].central||a.index-b.index);
      return ranked.length<=4?ranked.map(item=>[item]):ranked.slice(0,3).map(item=>[item]).concat([ranked.slice(3)]);
    };
    const capacityGroups=activityGroups('capacityValue'),cashGroups=activityGroups('avoidableNonLaborCash');
    const activityNodes=(groups,key,level)=>groups.map(group=>({
      key:key+'-'+group.map(({index})=>index+1).join('-'),
      label:group.length===1?'A'+(group[0].index+1)+'. '+group[0].a.label:'Other activities ('+group.length+')',
      detail:key==='capacityValue'?'Staff capacity':'Cash avoided',
      amount:group.reduce((sum,{a})=>sum+a[key][level],0),
      color:key==='capacityValue'?'#0C6E78':'#A9D0D4',
      activityIds:group.map(({a})=>a.id)
    }));
    const cases=levels.map(level=>{
      const capacity=t.capacityValue[level],cash=t.avoidableNonLaborCash[level],cost=t.totalImplementationAndSubscriptionCost[costLevel[level]],net=t.netCapacityAndCashValue[level];
      const sources=activityNodes(capacityGroups,'capacityValue',level).concat(activityNodes(cashGroups,'avoidableNonLaborCash',level));
      if(net<0)sources.push({key:'valueShortfall',label:'Value shortfall',detail:'Not a benefit',amount:Math.abs(net),color:'#C9821F'});
      const targets=[{key:'implementationCashCost',label:'Implementation cash',detail:'Additional spending',amount:input.implementationCashCost[costLevel[level]],color:'#6E6F73'},
        {key:'implementationCapacityCost',label:'Internal staff time',detail:'Implementation cost',amount:input.implementationCapacityCost[costLevel[level]],color:'#6E6F73'},
        {key:'subscriptionCost',label:'Subscription',detail:'Planning-period cost',amount:input.subscriptionCost,color:'#6E6F73'}];
      if(net>=0)targets.push({key:'netCapacityAndCashValue',label:'Net value',detail:'Includes staff capacity',amount:net,color:'#073338'});
      return {level,capacity,cash,cost,net,sources,targets,sourceTotal:sources.reduce((sum,row)=>sum+row.amount,0),targetTotal:targets.reduce((sum,row)=>sum+row.amount,0)};
    });
    const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.005*(rows.length+2)+Number.EPSILON*Math.max(Math.abs(a),Math.abs(b))*8;
    if(!cases.every(c=>finite(c.cost)&&finite(t.cashInvestment[costLevel[c.level]])&&finite(c.sourceTotal)&&finite(c.targetTotal)
      &&close(input.implementationCashCost[costLevel[c.level]]+input.subscriptionCost,t.cashInvestment[costLevel[c.level]])
      &&close(input.implementationCashCost[costLevel[c.level]]+input.implementationCapacityCost[costLevel[c.level]]+input.subscriptionCost,c.cost)
      &&close(c.capacity+c.cash-c.cost,c.net)&&close(c.cash-t.cashInvestment[costLevel[c.level]],t.netCashEffect[c.level])
      &&close(c.sourceTotal,c.targetTotal)))return unavailable();
    const maxFlow=Math.max(...cases.map(c=>Math.max(c.sourceTotal,c.targetTotal)));
    const maxRows=Math.max(...cases.map(c=>Math.max(c.sources.length,c.targets.length))),height=Math.max(280,maxRows*64),printHeight=Math.max(210,maxRows*36);
    // The largest possible ribbon must fit inside the smallest node slot.
    // One shared scale across all cases preserves proportions without letting
    // a dominant net-value ribbon cross neighboring nodes or the viewBox.
    const ribbonHeight=Math.min(132,height/maxRows*.8);
    const caption=(obj(m.sampleProvenance).synthetic===true?'<strong>Illustrative example.</strong> ':'')+'Directional estimates based on reported operating data and the assumptions shown. Figures indicate potential time and capacity gains, not measured savings.';
    const nodes=items=>items.map(item=>'<div class="mr-planning-node" style="--planning-color:'+item.color+'"><span class="mr-planning-node-name" title="'+esc(item.label)+'">'+esc(item.label)+'</span><small>'+esc(item.detail)+'</small><strong data-planning-node="'+item.key+'" data-saved-value="'+item.amount+'"'+(item.activityIds?' data-planning-activity-ids="'+esc(JSON.stringify(item.activityIds))+'"':'')+'>'+esc(money(item.amount))+'</strong></div>').join('');
    const panel=c=>{
      const hubHeight=maxFlow?c.sourceTotal/maxFlow*ribbonHeight:0,hubTop=(height-hubHeight)/2;
      const ribbons=(items,outgoing)=>{
        let used=0;
        const sum=outgoing?c.targetTotal:c.sourceTotal;
        return items.map((item,index)=>{
          if(item.amount===0||sum===0)return '';
          // Totals are rounded independently by the saved calculator. Share
          // one hub height so a sub-cent reconciliation gap is not a new flow.
          const thickness=item.amount/sum*hubHeight,nodeTop=(index+.5)*height/items.length-thickness/2,joinedTop=hubTop+used;used+=thickness;
          const x=outgoing?52:4,end=outgoing?96:48,from=outgoing?joinedTop:nodeTop,to=outgoing?nodeTop:joinedTop;
          const d='M '+x+' '+from+' C '+(x+15)+' '+from+' '+(end-15)+' '+to+' '+end+' '+to+' L '+end+' '+(to+thickness)+' C '+(end-15)+' '+(to+thickness)+' '+(x+15)+' '+(from+thickness)+' '+x+' '+(from+thickness)+' Z';
          return '<path data-sankey-dollars="'+item.amount+'" data-sankey-node="'+item.key+'" data-sankey-side="'+(outgoing?'out':'in')+'" d="'+d+'" fill="'+item.color+'" fill-opacity=".72"/><rect data-sankey-end-node="'+item.key+'" data-sankey-side="'+(outgoing?'out':'in')+'" x="'+(outgoing?96:0)+'" y="'+nodeTop+'" width="4" height="'+thickness+'" fill="'+item.color+'"/>';
        }).join('');
      };
      const outcome=c.net<0?'Potential capacity and cash value falls short of total cost by '+money(Math.abs(c.net))+'. The value shortfall is not a benefit or funding.':c.net>0?'Potential capacity and cash value exceeds total cost by '+money(c.net)+'. This includes staff-time value, not a cash return.':'Potential capacity and cash value equals total cost. There is no net value remaining.';
      const metricRows=metrics.map(([key,label,format,cost])=>{
        const value=t[key][cost?costLevel[c.level]:c.level];
        return '<div><dt>'+label+'</dt><dd data-planning-metric="'+key+'" data-planning-case="'+c.level+'" data-saved-value="'+value+'">'+esc(format(value))+'</dd></div>';
      }).join('');
      return '<div class="mr-planning-panel mr-planning-panel-'+c.level+'" data-planning-panel="'+c.level+'" role="group" aria-labelledby="mr-planning-title-'+c.level+'">'+
        '<h4 id="mr-planning-title-'+c.level+'">'+labels[c.level]+' planning case</h4><p class="mr-planning-pairing">'+({low:'Lower benefits with higher costs.',central:'Central benefits and central costs.',high:'Higher benefits with lower costs.'}[c.level])+'</p>'+
        '<div class="mr-planning-flow-head" aria-hidden="true"><span>Activity benefits</span><span>Costs and remaining value</span></div>'+
        '<div class="mr-planning-flow'+(maxRows>4?' is-dense':'')+'" aria-hidden="true" data-sankey-scale="'+maxFlow+'" style="--planning-height:'+height+'px;--planning-print-height:'+printHeight+'px"><div class="mr-planning-nodes" style="--planning-rows:'+c.sources.length+'">'+nodes(c.sources)+'</div>'+
        '<svg viewBox="0 0 100 '+height+'" preserveAspectRatio="none" focusable="false" xmlns="http://www.w3.org/2000/svg">'+ribbons(c.sources,false)+ribbons(c.targets,true)+(hubHeight?'<rect x="48" y="'+hubTop+'" width="4" height="'+hubHeight+'" fill="#08383E"/>':'')+'</svg>'+
        '<div class="mr-planning-nodes" style="--planning-rows:'+c.targets.length+'">'+nodes(c.targets)+'</div></div>'+
        '<p class="mr-planning-outcome">'+esc(outcome)+'</p>'+(c.cash===0?'<p class="mr-planning-zero">No direct cash saving assumed. Staff capacity can be used for other work; it is not a payroll saving.</p>':'')+
        '<dl class="mr-planning-metrics">'+metricRows+'</dl><p class="mr-planning-print-caption">'+caption+'</p></div>';
    };
    const cells=(values,key,activityId)=>levels.map(level=>'<td data-case="'+labels[level]+'" data-planning-activity="'+esc(activityId)+'" data-planning-measure="'+key+'" data-planning-level="'+level+'" data-saved-value="'+values[level]+'">'+esc(key==='potentialHoursFreed'?number(values[level]):money(values[level]))+'</td>').join('');
    const activityRows=rows.map((a,index)=>[['capacityValue','Staff capacity value'],['avoidableNonLaborCash','Direct cash saving assumed'],['potentialHoursFreed','Potential staff hours freed']].map(([key,label])=>'<tr><th scope="row"><span>A'+(index+1)+'. '+esc(a.label)+'</span><small>'+label+'</small></th>'+cells(a[key],key,a.id)+'</tr>').join('')).join('');
    const costRows=[['implementationCashCost','Implementation cash'],['implementationCapacityCost','Internal staff-time implementation cost'],['subscriptionCost','Subscription allocation']].map(([key,label])=>'<tr><th scope="row">'+label+'</th>'+levels.map(level=>'<td data-case="'+labels[level]+'" data-planning-cost="'+key+'" data-planning-level="'+level+'" data-saved-value="'+(key==='subscriptionCost'?input[key]:input[key][costLevel[level]])+'">'+esc(money(key==='subscriptionCost'?input[key]:input[key][costLevel[level]]))+'</td>').join('')+'</tr>').join('');
    const head='<thead><tr><th scope="col">Component</th><th scope="col">Low</th><th scope="col">Central</th><th scope="col">High</th></tr></thead>';
    const breakdownBody='<div class="mr-planning-breakdown-body"><h4>Activity and cost breakdown</h4><p>Every activity is listed in full. Large charts name the three largest activities by central value in each benefit type and group the rest as Other activities. The grouping stays the same across cases. Staff hours are separate from dollar-valued ribbons.</p><table class="mr-sankey-table"><caption>Activity benefits over '+fmtWhole(input.horizonMonths)+' months</caption>'+head+'<tbody>'+activityRows+'</tbody></table><table class="mr-sankey-table"><caption>Cost components, using the same case pairing as the planning table</caption>'+head+'<tbody>'+costRows+'</tbody></table></div>';
    // Keep the print copy unchanged. Screen tables scroll as named, keyboard-
    // focusable regions rather than splitting a saved amount across lines.
    let screenTableIndex=0;
    const screenBreakdownBody=breakdownBody.replace(/<table class="mr-sankey-table">/g,()=>{
      const first=screenTableIndex++===0;
      return (first?'<p class="mr-planning-scroll-hint">Swipe or scroll across to compare all three cases.</p>':'')+'<div class="mr-planning-table-scroll" role="region" tabindex="0" aria-label="'+(first?'Activity benefits by planning case':'Cost components by planning case')+'"><table class="mr-sankey-table">';
    }).replace(/<\/table>/g,'</table></div>');
    const breakdown='<details class="mr-planning-breakdown"><summary>View every activity and cost</summary>'+screenBreakdownBody+'</details><div class="mr-planning-breakdown mr-planning-print-breakdown">'+breakdownBody+'</div>';
    return '<figure class="mr-operational-sankey" data-sankey-version="planning-case-sankey-20260919.3">'+
      '<div class="mr-sankey-figure-head"><h3>How each planning case adds up</h3><p>Follow the recorded activity benefits and individual costs over '+fmtWhole(input.horizonMonths)+' months. Ribbon widths represent dollar values on one shared scale, not hours. This is a planning-value comparison, not cash flow. The joined ribbons do not allocate a particular activity to a particular cost.</p></div>'+
      '<fieldset class="mr-planning-controls"><legend>Choose a planning case</legend>'+levels.map(level=>'<input class="mr-planning-choice mr-planning-choice-'+level+'" type="radio" name="mr-planning-case" id="mr-planning-choice-'+level+'" value="'+level+'"'+(level==='central'?' checked':'')+'/><label for="mr-planning-choice-'+level+'">'+labels[level]+'</label>').join('')+
      '<div class="mr-planning-panels">'+cases.map(panel).join('')+'</div></fieldset>'+breakdown+'<figcaption>'+caption+'</figcaption></figure>';
  }
  // END PLANNING CASE SANKEY PRESENTATION 20260919.3

  function renderMetaExposure(m, n) {
    if (obj(m.financialScenario).version === 'operational-planning-scenario-20260919.2') return renderThreeBenefitAssumptions(m, n);
    const validated=financialScenarioPresentation(m);
    if(!validated)return '';
    const {s,input}=validated;
    // Keep fractional declared inputs visible. The calculator rounds outcome
    // totals to cents/hundredths; display must not turn .01% or $0.25 into zero.
    const scenarioNumber=v=>Number(v).toLocaleString('en-US',{maximumSignificantDigits:15});
    const scenarioMoney=v=>(Number(v)<0?'-$':'$')+scenarioNumber(Math.abs(Number(v)));
    const scenarioPercent=v=>scenarioNumber(v)+'%';
    const noCash=['low','central','high'].every(k=>s.totals.avoidableNonLaborCash[k]===0);
    const metrics=[['potentialHoursFreed','Potential time freed',scenarioNumber,'hours'],['capacityValue','Value of potential staff capacity',scenarioMoney,'Not cash savings'],
      ['avoidableNonLaborCash','Potential non-labor cash avoided',scenarioMoney,noCash?'No direct cash saving assumed.':'Separate expenditure'],['cashInvestment','Implementation cash and subscription cost',scenarioMoney,'Cash cost'],
      ['totalImplementationAndSubscriptionCost','Total implementation and subscription cost',scenarioMoney,'Includes internal staff time'],
      ['netCashEffect','Net cash effect',scenarioMoney,'Cash avoided minus cash cost'],['netCapacityAndCashValue','Net capacity and cash scenario value',scenarioMoney,'Includes staff capacity, not a cash return']];
    const values=(value,format)=>'<dl class="mr-scenario-values">'+['low','central','high'].map(k=>'<div><dt>'+({low:'Low scenario',central:'Central scenario',high:'High scenario'}[k])+'</dt><dd>'+esc(format(value[k]))+'</dd></div>').join('')+'</dl>';
    const cards=metrics.map(([key,label,format,detail])=>'<div class="mr-scenario-metric"><h3>'+esc(label)+'</h3><p class="mr-copy">'+esc(detail)+'</p>'+values(s.totals[key],format)+'</div>').join('');
    const activities=arr(input.activities).map(a=>'<article class="mr-scenario-assumption"><h3>'+esc(a.label)+'</h3><dl class="mr-scenario-facts">'+
      [['Recorded activity hours',scenarioNumber(a.measuredHours)],['Source basis',humanize(a.sourceBasis)],['Source reference',a.sourceReference],['Loaded hourly labor cost',scenarioMoney(a.loadedHourlyCost)],
        ['Basis for proposed change',a.changeBasis],['Cash avoidance basis',a.cashBasis]].map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+
      '<h4>Assumed time reduction</h4>'+values(a.reductionPercent,scenarioPercent)+'<h4>Assumed adoption</h4>'+values(a.adoptionPercent,scenarioPercent)+
      '<h4>Non-labor expenditure avoided over the planning period</h4>'+values(a.avoidableNonLaborCash,scenarioMoney)+'</article>').join('');
    return '<section class="mr-section mr-financial-scenario"><h2>'+n+'. Operational planning scenario</h2><p class="mr-lede">'+esc(s.title)+'</p><p>'+esc(s.notice)+'</p>'+
      '<p class="mr-copy">Cost ranges below run from lower to higher cost. Net results pair lower benefits with higher costs for the low outcome, central inputs for the central outcome, and higher benefits with lower costs for the high outcome.</p>'+
      '<dl class="mr-scenario-facts">'+[['Scope',obj(s.scope).label],['People covered by operational records',fmtWhole(input.measuredPeople)],['Measured period',recordedDate(input.measurementStart)+' to '+recordedDate(input.measurementEnd)],['Planning period',fmtWhole(input.horizonMonths)+' months']].map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+cards+
      '<h3>Inputs and assumptions</h3><p>'+esc(obj(s.method).calculation)+'</p><p>'+esc(obj(s.method).extrapolation)+'</p>'+activities+
      '<article class="mr-scenario-assumption"><h3>Implementation and subscription costs</h3><h4>Incremental implementation cash</h4>'+values(input.implementationCashCost,scenarioMoney)+
      '<h4>Internal staff-time implementation value</h4>'+values(input.implementationCapacityCost,scenarioMoney)+'<p><strong>Subscription allocation:</strong> '+esc(scenarioMoney(input.subscriptionCost))+'</p><p>'+esc(input.costBasis)+'</p></article>'+
      '<p>'+esc(obj(s.participation).statement)+'</p><ul>'+arr(obj(s.participation).remaining).map(r=>'<li>'+esc(r.text)+'</li>').join('')+'</ul>'+arr(s.limitations).map(t=>'<p class="mr-copy">'+esc(t)+'</p>').join('')+'</section>';
  }

  function renderRequirements(m, n) {
    const requirements = arr(m.requirements);
    if (!requirements.length) return "";
    return '<section class="mr-section mr-requirements"><h2>' + n + '. What would strengthen the read</h2>' +
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
          '<div class="mr-remedy-head"><span class="mr-remedy-number">0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(path.kicker || path.sourceLens || "Option") + '</div>' +
          '<h3>' + esc(path.label || "Option") + '</h3>' +
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
    const heading = experience.participant_reports_available ? "What participants reported" : "Results by participant perspective";
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
    const method = m.campaignEvidence?.depth ? 'This campaign uses its recorded population, participant identities, measurement versions and period. Readiness checks whether missing responses could move the population median into a different existing score band. These are conservative product rules, not an independently validated scientific threshold. '+(m.product==='depth'?'The published score is the median of the included scores for this diagnostic.':'When the campaign and coherence checks permit a Composite, each contributing diagnostic mean receives equal weight. This scoring rule is not an empirically validated causal model.')+' Differences remain visible. A preferred action additionally requires a recorded operating-evidence and safeguards review; eligibility does not prove an intervention will work.' : m.product === "depth"
      ? "The published condition is the median of the submitted scores from one Diagnostic. The observed distribution, differences between participant perspectives, scope, source identity, versions, measurement window, and sampling frame are reported separately. Sample size alone does not establish population representativeness."
      : "When the Coherent or Strong evidence threshold is met, the published composite is the arithmetic mean of the contributing Diagnostic means, so each Diagnostic receives one vote regardless of submitted run count. Run counts contribute to evidence coverage and balance; they do not establish how many distinct people responded. A Comparison Only or Directional read withholds the composite. Diagnostic disagreement remains visible and is not subtracted from the condition score.";
    return '<section class="mr-section mr-meta-method"><h2>' + n + '. Method and limits</h2><p>' + esc(method) + '</p>' +
      (m.campaignEvidence?.depth?'<p>Participation and missing-response reporting are informed by selected published <a href="https://aapor.org/standards-and-ethics/standard-definitions/">AAPOR guidance</a>. Monderman defines its own eligibility rules; AAPOR has not validated them.</p>':'')+
      (obj(m.financialScenario).version==='operational-planning-scenario-20260913.1'?'<p>The separate operational scenario documents scope, inputs, assumptions and costs, informed by selected practices in <a href="https://www.gao.gov/products/gao-20-195g">GAO’s Cost Estimating and Assessment Guide</a>. Customer-defined low, central and high cases compare combined assumptions. This is not GAO approval, full compliance or a validated savings method.</p>':'')+
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
      // A completed interpretation supplies the tailored options. Preserve the
      // measured findings and method without a competing generic action plan.
      if (obj(m.aiReport).status === 'complete' && [renderMetaActions, renderMetaRemedyPaths, renderMetaIndicators].includes(renderer)) return;
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
      '<div class="mr-run-metric-value">' + esc(value || "Unavailable") + '</div>' +
      (detail ? '<p class="mr-copy">' + esc(detail) + '</p>' : '') + '</div>';
  }

  function renderRunDecisionBrief(m, n) {
    const exp = obj(m.exposure);
    const score = strictFinite(m.score) ? fmt1(m.score) : "Unavailable";
    return '<section class="mr-section mr-run-decision"><div class="mr-section-index">0' + n + ' · Decision summary</div>' +
      '<div class="mr-run-headline"><div><h2>' + esc(m.headline || "Measured operating condition") + '</h2><p class="mr-exec-lede">' + esc(m.execSummary) + '</p></div>' +
      '<div class="mr-run-score-stamp"><span>Diagnostic score</span><strong>' + esc(score) + '</strong><em>' + esc(m.band) + '</em></div></div>' +
      '<div class="mr-run-metrics">' +
        runMetric("Primary measured focus", m.primarySignal, m.primarySignalNote, "teal") +
        runMetric("Participant perspective", m.participantMode, "One person's recorded view", "ink") +
        runMetric("Change over time", m.trajectoryLabel, m.trajectoryNote, "amber") +
        runMetric("Evidence depth", m.evidenceBand, m.participantMode + " perspective", "green") +
      '</div>' +
      '<div class="mr-run-decision-story' + (m.firstMove && obj(m.aiReport).status !== 'complete' ? '' : ' is-single') + '">' +
        '<div><div class="mr-lens-label">What this may mean</div><p>' + esc(m.bottomLine) + '</p></div>' +
        (m.firstMove && obj(m.aiReport).status !== 'complete' ? '<div><div class="mr-lens-label">First thing to test</div><p>' + esc(m.firstMove) + '</p></div>' : '') +
      '</div></section>';
  }

  function renderConstraintConcentration(m) {
    const isClarity = m.toolType === "structural_clarity";
    const composition = obj(obj(m.descriptor).composition);
    const segments = arr(composition.segments).filter((segment) => strictFinite(obj(segment).pct)).slice(0, 8);
    if (!segments.length) return "";
    const palette = ["#08383E", "#0C6E78", "#3E8A92", "#7FB0B6", "#A9CED1", "#C9DCDE", "#DDE8E9", "#EAE6DD"];
    const shareLabel = isClarity ? "% of the combined distance from the scale maximum" : "% of measured constraint";
    const bar = segments.map((segment, index) => '<span style="width:' + Math.max(0, Math.min(100, Number(segment.pct))).toFixed(2) + '%;background:' + palette[index % palette.length] + '" title="' + esc(firstStr(segment.label, humanize(segment.key)) + ": " + fmt1(segment.pct) + shareLabel) + '"></span>').join("");
    const legend = segments.map((segment, index) => '<div><i style="background:' + palette[index % palette.length] + '"></i><span>' + esc(firstStr(segment.label, humanize(segment.key))) + '</span><strong>' + esc(fmt1(segment.pct)) + '%</strong></div>').join("");
    const primary = obj(composition.primary);
    const heading = isClarity ? "Clarity indicator distribution" : "Where the measured issue appears";
    const label = isClarity ? "Each dimension's share of the combined distance from the top of the clarity scale" : "Share of the measured issue by dimension";
    return '<div class="mr-constraint-view"><div class="mr-viz-title">' + heading + '</div><div class="mr-constraint-bar" role="img" aria-label="' + esc(label) + '">' + bar + '</div>' +
      '<div class="mr-constraint-legend">' + legend + '</div><div class="mr-constraint-read"><div><div class="mr-lens-label">Pattern across dimensions</div><strong>' + esc(humanize(firstStr(composition.shape, obj(m.descriptor).burden_distribution_type, "Not classified"))) + '</strong></div>' +
      '<p>' + esc(isClarity ? "The chart compares each dimension's distance from the top of the scoring scale. Shares do not measure hours, cost, or risk, and do not by themselves establish a problem." : firstStr(obj(m.descriptor).dominant_burden_note, primary.label ? primary.label + " carries the largest measured share of the constraint profile." : "The chart shows how the measured constraint is distributed across dimensions.")) + '</p></div></div>';
  }

  function renderRunDimensions(m, n) {
    const dimensions = arr(m.dimensionEntries);
    if (!dimensions.length) return "";
    const rows = dimensions.map((dimension) => {
      if (dimension.score === null) {
        const unmeasured = dimension.coverage.status === 'not_measured';
        return '<div class="mr-dimension-row '+(unmeasured?'is-unmeasured':'is-unavailable')+'"><div class="mr-dimension-copy"><strong>' + esc(dimension.label) + '</strong><span>'+(unmeasured?'Not measured':'Score unavailable')+'</span></div><div class="mr-dimension-detail">'+(unmeasured?'No score is available for this dimension. Related answers may still be reported separately.':'No score is available in this saved report.')+'</div></div>';
      }
      const score = Math.max(0, Math.min(100, Number(dimension.score)));
      const evidenceCount = strictFinite(dimension.coverage.evidence_count) ? fmtWhole(dimension.coverage.evidence_count) + (dimension.coverage.evidence_count === 1 ? " scored input" : " scored inputs") : "Measured dimension";
      const isPrimary = String(dimension.label).toLowerCase() === String(m.primarySignal).toLowerCase();
      return '<div class="mr-dimension-row' + (isPrimary ? ' is-primary' : '') + '">' +
        '<div class="mr-dimension-copy"><strong>' + esc(dimension.label) + '</strong><span>' + esc(fmt1(score)) + '</span></div>' +
        '<div class="mr-dimension-track" role="img" aria-label="' + esc(dimension.label + " score " + fmt1(score) + " of 100") + '"><span style="width:' + score.toFixed(2) + '%"></span><i style="left:' + score.toFixed(2) + '%"></i></div>' +
        '<div class="mr-dimension-detail">' + esc(evidenceCount) + (isPrimary ? '<b>Primary measured focus</b>' : '') + '</div></div>';
    }).join("");
    const findings = arr(m.findings).map(textItem).filter(Boolean);
    return '<section class="mr-section mr-run-dimensions"><div class="mr-dimension-opening"><div class="mr-section-index">0' + n + ' · Measured condition</div>' +
      '<h2>Dimension profile</h2><p class="mr-lede">The profile keeps the total score and its contributing dimensions visible together. For condition dimensions, lower values indicate greater measured constraint. For Compensatory Effort, when shown, higher values indicate more reported extra effort.</p>' +
      '<div class="mr-dimension-chart"><div class="mr-dimension-axis" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>' +
      '<div class="mr-dimension-profile">' + rows + '</div></div></div>' + renderConstraintConcentration(m) +
      (findings.length ? '<div class="mr-run-findings"><div class="mr-lens-label">Findings from scored answers</div><ul>' + findings.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>' : '') + '</section>';
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
      ["01", "Workload entered", strictFinite(people) ? fmtWhole(people) + " people" : "Bounded scope", [strictFinite(cycles) ? fmtWhole(cycles) + " annual cycles" : "", strictFinite(meetingHours) ? fmt1(meetingHours) + " hours per run" : ""].filter(Boolean).join(" · ")],
      ["02", "Modeled burden time", strictFinite(exp.annual_hours) ? fmtWhole(exp.annual_hours) + " hours" : "Time not calculated", strictFinite(exp.annual_hours) ? firstStr(model.formula, "Directional scenario") : exposureReason(exp.unpriced_reason)],
      ["03", "Modeled labor cost", strictFinite(exp.annual_cost) ? fmtMoney(exp.annual_cost) : "Cost not calculated", strictFinite(hourlyCost) ? fmtMoney(hourlyCost) + " loaded hourly cost" : strictFinite(exp.annual_cost) ? "Directional scenario" : exposureReason(exp.unpriced_reason)],
      ["04", "Modeled recovery scenario", strictFinite(exp.recoverable_cost) ? fmtMoney(exp.recoverable_cost) : "Not established", strictFinite(exp.recoverable_share_percent) ? fmtPercent(exp.recoverable_share_percent) + " modeled share" : "Not claimed"]
    ];
    return '<section class="mr-section mr-run-exposure"><div class="mr-section-index">0' + n + ' · Time and cost scenario</div><h2>How the time and cost estimate is built</h2>' +
      '<p class="mr-lede">Workload assumptions, modeled time, modeled labor cost, and the recovery scenario stay separate so each assumption can be reviewed. None is an audited or realized saving.</p>' +
      '<div class="mr-exposure-flow">' + steps.map((step) => '<div class="mr-exposure-step"><span>' + step[0] + '</span><div class="mr-lens-label">' + esc(step[1]) + '</div><strong>' + esc(step[2]) + '</strong><p>' + esc(step[3]) + '</p></div>').join("") + '</div>' +
      (model.note ? '<p class="mr-model-note">' + esc(model.note) + '</p>' : '') + '</section>';
  }

  function renderRunGovernance(m, n) {
    if (!m.benchmarkDetail && !m.tradeoff && !m.trajectoryLabel && !m.quadrant) return "";
    return '<section class="mr-section mr-run-leadership"><div class="mr-section-index">0' + n + ' · How to interpret the result</div><h2>What the result supports and what it does not</h2>' +
      '<div class="mr-leadership-grid">' +
        (m.benchmarkDetail ? '<div><div class="mr-lens-label">Design reference (not a peer benchmark)</div><p>' + esc(m.benchmarkDetail) + '</p></div>' : '') +
        (m.tradeoff ? '<div><div class="mr-lens-label">Tradeoff to consider</div><p>' + esc(m.tradeoff) + '</p></div>' : '') +
        (m.quadrant ? '<div><div class="mr-lens-label">Relationship between the measured dimensions</div><p>' + esc(m.quadrant) + '</p></div>' : '') +
        (m.trajectoryLabel ? '<div><div class="mr-lens-label">Change over time</div><strong>' + esc(m.trajectoryLabel) + '</strong>' + (m.trajectoryNote ? '<p>' + esc(m.trajectoryNote) + '</p>' : '') + '</div>' : '') +
      '</div></section>';
  }

  function renderRunEvidence(m, n) {
    const evidence = safeParticipantEvidence(m.participantEvidence);
    const watch = arr(m.watch).map(textItem).filter(Boolean);
    const coverage = obj(m.coverage);
    const measured = coverage.measured_dimension_count;
    const total = coverage.total_dimension_count;
    const evidenceHtml = evidence.length ? evidence.map((item) => {
      const row = obj(item);
      const label = firstStr(row.label, humanize(firstStr(row.participant_mode, row.perspective, "Participant observation")));
      return '<div class="mr-evidence-quote"><div class="mr-lens-label">' + esc(label) + '</div><p>' + esc(firstStr(row.text, row.message, row.summary)) + '</p></div>';
    }).join("") : '<div class="mr-evidence-empty"><div class="mr-lens-label">Written participant notes</div><h3>No additional written participant notes are displayed in this section.</h3><p>The measured results reflect the structured answers supplied for this run. Written notes are a separate source of context.</p></div>';
    return '<section class="mr-section mr-run-evidence"><div class="mr-section-index">0' + n + ' · Evidence in this run</div><h2>What this result is based on</h2>' +
      '<div class="mr-evidence-summary">' +
        runMetric("Evidence depth", m.evidenceBand, "Scope of this single run", "teal") +
        runMetric("Measured dimensions", strictFinite(measured) && strictFinite(total) ? fmtWhole(measured) + " of " + fmtWhole(total) : fmtWhole(arr(m.dimensionEntries).filter(item=>item.score!==null).length), "Dimensions represented", "ink") +
        runMetric("Perspective", m.participantMode, "Notes do not change the score", "green") +
      '</div><div class="mr-run-evidence-grid"><div>' + evidenceHtml + '</div>' +
      (watch.length ? '<div><div class="mr-lens-label">What to watch next</div><ul>' + watch.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>' : '<div class="mr-evidence-clean"><div class="mr-lens-label">Watch items</div><p>No additional watch item was recorded for this run.</p></div>') +
      '</div></section>';
  }

  function priorityReviewLabel(value) {
    // Display wording only: keep the saved priority, order and values intact.
    const label = firstStr(value, "Priority");
    return label.toLowerCase() === "fix now" ? "First review" : label.toLowerCase() === "fix next" ? "Next review" : label;
  }

  function renderPriorityMatrix(m) {
    const isClarity = m.toolType === "structural_clarity";
    const ladder = arr(m.priorityLadder).slice(0, 5);
    if (!ladder.length) return "";
    const yPositions = [24, 52, 78, 88, 94];
    const points = ladder.map((item, index) => {
      const row = obj(item);
      const severity = strictFinite(row.severity) ? Number(row.severity) : (strictFinite(row.weakness) ? Number(row.weakness) : 50);
      const x = 28 + (Math.max(0, Math.min(100, severity)) / 100) * 64;
      const y = yPositions[index] || 94;
      return '<div class="mr-priority-point' + (x > 50 ? ' mr-priority-label-left' : '') + '" style="left:' + x.toFixed(2) + '%;top:' + y + '%" data-rank="' + (index + 1) + '"><span>' + (index + 1) + '</span><div><strong>' + esc(firstStr(row.focus, row.label, "Measured focus")) + '</strong><small>' + esc(priorityReviewLabel(row.priority)) + ' · ' + esc(fmt1(severity)) + '</small></div></div>';
    }).join("");
    const heading = isClarity ? "Review order and clarity indicators" : "Priority order and measured severity";
    const vertical = isClarity ? "Review earlier" : "Test earlier";
    const horizontal = isClarity ? "Distance from scale maximum →" : "Greater measured severity →";
    const note = isClarity ? "Horizontal position shows distance from the top of the clarity scale. Vertical position follows the suggested review order, not urgency or a separate risk score." : "Horizontal position shows measured severity. Vertical position follows the report's suggested testing order; it is not a separate risk score.";
    return '<div class="mr-priority-matrix"><div class="mr-viz-title">' + heading + '</div><div class="mr-priority-plot" role="img" aria-label="' + esc(heading) + '"><span class="mr-priority-axis-y">' + vertical + '</span><span class="mr-priority-axis-x">' + horizontal + '</span><i class="mr-priority-grid-x"></i><i class="mr-priority-grid-y"></i>' + points + '</div><p class="mr-copy">' + esc(note) + '</p></div>';
  }

  function renderRunActions(m, n) {
    const nextStepsOnly = m.outputPolicy?.version === 'individual-report-action-policy-20260911.1' && m.outputPolicy.individual_next_steps_only === true;
    const ladder = arr(m.priorityLadder), actions = arr(m.actions).map(textItem).filter(Boolean), remedies = nextStepsOnly ? [] : arr(m.remedyPaths);
    // Follow saved categories/order; only the displayed fix labels say review.
    const monitoring = m.toolType === "structural_clarity" && ladder.length > 0 && ladder.every(item => obj(item).priority === "Monitor");
    if (!ladder.length && !actions.length && !remedies.length) return "";
    const ladderHtml = ladder.length ? '<div class="mr-priority-ladder">' + ladder.map((item, index) => {
      const row = obj(item);
      const severity = strictFinite(row.severity) ? row.severity : (strictFinite(row.weakness) ? row.weakness : null);
      return '<div class="mr-priority-row"><span>0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(priorityReviewLabel(row.priority)) + '</div><strong>' + esc(firstStr(row.focus, row.label, "Measured focus")) + '</strong></div><em>' + esc(severity === null ? "Unavailable" : fmt1(severity)) + '</em></div>';
    }).join("") + '</div>' : '';
    const adjustedRemedyRecovery = remedies.some((item) => hasGeneratedRemedyRecoveryRange(obj(item).benefit));
    const remediesHtml = remedies.length ? '<div class="mr-remedy-grid">' + remedies.slice(0, 3).map((item, index) => {
      const path = obj(item);
      const benefit = displayRemedyBenefit(path.benefit);
      return '<article class="mr-card mr-remedy-card mr-run-remedy" data-path-depth="' + (index + 1) + '"><div class="mr-remedy-head"><span class="mr-remedy-number">0' + (index + 1) + '</span><div><div class="mr-lens-label">' + esc(firstStr(path.kicker, "Option")) + '</div><h3>' + esc(firstStr(path.label, "Option")) + '</h3></div></div>' +
        (path.summary ? '<p>' + esc(path.summary) + '</p>' : '') +
        (arr(path.actions).length ? '<div class="mr-remedy-actions"><div class="mr-remedy-field-label">Suggested steps</div><ol>' + arr(path.actions).map((action) => '<li>' + esc(textItem(action)) + '</li>').join("") + '</ol></div>' : '') +
        '<div class="mr-remedy-tradeoffs">' + (benefit ? '<div><div class="mr-remedy-field-label">Potential benefit</div><p>' + esc(benefit) + '</p></div>' : '') + (path.risk ? '<div><div class="mr-remedy-field-label">Tradeoff</div><p>' + esc(path.risk) + '</p></div>' : '') + '</div></article>';
    }).join("") + '</div>' + (adjustedRemedyRecovery ? '<p class="mr-copy">Earlier financial estimates are omitted. These options do not establish savings.</p>' : '') : '';
    const aiHeading = monitoring ? "Monitoring priorities" : "Measured priorities";
    if (obj(m.aiReport).status === "complete") return ladder.length ? '<section class="mr-section mr-run-action-board"><div class="mr-priority-intro"><div class="mr-section-index">0' + n + ' · ' + aiHeading + '</div><h2>' + aiHeading + '</h2>' + renderPriorityMatrix(m) + '</div>' + ladderHtml + '</section>' : '';
    const actionHeading = nextStepsOnly ? 'Priorities and next steps' : monitoring ? "Monitoring priorities and options" : "Priorities and options";
    const actionNote = nextStepsOnly ? 'This individual run supports checks and small next steps. Broader action alternatives require a defined campaign that meets its evidence checks. The original score remains unchanged.' : monitoring ? "The list orders dimensions for monitoring. A rank is not proof of a defect; any change needs supporting evidence. The options do not change the score or predict an outcome." : "The priority list ranks measured issues. The options describe different scopes of change and do not correspond one-to-one with that list. None changes the score or predicts an outcome.";
    return '<section class="mr-section mr-run-action-board"><div class="mr-priority-intro"><div class="mr-section-index">0' + n + ' · ' + (monitoring ? "What to monitor" : "What to test next") + '</div><h2>' + actionHeading + '</h2>' +
      '<p class="mr-lede">' + actionNote + '</p>' + renderPriorityMatrix(m) + '</div>' + ladderHtml +
      (actions.length ? '<div class="mr-run-actions"><div class="mr-lens-label">Suggested order</div><ol>' + actions.map((action) => '<li>' + esc(action) + '</li>').join("") + '</ol></div>' : '') + remediesHtml + '</section>';
  }

  function renderRunMethod(m, n) {
    const p = obj(m.provenance), c = obj(m.context), model = obj(obj(m.exposure).model);
    const language = obj(m.reportLanguage), migration = obj(language.migration);
    const correction = obj(m.presentationCompatibility), correctedFields = arr(correction.corrected_fields);
    // This is an explicit server-issued display correction, not a rewrite of
    // the saved report, its original wording version, or its reviewed AI text.
    const hasCorrection = m.toolType === "operational_systems" && correction.status === "known_legacy_text_corrected"
      && typeof correction.version === "string" && correction.version.length <= 80
      && /^os-presentation-\d{4}-\d{2}-\d{2}\.\d+$/.test(correction.version)
      && correctedFields.length > 0 && correctedFields.length <= 64
      && correctedFields.every(field => typeof field === "string" && field.length <= 256 && /^[a-zA-Z0-9_.\[\]-]+$/.test(field))
      && typeof correction.notice === "string" && correction.notice.trim().length > 0;
    const correctionNotice = hasCorrection ? correction.notice.trim().slice(0, 512) : "";
    const rows = [
      ["Instrument", m.toolLabel], ["Operating scope", firstStr(m.processName, m.scopeLabel)],
      ["Participant perspective", m.participantMode], ["Reported answer confidence", displayReportedAnswerConfidence(m.insightDepth, c)],
      ["Change over time", m.trajectoryLabel], ["Calculation method", displayCalculationMethod(model.model_type)],
      ["Calculation version", firstStr(model.version)],
      ["Questionnaire version", m.questionnaireVersion || "Not recorded"],
      ["Scoring version", displayScoringVersion(m.scorerVersion)],
      ["Report wording version", firstStr(language.generation_version, "Not recorded")],
      ["Current display version", RENDERER_VERSION],
      ["Presentation correction version", hasCorrection ? correction.version : ""],
      ["Presentation correction notice", correctionNotice],
      ["Engine revision", firstStr(p.engine_commit)], ["Artifact digest", firstStr(p.artifact_sha256)]
    ].filter((row) => row[1]);
    const methodTextLength = rows.reduce((total, row) => total + row.join("").length, 0) + String(migration.from_version || "").length;
    const boundedMethodClass = methodTextLength <= 2200 ? ' mr-run-method-bounded' : '';
    return '<section class="mr-section mr-run-method' + boundedMethodClass + '"><div class="mr-section-index">0' + n + ' · Method and limits</div><h2>How this report was produced</h2><dl>' +
      rows.map((row) => '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>').join("") + '</dl>' +
      (migration.from_version ? '<p class="mr-method-copy">Report wording was generated with a newer template when this run completed. The recorded answers, scoring method, and numeric result were preserved. Original wording version: ' + esc(migration.from_version) + '.</p>' : '') +
      '<p class="mr-method-copy">The score and dimension values come from the submitted answers. Participant notes, when present, are shown separately and do not change the score. One run does not establish organizational savings or recoverable time. The design reference was set when the instrument was designed; it is not a comparison with customer or industry data.</p></section>';
  }

  function renderRunLeadershipClose(m, n) {
    if (obj(m.aiReport).status === "complete") return "";
    const ladder = arr(m.priorityLadder);
    const monitoring = m.toolType === "structural_clarity" && ladder.length > 0 && ladder.every(item => obj(item).priority === "Monitor");
    const indicators = ladder.slice(0, 3).map((item) => firstStr(obj(item).focus, obj(item).label)).filter(Boolean);
    const scope = firstStr(m.processName, m.scopeLabel, "the measured operating scope");
    const scopeWithArticle = /^[a-z]/.test(scope) && !/^(?:the|this|that)\b/i.test(scope) ? "the " + scope : scope;
    const firstAction = firstStr(m.firstMove, textItem(arr(m.actions)[0]));
    const questions = monitoring ? [
      "Who is responsible for checking the reported clarity against routine work in " + scopeWithArticle + "?",
      "What separate evidence would justify a change to the current arrangements?",
      "Which owner will preserve the same scope and inputs for the next comparison?"
    ] : [
      "Who has the authority to change " + firstStr(m.primarySignal, "the primary measured constraint") + " in " + scopeWithArticle + "?",
      "What observable result will count as improvement, and what would show that burden was only displaced?",
      "Which owner will preserve the same scope and inputs for like-for-like remeasurement?"
    ];
    return '<section class="mr-section mr-leadership-close"><div class="mr-section-index">0' + n + ' · Next decision</div><h2>' + (monitoring ? 'Check routine work and plan the next comparison' : 'Turn the result into a small, measurable test') + '</h2>' +
      '<div class="mr-leadership-close-grid"><div class="mr-leadership-sequence"><div class="mr-lens-label">Sequence</div><ol>' +
        '<li><strong>' + (monitoring ? 'Confirm the review owner.' : 'Assign ownership.') + '</strong><span>' + (monitoring ? 'Ask the person responsible for this structure to coordinate the review.' : 'Name one accountable owner for ' + esc(firstStr(m.primarySignal, "the primary measured constraint")) + '.') + '</span></li>' +
        '<li><strong>Run the first test.</strong><span>' + esc(firstAction || "Select the smallest returned action that can test the diagnosis without adding new operating burden.") + '</span></li>' +
        '<li><strong>Watch the measured indicators.</strong><span>' + esc(indicators.length ? indicators.join(" · ") : "The score, primary dimension, burden estimate, and any returned watch items") + '</span></li>' +
        '<li><strong>Repeat under comparable conditions.</strong><span>Repeat the same Diagnostic with the same scope and comparable inputs; compare the score, dimensions and recorded answers before attributing improvement.</span></li>' +
      '</ol></div><div class="mr-ownership-questions"><div class="mr-lens-label">Questions to answer before acting</div>' + questions.map((question, index) => '<div><span>0' + (index + 1) + '</span><p>' + esc(question) + '</p></div>').join("") + '</div></div>' +
      '<div class="mr-remeasurement-note"><div class="mr-lens-label">How to compare later</div><p>Compare runs only when the scope, participant perspective, instrument version, and key workload assumptions are comparable. Record any important difference instead of treating unlike runs as a trend.</p></div></section>';
  }

  function renderRunReport(m) {
    const renderers = [renderRunDecisionBrief, renderRunDimensions, renderRunGovernance, renderRunEvidence, renderRunActions, renderRunMethod, renderRunLeadershipClose];
    let html = "", n = 1, closingBoundary = false;
    renderers.forEach((renderer) => {
      const block = renderer(m, n);
      if (block) {
        if (renderer === renderRunLeadershipClose) {
          html += '<div class="mr-run-close-group">' + block + buildReportBoundary(m) + '</div>';
          closingBoundary = true;
        } else html += block;
        n += 1;
      }
    });
    return html + (closingBoundary ? '' : buildReportBoundary(m));
  }

  function renderSelfRunReport(m) {
    const groups=arr(m.sourceGroups), actions=arr(m.actions).map(textItem).filter(Boolean);
    const summaries=groups.map(group=>{const publish=group.n===1||(m.product==='depth'&&m.scorePublished);return '<article class="mr-card"><h3>'+esc(group.toolLabel)+'</h3><dl><div><dt>Your saved runs</dt><dd>'+esc(fmtWhole(group.n))+'</dd></div><div><dt>'+(group.n===1?'Saved diagnostic score':'Median of your selected scores')+'</dt><dd>'+esc(publish&&strictFinite(group.median)?fmt1(group.median):'Not shown: compatible measurements are required')+'</dd></div></dl><p>Open the original reports for their measured detail.</p></article>';}).join('');
    return '<section class="mr-section"><h2>Your recorded views</h2><p>'+esc(firstStr(m.coverBody,m.primaryPattern))+'</p><p>'+esc(m.runCountNote)+'</p><div class="mr-lens-grid">'+summaries+'</div></section>'+
      (actions.length&&obj(m.aiReport).status!=='complete'?'<section class="mr-section"><h2>Checks to consider next</h2><ol>'+actions.map(action=>'<li>'+esc(action)+'</li>').join('')+'</ol></section>':'')+
      '<section class="mr-section"><h2>How to use this comparison</h2><p>Review each original report before interpreting a difference. Compare scores only when the diagnostic version, operating scope, perspective and measurement window are compatible. A difference between your answers is not evidence of disagreement between people or a measured organizational trend.</p><p>'+esc(firstStr(m.evidenceDescription,m.scoreBasis))+'</p><p>A campaign collects responses from invited participants for a defined scope. Recorded identities do not independently prove unique physical people. Separate readiness checks determine when Depth Synthesis, Cross-Lens Synthesis and broader action alternatives are available.</p></section>';
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
      // per the cross-synth backend enhancement: {text, label, tools} for
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
          if (label && text) return label + ": " + text;
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
    const financial=financialScenarioPresentation(m) || threeBenefitPresentation(m);
    // Adapt only this known deterministic no-scenario boilerplate when a
    // valid separate scenario is actually attached. Never rewrite saved prose
    // or imply that a score supplies an estimate; source records stay intact.
    const coverBody=financial?firstStr(m.coverBody).replace(
      'A combined modeled time and labor-cost estimate is not published: Diagnostic scores, participant counts and medians do not establish organizational exposure, recoverable savings or return on investment. These estimates are withheld. A separate planning scenario requires explicit operational measurements and assumptions.',
      'The decision brief that follows includes a separate operational planning scenario, based on recorded activity and stated change assumptions. Diagnostic scores do not calculate its time or financial values.'
    ):m.coverBody;
    const meta = arr(m.meta);
    const productLabel = m.selfRun ? (m.comparisonOnly?'Self-run comparison':'Self-run Synthesis') : m.comparisonOnly ? 'Response comparison' : m.product === "depth" ? "Depth Synthesis" : m.product === "cross_lens" ? "Cross-Lens Synthesis" : firstStr(m.mastline).replace(/^Monderman\.?\s*(?:[•·]\s*)?/i, "") || "Diagnostic";
    const defaultScoreLabel = m.product === "depth" ? "Median Diagnostic Score" : m.product === "cross_lens" ? "Cross-Lens Composite Score" : "Diagnostic Score";
    const scoreLabel = m.selfRun && !m.scorePublished ? 'No combined score' : m.kind === "meta-synthesis" ? firstStr(m.scoreLabel, defaultScoreLabel) : defaultScoreLabel;
    const evidenceLabel = m.selfRun ? 'One account’s recorded views' : m.comparisonOnly ? 'Included responses only' : m.campaignEvidence?.depth ? 'Campaign checks recorded' : m.kind === "meta-synthesis" ? firstStr(m.evidenceLabel) : "";
    const scoreBandDisplay = m.selfRun ? (m.scorePublished ? m.headlineBand : '') : m.kind === "meta-synthesis" ? firstStr(m.conditionBand, m.headlineBand) : firstStr(m.headlineBand);
    const scoreClass = "mr-cover-score" + (strictFinite(m.headlineScore) ? "" : " mr-cover-score-status");
    const metaHtml = meta.map((x) => '<span><strong>' + esc(x.label) + '</strong>' + esc(x.value) + '</span>').join("");
    const statusPills = [
      evidenceLabel ? '<span class="mr-cover-pill mr-cover-pill-accent">' + esc(evidenceLabel) + (m.selfRun?'':' evidence')+'</span>' : ''
    ].filter(Boolean).join("");
    return '<section class="mr-cover">' +
      '<div class="mr-cover-dark"><p class="mr-cover-mark">MONDERMAN. ' + esc(productLabel) + '</p><div class="mr-cover-rule"></div>' +
      '<h1 class="mr-cover-title">' + esc(m.title) + '</h1><p class="mr-cover-sub">' + esc(m.subtitle) + '</p></div>' +
      '<div class="mr-cover-stripe"></div>' +
      '<div class="mr-cover-white"><p class="mr-cover-kicker">Executive Report</p>' +
      (obj(m.sampleProvenance).synthetic===true?'<p class="mr-sample-disclosure">Sample report · Example data</p>':'') +
      '<div class="mr-cover-score-row"><div class="' + scoreClass + '">' + esc(m.headlineScore == null ? "Unavailable" : m.headlineScore) + '</div>' +
      '<div class="mr-cover-score-copy"><div class="mr-cover-score-label">' + esc(scoreLabel) + '</div><div class="mr-cover-score-band">' + esc(scoreBandDisplay) + '</div></div></div>' +
      (statusPills ? '<div class="mr-cover-pills">' + statusPills + '</div>' : '') +
      (metaHtml ? '<div class="mr-cover-meta">' + metaHtml + '</div>' : '') +
      (coverBody ? '<p class="mr-cover-body">' + esc(coverBody) + '</p>' : '') +
      (m.kind === "meta-synthesis" && m.footnote ? '<div class="mr-cover-boundary"><div class="mr-cover-boundary-label">Interpretation boundary</div><p>' + esc(m.footnote) + '</p></div>' : '') +
      '</div></section>';
  }

  function buildReportBoundary(model) {
    const m = obj(model);
    if (!m.footnote) return "";
    return '<aside class="mr-report-boundary"><div class="mr-report-boundary-mark"></div><div><p class="mr-report-boundary-label">Interpretation boundary</p><p>' + esc(m.footnote) + '</p></div></aside>';
  }

  function buildCompatibilityNotice(model) {
    const compatibility = obj(obj(model).compatibility);
    if (compatibility.status !== "legacy_structured_view") return "";
    const notice = firstStr(
      compatibility.notice,
      "This pre-policy report is shown as a structured legacy view. Earlier explanatory text is withheld; scores and structured measurements are unchanged."
    );
    return '<aside class="mr-compatibility-notice"><div class="mr-compatibility-mark"></div><div><p class="mr-compatibility-label">Legacy report view</p><p>' + esc(notice) + '</p></div></aside>';
  }

  // Saved evidence, not model-selected emphasis. These qualifications must
  // remain visible even when AI selects different observations/actions.
  function buildAIRecordedContext(report) {
    const facts = arr(report.evidence).map(obj);
    const missing = facts.filter(f=>f.provenance==='deterministic_coverage' && f.value==='Not measured' && typeof f.label==='string' && f.label.endsWith(' evidence coverage'));
    const notes = [];
    if (missing.length) {
      const names = [...new Set(missing.map(f=>f.label.slice(0,-' evidence coverage'.length)))];
      notes.push('Not measured: '+names.join('; ')+'. '+(names.length===1?'No score is available for this dimension.':'No scores are available for these dimensions.')+' Related answers may still be reported separately.');
    }
    const scenarioLabels = ['Modeled annual hours of exposure','Modeled annual labor-cost exposure','Scenario recovery hours','Scenario recovery cost'];
    const unavailable = facts.filter(f=>f.provenance==='modeled_scenario' && scenarioLabels.includes(f.label) && f.value===null);
    if (unavailable.length && obj(report.financial_output_policy).version!=='single-run-financial-policy-20260913.1') {
      const allUnavailable = scenarioLabels.every(label=>unavailable.some(f=>f.label===label));
      const reason = facts.find(f=>f.provenance==='deterministic_sizing_status' && f.label==='Reason an exposure estimate was withheld' && typeof f.value==='string' && f.value.trim());
      notes.push((allUnavailable?'Time and cost estimates are unavailable.':'Some modeled time or cost estimates are unavailable.')+(reason?' Recorded reason: '+reason.value+'.':''));
    }
    const flagged = facts.find(f=>f.provenance==='deterministic_result' && f.label==='Contradictions flagged' && Number.isSafeInteger(f.value) && f.value>0);
    if (flagged) notes.push('The saved result records '+(flagged.value===1?'one contradiction flag':flagged.value+' contradiction flags')+'. A flag does not establish that answers conflict or identify a cause, person, or answer pair.');
    return notes.length?'<aside class="mr-ai-recorded-context"><h3>Important context from the saved result</h3><ul>'+notes.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul></aside>':'';
  }

  // Only a nonblank action can produce a recommendation card or action CTA.
  // Share this predicate so screen navigation never promises absent advice.
  function renderedAIRecommendations(state) {
    const ai = obj(state);
    if (ai.status !== "complete") return [];
    return arr(obj(obj(ai.report).interpretation).recommendations)
      .filter(item => typeof obj(item).action === "string" && item.action.trim());
  }

  function buildAIInterpretation(state) {
    const ai = obj(state);
    if (!ai.status) return "";
    const heading = '<h2>Interpretation and next steps</h2>';
    if (ai.status !== "complete") {
      const deferred=ai.status==='pending'&&typeof ai.deferUntil==='string'&&Number.isFinite(Date.parse(ai.deferUntil)) ? new Date(ai.deferUntil) : null;
      const timing=deferred ? '<p>Processing can resume after <time datetime="'+esc(deferred.toISOString())+'">'+esc(deferred.toLocaleString())+'</time>. This is not a completion guarantee.</p>' : '';
      const followUp = ai.status === 'attention_required'
        ? 'Contact Monderman support about this saved report; do not start another diagnostic.'
        : ['pending','processing'].includes(ai.status)
          ? 'Reopen this saved report to check progress; do not start another diagnostic.'
          : 'Keep this saved report; no new diagnostic is needed.';
      return '<section class="mr-section mr-ai-interpretation" aria-live="polite">' + heading + '<p>' + esc(ai.message) + '</p>'+timing+'<p>The measured result remains available. '+followUp+'</p></section>';
    }
    const report = obj(ai.report), interpretation = obj(report.interpretation);
    if(obj(report.composition).authorship==='provider_authored_engine_bounded')return buildAuthoredInterpretation(report);
    const reviewedSelection = obj(report.composition).reviewed_version === 'report-reviewed-capabilities-20260909.1';
    // Keep short reading units intact in print without making arbitrary long
    // provider text unbreakable. Escape every unit; no HTML is model-owned.
    const readingUnitClass = text => String(text).length <= 600 ? ' mr-ai-reading-unit' : '';
    const paragraphs = (items, title) => {
      const rows = arr(items);
      if (!rows.length) return '';
      const texts = rows.map(item => obj(item).text || item);
      const boundedListClass = texts.reduce((total, text) => total + String(text || '').length, 0) <= 1600 ? ' mr-ai-list-bounded' : '';
      return '<div class="mr-ai-list' + boundedListClass + '"><h3>' + title + '</h3><ul>' + texts.map(text =>
        '<li class="mr-ai-evidence-text"><span class="mr-ai-evidence-content' + readingUnitClass(text) + '">' + esc(text) + '</span></li>'
      ).join('') + '</ul></div>';
    };
    const sources = arr(report.sources).filter(source => /^https:\/\//i.test(firstStr(source.url)));
    const actions = renderedAIRecommendations(ai).map((item, index) => {
      const action = obj(item);
      const refs = sources.filter(source => arr(action.source_ids).includes(source.id));
      const reasons = String(action.reason || '').split(/\n\s*\n/).filter(text => text.trim()).map(text => '<p class="mr-ai-reason' + readingUnitClass(text) + '">' + esc(text) + '</p>').join('');
      const actionTextLength = [action.action, action.reason, action.prerequisite, action.risk, action.success_check]
        .reduce((total, value) => total + String(value || '').length, 0) +
        refs.reduce((total, source) => total + String(source.publisher || '').length, 0);
      const boundedActionClass = actionTextLength <= 1300 ? ' mr-ai-action-bounded' : '';
      return '<article class="mr-card mr-ai-action' + boundedActionClass + '"><h3>' + (index + 1) + '. ' + esc(action.action) + '</h3>' + reasons + '<dl>' +
        [['Before trying it',action.prerequisite],['Risk to consider',action.risk],['What to check',action.success_check]].map(row=>'<div class="mr-ai-definition"><dt><strong>'+row[0]+'</strong></dt><dd>'+esc(row[1])+'</dd></div>').join('') + '</dl>' +
        (refs.length ? '<p>Practice references: ' + refs.map(source=>'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.publisher)+'</a>').join('; ') + '.</p>' : '') + '</article>';
    }).join('');
    return '<section class="mr-section mr-ai-interpretation">' + heading +
      '<p>'+esc(interpretation.summary)+'</p>' +
      (reviewedSelection?buildAIRecordedContext(report):'') +
      paragraphs(interpretation.observations,reviewedSelection?'Selected responses and results':'What the responses suggest') + paragraphs(interpretation.hypotheses,'Possible explanations to investigate') +
      (actions ? '<h3>'+(reviewedSelection?'Suggested next steps':'Changes to test')+'</h3><div class="mr-ai-actions">'+actions+'</div>' : '') +
      paragraphs(arr(report.limitations).concat(arr(interpretation.limitations)),'Limits of this interpretation') +
      (firstStr(obj(report.benchmark).explanation) ? '<h3>Sector comparison</h3><p>'+esc(report.benchmark.explanation)+'</p>' : '') +
      (sources.length ? '<div class="mr-ai-sources' + (sources.reduce((total, source) => total + [source.title, source.publisher, source.reviewed].reduce((n, value) => n + String(value || '').length, 0), 0) <= 1200 ? ' mr-ai-sources-bounded' : '') + '"><h3>External practice sources</h3><ul>'+sources.map(source=>'<li><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+'</a>. '+esc(source.publisher)+'. Reviewed '+esc(source.reviewed)+'. Practice guidance, not a Monderman peer benchmark.</li>').join('')+'</ul></div>' : '') +
      '<p class="mr-method-copy">The Monderman diagnostic engine produced this report’s scores, classifications and evidence limits. '+(reviewedSelection?'This saved edition uses reviewed explanations selected with AI assistance and inserted by Monderman. ':'AI assisted with the interpretation within the saved report’s evidence limits. ')+'It did not determine the score.'+[["Interpretation version",customerReportVersion(report.version)],["Prepared",report.generated_at],["Evidence reference",report.snapshot_id]].filter(row=>firstStr(row[1])).map(row=>' '+row[0]+': '+esc(row[1])+'.').join('')+'</p></section>';
  }

  // Display attribution only when the saved evidence row and the closed source
  // channel agree. Never infer a source from its position or print private IDs,
  // hashes, prompt instructions, or arbitrary metadata supplied as a label.
  function sourceEvidenceAttributions(report) {
    if(report.campaign_answer_evidence){
      if(report.source_evidence)return new Map();
      return campaignEvidenceAttributions(report);
    }
    const channel=obj(report.source_evidence),sources=arr(channel.sources),mapped=new Map(),used=new Set();
    if(channel.version!=='personal-source-evidence-20260912.1'||!sources.length||sources.length>5000)return mapped;
    const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
    const perspectives={operational:'People doing the work',managerial:'Managers',executive:'Senior leaders',senior_leader:'Senior leaders'};
    const kinds=new Set(['participant_numeric_answer','participant_structured_answer','derived_burden_indicator','derived_condition_indicator','derived_dimension','deterministic_coverage']);
    const facts=new Map();
    for(const fact of arr(report.evidence)){
      if(facts.has(fact.id))return new Map();
      facts.set(fact.id,fact);
    }
    for(let index=0;index<sources.length;index++){
      const source=obj(sources[index]);let letters='';
      for(let n=index+1;n;n=Math.floor((n-1)/26))letters=String.fromCharCode(65+(n-1)%26)+letters;
      const label='Selected run '+letters;
      if(source.source_ref!=='R'+(index+1)||source.label!==label)return new Map();
      if(source.status==='unavailable'){
        if(source.reason!=='not_recorded'||source.fact_ids!==undefined)return new Map();
        continue;
      }
      if(source.status!=='available'||!Object.hasOwn(lenses,source.tool)||!Object.hasOwn(perspectives,source.role)
        ||![10,30,60].includes(source.depth)||!Array.isArray(source.fact_ids)||source.fact_ids.length>512)return new Map();
      for(const id of source.fact_ids){
        if(typeof id!=='string'||!/^F[1-9]\d{0,3}$/.test(id)||used.has(id))return new Map();
        used.add(id);
        const fact=facts.get(id);
        if(!fact||!kinds.has(fact.provenance)||fact.source_ref!==source.source_ref||fact.source_label!==label)return new Map();
        mapped.set(id,label+' · '+lenses[source.tool]+' · Perspective: '+perspectives[source.role]+' · '+source.depth+'-minute depth');
      }
    }
    return mapped;
  }

  // This browser mapping checks the public graph's internal consistency. The
  // server separately binds it to authorized original packets and validates the
  // question bank. Do not copy private question banks or infer missing groups.
  function campaignEvidenceAttributions(report) {
    const channel=obj(report.campaign_answer_evidence),coverage=obj(channel.coverage),groups=arr(channel.groups);
    const mapped=new Map(),used=new Set(),contexts=new Set(),facts=new Map();
    const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
    const perspectives={operational:'People doing the work',managerial:'Managers',senior_leader:'Senior leaders'};
    const count=value=>Number.isSafeInteger(value)&&value>=0;
    const finite=value=>typeof value==='number'&&Number.isFinite(value);
    const text=value=>typeof value==='string'&&value.length>0&&value.trim()===value;
    if(channel.version!=='campaign-recorded-answer-summary-20260912.1'||!Array.isArray(channel.groups)
      ||!count(coverage.selected_sources)||coverage.selected_sources<2||coverage.selected_sources>5000
      ||!count(coverage.original_packets_available)||coverage.original_packets_available>coverage.selected_sources
      ||!count(coverage.available_question_groups)||!count(coverage.included_question_groups)
      ||coverage.included_question_groups>coverage.available_question_groups||groups.length>coverage.included_question_groups
      ||!['available','partially_available','unavailable'].includes(coverage.source_detail_status)
      ||coverage.source_detail_status==='available'&&coverage.original_packets_available!==coverage.selected_sources
      ||groups.length&&coverage.source_detail_status==='unavailable'
      ||!['included','not_included_limit'].includes(coverage.detail_status)
      ||coverage.detail_status==='included'&&coverage.included_question_groups!==coverage.available_question_groups
      ||coverage.detail_status==='not_included_limit'&&coverage.included_question_groups!==0)return mapped;
    for(const fact of arr(report.evidence)){
      if(!fact||facts.has(fact.id))return new Map();
      facts.set(fact.id,fact);
    }
    let prior=0;
    for(const raw of groups){
      const group=obj(raw),measures=obj(group.measures),keys=Object.keys(measures);
      const number=typeof group.group_ref==='string'&&/^G[1-9]\d*$/.test(group.group_ref)?Number(group.group_ref.slice(1)):NaN;
      const label='Recorded answers: '+lenses[group.tool]+' / '+perspectives[group.role];
      if(!Number.isSafeInteger(number)||number<=prior||number>coverage.included_question_groups
        ||!Object.hasOwn(lenses,group.tool)||!Object.hasOwn(perspectives,group.role)||group.label!==label
        ||![10,30,60].includes(group.depth)||!text(group.questionnaire_version)||!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(group.questionnaire_version)
        ||!text(group.question)||group.question.length>2000||group.unit!==null
        ||group.unit_and_condition_basis!=='exact_original_question'||group.denominator_basis!=='recorded_answers_to_this_exact_question'
        ||!['numeric','single_choice','selected_option_combination'].includes(group.response_format))return new Map();
      prior=number;
      const context=JSON.stringify([group.tool,group.role,group.depth,group.questionnaire_version,group.question]);
      if(contexts.has(context))return new Map();contexts.add(context);
      for(const id of Object.values(measures)){
        const fact=facts.get(id);
        if(typeof id!=='string'||!/^F[1-9]\d{0,3}$/.test(id)||used.has(id)||!fact
          ||fact.provenance!=='deterministic_campaign_answer_summary'||fact.group_ref!==group.group_ref||fact.group_label!==label
          ||fact.unit!=null||!finite(fact.value))return new Map();
        used.add(id);
      }
      const n=facts.get(measures.answered_responses)?.value,matching=group.matching_source_packets;
      if(!count(n)||n<5||!count(matching)||matching<n||matching>coverage.original_packets_available)return new Map();
      if(facts.get(measures.answered_responses).label!=='Recorded answers')return new Map();
      if(group.response_format==='numeric'){
        if([...keys].sort().join('|')!=='answered_responses|lower_quartile|median|upper_quartile')return new Map();
        const median=facts.get(measures.median),low=facts.get(measures.lower_quartile),high=facts.get(measures.upper_quartile);
        if(median.label!=='Median reported estimate'||low.label!=='Lower quartile of reported estimates'
          ||high.label!=='Upper quartile of reported estimates'||low.value>median.value||median.value>high.value)return new Map();
      }else{
        if(keys.length<2||!keys.includes('answered_responses'))return new Map();
        const answers=[];let total=0;
        for(let index=1;index<=keys.length-1;index++){
          const fact=facts.get(measures['category_'+index]),start='Recorded selection: ';
          if(!fact||typeof fact.label!=='string'||!fact.label.startsWith(start)||!count(fact.value)||fact.value<5
            ||fact.value>n||n-fact.value>0&&n-fact.value<5)return new Map();
          const answer=fact.label.slice(start.length);
          if(!text(answer)||answers.includes(answer)||answers.length&&answers[answers.length-1].localeCompare(answer)>0)return new Map();
          answers.push(answer);total+=fact.value;
        }
        if(total!==n)return new Map();
      }
      const attribution=label+' · '+group.depth+'-minute depth · Questionnaire '+group.questionnaire_version
        +' · '+n.toLocaleString('en-US')+' recorded answers · '+matching.toLocaleString('en-US')+' matching saved reports';
      // Restore the exact question once in each evidence entry's display label.
      // The saved compact fact and authored prose stay unchanged.
      for(const id of Object.values(measures))mapped.set(id,{context:attribution,label:group.question+' · '+facts.get(id).label});
    }
    if(arr(report.evidence).some(fact=>fact.provenance==='deterministic_campaign_answer_summary'&&!used.has(fact.id)))return new Map();
    return mapped;
  }

  // Render the engine-owned question/answer unit separately from interpretation.
  // Only the closed, internally consistent saved graph earns this treatment.
  // Old text-only reports retain their original display; malformed metadata is
  // never treated as evidence or used to rewrite their saved prose.
  function buildPersonalQuestionBlock(item,report,attributions) {
    const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
      &&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
    const block=item.evidence_block,context=block&&block.context;
    const text=value=>typeof value==='string'&&value.length>0&&value.length<=4096;
    const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
    const roles={operational:'People doing the work',managerial:'Managers',senior_leader:'Senior leaders'};
    if(!report.source_evidence||report.campaign_answer_evidence
      ||!exact(block,['question','context','answers','selection_scope'])
      ||!exact(context,['tool','role','depth','questionnaire_version'])
      ||!text(block.question)||!Object.hasOwn(lenses,context.tool)||!Object.hasOwn(roles,context.role)
      ||![10,30,60].includes(context.depth)||!text(context.questionnaire_version)||!/^\d+\.\d+\.\d+$/.test(context.questionnaire_version)
      ||!['all_matching_sources','selected_sources'].includes(block.selection_scope)
      ||!Array.isArray(block.answers)||!block.answers.length||block.answers.length>12
      ||typeof item.interpretation_text!=='string'||item.interpretation_text.length>900)return null;
    const selected=new Set(),used=new Set(),refs=arr(item.evidence_ids),facts=arr(report.evidence);
    for(const answer of block.answers){
      if(!exact(answer,['source_label','answer'])||!text(answer.answer)||selected.has(answer.source_label))return null;
      const source=arr(report.source_evidence.sources).find(source=>source.label===answer.source_label);
      if(!source||source.status!=='available'||Object.keys(context).some(key=>source[key]!==context[key]))return null;
      const matching=facts.filter(fact=>refs.includes(fact.id)&&arr(source.fact_ids).includes(fact.id)
        &&attributions.has(fact.id)&&fact.provenance==='participant_structured_answer'
        &&fact.label===block.question&&fact.value===answer.answer);
      if(matching.length!==1)return null;
      selected.add(answer.source_label);used.add(matching[0].id);
    }
    if(facts.some(fact=>refs.includes(fact.id)&&fact.provenance==='participant_structured_answer'&&!used.has(fact.id)))return null;
    const contextText=lenses[context.tool]+' · '+roles[context.role]+' · '+context.depth+'-minute depth · Questionnaire '+context.questionnaire_version;
    const subset=block.selection_scope==='selected_sources';
    const fallback='Question: '+block.question+'\n'+contextText+'\n'+(subset?'Selected source reports\n':'')
      +block.answers.map(answer=>answer.source_label+': “'+answer.answer+'”').join('\n')
      +(item.interpretation_text?'\n\n'+item.interpretation_text:'');
    if(item.text!==fallback)return null;
    return '<div class="mr-question-evidence"><p class="mr-question-label">Recorded question</p><p class="mr-question-text">'+esc(block.question)+'</p><p class="mr-reading-context">'+esc(contextText)+'</p>'
      +(subset?'<p class="mr-question-subset">Selected source reports</p>':'')+'<dl>'+block.answers.map(answer=>'<div class="mr-question-answer'+(answer.answer.length<=600?' mr-question-answer-bounded':'')+'"><dt>'+esc(answer.source_label)+'</dt><dd>'+esc(answer.answer)+'</dd></div>').join('')+'</dl></div>'
      +(item.interpretation_text?'<p class="mr-question-interpretation">'+esc(item.interpretation_text)+'</p>':'');
  }

  // A styled account is an exact saved source unit, not a model paraphrase.
  // Its citation, closed metadata and compiled text must agree. Old or invalid
  // units keep their saved text; the renderer never repairs source evidence.
  function buildExperientialBlock(item,report) {
    const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
      &&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
    const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value;
    const roles={operational:'People doing the work',managerial:'Managers',executive:'Senior leaders',senior_leader:'Senior leaders',not_specified:'Role not specified',authorized_workspace_staff:'Authorized workspace staff'};
    const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
    const block=item.experiential_block,refs=item.evidence_ids;
    if(!exact(block,['version','role','lens','scope_label','text'])
      ||block.version!=='experiential-prose-block-20260913.1'
      ||!Object.hasOwn(roles,block.role)||!Object.hasOwn(lenses,block.lens)
      ||!text(block.scope_label,200)||!text(block.text,2400)
      ||typeof item.interpretation_text!=='string'||item.interpretation_text.length>900
      ||!Array.isArray(refs)||!refs.length||refs.length>48||new Set(refs).size!==refs.length)return null;
    const evidence=arr(report.evidence).concat(arr(report.experiential_evidence)),ids=new Set();
    for(const row of evidence){if(!row||typeof row.id!=='string'||!/^[FX][1-9]\d{0,3}$/.test(row.id)||ids.has(row.id))return null;ids.add(row.id);}
    if(refs.some(id=>!ids.has(id)))return null;
    // Extended references are only the closed campaign display graph. A result
    // kind or an unverified metadata flag cannot raise the ordinary limit.
    // Server authorization/compiler review remain separate from this check.
    if(refs.length>12){
      if(report.source_evidence||!report.campaign_answer_evidence)return null;
      const campaign=campaignEvidenceAttributions(report);
      if(!campaign.size)return null;
      for(const group of report.campaign_answer_evidence.groups){
        if(Object.values(group.measures).some(id=>refs.includes(id))
          &&!refs.includes(group.measures.answered_responses))return null;
      }
    }
    const selected=arr(report.experiential_evidence).filter(row=>refs.includes(row.id));
    if(selected.length!==1||!exact(selected[0],['id','role','lens','scope_label','text'])
      ||!/^X[1-9]\d{0,3}$/.test(selected[0].id)
      ||['role','lens','scope_label','text'].some(key=>block[key]!==selected[0][key]))return null;
    const context=roles[block.role]+' · '+lenses[block.lens];
    const saved='Participant account · '+context+'\nScope: '+block.scope_label+'\n“'+block.text+'”'
      +(item.interpretation_text?'\n\n'+item.interpretation_text:'');
    if(item.text!==saved)return null;
    return '<div class="mr-experience-evidence"><p class="mr-experience-label">Reported experience</p><p class="mr-reading-context">'+esc(context)+'</p><p class="mr-experience-scope">Scope: '+esc(block.scope_label)+'</p><blockquote>“'+esc(block.text)+'”</blockquote></div>'
      +(item.interpretation_text?'<p class="mr-experience-interpretation">'+esc(item.interpretation_text)+'</p>':'');
  }

  function buildAuthoredInterpretation(report) {
    const interpretation=obj(report.interpretation), sources=arr(report.sources).filter(source=>/^https:\/\//i.test(firstStr(source.url)));
    const evidence=arr(report.evidence).concat(arr(report.experiential_evidence));
    const attributions=sourceEvidenceAttributions(report);
    const attribution=fact=>attributions.has(fact.id)?'<span class="mr-evidence-attribution">'+esc(typeof attributions.get(fact.id)==='string'?attributions.get(fact.id):attributions.get(fact.id).context)+'</span>':'';
    const evidenceLabel=fact=>firstStr(obj(attributions.get(fact.id)).label,fact.label,fact.role?'Participant observation · '+humanize(fact.role):'Recorded response');
    const printEvidence=new Map();
    const evidenceText=fact=>typeof fact.value==='number'?(fact.unit==='USD'?'US$':'')+fact.value.toLocaleString('en-US')+(fact.unit==='hours'?' hours':''):firstStr(fact.text,typeof fact.value==='string'?fact.value:'',Array.isArray(fact.value)?fact.value.join('; '):'');
    const support=item=>{
      const facts=evidence.filter(f=>arr(item.evidence_ids).includes(f.id)),refs=sources.filter(s=>arr(item.source_ids).includes(s.id));
      if(!facts.length&&!refs.length)return '';
      const numbers=facts.map(f=>{if(!printEvidence.has(f.id))printEvidence.set(f.id,{number:printEvidence.size+1,fact:f});return printEvidence.get(f.id).number;});
      const printed='<p class="mr-print-support">'+(numbers.length?'Supporting evidence: '+numbers.join(', ')+'. See the evidence register.':'')+(refs.length?' Practice sources: '+refs.map(s=>sources.indexOf(s)+1).join(', ')+'. See Research and sector context.':'')+'</p>';
      return '<details class="mr-evidence-detail"><summary>See the supporting evidence</summary><div>'+facts.map(f=>'<div class="mr-evidence-entry">'+attribution(f)+'<strong>'+esc(evidenceLabel(f))+'</strong><p>'+esc(evidenceText(f))+'</p></div>').join('')+(refs.length?'<p class="mr-source-links">Relevant practice: '+refs.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(firstStr(s.title,s.publisher))+'</a>').join('; ')+'</p>':'')+'</div></details>'+printed;
    };
    const sourceBlock=item=>Object.hasOwn(item,'experiential_block')
      ?(Object.hasOwn(item,'evidence_block')?null:buildExperientialBlock(item,report))
      :buildPersonalQuestionBlock(item,report,attributions);
    // Only short visible print units stay together. Long accounts remain able
    // to span pages; hidden evidence detail never changes this length bound.
    const boundedPrint=text=>text.length<=1000&&text.split(/\r\n|\r|\n/).length<=8;
    const findings=(items,title,explanation,questionBlocks=false,compact=false)=>arr(items).length?'<div class="mr-evidence-reading'+(compact?' mr-reading-limitations':'')+'"><h3>'+title+'</h3>'+(explanation?'<p class="mr-reading-context">'+explanation+'</p>':'')+arr(items).map(item=>{
      const text=firstStr(obj(item).text,typeof item==='string'?item:''),supporting=support(obj(item));
      const printedSupport=(supporting.match(/<p class="mr-print-support">([\s\S]*?)<\/p>/)||[])[1]||'';
      return '<article class="mr-finding'+(boundedPrint(text+printedSupport)?' mr-finding-bounded':'')+'">'+((questionBlocks&&sourceBlock(obj(item)))||'<p>'+esc(text)+'</p>')+supporting+'</article>';
    }).join('')+'</div>':'';
    const conditionRows=[['Before trying it','prerequisite'],['Risk to consider','risk'],['How to judge the test','success_check']];
    const conditionList=rows=>'<dl class="mr-action-conditions'+(rows.length===1?' mr-action-conditions-single':rows.length===2?' mr-action-conditions-two':'')+'">'+rows.map(([label,value])=>'<div class="mr-ai-definition"><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
    const actionCard=(item,index,option=false,shared={})=>{
      const action=obj(item),labels={limited:'Limited change',moderate:'Moderate change',structural:'Structural change'};
      const bounded=[action.action,action.reason,action.prerequisite,action.risk,action.success_check].reduce((n,text)=>n+String(text||'').length,0)<=1400;
      const rows=conditionRows.filter(([,key])=>action[key]&&!Object.prototype.hasOwnProperty.call(shared,key)).map(([label,key])=>[label,action[key]]);
      // Options retain their original layout and independent conditions.
      const conditions=option?'<dl class="mr-action-conditions">'+rows.map(([label,value])=>'<div class="mr-ai-definition"><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>':conditionList(rows);
      return '<article class="mr-card mr-ai-action'+(bounded?' mr-ai-action-bounded':'')+'"><h3 class="mr-action-heading">'+(option?esc(labels[action.intensity]||'Action option'):'Next step '+(index+1))+'</h3><p class="mr-action-proposal">'+esc(action.action)+'</p><p>'+esc(action.reason)+'</p>'+support(action)+conditions+'</article>';
    };
    const actions=arr(interpretation.recommendations),options=arr(interpretation.action_options),preferred=obj(interpretation.recommended_option),preferredOption=options.find(o=>o.option_id===preferred.option_id);
    // Present a condition once only when it applies verbatim to every next
    // step. Do not normalize text, merge subsets, alter saved data, or share
    // success checks. Distinct or missing conditions stay with their action.
    const sharedConditions={};
    if(actions.length>=2)for(const key of ['prerequisite','risk']){
      const value=obj(actions[0])[key];
      if(typeof value==='string'&&value.trim()&&actions.every(action=>obj(action)[key]===value))sharedConditions[key]=value;
    }
    const sharedRows=conditionRows.filter(([,key])=>Object.prototype.hasOwnProperty.call(sharedConditions,key)).map(([label,key])=>[label,sharedConditions[key]]);
    const sharedBlock=sharedRows.length?'<aside class="mr-shared-action-conditions'+(boundedPrint(['For all next steps',...sharedRows.flat()].join('\n'))?' mr-shared-conditions-bounded':'')+'"><h4>For all next steps</h4>'+conditionList(sharedRows)+'</aside>':'';
    const preferredPath=()=>{
      // Evaluate support at its original reading position so the evidence
      // register keeps its existing numbering. Only printed text determines
      // whether this callout is short enough to keep together on one page.
      const supporting=support(preferred),boundary='This campaign met the evidence checks for a recommended path, with operating evidence and safeguards recorded by an authorized reviewer.';
      const printedSupport=(supporting.match(/<p class="mr-print-support">([\s\S]*?)<\/p>/)||[])[1]||'';
      const bounded=['Recommended path',preferredOption.action,preferred.reason,printedSupport,boundary].reduce((n,text)=>n+String(text||'').length,0)<=1100;
      return '<aside class="mr-recommended-path'+(bounded?' mr-recommended-path-bounded':'')+'"><p class="mr-action-level">Recommended path</p><h3>'+esc(preferredOption.action)+'</h3><p>'+esc(preferred.reason)+'</p>'+supporting+'<p class="mr-reading-context">'+boundary+'</p></aside>';
    };
    const research=obj(report.research_context),checked=firstStr(research.checked_at,research.checkedAt),date=checked&&Number.isFinite(Date.parse(checked))?new Date(checked).toISOString().slice(0,10):'';
    const researchText=['fresh','reviewed'].includes(research.status)?'Public-source research checked '+date+'. Sources inform the options; they do not establish how this organization performs.':research.status==='no_current_sources'?'A public-source search was completed on '+date+', but it did not produce suitable current evidence for this report.':research.status==='stale'?'The available research snapshot is dated '+date+'. It is outside the current research window and was not added as fresh guidance.':'No newly checked public-source research is included. Any listed practice sources are dated references, not a current sector benchmark.';
    const methodExplanation='Monderman’s diagnostic engine produces the scores and determines which findings and recommendations the evidence supports. AI contributes research and explanation within those rules. Automated checks and a separate AI review check the interpretation against its supporting evidence before publication.';
    const methodProvenance='Prepared '+String(report.generated_at??'')+'. Report version '+String(customerReportVersion(report.version)??'')+'. This report preserves the evidence and research used when it was prepared.';
    const boundedMethod=boundedPrint('How Monderman produced this interpretation\n'+methodExplanation+'\n'+methodProvenance);
    const sourcePrintText=s=>String(s.title??'')+(s.publisher?' · '+s.publisher:'')+(s.published?' · Published '+s.published:'')+(s.reviewed?' · Checked '+s.reviewed:'');
    const content='<section class="mr-section mr-ai-interpretation mr-authored-report"><h2>Interpretation and next steps</h2><p class="mr-executive-read">'+esc(interpretation.summary)+'</p>'+support({evidence_ids:obj(report.evidence_references).summary,source_ids:obj(report.evidence_references).summary_sources})+buildAIRecordedContext(report)+
      findings(interpretation.observations,'What the evidence shows','These findings distinguish scored results from what participants reported.',true)+
      findings(interpretation.hypotheses,'What may explain it','Possible explanations to investigate, not established causes.')+
      (actions.length?'<div class="mr-report-nextsteps"><div class="mr-action-intro"><h3>Practical next steps</h3><p class="mr-reading-context">Start with these practical checks or focused changes.</p></div>'+sharedBlock+actions.map((item,index)=>actionCard(item,index,false,sharedConditions)).join('')+'</div>':'')+
      (options.length?'<div class="mr-report-options"><div class="mr-action-intro"><h3>Three levels of change</h3><p class="mr-reading-context">These are alternatives, not a sequence or a presumption that a larger change is better. Check each option’s prerequisites and risks.</p></div>'+options.map((item,index)=>actionCard(item,index,true)).join('')+'</div>':'')+
      (preferredOption?preferredPath():options.length?'<p class="mr-not-yet"><strong>No preferred option is selected.</strong> Review operating evidence and the campaign’s remaining readiness checks before choosing a recommended path.</p>':'')+
      findings([...new Set(arr(report.limitations).concat(arr(interpretation.limitations)))],'What this report cannot establish','',false,true)+
      '<div class="mr-research-context"><h3>Research and sector context</h3><p>'+esc(researchText)+'</p>'+(obj(report.benchmark).explanation?'<p>'+esc(report.benchmark.explanation)+'</p>':'')+(sources.length?'<ol>'+sources.map(s=>'<li'+(boundedPrint(sourcePrintText(s))?' class="mr-research-source-bounded"':'')+'><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a>'+(s.publisher?' · '+esc(s.publisher):'')+(s.published?' · Published '+esc(s.published):'')+(s.reviewed?' · Checked '+esc(s.reviewed):'')+'</li>').join('')+'</ol>':'')+'</div>'+
      '<details class="mr-report-method'+(boundedMethod?' mr-report-method-bounded':'')+'"><summary>How Monderman produced this interpretation</summary><div><p>'+esc(methodExplanation)+'</p><p>'+esc(methodProvenance)+'</p></div></details></section>';
    const longEvidence=fact=>evidenceText(fact).length+evidenceLabel(fact).length>1200;
    const longRegister=Array.from(printEvidence.values()).some(({fact})=>longEvidence(fact));
    const boundedRegister=Array.from(printEvidence.values()).reduce((total,{fact})=>total+evidenceText(fact).length+evidenceLabel(fact).length+attribution(fact).length,0)<=1600;
    const register=printEvidence.size?'<div class="mr-print-evidence"><h3>Supporting evidence register</h3><p>Each item is listed once. Numbers beside findings and actions refer to these saved values or attributed observations.</p><dl'+(longRegister?' data-long-evidence="true"':'')+(boundedRegister?' data-bounded-evidence="true"':'')+'>'+Array.from(printEvidence.values()).map(({number,fact:f})=>'<div class="mr-evidence-entry"'+(longEvidence(f)?' data-long-evidence="true"':'')+'><dt>'+attribution(f)+'<strong>'+number+'. '+esc(evidenceLabel(f))+'</strong></dt><dd>'+esc(evidenceText(f))+'</dd></div>').join('')+'</dl></div>':'';
    return content.replace('<div class="mr-research-context">',register+'<div class="mr-research-context">');
  }

  // An existing authorized report read supplies refresh. No credentials,
  // endpoints, admissions or new diagnostic requests are invented here.
  function mountAIInterpretation(node, result, refresh) {
    if (!node || !obj(result.ai_report).status) return () => {};
    if (!document.getElementById('mr-style')) {
      const style=document.createElement('style');style.id='mr-style';style.textContent=REPORT_CSS+AI_CSS+REPORT_READING_CSS+SCREEN_CSS;document.head.appendChild(style);
    }
    const existing = node.querySelector('.mr-ai-inline') || node.querySelector('.mr-ai-interpretation');
    const section = document.createElement('div');
    section.className = 'mr-report mr-ai-inline';
    // Reuse the report's interpretation position instead of displaying a
    // second pending block above its cover on a recovered saved report.
    if (existing) {
      // Keep screen section links valid when a pending interpretation refreshes.
      if (existing.id) section.id = existing.id;
      existing.replaceWith(section);
    } else node.prepend(section);
    let stopped = false, timer = null, attempts = 0, inFlight = false;
    const paint = () => {
      section.innerHTML = buildAIInterpretation(result.ai_report);
      refreshScreenReportAI(section, result.ai_report);
    };
    paint();
    const stop = () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('pagehide', stop); };
    const pollDelay = () => {
      const ai=obj(result.ai_report),at=ai.status==='pending'&&typeof ai.deferUntil==='string' ? Date.parse(ai.deferUntil) : NaN;
      // A daily budget wait is not a failed report. Avoid exhausting the read
      // attempts before its next processing window; no new run is submitted.
      return Number.isFinite(at) ? Math.min(86700000,Math.max(15000,at-Date.now())) : 15000;
    };
    const resume = () => { if (!stopped && !document.hidden && !timer && !inFlight) timer = setTimeout(poll, pollDelay()); };
    const poll = async () => {
      timer = null;
      if (stopped || !section.isConnected) return stop();
      if (document.hidden) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const latest = await refresh();
        if (!latest || stopped || !section.isConnected) return stop();
        result.ai_report = latest.ai_report; paint();
        if (!['pending','processing'].includes(obj(result.ai_report).status)) return stop();
      } catch (_) { /* A temporary read failure must not strand a saved report. */ }
      finally { inFlight = false; }
      if (stopped || !section.isConnected) return stop();
      if (++attempts < 20) timer = setTimeout(poll, pollDelay()); else stop();
    };
    if (typeof refresh === 'function' && ['pending','processing'].includes(obj(result.ai_report).status)) {
      timer=setTimeout(poll,pollDelay());
      document.addEventListener('visibilitychange',resume);
    }
    window.addEventListener('pagehide',stop,{once:true});
    return stop;
  }

  // Publication provenance remains in the signed sample artifact and portable
  // model. The cover identifies the report as using example data. Do not add
  // a second explanatory sample card; genuine-run method sections are retained.
  function buildSampleProvenance(model) {
    return '';
  }

  function buildReportBody(model) {
    const m = obj(model);
    const coverBlock = buildReportCover(m);
    const compatibilityBlock = buildCompatibilityNotice(m);
    const aiBlock = buildAIInterpretation(m.aiReport);
    const sampleBlock = buildSampleProvenance(m);

    if (m.kind === "meta-synthesis") {
      return coverBlock + compatibilityBlock + renderFinancialDecisionBrief(m) + aiBlock + (m.selfRun?renderSelfRunReport(m):renderMetaSynthesis(m)) + sampleBlock + (m.selfRun?'':buildReportBoundary(m));
    }

    if (m.kind === "run") {
      const legacy = obj(m.financialLegacyView);
      const financialNotice = legacy.status === 'updated_interpretation_required'
        ? '<aside class="mr-compatibility-notice mr-financial-legacy-notice"><div class="mr-compatibility-mark"></div><div><p class="mr-compatibility-label">Earlier interpretation withheld</p><p>' + esc(firstStr(legacy.explanation,'The earlier interpretation requires an update under the current financial policy. Original stored data, scores and recorded answers are unchanged.')) + '</p></div></aside>'
        : '';
      return coverBlock + compatibilityBlock + financialNotice + aiBlock + renderRunReport(m) + sampleBlock;
    }

    const kvs = arr(m.kvs).map((x) => '<div class="k">' + esc(x.k) + "</div><div>" + esc(x.v) + "</div>").join("");
    let n = 0;
    const secHtml =
      '<section class="mr-section"><h2>1. Executive summary</h2><p class="mr-exec-lede">' + esc(m.execSummary) + "</p>" +
      '<div class="callout"><p><strong>Organizational implication.</strong> ' + esc(m.bottomLine) + "</p></div>" +
      (kvs ? '<div class="kvs">' + kvs + "</div>" : "") + '</section>' +
      arr(m.sections).map((s) => '<section class="mr-section">' + sectionHtml(s, (n += 1) + 1) + '</section>').join("") +
      '<section class="mr-section"><h2>' + (n + 2) + '. Conclusion and next step</h2><p>This Executive Report is a directional read of the measured condition. Use the reported evidence, limitations, and recommended first moves as the basis for a bounded operating decision and like-for-like remeasurement.</p></section>';

    return coverBlock + compatibilityBlock + secHtml + sampleBlock + buildReportBoundary(m);
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
    '.mr-compatibility-notice{display:grid;grid-template-columns:5px 1fr;gap:14px;align-items:start;margin:0 0 34px;padding:18px 20px;border:1px solid #D8C6A8;border-radius:12px;background:#FFF9EF;color:#5C4A2D}.mr-compatibility-mark{width:5px;min-height:100%;border-radius:4px;background:#C9821F}.mr-compatibility-label{font-size:.68rem!important;line-height:1.2!important;letter-spacing:.16em;text-transform:uppercase;color:#9B6117!important;font-weight:700;margin:1px 0 7px!important}.mr-compatibility-notice p:last-child{margin:0!important;font-size:.88rem!important;line-height:1.55!important;color:#5C4A2D!important}' +
    '.mr-report .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}' +
    '.mr-report .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:168px;padding:0 24px;border-radius:7px;font-family:inherit;font-size:15px;font-weight:500;white-space:nowrap;background:#FFF;color:#18191C;border:1px solid rgba(24,25,28,.12);box-shadow:none;cursor:pointer}' +
    '.mr-report .btn-accent{background:#0C6E78;color:#FFF;border-color:rgba(12,110,120,.18)}' +
    '@media print{.mr-report{background:#fff}.mr-report .mr-page{border:0;border-radius:0;box-shadow:none;max-width:none;padding:28px 32px}.mr-report .actions{display:none!important}}' +

    '.mr-contributing-score{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;font-size:2rem;font-weight:700;line-height:1.2;margin:8px 0}.mr-contributing-score.is-unavailable{font-size:18px;font-weight:600}.mr-contributing-score span{font-size:14px;font-weight:400;color:var(--soft)}.mr-contributing-meta{display:flex;flex-wrap:wrap;gap:4px 16px}.mr-contributing-meta span{white-space:nowrap}' +
    '.mr-ai-evidence-text,.mr-ai-reason{white-space:pre-line;overflow-wrap:anywhere}' +
    '.mr-run-decision-story.is-single{grid-template-columns:minmax(0,1fr)}' +
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
    .mr-cover-score.mr-cover-score-status{font-size:clamp(1.7rem,4.5vw,2.7rem);line-height:1.04;letter-spacing:-.035em;min-width:0;max-width:100%;overflow-wrap:anywhere}
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
    .mr-synth-compact{display:none}
    @media screen and (max-width:800px){
      .mr-depth-distribution-panel>.mr-synth-chart,.mr-system-panel>.mr-system-map,.mr-synth-wide-caption{display:none!important}
      .mr-synth-compact{display:block;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#18191C}
      .mr-synth-compact+.mr-copy{margin-top:16px!important}
      .mr-synth-stat-list{margin:0;display:grid;gap:0}
      .mr-synth-stat-list>div{display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid #EAE6DD}
      .mr-synth-stat-list dt{flex:1;min-width:0;font-size:14px;color:#6E6F73;overflow-wrap:anywhere}
      .mr-synth-stat-list dd{flex:0 0 auto;margin:0;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:#18191C;white-space:nowrap}
      .mr-synth-segment-list{display:grid;gap:12px;margin-top:18px}
      .mr-synth-segment{min-width:0;border:1px solid #EAE6DD;border-radius:9px;padding:14px}
      .mr-synth-segment>strong{display:block;font-size:16px;line-height:1.35;color:#08383E;overflow-wrap:anywhere}
      .mr-synth-segment>span{display:block;margin-top:5px;font-size:14px;color:#6E6F73}
      .mr-synth-segment .mr-synth-stat-list{margin-top:8px}
      .mr-synth-segment .mr-synth-stat-list>div:last-child{border-bottom:0;padding-bottom:0}
      .mr-system-compact-composite{padding:16px;border-left:3px solid #0C6E78;background:#F6F3EC;border-radius:9px}
      .mr-system-compact-composite>strong{display:block;font-size:14px;color:#08383E}
      .mr-system-compact-composite>span{display:block;margin-top:6px;font-size:24px;line-height:1.2;font-weight:700;color:#18191C}
    }
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
    .mr-range-iqr.is-point::after{content:"";position:absolute;left:50%;top:0;width:2px;height:12px;border-radius:2px;background:rgba(12,110,120,.72);transform:translateX(-50%)}
    .mr-range-iqr.is-point.is-left-edge::after{left:0;transform:none}.mr-range-iqr.is-point.is-right-edge::after{left:100%;transform:translateX(-100%)}
    .mr-range-median{position:absolute;top:-4px;width:3px;height:20px;border-radius:2px;background:#08383E;transform:translateX(-1.5px)}
    .mr-range-foot{margin-top:7px;font-size:.76rem;color:#6E6F73}
    @media(max-width:760px){.mr-map-lenses{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-map-signal{grid-template-columns:1fr}.mr-map-tools{justify-content:flex-start;max-width:none}.mr-system-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mr-system-metrics .mr-run-metric:nth-child(3){border-left:0}.mr-system-decision{grid-template-columns:1fr}.mr-system-decision>div+div{border-left:0;border-top:1px solid #E0DCD3}}
    @media(max-width:760px){.mr-cover-dark{padding:38px 28px 32px}.mr-cover-white{padding:28px}.mr-cover-title{font-size:2.35rem!important}.mr-cover-score{font-size:3.8rem}.mr-cover-score-copy{min-width:0;max-width:100%}.mr-cover-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
    .mr-evidence-group{display:contents}
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
    .mr-depth-stats>h3,.mr-depth-stat-interpretation>h3{font-size:1.1rem!important;margin:0 0 12px!important}
    .mr-depth-stats>.kvs,.mr-depth-stat-interpretation>.kvs{border-top:1px solid #EAE6DD;border-bottom:1px solid #EAE6DD;padding:14px 0;margin:0 0 18px}
    .mr-depth-stat-interpretation{display:contents}
    .mr-editorial-row{background:transparent!important;border:0!important;border-top:1px solid #EAE6DD!important;border-radius:0!important;padding:18px 0!important;margin:0!important}
    .mr-editorial-row:last-of-type{border-bottom:1px solid #EAE6DD!important}
    .mr-editorial-row h3{font-size:1.08rem!important;line-height:1.35;margin-bottom:7px!important}
    .mr-editorial-row p{max-width:68ch}
    .mr-editorial-row .mr-lens-label{color:#6E6F73}
    .mr-requirement-row .mr-pill{margin-bottom:2px}

    /* Single-Diagnostic product report: the same renderer powers Workspace and
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
    .mr-dimension-axis{display:grid;grid-template-columns:repeat(5,1fr);margin:25px 6px 4px 246px;color:#53676E;font-size:.75rem;font-variant-numeric:tabular-nums;text-align:center}.mr-dimension-axis span:first-child{text-align:left}.mr-dimension-axis span:last-child{text-align:right}
    .mr-dimension-profile{border-top:1px solid #EAE6DD}
    .mr-dimension-row{display:grid;grid-template-columns:226px minmax(0,1fr);gap:10px 20px;padding:17px 4px;border-bottom:1px solid #EAE6DD;align-items:center}
    .mr-dimension-copy{display:flex;align-items:baseline;justify-content:space-between;column-gap:12px;row-gap:2px;flex-wrap:wrap;min-width:0}.mr-dimension-copy strong{min-width:0;font-size:.9rem;line-height:1.35;overflow-wrap:anywhere}.mr-dimension-copy span{flex:0 0 auto;color:#0C6E78;font-weight:700;font-variant-numeric:tabular-nums}
    .mr-dimension-row:not(.is-unmeasured):not(.is-unavailable) .mr-dimension-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start}
    .mr-dimension-track{position:relative;height:10px;border-radius:999px;background:linear-gradient(90deg,#EEEAE2 0,#EEEAE2 25%,#E8E4DB 25%,#E8E4DB 50%,#E1DDD4 50%,#E1DDD4 75%,#DAD6CD 75%);overflow:visible}
    .mr-dimension-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#08383E,#0C6E78)}.mr-dimension-track i{position:absolute;top:-4px;width:2px;height:18px;background:#08383E;transform:translateX(-1px)}
    .mr-dimension-detail{grid-column:2;font-size:.8rem;color:#53676E;margin-top:-4px}.mr-dimension-detail b{float:right;color:#0C6E78;text-transform:uppercase;letter-spacing:.1em;font-size:.7rem}
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
    .mr-priority-point.mr-priority-label-left>div{left:auto;right:37px}
    .mr-priority-plot{margin-bottom:44px}
    .mr-run-actions{margin:0 0 28px;padding:22px 24px 20px;border-left:3px solid #0C6E78;background:#F7F5F0}.mr-run-actions ol{margin-top:13px!important;padding-left:22px!important}.mr-run-actions li{padding-left:5px}
    .mr-run-method dl{margin:20px 0;border-top:1px solid #DCD8CF}.mr-run-method dl>div{display:grid;grid-template-columns:190px minmax(0,1fr);gap:22px;padding:13px 0;border-bottom:1px solid #EAE6DD}.mr-run-method dt{font-size:.68rem;letter-spacing:.11em;text-transform:uppercase;color:#6E6F73}.mr-run-method dd{margin:0;font-size:.83rem;line-height:1.5;overflow-wrap:anywhere}.mr-method-copy{margin-top:22px!important;font-size:.9rem!important;color:#6E6F73!important;max-width:72ch}
    .mr-leadership-close{padding:32px!important;border:1px solid #0C6E78!important;border-radius:14px;background:linear-gradient(145deg,#F7FAF9,#FFF)!important}.mr-leadership-close>h2{font-size:clamp(1.8rem,3.4vw,2.8rem)!important;line-height:1.03!important;letter-spacing:-.04em!important;max-width:19ch!important}.mr-leadership-close-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;margin-top:24px}.mr-leadership-sequence ol{list-style:none;margin:14px 0 0!important;padding:0!important;counter-reset:handoff}.mr-leadership-sequence li{position:relative;padding:0 0 18px 39px;margin:0!important;counter-increment:handoff}.mr-leadership-sequence li:not(:last-child)::before{content:"";position:absolute;left:13px;top:25px;bottom:0;width:1px;background:#B8D1D3}.mr-leadership-sequence li::after{content:counter(handoff);position:absolute;left:0;top:0;display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#08383E;color:#FFF;font-size:.72rem;font-weight:700}.mr-leadership-sequence li strong{display:block;font-size:.9rem}.mr-leadership-sequence li span{display:block;margin-top:4px;color:#6E6F73;font-size:.8rem;line-height:1.5}.mr-ownership-questions>div:not(.mr-lens-label){display:grid;grid-template-columns:31px 1fr;gap:10px;padding:13px 0;border-bottom:1px solid #EAE6DD}.mr-ownership-questions>div>span{color:rgba(12,110,120,.3);font-size:1.25rem;font-weight:700}.mr-ownership-questions p{font-size:.85rem!important;line-height:1.5!important;margin:0!important}.mr-remeasurement-note{margin-top:22px;padding:17px 19px;border-left:3px solid #0C6E78;background:#F7F5F0}.mr-remeasurement-note p{font-size:.84rem!important;line-height:1.55!important;margin:6px 0 0!important}

    .mr-financial-scenario,.mr-financial-brief{min-width:0;overflow-wrap:anywhere}
    .mr-financial-brief .mr-financial-eyebrow{margin:0 0 8px;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#0C6E78;font-weight:700}
    .mr-financial-brief .mr-financial-scope{margin:10px 0 20px;font-size:.9rem;line-height:1.5;color:#53676E}
    .mr-financial-headlines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:22px 24px;border:1px solid #DCE5E8;border-top:3px solid #0C6E78;border-radius:8px;background:#F4F7F8}
    .mr-financial-headlines>div{min-width:0}.mr-financial-headlines span,.mr-financial-headlines small{display:block;font-size:.76rem;line-height:1.5;color:#53676E}
    .mr-financial-headlines strong{display:block;margin:8px 0 4px;font-size:clamp(1.5rem,2.8vw,2rem);line-height:1.15;letter-spacing:-.03em;color:#08383E;font-variant-numeric:tabular-nums}
    .mr-financial-brief .mr-financial-conclusion{font-size:.98rem;line-height:1.55;margin:18px 0 8px;font-weight:600}
    .mr-financial-brief .mr-financial-cash-note{margin:8px 0 20px;font-size:.86rem;line-height:1.5;color:#53676E}
    .mr-financial-comparison{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.8rem;line-height:1.4;font-variant-numeric:tabular-nums}
    .mr-financial-comparison caption{text-align:left;font-size:.94rem;font-weight:600;padding:0 0 12px;color:#08383E}
    .mr-financial-comparison th,.mr-financial-comparison td{padding:12px 10px;border-bottom:1px solid #DCE5E8;text-align:right;vertical-align:top;overflow-wrap:anywhere}
    .mr-financial-comparison tr>:first-child{width:38%;text-align:left;padding-left:0}
    .mr-financial-comparison thead th{color:#53676E;font-size:.74rem;font-weight:500;border-top:1px solid #DCE5E8}
    .mr-financial-comparison tbody th{font-weight:500}.mr-financial-comparison tbody td{font-weight:600;color:#08383E}
    .mr-financial-comparison tr>:nth-child(3){background:#F4F7F8}.mr-financial-comparison tbody tr:last-child{border-top:2px solid #0C6E78}
    .mr-financial-brief .mr-financial-pairing,.mr-financial-brief .mr-financial-detail-note,.mr-financial-brief .mr-financial-early{font-size:.76rem;line-height:1.5;color:#53676E;margin:14px 0 0}
    @media screen and (max-width:640px){
      .mr-financial-headlines{grid-template-columns:1fr;padding:18px;gap:18px}.mr-financial-headlines>div+div{border-top:1px solid #DCE5E8;padding-top:16px}
      .mr-financial-comparison{display:block;font-size:.82rem}.mr-financial-comparison caption{display:block}
      .mr-financial-comparison thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      .mr-financial-comparison tbody{display:block}.mr-financial-comparison tbody tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #DCE5E8;padding:12px 0}
      .mr-financial-comparison tbody tr>th:first-child{grid-column:1/-1;width:auto;padding:0 0 8px!important;border:0;text-align:left}
      .mr-financial-comparison tbody td{display:block;border:0;padding:8px 6px;text-align:left}
      .mr-financial-comparison tbody td::before{content:attr(data-case);display:block;font-size:.67rem;font-weight:400;color:#53676E;margin-bottom:4px}
    }
    @media print{
      .mr-report .mr-financial-brief{break-before:page;page-break-before:always;break-after:page;page-break-after:always;margin:0!important;padding:0!important;border:0!important}
      .mr-financial-brief h2{font-size:19pt!important;margin:0!important}.mr-financial-brief .mr-financial-eyebrow{font-size:8pt;margin-bottom:6px}
      .mr-financial-brief .mr-financial-scope{font-size:9pt;margin:8px 0 12px}
      .mr-financial-headlines{padding:14px 16px;gap:18px;break-inside:avoid;page-break-inside:avoid}
      .mr-financial-headlines strong{font-size:23pt}.mr-financial-headlines span,.mr-financial-headlines small{font-size:8pt}
      .mr-financial-brief .mr-financial-conclusion{font-size:10pt;line-height:1.4;margin:12px 0 6px}
      .mr-financial-brief .mr-financial-cash-note{font-size:9pt;line-height:1.4;margin:6px 0 12px}
      .mr-financial-comparison{font-size:8.5pt;line-height:1.35}.mr-financial-comparison caption{font-size:10pt;padding-bottom:8px}
      .mr-financial-comparison th,.mr-financial-comparison td{padding:8px 7px}.mr-financial-comparison thead th{font-size:8pt}
      .mr-financial-comparison tr{break-inside:avoid;page-break-inside:avoid}
      .mr-financial-brief .mr-financial-pairing,.mr-financial-brief .mr-financial-detail-note,.mr-financial-brief .mr-financial-early{font-size:8pt;line-height:1.4;margin:10px 0 0}
    }
    .mr-meta-method a,.mr-financial-scenario a{color:#0C6E78;text-decoration:underline;text-underline-offset:.16em}
    .mr-meta-method a:hover,.mr-financial-scenario a:hover{color:#08383E}
    .mr-meta-method a:focus-visible,.mr-financial-scenario a:focus-visible{outline:2px solid #0C6E78;outline-offset:3px}
    /* BEGIN OPERATIONAL SANKEY STYLES 20260919.1 */
    .mr-operational-sankey{margin:28px 0;padding:24px;border:1px solid #DCE5E8;border-radius:10px;background:#FFF;min-width:0;overflow-wrap:anywhere}
    .mr-sankey-figure-head h3{margin:0!important;font-size:1.15rem}.mr-sankey-figure-head p{font-size:.85rem!important;line-height:1.5!important;margin:10px 0 0!important;color:#53676E}
    .mr-sankey-graphic{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(70px,1fr) minmax(0,.65fr);align-items:stretch;column-gap:12px;min-width:0;margin:20px 0}
    .mr-sankey-sources{display:grid;grid-template-rows:repeat(var(--sankey-rows),1fr);height:var(--sankey-height);min-width:0}
    .mr-sankey-source{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:8px 0;font-size:.86rem;line-height:1.4}
    .mr-sankey-source-name{display:block;border-left:3px solid;padding-left:10px}.mr-sankey-source strong{padding-left:13px;margin-top:6px;font-size:1rem;color:#08383E;font-variant-numeric:tabular-nums}.mr-sankey-source small{font-size:.76rem;font-weight:400}
    .mr-sankey-graphic svg{display:block;width:100%;height:var(--sankey-height);overflow:visible}
    .mr-sankey-total{display:flex;flex-direction:column;justify-content:center;min-width:0;font-size:.82rem;line-height:1.4;color:#53676E}.mr-sankey-total strong{font-size:clamp(1.1rem,2.4vw,1.7rem);line-height:1.2;color:#08383E;margin:8px 0 4px;font-variant-numeric:tabular-nums}
    .mr-report .mr-sankey-capacity{font-size:.84rem;line-height:1.5;padding-top:16px;border-top:1px solid #DCE5E8}.mr-sankey-capacity strong{color:#08383E}
    .mr-operational-sankey figcaption,.mr-report .mr-sankey-scale-note{font-size:.76rem;line-height:1.5;color:#53676E;margin:12px 0 0}
    .mr-sankey-table{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:20px;font-size:.78rem;line-height:1.45;font-variant-numeric:tabular-nums}.mr-sankey-table caption{text-align:left;font-weight:600;padding:0 0 10px;color:#08383E}
    .mr-sankey-table th,.mr-sankey-table td{padding:10px 6px;border-bottom:1px solid #DCE5E8;text-align:right;vertical-align:top}.mr-sankey-table tr>:first-child{width:46%;text-align:left;padding-left:0}.mr-sankey-table thead th{font-weight:500;color:#53676E}.mr-sankey-table tbody th{font-weight:500}.mr-sankey-table tfoot{font-weight:600;color:#08383E}.mr-sankey-unavailable{margin:20px 0;padding:18px;border-left:3px solid #0C6E78;background:#F4F7F8}.mr-sankey-unavailable h3{margin:0 0 10px!important}.mr-sankey-unavailable p{margin:0!important}
    @media screen and (max-width:640px){.mr-operational-sankey{padding:16px}.mr-sankey-graphic{grid-template-columns:minmax(0,1.1fr) minmax(42px,.6fr) minmax(0,.7fr);gap:8px}.mr-sankey-source{font-size:.76rem;line-height:1.4}.mr-sankey-source-name{padding-left:6px}.mr-sankey-source strong{padding-left:9px;font-size:.84rem}.mr-sankey-total{font-size:.74rem}.mr-sankey-total strong{font-size:1.05rem}.mr-sankey-table{font-size:.72rem}.mr-sankey-table th,.mr-sankey-table td{padding:9px 4px}.mr-sankey-table tr>:first-child{width:40%}}
    @media print{.mr-operational-sankey{break-before:auto;page-break-before:auto;break-inside:auto;page-break-inside:auto;margin:0 0 20px;padding:16px}.mr-sankey-figure-head{break-after:avoid;page-break-after:avoid}.mr-sankey-graphic{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid;margin:12px 0}.mr-sankey-source{font-size:9pt}.mr-sankey-total{font-size:9pt}.mr-sankey-total strong{font-size:16pt}.mr-report .mr-sankey-capacity{font-size:9pt;line-height:1.4;margin:0 0 8px;break-after:avoid;page-break-after:avoid}.mr-operational-sankey figcaption{font-size:8pt;line-height:1.4;break-before:avoid;page-break-before:avoid}.mr-sankey-table{font-size:8pt}.mr-sankey-table thead{display:table-header-group}.mr-sankey-table tr{break-inside:avoid;page-break-inside:avoid}.mr-sankey-table th,.mr-sankey-table td{padding:7px 5px}.mr-report .mr-sankey-scale-note{font-size:8pt;line-height:1.4}}
    /* END OPERATIONAL SANKEY STYLES 20260919.1 */
    /* BEGIN PLANNING CASE SANKEY STYLES 20260919.2 */
    .mr-operational-sankey .mr-planning-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0;margin:20px 0 0;padding:0;border:0}
    .mr-planning-controls legend{font-size:.82rem;font-weight:600;color:#08383E;padding:0 0 10px}
    .mr-planning-choice{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .mr-planning-controls>label{display:flex;align-items:center;justify-content:center;min-height:44px;padding:10px 12px;border:1px solid #9ACBD0;border-radius:6px;font-size:.88rem;line-height:1.35;font-weight:600;color:#08383E;background:#FFF;cursor:pointer;box-sizing:border-box}
    .mr-planning-choice:checked+label{color:#FFF;background:#08383E;border-color:#08383E}.mr-planning-choice:focus-visible+label{outline:3px solid #0C6E78;outline-offset:3px}.mr-planning-controls>label:hover{border-color:#0C6E78}
    .mr-planning-panels{grid-column:1/-1;min-width:0}.mr-planning-panel{display:none;min-width:0;padding-top:14px}.mr-planning-choice-low:checked~.mr-planning-panels>.mr-planning-panel-low,.mr-planning-choice-central:checked~.mr-planning-panels>.mr-planning-panel-central,.mr-planning-choice-high:checked~.mr-planning-panels>.mr-planning-panel-high{display:block}
    .mr-planning-panel h4{font-size:1.02rem!important;margin:0 0 5px!important;color:#08383E}.mr-report .mr-planning-pairing{font-size:.8rem;line-height:1.45;margin:0;color:#53676E}
    .mr-planning-flow{display:grid;grid-template-columns:minmax(0,1fr) minmax(60px,1.2fr) minmax(0,1fr);gap:12px;align-items:stretch;margin:12px 0;min-width:0}.mr-planning-flow svg{display:block;width:100%;height:240px;overflow:visible}.mr-planning-nodes{display:grid;grid-template-rows:repeat(var(--planning-rows),1fr);height:240px;min-width:0}.mr-planning-node{display:flex;flex-direction:column;justify-content:center;min-width:0;font-size:.77rem;line-height:1.4}.mr-planning-node>span{display:block;border-left:3px solid var(--planning-color);padding-left:8px}.mr-planning-node strong{display:block;margin:6px 0 0;padding-left:11px;font-size:clamp(.84rem,1.8vw,1.2rem);line-height:1.25;color:#08383E;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .mr-report .mr-planning-outcome{font-size:.86rem;line-height:1.5;font-weight:600;margin:12px 0 8px}.mr-report .mr-planning-zero{font-size:.78rem;line-height:1.5;color:#53676E;margin:8px 0 12px}
    .mr-planning-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px;margin:18px 0 0;min-width:0;border-top:1px solid #DCE5E8;font-variant-numeric:tabular-nums}.mr-planning-metrics>div{display:flex;flex-direction:column;gap:5px;min-width:0;padding:10px 0;border-bottom:1px solid #DCE5E8}.mr-planning-metrics dt{font-size:.76rem;line-height:1.4;color:#53676E}.mr-planning-metrics dd{margin:0;font-size:1rem;line-height:1.3;font-weight:600;color:#08383E;overflow-wrap:anywhere}.mr-planning-metrics>div:last-child{grid-column:1/-1}.mr-planning-print-caption{display:none}
    @media screen and (max-width:640px){.mr-planning-flow{grid-template-columns:minmax(0,1fr) minmax(44px,.7fr) minmax(0,1fr);gap:6px}.mr-planning-node{font-size:.7rem}.mr-planning-node>span{padding-left:5px}.mr-planning-node strong{padding-left:8px;font-size:.86rem}.mr-planning-metrics{column-gap:12px}.mr-planning-metrics dt{font-size:.72rem}.mr-planning-controls>label{padding:10px 6px}}
    @media print{.mr-operational-sankey{break-before:page;page-break-before:always;margin:0;padding:0;border:0;border-radius:0}.mr-operational-sankey .mr-planning-controls{display:block;margin:12px 0 0}.mr-planning-controls>legend,.mr-planning-controls>.mr-planning-choice,.mr-planning-controls>label{display:none!important}.mr-operational-sankey .mr-planning-panel{display:block!important;padding-top:0;break-inside:avoid;page-break-inside:avoid}.mr-planning-panel+.mr-planning-panel{break-before:page;page-break-before:always}.mr-planning-panel h4{font-size:13pt!important}.mr-report .mr-planning-pairing{font-size:9pt}.mr-planning-flow{margin:12px 0}.mr-planning-flow svg,.mr-planning-nodes{height:200px}.mr-planning-node{font-size:9pt}.mr-planning-node strong{font-size:13pt}.mr-report .mr-planning-outcome{font-size:9pt;line-height:1.4;margin:10px 0 6px}.mr-report .mr-planning-zero{font-size:8pt;line-height:1.4;margin:6px 0}.mr-planning-metrics{margin-top:12px;column-gap:18px}.mr-planning-metrics>div{padding:7px 0}.mr-planning-metrics dt{font-size:8pt}.mr-planning-metrics dd{font-size:11pt}.mr-report .mr-planning-print-caption{display:block;font-size:8pt;line-height:1.4;color:#53676E;margin:12px 0 0}.mr-operational-sankey>figcaption{display:none}}
    /* END PLANNING CASE SANKEY STYLES 20260919.2 */
    /* BEGIN ACTIVITY COST SANKEY STYLES 20260919.3 */
    .mr-planning-flow-head{display:flex;justify-content:space-between;gap:16px;margin-top:18px;font-size:.72rem;font-weight:600;color:#53676E}.mr-planning-flow-head>span{max-width:44%}.mr-planning-flow-head>span:last-child{text-align:right}
    .mr-planning-flow{grid-template-columns:minmax(0,1.2fr) minmax(50px,1fr) minmax(0,1fr);margin-top:4px}.mr-planning-flow svg,.mr-planning-flow .mr-planning-nodes{height:var(--planning-height,280px)}
    .mr-planning-node{font-size:.74rem;line-height:1.2}.mr-planning-node>.mr-planning-node-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.mr-planning-node small{font-size:.66rem;line-height:1.2;color:#53676E;padding-left:11px;margin-top:3px}.mr-planning-node strong{font-size:1rem;line-height:1.2;margin-top:4px}
    .mr-planning-breakdown{margin-top:20px;border-top:1px solid #DCE5E8;padding-top:14px;min-width:0}.mr-planning-breakdown summary{cursor:pointer;font-size:.83rem;font-weight:600;color:#0C6E78;min-height:32px;line-height:1.4}.mr-planning-breakdown summary:focus-visible{outline:2px solid #0C6E78;outline-offset:4px}.mr-planning-breakdown-body>h4{font-size:1rem;margin:14px 0 8px}.mr-report .mr-planning-breakdown-body>p{font-size:.78rem;line-height:1.45;color:#53676E}.mr-planning-breakdown .mr-sankey-table th span,.mr-planning-breakdown .mr-sankey-table th small{display:block}.mr-planning-breakdown .mr-sankey-table th small{font-weight:400;font-size:.7rem;color:#53676E;margin-top:4px}.mr-planning-breakdown .mr-sankey-table td{overflow-wrap:anywhere}
    @media screen and (max-width:640px){.mr-planning-flow{grid-template-columns:minmax(0,1.1fr) minmax(36px,.6fr) minmax(0,1fr);gap:6px}.mr-planning-node{font-size:.68rem}.mr-planning-node small{font-size:.6rem;padding-left:8px}.mr-planning-node strong{font-size:.83rem}.mr-planning-flow-head{font-size:.66rem}.mr-planning-breakdown .mr-sankey-table{font-size:.7rem}}
    @media print{.mr-planning-flow-head{font-size:7pt;margin-top:10px}.mr-planning-flow{margin-top:2px}.mr-planning-flow svg,.mr-planning-flow .mr-planning-nodes{height:var(--planning-print-height,210px)}.mr-planning-node{font-size:8pt;line-height:1.15}.mr-planning-node>.mr-planning-node-name{-webkit-line-clamp:1}.mr-planning-node small{font-size:6.5pt;margin-top:2px}.mr-planning-node strong{font-size:10pt;margin-top:2px}.mr-planning-breakdown{display:block;break-before:page;page-break-before:always;break-inside:auto;page-break-inside:auto;border:0;margin:0;padding:0}.mr-planning-breakdown>summary{display:none!important}.mr-planning-breakdown::details-content{display:contents!important;content-visibility:visible!important}.mr-planning-breakdown:not([open])>.mr-planning-breakdown-body{display:block!important}.mr-planning-breakdown-body>h4{font-size:13pt;margin:0 0 8px}.mr-report .mr-planning-breakdown-body>p{font-size:8pt}.mr-planning-breakdown .mr-sankey-table{font-size:8pt}.mr-planning-breakdown .mr-sankey-table th small{font-size:7pt}.mr-planning-breakdown .mr-sankey-table tr{break-inside:avoid;page-break-inside:avoid}}
    .mr-planning-print-breakdown{display:none}
    @media print{.mr-planning-breakdown{display:none!important}.mr-planning-print-breakdown{display:block!important}}
    @media print{.mr-planning-flow.is-dense .mr-planning-nodes{grid-template-rows:repeat(var(--planning-rows),minmax(0,1fr))}.mr-planning-flow.is-dense .mr-planning-node{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:4px;row-gap:2px;align-content:center}.mr-planning-flow.is-dense .mr-planning-node-name{grid-column:1/-1}.mr-planning-flow.is-dense .mr-planning-node small{margin:0;white-space:nowrap}.mr-planning-flow.is-dense .mr-planning-node strong{margin:0;padding-left:0;text-align:right;white-space:nowrap}}
    /* END ACTIVITY COST SANKEY STYLES 20260919.3 */
    /* BEGIN SCREEN BREAKDOWN TABLE STYLES 20260919.4 */
    @media screen{.mr-planning-table-scroll{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;margin-top:20px}.mr-planning-table-scroll:focus-visible{outline:2px solid #0C6E78;outline-offset:2px}.mr-planning-table-scroll .mr-sankey-table{min-width:560px;table-layout:auto;margin-top:0}.mr-planning-table-scroll .mr-sankey-table td{white-space:nowrap;overflow-wrap:normal;word-break:normal}.mr-planning-scroll-hint{display:none}}
    @media screen and (max-width:640px){.mr-report .mr-planning-scroll-hint{display:block;font-size:.74rem;line-height:1.45;color:#53676E;margin:12px 0 0}}
    /* END SCREEN BREAKDOWN TABLE STYLES 20260919.4 */
    .mr-scenario-metric,.mr-scenario-assumption{margin:24px 0;padding:24px;border:1px solid #E0DCD3;border-radius:10px;background:#FAFAF8;min-width:0}
    .mr-scenario-metric h3,.mr-scenario-assumption h3{margin-top:0!important}
    .mr-scenario-assumption h4{margin:22px 0 10px;font-size:.94rem;line-height:1.4}
    .mr-scenario-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0 0;padding:16px 0 0;border-top:1px solid #E0DCD3}
    .mr-scenario-values>div,.mr-scenario-facts>div{min-width:0}
    .mr-scenario-values dt{font-size:.73rem;line-height:1.4;color:#6E6F73}
    .mr-scenario-values dd{margin:6px 0 0;font-size:1.32rem;line-height:1.25;letter-spacing:-.02em;font-weight:600;color:#08383E;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .mr-scenario-facts{margin:20px 0;border-top:1px solid #E0DCD3}
    .mr-scenario-facts>div{display:grid;grid-template-columns:minmax(140px,.8fr) minmax(0,1.2fr);gap:20px;padding:12px 0;border-bottom:1px solid #E0DCD3}
    .mr-scenario-facts dt{font-size:.8rem;line-height:1.5;color:#6E6F73}.mr-scenario-facts dd{margin:0;font-size:.9rem;line-height:1.5}
    @media(max-width:640px){.mr-scenario-metric,.mr-scenario-assumption{padding:18px;margin:20px 0}.mr-scenario-values{grid-template-columns:1fr;gap:0}.mr-scenario-values>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:14px;align-items:baseline;padding:10px 0}.mr-scenario-values>div+div{border-top:1px solid #E0DCD3}.mr-scenario-values dd{margin:0;text-align:right;font-size:1.16rem}.mr-scenario-facts>div{grid-template-columns:1fr;gap:5px}}
    @media print{.mr-scenario-metric{break-inside:avoid;page-break-inside:avoid;padding:16px;margin:16px 0}.mr-scenario-assumption{break-inside:auto;page-break-inside:auto;padding:16px;margin:16px 0}.mr-scenario-assumption h3,.mr-scenario-assumption h4{break-after:avoid;page-break-after:avoid}.mr-scenario-values{break-inside:avoid;page-break-inside:avoid}.mr-scenario-values dd{font-size:13pt}.mr-scenario-facts>div{break-inside:avoid;page-break-inside:avoid}}

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
    /* On phones, the adjacent lens list already carries every plotted value,
       including unavailable values. Keep the SVG comparison for wider screens
       and print without shrinking its labels below legibility. */
    @media screen and (max-width:600px){
      .mr-cross-lens-summary>.mr-cross-lens-comparison{display:none}
      .mr-cross-lens-summary>.mr-lens-grid>.mr-lens-card{min-width:0;overflow-wrap:anywhere}
      .mr-cross-lens-summary>.mr-lens-grid>.mr-lens-card>.mr-lens-label{font-size:14px;line-height:1.4}
      .mr-cross-lens-summary>.mr-lens-grid>.mr-lens-card>.mr-copy{font-size:14px;line-height:1.5}
    }
    @page{size:Letter;margin:60pt}
    @media print{
      .mr-system-map>.mr-system-hub{fill:#08383E}
      .mr-map-signal,.mr-interaction-grid>.mr-interaction-label,.mr-interaction-grid>.mr-interaction-cell{break-inside:avoid;page-break-inside:avoid}
      /* Keep a standard report cover on one Letter page and keep its
         interpretation notice intact. Screen typography is unchanged. */
      .mr-report .mr-cover{break-inside:avoid;page-break-inside:avoid}
      .mr-cover-dark{padding:28px 30px 24px}
      .mr-cover-white{padding:22px 30px 24px}
      .mr-cover-title{font-size:28pt!important;line-height:1.04!important}
      .mr-cover-sub,.mr-cover-body{font-size:10pt!important;line-height:1.45!important}
      .mr-cover-meta{margin-top:16px;padding-top:12px;gap:8px 12px}
      .mr-cover-body{margin-top:14px!important;padding-top:12px}
      .mr-cover-boundary{margin-top:14px;padding:10px 12px;break-inside:avoid;page-break-inside:avoid}
      .mr-system-metrics,.mr-system-decision,.mr-depth-metrics,.mr-depth-reading-grid,.mr-editorial-row,.mr-report .callout{break-inside:avoid;page-break-inside:avoid}
      .mr-section>h2{page-break-after:avoid}
      .mr-section>h2+p{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}
      .mr-section>ul>li,.mr-run-exposure,.mr-run-method,.mr-meta-method,.mr-requirements,.mr-depth-stats>.kvs,.mr-depth-stat-interpretation>.kvs{break-inside:avoid;page-break-inside:avoid}
      .mr-evidence-grid{display:block}
      .mr-evidence-group{display:block;break-inside:avoid;page-break-inside:avoid}
      .mr-evidence-group+.mr-evidence-group{margin-top:12px}
      .mr-evidence-grid .mr-lens-card{display:block;break-inside:avoid;page-break-inside:avoid}
      .mr-evidence-grid .mr-lens-card+.mr-lens-card{margin-top:12px}
      .mr-report p{orphans:3;widows:3}
      /* Keep these bounded reading units intact. Actual generated reports
         exposed sentence tails and card tags stranded across page breaks. */
      .mr-run-headline,.mr-lens-grid>.mr-lens-card{break-inside:avoid;page-break-inside:avoid}
      .mr-ai-interpretation ul>.mr-ai-evidence-text{break-inside:avoid;page-break-inside:avoid;orphans:3;widows:3}
      .mr-ai-reading-unit{display:inline-block;width:100%;vertical-align:top;break-inside:avoid;page-break-inside:avoid}
      /* Keep the bounded scenario introduction with its chart. A whole-section
         avoid can be relaxed by print layout; the paragraph also needs an
         explicit no-split and keep-with-next boundary. */
      .mr-run-exposure{display:inline-block;width:100%;vertical-align:top}
      .mr-run-exposure>.mr-lede{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
      .mr-run-leadership{display:inline-block;width:100%;vertical-align:top}
      .mr-run-actions{display:inline-block;width:100%;vertical-align:top;break-inside:avoid;page-break-inside:avoid}
      .mr-priority-intro{display:inline-block;width:100%;vertical-align:top;break-inside:avoid;page-break-inside:avoid}
      /* Use ordinary block flow for long evidence and option content so print
         pagination does not depend on nested grid fragmentation. */
      .mr-run-evidence-grid,.mr-remedy-grid,.mr-remedy-card{display:block}
      /* Each bounded option is one print unit. Verify the actual PDF with
         more than one rasterizer; low-resolution previews can omit glyphs. */
      .mr-run-remedy{position:static;display:inline-block;width:100%;vertical-align:top}
      .mr-run-evidence-grid>div+div{margin-top:18px}
      .mr-run-remedy p,.mr-run-remedy li{font-size:10pt!important;line-height:1.5!important}
      .mr-remedy-head,.mr-remedy-tradeoffs>div{break-inside:avoid;page-break-inside:avoid}
      .mr-run-metric-value{font-size:13pt;overflow-wrap:normal}
      .mr-section h2,.mr-section h3,.mr-section-index,.mr-run-method dl>div{break-inside:avoid;page-break-inside:avoid}
      .mr-leadership-close{break-inside:avoid;page-break-inside:avoid;padding:24px!important}
      /* One atomic print unit: Linux Chromium otherwise fragments the final
         grid paragraph even when sibling keep-together rules are present. */
      .mr-run-close-group{display:inline-block;width:100%;vertical-align:top;break-inside:avoid;page-break-inside:avoid}
      .mr-run-close-group>.mr-leadership-close{margin-top:0!important;padding:14px 24px!important}
      .mr-leadership-close>h2{font-size:22pt!important;line-height:1.12!important;max-width:none!important}
      .mr-leadership-close p,.mr-leadership-close li,.mr-leadership-close li span{font-size:10pt!important;line-height:1.45!important}
      .mr-leadership-close{break-after:avoid;page-break-after:avoid}
      .mr-leadership-close+.mr-report-boundary{break-before:avoid;page-break-before:avoid}
      .mr-leadership-close-grid{grid-template-columns:1.05fr .95fr;gap:22px}
      .mr-leadership-sequence li{padding-bottom:12px}
      .mr-run-close-group .mr-leadership-sequence li{padding-bottom:8px}
      .mr-remeasurement-note{margin-top:16px;padding:12px 14px}
      .mr-report .mr-report-boundary{margin-top:16px;padding:12px 16px}
      .mr-report-boundary p:last-child{font-size:10pt!important;line-height:1.45!important}
      /* A completed AI report ends at Method and limits. Keep its explanatory
         paragraph with the boundary, instead of a nearly empty final page. */
      .mr-run-method:has(+.mr-report-boundary){break-inside:auto;page-break-inside:auto;break-after:avoid;page-break-after:avoid}
      .mr-run-method-bounded:has(+.mr-report-boundary){break-inside:avoid;page-break-inside:avoid}
      .mr-run-method:has(+.mr-report-boundary)>.mr-method-copy:last-child{break-after:avoid;page-break-after:avoid}
      .mr-run-method+.mr-report-boundary{break-before:avoid;page-break-before:avoid}
      .mr-run-method dl{margin:14px 0}
      .mr-run-method dl>div{padding:8px 0;gap:14px}
      .mr-run-method .mr-method-copy{margin-top:14px!important;font-size:10pt!important;line-height:1.45!important}
      /* Public-sample references are an appendix, not a second report. Keep
         every reference readable without orphaning one digest on a new page. */
      .mr-report .mr-sample-provenance{break-inside:avoid;page-break-inside:avoid}
      .mr-report .mr-sample-provenance>p{font-size:10pt!important;line-height:1.45!important}
      .mr-sample-provenance dl{margin:10px 0}
      .mr-sample-provenance dl>div{grid-template-columns:140px minmax(0,1fr);padding:6px 0;gap:14px}
      .mr-sample-provenance dt{font-size:9pt;line-height:1.35}
      .mr-sample-provenance dd{font-size:10pt;line-height:1.4}
      .mr-priority-matrix,.mr-constraint-view,.mr-run-findings{break-inside:avoid;page-break-inside:avoid}
      .mr-leadership-grid>div,.mr-leadership-sequence li{break-inside:avoid;page-break-inside:avoid}
      .mr-section h3,.mr-lens-label,.mr-viz-title{break-after:avoid;page-break-after:avoid}
      html,body{background:#FFF!important;margin:0!important}.mr-report .mr-page{padding:0!important}.mr-cover{break-after:page}.mr-compatibility-notice{break-inside:avoid}.mr-section{break-before:auto}.mr-section h2,.mr-section-index{break-after:avoid}.mr-run-metric,.mr-dimension-row,.mr-exposure-step,.mr-remedy-card,.mr-priority-row,.mr-evidence-quote,.mr-viz-panel{break-inside:avoid}.mr-run-metrics,.mr-exposure-flow,.mr-evidence-summary{break-inside:avoid}.mr-remedy-grid{grid-template-columns:1fr;gap:12px;break-inside:auto}.mr-remedy-card{overflow:visible}.mr-run-decision-story{break-inside:avoid}.mr-report-boundary{break-inside:avoid}.mr-report .mr-section+.mr-section{margin-top:34px;padding-top:28px}
      .mr-run-decision,.mr-run-evidence,.mr-dimension-opening,.mr-dimension-chart,.mr-executive-synthesis,.mr-cross-lens-summary>.mr-lens-grid{break-inside:avoid;page-break-inside:avoid}
      .mr-depth-stat-interpretation{display:block;break-inside:avoid;page-break-inside:avoid}
      .mr-executive-synthesis>p:has(+.callout){break-after:avoid;page-break-after:avoid}
      .mr-executive-synthesis>.callout:last-child{break-before:avoid;page-break-before:avoid}
      .mr-interaction-panel{break-inside:auto;page-break-inside:auto}
      .mr-interaction-panel{padding:18px!important}
      .mr-interaction-grid{grid-template-columns:minmax(190px,1.4fr) repeat(var(--lens-count),minmax(72px,.55fr));margin:14px 0}
      .mr-interaction-head{padding:8px 4px}
      .mr-interaction-label{padding:10px 12px}
      .mr-interaction-grid,.mr-compounding-read{break-inside:avoid;page-break-inside:avoid}
      .mr-compounding-read{break-after:avoid;page-break-after:avoid}
      .mr-interaction-panel>.mr-copy:last-child{break-before:avoid;page-break-before:avoid}
      .mr-cross-lens-map{padding:18px!important;margin:14px 0;break-inside:auto;page-break-inside:auto}
      .mr-cross-lens-map .mr-map-pattern{padding:12px 16px}
      .mr-cross-lens-map .mr-map-signal{padding:10px 14px}
      .mr-cross-lens-map .mr-map-signals{break-inside:avoid;page-break-inside:avoid}
    }
    `;

  const AI_CSS = '.mr-ai-interpretation{min-width:0;overflow-wrap:anywhere}.mr-ai-interpretation a{color:var(--accent,#0C6E78);text-decoration:underline;text-underline-offset:.16em}.mr-ai-inline{padding:24px;max-width:100%;box-sizing:border-box}.mr-ai-action{margin:20px 0;padding:24px;break-inside:avoid}.mr-ai-action dd{margin:4px 0 16px}.mr-ai-interpretation h3{margin-top:24px}.mr-ai-interpretation li+li{margin-top:12px}@media(max-width:600px){.mr-ai-inline,.mr-ai-action{padding:18px}.mr-ai-interpretation h2{font-size:1.45rem}.mr-ai-interpretation h3{font-size:1.12rem}}@media print{.mr-ai-interpretation .mr-ai-action{margin:12px 0;padding:16px;break-inside:auto;page-break-inside:auto}.mr-ai-interpretation .mr-ai-action-bounded,.mr-ai-interpretation .mr-ai-list-bounded,.mr-ai-interpretation .mr-ai-sources-bounded{break-inside:avoid;page-break-inside:avoid}.mr-ai-action h3{break-after:avoid;page-break-after:avoid}.mr-ai-action p{orphans:3;widows:3}.mr-ai-action .mr-ai-definition{break-inside:avoid;page-break-inside:avoid}.mr-ai-action dt{break-after:avoid;page-break-after:avoid}.mr-ai-action dd{margin-bottom:10px;break-before:avoid;page-break-before:avoid}.mr-ai-action>dl:has(+p),.mr-ai-action>dl:has(+p)>.mr-ai-definition:last-child{break-after:avoid;page-break-after:avoid}.mr-ai-action>p:last-child{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}.mr-ai-list>h3,.mr-ai-sources>h3{break-after:avoid;page-break-after:avoid}.mr-ai-sources li{break-inside:avoid;page-break-inside:avoid}.mr-ai-interpretation>.mr-method-copy:last-child{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}}';

  const REPORT_READING_CSS = `
    .mr-sample-disclosure{font-size:.8rem!important;line-height:1.5!important;color:#53676E;margin:0 0 18px!important;max-width:90ch}
    .mr-report-nextsteps,.mr-report-options{scroll-margin-top:145px}
    .mr-authored-report{max-width:100%;min-width:0}
    .mr-authored-report .mr-executive-read{font-size:1.18rem;line-height:1.65;max-width:74ch;margin:0 0 28px}
    .mr-authored-report .mr-evidence-reading,.mr-authored-report .mr-report-nextsteps,.mr-authored-report .mr-report-options,.mr-authored-report .mr-research-context{margin-top:36px;padding-top:28px;border-top:1px solid #DCE5E8}
    .mr-authored-report h3{font-size:1.2rem;line-height:1.35;margin:0 0 12px}
    .mr-authored-report .mr-reading-context{font-size:.9rem;color:#53676E;line-height:1.55;max-width:78ch}
    .mr-authored-report .mr-finding{padding:18px 0;border-bottom:1px solid #E8EEEF}
    .mr-authored-report .mr-finding>p{margin:0;line-height:1.65;max-width:82ch}
    .mr-question-evidence{padding:16px 20px;border-left:3px solid #BFD7DB;background:#F3F7F7;overflow-wrap:anywhere}
    .mr-authored-report .mr-question-label{margin:0 0 8px;font-size:.82rem;font-weight:600;color:#53676E;line-height:1.4}
    .mr-authored-report .mr-question-text{margin:0 0 8px;font-weight:600;line-height:1.5}
    .mr-question-evidence .mr-reading-context{margin:0 0 16px}
    .mr-question-evidence dl{margin:0;display:grid;gap:14px}
    .mr-question-answer dt{font-size:.86rem;font-weight:600;line-height:1.4;color:#183F47}
    .mr-question-answer dd{margin:4px 0 0;line-height:1.55}
    .mr-authored-report .mr-finding>.mr-question-interpretation{margin-top:18px}
    .mr-question-subset{margin:0 0 12px;font-size:.88rem;font-weight:600}
    .mr-experience-evidence{padding:16px 20px;border-left:3px solid #BFD7DB;background:#F3F7F7;overflow-wrap:anywhere}
    .mr-authored-report .mr-experience-label{margin:0 0 8px;font-size:.82rem;font-weight:600;color:#53676E;line-height:1.4}
    .mr-experience-evidence .mr-reading-context{margin:0 0 4px}
    .mr-experience-scope{margin:0 0 14px;font-size:.9rem;line-height:1.55;color:#53676E}
    .mr-experience-evidence blockquote{margin:0;padding:0;border:0;font-style:normal;line-height:1.65;white-space:pre-wrap}
    .mr-authored-report .mr-finding>.mr-experience-interpretation{margin-top:18px}
    .mr-evidence-detail{margin-top:14px;font-size:.88rem;line-height:1.55}
    .mr-authored-report .mr-action-heading{margin-top:0;font-size:1rem;color:#176f79}
    .mr-authored-report .mr-action-proposal{font-weight:600;line-height:1.5}
    .mr-print-support,.mr-print-evidence{display:none}
    .mr-evidence-detail>summary,.mr-report-method>summary{cursor:pointer;padding:8px 0;font-weight:600;color:#176F79}
    .mr-evidence-detail>div{padding:14px 18px;border-left:3px solid #BFD7DB;background:#F3F7F7}
    .mr-evidence-entry+.mr-evidence-entry{border-top:1px solid #DCE5E8;margin-top:12px;padding-top:12px}
    .mr-evidence-entry p{margin:5px 0!important;line-height:1.55!important}
    .mr-evidence-attribution{display:block;margin:0 0 6px;color:#53676E;font-size:.88rem;line-height:1.5;overflow-wrap:anywhere}
    .mr-authored-report .mr-action-level{font-size:.78rem;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;color:#53676E;font-weight:600;margin-bottom:12px}
    .mr-authored-report .mr-ai-action{padding:24px;margin:18px 0;border:1px solid #DCE5E8;border-radius:8px;background:#fff}
    .mr-action-conditions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:20px 0 0;padding-top:20px;border-top:1px solid #DCE5E8}
    .mr-action-conditions-two{grid-template-columns:repeat(2,minmax(0,1fr))}
    .mr-action-conditions-single{grid-template-columns:1fr}
    .mr-action-conditions dt{font-size:.86rem;font-weight:600;line-height:1.4;color:#183F47}
    .mr-action-conditions dd{margin:8px 0 0!important;font-size:.88rem;line-height:1.6;color:#405D65}
    .mr-shared-action-conditions{margin:18px 0;padding:18px 20px;background:#F3F7F7;border-left:3px solid #BFD7DB;overflow-wrap:anywhere}
    .mr-shared-action-conditions h4{margin:0;font-size:.95rem;line-height:1.5;font-weight:600;color:#183F47}
    .mr-shared-action-conditions>.mr-action-conditions{margin-top:12px;padding-top:0;border-top:0}
    .mr-recommended-path{background:#EDF5F4;border-left:4px solid #287260;padding:24px;margin-top:24px}
    .mr-not-yet{padding:18px 20px;background:#F7F5EF;border-left:3px solid #AD7B29;line-height:1.6}
    .mr-report-method{margin:28px 0 0;padding:18px 0;border-top:1px solid #DCE5E8;font-size:.85rem;line-height:1.6}
    .mr-research-context li{padding-left:4px;margin:12px 0;line-height:1.6}
    .mr-authored-report a:focus-visible,.mr-authored-report summary:focus-visible{outline:3px solid #278E98;outline-offset:3px}
    @media(max-width:800px){.mr-action-conditions{grid-template-columns:1fr;gap:16px}.mr-authored-report .mr-executive-read{font-size:1.04rem}.mr-authored-report .mr-ai-action{padding:20px}}
    @media(max-width:440px){.mr-authored-report .mr-ai-action,.mr-recommended-path{padding:16px}.mr-authored-report h3{font-size:1.08rem}.mr-evidence-detail>div{padding:12px}.mr-authored-report .mr-evidence-reading,.mr-authored-report .mr-report-nextsteps,.mr-authored-report .mr-report-options{margin-top:28px;padding-top:24px}}
    @media print{
      .mr-authored-report .mr-evidence-detail{display:none!important}
      .mr-print-support,.mr-print-evidence{display:block}
      .mr-print-support{font-size:9pt!important;line-height:1.4!important;color:#52666a;margin:10px 0!important}
      .mr-print-evidence{margin-top:24px;padding-top:18px;border-top:1px solid #dce5e8}
      .mr-print-evidence dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
      .mr-print-evidence>h3,.mr-print-evidence>p{break-after:avoid;page-break-after:avoid}
      .mr-print-evidence>p,.mr-print-evidence:has(>dl[data-bounded-evidence="true"]){break-inside:avoid;page-break-inside:avoid}
      .mr-print-evidence dl{break-before:avoid;page-break-before:avoid}
      .mr-print-evidence dl[data-long-evidence="true"]{display:block}
      .mr-print-evidence .mr-evidence-entry[data-long-evidence="true"]{break-inside:auto;page-break-inside:auto}
      .mr-print-evidence .mr-evidence-entry{margin:0;padding:10px 0 0;border-top:1px solid #DCE5E8}
      .mr-print-evidence dd{margin:5px 0 12px;white-space:pre-wrap}
      .mr-meta-method:has(+.mr-report-boundary){break-after:avoid;page-break-after:avoid}
      .mr-meta-method+.mr-report-boundary{break-before:avoid;page-break-before:avoid}
      .mr-authored-report .mr-executive-read{font-size:11pt;line-height:1.55}
      .mr-authored-report .mr-evidence-reading,.mr-authored-report .mr-report-nextsteps,.mr-authored-report .mr-report-options,.mr-authored-report .mr-research-context{margin-top:22px;padding-top:18px}
      .mr-authored-report .mr-finding,.mr-authored-report .mr-ai-action{break-inside:auto;page-break-inside:auto}
      .mr-authored-report .mr-finding-bounded,.mr-authored-report .mr-report-method-bounded{break-inside:avoid;page-break-inside:avoid}
      .mr-authored-report .mr-evidence-reading>h3,.mr-authored-report .mr-evidence-reading>.mr-reading-context{break-after:avoid;page-break-after:avoid}
      .mr-authored-report p:has(+.mr-evidence-detail+.mr-print-support){break-after:avoid;page-break-after:avoid}
      .mr-authored-report .mr-print-support{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}
      .mr-question-evidence{padding:12px 16px;break-inside:auto;page-break-inside:auto}
      .mr-question-evidence .mr-question-label,.mr-question-evidence .mr-question-text,.mr-question-evidence .mr-reading-context,.mr-question-answer dt{break-after:avoid;page-break-after:avoid}
      .mr-question-answer-bounded{break-inside:avoid;page-break-inside:avoid}
      .mr-experience-evidence{padding:12px 16px;break-inside:auto;page-break-inside:auto}
      .mr-experience-label,.mr-experience-evidence .mr-reading-context,.mr-experience-scope{break-after:avoid;page-break-after:avoid}
      .mr-experience-evidence blockquote{orphans:3;widows:3}
      .mr-authored-report .mr-ai-action-bounded{break-inside:avoid;page-break-inside:avoid}
      .mr-authored-report .mr-action-intro{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}
      .mr-authored-report .mr-finding>p,.mr-authored-report .mr-ai-action>p{orphans:3;widows:3}
      .mr-authored-report .mr-action-conditions{grid-template-columns:1fr;gap:10px;margin-top:14px;padding-top:14px}
      .mr-shared-action-conditions{display:block!important;break-inside:auto;page-break-inside:auto}
      .mr-authored-report .mr-shared-conditions-bounded,.mr-authored-report .mr-research-source-bounded{break-inside:avoid;page-break-inside:avoid}
      .mr-authored-report .mr-reading-limitations{break-inside:auto;page-break-inside:auto}
      .mr-authored-report .mr-reading-limitations>.mr-finding{padding:6px 0}
      .mr-shared-action-conditions h4,.mr-shared-action-conditions dt{break-after:avoid;page-break-after:avoid}
      .mr-shared-action-conditions .mr-ai-definition{break-inside:avoid;page-break-inside:avoid}
      .mr-evidence-detail::details-content,.mr-report-method::details-content{display:block;content-visibility:visible}
      .mr-evidence-detail>div,.mr-report-method>div{display:block!important;content-visibility:visible!important}
      .mr-evidence-detail summary,.mr-report-method summary{list-style:none;break-after:avoid}
      .mr-evidence-entry{break-inside:avoid;page-break-inside:avoid}
      .mr-recommended-path{break-inside:auto;page-break-inside:auto}
      .mr-recommended-path-bounded{break-inside:avoid;page-break-inside:avoid}
    }`;

  function handleScreenNavigation(event) {
    const link = event.target.closest('.mr-screen-only a[href^="#"]');
    if (!link) return;
    const report = link.closest('.mr-page');
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!report || !target || !report.contains(target)) return;
    // Do not trigger the host page's tab/history router for report sections.
    event.preventDefault();
    const contents = link.closest('details');
    if (contents) contents.open = false;
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll:true });
  }

  const screenReportModels = new WeakMap();

  function buildScreenReportControls(model, sections) {
    const m = obj(model);
    const ai = obj(m.aiReport);
    const recommendations = renderedAIRecommendations(ai);
    const interpretationOnly = ai.status === "complete" && !recommendations.length && !arr(obj(obj(ai.report).interpretation).action_options).length;
    const find = (pattern) => sections.find(section => pattern.test(section.classes + " " + section.label));
    const profile = find(/mr-run-dimensions|mr-system-read|mr-depth-system-read/);
    const decisionBrief = find(/mr-financial-brief/);
    const evidence = find(/mr-run-evidence|mr-evidence-status/);
    const actions = obj(m.aiReport).status === "complete" ? (find(/mr-report-options/) || find(/mr-report-nextsteps/) || find(/mr-ai-interpretation/)) : find(/mr-run-action-board|Evidence-proportionate actions|Conclusion and next step/);
    const method = find(/mr-run-method|mr-meta-method|Method and limits/);
    const shortcuts = [{ section: sections[0], label: "Overview" },
      { section: decisionBrief, label: "Decision brief", role: "financial-summary" },
      { section: profile, label: m.product === "depth" ? "Distribution" : m.product === "cross_lens" ? "Compare lenses" : "Dimensions" },
      { section: evidence, label: "Evidence" }, { section: actions, label: interpretationOnly ? "Interpretation" : "Actions", role: "guidance" }, { section: method, label: "Method & limits" }].filter(item => item.section);
    const link = (section, label, css, role) => '<a' + (css ? ' class="' + css + '"' : '') + (role ? ' data-report-link-role="' + role + '"' : '') + ' href="#' + section.id + '">' + label + '</a>';
    const nav = '<nav class="mr-screen-only mr-screen-nav" aria-label="Explore this result"><div class="mr-screen-shortcuts">' + shortcuts.map(item => link(item.section, item.label, "", item.role)).join("") + '</div>' +
      '<details class="mr-screen-contents"><summary>All sections <span aria-hidden="true">⌄</span></summary><div>' + sections.map(section => link(section, section.label)).join("") + '</div></details></nav>';
    const firstAction = ai.status === "complete"
      ? firstStr(obj(recommendations[0]).action)
      // Deterministic firstMove can be an action-card category, not an action.
      // Keep the full guidance below instead of presenting its title as a task.
      : "";
    const nextMove = actions ? '<div class="mr-screen-only mr-screen-next"><div><span>Next step</span>' +
      (firstAction ? '<p>' + esc(firstAction) + '</p>' : interpretationOnly ? '<p>Review the interpretation and its limits.</p>' : '<p>Review the suggested changes and their evidence before choosing a test.</p>') + '</div>' + link(actions, (interpretationOnly ? 'Review interpretation' : 'Explore actions') + ' <span aria-hidden="true">→</span>', 'mr-screen-action', 'guidance') + '</div>' : '';
    return { nav, nextMove };
  }

  function refreshScreenReportAI(section, aiReport) {
    const page = section.closest('.mr-page');
    const context = page && screenReportModels.get(page);
    if (!context) return;
    // Preserve caller-owned models and every existing non-AI report node.
    // Read mounted IDs rather than rebuilding indexes: completed reports may
    // omit deterministic sections that remain in a pending report's live DOM.
    context.model = { ...context.model, aiReport: obj(aiReport) };
    const sections = Array.from(page.querySelectorAll('.mr-cover[id], .mr-section[id], .mr-ai-inline[id]'))
      .filter(node => node.closest('.mr-page') === page)
      .map(node => ({
        id: node.id,
        classes: node.classList.contains('mr-ai-inline') ? 'mr-section mr-ai-interpretation' : node.className,
        label: node.classList.contains('mr-cover') ? 'Overview' : esc((node.querySelector('h2')?.textContent || 'Report section').replace(/^\d+\.\s*/, ''))
      }));
    section.querySelectorAll('.mr-report-nextsteps,.mr-report-options').forEach((node,index)=>{
      node.id=section.id+'-guidance-'+index;
      sections.push({id:node.id,classes:node.className,label:esc(node.querySelector('h3')?.textContent||'Actions')});
    });
    const controls = buildScreenReportControls(context.model, sections);
    const update = (selector, html, parent, prepend = false) => {
      const current = page.querySelector(selector);
      if (!html) { current?.remove(); return; }
      const template = document.createElement('template');
      template.innerHTML = html;
      const replacement = template.content.firstElementChild;
      const oldContents = current?.querySelector('details');
      const newContents = replacement.querySelector('details');
      if (oldContents && newContents) newContents.open = oldContents.open;
      // A routine pending poll must not close contents or discard focus.
      if (current?.isEqualNode(replacement)) return;
      const focused = current?.contains(document.activeElement) ? document.activeElement : null;
      const focusLabel = focused?.textContent;
      const focusRole = focused?.getAttribute('data-report-link-role');
      const focusHref = focused?.getAttribute('href');
      if (current) current.replaceWith(replacement);
      else if (parent) parent[prepend ? 'prepend' : 'append'](replacement);
      if (focused) {
        const candidates = Array.from(replacement.querySelectorAll('a, summary'));
        // A completed factual-only report renames Actions to Interpretation.
        // Preserve the focused guidance control even if its label/target changes.
        const target = (focusRole && candidates.find(node => node.getAttribute('data-report-link-role') === focusRole)) ||
          candidates.find(node => node.textContent === focusLabel) ||
          (focusHref && candidates.find(node => node.getAttribute('href') === focusHref));
        target?.focus({ preventScroll: true });
      }
    };
    update('.mr-screen-nav', controls.nav, page, true);
    update('.mr-screen-next', controls.nextMove, page.querySelector('.mr-cover-white'));
  }

  // Screen navigation is a presentation of the existing report body. It never
  // changes the measurement model or the content/order used by printing.
  function buildScreenReportBody(model, instance) {
    const m = obj(model);
    const prefix = "mr-" + slug(m.filenameBase || m.product || "result") + (instance ? "-" + instance : "");
    const sections = [];
    const original = buildReportBody(m);
    let body = original.replace(/<section\b([^>]*?)\bclass="([^"]+)"([^>]*)>/g, (tag, beforeClass, classes, afterClass, offset) => {
      if (!/(?:^|\s)(?:mr-cover|mr-section)(?:\s|$)/.test(classes)) return tag;
      const id = prefix + "-section-" + sections.length;
      const next = original.indexOf('<section', offset + tag.length);
      const segment = original.slice(offset, next < 0 ? undefined : next);
      const heading = segment.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      const label = classes === "mr-cover" ? "Overview" : heading ? heading[1].replace(/<[^>]+>/g, "").replace(/^\d+\.\s*/, "") : "Report section";
      sections.push({ id, classes, label });
      // Preserve aria-live and any other section attributes in every state.
      return tag.replace(/\s+id="[^"]*"/, '').replace(/^<section\b/, '<section id="' + id + '"');
    });
    let guidanceIndex=0;
    const guidanceSections=[];
    body=body.replace(/<div class="(mr-report-nextsteps|mr-report-options)">/g,(tag,classes)=>{
      const id=prefix+'-guidance-'+guidanceIndex++;
      guidanceSections.push({id,classes,label:classes==='mr-report-options'?'Three levels of change':'Practical next steps'});
      return '<div id="'+id+'" class="'+classes+'">';
    });
    const interpretationIndex=sections.findIndex(s=>s.classes.includes('mr-ai-interpretation'));
    if(interpretationIndex>=0)sections.splice(interpretationIndex+1,0,...guidanceSections);
    const { nav, nextMove } = buildScreenReportControls(m, sections);
    const boundary = m.kind === "run" && m.footnote ? '<div class="mr-screen-only mr-screen-boundary"><strong>' + esc(firstStr(m.evidenceBand, "Single-run evidence")) + '</strong><p>' + esc(m.footnote) + '</p></div>' : '';
    // Insert alongside the score; the existing full interpretation boundary,
    // method, provenance, and next-decision sections remain in the body.
    const coverClose = '</div></section>';
    // The first section is the cover. An exact suffix match keeps insertion
    // safe if a future cover template changes its closing structure.
    const coverEnd = body.indexOf('</section>');
    const cover = coverEnd < 0 ? '' : body.slice(0, coverEnd + '</section>'.length);
    if (cover.endsWith(coverClose)) body = cover.slice(0, -coverClose.length) + boundary + nextMove + coverClose + body.slice(cover.length);
    // SVG definition IDs share the same per-mount namespace as the sections.
    body = body.replace(/id="mr-system-gradient"/g, 'id="' + prefix + '-system-gradient"').replace(/url\(#mr-system-gradient\)/g, 'url(#' + prefix + '-system-gradient)');
    // Native case radios and their labels must remain independent when the
    // same saved report, or all six samples, are mounted in one document.
    body = body.replace(/\b(id|for|name|aria-labelledby)="mr-planning-([^"]+)"/g, (_, attribute, suffix) => attribute + '="' + prefix + '-planning-' + suffix + '"');
    return nav + body;
  }

  const SCREEN_CSS = `
    @media screen {
      .mr-report{--accent:#087F8C;--line:#DCE5E8;--page:#F4F7F8;--soft:#53676E;background:#F4F7F8}
      .mr-report .mr-page{padding:24px 32px 48px;border-color:#DCE5E8;border-radius:14px;box-shadow:none}
      .mr-screen-nav{position:sticky;top:0;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-1px 0 24px;padding:8px 0;background:#fff;border-bottom:1px solid #DCE5E8;font-size:.8rem}
      .mr-screen-shortcuts{display:flex;flex-wrap:wrap;align-items:center;gap:2px}
      .mr-screen-nav a{display:block;padding:9px 11px;border-radius:6px;color:#405D65;text-decoration:none;line-height:1.35;font-weight:500}
      .mr-screen-nav a:hover{background:#EAF4F5;color:#065E68}
      .mr-screen-nav a:focus-visible,.mr-screen-nav summary:focus-visible,.mr-screen-action:focus-visible{outline:3px solid #087F8C;outline-offset:3px}
      .mr-screen-shortcuts>a:focus{color:#065E68;background:#EAF4F5}
      .mr-screen-contents{position:relative;flex-shrink:0}
      .mr-screen-contents summary{display:flex;align-items:center;gap:14px;padding:9px 12px;list-style:none;cursor:pointer;color:#405D65;border:1px solid #DCE5E8;border-radius:6px}
      .mr-screen-contents summary::-webkit-details-marker{display:none}
      .mr-screen-contents[open] summary{background:#EAF4F5;border-color:#87BDC3}
      .mr-screen-contents>div{position:absolute;right:0;top:calc(100% + 8px);width:min(330px,80vw);max-height:60vh;overflow:auto;background:#fff;border:1px solid #DCE5E8;border-radius:10px;box-shadow:0 12px 40px rgba(4,24,27,.14);padding:8px}
      .mr-report .mr-cover{margin-bottom:28px;border-radius:12px;border-color:#DCE5E8;background:#fff}
      .mr-report .mr-cover-dark{padding:23px 26px 20px;background:#07343A}
      .mr-report .mr-cover-mark{margin:0 0 9px!important;font-size:.62rem!important;letter-spacing:.14em;color:#A6D6D8!important}
      .mr-report .mr-cover-rule{display:none}
      .mr-report .mr-cover-title{margin:0!important;max-width:none;font-size:clamp(1.55rem,2.7vw,2rem)!important;line-height:1.12!important;letter-spacing:-.03em!important}
      .mr-report .mr-cover-sub{max-width:90ch;font-size:.86rem!important;line-height:1.5!important;margin-top:10px!important;color:#CEE1E3!important}
      .mr-report .mr-cover-stripe{height:2px;background:#15949F}
      .mr-report .mr-cover-white{padding:22px 26px 24px}
      .mr-report .mr-cover-kicker{margin-bottom:12px!important;font-size:.61rem!important;letter-spacing:.12em}
      .mr-report .mr-cover-score:not(.mr-cover-score-status){font-size:3.6rem;line-height:.95;letter-spacing:-.055em;color:#07343A}
      .mr-report .mr-cover-score-label{color:#087F8C;letter-spacing:.08em;font-size:.7rem}
      .mr-report .mr-cover-meta{margin-top:17px;padding-top:13px;gap:10px 14px;border-color:#DCE5E8}
      .mr-report .mr-cover-meta strong{color:#62777E;letter-spacing:.08em}
      .mr-report .mr-cover-body{font-size:.98rem!important;line-height:1.55!important;margin-top:17px!important;padding-top:16px;border-color:#DCE5E8;max-width:85ch}
      .mr-report .mr-cover-boundary{background:#F4F7F8;margin-top:16px;padding:12px 14px;border-color:#087F8C}
      .mr-report .mr-screen-boundary{background:#F4F7F8;border-left:3px solid #087F8C;border-radius:0 6px 6px 0;padding:12px 14px;margin-top:16px;color:#53676E}
      .mr-report .mr-screen-boundary strong{display:block;font-size:.72rem;color:#176772;margin-bottom:5px}
      .mr-report .mr-screen-boundary p{margin:0;font-size:.8rem;line-height:1.5}
      .mr-screen-next{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:17px;padding-top:17px;border-top:1px solid #DCE5E8}
      .mr-screen-next>div{min-width:0}
      .mr-screen-next>div>span{font-size:.68rem;font-weight:700;color:#087F8C}
      .mr-report .mr-screen-next p{font-size:.86rem;line-height:1.45;margin:5px 0 0}
      .mr-report .mr-screen-action{display:flex;align-items:center;justify-content:center;gap:10px;padding:11px 14px;flex-shrink:0;background:#087F8C;border:1px solid #087F8C;border-radius:7px;color:#fff;font-size:.8rem;font-weight:600;text-decoration:none;min-height:44px}
      .mr-report .mr-screen-action:hover{background:#066C78}
      .mr-report .mr-section,.mr-report .mr-ai-inline{scroll-margin-top:145px}
      .mr-report .mr-cover{scroll-margin-top:145px}
      .mr-report .mr-section>h2,.mr-report .mr-run-headline h2{margin-top:0!important;font-size:1.35rem!important;line-height:1.22!important;letter-spacing:-.025em!important;max-width:none!important}
      .mr-report .mr-section+.mr-section{margin-top:32px;padding-top:28px;border-color:#DCE5E8}
      .mr-report .mr-exec-lede,.mr-report .mr-lede{font-size:.94rem!important;line-height:1.6!important}
      .mr-report .mr-section-index{letter-spacing:.08em;font-size:.66rem}
      .mr-report .mr-run-metrics,.mr-report .mr-evidence-summary{border-color:#DCE5E8;background:#F4F7F8;border-radius:9px}
      .mr-report .mr-run-metric{padding:16px}
      /* Categories use a cool palette; warning and score-band colors are retained. */
      .mr-report .mr-run-metric[data-tone="amber"],.mr-report .mr-decision-metric:nth-child(2),.mr-report .mr-action-step[data-tier="behavioral"]{border-top-color:#5E7F98}
      .mr-report .mr-action[data-tier="behavioral"],.mr-report .mr-indicator-tile[data-lens="sc"]{border-left-color:#5E7F98}
      .mr-report .mr-action[data-tier="behavioral"] .mr-action-num{color:#4F708A}
      .mr-report .mr-run-metric-value{font-size:1.25rem;line-height:1.2}
      .mr-report .mr-lens-label{letter-spacing:.08em;color:#526D75}
      .mr-report .mr-viz-panel,.mr-report .mr-constraint-view{border-color:#DCE5E8;border-radius:9px;background:#FAFCFC}
      .mr-report .mr-dimension-track{background:#E5ECEF}
      .mr-report .mr-dimension-track>span{background:#087F8C}
      .mr-report .mr-dimension-row.is-primary{background:#EAF4F5;border-color:#A3CFD2}
      .mr-report .mr-run-decision-story{border-color:#DCE5E8;background:#fff}
      .mr-report .mr-run-headline{gap:24px}
      .mr-report .mr-run-score-stamp{padding:16px;border:1px solid #DCE5E8;border-bottom:3px solid #087F8C;background:#F4F7F8;border-radius:10px;justify-items:start}
      .mr-report .mr-run-score-stamp strong{color:#07343A;font-size:2.7rem}
      .mr-report .mr-leadership-close{padding:24px!important;border-color:#9ACBD0!important;background:#F2F8F8!important}
      .mr-report .mr-leadership-close>h2{font-size:1.45rem!important;max-width:none!important}
      .mr-report .mr-report-boundary,.mr-report .mr-run-method,.mr-report .mr-meta-method{background:#F4F7F8;border-color:#DCE5E8}
      .mr-report .mr-section.mr-run-method,.mr-report .mr-section.mr-meta-method{padding:24px;border:1px solid #DCE5E8;border-radius:10px}
      .mr-report .mr-remeasurement-note,.mr-report .mr-remedy-tradeoffs>div,.mr-report .mr-run-findings,.mr-report .mr-run-actions,.mr-report .mr-priority-matrix,.mr-report .mr-evidence-boundary,.mr-report .mr-map-pattern,.mr-report .mr-compounding-read,.mr-report .callout{background:#F4F7F8;border-color:#DCE5E8;border-left-color:#087F8C}
      .mr-report .mr-run-decision-story>div:first-child,.mr-report .mr-system-decision>div+div,.mr-report .mr-depth-reading-grid>div+div,.mr-report .mr-decision-story>div+div,.mr-report .mr-interaction-head{background:#F4F7F8}
      @media(max-width:760px){
        .mr-report .mr-page{padding:16px 18px 32px}
        .mr-screen-nav{align-items:flex-start;gap:5px;margin-bottom:16px;font-size:.73rem}
        .mr-screen-nav a{padding:9px 8px}
        .mr-screen-contents summary{padding:8px;gap:6px}
        .mr-report .mr-cover-dark,.mr-report .mr-cover-white{padding:20px}
        .mr-report .mr-cover-score:not(.mr-cover-score-status){font-size:3rem}
        .mr-report .mr-cover-score-copy{min-width:0}
        .mr-report .mr-cover-meta{grid-template-columns:repeat(2,minmax(0,1fr))}
        .mr-report .mr-section.mr-run-method,.mr-report .mr-section.mr-meta-method{padding:18px}
        .mr-report .mr-run-headline{gap:16px}
        .mr-screen-next{flex-direction:column;align-items:stretch;gap:12px}
        .mr-report .mr-screen-action{width:fit-content}
      }
      @media(max-width:480px){
        .mr-screen-nav{flex-direction:column;align-items:stretch;position:relative;top:auto}
        .mr-screen-shortcuts{justify-content:space-between}
        .mr-screen-contents{align-self:flex-start}
        .mr-screen-contents>div{left:0;right:auto}
        .mr-report .mr-cover-dark,.mr-report .mr-cover-white{padding:18px}
        .mr-report .mr-page{padding:12px}
      }
    }
    @media print{.mr-screen-only{display:none!important}}
  `;

  function buildReportHtml(model) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />' +
      '<meta name="monderman-renderer-version" content="' + RENDERER_VERSION + '" />' +
      (financialScenarioPresentation(obj(model))?'<meta name="monderman-financial-presentation-version" content="'+FINANCIAL_PRESENTATION_VERSION+'" />':'') +
      (threeBenefitPresentation(obj(model))?'<meta name="monderman-three-benefit-presentation-version" content="three-benefit-presentation-20260919.1" />':'') +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />' +
      "<title>Monderman | Executive Report</title><style>" + REPORT_CSS + AI_CSS + REPORT_READING_CSS + SCREEN_CSS + "</style></head><body>" +
      '<div class="mr-report"><div class="mr-page">' + buildScreenReportBody(model) +
      '<div class="actions"><button class="btn btn-accent" onclick="window.print()">Save / Print PDF</button>' +
      '<button class="btn" onclick="window.close()">Close report</button></div>' +
      "</div></div><script>document.addEventListener('click'," + handleScreenNavigation.toString() + ");</script></body></html>";
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
      reportWindow.document.body.innerHTML = '<main style="font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:12vh auto;padding:2rem;color:#17333a"><p style="letter-spacing:.14em;text-transform:uppercase;font-size:.75rem">Monderman.</p><h1 style="font-size:1.6rem">Preparing report…</h1><p>The saved result is loading securely.</p></main>';
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

  // Public metadata aliases retain the original edition number. Provider/model
  // and usage identifiers stay in the private audit, not customer downloads.
  function customerReportVersion(value) {
    return typeof value === 'string' ? value.replace(/^[a-z]+\d+-(?:engine-bounded-)?report-/, 'monderman-interpretation-')
      .replace(/^report-interpretation-[a-z]+\d+-/, 'monderman-interpretation-prompt-') : value;
  }
  function customerReportJson(value) {
    const copy = JSON.parse(safeStringify(value));
    const state = ai => {
      if (!ai || typeof ai !== 'object') return;
      if (Object.prototype.hasOwnProperty.call(ai, 'version')) ai.version = customerReportVersion(ai.version);
      const report = ai.report;
      if (!report || typeof report !== 'object') return;
      delete report.model; delete report.provider; delete report.usage;
      for (const key of ['version', 'prompt_version']) if (Object.prototype.hasOwnProperty.call(report, key)) report[key] = customerReportVersion(report[key]);
      if (report.automated_review) report.automated_review = {verdict: report.automated_review.verdict};
      report.customer_metadata_version = 'customer-report-metadata-20260915.1';
    };
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      for (const key of ['ai_report', 'aiReport']) if (Object.prototype.hasOwnProperty.call(node, key)) state(node[key]);
      for (const key of ['result', 'run', 'result_json', 'full_result_json', 'render_payload', 'renderPayload', 'report_payload', 'export_payload', 'runs', 'syntheses']) if (Object.prototype.hasOwnProperty.call(node, key)) visit(node[key]);
    };
    visit(copy); return copy;
  }

  function safeStringify(o) {
    const seen = new WeakSet();
    return JSON.stringify(o, function (k, v) {
      if (v && typeof v === "object") { if (seen.has(v)) return undefined; seen.add(v); }
      return v;
    }, 2);
  }

  function downloadJson(rawResult, filenameBase) {
    const data = (rawResult && rawResult.export_payload) ? rawResult.export_payload : rawResult;
    const blob = new Blob([safeStringify(customerReportJson(data))], { type: "application/json;charset=utf-8" });
    triggerDownload(blob, "monderman-" + slug(filenameBase || "result") + ".json");
  }

  let renderedReportCount = 0;
  function render(el, model) {
    const node = typeof el === "string" ? document.getElementById(el) : el;
    if (!node) return;
    node.removeEventListener("click", handleScreenNavigation);
    node.addEventListener("click", handleScreenNavigation);
    if (!document.getElementById("mr-style")) {
      const st = document.createElement("style");
      st.id = "mr-style"; st.textContent = REPORT_CSS + AI_CSS + REPORT_READING_CSS + SCREEN_CSS;
      document.head.appendChild(st);
    }
    node.innerHTML = '<div class="mr-report"><div class="mr-page" style="box-shadow:none;margin:0;max-width:none">' + buildScreenReportBody(model, ++renderedReportCount) + "</div></div>";
    screenReportModels.set(node.querySelector('.mr-page'), { model: { ...obj(model) } });
  }

  window.MondermanReport = {
    rendererVersion: RENDERER_VERSION,
    financialPresentationVersion: FINANCIAL_PRESENTATION_VERSION,
    fromRun: fromRun,
    fromSynthesis: fromSynthesis,
    buildReportBody: buildReportBody,
    buildReportHtml: buildReportHtml,
    createArtifact: createArtifact,
    render: render,
    buildAIInterpretation: buildAIInterpretation,
    customerReportJson: customerReportJson,
    mountAIInterpretation: mountAIInterpretation,
    reserveReportWindow: reserveReportWindow,
    closeReservedReportWindow: closeReservedReportWindow,
    openReport: openReport,
    downloadHtml: downloadHtml,
    downloadPdf: downloadPdf,
    downloadJson: downloadJson
  };
})();
