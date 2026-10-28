import {historicalSiteDesignBrowserBodiesAtRelease as historicalSiteDesignBrowserBodies,isCurrentReleaseSource as isCurrentSiteDesignCoherence,sourceAtScopeBetaBaselineAtRelease as sourceAtScopeBetaBaseline} from './companies_culture_release_20261028_contract.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sourceAtSiteDesignCoherenceBaseline} from './site_design_coherence_20261014_inverse.mjs';

const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Loopback-only photo presentation proof');
const out = process.env.MARKETING_PHOTO_PRESENTATION_OUT || fs.mkdtempSync('/tmp/marketing-photo-presentation-');
fs.mkdirSync(out, {recursive: true});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = text => text.replace(/\s+/g, ' ').trim();
const routes = [
  {page: 'index.html', ids: ['501653292', '524156476'], selector: '[data-marketing-photo]', copySelector: '#mc-work-title, #mc-judgment-title', copy: ['Work is shared. Perspectives can differ.', 'Let the evidence inform the conversation.']},
  {page: 'why-monderman.html', ids: ['511990984'], selector: '[data-site-photo]', copySelector: '#commitments-title', copy: ['Keep differences in experience visible.']},
  {page: 'platform-services.html', ids: ['541113838'], selector: '[data-site-photo]', copySelector: '.mp-editorial-copy .ps-h2', copy: ['Software support is included. Expert interpretation is separate.']},
  {page: 'operational-systems-article.html', ids: ['488892667'], selector: '[data-site-photo]', copySelector: '.mp-editorial-copy > p:first-child', copy: ['Operational Systems examines unnecessary process work: repeated data entry, reporting, coordination, and the steps people use to complete routine activities.']},
];
const sourceFiles = [...routes.map(route => route.page), ...(isCurrentSiteDesignCoherence()?['Monderman_Platform_Brief.html']:[]), 'marketing-photo-presentation.css', 'marketing-photo-presentation.js', 'marketing-refresh.css', 'marketing-refresh.js', 'marketing-completion.css', 'marketing-completion.js', 'docs/marketing-photo-register-20261013.json', 'scripts/marketing_photo_presentation_20261013_browser.mjs'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const publicRoot = fs.existsSync(path.join(root, '.render-public', 'index.html')) ? path.join(root, '.render-public') : root;
function publicFiles(directory, prefix = '') {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) return publicFiles(path.join(directory, entry.name), relative + '/');
    return entry.isFile() ? [relative] : [];
  });
}
const designHistoricalBodies = historicalSiteDesignBrowserBodies(publicRoot);
const publicInventory = publicFiles(publicRoot);
const staticPaths = new Set(publicInventory.map(file => new URL('/' + file, base).pathname));
function staticQueriesForEdition(historicalBodies) {
const staticQueries = new Map();
for (const file of publicInventory.filter(file => /\.(?:html|css|js)$/.test(file))) {
  const text = historicalBodies.has('/' + file) ? historicalBodies.get('/' + file).toString('utf8') : fs.readFileSync(path.join(publicRoot, file), 'utf8');
  for (const match of text.matchAll(/["'(]((?:\/?[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(?:html|css|js|json|woff2?|svg|png|jpe?g|webp|avif|pdf)\?[^"'()\s<>]+)["')]/g)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), base + '/' + file);
    if (url.origin !== origin || !staticPaths.has(url.pathname)) continue;
    const parameters = [...url.searchParams.keys()];
    if (!parameters.every(key => ['v', 'source'].includes(key))) continue;
    const allowed = staticQueries.get(url.pathname) || new Set(); allowed.add(url.search); staticQueries.set(url.pathname, allowed);
  }
}
  return staticQueries;
}
const actualCurrentStaticQueries = staticQueriesForEdition(new Map());
const staticQueries = staticQueriesForEdition(designHistoricalBodies);
const historicalStaticQueries = staticQueries;
const register = JSON.parse(sourceAtSiteDesignCoherenceBaseline('docs/marketing-photo-register-20261013.json',fs.readFileSync(path.join(root, 'docs/marketing-photo-register-20261013.json'), 'utf8')));
assert.equal(register.schemaVersion, 2, 'Current five-photo register edition');
assert.deepEqual([...register.approvedAssetPool].sort(), routes.flatMap(route => route.ids).sort(), 'Five exact owner-approved stock identities');
assert.equal(register.photos.length, 5, 'Five registered photographs, no unapproved additions');
const derivatives = new Map(register.photos.flatMap(photo => photo.derivatives.map(derivative => ['/' + derivative.path, {...derivative, stockId: photo.id}])));
assert.equal(derivatives.size, 20, 'Twenty exact display derivatives');
for (const [pathname, record] of derivatives) {
  const bytes = sourceAtScopeBetaBaseline(pathname.slice(1),fs.readFileSync(path.join(root, pathname.slice(1))));
  assert.equal(bytes.length, record.bytes, pathname + ': exact registered byte length');
  assert.equal(hash(bytes), record.sha256, pathname + ': exact registered asset hash');
}
const servedHashes = {};
for (const file of [...routes.map(route => route.page), ...(isCurrentSiteDesignCoherence()?['Monderman_Platform_Brief.html']:[]), 'marketing-photo-presentation.css', 'marketing-photo-presentation.js']) {
  const response = await fetch(base + '/' + file, {signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, file + ': actual local public resource');
  const actual = Buffer.from(await response.arrayBuffer()), expected = fs.readFileSync(path.join(publicRoot, file));
  assert.equal(hash(actual), hash(expected), file + ': exact served public artifact');
  if (!file.endsWith('.html')) assert.equal(hash(actual), sourceHashes[file], file + ': built runtime matches source');
  servedHashes[file] = {sha256: hash(actual), bytes: actual.length};
}
const actualCurrentServedHashes=structuredClone(servedHashes);
for(const [pathname,body]of designHistoricalBodies)if(servedHashes[pathname.slice(1)])servedHashes[pathname.slice(1)]={sha256:hash(body),bytes:body.length};
const historicalServedHashes=servedHashes;
const sdkURL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
const sdk = process.env.PUBLIC_SDK_FILE ? fs.readFileSync(process.env.PUBLIC_SDK_FILE) : Buffer.from(await (await fetch(sdkURL, {signal: AbortSignal.timeout(15000)})).arrayBuffer());
assert.equal(createHash('sha384').update(sdk).digest('base64'), 'fPWur1rx/DE6YtXP/x0MD6dd90RgnVsz5yX/DIg7CcVAnTBZsENWuIcpvVTM39ti', 'Genuine static SDK has the existing exact SRI; no auth stub');
let checks = 0, negativeControls = 0;
const check = (condition, label) => { checks++; assert.ok(condition, label); };
const equal = (actual, expected, label) => { checks++; assert.deepEqual(actual, expected, label); };
const receipts = [], failures = [], actualCurrentReceipts = [];

async function setup(type, options, route) {
  const servedHashes=options.actualCurrent?actualCurrentServedHashes:historicalServedHashes;
  const staticQueries=options.actualCurrent?actualCurrentStaticQueries:historicalStaticQueries;
  const context = await type.newContext({viewport: options.viewport, deviceScaleFactor: options.dpr || 1, javaScriptEnabled: options.scripts !== false, reducedMotion: options.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block'});
  const page = await context.newPage(), forbidden = [], external = [], errors = [], assetRows = [], assetFailures = [], assetTasks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url()), expected = derivatives.get(url.pathname);
    if (url.origin !== origin || !expected) return;
    assetTasks.push((async () => {
      equal(response.status(), 200, options.name + ': photographic response 200');
      equal(await response.finished(), null, options.name + ': photographic response completes');
      const bytes = await response.body();
      equal(bytes.length, expected.bytes, options.name + ': photographic response exact length');
      equal(hash(bytes), expected.sha256, options.name + ': photographic response exact registered hash');
      assetRows.push({path: url.pathname, stockId: expected.stockId, sha256: hash(bytes), bytes: bytes.length, width: expected.width, height: expected.height});
    })().catch(error => assetFailures.push(error.message)));
  });
  await context.addInitScript(() => {
    window.__photoPresentationUnsafe = [];
    window.__photoPresentationAnimations = [];
    document.addEventListener('submit', event => { window.__photoPresentationUnsafe.push('form submit'); event.preventDefault(); }, true);
    const original = Element.prototype.animate;
    if (original) Element.prototype.animate = function(frames, timing) {
      window.__photoPresentationAnimations.push({photo: this.matches('[data-site-photo],[data-marketing-photo]'), duration: typeof timing === 'number' ? timing : timing?.duration});
      return original.call(this, frames, timing);
    };
  });
  check(typeof context.routeWebSocket === 'function', 'Native WebSocket interception is available');
  await context.routeWebSocket('**/*', socket => { forbidden.push({transport: 'websocket', url: socket.url()}); socket.close(); });
  await context.route('**/*', async interception => {
    const request = interception.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { forbidden.push({method: request.method(), path: url.pathname}); return interception.abort(); }
    if (request.url() === sdkURL) return interception.fulfill({status: 200, contentType: 'application/javascript', body: sdk});
    if (url.origin !== origin) { external.push({origin: url.origin, path: url.pathname}); return interception.abort(); }
    if (/^\/(?:api|auth|functions|rest|storage)\//.test(url.pathname) || !staticPaths.has(url.pathname) || (url.search && !staticQueries.get(url.pathname)?.has(url.search))) { forbidden.push({method: request.method(), path: url.pathname, query: url.search}); return interception.abort(); }
    if (options.failStyles && url.pathname === '/marketing-photo-presentation.css') return interception.abort();
    if (options.failScript && url.pathname === '/marketing-photo-presentation.js') return interception.abort();
    if (options.failPhotos && derivatives.has(url.pathname)) return interception.abort();
    if (!options.actualCurrent && designHistoricalBodies.has(url.pathname)) return interception.fulfill({status:200,contentType:url.pathname.endsWith('.pdf')?'application/pdf':url.pathname.endsWith('.png')?'image/png':url.pathname.endsWith('.webp')?'image/webp':url.pathname.endsWith('.jpg')?'image/jpeg':url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.json')?'application/json':'application/javascript',body:designHistoricalBodies.get(url.pathname)});
    return interception.continue();
  });
  const response = await page.goto(base + '/' + route.page, {waitUntil: 'load'});
  equal(response.status(), 200, route.page + ': ordinary local navigation');
  equal(hash(await response.body()), servedHashes[route.page].sha256, route.page + ': actual browser main response matches served artifact');
  await page.evaluate(() => document.fonts.ready);
  if (options.print) await page.emulateMedia({media: 'print'});
  return {page, context, forbidden, external, errors, assetRows, assetFailures, assetTasks};
}

async function settleFigure(page, figure, label) {
  await figure.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
  const deadline = Date.now() + 4000;
  let previous, stableSince = Date.now();
  while (Date.now() < deadline) {
    const snapshot = await figure.evaluate(element => {
      const box = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
      return {scroll: [scrollX, scrollY], boxes: [element, element.querySelector('picture'), element.querySelector('img')].map(box), running: element.getAnimations().some(animation => animation.playState === 'running')};
    });
    const value = JSON.stringify(snapshot);
    if (value !== previous) { previous = value; stableSince = Date.now(); }
    if (!snapshot.running && Date.now() - stableSince >= 150) return;
    await page.waitForTimeout(40);
  }
  check(false, label + ': photo geometry and native motion settle within bound');
}

function assertPhoto(snapshot, expected, options, label) {
  equal(snapshot.stockId, expected.stockId, label + ': exact approved photograph');
  equal(snapshot.captionCount, 0, label + ': no photographic caption or model label');
  check(snapshot.alt.trim().length > 0, label + ': accessible descriptive alternative');
  check(snapshot.box.every(Number.isFinite) && snapshot.box[2] > 0 && snapshot.box[3] > 0, label + ': finite positive image geometry');
  check(snapshot.picture.every(Number.isFinite) && snapshot.picture[2] > 0 && snapshot.picture[3] > 0, label + ': finite positive reserved picture slot');
  check(Math.abs(snapshot.box[2] / snapshot.box[3] - expected.ratio) / expected.ratio < .005, label + ': complete native image proportions');
  check(Math.abs(snapshot.picture[2] / snapshot.picture[3] - expected.ratio) / expected.ratio < .005, label + ': reserved slot keeps native proportions');
  check(Math.abs(snapshot.box[2] - snapshot.picture[2]) <= 1 && Math.abs(snapshot.box[3] - snapshot.picture[3]) <= 1, label + ': image occupies the complete reserved frame');
  equal(snapshot.fit, 'contain', label + ': complete photographic composition is retained');
  check(snapshot.visible, label + ': photograph or error alternative is not hidden by an ancestor');
  if (!options.failStyles) check(snapshot.radius >= (options.print ? 4 : 18), label + ': scoped rounded photographic frame');
  if (!options.failStyles && !options.print) check(snapshot.panelRadius >= 24, label + ': rounded editorial panel remains distinct from the photograph');
  if (!options.failPhotos) {
    check(snapshot.complete && snapshot.naturalWidth > 0, label + ': actual image decoded');
    equal(snapshot.actualStockId, expected.stockId, label + ': selected derivative belongs to exact image');
    check(Number.isFinite(snapshot.resourceWidth) && snapshot.resourceWidth + 1 >= Math.min(1600, snapshot.box[2] * snapshot.dpr), label + ': selected registered pixels cover painted width at actual DPR, capped at largest derivative');
    check(snapshot.responseVerified, label + ': selected derivative response hash and byte length verified');
  } else check(snapshot.fallbackVisible, label + ': failed photo has a usable alternative without losing geometry');
}

function negativeGeometryProof(snapshot, expected, options) {
  for (const mutate of [
    row => row.stockId = 'UNAPPROVED', row => row.captionCount = 1,
    row => row.box[3] *= 1.4, row => row.picture[2] = NaN,
    row => row.fit = 'cover', row => row.visible = false,
    row => row.resourceWidth = 1, row => row.responseVerified = false,
  ]) {
    const invalid = structuredClone(snapshot); mutate(invalid); negativeControls++;
    assert.throws(() => assertPhoto(invalid, expected, options, 'controlled invalid photographic snapshot'), undefined, 'Actual validation rejects incorrect identity/caption/geometry/crop/visibility/resource proof');
  }
}

// The unchanged authored16in×9in print sheet is1536×864 CSS pixels.
function assertPlatformPrintCanvas(snapshot) {
  assert.deepEqual(snapshot.viewport, {width: 1536, height: 864}, 'Exact original print canvas');
  assert.equal(snapshot.slides.length, 12, 'Every original print slide remains');
  assert.equal(new Set(snapshot.slides.map(row => row.id)).size, 12, 'Every printed slide has its original unique identity');
  const inside = (outer, inner) => inner[0] >= outer[0] - .5 && inner[1] >= outer[1] - .5 && inner[2] <= outer[2] + .5 && inner[3] <= outer[3] + .5;
  for (const row of snapshot.slides) {
    assert.ok([...row.box, ...row.inner, row.width, row.height, row.scrollWidth, row.clientWidth, row.scrollHeight, row.clientHeight].every(Number.isFinite), 'Printed dimensions and content geometry are finite');
    assert.ok(Math.abs(row.width - 1536) <= .5 && Math.abs(row.height - 864) <= .5, 'Every full original16in×9in slide has exact physical dimensions');
    assert.ok(row.scrollWidth <= row.clientWidth + 1 && row.scrollHeight <= row.clientHeight + 1, 'No printed slide content overflows its full page');
    assert.ok(inside(row.box, row.inner), 'Every original slide inner content stays within its full print page');
    for (const layer of row.layers) {
      assert.ok(layer.visible && layer.box.every(Number.isFinite) && inside(row.box, layer.box), 'Every original printed platform layer remains visible and contained');
    }
  }
}
function collectPlatformPrintCanvas() {
  const box = e => {const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom];};
  return {viewport: {width: innerWidth, height: innerHeight}, slides: [...document.querySelectorAll('.deck > .slide')].map(e => ({id: e.id, box: box(e), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight, inner: box(e.querySelector('.slide-inner')), layers: [...e.querySelectorAll('.layer-stack .layer')].map(layer => ({visible: layer.checkVisibility(), box: box(layer)}))}))};
}
function negativePrintCanvasProof(snapshot) {
  for (const mutate of [
    row => row.viewport.width = 1440, row => row.slides.pop(),
    row => row.slides[0].box[0] = NaN, row => row.slides[0].width = 1534,
    row => row.slides[0].height = 862, row => row.slides[0].inner[2] = row.slides[0].box[2] + 2,
    row => row.slides[0].scrollWidth = row.slides[0].clientWidth + 2,
    row => row.slides[0].scrollHeight = row.slides[0].clientHeight + 2,
    row => row.slides.find(slide => slide.layers.length).layers[0].visible = false,
    row => row.slides[1].id = row.slides[0].id,
  ]) {
    const invalid = structuredClone(snapshot); mutate(invalid); negativeControls++;
    assert.throws(() => assertPlatformPrintCanvas(invalid), undefined, 'Actual print validation rejects wrong canvas, missing/duplicate slides, nonfinite/undersized page, clipped content or hidden layer');
  }
}

function collectWhyRails() {
  const hero = document.querySelector('.hero h1').getBoundingClientRect();
  return {
    heroX: hero.left,
    sectorX: document.querySelector('.wm-sector-label').getBoundingClientRect().left,
    sections: [...document.querySelectorAll('.section-with-bar')].map(section => {
      const heading = section.querySelector('h2').getBoundingClientRect(), label = section.querySelector('.section-bar').getBoundingClientRect();
      return {id: section.id, headingX: heading.left, labelX: label.left, headingTop: heading.top, labelBottom: label.bottom};
    }),
  };
}
function assertWhyRails(snapshot, label) {
  check(Number.isFinite(snapshot.heroX) && Number.isFinite(snapshot.sectorX), label + ': finite real hero and sector rails');
  check(Math.abs(snapshot.sectorX - snapshot.heroX) <= 1, label + ': sector stays on the hero rail');
  equal(snapshot.sections.map(section => section.id), ['condition', 'difference', 'rigor', 'commitments', 'fit', 'next-step'], label + ': all six exact narrative sections remain in order');
  for (const section of snapshot.sections) {
    check([section.headingX, section.labelX, section.headingTop, section.labelBottom].every(Number.isFinite), label + ': finite real section geometry');
    check(Math.abs(section.headingX - snapshot.heroX) <= 1 && Math.abs(section.labelX - snapshot.heroX) <= 1, label + '/' + section.id + ': heading and section label share the hero rail');
    check(section.headingTop - section.labelBottom >= 8, label + '/' + section.id + ': label-to-heading clearance remains at least8px');
  }
}
function negativeWhyRailProof(snapshot) {
  for (const mutate of [
    row => row.sections[3].headingX += 24, row => row.sections[3].headingX += 48,
    row => row.sections[3].labelX += 24, row => row.sections[3].labelBottom = row.sections[3].headingTop - 7,
    row => row.sections[3].headingX = NaN, row => row.sections.pop(),
  ]) {
    const invalid = structuredClone(snapshot); mutate(invalid); negativeControls++;
    assert.throws(() => assertWhyRails(invalid, 'controlled invalid Why rail snapshot'), undefined, 'Actual validation rejects retired inset, label drift, collision or missing geometry');
  }
}

try {
  for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await browserType.launch({headless: true});
    try {
      const cases = [360, 390, 768, 1024, 1440].map(width => ({name: width + '-ordinary', viewport: {width, height: 1000}}));
      cases.push({name: '720-200-percent-reflow', viewport: {width: 720, height: 500}, dpr: 2});
      cases.push(...[
        ['390-no-scripts', {scripts: false}], ['390-reduced-motion', {reduced: true}],
        ['390-style-failure', {failStyles: true}], ['390-script-failure', {failScript: true}],
        ['390-style-and-photo-failure', {failStyles: true, failPhotos: true}],
      ].map(([name, options]) => ({name, viewport: {width: 390, height: 844}, ...options})));
      cases.push({name: '1440-print', viewport: {width: 1440, height: 1000}, print: true});
      for (const route of routes) for (const options of cases) {
        const label = engine + '/' + route.page + '/' + options.name;
        const state = await setup(browser, options, route), {page, context} = state;
        try {
          check(await page.locator('body').evaluate(body => body.classList.contains('photo-presentation')), label + ': explicit current photo presentation body token');
          const figures = page.locator(route.selector);
          equal(await figures.count(), route.ids.length, label + ': exact current route photo count including hidden DOM');
          equal(await page.locator('[data-stock-id]').evaluateAll(images => images.map(image => image.dataset.stockId)), route.ids, label + ': exact ordered route identities');
          equal(await figures.locator('figcaption').count(), 0, label + ': captions are absent, not merely hidden');
          equal(await page.locator(route.copySelector).evaluateAll(nodes => nodes.map(node => node.innerText.replace(/\s+/g, ' ').trim())), route.copy, label + ': exact displayed nearby product copy');
          if (route.page === 'index.html') {
            equal(normalize(await page.locator('.mr-proof-label').innerText()), 'Sample report · Example data', label + ': sample qualification retained');
            equal(await page.locator('[data-lens-choice]').allTextContents(), ['Structural Clarity', 'Decision Velocity', 'Operational Systems', 'Institutional Performance'], label + ': four distinct Diagnostic labels retained');
          }
          const photos = [], imageScreenshots = [];
          for (let index = 0; index < route.ids.length; index++) {
            const figure = figures.nth(index), image = figure.locator('img'), stockId = route.ids[index];
            await figure.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
            if (options.failPhotos) {
              await page.waitForFunction(({selector, index}) => document.querySelectorAll(selector)[index].hasAttribute('data-photo-unavailable'), {selector: route.selector, index}, {timeout: 10000});
            } else {
              await page.waitForFunction(({selector, index}) => { const image = document.querySelectorAll(selector)[index].querySelector('img'); return image.complete && image.naturalWidth > 0 && !!image.currentSrc; }, {selector: route.selector, index}, {timeout: 10000});
              await image.evaluate(async image => { const selected = image.currentSrc; await image.decode(); if (selected !== image.currentSrc) await image.decode(); });
            }
            await settleFigure(page, figure, label);
            await Promise.all(state.assetTasks);
            equal(state.assetFailures, [], label + ': no failed actual photographic byte verification');
            if (route.page === 'why-monderman.html') equal(await figure.evaluate(element => element.matches('#commitments .mp-editorial-grid > figure.mp-photo[data-site-photo]')), true, label + ': exact Why figure owns its photographic panel');
            const snapshot = await figure.evaluate((element, whyFigure) => {
              const image = element.querySelector('img'), picture = element.querySelector('picture');
              const box = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
              let visible = true;
              for (let node = element; node; node = node.parentElement) { const s = getComputedStyle(node); if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) < .99) visible = false; }
              const fallback = element.querySelector('.mp-photo-fallback,.mc-photo-fallback');
              return {stockId: image.dataset.stockId, captionCount: element.querySelectorAll('figcaption').length, alt: image.alt, box: box(image), picture: box(picture), fit: getComputedStyle(image).objectFit, radius: parseFloat(getComputedStyle(picture).borderTopLeftRadius), panelRadius: parseFloat(getComputedStyle(whyFigure ? element : element.parentElement).borderTopLeftRadius), visible, complete: image.complete, naturalWidth: image.naturalWidth, currentSrc: image.currentSrc, dpr: devicePixelRatio, fallbackVisible: !!fallback && fallback.textContent === 'Photograph unavailable' && fallback.getBoundingClientRect().width > 0};
            }, route.page === 'why-monderman.html');
            const expectedPhoto = register.photos.find(photo => photo.id === stockId), largest = expectedPhoto.derivatives.find(derivative => derivative.path.endsWith('-1600.webp'));
            const actualPath = snapshot.currentSrc ? new URL(snapshot.currentSrc).pathname : '';
            const resource = derivatives.get(actualPath);
            snapshot.resourceWidth = resource?.width; snapshot.actualStockId = resource?.stockId;
            snapshot.responseVerified = state.assetRows.some(row => row.path === actualPath && row.sha256 === resource?.sha256 && row.bytes === resource?.bytes);
            const expected = {stockId, ratio: largest.width / largest.height};
            assertPhoto(snapshot, expected, options, label);
            photos.push(snapshot);
            if (options.name === '390-ordinary' && index === 0) negativeGeometryProof(snapshot, expected, options);
            if (['390-ordinary', '1440-ordinary', '390-style-and-photo-failure', '1440-print'].includes(options.name)) {
              const filename = engine + '-' + route.page.replace('.html', '') + '-' + options.name + '-photo' + (index + 1) + '.png';
              const composition = figure.locator('xpath=..');
              await composition.screenshot({path: path.join(out, filename)});
              imageScreenshots.push(filename);
            }
          }
          let whyRails;
          if (route.page === 'why-monderman.html' && !options.print) {
            whyRails = await page.evaluate(collectWhyRails);
            assertWhyRails(whyRails, label);
            if (options.name === '390-ordinary') {
              negativeWhyRailProof(whyRails);
              const grid = page.locator('#commitments .mp-editorial-grid'), originalStyle = await grid.getAttribute('style');
              try {
                await grid.evaluate(element => { element.style.padding = '24px'; });
                const retiredInset = await page.evaluate(collectWhyRails); negativeControls++;
                assert.throws(() => assertWhyRails(retiredInset, label + '/retired rendered inset'), undefined, 'The actual retired24px padded-grid regression rejects');
              } finally {
                await grid.evaluate((element, style) => { if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style); }, originalStyle);
              }
              assertWhyRails(await page.evaluate(collectWhyRails), label + '/exact restored presentation');
            }
          }
          const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth}));
          check(overflow.scrollWidth <= overflow.viewport + 1, label + ': no horizontal page overflow');
          if (options.reduced || options.failStyles || options.failScript || options.scripts === false) {
            const animations = await page.evaluate(() => window.__photoPresentationAnimations || []);
            if (options.reduced || (route.page !== 'index.html' && (options.failStyles || options.failScript))) equal(animations.filter(animation => animation.photo), [], label + ': optional secondary motion has a static fallback');
          }
          await Promise.all(state.assetTasks);
          equal(state.forbidden, [], label + ': zero API/auth/function/write attempts');
          equal(state.external, [], label + ': no external telemetry or unknown transport; only genuine static SDK fulfilled');
          equal(state.errors, [], label + ': no unexpected runtime error');
          equal(await page.evaluate(() => window.__photoPresentationUnsafe || []), [], label + ': no form submission or socket attempted');
          equal(state.assetFailures, [], label + ': all observed photographic responses are exact');
          receipts.push({label,route: route.page,engine,browserVersion: browser.version(),options,photos,assetResponses: state.assetRows,whyRails,overflow,screenshots: imageScreenshots,performedWrites: 0});
        } catch (error) {
          const failureImage = label.replaceAll('/', '-') + '-FAIL.png';
          await page.screenshot({path: path.join(out, failureImage), fullPage: false}).catch(() => {});
          failures.push({label,error: error.stack,screenshot: failureImage,forbidden: state.forbidden,external: state.external,pageErrors: state.errors});
          throw error;
        } finally { await context.close(); }
      }

      // Only the relocated current photo is additional. Every original96 historical
      // engine/state case above remains literal and executable on exactM169 bytes.
      if (isCurrentSiteDesignCoherence()) for(const options of [
        {name:'actual-390',viewport:{width:390,height:844}},
        {name:'actual-1440',viewport:{width:1440,height:1000}},
        {name:'actual-reduced',viewport:{width:390,height:844},reduced:true},
        {name:'actual-no-scripts',viewport:{width:390,height:844},scripts:false},
        {name:'actual-print',viewport:{width:1536,height:864},print:true},
      ]) {
        const route={page:'Monderman_Platform_Brief.html',ids:['488892667'],selector:'[data-site-photo]'},label=engine+'/'+route.page+'/'+options.name;
        const state=await setup(browser,{...options,actualCurrent:true},route),{page,context}=state;
        try{
          let printCanvas;
          const figure=page.locator('#slide-2 .mp-platform-visual [data-site-photo]');
          equal(await figure.count(),1,label+': one actual overhead photograph in Explore the platform');
          equal(await page.locator('[data-site-photo] img').getAttribute('data-stock-id'),'488892667',label+': exact approved moved image');
          equal(await page.locator('figcaption').count(),0,label+': no Models caption');
          equal(await page.locator('#slide-2 .layer-stack .layer').count(),3,label+': every original platform layer remains');
          if(!options.print){
            const layers=await page.locator('#slide-2 .layer-stack .layer').evaluateAll(xs=>xs.map(e=>{const b=e.getBoundingClientRect(),a=e.querySelector('strong').getBoundingClientRect(),d=e.querySelector('span').getBoundingClientRect();return{box:[b.left,b.top,b.right,b.bottom],label:[a.left,a.top,a.right,a.bottom],description:[d.left,d.top,d.right,d.bottom]};}));
            for(const row of layers){check([...row.box,...row.label,...row.description].every(Number.isFinite),label+': layer text geometry finite');check(row.label[0]>=row.box[0]-1&&row.label[2]<=row.box[2]+1&&row.description[0]>=row.box[0]-1&&row.description[2]<=row.box[2]+1&&row.label[1]>=row.box[1]-1&&row.description[3]<=row.box[3]+1,label+': full layer labels and descriptions contained');check(row.label[2]<=row.description[0]-4||row.description[2]<=row.label[0]-4||row.label[3]<=row.description[1]-4||row.description[3]<=row.label[1]-4,label+': label and description do not touch or overlap');}
          }

          if(options.print){
            check(await figure.isHidden(),label+': deliberate new photo is screen-only');
            equal(await page.locator('#slide-2 .layer-stack .layer').evaluateAll(xs=>xs.filter(x=>x.checkVisibility()).length),3,label+': original printed platform diagram remains complete');
            printCanvas = await page.evaluate(collectPlatformPrintCanvas);
            assertPlatformPrintCanvas(printCanvas);checks++;
            negativePrintCanvasProof(printCanvas);
          }else{
            await figure.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
            await page.waitForFunction(()=>{const i=document.querySelector('#slide-2 [data-site-photo] img');return i.complete&&i.naturalWidth>0&&!!i.currentSrc;},null,{timeout:10000});
            await figure.locator('img').evaluate(i=>i.decode());await settleFigure(page,figure,label);await Promise.all(state.assetTasks);
            const geometry=await figure.evaluate(e=>{const i=e.querySelector('img'),p=e.querySelector('picture'),r=i.getBoundingClientRect(),b=p.getBoundingClientRect(),c=getComputedStyle(i);return{src:i.currentSrc,fit:c.objectFit,width:r.width,height:r.height,pictureWidth:b.width,pictureHeight:b.height,radius:parseFloat(getComputedStyle(p).borderTopLeftRadius),alt:i.alt,dpr:devicePixelRatio};});
            const resource=derivatives.get(new URL(geometry.src).pathname);
            check(resource?.stockId==='488892667',label+': selected derivative belongs to the exact approved image');
            check(state.assetRows.some(r=>r.path===new URL(geometry.src).pathname&&r.sha256===resource.sha256&&r.bytes===resource.bytes),label+': actual selected derivative response bytes verified');
            equal(geometry.fit,'contain',label+': no crop');check(geometry.width>0&&geometry.height>0&&geometry.radius>=18,label+': positive rounded visible frame');
            check(Math.abs(geometry.width/geometry.height-1600/1195)<.005&&Math.abs(geometry.pictureWidth-geometry.width)<=1&&Math.abs(geometry.pictureHeight-geometry.height)<=1,label+': complete reserved proportional composition');
            check(resource.width+1>=Math.min(1600,geometry.width*geometry.dpr),label+': physical source pixels cover painted width');check(geometry.alt.trim(),label+': descriptive neutral alternative');
            if(options.reduced||options.scripts===false)equal((await page.evaluate(()=>window.__photoPresentationAnimations||[])).filter(a=>a.photo),[],label+': current relocated photo has static reduced/noJS fallback');
          }
          check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': current brief has no overflow');
          equal(state.forbidden,[],label+': no API/auth/write/socket');equal(state.external,[],label+': no external transport');equal(state.errors,[],label+': no page errors');equal(state.assetFailures,[],label+': no asset verification failure');equal(await page.evaluate(()=>window.__photoPresentationUnsafe||[]),[],label+': no forms');
          const file=engine+'-'+options.name+'-current-platform.png';await page.screenshot({path:path.join(out,file)});actualCurrentReceipts.push({label,options,printCanvas,assetRows:state.assetRows,screenshot:file,performedWrites:0});
        }catch(error){const screenshot=label.replaceAll('/','-')+'-FAIL.png';await page.screenshot({path:path.join(out,screenshot)}).catch(()=>{});failures.push({label,error:error.stack,screenshot,forbidden:state.forbidden,external:state.external,pageErrors:state.errors});throw error;}finally{await context.close();}
      }

    } finally { await browser.close(); }
  }
  equal(receipts.length, 96, 'Complete bounded matrix: four routes, twelve states, two engines');
  if(isCurrentSiteDesignCoherence())equal(actualCurrentReceipts.length,10,'Current relocated photo: five bounded cases in both original engines');
  equal(Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))])), sourceHashes, 'All product and browser proof inputs stayed immutable during execution');
  console.log('MARKETING_PHOTO_PRESENTATION_BROWSER_PASS ' + JSON.stringify({checks,states: receipts.length,negativeControls,photoIdentities: 5,routes: 4,performedWrites: 0,out}));
} finally {
  const screenshotEvidence = fs.readdirSync(out).filter(file => file.endsWith('.png')).map(file => { const bytes = fs.readFileSync(path.join(out, file)); return {file,sha256: hash(bytes),bytes: bytes.length}; });
  fs.writeFileSync(path.join(out, 'RECEIPT.json'), JSON.stringify({checkedAt: new Date().toISOString(),passed: failures.length === 0 && receipts.length === 96 && (!isCurrentSiteDesignCoherence() || actualCurrentReceipts.length===10),checks,negativeControls,states: receipts.length,sourceHashes,servedHashes,actualCurrentServedHashes,actualCurrentReceipts,sdkSha256: hash(sdk),staticPathCount: staticPaths.size,staticQueryAllowlist: Object.fromEntries([...staticQueries].map(([pathname, queries]) => [pathname, [...queries]])),actualCurrentStaticQueryAllowlist: Object.fromEntries([...actualCurrentStaticQueries].map(([pathname, queries]) => [pathname, [...queries]])),renderedEdition: designHistoricalBodies.size ? 'ACTUAL_M169_HISTORICAL_PRESERVED' : 'UNCHANGED_PRIOR_SOURCE', historicalCompiledPaths: [...designHistoricalBodies.keys()], scope: 'Loopback exact historical five-photo presentation; actual relocated photo and corner mapping independently tested in the current mobile traversal. Print media checks retain complete photo content; existing official pagination tests remain separate. No historical-source skip.',receipts,failures,screenshotEvidence}, null, 2) + '\n');
}
