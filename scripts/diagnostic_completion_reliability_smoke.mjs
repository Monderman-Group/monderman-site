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
  assert.match(start, /response\.status === 429 && data\?\.error === "diagnostic_capacity_temporarily_reached"/, `${page}: temporary start-capacity response is not handled`);
  assert.match(start, /data\?\.retry_after_seconds \|\| response\.headers\.get\("Retry-After"\)/, `${page}: capacity response does not honor the server retry interval`);
  assert.match(start, /Your run has not started and no work was lost/, `${page}: capacity message does not state the safe outcome`);
  assert.match(start, /showStage\(introStage\);[\s\S]*?return;/, `${page}: capacity response does not return safely to preflight`);
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

  // Progress describes work on supplied answers, not verified outcomes or
  // financial recovery that a single-run report deliberately withholds.
  const progress = source.match(/<div class="stage" id="processingStage">([\s\S]*?)<!--/);
  assert(progress, `${page}: processing display missing`);
  assert.match(progress[1], /<h3>Preparing your results<\/h3>/, `${page}: plain progress heading missing`);
  assert.match(progress[1], /Your answers are being scored and checked for your report\./, `${page}: progress status overstates its work`);
  assert.match(progress[1], /We are calculating your score, checking how your answers fit together, and preparing your report\./, `${page}: plain progress explanation missing`);
  assert.deepEqual([...progress[1].matchAll(/class="processing-item"><span class="pulse"><\/span><span>([^<]+)<\/span>/g)].map(m => m[1]), [
    "Calculating your diagnostic score",
    "Checking how your answers fit together",
    "Preparing the written summary",
    "Preparing your report",
  ], `${page}: progress stages imply unavailable outputs`);
  const progressStart = source.indexOf("function setProcessingStep(");
  const progressEnd = source.indexOf("\nfunction readHubContext(", progressStart);
  assert(progressStart >= 0 && progressEnd > progressStart, `${page}: dynamic progress display missing`);
  const displayedProgress = progress[1] + source.slice(progressStart, progressEnd)
    + [...finalize.matchAll(/setProcessingStep\([^;]+;/g)].map(m => m[0]).join("\n");
  assert.doesNotMatch(displayedProgress, /estimating|financial|recovery|capacity impact|bypass|interpretive|quantitative|output sequence|structured output|diagnostic narrative|experiential|report-safe|report modules/i, `${page}: unavailable estimate or internal jargon in progress`);
}

for (const page of pages) validateCompletionContract(readFileSync(join(root, page), "utf8"), page);

const certified = readFileSync(join(root, pages[0]), "utf8");
const mutations = [
  ["preflight-run-limit", (s) => s.replace('response.status === 402 && data?.error === "run_limit_reached"', 'response.status === 418 && data?.error === "run_limit_reached"')],
  ["start-capacity", (s) => s.replace('response.status === 429 && data?.error === "diagnostic_capacity_temporarily_reached"', 'response.status === 429 && data?.error === "generic_failure"')],
  ["start-capacity-retry", (s) => s.replace('data?.retry_after_seconds || response.headers.get("Retry-After")', '60')],
  ["single-flight", (s) => s.replace("if (state.finalizeInFlight) return;", "")],
  ["bounded-wait", (s) => s.replace("const slowFinalizeTimer = setTimeout(() => {", "const slowFinalizeTimer = (() => {")],
  ["evidence-boundary", (s) => s.replace("const refinedExperienceLayer = safeExperienceLayerForReport(rawExperienceLayer);", "const refinedExperienceLayer = rawExperienceLayer;")],
  ["blocking-refinement", (s) => s.replace("const refinedExperienceLayer = safeExperienceLayerForReport(rawExperienceLayer);", "const refinedExperienceLayer = await refineExperientialLayerForOutput(rawExperienceLayer);")],
  ["client-report-saveback", (s) => s.replace("// prose save-back is disabled for the bounded pilot.", "fetch(`${API}/api/runs/refined-experience`); // prose save-back is disabled for the bounded pilot.")],
  ["saved-run-recovery", (s) => s.replaceAll("Open saved results in Workspace", "Saved result unavailable")],
  ["response-contract", (s) => s.replaceAll("if (!response.ok || !data?.ok)", "if (!data?.ok)")],
  ["guard-cleanup", (s) => s.replace("state.finalizeInFlight = false;", "")],
  ["progress-financial-promise", (s) => s.replace("Preparing the written summary", "Estimating rough time, cost, and capacity impact")],
  ["progress-jargon", (s) => s.replace("Checking how your answers fit together", "Checking structured contradictions and interpretive bypass signals")],
  ["dynamic-progress-promise", (s) => s.replace("Preparing your charts and report...", "Estimating financial recovery...")],
  ["dynamic-progress-jargon", (s) => s.replace("Checking added notes for inclusion in your report...", "Screening experiential notes for report-safe presentation...")],
  ["missing-progress-stage", (s) => s.replace('<div class="processing-item"><span class="pulse"></span><span>Preparing the written summary</span></div>', "")],
];

for (const [name, mutate] of mutations) {
  const regressed = mutate(certified);
  assert.notEqual(regressed, certified, `negative fixture mutation did not apply: ${name}`);
  assert.throws(() => validateCompletionContract(regressed, `negative:${name}`), undefined,
    `deliberately regressed ${name} fixture unexpectedly passed`);
}

console.log(`Diagnostic completion reliability contract passed for ${pages.length} Diagnostics; ${mutations.length} deliberate regressions were rejected.`);
