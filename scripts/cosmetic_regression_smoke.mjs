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

const faviconDebrisPages = [
  'connect.html',
  'decision-velocity.html',
  'diagnostics.html',
  'institutional-performance.html',
  'operational-systems.html',
  'roi.html',
  'structural-clarity.html',
  'why-monderman.html',
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

const articleReadingViewports = [
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1100, height: 900 },
  { width: 1280, height: 900 },
];

function noPageOverflow(result, label) {
  // Linux WebKit adds its three-pixel scrollbar gutter to the document's
  // reported scrollWidth when a bounded inner horizontal scroller is present.
  // Treat that as contained only when geometry proves every out-of-viewport
  // element belongs to such a scroller; genuine page overflow still fails.
  if (Array.isArray(result.overflowOffenders)) {
    assert.equal(result.overflowOffenders.length, 0,
      `${label}: uncontained elements escape the viewport; `
      + `offenders=${JSON.stringify(result.overflowOffenders)}`);
    return;
  }
  assert.ok(result.scrollWidth <= result.clientWidth + 1,
    `${label}: document overflows (${result.scrollWidth}px > ${result.clientWidth}px)`);
}

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });

  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      for (const pageName of faviconDebrisPages) {
        const page = await browser.newPage({ viewport, javaScriptEnabled: false });
        await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
        const result = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          leadingBodyText: document.body.innerText.trim().slice(0, 24),
          orphanedHeadArtwork: Boolean(document.head.querySelector('svg, rect, text')),
        }));
        noPageOverflow(result, `${browserName}/${viewport.width}/${pageName}/head-cleanliness`);
        assert.equal(result.orphanedHeadArtwork, false,
          `${browserName}/${viewport.width}/${pageName}: orphaned favicon artwork remains in the head`);
        assert.ok(!/^M\s*['"]\s*\/?>/.test(result.leadingBodyText),
          `${browserName}/${viewport.width}/${pageName}: favicon debris is visible above the page `
          + JSON.stringify(result.leadingBodyText));
        if (viewport.width === 390 && pageName === 'diagnostics.html') {
          await page.screenshot({ path: path.join(out, `diagnostics-clean-head-${browserName}-390.png`) });
        }
        await page.close();
      }
    }

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

    for (const viewport of articleReadingViewports) {
      for (const pageName of articlePages) {
        const page = await browser.newPage({ viewport, javaScriptEnabled: false });
        await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
        const result = await page.evaluate(() => {
          const matrix = document.querySelector('.lens-matrix');
          matrix.style.fontSize = '1.425rem';
          const cells = [...matrix.querySelectorAll('td')];
          const diagnosticLabels = [...matrix.querySelectorAll('td:first-child strong')];
          const content = document.querySelector('.article-layout > .content');
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            contentWidth: Math.round(content.getBoundingClientRect().width),
            matrixWidth: Math.round(matrix.getBoundingClientRect().width),
            cellWidths: cells.map(cell => Math.round(cell.getBoundingClientRect().width)),
            cellScrollWidths: cells.map(cell => cell.scrollWidth),
            overflowWrap: cells.map(cell => getComputedStyle(cell).overflowWrap),
            wordBreak: cells.map(cell => getComputedStyle(cell).wordBreak),
            hyphens: cells.map(cell => getComputedStyle(cell).hyphens),
            diagnosticLabelBounds: diagnosticLabels.map(label => {
              const labelBox = label.getBoundingClientRect();
              const cellBox = label.closest('td').getBoundingClientRect();
              return {
                left: labelBox.left,
                right: labelBox.right,
                cellLeft: cellBox.left,
                cellRight: cellBox.right,
              };
            }),
          };
        });
        noPageOverflow(result, `${browserName}/${viewport.width}/${pageName}/enlarged-text`);
        assert.ok(result.matrixWidth >= 500,
          `${browserName}/${viewport.width}/${pageName}: lens matrix remains too narrow (${result.matrixWidth}px)`);
        assert.ok(Math.min(...result.cellWidths) >= 135,
          `${browserName}/${viewport.width}/${pageName}: lens column remains too narrow (${Math.min(...result.cellWidths)}px)`);
        assert.ok(result.cellScrollWidths.every((width, index) => width <= result.cellWidths[index] + 1),
          `${browserName}/${viewport.width}/${pageName}: enlarged lens text escapes a cell `
          + `(boxes=${JSON.stringify(result.cellWidths)}, scroll=${JSON.stringify(result.cellScrollWidths)})`);
        assert.ok(result.overflowWrap.every(value => value === 'normal')
          && result.wordBreak.every(value => value === 'normal')
          && result.hyphens.every(value => value === 'none'),
        `${browserName}/${viewport.width}/${pageName}: lens text can still split inside words`);
        assert.ok(result.diagnosticLabelBounds.every(box => box.left >= box.cellLeft - 1 && box.right <= box.cellRight + 1),
          `${browserName}/${viewport.width}/${pageName}: a Diagnostic label escapes its table cell `
          + JSON.stringify(result.diagnosticLabelBounds));
        if (viewport.width === 1024 && pageName === 'structural-clarity-article.html') {
          await page.locator('.lens-matrix').screenshot({
            path: path.join(out, `lens-matrix-enlarged-${browserName}-1024.png`),
          });
        }
        await page.close();
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
        const viewportWidth = document.documentElement.clientWidth;
        const belongsToBoundedScroller = (element) => {
          let ancestor = element.parentElement;
          while (ancestor && ancestor !== document.documentElement) {
            const style = getComputedStyle(ancestor);
            const box = ancestor.getBoundingClientRect();
            if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
              && box.left >= -1 && box.right <= viewportWidth + 1) return true;
            ancestor = ancestor.parentElement;
          }
          return false;
        };
        const overflowOffenders = [...document.querySelectorAll('*')]
          .filter(element => {
            const box = element.getBoundingClientRect();
            const escapesViewport = box.left < -1 || box.right > viewportWidth + 1;
            return escapesViewport && !belongsToBoundedScroller(element);
          })
          .map(element => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.trim().replace(/\s+/g, '.')}` : ''}`,
              left: Math.round(box.left * 10) / 10,
              right: Math.round(box.right * 10) / 10,
              width: Math.round(box.width * 10) / 10,
              overflowX: style.overflowX,
            };
          });
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          card: { left: card.left, right: card.right, width: card.width },
          title: { left: title.left, right: title.right, width: title.width },
          chips,
          overflowOffenders,
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
