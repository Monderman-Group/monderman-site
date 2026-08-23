import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(path, "utf8");
const helperSource = read("self-diagnostic-draft.js");
const diagnostics = [
  ["structural-clarity.html", "structural_clarity"],
  ["decision-velocity.html", "decision_velocity"],
  ["operational-systems.html", "operational_systems"],
  ["institutional-performance.html", "institutional_performance"]
];

function validateHelper(source) {
  for (const token of [
    "window.sessionStorage", "user_id", "organization_id", "tool",
    "config_version", "draft_id", "MAX_AGE_MS", "MAX_BYTES",
    "Resume", "Start over", "clearAllExceptIdentity", "saveAccepted"
  ]) assert.ok(source.includes(token), `draft helper missing ${token}`);
  assert.ok(!source.includes("window.localStorage"), "sensitive drafts must not use localStorage");
  assert.match(source, /token\|password\|secret\|credential\|authorization/, "credential-shaped fields must be stripped recursively");
  assert.match(source, /Date\.now\(\) - savedAt > MAX_AGE_MS/);
  assert.match(source, /saved\.user_id !== userId \|\| saved\.organization_id !== organizationId \|\| saved\.tool !== tool/);
  assert.match(source, /String\(saved\.state\.configVersion \|\| ""\) !== saved\.config_version/);
  assert.match(source, /cleanUuid\(saved\.state\.runId\) !== saved\.draft_id/);
  assert.ok(!/addEventListener\(["'](?:input|change|pagehide)/.test(source), "drafts may save only from accepted-answer call sites");
}

function validateDiagnostic(source, tool) {
  assert.ok(source.includes('<script src="self-diagnostic-draft.js"></script>'));
  assert.ok(source.includes(`tool: "${tool}"`));
  assert.match(source, /state\.configVersion = data\?\.routingMeta\?\.configVersion \|\| data\?\.routingVersion/);
  assert.ok((source.match(/selfDraft\.saveAccepted\(\)/g) || []).length >= 5, `${tool} must save every accepted-answer path`);
  assert.ok((source.match(/selfDraft\.clear\(\)/g) || []).length >= 2, `${tool} must clear on completion and Start over`);
  assert.match(source, /showStage\(resultsStage\);\s*if \(selfDraft\) selfDraft\.clear\(\);/, `${tool} must clear only after successful result rendering`);
  assert.match(source, /if \(!preserveParticipantDraft && selfDraft\) selfDraft\.clear\(\);/, `${tool} Start over must clear its scoped draft`);
  assert.match(source, /if \(state\.finalizeInFlight\) return;/, `${tool} must retain single-flight finalization`);
}

validateHelper(helperSource);
for (const [path, tool] of diagnostics) validateDiagnostic(read(path), tool);

// Deliberate negative mutations: each essential protection must be gate-owned.
for (const [label, mutated] of [
  ["session scoping", helperSource.replace("window.sessionStorage", "window.localStorage")],
  ["organization binding", helperSource.replace("saved.organization_id !== organizationId || ", "")],
  ["configuration binding", helperSource.replace('String(saved.state.configVersion || "") !== saved.config_version', "false")],
  ["expiry", helperSource.replace("Date.now() - savedAt > MAX_AGE_MS", "false")],
  ["Resume", helperSource.replace(/Resume/g, "Continue")],
  ["Start over", helperSource.replace(/Start over/g, "Discard")]
]) assert.throws(() => validateHelper(mutated), undefined, `negative mutation must fail: ${label}`);

for (const [path, tool] of diagnostics) {
  const source = read(path);
  for (const [label, mutated] of [
    ["start-response routing version", source.replace(" || data?.routingVersion", "")],
    ["accepted-answer saving", source.replace(/if \(selfDraft\) selfDraft\.saveAccepted\(\);/g, "")],
    ["draft clearing", source.replace(/if \(selfDraft\) selfDraft\.clear\(\);/g, "")],
    ["duplicate protection", source.replace("if (state.finalizeInFlight) return;", "")]
  ]) assert.throws(() => validateDiagnostic(mutated, tool), undefined, `${tool} negative mutation must fail: ${label}`);
}

class SessionStore {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] || null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

class FakeElement {
  constructor(id = "") { this.id = id; this.style = {}; this.handlers = {}; this.classList = { contains() { return false; } }; }
  setAttribute() {}
  remove() {}
  focus() {}
  addEventListener(name, fn) { this.handlers[name] = fn; }
  querySelector(selector) {
    if (!this.children) this.children = new Map();
    if (!this.children.has(selector)) this.children.set(selector, new FakeElement(selector));
    return this.children.get(selector);
  }
  set innerHTML(_value) {}
}

function makeRuntime() {
  const sessionStorage = new SessionStore();
  const elements = new Map();
  const document = {
    body: { appendChild(el) { if (el.id) elements.set(el.id, el); } },
    createElement() { return new FakeElement(); },
    getElementById(id) { return elements.get(id) || null; }
  };
  let userId = "11111111-1111-4111-8111-111111111111";
  let membershipOrganizationId = "22222222-2222-4222-8222-222222222222";
  const window = {
    sessionStorage,
    location: { search: "" },
    mondermanWorkspaceAccessReady: Promise.resolve({ allowed: true, context: "workspace" }),
    __mondermanActiveOrganizationId: "22222222-2222-4222-8222-222222222222",
    mondermanGetSupabaseClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
      from(table) {
        assert.equal(table, "organization_members");
        const filters = {};
        const query = {
          select() { return query; },
          eq(column, value) { filters[column] = value; return query; },
          async maybeSingle() {
            const allowed = filters.user_id === userId && filters.organization_id === membershipOrganizationId;
            return allowed ? { data: { organization_id: membershipOrganizationId }, error: null } : { data: null, error: null };
          }
        };
        return query;
      }
    })
  };
  const context = vm.createContext({ window, document, URLSearchParams, Date, JSON, Number, String, Array, Object, RegExp });
  vm.runInContext(helperSource, context, { filename: "self-diagnostic-draft.js" });
  return {
    window, document, sessionStorage,
    setUser(id) { userId = id; },
    setMembershipOrganization(id) { membershipOrganizationId = id; }
  };
}

const runtime = makeRuntime();
const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  org: "22222222-2222-4222-8222-222222222222",
  run: "33333333-3333-4333-8333-333333333333"
};
const questionStage = {};
let rendered = 0;
let shown = 0;
let startedOver = 0;
const state = {
  mode: "operational", depth: "10", started: true,
  preflight: { processName: "fixture", access_token: "must-not-be-selected" },
  runId: ids.run, configVersion: "sc.v1.2.3",
  currentItem: { id: "q4", questionType: "single_select" },
  currentProgress: { answered: 3 }, roleForText: "operational",
  answerCache: { q1: "rarely", q2: "sometimes", q3: "often" },
  questionHistory: [{ item: { id: "q1" }, value: "rarely" }],
  experienceIndex: 0, experienceComplete: false,
  experiential: { self: "" }
};
const makeController = (targetState, tool = "structural_clarity") => runtime.window.MondermanSelfDiagnosticDraft.createController({
  tool, state: targetState, questionStage,
  renderQuestion() { rendered += 1; },
  showStage() { shown += 1; },
  startOver() { startedOver += 1; }
});

const first = makeController(state);
assert.equal(await first.activate(), false);
assert.equal(first.saveAccepted(), true);
const expectedKey = runtime.window.MondermanSelfDiagnosticDraft._test.draftKey(ids.user, ids.org, "structural_clarity", "sc.v1.2.3", ids.run);
const encoded = runtime.sessionStorage.getItem(expectedKey);
assert.ok(encoded);
assert.doesNotMatch(encoded, /must-not-be-selected|access_token|refresh_token|magic_link/);

const restoredState = { mode: null, depth: null, preflight: {}, answerCache: {}, questionHistory: [] };
const second = makeController(restoredState);
assert.equal(await second.activate(), true);
assert.equal(second.restore(), true);
assert.equal(restoredState.mode, "operational");
assert.equal(restoredState.depth, "10");
assert.equal(restoredState.runId, ids.run);
assert.equal(restoredState.currentItem.id, "q4");
assert.deepEqual(restoredState.answerCache, state.answerCache);
assert.equal(rendered, 1);
assert.equal(shown, 1);

// Standalone Diagnostic pages do not receive the Workspace-only organization
// global. Recover the tab-scoped organization only after verifying that the
// signed-in user still belongs to it.
runtime.window.__mondermanActiveOrganizationId = "";
runtime.sessionStorage.setItem("monderman_active_organization_id", ids.org);
assert.equal(await makeController({}).activate(), true);
runtime.setMembershipOrganization("55555555-5555-4555-8555-555555555555");
assert.equal(await makeController({}).activate(), false);
runtime.setMembershipOrganization(ids.org);
runtime.window.__mondermanActiveOrganizationId = ids.org;

// A different Diagnostic cannot discover or combine the draft.
const otherTool = makeController({}, "decision_velocity");
assert.equal(await otherTool.activate(), false);

// Malformed/config-inconsistent drafts are removed rather than restored.
const bad = JSON.parse(encoded);
bad.config_version = "sc.v9";
runtime.sessionStorage.setItem(expectedKey, JSON.stringify(bad));
const malformed = makeController({});
assert.equal(await malformed.activate(), false);
assert.equal(runtime.sessionStorage.getItem(expectedKey), null);

// Malformed JSON is discarded without attempting restoration.
assert.equal(first.saveAccepted(), true);
runtime.sessionStorage.setItem(expectedKey, "{not-json");
assert.equal(await makeController({}).activate(), false);
assert.equal(runtime.sessionStorage.getItem(expectedKey), null);

// Re-save, then prove expiry is enforced.
assert.equal(first.saveAccepted(), true);
const stale = JSON.parse(runtime.sessionStorage.getItem(expectedKey));
stale.saved_at = new Date(Date.now() - runtime.window.MondermanSelfDiagnosticDraft._test.maxAgeMs - 1).toISOString();
runtime.sessionStorage.setItem(expectedKey, JSON.stringify(stale));
assert.equal(await makeController({}).activate(), false);
assert.equal(runtime.sessionStorage.getItem(expectedKey), null);

// Identity or organization changes make the old draft inaccessible and clear it.
assert.equal(first.saveAccepted(), true);
runtime.setUser("44444444-4444-4444-8444-444444444444");
assert.equal(await makeController({}).activate(), false);
assert.equal(runtime.sessionStorage.getItem(expectedKey), null);
runtime.setUser(ids.user);
runtime.window.__mondermanActiveOrganizationId = "55555555-5555-4555-8555-555555555555";
assert.equal(await makeController({}).activate(), false);

// Directed assignment flows never activate the authenticated self-run helper.
runtime.window.location.search = "?assignment_token=secret-value";
assert.equal(await makeController({}).activate(), false);

assert.equal(startedOver, 0);
console.log("authenticated Diagnostic draft recovery smoke passed");
