import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../workspace-access-gate.js", import.meta.url), "utf8");

async function runScenario({ status, pathname = "/workspace-diagnostics.html", search = "", user = true, memberships = null, evaluation = {ok:true,organizationId:'org-1',evaluation:{status:"none"}}, legacyPublicFlag = false }) {
  const redirects = [];
  let statusCalls = 0;
  let clientCreations = 0;
  let bootstrapCalls = 0;
  let currentMemberships = memberships;
  const location = {
    pathname,
    search,
    hash: "#launch",
    replace(target) { redirects.push(target); },
    reload() {}
  };
  const root = { style: {} };
  const elements = [];
  const evaluationCalls = [];
  const document = {
    documentElement: root,
    body: { appendChild(element) { elements.push(element); } },
    head: { appendChild(element) { elements.push(element); } },
    getElementById(id) { return elements.find(element=>element.id===id) || null; },
    createElement() {
      return { id: "", style: {}, innerHTML: "", setAttribute() {} };
    }
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: user ? { id: "user-1", user_metadata: { full_name: "Fixture User" } } : null } }),
      getSession: async () => ({ data: { session: user ? { access_token: "verified-token" } : null } })
    },
    rpc: async (name) => {
      if (name === "redeem_my_invites") return { data: null, error: null };
      if (name === "bootstrap_my_workspace") {
        bootstrapCalls += 1;
        currentMemberships = [{ user_id: "user-1", organization_id: "org-new", role: "owner", organizations: { id: "org-new", name: "Fixture User Workspace", owner_user_id: "user-1" } }];
        return { data: { organization_id: "org-new" }, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    from: () => ({
      select() { return this; },
      async eq() {
        return { data: currentMemberships === null ? [{ user_id: "user-1", organization_id: "org-1", role: "admin", organizations: { id: "org-1", name: "Fixture Workspace", owner_user_id: "user-1" } }] : currentMemberships, error: null };
      }
    })
  };
  const window = {
    supabase: { createClient: () => { clientCreations += 1; return client; } },
    __mondermanSB: null
  };
  window.MONDERMAN_ALLOW_PUBLIC_FIRST_RUN = legacyPublicFlag;
  const context = vm.createContext({
    window,
    document,
    location,
    URLSearchParams,
    AbortController,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    Promise,
    setTimeout,
    clearTimeout,
    console,
    fetch: async (url, options) => {
      if (url.includes('/api/evaluation/status')) {
        evaluationCalls.push({url,options});
        return {ok:evaluation?.ok===true,json:async()=>evaluation};
      }
      statusCalls += 1;
      return {
        ok: status?.httpOk !== false,
        json: async () => status?.body || status
      };
    }
  });
  vm.runInContext(source, context);
  const decision = await window.mondermanWorkspaceAccessReady;
  await window.mondermanEvaluationReady;
  return { decision, redirects, statusCalls, root, elements, evaluationCalls, refresh:window.mondermanRefreshEvaluationStatus, snapshot:window.__mondermanEvaluationStatus, clientCreations, bootstrapCalls, client: window.__mondermanSB };
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

const directNewAccount = await runScenario({
  pathname: "/structural-clarity.html",
  memberships: [],
  status: { ok: true, enforcementActive: true, requiresAcceptance: false, accepted: true }
});
assert.equal(directNewAccount.decision.allowed, true, "a new account may enter a Diagnostic after isolated Workspace bootstrap");
assert.equal(directNewAccount.decision.activeWorkspace.id, "org-new");
assert.equal(directNewAccount.bootstrapCalls, 1, "new-account Diagnostic entry bootstraps exactly one Workspace");

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

const obsoletePublicBypass = await runScenario({user:false,pathname:'/decision-velocity.html',legacyPublicFlag:true});
assert.equal(obsoletePublicBypass.decision.allowed,false,'stale public-first-run flag cannot bypass invitation entry');
const evaluating = await runScenario({status:{ok:true,requiresAcceptance:false},evaluation:{ok:true,organizationId:'org-1',serverNow:'2026-09-19T12:00:00Z',evaluation:{status:'active',daysRemaining:60,endsAt:'2026-11-18T12:00:00Z'}}});
assert.equal(evaluating.evaluationCalls.length,1);
assert.match(evaluating.evaluationCalls[0].url,/organization_id=org-1$/);
assert.equal(evaluating.evaluationCalls[0].options.headers.authorization,'Bearer verified-token');
assert.equal(evaluating.evaluationCalls[0].options.cache,'no-store');
assert.ok(evaluating.elements.some(element=>element.src==='workspace-evaluation.js?v=20260919.invited1'));
await evaluating.refresh(true);
assert.equal(evaluating.evaluationCalls.length,2,'returning to the tab can refresh its server clock');
assert.equal(evaluating.elements.filter(element=>element.id==='workspaceEvaluationScript').length,1,'status refresh cannot duplicate the banner script');
const wrongOrganization = await runScenario({status:{ok:true,requiresAcceptance:false},evaluation:{ok:true,organizationId:'other-org',evaluation:{status:'active'}}});
assert.equal(wrongOrganization.snapshot,undefined,'another organization status is never shown');
const unavailable = await runScenario({status:{ok:true,requiresAcceptance:false},evaluation:{ok:false}});
assert.equal(unavailable.decision.allowed,true,'countdown outage does not block access to saved reports');
assert.equal(unavailable.snapshot,undefined,'an unavailable response must not invent a countdown');

console.log("Workspace legal gate smoke passed: direct-navigation block, accepted access, pre-cutover compatibility, assignment exemption, and sign-in redirect.");
