import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assignment-mode.js", import.meta.url), "utf8");

function render(config) {
  const elements = new Map();
  const makeElement = (tag) => ({
    tagName: tag,
    id: "",
    className: "",
    innerHTML: "",
    textContent: "",
    parentNode: null,
    remove() { if (this.id) elements.delete(this.id); }
  });
  const register = (element) => {
    if (element.id) elements.set(element.id, element);
    return element;
  };
  const head = { appendChild: register };
  const body = {
    firstChild: null,
    appendChild(element) { element.parentNode = this; this.firstChild ||= element; return register(element); },
    insertBefore(element) { element.parentNode = this; this.firstChild = element; return register(element); }
  };
  const document = {
    head,
    body,
    createElement: makeElement,
    getElementById: (id) => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const window = { location: { search: "" } };
  const context = vm.createContext({ window, document, URLSearchParams, fetch: async () => { throw new Error("unexpected fetch"); }, console });
  vm.runInContext(source, context);
  window.MondermanAssignment.privacyNotice(config);
  return elements.get("ma-privacy")?.innerHTML || "";
}

const shownAnonymous = render({
  sponsoring_organization_name: "Northbridge & Partners",
  is_anonymous_response: true,
  show_results_to_assignee: true
});
assert.match(shownAnonymous, /Northbridge &amp; Partners/);
assert.match(shownAnonymous, /configured as anonymous/i);
assert.match(shownAnonymous, /not attached to the named recipient assignment/i);
assert.match(shownAnonymous, /see the individual report after a successful submission/i);
assert.match(shownAnonymous, /necessary request and security metadata/i);

const hiddenAttributable = render({
  sponsoring_organization_name: "Northbridge",
  is_anonymous_response: false,
  show_results_to_assignee: false
});
assert.match(hiddenAttributable, /campaign is attributable/i);
assert.match(hiddenAttributable, /name is attached to the response/i);
assert.match(hiddenAttributable, /will not receive an individual report after submission/i);
for (const notice of [shownAnonymous, hiddenAttributable]) {
  assert.match(notice, /quantitative score is calculated by versioned application code from structured answers; AI does not calculate or set it/i);
  assert.match(notice, /When AI-assisted reporting is enabled, selected structured answers, computed results and context are sent to Anthropic's commercial API for a separate written interpretation/i);
  assert.match(notice, /interpretation can contain errors and must be reviewed before use/i);
  assert.match(notice, /Optional written observations are displayed separately and do not change the score/i);
  assert.match(notice, /included in AI interpretation only when that separate feature is enabled/i);
  assert.match(notice, /report states when they were not incorporated/i);
  assert.doesNotMatch(notice, /written interpretation are generated deterministically|not sent to an AI provider in this bounded pilot/i);
}
assert.doesNotMatch(hiddenAttributable, /interview messages/i);
assert.doesNotMatch(hiddenAttributable, /Synthesis/i);

console.log("Assignment privacy notice smoke passed: dynamic sponsor, anonymous/attributable, results visibility, code-owned scoring, conditional Anthropic interpretation, separate notes enablement, and review responsibility.");
