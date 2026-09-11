(function () {
  "use strict";
  const CONTRACT = "monderman-public-product-samples/v3";
  const PRODUCTS = {
    os: "operational_systems", dv: "decision_velocity", sc: "structural_clarity",
    ip: "institutional_performance", depth: "depth_synthesis", synthesis: "cross_lens_synthesis"
  };
  const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

  function validate(artifact) {
    if (object(artifact).contract !== CONTRACT || artifact.synthetic !== true) throw new Error("Unexpected public sample contract");
    if (!sha256(artifact.artifact_sha256)) throw new Error("Sample artifact reference is missing");
    const projection = object(artifact.publication_projection);
    if (projection.version !== 'monderman-public-sample-projection-20260911.3' || !sha256(projection.source_sha256) || !/^[a-f0-9]{40}$/.test(projection.projection_commit || '')) throw new Error("Sample publication version is missing");
    const outputs = object(artifact.outputs);
    for (const [tab, key] of Object.entries(PRODUCTS)) {
      const entry = object(outputs[key]), source = object(entry.source), p = object(entry.provenance);
      const synthesis = tab === "depth" || tab === "synthesis";
      if (entry.kind !== (synthesis ? "synthesis" : "diagnostic")) throw new Error("Sample product is missing: " + key);
      const result = !synthesis && object(source.result).tool_type ? source.result : source;
      if ((!synthesis && result.tool_type !== key) || (synthesis && result.synthesis_product !== key)) throw new Error("Sample product identity differs: " + key);
      if (p.synthetic !== true || !Number.isFinite(Date.parse(p.generated_at))) throw new Error("Sample origin is not recorded: " + key);
      if (!sha256(p.input_sha256) || !sha256(p.result_sha256) || !sha256(p.approved_output_sha256)) throw new Error("Sample evidence references are missing: " + key);
      const ai = object(result.ai_report), report = object(ai.report);
      if (ai.status !== "complete" || !object(report.interpretation).summary || !report.model || !report.generated_at) throw new Error("Reviewed sample interpretation is unavailable: " + key);
    }
    return artifact;
  }

  function model(entry, artifact) {
    const Report = window.MondermanReport;
    if (!Report) throw new Error("Shared report display is unavailable");
    const p = entry.provenance;
    const result = entry.kind === "synthesis" ? Report.fromSynthesis(entry.source) : Report.fromRun(entry.source);
    const created = new Date(p.generated_at).toLocaleDateString("en-US", {year:"numeric", month:"long", day:"numeric", timeZone:"UTC"});
    result.meta = [{label:"Sample created", value:created}, ...result.meta.filter(row => !['Generated','Recorded'].includes(row.label))];
    result.sampleProvenance = {
      synthetic:true, generated_at:p.generated_at, rendered_at:new Date().toISOString(), engine_commit:artifact.engine_commit,
      artifact_sha256:artifact.artifact_sha256, input_digest:p.input_sha256, result_digest:p.result_sha256,
      questionnaire_version:p.questionnaire_version || Object.entries(p.questionnaire_versions || {}).map(([key,value])=>key.replace(/_/g,' ')+': '+value).join('; '),
      scorer_version:p.scorer_version || Object.entries(p.scorer_versions || {}).map(([key,value])=>key.replace(/_/g,' ')+': '+value).join('; ') || (entry.source.source_groups || []).filter(group=>group.scorer_versions?.length).map(group=>group.tool_label+': '+group.scorer_versions.join(', ')).join('; '),
      report_language_version:p.report_language_version, report_ai_release:p.report_ai_release,
      approved_output_sha256:p.approved_output_sha256
    };
    return result;
  }

  window.MondermanPublicSamples = { contract:CONTRACT, products:PRODUCTS, validate, model };
})();
