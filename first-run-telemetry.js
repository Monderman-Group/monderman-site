(function () {
  "use strict";
  var API = "https://monderman-api.onrender.com/api/first-run-events";
  var KEY = "monderman_first_run_journey";
  var ATTRIBUTION_KEY = "monderman_first_run_attribution";
  var CONSENT_KEY = "monderman_measurement_choice";
  var CONSENT_VERSION = "2026-09-10-v1";
  var SOURCES = ["linkedin", "facebook", "x", "email", "referral", "direct", "unknown"];
  var EVENTS = ["primary_cta_clicked", "moment_page_viewed", "diagnostic_page_viewed", "run_length_selected", "diagnostic_started", "score_displayed", "account_unlock_requested", "executive_report_opened", "executive_report_downloaded", "pattern_pilot_requested", "pilot_waitlist_viewed", "pilot_waitlist_submitted", "technical_failure"];
  var PAGES = ["/", "/index.html", "/after-an-acquisition.html", "/pilot.html", "/why-monderman.html", "/Monderman_Platform_Brief.html", "/roi.html", "/after-a-reorganization.html", "/diagnostics.html", "/decision-velocity.html", "/new-in-the-role.html", "/transformation-behind-schedule.html"];
  var memoryJourney = "";
  var once = Object.create(null);
  var enabled = false;
  // A failed local choice must not revive an older saved Allow on focus/pageshow.
  var localChoiceFailed = false;
  var acquisition = { acquisitionSource: "unknown", acquisitionCampaign: null };
  var decorated = new Map();
  var requests = new Set();
  var panel, settingsButton, status, previousFocus;

  function preference() {
    try {
      var value = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (!value || Object.keys(value).sort().join(",") !== "choice,version" || value.version !== CONSENT_VERSION || ["allow", "deny"].indexOf(value.choice) < 0) return null;
      return value.choice;
    } catch (_error) { return null; }
  }

  // The preference is the only storage read permitted before explicit consent.
  function isAllowed() {
    if (enabled && preference() !== "allow") stopMeasurement();
    return enabled;
  }

  function clearMeasurementKeys() {
    // Narrow privacy cleanup after decline/withdrawal, never a storage clear().
    [KEY, ATTRIBUTION_KEY].forEach(function (key) {
      try { sessionStorage.removeItem(key); } catch (_error) {}
    });
  }

  function stopMeasurement() {
    enabled = false;
    memoryJourney = "";
    acquisition = { acquisitionSource: "unknown", acquisitionCampaign: null };
    once = Object.create(null);
    requests.forEach(function (controller) { controller.abort(); });
    requests.clear();
    decorated.forEach(function (record, link) {
      // A later functional edit owns its URL; do not overwrite it on withdrawal.
      if (link.getAttribute("href") === record.decorated) link.setAttribute("href", record.original);
    });
    decorated.clear();
  }

  function observeCurrentPage() {
    if (location.pathname === "/decision-velocity.html") trackOnce("diagnostic_page_viewed");
    else if (location.pathname === "/pilot.html") trackOnce("pilot_waitlist_viewed");
    else if (["/new-in-the-role.html", "/after-an-acquisition.html", "/after-a-reorganization.html", "/transformation-behind-schedule.html"].indexOf(location.pathname) >= 0) trackOnce("moment_page_viewed");
  }

  function startMeasurement(fresh) {
    if (localChoiceFailed || preference() !== "allow") return false;
    if (fresh) clearMeasurementKeys();
    enabled = true;
    acquisition = readAttribution();
    if (document.readyState !== "loading") {
      document.querySelectorAll("a[href]").forEach(decorateLink);
      observeCurrentPage(); // This view is observed now, not replayed history.
    }
    return enabled;
  }

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
    try { saved = normalizeAttribution(JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY))); } catch (_error) {
      stopMeasurement();
      return { acquisitionSource: "unknown", acquisitionCampaign: null };
    }
    var params = new URLSearchParams(location.search);
    var incoming = normalizeAttribution({
      acquisitionSource: params.getAll("utm_source").length === 1 ? params.get("utm_source") : null,
      acquisitionCampaign: params.getAll("utm_campaign").length === 1 ? params.get("utm_campaign") : null
    });
    var selected = saved && (saved.acquisitionSource !== "unknown" || saved.acquisitionCampaign) ? saved : incoming;
    try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(selected)); } catch (_error) {
      stopMeasurement();
      return { acquisitionSource: "unknown", acquisitionCampaign: null };
    }
    return selected;
  }

  function attribution() {
    return isAllowed() ? normalizeAttribution(acquisition) : { acquisitionSource: "unknown", acquisitionCampaign: null };
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }

  function journeyId() {
    if (!isAllowed()) return "";
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
      stopMeasurement();
      return "";
    }
  }

  function cleanPath() {
    return PAGES.indexOf(location.pathname) >= 0 ? location.pathname : "/unknown";
  }

  function track(eventName, detail) {
    if (!isAllowed() || EVENTS.indexOf(eventName) < 0) return;
    var id = journeyId();
    if (!id || !isAllowed()) return;
    var payload = {
      eventName: eventName,
      journeyId: id,
      pagePath: cleanPath(),
      acquisitionSource: acquisition.acquisitionSource,
      acquisitionCampaign: acquisition.acquisitionCampaign,
      measurementConsentVersion: CONSENT_VERSION
    };
    var depth = detail && Number(detail.diagnosticDepth);
    if ([10, 30, 60].indexOf(depth) >= 0) payload.diagnosticDepth = depth;
    try {
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      if (controller) requests.add(controller);
      fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
        signal: controller?.signal
      }).catch(function () {}).finally(function () { if (controller) requests.delete(controller); });
    } catch (_error) { if (controller) requests.delete(controller); }
  }

  function trackOnce(eventName, detail) {
    if (!isAllowed() || EVENTS.indexOf(eventName) < 0) return;
    var key = eventName + ":" + (detail && detail.diagnosticDepth || "");
    if (once[key]) return;
    once[key] = true;
    track(eventName, detail);
  }

  // Carry only coarse tags to these existing destinations, including new tabs.
  // Do not put an anonymous journey identifier or form contents into a URL.
  function decorateLink(link) {
    if (!isAllowed()) return;
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
      var next = url.pathname + url.search + url.hash;
      var record = decorated.get(link);
      if (!record || record.decorated !== link.getAttribute("href")) record = { original: link.getAttribute("href") };
      record.decorated = next;
      decorated.set(link, record);
      link.setAttribute("href", next);
    } catch (_error) {}
  }

  function setStatus(message) {
    if (status) status.textContent = message;
    if (settingsButton) settingsButton.textContent = "Measurement choices · " + (enabled ? "on" : "off");
  }

  function closePanel() {
    if (!panel) return;
    if (panel.contains(document.activeElement)) {
      var focus = previousFocus && document.contains(previousFocus) ? previousFocus : document.querySelector("h1");
      if (focus) {
        var temporary = !focus.hasAttribute("tabindex");
        if (temporary) focus.setAttribute("tabindex", "-1");
        focus.focus({ preventScroll: !previousFocus });
        if (temporary) focus.addEventListener("blur", function () { focus.removeAttribute("tabindex"); }, { once: true });
      }
    }
    panel.hidden = true;
  }

  function choose(choice) {
    if (["allow", "deny"].indexOf(choice) < 0) return;
    stopMeasurement();
    localChoiceFailed = true;
    // Old, pre-consent visit identifiers are never reused after a new choice.
    clearMeasurementKeys();
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, choice: choice }));
      if (preference() !== choice) throw new Error("choice_not_saved");
    } catch (_error) {
      // Quota failures may still allow removal. Never retain an old Allow when
      // this narrow cleanup succeeds; if it fails, the in-tab latch stays off.
      try { localStorage.removeItem(CONSENT_KEY); } catch (_removeError) {}
      setStatus("Your choice could not be saved. Measurement remains off in this tab. You can continue using Monderman.");
      if (choice === "deny") closePanel();
      return;
    }
    localChoiceFailed = false;
    if (choice === "allow") startMeasurement(false);
    setStatus(enabled ? "Measurement is on. You can change your choice here at any time." : "Measurement is off. Your diagnostic, reports and sign-in are unaffected.");
    closePanel();
  }

  function openChoices() {
    if (!panel) return;
    previousFocus = document.activeElement;
    panel.hidden = false;
    panel.focus();
    panel.scrollIntoView({ block: "center", behavior: "auto" });
  }

  function renderChoices() {
    if (document.getElementById("mnd-measurement-panel")) return;
    var style = document.createElement("style");
    style.textContent = '#mnd-measurement-panel,#mnd-measurement-settings{box-sizing:border-box;font-family:inherit;font-size:14px;line-height:1.5;color:#08383E;background:#F6F3EC;border:1px solid #9CC4C9;border-radius:8px;padding:18px;text-align:left;letter-spacing:normal;position:relative;z-index:1;min-width:0;max-width:100%;overflow-wrap:anywhere}#mnd-measurement-panel{margin:20px 0;scroll-margin-top:100px}#mnd-measurement-panel[hidden]{display:none!important}#mnd-measurement-panel h2{font:inherit;font-weight:700;font-size:16px;line-height:1.35;letter-spacing:normal;margin:0 0 8px;color:#08383E}#mnd-measurement-panel p{font:inherit;line-height:1.5;max-width:none;margin:0 0 12px;color:#08383E}#mnd-measurement-panel a{color:#0A5B63;text-decoration:underline;text-underline-offset:3px}#mnd-measurement-panel .mnd-measurement-actions{display:flex;flex-wrap:wrap;gap:10px}#mnd-measurement-panel button,#mnd-measurement-settings button{box-sizing:border-box;font:inherit;font-weight:600;line-height:1.35;letter-spacing:normal;text-transform:none;min-height:44px;min-width:0;padding:10px 14px;background:#FFF;color:#08383E;border:1px solid #0A5B63;border-radius:4px;box-shadow:none;cursor:pointer;white-space:normal}#mnd-measurement-panel button{flex:1 1 190px}#mnd-measurement-panel button:focus-visible,#mnd-measurement-settings button:focus-visible,#mnd-measurement-panel a:focus-visible{outline:3px solid #0C6E78;outline-offset:3px}#mnd-measurement-settings{max-width:1208px;margin:24px auto;width:calc(100% - 40px)}#mnd-measurement-status{font:inherit;color:#08383E;margin:8px 0 0}#mnd-measurement-status:empty{display:none}@media(max-width:640px){#mnd-measurement-panel{padding:16px}#mnd-measurement-panel button{flex-basis:100%;width:100%}}@media print{#mnd-measurement-panel,#mnd-measurement-settings{display:none!important}}';
    // Existing hero rules use !important colors; the light choice surface must
    // keep its own readable foreground without changing any global design rule.
    style.textContent += '#mnd-measurement-panel h2,#mnd-measurement-panel p,#mnd-measurement-panel button,#mnd-measurement-settings button,#mnd-measurement-status{color:#08383E!important}#mnd-measurement-panel a{color:#0A5B63!important}';
    style.textContent += '#mnd-measurement-panel,#mnd-measurement-panel *,#mnd-measurement-settings,#mnd-measurement-settings *{opacity:1!important;animation:none!important;transform:none!important;-webkit-text-fill-color:currentColor!important}';
    document.head.append(style);
    panel = document.createElement("section");
    panel.id = "mnd-measurement-panel";
    panel.setAttribute("aria-labelledby", "mnd-measurement-title");
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML = '<h2 id="mnd-measurement-title">Optional measurement</h2><p>A random visit ID and limited campaign labels help us count steps through the free diagnostic and pilot application. Measurement events exclude diagnostic answers and contact details. If you apply, your application may include the same campaign labels. You can use Monderman without this measurement. <a href="privacy.html#optional-measurement">Privacy details</a></p><div class="mnd-measurement-actions"><button type="button" id="mnd-measurement-allow">Allow measurement</button><button type="button" id="mnd-measurement-deny">Continue without measurement</button></div>';
    var actions = document.querySelector(".hero-actions,.hero .actions");
    if (actions) actions.insertAdjacentElement("afterend", panel);
    else {
      var main = document.querySelector("main");
      (main || document.body).prepend(panel);
    }
    var settings = document.createElement("section");
    settings.id = "mnd-measurement-settings";
    settings.setAttribute("aria-label", "Optional measurement settings");
    settings.innerHTML = '<button type="button" id="mnd-measurement-settings-button">Measurement choices · off</button><p id="mnd-measurement-status" role="status" aria-live="polite"></p>';
    var footer = document.querySelector("footer.mond-footer");
    if (footer) footer.insertAdjacentElement("beforebegin", settings);
    else document.body.append(settings);
    settingsButton = settings.querySelector("button");
    // Explicit tab stops include controls in Safari's default keyboard mode.
    [settingsButton].concat(Array.from(panel.querySelectorAll("button"))).forEach(function (button) { button.setAttribute("tabindex", "0"); });
    status = settings.querySelector("p");
    settingsButton.addEventListener("click", openChoices);
    panel.querySelector("#mnd-measurement-allow").addEventListener("click", function () { choose("allow"); });
    panel.querySelector("#mnd-measurement-deny").addEventListener("click", function () { choose("deny"); });
    panel.hidden = preference() !== null;
    setStatus("");
  }

  function syncChoice() {
    if (localChoiceFailed) {
      stopMeasurement();
      setStatus("Your choice could not be saved. Measurement remains off in this tab. You can continue using Monderman.");
      return;
    }
    var choice = preference();
    if (choice !== "allow") {
      var wasEnabled = enabled;
      stopMeasurement();
      if (wasEnabled || choice === "deny") clearMeasurementKeys();
    } else if (!enabled) startMeasurement(true);
    if (panel) panel.hidden = choice !== null;
    setStatus("");
  }

  window.MondermanFirstRun = { track: track, trackOnce: trackOnce, journeyId: journeyId, attribution: attribution, isMeasurementAllowed: isAllowed, measurementConsentVersion: function () { return isAllowed() ? CONSENT_VERSION : null; }, openMeasurementChoices: openChoices };
  if (preference() === "allow") startMeasurement(false);
  document.addEventListener("DOMContentLoaded", function () {
    renderChoices();
    if (isAllowed()) {
      document.querySelectorAll('a[href]').forEach(decorateLink);
      observeCurrentPage();
    }
  });
  window.addEventListener("storage", function (event) { if (event.key === CONSENT_KEY || event.key === null) syncChoice(); });
  window.addEventListener("pageshow", syncChoice);
  window.addEventListener("focus", syncChoice);
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
