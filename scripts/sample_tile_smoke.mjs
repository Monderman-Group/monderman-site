import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const out = process.env.TILE_OUT || '/tmp/sample-tile-smoke';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const placements = [
  { name: 'homepage', route: '/index.html' },
  { name: 'platform-brief', route: '/Monderman_Platform_Brief.html' },
];
const viewports = [
  { name: 'narrow-mobile', width: 320, height: 844 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
];

try {
  for (const placement of placements) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${base}${placement.route}`, { waitUntil: 'networkidle', timeout: 90000 });

      const tile = page.locator('.hero-report-proof.has-sample-depth-tile');
      await tile.waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await tile.locator('.hero-report-link').getAttribute('href'), 'sample-report.html', `${placement.name}/${viewport.name}: whole-card sample route changed`);

      const geometry = await tile.evaluate((el) => {
        const card = el.querySelector('.sample-depth-tile-approved');
        const image = el.querySelector('.sample-depth-tile-approved-image');
        const tileBox = el.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const imageBox = image.getBoundingClientRect();
        return {
          display: getComputedStyle(el).display,
          linkDisplay: getComputedStyle(el.querySelector('.hero-report-link')).display,
          width: tileBox.width,
          height: tileBox.height,
          cardWidth: cardBox.width,
          cardHeight: cardBox.height,
          cardLeft: cardBox.left,
          cardRight: cardBox.right,
          cardTop: cardBox.top,
          cardBottom: cardBox.bottom,
          imageLeft: imageBox.left,
          imageRight: imageBox.right,
          imageTop: imageBox.top,
          imageBottom: imageBox.bottom,
          imageComplete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          source: image.getAttribute('src'),
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        };
      });

      assert.equal(geometry.display, 'block', `${placement.name}/${viewport.name}: sample tile is hidden`);
      assert.equal(geometry.linkDisplay, 'block', `${placement.name}/${viewport.name}: sample tile link is hidden`);
      assert(geometry.width > 260 && geometry.width <= 540.5, `${placement.name}/${viewport.name}: tile width is outside the approved seat: ${geometry.width}`);
      assert.equal(geometry.imageComplete, true, `${placement.name}/${viewport.name}: approved rendering did not load`);
      assert.equal(geometry.naturalWidth, 940, `${placement.name}/${viewport.name}: approved rendering width changed`);
      assert.equal(geometry.naturalHeight, 936, `${placement.name}/${viewport.name}: approved rendering height changed`);
      assert.equal(geometry.source, 'assets/report/sample-depth-synthesis-composite-approved.png?v=20260824-approved1', `${placement.name}/${viewport.name}: approved rendering source changed`);
      assert(Math.abs((geometry.cardWidth / geometry.cardHeight) - (940 / 936)) < 0.002, `${placement.name}/${viewport.name}: approved composition aspect ratio changed`);
      assert(geometry.documentWidth <= geometry.viewportWidth + 1, `${placement.name}/${viewport.name}: page overflows horizontally`);
      assert(geometry.imageLeft >= geometry.cardLeft - 1 && geometry.imageRight <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: approved rendering escapes the card horizontally`);
      assert(geometry.imageTop >= geometry.cardTop - 1 && geometry.imageBottom <= geometry.cardBottom + 1, `${placement.name}/${viewport.name}: approved rendering is clipped vertically`);

      await tile.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`) });
      await page.close();
    }
  }
  console.log('sample report tile smoke: passed');
} finally {
  await browser.close();
}
