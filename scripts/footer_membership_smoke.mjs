// Local built-footer check. All page scripts and external/service requests are blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium, webkit} from 'playwright';
import {sourceAtEvaluationPoolBaseline} from './single_lens_overview_20260929_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const built = path.resolve(process.env.SITE_SOURCE_DIR || path.join(root, '.render-public'));
const output = path.resolve(process.env.FOOTER_MEMBERSHIP_OUTPUT || 'output/acmp-footer');
const baseline = 'e9efd479cc4b19e9753aeb814fb30f280f8171a9';
const credential = 'https://www.credly.com/badges/36d80452-ae21-4208-b5c6-f1bcf45fb23a';
const badgePath = 'assets/brand/acmp-member-badge.png';
const badgeSha256 = '0967036e795e927c9ef1bdd3c68a6de1283608476bcbf3dac725c6be67425136';
const origin = 'http://acmp-footer.test';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const footerPattern = /<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/g;
const footer = (await fs.readFile(path.join(root, 'site-shell/footer.html'), 'utf8')).trim();
const pages = new Map();
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };

await fs.mkdir(output, {recursive:true});
for (const directory of [root, built]) eq(sha(await fs.readFile(path.join(directory, badgePath))), badgeSha256, 'Exact official badge bytes: ' + directory);
const officialPath = process.env.FOOTER_MEMBERSHIP_ORIGINAL || '/tmp/monderman-acmp-member-badge.png';
let originalChecked = false;
try {
  eq(sha(await fs.readFile(officialPath)), badgeSha256, 'Downloaded official original matches the independent image pin');
  originalChecked = true;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
eq(await fs.readFile(path.join(built, 'footer-membership.css'), 'utf8'), await fs.readFile(path.join(root, 'footer-membership.css'), 'utf8'), 'Build copies the exact membership stylesheet');
ok(footer.includes('href="footer-membership.css?v=20261001.1"'), 'The shared footer loads the versioned membership stylesheet');
eq((footer.match(/class="mf-membership"/g) || []).length, 1, 'One individual membership link in the shared footer');
ok(footer.includes('href="' + credential + '"'), 'Exact public individual credential');
ok(!/Jason|Adamson|mf-membership-label/i.test(footer), 'Badge-only footer contains no personal name or caption');
ok(footer.includes('src="' + badgePath + '" width="600" height="600"'), 'Original image dimensions and local asset path');

for (const file of (await fs.readdir(built)).filter(file => file.endsWith('.html')).sort()) {
  const html = await fs.readFile(path.join(built, file), 'utf8');
  const footers = [...html.matchAll(footerPattern)];
  if (!footers.length) continue;
  eq(footers.length, 1, file + ': exactly one shared footer');
  eq(footers[0][0], footer, file + ': exact current footer partial');
  pages.set(file, html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
}
eq(pages.size, 73, 'All public footer pages receive the membership');
const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline], {cwd:root, encoding:'utf8'}).trim().split('\n');
const protectedFiles = tracked.filter(file => (!file.includes('/') && /\.(?:js|css)$/.test(file))
  || /^(?:decision-velocity|structural-clarity|operational-systems|institutional-performance)\.html$/.test(file)
  || /^workspace(?:-[^/]+)?\.html$/.test(file) || file === 'scripts/inject-public-shell.mjs');
function assertProtectedSource(file, source) {
  // Restore only the separately pinned, finite admission-flow delta. Compare
  // every protected file with the same immutable footer-release baseline.
  // Unknown edits pass through the adapter and still fail exact equality.
  eq(Buffer.from(sourceAtEvaluationPoolBaseline(file, source)),
    execFileSync('git', ['show', baseline + ':' + file], {cwd:root, maxBuffer:32e6}),
    file + ': Existing shared scripts/styles, instruments, Workspace pages, and injector are unchanged outside the exact reviewed admission delta');
}
for (const file of protectedFiles) assertProtectedSource(file, await fs.readFile(path.join(root, file)));
for (const file of ['pilot-waitlist.js', 'scripts/inject-public-shell.mjs']) {
  const source = await fs.readFile(path.join(root, file));
  const changed = file === 'pilot-waitlist.js'
    ? Buffer.from(source.toString().replace('var submitted = false;', 'var submitted = true;'))
    : Buffer.from(source.toString().replace('20261006.pool1', 'unreviewed-cache'));
  ok(!source.equals(changed), file + ': negative control changes actual source');
  for (const mutant of [changed, Buffer.concat([source, Buffer.from('\n')])]) {
    assert.throws(() => assertProtectedSource(file, mutant), {name:'AssertionError'},
      file + ': unknown executable or appended changes cannot be inverted');
    checks++;
  }
}

const representatives = ['index.html', 'research.html', 'platform-services.html', 'decision-velocity.html', 'security.html'];
const results = [], failures = [], cache = new Map();
const contentTypes = {'.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2'};
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const contained = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
for (const [engineName, engine] of Object.entries({chromium, webkit})) {
  const browser = await engine.launch({headless:true});
  try {
    const queue = representatives.flatMap(file => [320, 390, 768, 1440].map(width => ({file, width})));
    if (process.env.FOOTER_MEMBERSHIP_ALL_PAGES === '1') for (const file of pages.keys()) {
      if (!representatives.includes(file)) queue.push({file, width:390});
    }
    await Promise.all(Array.from({length:4}, async () => {
      while (queue.length) {
        const {file, width} = queue.shift();
        const label = `${engineName}/${file}/${width}`;
        const page = await browser.newPage({viewport:{width, height:1024}, reducedMotion:'reduce', serviceWorkers:'block'});
        let blockedRequests = 0;
        const missingAssets = [];
        await page.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin || request.method() !== 'GET' || request.resourceType() === 'script') {
            blockedRequests++; return route.abort();
          }
          if (url.pathname === '/' + file) return route.fulfill({contentType:'text/html', body:pages.get(file)});
          const target = path.resolve(built, '.' + decodeURIComponent(url.pathname));
          if (!target.startsWith(built + path.sep)) { blockedRequests++; return route.abort(); }
          try {
            if (!cache.has(target)) cache.set(target, await fs.readFile(target));
            return route.fulfill({contentType:contentTypes[path.extname(target)] || 'application/octet-stream', body:cache.get(target)});
          } catch { missingAssets.push(url.pathname); return route.fulfill({status:404, body:'Missing local fixture asset'}); }
        });
        try {
          await page.goto(origin + '/' + file, {waitUntil:'load'});
          // The legacy instrument loader normally disappears through page JavaScript.
          await page.addStyleTag({content:'#pageLoader{display:none!important}'});
          await page.evaluate(() => document.fonts.ready);
          const link = page.locator('.mf-membership');
          await link.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => {
            const img = document.querySelector('.mf-membership img');
            return img?.complete && img.naturalWidth === 600 && img.naturalHeight === 600;
          });
          eq(await link.getAttribute('href'), credential, label + ': credential URL');
          eq((await link.textContent()).trim(), '', label + ': badge has no visible text caption');
          eq(await page.locator('.mf-membership-label').count(), 0, label + ': no membership caption');
          eq(await link.getAttribute('target'), '_blank', label + ': external credential opens separately');
          for (const token of ['noopener', 'noreferrer']) ok((await link.getAttribute('rel')).split(/\s+/).includes(token), label + ': external link ' + token);
          eq(await link.getAttribute('aria-label'), 'Verify ACMP membership on Credly (opens in a new tab)', label + ': accessible verification link');
          await page.locator('.mf-nav a').last().focus();
          // macOS WebKit uses Option+Tab to include links in keyboard traversal.
          await page.keyboard.press(engineName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
          ok(await link.evaluate(node => node === document.activeElement), label + ': reachable in normal keyboard order');
          try {
            await page.waitForFunction(() => {
              const node = document.querySelector('.mf-membership');
              if (!node || node !== document.activeElement || !node.matches(':focus-visible')) return false;
              const style = getComputedStyle(node);
              return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
            }, null, {timeout:5000, polling:'raf'});
          } catch {
            const focus = await link.evaluate(node => {
              const style = getComputedStyle(node);
              return {active:node === document.activeElement, focusVisible:node.matches(':focus-visible'),
                outline:style.outline, outlineWidth:style.outlineWidth, outlineStyle:style.outlineStyle,
                outlineOffset:style.outlineOffset, transitionProperty:style.transitionProperty, transitionDuration:style.transitionDuration,
                documentHasFocus:document.hasFocus(), visibilityState:document.visibilityState, readyState:document.readyState,
                membershipStylesheets:[...document.styleSheets].filter(sheet => sheet.href?.includes('footer-membership.css')).map(sheet => ({href:sheet.href, disabled:sheet.disabled}))};
            });
            throw new Error(label + ': visible keyboard focus did not settle within 5s: ' + JSON.stringify(focus));
          }
          ok(await link.evaluate(node => { const style = getComputedStyle(node); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2; }), label + ': visible keyboard focus');
          await link.click({trial:true});
          const geometry = await link.evaluate(node => {
            const box = el => { const r = el.getBoundingClientRect(); return {left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height}; };
            const image = node.querySelector('img'), imageStyle = getComputedStyle(image), linkBox = box(node);
            const hit = document.elementFromPoint(linkBox.left + linkBox.width / 2, linkBox.top + linkBox.height / 2);
            return {link:linkBox, image:box(image), footer:box(node.closest('footer')), bottom:box(node.closest('.mf-bottom')), motif:box(document.querySelector('.mf-motif')),
              naturalWidth:image.naturalWidth, naturalHeight:image.naturalHeight, filter:imageStyle.filter, opacity:imageStyle.opacity, objectFit:imageStyle.objectFit,
              hit:hit === node || node.contains(hit), scrollWidth:document.documentElement.scrollWidth};
          });
          ok(geometry.link.width >= 44 && geometry.link.height >= 44, label + ': touch target');
          ok(geometry.hit, label + ': badge target is unobstructed');
          for (const key of ['link', 'image']) ok(contained(geometry[key], geometry.footer), label + ': ' + key + ' stays in footer');
          ok(contained(geometry.image, geometry.link), label + ': image stays in link');
          ok(!overlaps(geometry.link, geometry.motif), label + ': badge and decorative motif do not overlap');
          ok(Math.abs(geometry.link.left - geometry.bottom.left) <= 1, label + ': badge is aligned at the bottom left');
          ok(Math.abs(geometry.image.width - geometry.image.height) <= 1 && geometry.image.width >= 44 && geometry.image.width <= 120, label + ': compact square image');
          eq(geometry.filter, 'none', label + ': unfiltered original artwork');
          eq(geometry.opacity, '1', label + ': artwork is fully opaque');
          eq(geometry.objectFit, 'contain', label + ': entire image remains visible');
          ok(geometry.link.left >= 0 && geometry.link.right <= width + 1, label + ': badge fits the viewport');
          ok(!missingAssets.includes('/' + badgePath) && !missingAssets.includes('/footer-membership.css'), label + ': badge asset and stylesheet load');
          if (representatives.includes(file)) await page.locator('.mond-footer').screenshot({path:path.join(output, `${engineName}-${file}-${width}.png`)});
          results.push({label, passed:true, blockedRequests, missingAssets, geometry});
        } catch (error) {
          failures.push({label, error:error.message});
          await page.screenshot({path:path.join(output, `${engineName}-${file}-${width}-FAIL.png`)}).catch(() => {});
        } finally { await page.close(); }
      }
    }));
  } finally { await browser.close(); }
}
const receipt = {status:failures.length ? 'FAIL' : 'PASS', checks, footerPages:pages.size, browserCases:results.length, baseline, protectedFiles:protectedFiles.length,
  badgeSha256, originalChecked, failures, results, providerCalls:0, published:false};
await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({status:receipt.status, checks, footerPages:pages.size, browserCases:results.length, failures, output}));
assert.equal(failures.length, 0, 'Individual membership footer regression checks');
