/*
  interview-mode.js — Monderman guided-interview surface.

  One small library, included by all four diagnostic pages, exactly like
  assignment-mode.js. It owns everything page-agnostic about running a
  diagnostic item as a conversation instead of a form control.

  TERMINOLOGY (enforced): the two ways to take a diagnostic are
      "Interview"     — conversational, this library
      "Guided form"   — the instrument's own controls
  These are diagnostics, and the deprecated questionnaire word is never used
  in copy or in identifiers. The mode tokens are "interview" | "form" |
  "choice" for the same reason.

  DESIGN CONTRACT — "interview mode is a coder, not a new diagnostic":
    The run lifecycle is untouched. This library never talks to /run/start,
    /run/:id/answer, or /finalize. It renders a conversation for ONE item,
    asks the backend to phrase it, collects free text, resolves that into
    the item's own value, then hands it to the page's existing
    submitAnswer(). Routing engine, scorers, adapters, descriptors, and
    locked facts all receive byte-identical input either way.

  TWO ITEM PATHS:
    coded   — single_select / multi_select / numeric. The reply goes to the
              backend, which returns one of the item's own option tokens (or
              a number). Never a free-form value.
    capture — questionType "text" (the experiential notes). There are no
              tokens to code against, so the reply is submitted verbatim.
              A coding round-trip here would only lose information.

  WIRING (four hooks per page, see operational-systems.html):
    1. <script src="interview-mode.js"></script>   (before the page script)
    2. MondermanInterview.init({...}) once, after the DOM exists
    3. MondermanInterview.mountToggle(container) once, into stable chrome
    4. in renderQuestion(): if (MondermanInterview.shouldHandle(item))
                              return MondermanInterview.present(item);

  MODE RESOLUTION (highest priority first):
    1. Assignment lock       — admin chose interview or form for a campaign
    2. Assignment delegation — admin left it open; participant picks
    3. URL ?mode=interview   — direct link
    4. Participant toggle    — switchable freely at any point in the run
    5. Default               — interview off (guided form)

  GRACEFUL DEGRADATION is the point of the fallback path. If the model is
  unavailable, returns an unusable token, or times out, the item is handed
  back to the page's normal control renderer. A participant is never
  trapped in a broken conversation, and an un-codable answer never reaches
  the scorer.
*/
(function () {
  "use strict";

  var API_BASE =
    (typeof window !== "undefined" && window.MONDERMAN_API_BASE) ||
    "https://monderman-api.onrender.com";

  var TURN_TIMEOUT_MS = 30000;
  var MAX_FOLLOWUPS = 2;   // backend enforces the same ceiling
  var MAX_HISTORY = 8;     // matches the backend's transcript window

  var INK = "#0F1720",
    ACCENT = "#3F6EA1",
    PAPER = "#F4F6F8",
    MUTED = "#6B7785",
    LINE = "rgba(24,25,28,.12)";

  var CODED_TYPES = ["single_select", "multi_select", "numeric"];

  var _cfg = null;          // see init()
  var _enabled = false;     // interview ON for this run
  var _locked = false;      // admin fixed the mode; hide the toggle
  var _item = null;         // item currently being interviewed
  var _history = [];        // [{q,a}] of COMPLETED items across the run
  var _itemExchanges = [];  // [{q,a}] within the current item (follow-ups)
  var _followups = 0;
  var _busy = false;
  var _degraded = false;
  var _lastQuestion = "";
  var _toggleHost = null;

  /* ── helpers ───────────────────────────────────────────────────────── */

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }

  function qs(name) {
    try { return new URLSearchParams(window.location.search).get(name); }
    catch (e) { return null; }
  }

  function isCapture(item) {
    return !!item && (item.questionType === "text" || item.isExperienceLayer === true);
  }

  function isCoded(item) {
    if (!item) return false;
    if (item.questionType === "numeric") return true;
    if (CODED_TYPES.indexOf(item.questionType) === -1) return false;
    // A select with no options cannot be coded to a token — leave it alone.
    return Array.isArray(item.options) && item.options.length > 0;
  }

  // The transcript the backend sees: completed items, then everything said
  // so far about the item being resolved. Without the second part, a
  // follow-up answer would be coded in isolation and the participant's
  // original reply would be silently discarded.
  function transcript() {
    return _history.slice(-MAX_HISTORY).concat(_itemExchanges);
  }

  async function turn(payload) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, TURN_TIMEOUT_MS);
    try {
      var res = await fetch(API_BASE + "/api/interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      var data = await res.json().catch(function () { return null; });
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "interview_turn_failed");
      return data;
    } finally { clearTimeout(timer); }
  }

  function role() {
    try { return (_cfg.getRole && _cfg.getRole()) || "senior_leader"; }
    catch (e) { return "senior_leader"; }
  }

  /* ── mode toggle (lives in stable page chrome, not the transcript) ──── */

  function mountToggle(container) {
    if (!container) return;
    _toggleHost = container;
    injectStyles();
    renderToggle();
  }

  function renderToggle() {
    if (!_toggleHost) return;
    if (_locked) { _toggleHost.innerHTML = ""; return; }
    _toggleHost.innerHTML =
      '<div class="mdn-iv-modes" role="group" aria-label="How you answer">' +
      '  <button type="button" class="mdn-iv-mode' + (_enabled ? "" : " is-on") + '" data-mode="form" aria-pressed="' + (!_enabled) + '">Guided form</button>' +
      '  <button type="button" class="mdn-iv-mode' + (_enabled ? " is-on" : "") + '" data-mode="interview" aria-pressed="' + (!!_enabled) + '">Interview</button>' +
      '</div>';
    var btns = _toggleHost.querySelectorAll(".mdn-iv-mode");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        var want = this.getAttribute("data-mode") === "interview";
        if (want === _enabled) return;
        _enabled = want;
        _itemExchanges = [];
        _followups = 0;
        renderToggle();
        // Re-render the current question in the newly chosen mode. The page's
        // renderQuestion() consults shouldHandle(), so one call switches both
        // directions without the library knowing how controls are built.
        if (_cfg && _cfg.rerender) _cfg.rerender();
      });
    }
  }

  /* ── conversation surface ──────────────────────────────────────────── */

  function surface() {
    var body = _cfg && _cfg.elements && _cfg.elements.questionBody;
    if (!body) return null;
    var existing = body.querySelector(".mdn-iv");
    if (existing) return existing;

    body.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "mdn-iv";
    wrap.innerHTML =
      '<div class="mdn-iv-log" id="mdnIvLog" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="mdn-iv-compose">' +
      '  <label class="mdn-iv-sr" for="mdnIvInput">Your answer</label>' +
      '  <textarea id="mdnIvInput" rows="3" placeholder="Answer in your own words\u2026" aria-describedby="mdnIvHint"></textarea>' +
      '  <div class="mdn-iv-row">' +
      '    <p class="mdn-iv-hint" id="mdnIvHint">A sentence or two is plenty. Ctrl+Enter sends.</p>' +
      '    <div class="mdn-iv-actions">' +
      '      <button type="button" class="mdn-iv-btn ghost" id="mdnIvSkip">Skip</button>' +
      '      <button type="button" class="mdn-iv-btn" id="mdnIvSend">Send</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    body.appendChild(wrap);
    injectStyles();

    el("mdnIvSend").addEventListener("click", onSend);
    el("mdnIvSkip").addEventListener("click", onSkip);
    el("mdnIvInput").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSend();
    });
    return wrap;
  }

  function log() { return el("mdnIvLog"); }

  function push(who, text, opts) {
    var box = log();
    if (!box) return;
    var row = document.createElement("div");
    row.className = "mdn-iv-msg mdn-iv-" + who + ((opts && opts.muted) ? " mdn-iv-muted" : "");
    row.innerHTML = "<p>" + esc(text) + "</p>";
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    return row;
  }

  function thinking(on) {
    var box = log();
    if (!box) return;
    var existing = box.querySelector(".mdn-iv-thinking");
    if (on && !existing) {
      var row = document.createElement("div");
      row.className = "mdn-iv-msg mdn-iv-ask mdn-iv-thinking";
      row.innerHTML = "<p><span></span><span></span><span></span></p>";
      box.appendChild(row);
      box.scrollTop = box.scrollHeight;
    } else if (!on && existing) { existing.remove(); }
  }

  function setBusy(on) {
    _busy = on;
    var send = el("mdnIvSend"), input = el("mdnIvInput"), skip = el("mdnIvSkip");
    if (send) { send.disabled = on; send.textContent = on ? "Sending\u2026" : "Send"; }
    if (input) input.disabled = on;
    if (skip) skip.disabled = on;
  }

  function showSkip(item) {
    var skip = el("mdnIvSkip");
    if (skip) skip.style.display = item && item.isOptional ? "inline-flex" : "none";
  }

  /* ── the turn loop ─────────────────────────────────────────────────── */

  async function present(item) {
    _item = item;
    _followups = 0;
    _itemExchanges = [];
    _degraded = false;

    var wrap = surface();
    if (!wrap) return handOffToControl();

    var box = log();
    if (box) box.innerHTML = "";
    var input = el("mdnIvInput");
    if (input) input.value = "";
    showSkip(item);

    setBusy(true);
    thinking(true);
    try {
      var res = await turn({
        tool: _cfg.tool,
        role: role(),
        item: item,
        history: transcript()
      });
      thinking(false);
      _degraded = !!res.degraded;
      push("ask", res.say);
      _lastQuestion = res.say;
    } catch (e) {
      thinking(false);
      return handOffToControl("The interview couldn't reach the assistant, so here is the standard question.");
    } finally {
      setBusy(false);
      var i = el("mdnIvInput");
      if (i && !i.disabled) i.focus();
    }
  }

  async function onSkip() {
    if (_busy || !_item || !_item.isOptional) return;
    try {
      await _cfg.submit(_item.id, "", { source: "interview", skipReason: "optional_skipped" });
    } catch (e) {
      push("ask", "That didn't save. Please try again.", { muted: true });
    }
  }

  async function onSend() {
    if (_busy || !_item) return;
    var input = el("mdnIvInput");
    var reply = String((input && input.value) || "").trim();
    if (!reply) { if (input) input.focus(); return; }

    push("reply", reply);
    if (input) input.value = "";

    // CAPTURE PATH — free-text items have no tokens to code against, so the
    // reply IS the value. Nothing is sent for coding; nothing is lost.
    if (isCapture(_item)) {
      _itemExchanges.push({ q: _lastQuestion, a: reply });
      _history = _history.concat(_itemExchanges);
      _itemExchanges = [];
      if (_history.length > 40) _history = _history.slice(-40);
      setBusy(true);
      try {
        await _cfg.submit(_item.id, reply, {
          source: "interview",
          captured_verbatim: true
        });
      } catch (e) {
        push("ask", "That didn't save. Please try answering once more.", { muted: true });
      } finally { setBusy(false); }
      return;
    }

    // CODED PATH
    setBusy(true);
    thinking(true);
    var res;
    try {
      res = await turn({
        tool: _cfg.tool,
        role: role(),
        item: _item,
        history: transcript(),
        userReply: reply,
        followupCount: _followups
      });
    } catch (e) {
      thinking(false); setBusy(false);
      return handOffToControl("The assistant didn't respond, so here is the standard question. Your answer above was not recorded.");
    }
    thinking(false);
    setBusy(false);

    if (res.action === "followup" && _followups < MAX_FOLLOWUPS) {
      _itemExchanges.push({ q: _lastQuestion, a: reply });
      _followups += 1;
      push("ask", res.say);
      _lastQuestion = res.say;
      var i2 = el("mdnIvInput");
      if (i2) i2.focus();
      return;
    }

    if (res.action === "fallback") {
      return handOffToControl(res.say || "To record this accurately, please pick the closest option.");
    }

    if (res.action === "code") {
      if (res.say) push("ask", res.say, { muted: true });
      _itemExchanges.push({ q: _lastQuestion, a: reply });
      _history = _history.concat(_itemExchanges);
      _itemExchanges = [];
      if (_history.length > 40) _history = _history.slice(-40);

      var meta = {
        source: "interview",
        confidence: res.confidence || null,
        evidence: res.evidence || null,
        followups_used: _followups,
        degraded: _degraded || undefined
      };
      try {
        await _cfg.submit(_item.id, res.value, meta);
      } catch (e) {
        push("ask", "That didn't save. Please try answering once more.", { muted: true });
      }
      return;
    }

    // Unknown action — never guess at a value.
    return handOffToControl();
  }

  // Give this item back to the page's standard control renderer. Interview
  // mode stays selected for later items; this is a per-item fallback only.
  function handOffToControl(note) {
    var body = _cfg && _cfg.elements && _cfg.elements.questionBody;
    if (!body || !_cfg.renderControl || !_item) return;
    body.innerHTML = "";
    if (note) {
      var n = document.createElement("p");
      n.className = "mdn-iv-note";
      n.textContent = note;
      body.appendChild(n);
    }
    body.appendChild(_cfg.renderControl(_item));
    if (_cfg.afterControl) _cfg.afterControl(_item);
    injectStyles();
  }

  /* ── styles ────────────────────────────────────────────────────────── */

  var _styled = false;
  function injectStyles() {
    if (_styled) return;
    _styled = true;
    var css =
      ".mdn-iv{display:flex;flex-direction:column;gap:14px}" +
      ".mdn-iv-log{display:flex;flex-direction:column;gap:10px;max-height:340px;overflow-y:auto;padding:4px 2px}" +
      ".mdn-iv-msg{max-width:88%;border-radius:14px;padding:11px 14px;font-size:.96rem;line-height:1.55}" +
      ".mdn-iv-msg p{margin:0}" +
      ".mdn-iv-ask{align-self:flex-start;background:" + PAPER + ";color:" + INK + ";border:1px solid " + LINE + "}" +
      ".mdn-iv-reply{align-self:flex-end;background:" + ACCENT + ";color:#FFF}" +
      ".mdn-iv-muted{opacity:.72;font-size:.9rem}" +
      ".mdn-iv-thinking p{display:flex;gap:5px;align-items:center;height:12px}" +
      ".mdn-iv-thinking span{width:6px;height:6px;border-radius:50%;background:" + MUTED + ";opacity:.45;animation:mdnIvBlink 1.2s infinite}" +
      ".mdn-iv-thinking span:nth-child(2){animation-delay:.2s}.mdn-iv-thinking span:nth-child(3){animation-delay:.4s}" +
      "@keyframes mdnIvBlink{0%,80%,100%{opacity:.25}40%{opacity:.9}}" +
      ".mdn-iv-compose textarea{width:100%;border:1px solid " + LINE + ";border-radius:12px;padding:12px 14px;font:inherit;font-size:.96rem;color:" + INK + ";resize:vertical;background:#FFF}" +
      ".mdn-iv-compose textarea:focus{outline:2px solid " + ACCENT + ";outline-offset:1px}" +
      ".mdn-iv-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap}" +
      ".mdn-iv-hint{margin:0;font-size:.82rem;color:" + MUTED + "}" +
      ".mdn-iv-actions{display:flex;gap:8px;align-items:center}" +
      ".mdn-iv-btn{border:1px solid " + ACCENT + ";background:" + ACCENT + ";color:#FFF;border-radius:999px;padding:8px 18px;font:inherit;font-size:.9rem;cursor:pointer}" +
      ".mdn-iv-btn:disabled{opacity:.55;cursor:default}" +
      ".mdn-iv-btn.ghost{background:transparent;color:" + MUTED + ";border-color:" + LINE + "}" +
      ".mdn-iv-note{margin:0 0 12px;font-size:.86rem;color:" + MUTED + "}" +
      ".mdn-iv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
      ".mdn-iv-modes{display:inline-flex;border:1px solid " + LINE + ";border-radius:999px;padding:3px;background:#FFF;gap:2px}" +
      ".mdn-iv-mode{border:none;background:transparent;color:" + MUTED + ";border-radius:999px;padding:6px 14px;font:inherit;font-size:.84rem;cursor:pointer}" +
      ".mdn-iv-mode.is-on{background:" + INK + ";color:#FFF}" +
      "@media (max-width:600px){.mdn-iv-msg{max-width:96%}.mdn-iv-row{align-items:flex-start}}";
    var tag = document.createElement("style");
    tag.setAttribute("data-mdn-interview", "1");
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ── public API ────────────────────────────────────────────────────── */

  var MondermanInterview = {
    // cfg: { tool, getRole(), submit(itemId,value,meta), renderControl(item),
    //        rerender(), afterControl(item)?, elements:{ questionBody } }
    init: function (cfg) {
      _cfg = cfg || null;
      var urlMode = String(qs("mode") || "").toLowerCase();
      if (urlMode === "interview") _enabled = true;
      if (urlMode === "form" || urlMode === "guided_form") _enabled = false;
      return this;
    },

    // Resolve mode from a campaign assignment: "interview" | "form" locks it,
    // "choice" (or absent) delegates to the participant.
    applyAssignment: function (assignmentCfg) {
      if (!assignmentCfg) return this;
      var mode = String(assignmentCfg.response_mode || "").toLowerCase();
      if (mode === "interview" || mode === "form") {
        _enabled = mode === "interview";
        _locked = true;
      } else {
        _locked = false;
      }
      renderToggle();
      return this;
    },

    mountToggle: mountToggle,

    active: function () { return !!(_enabled && _cfg); },
    locked: function () { return _locked; },

    setEnabled: function (on) {
      if (_locked) return this;
      _enabled = !!on;
      renderToggle();
      return this;
    },

    // True when interview mode is on AND this item can be run as a
    // conversation. The page calls this at the top of renderQuestion().
    shouldHandle: function (item) {
      if (!this.active()) return false;
      return isCoded(item) || isCapture(item);
    },

    present: present,

    reset: function () {
      _item = null;
      _history = [];
      _itemExchanges = [];
      _followups = 0;
      _lastQuestion = "";
    }
  };

  if (typeof window !== "undefined") window.MondermanInterview = MondermanInterview;
})();
