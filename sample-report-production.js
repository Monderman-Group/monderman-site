(function () {
  "use strict";

  const ARTIFACT_URL = "sample-data/production-diagnostic-samples.json?v=611188e3ab10";
  const REPORT_KEYS = {
    os: "operational_systems",
    dv: "decision_velocity",
    sc: "structural_clarity",
    ip: "institutional_performance"
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const all = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const arr = (value) => Array.isArray(value) ? value : [];
  const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const finite = (value) => value !== null && value !== "" && Number.isFinite(Number(value));
  const number = (value, digits) => finite(value)
    ? Number(value).toLocaleString("en-US", { maximumFractionDigits: digits == null ? 1 : digits })
    : "—";
  const money = (value) => finite(value)
    ? Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";
  const percent = (value) => finite(value) ? number(value, 1) + "%" : "—";
  const humanize = (value) => String(value || "")
    .replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const first = (...values) => values.find((value) => typeof value === "string" && value.trim()) || "";

  function downloadJson(value, filename) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function makeModel(source) {
    const result = obj(source.result);
    const context = obj(source.input_context);
    const descriptor = obj(result.canonical_descriptor);
    const prose = obj(result.interpretive_prose);
    const summary = obj(prose.executive_summary);
    const narrative = obj(prose.harmonized_narrative);
    const exposure = obj(result.exposure);
    const coverage = obj(result.measurement_coverage || result.dimension_coverage);
    const depth = obj(result.insight_depth);
    const trajectory = obj(result.trajectory);
    const dimensions = obj(result.dimensions);
    const labels = obj(descriptor.dimension_display);
    const ladder = arr(descriptor.priority_ladder);
    const remedies = arr(prose.remedy_paths);
    const actions = arr(prose.priority_actions).filter((item) => typeof item === "string" && item.trim());
    const evidence = arr(result.participant_evidence);
    const watch = arr(result.watch_items).map((item) => typeof item === "string" ? item : first(obj(item).message, obj(item).text, obj(item).label)).filter(Boolean);
    const findings = arr(result.key_findings).map((item) => typeof item === "string" ? item : first(obj(item).message, obj(item).text, obj(item).label)).filter(Boolean);
    const primary = first(
      descriptor.primary_constraint_label,
      descriptor.dominant_burden_label,
      result.primary_driver,
      humanize(result.primary_constraint)
    );
    const participantMode = humanize(result.participant_mode || context.participantMode || "managerial");

    return {
      result, context, descriptor, prose, summary, narrative, exposure, coverage, depth,
      trajectory, dimensions, labels, ladder, remedies, actions, evidence, watch, findings,
      primary, participantMode,
      tool: first(result.tool_label, humanize(result.tool_type), "Diagnostic"),
      process: first(context.processName, context.process_name, "Bounded operating pathway"),
      functionName: first(context.functionName, context.businessUnit, "Bounded operating scope"),
      headline: first(summary.headline, narrative.headlineFinding, result.score_band_note),
      body: first(summary.body, narrative.headlineFinding, result.score_band_note),
      opportunity: first(summary.opportunity, narrative.opportunity),
      benchmark: first(prose.benchmark_interpretation, narrative.benchmark, result.benchmark_position),
      tradeoff: first(narrative.tradeoff, result.score_band_note),
      quadrant: first(result.quadrant_interpretation_text),
      trajectoryLabel: first(descriptor.trajectory_text, trajectory.label, "Not established"),
      trajectoryNote: first(descriptor.trajectory_note, trajectory.note),
      evidenceBand: first(depth.band, result.input_confidence_label, "Directional single-run evidence")
    };
  }

  function metric(label, value, detail) {
    return '<div class="psr-metric"><p class="psr-label">' + esc(label) + '</p>' +
      '<p class="psr-metric-value">' + esc(value) + '</p>' +
      (detail ? '<p class="psr-muted">' + esc(detail) + '</p>' : '') + '</div>';
  }

  function sectionHeading(numberValue, eyebrow, title, copy) {
    return '<div class="psr-section-head"><p class="psr-eyebrow">' + esc(numberValue + " · " + eyebrow) + '</p>' +
      '<h2>' + esc(title) + '</h2>' + (copy ? '<p class="psr-lede">' + esc(copy) + '</p>' : '') + '</div>';
  }

  function dimensionsHtml(model) {
    const entries = Object.entries(model.dimensions);
    if (!entries.length) return '<p class="psr-muted">No dimension values were returned.</p>';
    return '<div class="psr-dimension-grid">' + entries.map(([key, value]) => {
      const width = Math.max(0, Math.min(100, Number(value) || 0));
      const coverage = obj(obj(model.coverage.dimensions)[key]);
      return '<div class="psr-dimension">' +
        '<div class="psr-dimension-copy"><strong>' + esc(model.labels[key] || humanize(key)) + '</strong>' +
        '<span>' + esc(number(value, 1)) + '</span></div>' +
        '<div class="psr-bar" aria-label="' + esc((model.labels[key] || humanize(key)) + " " + number(value, 1) + " of 100") + '">' +
        '<span style="width:' + esc(width) + '%"></span></div>' +
        (finite(coverage.evidence_count) ? '<p>' + esc(number(coverage.evidence_count, 0)) + ' scored inputs</p>' : '') +
        '</div>';
    }).join("") + '</div>';
  }

  function priorityHtml(model) {
    if (!model.ladder.length) return "";
    return '<div class="psr-priority-ladder">' + model.ladder.map((item, index) => {
      const row = obj(item);
      return '<div class="psr-priority-row"><span>0' + (index + 1) + '</span><div><p class="psr-label">' +
        esc(row.priority || "Priority") + '</p><h3>' + esc(row.focus || "Measured focus") + '</h3></div>' +
        '<strong>' + esc(finite(row.severity) ? number(row.severity, 1) : "—") + '</strong></div>';
    }).join("") + '</div>';
  }

  function actionsHtml(model) {
    if (!model.actions.length) return "";
    return '<ol class="psr-actions">' + model.actions.map((action) => '<li>' + esc(action) + '</li>').join("") + '</ol>';
  }

  function remediesHtml(model) {
    if (!model.remedies.length) return '<p class="psr-muted">No structured remedy paths were returned.</p>';
    return '<div class="psr-remedy-grid">' + model.remedies.slice(0, 3).map((item, index) => {
      const path = obj(item);
      return '<article class="psr-remedy"><div class="psr-remedy-head"><span>0' + (index + 1) + '</span><div>' +
        '<p class="psr-label">' + esc(path.kicker || "Candidate path") + '</p><h3>' + esc(path.label || "Path") + '</h3></div></div>' +
        (path.summary ? '<p>' + esc(path.summary) + '</p>' : '') +
        (arr(path.actions).length ? '<div class="psr-remedy-actions"><p class="psr-label">Engine-generated action</p><ul>' +
          arr(path.actions).map((action) => '<li>' + esc(action) + '</li>').join("") + '</ul></div>' : '') +
        '<div class="psr-remedy-outcomes">' +
          (path.benefit ? '<div><p class="psr-label">Potential benefit</p><p>' + esc(path.benefit) + '</p></div>' : '') +
          (path.risk ? '<div><p class="psr-label">Tradeoff</p><p>' + esc(path.risk) + '</p></div>' : '') +
        '</div></article>';
    }).join("") + '</div>';
  }

  function evidenceHtml(model) {
    const participant = model.evidence.length
      ? '<div class="psr-evidence-list">' + model.evidence.map((item) => {
          const row = obj(item);
          return '<article><p class="psr-label">' + esc(first(row.participant_mode, row.perspective, "Participant evidence")) + '</p>' +
            '<p>' + esc(first(row.text, row.message, row.summary)) + '</p></article>';
        }).join("") + '</div>'
      : '<div class="psr-empty-evidence"><p class="psr-label">Participant evidence</p>' +
        '<h3>No participant notes were supplied for this representative run.</h3>' +
        '<p>The engine therefore returned no participant statements. No quotations or experiential claims have been added to this sample.</p></div>';
    const watch = model.watch.length
      ? '<div><p class="psr-label">What to watch next</p><ul class="psr-plain-list">' + model.watch.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>'
      : '';
    return '<div class="psr-evidence-grid">' + participant + watch + '</div>';
  }

  function basisHtml(model, artifact) {
    const modelData = obj(model.exposure.model);
    const measured = finite(model.coverage.measured_dimension_count) ? number(model.coverage.measured_dimension_count, 0) : "—";
    const total = finite(model.coverage.total_dimension_count) ? number(model.coverage.total_dimension_count, 0) : "—";
    const rows = [
      ["Engine revision", artifact.engine_commit],
      ["Artifact digest", artifact.artifact_sha256],
      ["Generation mode", artifact.generation_mode],
      ["Evidence depth", model.evidenceBand],
      ["Measured dimensions", measured + " of " + total],
      ["Input depth", first(model.result.input_confidence_label, model.context.confidenceLevel)],
      ["Participant perspective", model.participantMode],
      ["Trajectory", model.trajectoryLabel]
    ];
    return '<dl class="psr-basis">' + rows.map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value || "—") + '</dd></div>').join("") + '</dl>' +
      (model.trajectoryNote ? '<div class="psr-limit"><p class="psr-label">Trajectory limit</p><p>' + esc(model.trajectoryNote) + '</p></div>' : '') +
      (modelData.note ? '<div class="psr-limit"><p class="psr-label">Exposure-model limit</p><p>' + esc(modelData.note) + '</p></div>' : '') +
      '<div class="psr-boundary"><span></span><div><p class="psr-label">Interpretation boundary</p>' +
      '<p>This is one illustrative, engine-generated Diagnostic run in one bounded scope. It supports a directional operating read and an action hypothesis; it does not establish prevalence, population representativeness, causation, or verified returned capacity.</p></div></div>';
  }

  function reportHtml(model, artifact, sourceKey) {
    const e = model.exposure;
    const context = model.context;
    const modelData = obj(e.model);
    const participantDetail = model.participantMode + ' perspective · ' + number(model.depth.participant_count || 1, 0) + ' completed run';
    const provenance = 'API ' + artifact.engine_commit.slice(0, 8) + ' · artifact ' + artifact.artifact_sha256.slice(0, 12);

    return '<div class="psr-wrap" data-engine-commit="' + esc(artifact.engine_commit) + '" data-artifact-sha256="' + esc(artifact.artifact_sha256) + '" data-source-key="' + esc(sourceKey) + '">' +
      '<div class="psr-toolbar" aria-label="Sample report controls"><div><strong>Production-contract sample</strong><span>' + esc(provenance) + '</span></div>' +
      '<div class="psr-toolbar-actions"><button type="button" data-action="json">Download representative JSON</button><button type="button" data-action="print">Print or save PDF</button></div></div>' +
      '<article class="psr-report">' +
        '<header class="psr-cover"><div class="psr-cover-top"><div><p class="psr-mast">Monderman · ' + esc(model.tool) + '</p>' +
          '<h1>' + esc(model.tool) + '<br>Executive Report</h1><p class="psr-cover-sub">Production-engine-generated representative output</p></div>' +
          '<div class="psr-score"><span>Diagnostic Score</span><strong>' + esc(number(model.result.score, 1)) + '</strong><em>' + esc(model.result.score_band || "—") + '</em></div></div>' +
          '<div class="psr-cover-meta"><span>' + esc(model.process) + '</span><span>' + esc(model.functionName) + '</span><span>' + esc(participantDetail) + '</span></div>' +
          '<div class="psr-cover-read"><p class="psr-eyebrow">Executive headline</p><h2>' + esc(model.headline) + '</h2><p>' + esc(model.body) + '</p></div>' +
          '<div class="psr-proof">Illustrative sample data · no customer data · no invented participant statements · ' + esc(provenance) + '</div>' +
        '</header>' +

        '<section class="psr-section">' + sectionHeading("01", "Executive condition", "What this run returned", model.result.score_band_note) +
          '<div class="psr-metrics">' +
            metric("Measured condition", number(model.result.score, 1) + " · " + (model.result.score_band || "—"), model.result.benchmark_position || "") +
            metric("Observed annual burden", finite(e.annual_hours) ? number(e.annual_hours, 0) + " hours" : "Not priceable", finite(e.annual_cost) ? money(e.annual_cost) + " directional labor exposure" : "") +
            metric("Capacity equivalent", percent(e.capacity_drag_percent), finite(e.total_capacity_hours) ? number(e.total_capacity_hours, 0) + " disclosed annual capacity hours" : "") +
            metric("Primary measured focus", model.primary || "—", model.descriptor.dominant_burden_note || "") +
          '</div>' +
          (model.opportunity ? '<div class="psr-callout"><p class="psr-label">Engine-generated opportunity read</p><p>' + esc(model.opportunity) + '</p></div>' : '') +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("02", "Dimension profile", "The scored condition, dimension by dimension", "Every value below comes from the current production scorer for this representative run.") +
          dimensionsHtml(model) +
          (model.findings.length ? '<div class="psr-findings"><p class="psr-label">Scorer findings</p><ul class="psr-plain-list">' + model.findings.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div>' : '') +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("03", "Observed burden", "How the disclosed scenario becomes exposure", "The model keeps the supplied workload assumptions, modeled burden, labor exposure, and capacity equivalent visibly separate.") +
          '<div class="psr-exposure-flow">' +
            metric("Disclosed workload", number(context.peopleInvolved || context.people_involved, 0) + " people", number(context.annualCycles || context.annual_cycles, 0) + " annual cycles · " + number(context.meetingHours || context.meeting_hours, 0) + " hours per run") +
            metric("Attributed burden", number(e.annual_hours, 0) + " hours", first(modelData.formula, "Directional scenario")) +
            metric("Labor exposure", money(e.annual_cost), money(e.hourly_cost || context.hourlyCost) + " loaded hourly cost") +
            metric("Potentially reclaimable", money(e.recoverable_cost), percent(e.recoverable_share_percent) + " modeled share") +
          '</div>' +
          (modelData.note ? '<p class="psr-model-note">' + esc(modelData.note) + '</p>' : '') +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("04", "Governance and capacity", "What leadership should—and should not—take from the read", model.tradeoff) +
          '<div class="psr-two-column">' +
            (model.quadrant ? '<div><p class="psr-label">Governance × execution interpretation</p><p>' + esc(model.quadrant) + '</p></div>' : '') +
            '<div><p class="psr-label">Design-reference context</p><p>' + esc(model.benchmark) + '</p></div>' +
          '</div>' +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("05", "Evidence status", "What evidence is—and is not—in this run", "Participant evidence is reported separately from scored inputs and never reweights the Diagnostic Score.") +
          evidenceHtml(model) +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("06", "Action ladder", "Priorities and remedy paths returned by the engine", "The priority ladder identifies what to address first. The three remedy paths show increasing intervention depth without changing the measured result.") +
          priorityHtml(model) + actionsHtml(model) + remediesHtml(model) +
        '</section>' +

        '<section class="psr-section">' + sectionHeading("07", "Method and limits", "Basis of this read", "The provenance below ties this public sample to the exact current API source revision used to generate it.") +
          basisHtml(model, artifact) +
        '</section>' +
      '</article>' +
    '</div>';
  }

  function wireReport(shell, model, artifact, sourceKey) {
    shell.innerHTML = reportHtml(model, artifact, sourceKey);
    const jsonButton = $('[data-action="json"]', shell);
    const printButton = $('[data-action="print"]', shell);
    if (jsonButton) jsonButton.addEventListener("click", () => downloadJson({
      contract: artifact.contract,
      engine_commit: artifact.engine_commit,
      artifact_sha256: artifact.artifact_sha256,
      generation_mode: artifact.generation_mode,
      input_context: model.context,
      result: model.result
    }, "monderman-" + sourceKey.replace(/_/g, "-") + "-representative-result.json"));
    if (printButton) printButton.addEventListener("click", () => window.print());
  }

  function showFailure(error) {
    Object.keys(REPORT_KEYS).forEach((tabKey) => {
      const shell = document.getElementById("report-" + tabKey);
      if (!shell) return;
      shell.innerHTML = '<div class="psr-load-error" role="alert"><strong>Production sample artifact could not be loaded.</strong><p>' + esc(error && error.message ? error.message : error) + '</p></div>';
    });
    document.body.classList.add("production-samples-ready");
  }

  async function render() {
    try {
      const response = await fetch(ARTIFACT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Artifact request failed with status " + response.status);
      const artifact = await response.json();
      if (artifact.contract !== "monderman-public-diagnostic-sample-output/v1") throw new Error("Unexpected sample artifact contract");
      if (!/^[a-f0-9]{40}$/.test(artifact.engine_commit || "")) throw new Error("Missing engine revision provenance");
      if (!/^[a-f0-9]{64}$/.test(artifact.artifact_sha256 || "")) throw new Error("Missing artifact digest");
      Object.entries(REPORT_KEYS).forEach(([tabKey, sourceKey]) => {
        const source = obj(obj(artifact.outputs)[sourceKey]);
        if (!obj(source.result).tool_type) throw new Error("Missing production output for " + sourceKey);
        const shell = document.getElementById("report-" + tabKey);
        if (!shell) throw new Error("Missing report shell for " + tabKey);
        wireReport(shell, makeModel(source), artifact, sourceKey);
      });
      document.body.classList.add("production-samples-ready");
      document.dispatchEvent(new CustomEvent("monderman:production-samples-ready", { detail: {
        engineCommit: artifact.engine_commit,
        artifactSha256: artifact.artifact_sha256
      }}));
    } catch (error) {
      console.error("Production sample rendering failed", error);
      showFailure(error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();
