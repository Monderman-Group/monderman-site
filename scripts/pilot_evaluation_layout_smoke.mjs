// Isolated presentation checks of built pilot guidance, not a live pilot test.
// JavaScript on the pages is disabled; only local built files may be served.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const built = path.join(root, '.render-public');
const out = path.join(root, 'output/pilot-evaluation-guide');
const base = 'http://127.0.0.1:4193';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
fs.mkdirSync(out, { recursive: true });
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const equal = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const rows = [], blocked = [], unexpected = [];

for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      for (const textScale of [1, 2]) {
        const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width, height: width < 500 ? 844 : 1000 } });
        await context.route('**/*', route => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin !== base || req.method() !== 'GET') {
            blocked.push({ origin: url.origin, method: req.method() });
            return route.abort();
          }
          const file = path.resolve(built, '.' + url.pathname);
          if (!file.startsWith(built + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            unexpected.push(url.pathname);
            return route.fulfill({ status: 404, body: '' });
          }
          return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        });
        try {
          for (const file of ['pilot.html', 'pattern-trial.html']) {
            const label = `${engine}/${width}/${textScale}/${file}`;
            const page = await context.newPage();
            equal((await page.goto(`${base}/${file}`, { waitUntil: 'load' })).status(), 200, `${label}: built page`);
            await page.evaluate(() => document.fonts.ready);
            const selector = file === 'pilot.html' ? '#evaluation-plan' : '#pilotEvaluationPlan';
            if (textScale === 2) await page.locator(selector).evaluate(panel => {
              const sizes = [panel, ...panel.querySelectorAll('*')].map(el => {
                const css = getComputedStyle(el);
                return { el, font: parseFloat(css.fontSize), line: parseFloat(css.lineHeight) };
              });
              for (const { el, font, line } of sizes) {
                el.style.fontSize = `${font * 2}px`;
                if (Number.isFinite(line)) el.style.lineHeight = `${line * 2}px`;
              }
            });
            equal(await page.locator('h1').count(), 1, `${label}: one page heading`);
            const geometry = await page.locator(selector).evaluate(panel => {
              const descendants = [...panel.querySelectorAll('h2,h3,p,li,a')];
              return {
                viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
                boxes: descendants.map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, x: r.x, right: r.right, width: r.width, height: r.height, text: el.textContent.slice(0, 55) }; }),
                font: getComputedStyle(panel.querySelector('p')).fontFamily,
              };
            });
            ok(geometry.documentWidth <= width + 1, `${label}: no document overflow`);
            ok(geometry.font.includes('Neue Haas Grotesk'), `${label}: existing type family retained`);
            for (const b of geometry.boxes) ok(b.x >= 0 && b.right <= width + 1 && b.width > 0 && b.height > 0, `${label}: contained ${b.tag} ${b.text}`);
            if (file === 'pilot.html') {
              equal(await page.locator('#evaluation-plan .section-copy > ol > li').count(), 5, `${label}: five ordered steps`);
              equal(await page.locator('#evaluation-plan h3').count(), 5, `${label}: five step headings`);
              equal(await page.locator('#evaluation-plan ul > li').count(), 4, `${label}: all four diagnostic roles`);
              await page.locator('a[href="#evaluation-plan"]').first().click();
              equal(new URL(page.url()).hash, '#evaluation-plan', `${label}: in-page guide link`);
              const heading = await page.locator('#evaluation-plan-title').boundingBox();
              const header = await page.locator('header').first().boundingBox();
              ok(heading.y >= (header?.y + header?.height || 0) - 1, `${label}: anchor heading not behind header`);
              await page.locator('#evaluation-plan').screenshot({ path: path.join(out, `${engine}-${width}-${textScale}-guide.png`) });
              for (const target of ['#apply', '#pilotWaitlistForm']) equal(await page.locator(target).count(), 1, `${label}: application target retained`);
            } else {
              const link = page.locator('#pilotEvaluationPlan a');
              equal(await link.getAttribute('href'), 'pilot.html#evaluation-plan', `${label}: correct guide destination`);
              equal(await link.getAttribute('target'), '_blank', `${label}: activation remains open`);
              ok((await link.getAttribute('rel')).split(/\s+/).includes('noopener'), `${label}: safe new-tab link`);
              equal(await page.locator('#ackStart:disabled').count(), 1, `${label}: no implicit acceptance`);
              equal(await page.locator('#startBtn:disabled').count(), 1, `${label}: no activation`);
              await page.locator('#pilotEvaluationPlan').screenshot({ path: path.join(out, `${engine}-${width}-${textScale}-activation.png`) });
            }
            if (textScale === 1) await page.screenshot({ path: path.join(out, `${engine}-${width}-${file.replace('.html','')}-context.png`), fullPage: true });
            rows.push({ engine, width, textScale, file, geometry });
            await page.close();
          }
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
}
equal(blocked, [], 'no attempted external requests or submissions');
equal(unexpected, [], 'all requested local assets exist');
const sha = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ passed: true, checks, rows, blocked, unexpected, sourcePins: Object.fromEntries(['pilot.html','pattern-trial.html','scripts/first_run_entry_smoke.mjs','scripts/pilot_evaluation_layout_smoke.mjs'].map(f => [f,sha(f)])), scope: '24 isolated built-page renders; no page JavaScript, auth, real applications, emails or model calls' }, null, 2));
console.log(`PILOT_EVALUATION_LAYOUT_PASS ${checks} assertions; ${rows.length} renders; ${out}`);
