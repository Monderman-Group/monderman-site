import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const root = path.resolve(import.meta.dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'sample-data/production-diagnostic-samples.json'), 'utf8')).outputs.decision_velocity.result;
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
      assert.equal(await app.locator('[data-demo-score]').textContent(), String(source.score), `${name}/${width}: sample score differs from production fixture`);
      for (const key of ['coordination', 'handoff', 'approval']) {
        const value = app.locator(`[data-demo-burden="${key}"]`);
        assert.equal(await value.textContent(), String(source.burden_breakdown[key]));
        const plotted = await value.locator('..').locator('.hwd-track > i').evaluate(el => el.style.width);
        assert.equal(plotted, `${source.burden_breakdown[key]}%`, `${name}/${width}: chart value and plot disagree`);
      }
      const actionText = await app.locator('.hwd-action-card p').textContent();
      assert.equal(actionText, source.interpretive_prose.priority_actions[0], 'Action detail must preserve its sample source');
      assert.match(await page.locator('.home-workspace-preview').textContent(), /Illustrative data/);
      assert.match(await page.locator('.home-preview-caption').textContent(), /does not create or change a workspace/);
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
      assert.equal(await returnPanel.locator('a').getAttribute('href'), 'sample-report.html');
      const cta = await page.locator('.hero-actions .btn-accent').evaluate(el => ({ bg:getComputedStyle(el).backgroundColor, color:getComputedStyle(el).color }));
      assert.equal(cta.bg, 'rgb(169, 208, 212)');
      assert.equal(cta.color, 'rgb(4, 24, 27)');
      assert.equal(await page.locator('.hero .hero-report-proof').count(), 0, 'Report must no longer occupy hero');
      assert.equal(await page.locator('#sample-output .hero-report-link').getAttribute('href'), 'sample-report.html');
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
