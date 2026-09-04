import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const diagnostics = [
  "structural-clarity.html",
  "decision-velocity.html",
  "operational-systems.html",
  "institutional-performance.html"
];

for (const file of diagnostics) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, /const __org = window\.__mondermanActiveOrganizationId;/, `${file} must read the active Workspace selected by the access gate`);
  assert.match(source, /"X-Monderman-Organization-Id": __org/, `${file} must bind authenticated API calls to that Workspace`);
  assert.match(source, /Authorization: "Bearer " \+ __tok/, `${file} must send the selected Workspace only with authenticated calls`);
}

console.log(JSON.stringify({
  ok: true,
  diagnostics_checked: diagnostics.length,
  selected_workspace_header: "required_on_authenticated_api_calls"
}, null, 2));
console.log("Diagnostic Workspace-selection browser contract passed.");
