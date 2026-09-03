/* Monderman contact transport: prefer the first-party API host, retain Render
   as a reachability fallback, and never retry a POST whose outcome is unknown. */
(function (window) {
  "use strict";

  if (window.MondermanContactTransport) return;

  var API_BASES = [
    "https://api.monderman.com",
    "https://monderman-api.onrender.com"
  ];
  var selectedBase = "";
  var selectedUntil = 0;

  function makeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "contact_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof window.AbortController !== "function") return window.fetch(url, options);
    var controller = new window.AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    var requestOptions = Object.assign({}, options, { signal: controller.signal });
    return window.fetch(url, requestOptions).finally(function () { window.clearTimeout(timer); });
  }

  async function reachable(base) {
    try {
      var response = await fetchWithTimeout(base + "/api/health", {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      }, 5000);
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  async function chooseBase() {
    if (selectedBase && Date.now() < selectedUntil) return selectedBase;
    for (var index = 0; index < API_BASES.length; index += 1) {
      if (await reachable(API_BASES[index])) {
        selectedBase = API_BASES[index];
        selectedUntil = Date.now() + (5 * 60 * 1000);
        return selectedBase;
      }
    }
    throw new Error("request_service_unreachable");
  }

  async function submit(payload) {
    var requestId = makeRequestId();
    var base = await chooseBase();
    var response;
    try {
      response = await fetchWithTimeout(base + "/api/connect/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(Object.assign({}, payload, { requestId: requestId }))
      }, 20000);
    } catch (error) {
      error.requestId = requestId;
      throw error;
    }

    var result = await response.json().catch(function () { return null; });
    return { response: response, result: result, requestId: requestId };
  }

  window.MondermanContactTransport = { submit: submit };
})(window);
