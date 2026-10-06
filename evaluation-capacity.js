(function (window) {
  "use strict";
  // This read is a display/preflight hint. The server's atomic admission claim
  // is authoritative; neither this script nor a URL flag can allocate a place.
  var endpoint = "https://monderman-api.onrender.com/api/billing/evaluation-capacity";
  async function check(token) {
    var headers = { "Accept": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    var controller = new window.AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await window.fetch(endpoint, {
        method: "GET", headers: headers, credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", signal: controller.signal
      });
      var result = await response.json();
      if (response.status === 401) throw new Error("sign_in_required");
      if (!response.ok || result?.ok !== true || result.version !== "organization-cap-20261005.1" || result.organizationLimit !== 10 ||
          !Number.isSafeInteger(result.allocatedOrganizations) || result.allocatedOrganizations < 0 ||
          !Number.isSafeInteger(result.activeOrganizations) || result.activeOrganizations < 0 || result.activeOrganizations > result.allocatedOrganizations ||
          result.automaticAdmissionOpen !== (result.allocatedOrganizations < result.organizationLimit) ||
          typeof result.existingAdmissionAvailable !== "boolean" || typeof result.ownerExceptionAvailable !== "boolean" ||
          (!token && (result.existingAdmissionAvailable || result.ownerExceptionAvailable))) {
        throw new Error("evaluation_capacity_unavailable");
      }
      return result;
    } finally { window.clearTimeout(timer); }
  }
  window.MondermanEvaluationCapacity = Object.freeze({ check: check });
})(window);
