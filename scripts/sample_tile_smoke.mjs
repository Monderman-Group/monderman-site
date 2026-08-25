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
  { name: 'narrow-mobile', width: 320, height: 844, expectedColumns: 2 },
  { name: 'mobile', width: 390, height: 844, expectedColumns: 2 },
  { name: 'tablet', width: 768, height: 1024, expectedColumns: 2 },
  { name: 'tablet-landscape', width: 1024, height: 900, expectedColumns: 2 },
  { name: 'desktop', width: 1440, height: 1000, expectedColumns: 2 },
];

try {
  for (const placement of placements) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${base}${placement.route}`, { waitUntil: 'networkidle', timeout: 90000 });

      const tile = page.locator('.hero-report-proof.has-sample-depth-tile');
      await tile.waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await tile.locator('.hero-report-link').getAttribute('href'), 'sample-report.html', `${placement.name}/${viewport.name}: whole-card sample route changed`);

      const geometry = await tile.evaluate((el, expectedColumns) => {
        const card = el.querySelector('.sample-depth-tile');
        const exposure = el.querySelector('.sdt-exposure-grid');
        const panels = [...el.querySelectorAll('.sdt-opening,.sdt-panel,.sdt-action,.sdt-foot')];
        const tileBox = el.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const panelBoxes = panels.map(panel => {
          const box = panel.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        });
        const columns = getComputedStyle(exposure).gridTemplateColumns.split(' ').filter(Boolean).length;
        return {
          expectedColumns,
          columns,
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
          panelBoxes,
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        };
      }, viewport.expectedColumns);

      assert.equal(geometry.display, 'block', `${placement.name}/${viewport.name}: sample tile is hidden`);
      assert.equal(geometry.linkDisplay, 'block', `${placement.name}/${viewport.name}: sample tile link is hidden`);
      assert.equal(geometry.columns, geometry.expectedColumns, `${placement.name}/${viewport.name}: exposure ranges do not reflow as specified`);
      assert(geometry.width > 300 && geometry.width <= 540.5, `${placement.name}/${viewport.name}: tile width is outside the approved seat: ${geometry.width}`);
      assert(geometry.cardHeight > 490 && geometry.cardHeight < 620, `${placement.name}/${viewport.name}: tile height is distorted: ${geometry.cardHeight}`);
      assert(geometry.documentWidth <= geometry.viewportWidth + 1, `${placement.name}/${viewport.name}: page overflows horizontally`);
      for (const [index, panel] of geometry.panelBoxes.entries()) {
        assert(panel.left >= geometry.cardLeft - 1 && panel.right <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: panel ${index + 1} escapes the card horizontally`);
        assert(panel.top >= geometry.cardTop - 1 && panel.bottom <= geometry.cardBottom + 1, `${placement.name}/${viewport.name}: panel ${index + 1} is clipped vertically`);
      }

      await tile.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`) });
      await page.close();
    }
  }
  console.log('sample report tile smoke: passed');
} finally {
  await browser.close();
}
