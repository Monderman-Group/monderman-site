import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadEvidenceApi,verifyEvidenceFixture} from './evidence_api_fixture.mjs';
import {createCampaignUiMock,campaignCopyScenarios,assertCampaignReadinessCopy} from './campaign_ui_mock_fixture.mjs';
const base=process.env.SAMPLE_BASE||'http://127.0.0.1:8784';
const out=process.env.SAMPLE_OUT||'/tmp/monderman-campaign-experience';
const privateMode=Boolean(process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR);
const api=privateMode?await loadEvidenceApi():null;
const sourceCommit=privateMode?verifyEvidenceFixture(process.env.MONDERMAN_EVIDENCE_FIXTURE_DIR).manifest.source_commit:null;
const uiSource=fs.readFileSync(new URL('../campaign-analysis.js',import.meta.url),'utf8');
const workspaceSource=fs.readFileSync(new URL('../workspace-analysis.html',import.meta.url),'utf8');
const {readinessCards}=await import('data:text/javascript;base64,'+Buffer.from(uiSource).toString('base64'));
const copyCases=campaignCopyScenarios();
for(const scenario of copyCases){const before=JSON.stringify(scenario);assertCampaignReadinessCopy(readinessCards(scenario.readiness,scenario.options),scenario);assert.equal(JSON.stringify(scenario),before,'Presentation must not mutate readiness or options');}
for(const change of [r=>r.depth.lenses=[],r=>delete r.depth.lenses[0].status,r=>r.depth.lenses.push({...r.depth.lenses[0],bounds:{stableBand:{id:'heavy'}}})]){const r=structuredClone(copyCases[0].readiness);change(r);assert.ok(!readinessCards(r,[]).includes('data-ca-no-alternatives'),'Incomplete or mixed evidence must not be described as favorable');}
assert.ok(!readinessCards(copyCases[0].readiness).includes('data-ca-no-alternatives'),'An unavailable option response is not an empty option list');
assert.ok(workspaceSource.includes('Personal Cross-Lens Synthesis never publishes a Composite Score.'));
assert.ok(workspaceSource.includes('Personal Depth Synthesis may show the median of your selected scores when the runs cover compatible work, dates, versions and perspectives.'));
assert.ok(workspaceSource.includes('Personal runs do not establish campaign readiness or unlock a Cross-Lens Composite Score, organizational change alternatives or a recommended path.'));
assert.ok(!workspaceSource.includes('what actions could unlock one'),'Do not tell a personal-run user to unlock a forbidden Composite Score');
fs.mkdirSync(out,{recursive:true});
const scope={id:'11111111-1111-4111-8111-111111111111',organizationId:'22222222-2222-4222-8222-222222222222',label:'Support escalation decisions',campaignIds:['33333333-3333-4333-8333-333333333333'],sharedScopeConfirmed:true,window:{start:'2026-09-01T00:00:00Z',end:'2026-09-30T23:59:59Z'},population:{size:12,locked:true,source:'sponsor_declared'},requiredGroups:[{id:'operational',label:'People doing the work',populationSize:6},{id:'managerial',label:'Managers',populationSize:6}],lenses:{decision_velocity:{configVersion:'1.1.0',scorerVersion:'test-scorer'}}};
let records=Array.from({length:12},(_,i)=>({runId:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,organizationId:scope.organizationId,campaignId:scope.campaignIds[0],lens:'decision_velocity',configVersion:'1.1.0',scorerVersion:'test-scorer',completedAt:'2026-09-11T10:00:00Z',participantKey:`test-person-${i}`,identitySource:'server_bound',eligibleParticipant:true,groupId:i<6?'operational':'managerial',score:54+i%4,status:'included',sourceResultDigest:'a'.repeat(64)}));
let revision=0,applyCalls=0,displayCase=null;
const mock=createCampaignUiMock({scope,getRecords:()=>records});
const current=()=>{const readiness=privateMode?api.evaluateCampaignReadiness({scope,records}):null;return {ok:true,scope,snapshot:String(revision).padStart(64,'0'),audit:[],...(privateMode?{readiness,quality:api.reviewCampaignQuality({scope,records}),options:api.campaignInterventionOptions(readiness)}:mock.current())};};
const previewFor=body=>privateMode?api.createCampaignReviewPreview({scope,records,decisions:body.decisions,actorId:'test-admin',expectedEvidenceDigest:body.evidenceDigest,reviewedAt:'2026-09-11T10:00:00Z'}):mock.preview(body.decisions);
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();if(url.hostname!=='mock.monderman.invalid')return route.abort();
  const body=route.request().postDataJSON(),pathname=url.pathname;let result;
  if(pathname.endsWith('/quality-preview')){result={ok:true,preview:previewFor(body)};}
  else if(pathname.endsWith('/quality-apply')){applyCalls++;const preview=previewFor(body);records=records.map(r=>({...r,...(preview.changes.find(c=>c.runId===r.runId)?.after||{})}));revision++;result=current();}
  else if(pathname.includes('/scopes/'))result=displayCase?{...current(),readiness:displayCase.readiness,options:displayCase.options}:current();
  else result={ok:true,campaigns:[{id:scope.campaignIds[0],name:'Support decisions',tool_type:'decision_velocity'}],scopes:[{id:scope.id,label:scope.label,campaignIds:scope.campaignIds}]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
});
assert.equal(await (await page.request.get(`${base}/campaign-analysis.js`)).text(),uiSource,'Serve the exact candidate whose copy assertions were tested');
let copyBrowserStates=0,copyScreenshots=0;
for(const width of [1440,834,390,320]){
  displayCase=null;
  await page.setViewportSize({width,height:1000});await page.goto(`${base}/campaign-analysis.css`); // Same-origin, no application authentication or production calls.
  await page.evaluate(({base,org})=>{document.body.innerHTML='<main style="max-width:1200px;margin:24px auto;padding:0 12px"><section id="preview"></section></main>';document.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+base+'/campaign-analysis.css"><style>@font-face{font-family:NHG;src:url('+base+'/55font.woff2)}body{font-family:NHG,Arial,sans-serif;margin:0;background:#f5f7f6;--text:#183f47;--muted:#53676e;--line:#dce5e8;--panel:#fff;--bg:#fff}</style>';return import(base+'/campaign-analysis.js').then(({mountCampaignAnalysis})=>{window.testMount=mountCampaignAnalysis({element:document.getElementById('preview'),organizationId:org,role:'admin',apiBase:'https://mock.monderman.invalid',getToken:async()=>'mock-only',onReport:async()=>{window.testBuilds=(window.testBuilds||0)+1;}});});},{base,org:scope.organizationId});
  await page.locator('.ca-cards').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(privateMode=>{const label=document.createElement('p');label.dataset.testOnly='mock';label.textContent=privateMode?'MOCK transport — private engine-backed local display test, not a live service.':'MOCK UI DATA — scripted display states only; no readiness engine was run.';label.style='margin:12px;padding:12px;border:2px solid #805000;background:#fff4d6;font:14px Arial';document.body.prepend(label);},privateMode);
  assert.equal(await page.locator('.ca-card').count(),3);assert.equal(await page.locator('[data-ca-quality]').innerText(),'Check response quality');
  assert(await page.locator('.ca-card').nth(0).innerText().then(t=>t.includes('Satisfied')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`panel overflow ${width}`);
  await page.screenshot({path:path.join(out,`campaign-${width}.png`),fullPage:true});
  await page.locator('[data-ca-quality]').click();await page.locator('[data-ca-run] summary').first().click();await page.locator('[data-ca-decision]').first().selectOption('exclude');await page.locator('[data-ca-reason]').first().fill('Duplicate response confirmed with campaign record');
  await page.getByRole('button',{name:'Preview changes',exact:true}).click();await page.locator('[data-ca-apply]').waitFor();
  if(width===834){
    await page.locator('[data-ca-reason]').first().fill('Corrected review reason after checking the campaign record');
    assert.equal(await page.locator('[data-ca-apply]').count(),0,'changing a reviewed decision must invalidate the preview');
    await page.getByRole('button',{name:'Preview changes',exact:true}).click();await page.locator('[data-ca-apply]').waitFor();
  }
  assert(await page.locator('.ca-comparison').innerText().then(t=>t.includes('Before')&&t.includes('After')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`quality overflow ${width}`);
  await page.screenshot({path:path.join(out,`quality-${width}.png`),fullPage:true});
  if(width===390){await page.locator('[data-ca-apply]').dblclick();await page.getByRole('status').filter({hasText:'Review applied'}).waitFor();assert.equal(applyCalls,1,'doubletap applied twice');assert.equal(records[0].score,54,'review changed score');}
  await page.locator('[data-ca-define]').click();await page.locator('[data-ca-form]').waitFor({state:'visible'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`scope form overflow ${width}`);await page.screenshot({path:path.join(out,`definition-${width}.png`),fullPage:true});
  for(const scenario of copyCases){
    displayCase=scenario;await page.evaluate(()=>window.testMount.refresh());await page.locator('.ca-cards').waitFor();
    await page.locator('[data-test-only="mock"]').evaluate(el=>{el.textContent='MOCK UI DATA — scripted copy states only; no readiness engine was run for these states.';});
    assertCampaignReadinessCopy(await page.locator('.ca-cards').evaluate(el=>el.outerHTML),scenario);
    const recommended=page.locator('.ca-card').nth(2);
    assert.equal(await recommended.locator(':scope > .ca-checks').count(),scenario.notice?0:1,'Favorable results explain unavailable alternatives instead of requesting an impossible review');
    assert.equal(await page.locator('[data-ca-review]').isDisabled(),scenario.options.length===0,'Copy does not change the action-review gate');
    assert.equal(await page.locator('[data-ca-build]').innerText(),scenario.readiness.depth.status==='satisfied'?'Build Depth Synthesis':'View response comparison','Keep the existing report gate');
    if(scenario.options.length){await page.locator('[data-ca-review]').click();assert.equal(await page.locator('[data-ca-operating] input[name="optionId"]').count(),3);await page.locator('[data-ca-review-close]').click();assert.equal(await page.locator('[data-ca-build]').isVisible(),true,'Closing review restores report creation');}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`copy state overflow ${scenario.id} ${width}`);
    if(['light-no-alternatives','not-ready','options-available'].includes(scenario.id)){await page.screenshot({path:path.join(out,`copy-${scenario.id}-${width}.png`),fullPage:true});copyScreenshots++;}
    copyBrowserStates++;
  }
}
assert.deepEqual(errors,[]);await browser.close();const hash=source=>createHash('sha256').update(source).digest('hex');const receipt={ok:true,mode:privateMode?'private-engine-mock-transport':'public-ui-mock',sourceCommit,sourceHashes:{'campaign-analysis.js':hash(uiSource),'workspace-analysis.html':hash(workspaceSource),harness:hash(fs.readFileSync(new URL(import.meta.url))),fixture:hash(fs.readFileSync(new URL('./campaign_ui_mock_fixture.mjs',import.meta.url)))},engineReadinessExecuted:privateMode,copyEngineReadinessExecuted:false,rawScorePersistenceVerified:false,widths:[1440,834,390,320],screenshots:12+copyScreenshots,copyBrowserStates,copyPureStates:10,applyCalls,productionCalls:0,checks:'MOCK display states include favorable results, unavailable evidence and available action options; statuses, counts and gates are retained. Preview invalidation, explicit apply, single request on doubletap, unchanged mock score, forms and horizontal overflow. No live API, database persistence or end-to-end integration claim.'};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
