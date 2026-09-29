// Offline regression for the shared overview and its financial boundaries.
// Reads current approved sample sources and saved engine-run fixtures. Synthetic
// mutations below are display counterexamples, not reports or new AI output.
// No provider, browser, account, network, publication or filesystem writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const rendererBytes = read('monderman-report.js');
const sampleBytes = read('sample-data/production-diagnostic-samples.json');
const artifact = JSON.parse(sampleBytes);
const runs = JSON.parse(read('test-fixtures/authenticated-report-engine-runs.json'));
const scenarios = JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const baselineCommit = '61de1fbb0737a5b2af8cb4059bddae81226f95a2';
const baselineSource = execFileSync('git', ['show', baselineCommit + ':monderman-report.js'], {cwd:root, encoding:'utf8', maxBuffer:4e6});
function renderer(source) {
  const box = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
  vm.createContext(box);
  for (const [file, bytes] of [['participant-evidence-safety.js', read('participant-evidence-safety.js')], ['monderman-report.js', source], ['public-sample-model.js', read('public-sample-model.js')]]) vm.runInContext(bytes, box, {filename:file});
  return {report:box.window.MondermanReport, samples:box.window.MondermanPublicSamples};
}
const {report:R, samples:Public} = renderer(rendererBytes);
const prior = renderer(baselineSource).report;
let checks = 0, documents = 0;
const ok = (value, message) => {assert.ok(value, message); checks++;};
const eq = (actual, expected, message) => {assert.deepEqual(actual, expected, message); checks++;};
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&#x27;':"'",'&nbsp;':' '})[entity]);
const normalize = value => decode(value).replace(/\s+/g, ' ').trim();
const has = (node, name) => (node?.attrs.class || '').split(/\s+/).includes(name);
const flatten = node => [node, ...node.children.flatMap(flatten)];
const all = (node, name) => flatten(node).filter(item => has(item, name));
const text = node => node ? normalize(node.content.map(part => typeof part === 'string' ? part : text(part)).join(' ')) : '';
// This is a structural reader for escaped renderer-owned markup, not a general
// browser DOM. Script and style bodies are ignored and never executed.
function parse(html) {
  const document = {tag:'root', attrs:{}, children:[], content:[], start:0, end:html.length};
  const stack = [document], voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let last = 0;
  for (const match of html.matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b([^<>]*?)>/gi)) {
    stack.at(-1).content.push(html.slice(last, match.index)); last = match.index + match[0].length;
    if (match[0].startsWith('<!--') || match[1]) continue;
    const tag = match[2].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index > 0) {stack[index].end = last; stack.length = index;}
      continue;
    }
    const node = {tag, attrs:Object.fromEntries([...match[3].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])])), children:[], content:[], parent:stack.at(-1), start:match.index, end:last};
    stack.at(-1).children.push(node); stack.at(-1).content.push(node);
    if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  stack.at(-1).content.push(html.slice(last));
  return document;
}
function inspect(label, model) {
  const before = JSON.stringify(model); freeze(model);
  const html = R.buildReportHtml(model), tree = parse(html), page = all(tree, 'mr-page')[0];
  eq(JSON.stringify(model), before, label + ': rendering preserves frozen model');
  ok(page, label + ': report page exists');
  eq(all(page, 'mr-report-overview').length, 1, label + ': exactly one overview');
  const cover = all(page, 'mr-cover')[0], overview = all(page, 'mr-report-overview')[0];
  const white = all(cover, 'mr-cover-white')[0], grid = all(overview, 'mr-overview-grid')[0];
  eq(cover.attrs['data-overview-first'], 'true', label + ': shared overview-first cover');
  eq(grid.children.length, 4, label + ': four direct tiles');
  eq(grid.children.map(node => node.attrs['data-report-link-role']), ['overview-findings','overview-value','overview-actions','overview-evidence'], label + ': stable ordered tile roles');
  const overviewAt = white.children.indexOf(overview);
  ok(overviewAt >= 0, label + ': overview is in cover reading order');
  for (const name of ['mr-cover-score-row','mr-cover-pills','mr-cover-meta','mr-cover-body','mr-cover-boundary']) {
    for (const detail of all(white, name)) ok(white.children.indexOf(detail) > overviewAt, label + ': overview precedes ' + name);
  }
  const nodes = flatten(page), ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  eq(ids.length, new Set(ids).size, label + ': IDs are unique');
  const byId = new Map(nodes.filter(node => node.attrs.id).map(node => [node.attrs.id,node]));
  for (const anchor of nodes.filter(node => node.tag === 'a' && node.attrs.href?.startsWith('#'))) {
    ok(byId.has(anchor.attrs.href.slice(1)), label + ': internal target resolves ' + anchor.attrs.href);
    if (anchor.attrs['data-report-link-role'] === 'overview') eq(anchor.attrs.href, '#' + overview.attrs.id, label + ': back link targets overview');
  }
  for (const tile of grid.children) {
    eq(tile.tag, 'a', label + ': whole tile is an anchor');
    ok(text(all(tile, 'mr-overview-content')[0]).length > 10, label + ': tile has meaningful content');
    eq(flatten(tile).filter(node => ['a','button','input','select','textarea'].includes(node.tag)).length, 1, label + ': no nested interactive controls');
    const target = byId.get(tile.attrs.href.slice(1));
    ok(target && target !== cover && target !== overview, label + ': tile advances to detail');
    const section = target?.tag === 'section' ? target : target?.parent;
    ok(section && all(section, 'mr-section-back').length > 0, label + ': destination offers overview return');
  }
  ok(has(overview, 'mr-screen-only'), label + ': overview remains hidden in print');
  ok(/@media print\s*\{\s*\.mr-screen-only\s*\{\s*display:none!important/.test(html), label + ': explicit print suppression');
  ok(!/\[object Object\]|\bNaN\b|\bundefined\b/.test(text(page)), label + ': no missing-value artifacts');
  documents++;
  return {label, model, html, page, overview, tiles:grid.children, value:grid.children[1], byId};
}
function fromRaw(label, raw, adapter = 'fromSynthesis') {
  const before = JSON.stringify(raw); freeze(raw);
  const result = inspect(label, R[adapter](raw));
  eq(JSON.stringify(raw), before, label + ': adapter and renderer preserve frozen raw source');
  return result;
}
function eligibilityCopy(value, label) {
  const copy = text(value);
  ok(/Depth Synthesis/i.test(copy) && /Cross[-‑ ]Lens Synthesis/i.test(copy), label + ': explains eligible report types');
  ok(/participation/i.test(copy) && /coverage/i.test(copy), label + ': explains evidence requirements');
  ok(/\btime\b/i.test(copy) && /pay|labor|hourly/i.test(copy) && /spending|expense/i.test(copy), label + ': explains financial inputs');
}
const numericFinancialClasses = ['mr-overview-benefit','mr-overview-sankey','mr-overview-flow','mr-benefit-panel','mr-scenario-metric','mr-benefit-cards'];
function noFinancialNumbers(result) {
  for (const name of numericFinancialClasses) eq(all(result.page, name).length, 0, result.label + ': no numeric/blank financial cards ' + name);
  ok(!flatten(result.page).some(node => ['data-saved-value','data-financial-central','data-financial-metric','data-three-benefit-case'].some(key => key in node.attrs)), result.label + ': no numeric financial output markers');
  ok(!/\$\s*[\d,]+|\b\d[\d,.]*\s*(?:hours|USD|dollars)\b/i.test(text(result.value)), result.label + ': no invented financial values in tile');
}
function noneligible(result) {
  eligibilityCopy(result.value, result.label + '/overview');
  const detail = result.byId.get(result.value.attrs.href.slice(1));
  ok(has(detail, 'mr-financial-brief'), result.label + ': financial tile targets financial explanation');
  eligibilityCopy(detail, result.label + '/detail');
  ok(/financial.*(?:assessment|benefit|estimate)/i.test(text(detail.children.find(node => /^h[1-6]$/.test(node.tag)))), result.label + ': named financial detail section');
  noFinancialNumbers(result);
}
// CSS declaration contracts only; a separate browser check certifies geometry.
ok(/\.mr-cover\[data-overview-first="true"\] \.mr-overview-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(rendererBytes), 'approved desktop overview is two columns');
ok(/\.mr-cover\[data-overview-first="true"\] \.mr-overview-title\{[^}]*background:#09383E/i.test(rendererBytes), 'approved dark teal headings');
ok(/@media\(max-width:700px\)\{\.mr-cover\[data-overview-first="true"\] \.mr-overview-grid\{grid-template-columns:minmax\(0,1fr\)/.test(rendererBytes), 'phone overview is one column');

const currentModels = [];
eq(Object.keys(artifact.outputs).length, 6, 'all six current samples present');
for (const [key, entry] of Object.entries(artifact.outputs)) {
  const before = JSON.stringify(entry); freeze(entry);
  const model = Public.model(entry, artifact), result = inspect('sample/' + key, model);
  eq(JSON.stringify(entry), before, key + ': public adapter preserves source and provenance');
  currentModels.push([key, model]);
  const raw = fromRaw('raw-synthesis/' + key, structuredClone(entry.source));
  if (entry.kind === 'response_comparison') {noneligible(result); noneligible(raw);}
  else {
    const oldModel = prior.fromSynthesis(entry.source), oldHtml = prior.buildReportHtml(oldModel), oldTree = parse(oldHtml);
    for (const name of ['mr-overview-sankey','mr-benefit-panel','mr-benefit-assumption']) {
      const currentNodes = all(raw.page, name), priorNodes = all(oldTree, name);
      ok(priorNodes.length > 0, key + ': baseline has ' + name);
      eq(currentNodes.map(node => raw.html.slice(node.start,node.end)), priorNodes.map(node => oldHtml.slice(node.start,node.end)), key + ': approved financial chart bytes unchanged: ' + name);
    }
  }
}
eq(Object.keys(runs.outputs).length, 4, 'four actual engine-run fixtures present');
for (const [key, envelope] of Object.entries(runs.outputs)) {
  const result = fromRaw('engine-run/' + key, structuredClone(envelope), 'fromRun');
  currentModels.push(['engine-run/' + key, result.model]);
  noneligible(result);
  eq(result.model.score, envelope.result.score, key + ': recorded score retained');
  const persisted = fromRaw('persisted-run/' + key, structuredClone(envelope.result), 'fromRun');
  noneligible(persisted);
  for (const metric of ['annual_cost','recoverable_cost']) {
    const value = envelope.result.exposure?.[metric];
    if (Number.isFinite(value) && value > 1000) for (const printed of [String(value), value.toLocaleString('en-US')]) ok(!text(result.page).includes(printed), key + ': suppressed historical ' + metric);
  }
}
// An in-flight report can contain a stale saved interpretation. Its overview
// must not expose that text until completion, or lose any navigation targets.
for (const [key, model] of currentModels) {
  for (const status of ['pending','processing','attention_required','rejected','unavailable','']) {
    const changed = structuredClone(model);
    changed.aiReport = {status, report:{interpretation:{summary:'STALE_OVERVIEW_SUMMARY', action_options:[{action:'STALE_OVERVIEW_OPTION',intensity:'limited'}], recommendations:[{action:'STALE_OVERVIEW_ACTION'}]}}};
    const result = inspect(key + '/ai-' + (status || 'missing-status'), changed);
    ok(!text(result.overview).includes('STALE_OVERVIEW_'), result.label + ': unfinished interpretation is not shown');
    eq(all(result.tiles[2], 'mr-overview-options').length, 0, result.label + ': no unfinished AI action list');
    if (model.kind === 'run' || model.comparisonOnly) noneligible(result);
  }
}

const depth = artifact.outputs.depth_synthesis.source;
function synthesisCase(label, change) {
  const raw = structuredClone(depth); change(raw);
  return fromRaw(label, raw);
}
for (const status of ['published','withheld']) {
  const result = synthesisCase('self-run/' + status, raw => {raw.source_mode='own_saved_runs'; raw.report_kind='self_run_synthesis'; raw.score_status=status;});
  noneligible(result);
  ok(!text(result.overview).includes('organization-wide savings'), result.label + ': no organizational savings claim');
}
for (const kind of ['self_run_synthesis','self_run_response_comparison']) for (const status of ['published','withheld']) {
  const result = synthesisCase('self-run-no-ai/' + kind + '/' + status, raw => {
    raw.source_mode='own_saved_runs'; raw.report_kind=kind; raw.score_status=status; delete raw.ai_report;
  });
  noneligible(result);
  const findings = result.byId.get(result.tiles[0].attrs.href.slice(1));
  const financial = result.byId.get(result.tiles[1].attrs.href.slice(1));
  const actions = result.byId.get(result.tiles[2].attrs.href.slice(1));
  ok(has(findings, 'mr-self-run-views'), result.label + ': findings target recorded self-run views');
  ok(has(financial, 'mr-financial-availability'), result.label + ': financial tile targets its explanation');
  eq(actions.attrs.id, findings.attrs.id, result.label + ': guidance without AI falls back to recorded views');
  ok(findings.attrs.id !== financial.attrs.id, result.label + ': findings and finance have distinct destinations');
}
for (const mode of ['missing','invalid','partial']) {
  const result = synthesisCase('eligible-finance/' + mode, raw => {
    if (mode === 'missing') delete raw.financial_scenario;
    if (mode === 'invalid') raw.financial_scenario.totals.existingSpendingReduction.central += 4321;
    if (mode === 'partial') {raw.financial_scenario=structuredClone(scenarios.cases.partial); raw.campaign_evidence.scopeId=raw.financial_scenario.scope.scopeId;}
  });
  ok(!/when the campaign meets|participation and coverage requirements/i.test(text(result.value)), result.label + ': eligible reports are not described as waiting for participation');
  ok(/not.*estimated|incomplete|missing|complete|valid|inputs|recorded/i.test(text(result.value)), result.label + ': financial-input state is explained');
  eq(all(result.overview, 'mr-overview-sankey').length, 0, result.label + ': no complete overview chart for incomplete estimates');
  if (mode !== 'partial') noFinancialNumbers(result);
}
const early = synthesisCase('comparison/valid-early-scenario', raw => {
  raw.report_kind='response_comparison'; raw.score_status='withheld'; raw.financial_scenario.kind='early_planning_scenario';
});
ok(/early planning/i.test(text(early.value)), 'valid early comparison clearly labels its financial scenario');
ok(all(early.page, 'mr-benefit-panel').length > 0, 'valid early comparison retains saved planning cases');
ok(/does not unlock Synthesis/i.test(text(early.page)), 'early scenario does not claim synthesis eligibility');

// A valid earlier saved format remains available. Zero-value operational
// records are explicit here; they are not inferred from absent financial data.
const zeroRange = () => ({low:0,central:0,high:0});
const priorActivity = {id:'fixture-recorded-activity', label:'Fixture recorded activity', measuredHours:0, loadedHourlyCost:50,
  sourceBasis:'operational_records', sourceReference:'Synthetic display fixture: recorded zero activity hours',
  changeBasis:'Synthetic fixture: no activity reduction assumed', cashBasis:'Synthetic fixture: no cash saving assumed',
  reductionPercent:zeroRange(), adoptionPercent:zeroRange(), avoidableNonLaborCash:zeroRange()};
for (const kind of ['early_planning_scenario','synthesis_planning_scenario']) {
  const legacy = synthesisCase('legacy-finance/' + kind, raw => {
    if (kind === 'early_planning_scenario') {raw.report_kind='response_comparison'; raw.score_status='withheld';}
    delete raw.financial_benefit_assessment;
    raw.financial_scenario = {version:'operational-planning-scenario-20260913.1', kind, currency:'USD', digest:'a'.repeat(64),
      title:'Synthetic display fixture for earlier saved planning format', scope:{scopeId:raw.campaign_evidence.scopeId,label:'Local display fixture'},
      notice:'Explicit recorded zeros in a synthetic display fixture, not absent estimates.',
      method:{usesDiagnosticScores:false,isConfidenceInterval:false,calculation:'Fixture recorded activity inputs',extrapolation:'No extrapolated benefit'},
      participation:{statement:kind==='early_planning_scenario' ? 'Early scenario; campaign participation checks are not satisfied.' : 'Synthetic eligible display fixture.'},
      inputs:{activities:[structuredClone(priorActivity)], measuredPeople:1, horizonMonths:1,
        measurementStart:'2026-08-01T00:00:00Z',measurementEnd:'2026-08-29T00:00:00Z',scopeConfirmed:true,overlapReviewed:true,
        implementationCashCost:zeroRange(),implementationCapacityCost:zeroRange(),subscriptionCost:0,costBasis:'Synthetic fixture: no added costs'},
      activities:[{id:priorActivity.id,label:priorActivity.label,potentialHoursFreed:zeroRange(),capacityValue:zeroRange(),avoidableNonLaborCash:zeroRange()}],
      totals:Object.fromEntries(['potentialHoursFreed','capacityValue','avoidableNonLaborCash','cashInvestment','totalImplementationAndSubscriptionCost','netCashEffect','netCapacityAndCashValue'].map(key => [key,zeroRange()]))};
  });
  ok(/available/i.test(text(legacy.value)) && !/needs review|not been prepared|incomplete/i.test(text(legacy.value)), legacy.label + ': valid saved format is available');
  eq(all(legacy.page, 'mr-scenario-metric').length, 7, legacy.label + ': saved detailed metrics remain visible');
  ok(legacy.html.includes('data-financial-presentation='), legacy.label + ': saved decision brief remains visible');
  if (kind === 'early_planning_scenario') ok(/early planning/i.test(text(legacy.value)), legacy.label + ': early saved format remains labelled');
}

for (const [label, change] of [
  ['invalid-arithmetic', raw => {raw.financial_scenario.totals.capacityValue.central += 4321;}],
  ['wrong-scope', raw => {raw.financial_scenario.scope.scopeId='unrelated-campaign';}],
  ['unrecognized-version', raw => {raw.financial_scenario.version='unsupported';}],
  ['invalid-digest', raw => {raw.financial_scenario.digest='invalid'; delete raw.financial_scenario.source_identity_digest;}]
]) {
  const result = synthesisCase('comparison/' + label, raw => {
    raw.report_kind='response_comparison'; raw.score_status='withheld'; raw.financial_scenario.kind='early_planning_scenario';
    raw.financial_scenario.title='INVALID_SCENARIO_MUST_NOT_BE_EXPOSED'; change(raw);
  });
  noFinancialNumbers(result);
  const explanation = result.byId.get(result.value.attrs.href.slice(1));
  eq(explanation.attrs['data-financial-state'], 'planning-review-needed', result.label + ': invalid saved attachment needs review');
  ok(/review|correct/i.test(text(result.value)), result.label + ': invalid attachment is explained');
  ok(!text(result.page).includes('INVALID_SCENARIO_MUST_NOT_BE_EXPOSED'), result.label + ': invalid scenario data remains hidden');
}
eq(sha(read('sample-data/production-diagnostic-samples.json')), sha(sampleBytes), 'current approved sample artifact unchanged');
eq(sha(read('monderman-report.js')), sha(rendererBytes), 'renderer unchanged during contract');
console.log(JSON.stringify({status:'PASS', checks, documents, sampleReports:6, rawEngineRuns:4,
  rendererSha256:sha(rendererBytes), sampleSha256:sha(sampleBytes), financialBaselineCommit:baselineCommit,
  providerCalls:0, networkCalls:0, writes:0, scope:'Current sample and raw adapters, overview structure, financial eligibility, source immutability, incomplete AI, and unchanged Depth/Cross charts; browser geometry is verified separately.'}));
