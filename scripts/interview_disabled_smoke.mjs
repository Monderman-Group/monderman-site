import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../interview-mode.js", import.meta.url), "utf8");
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

console.log("PASS interview disabled for bounded pilot");
