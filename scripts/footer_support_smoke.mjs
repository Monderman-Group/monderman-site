// Presentation-only fixtures: actual published HTML/CSS and support scripts.
// All external requests are blocked; no sign-in, customer or model calls occur.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const root = path.resolve(process.env.SITE_SOURCE_DIR || '.render-public');
const output = path.resolve(process.env.FOOTER_TEST_OUTPUT || 'output/footer-support');
await fs.mkdir(output, { recursive: true });
const htmlFiles = (await fs.readdir(root)).filter(name => name.endsWith('.html'));
const pages = [];
for (const file of htmlFiles) {
  const html = await fs.readFile(path.join(root, file), 'utf8');
  if (!/<footer\b[^>]*\bmond-footer\b/.test(html)) continue;
  const shell = /<body\b[^>]*\bcanonical-green-shell\b/.test(html);
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const scripts = shell ? '<script src="/assistant.js"></script><script src="/connect-widget.js"></script><script src="/canonical-site-shell.js"></script><script src="/first-run-telemetry.js"></script>' : '';
  pages.push({ file, shell, html: stripped.replace('</body>', scripts + '</body>') });
}
assert.equal(pages.length, 65, 'Every existing published footer is covered');
assert.equal(pages.filter(page => page.shell).length, 61, 'All public support pages are covered');
const security = await fs.readFile(path.join(root, 'security.html'), 'utf8');
assert.ok(security.includes('id="administrative-device-protection"'), 'Device-protection anchor exists');
assert.ok(security.includes('are not covered by this device subscription'), 'Coverage is limited to administrative devices');
const expectedText = 'Administrative device protection: CrowdStrike Falcon';
const results = [];
const failures = [];
const shots = new Set(['index.html', 'research.html', 'platform-services.html', 'security.html', 'decision-velocity.html']);
const screenshotsOnly = process.env.FOOTER_SCREENSHOTS_ONLY === '1';
for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const tasks = pages.filter(page => !screenshotsOnly || shots.has(page.file)).flatMap(page => [390, 768, 1440].map(width => ({ ...page, width })));
    tasks.push({ ...pages.find(page => page.file === 'index.html'), width: 320 });
    const queue = [...tasks];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const item = queue.shift();
        const { file, shell, width, html } = item;
        const label = `${engineName}/${file}/${width}`;
        const page = await browser.newPage({ viewport: { width, height: 1024 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let liveCalls = 0;
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname !== '127.0.0.1') { liveCalls += 1; return route.abort(); }
          if (url.pathname === '/' + file) return route.fulfill({ contentType: 'text/html', body: html });
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          if (!target.startsWith(root + path.sep)) return route.abort();
          try {
            const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
            return route.fulfill({ contentType: types[path.extname(target)] || 'application/octet-stream', body: await fs.readFile(target) });
          } catch { return route.fulfill({ status: 404, body: 'Missing fixture asset' }); }
        });
        try {
          await page.goto(`http://127.0.0.1/${file}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          assert.deepEqual(errors, [], `${label}: no support-script errors`);
          assert.equal(await page.locator('.mf-device-protection').innerText(), expectedText);
          assert.equal(await page.locator('.mf-device-protection a').getAttribute('href'), 'security.html#administrative-device-protection');
          assert.equal(await page.locator('#siteHeader .site-widget-action').count(), 0);
          assert.equal(await page.locator('.site-support').count(), shell ? 1 : 0);
          if (shell) {
            assert.equal(await page.getByRole('button', { name: 'Connect with Monderman', exact: true }).count(), 1);
            assert.equal(await page.getByRole('button', { name: 'Chat with Monderman', exact: true }).count(), 1);
            await page.locator('.site-support').scrollIntoViewIfNeeded();
            const geometry = await page.evaluate(() => {
              const support = document.querySelector('.site-support');
              const footer = document.querySelector('.mond-footer');
              const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
              return {
                adjacent: support.nextElementSibling === footer,
                support: box(support), footer: box(footer),
                buttons: [...support.querySelectorAll('button')].map(button => ({ ...box(button), text: button.innerText, position: getComputedStyle(button).position })),
              };
            });
            assert.ok(geometry.adjacent, `${label}: support is immediately before footer`);
            assert.ok(Math.abs(geometry.support.bottom - geometry.footer.top) <= 1, `${label}: no gap or overlap at footer boundary`);
            assert.deepEqual(geometry.buttons.map(button => button.text), ['Connect', 'Chat with Monderman']);
            for (const button of geometry.buttons) {
              assert.ok(button.height >= 48 && button.left >= -1 && button.right <= width + 1, `${label}: 48px controls fit`);
              assert.notEqual(button.position, 'fixed');
            }
            const [a, b] = geometry.buttons;
            assert.ok(a.right + 10 <= b.left || a.bottom + 10 <= b.top, `${label}: controls do not overlap`);
            if (file === 'index.html') {
              const assistant = page.locator('[data-site-widget-action="assistant"]');
              const contact = page.locator('[data-site-widget-action="contact"]');
              await assistant.focus();
              await page.keyboard.press('Enter');
              await page.locator('#mnd-panel.mnd-open').waitFor({ state: 'visible' });
              assert.ok(await page.locator('#mnd-input').evaluate(el => el === document.activeElement));
              await page.locator('#mnd-close').click();
              assert.ok(await assistant.evaluate(el => el === document.activeElement));
              await contact.click();
              await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
              await page.locator('.mdn-cn-close').click();
              assert.ok(await contact.evaluate(el => el === document.activeElement));
            }
          }
          await page.locator('.mond-footer').scrollIntoViewIfNeeded();
          const footerGeometry = await page.locator('.mond-footer').evaluate(footer => {
            const rect = footer.getBoundingClientRect();
            const claim = footer.querySelector('.mf-device-protection').getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width, claimLeft: claim.left, claimRight: claim.right, claimBottom: claim.bottom, bottom: rect.bottom };
          });
          assert.ok(footerGeometry.left >= -1 && footerGeometry.right <= width + 1, `${label}: footer containment`);
          assert.ok(footerGeometry.claimLeft >= 0 && footerGeometry.claimRight <= width && footerGeometry.claimBottom <= footerGeometry.bottom, `${label}: claim containment`);
          if (shots.has(file)) {
            // Component captures omit unrelated fixed chrome. Instrument boot
            // scripts are intentionally absent in these footer-only fixtures;
            // removing that loading overlay is not an instrument-runtime test.
            await page.addStyleTag({ content: '#siteHeader,.skip-link,#pageLoader{display:none!important}' });
            const clip = await page.evaluate(() => {
              const start = document.querySelector('.site-support') || document.querySelector('.mond-footer');
              const top = start.getBoundingClientRect().top + scrollY;
              const end = document.querySelector('.mond-footer').getBoundingClientRect().bottom + scrollY;
              return { x: 0, y: top, width: innerWidth, height: end - top };
            });
            await page.screenshot({ path: path.join(output, `${engineName}-${file}-${width}.png`), fullPage: true, clip });
          }
          await page.emulateMedia({ media: 'print' });
          if (shell) assert.equal(await page.locator('.site-support').evaluate(el => getComputedStyle(el).display), 'none', `${label}: support excluded from print`);
          results.push({ label, passed: true, blockedExternalRequests: liveCalls, footerGeometry });
        } catch (error) {
          failures.push({ label, error: error.message });
        } finally { await page.close(); }
      }
    }));
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(output, screenshotsOnly ? 'component-capture-results.json' : 'results.json'), JSON.stringify({ passed: failures.length === 0, liveCalls: 0, pages: pages.length, checks: results.length, failures, results }, null, 2));
console.log(JSON.stringify({ passed: failures.length === 0, cases: results.length, failures }));
assert.equal(failures.length, 0, 'Footer and support regression checks');
