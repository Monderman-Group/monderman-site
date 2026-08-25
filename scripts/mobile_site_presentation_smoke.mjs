import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const out = process.env.MOBILE_OUT || '/tmp/mobile-site-presentation';
fs.mkdirSync(out, { recursive: true });

// Discover every customer-facing root HTML surface so newly added pages enter
// the sweep automatically. The Google ownership token is not a rendered page.
const pages = fs.readdirSync(process.cwd())
  .filter((name) => name.endsWith('.html') && !name.startsWith('google'))
  .sort();

const viewports = [
  { name: 'compact-phone', width: 320, height: 700 },
  { name: 'android', width: 360, height: 800 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'large-android', width: 430, height: 932 },
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

try {
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

      await page.goto(`${base}/${pageName}`, { waitUntil: 'load', timeout: 30000 });
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
          if (element.closest('.mf-motif,#turnstilePreload') || element.matches('.hero-image')) return [];

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

        return {
          viewportWidth,
          documentWidth: document.documentElement.scrollWidth,
          hasViewportMeta: Boolean(document.querySelector('meta[name="viewport"]')),
          clipped,
          pathologicalImages,
        };
      });

      if (!geometry.hasViewportMeta) failures.push(`${pageName}/${viewport.name}: viewport metadata missing`);
      if (geometry.documentWidth > geometry.viewportWidth + 1) failures.push(`${pageName}/${viewport.name}: page overflows horizontally (${geometry.documentWidth}px > ${geometry.viewportWidth}px)`);
      if (geometry.clipped.length) failures.push(`${pageName}/${viewport.name}: visible content is clipped (${JSON.stringify(geometry.clipped.slice(0, 5))})`);
      if (geometry.pathologicalImages.length) failures.push(`${pageName}/${viewport.name}: image ignores its responsive crop (${JSON.stringify(geometry.pathologicalImages)})`);

      if (pageName === 'about.html') {
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
        if (await tile.isVisible()) failures.push(`${pageName}/${viewport.name}: sample report tile is visible on a phone`);
        const focalPoint = await page.locator('.hero-image').evaluate((image) => getComputedStyle(image).objectPosition);
        if (focalPoint !== '48.75% 50%') failures.push(`${pageName}/${viewport.name}: architectural opening is not centered (${focalPoint})`);
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
  await runtimePage.locator('#mnd-launcher').waitFor({ state: 'visible' });
  await runtimePage.locator('.mdn-cn-launch').waitFor({ state: 'visible' });

  const connectLauncher = await runtimePage.locator('.mdn-cn-launch').evaluate((element) => {
    const box = element.getBoundingClientRect();
    const label = element.querySelector('span');
    const labelBox = label?.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      accessibleName: element.textContent?.trim(),
      labelWidth: labelBox?.width || 0,
    };
  });
  if (Math.abs(connectLauncher.width - 48) > 1 || Math.abs(connectLauncher.height - 48) > 1) {
    failures.push(`runtime utilities: Connect launcher is not a compact 48px phone target (${JSON.stringify(connectLauncher)})`);
  }
  if (connectLauncher.accessibleName !== 'Connect' || connectLauncher.labelWidth > 2) {
    failures.push(`runtime utilities: Connect label is not visually compact while remaining named (${JSON.stringify(connectLauncher)})`);
  }

  await runtimePage.locator('#mnd-launcher').click();
  const assistantState = await runtimePage.evaluate(() => {
    const panel = document.querySelector('#mnd-panel');
    const connect = document.querySelector('.mdn-cn-launch');
    const box = panel.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      width: box.width,
      viewportWidth: document.documentElement.clientWidth,
      connectVisible: getComputedStyle(connect).display !== 'none',
    };
  });
  if (assistantState.left < -1 || assistantState.right > assistantState.viewportWidth + 1 || assistantState.width < assistantState.viewportWidth - 2) {
    failures.push(`runtime utilities: assistant panel is clipped on phone (${JSON.stringify(assistantState)})`);
  }
  if (assistantState.connectVisible) failures.push('runtime utilities: Connect launcher remains visible over the open assistant');

  await runtimePage.locator('#mnd-close').click();
  await runtimePage.locator('.mdn-cn-launch').click();
  const connectState = await runtimePage.evaluate(() => {
    const panel = document.querySelector('#mdn-cn-panel');
    const assistant = document.querySelector('#mnd-launcher');
    const box = panel.getBoundingClientRect();
    return {
      left: box.left,
      right: box.right,
      viewportWidth: document.documentElement.clientWidth,
      assistantVisible: getComputedStyle(assistant).display !== 'none',
    };
  });
  if (connectState.left < -1 || connectState.right > connectState.viewportWidth + 1) {
    failures.push(`runtime utilities: Connect panel is clipped on phone (${JSON.stringify(connectState)})`);
  }
  if (connectState.assistantVisible) failures.push('runtime utilities: assistant launcher remains visible over the open Connect panel');
  await runtimePage.close();

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

  assert.deepEqual(failures, [], `mobile site presentation failures:\n${failures.join('\n')}`);
  console.log(`mobile site presentation smoke: passed ${pages.length} pages across ${viewports.length} phone widths`);
} finally {
  await browser.close();
}
