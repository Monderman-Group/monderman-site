from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return new_text

# ---------------------------------------------------------------------------
# Measure: review quality before an admin may Include a run.
# ---------------------------------------------------------------------------
measure_path = ROOT / "workspace-diagnostics.html"
measure = measure_path.read_text(encoding="utf-8")

api_anchor = '''    );\n\n    const PLAN_LABEL = { trial:"Trial", signal:"Signal", pattern:"Pattern", enterprise:"Enterprise", // legacy values kept so an old row still renders a name rather than a blank\n'''
api_replacement = '''    );\n    const API_BASE = "https://monderman-api.onrender.com";\n\n    const PLAN_LABEL = { trial:"Trial", signal:"Signal", pattern:"Pattern", enterprise:"Enterprise", // legacy values kept so an old row still renders a name rather than a blank\n'''
measure = replace_once(measure, api_anchor, api_replacement, "Measure API base")

quality_old = '''    function qualityPill(r){\n      const st=r.normalization_status||null;\n      if(st==="included") return `<span class="spill spill-promoted">Included</span>`;\n      if(st==="included_with_caution") return `<span class="spill spill-staged">Included with caution</span>`;\n      if(st==="excluded_from_aggregates"||r.included_in_aggregates===false) return `<span class="spill spill-archived">Excluded from aggregates</span>`;\n      return `<span class="spill">Not yet screened</span>`;\n    }\n'''
quality_new = '''    function qualityPill(r){\n      const st=r.normalization_status||null;\n      if(st==="included") return `<span class="spill spill-promoted">Reviewed</span>`;\n      if(st==="included_with_caution") return `<span class="spill spill-staged">Reviewed · caution</span>`;\n      if(st==="excluded_from_aggregates"||r.included_in_aggregates===false) return `<span class="spill spill-archived">Not eligible for analysis</span>`;\n      return `<span class="spill">Not yet reviewed</span>`;\n    }\n'''
measure = replace_once(measure, quality_old, quality_new, "Measure quality labels")

measure = replace_once(
    measure,
    'return `<button class="ract primary" data-act="promoted" data-id="${id}">Include in analysis</button><button class="ract danger" data-act="archived" data-id="${id}">Archive</button>`;',
    'return `<button class="ract primary" data-act="promoted" data-id="${id}">Review & include</button><button class="ract danger" data-act="archived" data-id="${id}">Archive</button>`;',
    "Measure review/include button",
)

status_old = '''    async function setStatus(id, status){\n      const run = state.runs.find(r=>r.id===id); if(!run) return;\n      const prev = run.status;\n      try{\n        const { error } = await supabase.from("diagnostic_runs").update({ status }).eq("id", id);\n        if(error) throw error;\n        run.status = status;\n        render();\n        const note = status==="promoted" ? "Included in analysis — this run is now eligible for Analysis and Synthesis."\n          : (prev==="promoted" && status==="staged") ? "Removed from analysis and returned to Staged."\n          : status==="archived" ? "Archived." : "Restored to staged.";\n        flash("ok", note);\n      }catch(e){\n        flash("bad", "Couldn’t update that run — including and archiving are admin-only. (" + (e.message||"error") + ")");\n      }\n    }\n'''
status_new = '''    const REVIEW_ELIGIBLE = new Set(["included", "included_with_caution"]);\n    async function reviewRunForInclusion(run){\n      const { data } = await supabase.auth.getSession();\n      const token = data?.session?.access_token;\n      if(!token) throw new Error("Your Workspace session has expired. Sign in again before reviewing this run.");\n      const response = await fetch(`${API_BASE}/api/normalization/normalize-run/${encodeURIComponent(run.id)}`, {\n        method:"POST",\n        headers:{ "Content-Type":"application/json", Authorization:"Bearer "+token },\n        body:"{}"\n      });\n      const payload = await response.json().catch(()=>({}));\n      if(!response.ok || payload.ok===false) throw new Error(payload.error || `Review failed (HTTP ${response.status})`);\n      const reviewed = payload.run || {};\n      const quality = reviewed.normalization_status || payload.normalization?.normalization_status || null;\n      const aggregateEligible = reviewed.included_in_aggregates ?? payload.normalization?.included_in_aggregates;\n      run.normalization_status = quality;\n      run.included_in_aggregates = aggregateEligible === true;\n      if(reviewed.normalization_score!==undefined) run.normalization_score=reviewed.normalization_score;\n      return REVIEW_ELIGIBLE.has(quality) && aggregateEligible === true;\n    }\n\n    async function setStatus(id, status){\n      const run = state.runs.find(r=>r.id===id); if(!run) return;\n      const prev = run.status;\n      try{\n        if(status==="promoted"){\n          const eligible = await reviewRunForInclusion(run);\n          if(!eligible){\n            render();\n            flash("bad", "Review complete — this run is not eligible for Analysis or Synthesis. It remains Staged.");\n            return;\n          }\n        }\n        const { error } = await supabase.from("diagnostic_runs").update({ status }).eq("id", id);\n        if(error) throw error;\n        run.status = status;\n        render();\n        const note = status==="promoted" ? "Reviewed and Included — this run is now eligible for Analysis and Synthesis."\n          : (prev==="promoted" && status==="staged") ? "Removed from analysis and returned to Staged."\n          : status==="archived" ? "Archived." : "Restored to staged.";\n        flash("ok", note);\n      }catch(e){\n        flash("bad", "Couldn’t update that run — " + (e.message||"please try again.") );\n      }\n    }\n'''
measure = replace_once(measure, status_old, status_new, "Measure review-before-Include flow")
measure_path.write_text(measure, encoding="utf-8")

# ---------------------------------------------------------------------------
# Analysis: load only Included + aggregate-eligible + reviewed sources.
# ---------------------------------------------------------------------------
analysis_path = ROOT / "workspace-analysis.html"
analysis = analysis_path.read_text(encoding="utf-8")
analysis_old = '''          const { data,error }=await supabase.from("diagnostic_runs")\n            .select("id, tool_type, tool_label, business_unit, pathway_name, participant_mode, diagnostic_depth, score, band, created_at, status, included_in_aggregates, label, is_anonymous_response, assignment_id, config_version, scorer_version")\n            .eq("status","promoted").order("created_at",{ascending:false}).range(from,to);\n          if(error) throw error;\n          const page=(data||[]).filter(run=>run.included_in_aggregates!==false);\n'''
analysis_new = '''          const { data,error }=await supabase.from("diagnostic_runs")\n            .select("id, tool_type, tool_label, business_unit, pathway_name, participant_mode, diagnostic_depth, score, band, created_at, status, normalization_status, included_in_aggregates, label, is_anonymous_response, assignment_id, config_version, scorer_version")\n            .eq("status","promoted")\n            .eq("included_in_aggregates",true)\n            .in("normalization_status",["included","included_with_caution"])\n            .order("created_at",{ascending:false}).range(from,to);\n          if(error) throw error;\n          const page=data||[];\n'''
analysis = replace_once(analysis, analysis_old, analysis_new, "Analysis strict Included query")
analysis_path.write_text(analysis, encoding="utf-8")

# ---------------------------------------------------------------------------
# Overview: never summarize a promoted row that was not reviewed/eligible.
# ---------------------------------------------------------------------------
overview_path = ROOT / "workspace.html"
overview = overview_path.read_text(encoding="utf-8")
overview = replace_once(
    overview,
    'function includedCandidates(runs){ return (runs||[]).filter(r=>r.status==="promoted" && r.included_in_aggregates!==false); }',
    'function includedCandidates(runs){ return (runs||[]).filter(r=>r.status==="promoted" && r.included_in_aggregates===true && ["included","included_with_caution"].includes(r.normalization_status)); }',
    "Overview strict Included helper",
)
overview_path.write_text(overview, encoding="utf-8")

# ---------------------------------------------------------------------------
# Action Plans: source picker may consume only the same eligible Included set.
# ---------------------------------------------------------------------------
actions_path = ROOT / "workspace-actions.html"
actions = actions_path.read_text(encoding="utf-8")
actions_pattern = r'''(async function loadPromotedRuns\(\)\{[\s\S]*?const \{ data, error \} = await supabase\.from\("diagnostic_runs"\)\s*\n\s*\.select\(")id, tool_type, tool_label, pathway_name, business_unit, created_at, priority_actions_json, key_findings_json, full_result_json, config_version, scorer_version("\)\s*\n\s*\.eq\("organization_id", state\.orgId\)\.eq\("status","promoted"\))'''
actions_replacement = r'''\1id, tool_type, tool_label, pathway_name, business_unit, created_at, priority_actions_json, key_findings_json, full_result_json, config_version, scorer_version, normalization_status, included_in_aggregates\2\n          .eq("included_in_aggregates",true).in("normalization_status",["included","included_with_caution"])'''
actions = sub_once(actions, actions_pattern, actions_replacement, "Action Plans strict Included query")
actions_path.write_text(actions, encoding="utf-8")

# ---------------------------------------------------------------------------
# Public direct JSON synthesis is a preview; full/saved work belongs in Analysis.
# ---------------------------------------------------------------------------
diagnostics_path = ROOT / "diagnostics.html"
diagnostics = diagnostics_path.read_text(encoding="utf-8")
cta_anchor = '''      const product = t.synthesis_product === "depth_synthesis" ? "Depth synthesis" : "Cross-lens synthesis";\n      const card = document.createElement("div");\n'''
cta_replacement = '''      const product = t.synthesis_product === "depth_synthesis" ? "Depth synthesis" : "Cross-lens synthesis";\n      const needsWorkspaceInclusion = outcome.reason === "workspace_inclusion_required";\n      const primaryHref = needsWorkspaceInclusion ? "workspace-analysis.html#synthesis" : "signin.html?next=diagnostics.html";\n      const primaryLabel = needsWorkspaceInclusion ? "Open Analysis" : "Sign in";\n      const card = document.createElement("div");\n'''
diagnostics = replace_once(diagnostics, cta_anchor, cta_replacement, "Direct upload preview CTA state")
diagnostics = replace_once(
    diagnostics,
    "          '<a class=\"btn btn-accent\" href=\"signin.html?next=diagnostics.html\">Sign in</a>' +\n",
    "          '<a class=\"btn btn-accent\" href=\"' + primaryHref + '\">' + primaryLabel + '</a>' +\n",
    "Direct upload preview primary CTA",
)
diagnostics_path.write_text(diagnostics, encoding="utf-8")

# ---------------------------------------------------------------------------
# Permanent frontend regression: encode the boundaries above.
# ---------------------------------------------------------------------------
validator_path = ROOT / "scripts" / "validate_meta_synthesis_frontend.py"
validator = validator_path.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    'WORKSPACE = (ROOT / "workspace-analysis.html").read_text(encoding="utf-8")\nDIAGNOSTICS = (ROOT / "diagnostics.html").read_text(encoding="utf-8")\nFULL_PAGE = (ROOT / "cross-tool-synthesis.html").read_text(encoding="utf-8")\n',
    'WORKSPACE = (ROOT / "workspace-analysis.html").read_text(encoding="utf-8")\nMEASURE = (ROOT / "workspace-diagnostics.html").read_text(encoding="utf-8")\nOVERVIEW = (ROOT / "workspace.html").read_text(encoding="utf-8")\nACTIONS = (ROOT / "workspace-actions.html").read_text(encoding="utf-8")\nDIAGNOSTICS = (ROOT / "diagnostics.html").read_text(encoding="utf-8")\nFULL_PAGE = (ROOT / "cross-tool-synthesis.html").read_text(encoding="utf-8")\n',
    "Validator source loading",
)

workspace_require_anchor = '''    'Build Cross-Lens Synthesis',\n):\n    require(WORKSPACE, token, "workspace-analysis.html")\n'''
workspace_require_replacement = '''    'Build Cross-Lens Synthesis',\n    '.eq("included_in_aggregates",true)',\n    '.in("normalization_status",["included","included_with_caution"])',\n):\n    require(WORKSPACE, token, "workspace-analysis.html")\n'''
validator = replace_once(validator, workspace_require_anchor, workspace_require_replacement, "Validator Analysis eligibility tokens")

insert_before_direct = '''# Direct-upload parity and body-size guard.\n'''
new_boundary_checks = '''# Inclusion boundary: Staged runs are reviewed before Include, and every downstream\n# Workspace surface consumes the same quality-eligible Included set.\nfor token in (\n    'Review & include',\n    '/api/normalization/normalize-run/',\n    'REVIEW_ELIGIBLE = new Set(["included", "included_with_caution"])',\n    'aggregateEligible === true',\n    'this run is not eligible for Analysis or Synthesis. It remains Staged.',\n):\n    require(MEASURE, token, "workspace-diagnostics.html")\n\nrequire(\n    OVERVIEW,\n    'r.status==="promoted" && r.included_in_aggregates===true && ["included","included_with_caution"].includes(r.normalization_status)',\n    "workspace.html Included helper",\n)\nfor token in (\n    '.eq("status","promoted")',\n    '.eq("included_in_aggregates",true)',\n    '.in("normalization_status",["included","included_with_caution"])',\n):\n    require(ACTIONS, token, "workspace-actions.html")\n\n# Direct-upload parity and body-size guard.\n'''
validator = replace_once(validator, insert_before_direct, new_boundary_checks, "Validator inclusion boundary block")

direct_anchor = '''    "t.pathway_exposure",\n):\n    require(DIAGNOSTICS, token, "diagnostics.html")\n'''
direct_replacement = '''    "t.pathway_exposure",\n    'outcome.reason === "workspace_inclusion_required"',\n    'workspace-analysis.html#synthesis',\n    '"Open Analysis"',\n):\n    require(DIAGNOSTICS, token, "diagnostics.html")\n'''
validator = replace_once(validator, direct_anchor, direct_replacement, "Validator direct preview CTA")

cleanliness_anchor = '''    ("workspace-analysis.html", WORKSPACE),\n    ("diagnostics.html", DIAGNOSTICS),\n'''
cleanliness_replacement = '''    ("workspace-analysis.html", WORKSPACE),\n    ("workspace-diagnostics.html", MEASURE),\n    ("workspace.html", OVERVIEW),\n    ("workspace-actions.html", ACTIONS),\n    ("diagnostics.html", DIAGNOSTICS),\n'''
validator = replace_once(validator, cleanliness_anchor, cleanliness_replacement, "Validator cleanliness surfaces")

inline_anchor = '''    "workspace-analysis.html": check_inline_scripts(ROOT / "workspace-analysis.html"),\n    "diagnostics.html": check_inline_scripts(ROOT / "diagnostics.html"),\n'''
inline_replacement = '''    "workspace-analysis.html": check_inline_scripts(ROOT / "workspace-analysis.html"),\n    "workspace-diagnostics.html": check_inline_scripts(ROOT / "workspace-diagnostics.html"),\n    "workspace.html": check_inline_scripts(ROOT / "workspace.html"),\n    "workspace-actions.html": check_inline_scripts(ROOT / "workspace-actions.html"),\n    "diagnostics.html": check_inline_scripts(ROOT / "diagnostics.html"),\n'''
validator = replace_once(validator, inline_anchor, inline_replacement, "Validator inline script surfaces")
validator_path.write_text(validator, encoding="utf-8")

print("Temporary site launch-blocker patch applied with all guards satisfied.")
