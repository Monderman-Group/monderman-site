import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../interview-mode.js", import.meta.url), "utf8");
const workspaceSource = fs.readFileSync(new URL("../workspace-diagnostics.html", import.meta.url), "utf8");
const assignmentSource = fs.readFileSync(new URL("../assignment-mode.js", import.meta.url), "utf8");
const sandbox = {
  AbortController,
  URLSearchParams,
  clearTimeout,
  console,
  fetch,
  setTimeout,
  window: {
    location: { search: "?mode=interview" },
    MONDERMAN_INTERVIEW_MODE_ENABLED: false
  }
};

vm.runInNewContext(source, sandbox, { filename: "interview-mode.js" });
const interview = sandbox.window.MondermanInterview;
assert.ok(interview, "interview compatibility object missing");

interview.init({
  tool: "decision_velocity",
  getRole: () => "managerial",
  submit: async () => {},
  rerender: () => {},
  renderControl: () => ({}),
  elements: { questionBody: null }
});
assert.equal(interview.active(), false, "URL mode bypassed bounded-pilot disablement");

const host = { innerHTML: "unexpected" };
interview.mountToggle(host);
assert.equal(host.innerHTML, "", "disabled interview toggle remained visible");

interview.applyAssignment({ response_mode: "interview" });
assert.equal(interview.active(), false, "assignment bypassed bounded-pilot disablement");

interview.setEnabled(true);
assert.equal(interview.active(), false, "client enable call bypassed bounded-pilot disablement");
assert.equal(
  interview.shouldHandle({ questionType: "single_select", options: [{ value: "x" }] }),
  false,
  "disabled interview intercepted a guided-form item"
);

assert.doesNotMatch(workspaceSource, /<option value="interview"/i, "admin can still promise Interview mode");
assert.doesNotMatch(workspaceSource, /<option value="choice"/i, "admin can still delegate an unavailable mode");
assert.match(workspaceSource, /response_mode:\s*"form"/, "campaign payload is not fixed to guided form");
assert.match(workspaceSource, /Interview mode is not available in this bounded pilot/i);
assert.match(assignmentSource, /var modeTxt = "guided form"/);
assert.doesNotMatch(assignmentSource, /Content needed for the Diagnostic.*AI provider/i);

console.log("PASS interview disabled and guided-form promise enforced for bounded pilot");
