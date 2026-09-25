import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {readPublicSampleFixture,evidenceDigest} from './public_sample_fixture.mjs';
import {buildHomepageReportQuad} from './homepage_report_quad_20260925.mjs';

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

// Validate the saved case values without converting unknown categories to zero
// or sorting retained capacity after its labor allocation. Publication approval
// remains the separate manifest boundary in refreshPublicSamplePreviews.
function threeBenefitPreview(s){
 assert.equal(s?.version,'operational-planning-scenario-20260919.2');
 assert.equal(s.kind,'synthesis_planning_scenario');assert.equal(s.currency,'USD');
 assert.equal(s.publication_projection,'three-benefit-scenario-public-20260919.1');
 assert.match(s.source_identity_digest||'',/^[a-f0-9]{64}$/);
 assert.equal(s.inputs?.schemaVersion,'operational-planning-input-20260919.2');
 assert.equal(s.inputs.scopeConfirmed,true);assert.equal(s.inputs.overlapReviewed,true);
 assert.equal(s.method?.usesDiagnosticScores,false);assert.equal(s.method?.isConfidenceInterval,false);
 assert.ok(Number.isSafeInteger(s.inputs.horizonMonths)&&s.inputs.horizonMonths>0&&s.inputs.horizonMonths<=36);
 const levels=['low','central','high'],categories=['spendingReduction','spendingAvoidance','staffCapacity'];
 const range=(value,{nullable=false,signed=false}={})=>{
  if(nullable&&value===null)return null;
  assert.deepEqual(Object.keys(value||{}).sort(),['central','high','low']);
  for(const k of levels)assert.ok(typeof value[k]==='number'&&Number.isFinite(value[k])&&(signed||value[k]>=0));
  return value;
 };
 for(const key of categories){
  const b=s.benefits?.[key],input=s.inputs[key==='staffCapacity'?'capacity':key];
  assert.ok(b&&['estimated','none_identified','not_estimated'].includes(b.status));assert.equal(input?.status,b.status);
  assert.ok(typeof b.basis==='string'&&b.basis.trim());assert.ok(Array.isArray(b.missingInputs));
  if(b.status==='not_estimated'){assert.equal(b.amount,null);assert.ok(b.missingInputs.length);}
  else{range(b.amount);if(b.status==='none_identified')assert.ok(levels.every(k=>b.amount[k]===0));}
  if(key==='staffCapacity'){
   if(b.status==='not_estimated')assert.equal(b.hours,null);else{range(b.hours);if(b.status==='none_identified')assert.ok(levels.every(k=>b.hours[k]===0));}
  }
 }
 const expected={estimatedCategories:categories.filter(k=>s.benefits[k].status==='estimated'),zeroCategories:categories.filter(k=>s.benefits[k].status==='none_identified'),missingCategories:categories.filter(k=>s.benefits[k].status==='not_estimated')};
 for(const [key,value]of Object.entries(expected))assert.deepEqual(s.coverage?.[key],value,'Three-benefit coverage must match the category statuses');
 assert.equal(s.coverage.complete,!expected.missingCategories.length);
 const t=s.totals;assert.ok(t);
 for(const [key,benefit]of [['existingSpendingReduction','spendingReduction'],['futureSpendingAvoidance','spendingAvoidance'],['capacityValue','staffCapacity']])assert.deepEqual(t[key],s.benefits[benefit].amount);
 assert.deepEqual(t.potentialHoursFreed,s.benefits.staffCapacity.hours);
 for(const key of ['cashInvestment','totalImplementationAndSubscriptionCost','knownBenefitSubtotal'])range(t[key]);
 range(t.netKnownBenefitSubtotal,{signed:true});
 for(const [key,known]of [['netExistingCashEffect',s.benefits.spendingReduction.amount!==null],['netCashEffect',s.benefits.spendingReduction.amount!==null&&s.benefits.spendingAvoidance.amount!==null],['netCapacityAndCashValue',s.coverage.complete]]){if(known)range(t[key],{signed:true});else assert.equal(t[key],null);}
 const near=(a,b)=>Math.abs(a-b)<=.03+Number.EPSILON*Math.max(Math.abs(a),Math.abs(b))*8;
 for(const k of levels){
  const costCase={low:'high',central:'central',high:'low'}[k],subtotal=categories.reduce((sum,key)=>sum+(s.benefits[key].amount?.[k]??0),0);
  assert.ok(near(subtotal,t.knownBenefitSubtotal[k]));assert.ok(near(t.knownBenefitSubtotal[k]-t.totalImplementationAndSubscriptionCost[costCase],t.netKnownBenefitSubtotal[k]));
  if(t.netExistingCashEffect)assert.ok(near(t.existingSpendingReduction[k]-t.cashInvestment[costCase],t.netExistingCashEffect[k]));
  if(t.netCashEffect)assert.ok(near(t.existingSpendingReduction[k]+t.futureSpendingAvoidance[k]-t.cashInvestment[costCase],t.netCashEffect[k]));
  if(t.netCapacityAndCashValue)assert.ok(near(t.netKnownBenefitSubtotal[k],t.netCapacityAndCashValue[k]));
 }
 assert.ok(Array.isArray(s.activities)&&Array.isArray(s.inputs.capacity.activities));
 if(s.inputs.capacity.status==='estimated'){
  assert.ok(Number.isSafeInteger(s.inputs.capacity.measuredPeople)&&s.inputs.capacity.measuredPeople>0);assert.ok(typeof s.method.measurementDays==='number'&&s.method.measurementDays>0);
  assert.ok(s.activities.length&&s.inputs.capacity.activities.length);
 }else{assert.equal(s.inputs.capacity.measuredPeople,null);assert.equal(s.activities.length,0);assert.equal(s.inputs.capacity.activities.length,0);}
 return s;
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
const featuredAction = source => {
  assert.equal(source.ai_report.status,'complete');
  // Feature the accepted limited-change option, not an editorial invention or
  // an implication that this is the report's preferred organizational path.
  const action = source.ai_report.report.interpretation.action_options.find(a=>a.intensity==='limited'&&typeof a.action==='string'&&a.action.trim())?.action;
  assert.ok(action,'Featured examples must have an actual accepted limited-change option');
  return action;
};
const depth = result(artifact.outputs.depth_synthesis);
const crossEntry=artifact.outputs.cross_lens_synthesis;
assert.equal(crossEntry?.kind,'synthesis');
assert.equal(crossEntry.provenance?.synthetic,true);
assert.equal(evidenceDigest(crossEntry.source),crossEntry.provenance.public_source_sha256,'Cross-Lens preview source differs from its reviewed projection');
const cross=result(crossEntry),scenario=cross.financial_scenario;
assert.equal(cross.synthesis_product,'cross_lens_synthesis');
const threeBenefit=scenario?.version==='operational-planning-scenario-20260919.2';
if(threeBenefit)threeBenefitPreview(scenario);
else assert.equal(scenario?.version,'operational-planning-scenario-20260913.1');
assert.equal(scenario.kind,'synthesis_planning_scenario');
assert.equal(scenario.publication_projection,threeBenefit?'three-benefit-scenario-public-20260919.1':'operational-scenario-public-20260913.1');
assert.equal(scenario.currency,'USD');
assert.equal(scenario.method?.usesDiagnosticScores,false);
assert.equal(scenario.method?.isConfidenceInterval,false);
assert.equal(scenario.inputs?.scopeConfirmed,true);
assert.equal(scenario.inputs?.overlapReviewed,true);
assert.ok(Array.isArray(cross.source_groups)&&cross.source_groups.length>=2);
const financialRange=key=>{
 const r=scenario.totals?.[key];
 if(threeBenefit&&r===null)return null;
 assert.deepEqual(Object.keys(r||{}).sort(),['central','high','low']);
 for(const v of Object.values(r)){assert.equal(typeof v,'number');assert.ok(Number.isFinite(v));if(!key.startsWith('net'))assert.ok(v>=0);}
 if(!threeBenefit)assert.ok(r.low<=r.central&&r.central<=r.high);
 return r;
};
const hours=financialRange('potentialHoursFreed'),capacity=financialRange('capacityValue'),cost=financialRange('totalImplementationAndSubscriptionCost'),net=financialRange('netCapacityAndCashValue'),cash=financialRange('netCashEffect');
const activities=scenario.activities;
assert.ok(Array.isArray(activities)&&(threeBenefit||activities.length>0));
const proposals=threeBenefit?[...scenario.inputs.capacity.activities,...scenario.inputs.spendingReduction.items,...scenario.inputs.spendingAvoidance.items]:scenario.inputs.activities;
assert.ok(Array.isArray(proposals)&&(threeBenefit||proposals.some(a=>typeof a.changeBasis==='string'&&a.changeBasis.trim())));
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
 if(s?.version==='operational-planning-scenario-20260919.2')return threeBenefitView(s,key,title);
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
const benefitLabels={spendingReduction:'Cash spending reduced',spendingAvoidance:'Future spending avoided',staffCapacity:'Retained staff capacity'};
const statusLabel=b=>b.status==='not_estimated'?'Not estimated':b.status==='none_identified'?'Reviewed: none identified':'Estimate entered';
const caseMoney=value=>Math.abs(value)>0&&Math.abs(value)<1?value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumSignificantDigits:3}):money(value);
const caseNumber=value=>value>0&&value<1?value.toLocaleString('en-US',{maximumSignificantDigits:3}):whole(value);
const amount=(r,k='central',format=caseMoney)=>r===null?'Not estimated':format(r[k]);
function benefitCoverage(s){return s.coverage.complete?'All three benefit categories have been assessed.':'Partial assessment: '+s.coverage.missingCategories.map(k=>benefitLabels[k].toLowerCase()).join(', ')+' not estimated. Subtotals include entered categories only.';}
function threeBenefitView(s,key,title){
 threeBenefitPreview(s);const t=s.totals,b=s.benefits,c=s.inputs.capacity;
 const scope=c.status==='estimated'?whole(c.measuredPeople)+' measured people over '+whole(s.method.measurementDays)+' days. ':'Staff capacity: '+statusLabel(b.staffCapacity).toLowerCase()+'. ';
 const primary=(attr,values,label,status)=>'<div class="hwd-value-primary">'+(values===null?'<span '+attr+'>Not estimated</span>':'<strong '+attr+'>'+amount(values)+'</strong>')+'<span>'+label+(status==='none_identified'?' · reviewed zero':'')+'</span></div>';
 const hoursCard='<div class="hwd-value-primary">'+(t.potentialHoursFreed===null?'<span data-demo-hours>Not estimated</span>':'<strong data-demo-hours>'+amount(t.potentialHoursFreed,'central',caseNumber)+'</strong>')+'<span>staff hours available for other work</span></div>';
 const cards=primary('data-demo-spending-reduction',b.spendingReduction.amount,'cash spending reduced',b.spendingReduction.status)+primary('data-demo-spending-avoidance',b.spendingAvoidance.amount,'future spending avoided',b.spendingAvoidance.status)+hoursCard+primary('data-demo-capacity',b.staffCapacity.amount,'retained staff capacity value',b.staffCapacity.status);
 const body='<div class="hwd-financial-case" data-demo-financial-case="'+key+'" data-demo-financial-version="2"><h3>'+title+'</h3><p class="hwd-case-basis">Separate operating inputs: '+scope+'Central scenario · '+whole(s.inputs.horizonMonths)+' months.</p><div class="hwd-value-grid">'+cards+'</div><div class="hwd-cost-row"><span>Implementation + subscription</span><strong data-demo-cost>'+money(t.totalImplementationAndSubscriptionCost.central)+'</strong></div><p class="hwd-financial-note" data-demo-coverage>'+benefitCoverage(s)+'</p><p class="hwd-financial-note">Capacity is not cash savings. Hours assigned to spending benefits are excluded from retained capacity. These estimates use operating records and assumptions, not diagnostic scores.</p></div>';
 const cases=['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+' case</dt><dd>'+amount(b.spendingReduction.amount,k)+' lower spending; '+amount(b.spendingAvoidance.amount,k)+' avoided future spending; '+amount(b.staffCapacity.amount,k)+' retained capacity.</dd></div>').join('');
 const resultLabel=s.coverage.complete?'Combined value after all costs':'Entered-benefit subtotal after all costs';
 const assumptions='<div data-demo-assumptions-for="'+key+'"'+(key==='cross_lens_synthesis'?'':' hidden')+'><p>Illustrative example. '+scope+whole(s.inputs.horizonMonths)+' planning months. Spending uses current or documented planned baselines. '+benefitCoverage(s)+'</p><dl class="hwd-sensitivity">'+cases+'</dl><p>Low case: net existing-spending effect after cash costs '+amount(t.netExistingCashEffect,'low')+'; net spending effect versus current and planned baselines '+amount(t.netCashEffect,'low')+'. '+resultLabel+', low case: '+caseMoney(t.netKnownBenefitSubtotal.low)+'.</p><p>'+resultLabel+', central case: '+money(t.netKnownBenefitSubtotal.central)+'. Net existing-spending effect after cash costs: '+amount(t.netExistingCashEffect)+'. Net spending effect versus current and planned baselines: '+amount(t.netCashEffect)+'. This is not a measured bank-balance change.</p><p>Low, central and high are input cases, not probability bounds. Retained capacity can fall as more hours fund spending benefits. Gross capacity is spread evenly across planning months; the full report reconciles its allocation. Costs include internal staff time. <a href="sample-report.html#'+(key==='structural_clarity'?'depth':'synthesis')+'">Read the full report and assumptions.</a></p></div>';
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
 const content=g.tool_type==='structural_clarity'&&scCase?scCase.body:'<p class="hwd-depth-next">Use these differences to choose what to examine together. Check the scale of a proposed change with operating records before estimating its financial value.</p>';
 return '<div class="hwd-evidence" data-demo-evaluation="'+g.tool_type+'" data-demo-source-kind="'+(g.tool_type==='structural_clarity'?'saved_depth_synthesis':'same_lens_campaign_summary')+'" hidden>'+summary+content+'</div>';
}).join('');
const values={
 artifactSha:artifact.artifact_sha256,
 runCount:whole(cross.submitted_run_count),lensCount:whole(cross.source_groups.length),
 participants:whole(cross.participant_count),
 journeyOptions:journeyGroups.map(g=>'<label class="hwd-journey-tile" data-demo-group="'+escape(g.tool_type)+'" data-participants="'+g.participants+'"><input type="radio" name="hwd-journey" value="'+escape(g.tool_type)+'" aria-controls="hwd-panels"><span><strong>'+escape(g.tool_label)+'</strong><small>Depth Synthesis</small><span class="hwd-journey-facts">'+whole(g.participants)+' participants · Median <b data-demo-lens="'+escape(g.tool_type)+'">'+whole(g.median_score)+' / 100</b></span></span></label>').join('')+'<label class="hwd-journey-tile hwd-journey-cross"><input type="radio" name="hwd-journey" value="cross_lens_synthesis" aria-controls="hwd-panels" checked><span><strong>Cross-Lens Synthesis</strong><small>Combine all four diagnostics</small><span class="hwd-journey-facts">'+whole(cross.participant_count)+' participants · '+whole(cross.submitted_run_count)+' runs</span></span></label>',
 evaluationPanels:depthPanels+'<div class="hwd-evidence" data-demo-evaluation="cross_lens_synthesis" data-demo-source-kind="saved_cross_lens_synthesis"><p class="hwd-campaign-label">Example campaign · '+whole(cross.participant_count)+' participants · '+whole(cross.submitted_run_count)+' runs across '+whole(groups.length)+' diagnostics</p>'+crossCase.body+'</div>',
 financialAssumptions:(scCase?.assumptions||'')+crossCase.assumptions,
 people:threeBenefit?(scenario.inputs.capacity.measuredPeople===null?'Not estimated':whole(scenario.inputs.capacity.measuredPeople)):whole(scenario.inputs.measuredPeople),measurementDays:scenario.method.measurementDays===null?'Not estimated':whole(scenario.method.measurementDays),horizonMonths:whole(scenario.inputs.horizonMonths),
 hours:hours===null?'Not estimated':whole(hours.central),capacity:capacity===null?'Not estimated':money(capacity.central),cost:money(cost.central),
 activityRows:activities.map(a=>'<div class="hwd-chart-row hwd-activity-row"><span>'+escape(a.label)+'</span><div class="hwd-track" aria-hidden="true"><i style="width:'+(number(a.potentialHoursFreed.central)/largest*100)+'%"></i></div><strong>'+whole(a.potentialHoursFreed.central)+'</strong></div>').join(''),
 changeProposal:escape(proposals.find(a=>a.changeBasis?.trim())?.changeBasis||'No operating benefit estimate has been entered.'),
 assumptions:escape(threeBenefit?'Illustrative three-benefit scenario. '+benefitCoverage(scenario):'Illustrative example. '+whole(scenario.inputs.measuredPeople)+' people; '+whole(scenario.method.measurementDays)+' days of operational inputs projected over '+whole(scenario.inputs.horizonMonths)+' months. Activity reductions and adoption are assumptions. Activities are checked for overlap. The estimate is not scaled to unmeasured staff.'),
 sensitivityRows:['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+' case</dt><dd>'+(hours===null?'Not estimated':whole(hours[k])+' hours')+' / '+(capacity===null?'Not estimated':money(capacity[k])+' capacity value')+'</dd></div>').join(''),
 downside:escape(threeBenefit?'Entered-benefit subtotal after all costs, central case: '+money(scenario.totals.netKnownBenefitSubtotal.central)+'. '+benefitCoverage(scenario):'The low case shows '+money(net.low)+' after implementation and subscription costs. The central net cash effect is '+money(cash.central)+': no cash saving is assumed. Capacity value and cash are different; costs include internal staff time.')
};
// Compact homepage fields remain a projection of this same accepted source.
// An exact legacy-pattern mapping is intentionally narrow: never manufacture
// a short finding when a future sample records a different condition.
if (template.includes('{{compactFinding}}')) {
 const counts=cross.campaign_evidence?.counts;
 assert.equal(cross.score_status,'published');
 assert.equal(cross.cross_diagnostic_score,cross.aggregate_score);
 assert.ok(number(cross.cross_diagnostic_score)<=100);
 assert.equal(counts?.distinctParticipantsAcrossLenses,cross.participant_count);
 assert.equal(counts?.selectedRuns,cross.submitted_run_count);
 assert.ok(Number.isSafeInteger(counts.declaredPopulation)&&counts.declaredPopulation>=cross.participant_count);
 const roles=cross.campaign_evidence.depth.lenses[0].requiredGroups;
 const roleView=rows=>rows.map(g=>({id:g.id,label:g.label,count:g.participants}));
 for(const lens of cross.campaign_evidence.depth.lenses){
  assert.deepEqual(roleView(lens.requiredGroups),roleView(roles),'Compact role counts must agree across lenses, never be summed');
  for(const group of lens.requiredGroups)assert.ok(group.privacy?.mayDisplayGroupStatistics===true&&Number.isSafeInteger(group.privacy.minimumDisplayedGroupSize)&&group.privacy.minimumDisplayedGroupSize>0&&Number.isSafeInteger(group.participants)&&group.participants>=group.privacy.minimumDisplayedGroupSize,'Compact group display requires the saved privacy permission');
 }
 const legacy='Two or more lens-level signals share the highest observed count, so the coherent read does not identify one unique dominant shared pattern. Use the lens summaries and contradictions to define a bounded validation question rather than forcing one causal diagnosis.';
 assert.equal(cross.primary_pattern,legacy,'Compact finding has only one reviewed source mapping');
 const option=cross.campaign_action_options.find(a=>a.id==='campaign_moderate'&&a.intensity==='moderate');
 assert.ok(option);
 const accepted=cross.ai_report.report.interpretation.action_options.find(a=>a.option_id===option.id);
 assert.equal(accepted?.action,option.action,'Compact action must be both engine-owned and present in the accepted report');
 const action=option.action.match(/^[^]*?\.(?:\s|$)/)?.[0].trim();
 assert.ok(action,'Compact action uses a complete saved sentence, not an ellipsis');
 const metric=(attr,label,range,format)=>'<div><dt>'+label+'</dt><dd '+attr+(range===null?'':' data-exact-value="'+range.central+'" title="'+escape(label+': '+range.central)+'"')+'>'+(range===null?'Not estimated':format(range.central))+'</dd></div>';
 Object.assign(values,{
  population:whole(counts.declaredPopulation),composite:whole(cross.cross_diagnostic_score),conditionBand:escape(cross.condition_band),
  compactFinding:'Several patterns appear across the diagnostics; none stands out as the single shared explanation.',
  compactRoles:roles.map(g=>'<div><strong>'+whole(g.participants)+'</strong><span>'+escape(g.label)+'</span></div>').join(''),
  compactLenses:groups.map(g=>'<span>'+escape(g.tool_label)+'</span>').join(''),
  compactFinancials:metric('data-demo-hours','Capacity for other work',hours,value=>caseNumber(value)+' h')+metric('data-demo-spending-reduction','Current spending reduced',threeBenefit?scenario.totals.existingSpendingReduction:null,caseMoney)+metric('data-demo-spending-avoidance','Future spending avoided',threeBenefit?scenario.totals.futureSpendingAvoidance:null,caseMoney),
  compactAction:escape(action),optionCount:whole(cross.campaign_action_options.length),compactPrerequisite:escape(option.prerequisite),compactSuccess:escape(option.success_check),
  compactFinancialAssumptions:crossCase.assumptions
 });
}
let hero=template.trimEnd().replace(/\{\{(\w+)\}\}/g,(_,key)=>{assert.ok(key in values,'Unknown preview field '+key);return values[key];});
assert.ok(!/\{\{/.test(hero));

function depthCard(place) {
  const heading=place==='brief'?'h3':'h2';
  const {group,median:med,iqr:range,spreadLabel:spread}=depthPreviewEvidence(artifact.outputs.depth_synthesis);
  if(place==='home'&&depth.financial_scenario?.version==='operational-planning-scenario-20260919.2'&&depth.financial_scenario.coverage?.complete&&['spendingReduction','spendingAvoidance','staffCapacity'].every(key=>depth.financial_scenario.benefits?.[key]?.status==='estimated')&&depth.campaign_evidence&&depth.financial_benefit_assessment){
    threeBenefitPreview(depth.financial_scenario);
    return buildHomepageReportQuad({entry:artifact.outputs.depth_synthesis,artifactSha:artifact.artifact_sha256,median:med,featuredAction:featuredAction(depth)});
  }
  let opportunity='<div class="md-opportunity"><span>Recorded Structural Clarity score</span><strong data-promo-median>'+whole(med)+' / 100</strong><p>Median of these submitted scores, not an organizational financial estimate.</p></div>',economics='',basis='These submitted scores describe the recorded campaign scope. They do not establish organizational savings or cause. Full evidence in the report.';
  const s=depth.financial_scenario;
  if(s!==null&&s!==undefined){
   if(s.version==='operational-planning-scenario-20260919.2'){
    threeBenefitPreview(s);const b=s.benefits,t=s.totals,c=s.inputs.capacity;
    const central=r=>amount(r),rounded=v=>Math.abs(v)>=10000?money(Math.round(v/1000)*1000):caseMoney(v);
    const capacityHeadline=b.staffCapacity.amount===null?'<p data-promo-capacity>Not estimated</p>':'<strong data-promo-capacity>About '+rounded(b.staffCapacity.amount.central)+'</strong>';
    const exceptionalStatus=benefit=>benefit.status==='estimated'?'':' '+statusLabel(benefit)+'.';
    opportunity='<div class="md-opportunity"><span>'+(c.status==='estimated'?whole(c.measuredPeople)+' measured people · ':'')+whole(s.inputs.horizonMonths)+' months · Central case</span>'+capacityHeadline+'<p>Staff capacity value, not cash savings.'+exceptionalStatus(b.staffCapacity)+'</p><dl class="md-scenario-cases" data-three-benefit-cases>'+['low','central','high'].map(k=>'<div><dt>'+({low:'Low',central:'Central',high:'High'}[k])+'</dt><dd>'+amount(b.staffCapacity.amount,k,rounded)+'</dd></div>').join('')+'</dl><p>Each case uses different assumptions. Exact values are in the report.</p></div>';
    economics='<div class="md-economics"><div><strong data-promo-spending-reduction>'+central(b.spendingReduction.amount)+'</strong><span>Current spending reduced · central case'+exceptionalStatus(b.spendingReduction)+'</span></div><div><strong data-promo-spending-avoidance>'+central(b.spendingAvoidance.amount)+'</strong><span>Future spending avoided · central case'+exceptionalStatus(b.spendingAvoidance)+'</span></div><div><strong data-promo-net-cash>'+central(t.netCashEffect)+'</strong><span>Net spending benefit after cash costs · central case</span></div><div><strong data-promo-total-cost>'+money(t.totalImplementationAndSubscriptionCost.central)+'</strong><span>Total cost, including staff time · central case</span></div></div>';
    basis=(s.coverage.complete?'':benefitCoverage(s)+' ')+'Illustrative planning assumptions. Capacity excludes hours counted as spending benefits. Full inputs and costs in the report.';
   }else{
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
'          <div class="md-action"><strong>One change to consider</strong><p>'+escape(featuredAction(depth))+'</p></div>\n'+
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
