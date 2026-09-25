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
const individualEntries={};
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
  if(!synthesis){
    // Preserve the old individual/wrapped-result adapter checks separately;
    // the four current public lens entries exercise fromSynthesis comparisons.
    individualEntries[key]=structuredClone(artifact.outputs[key]);
    artifact.outputs[key]={kind:'response_comparison',source:{
      report_kind:'response_comparison',synthesis_product:'depth_synthesis',synthesis_mode:'depth',generated_at:created,
      aggregate_score:50,score_status:'published',score_type:'within_lens_median',score_label:'Median Diagnostic Score',
      participant_count:15,submitted_run_count:15,recommended_path_available:false,campaign_action_options:[],
      source_groups:[{tool_type:key,tool_label:key.replaceAll('_',' '),participants:15,submitted_runs:15,median_score:50,mean_score:50,score_iqr:[45,55],score_range:[40,60],
        participant_mode_counts:{operational:5,managerial:5,senior_leader:5}}],
      campaign_evidence:{privacyPolicy:{minimumDisplayedGroupSize:5},
        depth:{status:'in_progress',lenses:[{lens:key,status:'in_progress',descriptiveReadAvailable:true,
          requiredGroups:['operational','managerial','senior'].map(id=>({id,participants:5,population:10,status:'in_progress',
            privacy:{minimumDisplayedGroupSize:5,mayDisplayGroupStatistics:true}}))}]},
        recommendedPath:{status:'in_progress'},crossLens:{status:'in_progress'}},
      // This provenance-only mock intentionally has no selected notes or
      // financial estimates; full generated-content coverage is separate.
      experiential_records:[],experiential_selection:{available:15,incorporated:0,method:'bounded_role_and_lens_rotation',exhaustive:false},
      pathway_exposure:{status:'withheld',priceable:false},compounded_exposure:{status:'withheld',priceable:false},
      financial_benefit_assessment:{coverage:{complete:false,estimatedCategories:[]},
        categories:Object.fromEntries(['spendingReduction','spendingAvoidance','staffCapacity'].map(category=>[category,{status:'not_estimated'}]))},
      ai_report:{status:'complete',report}},
      provenance:{...artifact.outputs[key].provenance,sample_lens:key,distinct_included_participants:15,declared_eligible_population:30,operating_review_source:'not_supplied'}};
  }
}
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
freeze(artifact);freeze(individualEntries);const before=JSON.stringify(artifact);let checks=0;const ok=fn=>{fn();checks++;};
ok(()=>assert.equal(Report.rendererVersion,'diagnostic-renderer-report-overview-20260924.1'));
ok(()=>assert.equal(Public.validate(artifact),artifact)); // shape only, not a release/approval validator
for(const [key,entry]of [...Object.entries(artifact.outputs),...Object.entries(individualEntries)]){
  const p=entry.provenance,report=publicResult(entry).ai_report.report;
  ok(()=>assert.equal(assertPublicSampleGenerationProvenance(entry,key),entry));
  const model=Public.model(entry,artifact);
  ok(()=>assert.equal(model.sampleProvenance.engine_commit,key.endsWith('_synthesis')?synthesisCommit:ordinaryCommit));
  ok(()=>assert.equal(model.kind,entry.kind==='diagnostic'?'run':'meta-synthesis'));
  if(entry.kind==='response_comparison')ok(()=>assert.equal(model.comparisonOnly,true));
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
  ok(()=>assert.equal(html.includes(p.engine_commit),entry.kind==='diagnostic','Individual Method retains original revision; aggregate covers stay readable'));
  const changedAssembly={...artifact,engine_commit:'5'.repeat(40)};
  ok(()=>assert.equal(Public.model(entry,changedAssembly).sampleProvenance.engine_commit,p.engine_commit));
  if(entry.kind==='diagnostic'){
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
// Execute the real sample-page wire/mount and JSON click handlers against small
// DOM stubs. This is not a browser/layout pass or a publication-approved fixture.
const pageSource=fs.readFileSync(new URL('../sample-report-production.js',import.meta.url),'utf8');
const seam='window.MondermanSampleReportShell = { mount: mountReport };';
ok(()=>assert.equal(pageSource.split(seam).length-1,1));
scope.document={readyState:'loading',addEventListener(){}};
const nativeMethods={render:Report.render,downloadJson:Report.downloadJson,downloadHtml:Report.downloadHtml,downloadPdf:Report.downloadPdf};
const dispatched=[];
Report.render=()=>{};
for(const name of ['downloadJson','downloadHtml','downloadPdf'])Report[name]=(...args)=>dispatched.push({name,args});
vm.runInContext(pageSource.replace(seam,seam+'\nwindow.__mixedOriginTest={wireReport,reportGenerationCommit};'),scope,{filename:'sample-report-production.js'});
const wire=scope.window.__mixedOriginTest.wireReport,resolveCommit=scope.window.__mixedOriginTest.reportGenerationCommit;
function shellStub(){
 const nodes=new Map();
 const node=()=>({events:{},addEventListener(name,fn){this.events[name]=fn;},querySelectorAll(){return [];}});
 for(const selector of ['.psr-engine-stage','.psr-toc ol','.psr-toc-mobile select','.psr-toc','[data-action="read"]','[data-action="html"]','[data-action="json"]','[data-action="print"]'])nodes.set(selector,node());
 return {innerHTML:'',nodes,querySelector(selector){assert.ok(nodes.has(selector),'Unexpected DOM dependency: '+selector);return nodes.get(selector);}};
}
for(const [key,entry]of [...Object.entries(artifact.outputs),...Object.entries(individualEntries)]){
 const p=entry.provenance,shell=shellStub(),previous=JSON.stringify(entry);
 wire(shell,entry,artifact,key);
 ok(()=>assert.ok(shell.innerHTML.includes('data-engine-commit="'+p.engine_commit+'"')));
 ok(()=>assert.ok(shell.innerHTML.includes(' · API '+p.engine_commit.slice(0,8))));
 ok(()=>assert.ok(!shell.innerHTML.includes(assemblyCommit)));
 ok(()=>assert.ok(!shell.innerHTML.includes(' · API '+assemblyCommit.slice(0,8))));
 ok(()=>assert.ok(shell.innerHTML.includes('data-artifact-sha256="'+artifact.artifact_sha256+'"')));
 shell.nodes.get('[data-action="json"]').events.click();
 const exported=dispatched.at(-1);ok(()=>assert.equal(exported.name,'downloadJson'));
 ok(()=>assert.equal(exported.args[0].export_payload.sample_provenance.engine_commit,p.engine_commit));
 ok(()=>assert.equal(exported.args[0].export_payload.sample_provenance.report_ai_release,p.report_ai_release));
 ok(()=>assert.equal(exported.args[0].export_payload.sample_provenance.report_ai_prompt_version,p.report_ai_prompt_version));
 ok(()=>assert.equal(exported.args[0].export_payload.sample_provenance.generated_at,p.generated_at));
 const exportedSource={...exported.args[0].export_payload};delete exportedSource.sample_provenance;
 ok(()=>assert.equal(JSON.stringify(exportedSource),JSON.stringify(entry.source),'Authored source is exported unchanged'));
 shell.nodes.get('[data-action="html"]').events.click();
 ok(()=>assert.equal(dispatched.at(-1).args[0].sampleProvenance.engine_commit,p.engine_commit));
 shell.nodes.get('[data-action="print"]').events.click();
 ok(()=>assert.equal(dispatched.at(-1).args[0].sampleProvenance.engine_commit,p.engine_commit));
 ok(()=>assert.equal(JSON.stringify(entry),previous));
 for(const value of [undefined,null,'','x'.repeat(40),'1'.repeat(39),'1'.repeat(41)]){
  const invalid=structuredClone(entry);if(value===undefined)delete invalid.provenance.engine_commit;else invalid.provenance.engine_commit=value;
  const rejected=shellStub();
  ok(()=>assert.throws(()=>wire(rejected,invalid,artifact,key),/generation revision/));
  ok(()=>assert.equal(rejected.innerHTML,'','Invalid explicit revision cannot mount or export'));
 }
}
const legacyEntry=structuredClone(artifact.outputs.operational_systems);delete legacyEntry.provenance.engine_commit;
const legacy={...artifact,contract:'monderman-public-product-samples/v2'};
ok(()=>assert.equal(resolveCommit(legacyEntry,legacy),assemblyCommit,'Only absent legacy v2 provenance may use the old global identity'));
for(const value of [null,'','bad'])ok(()=>assert.throws(()=>resolveCommit({...legacyEntry,provenance:{...legacyEntry.provenance,engine_commit:value}},legacy),/generation revision/));
ok(()=>assert.throws(()=>resolveCommit(legacyEntry,{...legacy,engine_commit:'bad'}),/generation revision/));
ok(()=>assert.throws(()=>resolveCommit(legacyEntry,{...legacy,contract:'unknown'}),/generation revision/));
ok(()=>assert.throws(()=>Public.validate(legacy),/contract/,'Legacy helper fallback never widens current public-library admission'));
Object.assign(Report,nativeMethods);
ok(()=>assert.equal(JSON.stringify(artifact),before));
ok(()=>assert.equal(fs.readFileSync(new URL('../sample-report-production.js',import.meta.url),'utf8'),pageSource));
// Current publication tests must validate the actual reviewed release before
// rendering, and compare entry generation rather than assembly provenance.
// This is source wiring coverage only, not a six-report publication pass.
for(const file of ['report_presentation_smoke.mjs','sample_product_fidelity_smoke_v2.mjs']){
  const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
  ok(()=>assert.match(source,/import \{readPublicSampleFixture,publicResult\} from '\.\/public_sample_fixture\.mjs'/));
  ok(()=>assert.match(source,/const \{artifact\}=readPublicSampleFixture\(\)/));
  ok(()=>assert.match(source,/provenance\.engine_commit/));
  ok(()=>assert.doesNotMatch(source,/getAttribute\('data-engine-commit'\)\s*===\s*artifact\.engine_commit/));
  ok(()=>assert.doesNotMatch(source,/JSON\.parse\(fs\.readFileSync[^\n]*production-diagnostic-samples\.json/));
}
console.log(JSON.stringify({status:'PASS',checks,products:6,responseComparisons:4,separateIndividualFixtures:4,mixedGenerationCommits:2,renderer:Report.rendererVersion,publicationApprovalClaimed:false,providerCalls:0,artifactsWritten:0}));
