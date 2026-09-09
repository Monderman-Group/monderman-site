import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
const privacyPages = fs.readdirSync(root).filter(file => /^privacy(?:-.*)?\.html$/.test(file));
const failures = [];
let checks = 0;
function check(condition, message) {
  checks++;
  if (!condition) failures.push(message);
}
function warm(value) {
  return [...value.matchAll(/rgba?\(([^)]+)\)/g)].some(match => {
    const [r, g, b, a = 1] = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return a > .12 && r > 100 && r > g * 1.12 && r > b * 1.35 && Math.max(r, g, b) - Math.min(r, g, b) > 45;
  });
}
function contrast(foreground, background) {
  const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const colors = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (colors[1] + .05) / (colors[0] + .05);
}
async function visit(page, file) {
  await page.goto(`${base}/${file}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 1, `${file}: horizontal overflow ${overflow}px`);
}
async function noWarm(page, selector, properties, label, pseudo = null) {
  const values = await page.locator(selector).evaluateAll((els, { properties, pseudo }) => els.map(el => {
    const style = getComputedStyle(el, pseudo);
    return properties.map(property => ({ property, value: style[property] }));
  }), { properties, pseudo });
  check(values.length > 0, `${label}: missing ${selector}`);
  for (const styles of values) for (const { property, value } of styles) {
    check(!warm(value), `${label}: decorative warm ${property} returned on ${selector}${pseudo || ''}: ${value}`);
  }
}

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const width of [1440, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const at = file => `${engineName}/${width}/${file}`;

      // A reading measure belongs on the content, not on full-width section bands.
      for (const file of ['security.html', ...privacyPages]) {
        await visit(page, file);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          heroX: document.querySelector('.hero h1').getBoundingClientRect().left,
          sections: [...document.querySelectorAll(':is(body, main) > .section')].map(el => ({
            left: el.getBoundingClientRect().left,
            right: el.getBoundingClientRect().right,
            h2X: el.querySelector('h2')?.getBoundingClientRect().left,
          })),
        }));
        check(geometry.sections.length > 8, `${at(file)}: legal section coverage disappeared`);
        for (const [index, section] of geometry.sections.entries()) {
          check(Math.abs(section.left) <= 1 && Math.abs(section.right - geometry.width) <= 1,
            `${at(file)}: section ${index + 1} is not full width (${section.left}..${section.right})`);
          check(Math.abs(section.h2X - geometry.heroX) <= 1,
            `${at(file)}: section ${index + 1} heading drifted from hero rail (${section.h2X} vs ${geometry.heroX})`);
        }
      }

      await visit(page, 'why-monderman.html');
      const why = await page.evaluate(() => ({
        heroX: document.querySelector('.hero h1').getBoundingClientRect().left,
        sectorX: document.querySelector('.wm-sector-label').getBoundingClientRect().left,
        sections: [...document.querySelectorAll('.section-with-bar')].map(el => {
          const heading = el.querySelector('h2').getBoundingClientRect();
          const label = el.querySelector('.section-bar').getBoundingClientRect();
          return { headingX: heading.left, labelX: label.left, labelBottom: label.bottom, headingTop: heading.top };
        }),
      }));
      check(Math.abs(why.sectorX - why.heroX) <= 1, `${at('why-monderman.html')}: sector band drifted from hero rail`);
      check(why.sections.length === 6, `${at('why-monderman.html')}: narrative section coverage changed`);
      for (const [index, section] of why.sections.entries()) {
        check(Math.abs(section.headingX - why.heroX) <= 1 && Math.abs(section.labelX - why.heroX) <= 1,
          `${at('why-monderman.html')}: section ${index + 1} left rails disagree: ${JSON.stringify(section)}`);
        check(section.headingTop - section.labelBottom >= 8,
          `${at('why-monderman.html')}: section ${index + 1} label collides with heading`);
      }

      for (const file of ['about.html', 'why-monderman.html', 'security.html', 'privacy.html', 'after-an-acquisition.html', 'platform-services.html']) {
        await visit(page, file);
        const type = await page.evaluate(() => {
          const hero = document.querySelector('.hero,.ps-hero');
          const eyebrow = hero.querySelector('.hero-eyebrow,.eyebrow,.ps-eyebrow');
          const dek = hero.querySelector('.hero-dek,.dek,.lede');
          return { eyebrow: parseFloat(getComputedStyle(eyebrow).fontSize), dek: parseFloat(getComputedStyle(dek).fontSize) };
        });
        check(type.eyebrow <= 13 && type.eyebrow < type.dek,
          `${at(file)}: eyebrow must remain subordinate to body copy: ${JSON.stringify(type)}`);
        if (file === 'platform-services.html') {
          const callouts = await page.locator('.ps-tier-trigger').evaluateAll(els => els.map(el => {
            const s = getComputedStyle(el);
            return ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map(key => parseFloat(s[key]));
          }));
          await noWarm(page, '.ps-roi-card .n', ['color'], at(file));
          check(callouts.length === 3, `${at(file)}: expected three plan callouts`);
          for (const padding of callouts) check(padding.every(value => value >= 14), `${at(file)}: tinted callout loses interior padding: ${padding}`);
        }
      }

      for (const file of ['plan-signal.html', 'plan-pattern.html', 'plan-enterprise.html']) {
        await visit(page, file);
        await noWarm(page, '.pl-advisory-box', ['backgroundColor', 'borderLeftColor'], at(file));
        if (file === 'plan-enterprise.html') {
          await noWarm(page, '.pl-svc-tag', ['color'], at(file));
          await noWarm(page, '.pl-includes li.svc', ['backgroundColor', 'borderLeftColor'], at(file), '::before');
        }
      }
      await visit(page, 'after-an-acquisition.html');
      await noWarm(page, '.boundary', ['borderLeftColor'], at('after-an-acquisition.html'));
      await visit(page, 'research.html');
      await noWarm(page, '.bf-jacket', ['boxShadow'], at('research.html'));

      for (const file of ['the-culture-trap-brief.html', 'nothing-stays-tuned.html']) {
        await visit(page, file);
        await noWarm(page, '.publication-hero .article-kicker', ['color'], at(file));
        await page.emulateMedia({ media: 'print' });
        // Chromium may finish media-specific stylesheet work after emulateMedia returns.
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.publication-hero .article-kicker')).color === 'rgb(12, 110, 120)', null, { timeout: 3000 }).catch(() => {});
        const printColor = await page.locator('.publication-hero .article-kicker').evaluate(el => getComputedStyle(el).color);
        check(printColor === 'rgb(12, 110, 120)', `${at(file)}: print kicker color changed: ${printColor}`);
        await page.emulateMedia({ media: 'screen' });
      }

      await visit(page, 'pilot.html');
      await noWarm(page, '#pilotSubmit', ['backgroundColor', 'borderLeftColor'], at('pilot.html'));
      const pilot = await page.locator('#pilotSubmit').evaluate(el => ({
        color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor,
      }));
      check(contrast(pilot.color, pilot.background) >= 4.5, `${at('pilot.html')}: submit label contrast is too low`);
      await visit(page, 'index.html');
      await noWarm(page, '.md-recovery-read', ['borderLeftColor'], at('index.html'));

      await visit(page, 'Monderman_Platform_Brief.html');
      await noWarm(page, '.md-recovery-read', ['borderLeftColor'], at('Monderman_Platform_Brief.html'));
      for (const [selector, properties, pseudo] of [
        ['.progress-dot[aria-current="true"]', ['backgroundColor', 'borderLeftColor']],
        ['.layer.three', ['borderLeftColor']],
        ['.layer.three .layer-tag', ['backgroundColor'], '::before'],
        ['.evidence-flow', ['backgroundImage'], '::before'],
        ['.evidence-step:last-child .evidence-node', ['color', 'borderLeftColor']],
        ['.measure-point.middle .measure-dot', ['backgroundColor']],
        ['.depth-median', ['backgroundColor']],
        ['.depth-median', ['color'], '::after'],
        ['.cross-gate', ['color', 'borderLeftColor']],
        ['.composite-gate', ['borderLeftColor']],
        ['.version-note', ['borderLeftColor']],
        ['.econ-recovery', ['backgroundColor', 'borderLeftColor']],
      ]) await noWarm(page, selector, properties, at('Monderman_Platform_Brief.html'), pseudo);
      await page.close();

      // Isolate static transaction presentation without starting auth or billing.
      const transaction = await browser.newPage({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
      await transaction.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await visit(transaction, 'checkout-success.html');
      const brandColor = await transaction.locator('header .brand').evaluate(el => getComputedStyle(el).color);
      check(brandColor === 'rgb(255, 255, 255)', `${at('checkout-success.html')}: wordmark lost white foreground on dark header: ${brandColor}`);
      await visit(transaction, 'checkout.html');
      const helpers = await transaction.locator('.billing-field small').evaluateAll(els => els.map(el => {
        const style = getComputedStyle(el);
        const background = getComputedStyle(el.closest('.billing-contact')).backgroundColor;
        return { size: parseFloat(style.fontSize), color: style.color, background };
      }));
      check(helpers.length === 3, `${at('checkout.html')}: billing helper coverage changed`);
      for (const helper of helpers) check(helper.size >= 12 && contrast(helper.color, helper.background) >= 4.5,
        `${at('checkout.html')}: small billing guidance is too faint or small: ${JSON.stringify(helper)}`);
      await visit(transaction, 'pattern-trial.html');
      const trialNote = await transaction.locator('.fine').evaluate(el => ({
        color: getComputedStyle(el).color, background: getComputedStyle(el.closest('.card')).backgroundColor,
      }));
      check(contrast(trialNote.color, trialNote.background) >= 4.5, `${at('pattern-trial.html')}: eligibility note contrast is too low`);
      await visit(transaction, 'signin.html');
      const legacyDot = await transaction.locator('.brand').evaluate(el => getComputedStyle(el, '::after').display);
      check(legacyDot === 'none', `${at('signin.html')}: legacy brand square returned after the map lockup`);
      await transaction.close();
    }
  } finally {
    await browser.close();
  }
}
assert.deepEqual(failures, [], `${failures.length} public surface consistency failures:\n${failures.join('\n')}`);
console.log(`Public surface consistency smoke passed: ${checks} checks across Chromium/WebKit at1440,768,390; legal/Why rails, callout padding, eyebrow hierarchy, decorative accents and publication print color.`);
