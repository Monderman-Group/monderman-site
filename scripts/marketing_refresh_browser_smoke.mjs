import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'This smoke is loopback-only');
const root = path.resolve(import.meta.dirname, '..');
const out = process.env.MARKETING_REFRESH_OUT || fs.mkdtempSync('/tmp/marketing-refresh-');
fs.mkdirSync(out, {recursive: true});
const sourceHashes = Object.fromEntries(['index.html', 'marketing-refresh.css', 'marketing-refresh.js', 'scripts/marketing_refresh_browser_smoke.mjs'].map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const lenses = ['clarity', 'velocity', 'systems', 'performance'];
const titles = ['Structural Clarity', 'Decision Velocity', 'Operational Systems', 'Institutional Performance'];
const articlePaths = ['structural-clarity-article.html', 'decision-velocity-article.html', 'operational-systems-article.html', 'institutional-performance-article.html'];
const receipts = [];
let checks = 0;
const check = (value, message) => { checks++; assert.ok(value, message); };
const equal = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };

async function setup(browser, options) {
  const page = await browser.newPage({viewport: options.viewport, deviceScaleFactor: options.deviceScaleFactor, javaScriptEnabled: options.scripts !== false, reducedMotion: options.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block'});
  const writes = [], external = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.supabase = {createClient: () => ({auth: {getSession: async () => ({data: {session: null}}), onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}})}})}; });
  if (options.observerUnavailable) await page.addInitScript(() => { delete window.IntersectionObserver; });
  if (options.observerFailure) await page.addInitScript(() => {
    window.IntersectionObserver = class { constructor() { throw new Error('MARKETING_SMOKE_INJECTED_OBSERVER_FAILURE'); } };
  });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { writes.push({method: request.method(), path: url.pathname}); return route.abort(); }
    if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
    if (/^\/api\//.test(url.pathname)) { writes.push({method: request.method(), path: url.pathname}); return route.abort(); }
    if (options.failScript && url.pathname === '/marketing-refresh.js') return route.abort();
    return route.continue();
  });
  await page.goto(base + '/index.html', {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  return {page, writes, external, errors};
}

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({headless: true});
  try {
    const cases = [360, 390, 768, 1024, 1440].map(width => ({name: width + '-scripts', viewport: {width, height: 1000}, scripts: true}));
    cases.push({name: '390-no-scripts', viewport: {width: 390, height: 844}, scripts: false});
    cases.push({name: '390-script-failure', viewport: {width: 390, height: 844}, scripts: true, failScript: true});
    cases.push({name: '390-reduced-motion', viewport: {width: 390, height: 844}, scripts: true, reduced: true});
    cases.push({name: '390-observer-unavailable', viewport: {width: 390, height: 844}, scripts: true, observerUnavailable: true});
    cases.push({name: '390-observer-failure', viewport: {width: 390, height: 844}, scripts: true, observerFailure: true});
    cases.push({name: '1440-200-percent', viewport: {width: 1440, height: 1000}, scripts: true, zoom: true});
    // A 720x500 CSS viewport at DPR2 represents the responsive reflow of a
    // 1440x1000 physical viewport at 200%, separately from the CSS zoom stress.
    cases.push({name: '720-browser-200-percent-reflow', viewport: {width: 720, height: 500}, deviceScaleFactor: 2, scripts: true});
    for (const options of cases) {
      const state = await setup(browser, options), {page} = state;
      const label = engine + '/' + options.name;
      if (options.zoom) await page.evaluate(() => document.body.style.zoom = '2');
      if (options.deviceScaleFactor) equal(await page.evaluate(() => ({width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio})), {width: 720, height: 500, deviceScaleFactor: 2}, label + ': exact browser-zoom-equivalent responsive viewport');
      const demo = page.locator('[data-lens-demo]'), tabs = demo.locator('[data-lens-choice]');
      equal(await tabs.allTextContents(), titles, label + ': four exact diagnostic names');
      equal(await demo.locator('[data-lens-panel]').count(), 4, label + ': four distinct qualitative panels');
      check((await demo.locator('.mr-demo-heading').innerText()).includes('Not a scored result or customer case'), label + ': visible illustrative boundary');
      for (const tab of await tabs.all()) check((await tab.boundingBox()).height >= 44, label + ': usable lens target');
      const enhanced = options.scripts && !options.failScript;
      if (enhanced) {
        equal(await demo.getAttribute('data-enhanced'), '', label + ': enhancement initialized');
        for (let index = 0; index < lenses.length; index++) {
          await tabs.nth(index).click();
          equal(await tabs.nth(index).getAttribute('aria-selected'), 'true', label + ': selected lens ' + lenses[index]);
          equal(await demo.locator('[data-lens-panel]:visible').count(), 1, label + ': only chosen lens is shown');
          const panel = page.locator('#mr-panel-' + lenses[index]);
          check(await panel.isVisible(), label + ': chosen panel is visible');
          equal(await panel.locator('ol > li').count(), 4, label + ': complete qualitative workflow');
          equal(await panel.locator('details a').getAttribute('href'), articlePaths[index], label + ': established article destination');
        }
        await tabs.first().focus();
        await page.keyboard.press('ArrowLeft');
        equal(await tabs.last().evaluate(el => document.activeElement === el), true, label + ': ArrowLeft wraps');
        await page.keyboard.press('Home');
        equal(await tabs.first().getAttribute('aria-selected'), 'true', label + ': Home selects first');
        await page.keyboard.press('End');
        equal(await tabs.last().getAttribute('aria-selected'), 'true', label + ': End selects last');
        await page.keyboard.press('ArrowRight');
        equal(await tabs.first().getAttribute('aria-selected'), 'true', label + ': ArrowRight wraps');
        await page.keyboard.press('ArrowDown');
        equal(await tabs.nth(1).getAttribute('aria-selected'), 'true', label + ': ArrowDown selects next');
        await page.keyboard.press('ArrowUp');
        equal(await tabs.first().getAttribute('aria-selected'), 'true', label + ': ArrowUp selects previous');
        await page.keyboard.press('Space');
        equal(await tabs.first().getAttribute('aria-selected'), 'true', label + ': Space activates a focused tab');
        const focus = await tabs.first().evaluate(el => ({style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth}));
        equal(focus, {style: 'solid', width: '3px'}, label + ': visible immediate keyboard focus');
        if (options.reduced) equal(await tabs.first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', label + ': reduced-motion state changes');
      } else {
        equal(await demo.getAttribute('data-enhanced'), null, label + ': unenhanced fallback');
        equal(await demo.locator('[data-lens-panel]:visible').count(), 4, label + ': all lens explanations remain available');
        equal(await tabs.first().getAttribute('href'), '#mr-panel-clarity', label + ': native anchor fallback');
        await tabs.first().click();
        await page.waitForURL(url => url.hash === '#mr-panel-clarity');
        const anchorGeometry = await page.locator('#mr-panel-clarity').evaluate(el => ({top: el.getBoundingClientRect().top, headerBottom: document.querySelector('.header').getBoundingClientRect().bottom}));
        check(anchorGeometry.top >= anchorGeometry.headerBottom, label + ': native anchor heading is not under the header');
      }
      const detail = page.locator('#mr-panel-clarity details');
      await detail.locator('summary').focus();
      await page.keyboard.press('Enter');
      equal(await detail.getAttribute('open'), '', label + ': native expanded reading view');
      check(await detail.locator('a').isVisible(), label + ': expanded evidence and article remain readable');
      await page.keyboard.press('Enter');
      equal(await detail.getAttribute('open'), null, label + ': native expansion can close');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': no horizontal overflow');
      check(await page.locator('.hero [data-home-report-quad]').isVisible(), label + ': preserved report preview');
      equal(await page.locator('.mr-proof-label').innerText(), 'Sample report · Example data', label + ': visible example qualification');
      check(await page.locator('.mr-proof-label').isVisible(), label + ': qualification is displayed above the report');
      equal(await page.locator('.hero [data-home-report-quad] [data-promo-score]').innerText(), '52', label + ': approved sample score');
      equal(await page.locator('#sample-output [data-workspace-demo]').count(), 1, label + ': preserved journey');
      // The unchanged baseline has two observer constructors; fault injection
      // intentionally exercises their failure without hiding unrelated errors.
      const expectedErrors = options.observerFailure ? Array(2).fill('MARKETING_SMOKE_INJECTED_OBSERVER_FAILURE') : options.observerUnavailable ? [engine === 'webkit' ? "Can't find variable: IntersectionObserver" : 'IntersectionObserver is not defined'] : [];
      equal(state.errors, expectedErrors, label + ': exact injected baseline errors only, no unexpected JavaScript failures');
      if (options.observerFailure) {
        for (const target of ['.approach-card', '.proof-card', '.first-run-moment']) {
          check(await page.locator(target).first().evaluate(el => getComputedStyle(el).opacity === '1' && getComputedStyle(el).visibility === 'visible'), label + ': reading content survives observer failure');
        }
      }
      equal(state.writes, [], label + ': zero attempted API calls or writes');
      // Immediate positioning is screenshot bookkeeping, including the tall
      // no-script edition; functional native controls were exercised above.
      await page.locator('[data-marketing-scenario]').evaluate(el => el.scrollIntoView({behavior: 'instant', block: 'start'}));
      await page.screenshot({path: path.join(out, engine + '-' + options.name + '-scenario.png')});
      if ([390, 1440].includes(options.viewport.width) && !options.zoom && enhanced && !options.reduced) {
        await page.screenshot({path: path.join(out, engine + '-' + options.name + '-full.png'), fullPage: true});
      }
      const reportLink = page.locator('.hero [data-home-report-quad] .hrq-footer > a');
      await reportLink.evaluate(el => el.scrollIntoView({behavior: 'instant', block: 'center'}));
      // Browser viewport quads avoid old WebKit's inconsistent DOM rects under
      // CSS zoom while retaining an exact, unforced physical hit test.
      const reportLinkViewportBox = await reportLink.boundingBox();
      check(reportLinkViewportBox && Object.values(reportLinkViewportBox).every(Number.isFinite) && reportLinkViewportBox.width > 0 && reportLinkViewportBox.height > 0 && reportLinkViewportBox.x >= 0 && reportLinkViewportBox.y >= 0 && reportLinkViewportBox.x + reportLinkViewportBox.width <= options.viewport.width && reportLinkViewportBox.y + reportLinkViewportBox.height <= options.viewport.height, label + ': full report footer link has positive finite geometry entirely within the viewport');
      check(await reportLink.evaluate((el, box) => { const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return hit === el || el.contains(hit); }, reportLinkViewportBox), label + ': full report footer link is unobstructed');
      await reportLink.click();
      await page.waitForURL(url => url.origin === origin && url.pathname === '/sample-report.html' && url.hash === '#depth');
      equal(state.writes, [], label + ': report navigation performs no writes');
      receipts.push({engine, ...options, reportLinkViewportBox, attemptedWrites: state.writes.length, blockedExternalOrigins: [...new Set(state.external)], pageErrors: state.errors});
      await page.close();
      console.log('MARKETING_REFRESH_STATE_PASS ' + label);
    }
    for (const viewport of [{width:375,height:667},{width:390,height:844},{width:1280,height:720}]) {
      const state = await setup(browser, {viewport, scripts:true, reduced:true}), {page}=state;
      const boxes=await page.locator('.hero-actions>a').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,unobstructed:hit===el||el.contains(hit)};}));
      equal(boxes.length,2,'Exactly two approved hero buttons');
      const qualification=await page.locator('.mr-proof-label').boundingBox(),report=await page.locator('.hero [data-home-report-quad]').boundingBox();
      check(qualification.height>0&&qualification.y+qualification.height<=report.y,engine+'/'+viewport.width+': real sample qualification precedes the enlarged report');
      for(const box of boxes)check(box.height>=44&&box.left>=0&&box.right<=viewport.width&&box.top>=0&&box.bottom<=viewport.height&&box.unobstructed,engine+'/'+viewport.width+': both buttons fully visible and usable on first screen');
      await page.screenshot({path:path.join(out,engine+'-'+viewport.width+'x'+viewport.height+'-hero.png')});
      receipts.push({engine,viewport,heroButtonGeometry:boxes,attemptedWrites:state.writes.length,pageErrors:state.errors});
      equal(state.writes,[],'Hero has no attempted writes');equal(state.errors,[],'Hero has no errors');
      await page.close();
    }
  } finally { await browser.close(); }
}
for (const [file, hash] of Object.entries(sourceHashes)) equal(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,'Executed source stayed frozen: '+file);
const receipt={passed:true,checks,states:receipts.length,base,sourceHashes,receipts,checkedAt:new Date().toISOString()};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('MARKETING_REFRESH_BROWSER_PASS '+JSON.stringify({checks,states:receipts.length,out}));
