import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reports = [
  "decision-velocity.html",
  "structural-clarity.html",
  "operational-systems.html",
  "institutional-performance.html",
  "sample-report.html",
];

const rules = [
  ["predicted outcome", /\b(?:will|would)\s+(?:improve|reduce|increase|recover|produce|create|prevent|cause|accelerate|restore|reclaim|spread|widen|accumulate)\b|\b(?:score|result|finding|findings|instrument)\b.{0,100}\b(?:predicts?\s+(?:later\s+|future\s+)?performance|foretells?\s+(?:later\s+|future\s+)?performance)\b/i],
  ["probabilistic mechanism", /(?:\b(?:likely|most likely)\b.{0,120}\b(?:require|spread|widen|accumulate|improve|consume|consuming|reclaim|respond|fail|sustain|understate|slow|need|depend|drag|fill)|\b(?:require|spread|widen|accumulate|improve|consume|consuming|reclaim|respond|fail|sustain|understate|slow|need|depend|drag|fill)\b.{0,120}\b(?:likely|most likely)\b)/i],
  ["realized loss or recovery", /\b(?:is|are|being|currently)\s+(?:consuming|consumed|borrowing|borrowed|recovering|recovered)\b|\b(?:hours|dollars|capacity|savings)\s+(?:recovered|realized)\b|\b(?:frees?|releases?|returns?)\s+[\d,.]+\s+(?:hours?|dollars?)\b/i],
  ["causal or durability mechanism", /\b(?:held together by|durable rather than borrowed|borrowed performance|currently depends on|preserving output|accelerates? (?:the )?failure|the cause is|gives? rise to|brings? about|produces? (?:the )?(?:responsiveness|control benefit|performance)|sustains? output|(?:protects?|safeguards?) (?:current )?(?:institutional )?capacity|demonstrates? durable performance)\b/i],
  ["promised intervention effect", /\b(?:expect a real shift|usually responds|usually requires|usually indicates|high yield|conditions are actually improving|verify that drag is actually falling|shown to be paying off)\b/i],
  ["cross-organization generalization", /\b(?:what organizations in this sector often get wrong|organizations (?:commonly|often|typically)|companies (?:commonly|often|typically))\b|\b(?:pattern|finding|findings|result|results)\s+(?:applies?|carry|carries|holds?|generalizes?|extends?)\s+(?:broadly\s+)?(?:across|to|beyond)\b/i],
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
  assert.doesNotMatch(source, /available capacity is currently allocated/i);
  assert.doesNotMatch(source, /(?:portion|capacity) that could be returned to productive use/i);
  assert.doesNotMatch(source, /Flat trajectories often mask/i);
  assert.doesNotMatch(source, /Divergence between perspectives reframes the diagnosis/i);
  assert.doesNotMatch(source, /surfacing in adjacent workflows distinguishes/i);
  assert.doesNotMatch(source, /distributed pattern usually means/i);
  assert.doesNotMatch(source, /Protects a strong design|Keeps current clarity durable|Produces a structurally legible environment|the most lasting fix|faster movement sooner|Apply the validated ownership/i);
}

const deliberateRegressions = [
  "This score predicts performance.",
  "The workflow will likely require a broader redesign.",
  "The change frees 800 hours.",
  "The review gives rise to lower cost and safeguards capacity.",
  "A targeted intervention has high yield.",
  "This result extends beyond this organization.",
  "This score predicts later organizational performance.",
];
for (let index = 0; index < rules.length; index += 1) {
  assert.ok(firstUnsafeMatch(deliberateRegressions[index], rules[index][1]), `negative fixture missed ${rules[index][0]}`);
}

const storedSurfaces = ["workspace-diagnostics.html", "workspace-actions.html", "cross-tool-synthesis.html"]
  .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
  .join("\n");
assert.doesNotMatch(storedSurfaces, /\.from\(["']diagnostic_runs["']\)/i, "browser code must not bypass the guarded Diagnostic API");
assert.doesNotMatch(storedSurfaces, /\.from\(["']synthesis_runs["']\)/i, "browser code must not bypass the guarded Synthesis API");

console.log(`FRONTEND_PARTNER_VISIBLE_NONCLAIMS=PASS reports=${reports.length} deliberate_regressions=${deliberateRegressions.length}`);
