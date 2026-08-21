import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../workspace-access-gate.js", import.meta.url), "utf8");

async function runScenario({ status, pathname = "/workspace-diagnostics.html", search = "", user = true, memberships = null }) {
  const redirects = [];
  let statusCalls = 0;
  let clientCreations = 0;
  const location = {
    pathname,
    search,
    hash: "#launch",
    replace(target) { redirects.push(target); },
    reload() {}
  };
  const root = { style: {} };
  const elements = [];
  const document = {
    documentElement: root,
    body: { appendChild(element) { elements.push(element); } },
    createElement() {
      return { id: "", style: {}, innerHTML: "", setAttribute() {} };
    }
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: user ? { id: "user-1" } : null } }),
      getSession: async () => ({ data: { session: user ? { access_token: "verified-token" } : null } })
    },
    from: () => ({
      select() { return this; },
      async eq() {
        return { data: memberships || [{ user_id: "user-1", organization_id: "org-1", role: "admin", organizations: { id: "org-1", name: "Fixture Workspace", owner_user_id: "user-1" } }], error: null };
      }
    })
  };
  const window = {
    supabase: { createClient: () => { clientCreations += 1; return client; } },
    __mondermanSB: null
  };
  const context = vm.createContext({
    window,
    document,
    location,
    URLSearchParams,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    Promise,
    setTimeout,
    clearTimeout,
    console,
    fetch: async () => {
      statusCalls += 1;
      return {
        ok: status?.httpOk !== false,
        json: async () => status?.body || status
      };
    }
  });
  vm.runInContext(source, context);
  const decision = await window.mondermanWorkspaceAccessReady;
  return { decision, redirects, statusCalls, root, elements, clientCreations, client: window.__mondermanSB };
}

const blocked = await runScenario({
  status: { ok: true, enforcementActive: true, requiresAcceptance: true }
});
assert.equal(blocked.decision.allowed, false);
assert.equal(blocked.decision.reason, "legal_acceptance_required");
assert.equal(blocked.root.style.visibility, "hidden", "direct product page remains unavailable before assent");
assert.equal(blocked.redirects.length, 1);
assert.match(blocked.redirects[0], /^signin\.html\?/);
assert.match(decodeURIComponent(blocked.redirects[0]), /next=workspace-diagnostics\.html\?*#launch/);
assert.match(blocked.redirects[0], /acceptance_source=signup/);

const accepted = await runScenario({
  status: { ok: true, enforcementActive: true, requiresAcceptance: false, accepted: true }
});
assert.equal(accepted.decision.allowed, true, "current acceptance opens normal Workspace/product use");
assert.equal(accepted.decision.activeWorkspace.id, "org-1");
assert.equal(accepted.clientCreations, 1, "the gate creates exactly one Supabase client");
assert.equal(accepted.root.style.visibility, "");
assert.deepEqual(accepted.redirects, []);

const existingUser = await runScenario({
  status: { ok: true, enforcementActive: true, requiresAcceptance: false, accepted: false }
});
assert.equal(existingUser.decision.allowed, true, "pre-cutover user remains compatible when the API says re-acknowledgement is not required");

const assignment = await runScenario({ search: "?assignment_token=directed-token" });
assert.equal(assignment.decision.context, "assignment", "directed participant flow retains its token-authorized boundary");
assert.equal(assignment.statusCalls, 0);
assert.equal(assignment.clientCreations, 1, "direct assignments retain the same singleton client contract");

const signedOut = await runScenario({ user: false });
assert.equal(signedOut.decision.reason, "sign_in_required");
assert.equal(signedOut.redirects.length, 1);

console.log("Workspace legal gate smoke passed: direct-navigation block, accepted access, pre-cutover compatibility, assignment exemption, and sign-in redirect.");
