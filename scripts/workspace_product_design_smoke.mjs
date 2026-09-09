import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE||'http://127.0.0.1:8765';
const out=process.env.WORKSPACE_PRODUCT_OUT||'/tmp/monderman-workspace-product';
fs.mkdirSync(out,{recursive:true});
const runs=[
 {id:'fixture-os',tool_type:'operational_systems',score:44,band:'Drag',business_unit:'Capital approval pathway',created_at:'2026-09-09T09:30:00Z',priority_actions_json:['Test one reporting step with a named owner.'],included_in_aggregates:true,normalization_status:'included',status:'promoted',report_available:true},
 {id:'fixture-dv',tool_type:'decision_velocity',score:51,band:'Mixed',business_unit:'Procurement & operations',created_at:'2026-09-08T09:30:00Z',included_in_aggregates:true,normalization_status:'included_with_caution',status:'promoted',report_available:true},
 {id:'fixture-os-older',tool_type:'operational_systems',score:47,band:'Mixed',business_unit:'Capital approval pathway',created_at:'2026-09-07T09:30:00Z',included_in_aggregates:true,normalization_status:'included',status:'promoted',report_available:true},
 {id:'fixture-sc',tool_type:'structural_clarity',score:58,band:'Stable',business_unit:'Care coordination',created_at:'2026-09-06T09:30:00Z',included_in_aggregates:false,normalization_status:'excluded',status:'promoted',report_available:false,locked:true}
];
const ownOrigin=new URL(base).origin;
for(const [browserName,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true});
 for(const scenario of ['populated','paid','unsafe','empty','error','loading','access-error']){
  for(const width of [1440,390]){
   for(const theme of ['light','dark']){
    if(!['populated','paid'].includes(scenario)&&(width!==1440||theme!=='light'))continue;
    const page=await browser.newPage({viewport:{width,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(({theme,scenario})=>{
      localStorage.setItem('mndTheme',theme);
      const user={id:'fixture-user',email:'fixture@example.invalid',user_metadata:{full_name:'Alex Morgan'}};
      const org={id:'fixture-org',name:'Illustrative Workspace',plan:scenario==='paid'?'pattern':'trial',respondent_pool:12,respondents_used:4,aggregation_limit:3,aggregations_used:0};
      function query(table){
        const value=table==='organization_members'?{data:[{organization_id:org.id,role:'owner',organizations:org}]}:{data:null,count:table==='diagnostic_assignments'?2:table==='action_plans'?1:0,error:null};
        const chain={then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}};
        for(const key of ['select','eq','upsert','not','order','limit'])chain[key]=()=>chain;
        chain.maybeSingle=()=>Promise.resolve({...value,data:Array.isArray(value.data)?value.data[0]:value.data});
        return chain;
      }
      const client={from:query,rpc:async()=>({error:null}),auth:{getSession:async()=>({data:{session:{user,access_token:'fixture-token'}}}),getUser:async()=>({data:{user}}),signOut:async()=>({})}};
      window.__mondermanActiveOrganizationId=org.id;
      window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true});
      window.mondermanGetSupabaseClient=async()=>client;
    },{theme,scenario});
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname.startsWith('/api/normalization/workspace-runs/')){
        assert.equal(url.pathname,'/api/normalization/workspace-runs/fixture-org');
        assert.equal(req.headers()['x-monderman-organization-id'],'fixture-org');
        if(scenario==='loading')return;
        return route.fulfill({status:scenario==='error'?503:200,contentType:'application/json',body:JSON.stringify(scenario==='error'?{ok:false,error:'fixture_unavailable'}:{ok:true,runs:scenario==='empty'?[]:scenario==='unsafe'?runs.map(run=>({...run,business_unit:'<img src=x onerror=alert(1)>'})):runs})});
      }
      if(url.pathname==='/api/synthesis-runs'){assert.equal(req.headers()['x-monderman-organization-id'],'fixture-org');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({syntheses:[{id:'fixture-synthesis'}]})});}
      if(url.origin!==ownOrigin)return route.abort();
      if(/workspace-access-gate|workspace-assistant|workspace-notes|feedback-widget/.test(url.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
      return route.continue();
    });
    if(scenario==='access-error')await page.addInitScript(()=>{window.mondermanGetSupabaseClient=async()=>({auth:{getSession:async()=>{throw new Error('fixture_access_error')}}});});
    await page.goto(base+'/workspace.html',{waitUntil:'domcontentloaded'});
    if(scenario==='loading'){
      await page.locator('#wsOverlay').waitFor({state:'visible'});
      assert.match(await page.locator('#wsOverlayMsg').innerText(),/Loading your workspace/);
    }else if(scenario==='access-error'){
      await page.waitForFunction(()=>document.querySelector('#wsHeroCta')?.textContent.includes('Sign in again'));
      assert.equal(await page.locator('#wsHeroCta').getAttribute('href'),'signin.html?next=workspace.html');
      await page.locator('#wsOverlay').waitFor({state:'hidden'});
    }else{
      await page.waitForFunction(()=>window.__wsBooted==='rendered');
      await page.locator('#wsOverlay').waitFor({state:'hidden'});
      if(['populated','paid','unsafe'].includes(scenario)){
        assert.equal(await page.locator('.ws-recent-row').count(),4);
        assert.match(await page.locator('#wsReadMeta').innerText(),/3 included runs across 2 of four/);
        assert.match(await page.locator('#wsRecText').innerText(),/named owner/);
        assert.equal(await page.locator('#wsRecBoardLink').getAttribute('href'),'workspace-actions.html?import_run=fixture-os');
        assert.match(await page.locator('#wsSynthesisReadiness').innerText(),/Review candidates/);
        assert.match(await page.locator('#wsRecentRuns').innerText(),/Included with caution/);
        assert.equal(await page.locator('#wsRecentRuns img').count(),0);
        if(scenario==='unsafe')assert.match(await page.locator('#wsRecentRuns').innerText(),/<img src=x/);
        assert.equal(await page.locator('.ws-recent-row').last().locator('a').getAttribute('href'),'workspace-diagnostics.html');
        assert.doesNotMatch(await page.locator('#wsRecentRuns').innerText(),/improving|slipping/);
        if(scenario==='paid'){assert.equal(await page.locator('#wsOnboardingSteps a').count(),6);assert.match(await page.locator('#wsOnboardingMeta').innerText(),/5 of 6/);}
      }else if(scenario==='empty'){
        assert.match(await page.locator('#wsThesis').innerText(),/Start your first/);
        assert.equal(await page.locator('.ws-recent-row').count(),0);
        assert.match(await page.locator('#wsRecentRuns').innerText(),/Your results will appear/);
        assert.match(await page.locator('#wsInstruments').innerText(),/No result yet/);
      }else{
        assert.match(await page.locator('#wsRecentRuns').innerText(),/temporarily unavailable/);
        assert.match(await page.locator('#wsSynthesisReadiness').innerText(),/Could not check/);
        assert.doesNotMatch(await page.locator('#wsThesis').innerText(),/Start your first/);
        assert.equal(await page.locator('#wsRetryResults').count(),1);
        assert.equal(await page.locator('#wsAllReadsN').innerText(),'');
      }
    }
    const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,button:getComputedStyle(document.querySelector('#wsHeroCta')).color,bg:getComputedStyle(document.querySelector('#wsHeroCta')).backgroundColor}));
    assert.ok(layout.scroll<=layout.width+1,JSON.stringify({browserName,scenario,width,theme,layout}));
    assert.notEqual(layout.button,layout.bg);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,`${browserName}-${scenario}-${theme}-${width}.png`),fullPage:['populated','paid'].includes(scenario)});
    await page.close();
   }
  }
 }
 await browser.close();
}
console.log('Workspace product design passed: populated/empty/error/loading/access-error, tenant-scoped history, safe text, preserved action deep link, dark/light/mobile in Chromium and WebKit.');
