// Actual built public pages; every external request is intercepted. Form/API
// results are fabricated. This does not certify production delivery or scoring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
const root = path.resolve('.render-public');
const out = path.resolve('output/acquisition-browser');
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4197';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon' };
let checks = 0;
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (a, label) => { assert.ok(a, label); checks++; };
const results = [];
async function contrast(page,label) {
  const colors=await page.locator('#mnd-measurement-panel').evaluate(panel=>({background:getComputedStyle(panel).backgroundColor,foreground:[...panel.querySelectorAll('h2,p,a,button')].map(node=>{const style=getComputedStyle(node);let opacity=1,filters=[];for(let current=node;current;current=current.parentElement){const value=getComputedStyle(current);opacity*=Number(value.opacity);filters.push(value.filter);}return {color:style.color,fill:style.webkitTextFillColor,opacity,filters};})}));
  const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const background=luminance(colors.background);
  ok(colors.foreground.every(item=>item.opacity>=.999&&item.filters.every(filter=>filter==='none')&&item.fill===item.color),`${label}: no ancestor opacity, filter or text-fill contrast override`);
  const spacing=await page.locator('#mnd-measurement-panel').evaluate(panel=>{const p=panel.querySelector('p'),actions=panel.querySelector('.mnd-measurement-actions');return {transform:getComputedStyle(p).transform,gap:actions.getBoundingClientRect().top-p.getBoundingClientRect().bottom};});
  if(await page.locator('#mnd-measurement-panel').isVisible())ok(spacing.transform==='none'&&spacing.gap>=11,`${label}: motion cannot overlap explanatory text with choice buttons`);
  ok(colors.foreground.every(item=>{const value=luminance(item.fill);return (Math.max(value,background)+.05)/(Math.min(value,background)+.05)>=4.5;}),`${label}: actual panel text/link contrast at least 4.5:1`);
}
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      const label = `${engine}/${width}`, events = [], applications = [], errors = [], unexpectedPosts = [];
      let held = null, holdApplications = true;
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, serviceWorkers: 'block' });
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      const handleRoute = async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === base) {
          const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
          if (url.pathname === '/workspace-access-gate.js') return route.fulfill({ contentType: 'application/javascript', body: 'window.mondermanGetSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:"public_first_run"});window.__mondermanReveal?.();' });
          let body = fs.readFileSync(file);
          if (file.endsWith('.html')) body = Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g, '$1'));
          return route.fulfill({ status: 200, contentType: mime[path.extname(file)] || 'application/octet-stream', body });
        }
        if (url.pathname === '/api/first-run-events') {
          events.push(request.postDataJSON());
          return route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' });
        }
        if (url.pathname === '/api/health') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        if (url.pathname === '/api/pilot-waitlist') {
          applications.push(request.postDataJSON());
          if (holdApplications && applications.length === 1) { held = route; return; }
          if (holdApplications && applications.length === 2) return route.abort();
          return route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' });
        }
        if (url.href.includes('@supabase/')) return route.fulfill({ contentType: 'application/javascript', body: 'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};' });
        if (request.method() !== 'GET') unexpectedPosts.push({ method: request.method(), path: url.pathname });
        return route.abort();
      };
      await context.route('**/*', handleRoute);
      try {
        const page = await context.newPage();
        await page.goto(`${base}/index.html?utm_source=linkedin&utm_campaign=first-dv-202609&email=PRIVATE_EMAIL&referrer=PRIVATE_REFERRER`, { waitUntil: 'domcontentloaded' });
        const pilot = page.locator('.hero-pilot-cta');
        equal((await pilot.textContent()).trim(), 'Join the pilot waitlist · Applications open', `${label}: honest availability`);
        equal(await pilot.evaluate(node => getComputedStyle(node).color), 'rgb(240, 196, 125)', `${label}: amber preserved`);
        const cta = page.locator('.hero-actions .btn-accent');
        await page.locator('#mnd-measurement-panel').waitFor({state:'visible'});
        const untouched = await cta.getAttribute('href');
        equal(new URL(untouched,base).search, '?source=homepage', `${label}: default-off CTA preserves entry surface only`);
        equal(events, [], `${label}: default off sends no events`);
        equal(await page.evaluate(()=>window.MondermanFirstRun.journeyId()), '', `${label}: no default-off ID`);
        equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('monderman_first_run'))), [], `${label}: no default-off optional storage`);
        const geometry = await page.evaluate(()=>{
          const panel=document.querySelector('#mnd-measurement-panel'), buttons=[...panel.querySelectorAll('button')].map(node=>{const r=node.getBoundingClientRect(); return {height:r.height,width:r.width,left:r.left,right:r.right,background:getComputedStyle(node).backgroundColor};});
          return {buttons,position:getComputedStyle(panel).position,top:panel.getBoundingClientRect().top,ctaBottom:document.querySelector('.hero-actions').getBoundingClientRect().bottom};
        });
        ok(geometry.top>=geometry.ctaBottom, `${label}: choice does not displace hero CTA`);
        ok(geometry.buttons.every(button=>button.height>=44&&button.left>=0&&button.right<=width), `${label}: contained accessible choice targets`);
        equal(geometry.buttons[0].background,geometry.buttons[1].background, `${label}: equal choice styling`);
        ok(Math.abs(geometry.buttons[0].width-geometry.buttons[1].width)<2, `${label}: equal choice widths`);
        ok(!['fixed','absolute'].includes(geometry.position), `${label}: nonblocking in-flow choice`);
        equal(await page.locator('#mnd-measurement-panel a').getAttribute('href'),'privacy.html#optional-measurement',`${label}: explanatory notice link`);
        await contrast(page,`${label}/homepage`);
        await page.screenshot({path:path.join(out,`${engine}-${width}-default-off.png`)});
        await page.locator('#mnd-measurement-panel').screenshot({path:path.join(out,`${engine}-${width}-choice-panel.png`)});
        await page.locator('#mnd-measurement-allow').focus();
        await page.keyboard.press('Tab');
        equal(await page.evaluate(()=>document.activeElement.id),'mnd-measurement-deny',`${label}: keyboard gives equal access to decline`);
        await page.locator('#mnd-measurement-allow').click();
        equal(events, [], `${label}: Allow does not replay homepage actions`);
        const tagged = new URL(await cta.getAttribute('href'), base);
        equal(tagged.pathname, '/decision-velocity.html', `${label}: same CTA destination`);
        equal(tagged.searchParams.get('utm_source'), 'linkedin', `${label}: landing attribution`);
        ok(!tagged.href.includes('PRIVATE_'), `${label}: no raw incoming parameters forwarded`);
        await page.screenshot({ path: path.join(out, `${engine}-${width}-home.png`) });
        await cta.click();
        await page.waitForURL('**/decision-velocity.html?**');
        await page.waitForFunction(() => window.MondermanFirstRun);
        const originalJourney = await page.evaluate(() => window.MondermanFirstRun.journeyId());
        equal(await page.evaluate(() => window.MondermanFirstRun.attribution()), { acquisitionSource: 'linkedin', acquisitionCampaign: 'first-dv-202609' }, `${label}: same-tab DV attribution`);
        // Emulate a dynamically rendered result CTA with the exact existing DV
        // destination. No diagnostic is started, answered, or completed here.
        await page.evaluate(() => {
          const a = document.createElement('a'); a.id = 'fixture-pilot-result'; a.href = 'pilot.html?source=decision_velocity'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Local result-link fixture'; document.body.append(a);
        });
        const popupPromise = context.waitForEvent('page');
        await page.locator('#fixture-pilot-result').click();
        const application = await popupPromise;
        await application.waitForLoadState('domcontentloaded');
        equal(new URL(application.url()).searchParams.get('utm_campaign'), 'first-dv-202609', `${label}: new-tab campaign`);
        equal(await application.evaluate(() => window.opener), null, `${label}: noopener preserved`);
        ok(await application.evaluate(() => window.MondermanFirstRun.journeyId()) !== originalJourney, `${label}: no journey identifier copied into new tab`);
        await application.locator('[name=fullName]').fill('PRIVATE_NAME Fixture');
        await application.locator('[name=workEmail]').fill('PRIVATE_EMAIL@example.test');
        await application.locator('[name=organization]').fill('PRIVATE_ORG Fixture');
        await application.locator('[name=decisionFocus]').fill('PRIVATE_ANSWER for a fabricated operating unit.');
        await application.locator('[name=privacyConsent]').check();
        await application.locator('#pilotSubmit').click();
        await application.waitForFunction(() => document.querySelector('#pilotSubmit').disabled);
        const holdDeadline = Date.now() + 5000;
        while (!held && Date.now() < holdDeadline) await new Promise(resolve => setTimeout(resolve, 10));
        ok(held, `${label}: bounded mocked submission arrived`);
        await application.locator('#pilotWaitlistForm').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        equal(applications.length, 1, `${label}: double submission fenced`);
        await held.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"message":"Please retry."}' });
        await application.locator('#pilotFormStatus.is-error').waitFor();
        equal(applications.length, 1, `${label}: HTTP failure has no automatic retry`);
        equal(await application.locator('[name=workEmail]').inputValue(), 'PRIVATE_EMAIL@example.test', `${label}: failure preserves form`);
        await application.locator('#pilotSubmit').click();
        await application.locator('#pilotFormStatus.is-error').waitFor();
        equal(applications.length, 2, `${label}: manual retry only`);
        equal(applications[0].requestId, applications[1].requestId, `${label}: unchanged retry keeps idempotency key`);
        await application.locator('[name=decisionFocus]').fill('PRIVATE_ANSWER revised fabricated unit.');
        await application.locator('[name=completedDecisionVelocity]').uncheck();
        await application.locator('#pilotSubmit').click();
        await application.locator('#pilotConfirmation').waitFor({ state: 'visible' });
        equal(applications.length, 3, `${label}: edited explicit resubmission`);
        ok(applications[2].requestId !== applications[1].requestId, `${label}: changed payload gets new key`);
        equal(applications.map(payload=>payload.completedDecisionVelocity),[true,true,false],`${label}: prefilled completed-DV answer respects explicit uncheck`);
        for (const payload of applications) {
          equal(payload.source, 'decision_velocity', `${label}: entry surface preserved`);
          equal(payload.acquisitionSource, 'linkedin', `${label}: application source`);
          equal(payload.acquisitionCampaign, 'first-dv-202609', `${label}: application campaign`);
          equal(payload.measurementConsentVersion,'2026-09-10-v1',`${label}: application carries affirmative choice version`);
          equal(Object.hasOwn(payload, 'journeyId'), false, `${label}: no anonymous/person link`);
        }
        ok(events.some(event => event.eventName === 'pilot_waitlist_submitted'), `${label}: success event emitted`);
        ok(events.every(event => Object.keys(event).every(key => ['eventName', 'journeyId', 'pagePath', 'diagnosticDepth', 'acquisitionSource', 'acquisitionCampaign', 'measurementConsentVersion'].includes(key))), `${label}: finite telemetry fields`);
        ok(events.every(event=>event.measurementConsentVersion==='2026-09-10-v1'),`${label}: every event has explicit choice version`);
        ok(!JSON.stringify(events).includes('PRIVATE_'), `${label}: form/query data absent from analytics`);
        ok(!(await application.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).includes('PRIVATE_'), `${label}: form/query data absent from storage`);
        equal(unexpectedPosts, [], `${label}: no scoring/auth/model/form traffic escapes fixtures`);
        equal(errors, [], `${label}: no unhandled page errors`);
        for (const current of [page, application]) ok(await current.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
        await application.screenshot({ path: path.join(out, `${engine}-${width}-pilot-confirmation.png`), fullPage: true });
        await application.evaluate(()=>{sessionStorage.setItem('fixture-auth','KEEP'); sessionStorage.setItem('fixture-report','KEEP');});
        await application.locator('#mnd-measurement-settings-button').click();
        await contrast(application,`${label}/pilot`);
        equal(await application.evaluate(()=>document.activeElement.id),'mnd-measurement-panel',`${label}: settings reopen focuses choices`);
        await application.addStyleTag({content:'#mnd-measurement-panel,#mnd-measurement-settings{font-size:28px!important}'});
        ok(await application.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: 200 percent choice text remains contained`);
        await application.locator('#mnd-measurement-panel').screenshot({path:path.join(out,`${engine}-${width}-choices-large-text.png`)});
        await application.locator('#mnd-measurement-deny').click();
        const beforeWithdraw=events.length;
        await application.evaluate(()=>window.MondermanFirstRun.track('score_displayed'));
        equal(events.length,beforeWithdraw,`${label}: explicit withdrawal stops future events`);
        equal(await application.evaluate(()=>[sessionStorage.getItem('fixture-auth'),sessionStorage.getItem('fixture-report')]),['KEEP','KEEP'],`${label}: withdrawal preserves auth and report state`);
        equal(await application.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('monderman_first_run'))),[],`${label}: withdrawal clears only optional state`);
        await page.waitForFunction(()=>!window.MondermanFirstRun.isMeasurementAllowed());
        equal(await page.evaluate(()=>window.MondermanFirstRun.journeyId()),'',`${label}: cross-tab withdrawal stops original tab`);
        await application.reload({waitUntil:'domcontentloaded'});
        equal(await application.evaluate(()=>window.MondermanFirstRun.isMeasurementAllowed()),false,`${label}: declined refresh remains off`);
        equal(events.length,beforeWithdraw,`${label}: refresh adds no events after withdrawal`);
        results.push({ engine, width, mockedApplications: applications.length, anonymousEvents: events.length, unexpectedPosts: 0, errors: 0 });
      } finally { await context.close(); }
      holdApplications=false;
      // Independent no-choice/declined and unavailable-storage journeys. All
      // application responses remain fabricated; no diagnostic run is started.
      for (const mode of ['decline','storage-unavailable','malformed','failed-withdrawal']) {
        const isolated=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
        await isolated.route('**/*',handleRoute);
        isolated.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
        if(mode==='malformed') await isolated.addInitScript(()=>{if(location.hostname==='127.0.0.1')localStorage.setItem('monderman_measurement_choice','{bad')});
        if(mode==='storage-unavailable') await isolated.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('fixture blocked')};Storage.prototype.setItem=function(){throw Error('fixture blocked')};});
        if(mode==='failed-withdrawal') await isolated.addInitScript(()=>{if(location.hostname!=='127.0.0.1')return;localStorage.setItem('monderman_measurement_choice',JSON.stringify({version:'2026-09-10-v1',choice:'allow'}));const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage)throw Error('fixture quota');return original.call(this,key,value)};const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(this===localStorage)throw Error('fixture blocked removal');return remove.call(this,key)};});
        try {
          const current=await isolated.newPage(), eventStart=events.length;
          await current.goto(`${base}/index.html?utm_source=email&utm_campaign=first-dv-202609`,{waitUntil:'domcontentloaded'});
          if(mode==='failed-withdrawal') await current.locator('#mnd-measurement-settings-button').click();
          if(mode==='storage-unavailable') await current.locator('#mnd-measurement-allow').click();
          if(mode!=='malformed') await current.locator('#mnd-measurement-deny').click();
          if(mode==='failed-withdrawal') await current.evaluate(()=>{dispatchEvent(new Event('focus'));dispatchEvent(new Event('pageshow'));});
          equal(await current.evaluate(()=>window.MondermanFirstRun.isMeasurementAllowed()),false,`${label}/${mode}: remains off`);
          equal(new URL(await current.locator('.hero-actions .btn-accent').getAttribute('href'),base).search,'?source=homepage',`${label}/${mode}: no acquisition forwarding`);
          if(mode==='failed-withdrawal') { equal(events.length,eventStart,`${label}: failed withdrawal cannot re-enable old Allow`); continue; }
          await current.locator('.hero-actions .btn-accent').click();
          await current.waitForURL('**/decision-velocity.html?source=homepage');
          await contrast(current,`${label}/${mode}/DV`);
          await current.locator('[data-lane="operational"]').click();
          await current.locator('#laneContinueBtn').click();
          await current.locator('[data-depth="10"]').click();
          await current.locator('#depthContinueBtn').click();
          ok(await current.locator('#introStage').isVisible(),`${label}/${mode}: diagnostic setup works without measurement`);
          equal(events.length,eventStart,`${label}/${mode}: setup has no optional requests`);
          await current.screenshot({path:path.join(out,`${engine}-${width}-${mode}-dv.png`),fullPage:true});
          await current.goto(`${base}/pilot.html?source=${mode==='malformed'?'homepage':'decision_velocity'}`,{waitUntil:'domcontentloaded'});
          equal(await current.locator('[name=completedDecisionVelocity]').isChecked(),mode!=='malformed',`${label}/${mode}: only DV entry prefills completion answer`);
          await current.locator('[name=completedDecisionVelocity]').uncheck();
          await current.locator('[name=fullName]').fill('PRIVATE_NAME Fixture');
          await current.locator('[name=workEmail]').fill('PRIVATE_EMAIL@example.test');
          await current.locator('[name=organization]').fill('PRIVATE_ORG Fixture');
          await current.locator('[name=decisionFocus]').fill('PRIVATE_ANSWER fabricated unit');
          await current.locator('[name=privacyConsent]').check();
          await current.locator('#pilotSubmit').click();
          await current.locator('#pilotConfirmation').waitFor({state:'visible'});
          const payload=applications.at(-1);
          equal(payload.completedDecisionVelocity,false,`${label}/${mode}: checkbox answer, not entry URL, controls self-report`);
          equal([payload.acquisitionSource,payload.acquisitionCampaign],['unknown',null],`${label}/${mode}: pilot works with no attribution`);
          equal(Object.hasOwn(payload,'measurementConsentVersion'),false,`${label}/${mode}: required form privacy check is not measurement consent`);
          equal(Object.hasOwn(payload,'journeyId'),false,`${label}/${mode}: no visit/person linking`);
          equal(events.length,eventStart,`${label}/${mode}: pilot success not measured while off`);
          ok(await current.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}/${mode}: no overflow`);
        } finally { await isolated.close(); }
      }
      equal(unexpectedPosts,[],`${label}: all test scenarios stayed inside fixtures`);
      equal(errors,[],`${label}: all choice scenarios free of unhandled errors`);
    }
  } finally { await browser.close(); }
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, results, liveRequests: 0 }, null, 2));
console.log(`ACQUISITION_BROWSER_PASS ${checks} assertions; six Chromium/WebKit viewport cases; zero live requests`);
