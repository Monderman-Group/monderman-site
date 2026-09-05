import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pages = [
  "structural-clarity.html",
  "decision-velocity.html",
  "operational-systems.html",
  "institutional-performance.html",
];

function validateCompletionContract(source, page = "fixture") {
  const startBegin = source.indexOf("async function startAdaptiveRun()");
  const startEnd = source.indexOf("\nfunction buildConfidenceQuestion()", startBegin);
  const start = startBegin >= 0 && startEnd > startBegin
    ? source.slice(startBegin, startEnd)
    : "";
  const finalizeStart = source.indexOf("async function finalizeAdaptiveRun()");
  const finalizeEnd = source.indexOf("\nfunction confirmRestart()", finalizeStart);
  const finalize = finalizeStart >= 0 && finalizeEnd > finalizeStart
    ? source.slice(finalizeStart, finalizeEnd)
    : "";
  const render = finalize.indexOf("showStage(resultsStage);");
  const evidenceBoundary = finalize.indexOf("const refinedExperienceLayer = safeExperienceLayerForReport(rawExperienceLayer);");

  assert(finalizeStart >= 0 && finalizeEnd > finalizeStart, `${page}: finalize function missing or unbounded`);
  assert(startBegin >= 0 && startEnd > startBegin, `${page}: start function missing or unbounded`);
  assert.match(start, /response\.status === 402 && data\?\.error === "run_limit_reached"/, `${page}: exhausted self-run is not intercepted before question one`);
  assert.match(start, /showRunsExhausted\(\);\s*return;/s, `${page}: exhausted self-run does not route to the entitlement screen`);
  assert.match(source, /Your existing results remain available in Workspace/, `${page}: exhausted-run copy does not preserve existing-result access`);
  assert.doesNotMatch(source, /this run is saved/, `${page}: exhausted preflight falsely claims an unstarted run was saved`);
  assert.match(finalize, /if \(state\.finalizeInFlight\) return;/, `${page}: duplicate-finalize guard missing`);
  assert.match(finalize, /state\.finalizeInFlight = true;/, `${page}: finalize guard is never acquired`);
  assert.match(finalize, /finally \{\s*clearTimeout\(slowFinalizeTimer\);\s*state\.finalizeInFlight = false;/s, `${page}: finalize guard is not released`);
  assert.match(finalize, /const slowFinalizeTimer = setTimeout\([\s\S]*?,\s*12000\);/, `${page}: bounded slow-progress timer missing`);
  assert.match(finalize, /Still finalizing safely\. Do not resubmit/, `${page}: bounded slow-progress copy missing`);
  assert.match(finalize, /const refinedExperienceLayer = safeExperienceLayerForReport\(rawExperienceLayer\);/, `${page}: authoritative result does not cross the deterministic evidence boundary`);
  assert(evidenceBoundary > 0 && evidenceBoundary < render, `${page}: evidence boundary does not run before result rendering`);
  assert.doesNotMatch(finalize, /const refinedExperienceLayer = await refineExperientialLayerForOutput/, `${page}: optional refinement blocks authoritative rendering`);
  assert.doesNotMatch(finalize, /backgroundExperienceLayer|premium-pass save-back|\/api\/runs\/refined-experience/, `${page}: client-authored refinement or save-back remains active`);
  assert.match(finalize, /if \(!response\.ok\s*\|\|\s*!data\?\.ok\)/, `${page}: finalize HTTP failure handling missing`);
  assert.match(finalize, /const result = asObject\(data\.result\)/, `${page}: authoritative API result handling missing`);
  assert.match(finalize, /narrativePending/, `${page}: persisted-run narrative recovery missing`);
  assert.match(finalize, /retryFinalizeBtn/, `${page}: retry control missing`);
  assert.match(finalize, /Open saved result(?:s)? in Workspace/, `${page}: Workspace recovery route missing`);
  if (page === "decision-velocity.html") {
    assert.match(finalize, /certification_narrative_failure[\s\S]*certificationNarrativeFailureInjected[\s\S]*certification_force_narrative_failure:\s*injectCertificationNarrativeFailure/, `${page}: one-shot synthetic narrative-assembly failure trigger missing`);
  }
  assert.match(source, /href="workspace-diagnostics\.html"/, `${page}: Workspace target missing`);
  assert.match(source, /Start over\? This clears all your answers/, `${page}: restart confirmation missing`);
}

for (const page of pages) validateCompletionContract(readFileSync(join(root, page), "utf8"), page);

const certified = readFileSync(join(root, pages[0]), "utf8");
const mutations = [
  ["preflight-run-limit", (s) => s.replace('response.status === 402 && data?.error === "run_limit_reached"', 'response.status === 418 && data?.error === "run_limit_reached"')],
  ["single-flight", (s) => s.replace("if (state.finalizeInFlight) return;", "")],
  ["bounded-wait", (s) => s.replace("const slowFinalizeTimer = setTimeout(() => {", "const slowFinalizeTimer = (() => {")],
  ["evidence-boundary", (s) => s.replace("const refinedExperienceLayer = safeExperienceLayerForReport(rawExperienceLayer);", "const refinedExperienceLayer = rawExperienceLayer;")],
  ["blocking-refinement", (s) => s.replace("const refinedExperienceLayer = safeExperienceLayerForReport(rawExperienceLayer);", "const refinedExperienceLayer = await refineExperientialLayerForOutput(rawExperienceLayer);")],
  ["client-report-saveback", (s) => s.replace("// prose save-back is disabled for the bounded pilot.", "fetch(`${API}/api/runs/refined-experience`); // prose save-back is disabled for the bounded pilot.")],
  ["saved-run-recovery", (s) => s.replaceAll("Open saved results in Workspace", "Saved result unavailable")],
  ["response-contract", (s) => s.replaceAll("if (!response.ok || !data?.ok)", "if (!data?.ok)")],
  ["guard-cleanup", (s) => s.replace("state.finalizeInFlight = false;", "")],
];

for (const [name, mutate] of mutations) {
  const regressed = mutate(certified);
  assert.notEqual(regressed, certified, `negative fixture mutation did not apply: ${name}`);
  assert.throws(() => validateCompletionContract(regressed, `negative:${name}`), undefined,
    `deliberately regressed ${name} fixture unexpectedly passed`);
}

console.log(`Diagnostic completion reliability contract passed for ${pages.length} Diagnostics; ${mutations.length} deliberate regressions were rejected.`);
