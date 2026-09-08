import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

if (process.env.RUN_LIVE_ANONYMOUS_SMOKE !== "1" || !/^[a-f0-9]{40}$/.test(process.env.APPROVED_SITE_REVISION || '') || !/^[a-f0-9]{40}$/.test(process.env.APPROVED_API_REVISION || '')) {
  console.error("Requires explicit deployment approval, RUN_LIVE_ANONYMOUS_SMOKE=1, APPROVED_SITE_REVISION and APPROVED_API_REVISION. Creates one fabricated anonymous production run; does not test email delivery.");
  process.exit(2);
}

const base = process.env.SITE_BASE || "https://www.monderman.com";
assert.equal(base, 'https://www.monderman.com', 'Live smoke must use the actual approved public origin');
const useWebkit = process.env.SMOKE_BROWSER === 'webkit';
const browser = await (useWebkit ? webkit : chromium).launch({ headless: true });
const context = await browser.newContext({ viewport: useWebkit ? {width:390,height:844} : { width: 1440, height: 1000 } });
const page = await context.newPage();
const requestFailures = [];
const apiTrace = [];
page.on("requestfailed", (request) => {
  if (request.url().includes("monderman-api.onrender.com")) requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`);
});
// Observe the real browser requests: no proxy, forged Origin, or mocked service.
page.on('response', response => {
  if (response.url().includes('/api/decision-velocity/run/')) apiTrace.push({status:response.status(),path:new URL(response.url()).pathname});
});

try {
  const deployedSite = await context.request.get(`${base}/.well-known/monderman-release.json`);
  assert.equal((await deployedSite.json()).revision, process.env.APPROVED_SITE_REVISION);
  const deployedApi = await context.request.get('https://monderman-api.onrender.com/api/health');
  assert.equal((await deployedApi.json()).release?.revision, process.env.APPROVED_API_REVISION);
  await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('.hero-actions a[href="decision-velocity.html?source=homepage"]').click();
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
    if (await page.locator(".dv-result-dialog__panel").count()) break;
    if (await page.locator("#resultsStage.active").count()) break;
    if (await page.locator("#processingStage.active").count()) {
      await page.waitForTimeout(1000);
      continue;
    }
    const item = await page.evaluate(() => {
      const body = document.getElementById('questionBody');
      if (!body?.children.length) return null;
      const type = body.querySelector('[data-numeric-input]') ? 'numeric' : body.querySelector('textarea') ? 'text' : body.querySelector('.ms-box') ? 'multi_select' : body.querySelector('.choice') ? 'single_select' : null;
      return type ? {questionType:type, isOptional:type==='text'} : null;
    });
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

  await page.locator(".dv-result-dialog__panel").waitFor({ state: "visible", timeout: 120000 });
  const teaserText = await page.locator(".dv-result-dialog__panel").innerText();
  assert.match(teaserText, /\b\d{1,3}\b\s*\/\s*100/);
  assert.match(teaserText, /Create account \/ sign in/);
  assert.equal(await page.locator('.dv-result-dialog__panel a[href^="signin.html"]').count(), 1);
  assert.equal(apiTrace.filter(request=>request.path.endsWith('/start')).length, 1);
  const beforeRefresh=apiTrace.filter(request=>/\/(answer|start)$/.test(request.path)).length;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.dv-result-dialog__panel').waitFor({state:'visible',timeout:120000});
  assert.equal(apiTrace.filter(request=>/\/(answer|start)$/.test(request.path)).length,beforeRefresh);
  assert.equal(await page.locator('.dv-result-dialog__panel').innerText(),teaserText);
  assert.deepEqual(requestFailures,[]);
  assert.ok(apiTrace.every(request=>request.status===200),JSON.stringify(apiTrace));
  if (process.env.SCREENSHOT_OUT) {
    await page.screenshot({ path: process.env.SCREENSHOT_OUT, fullPage: true });
  }
  console.log("ANONYMOUS_DECISION_VELOCITY_LIVE_PASS");
} finally {
  await context.close();
  await browser.close();
}
