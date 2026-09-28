// Render the local publication body with the same licensed webfonts as the site.
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(process.argv[2]).href);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    if (!await page.evaluate(() => document.fonts.check('10pt "Neue Haas Grotesk TX Pro"'))) throw new Error('House font did not load');
    await page.pdf({ path: process.argv[3], preferCSSPageSize: true, printBackground: true, tagged: true });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
