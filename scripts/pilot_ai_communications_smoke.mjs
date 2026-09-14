// Read-only source checks and isolated, no-script layout renders of pilot AI copy.
// No authentication, production requests, email delivery, or model calls occur.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Current reviewed static baseline. This pin covers behavior and presentation,
// not the edition a production account has acknowledged or any live activation.
const baseRef = '725f3651dcde61927c4b1c1314a996c3830f760a';
const files = ['pilot.html', 'pattern-trial.html', 'security.html', 'subprocessors.html'];
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const blocks = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'))].map(match => match[0]);
const focusPlaceholders = new Set([
  'For example, capital approvals in one operating unit or the handoff between sales and delivery.',
  'For example, unclear responsibilities between teams, delayed approvals, or repeated reporting work.'
]);
const controls = html => [...html.matchAll(/<(?:form|input|textarea|select|option|button)\b[^>]*>/gi)].map(match => {
  const tag = match[0];
  if (!/^<textarea\b[^>]*\bid="decisionFocus"/.test(tag)) return tag;
  const placeholder = tag.match(/\bplaceholder="([^"]*)"/);
  assert.ok(placeholder && focusPlaceholders.has(placeholder[1]), 'Only the reviewed pilot-scope placeholder copy may differ');
  // Placeholder copy is not the form contract; every other attribute remains
  // byte-compared, including its name, id, required state and length limits.
  return tag.replace(/\bplaceholder="[^"]*"/, 'placeholder="REVIEWED_SCOPE_EXAMPLE"');
});
// Reuse the current edition's exact alias/manifest/content/file hash guards,
// immutable September 11 archive pin, unchanged Terms/acceptance-copy pins,
// no-training/retention boundaries and fresh, default-unchecked v2 choice tests.
await import('./ai_source_privacy_notice_smoke.mjs');
const sharedCopy = [
  'AI-assisted interpretation is currently enabled for eligible Diagnostic and Synthesis reports',
  'Anthropic', 'Synthesis of your own saved runs', 'September 12 notice', 'request-size checks',
];
const pilotCopy = [
  "Monderman's diagnostic engine produces the scores, classifications, evidence limits and available action options.",
  'Claude supports research and writes the explanation from authorized evidence within those rules.',
  'Automated checks and a separate AI review screen the interpretation before release; they do not establish scientific validity or guarantee an outcome.',
  'selected original answers and their questions',
  'Campaign Synthesis can include answer distributions grouped by exact question and context, with small or insufficiently supported groups withheld.',
  "Optional observations require the participant's new per-run permission under the September 12 notice; earlier permission does not authorize this expanded use.",
  'Request-size checks can send the same permitted evidence before an interpretation is generated.',
  'Customer content is not used for model training or shared sector research.',
  'Outside processing is not zero retention.',
  'sponsors can reopen saved reports in the Workspace later without asking participants to answer again',
  'Older reports are not automatically regenerated or replaced.',
];
const requiredCopy = {
  'pilot.html': pilotCopy,
  'pattern-trial.html': pilotCopy,
  'security.html': [
    "Monderman's diagnostic engine produces the scores, classifications, evidence limits and available action options.",
    'Claude supports research and writes the explanation from authorized evidence within those rules.',
    'they do not establish scientific validity or guarantee an outcome',
    "selected original structured answers and their exact questions, with each run's Diagnostic, perspective, run length and questionnaire version",
    "Campaign Synthesis can include descriptive answer distributions for each exact question and context, not named participants' individual answer records.",
    'Small or insufficiently supported groups are withheld.',
    'new per-run permission under the September 12 notice; an earlier permission does not authorize this expanded use',
    'The same permitted evidence and proposed report text may be sent for request-size checks before drafting or review, even if no interpretation is generated.',
    'A separate public-research process uses only predefined sector and Diagnostic categories, not customer answers, organization names or Workspace history.',
    'Monderman does not use Customer responses, observations, reports, chat messages or organization history for model training, fine-tuning, provider feedback, shared benchmarks or cross-customer research, including in aggregated or de-identified form.',
    'within 30 days', 'This is not a zero-retention arrangement.',
  ],
  'subprocessors.html': [
    "Research support, authored explanations and review within Monderman's engine-defined evidence and action limits.",
    'Anthropic does not calculate scores.',
    'Public research uses predefined sector and Diagnostic categories without customer content.',
    "selected original structured answers and exact questions with each run's Diagnostic, perspective, run length and questionnaire version",
    "descriptive answer distributions grouped by exact question and context, not named participants' individual answer records, with small or insufficiently supported groups withheld",
    "with the participant's recorded permission under the September 12 notice for those saved observations",
    'Earlier permission does not authorize this expanded use.',
    'The same permitted evidence and proposed report text may be sent for request-size checks before drafting or review, even if no interpretation is generated.',
    'Customer content is not submitted for model training, fine-tuning or provider feedback.',
    'Standard API retention is not zero;',
  ],
};
const checkCopy = (text, file) => {
  for (const phrase of [...sharedCopy, ...requiredCopy[file]]) assert.ok(text.toLowerCase().includes(phrase.toLowerCase()), `${file}: ${phrase}`);
  assert.doesNotMatch(text, /Optional written observations are not currently included in AI interpretation\.|It cannot change scores or freely write recommendations\.|Claude selects, prioritizes and reviews suitable explanations and actions from approved material\./, `${file}: obsolete selector-only or blanket note-exclusion claim`);
};
let copyNegativeChecks = 0;

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const previous = execFileSync('git', ['show', `${baseRef}:${file}`], { cwd: root, encoding: 'utf8' });
  const text = textOf(html);
  checkCopy(text, file);
  for (const phrase of requiredCopy[file]) {
    assert.throws(() => checkCopy(text.toLowerCase().replaceAll(phrase.toLowerCase(), '[removed required disclosure]'), file), undefined, `${file}: removed disclosure must fail: ${phrase}`);
    copyNegativeChecks++;
  }
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
    assert.match(html, /href="privacy\.html"/);
  }
}
console.log(`PILOT_AI_COPY_STATIC_PASS_4_PAGES_${copyNegativeChecks}_NEGATIVES: scripts/styles/form schema match ${baseRef}; v1 archive immutable; current v2 source/manifest and processing copy verified, not live activation.`);
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
            checkCopy((await page.locator('body').innerText()).replace(/\s+/g, ' ').trim(), file);
            const current = page.locator('p').filter({ hasText: 'currently enabled for eligible Diagnostic and Synthesis reports' }).first();
            await current.waitFor({ state: 'visible' });
            const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
            assert.ok(geometry.scrollWidth <= width + 1, `${browserName}/${width}/${file}: document overflow ${geometry.scrollWidth}`);
            const paragraphBox = await current.boundingBox();
            assert.ok(paragraphBox.x >= 0 && paragraphBox.x + paragraphBox.width <= width + 1, `${file}: disclosure falls outside viewport`);
            const panel = file === 'pattern-trial.html' ? page.locator('#pilotAIReporting')
              : file === 'pilot.html' ? page.locator('.section-copy').filter({ has: current })
                : file === 'subprocessors.html' ? page.locator('.group').filter({ has: page.locator('tr').filter({ hasText: 'Research support, authored explanations and review' }) })
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
assert.equal(rows.length, files.length * 3 * 2, 'All four pages must render at every width in both browsers');
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceBase: baseRef, privacyVersion: '2026-09-12-ai-source-evidence-v2', rows, productionRequests: 0, providerCalls: 0, acceptancesCreated: 0 }, null, 2));
console.log(`PILOT_AI_COPY_LAYOUT_PASS_${rows.length}_RENDERS: ${out}`);
