// PUBLIC, data-only browser fixture. These scripted display states do not
// calculate readiness, validate a population, or reproduce any private engine.
import assert from 'node:assert/strict';
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
