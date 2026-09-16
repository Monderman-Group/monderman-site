// Full-script Contact-page motion regression. Public layout only; no service calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

export async function runFloatingWidgetMotionSmoke({ base = process.env.SITE_BASE || 'http://127.0.0.1:8080', out = process.env.FLOATING_MOTION_OUT || '/tmp/floating-widget-motion' } = {}) {
  const localOrigin = new URL(base).origin;
  const failures = [];
  fs.mkdirSync(out, { recursive: true });
  const evidence = [];
  for (const [engineName, engineType] of [['chromium', chromium], ['webkit', webkit]]) {
    const engine = await engineType.launch({ headless: true });
    try {
      for (const order of ['assistant-first', 'connect-first']) {
        const page = await engine.newPage({ viewport: { width: 768, height: 1024 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Anonymous auth fixture only: no network sign-in or form submission.
        await page.addInitScript(() => { window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }; });
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          return url.origin === localOrigin && route.request().method() === 'GET' ? route.continue() : route.abort();
        });
        if (order === 'connect-first') {
          await page.route('**/connect.html', async route => {
            const response = await route.fetch();
            let html = await response.text();
            const assistant = html.match(/<script\b[^>]*src="assistant\.js[^\"]*"[^>]*><\/script>/)?.[0];
            const connect = html.match(/<script\b[^>]*src="connect-widget\.js[^\"]*"[^>]*><\/script>/)?.[0];
            assert.ok(assistant && connect, 'both real widget scripts must exist before testing reversed order');
            html = html.replace(assistant, '<!-- widget-order-placeholder -->').replace(connect, assistant).replace('<!-- widget-order-placeholder -->', connect);
            await route.fulfill({ response, body: html });
          });
        }
        await page.goto(`${base}/connect.html`, { waitUntil: 'load', timeout: 30000 });
        await page.locator('#mnd-launcher').waitFor({ state: 'attached' });
        await page.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
        const frames = [];
        for (let sample = 0; sample < 36; sample++) {
          // Sample after that frame's layout/controller callbacks, not before
          // requestAnimationFrame has had a chance to place the controls.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
          frames.push(await page.evaluate(() => {
            const actions = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => ({ visible: getComputedStyle(node).visibility === 'visible', box: node.getBoundingClientRect().toJSON() }));
            const boxes = actions.map(action => action.box);
            const obstacles = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]')]
              .filter(node => !node.matches('#mnd-launcher,.mdn-cn-launch') && !node.closest('#siteHeader,.mond-footer,#mnd-panel,#mdn-cn-root') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
              .map(node => ({ id: node.id, box: node.getBoundingClientRect().toJSON() }))
              .filter(({ box }) => box.right > Math.min(...boxes.map(item => item.left)) - 8 && box.left < Math.max(...boxes.map(item => item.right)) + 8
                && box.bottom > Math.min(...boxes.map(item => item.top)) - 8 && box.top < Math.max(...boxes.map(item => item.bottom)) + 8);
            const transform = getComputedStyle(document.querySelector('#contactFormShell')).transform;
            return { actions, obstacles, transform, revealOffset: transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42, overlap: actions.every(action => action.visible) && obstacles.length > 0 };
          }));
          await page.waitForTimeout(20);
        }
        await page.screenshot({ path: path.join(out, `${engineName}-${order}-reveal-settled.png`) });
        await page.waitForTimeout(300);
        const idleStyleMutations = await page.evaluate(() => new Promise(resolve => {
          let count = 0;
          const observer = new MutationObserver(records => { count += records.length; });
          for (const node of document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
          setTimeout(() => { observer.disconnect(); resolve(count); }, 150);
        }));
        const label = `${engineName}/768/connect.html/${order}/reveal`;
        evidence.push({ engineName, order, frames, idleStyleMutations, errors });
        fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ evidence }, null, 2));
        if (!frames.some(frame => frame.revealOffset > 0.1)) failures.push(`${label}: test missed the actual reveal motion`);
        if (frames.some(frame => frame.overlap)) failures.push(`${label}: floating control covered actionable content during reveal`);
        if (idleStyleMutations !== 0) failures.push(`${label}: docking animation callbacks did not stop after reveal`);
        if (errors.length) failures.push(`${label}: browser errors ${JSON.stringify(errors)}`);
        const settled = frames.at(-1);
        if (settled.actions.length !== 2 || settled.actions.some(action => !action.visible || action.box.height < 48 || action.box.left < 384 || action.box.right > 768 || action.box.bottom > 1024)) failures.push(label + ': settled controls are missing, hidden or clipped');
        await page.close();
      }
    } finally { await engine.close(); }
  }
  assert.deepEqual(failures, [], `floating reveal failures:\n${failures.join('\n')}`);
  fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ status: 'PASS', sampledFrames: 144, liveServiceCalls: 0, evidence }, null, 2));
  console.log('floating reveal smoke: passed 144 sampled frames across both widget load orders in Chromium and WebKit');
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runFloatingWidgetMotionSmoke();
