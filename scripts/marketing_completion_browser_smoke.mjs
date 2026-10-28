import {historicalScopeBetaBrowserBodiesAtRelease as historicalScopeBetaBrowserBodies,isCurrentHomepageRefinementSourceAtRelease as isCurrentHomepageRefinementSource,sourceAtHomepageRefinementBaselineAtRelease as sourceAtHomepageRefinementBaseline,sourceAtScopeBetaBaselineAtRelease as sourceAtScopeBetaBaseline} from './ai_middle_release_20261028_contract.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';


// Every old physical assertion runs on its exact approved f2a edition; the separate Scope matrix certifies current layout.
const scopeHistoricalBodies=historicalScopeBetaBrowserBodies(decodeURIComponent(new URL('../.render-public/',import.meta.url).pathname));
const scopeHistoricalResponse=route=>{const u=new URL(route.request().url()),b=scopeHistoricalBodies.get(u.pathname);assert.ok(b,'Exact compiled historical input');return route.fulfill({status:200,contentType:u.pathname.endsWith('.pdf')?'application/pdf':u.pathname.endsWith('.png')?'image/png':u.pathname.endsWith('.webp')?'image/webp':u.pathname.endsWith('.jpg')?'image/jpeg':u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.json')?'application/json':'application/javascript',body:b});};
if(scopeHistoricalBodies.size)console.log('SCOPE_PRESERVED_PHYSICAL_EDITION f2a81afdd30863c68b4ae748936163a141b0edd6 '+scopeHistoricalBodies.size+' exact compiled bodies');
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Loopback-only completion smoke');
const root = path.resolve(import.meta.dirname, '..');
const out = process.env.MARKETING_COMPLETION_OUT || fs.mkdtempSync('/tmp/marketing-completion-');
fs.mkdirSync(out, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = Object.fromEntries(['index.html', 'marketing-completion.css', 'marketing-completion.js', 'scripts/marketing_completion_browser_smoke.mjs'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const photoRegister = JSON.parse(sourceAtScopeBetaBaseline('docs/marketing-photo-register-20261013.json',fs.readFileSync(path.join(root, 'docs/marketing-photo-register-20261013.json'), 'utf8')));
// Two exact source editions: all functional/safety cases run; only owner-directed photo presentation differs.
const historicalPhotoEdition = sourceHashes['index.html'] === 'a6de2201743448c6072a4efeeac8c5b9c3a10c333189bfc5e608861a9969c475';
// The native refined edition executes every raw current functional case below.
// Only the preceding historical identity assertion receives its exact94cab view.
const nativeRefinedEdition = isCurrentHomepageRefinementSource(source);
assert.ok(!source.includes('homepage-refinement.js?v=20261014.1') || nativeRefinedEdition, 'Only exact frozen native refinement selects the third current edition');
{
  const sourceHashes = nativeRefinedEdition ? {...sourceHashesForIdentity(), 'index.html': hash(sourceAtHomepageRefinementBaseline('index.html', source))} : sourceHashesForIdentity();
  assert.ok(historicalPhotoEdition || sourceHashes['index.html'] === '80364877594f6cf9e13cfe14bdfe2702838a2422680e902abc9bf613dff8c24d', 'Only exact merged-M or frozen owner-five-photo source');
}
function sourceHashesForIdentity() { return sourceHashes; }
const photoEdition = historicalPhotoEdition ? {name: 'merged-M', ids: ['501653292','488892667','524156476'], derivativeCount: 12, captioned: true} : {name: 'owner-five-photo', ids: ['501653292','524156476'], derivativeCount: 20, captioned: false};
assert.equal(photoRegister.photos.length, historicalPhotoEdition ? 3 : 5, 'Exact actual site-wide registry cardinality');
assert.deepEqual(photoRegister.photos.map(photo => String(photo.id)), historicalPhotoEdition ? ['501653292','488892667','524156476'] : ['501653292','488892667','524156476','541113838','511990984'], 'Only the five owner-approved identities and truthful historical edition');
const approvedDerivatives = new Map(photoRegister.photos.flatMap(photo => photo.derivatives.map(derivative => ['/' + derivative.path, derivative])));
equalDerivativeInventory();
function equalDerivativeInventory() { assert.equal(approvedDerivatives.size, photoEdition.derivativeCount, 'Exact edition-specific owner-approved photographic derivatives'); }
for (const file of ['marketing-completion.css', 'marketing-completion.js']) {
  const response = await fetch(base + '/' + file);
  assert.equal(response.status, 200, file + ': actual built runtime available');
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), sourceHashes[file], file + ': served runtime matches exact current source');
}
const photoPaths = [...source.matchAll(/<figure\b[^>]*\bdata-marketing-photo[\s\S]*?<\/figure>/g)].flatMap(match => [...match[0].matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap(value => value[1].split(',').map(entry => new URL(entry.trim().split(/\s+/)[0], base).pathname)));
const sdkURL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
const sdk = process.env.PUBLIC_SDK_FILE ? fs.readFileSync(process.env.PUBLIC_SDK_FILE) : Buffer.from(await (await fetch(sdkURL)).arrayBuffer());
assert.equal(createHash('sha384').update(sdk).digest('base64'), 'fPWur1rx/DE6YtXP/x0MD6dd90RgnVsz5yX/DIg7CcVAnTBZsENWuIcpvVTM39ti', 'Genuine pinned SDK, never an authentication stub');
let checks = 0;
const check = (value, label) => { checks++; assert.ok(value, label); };
const equal = (actual, expected, label) => { checks++; assert.deepEqual(actual, expected, label); };
const receipts = [];
const normalize = text => text.replace(/\s+/g, ' ').trim();

async function settled(page, selector) {
  await page.waitForFunction(selector => [...document.querySelectorAll(selector)].every(el => el.dataset.mcMotionState !== 'running'), selector, {timeout: 3000});
}
async function target(page, locator, label, minimum = 44) {
  await locator.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
  const end = Date.now() + 3000;
  let before, stableSince;
  while (Date.now() < end) {
    const current = JSON.stringify(await locator.boundingBox());
    if (current !== before) { before = current; stableSince = Date.now(); }
    if (Date.now() - stableSince >= 150) break;
    await page.waitForTimeout(40);
  }
  check(Date.now() < end, label + ': ordinary scroll settles');
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  check(box && Object.values(box).every(Number.isFinite) && box.width >= minimum && box.height >= minimum && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, label + ': complete physical target of at least' + minimum + 'px');
  check(await locator.evaluate((el, box) => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit === el || el.contains(hit); }, box), label + ': no obstruction or forced click');
  return box;
}
async function setup(browser, options, pathname = '/index.html') {
  const context = await browser.newContext({viewport: options.viewport, deviceScaleFactor: options.dpr || 1, javaScriptEnabled: options.scripts !== false, reducedMotion: options.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block'});
  const page = await context.newPage(), writes = [], external = [], errors = [], photoResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (new URL(response.url()).origin === origin && photoPaths.includes(new URL(response.url()).pathname)) photoResponses.push(response); });
  await context.addInitScript(options => {
    window.__completionUnsafe = [];
    document.addEventListener('submit', event => { window.__completionUnsafe.push('form submit'); event.preventDefault(); }, true);
    window.WebSocket = class { constructor() { window.__completionUnsafe.push('websocket'); throw new Error('Unexpected socket blocked'); } };
    window.__completionAnimations = [];
    const original = Element.prototype.animate;
    if (options.animateMissing) delete Element.prototype.animate;
    else if (options.animateThrows) Element.prototype.animate = () => { throw new Error('EXPECTED_COMPLETION_ANIMATE_FAILURE'); };
    else Element.prototype.animate = function(frames, timing) { window.__completionAnimations.push({target: this.tagName, photo: this.hasAttribute('data-marketing-photo'), duration: timing.duration, frames}); return original.call(this, frames, timing); };
    if (options.observerMissing) delete window.IntersectionObserver;
    if (options.observerThrows) window.IntersectionObserver = class { constructor() { throw new Error('EXPECTED_COMPLETION_OBSERVER_FAILURE'); } };
    if (options.dialogThrows) HTMLDialogElement.prototype.showModal = () => { throw new Error('EXPECTED_COMPLETION_DIALOG_FAILURE'); };
  }, options);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { writes.push({method: request.method(), path: url.pathname}); return route.abort(); }
    if (request.url() === sdkURL) return route.fulfill({status: 200, contentType: 'application/javascript', body: sdk});
    if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
    if (/^\/api\/|\/auth\/|\/functions\//.test(url.pathname)) { writes.push({method: request.method(), path: url.pathname}); return route.abort(); }
    if (options.failScript && url.pathname === '/marketing-completion.js') return route.abort();
    if (options.failStyles && url.pathname === '/marketing-completion.css') return route.abort();
    if (options.failPhotos && photoPaths.includes(url.pathname)) return route.abort();
    if(scopeHistoricalBodies.has(url.pathname))return scopeHistoricalResponse(route);
    return route.continue();
  });
  const response = await page.goto(base + pathname, {waitUntil: 'load'});
  equal(response.status(), 200, pathname + ': ordinary local navigation');
  if (options.scripts !== false) await page.evaluate(() => document.fonts.ready);
  return {page, context, writes, external, errors, photoResponses};
}
function assertSafety(state, options, label) {
  equal(state.writes, [], label + ': zero API or write attempts');
  equal(state.external, [], label + ': no unknown external requests; only verified static SDK');
  const expectedErrors = options.observerThrows ? Array(2).fill('EXPECTED_COMPLETION_OBSERVER_FAILURE') : options.observerMissing ? [label.startsWith('webkit') ? "Can't find variable: IntersectionObserver" : 'IntersectionObserver is not defined'] : [];
  equal(state.errors, expectedErrors, label + ': exact deliberately injected legacy observer errors only; no new runtime error');
}

for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch();
  try {
    const cases = [360, 390, 768, 1024, 1440].map(width => ({name: width + '-ordinary', viewport: {width, height: 1000}}));
    cases.push(...[{width: 375, height: 667}, {width: 390, height: 844}, {width: 1280, height: 720}].map(viewport => ({name: viewport.width + '-first-screen', viewport, hero: true})));
    cases.push({name: '720-200-percent-reflow', viewport: {width: 720, height: 500}, dpr: 2});
    cases.push(...[
      ['no-scripts', {scripts: false}], ['script-failure', {failScript: true}], ['style-failure', {failStyles: true}], ['reduced-motion', {reduced: true}],
      ['observer-missing', {observerMissing: true}], ['observer-throws', {observerThrows: true}],
      ['animation-missing', {animateMissing: true}], ['animation-throws', {animateThrows: true}],
      ['photo-failure', {failPhotos: true}], ['style-and-photo-failure', {failStyles: true, failPhotos: true}], ['dialog-throws', {dialogThrows: true}]
    ].map(([name, extra]) => ({name: '390-' + name, viewport: {width: 390, height: 844}, ...extra})));
    for (const options of cases) {
      const label = engine + '/' + options.name;
      const state = await setup(browser, options), {page, context} = state;
      try {
        equal(await page.locator('[data-marketing-photo]').count(), photoEdition.ids.length, label + ': exact approved homepage photograph count');
        equal(await page.locator('.mr-proof-label').innerText(), 'Sample report · Example data', label + ': sample qualification retained');
        if (options.hero) {
          for (const [text, href] of [['Request an invitation', 'pilot.html?source=homepage'], ['View sample reports', 'sample-report.html']]) {
            const link = page.locator('.hero-actions a').filter({hasText: text});
            equal(await link.getAttribute('href'), href, label + ': protected hero destination');
            const box = await link.boundingBox();
            check(box && box.y >= 0 && box.y + box.height <= options.viewport.height && box.x >= 0 && box.x + box.width <= options.viewport.width && box.height >= 44, label + ': hero button fully first screen');
          }
        }
        const photos = page.locator('[data-marketing-photo]');
        const expectedRatio = [];
        for (let n = 0; n < photoEdition.ids.length; n++) {
          const figure = photos.nth(n), img = figure.locator('img');
          equal(await img.getAttribute('data-stock-id'), photoEdition.ids[n], label + ': exact approved homepage identity and placement');
          await figure.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
          if (options.failPhotos) {
            await page.waitForFunction(n => document.querySelectorAll('[data-marketing-photo]')[n].hasAttribute('data-photo-unavailable'), n);
            equal(await figure.locator('.mc-photo-fallback').innerText(), 'Photograph unavailable', label + ': failed-image label');
          } else {
            await page.waitForFunction(n => { const image = document.querySelectorAll('[data-marketing-photo]')[n].querySelector('img'); return image.complete && image.naturalWidth > 0 && !!image.currentSrc; }, n, {timeout: 10000});
            await img.evaluate(image => image.decode());
            check(await img.evaluate(image => image.naturalWidth > 0 && image.complete), label + ': real photo decoded');
          }
          if (options.scripts !== false && !options.failScript && !options.failStyles && !options.reduced && !options.observerMissing && !options.observerThrows && !options.animateMissing && !options.animateThrows) {
            await page.waitForFunction(n => document.querySelectorAll('[data-marketing-photo]')[n].dataset.mcMotionDuration === '450', n, {timeout: 3000});
          }
          await settled(page, '[data-marketing-photo]');
          const picture = await figure.locator('picture').boundingBox();
          const dims = await img.evaluate(image => { const rect = image.getBoundingClientRect(); return {width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')), fit: getComputedStyle(image).objectFit, alt: image.alt, src: image.currentSrc, paintedWidth: rect.width, dpr: devicePixelRatio}; });
          if (!options.failPhotos) {
            const response = state.photoResponses.findLast(response => response.url() === dims.src && response.status() === 200);
            check(response, label + ': actual photograph200 response recorded');
            equal(await response.finished(), null, label + ': image response finished successfully');
            const imageBytes = await response.body();
            const imagePath = new URL(dims.src).pathname;
            const registered = approvedDerivatives.get(imagePath);
            check(registered, label + ': loaded image is an exact registered derivative');
            const expectedBytes = sourceAtScopeBetaBaseline(imagePath.slice(1),fs.readFileSync(path.join(root, imagePath)));
            equal(hash(imageBytes), hash(expectedBytes), label + ': actual loaded photograph equals approved derivative');
            equal(hash(imageBytes), registered.sha256, label + ': loaded image matches its registered hash and physical width');
            equal(imageBytes.length, registered.bytes, label + ': registered derivative byte length');
            const requiredPixels = Math.min(1600, dims.paintedWidth * dims.dpr);
            check(Number.isFinite(requiredPixels) && requiredPixels > 0 && registered.width + 1 >= requiredPixels, label + ': physical derivative resolution covers painted width and device scale within1600px plan');
            dims.physicalSourceWidth = registered.width;
            dims.requiredPhysicalWidth = requiredPixels;
            dims.sha256 = hash(imageBytes);
          }
          check(dims.width > 0 && dims.height > 0 && !!dims.alt, label + ': intrinsic dimensions and accessible scene description');
          equal(dims.fit, 'contain', label + ': whole photograph, no cover crop');
          check(picture && Math.abs(picture.width / picture.height - dims.width / dims.height) < .005, label + ': each native photo ratio and fallback space retained');
          if (photoEdition.captioned) check(normalize(await figure.locator('figcaption').innerText()).startsWith('Illustrative photography'), label + ': no customer endorsement implied');
          else { equal(await figure.locator('figcaption').count(), 0, label + ': owner-directed clean photographic framing has no caption'); check(!/Illustrative photography|Models shown/.test(await figure.innerText()), label + ': no visible stock-model label'); }
          expectedRatio.push({...dims, source: dims.src, picture});
        }
        equal(new Set(expectedRatio.map(photo => photo.source)).size, photoEdition.ids.length, label + ': exact distinct homepage images');
        if (options.scripts !== false && !options.failScript && !options.failStyles && !options.reduced && !options.observerMissing && !options.observerThrows && !options.animateMissing && !options.animateThrows) {
          const photoDurations = await photos.evaluateAll(nodes => nodes.map(node => Number(node.dataset.mcMotionDuration)));
          equal(photoDurations, photoEdition.ids.map(() => 450), label + ': all photo entrances measured in350–550ms interval');
          const tab = page.locator('[data-lens-choice="velocity"]');
          await target(page, tab, label + '/lens');
          await tab.click();
          await settled(page, '[data-lens-panel]');
          equal(await page.locator('[data-lens-panel="velocity"]').getAttribute('data-mc-motion-duration'), '180', label + ': selected lens180ms state transition');
        }
        const expand = page.locator('.mc-expand-example');
        if (options.scripts === false || options.failScript || options.failStyles) {
          equal(await expand.count(), 0, label + ': no dead enhancement controls');
          equal(await page.locator('.home-workspace-preview').count(), 1, label + ': original static preview intact');
          check(await page.locator('.home-workspace-preview').isVisible(), label + ': preview readable without enhancement');
        } else {
          await target(page, expand, label + '/expand');
          const signature = await page.locator('.home-workspace-preview').evaluate(el => {
            window.__completionOriginalPreview = el;
            return {sample: el.dataset.sampleId, artifact: el.dataset.artifactSha256, text: el.textContent.replace(/\s+/g, ' ').trim(), ids: [...el.querySelectorAll('[id]')].map(x => x.id)};
          });
          await expand.click();
          if (options.dialogThrows) {
            equal(await expand.count(), 0, label + ': unusable expansion control removed after platform fault');
            equal(await page.locator('.home-workspace-preview').evaluate(el => el === window.__completionOriginalPreview && el.parentElement.classList.contains('home-output-inner')), true, label + ': same original preview restored on showModal failure');
          } else {
            const dialog = page.locator('.mc-product-dialog');
            await page.waitForFunction(() => document.querySelector('.mc-product-dialog').open);
            await settled(page, '.mc-product-dialog');
            check(await dialog.isVisible(), label + ': native expanded view visible');
            equal(await page.locator('.home-workspace-preview').evaluate(el => el === window.__completionOriginalPreview), true, label + ': original node moved, never cloned');
            equal(await dialog.locator('.home-workspace-preview').count(), 1, label + ': one preview in dialog');
            equal(await page.locator('.mc-preview-placeholder').count(), 1, label + ': reader position preserved');
            equal(await page.locator('.home-workspace-preview').evaluate(el => ({sample: el.dataset.sampleId, artifact: el.dataset.artifactSha256, text: el.textContent.replace(/\s+/g, ' ').trim(), ids: [...el.querySelectorAll('[id]')].map(x => x.id)})), signature, label + ': every preview text/value/identifier unchanged');
            equal(await page.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id).filter((id, i, all) => all.indexOf(id) !== i)), [], label + ': no duplicate IDs');
            const close = dialog.locator('.mc-dialog-close');
            await target(page, close, label + '/return');
            equal(await close.evaluate(el => el === document.activeElement), true, label + ': visible initial dialog focus');
            await close.press('Tab');
            check(await page.evaluate(() => document.querySelector('.mc-product-dialog').contains(document.activeElement)), label + ': native keyboard focus remains inside');
            await dialog.locator('#hwd-tab-analysis').click();
            equal(await dialog.locator('#hwd-tab-analysis').getAttribute('aria-selected'), 'true', label + ': original evaluation control still works');
            await dialog.locator('#hwd-tab-analysis').press('End');
            equal(await dialog.locator('#hwd-tab-return').getAttribute('aria-selected'), 'true', label + ': original keyboard controller retained');
            await page.screenshot({path: path.join(out, label.replace('/', '-') + '-expanded.png')});
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('.mc-product-dialog').open && !document.querySelector('.mc-preview-placeholder'));
            equal(await expand.evaluate(el => el === document.activeElement), true, label + ': Escape restores opener focus');
            equal(await page.locator('.home-workspace-preview').evaluate(el => el === window.__completionOriginalPreview && el.parentElement.classList.contains('home-output-inner')), true, label + ': original parent and node restored');
            equal(await page.locator('#hwd-tab-return').getAttribute('aria-selected'), 'true', label + ': selected state survives return');
            await expand.click();
            await settled(page, '.mc-product-dialog');
            await dialog.locator('.mc-dialog-close').click();
            await page.waitForFunction(() => !document.querySelector('.mc-product-dialog').open);
            equal(await expand.evaluate(el => el === document.activeElement), true, label + ': touch/click return restores focus');
            await expand.click();
            await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
            equal(await dialog.evaluate(el => el.open), false, label + ': beforeprint synchronously closes expansion');
            equal(await page.locator('.home-workspace-preview').evaluate(el => el === window.__completionOriginalPreview && el.parentElement.classList.contains('home-output-inner')), true, label + ': original preview returned before print styles apply');
          }
        }
        if (options.failStyles || options.reduced || options.animateMissing || options.animateThrows) equal(await page.evaluate(() => window.__completionAnimations), [], label + ': safe static state without animation');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no horizontal overflow');
        if (options.scripts !== false) equal(await page.evaluate(() => window.__completionUnsafe), [], label + ': no forms or sockets');
        assertSafety(state, options, label);
        await page.screenshot({path: path.join(out, label.replace('/', '-') + '-page.png'), fullPage: true});
        receipts.push({engine, state: options.name, photos: expectedRatio, writes: state.writes, errors: state.errors, passed: true});
        console.log('MARKETING_COMPLETION_STATE_PASS ' + label);
      } catch (error) {
        const prefix = label.replace('/', '-');
        await page.screenshot({path: path.join(out, prefix + '-FAILED.png'), fullPage: true});
        const photos = await page.locator('[data-marketing-photo]').evaluateAll(nodes => nodes.map(figure => { const image = figure.querySelector('img'), picture = figure.querySelector('picture'); const box = element => { const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height}; }; return {picture: box(picture), image: box(image), currentSrc: image.currentSrc, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, width: image.getAttribute('width'), height: image.getAttribute('height'), imagePosition: getComputedStyle(image).position, objectFit: getComputedStyle(image).objectFit, unavailable: figure.hasAttribute('data-photo-unavailable')}; }));
        fs.writeFileSync(path.join(out, prefix + '-FAILURE.json'), JSON.stringify({label, error: error.message, sourceHashes, photos, errors: state.errors, writes: state.writes}, null, 2) + '\n', {mode: 0o600});
        throw error;
      } finally { await context.close(); }
    }

    // Prove the new viewport entrances still occur after the old2600ms timer.
    const late = await setup(browser, {viewport: {width: 390, height: 844}});
    try {
      const last = late.page.locator('[data-marketing-photo]').last();
      await late.page.waitForTimeout(2750);
      equal(await last.getAttribute('data-mc-motion-duration'), null, engine + ': offscreen photo not prematurely completed by old fallback');
      await last.evaluate(el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
      await late.page.waitForFunction(index => document.querySelectorAll('[data-marketing-photo]')[index].dataset.mcMotionState === 'running', photoEdition.ids.length - 1);
      check(await last.evaluate(el => getComputedStyle(el).transform !== 'none'), engine + ': late entrance has actual rendered transform');
      await settled(late.page, '[data-marketing-photo]');
      equal(await last.getAttribute('data-mc-motion-duration'), '450', engine + ': late entrance450ms');
      assertSafety(late, {}, engine + '/late-motion');
      receipts.push({engine, state: 'late-after2600ms', passed: true});
    } finally { await late.context.close(); }

    const printed = await setup(browser, {viewport: {width: 1280, height: 900}});
    try {
      await printed.page.emulateMedia({media: 'print'});
      await printed.page.waitForFunction(() => [...document.querySelectorAll('[data-marketing-photo] img')].every(image => image.complete && image.naturalWidth > 0), null, {timeout: 10000});
      equal(await printed.page.locator('[data-marketing-photo] img').evaluateAll(images => images.map(image => image.loading)), photoEdition.ids.map(() => 'eager'), engine + ': print alone loads every approved homepage lazy photograph');
      for (const image of await printed.page.locator('[data-marketing-photo] img').all()) {
        await image.evaluate(image => image.decode());
        const url = await image.evaluate(image => image.currentSrc);
        const response = printed.photoResponses.findLast(response => response.url() === url && response.status() === 200);
        check(response, engine + ': print photo has actual200 response');
        equal(await response.finished(), null, engine + ': print photo response complete');
        equal(hash(await response.body()), hash(sourceAtScopeBetaBaseline(new URL(url).pathname.slice(1),fs.readFileSync(path.join(root,new URL(url).pathname)))), engine + ': print photo bytes match approved derivative');
      }
      if (photoEdition.captioned) equal(await printed.page.locator('[data-marketing-photo] figcaption').count(), 3, engine + ': all three captions retained in print');
      else equal(await printed.page.locator('[data-marketing-photo] figcaption').count(), 0, engine + ': no stock caption reappears in print');
      for (const photo of await printed.page.locator('[data-marketing-photo]').all()) check(await photo.isVisible(), engine + ': every print photograph remains visible');
      assertSafety(printed, {}, engine + '/fresh-print');
      receipts.push({engine, state: 'fresh-print-lazy-photos', passed: true});
    } finally { await printed.context.close(); }

    for (const pathname of ['/after-a-reorganization.html', '/after-an-acquisition.html', '/new-in-the-role.html', '/transformation-behind-schedule.html']) {
      const oldSource = execFileSync('git', ['show', '561439e7c5aef48db0331bbb993f0a6d9ec4ada1:' + pathname.slice(1)], {cwd: root, encoding: 'utf8'});
      for (const width of [390, 1440]) {
        const label = engine + pathname + '/' + width, state = await setup(browser, {viewport: {width, height: 1000}}, pathname), {page, context} = state;
        try {
          equal(await page.locator('main').count(), 1, label + ': one main');
          equal(await page.locator('footer.mond-footer').count(), 1, label + ': one canonical semantic footer');
          equal(await page.getByRole('contentinfo').count(), 1, label + ': one content-info landmark');
          equal(await page.locator('main footer').count(), 0, label + ': footer outside closed main');
          equal(await page.locator('.mf-bottom').count(), 1, label + ': copyright not duplicated');
          equal(await page.locator('.mf-nav').count(), 1, label + ': no orphan footer navigation');
          const oldText = await page.evaluate(raw => { const doc = new DOMParser().parseFromString(raw, 'text/html'); return [...doc.querySelectorAll('main h1,main h2,main p')].map(el => el.textContent.replace(/\s+/g, ' ').trim()); }, oldSource);
          equal(await page.locator('main h1,main h2,main p').evaluateAll(nodes => nodes.map(el => el.textContent.replace(/\s+/g, ' ').trim())), oldText, label + ': every original main heading and paragraph preserved');
          const invite = page.locator('main a[href="pilot.html"]');
          equal(normalize(await invite.innerText()), 'Request an invitation →', label + ': unchanged invitation wording');
          for (const [text, href] of [['Privacy', 'privacy.html'], ['Trust & Security Center', 'security.html'], ['Contact', 'connect.html']]) {
            const link = page.locator('footer').getByRole('link', {name: text, exact: true});
            equal(await link.getAttribute('href'), href, label + ': preserved trust link');
            await target(page, link, label + '/' + text, 16);
          }
          check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': footer contained');
          assertSafety(state, {}, label);
          await page.screenshot({path: path.join(out, engine + '-' + pathname.slice(1, -5) + '-' + width + '-footer.png')});
          receipts.push({engine, page: pathname, width, passed: true});
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
}
for (const [file, expected] of Object.entries(sourceHashes)) equal(hash(fs.readFileSync(path.join(root, file))), expected, file + ': source stayed frozen throughout run');
const result = {ok: true, checks, states: receipts.length, photoEdition: photoEdition.name, homepagePhotoIds: photoEdition.ids, sitePhotoCount: photoRegister.photos.length, sourceHashes, receipts, performedWrites: 0, scope: 'Loopback-only genuine SDK; immutable product preview inspected without cloning, API, authentication, submission or customer change'};
fs.writeFileSync(path.join(out, 'RECEIPT.json'), JSON.stringify(result, null, 2) + '\n', {mode: 0o600});
console.log('MARKETING_COMPLETION_BROWSER_PASS ' + JSON.stringify({checks, states: receipts.length, performedWrites: 0, out}));
