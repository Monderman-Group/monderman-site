/* ============================================================================
   Monderman workspace — light / dark theme toggle (shared helper)
   ----------------------------------------------------------------------------
   Adds a small floating toggle near the Hans launcher, flips <html data-theme>, and
   remembers the choice in localStorage. Default is light; a saved choice wins.
   The theme is also applied by a tiny inline <head> script on each page so the
   first paint is correct (no flash) — this file handles the button + click.

   DEPLOY: put this file at the site root and add ONE line before </body>:
       <script src="workspace-theme.js" defer></script>
   and, high in <head>, the no-flash line:
       <script>try{if(localStorage.getItem("mndTheme")==="dark")
         document.documentElement.setAttribute("data-theme","dark");}catch(e){}</script>
   ============================================================================ */
(function () {
  var KEY = "mndTheme";
  var root = document.documentElement;

  function current() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function apply(theme) {
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  }
  // safety net in case the inline <head> script is missing on a page
  try { apply(localStorage.getItem(KEY) === "dark" ? "dark" : "light"); } catch (e) {}

  var SUN  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

  function render(btn) {
    var dark = current() === "dark";
    btn.innerHTML = (dark ? SUN : MOON) + '<span class="tt-label">' + (dark ? "Light" : "Dark") + "</span>";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    btn.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function mount() {
    if (document.querySelector(".ws5-theme-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ws5-theme-toggle";
    btn.setAttribute("aria-label", "Toggle light or dark mode");
    render(btn);
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      render(btn);
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

/* Campaign entitlement presentation guard.
   The API/database remain the source of truth; this keeps standard-plan UI from
   offering controls that the customer's plan cannot use. */
(function () {
  function planName() {
    var el = document.getElementById("ws5Plan");
    return el ? String(el.textContent || "").trim().toLowerCase() : "";
  }

  function applyCampaignPlanUi() {
    var anon = document.getElementById("fAnon");
    var note = document.getElementById("anonNote");
    var tab = document.getElementById("sendTabBtn");
    var compose = document.getElementById("composeCard");
    if (!anon && !tab && !compose) return;

    var plan = planName();
    if (!plan || plan === "—") return;

    if (plan === "trial") {
      if (anon) { anon.checked = false; anon.disabled = true; }
      if (tab) tab.hidden = true;
      if (compose) compose.hidden = true;
      return;
    }

    if (plan === "signal") {
      if (anon) {
        anon.checked = false;
        anon.disabled = true;
        anon.title = "Anonymous participant responses are included with Pattern.";
      }
      if (note && !note.dataset.signalGate) {
        note.dataset.signalGate = "1";
        note.insertAdjacentHTML("afterbegin", "<b>Plan note:</b> Anonymous participant responses are included with Pattern.<br>");
      }
      return;
    }

    if (plan === "pattern") {
      if (anon) { anon.disabled = false; anon.removeAttribute("title"); }
    }
    // Enterprise capacity is order-form-defined; do not infer custom entitlements here.
  }

  function mountEntitlementGuard() {
    var plan = document.getElementById("ws5Plan");
    if (!plan) return;
    applyCampaignPlanUi();
    new MutationObserver(applyCampaignPlanUi).observe(plan, { childList: true, characterData: true, subtree: true });
    [100, 400, 1000, 2000].forEach(function (ms) { setTimeout(applyCampaignPlanUi, ms); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountEntitlementGuard);
  else mountEntitlementGuard();
})();

/* Paused paid-seat notice.
   Pattern can temporarily carry more Analysts/Admins than the standard Trial
   plan. On a downgrade the database preserves excess users as ordinary Members
   and records their prior staff role. A signed-in user should never have to
   infer why Analysis/results suddenly disappeared, so every Workspace surface
   shows the same explicit explanation. */
(function () {
  var SB_URL = "https://ptkxrzgmeldalrkfruth.supabase.co";
  var SB_KEY = "sb_publishable_-4d7OaQvErf0mpdwEJhIoQ_skFiVBhz";

  function mountNotice(role) {
    if (document.getElementById("ws5SeatPauseNotice")) return;
    var label = role === "admin" ? "Admin" : "Analyst";
    var box = document.createElement("aside");
    box.id = "ws5SeatPauseNotice";
    box.setAttribute("role", "status");
    box.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483000;max-width:760px;width:calc(100% - 32px);padding:12px 16px;border:1px solid rgba(201,130,31,.42);border-radius:10px;background:#FFF8E9;color:#4F421E;box-shadow:0 8px 28px rgba(0,0,0,.12);font:500 13px/1.5 'Neue Haas Grotesk',Helvetica,Arial,sans-serif;text-align:center";
    box.innerHTML = "Your <b>" + label + " Workspace seat is paused</b> because this organization’s current plan has lower staff capacity. Your saved work is retained. Ask a Workspace admin to restore a paid plan or change seat assignments. <a href=\"platform-services.html\" style=\"color:#0C6E78;font-weight:700;text-decoration:none\">See plans →</a>";
    document.body.appendChild(box);
  }

  async function checkPausedSeat() {
    try {
      if (!window.supabase || typeof window.supabase.createClient !== "function") return;
      var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce" } });
      var userResult = await sb.auth.getUser();
      var user = userResult && userResult.data && userResult.data.user;
      if (!user) return;
      var result = await sb.from("organization_members")
        .select("billing_suspended_role")
        .eq("user_id", user.id)
        .not("billing_suspended_role", "is", null)
        .limit(1)
        .maybeSingle();
      if (!result.error && result.data && result.data.billing_suspended_role) mountNotice(result.data.billing_suspended_role);
    } catch (_e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkPausedSeat);
  else checkPausedSeat();
})();
