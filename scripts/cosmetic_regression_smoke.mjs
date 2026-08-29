import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8765';
const out = process.env.COSMETIC_OUT || '/tmp/monderman-cosmetic-regression';
fs.mkdirSync(out, { recursive: true });

const articlePages = [
  'decision-velocity-article.html',
  'structural-clarity-article.html',
  'operational-systems-article.html',
  'institutional-performance-article.html',
];

const workspacePages = [
  'workspace.html',
  'workspace-diagnostics.html',
  'workspace-analysis.html',
  'workspace-actions.html',
  'workspace-settings.html',
];

const phoneViewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

function noPageOverflow(result, label) {
  assert.ok(result.scrollWidth <= result.clientWidth + 1,
    `${label}: document overflows (${result.scrollWidth}px > ${result.clientWidth}px)`);
}

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });

  try {
    for (const viewport of phoneViewports) {
      for (const pageName of articlePages) {
        const page = await browser.newPage({ viewport, javaScriptEnabled: false });
        await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
        const result = await page.evaluate(() => {
          const cells = [...document.querySelectorAll('.lens-matrix td')];
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            cellWidths: cells.map(cell => Math.round(cell.getBoundingClientRect().width)),
            cellDisplays: cells.map(cell => getComputedStyle(cell).display),
            rowWidths: [...document.querySelectorAll('.lens-matrix tbody tr')]
              .map(row => Math.round(row.getBoundingClientRect().width)),
          };
        });
        noPageOverflow(result, `${browserName}/${viewport.width}/${pageName}`);
        assert.equal(result.cellWidths.length, 12, `${browserName}/${pageName}: incomplete lens matrix`);
        assert.ok(Math.min(...result.cellWidths) >= viewport.width - 140,
          `${browserName}/${viewport.width}/${pageName}: lens cells remain compressed (${Math.min(...result.cellWidths)}px)`);
        assert.ok(result.cellDisplays.every(display => display === 'block'),
          `${browserName}/${viewport.width}/${pageName}: lens cells are not stacked reading rows`);
        assert.ok(Math.min(...result.rowWidths) >= viewport.width - 100,
          `${browserName}/${viewport.width}/${pageName}: lens cards remain unnaturally narrow`);
        if (viewport.width === 390 && pageName === 'decision-velocity-article.html') {
          await page.locator('.lens-matrix').screenshot({
            path: path.join(out, `lens-matrix-${browserName}-390.png`),
          });
        }
        await page.close();
      }

      for (const pageName of workspacePages) {
        for (const theme of ['light', 'dark']) {
          const page = await browser.newPage({ viewport, javaScriptEnabled: false });
          await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
          const result = await page.evaluate((selectedTheme) => {
          if (selectedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
          else document.documentElement.removeAttribute('data-theme');
          const longName = 'Christopher Bartholomew Kensington-Smythe';
          const longOrg = 'International Center for Institutional Performance and Administrative Capacity';
          for (const id of ['wsUserName', 'ws5UserName']) {
            const element = document.getElementById(id);
            if (element) element.textContent = longName;
          }
          for (const id of ['wsOrgName', 'ws5Org']) {
            const element = document.getElementById(id);
            if (element) element.textContent = longOrg;
          }
          const header = document.querySelector('.ws5-topbar,.ws-topbar');
          const identity = document.querySelector('.ws5-user,.ws-user');
          const identityBox = identity?.getBoundingClientRect();
          const headerBox = header?.getBoundingClientRect();
          const identityText = identity?.querySelector('b') || identity;
          const identityStyle = identityText ? getComputedStyle(identityText) : null;
          const headerStyle = header ? getComputedStyle(header) : null;
          const rail = document.querySelector('.ws5-rail,.ws-rail');
          const measureIcon = document.querySelector('a[href^="workspace-diagnostics.html"] svg');
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            identityWidth: identityBox?.width || 0,
            identityLeft: identityBox?.left || 0,
            identityRight: identityBox?.right || 0,
            headerLeft: headerBox?.left || 0,
            headerRight: headerBox?.right || 0,
            headerBottom: headerBox?.bottom || 0,
            identityBottom: identityBox?.bottom || 0,
            identityColor: identityStyle?.color || '',
            headerBackground: headerStyle?.backgroundColor || '',
            measureGlyph: measureIcon?.innerHTML.replace(/\s+/g, ' ').trim() || '',
            railClientWidth: rail?.clientWidth || 0,
            railBoxWidth: rail?.getBoundingClientRect().width || 0,
          };
          }, theme);
          noPageOverflow(result, `${browserName}/${theme}/${viewport.width}/${pageName}`);
          assert.ok(result.identityWidth >= 100,
            `${browserName}/${theme}/${viewport.width}/${pageName}: long user identity is compressed (${result.identityWidth}px)`);
          assert.ok(result.identityLeft >= result.headerLeft - 1 && result.identityRight <= result.headerRight + 1,
            `${browserName}/${theme}/${viewport.width}/${pageName}: user identity escapes the header`);
          assert.ok(result.identityBottom <= result.headerBottom + 1,
            `${browserName}/${theme}/${viewport.width}/${pageName}: user identity drops outside the header surface`);
          if (theme === 'dark') {
            assert.notEqual(result.identityColor, result.headerBackground,
              `${browserName}/${theme}/${viewport.width}/${pageName}: user identity disappears against the header`);
          }
          assert.ok(result.railBoxWidth <= viewport.width + 1 && result.railClientWidth <= viewport.width + 1,
            `${browserName}/${theme}/${viewport.width}/${pageName}: Workspace rail expands the page`);
          assert.ok(result.measureGlyph.includes('<path d="M4 16a8 8 0 0 1 16 0"')
            && result.measureGlyph.includes('<circle cx="12" cy="16" r="1.3"'),
          `${browserName}/${theme}/${viewport.width}/${pageName}: Measure does not use the canonical speedometer glyph`);
          if (viewport.width === 390 && pageName === 'workspace-actions.html') {
            await page.screenshot({ path: path.join(out, `workspace-${theme}-${browserName}-390.png`) });
          }
          await page.close();
        }
      }
    }

    for (const viewport of [{ width: 320, height: 700 }, { width: 1024, height: 900 }]) {
      const page = await browser.newPage({ viewport, javaScriptEnabled: false });
      await page.goto(`${base}/workspace-actions.html`, { waitUntil: 'load', timeout: 30000 });
      const result = await page.evaluate(() => {
        const host = document.querySelector('.content');
        const fixture = document.createElement('section');
        fixture.id = 'cosmeticChipFixture';
        fixture.innerHTML = `
          <div class="lanes">
            <div class="lane"><div class="ai-card"><div class="ai-main">
              <div class="ai-title">Reduce key-person dependency across the operating boundary</div>
              <div class="ai-meta">
                <span class="ai-chip">Decision ownership and escalation boundary</span>
                <span class="ai-chip">Christopher Bartholomew Kensington-Smythe</span>
              </div>
            </div>
            <div class="ai-actions col">
              <label class="ai-control"><span>Status</span><select class="mini-select"><option>To do</option></select></label>
              <label class="ai-control"><span>Owner</span><select class="mini-select"><option>Christopher Bartholomew Kensington-Smythe</option></select></label>
              <div class="ai-cardtools"><button class="btn-mini ghost">↑</button><button class="btn-mini ghost">↓</button><button class="btn-mini ghost danger">Set aside</button></div>
            </div></div></div>
            <div class="lane"></div><div class="lane"></div>
          </div>`;
        host.prepend(fixture);
        const card = fixture.querySelector('.ai-card').getBoundingClientRect();
        const title = fixture.querySelector('.ai-title').getBoundingClientRect();
        const chips = [...fixture.querySelectorAll('.ai-chip')].map(chip => {
          const box = chip.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width, whiteSpace: getComputedStyle(chip).whiteSpace };
        });
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          card: { left: card.left, right: card.right, width: card.width },
          title: { left: title.left, right: title.right, width: title.width },
          chips,
        };
      });
      noPageOverflow(result, `${browserName}/${viewport.width}/action-chip-fixture`);
      assert.ok(result.chips.every(chip => chip.left >= result.card.left - 1 && chip.right <= result.card.right + 1),
        `${browserName}/${viewport.width}: Action Plan chip escapes its card (${JSON.stringify(result)})`);
      assert.ok(result.chips.every(chip => chip.whiteSpace === 'normal'),
        `${browserName}/${viewport.width}: Action Plan chips still force no-wrap`);
      assert.ok(result.title.width >= result.card.width - 40,
        `${browserName}/${viewport.width}: Action Plan title collapses into a narrow column (${JSON.stringify(result)})`);
      if (viewport.width === 320 || viewport.width === 1024) {
        await page.locator('#cosmeticChipFixture').screenshot({
          path: path.join(out, `action-chips-${browserName}-${viewport.width}.png`),
        });
      }
      await page.close();
    }

    console.log(`COSMETIC_REGRESSION_PASS_${browserName.toUpperCase()}`);
  } finally {
    await browser.close();
  }
}
