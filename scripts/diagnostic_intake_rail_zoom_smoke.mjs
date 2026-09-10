// Actual source-page layout; local synthetic intake only. No real account/run/provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('.');
const out=path.resolve(process.env.INTAKE_RAIL_OUT||'output/diagnostic-intake-rail-zoom');
fs.mkdirSync(out,{recursive:true});
const names=['structural-clarity','decision-velocity','operational-systems','institutional-performance'];
const widths=[320,390,768,1440];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pinnedNames=[...names.map(name=>`${name}.html`),'diagnostic-intake.css','diagnostic-intake.js','scripts/diagnostic_intake_rail_zoom_smoke.mjs'];
const sourcePins=Object.fromEntries(pinnedNames.map(name=>[name,sha(fs.readFileSync(name))]));
const servedPins=new Map();
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let body=fs.readFileSync(file);
  const hash=sha(body);
  if(servedPins.has(file))assert.equal(hash,servedPins.get(file),`served source changed: ${file}`);
  servedPins.set(file,hash);
  // The external Supabase library is replaced by the same local no-account fixture
  // as the existing intake suite. Remove only its now-inapplicable SRI attribute.
  if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const authFixture=`window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};`;
const gateFixture=`window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId=null;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();`;
const values={processName:'Approving a supplier',businessUnit:'Operations',employeeCount:'250',peopleInvolved:'8',hourlyCost:'90',annualVolume:'24',meetingHours:'4'};
const choices={industry:'technology_software',regulatoryIntensity:'moderate',decisionType:'program'};
const results=[],negativeControls=[],browsers=[],intercepted=[];
let pass=false;

async function textContainment(page){
  return page.locator('#introStage .intake-sidebar').evaluate(rail=>{
    const railRect=rail.getBoundingClientRect();
    return [...rail.querySelectorAll('.calibration-step-label,.calibration-step-value')].map(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      const rects=[...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>r.toJSON());
      const tile=el.closest('.calibration-item').getBoundingClientRect();
      const wrapper=el.closest('.calibration-text').getBoundingClientRect();
      const violations=rects.filter(r=>r.left<wrapper.left-1||r.right>wrapper.right+1||r.left<tile.left-1||r.right>tile.right+1||r.left<railRect.left-1||r.right>railRect.right+1||r.top<tile.top-1||r.bottom>tile.bottom+1);
      return {text:el.textContent,rects,tile:tile.toJSON(),wrapper:wrapper.toJSON(),font:getComputedStyle(el).fontSize,overflowWrap:getComputedStyle(el).overflowWrap,violations};
    });
  });
}
async function enlarge(page){
  await page.evaluate(()=>{
    window.__railFontRestore=[...document.body.querySelectorAll('*')].map(el=>({el,old:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size'),size:parseFloat(getComputedStyle(el).fontSize)}));
    for(const entry of window.__railFontRestore)entry.el.style.setProperty('font-size',`${entry.size*2}px`,'important');
  });
}
async function restore(page){
  await page.evaluate(()=>{
    for(const entry of window.__railFontRestore||[]){
      if(entry.old)entry.el.style.setProperty('font-size',entry.old,entry.priority);
      else entry.el.style.removeProperty('font-size');
    }
    delete window.__railFontRestore;
  });
}
async function finalPair(page,label){
  const row=page.locator('.preflight-pager .intake-actions-right');
  await row.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const data=await row.evaluate(el=>{
    const buttons=[...el.querySelectorAll('button')].map(button=>{
      const rect=button.getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(button);
      const textRects=[...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>r.toJSON());
      const points=[[rect.x+rect.width/2,rect.y+rect.height/2],[rect.x+6,rect.y+6],[rect.right-6,rect.bottom-6]];
      const blocked=points.filter(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit!==button&&!button.contains(hit);});
      return {text:button.textContent.trim(),rect:rect.toJSON(),textRects,font:getComputedStyle(button).fontSize,blocked};
    });
    return {buttons,row:el.getBoundingClientRect().toJSON(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  });
  assert.equal(data.buttons.length,2,`${label}: action count`);
  assert.equal(data.buttons[0].text,'← Back',`${label}: Back label`);
  assert.equal(data.buttons[1].text,'Begin Diagnostic →',`${label}: actual final action, not Continue`);
  for(const button of data.buttons){
    const r=button.rect;
    assert.ok(r.width>0&&r.height>=47.5,`${label}: touch size ${JSON.stringify(button)}`);
    assert.ok(r.left>=data.row.left-1&&r.right<=data.row.right+1&&r.left>=-1&&r.right<=data.width+1,`${label}: containment`);
    assert.deepEqual(button.blocked,[],`${label}: action occlusion`);
    assert.ok(button.textRects.every(t=>t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1),`${label}: button text clipped`);
  }
  const [back,next]=data.buttons.map(b=>b.rect),sameRow=Math.abs(back.top-next.top)<=1;
  if(sameRow){
    assert.ok(Math.abs(back.height-next.height)<=1,`${label}: paired heights`);
    assert.ok(next.left-back.right>=10,`${label}: horizontal separation`);
  }else assert.ok(next.top-back.bottom>=10,`${label}: vertical separation`);
  assert.ok(data.scrollWidth<=data.width+1,`${label}: horizontal document overflow`);
  return data;
}

try{
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true});browsers.push(browser);
    for(const name of names){
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
      await context.addInitScript({content:authFixture});
      const requests=[],errors=[];
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gateFixture});
        if(url.origin===base)return route.continue();
        requests.push({method:request.method(),host:url.hostname,path:url.pathname});
        if(url.hostname==='monderman-api.onrender.com')return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
        if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* local fixture */'});
        return route.abort();
      });
      const page=await context.newPage();page.setDefaultTimeout(15000);
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${base}/${name}.html`,{waitUntil:'domcontentloaded'});
      await page.locator('#pageLoader').waitFor({state:'hidden'});
      await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
      await page.locator('[data-lane="executive"]').click();
      if(name!=='operational-systems')await page.locator('#laneContinueBtn').click();
      await page.locator('[data-depth="10"]').click();
      if(name!=='operational-systems')await page.locator('#depthContinueBtn').click();
      await page.locator('#preStartConsent').check();await page.locator('.preflight-gate-next').click();
      const source=fs.readFileSync(`${name}.html`,'utf8');
      const fields=vm.runInNewContext(source.match(/const PRESTART_FIELDS = (\[[\s\S]*?\n\]);/)[1]);
      for(let i=0;i<fields.length;i++){
        const field=page.locator('#preflightContextMount .field:visible');
        const id=await field.getAttribute('data-field-id');
        assert.equal(id,fields[i].id,`${name}: ordinary ordered setup fields`);
        const control=field.locator('input:not(.opt-other-input),textarea,select').first();
        if(choices[id]){
          const radio=field.locator(`[role="radio"][data-val="${choices[id]}"]`);
          if(await radio.count())await radio.click();else await control.selectOption(choices[id]);
        }else if(id!=='description'){
          assert.ok(values[id],`${name}: explicit fixture value for ${id}`);
          await control.fill(values[id]);
        }
        if(i<fields.length-1)await page.locator('.preflight-next').click();
      }
      for(const width of widths){
        await page.setViewportSize({width,height:width>=768?1000:844});
        const baselineFonts=(await textContainment(page)).map(entry=>parseFloat(entry.font));
        for(const scale of [100,200]){
          if(scale===200)await enlarge(page);
          const label=`${name}-${engine}-${width}-${scale}percent`;
          const rail=await textContainment(page);
          assert.equal(rail.length,6,`${label}: three labels and three values`);
          for(const [i,entry] of rail.entries()){
            assert.ok(entry.rects.length>0,`${label}: actual text rects`);
            assert.deepEqual(entry.violations,[],`${label}: clipped rail text ${JSON.stringify(entry)}`);
            assert.ok(Math.abs(parseFloat(entry.font)-baselineFonts[i]*(scale/100))<=.1,`${label}: requested text enlargement retained`);
          }
          // A local CSS-only negative control recreates the original 200% desktop
          // failure; no source bytes are edited and the override is removed immediately.
          if(name==='operational-systems'&&width===1440&&scale===200){
            const oldRule=await page.addStyleTag({content:'#introStage .calibration-step-label,#introStage .calibration-step-value{overflow-wrap:normal!important;word-break:normal!important}'});
            const broken=await textContainment(page);
            assert.ok(broken.some(entry=>entry.text==='Perspective'&&entry.violations.length),`${engine}: pre-fix rail overflow must be detected`);
            negativeControls.push({engine,name,width,scale,detected:broken.filter(entry=>entry.violations.length)});
            await oldRule.evaluate(el=>el.remove());
            assert.ok((await textContainment(page)).every(entry=>!entry.violations.length),`${engine}: corrected CSS restored after negative control`);
          }
          const railFile=`${label}-rail.png`;
          await page.locator('#introStage .intake-sidebar').screenshot({path:path.join(out,railFile)});
          const pair=await finalPair(page,label);
          const finalFile=`${label}-final-begin.png`;
          await page.screenshot({path:path.join(out,finalFile)});
          results.push({name,engine,width,scale,rail,pair,railFile,railSha256:sha(fs.readFileSync(path.join(out,railFile))),finalFile,finalSha256:sha(fs.readFileSync(path.join(out,finalFile)))});
          if(scale===200)await restore(page);
        }
      }
      assert.deepEqual(errors,[],`${name}/${engine}: browser errors`);
      // DV emits ordinary first-run telemetry during setup. It was fulfilled
      // locally above, never sent; no other non-GET request is allowed.
      assert.deepEqual(requests.filter(request=>request.method!=='GET'&&!(request.method==='POST'&&request.host==='monderman-api.onrender.com'&&request.path==='/api/first-run-events')),[],`${name}/${engine}: no non-fixture mutations, starts, answers, or admissions`);
      assert.equal(requests.filter(request=>/\/run\/|\/answer$|\/finalize$|\/feedback$|\/chat$|\/otp/.test(request.path)).length,0,`${name}/${engine}: no run/provider requests`);
      intercepted.push({name,engine,requests});
      console.log(`${name}/${engine}: 320/390/768/1440 rail + final Back/Begin at 100% and 200% passed`);
      await context.close();
    }
  }
  for(const [file,hash] of servedPins)assert.equal(sha(fs.readFileSync(file)),hash,`served source changed after capture: ${file}`);
  assert.deepEqual(Object.fromEntries(pinnedNames.map(name=>[name,sha(fs.readFileSync(name))])),sourcePins,'source changed during test');
  assert.equal(results.length,64);assert.equal(negativeControls.length,2);pass=true;
}finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({pass,sourcePins,servedPins:Object.fromEntries(servedPins),results,negativeControls,intercepted,scope:'Local actual source HTML/CSS; synthetic no-account setup; no final Begin click or production/provider request'},null,2));
  for(const browser of browsers)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log(`INTAKE_RAIL_ZOOM_PASS: ${results.length} layouts, ${results.length*2} screenshots, ${negativeControls.length} detected pre-fix negative controls; source hashes unchanged`);
