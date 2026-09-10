// Real page markup/styles/assets, with application scripts replaced by the two
// widgets (and public navigation) and all remote requests intercepted. This
// checks CSS integration without starting diagnostics or accessing customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const root = path.resolve(process.env.CHATBOT_SOURCE_DIR || '.');
const output = process.env.CHATBOT_TEST_OUTPUT;
if (output) await fs.mkdir(output, { recursive: true });
const results = [];
for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const file of ['index.html', 'workspace-diagnostics.html']) {
      for (const width of [390, 768, 1440]) {
        const workspace = file.startsWith('workspace'), prefix = workspace ? 'hans' : 'mnd';
        const page = await browser.newPage({ viewport: { width, height: width > 480 ? 1024 : 844 } });
        const original = await fs.readFile(path.join(root, file), 'utf8');
        const html = original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('</body>', `<script src="/${workspace ? 'workspace-assistant.js' : 'assistant.js'}"></script>${workspace ? '' : '<script src="/canonical-site-shell.js"></script>'}</body>`);
        let sends = 0;
        const external = [];
        await page.addInitScript(() => {
          window.__mondermanActiveOrganizationId = 'fixture-org-A';
          window.mondermanWorkspaceAccessReady = Promise.resolve({ allowed: true });
          window.mondermanGetSupabaseClient = async () => ({ auth: {
            getSession: async () => ({ data: { session: { access_token: 'fixture-token-A', user: { id: 'fixture-user-A' } } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          } });
        });
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname !== '127.0.0.1') {
            external.push(url.href);
            if (url.pathname === '/api/site-assistant' || url.pathname === '/api/workspace-assistant') {
              sends += 1;
              return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Choose the completed run, then select Report. This is a local test reply.' }) });
            }
            return route.abort();
          }
          if (url.pathname === '/' + file) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          if (!target.startsWith(root + path.sep)) return route.abort();
          try {
            const types = { '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
            return route.fulfill({ status: 200, contentType: types[path.extname(target)] || 'application/octet-stream', body: await fs.readFile(target) });
          } catch { return route.fulfill({ status: 404, body: 'Local fixture asset missing' }); }
        });
        await page.goto(`http://127.0.0.1/${file}`, { waitUntil: 'networkidle' });
        if (workspace) await page.locator('#hans-launcher').click();
        else {
          if (width <= 1180) await page.locator('.site-menu-button').click();
          await page.locator('[data-site-widget-action="assistant"]').click();
        }
        await page.locator(`#${prefix}-input`).fill('Where is the saved report?');
        await page.locator(`#${prefix}-send`).click();
        await page.getByText('Choose the completed run, then select Report. This is a local test reply.', { exact: true }).waitFor();
        const metric = await page.evaluate(prefix => {
          const box = id => { const r = document.getElementById(prefix + '-' + id).getBoundingClientRect(); return { x: r.x, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          const headerTitle = document.querySelector('#' + prefix + '-head .' + prefix + '-title');
          const titleBox = headerTitle.getBoundingClientRect();
          return { panel: box('panel'), input: box('input'), send: box('send'), head: box('head'), newChat: box('new'), headerTitle: { top: titleBox.top, bottom: titleBox.bottom }, viewport: innerWidth, height: innerHeight };
        }, prefix);
        assert.ok(metric.panel.x >= -1 && metric.panel.right <= width + 1 && metric.panel.top >= -1 && metric.panel.bottom <= metric.height + 1, `${engineName}/${file}/${width}: panel containment`);
        assert.ok(metric.input.right <= metric.send.x - 4 && metric.input.width > 80 && metric.send.right <= metric.panel.right, `${engineName}/${file}/${width}: composer fit`);
        assert.ok(Math.abs(metric.input.height - metric.send.height) <= 8, `${engineName}/${file}/${width}: empty composer not enlarged by page textarea styling`);
        if (!workspace) {
          assert.ok(metric.newChat.top < metric.headerTitle.bottom && metric.newChat.bottom > metric.headerTitle.top, `${engineName}/${file}/${width}: normal-font header controls share the title row`);
          assert.ok(metric.head.height <= 84, `${engineName}/${file}/${width}: no unnecessary second header row`);
          const phoneResult = results.find(item => item.engine === engineName && item.file === file && item.width === 390);
          if (phoneResult) assert.ok(Math.abs(phoneResult.metric.head.height - metric.head.height) <= 8, `${engineName}/${file}/${width}: desktop/tablet header balanced with phone`);
        }
        assert.equal(sends, 1);
        assert.equal(await page.locator(`#${prefix}-notice a`).getAttribute('href'), 'privacy.html');
        if (output) await page.screenshot({ path: path.join(output, `${engineName}-${prefix}-realpage-${width}.png`) });
        results.push({ engine: engineName, file, width, passed: true, mockedSends: sends, interceptedExternal: external.length, metric });
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
if (output) await fs.writeFile(path.join(output, 'page-layout-results.json'), JSON.stringify({ passed: true, liveCalls: 0, results }, null, 2));
console.log(JSON.stringify({ passed: true, liveCalls: 0, pages: results.length }));
