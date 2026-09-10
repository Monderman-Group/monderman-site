(function () {
  "use strict";
  var API = "https://monderman-api.onrender.com/api/first-run-events";
  var KEY = "monderman_first_run_journey";
  var ATTRIBUTION_KEY = "monderman_first_run_attribution";
  var SOURCES = ["linkedin", "facebook", "x", "email", "referral", "direct", "unknown"];
  var EVENTS = ["primary_cta_clicked", "moment_page_viewed", "diagnostic_page_viewed", "run_length_selected", "diagnostic_started", "score_displayed", "account_unlock_requested", "executive_report_opened", "executive_report_downloaded", "pattern_pilot_requested", "pilot_waitlist_viewed", "pilot_waitlist_submitted", "technical_failure"];
  var PAGES = ["/", "/index.html", "/after-an-acquisition.html", "/pilot.html", "/why-monderman.html", "/Monderman_Platform_Brief.html", "/roi.html", "/after-a-reorganization.html", "/diagnostics.html", "/decision-velocity.html", "/new-in-the-role.html", "/transformation-behind-schedule.html"];
  var memoryJourney = "";
  var once = Object.create(null);

  function normalizeAttribution(value) {
    var source = typeof value?.acquisitionSource === "string" ? value.acquisitionSource.trim().toLowerCase() : "unknown";
    return {
      acquisitionSource: SOURCES.indexOf(source) >= 0 ? source : "unknown",
      acquisitionCampaign: value?.acquisitionCampaign === "first-dv-202609" ? "first-dv-202609" : null
    };
  }

  // First tagged touch within this tab. Never store the incoming URL, referrer,
  // arbitrary campaign text, participant data, or an authenticated identity.
  function readAttribution() {
    var saved = null;
    try { saved = normalizeAttribution(JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY))); } catch (_error) {}
    var params = new URLSearchParams(location.search);
    var incoming = normalizeAttribution({
      acquisitionSource: params.getAll("utm_source").length === 1 ? params.get("utm_source") : null,
      acquisitionCampaign: params.getAll("utm_campaign").length === 1 ? params.get("utm_campaign") : null
    });
    var selected = saved && (saved.acquisitionSource !== "unknown" || saved.acquisitionCampaign) ? saved : incoming;
    try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(selected)); } catch (_error) {}
    return selected;
  }

  var acquisition = readAttribution();

  function attribution() {
    return normalizeAttribution(acquisition);
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }

  function journeyId() {
    if (memoryJourney) return memoryJourney;
    try {
      var existing = sessionStorage.getItem(KEY);
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || "")) {
        memoryJourney = existing;
        return memoryJourney;
      }
      var created = newId();
      memoryJourney = created;
      sessionStorage.setItem(KEY, created);
      return created;
    } catch (_error) {
      memoryJourney = memoryJourney || newId();
      return memoryJourney;
    }
  }

  function cleanPath() {
    return PAGES.indexOf(location.pathname) >= 0 ? location.pathname : "/unknown";
  }

  function track(eventName, detail) {
    if (EVENTS.indexOf(eventName) < 0) return;
    var payload = {
      eventName: eventName,
      journeyId: journeyId(),
      pagePath: cleanPath(),
      acquisitionSource: acquisition.acquisitionSource,
      acquisitionCampaign: acquisition.acquisitionCampaign
    };
    var depth = detail && Number(detail.diagnosticDepth);
    if ([10, 30, 60].indexOf(depth) >= 0) payload.diagnosticDepth = depth;
    try {
      fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit"
      }).catch(function () {});
    } catch (_error) {}
  }

  function trackOnce(eventName, detail) {
    var key = eventName + ":" + (detail && detail.diagnosticDepth || "");
    if (once[key]) return;
    once[key] = true;
    track(eventName, detail);
  }

  // Carry only coarse tags to these existing destinations, including new tabs.
  // Do not put an anonymous journey identifier or form contents into a URL.
  function decorateLink(link) {
    if (!link || !link.getAttribute("href") || link.getAttribute("href").charAt(0) === "#") return;
    try {
      var url = new URL(link.getAttribute("href"), location.href);
      if (url.origin !== location.origin || ["/decision-velocity.html", "/pilot.html"].indexOf(url.pathname) < 0) return;
      // Saved-run, resumption and other functional links are not entry CTAs.
      if (Array.from(url.searchParams.keys()).some(function (key) { return ["source", "utm_source", "utm_campaign"].indexOf(key) < 0; })) return;
      if (acquisition.acquisitionSource === "unknown" && !acquisition.acquisitionCampaign) return;
      url.searchParams.set("utm_source", acquisition.acquisitionSource);
      if (acquisition.acquisitionCampaign) url.searchParams.set("utm_campaign", acquisition.acquisitionCampaign);
      else url.searchParams.delete("utm_campaign");
      link.setAttribute("href", url.pathname + url.search + url.hash);
    } catch (_error) {}
  }

  window.MondermanFirstRun = { track: track, trackOnce: trackOnce, journeyId: journeyId, attribution: attribution };
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll('a[href]').forEach(decorateLink);
  });
  ["click", "auxclick", "contextmenu"].forEach(function (type) {
    document.addEventListener(type, function (event) {
      decorateLink(event.target?.closest?.("a[href]"));
    }, true);
  });
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest && event.target.closest("[data-first-run-event]");
    if (!target) return;
    track(target.getAttribute("data-first-run-event"), {
      diagnosticDepth: target.getAttribute("data-first-run-depth")
    });
  });
})();
