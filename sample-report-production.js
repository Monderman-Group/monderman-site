(function () {
  "use strict";

  const ARTIFACT_URL = "sample-data/production-diagnostic-samples.json?v=eed3e2819589";
  const REPORT_KEYS = {
    os: "operational_systems",
    dv: "decision_velocity",
    sc: "structural_clarity",
    ip: "institutional_performance"
  };

  const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function renderToolbar(shell, artifact, sourceKey) {
    const provenance = "API " + artifact.engine_commit.slice(0, 8) + " · artifact " + artifact.artifact_sha256.slice(0, 12);
    shell.innerHTML = '<div class="psr-wrap" data-engine-commit="' + esc(artifact.engine_commit) +
      '" data-artifact-sha256="' + esc(artifact.artifact_sha256) + '" data-source-key="' + esc(sourceKey) + '">' +
      '<div class="psr-toolbar" aria-label="Sample report controls"><div><strong>Certified product output</strong><span>' + esc(provenance) + '</span></div>' +
      '<div class="psr-toolbar-actions"><button type="button" data-action="html">Download HTML</button>' +
      '<button type="button" data-action="json">Download JSON</button><button type="button" data-action="print">Print or save PDF</button></div></div>' +
      '<div class="psr-engine-stage"></div></div>';
    return shell.querySelector(".psr-engine-stage");
  }

  function wireReport(shell, source, artifact, sourceKey) {
    const Report = window.MondermanReport;
    if (!Report || typeof Report.fromRun !== "function" || typeof Report.render !== "function") {
      throw new Error("Certified report engine is unavailable");
    }
    const model = Report.fromRun(source);
    const stage = renderToolbar(shell, artifact, sourceKey);
    Report.render(stage, model);
    shell.querySelector('[data-action="html"]').addEventListener("click", () => Report.downloadHtml(model));
    shell.querySelector('[data-action="json"]').addEventListener("click", () => Report.downloadJson(source, sourceKey.replace(/_/g, "-") + "-representative-result"));
    shell.querySelector('[data-action="print"]').addEventListener("click", () => Report.downloadPdf(model));
  }

  function showFailure(error) {
    Object.keys(REPORT_KEYS).forEach((tabKey) => {
      const shell = document.getElementById("report-" + tabKey);
      if (!shell) return;
      shell.innerHTML = '<div class="psr-load-error" role="alert"><strong>Certified product output could not be loaded.</strong><p>' +
        esc(error && error.message ? error.message : error) + '</p></div>';
    });
    document.body.classList.add("production-samples-ready");
  }

  async function render() {
    try {
      const response = await fetch(ARTIFACT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Artifact request failed with status " + response.status);
      const artifact = await response.json();
      if (artifact.contract !== "monderman-public-diagnostic-sample-output/v1") throw new Error("Unexpected sample artifact contract");
      if (!/^[a-f0-9]{40}$/.test(artifact.engine_commit || "")) throw new Error("Missing engine revision provenance");
      if (!/^[a-f0-9]{64}$/.test(artifact.artifact_sha256 || "")) throw new Error("Missing artifact digest");

      Object.entries(REPORT_KEYS).forEach(([tabKey, sourceKey]) => {
        const source = obj(obj(artifact.outputs)[sourceKey]);
        if (!obj(source.result).tool_type) throw new Error("Missing production output for " + sourceKey);
        const shell = document.getElementById("report-" + tabKey);
        if (!shell) throw new Error("Missing report shell for " + tabKey);
        wireReport(shell, source, artifact, sourceKey);
      });

      document.body.classList.add("production-samples-ready");
      document.dispatchEvent(new CustomEvent("monderman:production-samples-ready", { detail: {
        engineCommit: artifact.engine_commit,
        artifactSha256: artifact.artifact_sha256,
        renderer: "MondermanReport.fromRun"
      }}));
    } catch (error) {
      console.error("Production sample rendering failed", error);
      showFailure(error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();
