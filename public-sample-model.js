(function () {
  "use strict";
  const CONTRACT = "monderman-public-product-samples/v3";
  const PRODUCTS = {
    os: "operational_systems", dv: "decision_velocity", sc: "structural_clarity",
    ip: "institutional_performance", depth: "depth_synthesis", synthesis: "cross_lens_synthesis"
  };
  const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  function isComparison(entry) { return entry.kind === "response_comparison"; }
  function validateComparison(entry, key) {
    const r = object(entry.source), p = object(entry.provenance), c = object(r.campaign_evidence);
    const group = (r.source_groups || [])[0], lenses = object(c.depth).lenses || [];
    if (r.report_kind !== "response_comparison" || r.synthesis_product !== "depth_synthesis" ||
        p.sample_lens !== key || r.source_groups?.length !== 1 || group?.tool_type !== key ||
        lenses.length !== 1 || lenses[0].lens !== key) throw new Error("Sample comparison lens differs: " + key);
    if (!Number.isSafeInteger(r.participant_count) || r.participant_count < 2 ||
        r.participant_count !== p.distinct_included_participants || r.participant_count !== group.participants ||
        r.submitted_run_count !== r.participant_count || group.submitted_runs !== r.participant_count ||
        !Number.isSafeInteger(p.declared_eligible_population) || p.declared_eligible_population <= r.participant_count) {
      throw new Error("Sample comparison participant counts differ: " + key);
    }
    if (c.depth?.status !== "in_progress" || lenses[0].status !== "in_progress" ||
        lenses[0].descriptiveReadAvailable !== true || c.recommendedPath?.status !== "in_progress" || c.crossLens?.status !== "in_progress" ||
        r.recommended_path_available !== false || (r.campaign_action_options || []).length ||
        r.financial_scenario != null || p.operating_review_source !== "not_supplied") {
      throw new Error("Sample comparison must remain below Synthesis readiness: " + key);
    }
    const i = object(object(object(r.ai_report).report).interpretation);
    if ((i.action_options || []).length || i.recommended_option != null) throw new Error("Sample comparison cannot claim a recommended change path: " + key);
    const groups = lenses[0].requiredGroups || [], modes = object(group.participant_mode_counts);
    if (c.privacyPolicy?.minimumDisplayedGroupSize!==5 || groups.length !== 3 || groups.some(g=>!Number.isSafeInteger(g.participants)||g.participants<5||g.privacy?.minimumDisplayedGroupSize!==5||g.privacy?.mayDisplayGroupStatistics!==true) ||
        groups.reduce((sum,g)=>sum+g.participants,0)!==r.participant_count ||
        Object.keys(modes).sort().join(',') !== 'managerial,operational,senior_leader' ||
        Object.values(modes).some(n=>!Number.isSafeInteger(n)||n<5) || Object.values(modes).reduce((a,b)=>a+b,0)!==r.participant_count) {
      throw new Error("Sample comparison role disclosure boundary differs: " + key);
    }
    const notes = r.experiential_records || [], selection = object(r.experiential_selection);
    if (!Array.isArray(notes) || notes.length>12 || selection.incorporated!==notes.length ||
        notes.some(note=>note.lens!==key || !Object.hasOwn(modes,note.role)) ||
        new Set(notes.map(note=>note.id)).size!==notes.length ||
        selection.exhaustive!==(selection.available===notes.length) ||
        selection.available!==r.participant_count || selection.method!=='bounded_role_and_lens_rotation') {
      throw new Error("Sample comparison observation selection differs: " + key);
    }
    function financialNumber(value, field) {
      if (typeof value==='number') return !['total_runs','runs'].includes(field);
      return value && typeof value==='object' && Object.entries(value).some(([k,v])=>financialNumber(v,k));
    }
    for (const exposure of [r.pathway_exposure,r.compounded_exposure]) {
      if (exposure?.status!=='withheld' || exposure.priceable!==false || financialNumber(exposure,'')) throw new Error("Sample comparison financial values must remain withheld: "+key);
    }
    const financial = object(r.financial_benefit_assessment);
    if (financial.coverage?.complete!==false || (financial.coverage?.estimatedCategories||[]).length ||
        Object.values(financial.categories||{}).some(v=>v.status!=='not_estimated')) throw new Error("Sample comparison cannot contain a financial assessment: "+key);
  }
  function generationProvenance(entry) {
    const p = object(entry.provenance), source = object(entry.source);
    const result = entry.kind === "diagnostic" && object(source.result).tool_type ? source.result : source;
    const report = object(object(result.ai_report).report);
    if (typeof p.engine_commit !== "string" || !/^[a-f0-9]{40}$/.test(p.engine_commit)) throw new Error("Sample generation commit is missing or malformed");
    if (typeof report.version !== "string" || !report.version || p.report_ai_release !== report.version) throw new Error("Sample AI release provenance differs from the report");
    if (typeof report.prompt_version !== "string" || !report.prompt_version || p.report_ai_prompt_version !== report.prompt_version) throw new Error("Sample AI prompt provenance differs from the report");
    return p;
  }

  function validate(artifact) {
    if (object(artifact).contract !== CONTRACT || artifact.synthetic !== true) throw new Error("Unexpected public sample contract");
    if (!sha256(artifact.artifact_sha256)) throw new Error("Sample artifact reference is missing");
    const projection = object(artifact.publication_projection);
    const projectionVersions = ['monderman-public-sample-projection-20260913.7', 'monderman-public-sample-projection-20260924.8'];
    if (!projectionVersions.includes(projection.version) || Object.keys(projection).sort().join(',') !== 'projection_commit,source_sha256,version' || !sha256(projection.source_sha256) || !/^[a-f0-9]{40}$/.test(projection.projection_commit || '') ||
        (projection.version === projectionVersions[1] && projection.projection_commit !== artifact.engine_commit)) throw new Error("Sample publication version is missing or differs from generation");
    const outputs = object(artifact.outputs);
    for (const [tab, key] of Object.entries(PRODUCTS)) {
      const entry = object(outputs[key]), source = object(entry.source), p = object(entry.provenance);
      const synthesis = tab === "depth" || tab === "synthesis";
      const comparison = !synthesis && isComparison(entry);
      if (entry.kind !== (synthesis ? "synthesis" : "diagnostic") && !comparison) throw new Error("Sample product is missing: " + key);
      const result = !synthesis && !comparison && object(source.result).tool_type ? source.result : source;
      if ((!synthesis && !comparison && result.tool_type !== key) || (synthesis && result.synthesis_product !== key)) throw new Error("Sample product identity differs: " + key);
      if (comparison) validateComparison(entry, key);
      if (p.synthetic !== true || !Number.isFinite(Date.parse(p.generated_at))) throw new Error("Sample origin is not recorded: " + key);
      if (!sha256(p.input_sha256) || !sha256(p.result_sha256) || !sha256(p.approved_output_sha256)) throw new Error("Sample evidence references are missing: " + key);
      const ai = object(result.ai_report), report = object(ai.report);
      if (ai.status !== "complete" || !object(report.interpretation).summary || !(report.model || report.customer_metadata_version === 'customer-report-metadata-20260915.1') || !report.generated_at) throw new Error("Reviewed sample interpretation is unavailable: " + key);
      generationProvenance(entry);
    }
    return artifact;
  }

  function model(entry, artifact) {
    const Report = window.MondermanReport;
    if (!Report) throw new Error("Shared report display is unavailable");
    const p = generationProvenance(entry);
    const result = entry.kind === "synthesis" || isComparison(entry) ? Report.fromSynthesis(entry.source) : Report.fromRun(entry.source);
    const created = new Date(p.generated_at).toLocaleDateString("en-US", {year:"numeric", month:"long", day:"numeric", timeZone:"UTC"});
    result.meta = [{label:"Sample created", value:created},
      ...result.meta.filter(row => !['Generated','Recorded','Engine revision'].includes(row.label))];
    result.provenance = {...object(result.provenance), engine_commit:p.engine_commit};
    result.sampleProvenance = {
      synthetic:true, generated_at:p.generated_at, rendered_at:new Date().toISOString(), engine_commit:p.engine_commit,
      artifact_sha256:artifact.artifact_sha256, input_digest:p.input_sha256, result_digest:p.result_sha256,
      questionnaire_version:p.questionnaire_version || Object.entries(p.questionnaire_versions || {}).map(([key,value])=>key.replace(/_/g,' ')+': '+value).join('; '),
      scorer_version:p.scorer_version || Object.entries(p.scorer_versions || {}).map(([key,value])=>key.replace(/_/g,' ')+': '+value).join('; ') || (entry.source.source_groups || []).filter(group=>group.scorer_versions?.length).map(group=>group.tool_label+': '+group.scorer_versions.join(', ')).join('; '),
      report_language_version:p.report_language_version, report_ai_release:p.report_ai_release, report_ai_prompt_version:p.report_ai_prompt_version,
      approved_output_sha256:p.approved_output_sha256
    };
    return result;
  }

  window.MondermanPublicSamples = { contract:CONTRACT, products:PRODUCTS, validate, validateComparison, model };
})();
