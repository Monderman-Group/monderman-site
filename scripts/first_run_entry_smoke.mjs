import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const moments = ["new-in-the-role.html", "after-an-acquisition.html", "transformation-behind-schedule.html", "after-a-reorganization.html"];
const marketing = ["index.html", "pilot.html", "platform-services.html", "plan-signal.html", "plan-pattern.html", "diagnostics.html", "Monderman_Platform_Brief.html", "sample-report.html", ...moments];
let checks = 0;
for (const file of marketing) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const copy = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  assert.doesNotMatch(copy, /Run Decision Velocity free|Create a free account|standard Trial|30-day Pattern Pilot|500 completed campaign responses/i, file + ": retired access offer");
  assert.match(copy, /Request an invitation/, file + ": request CTA");
  if (["index.html", "platform-services.html", "pilot.html", "Monderman_Platform_Brief.html"].includes(file)) assert.match(copy, /60.day|60 days/);
  for (const match of copy.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = match[1], label = match[2].replace(/<[^>]+>/g, "");
    if (/Request an invitation/.test(label)) assert.ok(/^(?:pilot\.html|#apply)/.test(href), file + ": request must use application route");
    if (/Activate your invitation/.test(label)) assert.equal(href, "pattern-trial.html");
    assert.ok(!href.startsWith("checkout.html"), file + ": public purchase CTA remains");
    if (/^(?:https?:|mailto:|tel:|#)/.test(href)) continue;
    assert.ok(fs.existsSync(path.join(root, href.split(/[?#]/)[0])), file + ": unresolved " + href);
    checks++;
  }
}
const pilot = fs.readFileSync(path.join(root, "pilot.html"), "utf8");
for (const term of ["unlimited during your 60 days", "no per-run charges", "Abuse protections", "five analysts and two admins", "id=\"evaluation-plan\"", "Structural Clarity", "Decision Velocity", "Operational Systems", "Institutional Performance"]) assert.ok(pilot.includes(term), term);
assert.equal((pilot.match(/name="completedDecisionVelocity"/g) || []).length, 0, "Previous public run is not required");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(home, /Less bureaucracy\. Better performance\./);
assert.match(home, /Available by invitation\. Evaluate Monderman free for 60 days\. No credit card\. No automatic renewal\./);
assert.match(home, /data-sample-id="cross_lens_synthesis"/);
for (const file of moments) assert.ok(home.includes('href="' + file + '"'));

const retired = fs.readFileSync(path.join(root, "first-run-telemetry.js"), "utf8");
for (const choice of [null, "allow", "deny", "malformed"]) {
  const session = new Map([["monderman_first_run_journey", "old-visit"], ["monderman_first_run_attribution", "old-tags"], ["saved-run", "preserve"]]);
  const local = new Map([["monderman_measurement_choice", choice], ["auth-token", "preserve"], ["ai-consent", "preserve"]]);
  const storage = values => ({ getItem: key => values.get(key), removeItem: key => values.delete(key), setItem: () => assert.fail("Retired telemetry must not write identifiers") });
  const forbidden = () => assert.fail("Retired telemetry must not use the network or create controls");
  const scope = {window:{},sessionStorage:storage(session),localStorage:storage(local),fetch:forbidden,document:{createElement:forbidden,addEventListener:forbidden}};
  vm.runInNewContext(retired, scope);
  const api = scope.window.MondermanFirstRun;
  api.track("primary_cta_clicked"); api.trackOnce("diagnostic_started"); api.openMeasurementChoices();
  assert.equal(api.isMeasurementAllowed(), false); assert.equal(api.measurementConsentVersion(), null); assert.equal(api.journeyId(), "");
  assert.equal(api.attribution().acquisitionSource, "unknown"); assert.equal(api.attribution().acquisitionCampaign, null);
  assert.equal(session.has("monderman_first_run_journey"), false); assert.equal(session.has("monderman_first_run_attribution"), false);
  assert.equal(local.has("monderman_measurement_choice"), false);
  assert.equal(session.get("saved-run"), "preserve"); assert.equal(local.get("auth-token"), "preserve"); assert.equal(local.get("ai-consent"), "preserve");
  checks += 12;
}
for (const script of ["pilot-waitlist.js", "homepage-workspace-demo.js"]) new vm.Script(fs.readFileSync(path.join(root, script), "utf8"), {filename:script});
console.log(JSON.stringify({passed:true,checks,scope:"Invitation-only marketing, preserved links and retired measurement for all former choices; no network or customer mutations."}));
