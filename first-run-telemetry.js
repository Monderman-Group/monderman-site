/* Marketing measurement is retired. Keep a no-network compatibility surface
 * for older instrument builds that still call these optional methods. */
(function () {
  "use strict";
  ["monderman_first_run_journey", "monderman_first_run_attribution"].forEach(function (key) {
    try { sessionStorage.removeItem(key); } catch (_error) {}
  });
  try { localStorage.removeItem("monderman_measurement_choice"); } catch (_error) {}
  function noOp() {}
  window.MondermanFirstRun = Object.freeze({
    track: noOp,
    trackOnce: noOp,
    journeyId: function () { return ""; },
    attribution: function () { return { acquisitionSource: "unknown", acquisitionCampaign: null }; },
    isMeasurementAllowed: function () { return false; },
    measurementConsentVersion: function () { return null; },
    openMeasurementChoices: noOp
  });
})();
