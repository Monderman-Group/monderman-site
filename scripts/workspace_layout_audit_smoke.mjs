import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE||'http://127.0.0.1:8765';
const origin=new URL(base).origin;
const out=process.env.WORKSPACE_LAYOUT_OUT||'/tmp/monderman-workspace-layout';
const auditOnly=process.env.WORKSPACE_LAYOUT_AUDIT==='1';
fs.mkdirSync(out,{recursive:true});
const report=[];
const runs=['operational_systems','decision_velocity','structural_clarity','institutional_performance'].map((tool,i)=>({id:`fixture-${i}`,tool_type:tool,score:44+i*7,band:i?'Mixed':'Drag',status:'promoted',included_in_aggregates:true,normalization_status:i===1?'included_with_caution':'included',business_unit:'Capital approval pathway',pathway_name:'Long-running capital approval and procurement pathway',created_at:`2026-09-0${i+1}T09:30:00Z`,config_version:'fixture-1',scorer_version:'fixture-1',vantage:'executive',diagnostic_depth:'full',report_available:true}));
// Mixed saved states must not inflate eligible counts or the Synthesis picker.
for(const [i,patch] of [
 {status:'staged',normalization_status:null}, {status:'archived'}, {report_available:false},
 {locked:true}, {included_in_aggregates:false}, {normalization_status:'excluded_from_aggregates'},
].entries()) runs.push({...runs[1],id:`fixture-ineligible-${i}`,diagnostic_depth:'unavailable-depth',...patch});
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]].filter(([engine])=>!process.env.WORKSPACE_LAYOUT_ENGINE||process.env.WORKSPACE_LAYOUT_ENGINE===engine)){
 const browser=await type.launch({headless:true});
 for(const width of process.env.WORKSPACE_LAYOUT_WIDTH?[Number(process.env.WORKSPACE_LAYOUT_WIDTH)]:[1440,390,320])for(const theme of ['light','dark'])for(const name of (process.env.WORKSPACE_LAYOUT_PAGE?[process.env.WORKSPACE_LAYOUT_PAGE]:['settings','actions','analysis','diagnostics'])){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({theme,runs})=>{
   localStorage.setItem('mndTheme',theme);
   const user={id:'fixture-user',email:'fixture@example.invalid',user_metadata:{full_name:'Alex Morgan'}};
   const org={id:'fixture-org',name:'Illustrative Workspace',plan:'pattern',owner_user_id:user.id,respondent_pool:50,respondents_used:12,aggregation_limit:10,aggregations_used:2,admin_limit:3,analyst_limit:4,campaigns_enabled:true,anonymous_responses_enabled:true};
   const members=[{member_id:'fixture-member',user_id:'fixture-other',full_name:'Alexandertheverylongunbrokenfirstname Morgan',email:'procurement.and.operational.coordination@example.invalid',role:'analyst',is_owner:false},{member_id:'fixture-owner',user_id:user.id,full_name:'Alex Morgan',email:user.email,role:'admin',is_owner:true}];
   const tables={
    organization_members:[{organization_id:org.id,role:'admin',organizations:org}],organizations:[org],
    organization_invites:[{id:'fixture-invite',email:'long.procurement.coordination.team@example.invalid',role:'analyst',token:'fixture-invite-token',created_at:'2026-09-09T09:30:00Z',expires_at:new Date(Date.now()+14*86400000).toISOString()}],
    participants:[{id:'fixture-person',full_name:'Alexandertheverylongunbrokenfirstname Morgan',email:'long.participant.coordination.team@example.invalid',business_unit:'Capital approvals',team:'Procurement'}],
    action_plans:[{id:'fixture-plan',name:'Capital approvals operating plan for procurement and operations',status:'active',created_at:'2026-09-01T09:30:00Z'}],
    action_items:['proposed','todo','in_progress','done'].map((status,i)=>({id:`fixture-action-${i}`,organization_id:org.id,plan_id:'fixture-plan',title:['Review one approval checkpoint','Clarify the handoff between teams','Test one reporting step with a named owner','Review the completed process change'][i],detail:'An illustrative action recorded for this operating pathway. Keep the source finding and owner visible.',decision:i?'adopted':'proposed',status:i?status:'todo',position:i,source_run_id:'fixture-0',source_finding_json:{label:'Approval and procurement coordination',tool_type:'operational_systems'},owner_user_id:i?'fixture-other':null,created_at:'2026-09-01T09:30:00Z'})),
    org_snapshots:runs.filter(r=>!r.id.startsWith('fixture-ineligible-')).map(r=>({...r,source_run_id:r.id,as_of:r.created_at,period_label:'September 2026'})),
    diagnostic_assignments:[{id:'fixture-assignment',recipient_email:'long.participant.coordination.team@example.invalid',recipient_name:'Alex Morgan',tool_type:'operational_systems',participant_lens:'executive',campaign_label:'Capital approvals and procurement pathway',campaign_id:'fixture-campaign',status:'sent',token:'fixture-token',created_at:'2026-09-09T09:30:00Z',opened_at:'2026-09-09T10:30:00Z',send_status:'sent',email_sent_at:'2026-09-09T09:30:00Z'}],campaign_drafts:[]
   };
   window.__fixtureWrites=[];
   function query(table){
    const result={data:tables[table]||[],count:(tables[table]||[]).length,error:null};
    const q={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
    for(const key of ['select','eq','not','order','limit','in'])q[key]=()=>q;
    for(const key of ['insert','update','delete','upsert'])q[key]=()=>{window.__fixtureWrites.push(`${table}:${key}`);throw new Error('Unexpected fixture write');};
    q.maybeSingle=()=>Promise.resolve({...result,data:result.data[0]||null});
    return q;
   }
   const client={from:query,rpc:async(name)=>({data:name==='workspace_member_directory'?members:null,error:null}),auth:{getSession:async()=>({data:{session:{user,access_token:'fixture-token'}}}),getUser:async()=>({data:{user}}),signOut:async()=>({})}};
   window.__mondermanActiveOrganizationId=org.id;
   window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true});
   window.mondermanGetSupabaseClient=async()=>client;
  },{theme,runs});
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname.startsWith('/api/')){
    if(request.method()!=='GET'){unexpected.push(request.method()+' '+url.pathname);return route.abort();}
    let payload;
    if(url.pathname==='/api/normalization/workspace-runs/fixture-org')payload={ok:true,runs};
    else if(url.pathname==='/api/synthesis-runs')payload={ok:true,syntheses:[]};
    else if(url.pathname==='/api/workspace/members')payload={ok:true,members:[{user_id:'fixture-other',name:'Alexandertheverylongunbrokenfirstname Morgan',email:'fixture@example.invalid'}]};
    else if(url.pathname==='/api/account/workspace-deletion'){assert.equal(url.searchParams.get('organization_id'),'fixture-org');payload={ok:true,request:null};}
    else if(/^\/api\/runs\/fixture-[0-3]\/report$/.test(url.pathname))payload={ok:true,result:{priority_actions_json:['Clarify the handoff between teams before expanding this process.']}};
    else {unexpected.push('GET '+url.pathname);return route.abort();}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
   }
   if(url.origin!==origin)return route.abort();
   if(/workspace-access-gate|workspace-assistant|workspace-notes|feedback-widget/.test(url.pathname))return route.fulfill({body:'',contentType:'text/javascript'});
   return route.continue();
  });
  const response=await page.goto(`${base}/workspace-${name}.html`,{waitUntil:'networkidle'});
  assert.equal(response.status(),200,`Missing ${name} artifact`);
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  if(name==='settings')await page.locator('#membersBody .lrow').first().waitFor();
  if(name==='actions'){
   await page.locator('.ai-card').first().waitFor();
   await page.locator('#btnImportFindings').click();
   await page.locator('#importList input').first().waitFor();
   const owner=page.locator('select[data-ownerfor]').first();
   const ownerValue=await owner.inputValue();
   await owner.click();
   await owner.press('Escape');
   assert.equal(await owner.inputValue(),ownerValue,'Opening and closing the native owner menu must preserve its selection');
   await page.keyboard.press('Tab');
   await owner.focus();
   assert.equal(await owner.evaluate(el=>document.activeElement===el),true,'Owner control remains keyboard focusable');
   assert.ok(await owner.evaluate(el=>parseFloat(getComputedStyle(el).outlineWidth)>=2),'Owner control retains a visible keyboard focus outline');
  }
  if(name==='analysis'){
   await page.locator('#trustCard').waitFor();
   assert.equal(await page.locator('#tsTotal').textContent(),'10');
   assert.equal(await page.locator('#tsIncl').textContent(),'3');
   assert.equal(await page.locator('#tsCaut').textContent(),'1');
   assert.equal(await page.locator('#tsRichLabel').textContent(),'4 eligible');
   assert.match(await page.locator('#tsRichSub').textContent(),/4 runs eligible for aggregates · 1 depth/);
   assert.match(await page.locator('#tsNote').textContent(),/Screened 9 of 10 runs/);
  }
  if(name==='diagnostics')await page.waitForFunction(()=>!document.querySelector('#runsBody')?.textContent.includes('Loading'));
  async function inspect(state){
   const layout=await page.evaluate(()=>{
    const width=document.documentElement.clientWidth;
    const selectors='.content input,.content select,.content button,.content .lrow,.content .lrow .main,.content .lrow .act,.content .card,.content .ai-card,.content .tile,.content .stat';
    const overflow=[...document.querySelectorAll(selectors)].filter(el=>el.getClientRects().length).map(el=>({el:el.tagName+'#'+el.id+'.'+el.className,box:el.getBoundingClientRect(),scroll:el.scrollWidth,client:el.clientWidth})).filter(x=>x.box.right>width+1||x.box.left<0||((/lrow|tile/.test(x.el))&&x.scroll>x.client+1)).map(({el,box,scroll,client})=>({el,left:box.left,right:box.right,scroll,client}));
    const colors={}; for(const selector of ['.btn-mini:not(.ghost)','#scheduleWorkspaceDeletion']){const el=document.querySelector(selector);if(el){const cs=getComputedStyle(el);colors[selector]={fg:cs.color,bg:cs.backgroundColor};}}
    return {width,scroll:document.documentElement.scrollWidth,overflow,colors};
   });
   const contrast=await page.evaluate(()=>{
    const rgb=s=>{const m=s.match(/[\d.]+/g)||[];return [Number(m[0]||0),Number(m[1]||0),Number(m[2]||0),m.length>3?Number(m[3]):1];};
    const over=(front,back)=>front.slice(0,3).map((n,i)=>n*front[3]+back[i]*(1-front[3]));
    const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const fails=[];
    for(const el of document.querySelectorAll('.content button,.ws5-topbar .ws5-btn')){
     if(!el.getClientRects().length||el.disabled||!el.textContent.trim())continue;
     const cs=getComputedStyle(el);if(cs.opacity!=='1')continue;
     const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;const sources=[];
     while(node=walker.nextNode())if(node.textContent.trim())sources.push(node.parentElement);
     for(const source of new Set(sources)){
     const textStyle=getComputedStyle(source);
     const chain=[];for(let p=source;p;p=p.parentElement)chain.unshift(p);
     let bg=[255,255,255];for(const p of chain)bg=over(rgb(getComputedStyle(p).backgroundColor),bg);
     const fg=over(rgb(textStyle.color),bg),ls=[lum(fg),lum(bg)].sort((a,b)=>b-a),ratio=(ls[0]+.05)/(ls[1]+.05);
     if(ratio<4.5)fails.push({selector:el.tagName+'#'+el.id+'.'+el.className,text:el.textContent.trim().slice(0,60),ratio:Number(ratio.toFixed(2)),fg:textStyle.color,bg});
     }
    }
    return fails;
   });
   report.push({engine,width,theme,name,state,...layout,contrast});
   if(layout.scroll>width+1&&state==='populated')console.log(await page.evaluate(()=>[...document.body.querySelectorAll('*')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>({el:e.tagName+'#'+e.id+'.'+e.className,right:e.getBoundingClientRect().right,width:e.clientWidth,scroll:e.scrollWidth})).slice(0,45)));
   if(!auditOnly&&(layout.scroll>width+1||layout.overflow.length||contrast.length)){
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(out,`${engine}-${name}-${state}-${theme}-${width}-failure.png`),fullPage:true});
   }
   if(!auditOnly){assert.ok(layout.scroll<=width+1,JSON.stringify(report.at(-1)));assert.deepEqual(layout.overflow,[],JSON.stringify(report.at(-1)));assert.deepEqual(contrast,[],JSON.stringify(report.at(-1)));}
   if(name==='actions'&&theme==='dark'&&!auditOnly)assert.equal(layout.colors['.btn-mini:not(.ghost)'].fg,'rgb(16, 39, 44)');
   if(name==='settings'&&!auditOnly)assert.notEqual(layout.colors['#scheduleWorkspaceDeletion'].bg,theme==='dark'?'rgb(169, 208, 212)':'rgb(8, 127, 140)');
   if(engine==='chromium'&&width!==390&&!state.startsWith('hover-')){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`${name}-${state}-${theme}-${width}.png`),fullPage:true});}
  }
  await inspect('populated');
  if(name==='analysis'){
   await page.locator('.subtabs a[data-lens="synthesis"]').click();
   await page.locator('#synthScopePolicy').waitFor();
   assert.equal(await page.locator('#synthBody [data-srun]').count(),4,'Only the same four eligible runs appear in Synthesis');
   await inspect('synthesis');
  }
  if(name==='diagnostics'){
   await page.locator('#sendTabBtn').click();
   await page.locator('.camp-head').first().click();
   await inspect('campaigns');
   await page.locator('.finetune summary').click();
   await page.locator('#btnBulkToggle').click();
   await inspect('campaign-options');
  }
  if(width===1440){
   const buttons=await page.locator('.content button').all(),seen=new Set();
   for(const button of buttons){
    if(!await button.isVisible()||await button.isDisabled())continue;
    const key=await button.getAttribute('class')||'unclassed';if(seen.has(key))continue;seen.add(key);
    await button.hover();await inspect('hover-'+key.replaceAll(' ','-'));
   }
  }
  assert.deepEqual(errors,[],`${engine} ${name}: ${errors.join('; ')}`);
  assert.deepEqual(unexpected,[]);
  assert.deepEqual(await page.evaluate(()=>window.__fixtureWrites),[]);
  await page.close();
 }
 await browser.close();
}
fs.writeFileSync(path.join(out,'layout-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.length,overflow:report.filter(r=>r.overflow.length||r.scroll>r.width+1||r.contrast.length)},null,2));
console.log('Workspace layout audit completed with isolated fixture data. All external writes and unexpected APIs blocked.');
