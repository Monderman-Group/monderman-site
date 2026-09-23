// Scope guard for the separately reviewed financial release. This is not a
// claim that new financial inputs were part of earlier AI approvals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertFinancialSampleRevision,assertFinancialSamplePdfBinding,currentSynthesisPdfReview} from './public_sample_fixture.mjs';
import {OVERVIEW_SITE_PRIOR_COMMIT,sourceBeforeOverviewSiteCompatibility} from './report_overview_site_compatibility_inverse.mjs';
export const THREE_BENEFIT_BASELINE='b06b72083442f03f7a1e2cadeb5239e4f0449515';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function assertThreeBenefitSourceContract(root=path.resolve(import.meta.dirname,'..')){
  // Preserve the older form/source approval; independently reviewed September
  // 23 site changes are reversed only after exact complete-source pin checks.
  const read=f=>sourceBeforeOverviewSiteCompatibility(f,fs.readFileSync(path.join(root,f),'utf8'));
  const before=f=>execFileSync('git',['show',THREE_BENEFIT_BASELINE+':'+f],{cwd:root,encoding:'utf8',maxBuffer:16e6});
  assert.equal(sha(read('monderman-depth-lure-tile.css')),'ebe55b897ab099412799e0e1a6005e5c9465e4408ce2f76a66591c21c0021c92','Reviewed compact preview, mobile containment and approved single gold value');
  const currentForm=read('campaign-analysis.js'),originalForm=before('campaign-analysis.js');
  assert.equal(sha(currentForm),'e06b405673a530bf5a8b0c553a427180c854837e10d216d8818e45294c4dcb3e','Reviewed three-benefit form source');
  const block=/  function mountFinancialScenario\(content\)\{[\s\S]*?(?=  function render\(\))/;
  assert.ok(block.test(currentForm)&&block.test(originalForm));
  const priorBuild="    $('[data-ca-build]').onclick=()=>task(async()=>{if(!onReport)throw new Error('Report generation is unavailable.');await onReport(current,financialScenario());});";
  const visibleRejection=`    $('[data-ca-build]').onclick=()=>task(async()=>{
      if(!onReport)throw new Error('Report generation is unavailable.');
      const scenario=financialScenario();
      try{await onReport(current,scenario);}
      catch(error){message(error.message,true);const notice=$('[data-ca-message]');notice.tabIndex=-1;notice.focus({preventScroll:true});notice.scrollIntoView({block:'center',behavior:'instant'});}
    });`;
  assert.equal(currentForm.split(visibleRejection).length,2,'Exactly one reviewed report-rejection visibility correction');
  assert.equal(currentForm.replace(block,originalForm.match(block)[0]).replace(visibleRejection,()=>priorBuild),originalForm,'All campaign behavior outside financial form and report-error visibility unchanged');
  const artifact=JSON.parse(read('sample-data/production-diagnostic-samples.json')),original=JSON.parse(before('sample-data/production-diagnostic-samples.json'));
  const manifest=JSON.parse(read('sample-data/production-sample-release.json'));
  const restored=structuredClone(artifact);delete restored.financial_publication_update;restored.artifact_sha256=original.artifact_sha256;
  for(const key of ['depth_synthesis','cross_lens_synthesis']){
    assertFinancialSampleRevision(artifact.outputs[key],manifest.financial_publication_update,key);
    const current=restored.outputs[key],prior=original.outputs[key];
    delete current.source.financial_benefit_assessment;
    current.source.financial_scenario=prior.source.financial_scenario;
    delete current.provenance.financial_revision;
    current.provenance.public_source_sha256=prior.provenance.public_source_sha256;
  }
  assert.deepEqual(restored,original,'Every original AI result, score, response, action, evidence and generation identity remains exact');
  const presentation=currentSynthesisPdfReview(manifest);
  // Keep the historical palette-only claim and its PDF bytes anchored to the
  // pre-overview commit. The later overview has its own current PDF bindings;
  // it must not silently relabel that older approval as a new layout approval.
  const historicalPresentation=manifest.report_overview_presentation_review?manifest.benefit_flow_presentation_review:presentation;
  if(manifest.report_overview_presentation_review){
    const priorManifest=JSON.parse(execFileSync('git',['show',OVERVIEW_SITE_PRIOR_COMMIT+':sample-data/production-sample-release.json'],{cwd:root,encoding:'utf8',maxBuffer:16e6}));
    assert.deepEqual(historicalPresentation,priorManifest.benefit_flow_presentation_review,'The complete historical benefit-flow review remains exact');
  }
  assert.equal(historicalPresentation.individual_pdf_change,'palette_only','Individual PDF content may not be revised by this financial release');
  for(const key of ['operational_systems','decision_velocity','structural_clarity','institutional_performance']){
    if(manifest.report_overview_presentation_review)assertFinancialSamplePdfBinding(historicalPresentation,key,execFileSync('git',['show',OVERVIEW_SITE_PRIOR_COMMIT+':sample-data/reports/'+key+'.pdf'],{cwd:root,maxBuffer:16e6}));
    assertFinancialSamplePdfBinding(presentation,key,fs.readFileSync(path.join(root,'sample-data/reports/'+key+'.pdf')));
  }
  return {base:THREE_BENEFIT_BASELINE,onlyFinancialFormChanged:true,onlySynthesisFinancialSamplesChanged:true,individualPdfPaletteReviewed:true};
}
