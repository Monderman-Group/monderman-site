// Browser contract shape test only. No real output, release approval or artifact
// is created by these deliberately fabricated in-memory rows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public-sample-model.js',import.meta.url),'utf8');
const scope={window:{}};vm.runInNewContext(source,scope);
const adapter=scope.window.MondermanPublicSamples;
const version='monderman-public-sample-projection-20260912.6';
const hash='a'.repeat(64),commit='b'.repeat(40),date='2026-09-12T18:00:00.000Z';
const artifact={contract:'monderman-public-product-samples/v3',synthetic:true,artifact_sha256:hash,
  publication_projection:{version,source_sha256:hash,projection_commit:commit},outputs:{}};
for(const key of Object.values(adapter.products)){
  const synthesis=key.endsWith('_synthesis');
  artifact.outputs[key]={kind:synthesis?'synthesis':'diagnostic',source:{[synthesis?'synthesis_product':'tool_type']:key,
    ai_report:{status:'complete',report:{model:'MOCK-not-provider-evidence',generated_at:date,interpretation:{summary:'MOCK contract shape only.'}}}},
    provenance:{synthetic:true,generated_at:date,input_sha256:hash,result_sha256:hash,approved_output_sha256:hash}};
}
assert.equal(adapter.validate(artifact),artifact);let checks=1;
for(const bad of [undefined,null,'','monderman-public-sample-projection-20260911.4',version+'-modified']){
  const copy=structuredClone(artifact);copy.publication_projection.version=bad;
  assert.throws(()=>adapter.validate(copy),/Sample publication version/);checks++;
}
for(const key of Object.values(adapter.products)){
  const copy=structuredClone(artifact);copy.outputs[key].source.ai_report.status='pending';
  assert.throws(()=>adapter.validate(copy),/Reviewed sample interpretation/);checks++;
}
const fixture=fs.readFileSync(new URL('./public_sample_fixture.mjs',import.meta.url),'utf8');
assert.ok(fixture.includes("assert.equal(artifact.publication_projection?.version,'"+version+"')"));checks++;
assert.ok(fixture.includes("assert.equal(manifest.fidelity_review,'passed'"));checks++;
assert.ok(fixture.includes("sha(artifactBytes),manifest.artifact_file_sha256"));checks++;
console.log(JSON.stringify({passed:true,checks,products:6,version,networkCalls:0,providerCalls:0,publicationApprovalClaimed:false}));
