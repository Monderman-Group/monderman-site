// Synthetic display-graph checks only; no provider, artifact, PDF or public data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8'),context);
const Report=context.window.MondermanReport;
let checks=0;const check=fn=>{fn();checks++;};
const label='Recorded answers: Operational Systems / Managers';
function fixture(size,{campaign=true}={}){
  const account={id:'X1',role:'managerial',lens:'operational_systems',scope_label:'Synthetic local scope',text:'MOCK: a request may need another check. <private-note> & full text.'};
  const {id,...fields}=account,block={version:'experiential-prose-block-20260913.1',...fields};
  const suffix='MOCK: Compare the participant’s example with a recent request.';
  const row={text:'Participant account · Managers · Operational Systems\nScope: '+account.scope_label+'\n“'+account.text+'”\n\n'+suffix,evidence_ids:['X1'],source_ids:[],experiential_block:block,interpretation_text:suffix};
  const evidence=[],groups=[];
  for(let n=1;n<=Math.floor((size-1)/2);n++){
    const denominator='F'+(2*n-1),answer='F'+2*n,group_ref='G'+n;
    evidence.push({id:denominator,label:'Recorded answers',value:10,provenance:'deterministic_campaign_answer_summary',group_ref,group_label:label},
      {id:answer,label:'Recorded selection: Sometimes',value:10,provenance:'deterministic_campaign_answer_summary',group_ref,group_label:label});
    groups.push({group_ref,label,tool:'operational_systems',role:'managerial',depth:60,questionnaire_version:'1.0.0',question:'Synthetic exact question '+n+'?',response_format:'single_choice',unit:null,unit_and_condition_basis:'exact_original_question',denominator_basis:'recorded_answers_to_this_exact_question',matching_source_packets:10,measures:{answered_responses:denominator,category_1:answer}});
    row.evidence_ids.push(denominator,answer);
  }
  if(row.evidence_ids.length<size){evidence.push({id:'F999',label:'Synthetic recorded score',value:61,provenance:'deterministic_result'});row.evidence_ids.push('F999');}
  const report={composition:{authorship:'provider_authored_engine_bounded'},evidence,experiential_evidence:[account],sources:[],limitations:[],
    evidence_references:{summary:['F1'],summary_sources:[]},interpretation:{summary:'Synthetic display graph only.',observations:[row],hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]}};
  if(campaign)report.campaign_answer_evidence={version:'campaign-recorded-answer-summary-20260912.1',coverage:{selected_sources:10,original_packets_available:10,available_question_groups:groups.length,included_question_groups:groups.length,source_detail_status:'available',detail_status:'included'},groups};
  else for(const fact of evidence){fact.provenance='deterministic_result';delete fact.group_ref;delete fact.group_label;}
  return report;
}
function render(report,styled){
  const before=JSON.stringify(report),html=Report.buildAIInterpretation({status:'complete',report});
  check(()=>assert.equal(JSON.stringify(report),before,'Never mutate saved data'));
  check(()=>assert.equal(html.includes('class="mr-experience-evidence"'),styled));
  check(()=>assert(html.includes('&lt;private-note&gt; &amp; full text.')));
  check(()=>assert(!html.includes('<private-note>')));
  check(()=>assert(!/citation_closure|PRIVATE-METADATA|G[1-9]\d*|X1|F999/.test(html),'Private graph IDs/metadata are not display labels'));
  return html;
}
for(const size of [12,13,24,25,47,48])render(fixture(size),true);
for(const size of [12,13,48])render(fixture(size,{campaign:false}),size===12);
render(fixture(49),false);
const invalid=[
  ['fake result kind',r=>{delete r.campaign_answer_evidence;r.report_kind='campaign_synthesis';r.source_mode='campaign';}],
  ['unknown channel',r=>{r.campaign_answer_evidence.version='forged';}],
  ['personal and campaign',r=>{r.source_evidence={version:'personal-source-evidence-20260912.1'};}],
  ['missing denominator citation',r=>{r.interpretation.observations[0].evidence_ids=r.interpretation.observations[0].evidence_ids.filter(id=>id!=='F1');}],
  ['wrong denominator ownership',r=>{r.campaign_answer_evidence.groups[0].measures.answered_responses='F3';}],
  ['invalid answer count',r=>{r.evidence[1].value=11;}],
  ['missing evidence',r=>{r.evidence.shift();}],
  ['duplicate group',r=>{r.campaign_answer_evidence.groups[1]=structuredClone(r.campaign_answer_evidence.groups[0]);}],
  ['wrong recorded question label',r=>{r.campaign_answer_evidence.groups[0].label='PRIVATE-METADATA';}],
  ['unmatched evidence provenance',r=>{r.evidence[1].group_ref='G999';}],
  ['unavailable context',r=>{r.campaign_answer_evidence.coverage.source_detail_status='unavailable';}],
  ['invalid coverage',r=>{r.campaign_answer_evidence.coverage.included_question_groups=0;}],
  ['duplicate ID',r=>{r.interpretation.observations[0].evidence_ids[1]='X1';}],
  ['unknown ID',r=>{r.interpretation.observations[0].evidence_ids[1]='F888';}],
  ['two accounts',r=>{r.experiential_evidence.push({...r.experiential_evidence[0],id:'X2'});r.interpretation.observations[0].evidence_ids.push('X2');}],
  ['changed account',r=>{r.interpretation.observations[0].experiential_block.text='Shortened';}],
  ['private account property',r=>{r.experiential_evidence[0].email='PRIVATE-METADATA';}],
  ['unknown block version',r=>{r.interpretation.observations[0].experiential_block.version='forged';}],
];
for(const [name,change]of invalid){const r=fixture(24);change(r);try{render(r,false);}catch(error){error.message=name+': '+error.message;throw error;}}
// A valid campaign graph retained by another field also supports this item's
// extended known nongroup references, matching the server projection contract.
const unrelated=fixture(24);unrelated.interpretation.observations[0].evidence_ids=['X1'];
for(let n=100;n<123;n++){const id='F'+n;unrelated.evidence.push({id,label:'Synthetic measure',value:n,provenance:'deterministic_result'});unrelated.interpretation.observations[0].evidence_ids.push(id);}
render(unrelated,true);
console.log(JSON.stringify({status:'campaign_experience_reference_display_passed',checks,networkCalls:0,artifactWrites:0,providerCalls:0,publicationApproved:false}));
