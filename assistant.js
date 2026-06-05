/* ============================================================================
   Monderman site assistant — drop-in chat widget
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
  if (window.__mondermanAssistantLoaded) return;       // never inject twice
  window.__mondermanAssistantLoaded = true;

  var API_URL    = "https://monderman-api.onrender.com/api/site-assistant";
  var STORAGE_KEY = "mndAssistantHistory";              // survives page-to-page within a tab
  var GREETING   = "Hi — I can help you find your way around Monderman. Ask about the four diagnostics, how to run one, or where something lives on the site.";

  /* ---- styles (scoped under #mnd-*) --------------------------------------- */
  var css = ''
    + '#mnd-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:58px;height:58px;border:none;border-radius:999px;background:#3F6EA1;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(15,23,32,.22);transition:transform .18s ease,background .18s ease}'
    + '#mnd-launcher:hover{background:#315983;transform:translateY(-1px)}'
    + '#mnd-launcher svg{width:26px;height:26px}'
    + '#mnd-panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#fff;border:1px solid rgba(21,32,43,.10);border-radius:20px;box-shadow:0 24px 60px rgba(15,23,32,.22);display:none;flex-direction:column;overflow:hidden;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;color:#15202B}'
    + '#mnd-panel.mnd-open{display:flex}'
    + '#mnd-head{background:#0F1720;color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}'
    + '#mnd-head .mnd-title{font-size:15px;font-weight:600;letter-spacing:-.01em}'
    + '#mnd-head .mnd-sub{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-top:3px}'
    + '#mnd-close{background:transparent;border:none;color:rgba(255,255,255,.7);font-size:24px;line-height:1;cursor:pointer;padding:0 2px}'
    + '#mnd-close:hover{color:#fff}'
    + '#mnd-head .mnd-head-actions{display:flex;align-items:center;gap:10px}'
    + '#mnd-new{background:transparent;border:1px solid rgba(255,255,255,.28);color:rgba(255,255,255,.85);font:inherit;font-size:11.5px;font-weight:500;letter-spacing:.02em;padding:5px 10px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}'
    + '#mnd-new:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.5);color:#fff}'
    + '#mnd-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#F4F6F9}'
    + '.mnd-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}'
    + '.mnd-bot{align-self:flex-start;background:#fff;border:1px solid rgba(21,32,43,.10);color:#15202B}'
    + '.mnd-user{align-self:flex-end;background:#3F6EA1;color:#fff}'
    + '.mnd-msg a{text-decoration:underline}'
    + '.mnd-bot a{color:#315983}.mnd-user a{color:#fff}'
    + '.mnd-typing{align-self:flex-start;display:flex;gap:4px;padding:14px}'
    + '.mnd-typing span{width:7px;height:7px;border-radius:999px;background:#9aa7b4;animation:mndBlink 1.2s infinite}'
    + '.mnd-typing span:nth-child(2){animation-delay:.2s}.mnd-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes mndBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}'
    + '#mnd-foot{border-top:1px solid rgba(21,32,43,.08);padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}'
    + '#mnd-input{flex:1;resize:none;border:1px solid rgba(21,32,43,.14);border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;color:#15202B;max-height:120px;line-height:1.5}'
    + '#mnd-input:focus{outline:none;border-color:#3F6EA1;box-shadow:0 0 0 3px rgba(63,110,161,.12)}'
    + '#mnd-send{flex:0 0 auto;border:none;border-radius:12px;background:#3F6EA1;color:#fff;font:inherit;font-size:14px;font-weight:500;padding:11px 16px;cursor:pointer}'
    + '#mnd-send:hover{background:#315983}#mnd-send:disabled{opacity:.5;cursor:not-allowed}'
    + '@media (max-width:480px){#mnd-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:88vh;max-height:88vh;border-radius:18px 18px 0 0}#mnd-launcher{right:16px;bottom:16px}}';

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
  function open()  { panel.classList.add("mnd-open");  launcher.style.display = "none"; inputEl.focus(); }
  function close() { panel.classList.remove("mnd-open"); launcher.style.display = ""; }

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
        : "Sorry — I had trouble answering just now. You can reach the team at connect@monderman.com.";
      addMsg("assistant", reply);
      history.push({ role: "assistant", content: reply });
      saveHistory();
    } catch (e) {
      hideTyping();
      addMsg("assistant", "Sorry — I couldn't reach the assistant. Please try again, or email connect@monderman.com.");
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
