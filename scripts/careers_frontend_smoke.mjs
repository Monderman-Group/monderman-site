/* Synthetic local-only careers checks. Every browser request is fulfilled or blocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {File} from 'node:buffer';
const require=createRequire(import.meta.url), data=require('../careers-role-data.js'), api=require('../careers.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const requestId='00000000-0000-4000-8000-000000000001';
const valid={fullName:'Synthetic Candidate',email:'candidate@example.invalid',workState:'SD',roleInterest:['quality-engineer'],portfolioUrl:'https://example.invalid/work',coverText:'Synthetic local-only fixture.',privacyConsent:true,futureOpportunityAcknowledgement:true,website:'',turnstileToken:'synthetic-token'};
const response=(status,result)=>({status,json:async()=>result});
assert.equal(data.roles.length,20);assert.equal(new Set(data.roles.map(r=>r.id)).size,20);
assert.equal(new Set(data.roles.map(r=>r.title.replace(/ \(position [12]\)$/,''))).size,17);
assert.equal(data.workStates.length,51);
for(const state of ['CA','DC'])assert.ok(data.workStates.some(r=>r.code===state));
for(const state of ['PR','GU','AA','AE','AP'])assert.ok(!data.workStates.some(r=>r.code===state));
assert.deepEqual(api.validateFields(valid),[]);
for(const patch of [{roleInterest:[]},{roleInterest:['quality-engineer','quality-engineer']},{roleInterest:data.roles.slice(0,4).map(r=>r.id)},{roleInterest:['unknown']},{portfolioUrl:'http://example.invalid'},{portfolioUrl:'https://user:secret@example.invalid'},{privacyConsent:false},{futureOpportunityAcknowledgement:false},{email:'broken'},{workState:'unknown'}])assert.ok(api.validateFields({...valid,...patch}).length,'Invalid candidate rejected locally');
const pdf=new File(['%PDF-1.7\nSynthetic test fixture, not a real applicant document.\n%%EOF'],'synthetic-resume.pdf',{type:'application/pdf'});
assert.equal(await api.validatePdf(pdf,true,'Resume'),null);
assert.ok(await api.validatePdf(null,true,'Resume'));
assert.ok(await api.validatePdf(new File(['not a pdf'],'fake.pdf'),true,'Resume'));
assert.ok(await api.validatePdf(new File(['%PDF-1.7'],'wrong.txt'),true,'Resume'));
assert.ok(await api.validatePdf(new File([Buffer.alloc(3*1024*1024+1)],'large.pdf'),true,'Resume'));
const multipart=api.multipart({...valid,resumePDF:pdf},requestId,FormData);
assert.equal(multipart.get('roleInterest'),'["quality-engineer"]');assert.equal(multipart.get('privacyConsent'),'true');assert.equal(multipart.get('futureOpportunityAcknowledgement'),'true');assert.equal(multipart.get('resumePDF').name,'synthetic-resume.pdf');assert.equal(multipart.has('roleIds'),false);
let calls=[];
let transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});return response(200,{ok:true,intakeEnabled:false});}});
assert.deepEqual(await transport.loadConfig(),{intakeEnabled:false});assert.equal(calls.length,1);
await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='intake_closed');assert.equal(calls.length,1);
for(const acknowledgement of ['sent','pending','failed','unknown']){
 calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});return options.method==='GET'?response(200,{ok:true,intakeEnabled:true}):response(202,{ok:true,status:'received',requestId,applicationId:'synthetic-application',acknowledgement,duplicate:false});}});
 await transport.loadConfig();const saved=await transport.submit(multipart,requestId);assert.equal(saved.applicationSaved,true);assert.equal(saved.acknowledgement,acknowledgement);assert.equal(calls.filter(c=>c.method==='POST').length,1);
}
calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});if(options.method==='GET')return response(200,{ok:true,intakeEnabled:true});throw new Error('Synthetic lost response');}});
await transport.loadConfig();await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='outcome_unknown'&&e.requestId===requestId);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.ok(calls.every(c=>c.url.startsWith('https://api.monderman.com')),'No POST fallback after unknown outcome');
calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});if(options.method==='GET')return response(200,{ok:true,intakeEnabled:true});return response(200,{ok:false,error:'invalid_fields'});}});
await transport.loadConfig();await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='outcome_unknown','Wrong HTTP status never becomes safe rejection');
const html=fs.readFileSync(path.join(root,'careers.html'),'utf8');
assert.equal((html.match(/class="career-role"/g)||[]).length,20);assert.ok(!html.includes('"@type":"JobPosting"'));assert.ok(html.includes('id="career-form-fields" disabled'));assert.ok(html.includes('name="resumePDF" type="file"'));assert.ok(!/(localStorage|sessionStorage|indexedDB)/.test(fs.readFileSync(path.join(root,'careers.js'),'utf8')));
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
let browserPosts=0;const blocked=[];const screenshots=[];
try{
 for(const [mode,width] of [['closed',375],['pending',375],['pending',1280],['unknown',375]]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();let posts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin==='https://api.monderman.com'&&u.pathname==='/api/careers/config')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,intakeEnabled:mode!=='closed'})});
   if(u.origin==='https://api.monderman.com'&&u.pathname==='/api/careers/applications'&&req.method()==='POST'){
    posts++;browserPosts++;const body=req.postDataBuffer().toString();assert.ok(body.includes('name="roleInterest"'));assert.ok(body.includes('name="resumePDF"'));assert.ok(body.includes('name="privacyConsent"'));
    if(mode==='unknown')return route.abort('failed');
    const id=body.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1];assert.match(id,/^[a-f0-9-]{36}$/);
    return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,status:'received',requestId:id,applicationId:'synthetic-saved-application',acknowledgement:'pending',duplicate:false})});
   }
   if(u.origin==='https://challenges.cloudflare.com'&&u.pathname==='/turnstile/v0/api.js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.turnstile={render:function(target,options){window.__syntheticTurnstile=options;options.callback("synthetic-token");return "synthetic-widget";},reset:function(){window.__syntheticTurnstile.callback("synthetic-token");}};window.mondermanCareersTurnstileReady();'});
   if(u.origin==='http://careers.local.test'&&req.method()==='GET'){
    const relative=decodeURIComponent(u.pathname).replace(/^\//,''),file=path.resolve(root,relative||'careers.html');
    if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   blocked.push({url:req.url(),method:req.method()});return route.abort();
  });
  await page.goto('http://careers.local.test/careers.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.career-role').count(),20);
  await page.locator('[data-filter="research"]').click();assert.equal(await page.locator('.career-role:visible').count(),4);assert.equal(await page.locator('[data-filter="research"]').getAttribute('aria-pressed'),'true');await page.locator('[data-filter="all"]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Actual synthetic UI has no horizontal overflow');
  if(mode==='closed'){assert.equal(await page.locator('#career-form-fields').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#career-name').isDisabled(),true);assert.equal(posts,0);await context.close();continue;}
  await page.locator('#career-submit').waitFor({state:'attached'});await page.waitForFunction(()=>!document.querySelector('#career-submit').disabled);
  await page.locator('#career-name').fill('Synthetic Candidate');await page.locator('#career-email').fill('candidate@example.invalid');await page.locator('#career-state').selectOption('SD');await page.locator('[name="roleInterest"][value="quality-engineer"]').check();
  await page.locator('#career-resume').setInputFiles({name:'synthetic-resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic fixture only\n%%EOF')});await page.locator('[name="privacyConsent"]').check();await page.locator('[name="futureOpportunityAcknowledgement"]').check();
  await page.evaluate(()=>{const f=document.querySelector('#career-interest-form');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>['saved','unknown'].includes(document.querySelector('#career-form-status').dataset.state));assert.equal(posts,1,'Concurrent submit events create only one upload');
  const text=await page.locator('#career-form-status').innerText();
  if(mode==='pending'){assert.ok(text.includes('saved'));assert.ok(text.includes('pending'));assert.ok(!text.includes('has been sent'));assert.equal(await page.locator('#career-name').inputValue(),'');}
  else{assert.ok(text.includes('could not confirm'));assert.ok(text.includes('do not submit again'));await page.locator('#career-interest-form').dispatchEvent('submit');assert.equal(posts,1);}
  assert.equal(await page.locator('#career-form-fields').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#career-name').isDisabled(),true);assert.deepEqual(errors,[]);
  if(process.env.CAREERS_FRONTEND_OUT){fs.mkdirSync(process.env.CAREERS_FRONTEND_OUT,{recursive:true});const file=path.join(process.env.CAREERS_FRONTEND_OUT,`${mode}-${width}.png`);await page.screenshot({path:file,fullPage:true});screenshots.push(file);}
  await context.close();
 }
 assert.deepEqual(blocked,[],'No browser request escapes the synthetic finite mock fence');
}finally{await browser.close();}
console.log(JSON.stringify({status:'CAREERS_FRONTEND_SYNTHETIC_PASS',roles:20,roleTypes:17,syntheticUiCases:4,browserMockPosts:browserPosts,realNetworkRequests:0,realApplications:0,realEmails:0,screenshots}));
