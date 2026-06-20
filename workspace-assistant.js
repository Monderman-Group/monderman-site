/* ============================================================================
   Monderman WORKSPACE assistant — "Hans"
   ----------------------------------------------------------------------------
   A separate, more advanced guide that lives ONLY inside the workspace. It is
   independent of the public site assistant (assistant.js): its own widget, its
   own chat history, and its own backend route (/api/workspace-assistant).

   DEPLOY: put this file at the site root and add ONE line before </body> on
   each workspace page:
       <script src="workspace-assistant.js" defer></script>

   "Hans" is only a name — a quiet tribute to the engineer Hans Monderman. This
   widget never presents itself as that person; the info panel says so plainly.
   Your Anthropic key never touches the browser.
   ============================================================================ */
(function () {
  "use strict";
  if (window.__mondermanHansLoaded) return;
  window.__mondermanHansLoaded = true;

  var API_URL     = "https://monderman-api.onrender.com/api/workspace-assistant";
  var STORAGE_KEY = "mndHansHistory";
  var GREETING    = "I’m Hans — your guide to the Monderman workspace. Ask me what an instrument is for, how to send a diagnostic to your team, or how to make sense of your analysis, and I’ll walk you through it.";
  var INFO_TEXT   = "Hans is a workspace assistant, calibrated to help you use Monderman — what each of the four instruments is for, how to compose and track a campaign, and how to read your analysis. Hans explains how to operate the workspace; it won’t interpret your organisation’s results or reveal the methodology behind the scores.\n\nNamed in tribute to the engineer Hans Monderman — it isn’t him, and doesn’t speak for him.";

  /* ---- styles (scoped under #hans-*) -------------------------------------- */
  var css = ''
    + '#hans-launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;width:60px;height:60px;border:none;border-radius:999px;background:#0F1720;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 34px rgba(15,23,32,.28);transition:transform .18s ease,box-shadow .18s ease}'
    + '#hans-launcher::after{content:"";position:absolute;inset:3px;border-radius:999px;border:1.5px solid rgba(63,110,161,.7);pointer-events:none}'
    + '#hans-launcher:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(15,23,32,.34)}'
    + '#hans-launcher .hans-mono{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:700;font-size:24px;line-height:1;letter-spacing:-.02em}'
    + '#hans-launcher .hans-spark{position:absolute;top:11px;right:12px;width:6px;height:6px;border-radius:999px;background:#3F6EA1;box-shadow:0 0 0 3px #0F1720}'
    + '#hans-panel{position:fixed;right:22px;bottom:94px;z-index:2147483000;width:384px;max-width:calc(100vw - 32px);height:564px;max-height:calc(100vh - 124px);background:#fff;border:1px solid rgba(21,32,43,.10);border-radius:20px;box-shadow:0 26px 64px rgba(15,23,32,.26);display:none;flex-direction:column;overflow:hidden;font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif;color:#15202B}'
    + '#hans-panel.hans-open{display:flex}'
    + '#hans-head{background:#0F1720;color:#fff;padding:15px 16px 16px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #3F6EA1}'
    + '#hans-ava{flex:0 0 auto;width:38px;height:38px;border-radius:999px;background:#3F6EA1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;letter-spacing:-.01em}'
    + '#hans-head .hans-id{flex:1;min-width:0}'
    + '#hans-head .hans-title{font-size:15px;font-weight:600;letter-spacing:-.01em}'
    + '#hans-head .hans-sub{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-top:3px}'
    + '#hans-head .hans-actions{display:flex;align-items:center;gap:8px}'
    + '.hans-icon-btn{background:transparent;border:1px solid rgba(255,255,255,.26);color:rgba(255,255,255,.85);width:28px;height:28px;border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit;font-size:13px;transition:background .15s,border-color .15s,color .15s}'
    + '.hans-icon-btn:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.5);color:#fff}'
    + '#hans-info-btn{font-style:italic;font-weight:600;font-family:Georgia,"Times New Roman",serif}'
    + '#hans-new{background:transparent;border:1px solid rgba(255,255,255,.26);color:rgba(255,255,255,.85);font:inherit;font-size:11.5px;font-weight:500;padding:5px 10px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}'
    + '#hans-new:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.5);color:#fff}'
    + '#hans-close{background:transparent;border:none;color:rgba(255,255,255,.7);font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    + '#hans-close:hover{color:#fff}'
    + '#hans-body{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}'
    + '#hans-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#F4F6F9}'
    + '.hans-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}'
    + '.hans-bot{align-self:flex-start;background:#fff;border:1px solid rgba(21,32,43,.10);color:#15202B}'
    + '.hans-user{align-self:flex-end;background:#3F6EA1;color:#fff}'
    + '.hans-msg a{text-decoration:underline}.hans-bot a{color:#315983}.hans-user a{color:#fff}'
    + '.hans-typing{align-self:flex-start;display:flex;gap:4px;padding:14px}'
    + '.hans-typing span{width:7px;height:7px;border-radius:999px;background:#9aa7b4;animation:hansBlink 1.2s infinite}'
    + '.hans-typing span:nth-child(2){animation-delay:.2s}.hans-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes hansBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}'
    + '#hans-foot{border-top:1px solid rgba(21,32,43,.08);padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}'
    + '#hans-input{flex:1;resize:none;border:1px solid rgba(21,32,43,.14);border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;color:#15202B;max-height:120px;line-height:1.5}'
    + '#hans-input:focus{outline:none;border-color:#3F6EA1;box-shadow:0 0 0 3px rgba(63,110,161,.12)}'
    + '#hans-send{flex:0 0 auto;border:none;border-radius:12px;background:#3F6EA1;color:#fff;font:inherit;font-size:14px;font-weight:500;padding:11px 16px;cursor:pointer}'
    + '#hans-send:hover{background:#315983}#hans-send:disabled{opacity:.5;cursor:not-allowed}'
    + '#hans-info-panel{position:absolute;inset:0;background:#fff;display:none;flex-direction:column;padding:22px 22px 20px;overflow-y:auto}'
    + '#hans-info-panel.hans-show{display:flex}'
    + '#hans-info-panel .hans-info-h{display:flex;align-items:center;gap:11px;margin-bottom:14px}'
    + '#hans-info-panel .hans-info-h .hans-info-ava{width:34px;height:34px;border-radius:999px;background:#3F6EA1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}'
    + '#hans-info-panel .hans-info-h b{font-size:15px;font-weight:600}'
    + '#hans-info-panel p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#3a4654;white-space:pre-wrap}'
    + '#hans-info-done{align-self:flex-start;margin-top:6px;border:none;border-radius:999px;background:#0F1720;color:#fff;font:inherit;font-size:13px;font-weight:500;padding:9px 18px;cursor:pointer}'
    + '#hans-info-done:hover{background:#1c2937}'
    + '@media (max-width:480px){#hans-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:88vh;max-height:88vh;border-radius:18px 18px 0 0}#hans-launcher{right:16px;bottom:16px}}';

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---- DOM ----------------------------------------------------------------- */
  var launcher = document.createElement("button");
  launcher.id = "hans-launcher";
  launcher.setAttribute("aria-label", "Open Hans, the workspace guide");
  launcher.innerHTML = '<span class="hans-mono">H</span><span class="hans-spark"></span>';

  var panel = document.createElement("div");
  panel.id = "hans-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Hans — workspace guide");
  panel.innerHTML =
      '<div id="hans-head">'
    +   '<div id="hans-ava" aria-hidden="true">H</div>'
    +   '<div class="hans-id"><div class="hans-title">Hans</div><div class="hans-sub">Workspace guide</div></div>'
    +   '<div class="hans-actions">'
    +     '<button id="hans-info-btn" class="hans-icon-btn" aria-label="About Hans" title="About Hans">i</button>'
    +     '<button id="hans-new" aria-label="Start a new chat">New chat</button>'
    +     '<button id="hans-close" aria-label="Close Hans">&times;</button>'
    +   '</div>'
    + '</div>'
    + '<div id="hans-body">'
    +   '<div id="hans-msgs"></div>'
    +   '<div id="hans-foot"><textarea id="hans-input" rows="1" placeholder="Ask Hans about the workspace…" aria-label="Type your question"></textarea><button id="hans-send">Send</button></div>'
    +   '<div id="hans-info-panel" role="region" aria-label="About Hans">'
    +     '<div class="hans-info-h"><div class="hans-info-ava" aria-hidden="true">H</div><b>About Hans</b></div>'
    +     '<p id="hans-info-text"></p>'
    +     '<button id="hans-info-done" type="button">Got it</button>'
    +   '</div>'
    + '</div>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  panel.querySelector("#hans-info-text").textContent = INFO_TEXT;

  var msgsEl  = panel.querySelector("#hans-msgs");
  var inputEl = panel.querySelector("#hans-input");
  var sendEl  = panel.querySelector("#hans-send");
  var infoEl  = panel.querySelector("#hans-info-panel");

  var history = loadHistory();
  var busy = false;

  /* ---- helpers ------------------------------------------------------------- */
  function loadHistory() {
    try { var raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function saveHistory() { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {} }
  function escapeHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function linkify(s) {
    return escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var clean = u.replace(/[.,;:)\]]+$/, ""); var trail = u.slice(clean.length);
      return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer">' + clean + '</a>' + trail;
    });
  }
  function addMsg(role, text) {
    var div = document.createElement("div");
    div.className = "hans-msg " + (role === "user" ? "hans-user" : "hans-bot");
    div.innerHTML = linkify(text);
    msgsEl.appendChild(div); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function showTyping() {
    var t = document.createElement("div"); t.className = "hans-typing"; t.id = "hans-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var t = msgsEl.querySelector("#hans-typing"); if (t) t.remove(); }
  function render() {
    msgsEl.innerHTML = "";
    addMsg("assistant", GREETING);                 // greeting is client-only, never sent to the API
    history.forEach(function (m) { addMsg(m.role, m.content); });
  }
  function open()  { panel.classList.add("hans-open");  launcher.style.display = "none"; inputEl.focus(); }
  function close() { panel.classList.remove("hans-open"); launcher.style.display = ""; }

  async function send() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = ""; inputEl.style.height = "auto";
    addMsg("user", text); history.push({ role: "user", content: text }); saveHistory();
    busy = true; sendEl.disabled = true; showTyping();
    try {
      var res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) })
      });
      var data = await res.json().catch(function () { return null; });
      hideTyping();
      var reply = (data && data.reply) ? data.reply
        : "Sorry — I had trouble answering just now. You can reach the team at connect@monderman.com.";
      addMsg("assistant", reply); history.push({ role: "assistant", content: reply }); saveHistory();
    } catch (e) {
      hideTyping();
      addMsg("assistant", "Sorry — I couldn’t reach the workspace assistant. Please try again, or email connect@monderman.com.");
    } finally { busy = false; sendEl.disabled = false; inputEl.focus(); }
  }

  /* ---- events -------------------------------------------------------------- */
  launcher.addEventListener("click", open);
  panel.querySelector("#hans-close").addEventListener("click", close);
  panel.querySelector("#hans-info-btn").addEventListener("click", function () { infoEl.classList.add("hans-show"); });
  panel.querySelector("#hans-info-done").addEventListener("click", function () { infoEl.classList.remove("hans-show"); inputEl.focus(); });
  panel.querySelector("#hans-new").addEventListener("click", function () {
    history = []; saveHistory(); render(); inputEl.focus();
  });
  sendEl.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    else if (e.key === "Escape") { if (infoEl.classList.contains("hans-show")) infoEl.classList.remove("hans-show"); else close(); }
  });
  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  render();
})();
