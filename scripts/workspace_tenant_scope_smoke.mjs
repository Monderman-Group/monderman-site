import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const diagnostics = read("workspace-diagnostics.html");
const analysis = read("workspace-analysis.html");
const actions = read("workspace-actions.html");
const synthesisReport = read("cross-tool-synthesis.html");
const assistant = read("workspace-assistant.js");

assert.match(diagnostics, /from\("diagnostic_runs"\)[\s\S]{0,600}\.eq\("organization_id", state\.orgId\)[\s\S]{0,200}\.order\("created_at"/);
assert.match(diagnostics, /update\(\{ status \}\)\.eq\("organization_id", state\.orgId\)\.eq\("id", id\)/);
assert.match(diagnostics, /select\("full_result_json"\)\.eq\("organization_id", state\.orgId\)\.eq\("id", id\)/);
assert.match(diagnostics, /select\("full_result_json, tool_type,[\s\S]{0,260}\.eq\("organization_id", state\.orgId\)\.eq\("id", runId\)/);
assert.match(diagnostics, /onConflict:"user_id,organization_id"/);
assert.match(diagnostics, /from\("campaign_drafts"\)[\s\S]{0,180}\.eq\("user_id", state\.userId\)\.eq\("organization_id", state\.orgId\)\.maybeSingle\(\)/);
assert.match(diagnostics, /from\("campaign_drafts"\)\.delete\(\)\.eq\("user_id", state\.userId\)\.eq\("organization_id", state\.orgId\)/);

assert.match(analysis, /from\("diagnostic_runs"\)[\s\S]{0,600}\.eq\("organization_id",ws5OrgId\)[\s\S]{0,120}\.eq\("status","promoted"\)/);
assert.match(analysis, /select\("id, config_version, scorer_version"\)\.eq\("organization_id",ws5OrgId\)\.in\("id", runIds\)/);
assert.ok((analysis.match(/"X-Monderman-Organization-Id"/g) || []).length >= 3, "Analysis API calls must identify the active Workspace");

assert.match(actions, /function apiAuthHeaders[\s\S]{0,450}"X-Monderman-Organization-Id"/);
assert.match(actions, /from\("diagnostic_runs"\)[\s\S]{0,520}\.eq\("organization_id", state\.orgId\)/);

assert.match(synthesisReport, /"X-Monderman-Organization-Id":organizationId/);
assert.match(synthesisReport, /from\("synthesis_runs"\)[\s\S]{0,220}\.eq\("organization_id",organizationId\)\.eq\("id",id\)/);

assert.match(assistant, /function workspaceStorageKey\(\)/);
assert.match(assistant, /STORAGE_KEY \+ ":" \+ organizationId/);
assert.match(assistant, /"X-Monderman-Organization-Id": window\.__mondermanActiveOrganizationId/);

console.log(JSON.stringify({
  ok: true,
  measure_history_and_campaign_drafts: "workspace_scoped",
  analysis_inputs: "workspace_scoped",
  synthesis_history_and_reports: "workspace_scoped",
  action_imports: "workspace_scoped",
  assistant_context_and_history: "workspace_scoped"
}, null, 2));
console.log("Workspace tenant-scope browser contract passed.");
