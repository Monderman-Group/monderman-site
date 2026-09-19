// Local synthetic transport only. No production reads, writes, mail or models.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createCampaignUiMock} from './campaign_ui_mock_fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),origin='https://readiness.test';
const out=fs.mkdtempSync('/tmp/monderman-readiness-ui-');
const ids={org:'11111111-1111-4111-8111-111111111111',otherOrg:'22222222-2222-4222-8222-222222222222',user:'33333333-3333-4333-8333-333333333333',otherUser:'44444444-4444-4444-8444-444444444444',scope:'55555555-5555-4555-8555-555555555555',otherScope:'66666666-6666-4666-8666-666666666666',campaign:'77777777-7777-4777-8777-777777777777'};
let checks=0,external=0;const errors=[],shots=[];
const check=(value,label)=>{assert.ok(value,label);checks++;};const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const context={organizationId:ids.org,userId:ids.user,role:'admin',token:'MOCK-NOT-A-CREDENTIAL',canAnalyze:true};
const item={scopeId:ids.scope,label:'Customer support decisions',campaignIds:[ids.campaign],kind:'depth',status:'satisfied',evaluated:true,policyVersion:'test-server-policy',scopeDigest:'a'.repeat(64),evidenceDigest:'b'.repeat(64),snapshot:'c'.repeat(64)};
const payload=()=>({ok:true,organizationId:ids.org,serverNow:new Date().toISOString(),canAnalyze:true,accessReason:null,evaluationExpiresAt:null,items:[structuredClone(item)],nextCursor:null,hasMore:false});
const scope={id:ids.scope,organizationId:ids.org,label:item.label,campaignIds:[ids.campaign],population:{size:12},window:{start:'2026-09-01T00:00:00Z',end:'2026-09-12T23:59:59Z'},lenses:{decision_velocity:{}}};
const campaignMock=createCampaignUiMock({scope,getRecords:()=>[]});
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(engine+': '+error.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){external++;await route.abort();return;}
      if(url.pathname==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/workspace-synthesis-readiness.css"><link rel="stylesheet" href="/campaign-analysis.css"><style>body{font-family:Arial,sans-serif;margin:0;color:#183f47;background:#f7f6f2}main{max-width:1100px;margin:24px auto;padding:16px}button,a{font-family:inherit}</style></head><body><main><button id="outside">Unrelated Workspace control</button><section id="ready" hidden></section><section id="campaign" hidden></section></main></body></html>'});return;}
      const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file)});
    });
    await page.goto(origin);
    await page.evaluate(async({context,payload})=>{
      const module=await import('/workspace-synthesis-readiness.js');window.context=context;window.payload=payload;window.requests=[];window.reviewed=[];window.responses=[];window.pending=[];window.hold=false;
      window.mountReady=()=>{window.readyController?.destroy();window.readyController=module.mountSynthesisReadiness({element:document.getElementById('ready'),apiBase:location.origin,getContext:async()=>structuredClone(window.context),onReview:async scope=>window.reviewed.push(scope),fetchImpl:async(url,options)=>{window.requests.push({url,method:options.method,cache:options.cache,organization:options.headers['X-Monderman-Organization-Id']});const value=structuredClone(window.responses.length?window.responses.shift():window.payload);const result={ok:value.httpStatus?value.httpStatus===200:true,json:async()=>value};if(window.hold)return await new Promise(resolve=>window.pending.push(()=>resolve(result)));return result;}});};
      window.mountReady();
    },{context,payload:payload()});
    await page.locator('[data-ready-kind="depth"]').waitFor();
    eq(await page.locator('[data-ready-kind]').count(),1,engine+' '+width+' server-ready Depth only');
    eq(await page.locator('[data-ready-kind] h3').textContent(),'Depth Synthesis','Canonical product name');
    check((await page.locator('.ws-readiness-invitations').textContent()).includes('keep collecting responses'),'Explicit option to collect more');
    check((await page.locator('.ws-readiness-invitations').textContent()).includes('Nothing is generated automatically'),'No automatic synthesis promise');
    check((await page.locator('[data-ready-kind] a').getAttribute('href')).includes('campaign_scope='+ids.scope+'#campaignEvidence'),'Review link targets exact saved scope');
    eq(await page.evaluate(()=>window.reviewed.length),0,'Availability performs no action');
    await page.locator('[data-ready-kind] a').click();eq(await page.evaluate(()=>window.reviewed),[ids.scope],'Explicit review only calls review callback');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);
    check(await page.locator('.ws-ready-actions button').evaluate(el=>el.getBoundingClientRect().height>=44),'Dismiss target >=44px');
    check(await page.locator('.ws-ready-actions a').evaluate(el=>el.getBoundingClientRect().height>=44),'Review target >=44px');
    await page.locator('.ws-ready-actions a').focus();
    await page.evaluate(()=>{window.mutations=0;new MutationObserver(()=>window.mutations++).observe(document.querySelector('.ws-ready-status'),{subtree:true,childList:true,characterData:true});});
    await page.evaluate(()=>window.readyController.refresh());
    eq(await page.evaluate(()=>document.activeElement.textContent),'Review ready analysis','Unchanged poll preserves focus');
    eq(await page.evaluate(()=>window.mutations),0,'Unchanged poll does not repeat screen-reader announcement');
    const shot=path.join(out,engine+'-'+width+'.png');await page.screenshot({path:shot,fullPage:true});shots.push(shot);
    await page.locator('.ws-ready-actions button').click();check(await page.locator('#ready').isHidden(),'Keep collecting dismisses invitation');
    check((await page.locator('.ws-ready-status').textContent()).includes('still review'),'Dismissal preserves analysis access');
    await page.evaluate(()=>{window.payload.items[0].evidenceDigest='d'.repeat(64);return window.readyController.refresh();});
    check(await page.locator('#ready').isHidden(),'Another response/evidence digest does not nag');
    await page.evaluate(()=>window.mountReady());await page.waitForTimeout(30);check(await page.locator('#ready').isHidden(),'Dismissal survives remount');
    const storage=await page.evaluate(()=>localStorage.getItem('monderman.synthesis-ready-dismissals.v1'));
    check(storage&&!storage.includes(ids.user)&&!storage.includes(ids.org)&&!storage.includes(ids.scope)&&!storage.includes(item.label),'Only opaque bounded dismissal keys persisted');
    await page.evaluate(user=>{window.context.userId=user;return window.readyController.refresh();},ids.otherUser);await page.locator('[data-ready-kind]').waitFor();
    eq(await page.locator('[data-ready-kind]').count(),1,'Dismissal is user-specific');
    await page.evaluate(({user,scope})=>{window.context.userId=user;window.payload.items[0].scopeId=scope;return window.readyController.refresh();},{user:ids.user,scope:ids.otherScope});
    await page.locator('[data-ready-scope="'+ids.otherScope+'"]').waitFor();check(await page.locator('#ready').isVisible(),'New fixed scope can invite again');
    await page.evaluate(()=>{window.payload.items[0].kind='cross_lens';return window.readyController.refresh();});
    eq(await page.locator('[data-ready-kind] h3').textContent(),'Cross-Lens Synthesis','Cross-Lens invitation is distinct');
    await page.evaluate(()=>{window.payload.items[0].label='<img src=x onerror="window.bad=true">';return window.readyController.refresh();});
    eq(await page.locator('#ready img').count(),0,'Untrusted scope label never becomes markup');
    for(const mutation of ['member','viewer','expired','server-denied','empty','not-satisfied','not-evaluated','invalid-kind','missing-digest','wrong-org','stale','http-error']){
      await page.evaluate(({context,payload,mutation})=>{window.context=context;window.payload=payload;localStorage.clear();if(mutation==='member'||mutation==='viewer')window.context.role=mutation;if(mutation==='expired')window.context.canAnalyze=false;if(mutation==='server-denied')window.payload.canAnalyze=false;if(mutation==='empty')window.payload.items=[];if(mutation==='not-satisfied')window.payload.items[0].status='in_progress';if(mutation==='not-evaluated')window.payload.items[0].evaluated=false;if(mutation==='invalid-kind')window.payload.items[0].kind='recommended_path';if(mutation==='missing-digest')delete window.payload.items[0].snapshot;if(mutation==='wrong-org')window.payload.organizationId='another-org';if(mutation==='stale')window.payload.serverNow='2020-01-01T00:00:00Z';if(mutation==='http-error')window.payload.httpStatus=503;window.beforeRequests=window.requests.length;return window.readyController.refresh();},{context,payload:payload(),mutation});
      check(await page.locator('#ready').isHidden(),mutation+' cannot display ready invitation');
      if(['member','viewer','expired'].includes(mutation))eq(await page.evaluate(()=>window.requests.length-window.beforeRequests),0,mutation+' makes no readiness request');
    }
    await page.evaluate(({context,payload,cursor})=>{window.context=context;window.payload=payload;window.responses=[{...payload,items:[],hasMore:true,nextCursor:cursor},payload];return window.readyController.refresh();},{context,payload:payload(),cursor:ids.otherScope});
    await page.locator('[data-ready-kind]').waitFor();check(await page.evaluate(()=>window.requests.at(-1).url.includes('after=')),'Pagination crosses a not-ready first page');
    await page.evaluate(({payload,cursor})=>{window.responses=[{...payload,items:[],hasMore:true,nextCursor:cursor},{...payload,items:[],hasMore:true,nextCursor:cursor}];return window.readyController.refresh();},{payload:payload(),cursor:ids.otherScope});
    check(await page.locator('#ready').isHidden(),'Repeated page cursor fails closed');
    await page.evaluate(({context,payload})=>{window.context=context;window.payload=payload;window.hold=true;window.oldRefresh=window.readyController.refresh();},{context,payload:payload()});
    await page.waitForFunction(()=>window.pending.length===1);
    await page.evaluate(({org,payload})=>{window.context.organizationId=org;window.payload={...payload,organizationId:org};window.hold=false;return window.readyController.refresh();},{org:ids.otherOrg,payload:payload()});
    await page.locator('[data-ready-kind]').waitFor();await page.evaluate(()=>{window.pending.shift()();return window.oldRefresh;});
    check(await page.locator('#ready').isVisible(),'Late old organization response cannot replace current response');
    eq(await page.evaluate(()=>window.requests.at(-1).organization),ids.otherOrg,'Organization switch uses exact fresh organization header');
    await page.evaluate(()=>{window.context.role='member';window.dispatchEvent(new Event('monderman:workspace-context-changed'));});
    await page.waitForTimeout(20);check(await page.locator('#ready').isHidden(),'Role/context event clears invitations immediately');
    await page.evaluate(({context,payload})=>{window.context=context;window.payload=payload;window.payload.evaluationExpiresAt=new Date(Date.parse(payload.serverNow)+250).toISOString();return window.readyController.refresh();},{context,payload:payload()});
    await page.waitForTimeout(300);check(await page.locator('#ready').isHidden(),'Evaluation expiry removes invitation without browser-clock entitlement inference');
    await page.evaluate(({context,payload})=>{window.context=context;window.payload=payload;return window.readyController.refresh();},{context,payload:payload()});
    await page.locator('[data-ready-kind]').waitFor();
    await page.evaluate(()=>{window.context.userId=null;});await page.locator('[data-ready-kind] a').click();
    check(await page.locator('#ready').isHidden(),'Sign-out before review cannot navigate using old context');
    await page.evaluate(()=>{window.readyController.destroy();window.beforeRequests=window.requests.length;window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('monderman:workspace-context-changed'));});
    await page.waitForTimeout(20);eq(await page.evaluate(()=>window.requests.length),await page.evaluate(()=>window.beforeRequests),'Destroy removes refresh listeners');
    check(await page.evaluate(()=>window.requests.every(r=>r.method==='GET'&&r.cache==='no-store'&&r.url.includes('/readiness-summary'))),'Every notification request is a no-store summary GET, never generation');
    if(engine==='chromium'&&width===390){
      for(const change of ['role','organization']){
        await page.evaluate(({context,payload,cursor})=>{window.context=context;window.payload=payload;window.responses=[{...payload,items:[],hasMore:true,nextCursor:cursor},payload];window.hold=true;window.mountReady();},{context,payload:payload(),cursor:ids.otherScope});
        await page.waitForFunction(()=>window.pending.length===1);await page.evaluate(()=>window.pending.shift()());await page.waitForFunction(()=>window.pending.length===1);
        await page.evaluate(({change,org})=>{if(change==='role')window.context.role='member';else window.context.organizationId=org;window.hold=false;window.payload={...window.payload,organizationId:org,items:[]};window.dispatchEvent(new Event('monderman:workspace-context-changed'));},{change,org:ids.otherOrg});
        await page.evaluate(()=>window.pending.shift()());await page.waitForTimeout(30);check(await page.locator('#ready').isHidden(),change+' change during second page rejects all old results');
        await page.evaluate(()=>window.readyController.destroy());
      }
      await page.evaluate(({context,payload})=>{window.context=context;window.payload=payload;window.responses=[];window.realSet=Storage.prototype.setItem;window.realGet=Storage.prototype.getItem;Storage.prototype.setItem=()=>{throw new Error('MOCK storage unavailable');};Storage.prototype.getItem=()=>{throw new Error('MOCK storage unavailable');};window.mountReady();},{context,payload:payload()});
      await page.locator('[data-ready-kind]').waitFor();await page.locator('.ws-ready-actions button').click();await page.evaluate(()=>window.readyController.refresh());check(await page.locator('#ready').isHidden(),'Storage-denied browser still dismisses in memory');
      await page.evaluate(()=>{Storage.prototype.setItem=window.realSet;Storage.prototype.getItem=window.realGet;window.readyController.destroy();localStorage.setItem('monderman.synthesis-ready-dismissals.v1',JSON.stringify(Object.fromEntries(Array.from({length:205},(_,i)=>[i.toString(16).padStart(64,'0'),Date.now()-10000-i]))));window.mountReady();});
      await page.locator('[data-ready-kind]').waitFor();await page.locator('.ws-ready-actions button').click();eq(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('monderman.synthesis-ready-dismissals.v1'))).length),200,'Persistent dismissal cache is bounded');
      await page.evaluate(()=>window.readyController.destroy());
    }
    // The exact campaign module reviews a deep link outside its initial listing.
    await page.evaluate(async({scope,current})=>{
      window.reportCalls=0;window.campaignRequests=[];window.fetch=async(url,options)=>{window.campaignRequests.push({url,method:options.method});return {ok:true,json:async()=>url.includes('/scopes/')?{ok:true,scope,snapshot:'c'.repeat(64),...current}:{ok:true,campaigns:[{id:scope.campaignIds[0],name:'MOCK campaign',tool_type:'decision_velocity'}],scopes:[]}};};
      const {mountCampaignAnalysis}=await import('/campaign-analysis.js');window.campaignController=mountCampaignAnalysis({element:document.getElementById('campaign'),organizationId:scope.organizationId,role:'admin',apiBase:location.origin,getToken:async()=>'MOCK',initialScopeId:scope.id,onReport:async()=>window.reportCalls++});
    },{scope,current:campaignMock.current()});
    await page.locator('[data-ca-build]').waitFor();eq(await page.locator('[data-ca-scope]').inputValue(),ids.scope,'Deep link reviews exact scope outside first listing page');
    eq(await page.evaluate(()=>window.reportCalls),0,'Reviewing ready scope never generates analysis');
    check((await page.locator('[data-ca-message]').textContent()).includes('No report has been generated'),'Review explicitly says no report generated');
    await page.locator('[data-ca-build]').click();eq(await page.evaluate(()=>window.reportCalls),1,'Only separate explicit Build/Comparison button invokes callback');
    await page.evaluate(()=>{window.fetch=async()=>({ok:true,json:async()=>({scope:{id:'66666666-6666-4666-8666-666666666666',organizationId:'wrong-org'}})});return window.campaignController.review('66666666-6666-4666-8666-666666666666');});
    check((await page.locator('[data-ca-message]').textContent()).includes('not available'),'Foreign organization scope response is refused');
    for(const switched of [false,true]){
      await page.evaluate(async({scope,current})=>{
        window.campaignRequests=[];window.allowCampaignToken=true;window.releaseListing=null;
        window.fetch=async(url,options)=>{window.campaignRequests.push({url,method:options.method});if(!url.includes('/scopes/'))return await new Promise(resolve=>{window.releaseListing=()=>resolve({ok:true,json:async()=>({ok:true,campaigns:[],scopes:[]})});});return {ok:true,json:async()=>({ok:true,scope,snapshot:'c'.repeat(64),...current})};};
        const {mountCampaignAnalysis}=await import('/campaign-analysis.js');window.queuedController=mountCampaignAnalysis({element:document.getElementById('campaign'),organizationId:scope.organizationId,role:'admin',apiBase:location.origin,getToken:async()=>window.allowCampaignToken?'MOCK':null,onReport:async()=>window.reportCalls++});
      },{scope,current:campaignMock.current()});
      await page.waitForFunction(()=>typeof window.releaseListing==='function');
      await page.evaluate(scope=>{window.queuedReview=window.queuedController.review(scope);},ids.scope);
      eq(await page.evaluate(()=>window.campaignRequests.filter(request=>request.url.includes('/scopes/')).length),0,'Explicit review waits for held initial listing');
      await page.evaluate(switched=>{if(switched)window.allowCampaignToken=false;window.releaseListing();return window.queuedReview;},switched);
      eq(await page.evaluate(()=>window.campaignRequests.filter(request=>request.url.includes('/scopes/')).length),switched?0:1,switched?'Queued review refuses switched/unavailable identity':'Queued review opens exactly the requested scope after initial listing');
      eq(await page.evaluate(()=>window.reportCalls),1,'Queued review never invokes generation');
      if(switched)check((await page.locator('[data-ca-message]').textContent()).includes('Sign in again'),'Queued context loss explains retry');
      else eq(await page.locator('[data-ca-scope]').inputValue(),ids.scope,'Queued review retains requested saved definition');
    }
    await page.close();
  }}finally{await browser.close();}
}
eq(external,0,'No external network traffic');eq(errors,[],'No browser errors');
fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({checks,engines:2,widths:[390,834,1440],external,errors,screenshots:shots,scope:'Synthetic local transport; not a live-model or customer-data test'},null,2));
console.log(JSON.stringify({ok:true,checks,external,errors,receipt:out,screenshots:shots}));
