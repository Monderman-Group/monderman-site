(function (window) {
  "use strict";

  var API_BASES = [
    "https://api.monderman.com",
    "https://monderman-api.onrender.com"
  ];
  var selectedBase = "";

  function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
    });
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof window.AbortController !== "function") return window.fetch(url, options);
    var controller = new window.AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    return window.fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .finally(function () { window.clearTimeout(timer); });
  }

  async function chooseBase() {
    if (selectedBase) return selectedBase;
    for (var index = 0; index < API_BASES.length; index += 1) {
      try {
        var response = await fetchWithTimeout(API_BASES[index] + "/api/health", {
          method: "GET",
          cache: "no-store",
          headers: { "Accept": "application/json" }
        }, 5000);
        if (response.ok) {
          selectedBase = API_BASES[index];
          return selectedBase;
        }
      } catch (_error) {}
    }
    throw new Error("pilot_service_unreachable");
  }

  function value(form, name) {
    var field = form.elements.namedItem(name);
    return field && typeof field.value === "string" ? field.value.trim() : "";
  }

  function sourceFromLocation() {
    var value = new URLSearchParams(window.location.search).get("source") || "pilot_page";
    return ["homepage", "decision_velocity", "pilot_page"].indexOf(value) >= 0 ? value : "other";
  }

  function journeyId() {
    if (window.MondermanFirstRun && typeof window.MondermanFirstRun.journeyId === "function") {
      return window.MondermanFirstRun.journeyId();
    }
    try { return window.sessionStorage.getItem("monderman_first_run_journey") || ""; }
    catch (_error) { return ""; }
  }

  async function submit(form) {
    var id = requestId();
    var source = sourceFromLocation();
    var payload = {
      requestId: id,
      journeyId: journeyId(),
      fullName: value(form, "fullName"),
      workEmail: value(form, "workEmail"),
      organization: value(form, "organization"),
      roleTitle: value(form, "roleTitle"),
      participantGroupSize: value(form, "participantGroupSize"),
      decisionFocus: value(form, "decisionFocus"),
      completedDecisionVelocity: Boolean(form.elements.namedItem("completedDecisionVelocity")?.checked || source === "decision_velocity"),
      privacyConsent: Boolean(form.elements.namedItem("privacyConsent")?.checked),
      website: value(form, "website"),
      source: source
    };
    var base = await chooseBase();
    var response;
    try {
      response = await fetchWithTimeout(base + "/api/pilot-waitlist", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit"
      }, 20000);
    } catch (error) {
      error.requestId = id;
      throw error;
    }
    var result = await response.json().catch(function () { return null; });
    if (!response.ok || !result || !result.ok) {
      var error = new Error(result?.message || "The application could not be submitted just now.");
      error.requestId = result?.requestId || id;
      throw error;
    }
    return result;
  }

  window.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("pilotWaitlistForm");
    var status = document.getElementById("pilotFormStatus");
    var confirmation = document.getElementById("pilotConfirmation");
    var submitButton = document.getElementById("pilotSubmit");
    var source = sourceFromLocation();
    var completed = form?.elements.namedItem("completedDecisionVelocity");
    if (completed && source === "decision_velocity") completed.checked = true;
    window.MondermanFirstRun?.trackOnce("pilot_waitlist_viewed");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      status.textContent = "";
      status.className = "pilot-form-status";
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
      try {
        await submit(form);
        window.MondermanFirstRun?.track("pilot_waitlist_submitted");
        form.hidden = true;
        confirmation.hidden = false;
        confirmation.focus();
      } catch (error) {
        status.textContent = `${error.message} You can also email connect@monderman.com. Reference: ${error.requestId || "unavailable"}`;
        status.className = "pilot-form-status is-error";
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Apply to the pilot waitlist";
      }
    });
  });
})(window);
