/* Central authenticated Workspace/product legal-access gate.
   Public pages and directed assignment links do not load this gate. */
(function () {
  "use strict";

  var API_BASE = "https://monderman-api.onrender.com";
  var SB_URL = "https://ptkxrzgmeldalrkfruth.supabase.co";
  var SB_KEY = "sb_publishable_-4d7OaQvErf0mpdwEJhIoQ_skFiVBhz";
  var root = document.documentElement;
  var settleReady;

  root.style.visibility = "hidden";
  window.mondermanWorkspaceAccessReady = new Promise(function (resolve) {
    settleReady = resolve;
  });

  function reveal() {
    root.style.visibility = "";
  }

  function currentTarget() {
    var page = location.pathname.split("/").pop() || "workspace.html";
    return page + (location.search || "") + (location.hash || "");
  }

  function redirectToSignIn(reason) {
    var params = new URLSearchParams({
      next: currentTarget(),
      acceptance_source: "signup"
    });
    if (reason) params.set("access_reason", reason);
    var target = "signin.html?" + params.toString();
    settleReady({ allowed: false, redirected: true, reason: reason || "sign_in_required" });
    location.replace(target);
  }

  function blockingFailure() {
    var panel = document.createElement("div");
    panel.id = "workspaceAccessGateError";
    panel.setAttribute("role", "alert");
    panel.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#F6F3EC;color:#18191C;font:500 15px/1.55 Helvetica,Arial,sans-serif;text-align:center";
    panel.innerHTML = '<div style="max-width:520px;background:#fff;border:1px solid rgba(24,25,28,.12);border-radius:14px;padding:28px;box-shadow:0 18px 42px rgba(8,56,62,.10)"><h1 style="font-size:22px;margin:0 0 10px">Workspace access could not be verified</h1><p style="margin:0 0 18px">Monderman could not verify the current Terms and Privacy Notice. No Workspace or product action has been opened. Please try again.</p><button type="button" style="border:0;border-radius:8px;background:#0C6E78;color:#fff;padding:10px 16px;font:inherit;cursor:pointer" onclick="location.reload()">Try again</button></div>';
    document.body.appendChild(panel);
    reveal();
    settleReady({ allowed: false, redirected: false, reason: "verification_unavailable" });
  }

  async function waitForSupabase() {
    for (var i = 0; i < 80; i += 1) {
      if (window.supabase && typeof window.supabase.createClient === "function") return window.supabase;
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    throw new Error("supabase_client_unavailable");
  }

  async function runGate() {
    // A directed campaign invitation is a separate, token-authorized
    // participant flow. It does not require a participant account or Terms
    // assent merely because the browser also has a signed-in session.
    if (new URLSearchParams(location.search).has("assignment_token")) {
      reveal();
      settleReady({ allowed: true, context: "assignment" });
      return;
    }

    try {
      var library = await waitForSupabase();
      var client = window.__mondermanSB || library.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
      });
      window.__mondermanSB = client;

      // getUser performs a server-backed identity check. getSession is used
      // only to obtain the access token forwarded to the Monderman API.
      var userResult = await client.auth.getUser();
      var sessionResult = await client.auth.getSession();
      var user = userResult && userResult.data && userResult.data.user;
      var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
      if (!user || !token) {
        redirectToSignIn("sign_in_required");
        return;
      }

      var response = await fetch(API_BASE + "/api/legal/acceptance/status?source=signup", {
        headers: { authorization: "Bearer " + token }
      });
      var status = await response.json().catch(function () { return {}; });
      if (!response.ok || status.ok !== true) throw new Error(status.error || "legal_acceptance_status_failed");
      if (status.requiresAcceptance === true) {
        redirectToSignIn("legal_acceptance_required");
        return;
      }

      reveal();
      settleReady({ allowed: true, context: "workspace", enforcementActive: status.enforcementActive === true });
    } catch (error) {
      console.warn("Workspace legal-access gate:", error && error.message ? error.message : error);
      blockingFailure();
    }
  }

  runGate();
})();
