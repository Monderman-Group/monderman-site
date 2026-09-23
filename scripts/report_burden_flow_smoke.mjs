// Independent checks of the public renderer's exported burden-flow contract.
// Uses saved public samples and explicitly synthetic in-memory edge cases.
// No browser, source mutation, account, provider, approval or network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const renderer = read('monderman-report.js');
const artifactBytes = read('sample-data/production-diagnostic-samples.json');
const artifact = JSON.parse(artifactBytes);
const fixtures = JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const levels = ['low', 'central', 'high'];
const costCase = {low: 'high', central: 'central', high: 'low'};
const moneyCategories = ['spendingReduction', 'spendingAvoidance'];
const context = {window: {}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
vm.runInNewContext(read('participant-evidence-safety.js'), context);
vm.runInNewContext(renderer, context);
const report = context.window.MondermanReport;
let checks = 0, sectionsChecked = 0, sourcesChecked = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
// Saved figures are rounded independently to hundredths. Allow only their
// rounding gap plus floating-point precision, never percentage-based drift.
const close = (actual, expected, label, rows = 1) => {
  ok(Number.isFinite(actual) && Number.isFinite(expected), label + ': finite');
  const tolerance = .005 * (rows + 1) + 1e-6 + Number.EPSILON * Math.max(Math.abs(actual), Math.abs(expected)) * 4;
  ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' != ' + expected);
};
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
const numeric = (attrs, name, label) => {
  ok(Object.hasOwn(attrs, name) && attrs[name].trim() !== '', label + ': ' + name + ' present');
  const value = Number(attrs[name]);
  ok(Number.isFinite(value), label + ': ' + name + ' finite');
  return value;
};
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

function expectedSources(s, level) {
  const result = new Map();
  const moneyRows = moneyCategories.flatMap(category =>
    s.inputs[category].items.map(input => {
      const saved = s.spendingItems.find(row => row.id === input.id);
      const baseline = input.baselineMonthlyUnits * input.unitCost * (input.endMonth - input.startMonth + 1);
      return {id: input.id, category, input, baseline, released: saved.amount[level]};
    }));
  if (moneyRows.some(row => row.baseline > 0)) result.set('money', {unit: 'USD', rows: moneyRows});
  const capacity = s.inputs.capacity;
  const measuredDays = (Date.parse(capacity.measurementEnd) - Date.parse(capacity.measurementStart)) / 86400000;
  const rows = capacity.activities.map(input => {
    const saved = s.activities.find(row => row.id === input.id);
    // Reconstruct only the denominator from declared dates and measurement;
    // benefit estimates themselves must come from the saved result fields.
    const baseline = input.measuredHours * (s.inputs.horizonMonths * 365.25 / 12) / measuredDays;
    return {id: input.id, input, baseline, released: saved.grossHoursFreed[level],
      reduction: saved.hoursUsedForSpendingReduction[level], avoidance: saved.hoursUsedForSpendingAvoidance[level], retained: saved.potentialHoursFreed[level]};
  });
  if (rows.length && rows.some(row => row.baseline > 0)) result.set('workload', {unit: 'hours', rows});
  return result;
}

// This intentionally creates an unapproved display fixture. A zero reduction
// with an estimated, positive baseline must draw only the remaining burden.
function zeroEstimatedScenario() {
  const s = structuredClone(fixtures.cases.complete);
  const zero = () => ({low: 0, central: 0, high: 0});
  for (const input of s.inputs.capacity.activities) input.reductionPercent = zero();
  for (const category of moneyCategories) for (const input of s.inputs[category].items) input.reductionPercent = zero();
  for (const row of s.activities) {
    for (const key of ['grossHoursFreed', 'hoursUsedForSpendingReduction', 'hoursUsedForSpendingAvoidance', 'potentialHoursFreed', 'capacityValue']) row[key] = zero();
    for (const month of row.monthlyReconciliation) for (const key of Object.keys(month)) if (key !== 'month') month[key] = zero();
  }
  for (const row of s.spendingItems) {
    row.amount = zero(); row.allocatedHours = zero();
    for (const month of row.monthlyAllocations) month.allocatedHours = zero();
  }
  for (const benefit of Object.values(s.benefits)) { benefit.amount = zero(); if (benefit.hours) benefit.hours = zero(); }
  for (const key of ['grossPotentialHoursFreed', 'potentialHoursFreed', 'capacityValue', 'existingSpendingReduction', 'futureSpendingAvoidance', 'knownBenefitSubtotal']) s.totals[key] = zero();
  for (const level of levels) {
    s.totals.netExistingCashEffect[level] = -s.totals.cashInvestment[costCase[level]];
    s.totals.netCashEffect[level] = -s.totals.cashInvestment[costCase[level]];
    s.totals.netCapacityAndCashValue[level] = -s.totals.totalImplementationAndSubscriptionCost[costCase[level]];
    s.totals.netKnownBenefitSubtotal[level] = s.totals.netCapacityAndCashValue[level];
  }
  return s;
}

const scenarios = {...fixtures.cases, 'zero-estimated': zeroEstimatedScenario()};
// Production-calculator fixture: independently rounded .01 + .01 + .11
// hour components must fit inside the .12 hours actually released.
scenarios['rounded-hour-components'] = JSON.parse(read('scripts/fixtures/burden-rounding-scenario.json'));
// Large declared units and prices are permitted independently. Their baseline
// can exceed the saved-result limit even with a valid zero reduction estimate.
scenarios['huge-baseline'] = zeroEstimatedScenario();
Object.assign(scenarios['huge-baseline'].inputs.spendingReduction.items[0], {baselineMonthlyUnits: 1e9, unitCost: 1e9});
scenarios['subnormal-baseline'] = zeroEstimatedScenario();
{
  const s = scenarios['subnormal-baseline'], input = s.inputs.spendingReduction.items[0];
  Object.assign(input, {baselineMonthlyUnits: Number.MIN_VALUE, unitCost: 1, startMonth: 1, endMonth: 1});
  s.inputs.spendingReduction.items = [input];
  s.spendingItems = s.spendingItems.filter(row => row.category !== 'spendingReduction' || row.id === input.id);
  s.spendingItems.find(row => row.id === input.id).activeMonths = 1;
  // Money is one combined diagram now. Keep its entire denominator subnormal
  // so the original unsafe-scale probe still tests the same failure boundary.
  for (const planned of s.inputs.spendingAvoidance.items) planned.baselineMonthlyUnits = 0;
}
// A saved result rounded to one cent can exceed a sub-cent denominator by less
// than half a cent. The affected diagram must fall back, not clamp its source.
scenarios['near-baseline-rounding'] = zeroEstimatedScenario();
{
  const s = scenarios['near-baseline-rounding'], input = s.inputs.spendingReduction.items[0];
  Object.assign(input, {baselineMonthlyUnits: 1, unitCost: .006, startMonth: 1, endMonth: 1,
    reductionPercent: {low: 100, central: 100, high: 100}, adoptionPercent: {low: 100, central: 100, high: 100}});
  const result = s.spendingItems.find(row => row.id === input.id);
  result.activeMonths = 1; result.amount = {low: .01, central: .01, high: .01};
  s.benefits.spendingReduction.amount = {low: .01, central: .01, high: .01};
  for (const level of levels) {
    s.totals.existingSpendingReduction[level] = .01;
    s.totals.knownBenefitSubtotal[level] = .01;
    s.totals.netExistingCashEffect[level] = Math.round((.01 - s.totals.cashInvestment[costCase[level]]) * 100) / 100;
    s.totals.netCashEffect[level] = s.totals.netExistingCashEffect[level];
    s.totals.netCapacityAndCashValue[level] = Math.round((.01 - s.totals.totalImplementationAndSubscriptionCost[costCase[level]]) * 100) / 100;
    s.totals.netKnownBenefitSubtotal[level] = s.totals.netCapacityAndCashValue[level];
  }
}
scenarios['untrusted-derived-period'] = structuredClone(fixtures.cases.complete);
Object.assign(scenarios['untrusted-derived-period'].method, {timeFactor: 999999, measurementDays: 1, horizonDays: 999999});
const cases = Object.entries(scenarios).map(([name, scenario]) => {
  const raw = structuredClone(artifact.outputs.depth_synthesis.source);
  raw.financial_scenario = structuredClone(scenario);
  raw.campaign_evidence.scopeId = scenario.scope.scopeId;
  delete raw.financial_benefit_assessment;
  return {name, raw};
});
for (const product of ['depth_synthesis', 'cross_lens_synthesis']) cases.push({name: product, raw: structuredClone(artifact.outputs[product].source)});

for (const {name, raw} of cases) {
  const before = JSON.stringify(raw), s = raw.financial_scenario;
  freeze(raw);
  const model = report.fromSynthesis(raw), modelBefore = JSON.stringify(model);
  const html = report.buildReportHtml(model);
  equal(JSON.stringify(raw), before, name + ': saved source unchanged');
  equal(JSON.stringify(model), modelBefore, name + ': report model unchanged');
  ok(html.includes('data-three-benefit-version="20260919.1"'), name + ': valid saved scenario accepted');
  const sections = [...html.matchAll(/<section\b([^>]*\bdata-burden-kind="[^"]+"[^>]*)>([\s\S]*?)<\/section>/g)].map(match => ({attrs: attributes(match[1]), html: match[2]}));
  if (!s.coverage.complete) {
    equal(sections.length, 0, name + ': incomplete coverage does not fabricate complete burden diagrams');
    continue;
  }
  const omittedKinds = ['huge-baseline', 'near-baseline-rounding', 'subnormal-baseline'].includes(name) ? new Set(['money']) : new Set();
  if (omittedKinds.size) {
    equal(html.split('Money: current and planned spending: the baseline cannot be drawn reliably. Refer to the saved inputs and planning table.').length - 1, 3, name + ': explicit case-by-case fallback');
    ok(!sections.some(section => omittedKinds.has(section.attrs['data-burden-kind'])), name + ': no fabricated denominator or negative-residual diagram');
  }
  const scales = new Map();
  for (const level of levels) {
    const expected = expectedSources(s, level), shown = sections.filter(section => section.attrs['data-burden-case'] === level);
    for (const kind of omittedKinds) expected.delete(kind);
    equal(shown.map(section => section.attrs['data-burden-kind']).sort(), [...expected.keys()].sort(), name + '/' + level + ': exact nonempty chart inventory');
    for (const section of shown) {
      const kind = section.attrs['data-burden-kind'], label = name + '/' + level + '/' + kind, contract = expected.get(kind);
      equal(section.attrs['data-burden-unit'], contract.unit, label + ': homogeneous unit');
      const scale = numeric(section.attrs, 'data-burden-scale', label);
      ok(scale > 0, label + ': positive scale');
      if (scales.has(kind)) equal(scale, scales.get(kind), label + ': one scale across Low/Central/High');
      else scales.set(kind, scale);
      const svg = section.html.match(/<svg\b([^>]*)>/);
      ok(svg, label + ': native SVG exists');
      const viewBox = attributes(svg[1]).viewBox?.trim().split(/\s+/).map(Number);
      equal(viewBox?.slice(0, 3), [0, 0, 200], label + ': shared SVG coordinate width');
      ok(viewBox.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3] > 0, label + ': bounded SVG height');
      const baseline = contract.rows.reduce((sum, row) => sum + row.baseline, 0);
      const released = contract.rows.reduce((sum, row) => sum + row.released, 0);
      close(scale * baseline, 180, label + ': shared baseline height');
      close(numeric(section.attrs, 'data-baseline-value', label), baseline, label + ': declared baseline', contract.rows.length);
      close(numeric(section.attrs, 'data-released-value', label), released, label + ': saved released amount', contract.rows.length);
      close(numeric(section.attrs, 'data-residual-value', label), baseline - released, label + ': residual burden', contract.rows.length);
      ok(Number(section.attrs['data-residual-value']) >= 0, label + ': no negative aggregate remainder');
      const sourceRows = [...section.html.matchAll(/<li\b([^>]*\bdata-burden-source="[^"]+"[^>]*)>([\s\S]*?)<\/li>/g)].map(match => ({attrs: attributes(match[1]), html: match[2]}));
      equal(sourceRows.map(row => row.attrs['data-burden-source']).sort(), contract.rows.map(row => row.id).sort(), label + ': every original source, even when ribbons are grouped');
      for (const expectedRow of contract.rows) {
        const row = sourceRows.find(row => row.attrs['data-burden-source'] === expectedRow.id), sourceLabel = label + '/' + expectedRow.id;
        close(numeric(row.attrs, 'data-baseline-value', sourceLabel), expectedRow.baseline, sourceLabel + ': source baseline');
        close(numeric(row.attrs, 'data-released-value', sourceLabel), expectedRow.released, sourceLabel + ': exact saved released value');
        close(numeric(row.attrs, 'data-residual-value', sourceLabel), expectedRow.baseline - expectedRow.released, sourceLabel + ': conserved source');
        ok(Number(row.attrs['data-residual-value']) >= 0, sourceLabel + ': no negative source remainder');
        if (kind === 'money') equal(row.attrs['data-burden-category'], expectedRow.category, sourceLabel + ': current and planned sources retain their own category');
        if (kind === 'workload') {
          for (const [attr, key] of [['data-spending-reduction-hours', 'reduction'], ['data-spending-avoidance-hours', 'avoidance'], ['data-retained-hours', 'retained']]) close(numeric(row.attrs, attr, sourceLabel), expectedRow[key], sourceLabel + ': saved ' + key);
          close(expectedRow.reduction + expectedRow.avoidance + expectedRow.retained, expectedRow.released, sourceLabel + ': allocated hours excluded from retained hours', 3);
        }
        sourcesChecked++;
      }
      const roles = new Map();
      let drawnTotal = 0;
      for (const match of section.html.matchAll(/<path\b([^>]*\bdata-burden-role="[^"]+"[^>]*)>/g)) {
        const attrs = attributes(match[1]), role = attrs['data-burden-role'];
        const allowed = kind === 'workload' ? ['remaining', 'spendingReduction', 'spendingAvoidance', 'staffCapacity'] : ['currentRemaining', 'plannedRemaining', 'spendingReduction', 'spendingAvoidance'];
        ok(allowed.includes(role), label + ': no cost, subscription or mixed-unit flow role');
        const amount = numeric(attrs, 'data-burden-amount', label + '/' + role);
        const drawnAmount = numeric(attrs, 'data-burden-drawn-amount', label + '/' + role);
        close(drawnAmount, amount, label + ': geometry reconciles saved component rounding only', contract.rows.length * 3);
        drawnTotal += drawnAmount;
        ok(amount >= 0, label + ': nonnegative ribbon');
        ok(!/NaN|Infinity/.test(attrs.d || ''), label + ': finite ribbon geometry');
        equal(attrs['fill-opacity'], '.34', label + ': translucent ribbons');
        for (const id of attrs['data-burden-source-ids'].split(' ')) ok(contract.rows.some(row => row.id === id), label + ': grouped ribbon refers only to real sources');
        const coordinates = (attrs.d || '').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)?.map(Number);
        equal(coordinates?.length, 16, label + ': complete closed cubic ribbon');
        for (const width of [coordinates[15] - coordinates[1], coordinates[9] - coordinates[7]]) {
          ok(Math.abs(width - drawnAmount * scale) < 1e-7, label + ': actual ribbon uses the declared common scale');
        }
        roles.set(role, (roles.get(role) || 0) + amount);
      }
      const remaining = kind === 'workload' ? roles.get('remaining') || 0 : (roles.get('currentRemaining') || 0) + (roles.get('plannedRemaining') || 0);
      close(remaining, baseline - released, label + ': remaining ribbons reconcile', contract.rows.length);
      ok(Math.abs(drawnTotal - baseline) <= Math.max(1e-8, baseline * 1e-12), label + ': drawn ribbons conserve the baseline despite independently rounded labels');
      // Phone now uses this same left-to-right SVG, not a separately calculated
      // vertical diagram. Every amount/scale/conservation assertion above thus
      // applies to both layouts; actual label containment still needs a browser.
      equal((section.html.match(/<svg\b/g) || []).length, 1, label + ': shared phone/desktop SVG');
      ok(!/data-mobile-burden-|mr-burden-mobile/.test(section.html), label + ': no obsolete phone-only calculation');
      ok(section.html.includes('data-flow-direction="left-to-right"'), label + ': common left-to-right direction');
      equal((section.html.match(/class="mr-unified-labels"/g) || []).length, 2, label + ': separate source/outcome label columns');
      for (const [role, value] of kind === 'workload'
        ? [['spendingReduction', contract.rows.reduce((n, r) => n + r.reduction, 0)], ['spendingAvoidance', contract.rows.reduce((n, r) => n + r.avoidance, 0)], ['staffCapacity', contract.rows.reduce((n, r) => n + r.retained, 0)]]
        : moneyCategories.flatMap(category => {
          const rows = contract.rows.filter(row => row.category === category);
          return [[category, rows.reduce((n, row) => n + row.released, 0)], [category === 'spendingReduction' ? 'currentRemaining' : 'plannedRemaining', rows.reduce((n, row) => n + row.baseline - row.released, 0)]];
        })) close(roles.get(role) || 0, value, label + ': ' + role + ' ribbons reconcile', contract.rows.length);
      ok(!/Subscription allocation|Implementation cash|Net planning value/.test(section.html), label + ': costs and net outside diagram');
      sectionsChecked++;
    }
  }
  equal(sections.length, (expectedSources(s, 'central').size - omittedKinds.size) * levels.length, name + ': no extra or unlabelled case sections');
  for (const rows of [s.inputs.capacity.activities, s.inputs.spendingReduction.items, s.inputs.spendingAvoidance.items]) for (const row of rows) {
    ok(html.includes(esc(row.changeBasis)), name + ': exact proposed-action explanation retained');
    ok(html.includes(esc(row.sourceReference)), name + ': exact source reference retained');
  }
  const tableCells = [...html.matchAll(/<td\b([^>]*\bdata-case="[^"]+"[^>]*)>/g)].map(match => attributes(match[1]));
  for (const level of levels) for (const benefit of Object.values(s.benefits)) if (benefit.amount !== null) {
    ok(tableCells.some(cell => cell['data-case'] === level && Number(cell['data-saved-value']) === benefit.amount[level]), name + '/' + level + ': saved benefit remains in comparison even if chart is withheld');
  }
  for (const level of levels) for (const field of ['cashInvestment', 'totalImplementationAndSubscriptionCost', 'netExistingCashEffect', 'netCashEffect', 'netCapacityAndCashValue']) {
    const key = ['cashInvestment', 'totalImplementationAndSubscriptionCost'].includes(field) ? costCase[level] : level;
    const value = s.totals[field]?.[key];
    if (value !== undefined) ok(tableCells.some(cell => cell['data-case'] === level && Number(cell['data-saved-value']) === value), name + '/' + level + ': saved table ' + field + ' and cost pairing retained');
  }
}
equal(sha(read('sample-data/production-diagnostic-samples.json')), sha(artifactBytes), 'Public artifact remains byte-identical');
console.log(JSON.stringify({status: 'PASS', checks, cases: cases.length, sections: sectionsChecked, sources: sourcesChecked, rendererSha256: sha(renderer), artifactSha256: sha(artifactBytes), browsers: 0, networkCalls: 0, providerCalls: 0}));
