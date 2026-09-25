// Deterministic report-overview contract. No browser, network, provider, account
// or approval-manifest calls. Fixtures are read directly while the separately
// reviewed presentation manifest is being updated. This does NOT certify visual
// layout, browser focus/polling, PDF pagination or live account behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBeforeHorizontalOverviewPresentation} from './report_overview_horizontal_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
// Keep historical source/fixture assertions together. The current four-row
// contract separately exercises the current publication and actual comparisons.
const artifactBytes = execFileSync('git',['show','4b24682b352df38ce9d72530ee9bbf0b2775af21:sample-data/production-diagnostic-samples.json'],{cwd:root,encoding:'utf8',maxBuffer:32e6});
const currentArtifactBytes = read('sample-data/production-diagnostic-samples.json');
const rendererBytes = read('monderman-report.js');
const artifact = JSON.parse(artifactBytes);
const fixtures = JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const sha = value => createHash('sha256').update(value).digest('hex');
const context = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
vm.runInNewContext(read('participant-evidence-safety.js'), context);
// Keep this historical two-flow contract on its exact original renderer; the
// current four-row component has report_overview_horizontal_contract.mjs.
vm.runInNewContext(sourceBeforeHorizontalOverviewPresentation(rendererBytes), context);
const R = context.window.MondermanReport;
let checks = 0, documents = 0;
const ok = (value, label) => { assert.ok(value, label); checks++; };
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&#x27;':"'",'&nbsp;':' '})[entity]);
const attrs = value => Object.fromEntries([...value.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
const cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const flatten = node => [node, ...node.children.flatMap(flatten)];
const text = node => decode(node.content.map(part => typeof part === 'string' ? part : text(part)).join('')).replace(/\s+/g, ' ').trim();

// A small structural reader for the renderer's own escaped HTML; deliberately
// not a DOM implementation or HTML validator and never executes embedded code.
function parse(html) {
  const document = {tag:'root', attrs:{}, children:[], content:[]};
  const stack = [document];
  const token = /<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b([^<>]*?)>/gi;
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let last = 0;
  for (const match of html.matchAll(token)) {
    stack.at(-1).content.push(html.slice(last, match.index)); last = match.index + match[0].length;
    if (match[0].startsWith('<!--') || match[1]) continue;
    const tag = match[2].toLowerCase();
    if (match[0].startsWith('</')) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    const node = {tag, attrs:attrs(match[3]), children:[], content:[], parent:stack.at(-1)};
    stack.at(-1).children.push(node); stack.at(-1).content.push(node);
    if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  stack.at(-1).content.push(html.slice(last));
  return document;
}
const all = (node, name) => flatten(node).filter(item => cls(item, name));
const one = (node, name) => {
  const matches = all(node, name); equal(matches.length, 1, name + ': exactly one'); return matches[0];
};
const tile = (overview, role) => flatten(overview).find(node => node.attrs['data-report-link-role'] === 'overview-' + role);
function visibleReportText(node) {
  if (cls(node, 'mr-screen-only') || cls(node, 'actions')) return '';
  return node.content.map(part => typeof part === 'string' ? part : visibleReportText(part)).join('');
}
const normalize = value => decode(value).replace(/\s+/g, ' ').trim();
function checkModel(name, model) {
  const before = JSON.stringify(model); freeze(model);
  const html = R.buildReportHtml(model), tree = parse(html), page = one(tree, 'mr-page'), overview = one(page, 'mr-report-overview');
  equal(JSON.stringify(model), before, name + ': model unchanged');
  ok(cls(overview, 'mr-screen-only'), name + ': overview belongs to print-hidden layer');
  ok(/@media print\s*\{\s*\.mr-screen-only\s*\{\s*display:none!important/.test(html), name + ': print explicitly hides screen-only layer');
  equal(all(overview, 'mr-overview-tile').length, 4, name + ': four overview tiles');
  const nodes = flatten(page), ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  equal(ids.length, new Set(ids).size, name + ': all rendered ids unique');
  const idNodes = new Map(nodes.filter(node => node.attrs.id).map(node => [node.attrs.id, node]));
  const cover = one(page, 'mr-cover');
  for (const link of nodes.filter(node => node.tag === 'a' && node.attrs.href?.startsWith('#'))) {
    ok(idNodes.has(link.attrs.href.slice(1)), name + ': internal link resolves: ' + link.attrs.href);
    if (link.attrs['data-report-link-role']?.startsWith('overview-')) ok(link.attrs.href !== '#' + cover.attrs.id, name + ': tile advances beyond overview');
    if (link.attrs['data-report-link-role'] === 'overview') equal(link.attrs.href, '#' + cover.attrs.id, name + ': return link targets overview cover');
  }
  const fullSections = nodes.filter(node => node.tag === 'section' && cls(node, 'mr-section'));
  for (const section of fullSections) ok(all(section, 'mr-section-back').length >= 1, name + ': long section has phone-accessible return link');
  // The entire original print-reading text remains in order after removing
  // only screen additions. CSS geometry itself requires later browser testing.
  equal(normalize(visibleReportText(page)), normalize(visibleReportText(parse(R.buildReportBody(model)))), name + ': original long-report/print text preserved');
  const label = all(tile(overview, 'findings'), 'mr-overview-label')[0];
  if (model.kind !== 'run' && model.scoreLabel) equal(text(label).split(model.scoreLabel).length - 1, 1, name + ': score label not duplicated in band');
  documents++;
  return {html, tree, page, overview, value:tile(overview, 'value'), findings:tile(overview, 'findings'), actions:tile(overview, 'actions'), evidence:tile(overview, 'evidence')};
}

equal(Object.keys(artifact.outputs).length, 6, 'six actual saved samples');
for (const [name, entry] of Object.entries(artifact.outputs)) {
  const raw = structuredClone(entry.source), before = JSON.stringify(raw); freeze(raw);
  const model = entry.kind === 'diagnostic' ? R.fromRun(raw) : R.fromSynthesis(raw);
  const result = checkModel(name, model), interpretation = model.aiReport.report.interpretation;
  equal(JSON.stringify(raw), before, name + ': source unchanged');
  ok(text(result.findings).includes(normalize(interpretation.summary)), name + ': complete saved summary retained verbatim');
  const actualActions = (interpretation.action_options?.length ? interpretation.action_options : interpretation.recommendations).filter(item => item.action?.trim()).slice(0, 3);
  equal(all(result.actions, 'mr-overview-options').length, actualActions.length ? 1 : 0, name + ': action list only from actual complete guidance');
  for (const action of actualActions) ok(text(result.actions).includes(normalize(action.action)), name + ': each complete action retained, including conditions');
  ok(!text(result.overview).includes('108 of 30'), name + ': run count cannot masquerade as distinct participant count');
  if (model.kind === 'run') {
    equal(all(result.overview, 'mr-overview-flow').length, 0, name + ': single run has no financial overview chart');
    ok(text(result.value).includes('One person’s responses'), name + ': single-run financial boundary stated');
    ok(text(result.evidence).includes(model.scopeLabel), name + ': recorded scope used');
    ok(text(result.evidence).includes(model.participantMode), name + ': recorded perspective used');
  } else {
    const counts = model.campaignEvidence.counts;
    ok(text(result.evidence).includes(counts.distinctParticipantsAcrossLenses + 'of ' + counts.declaredPopulation), name + ': distinct people, not number of runs');
    ok(text(result.evidence).includes('Recorded participants / declared population'), name + ': denominator accurately labeled, not invited or representative');
    const flows = all(result.overview, 'mr-overview-flow');
    equal(flows.length, 2, name + ': two financial overview flows');
    const [money, time] = flows;
    equal(money.attrs['data-overview-flow'], 'money', name + ': money flow distinct');
    equal(time.attrs['data-overview-flow'], 'time', name + ': hours flow distinct');
    const s = model.financialScenario, input = s.inputs;
    equal(Number(money.attrs['data-released']), s.totals.existingSpendingReduction.central + s.totals.futureSpendingAvoidance.central, name + ': cash flow excludes salary-valued capacity and investment');
    equal(Number(time.attrs['data-released']), s.totals.grossPotentialHoursFreed.central, name + ': time released uses saved gross hours');
    const denominator = ['spendingReduction','spendingAvoidance'].reduce((sum,key) => sum + input[key].items.reduce((n,item) => n + item.baselineMonthlyUnits * item.unitCost * (item.endMonth - item.startMonth + 1), 0), 0);
    equal(Number(money.attrs['data-baseline']), denominator, name + ': money baseline only current/planned expense inputs');
    ok(text(result.value).includes('Before costs.'), name + ': gross benefit is not presented as net ROI');
    ok(text(result.value).includes('Do not add hours to money.'), name + ': money/hours not double-counted');
    ok(!text(result.value).includes('subscription'), name + ': subscription not in charts');
    ok(text(result.actions).includes('Structural change'), name + ': structural option has business-facing label');
  }
  for (const status of ['pending','processing','attention_required','rejected','']) {
    const pending = {...structuredClone(model), aiReport:{status,message:'Controlled state ' + status,report:{interpretation:{summary:'STALE_SUMMARY',recommendations:[{action:'STALE_ACTION'}],action_options:[{action:'STALE_OPTION',intensity:'limited'}]}}}};
    const pendingResult = checkModel(name + '/' + (status || 'absent'), pending);
    ok(!text(pendingResult.overview).includes('STALE_'), name + '/' + status + ': unfinished or missing state exposes no stale AI copy');
    equal(all(pendingResult.actions, 'mr-overview-options').length, 0, name + '/' + status + ': no unfinished recommendations');
  }
  const complete = {...structuredClone(model), aiReport:{status:'complete',report:{interpretation:{summary:'CURRENT_SUMMARY ' + name,recommendations:[{action:'CURRENT_ACTION ' + name,prerequisite:'ONLY_AFTER_REVIEW',risk:'CHECK_RISK',success_check:'MEASURE_CHANGE'}],action_options:[]}}}};
  const completeResult = checkModel(name + '/new-complete', complete);
  ok(text(completeResult.overview).includes('CURRENT_SUMMARY ' + name), name + ': completed replacement summary used');
  ok(text(completeResult.actions).includes('CURRENT_ACTION ' + name), name + ': completed replacement action used');
  ok(text(completeResult.page).includes('ONLY_AFTER_REVIEW') && text(completeResult.page).includes('CHECK_RISK'), name + ': complete guidance preserves prerequisite and risk');
  const factual = {...structuredClone(model), aiReport:{status:'complete',report:{interpretation:{summary:'FACTUAL_ONLY',recommendations:[{action:'   '}],action_options:[]}}}};
  equal(all(checkModel(name + '/factual-only', factual).actions, 'mr-overview-options').length, 0, name + ': factual-only report invents no next step');
}

const depthSource = artifact.outputs.depth_synthesis.source;
function synthesisCase(name, change) {
  const raw = structuredClone(depthSource); change(raw);
  return checkModel(name, R.fromSynthesis(raw));
}
const missingCount = synthesisCase('missing-participant-count', raw => {delete raw.campaign_evidence.counts.distinctParticipantsAcrossLenses;});
ok(text(missingCount.evidence).includes('Unavailable'), 'absent participant count not substituted with selected runs');
ok(!text(missingCount.evidence).includes('of 30'), 'absent participant numerator cannot display percentage or denominator');
const invalidPopulation = synthesisCase('population-less-than-participants', raw => {raw.campaign_evidence.counts.declaredPopulation = 5;});
ok(!text(invalidPopulation.evidence).includes('of 5'), 'invalid denominator not displayed as coverage');
const withheld = synthesisCase('withheld-score', raw => {raw.score_status = 'withheld'; raw.financial_scenario = null;});
ok(text(withheld.findings).includes('Unavailable'), 'withheld score cannot inherit published numerical score');
equal(all(withheld.overview, 'mr-overview-flow').length, 0, 'no scenario is not a zero saving chart');
const selfRun = synthesisCase('self-run-boundary', raw => {raw.source_mode = 'own_saved_runs';raw.report_kind='self_run_synthesis';});
equal(all(selfRun.overview, 'mr-overview-flow').length, 0, 'self-run cannot expose organization-wide planning values');
const comparison = synthesisCase('comparison-without-scenario', raw => {raw.report_kind='response_comparison';raw.score_status='withheld';raw.financial_scenario=null;raw.ai_report={status:'complete',report:{interpretation:{summary:'Included responses only',recommendations:[],action_options:[]}}};});
equal(all(comparison.overview,'mr-overview-flow').length,0,'response comparison without separate scenario does not fabricate benefits');
equal(all(comparison.actions,'mr-overview-options').length,0,'response comparison without approved options does not invent them');
const early = synthesisCase('early-independent-planning-case', raw => {raw.report_kind='response_comparison';raw.score_status='withheld';raw.financial_scenario.kind='early_planning_scenario';});
ok(text(early.value).includes('Early planning case · central'), 'early planning scenario explicitly distinct from synthesis eligibility');

for (const [name, scenario] of Object.entries(fixtures.cases)) {
  const result = synthesisCase('financial-fixture/' + name, raw => {raw.financial_scenario = structuredClone(scenario);raw.campaign_evidence.scopeId=scenario.scope.scopeId;delete raw.financial_benefit_assessment;});
  if (!scenario.coverage.complete) {
    equal(all(result.overview,'mr-overview-flow').length,0,name + ': incomplete estimates cannot become complete diagrams');
    ok(text(result.value).includes('Some benefits have not been estimated'),name + ': unknown values not represented as zero');
    ok(!text(result.value).includes('Explore low, central and high cases'),name + ': incomplete scenario does not promise absent case controls');
  }
}
const corrupt = synthesisCase('invalid-saved-arithmetic', raw => {raw.financial_scenario.totals.existingSpendingReduction.central += 1234;});
equal(all(corrupt.overview,'mr-overview-flow').length,0,'invalid arithmetic suppresses overview diagrams instead of recalculate');
ok(!text(corrupt.value).includes('Explore low, central and high cases'),'invalid scenario does not promise absent cases');
const crossScope = synthesisCase('wrong-scope', raw => {raw.financial_scenario.scope.scopeId='different-campaign';});
equal(all(crossScope.overview,'mr-overview-flow').length,0,'different campaign cannot supply financial overview');

// Mutate only synthetic in-memory zero fixtures so boundaries remain valid
// apart from display denominators. No production or saved artifact writes.
const zero = structuredClone(fixtures.cases.complete), zeroRange=()=>({low:0,central:0,high:0});
for(const activity of zero.inputs.capacity.activities)activity.reductionPercent=zeroRange();
for(const key of ['spendingReduction','spendingAvoidance'])for(const item of zero.inputs[key].items){item.baselineMonthlyUnits=0;item.reductionPercent=zeroRange();}
for(const row of zero.activities){
  for(const key of ['grossHoursFreed','hoursUsedForSpendingReduction','hoursUsedForSpendingAvoidance','potentialHoursFreed','capacityValue'])row[key]=zeroRange();
  for(const month of row.monthlyReconciliation)for(const key of Object.keys(month))if(key!=='month')month[key]=zeroRange();
}
for(const row of zero.spendingItems){row.amount=zeroRange();row.allocatedHours=zeroRange();for(const month of row.monthlyAllocations)month.allocatedHours=zeroRange();}
for(const benefit of Object.values(zero.benefits)){benefit.amount=zeroRange();if(benefit.hours)benefit.hours=zeroRange();}
for(const key of ['grossPotentialHoursFreed','potentialHoursFreed','capacityValue','existingSpendingReduction','futureSpendingAvoidance','knownBenefitSubtotal'])zero.totals[key]=zeroRange();
for(const [level,costCase]of [['low','high'],['central','central'],['high','low']]){
  zero.totals.netExistingCashEffect[level]=-zero.totals.cashInvestment[costCase];
  zero.totals.netCashEffect[level]=-zero.totals.cashInvestment[costCase];
  zero.totals.netCapacityAndCashValue[level]=-zero.totals.totalImplementationAndSubscriptionCost[costCase];
  zero.totals.netKnownBenefitSubtotal[level]=zero.totals.netCapacityAndCashValue[level];
}
for (const [name, denominator] of [['huge',1e18],['subnormal',Number.MIN_VALUE],['rounding-over-baseline',.006]]) {
  const result = synthesisCase(name + '-baseline', raw => {
    raw.financial_scenario = structuredClone(zero); raw.campaign_evidence.scopeId = zero.scope.scopeId;
    const s=raw.financial_scenario,input=s.inputs.spendingReduction.items[0],row=s.spendingItems.find(x=>x.id===input.id);
    Object.assign(input,{baselineMonthlyUnits:name==='huge'?1e9:denominator,unitCost:name==='huge'?1e9:1,startMonth:1,endMonth:1});row.activeMonths=1;
    if(name==='rounding-over-baseline'){
      input.reductionPercent={low:100,central:100,high:100};input.adoptionPercent={low:100,central:100,high:100};
      row.amount={low:.01,central:.01,high:.01};s.benefits.spendingReduction.amount={...row.amount};
      for(const [level,costCase]of [['low','high'],['central','central'],['high','low']]){
        s.totals.existingSpendingReduction[level]=.01;s.totals.knownBenefitSubtotal[level]=.01;
        s.totals.netExistingCashEffect[level]=.01-s.totals.cashInvestment[costCase];s.totals.netCashEffect[level]=s.totals.netExistingCashEffect[level];
        s.totals.netCapacityAndCashValue[level]=.01-s.totals.totalImplementationAndSubscriptionCost[costCase];s.totals.netKnownBenefitSubtotal[level]=s.totals.netCapacityAndCashValue[level];
      }
    }
  });
  ok(result.html.includes('data-three-benefit-version="20260919.1"'),name+': valid saved scenario reached display checks');
  equal(all(result.overview,'mr-overview-flow').filter(flow=>flow.attrs['data-overview-flow']==='money').length,0,name+': unsafe denominator cannot produce a clamped money diagram');
  ok(text(result.value).includes('baseline cannot be drawn reliably'),name+': explicit fallback instead of false graphic');
}
const injection = synthesisCase('escaped-summary-and-guidance', raw => {
  raw.ai_report={status:'complete',report:{interpretation:{summary:'<img src=x onerror=alert(1)>',recommendations:[{action:'<script>alert(2)</script>',reason:'text',prerequisite:'text',risk:'text',success_check:'text'}],action_options:[]}}};
});
ok(!flatten(injection.overview).some(node=>node.tag==='img'||node.tag==='script'),'AI text cannot create markup in overview');
ok(text(injection.overview).includes('<img src=x onerror=alert(1)>'),'escaped text remains faithful');
equal(sha(read('sample-data/production-diagnostic-samples.json')),sha(currentArtifactBytes),'test never changes the current saved sample file');
console.log(JSON.stringify({status:'PASS',checks,documents,historicalSamples:6,artifactSha256:sha(artifactBytes),rendererSha256:sha(rendererBytes),executed:'Node VM render + structural HTML assertions against exact historical source and fixture; no browser or network',notExecuted:['visual layout','live DOM polling/focus','PDF pagination','live account integration']},null,2));
