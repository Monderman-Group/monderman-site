// LOCAL CONTRACT TEST: real built pages, browser events, and rendering; synthetic
// API/auth/email responses. This is not evidence of production signup/delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from 'playwright';

const root = path.resolve('.render-public');
const output = path.resolve(process.env.DV_JOURNEY_OUT || 'output/dv-journey-browser');
const releaseChannel=JSON.parse(fs.readFileSync(path.join(root,'.well-known/monderman-questionnaire-release.json'))).channel;
assert.ok(['legacy','current'].includes(releaseChannel));
fs.mkdirSync(output, {recursive:true});
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon','.pdf':'application/pdf'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  let body = fs.readFileSync(file);
  if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const savedId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const capability = 'a'.repeat(43);
const sample = JSON.parse(fs.readFileSync('sample-data/production-diagnostic-samples.json')).outputs.decision_velocity;
const answer = (id,type,options=[]) => ({id,questionType:type,dimension:'approval',isOptional:false,text:{managerial:id,operational:id,senior_leader:id},options:options.map(value=>({value,label:value}))});
const questions = {route:answer('route','single_select',['slow','fast']),count:answer('count','numeric'),detail:answer('detail','single_select',['yes','no']),last:answer('last','numeric'),alternate:answer('alternate','numeric')};
const fixtureAuth = `(() => {
  const callbacks=[];
  const user={id:'11111111-1111-4111-8111-111111111111',email:'local-fixture@example.test'};
  const session=()=>sessionStorage.getItem('fixture.signedIn')?{access_token:'fixture-token',user}:null;
  const auth={getSession:async()=>({data:{session:session()}}),getUser:async()=>({data:{user:session()?.user||null}}),onAuthStateChange:fn=>{callbacks.push(fn);return{data:{subscription:{unsubscribe(){}}}}},signInWithOtp:async()=>({error:null}),verifyOtp:async()=>{sessionStorage.setItem('fixture.signedIn','1');const s=session();callbacks.forEach(fn=>fn('SIGNED_IN',s));return{data:{session:s,user},error:null}},signOut:async()=>{sessionStorage.removeItem('fixture.signedIn');callbacks.forEach(fn=>fn('SIGNED_OUT',null));return{error:null}}};
  window.__fixtureAuth={auth}; window.supabase={createClient:()=>window.__fixtureAuth};
})();`;
const gate = `window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId=sessionStorage.getItem('fixture.signedIn')?'22222222-2222-4222-8222-222222222222':null;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:sessionStorage.getItem('fixture.signedIn')?'workspace':'public_first_run'});window.__mondermanReveal?.();`;
const results=[];
const browsers=[];
try {
for (const [browserName,type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser = await type.launch({headless:true});
  browsers.push(browser);
  console.log(`${browserName}: beginning local journey`);
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript({content:fixtureAuth});
  const page = await context.newPage();
  const errors=[];
  const footerEvidence=[];
  page.on('pageerror', e=>errors.push(e.message));
  let starts=0,revision=1,finalized=false,history=[],commits=0,finalizations=0,legalAccepted=false,denySavedReport=false,delaySavedReport=false;
  let questionnaireVersion=releaseChannel==='current'?'1.1.0':'1.0.0';
  let responseVersionOverride=null,versionUnavailableResponse=false;
  let failAnswerAck=true,failRevisionAck=true,failAlternate=2,failFinalize=true,rejectCountOnce=true;
  const requests=[],receipts=new Map();
  const next = () => {
    if(finalized)return null;
    if(!history.length)return questions.route;
    if(history[0].value==='fast')return history.length===1?questions.alternate:null;
    return [questions.route,questions.count,questions.detail,questions.last][history.length]||null;
  };
  const versionMetadata = () => responseVersionOverride || ({questionnaire_version:questionnaireVersion,routingVersion:questionnaireVersion,configVersion:questionnaireVersion});
  const snapshot = extra => ({ok:true,runId,role:'managerial',depth:10,...versionMetadata(),sessionRevision:revision,nextItem:next(),shouldStop:!next(),finalized,answerHistory:history.map(e=>({...e,item:questions[e.itemId]})),progress:{answeredCount:history.length},...extra});
  const json=(route,status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  await context.route('**/workspace-access-gate.js*',route=>route.fulfill({contentType:'application/javascript',body:gate}));
  await context.route('**/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:'/* auth fixture installed before page */'}));
  // Every service mutation is intercepted; no production admission/email/report.
  await context.route('https://monderman-api.onrender.com/**',async route=>{
    const req=route.request(), url=new URL(req.url());
    const data=req.postData()?JSON.parse(req.postData()):{};
    requests.push({path:url.pathname,body:data,method:req.method()});
    if(url.pathname==='/api/first-run-events')return json(route,202,{ok:true});
    if(url.pathname==='/api/legal/acceptance/status')return json(route,200,{ok:true,requiresAcceptance:!legalAccepted,termsVersion:'2026-08-26-beta',privacyNoticeVersion:'2026-08-26-beta'});
    if(url.pathname==='/api/legal/acceptance'){assert.equal(data.agreed,true);legalAccepted=true;return json(route,200,{ok:true});}
    if(url.pathname==='/api/health')return json(route,200,{ok:true});
    if(url.pathname===`/api/runs/${savedId}/report`){
      if(delaySavedReport)await new Promise(r=>setTimeout(r,500));
      const allowed=!!req.headers().authorization&&!denySavedReport;
      return json(route,allowed?200:403,{ok:allowed,runId:savedId,...(allowed?{result:sample.result}:{})});
    }
    if(url.pathname.endsWith('/run/start')){assert.equal(data.questionnaire_copy_version,releaseChannel==='current'?'diagnostic-language-20260908':undefined);starts++;return json(route,200,snapshot({sessionCapability:capability}));}
    if(req.method()==='GET'&&url.pathname.endsWith('/run/'+runId))return versionUnavailableResponse ? json(route,409,{ok:false,error:'QUESTIONNAIRE_VERSION_UNAVAILABLE'}) : json(route,200,snapshot());
    if(url.pathname.endsWith('/answer')){
      if(data.itemId==='count'&&rejectCountOnce){rejectCountOnce=false;return json(route,400,{ok:false,error:'invalid_numeric_answer'});}
      const old=history.find(e=>e.itemId===data.itemId);
      if(old&&JSON.stringify(old.value)===JSON.stringify(data.value))return json(route,200,snapshot({idempotentReplay:true}));
      if(data.itemId==='alternate'&&failAlternate-->0)return json(route,503,{ok:false});
      if(data.expectedRevision!==revision||data.itemId!==next()?.id)return json(route,409,{ok:false,error:'stale_run_revision'});
      history.push({itemId:data.itemId,value:data.value,meta:data.meta});revision++;commits++;
      if(failAnswerAck){failAnswerAck=false;return route.abort('failed');}
      await new Promise(r=>setTimeout(r,180));
      return json(route,200,snapshot());
    }
    if(url.pathname.endsWith('/revise')){
      if(receipts.has(data.mutationId))return json(route,200,snapshot({idempotentReplay:true,revision:receipts.get(data.mutationId)}));
      if(data.expectedRevision!==revision)return json(route,409,{ok:false,error:'stale_run_revision'});
      const index=history.findIndex(e=>e.itemId===data.itemId);
      assert.ok(index>=0);
      assert.deepEqual(data.expectedValue,history[index].value);
      const change={mutationId:data.mutationId,itemId:data.itemId,removedItemIds:history.slice(index+1).map(e=>e.itemId)};
      history=history.slice(0,index+1);history[index]={itemId:data.itemId,value:data.value,meta:data.meta};revision++;commits++;receipts.set(data.mutationId,change);
      if(failRevisionAck){failRevisionAck=false;return route.abort('failed');}
      return json(route,200,snapshot({revision:change}));
    }
    if(url.pathname.endsWith('/finalize')){
      finalizations++;
      if(failFinalize){failFinalize=false;return json(route,503,{ok:false,error:'temporary_test_failure'});}
      if(data.expectedRevision!==revision)return json(route,409,{ok:false,error:'stale_run_revision'});
      finalized=true;
      if(!req.headers().authorization)return json(route,200,{ok:true,...versionMetadata(),locked:true,reason:'signup_required',teaser:{score:sample.result.score,band:sample.result.score_band},message:'Create a free account to unlock the full report.'});
      return json(route,200,{ok:true,...versionMetadata(),savedRunId:savedId,result:sample.result,legacyPayload:sample.input_context});
    }
    return json(route,200,{ok:true});
  });
  await context.route('https://ptkxrzgmeldalrkfruth.supabase.co/**',route=>{throw new Error('Unexpected real auth call: '+route.request().method());});
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('.hero-actions a[href="decision-velocity.html?source=homepage"]').click();
  await page.locator('[data-lane="managerial"]').click();await page.locator('#laneContinueBtn').click();
  await page.locator('[data-depth="10"]').click();await page.locator('#depthContinueBtn').click();
  await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
  const values={processName:'Fabricated regression decision',businessUnit:'Local test only',description:'No production customer data.',employeeCount:'250',peopleInvolved:'8',hourlyCost:'90',annualVolume:'24',meetingHours:'3'};
  const choices={industry:'technology_software',regulatoryIntensity:'moderate',decisionType:'program'};
  for(let i=0;i<11;i++){
    const field=page.locator('#preflightContextMount .field:visible'),id=await field.getAttribute('data-field-id');
    if(choices[id])await field.locator(`[data-val="${choices[id]}"]`).click();else await field.locator('input,textarea').first().fill(values[id]);
    await page.locator('.preflight-next').click();
  }
  async function question(id){await page.waitForFunction(id=>document.querySelector('#questionTitle')?.textContent===id,id);await page.waitForTimeout(190);}
  async function pick(label,double=false){const b=page.locator('#questionBody .choice').filter({hasText:label});if(double)await b.evaluate(el=>{el.click();el.click();});else await b.click();}
  async function numeric(value,double=false){await page.locator('#questionBody input').fill(value);if(double)await page.locator('#continueBtn').evaluate(el=>{el.click();el.click();});else await page.locator('#continueBtn').click();}
  await question('route');console.log(`${browserName}: intake passed`);await pick('slow',true);await question('count');
  assert.equal(history.length,1);assert.equal(starts,1);
  await numeric('abc');assert.equal(history.length,1,'invalid numeric must not send');
  await numeric('5',true);await page.waitForFunction(()=>document.querySelector('#requiredNotice')?.textContent.includes('That answer was not accepted'));
  assert.equal(requests.filter(e=>e.path.endsWith('/answer')&&e.body.itemId==='count').length,1,'validation errors must not auto-retry');
  await numeric('5',true);await question('detail');
  async function expectBlockedMutation(action, suffix, restoredQuestion) {
    const before=requests.filter(e=>e.path.endsWith(suffix)).length;
    responseVersionOverride={questionnaire_version:questionnaireVersion,configVersion:'unknown-after-accepted-mutation'};
    await action();
    await page.waitForFunction(()=>document.querySelector('#questionTitle')?.textContent==='Your saved questionnaire needs verification');
    await page.waitForTimeout(400);
    assert.equal(requests.filter(e=>e.path.endsWith(suffix)).length,before+1,suffix+': copy conflict must not auto-retry an accepted mutation');
    assert.equal(await page.locator('#questionBody input,#questionBody textarea,#questionBody .choice').count(),0,suffix+': no incompatible question');
    assert.equal(await page.locator('#continueBtn').isDisabled(),true);
    assert.equal(starts,1,suffix+': no replacement admission');
    responseVersionOverride=null;
    await page.reload({waitUntil:'domcontentloaded'});await question(restoredQuestion);
    assert.equal(starts,1,suffix+': recover the same saved run');
  }
  await expectBlockedMutation(()=>pick('yes'),'/answer','last');
  await page.locator('#backBtn').click();await question('detail');await page.locator('#backBtn').click();await question('count');
  await numeric('6',true);await question('detail');
  assert.deepEqual(history.map(e=>e.itemId),['route','count']);assert.equal(history[1].value,6);
  const edits=requests.filter(e=>e.path.endsWith('/revise'));assert.equal(edits.length,2);assert.equal(edits[0].body.mutationId,edits[1].body.mutationId);
  await page.locator('#backBtn').click();await question('count');await numeric('6');await question('detail');assert.equal(requests.filter(e=>e.path.endsWith('/revise')).length,2,'unchanged review sends no edit');
  await page.locator('#backBtn').click();await question('count');await page.locator('#backBtn').click();await question('route');
  await expectBlockedMutation(()=>pick('fast',true),'/revise','alternate');
  assert.deepEqual(history.map(e=>e.itemId),['route']);
  console.log(`${browserName}: answer revisions passed`);
  // Simulate a lost finalize/edit race: local phase cannot override server nextItem.
  await page.evaluate(()=>{const key='monderman.dvJourney.v1';const saved=JSON.parse(sessionStorage.getItem(key));saved.phase='finalizing';saved.state.preflight.confidenceLevel='high';sessionStorage.setItem(key,JSON.stringify(saved));});
  await page.reload({waitUntil:'domcontentloaded'});await question('alternate');assert.equal(starts,1,'refresh must not start');assert.equal(finalizations,0,'server frontier must outrank stale finalizing phase');
  // A successful HTTP response with unknown/conflicting copy is still unsafe.
  // This path is stopped by the journey helper, before the generic page pin UI.
  const blockedVersionCases=[
    ['unknown',{configVersion:'unknown-fixture-version'}],
    ['known mismatch',{configVersion:questionnaireVersion==='1.1.0'?'1.0.0':'1.1.0'}],
    ['missing',{}],
    ...['questionnaire_version','configVersion','currentVersion','routingVersion','config_version','routingMeta.configVersion'].map(alias=>[
      'conflicting '+alias,
      alias==='routingMeta.configVersion'?{configVersion:questionnaireVersion,routingMeta:{configVersion:'unknown-fixture-version'}}:{questionnaire_version:questionnaireVersion,configVersion:questionnaireVersion,[alias]:'unknown-fixture-version'}
    ]),
    ['backend409',null]
  ];
  for(const [label,metadata] of blockedVersionCases){
    const preservedDraft=await page.evaluate(()=>sessionStorage.getItem('monderman.dvJourney.v1'));
    const writesBeforeUnknown=requests.filter(e=>e.method==='POST'&&/\/run\//.test(e.path)).length;
    responseVersionOverride=metadata;versionUnavailableResponse=label==='backend409';
    await page.reload({waitUntil:'domcontentloaded'});
    const notice=page.locator('#journeyRecoveryNotice[data-reason="questionnaire_version_unavailable"][role="status"]');
    await notice.waitFor({state:'visible'});
    assert.match(await notice.textContent(),/saved answers have not been removed/);
    assert.match(await notice.textContent(),/Refresh to retry/);
    assert.equal(await page.locator('#questionBody input,#questionBody textarea,#questionBody .choice').count(),0,label+': no cached questions');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('monderman.dvJourney.v1')),preservedDraft,label+': preserve exact draft');
    assert.equal(requests.filter(e=>e.method==='POST'&&/\/run\//.test(e.path)).length,writesBeforeUnknown,label+': no mutation or admission');
    assert.equal(await page.locator('#beginBtn').isDisabled(),true,label+': cannot start over implicitly');
    responseVersionOverride=null;versionUnavailableResponse=false;
    await page.reload({waitUntil:'domcontentloaded'});await question('alternate');assert.equal(starts,1);
  }
  await numeric('7');await page.waitForFunction(()=>document.querySelector('#continueBtn')?.textContent==='Try again');
  assert.equal(history.length,1);
  const ambiguousRequests=requests.length;
  await numeric('9');assert.equal(requests.length,ambiguousRequests,'cannot replace an unconfirmed mutation with a new intent');
  await numeric('7');
  await page.locator('#questionBody textarea').waitFor({state:'visible'});
  for(let i=0;i<4;i++){
    if(await page.locator('#questionBody textarea').count()){
      const before=await page.locator('#questionTitle').textContent();
      await page.locator('#skipBtn').click();
      await page.waitForFunction(before=>document.querySelector('#questionTitle')?.textContent!==before,before);
    }else break;
  }
  await page.locator('#questionBody .choice').first().click();
  await page.locator('#retryFinalizeBtn').waitFor({state:'visible'});
  assert.equal(await page.locator('#questionBody').count(),1,'failure must preserve question DOM');
  await page.locator('#retryFinalizeBtn').click();await page.locator('.dv-result-dialog__panel').waitFor({state:'visible'});
  console.log(`${browserName}: completed result passed`);
  assert.equal(starts,1);assert.equal(history.length,2);
  const finalAnswerRequests=requests.filter(e=>/\/(answer|revise)$/.test(e.path)).length;
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.dv-result-dialog__panel').waitFor({state:'visible'});
  assert.equal(requests.filter(e=>/\/(answer|revise)$/.test(e.path)).length,finalAnswerRequests,'completed reload must not answer');
  for(const [width,height] of [[375,667],[390,844],[768,1024],[1024,768],[1440,1000]]){
    await page.setViewportSize({width,height});
    const dialog=page.locator('.dv-result-dialog__panel');
    const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,JSON.stringify(box));
    await dialog.locator('a').last().scrollIntoViewIfNeeded();
    const accessible=await dialog.locator('a').last().evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});assert.ok(accessible,'pilot action reachable without widget cover');
    await page.screenshot({path:path.join(output,`${browserName}-${width}-result.png`)});
    await page.keyboard.press('Escape');
    await page.locator('.mond-footer').scrollIntoViewIfNeeded();
    const footer=await page.locator('.mond-footer').evaluate(el=>({nested:!!el.closest('.environment'),x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth-innerWidth}));
    assert.equal(footer.nested,false);assert.ok(footer.x>=-1&&footer.right<=width+1&&footer.overflow<=1,JSON.stringify(footer));
    const links=page.locator('.mond-footer a');
    for(let i=0;i<await links.count();i++){
      const link=links.nth(i);await link.scrollIntoViewIfNeeded();
      const hit=await link.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {okay:r.x>=0&&r.right<=innerWidth&&el.contains(hit),box:r.toJSON(),hit:hit?.outerHTML.slice(0,350)};});
      if(!hit.okay)await page.screenshot({path:path.join(output,`${browserName}-${width}-footer-failure.png`)});
      assert.ok(hit.okay,`footer link clipped/covered ${await link.getAttribute('href')} at ${width}: ${JSON.stringify(hit)}`);
      const href=await link.getAttribute('href');if(href&&!/^(https?:|mailto:|#)/.test(href))assert.equal((await context.request.get(new URL(href,base).href)).status(),200,href);
    }
    await page.locator('.dv-footer-feedback').click();
    await page.locator('#mdn-fb-panel[aria-hidden="false"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#mdn-fb-panel[aria-hidden="true"]').waitFor();
    const containment=await page.locator('.mond-footer').evaluate(el=>{
      const f=el.getBoundingClientRect(),m=el.querySelector('.mf-motif').getBoundingClientRect();
      return {footer:f.toJSON(),motif:m.toJSON(),contained:m.left>=f.left&&m.right<=f.right&&m.top>=f.top&&m.bottom<=f.bottom};
    });
    assert.ok(containment.contained,`motif outside footer at ${width}: ${JSON.stringify(containment)}`);
    footerEvidence.push({width,height,linkCount:await links.count(),...containment});
    // Expand only the capture canvas vertically when the entire footer is taller
    // than the phone viewport. Link hit tests above use the requested viewport.
    await page.setViewportSize({width,height:Math.max(height,Math.ceil(containment.footer.height)+80)});
    await page.locator('.mond-footer').scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.locator('.mond-footer').screenshot({path:path.join(output,`${browserName}-${width}-footer.png`)});
    await page.setViewportSize({width,height});
    if(width===390){
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.screenshot({path:path.join(output,`${browserName}-390-footer-viewport.png`)});
    }
    await page.locator('#reopenRunResult').click();
  }
  await page.locator('#mdmTeaserSignIn').click();await page.waitForURL(/signin\.html/);
  assert.equal(context.pages().length,1,'handoff must stay in same tab');
  await page.locator('#emailInput').fill('local-fixture@example.test');await page.locator('#emailSubmit').click();
  await page.locator('#otpInput').fill('12345678');await page.locator('#otpSubmit').click();
  await page.locator('#legalAgree').check();await page.locator('#legalSubmit').click();
  await page.waitForURL(/decision-velocity\.html\?(resume=1|saved_report=)/);
  await page.locator('#resultsStage.active').waitFor({timeout:15000});
  assert.equal(starts,1,'sign-in must not consume another admission');
  assert.equal(requests.filter(e=>/\/(answer|revise)$/.test(e.path)).length,finalAnswerRequests);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('monderman.dvJourney.v1')),null,'saved report clears anonymous capability');
  await page.waitForFunction(score=>document.querySelector('#scoreNumber')?.textContent===String(score),sample.result.score);
  assert.equal(await page.locator(`#resultsStage a[href="workspace-diagnostics.html?report=${savedId}"]`).count(),1,'link must identify this saved report');
  const completedFinalizations=finalizations;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#savedReportRecovery .mr-report').waitFor({state:'visible'});
  assert.equal(starts,1);assert.equal(finalizations,completedFinalizations,'saved refresh must read, not re-finalize');
  assert.equal(requests.filter(e=>/\/(answer|revise)$/.test(e.path)).length,finalAnswerRequests);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'saved full report overflows phone');
  for(const label of ['Download full report (HTML)','Print / save PDF']){
    const control=page.getByRole('button',{name:label,exact:true});
    await control.scrollIntoViewIfNeeded();
    const uncovered=await control.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return [5,r.width/2,r.width-5].every(x=>el.contains(document.elementFromPoint(r.x+x,r.y+r.height/2)));
    });
    assert.ok(uncovered,`${label} must be uncovered at both edges and center`);
  }
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download full report (HTML)',exact:true}).click()]);
  assert.match(download.suggestedFilename(),/executive-report\.html$/);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,`${browserName}-full-report.png`),fullPage:true});
  await page.locator('#savedReportRecovery').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:path.join(output,`${browserName}-saved-report-top.png`)});
  await page.getByRole('button',{name:'Download full report (HTML)',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,`${browserName}-saved-report-actions.png`)});
  // A separate unfinished journey cannot be restored by a saved-report URL.
  await page.evaluate(()=>sessionStorage.setItem('monderman.dvJourney.v1',JSON.stringify({unrelated:true})));
  const snapshotsBefore=requests.filter(e=>e.method==='GET'&&e.path.endsWith('/run/'+runId)).length;
  denySavedReport=true;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#retrySavedReport').waitFor({state:'visible'});
  assert.equal(await page.locator('#savedReportRecovery .mr-report').count(),0,'denied report cannot show cached content');
  assert.equal(requests.filter(e=>e.method==='GET'&&e.path.endsWith('/run/'+runId)).length,snapshotsBefore,'saved report must not restore an unrelated journey');
  assert.equal(finalizations,completedFinalizations);assert.equal(starts,1);
  denySavedReport=false;
  await page.locator('#retrySavedReport').click();
  await page.locator('#savedReportRecovery .mr-report').waitFor({state:'visible'});
  await page.evaluate(()=>window.__fixtureAuth.auth.signOut());
  await page.waitForFunction(()=>document.querySelector('#savedReportRecovery')?.textContent.includes('Your account changed'));
  assert.equal(await page.locator('#savedReportRecovery .mr-report').count(),0,'sign-out must clear the rendered report');
  // Also sign out while a previously authorized report request is in flight.
  await page.evaluate(()=>sessionStorage.setItem('fixture.signedIn','1'));
  delaySavedReport=true;
  await Promise.all([page.waitForRequest(r=>r.url().includes(`/api/runs/${savedId}/report`)),page.reload({waitUntil:'domcontentloaded'})]);
  await page.evaluate(()=>window.__fixtureAuth.auth.signOut());
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#savedReportRecovery .mr-report').count(),0,'late response after sign-out must not restore report');
  assert.equal(finalizations,completedFinalizations);assert.equal(starts,1);
  assert.deepEqual(errors,[]);
  results.push({browserName,starts,commits,finalizations,answerRequests:finalAnswerRequests,footerEvidence,passed:true});
  await context.close();await browser.close();
}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({mode:'local mocked API/auth/email; not production',results},null,2));
console.log(JSON.stringify({passed:true,results,output},null,2));
} finally {await Promise.all(browsers.map(browser=>browser.close()));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
