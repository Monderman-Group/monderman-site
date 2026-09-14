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
const assumptions = 'One participant’s recorded answers. The score and burden indicators do not measure hours, organizational cost or savings. Missing dimensions remain unknown.';
const values = {
  artifactSha:artifact.artifact_sha256, scope:escape(dv.process_name+' / '+dv.business_unit),
  score:whole(dv.score), band:escape(dv.score_band), recovery:whole(focusValue)+' / 100',
  action:escape(firstAction(dv)), assumptions:escape(assumptions),
  burdenRows:burdens.map(([key,value])=>'          <div class="hwd-chart-row"><span>'+escape(names[key])+'</span><div class="hwd-track" aria-hidden="true"><i style="width:'+value+'%"></i></div><strong data-demo-burden="'+key+'">'+whole(value)+'</strong></div>').join('\n')
};
// Keep the stored template unchanged until the authorized artifact refresh.
// Only this exact obsolete slot is converted; all other branding/layout stays.
let hero=template.trimEnd().replace(/\{\{(\w+)\}\}/g,(_,key)=>{assert.ok(key in values,'Unknown preview field '+key);return values[key];});
hero=replaceOne(hero,/<div class="hwd-reading">[\s\S]*?<\/div>/,
  '<div class="hwd-reading"><span class="hwd-eyebrow">'+escape(names[focusKey])+'</span><strong data-demo-focus="'+focusKey+'">'+whole(focusValue)+' / 100</strong><p>Highest recorded burden indicator in this participant’s result. Not time, cost or savings.</p></div>','Recorded DV focus');
hero=replaceOne(hero,/<summary>View financial assumptions<\/summary>/,'<summary>Read the result scope</summary>','Respondent scope');
hero=replaceOne(hero,/Three highest burden measures/,(burdens.length===3?'Three':burdens.length===2?'Two':'One')+' highest recorded burden '+(burdens.length===1?'measure':'measures'),'Available indicators');
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
    opportunity='<div class="md-opportunity"><span>Operational scenario · '+whole(s.inputs.horizonMonths)+' months</span><strong data-promo-capacity>'+valueRange('capacityValue')+'</strong><p>Potential staff capacity value, not cash savings. User-specified low to high scenarios, not a forecast.</p></div>';
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
