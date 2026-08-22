(function () {
  "use strict";

  function isAdminRole(role) {
    return role === "admin" || role === "owner";
  }

  function countReserved(rows, nowMs) {
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      if (row.completed_at || row.status === "completed" || row.closed_at || row.send_status === "failed") return false;
      if (row.close_at && Date.parse(row.close_at) <= now) return false;
      return ["sent", "opened"].indexOf(String(row.status || "sent")) > -1;
    }).length;
  }

  function evaluate(options) {
    options = options || {};
    var organization = options.organization || {};
    if (!isAdminRole(options.role)) {
      return { allowed: false, code: "role_required", title: "Composing campaigns is an admin action", message: "Only organization owners and admins can compose and send Diagnostic campaigns." };
    }
    if (organization.campaigns_enabled !== true) {
      return { allowed: false, code: "campaigns_disabled", title: "Diagnostic campaigns are not enabled", message: "This workspace does not currently include Diagnostic campaigns. Individual Diagnostic runs remain available." };
    }
    var pool = organization.respondent_pool;
    if (pool === null || pool === undefined) {
      return { allowed: true, code: "allowed", remaining: null, anonymousAllowed: organization.anonymous_responses_enabled === true };
    }
    if (!Number.isFinite(options.reserved)) {
      return { allowed: false, code: "capacity_required", needsCapacity: true, title: "Confirming participant capacity", message: "Current participant capacity is being verified." };
    }
    var used = Number(organization.respondents_used) || 0;
    var remaining = Math.max(0, Number(pool) - used - options.reserved);
    return remaining > 0
      ? { allowed: true, code: "allowed", remaining: remaining, anonymousAllowed: organization.anonymous_responses_enabled === true }
      : { allowed: false, code: "capacity_exhausted", title: "No participant responses remain", message: "This workspace has " + used + " completed and " + options.reserved + " reserved participant responses out of " + Number(pool) + ". Close unused invitations or add capacity before composing another campaign." };
  }

  window.MondermanCampaignAccess = { evaluate: evaluate, countReserved: countReserved, isAdminRole: isAdminRole };
})();
