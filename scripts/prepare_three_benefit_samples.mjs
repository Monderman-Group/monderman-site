// Financial-only re-edition of reviewed examples. No provider calls, customer
// data, production writes or publication approval. Review the candidate first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const SITE=path.resolve(import.meta.dirname,'..');
const BASE='b06b72083442f03f7a1e2cadeb5239e4f0449515';
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>sha(JSON.stringify(canonical(v)));
const encode=v=>JSON.stringify(v,null,2)+'\n';
const readBase=name=>execFileSync('git',['show',BASE+':'+name],{cwd:SITE,maxBuffer:8*1024*1024});
export async function prepare({apiRoot,output,now=new Date().toISOString()}){
  assert.ok(apiRoot&&output);assert.ok(Number.isFinite(Date.parse(now)));
  const original=readBase('sample-data/production-diagnostic-samples.json'),oldManifest=readBase('sample-data/production-sample-release.json');
  const prior=JSON.parse(original),manifest=JSON.parse(oldManifest),artifact=structuredClone(prior);
  assert.equal(sha(original),manifest.artifact_file_sha256);assert.equal(manifest.fidelity_review,'passed');
  const {calculateFinancialPlanningScenario}=await import(pathToFileURL(path.join(apiRoot,'financial-planning-scenario.js')));
  const {buildFinancialBenefitAssessment}=await import(pathToFileURL(path.join(apiRoot,'financial-planning-scenario-v2.js')));
  const {buildThreeBenefitSampleInput}=await import(pathToFileURL(path.join(apiRoot,'certification/three-benefit-samples.mjs')));
  const {publicFinancialScenario,publicFinancialBenefitAssessment}=await import(pathToFileURL(path.join(apiRoot,'certification/public-sample-projection.mjs')));
  const calculations={},proofs=[];
  const sourceFiles=['financial-planning-scenario.js','financial-planning-scenario-v2.js','certification/three-benefit-samples.mjs','certification/public-sample-projection.mjs'];
  const sourcePins=Object.fromEntries(sourceFiles.map(name=>[name,sha(fs.readFileSync(path.join(apiRoot,name)))]));
  for(const [key,entry]of Object.entries(artifact.outputs)){
    if(!key.endsWith('_synthesis')){assert.deepEqual(entry,prior.outputs[key]);continue;}
    const source=entry.source,old=prior.outputs[key].source,scenario=old.financial_scenario;
    assert.equal(scenario.version,'operational-planning-scenario-20260913.1');
    const input=buildThreeBenefitSampleInput({measurementStart:scenario.inputs.measurementStart,measurementEnd:scenario.inputs.measurementEnd,subscriptionCost:scenario.inputs.subscriptionCost});
    input.costBasis=scenario.inputs.costBasis;
    const id=scenario.scope.scopeId,organizationId='synthetic-three-benefit-example',identity=digest({key,base:BASE,input});
    const scope={id,organizationId,label:scenario.scope.label,population:{size:entry.provenance.declared_eligible_population},window:{start:input.capacity.measurementStart,end:input.capacity.measurementEnd},lenses:Object.fromEntries(source.source_groups.map(g=>[g.tool_type,{}]))};
    const readiness={...structuredClone(source.campaign_evidence),scopeId:id,scope:{organizationId},scopeDigest:identity,evidenceDigest:identity};
    const context={scope,readiness,snapshot:identity,actorId:'synthetic-three-benefit-editor',createdAt:now};
    const calculated=calculateFinancialPlanningScenario(input,context),assessment=buildFinancialBenefitAssessment(calculated,context);
    assert.equal(calculated.coverage.complete,true);
    for(const c of ['spendingReduction','spendingAvoidance','staffCapacity'])for(const k of ['low','central','high'])assert.ok(calculated.benefits[c].amount[k]>0);
    source.financial_scenario=publicFinancialScenario(calculated,readiness,id);
    source.financial_benefit_assessment=publicFinancialBenefitAssessment(assessment,id);
    const rest=structuredClone(source),baseline=structuredClone(old);
    delete rest.financial_scenario;delete rest.financial_benefit_assessment;delete baseline.financial_scenario;
    assert.deepEqual(rest,baseline,'Only the financial attachment and its assessment may change');
    const financialRevision={version:'three-benefit-sample-revision-20260919.1',created_at:now,original_public_source_sha256:prior.outputs[key].provenance.public_source_sha256,
      original_financial_scenario_sha256:digest(scenario),input_sha256:digest(input),calculator_result_sha256:calculated.digest,
      public_financial_scenario_sha256:digest(source.financial_scenario),public_financial_assessment_sha256:digest(source.financial_benefit_assessment),
      unchanged_nonfinancial_source_sha256:digest(baseline),source_files:sourcePins,
      note:'New illustrative operating inputs calculated deterministically. Original diagnostic evidence, AI interpretation and generation approvals are unchanged; those original approvals do not cover this financial revision.'};
    entry.provenance.financial_revision=financialRevision;
    entry.provenance.public_source_sha256=digest(entry.source);
    manifest.outputs[key].provenance=structuredClone(entry.provenance);
    calculations[key]={synthetic:true,notCustomerOperatingEvidence:true,context,calculated,assessment};
    proofs.push({key,...financialRevision,totals:calculated.totals,coverage:calculated.coverage});
  }
  artifact.financial_publication_update={version:'three-benefit-sample-revision-20260919.1',updated_at:now,original_artifact_file_sha256:sha(original),source_files:sourcePins,
    scope:'Financial attachments only. Existing diagnostic and AI generation identities remain historical. No new model generation.'};
  delete artifact.artifact_sha256;artifact.artifact_sha256=digest(artifact);
  manifest.artifact_sha256=artifact.artifact_sha256;manifest.artifact_file_sha256=sha(encode(artifact));
  manifest.financial_publication_update={...artifact.financial_publication_update,status:'pending_calculation_and_visual_review',original_manifest_sha256:sha(oldManifest)};
  for(const name of Object.keys(manifest.source_files))manifest.source_files[name]=sha(fs.readFileSync(path.join(SITE,name)));
  const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
  for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInNewContext(fs.readFileSync(path.join(SITE,file),'utf8'),context,{filename:file});
  context.window.MondermanPublicSamples.validate(artifact);
  const directory=path.resolve(output);assert.ok(!fs.existsSync(directory),'Preserve prior preparation');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const write=(name,value)=>fs.writeFileSync(path.join(directory,name),value,{flag:'wx',mode:0o600});
  write('ORIGINAL-public-samples.json',original);write('ORIGINAL-public-release.json',oldManifest);
  write('production-diagnostic-samples.json',encode(artifact));write('production-sample-release.json',encode(manifest));write('PRIVATE-recalculations.json',encode(calculations));
  for(const [key,entry]of Object.entries(artifact.outputs))write(key+'.html',context.window.MondermanReport.buildReportHtml(context.window.MondermanPublicSamples.model(entry,artifact)));
  const proof={status:'prepared_not_approved',baseSiteCommit:BASE,providerCalls:0,productionWrites:0,sourcePins,proofs};
  write('PREPARATION.json',encode(proof));return {directory,artifact_sha256:artifact.artifact_sha256,proof};
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){const [apiRoot,output]=process.argv.slice(2);console.log(JSON.stringify(await prepare({apiRoot,output})));}
