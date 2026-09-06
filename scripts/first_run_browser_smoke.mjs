import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const base = process.env.SITE_BASE || "http://127.0.0.1:4173";
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "iphone", width: 390, height: 844 }
];

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://monderman-api.onrender.com/api/first-run-events", (route) => route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' }));
    await page.route("https://monderman-api.onrender.com/api/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));

    await page.goto(`${base}/decision-velocity.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
    assert.match(page.url(), /decision-velocity\.html$/, `${browserName}/${viewport.name}: anonymous visitor was redirected`);
    assert.equal(await page.locator('[data-depth="10"]').evaluate((node) => node.classList.contains("has-recommended")), true);
    assert.equal(await page.locator('[data-depth="30"]').evaluate((node) => node.classList.contains("has-recommended")), false);
    await page.locator('[data-lane="managerial"]').click();
    await page.locator("#laneContinueBtn").click();
    await page.locator('[data-depth="10"]').click();
    await page.locator("#depthContinueBtn").click();
    assert.equal(await page.locator("#introStage").evaluate((node) => node.classList.contains("active")), true);
    assert.equal(await page.locator("#beginBtn").textContent(), "Begin Diagnostic →");

    await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(await page.locator(".first-run-moment").count(), 4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${browserName}/${viewport.name}: homepage overflows by ${overflow}px`);

    for (const moment of ["new-in-the-role.html", "after-an-acquisition.html", "transformation-behind-schedule.html", "after-a-reorganization.html"]) {
      await page.goto(`${base}/${moment}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      assert.equal(await page.locator("h1").count(), 1, `${browserName}/${viewport.name}/${moment}: h1 missing`);
      assert.equal(await page.locator('[data-first-run-event="primary_cta_clicked"]').count(), 1, `${browserName}/${viewport.name}/${moment}: primary action missing`);
      assert.equal(await page.locator('script[src^="assistant.js"]').count(), 1, `${browserName}/${viewport.name}/${moment}: assistant missing`);
      assert.equal(await page.locator('footer a[aria-label="Monderman on LinkedIn"]').count(), 1, `${browserName}/${viewport.name}/${moment}: social footer missing`);
    }

    assert.deepEqual(pageErrors, [], `${browserName}/${viewport.name}: ${pageErrors.join("; ")}`);
    await context.close();
  }
  await browser.close();
  console.log(`FIRST_RUN_BROWSER_PASS_${browserName.toUpperCase()}`);
}
