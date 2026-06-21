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
