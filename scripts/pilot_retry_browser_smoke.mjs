// Built-page regression. All external requests are intercepted; applications,
// auth and responses are fabricated. No production records or emails are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, webkit } from 'playwright';
const root = path.resolve('.render-public'), out = path.resolve('output/pilot-safe-browser');
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:4199';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon' };
let checks = 0;
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
equal(crypto.createHash('sha256').update(fs.readFileSync('first-run-telemetry.js')).digest('hex'), '63bf1680a08fd4879a6a2f5d75979e82ec447a3b22d209c9cfacbeb2cd988afa', 'anonymous telemetry remains exact de01 source');
equal(fs.readFileSync(path.join(root, 'first-run-telemetry.js'), 'utf8'), fs.readFileSync('first-run-telemetry.js', 'utf8'), 'built telemetry unchanged');
ok(!/sessionStorage|localStorage|acquisitionSource|acquisitionCampaign|utm_|journeyId/.test(fs.readFileSync('pilot-waitlist.js', 'utf8')), 'pilot adds no storage, source tags or anonymous identifier');
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
        if (url.pathname === '/api/first-run-events') { events.push(request.postDataJSON()); return route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' }); }
        if (url.pathname === '/api/health') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        if (url.pathname === '/api/pilot-waitlist') {
          applications.push(request.postDataJSON());
          if (applications.length === 1) { held = route; return; }
          if (applications.length === 2) return route.abort();
          if (applications.length === 4) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"message":"Please retry."}' });
          return route.fulfill({ status: 202, contentType: 'application/json', body: '{"ok":true}' });
        }
        if (url.href.includes('@supabase/')) return route.fulfill({ contentType: 'application/javascript', body: 'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};' });
        if (request.method() !== 'GET') unexpectedPosts.push({ method: request.method(), path: url.pathname });
        return route.abort();
      });
      const fill = async page => {
        await page.locator('[name=fullName]').fill('PRIVATE_NAME Fixture');
        await page.locator('[name=workEmail]').fill('PRIVATE_EMAIL@example.test');
        await page.locator('[name=organization]').fill('PRIVATE_ORG Fixture');
        await page.locator('[name=decisionFocus]').fill('PRIVATE_ANSWER for a fabricated operating unit.');
        await page.locator('[name=privacyConsent]').check();
      };
      try {
        const page = await context.newPage();
        await page.goto(`${base}/index.html?utm_source=linkedin&utm_campaign=first-dv-202609&email=PRIVATE_EMAIL`, { waitUntil: 'domcontentloaded' });
        const pilot = page.locator('.hero-pilot-cta'), dv = page.locator('.hero-actions .btn-accent');
        equal((await pilot.textContent()).trim(), 'Join the pilot waitlist · Applications open', `${label}: truthful availability`);
        equal(await pilot.evaluate(node => getComputedStyle(node).color), 'rgb(240, 196, 125)', `${label}: amber unchanged`);
        equal(await pilot.getAttribute('href'), 'pilot.html?source=homepage', `${label}: pilot link unchanged, no tags`);
        equal(await dv.getAttribute('href'), 'decision-velocity.html?source=homepage', `${label}: free DV link unchanged, no tags`);
        await page.screenshot({ path: path.join(out, `${engine}-${width}-home.png`) });
        await dv.click(); await page.waitForURL('**/decision-velocity.html?source=homepage');
        await page.waitForFunction(() => window.MondermanFirstRun);
        equal(await page.evaluate(() => Object.keys(window.MondermanFirstRun).sort()), ['journeyId', 'track', 'trackOnce'], `${label}: no attribution API added`);
        const protectedLinks = ['signin.html?next=decision-velocity.html%3Fresume%3D1', 'workspace-diagnostics.html?report=00000000-0000-4000-8000-000000000001', 'decision-velocity.html?resume=1'];
        equal(await page.evaluate(links => links.map(href => { const a = document.createElement('a'); a.href = href; document.body.append(a); a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); return a.getAttribute('href'); }), protectedLinks), protectedLinks, `${label}: auth/saved report/resume URLs untouched`);
        // Dynamic result-link fixture uses the unchanged existing destination;
        // this is not a diagnostic completion or saved-report test.
        await page.evaluate(() => { const a = document.createElement('a'); a.id = 'fixture-pilot-result'; a.href = 'pilot.html?source=decision_velocity'; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Local result-link fixture'; document.body.append(a); });
        const popupPromise = context.waitForEvent('page'); await page.locator('#fixture-pilot-result').click();
        const application = await popupPromise; await application.waitForLoadState('domcontentloaded');
        equal(new URL(application.url()).search, '?source=decision_velocity', `${label}: no new-tab tags`);
        equal(await application.evaluate(() => window.opener), null, `${label}: noopener preserved`);
        await fill(application); await application.locator('#pilotSubmit').click();
        const deadline = Date.now() + 5000;
        while (!held && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        ok(held, `${label}: bounded mocked request arrived`);
        await application.locator('#pilotWaitlistForm').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        equal(applications.length, 1, `${label}: double submit fenced`);
        await held.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"message":"Please retry."}' });
        await application.locator('#pilotFormStatus.is-error').waitFor();
        equal(applications.length, 1, `${label}: HTTP failure has no automatic retry`);
        equal(await application.locator('[name=workEmail]').inputValue(), 'PRIVATE_EMAIL@example.test', `${label}: form preserved`);
        await application.locator('#pilotSubmit').click(); await application.locator('#pilotFormStatus.is-error').waitFor();
        equal(applications.length, 2, `${label}: network failure has no automatic retry`);
        await application.locator('#pilotSubmit').click(); await application.locator('#pilotConfirmation').waitFor({ state: 'visible' });
        equal(applications.length, 3, `${label}: explicit success retry`);
        equal(applications.map(payload => payload.requestId), [applications[0].requestId, applications[0].requestId, applications[0].requestId], `${label}: same key through HTTP/network failure and success`);
        await application.screenshot({ path: path.join(out, `${engine}-${width}-confirmation.png`), fullPage: true });
        // Separate failed application: edited content must not reuse its key.
        const edited = await context.newPage(); await edited.goto(`${base}/pilot.html?source=homepage`, { waitUntil: 'domcontentloaded' }); await fill(edited);
        await edited.locator('#pilotSubmit').click(); await edited.locator('#pilotFormStatus.is-error').waitFor();
        await edited.locator('[name=decisionFocus]').fill('PRIVATE_ANSWER revised fabricated scope.');
        await edited.locator('#pilotSubmit').click(); await edited.locator('#pilotConfirmation').waitFor({ state: 'visible' });
        equal(applications.length, 5, `${label}: edited explicit retry only`);
        ok(applications[4].requestId !== applications[3].requestId, `${label}: edited body gets new key`);
        for (const [index, payload] of applications.entries()) {
          equal(payload.source, index < 3 ? 'decision_velocity' : 'homepage', `${label}: existing entry source`);
          equal(Object.keys(payload).sort(), ['completedDecisionVelocity','decisionFocus','fullName','organization','participantGroupSize','privacyConsent','requestId','roleTitle','source','website','workEmail'].sort(), `${label}: no journey ID or acquisition fields`);
        }
        ok(events.some(event => event.eventName === 'pilot_waitlist_submitted'), `${label}: existing success event preserved`);
        ok(events.every(event => Object.keys(event).every(key => ['eventName','journeyId','pagePath','diagnosticDepth'].includes(key))), `${label}: no new telemetry fields`);
        ok(!JSON.stringify(events).includes('PRIVATE_') && !JSON.stringify(events).includes('linkedin'), `${label}: no form data or campaign capture`);
        for (const current of [page, application, edited]) {
          const storage = await current.evaluate(() => ({ session: { ...sessionStorage }, local: { ...localStorage } }));
          equal(Object.keys(storage.session).filter(key => key !== 'monderman_first_run_journey'), [], `${label}: no new session storage`);
          equal(Object.keys(storage.local), [], `${label}: no new local storage`);
          ok(!JSON.stringify(storage).includes('PRIVATE_'), `${label}: form data not persisted`);
          ok(await current.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no overflow`);
        }
        equal(unexpectedPosts, [], `${label}: no real backend/auth/model submissions`);
        equal(errors, [], `${label}: no unhandled page errors`);
        results.push({ engine, width, mockedApplications: applications.length, anonymousEvents: events.length, errors: 0, liveRequests: 0 });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, results, liveRequests: 0 }, null, 2));
console.log(`PILOT_SAFE_BROWSER_PASS ${checks} assertions; six Chromium/WebKit viewport cases; zero live requests`);
