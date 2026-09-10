import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.PILOT_BASE || "http://127.0.0.1:8080";
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname), "pilot fixture origin must be loopback");
// A read-only historical input allows red/green proof without reverting the page.
const candidateHtml = (process.env.PILOT_HTML_REVISION
  ? execFileSync("git", ["show", `${process.env.PILOT_HTML_REVISION}:pattern-trial.html`], { cwd: new URL("../", import.meta.url), encoding: "utf8" })
  : readFileSync(new URL("../pattern-trial.html", import.meta.url), "utf8"))
  .replace(/ integrity="[^"]+"/, "");
const supabaseMock = `
window.__pilotRpcCalls=[];
window.supabase={createClient:()=>({
  auth:{getSession:async()=>window.__pilotFixture.signedIn
    ?{data:{session:{access_token:"fixture-token",user:{id:"user-fixture",email:"invitee@example.test"}}}}
    :{data:{session:null}}},
  from:()=>({select(){return this},eq(){return Promise.resolve({count:window.__pilotFixture.membershipCount||0,error:null})}}),
  rpc:async(name,args)=>{
    window.__pilotRpcCalls.push({name,args});
    if(window.__pilotFixture.pendingBootstrap) await new Promise(resolve=>{window.__releasePilotBootstrap=resolve});
    return name==="bootstrap_my_workspace"
      ?{data:{organization_id:"org-created",organizations:{name:"Created Workspace"}},error:null}
      :{data:null,error:{message:"unexpected rpc"}};
  }
})};`;

function json(route, status, body) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const version="2026-09-09-beta", nextVersion="2026-09-10-beta";
async function observed(promise, label) {
  let timer;
  try { await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} was not observed`)),5000)})]); }
  finally { clearTimeout(timer); }
}
async function isolate(page) {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) {
      // Destination pages are inert fixtures; local styles/fonts are safe reads.
      if (["/workspace.html", "/signin.html"].includes(url.pathname)) return route.fulfill({contentType:"text/html",body:"<!doctype html><title>Fixture destination</title>"});
      return route.continue();
    }
    throw new Error(`Unexpected external request blocked: ${url.origin}${url.pathname}`);
  });
}
const scenarios=["invited-new", "invited-existing", "invited-multiple", "workspace-switch", "pending-activation", "uninvited", "invitation-unavailable", "invitation-network-error", "legal-unavailable", "legal-drift", "acceptance-failed"];

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  let failureContext;
  try {
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await isolate(page);
    await page.addInitScript(() => { window.__pilotFixture = { signedIn: false }; });
    await page.route(`${base}/pattern-trial.html`, route => route.fulfill({ contentType: "text/html", body: candidateHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.goto(`${base}/pattern-trial.html`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/signin\.html\?next=/);
    assert.match(page.url(), /next=pattern-trial\.html/, `${browserName}: signed-out invitation did not retain its return target`);
    await page.close();
  }

  for (const scenario of scenarios) {
    const requests = [];
    const isNew=["invited-new","pending-activation"].includes(scenario), isMultiple=["invited-multiple","workspace-switch"].includes(scenario);
    const selectedOrg=isNew?"org-created":isMultiple?"org-second":"org-existing";
    let trialStatusCount=0, trialAccepted=false;
    let releaseStatus, releaseStart, seeStatus, seeStart;
    const statusSeen=new Promise(resolve=>{seeStatus=resolve}), startSeen=new Promise(resolve=>{seeStart=resolve});
    const statusHold=new Promise(resolve=>{releaseStatus=resolve}), startHold=new Promise(resolve=>{releaseStart=resolve});
    const context = await browser.newContext({ viewport: scenario === "invited-new" ? { width: 390, height: 844 } : { width: 1100, height: 900 } });
    const page = await context.newPage();
    failureContext={page,scenario,requests};
    page.setDefaultTimeout(5000);
    await isolate(page);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(fixture => { window.__pilotFixture = fixture; }, {
      signedIn: true,
      membershipCount: isNew ? 0 : 1, pendingBootstrap: scenario==="pending-activation"
    });
    await page.route(`${base}/pattern-trial.html`, route => route.fulfill({ contentType: "text/html", body: candidateHtml }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: supabaseMock }));
    await page.route("https://monderman-api.onrender.com/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const entry={path:url.pathname, method:request.method(), query:Object.fromEntries(url.searchParams)};
      if(request.postData()) entry.body=request.postDataJSON();
      requests.push(entry);
      assert.equal(request.headers().authorization,"Bearer fixture-token",`${browserName}/${scenario}: missing fixture authentication`);
      if (url.pathname === "/api/legal/acceptance/status") {
        const source=url.searchParams.get("source")||"signup", org=url.searchParams.get("organization_id");
        // Match legal-acceptance-route.js: trial status requires a Workspace.
        // The former unconditional 200 response concealed the live preflight bug.
        if(source==="trial"&&!org) {
          entry.responseStatus=400; entry.responseError="trial_organization_required";
          return json(route,400,{ok:false,error:"trial_organization_required"});
        }
        if(source!=="trial"&&scenario==="legal-unavailable") return json(route,503,{ok:false,error:"legal_document_versions_unavailable"});
        if(source==="trial") {
          trialStatusCount++;
          assert.equal(org,selectedOrg,"trial status must target the selected Workspace");
          seeStatus();
          if(scenario==="pending-activation") await statusHold;
        }else{
          assert.equal(source,"signup","initial query only discovers the current documents");
          assert.equal(org,null);
        }
        const current=source==="trial"&&scenario==="legal-drift"?nextVersion:version;
        return json(route,200,{ok:true,enforcementActive:true,accepted:source==="signup"||trialAccepted,requiresAcceptance:source==="trial"&&!trialAccepted,organizationId:org,termsVersion:current,privacyNoticeVersion:current});
      }
      if (url.pathname === "/api/legal/acceptance") {
        assert.equal(entry.method,"POST");
        const current=scenario==="legal-drift"?nextVersion:version;
        assert.deepEqual(entry.body,{agreed:true,source:"trial",organization_id:selectedOrg,terms_version:current,privacy_notice_version:current},"acceptance must be affirmative and trial-, organization-, and version-specific");
        assert.ok(trialStatusCount>0,"agreement must follow tenant-bound trial status");
        if(scenario==="acceptance-failed") return json(route,503,{ok:false,error:"legal_acceptance_failed"});
        trialAccepted=true;
        return json(route, 201, { ok: true });
      }
      if (url.pathname === "/api/billing/pattern-pilot-invitation") {
        if(scenario==="invitation-network-error") return route.abort("failed");
        if(scenario==="invitation-unavailable") return json(route,500,{ok:false,error:"pattern_pilot_invitation_unavailable"});
        return scenario === "uninvited"
          ? json(route, 404, { ok: false, error: "pattern_pilot_invitation_required" })
          : json(route, 200, { ok: true, invitation: { recipientName: null, expiresAt: "2099-09-24T00:00:00.000Z" } });
      }
      if (url.pathname === "/api/billing/organizations") {
        assert.equal(url.searchParams.get("purpose"),"trial");
        const organizations = isNew ? [] : [{ id: "org-existing", name: "Existing Workspace" }];
        if(isMultiple) organizations.push({id:"org-second",name:"Second Workspace"});
        return json(route, organizations.length ? 200 : 409, {
          ok: organizations.length > 0,
          organizations,
          error: organizations.length ? null : "no_trial_eligible_organization"
        });
      }
      if (url.pathname === "/api/billing/start-pattern-trial") {
        assert.equal(trialAccepted,true,"activation must not use general signup acceptance");
        assert.deepEqual(entry.body,{organization_id:selectedOrg});
        seeStart();
        if(scenario==="pending-activation") await startHold;
        return json(route, 200, { ok: true });
      }
      throw new Error(`${browserName}: unexpected pilot request ${url.pathname}`);
    });

    const mutations=()=>requests.filter(entry=>entry.method!=="GET");
    const noMutation=async()=>{
      assert.deepEqual(mutations(),[],`${browserName}/${scenario}: unexpected API write before acknowledgement`);
      assert.deepEqual(await page.evaluate(()=>window.__pilotRpcCalls),[],`${browserName}/${scenario}: premature Workspace creation`);
    };
    const blocked=async()=>{
      assert.equal(await page.locator("#ackStart").isDisabled(),true);
      assert.equal(await page.locator("#startBtn").isDisabled(),true);
      await noMutation();
    };

    await page.goto(`${base}/pattern-trial.html`, { waitUntil: "domcontentloaded" });
    if (scenario === "uninvited") {
      await page.getByText("This email does not have an active pilot invitation.").waitFor();
      assert.equal(await page.locator("#startBtn").isDisabled(), true, `${browserName}: uninvited account can start pilot`);
      await blocked();
    } else if(["invitation-unavailable","invitation-network-error"].includes(scenario)){
      await page.getByText("We couldn’t check your pilot invitation.").waitFor();
      assert.equal(await page.getByText("This email does not have an active pilot invitation.").count(),0,"service failure must not claim the invitation is absent");
      await blocked();
    } else if(scenario==="legal-unavailable"){
      await page.getByText("Your pilot invitation is verified.").waitFor();
      await page.getByText("We couldn’t load the current terms. Please refresh and try again.").waitFor();
      await blocked();
    } else {
      await page.getByText("Your pilot invitation is verified.").waitFor();
      if (isNew) {
        await page.locator("#workspaceName").fill("Pilot Workspace");
        const fit = await page.locator("html").evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        assert.ok(fit.scroll <= fit.client, `${browserName}: personalized pilot page overflows a 390px viewport`);
      } else if(isMultiple){
        if(scenario==="workspace-switch"){
          await page.locator("#organizationSelect").selectOption("org-existing");
          await page.locator("#ackStart").check();
          assert.equal(await page.locator("#startBtn").isEnabled(),true);
        }
        await page.locator("#organizationSelect").selectOption(selectedOrg);
        await page.getByText("This Pattern trial will start for Second Workspace.").waitFor();
        assert.equal(await page.locator("#ackStart").isChecked(),false,"changing Workspace must clear a previous acknowledgement");
        assert.equal(await page.locator("#startBtn").isDisabled(),true);
      } else {
        await page.getByText("This Pattern trial will start for Existing Workspace.").waitFor();
        assert.equal(await page.locator("#workspaceBootstrap").isHidden(), true, `${browserName}: existing account was asked to create another Workspace`);
      }
      assert.equal(await page.locator("#trialTermsLink").getAttribute("href"),`terms-${version}.html`);
      assert.equal(await page.locator("#trialPrivacyLink").getAttribute("href"),`privacy-${version}.html`);
      await noMutation();
      assert.equal(await page.locator("#ackStart").isChecked(),false);
      assert.equal(await page.locator("#startBtn").isDisabled(),true);
      await page.locator("#ackStart").check();
      await noMutation();
      assert.equal(await page.locator("#startBtn").isEnabled(), true, `${browserName}: verified invitation could not be accepted`);
      await page.locator("#startBtn").click();
      if(scenario==="pending-activation"){
        await page.waitForFunction(()=>window.__pilotRpcCalls.length===1 && typeof window.__releasePilotBootstrap==="function");
        const duplicateAttempt=async()=>{
          assert.equal(await page.locator("#startBtn").isDisabled(),true,"Start must stay disabled throughout activation");
          assert.equal(await page.locator("#ackStart").isDisabled(),true,"acknowledgement must stay fixed during activation");
          assert.equal(await page.locator("#workspaceName").isDisabled(),true,"Workspace name must stay fixed during activation");
          // Even a programmatically dispatched duplicate must hit the in-flight guard.
          await page.locator("#startBtn").dispatchEvent("click");
          assert.equal((await page.evaluate(()=>window.__pilotRpcCalls)).length,1,"duplicate click created another Workspace");
        };
        await duplicateAttempt();
        await page.evaluate(()=>window.__releasePilotBootstrap());
        await observed(statusSeen,"tenant-bound status after bootstrap");
        await duplicateAttempt();
        assert.equal(trialStatusCount,1,"duplicate click repeated tenant-bound preflight");
        releaseStatus();
        await observed(startSeen,"trial activation after agreement");
        await duplicateAttempt();
        assert.equal(requests.filter(entry=>entry.path==="/api/billing/start-pattern-trial").length,1,"duplicate click repeated activation");
        releaseStart();
      }
      if(scenario==="legal-drift"){
        await page.getByText("The Terms or Privacy Notice changed while this page was open. Review the current documents, select the acknowledgement again, and continue.").waitFor();
        await noMutation();
        assert.equal(await page.locator("#ackStart").isChecked(),false);
        assert.equal(await page.locator("#startBtn").isDisabled(),true);
        assert.equal(await page.locator("#trialTermsLink").getAttribute("href"),`terms-${nextVersion}.html`);
        assert.equal(await page.locator("#trialPrivacyLink").getAttribute("href"),`privacy-${nextVersion}.html`);
        await page.locator("#ackStart").check();
        await page.locator("#startBtn").click();
      }
      if(scenario==="acceptance-failed"){
        await page.getByText("The Pattern trial could not be reached. Nothing was charged. Please try again.").waitFor();
        assert.equal(requests.filter(entry=>entry.path==="/api/billing/start-pattern-trial").length,0,"failed acceptance must prevent activation");
      }else{
      await page.getByText("Pattern is active. Opening your Workspace…").waitFor();
      const start = requests.find(entry => entry.path === "/api/billing/start-pattern-trial");
      assert.deepEqual(start?.body, { organization_id: selectedOrg }, `${browserName}: activation body contains stale code or wrong Workspace`);
      assert.equal("invitation_code" in start.body, false, `${browserName}: browser transmitted a reusable code`);
      const acceptance = requests.find(entry => entry.path === "/api/legal/acceptance");
      assert.equal(acceptance?.body?.organization_id, start.body.organization_id, `${browserName}: legal acceptance and activation targeted different Workspaces`);
      assert.deepEqual(mutations().map(entry=>entry.path),["/api/legal/acceptance","/api/billing/start-pattern-trial"],"one agreement must precede exactly one activation");
      assert.equal((await page.evaluate(()=>window.__pilotRpcCalls)).length,isNew?1:0);
      }
      const initialStatus=requests.find(entry=>entry.path==="/api/legal/acceptance/status");
      assert.equal(initialStatus?.query.source,"signup","preflight must discover documents without a trial organization");
    }
    assert.deepEqual(errors, [], `${browserName}/${scenario}: browser errors: ${errors.join("; ")}`);
    await context.close();
    console.log(`PERSONALIZED_PATTERN_PILOT_PASS ${browserName}/${scenario}`);
  }

  } catch(error) {
    if(failureContext){
      const {page,scenario,requests}=failureContext;
      const visible=await page.locator("#pilotInvitationTitle, #msg").allTextContents().catch(()=>[]);
      console.error("PERSONALIZED_PATTERN_PILOT_FAILURE",JSON.stringify({browserName,scenario,visible,requests}));
    }
    throw error;
  } finally { await browser.close(); }
  console.log(`PERSONALIZED_PATTERN_PILOT_PASS_${browserName.toUpperCase()}`);
}
console.log(`PERSONALIZED_PATTERN_PILOT_TOTAL ${(scenarios.length+1)*2} scenarios; all API and auth traffic mocked`);
