import assert from 'node:assert/strict';

// Execute the production handlers in the existing offline browser-I/O fixture.
// No inbox, database, diagnostic admission, or provider request is possible.
export async function runCampaignPreviewSnapshotChecks({ fixture, previewReady, button, source }) {
  let cases=0;
  const edits=[
    t=>{t.fields.fPath.value='Changed process';},
    t=>{t.fields.fTool.value='decision_velocity';},
    t=>{t.fields.fVantage.value='senior_leader';},
    t=>{t.fields.fDepth.value='30';},
    t=>{t.fields.fMessage.value='Changed message';},
    t=>{t.fields.fDue.value='2026-10-01';},
    t=>{t.fields.fShowResults.checked=false;},
    t=>{t.fields.fAnon.checked=true;},
    ...['email','full_name','business_unit','team'].map(key=>t=>{t.state.recipients[0][key]='Changed';}),
    t=>{t.state.recipients.push({email:'second@example.test'});},
    t=>{t.state.recipients=[];},
    t=>{t.state.orgId='different_org';},
  ];
  for(const edit of edits){
    const t=fixture(); await previewReady(t); edit(t);
    // Even a missing input event cannot dispatch a payload not previewed.
    await t.doSend();
    assert.equal(t.calls.requests.length,1,'changed payload must not reach send');
    button(t,'btnSend','Send campaign',true);
    assert.equal(t.state.lastReady,0); cases++;
  }
  {
    const t=fixture(); await previewReady(t);
    t.invalidateCampaignPreview();
    button(t,'btnSend','Send campaign',true);
    assert.equal(t.state.campaignSendKey,null);
    assert.equal(t.state.previewMaterial,null);
    cases++;
  }
  for(const mode of ['event','material-only','changed-back']){
    const t=fixture(); const response=t.response('preview',{held:true});
    const pending=t.doPreview(); await response.started;
    const before=t.fields.fPath.value;
    t.fields.fPath.value='Edited during preview';
    if(mode!=='material-only')t.invalidateCampaignPreview();
    if(mode==='changed-back')t.fields.fPath.value=before;
    response.release(); await pending;
    button(t,'btnPreview','Preview',false);
    button(t,'btnSend','Send campaign',true);
    assert.match(t.fields.previewOut.innerHTML,/campaign changed/);
    await t.doSend(); assert.equal(t.calls.requests.length,1);
    await previewReady(t); cases++;
  }
  {
    const t=fixture(); const response=t.response('preview',{held:true});
    const pending=t.doPreview(); await response.started;
    await t.doPreview(); await t.doSend();
    assert.equal(t.calls.requests.length,1,'double preview and send while previewing cannot dispatch');
    response.release(); await pending; cases++;
  }
  {
    const t=fixture(); await previewReady(t);
    const response=t.response('send',{held:true,data:{ok:true,queued_count:1}});
    const pending=t.doSend(); await response.started;
    await t.doSend(); await t.doPreview();
    assert.equal(t.calls.requests.length,2,'double send/preview while sending cannot duplicate dispatch');
    response.release(); await pending;
    assert.equal(t.calls.clearDraft,1); cases++;
  }
  {
    const t=fixture(); await previewReady(t); const oldKey=t.state.campaignSendKey;
    const response=t.response('send',{held:true,status:503,data:{ok:false,error:'controlled_failure'}});
    const pending=t.doSend(); await response.started;
    t.state.recipients[0].email='second@example.test'; t.invalidateCampaignPreview();
    response.release(); await pending;
    button(t,'btnSend','Send campaign',true);
    await t.doSend(); assert.equal(t.calls.requests.length,2);
    await previewReady(t); assert.notEqual(t.state.campaignSendKey,oldKey,'changed payload receives its own identity after fresh preview');
    const csv=await t.calls.requests[1].options.body.get('file').text();
    assert.match(csv,/controlled@example\.test/); assert.doesNotMatch(csv,/second@example/);
    cases++;
  }
  {
    const t=fixture(); await previewReady(t); const oldKey=t.state.campaignSendKey;
    t.response('send',{error:'controlled_timeout'}); await t.doSend();
    t.invalidateCampaignPreview(); await previewReady(t);
    assert.equal(t.state.campaignSendKey,oldKey,'unchanged payload retains original identity after timeout and repreview');
    cases++;
  }
  {
    const t=fixture(); await previewReady(t);
    const response=t.response('send',{held:true,data:{ok:true,queued_count:1}});
    const pending=t.doSend(); await response.started;
    t.fields.fPath.value='New unsent draft'; t.invalidateCampaignPreview();
    response.release(); await pending;
    assert.equal(t.calls.clearDraft,0,'successful prior send must not delete newer draft edits');
    assert.equal(t.calls.scheduleSave,1);
    assert.equal(t.fields.fPath.value,'New unsent draft');
    button(t,'btnSend','Send campaign',true); cases++;
  }
  {
    const t=fixture(); await previewReady(t); t.fields.fPath.value='';
    await t.doPreview(); button(t,'btnSend','Send campaign',true);
    await t.doSend(); assert.equal(t.calls.requests.length,1,'failed local preview invalidates old readiness');
    cases++;
  }
  assert.match(source,/state\.recipients\[i\]\[t\.dataset\.f\]=t\.value; invalidateCampaignPreview\(\)/);
  assert.match(source,/function renderRecipients\(\)\{\s*invalidateCampaignPreview\(\)/);
  assert.match(source,/for\(const type of \["input","change"\]\) el\.addEventListener\(type,\(\)=>\{invalidateCampaignPreview\(\); scheduleSave\(\);\}\)/);
  cases++;
  console.log(`Campaign preview snapshot: ${cases} isolated scenarios passed; production network calls 0.`);
}
