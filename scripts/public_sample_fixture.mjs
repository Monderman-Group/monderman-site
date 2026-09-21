// Test-only public fixture adapter. No browser global, customer fixture rewrite,
// network, provider call, generation or approval operation occurs here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

export const PUBLIC_PRODUCTS = Object.freeze({
  os:'operational_systems', dv:'decision_velocity', sc:'structural_clarity',
  ip:'institutional_performance', depth:'depth_synthesis', synthesis:'cross_lens_synthesis',
});
const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
export const evidenceDigest = value => sha(JSON.stringify(canonical(value)));
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export const publicResult = entry => entry.kind === 'diagnostic' && entry.source?.result?.tool_type ? entry.source.result : entry.source;
// Pure generation-provenance check, also usable with explicitly unapproved
// in-memory display fixtures. It does not issue or replace release approval.
export function assertPublicSampleGenerationProvenance(entry,key) {
  const p=entry?.provenance,report=publicResult(entry)?.ai_report?.report;
  assert.ok(plain(p)&&typeof p.engine_commit==='string'&&/^[a-f0-9]{40}$/.test(p.engine_commit),key+' original generation commit missing or malformed');
  assert.ok(validTime(p.generated_at)&&validTime(report?.generated_at),key+' original generation timestamps missing');
  assert.ok(typeof report.version==='string'&&report.version,key+' AI release missing');
  assert.equal(p.report_ai_release,report.version,key+' AI release provenance mismatch');
  assert.ok(typeof report.prompt_version==='string'&&report.prompt_version,key+' AI prompt missing');
  assert.equal(p.report_ai_prompt_version,report.prompt_version,key+' AI prompt provenance mismatch');
  return entry;
}
const DEFAULT_ROOT = fileURLToPath(new URL('../',import.meta.url));
const REQUIRED_SOURCE_FILES = [
  'monderman-report.js','participant-evidence-safety.js','public-sample-model.js','sample-report-production.js',
  'scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html',
];

// A deterministic financial re-edition is not a new AI approval. Its own
// receipt pins only the changed attachment while retaining the original AI,
// scores, campaign evidence and publication history.
export function assertFinancialSampleRevision(entry,update,key){
  const r=entry.source,p=entry.provenance,revision=p.financial_revision;
  assert.equal(update?.status,'reviewed',key+' financial revision has not been reviewed');
  assert.equal(update.reviewed_by,'Codex');assert.ok(validTime(update.reviewed_at));
  assert.equal(update.calculation_review,'passed');assert.equal(update.visual_review,'passed');
  assert.equal(revision?.version,'three-benefit-sample-revision-20260919.1');
  assert.equal(update.version,revision.version);assert.ok(validTime(revision.created_at));
  for(const field of ['original_public_source_sha256','original_financial_scenario_sha256','input_sha256','calculator_result_sha256','public_financial_scenario_sha256','public_financial_assessment_sha256','unchanged_nonfinancial_source_sha256'])assert.ok(validHash(revision[field]),key+' financial '+field);
  assert.deepEqual(revision.source_files,update.source_files);
  for(const name of ['financial-planning-scenario.js','financial-planning-scenario-v2.js','certification/three-benefit-samples.mjs','certification/public-sample-projection.mjs'])assert.ok(validHash(revision.source_files[name]));
  const s=r.financial_scenario,a=r.financial_benefit_assessment;
  assert.equal(s?.version,'operational-planning-scenario-20260919.2');
  assert.equal(s.publication_projection,'three-benefit-scenario-public-20260919.1');
  assert.equal(s.source_identity_digest,revision.calculator_result_sha256);
  assert.equal(evidenceDigest(s.inputs),revision.input_sha256);
  assert.equal(evidenceDigest(s),revision.public_financial_scenario_sha256);
  assert.equal(evidenceDigest(a),revision.public_financial_assessment_sha256);
  assert.equal(a.version,'three-benefit-assessment-20260919.1');assert.equal(a.scopeId,s.scope.scopeId);
  assert.deepEqual(Object.keys(s.scope).sort(),['label','scopeId']);
  assert.equal(s.preparedBy,undefined);assert.equal(a.scope,undefined);
  assert.equal(s.method.usesDiagnosticScores,false);assert.equal(s.method.isConfidenceInterval,false);
  const unchanged=structuredClone(r);delete unchanged.financial_scenario;delete unchanged.financial_benefit_assessment;
  assert.equal(evidenceDigest(unchanged),revision.unchanged_nonfinancial_source_sha256);
  assert.deepEqual(a.coverage,s.coverage);assert.equal(s.coverage.complete,true);
  for(const category of ['spendingReduction','spendingAvoidance','staffCapacity']){
    assert.equal(a.categories[category].status,s.benefits[category].status);
    assert.equal(s.benefits[category].status,'estimated');
    for(const k of ['low','central','high'])assert.ok(s.benefits[category].amount[k]>0);
  }
}

// The current financial or subsequent presentation receipt binds exported PDFs.
// Historical review records remain untouched; page layout has a separate review.
export function assertFinancialSamplePdfBinding(update,key,pdfBytes){
  assert.ok(Object.values(PUBLIC_PRODUCTS).includes(key),'reviewed PDF product invalid');
  assert.equal(update?.status,'reviewed',key+' financial PDF revision has not been reviewed');
  const pin=update.pdf_outputs?.[key];
  assert.equal(pin?.path,'sample-data/reports/'+key+'.pdf',key+' financial PDF path differs');
  assert.ok(validHash(pin.sha256),key+' financial PDF digest missing or malformed');
  assert.ok(Number.isSafeInteger(pin.pages)&&pin.pages>0,key+' financial PDF page count invalid');
  assert.equal(sha(pdfBytes),pin.sha256,key+' financial PDF bytes differ from the reviewed revision');
}

export function currentSynthesisPdfReview(manifest){
  const review=manifest.benefit_flow_presentation_review;
  if(!review)return manifest.financial_publication_update;
  assert.equal(review.version,'benefit-flow-presentation-20260921.1');
  assert.equal(review.status,'reviewed');assert.equal(review.reviewed_by,'Codex');
  assert.ok(validTime(review.reviewed_at));assert.equal(review.visual_review,'passed');
  assert.equal(review.artifact_file_sha256,manifest.artifact_file_sha256,'Presentation must bind unchanged sample data');
  assert.equal(review.renderer_sha256,manifest.source_files['monderman-report.js'],'Presentation must bind current renderer');
  assert.equal(review.provider_calls,0);
  assert.equal(review.all_pdf_palette,true,'All six sample PDFs share the reviewed report palette');
  assert.deepEqual(Object.keys(review.pdf_outputs).sort(),Object.values(PUBLIC_PRODUCTS).sort(),'All six presentation PDF bindings required');
  return review;
}

// Public counts are a projection of the reviewed synthetic campaign, not a
// reconstruction of private identities. The enclosing release checks still
// require exact approved source/provenance hashes. Consistency is not proof of
// independent people, population accuracy or scientific validity.
export function assertPublicCampaignEvidence(r,p,key) {
  const message=detail=>`${key}: ${detail}`;
  const people=p.distinct_included_participants,population=p.declared_eligible_population;
  assert.ok(Number.isSafeInteger(people)&&people>0,message('reviewed distinct-participant count missing'));
  assert.ok(Number.isSafeInteger(population)&&population>=people,message('reviewed population smaller than participation'));
  assert.ok(validHash(p.campaign_handoff_sha256),message('actual campaign handoff binding missing'));
  assert.equal(p.experience_source,'fabricated_participant_accounts');
  assert.equal(p.operating_review_source,'fabricated_operational_corroboration');
  assert.equal(r.report_kind,key,message('campaign report kind differs'));
  assert.ok(typeof r.campaign_scope_label==='string'&&r.campaign_scope_label.trim(),message('bounded campaign scope missing'));
  assert.equal(r.count_basis,'server_bound_account_or_invitation_identities');
  assert.match(r.participant_count_note||'',/not independent proof/);
  assert.equal(r.participant_count,people,message('participant count differs from reviewed provenance'));
  assert.equal(r.respondent_count,people,message('respondent count differs from reviewed provenance'));
  assert.equal(r.submitted_run_count,p.submitted_run_count);
  assert.equal(r.source_result_count,p.submitted_run_count);
  const c=r.campaign_evidence,e=r.evidence_assessment;
  assert.equal(c?.version,'campaign-evidence-readiness-20260911.1');
  assert.equal(c.method?.scientificallyValidated,false);
  assert.equal(c.method?.independentReviewStatus,'not_reviewed');
  assert.equal(c.method?.policyStatus,'provisional_product_policy');
  assert.equal(c.counts?.distinctParticipantsAcrossLenses,people);
  assert.equal(c.counts?.recordedEligibleParticipants,people);
  assert.equal(c.counts?.declaredPopulation,population);
  assert.equal(c.counts?.selectedRuns,p.submitted_run_count);
  assert.equal(e?.scope?.status,'anchored');assert.equal(e.scope.anchored,true);
  assert.deepEqual(e.scope.conflicts,[]);
  assert.equal(e.versions?.status,'verified');
  assert.equal(e.time_window?.status,'aligned');
  assert.ok(validTime(e.time_window.declared_start)&&validTime(e.time_window.declared_end));
  assert.ok(Date.parse(e.time_window.declared_end)>=Date.parse(e.time_window.declared_start));
  assert.equal(e.source_identity?.status,'verified');
  assert.equal(e.source_identity.explicit_source_ids,p.submitted_run_count);
  assert.equal(e.source_identity.total_runs,p.submitted_run_count);
  assert.equal(e.representativeness?.status,'recorded_campaign_participation');
  assert.equal(e.representativeness.participant_count,people);
  assert.equal(e.representativeness.population_size,population);
  const lensKeys=Object.keys(p.questionnaire_versions||{}).sort();
  const expectedKeys=key==='depth_synthesis'?['structural_clarity']:Object.values(PUBLIC_PRODUCTS).filter(lens=>!lens.endsWith('_synthesis')).sort();
  assert.deepEqual(lensKeys,expectedKeys,message('approved showcase lens scope changed'));
  assert.equal(r.lens_count,lensKeys.length);
  const sameLenses=(rows,field,label)=>assert.deepEqual((rows||[]).map(row=>row[field]).sort(),lensKeys,message(label));
  sameLenses(r.source_groups,'tool_type','source groups missing or duplicated');
  sameLenses(c.depth?.lenses,'lens','readiness lenses missing or duplicated');
  sameLenses(e.versions.per_lens,'tool_type','versioned lenses missing or duplicated');
  sameLenses(e.representativeness.per_lens,'tool_type','participation lenses missing or duplicated');
  assert.equal(c.depth.status,'satisfied');
  if(key==='cross_lens_synthesis')assert.equal(c.crossLens?.status,'satisfied');
  const coverage=(value,label)=>{
    assert.equal(value?.numerator,people,message(label+' numerator'));
    assert.equal(value.denominator,population,message(label+' denominator'));
    assert.equal(value.percentage,100*people/population,message(label+' percentage'));
    assert.equal(value.denominatorSource,'sponsor_declared');
    assert.equal(value.independentlyVerified,false);
  };
  for(const lens of lensKeys) {
    const group=r.source_groups.find(row=>row.tool_type===lens),ready=c.depth.lenses.find(row=>row.lens===lens);
    // This approved example uses the same participant set once per lens.
    // Four lens runs must never be presented as four independent people.
    for(const field of ['submitted_runs','participants','respondents','source_id_count'])assert.equal(group[field],people,message(lens+' '+field));
    assert.deepEqual(group.config_versions,[p.questionnaire_versions[lens]]);
    const version=e.versions.per_lens.find(row=>row.tool_type===lens);
    assert.equal(version.compatible,true);assert.deepEqual(version.config_versions,group.config_versions);
    assert.deepEqual(version.scorer_versions,group.scorer_versions);
    assert.equal(ready.status,'satisfied');
    for(const field of ['includedRuns','distinctParticipants','usableDistinctParticipants'])assert.equal(ready.counts?.[field],people,message(lens+' '+field));
    for(const field of ['repeatedParticipants','duplicateRunIds','excludedRuns','pendingRuns'])assert.equal(ready.counts?.[field],0,message(lens+' '+field));
    assert.equal(ready.counts.eligiblePopulation,population);
    coverage(ready.coverage,lens);coverage(e.representativeness.per_lens.find(row=>row.tool_type===lens),lens+' representation');
    assert.equal(ready.bounds?.observed,people);assert.equal(ready.bounds.population,population);
    assert.equal(ready.bounds.missing,population-people);assert.equal(ready.bounds.isConfidenceInterval,false);
    assert.equal(ready.bounds.statisticalConfidenceLevel,null);
    const groups=ready.requiredGroups||[];
    assert.ok(groups.length>0&&new Set(groups.map(row=>row.id)).size===groups.length);
    for(const row of groups)assert.ok(Number.isSafeInteger(row.participants)&&row.participants>0&&Number.isSafeInteger(row.population)&&row.population>=row.participants);
    assert.equal(groups.reduce((sum,row)=>sum+row.participants,0),people,message(lens+' disjoint group participants'));
    assert.equal(groups.reduce((sum,row)=>sum+row.population,0),population,message(lens+' disjoint group population'));
  }
  assert.equal(r.source_groups.reduce((sum,row)=>sum+row.submitted_runs,0),p.submitted_run_count);
  assert.equal(p.submitted_run_count,people*lensKeys.length,message('runs versus shared participants'));
}

// Run against the real approved projection during --check. Also exported for
// offline tests using the actual deterministic generator before paid samples
// exist. These mutations never change the artifact or manufacture approval.
export function assertPublicCampaignEvidenceGuards(source,provenance,key) {
  assertPublicCampaignEvidence(source,provenance,key);
  const cases=[
    ['missing participant count',s=>{s.participant_count=null;}],
    ['inflated respondent count',s=>{s.respondent_count++;}],
    ['runs treated as people',s=>{s.participant_count=s.respondent_count=s.submitted_run_count+1;}],
    ['wrong identity basis',s=>{s.count_basis='submitted_runs';}],
    ['missing scope',s=>{delete s.campaign_scope_label;}],
    ['conflicting scope',s=>{s.evidence_assessment.scope.conflicts=['different team'];}],
    ['unanchored scope',s=>{s.evidence_assessment.scope.anchored=false;}],
    ['unaligned period',s=>{s.evidence_assessment.time_window.status='unaligned';}],
    ['invalid period',s=>{s.evidence_assessment.time_window.declared_end='invalid';}],
    ['wrong version',s=>{s.source_groups[0].config_versions=['wrong'];}],
    ['duplicate lens',s=>{s.source_groups.push(structuredClone(s.source_groups[0]));}],
    ['inflated source count',s=>{s.source_result_count++;}],
    ['reused source identity',s=>{s.evidence_assessment.source_identity.explicit_source_ids--;}],
    ['inflated union',s=>{s.campaign_evidence.counts.distinctParticipantsAcrossLenses++;}],
    ['missing population',s=>{s.campaign_evidence.counts.declaredPopulation=null;}],
    ['inflated per-lens people',s=>{s.source_groups[0].participants++;}],
    ['repeated participant',s=>{s.campaign_evidence.depth.lenses[0].counts.repeatedParticipants=1;}],
    ['duplicate run',s=>{s.campaign_evidence.depth.lenses[0].counts.duplicateRunIds=1;}],
    ['inflated coverage',s=>{s.campaign_evidence.depth.lenses[0].coverage.percentage=100;}],
    ['false verified population',s=>{s.evidence_assessment.representativeness.per_lens[0].independentlyVerified=true;}],
    ['group double count',s=>{s.campaign_evidence.depth.lenses[0].requiredGroups[0].participants++;}],
    ['group population mismatch',s=>{s.campaign_evidence.depth.lenses[0].requiredGroups[0].population++;}],
    ['false confidence interval',s=>{s.campaign_evidence.depth.lenses[0].bounds.isConfidenceInterval=true;}],
    ['false scientific validation',s=>{s.campaign_evidence.method.scientificallyValidated=true;}],
    ['missing handoff',(_s,p)=>{delete p.campaign_handoff_sha256;}],
    ['changed reviewed participants',(_s,p)=>{p.distinct_included_participants++;}],
  ];
  for(const [label,mutate] of cases){const s=structuredClone(source),p=structuredClone(provenance);mutate(s,p);assert.throws(()=>assertPublicCampaignEvidence(s,p,key),{name:'AssertionError'},`${key}: guard did not reject ${label}`);}
  return {accepted:1,mutationsRejected:cases.length};
}

// The independent review manifest is a release input, never regenerated by a
// validator. approved_output_sha256 refers to the unstripped private approved
// report; public_source_sha256 binds the deliberately stripped public source.
export function readPublicSampleFixture({root=DEFAULT_ROOT,manifestPath=process.env.PUBLIC_SAMPLE_APPROVAL_MANIFEST}={}) {
  root=path.resolve(root);
  const artifactBytes=fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'));
  const artifact=JSON.parse(artifactBytes);
  const manifest=JSON.parse(fs.readFileSync(manifestPath ? path.resolve(root,manifestPath) : path.join(root,'sample-data/production-sample-release.json'),'utf8'));
  assert.equal(manifest.contract,'monderman-public-sample-release/v1','reviewed public release manifest missing');
  assert.equal(manifest.status,'reviewed','public content has not completed fidelity review');
  assert.equal(manifest.fidelity_review,'passed','actual six-output fidelity review is required');
  assert.equal(manifest.review_basis,'independent_source_replay_and_visual_review');
  assert.equal(manifest.reviewed_by,'Codex','review must not be attributed to Jason');
  assert.ok(validTime(manifest.reviewed_at),'actual fidelity-review time is missing');
  assert.ok(validHash(manifest.artifact_file_sha256));
  assert.equal(sha(artifactBytes),manifest.artifact_file_sha256,'public artifact bytes differ from the reviewed release');
  assert.equal(artifact.contract,'monderman-public-product-samples/v3');
  assert.equal(artifact.synthetic,true,'the entire artifact must be explicitly synthetic');
  assert.ok(!/dry|pending|not_for_publication|candidate/i.test(artifact.status||''),'unapproved intermediate artifact');
  assert.ok(validHash(artifact.artifact_sha256));
  assert.equal(artifact.artifact_sha256,manifest.artifact_sha256);
  assert.equal(artifact.artifact_digest_basis,'sha256-canonical-json-excluding-artifact_sha256');
  const digestContent={...artifact};delete digestContent.artifact_sha256;
  assert.equal(evidenceDigest(digestContent),artifact.artifact_sha256,'sample content digest is not the completed artifact');
  assert.match(artifact.engine_commit||'',/^[a-f0-9]{40}$/);
  assert.equal(artifact.engine_commit,manifest.engine_commit);
  assert.ok(validTime(artifact.generated_at));
  assert.equal(artifact.generated_at,manifest.generated_at);
  assert.equal(artifact.publication_projection?.version,'monderman-public-sample-projection-20260913.7');
  assert.ok(validHash(artifact.publication_projection.source_sha256));
  assert.match(artifact.publication_projection.projection_commit,/^[a-f0-9]{40}$/);
  assert.deepEqual(artifact.publication_projection,manifest.publication_projection,'publication projection differs from reviewed export');
  const keys=Object.values(PUBLIC_PRODUCTS).sort();
  assert.deepEqual(Object.keys(artifact.outputs||{}).sort(),keys,'exactly six current public products required');
  assert.deepEqual(Object.keys(manifest.outputs||{}).sort(),keys,'all six approved output pins required');
  for(const filename of REQUIRED_SOURCE_FILES) {
    assert.ok(validHash(manifest.source_files?.[filename]),'missing reviewed source pin: '+filename);
    assert.equal(sha(fs.readFileSync(path.join(root,filename))),manifest.source_files[filename],'reviewed source changed: '+filename);
  }
  const entries=[],runs={};
  for(const [tab,key] of Object.entries(PUBLIC_PRODUCTS)) {
    const entry=artifact.outputs[key],pin=manifest.outputs[key],p=entry.provenance,r=publicResult(entry);
    const synthesis=key.endsWith('_synthesis');
    assertFinancialSamplePdfBinding(currentSynthesisPdfReview(manifest),key,fs.readFileSync(path.join(root,'sample-data/reports/'+key+'.pdf')));
    assert.equal(entry.kind,synthesis?'synthesis':'diagnostic',key+' kind');
    assert.ok(plain(entry.source)&&plain(p)&&plain(pin),key+' source, provenance and approval required');
    assert.equal(synthesis?r.synthesis_product:r.tool_type,key,key+' identity');
    assert.equal(p.synthetic,true,key+' synthetic origin');
    assert.ok(validTime(p.generated_at),key+' original sample time');
    for(const name of ['input_sha256','result_sha256','source_manifest_sha256','approved_output_sha256','approved_review_sha256','public_source_sha256']) {
      assert.ok(validHash(p[name]),key+' missing '+name);
    }
    assert.deepEqual(p,pin.provenance,key+' provenance differs from the reviewed receipt');
    assert.equal(evidenceDigest(entry.source),p.public_source_sha256,key+' public projection changed');
    assert.equal(p.ai_status,'complete',key+' missing completed AI provenance');
    const ai=r.ai_report,report=ai?.report;
    assert.equal(ai?.status,'complete',key+' must carry the accepted AI interpretation');
    assert.ok(plain(report?.interpretation),key+' interpretation missing');
    assert.ok(typeof report.interpretation.summary==='string'&&report.interpretation.summary.trim(),key+' empty interpretation');
    assert.ok(report.interpretation.recommendations?.some(row=>typeof row?.action==='string'&&row.action.trim()),key+' accepted next step missing');
    assert.ok(validTime(report.generated_at),key+' AI preparation time missing');
    assert.ok((report.model||report.customer_metadata_version==='customer-report-metadata-20260915.1')&&report.prompt_version&&report.version&&report.snapshot_id,key+' AI provenance missing');
    assert.deepEqual({
      ...(report.model?{model:report.model}:{}),generated_at:report.generated_at,prompt_version:report.prompt_version,
      version:report.version,snapshot_id:report.snapshot_id,
    },pin.ai,key+' AI source differs from approved output');
    assert.equal(report.prompt_version,p.report_ai_prompt_version,key+' AI prompt provenance mismatch');
    assertPublicSampleGenerationProvenance(entry,key);
    if(synthesis) {
      if(r.financial_scenario?.version==='operational-planning-scenario-20260919.2'){
        assertFinancialSampleRevision(entry,manifest.financial_publication_update,key);
        assertFinancialSamplePdfBinding(currentSynthesisPdfReview(manifest),key,fs.readFileSync(path.join(root,'sample-data/reports/'+key+'.pdf')));
      }
      assert.equal(r.evidence_assessment?.time_window?.maximum_days,undefined,key+' private qualification limit must not be published');
      assert.equal(r.narrative?.sequenced_action_logic,undefined,key+' internal sequencing duplicate must not be published');
      assert.equal(r.narrative?.what_would_strengthen_the_read,undefined,key+' private next-band target must not be published');
      assert.ok(!(r.priority_actions||[]).some(row=>row.source==='evidence_requirement'),key+' private qualification targets must not be published');
      assert.ok(Number.isInteger(r.submitted_run_count)&&r.submitted_run_count>0,key+' submitted-run count');
      assert.equal(r.submitted_run_count,p.submitted_run_count,key+' count differs from source ledger');
      assertPublicCampaignEvidenceGuards(r,p,key);
      const exposure=r.pathway_exposure||r.compounded_exposure;
      if(['available','partial'].includes(exposure?.status)) {
        assert.equal(exposure.not_compounded,true,key+' overlapping exposure must not be summed');
        assert.ok(exposure.priceable_runs<=exposure.total_runs);
      }
    } else {
      assert.ok(Number.isFinite(r.score)&&r.score>=0&&r.score<=100,key+' score missing');
      assert.ok(plain(r.dimensions)&&Object.keys(r.dimensions).length>0,key+' dimensions missing');
      assert.ok(r.questionnaire_version&&r.scorer_version,key+' calculation provenance missing');
      runs[key]=entry.source;
    }
    entries.push({tab,key,kind:entry.kind,source:entry.source,provenance:p,result:r});
  }
  return {artifact,manifest,entries,runs,fixtures:{
    crossLens:artifact.outputs.cross_lens_synthesis.source,
    depth:artifact.outputs.depth_synthesis.source,
  }};
}

// Uses the same small adapter as the production page, preserving provenance in
// exports. Existing synthetic pending/empty/hostile fixtures remain independent.
export function createPublicSampleModels(options={}) {
  const fixture=readPublicSampleFixture(options);
  const root=path.resolve(options.root||DEFAULT_ROOT);
  const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),context,{filename:'participant-evidence-safety.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8'),context,{filename:'monderman-report.js'});
  vm.runInContext(fs.readFileSync(path.join(root,'public-sample-model.js'),'utf8'),context,{filename:'public-sample-model.js'});
  const Report=context.window.MondermanReport,Public=context.window.MondermanPublicSamples;
  assert.equal(Report.rendererVersion,'diagnostic-renderer-evidence-reading-20260914.43');
  assert.equal(Report.rendererVersion,fixture.manifest.renderer_version);
  Public.validate(fixture.artifact);
  const models={};
  for(const entry of fixture.entries) {
    const before=JSON.stringify(fixture.artifact.outputs[entry.key]);
    const model=Public.model(fixture.artifact.outputs[entry.key],fixture.artifact);
    assert.equal(JSON.stringify(fixture.artifact.outputs[entry.key]),before,entry.key+' model adapter mutated saved source');
    assert.equal(model.aiReport.status,'complete');
    assert.equal(JSON.stringify(model.aiReport),JSON.stringify(entry.result.ai_report),entry.key+' accepted AI state changed in model adapter');
    assert.equal(model.sampleProvenance.generated_at,entry.provenance.generated_at);
    assert.equal(model.sampleProvenance.engine_commit,entry.provenance.engine_commit);
    assert.equal(model.sampleProvenance.report_ai_release,entry.result.ai_report.report.version);
    assert.equal(model.sampleProvenance.report_ai_prompt_version,entry.result.ai_report.report.prompt_version);
    assert.equal(model.sampleProvenance.approved_output_sha256,entry.provenance.approved_output_sha256);
    assert.ok(model.meta.some(row=>row.label==='Sample created'));
    assert.ok(!model.meta.some(row=>row.label==='Generated'),'view time must not replace sample generation time');
    models[entry.key]=model;
  }
  return {...fixture,Report,Public,models};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args=process.argv.slice(2),rootAt=args.indexOf('--root');
  assert.ok(args.includes('--check'),'read-only --check is required');
  const {artifact,entries}=createPublicSampleModels({root:rootAt>=0?args[rootAt+1]:DEFAULT_ROOT});
  console.log(JSON.stringify({passed:true,products:entries.length,engine_commit:artifact.engine_commit,artifact_sha256:artifact.artifact_sha256,networkRequests:0,providerCalls:0}));
}
