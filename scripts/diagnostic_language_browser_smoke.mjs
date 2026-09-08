// Actual question rendering with fixture answers; no production admissions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('.render-public');
const api=path.resolve(process.env.LANGUAGE_API_ROOT||'../monderman-api-first-run');
const out=path.resolve(process.env.LANGUAGE_BROWSER_OUT||'output/diagnostic-language-browser');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);
  if(file.endsWith('.html')){
    let html=body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1');
    // Test-only hook into the closure. This served fixture is never published.
    html=html.replace('function renderQuestion() {',
      "queueMicrotask(()=>{window.__languageTest={optional(mode){state.mode=mode;state.roleForText=mode==='executive'?'senior_leader':mode;state.depth='60';state.started=true;return getExperiencePromptSet().map((p,i)=>buildExperienceQuestion(i));},render(item){state.currentItem=item;state.answerCache={};state.currentProgress={answered:0,total:10};showStage(questionStage,{scroll:false});renderQuestion();}};});\nfunction renderQuestion() {");
    body=Buffer.from(html);
  }
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const fixture="window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};";
const gate="window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId=null;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();";
const specs={'decision-velocity':'decisionVelocity','structural-clarity':'structuralClarity','operational-systems':'operationalSystems','institutional-performance':'institutionalPerformance'};
const evidence=[],errors=[],requests=[];
let browser;
try{
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  browser=await type.launch({headless:true});
  for(const [name,stem] of Object.entries(specs)){
    const config=JSON.parse(fs.readFileSync(path.join(api,'configs',stem+'RoutingConfig.json')));
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.addInitScript({content:fixture});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gate});
      if(url.origin===base)return route.continue();
      requests.push({method:route.request().method(),path:url.pathname});
      if(url.hostname==='monderman-api.onrender.com')return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
      if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* fixture */'});
      return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(engine+'/'+name+': '+e.message));
    await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});
    await page.locator('#pageLoader').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.getElementById('pageLoader')?.classList.contains('hidden'));
    await page.waitForFunction(()=>!document.getElementById('pageLoader')||getComputedStyle(document.getElementById('pageLoader')).visibility==='hidden');
    await page.addStyleTag({content:'html{scroll-behavior:auto!important} .question-card{transition:none!important;animation:none!important}'});
    for(const role of ['operational','managerial','senior_leader']){
      const mode=role==='senior_leader'?'executive':role;
      const items=config.items.filter(i=>i.role.includes(role));
      const longest=items.reduce((a,b)=>(a.text[role].length+(a.options||[]).map(o=>o.label).join('').length)>(b.text[role].length+(b.options||[]).map(o=>o.label).join('').length)?a:b);
      const optional=await page.evaluate(mode=>window.__languageTest.optional(mode),mode);
      for(const item of [...items,...optional]){
        await page.evaluate(item=>window.__languageTest.render(item),item);
        const expected=typeof item.text==='string'?item.text:item.text[role];
        await page.waitForFunction(expected=>document.getElementById('questionTitle').textContent===expected,expected);
        if (item.isExperienceLayer) assert.equal(await page.locator('#questionCluster').textContent(), 'Your observations');
        for(const width of [390,768,1440]){
          await page.setViewportSize({width,height:width>=768?1000:844});
          await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
          await page.locator('#questionStage').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
          const checks=await page.evaluate(()=>{
            const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
            const nodes=[...document.querySelectorAll('#questionTitle,#questionCopy,#questionBody button,#questionBody input,#questionBody textarea,#questionFooter button')].filter(visible);
            return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,targets:nodes.map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id,text:el.textContent.trim(),left:r.left,right:r.right,height:r.height,scroll:el.scrollWidth,width:el.clientWidth};})};
          });
          if(checks.scrollWidth>width+1){
            const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).slice(0,15).map(el=>({tag:el.tagName,id:el.id,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,text:el.textContent.slice(0,80)})));
            await page.screenshot({path:path.join(out,'FAIL-'+engine+'-'+name+'-'+item.id+'-'+width+'.png')});
            assert.fail(engine+'/'+name+'/'+item.id+'/'+width+': document overflow '+JSON.stringify(overflow));
          }
          for(const target of checks.targets){
            assert.ok(target.left>=-1&&target.right<=width+1,engine+'/'+name+'/'+item.id+'/'+width+': offscreen '+JSON.stringify(target));
            assert.ok(target.scroll<=target.width+1,engine+'/'+name+'/'+item.id+'/'+width+': clipped text '+JSON.stringify(target));
            if(target.tag==='BUTTON')assert.ok(target.height>=44,'short answer target '+JSON.stringify(target));
          }
          evidence.push({engine,name,role,item:item.id,width,eligibleDepths:item.depth||[10,30,60],...checks});
          if(item.id===longest.id||optional.some(o=>o.id===item.id))await page.screenshot({path:path.join(out,[name,engine,role,item.id.replace(/[^\w-]/g,''),width].join('-')+'.png')});
        }
      }
    }
    console.log(engine+' '+name+': every role-specific item and optional prompt rendered at phone/tablet/desktop widths');
    await context.close();
  }
  await browser.close();browser=null;
}
assert.deepEqual(errors,[]);
assert.equal(requests.filter(r=>/\/run\/start|\/answer$|\/finalize$|\/otp/.test(r.path)).length,0);
console.log('DIAGNOSTIC_LANGUAGE_BROWSER_PASS '+evidence.length+' layouts; synthetic rendering, not admissions or comprehension testing');
}finally{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({evidence,errors,requests},null,2));
 await browser?.close();await new Promise(r=>server.close(r));
}
