import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const localOrigin = new URL(base).origin;

// This manifest explicitly covers every enterprise-styled public hero. The
// separately protected legal documents and their dated snapshots intentionally
// remain under the legal-integrity suite instead of this presentation suite.
const heroPages = [
  ['about.html', '.hero', '.hero h1', 'standard'],
  ['accumulated-drag-department-of-war.html', '.article-hero', '.article-hero h1', 'publication-md'],
  ['after-a-reorganization.html', '.hero', '.hero h1', 'standard'],
  ['after-an-acquisition.html', '.hero', '.hero h1', 'standard'],
  ['built-to-please.html', '.article-hero', '.article-hero h1', 'publication'],
  ['compensatory-systems.html', '.article-hero', '.article-hero h1', 'publication'],
  ['connect.html', '.hero', '.hero h1', 'standard'],
  ['decision-velocity-article.html', '.hero', '.hero h1', 'publication'],
  ['designing-for-decision-velocity.html', '.hero', '.hero h1', 'publication'],
  ['deterministic-ai-infrastructure.html', '.ps-hero', '.ps-hero h1', 'publication'],
  ['diagnostics.html', '.hero', '.hero h1', 'standard'],
  ['every-node-for-itself.html', '.article-hero', '.article-hero h1', 'publication'],
  ['from-tokens-to-outcomes.html', '.article-hero', '.article-hero h1', 'publication'],
  ['governing-complexity.html', '.hero', '.hero h1', 'publication'],
  ['index.html', '.hero', '.hero h1', 'home'],
  ['institutional-performance-article.html', '.hero', '.hero h1', 'publication'],
  ['merit-after-the-machine.html', '.article-hero', '.article-hero h1', 'publication'],
  ['Monderman_Platform_Brief.html', '.cover', '.cover h1', 'standard'],
  ['new-in-the-role.html', '.hero', '.hero h1', 'standard'],
  ['operational-systems-article.html', '.hero', '.hero h1', 'publication'],
  ['pilot.html', '.hero', '.hero h1', 'standard'],
  ['plan-enterprise.html', '.pl-top', '.pl-top h1', 'standard'],
  ['plan-pattern.html', '.pl-top', '.pl-top h1', 'standard'],
  ['plan-signal.html', '.pl-top', '.pl-top h1', 'standard'],
  ['platform-services.html', '.ps-hero', '.ps-hero h1', 'standard'],
  ['quarter-trillion-friction-us-healthcare.html', '.article-hero', '.article-hero h1', 'publication-long'],
  ['research.html', '.hero', '.hero h1', 'standard'],
  ['roi.html', '.hero', '.hero h1', 'standard'],
  ['security.html', '.hero', '.hero h1', 'standard'],
  ['structural-clarity-article.html', '.hero', '.hero h1', 'publication'],
  ['subprocessors.html', '.hero', '.hero h1', 'standard'],
  ['terminal-fidelity.html', '.article-hero', '.article-hero h1', 'publication'],
  ['the-art-of-interior-reasoning.html', '.article-hero', '.article-hero h1', 'publication'],
  ['the-culture-trap-brief.html', '.article-hero', '.article-hero h1', 'publication'],
  ['the-culture-trap.html', '.hero', '.hero h1', 'publication'],
  ['the-drift-problem.html', '.hero', '.hero h1', 'publication'],
  ['the-unmeasured-layer.html', '.article-hero', '.article-hero h1', 'publication'],
  ['transformation-behind-schedule.html', '.hero', '.hero h1', 'standard'],
  ['we-gave-bureaucracy-the-fastest-tools.html', '.article-hero', '.article-hero h1', 'publication-long'],
  ['when-bureaucracy-became-the-obstacle.html', '.article-hero', '.article-hero h1', 'publication'],
  ['why-monderman.html', '.hero', '.hero h1', 'standard'],
];

assert.equal(heroPages.length, 41, 'hero manifest changed unexpectedly');
const legalPresentationExclusions = new Set(['privacy.html', 'terms.html']);
const heroClassTokens = new Set(['hero', 'ps-hero', 'article-hero', 'pl-top']);
function hasPageHero(pageName) {
  if (pageName === 'Monderman_Platform_Brief.html') return true;
  const source = fs.readFileSync(pageName, 'utf8');
  return [...source.matchAll(/class=["']([^"']+)["']/g)].some((match) =>
    match[1].trim().split(/\s+/).some((className) => heroClassTokens.has(className)));
}

const sitemapHeroPages = [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((match) => new URL(match[1]).pathname.split('/').pop() || 'index.html')
  .filter((pageName) => fs.existsSync(pageName))
  .filter((pageName) => !legalPresentationExclusions.has(pageName))
  .filter(hasPageHero);
const repositoryHeroPages = fs.readdirSync('.')
  .filter((pageName) => pageName.endsWith('.html'))
  .filter((pageName) => !legalPresentationExclusions.has(pageName))
  .filter((pageName) => fs.readFileSync(pageName, 'utf8').includes('enterprise-site.css?'))
  .filter(hasPageHero);
const manifestedHeroPages = [...new Set(heroPages.map(([pageName]) => pageName))].sort();
assert.deepEqual(
  manifestedHeroPages,
  [...new Set(sitemapHeroPages)].sort(),
  'hero manifest must cover every non-legal public hero page in the sitemap',
);
assert.deepEqual(
  manifestedHeroPages,
  [...new Set(repositoryHeroPages)].sort(),
  'hero manifest must cover every enterprise-styled hero page in the repository',
);
for (const [pageName] of heroPages) {
  assert.ok(fs.existsSync(pageName), `${pageName}: expected public page is missing`);
  const source = fs.readFileSync(pageName, 'utf8');
  assert.ok(source.includes('enterprise-site.css?'), `${pageName}: shared enterprise stylesheet is missing`);
}

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 960, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
];

const pagesWithLocalOpeningAction = new Set([
  'accumulated-drag-department-of-war.html',
  'after-the-first-lap.html',
  'built-to-please.html',
  'compensatory-systems.html',
  'connect.html',
  'decision-velocity-article.html',
  'designing-for-decision-velocity.html',
  'deterministic-ai-infrastructure.html',
  'diagnostics.html',
  'every-node-for-itself.html',
  'from-tokens-to-outcomes.html',
  'governing-complexity.html',
  'index.html',
  'institutional-performance-article.html',
  'merit-after-the-machine.html',
  'operational-systems-article.html',
  'pilot.html',
  'platform-services.html',
  'quarter-trillion-friction-us-healthcare.html',
  'roi.html',
  'structural-clarity-article.html',
  'terminal-fidelity.html',
  'the-art-of-interior-reasoning.html',
  'the-culture-trap-brief.html',
  'the-drift-problem.html',
  'the-unmeasured-layer.html',
  'we-gave-bureaucracy-the-fastest-tools.html',
  'when-bureaucracy-became-the-obstacle.html',
  'why-monderman.html',
]);

assert.equal(pagesWithLocalOpeningAction.size, 29, 'opening-action manifest changed unexpectedly');

function expectedGutter(width) {
  if (width <= 640) return 20;
  return Math.min(56, Math.max(20, width * .04));
}

function clamp(minimum, fluid, maximum) {
  return Math.min(maximum, Math.max(minimum, fluid));
}

function standardTitleSize(width) {
  if (width <= 640) return clamp(36, width * .1, 42);
  if (width <= 960) return clamp(40, width * .055, 48);
  return clamp(48, width * .04, 56);
}

function expectedTitleSize(width, kind) {
  if (kind === 'home') {
    if (width <= 640) return clamp(36, width * .1, 42);
    if (width <= 980) return clamp(38, width * .048, 46);
    return clamp(42, width * .032, 48);
  }
  if (kind === 'publication-md') {
    if (width <= 540) return clamp(33.6, width * .088, 38.4);
    if (width <= 960) return clamp(38.4, width * .052, 45.6);
    return clamp(44, width * .037, 52);
  }
  if (kind === 'publication-long') {
    if (width <= 540) return clamp(31.2, width * .08, 36);
    if (width <= 960) return clamp(35.2, width * .048, 42.4);
    return clamp(37.6, width * .032, 48);
  }
  if (kind === 'publication' && width <= 540) {
    return clamp(35.2, width * .094, 40.8);
  }
  return standardTitleSize(width);
}

function expectedRailX(width) {
  return Math.max(0, (width - 1320) / 2) + expectedGutter(width);
}

const sectionHeadingContracts = new Map([
  ['index.html', {
    selector: '#approach-title',
    expectedSize: (width) => clamp(32, width * .027, 42.4),
  }],
  ['research.html', {
    selector: '#ai-institutions-title',
    expectedSize: (width) => width <= 640
      ? clamp(32, width * .09, 39.2)
      : clamp(33.6, width * .031, 44),
  }],
  ['platform-services.html', {
    selector: '.ps-section .ps-h2',
    expectedSize: (width) => clamp(32, width * .024, 44),
  }],
]);

async function localPage(browser, viewport) {
  const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  return page;
}

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const [pageName, heroSelector, titleSelector, kind] of heroPages) {
        const page = await localPage(browser, viewport);
        await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(220);

        const geometry = await page.evaluate(({ heroSelector, titleSelector }) => {
          const hero = document.querySelector(heroSelector);
          const title = document.querySelector(titleSelector);
          if (!hero || !title) return { missing: true };
          const heroBox = hero.getBoundingClientRect();
          const titleBox = title.getBoundingClientRect();
          const titleStyle = getComputedStyle(title);
          return {
            missing: false,
            heroHeight: heroBox.height,
            titleX: titleBox.x,
            titleFont: Number(titleStyle.fontSize.replace('px', '')),
            titleAlign: titleStyle.textAlign,
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            strongPrimaries: [...new Set([
              ...document.querySelectorAll('#siteHeader a, #siteHeader button'),
              ...hero.querySelectorAll('a, button'),
            ])]
              .filter((node) => {
                const box = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
                if (box.width < 1 || box.height < 1 || box.bottom <= 0 || box.top >= innerHeight) return false;
                return ['rgb(255, 255, 255)', 'rgb(201, 130, 31)', 'rgb(12, 110, 120)', 'rgb(169, 208, 212)'].includes(style.backgroundColor);
              })
              .map((node) => (node.textContent || node.getAttribute('aria-label') || '').trim()),
          };
        }, { heroSelector, titleSelector });

        const label = `${browserName}/${viewport.width}/${pageName}`;
        assert.equal(geometry.missing, false, `${label}: hero or title is missing`);
        assert.ok(Math.abs(geometry.titleX - expectedRailX(geometry.clientWidth)) <= 2.5,
          `${label}: title is off the common rail (${geometry.titleX}px)`);
        assert.ok(Math.abs(geometry.titleFont - expectedTitleSize(viewport.width, kind)) <= .35,
          `${label}: title scale diverged (${geometry.titleFont}px; expected ${expectedTitleSize(viewport.width, kind)}px)`);
        assert.ok(['start', 'left'].includes(geometry.titleAlign),
          `${label}: title alignment is ${geometry.titleAlign}`);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1,
          `${label}: page overflows horizontally (${geometry.scrollWidth}px > ${geometry.clientWidth}px)`);
        assert.ok(geometry.strongPrimaries.length <= 1,
          `${label}: competing filled opening actions (${geometry.strongPrimaries.join(' | ')})`);
        if (viewport.width >= 1280 || pagesWithLocalOpeningAction.has(pageName)) {
          assert.equal(geometry.strongPrimaries.length, 1,
            `${label}: opening view does not have one clear filled action`);
        }

        if (kind !== 'home') {
          if (viewport.width > 960) {
            assert.ok(geometry.heroHeight >= 500 && geometry.heroHeight <= 650,
              `${label}: desktop hero height is outside the shared band (${geometry.heroHeight}px)`);
          } else {
            const maximum = kind.startsWith('publication') ? 1000 : 850;
            assert.ok(geometry.heroHeight >= 240 && geometry.heroHeight <= maximum,
              `${label}: responsive hero height is implausible (${geometry.heroHeight}px)`);
          }
        }

        if (pageName === 'index.html' && viewport.width <= 980) {
          const columns = await page.locator('.hero > .hero-inner').evaluate((node) =>
            getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
          assert.equal(columns, 1, `${label}: homepage hero did not collapse to one column`);
        }

        if (pageName === 'Monderman_Platform_Brief.html') {
          const cover = await page.locator('.cover').evaluate((node) => ({
            backgroundImage: getComputedStyle(node).backgroundImage,
            height: node.getBoundingClientRect().height,
          }));
          assert.ok(!cover.backgroundImage.includes('url('), `${label}: removed cover image still renders`);
          if (viewport.width === 1280) {
            assert.ok(cover.height <= 600, `${label}: cover remains an oversized full-screen hero (${cover.height}px)`);
          }
        }

        const sectionContract = sectionHeadingContracts.get(pageName);
        if (sectionContract) {
          const sectionHeading = await page.locator(sectionContract.selector).first().evaluate((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return {
              font: Number(style.fontSize.replace('px', '')),
              align: style.textAlign,
              left: box.left,
              right: box.right,
              clientWidth: document.documentElement.clientWidth,
            };
          });
          const expected = sectionContract.expectedSize(viewport.width);
          assert.ok(Math.abs(sectionHeading.font - expected) <= .35,
            `${label}: representative section heading scale diverged (${sectionHeading.font}px; expected ${expected}px)`);
          assert.ok(['start', 'left'].includes(sectionHeading.align),
            `${label}: representative section heading alignment is ${sectionHeading.align}`);
          assert.ok(sectionHeading.left >= -1 && sectionHeading.right <= sectionHeading.clientWidth + 1,
            `${label}: representative section heading overflows its viewport`);
        }

        await page.close();
      }

      for (const pageName of ['research.html', 'pilot.html']) {
        const page = await localPage(browser, viewport);
        await page.goto(`${base}/${pageName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(260);
        const footer = await page.evaluate(() => {
          const bottom = document.querySelector('.mf-bottom');
          const motif = document.querySelector('.mf-motif');
          if (!bottom || !motif) return { missing: true };
          const bottomBox = bottom.getBoundingClientRect();
          const motifBox = motif.getBoundingClientRect();
          const rule = getComputedStyle(bottom, '::before');
          const px = (value) => Number(value.replace('px', ''));
          const ruleRight = bottomBox.x + px(rule.left) + px(rule.width);
          return { missing: false, gap: motifBox.x - ruleRight };
        });
        const label = `${browserName}/${viewport.width}/${pageName}/footer`;
        assert.equal(footer.missing, false, `${label}: footer mark or rule is missing`);
        assert.ok(footer.gap >= 90, `${label}: rule does not stop clearly before the folded-map mark (${footer.gap}px gap)`);
        await page.close();
      }
    }

    const pricing = await localPage(browser, { width: 1280, height: 900 });
    await pricing.goto(`${base}/platform-services.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const contrast = await pricing.evaluate(() => {
      const parse = (value) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) throw new Error(`Unsupported color: ${value}`);
        const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
      };
      const composite = (front, back) => {
        const alpha = front.a + back.a * (1 - front.a);
        return {
          r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
          g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
          b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
          a: alpha,
        };
      };
      const effectiveBackground = (element) => {
        const chain = [];
        for (let node = element; node; node = node.parentElement) chain.unshift(node);
        return chain.reduce((background, node) =>
          composite(parse(getComputedStyle(node).backgroundColor), background),
        { r: 255, g: 255, b: 255, a: 1 });
      };
      const luminance = ({ r, g, b }) => {
        const channel = (value) => {
          const normalized = value / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        };
        return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
      };
      const style = (selector) => {
        const element = document.querySelector(selector);
        const computed = getComputedStyle(element);
        const background = effectiveBackground(element);
        const foreground = composite(parse(computed.color), background);
        const light = Math.max(luminance(foreground), luminance(background));
        const dark = Math.min(luminance(foreground), luminance(background));
        return {
          color: computed.color,
          background: computed.backgroundColor,
          effectiveBackground: background,
          ratio: (light + .05) / (dark + .05),
        };
      };
      return {
        band: style('.ps-section.ps-roi'),
        heading: style('.ps-section.ps-roi .ps-h2'),
        introduction: style('.ps-section.ps-roi .ps-sub'),
        cardCopy: style('.ps-section.ps-roi .ps-roi-card .l'),
        note: style('.ps-section.ps-roi .ps-roi-note'),
        noteLink: style('.ps-section.ps-roi .ps-roi-note a'),
      };
    });
    assert.equal(contrast.band.background, 'rgb(7, 51, 56)', `${browserName}: pricing evidence band lost its dark surface`);
    assert.equal(contrast.heading.color, 'rgb(255, 255, 255)', `${browserName}: pricing evidence heading lost contrast`);
    assert.ok(contrast.heading.ratio >= 3, `${browserName}: pricing evidence heading contrast is ${contrast.heading.ratio}`);
    for (const key of ['introduction', 'cardCopy', 'note', 'noteLink']) {
      assert.ok(contrast[key].ratio >= 4.5,
        `${browserName}: ${key} contrast is only ${contrast[key].ratio}`);
    }
    assert.equal(contrast.noteLink.color, 'rgb(191, 224, 227)', `${browserName}: pricing evidence link lost contrast`);
    await pricing.close();
  } finally {
    await browser.close();
  }
}

console.log(`SITE_SYSTEM_VISUAL_PASS (${heroPages.length} hero pages, ${viewports.length} widths, 2 browsers; single-primary hierarchy, footer, and pricing contrast verified)`);
