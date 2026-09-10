import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

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
  if (report !== "sample-report.html") {
    assert.match(source, /sessionCapability:\s*null/, `${report}: preview session capability is not retained in run state`);
    assert.match(source, /state\.sessionCapability\s*=\s*data\.sessionCapability\s*\|\|\s*null/,
      `${report}: start response capability is not captured`);
    assert.equal((source.match(/session_capability:\s*state\.sessionCapability\s*\|\|\s*undefined/g) || []).length, 2,
      `${report}: answer and finalize must both send the preview session capability`);
    assert.equal((source.match(/assignment_token:\s*\(window\.MondermanAssignment/g) || []).length >= 3, true,
      `${report}: start, answer, and finalize must send the exact assignment capability`);
  }
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

const workspaceDiagnostics = readFileSync(new URL("../workspace-diagnostics.html", import.meta.url), "utf8");
for (const token of [
  "campaignPayloadFingerprint",
  "crypto.subtle.digest(\"SHA-256\"",
  "crypto.randomUUID()",
  "localStorage.setItem(campaignAttemptStorageKey()",
  "fd.append(\"campaign_send_key\", state.campaignSendKey)",
  "clearCampaignSendAttempt()",
]) assert.ok(workspaceDiagnostics.includes(token), `Workspace campaign retry protection missing ${token}`);

const institutionalPerformance = readFileSync(new URL("../institutional-performance.html", import.meta.url), "utf8");
assert.doesNotMatch(institutionalPerformance, /annual_cost\)\s*\*\s*0\.6|0\.6\s*\*\s*Number\([^)]*annual_cost/i,
  "the browser must not invent a recoverable amount from annual exposure");
assert.match(institutionalPerformance, /MViz\.timeCostScenario\(\$\("capacityFlow"\), result && result\.exposure\)/,
  "the inline report must pass published exposure to the guarded scenario renderer");

// Execute the actual shared renderer, not a duplicate of its withholding logic.
// This dependency-free DOM records the semantic rows produced by its DOM calls;
// full built-page and exported-HTML coverage lives in the inline browser suite.
function element(tag) {
  return {
    tag, children: [], ownText: "",
    set textContent(value) { this.ownText = String(value); this.children = []; },
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {},
  };
}
const visualizationSource = readFileSync(new URL("../monderman-viz.js", import.meta.url), "utf8");
const osFixture = JSON.parse(readFileSync(new URL("../test-fixtures/os-inline-result-presentation.json", import.meta.url), "utf8"));
assert.equal(osFixture.syntheticOnly, true);
function verifyPublishedRecovery(source) {
  const context = { window: {}, document: { createElement: element } };
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.equal(typeof context.window.MViz.timeCostScenario, "function");
  const host = element("section");
  const render = exposure => {
    const original = structuredClone(exposure);
    context.window.MViz.timeCostScenario(host, exposure);
    assert.deepEqual(exposure, original, "the display must not mutate published inputs");
    return Object.fromEntries(host.children.filter(child => child.tag === "dl")
      .flatMap(list => list.children.map(row => row.children.map(child => child.textContent))));
  };
  const recovery = "Modeled recovery scenario", cost = "Modeled annual labor cost";
  const published = osFixture.result.exposure;
  let cases = 0;
  assert.equal(render(published)[recovery], "$108"); cases++;
  assert.equal(render({ ...published, recoverable_cost: 0 })[recovery], "$0"); cases++;
  assert.equal(render({ ...published, recoverable_cost: 0.001 })[recovery], "<$0.01"); cases++;
  for (const missing of [undefined, null, "108", -1, NaN, Infinity]) {
    const rows = render({ ...published, recoverable_cost: missing, reclaim_potential: 9999 });
    assert.equal(Object.hasOwn(rows, recovery), false, "unpublished recovery must not be inferred or coerced");
    assert.equal(rows[cost], "$1,800", "published costs remain distinct from missing recovery"); cases++;
  }
  const absent = { ...published }; delete absent.recoverable_cost;
  assert.equal(Object.hasOwn(render(absent), recovery), false); cases++;
  for (const flags of [
    { sizing_status: "withheld" }, { sizing_status: "not_estimated" },
    { sizing_status: "input_saturation", hours_estimated: true },
    { sizing_status: "missing_hours_inputs" }, { sizing_status: "insufficient_hours_inputs" },
    { sizing_status: "unknown-status" }, { hours_estimated: false }, { cost_estimated: false },
    { priceable: false }, { sizing_status: "hours_only" }, { sizing_status: "hours_only_missing_labor_rate" },
    { priceable: false, unpriced_reason: "missing_sizing_inputs" },
    { unpriced_reason: "attributed_hours_exceed_available_capacity" }, { status: "withheld" },
  ]) {
    const rows = render({ ...published, ...flags });
    assert.equal(Object.hasOwn(rows, recovery), false, `withheld recovery leaked: ${JSON.stringify(flags)}`);
    assert.equal(Object.hasOwn(rows, cost), false, `withheld cost leaked: ${JSON.stringify(flags)}`);
    assert.equal(rows["Assumed annual participant capacity"], "5,400 hours"); cases++;
  }
  render(published);
  const cleared = render({});
  assert.equal(Object.keys(cleared).length, 0, "a repeated render must clear previously published values"); cases++;
  return cases;
}
const recoveryCases = verifyPublishedRecovery(visualizationSource);
const scenarioStart = visualizationSource.indexOf("  function timeCostScenario(el, exposure) {");
assert.ok(scenarioStart > 0);
const scenarioSource = visualizationSource.slice(scenarioStart);
const scenarioMutations = [
  ["infer recovery from annual cost", 'const e = exposure && typeof exposure === "object" ? exposure : {};',
    'const e = { ...(exposure || {}), recoverable_cost: exposure?.recoverable_cost ?? exposure?.annual_cost * 0.6 };'],
  ["turn missing recovery into zero", 'const e = exposure && typeof exposure === "object" ? exposure : {};',
    'const e = { ...(exposure || {}), recoverable_cost: exposure?.recoverable_cost ?? 0 };'],
  ["ignore cost withholding", "const costAllowed = hoursAllowed", "const costAllowed = true || hoursAllowed"],
  ["ignore time/status withholding", "const hoursAllowed = knownStatus", "const hoursAllowed = true || knownStatus"],
  ["retain stale values", 'host.textContent = "";', '/* deliberately fail to clear prior output */'],
  ["suppress genuine zero", 'e[key] >= 0', 'e[key] > 0'],
  ["substitute annual cost for recovery", '["recoverable_cost", "Modeled recovery scenario"', '["annual_cost", "Modeled recovery scenario"'],
];
for (const [name, before, after] of scenarioMutations) {
  assert.equal(scenarioSource.split(before).length, 2, `mutation anchor changed: ${name}`);
  const changed = visualizationSource.slice(0, scenarioStart) + scenarioSource.replace(before, after);
  assert.throws(() => verifyPublishedRecovery(changed), assert.AssertionError, `recovery guard missed: ${name}`);
}

const deployWorkflow = readFileSync(new URL("../.github/workflows/pages-protected-deploy.yml", import.meta.url), "utf8");
assert.match(deployWorkflow, /github\.event\.workflow_run\.head_sha/);
assert.match(deployWorkflow, /\.well-known\/monderman-release\.json/);
assert.match(deployWorkflow, /revision:\s*process\.env\.RELEASE_SHA/,
  "the public frontend must expose the immutable deployed revision consumed by the checkout lock");

console.log(`FRONTEND_PARTNER_VISIBLE_NONCLAIMS=PASS reports=${reports.length} deliberate_regressions=${deliberateRegressions.length} recovery_cases=${recoveryCases} recovery_mutations=${scenarioMutations.length}`);
