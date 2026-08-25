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
  { name: 'desktop-short', width: 1440, height: 835 },
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
        const root = el.querySelector('#monderman-depth-lure-composite');
        const card = el.querySelector('.md-tile');
        const panels = [...el.querySelectorAll('.md-opening,.md-panel,.md-action')];
        const foot = el.querySelector('.md-foot');
        const slide = el.closest('.slide');
        const hero = el.closest('.hero');
        const tileBox = el.getBoundingClientRect();
        const rootBox = root.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const slideBox = slide?.getBoundingClientRect();
        const heroBox = hero?.getBoundingClientRect();
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
          tileBottom: tileBox.bottom,
          heroTop: heroBox?.top ?? null,
          heroBottom: heroBox?.bottom ?? null,
          heroHeight: heroBox?.height ?? null,
          rootLeft: rootBox.left,
          rootRight: rootBox.right,
          footDisplay: getComputedStyle(foot).display,
          slideHeight: slideBox?.height ?? null,
          slideBottom: slideBox?.bottom ?? null,
          slideScrollHeight: slide?.scrollHeight ?? null,
          slideClientHeight: slide?.clientHeight ?? null,
          panelBoxes: panels.map((panel) => {
            const box = panel.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
          }),
          hasWrongRaster: !!el.querySelector('.sample-depth-tile-approved-image'),
          exposureRangeCount: el.querySelectorAll('.md-exposure-track').length,
          vantageRowCount: el.querySelectorAll('.md-vantage-row').length,
          actionText: el.querySelector('.md-action')?.textContent.replace(/\s+/g, ' ').trim(),
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: document.documentElement.clientHeight,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        };
      });

      assert.equal(geometry.display, 'block', `${placement.name}/${viewport.name}: sample tile is hidden`);
      assert.equal(geometry.linkDisplay, 'block', `${placement.name}/${viewport.name}: sample tile link is hidden`);
      assert(geometry.width > 260 && geometry.width <= 580.5, `${placement.name}/${viewport.name}: tile width is outside the approved seat: ${geometry.width}`);
      assert.equal(geometry.hasWrongRaster, false, `${placement.name}/${viewport.name}: superseded screenshot artifact returned`);
      assert.equal(geometry.exposureRangeCount, 2, `${placement.name}/${viewport.name}: source exposure composition changed`);
      assert.equal(geometry.vantageRowCount, 3, `${placement.name}/${viewport.name}: source vantage composition changed`);
      assert.equal(geometry.actionText, 'Fix the ownership transfer point. Then re-measure the same scope.', `${placement.name}/${viewport.name}: source leadership move changed`);
      assert.equal(geometry.footDisplay, 'none', `${placement.name}/${viewport.name}: redundant qualification footer returned`);
      assert(geometry.documentWidth <= geometry.viewportWidth + 1, `${placement.name}/${viewport.name}: page overflows horizontally`);
      assert(geometry.rootLeft >= geometry.cardLeft - 1 && geometry.rootRight <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: source component escapes the card horizontally`);
      for (const [index, panel] of geometry.panelBoxes.entries()) {
        assert(panel.left >= geometry.cardLeft - 1 && panel.right <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: panel ${index + 1} escapes the card horizontally (${JSON.stringify({ panel, card: { left: geometry.cardLeft, right: geometry.cardRight } })})`);
        assert(panel.top >= geometry.cardTop - 1 && panel.bottom <= geometry.cardBottom + 1, `${placement.name}/${viewport.name}: panel ${index + 1} is clipped vertically (${JSON.stringify({ panel, card: { top: geometry.cardTop, bottom: geometry.cardBottom } })})`);
      }
      if (viewport.name === 'desktop-short') {
        assert(geometry.cardHeight <= 620, `${placement.name}/${viewport.name}: compact report card is too tall (${geometry.cardHeight}px)`);
        if (placement.name === 'homepage') {
          assert(geometry.heroHeight <= geometry.viewportHeight + 2, `${placement.name}/${viewport.name}: hero exceeds one viewport after the bottom crop (${geometry.heroHeight}px > ${geometry.viewportHeight}px)`);
          assert(geometry.heroTop >= -1 && geometry.heroBottom <= geometry.viewportHeight + 2, `${placement.name}/${viewport.name}: hero crop boundary escapes the viewport`);
          assert(geometry.cardTop <= geometry.viewportHeight * 0.27, `${placement.name}/${viewport.name}: hero content remains vertically low (${geometry.cardTop}px)`);
          assert(geometry.tileBottom <= geometry.viewportHeight + 1, `${placement.name}/${viewport.name}: complete tile falls below the hero viewport (${geometry.tileBottom}px > ${geometry.viewportHeight}px)`);
        } else {
          assert(geometry.slideHeight <= geometry.viewportHeight + 2, `${placement.name}/${viewport.name}: report tile expands the snap slide (${geometry.slideHeight}px > ${geometry.viewportHeight}px)`);
          assert(geometry.slideScrollHeight <= geometry.slideClientHeight + 1, `${placement.name}/${viewport.name}: report tile creates internal slide overflow`);
          assert(geometry.tileBottom <= geometry.slideBottom + 1, `${placement.name}/${viewport.name}: report tile escapes its snap slide`);
        }
      }

      await tile.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`) });
      await page.close();
    }
  }
  console.log('sample report tile smoke: passed');
} finally {
  await browser.close();
}
