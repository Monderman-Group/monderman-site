/*
  assignment-mode.js - Monderman directed (campaign) mode.

  One small library, included by all four diagnostic pages. It handles
  everything page-agnostic about a campaign run:
 - detect ?assignment_token in the URL
 - resolve it to the admin-locked config (tool, vantage, depth, visibility)
 - show a "assigned by your organization" banner
 - lock the vantage so the taker cannot change it
 - confirm that authoritative finalize persisted and closed the assignment
 - gate the individual output on show_results_to_assignee
 - render invalid / already-done / recorded screens as a clean overlay

  Each page wires three tiny hooks (see operational-systems.html):
    1. <script src="assignment-mode.js"></script>  (before the page's app script)
    2. an init block that, when active(), presets state.mode/state.depth and jumps
       to the right stage
    3. a finalize hook that calls complete() and, if output is hidden,
       renderCompletion() instead of the report.

  The participant has no account; the token is the capability and every call
  hits the public Express endpoints, which use the service role.
*/
(function () {
  "use strict";

  var API_BASE =
    (typeof window !== "undefined" && window.MONDERMAN_API_BASE) ||
    "https://monderman-api.onrender.com";

  var LENS_LABEL = {
    operational: "Operational",
    managerial: "Managerial",
    executive: "Senior leaders"
  };

  var INK = "#0F1720",
    ACCENT = "#3F6EA1",
    PAPER = "#F4F6F8",
    TEXT = "#15202B",
    MUTED = "#6B7785";

  var _token = null;
  var _config = null; // resolved assignment config
  var _state = "idle"; // idle | active | invalid | completed

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function injectStyleOnce() {
    if (document.getElementById("ma-style")) return;
    var s = document.createElement("style");
    s.id = "ma-style";
    s.textContent =
      ".ma-banner,.ma-privacy{font-family:'Neue Haas Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;" +
      "background:" + INK + ";color:#fff;padding:16px 26px;display:flex;align-items:center;gap:14px;" +
      "font-size:16px;line-height:1.45;flex-wrap:wrap;border-bottom:3px solid " + ACCENT + ";" +
      "box-shadow:0 2px 10px rgba(15,23,32,.18);position:sticky;top:0;z-index:1200;}" +
      // Sits directly under the assigned banner, before the first question, so a
      // recipient knows what is and is not attached to their answers before they
      // start rather than afterwards.
      ".ma-privacy{background:#FAFAF8;border-bottom:1px solid rgba(24,25,28,.12);" +
      "padding:14px 26px;font-size:15px;line-height:1.55;color:#18191C;}" +
      ".ma-privacy b{font-weight:600}" +
      ".ma-privacy .ma-pl{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;" +
      "color:#5B6068;margin-bottom:4px}" +
      ".ma-banner b{font-weight:600;}" +
      ".ma-banner .ma-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;" +
      "color:rgba(255,255,255,.55);}" +
      ".ma-banner .ma-dot{width:9px;height:9px;border-radius:50%;background:" + ACCENT + ";flex:0 0 9px;}" +
      ".ma-banner .ma-sep{color:rgba(255,255,255,.32);padding:0 2px;}" +
      ".ma-banner .ma-tag{margin-left:auto;background:rgba(63,110,161,.22);color:#fff;font-size:13px;" +
      "font-weight:500;padding:5px 13px;border-radius:999px;white-space:nowrap;}" +
      ".ma-overlay{position:fixed;inset:0;z-index:9999;background:" + PAPER + ";display:flex;" +
      "align-items:center;justify-content:center;padding:24px;" +
      "font-family:'Neue Haas Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;}" +
      ".ma-card{max-width:440px;text-align:center;background:#fff;border:1px solid rgba(21,32,43,.09);" +
      "border-radius:16px;padding:40px 36px;box-shadow:0 1px 2px rgba(15,23,32,.04),0 18px 40px rgba(15,23,32,.07);}" +
      ".ma-card .ma-mark{width:44px;height:44px;border-radius:10px;background:" + INK + ";color:#fff;" +
      "display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:22px;}" +
      ".ma-card h2{margin:0 0 10px;font-size:21px;letter-spacing:-.02em;color:" + TEXT + ";}" +
      ".ma-card p{margin:0;font-size:14.5px;line-height:1.6;color:" + MUTED + ";}";
    document.head.appendChild(s);
  }

  function overlay(iconChar, title, body) {
    injectStyleOnce();
    var prior = document.getElementById("ma-overlay");
    if (prior) prior.remove();
    var wrap = document.createElement("div");
    wrap.className = "ma-overlay";
    wrap.id = "ma-overlay";
    wrap.innerHTML =
      '<div class="ma-card"><div class="ma-mark">' + iconChar + "</div>" +
      "<h2>" + title + "</h2><p>" + body + "</p></div>";
    document.body.appendChild(wrap);
  }

  var MondermanAssignment = {
    // 1 · is there a token in the URL? returns it or null (and stashes it)
    detect: function () {
      _token = qs("assignment_token");
      return _token || null;
    },

    // 2 · resolve the token to its locked config. Returns config or null.
    resolve: function (token) {
      _token = token || _token;
      return fetch(API_BASE + "/api/assignments/resolve/" + encodeURIComponent(_token))
        .then(function (r) {
          return r.json().catch(function () {
            return null;
          });
        })
        .then(function (data) {
          if (!data || !data.ok || !data.assignment) {
            _state = "invalid";
            return null;
          }
          _config = data.assignment;
          _state = data.already_completed ? "completed" : "active";
          return _config;
        })
        .catch(function () {
          _state = "invalid";
          return null;
        });
    },

    active: function () {
      return _state === "active" && !!_config;
    },
    config: function () {
      return _config;
    },
    token: function () {
      return _token;
    },
    showsResults: function () {
      return !_config || _config.show_results_to_assignee !== false;
    },

    // banner: prepend a strip signalling the run is organization-assigned

    // What the recipient is told about attribution. Both branches are stated
    // explicitly: saying nothing on a named run would let silence imply
    // anonymity. The anonymous wording is deliberately narrow, because business
    // unit is still shown and in a small unit that can narrow down who answered.
    // Promising more than this would be misleading.
    privacyNotice: function (cfg) {
      cfg = cfg || _config;
      if (!cfg || document.getElementById("ma-privacy")) return;
      injectStyleOnce();
      var box = document.createElement("div");
      box.className = "ma-privacy";
      box.id = "ma-privacy";
      if (cfg.is_anonymous_response) {
        box.innerHTML =
          "<span class='ma-pl'>Anonymous run</span>" +
          "<b>Your name is not attached to these answers.</b> Your organization sees this " +
          "response as a pseudonym, with the date you answered rather than the time. It does " +
          "see which business unit the response came from, because that is what this " +
          "diagnostic measures. In a small unit, that could narrow down who answered." +
          "<br><br>You will see your results when you finish. They cannot be reopened " +
          "afterwards, because nothing links this response back to you.";
      } else {
        box.innerHTML =
          "<span class='ma-pl'>Attributed run</span>" +
          "<b>Your name is attached to these answers.</b> Your organization sees who answered, " +
          "along with your business unit and when you completed it.";
      }
      var banner = document.getElementById("ma-banner");
      if (banner && banner.parentNode) banner.parentNode.insertBefore(box, banner.nextSibling);
      else document.body.insertBefore(box, document.body.firstChild);
    },

    banner: function (cfg) {
      cfg = cfg || _config;
      if (!cfg || document.getElementById("ma-banner")) return;
      injectStyleOnce();
      var bar = document.createElement("div");
      bar.className = "ma-banner";
      bar.id = "ma-banner";
      var lens = LENS_LABEL[cfg.participant_lens] || cfg.participant_lens || "";
      bar.innerHTML =
        "<span class='ma-dot'></span>" +
        "<span class='ma-eyebrow'>Assigned</span>" +
        "<span>by your organization" +
        (cfg.event_path_name ? "<span class='ma-sep'>&middot;</span><b>" + escapeHtml(cfg.event_path_name) + "</b>" : "") +
        "</span>" +
        (lens ? "<span class='ma-tag'>" + escapeHtml(lens) + " perspective</span>" : "");
      document.body.insertBefore(bar, document.body.firstChild);
      this.privacyNotice(cfg);

      // The static hero-step label invites a perspective/depth choice the taker
      // doesn't get in directed mode. Rewrite it to reflect the locked setup.
      var heroStep = document.querySelector(".hero-step span:last-child");
      if (heroStep) {
        var depthTxt = cfg.depth_choice
          ? "you choose the run length"
          : (cfg.depth ? "about " + cfg.depth + " minutes" : "set run length");
        // How they answer is admin-settable too. When it is locked, say so - 
        // otherwise a recipient handed an interview-only run has no idea until
        // the first question appears.
        var modeTxt = cfg.response_mode === "interview" ? "interview"
          : cfg.response_mode === "form" ? "guided form"
          : "";
        heroStep.textContent =
          (lens ? lens + " perspective" : "Assigned diagnostic") + " · " + depthTxt +
          (modeTxt ? " · " + modeTxt : "");
      }
      return;
    },

    // lock: disable the back-jumps to the vantage/depth chooser so the taker
    // cannot change the admin-set lens (works off the shared calibration markup)
    lock: function () {
      var jumps = document.querySelectorAll(
        '[data-cal-jump="laneStage"],[data-intake-back="laneStage"]'
      );
      jumps.forEach(function (el) {
        el.style.pointerEvents = "none";
        el.style.opacity = "0.45";
        el.setAttribute("aria-disabled", "true");
      });
    },

    // 3 · confirm the finished run is persisted and the assignment closed.
    // Resolves with a real outcome: { ok: true } only when the server confirmed persistence
    // (an already-completed answer counts - the run is safely recorded).
    // Anything else resolves { ok: false, error } so the page never tells the
    // taker their perspective was recorded when it wasn't.
    // Read-only token accessor (8 Aug 2026): the premium-pass save-back needs
    // the assignment token to authorize patching the run it just completed.
    token: function () { return _token || null; },

    complete: function (runId) {
      // 8 Aug 2026: runId is optional. An anonymous assignment deliberately
      // returns no run id from finalize (the run-to-assignment link is what
      // anonymity severs), so requiring one here sent every anonymous
      // recipient to the failure screen after a successful save. The server
      // confirms persistence from the assignment's own completed state; when
      // a runId is held it is still sent so non-anonymous mismatches 409.
      if (!_token) return Promise.resolve({ ok: false, error: "missing_token" });
      return fetch(API_BASE + "/api/assignments/complete/" + encodeURIComponent(_token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runId ? { runId: runId } : {})
      })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (body) {
            if (body && (body.ok === true || body.already_completed === true)) {
              return { ok: true, alreadyCompleted: body.already_completed === true, runId: body.run_id || null };
            }
            var reason = (body && (body.error || body.message)) || ("HTTP " + r.status);
            console.warn("assignment complete not confirmed:", reason);
            return { ok: false, error: reason };
          });
        })
        .catch(function (e) {
          console.warn("assignment complete failed:", e && e.message);
          return { ok: false, error: (e && e.message) || "network_error" };
        });
    },

    renderCompletion: function () {
      overlay(
        "&#10003;",
        "Thank you &mdash; your perspective is recorded",
        "Your responses have been submitted to your organization. Readings like yours are combined into a single, measured view of how the work actually runs &mdash; one that informs where attention and effort go next. Your part is complete; you can close this window."
      );
    },
    // Blocking variant for hidden-results runs: the honest state is "not
    // recorded", with a retry that re-posts the same finished result.
    renderCompletionFailed: function (onRetry) {
      injectStyleOnce();
      var prior = document.getElementById("ma-overlay");
      if (prior) prior.remove();
      var wrap = document.createElement("div");
      wrap.className = "ma-overlay";
      wrap.id = "ma-overlay";
      wrap.innerHTML =
        '<div class="ma-card"><div class="ma-mark">!</div>' +
        "<h2>Your responses could not be recorded</h2>" +
        "<p>Your answers are complete, but sending them to your organization failed. " +
        "Keep this window open and try again &mdash; nothing has been lost.</p>" +
        '<p style="margin-top:22px"><button id="ma-retry" style="font:inherit;font-size:14.5px;font-weight:600;' +
        "color:#fff;background:" + INK + ";border:0;border-radius:10px;padding:11px 22px;cursor:pointer\">" +
        "Try again</button></p>" +
        '<p id="ma-retry-note" style="margin-top:10px;font-size:13px;color:' + MUTED + '"></p></div>';
      document.body.appendChild(wrap);
      var btn = document.getElementById("ma-retry");
      var note = document.getElementById("ma-retry-note");
      if (btn) btn.addEventListener("click", function () {
        if (typeof onRetry !== "function") return;
        btn.disabled = true; btn.textContent = "Retrying\u2026"; if (note) note.textContent = "";
        Promise.resolve(onRetry()).then(function (okNow) {
          if (okNow) { MondermanAssignment.renderCompletion(); return; }
          btn.disabled = false; btn.textContent = "Try again";
          if (note) note.textContent = "Still couldn\u2019t record it. Check your connection and try again, or contact whoever sent you this link.";
        });
      });
    },

    // Non-blocking variant for shown-results runs: the report stays readable,
    // a strip states plainly that recording failed and offers to send again.
    noteCompletionFailure: function (onRetry) {
      injectStyleOnce();
      if (document.getElementById("ma-failbar")) return;
      var bar = document.createElement("div");
      bar.id = "ma-failbar";
      bar.style.cssText = "position:sticky;top:0;z-index:1300;background:#8C2F28;color:#fff;" +
        "font-family:'Neue Haas Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;" +
        "font-size:14.5px;line-height:1.5;padding:12px 26px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;";
      bar.innerHTML = "<span>Your results are shown below, but they could not be sent to your organization yet.</span>" +
        '<button id="ma-failbar-retry" style="font:inherit;font-weight:600;color:#8C2F28;background:#fff;border:0;' +
        'border-radius:8px;padding:7px 14px;cursor:pointer">Send again</button>' +
        '<span id="ma-failbar-note" style="opacity:.85;font-size:13px"></span>';
      document.body.insertBefore(bar, document.body.firstChild);
      var btn = document.getElementById("ma-failbar-retry");
      var note = document.getElementById("ma-failbar-note");
      if (btn) btn.addEventListener("click", function () {
        if (typeof onRetry !== "function") return;
        btn.disabled = true; btn.textContent = "Sending\u2026"; if (note) note.textContent = "";
        Promise.resolve(onRetry()).then(function (okNow) {
          if (okNow) {
            bar.style.background = "#2E6B4F";
            bar.innerHTML = "<span>Recorded &mdash; your perspective has been sent to your organization.</span>";
            setTimeout(function () { try { bar.remove(); } catch (e) {} }, 4000);
            return;
          }
          btn.disabled = false; btn.textContent = "Send again";
          if (note) note.textContent = "Still not sent \u2014 check your connection and try again.";
        });
      });
    },

    renderInvalid: function () {
      overlay(
        "!",
        "This link isn&rsquo;t valid",
        "This assignment link is invalid or has already been used. If you believe this is a mistake, contact whoever sent it to you."
      );
    },
    renderAlreadyDone: function () {
      overlay(
        "&#10003;",
        "Already completed",
        "This diagnostic has already been completed. Thank you &mdash; there&rsquo;s nothing more to do here."
      );
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[<>&"]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
  }

  if (typeof window !== "undefined") window.MondermanAssignment = MondermanAssignment;
})();
