import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = String(process.env.REPORT_BASE || "http://127.0.0.1:8080").replace(/\/+$/, "");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname),
  "IP recovery browser fixtures may run only against a loopback server, never production");
const fixture = JSON.parse(readFileSync(new URL("../test-fixtures/authenticated-report-engine-runs.json", import.meta.url), "utf8"));
const source = fixture.outputs.institutional_performance;
assert.ok(source?.result?.exposure?.annual_cost > 0, "Institutional Performance fixture needs annual cost");

async function render(browser, result) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  // Local fixtures must not reach provider, authentication or admission APIs.
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
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

async function scenarioRows(page) {
  return page.locator("#capacityFlow .mvg-scenario > div").evaluateAll(rows =>
    Object.fromEntries(rows.map(row => [row.querySelector("dt").textContent, row.querySelector("dd").textContent])));
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
  const missingRows = await scenarioRows(missingPage);
  assert.equal(Object.hasOwn(missingRows, "Modeled recovery scenario"), false,
    "unpublished recovery must not appear as an estimated amount or invented zero");
  assert.equal(missingRows["Modeled annual labor cost"], "$131,820",
    "missing recovery must not suppress the independently published annual cost");
  assert.match(await missingPage.locator("#capacityFlow").innerText(), /not measured time or realized savings/);
  assert.equal(await missingPage.locator("#capacityFlow svg").count(), 0,
    "the published-only scenario must not render an inferred allocation flow");
  assert.deepEqual(missingErrors, [], `missing-recovery browser errors: ${missingErrors.join(" | ")}`);
  await missingPage.close();

  const { page: publishedPage, pageErrors: publishedErrors } = await render(browser, structuredClone(source.result));
  assert.notEqual((await publishedPage.locator("#reclaimValue").innerText()).trim(), "Not estimated");
  assert.doesNotMatch(await publishedPage.locator("#reclaimValue").innerText(), /^--$/);
  assert.equal((await scenarioRows(publishedPage))["Modeled recovery scenario"], "$47,455",
    "published backend recovery must be displayed exactly, without allocation or substitution");
  assert.equal(await publishedPage.locator("#capacityFlow svg").count(), 0,
    "a published recovery estimate is not evidence for a dimension-dollar flow");
  assert.deepEqual(publishedErrors, [], `published-recovery browser errors: ${publishedErrors.join(" | ")}`);
  await publishedPage.close();

  const zero = structuredClone(source.result);
  zero.exposure.recoverable_cost = 0;
  const { page: zeroPage, pageErrors: zeroErrors } = await render(browser, zero);
  assert.equal((await scenarioRows(zeroPage))["Modeled recovery scenario"], "$0",
    "a genuine published zero must remain different from a missing estimate");
  assert.deepEqual(zeroErrors, []);
  await zeroPage.close();

  for (const flags of [{ priceable: false }, { cost_estimated: false }, { sizing_status: "input_saturation" }]) {
    const withheld = structuredClone(source.result);
    Object.assign(withheld.exposure, flags); // Keep contradictory numeric remnants to exercise the guard.
    const { page, pageErrors } = await render(browser, withheld);
    const rows = await scenarioRows(page);
    assert.equal(Object.hasOwn(rows, "Modeled recovery scenario"), false, `withheld recovery leaked: ${JSON.stringify(flags)}`);
    assert.equal(Object.hasOwn(rows, "Modeled annual labor cost"), false, `withheld cost leaked: ${JSON.stringify(flags)}`);
    assert.equal(rows["Assumed annual participant capacity"], "32,400 hours");
    assert.match(await page.locator("#capacityFlow").innerText(), /estimates (?:were not published|are withheld)/);
    assert.equal(await page.locator("#capacityFlow svg").count(), 0);
    assert.deepEqual(pageErrors, []);
    await page.close();
  }

  console.log("IP_MISSING_RECOVERY_BROWSER=PASS cases=6 missing_recovery=withheld published_recovery=exact genuine_zero=retained contradictory_withheld_values=hidden allocation_flow=absent");
} finally {
  await browser.close();
}
