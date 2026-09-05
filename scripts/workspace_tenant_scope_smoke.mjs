import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const diagnostics = read("workspace-diagnostics.html");
const analysis = read("workspace-analysis.html");
const actions = read("workspace-actions.html");
const synthesisReport = read("cross-tool-synthesis.html");
const assistant = read("workspace-assistant.js");

assert.doesNotMatch(diagnostics, /\.from\("diagnostic_runs"\)/);
assert.match(diagnostics, /\/api\/normalization\/workspace-runs\/\$\{encodeURIComponent\(state\.orgId\)\}/);
assert.match(diagnostics, /\/api\/runs\/\$\{encodeURIComponent\(id\)\}\/status/);
assert.match(diagnostics, /"X-Monderman-Organization-Id":state\.orgId/);
assert.match(diagnostics, /onConflict:"user_id,organization_id"/);
assert.match(diagnostics, /from\("campaign_drafts"\)[\s\S]{0,180}\.eq\("user_id", state\.userId\)\.eq\("organization_id", state\.orgId\)\.maybeSingle\(\)/);
assert.match(diagnostics, /from\("campaign_drafts"\)\.delete\(\)\.eq\("user_id", state\.userId\)\.eq\("organization_id", state\.orgId\)/);

assert.doesNotMatch(analysis, /\.from\("(?:diagnostic_runs|synthesis_runs)"\)/);
assert.match(analysis, /fetchWorkspaceRuns\(ws5OrgId\)/);
assert.ok((analysis.match(/"X-Monderman-Organization-Id"/g) || []).length >= 3, "Analysis API calls must identify the active Workspace");

assert.match(actions, /function apiAuthHeaders[\s\S]{0,450}"X-Monderman-Organization-Id"/);
assert.doesNotMatch(actions, /\.from\("(?:diagnostic_runs|synthesis_runs)"\)/);
assert.match(actions, /\/api\/normalization\/workspace-runs\/\$\{encodeURIComponent\(state\.orgId\)\}/);
assert.match(actions, /full\.interpretive_prose\?\.priority_actions/, "Action Plans imports post-narrative Diagnostic actions");

assert.match(synthesisReport, /"X-Monderman-Organization-Id":organizationId/);
assert.doesNotMatch(synthesisReport, /\.from\("synthesis_runs"\)/);
assert.match(synthesisReport, /\/api\/synthesis-runs\/\$\{encodeURIComponent\(id\)\}/);

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
