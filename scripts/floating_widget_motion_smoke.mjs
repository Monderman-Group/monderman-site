// Full-script motion-family regression. Public layout only; no service calls.
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
      for (const surface of [
        { name: 'connect.html', width: 768, height: 1024, reveal: '#contactFormShell', footerEntry: false },
        { name: 'research.html', width: 390, height: 844, reveal: '.cta-inner', footerEntry: true },
        { name: 'index.html', width: 390, height: 844, reveal: '.connect-choice-card:last-child', footerEntry: true },
      ]) for (const order of ['assistant-first', 'connect-first']) {
        const page = await engine.newPage({ viewport: { width: surface.width, height: surface.height }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Anonymous auth fixture only: no network sign-in or form submission.
        await page.addInitScript(() => { window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) }; });
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          return url.origin === localOrigin && route.request().method() === 'GET' ? route.continue() : route.abort();
        });
        if (order === 'connect-first') {
          await page.route('**/' + surface.name, async route => {
            const response = await route.fetch();
            let html = await response.text();
            const assistant = html.match(/<script\b[^>]*src="assistant\.js[^\"]*"[^>]*><\/script>/)?.[0];
            const connect = html.match(/<script\b[^>]*src="connect-widget\.js[^\"]*"[^>]*><\/script>/)?.[0];
            assert.ok(assistant && connect, 'both real widget scripts must exist before testing reversed order');
            html = html.replace(assistant, '<!-- widget-order-placeholder -->').replace(connect, assistant).replace('<!-- widget-order-placeholder -->', connect);
            await route.fulfill({ response, body: html });
          });
        }
        await page.goto(`${base}/${surface.name}`, { waitUntil: 'load', timeout: 30000 });
        await page.locator('#mnd-launcher').waitFor({ state: 'attached' });
        await page.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
        if (surface.footerEntry) await page.evaluate(() => window.scrollTo({ top: scrollY + document.querySelector('.mond-footer').getBoundingClientRect().top - (innerHeight - 40), behavior: 'instant' }));
        // Network startup can finish a page's reveal before the test attaches.
        // After the homepage's existing 2600ms fallback, replay only the real
        // element's visibility state; all transition CSS/durations stay intact.
        await page.waitForFunction(() => performance.now() > 3200);
        await page.evaluate(selector => {
          const node = document.querySelector(selector);
          if (node.hasAttribute('data-research-reveal')) node.setAttribute('data-research-reveal', 'pending');
          else node.classList.remove('is-visible');
        }, surface.reveal);
        await page.waitForFunction(selector => {
          const transform = getComputedStyle(document.querySelector(selector)).transform;
          return transform !== 'none' && new DOMMatrixReadOnly(transform).m42 > 15.9;
        }, surface.reveal);
        await page.evaluate(selector => {
          const node = document.querySelector(selector);
          if (node.hasAttribute('data-research-reveal')) node.setAttribute('data-research-reveal', 'visible');
          else node.classList.add('is-visible');
        }, surface.reveal);
        const frames = [];
        for (let sample = 0; sample < 36; sample++) {
          // Sample after that frame's layout/controller callbacks, not before
          // requestAnimationFrame has had a chance to place the controls.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
          frames.push(await page.evaluate(revealSelector => {
            const actions = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => ({ visible: getComputedStyle(node).visibility === 'visible', box: node.getBoundingClientRect().toJSON() }));
            const boxes = actions.map(action => action.box);
            const obstacles = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]')]
              .filter(node => !node.matches('#mnd-launcher,.mdn-cn-launch') && !node.closest('#siteHeader,.mond-footer,#mnd-panel,#mdn-cn-root') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
              .map(node => ({ id: node.id, box: node.getBoundingClientRect().toJSON() }))
              .filter(({ box }) => box.right > Math.min(...boxes.map(item => item.left)) - 8 && box.left < Math.max(...boxes.map(item => item.right)) + 8
                && box.bottom > Math.min(...boxes.map(item => item.top)) - 8 && box.top < Math.max(...boxes.map(item => item.bottom)) + 8);
            const transform = getComputedStyle(document.querySelector(revealSelector)).transform;
            return { actions, obstacles, transform, footerTop: document.querySelector('.mond-footer').getBoundingClientRect().top, revealOffset: transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42, overlap: actions.every(action => action.visible) && obstacles.length > 0 };
          }, surface.reveal));
          await page.waitForTimeout(20);
        }
        await page.screenshot({ path: path.join(out, `${engineName}-${surface.name}-${order}-reveal-settled.png`) });
        let lateLayout = null;
        if (surface.name === 'connect.html') {
          // Deliberately insert normal-flow content at the old control position.
          // No scroll, viewport resize or controller call may repair placement.
          const before = await page.locator('#mnd-launcher').boundingBox();
          await page.evaluate(top => {
            const banner = document.createElement('section');
            banner.id = 'late-layout-fixture';
            banner.style.cssText = `box-sizing:border-box;padding-top:${top + 8}px;`;
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = 'Local late-layout check';
            button.style.cssText = 'display:block;box-sizing:border-box;width:100%;height:48px;margin:0;';
            banner.append(button); document.body.prepend(banner);
          }, before.y);
          await page.waitForFunction(() => {
            const obstacle = document.querySelector('#late-layout-fixture button').getBoundingClientRect();
            return [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => {
              const rect = node.getBoundingClientRect();
              return getComputedStyle(node).visibility === 'visible' && rect.bottom <= obstacle.top - 8;
            });
          }, null, { timeout: 5000 });
          const inserted = await page.locator('#mnd-launcher').boundingBox();
          assert.ok(inserted.y < before.y, 'late content must move the widget without scroll or resize');
          await page.locator('#late-layout-fixture').evaluate(node => node.remove());
          await page.waitForFunction(before => {
            const box = document.querySelector('#mnd-launcher').getBoundingClientRect();
            return Math.abs(box.top - before.y) <= 1 && Math.abs(box.bottom - before.y - before.height) <= 1;
          }, before, { timeout: 5000 });
          lateLayout = { before, inserted, removed: await page.locator('#mnd-launcher').boundingBox(), returnedWithoutScroll: true };
        }
        await page.waitForTimeout(300);
        const idleStyleMutations = await page.evaluate(() => new Promise(resolve => {
          let count = 0;
          const observer = new MutationObserver(records => { count += records.length; });
          for (const node of document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
          setTimeout(() => { observer.disconnect(); resolve(count); }, 150);
        }));
        const label = `${engineName}/${surface.width}/${surface.name}/${order}/reveal`;
        evidence.push({ engineName, surface, order, motionTrigger: 'Replay existing reveal state after startup; original CSS, durations and DOM controls unchanged', frames, lateLayout, idleStyleMutations, errors });
        fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ evidence }, null, 2));
        if (!frames.some(frame => frame.revealOffset > 0.1)) failures.push(`${label}: test missed the actual reveal motion`);
        if (frames.some(frame => frame.overlap)) failures.push(`${label}: floating control covered actionable content during reveal`);
        if (idleStyleMutations !== 0) failures.push(`${label}: docking animation callbacks did not stop after reveal`);
        if (errors.length) failures.push(`${label}: browser errors ${JSON.stringify(errors)}`);
        const settled = frames.at(-1);
        if (settled.actions.length !== 2 || settled.actions.some(action => !action.visible || action.box.height < 48 || action.box.left < surface.width / 2 || action.box.right > surface.width || action.box.bottom > surface.height || action.box.bottom > settled.footerTop - 15.5)) failures.push(label + ': settled controls are missing, hidden or clipped');
        await page.close();
      }
    } finally { await engine.close(); }
  }
  assert.deepEqual(failures, [], `floating reveal failures:\n${failures.join('\n')}`);
  fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ status: 'PASS', sampledFrames: evidence.reduce((count, item) => count + item.frames.length, 0), liveServiceCalls: 0, evidence }, null, 2));
  console.log('floating reveal smoke: passed 432 sampled frames across all three motion families and both widget load orders in Chromium and WebKit');
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runFloatingWidgetMotionSmoke();
