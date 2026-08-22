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

for (const page of pages) {
  const source = readFileSync(join(root, page), "utf8");
  const finalizeStart = source.indexOf("async function finalizeAdaptiveRun()");
  const render = source.indexOf("showStage(resultsStage);", finalizeStart);
  const background = source.indexOf("void (async () => { try {", finalizeStart);

  assert(finalizeStart >= 0, `${page}: finalize function missing`);
  assert.match(source, /if \(state\.finalizeInFlight\) return;/, `${page}: duplicate-finalize guard missing`);
  assert.match(source, /state\.finalizeInFlight = true;/, `${page}: finalize guard is never acquired`);
  assert.match(source, /finally \{\s*clearTimeout\(slowFinalizeTimer\);\s*state\.finalizeInFlight = false;/s, `${page}: finalize guard is not released`);
  assert.match(source, /Still finalizing safely\. Do not resubmit/, `${page}: bounded slow-progress copy missing`);
  assert.match(source, /const refinedExperienceLayer = rawExperienceLayer;/, `${page}: success still waits for optional refinement`);
  assert(background > finalizeStart && background < render, `${page}: optional refinement is not nonblocking`);
  assert.match(source, /const backgroundExperienceLayer = await refineExperientialLayerForOutput/, `${page}: delayed refinement path missing`);
  assert.match(source, /renderExperienceLayer\(payload\)/, `${page}: delayed refinement cannot update the visible report`);
  assert.match(source, /premium-pass save-back failed/, `${page}: nonfatal save-back failure path missing`);
  assert.match(source, /narrativePending/, `${page}: persisted-run narrative recovery missing`);
  assert.match(source, /retryFinalizeBtn/, `${page}: retry control missing`);
  assert.match(source, /Open saved result(?:s)? in Workspace/, `${page}: Workspace recovery route missing`);
  assert.match(source, /href="workspace-diagnostics\.html"/, `${page}: Workspace target missing`);
  assert.match(source, /Start over\? This clears all your answers/, `${page}: restart confirmation missing`);
}

console.log(`Diagnostic completion reliability contract passed for ${pages.length} Diagnostics.`);
