import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const base = process.env.PILOT_FEEDBACK_BASE || "http://127.0.0.1:8080";
const feedbackHtml = readFileSync(new URL("../pilot-feedback.html", import.meta.url), "utf8")
  .replace(/ integrity="[^"]+"/, "");

const supabaseMock = `
window.supabase={createClient:()=>({auth:{
  getUser:async()=>window.__pilotFeedbackFixture.signedIn
    ?{data:{user:{id:"user-fixture",email:"pilot@example.test"}}}
    :{data:{user:null}},
  getSession:async()=>window.__pilotFeedbackFixture.signedIn
    ?{data:{session:{access_token:"fixture-token"}}}
    :{data:{session:null}}
}})};`;

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function minimalWorkspace() {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <main><h1>Workspace</h1></main><script src="feedback-widget.js" defer></script>
  </body></html>`;
}

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });

  {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.__pilotFeedbackFixture = { signedIn: false }; });
    await page.route(`${base}/pilot-feedback.html**`, route => route.fulfill({ contentType: "text/html", body: feedbackHtml }));
    await page.route(`${base}/signin.html**`, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Sign in</title>" }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.goto(`${base}/pilot-feedback.html?surface=reports`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin\.html\?next=/);
    const next = new URL(page.url()).searchParams.get("next");
    assert.equal(next, "pilot-feedback.html?surface=reports", `${browserName}: signed-out return target was not preserved`);
    await page.close();
  }

  {
    const page = await browser.newPage();
    let submitCount = 0;
    await page.addInitScript(() => { window.__pilotFeedbackFixture = { signedIn: true }; });
    await page.route(`${base}/pilot-feedback.html**`, route => route.fulfill({ contentType: "text/html", body: feedbackHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.route("https://monderman-api.onrender.com/**", route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/pilot-feedback/access") return json(route, 403, { ok: false, error: "pilot_feedback_access_required" });
      if (path === "/api/pilot-feedback") submitCount += 1;
      return json(route, 500, { ok: false });
    });
    await page.goto(`${base}/pilot-feedback.html`, { waitUntil: "domcontentloaded" });
    await page.getByText("Pilot feedback is not available for this account.").waitFor();
    assert.equal(await page.locator("#feedbackForm").isHidden(), true, `${browserName}: non-pilot form was exposed`);
    assert.equal(submitCount, 0, `${browserName}: non-pilot page attempted a submission`);
    await page.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    const submissions = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => { window.__pilotFeedbackFixture = { signedIn: true }; });
    await page.route(`${base}/pilot-feedback.html**`, route => route.fulfill({ contentType: "text/html", body: feedbackHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.route("https://monderman-api.onrender.com/**", route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/pilot-feedback/access") {
        assert.equal(request.headers().authorization, "Bearer fixture-token", `${browserName}: access request omitted bearer token`);
        return json(route, 200, { ok: true, access: { organizationName: "Pilot Workspace", trialDay: 12, role: "analyst" } });
      }
      if (path === "/api/pilot-feedback") {
        submissions.push(request.postDataJSON());
        assert.equal(request.headers().authorization, "Bearer fixture-token", `${browserName}: submission omitted bearer token`);
        return json(route, 201, { ok: true, feedback: { id: "feedback-fixture" } });
      }
      throw new Error(`${browserName}: unexpected API request ${path}`);
    });
    await page.goto(`${base}/pilot-feedback.html?surface=reports&private=ignored`, { waitUntil: "domcontentloaded" });
    await page.getByText("Verified for Pilot Workspace").waitFor();
    assert.equal(await page.locator("#feedbackForm").isVisible(), true, `${browserName}: verified pilot form remained hidden`);
    assert.equal(await page.locator("#surface").inputValue(), "reports", `${browserName}: safe surface context was not retained`);
    const fit = await page.locator("html").evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    assert.ok(fit.scroll <= fit.client, `${browserName}: pilot feedback page overflows a 390px viewport`);

    await page.locator("#submitBtn").click();
    await page.getByText("Choose a product area and both ratings before sending.").waitFor();
    await page.locator('label[for="useful5"]').click();
    await page.locator('label[for="confident4"]').click();
    await page.locator("#whatWorked").fill("The operational priority sequence was clear.");
    await page.locator('label[for="continueMaybe"]').click();
    await page.locator("#continueReason").fill("A second measurement cycle with my team.");
    await page.locator("#followUp").check();
    await page.locator("#submitBtn").click();
    await page.getByText("Thank you. We received it.").waitFor();

    assert.equal(submissions.length, 1, `${browserName}: feedback did not persist exactly once`);
    const body = submissions[0];
    assert.deepEqual(Object.keys(body).sort(), [
      "confidence", "continue_intent", "continue_reason", "follow_up_requested", "idempotency_key",
      "source_path", "surface", "usefulness", "what_blocked", "what_worked"
    ].sort(), `${browserName}: submission contains an unexpected field`);
    assert.equal(body.source_path, "/pilot-feedback.html", `${browserName}: query data leaked into source path`);
    assert.match(body.idempotency_key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, `${browserName}: idempotency key is not a UUID`);
    for (const forbidden of ["email", "access_token", "session", "diagnostic", "score", "report", "billing"]) {
      assert.equal(forbidden in body, false, `${browserName}: submission leaked forbidden field ${forbidden}`);
    }
    assert.deepEqual(errors, [], `${browserName}: browser errors: ${errors.join("; ")}`);
    await context.close();
  }

  for (const pilot of [true, false]) {
    const page = await browser.newPage();
    let accessRequests = 0;
    await page.addInitScript(isPilot => {
      window.mondermanGetSupabaseClient = async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "fixture-token" } } }) } });
      window.__widgetPilot = isPilot;
    }, pilot);
    await page.route(`${base}/workspace.html`, route => route.fulfill({ contentType: "text/html", body: minimalWorkspace() }));
    await page.route("https://monderman-api.onrender.com/api/pilot-feedback/access", route => {
      accessRequests += 1;
      return pilot
        ? json(route, 200, { ok: true, access: { organizationName: "Pilot Workspace" } })
        : json(route, 403, { ok: false, error: "pilot_feedback_access_required" });
    });
    await page.goto(`${base}/workspace.html`, { waitUntil: "domcontentloaded" });
    const launcher = page.locator(".mdn-fb-launch");
    await launcher.waitFor();
    if (pilot) {
      await page.getByText("Pilot feedback", { exact: true }).waitFor();
      await launcher.press("Enter");
      await page.waitForURL(/pilot-feedback\.html\?surface=workspace/);
    } else {
      assert.equal((await launcher.textContent()).trim(), "Feedback", `${browserName}: ordinary feedback control was relabeled`);
      await launcher.press("Enter");
      assert.equal(await page.locator("#mdn-fb-panel").getAttribute("aria-hidden"), "false", `${browserName}: ordinary feedback panel did not open`);
      assert.equal(page.url(), `${base}/workspace.html`, `${browserName}: non-pilot was routed to private feedback`);
    }
    assert.equal(accessRequests, 1, `${browserName}: Workspace performed a redundant pilot-access request`);
    await page.close();
  }

  await browser.close();
  console.log(`PILOT_FEEDBACK_BROWSER_PASS_${browserName.toUpperCase()}`);
}
