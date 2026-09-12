// Offline extraction tests only. These fabricated display rows are not an
// approved sample artifact, a provider evaluation or a publication manifest.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {depthPreviewEvidence} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';

let checks=0;
const clone=value=>structuredClone(value);
const seal=entry=>{entry.provenance.public_source_sha256=evidenceDigest(entry.source);return entry;};
const fixture=()=>seal({kind:'synthesis',provenance:{synthetic:true,submitted_run_count:27},source:{
  synthesis_product:'depth_synthesis',submitted_run_count:27,
  source_groups:[{tool_type:'structural_clarity',submitted_runs:27,median_score:62,score_iqr:[58,66],score_range:[54,71]}],
  sample_reads:[{tool_type:'structural_clarity',n:27,consensus:{read:'mixed'}}],
  ai_report:{status:'complete',report:{interpretation:{recommendations:[{action:'Review an authorized recent example.',reason:'A concise tailored explanation without any distribution label.'}]}}},
}});
const expected={aligned:'Scores are closely aligned',divided:'Two separated score groups',dispersed:'Scores vary substantially',mixed:'Moderate variation'};
for(const [read,label]of Object.entries(expected)){
  const entry=fixture();entry.source.sample_reads[0].consensus.read=read;seal(entry);
  const before=clone(entry),value=depthPreviewEvidence(entry);
  assert.equal(value.spreadLabel,label);assert.equal(value.median,62);assert.deepEqual(value.iqr,[58,66]);assert.deepEqual(value.range,[54,71]);
  assert.deepEqual(entry,before);checks++;
}
for(const reason of ['', 'variation in submitted scores: An invented classification.',
  'Median score: 99. Guaranteed savings: $1000000.', 'Another ordinary explanation with no numeric values.']){
  const entry=fixture();entry.source.ai_report.report.interpretation.recommendations[0].reason=reason;seal(entry);
  const value=depthPreviewEvidence(entry);
  assert.equal(value.spreadLabel,'Moderate variation');assert.equal(value.median,62);checks++;
}
// The outer public artifact/manifest binding remains authoritative. For the
// independent structural tests below only this synthetic source digest is
// recomputed, deliberately isolating deeper checks; no approval is fabricated.
const mutations=[
  ['missing distribution',e=>e.source.sample_reads=[]],
  ['duplicate distribution',e=>e.source.sample_reads.push(clone(e.source.sample_reads[0]))],
  ['different distribution lens',e=>e.source.sample_reads[0].tool_type='decision_velocity'],
  ['unknown classification',e=>e.source.sample_reads[0].consensus.read='unverified'],
  ['missing classification',e=>delete e.source.sample_reads[0].consensus],
  ['ambiguous source groups',e=>e.source.source_groups.push(clone(e.source.source_groups[0]))],
  ['wrong source lens',e=>e.source.source_groups[0].tool_type='decision_velocity'],
  ['missing source group',e=>e.source.source_groups=[]],
  ['wrong product',e=>e.source.synthesis_product='cross_lens_synthesis'],
  ['wrong kind',e=>e.kind='diagnostic'],
  ['not synthetic',e=>e.provenance.synthetic=false],
  ['source count mismatch',e=>e.source.submitted_run_count=28],
  ['provenance count mismatch',e=>e.provenance.submitted_run_count=28],
  ['reading count mismatch',e=>e.source.sample_reads[0].n=28],
  ['empty count',e=>e.source.source_groups[0].submitted_runs=0],
  ['fractional count',e=>e.source.source_groups[0].submitted_runs=27.5],
  ['missing median',e=>e.source.source_groups[0].median_score=null],
  ['textual median',e=>e.source.source_groups[0].median_score='62'],
  ['nonfinite median',e=>e.source.source_groups[0].median_score=Infinity],
  ['off-scale median',e=>e.source.source_groups[0].median_score=101],
  ['reversed quartiles',e=>e.source.source_groups[0].score_iqr=[66,58]],
  ['missing quartiles',e=>delete e.source.source_groups[0].score_iqr],
  ['missing range',e=>e.source.source_groups[0].score_range=[54]],
  ['reversed range',e=>e.source.source_groups[0].score_range=[71,54]],
  ['quartile beyond range',e=>e.source.source_groups[0].score_iqr=[50,66]],
  ['median beyond quartiles',e=>e.source.source_groups[0].median_score=70],
];
for(const [name,mutate]of mutations){const entry=fixture();mutate(entry);seal(entry);assert.throws(()=>depthPreviewEvidence(entry),{name:'AssertionError'},name);checks++;}
const changed=fixture();changed.source.source_groups[0].median_score=63;
assert.throws(()=>depthPreviewEvidence(changed),/reviewed projection/);checks++;
const preview=fs.readFileSync(new URL('./refresh_public_sample_previews.mjs',import.meta.url),'utf8');
const screen=fs.readFileSync(new URL('./report_screen_experience_smoke.mjs',import.meta.url),'utf8');
assert.match(preview,/const \{artifact\}=readPublicSampleFixture\(\{root\}\)/);
assert.doesNotMatch(preview,/reason\.match|variation in submitted scores:/);checks++;
assert.match(screen,/import \{readPublicSampleFixture\} from '\.\/public_sample_fixture\.mjs'/);
assert.match(screen,/const \{artifact\}=readPublicSampleFixture\(\)/);
assert.doesNotMatch(screen,/monderman-public-product-samples\/v2/);checks++;
console.log(JSON.stringify({passed:true,checks,distributionLabels:Object.keys(expected).length,mutationsRejected:mutations.length+1,
  networkCalls:0,providerCalls:0,artifactWrites:0,publicationApprovalClaimed:false,
  limitation:'Synthetic extraction/guard checks. The actual approved v3 public artifact and browser/print release remain separate gates.'}));
