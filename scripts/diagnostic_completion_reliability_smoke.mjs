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
  const background = finalize.indexOf("void (async () => { try {");

  assert(finalizeStart >= 0 && finalizeEnd > finalizeStart, `${page}: finalize function missing or unbounded`);
  assert(startBegin >= 0 && startEnd > startBegin, `${page}: start function missing or unbounded`);
  assert.match(start, /response\.status === 402 && data\?\.error === "run_limit_reached"/, `${page}: exhausted self-run is not intercepted before question one`);
  assert.match(start, /showRunsExhausted\(\);\s*return;/s, `${page}: exhausted self-run does not route to the entitlement screen`);
  assert.match(finalize, /if \(state\.finalizeInFlight\) return;/, `${page}: duplicate-finalize guard missing`);
  assert.match(finalize, /state\.finalizeInFlight = true;/, `${page}: finalize guard is never acquired`);
  assert.match(finalize, /finally \{\s*clearTimeout\(slowFinalizeTimer\);\s*state\.finalizeInFlight = false;/s, `${page}: finalize guard is not released`);
  assert.match(finalize, /const slowFinalizeTimer = setTimeout\([\s\S]*?,\s*12000\);/, `${page}: bounded slow-progress timer missing`);
  assert.match(finalize, /Still finalizing safely\. Do not resubmit/, `${page}: bounded slow-progress copy missing`);
  assert.match(finalize, /const refinedExperienceLayer = rawExperienceLayer;/, `${page}: authoritative success still waits for optional refinement`);
  assert.doesNotMatch(finalize, /const refinedExperienceLayer = await refineExperientialLayerForOutput/, `${page}: optional refinement blocks authoritative rendering`);
  assert(background > 0 && background < render, `${page}: optional refinement is not nonblocking before result rendering`);
  assert.match(finalize, /const backgroundExperienceLayer = await refineExperientialLayerForOutput/, `${page}: delayed refinement path missing`);
  assert.match(finalize, /renderExperienceLayer\(payload\)/, `${page}: delayed refinement cannot update the visible report`);
  assert.match(finalize, /premium-pass save-back failed/, `${page}: nonfatal save-back failure path missing`);
  assert.match(finalize, /if \(!response\.ok\s*\|\|\s*!data\?\.ok\)/, `${page}: finalize HTTP failure handling missing`);
  assert.match(finalize, /const result = asObject\(data\.result\)/, `${page}: authoritative API result handling missing`);
  assert.match(finalize, /narrativePending/, `${page}: persisted-run narrative recovery missing`);
  assert.match(finalize, /retryFinalizeBtn/, `${page}: retry control missing`);
  assert.match(finalize, /Open saved result(?:s)? in Workspace/, `${page}: Workspace recovery route missing`);
  assert.match(source, /href="workspace-diagnostics\.html"/, `${page}: Workspace target missing`);
  assert.match(source, /Start over\? This clears all your answers/, `${page}: restart confirmation missing`);
}

for (const page of pages) validateCompletionContract(readFileSync(join(root, page), "utf8"), page);

const certified = readFileSync(join(root, pages[0]), "utf8");
const mutations = [
  ["preflight-run-limit", (s) => s.replace('response.status === 402 && data?.error === "run_limit_reached"', 'response.status === 418 && data?.error === "run_limit_reached"')],
  ["single-flight", (s) => s.replace("if (state.finalizeInFlight) return;", "")],
  ["bounded-wait", (s) => s.replace("const slowFinalizeTimer = setTimeout(() => {", "const slowFinalizeTimer = (() => {")],
  ["nonblocking-refinement", (s) => s.replace("const refinedExperienceLayer = rawExperienceLayer;", "const refinedExperienceLayer = await refineExperientialLayerForOutput(rawExperienceLayer);")],
  ["background-refinement", (s) => s.replace("void (async () => { try {", "try {")],
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
