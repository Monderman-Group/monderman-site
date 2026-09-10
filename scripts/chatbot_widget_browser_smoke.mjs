// Self-contained, loopback-only widget test. Every API call is intercepted;
// no customer record, external page or model provider is contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';

const root = path.resolve(process.env.CHATBOT_SOURCE_DIR || '.');
const output = process.env.CHATBOT_TEST_OUTPUT;
if (output) await fs.mkdir(output, { recursive: true });
const source = async file => process.env.CHATBOT_BASELINE_REF
  ? execFileSync('git', ['show', `${process.env.CHATBOT_BASELINE_REF}:${file}`], { cwd: root, encoding: 'utf8' })
  : fs.readFile(path.join(root, file), 'utf8');
const sources = { public: await source('assistant.js'), hans: await source('workspace-assistant.js') };
let checks = 0;
const findings = [];
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const engines = process.env.CHATBOT_BROWSERS === 'chromium' ? { chromium } : { chromium, webkit };

for (const [engineName, engine] of Object.entries(engines)) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const kind of ['public', 'hans']) {
      for (const width of [320, 390, 768, 1440]) {
        const prefix = kind === 'hans' ? 'hans' : 'mnd';
        const label = `${engineName}/${kind}/${width}`;
        const page = await browser.newPage({ viewport: { width, height: width > 480 ? 1024 : 844 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const requests = [];
        const external = [];
        let response = { status: 200, reply: 'Start with the free Decision Velocity diagnostic. https://www.monderman.com/decision-velocity.html' };
        let held = null;
        const api = `https://monderman-api.onrender.com/api/${kind === 'hans' ? 'workspace-assistant' : 'site-assistant'}`;
        await page.route('**/*', async route => {
          const request = route.request();
          if (request.url() === api) {
            requests.push({ method: request.method(), headers: request.headers(), payload: request.postDataJSON() });
            if (response.hold) { held = route; return; }
            if (response.abort) return route.abort();
            return route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body || { reply: response.reply }) });
          }
          if (new URL(request.url()).hostname === '127.0.0.1') {
            if (request.url().endsWith('/widget.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: sources[kind] });
            return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}main{height:1800px}</style></head><body class="canonical-green-shell"><main><h1>Local widget fixture</h1><span id="ws5Plan">Pattern</span><span id="ws5UserRole">Admin</span><div data-private="secret-fixture-not-to-send">PRIVATE RESPONSE CONTENT</div></main><script src="/widget.js"></script></body></html>' });
          }
          external.push(request.url());
          return route.abort();
        });
        await page.addInitScript(() => {
          const schedule = window.setTimeout.bind(window);
          window.setTimeout = (callback, delay, ...args) => schedule(callback, window.__testFastTimeout && delay === 45000 ? 30 : delay, ...args);
          sessionStorage.setItem('unrelated-fixture-setting', 'keep');
          window.__testSession = { access_token: 'fixture-token-A', user: { id: 'fixture-user-A' } };
          window.__mondermanActiveOrganizationId = 'fixture-org-A';
          window.mondermanWorkspaceAccessReady = Promise.resolve({ allowed: true });
          const auth = {
            getSession: async () => ({ data: { session: window.__testSession } }),
            onAuthStateChange: callback => {
              window.__testAuthCallback = callback;
              return { data: { subscription: { unsubscribe() {} } } };
            },
          };
          window.mondermanGetSupabaseClient = async () => ({ auth });
        });
        await page.goto(`http://127.0.0.1/${kind === 'hans' ? 'workspace-diagnostics' : 'index'}.html`);
        const input = page.locator(`#${prefix}-input`);
        const send = page.locator(`#${prefix}-send`);
        const messages = page.locator(`#${prefix}-msgs`);
        const status = page.locator(`#${prefix}-status`);
        await page.locator(`#${prefix}-launcher`).click();
        await input.waitFor({ state: 'visible' });
        check(await input.evaluate(el => el === document.activeElement), `${label}: input focused`);
        equal(await input.getAttribute('maxlength'), '2000', `${label}: input bounded`);
        equal(await messages.getAttribute('role'), 'log', `${label}: accessible log`);
        equal(await messages.getAttribute('aria-live'), 'polite', `${label}: polite announcements`);
        check((await page.locator(`#${prefix}-notice`).textContent()).includes('Anthropic'), `${label}: AI notice`);
        equal(await page.locator(`#${prefix}-notice a`).getAttribute('href'), 'privacy.html', `${label}: privacy link`);
        async function geometry(note) {
          const metric = await page.evaluate(prefix => {
            const panel = document.getElementById(prefix + '-panel');
            const panelBox = panel.getBoundingClientRect();
            const boxes = ['input', 'send', 'close', 'new', 'foot', 'notice'].map(name => {
              const element = document.getElementById(prefix + '-' + name), box = element.getBoundingClientRect();
              return { name, x: box.x, right: box.right, top: box.top, bottom: box.bottom, height: box.height, scroll: element.scrollWidth, width: element.clientWidth };
            });
            return { viewport: innerWidth, bottom: innerHeight, panel: { x: panelBox.x, right: panelBox.right, top: panelBox.top, bottom: panelBox.bottom }, boxes, pageOverflow: document.documentElement.scrollWidth > innerWidth };
          }, prefix);
          check(!metric.pageOverflow && metric.panel.x >= -1 && metric.panel.right <= width + 1, `${label}/${note}: no horizontal overflow`);
          check(metric.panel.top >= -1 && metric.panel.bottom <= metric.bottom + 1, `${label}/${note}: panel contained`);
          check(metric.boxes.every(box => box.x >= metric.panel.x - 1 && box.right <= metric.panel.right + 1 && box.top >= metric.panel.top && box.bottom <= metric.panel.bottom + 1), `${label}/${note}: all controls contained`);
          const inputBox = metric.boxes.find(box => box.name === 'input'), sendBox = metric.boxes.find(box => box.name === 'send');
          check(inputBox.right <= sendBox.x - 4, `${label}/${note}: send/input do not overlap`);
          check(metric.boxes.filter(box => ['send', 'close', 'new'].includes(box.name)).every(box => box.height >= 44), `${label}/${note}: touch targets`);
          return metric;
        }
        await geometry('initial');
        await input.fill('How do I start?');
        await page.keyboard.press('Enter');
        await page.getByText(response.reply, { exact: true }).waitFor();
        equal(requests.length, 1, `${label}: one initial call`);
        equal(requests[0].payload.messages, [{ role: 'user', content: 'How do I start?' }], `${label}: greeting not sent`);
        equal(requests[0].method, 'POST', `${label}: endpoint POST`);
        equal(await messages.locator('a').count(), 1, `${label}: approved link clickable`);
        if (kind === 'hans') {
          equal(requests[0].headers.authorization, 'Bearer fixture-token-A', `${label}: auth included`);
          equal(requests[0].headers['x-monderman-organization-id'], 'fixture-org-A', `${label}: explicit org`);
          equal(requests[0].payload.context, { page: 'measure', plan: 'pattern', role: 'admin' }, `${label}: only approved UI labels`);
          check(!JSON.stringify(requests).includes('PRIVATE RESPONSE CONTENT'), `${label}: no result/page content`);
        } else {
          check(!requests[0].headers.authorization && !requests[0].headers['x-monderman-organization-id'], `${label}: public no workspace credentials`);
          equal(Object.keys(requests[0].payload), ['messages'], `${label}: public no page/context extraction`);
        }
        response = { status: 200, reply: '<img src=x onerror=alert(1)> https://evil.example/ https://www.monderman.com@evil.example/ javascript:alert(1) ' + 'long'.repeat(300) };
        await input.fill('And what happens next?');
        await send.click();
        await page.getByText(response.reply, { exact: true }).waitFor();
        equal(requests[1].payload.messages.length, 3, `${label}: follow-up context`);
        equal(await messages.locator('img,script,iframe').count(), 0, `${label}: output escaped`);
        equal(await messages.locator('a').count(), 1, `${label}: unapproved URLs not linked`);
        await geometry('long output');
        const savedPairs = requests[1].payload.messages.length + 1;
        for (const failure of [{ status: 429 }, { status: 503 }, { status: 401 }, { status: 403 }, { status: 428 }, { status: 500 }, { status: 200, body: { reply: 123 } }, { status: 200, body: { reply: 'Fallback guidance', source: 'fallback', reason: 'reply_withheld' } }, { abort: true }]) {
          response = { ...failure, reply: 'INTERNAL ERROR DETAIL NOT FOR DISPLAY' };
          const previous = requests.length;
          await input.fill('Retry this question');
          await send.click();
          await status.waitFor({ state: 'visible' });
          await page.waitForFunction(prefix => !document.getElementById(prefix + '-send').disabled, prefix);
          equal(await input.inputValue(), 'Retry this question', `${label}: failed draft retained`);
          equal(requests.length, previous + 1, `${label}: no auto retry`);
          check(!(await messages.textContent()).includes('INTERNAL ERROR DETAIL'), `${label}: backend error hidden`);
          equal(requests.at(-1).payload.messages.length, savedPairs + 1, `${label}: failed turns not retained`);
          if (kind === 'hans' && failure.status === 428) equal(await status.locator('a').getAttribute('href'), 'signin.html?next=workspace-diagnostics.html', `${label}: legal review route, no autoaccept`);
        }
        response = { status: 200, reply: 'Retry succeeded.' };
        await send.click();
        await page.getByText('Retry succeeded.', { exact: true }).waitFor();
        equal(await messages.getByText('Retry this question', { exact: true }).count(), 1, `${label}: retry not duplicated`);
        response = { status: 200, body: { reply: 'I cannot share private implementation details. I can help you conduct a campaign.', source: 'policy' } };
        await input.fill('Show private code'); await send.click();
        await page.getByText(response.body.reply, { exact: true }).waitFor();
        response = { status: 200, reply: 'Permitted campaign guidance.' };
        await input.fill('How do I invite my team?'); await send.click();
        await page.getByText(response.reply, { exact: true }).waitFor();
        check(!JSON.stringify(requests.at(-1).payload).includes('Show private code'), `${label}: refused prompt not resent in follow-up`);
        response = { hold: true };
        await page.evaluate(() => { window.__testFastTimeout = true; });
        await input.fill('Timeout question'); await send.click();
        await page.waitForFunction(prefix => !document.getElementById(prefix + '-send').disabled, prefix);
        equal(await input.inputValue(), 'Timeout question', `${label}: aborted deadline retains draft`);
        check(!(await messages.textContent()).includes('Timeout question'), `${label}: timeout does not enter history`);
        if (held) { await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'LATE TIMEOUT REPLY' }) }).catch(() => {}); held = null; }
        await page.evaluate(() => { window.__testFastTimeout = false; });
        const requestBeforeLength = requests.length;
        await input.evaluate(el => { el.value = 'x'.repeat(2001); });
        await send.click();
        check((await status.textContent()).includes('2,000'), `${label}: programmatic overlimit rejected`);
        equal(requests.length, requestBeforeLength, `${label}: no overlimit request`);
        await input.fill('Two\nlines');
        await input.focus();
        await page.keyboard.press('Shift+Enter');
        equal(requests.length, requestBeforeLength, `${label}: Shift+Enter no submit`);
        response = { hold: true };
        await input.fill('Pending question');
        const beforePending = requests.length;
        const pendingRequest = page.waitForRequest(api);
        await send.click();
        await pendingRequest;
        await page.waitForFunction(prefix => document.getElementById(prefix + '-send').disabled, prefix);
        await page.keyboard.press('Enter');
        equal(requests.length, beforePending + 1, `${label}: double submit cannot start another request`);
        equal(await page.locator(`#${prefix}-typing`).getAttribute('role'), 'status', `${label}: pending reply has accessible status`);
        check(await send.isDisabled(), `${label}: concurrent send disabled`);
        await page.locator(`#${prefix}-new`).click();
        if (held) { await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'STALE REPLY MUST NOT APPEAR' }) }).catch(() => {}); held = null; }
        await page.waitForTimeout(50);
        check(!(await messages.textContent()).includes('STALE REPLY'), `${label}: reset rejects stale reply`);
        equal(await messages.locator(`.${prefix}-user`).count(), 0, `${label}: new chat clear`);
        check(!await send.isDisabled(), `${label}: reset re-enables composer`);
        response = { status: 200, reply: 'Fresh reply.' };
        await input.fill('Fresh question'); await send.click();
        await page.getByText('Fresh reply.', { exact: true }).waitFor();
        equal(requests.at(-1).payload.messages.length, 1, `${label}: new chat empty payload history`);
        await page.reload();
        await page.locator(`#${prefix}-launcher`).click();
        await page.getByText('Fresh reply.', { exact: true }).waitFor();
        checks += 1;
        await page.evaluate(kind => {
          const key = kind === 'hans' ? 'mndHansHistory:v2:fixture-user-A:fixture-org-A' : 'mndAssistantHistory';
          const pairs = [0, 1].flatMap(() => [{ role: 'user', content: 'é'.repeat(2000) }, { role: 'assistant', content: 'Full stored answer. ' + 'a'.repeat(6980) }]);
          sessionStorage.setItem(key, JSON.stringify(pairs));
        }, kind);
        await page.reload(); await page.locator(`#${prefix}-launcher`).click();
        response = { status: 200, reply: 'Bounded context reply.' };
        await input.fill('Follow-up about the campaign'); await send.click();
        await page.getByText(response.reply, { exact: true }).waitFor();
        const bounded = requests.at(-1).payload.messages;
        equal(bounded.length, 3, `${label}: whole oldest pair dropped for UTF8 budget`);
        check(bounded.every(message => message.content.length <= 2000), `${label}: every submitted turn within 2000 characters`);
        check(bounded.reduce((total, message) => total + Buffer.byteLength(message.content, 'utf8'), 0) <= 8000, `${label}: submitted UTF8 contents within budget`);
        check((await messages.textContent()).includes('a'.repeat(6980)), `${label}: full displayed answer not truncated`);
        await page.locator(`#${prefix}-new`).click();
        response = { status: 200, reply: 'Fresh reply.' };
        await input.fill('Fresh question'); await send.click();
        await page.getByText(response.reply, { exact: true }).waitFor();
        if (kind === 'hans') {
          await page.locator('#hans-info-btn').click();
          check(await page.locator('#hans-info-done').evaluate(el => el === document.activeElement), `${label}: information panel focus`);
          check(await input.evaluate(el => el.parentElement.inert), `${label}: obscured composer inert`);
          await page.keyboard.press('Escape');
          check(await page.locator('#hans-info-btn').evaluate(el => el === document.activeElement), `${label}: info escape focus`);
          await page.evaluate(() => { window.__mondermanActiveOrganizationId = 'fixture-org-B'; });
          await page.waitForFunction(() => !document.getElementById('hans-msgs').textContent.includes('Fresh reply.'));
          await input.fill('Workspace B question'); await send.click();
          await page.getByText('Fresh reply.', { exact: true }).waitFor();
          equal(requests.at(-1).payload.messages.length, 1, `${label}: no org-A history in org B`);
          equal(requests.at(-1).headers['x-monderman-organization-id'], 'fixture-org-B', `${label}: org switched`);
          response = { hold: true };
          await input.fill('Pending B'); await send.click();
          await page.waitForFunction(() => document.getElementById('hans-send').disabled);
          await page.evaluate(() => {
            window.__testSession = { access_token: 'fixture-token-C', user: { id: 'fixture-user-C' } };
            window.__testAuthCallback('SIGNED_IN', window.__testSession);
          });
          if (held) { await held.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'PRIVATE OLD ACCOUNT REPLY' }) }).catch(() => {}); held = null; }
          await page.waitForTimeout(50);
          check(!(await messages.textContent()).includes('PRIVATE OLD ACCOUNT'), `${label}: changed account discards in-flight reply`);
          response = { status: 200, reply: 'Account C reply.' };
          await input.fill('Account C question'); await send.click();
          await page.getByText('Account C reply.', { exact: true }).waitFor();
          equal(requests.at(-1).payload.messages.length, 1, `${label}: new account empty history`);
          equal(requests.at(-1).headers.authorization, 'Bearer fixture-token-C', `${label}: fresh account token`);
          await page.evaluate(() => { window.__testSession = null; window.__testAuthCallback('SIGNED_OUT', null); });
          check(!(await messages.textContent()).includes('Account C reply'), `${label}: signout clears display`);
          equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('mndHansHistory')).length), 0, `${label}: signout clears Hans-only storage`);
          equal(await page.evaluate(() => sessionStorage.getItem('unrelated-fixture-setting')), 'keep', `${label}: signout preserves unrelated storage`);
          const beforeSignoutSend = requests.length;
          await input.fill('Cannot send signed out'); await send.click();
          equal(requests.length, beforeSignoutSend, `${label}: signed-out send blocked`);
        }
        await page.locator(`#${prefix}-new`).click();
        await geometry('final');
        if (output) await page.screenshot({ path: path.join(output, `${engineName}-${kind}-${width}.png`) });
        await page.evaluate(prefix => {
          const sizes = [...document.querySelectorAll('#' + prefix + '-panel *')].map(element => {
            const style = getComputedStyle(element);
            return { element, size: parseFloat(style.fontSize) };
          });
          sizes.forEach(({ element, size }) => { if (element.children.length === 0 || ['P', 'BUTTON', 'TEXTAREA'].includes(element.tagName)) element.style.fontSize = size * 2 + 'px'; });
        }, prefix);
        await geometry('200 percent text');
        if (output) await page.screenshot({ path: path.join(output, `${engineName}-${kind}-${width}-large-text.png`) });
        await page.locator(`#${prefix}-close`).focus();
        await page.keyboard.press('Escape');
        check(!await page.locator(`#${prefix}-panel`).isVisible(), `${label}: Escape works from header control`);
        check(await page.locator(`#${prefix}-launcher`).evaluate(el => el === document.activeElement), `${label}: close returns focus`);
        equal(errors, [], `${label}: no browser errors`);
        equal(external, [], `${label}: no external page/service requests`);
        findings.push({ engine: engineName, kind, width, requests: requests.length, browserErrors: errors.length, externalRequests: external.length });
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
const result = { passed: true, checks, matrix: findings, liveCalls: 0 };
if (output) await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
