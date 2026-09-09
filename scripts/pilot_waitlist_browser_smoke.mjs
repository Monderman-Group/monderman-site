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
    let submitted = null;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://api.monderman.com/api/health", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
    await page.route("https://api.monderman.com/api/pilot-waitlist", async (route) => {
      submitted = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true, requestId: submitted.requestId }) });
    });
    await page.route("https://monderman-api.onrender.com/api/first-run-events", (route) => route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' }));

    await page.goto(`${base}/pilot.html?source=decision_velocity`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(await page.locator("h1").count(), 1, `${browserName}/${viewport.name}: pilot h1 missing`);
    assert.equal(await page.locator('input[name="completedDecisionVelocity"]').isChecked(), true, `${browserName}/${viewport.name}: Decision Velocity completion was not carried into the application`);
    assert.equal(await page.locator('script[src^="assistant.js"]').count(), 1, `${browserName}/${viewport.name}: assistant missing`);
    assert.equal(await page.locator('footer a[aria-label="Monderman on LinkedIn"]').count(), 1, `${browserName}/${viewport.name}: social footer missing`);
    const pilotAction = page.locator(".pilot-primary").first();
    const pilotBackground = await pilotAction.evaluate((node) => getComputedStyle(node).backgroundColor);
    const expectedPilotBackground = "rgb(169, 208, 212)";
    assert.equal(pilotBackground, expectedPilotBackground, `${browserName}/${viewport.name}: pilot action hierarchy is incorrect`);
    const pilotColor = await pilotAction.evaluate((node) => getComputedStyle(node).color);
    const expectedPilotColor = "rgb(4, 24, 27)";
    assert.equal(pilotColor, expectedPilotColor, `${browserName}/${viewport.name}: pilot action lost its legible dark-surface treatment`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${browserName}/${viewport.name}: pilot page overflows by ${overflow}px`);

    await page.locator('input[name="fullName"]').fill("Pilot Funnel Certification");
    await page.locator('input[name="workEmail"]').fill("pilot-certification@example.com");
    await page.locator('input[name="organization"]').fill("Monderman Certification Fixture");
    await page.locator('textarea[name="decisionFocus"]').fill("Decision rights across one bounded operating unit.");
    await page.locator('input[name="privacyConsent"]').check();
    await page.locator("#pilotSubmit").click();
    await page.locator("#pilotConfirmation").waitFor({ state: "visible", timeout: 15000 });
    assert.equal(submitted?.source, "decision_velocity");
    assert.equal(submitted?.completedDecisionVelocity, true);
    assert.equal(submitted?.privacyConsent, true);
    assert.match(submitted?.requestId || "", /^[0-9a-f-]{36}$/i);
    assert.match(submitted?.journeyId || "", /^[0-9a-f-]{36}$/i);
    assert.deepEqual(pageErrors, [], `${browserName}/${viewport.name}: ${pageErrors.join("; ")}`);
    await context.close();
  }
  await browser.close();
  console.log(`PILOT_WAITLIST_BROWSER_PASS_${browserName.toUpperCase()}`);
}
