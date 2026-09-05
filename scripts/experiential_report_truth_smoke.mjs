import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const reports = [
  "operational-systems.html",
  "decision-velocity.html",
  "structural-clarity.html",
  "institutional-performance.html",
];

const expectedPriority = /const experienceSynthesis = clean\(\s*\(hasExperienceLayer \? experienceLayer\?\.synthesis : ""\) \|\|\s*result\?\.narrative\?\.experiential_synthesis \|\|\s*experienceLayer\?\.synthesis \|\|/s;

for (const report of reports) {
  const source = await readFile(new URL(`../${report}`, import.meta.url), "utf8");
  assert.match(
    source,
    expectedPriority,
    `${report}: a report with participant-note cards must prefer the matching local experiential synthesis over narrative fallback text`,
  );
}

console.log(`EXPERIENTIAL_REPORT_TRUTH=PASS reports=${reports.length} cards_and_synthesis_share_source=true`);
