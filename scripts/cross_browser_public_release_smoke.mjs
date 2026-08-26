import { chromium, webkit } from 'playwright';

const base = process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';

function assert(value, message) {
  if (!value) throw new Error(message);
}

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/supabase|connect|assistant|favicon/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  assert(await page.locator('main#main-content').count() === 1, `${browserName}: homepage main landmark missing`);
  assert(await page.locator('.skip-link').getAttribute('href') === '#main-content', `${browserName}: homepage skip link missing`);

  await page.goto(`${base}/sample-report.html#os`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('body.production-samples-ready').waitFor({ timeout: 30000 });
  assert(await page.locator('main#main-content').count() === 1, `${browserName}: sample main landmark missing`);
  assert(await page.locator('h1:visible').count() === 1, `${browserName}: sample visible h1 hierarchy is ambiguous`);

  await page.locator('#tab-os').focus();
  await page.keyboard.press('ArrowRight');
  assert(await page.locator('#tab-dv').getAttribute('aria-selected') === 'true', `${browserName}: report tabs do not support ArrowRight`);
  assert(await page.locator('.dx-tab[tabindex="0"]').count() === 1, `${browserName}: report tabs do not use one roving tab stop`);
  await page.keyboard.press('Home');
  assert(await page.locator('#tab-os').getAttribute('aria-selected') === 'true', `${browserName}: report tabs do not support Home`);

  const report = page.locator('#report-os');
  const [htmlDownload] = await Promise.all([
    page.waitForEvent('download'),
    report.getByRole('button', { name: 'Download HTML' }).click(),
  ]);
  assert(htmlDownload.suggestedFilename().endsWith('-executive-report.html'), `${browserName}: HTML report download failed`);
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    report.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  assert(jsonDownload.suggestedFilename().endsWith('.json'), `${browserName}: JSON report download failed`);
  const [printReport] = await Promise.all([
    page.waitForEvent('popup'),
    report.getByRole('button', { name: 'Print or save PDF' }).click(),
  ]);
  await printReport.waitForLoadState('domcontentloaded');
  assert(await printReport.locator('.mr-report').isVisible(), `${browserName}: print/PDF report did not open`);
  await printReport.close();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const key of ['os', 'dv', 'sc', 'ip', 'synthesis', 'depth']) {
    await page.locator(`#tab-${key}`).click();
    const fit = await page.locator(`#report-${key}`).evaluate(node => ({
      shellClient: node.clientWidth,
      shellScroll: node.scrollWidth,
      rootClient: document.documentElement.clientWidth,
      rootScroll: document.documentElement.scrollWidth,
    }));
    assert(fit.shellScroll <= fit.shellClient, `${browserName}: ${key} overflows its mobile report shell`);
    assert(fit.rootScroll <= fit.rootClient, `${browserName}: ${key} creates mobile page overflow`);
  }

  assert(errors.length === 0, `${browserName}: ${errors.join('\n')}`);
  await context.close();
  await browser.close();
  console.log(`CROSS_BROWSER_PUBLIC_RELEASE_PASS_${browserName.toUpperCase()}`);
}
