import assert from "node:assert/strict";
import { chromium } from "playwright";

if (process.env.RUN_LIVE_ANONYMOUS_SMOKE !== "1") {
  console.error("Set RUN_LIVE_ANONYMOUS_SMOKE=1 to run this bounded production-API check.");
  process.exit(2);
}

const base = process.env.SITE_BASE || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const requestFailures = [];
const apiTrace = [];
page.on("requestfailed", (request) => {
  if (request.url().includes("monderman-api.onrender.com")) requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`);
});
await page.route("https://monderman-api.onrender.com/**", async (route) => {
  const request = route.request();
  const url = request.url();
  if (url.endsWith("/api/first-run-events")) {
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
    return;
  }
  const headers = { origin: "https://www.monderman.com" };
  const contentType = request.headers()["content-type"];
  if (contentType) headers["content-type"] = contentType;
  const authorization = request.headers().authorization;
  if (authorization) headers.authorization = authorization;
  const response = await fetch(url, {
    method: request.method(),
    headers,
    body: ["GET", "HEAD"].includes(request.method()) ? undefined : request.postDataBuffer()
  });
  const responseBody = Buffer.from(await response.arrayBuffer());
  if (!response.ok || url.includes("/decision-velocity/run/start")) {
    apiTrace.push({ method: request.method(), url, status: response.status, body: responseBody.toString("utf8").slice(0, 500) });
  }
  await route.fulfill({
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body: responseBody
  });
});

try {
  await page.goto(`${base}/decision-velocity.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
  await page.locator('[data-lane="managerial"]').click();
  await page.locator("#laneContinueBtn").click();
  await page.locator('[data-depth="10"]').click();
  await page.locator("#depthContinueBtn").click();
  await page.locator("#preStartConsent").check();
  await page.locator(".preflight-gate-next").click();

  const textValues = {
    processName: "Routine vendor exception approval",
    businessUnit: "Fabricated Pilot Operations",
    description: "A fabricated customer path used only for anonymous product readiness verification."
  };
  const numberValues = {
    employeeCount: "250",
    peopleInvolved: "8",
    hourlyCost: "90",
    annualVolume: "24",
    meetingHours: "3"
  };
  const choiceValues = {
    industry: "technology_software",
    regulatoryIntensity: "moderate",
    decisionType: "program"
  };

  for (let index = 0; index < 11; index += 1) {
    const field = page.locator("#preflightContextMount .field:visible");
    const id = await field.getAttribute("data-field-id");
    assert.ok(id, `preflight field ${index + 1} is missing its identifier`);
    if (choiceValues[id]) {
      await field.locator(`.opt-choice[data-val="${choiceValues[id]}"]`).click();
    } else {
      const input = field.locator("input:not([hidden]), textarea").first();
      await input.fill(textValues[id] || numberValues[id] || "Fabricated readiness input");
    }
    await page.locator(".preflight-next").click();
  }

  try {
    await page.locator("#questionStage.active").waitFor({ timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      headline: document.getElementById("envHeadline")?.textContent,
      subcopy: document.getElementById("envSubcopy")?.textContent,
      toast: document.querySelector(".toast.show")?.textContent,
      activeStage: document.querySelector(".stage.active")?.id
    }));
    throw new Error(`anonymous start did not reach question stage: ${JSON.stringify({ state, requestFailures, apiTrace })}`, { cause: error });
  }
  for (let turn = 0; turn < 80; turn += 1) {
    if (await page.locator("#mdmTeaserOverlay").count()) break;
    if (await page.locator("#resultsStage.active").count()) break;
    if (await page.locator("#processingStage.active").count()) {
      await page.waitForTimeout(1000);
      continue;
    }
    const item = await page.evaluate(() => window.__mondermanTestHooks?.getState()?.currentItem || null);
    if (!item) {
      await page.waitForTimeout(500);
      continue;
    }
    if (item.isOptional && await page.locator("#skipBtn:visible").count()) {
      await page.locator("#skipBtn").click();
    } else if (item.questionType === "single_select") {
      await page.locator("#questionBody .choice").first().click();
    } else if (item.questionType === "multi_select") {
      await page.locator("#questionBody .choice").first().click();
      await page.locator("#continueBtn").click();
    } else {
      await page.locator("#questionBody input, #questionBody textarea").first().fill(item.questionType === "numeric" ? "5" : "Fabricated readiness input");
      await page.locator("#continueBtn").click();
    }
    await page.waitForTimeout(450);
  }

  await page.locator("#mdmTeaserOverlay").waitFor({ state: "visible", timeout: 120000 });
  const teaserText = await page.locator("#mdmTeaserOverlay").innerText();
  assert.match(teaserText, /\b\d{1,3}\b\s*\/\s*100/);
  assert.match(teaserText, /Create account \/ sign in/);
  assert.equal(await page.locator('#mdmTeaserOverlay a[href^="signin.html"]').count(), 1);
  console.log("ANONYMOUS_DECISION_VELOCITY_LIVE_PASS");
} finally {
  await context.close();
  await browser.close();
}
