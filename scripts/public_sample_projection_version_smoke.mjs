// Browser contract shape test only. No real output, release approval or artifact
// is created by these deliberately fabricated in-memory rows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {assertPublicSampleProjection,evidenceDigest} from './public_sample_fixture.mjs';
import {sourceBeforePublicSampleProjection20260924,PROJECTION_MODEL_BEFORE_SHA256,sourceBeforePublicSampleProjectionCache20260924,PROJECTION_CACHE_FILES,projectionCacheDelta} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforeHomepageCompactJourney20260924,homepageCompactDelta,HOMEPAGE_COMPACT_FIXTURE_SHA256} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicCopyClarity,PUBLIC_COPY_FIXTURE_SHA256} from './public_copy_clarity_inverse.mjs';
import {reportLibraryDelta,REPORT_LIBRARY_FIXTURE_SHA256} from './report_library_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
const source=fs.readFileSync(new URL('../public-sample-model.js',import.meta.url),'utf8');
const scope={window:{}};vm.runInNewContext(source,scope);
const adapter=scope.window.MondermanPublicSamples;
const version='monderman-public-sample-projection-20260913.7';
const currentVersion='monderman-public-sample-projection-20260924.8';
const hash='a'.repeat(64),commit='b'.repeat(40),date='2026-09-12T18:00:00.000Z';
const artifact={contract:'monderman-public-product-samples/v3',synthetic:true,artifact_sha256:hash,
  publication_projection:{version,source_sha256:hash,projection_commit:commit},outputs:{}};
for(const key of Object.values(adapter.products)){
  const synthesis=key.endsWith('_synthesis');
  artifact.outputs[key]={kind:synthesis?'synthesis':'diagnostic',source:{[synthesis?'synthesis_product':'tool_type']:key,
    ai_report:{status:'complete',report:{model:'MOCK-not-provider-evidence',version:'MOCK-release',prompt_version:'MOCK-prompt',generated_at:date,interpretation:{summary:'MOCK contract shape only.'}}}},
    provenance:{synthetic:true,generated_at:date,engine_commit:commit,report_ai_release:'MOCK-release',report_ai_prompt_version:'MOCK-prompt',input_sha256:hash,result_sha256:hash,approved_output_sha256:hash}};
}
assert.equal(adapter.validate(artifact),artifact);let checks=1;
for(const bad of [undefined,null,'','monderman-public-sample-projection-20260911.4','monderman-public-sample-projection-20260912.6',version+'-modified',currentVersion+'-modified']){
  const copy=structuredClone(artifact);copy.publication_projection.version=bad;
  assert.throws(()=>adapter.validate(copy),/Sample publication version/);checks++;
}
const current=structuredClone(artifact);current.engine_commit=commit;current.publication_projection.version=currentVersion;
const beforeCurrent=JSON.stringify(current);
assert.equal(adapter.validate(current),current);checks++;
assert.equal(JSON.stringify(current),beforeCurrent);checks++;
for(const [candidate,newPublication]of [[artifact,false],[current,true]]){
  const manifest={publication_projection:structuredClone(candidate.publication_projection),...(newPublication?{response_comparison_publication_review:{status:'MOCK-NOT-APPROVAL'}}:{})};
  const frozen=JSON.stringify({candidate,manifest});
  assert.doesNotThrow(()=>assertPublicSampleProjection(candidate,manifest));checks++;
  assert.equal(JSON.stringify({candidate,manifest}),frozen);checks++;
  for(const mutate of [p=>{delete p.version;},p=>{p.version='unrecognized';},p=>{p.source_sha256='bad';},p=>{p.projection_commit='bad';},p=>{p.private_metadata='not permitted';},p=>{delete p.source_sha256;}]){
    const copy=structuredClone(candidate);mutate(copy.publication_projection);
    assert.throws(()=>adapter.validate(copy),/Sample publication version/);checks++;
    assert.throws(()=>assertPublicSampleProjection(copy,manifest));checks++;
  }
  const mismatched=structuredClone(manifest);mismatched.publication_projection.source_sha256='c'.repeat(64);
  assert.throws(()=>assertPublicSampleProjection(candidate,mismatched),/differs from reviewed export/);checks++;
  const otherRoute={...manifest};if(newPublication)delete otherRoute.response_comparison_publication_review;else otherRoute.response_comparison_publication_review={};
  assert.throws(()=>assertPublicSampleProjection(candidate,otherRoute));checks++;
}
for(const value of [undefined,'c'.repeat(40)]){
  const copy=structuredClone(current);copy.engine_commit=value;
  assert.throws(()=>adapter.validate(copy),/differs from generation/);checks++;
  assert.throws(()=>assertPublicSampleProjection(copy,{publication_projection:copy.publication_projection,response_comparison_publication_review:{}}),/differs from comparison generation/);checks++;
}
for(const key of Object.values(adapter.products)){
  const copy=structuredClone(artifact);copy.outputs[key].source.ai_report.status='pending';
  assert.throws(()=>adapter.validate(copy),/Reviewed sample interpretation/);checks++;
}
const fixture=fs.readFileSync(new URL('./public_sample_fixture.mjs',import.meta.url),'utf8');
assert.ok(fixture.includes('assertPublicSampleProjection(artifact,manifest);'));checks++;
assert.ok(fixture.includes("assert.equal(manifest.fidelity_review,'passed'"));checks++;
assert.ok(fixture.includes("sha(artifactBytes),manifest.artifact_file_sha256"));checks++;
const sha=value=>createHash('sha256').update(value).digest('hex');
const restored=sourceBeforePublicSampleProjection20260924('public-sample-model.js',source);
assert.equal(sha(restored),PROJECTION_MODEL_BEFORE_SHA256);checks++;
assert.equal(sha(restored),reportLibraryDelta.files['public-sample-model.js'].after_sha256);checks++;
assert.doesNotThrow(()=>sourceBeforePublicCopyClarity('public-sample-model.js',source));checks++;
for(const changed of [source+'\n',source.replace(currentVersion,currentVersion+'-modified'),source.replace('function model(', 'function mutatedModel('),restored]){
  assert.throws(()=>sourceBeforePublicSampleProjection20260924('public-sample-model.js',changed),/only the exact reviewed current source/);checks++;
}
const unrelated=Buffer.from('unchanged');assert.equal(sourceBeforePublicSampleProjection20260924('unrelated.js',unrelated),unrelated);checks++;
assert.deepEqual(PROJECTION_CACHE_FILES,['sample-report.html','scripts/inject-public-shell.mjs']);checks++;
for(const file of PROJECTION_CACHE_FILES){
  const raw=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),current=sourceBeforeHomepageReportQuad20260925(file,raw),entry=projectionCacheDelta[file];
  assert.equal(sha(current),entry.after_sha256);checks++;
  const prior=sourceBeforePublicSampleProjectionCache20260924(file,current);
  assert.equal(sha(prior),entry.before_sha256);checks++;
  assert.equal(current,prior.replace(entry.prior,entry.current),'Only the single public model cache reference changed');checks++;
  for(const mutation of [current+'\n',current.replace('20260924.projection8','20260924.projection8-mutated'),current.replace(/./,'!'),prior]){
    assert.throws(()=>sourceBeforePublicSampleProjectionCache20260924(file,mutation),/only the exact reviewed current source/);checks++;
  }
  assert.doesNotThrow(()=>sourceBeforePublicCopyClarity(file,raw));checks++;
  if(file==='scripts/inject-public-shell.mjs'){
    assert.equal(sha(prior),homepageCompactDelta.files[file].after_sha256);checks++;
    assert.throws(()=>sourceBeforeHomepageCompactJourney20260924(file,current),/only the exact reviewed compact-homepage source/);checks++;
    assert.equal(sha(sourceBeforeHomepageCompactJourney20260924(file,prior)),homepageCompactDelta.files[file].before_sha256);checks++;
  }
}
for(const file of ['public-sample-model.js','privacy.html','__proto__']){assert.equal(sourceBeforePublicSampleProjectionCache20260924(file,unrelated),unrelated);checks++;}
assert.equal(sha(fs.readFileSync(new URL('./fixtures/homepage-compact-journey-20260924.json',import.meta.url))),HOMEPAGE_COMPACT_FIXTURE_SHA256,'Earlier homepage fixture remains exact');checks++;
for(const [name,digest]of [['public-copy-clarity-20260924.json',PUBLIC_COPY_FIXTURE_SHA256],['report-library-presentation-20260924.json',REPORT_LIBRARY_FIXTURE_SHA256]]){
  assert.equal(sha(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))),digest);checks++;
}
// Pin only preserved historical fields: a future independently reviewed release
// may add a current comparison receipt, never rewrite these earlier approvals.
const historicalRelease=JSON.parse(fs.readFileSync(new URL('../sample-data/production-sample-release.json',import.meta.url)));
const historicalFields=['contract','site_commit','compact_preview_presentation_review','mobile_breakdown_presentation_review','detailed_sankey_presentation_review','planning_case_presentation_review','sankey_presentation_review','organization_scope_copy_review','homepage_descriptor_review','renderer_presentation_review','financial_presentation_review','renderer_metadata_compatibility','publication_acceptance','private_assembly','visual_evidence','customer_publication_update','financial_publication_update','benefit_flow_presentation_review','benefit_flow_presentation_review_history','report_overview_presentation_review'];
const historical=Object.fromEntries(historicalFields.map(key=>[key,historicalRelease[key]]));
assert.equal(evidenceDigest(historical),'f4d88f17c0019eadad96f8e2b1bc9cf50cb0ec0fe6eba231cb37bb15fd4b0fd6','Historical release approval fields were not repinned');checks++;
const changedHistory=structuredClone(historical);changedHistory.report_overview_presentation_review.renderer_sha256='0'.repeat(64);
assert.notEqual(evidenceDigest(changedHistory),evidenceDigest(historical));checks++;
console.log(JSON.stringify({passed:true,checks,products:6,versions:[version,currentVersion],historicalPinsUnchanged:true,networkCalls:0,providerCalls:0,publicationApprovalClaimed:false}));
