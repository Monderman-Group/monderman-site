import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Execute the real composer helpers and handlers, replacing only browser I/O.
// The optional exact revision supplies a reproducible red-before/green-after
// check without modifying files, opening browsers, or contacting services.
const revision = process.env.CAMPAIGN_BUTTON_SOURCE_REVISION;
if (revision) assert.match(revision, /^[0-9a-f]{40}$/, "use an exact source commit");
const source = revision
  ? execFileSync("git", ["show", `${revision}:workspace-diagnostics.html`], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8"
  })
  : readFileSync(new URL("../workspace-diagnostics.html", import.meta.url), "utf8");
// This is the campaign module, not the preceding saved-report module.
const composer = source.slice(source.indexOf("    // ---- recipients ----"));
function productionFunction(name) {
  const start = `^    (?:async )?function ${name}\\(`;
  const match = composer.match(new RegExp(`${start}[^\\n]*\\{[^\\n]*\\}\\s*$`, "m"))
    || composer.match(new RegExp(`${start}[^]*?\\n    \\}`, "m"));
  assert.ok(match, `actual composer function ${name} must be exercised`);
  return match[0];
}
const functionNames = [
  "buildCSV", "buildDefaults", "validate", "flash", "busy",
  "campaignAttemptStorageKey", "campaignPayloadFingerprint", "prepareCampaignSendAttempt",
  "clearCampaignSendAttempt", "doPreview", "renderPreview", "doSend"
];
const helperSource = functionNames.map(productionFunction).join("\n")
  + "\n({busy,doPreview,doSend})";

function deferred() {
  let resolve;
  const promise = new Promise((accept) => { resolve = accept; });
  return { promise, resolve };
}
function fixture() {
  const fields = {
    fPath: { value: "Controlled supplier onboarding" }, fTool: { value: "operational_systems" },
    fVantage: { value: "operational" }, fDepth: { value: "10" }, fMessage: { value: "" },
    fDue: { value: "" }, fShowResults: { checked: true }, fAnon: { checked: false },
    btnPreview: { textContent: "Preview", disabled: false, dataset: {} },
    btnSend: { textContent: "Send campaign", disabled: true, dataset: {} },
    previewOut: { innerHTML: "" }, sendOut: { innerHTML: "" }
  };
  const state = { orgId: "org_controlled", userId: "user_controlled", lastReady: 0, campaignSendKey: null,
    recipients: [{ email: "controlled@example.test", full_name: "Controlled Person", business_unit: "Operations", team: "" }] };
  const calls = { requests: [], generatedKeys: 0, clearDraft: 0, loadTracking: 0 };
  const store = new Map();
  const responses = [];
  const handlers = vm.runInNewContext(helperSource, {
    state, $: (id) => { assert.ok(fields[id], `unexpected element ${id}`); return fields[id]; },
    API_BASE: "https://api.example.test",
    FormData, Blob, TextEncoder,
    esc: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    csvCell: (value) => String(value ?? ""),
    crypto: { subtle: webcrypto.subtle, randomUUID() {
      calls.generatedKeys += 1;
      return `00000000-0000-4000-8000-${String(calls.generatedKeys).padStart(12, "0")}`;
    } },
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) },
    async apiAuthHeaders() { return { "X-Monderman-Organization-Id": state.orgId }; },
    clearDraft() { calls.clearDraft += 1; }, loadTracking() { calls.loadTracking += 1; },
    async fetch(url, options) {
      assert.match(url, /^https:\/\/api\.example\.test\/api\/workspace\/assignments\/(?:preview|send)-batch$/,
        "this test must not contact real services or start a Diagnostic");
      assert.equal(options.method, "POST");
      const expected = responses.shift();
      assert.ok(expected, `unexpected additional request: ${url}`);
      assert.ok(url.endsWith(`/${expected.kind}-batch`));
      calls.requests.push({ url, options });
      expected.started.resolve();
      if (expected.gate) await expected.gate.promise;
      if (expected.error) throw new Error(expected.error);
      return { ok: expected.status >= 200 && expected.status < 300, status: expected.status,
        async json() { return expected.data; } };
    }
  });
  return { fields, state, calls, store, ...handlers,
    response(kind, { status = 200, data = { ok: true, ready_rows: [{ email: "controlled@example.test" }] }, error = null, held = false } = {}) {
      const item = { kind, status, data, error, gate: held ? deferred() : null, started: deferred() };
      responses.push(item);
      return { started: item.started.promise, release: () => item.gate?.resolve() };
    } };
}
function button(test, id, text, disabled) {
  assert.equal(test.fields[id].textContent, text, `${id} text`);
  assert.equal(test.fields[id].disabled, disabled, `${id} disabled`);
}
async function previewReady(test) {
  test.response("preview");
  await test.doPreview();
  button(test, "btnPreview", "Preview", false);
  button(test, "btnSend", "Send campaign", false);
  assert.equal(test.state.lastReady, 1);
}

let cases = 0;
{
  const test = fixture();
  const reply = test.response("preview", { held: true });
  const pending = test.doPreview();
  await reply.started;
  button(test, "btnPreview", "Checking…", true);
  button(test, "btnSend", "Send campaign", true);
  reply.release(); await pending;
  button(test, "btnPreview", "Preview", false);
  button(test, "btnSend", "Send campaign", false);
  assert.match(test.fields.previewOut.innerHTML, /1 recipient ready/);
  const key = test.state.campaignSendKey;
  await previewReady(test);
  assert.equal(test.state.campaignSendKey, key, "same preview payload reuses its existing send key");
  assert.equal(test.calls.generatedKeys, 1);
  assert.equal(test.calls.requests.length, 2);
  assert.ok(test.calls.requests.every(({ url }) => url.endsWith("/preview-batch")), "preview must never send or consume a run");
  assert.equal(test.calls.clearDraft, 0);
  cases += 1;
}
for (const failure of [
  { status: 503, data: { ok: false, error: "controlled_unavailable" } },
  { error: "controlled_network_failure" }
]) {
  const test = fixture();
  test.response("preview", failure); await test.doPreview();
  button(test, "btnPreview", "Preview", false);
  button(test, "btnSend", "Send campaign", true);
  assert.match(test.fields.previewOut.innerHTML, /Preview failed/);
  assert.equal(test.state.lastReady, 0);
  assert.equal(test.calls.generatedKeys, 0);
  await previewReady(test);
  assert.equal(test.calls.requests.length, 2, "only the user-requested preview retry is sent");
  cases += 1;
}
{
  const test = fixture();
  test.response("preview", { data: { ok: true, ready_rows: [], invalid_rows: [{ email: "bad", problems: ["invalid"] }] } });
  await test.doPreview();
  button(test, "btnPreview", "Preview", false);
  button(test, "btnSend", "Send campaign", true);
  assert.equal(test.calls.generatedKeys, 0);
  await test.doSend();
  assert.equal(test.calls.requests.length, 1, "zero ready recipients cannot dispatch");
  cases += 1;
}
{
  const test = fixture();
  test.fields.fPath.value = "";
  await test.doPreview();
  button(test, "btnPreview", "Preview", false);
  button(test, "btnSend", "Send campaign", true);
  assert.equal(test.calls.requests.length, 0, "local validation failure cannot dispatch");
  cases += 1;
}
{
  const test = fixture(); await previewReady(test);
  const key = test.state.campaignSendKey;
  const reply = test.response("send", { held: true, data: { ok: true, queued_count: 1 } });
  const pending = test.doSend(); await reply.started;
  button(test, "btnSend", "Sending…", true);
  reply.release(); await pending;
  button(test, "btnSend", "Send campaign", true);
  button(test, "btnPreview", "Preview", false);
  assert.match(test.fields.sendOut.innerHTML, /Campaign created: 1 participant invitation/);
  assert.equal(test.calls.requests[1].options.body.get("campaign_send_key"), key);
  assert.equal(test.calls.requests[1].options.body.get("organization_id"), "org_controlled");
  assert.equal(test.state.campaignSendKey, null);
  assert.equal(test.state.lastReady, 0);
  assert.equal(test.store.size, 0);
  assert.equal(test.calls.clearDraft, 1);
  assert.equal(test.calls.loadTracking, 1);
  await test.doSend();
  assert.equal(test.calls.requests.length, 2, "successful send leaves no ready batch for accidental re-dispatch");
  cases += 1;
}
for (const failure of [
  { status: 503, data: { ok: false, error: "controlled_unavailable" } },
  { error: "controlled_network_failure" }
]) {
  const test = fixture(); await previewReady(test);
  const key = test.state.campaignSendKey;
  test.response("send", failure); await test.doSend();
  button(test, "btnSend", "Send campaign", false);
  button(test, "btnPreview", "Preview", false);
  assert.match(test.fields.sendOut.innerHTML, /Send failed/);
  assert.equal(test.state.campaignSendKey, key, "failed send retains idempotency key");
  assert.equal(test.calls.clearDraft, 0);
  assert.equal(test.calls.loadTracking, 0);
  test.response("send", { data: { ok: true, queued_count: 1 } }); await test.doSend();
  assert.equal(test.calls.requests[1].options.body.get("campaign_send_key"), key);
  assert.equal(test.calls.requests[2].options.body.get("campaign_send_key"), key, "retry uses the same admission identity");
  assert.equal(test.calls.generatedKeys, 1);
  button(test, "btnSend", "Send campaign", true);
  cases += 1;
}

console.log(`Campaign button-state handlers: ${cases} isolated scenarios passed${revision ? ` (source ${revision})` : ""}.`);
