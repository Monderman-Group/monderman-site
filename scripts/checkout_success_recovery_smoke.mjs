// Actual confirmation page, access gate, and SRI-pinned Supabase SDK.
// All authentication, database, and billing responses are synthetic. No payment is created.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.env.CHECKOUT_RECOVERY_OUT || '/tmp/monderman-checkout-recovery-smoke');
const baseline = process.argv.includes('--reproduce-baseline');
const source = fs.readFileSync(path.join(root, 'checkout-success.html'), 'utf8');
const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
const sdkResponse = await fetch(sdkUrl);
assert.ok(sdkResponse.ok, 'Exact public SDK dependency is available');
const sdk = Buffer.from(await sdkResponse.arrayBuffer());
const integrity = 'sha384-' + createHash('sha384').update(sdk).digest('base64');
assert.ok(source.includes(`src="${sdkUrl}" integrity="${integrity}"`), 'Use exactly the SDK bytes declared in the page');
const origin = 'https://checkout-recovery.example.test';
const api = 'https://monderman-api.onrender.com';
const authOrigin = 'https://ptkxrzgmeldalrkfruth.supabase.co';
const authKey = 'sb-ptkxrzgmeldalrkfruth-auth-token';
const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = '22222222-2222-4222-8222-222222222222';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const checkoutId = 'cs_test_CONTROLLED_REFRESH_REFERENCE';
const link = `/checkout-success.html?session_id=${checkoutId}&organization_id=${organizationId}`;
const states = [];
let checks = 0;
const check = (condition, label) => { checks += 1; assert.ok(condition, label); };
const equal = (actual, expected, label) => { checks += 1; assert.deepEqual(actual, expected, label); };
const sha = data => createHash('sha256').update(data).digest('hex');
fs.mkdirSync(out, { recursive: true });

function sessionFor(id) {
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'checkout-fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, aud: 'authenticated', role: 'authenticated', exp: expires })}.NOT_A_REAL_SIGNATURE`, refresh_token: 'NOT_A_REAL_REFRESH_TOKEN', token_type: 'bearer', expires_in: 3600, expires_at: expires, user };
}

function requestUser(request) {
  try { return JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url')).sub; }
  catch { return null; }
}

function purchase(overrides = {}) {
  return { ok: true, checkoutComplete: true, paymentConfirmed: true, entitlementConfirmed: true,
    organization: { id: organizationId, name: 'Controlled Example Workspace' },
    purchase: { plan: 'signal', interval: 'monthly', amount: 200000, amountFormatted: '$2,000.00', renewalAt: '2027-09-15T12:00:00Z' },
    invoice: { hostedUrl: 'https://invoice.stripe.com/i/CONTROLLED_EXAMPLE' }, testMode: true, ...overrides };
}

async function fixture(browser, label, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const calls = [], unexpected = [], pageErrors = [];
  const control = { status: 200, response: purchase(), pending: 0, transportFailure: false, multiWorkspace: false, getUserCount: 0 };
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.addInitScript(({ authKey, initial }) => {
    if (!sessionStorage.getItem('fixture-seeded')) {
      localStorage.setItem(authKey, JSON.stringify(initial));
      sessionStorage.setItem('fixture-seeded', 'yes');
    }
  }, { authKey, initial: sessionFor(userId) });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(value) });
    if (request.url() === sdkUrl) return route.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: sdk });
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user' && request.method() === 'GET') {
        control.getUserCount += 1;
        const id = requestUser(request);
        if (![userId, otherUserId].includes(id)) return json({ error: 'synthetic_unauthorized' }, 401);
        return json(sessionFor(id).user);
      }
      if (url.pathname === '/rest/v1/rpc/redeem_my_invites') return json([]);
      if (url.pathname === '/rest/v1/organization_members') {
        const id = requestUser(request), ids = id === otherUserId ? [otherOrganizationId] : control.multiWorkspace ? [organizationId, otherOrganizationId] : [organizationId];
        equal(url.searchParams.get('user_id'), `eq.${id}`, label + ': memberships filtered to current user');
        return json(ids.map(orgId => ({ user_id: id, organization_id: orgId, role: 'admin', organizations: { id: orgId, name: orgId === organizationId ? 'Controlled Example Workspace' : 'Different Workspace', owner_user_id: id } })));
      }
    }
    if (url.origin === api) {
      if (url.pathname === '/api/legal/acceptance/status') return json({ ok: true, requiresAcceptance: false, enforcementActive: true });
      if (url.pathname === '/api/billing/confirm-checkout-session' && request.method() === 'POST') {
        const body = request.postDataJSON();
        calls.push({ body, userId: requestUser(request) });
        equal(body, { session_id: checkoutId, organization_id: organizationId }, label + ': server receives exact checkout/workspace binding');
        equal(requestUser(request), userId, label + ': server receives the original authenticated user');
        if (control.transportFailure) return route.abort('connectionrefused');
        if (control.pending > 0) { control.pending -= 1; return json(purchase({ entitlementConfirmed: false })); }
        return json(control.response, control.status);
      }
    }
    if (url.origin === origin) {
      // A passive sign-in destination lets us observe the real gate redirect,
      // without starting a separate sign-in flow or requesting an email.
      if (url.pathname === '/signin.html') return route.fulfill({ contentType: 'text/html', body: '<h1>Controlled sign-in destination</h1>' });
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (filename.startsWith(root + path.sep) && fs.existsSync(filename) && fs.statSync(filename).isFile()) {
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
        return route.fulfill({ contentType: mime[path.extname(filename)] || 'application/octet-stream', body: fs.readFileSync(filename) });
      }
    }
    unexpected.push(request.method() + ' ' + url.origin + url.pathname);
    return route.abort();
  });
  async function settled() {
    await page.waitForFunction(() => !document.querySelector('#confirmationMark')?.classList.contains('loading'));
    await page.evaluate(() => document.fonts.ready);
  }
  async function start() {
    await page.goto(origin + link, { waitUntil: 'domcontentloaded' });
    await settled();
    equal(await page.locator('#confirmationTitle').textContent(), 'Your subscription is active.', label + ': initial server-confirmed purchase is shown');
    equal(new URL(page.url()).search, '', label + ': checkout reference removed from address bar');
  }
  async function shot(suffix) {
    const filename = `${label}-${width}-${suffix}.png`;
    await page.screenshot({ path: path.join(out, filename), fullPage: true });
    return { file: filename, sha256: sha(fs.readFileSync(path.join(out, filename))) };
  }
  async function close(evidence = {}) {
    equal(unexpected, [], label + ': no unknown external or provider traffic');
    equal(pageErrors, [], label + ': no uncaught page errors');
    states.push({ label, width, calls, getUserCount: control.getUserCount, ...evidence });
    await context.close();
  }
  return { context, page, calls, control, start, settled, shot, close };
}

try {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const width of baseline ? [390] : [390, 768, 1440]) {
        const f = await fixture(browser, name + '-refresh', width);
        await f.start();
        const before = await f.shot('before-refresh');
        if (!baseline) {
          equal(await f.page.evaluate(() => history.state), { mondermanCheckout: { version: 1, sessionId: checkoutId, organizationId, userId } }, name + ': only bound lookup reference is retained, not token or paid data');
          check(!await f.page.evaluate(id => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes(id)), checkoutId), name + ': no checkout reference in local/session storage');
          f.control.response = purchase({ purchase: { plan: 'signal', interval: 'monthly', amountFormatted: '$2,000.01', renewalAt: '2027-09-15T12:00:00Z' } });
        }
        await f.page.reload({ waitUntil: 'domcontentloaded' });
        await f.settled();
        if (baseline) {
          equal(await f.page.locator('#confirmationTitle').textContent(), 'Purchase confirmation needs attention.', name + ': reproduced full-refresh failure');
          equal(f.calls.length, 1, name + ': broken refresh never rechecks the purchase');
        } else {
          equal(await f.page.locator('#confirmationTitle').textContent(), 'Your subscription is active.', name + ': full refresh recovers after API verification');
          equal(f.calls.length, 2, name + ': refresh performs a new confirmation request');
          equal(await f.page.locator('#summaryAmount').textContent(), '$2,000.01', name + ': refresh displays newly verified server data, not cached summary');
          check(f.control.getUserCount >= 2, name + ': identity is checked again on full refresh');
          equal(await f.page.locator('#workspaceButton').getAttribute('href'), `workspace.html?organization_id=${organizationId}`, name + ': Workspace link preserves purchase tenant');
          const fit = await f.page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
          check(fit.scroll <= fit.width + 1, name + ': confirmation stays within viewport');
        }
        await f.close({ before, after: await f.shot('after-refresh') });
      }
      if (baseline) continue;
      for (const scenario of ['missing-reference', 'different-user', 'different-workspace', 'server-rejected', 'network-retry', 'transport-retry', 'pending-entitlement', 'pending-exhausted', 'unpaid', 'incomplete', 'nonboolean-payment', 'wrong-response-workspace', 'tampered-reference', 'invalid-session-reference', 'signed-out']) {
        const f = await fixture(browser, name + '-' + scenario);
        if (scenario === 'missing-reference') {
          await f.page.goto(origin + '/checkout-success.html', { waitUntil: 'domcontentloaded' });
        } else {
          if (scenario === 'pending-entitlement') f.control.pending = 1;
          if (scenario === 'pending-exhausted') {
            f.control.pending = 6;
            await f.page.goto(origin + link, { waitUntil: 'domcontentloaded' });
            await f.settled();
            equal(f.calls.length, 6, name + ': pending entitlement stops after six confirmation attempts');
            equal(await f.page.locator('#confirmationTitle').textContent(), 'Payment confirmed; Workspace access is catching up.', name + ': pending does not claim active access');
            equal(await f.page.locator('#confirmationStatus').getAttribute('class'), 'status warn', name + ': pending access has explicit warning');
          } else await f.start();
          if (scenario === 'different-user') await f.page.evaluate(({ authKey, value }) => localStorage.setItem(authKey, JSON.stringify(value)), { authKey, value: sessionFor(otherUserId) });
          if (scenario === 'different-workspace') {
            f.control.multiWorkspace = true;
            await f.page.evaluate(id => sessionStorage.setItem('monderman_active_organization_id', id), otherOrganizationId);
          }
          if (scenario === 'server-rejected') { f.control.status = 403; f.control.response = { ok: false, error: 'checkout_session_access_denied' }; }
          if (scenario === 'network-retry') { f.control.status = 503; f.control.response = { ok: false, error: 'billing_unavailable' }; }
          if (scenario === 'transport-retry') f.control.transportFailure = true;
          if (scenario === 'unpaid') f.control.response = purchase({ paymentConfirmed: false });
          if (scenario === 'incomplete') f.control.response = purchase({ checkoutComplete: false });
          if (scenario === 'nonboolean-payment') f.control.response = purchase({ paymentConfirmed: 'true' });
          if (scenario === 'wrong-response-workspace') f.control.response = purchase({ organization: { id: otherOrganizationId, name: 'Different Workspace' } });
          if (scenario === 'tampered-reference') await f.page.evaluate(() => history.replaceState({ mondermanCheckout: { version: 1, sessionId: 'tampered', organizationId: 'wrong', userId: 'wrong' } }, '', location.href));
          if (scenario === 'invalid-session-reference') await f.page.evaluate(() => history.replaceState({ ...history.state, mondermanCheckout: { ...history.state.mondermanCheckout, sessionId: 'not-a-checkout-reference' } }, '', location.href));
          if (scenario === 'signed-out') await f.page.evaluate(key => localStorage.removeItem(key), authKey);
          await f.page.reload({ waitUntil: 'domcontentloaded' });
        }
        if (scenario === 'signed-out') {
          await f.page.waitForURL('**/signin.html?**');
          equal(f.calls.length, 1, name + ': signed-out refresh makes no billing confirmation request');
        } else {
          await f.settled();
          if (['pending-entitlement', 'pending-exhausted'].includes(scenario)) {
            equal(await f.page.locator('#confirmationTitle').textContent(), 'Your subscription is active.', name + ': delayed entitlement converges and reloads');
            equal(f.calls.length, scenario === 'pending-exhausted' ? 7 : 3, name + ': only bounded reconciliation calls are made');
          } else {
            equal(await f.page.locator('#confirmationTitle').textContent(), 'Purchase confirmation needs attention.', name + ': ' + scenario + ' fails closed');
            equal(await f.page.locator('#purchaseSummary').isVisible(), false, name + ': no cached paid summary on ' + scenario);
            if (['different-user', 'different-workspace', 'tampered-reference', 'invalid-session-reference'].includes(scenario)) equal(f.calls.length, 1, name + ': mismatched recovery does not send checkout reference');
            if (scenario === 'missing-reference') equal(f.calls.length, 0, name + ': absent checkout never calls billing');
            if (['network-retry', 'transport-retry'].includes(scenario)) {
              f.control.transportFailure = false;
              f.control.status = 200; f.control.response = purchase();
              await f.page.reload({ waitUntil: 'domcontentloaded' });
              await f.settled();
              equal(await f.page.locator('#confirmationTitle').textContent(), 'Your subscription is active.', name + ': transient failure can retry same reference safely');
              equal(f.calls.length, 3, name + ': retry only calls idempotent confirmation');
            }
          }
        }
        await f.close({ screenshot: await f.shot('result') });
      }
    } finally { await browser.close(); }
  }
  const receipt = { status: 'PASS', mode: baseline ? 'confirmed-existing-defect' : 'regression', checks, states, sourceSha256: sha(source), accessGateSha256: sha(fs.readFileSync(path.join(root, 'workspace-access-gate.js'))), sdkIntegrity: integrity, publicDependencyDownloads: 1, liveProviderRequests: 0, paymentMutations: 0, observedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(out, 'CHECKS.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', mode: receipt.mode, checks, states: states.length, out }));
} catch (error) {
  fs.writeFileSync(path.join(out, 'FAILURE.json'), JSON.stringify({ checks, states, error: error.stack }, null, 2) + '\n');
  throw error;
}
