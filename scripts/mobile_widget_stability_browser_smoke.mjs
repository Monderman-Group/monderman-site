// Self-contained browser regression for the public Chat/Connect anchor.
// All requests are fulfilled from local source or blocked; no API is contacted.
// Set MOBILE_WIDGET_BASELINE_REF to a git revision to reproduce the old jump.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

export async function runMobileWidgetStabilitySmoke({
  root = process.cwd(),
  out = process.env.MOBILE_WIDGET_OUT || '/tmp/monderman-mobile-widget-stability',
  baselineRef = process.env.MOBILE_WIDGET_BASELINE_REF || '',
} = {}) {
  const startedAt = performance.now();
  root = path.resolve(root);
  await fs.mkdir(out, { recursive: true });
  const source = file => baselineRef
    ? execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFile(path.join(root, file), 'utf8');
  const files = ['assistant.js', 'connect-widget.js', 'canonical-site-shell.css', 'canonical-site-shell.js',
    'site-shell/header.html', 'site-shell/footer.html', 'assets/brand/brand-lockup.css', 'assets/brand/monderman-mark-v2-small.svg'];
  const assets = Object.fromEntries(await Promise.all(files.map(async file => [file, await source(file)])));
  const evidence = [], failures = [];
  const engines = process.env.MOBILE_WIDGET_BROWSERS?.split(',') || ['chromium', 'webkit'];
  const widths = (process.env.MOBILE_WIDGET_WIDTHS || '390,430,768,1440').split(',').map(Number);
  const orders = process.env.MOBILE_WIDGET_ORDERS?.split(',') || ['assistant-first', 'connect-first'];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const settle = async page => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const snapshot = page => page.evaluate(() => ({
    scrollY, width: innerWidth, height: innerHeight,
    visual: { top: visualViewport.offsetTop, height: visualViewport.height },
    footerTop: document.querySelector('.mond-footer').getBoundingClientRect().top,
    headerBottom: document.querySelector('#siteHeader').getBoundingClientRect().bottom,
    actions: [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => {
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      return { name: node.id === 'mnd-launcher' ? 'Chat' : 'Connect', visible: style.display !== 'none' && style.visibility === 'visible',
        display: style.display, pointerEvents: style.pointerEvents, bottom: parseFloat(style.bottom), right: parseFloat(style.right),
        box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height } };
    }),
  }));
  function assertAnchor(state, label) {
    const edge = state.width <= 480 ? 16 : 20;
    check(state.actions.length === 2, `${label}: both launchers exist`);
    for (const action of state.actions) {
      const expectedBottom = edge + (action.name === 'Connect' ? 60 : 0);
      check(Math.abs(action.bottom - expectedBottom) < 0.6, `${label}: ${action.name} bottom moved to ${action.bottom}px; expected ${expectedBottom}px`);
      check(Math.abs(action.right - edge) < 0.6, `${label}: ${action.name} right anchor changed`);
      if (action.display !== 'none') {
        check(Math.abs(state.height - action.box.bottom - expectedBottom) < 1.2, `${label}: ${action.name} moved away from its viewport anchor`);
        check(action.box.height >= 48 && action.box.width >= 100, `${label}: ${action.name} keeps its labeled touch target`);
      }
      if (!action.visible) check(action.pointerEvents === 'none', `${label}: hidden ${action.name} remains interactive`);
    }
  }
  const allVisible = state => state.actions.length === 2 && state.actions.every(action => action.visible);
  const allHidden = state => state.actions.length === 2 && state.actions.every(action => !action.visible && action.pointerEvents === 'none');
  const fixture = order => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="canonical-site-shell.css"><style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#faf8f2}.test-intro{height:calc(100vh + 280px);padding:150px 20px 0}
    .test-row{height:360px;padding:0 16px}.test-action{display:block;width:100%;height:48px;padding:12px;border:1px solid #0c6e78;border-radius:8px;background:#fff;color:#08383e;font:16px Arial;text-align:left}
    .test-tail{height:1400px}.test-tail p{padding:20px}.test-row label{display:block}.test-row input{margin:0}.mond-footer{min-height:700px}
    </style></head><body class="canonical-green-shell">${assets['site-shell/header.html']}
    <main><div class="test-intro"><h1>Local public widget stability fixture</h1><p>Scroll ordinary page controls past the floating support area.</p></div>
    <section class="test-row"><a id="test-link" class="test-action" href="#local-action">Local page link</a></section>
    <section class="test-row"><button id="test-button" class="test-action" type="button">Local page button</button></section>
    <section class="test-row"><input id="test-input" class="test-action" aria-label="Local page field" placeholder="Local page field"></section>
    <div class="test-tail"><p id="local-action" tabindex="-1">Clear scrolling area</p></div></main>${assets['site-shell/footer.html']}
    <script>window.__localClicks=0;for(const node of document.querySelectorAll('.test-action'))node.addEventListener('click',event=>{if(node.tagName==='A')event.preventDefault();window.__localClicks++});</script>
    <script src="canonical-site-shell.js"></script>${(order === 'assistant-first' ? ['assistant.js', 'connect-widget.js'] : ['connect-widget.js', 'assistant.js']).map(file => `<script src="${file}"></script>`).join('')}</body></html>`;

  for (const engineName of engines) {
    const browser = await ({ chromium, webkit }[engineName]).launch({ headless: true });
    try {
      for (const width of widths) for (const order of orders) {
        const label = `${engineName}/${width}/${order}`;
        const height = width === 430 ? 932 : width >= 768 ? 1024 : 844;
        const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768,
          reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const state = { label, baselineRef: baselineRef || null, frames: [], phases: [], errors: [], blockedRequests: [] };
        const beforeFailures = failures.length;
        console.log('START', label);
        page.on('pageerror', error => state.errors.push(error.message));
        await page.addInitScript(() => {
          const viewport = window.visualViewport;
          const original = Object.fromEntries(['height', 'width', 'offsetTop', 'offsetLeft'].map(key => [key, Object.getOwnPropertyDescriptor(Object.getPrototypeOf(viewport), key).get]));
          let override = null;
          for (const key of Object.keys(original)) Object.defineProperty(viewport, key, { configurable: true, get: () => override && key in override ? override[key] : original[key].call(viewport) });
          window.__setWidgetTestViewport = next => { override = next; viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll')); };
        });
        await page.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== 'http://127.0.0.1' || request.method() !== 'GET') {
            state.blockedRequests.push({ url: request.url(), method: request.method() });
            return route.abort();
          }
          const file = url.pathname.slice(1);
          if (file === 'index.html') return route.fulfill({ contentType: 'text/html', body: fixture(order) });
          if (file === 'public-search-index.json') return route.fulfill({ contentType: 'application/json', body: '[]' });
          if (Object.hasOwn(assets, file)) return route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml', body: assets[file] });
          // Font files requested by the real brand CSS are optional for geometry.
          return route.fulfill({ status: 404, body: '' });
        });
        const record = async phase => {
          await settle(page);
          const value = await snapshot(page);
          state.phases.push({ phase, ...value });
          assertAnchor(value, `${label}/${phase}`);
          return value;
        };
        const clear = async () => {
          await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
          await page.waitForTimeout(260);
          const value = await record('clear-top');
          check(allVisible(value), `${label}: launchers restore when the page is clear`);
        };
        try {
          await page.goto('http://127.0.0.1/index.html', { waitUntil: 'load' });
          await page.locator('#mnd-launcher').waitFor({ state: 'attached' });
          await page.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
          await clear();
          // Each 8px step spans two animation frames, exercising actual scroll
          // handlers and both directions rather than calling the controller.
          for (const selector of ['#test-link', '#test-button', '#test-input']) {
            const positions = await page.locator(selector).evaluate(node => ({ top: node.getBoundingClientRect().top + scrollY, height: node.getBoundingClientRect().height }));
            const low = Math.max(0, positions.top - height - 24);
            const high = positions.top + positions.height - height + 180;
            for (const direction of ['down', 'up']) {
              await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), direction === 'down' ? low : high);
              await page.waitForTimeout(220);
              const trace = await page.evaluate(async ({ low, high, direction, selector }) => {
                const frames = [];
                for (let offset = 0; offset <= high - low; offset += 8) {
                  scrollTo({ top: direction === 'down' ? low + offset : high - offset, behavior: 'instant' });
                  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                  const edge = innerWidth <= 480 ? 16 : 20, control = document.querySelector(selector).getBoundingClientRect();
                  const point = { x: innerWidth - edge - 20, y: Math.max(1, Math.min(innerHeight - 1, control.top + control.height / 2)) };
                  frames.push({ scrollY, width: innerWidth, height: innerHeight,
                    overlap: control.right > innerWidth - edge - 116 - 8 && control.left < innerWidth - edge + 8 && control.bottom > innerHeight - edge - 108 - 8 && control.top < innerHeight - edge + 8,
                    controlHit: Boolean(document.elementFromPoint(point.x, point.y)?.closest(selector)),
                    actions: [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => {
                      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
                      return { name: node.id === 'mnd-launcher' ? 'Chat' : 'Connect', visible: style.display !== 'none' && style.visibility === 'visible', display: style.display,
                        pointerEvents: style.pointerEvents, bottom: parseFloat(style.bottom), right: parseFloat(style.right),
                        box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, height: box.height, width: box.width } };
                    }) });
                }
                return frames;
              }, { low, high, direction, selector });
              state.frames.push({ selector, direction, trace });
              trace.forEach((frame, i) => {
                assertAnchor(frame, `${label}/${selector}/${direction}/${i}`);
                if (frame.overlap) check(allHidden(frame), `${label}/${selector}/${direction}/${i}: collision must hide the anchored stack`);
              });
              check(trace.some(frame => frame.overlap), `${label}/${selector}/${direction}: collision fixture was sampled`);
              const firstCollision = trace.findIndex(frame => frame.overlap);
              check(firstCollision >= 0 && trace.slice(firstCollision).every(allHidden), `${label}/${selector}/${direction}: launchers flicker back during ongoing scroll`);
            }
            // Click the portion of a real page control that the fixed stack
            // would cover; a hidden stack must let the event reach the page.
            await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), positions.top - height + 80);
            await settle(page);
            if (selector === '#test-link') await page.screenshot({ path: path.join(out, `${engineName}-${width}-${order}-page-control.png`) });
            const clicksBefore = await page.evaluate(() => window.__localClicks);
            const box = await page.locator(selector).boundingBox();
            await page.mouse.click(width - (width <= 480 ? 16 : 20) - 20, box.y + box.height / 2);
            check(await page.evaluate(() => window.__localClicks) === clicksBefore + 1, `${label}/${selector}: obstructed portion of page control stays clickable`);
            await page.evaluate(() => document.activeElement?.blur());
          }
          await clear();
          await page.screenshot({ path: path.join(out, `${engineName}-${width}-${order}-anchor.png`) });

          // Footer contact routes take over without pushing the support stack
          // up the screen. Returning to clear content restores the same anchor.
          const footerDocumentTop = await page.locator('.mond-footer').evaluate(node => node.getBoundingClientRect().top + scrollY);
          for (const footerOffset of [24, 8, -8, -80, -180]) {
            await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), footerDocumentTop - height - footerOffset);
            const value = await record(`footer-${footerOffset}`);
            if (footerOffset <= -8) check(allHidden(value), `${label}: footer suppresses support without relocation`);
          }
          await page.screenshot({ path: path.join(out, `${engineName}-${width}-${order}-footer.png`) });
          await clear();

          // Use the real navigation/search controls. Escape is particularly
          // useful here because it does not generate a document click event.
          if (width <= 1180) {
            await page.locator('.site-menu-button').click();
            check(allHidden(await record('menu-open')), `${label}: menu suppresses launchers`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(260);
            check(allVisible(await record('menu-escape')), `${label}: menu Escape restores launchers`);
            await page.locator('.site-menu-button').click();
          }
          await page.locator('.site-search-button').click();
          check(allHidden(await record('search-open')), `${label}: search suppresses launchers`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(260);
          if (width <= 1180) {
            check(allHidden(await record('search-escape-to-menu')), `${label}: search Escape keeps launchers suppressed while navigation remains open`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(260);
          }
          check(allVisible(await record('search-and-menu-closed')), `${label}: closing search and navigation restores launchers`);

          // Page editing suppresses both controls even when no page field is
          // geometrically in their corner.
          await page.locator('#test-input').evaluate(node => { node.focus({ preventScroll: true }); });
          check(allHidden(await record('page-field-focus')), `${label}: page input focus suppresses launchers`);
          await clear();

          // Mobile browser toolbar/visual-viewport changes do not reposition
          // closed launchers. Open panels still fit above a simulated keyboard.
          await page.evaluate(() => window.__setWidgetTestViewport({ height: innerHeight - 96, offsetTop: 24 }));
          await record('visual-viewport-closed');
          await page.evaluate(() => window.__setWidgetTestViewport(null));
          await clear();
          for (const widget of [
            { launch: '#mnd-launcher', panel: '#mnd-panel', input: '#mnd-input', close: '#mnd-close', kind: 'chat' },
            { launch: '.mdn-cn-launch', panel: '#mdn-cn-panel', input: '#mdncn-fullName', close: '.mdn-cn-close', kind: 'connect' },
          ]) {
            await page.locator(widget.launch).click();
            await page.locator(widget.input).focus();
            await page.evaluate(() => window.__setWidgetTestViewport({ height: 400, offsetTop: 24 }));
            await page.waitForTimeout(220);
            const openState = await record(`${widget.kind}-keyboard`);
            check(allHidden(openState), `${label}/${widget.kind}: open panel suppresses launchers`);
            const panel = await page.locator(widget.panel).boundingBox();
            check(panel.y >= 23 && panel.y + panel.height <= 425, `${label}/${widget.kind}: panel remains inside visual viewport above keyboard`);
            // Keep restore and close in one event turn: a delayed automation
            // click would miss focus loss while the obstruction hold expires.
            const immediateCloseFocus = await page.evaluate(({ close, launch }) => {
              window.__setWidgetTestViewport(null);
              document.querySelector(close).click();
              return document.activeElement === document.querySelector(launch);
            }, widget);
            check(immediateCloseFocus, `${label}/${widget.kind}: immediate close after viewport restore returns launcher focus`);
            await page.mouse.move(0, 0);
            await page.waitForTimeout(220);
            check(allVisible(await record(`${widget.kind}-closed`)), `${label}/${widget.kind}: close restores both launchers`);
            // A real short layout viewport can put ordinary page controls in
            // the anchored corner. On restore, closing immediately must not
            // lose focus to the 180ms scrolling suppression timer.
            await page.evaluate(() => {
              const intro = document.querySelector('.test-intro');
              intro.style.height = intro.getBoundingClientRect().height + 'px';
              document.activeElement?.blur();
              scrollTo({ top: document.querySelector('#test-input').getBoundingClientRect().top + scrollY - 360, behavior: 'instant' });
            });
            await page.waitForTimeout(260);
            check(allVisible(await record(`${widget.kind}-before-short-viewport`)), `${label}/${widget.kind}: short viewport fixture begins clear`);
            await page.locator(widget.launch).click();
            await page.setViewportSize({ width, height: 420 });
            await page.waitForTimeout(220);
            check(allHidden(await record(`${widget.kind}-short-layout-viewport`)), `${label}/${widget.kind}: short layout viewport suppresses launchers`);
            await page.setViewportSize({ width, height });
            await settle(page);
            const shortViewportCloseFocus = await page.evaluate(({ close, launch }) => {
              document.querySelector(close).click();
              return document.activeElement === document.querySelector(launch) && getComputedStyle(document.querySelector(launch)).visibility === 'visible';
            }, widget);
            check(shortViewportCloseFocus, `${label}/${widget.kind}: immediate close after layout viewport restore returns visible launcher focus`);
            await page.evaluate(() => { document.querySelector('.test-intro').style.height = ''; });
            await clear();
            await page.locator(widget.launch).click();
            await page.evaluate(() => scrollTo({ top: document.querySelector('.mond-footer').getBoundingClientRect().top + scrollY - innerHeight / 2, behavior: 'instant' }));
            await settle(page);
            await page.locator(widget.close).click();
            check(allHidden(await record(`${widget.kind}-closed-at-footer`)), `${label}/${widget.kind}: closing at footer leaves fixed launchers suppressed`);
            const returnedFocus = await page.evaluate(() => {
              const active = document.activeElement, box = active.getBoundingClientRect(), style = getComputedStyle(active);
              return { tag: active.tagName, id: active.id, visible: style.visibility === 'visible' && style.display !== 'none' && box.bottom > 0 && box.top < innerHeight,
                isPageControl: Boolean(active.matches('a[href],button') && !active.closest('#mnd-panel,#mdn-cn-panel')) };
            });
            check(returnedFocus.visible && returnedFocus.isPageControl, `${label}/${widget.kind}: footer close must restore focus to a visible page control (${JSON.stringify(returnedFocus)})`);
            await clear();
          }
          await page.setViewportSize({ width: width === 390 ? 430 : 390, height: 760 });
          await page.waitForTimeout(260);
          check(allVisible(await record('viewport-resize')), `${label}: resize restores correct fixed anchor`);
          await page.setViewportSize({ width, height });
          await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
          await page.waitForTimeout(260);
          await record('orientation-restored');
          state.idleStyleMutations = await page.evaluate(() => new Promise(resolve => {
            let count = 0;
            const observer = new MutationObserver(records => { count += records.length; });
            for (const node of document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
            setTimeout(() => { observer.disconnect(); resolve(count); }, 220);
          }));
          check(state.idleStyleMutations === 0, `${label}: settled controls keep polling or mutating styles`);
          check(state.errors.length === 0, `${label}: browser errors: ${state.errors.join('; ')}`);
          check(state.blockedRequests.length === 0, `${label}: unexpected attempted external/API requests`);
        } catch (error) {
          failures.push(`${label}: ${error.stack || error}`);
          await page.screenshot({ path: path.join(out, `${engineName}-${width}-${order}-failure.png`) }).catch(() => {});
        } finally {
          state.failures = failures.slice(beforeFailures);
          evidence.push(state);
          await fs.writeFile(path.join(out, 'mobile-widget-stability.json'), JSON.stringify({ status: failures.length ? 'FAIL' : 'RUNNING', baselineRef: baselineRef || null, failures, evidence }, null, 2));
          await page.close();
        }
        console.log(state.failures.length ? 'FAIL' : 'PASS', label, `${state.failures.length} findings`);
      }
    } finally { await browser.close(); }
  }
  const sampledFrames = evidence.reduce((total, item) => total + item.frames.reduce((count, group) => count + group.trace.length, 0), 0);
  const elapsedSeconds = Math.round((performance.now() - startedAt) / 100) / 10;
  await fs.writeFile(path.join(out, 'mobile-widget-stability.json'), JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', baselineRef: baselineRef || null, sampledFrames, elapsedSeconds, liveServiceCalls: 0, failures, evidence }, null, 2));
  assert.equal(failures.length, 0, `mobile widget stability: ${failures.length} failures. First findings:\n${failures.slice(0, 12).join('\n')}\nEvidence: ${path.join(out, 'mobile-widget-stability.json')}`);
  console.log(`mobile widget stability: ${sampledFrames} scroll frames across ${evidence.length} browser/viewport/load-order combinations in ${elapsedSeconds}s; no live service calls`);
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runMobileWidgetStabilitySmoke();
