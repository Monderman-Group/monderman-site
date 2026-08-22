import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const pages = [
  ["decision-velocity.html", "decision_velocity"],
  ["operational-systems.html", "operational_systems"],
  ["structural-clarity.html", "structural_clarity"],
  ["institutional-performance.html", "institutional_performance"]
];

const workspace = read("workspace-diagnostics.html");
const theme = read("workspace-theme.js");
assert.match(workspace, /campaignAccessState\(\)/);
assert.match(workspace, /MondermanCampaignAccess/);
assert.match(workspace, /respondent_pool/);
assert.match(read("campaign-access.js"), /No participant responses remain/);
assert.doesNotMatch(theme, /Campaign entitlement presentation guard/);
assert.doesNotMatch(theme, /plan === "trial"[\s\S]*compose\.hidden = true/);

for (const [path, tool] of pages) {
  const html = read(path);
  assert.match(html, /<script src="assignment-draft\.js"><\/script>/, `${path} loads draft recovery`);
  assert.match(html, new RegExp(`tool: "${tool}"`), `${path} scopes drafts to its Diagnostic`);
  assert.match(html, /participantDraft\.activate\(cfg\)/, `${path} restores only after authoritative assignment resolution`);
  assert.match(html, /participantDraft\.clear\(\)/, `${path} supports explicit draft clearing`);
  assert.match(html, /restartDiagnostic\(true\)/, `${path} preserves the draft during answer replay`);
}

const assignmentMode = read("assignment-mode.js");
assert.match(assignmentMode, /kept only in this browser tab/);
assert.match(assignmentMode, /MondermanAssignmentDraft\.clearActive\(\)/);
assert.match(assignmentMode, /invalid_token", "campaign_closed", "campaign_access_ended/);

const signin = read("signin.html");
assert.match(signin, /monderman\.pendingAuthContext/);
assert.match(signin, /AUTH_CONTEXT_TTL_MS/);
assert.match(signin, /sessionStorage\.removeItem\(AUTH_CONTEXT_STORAGE_KEY\)/);

const campaignContext = vm.createContext({ window: {} });
vm.runInContext(read("campaign-access.js"), campaignContext, { filename: "campaign-access.js" });
const campaignAccess = campaignContext.window.MondermanCampaignAccess;
const enabled = { campaigns_enabled: true, anonymous_responses_enabled: true, respondent_pool: 3, respondents_used: 1 };
assert.equal(campaignAccess.evaluate({ role: "viewer", organization: enabled }).code, "role_required");
assert.equal(campaignAccess.evaluate({ role: "member", organization: enabled }).code, "role_required");
assert.equal(campaignAccess.evaluate({ role: "admin", organization: { ...enabled, campaigns_enabled: false } }).code, "campaigns_disabled");
assert.equal(campaignAccess.evaluate({ role: "owner", organization: enabled }).code, "capacity_required");
assert.equal(campaignAccess.evaluate({ role: "admin", organization: enabled, reserved: 1 }).allowed, true);
assert.equal(campaignAccess.evaluate({ role: "owner", organization: enabled, reserved: 2 }).code, "capacity_exhausted");
assert.equal(campaignAccess.evaluate({ role: "admin", organization: { ...enabled, respondent_pool: null } }).allowed, true);
assert.equal(campaignAccess.evaluate({ role: "admin", organization: enabled, reserved: 0 }).anonymousAllowed, true);
assert.equal(campaignAccess.evaluate({ role: "admin", organization: { ...enabled, anonymous_responses_enabled: false }, reserved: 0 }).anonymousAllowed, false);
assert.equal(campaignAccess.countReserved([
  { status: "sent" }, { status: "opened" }, { status: "completed" }, { status: "sent", closed_at: "2026-08-21T00:00:00Z" },
  { status: "sent", close_at: "2026-08-21T00:00:00Z" }, { status: "sent", send_status: "failed" }
], Date.parse("2026-08-22T00:00:00Z")), 2);

const store = new Map();
const sessionStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};
const emptyRoot = { querySelectorAll() { return []; } };
const document = {
  getElementById(id) { return id === "introStage" || id === "questionStage" ? emptyRoot : null; },
  querySelector() { return null; },
  addEventListener() {}
};
const window = {
  sessionStorage,
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout(fn) { fn(); return 1; },
  clearTimeout() {},
  addEventListener() {}
};
const context = vm.createContext({ window, document, Event: class Event {} });
vm.runInContext(read("assignment-draft.js"), context, { filename: "assignment-draft.js" });

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const stages = { intro: {}, question: {}, depth: {}, lane: {} };
const stateA = { mode: "operational", depth: "10", started: true, runId: "run-a", currentItem: { id: "q-a" }, preflight: { pathway: "fixture" }, answerCache: { q0: 3 }, questionHistory: [] };
const make = (state) => window.MondermanAssignmentDraft.createController({
  tool: "decision_velocity", state, stages,
  renderPreflight() {}, renderQuestion() {}, showStage() {}
});
const first = make(stateA);
assert.equal(first.activate({ id: idA, tool_type: "decision_velocity", participant_lens: "operational", depth: "10", is_anonymous_response: false }), false);
assert.equal(first.save(), true);
const encoded = store.get(`monderman.assignmentDraft.v1.${idA}`);
assert.ok(encoded);
assert.doesNotMatch(encoded, /assignment_token|secret-token/);

const stateB = { mode: null, depth: null, started: false, preflight: {}, answerCache: {}, questionHistory: [] };
const second = make(stateB);
assert.equal(second.activate({ id: idB, tool_type: "decision_velocity", participant_lens: "operational", depth: "10", is_anonymous_response: false }), false, "another assignment cannot restore the first draft");
assert.equal(stateB.runId, undefined);

const restored = { mode: null, depth: null, started: false, preflight: {}, answerCache: {}, questionHistory: [] };
const third = make(restored);
assert.equal(third.activate({ id: idA, tool_type: "decision_velocity", participant_lens: "operational", depth: "10", is_anonymous_response: false }), true);
assert.equal(restored.runId, "run-a");
assert.equal(restored.answerCache.q0, 3);
third.clear();
assert.equal(store.has(`monderman.assignmentDraft.v1.${idA}`), false);

console.log("campaign/participant reliability smoke passed");
