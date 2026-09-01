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

const sitemapPages = [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((match) => new URL(match[1]).pathname.split('/').pop() || 'index.html');
const publicHeaderPages = [...new Set(sitemapPages)].filter((pageName) => {
  if (!fs.existsSync(pageName)) return false;
  const source = fs.readFileSync(pageName, 'utf8');
  return source.includes('canonical-green-shell') && source.includes('canonical-site-shell.js');
});

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

    for (const viewport of [{ width: 768, height: 900 }, { width: 1024, height: 900 }]) {
      for (const pageName of publicHeaderPages) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
        await page.locator('.site-menu-button').waitFor({ state: 'visible', timeout: 10000 });
        const closed = await page.evaluate(() => {
          const nav = document.querySelector('.header .nav');
          const button = document.querySelector('.site-menu-button');
          const header = document.querySelector('.header');
          const headerBox = header.getBoundingClientRect();
          const buttonBox = button.getBoundingClientRect();
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            navDisplay: getComputedStyle(nav).display,
            buttonDisplay: getComputedStyle(button).display,
            buttonLeft: buttonBox.left,
            buttonRight: buttonBox.right,
            headerLeft: headerBox.left,
            headerRight: headerBox.right,
            expanded: button.getAttribute('aria-expanded'),
          };
        });
        noPageOverflow(closed, `${browserName}/${viewport.width}/${pageName}/tablet-header-closed`);
        assert.equal(closed.navDisplay, 'none', `${browserName}/${viewport.width}/${pageName}: tablet nav is not closed`);
        assert.notEqual(closed.buttonDisplay, 'none', `${browserName}/${viewport.width}/${pageName}: tablet menu button is hidden`);
        assert.ok(closed.buttonLeft >= closed.headerLeft - 1 && closed.buttonRight <= closed.headerRight + 1,
          `${browserName}/${viewport.width}/${pageName}: tablet menu button is clipped`);
        assert.equal(closed.expanded, 'false', `${browserName}/${viewport.width}/${pageName}: tablet nav starts expanded`);

        await page.locator('.site-menu-button').click();
        const opened = await page.evaluate(() => {
          const nav = document.querySelector('.header .nav');
          const navBox = nav.getBoundingClientRect();
          const items = [...nav.querySelectorAll(':scope > a, :scope > .nav-menu')]
            .map((item) => {
              const box = item.getBoundingClientRect();
              return { left: box.left, right: box.right, width: box.width };
            });
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            navDisplay: getComputedStyle(nav).display,
            navLeft: navBox.left,
            navRight: navBox.right,
            items,
          };
        });
        noPageOverflow(opened, `${browserName}/${viewport.width}/${pageName}/tablet-header-open`);
        assert.equal(opened.navDisplay, 'flex', `${browserName}/${viewport.width}/${pageName}: tablet nav does not open`);
        assert.ok(opened.navLeft >= -1 && opened.navRight <= opened.clientWidth + 1,
          `${browserName}/${viewport.width}/${pageName}: opened tablet nav is clipped`);
        assert.ok(opened.items.every((item) => item.left >= -1 && item.right <= opened.clientWidth + 1),
          `${browserName}/${viewport.width}/${pageName}: opened tablet nav item escapes the viewport`);
        await page.keyboard.press('Escape');
        const escaped = await page.evaluate(() => ({
          navDisplay: getComputedStyle(document.querySelector('.header .nav')).display,
          expanded: document.querySelector('.site-menu-button').getAttribute('aria-expanded'),
          focusReturned: document.activeElement === document.querySelector('.site-menu-button'),
        }));
        assert.equal(escaped.navDisplay, 'none', `${browserName}/${viewport.width}/${pageName}: Escape does not close the tablet nav`);
        assert.equal(escaped.expanded, 'false', `${browserName}/${viewport.width}/${pageName}: Escape leaves tablet nav expanded`);
        assert.equal(escaped.focusReturned, true, `${browserName}/${viewport.width}/${pageName}: Escape does not return focus`);
        if (pageName === 'about.html') {
          await page.screenshot({ path: path.join(out, `header-${browserName}-${viewport.width}.png`) });
        }
        await page.close();
      }
    }

    {
      const viewport = { width: 1280, height: 900 };
      const page = await browser.newPage({ viewport });
      await page.goto(`${base}/about.html`, { waitUntil: 'load', timeout: 30000 });
      const result = await page.evaluate(() => {
        const nav = document.querySelector('.header .nav');
        const navBox = nav.getBoundingClientRect();
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          navDisplay: getComputedStyle(nav).display,
          menuDisplay: getComputedStyle(document.querySelector('.site-menu-button')).display,
          navLeft: navBox.left,
          navRight: navBox.right,
          portraits: [...document.querySelectorAll('.founder-photo')].map((image) => {
            const box = image.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
        };
      });
      noPageOverflow(result, `${browserName}/1280/about.html/desktop-header`);
      assert.equal(result.navDisplay, 'flex', `${browserName}/1280/about.html: desktop nav is hidden`);
      assert.equal(result.menuDisplay, 'none', `${browserName}/1280/about.html: tablet menu persists on desktop`);
      assert.ok(result.navLeft >= -1 && result.navRight <= result.clientWidth + 1,
        `${browserName}/1280/about.html: desktop nav is clipped`);
      assert.equal(result.portraits.length, 2, `${browserName}/1280/about.html: expected both senior-team portraits`);
      assert.ok(result.portraits.every((portrait) => portrait.width <= 260.5 && portrait.height <= 260.5),
        `${browserName}/1280/about.html: a senior-team portrait is oversized (${JSON.stringify(result.portraits)})`);
      assert.ok(result.portraits.every((portrait) => Math.abs(portrait.width - portrait.height) <= 1),
        `${browserName}/1280/about.html: a senior-team portrait is not square (${JSON.stringify(result.portraits)})`);
      await page.screenshot({ path: path.join(out, `header-${browserName}-1280.png`) });
      await page.close();
    }

    for (const viewport of [{ width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 1000 }]) {
      const page = await browser.newPage({ viewport, javaScriptEnabled: false });
      await page.goto(`${base}/about.html`, { waitUntil: 'load', timeout: 30000 });
      const portraits = await page.locator('.founder-photo').evaluateAll((images) => images.map((image) => {
        const box = image.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }));
      assert.equal(portraits.length, 2, `${browserName}/${viewport.width}/about.html: expected both senior-team portraits`);
      assert.ok(portraits.every((portrait) => portrait.width <= 260.5 && portrait.height <= 260.5),
        `${browserName}/${viewport.width}/about.html: a senior-team portrait is oversized (${JSON.stringify(portraits)})`);
      assert.ok(portraits.every((portrait) => Math.abs(portrait.width - portrait.height) <= 1),
        `${browserName}/${viewport.width}/about.html: a senior-team portrait is not square (${JSON.stringify(portraits)})`);
      await page.locator('.founder').first().screenshot({
        path: path.join(out, `about-portraits-${browserName}-${viewport.width}.png`),
      });
      await page.close();
    }

    {
      let requestCount = 0;
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.route('https://monderman-api.onrender.com/api/connect/send', async (route) => {
        requestCount += 1;
        const body = requestCount === 1
          ? { ok: false, error: 'Too many requests. Please try again shortly, or email connect@monderman.com directly.' }
          : { ok: true };
        await route.fulfill({
          status: requestCount === 1 ? 429 : 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      });
      await page.goto(`${base}/connect.html`, { waitUntil: 'load', timeout: 30000 });
      await page.locator('#fullName').fill('Launch readiness test');
      await page.locator('#workEmail').fill('launch-readiness@example.com');
      await page.locator('#organization').fill('Monderman test');
      await page.locator('#issueSummary').fill('Verify that the request form reports server errors accurately.');
      await page.locator('#cnNext').click();
      await page.locator('#privacyConsent').check();
      await page.locator('#submitButton').click();
      await page.locator('#statusNote.is-visible').waitFor({ state: 'visible', timeout: 5000 });
      const errorText = await page.locator('#statusNote').textContent();
      assert.equal(errorText, 'Too many requests. Please try again shortly, or email connect@monderman.com directly.',
        `${browserName}/connect.html: server response is hidden behind generic error copy`);
      await page.locator('#submitButton').click();
      await page.locator('#confirmationScreen.is-visible').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(requestCount, 2, `${browserName}/connect.html: retry did not reach the request endpoint`);
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('https://monderman-api.onrender.com/api/connect/send', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly, or email connect@monderman.com directly.' }),
        });
      });
      await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await page.locator('.mdn-cn-launch').click();
      await page.locator('#mdncn-fullName').fill('Launch readiness test');
      await page.locator('#mdncn-workEmail').fill('launch-readiness@example.com');
      await page.locator('#mdncn-organization').fill('Monderman test');
      await page.locator('#mdncn-issueSummary').fill('Verify the compact request form error handling.');
      await page.locator('#mdncn-next').click();
      await page.locator('#mdncn-consent').check();
      await page.locator('#mdncn-send').click();
      await page.waitForFunction(() => document.querySelector('#mdncn-status')?.textContent?.startsWith('Too many requests.'));
      const widgetErrorText = await page.locator('#mdncn-status').textContent();
      assert.equal(widgetErrorText, 'Too many requests. Please try again shortly, or email connect@monderman.com directly.',
        `${browserName}/Connect widget: server response is hidden behind generic error copy`);
      await page.close();
    }

    {
      let requestCount = 0;
      let submittedPayload = null;
      const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
      await page.route('https://monderman-api.onrender.com/api/connect/send', async (route) => {
        requestCount += 1;
        submittedPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: requestCount === 1 ? 429 : 200,
          contentType: 'application/json',
          body: JSON.stringify(requestCount === 1
            ? { ok: false, error: 'Too many requests. Please try again shortly, or email connect@monderman.com directly.' }
            : { ok: true }),
        });
      });
      await page.goto(`${base}/plan-enterprise.html`, { waitUntil: 'load', timeout: 30000 });
      await page.locator('#name').fill('Launch readiness test');
      await page.locator('#email').fill('launch-readiness@example.com');
      await page.locator('#org').fill('Monderman test');
      await page.locator('#role').fill('Executive sponsor');
      await page.locator('#seats').fill('One team of eight');
      await page.locator('#timing').selectOption({ label: 'Within 30 days' });
      await page.locator('#scope').fill('Verify the Enterprise intake contract.');
      await page.locator('input[name="consent"]').check();
      await page.locator('#planSubmit').click();
      await page.locator('#planStatus.is-error').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(await page.locator('#planStatus').textContent(),
        'Too many requests. Please try again shortly, or email connect@monderman.com directly.',
        `${browserName}/plan-enterprise.html: server response is hidden behind generic error copy`);
      assert.equal(submittedPayload.fullName, 'Launch readiness test',
        `${browserName}/plan-enterprise.html: name is not mapped to the Connect API contract`);
      assert.equal(submittedPayload.workEmail, 'launch-readiness@example.com',
        `${browserName}/plan-enterprise.html: email is not mapped to the Connect API contract`);
      assert.match(submittedPayload.issueSummary || '', /One team of eight/,
        `${browserName}/plan-enterprise.html: requested scope is missing from the Connect API payload`);
      await page.locator('#planSubmit').click();
      await page.locator('#planStatus.is-success').waitFor({ state: 'visible', timeout: 5000 });
      assert.equal(requestCount, 2, `${browserName}/plan-enterprise.html: retry did not reach the request endpoint`);
      assert.equal(await page.locator('#name').inputValue(), '',
        `${browserName}/plan-enterprise.html: successful submission did not clear the form`);
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
      const italicResponses = new Map();
      page.on('response', (response) => {
        const name = response.url().split('/').pop()?.split('?')[0];
        if (['56font.woff2', '76font.woff2'].includes(name)) italicResponses.set(name, response.status());
      });
      await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await page.locator('.latest-card:not(.is-carousel-clone) .placeholder-cover-motif').first()
        .waitFor({ state: 'attached', timeout: 10000 });
      const motif = await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load('italic 400 16px "Neue Haas Grotesk"'),
          document.fonts.load('italic 700 16px "Neue Haas Grotesk"'),
        ]);
        const motifs = [...document.querySelectorAll('.latest-card:not(.is-carousel-clone) .placeholder-cover-motif')];
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          motifs: motifs.map((svg) => {
            const image = svg.closest('.latest-card-image');
            const box = svg.getBoundingClientRect();
            const imageBox = image.getBoundingClientRect();
            return {
              viewBox: svg.getAttribute('viewBox'),
              preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
              imageLeft: imageBox.left,
              imageRight: imageBox.right,
              imageTop: imageBox.top,
              imageBottom: imageBox.bottom,
            };
          }),
          italic400: document.fonts.check('italic 400 16px "Neue Haas Grotesk"'),
          italic700: document.fonts.check('italic 700 16px "Neue Haas Grotesk"'),
        };
      });
      noPageOverflow(motif, `${browserName}/320/index.html/motif`);
      assert.ok(motif.motifs.length >= 3, `${browserName}/320/index.html: category motifs are missing`);
      assert.ok(motif.motifs.every((item) => item.viewBox === '0 0 344 188'
        && item.preserveAspectRatio === 'xMaxYMax meet'),
      `${browserName}/320/index.html: phone motif viewport regressed (${JSON.stringify(motif.motifs)})`);
      assert.ok(motif.motifs.every((item) => item.left >= item.imageLeft - 1
        && item.right <= item.imageRight + 1 && item.top >= item.imageTop - 1 && item.bottom <= item.imageBottom + 1),
      `${browserName}/320/index.html: category motif is cropped outside its tile`);
      assert.equal(motif.italic400, true, `${browserName}/320/index.html: regular italic NHG face did not load`);
      assert.equal(motif.italic700, true, `${browserName}/320/index.html: bold italic NHG face did not load`);
      assert.equal(italicResponses.get('56font.woff2'), 200, `${browserName}/320/index.html: 56 italic font request failed`);
      assert.equal(italicResponses.get('76font.woff2'), 200, `${browserName}/320/index.html: 76 italic font request failed`);
      await page.locator('.latest-card:not(.is-carousel-clone)').first().screenshot({
        path: path.join(out, `homepage-motif-${browserName}-320.png`),
      });
      await page.close();
    }

    {
      const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
      await page.goto(`${base}/after-the-first-lap.html`, { waitUntil: 'load', timeout: 30000 });
      const leading = await page.evaluate(() => document.body.innerText.trim().slice(0, 80));
      assert.ok(!leading.startsWith('Warning:') && !leading.startsWith('Total output lines:'),
        `${browserName}/after-the-first-lap.html: tool output is still visible (${JSON.stringify(leading)})`);
      await page.close();
    }

    console.log(`COSMETIC_REGRESSION_PASS_${browserName.toUpperCase()}`);
  } finally {
    await browser.close();
  }
}
