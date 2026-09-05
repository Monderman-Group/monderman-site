import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reports = [
  "decision-velocity.html",
  "structural-clarity.html",
  "operational-systems.html",
  "institutional-performance.html",
];

const rules = [
  ["predicted outcome", /\b(?:will|would)\s+(?:improve|reduce|increase|recover|produce|create|prevent|cause|accelerate|restore|reclaim|spread|widen|accumulate)\b/i],
  ["probabilistic mechanism", /(?:\b(?:likely|most likely)\b.{0,120}\b(?:require|spread|widen|accumulate|improve|consume|reclaim|respond|fail|sustain|understate|slow|need|depend|drag|fill)|\b(?:require|spread|widen|accumulate|improve|consume|reclaim|respond|fail|sustain|understate|slow|need|depend|drag|fill)\b.{0,120}\b(?:likely|most likely)\b)/i],
  ["realized loss or recovery", /\b(?:is|are|being|currently)\s+(?:consuming|consumed|borrowing|borrowed|recovering|recovered)\b|\b(?:hours|dollars|capacity|savings)\s+(?:recovered|realized)\b/i],
  ["causal or durability mechanism", /\b(?:held together by|durable rather than borrowed|borrowed performance|currently depends on|preserving output|accelerates? (?:the )?failure|the cause is|produces? (?:the )?(?:responsiveness|control benefit|performance)|sustains? output)\b/i],
  ["promised intervention effect", /\b(?:expect a real shift|usually responds|usually requires|usually indicates|high yield|conditions are actually improving|verify that drag is actually falling|shown to be paying off)\b/i],
  ["cross-organization generalization", /\b(?:what organizations in this sector often get wrong|organizations (?:commonly|often|typically)|companies (?:commonly|often|typically))\b/i],
  ["validated construct or prediction", /\b(?:validated organizational construct|predicts? (?:later|future) organizational performance|results? generalize across (?:organizations|industries))\b/i],
];

function firstUnsafeMatch(text, pattern) {
  const match = text.match(pattern);
  if (!match) return null;
  const prefix = text.slice(Math.max(0, Number(match.index || 0) - 140), Number(match.index || 0));
  if (/\b(?:(?:does not|do not|cannot|can't)\s+(?:by itself\s+)?(?:establish|show|demonstrate|prove|predict)|not (?:a )?(?:forecast|prediction|evidence|proof))\b/i.test(prefix)) return null;
  return match;
}

for (const report of reports) {
  const source = readFileSync(new URL(`../${report}`, import.meta.url), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const [name, pattern] of rules) {
    const match = firstUnsafeMatch(source, pattern);
    assert.equal(match, null, `${report}: ${name}: ${match?.[0] || ""}`);
  }
  assert.doesNotMatch(source, /Most likely driver of operational drag/i);
  assert.doesNotMatch(source, /What organizations in this sector often get wrong/i);
}

const deliberateRegressions = [
  "This intervention will improve performance.",
  "The workflow will likely require a broader redesign.",
  "Capacity is being consumed by the process.",
  "Visible output is held together by borrowed performance.",
  "A targeted intervention has high yield.",
  "What organizations in this sector often get wrong is routing.",
  "This score predicts later organizational performance.",
];
for (let index = 0; index < rules.length; index += 1) {
  assert.ok(firstUnsafeMatch(deliberateRegressions[index], rules[index][1]), `negative fixture missed ${rules[index][0]}`);
}

console.log(`FRONTEND_PARTNER_VISIBLE_NONCLAIMS=PASS reports=${reports.length} deliberate_regressions=${deliberateRegressions.length}`);
