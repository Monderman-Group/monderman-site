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
assert.match(hiddenAttributable, /quantitative score is calculated deterministically/i);
assert.match(hiddenAttributable, /Content needed for the Diagnostic&rsquo;s written interpretation may be processed/i);
assert.match(hiddenAttributable, /structured Diagnostic context and results/i);
assert.match(hiddenAttributable, /interview messages or optional written observations/i);
assert.match(hiddenAttributable, /AI does not calculate or set the quantitative score/i);
assert.doesNotMatch(hiddenAttributable, /Synthesis/i);

console.log("Assignment privacy notice smoke passed: dynamic sponsor, anonymous/attributable, results visibility, and bounded AI disclosure.");
