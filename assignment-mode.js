/*
  assignment-mode.js — Monderman directed (campaign) mode.

  One small library, included by all four diagnostic pages. It handles
  everything page-agnostic about a campaign run:
    - detect ?assignment_token in the URL
    - resolve it to the admin-locked config (tool, vantage, depth, visibility)
    - show a "assigned by your organization" banner
    - lock the vantage so the taker cannot change it
    - persist the finished run + close the assignment
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
      ".ma-banner{font-family:'Neue Haas Grotesk Display Pro','Helvetica Neue',Helvetica,Arial,sans-serif;" +
      "background:" + INK + ";color:#fff;padding:16px 26px;display:flex;align-items:center;gap:14px;" +
      "font-size:16px;line-height:1.45;flex-wrap:wrap;border-bottom:3px solid " + ACCENT + ";" +
      "box-shadow:0 2px 10px rgba(15,23,32,.18);position:sticky;top:0;z-index:1200;}" +
      ".ma-banner b{font-weight:600;}" +
      ".ma-banner .ma-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;" +
      "color:rgba(255,255,255,.55);}" +
      ".ma-banner .ma-dot{width:9px;height:9px;border-radius:50%;background:" + ACCENT + ";flex:0 0 9px;}" +
      ".ma-banner .ma-sep{color:rgba(255,255,255,.32);padding:0 2px;}" +
      ".ma-banner .ma-tag{margin-left:auto;background:rgba(63,110,161,.22);color:#fff;font-size:13px;" +
      "font-weight:500;padding:5px 13px;border-radius:999px;white-space:nowrap;}" +
      ".ma-overlay{position:fixed;inset:0;z-index:9999;background:" + PAPER + ";display:flex;" +
      "align-items:center;justify-content:center;padding:24px;" +
      "font-family:'Neue Haas Grotesk Display Pro','Helvetica Neue',Helvetica,Arial,sans-serif;}" +
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
    showsResults: function () {
      return !_config || _config.show_results_to_assignee !== false;
    },

    // banner: prepend a strip signalling the run is organization-assigned
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

      // The static hero-step label invites a perspective/depth choice the taker
      // doesn't get in directed mode. Rewrite it to reflect the locked setup.
      var heroStep = document.querySelector(".hero-step span:last-child");
      if (heroStep) {
        var depthTxt = cfg.depth_choice
          ? "you choose the run length"
          : (cfg.depth ? "about " + cfg.depth + " minutes" : "set run length");
        heroStep.textContent =
          (lens ? lens + " perspective" : "Assigned diagnostic") + " · " + depthTxt;
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

    // 3 · persist the finished run + close the assignment. Fire-and-await;
    // server is idempotent. Never blocks the taker on failure.
    complete: function (result, scoringPayload) {
      if (!_token || !result) return Promise.resolve(null);
      return fetch(API_BASE + "/api/assignments/complete/" + encodeURIComponent(_token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: result, scoringPayload: scoringPayload || {} })
      })
        .then(function (r) {
          return r.json().catch(function () {
            return null;
          });
        })
        .catch(function (e) {
          console.warn("assignment complete failed (non-blocking):", e && e.message);
          return null;
        });
    },

    renderCompletion: function () {
      overlay(
        "&#10003;",
        "Thank you &mdash; your perspective is recorded",
        "Your responses have been submitted to your organization. Readings like yours are combined into a single, measured view of how the work actually runs &mdash; one that informs where attention and effort go next. Your part is complete; you can close this window."
      );
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
