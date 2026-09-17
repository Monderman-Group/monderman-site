// Full-script motion-family regression. Public layout only; no service calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium,webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

export async function runFloatingWidgetMotionSmoke({ base = process.env.SITE_BASE || 'http://127.0.0.1:8080', out = process.env.FLOATING_MOTION_OUT || '/tmp/floating-widget-motion' } = {}) {
  const localOrigin = new URL(base).origin;
  const failures = [];
  fs.mkdirSync(out, { recursive: true });
  const evidence = [];
  for (const [engineName, engineType] of [['chromium', chromium], ['webkit', webkit]]) {
    const engine = await engineType.launch({ headless: true });
    try {
      for (const surface of [
        { name: 'connect.html', width: 768, height: 1024, reveal: '#contactFormShell' },
        { name: 'research.html', width: 390, height: 844, reveal: '.cta-inner' },
        { name: 'index.html', width: 390, height: 844, reveal: '.connect-choice-card:last-child' },
      ]) for (const order of ['assistant-first', 'connect-first']) {
        const label = `${engineName}/${surface.width}/${surface.name}/${order}/reveal`;
        let phase = 'navigation';
        console.log('START', label);
        const page = await engine.newPage({ viewport: { width: surface.width, height: surface.height }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const errors = [];
        const frames = [];
        try {
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
        await page.evaluate(selector => {
          const node = document.querySelector(selector);
          window.__floatingMotionTrace = [];
          const record = event => {
            window.__floatingMotionTrace.push({ time: performance.now(), event, className: node.className, reveal: node.getAttribute('data-research-reveal'), transform: getComputedStyle(node).transform });
            if (window.__floatingMotionTrace.length > 80) window.__floatingMotionTrace.shift();
          };
          new MutationObserver(() => record('attributes')).observe(node, { attributes: true, attributeFilter: ['class', 'data-research-reveal'] });
          for (const name of ['transitionrun', 'transitionend', 'transitioncancel']) node.addEventListener(name, event => { if (event.target === node && event.propertyName === 'transform') record(name); });
          record('attached');
        }, surface.reveal);
        // Let the real observer reveal and unobserve this target before replay.
        // Navigation uptime does not establish when a deferred script started.
        phase = 'initial visible lifecycle';
        await page.locator(surface.reveal).scrollIntoViewIfNeeded();
        await page.waitForFunction(selector => {
          const node = document.querySelector(selector), transform = getComputedStyle(node).transform;
          return (node.getAttribute('data-research-reveal') === 'visible' || node.classList.contains('is-visible'))
            && (transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m42) < 0.01)
            && node.getAnimations().every(animation => animation.playState === 'finished');
        }, surface.reveal);
        // The existing fallback starts when homepage-motion.js executes, not at
        // navigation start. All deferred scripts have executed at load above.
        if (surface.name === 'index.html') await page.waitForTimeout(2800);
        // Replay ordinary content near the fixed corner, with the footer still
        // below the viewport. Reveals must not suppress the support controls.
        await page.evaluate(selector => {
          const targetTop = document.querySelector(selector).getBoundingClientRect().top + scrollY;
          const footerTop = document.querySelector('.mond-footer').getBoundingClientRect().top + scrollY;
          scrollTo({ top: Math.max(0, Math.min(targetTop - innerHeight + 120, footerTop - innerHeight - 32)), behavior: 'instant' });
        }, surface.reveal);
        phase = 'replay hidden endpoint';
        await page.evaluate(selector => {
          const node = document.querySelector(selector);
          if (node.hasAttribute('data-research-reveal')) node.setAttribute('data-research-reveal', 'pending');
          else node.classList.remove('is-visible');
        }, surface.reveal);
        await page.waitForFunction(selector => {
          const transform = getComputedStyle(document.querySelector(selector)).transform;
          return transform !== 'none' && new DOMMatrixReadOnly(transform).m42 > 15.9;
        }, surface.reveal);
        phase = 'sample real reveal';
        await page.evaluate(selector => {
          const node = document.querySelector(selector);
          if (node.hasAttribute('data-research-reveal')) node.setAttribute('data-research-reveal', 'visible');
          else node.classList.add('is-visible');
        }, surface.reveal);
        for (let sample = 0; sample < 36; sample++) {
          // Sample after that frame's layout/controller callbacks, not before
          // requestAnimationFrame has had a chance to place the controls.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
          frames.push(await page.evaluate(revealSelector => {
            const actions = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => ({ connect: node.matches('.mdn-cn-launch'), visible: getComputedStyle(node).visibility === 'visible', pointerEvents: getComputedStyle(node).pointerEvents, box: node.getBoundingClientRect().toJSON() }));
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
          phase = 'late content insertion';
          // Deliberately insert normal-flow content into the fixed control slot.
          // It must not hide or move controls, even without a scroll event.
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const before = await page.locator('#mnd-launcher').evaluate(node => ({ ...node.getBoundingClientRect().toJSON(), visible: getComputedStyle(node).visibility === 'visible' }));
          assert.equal(before.visible, true, 'late content fixture begins with a visible launcher');
          await page.evaluate(top => {
            const banner = document.createElement('section');
            banner.id = 'late-layout-fixture';
            banner.style.cssText = `box-sizing:border-box;padding-top:${top + 8}px;`;
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = 'Local late-layout check';
            button.style.cssText = 'display:block;box-sizing:border-box;width:100%;height:48px;margin:0;';
            banner.append(button); document.body.prepend(banner);
          }, before.y);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const insertedVisible = await page.evaluate(() => {
            return [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => {
              const style = getComputedStyle(node);
              return style.visibility === 'visible' && style.pointerEvents !== 'none';
            });
          });
          assert.equal(insertedVisible, true, 'late ordinary content must keep both launchers visible and interactive');
          const inserted = await page.locator('#mnd-launcher').evaluate(node => node.getBoundingClientRect().toJSON());
          assert.ok(Math.abs(inserted.y - before.y) <= 1, 'late content must not move the fixed widget');
          phase = 'late content removal';
          await page.locator('#late-layout-fixture').evaluate(node => node.remove());
          await page.waitForFunction(before => {
            const node = document.querySelector('#mnd-launcher'), box = node.getBoundingClientRect();
            return Math.abs(box.top - before.y) <= 1 && Math.abs(box.bottom - before.y - before.height) <= 1
              && (getComputedStyle(node).visibility === 'visible') === before.visible;
          }, before, { timeout: 5000 });
          lateLayout = { before, inserted, insertedVisible, removed: await page.locator('#mnd-launcher').evaluate(node => node.getBoundingClientRect().toJSON()), remainedVisibleWithoutScroll: true };
        }
        phase = 'settled idle check';
        await page.waitForTimeout(300);
        const idleStyleMutations = await page.evaluate(() => new Promise(resolve => {
          let count = 0;
          const observer = new MutationObserver(records => { count += records.length; });
          for (const node of document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
          setTimeout(() => { observer.disconnect(); resolve(count); }, 150);
        }));
        evidence.push({ engineName, surface, order, motionTrigger: 'Replay after real visible lifecycle and deferred-script fallback; original observers, CSS, durations and DOM controls unchanged', frames, lateLayout, idleStyleMutations, errors });
        fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ evidence }, null, 2));
        if (!frames.some(frame => frame.revealOffset > 0.1)) failures.push(`${label}: test missed the actual reveal motion`);
        if (frames.some(frame => frame.actions.length !== 2 || frame.actions.some(action => !action.visible))) failures.push(`${label}: ordinary reveal hid the fixed support controls`);
        const edge = surface.width <= 480 ? 16 : 20;
        if (frames.some(frame => frame.actions.some(action => action.visible && (
          Math.abs(action.box.right - (surface.width - edge)) > 1.5
          || Math.abs(action.box.bottom - (surface.height - edge - (action.connect ? 60 : 0))) > 1.5
        )))) failures.push(`${label}: visible control moved away from its fixed anchor during reveal`);
        if (frames.some(frame => frame.actions.some(action => !action.visible && action.pointerEvents !== 'none')))
          failures.push(`${label}: hidden control remains interactive during reveal`);
        if (idleStyleMutations !== 0) failures.push(`${label}: docking animation callbacks did not stop after reveal`);
        if (errors.length) failures.push(`${label}: browser errors ${JSON.stringify(errors)}`);
        const settled = frames.at(-1);
        if (settled.actions.length !== 2 || settled.actions.some(action => action.box.height < 48 || action.box.left < surface.width / 2 || action.box.right > surface.width || action.box.bottom > surface.height || (action.visible && action.box.bottom > settled.footerTop - 15.5))) failures.push(label + ': settled controls are missing, clipped or cover the footer');
        phase = 'assert sampled and settled states';
        assert.deepEqual(failures.filter(failure => failure.startsWith(label)), [], label + ': motion checks');
        console.log('PASS', label);
        } catch (error) {
          const state = await page.evaluate(selector => {
            const node = document.querySelector(selector), style = node && getComputedStyle(node);
            return { time: performance.now(), scrollY, viewport: { width: innerWidth, height: innerHeight }, bodyClass: document.body?.className, target: node && { className: node.className, reveal: node.getAttribute('data-research-reveal'), box: node.getBoundingClientRect().toJSON(), transform: style.transform, opacity: style.opacity, transition: style.transition, animations: node.getAnimations().map(animation => ({ playState: animation.playState, currentTime: animation.currentTime, timing: animation.effect?.getComputedTiming() })) }, trace: window.__floatingMotionTrace || [] };
          }, surface.reveal).catch(() => null);
          const prefix = `${engineName}-${surface.name}-${order}`;
          const diagnostic = { status: 'FAIL', label, phase, error: String(error), stack: error.stack, state, frames, errors, completedStates: evidence.length };
          fs.writeFileSync(path.join(out, prefix + '-failure.json'), JSON.stringify(diagnostic, null, 2));
          fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ status: 'FAIL', failure: diagnostic, evidence }, null, 2));
          await page.screenshot({ path: path.join(out, prefix + '-failure.png') }).catch(() => {});
          console.error('FAIL', label, 'phase:', phase, String(error));
          throw error;
        } finally { await page.close(); }
      }
    } finally { await engine.close(); }
  }
  assert.deepEqual(failures, [], `floating reveal failures:\n${failures.join('\n')}`);
  fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ status: 'PASS', sampledFrames: evidence.reduce((count, item) => count + item.frames.length, 0), liveServiceCalls: 0, evidence }, null, 2));
  console.log('floating reveal smoke: passed 432 sampled frames across all three motion families and both widget load orders in Chromium and WebKit');
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runFloatingWidgetMotionSmoke();
