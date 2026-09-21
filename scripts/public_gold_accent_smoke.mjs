// Bounded public accents, with the previous CSS as a negative-scope control.
// All pages and fonts are local; no account, provider or production calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium, webkit} from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const origin = new URL(base).origin;
const out = process.env.GOLD_ACCENT_OUT || fs.mkdtempSync('/tmp/public-gold-accent-');
const baseline = '30138204856fb7e6d5e14264c060c7b89ed391a1';
const cssFiles = ['enterprise-site.css', 'homepage-workspace-demo.css', 'monderman-depth-lure-tile.css'];
const oldCSS = Object.fromEntries(cssFiles.map(file => [file, execFileSync('git', ['show', `${baseline}:${file}`], {cwd: root, encoding: 'utf8'})]));
const heroSelector = ':is(.hero .hero-actions, .ps-hero .ps-hero-actions) > a.btn:is(.btn-accent, .btn-primary)[href^="pilot.html"], .hero .actions > a.pilot-primary[href="#apply"]';
const activationSelector = 'body.homepage-enterprise .hero .hero-actions > a.btn.btn-secondary[href="pattern-trial.html"]';
const heroPages = ['index.html', 'platform-services.html', 'why-monderman.html', 'pilot.html', 'decision-velocity-article.html', 'structural-clarity-article.html', 'operational-systems-article.html', 'institutional-performance-article.html'];
const gold = 'rgb(201, 162, 39)', lightGold = 'rgb(230, 199, 101)', goldInk = 'rgb(122, 96, 21)', deep = 'rgb(4, 24, 27)', teal = 'rgb(12, 110, 120)';
const rows = [], errors = [];
let checks = 0, screenshots = 0;
fs.mkdirSync(out, {recursive: true});
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const contrast = (foreground, background) => {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
};
const colors = locator => locator.evaluate(el => {
  const style = getComputedStyle(el);
  let background = el;
  while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(background).backgroundImage === 'none') background = background.parentElement;
  const backing = background ? getComputedStyle(background) : null;
  let backgrounds = [backing ? backing.backgroundColor : 'rgb(255, 255, 255)'];
  if (backing && backing.backgroundImage !== 'none') {
    const stops = [...backing.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(Number));
    const opaque = stops.filter(stop => stop.length === 3 || stop[3] === 1);
    if (!opaque.length) throw new Error('Gradient contrast requires an opaque backing stop');
    let samples = opaque.map(stop => stop.slice(0, 3));
    const overlays = stops.filter(stop => stop.length === 4 && stop[3] > 0 && stop[3] < 1);
    for (const pseudo of ['::before', '::after']) {
      const layer = getComputedStyle(background, pseudo);
      if (layer.display !== 'none' && layer.content !== 'none') {
        overlays.push(...[...layer.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].split(',').map(Number)).filter(stop => stop.length === 4 && stop[3] > 0 && stop[3] < 1));
      }
    }
    for (const overlay of overlays) samples = samples.concat(samples.map(base => base.map((value, i) => value * (1 - overlay[3]) + overlay[i] * overlay[3])));
    backgrounds = samples.map(sample => 'rgb(' + sample.map(Math.round).join(', ') + ')');
  }
  return {color: style.color, background: backgrounds[0], backgrounds, border: style.borderBottomColor, leftBorder: style.borderLeftColor, opacity: style.opacity};
});
const minimumContrast = paint => Math.min(...paint.backgrounds.map(background => contrast(paint.color, background)));
const chromeColors = page => page.locator('.header, .header *, footer.mond-footer, footer.mond-footer *').evaluateAll(elements => elements.map(el => {
  const style = getComputedStyle(el);
  return [el.tagName, el.className, style.color, style.backgroundColor, style.backgroundImage, style.borderColor];
}));
async function open(browser, file, width, prior = false) {
  const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(file + ': ' + error.message));
  await page.addInitScript(() => { window.supabase = {createClient: () => ({auth: {
    getSession: async () => ({data: {session: null}}),
    onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}),
  }})}; });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const old = prior && oldCSS[url.pathname.slice(1)];
    return old ? route.fulfill({contentType: 'text/css', body: old}) : route.continue();
  });
  await page.goto(`${base}/${file}`, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return page;
}
async function screenshot(locator, file) {
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({path: path.join(out, file)});
  screenshots++;
}

for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({headless: true});
  try {
    for (const width of [390, 768, 1440]) {
      for (const file of [...heroPages, 'Monderman_Platform_Brief.html']) {
        const label = `${engine}/${width}/${file}`;
        const [page, prior] = await Promise.all([open(browser, file, width), open(browser, file, width, true)]);
        equal(await chromeColors(page), await chromeColors(prior), label + ': navigation and footer colors remain exact');
        await prior.close();
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': no horizontal overflow');
        if (heroPages.includes(file)) {
          const cta = page.locator(heroSelector);
          const outlined = width >= 1181 && file.endsWith('-article.html');
          equal(await cta.count(), 1, label + ': exactly one dark hero invitation request');
          equal((await cta.textContent()).trim(), 'Request an invitation', label + ': approved invitation copy');
          const initial = await colors(cta);
          equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), outlined ? 'rgba(0, 0, 0, 0)' : gold, label + ': invitation fill preserves desktop hierarchy');
          equal(initial.color, outlined ? lightGold : deep, label + ': invitation text');
          equal(initial.border, gold, label + ': gold invitation border');
          const filledHeaderActions = await page.locator('.header .site-entry-link').evaluateAll(nodes => nodes.filter(el => {
            const box = el.getBoundingClientRect(), style = getComputedStyle(el);
            return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0
              && style.visibility !== 'hidden' && Number(style.opacity) > 0
              && ['rgb(169, 208, 212)', 'rgb(196, 225, 227)', 'rgb(201, 162, 39)', 'rgb(12, 110, 120)'].includes(style.backgroundColor);
          }).length);
          equal(filledHeaderActions + (outlined ? 0 : 1), 1, label + ': header and hero retain exactly one filled invitation');
          ok(minimumContrast(initial) >= 4.5, label + ': invitation text contrast across backing colors');
          for (const state of ['hover', 'focus']) {
            if (state === 'hover') await cta.hover();
            else { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await cta.focus(); }
            await page.waitForFunction(({selector, target}) => getComputedStyle(document.querySelector(selector)).borderBottomColor === target, {selector: heroSelector, target: lightGold});
            const active = await colors(cta);
            equal(active.color, outlined ? lightGold : deep, label + ': ' + state + ' text');
            equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), outlined ? 'rgba(0, 0, 0, 0)' : lightGold, label + ': ' + state + ' fill');
            ok(minimumContrast(active) >= 4.5, label + ': ' + state + ' contrast across backing colors');
          }
          await cta.evaluate(el => el.blur());
          await page.mouse.move(0, 0);
          rows.push({engine, width, file, outlined, invitationContrast: minimumContrast(initial)});
        }
        if (file === 'index.html') {
          const activation = page.locator(activationSelector);
          equal(await activation.count(), 1, label + ': exactly one hero activation action');
          equal((await activation.textContent()).trim(), 'Activate your invitation', label + ': activation copy unchanged');
          const activationInitial = await colors(activation);
          equal(await activation.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', label + ': activation remains outlined');
          equal(activationInitial.color, gold, label + ': activation text matches invitation gold');
          equal(activationInitial.border, gold, label + ': activation border matches invitation gold');
          ok(minimumContrast(activationInitial) >= 4.5, label + ': activation text contrast');
          for (const state of ['hover', 'focus']) {
            if (state === 'hover') await activation.hover();
            else { await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await activation.focus(); }
            await page.waitForFunction(({selector, target}) => getComputedStyle(document.querySelector(selector)).borderBottomColor === target, {selector: activationSelector, target: lightGold});
            const active = await colors(activation);
            equal(active.color, lightGold, label + ': activation ' + state + ' text');
            equal(await activation.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', label + ': activation ' + state + ' remains outlined');
            ok(minimumContrast(active) >= 4.5, label + ': activation ' + state + ' contrast');
          }
          await activation.evaluate(el => el.blur());
          await page.mouse.move(0, 0);
          const tabs = page.locator('.hwd-tabs button');
          for (let index = 0; index < 4; index++) {
            await tabs.nth(index).click();
            await settle(page);
            const selected = page.locator('.hwd-tabs button[aria-selected="true"]');
            const number = await colors(selected.locator('span'));
            equal(number.color, goldInk, label + ': active number is gold ink');
            equal(number.opacity, '1', label + ': active number is fully opaque');
            ok(contrast(number.color, number.background) >= 4.5, label + ': active number contrast');
            const tab = await colors(selected);
            equal(tab.border, gold, label + ': active underline');
            ok([teal, 'rgb(10, 91, 99)'].includes(tab.color), label + ': active label remains teal');
            equal(await page.locator('.hwd-tabs button:not([aria-selected="true"]) span').evaluateAll((els, ink) => els.some(el => getComputedStyle(el).color === ink), goldInk), false, label + ': inactive numbers do not acquire gold');
          }
          await tabs.first().click();
          await page.mouse.move(0, 0);
          await screenshot(page.locator('.hero'), `${engine}-${width}-home-hero.png`);
        }
        if (file === 'platform-services.html') await screenshot(page.locator('.ps-hero'), `${engine}-${width}-pricing-hero.png`);
        if (['index.html', 'Monderman_Platform_Brief.html'].includes(file)) {
          const tile = page.locator('#monderman-depth-lure-composite');
          equal(await tile.locator('.md-opportunity > strong').count(), 1, label + ': only one primary value');
          const value = await colors(tile.locator('.md-opportunity > strong'));
          equal(value.color, goldInk, label + ': primary report value is gold ink');
          ok(contrast(value.color, value.background) >= 4.5, label + ': primary report value contrast');
          equal(await tile.locator('strong, dd').evaluateAll((els, ink) => els.filter(el => getComputedStyle(el).color === ink).length, goldInk), 1, label + ': exactly one gold report value');
          equal((await colors(tile.locator('.md-opportunity'))).leftBorder, teal, label + ': report frame remains teal');
          if (await tile.isVisible()) await screenshot(tile, `${engine}-${width}-${file === 'index.html' ? 'home' : 'brief'}-report-tile.png`);
          rows.push({engine, width, file, reportValueContrast: contrast(value.color, value.background), reportTileVisible: await tile.isVisible()});
        }
        await page.close();
      }
    }
  } finally { await browser.close(); }
}
equal(errors, [], 'No browser runtime errors');
fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({status: 'PASS', checks, screenshots, baseline, rows, providerCalls: 0}, null, 2) + '\n');
console.log(JSON.stringify({status: 'PASS', checks, screenshots, layouts: 6, pages: 9, out, providerCalls: 0}));
