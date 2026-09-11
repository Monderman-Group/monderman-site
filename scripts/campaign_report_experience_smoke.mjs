import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.SAMPLE_BASE||'http://127.0.0.1:8784';
const out=process.env.SAMPLE_OUT||'/tmp/monderman-campaign-experience';
const apiRoot=process.env.MONDERMAN_API_ROOT||path.resolve('../monderman-api-evidence-report-20260911');
const {evaluateCampaignReadiness}=await import(pathToFileURL(path.join(apiRoot,'campaign-evidence-readiness.js')));
const {reviewCampaignQuality,createCampaignReviewPreview}=await import(pathToFileURL(path.join(apiRoot,'campaign-quality-review.js')));
const {campaignInterventionOptions}=await import(pathToFileURL(path.join(apiRoot,'campaign-intervention-options.js')));
fs.mkdirSync(out,{recursive:true});
const scope={id:'11111111-1111-4111-8111-111111111111',organizationId:'22222222-2222-4222-8222-222222222222',label:'Support escalation decisions',campaignIds:['33333333-3333-4333-8333-333333333333'],sharedScopeConfirmed:true,window:{start:'2026-09-01T00:00:00Z',end:'2026-09-30T23:59:59Z'},population:{size:12,locked:true,source:'sponsor_declared'},requiredGroups:[{id:'operational',label:'People doing the work',populationSize:6},{id:'managerial',label:'Managers',populationSize:6}],lenses:{decision_velocity:{configVersion:'1.1.0',scorerVersion:'test-scorer'}}};
let records=Array.from({length:12},(_,i)=>({runId:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,organizationId:scope.organizationId,campaignId:scope.campaignIds[0],lens:'decision_velocity',configVersion:'1.1.0',scorerVersion:'test-scorer',completedAt:'2026-09-11T10:00:00Z',participantKey:`test-person-${i}`,identitySource:'server_bound',eligibleParticipant:true,groupId:i<6?'operational':'managerial',score:54+i%4,status:'included',sourceResultDigest:'a'.repeat(64)}));
let revision=0,applyCalls=0,buildCalls=0;
const current=()=>{const readiness=evaluateCampaignReadiness({scope,records});return {ok:true,scope,readiness,snapshot:String(revision).padStart(64,'0'),quality:reviewCampaignQuality({scope,records}),options:campaignInterventionOptions(readiness),audit:[]};};
const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();if(url.hostname!=='mock.monderman.invalid')return route.abort();
  const body=route.request().postDataJSON(),pathname=url.pathname;let result;
  if(pathname.endsWith('/quality-preview')){result={ok:true,preview:createCampaignReviewPreview({scope,records,decisions:body.decisions,actorId:'test-admin',expectedEvidenceDigest:body.evidenceDigest,reviewedAt:'2026-09-11T10:00:00Z'})};}
  else if(pathname.endsWith('/quality-apply')){applyCalls++;const preview=createCampaignReviewPreview({scope,records,decisions:body.decisions,actorId:'test-admin',expectedEvidenceDigest:body.evidenceDigest,reviewedAt:'2026-09-11T10:00:00Z'});records=records.map(r=>({...r,...(preview.changes.find(c=>c.runId===r.runId)?.after||{})}));revision++;result=current();}
  else if(pathname.includes('/scopes/'))result=current();
  else result={ok:true,campaigns:[{id:scope.campaignIds[0],name:'Support decisions',tool_type:'decision_velocity'}],scopes:[{id:scope.id,label:scope.label,campaignIds:scope.campaignIds}]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
});
for(const width of [1440,834,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto(`${base}/campaign-analysis.css`); // Same-origin, no application authentication or production calls.
  await page.evaluate(({base,org})=>{document.body.innerHTML='<main style="max-width:1200px;margin:24px auto;padding:0 12px"><section id="preview"></section></main>';document.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+base+'/campaign-analysis.css"><style>@font-face{font-family:NHG;src:url('+base+'/55font.woff2)}body{font-family:NHG,Arial,sans-serif;margin:0;background:#f5f7f6;--text:#183f47;--muted:#53676e;--line:#dce5e8;--panel:#fff;--bg:#fff}</style>';return import(base+'/campaign-analysis.js').then(({mountCampaignAnalysis})=>{window.testMount=mountCampaignAnalysis({element:document.getElementById('preview'),organizationId:org,role:'admin',apiBase:'https://mock.monderman.invalid',getToken:async()=>'mock-only',onReport:async()=>{window.testBuilds=(window.testBuilds||0)+1;}});});},{base,org:scope.organizationId});
  await page.locator('.ca-cards').waitFor();await page.evaluate(()=>document.fonts.ready);
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
}
assert.deepEqual(errors,[]);await browser.close();console.log(JSON.stringify({ok:true,widths:[1440,834,390,320],screenshots:12,applyCalls,productionCalls:0,checks:'Readiness states, scoped preview, explicit apply, doubletap, raw score preservation, forms and horizontal overflow. Browser uses mocked API; not a live integration certification.'}));
