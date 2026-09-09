import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8765';
const out = process.env.ORDINARY_PRINT_OUT || '/tmp/monderman-ordinary-print';
const surfaces = [
  'index.html',
  'about.html',
  'research.html',
  'platform-services.html',
  'from-tokens-to-outcomes.html',
];

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest = {};
async function emulateMediaAndSettle(page, media) {
  await page.emulateMedia({ media });
  await page.waitForFunction(mode => matchMedia(mode).matches, media);
  // Wait for the requested print styles before checking visibility and geometry.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

try {
  for (const pageName of surfaces) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/${pageName}`, { waitUntil: 'networkidle', timeout: 30000 });
    await emulateMediaAndSettle(page, 'print');
    const state = await page.evaluate(() => {
      const display = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).display : 'absent';
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        header: display('.header'),
        footer: display('.mond-footer'),
        menu: display('.site-menu-button'),
        assistant: display('#mnd-launcher'),
        connect: display('.mdn-cn-launch'),
        carouselDots: display('.latest-dots'),
        visibleCarouselClones: [...document.querySelectorAll('.latest-track .is-carousel-clone')]
          .filter((element) => getComputedStyle(element).display !== 'none').length,
        leadingText: document.body.innerText.trim().slice(0, 120),
      };
    });
    assert.ok(state.scrollWidth <= state.clientWidth + 1,
      `${pageName}: print media overflows horizontally (${state.scrollWidth} > ${state.clientWidth})`);
    assert.equal(state.header, 'none', `${pageName}: header is visible in print`);
    assert.equal(state.footer, 'none', `${pageName}: footer is visible in print`);
    assert.equal(state.menu, 'none', `${pageName}: menu button is visible in print`);
    assert.ok(['none', 'absent'].includes(state.assistant), `${pageName}: assistant launcher is visible in print`);
    assert.ok(['none', 'absent'].includes(state.connect), `${pageName}: Connect launcher is visible in print`);
    assert.ok(!state.leadingText.startsWith('Warning:') && !state.leadingText.startsWith('Total output lines:'),
      `${pageName}: tool output precedes printed content`);
    if (pageName === 'index.html') {
      assert.equal(state.carouselDots, 'none', 'index.html: carousel dots are visible in print');
      assert.equal(state.visibleCarouselClones, 0, 'index.html: carousel clones duplicate printed content');
    }

    const outputName = pageName.replace(/\.html$/, '.pdf');
    const outputPath = path.join(out, outputName);
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    manifest[pageName] = { pdf: outputName, mediaState: state };
    await page.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`ORDINARY_PAGE_PRINT_RENDER_PASS (${surfaces.length} customer-facing surfaces)`);
