/* Organization-scoped evaluation status. No local-storage clock or ticking UI. */
(function () {
  "use strict";
  var snapshot = window.__mondermanEvaluationStatus;
  var receivedAt = performance.now();
  var timer;
  function view(status, elapsed) {
    var evaluation = status && status.evaluation;
    if (!evaluation || !["active", "expired"].includes(evaluation.status)) return null;
    var end = Date.parse(evaluation.endsAt);
    var server = Date.parse(status.serverNow);
    if (!Number.isFinite(end) || !Number.isFinite(server)) return null;
    var remaining = end - (server + Math.max(0, elapsed || 0));
    var days = evaluation.status === "expired" ? 0 : Math.max(0, Math.ceil(remaining / 86400000));
    return {
      days: days,
      expired: days === 0,
      title: days === 0 ? "Free evaluation ended" : "Free evaluation · " + days + " day" + (days === 1 ? "" : "s") + " remaining",
      detail: (days === 0 ? "Ended " : "Ends ") + new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) + " (UTC) · No automatic renewal"
    };
  }
  // Exposed only for deterministic UI tests; never grants an entitlement.
  window.mondermanEvaluationView = view;
  function render() {
    var current = view(snapshot, performance.now() - receivedAt);
    if (!current) {
      document.getElementById("workspaceEvaluationStatus")?.remove();
      window.clearTimeout(timer);
      return;
    }
    var host = document.querySelector(".ws-main, .ws5-main");
    if (!host) return; // Directed Diagnostic pages do not have a Workspace header.
    var banner = document.getElementById("workspaceEvaluationStatus");
    if (!banner) {
      var style = document.createElement("style");
      style.textContent = '.workspace-evaluation{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;padding:14px 30px;border-bottom:1px solid var(--line,#D9D5CB);background:#EDF4F4;color:#08383E;font:400 14px/1.5 "Neue Haas Grotesk",Helvetica,Arial,sans-serif}.workspace-evaluation strong{display:block;font-weight:700}.workspace-evaluation small{display:block;font-size:12px}.workspace-evaluation p{margin:0}.workspace-evaluation a{color:#0A5B63;font-weight:600;text-underline-offset:3px}.workspace-evaluation a:focus-visible{outline:2px solid currentColor;outline-offset:4px}.workspace-evaluation[data-expired="true"]{background:#F7F4EC}html[data-theme="dark"] .workspace-evaluation{background:#08383E;color:#F7F4EC}html[data-theme="dark"] .workspace-evaluation a{color:#9CC4C9}@media(max-width:600px){.workspace-evaluation{padding:12px 16px;gap:8px;font-size:13px}}';
      document.head.appendChild(style);
      banner = document.createElement("section");
      banner.id = "workspaceEvaluationStatus";
      banner.className = "workspace-evaluation";
      banner.setAttribute("aria-label", "Evaluation access");
      var text = document.createElement("div");
      text.appendChild(document.createElement("strong"));
      text.appendChild(document.createElement("small"));
      banner.appendChild(text);
      var note = document.createElement("p");
      banner.appendChild(note);
      var header = host.querySelector(":scope > header");
      if (header) header.after(banner); else host.prepend(banner);
    }
    banner.dataset.expired = String(current.expired);
    banner.querySelector("strong").textContent = current.title;
    banner.querySelector("small").textContent = current.detail;
    var note = banner.querySelector("p");
    note.replaceChildren();
    if (current.expired) {
      note.appendChild(document.createTextNode("Your saved reports remain available. "));
      var link = document.createElement("a");
      link.href = "connect.html";
      link.textContent = "Discuss continued access";
      note.appendChild(link);
    } else {
      note.textContent = "No card required. Your organization shares this end date.";
    }
    window.clearTimeout(timer);
    // Update only when the displayed day changes. Recheck on return to the tab.
    var end = Date.parse(snapshot.evaluation.endsAt);
    var now = Date.parse(snapshot.serverNow) + performance.now() - receivedAt;
    var next = Math.min(86400000, Math.max(1000, (end - now) % 86400000 + 50));
    if (!current.expired) timer = window.setTimeout(refresh, next);
  }
  async function refresh() {
    // Refresh the server clock after a sleeping device returns and at day
    // boundaries. A failed status request never revokes saved-report access.
    if (typeof window.mondermanRefreshEvaluationStatus === "function") {
      try {
        var latest = await window.mondermanRefreshEvaluationStatus(true);
        if (latest && latest.organizationId === snapshot.organizationId) {
          snapshot = latest;
          receivedAt = performance.now();
        }
      } catch (_error) {}
    }
    render();
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();
