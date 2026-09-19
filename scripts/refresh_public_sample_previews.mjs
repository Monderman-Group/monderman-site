import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {readPublicSampleFixture,evidenceDigest} from './public_sample_fixture.mjs';

// Extract only the engine's saved score distribution. The caller first checks
// the full publication manifest; this additional boundary rejects missing,
// ambiguous or changed source values instead of mining model prose for them.
export function depthPreviewEvidence(entry){
  assert.equal(entry?.kind,'synthesis');
  const source=entry.source,p=entry.provenance;
  assert.equal(p?.synthetic,true);
  assert.equal(evidenceDigest(source),p.public_source_sha256,'Depth preview source differs from its reviewed projection');
  assert.equal(source?.synthesis_product,'depth_synthesis');
  assert.equal(source.source_groups?.length,1,'Depth preview requires one recorded lens');
  const group=source.source_groups[0];
  assert.equal(group.tool_type,'structural_clarity');
  assert.ok(Number.isSafeInteger(group.submitted_runs)&&group.submitted_runs>0);
  assert.equal(group.submitted_runs,source.submitted_run_count);
  assert.equal(group.submitted_runs,p.submitted_run_count);
  const reads=(source.sample_reads||[]).filter(row=>row.tool_type==='structural_clarity');
  assert.equal(reads.length,1,'Depth preview requires one unambiguous saved distribution reading');
  assert.equal(reads[0].n,group.submitted_runs);
  const labels={aligned:'Scores are closely aligned',divided:'Two separated score groups',dispersed:'Scores vary substantially',mixed:'Moderate variation'};
  assert.ok(Object.hasOwn(labels,reads[0].consensus?.read),'Depth preview spread classification is missing or unsupported');
  const score=value=>{assert.ok(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100,'Depth preview score must be recorded on its original scale');return value;};
  const pair=value=>{assert.ok(Array.isArray(value)&&value.length===2);const values=value.map(score);assert.ok(values[0]<=values[1]);return values;};
  const median=score(group.median_score),iqr=pair(group.score_iqr),range=pair(group.score_range);
  assert.ok(range[0]<=iqr[0]&&iqr[0]<=median&&median<=iqr[1]&&iqr[1]<=range[1],'Depth preview distribution bounds disagree');
  return {group,median,iqr,range,spreadLabel:labels[reads[0].consensus.read]};
}

// Pure rendering seam for clearly synthetic offline tests. It does not grant
// publication approval; the only file-writing entry point requires the manifest.
export function buildPublicSamplePreviewSections(artifact,template){
assert.equal(artifact.contract,'monderman-public-product-samples/v3');
assert.equal(artifact.synthetic,true);
assert.match(artifact.artifact_sha256||'',/^[a-f0-9]{64}$/);
const escape = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const number = value => {assert.equal(typeof value,'number');assert.ok(Number.isFinite(value)&&value>=0);return value;};
const whole = value => number(value).toLocaleString('en-US',{maximumFractionDigits:0});
const money = value => {assert.equal(typeof value,'number');assert.ok(Number.isFinite(value));return value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});};
const roundedMoney = value => money(Math.abs(value)>=10000?Math.round(value/1000)*1000:value);
const result = entry => entry.source.result?.tool_type ? entry.source.result : entry.source;
const firstAction = source => {
  assert.equal(source.ai_report.status,'complete');
  const action = source.ai_report.report.interpretation.recommendations.find(a=>typeof a.action==='string'&&a.action.trim())?.action;
  assert.ok(action,'Featured examples must have an actual accepted next step');
  return action;
};
const dv = result(artifact.outputs.decision_velocity);
const depth = result(artifact.outputs.depth_synthesis);
const dvEntry=artifact.outputs.decision_velocity;
assert.equal(dvEntry.kind,'diagnostic');assert.equal(dvEntry.provenance?.synthetic,true);
assert.equal(evidenceDigest(dvEntry.source),dvEntry.provenance.public_source_sha256,'DV preview source differs from its reviewed projection');
assert.equal(dv.tool_type,'decision_velocity');assert.ok(number(dv.score)<=100);
const names = {approval:'Approvals',coordination:'Coordination',handoff:'Handoffs',escalation:'Escalations',rework:'Rework',key_person:'Key-person reliance'};
// Missing dimensions are unknown, never zero-valued chart bars.
const burdens = Object.entries(dv.burden_breakdown).filter(([key,value])=>names[key]&&value!==null&&value!==undefined);
for(const [,value] of burdens) assert.ok(number(value)<=100);
burdens.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));burdens.splice(3);
assert.ok(burdens.length,'DV preview needs a recorded burden indicator');
const [focusKey,focusValue]=burdens[0];
const crossEntry=artifact.outputs.cross_lens_synthesis;
assert.equal(crossEntry?.kind,'synthesis');
assert.equal(crossEntry.provenance?.synthetic,true);
assert.equal(evidenceDigest(crossEntry.source),crossEntry.provenance.public_source_sha256,'Cross-Lens preview source differs from its reviewed projection');
const cross=result(crossEntry),scenario=cross.financial_scenario;
assert.equal(cross.synthesis_product,'cross_lens_synthesis');
assert.equal(scenario?.version,'operational-planning-scenario-20260913.1');
assert.equal(scenario.kind,'synthesis_planning_scenario');
assert.equal(scenario.publication_projection,'operational-scenario-public-20260913.1');
assert.equal(scenario.currency,'USD');
assert.equal(scenario.method?.usesDiagnosticScores,false);
assert.equal(scenario.method?.isConfidenceInterval,false);
assert.equal(scenario.inputs?.scopeConfirmed,true);
assert.equal(scenario.inputs?.overlapReviewed,true);
assert.ok(Array.isArray(cross.source_groups)&&cross.source_groups.length>=2);
const financialRange=key=>{
 const r=scenario.totals?.[key];
 assert.deepEqual(Object.keys(r||{}).sort(),['central','high','low']);
 for(const v of Object.values(r)){assert.equal(typeof v,'number');assert.ok(Number.isFinite(v));if(!key.startsWith('net'))assert.ok(v>=0);}
 assert.ok(r.low<=r.central&&r.central<=r.high);
 return r;
};
const hours=financialRange('potentialHoursFreed'),capacity=financialRange('capacityValue'),cost=financialRange('totalImplementationAndSubscriptionCost'),net=financialRange('netCapacityAndCashValue'),cash=financialRange('netCashEffect');
const activities=scenario.activities;
assert.ok(Array.isArray(activities)&&activities.length>0);
const proposals=scenario.inputs.activities;
assert.ok(Array.isArray(proposals)&&proposals.some(a=>typeof a.changeBasis==='string'&&a.changeBasis.trim()));
const largest=Math.max(...activities.map(a=>number(a.potentialHoursFreed.central)),1);
const lensOrder=['structural_clarity','decision_velocity','operational_systems','institutional_performance'];
assert.deepEqual(cross.source_groups.map(g=>g.tool_type).sort(),[...lensOrder].sort(),'Journey requires all four reviewed lens groups');
const groups=lensOrder.map(key=>cross.source_groups.find(g=>g.tool_type===key));
for(const group of groups){
 assert.ok(Number.isSafeInteger(group.participants)&&group.participants>0);
 assert.equal(group.participants,cross.participant_count,'Shared journey must preserve distinct participants across lenses');
 assert.equal(group.submitted_runs,group.participants,'Journey assumes one included run per participant and lens');
 assert.ok(number(group.median_score)<=100);
}
// These are saved campaign summaries, not newly generated AI reports. Only the
// approved Structural Clarity Depth output and Cross-Lens output carry a saved
// operating case. Never attach that case to another lens's summary.
const depthGroup=depthPreviewEvidence(artifact.outputs.depth_synthesis).group;
const journeyGroups=groups.map(g=>g.tool_type==='structural_clarity'?depthGroup:g);
function scenarioView(s,key,title){
 assert.equal(s?.version,'operational-planning-scenario-20260913.1');
 assert.equal(s.kind,'synthesis_planning_scenario');
 assert.equal(s.publication_projection,'operational-scenario-public-20260913.1');
 assert.equal(s.method?.usesDiagnosticScores,false);assert.equal(s.method?.isConfidenceInterval,false);
 assert.equal(s.inputs?.scopeConfirmed,true);assert.equal(s.inputs?.overlapReviewed,true);
 const range=k=>{const r=s.totals?.[k];assert.deepEqual(Object.keys(r||{}).sort(),['central','high','low']);for(const v of Object.values(r))assert.ok(typeof v==='number'&&Number.isFinite(v)&&(k.startsWith('net')||v>=0));assert.ok(r.low<=r.central&&r.central<=r.high);return r;};
 const h=range('potentialHoursFreed'),v=range('capacityValue'),c=range('totalImplementationAndSubscriptionCost'),n=range('netCapacityAndCashValue'),cashRange=range('netCashEffect');
 const max=Math.max(...s.activities.map(a=>number(a.potentialHoursFreed.central)),1);
 const rows=s.activities.map(a=>'<div class="hwd-chart-row hwd-activity-row"><span>'+escape(a.label)+'</span><div class="hwd-track" aria-hidden="true"><i style="width:'+(number(a.potentialHoursFreed.central)/max*100)+'%"></i></div><strong>'+whole(a.potentialHoursFreed.central)+'</strong></div>').join('');
 const chart=key==='cross_lens_synthesis'?'<div class="hwd-chart"><div class="hwd-chart-head"><h3>Where the time could come from</h3><span>Hours / year</span></div>'+rows+'</div>':'';
 const body='<div class="hwd-financial-case" data-demo-financial-case="'+key+'"><h3>'+title+'</h3><p class="hwd-case-basis">Separate operating inputs: '+whole(s.inputs.measuredPeople)+' people over '+whole(s.method.measurementDays)+' days. Central scenario · '+whole(s.inputs.horizonMonths)+' months.</p><div class="hwd-value-grid"><div class="hwd-value-primary"><strong data-demo-hours>'+whole(h.central)+'</strong><span>potential hours released</span></div><div class="hwd-value-primary"><strong data-demo-capacity>'+money(v.central)+'</strong><span>potential staff capacity value</span></div></div><div class="hwd-cost-row"><span>Implementation + subscription</span><strong data-demo-cost>'+money(c.central)+'</strong></div>'+chart+'<p class="hwd-financial-note">Capacity value is not cash savings. These estimates use operational inputs and change assumptions, not diagnostic scores.</p></div>';
 const assumptions='<div data-demo-assumptions-for="'+key+'"'+(key==='cross_lens_synthesis'?'':' hidden')+'><p>Illustrative example. '+whole(s.inputs.measuredPeople)+' people; '+whole(s.method.measurementDays)+' days of operational inputs projected over '+whole(s.inputs.horizonMonths)+' months. Activity reductions and adoption are assumptions. Activities are checked for overlap. The estimate is not scaled to unmeasured staff.</p><dl class="hwd-sensitivity">'+['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+' case</dt><dd>'+whole(h[k])+' hours / '+money(v[k])+' capacity value</dd></div>').join('')+'</dl><p>The low case shows '+money(n.low)+' after implementation and subscription costs. The central net cash effect is '+money(cashRange.central)+': no cash saving is assumed. Capacity value and cash are different; costs include internal staff time. <a href="sample-report.html#'+(key==='structural_clarity'?'depth':'synthesis')+'">Read the full report and assumptions.</a></p></div>';
 return {body,assumptions};
}
const scCase=depth.financial_scenario==null?null:scenarioView(depth.financial_scenario,'structural_clarity','Structural Clarity planning case');
const crossCase=scenarioView(scenario,'cross_lens_synthesis','Cross-Lens planning case');
const depthPanels=journeyGroups.map(g=>{
 for(const pair of [g.score_iqr,g.score_range]){assert.ok(Array.isArray(pair)&&pair.length===2);for(const v of pair)assert.ok(number(v)<=100);assert.ok(pair[0]<=pair[1]);}
 const modes=g.participant_mode_counts;assert.equal(modes.operational+modes.managerial+modes.senior_leader,g.participants);
 const reads=(g.tool_type==='structural_clarity'?depth:cross).sample_reads.filter(r=>r.tool_type===g.tool_type);
 assert.equal(reads.length,1);const read=reads[0];assert.equal(read.n,g.participants);assert.equal(read.score.median,g.median_score);assert.deepEqual(read.score.iqr,g.score_iqr);
 const modeLabels={operational:'People doing the work',managerial:'Managers',senior_leader:'Senior leaders'};
 assert.deepEqual(read.segments.map(s=>s.participant_mode).sort(),Object.keys(modeLabels).sort());
 const orderedSegments=Object.keys(modeLabels).map(mode=>read.segments.find(s=>s.participant_mode===mode));
 for(const segment of orderedSegments){assert.equal(segment.n,modes[segment.participant_mode]);assert.ok(segment.n>=5);assert.ok(number(segment.median_score)<=100);}
 const [doing,managing,leading]=orderedSegments.map(s=>s.median_score);
 // The following short comparisons are bounded to the saved direction, not a
 // causal inference or an AI quotation. Stop if future fixtures reverse it.
 assert.ok(g.tool_type==='institutional_performance'?leading<doing&&leading<managing:leading>doing&&leading>managing);
 const contrast={structural_clarity:'Senior leaders report clearer responsibilities than the people doing the work.',decision_velocity:'Senior leaders report fewer decision barriers than managers and people doing the work.',operational_systems:'Senior leaders report less process burden than the other two groups.',institutional_performance:'Senior leaders report less dependable performance than the other two groups.'}[g.tool_type];
 const perspectiveRows=orderedSegments.map(s=>'<div class="hwd-perspective-row" data-demo-perspective="'+s.participant_mode+'"><span>'+modeLabels[s.participant_mode]+'<small>'+whole(s.n)+' participants</small></span><div class="hwd-track" aria-hidden="true"><i style="width:'+s.median_score+'%"></i></div><strong>'+whole(s.median_score)+'</strong></div>').join('');
 const summary='<p class="hwd-campaign-label">Example campaign · '+whole(g.participants)+' participants</p><div class="hwd-group-metrics"><div><strong data-demo-depth-median>'+whole(g.median_score)+' / 100</strong><span>Group median</span></div><div><strong data-demo-depth-spread>'+whole(g.score_iqr[0])+'–'+whole(g.score_iqr[1])+'</strong><span>Middle half of scores</span></div></div><div class="hwd-perspective-chart"><h3>Perspective medians</h3>'+perspectiveRows+'<p class="hwd-score-direction">Higher scores describe better conditions.</p></div><p class="hwd-perspective-finding">'+contrast+'</p>';
 const content=g.tool_type==='structural_clarity'&&scCase?scCase.body:'<p class="hwd-depth-next">Use these differences to choose what to examine together. Test the scale of a proposed change with operating records before estimating its financial value.</p>';
 return '<div class="hwd-evidence" data-demo-evaluation="'+g.tool_type+'" data-demo-source-kind="'+(g.tool_type==='structural_clarity'?'saved_depth_synthesis':'same_lens_campaign_summary')+'" hidden>'+summary+content+'</div>';
}).join('');
const values={
 artifactSha:artifact.artifact_sha256,
 runCount:whole(cross.submitted_run_count),lensCount:whole(cross.source_groups.length),
 participants:whole(cross.participant_count),
 journeyOptions:journeyGroups.map(g=>'<label class="hwd-journey-tile"><input type="radio" name="hwd-journey" value="'+escape(g.tool_type)+'" aria-controls="hwd-panels"><span><strong>'+escape(g.tool_label)+'</strong><small>Depth Synthesis</small></span></label>').join('')+'<label class="hwd-journey-tile hwd-journey-cross"><input type="radio" name="hwd-journey" value="cross_lens_synthesis" aria-controls="hwd-panels" checked><span><strong>Cross-Lens Synthesis</strong><small>Combine all four diagnostics</small></span></label>',
 evaluationPanels:depthPanels+'<div class="hwd-evidence" data-demo-evaluation="cross_lens_synthesis" data-demo-source-kind="saved_cross_lens_synthesis"><p class="hwd-campaign-label">Example campaign · '+whole(cross.participant_count)+' participants · '+whole(cross.submitted_run_count)+' runs across '+whole(groups.length)+' diagnostics</p>'+crossCase.body+'</div>',
 financialAssumptions:(scCase?.assumptions||'')+crossCase.assumptions,
 people:whole(scenario.inputs.measuredPeople),measurementDays:whole(scenario.method.measurementDays),horizonMonths:whole(scenario.inputs.horizonMonths),
 hours:whole(hours.central),capacity:money(capacity.central),cost:money(cost.central),
 lensCards:journeyGroups.map(g=>'<div class="hwd-diagnostic" data-demo-group="'+escape(g.tool_type)+'" data-participants="'+whole(g.participants)+'"><span class="hwd-instrument-number">'+whole(g.submitted_runs)+' submitted runs</span><h3>'+escape(g.tool_label)+'</h3><p>Median score: <strong data-demo-lens="'+escape(g.tool_type)+'">'+whole(g.median_score)+' / 100</strong></p></div>').join(''),
 activityRows:activities.map(a=>'<div class="hwd-chart-row hwd-activity-row"><span>'+escape(a.label)+'</span><div class="hwd-track" aria-hidden="true"><i style="width:'+(number(a.potentialHoursFreed.central)/largest*100)+'%"></i></div><strong>'+whole(a.potentialHoursFreed.central)+'</strong></div>').join(''),
 changeProposal:escape(proposals.find(a=>a.changeBasis?.trim()).changeBasis),
 assumptions:escape('Illustrative example. '+whole(scenario.inputs.measuredPeople)+' people; '+whole(scenario.method.measurementDays)+' days of operational inputs projected over '+whole(scenario.inputs.horizonMonths)+' months. Activity reductions and adoption are assumptions. Activities are checked for overlap. The estimate is not scaled to unmeasured staff.'),
 sensitivityRows:['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+' case</dt><dd>'+whole(hours[k])+' hours / '+money(capacity[k])+' capacity value</dd></div>').join(''),
 downside:escape('The low case shows '+money(net.low)+' after implementation and subscription costs. The central net cash effect is '+money(cash.central)+': no cash saving is assumed. Capacity value and cash are different; costs include internal staff time.')
};
let hero=template.trimEnd().replace(/\{\{(\w+)\}\}/g,(_,key)=>{assert.ok(key in values,'Unknown preview field '+key);return values[key];});
assert.ok(!/\{\{/.test(hero));

function depthCard(place) {
  const heading=place==='brief'?'h3':'h2';
  const {group,median:med,iqr:range,spreadLabel:spread}=depthPreviewEvidence(artifact.outputs.depth_synthesis);
  let opportunity='<div class="md-opportunity"><span>Recorded Structural Clarity score</span><strong data-promo-median>'+whole(med)+' / 100</strong><p>Median of these submitted scores, not an organizational financial estimate.</p></div>',economics='',basis='These submitted scores describe the recorded campaign scope. They do not establish organizational savings or cause. Full evidence in the report.';
  const s=depth.financial_scenario;
  if(s!==null&&s!==undefined){
    assert.equal(s.version,'operational-planning-scenario-20260913.1');assert.equal(s.kind,'synthesis_planning_scenario');
    assert.equal(s.publication_projection,'operational-scenario-public-20260913.1');assert.equal(s.currency,'USD');
    assert.match(s.source_identity_digest||'',/^[a-f0-9]{64}$/);
    assert.equal(s.method?.usesDiagnosticScores,false);assert.equal(s.method?.isConfidenceInterval,false);
    assert.equal(s.inputs?.scopeConfirmed,true);assert.equal(s.inputs?.overlapReviewed,true);
    for(const value of [s.inputs.horizonMonths,s.inputs.measuredPeople])assert.ok(Number.isSafeInteger(value)&&value>0);
    assert.ok(number(s.method.measurementDays)>0);
    const valueRange=(key,{signed=false}={})=>{
      const r=s.totals?.[key];assert.deepEqual(Object.keys(r||{}).sort(),['central','high','low']);
      for(const value of Object.values(r)){assert.equal(typeof value,'number');assert.ok(Number.isFinite(value)&&(signed||value>=0));}
      assert.ok(r.low<=r.central&&r.central<=r.high);
      return money(r.low)+' to '+money(r.high);
    };
    valueRange('capacityValue');
    opportunity='<div class="md-opportunity"><span>'+whole(s.inputs.measuredPeople)+' people · '+whole(s.inputs.horizonMonths)+' months · Central scenario</span><strong data-promo-capacity>About '+roundedMoney(s.totals.capacityValue.central)+'</strong><p>Potential staff capacity value, not cash savings.</p><dl class="md-scenario-cases">'+['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+'</dt><dd>'+roundedMoney(s.totals.capacityValue[k])+'</dd></div>').join('')+'</dl><p>Rounded planning scenarios. See the assumptions and exact values in the report.</p></div>';
    economics='<div class="md-economics"><div><strong data-promo-net-cash>'+valueRange('netCashEffect',{signed:true})+'</strong><span>Net cash effect, after cash costs</span></div><div><strong data-promo-total-cost>'+valueRange('totalImplementationAndSubscriptionCost')+'</strong><span>Implementation and subscription cost, including internal staff time</span></div></div>';
    basis='Separate operational inputs cover '+whole(s.inputs.measuredPeople)+' people over '+whole(s.method.measurementDays)+' measured days. Capacity is not cash; campaign participation does not establish financial accuracy. Full assumptions and sensitivity cases in the report.';
  }
  const full='sample-report.html#depth';
  return '<aside class="hero-report-proof has-sample-depth-tile" aria-label="Depth Synthesis sample report" data-sample-id="depth_synthesis" data-artifact-sha256="'+artifact.artifact_sha256+'">\n'+
'  <a class="hero-report-link" href="'+full+'" aria-label="Read the complete Depth Synthesis example">\n'+
'    <div id="monderman-depth-lure-composite">\n'+
'      <section class="md-tile" aria-labelledby="md-composite-title-'+place+'">\n'+
'        <header class="md-header"><span class="md-wordmark">Monderman.</span><span class="md-kind">Depth Synthesis<br>Sample data</span></header>\n'+
'        <div class="md-body">\n'+
'          <p class="md-kicker">Structural Clarity · '+whole(depth.submitted_run_count)+' submitted runs</p>\n'+
'          <'+heading+' id="md-composite-title-'+place+'">Inspect the evidence. Choose a next step.</'+heading+'>\n'+
'          '+opportunity+'\n'+
'          '+economics+'\n'+
'          <div class="md-score-summary"><strong data-promo-score>'+whole(med)+'</strong><span>Median Diagnostic Score<br>Middle half: '+whole(range[0])+'–'+whole(range[1])+' / 100</span><span>'+escape(spread)+'<br>Range: '+whole(group.score_range[0])+'–'+whole(group.score_range[1])+' / 100</span></div>\n'+
'          <div class="md-action"><strong>One recommended next step</strong><p>'+escape(firstAction(depth))+'</p></div>\n'+
'          <p class="md-basis">'+escape(basis)+'</p>\n'+
'        </div>\n'+
'      </section>\n'+
'    </div>\n'+
'    <div class="hero-report-caption"><span>Read the report</span><span aria-hidden="true">&rarr;</span></div>\n'+
'  </a>\n'+
'</aside>';
}
return {hero,home:depthCard('home'),brief:depthCard('brief')};
}
function replaceOne(html, pattern, replacement, label) {
 const matches=[...html.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
 assert.equal(matches.length,1,label+' must occur exactly once');
 return html.replace(pattern,replacement);
}
export function refreshPublicSamplePreviews({root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),check=false}={}){
// Exact current v3 and independent manifest remain prerequisites. No v2 fallback.
const {artifact}=readPublicSampleFixture({root});
const template=fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8');
const sections=buildPublicSamplePreviewSections(artifact,template);
for(const [file,place] of [['index.html','home'],['Monderman_Platform_Brief.html','brief']]) {
 const filename=path.join(root,file), original=fs.readFileSync(filename,'utf8');
 let next=original;
 if(place==='home') next=replaceOne(next,/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/,sections.hero,'Homepage tour');
 next=replaceOne(next,/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/,sections[place],'Depth preview');
 if(check) assert.equal(next,original,file+' previews differ from the approved artifact. Run refresh_public_sample_previews.mjs.');
 else fs.writeFileSync(filename,next);
}
console.log('PUBLIC_SAMPLE_PREVIEWS_'+(check?'CHECKED':'GENERATED')+' '+artifact.artifact_sha256);
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  const args=process.argv.slice(2);
  assert.ok(args.length===0||args.length===1&&args[0]==='--check','Only optional --check is supported');
  refreshPublicSamplePreviews({check:args.includes('--check')});
}
