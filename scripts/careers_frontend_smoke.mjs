/* Synthetic local-only careers checks. Every browser request is fulfilled or blocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {File} from 'node:buffer';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url), data=require('../careers-role-data.js'), api=require('../careers.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const requestId='00000000-0000-4000-8000-000000000001';
const valid={fullName:'Synthetic Candidate',email:'candidate@example.invalid',workState:'SD',roleInterest:['quality-engineer'],portfolioUrl:'https://example.invalid/work',coverText:'Synthetic local-only fixture.',privacyConsent:true,futureOpportunityAcknowledgement:true,website:'',turnstileToken:'synthetic-token'};
const response=(status,result)=>({status,json:async()=>result});
const allowedWorkStates='AL AK AZ AR FL GA ID IN IA KS KY LA MI MS MO MT NE NH NM NC ND OK OR PA SC SD TN TX UT WV WI WY'.split(' ');
const excludedWorkStates='CA CO CT DE DC HI IL ME MD MA MN NV NJ NY OH RI VT VA WA'.split(' ');
const workLocationPolicyVersion='careers-work-locations-20261018.1';
const configBody=(intakeEnabled=true)=>({ok:true,intakeEnabled,workLocationPolicyVersion,allowedWorkStates:[...allowedWorkStates]});
assert.equal(data.roles.length,20);assert.equal(new Set(data.roles.map(r=>r.id)).size,20);
assert.equal(new Set(data.roles.map(r=>r.title.replace(/ \(position [12]\)$/,''))).size,17);
assert.deepEqual(data.workStates.map(row=>row.code),allowedWorkStates,'Exact32 eligible places of work');
assert.equal(data.workLocationPolicyId,workLocationPolicyVersion,'Exact current work-location policy');
for(const workState of allowedWorkStates)assert.deepEqual(api.validateFields({...valid,workState}),[],'Each eligible work location validates');
for(const workState of [...excludedWorkStates,'PR','GU','AA','AE','AP','ZZ']){
 assert.ok(!data.workStates.some(row=>row.code===workState));
 assert.ok(api.validateFields({...valid,workState}).some(issue=>issue.field==='workState'&&issue.message.includes('where you would perform the work')),'Excluded/unknown work location is not silently accepted');
}
assert.deepEqual(api.validateFields(valid),[]);
assert.ok(api.validateFields({...valid,futureOpportunityAcknowledgement:false}).some(e=>e.message==='Confirm that submitting does not guarantee an interview or employment.'));
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
let transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});return response(200,configBody(false));}});
assert.deepEqual(await transport.loadConfig(),{intakeEnabled:false});assert.equal(calls.length,1);
await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='intake_closed');assert.equal(calls.length,1);
for(const acknowledgement of ['sent','pending','failed','unknown']){
 calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});return options.method==='GET'?response(200,configBody()):response(202,{ok:true,status:'received',requestId,applicationId:'synthetic-application',acknowledgement,duplicate:false});}});
 await transport.loadConfig();const saved=await transport.submit(multipart,requestId);assert.equal(saved.applicationSaved,true);assert.equal(saved.acknowledgement,acknowledgement);assert.equal(calls.filter(c=>c.method==='POST').length,1);
}
calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});if(options.method==='GET')return response(200,configBody());throw new Error('Synthetic lost response');}});
await transport.loadConfig();await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='outcome_unknown'&&e.requestId===requestId);assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.ok(calls.every(c=>c.url.startsWith('https://api.monderman.com')),'No POST fallback after unknown outcome');
calls=[];transport=api.createTransport({fetch:async(url,options)=>{calls.push({url,method:options.method});if(options.method==='GET')return response(200,configBody());return response(200,{ok:false,error:'invalid_fields'});}});
await transport.loadConfig();await assert.rejects(()=>transport.submit(multipart,requestId),e=>e.code==='outcome_unknown','Wrong HTTP status never becomes safe rejection');
for(const [label,packet] of [
 ['missing policy',{ok:true,intakeEnabled:true}],
 ['stale policy',{...configBody(),workLocationPolicyVersion:'careers-work-locations-OLD'}],
 ['missing states',{...configBody(),allowedWorkStates:undefined}],
 ['extra excluded state',{...configBody(),allowedWorkStates:[...allowedWorkStates,'CA']}],
 ['missing state',{...configBody(),allowedWorkStates:allowedWorkStates.slice(1)}],
 ['duplicate state',{...configBody(),allowedWorkStates:[allowedWorkStates[0],...allowedWorkStates.slice(0,-1)]}],
 ['reordered states',{...configBody(),allowedWorkStates:[...allowedWorkStates].reverse()}],
 ['unknown state',{...configBody(),allowedWorkStates:[...allowedWorkStates.slice(0,-1),'ZZ']}],
 ['wrong state type',{...configBody(),allowedWorkStates:'SD'}]
]){
 const policyCalls=[];const guarded=api.createTransport({fetch:async(url,options)=>{policyCalls.push({url,method:options.method});return response(200,packet);}});
 assert.deepEqual(await guarded.loadConfig(),{intakeEnabled:false},label+' fails closed');
 await assert.rejects(()=>guarded.submit(multipart,requestId),error=>error.code==='intake_closed',label+' never enables an upload');
 assert.deepEqual(policyCalls.map(call=>call.method),['GET'],label+' makes no POST or policy-bypass fallback');
}
let reloadNumber=0;const reloadCalls=[];const reloaded=api.createTransport({fetch:async(url,options)=>{reloadCalls.push(options.method);return response(200,reloadNumber++===0?configBody():{ok:true,intakeEnabled:true});}});
assert.deepEqual(await reloaded.loadConfig(),{intakeEnabled:true});assert.deepEqual(await reloaded.loadConfig(),{intakeEnabled:false});await assert.rejects(()=>reloaded.submit(multipart,requestId),error=>error.code==='intake_closed','A stale reload clears the prior selected upload host');assert.deepEqual(reloadCalls,['GET','GET']);
const rejectedWorkState=api.createTransport({fetch:async(url,options)=>options.method==='GET'?response(200,configBody()):response(400,{ok:false,error:'invalid_fields',field:'workState'})});
await rejectedWorkState.loadConfig();await assert.rejects(()=>rejectedWorkState.submit(multipart,requestId),error=>error.code==='invalid_fields'&&error.field==='workState','Known unsupported-state400 remains a safe rejection with clear field guidance');
const html=fs.readFileSync(path.join(root,'careers.html'),'utf8');
assert.equal((html.match(/class="career-role"/g)||[]).length,20);assert.ok(!html.includes('"@type":"JobPosting"'));assert.ok(html.includes('id="career-form-fields" disabled'));assert.ok(html.includes('name="resumePDF" type="file"'));assert.ok(!/(localStorage|sessionStorage|indexedDB)/.test(fs.readFileSync(path.join(root,'careers.js'),'utf8')));
const privacy=fs.readFileSync(path.join(root,'careers-privacy.html'),'utf8');
assert.ok(html.includes('We plan to fill these positions and are accepting résumés. Hiring timelines will vary by role.'));
assert.ok(html.includes('20 positions across 17 types of work.'));
const roleFragments=[...html.matchAll(/<details class="career-role"[^>]*data-role-id="([^"]+)"[^>]*>([\s\S]*?)<\/details>/g)];
assert.deepEqual(roleFragments.map(match=>match[1]),data.roles.map(role=>role.id));
function decoded(text){return text.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos);/gi,(whole,numeric,named)=>numeric?String.fromCodePoint(parseInt(numeric.replace(/^x/i,''),/^x/i.test(numeric)?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[named.toLowerCase()]));}
function roleContent(role,fragment){
 assert.equal(typeof role.description,'string');assert.ok(role.description.length>=160,'Substantial role-specific description');
 assert.equal(role.responsibilities.length,4);assert.equal(role.qualifications.length,3);
 const description=fragment.match(/<p class="career-role-description">([\s\S]*?)<\/p>/);assert.ok(description);assert.equal(decoded(description[1]),role.description);
 for(const [className,bullets] of [['career-responsibilities',role.responsibilities],['career-qualifications',role.qualifications]]){
  const matches=[...fragment.matchAll(new RegExp('<ul class="'+className+'">([\\s\\S]*?)<\\/ul>','g'))];assert.equal(matches.length,1);
  const items=[...matches[0][1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match=>decoded(match[1]));assert.deepEqual(items,bullets);assert.ok(items.every(item=>item.length>=20));
 }
 assert.equal((fragment.match(/<li>/g)||[]).length,7,'Exactly seven useful bullets per position');
}
for(let index=0;index<data.roles.length;index++)roleContent(data.roles[index],roleFragments[index][2]);
assert.throws(()=>roleContent({...data.roles[0],description:'Too short'},roleFragments[0][2]));
assert.throws(()=>roleContent(data.roles[0],roleFragments[0][2].replace(/<li>[\s\S]*?<\/li>/,'')),'Missing role bullet rejects');
assert.throws(()=>roleContent({...data.roles[0],qualifications:[...data.roles[0].qualifications,'Unapproved additional requirement']},roleFragments[0][2]),'Unapproved requirement rejects');
const stateSelect=html.match(/<select id="career-state"[^>]*>([\s\S]*?)<\/select>/);assert.ok(stateSelect);
assert.deepEqual([...stateSelect[1].matchAll(/<option value="([A-Z]{2})"/g)].map(match=>match[1]),allowedWorkStates,'Static no-script location choices match the exact policy');
assert.deepEqual([...html.matchAll(/data-work-state="([A-Z]{2})"/g)].map(match=>match[1]),allowedWorkStates,'All eligible locations are disclosed before applying');
assert.ok(html.includes('id="career-excluded-locations"')&&html.includes('id="career-materials-policy"'));
assert.ok(/equal opportunity/i.test(html)&&html.includes('an accommodation or another way to apply'),'Equal-opportunity and accessible application route are present');
assert.ok(!/(future[- ](?:roles?|interest|opportunities)|not currently hiring|potential (?:future )?positions?)/i.test((html+privacy).replace(/<[^>]+>/g,' ')),'Applicant-facing copy describes planned positions accepting résumés');
const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
let browserPosts=0,closedContexts=0,browserClosed=false;const blocked=[];const screenshots=[],expandedRoleCameras=[];
try{
 for(const [mode,width] of [['closed',375],['pending',375],['pending',1280],['unknown',375]]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();let posts=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin==='https://api.monderman.com'&&u.pathname==='/api/careers/config')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(configBody(mode!=='closed'))});
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
  assert.deepEqual(await page.locator('#career-state option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean)),allowedWorkStates,'Actual synthetic UI contains only eligible work locations');
  if(mode==='pending'&&width===1280){
   for(const role of data.roles){const card=page.locator('[data-role-id="'+role.id+'"]');await card.locator('summary').click();assert.equal(await card.locator('.career-role-description').innerText(),role.description);assert.equal(await card.locator('.career-role-detail li').count(),7);assert.ok(await card.locator('.career-role-detail').isVisible());await card.locator('summary').click();}
  }
  if(mode==='pending'){
   const firstRole=data.roles[0],card=page.locator('[data-role-id="'+firstRole.id+'"]');await card.locator('summary').click();
   assert.equal(await card.locator('.career-role-description').innerText(),firstRole.description);
   assert.deepEqual(await card.locator('.career-responsibilities li').allInnerTexts(),firstRole.responsibilities);assert.deepEqual(await card.locator('.career-qualifications li').allInnerTexts(),firstRole.qualifications);
   assert.equal(await card.locator('.career-role-detail li:visible').count(),7);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Expanded phone/desktop role has no horizontal overflow');
   if(process.env.CAREERS_FRONTEND_OUT){fs.mkdirSync(process.env.CAREERS_FRONTEND_OUT,{recursive:true});const file=path.join(process.env.CAREERS_FRONTEND_OUT,`expanded-role-${width}.png`);await page.screenshot({path:file,fullPage:true});screenshots.push(file);expandedRoleCameras.push({file,mode,viewport:{width,height:900},roleId:firstRole.id,descriptionMatches:true,responsibilityBullets:4,qualificationBullets:3,visibleBullets:7,fullPage:true,interaction:'Standard summary click and browser-owned scroll; no forced scroll, focus or styles.'});}
   await card.locator('summary').click();
  }
  assert.equal(await page.locator('#career-submit').innerText(),'Submit your résumé');
  await page.locator('[data-filter="research"]').click();assert.equal(await page.locator('.career-role:visible').count(),4);assert.equal(await page.locator('[data-filter="research"]').getAttribute('aria-pressed'),'true');await page.locator('[data-filter="all"]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Actual synthetic UI has no horizontal overflow');
  if(mode==='closed'){assert.equal(await page.locator('#career-form-fields').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#career-name').isDisabled(),true);assert.ok((await page.locator('#career-intake-notice').innerText()).includes('temporarily unavailable'));assert.equal(posts,0);await context.close();closedContexts++;continue;}
  await page.locator('#career-submit').waitFor({state:'attached'});await page.waitForFunction(()=>!document.querySelector('#career-submit').disabled);
  await page.locator('#career-name').fill('Synthetic Candidate');await page.locator('#career-email').fill('candidate@example.invalid');await page.locator('#career-state').selectOption('SD');await page.locator('[name="roleInterest"][value="quality-engineer"]').check();
  await page.locator('#career-resume').setInputFiles({name:'synthetic-resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic fixture only\n%%EOF')});await page.locator('[name="privacyConsent"]').check();await page.locator('[name="futureOpportunityAcknowledgement"]').check();
  await page.evaluate(()=>{const f=document.querySelector('#career-interest-form');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>['saved','unknown'].includes(document.querySelector('#career-form-status').dataset.state));assert.equal(posts,1,'Concurrent submit events create only one upload');
  const text=await page.locator('#career-form-status').innerText();
  if(mode==='pending'){assert.ok(text.includes('Your résumé and application have been received.'));assert.ok(text.includes('pending'));assert.ok(!text.includes('has been sent'));assert.equal(await page.locator('#career-name').inputValue(),'');}
  else{assert.ok(text.includes('could not confirm'));assert.ok(text.includes('do not submit again'));await page.locator('#career-interest-form').dispatchEvent('submit');assert.equal(posts,1);}
  assert.equal(await page.locator('#career-form-fields').evaluate(e=>e.disabled),true);assert.equal(await page.locator('#career-name').isDisabled(),true);assert.deepEqual(errors,[]);
  if(process.env.CAREERS_FRONTEND_OUT){fs.mkdirSync(process.env.CAREERS_FRONTEND_OUT,{recursive:true});const file=path.join(process.env.CAREERS_FRONTEND_OUT,`${mode}-${width}.png`);await page.screenshot({path:file,fullPage:true});screenshots.push(file);}
  await context.close();closedContexts++;
 }
 assert.deepEqual(blocked,[],'No browser request escapes the synthetic finite mock fence');
}finally{await browser.close();browserClosed=true;}
const sourcePins=Object.fromEntries(['careers.html','careers.js','careers-role-data.js','careers.css','careers-privacy.html','scripts/careers_frontend_smoke.mjs'].map(file=>{const bytes=fs.readFileSync(path.join(root,file));return[file,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}];}));
console.log(JSON.stringify({status:'CAREERS_FRONTEND_SYNTHETIC_PASS',roles:20,roleTypes:17,eligibleWorkStates:allowedWorkStates,excludedWorkStates,workLocationPolicyVersion,syntheticUiCases:4,browserMockPosts:browserPosts,realNetworkRequests:0,realApplications:0,realEmails:0,closedContexts,browserClosed,blocked,sourcePins,expandedRoleCameras,screenshots,qualification:'All four browser cases use original consumer-owned route fulfilments. Expanded-role cameras show synthetic local presentation, not a live site or real application.'}));
