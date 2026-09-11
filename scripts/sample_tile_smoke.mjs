import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const out = process.env.TILE_OUT || '/tmp/sample-tile-smoke';
fs.mkdirSync(out, { recursive: true });
const artifact=JSON.parse(fs.readFileSync(new URL('../sample-data/production-diagnostic-samples.json',import.meta.url),'utf8'));
const source=artifact.outputs.depth_synthesis.source, exposure=source.pathway_exposure||source.compounded_exposure;

const browser = await chromium.launch({ headless: true });
const placements = [
  { name: 'homepage', route: '/index.html' },
  { name: 'platform-brief', route: '/Monderman_Platform_Brief.html' },
];
const viewports = [
  { name: 'narrow-mobile', width: 320, height: 844 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 900 },
  { name: 'collapse-seam', width: 1120, height: 900 },
  { name: 'desktop-seam', width: 1121, height: 900 },
  { name: 'desktop-short', width: 1440, height: 835 },
  { name: 'desktop', width: 1440, height: 1000 },
];

try {
  for (const placement of placements) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await page.goto(`${base}${placement.route}`, { waitUntil: 'networkidle', timeout: 90000 });

      const tile = page.locator('.hero-report-proof.has-sample-depth-tile');
      await tile.waitFor({ state: 'attached', timeout: 10000 });
      if (await tile.isVisible()) {
        await tile.scrollIntoViewIfNeeded();
        await page.waitForFunction(el => {
          for (let node=el;node;node=node.parentElement) {
            const style=getComputedStyle(node);
            if (Number(style.opacity)<.99 || style.visibility==='hidden') return false;
          }
          return true;
        }, await tile.elementHandle());
      }
      assert.equal(await tile.locator('.hero-report-link').getAttribute('href'), 'sample-report.html#depth', `${placement.name}/${viewport.name}: whole-card sample route changed`);
      assert.equal(await tile.getAttribute('data-artifact-sha256'),artifact.artifact_sha256);

      const geometry = await tile.evaluate((el) => {
        const root = el.querySelector('#monderman-depth-lure-composite');
        const card = el.querySelector('.md-tile');
        const panels = [...el.querySelectorAll('.md-opportunity,.md-economics,.md-score-summary,.md-action,.md-basis')];
        const foot = el.querySelector('.md-basis');
        const slide = el.closest('.slide');
        const hero = el.closest('.hero');
        const outputBand = el.closest('#sample-output');
        const heroRouteField = hero?.querySelector('.hero-route-field');
        const tileBox = el.getBoundingClientRect();
        const rootBox = root.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const slideBox = slide?.getBoundingClientRect();
        const heroBox = hero?.getBoundingClientRect();
        const tileStyle = getComputedStyle(el);
        const link = el.querySelector('.hero-report-link');
        const linkStyle = getComputedStyle(link);
        return {
          display: getComputedStyle(el).display,
          visibility: tileStyle.visibility,
          opacity: Number(tileStyle.opacity),
          linkDisplay: linkStyle.display,
          linkVisibility: linkStyle.visibility,
          linkOpacity: Number(linkStyle.opacity),
          linkPointerEvents: linkStyle.pointerEvents,
          left: tileBox.left,
          right: tileBox.right,
          width: tileBox.width,
          height: tileBox.height,
          cardWidth: cardBox.width,
          cardHeight: cardBox.height,
          cardLeft: cardBox.left,
          cardRight: cardBox.right,
          cardTop: cardBox.top,
          cardDocumentTop: cardBox.top + window.scrollY,
          cardBottom: cardBox.bottom,
          tileBottom: tileBox.bottom,
          heroTop: heroBox?.top ?? null,
          heroBottom: heroBox?.bottom ?? null,
          heroHeight: heroBox?.height ?? null,
          inOutputBand: !!outputBand,
          outputBottom: outputBand?.getBoundingClientRect().bottom ?? null,
          hasHeroRouteField: !!heroRouteField,
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
          recovery: el.querySelector('[data-promo-recovery]')?.textContent,
          cost: el.querySelector('[data-promo-cost]')?.textContent,
          hours: el.querySelector('[data-promo-hours]')?.textContent,
          actionText: el.querySelector('.md-action p')?.textContent,
          qualification: el.querySelector('.md-opportunity p')?.textContent,
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: document.documentElement.clientHeight,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        };
      });

      const intentionallyHidden = placement.name === 'homepage'
        ? viewport.width <= 1120
        : viewport.width <= 640;
      if (intentionallyHidden) {
        assert.equal(geometry.display, 'none', `${placement.name}/${viewport.name}: compact layout still shows the large sample tile`);
        assert.equal(geometry.height, 0, `${placement.name}/${viewport.name}: hidden sample tile still reserves vertical space`);
        await page.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`), fullPage: false });
        await page.close();
        continue;
      }

      assert.equal(geometry.display, 'block', `${placement.name}/${viewport.name}: sample tile is hidden`);
      assert.equal(geometry.linkDisplay, 'block', `${placement.name}/${viewport.name}: sample tile link is hidden`);
      assert(geometry.width > 260 && geometry.width <= 580.5, `${placement.name}/${viewport.name}: tile width is outside the approved seat: ${geometry.width}`);
      assert.equal(geometry.hasWrongRaster, false, `${placement.name}/${viewport.name}: superseded screenshot artifact returned`);
      assert.equal(geometry.recovery,'$'+exposure.recoverable_cost.toLocaleString('en-US'));
      assert.equal(geometry.cost,'$'+exposure.annual_cost.toLocaleString('en-US'));
      assert.equal(geometry.hours,exposure.annual_hours.toLocaleString('en-US')+' hours');
      assert.equal(geometry.actionText,source.ai_report.report.interpretation.recommendations.find(a=>a.action?.trim()).action);
      assert.match(geometry.qualification,/Median of submitted recovery scenarios.*Before subscription and implementation costs; not guaranteed savings/);
      assert.notEqual(geometry.footDisplay, 'none', `${placement.name}/${viewport.name}: sample and aggregation qualification hidden`);
      assert(geometry.documentWidth <= geometry.viewportWidth + 1, `${placement.name}/${viewport.name}: page overflows horizontally`);
      assert(geometry.rootLeft >= geometry.cardLeft - 1 && geometry.rootRight <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: source component escapes the card horizontally`);
      for (const [index, panel] of geometry.panelBoxes.entries()) {
        assert(panel.left >= geometry.cardLeft - 1 && panel.right <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: panel ${index + 1} escapes the card horizontally (${JSON.stringify({ panel, card: { left: geometry.cardLeft, right: geometry.cardRight } })})`);
        assert(panel.top >= geometry.cardTop - 1 && panel.bottom <= geometry.cardBottom + 1, `${placement.name}/${viewport.name}: panel ${index + 1} is clipped vertically (${JSON.stringify({ panel, card: { top: geometry.cardTop, bottom: geometry.cardBottom } })})`);
      }
      if (viewport.name === 'desktop-short') {
        assert(geometry.cardHeight <= 620, `${placement.name}/${viewport.name}: compact report card is too tall (${geometry.cardHeight}px)`);
        if (placement.name === 'homepage') {
          assert.equal(geometry.heroHeight, null, `${placement.name}/${viewport.name}: report unexpectedly returned to the product hero`);
          assert.equal(geometry.inOutputBand, true, `${placement.name}/${viewport.name}: report lost its dedicated output section`);
          assert(geometry.cardDocumentTop > geometry.viewportHeight * 0.5, `${placement.name}/${viewport.name}: report is competing with the opening product preview`);
          assert(geometry.tileBottom <= geometry.outputBottom + 1, `${placement.name}/${viewport.name}: report escapes its output section`);
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
