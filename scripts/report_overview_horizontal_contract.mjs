// Offline contract for the approved Synthesis 2x2 quad and other report overviews. It exercises saved
// report and public-sample adapters, financial boundaries and portable anchors.
// Browser geometry/focus and PDF pagination require their separate checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sourceBeforeHorizontalOverviewPresentation,restoreHorizontalOverviewDetailPresentation,PRIOR_HORIZONTAL_OVERVIEW_SHA256} from './report_overview_horizontal_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('monderman-report.js');
const sampleBytes = read('sample-data/production-diagnostic-samples.json');
const artifact = JSON.parse(sampleBytes);
const fixtures = JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const context = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
for (const file of ['participant-evidence-safety.js', 'monderman-report.js', 'public-sample-model.js']) vm.runInNewContext(read(file), context, {filename:file});
const R = context.window.MondermanReport;
const priorSource = sourceBeforeHorizontalOverviewPresentation(source);
const priorContext = {...context, window:{}};
vm.runInNewContext(read('participant-evidence-safety.js'), priorContext);
vm.runInNewContext(priorSource, priorContext);
const prior = priorContext.window.MondermanReport;
let checks = 0, documents = 0;
const ok = (value, label) => { assert.ok(value, label); checks++; };
const equal = (value, expected, label) => { assert.deepEqual(value, expected, label); checks++; };
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {Object.values(value).forEach(freeze); Object.freeze(value);} return value; };
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&#x27;':"'",'&nbsp;':' '})[entity]);
const normalize = value => decode(value).replace(/\s+/g, ' ').trim();
const has = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const flatten = node => [node, ...node.children.flatMap(flatten)];
const all = (node, name) => flatten(node).filter(item => has(item, name));
const text = node => normalize(node.content.map(part => typeof part === 'string' ? part : text(part)).join(''));
const isQuad = model => model.kind === 'meta-synthesis' && !model.comparisonOnly && !model.selfRun && ['depth','cross_lens'].includes(model.product);
const firstString = (...values) => values.find(value => typeof value === 'string' && value.trim()) || '';
const legacyMixedPattern = 'Two or more lens-level signals share the highest observed count, so the coherent read does not identify one unique dominant shared pattern. Use the lens summaries and contradictions to define a bounded validation question rather than forcing one causal diagnosis.';
const plainMixedPattern = 'Several patterns appear across the diagnostics; none stands out as the single shared explanation. Review the findings for each diagnostic before deciding what to test.';
// This structural reader handles renderer-owned escaped HTML, not arbitrary
// websites; it ignores script/style bodies and never executes rendered markup.
function parse(html) {
  const tree = {tag:'root', attrs:{}, children:[], content:[]}, stack = [tree];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let last = 0;
  for (const match of html.matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b([^<>]*?)>/gi)) {
    stack.at(-1).content.push(html.slice(last, match.index)); last = match.index + match[0].length;
    if (match[0].startsWith('<!--') || match[1]) continue;
    const tag = match[2].toLowerCase();
    if (match[0].startsWith('</')) {const index = stack.findLastIndex(node => node.tag === tag); if (index > 0) stack.length = index; continue;}
    const node = {tag, attrs:Object.fromEntries([...match[3].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])])), children:[], content:[]};
    stack.at(-1).children.push(node); stack.at(-1).content.push(node);
    if (!voids.has(tag) && !match[0].endsWith('/>')) stack.push(node);
  }
  stack.at(-1).content.push(html.slice(last));
  return tree;
}
function printText(node) {
  if (has(node, 'mr-screen-only') || has(node, 'actions')) return '';
  return node.content.map(part => typeof part === 'string' ? part : printText(part)).join('');
}
function checkModel(label, model) {
  const before = JSON.stringify(model); freeze(model);
  const html = R.buildReportHtml(model), tree = parse(html), page = all(tree, 'mr-page')[0], overview = all(page, 'mr-report-overview')[0];
  equal(JSON.stringify(model), before, label + ': caller model unchanged');
  equal(all(page, 'mr-report-overview').length, 1, label + ': one overview');
  ok(has(overview, 'mr-screen-only'), label + ': overview remains screen-only');
  const grid = all(overview, 'mr-overview-grid')[0], rows = all(overview, 'mr-overview-tile');
  equal(grid.children.length, 4, label + ': four direct overview tiles');
  equal(rows.map(row => row.attrs['data-report-link-role']), ['overview-findings','overview-value','overview-actions','overview-evidence'], label + ': stable ordered navigation roles');
  const nodes = flatten(page), ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id), idSet = new Set(ids), cover = all(page, 'mr-cover')[0];
  equal(ids.length, idSet.size, label + ': target IDs are unique');
  equal(overview.attrs.id, cover.attrs.id + '-overview', label + ': overview has a unique destination distinct from the cover');
  const overviewFirst = model.kind === 'meta-synthesis' && !model.comparisonOnly && !model.selfRun && ['depth','cross_lens'].includes(model.product);
  equal(cover.attrs['data-overview-first'], overviewFirst ? 'true' : undefined, label + ': compact opening is limited to eligible Depth/Cross-Lens reports');
  const white = all(cover, 'mr-cover-white')[0];
  if (overviewFirst) {
    equal(text(all(rows[3], 'mr-overview-title')[0]), 'Evidence', label + ': fourth quad title matches the user reference');
    ok(text(all(overview, 'mr-overview-intro')[0]).includes('Select a tile'), label + ': quad interaction copy refers to tiles');
    const at = white.children.indexOf(overview);
    equal(white.children.slice(0, at).map(node => node.attrs.class), ['mr-cover-kicker', ...(model.sampleProvenance?.synthetic ? ['mr-sample-disclosure'] : [])], label + ': only heading disclosure precedes the overview, never detailed cover information');
    for (const name of ['mr-cover-score-row','mr-cover-pills','mr-cover-meta','mr-cover-body','mr-cover-boundary']) {
      const detail = all(white, name)[0];
      if (detail) ok(white.children.indexOf(detail) > at, label + ': complete '+name+' follows the overview');
    }
  } else ok(white.children.indexOf(overview) > white.children.findIndex(node => has(node, 'mr-cover-meta')), label + ': other report types retain their prior cover placement');
  if (model.aiReport?.status === 'complete') {
    const guidance = all(page, 'mr-report-options')[0] || all(page, 'mr-report-nextsteps')[0] || all(page, 'mr-ai-interpretation')[0];
    if (guidance) equal(rows[2].attrs.href, '#' + guidance.attrs.id, label + ': action row lands on actual options/next steps rather than the earlier long interpretation');
  }
  for (const row of rows) {
    equal(row.tag, 'a', label + ': entire row is an anchor');
    equal(row.children.map(node => node.attrs.class), ['mr-overview-title','mr-overview-content','mr-overview-link'], label + ': title, body and action belong to row anchor');
    equal(flatten(row).filter(node => ['a','button','input','select','textarea','details'].includes(node.tag)).length, 1, label + ': no nested interactive controls');
    ok(idSet.has(row.attrs.href.slice(1)) && row.attrs.href !== '#' + cover.attrs.id, label + ': row targets full detail');
  }
  for (const node of nodes.filter(node => node.tag === 'a' && node.attrs.href?.startsWith('#'))) ok(idSet.has(node.attrs.href.slice(1)), label + ': every internal link resolves');
  for (const node of nodes.filter(node => node.attrs['data-report-link-role'] === 'overview')) equal(node.attrs.href, '#' + overview.attrs.id, label + ': every return shortcut targets the actual four-row overview');
  for (const section of all(page, 'mr-section')) {
    const back = all(section, 'mr-section-back');
    ok(back.length > 0, label + ': detailed section has a return link');
    equal(back[0].children[0].attrs.href, '#' + overview.attrs.id, label + ': return restores overview target');
  }
  equal(normalize(printText(page)), normalize(printText(parse(R.buildReportBody(model)))), label + ': full report print text retained in order');
  const priorIdentity = model.kind === 'run' ? prior.fromRun(model.source) : prior.fromSynthesis(model.source);
  const priorModel = {...model, title:priorIdentity.title, filenameBase:priorIdentity.filenameBase, ...(model.kind !== 'run' ? {briefing:{...model.briefing, paragraphs:priorIdentity.briefing.paragraphs}} : {})};
  equal(restoreHorizontalOverviewDetailPresentation(R.buildReportBody(model)).replaceAll(R.rendererVersion, prior.rendererVersion), prior.buildReportBody(priorModel), label + ': prior full report bytes preserved except exact approved gold, title and display version');
  const previews = all(overview,'mr-overview-sankey');
  equal(flatten(overview).filter(node => node.tag === 'svg').length, previews.length, label + ': only genuine compact planning previews add overview SVGs');
  equal(all(rows[1],'mr-overview-sankey').length, previews.length, label + ': previews stay within Time and money');
  if (!overviewFirst) equal(previews.length,0,label + ': other report types retain their prior overview');
  if (overviewFirst) checkQuadContent(label,{overview,rows},model);
  documents++;
  return {html, overview, rows, benefits:all(rows[1], 'mr-overview-benefit')};
}
function checkBenefits(label, result, model) {
  const totals = model.financialScenario.totals;
  const kinds = isQuad(model) ? all(result.rows[1],'mr-overview-sankey').flatMap(node => node.attrs['data-preview-kind']==='money' ? ['spending-reduction','spending-avoidance'] : ['retained-capacity']) : ['spending-reduction','spending-avoidance','retained-capacity'];
  const saved = {'spending-reduction':totals.existingSpendingReduction.central,'spending-avoidance':totals.futureSpendingAvoidance.central,'retained-capacity':totals.potentialHoursFreed.central};
  equal(result.benefits.map(node => node.attrs['data-overview-benefit']), kinds, label + ': drawable benefit categories stay distinct');
  for (const node of result.benefits) {
    const key=node.attrs['data-overview-benefit'];
    const rows=key==='retained-capacity' ? model.financialScenario.activities : model.financialScenario.spendingItems.filter(row=>row.category===(key==='spending-reduction'?'spendingReduction':'spendingAvoidance'));
    const sourceSum=rows.reduce((sum,row)=>sum+(key==='retained-capacity'?row.potentialHoursFreed.central:row.amount.central),0);
    equal(Number(node.attrs['data-value']),isQuad(model)?sourceSum:saved[key],label+': preview aggregates exact saved source values; ordinary headline retains saved total');
    ok(Math.abs(sourceSum-saved[key])<=.005*(rows.length+1)+.000001,label+': aggregate and independently rounded total stay within existing cent rounding tolerance');
  }
  for (const phrase of ['Before costs.', 'retained after time assigned to spending changes.', 'Do not add hours to money.', 'Directional planning estimates, not realized savings.']) ok(text(result.rows[1]).includes(phrase), label + ': financial qualification retained: ' + phrase);
  ok(text(result.rows[1]).includes(Math.round(totals.grossPotentialHoursFreed.central).toLocaleString('en-US') + ' gross hours freed;'), label + ': gross hours disclosed separately from retained capacity');
  ok(result.html.includes('data-three-benefit-version="20260919.1"'), label + ': full decision brief remains in detail');
}

function checkQuadContent(label,result,model) {
  const interpretation=model.aiReport?.status==='complete' ? model.aiReport.report?.interpretation || {} : {};
  const summary=firstString(interpretation.summary,model.centralFinding,model.execSummary,model.coverBody,model.primaryPattern);
  const finding=summary&&summary.length<=420 ? summary : model.primaryPattern===legacyMixedPattern ? plainMixedPattern : firstString(model.primaryPattern,model.source?.diagnosis?.body,summary,'Review the recorded findings in the full report.');
  equal(text(all(result.rows[0],'mr-overview-finding')[0]),normalize(finding),label+': entire source-owned finding or exact approved legacy mapping, never a character-limited excerpt');
  const savedFacts=model.aiReport?.status==='complete' ? (model.aiReport.report?.evidence||[]).filter(f=>f.provenance==='deterministic_sample_summary'&&typeof f.label==='string'&&typeof f.value==='string') : [];
  const focus=savedFacts.filter(f=>f.label.endsWith(': most common classified focus'));
  const selected=focus.length ? focus.map(f=>({label:f.label.replace(': most common classified focus',''),value:f.value})) : savedFacts.filter(f=>/: (variation in submitted scores|.*group mean)$/.test(f.label)).slice(0,3);
  const facts=all(result.rows[0],'mr-overview-findings')[0]?.children||[];
  equal(facts.map(text),selected.map(f=>normalize(f.label+': '+f.value)),label+': supplemental findings are complete deterministic source units');
  const options=(interpretation.action_options||[]).filter(option=>typeof option.action==='string'&&option.action.trim()).slice(0,3);
  if (options.length) {
    const list=all(result.rows[2],'mr-overview-options-compact')[0];
    equal(list.children.length,options.length,label+': all three saved alternatives shown when present');
    options.forEach((option,index)=>{
      const engine=(model.source?.campaign_action_options||[]).find(row=>row.id===option.option_id&&row.intensity===option.intensity&&row.action===option.action);
      const units=engine ? option.action.match(/[^.!?]+[.!?](?:\s+|$)/g)?.map(s=>s.trim()) : null;
      const maySelect=units?.length>1&&units.join(' ')===option.action&&units.every(unit=>/^(Review|Test|Clarify|Follow)\s/.test(unit));
      equal(text(list.children[index].children.find(node=>node.tag==='p')),normalize(maySelect ? units[0] : option.action),label+': option '+index+' preserves complete prose unless an exact engine-composed standalone unit is selected');
    });
    ok(text(result.rows[2]).includes('prerequisites, risks and measures of success.'),label+': complete-option qualification retained');
  }
  const preferred=interpretation.recommended_option||{}, match=options.find(option=>option.option_id===preferred.option_id), readiness=model.campaignEvidence?.recommendedPath||{};
  const allowed=options.length&&readiness.status==='satisfied'&&match&&readiness.recommendedActionId===match.option_id&&typeof preferred.reason==='string'&&preferred.reason.trim();
  const recommendation=all(result.rows[2],'mr-overview-recommendation');
  equal(recommendation.length,allowed ? 1 : 0,label+': preferred option requires satisfied readiness and exact approved action identity');
  if (allowed) equal(text(recommendation[0].children.find(node=>node.tag==='p')),normalize(preferred.reason),label+': full saved preferred rationale preserved');
  const lenses=model.campaignEvidence?.depth?.lenses||[];
  const groupSets=lenses.map(lens=>(lens.requiredGroups||[]).filter(group=>typeof group.label==='string'&&group.label.trim()&&group.privacy?.mayDisplayGroupStatistics===true&&Number.isSafeInteger(group.privacy.minimumDisplayedGroupSize)&&group.privacy.minimumDisplayedGroupSize>0&&Number.isSafeInteger(group.participants)&&group.participants>=group.privacy.minimumDisplayedGroupSize).map(group=>({label:group.label,count:group.participants}))).filter(groups=>groups.length);
  const same=groupSets.length===lenses.length&&groupSets.length&&groupSets.every(groups=>JSON.stringify(groups)===JSON.stringify(groupSets[0]));
  const expected=same ? groupSets[0].map(group=>group.count+' '+group.label.toLowerCase()).join('; ')+(lenses.length>1?' in each diagnostic.':'.') : 'See role coverage in the full evidence.';
  const detail=all(result.rows[3],'mr-overview-evidence-detail')[0];
  const perspectives=detail.children.find(node=>text(node.children.find(child=>child.tag==='dt'))==='Perspectives');
  equal(text(perspectives.children.find(node=>node.tag==='dd')),expected,label+': role counts respect privacy and are never added across lenses');
  const counts=model.campaignEvidence?.counts||{}, people=counts.distinctParticipantsAcrossLenses,population=counts.declaredPopulation;
  const count=value=>Number.isSafeInteger(value)&&value>0?value.toLocaleString('en-US'):'Unavailable';
  const peopleText=count(people)+(Number.isSafeInteger(people)&&people>0&&Number.isSafeInteger(population)&&population>=people?' of '+count(population):'');
  const stats=all(result.rows[3],'mr-overview-evidence-stats')[0];
  equal(stats.children.map(node=>text(node.children.find(child=>child.tag==='strong'))),[peopleText,count(counts.selectedRuns),count(model.source?.lens_count)],label+': distinct participants, selected runs and lenses remain separate');
  equal(stats.children.map(node=>text(node.children.find(child=>child.tag==='span'))),['participants','selected runs',model.source?.lens_count===1?'diagnostic':'diagnostics'],label+': selected count is never presented as completed runs and lens label matches its count');
  ok(text(detail).includes('Participation alone does not establish representative coverage.'),label+': participation qualification retained');
}

for (const [name, entry] of Object.entries(artifact.outputs)) {
  const raw = freeze(structuredClone(entry.source)), before = JSON.stringify(raw);
  const model = entry.kind === 'diagnostic' ? R.fromRun(raw) : R.fromSynthesis(raw);
  for (const [variant, current] of [['saved-report', model], ['public-sample', context.window.MondermanPublicSamples.model(entry, artifact)]]) {
    const label = name + '/' + variant, result = checkModel(label, current);
    const summary = text(all(result.rows[0], 'mr-overview-summary')[0]);
    if (!isQuad(current)) {
      ok(summary.length <= 181, label + ': summary excerpt is bounded');
      ok(normalize(current.aiReport.report.interpretation.summary).startsWith(summary.replace(/…$/, '')), label + ': summary is an exact source prefix, not new interpretation');
      ok(text(result.rows[0]).includes('Excerpt; read the full findings and limits before acting.'), label + ': excerpt and evidence qualification stay visible');
    }
    ok(normalize(printText(parse(result.html))).includes(normalize(current.aiReport.report.interpretation.summary)), label + ': complete summary remains in the long report');
    const interpretation = current.aiReport.report.interpretation;
    const actions = (interpretation.action_options?.length ? interpretation.action_options : interpretation.recommendations).filter(item => item.action?.trim());
    if (actions.length) {
      const list = all(result.rows[2], 'mr-overview-options')[0];
      if (!isQuad(current)||!interpretation.action_options?.length) {
        equal(list.children.length, 1, label + ': only one source action excerpt in overview');
        const excerpt = text(list.children[0].children.find(node => node.tag === 'p'));
        ok(excerpt.length <= 201 && normalize(actions[0].action).startsWith(excerpt.replace(/…$/, '')), label + ': action excerpt bounded and source-faithful');
      }
      for (const action of actions) ok(normalize(printText(parse(result.html))).includes(normalize(action.action)), label + ': complete alternatives retained in long report');
    }
    if (entry.kind === 'synthesis') {checkBenefits(label, result, current); ok(result.html.includes('data-flow-version="20260923.1"'), label + ': full Sankey remains in detail');}
    else if (entry.kind === 'response_comparison') {
      equal(current.comparisonOnly, true, label + ': actual sample remains a descriptive comparison');
      equal(result.benefits.length, 0, label + ': comparison without financial inputs cannot display organizational benefits');
      ok(text(result.rows[1]).includes('No complete planning scenario is recorded'), label + ': missing financial evidence remains explicit');
      equal(Object.keys(current.financialScenario).length, 0, label + ': no financial scenario is invented');
      equal(interpretation.action_options.length, 0, label + ': no organizational change options are invented');
      const counts = current.campaignEvidence.counts;
      ok(text(result.rows[3]).includes(counts.distinctParticipantsAcrossLenses + 'of ' + counts.declaredPopulation), label + ': distinct participant count and declared population remain visible');
    } else {equal(result.benefits.length, 0, label + ': individual report cannot display organizational benefits'); ok(text(result.rows[1]).includes('One person’s responses'), label + ': individual boundary retained');}
  }
  equal(JSON.stringify(raw), before, name + ': saved input unchanged');
  for (const status of ['pending','processing','attention_required','rejected','']) {
    const result = checkModel(name + '/' + status, {...structuredClone(model), aiReport:{status, report:{interpretation:{summary:'STALE_SUMMARY', recommendations:[{action:'STALE_ACTION'}], action_options:[{intensity:'limited',action:'STALE_OPTION'}]}}}});
    ok(!text(result.overview).includes('STALE_'), name + ': incomplete AI cannot leak stale guidance');
  }
}
function synthesisCase(label, change) {const raw = structuredClone(artifact.outputs.depth_synthesis.source); change(raw); const model = R.fromSynthesis(raw); return {model, ...checkModel(label, model)};}
for (const [label, change] of [
  ['missing scenario', raw => {raw.financial_scenario = null;}],
  ['invalid saved arithmetic', raw => {raw.financial_scenario.totals.existingSpendingReduction.central += 1234;}],
  ['different financial scope', raw => {raw.financial_scenario.scope.scopeId = 'different-campaign';}],
  ['self-run boundary', raw => {raw.source_mode = 'own_saved_runs'; raw.report_kind = 'self_run_synthesis';}],
  ['comparison without scenario', raw => {raw.report_kind = 'response_comparison'; raw.score_status = 'withheld'; raw.financial_scenario = null;}]
]) equal(synthesisCase(label, change).benefits.length, 0, label + ': no unsupported headline financial figures');
const early = synthesisCase('early independent scenario', raw => {raw.report_kind = 'response_comparison'; raw.score_status = 'withheld'; raw.financial_scenario.kind = 'early_planning_scenario';});
ok(text(early.rows[1]).includes('Early planning case · central'), 'early scenario remains explicitly distinct from readiness');
checkBenefits('early independent scenario', early, early.model);
for (const [name, scenario] of Object.entries(fixtures.cases)) {
  const result = synthesisCase('financial boundary/' + name, raw => {raw.financial_scenario = structuredClone(scenario); raw.campaign_evidence.scopeId = scenario.scope.scopeId; delete raw.financial_benefit_assessment;});
  if (scenario.coverage.complete) checkBenefits(name, result, result.model);
  else {equal(result.benefits.length, 0, name + ': incomplete benefit categories cannot turn into zero figures'); ok(text(result.rows[1]).includes('Some benefits have not been estimated.'), name + ': incomplete coverage is visible');}
}
const noCount = synthesisCase('missing participant count', raw => {delete raw.campaign_evidence.counts.distinctParticipantsAcrossLenses;});
ok(text(noCount.rows[3]).includes('Unavailable'), 'participant count is not replaced with run count');
const withheld = synthesisCase('withheld score', raw => {raw.score_status = 'withheld';});
ok(text(withheld.rows[0]).includes('Unavailable'), 'withheld score is not republished');
const escaped = synthesisCase('escaped report text', raw => {raw.ai_report = {status:'complete', report:{interpretation:{summary:'<img src=x onerror=alert(1)>', recommendations:[{action:'<script>alert(2)</script>'}], action_options:[]}}};});
equal(flatten(escaped.overview).filter(node => ['img','script'].includes(node.tag)).length, 0, 'saved text cannot inject markup');

// In-memory negative controls: presentation may select only complete,
// explicitly engine-composed units, never arbitrary prose or private roles.
const variedModel = (label, mutate, product='cross_lens_synthesis') => {
  const model=R.fromSynthesis(structuredClone(artifact.outputs[product].source));
  mutate(model); return {model,...checkModel(label,model)};
};
const longQualified='A recorded pattern needs review. '+('This explanation has material scope limitations and must stay intact. '.repeat(9))+'Only the defined scope is supported.';
const exactMapping=variedModel('exact mixed-pattern wording',model=>{model.aiReport.report.interpretation.summary=longQualified;model.primaryPattern=legacyMixedPattern;});
equal(text(all(exactMapping.rows[0],'mr-overview-finding')[0]),plainMixedPattern,'only the exact legacy mixed-pattern unit maps to reviewed plain English');
const unfamiliar=variedModel('unfamiliar finding wording',model=>{model.aiReport.report.interpretation.summary=longQualified;model.primaryPattern=legacyMixedPattern+' Preserve this additional qualification.';});
equal(text(all(unfamiliar.rows[0],'mr-overview-finding')[0]),unfamiliar.model.primaryPattern,'a near-match retains its complete additional qualification');
const concise=variedModel('whole concise summary',model=>{model.aiReport.report.interpretation.summary='Recorded experiences differ. The report does not establish their cause.';});
equal(text(all(concise.rows[0],'mr-overview-finding')[0]),concise.model.aiReport.report.interpretation.summary,'short summary retains every sentence, not only its first');
const longFallback=variedModel('whole long fallback',model=>{model.aiReport.report.interpretation.summary=longQualified;model.primaryPattern='';model.source.diagnosis.body='';});
equal(text(all(longFallback.rows[0],'mr-overview-finding')[0]),normalize(longQualified),'long unfamiliar fallback is not truncated to fit a card');
for (const [label, mutate] of [
  ['engine identity mismatch',model=>{model.source.campaign_action_options[0].id='different-engine-id';}],
  ['engine intensity mismatch',model=>{model.source.campaign_action_options[0].intensity='different-intensity';}],
  ['engine prose mismatch',model=>{model.source.campaign_action_options[0].action+=' Retain this prerequisite.';}],
  ['qualified model option',model=>{const option=model.aiReport.report.interpretation.action_options[0];option.action='Review the recorded work. Only proceed if its required controls remain in place.';const engine=model.source.campaign_action_options.find(row=>row.id===option.option_id);engine.action=option.action;}]
]) {
  const result=variedModel(label,mutate), first=all(result.rows[2],'mr-overview-options-compact')[0].children[0];
  equal(text(first.children.find(node=>node.tag==='p')),normalize(result.model.aiReport.report.interpretation.action_options[0].action),label+': complete action is retained instead of unauthorized sentence selection');
}
for (const [label,mutate] of [
  ['unsatisfied preferred readiness',model=>{model.campaignEvidence.recommendedPath.status='not_satisfied';}],
  ['missing preferred readiness',model=>{delete model.campaignEvidence.recommendedPath;}],
  ['preferred action mismatch',model=>{model.campaignEvidence.recommendedPath.recommendedActionId='not-the-accepted-option';}],
  ['preferred option missing',model=>{model.aiReport.report.interpretation.recommended_option.option_id='unlisted-option';}],
  ['preferred reason missing',model=>{model.aiReport.report.interpretation.recommended_option.reason=' ';}]
]) equal(all(variedModel(label,mutate).rows[2],'mr-overview-recommendation').length,0,label+': no asserted preferred path');
for (const [label,mutate] of [
  ['group privacy missing',group=>{delete group.privacy;}],
  ['group privacy withheld',group=>{group.privacy.mayDisplayGroupStatistics=false;}],
  ['group below display threshold',group=>{group.participants=1;}],
  ['group threshold missing',group=>{delete group.privacy.minimumDisplayedGroupSize;}],
  ['group threshold null',group=>{group.privacy.minimumDisplayedGroupSize=null;}],
  ['group threshold zero',group=>{group.privacy.minimumDisplayedGroupSize=0;}],
  ['group threshold string',group=>{group.privacy.minimumDisplayedGroupSize='5';}],
  ['group threshold negative',group=>{group.privacy.minimumDisplayedGroupSize=-1;}],
  ['group threshold fractional',group=>{group.privacy.minimumDisplayedGroupSize=1.5;}],
  ['group label missing',group=>{delete group.label;}]
]) {
  const result=variedModel(label,model=>{for(const lens of model.campaignEvidence.depth.lenses)for(const group of lens.requiredGroups)mutate(group);});
  ok(text(result.rows[3]).includes('See role coverage in the full evidence.'),label+': withheld detail uses the explicit evidence fallback');
}
const variedCoverage=variedModel('different per-lens group counts',model=>{model.campaignEvidence.depth.lenses[0].requiredGroups[0].participants=6;});
ok(text(variedCoverage.rows[3]).includes('See role coverage in the full evidence.'),'different per-lens coverage cannot be summed or presented as shared participation');
const selectedPending=variedModel('selected runs include pending and excluded',model=>{model.campaignEvidence.counts.selectedRuns=113;model.campaignEvidence.counts.pendingRuns=3;model.campaignEvidence.counts.excludedRuns=2;});
const pendingStats=all(selectedPending.rows[3],'mr-overview-evidence-stats')[0];
equal(text(pendingStats.children[1]),'113selected runs','selected inventory including pending/excluded is not mislabeled as completed');
ok(!text(selectedPending.rows[3]).includes('completed runs'),'overview makes no completion claim from selected count');

const comparisonArg = process.argv.indexOf('--comparison-fixtures');
if (comparisonArg >= 0) {
  assert.ok(process.argv[comparisonArg + 1], 'Specify a comparison fixture JSON path');
  const comparisons = JSON.parse(fs.readFileSync(path.resolve(process.argv[comparisonArg + 1]), 'utf8'));
  for (const [key, entry] of Object.entries(comparisons.outputs).filter(([, entry]) => entry.kind === 'response_comparison')) {
    const before = JSON.stringify(entry.source), model = R.fromSynthesis(freeze(entry.source)), result = checkModel(key + '/current-comparison', model);
    equal(model.comparisonOnly, true, key + ': native response-comparison model');
    equal(model.title, model.sourceGroups[0].toolLabel + ' response comparison', key + ': lens visibly identified');
    equal(model.filenameBase, 'response-comparison-' + key.replaceAll('_', '-') + '-n15', key + ': export identifies the comparison and lens');
    equal(result.benefits.length, 0, key + ': descriptive comparison has no invented financial estimate');
    equal(model.campaignEvidence.counts.distinctParticipantsAcrossLenses, 15, key + ': source participant count retained');
    ok(model.briefing.paragraphs[0].startsWith('This is a same-Diagnostic response comparison.'), key + ': deterministic briefing uses actual comparison identity');
    ok(model.briefing.paragraphs[1].startsWith('Use this response comparison to review '), key + ': deterministic guidance uses actual comparison identity');
    ok(result.html.includes('aria-label="' + model.sourceGroups[0].toolLabel + ' response comparison score distribution"'), key + ': distribution accessibility identifies lens and comparison');
    ok(!result.html.includes('aria-label="Depth Synthesis score distribution"'), key + ': comparison does not announce an unlocked Depth Synthesis');
    const eligibility = structuredClone(entry.source);
    eligibility.executive_briefing.paragraphs.push('Depth Synthesis requires additional campaign evidence.');
    eligibility.ai_report = {status:'complete', report:{interpretation:{summary:'Use this Depth Synthesis to review a hypothetical future report.', observations:[], recommendations:[], action_options:[], hypotheses:[], limitations:[]}}};
    const identityModel = R.fromSynthesis(eligibility);
    equal(identityModel.briefing.paragraphs.at(-1), eligibility.executive_briefing.paragraphs.at(-1), key + ': genuine eligibility language remains unchanged');
    equal(identityModel.aiReport, eligibility.ai_report, key + ': accepted AI identity wording is never rewritten');
    equal(JSON.stringify(entry.source), before, key + ': current fixture source unchanged');
  }
}

const cssStart = source.indexOf('      .mr-overview-grid{'), cssEnd = source.indexOf('      .mr-report .mr-cover-kicker{', cssStart), overviewCss = source.slice(cssStart, cssEnd);
equal(sha(priorSource), PRIOR_HORIZONTAL_OVERVIEW_SHA256, 'exact inverse restores complete original renderer');
for (const mutation of [source + '\n', source.replace('limit = 180', 'limit = 999'), source.replace('spendingReduction:\'#E6C765\'', 'spendingReduction:\'#ff0000\'')]) {
  assert.throws(() => sourceBeforeHorizontalOverviewPresentation(mutation), /Only the exact (?:approved horizontal|reviewed executive overview) renderer/); checks++;
}
ok(/\.mr-overview-grid\{[^}]*grid-template-columns:minmax\(0,1fr\)/.test(overviewCss), 'other report types retain their existing one-column overview');
ok(/background:rgba\(36,48,52,\.78\)/.test(overviewCss), 'rows sit on translucent charcoal backing');
ok(/\.mr-report a\.mr-overview-tile\{[^}]*background:#fff/.test(overviewCss), 'row content uses white');
ok(/\.mr-overview-title\{[^}]*background:#187783/.test(overviewCss), 'title bands use teal');
ok(/@media\(max-width:700px\)\{[^]*?\.mr-report a\.mr-overview-tile\{grid-template-columns:minmax\(0,1fr\)\}/.test(overviewCss), 'phones place the title above row content');
ok(/@media\(max-width:480px\)\{\.mr-overview-benefits\{grid-template-columns:minmax\(0,1fr\)/.test(overviewCss), 'small phones stack benefit figures');
ok(!/#(?:C9A227|E6C765|7A6015)/i.test(overviewCss), 'overview rows contain no gold accents');
ok(!/line-clamp|max-height/.test(overviewCss), 'overview does not silently clip text or qualifications');
ok(overviewCss.includes('.mr-report .mr-cover[data-overview-first="true"] .mr-cover-dark{padding:0 0 14px;background:transparent}'), 'eligible Synthesis heading is compact and no longer a teal hero');
ok(overviewCss.includes('.mr-report .mr-cover[data-overview-first="true"] .mr-cover-white{padding:0;background:transparent}'), 'eligible overview has no old cover-card inset');
ok(overviewCss.includes('.mr-cover[data-overview-first="true"] .mr-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:auto;'), 'eligible Synthesis quad has two equal columns and natural-height rows');
ok(overviewCss.includes('.mr-report .mr-cover[data-overview-first="true"] a.mr-overview-tile{grid-template-columns:minmax(0,1fr);grid-template-rows:auto 1fr auto}'), 'each Synthesis tile has a full-width title, white content and bottom link');
ok(overviewCss.includes('.mr-cover[data-overview-first="true"] .mr-overview-title{grid-row:auto;min-height:0;'), 'Synthesis title bands are across the top, never a left column');
ok(overviewCss.includes('.mr-cover[data-overview-first="true"] .mr-overview-title{grid-row:auto;min-height:0;padding:14px 22px;background:#09383E}'), 'Synthesis top bands use the reference deep brand teal');
ok(overviewCss.includes('grid-auto-rows:auto;padding:22px;gap:20px;background:rgba(36,48,52,.9)'), 'Synthesis quad uses the darker translucent charcoal backing');
ok(overviewCss.includes('.mr-cover[data-overview-first="true"] .mr-overview-link{grid-column:1;justify-content:flex-start;'), 'quad links align to the lower left');
ok(overviewCss.includes('@media(max-width:700px){.mr-cover[data-overview-first="true"] .mr-overview-grid{grid-template-columns:minmax(0,1fr);grid-auto-rows:auto;'), 'phones use one natural-height card column without clipping');
ok(overviewCss.includes('.mr-report .mr-page:has(>.mr-cover[data-overview-first="true"]){max-width:1280px}'), 'only eligible Synthesis screen pages gain the wider quad layout');
ok(source.includes('.mr-section-back a{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1px solid #E6C765'), 'return link uses approved gold outline');
ok(/@media print\{\.mr-screen-only\{display:none!important\}\}/.test(source), 'print explicitly hides overview and return controls');
ok(source.includes('target.focus({ preventScroll:true });'), 'portable navigation keeps focus transfer');
ok(source.includes("target.scrollIntoView({ behavior: 'instant', block: 'start' });"), 'report jumps finish immediately so moving cards cannot intercept rapid forward/return navigation');
const navigationHandler=source.slice(source.indexOf('  function handleScreenNavigation('),source.indexOf('  const screenReportModels = new WeakMap();'));
ok(!/behavior:[^}]*smooth/.test(navigationHandler),'report navigation never leaves an in-flight smooth-scroll animation');
ok(source.includes("link.href = '#' + sections[0].id + '-overview';"), 'AI refresh return link preserves actual overview target');
ok(source.includes('.mr-report-overview{scroll-margin-top:145px}'), 'actual overview destination retains navigation clearance');
const printPagination=source.slice(source.indexOf('    @page{size:Letter;margin:60pt}'),source.indexOf('      .mr-system-metrics,.mr-system-decision',source.indexOf('    @page{size:Letter;margin:60pt}')));
ok(printPagination.includes('@media print{'), 'cover and caption correction is print-only');
ok(printPagination.includes('.mr-report .mr-cover-meta{grid-template-columns:repeat(3,minmax(0,1fr))'), 'Letter cover overrides phone metadata layout');
ok(printPagination.includes('.mr-report .mr-cover-meta>span:last-child:nth-child(5){grid-column:2 / -1}'), 'fifth cover metadata value has room without orphaning the interpretation boundary');
ok(printPagination.includes('.mr-report .mr-benefit-chart .mr-benefit-chart-note{font-size:9pt;line-height:1.4;margin:8px 0;break-inside:avoid;page-break-inside:avoid}'), 'complete chart notes and caption are bounded unsplit print units');
ok(printPagination.includes('.mr-report .mr-benefit-chart>figcaption{break-before:avoid;page-break-before:avoid}'), 'complete caption remains attached to preceding chart');
ok(source.includes("candidates.find(node => node.getAttribute('data-report-link-role') === focusRole)"), 'AI refresh keeps role-based focus restoration');
equal(sha(read('sample-data/production-diagnostic-samples.json')), sha(sampleBytes), 'saved sample artifact remains byte-for-byte unchanged');
console.log(JSON.stringify({status:'PASS', checks, documents, rendererVersion:R.rendererVersion, rendererSha256:sha(source), artifactSha256:sha(sampleBytes), providerCalls:0, networkCalls:0, notExecuted:['browser geometry and live DOM focus', 'PDF pagination', 'live account integration']}, null, 2));
