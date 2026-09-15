// Local-file browser presentation + mocked billing only. Never contact a live API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.env.ANNUAL_UI_SITE_ROOT?path.resolve(process.env.ANNUAL_UI_SITE_ROOT):path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.env.ANNUAL_UI_OUT||path.join(root,'output/annual-pricing-billing-ui'));
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browserName=process.env.ANNUAL_UI_BROWSER||'chromium';
const browser=await ({chromium,webkit}[browserName]).launch({headless:true});
fs.mkdirSync(out,{recursive:true});
const origin='https://annual-ui.example.test';
const scenarios=[
  ['pricing','platform-services.html'],['signal','plan-signal.html'],['pattern','plan-pattern.html'],
  ['checkout-signal','checkout.html?tier=signal&interval=monthly'],['checkout-pattern','checkout.html?tier=pattern&interval=annual'],
  ['annual-monthly','workspace-settings.html#billing'],['annual-prepaid','workspace-settings.html#billing'],
  ['scheduled','workspace-settings.html#billing'],['legacy','workspace-settings.html#billing'],
  ['pilot','workspace-settings.html#billing'],['analyst','workspace-settings.html#billing'],
  ['unavailable','workspace-settings.html#billing'],['overview','workspace.html']
];
const receipt={browser:browserName,siteRoot:root,networkRequestsSent:0,subscriptionMutations:0,states:[]};
for(const [scenario,routePath] of scenarios)for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[],posts=[],blocked=[];
  page.on('pageerror',error=>errors.push(error.message));
  let commercial={offerVersion:'2026-09-15-annual-v1',termStartedAt:'2026-09-15T12:00:00Z',termEndsAt:'2027-09-15T12:00:00Z',annualCommitment:scenario==='annual-prepaid'?2160000:2400000,currency:'usd',paymentInterval:scenario==='annual-prepaid'?'annual':'monthly',cancellationScheduled:scenario==='scheduled',cancellationAt:scenario==='scheduled'?'2027-09-15T12:00:00Z':null,respondentPool:2400,synthesisLimit:60};
  if(['legacy','pilot'].includes(scenario))commercial=null;
  await page.addInitScript(({scenario})=>{
    const role=scenario==='analyst'?'analyst':'admin';
    const user={id:'ui-user',email:'example@example.invalid',user_metadata:{full_name:'Example Admin'}};
    const org={id:'ui-org',name:'Example Workspace',plan:['pilot','legacy'].includes(scenario)?'pattern':'signal',owner_user_id:role==='admin'?user.id:'another-user',run_limit:null,runs_used:0,respondent_pool:['pilot','legacy'].includes(scenario)?500:2400,respondents_used:7,aggregation_limit:['pilot','legacy'].includes(scenario)?null:60,aggregations_used:2,analyst_limit:2,admin_limit:1,subscription_status:scenario==='pilot'?'trialing':'active',pattern_trial_ends_at:scenario==='pilot'?'2099-01-01T00:00:00Z':null};
    const query=table=>{
      let data=table==='organization_members'?[{organization_id:org.id,role,organizations:org}]:table==='organizations'?[org]:[];
      const result={data,count:0,error:null},q={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
      for(const method of ['select','eq','not','order','limit','upsert','is','in'])q[method]=()=>q;
      q.maybeSingle=q.single=async()=>({...result,data:data[0]||null});return q;
    };
    window.__mondermanActiveOrganizationId=org.id;
    window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true});
    const client={from:query,rpc:async()=>({data:[],error:null}),auth:{getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user,access_token:'BROWSER-MOCK'}}}),signOut:async()=>({}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
    // Both existing public-page createClient and Workspace's shared-client entry point
    // receive the same local auth fixture. No SDK request or live auth is performed.
    window.supabase={createClient:()=>client};
    window.mondermanGetSupabaseClient=async()=>client;
  },{scenario});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.startsWith('/api/')){
      if(req.method()==='POST')posts.push({path:url.pathname,body:req.postDataJSON()});
      let body={ok:true},status=200;
      if(url.pathname==='/api/billing/organizations')body.organizations=[{id:'ui-org',name:'Example Workspace'}];
      else if(url.pathname==='/api/billing/commercial-status'){
        assert.equal(url.searchParams.get('organization_id'),'ui-org');
        assert.equal(req.headers().authorization,'Bearer BROWSER-MOCK');
        if(scenario==='unavailable'){status=503;body={ok:false,error:'commercial_status_unavailable'};}
        else body={ok:true,commercial,nextInstallmentAt:'2026-10-15T12:00:00Z',testMode:true};
      }else if(url.pathname==='/api/billing/cancel-renewal'){
        assert.deepEqual(req.postDataJSON(),{organization_id:'ui-org'});
        commercial={...commercial,cancellationScheduled:true,cancellationAt:commercial.termEndsAt};
        body={ok:true,commercial,alreadyScheduled:false,testMode:true};
      }else if(url.pathname.startsWith('/api/normalization/workspace-runs/'))body.runs=[];
      else if(url.pathname==='/api/synthesis-runs')body.syntheses=[];
      else if(url.pathname==='/api/account/workspace-deletion')body.request=null;
      else {status=503;body={ok:false,error:'unapproved_mock_route'};}
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(url.origin!==origin){blocked.push(url.origin);return route.abort();}
    if(/workspace-access-gate|workspace-assistant|workspace-notes|feedback-widget|analytics|measurement/.test(url.pathname))return route.fulfill({contentType:'text/javascript',body:''});
    const local=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!local.startsWith(root+path.sep)||!fs.existsSync(local)||!fs.statSync(local).isFile())return route.fulfill({status:404,body:'Not found'});
    const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.ico':'image/x-icon'};
    return route.fulfill({contentType:mime[path.extname(local)]||'application/octet-stream',body:fs.readFileSync(local)});
  });
  await page.goto(origin+'/'+routePath,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  if(routePath.startsWith('workspace-settings')){
    await page.waitForFunction(()=>!document.querySelector('#billingSummary').textContent.includes('Checking'));
    if(scenario==='annual-monthly'){
      await page.locator('#cancelAnnualRenewal').waitFor({state:'visible'});
      page.once('dialog',dialog=>dialog.accept());
      await page.locator('#cancelAnnualRenewal').click();
      await page.waitForFunction(()=>document.querySelector('#billingRenewal').textContent.includes('Renewal is off'));
      assert.equal(posts.filter(p=>p.path.endsWith('/cancel-renewal')).length,1);
    }
    if(scenario==='analyst')assert.equal(posts.length,0);
    if(scenario==='annual-prepaid'){
      assert.doesNotMatch(await page.locator('#billingRenewal').textContent(),/installments owed/i);
      assert.match(await page.locator('#billingRenewal').textContent(),/prepaid term/);
    }
    await page.locator('#billing').scrollIntoViewIfNeeded();
  }else if(routePath.startsWith('checkout')){
    await page.waitForFunction(()=>document.querySelector('#organizationName').textContent.includes('Example Workspace'));
    assert.equal(await page.locator('#payBtn').isDisabled(),true);
    await page.locator('#annualCommitmentAccepted').check();
    assert.equal(await page.locator('#payBtn').isDisabled(),false);
    assert.equal(posts.length,0);
    const fields=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.billing-field input,.billing-field select')].map(e=>{
      const r=e.getBoundingClientRect(),label=e.closest('.billing-field').querySelector('label').getBoundingClientRect();
      return [e.id,{x:r.x,y:r.y,width:r.width,height:r.height,labelBottom:label.bottom,fontSize:parseFloat(getComputedStyle(e).fontSize)}];
    })));
    for(const [id,field]of Object.entries(fields)){
      assert.ok(field.height>=44,id+' has at least a 44px touch target');
      assert.ok(Math.abs(field.height-46)<=1,id+' shares the 46px control height');
      assert.ok(field.y>=field.labelBottom+4,id+' retains label clearance');
      assert.ok(field.fontSize>=16,id+' avoids iPhone small-input zoom');
    }
    if(width>520)for(const [left,right]of [['billingCountry','billingRegion'],['billingContactName','purchaseOrderReference']]){
      assert.ok(Math.abs(fields[left].y-fields[right].y)<=1,left+' and '+right+' share a control baseline');
      assert.ok(Math.abs(fields[left].width-fields[right].width)<=1,left+' and '+right+' share a column width');
    }
  }else if(routePath.startsWith('workspace')){
    await page.waitForFunction(()=>window.__wsBooted==='rendered');
    await page.waitForFunction(()=>document.querySelector('#wsAnnualSummary').textContent.includes('no monthly reset'));
    // The actual overlay fades for 350 ms after boot. Capture its settled state,
    // not the transition, and fail if the production UI never clears it.
    await page.waitForFunction(()=>{const e=document.querySelector('#wsOverlay'),s=e&&getComputedStyle(e);return !e||(s.visibility==='hidden'&&Number(s.opacity)===0);});
    await page.locator('#wsPlanStrip').scrollIntoViewIfNeeded();
  }else await page.waitForTimeout(1100);
  const layout=await page.evaluate(()=>{
    const width=document.documentElement.clientWidth;
    const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const mark=document.querySelector('header .monderman-lockup__mark,.ws5-brand .monderman-lockup__mark,.ws-brand .monderman-lockup__mark');
    const panel=document.querySelector('#billing')||document.querySelector('main');
    return {width,scroll:document.documentElement.scrollWidth,mark:mark?{...bounds(mark),color:getComputedStyle(mark).color,stroke:getComputedStyle(mark.querySelector('path')).stroke}:null,panel:panel?bounds(panel):null};
  });
  assert.ok(layout.scroll<=layout.width+1,JSON.stringify({scenario,width,layout}));
  if(layout.mark){assert.ok(layout.mark.width>0&&layout.mark.height>0);assert.ok(layout.mark.x>=-1&&layout.mark.x+layout.mark.width<=width+1);}
  assert.deepEqual(errors,[],scenario+' page errors');
  const screenshot=path.join(out,scenario+'-'+width+'.png');
  if(routePath.startsWith('workspace-settings'))await page.locator('#billing').screenshot({path:screenshot});
  else await page.screenshot({path:screenshot,fullPage:routePath.startsWith('checkout')});
  if(scenario==='pricing')for(const section of ['plans','compare']){
    await page.locator('#'+section).screenshot({path:path.join(out,'pricing-'+width+'-'+section+'.png')});
  }
  // Separate top-of-page capture verifies the actual header mark at every width.
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,scenario+'-'+width+'-header.png')});
  receipt.states.push({scenario,width,layout,blockedExternalOrigins:[...new Set(blocked)],mockPosts:posts,screenshot:path.basename(screenshot),sha256:crypto.createHash('sha256').update(fs.readFileSync(screenshot)).digest('hex')});
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out,'CHECKS.json'),JSON.stringify({...receipt,status:'PASS',observedAt:new Date().toISOString()},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',states:receipt.states.length,out,networkRequestsSent:0,subscriptionMutations:0}));
