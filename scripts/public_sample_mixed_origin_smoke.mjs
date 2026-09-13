// Explicitly MOCK, unapproved in-memory adapter checks. No release manifest,
// published artifact, provider verdict, source39 approval or PDF is fabricated.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {assertPublicSampleGenerationProvenance,publicResult} from './public_sample_fixture.mjs';
const root=new URL('../',import.meta.url),scope={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.createContext(scope);
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),scope,{filename:file});
const Public=scope.window.MondermanPublicSamples,Report=scope.window.MondermanReport;
const hash='a'.repeat(64),ordinaryCommit='1'.repeat(40),synthesisCommit='2'.repeat(40),assemblyCommit='3'.repeat(40);
const keys=Object.values(Public.products),artifact={contract:Public.contract,synthetic:true,status:'MOCK-unapproved-not-for-publication',engine_commit:assemblyCommit,artifact_sha256:hash,
  publication_projection:{version:'monderman-public-sample-projection-20260913.7',source_sha256:hash,projection_commit:'4'.repeat(40)},outputs:{}};
for(const [i,key]of keys.entries()){
  const synthesis=key.endsWith('_synthesis'),generation=synthesis?synthesisCommit:ordinaryCommit,version=synthesis?'MOCK-release39':'MOCK-release38',prompt=synthesis?'MOCK-prompt39':'MOCK-prompt38';
  const created=`2026-09-13T0${i}:00:00.000Z`,prepared=`2026-09-13T0${i}:01:00.000Z`;
  const report={model:'MOCK-not-provider-evidence',version,prompt_version:prompt,generated_at:prepared,snapshot_id:hash,
    composition:{authorship:'provider_authored_engine_bounded'},sources:[],evidence:[],evidence_references:{summary:[],summary_sources:[]},
    interpretation:{summary:'MOCK display-only prose; no actual review or publication approval.',observations:[],hypotheses:[],recommendations:[],action_options:[],recommended_option:null}};
  artifact.outputs[key]={kind:synthesis?'synthesis':'diagnostic',source:{tool_type:key,...(synthesis?{synthesis_product:key}:{}),score:50,dimensions:{example:50},created_at:created,
    questionnaire_version:'MOCK-questionnaire',scorer_version:'MOCK-scorer',ai_report:{status:'complete',report}},
    provenance:{synthetic:true,engine_commit:generation,generated_at:created,report_ai_release:version,report_ai_prompt_version:prompt,
      input_sha256:hash,result_sha256:hash,approved_output_sha256:hash,report_language_version:'MOCK-language'}};
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
freeze(artifact);const before=JSON.stringify(artifact);let checks=0;const ok=fn=>{fn();checks++;};
ok(()=>assert.equal(Report.rendererVersion,'diagnostic-renderer-evidence-reading-20260913.36'));
ok(()=>assert.equal(Public.validate(artifact),artifact)); // shape only, not a release/approval validator
for(const [i,key]of keys.entries()){
  const entry=artifact.outputs[key],p=entry.provenance,report=publicResult(entry).ai_report.report;
  ok(()=>assert.equal(assertPublicSampleGenerationProvenance(entry,key),entry));
  const model=Public.model(entry,artifact);
  ok(()=>assert.equal(model.sampleProvenance.engine_commit,i<4?ordinaryCommit:synthesisCommit));
  ok(()=>assert.notEqual(model.sampleProvenance.engine_commit,assemblyCommit));
  ok(()=>assert.equal(model.provenance.engine_commit,p.engine_commit));
  ok(()=>assert.equal(model.meta.some(row=>row.label==='Engine revision'),false,'No technical revision row on cover'));
  ok(()=>assert.equal(model.sampleProvenance.generated_at,p.generated_at));
  ok(()=>assert.equal(model.sampleProvenance.report_ai_release,report.version));
  ok(()=>assert.equal(model.sampleProvenance.report_ai_prompt_version,report.prompt_version));
  ok(()=>assert.equal(model.aiReport.report.generated_at,report.generated_at));
  ok(()=>assert.equal(JSON.stringify(model.aiReport),JSON.stringify(publicResult(entry).ai_report)));
  const html=Report.buildReportHtml(model);
  ok(()=>assert.ok(!html.includes(assemblyCommit),'assembly commit must never be presented as original generation'));
  ok(()=>assert.equal(html.includes(p.engine_commit),i<4,'Ordinary Method retains original revision; synthesis cover stays readable'));
  const changedAssembly={...artifact,engine_commit:'5'.repeat(40)};
  ok(()=>assert.equal(Public.model(entry,changedAssembly).sampleProvenance.engine_commit,p.engine_commit));
  if(i<4){
    const wrapped={...structuredClone(entry),source:{result:{...structuredClone(entry.source),provenance:{engine_commit:assemblyCommit}}}};
    const wrappedBefore=JSON.stringify(wrapped),wrappedModel=Public.model(wrapped,artifact);
    ok(()=>assert.equal(assertPublicSampleGenerationProvenance(wrapped,key),wrapped));
    ok(()=>assert.equal(wrappedModel.provenance.engine_commit,p.engine_commit));
    ok(()=>assert.ok(!Report.buildReportHtml(wrappedModel).includes(assemblyCommit)));
    ok(()=>assert.equal(JSON.stringify(wrapped),wrappedBefore));
  }
  for(const value of [undefined,null,'','x'.repeat(40),'1'.repeat(39),'1'.repeat(41)]){
    const mutant=structuredClone(entry);if(value===undefined)delete mutant.provenance.engine_commit;else mutant.provenance.engine_commit=value;
    ok(()=>assert.throws(()=>assertPublicSampleGenerationProvenance(mutant,key),/generation commit/));
    ok(()=>assert.throws(()=>Public.model(mutant,artifact),/generation commit/));
    ok(()=>assert.throws(()=>Public.validate({...artifact,outputs:{...artifact.outputs,[key]:mutant}}),/generation commit/));
  }
  for(const field of ['report_ai_release','report_ai_prompt_version'])for(const value of [undefined,'MOCK-other-source']){
    const mutant=structuredClone(entry);if(value===undefined)delete mutant.provenance[field];else mutant.provenance[field]=value;
    ok(()=>assert.throws(()=>assertPublicSampleGenerationProvenance(mutant,key),/provenance mismatch/));
    ok(()=>assert.throws(()=>Public.model(mutant,artifact),/provenance differs/));
    ok(()=>assert.throws(()=>Public.validate({...artifact,outputs:{...artifact.outputs,[key]:mutant}}),/provenance differs/));
  }
}
ok(()=>assert.equal(JSON.stringify(artifact),before));
ok(()=>assert.equal(artifact.status,'MOCK-unapproved-not-for-publication'));
const fixtureSource=fs.readFileSync(new URL('./public_sample_fixture.mjs',import.meta.url),'utf8');
ok(()=>assert.ok(fixtureSource.includes("assert.equal(manifest.fidelity_review,'passed'")));
ok(()=>assert.ok(fixtureSource.includes("sha(artifactBytes),manifest.artifact_file_sha256")));
console.log(JSON.stringify({status:'PASS',checks,products:6,mixedGenerationCommits:2,renderer:Report.rendererVersion,publicationApprovalClaimed:false,providerCalls:0,artifactsWritten:0}));
