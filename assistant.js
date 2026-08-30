/* ============================================================================
   Monderman site assistant: drop-in chat widget
   ----------------------------------------------------------------------------
   HOW TO DEPLOY (once per page, never again):
     Put this file at your site root, then add ONE line right before </body>
     on each page:
         <script src="assistant.js" defer></script>
   It talks ONLY to your own backend (/api/site-assistant). Your Anthropic key
   never touches the browser. Brand-matched to Monderman tokens.
   ============================================================================ */
(function () {
  "use strict";

  // Legacy fallback for pages that have not adopted the canonical public shell.
  // Canonical pages own their responsive navigation in canonical-site-shell.css;
  // injecting this older !important row there would defeat the accessible menu.
  var publicHeaderFix = document.createElement("style");
  publicHeaderFix.id = "mnd-public-header-fix";
  publicHeaderFix.textContent = '@media (max-width:980px){'
    + '.header,.header.scrolled{background:#08383E!important;border-bottom:1px solid rgba(255,255,255,.08)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;height:auto!important;}'
    + '.header-inner{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:10px!important;padding:14px 20px 10px!important;height:auto!important;}'
    + '.brand{flex:0 0 auto!important;}'
    + '.nav{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;justify-content:flex-start!important;align-items:center!important;gap:10px!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;padding:2px 0 8px!important;row-gap:0!important;}'
    + '.nav::-webkit-scrollbar{display:none!important;}'
    + '.nav a{flex:0 0 auto!important;white-space:nowrap!important;font-size:.88rem!important;line-height:1!important;padding:10px 12px!important;border-radius:7px!important;background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.10)!important;color:rgba(245,241,232,.88)!important;}'
    + '.nav a::after{display:none!important;}'
    + '.nav a:hover,.nav a:focus-visible{background:rgba(255,255,255,.10)!important;border-color:rgba(255,255,255,.18)!important;color:#fff!important;transform:none!important;}'
    + '.nav a.is-active{background:rgba(12,110,120,.34)!important;border-color:rgba(79,167,174,.52)!important;color:#fff!important;}'
    + '.nav a.workspace-link{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.22)!important;color:#fff!important;font-weight:600!important;}'
    + '}'
    + '@media (max-width:640px){'
    + '.header-inner{padding:12px 16px 9px!important;gap:9px!important;}'
    + '.nav{gap:8px!important;padding-bottom:7px!important;}'
    + '.nav a{font-size:.84rem!important;padding:9px 11px!important;}'
    + '}';
  if (!document.body.classList.contains("canonical-green-shell")) {
    document.head.appendChild(publicHeaderFix);
  }

  // Homepage hero framing lock. The responsive <picture> can swap source files,
  // but the image itself must remain geometrically centered at every viewport.
  var heroImage = document.getElementById("heroImage");
  if (heroImage) {
    heroImage.style.setProperty("object-fit", "cover", "important");
    heroImage.style.setProperty("object-position", "50% 50%", "important");
    heroImage.style.setProperty("--hero-shift-x", "0%", "important");
    heroImage.style.setProperty("left", "0", "important");
    heroImage.style.setProperty("right", "0", "important");
    heroImage.style.setProperty("transform", "none", "important");
  }


  if (window.__mondermanAssistantLoaded) return;       // never inject twice
  window.__mondermanAssistantLoaded = true;
  var API_URL    = "https://monderman-api.onrender.com/api/site-assistant";
  var STORAGE_KEY = "mndAssistantHistory";              // survives page-to-page within a tab
  var GREETING   = "Hi. I can help you find your way around Monderman. Ask about the four diagnostics, how to run one, or where something lives on the site.";

  // Keep the floating controls out of the footer. The lowest visible widget is
  // treated as the bottom of one shared stack; when the footer reaches it, the
  // stack rises with the footer and then leaves the viewport with the page.
  function ensureFooterDock() {
    if (window.__mondermanFooterDockController) return window.__mondermanFooterDockController;
    var frame = 0;
    var root = document.documentElement;
    function visible(node) {
      return node && window.getComputedStyle(node).display !== "none";
    }
    function stackBottom() {
      var width = window.innerWidth;
      var bottoms = [];
      var assistantLauncher = document.getElementById("mnd-launcher");
      var connectLauncher = document.querySelector(".mdn-cn-launch");
      var assistantPanel = document.getElementById("mnd-panel");
      if (visible(assistantLauncher)) bottoms.push(width <= 480 ? 16 : 20);
      if (visible(connectLauncher)) bottoms.push(width <= 640 ? 84 : 90);
      if (width > 480 && assistantPanel && assistantPanel.classList.contains("mnd-open") && visible(assistantPanel)) bottoms.push(90);
      return bottoms.length ? Math.min.apply(Math, bottoms) : null;
    }
    function render() {
      frame = 0;
      var footer = document.querySelector(".mond-footer");
      var base = stackBottom();
      var viewportHeight = window.innerHeight || root.clientHeight;
      var gap = window.innerWidth <= 640 ? 12 : 16;
      var lift = footer && base != null
        ? Math.max(0, Math.ceil(viewportHeight - footer.getBoundingClientRect().top - base + gap))
        : 0;
      var width = window.innerWidth;
      var assistantLauncher = document.getElementById("mnd-launcher");
      var connectLauncher = document.querySelector(".mdn-cn-launch");
      var assistantPanel = document.getElementById("mnd-panel");
      var connectPanel = document.getElementById("mdn-cn-panel");
      if (assistantLauncher) assistantLauncher.style.setProperty("bottom", (width <= 480 ? 16 : 20) + lift + "px", "important");
      if (connectLauncher) connectLauncher.style.setProperty("bottom", (width <= 640 ? 84 : 90) + lift + "px", "important");
      if (assistantPanel) {
        if (width <= 480) assistantPanel.style.removeProperty("bottom");
        else assistantPanel.style.setProperty("bottom", 90 + lift + "px", "important");
      }
      if (connectPanel) connectPanel.style.setProperty("bottom", (width <= 640 ? 142 : 148) + lift + "px", "important");
    }
    function update() {
      if (!frame) frame = window.requestAnimationFrame(render);
    }
    var controller = { update: update };
    window.__mondermanFooterDockController = controller;
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update, { passive: true });
      window.visualViewport.addEventListener("scroll", update, { passive: true });
    }
    update();
    return controller;
  }

  var footerDock = ensureFooterDock();
  /* ---- styles (scoped under #mnd-*) --------------------------------------- */
  var css = ''
    + '#mnd-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border:none;border-radius:999px;background:#0C6E78;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(24,22,18,.22);transition:transform .18s ease,background .18s ease}'
    + '#mnd-launcher:hover{background:#0A5B63;transform:translateY(-1px)}'
    + '#mnd-launcher svg{width:26px;height:26px}'
    + '#mnd-panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border:1px solid #EAE6DD;border-radius:20px;box-shadow:0 24px 60px rgba(24,22,18,.22);display:none;flex-direction:column;overflow:hidden;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;color:#18191C}'
    + '#mnd-panel.mnd-open{display:flex}'
    + '#mnd-head{background:#18191C;color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}'
    + '#mnd-head .mnd-title{font-size:15px;font-weight:600;letter-spacing:-.01em}'
    + '#mnd-head .mnd-sub{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-top:3px}'
    + '#mnd-close{background:transparent;border:none;color:rgba(255,255,255,.7);font-size:24px;line-height:1;cursor:pointer;padding:0 2px}'
    + '#mnd-close:hover{color:#fff}'
    + '#mnd-head .mnd-head-actions{display:flex;align-items:center;gap:10px}'
    + '#mnd-new{background:transparent;border:1px solid rgba(255,255,255,.28);color:rgba(255,255,255,.85);font:inherit;font-size:11.5px;font-weight:500;letter-spacing:.02em;padding:5px 10px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}'
    + '#mnd-new:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.5);color:#fff}'
    + '#mnd-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#F6F3EC}'
    + '.mnd-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}'
    + '.mnd-bot{align-self:flex-start;background:#fff;border:1px solid #EAE6DD;color:#18191C}'
    + '.mnd-user{align-self:flex-end;background:#0C6E78;color:#fff}'
    + '.mnd-msg a{text-decoration:underline}'
    + '.mnd-bot a{color:#0A5B63}.mnd-user a{color:#fff}'
    + '.mnd-typing{align-self:flex-start;display:flex;gap:4px;padding:14px}'
    + '.mnd-typing span{width:7px;height:7px;border-radius:999px;background:#9A9892;animation:mndBlink 1.2s infinite}'
    + '.mnd-typing span:nth-child(2){animation-delay:.2s}.mnd-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes mndBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}'
    + '#mnd-foot{border-top:1px solid #F1EEE7;padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}'
    + '#mnd-input{flex:1;resize:none;border:1px solid #EAE6DD;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;color:#18191C;max-height:120px;line-height:1.5}'
    + '#mnd-input:focus{outline:none;border-color:#0C6E78;box-shadow:0 0 0 3px rgba(12,110,120,.14)}'
    + '#mnd-send{flex:0 0 auto;border:none;border-radius:12px;background:#0C6E78;color:#fff;font:inherit;font-size:14px;font-weight:500;padding:11px 16px;cursor:pointer}'
    + '#mnd-send:hover{background:#0A5B63}#mnd-send:disabled{opacity:.5;cursor:not-allowed}'
    + '#mnd-launcher.mnd-dock-left{left:20px;right:auto}'
    + '#mnd-panel.mnd-dock-left{left:20px;right:auto}'
    + '@media (max-width:480px){#mnd-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:88vh;max-height:88vh;border-radius:18px 18px 0 0}#mnd-launcher{right:16px;bottom:16px}#mnd-launcher.mnd-dock-left{left:16px;right:auto}#mnd-panel.mnd-dock-left{left:0;right:0;width:100vw;max-width:100vw}}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  /* ---- DOM ----------------------------------------------------------------- */
  var launcher = document.createElement("button");
  launcher.id = "mnd-launcher";
  launcher.setAttribute("aria-label", "Open the Monderman assistant");
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  var panel = document.createElement("div");
  panel.id = "mnd-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Monderman assistant");
  panel.innerHTML =
    '<div id="mnd-head"><div><div class="mnd-title">Monderman assistant</div><div class="mnd-sub">Here to help you navigate</div></div><div class="mnd-head-actions"><button id="mnd-new" aria-label="Start a new chat">New chat</button><button id="mnd-close" aria-label="Close assistant">&times;</button></div></div>'
    + '<div id="mnd-msgs"></div>'
    + '<div id="mnd-foot"><textarea id="mnd-input" rows="1" placeholder="Ask about Monderman…" aria-label="Type your question"></textarea><button id="mnd-send">Send</button></div>';
  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  footerDock.update();
  // On the diagnostic tool pages, the run's own status messages sit bottom-right.
  // Dock the assistant bottom-left there so it never covers them. Detected by the
  // diagnostic's status container (#toastStack), which only those pages have:
  // content pages keep the bubble bottom-right.
  if (document.getElementById("toastStack") || document.querySelector(".toast-stack")) {
    launcher.classList.add("mnd-dock-left");
    panel.classList.add("mnd-dock-left");
  }
  var msgsEl = panel.querySelector("#mnd-msgs");
  var inputEl = panel.querySelector("#mnd-input");
  var sendEl  = panel.querySelector("#mnd-send");
  var history = loadHistory();
  var busy = false;
  /* ---- helpers ------------------------------------------------------------- */
  function loadHistory() {
    try { var raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function linkify(s) {
    return escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var clean = u.replace(/[.,;:)\]]+$/, "");        // keep trailing punctuation out of the link
      var trail = u.slice(clean.length);
      return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer">' + clean + '</a>' + trail;
    });
  }
  function addMsg(role, text) {
    var div = document.createElement("div");
    div.className = "mnd-msg " + (role === "user" ? "mnd-user" : "mnd-bot");
    div.innerHTML = linkify(text);
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function showTyping() {
    var t = document.createElement("div");
    t.className = "mnd-typing"; t.id = "mnd-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var t = msgsEl.querySelector("#mnd-typing"); if (t) t.remove(); }
  function render() {
    msgsEl.innerHTML = "";
    addMsg("assistant", GREETING);                      // greeting is client-only, never sent to the API
    history.forEach(function (m) { addMsg(m.role, m.content); });
  }
  function open()  { panel.classList.add("mnd-open");  launcher.style.display = "none"; footerDock.update(); inputEl.focus(); }
  function close() { panel.classList.remove("mnd-open"); launcher.style.display = ""; footerDock.update(); }
  async function send() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = ""; inputEl.style.height = "auto";
    addMsg("user", text);
    history.push({ role: "user", content: text });
    saveHistory();
    busy = true; sendEl.disabled = true; showTyping();
    try {
      var res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) })
      });
      var data = await res.json().catch(function () { return null; });
      hideTyping();
      var reply = (data && data.reply)
        ? data.reply
        : "Sorry, I had trouble answering just now. You can reach the team at connect@monderman.com.";
      addMsg("assistant", reply);
      history.push({ role: "assistant", content: reply });
      saveHistory();
    } catch (e) {
      hideTyping();
      addMsg("assistant", "Sorry, I couldn't reach the assistant. Please try again, or email connect@monderman.com.");
    } finally {
      busy = false; sendEl.disabled = false; inputEl.focus();
    }
  }
  /* ---- events -------------------------------------------------------------- */
  launcher.addEventListener("click", open);
  panel.querySelector("#mnd-close").addEventListener("click", close);
  panel.querySelector("#mnd-new").addEventListener("click", function () {
    history = [];
    saveHistory();   // clears the saved copy too, so the reset carries across pages
    render();        // back to just the greeting
    inputEl.focus();
  });
  sendEl.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    else if (e.key === "Escape") { close(); }
  });
  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });
  render();
})();
