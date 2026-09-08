import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "dv-journey-recovery.js"), "utf8");
const signin = fs.readFileSync(path.join(root, "signin.html"), "utf8");
const diagnostic = fs.readFileSync(path.join(root, "decision-velocity.html"), "utf8");
const ids = {
  run: "33333333-3333-4333-8333-333333333333",
  user: "11111111-1111-4111-8111-111111111111",
  otherUser: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  org: "22222222-2222-4222-8222-222222222222",
  otherOrg: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
};
const capability = "s".repeat(43);
const epoch = Date.parse("2026-09-08T12:00:00Z");
const clone = (value) => JSON.parse(JSON.stringify(value));

class SessionStore {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function inputState() {
  return {
    runId: ids.run, sessionCapability: capability, mode: "managerial", depth: "10",
    configVersion: "dv.v1.2", started: true, experienceIndex: 0, experienceComplete: false,
    preflight: {
      processName: "Synthetic approval", businessUnit: "Synthetic operations",
      industry: "technology_software", regulatoryIntensity: "moderate", decisionType: "program",
      description: "Synthetic context", organizationSize: "mid_size",
      employeeCount: 250, peopleInvolved: 8, hourlyCost: 90, annualVolume: 24, meetingHours: 3,
      access_token: "must-never-copy-token"
    },
    experiential: { self: "Synthetic note", observedOperational: "", observedManagerial: "", observedSeniorLeader: "" },
    currentItem: { id: "untrusted-local-item", text: "Do not restore this" },
    answerCache: { q1: "untrusted-local-answer" },
    questionHistory: [{ item: { id: "untrusted-history" }, value: "not authoritative" }],
    refresh_token: "must-never-copy-refresh",
    authorization: "must-never-copy-authorization",
    result: null, renderPayload: { html: "must-never-copy-report" }
  };
}

function remoteState() {
  return {
    ok: true, runId: ids.run, role: "managerial", depth: 10, configVersion: "dv.v1.2",
    nextItem: { id: "server-q2", questionType: "single_select", options: [{ value: "low", label: "Low" }] },
    answerHistory: [{ itemId: "server-q1", item: { id: "server-q1" }, value: "low", meta: {} }],
    sessionRevision: 3, shouldStop: false, finalized: false
  };
}

function runtime({ storage = new SessionStore(), user = null, org = null, search = "", access, now = epoch } = {}) {
  const current = { user, org, now, userError: null, remote: remoteState(), remoteError: null, remoteCalls: [], restores: [], issues: [] };
  const listeners = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: current.user ? { id: current.user } : null }, error: current.userError }),
      onAuthStateChange(callback) {
        listeners.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    }
  };
  const window = {
    sessionStorage: storage, location: { search },
    __mondermanActiveOrganizationId: org,
    mondermanWorkspaceAccessReady: Promise.resolve(access || { allowed: true, context: user ? "workspace" : "public_first_run" }),
    mondermanGetSupabaseClient: async () => client
  };
  class Clock extends Date { static now() { return current.now; } }
  const context = vm.createContext({ window, URLSearchParams, TextEncoder, Date: Clock, JSON, Promise, setTimeout });
  vm.runInContext(source, context, { filename: "dv-journey-recovery.js" });
  const api = window.MondermanDVJourneyRecovery;
  function controller(state = inputState(), overrides = {}) {
    return api.createController({
      state,
      validateRemote: async (request) => {
        current.remoteCalls.push(clone(request));
        if (current.remoteError) throw current.remoteError;
        return clone(current.remote);
      },
      restore: async (request) => { current.restores.push(clone(request)); },
      onUnavailable: (issue) => { current.issues.push(clone(issue)); },
      ...overrides
    });
  }
  return { api, window, current, client, storage, controller, emit(event, session) { listeners.forEach((callback) => callback(event, session)); } };
}

async function savedAnonymous(phase = "questions") {
  const env = runtime();
  const state = inputState();
  const controller = env.controller(state);
  assert.equal(await controller.activate(), false);
  assert.equal(controller.isActive(), true);
  assert.equal(controller.save(phase), true);
  return { ...env, state, savedController: controller };
}

const first = await savedAnonymous();
const key = first.api._test.key;
const saved = JSON.parse(first.storage.getItem(key));
assert.equal(saved.state.sessionCapability, capability);
assert.equal(saved.owner_user_id, null);
assert.doesNotMatch(JSON.stringify(saved), /must-never|untrusted|access_token|refresh_token|authorization|renderPayload|questionHistory|answerCache|currentItem/);
assert.equal(first.api._test.maxAgeMs, 4 * 60 * 60 * 1000);
assert.ok(first.api._test.maxBytes <= 128 * 1024);
assert.doesNotMatch(source, /window\.localStorage|fetch\(|console\.(log|warn|error)/);

// Reload must wait for a server-authorized response and use its authoritative
// questions/history, never local question objects.
const reload = runtime({ storage: first.storage });
let releaseRemote;
const remoteReady = new Promise((resolve) => { releaseRemote = resolve; });
const reloaded = reload.controller({}, { validateRemote: async () => remoteReady });
const pendingReload = reloaded.activate();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(reload.current.restores.length, 0);
releaseRemote(remoteState());
assert.equal(await pendingReload, true);
assert.equal(reload.current.restores[0].state.runId, ids.run);
assert.equal(reload.current.restores[0].remote.nextItem.id, "server-q2");
assert.equal(reload.current.restores[0].state.currentItem, undefined);
assert.equal(reload.current.restores[0].authenticated, false);

for (const phase of ["experience", "confidence", "teaser", "finalizing"]) {
  const env = await savedAnonymous(phase);
  const second = runtime({ storage: env.storage });
  second.current.remote.shouldStop = true;
  second.current.remote.nextItem = null;
  assert.equal(await second.controller().activate(), true);
  assert.equal(second.current.restores[0].phase, phase);
}

// Same-tab email and OAuth routing contains only a harmless resume marker.
const handoff = await savedAnonymous("teaser");
const url = handoff.savedController.prepareSignIn();
assert.equal(url, "signin.html?next=decision-velocity.html%3Fresume%3D1");
assert.equal(new URL(url, "https://www.monderman.com").searchParams.get("next"), "decision-velocity.html?resume=1");
assert.ok(!url.includes(ids.run) && !url.includes(capability));
const auth = runtime({ storage: handoff.storage, user: ids.user });
assert.equal(await auth.api.bindAuthenticatedReturn(auth.client, "decision-velocity.html?resume=1", ids.user), true);
assert.equal(JSON.parse(auth.storage.getItem(key)).owner_user_id, ids.user);
const accountReturn = runtime({ storage: handoff.storage, user: ids.user, org: ids.org, search: "?resume=1" });
assert.equal(await accountReturn.controller().activate(), true);
assert.equal(accountReturn.current.restores[0].authenticated, true);
assert.equal(accountReturn.current.restores[0].phase, "teaser");
assert.equal(accountReturn.current.remoteCalls[0].runId, ids.run);
assert.equal(accountReturn.current.remoteCalls[0].sessionCapability, capability);
const bound = JSON.parse(accountReturn.storage.getItem(key));
assert.equal(bound.owner_user_id, ids.user);
assert.equal(bound.owner_organization_id, ids.org);
assert.equal(bound.auth_return, false);
assert.equal(await runtime({ storage: accountReturn.storage, user: ids.user, org: ids.org }).controller().activate(), true);

for (const [user, org, reason] of [
  [ids.otherUser, ids.org, "account_changed"],
  [ids.user, ids.otherOrg, "workspace_changed"],
  [null, null, "account_changed"]
]) {
  const storage = new SessionStore(); storage.setItem(key, JSON.stringify(bound));
  const env = runtime({ storage, user, org, search: "?resume=1" });
  assert.equal(await env.controller().activate(), false);
  assert.equal(env.current.remoteCalls.length, 0);
  assert.equal(storage.getItem(key), null);
  assert.equal(env.current.issues.at(-1).reason, reason);
}

const unauthorizedTransfer = await savedAnonymous();
const wrongAccount = runtime({ storage: unauthorizedTransfer.storage, user: ids.user, org: ids.org });
assert.equal(await wrongAccount.controller().activate(), false);
assert.equal(wrongAccount.current.restores.length, 0);
assert.equal(wrongAccount.storage.getItem(key), null);

const failedVerification = await savedAnonymous("teaser");
failedVerification.savedController.prepareSignIn();
failedVerification.current.user = ids.user;
failedVerification.current.userError = { message: "synthetic verification outage" };
await assert.rejects(() => failedVerification.api.bindAuthenticatedReturn(failedVerification.client, "decision-velocity.html?resume=1", ids.user), /dv_recovery_identity_unavailable/);
assert.equal(JSON.parse(failedVerification.storage.getItem(key)).owner_user_id, null);

// Expiry is fixed at the first save and cannot be prolonged with local writes.
const expiring = await savedAnonymous();
expiring.current.now += 3 * 60 * 60 * 1000;
assert.equal(expiring.savedController.save(), true);
assert.equal(JSON.parse(expiring.storage.getItem(key)).created_at, epoch);
const expired = runtime({ storage: expiring.storage, now: epoch + 4 * 60 * 60 * 1000, search: "?resume=1" });
assert.equal(await expired.controller().activate(), false);
assert.equal(expired.current.remoteCalls.length, 0);
assert.equal(expired.current.issues[0].reason, "expired_recovery");
assert.equal(expired.storage.getItem(key), null);

for (const raw of [
  "{bad json",
  "x".repeat(128 * 1024 + 1),
  JSON.stringify({ ...saved, created_at: epoch + 60001 }),
  JSON.stringify({ ...saved, owner_organization_id: ids.org }),
  JSON.stringify({ ...saved, state: { ...saved.state, sessionCapability: "not-a-capability" } }),
  JSON.stringify({ ...saved, state: { ...saved.state, runId: "../../not-a-run" } }),
  JSON.stringify({ ...saved, state: { ...saved.state, experiential: null } }),
  JSON.stringify({ ...saved, state: { ...saved.state, preflight: { ...saved.state.preflight, employeeCount: "250" } } })
]) {
  const storage = new SessionStore(); storage.setItem(key, raw);
  const env = runtime({ storage });
  assert.equal(await env.controller().activate(), false);
  assert.equal(env.current.remoteCalls.length, 0);
  assert.equal(env.current.issues[0].reason, "invalid_recovery");
  assert.equal(storage.getItem(key), null);
}

const large = await savedAnonymous();
for (const field of Object.keys(large.state.experiential)) large.state.experiential[field] = "界".repeat(12000);
assert.equal(large.savedController.save(), false, "UTF-8 size, not just character count, must be bounded");

const assignment = runtime({ storage: first.storage, search: "?assignment_token=synthetic" });
const assignmentController = assignment.controller();
assert.equal(await assignmentController.activate(), false);
assert.equal(assignmentController.save(), false);
assert.equal(assignment.current.remoteCalls.length, 0);
const signedStart = runtime({ user: ids.user, org: ids.org });
const signedController = signedStart.controller();
assert.equal(await signedController.activate(), false);
assert.equal(signedController.save(), false, "existing authenticated self-run draft behavior owns these runs");

const logout = await savedAnonymous();
logout.emit("SIGNED_OUT", null);
assert.equal(logout.storage.getItem(key), null);
assert.equal(logout.savedController.save(), false);
assert.equal(logout.current.issues.at(-1).reason, "signed_out");
const accountSwap = await savedAnonymous();
accountSwap.emit("SIGNED_IN", { user: { id: ids.otherUser } });
assert.equal(accountSwap.storage.getItem(key), null);
assert.equal(accountSwap.savedController.save(), false);

// Saved-report reads reuse the existing verified client. Their watcher only
// invalidates synchronously and must never re-enter Supabase's auth lock.
const watcherEnv = runtime();
const identityEvents = [];
let identityListener;
let watcherSubscriptions = 0;
let watcherUnsubscribed = false;
const identitySubscription = { unsubscribe() { watcherUnsubscribed = true; } };
const existingClient = { auth: {
  onAuthStateChange(callback) {
    watcherSubscriptions += 1;
    identityListener = callback;
    return { data: { subscription: identitySubscription } };
  },
  getUser() { throw new Error("watcher must not verify again inside an auth callback"); },
  getSession() { throw new Error("watcher must not read a session inside an auth callback"); }
} };
const watcherSubscription = watcherEnv.api.watchVerifiedIdentity(existingClient, ids.user, (issue) => { identityEvents.push(clone(issue)); });
assert.equal(watcherSubscription, identitySubscription);
assert.equal(watcherSubscriptions, 1, "watcher must subscribe only to the supplied client");
assert.doesNotMatch(watcherEnv.api.watchVerifiedIdentity.toString(), /\b(?:async|await)\b|\b(?:getUser|getSession|createClient)\s*\(/);
assert.equal(identityListener.constructor.name, "Function", "auth callback must not be async");
for (const event of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) {
  assert.equal(identityListener(event, { user: { id: ids.user }, access_token: "new-token-must-not-matter" }), undefined);
}
assert.equal(identityListener("INITIAL_SESSION", null), undefined);
assert.deepEqual(identityEvents, [], "same identity, including token refresh, must keep the report visible");
assert.equal(identityListener("SIGNED_OUT", null), undefined);
assert.deepEqual(identityEvents, [{ reason: "signed_out" }], "signout must invalidate before the callback returns");
assert.equal(identityListener("SIGNED_IN", { user: { id: ids.otherUser } }), undefined);
assert.deepEqual(identityEvents.at(-1), { reason: "account_changed" });
identityEvents.length = 0;
assert.equal(identityListener("TOKEN_REFRESHED", { user: { id: ids.otherUser } }), undefined);
assert.deepEqual(identityEvents, [{ reason: "account_changed" }], "every different-identity event must invalidate");
watcherSubscription.unsubscribe();
assert.equal(watcherUnsubscribed, true);
assert.throws(() => watcherEnv.api.watchVerifiedIdentity(existingClient, "", () => {}), /dv_identity_watch_unavailable/);
assert.throws(() => watcherEnv.api.watchVerifiedIdentity({}, ids.user, () => {}), /dv_identity_watch_unavailable/);
assert.equal(watcherSubscriptions, 1, "invalid watcher setup must fail closed without another subscription");

const pendingSwap = await savedAnonymous("teaser");
pendingSwap.savedController.prepareSignIn();
pendingSwap.emit("SIGNED_IN", { user: { id: ids.otherUser } });
assert.equal(pendingSwap.storage.getItem(key), null, "a pending handoff cannot authorize an account event in the old diagnostic page");

const racing = await savedAnonymous();
const race = runtime({ storage: racing.storage });
let releaseRace;
const raceController = race.controller({}, { validateRemote: async () => new Promise((resolve) => { releaseRace = resolve; }) });
const raceActivation = raceController.activate();
await new Promise((resolve) => setTimeout(resolve, 0));
race.emit("SIGNED_OUT", null);
releaseRace(remoteState());
assert.equal(await raceActivation, false);
assert.equal(race.current.restores.length, 0);

for (const status of [403, 404, 410, 503]) {
  const original = await savedAnonymous();
  const env = runtime({ storage: original.storage });
  env.current.remoteError = Object.assign(new Error("synthetic API failure"), { status });
  const controller = env.controller();
  assert.equal(await controller.activate(), false);
  assert.equal(env.current.restores.length, 0);
  assert.equal(env.current.issues[0].retryable, status === 503);
  assert.equal(Boolean(env.storage.getItem(key)), status === 503);
  if (status === 503) {
    env.current.remoteError = null;
    assert.equal(await controller.activate(), true);
  }
}

const mismatchedRemote = await savedAnonymous();
const changedConfig = runtime({ storage: mismatchedRemote.storage });
changedConfig.current.remote.configVersion = "different.version";
assert.equal(await changedConfig.controller().activate(), false);
assert.equal(changedConfig.storage.getItem(key), null);
assert.equal(changedConfig.current.restores.length, 0);

const completed = await savedAnonymous("finalizing");
completed.state.result = { score: 74 };
assert.equal(completed.savedController.save(), false);
completed.savedController.clear();
assert.equal(completed.storage.getItem(key), null);

assert.ok(signin.includes('<script src="dv-journey-recovery.js"></script>'));
assert.ok(signin.includes("bindAuthenticatedReturn(supabase, nextTarget, session.user.id)"));
assert.ok(signin.includes('if (event === "SIGNED_OUT") window.MondermanDVJourneyRecovery?.clearPending()'));
assert.ok(signin.includes('const params = new URLSearchParams({ next: nextTarget, acceptance_source: current.source })'));
assert.ok(signin.includes("window.location.replace(nextTarget)"));
assert.ok(signin.includes("setTimeout(() => { void continueAfterAuth(session); }, 0)"), "auth callbacks must not hold the Supabase lock across getUser");
assert.ok(diagnostic.includes('<script src="dv-journey-recovery.js"></script>'));
assert.match(diagnostic, /id="mdmTeaserSignIn"[^>]*href="signin\.html\?next=decision-velocity\.html%3Fresume%3D1"/);
assert.doesNotMatch(diagnostic, /id="mdmTeaserSignIn"[^>]*target="_blank"/, "account unlock must preserve the current tab's recovery storage");
assert.match(diagnostic, /prepareSignIn\(\)[\s\S]*window\.location\.assign\(next\)/, "the account link must preserve and authorize the handoff before navigation");
assert.ok(diagnostic.includes("'X-Monderman-Session-Capability': sessionCapability"), "recovery credentials must be sent in the request header");
assert.ok(diagnostic.includes("MondermanDVJourneyRecovery.watchVerifiedIdentity(client, identity, () =>"), "saved reports must use the shared verified-identity watcher");
assert.doesNotMatch(diagnostic, /onAuthStateChange/, "diagnostic HTML must retain the centralized auth callback boundary");

console.log("DV_JOURNEY_RECOVERY_PASS: anonymous reload, five phases, same-tab verified account handoff, identity/tenant/assignment isolation, fixed four-hour expiry, bounded sanitized state, server-before-render verification, retry and logout races, synchronous saved-report identity watcher.");
