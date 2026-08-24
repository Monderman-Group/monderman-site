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

  function sectionLabel(node) {
    if (node.classList.contains("mr-cover")) return "Executive cover";
    if (node.classList.contains("mr-report-boundary")) return "Interpretation boundary";
    const heading = node.querySelector("h2");
    return ((heading && heading.textContent) || "Report section")
      .replace(/^\s*\d+\s*[.·]\s*/, "").trim();
  }

  function buildContents(shell, stage, sourceKey, tocId) {
    const list = shell.querySelector(".psr-toc ol");
    const select = shell.querySelector(".psr-toc-mobile select");
    const nodes = Array.from(stage.querySelectorAll(".mr-cover, .mr-section, .mr-report-boundary"));
    const links = [];
    nodes.forEach((node, index) => {
      const id = "sample-" + sourceKey.replace(/_/g, "-") + "-section-" + (index + 1);
      const label = sectionLabel(node);
      node.id = id;
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + id;
      link.dataset.section = id;
      link.innerHTML = '<span class="toc-num">' + String(index + 1).padStart(2, "0") + "</span>" + esc(label);
      li.appendChild(link);
      list.appendChild(li);
      links.push(link);
      const option = document.createElement("option");
      option.value = id;
      option.textContent = String(index + 1).padStart(2, "0") + " · " + label;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      const target = document.getElementById(select.value);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if ("IntersectionObserver" in window) {
      const byId = Object.fromEntries(links.map((link) => [link.dataset.section, link]));
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || !byId[entry.target.id]) return;
          links.forEach((link) => link.classList.remove("is-active"));
          byId[entry.target.id].classList.add("is-active");
          select.value = entry.target.id;
        });
      }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
      nodes.forEach((node) => observer.observe(node));
    }
    const toc = shell.querySelector(".psr-toc");
    if (tocId) toc.id = tocId;
  }

  function renderFrame(shell, options) {
    const engineCommit = options.engineCommit || "";
    const artifactSha256 = options.artifactSha256 || "";
    shell.innerHTML = '<div class="toc-mobile psr-toc-mobile"><select aria-label="Jump to report section"><option value="">Jump to section…</option></select></div>' +
      '<div class="synthesis-doc-shell psr-doc-shell"><div class="synthesis-report-stage psr-main"><div class="psr-wrap" data-engine-commit="' + esc(engineCommit) +
      '" data-artifact-sha256="' + esc(artifactSha256) + '" data-source-key="' + esc(options.sourceKey) + '">' +
      '<div class="psr-toolbar" aria-label="Sample report controls"><div><strong>' + esc(options.toolbarLabel || "Representative product output") + '</strong><span>' + esc(options.provenance || "Shared production report renderer") + '</span></div>' +
      '<div class="psr-toolbar-actions"><button type="button" data-action="html">Download HTML</button>' +
      '<button type="button" data-action="json">Download JSON</button><button type="button" data-action="print">Print or save PDF</button></div></div>' +
      '<div class="psr-engine-stage"></div></div></div>' +
      '<aside class="toc-rail psr-toc" aria-label="' + esc(options.tocLabel || "Report contents") + '"><p class="toc-rail-label">Contents</p><ol></ol></aside></div>';
    return shell.querySelector(".psr-engine-stage");
  }

  function mountReport(options) {
    const Report = window.MondermanReport;
    if (!Report || typeof Report.fromRun !== "function" || typeof Report.render !== "function") {
      throw new Error("Certified report engine is unavailable");
    }
    const shell = options.shell;
    const model = options.model;
    const source = options.source;
    const sourceKey = options.sourceKey;
    const stage = renderFrame(shell, options);
    Report.render(stage, model);
    shell.querySelector('[data-action="html"]').addEventListener("click", () => Report.downloadHtml(model));
    shell.querySelector('[data-action="json"]').addEventListener("click", () => Report.downloadJson(source, sourceKey.replace(/_/g, "-") + "-representative-result"));
    shell.querySelector('[data-action="print"]').addEventListener("click", () => Report.downloadPdf(model));
    buildContents(shell, stage, sourceKey, options.tocId);
  }

  function wireReport(shell, source, artifact, sourceKey) {
    const Report = window.MondermanReport;
    const provenance = "API " + artifact.engine_commit.slice(0, 8) + " · artifact " + artifact.artifact_sha256.slice(0, 12);
    mountReport({
      shell,
      model: Report.fromRun(source),
      source,
      sourceKey,
      engineCommit: artifact.engine_commit,
      artifactSha256: artifact.artifact_sha256,
      toolbarLabel: "Certified product output",
      provenance,
      tocLabel: sourceKey.replace(/_/g, " ") + " contents",
      tocId: sourceKey.replace(/_/g, "-") + "Toc"
    });
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

  window.MondermanSampleReportShell = { mount: mountReport };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();
