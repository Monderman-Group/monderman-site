(function () {
  "use strict";
  var escape = function (value) { return String(value ?? "").replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#39;" }[char]; }); };

  async function mount(options) {
    var host = document.getElementById("employerSalarySettings");
    if (!host || !options.organizationId) return;
    var helper = window.MondermanEmployerSalaryImport;
    var capability = null, csv = "", previewed = false, pending = false, fileRevision = 0;
    async function request(path, method, body) {
      var headers = await options.headers();
      if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
      var response = await fetch(options.apiBase + path, {
        method: method || "GET", headers: headers,
        ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {})
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.ok === false) {
        var error = new Error("Salary request could not be completed.");
        error.issues = data.invalid_rows || data.errors || [];
        throw error;
      }
      return data;
    }
    async function refresh(selectedId) {
      try { capability = await request("/api/assignments/salary-capability?organization_id=" + encodeURIComponent(options.organizationId)); }
      catch (_error) { capability = null; }
      if (!capability || capability.enabled !== true || capability.notice_version !== helper.noticeVersion || capability.currency !== "USD" || (!capability.can_upload && !capability.can_delegate)) { host.hidden = true; return; }
      render();
      if (selectedId && byId("salaryBatch")) { byId("salaryBatch").value = selectedId; renderCampaignSettings(); }
    }
    function render() {
      csv = ""; previewed = false; fileRevision++; host.hidden = false;
      var batches = Array.isArray(capability.eligible_batches) ? capability.eligible_batches : [];
      var members = (options.members || []).filter(function (member) { return member.role === "analyst" && !member.billing_suspended_role && member.user_id; });
      var delegated = new Set(capability.delegated_user_ids || []);
      host.innerHTML = '<div class="card-h"><h3>Optional annual base salary</h3></div>' +
        '<p class="card-sub">Annual base salary is sensitive personal information. It may be supplied by an Admin or an Analyst explicitly authorized below, where company policy permits this diagnostic use. It excludes bonuses, benefits, and overhead; only USD is supported. It does not change diagnostic scores.</p>' +
        (capability.can_upload ? '<p class="card-sub">Select an existing campaign and upload a CSV with <code>email,annual_base_salary,salary_currency</code>. Only participants who have not started can be updated. Participants are not shown the supplied salary or an upload notice. Files are not saved in browser storage.</p>' +
          '<div class="frow"><div class="field"><label for="salaryBatch">Campaign</label><select id="salaryBatch"><option value="">Choose a campaign</option>' + batches.map(function (batch) { return '<option value="' + escape(batch.id) + '">' + escape(batch.label || "Campaign") + '</option>'; }).join("") + '</select></div></div>' +
          (!batches.length ? '<p class="card-sub">No campaigns currently have eligible participants.</p>' : '') +
          '<div id="salaryCampaignSettings"></div>' +
          '<div class="frow"><div class="field"><label for="settingsSalaryFile">Salary CSV</label><input type="file" id="settingsSalaryFile" accept=".csv,text/csv"></div><button class="btn ghost" id="settingsSalaryTemplate" type="button">Download template</button></div>' +
          '<p><label><input type="checkbox" id="settingsSalaryAuthority"> I am authorized to disclose these participants’ annual base salaries to Monderman for this diagnostic purpose, and I confirm this use complies with our company policy and applicable requirements.</label></p>' +
          '<div class="frow"><button class="btn ghost" id="settingsSalaryPreview" type="button" disabled>Preview salary import</button><button class="btn" id="settingsSalarySave" type="button" disabled>Apply supplied salaries</button><button class="btn ghost" id="settingsSalaryClear" type="button">Clear file</button></div><div id="settingsSalaryResult" role="status" aria-live="polite"></div>' : '') +
        (capability.can_delegate ? '<h4>Analyst salary upload authority</h4><p class="card-sub">Salary authority is separate from the Analyst role. Enable it only for Analysts whose job and company policy permit them to provide this sensitive information. You can revoke it here.</p>' +
          (members.length ? members.map(function (member) { return '<div class="lrow"><div class="main"><b>' + escape(member.full_name || member.email || "Analyst") + '</b><span>' + escape(member.email) + '</span></div><button class="btn ghost" type="button" data-salary-user="' + escape(member.user_id) + '" data-allow="' + (!delegated.has(member.user_id)) + '">' + (delegated.has(member.user_id) ? 'Revoke salary authority' : 'Authorize salary uploads') + '</button></div>'; }).join("") : '<p class="card-sub">There are no active Analysts to authorize.</p>') + '<div id="salaryDelegationResult" role="status" aria-live="polite"></div>' : '');
      wire();
      renderCampaignSettings();
    }
    function byId(id) { return host.querySelector("#" + id); }
    function selectedBatch() {
      return (capability.eligible_batches || []).find(function (batch) { return byId("salaryBatch") && batch.id === byId("salaryBatch").value; });
    }
    function savedSettings() {
      var saved = selectedBatch() && selectedBatch().salary_settings;
      if (!saved || saved.locked !== true) return null;
      var validated = helper.validateSettings(saved.annual_working_hours, saved.benefits_overhead_percent);
      return validated.ok ? validated.settings : null;
    }
    function renderCampaignSettings() {
      var container = byId("salaryCampaignSettings");
      if (!container) return;
      var batch = selectedBatch(), saved = savedSettings();
      if (!batch) { container.innerHTML = '<p class="card-sub">Choose a campaign to see its salary calculation settings.</p>'; updateButtons(); return; }
      var formula = '<p class="card-sub" id="settingsSalaryFormula">We add your chosen percentage of base salary for benefits and overhead, then divide by annual working hours. Hourly employment cost = annual base salary × (1 + percentage ÷ 100) ÷ annual working hours. These settings apply to this campaign only; they do not change diagnostic scores.</p>';
      if (saved) {
        container.innerHTML = '<h4>Campaign salary calculation</h4><p class="card-sub">Annual working hours per person: <strong>' + escape(saved.annual_working_hours) + '</strong>. Benefits and overhead: <strong>' + escape(saved.benefits_overhead_percent) + '% of base salary</strong>.</p>' + formula + '<p class="card-sub">These settings have been saved and cannot be changed. Supplied salaries use this calculation.</p>';
      } else if (capability.can_configure === true) {
        container.innerHTML = '<h4>Set this campaign’s salary calculation</h4>' +
          '<div class="frow"><div class="field"><label for="settingsSalaryHours">Annual working hours per person</label><input type="text" inputmode="decimal" autocomplete="off" id="settingsSalaryHours" aria-describedby="settingsSalaryFormula"></div>' +
          '<div class="field"><label for="settingsSalaryOverhead">Benefits and overhead (% of base salary)</label><input type="text" inputmode="decimal" autocomplete="off" id="settingsSalaryOverhead" aria-describedby="settingsSalaryFormula"></div></div>' + formula +
          '<p class="card-sub">Enter both values explicitly. Enter 0 for benefits and overhead if none should be included. Save once, before any participant starts. Saved settings cannot be changed.</p><button class="btn ghost" id="settingsSalarySaveCalculation" type="button">Save campaign calculation</button><div id="settingsSalaryCalculationResult" role="status" aria-live="polite"></div>';
        byId("settingsSalarySaveCalculation").addEventListener("click", saveCampaignSettings);
      } else {
        container.innerHTML = '<p class="card-sub">An Admin must save annual working hours and the benefits and overhead percentage before salaries can be uploaded for this campaign. Analyst salary authority does not allow these settings to be changed.</p>';
      }
      updateButtons();
    }
    async function saveCampaignSettings() {
      if (pending || capability.can_configure !== true || !selectedBatch() || savedSettings()) return;
      var result = helper.validateSettings(byId("settingsSalaryHours").value, byId("settingsSalaryOverhead").value);
      if (!result.ok) { byId("settingsSalaryCalculationResult").textContent = result.error; return; }
      var batchId = byId("salaryBatch").value;
      pending = true; updateButtons();
      try {
        await request("/api/assignments/salary-settings", "POST", { organization_id: options.organizationId, batch_id: batchId, annual_working_hours: result.settings.annual_working_hours, benefits_overhead_percent: result.settings.benefits_overhead_percent });
        await refresh(batchId);
      } catch (_error) {
        if (byId("settingsSalaryCalculationResult")) byId("settingsSalaryCalculationResult").textContent = "The calculation settings could not be saved. They may already be locked, a participant may have started, or your permissions may have changed. Refresh before trying again.";
      } finally { pending = false; updateButtons(); }
    }
    function invalidate() { previewed = false; if (byId("settingsSalarySave")) byId("settingsSalarySave").disabled = true; }
    function updateButtons() {
      if (!byId("settingsSalaryPreview")) return;
      var ready = !!csv && !!savedSettings() && byId("settingsSalaryAuthority").checked;
      byId("settingsSalaryPreview").disabled = pending || !ready;
      byId("settingsSalarySave").disabled = pending || !ready || !previewed;
      byId("settingsSalaryClear").disabled = pending;
      byId("settingsSalaryFile").disabled = pending;
      byId("salaryBatch").disabled = pending;
      byId("settingsSalaryAuthority").disabled = pending;
      ["settingsSalaryHours", "settingsSalaryOverhead", "settingsSalarySaveCalculation"].forEach(function (id) { if (byId(id)) byId(id).disabled = pending; });
    }
    function issuesHTML(issues) {
      // Never render arbitrary server messages, cells, or salary values.
      return '<ul>' + issues.map(function (issue) { return '<li>Row ' + (Number.isInteger(issue.row) ? issue.row : Number.isInteger(issue.row_number) ? issue.row_number : '?') + ': ' + escape(issue.local === true ? issue.message : 'This row could not be accepted. Check its email, salary, currency, and participant status.') + '</li>'; }).join("") + '</ul>';
    }
    async function submit(previewOnly) {
      if (pending || !csv || !savedSettings() || !byId("settingsSalaryAuthority").checked || (!previewOnly && !previewed)) return;
      var form = new FormData();
      form.append("organization_id", options.organizationId);
      form.append("batch_id", byId("salaryBatch").value);
      form.append("file", new Blob([csv], { type: "text/csv" }), "annual-base-salaries.csv");
      form.append("salary_authorization_consent", "true");
      form.append("salary_notice_version", helper.noticeVersion);
      form.append("preview_only", String(previewOnly));
      pending = true; updateButtons();
      try {
        var data = await request("/api/assignments/import-salaries", "POST", form);
        if ((data.invalid_rows || []).length) { var invalid = new Error("invalid"); invalid.issues = data.invalid_rows; throw invalid; }
        previewed = previewOnly;
        if (!previewOnly) { csv = ""; byId("settingsSalaryFile").value = ""; byId("settingsSalaryAuthority").checked = false; }
        byId("settingsSalaryResult").textContent = previewOnly ? "The salary import passed validation. Review the selected campaign before applying it. Amounts are excluded from this preview." : "Supplied salaries applied to the eligible participants. Diagnostic scores are unchanged.";
      } catch (error) {
        invalidate();
        byId("settingsSalaryResult").innerHTML = '<p>No salary changes were confirmed. Correct the file or refresh your permissions, then preview again.</p>' + issuesHTML(Array.isArray(error.issues) ? error.issues : []);
      } finally { pending = false; updateButtons(); }
    }
    function wire() {
      if (capability.can_upload) {
        byId("salaryBatch").addEventListener("change", function () { fileRevision++; csv = ""; byId("settingsSalaryFile").value = ""; byId("settingsSalaryAuthority").checked = false; byId("settingsSalaryResult").textContent = ""; invalidate(); renderCampaignSettings(); });
        byId("settingsSalaryAuthority").addEventListener("change", function () { invalidate(); updateButtons(); });
        byId("settingsSalaryFile").addEventListener("change", async function (event) {
          var file = event.target.files && event.target.files[0], revision = ++fileRevision; csv = ""; invalidate(); byId("settingsSalaryAuthority").checked = false; updateButtons();
          if (!file) return;
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error("too_large");
            var text = await file.text(), parsed = helper.parse(text);
            if (revision !== fileRevision) return;
            if (!parsed.ok) { byId("settingsSalaryResult").innerHTML = '<p>Nothing imported. Correct these rows and select the file again.</p>' + issuesHTML(parsed.errors.map(function (issue) { return { ...issue, local: true }; })); return; }
            if (!parsed.salaryCount) { byId("settingsSalaryResult").textContent = "This file contains no salaries to apply."; return; }
            csv = text;
            byId("settingsSalaryResult").textContent = parsed.rows.length + " recipient rows validated; " + parsed.salaryCount + " salaries supplied. Confirm your authority, then preview the import.";
          } catch (_error) { if (revision === fileRevision) byId("settingsSalaryResult").textContent = "Could not read this CSV. Use a file smaller than 5 MB."; }
          finally { updateButtons(); }
        });
        byId("settingsSalaryPreview").addEventListener("click", function () { submit(true); });
        byId("settingsSalarySave").addEventListener("click", function () { submit(false); });
        byId("settingsSalaryClear").addEventListener("click", function () { fileRevision++; csv = ""; byId("settingsSalaryFile").value = ""; byId("settingsSalaryAuthority").checked = false; byId("settingsSalaryResult").textContent = "Selected file cleared."; invalidate(); updateButtons(); });
        byId("settingsSalaryTemplate").addEventListener("click", function () {
          var url = URL.createObjectURL(new Blob([helper.template], { type: "text/csv" })), link = document.createElement("a");
          link.href = url; link.download = "annual-base-salary-template.csv"; link.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 0);
        });
      }
      host.querySelectorAll("[data-salary-user]").forEach(function (button) {
        button.addEventListener("click", async function () {
          button.disabled = true;
          try { await request("/api/assignments/salary-delegation", "POST", { organization_id: options.organizationId, user_id: button.dataset.salaryUser, can_upload: button.dataset.allow === "true" }); await refresh(); }
          catch (_error) { byId("salaryDelegationResult").textContent = "Salary authority was not changed. Refresh and try again."; button.disabled = false; }
        });
      });
    }
    await refresh();
  }
  window.MondermanEmployerSalarySettings = { mount: mount };
})();
