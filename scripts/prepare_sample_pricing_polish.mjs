// Offline, display-only derivative of the six previously reviewed examples.
// Never generates AI or approves publication. The output needs root review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const SITE=path.resolve(import.meta.dirname,'..');
const BASE='6b458f80ddcdb138ac04e5dca163902c1f4c08be';
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>sha(JSON.stringify(canonical(v)));
const encoded=v=>JSON.stringify(v,null,2)+'\n';
const readBase=name=>execFileSync('git',['show',BASE+':'+name],{cwd:SITE,maxBuffer:8*1024*1024});
export async function prepare({apiRoot,output,now=new Date().toISOString()}){
  assert.ok(apiRoot&&output);assert.ok(Number.isFinite(Date.parse(now)));
  const original=readBase('sample-data/production-diagnostic-samples.json'),oldManifest=readBase('sample-data/production-sample-release.json');
  const prior=JSON.parse(original),manifest=JSON.parse(oldManifest),artifact=structuredClone(prior);
  assert.equal(sha(original),manifest.artifact_file_sha256);assert.equal(manifest.fidelity_review,'passed');
  const {customerAIState,customerReportVersion}=await import(pathToFileURL(path.join(apiRoot,'customer-report-output.js')));
  const {calculateFinancialPlanningScenario}=await import(pathToFileURL(path.join(apiRoot,'financial-planning-scenario.js')));
  const modelSource=fs.readFileSync(path.join(SITE,'public-sample-model.js'),'utf8');
  const renderer=fs.readFileSync(path.join(SITE,'monderman-report.js'),'utf8');
  const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(SITE,'participant-evidence-safety.js'),'utf8'),context);
  vm.runInNewContext(renderer,context);vm.runInNewContext(modelSource,context);
  const calculations={},proofs=[];
  for(const [key,entry]of Object.entries(artifact.outputs)){
    const source=entry.source.result||entry.source,old=prior.outputs[key].source.result||prior.outputs[key].source;
    source.ai_report=customerAIState(source.ai_report);
    for(const field of ['report_ai_release','report_ai_prompt_version'])entry.provenance[field]=customerReportVersion(entry.provenance[field]);
    assert.deepEqual(source.ai_report.report.interpretation,old.ai_report.report.interpretation);
    assert.deepEqual(source.ai_report.report.evidence,old.ai_report.report.evidence);
    assert.deepEqual(source.ai_report.report.sources,old.ai_report.report.sources);
    if(source.financial_scenario){
      assert.ok(key==='depth_synthesis'||key==='cross_lens_synthesis');
      const scenario=source.financial_scenario,input=structuredClone(scenario.inputs),depth=key==='depth_synthesis';
      input.subscriptionCost=depth?21600:48600;
      input.costBasis=depth
        ?'Illustrative 12-month Signal allocation: $21,600 paid annually in advance ($24,000 if paid in installments). External support is incremental cash; internal staff time is separate capacity cost. No costs are counted twice. This is an example assumption, not a customer quotation.'
        :'Illustrative 12-month Pattern allocation: $48,600 paid annually in advance ($54,000 if paid in installments). External support is incremental cash; internal staff time is separate capacity cost. No costs are counted twice. This is an example assumption, not a customer quotation.';
      const id=scenario.scope.scopeId,organizationId='synthetic-public-pricing-example',identity=digest({key,base:BASE,inputs:input});
      const scope={id,organizationId,label:scenario.scope.label,population:{size:entry.provenance.declared_eligible_population},
        window:{start:input.measurementStart,end:input.measurementEnd},lenses:Object.fromEntries(source.source_groups.map(g=>[g.tool_type,{}]))};
      const readiness={...structuredClone(source.campaign_evidence),scopeId:id,scope:{organizationId},scopeDigest:identity,evidenceDigest:identity};
      const calculated=calculateFinancialPlanningScenario(input,{scope,readiness,snapshot:identity,actorId:'synthetic-public-pricing-editor',createdAt:now});
      assert.deepEqual(calculated.activities,scenario.activities);
      for(const field of ['potentialHoursFreed','capacityValue','avoidableNonLaborCash'])assert.deepEqual(calculated.totals[field],scenario.totals[field]);
      assert.equal(calculated.participation.ready,scenario.participation.ready);
      calculations[key]={synthetic:true,notCustomerOperatingEvidence:true,calculated};
      source.financial_scenario={...scenario,createdAt:now,inputs:structuredClone(calculated.inputs),totals:structuredClone(calculated.totals),source_identity_digest:calculated.digest};
    }
    const unchanged=structuredClone(source),baseline=structuredClone(old);
    delete unchanged.ai_report;delete baseline.ai_report;delete unchanged.financial_scenario;delete baseline.financial_scenario;
    assert.deepEqual(unchanged,baseline,'No diagnostic, readiness, source, action or narrative change: '+key);
    entry.provenance.public_source_sha256=digest(entry.source);
    const r=source.ai_report.report;
    manifest.outputs[key]={...manifest.outputs[key],provenance:structuredClone(entry.provenance),ai:{generated_at:r.generated_at,prompt_version:r.prompt_version,version:r.version,snapshot_id:r.snapshot_id}};
    proofs.push({key,original_public_source_sha256:prior.outputs[key].provenance.public_source_sha256,public_source_sha256:entry.provenance.public_source_sha256,
      approved_interpretation_sha256:digest(r.interpretation),authoredTextEvidenceSourcesUnchanged:true,scoringReadinessUnchanged:true,
      originalApprovedOutputSha256:entry.provenance.approved_output_sha256,scenarioSubscriptionCost:source.financial_scenario?.inputs.subscriptionCost??null});
  }
  artifact.customer_publication_update={version:'sample-display-pricing-20260915.1',updated_at:now,original_artifact_file_sha256:sha(original),
    note:'Customer metadata and separate planning-scenario subscription assumptions updated. Original measurements, authored interpretations and generation identities are retained; no new AI generation.'};
  delete artifact.artifact_sha256;artifact.artifact_sha256=digest(artifact);
  manifest.artifact_file_sha256=sha(encoded(artifact));manifest.artifact_sha256=artifact.artifact_sha256;
  for(const name of Object.keys(manifest.source_files))manifest.source_files[name]=sha(fs.readFileSync(path.join(SITE,name)));
  manifest.customer_publication_update={...artifact.customer_publication_update,status:'pending_visual_and_root_review',original_manifest_sha256:sha(oldManifest)};
  context.window.MondermanPublicSamples.validate(artifact);
  assert.ok(!/claude-opus|opus5-/i.test(encoded(artifact)));
  const directory=path.resolve(output);assert.ok(!fs.existsSync(directory),'Preserve prior preparation');fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const write=(name,value)=>fs.writeFileSync(path.join(directory,name),value,{flag:'wx',mode:0o600});
  write('ORIGINAL-public-samples.json',original);write('ORIGINAL-public-release.json',oldManifest);
  write('production-diagnostic-samples.json',encoded(artifact));write('production-sample-release.json',encoded(manifest));write('PRIVATE-recalculations.json',encoded(calculations));
  for(const [key,entry]of Object.entries(artifact.outputs)){
    const model=context.window.MondermanPublicSamples.model(entry,artifact),html=context.window.MondermanReport.buildReportHtml(model);
    assert.ok(!/claude-opus|opus5-|About this example|fictional inputs/i.test(html));write(key+'.html',html);
  }
  const proof={status:'prepared_not_new_publication_approval',baseSiteCommit:BASE,original_artifact_sha256:sha(original),artifact_sha256:manifest.artifact_file_sha256,
    renderer_sha256:sha(renderer),calculator_sha256:sha(fs.readFileSync(path.join(apiRoot,'financial-planning-scenario.js'))),providerCalls:0,productionWrites:0,proofs};
  write('PREPARATION.json',encoded(proof));return proof;
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
  const [apiRoot,output]=process.argv.slice(2);console.log(JSON.stringify(await prepare({apiRoot,output})));
}
