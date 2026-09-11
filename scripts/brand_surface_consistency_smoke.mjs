import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const origin = new URL(base).origin;
const root = path.resolve(import.meta.dirname, '..');
const pages = [
  '404.html', 'Monderman_Platform_Brief.html', 'about.html', 'accumulated-drag-department-of-war.html',
  'after-a-reorganization.html', 'after-an-acquisition.html', 'built-to-please.html',
  'compensatory-systems.html', 'connect.html', 'cross-tool-synthesis.html',
  'decision-velocity-article.html', 'decision-velocity.html', 'designing-for-decision-velocity.html',
  'deterministic-ai-infrastructure.html', 'diagnostics.html', 'every-node-for-itself.html',
  'from-tokens-to-outcomes.html', 'governing-complexity.html', 'index.html',
  'institutional-performance-article.html', 'institutional-performance.html', 'merit-after-the-machine.html',
  'new-in-the-role.html', 'nothing-stays-tuned.html', 'operational-systems-article.html',
  'operational-systems.html', 'pilot.html', 'plan-enterprise.html', 'plan-pattern.html',
  'plan-signal.html', 'platform-services.html', 'privacy-2026-08-20-beta.html',
  'privacy-2026-08-24-beta.html', 'privacy-2026-08-26-beta.html', 'privacy-2026-09-08-beta.html',
  'privacy-2026-09-09-beta.html', 'privacy-2026-09-10-beta.html', 'privacy-2026-09-10-optional-measurement-v1.html', 'privacy.html', 'quarter-trillion-friction-us-healthcare.html', 'research.html', 'roi.html',
  'sample-report.html', 'security.html', 'structural-clarity-article.html', 'structural-clarity.html',
  'subprocessors.html', 'terminal-fidelity.html', 'terms-2026-08-20-beta.html',
  'terms-2026-08-24-beta.html', 'terms-2026-08-26-beta.html', 'terms-2026-09-08-beta.html',
  'terms-2026-09-09-beta.html', 'terms.html', 'the-art-of-interior-reasoning.html', 'the-culture-trap-brief.html',
  'the-culture-trap.html', 'the-drift-problem.html', 'the-unmeasured-layer.html',
  'transformation-behind-schedule.html', 'we-gave-bureaucracy-the-fastest-tools.html',
  'when-bureaucracy-became-the-obstacle.html', 'why-monderman.html',
];
const footerOnly = new Set(['404.html', 'decision-velocity.html', 'institutional-performance.html', 'operational-systems.html', 'sample-report.html', 'structural-clarity.html']);
const heroSelector = 'body.canonical-green-shell :is(.hero,.article-hero,.ps-hero,.pl-top),body.canonical-green-shell>main.deck>.slide.cover,body.page-report>main.shell>.hero';
const surfaceSelector = `${heroSelector},footer.mond-footer`;
const tagline = 'See the work clearly. Make the next move count.';
const printPages = new Set(['index.html', 'Monderman_Platform_Brief.html', 'privacy.html', 'the-culture-trap-brief.html', 'cross-tool-synthesis.html', 'operational-systems.html', 'sample-report.html']);
assert.equal(pages.length, 63);
assert.equal(pages.length - footerOnly.size, 57);
for (const file of pages) assert(fs.existsSync(path.join(root, file)), `Missing inventoried page ${file}`);

const publishedSurfaces = fs.readdirSync(root).filter(file => file.endsWith('.html')).filter(file => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const siteFooter = /<footer\b[^>]*\bclass=["'][^"']*\bmond-footer\b/.test(html);
  const canonicalPage = /<body\b[^>]*\bclass=["'][^"']*\bcanonical-green-shell\b/.test(html)
    && /<script\b[^>]*\bsrc=["']canonical-site-shell\.js/.test(html);
  return siteFooter || canonicalPage || file === 'cross-tool-synthesis.html';
});
assert.deepEqual([...pages].sort(), publishedSurfaces.sort(), 'Brand manifest must cover every public hero/footer page, including generated canonical footers');


const failures = [];
let checks = 0;
function check(condition, message) { checks++; if (!condition) failures.push(message); }
function luminance(rgb) {
  const channels = rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function contrastOnBrand(color, backgrounds = []) {
  // Conservative bright bound: maximum radial tint over the brightest base stop.
  let backdrop = [8, 61, 67];
  for (const background of backgrounds) {
    const [r, g, b, a = 1] = background.match(/[\d.]+/g).map(Number);
    backdrop = [r, g, b].map((value, index) => value * a + backdrop[index] * (1 - a));
  }
  const [r, g, b, a = 1] = color.match(/[\d.]+/g).map(Number);
  const text = [r, g, b].map((value, index) => value * a + backdrop[index] * (1 - a));
  const values = [luminance(text), luminance(backdrop)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}
async function surfaceState(page, comparePrint = false) {
  return page.evaluate(({ selector, comparePrint }) => {
    const capture = () => [...document.querySelectorAll(selector)].map(el => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        selector: el.tagName.toLowerCase() + '.' + [...el.classList].join('.'),
        background: style.backgroundImage, color: style.backgroundColor,
        position: style.backgroundPosition, size: style.backgroundSize,
        repeat: style.backgroundRepeat, blend: style.backgroundBlendMode,
        width: box.width, height: box.height, display: style.display,
        pseudos: ['::before', '::after'].map(pseudo => {
          const s = getComputedStyle(el, pseudo);
          return { pseudo, display: s.display, content: s.content, background: s.backgroundImage, color: s.backgroundColor };
        }),
      };
    });
    if (!comparePrint) return capture();

    const sheet = [...document.styleSheets].find(sheet => sheet.href?.includes('/brand-surfaces.css'));
    if (!matchMedia('print').matches || !sheet || sheet.disabled) throw new Error('Print comparison requires print media and the enabled brand stylesheet');
    // Keep the causal comparison in one task: font events, auth/bootstrap callbacks,
    // and media listeners cannot interleave with the three forced style/layout reads.
    const enabled = capture();
    let disabled;
    try {
      sheet.disabled = true;
      disabled = capture();
    } finally {
      sheet.disabled = false;
    }
    return { enabled, disabled, restored: capture() };
  }, { selector: surfaceSelector, comparePrint });
}
function surfaceDifferences(before, after) {
  const differences = [];
  const visit = (left, right, location) => {
    if (Object.is(left, right)) return;
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) visit(left[key], right[key], `${location}.${key}`);
    } else differences.push(`${location}: ${JSON.stringify(left)} -> ${JSON.stringify(right)}`);
  };
  if (before.length !== after.length) differences.push(`surface count: ${before.length} -> ${after.length}`);
  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    visit(before[index], after[index], `surface[${index}] ${before[index]?.selector ?? after[index]?.selector}`);
  }
  return differences;
}
async function waitForStablePrint(page, label) {
  await page.waitForFunction(() => matchMedia('print').matches);
  await page.evaluate(async () => {
    // Print styles may select fonts that were unused by the screen layout.
    document.documentElement.getBoundingClientRect();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Print fonts did not become ready within 5 seconds')), 5000);
      document.fonts.ready.then(() => { clearTimeout(timeout); resolve(); }, reject);
    });
  });
  const deadline = Date.now() + 5000;
  let previous;
  let lastDifferences = [];
  let stableSince = Date.now();
  let stableFrames = 0;
  while (Date.now() < deadline) {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Print layout animation frame timed out')), 1000);
      requestAnimationFrame(() => { clearTimeout(timeout); resolve(); });
    }));
    const current = await surfaceState(page);
    const fontsLoaded = await page.evaluate(() => document.fonts.status === 'loaded');
    const differences = previous ? surfaceDifferences(previous, current) : ['initial print layout'];
    if (fontsLoaded && differences.length === 0) {
      stableFrames++;
      if (stableFrames >= 3 && Date.now() - stableSince >= 100) return;
    } else {
      stableSince = Date.now();
      stableFrames = 0;
      lastDifferences = differences;
    }
    previous = current;
  }
  throw new Error(`${label}: print layout did not stabilize with loaded fonts:\n${lastDifferences.join('\n')}`);
}

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    // Let each browser serialize the same explicit design value in its own syntax.
    const referencePage = await browser.newPage();
    await referencePage.setContent('<div id="reference" style="background-color:#04181B;background-image:radial-gradient(circle at 84% 18%,rgba(12,110,120,.16),transparent 34%),linear-gradient(142deg,#073338 0%,#05292E 56%,#04181B 100%);background-position:0% 0%;background-size:auto;background-repeat:no-repeat;background-blend-mode:normal"></div>');
    const expected = await referencePage.locator('#reference').evaluate(el => {
      const s = getComputedStyle(el);
      return { background: s.backgroundImage, color: s.backgroundColor, position: s.backgroundPosition, size: s.backgroundSize, repeat: s.backgroundRepeat, blend: s.backgroundBlendMode };
    });
    await referencePage.close();

    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      let heroCount = 0;
      let footerCount = 0;
      for (const file of pages) {
        const label = `${engineName}/${width}/${file}`;
        const response = await page.goto(`${base}/${file}`, { waitUntil: 'load' });
        const servedHTML = await response.text();
        await page.evaluate(() => document.fonts.ready);
        const loading = await page.evaluate(html => {
          // Runtime widgets may append their own styles; the served head controls release order.
          const servedDocument = new DOMParser().parseFromString(html, 'text/html');
          const servedLinks = [...servedDocument.querySelectorAll('link[rel="stylesheet"]')].filter(el => el.getAttribute('href')?.startsWith('brand-surfaces.css'));
          const last = [...servedDocument.head.querySelectorAll('link[rel="stylesheet"],style')].at(-1);
          return { count: servedLinks.length, last: servedLinks[0] === last, loaded: [...document.styleSheets].some(sheet => sheet.href?.includes('/brand-surfaces.css')) };
        }, servedHTML);
        check(loading.count === 1 && loading.last && loading.loaded, `${label}: shared brand stylesheet must load once, last in the head`);
        const heroes = await page.locator(heroSelector).count();
        const footers = await page.locator('footer.mond-footer').count();
        check(heroes === (footerOnly.has(file) ? 0 : 1), `${label}: inventoried hero coverage changed (${heroes})`);
        check(footers === (file === 'cross-tool-synthesis.html' ? 0 : 1), `${label}: site footer coverage changed (${footers})`);
        heroCount += heroes;
        footerCount += footers;
        for (const surface of await surfaceState(page)) {
          for (const key of Object.keys(expected)) check(surface[key] === expected[key], `${label}/${surface.selector}: ${key} differs from the shared gradient: ${surface[key]}`);
          for (const pseudo of surface.pseudos) check(pseudo.display === 'none' && pseudo.content === 'none' && pseudo.background === 'none', `${label}/${surface.selector}${pseudo.pseudo}: decorative overlay returned`);
        }
        const heroText = await page.locator(heroSelector).evaluateAll(roots => roots.flatMap(root =>
          [...root.querySelectorAll('h1,h2,h3,p,a,span,strong,small,b,label')].flatMap(el => {
            const box = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (!box.width || !box.height || style.visibility !== 'visible' || ![...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return [];
            const backgrounds = [];
            for (let ancestor = el; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
              const ancestorStyle = getComputedStyle(ancestor);
              const color = ancestorStyle.backgroundColor;
              const alpha = Number(color.match(/[\d.]+/g)?.[3] ?? 1);
              // The product preview and report cards retain their separate surfaces.
              if (ancestorStyle.backgroundImage !== 'none' || alpha >= .98) return [];
              if (alpha > 0) backgrounds.unshift(color);
            }
            const size = parseFloat(style.fontSize);
            const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
            return [{ text: el.textContent.trim(), color: style.color, backgrounds, minimum: large ? 3 : 4.5 }];
          })));
        for (const item of heroText) check(contrastOnBrand(item.color, item.backgrounds) >= item.minimum,
          `${label}: hero text contrast below${item.minimum}:1 for '${item.text.slice(0,55)}' (${contrastOnBrand(item.color, item.backgrounds).toFixed(2)})`);
        if (file === 'index.html') {
          const layers = await page.locator('.hero > .hero-scrim,.hero > .hero-media-wrap').evaluateAll(els => els.map(el => getComputedStyle(el).display));
          check(layers.length === 2 && layers.every(display => display === 'none'), `${label}: old homepage scrim still tints the shared gradient`);
        }
        if (footers) {
          const footer = page.locator('footer.mond-footer');
          // Instrument routes can keep their body hidden while authentication is unresolved.
          // Check the actual footer copy without altering that gate or treating hidden innerText as missing.
          check((await footer.locator('.mf-tagline').textContent()).replace(/\s+/g, ' ').trim() === tagline, `${label}: approved footer headline is missing`);
          check((await footer.locator('.mf-copy').textContent()).trim().length > 30, `${label}: footer explanation is empty`);
          const textColors = await footer.locator('.mf-tagline,.mf-copy,.mf-col-title,.mf-col a,.mf-copyright').evaluateAll(els => els.map(el => ({ text: el.textContent.trim(), color: getComputedStyle(el).color })));
          for (const item of textColors) check(contrastOnBrand(item.color) >= 4.5, `${label}: footer text contrast below4.5:1 for '${item.text.slice(0,42)}' (${contrastOnBrand(item.color).toFixed(2)})`);
        }
        if (file === 'cross-tool-synthesis.html') {
          const textColors = await page.locator('.hero h1,#pageDek').evaluateAll(els => els.map(el => getComputedStyle(el).color));
          check(textColors.length === 2 && textColors.every(color => contrastOnBrand(color) >= 4.5), `${label}: Synthesis hero text lost contrast`);
        }
        if (width === 1440 && printPages.has(file) && loading.loaded) {
          await page.emulateMedia({ media: 'print' });
          if (file === 'the-culture-trap-brief.html') await page.waitForFunction(() => getComputedStyle(document.querySelector('.publication-hero')).backgroundColor === 'rgb(255, 255, 255)', null, { timeout: 3000 });
          await waitForStablePrint(page, label);
          const media = await page.evaluate(() => {
            const sheet = [...document.styleSheets].find(sheet => sheet.href?.includes('/brand-surfaces.css'));
            return { print: matchMedia('print').matches, rules: [...sheet.cssRules].map(rule => rule.media?.mediaText ?? 'outside media') };
          });
          check(media.print && media.rules.length === 1 && media.rules[0] === 'screen', `${label}: brand declarations escaped screen-only isolation`);
          const print = await surfaceState(page, true);
          const disabledDifferences = surfaceDifferences(print.enabled, print.disabled);
          const restoredDifferences = surfaceDifferences(print.enabled, print.restored);
          check(disabledDifferences.length === 0, `${label}: disabling shared brand CSS changes printed surfaces or geometry:\n${disabledDifferences.join('\n')}`);
          check(restoredDifferences.length === 0, `${label}: restoring shared brand CSS changes printed surfaces or geometry:\n${restoredDifferences.join('\n')}`);
          await page.emulateMedia({ media: 'screen' });
        }
      }
      check(heroCount === 57 && footerCount === 62, `${engineName}/${width}: incomplete57hero/62footer coverage`);
      await page.close();
    }
  } finally { await browser.close(); }
}
assert.deepEqual(failures, [], `${failures.length} brand surface failures:\n${failures.join('\n')}`);
console.log(`Brand surface consistency smoke passed: ${checks} checks,57heroes+62footers,63pages at1440/390 in Chromium+WebKit; exact backgrounds, overlays, footer copy/contrast and print isolation.`);
