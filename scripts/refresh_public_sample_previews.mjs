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

export function refreshPublicSamplePreviews({root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),check=false}={}){
// A current v3 artifact and independent release manifest are prerequisites to
// either checking or writing promotional HTML. No v2 or candidate fallback.
const {artifact}=readPublicSampleFixture({root});
const escape = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const number = value => {assert.equal(typeof value,'number');assert.ok(Number.isFinite(value)&&value>=0);return value;};
const whole = value => number(value).toLocaleString('en-US',{maximumFractionDigits:0});
const money = value => '$'+whole(value);
const result = entry => entry.source.result?.tool_type ? entry.source.result : entry.source;
const firstAction = source => {
  assert.equal(source.ai_report.status,'complete');
  const action = source.ai_report.report.interpretation.recommendations.find(a=>typeof a.action==='string'&&a.action.trim())?.action;
  assert.ok(action,'Featured examples must have an actual accepted next step');
  return action;
};
const dv = result(artifact.outputs.decision_velocity);
const depth = result(artifact.outputs.depth_synthesis);
const dex = dv.exposure;
assert.equal(dex.priceable,true);
assert.equal(dex.sizing_status,'estimated');
assert.equal(dex.cost_estimated,true);
const names = {approval:'Approvals',coordination:'Coordination',handoff:'Handoffs',escalation:'Escalations',rework:'Rework',key_person:'Key-person reliance'};
const burdens = Object.entries(dv.burden_breakdown).filter(([key])=>names[key]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3);
for(const [,value] of burdens) assert.ok(number(value)<=100);
const model = dex.model;
const assumptions = whole(model.annual_cycles)+' requests/year; '+whole(model.input_hours_per_run)+' combined staff-hours/request; '+money(dex.average_hourly_cost)+'/hour. Recovery is a modeled share of the estimated burden, not a measured saving.';
const values = {
  artifactSha:artifact.artifact_sha256, scope:escape(dv.process_name+' / '+dv.business_unit),
  score:whole(dv.score), band:escape(dv.score_band), recovery:money(dex.recoverable_cost),
  action:escape(firstAction(dv)), assumptions:escape(assumptions),
  burdenRows:burdens.map(([key,value])=>'          <div class="hwd-chart-row"><span>'+escape(names[key])+'</span><div class="hwd-track" aria-hidden="true"><i style="width:'+value+'%"></i></div><strong data-demo-burden="'+key+'">'+whole(value)+'</strong></div>').join('\n')
};
const template=fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8').trimEnd();
const hero=template.replace(/\{\{(\w+)\}\}/g,(_,key)=>{assert.ok(key in values,'Unknown preview field '+key);return values[key];});
assert.ok(!/\{\{/.test(hero));

function depthCard(place) {
  const e=depth.pathway_exposure||depth.compounded_exposure;
  assert.ok(['available','partial'].includes(e.status));
  assert.equal(e.not_compounded,true);
  assert.ok(e.priceable_runs<=e.total_runs);
  const heading=place==='brief'?'h3':'h2';
  const {group,median:med,iqr:range,spreadLabel:spread}=depthPreviewEvidence(artifact.outputs.depth_synthesis);
  const full='sample-report.html#depth';
  return '<aside class="hero-report-proof has-sample-depth-tile" aria-label="Depth Synthesis sample report" data-sample-id="depth_synthesis" data-artifact-sha256="'+artifact.artifact_sha256+'">\n'+
'  <a class="hero-report-link" href="'+full+'" aria-label="Read the complete Depth Synthesis example">\n'+
'    <div id="monderman-depth-lure-composite">\n'+
'      <section class="md-tile" aria-labelledby="md-composite-title-'+place+'">\n'+
'        <header class="md-header"><span class="md-wordmark">Monderman.</span><span class="md-kind">Depth Synthesis<br>Sample data</span></header>\n'+
'        <div class="md-body">\n'+
'          <p class="md-kicker">Structural Clarity · '+whole(depth.submitted_run_count)+' submitted runs</p>\n'+
'          <'+heading+' id="md-composite-title-'+place+'">Make the business case for change.</'+heading+'>\n'+
'          <div class="md-opportunity"><span>Estimated annual recovery opportunity</span><strong data-promo-recovery>'+money(e.recoverable_cost)+'</strong><p>Based on the assumptions shown in the report, before subscription and implementation costs.</p></div>\n'+
'          <div class="md-economics"><div><strong data-promo-cost>'+money(e.annual_cost)+'</strong><span>Median annual labor-cost exposure</span></div><div><strong data-promo-hours>'+whole(e.annual_hours)+' hours</strong><span>Median annual time exposure</span></div></div>\n'+
'          <div class="md-score-summary"><strong data-promo-score>'+whole(med)+'</strong><span>Median Diagnostic Score<br>Middle half: '+whole(range[0])+'–'+whole(range[1])+' / 100</span><span>'+escape(spread)+'<br>Range: '+whole(group.score_range[0])+'–'+whole(group.score_range[1])+' / 100</span></div>\n'+
'          <div class="md-action"><strong>One recommended next step</strong><p>'+escape(firstAction(depth))+'</p></div>\n'+
'          <p class="md-basis">'+whole(e.priceable_runs)+' of '+whole(e.total_runs)+' runs include cost estimates. Recovery opportunity is the median of submitted estimates, not their sum. Full assumptions in the report.</p>\n'+
'        </div>\n'+
'      </section>\n'+
'    </div>\n'+
'    <div class="hero-report-caption"><span>Read the report</span><span aria-hidden="true">&rarr;</span></div>\n'+
'  </a>\n'+
'</aside>';
}
function replaceOne(html, pattern, replacement, label) {
 const matches=[...html.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
 assert.equal(matches.length,1,label+' must occur exactly once');
 return html.replace(pattern,replacement);
}
for(const [file,place] of [['index.html','home'],['Monderman_Platform_Brief.html','brief']]) {
 const filename=path.join(root,file), original=fs.readFileSync(filename,'utf8');
 let next=original;
 if(place==='home') next=replaceOne(next,/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/,hero,'Homepage tour');
 next=replaceOne(next,/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/,depthCard(place),'Depth preview');
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
