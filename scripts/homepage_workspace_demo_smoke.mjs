import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const root = path.resolve(import.meta.dirname, '..');
const {artifact} = readPublicSampleFixture({root});
const source = artifact.outputs.cross_lens_synthesis.source;
const scenario = source.financial_scenario;
const whole = n=>n.toLocaleString('en-US',{maximumFractionDigits:0});
const money = n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});

const out = process.env.HOME_DEMO_OUT;
if (out) fs.mkdirSync(out, { recursive: true });
for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const width of [320, 390, 768, 1120, 1121, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      // Public preview validation must not interact with production services.
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await page.goto(`${base}/index.html`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const app = page.locator('[data-workspace-demo]');
      assert.equal(await app.count(), 1);
      const substantiveSizes = await app.locator('.hwd-description,.hwd-chart-row,.hwd-action-card p,.hwd-return-note p').evaluateAll(items => items.map(el => parseFloat(getComputedStyle(el).fontSize)));
      assert.ok(substantiveSizes.every(size => size >= 12), `${name}/${width}: substantive preview copy falls below 12px`);
      assert.equal(await app.locator('[data-demo-hours]').textContent(),whole(scenario.totals.potentialHoursFreed.central));
      assert.equal(await app.locator('[data-demo-capacity]').textContent(),money(scenario.totals.capacityValue.central));
      assert.equal(await app.locator('[data-demo-cost]').textContent(),money(scenario.totals.totalImplementationAndSubscriptionCost.central));
      for (const group of source.source_groups) assert.equal(await app.locator('[data-demo-lens="'+group.tool_type+'"]').textContent(),whole(group.median_score)+' / 100');
      assert.equal(await app.locator('.hwd-action-card p').textContent(),scenario.inputs.activities.find(a=>a.changeBasis?.trim()).changeBasis);
      assert.equal(await app.locator('[data-demo-score]').count(),0,'No single-run score is relabeled as organizational money');
      assert.match(await app.textContent(), /Capacity value is not cash savings/);
      assert.equal(await page.locator('.home-workspace-preview').getAttribute('data-artifact-sha256'),artifact.artifact_sha256);
      assert.equal(await page.locator('.home-preview-label span:last-child').textContent(), 'Illustrative example');
      assert.equal(await page.locator('.home-preview-caption').textContent(), 'Combine organizational evidence, evaluate a practical opportunity and track the result.');
      assert.match(await page.locator('.home-preview-method').textContent(), /The low case shows -\$27,638/);
      const expected = ['measure', 'analysis', 'actions', 'return'];
      const heights = [];
      for (const id of expected) {
        await app.locator(`#hwd-tab-${id}`).click();
        const panel = app.locator(`#hwd-panel-${id}`);
        assert.equal(await panel.isVisible(), true);
        assert.equal(await app.locator('[role="tabpanel"]:visible').count(), 1);
        assert.equal(await app.locator('[role="tab"][aria-selected="true"]').count(), 1);
        assert.equal(await app.locator('[role="tab"][tabindex="0"]').count(), 1);
        const geometry = await panel.evaluate(el => {
          const app = el.closest('[data-workspace-demo]').getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            height: el.getBoundingClientRect().height,
            escaping: [...el.querySelectorAll('*')].filter(item => {
              const box = item.getBoundingClientRect();
              return box.width && (box.left < app.left - 1 || box.right > app.right + 1);
            }).map(item => item.className),
          };
        });
        assert.ok(geometry.overflow <= 1, `${name}/${width}/${id}: horizontal overflow`);
        assert.deepEqual(geometry.escaping, [], `${name}/${width}/${id}: preview content escapes card`);
        heights.push(geometry.height);
        if (out && [390, 1440].includes(width)) await page.locator('.home-workspace-preview').screenshot({path:path.join(out, `${name}-${width}-${id}.png`)});
      }
      assert.ok(Math.max(...heights) - Math.min(...heights) <= 50, `${name}/${width}: switching preview steps creates a large layout jump`);
      await app.locator('#hwd-tab-measure').focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await app.locator('#hwd-tab-return').getAttribute('aria-selected'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'hwd-tab-return');
      await page.keyboard.press('Home');
      assert.equal(await app.locator('#hwd-tab-measure').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('ArrowRight');
      assert.equal(await app.locator('#hwd-tab-analysis').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.equal(await app.locator('#hwd-tab-return').getAttribute('aria-selected'), 'true');
      await app.locator('#hwd-tab-measure').click();
      for (const id of ['analysis', 'actions', 'return']) {
        await app.locator(`[data-demo-next="${id}"]`).click();
        assert.equal(await app.locator(`#hwd-panel-${id}`).isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.id), `hwd-tab-${id}`);
        const focusPosition = await page.evaluate(() => ({
          top: document.activeElement.getBoundingClientRect().top,
          headerBottom: document.querySelector('#siteHeader')?.getBoundingClientRect().bottom || 0,
        }));
        assert.ok(focusPosition.top >= focusPosition.headerBottom - 1,
          `${name}/${width}/${id}: next step leaves keyboard focus behind the fixed header`);
      }
      const returnPanel = app.locator('#hwd-panel-return');
      assert.match(await returnPanel.textContent(), /No later result in this sample/);
      assert.equal(await returnPanel.locator('a').getAttribute('href'), 'sample-report.html#synthesis');
      const cta = await page.locator('.hero-actions .btn-accent').evaluate(el => ({ bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color }));
      assert.equal(cta.bg, 'rgb(169, 208, 212)');
      assert.equal(cta.color, 'rgb(4, 24, 27)');
      assert.equal(await page.locator('.hero .hero-report-proof').count(), 0, 'Report must no longer occupy hero');
      assert.equal(await page.locator('#sample-output .hero-report-link').getAttribute('href'), 'sample-report.html#depth');
      if (out && [390,1440].includes(width)) {
        await app.locator('#hwd-tab-analysis').click();
        await page.evaluate(() => scrollTo(0,0));
        await page.screenshot({path:path.join(out, `${name}-${width}-homepage.png`)});
      }
      await page.close();
    }
  } finally { await browser.close(); }
}
console.log('HOMEPAGE_WORKSPACE_DEMO_PASS (fixture parity, 4 steps, keyboard, CTAs, and 6 widths in Chromium + WebKit)');
