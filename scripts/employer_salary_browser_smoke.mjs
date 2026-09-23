// Real candidate pages in Chromium/WebKit; all requests are fulfilled locally.
// This is browser + mocked-API evidence, not a browser-to-database release gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.argv[2]||'output/employer-salary-browser');
assert.ok(!fs.existsSync(out),'Choose a new evidence directory');
fs.mkdirSync(out,{recursive:true});
const origin='https://salary-browser.example.test';
const read=file=>fs.readFileSync(path.join(root,file));
const orgId='44444444-4444-4444-8444-444444444444';
const assignmentId='22222222-2222-4222-8222-222222222222';
const runId='11111111-1111-4111-8111-111111111111';
const token='synthetic-assignment-browser-only';
const salary='98765.43';
const csv='email,annual_base_salary,salary_currency\na@example.test,'+salary+',USD\n';
const rows=[],errors=[];
let assertions=0;
const ok=(value,label)=>{assert.ok(value,label);assertions++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const clone=value=>JSON.parse(JSON.stringify(value));

async function setup(browser,{role='admin',api}){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  page.setDefaultTimeout(12000);
  const pageErrors=[],unexpected=[],requests=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.addInitScript(({role,orgId})=>{
    window.__fixtureFormRequests=[];window.__fixtureDatabaseWrites=[];
    const originalFetch=window.fetch;
    window.fetch=async function(input,options){
      if(options?.body instanceof FormData){
        const entries=[];
        for(const [key,value] of options.body.entries())entries.push([key,value instanceof Blob?await value.text():value]);
        window.__fixtureFormRequests.push({url:String(input),entries});
      }
      return originalFetch.call(this,input,options);
    };
    const user={id:'33333333-3333-4333-8333-333333333333',email:'fixture@example.test',user_metadata:{full_name:'Example '+role}};
    const org={id:orgId,name:'Synthetic browser workspace',plan:'signal',owner_user_id:role==='admin'?user.id:'someone-else',respondent_pool:2400,respondents_used:0,aggregation_limit:60,aggregations_used:0,analyst_limit:2,admin_limit:1,subscription_status:'active',campaigns_enabled:true,anonymous_responses_enabled:true};
    const query=table=>{
      const data=table==='organization_members'?[{organization_id:org.id,role,organizations:org}]:table==='organizations'?[org]:[];
      const result={data,count:0,error:null},q={then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
      for(const method of ['select','eq','not','order','limit','is','in'])q[method]=()=>q;
      for(const method of ['upsert','delete'])q[method]=value=>{window.__fixtureDatabaseWrites.push({table,method,value});return q;};
      q.maybeSingle=q.single=async()=>({...result,data:data[0]||null});return q;
    };
    const client={from:query,rpc:async name=>({data:name==='workspace_member_directory'?[{member_id:'analyst-member',user_id:'analyst-user',role:'analyst',full_name:'Example Analyst',email:'analyst@example.test'}]:[],error:null}),auth:{getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user,access_token:'SYNTHETIC-LOCAL-ONLY'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
    window.supabase={createClient:()=>client};window.__mondermanSB=client;
    window.mondermanGetSupabaseClient=async()=>client;window.__mondermanActiveOrganizationId=org.id;
    window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'workspace'});
  },{role,orgId});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.startsWith('/api/')){
      // WebKit's transport omits file bytes from postData. Record the exact
      // FormData entries passed to native fetch in both engines for parity.
      const form=/multipart\/form-data/.test(req.headers()['content-type']||'')?await page.evaluate(url=>window.__fixtureFormRequests.findLast(entry=>entry.url===url),req.url()):null;
      const body=form?form.entries.map(([key,value])=>'name="'+key+'"\r\n\r\n'+value).join('\r\n'):req.postData()||'';
      const entry={method:req.method(),path:url.pathname,body};requests.push(entry);
      const result=await api(url,req,entry);
      if(result)return route.fulfill({status:result.status||200,contentType:'application/json',body:JSON.stringify(result.body||result)});
      const defaults={
        '/api/health':{ok:true},
        '/api/billing/commercial-status':{ok:true,commercial:null},
        '/api/account/workspace-deletion':{ok:true,request:null},
        '/api/synthesis-runs':{ok:true,syntheses:[]},
        '/api/legal/status':{ok:true,requiresAcceptance:false},
        '/api/legal/acceptance':{ok:true,requiresAcceptance:false},
        '/api/first-run-events':{ok:true}
      };
      const fallback=url.pathname.startsWith('/api/normalization/workspace-runs/')?{ok:true,runs:[]}:defaults[url.pathname];
      if(!fallback)unexpected.push({method:req.method(),path:url.pathname});
      return route.fulfill({status:fallback?200:503,contentType:'application/json',body:JSON.stringify(fallback||{ok:false,error:'unapproved_fixture_route'})});
    }
    if(url.origin!==origin)return route.abort();
    if(/workspace-access-gate|workspace-assistant|feedback-widget|assistant\.js|connect-widget|first-run-measurement|optional-measurement/.test(url.pathname))return route.fulfill({contentType:'text/javascript',body:'window.__mondermanReveal?.();'});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});
    return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  return {page,pageErrors,unexpected,requests};
}

async function layout(page,label,selector){
  const result=await page.evaluate(selector=>{
    const host=document.querySelector(selector),bounds=[];
    for(const el of host.querySelectorAll('input:not([type=checkbox]),select,button,a')){
      const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
      bounds.push({id:el.id,text:el.textContent.trim(),left:r.left,right:r.right,height:r.height});
    }
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bounds};
  },selector);
  ok(result.scroll<=result.width+1,label+' page fits viewport '+JSON.stringify(result));
  for(const control of result.bounds){
    ok(control.left>=-1&&control.right<=result.width+1,label+' control fits viewport '+JSON.stringify(control));
    ok(control.height>=36,label+' control remains usable '+JSON.stringify(control));
  }
  await captureViewport(page,selector,label);
  return result;
}
async function captureViewport(page,selector,label){
  // Element screenshots taller than the viewport place sticky navigation over
  // the stitched content. Capture a real viewport with its live navigation.
  await page.locator(selector).evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-80,behavior:'instant'}));
  await page.screenshot({path:path.join(out,label+'.png')});
}
async function storage(page){return page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));}
async function salaryFile(page){
  await page.locator('#settingsSalaryFile').setInputFiles({name:'fixture.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.waitForFunction(()=>document.querySelector('#settingsSalaryResult').textContent.includes('1 salaries supplied'));
  eq(await page.locator('#settingsSalaryAuthority').isChecked(),false,'new file requires fresh authority');
  eq(await page.locator('#settingsSalaryPreview').isDisabled(),true,'no preview before authority');
  await page.locator('#settingsSalaryAuthority').check();
}

async function settingsCase(browser,engine,role,width){
  const capability={ok:true,enabled:role!=='disabled',can_upload:['admin','analyst'].includes(role),can_delegate:role==='admin',can_configure:role==='admin',currency:'USD',notice_version:'employer-salary-20260923.1',delegated_user_ids:[],eligible_batches:[
    {id:'campaign-a',label:'Operations',salary_settings:role==='analyst'?{annual_working_hours:1920,benefits_overhead_percent:0,locked:true}:null},
    {id:'campaign-b',label:'Finance',salary_settings:null}
  ]};
  let failImport=false;
  const fixture=await setup(browser,{role:role==='disabled'?'admin':role,api:async(url,req,entry)=>{
    if(url.pathname.endsWith('/salary-capability'))return clone(capability);
    if(url.pathname.endsWith('/salary-settings')){
      eq(role,'admin','only admin sends calculation request');
      const body=req.postDataJSON();eq(body,{organization_id:orgId,batch_id:'campaign-a',annual_working_hours:1920,benefits_overhead_percent:0},'explicit zero calculation payload');
      capability.eligible_batches[0].salary_settings={annual_working_hours:body.annual_working_hours,benefits_overhead_percent:body.benefits_overhead_percent,locked:true};return {ok:true};
    }
    if(url.pathname.endsWith('/import-salaries')){
      const body=entry.body;ok(body.includes(salary),'salary appears only in authorized import request');
      ok(body.includes('employer-salary-20260923.1'),'current notice version sent');
      ok(!/name="(?:salary_)?(?:annual_working_hours|benefits_overhead_percent)"/.test(body),'import cannot override saved settings');
      if(failImport)return {status:409,body:{ok:false,message:salary,invalid_rows:[{row:2,message:salary,annual_base_salary:salary}]}};
      return {ok:true,invalid_rows:[]};
    }
    if(url.pathname.endsWith('/salary-delegation')){
      const body=req.postDataJSON();eq(body.organization_id,orgId,'delegation tenant');eq(body.user_id,'analyst-user','delegation target');
      capability.delegated_user_ids=body.can_upload?['analyst-user']:[];return {ok:true};
    }
  }});
  const {page,requests}=fixture;await page.setViewportSize({width,height:1000});
  try{
    await page.goto(origin+'/workspace-settings.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#ws5UserName').textContent.startsWith('Example'));
    await page.waitForTimeout(100);
    if(['disabled','member'].includes(role)){
      eq(await page.locator('#employerSalarySettings').isVisible(),false,role+' sees no salary settings');
      eq(requests.filter(r=>r.method==='POST').length,0,role+' cannot mutate salary');
    }else{
      await page.locator('#salaryBatch').selectOption('campaign-a');
      if(role==='admin'){
        eq(await page.locator('#settingsSalaryHours').inputValue(),'','hours have no default');
        eq(await page.locator('#settingsSalaryOverhead').inputValue(),'','overhead has no default');
        await layout(page,engine+'-'+role+'-'+width+'-calculation','#employerSalarySettings');
        await page.locator('#settingsSalarySaveCalculation').focus();await page.keyboard.press('Enter');
        eq(requests.filter(r=>r.path.endsWith('/salary-settings')).length,0,'blank settings cannot submit');
        await page.locator('#settingsSalaryHours').fill('1920');await page.locator('#settingsSalaryOverhead').fill('0');
        await page.locator('#settingsSalarySaveCalculation').focus();await page.keyboard.press('Enter');
        await page.waitForFunction(()=>!document.querySelector('#settingsSalaryHours')&&document.querySelector('#salaryCampaignSettings').textContent.includes('cannot be changed'));
      }
      eq(await page.locator('#settingsSalaryHours').count(),0,'saved settings are immutable in UI');
      ok((await page.locator('#salaryCampaignSettings').textContent()).includes('0% of base salary'),'zero overhead remains visible');
      await salaryFile(page);
      await page.locator('#settingsSalaryPreview').focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>!document.querySelector('#settingsSalarySave').disabled);
      ok(!(await page.locator('#employerSalarySettings').textContent()).includes(salary),'preview does not echo salary');
      ok(!JSON.stringify(await storage(page)).includes(salary),'salary is absent from persistent storage');
      await layout(page,engine+'-'+role+'-'+width+'-preview','#employerSalarySettings');
      await page.locator('#settingsSalarySave').focus();await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('#settingsSalaryResult').textContent.includes('Supplied salaries applied'));
      eq(await page.locator('#settingsSalaryFile').inputValue(),'','applied file cleared');
      eq(await page.locator('#settingsSalaryAuthority').isChecked(),false,'applied consent cleared');
      eq(await page.locator('#settingsSalarySave').isDisabled(),true,'apply cannot be repeated');
      const imports=requests.filter(r=>r.path.endsWith('/import-salaries'));eq(imports.length,2,'exactly preview and apply');
      ok(/name="preview_only"\r\n\r\ntrue/.test(imports[0].body),'preview true');ok(/name="preview_only"\r\n\r\nfalse/.test(imports[1].body),'apply false');
      await salaryFile(page);failImport=true;await page.locator('#settingsSalaryPreview').click();
      await page.waitForFunction(()=>document.querySelector('#settingsSalaryResult').textContent.includes('No salary changes'));
      ok(!(await page.locator('#settingsSalaryResult').textContent()).includes(salary),'server errors cannot echo salary');
      eq(await page.locator('#settingsSalarySave').isDisabled(),true,'failure invalidates preview');
      await page.locator('#salaryBatch').selectOption('campaign-b');
      eq(await page.locator('#settingsSalaryFile').inputValue(),'','campaign change clears selected file');eq(await page.locator('#settingsSalaryAuthority').isChecked(),false,'campaign change clears authority');
      if(role==='analyst'){
        eq(await page.locator('#settingsSalaryHours').count(),0,'Analyst has no settings editor');
        ok((await page.locator('#salaryCampaignSettings').textContent()).includes('An Admin must save'),'Analyst sees saved-settings requirement');
        eq(await page.locator('[data-salary-user]').count(),0,'Analyst has no delegation controls');
      }else{
        await page.locator('[data-salary-user="analyst-user"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-salary-user]')?.textContent.includes('Revoke'));
        await page.locator('[data-salary-user="analyst-user"]').click();
        await page.waitForFunction(()=>document.querySelector('[data-salary-user]')?.textContent.includes('Authorize'));
        eq(requests.filter(r=>r.path.endsWith('/salary-delegation')).length,2,'grant/revoke controls send correct changes');
      }
    }
    const settingsNav=page.locator('.ws5-nav a[href="workspace-settings.html"]');
    await settingsNav.focus();
    const nav=await settingsNav.evaluate(el=>{const r=el.getBoundingClientRect();return {focused:document.activeElement===el,left:r.left,right:r.right,width:innerWidth,href:el.getAttribute('href')};});
    ok(nav.focused&&nav.left>=0&&nav.right<=nav.width+1,'Settings navigation is keyboard reachable at '+width);
    eq(nav.href,'workspace-settings.html','Settings navigation destination');
    eq(fixture.pageErrors,[],'settings page no browser errors');eq(fixture.unexpected,[],'settings no unexpected API request');
    rows.push({engine,role,width,type:'settings',mockRequests:requests.map(({body,...r})=>r)});
  }catch(error){await page.screenshot({path:path.join(out,`FAILED-${engine}-${role}-${width}.png`),fullPage:true});throw error;}
  finally{await page.close();}
}

async function participantCase(browser,engine,tool,omit){
  const source=read(tool+'.html').toString();
  const fields=vm.runInNewContext(source.match(/const PRESTART_FIELDS = (\[[\s\S]*?\n\]);/)[1]);
  const active=fields.filter(field=>!omit||field.id!=='hourlyCost');
  const item={id:'browser-question',scorerField:'browser-question',dimension:'coordination',secondaryDimension:null,role:['managerial'],depth:[10],questionType:'numeric',text:{managerial:'Synthetic non-pay diagnostic question'},options:[],isOptional:false};
  const remote={ok:true,runId,role:'managerial',depth:10,questionnaire_version:tool==='decision-velocity'?'1.1.0':'1.3.0',configVersion:tool==='decision-velocity'?'1.1.0':'1.3.0',questionnaire_copy_version:'diagnostic-language-20260908',finalized:false,sessionCapability:'synthetic-capability',nextItem:item,shouldStop:false,sessionRevision:1,progress:{answered:0,total:10,progressPercent:0},answerHistory:[]};
  const fixture=await setup(browser,{api:async(url)=>{
    if(url.pathname.startsWith('/api/assignments/resolve/'))return {ok:true,assignment:{id:assignmentId,tool_type:tool.replaceAll('-','_'),participant_lens:'managerial',depth:10,depth_choice:false,is_anonymous_response:false,show_results_to_assignee:false,interview_mode:'guided',omit_hourly_cost_question:omit}};
    if(url.pathname===`/api/${tool}/run/start`||url.pathname===`/api/${tool}/run/${runId}`)return remote;
    if(url.pathname===`/api/${tool}/run/${runId}/answer`)return {...remote,nextItem:{...item,id:'browser-next',scorerField:'browser-next',text:{managerial:'Synthetic next non-pay diagnostic question'}},sessionRevision:2,progress:{answered:1,total:10,progressPercent:10}};
  }});
  const {page,requests}=fixture;
  try{
    await page.goto(origin+'/'+tool+'.html?assignment_token='+token,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.MondermanAssignment?.active());
    await page.locator('#pageLoader').waitFor({state:'hidden'});
    await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
    eq(await page.locator('#preflight_hourlyCost').count(),omit?0:1,'server capability controls the cost field');
    const observed=[];
    for(const definition of active){
      const field=page.locator('#preflightContextMount .field:visible'),id=await field.getAttribute('data-field-id');observed.push(id);
      eq(id,definition.id,'only the cost question is omitted; order stays intact');
      if(id==='processName')for(const width of [390,834,1440]){
        await page.setViewportSize({width,height:1000});
        await layout(page,[engine,tool,omit?'omitted':'manual',width].join('-'),'#preflightContextMount');
      }
      if(definition.kind==='select'){
        const option=definition.options.find(o=>o.value&&o.value!=='other');
        await field.locator(`[data-val="${option.value}"]`).click();
      }else await field.locator('input,textarea').first().fill(definition.kind==='number'?(id==='hourlyCost'?'91.27':'12'):id==='description'?'':'Synthetic '+id);
      await page.locator('.preflight-next').focus();await page.keyboard.press('Enter');
    }
    await page.waitForFunction(()=>document.querySelector('#questionTitle').textContent==='Synthetic non-pay diagnostic question');
    const start=requests.filter(req=>req.path.endsWith('/run/start'));eq(start.length,1,'one start after complete intake');
    const startBody=JSON.parse(start[0].body);eq(startBody.assignment_token,token,'assignment authority retained');
    if(omit)ok(!/hourlyCost|hourlyRate|annual_base_salary|salary_currency|benefits_overhead|annual_working_hours|98765\.43/.test(start[0].body),'participant start contains no pay or calculation inputs');
    else ok(start[0].body.includes('91.27'),'ordinary participant retains manually entered hourly cost');
    await page.locator('#questionBody input').fill('7');await page.locator('#continueBtn').click();
    await page.waitForFunction(()=>document.querySelector('#questionTitle').textContent==='Synthetic next non-pay diagnostic question');
    const answer=requests.filter(req=>req.path.endsWith('/answer'));eq(answer.length,1,'one ordinary answer');
    ok(!/annual_base_salary|salary_currency|benefits_overhead|annual_working_hours|98765\.43/.test(answer[0].body),'answer contains no supplied pay');
    const text=await page.locator('body').innerText();ok(!/annual base salary|salary upload|supplied salary|98765\.43/i.test(text),'participant sees no salary notice or salary value');
    const saved=JSON.stringify(await storage(page));ok(!/annual_base_salary|salary_currency|98765\.43/.test(saved),'participant storage contains no supplied pay');
    if(omit)ok(!/hourlyCost|hourlyRate/.test(saved),'omitted cost remains absent from participant draft');
    eq(fixture.pageErrors,[],'participant no browser errors');eq(fixture.unexpected,[],'participant no unexpected API request');
    rows.push({engine,tool,omit,type:'participant',observed,mockRequests:requests.map(({body,...r})=>r)});
  }catch(error){await page.screenshot({path:path.join(out,`FAILED-${engine}-${tool}-${omit}.png`),fullPage:true});throw error;}
  finally{await page.close();}
}

async function composerCase(browser,engine,width){
  const fixture=await setup(browser,{api:async(url,req,entry)=>{
    if(url.pathname.endsWith('/salary-capability'))return {ok:true,enabled:true,can_upload:true,can_configure:true,currency:'USD',notice_version:'employer-salary-20260923.1'};
    if(['/api/workspace/assignments/preview-batch','/api/workspace/assignments/send-batch'].includes(url.pathname)){
      ok(entry.body.includes(salary),'composer supplies salary only to the privileged campaign endpoint');
      ok(/name="salary_annual_working_hours"\r\n\r\n1920/.test(entry.body),'composer sends explicit annual hours');
      ok(/name="salary_benefits_overhead_percent"\r\n\r\n(?:0|20)/.test(entry.body),'composer sends explicit overhead');
      return {ok:true,ready_rows:[{email:'a@example.test'}],queued_count:1};
    }
  }});
  const {page,requests}=fixture;await page.setViewportSize({width,height:1000});
  try{
    await page.goto(origin+'/workspace-diagnostics.html#campaigns',{waitUntil:'domcontentloaded'});
    await page.locator('#salaryImportBox').waitFor({state:'visible'});
    await page.locator('#salaryImportBox summary').click();
    eq(await page.locator('#salaryAnnualHours').inputValue(),'','composer has no annual-hours default');
    eq(await page.locator('#salaryOverheadPercent').inputValue(),'','composer has no overhead default');
    await page.locator('#fPath').fill('Synthetic annual-pay campaign');
    await page.locator('#salaryFile').setInputFiles({name:'fixture.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.waitForFunction(()=>document.querySelector('#salaryImportResult').textContent.includes('supplied for 1'));
    await page.locator('#btnPreview').click();
    eq(requests.filter(r=>r.path.endsWith('/preview-batch')).length,0,'composer preview requires authority');
    await page.locator('#salaryAuthorization').check();await page.locator('#btnPreview').click();
    eq(requests.filter(r=>r.path.endsWith('/preview-batch')).length,0,'composer preview requires calculation values');
    await page.locator('#salaryAnnualHours').fill('1920');await page.locator('#salaryOverheadPercent').fill('0');
    await page.locator('#btnPreview').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.querySelector('#btnSend').disabled);
    ok(!(await page.locator('#previewOut').textContent()).includes(salary),'composer preview redacts salary');
    await captureViewport(page,'#salaryImportBox',`${engine}-composer-${width}`);
    const layoutResult=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    ok(layoutResult.scroll<=width+1,'composer salary settings fit '+JSON.stringify(layoutResult));
    await page.waitForFunction(()=>window.__fixtureDatabaseWrites.some(r=>r.table==='campaign_drafts'&&r.method==='upsert'));
    const drafts=await page.evaluate(()=>window.__fixtureDatabaseWrites.filter(r=>r.table==='campaign_drafts'));
    ok(!/98765\.43|annual_base_salary|salary_currency/.test(JSON.stringify(drafts)),'autosaved campaign drafts contain no pay');
    ok(!JSON.stringify(await storage(page)).includes(salary),'composer browser storage contains no pay');
    await page.locator('#salaryOverheadPercent').fill('20');
    eq(await page.locator('#btnSend').isDisabled(),true,'changed assumptions invalidate preview');
    await page.locator('#btnPreview').click();await page.waitForFunction(()=>!document.querySelector('#btnSend').disabled);
    await page.locator('#btnSend').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#sendOut').textContent.includes('Campaign created: 1'));
    eq(requests.filter(r=>r.path.endsWith('/send-batch')).length,1,'one synthetic send, intercepted before any delivery');
    eq(await page.locator('#salaryAuthorization').isChecked(),false,'send clears salary authority');
    eq(await page.locator('#salaryAnnualHours').inputValue(),'','send clears annual-hours input');
    // A newly selected salary file must be discarded when anonymity is chosen.
    await page.locator('#salaryFile').setInputFiles({name:'fixture.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.waitForFunction(()=>document.querySelector('#salaryImportResult').textContent.includes('supplied for 1'));
    await page.locator('.finetune summary').click();await page.locator('#fAnon').check();
    eq(await page.locator('#salaryImportBox').isVisible(),false,'anonymous campaign hides salary controls');
    eq(await page.locator('#salaryAnonymousNotice').isVisible(),true,'Admin sees anonymity reason');
    await page.locator('#fAnon').uncheck();
    eq(await page.locator('#salaryAuthorization').isChecked(),false,'anonymity resets salary authority');
    eq(await page.locator('#salaryImportResult').textContent(),'','anonymity clears supplied amounts');
    eq(fixture.pageErrors,[],'composer no browser errors');eq(fixture.unexpected,[],'composer no unexpected API requests');
    rows.push({engine,width,type:'composer',mockRequests:requests.map(({body,...r})=>r)});
  }catch(error){await page.screenshot({path:path.join(out,`FAILED-${engine}-composer-${width}.png`),fullPage:true});throw error;}
  finally{await page.close();}
}

try{
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true});
    try{
      for(const role of ['admin','analyst','member','disabled'])for(const width of [390,834,1440])await settingsCase(browser,engine,role,width);
      for(const width of [390,834,1440])await composerCase(browser,engine,width);
      for(const tool of ['decision-velocity','structural-clarity','operational-systems','institutional-performance'])for(const omit of [true,false])await participantCase(browser,engine,tool,omit);
    }finally{await browser.close();}
  }
}catch(error){errors.push(error.stack);throw error;}
finally{
  const sourceHashes=Object.fromEntries(['employer-salary-import.js','employer-salary-settings.js','assignment-mode.js','assignment-draft.js','workspace-settings.html','workspace-diagnostics.html','decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html'].map(file=>[file,createHash('sha256').update(read(file)).digest('hex')]));
  const receipt={status:errors.length?'FAIL':'PASS',assertions,cases:rows.length,mode:'real candidate pages, synthetic local API/auth fixtures; no live requests',networkRequestsSent:0,providerCalls:0,databaseIntegration:false,sourceHashes,rows,errors};
  fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:receipt.status,assertions,cases:rows.length,out}));
}
