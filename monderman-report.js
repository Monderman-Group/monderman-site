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
     • MondermanReport.fromSynthesis(synthResult) — a cross-diagnostic synthesis result (the /cross-diagnostic-synthesis payload)

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
      if (s != null && String(s).trim()) return String(s).trim();
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

  // ---- adapter: cross-diagnostic synthesis result --> model -----------------
  function fromSynthesis(result) {
    const r = obj(result);
    const sources = arr(r.source_results);
    const tools = sources.map((s) => s.tool_label || s.tool_type).filter(Boolean);
    const exp = obj(r.compounded_exposure);
    const nar = obj(r.narrative);
    const diag = obj(r.diagnosis);
    const brief = obj(r.executive_briefing);
    const experiential = obj(r.experiential);
    const confidence = obj(r.confidence);

    // Range formatter: pass an array [low, high] or a single number
    const numRange = (a, unit) => {
      if (Array.isArray(a) && a.length === 2 && a[0] != null && a[1] != null) {
        return num(a[0]) + " – " + num(a[1]) + (unit ? " " + unit : "");
      }
      return num(a) + (unit ? " " + unit : "");
    };
    const curRange = (a) => {
      if (Array.isArray(a) && a.length === 2 && a[0] != null && a[1] != null) {
        return cur(a[0]) + " – " + cur(a[1]);
      }
      return cur(a);
    };
    // Compact currency: 11_000_000 → "$11M", 12_500_000 → "$12.5M"
    const compactCur = (v) => {
      if (v == null) return "—";
      const n = Number(v);
      if (n >= 1e9) return "$" + (Math.round(n / 1e8) / 10) + "B";
      if (n >= 1e6) return "$" + (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
      if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
      return "$" + n;
    };
    const compactCurRange = (a) => {
      if (Array.isArray(a) && a.length === 2 && a[0] != null && a[1] != null) {
        const l = compactCur(a[0]).replace("$", "");
        const hi = compactCur(a[1]).replace("$", "");
        return "$" + l + "–" + hi;
      }
      return compactCur(a);
    };
    // Compact number: 110000 → "~110k", 291000 → "~291k"
    const compactNum = (v) => {
      if (v == null) return "—";
      const n = Number(v);
      if (n >= 1e6) return "~" + (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
      if (n >= 1e3) return "~" + Math.round(n / 1e3) + "k";
      return "~" + n;
    };
    const weekRange = (a) => {
      if (Array.isArray(a) && a.length === 2) {
        if (a[1] == null) return String(a[0]) + "w+";
        return String(a[0]) + "–" + String(a[1]) + "w";
      }
      return num(a) + "w";
    };

    // Legacy exposure fallback: if compensation_cost_low/_high missing, use annual_cost
    const compCostLow = exp.compensation_cost_low != null ? exp.compensation_cost_low : exp.annual_cost;
    const compCostHigh = exp.compensation_cost_high != null ? exp.compensation_cost_high : exp.annual_cost;

    return {
      kind: "synthesis",
      mastline: "Monderman • Cross-Diagnostic Synthesis",
      title: "Cross-Diagnostic Synthesis Executive Report",
      subtitle: "A combined leadership read across Monderman diagnostics — surfacing the primary shared pattern, contradictions, first-move action sequence, and what leadership should watch.",
      meta: [
        { label: "Generated", value: nowLabel() },
        { label: "Source tools", value: tools.join(", ") || "Selected diagnostics" },
        { label: "Reads combined", value: String(sources.length || "—") }
      ],
      headlineScore: r.cross_diagnostic_score != null ? r.cross_diagnostic_score : "—",
      headlineBand: firstStr(r.condition_band, "—"),
      coverBody: firstStr(nar.executive_summary),

      // ─── Diagnosis section (NEW) ───
      diagnosis: diag.name ? {
        name: firstStr(diag.name),
        type: firstStr(diag.type),
        body: firstStr(diag.body),
        meta: [
          { label: "Composite", value: String(r.cross_diagnostic_score != null ? r.cross_diagnostic_score + " / 100" : "—") },
          { label: "Compensation cost", value: (compCostLow != null && compCostHigh != null ? compactCurRange([compCostLow, compCostHigh]) + " / yr*" : "—") },
          { label: "Envelope drag", value: (exp.capacity_drag_percent != null ? pct(exp.capacity_drag_percent) + "*" : "—") },
          { label: "Correction horizon", value: (exp.correction_horizon_weeks ? weekRange(exp.correction_horizon_weeks) : "—") }
        ]
      } : null,

      // ─── Executive briefing (NEW) ───
      briefing: brief.lede || (arr(brief.paragraphs).length > 0) ? {
        lede: firstStr(brief.lede),
        paragraphs: arr(brief.paragraphs).filter(Boolean).map(String)
      } : null,

      // ─── Composite section (existing enriched) ───
      composite: {
        score: r.cross_diagnostic_score,
        band: firstStr(r.condition_band),
        primaryPattern: firstStr(r.primary_pattern),
        totalBurdenHours: exp.total_burden_hours,
        compensationHours: exp.compensation_hours != null ? exp.compensation_hours : exp.annual_hours,
        totalLaborLow: exp.total_labor_exposure_low,
        totalLaborHigh: exp.total_labor_exposure_high,
        compCostLow: compCostLow,
        compCostHigh: compCostHigh,
        capacityDrag: exp.capacity_drag_percent
      },

      // ─── Lenses (four instruments) ───
      lenses: sources.map((s) => ({
        toolType: s.tool_type,
        toolLabel: s.tool_label || s.tool_type,
        score: s.score,
        band: s.band || s.condition_band,
        primaryDriver: firstStr(s.primary_driver, s.driver, "")
      })),

      // ─── Convergence signals (enriched — object shape with tools + dimensions) ───
      convergenceSignals: arr(r.convergence_signals).map((sig) => {
        if (typeof sig === "string") return { text: sig, label: "", tools: [], dimensions: [] };
        const s = obj(sig);
        return {
          text: firstStr(s.text),
          label: firstStr(s.label),
          tools: arr(s.tools),
          dimensions: arr(s.dimensions)
        };
      }),

      // ─── Contradictions ───
      contradictions: arr(r.contradictions).map((c) => (typeof c === "string" ? { text: c } : obj(c))),

      // ─── Priority actions (enriched — object shape with tier + horizon) ───
      priorityActions: arr(r.priority_actions).map((a) => {
        if (typeof a === "string") return { text: a, label: "", tier: "", horizonWeeks: null };
        const p = obj(a);
        return {
          text: firstStr(p.text),
          label: firstStr(p.label),
          tier: firstStr(p.tier).toLowerCase(),
          horizonWeeks: p.horizon_weeks || null
        };
      }),

      // ─── Experiential (NEW) ───
      experiential: (experiential.operational_staff || experiential.managers || experiential.senior_leaders) ? {
        operationalStaff: firstStr(experiential.operational_staff),
        managers: firstStr(experiential.managers),
        seniorLeaders: firstStr(experiential.senior_leaders)
      } : null,

      // ─── Leading indicators (NEW) ───
      leadingIndicators: arr(r.leading_indicators).map((i) => {
        const ind = obj(i);
        return {
          lens: firstStr(ind.lens).toLowerCase() || "cross",
          lensLabel: firstStr(ind.lens_label),
          name: firstStr(ind.name),
          watchFor: firstStr(ind.watch_for),
          description: firstStr(ind.description),
          current: firstStr(ind.current)
        };
      }),

      // ─── Leadership implication + sequencing (existing narrative) ───
      leadership: {
        implication: firstStr(nar.leadership_implication, r.primary_pattern, ""),
        sequencingLogic: firstStr(nar.sequenced_action_logic, "")
      },

      // ─── Confidence tiers (NEW) ───
      confidence: (confidence.convergence_signals || confidence.contradictions || confidence.composite_exposure_math) ? {
        convergenceSignals: arr(confidence.convergence_signals),
        contradictions: arr(confidence.contradictions),
        compositeExposureMath: firstStr(confidence.composite_exposure_math),
        cascadeUpstreamDriver: firstStr(confidence.cascade_upstream_driver),
        sequencingHorizonEstimates: firstStr(confidence.sequencing_horizon_estimates)
      } : null,

      footnote: "* Time, cost, and capacity figures are directional estimates derived from the combined diagnostic results.",
      filenameBase: "cross-diagnostic-synthesis-" + slug(sources.map((s) => s.tool_type).sort().join("-")),
      source: r
    };
  }

  // ---- adapter: single diagnostic run --> model -----------------------------
  // Reads the run's exported result shape (full_result_json) with broad fallbacks,
  // mirroring the synthesis lib's extractor so field names line up.
  function fromRun(run) {
    const r = obj(run);
    const exposure = obj(r.exposure);
    const nar = obj(r.narrative);

    const toolType = firstStr(r.tool_type);
    const toolLabel = firstStr(r.tool_label, toolType);
    const score = r.score != null ? r.score : (r.cross_diagnostic_score != null ? r.cross_diagnostic_score : "—");
    const band = firstStr(r.band, r.score_band, r.condition_band, "—");
    const benchmark = firstStr(r.benchmark_position, r.benchmarkPosition, r.peer_position, "—");
    const trajectory = firstStr(r.trajectory, r.trajectory_label, r.trajectory_signal, "—");
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
    if (depth) kvs.push({ k: "Depth", v: depth + " items" });

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
  // Synthesis crown-jewel renderers — SVG generators + section builders
  // Each generator is defensive: returns "" if data missing so the
  // corresponding section is silently omitted from the report.
  // ──────────────────────────────────────────────────────────────────────

  function svgGauge(score, band) {
    if (score == null) return "";
    const s = Math.max(0, Math.min(100, Number(score)));
    const circumference = 2 * Math.PI * 92;
    const fillPct = 0.65; // arc spans 65% of full circle
    const arcLen = circumference * fillPct;
    const filled = arcLen * (s / 100);
    const empty = arcLen - filled;
    const rotationStart = -234; // start position (open at bottom)
    return '<svg viewBox="0 0 240 240" role="img" aria-label="Composite condition gauge" class="mr-svg-gauge">' +
      '<circle cx="120" cy="120" r="92" fill="none" stroke="#EAE6DD" stroke-width="18" stroke-dasharray="' + arcLen.toFixed(1) + ' ' + circumference.toFixed(1) + '" transform="rotate(' + rotationStart + ' 120 120)"/>' +
      '<circle cx="120" cy="120" r="92" fill="none" stroke="#0C6E78" stroke-width="18" stroke-linecap="round" stroke-dasharray="' + filled.toFixed(1) + ' ' + circumference.toFixed(1) + '" transform="rotate(' + rotationStart + ' 120 120)"/>' +
      '<text x="120" y="126" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="60" font-weight="700" fill="#18191C" letter-spacing="-.04em">' + Math.round(s) + '</text>' +
      '<text x="120" y="150" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" fill="#6E6F73">/ 100</text>' +
      (band ? '<text x="120" y="182" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="700" fill="#0C6E78" letter-spacing=".16em">' + esc(String(band).toUpperCase()) + '</text>' : '') +
      '</svg>';
  }

  function svgLensBar(lenses, composite) {
    const items = arr(lenses).filter((l) => l && l.score != null);
    if (!items.length) return "";
    const w = 640, h = 220, marginL = 220, marginR = 40, barH = 22, rowH = 42, topY = 40;
    const xScale = (v) => marginL + ((w - marginL - marginR) * Math.max(0, Math.min(100, v))) / 100;
    const parts = ['<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Four-lens comparison" class="mr-svg-lensbar">'];
    // Reference zones
    parts.push('<rect x="' + xScale(0) + '" y="' + topY + '" width="' + (xScale(60) - xScale(0)) + '" height="' + (rowH * items.length) + '" fill="#C9821F" opacity=".05"/>');
    parts.push('<rect x="' + xScale(70) + '" y="' + topY + '" width="' + (xScale(100) - xScale(70)) + '" height="' + (rowH * items.length) + '" fill="#3C8A60" opacity=".06"/>');
    // Threshold labels at top
    parts.push('<text x="' + xScale(58) + '" y="30" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#C9821F" letter-spacing=".14em">&lt; 60 &middot; WORKING BUT BURDENED</text>');
    parts.push('<text x="' + xScale(72) + '" y="30" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#3C8A60" letter-spacing=".14em">70+ &middot; HEALTHY RANGE</text>');
    // Rows
    items.forEach((lens, i) => {
      const yRow = topY + i * rowH + rowH / 2 - barH / 2;
      const label = lens.toolLabel || lens.toolType || "";
      const score = Math.max(0, Math.min(100, Number(lens.score)));
      parts.push('<text x="' + (marginL - 12) + '" y="' + (yRow + barH / 2 + 4) + '" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" font-weight="600" fill="#18191C">' + esc(label) + '</text>');
      parts.push('<rect x="' + xScale(0) + '" y="' + yRow + '" width="' + (xScale(100) - xScale(0)) + '" height="' + barH + '" fill="#F6F3EC" rx="4"/>');
      parts.push('<rect x="' + xScale(0) + '" y="' + yRow + '" width="' + (xScale(score) - xScale(0)) + '" height="' + barH + '" fill="#0C6E78" rx="4"/>');
      parts.push('<text x="' + (xScale(score) + 8) + '" y="' + (yRow + barH / 2 + 4) + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" font-weight="700" fill="#18191C">' + Math.round(score) + '</text>');
    });
    // Composite marker
    if (composite != null) {
      const cx = xScale(Math.max(0, Math.min(100, Number(composite))));
      const bottomY = topY + items.length * rowH + 8;
      parts.push('<line x1="' + cx + '" y1="' + topY + '" x2="' + cx + '" y2="' + bottomY + '" stroke="#08383E" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>');
      parts.push('<text x="' + cx + '" y="' + (bottomY + 14) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#08383E" letter-spacing=".14em">COMPOSITE ' + Math.round(composite) + '</text>');
    }
    parts.push('</svg>');
    return parts.join("");
  }

  function svgHeroMap(lenses, composite, band, patternName, compensationHoursText, compensationCostText) {
    const items = arr(lenses).filter((l) => l && l.score != null).slice(0, 4);
    if (!items.length || !patternName) return "";
    // Positions: TL, TR, BL, BR (OS/SC/DV/IP by convention if 4 items — but use items order defensively)
    const positions = [
      { x: 30, y: 60, anchor: "start" },
      { x: 790, y: 60, anchor: "end" },
      { x: 30, y: 340, anchor: "start" },
      { x: 790, y: 340, anchor: "end" }
    ];
    const tierColors = ["#0C6E78", "#C9821F", "#08383E", "#3C8A60"];
    const parts = ['<svg viewBox="0 0 820 500" role="img" aria-label="Hero synthesis map" class="mr-svg-hero">',
      '<defs><linearGradient id="mrHeroGrad" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#0C6E78"/><stop offset="45%" stop-color="#08383E"/><stop offset="72%" stop-color="#C9821F"/><stop offset="100%" stop-color="#3C8A60"/></linearGradient></defs>'];
    if (composite != null) {
      parts.push('<text x="410" y="26" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="700" fill="#6E6F73" letter-spacing=".18em">COMPOSITE ' + Math.round(composite) + (band ? ' &middot; ' + esc(String(band).toUpperCase()) : '') + '</text>');
    }
    // Central pattern box
    parts.push('<rect x="250" y="160" width="320" height="180" fill="#F6F3EC" stroke="#0C6E78" stroke-width="1.5" rx="12"/>');
    parts.push('<text x="410" y="192" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="700" fill="#0C6E78" letter-spacing=".18em">THE SHARED PATTERN</text>');
    // Split pattern name onto up to 2 lines
    const words = String(patternName).split(/\s+/);
    let line1 = words[0] || "", line2 = words.slice(1).join(" ");
    if (line1.length + line2.length < 24 && words.length <= 2) { line1 = String(patternName); line2 = ""; }
    parts.push('<text x="410" y="228" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="22" font-weight="700" fill="#18191C" letter-spacing="-.02em">' + esc(line1) + '</text>');
    if (line2) parts.push('<text x="410" y="256" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="22" font-weight="700" fill="#18191C" letter-spacing="-.02em">' + esc(line2) + '</text>');
    parts.push('<line x1="380" y1="' + (line2 ? 274 : 246) + '" x2="440" y2="' + (line2 ? 274 : 246) + '" stroke="#0C6E78" stroke-width="2"/>');
    if (compensationHoursText) parts.push('<text x="410" y="' + (line2 ? 298 : 270) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" fill="#6E6F73">' + esc(compensationHoursText) + '</text>');
    if (compensationCostText) parts.push('<text x="410" y="' + (line2 ? 316 : 288) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" fill="#6E6F73">' + esc(compensationCostText) + '</text>');

    // Four lens tiles
    items.forEach((lens, i) => {
      const pos = positions[i];
      const color = tierColors[i];
      const label = lens.toolLabel || lens.toolType || "";
      const shortCode = String(label).match(/^[A-Z]{2}/) ? String(label).match(/^[A-Z]{2}/)[0] : label.substring(0, 2).toUpperCase();
      const isLeft = pos.anchor === "start";
      const xText = isLeft ? pos.x + 16 : pos.x - 16;
      const xRect = isLeft ? pos.x : pos.x - 200;
      const xAccent = isLeft ? pos.x : pos.x - 4;
      // Tile
      parts.push('<rect x="' + xRect + '" y="' + pos.y + '" width="200" height="100" fill="#FFF" stroke="#EAE6DD" stroke-width="1" rx="8"/>');
      parts.push('<rect x="' + xAccent + '" y="' + pos.y + '" width="4" height="100" fill="' + color + '" rx="2"/>');
      parts.push('<text x="' + xText + '" y="' + (pos.y + 22) + '" text-anchor="' + pos.anchor + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="13" font-weight="700" fill="' + color + '">' + esc(shortCode) + '</text>');
      parts.push('<text x="' + xText + '" y="' + (pos.y + 38) + '" text-anchor="' + pos.anchor + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="10.5" font-weight="600" fill="' + color + '">' + esc(label) + '</text>');
      parts.push('<text x="' + xText + '" y="' + (pos.y + 68) + '" text-anchor="' + pos.anchor + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="28" font-weight="700" fill="#18191C" letter-spacing="-.03em">' + Math.round(Number(lens.score)) + '</text>');
      if (lens.primaryDriver) parts.push('<text x="' + xText + '" y="' + (pos.y + 85) + '" text-anchor="' + pos.anchor + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" fill="#6E6F73">' + esc(String(lens.primaryDriver).substring(0, 22)) + '</text>');
      // Arrow to center
      const arrowStartX = isLeft ? xRect + 200 : xRect;
      const arrowStartY = pos.y + 50;
      const arrowEndX = isLeft ? 250 : 570;
      const arrowEndY = pos.y < 200 ? 200 : 300;
      parts.push('<line x1="' + arrowStartX + '" y1="' + arrowStartY + '" x2="' + arrowEndX + '" y2="' + arrowEndY + '" stroke="#08383E" stroke-width="1.5" opacity="0.55"/>');
    });
    // Bottom sequence
    parts.push('<text x="30" y="475" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#0C6E78" letter-spacing=".18em">STRUCTURAL &middot; UPSTREAM</text>');
    parts.push('<line x1="240" y1="470" x2="580" y2="470" stroke="url(#mrHeroGrad)" stroke-width="3" stroke-linecap="round"/>');
    parts.push('<polygon points="580,464 592,470 580,476" fill="#3C8A60"/>');
    parts.push('<text x="790" y="475" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#3C8A60" letter-spacing=".18em">CULTURAL &middot; DOWNSTREAM</text>');
    parts.push('<text x="410" y="493" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" fill="#9A9892" letter-spacing=".14em">CORRECTION MUST FOLLOW THIS DIRECTION</text>');
    parts.push('</svg>');
    return parts.join("");
  }

  function svgCascade(actions) {
    const items = arr(actions).filter((a) => a && (a.label || a.text));
    if (!items.length) return "";
    const tierColorMap = { structural: "#0C6E78", behavioral: "#C9821F", cultural: "#3C8A60" };
    const positionalFallback = ["#0C6E78", "#08383E", "#C9821F", "#3C8A60"];
    const boxW = 130, gap = 30, startX = 40, y = 30, boxH = 80;
    const parts = ['<svg viewBox="0 0 680 150" role="img" aria-label="Sequencing cascade" class="mr-svg-cascade">'];
    parts.push('<text x="10" y="14" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#6E6F73" letter-spacing=".14em">UPSTREAM</text>');
    parts.push('<text x="670" y="14" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#6E6F73" letter-spacing=".14em">DOWNSTREAM</text>');
    items.slice(0, 4).forEach((a, i) => {
      const x = startX + i * (boxW + gap);
      const color = tierColorMap[String(a.tier).toLowerCase()] || positionalFallback[i] || "#0C6E78";
      const label = a.label || String(a.text).split(/\s+/).slice(0, 2).join(" ");
      parts.push('<rect x="' + x + '" y="' + y + '" width="' + boxW + '" height="' + boxH + '" fill="' + color + '" rx="8"/>');
      parts.push('<text x="' + (x + boxW / 2) + '" y="' + (y + 26) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="13" font-weight="700" fill="#FFF" letter-spacing=".08em">0' + (i + 1) + '</text>');
      // Wrap label onto up to 2 lines
      const words = String(label).split(/\s+/);
      const lineY = y + 48;
      parts.push('<text x="' + (x + boxW / 2) + '" y="' + lineY + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" font-weight="600" fill="#FFF">' + esc(words[0] || "") + '</text>');
      if (words.length > 1) parts.push('<text x="' + (x + boxW / 2) + '" y="' + (lineY + 14) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" font-weight="600" fill="#FFF">' + esc(words.slice(1).join(" ")) + '</text>');
      // Tier label below
      const tierLabel = String(a.tier || positionalFallback[i]).toUpperCase();
      parts.push('<text x="' + (x + boxW / 2) + '" y="' + (y + boxH + 18) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="8.5" font-weight="700" fill="' + color + '" letter-spacing=".14em">' + esc(tierLabel) + '</text>');
      // Arrow to next
      if (i < Math.min(items.length, 4) - 1) {
        const ax = x + boxW + 4;
        parts.push('<polygon points="' + ax + ',' + (y + boxH / 2 - 5) + ' ' + (ax + 18) + ',' + (y + boxH / 2) + ' ' + ax + ',' + (y + boxH / 2 + 5) + '" fill="#9A9892"/>');
      }
    });
    parts.push('</svg>');
    return parts.join("");
  }

  function svgTimeline(actions) {
    const items = arr(actions).filter((a) => a && a.horizonWeeks && Array.isArray(a.horizonWeeks)).slice(0, 4);
    if (!items.length) return "";
    const tierColorMap = { structural: "#0C6E78", behavioral: "#C9821F", cultural: "#3C8A60" };
    const positionalFallback = ["#0C6E78", "#08383E", "#C9821F", "#3C8A60"];
    const w = 820, h = 260, marginL = 240, marginR = 20, maxW = w - marginL - marginR;
    const maxWeek = 32;
    const wScale = (wk) => marginL + (Math.min(maxWeek, wk) / maxWeek) * maxW;
    const parts = ['<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Timeline horizon" class="mr-svg-timeline">'];
    // Week axis
    parts.push('<line x1="' + marginL + '" y1="30" x2="' + (w - marginR) + '" y2="30" stroke="rgba(24,25,28,.14)" stroke-width="1"/>');
    [0, 8, 16, 24, 32].forEach((wk) => {
      const x = wScale(wk);
      parts.push('<text x="' + x + '" y="22" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="600" fill="#6E6F73" letter-spacing=".06em">' + wk + (wk === 32 ? 'w+' : 'w') + '</text>');
      parts.push('<line x1="' + x + '" y1="30" x2="' + x + '" y2="210" stroke="rgba(24,25,28,.06)" stroke-dasharray="2 4"/>');
    });
    // Rows
    items.forEach((a, i) => {
      const yRow = 58 + i * 40;
      const color = tierColorMap[String(a.tier).toLowerCase()] || positionalFallback[i] || "#0C6E78";
      const startWk = a.horizonWeeks[0] || 0;
      const endWk = a.horizonWeeks[1] != null ? a.horizonWeeks[1] : maxWeek;
      const barX = wScale(startWk);
      const barW = Math.max(20, wScale(endWk) - barX);
      const label = String(a.label || a.text || "").substring(0, 32);
      parts.push('<text x="' + (marginL - 12) + '" y="' + (yRow + 14) + '" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" font-weight="600" fill="#18191C">0' + (i + 1) + ' &middot; ' + esc(label) + '</text>');
      parts.push('<rect x="' + barX + '" y="' + yRow + '" width="' + barW + '" height="28" fill="' + color + '" rx="4"/>');
      const tierLabel = String(a.tier || positionalFallback[i]).toUpperCase();
      const weekRange = a.horizonWeeks[1] != null ? startWk + '&ndash;' + endWk + 'w' : startWk + 'w+';
      parts.push('<text x="' + (barX + barW / 2) + '" y="' + (yRow + 18) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="600" fill="#FFF" letter-spacing=".08em">' + esc(tierLabel) + ' &middot; ' + weekRange + '</text>');
    });
    parts.push('<text x="' + marginL + '" y="238" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="600" fill="#6E6F73" letter-spacing=".06em">EACH TIER BEGINS UNLOCKING BEFORE THE NEXT STARTS</text>');
    parts.push('<text x="' + (w - marginR) + '" y="238" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="10" font-weight="600" fill="#6E6F73" letter-spacing=".06em">TOTAL HORIZON ~32 WEEKS</text>');
    parts.push('</svg>');
    return parts.join("");
  }

  function svgConvergenceMatrix(signals, tools) {
    const sigs = arr(signals).filter((s) => s && (s.text || s.label));
    const toolList = arr(tools).length ? arr(tools) : ["OS", "DV", "SC", "IP"];
    if (!sigs.length) return "";
    const w = 640, h = 220, colW = 90, marginL = 30, rowH = 40, topY = 55;
    const parts = ['<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Convergence matrix" class="mr-svg-matrix">'];
    // Column headers
    toolList.slice(0, 4).forEach((t, i) => {
      const x = marginL + 240 + i * colW + colW / 2;
      parts.push('<text x="' + x + '" y="30" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" font-weight="700" fill="#0C6E78" letter-spacing=".14em">' + esc(String(t).substring(0, 3).toUpperCase()) + '</text>');
    });
    // Rows
    sigs.slice(0, 4).forEach((sig, i) => {
      const y = topY + i * rowH;
      const num = String(i + 1).padStart(2, "0");
      const label = sig.label || String(sig.text || "").split(/\s+/).slice(0, 3).join(" ");
      parts.push('<text x="' + marginL + '" y="' + (y + 22) + '" font-family="Helvetica Neue,Arial,sans-serif" font-size="9.5" font-weight="700" fill="#18191C" letter-spacing=".08em">' + num + ' ' + esc(String(label).toUpperCase()) + '</text>');
      // Fill dots based on tools
      const sigTools = arr(sig.tools).map((t) => String(t).toLowerCase());
      toolList.slice(0, 4).forEach((t, j) => {
        const cx = marginL + 240 + j * colW + colW / 2;
        const cy = y + 20;
        const tLower = String(t).toLowerCase();
        const present = sigTools.some((st) => st === tLower || st.includes(tLower.substring(0, 2)) || tLower.includes(st.substring(0, 2)));
        const filled = present || sigTools.length === 0; // if no tools listed, assume all
        parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="' + (filled ? '#0C6E78' : '#F6F3EC') + '" stroke="' + (filled ? '#0C6E78' : '#EAE6DD') + '" stroke-width="1"/>');
      });
    });
    parts.push('</svg>');
    return parts.join("");
  }

  function svgExposureSplit(totalHours, compensationHours) {
    if (!totalHours || !compensationHours) return "";
    const total = Number(totalHours), comp = Number(compensationHours);
    const pctComp = Math.min(1, comp / total);
    const w = 640, h = 68, barY = 24, barH = 24;
    const compW = w * pctComp;
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Compensation subset of total burden" class="mr-svg-exposure">' +
      '<rect x="0" y="' + barY + '" width="' + w + '" height="' + barH + '" fill="#EAE6DD" rx="4"/>' +
      '<rect x="0" y="' + barY + '" width="' + compW + '" height="' + barH + '" fill="#0C6E78" rx="4"/>' +
      '<text x="' + (compW / 2) + '" y="' + (barY + 16) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" font-weight="600" fill="#FFF">Compensation &middot; ' + num(comp) + ' hrs</text>' +
      '<text x="' + (compW + (w - compW) / 2) + '" y="' + (barY + 16) + '" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="12" font-weight="600" fill="#6E6F73">Other burden &middot; ' + num(total - comp) + ' hrs</text>' +
      '<text x="' + w + '" y="' + (barY + barH + 18) + '" text-anchor="end" font-family="Helvetica Neue,Arial,sans-serif" font-size="9" font-weight="700" fill="#6E6F73" letter-spacing=".14em">TOTAL ' + num(total) + ' HRS</text>' +
      '</svg>';
  }

  // ─── Section renderers (HTML fragments) ───

  function renderDiagnosis(diag) {
    if (!diag) return "";
    const metaHtml = arr(diag.meta).map((m) => '<span class="mr-diag-meta-item"><strong>' + esc(m.label) + '</strong> ' + esc(m.value) + '</span>').join("");
    return '<section class="mr-diag-section">' +
      '<div class="mr-diag-hero">' +
        '<p class="mr-diag-eyebrow">Diagnosis</p>' +
        '<h2 class="mr-diag-title">' + esc(diag.name) + '</h2>' +
        (diag.type ? '<p class="mr-diag-type">' + esc(diag.type) + '</p>' : "") +
        '<div class="mr-diag-rule"></div>' +
        (diag.body ? '<p class="mr-diag-body">' + esc(diag.body) + '</p>' : "") +
        (metaHtml ? '<div class="mr-diag-meta">' + metaHtml + '</div>' : "") +
      '</div>' +
    '</section>';
  }

  function renderBriefing(brief) {
    if (!brief) return "";
    const paras = arr(brief.paragraphs).map((p) => '<p class="mr-briefing-body">' + esc(p) + '</p>').join("");
    return '<section class="mr-briefing-section">' +
      '<h2>Executive briefing</h2>' +
      '<div class="mr-briefing-block">' +
        (brief.lede ? '<p class="mr-briefing-lede">' + esc(brief.lede) + '</p>' : "") +
        paras +
      '</div>' +
    '</section>';
  }

  function renderComposite(comp, heroSvg, gaugeSvg, exposureSvg) {
    if (!comp) return "";
    return '<section class="mr-composite-section">' +
      '<h2>Composite finding</h2>' +
      (comp.primaryPattern ? '<p class="mr-lede">' + esc(comp.primaryPattern) + '</p>' : "") +
      (heroSvg ? '<div class="mr-viz-panel mr-viz-hero">' + heroSvg + '</div>' : "") +
      (gaugeSvg ? '<div class="mr-viz-panel mr-viz-gauge">' + gaugeSvg + '</div>' : "") +
      (exposureSvg ? '<div class="mr-viz-panel mr-viz-exposure"><p class="mr-viz-title">Compensation subset of total burden</p>' + exposureSvg + '</div>' : "") +
    '</section>';
  }

  function renderLenses(lenses, lensBarSvg) {
    if (!arr(lenses).length) return "";
    const cards = arr(lenses).map((l) => '<div class="mr-lens-card">' +
      '<p class="mr-lens-label">' + esc(l.toolLabel || l.toolType || "") + '</p>' +
      '<p class="mr-lens-score">' + (l.score != null ? Math.round(Number(l.score)) : "—") + '</p>' +
      (l.band ? '<p class="mr-lens-band">' + esc(l.band) + '</p>' : "") +
      (l.primaryDriver ? '<p class="mr-lens-driver">' + esc(l.primaryDriver) + '</p>' : "") +
    '</div>').join("");
    return '<section class="mr-lenses-section">' +
      '<h2>Four lenses</h2>' +
      (lensBarSvg ? '<div class="mr-viz-panel">' + lensBarSvg + '</div>' : "") +
      '<div class="mr-lens-grid">' + cards + '</div>' +
    '</section>';
  }

  function renderConvergence(signals, matrixSvg) {
    if (!arr(signals).length) return "";
    const rows = arr(signals).map((sig, i) => {
      const num = String(i + 1).padStart(2, "0");
      const tagsHtml = arr(sig.dimensions).map((d) => '<span class="mr-tag">' + esc((d.tool || "") + (d.dimension ? " &middot; " + d.dimension : "") + (d.severity != null ? " [" + d.severity + "]" : "")) + '</span>').join("");
      return '<div class="mr-signal">' +
        '<span class="mr-signal-num">' + num + '</span>' +
        '<div class="mr-signal-body">' +
          '<p><strong>' + esc(sig.label || "") + (sig.label ? ". " : "") + '</strong>' + esc(sig.text) + '</p>' +
          (tagsHtml ? '<div class="mr-signal-tags">' + tagsHtml + '</div>' : "") +
        '</div>' +
      '</div>';
    }).join("");
    return '<section class="mr-convergence-section">' +
      '<h2>Convergence signals</h2>' +
      '<p class="mr-lede">Where the four instruments agree, and what specifically converges.</p>' +
      (matrixSvg ? '<div class="mr-viz-panel">' + matrixSvg + '</div>' : "") +
      rows +
    '</section>';
  }

  function renderContradictions(cs) {
    if (!arr(cs).length) return "";
    const rows = arr(cs).map((c) => '<div class="mr-contradiction"><p>' + esc(c.text) + '</p></div>').join("");
    return '<section class="mr-contradictions-section">' +
      '<h2>Contradictions</h2>' +
      '<p class="mr-lede">Where the four instruments disagree — often the diagnostically richest area.</p>' +
      rows +
    '</section>';
  }

  function renderActions(actions, cascadeSvg, timelineSvg) {
    if (!arr(actions).length) return "";
    const rows = arr(actions).map((a, i) => {
      const num = String(i + 1).padStart(2, "0");
      const tier = String(a.tier || "").toLowerCase();
      return '<div class="mr-action" data-tier="' + esc(tier) + '">' +
        '<span class="mr-action-num">' + num + '</span>' +
        '<div class="mr-action-body">' +
          (a.label ? '<p class="mr-action-label">' + esc(a.label) + (tier ? ' &middot; ' + esc(tier.toUpperCase()) : '') + '</p>' : "") +
          '<p>' + esc(a.text) + '</p>' +
        '</div>' +
      '</div>';
    }).join("");
    return '<section class="mr-actions-section">' +
      '<h2>Priority actions</h2>' +
      '<p class="mr-lede">Where leadership should probably begin. Order matters — each tier begins unlocking before the next starts.</p>' +
      (cascadeSvg ? '<div class="mr-viz-panel">' + cascadeSvg + '</div>' : "") +
      rows +
      (timelineSvg ? '<div class="mr-viz-panel mr-viz-timeline">' + timelineSvg + '</div>' : "") +
    '</section>';
  }

  function renderExperiential(exp) {
    if (!exp) return "";
    return '<section class="mr-experiential-section">' +
      '<h2>Cross-organizational experience</h2>' +
      '<p class="mr-lede">How the pattern manifests differently at each organizational layer — content only synthesis can produce.</p>' +
      (exp.operationalStaff ? '<h3>What operational staff are experiencing</h3><p>' + esc(exp.operationalStaff) + '</p>' : "") +
      (exp.managers ? '<h3>What managers are experiencing</h3><p>' + esc(exp.managers) + '</p>' : "") +
      (exp.seniorLeaders ? '<h3>What senior leaders are seeing</h3><p>' + esc(exp.seniorLeaders) + '</p>' : "") +
    '</section>';
  }

  function renderIndicators(indicators) {
    if (!arr(indicators).length) return "";
    const tiles = arr(indicators).map((i) => '<div class="mr-indicator-tile" data-lens="' + esc(i.lens || "cross") + '">' +
      (i.lensLabel ? '<p class="mr-indicator-lens">' + esc(i.lensLabel) + '</p>' : "") +
      '<p class="mr-indicator-name">' + esc(i.name) + '</p>' +
      (i.description ? '<p class="mr-indicator-detail">' + (i.watchFor ? '<em>Watch for: ' + esc(i.watchFor) + '.</em> ' : "") + esc(i.description) + '</p>' : "") +
      (i.current ? '<p class="mr-indicator-current">Current: <strong>' + esc(i.current) + '</strong></p>' : "") +
    '</div>').join("");
    return '<section class="mr-indicators-section">' +
      '<h2>Leading indicators</h2>' +
      '<p class="mr-lede">What to watch — measurable signals leadership should monitor to know if the pattern is worsening, holding, or receding.</p>' +
      '<div class="mr-indicators-grid">' + tiles + '</div>' +
    '</section>';
  }

  function renderLeadership(l) {
    if (!l || (!l.implication && !l.sequencingLogic)) return "";
    return '<section class="mr-leadership-section">' +
      '<h2>Leadership read</h2>' +
      (l.implication ? '<p>' + esc(l.implication) + '</p>' : "") +
      (l.sequencingLogic ? '<h3>Sequencing logic</h3><p>' + esc(l.sequencingLogic) + '</p>' : "") +
    '</section>';
  }

  function renderConfidence(conf) {
    if (!conf) return "";
    const tierMap = { high: { pct: 100, color: "#0C6E78", label: "HIGH" }, moderate: { pct: 65, color: "#C9821F", label: "MODERATE" }, directional: { pct: 35, color: "#9A9892", label: "DIRECTIONAL" } };
    const rows = [];
    arr(conf.convergenceSignals).forEach((tier, i) => {
      const t = tierMap[String(tier).toLowerCase()] || tierMap.directional;
      rows.push('<div class="mr-confidence-row" data-tier="' + esc(tier) + '"><div class="mr-confidence-label"><strong>Signal ' + String(i + 1).padStart(2, "0") + '</strong> confidence</div><div class="mr-confidence-bar" style="background:linear-gradient(to right,' + t.color + ' ' + t.pct + '%,#EAE6DD ' + t.pct + '%)"></div><div class="mr-confidence-tier">' + t.label + '</div></div>');
    });
    if (conf.compositeExposureMath) {
      const t = tierMap[String(conf.compositeExposureMath).toLowerCase()] || tierMap.directional;
      rows.push('<div class="mr-confidence-row"><div class="mr-confidence-label"><strong>Composite exposure math</strong> total + compensation subset</div><div class="mr-confidence-bar" style="background:linear-gradient(to right,' + t.color + ' ' + t.pct + '%,#EAE6DD ' + t.pct + '%)"></div><div class="mr-confidence-tier">' + t.label + '</div></div>');
    }
    if (conf.cascadeUpstreamDriver) {
      const t = tierMap[String(conf.cascadeUpstreamDriver).toLowerCase()] || tierMap.directional;
      rows.push('<div class="mr-confidence-row"><div class="mr-confidence-label"><strong>Cascade upstream driver</strong> identified as root</div><div class="mr-confidence-bar" style="background:linear-gradient(to right,' + t.color + ' ' + t.pct + '%,#EAE6DD ' + t.pct + '%)"></div><div class="mr-confidence-tier">' + t.label + '</div></div>');
    }
    if (conf.sequencingHorizonEstimates) {
      const t = tierMap[String(conf.sequencingHorizonEstimates).toLowerCase()] || tierMap.directional;
      rows.push('<div class="mr-confidence-row"><div class="mr-confidence-label"><strong>Sequencing horizon estimates</strong> week ranges</div><div class="mr-confidence-bar" style="background:linear-gradient(to right,' + t.color + ' ' + t.pct + '%,#EAE6DD ' + t.pct + '%)"></div><div class="mr-confidence-tier">' + t.label + '</div></div>');
    }
    if (!rows.length) return "";
    return '<section class="mr-confidence-section">' +
      '<h2>Evidence trail</h2>' +
      '<p class="mr-lede">Where the read is anchored, and where it is directional. Confidence tiers reflect how many independent signals support each finding.</p>' +
      '<div class="mr-confidence-panel">' + rows.join("") + '</div>' +
    '</section>';
  }

  function renderMethodNote() {
    return '<section class="mr-method-section">' +
      '<h2>How this was produced</h2>' +
      '<p>This synthesis is produced by combining the individual diagnostic outputs of the Monderman instruments used in this read (some combination of Operational Systems, Decision Velocity, Structural Clarity, and Institutional Performance) using a cross-diagnostic engine. The engine identifies where lenses agree (convergence), where they don\u2019t (contradictions), and stitches those into a shared pattern and correction sequence.</p>' +
      '<p>The composite score is a weighted read across the instruments, not a simple average. Compensation-cost and envelope-drag numbers are directional estimates derived from the combined diagnostic results and typical labor-rate references. Correction-horizon estimates reflect typical sequencing for a compensation-pattern correction; they are not commitments and should be checked against local capacity.</p>' +
      '<p>This document is a directional executive read. Its strongest value is clarifying <em>where</em> the measured condition is pointing and <em>what</em> to address first. It is not a substitute for independent review or audited analysis.</p>' +
    '</section>';
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
          const text = i.text ? String(i.text) : "";
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

  function buildReportBody(model) {
    const m = obj(model);
    const meta = arr(m.meta).map((x) => "<span>" + esc(x.label) + ": " + esc(x.value) + "</span>").join("");

    // Common cover block for both synthesis and run reports
    const coverBlock =
      '<div class="mast">' + esc(m.mastline) + '</div>' +
      '<div class="rule"></div>' +
      "<h1>" + esc(m.title) + "</h1>" +
      '<p class="sub">' + esc(m.subtitle) + "</p>" +
      '<div class="meta">' + meta + "</div>" +
      '<div class="cover-score"><div class="score-line">' +
        '<div class="score-num">' + esc(m.headlineScore) + "</div>" +
        '<div class="score-band">' + esc(m.headlineBand) + "</div>" +
      "</div>" + (m.coverBody ? "<p>" + esc(m.coverBody) + "</p>" : "") + "</div>";

    // ─── Synthesis path: 12-section crown-jewel pipeline ───
    if (m.kind === "synthesis" && (m.diagnosis || m.composite || m.lenses)) {
      const comp = obj(m.composite);
      // Compact formatters for hero-map inline strings
      const compactNumHrs = (v) => {
        if (v == null) return "";
        const n = Number(v);
        if (n >= 1e6) return "~" + Math.round(n / 1e5) / 10 + "M";
        if (n >= 1e3) return "~" + Math.round(n / 1e3) + "k";
        return "~" + n;
      };
      const compactCurRange = (l, hi) => {
        if (l == null || hi == null) return "";
        const fmt = (n) => n >= 1e6 ? Math.round(n / 1e5) / 10 + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
        return "$" + fmt(l).replace(/\.0M$/, "M") + "–" + fmt(hi).replace(/\.0M$/, "M");
      };
      const hoursText = comp.compensationHours ? compactNumHrs(comp.compensationHours) + " compensation hours / yr" : "";
      const costText = (comp.compCostLow != null && comp.compCostHigh != null) ? compactCurRange(comp.compCostLow, comp.compCostHigh) + " compensation cost / yr" : "";

      // Build all SVGs (each returns "" if data insufficient)
      const heroSvg = m.diagnosis ? svgHeroMap(m.lenses, comp.score, comp.band, m.diagnosis.name, hoursText, costText) : "";
      const gaugeSvg = svgGauge(comp.score, comp.band);
      const exposureSvg = svgExposureSplit(comp.totalBurdenHours, comp.compensationHours);
      const lensBarSvg = svgLensBar(m.lenses, comp.score);
      const matrixSvg = svgConvergenceMatrix(m.convergenceSignals, m.lenses ? m.lenses.map((l) => l.toolLabel || l.toolType) : []);
      const cascadeSvg = svgCascade(m.priorityActions);
      const timelineSvg = svgTimeline(m.priorityActions);

      // Assemble the 12 sections in order
      const body =
        renderDiagnosis(m.diagnosis) +
        renderBriefing(m.briefing) +
        renderComposite(m.composite, heroSvg, gaugeSvg, exposureSvg) +
        renderLenses(m.lenses, lensBarSvg) +
        renderConvergence(m.convergenceSignals, matrixSvg) +
        renderContradictions(m.contradictions) +
        renderActions(m.priorityActions, cascadeSvg, timelineSvg) +
        renderExperiential(m.experiential) +
        renderIndicators(m.leadingIndicators) +
        renderLeadership(m.leadership) +
        renderConfidence(m.confidence) +
        renderMethodNote();

      return coverBlock + body + '<div class="footer">' + esc(m.footnote) + "</div>";
    }

    // ─── Legacy path: run reports (fromRun) still use the old sections shape ───
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

  var REPORT_CSS =
    ':root{--ink:#18191C;--soft:#6E6F73;--muted:#9A9892;--accent:#0C6E78;--line:#EAE6DD;--paper:#fff;--page:#F6F3EC}' +
    '*{box-sizing:border-box}' +
    'body{margin:0;background:var(--page);color:var(--ink);font-family:Georgia,"Times New Roman",serif}' +
    '.page{max-width:920px;margin:0 auto;background:var(--paper);padding:54px 68px 64px;box-shadow:0 18px 48px rgba(15,23,32,.08)}' +
    '.mast{font-family:"Helvetica Neue",Arial,sans-serif;font-size:.78rem;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}' +
    '.rule{height:2px;background:var(--accent);opacity:.22;margin:10px 0 28px}' +
    'h1,h2,h3{font-family:"Helvetica Neue",Arial,sans-serif;color:var(--ink);margin:0}' +
    'h1{font-size:2.25rem;line-height:1.02;letter-spacing:-.04em}' +
    'h2{font-size:1.18rem;line-height:1.18;letter-spacing:-.02em;margin-top:34px}' +
    'p{font-size:1rem;line-height:1.75;margin:0 0 14px}' +
    '.sub{color:var(--soft);max-width:42em}' +
    '.meta{display:flex;flex-wrap:wrap;gap:10px 14px;margin:18px 0 0;font-family:"Helvetica Neue",Arial,sans-serif;font-size:.83rem;color:var(--soft)}' +
    '.cover-score{margin-top:30px;padding:18px 0 0;border-top:1px solid var(--line)}' +
    '.score-line{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;font-family:"Helvetica Neue",Arial,sans-serif}' +
    '.score-num{font-size:4rem;line-height:.9;font-weight:700;letter-spacing:-.08em}' +
    '.score-band{font-size:1rem;color:var(--soft);padding-bottom:8px}' +
    '.callout{margin:18px 0;padding:18px 20px;border-left:4px solid var(--accent);background:#F8FAFD}' +
    '.kvs{display:grid;grid-template-columns:190px 1fr;gap:8px 20px;margin:16px 0 8px}' +
    '.kvs div{font-size:.98rem;line-height:1.7}.kvs .k{font-family:"Helvetica Neue",Arial,sans-serif;color:var(--muted)}' +
    'ul{margin:8px 0 0 20px;padding:0}li{margin:0 0 8px;line-height:1.7}' +
    '.footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);font-size:.85rem;color:var(--soft)}' +
    '.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:"Helvetica Neue",Arial,sans-serif}' +
    '.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;min-width:168px;padding:0 24px;border-radius:7px;font-size:15px;font-weight:500;white-space:nowrap;background:#FFF;color:#18191C;border:1px solid rgba(24,25,28,.12);box-shadow:none;cursor:pointer}' +
    '.btn-accent{background:#0C6E78;color:#FFF;border-color:rgba(12,110,120,.18)}' +
    '@media print{body{background:#fff}.page{box-shadow:none;max-width:none;padding:34px 42px}.actions{display:none!important}}' +

    // ═══ Synthesis crown-jewel section styles ═══
    `
    .mr-diag-section { margin: 24px 0 36px; }
    .mr-diag-hero { background:#F6F3EC; border:1px solid rgba(12,110,120,0.20); border-left:4px solid #0C6E78; border-radius:14px; padding:40px 44px 32px; }
    .mr-diag-eyebrow { font-family:"Helvetica Neue",Arial,sans-serif; font-size:0.72rem; letter-spacing:0.24em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin:0 0 14px; }
    .mr-diag-title { font-family:"Helvetica Neue",Arial,sans-serif; font-size:2rem; line-height:1.02; letter-spacing:-0.032em; color:#18191C; font-weight:700; margin:0 0 8px; }
    .mr-diag-type { font-family:"Helvetica Neue",Arial,sans-serif; font-size:0.94rem; color:#6E6F73; font-weight:500; margin:0 0 20px; }
    .mr-diag-rule { height:2px; width:40px; background:#0C6E78; margin:0 0 20px; }
    .mr-diag-body { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1.04rem; line-height:1.65; color:#18191C; margin:0 0 24px; }
    .mr-diag-meta { display:flex; flex-wrap:wrap; gap:18px 36px; padding-top:20px; border-top:1px solid rgba(12,110,120,0.16); font-family:"Helvetica Neue",Arial,sans-serif; }
    .mr-diag-meta-item { font-size:0.9rem; color:#18191C; }
    .mr-diag-meta-item strong { display:block; font-size:0.68rem; letter-spacing:0.16em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin-bottom:4px; }

    .mr-briefing-section { margin:24px 0 32px; }
    .mr-briefing-block { background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #08383E; border-radius:12px; padding:32px 40px; font-family:"Helvetica Neue",Arial,sans-serif; }
    .mr-briefing-lede { font-size:1.28rem; line-height:1.42; font-weight:600; color:#18191C; margin:0 0 20px; letter-spacing:-0.012em; }
    .mr-briefing-body { font-size:1rem; line-height:1.7; color:#18191C; margin:0 0 16px; }
    .mr-briefing-body:last-child { margin-bottom:0; }

    .mr-composite-section { margin:24px 0 32px; }
    .mr-viz-panel { background:#FFF; border:1px solid #EAE6DD; border-radius:14px; padding:28px 24px; margin:20px 0; }
    .mr-viz-hero { padding:28px 24px 24px; }
    .mr-viz-gauge { text-align:center; }
    .mr-viz-title { font-family:"Helvetica Neue",Arial,sans-serif; font-size:0.8rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#6E6F73; margin:0 0 12px; }
    .mr-lede { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1.05rem; line-height:1.55; color:#6E6F73; margin:8px 0 16px; }
    .mr-svg-gauge, .mr-svg-lensbar, .mr-svg-hero, .mr-svg-cascade, .mr-svg-timeline, .mr-svg-matrix, .mr-svg-exposure { display:block; width:100%; height:auto; max-width:100%; }
    .mr-svg-gauge { max-width:240px; margin:0 auto; }

    .mr-lenses-section { margin:24px 0 32px; }
    .mr-lens-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:16px; font-family:"Helvetica Neue",Arial,sans-serif; }
    .mr-lens-card { background:#FFF; border:1px solid #EAE6DD; border-radius:10px; padding:16px 18px; }
    .mr-lens-label { font-size:0.68rem; letter-spacing:0.16em; text-transform:uppercase; color:#0C6E78; font-weight:700; margin:0 0 6px; }
    .mr-lens-score { font-size:2rem; font-weight:700; color:#18191C; letter-spacing:-0.03em; margin:0 0 4px; }
    .mr-lens-band { font-size:0.85rem; color:#6E6F73; margin:0 0 4px; }
    .mr-lens-driver { font-size:0.85rem; color:#18191C; margin:0; }

    .mr-convergence-section { margin:24px 0 32px; }
    .mr-signal { display:grid; grid-template-columns:40px 1fr; gap:16px; margin:16px 0; padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-radius:10px; }
    .mr-signal-num { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1.5rem; font-weight:700; color:#0C6E78; letter-spacing:-0.02em; }
    .mr-signal-body p { margin:0 0 8px; font-size:0.98rem; line-height:1.65; }
    .mr-signal-tags { display:flex; flex-wrap:wrap; gap:6px 8px; margin-top:8px; }
    .mr-tag { font-family:"Helvetica Neue",Arial,sans-serif; font-size:0.72rem; font-weight:600; letter-spacing:0.06em; padding:2px 8px; border-radius:20px; background:rgba(12,110,120,0.08); color:#0C6E78; border:1px solid rgba(12,110,120,0.20); }

    .mr-contradictions-section { margin:24px 0 32px; }
    .mr-contradiction { padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #C9821F; border-radius:10px; margin:12px 0; }
    .mr-contradiction p { margin:0; font-size:0.98rem; line-height:1.65; }

    .mr-actions-section { margin:24px 0 32px; }
    .mr-action { display:grid; grid-template-columns:40px 1fr; gap:16px; margin:12px 0; padding:16px 18px; background:#FFF; border:1px solid #EAE6DD; border-left:3px solid #0C6E78; border-radius:10px; }
    .mr-action[data-tier="structural"] { border-left-color:#0C6E78; }
    .mr-action[data-tier="behavioral"] { border-left-color:#C9821F; }
    .mr-action[data-tier="cultural"] { border-left-color:#3C8A60; }
    .mr-action-num { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1.5rem; font-weight:700; color:#0C6E78; letter-spacing:-0.02em; }
    .mr-action[data-tier="behavioral"] .mr-action-num { color:#C9821F; }
    .mr-action[data-tier="cultural"] .mr-action-num { color:#3C8A60; }
    .mr-action-body p { margin:0 0 6px; font-size:0.98rem; line-height:1.65; }
    .mr-action-label { font-family:"Helvetica Neue",Arial,sans-serif; font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:#6E6F73; font-weight:700; margin:0 0 8px !important; }
    .mr-viz-timeline { padding:20px 20px 24px; }

    .mr-experiential-section { margin:24px 0 32px; }
    .mr-experiential-section h3 { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1.05rem; font-weight:600; color:#18191C; margin:18px 0 8px; border-left:2px solid rgba(12,110,120,0.32); padding-left:14px; }

    .mr-indicators-section { margin:24px 0 32px; }
    .mr-indicators-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:16px; font-family:"Helvetica Neue",Arial,sans-serif; }
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
    .mr-leadership-section h3 { font-family:"Helvetica Neue",Arial,sans-serif; font-size:1rem; font-weight:600; color:#18191C; margin:16px 0 8px; }

    .mr-confidence-section { margin:24px 0 32px; }
    .mr-confidence-panel { background:#FFF; border:1px solid #EAE6DD; border-radius:12px; padding:20px 24px; font-family:"Helvetica Neue",Arial,sans-serif; }
    .mr-confidence-row { display:grid; grid-template-columns:minmax(0,1fr) 120px 100px; gap:16px; padding:12px 4px; border-bottom:1px solid #EAE6DD; align-items:center; }
    .mr-confidence-row:last-child { border-bottom:none; }
    .mr-confidence-label { font-size:0.94rem; line-height:1.4; color:#18191C; }
    .mr-confidence-label strong { color:#0C6E78; font-weight:700; }
    .mr-confidence-bar { height:8px; border-radius:4px; }
    .mr-confidence-tier { font-size:0.7rem; letter-spacing:0.14em; font-weight:700; text-align:right; color:#6E6F73; }

    .mr-method-section { margin:24px 0 8px; }
    .mr-method-section p { font-size:0.94rem; line-height:1.65; color:#18191C; }

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
      '<div class="page">' + buildReportBody(model) +
      '<div class="actions"><button class="btn btn-accent" onclick="window.print()">Save / Print PDF</button>' +
      '<button class="btn" onclick="window.close()">Close report</button></div>' +
      "</div></body></html>";
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
    node.innerHTML = '<div class="page" style="box-shadow:none;margin:0;max-width:none">' + buildReportBody(model) + "</div>";
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
