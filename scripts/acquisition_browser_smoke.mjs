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
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      const label = `${engine}/${width}`, events = [], applications = [], errors = [], unexpectedPosts = [];
      let held = null;
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, serviceWorkers: 'block' });
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      await context.route('**/*', async route => {
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
          if (applications.length === 1) { held = route; return; }
          if (applications.length === 2) return route.abort();
          return route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' });
        }
        if (url.href.includes('@supabase/')) return route.fulfill({ contentType: 'application/javascript', body: 'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};' });
        if (request.method() !== 'GET') unexpectedPosts.push({ method: request.method(), path: url.pathname });
        return route.abort();
      });
      try {
        const page = await context.newPage();
        await page.goto(`${base}/index.html?utm_source=linkedin&utm_campaign=first-dv-202609&email=PRIVATE_EMAIL&referrer=PRIVATE_REFERRER`, { waitUntil: 'domcontentloaded' });
        const pilot = page.locator('.hero-pilot-cta');
        equal((await pilot.textContent()).trim(), 'Join the pilot waitlist · Applications open', `${label}: honest availability`);
        equal(await pilot.evaluate(node => getComputedStyle(node).color), 'rgb(240, 196, 125)', `${label}: amber preserved`);
        const cta = page.locator('.hero-actions .btn-accent');
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
        await application.locator('#pilotSubmit').click();
        await application.locator('#pilotConfirmation').waitFor({ state: 'visible' });
        equal(applications.length, 3, `${label}: edited explicit resubmission`);
        ok(applications[2].requestId !== applications[1].requestId, `${label}: changed payload gets new key`);
        for (const payload of applications) {
          equal(payload.source, 'decision_velocity', `${label}: entry surface preserved`);
          equal(payload.acquisitionSource, 'linkedin', `${label}: application source`);
          equal(payload.acquisitionCampaign, 'first-dv-202609', `${label}: application campaign`);
          equal(Object.hasOwn(payload, 'journeyId'), false, `${label}: no anonymous/person link`);
        }
        ok(events.some(event => event.eventName === 'pilot_waitlist_submitted'), `${label}: success event emitted`);
        ok(events.every(event => Object.keys(event).every(key => ['eventName', 'journeyId', 'pagePath', 'diagnosticDepth', 'acquisitionSource', 'acquisitionCampaign'].includes(key))), `${label}: finite telemetry fields`);
        ok(!JSON.stringify(events).includes('PRIVATE_'), `${label}: form/query data absent from analytics`);
        ok(!(await application.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).includes('PRIVATE_'), `${label}: form/query data absent from storage`);
        equal(unexpectedPosts, [], `${label}: no scoring/auth/model/form traffic escapes fixtures`);
        equal(errors, [], `${label}: no unhandled page errors`);
        for (const current of [page, application]) ok(await current.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
        await application.screenshot({ path: path.join(out, `${engine}-${width}-pilot-confirmation.png`), fullPage: true });
        results.push({ engine, width, mockedApplications: applications.length, anonymousEvents: events.length, unexpectedPosts: 0, errors: 0 });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, results, liveRequests: 0 }, null, 2));
console.log(`ACQUISITION_BROWSER_PASS ${checks} assertions; six Chromium/WebKit viewport cases; zero live requests`);
