import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const out = process.env.MOBILE_OUT || '/tmp/mobile-site-presentation';
fs.mkdirSync(out, { recursive: true });

// Discover every customer-facing root HTML surface so newly added pages enter
// the sweep automatically. The Google ownership token is not a rendered page.
const pages = fs.readdirSync(process.cwd())
  .filter((name) => name.endsWith('.html') && !name.startsWith('google'))
  .sort();

const sourceByPage = new Map(pages.map((name) => [name, fs.readFileSync(name, 'utf8')]));
const canonicalPages = pages.filter((name) => {
  const source = sourceByPage.get(name);
  return /<body\b[^>]*\bclass=["'][^"']*\bcanonical-green-shell\b/i.test(source)
    && /canonical-site-shell\.js/.test(source);
});
const footerPages = pages.filter((name) => canonicalPages.includes(name) || /\bmond-footer\b/.test(sourceByPage.get(name)));
const shellFreePages = pages.filter((name) => !canonicalPages.includes(name) && !footerPages.includes(name));
const immutableLegalPages = new Set(pages.filter((name) => /^(?:terms|privacy)-\d{4}-\d{2}-\d{2}-(?:beta|optional-measurement-v1|ai-evidence-v1|ai-source-evidence-v2|annual-plans|invited-evaluation)\.html$/.test(name)));

// September 19 adds evaluation Terms and Privacy editions without removing history.
// Preserve every previous legal edition in the full viewport sweep.
assert.equal(pages.length, 81, 'rendered root-page inventory changed unexpectedly');
assert.equal(canonicalPages.length, 63, 'canonical header + footer inventory changed unexpectedly');
assert.equal(footerPages.length, 67, 'footer inventory changed unexpectedly');
for (const legalEdition of ['terms-2026-09-08-beta.html', 'privacy-2026-09-08-beta.html', 'terms-2026-09-09-beta.html', 'privacy-2026-09-09-beta.html', 'privacy-2026-09-10-beta.html']) {
  assert.ok(canonicalPages.includes(legalEdition), `${legalEdition}: archived legal page missing from canonical sweep`);
}
assert.equal(shellFreePages.length, 14, 'functional shell-free page inventory changed unexpectedly');
assert.equal(immutableLegalPages.size, 17, 'immutable legal-page inventory changed unexpectedly');
assert.ok(immutableLegalPages.has('terms-2026-09-19-invited-evaluation.html'), 'invited evaluation Terms join legal coverage');
assert.ok(immutableLegalPages.has('privacy-2026-09-19-invited-evaluation.html'), 'invited evaluation Privacy joins legal coverage');
assert.ok(immutableLegalPages.has('terms-2026-09-15-annual-plans.html'), 'annual Terms edition joins, rather than replaces, legal coverage');
assert.ok(immutableLegalPages.has('privacy-2026-09-10-optional-measurement-v1.html'), 'optional measurement edition remains in legal coverage');
assert.ok(immutableLegalPages.has('privacy-2026-09-11-ai-evidence-v1.html'), 'AI evidence edition remains in legal coverage');
assert.ok(immutableLegalPages.has('privacy-2026-09-12-ai-source-evidence-v2.html'), 'AI source evidence v2 edition remains in legal coverage');

// The deployed artifact must contain one exact copy of each source page and one
// exact shared shell. This rejects accidental Finder-style duplicate files and
// proves that page-family markup cannot drift at build time.
const publishDirectory = path.resolve('.render-public');
const sourceHtmlNames = fs.readdirSync(process.cwd()).filter((name) => name.endsWith('.html')).sort();
const publishedHtmlNames = fs.readdirSync(publishDirectory).filter((name) => name.endsWith('.html')).sort();
assert.deepEqual(publishedHtmlNames, sourceHtmlNames, 'published HTML inventory differs from source');
assert.equal(publishedHtmlNames.some((name) => / \d+\.html$/.test(name)), false, 'duplicate-suffixed HTML leaked into the artifact');

const headerPattern = /<header\b(?=[^>]*\bid=["']siteHeader["'])[^>]*>[\s\S]*?<\/header>/i;
const footerPattern = /<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/i;
const expectedHeader = fs.readFileSync('site-shell/header.html', 'utf8').trim();
const expectedFooter = fs.readFileSync('site-shell/footer.html', 'utf8').trim();
const injector = fs.readFileSync('scripts/inject-public-shell.mjs', 'utf8');
const shellRelease = injector.match(/const shellRelease = "([^"]+)";/)?.[1];
assert.ok(shellRelease, 'shared asset release key must be explicit');
const reportRelease = injector.match(/"monderman-report\.js": "([^"]+)"/)?.[1] || shellRelease;
for (const pageName of sourceHtmlNames) {
  const built = fs.readFileSync(path.join(publishDirectory, pageName), 'utf8');
  const refs = [...built.matchAll(/src=["'](monderman-report\.js(?:\?[^"']*)?)["']/g)];
  for (const ref of refs) assert.equal(ref[1], `monderman-report.js?v=${reportRelease}`, `${pageName}: report renderer cache identity is stale`);
}
for (const pageName of canonicalPages) {
  const built = fs.readFileSync(path.join(publishDirectory, pageName), 'utf8');
  assert.equal(built.match(headerPattern)?.[0], expectedHeader, `${pageName}: built header is not the canonical partial`);
}
for (const pageName of footerPages) {
  const built = fs.readFileSync(path.join(publishDirectory, pageName), 'utf8');
  assert.equal(built.match(footerPattern)?.[0], expectedFooter, `${pageName}: built footer is not the canonical partial`);
}

if (process.argv.includes('--inventory-only')) {
  console.log(JSON.stringify({scope:'source-and-built-inventory-only',pages:pages.length,canonicalPages:canonicalPages.length,footerPages:footerPages.length,immutableLegalPages:immutableLegalPages.size,browserLaunched:false}));
  process.exit(0);
}

// The static release inventory has no browser dependency. Load the browser
// engines only for the actual rendered sweep below.
const { chromium, webkit } = await import('playwright');

const viewports = [
  { name: 'compact-phone', width: 320, height: 700 },
  { name: 'android', width: 360, height: 800 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'large-android', width: 430, height: 932 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
];

const evidencePages = new Set([
  'index.html',
  'diagnostics.html',
  'research.html',
  'platform-services.html',
  'sample-report.html',
  'about.html',
  'signin.html',
]);

const localOrigin = new URL(base).origin;
const browser = await chromium.launch({ headless: true });
const failures = [];
const footerSignatures = new Map();
const headerSignatures = new Map();

async function navigateToStableDocument(page, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      // Give a legacy meta refresh or location replacement time to settle, then
      // bind subsequent measurements to the final document.
      await page.waitForTimeout(175);
      await page.waitForLoadState('load', { timeout: 30000 });
      await page.evaluate(() => document.readyState);
      await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
      return;
    } catch (error) {
      lastError = error;
      if (!/context was destroyed|frame was detached|navigation/i.test(String(error))) throw error;
      await page.waitForTimeout(100);
    }
  }
  throw lastError;
}

async function checkFloatingSupport(page, label) {
  await page.locator('#mnd-launcher').waitFor({ state: 'attached' });
  await page.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = await page.evaluate(() => {
    const footer = document.querySelector('.mond-footer');
    const actions = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => {
      const rect = node.getBoundingClientRect();
      const text = node.querySelector('span')?.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { name: node.textContent.trim(), accessibleName: node.getAttribute('aria-label') || node.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, position: style.position, display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents, labelWidth: text?.width || 0, labelHeight: text?.height || 0 };
    });
    const obstacleRects = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]')]
      .filter(node => !node.matches('#mnd-launcher,.mdn-cn-launch') && !node.closest('#siteHeader,.mond-footer,#mnd-panel,#mdn-cn-root') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
      .map(node => node.getBoundingClientRect());
    const overlaps = actions.length === 2 && obstacleRects.some(rect => actions.some(action =>
      rect.right > action.left && rect.left < action.right
        && rect.bottom > action.top && rect.top < action.bottom));
    return {
      actions,
      pageActionOverlap: overlaps,
      editingPage: Boolean(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') && !document.activeElement.closest('#mnd-panel,#mdn-cn-panel')),
      navigationOrPanelOpen: Boolean(document.querySelector('#siteHeader.mobile-nav-open,.site-search-overlay.is-open,#mnd-panel.mnd-open,#mdn-cn-panel.mdn-cn-open')),
      proxyCount: document.querySelectorAll('.site-support,.site-widget-actions,.site-widget-action').length,
      footerTop: footer ? footer.getBoundingClientRect().top : Infinity,
      headerBottom: document.querySelector('#siteHeader')?.getBoundingClientRect().bottom || 0,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: innerHeight,
      viewTop: window.visualViewport?.offsetTop || 0,
    };
  });
  if (state.proxyCount !== 0 || state.actions.length !== 2
      || state.actions.map(action => action.name).sort().join('|') !== 'Chat|Connect'
      || state.actions.some(action => action.position !== 'fixed' || action.display === 'none' || action.height < 48 || action.labelWidth <= 1 || action.labelHeight <= 1 || !action.accessibleName.toLowerCase().includes(action.name.toLowerCase()))) {
    failures.push(`${label}: floating support is missing, mislabeled, or undersized (${JSON.stringify(state)})`);
  }
  if (state.actions.length === 2) {
    const hidden = state.actions.filter(action => action.visibility !== 'visible');
    const cornerBlocked = state.editingPage || state.navigationOrPanelOpen
      || state.actions.some(action => action.bottom + 16 >= state.footerTop
        || action.top < Math.max(state.viewTop + 16, state.headerBottom + 16));
    if (hidden.length) {
      if (hidden.length !== 2 || hidden.some(action => action.pointerEvents !== 'none')
          || !cornerBlocked) {
        failures.push(`${label}: floating support hides without a footer/header, navigation, panel, or editing constraint, or remains interactive while hidden (${JSON.stringify(state)})`);
      }
      return;
    }
    const [top, bottom] = [...state.actions].sort((a, b) => a.top - b.top);
    const edge = state.viewportWidth <= 480 ? 16 : 20;
    if (cornerBlocked || state.actions.some(action => action.pointerEvents !== 'auto' || action.left < state.viewportWidth / 2 || action.right > state.viewportWidth || action.top < state.headerBottom + 15.5 || action.bottom > state.viewportHeight || action.bottom > state.footerTop - 15.5)
        || state.actions.some(action => Math.abs(action.right - (state.viewportWidth - edge)) > 1.5
          || Math.abs(action.bottom - (state.viewportHeight - edge - (action.name === 'Connect' ? 60 : 0))) > 1.5)
        || Math.abs(top.width - bottom.width) > 1 || Math.abs(top.right - bottom.right) > 1 || bottom.top - top.bottom < 11.5) {
      failures.push(`${label}: floating controls leave their right-hand stack, are not interactive, or cross the header/footer (${JSON.stringify(state)})`);
    }
  }
}

async function checkRevealMotionDocking() {
  const evidence = [];
  for (const [engineName, engineType] of [['chromium', chromium], ['webkit', webkit]]) {
    const engine = await engineType.launch({ headless: true });
    try {
      for (const order of ['assistant-first', 'connect-first']) {
        const page = await engine.newPage({ viewport: { width: 768, height: 1024 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Anonymous auth fixture only: no network sign-in or form submission.
        await page.addInitScript(() => { window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }; });
        await page.route('**/*', route => {
          const url = new URL(route.request().url());
          return url.origin === localOrigin && route.request().method() === 'GET' ? route.continue() : route.abort();
        });
        if (order === 'connect-first') {
          await page.route('**/connect.html', async route => {
            const response = await route.fetch();
            let html = await response.text();
            const assistant = html.match(/<script\b[^>]*src="assistant\.js[^\"]*"[^>]*><\/script>/)?.[0];
            const connect = html.match(/<script\b[^>]*src="connect-widget\.js[^\"]*"[^>]*><\/script>/)?.[0];
            assert.ok(assistant && connect, 'both real widget scripts must exist before testing reversed order');
            html = html.replace(assistant, '<!-- widget-order-placeholder -->').replace(connect, assistant).replace('<!-- widget-order-placeholder -->', connect);
            await route.fulfill({ response, body: html });
          });
        }
        await page.goto(`${base}/connect.html`, { waitUntil: 'load', timeout: 30000 });
        await page.locator('#mnd-launcher').waitFor({ state: 'attached' });
        await page.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
        const frames = [];
        for (let sample = 0; sample < 36; sample++) {
          // Sample after that frame's layout/controller callbacks, not before
          // requestAnimationFrame has had a chance to place the controls.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
          frames.push(await page.evaluate(() => {
            const actions = [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => ({ connect: node.matches('.mdn-cn-launch'), visible: getComputedStyle(node).visibility === 'visible', pointerEvents: getComputedStyle(node).pointerEvents, box: node.getBoundingClientRect().toJSON() }));
            const boxes = actions.map(action => action.box);
            const obstacles = [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[contenteditable="true"]')]
              .filter(node => !node.matches('#mnd-launcher,.mdn-cn-launch') && !node.closest('#siteHeader,.mond-footer,#mnd-panel,#mdn-cn-root') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
              .map(node => ({ id: node.id, box: node.getBoundingClientRect().toJSON() }))
              .filter(({ box }) => box.right > Math.min(...boxes.map(item => item.left)) - 8 && box.left < Math.max(...boxes.map(item => item.right)) + 8
                && box.bottom > Math.min(...boxes.map(item => item.top)) - 8 && box.top < Math.max(...boxes.map(item => item.bottom)) + 8);
            return { actions, obstacles, footerTop: document.querySelector('.mond-footer').getBoundingClientRect().top,
              headerBottom: document.querySelector('#siteHeader')?.getBoundingClientRect().bottom || 0,
              transform: getComputedStyle(document.querySelector('#contactFormShell')).transform, overlap: actions.every(action => action.visible) && obstacles.length > 0 };
          }));
          await page.waitForTimeout(20);
        }
        await page.screenshot({ path: path.join(out, `${engineName}-${order}-reveal-settled.png`) });
        await page.waitForTimeout(300);
        const idleStyleMutations = await page.evaluate(() => new Promise(resolve => {
          let count = 0;
          const observer = new MutationObserver(records => { count += records.length; });
          for (const node of document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')) observer.observe(node, { attributes: true, attributeFilter: ['style'] });
          setTimeout(() => { observer.disconnect(); resolve(count); }, 150);
        }));
        const label = `${engineName}/768/connect.html/${order}/reveal`;
        evidence.push({ engineName, order, frames, idleStyleMutations, errors });
        fs.writeFileSync(path.join(out, 'floating-reveal-motion.json'), JSON.stringify({ evidence }, null, 2));
        if (!frames.some(frame => frame.transform !== 'none' && new RegExp('matrix').test(frame.transform))) failures.push(`${label}: test missed the actual reveal motion`);
        if (frames.some(frame => frame.actions.some(action => !action.visible)
          && frame.actions.every(action => action.box.bottom + 16 < frame.footerTop && action.box.top >= frame.headerBottom + 16)))
          failures.push(`${label}: floating control disappeared during reveal even though its fixed footer/header corner remained available`);
        if (frames.some(frame => frame.actions.some(action => action.visible && (
          Math.abs(action.box.right - 748) > 1.5 || Math.abs(action.box.bottom - (1004 - (action.connect ? 60 : 0))) > 1.5
        )))) failures.push(`${label}: visible control moved away from its fixed anchor during reveal`);
        if (frames.some(frame => frame.actions.some(action => !action.visible && action.pointerEvents !== 'none')))
          failures.push(`${label}: hidden control remains interactive during reveal`);
        if (idleStyleMutations !== 0) failures.push(`${label}: docking animation callbacks did not stop after reveal`);
        if (errors.length) failures.push(`${label}: browser errors ${JSON.stringify(errors)}`);
        await checkFloatingSupport(page, label + '/settled');
        await page.close();
      }
    } finally { await engine.close(); }
  }
}

if (process.argv.includes('--floating-motion-only')) {
  try {
    await checkRevealMotionDocking();
    assert.deepEqual(failures, [], `floating reveal failures:\n${failures.join('\n')}`);
    console.log('floating reveal smoke: passed 144 sampled frames across both widget load orders in Chromium and WebKit');
  } finally { await browser.close(); }
  process.exit(0);
}

try {
  await checkRevealMotionDocking();
  // Desktop safety contract: the shared stylesheet may contain exactly one
  // top-level rule, and that rule must be the phone-only media query. This
  // makes a future accidental desktop selector a hard release failure.
  const desktopGuard = await browser.newPage({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false });
  await desktopGuard.goto(`${base}/about.html`, { waitUntil: 'load', timeout: 30000 });
  const desktopContract = await desktopGuard.evaluate(() => {
    const sheet = [...document.styleSheets].find((candidate) => candidate.href?.includes('/mobile-site-polish.css'));
    if (!sheet) return { loaded: false };
    const rules = [...sheet.cssRules];
    return {
      loaded: true,
      topLevelRules: rules.length,
      firstRuleType: rules[0]?.constructor?.name || '',
      condition: rules[0]?.conditionText || '',
      phoneQueryMatches: matchMedia('(max-width: 640px)').matches,
    };
  });
  if (!desktopContract.loaded) failures.push('desktop guard: phone stylesheet did not load');
  if (desktopContract.topLevelRules !== 1 || desktopContract.firstRuleType !== 'CSSMediaRule' || desktopContract.condition !== '(max-width: 640px)') {
    failures.push(`desktop guard: stylesheet escaped its single phone-only media boundary (${JSON.stringify(desktopContract)})`);
  }
  if (desktopContract.phoneQueryMatches) failures.push('desktop guard: phone query unexpectedly matches at 1440px');
  await desktopGuard.close();

  for (const viewport of viewports) {
    for (const pageName of pages) {
      // This is a presentation-only audit. Disabling JavaScript prevents auth,
      // diagnostic, Workspace, checkout, or form behavior from executing while
      // the static HTML/CSS for every surface is measured.
      const page = await browser.newPage({ viewport, javaScriptEnabled: false });
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
          await route.continue();
        } else {
          await route.abort();
        }
      });

      await navigateToStableDocument(page, `${base}/${pageName}`);
      await page.waitForTimeout(50);

      const geometry = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const visible = [...document.body.querySelectorAll('*')].filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
        });

        const clipped = visible.flatMap((element) => {
          const box = element.getBoundingClientRect();
          // An inline element spanning multiple wrapped lines has a union
          // bounding box that can look wider than every rendered line. Inspect
          // its actual line boxes so legitimate wrapped links do not fail.
          const boxes = getComputedStyle(element).display === 'inline'
            ? [...element.getClientRects()]
            : [box];
          if (boxes.every((rect) => rect.left >= -2 && rect.right <= viewportWidth + 2)) return [];
          // Off-screen cards are the intended mask of the horizontal homepage
          // carousel. Everything else, including the footer motif, remains in
          // the clipping audit.
          if (element.closest('#turnstilePreload,.latest-viewport') || element.matches('.hero-image')) return [];

          let ancestor = element.parentElement;
          while (ancestor && ancestor !== document.body) {
            const overflowX = getComputedStyle(ancestor).overflowX;
            if (overflowX === 'auto' || overflowX === 'scroll') return [];
            ancestor = ancestor.parentElement;
          }

          return [{
            tag: element.tagName.toLowerCase(),
            id: element.id,
            className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
            text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
            left: Math.round(box.left),
            right: Math.round(box.right),
          }];
        });

        const pathologicalImages = [...document.images].flatMap((image) => {
          const box = image.getBoundingClientRect();
          if (box.width <= 100 || image.matches('.hero-image')) return [];
          if (box.height <= Math.max(520, box.width * 1.8)) return [];
          return [{ src: image.getAttribute('src'), width: Math.round(box.width), height: Math.round(box.height) }];
        });

        const rectangle = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            display: getComputedStyle(element).display,
          };
        };
        const footer = rectangle('.mond-footer');
        const footerInner = rectangle('.mond-footer .mf-inner');
        const footerTop = rectangle('.mond-footer .mf-top');
        const footerBottom = rectangle('.mond-footer .mf-bottom');
        const copyright = rectangle('.mond-footer .mf-copyright');
        const motif = rectangle('.mond-footer .mf-motif');
        let footerRule = null;
        if (footerBottom) {
          const style = getComputedStyle(document.querySelector('.mond-footer .mf-bottom'), '::before');
          const left = footerBottom.left + Number.parseFloat(style.left);
          footerRule = {
            left,
            right: left + Number.parseFloat(style.width),
            width: Number.parseFloat(style.width),
          };
        }
        const header = rectangle('#siteHeader');
        const headerInner = rectangle('#siteHeader .header-inner');
        const brand = rectangle('#siteHeader .brand');
        const nav = rectangle('#siteHeader .nav');
        const main = rectangle('main');

        return {
          viewportWidth,
          documentWidth: document.documentElement.scrollWidth,
          hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
          clipped,
          pathologicalImages,
          footer: footer && footerInner && footerTop && footerBottom && copyright && motif && footerRule ? {
            footer,
            inner: footerInner,
            top: footerTop,
            bottom: footerBottom,
            copyright,
            motif,
            rule: footerRule,
          } : null,
          header: header && headerInner && brand ? {
            header,
            inner: headerInner,
            brand,
            nav,
            main,
            position: getComputedStyle(document.querySelector('#siteHeader')).position,
            backgroundColor: getComputedStyle(document.querySelector('#siteHeader')).backgroundColor,
            backgroundImage: getComputedStyle(document.querySelector('#siteHeader')).backgroundImage,
          } : null,
        };
      });

      if (!geometry.hasViewportMeta) failures.push(`${pageName}/${viewport.name}: viewport metadata missing`);
      if (geometry.documentWidth > geometry.viewportWidth + 1) failures.push(`${pageName}/${viewport.name}: page overflows horizontally (${geometry.documentWidth}px > ${geometry.viewportWidth}px)`);
      if (geometry.clipped.length) failures.push(`${pageName}/${viewport.name}: visible content is clipped (${JSON.stringify(geometry.clipped.slice(0, 5))})`);
      if (geometry.pathologicalImages.length) failures.push(`${pageName}/${viewport.name}: image ignores its responsive crop (${JSON.stringify(geometry.pathologicalImages)})`);

      if (geometry.footer) {
        const { footer, inner, top, bottom, copyright, motif, rule } = geometry.footer;
        const signature = [footer.height, inner.left, inner.width, top.height, bottom.height, motif.width]
          .map((value) => Math.round(value * 10) / 10)
          .join('|');
        if (!footerSignatures.has(viewport.name)) footerSignatures.set(viewport.name, signature);
        if (footerSignatures.get(viewport.name) !== signature) {
          failures.push(`${pageName}/${viewport.name}: footer geometry diverges from the shared shell (${signature} vs ${footerSignatures.get(viewport.name)})`);
        }
        if (Math.abs(footer.left) > 1 || Math.abs(footer.right - geometry.viewportWidth) > 1) {
          failures.push(`${pageName}/${viewport.name}: footer is not full-bleed (${JSON.stringify(footer)})`);
        }
        if (motif.left < footer.left - 1 || motif.right > footer.right + 1 || motif.top < footer.top - 1 || motif.bottom > footer.bottom + 1) {
          failures.push(`${pageName}/${viewport.name}: footer motif is clipped (${JSON.stringify({ footer, motif })})`);
        }
        const overlaps = !(copyright.right <= motif.left || motif.right <= copyright.left || copyright.bottom <= motif.top || motif.bottom <= copyright.top);
        if (overlaps) failures.push(`${pageName}/${viewport.name}: footer motif overlaps the copyright (${JSON.stringify({ copyright, motif })})`);
        if (Math.abs(rule.left) > 1 || rule.width < geometry.viewportWidth * .45) {
          failures.push(`${pageName}/${viewport.name}: footer rule is too short or does not reach the viewport edge (${JSON.stringify(rule)})`);
        }
        const expectedGap = viewport.width <= 640 ? 26 : viewport.width <= 960 ? 54 : 90;
        if (Math.abs((motif.left - rule.right) - expectedGap) > 1) {
          failures.push(`${pageName}/${viewport.name}: footer rule-to-motif gap is inconsistent (${motif.left - rule.right}px vs ${expectedGap}px)`);
        }
      }

      if (geometry.header) {
        const { header, inner, brand, nav, main, position, backgroundColor, backgroundImage } = geometry.header;
        const signature = [header.height, inner.left, inner.width, inner.height, brand.left, brand.width]
          .map((value) => Math.round(value * 10) / 10);
        if (!headerSignatures.has(viewport.name)) headerSignatures.set(viewport.name, signature);
        if (headerSignatures.get(viewport.name).some((value, index) => Math.abs(value - signature[index]) > 1)) {
          failures.push(`${pageName}/${viewport.name}: header geometry diverges from the shared shell (${signature.join('|')} vs ${headerSignatures.get(viewport.name).join('|')})`);
        }
        if (Math.abs(header.left) > 1 || Math.abs(header.right - geometry.viewportWidth) > 1 || header.height < 70) {
          failures.push(`${pageName}/${viewport.name}: no-script header is not full-width or has collapsed (${JSON.stringify(header)})`);
        }
        if (canonicalPages.includes(pageName)
            && (!nav || nav.display === 'none' || nav.width <= 0 || nav.left < inner.left - 1 || nav.right > inner.right + 1)) {
          failures.push(`${pageName}/${viewport.name}: primary navigation disappears or escapes its frame when scripts are unavailable (${JSON.stringify({ inner, nav })})`);
        }
        if (canonicalPages.includes(pageName)
            && (position === 'fixed' || (main && main.top < header.bottom - 1))) {
          failures.push(`${pageName}/${viewport.name}: no-script navigation obscures document content (${JSON.stringify({ header, main, position })})`);
        }
        if (canonicalPages.includes(pageName)
            && (backgroundColor !== 'rgb(9, 57, 62)' || backgroundImage !== 'none')) {
          failures.push(`${pageName}/${viewport.name}: no-script navigation lacks an opaque high-contrast surface (${JSON.stringify({ backgroundColor, backgroundImage })})`);
        }
      }

      if (pageName === 'about.html' && viewport.width <= 430) {
        const portraits = await page.locator('.founder-photo').evaluateAll((images) => images.map((image) => {
          const box = image.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }));
        if (portraits.length !== 2) failures.push(`${pageName}/${viewport.name}: expected both senior-team portraits`);
        for (const [index, portrait] of portraits.entries()) {
          if (portrait.width > 168.5) failures.push(`${pageName}/${viewport.name}: portrait ${index + 1} remains oversized (${portrait.width}px)`);
          if (Math.abs(portrait.width - portrait.height) > 1) failures.push(`${pageName}/${viewport.name}: portrait ${index + 1} is not square (${portrait.width}x${portrait.height})`);
        }
      }

      if (pageName === 'index.html') {
        const tile = page.locator('.hero-report-proof.has-sample-depth-tile');
        if (await tile.isVisible()) failures.push(`${pageName}/${viewport.name}: large sample report tile remains in the compact hero`);
        const routeField = page.locator('.hero-route-field');
        if (await routeField.count() !== 0) failures.push(`${pageName}/${viewport.name}: retired decorative route field returned`);
      }

      if (viewport.name === 'iphone' && evidencePages.has(pageName)) {
        await page.screenshot({
          path: path.join(out, `${pageName.replace('.html', '')}-${viewport.name}.png`),
          fullPage: pageName === 'about.html',
        });
      }

      await page.close();
    }
  }

  // Exercise presentation-only runtime behavior on a bounded local subset.
  // Every non-local request is blocked, and no form submit or product action is
  // triggered. This catches injected-widget and progressive-layout defects that
  // a JavaScript-disabled geometry sweep cannot see.
  const runtimePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await runtimePage.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await runtimePage.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await runtimePage.locator('#mnd-launcher').waitFor({ state: 'attached' });
  await runtimePage.locator('.mdn-cn-launch').waitFor({ state: 'attached' });

  await checkFloatingSupport(runtimePage, 'runtime utilities/390');
  let runtimeClearScrollY = 0;
  for (let top = 0; top <= 1800; top += 120) {
    await runtimePage.evaluate(top => window.scrollTo({top,behavior:'instant'}), top);
    await runtimePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await runtimePage.locator('#mnd-launcher,.mdn-cn-launch').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'visible'))) {
      runtimeClearScrollY = await runtimePage.evaluate(() => scrollY);
      break;
    }
  }
  assert.ok(await runtimePage.locator('#mnd-launcher,.mdn-cn-launch').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'visible')), 'runtime utilities: controls remain available above the footer');

  await runtimePage.locator('#mnd-launcher').click();
  await runtimePage.locator('#mnd-panel.mnd-open').waitFor({ state: 'visible' });
  const assistantState = await runtimePage.evaluate(() => {
    const panel = document.querySelector('#mnd-panel');
    const connect = document.querySelector('.mdn-cn-launch');
    const box = panel.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      width: box.width,
      viewportWidth: document.documentElement.clientWidth,
      connectVisible: getComputedStyle(connect).display !== 'none' && getComputedStyle(connect).visibility === 'visible',
    };
  });
  if (assistantState.left < -1 || assistantState.right > assistantState.viewportWidth + 1 || assistantState.width < assistantState.viewportWidth - 2) {
    failures.push(`runtime utilities: assistant panel is clipped on phone (${JSON.stringify(assistantState)})`);
  }
  if (assistantState.connectVisible) failures.push('runtime utilities: Connect launcher remains visible over the open assistant');

  await runtimePage.locator('#mnd-close').click();
  if (!await runtimePage.locator('#mnd-launcher').evaluate((node) => document.activeElement === node && getComputedStyle(node).visibility === 'visible')) {
    failures.push('runtime utilities: assistant close does not return visible focus to its native launcher');
  }
  await runtimePage.locator('.mdn-cn-launch').click();
  await runtimePage.locator('#mdn-cn-panel.mdn-cn-open').waitFor({ state: 'visible' });
  const connectState = await runtimePage.evaluate(() => {
    const panel = document.querySelector('#mdn-cn-panel');
    const assistant = document.querySelector('#mnd-launcher');
    const box = panel.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      viewportWidth: document.documentElement.clientWidth,
      assistantVisible: getComputedStyle(assistant).display !== 'none' && getComputedStyle(assistant).visibility === 'visible',
    };
  });
  if (connectState.left < -1 || connectState.right > connectState.viewportWidth + 1) {
    failures.push(`runtime utilities: Connect panel is clipped on phone (${JSON.stringify(connectState)})`);
  }
  const connectRightGutter = connectState.viewportWidth - connectState.right;
  if (Math.abs(connectState.left - connectRightGutter) > 1
      || connectState.left < 7 || connectState.left > 11) {
    failures.push(`runtime utilities: Connect panel phone gutters are not equal and compact (${JSON.stringify(connectState)})`);
  }
  if (connectState.assistantVisible) failures.push('runtime utilities: assistant launcher remains visible over the open Connect panel');
  await runtimePage.locator('.mdn-cn-close').click();
  if (!await runtimePage.locator('.mdn-cn-launch').evaluate((node) => document.activeElement === node && getComputedStyle(node).visibility === 'visible')) {
    failures.push('runtime utilities: Connect close does not return visible focus to its native launcher');
  }
  await runtimePage.evaluate(() => window.scrollTo({ top: scrollY + document.querySelector('.mond-footer').getBoundingClientRect().top - (innerHeight - 40), behavior: 'instant' }));
  await runtimePage.waitForFunction(() => {
    const footerTop = document.querySelector('.mond-footer').getBoundingClientRect().top;
    return footerTop < innerHeight && [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].every(node => getComputedStyle(node).visibility === 'hidden' && getComputedStyle(node).pointerEvents === 'none');
  });
  await checkFloatingSupport(runtimePage, 'runtime utilities/390/footer-entry');
  await runtimePage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await runtimePage.waitForFunction(() => [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')]
    .every((node) => getComputedStyle(node).visibility === 'hidden'));
  const footerUtilityState = await runtimePage.evaluate(() => {
    const headerBottom = document.querySelector('#siteHeader').getBoundingClientRect().bottom;
    return [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { top: box.top, bottom: box.bottom, headerBottom, visibility: style.visibility, pointerEvents: style.pointerEvents };
    });
  });
  if (footerUtilityState.some((item) => item.visibility !== 'hidden' || item.pointerEvents !== 'none')) {
    failures.push(`runtime utilities: launchers remain interactive over the phone footer (${JSON.stringify(footerUtilityState)})`);
  }
  await runtimePage.locator('.mond-footer a[href="connect.html"]').click({ trial: true });
  await runtimePage.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), runtimeClearScrollY);
  await runtimePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await runtimePage.locator('#mnd-launcher,.mdn-cn-launch').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).visibility === 'visible')), 'runtime utilities: controls return within two frames after leaving the footer');
  await checkFloatingSupport(runtimePage, 'runtime utilities/390/footer-restored');
  await runtimePage.close();

  for (const width of [768, 1180, 1181, 1440]) {
    const utilityPage = await browser.newPage({ viewport: { width, height: 1024 } });
    await utilityPage.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') await route.continue();
      else await route.abort();
    });
    await navigateToStableDocument(utilityPage, `${base}/index.html`);
    await utilityPage.locator('.mdn-cn-launch').waitFor({ state: 'attached' });
    await utilityPage.locator('#mnd-launcher').waitFor({ state: 'attached' });
    await checkFloatingSupport(utilityPage, `runtime utilities/${width}`);
    const utilityGeometry = await utilityPage.evaluate(() => {
      const box = (selector) => {
        const node = document.querySelector(selector);
        const rect = node.getBoundingClientRect();
        const label = node.querySelector('span')?.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, labelWidth: label?.width || 0, display: getComputedStyle(node).display };
      };
      return { contact: box('.mdn-cn-launch'), assistant: box('#mnd-launcher') };
    });
    if (utilityGeometry.contact.display === 'none'
        || utilityGeometry.assistant.display === 'none') {
      failures.push(`runtime utilities/${width}: native floating controls are missing (${JSON.stringify(utilityGeometry)})`);
    }
    await utilityPage.close();
  }

  // Exercise the complete canonical navigation on every page, rather than
  // inferring mobile usability from identical markup alone. Chromium covers
  // compact phone through landscape tablet; WebKit repeats the iPhone and
  // iPad widths that prompted this repair.
  async function sweepResponsiveHeaders(browserType, engineName, responsiveViewports) {
    const engine = await browserType.launch({ headless: true });
    try {
      for (const viewport of responsiveViewports) {
        for (const pageName of canonicalPages) {
          const page = await engine.newPage({ viewport });
          await page.route('**/*', async (route) => {
            const url = new URL(route.request().url());
            if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') await route.continue();
            else await route.abort();
          });
          await navigateToStableDocument(page, `${base}/${pageName}`);
          await page.locator('.site-menu-button').waitFor({ state: 'visible' }).catch(error => { throw new Error(`${engineName}/${viewport.width}/${pageName}: mobile menu unavailable: ${error.message}`); });

          const closed = await page.evaluate(() => {
            const box = (selector) => {
              const rect = document.querySelector(selector).getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
            };
            return {
              header: box('#siteHeader'),
              brand: box('#siteHeader .brand'),
              menu: box('#siteHeader .site-menu-button'),
              navDisplay: getComputedStyle(document.querySelector('#siteHeader .nav')).display,
              assistantDisplay: getComputedStyle(document.querySelector('#mnd-launcher')).display,
              contactDisplay: getComputedStyle(document.querySelector('.mdn-cn-launch')).display,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
            };
          });
          const label = `${pageName}/${engineName}/${viewport.width}`;
          if (Math.abs(closed.header.height - 70) > 1 || Math.abs(closed.header.left) > 1 || Math.abs(closed.header.right - viewport.width) > 1) {
            failures.push(`${label}: closed header left the shared 70px frame (${JSON.stringify(closed.header)})`);
          }
          if (Math.abs(closed.brand.left - 20) > 1 || Math.abs(closed.menu.right - (viewport.width - 20)) > 1) {
            failures.push(`${label}: closed header side insets are unbalanced (${JSON.stringify({ brand: closed.brand, menu: closed.menu })})`);
          }
          if (Math.abs((closed.brand.top + closed.brand.bottom) / 2 - 35) > 1 || Math.abs((closed.menu.top + closed.menu.bottom) / 2 - 35) > 1) {
            failures.push(`${label}: closed header controls are not vertically centered`);
          }
          if (closed.menu.width < 44 || closed.menu.height < 44 || closed.navDisplay !== 'none' || closed.documentWidth > closed.viewportWidth + 1) {
            failures.push(`${label}: closed navigation is clipped, exposed, or undersized (${JSON.stringify(closed)})`);
          }
          if (closed.assistantDisplay === 'none' || closed.contactDisplay === 'none') {
            failures.push(`${label}: native floating support controls are missing (${JSON.stringify(closed)})`);
          }

          await page.locator('.site-menu-button').click();
          const opened = await page.evaluate(() => {
            const rect = (selector) => {
              const box = document.querySelector(selector).getBoundingClientRect();
              return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
            };
            const header = document.querySelector('#siteHeader');
            const nav = document.querySelector('#siteHeader .nav');
            const search = document.querySelector('#siteHeader .site-search-button');
            const entry = document.querySelector('#siteHeader .site-entry-link');
            const support = [...document.querySelectorAll('#siteHeader .site-widget-action')].map((node) => {
              const box = node.getBoundingClientRect();
              return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
            });
            return {
              header: rect('#siteHeader'),
              nav: rect('#siteHeader .nav'),
              search: rect('#siteHeader .site-search-button'),
              entry: rect('#siteHeader .site-entry-link'),
              navDisplay: getComputedStyle(nav).display,
              overflowY: getComputedStyle(header).overflowY,
              headerClientHeight: header.clientHeight,
              headerScrollHeight: header.scrollHeight,
              expanded: document.querySelector('.site-menu-button').getAttribute('aria-expanded'),
              searchLabel: document.querySelector('.site-search-label')?.textContent?.trim(),
              support,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth,
            };
          });
          if (opened.navDisplay !== 'flex' || opened.expanded !== 'true' || opened.header.height > viewport.height + 1 || opened.overflowY !== 'auto') {
            failures.push(`${label}: open navigation is not a viewport-bounded scroll region (${JSON.stringify(opened)})`);
          }
          if (Math.abs(opened.nav.left - 20) > 1 || Math.abs(opened.nav.right - (viewport.width - 20)) > 1) {
            failures.push(`${label}: open navigation rails are unbalanced (${JSON.stringify(opened.nav)})`);
          }
          if (Math.abs(opened.search.width - opened.nav.width) > 1 || Math.abs(opened.entry.width - opened.nav.width) > 1 || opened.search.height < 44 || opened.entry.height < 44 || opened.searchLabel !== 'Search') {
            failures.push(`${label}: Search and primary action are not balanced full-width touch rows (${JSON.stringify(opened)})`);
          }
          if (opened.support.length !== 0) {
            failures.push(`${label}: support controls remain in the compact menu (${JSON.stringify(opened.support)})`);
          }
          if (opened.documentWidth > opened.viewportWidth + 1) failures.push(`${label}: opening the navigation creates horizontal overflow`);

          // Escape belongs to the open search dialog, not its underlying menu.
          // Closing both left focus on a hidden Search button on compact screens.
          await page.locator('.site-search-button').click();
          await page.locator('.site-search-input').focus();
          await page.keyboard.press('Shift+Tab');
          if (!await page.locator('.site-search-close').evaluate(node => node === document.activeElement)) failures.push(`${label}: reverse Tab escaped the empty search dialog`);
          await page.keyboard.press('Tab');
          if (!await page.locator('.site-search-input').evaluate(node => node === document.activeElement)) failures.push(`${label}: forward Tab escaped the empty search dialog`);
          await page.keyboard.press('Escape');
          if (!await page.locator('.site-search-button').evaluate(node => node === document.activeElement && node.getClientRects().length > 0)) failures.push(`${label}: search dismissal did not restore visible trigger focus`);

          await page.locator('#siteHeader .nav-parent').first().scrollIntoViewIfNeeded();
          await page.locator('#siteHeader .nav-parent').first().click();
          const submenu = await page.evaluate(() => {
            const header = document.querySelector('#siteHeader');
            const dropdown = document.querySelector('#siteHeader .nav-menu.is-open .nav-dropdown');
            const box = dropdown?.getBoundingClientRect();
            return {
              openMenus: document.querySelectorAll('#siteHeader .nav-menu.is-open').length,
              parentExpanded: document.querySelector('#siteHeader .nav-parent')?.getAttribute('aria-expanded'),
              display: dropdown ? getComputedStyle(dropdown).display : 'missing',
              left: box?.left,
              right: box?.right,
              headerClientHeight: header.clientHeight,
              headerScrollHeight: header.scrollHeight,
            };
          });
          if (submenu.openMenus !== 1 || submenu.parentExpanded !== 'true' || submenu.display !== 'grid' || submenu.left < 19 || submenu.right > viewport.width - 19) {
            failures.push(`${label}: submenu is missing, clipped, or permits competing open menus (${JSON.stringify(submenu)})`);
          }

          await page.keyboard.press('Escape');
          const closedByKeyboard = await page.locator('.site-menu-button').getAttribute('aria-expanded');
          if (closedByKeyboard !== 'false') failures.push(`${label}: Escape did not close the mobile navigation`);
          await checkFloatingSupport(page, label);
          await page.close();
        }
      }
    } finally {
      await engine.close();
    }
  }

  await sweepResponsiveHeaders(chromium, 'chromium', [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]);
  await sweepResponsiveHeaders(webkit, 'webkit', [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]);

  // The fixed mobile shell must expose its navigation above page content, and
  // short use-case heroes must begin below that shell rather than beneath it.
  for (const pageName of [
    'new-in-the-role.html',
    'after-an-acquisition.html',
    'transformation-behind-schedule.html',
    'after-a-reorganization.html',
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') await route.continue();
      else await route.abort();
    });
    await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
    const resting = await page.evaluate(() => ({
      headerBottom: document.querySelector('#siteHeader').getBoundingClientRect().bottom,
      eyebrowTop: document.querySelector('main .hero .eyebrow').getBoundingClientRect().top,
    }));
    if (resting.eyebrowTop < resting.headerBottom + 20) {
      failures.push(`${pageName}/iphone: hero begins beneath the fixed header (${JSON.stringify(resting)})`);
    }
    await page.locator('.site-menu-button').click();
    const opened = await page.evaluate(() => {
      const headerBox = document.querySelector('#siteHeader').getBoundingClientRect();
      const navBox = document.querySelector('#siteHeader .nav').getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.max(1, Math.min(navBox.left + 24, innerWidth - 1)),
        Math.max(1, Math.min(navBox.top + 24, innerHeight - 1)),
      );
      return {
        headerBottom: headerBox.bottom,
        navBottom: navBox.bottom,
        navDisplay: getComputedStyle(document.querySelector('#siteHeader .nav')).display,
        navReceivesPointer: Boolean(hit?.closest('#siteHeader .nav')),
      };
    });
    if (opened.navDisplay !== 'flex' || opened.navBottom > opened.headerBottom + 1 || !opened.navReceivesPointer) {
      failures.push(`${pageName}/iphone: expanded mobile navigation is clipped or obscured (${JSON.stringify(opened)})`);
    }
    await page.close();
  }

  for (const viewport of [{ name: 'compact-phone', width: 320, height: 700 }, { name: 'iphone', width: 390, height: 844 }]) {
    const briefPage = await browser.newPage({ viewport });
    await briefPage.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
        await route.continue();
      } else {
        await route.abort();
      }
    });
    await briefPage.goto(`${base}/Monderman_Platform_Brief.html`, { waitUntil: 'load', timeout: 30000 });

    const briefLayout = await briefPage.evaluate(() => {
      const progress = document.querySelector('.progress');
      const artifact = document.querySelector('.artifact-row');
      const numberBox = artifact.querySelector('.artifact-num').getBoundingClientRect();
      const titleBox = artifact.querySelector('strong').getBoundingClientRect();
      const descriptionBox = artifact.querySelector('span:last-child').getBoundingClientRect();
      const evidence = document.querySelector('.evidence-step');
      const nodeBox = evidence.querySelector('.evidence-node').getBoundingClientRect();
      const evidenceTitleBox = evidence.querySelector('strong').getBoundingClientRect();
      const evidenceDescriptionBox = evidence.querySelector('span').getBoundingClientRect();
      return {
        progressDisplay: getComputedStyle(progress).display,
        scrollSnapType: getComputedStyle(document.documentElement).scrollSnapType,
        artifact: {
          numberLeft: numberBox.left,
          numberRight: numberBox.right,
          titleLeft: titleBox.left,
          titleWidth: titleBox.width,
          descriptionLeft: descriptionBox.left,
          descriptionTop: descriptionBox.top,
          titleBottom: titleBox.bottom,
        },
        evidence: {
          nodeRight: nodeBox.right,
          titleLeft: evidenceTitleBox.left,
          titleWidth: evidenceTitleBox.width,
          descriptionLeft: evidenceDescriptionBox.left,
          descriptionWidth: evidenceDescriptionBox.width,
          descriptionTop: evidenceDescriptionBox.top,
          titleBottom: evidenceTitleBox.bottom,
        },
      };
    });

    if (briefLayout.progressDisplay !== 'none' || briefLayout.scrollSnapType !== 'none') {
      failures.push(`Platform Brief/${viewport.name}: broken phone slide rail or snapping remains (${JSON.stringify(briefLayout)})`);
    }
    if (briefLayout.artifact.titleLeft <= briefLayout.artifact.numberRight || briefLayout.artifact.titleWidth < 200 || briefLayout.artifact.descriptionLeft !== briefLayout.artifact.titleLeft || briefLayout.artifact.descriptionTop < briefLayout.artifact.titleBottom) {
      failures.push(`Platform Brief/${viewport.name}: artifact hierarchy is mis-gridded (${JSON.stringify(briefLayout.artifact)})`);
    }
    if (briefLayout.evidence.titleLeft <= briefLayout.evidence.nodeRight || briefLayout.evidence.titleWidth < 190 || briefLayout.evidence.descriptionLeft !== briefLayout.evidence.titleLeft || briefLayout.evidence.descriptionWidth < 190 || briefLayout.evidence.descriptionTop < briefLayout.evidence.titleBottom) {
      failures.push(`Platform Brief/${viewport.name}: evidence hierarchy is mis-gridded (${JSON.stringify(briefLayout.evidence)})`);
    }
    await briefPage.close();
  }

  for (const width of [640, 641, 680, 681]) {
    const briefPage = await browser.newPage({ viewport: { width, height: 844 } });
    await briefPage.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === localOrigin || url.protocol === 'data:' || url.protocol === 'blob:') {
        await route.continue();
      } else {
        await route.abort();
      }
    });
    await briefPage.goto(`${base}/Monderman_Platform_Brief.html`, { waitUntil: 'load', timeout: 30000 });
    const rows = await briefPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      items: [...document.querySelectorAll('.artifact-row')].map((row) => {
        const rowBox = row.getBoundingClientRect();
        const numberBox = row.querySelector('.artifact-num').getBoundingClientRect();
        const titleBox = row.querySelector('strong').getBoundingClientRect();
        const descriptionBox = row.querySelector('span:last-child').getBoundingClientRect();
        return {
          columns: getComputedStyle(row).gridTemplateColumns.trim().split(/\s+/).length,
          numberLeft: numberBox.left - rowBox.left,
          numberRight: numberBox.right - rowBox.left,
          titleLeft: titleBox.left - rowBox.left,
          titleRight: titleBox.right - rowBox.left,
          titleWidth: titleBox.width,
          titleBottom: titleBox.bottom - rowBox.top,
          descriptionLeft: descriptionBox.left - rowBox.left,
          descriptionTop: descriptionBox.top - rowBox.top,
        };
      }),
    }));
    if (rows.overflow > 1 || rows.items.length !== 5) {
      failures.push(`Platform Brief/${width}px: artifact seam has overflow or missing rows (${JSON.stringify(rows)})`);
    }
    rows.items.forEach((row, index) => {
      if (width <= 680) {
        if (row.columns !== 2 || row.numberLeft > 1 || row.titleLeft <= row.numberRight || row.titleWidth < 200 || Math.abs(row.descriptionLeft - row.titleLeft) > 1 || row.descriptionTop < row.titleBottom) {
          failures.push(`Platform Brief/${width}px/row-${index + 1}: two-column artifact hierarchy failed (${JSON.stringify(row)})`);
        }
      } else if (row.columns !== 3 || row.numberLeft > 1 || row.titleLeft <= row.numberRight || row.descriptionLeft <= row.titleLeft) {
        failures.push(`Platform Brief/${width}px/row-${index + 1}: desktop artifact hierarchy failed (${JSON.stringify(row)})`);
      }
    });
    await briefPage.close();
  }

  assert.deepEqual(failures, [], `mobile site presentation failures:\n${failures.join('\n')}`);
  console.log(`mobile site presentation smoke: passed ${pages.length} pages across ${viewports.length} phone and tablet widths`);
} finally {
  await browser.close();
}
