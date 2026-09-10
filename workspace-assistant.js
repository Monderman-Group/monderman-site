/* ============================================================================
   Monderman WORKSPACE assistant: "Hans"
   ----------------------------------------------------------------------------
   A separate, more advanced guide that lives ONLY inside the workspace. It is
   independent of the public site assistant (assistant.js): its own widget, its
   own chat history, and its own backend route (/api/workspace-assistant).

   DEPLOY: put this file at the site root and add ONE line before </body> on
   each workspace page:
       <script src="workspace-assistant.js" defer></script>

   "Hans" is only a name; the widget never presents itself as a real person.
   Your Anthropic key never touches the browser.
   ============================================================================ */
(function () {
  "use strict";
  if (window.__mondermanHansLoaded) return;
  window.__mondermanHansLoaded = true;

  var API_URL     = "https://monderman-api.onrender.com/api/workspace-assistant";
  var STORAGE_KEY = "mndHansHistory";
  var GREETING    = "I’m Hans, your AI workspace guide. I can walk you through campaigns, reviewing completed runs, Synthesis and finding saved reports. I cannot see your reports or participants’ answers. Describe the step you need help with, without pasting customer information.";
  var INFO_TEXT   = "Hans is an AI guide, not a person. Messages are sent to Anthropic for guidance about using Monderman. Hans receives the conversation and a limited page, plan and role label, not your saved results, participants’ answers or organization’s records.\n\nAsk for detailed instructions about campaigns, completed runs, Synthesis and reports. Hans does not disclose private code, scoring rules or implementation details. It can make mistakes; confirm important account or product details with the team.\n\nConversation history is kept in this browser tab, separately for your account and Workspace. New chat clears the current conversation. Signing out clears Hans history in this tab.";

  /* ---- styles (scoped under #hans-*) -------------------------------------- */
  var css = ''
    + '#hans-launcher{position:fixed;right:22px;bottom:22px;z-index:2147483000;width:60px;height:60px;border:none;border-radius:999px;background:#0C6E78;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 34px rgba(12,57,62,.30);transition:transform .18s ease,box-shadow .18s ease}'
    + '#hans-launcher::after{content:"";position:absolute;inset:3px;border-radius:999px;border:1.5px solid rgba(255,255,255,.35);pointer-events:none}'
    + '#hans-launcher:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(12,57,62,.38)}'
    + '#hans-launcher .hans-mono{font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:700;font-size:24px;line-height:1;letter-spacing:-.02em}'
    + '#hans-launcher .hans-spark{position:absolute;top:11px;right:12px;width:6px;height:6px;border-radius:999px;background:#fff;box-shadow:0 0 0 3px #0C6E78}'
    + '#hans-panel{position:fixed;right:22px;bottom:94px;z-index:2147483000;width:384px;max-width:calc(100vw - 32px);height:564px;max-height:calc(100vh - 124px);background:#fff;border:1px solid #EAE6DD;border-radius:20px;box-shadow:0 26px 64px rgba(24,25,28,.20);display:none;flex-direction:column;overflow:hidden;font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#18191C}'
    + '#hans-panel.hans-open{display:flex}'
    + '#hans-head{background:#0C6E78;color:#fff;padding:15px 16px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #0A5B63}'
    + '#hans-ava{flex:0 0 auto;width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;letter-spacing:-.01em}'
    + '#hans-head .hans-id{flex:1;min-width:0}'
    + '#hans-head .hans-title{font-size:15px;font-weight:600;letter-spacing:-.01em}'
    + '#hans-head .hans-sub{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:3px}'
    + '#hans-head .hans-actions{display:flex;align-items:center;gap:8px}'
    + '.hans-icon-btn{background:transparent;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.9);width:28px;height:28px;border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit;font-size:13px;transition:background .15s,border-color .15s,color .15s}'
    + '.hans-icon-btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.55);color:#fff}'
    + '#hans-info-btn{font-style:italic;font-weight:600;font-family:"Spectral",Georgia,"Times New Roman",serif}'
    + '#hans-new{background:transparent;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.9);font:inherit;font-size:11.5px;font-weight:500;padding:5px 10px;border-radius:7px;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s}'
    + '#hans-new:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.55);color:#fff}'
    + '#hans-close{background:transparent;border:none;color:rgba(255,255,255,.75);font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    + '#hans-close:hover{color:#fff}'
    + '#hans-body{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}'
    + '#hans-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#FAF8F3}'
    + '.hans-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}'
    + '.hans-bot{align-self:flex-start;background:#fff;border:1px solid #EAE6DD;color:#18191C}'
    + '.hans-user{align-self:flex-end;background:#0C6E78;color:#fff}'
    + '.hans-msg a{text-decoration:underline}.hans-bot a{color:#0A5B63}.hans-user a{color:#fff}'
    + '.hans-typing{align-self:flex-start;display:flex;gap:4px;padding:14px}'
    + '.hans-typing span{width:7px;height:7px;border-radius:999px;background:#B8B4AC;animation:hansBlink 1.2s infinite}'
    + '.hans-typing span:nth-child(2){animation-delay:.2s}.hans-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes hansBlink{0%,80%,100%{opacity:.3}40%{opacity:1}}'
    + '#hans-foot{border-top:1px solid #EAE6DD;padding:12px;display:flex;gap:8px;align-items:flex-end;background:#fff}'
    + '#hans-input{flex:1;resize:none;border:1px solid #E0DCD2;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;color:#18191C;max-height:120px;line-height:1.5}'
    + '#hans-input:focus{outline:none;border-color:#0C6E78;box-shadow:0 0 0 3px rgba(12,110,120,.14)}'
    + '#hans-send{flex:0 0 auto;border:none;border-radius:7px;background:#0C6E78;color:#fff;font:inherit;font-size:14px;font-weight:500;padding:11px 16px;cursor:pointer}'
    + '#hans-send:hover{background:#0A5B63}#hans-send:disabled{opacity:.5;cursor:not-allowed}'
    + '#hans-info-panel{position:absolute;inset:0;background:#fff;display:none;flex-direction:column;padding:22px 22px 20px;overflow-y:auto}'
    + '#hans-info-panel.hans-show{display:flex}'
    + '#hans-info-panel .hans-info-h{display:flex;align-items:center;gap:11px;margin-bottom:14px}'
    + '#hans-info-panel .hans-info-h .hans-info-ava{width:34px;height:34px;border-radius:999px;background:#0C6E78;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px}'
    + '#hans-info-panel .hans-info-h b{font-size:15px;font-weight:600}'
    + '#hans-info-panel p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#4B4D52;white-space:pre-wrap}'
    + '#hans-info-done{align-self:flex-start;margin-top:6px;border:none;border-radius:7px;background:#0C6E78;color:#fff;font:inherit;font-size:13px;font-weight:500;padding:9px 18px;cursor:pointer}'
    + '#hans-info-done:hover{background:#0A5B63}'
    + '#hans-panel,#hans-panel *{box-sizing:border-box}#hans-panel{font-family:"Neue Haas Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif}#hans-head,#hans-foot{flex-shrink:0}#hans-head{flex-wrap:wrap}#hans-head .hans-actions{margin-left:auto}'
    + '#hans-msgs{min-height:0;min-width:0}.hans-msg{flex-shrink:0;min-width:0;overflow-wrap:anywhere}#hans-input{min-width:0;min-height:44px;width:0;font-size:16px}#hans-send,#hans-close,#hans-new,#hans-info-btn,#hans-info-done{min-height:44px}#hans-close,#hans-info-btn{min-width:44px}'
    + '#hans-notice,#hans-status{flex-shrink:0;margin:0;padding:8px 12px;font-size:12px;line-height:1.45;color:#4B4D52;background:#fff;overflow-wrap:anywhere}#hans-notice a{color:#0A5B63;text-decoration:underline}#hans-status:empty{display:none}#hans-status{color:#8B3434}'
    + '#hans-panel button:focus-visible,#hans-panel a:focus-visible{outline:3px solid #83BAC0;outline-offset:2px}'
    + '@media(prefers-reduced-motion:reduce){.hans-typing span{animation:none}#hans-launcher{transition:none}}'
    + '@media (max-width:480px){#hans-panel{right:0;bottom:0;width:100%;max-width:100%;height:88vh;height:88dvh;max-height:88vh;max-height:88dvh;border-radius:18px 18px 0 0}#hans-foot{padding-bottom:max(12px,env(safe-area-inset-bottom))}#hans-launcher{right:16px;bottom:16px}}';

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---- DOM ----------------------------------------------------------------- */
  var launcher = document.createElement("button");
  launcher.id = "hans-launcher";
  launcher.setAttribute("aria-label", "Open Hans, the workspace guide");
  launcher.setAttribute("aria-controls", "hans-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = '<span class="hans-mono">H</span><span class="hans-spark"></span>';

  var panel = document.createElement("div");
  panel.id = "hans-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Hans: workspace guide");
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
    +   '<div id="hans-msgs" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div>'
    +   '<p id="hans-notice">AI guidance by Anthropic. Do not paste personal, confidential, classified or controlled information. <a href="privacy.html">Privacy</a></p>'
    +   '<p id="hans-status" role="status" aria-live="polite"></p>'
    +   '<div id="hans-foot"><textarea id="hans-input" rows="1" maxlength="2000" aria-describedby="hans-notice hans-status" placeholder="Ask Hans about the workspace…" aria-label="Type your question"></textarea><button id="hans-send">Send</button></div>'
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
  var statusEl = panel.querySelector("#hans-status");

  var history = [];
  var busy = false;
  var authClientPromise = null;
  var currentUserId = null;
  var currentScope = null;
  var requestVersion = 0;
  var activeRequest = null;

  function authClient() {
    if (!authClientPromise) {
      authClientPromise = Promise.resolve(window.mondermanWorkspaceAccessReady).then(function (access) {
        if (!access || !access.allowed) throw new Error("workspace_access_not_allowed");
        return window.mondermanGetSupabaseClient();
      }).then(function (client) {
        client.auth.onAuthStateChange(function (_event, session) {
          // Synchronous callback: do not re-enter Supabase Auth from its lock.
          acceptSession(session);
        });
        return client;
      });
    }
    return authClientPromise;
  }
  async function currentSession() {
    var client = await authClient();
    var result = await client.auth.getSession();
    var session = result && !result.error && result.data && result.data.session;
    acceptSession(session);
    return session;
  }
  function clearSavedHistory(retainUserId) {
    try {
      Object.keys(sessionStorage).forEach(function (key) {
        if ((key === STORAGE_KEY || key.indexOf(STORAGE_KEY + ":") === 0) &&
            (!retainUserId || key.indexOf(STORAGE_KEY + ":v2:" + retainUserId + ":") !== 0)) sessionStorage.removeItem(key);
      });
    } catch (_error) {}
  }
  function acceptSession(session) {
    var nextUserId = session && session.user && session.user.id || null;
    if (!nextUserId) clearSavedHistory();
    if (nextUserId !== currentUserId) {
      clearSavedHistory(currentUserId ? null : nextUserId);
      currentUserId = nextUserId;
    }
    refreshScope();
  }
  function refreshScope() {
    var next = workspaceStorageKey();
    if (next !== currentScope) {
      currentScope = next;
      cancelPending();
      history = loadHistory();
      inputEl.value = ""; statusEl.textContent = next ? "" : "Sign in to your Workspace to use Hans.";
      render();
    }
    return currentScope;
  }
  function workspaceStorageKey() {
    var organizationId = window.__mondermanActiveOrganizationId;
    return currentUserId && organizationId ? STORAGE_KEY + ":v2:" + currentUserId + ":" + organizationId : null;
  }
  function cancelPending() {
    requestVersion += 1;
    if (activeRequest) activeRequest.abort();
    activeRequest = null; busy = false; sendEl.disabled = false; inputEl.readOnly = false;
  }

  // Customer-safe UI context only. No result data, diagnostic inputs, org data,
  // participant data, or hidden implementation details are sent to Hans.
  function workspaceContext() {
    var pageMap = {
      "workspace.html": "overview",
      "workspace-diagnostics.html": "measure",
      "workspace-analysis.html": "analysis",
      "workspace-actions.html": "action_plans",
      "workspace-settings.html": "settings"
    };
    var file = (location.pathname.split("/").pop() || "workspace.html").toLowerCase();
    var planEl = document.getElementById("ws5Plan");
    var roleEl = document.getElementById("ws5UserRole");
    return {
      page: pageMap[file] || null,
      plan: approvedLabel(planEl, ["trial", "signal", "pattern", "enterprise"]),
      role: approvedLabel(roleEl, ["admin", "analyst", "member"])
    };
  }
  function approvedLabel(element, allowed) {
    var value = element ? String(element.textContent || "").trim().toLowerCase() : "";
    return allowed.includes(value) ? value : null;
  }

  /* ---- helpers ------------------------------------------------------------- */
  function loadHistory() {
    try { var raw = currentScope && sessionStorage.getItem(currentScope); return cleanHistory(raw ? JSON.parse(raw) : []); }
    catch (e) { return []; }
  }
  function saveHistory() { try { if (currentScope) sessionStorage.setItem(currentScope, JSON.stringify(history)); } catch (e) {} }
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
  function escapeHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function linkify(s) {
    return escapeHtml(s).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var clean = u.replace(/[.,;:)\]]+$/, ""); var trail = u.slice(clean.length);
      try {
        var url = new URL(clean.replace(/&amp;/g, "&"));
        if (url.protocol !== "https:" || !["www.monderman.com", "monderman.com"].includes(url.hostname) || url.username || url.password || url.port) return u;
      } catch (_error) { return u; }
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
    t.setAttribute("role", "status");
    t.setAttribute("aria-label", "Hans is replying");
    t.innerHTML = "<span></span><span></span><span></span>";
    msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var t = msgsEl.querySelector("#hans-typing"); if (t) t.remove(); }
  function render() {
    msgsEl.innerHTML = "";
    addMsg("assistant", GREETING);                 // greeting is client-only, never sent to the API
    history.forEach(function (m) { addMsg(m.role, m.content); });
  }
  function open()  {
    refreshScope(); panel.classList.add("hans-open"); launcher.setAttribute("aria-expanded", "true"); launcher.style.display = "none"; inputEl.focus();
    currentSession().catch(function () { statusEl.textContent = "Sign in to your Workspace to use Hans."; });
  }
  function close() { panel.classList.remove("hans-open"); launcher.setAttribute("aria-expanded", "false"); launcher.style.display = ""; launcher.focus(); }

  async function send() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    if (text.length > 2000) { statusEl.textContent = "Please shorten your question to 2,000 characters or fewer."; return; }
    var scope = currentScope;
    if (!scope || refreshScope() !== scope) { statusEl.textContent = "Your account or Workspace changed. Please enter your question again."; return; }
    statusEl.textContent = "";
    var version = ++requestVersion;
    var controller = new AbortController(); activeRequest = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 45000);
    inputEl.value = ""; inputEl.style.height = "auto";
    addMsg("user", text);
    busy = true; sendEl.disabled = true; inputEl.readOnly = true; showTyping();
    try {
      var session = await currentSession();
      if (version !== requestVersion || refreshScope() !== scope) return;
      var token = session && session.access_token;
      if (!token) throw new Error("sign_in_required");
      var res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "X-Monderman-Organization-Id": window.__mondermanActiveOrganizationId },
        body: JSON.stringify({ messages: requestMessages(text), context: workspaceContext() })
      });
      var data = await res.json().catch(function () { return null; });
      if (version !== requestVersion || refreshScope() !== scope) return;
      if (!res.ok) { var failure = new Error("request_failed"); failure.status = res.status; throw failure; }
      if (data && data.source === "fallback") throw new Error("assistant_unavailable");
      if (!data || typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > 8000) throw new Error("invalid_reply");
      hideTyping();
      var reply = data.reply;
      addMsg("assistant", reply);
      if (data.source !== "policy") {
        history = cleanHistory(history.concat({ role: "user", content: text }, { role: "assistant", content: reply })); saveHistory();
      }
    } catch (e) {
      if (version !== requestVersion || refreshScope() !== scope) return;
      render(); inputEl.value = text;
      statusEl.textContent = e.status === 428 ? "Please review the current Privacy Notice before using Hans. Your question is still here; it has not been added to the conversation. "
        : e.status === 401 || e.status === 403 || e.message === "sign_in_required" ? "Hans could not verify your Workspace access. Sign in again before retrying."
        : e.status === 429 ? "Hans is busy. Wait a moment, then select Send to try again. Your question has not been added to the conversation."
        : "Hans could not reply. Your question is still here. Select Send to try again, or email connect@monderman.com.";
      if (e.status === 428) {
        var reviewLink = document.createElement("a");
        reviewLink.href = "signin.html?next=workspace-diagnostics.html";
        reviewLink.textContent = "Sign in and review";
        statusEl.appendChild(reviewLink);
      }
    } finally {
      clearTimeout(timeout);
      if (version === requestVersion) {
        activeRequest = null; busy = false; sendEl.disabled = false; inputEl.readOnly = false;
        if (panel.classList.contains("hans-open")) inputEl.focus();
      }
    }
  }

  /* ---- events -------------------------------------------------------------- */
  launcher.addEventListener("click", open);
  panel.querySelector("#hans-close").addEventListener("click", close);
  panel.querySelector("#hans-info-btn").addEventListener("click", function () {
    infoEl.classList.add("hans-show");
    [msgsEl, inputEl.parentElement, statusEl, panel.querySelector("#hans-notice")].forEach(function (element) { element.inert = true; });
    panel.querySelector("#hans-info-done").focus();
  });
  function closeInfo() {
    infoEl.classList.remove("hans-show");
    [msgsEl, inputEl.parentElement, statusEl, panel.querySelector("#hans-notice")].forEach(function (element) { element.inert = false; });
    panel.querySelector("#hans-info-btn").focus();
  }
  panel.querySelector("#hans-info-done").addEventListener("click", closeInfo);
  panel.querySelector("#hans-new").addEventListener("click", function () {
    cancelPending(); history = []; inputEl.value = ""; statusEl.textContent = ""; saveHistory(); render(); inputEl.focus();
  });
  sendEl.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); if (infoEl.classList.contains("hans-show")) closeInfo(); else close(); }
  });
  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  // Scope changes cancel in-flight replies before any history can cross accounts
  // or Workspaces. The API still independently authenticates every request.
  window.addEventListener("focus", refreshScope);
  window.addEventListener("pageshow", refreshScope);
  setInterval(refreshScope, 500);
  currentSession().then(render).catch(render);
})();
