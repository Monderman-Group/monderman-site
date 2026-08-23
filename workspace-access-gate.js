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
  window.mondermanGetSupabaseClient = async function () {
    await window.mondermanWorkspaceAccessReady;
    if (!window.__mondermanSB) throw new Error("workspace_supabase_client_unavailable");
    return window.__mondermanSB;
  };

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

  function setActiveWorkspace(membership) {
    var organization = membership && membership.organizations;
    if (!membership || !organization || !organization.id) return null;
    var active = {
      id: organization.id,
      name: organization.name || "Workspace",
      role: membership.role || "member",
      isOwner: organization.owner_user_id === membership.user_id
    };
    window.__mondermanActiveOrganization = active;
    window.__mondermanActiveOrganizationId = active.id;
    try { sessionStorage.setItem("monderman_active_organization_id", active.id); } catch (_error) {}
    return active;
  }

  function chooseWorkspaceFrom(memberships) {
    return new Promise(function (resolve) {
      var panel = document.createElement("div");
      panel.id = "workspaceChoiceGate";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "workspaceChoiceTitle");
      panel.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#F6F3EC;color:#18191C;font:500 15px/1.55 Helvetica,Arial,sans-serif";
      var card = document.createElement("div");
      card.style.cssText = "width:min(520px,100%);background:#fff;border:1px solid rgba(24,25,28,.12);border-radius:14px;padding:28px;box-shadow:0 18px 42px rgba(8,56,62,.10)";
      card.innerHTML = '<h1 id="workspaceChoiceTitle" style="font-size:22px;margin:0 0 8px">Choose a Workspace</h1><p style="margin:0 0 18px;color:#62656A">Select the Workspace you want to use in this browser session. Monderman will not guess from membership order.</p>';
      memberships.forEach(function (membership) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = membership.organizations && membership.organizations.name
          ? membership.organizations.name
          : "Workspace";
        button.style.cssText = "display:block;width:100%;margin:8px 0 0;border:1px solid #D9D5CB;border-radius:9px;background:#fff;color:#08383E;padding:12px 14px;text-align:left;font:600 15px Helvetica,Arial,sans-serif;cursor:pointer";
        button.addEventListener("click", function () {
          panel.remove();
          resolve(setActiveWorkspace(membership));
        });
        card.appendChild(button);
      });
      panel.appendChild(card);
      document.body.appendChild(panel);
      reveal();
    });
  }

  async function resolveActiveWorkspace(client, user) {
    var inviteResult = await client.rpc("redeem_my_invites");
    if (inviteResult.error) throw new Error("workspace_invite_redemption_failed");

    async function membershipsForUser() {
      return client.from("organization_members")
        .select("user_id, organization_id, role, organizations(id, name, owner_user_id)")
        .eq("user_id", user.id);
    }

    var result = await membershipsForUser();
    if (result.error) throw new Error("workspace_memberships_unavailable");
    var memberships = (result.data || []).filter(function (membership) {
      return membership && membership.organizations && membership.organizations.id;
    });
    if (!memberships.length) {
      var fullName = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || "Monderman User";
      var slugBase = String(fullName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
      var bootstrap = await client.rpc("bootstrap_my_workspace", {
        p_name: fullName + " Workspace",
        p_slug_base: slugBase + "-workspace"
      });
      if (bootstrap.error) throw new Error("workspace_bootstrap_failed");
      result = await membershipsForUser();
      if (result.error) throw new Error("workspace_memberships_unavailable_after_bootstrap");
      memberships = (result.data || []).filter(function (membership) {
        return membership && membership.organizations && membership.organizations.id;
      });
      if (!memberships.length) throw new Error("workspace_bootstrap_returned_no_membership");
    }

    var params = new URLSearchParams(location.search);
    var requested = params.get("organization_id") || "";
    if (!requested) {
      try { requested = sessionStorage.getItem("monderman_active_organization_id") || ""; } catch (_error) {}
    }
    var matched = memberships.find(function (membership) { return membership.organization_id === requested; });
    if (matched) return setActiveWorkspace(matched);
    if (memberships.length === 1) return setActiveWorkspace(memberships[0]);
    return chooseWorkspaceFrom(memberships);
  }

  async function waitForSupabase() {
    for (var i = 0; i < 80; i += 1) {
      if (window.supabase && typeof window.supabase.createClient === "function") return window.supabase;
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    throw new Error("supabase_client_unavailable");
  }

  async function runGate() {
    try {
      var library = await waitForSupabase();
      var client = window.__mondermanSB || library.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
      });
      window.__mondermanSB = client;

      // A directed campaign invitation is a separate, token-authorized
      // participant flow. It does not require a participant account or Terms
      // assent merely because the browser also has a signed-in session. The
      // gate still owns the page's sole Supabase client so tool code never
      // initializes another GoTrueClient for the same storage key.
      if (new URLSearchParams(location.search).has("assignment_token")) {
        reveal();
        settleReady({ allowed: true, context: "assignment" });
        return;
      }

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

      var activeWorkspace = await resolveActiveWorkspace(client, user);

      reveal();
      settleReady({ allowed: true, context: "workspace", enforcementActive: status.enforcementActive === true, activeWorkspace: activeWorkspace });
    } catch (error) {
      console.warn("Workspace legal-access gate:", error && error.message ? error.message : error);
      blockingFailure();
    }
  }

  runGate();
})();
