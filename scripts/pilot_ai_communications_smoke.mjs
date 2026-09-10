// Read-only source checks and isolated, no-script layout renders of pilot AI copy.
// No authentication, production requests, email delivery, or model calls occur.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const baseRef = process.env.PILOT_COPY_BASE_REF || 'ffdc81ae868475cb0e933d87f374f4c0c199fe11';
const files = ['pilot.html', 'pattern-trial.html', 'security.html', 'privacy.html', 'subprocessors.html'];
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'))].map(match => match[0]);
const controls = html => [...html.matchAll(/<(?:form|input|textarea|select|option|button)\b[^>]*>/gi)].map(match => match[0]);

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const previous = execFileSync('git', ['show', `${baseRef}:${file}`], { cwd: root, encoding: 'utf8' });
  const text = textOf(html);
  assert.match(text, /currently enabled for eligible Diagnostic and Synthesis reports/, `${file}: current availability missing`);
  assert.match(text, /Optional written observations are not currently included in AI interpretation\./, `${file}: current observations setting missing`);
  assert.match(text, /Anthropic/, `${file}: outside provider unnamed`);
  assert.deepEqual(blocks(html, 'script'), blocks(previous, 'script'), `${file}: scripts changed`);
  assert.deepEqual(blocks(html, 'style'), blocks(previous, 'style'), `${file}: styles changed`);
  assert.deepEqual(controls(html), controls(previous), `${file}: form controls changed`);
  for (const script of blocks(html, 'script')) {
    if (/\bsrc\s*=|application\/ld\+json/.test(script.split('>')[0])) continue;
    const source = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    if (/type=["']module["']/.test(script.split('>')[0])) {
      execFileSync(process.execPath, ['--check', '--input-type=module'], { input: source });
    } else {
      new vm.Script(source, { filename: file });
    }
  }
  if (['pilot.html', 'pattern-trial.html'].includes(file)) {
    assert.match(text, /Monderman's code calculates scores; Anthropic's Claude selects, prioritizes and reviews suitable explanations and actions from approved material\./);
    assert.match(text, /It cannot change scores or freely write recommendations\./);
    assert.match(text, /Customer content is not used for model training\./);
    assert.match(text, /not zero retention/);
    assert.match(text, /reopen/i);
    assert.match(text, /(?:without asking participants to answer again|Participants do not need to answer again)/);
    assert.match(text, /Older reports are not automatically regenerated or replaced\./);
    assert.match(html, /href="privacy\.html"/);
  }
}
console.log('PILOT_AI_COPY_STATIC_PASS_5_PAGES_SCRIPTS_STYLES_CONTROLS_UNCHANGED');
if (process.argv.includes('--static-only')) process.exit(0);

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const publicRoot = path.resolve(process.env.PILOT_COPY_PUBLIC_ROOT || path.join(root, '.render-public'));
const out = path.resolve(process.env.PILOT_COPY_OUT || path.join(root, 'output/pilot-ai-communications'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer((request, response) => {
  const file = path.resolve(publicRoot, '.' + new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
  response.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const rows = [];
try {
  for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const width of [390, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled: false, reducedMotion: 'reduce' });
        await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        try {
          for (const file of files) {
            const page = await context.newPage();
            const response = await page.goto(`${base}/${file}`, { waitUntil: 'load' });
            assert.equal(response.status(), 200, `${file}: local build missing`);
            await page.evaluate(() => document.fonts.ready);
            const current = page.locator('p').filter({ hasText: 'currently enabled for eligible Diagnostic and Synthesis reports' }).first();
            await current.waitFor({ state: 'visible' });
            const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
            assert.ok(geometry.scrollWidth <= width + 1, `${browserName}/${width}/${file}: document overflow ${geometry.scrollWidth}`);
            const paragraphBox = await current.boundingBox();
            assert.ok(paragraphBox.x >= 0 && paragraphBox.x + paragraphBox.width <= width + 1, `${file}: disclosure falls outside viewport`);
            const panel = file === 'pattern-trial.html' ? page.locator('#pilotAIReporting')
              : file === 'pilot.html' ? page.locator('.section-copy').filter({ has: current })
                : file === 'subprocessors.html' ? current
                  : page.locator('.section-inner').filter({ has: current });
            const screenshot = `${browserName}-${width}-${file.replace('.html', '')}.png`;
            await panel.screenshot({ path: path.join(out, screenshot) });
            rows.push({ browser: browserName, width, page: file, geometry, screenshot, mode: 'isolated no-script layout; not authentication or live API testing' });
            await page.close();
          }
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceBase: baseRef, rows }, null, 2));
console.log(`PILOT_AI_COPY_LAYOUT_PASS_${rows.length}_RENDERS: ${out}`);
