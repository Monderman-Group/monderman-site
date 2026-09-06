(function () {
  "use strict";
  var API = "https://monderman-api.onrender.com/api/first-run-events";
  var KEY = "monderman_first_run_journey";
  var once = Object.create(null);

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }

  function journeyId() {
    try {
      var existing = sessionStorage.getItem(KEY);
      if (existing) return existing;
      var created = newId();
      sessionStorage.setItem(KEY, created);
      return created;
    } catch (_error) {
      return newId();
    }
  }

  function cleanPath() {
    return (location.pathname || "/").slice(0, 160);
  }

  function track(eventName, detail) {
    var payload = {
      eventName: eventName,
      journeyId: journeyId(),
      pagePath: cleanPath()
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

  window.MondermanFirstRun = { track: track, trackOnce: trackOnce };
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest && event.target.closest("[data-first-run-event]");
    if (!target) return;
    track(target.getAttribute("data-first-run-event"), {
      diagnosticDepth: target.getAttribute("data-first-run-depth")
    });
  });
})();
