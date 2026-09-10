import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

// Offline actual-source regression. Recovery/controller functions are read
// from production files; identity, HTTP responses, rendering and storage are
// explicitly synthetic in-memory doubles. No listener, browser, provider,
// credentials, database, report or filesystem writes are used by this test.
const html = fs.readFileSync(new URL('../operational-systems.html', import.meta.url), 'utf8');
const draftSource = fs.readFileSync(new URL('../self-diagnostic-draft.js', import.meta.url), 'utf8');
const USER = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];

function declaration(source, name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `missing production function ${name}`);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index, `unterminated production function ${name}`);
  return source.slice(match.index, end + 2);
}

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {};
    this.listeners = new Map(); this.textContent = ''; this.disabled = false;
    const classes = new Set();
    this.classList = {contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value)};
  }
  setAttribute() {}
  focus() {}
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; for (const child of children) this.appendChild(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  addEventListener(event, callback) { this.listeners.set(event, [...(this.listeners.get(event) || []), callback]); }
  async click() { if (!this.disabled) for (const callback of this.listeners.get('click') || []) await callback({target: this}); }
  set innerHTML(value) {
    this.replaceChildren();
    // The real draft dialog creates fixed-ID buttons via HTML. This minimal
    // DOM models those IDs/events, not browser layout or HTML interpretation.
    for (const match of value.matchAll(/id="([^"]+)"/g)) {
      const child = new Element('button'); child.id = match[1]; this.appendChild(child);
    }
  }
  querySelector(selector) {
    const match = child => selector.startsWith('#') ? child.id === selector.slice(1) : child.tagName.toLowerCase() === selector;
    for (const child of this.children) {
      if (match(child)) return child;
      const nested = child.querySelector(selector); if (nested) return nested;
    }
    return null;
  }
  querySelectorAll() { return this.children; }
}

function makeHarness({resumeRunId = RUN, source = html, controllerSource = draftSource, finalized = false} = {}) {
  const store = new Map();
  const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key), key: index => [...store.keys()][index], get length() { return store.size; }};
  const body = new Element('body');
  const document = {body, createElement: tag => new Element(tag), getElementById: id => body.querySelector('#' + id)};
  const named = {};
  for (const id of ['questionBody', 'questionTitle', 'questionCopy', 'questionStage', 'persistenceNotice', 'resultsStage',
    'backBtn', 'continueBtn', 'skipBtn', 'beginBtn', 'restartBtn']) {
    const element = new Element(id.endsWith('Btn') ? 'button' : 'div'); element.id = id; body.appendChild(element); named[id] = element;
  }
  let url = new URL('https://fixture.invalid/operational-systems.html?resume_run=' + resumeRunId);
  const location = {get href() { return url.href; }, get search() { return url.search; }};
  const item = {id: 'synthetic-current-question', questionType: 'single_select', isOptional: false,
    text: {operational: 'Synthetic question', managerial: 'Synthetic question', senior_leader: 'Synthetic question'}, options: [{value: 'first', label: 'Synthetic answer'}]};
  const state = {mode: 'managerial', depth: '30', runId: RUN, currentItem: clone(item), configVersion: '1.3.1',
    answerCache: {}, questionHistory: [], preflight: {}, experienceIndex: 0, experienceComplete: false, experiential: {},
    started: true, recoveryInFlight: false, answerInFlight: false, finalizeInFlight: false, startInFlight: false};
  const remote = {ok: true, runId: RUN, role: 'managerial', depth: 30, finalized, shouldStop: finalized,
    nextItem: finalized ? null : clone(item), sessionRevision: 7, answerHistory: [], progress: {},
    questionnaire_version: '1.3.1', configVersion: '1.3.1', routingVersion: '1.3.1', context: {processName: 'Synthetic process', peopleAffected: 8}};
  const counts = {reads: 0, authReads: 0, installs: 0, renders: 0, restarts: 0, finalizes: 0, finalizeRunIds: []};
  const harness = {store, document, state, remote, counts, currentUser: USER, readStatus: 200, onRead: null};
  const client = {auth: {getUser: async () => { counts.authReads++; return {data: {user: {id: harness.currentUser}}, error: null}; }}};
  const window = {sessionStorage: storage, location, __mondermanActiveOrganizationId: ORG,
    mondermanWorkspaceAccessReady: Promise.resolve({allowed: true, context: 'workspace'}),
    mondermanGetSupabaseClient: async () => client, confirm: () => true, setTimeout};
  const sandbox = vm.createContext({window, document, location, state, URL, URLSearchParams, setTimeout,
    history: {replaceState: (_state, _title, value) => { url = new URL(value, url); }},
    ...named, API_BASE: 'https://synthetic-api.invalid', ANSWER_TIMEOUT_MS: 1,
    PRESTART_FIELDS: [{id: 'processName'}, {id: 'peopleInvolved'}], selfDraft: null,
    showStage() {}, mapFrontendModeToBackendRole: value => value === 'executive' ? 'senior_leader' : value,
    fetchWithTimeout: async (target, options = {}) => {
      assert.equal(options.method || 'GET', 'GET', 'recovery must not start or mutate a run');
      assert.ok(target.endsWith('/api/operational-systems/run/' + RUN), target);
      counts.reads++; await harness.onRead?.(harness);
      return {ok: harness.readStatus === 200, status: harness.readStatus, json: async () => clone(remote)};
    },
    // Detailed bank projection has its own production browser/API suites.
    // Here count installation so changed identities cannot display any data.
    installAuthoritativeQuestionnaireHistory: value => {
      counts.installs++; state.sessionRevision = value.sessionRevision;
      state.questionHistory = clone(value.answerHistory); state.answerCache = {};
    },
    resetExperientialLayer: () => { state.experiential = {}; state.experienceComplete = false; },
    renderQuestion: () => { counts.renders++; }, setAnswerControlsBusy() {},
    queueExperienceQuestion() {}, queueConfidenceQuestion() {},
    restartDiagnostic: () => { counts.restarts++; state.runId = null; state.started = false; },
    finalizeAdaptiveRun: async () => { counts.finalizes++; counts.finalizeRunIds.push(state.runId); },
  });
  const mapsStart = source.indexOf('const EXPERIENCE_PROMPT_SETS =');
  const mapsEnd = source.indexOf('function assertCachedStaticQuestion(', mapsStart);
  assert.ok(mapsStart > 0 && mapsEnd > mapsStart);
  vm.runInContext(source.slice(mapsStart, mapsEnd), sandbox);
  for (const name of ['isRunUuid', 'checkpointSameRunUrl', 'clearSameRunUrl', 'isClientOwnedQuestion',
    'sameQuestionnaireItemCopy', 'showQuestionnaireVersionUnavailable', 'resumeOperationalSession',
    'restorePinnedQuestionnaireDraft', 'confirmRestart']) vm.runInContext(declaration(source, name), sandbox);
  vm.runInContext(controllerSource, sandbox);
  const controller = window.MondermanSelfDiagnosticDraft.createController({tool: 'operational_systems', resumeRunId, state,
    questionStage: named.questionStage, showStage() {}, renderQuestion() {}, authoritativeRunRestore: true,
    startOver: sandbox.restartDiagnostic, onRestore: saved => sandbox.restorePinnedQuestionnaireDraft(saved)});
  sandbox.selfDraft = controller;
  Object.assign(harness, {window, sandbox, controller});
  harness.seedDraft = (draftRun = RUN) => {
    const helpers = window.MondermanSelfDiagnosticDraft._test;
    const index = helpers.activeKey(USER, ORG, 'operational_systems');
    const key = helpers.draftKey(USER, ORG, 'operational_systems', '1.3.1', draftRun);
    const saved = {version: 1, key, user_id: USER, organization_id: ORG, tool: 'operational_systems',
      config_version: '1.3.1', draft_id: draftRun, saved_at: new Date().toISOString(), state: {...clone(state), runId: draftRun}};
    store.set(index, key); store.set(key, JSON.stringify(saved)); return {index, key, saved};
  };
  return harness;
}

async function settle(harness) {
  for (let turn = 0; turn < 20; turn++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!harness.state.recoveryInFlight) { await Promise.resolve(); return; }
  }
  assert.fail('synthetic recovery did not settle');
}

async function mismatchClear(options = {}) {
  const h = makeHarness({...options, resumeRunId: OTHER});
  const {index, key} = h.seedDraft(); const before = new Map(h.store);
  assert.equal(await h.controller.activate(), false);
  assert.equal(h.controller.restore(OTHER), false);
  h.controller.clear();
  assert.equal(h.store.get(key), before.get(key), 'unowned different-run draft must survive Clear/Start over');
  assert.equal(h.store.get(index), key, 'the other run must retain its active draft index');
  assert.equal(h.counts.reads, 0);
}
await mismatchClear(); results.push('different-run draft and index survive unowned clear');

for (const change of ['user', 'organization']) {
  const h = makeHarness(); const {key} = h.seedDraft(); const before = h.store.get(key);
  await h.controller.activate();
  h.onRead = () => { if (change === 'user') h.currentUser = OTHER; else h.window.__mondermanActiveOrganizationId = OTHER; };
  assert.equal(h.controller.restore(RUN), true); await settle(h);
  assert.equal(h.counts.reads, 1, `${change}: the accepted GET must actually reach the identity-race checkpoint`);
  assert.ok(h.counts.authReads >= 3, `${change}: activation and both sides of the GET verify identity`);
  assert.equal(h.counts.installs, 0, `${change}: changed identity must not install history`);
  assert.equal(h.counts.renders, 0, `${change}: changed identity must not render history`);
  assert.equal(h.counts.finalizes, 0); assert.equal(h.store.get(key), before);
  assert.equal(h.document.getElementById('questionTitle').textContent, 'Your saved questionnaire needs verification');
  assert.equal(h.state.recoveryInFlight, false);
  results.push(`${change} changed during draft GET is rejected before display`);
}

{
  const h = makeHarness(); h.seedDraft(); await h.controller.activate();
  h.onRead = () => {
    assert.equal(h.state.recoveryInFlight, true, 'matching-draft recovery owns the shared mutation lock');
    h.sandbox.confirmRestart();
    assert.equal(h.state.runId, RUN, 'Restart cannot race the in-progress restore');
  };
  h.controller.restore(RUN); await settle(h);
  assert.equal(h.counts.restarts, 0); assert.equal(h.counts.installs, 1); assert.equal(h.counts.renders, 1);
  assert.equal(h.state.recoveryInFlight, false); results.push('matching-draft GET blocks Restart until settled');
}

{
  const h = makeHarness(); h.seedDraft(); await h.controller.activate();
  h.onRead = () => { h.state.runId = OTHER; h.document.getElementById('questionTitle').textContent = 'Synthetic newer flow'; };
  h.controller.restore(RUN); await settle(h);
  assert.equal(h.counts.reads, 1);
  assert.equal(h.counts.installs, 0);
  assert.equal(h.document.getElementById('questionTitle').textContent, 'Synthetic newer flow', 'stale failure cannot paint over a newer flow');
  results.push('stale restore callback leaves a newer flow untouched');
}

{
  const h = makeHarness({finalized: true}); h.state.runId = null; h.state.configVersion = null;
  assert.equal(await h.sandbox.resumeOperationalSession(RUN), true);
  assert.equal(h.counts.reads, 1); assert.equal(h.counts.finalizes, 0, 'identifier-only recovery is read-only until the explicit action');
  assert.doesNotMatch(h.document.getElementById('questionTitle').textContent, /already been submitted/i);
  const button = h.document.getElementById('finishSavedRunBtn');
  assert.ok(button, 'closed answers alone must still offer same-run completion when no saved report exists');
  await button.click(); assert.deepEqual(h.counts.finalizeRunIds, [RUN]);
  assert.equal(h.counts.restarts, 0); results.push('fenced-but-unsaved run offers explicit same-run Finish/Open');
}

{
  const h = makeHarness(); const {key} = h.seedDraft(); await h.controller.activate();
  assert.equal(h.controller.restore(OTHER), false, 'directed retry cannot restore a different pending draft');
  h.readStatus = 503; h.controller.restore(RUN); await settle(h);
  assert.equal(h.counts.installs, 0); assert.equal(h.controller.saveAccepted(), false);
  const retry = h.document.getElementById('resumeSavedRunBtn'); assert.ok(retry);
  h.readStatus = 200; await retry.click(); await settle(h);
  assert.equal(h.counts.reads, 2); assert.equal(h.counts.installs, 1);
  h.state.experiential.self = 'Synthetic participant note after successful recovery';
  assert.equal(h.controller.saveAccepted(), true, 'successful UI retry must release the failed-restore save guard');
  assert.equal(JSON.parse(h.store.get(key)).state.experiential.self, h.state.experiential.self);
  assert.equal(h.counts.finalizes, 0); assert.equal(h.counts.restarts, 0);
  results.push('failed verification then actual Retry click resumes scoped draft saving');
}

// Prove that the unowned-clear assertion rejects the original regression,
// using an in-memory mutation only; production files remain untouched.
const unsafeClear = draftSource.replace('if (ownsIndex) storageRemove(indexKey);', 'if (indexed) storageRemove(indexed); if (indexKey) storageRemove(indexKey);');
assert.notEqual(unsafeClear, draftSource);
await assert.rejects(mismatchClear({controllerSource: unsafeClear}), /unowned different-run draft must survive/);

console.log(JSON.stringify({status: 'OS_RECOVERY_IDENTITY_PASS', cases: results.length, results,
  rejectedNegativeMutations: 1, actualSourceSha256: {
    'operational-systems.html': createHash('sha256').update(html).digest('hex'),
    'self-diagnostic-draft.js': createHash('sha256').update(draftSource).digest('hex')},
  networkCalls: 0, providerCalls: 0, databaseCalls: 0, writtenFiles: 0}, null, 2));
