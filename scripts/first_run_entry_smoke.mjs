import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const momentPages = [
  "new-in-the-role.html",
  "after-an-acquisition.html",
  "transformation-behind-schedule.html",
  "after-a-reorganization.html"
];

for (const file of momentPages) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(html, /\b(?:survey|assessment|self-guided)\b/i, `${file} contains excluded terminology`);
  assert.doesNotMatch(html, /—/, `${file} contains an em dash`);
  for (const required of [
    "The problem",
    "Begin with one decision",
    "What one team campaign adds",
    "What comes after",
    "Run Decision Velocity free",
    "Apply to the Pattern Pilot",
    "Preview a sample report",
    "assistant.js",
    "contact-transport.js",
    "connect-widget.js",
    "LinkedIn",
    "Facebook"
  ]) assert.ok(html.includes(required), `${file} is missing ${required}`);
  for (const match of html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:)/.test(href)) continue;
    assert.ok(fs.existsSync(path.join(root, href.split("?")[0])), `${file} has unresolved link ${href}`);
  }
}

const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(home.includes("Start where the stakes are already clear."));
assert.ok(home.includes("Run Decision Velocity free"));
assert.ok(home.includes('href="pilot.html?source=homepage"'));
assert.ok(home.includes("Join the pilot waitlist &middot; Applications open"));
assert.doesNotMatch(home, /(?:filling|fulling)\s+(?:up|fast)/i);
for (const file of momentPages) assert.ok(home.includes(`href="${file}"`));

const diagnostic = fs.readFileSync(path.join(root, "decision-velocity.html"), "utf8");
assert.ok(diagnostic.includes("window.MONDERMAN_ALLOW_PUBLIC_FIRST_RUN = true"));
assert.match(diagnostic, /class="intake-option has-recommended"[^>]+data-depth="10"/);
assert.ok(diagnostic.includes("score_displayed"));
assert.ok(diagnostic.includes("executive_report_opened"));
assert.ok(diagnostic.includes('href="pilot.html?source=decision_velocity"'));
assert.ok(diagnostic.includes("pilot-result-invitation"));

const pilot = fs.readFileSync(path.join(root, "pilot.html"), "utf8");
assert.doesNotMatch(pilot, /\b(?:survey|assessment|self-guided)\b/i);
assert.doesNotMatch(pilot, /—/);
for (const required of [
  "Limited pilot cohort",
  "Apply to the pilot waitlist",
  "6 to 12 people",
  "30 days",
  "No automatic charge",
  "pilot-waitlist.js",
  "assistant.js",
  "contact-transport.js",
  "connect-widget.js",
  "LinkedIn",
  "Facebook"
]) assert.ok(pilot.includes(required), `pilot.html is missing ${required}`);
for (const match of pilot.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
  const href = match[1];
  if (/^(?:https?:|mailto:|tel:)/.test(href)) continue;
  assert.ok(fs.existsSync(path.join(root, href.split("?")[0])), `pilot.html has unresolved link ${href}`);
}

// The pilot is an evaluation of the relevant suite, not a mandatory four-lens
// sequence or a twelve-person entitlement. Keep this in the existing CI gate.
const guide = pilot.match(/<section\b[^>]*id="evaluation-plan"[\s\S]*?<\/section>/)?.[0];
assert.ok(guide, "pilot.html: linked evaluation plan missing");
const guideHeadings = [...guide.matchAll(/<h3>(.*?)<\/h3>/g)].map(match => match[1]);
assert.deepEqual(guideHeadings, [
  "Choose a real organizational question.",
  "Run the first relevant diagnostic with your team.",
  "Add other diagnostics when they answer another question.",
  "Use Synthesis to examine the submitted evidence.",
  "Choose a practical action and a later measurement."
]);
for (const name of ["Structural Clarity", "Decision Velocity", "Operational Systems", "Institutional Performance"])
  assert.ok(guide.includes(`<strong>${name}:</strong>`), `pilot guide missing ${name}`);
for (const required of [
  "You do not need to use every diagnostic", "500 completed campaign responses",
  "One person completing four assigned diagnostics uses four responses",
  "Pending invitations also reserve capacity", "A Workspace admin",
  "Depth Synthesis", "Cross-Lens Synthesis", "a Composite Score is withheld",
  "may not be enough to demonstrate sustained improvement", "does not prove"
]) assert.ok(guide.includes(required), `pilot guide missing ${required}`);
const activation = fs.readFileSync(path.join(root, "pattern-trial.html"), "utf8");
for (const required of [
  'href="pilot.html#evaluation-plan"', 'id="pilotEvaluationPlan"',
  "suggested starting group, not a hard cap", "none is universally required",
  "500 completed campaign responses", "uses four of the 500 campaign responses",
  "Pending invitations also reserve capacity", "Individual runs are unlimited",
  "10, 30, and 60 minutes", "Operational, Managerial, and Senior Leader",
  "does not guarantee a Composite Score", "does not renew automatically"
]) assert.ok(activation.includes(required), `pilot activation guide missing ${required}`);
assert.doesNotMatch(pilot, /Apply for a 30-day Monderman Pattern Pilot with 6 to 12 people/,
  "pilot metadata must not imply a twelve-person limit");

for (const file of ["why-monderman.html", "roi.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(html, />Start the standard Trial</);
  assert.ok(html.includes("Run the Decision Velocity diagnostic"));
}
assert.doesNotMatch(home, />Start the standard Trial</);

for (const script of ["first-run-telemetry.js", "pilot-waitlist.js", "workspace-access-gate.js"]) {
  new vm.Script(fs.readFileSync(path.join(root, script), "utf8"), { filename: script });
}

console.log("First-run entry smoke passed.");
