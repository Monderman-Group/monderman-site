// Actual built instruments; every external request is intercepted. No live runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('.render-public');
const out = path.resolve(process.env.INTAKE_TEST_OUT || 'output/diagnostic-intake-browser');
fs.mkdirSync(out, {recursive:true});
const pages = process.env.INTAKE_TEST_PAGES?.split(',') || ['decision-velocity','structural-clarity','operational-systems','institutional-performance'];
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  let body = fs.readFileSync(file);
  if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fixture = `window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};`;
const gate = `window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId=null;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();`;
const values = {processName:'Approving a supplier',businessUnit:'Operations',employeeCount:'250',peopleInvolved:'8',hourlyCost:'90',annualVolume:'24',meetingHours:'4'};
const choices = {industry:'technology_software',regulatoryIntensity:'moderate',decisionType:'program'};
// Pre-change contracts from main 7d349ce: IDs, grouping, required flags, types,
// option values AND option labels. Editorial helpers cannot alter these silently.
const contractHashes = {
  'decision-velocity':'4f76c81b608b0e263c26a17cdb9bf6b616a7cab7c73d8e16a6aad4e51020ab1f',
  'structural-clarity':'4f76c81b608b0e263c26a17cdb9bf6b616a7cab7c73d8e16a6aad4e51020ab1f',
  'operational-systems':'1fcd0cbe64ad1295d9bc887fa1735be75e93222cedec7d9610dccb210341b12b',
  'institutional-performance':'4f76c81b608b0e263c26a17cdb9bf6b616a7cab7c73d8e16a6aad4e51020ab1f',
};
const evidence=[];
const browsers=[];
async function checkTargets(page, selector, label) {
  const targets = page.locator(selector);
  assert.ok(await targets.count(), `${label}: targets exist`);
  for (const target of await targets.all()) {
    if (!await target.isVisible()) continue;
    await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const data = await target.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const points=[[r.x+r.width/2,r.y+r.height/2],[r.x+6,r.y+6],[r.right-6,r.y+6],[r.x+6,r.bottom-6],[r.right-6,r.bottom-6]];
      const blocked=points.map(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit!==el&&!el.contains(hit)?{x,y,hit:hit?.outerHTML.slice(0,300)}:null;}).filter(Boolean);
      const clipped=[];
      for(let p=el.parentElement;p;p=p.parentElement){const pr=p.getBoundingClientRect(),s=getComputedStyle(p);if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.left<pr.left-.5||r.right>pr.right+.5))clipped.push(p.id||p.className);}
      let continueLines=1;
      if(el.firstChild?.nodeType===Node.TEXT_NODE&&el.firstChild.textContent.includes('Continue')){
        const range=document.createRange(),start=el.firstChild.textContent.indexOf('Continue');
        range.setStart(el.firstChild,start);range.setEnd(el.firstChild,start+8);continueLines=range.getClientRects().length;
      }
      return {text:el.textContent.trim(),rect:r.toJSON(),width:innerWidth,blocked,clipped,continueLines};
    });
    assert.ok(data.rect.left>=-.5&&data.rect.right<=data.width+.5, `${label}: offscreen ${JSON.stringify(data)}`);
    assert.ok(data.rect.height>=44, `${label}: short tap target ${JSON.stringify(data)}`);
    assert.deepEqual(data.clipped,[],`${label}: clipped ${JSON.stringify(data)}`);
    assert.deepEqual(data.blocked,[],`${label}: occluded ${JSON.stringify(data)}`);
    assert.equal(data.continueLines,1,`${label}: Continue split mid-word`);
  }
}
async function capture(page,name,browser,width,field,suffix='') {
  await page.setViewportSize({width,height:width>=768?1000:844});
  await checkTargets(page,'.preflight-pager button, .preflight-pager a',`${name}/${browser}/${width}/${field}${suffix}`);
  await page.locator('#preflightContextMount').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,field:document.querySelector('#preflightContextMount .field:not([style*="display: none"])')?.getBoundingClientRect().toJSON(),buttons:[...document.querySelectorAll('.preflight-pager button')].map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),font:getComputedStyle(el).fontSize})),widgets:[...document.querySelectorAll('.mdn-fb-launch,#mnd-launcher,.mdn-cn-launch')].map(el=>({id:el.id||el.className,visibility:getComputedStyle(el).visibility}))}));
  const filename=`${name}-${browser}-${width}-${field}${suffix}.png`;
  await page.screenshot({path:path.join(out,filename)});
  evidence.push({name,browser,width,field,suffix,filename,...layout});
  if(layout.scrollWidth>width+1){
    const overflowing=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(el=>({id:el.id,classes:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,text:el.textContent.slice(0,60)})).slice(0,20));
    assert.fail(`${name}/${browser}/${width}/${field}${suffix}: page overflow ${JSON.stringify(overflowing)}`);
  }
  assert.ok(layout.widgets.every(w=>w.visibility==='hidden'),`${name}: floating widget remains`);
}
try {
for (const [browserName,type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await type.launch({headless:true});browsers.push(browser);
  for(const name of pages){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript({content:fixture});
    const external=[],errors=[];
    await context.route('**/*',route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gate});
      if(url.origin===base)return route.continue();
      external.push({method:req.method(),path:url.pathname});
      if(url.hostname==='monderman-api.onrender.com')return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
      if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* local fixture */'});
      return route.abort();
    });
    // Cold desktop/tablet loads catch viewport-based min-content bugs that a
    // resize from an already loaded phone can miss in WebKit.
    for(const width of [768,1440]){
      const cold=await context.newPage();await cold.setViewportSize({width,height:1000});
      await cold.goto(`${base}/${name}.html`,{waitUntil:'domcontentloaded'});
      await cold.locator('#pageLoader').waitFor({state:'hidden'});
      const layout=await cold.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,footerParent:document.querySelector('.mond-footer')?.parentElement.tagName}));
      assert.ok(layout.scrollWidth<=width+1,`${browserName}/${name}/${width}: cold-load overflow ${JSON.stringify(layout)}`);
      assert.equal(layout.footerParent,'BODY',`${name}: footer must be outside instrument grid`);
      await cold.close();
    }
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/${name}.html`,{waitUntil:'domcontentloaded'});
    await page.locator('#pageLoader').waitFor({state:'hidden'});
    await page.waitForFunction(()=>!document.getElementById('pageLoader')||getComputedStyle(document.getElementById('pageLoader')).pointerEvents==='none');
    await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
    // Every role and run-length selection, including the previously missed executive route.
    for(const role of ['operational','managerial','executive']){
      if(name==='operational-systems')await checkTargets(page,'#laneStage .intake-actions button, #laneStage .intake-actions a',`${name}/${role}/role-before-selection`);
      await page.locator(`[data-lane="${role}"]`).click();
      // OS has an existing auto-advance UI; the other three use explicit Continue.
      if(name!=='operational-systems'){
        await checkTargets(page,'#laneStage .intake-actions button, #laneStage .intake-actions a',`${name}/${role}/role`);
        await page.locator('#laneContinueBtn').click();
      }else assert.equal(await page.locator('#depthStage').isVisible(),true);
      for(const depth of ['30','60','10']){
        if(name==='operational-systems')await checkTargets(page,'#depthStage .intake-actions button, #depthStage .intake-actions a',`${name}/${role}/${depth}/length-before-selection`);
        await page.locator(`[data-depth="${depth}"]`).click();
        if(name==='operational-systems'){
          assert.equal(await page.locator('#introStage').isVisible(),true);
          if(depth!=='10'||role!=='executive')await page.locator('.preflight-gate-back').click();
        }else await checkTargets(page,'#depthStage .intake-actions button, #depthStage .intake-actions a',`${name}/${role}/${depth}/length`);
      }
      if(role!=='executive')await page.locator('#depthStage [data-intake-back="laneStage"]').click();
    }
    if(name!=='operational-systems')await page.locator('#depthContinueBtn').click();
    await page.locator('.preflight-gate-next').click();
    assert.equal(await page.locator('#preStartConsent').isChecked(),false);
    assert.equal(await page.locator('#preflightContextMount').isVisible(),false,'consent is still required');
    await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
    await page.locator('.preflight-next').click();
    await page.waitForFunction(()=>document.getElementById('preflight_processName')?.getAttribute('aria-invalid')==='true');
    assert.equal(await page.locator('#preflight_processName_error').textContent(),'Enter a short answer to continue.');
    const source=fs.readFileSync(`${name}.html`,'utf8');
    const fields=vm.runInNewContext(source.match(/const PRESTART_FIELDS = (\[[\s\S]*?\n\]);/)[1]);
    const contract=fields.map(({label,placeholder,helper,...rest})=>rest);
    assert.equal(createHash('sha256').update(JSON.stringify(contract)).digest('hex'),contractHashes[name],`${name}: intake value contract changed`);
    assert.ok(fields.every(field=>!/decision cycle|pathway context|calibrat/i.test([field.label,field.placeholder,field.helper].join(' '))),`${name}: old intake jargon returned`);
    assert.equal(fields.length,name==='operational-systems'?10:11);
    assert.equal(fields.filter(f=>!f.required).map(f=>f.id).join(','),'description');
    for(let i=0;i<fields.length;i++){
      const field=page.locator('#preflightContextMount .field:visible'),id=await field.getAttribute('data-field-id');
      assert.ok(fields.some(f=>f.id===id));
      await checkTargets(page,'.preflight-pager button, .preflight-pager a',`${name}/${id}`);
      const control=field.locator('input:not(.opt-other-input), textarea, select').first();
      if(id==='processName'||id==='description'){
        for(const width of [320,390,393,402,768,1024,1440])await capture(page,name,browserName,width,id);
        await page.setViewportSize({width:390,height:844});
      }
      if(id==='description'){
        assert.match(await field.locator('label').textContent(),/\(optional\)/);
        assert.match(await field.locator('.intake-field-help').textContent(),/leave it blank/);
        assert.equal(await control.getAttribute('aria-required'),'false');
        // Enlarge all text, including legacy fixed-pixel rules, without shrinking viewport.
        await page.evaluate(()=>{window.__intakeFontRestore=[...document.body.querySelectorAll('*')].map(el=>({el,old:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size'),size:parseFloat(getComputedStyle(el).fontSize)}));for(const e of window.__intakeFontRestore)e.el.style.setProperty('font-size',`${e.size*2}px`,'important');});
        for(const width of [390,768,1440])await capture(page,name,browserName,width,id,'-200percent');
        await page.evaluate(()=>{for(const e of window.__intakeFontRestore){if(e.old)e.el.style.setProperty('font-size',e.old,e.priority);else e.el.style.removeProperty('font-size');}delete window.__intakeFontRestore;});
        await page.setViewportSize({width:390,height:500});
        await control.focus();
        await checkTargets(page,'.preflight-pager button, .preflight-pager a',`${name}/short-viewport`);
        await page.setViewportSize({width:390,height:844});
        // Leave the optional note blank, go back, and confirm it stays blank.
        await page.locator('.preflight-next').click();await page.locator('.preflight-back').click();
        assert.equal(await page.locator('#preflight_description').inputValue(),'');
      }else if(choices[id]){
        const group=field.locator('[role="radiogroup"]');
        if(await group.count()){
          await group.locator('[role="radio"]').first().focus();await page.keyboard.press('End');
          assert.equal(await field.locator('select').inputValue(),fields.find(f=>f.id===id).options.at(-1).value);
          await field.locator(`[data-val="${choices[id]}"]`).click();
          assert.equal(await group.locator('[tabindex="0"]').count(),1);
        }else await control.selectOption(choices[id]);
      }else{
        if(id==='employeeCount'){
          await control.fill('not a number');await page.locator('.preflight-next').click();
          assert.equal(await field.locator('.field-error-msg').textContent(),'Enter a number to continue.');
        }
        await control.fill(values[id]);
        assert.ok(parseFloat(await control.evaluate(el=>getComputedStyle(el).fontSize))>=16,'no small iOS-zoom input');
      }
      if(i<fields.length-1)await page.locator('.preflight-next').click();
    }
    // Support remains reachable in normal flow; do not send a feedback/chat request.
    await checkTargets(page,'.diagnostic-support button,.diagnostic-support a',`${name}/support`);
    for(const [action,panel,openClass,close] of [['feedback','#mdn-fb-panel','mdn-fb-open','.mdn-fb-x'],['assistant','#mnd-panel','mnd-open','#mnd-close']]){
      const trigger=page.locator(`[data-intake-support="${action}"]`);
      await trigger.click();await page.waitForFunction(({panel,openClass})=>document.querySelector(panel)?.classList.contains(openClass),{panel,openClass});
      await page.keyboard.press('Escape');
      await page.waitForFunction(panel=>!document.querySelector(panel)?.classList.contains('mdn-fb-open')&&!document.querySelector(panel)?.classList.contains('mnd-open'),panel);
      await page.waitForFunction(action=>document.activeElement===document.querySelector(`[data-intake-support="${action}"]`),action);
      assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,`${browserName}/${name}/${action}: Escape focus return`);
      await trigger.click();await page.locator(close).click();
      await page.waitForFunction(action=>document.activeElement===document.querySelector(`[data-intake-support="${action}"]`),action);
      assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,`${browserName}/${name}/${action}: close focus return`);
    }
    assert.equal(external.filter(r=>/\/run\/start|\/answer$|\/finalize$|\/feedback$|\/chat$|\/otp/.test(r.path)).length,0,'intake never starts/adopts a production or fixture run');
    assert.deepEqual(errors,[],`${name}: browser exceptions`);
    console.log(`${browserName} ${name}: roles, lengths, ${fields.length} fields, phone/tablet/desktop, 200% text, short viewport, support passed`);
    await context.close();
  }
}
}finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));
  for(const browser of browsers)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log(`DIAGNOSTIC_INTAKE_PASS: ${evidence.length} layout captures; all external services intercepted`);
