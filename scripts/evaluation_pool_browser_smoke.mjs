// Built-page admission and request flow; all external traffic is intercepted.
// No real accounts, evaluations, requests, opt-outs, emails or provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve('.render-public'), out=path.resolve('output/evaluation-pool-browser');
fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4199', api='https://monderman-api.onrender.com';
const termsVersion='2026-09-19-invitation-access';
const token='I'.repeat(43);
const invite={email:'invitee@example.test',recipientName:'Synthetic Recipient',organizationName:'Synthetic Organization'};
const capacity=(allocated=2,extra={})=>({ok:true,version:'organization-cap-20261005.1',organizationLimit:10,allocatedOrganizations:allocated,activeOrganizations:Math.min(allocated,2),automaticAdmissionOpen:allocated<10,existingAdmissionAvailable:false,ownerExceptionAvailable:false,...extra});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};const ok=(a,label)=>{assert.ok(a,label);checks++;};
const rows=[];
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{
  for(const scenario of ['public-open','public-full','public-unavailable','public-invalid','public-wrong-version','public-malformed','new-full','existing-full','new-unavailable','new-final-slot','new-server-full','reserved','exception','existing-open']){
   const isPublic=scenario.startsWith('public-'),isNew=scenario.startsWith('new-'),requests=[],errors=[],rpcCalls=[];
   let capacityReads=0,submissions=[],heldRequest;
   const context=await browser.newContext({viewport:{width:isPublic?390:1100,height:900},serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(({isNew})=>{
    window.__poolRpc=[];
    window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture-token',user:{id:'fixture-user',email:'invitee@example.test'}}}})},
     from:()=>({select(){return this;},eq(){return Promise.resolve({count:isNew?0:1,error:null});}}),
     rpc:async(name,args)=>{window.__poolRpc.push({name,args});return {data:{organization_id:'org-created',organizations:{name:'Synthetic Organization'}},error:null};}})};
   },{isNew});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    requests.push({url:req.url(),method:req.method(),path:url.pathname,headers:req.headers(),body:req.postData()?req.postDataJSON():null});
    const json=(status,body)=>route.fulfill({status,json:body});
    if(url.origin===base){
     if(['/workspace.html','/signin.html'].includes(url.pathname))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Inert destination</h1>'});
     const filename=path.resolve(root,'.'+url.pathname);
     if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return route.fulfill({status:404,body:''});
     let body=fs.readFileSync(filename);if(filename.endsWith('.html'))body=Buffer.from(body.toString().replace(/ integrity="[^"]+"/g,''));
     return route.fulfill({contentType:mime[path.extname(filename)]||'application/octet-stream',body});
    }
    if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:'/* SDK is an isolated init fixture */'});
    if(url.hostname==='ptkxrzgmeldalrkfruth.supabase.co'&&url.pathname.endsWith('/outreach-response/invitation')){
     eq(req.postDataJSON(),{token},`${engine}/${scenario}: fragment token only in authorized invitation context POST`);
     return json(200,{ok:true,invitation:invite});
    }
    if(url.origin===api&&url.pathname==='/api/billing/evaluation-capacity'){
     capacityReads++;eq(req.method(),'GET','capacity cannot allocate');
     eq(req.headers().authorization,isPublic?undefined:'Bearer fixture-token','only authenticated preflight gets bearer');
     eq(url.search,'','capacity excludes query-string identity/token hints');
     eq(req.headers().referer,undefined,'capacity excludes referring invitation URL');
     if(scenario.endsWith('unavailable'))return json(503,{ok:false,error:'evaluation_capacity_unavailable'});
     if(scenario==='public-invalid')return json(200,capacity(10,{automaticAdmissionOpen:true}));
     if(scenario==='public-wrong-version')return json(200,capacity(2,{version:'unrecognized-capacity-schema'}));
     if(scenario==='public-malformed')return json(200,capacity(2,{allocatedOrganizations:'2'}));
     const full=scenario.endsWith('full')&&!scenario.endsWith('server-full')||['reserved','exception'].includes(scenario)||scenario==='new-final-slot'&&capacityReads>1;
     return json(200,capacity(full?10:2,{existingAdmissionAvailable:scenario==='reserved',ownerExceptionAvailable:scenario==='exception'}));
    }
    if(url.origin===api&&url.pathname==='/api/billing/pattern-pilot-invitation')return json(200,{ok:true,invitation:invite});
    if(url.origin===api&&url.pathname==='/api/billing/organizations')return json(200,{ok:true,organizations:isNew?[]:[{id:'org-existing',name:'Synthetic Existing Organization'}]});
    if(url.origin===api&&url.pathname==='/api/legal/acceptance/status')return json(200,{ok:true,requiresAcceptance:url.searchParams.get('source')==='trial',termsVersion,privacyNoticeVersion:termsVersion});
    if(url.origin===api&&url.pathname==='/api/legal/acceptance')return json(201,{ok:true});
    if(url.origin===api&&url.pathname==='/api/billing/start-pattern-trial'){
     return scenario==='new-server-full'?json(409,{ok:false,error:'evaluation_pool_full',requestUrl:'https://attacker.invalid/untrusted'}):json(200,{ok:true});
    }
    if(url.pathname==='/api/health')return json(200,{ok:true});
    if(url.pathname==='/api/pilot-waitlist'){
     submissions.push(req.postDataJSON());
     if(submissions.length===1){heldRequest=route;return;}
     return json(202,{ok:true});
    }
    // Shared support scripts cannot make network or submission calls here.
    if(req.method()!=='GET')assert.fail(`Unexpected mutation blocked: ${url.pathname}`);
    return route.abort();
   });
   const mutationCalls=()=>requests.filter(r=>r.method!=='GET'&&!r.path.endsWith('/outreach-response/invitation'));
   await page.goto(`${base}/${isPublic?'pilot.html?pool=full#apply':'pattern-trial.html#invitation='+token}`,{waitUntil:'domcontentloaded'});
   if(isPublic){
    const state=scenario==='public-open'?'open':scenario==='public-full'?'full':'unavailable';
    await page.waitForFunction(state=>document.getElementById('pilotPoolStatus').dataset.state===state,state);
    eq(capacityReads,1,'one anonymous read only');eq(mutationCalls(),[],'scanner/page load performs no mutation');
    if(state==='open'){eq(await page.locator('#pilotPoolTitle').textContent(),'Evaluate how your organization works.','URL flag cannot invent a full pool');}
    if(state==='full')ok((await page.locator('#pilotPoolTitle').textContent()).includes('ten-organization evaluation pool is filled'),'actual full capacity stated');
    if(state==='unavailable')ok((await page.locator('#pilotPoolMessage').textContent()).includes('could not confirm'),'uncertainty is not full or open');
    eq(await page.locator('.actions .secondary').getAttribute('href'),'pattern-trial.html','reserved/approved sign-in route retained');
    ok((await page.locator('.actions .secondary').textContent()).includes('reserved or individually approved'),'route includes legitimate exceptions');
    if(scenario==='public-full'){
     await page.locator('#pilotWaitlistForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
     eq(submissions.length,0,'programmatic submit cannot bypass required consent or validation');
     await page.locator('[name=fullName]').fill('Synthetic Applicant');await page.locator('[name=workEmail]').fill('synthetic@example.test');
     await page.locator('[name=organization]').fill('Synthetic Organization');await page.locator('[name=decisionFocus]').fill('Synthetic question for isolated testing only.');await page.locator('[name=privacyConsent]').check();
     await page.locator('#pilotSubmit').click();await page.waitForFunction(()=>document.getElementById('pilotSubmit').disabled);
     await page.locator('#pilotWaitlistForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
     await expectHeld();eq(submissions.length,1,'in-flight double submission fenced');
     await heldRequest.fulfill({status:503,json:{ok:false,message:'Please retry.'}});await page.locator('#pilotFormStatus.is-error').waitFor();
     eq(await page.locator('[name=organization]').inputValue(),'Synthetic Organization','failed request preserves form');
     await page.locator('#pilotSubmit').click();await page.locator('#pilotConfirmation').waitFor({state:'visible'});
     eq(submissions.length,2,'retry is explicit');eq(submissions[0].requestId,submissions[1].requestId,'unchanged retry keeps server idempotency key');
     await page.locator('#pilotWaitlistForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
     eq(submissions.length,2,'successful request cannot repeat from hidden form');
     ok((await page.locator('#pilotConfirmation').textContent()).includes('does not grant access'),'confirmation does not claim admission');
     eq(requests.filter(r=>r.path.includes('/start-pattern-trial')).length,0,'requests cannot activate evaluations');
    }
   }else{
    const initiallyBlocked=['new-full','existing-full','new-unavailable'].includes(scenario);
    if(initiallyBlocked){
     await page.locator('#msg').waitFor({state:'visible'});eq(await page.locator('#startBtn').isDisabled(),true,'blocked admission disables Start');
     eq(await page.locator('#ackStart').isChecked(),false,'blocked admission keeps consent unchecked');eq(await page.evaluate(()=>window.__poolRpc),[],'capacity checked before any bootstrap');eq(mutationCalls(),[],'blocked admission has no writes');
     if(scenario!=='new-unavailable')eq(await page.locator('#msg a').getAttribute('href'),'pilot.html?pool=full#apply','full destination uses fixed reviewed route');
    }else{
     if(isNew)await page.locator('#workspaceName').fill('Synthetic Organization');
     await page.waitForFunction(()=>!document.getElementById('ackStart').disabled);eq(await page.locator('#startBtn').isDisabled(),true,'explicit legal acknowledgement required');
     eq(await page.evaluate(()=>window.__poolRpc),[],'page load never bootstraps');eq(mutationCalls(),[],'page load never activates');
     await page.locator('#ackStart').check();eq(mutationCalls(),[],'checking terms never activates');await page.locator('#startBtn').click();
     if(scenario==='new-final-slot'||scenario==='new-server-full'){
      await page.locator('#msg a').waitFor();eq(await page.locator('#msg a').getAttribute('href'),'pilot.html?pool=full#apply','actual 409 uses safe fixed full destination');
      eq(await page.locator('#startBtn').isDisabled(),true,'no automatic retry after pool closes');
      eq((await page.evaluate(()=>window.__poolRpc)).length,scenario==='new-final-slot'?0:1,'last-slot check occurs before bootstrap');
      eq(requests.filter(r=>r.path.endsWith('/start-pattern-trial')).length,scenario==='new-final-slot'?0:1,'server remains authoritative after race');
     }else{
      await page.getByText('Pattern is active. Opening your Workspace…').waitFor();
      eq(requests.filter(r=>r.path.endsWith('/start-pattern-trial')).length,1,'exactly one explicit activation');
      eq(mutationCalls().map(r=>r.path),['/api/legal/acceptance','/api/billing/start-pattern-trial'],'legal agreement precedes activation');
     }
     eq(capacityReads,2,'capacity rechecked before explicit bootstrap/activation');
    }
    ok(requests.every(r=>!r.url.includes(token)),'invitation token never appears in request URLs');
    ok(requests.filter(r=>!r.path.endsWith('/outreach-response/invitation')).every(r=>!JSON.stringify(r.body).includes(token)),'token stays out of unrelated requests');
   }
   eq(errors,[],`${engine}/${scenario}: no browser errors`);ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'layout has no horizontal overflow');
   if(['public-full','new-server-full'].includes(scenario))await page.screenshot({path:path.join(out,`${engine}-${scenario}.png`),fullPage:true});
   rows.push({engine,scenario,capacityReads,mockedFormSubmissions:submissions.length,realWrites:0});await context.close();
   console.log(`EVALUATION_POOL_BROWSER_PASS ${engine}/${scenario}`);
   async function expectHeld(){for(let i=0;i<100&&!heldRequest;i++)await new Promise(r=>setTimeout(r,10));ok(heldRequest,'synthetic request observed');}
  }
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:true,checks,rows,realRequests:0,realActivations:0,realEmails:0},null,2)+'\n');
console.log(`EVALUATION_POOL_BROWSER_TOTAL ${checks} assertions; ${rows.length} Chromium/WebKit cases; all identity/API traffic mocked`);
