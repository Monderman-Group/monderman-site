// PUBLIC, data-only browser fixture. These scripted display states do not
// calculate readiness, validate a population, or reproduce any private engine.
import assert from 'node:assert/strict';
// Scripted presentation states only. These do not calculate eligibility or
// select interventions; the production API remains authoritative.
export function campaignCopyScenarios(){
  const check=(id,label,status,detail)=>({id,label,status,detail});
  const section=(status,rows)=>({status,rows});
  const make=(id,band,status,options=[],notice=false)=>({id,notice,options,
    readiness:{
      depth:{...section(status,[check('depth_evidence','MOCK campaign evidence',status,'Scripted campaign evidence state.')]),lenses:[{lens:'decision_velocity',status,coverage:{numerator:12,denominator:12},bounds:{stableBand:band?{id:band,label:band}:null},rows:[]}]},
      crossLens:section('in_progress',[check('cross_evidence','MOCK cross-lens evidence','in_progress','Scripted additional lens requirement.')]),
      recommendedPath:section('in_progress',[
        check('source_result_identity','Exact saved-result identity','satisfied','Bind the review to a server-calculated hash of each saved measurement result.'),
        check('corroboration','Reviewed operational evidence','in_progress','An authorized review must link operational evidence to the selected action.')])
    }});
  const options=['limited','moderate','structural'].map(intensity=>({id:`mock_${intensity}`,intensity,action:'MOCK action for display testing only.',prerequisite:'MOCK prerequisite; not an engine recommendation.'}));
  return [make('light-no-alternatives','light','satisfied',[],true),make('compounding-no-alternatives','compounding','satisfied',[],true),make('not-ready','light','in_progress'),make('unavailable-band',null,'satisfied'),make('heavy-without-options','heavy','satisfied'),make('options-available','heavy','satisfied',options)];
}

export function assertCampaignReadinessCopy(html,{readiness,options,notice}){
  const cards=html.match(/<section class="ca-card">[\s\S]*?<\/section>/g)||[];
  assert.equal(cards.length,3,'Retain all three actual readiness sections');
  const card=cards[2],checks=readiness.recommendedPath.rows;
  assert.match(card,new RegExp('class="ca-state ca-'+readiness.recommendedPath.status+'"'),'Copy must not grant a different readiness state');
  assert.ok(card.includes(`${checks.filter(r=>r.status==='satisfied').length} of ${checks.length} checks satisfied`),'Preserve actual check counts');
  assert.equal(card.includes('data-ca-no-alternatives'),notice,'Favorable explanation requires ready evidence and an explicit empty option list');
  if(notice)assert.ok(card.includes('No change alternatives are offered for this result; ordinary next steps remain available.'));
  if(checks.some(r=>r.id==='source_result_identity')){
    assert.ok(card.includes('Current saved evidence'),'Map the actual server row identifier to plain language');
    assert.ok(card.includes('If the underlying evidence changes, the recommendation must be reviewed again.'));
    assert.ok(!card.includes('server-calculated hash'),'Do not expose the obsolete technical checklist explanation');
  }
  for(const row of checks.filter(r=>r.id!=='source_result_identity'))assert.ok(card.includes(row.label),'Retain underlying checklist labels');
  assert.ok(Array.isArray(options));
}
export function createCampaignUiMock({scope,getRecords}){
  const state=(status,detail)=>({status,rows:[{id:'mock-display-check',label:'MOCK display check',status,detail}]});
  const readiness=()=>({evidenceDigest:'a'.repeat(64),
    depth:{...state('satisfied','Scripted satisfied state for layout testing only.'),lenses:[{lens:'decision_velocity',coverage:{numerator:12,denominator:12},rows:[]}]},
    crossLens:state('in_progress','Scripted incomplete state for layout testing only.'),
    recommendedPath:state('needs_attention','Scripted review-needed state for layout testing only.')});
  return {
    current:()=>({readiness:readiness(),options:[],quality:{statement:'MOCK UI data. No actual response quality or readiness has been assessed.',rows:getRecords().map(r=>({runId:r.runId,lens:r.lens,inclusionStatus:r.status,needsReview:false,flags:[{status:'unknown',label:'MOCK check unavailable',detail:'Unknown is displayed without implying a defective response.'}]}))}}),
    preview:decisions=>{
      assert.equal(decisions.length,1,'This public UI fixture scripts one inclusion change only');
      const decision=decisions[0];assert.equal(decision.runId,getRecords()[0].runId);assert.equal(decision.action,'exclude');assert.ok(decision.reason.trim());
      return {changes:[{runId:decision.runId,after:{status:'excluded'}}],before:readiness(),after:{...readiness(),depth:state('in_progress','MOCK after-review state, not an engine calculation.')}};
    }
  };
}
