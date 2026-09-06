import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = String(process.env.REPORT_BASE || "http://127.0.0.1:8080").replace(/\/+$/, "");
const fixture = JSON.parse(readFileSync(new URL("../test-fixtures/authenticated-report-engine-runs.json", import.meta.url), "utf8"));
const source = fixture.outputs.institutional_performance;
assert.ok(source?.result?.exposure?.annual_cost > 0, "Institutional Performance fixture needs annual cost");

async function render(browser, result) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  await page.route(/chart\.umd\.min\.js/i, (route) => route.fulfill({
    contentType: "application/javascript",
    body: "window.Chart=function Chart(){return {destroy(){}}};",
  }));
  await page.route(/(?:html2canvas|jspdf|supabase-js)/i, (route) => route.fulfill({
    contentType: "application/javascript",
    body: "",
  }));
  await page.addInitScript(({ result: injectedResult, payload }) => {
    window.__mondermanInjectedResult = { result: injectedResult, payload };
    window.supabase = window.supabase || { createClient() { return {}; } };
  }, { result, payload: source.input_context });
  await page.goto(`${base}/institutional-performance.html?assignment_token=${"a".repeat(32)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  try {
    await page.waitForFunction(() => window.__mondermanInjectionApplied === true, null, { timeout: 15_000 });
  } catch (error) {
    throw new Error(`Institutional Performance injection did not render at ${page.url()}: ${pageErrors.join(" | ") || error.message}`);
  }
  return { page, pageErrors };
}

const browser = await chromium.launch({ headless: true });
try {
  const missing = structuredClone(source.result);
  delete missing.reclaim_potential;
  delete missing.exposure.recoverable_cost;
  delete missing.exposure.recoverable_cost_low;
  delete missing.exposure.recoverable_cost_high;
  const { page: missingPage, pageErrors: missingErrors } = await render(browser, missing);
  assert.equal((await missingPage.locator("#reclaimValue").innerText()).trim(), "Not estimated");
  assert.match(await missingPage.locator("#reclaimSub").innerText(), /No recoverable-cost estimate was published/);
  assert.match(await missingPage.locator("#capacityFlow").innerText(), /no recoverable-cost estimate was published/i);
  assert.equal(await missingPage.locator("#capacityFlow svg").count(), 0,
    "missing recovery must not render a recoverable-dollar flow");
  assert.deepEqual(missingErrors, [], `missing-recovery browser errors: ${missingErrors.join(" | ")}`);
  await missingPage.close();

  const { page: publishedPage, pageErrors: publishedErrors } = await render(browser, structuredClone(source.result));
  assert.notEqual((await publishedPage.locator("#reclaimValue").innerText()).trim(), "Not estimated");
  assert.doesNotMatch(await publishedPage.locator("#reclaimValue").innerText(), /^--$/);
  assert.equal(await publishedPage.locator("#capacityFlow svg").count(), 1,
    "published backend recovery must render the capacity-flow graphic");
  assert.deepEqual(publishedErrors, [], `published-recovery browser errors: ${publishedErrors.join(" | ")}`);
  await publishedPage.close();

  console.log("IP_MISSING_RECOVERY_BROWSER=PASS annual_cost_without_recovery=withheld capacity_flow=not_charted published_recovery=rendered");
} finally {
  await browser.close();
}
