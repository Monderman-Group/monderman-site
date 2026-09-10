// Local built pages only. All external requests are intercepted; never start a run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('.render-public');
const out = path.resolve(process.env.INTAKE_FOCUS_OUT || 'output/diagnostic-intake-focus');
fs.mkdirSync(out, {recursive:true});
const pages = ['operational-systems','decision-velocity','structural-clarity','institutional-performance'];
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  let body = fs.readFileSync(file);
  if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type',mime[path.extname(file)] || 'application/octet-stream');res.end(body);
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fixture = `window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};`;
const gate = `window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.__mondermanActiveOrganizationId=null;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();`;
const values = {processName:'Supplier onboarding',businessUnit:'Operations',employeeCount:'250',peopleInvolved:'8',hourlyCost:'90',annualVolume:'24',meetingHours:'4',description:'Synthetic local fixture only.'};
const evidence = [];
const edgeEvidence = [];
const sourcePins = Object.fromEntries([...pages.map(name=>`${name}.html`),'diagnostic-intake.js','diagnostic-intake.css'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const browsers = [];
let error;

async function naturalFocus(page, id, label) {
  // Wait for the application's existing delayed focus, without calling focus ourselves.
  await page.waitForTimeout(120);
  const state = await page.evaluate(id => {
    const field = document.querySelector(`[data-field-id="${id}"]`);
    const choices = [...field.querySelectorAll('[role="radio"]')];
    const expected = choices.find(el => el.getAttribute('aria-checked') === 'true') || choices[0]
      || field.querySelector('input:not(.opt-other-input),textarea,select');
    const active = document.activeElement;
    const badAncestors = [];
    for (let el=active;el;el=el.parentElement) {
      const style=getComputedStyle(el);
      if (el.hidden || el.inert || el.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') badAncestors.push(el.id || el.tagName);
    }
    return {id, expected:expected?.id || expected?.getAttribute('data-val'),active:active?.id || active?.getAttribute('data-val'),matches:active===expected,badAncestors,hasBox:!!active?.getClientRects().length,mirror:!!active?.matches('.opt-choice-mirror'),kind:choices.length?'radio':expected?.tagName};
  },id);
  evidence.push({label,...state});
  assert.equal(state.matches,true,`${label}: natural setup focus is incorrect: ${JSON.stringify(state)}`);
  assert.deepEqual(state.badAncestors,[],`${label}: focused control is hidden or inert`);
  assert.equal(state.hasBox,true,`${label}: focused control has no rendered box`);
  assert.equal(state.mirror,false,`${label}: mirror select must never receive focus`);
}

function focusEdgeCases(name) {
  // Execute the actual delayed-focus block with bounded DOM doubles. These
  // complement real-page tests for states the ordinary fixture does not create.
  const source=fs.readFileSync(`${name}.html`,'utf8');
  const block=source.match(/      var focusField = fieldEls\[idx\];[\s\S]*?      \}, 60\);/)[0];
  for (const kind of ['selected-radio','first-radio','text','textarea','native-select','hidden','inert','aria-hidden','css-hidden','no-box','disconnected','superseded-step']) {
    const calls=[],timers=[];
    const control = label => ({label,isConnected:kind!=='disconnected',
      closest:()=>['hidden','inert','aria-hidden'].includes(kind)?{kind}:null,
      getClientRects:()=>kind==='no-box'?[]:[{}],
      focus:options=>calls.push({label,options})});
    const selected=control('selected'),first=control('first'),normal=control(kind);
    const field={querySelector:selector=>selector.includes('aria-checked')?(kind==='selected-radio'?selected:null):selector==='.opt-choice'?(['selected-radio','first-radio'].includes(kind)?first:null):normal};
    const sandbox={fieldEls:[field,{}],idx:0,setTimeout:fn=>timers.push(fn),getComputedStyle:()=>({visibility:kind==='css-hidden'?'hidden':'visible'})};
    vm.runInNewContext(block,sandbox);
    if(kind==='superseded-step')sandbox.idx=1;
    timers.forEach(fn=>fn());
    const shouldFocus=['selected-radio','first-radio','text','textarea','native-select'].includes(kind);
    assert.equal(calls.length,shouldFocus?1:0,`${name}/${kind}: delayed focus guard`);
    if(shouldFocus)assert.equal(calls[0].label,kind==='selected-radio'?'selected':kind==='first-radio'?'first':kind);
    edgeEvidence.push({name,kind,focusCalls:calls.length});
  }
}

try {
  for (const [browserName,type] of [['chromium',chromium],['webkit',webkit]]) {
    const browser=await type.launch({headless:true});browsers.push(browser);
    for (const name of pages) {
      const context=await browser.newContext({viewport:{width:390,height:844}});
      await context.addInitScript({content:fixture});
      const mutations=[],errors=[];
      await context.route('**/*',route=>{
        const req=route.request(),url=new URL(req.url());
        if (url.pathname.endsWith('/workspace-access-gate.js')) return route.fulfill({contentType:'application/javascript',body:gate});
        if (url.origin===base) return route.continue();
        if (!['GET','HEAD'].includes(req.method())) mutations.push({method:req.method(),path:url.pathname});
        if (url.hostname==='monderman-api.onrender.com') return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
        if (url.pathname.includes('@supabase/')) return route.fulfill({contentType:'application/javascript',body:'/* local fixture */'});
        return route.abort();
      });
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/${name}.html`,{waitUntil:'domcontentloaded'});
      await page.locator('#pageLoader').waitFor({state:'hidden'});
      await page.locator('[data-lane="operational"]').click();
      if (name!=='operational-systems') await page.locator('#laneContinueBtn').click();
      await page.locator('[data-depth="10"]').click();
      if (name!=='operational-systems') await page.locator('#depthContinueBtn').click();
      await page.locator('#preStartConsent').check();
      await page.locator('.preflight-gate-next').click();
      const fields=vm.runInNewContext(fs.readFileSync(`${name}.html`,'utf8').match(/const PRESTART_FIELDS = (\[[\s\S]*?\n\]);/)[1]);
      const chosen={};
      for (let index=0;index<fields.length;index++) {
        const def=fields[index];
        await naturalFocus(page,def.id,`${browserName}/${name}/${def.id}/forward`);
        const field=page.locator(`[data-field-id="${def.id}"]`);
        if (def.kind==='select') {
          // Native keyboard actions begin from the focus delivered by the application.
          await page.keyboard.press('End');
          assert.equal(await field.locator('select').inputValue(),def.options.at(-1).value);
          await page.keyboard.press('Home');
          await page.keyboard.press('ArrowDown');
          chosen[def.id]=def.options.filter(opt=>opt.value)[1].value;
          assert.equal(await field.locator('select').inputValue(),chosen[def.id]);
          assert.equal(await field.locator('[role="radio"][tabindex="0"]').count(),1);
        } else await field.locator('input:not(.opt-other-input),textarea').fill(values[def.id]);
        if (index<fields.length-1) await page.locator('.preflight-next').click();
      }
      // Return naturally to every answered field. Selected radios must be restored, not reset.
      for (let index=fields.length-2;index>=0;index--) {
        await page.locator('.preflight-back').click();
        const def=fields[index];
        await naturalFocus(page,def.id,`${browserName}/${name}/${def.id}/back`);
        if (def.kind==='select') assert.equal(await page.locator(`#preflight_${def.id}`).inputValue(),chosen[def.id]);
        else assert.equal(await page.locator(`#preflight_${def.id}`).inputValue(),values[def.id],'focus navigation must preserve entered text and numbers');
      }
      // Gate navigation must not receive an old delayed field-focus callback.
      await page.evaluate(()=>{document.querySelector('.preflight-next').click();document.querySelector('.preflight-back').click();document.querySelector('.preflight-back').click();});
      await page.waitForTimeout(120);
      assert.equal(await page.locator('#preflightContextMount').isVisible(),false);
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#preflightContextMount')),false,'hidden setup must not retain delayed focus');
      // DV emits first-run funnel telemetry while setting up; that request is also
      // fulfilled locally. It is not a diagnostic admission or answered run.
      assert.deepEqual(mutations.filter(req=>req.path!=='/api/first-run-events'),[],`${browserName}/${name}: no run, admission, answer, or other mutation request`);
      assert.deepEqual(errors,[],`${browserName}/${name}: no page errors`);
      await context.close();
    }
  }
  pages.forEach(focusEdgeCases);
  for(const [file,hash] of Object.entries(sourcePins))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,`source changed during testing: ${file}`);
} catch (caught) {error=caught;}
finally {
  for (const browser of browsers) await browser.close();
  await new Promise(resolve=>server.close(resolve));
  fs.writeFileSync(path.join(out,'focus-evidence.json'),JSON.stringify({ok:!error,checks:evidence.length,edgeChecks:edgeEvidence.length,sourcePins,evidence,edgeEvidence,error:error?.message || null},null,2));
}
if(error) throw error;
console.log(`PASS: ${evidence.length} natural setup-focus checks and ${edgeEvidence.length} actual-source edge cases; four diagnostics, Chromium/WebKit; no run/admission requests; all external traffic intercepted.`);
