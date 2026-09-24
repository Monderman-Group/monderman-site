// Offline compact-overview contract. Actual browser label containment, focus
// and responsiveness are separate checks; this test makes no such claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const source = read('monderman-report.js'), artifactBytes = read('sample-data/production-diagnostic-samples.json');
const artifact = JSON.parse(artifactBytes), fixtures = JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const context = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
for (const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js']) vm.runInNewContext(read(file), context, {filename:file});
const R = context.window.MondermanReport;
let checks = 0, documents = 0, charts = 0;
const ok = (value, label) => {assert.ok(value, label); checks++;};
const equal = (actual, expected, label) => {assert.deepEqual(actual, expected, label); checks++;};
const near = (actual, expected, label) => ok(Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual-expected) <= Math.max(1e-8, Math.abs(expected)*1e-12), label + ': ' + actual + ' vs ' + expected);
const freeze = value => {if (value && typeof value === 'object' && !Object.isFrozen(value)) {Object.values(value).forEach(freeze); Object.freeze(value);} return value;};
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&#x27;':"'",'&nbsp;':' '})[entity]);
const has = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const flatten = node => [node, ...node.children.flatMap(flatten)];
const all = (node, name) => flatten(node).filter(item => has(item, name));
const text = node => decode(node.content.map(part => typeof part === 'string' ? part : text(part)).join('')).replace(/\s+/g,' ').trim();
// Structural reader for renderer-owned escaped markup; never executes scripts.
function parse(html) {
  const tree = {tag:'root',attrs:{},children:[],content:[]}, stack = [tree];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let last = 0;
  for (const match of html.matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b([^<>]*?)>/gi)) {
    stack.at(-1).content.push(html.slice(last,match.index)); last = match.index+match[0].length;
    if (match[0].startsWith('<!--') || match[1]) continue;
    const tag = match[2].toLowerCase();
    if (match[0].startsWith('</')) {const index = stack.findLastIndex(node => node.tag === tag); if (index > 0) stack.length=index; continue;}
    const node = {tag,attrs:Object.fromEntries([...match[3].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1],decode(m[2])])),children:[],content:[]};
    stack.at(-1).children.push(node); stack.at(-1).content.push(node);
    if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  stack.at(-1).content.push(html.slice(last));
  return tree;
}
function expected(s) {
  const input = s.inputs, money = {ids:[],baseline:0,amounts:[0,0,0],drawn:[0,0,0],unit:'USD'}, time = {ids:[],baseline:0,amounts:[0,0,0],drawn:[0,0,0],unit:'hours'};
  for (const [category,index] of [['spendingReduction',0],['spendingAvoidance',1]]) for (const item of input[category].items) {
    const row = s.spendingItems.find(row => row.id === item.id), baseline = item.baselineMonthlyUnits*item.unitCost*(item.endMonth-item.startMonth+1);
    money.ids.push(item.id); money.baseline += baseline; money.amounts[index] += row.amount.central; money.amounts[2] += baseline-row.amount.central;
  }
  money.drawn = money.amounts.slice();
  const days = (Date.parse(input.capacity.measurementEnd)-Date.parse(input.capacity.measurementStart))/86400000;
  for (const item of input.capacity.activities) {
    const row = s.activities.find(row => row.id === item.id), baseline = item.measuredHours*(input.horizonMonths*365.25/12)/days;
    const retained = row.potentialHoursFreed.central, assigned = row.hoursUsedForSpendingReduction.central+row.hoursUsedForSpendingAvoidance.central, released = row.grossHoursFreed.central, sum = retained+assigned;
    time.ids.push(item.id); time.baseline += baseline;
    const values = [retained,assigned,baseline-released], widths = [sum ? retained*released/sum : 0,sum ? assigned*released/sum : 0,baseline-released];
    for (let i=0;i<3;i++) {time.amounts[i]+=values[i];time.drawn[i]+=widths[i];}
  }
  return {money,time};
}
function inspect(label, model, expectedKinds = null) {
  const before = JSON.stringify(model); freeze(model);
  const html = R.buildReportHtml(model), tree = parse(html), overview = all(tree,'mr-report-overview')[0], previews = all(overview,'mr-overview-sankey');
  equal(JSON.stringify(model), before, label+': immutable input model');
  equal(all(tree,'mr-overview-sankey').length, previews.length, label+': previews confined to screen-only overview');
  ok(has(overview,'mr-screen-only'), label+': overview hidden for print');
  equal(all(parse(R.buildReportBody(model)),'mr-overview-sankey').length, 0, label+': full print body has no preview');
  ok(!/NaN|Infinity|undefined/.test(previews.map(text).join(' ')), label+': finite display');
  const s = model.financialScenario, values = s?.coverage?.complete ? expected(s) : null;
  const inventory = expectedKinds ?? (values ? Object.entries(values).filter(([,v]) => v.baseline>0).map(([key])=>key) : []);
  equal(previews.map(node=>node.attrs['data-preview-kind']), inventory, label+': exact chart inventory, missing is not zero');
  for (const chart of previews) {
    const kind=chart.attrs['data-preview-kind'], expected=values[kind], name=label+'/'+kind, svg=chart.children[0].children.find(node=>node.tag==='svg');
    const outcomes=all(chart,'mr-overview-sankey-outcome'), paths=flatten(svg).filter(node=>node.tag==='path');
    equal(chart.attrs['data-preview-case'],'central',name+': central only');
    equal(chart.attrs['data-preview-source-ids'].split(','),expected.ids,name+': all actual source IDs retained');
    near(Number(chart.attrs['data-preview-baseline']),expected.baseline,name+': entered baseline excludes salary value, costs and subscription');
    equal(outcomes.map(node=>node.attrs['data-preview-role']),['0','1','2'],name+': exactly three outcomes');
    equal(outcomes.map(node=>Number(node.attrs['data-preview-amount'])),expected.amounts,name+': exact saved components and explicit residual');
    equal(svg.attrs.role,'img',name+': accessible SVG');
    ok(svg.attrs['aria-label'].includes('Abbreviated'),name+': identifies abbreviation');
    ok(svg.attrs['aria-label'].includes(String(expected.baseline)),name+': exact baseline accessible despite rounded visible label');
    ok(text(svg).includes('separate scale for '+expected.unit),name+': dollar/hour scale separation explicit');
    const viewBox=svg.attrs.viewBox.split(/\s+/).map(Number), height=viewBox[3];
    equal(viewBox.slice(0,3),[0,0,100],name+': horizontal strip geometry');
    ok(height>=65 && height<=90.000001,name+': shallow strip height bounded 65–90');
    equal(flatten(svg).filter(node=>node.tag==='text').length,0,name+': labels outside SVG');
    ok(outcomes.every(node=>node.children.some(child=>child.tag==='strong')&&node.children.some(child=>child.tag==='span')),name+': labelled amounts outside ribbons');
    const anchor=all(overview,'mr-overview-tile').find(node=>all(node,'mr-overview-sankey').includes(chart));
    equal(flatten(anchor).filter(node=>['a','button','input','select','details'].includes(node.tag)).length,1,name+': entire tile anchor, no nested control');
    let drawn=0;
    for (const ribbon of paths) {
      const index=Number(ribbon.attrs['data-preview-role']), amount=Number(ribbon.attrs['data-preview-amount']), drawnAmount=Number(ribbon.attrs['data-preview-drawn-amount']);
      equal(amount,expected.amounts[index],name+': exact saved ribbon amount'); near(drawnAmount,expected.drawn[index],name+': rounding reconciles widths only'); drawn+=drawnAmount;
      const coords=ribbon.attrs.d.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi).map(Number);
      equal(coords.length,16,name+': closed cubic ribbon');
      ok(coords.every(Number.isFinite),name+': finite geometry');
      equal([coords[0],coords[6],coords[8],coords[14]],[7,93,93,7],name+': left-to-right');
      for (const width of [coords[15]-coords[1],coords[9]-coords[7]]) near(width,drawnAmount*30/expected.baseline,name+': independently scaled proportional width');
      equal(ribbon.attrs['fill-opacity'],'.34',name+': translucent ribbon');
      ok(outcomes[index].attrs.title.includes(String(amount)),name+': exact outcome value accessible');
    }
    near(drawn,expected.baseline,name+': ribbons conserve baseline');
    ok(new Set(paths.map(node=>node.attrs.fill)).size===paths.length,name+': distinct outcome colors');
    ok(!/subscription|implementation cash|capacity value|net planning|ROI/i.test(text(chart)),name+': no unrelated cost or ROI claims');
    const detailKind=kind==='time'?'workload':'money', detail=flatten(tree).find(node=>node.attrs['data-burden-kind']===detailKind&&node.attrs['data-burden-case']==='central');
    ok(detail,name+': full source chart retained'); near(Number(detail.attrs['data-baseline-value']),expected.baseline,name+': detailed chart baseline matches');
    // Full-chart node heights may be rounding-reconciled. Its ribbon amount
    // attributes retain saved values, so compare like-for-like, not widths.
    const nodes=flatten(detail).filter(node=>node.tag==='path'&&node.attrs['data-burden-role']), value=role=>nodes.filter(node=>node.attrs['data-burden-role']===role).reduce((n,node)=>n+Number(node.attrs['data-burden-amount']),0);
    const detailAmounts=kind==='money'?[value('spendingReduction'),value('spendingAvoidance'),value('currentRemaining')+value('plannedRemaining')]:[value('staffCapacity'),value('spendingReduction')+value('spendingAvoidance'),value('remaining')];
    detailAmounts.forEach((value,index)=>near(value,expected.amounts[index],name+': full chart outcome matches abbreviated aggregate'));
    charts++;
  }
  documents++; return {html,previews,overview};
}
for (const product of ['depth_synthesis','cross_lens_synthesis']) {
  const entry=structuredClone(artifact.outputs[product]), before=JSON.stringify(entry); freeze(entry);
  inspect(product+'/saved',R.fromSynthesis(entry.source));
  inspect(product+'/sample',context.window.MondermanPublicSamples.model(entry,artifact));
  equal(JSON.stringify(entry),before,product+': saved source unchanged');
}
function scenarioModel(scenario) {
  const raw=structuredClone(artifact.outputs.depth_synthesis.source);
  raw.financial_scenario=structuredClone(scenario); if (scenario) raw.campaign_evidence.scopeId=scenario.scope.scopeId;
  delete raw.financial_benefit_assessment; return R.fromSynthesis(raw);
}
for (const [name,scenario] of Object.entries(fixtures.cases)) inspect('fixture/'+name,scenarioModel(scenario));
inspect('rounded-hour-components',scenarioModel(JSON.parse(read('scripts/fixtures/burden-rounding-scenario.json'))));
inspect('missing',scenarioModel(null),[]);
for (const value of [-1,NaN,Infinity,123456789]) {
  const model=scenarioModel(fixtures.cases.complete); model.financialScenario.totals.existingSpendingReduction.central=value;
  inspect('invalid-total/'+String(value),model,[]);
}
const zero=scenarioModel(fixtures.cases.zero), zeroResult=inspect('zero-denominator',zero,[]);
ok(text(zeroResult.overview).includes('no drawable baseline'), 'zero denominator explicitly unavailable, never fake ribbons');
// Test the known phone regression without pretending a source assertion is
// a browser rendering check: this selector outranks the later benefit rule.
ok(source.includes('.mr-cover[data-overview-first="true"] .mr-overview-sankeys .mr-overview-sankey-outcome>strong{font-size:13px;'), 'preview numeric typography scoped more strongly than generic mobile benefits');
ok(source.includes('grid-template-columns:minmax(0,20fr) minmax(36px,45fr) minmax(0,35fr)'), 'desktop reserves balanced baseline/ribbon/outcome widths');
ok(source.includes('.mr-cover[data-overview-first="true"] .mr-overview-sankeys .mr-overview-sankey-outcome>span{font-size:12px;'), 'outcome labels remain readable CSS text');
equal(sha(read('sample-data/production-diagnostic-samples.json')),sha(artifactBytes),'public source artifact unchanged');
console.log(JSON.stringify({status:'PASS',checks,documents,charts,rendererSha256:sha(source),artifactSha256:sha(artifactBytes),networkCalls:0,providerCalls:0,notExecuted:['browser layout/containment and focus','publication approval','PDF export']},null,2));
