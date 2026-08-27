import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const base = process.env.PILOT_BASE || "http://127.0.0.1:8080";
const candidateHtml = readFileSync(new URL("../pattern-trial.html", import.meta.url), "utf8")
  .replace(/ integrity="[^"]+"/, "");
const supabaseMock = `
window.supabase={createClient:()=>({
  auth:{getSession:async()=>window.__pilotFixture.signedIn
    ?{data:{session:{access_token:"fixture-token",user:{id:"user-fixture",email:"invitee@example.test"}}}}
    :{data:{session:null}}},
  from:()=>({select(){return this},eq(){return Promise.resolve({count:window.__pilotFixture.membershipCount||0,error:null})}}),
  rpc:async(name)=>name==="bootstrap_my_workspace"
    ?{data:{organization_id:"org-created",organizations:{name:"Created Workspace"}},error:null}
    :{data:null,error:{message:"unexpected rpc"}}
})};`;

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });

  {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.__pilotFixture = { signedIn: false }; });
    await page.route(`${base}/pattern-trial.html`, route => route.fulfill({ contentType: "text/html", body: candidateHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.goto(`${base}/pattern-trial.html`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin\.html\?next=/);
    assert.match(page.url(), /next=pattern-trial\.html/, `${browserName}: signed-out invitation did not retain its return target`);
    await page.close();
  }

  for (const scenario of ["invited-new", "invited-existing", "uninvited"]) {
    const requests = [];
    const context = await browser.newContext({ viewport: scenario === "invited-new" ? { width: 390, height: 844 } : { width: 1100, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(fixture => { window.__pilotFixture = fixture; }, {
      signedIn: true,
      membershipCount: scenario === "invited-existing" ? 1 : 0
    });
    await page.route(`${base}/pattern-trial.html`, route => route.fulfill({ contentType: "text/html", body: candidateHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.route("https://monderman-api.onrender.com/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/legal/acceptance/status") {
        return json(route, 200, { ok: true, requiresAcceptance: true, termsVersion: "2026-08-26-beta", privacyNoticeVersion: "2026-08-26-beta" });
      }
      if (url.pathname === "/api/legal/acceptance") {
        requests.push({ path: url.pathname, body: request.postDataJSON() });
        return json(route, 200, { ok: true });
      }
      if (url.pathname === "/api/billing/pattern-pilot-invitation") {
        return scenario === "uninvited"
          ? json(route, 404, { ok: false, error: "pattern_pilot_invitation_required" })
          : json(route, 200, { ok: true, invitation: { recipientName: null, expiresAt: "2026-09-10T00:00:00.000Z" } });
      }
      if (url.pathname === "/api/billing/organizations") {
        const organizations = scenario === "invited-existing"
          ? [{ id: "org-existing", name: "Existing Workspace" }]
          : [];
        return json(route, organizations.length ? 200 : 404, {
          ok: organizations.length > 0,
          organizations,
          error: organizations.length ? null : "no_trial_eligible_organization"
        });
      }
      if (url.pathname === "/api/billing/start-pattern-trial") {
        requests.push({ path: url.pathname, body: request.postDataJSON() });
        return json(route, 200, { ok: true });
      }
      throw new Error(`${browserName}: unexpected pilot request ${url.pathname}`);
    });

    await page.goto(`${base}/pattern-trial.html`, { waitUntil: "domcontentloaded" });
    if (scenario === "uninvited") {
      await page.getByText("This email does not have an active pilot invitation.").waitFor();
      assert.equal(await page.locator("#startBtn").isDisabled(), true, `${browserName}: uninvited account can start pilot`);
      assert.equal(requests.length, 0, `${browserName}: uninvited account mutated state`);
    } else {
      await page.getByText("Your pilot invitation is verified.").waitFor();
      if (scenario === "invited-new") {
        await page.locator("#workspaceName").fill("Pilot Workspace");
        const fit = await page.locator("html").evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        assert.ok(fit.scroll <= fit.client, `${browserName}: personalized pilot page overflows a 390px viewport`);
      } else {
        await page.getByText("This Pattern trial will start for Existing Workspace.").waitFor();
        assert.equal(await page.locator("#workspaceBootstrap").isHidden(), true, `${browserName}: existing account was asked to create another Workspace`);
      }
      await page.locator("#ackStart").check();
      assert.equal(await page.locator("#startBtn").isEnabled(), true, `${browserName}: verified invitation could not be accepted`);
      await page.locator("#startBtn").click();
      await page.getByText("Pattern is active. Opening your Workspace…").waitFor();
      const start = requests.find(entry => entry.path === "/api/billing/start-pattern-trial");
      assert.deepEqual(start?.body, { organization_id: scenario === "invited-new" ? "org-created" : "org-existing" }, `${browserName}: activation body contains stale code or wrong Workspace`);
      assert.equal("invitation_code" in start.body, false, `${browserName}: browser transmitted a reusable code`);
      const acceptance = requests.find(entry => entry.path === "/api/legal/acceptance");
      assert.equal(acceptance?.body?.organization_id, start.body.organization_id, `${browserName}: legal acceptance and activation targeted different Workspaces`);
    }
    assert.deepEqual(errors, [], `${browserName}/${scenario}: browser errors: ${errors.join("; ")}`);
    await context.close();
  }

  await browser.close();
  console.log(`PERSONALIZED_PATTERN_PILOT_PASS_${browserName.toUpperCase()}`);
}
