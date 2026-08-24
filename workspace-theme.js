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
  document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"]').forEach(function (link) { link.remove(); });
  var favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = "assets/brand/monderman-favicon.svg";
  document.head.appendChild(favicon);
  if (!document.querySelector('link[href="assets/brand/brand-lockup.css"]')) {
    var brandStyles = document.createElement("link");
    brandStyles.rel = "stylesheet";
    brandStyles.href = "assets/brand/brand-lockup.css";
    document.head.appendChild(brandStyles);
  }
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
    document.querySelectorAll(".ws-brand,.ws5-brand").forEach(function (brand) {
      if (brand.querySelector(".monderman-lockup__mark")) return;
      brand.classList.add("monderman-lockup");
      brand.insertAdjacentHTML("afterbegin", '<svg class="monderman-lockup__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M15 15L23.5 8L32 14L40.5 8L49 15V56L40.5 49L32 55L23.5 49L15 56Z" stroke-width="2.8" stroke-linejoin="round"/><path d="M23.5 8V49M32 14V55M40.5 8V49" stroke-width="2.4" stroke-linecap="round"/></svg>');
      var name = brand.querySelector("b");
      if (name) name.classList.add("monderman-lockup__name");
      brand.querySelectorAll(".dot,.ws5-brand-dot").forEach(function (dot) { dot.remove(); });
    });
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

/* Paused paid-seat notice.
   Pattern can temporarily carry more Analysts/Admins than the standard Trial
   plan. On a downgrade the database preserves excess users as ordinary Members
   and records their prior staff role. A signed-in user should never have to
   infer why Analysis/results suddenly disappeared, so every Workspace surface
   shows the same explicit explanation. */
(function () {

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
      var access = await window.mondermanWorkspaceAccessReady;
      if (!access || !access.allowed) return;
      var sb = await window.mondermanGetSupabaseClient();
      var userResult = await sb.auth.getUser();
      var user = userResult && userResult.data && userResult.data.user;
      if (!user) return;
      var result = await sb.from("organization_members")
        .select("billing_suspended_role")
        .eq("user_id", user.id)
        .eq("organization_id", window.__mondermanActiveOrganizationId)
        .not("billing_suspended_role", "is", null)
        .limit(1)
        .maybeSingle();
      if (!result.error && result.data && result.data.billing_suspended_role) mountNotice(result.data.billing_suspended_role);
    } catch (_e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkPausedSeat);
  else checkPausedSeat();
})();
