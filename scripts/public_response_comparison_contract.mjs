// In-memory NOT_PUBLIC display fixtures only. No model call, artifact write,
// release approval, receipt replacement or public-preview regeneration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {assertPublicCampaignEvidence,assertPublicCampaignEvidenceGuards,evidenceDigest} from './public_sample_fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sourcePath=process.argv[2]||path.resolve(root,'../../output/response-comparison-bundle-20260924/bundle/PREPARED.json');
const input=JSON.parse(fs.readFileSync(sourcePath,'utf8')),draft=input.publicDraft||input;
const original=JSON.parse(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'),'utf8'));
const keys=['operational_systems','decision_velocity','structural_clarity','institutional_performance'];
const artifact=structuredClone(original);artifact.status='NOT_PUBLIC_SYNTHETIC_ADAPTER_TEST';
for(const key of keys){
  const entry=structuredClone(draft.outputs[key]);
  assert.equal(entry.kind,'response_comparison');assert.equal(entry.provenance.ai_status,'not_generated');
  entry.provenance.approved_output_sha256='0'.repeat(64);
  entry.source.ai_report={status:'complete',report:{version:entry.provenance.report_ai_release,prompt_version:entry.provenance.report_ai_prompt_version,
    model:'NOT_PUBLIC_SYNTHETIC_TEST_MODEL',generated_at:entry.provenance.generated_at,
    interpretation:{summary:'NOT PUBLIC: synthetic adapter check, not generated or reviewed interpretation.',observations:[],hypotheses:[],
      recommendations:[],action_options:[],recommended_option:null,limitations:[]},
    experiential_evidence:structuredClone(entry.source.experiential_records),evidence:[],sources:[],limitations:[]}};
  artifact.outputs[key]=entry;
}
delete artifact.artifact_sha256;artifact.artifact_sha256=evidenceDigest(artifact);
const box={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.createContext(box);
for(const name of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),box,{filename:name});
const Public=box.window.MondermanPublicSamples,Report=box.window.MondermanReport;
let checks=0,dispatches=0,individualDispatches=0;const failures=[];
const fromSynthesis=Report.fromSynthesis,fromRun=Report.fromRun;
Report.fromSynthesis=source=>{dispatches++;return fromSynthesis(source);};Report.fromRun=source=>{individualDispatches++;return fromRun(source);};
Public.validate(artifact);checks++;
for(const key of keys){
  const entry=artifact.outputs[key],before=JSON.stringify(entry);
  assertPublicCampaignEvidence(entry.source,entry.provenance,key);checks++;
  checks+=assertPublicCampaignEvidenceGuards(entry.source,entry.provenance,key).mutationsRejected;
  const model=Public.model(entry,artifact);
  assert.equal(model.kind,'meta-synthesis');assert.equal(model.comparisonOnly,true);assert.equal(model.selfRun,false);
  assert.equal(model.sourceGroups.length,1);assert.equal(model.sourceGroups[0].toolType,key);assert.equal(model.reads,15);
  assert.match(model.title,/response comparison/i);assert.match(model.subtitle,/not a population conclusion/i);
  assert.equal(model.sampleProvenance.input_digest,entry.provenance.input_sha256);
  assert.equal(model.sampleProvenance.engine_commit,entry.provenance.engine_commit);
  assert.equal(JSON.stringify(entry),before,'Adapter mutated its evidence source');checks+=10;
  const html=Report.buildReportHtml(model);
  for(const phrase of ['This is a same-Diagnostic Depth Synthesis.','Use this Depth Synthesis to review','aria-label="Depth Synthesis score distribution"']){
    checks++;if(html.includes(phrase))failures.push(`${key}: comparison HTML contains ${phrase}`);
  }
  assert.equal(JSON.stringify(entry),before,'Rendering mutated its evidence source');checks++;
  const mutations=[
    ['wrong lens',s=>{s.source_groups[0].tool_type='different_lens';}],
    ['one-person identity',s=>{s.participant_count=1;}],
    ['Synthesis status',s=>{s.campaign_evidence.depth.status='satisfied';}],
    ['Cross-Lens status',s=>{s.campaign_evidence.crossLens.status='satisfied';}],
    ['no descriptive permission',s=>{s.campaign_evidence.depth.lenses[0].descriptiveReadAvailable=false;}],
    ['raw preferred path',s=>{s.recommended_path_available=true;}],
    ['raw change options',s=>{s.campaign_action_options=[{id:'campaign_structural',action:'Change the whole organization.'}];}],
    ['AI preferred option',s=>{s.ai_report.report.interpretation.recommended_option={option_id:'campaign_structural'};}],
    ['AI change options',s=>{s.ai_report.report.interpretation.action_options=[{option_id:'campaign_structural'}];}],
    ['financial scenario',s=>{s.financial_scenario={version:'unreviewed',totals:{recoverable_cost:1000000}};}],
    ['unsuppressed organization exposure',s=>{s.compounded_exposure.annual_cost=1000000;}],
    ['claimed recoverable cost',s=>{s.compounded_exposure.recoverable_cost=1000000;}],
    ['estimated benefit without operating inputs',s=>{s.financial_benefit_assessment.categories.spendingReduction.status='estimated';}],
    ['lowered role privacy',s=>{s.campaign_evidence.privacyPolicy.minimumDisplayedGroupSize=1;}],
    ['displayed role below five',s=>{
      const groups=s.campaign_evidence.depth.lenses[0].requiredGroups;
      groups[0].participants=4;groups[1].participants=6;
      s.source_groups[0].participant_mode_counts.operational=4;s.source_groups[0].participant_mode_counts.managerial=6;
    }],
    ['more than twelve selected accounts',s=>{s.experiential_records.push({...s.experiential_records[0],id:'X13'});
      s.experiential_selection.incorporated=13;s.ai_report.report.experiential_evidence=structuredClone(s.experiential_records);}],
    ['claims all accounts included',s=>{s.experiential_selection.exhaustive=true;}],
    ['account from another lens',s=>{s.experiential_records[0].lens='different_lens';}],
  ];
  for(const [label,mutate]of mutations){
    const changed=structuredClone(artifact);mutate(changed.outputs[key].source);
    for(const [boundary,validate]of [
      ['browser',()=>Public.validate(changed)],
      ['publication',()=>assertPublicCampaignEvidence(changed.outputs[key].source,changed.outputs[key].provenance,key)],
    ]){
      let rejected=false;try{validate();}catch{rejected=true;}
      checks++;if(!rejected)failures.push(`${key}: ${boundary} accepted ${label}`);
    }
  }
}
assert.equal(dispatches,4);assert.equal(individualDispatches,0);checks+=2;
console.log(JSON.stringify({status:failures.length?'FAIL':'PASS',checks,failures,
  scope:'NOT_PUBLIC in-memory AI placeholders on actual dry comparison sources; no provider call, approval or artifact write.'}));
assert.equal(failures.length,0,'Response-comparison admission gaps above require correction');
