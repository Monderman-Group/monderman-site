/* Future-interest intake. No account, browser persistence, POST retry or POST-host fallback. */
(function (root, factory) {
  var common = typeof module === "object" && module.exports;
  var api = factory(root, common ? require("./careers-role-data.js") : root.MondermanCareerRoles);
  if (common) module.exports = api;
  else { root.MondermanCareers = api; api.boot(); }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, data) {
  "use strict";
  var MAX_PDF = 3 * 1024 * 1024;
  var BASES = ["https://api.monderman.com", "https://monderman-api.onrender.com"];
  var ROLE_IDS = new Set(data.roles.map(function (role) { return role.id; }));
  var STATES = new Set(data.workStates.map(function (state) { return state.code; }));
  var SITE_KEY = "0x4AAAAAAC8JOwWXoDDTTFef";
  var REJECTION_STATUS = { invalid_fields:400, invalid_pdf:400, consent_required:400, request_id_conflict:409, upload_too_large:413, rate_limited:429, intake_closed:503, intake_unavailable:503, verification_unavailable:503, verification_failed:400 };
  function issue(message, field) { return { message: message, field: field }; }
  function validateFields(input) {
    var errors = [];
    if (typeof input.fullName !== "string" || !input.fullName.trim() || input.fullName.trim().length > 120) errors.push(issue("Enter your full name (up to 120 characters).", "fullName"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email || "") || input.email.length > 254) errors.push(issue("Enter a valid email address.", "email"));
    if (!STATES.has(input.workState)) errors.push(issue("Choose your U.S. state, district or territory.", "workState"));
    if (!Array.isArray(input.roleInterest) || input.roleInterest.length < 1 || input.roleInterest.length > 3 || new Set(input.roleInterest).size !== input.roleInterest.length || input.roleInterest.some(function (id) { return !ROLE_IDS.has(id); })) errors.push(issue("Choose one to three listed roles.", "roleInterest"));
    if (input.portfolioUrl) {
      try { var u = new URL(input.portfolioUrl); if (u.protocol !== "https:" || u.username || u.password || input.portfolioUrl.length > 2000) throw new Error(); }
      catch (_) { errors.push(issue("Use a complete HTTPS portfolio or profile link, or leave it blank.", "portfolioUrl")); }
    }
    if ((input.coverText || "").length > 5000) errors.push(issue("Keep your message within 5,000 characters.", "coverText"));
    if (input.privacyConsent !== true) errors.push(issue("Read the applicant privacy notice and confirm that you have read it.", "privacyConsent"));
    if (input.futureOpportunityAcknowledgement !== true) errors.push(issue("Confirm that these are future opportunities, not current vacancies.", "futureOpportunityAcknowledgement"));
    return errors;
  }
  async function validatePdf(file, required, label) {
    if (!file || file.size === 0) return required ? label + " is required as a PDF." : null;
    if (file.size > MAX_PDF) return label + " must be no larger than 3 MiB.";
    if (!/\.pdf$/i.test(file.name || "")) return label + " must be a PDF file.";
    try {
      var header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (String.fromCharCode.apply(null, header) !== "%PDF-") return label + " does not appear to be a PDF. Please choose a PDF file.";
    } catch (_) { return label + " could not be read. Please select it again."; }
    return null;
  }
  function uuid() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    if (!root.crypto || typeof root.crypto.getRandomValues !== "function") throw new Error("secure_browser_required");
    var b = root.crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.from(b, function (n) { return n.toString(16).padStart(2, "0"); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  function multipart(input, requestId, FormDataType) {
    var body = new (FormDataType || root.FormData)();
    ["fullName", "email", "workState", "portfolioUrl", "coverText", "website"].forEach(function (key) { body.set(key, input[key] || ""); });
    body.set("requestId", requestId); body.set("roleInterest", JSON.stringify(input.roleInterest));
    body.set("privacyConsent", String(input.privacyConsent)); body.set("futureOpportunityAcknowledgement", String(input.futureOpportunityAcknowledgement));
    body.set("turnstileToken", input.turnstileToken || ""); body.set("resumePDF", input.resumePDF, input.resumePDF.name);
    if (input.coverLetterPDF && input.coverLetterPDF.size) body.set("coverLetterPDF", input.coverLetterPDF, input.coverLetterPDF.name);
    return body;
  }
  function createTransport(options) {
    options = options || {};
    var fetcher = options.fetch || root.fetch.bind(root), selectedBase = "";
    var Controller = options.AbortController || root.AbortController;
    var later = options.setTimeout || root.setTimeout.bind(root), cancel = options.clearTimeout || root.clearTimeout.bind(root);
    async function jsonRequest(url, settings, timeout) {
      var controller = new Controller(), timer = later(function () { controller.abort(); }, timeout);
      try {
        var response = await fetcher(url, Object.assign({}, settings, { signal: controller.signal, credentials: "omit", redirect: "error" }));
        var result = await response.json().catch(function () { return null; });
        return { response: response, result: result };
      } finally { cancel(timer); }
    }
    return {
      loadConfig: async function () {
        for (var i = 0; i < BASES.length; i += 1) {
          try {
            var found = await jsonRequest(BASES[i] + "/api/careers/config", { method: "GET", headers: { Accept: "application/json" } }, 5000);
            if (found.response.status === 200 && found.result && found.result.ok === true && typeof found.result.intakeEnabled === "boolean") {
              selectedBase = found.result.intakeEnabled ? BASES[i] : "";
              return { intakeEnabled: found.result.intakeEnabled };
            }
          } catch (_) { /* Read-only reachability fallback is allowed before any upload. */ }
        }
        return { intakeEnabled: false };
      },
      submit: async function (body, requestId) {
        if (!selectedBase) { var closed = new Error("intake_closed"); closed.code = "intake_closed"; throw closed; }
        var packet;
        try { packet = await jsonRequest(selectedBase + "/api/careers/applications", { method: "POST", headers: { Accept: "application/json" }, body: body }, 30000); }
        catch (_) { var unknown = new Error("outcome_unknown"); unknown.code = "outcome_unknown"; unknown.requestId = requestId; throw unknown; }
        var result = packet.result;
        if (packet.response.status === 202 && result && result.ok === true && result.status === "received" && result.requestId === requestId && typeof result.applicationId === "string" && result.applicationId && typeof result.duplicate === "boolean") {
          return { applicationSaved: true, requestId: requestId, acknowledgement: ["sent", "pending", "failed", "unknown"].includes(result.acknowledgement) ? result.acknowledgement : "unknown", duplicate: result.duplicate };
        }
        var error = new Error(result && result.error || "outcome_unknown");
        error.code = result && result.ok === false && REJECTION_STATUS[result.error] === packet.response.status ? result.error : "outcome_unknown";
        error.requestId = requestId; throw error;
      }
    };
  }
  function boot() {
    if (!root.document) return;
    var form = root.document.getElementById("career-interest-form"); if (!form) return;
    var fields = root.document.getElementById("career-form-fields"), submit = root.document.getElementById("career-submit");
    var status = root.document.getElementById("career-form-status"), notice = root.document.getElementById("career-intake-notice");
    var reference = root.document.getElementById("career-request-reference"), verification = root.document.getElementById("career-verification-status");
    var checkboxes = Array.from(form.querySelectorAll('[name="roleInterest"]'));
    var state = { enabled: false, busy: false, locked: false, token: "", requestId: null, widgetId: null };
    var transport = createTransport();
    function announce(text, kind) { status.textContent = text; status.dataset.state = kind || ""; status.setAttribute("aria-live", kind === "error" || kind === "unknown" ? "assertive" : "polite"); }
    function selectedRoles() { return checkboxes.filter(function (box) { return box.checked; }).map(function (box) { return box.value; }); }
    function selectionChanged() {
      var count = selectedRoles().length;
      root.document.getElementById("career-selection-count").textContent = count + " of 3 roles selected";
      checkboxes.forEach(function (box) { box.disabled = state.locked || (!box.checked && count >= 3); });
    }
    checkboxes.forEach(function (box) { box.addEventListener("change", selectionChanged); });
    var filterControls = root.document.querySelector(".career-filters"); filterControls.hidden = false;
    filterControls.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-filter]"); if (!button) return;
      var group = button.dataset.filter, count = 0;
      root.document.querySelectorAll(".career-group").forEach(function (section) { section.hidden = group !== "all" && section.dataset.roleGroup !== group; if (!section.hidden) count += section.querySelectorAll(".career-role").length; });
      filterControls.querySelectorAll("button").forEach(function (control) { control.setAttribute("aria-pressed", String(control === button)); });
      root.document.getElementById("career-filter-status").textContent = count + " potential positions shown. None are current vacancies.";
    });
    root.document.querySelectorAll("[data-select-role]").forEach(function (link) {
      link.addEventListener("click", function () {
        if (!state.enabled) return;
        var box = checkboxes.find(function (item) { return item.value === link.dataset.selectRole; });
        if (box && (box.checked || selectedRoles().length < 3)) { box.checked = true; selectionChanged(); }
        else announce("You already selected three roles. Remove one before adding another.", "error");
      });
    });
    function renderVerification() {
      if (!state.enabled || !root.turnstile || state.widgetId !== null) return;
      try {
        state.widgetId = root.turnstile.render("#career-turnstile", { sitekey: SITE_KEY, action: "careers", theme: "light", callback: function (token) { state.token = token; submit.disabled = state.busy || state.locked; verification.textContent = "Human verification complete."; }, "expired-callback": function () { state.token = ""; submit.disabled = true; verification.textContent = "Verification expired. Please complete it again."; }, "error-callback": function () { state.token = ""; submit.disabled = true; verification.textContent = "Human verification is unavailable. Please try the check again or contact Jason."; } });
      } catch (_) { verification.textContent = "Human verification could not start. Please contact Jason for another way to share your interest."; }
    }
    root.mondermanCareersTurnstileReady = renderVerification;
    async function enableIfOpen() {
      try {
        var config = await transport.loadConfig();
        if (!config.intakeEnabled) return;
        uuid(); // A genuine secure UUID source is required before enabling uploads.
        state.enabled = true; fields.disabled = false; submit.disabled = true;
        notice.textContent = "The future-interest pool is open. These are not current vacancies. Required fields are marked with an asterisk.";
        verification.textContent = "Complete the human verification before submitting.";
        if (root.turnstile) renderVerification();
        else {
          var script = root.document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mondermanCareersTurnstileReady&render=explicit"; script.defer = true;
          script.onerror = function () { verification.textContent = "Human verification did not load. Please contact Jason for another way to share your interest."; };
          root.document.head.appendChild(script);
        }
      } catch (_) { notice.textContent = "The future-interest form is unavailable. You can explore the roles or contact Jason."; }
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.enabled || state.busy || state.locked) return;
      state.busy = true; submit.disabled = true;
      var input = { fullName: form.elements.fullName.value.trim(), email: form.elements.email.value.trim(), workState: form.elements.workState.value, roleInterest: selectedRoles(), portfolioUrl: form.elements.portfolioUrl.value.trim(), coverText: form.elements.coverText.value.trim(), website: form.elements.website.value, privacyConsent: form.elements.privacyConsent.checked, futureOpportunityAcknowledgement: form.elements.futureOpportunityAcknowledgement.checked, resumePDF: form.elements.resumePDF.files[0], coverLetterPDF: form.elements.coverLetterPDF.files[0], turnstileToken: state.token };
      var problems = validateFields(input);
      var resumeError = await validatePdf(input.resumePDF, true, "Your résumé"), coverError = await validatePdf(input.coverLetterPDF, false, "Your cover letter");
      if (resumeError) problems.push(issue(resumeError, "resumePDF")); if (coverError) problems.push(issue(coverError, "coverLetterPDF"));
      if (!state.token) problems.push(issue("Complete the human verification before submitting.", "turnstileToken"));
      if (problems.length) { state.busy = false; submit.disabled = !state.token; announce(problems.map(function (problem) { return problem.message; }).join(" "), "error"); status.focus(); return; }
      form.setAttribute("aria-busy", "true"); state.requestId = uuid();
      reference.hidden = false; reference.textContent = "Submission reference: " + state.requestId;
      announce("Saving your future-interest details and documents. Please wait.");
      try {
        var saved = await transport.submit(multipart(input, state.requestId), state.requestId);
        state.locked = true; fields.disabled = true; form.reset();
        var mail = saved.acknowledgement === "sent" ? "A receipt email has been sent." : saved.acknowledgement === "pending" ? "The receipt email is pending; please do not resubmit." : saved.acknowledgement === "failed" ? "The receipt email could not be sent; please do not resubmit." : "We cannot confirm receipt-email delivery; please do not resubmit.";
        announce("Your future-interest details and documents have been saved. " + mail + " This is not an application for a current vacancy.", "saved"); status.focus();
      } catch (error) {
        if (error.code === "outcome_unknown") {
          state.locked = true; fields.disabled = true;
          announce("We could not confirm whether your submission was saved. Please do not submit again. Contact Jason with the reference below so it can be checked.", "unknown");
        } else {
          var messages = { invalid_fields: "Please check your details and selected roles.", invalid_pdf: "A document could not be accepted as a PDF. Please select a valid PDF.", consent_required: "Please review and confirm both acknowledgements.", request_id_conflict: "This submission reference could not be accepted. Contact Jason with the reference below.", upload_too_large: "Each PDF must be no larger than 3 MiB.", rate_limited: "The service is receiving too many requests. Please wait before submitting again.", intake_closed: "The future-interest pool is currently closed. You can contact Jason instead.", intake_unavailable: "The future-interest form is temporarily unavailable. You can contact Jason instead.", verification_unavailable: "Human verification is temporarily unavailable. Please try the check later.", verification_failed: "Human verification could not be confirmed. Please complete it again." };
          announce(messages[error.code] || "The form could not accept your submission. Please contact Jason.", "error");
          if (["intake_closed", "intake_unavailable", "request_id_conflict"].includes(error.code)) { state.locked = true; fields.disabled = true; }
        }
        state.token = "";
        if (!state.locked && root.turnstile && state.widgetId !== null) root.turnstile.reset(state.widgetId);
        status.focus();
      } finally { state.busy = false; form.removeAttribute("aria-busy"); submit.disabled = state.locked || !state.token; }
    });
    enableIfOpen();
  }
  return { validateFields: validateFields, validatePdf: validatePdf, multipart: multipart, createTransport: createTransport, boot: boot, maxPdfBytes: MAX_PDF };
});
