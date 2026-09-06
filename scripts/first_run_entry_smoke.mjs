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
    "What one run shows",
    "What one team campaign adds",
    "What comes after",
    "Run the Decision Velocity diagnostic",
    "Request a 30-day Pattern trial",
    "See a sample report",
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
assert.ok(home.includes("Where a first run fits"));
for (const file of momentPages) assert.ok(home.includes(`href="${file}"`));

const diagnostic = fs.readFileSync(path.join(root, "decision-velocity.html"), "utf8");
assert.ok(diagnostic.includes("window.MONDERMAN_ALLOW_PUBLIC_FIRST_RUN = true"));
assert.match(diagnostic, /class="intake-option has-recommended"[^>]+data-depth="10"/);
assert.ok(diagnostic.includes("score_displayed"));
assert.ok(diagnostic.includes("executive_report_opened"));

for (const file of ["index.html", "why-monderman.html", "roi.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(html, />Start the standard Trial</);
  assert.ok(html.includes("Run the Decision Velocity diagnostic"));
}

for (const script of ["first-run-telemetry.js", "workspace-access-gate.js"]) {
  new vm.Script(fs.readFileSync(path.join(root, script), "utf8"), { filename: script });
}

console.log("First-run entry smoke passed.");
