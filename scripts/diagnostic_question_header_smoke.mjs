// Actual-source display-only regression. Production renderQuestion, setHeader,
// lane labels and depth labels are executed unchanged. DOM, readiness, questions,
// timers and control rendering are synthetic in-memory doubles, not a browser
// recovery or API test. No storage, network, provider or filesystem writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const names = ['structural-clarity', 'decision-velocity', 'operational-systems', 'institutional-performance'];
const modes = ['operational', 'managerial', 'executive'];
const depths = ['10', '30', '60'];
const roleHeaders = {operational: 'Operational perspective selected', managerial: 'Managerial perspective selected', executive: 'Senior Leaders perspective selected'};
const root = new URL('../', import.meta.url);
const sha = text => createHash('sha256').update(text).digest('hex');
const files = Object.fromEntries(names.map(name => [name, fs.readFileSync(new URL(`${name}.html`, root), 'utf8')]));
const sourcePins = Object.fromEntries(names.map(name => [`${name}.html`, sha(files[name])]));
const results = [];

// Extract complete declarations between explicit adjacent top-level markers.
// Do not stop at a brace: production functions contain unindented nested blocks.
function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  assert.equal(source.indexOf(startMarker, start + startMarker.length), -1, `ambiguous ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing ${endMarker}`);
  const body = source.slice(start, end);
  new vm.Script(body); // Syntax compilation only, before execution with doubles.
  return body;
}

function element() {
  return {textContent: '', innerHTML: '', style: {}, disabled: false, title: '',
    children: [], appendChild(child) { this.children.push(child); return child; },
    classList: {add() {}, remove() {}},
  };
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}

function exercise(name, {mode = 'managerial', depth = '30', kind = 'ordinary', animated = false, interview = false, verified = true, missingItem = false, withoutHeaderFix = false} = {}) {
  const source = files[name];
  const labels = between(source, 'const laneConfigs = {', 'const state = {');
  const header = between(source, 'function setHeader(', 'function setProcessingStep(');
  let render = between(source, 'function renderQuestion() {', 'function renderQuestionContent(');
  if (withoutHeaderFix) {
    const calls = [...render.matchAll(/\bsetHeader\([\s\S]*?\);/g)];
    assert.equal(calls.length, 1, 'negative control must remove exactly the new header display call');
    render = render.replace(calls[0][0], '/* In-memory negative: original missing header synchronization. */');
  }
  const item = {id: kind === 'optional' ? '_*experience*self' : kind === 'confidence' ? '**confidenceLevel**' : 'synthetic-ordinary-question',
    questionType: kind === 'optional' ? 'text' : 'single_select', isOptional: kind === 'optional',
    text: {operational: 'Synthetic question', managerial: 'Synthetic question', senior_leader: 'Synthetic question'},
    questionCopy: 'Synthetic question copy', options: [{value: 'synthetic', label: 'Synthetic option'}]};
  const state = freeze({mode, depth, currentItem: missingItem ? null : item,
    runId: '33333333-3333-4333-8333-333333333333', configVersion: 'synthetic-verified-version',
    roleForText: mode === 'executive' ? 'senior_leader' : mode,
    answerInFlight: false, finalizeInFlight: false, started: true,
    answerCache: {'prior-question': 'unchanged'}, questionHistory: [{itemId: 'prior-question', value: 'unchanged'}],
    currentProgress: {answered: 1}, preflight: {processName: 'Synthetic scope'}, sessionRevision: 7,
  });
  const before = JSON.stringify(state), timers = [], counts = {content: 0, progress: 0, interview: 0, readiness: 0};
  const nodes = Object.fromEntries(['envHeadline', 'envSubcopy', 'statusPill', 'questionCluster', 'questionStep', 'questionTitle', 'questionCopy', 'questionBody', 'continueBtn', 'skipBtn', 'backBtn'].map(id => [id, element()]));
  nodes.envHeadline.textContent = 'Choose participant perspective';
  nodes.envSubcopy.textContent = 'Select the perspective that best matches your role, then choose the diagnostic length.';
  nodes.statusPill.textContent = 'Awaiting selection';
  const beforeHeader = [nodes.envHeadline.textContent, nodes.envSubcopy.textContent, nodes.statusPill.textContent];
  const sandbox = vm.createContext({...nodes, state,
    document: {querySelector(selector) { assert.equal(selector, '#questionStage .question-card'); return animated ? element() : null; }},
    window: interview ? {MondermanInterview: {shouldHandle: () => true, present: () => { counts.interview++; }}} : {},
    ensureQuestionnaireCopyReady: () => { counts.readiness++; return verified; },
    displayQuestionTopic: () => 'Synthetic question topic',
    getQuestionRoleText: text => text[state.roleForText], getQuestionnaireFallbackCopy: () => 'Synthetic fallback',
    clearQuestionRequired() {}, updateQuestionAffordance() {}, setAnswerControlsBusy() {},
    renderQuestionContent: current => { assert.equal(current, item); counts.content++; return element(); },
    updateProgress: () => { counts.progress++; },
    setTimeout: (callback, delay) => { assert.ok(delay === 140 || delay === 300); timers.push(callback); return timers.length; },
  });
  vm.runInContext(`'use strict';\n${labels}\n${header}\n${render}\nrenderQuestion();`, sandbox);
  while (timers.length) timers.shift()();
  assert.equal(JSON.stringify(state), before, 'display synchronization must not mutate answers, session, role/depth or recovery state');
  const observed = [nodes.envHeadline.textContent, nodes.envSubcopy.textContent, nodes.statusPill.textContent];
  if (!verified || missingItem) {
    assert.deepEqual(observed, beforeHeader, 'unverified or absent item must not claim an active diagnostic');
    assert.equal(counts.content, 0); assert.equal(counts.interview, 0); assert.equal(counts.progress, 0);
  } else {
    assert.deepEqual(observed, [`${roleHeaders[mode]} • ${depth}-minute diagnostic`, 'Questions adjust to your answers.', 'Diagnostic in progress']);
    assert.equal(interview ? counts.interview : counts.content, 1, 'actual render function must reach its content path');
    assert.ok(counts.progress >= 1);
    assert.ok(!observed.some(text => /Awaiting selection|Choose participant perspective/.test(text)));
  }
}

for (const name of names) {
  for (const mode of modes) for (const depth of depths) {
    for (const kind of ['ordinary', 'optional', 'confidence']) for (const animated of [false, true]) {
      exercise(name, {mode, depth, kind, animated}); results.push({name, mode, depth, kind, animated, pass: true});
    }
    exercise(name, {mode, depth, interview: true, animated: true});
    results.push({name, mode, depth, kind: 'interview', animated: true, pass: true});
  }
  for (const [verified, missingItem] of [[false, false], [true, true], [false, true]]) {
    exercise(name, {verified, missingItem}); results.push({name, verified, missingItem, guard: true, pass: true});
  }
  assert.throws(() => exercise(name, {withoutHeaderFix: true}), /deep-equal/,
    `${name}: removal of display fix must reproduce stale header and fail`);
  results.push({name, negativeControl: 'original header omission rejected', pass: true});
}
for (const name of names) assert.equal(sha(fs.readFileSync(new URL(`${name}.html`, root), 'utf8')), sourcePins[`${name}.html`], 'production source changed during test');
console.log(JSON.stringify({pass: true, mode: 'actual-source-functions-with-synthetic-DOM', cases: results.length,
  roleDepthCells: names.length * modes.length * depths.length, successfulQuestionRenders: 252,
  guardCases: 12, omissionNegativeControls: 4, diagnosticStateMutations: 0,
  storageCalls: 0, networkCalls: 0, providerCalls: 0, realBrowserUsed: false,
  sourcePins, coverage: {lenses: names, roles: modes, depths, questionKinds: ['ordinary', 'optional', 'confidence', 'interview'],
    renderPaths: ['immediate', 'deferred animation'],
    perLensPassingCases: Object.fromEntries(names.map(name => [name, results.filter(result => result.name === name).length]))}}, null, 2));
