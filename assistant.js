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
  var GREETING   = "Hi. I’m Monderman’s AI site guide. Ask what the diagnostics cover, how to start the free Decision Velocity run, or how the pilot works. I explain the product, not its private implementation. I can make mistakes; check important details with the team.";

  // Keep the floating controls out of the footer. The footer already carries
  // contact routes, so the closed launchers retire when it enters the viewport.
  function ensureFooterDock() {
    if (window.__mondermanFooterDockController) return window.__mondermanFooterDockController;
    var frame = 0;
    var root = document.documentElement;
    function render() {
      frame = 0;
      var footer = document.querySelector(".mond-footer");
      var viewportHeight = window.innerHeight || root.clientHeight;
      var footerInView = footer && footer.getBoundingClientRect().top < viewportHeight;
      var lift = 0;
      var width = window.innerWidth;
      var assistantLauncher = document.getElementById("mnd-launcher");
      var connectLauncher = document.querySelector(".mdn-cn-launch");
      var assistantPanel = document.getElementById("mnd-panel");
      var connectPanel = document.getElementById("mdn-cn-panel");
      [assistantLauncher, connectLauncher].forEach(function (launcher) {
        if (!launcher) return;
        if (footerInView) {
          launcher.style.setProperty("visibility", "hidden", "important");
          launcher.style.setProperty("pointer-events", "none", "important");
        } else {
          launcher.style.removeProperty("visibility");
          launcher.style.removeProperty("pointer-events");
        }
      });
      if (assistantLauncher) assistantLauncher.style.setProperty("bottom", (width <= 480 ? 16 : 20) + lift + "px", "important");
      if (connectLauncher) {
        connectLauncher.style.setProperty("bottom", (width <= 1180 ? 84 : 90) + lift + "px", "important");
        connectLauncher.style.setProperty("right", (width <= 480 ? 16 : 20) + "px", "important");
      }
      if (assistantPanel) {
        if (width <= 480) assistantPanel.style.removeProperty("bottom");
        else assistantPanel.style.setProperty("bottom", 90 + lift + "px", "important");
      }
      if (connectPanel) connectPanel.style.setProperty("bottom", (width <= 1180 ? 140 : 148) + lift + "px", "important");
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
    + '#mnd-head>div:first-child{flex:1 1 180px;min-width:0}#mnd-head .mnd-head-actions{display:flex;flex:0 0 auto;align-items:center;gap:6px}'
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
    + '@media (max-width:1180px){#mnd-launcher{right:20px;width:48px;height:48px}#mnd-launcher svg{width:22px;height:22px}}'
    + '#mnd-panel,#mnd-panel *{box-sizing:border-box}#mnd-head,#mnd-foot{flex-shrink:0}#mnd-head{flex-wrap:wrap}#mnd-head .mnd-head-actions{margin-left:auto}'
    + '#mnd-msgs{min-height:0;min-width:0}.mnd-msg{flex-shrink:0;min-width:0;overflow-wrap:anywhere}#mnd-input{min-width:0;min-height:44px;width:0;font-size:16px}#mnd-send,#mnd-close,#mnd-new{min-height:44px}#mnd-close{min-width:44px}'
    + '#mnd-notice,#mnd-status{flex-shrink:0;margin:0;padding:8px 12px;font-size:12px;line-height:1.45;color:#4B4D52;background:#fff;overflow-wrap:anywhere}#mnd-notice a{color:#0A5B63;text-decoration:underline}#mnd-status:empty{display:none}#mnd-status{color:#8B3434}'
    + '#mnd-panel button:focus-visible,#mnd-panel a:focus-visible{outline:3px solid #83BAC0;outline-offset:2px}'
    + '@media(prefers-reduced-motion:reduce){.mnd-typing span{animation:none}#mnd-launcher{transition:none}}'
    + '@media (max-width:480px){#mnd-panel{right:0;bottom:0;width:100%;max-width:100%;height:88vh;height:88dvh;max-height:88vh;max-height:88dvh;border-radius:18px 18px 0 0}#mnd-foot{padding-bottom:max(12px,env(safe-area-inset-bottom))}#mnd-launcher{right:16px;bottom:16px}#mnd-launcher.mnd-dock-left{left:16px;right:auto}#mnd-panel.mnd-dock-left{left:0;right:0;width:100%;max-width:100%}}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  /* ---- DOM ----------------------------------------------------------------- */
  var launcher = document.createElement("button");
  launcher.id = "mnd-launcher";
  launcher.setAttribute("aria-label", "Open the Monderman assistant");
  launcher.setAttribute("aria-controls", "mnd-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  var panel = document.createElement("div");
  panel.id = "mnd-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Monderman assistant");
  panel.innerHTML =
    '<div id="mnd-head"><div><div class="mnd-title">Monderman assistant</div><div class="mnd-sub">AI site guide</div></div><div class="mnd-head-actions"><button id="mnd-new" aria-label="Start a new chat">New chat</button><button id="mnd-close" aria-label="Close assistant">&times;</button></div></div>'
    + '<div id="mnd-msgs" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div>'
    + '<p id="mnd-notice">Messages are sent to Anthropic to provide AI guidance. Do not paste personal, confidential, classified or controlled information. <a href="privacy.html">Privacy</a></p>'
    + '<p id="mnd-status" role="status" aria-live="polite"></p>'
    + '<div id="mnd-foot"><textarea id="mnd-input" rows="1" maxlength="2000" aria-describedby="mnd-notice mnd-status" placeholder="Ask about Monderman…" aria-label="Type your question"></textarea><button id="mnd-send">Send</button></div>';
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
  var requestVersion = 0;
  var activeRequest = null;
  var statusEl = panel.querySelector("#mnd-status");
  /* ---- helpers ------------------------------------------------------------- */
  function loadHistory() {
    try { var raw = sessionStorage.getItem(STORAGE_KEY); return cleanHistory(raw ? JSON.parse(raw) : []); }
    catch (e) { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
  }
  function cleanHistory(value) {
    if (!Array.isArray(value)) return [];
    var pairs = [];
    for (var i = 0; i + 1 < value.length; i += 2) {
      var question = value[i], answer = value[i + 1];
      if (!question || !answer || question.role !== "user" || answer.role !== "assistant" ||
          typeof question.content !== "string" || typeof answer.content !== "string" ||
          !question.content.trim() || question.content.length > 2000 || !answer.content.trim() || answer.content.length > 8000) return [];
      pairs.push({ role: "user", content: question.content }, { role: "assistant", content: answer.content });
    }
    return pairs.slice(-20);
  }
  function requestMessages(text) {
    var messages = history.slice(-10).map(function (message) {
      var content = message.content.slice(0, 2000).replace(/[\uD800-\uDBFF]$/, "");
      return { role: message.role, content: content };
    }).concat({ role: "user", content: text });
    var encoder = new TextEncoder();
    while (messages.length > 1 && messages.reduce(function (total, message) { return total + encoder.encode(message.content).length; }, 0) > 8000) messages.splice(0, 2);
    return messages;
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function linkify(s) {
    return escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var clean = u.replace(/[.,;:)\]]+$/, "");        // keep trailing punctuation out of the link
      var trail = u.slice(clean.length);
      try {
        var url = new URL(clean.replace(/&amp;/g, "&"));
        if (url.protocol !== "https:" || !["www.monderman.com", "monderman.com"].includes(url.hostname) || url.username || url.password || url.port) return u;
      } catch (_error) { return u; }
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
    t.setAttribute("role", "status");
    t.setAttribute("aria-label", "Assistant is replying");
    t.innerHTML = "<span></span><span></span><span></span>";
    msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var t = msgsEl.querySelector("#mnd-typing"); if (t) t.remove(); }
  function render() {
    msgsEl.innerHTML = "";
    addMsg("assistant", GREETING);                      // greeting is client-only, never sent to the API
    history.forEach(function (m) { addMsg(m.role, m.content); });
  }
  function open() {
    var openContactClose = document.querySelector("#mdn-cn-panel.mdn-cn-open .mdn-cn-close");
    if (openContactClose) openContactClose.click();
    panel.classList.add("mnd-open");
    launcher.setAttribute("aria-expanded", "true");
    launcher.style.display = "none";
    footerDock.update();
    inputEl.focus();
  }
  function close() {
    panel.classList.remove("mnd-open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.style.display = "";
    footerDock.update();
    var menuAction = document.querySelector('[data-site-widget-action="assistant"]');
    var menuButton = document.querySelector(".site-menu-button");
    var returnTarget = menuAction && menuAction.getClientRects().length
      ? menuAction
      : menuButton && menuButton.getClientRects().length ? menuButton : launcher;
    returnTarget.focus();
  }
  async function send() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    if (text.length > 2000) { statusEl.textContent = "Please shorten your question to 2,000 characters or fewer."; return; }
    statusEl.textContent = "";
    var version = ++requestVersion;
    var controller = new AbortController();
    activeRequest = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 45000);
    inputEl.value = ""; inputEl.style.height = "auto";
    addMsg("user", text);
    busy = true; sendEl.disabled = true; inputEl.readOnly = true; showTyping();
    try {
      var res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages(text) })
      });
      var data = await res.json().catch(function () { return null; });
      if (version !== requestVersion) return;
      if (!res.ok) { var failure = new Error("request_failed"); failure.status = res.status; throw failure; }
      if (data && data.source === "fallback") throw new Error("assistant_unavailable");
      if (!data || typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > 8000) throw new Error("invalid_reply");
      hideTyping();
      var reply = data.reply;
      addMsg("assistant", reply);
      // Show a safe refusal without feeding its rejected prompt back into the
      // next request. Provider fallbacks are handled as retryable failures.
      if (data.source !== "policy") {
        history = cleanHistory(history.concat({ role: "user", content: text }, { role: "assistant", content: reply }));
        saveHistory();
      }
    } catch (e) {
      if (version !== requestVersion) return;
      render();
      inputEl.value = text;
      statusEl.textContent = e.status === 429 ? "The assistant is busy. Wait a moment, then select Send to try again. Your question has not been added to the conversation."
        : "The assistant could not reply. Your question is still here. Select Send to try again, or email connect@monderman.com.";
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion) {
        activeRequest = null; busy = false; sendEl.disabled = false; inputEl.readOnly = false;
        if (panel.classList.contains("mnd-open")) inputEl.focus();
      }
    }
  }
  /* ---- events -------------------------------------------------------------- */
  launcher.addEventListener("click", open);
  panel.querySelector("#mnd-close").addEventListener("click", close);
  panel.querySelector("#mnd-new").addEventListener("click", function () {
    requestVersion += 1;
    if (activeRequest) activeRequest.abort();
    activeRequest = null; busy = false; sendEl.disabled = false; inputEl.readOnly = false;
    inputEl.value = ""; statusEl.textContent = "";
    history = [];
    saveHistory();   // clears the saved copy too, so the reset carries across pages
    render();        // back to just the greeting
    inputEl.focus();
  });
  sendEl.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } });
  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });
  render();
})();
