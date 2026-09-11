// Actual instrument renderer + built CSS. In-memory hooks only; no run starts,
// finalizations, emails, provider calls, or production requests are made.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium,webkit} from 'playwright';
const root=path.resolve('.render-public'),out=process.env.NOTE_TEST_OUT||'/tmp/monderman-note-permission-ui';
fs.mkdirSync(out,{recursive:true});
const names=['decision-velocity','structural-clarity','operational-systems','institutional-performance'];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);
  if(file.endsWith('.html')){
    let text=body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1');
    const marker='getState: () => state,';
    assert(text.includes(marker));
    text=text.replace(marker,'permissionTestRender: renderQuestionContent, '+marker);body=Buffer.from(text);
  }
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const errors=[],checks=[],blocked=[];
try{for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{for(const tool of names){
    const context=await browser.newContext();
    await context.addInitScript(()=>{window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};});
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:'window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:"public_first_run"});window.__mondermanReveal?.();'});
      if(u.origin===base)return route.continue();
      blocked.push({method:route.request().method(),path:u.pathname});
      if(u.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* intercepted */'});
      return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push({tool,name,error:e.message}));
    async function mount(runId='note-fixture-one',experience=true){await page.evaluate(({runId,experience})=>{
      const hooks=window.__mondermanTestHooks,state=hooks.getState();state.runId=runId;state.answerCache={};
      const item={id:'permission-observation',questionType:'text',isOptional:true,isExperienceLayer:experience};
      const body=document.getElementById('questionBody');body.replaceChildren(hooks.permissionTestRender(item));
      document.querySelectorAll('.stage').forEach(el=>el.classList.toggle('active',el.id==='questionStage'));
      document.getElementById('questionTitle').textContent='What have you observed?';
      document.getElementById('pageLoader')?.remove();
    },{runId,experience});}
    await page.goto(base+'/'+tool+'.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mondermanTestHooks&&window.MondermanNotePermission);
    await mount();const checkbox=page.locator('.diagnostic-note-permission input');
    assert.equal(await checkbox.isChecked(),false);assert.equal(await checkbox.getAttribute('required'),null);
    assert.equal(await page.evaluate(()=>window.MondermanNotePermission.value('note-fixture-one')),undefined);
    await checkbox.focus();await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(()=>window.MondermanNotePermission.value('note-fixture-one')),{version:'2026-09-11-ai-evidence-v1',allowed:true});
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mondermanTestHooks&&window.MondermanNotePermission);await mount();assert(await checkbox.isChecked(),'same-run choice survives refresh');
    await mount('note-fixture-two');assert.equal(await checkbox.isChecked(),false,'no consent inherited by another run');
    await mount();await checkbox.uncheck();assert.equal(await page.evaluate(()=>window.MondermanNotePermission.value('note-fixture-one')),undefined);
    for(const width of [320,390,834,1440]){
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);await checkbox.scrollIntoViewIfNeeded();
      const layout=await checkbox.evaluate(el=>{const r=el.closest('label').getBoundingClientRect();return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,height:r.height};});
      assert(layout.scrollWidth<=width+1&&layout.left>=0&&layout.right<=width+1,JSON.stringify({tool,name,width,layout}));assert(layout.height>=44);
      await page.locator('.diagnostic-note-permission').screenshot({path:path.join(out,`${tool}-${name}-${width}.png`)});checks.push({tool,name,width,unchecked:true,refresh:true,runIsolation:true,keyboard:true,overflow:false});
    }
    await mount('note-fixture-one',false);assert.equal(await page.locator('.diagnostic-note-permission').count(),0,'ordinary scored answers have no note permission checkbox');
    const source=fs.readFileSync(tool+'.html','utf8');assert.match(source,/notes_processing_permission: window\.MondermanNotePermission\?\.value\(state\.runId\),/);
    await context.close();
  }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,errors,blocked,productionRequests:0},null,2));console.log(JSON.stringify({status:'PASS',renders:checks.length,productionRequests:0,out}));
