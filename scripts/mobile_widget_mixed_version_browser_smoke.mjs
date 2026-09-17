// Deployment-cache compatibility: either independently cached widget can own
// the shared controller. All content is local; no service/API is contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

export async function runMobileWidgetMixedVersionSmoke({
  root = process.cwd(),
  out = process.env.MOBILE_WIDGET_MIXED_OUT || '/tmp/monderman-mobile-widget-stability/mixed-version',
  baselineRef = process.env.MOBILE_WIDGET_MIXED_BASELINE_REF || '6b55414252d4c56bf1dd57bf7ce8e93c17c91810',
  latestRef = process.env.MOBILE_WIDGET_MIXED_LATEST_REF || '',
} = {}) {
  const startedAt = performance.now();
  root = path.resolve(root);
  await fs.mkdir(out, { recursive: true });
  const sourceFiles = ['assistant.js', 'connect-widget.js'];
  const latest = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, latestRef
    ? execFileSync('git', ['show', `${latestRef}:${file}`], { cwd: root, encoding: 'utf8' })
    : await fs.readFile(path.join(root, file), 'utf8')])));
  const baseline = Object.fromEntries(sourceFiles.map(file => [file, execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root, encoding: 'utf8' })]));
  const css = await fs.readFile(path.join(root, 'canonical-site-shell.css'), 'utf8');
  const failures = [], evidence = [];
  for (const [engineName, engineType] of Object.entries({ chromium, webkit })) {
    const browser = await engineType.launch({ headless: true });
    try {
      for (const oldWidget of sourceFiles) for (const order of ['assistant-first', 'connect-first']) {
        const label = `${engineName}/${oldWidget}-baseline/${order}`;
        const sources = Object.fromEntries(sourceFiles.map(file => [file, file === oldWidget ? baseline[file] : latest[file]]));
        const orderedFiles = order === 'assistant-first' ? sourceFiles : [...sourceFiles].reverse();
        const entry = { label, controllerOwner: orderedFiles[0] === oldWidget ? 'baseline' : 'latest', checks: [], errors: [], blockedRequests: [] };
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
        page.setDefaultTimeout(5000);
        page.on('pageerror', error => entry.errors.push(error.message));
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
          <link rel="stylesheet" href="canonical-site-shell.css"><style>*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif}main{height:2600px;padding:100px 20px}.mond-footer{height:500px}</style></head>
          <body class="canonical-green-shell"><main><h1>Local mixed-version widget fixture</h1><p>Clear page area for cache compatibility checks.</p></main><footer class="mond-footer"></footer>
          ${orderedFiles.map(file => `<script src="${file}"></script>`).join('')}</body></html>`;
        await page.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== 'http://127.0.0.1' || request.method() !== 'GET') {
            entry.blockedRequests.push({ url: request.url(), method: request.method() });
            return route.abort();
          }
          const file = url.pathname.slice(1);
          if (file === 'index.html') return route.fulfill({ contentType: 'text/html', body: html });
          if (file === 'canonical-site-shell.css') return route.fulfill({ contentType: 'text/css', body: css });
          if (Object.hasOwn(sources, file)) return route.fulfill({ contentType: 'application/javascript', body: sources[file] });
          return route.fulfill({ status: 404, body: '' });
        });
        try {
          await page.goto('http://127.0.0.1/index.html', { waitUntil: 'load' });
          await page.locator('#mnd-launcher').waitFor({ state: 'visible' });
          await page.locator('.mdn-cn-launch').waitFor({ state: 'visible' });
          for (const widget of [
            { name: 'Chat', launch: '#mnd-launcher', panel: '#mnd-panel', input: '#mnd-input', close: '#mnd-close' },
            { name: 'Connect', launch: '.mdn-cn-launch', panel: '#mdn-cn-panel', input: '#mdncn-fullName', close: '.mdn-cn-close' },
          ]) {
            await page.locator(widget.launch).click();
            const opened = await page.evaluate(({ panel, input }) => {
              const node = document.querySelector(panel), style = getComputedStyle(node);
              return { activeInput: document.activeElement === document.querySelector(input), visible: style.display !== 'none' && style.visibility === 'visible',
                open: node.classList.contains('mnd-open') || node.classList.contains('mdn-cn-open') };
            }, widget);
            assert.ok(opened.activeInput && opened.visible && opened.open, `${label}/${widget.name}: panel opens with input focus`);
            await page.locator(widget.close).click();
            const closed = await page.evaluate(({ launch, panel }) => {
              const target = document.querySelector(launch), active = document.activeElement, targetStyle = getComputedStyle(target);
              const rect = active.getBoundingClientRect(), activeStyle = getComputedStyle(active);
              return { focusReturned: active === target, activeId: active.id, activeClass: active.className,
                focusVisible: activeStyle.visibility === 'visible' && activeStyle.display !== 'none' && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight,
                targetVisible: targetStyle.visibility === 'visible' && targetStyle.display !== 'none',
                panelClosed: !document.querySelector(panel).classList.contains('mnd-open') && !document.querySelector(panel).classList.contains('mdn-cn-open'),
                bothLaunchersVisible: [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => getComputedStyle(node).visibility === 'visible' && getComputedStyle(node).display !== 'none') };
            }, widget);
            entry.checks.push({ widget: widget.name, opened, closed });
            assert.ok(closed.focusReturned && closed.focusVisible && closed.targetVisible && closed.panelClosed && closed.bothLaunchersVisible,
              `${label}/${widget.name}: close restores a visible launcher and focus (${JSON.stringify(closed)})`);
            await page.mouse.move(0, 0);
          }
          assert.deepEqual(entry.errors, [], `${label}: browser errors`);
          assert.deepEqual(entry.blockedRequests, [], `${label}: unexpected external/API request`);
          console.log('PASS', label);
        } catch (error) {
          entry.failure = String(error.stack || error);
          failures.push(`${label}: ${error.message.split('\n')[0]}`);
          await page.screenshot({ path: path.join(out, `${engineName}-${oldWidget}-${order}-failure.png`) }).catch(() => {});
          console.error('FAIL', label, error.message.split('\n')[0]);
        } finally {
          evidence.push(entry);
          await page.close();
        }
      }
    } finally { await browser.close(); }
  }
  const elapsedSeconds = Math.round((performance.now() - startedAt) / 100) / 10;
  await fs.writeFile(path.join(out, 'mobile-widget-mixed-version.json'), JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', baselineRef, latestRef: latestRef || null, elapsedSeconds, liveServiceCalls: 0, failures, evidence }, null, 2));
  assert.equal(failures.length, 0, `mixed-version widget failures: ${failures.join('\n')}`);
  console.log(`mobile widget mixed-version compatibility: ${evidence.length} combinations, ${evidence.reduce((sum, entry) => sum + entry.checks.length, 0)} panel open/close cycles in ${elapsedSeconds}s; no live service calls`);
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runMobileWidgetMixedVersionSmoke();
