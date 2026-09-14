(function () {
  "use strict";

  const ARTIFACT_URL = "sample-data/production-diagnostic-samples.json?v=76c4fdf7bebde113";
  const REPORT_KEYS = {
    os: "operational_systems",
    dv: "decision_velocity",
    sc: "structural_clarity",
    ip: "institutional_performance",
    depth: "depth_synthesis",
    synthesis: "cross_lens_synthesis"
  };
  let reportsReady = false;
  const mountedPrintControls = new Map();

  function selectedPrintControl() {
    if (!reportsReady || mountedPrintControls.size !== Object.keys(REPORT_KEYS).length) return null;
    const shells = Array.from(document.querySelectorAll('.report-shell:not([hidden])'));
    if (shells.length !== 1 || getComputedStyle(shells[0]).display === 'none' || getComputedStyle(shells[0]).visibility === 'hidden') return null;
    const control = mountedPrintControls.get(shells[0]);
    return control && control.isConnected && !control.disabled && shells[0].contains(control) ? control : null;
  }

  function syncSelectedPdf() {
    const button = document.getElementById('sample-selected-pdf');
    if (button) button.disabled = !selectedPrintControl();
  }

  function wireSelectedPdf() {
    const button = document.getElementById('sample-selected-pdf');
    if (!button) return;
    button.addEventListener('click', () => {
      const control = selectedPrintControl();
      if (control) control.click();
      else syncSelectedPdf();
    });
    const sheet = document.querySelector('.report-sheet');
    if (sheet) new MutationObserver(syncSelectedPdf).observe(sheet, {attributes:true,attributeFilter:['hidden','style','class','disabled'],childList:true,subtree:true});
    syncSelectedPdf();
  }

  const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function sectionLabel(node) {
    if (node.classList.contains("mr-cover")) return "Overview";
    if (node.classList.contains("mr-run-decision")) return "Decision summary";
    if (node.classList.contains("mr-leadership-close")) return "Next decision";
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
      const id = node.id || "sample-" + sourceKey.replace(/_/g, "-") + "-section-" + (index + 1);
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
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
      '<div class="psr-toolbar" aria-label="Sample report controls"><div><strong>' + esc(options.toolbarLabel || "Monderman report") + '</strong><details class="psr-provenance"><summary>Source details</summary><p>' + esc(options.provenance || "Shared production report renderer") + '</p></details></div>' +
      '<div class="psr-toolbar-actions"><button type="button" data-action="read">Read the report</button>' +
      '<button class="psr-primary" type="button" data-action="print">Download PDF</button><details class="psr-downloads"><summary>Other formats</summary><div><button type="button" data-action="html">Download HTML</button><button type="button" data-action="json">Download JSON</button></div></details></div></div>' +
      '<div class="psr-engine-stage"></div></div></div>' +
      '<aside class="toc-rail psr-toc" aria-label="' + esc(options.tocLabel || "Report contents") + '"><p class="toc-rail-label">Contents</p><ol></ol></aside></div>';
    return shell.querySelector(".psr-engine-stage");
  }

  function mountReport(options) {
    const Report = window.MondermanReport;
    if (!Report || typeof Report.fromRun !== "function" || typeof Report.render !== "function") {
      throw new Error("Shared report display is unavailable");
    }
    const shell = options.shell;
    const model = options.model;
    const source = options.source;
    const sourceKey = options.sourceKey;
    const stage = renderFrame(shell, options);
    Report.render(stage, model);
    shell.querySelector('[data-action="read"]').addEventListener("click", () => {
      const overview = stage.querySelector(".mr-cover") || stage;
      if (!overview.hasAttribute("tabindex")) overview.setAttribute("tabindex", "-1");
      overview.focus({preventScroll:true});
      overview.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",block:"start"});
    });
    shell.querySelector('[data-action="html"]').addEventListener("click", () => Report.downloadHtml(model));
    shell.querySelector('[data-action="json"]').addEventListener("click", () => Report.downloadJson(source, sourceKey.replace(/_/g, "-") + "-representative-result"));
    shell.querySelector('[data-action="print"]').addEventListener("click", () => Report.downloadPdf(model));
    buildContents(shell, stage, sourceKey, options.tocId);
  }

  function reportGenerationCommit(entry, artifact) {
    const provenance = obj(entry.provenance);
    const present = Object.prototype.hasOwnProperty.call(provenance, "engine_commit");
    // The current mixed library requires each original generation identity.
    // Only the historical v2 shape may fall back when that field is absent.
    const revision = present ? provenance.engine_commit :
      artifact.contract === "monderman-public-product-samples/v2" ? artifact.engine_commit : null;
    if (typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision)) {
      throw new Error("Missing or invalid report generation revision provenance");
    }
    return revision;
  }

  function wireReport(shell, entry, artifact, sourceKey) {
    const source = entry.source;
    const generationCommit = reportGenerationCommit(entry, artifact);
    const provenance = "Report created " + entry.provenance.generated_at.slice(0, 10) +
      " · API " + generationCommit.slice(0, 8) + " · artifact " + artifact.artifact_sha256.slice(0, 12);
    mountReport({
      shell,
      model: window.MondermanPublicSamples.model(entry, artifact),
      source: {export_payload: {...source, sample_provenance: {...entry.provenance, engine_commit:generationCommit, artifact_sha256:artifact.artifact_sha256}}},
      sourceKey,
      engineCommit: generationCommit,
      artifactSha256: artifact.artifact_sha256,
      toolbarLabel: "Monderman report",
      provenance,
      tocLabel: sourceKey.replace(/_/g, " ") + " contents",
      tocId: sourceKey.replace(/_/g, "-") + "Toc"
    });
    mountedPrintControls.set(shell, shell.querySelector('[data-action="print"]'));
  }

  function showFailure(error) {
    reportsReady = false;
    mountedPrintControls.clear();
    syncSelectedPdf();
    Object.keys(REPORT_KEYS).forEach((tabKey) => {
      const shell = document.getElementById("report-" + tabKey);
      if (!shell) return;
      shell.innerHTML = '<div class="psr-load-error" role="alert"><strong>The example could not be loaded.</strong><p>' +
        esc(error && error.message ? error.message : error) + '</p></div>';
    });
    document.body.classList.add("production-samples-ready");
  }

  async function render() {
    try {
      const response = await fetch(ARTIFACT_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Artifact request failed with status " + response.status);
      const artifact = await response.json();
      window.MondermanPublicSamples.validate(artifact);
      if (!/^[a-f0-9]{40}$/.test(artifact.engine_commit || "")) throw new Error("Missing engine revision provenance");
      if (!/^[a-f0-9]{64}$/.test(artifact.artifact_sha256 || "")) throw new Error("Missing artifact digest");

      Object.entries(REPORT_KEYS).forEach(([tabKey, sourceKey]) => {
        const entry = obj(obj(artifact.outputs)[sourceKey]);
        const shell = document.getElementById("report-" + tabKey);
        if (!shell) throw new Error("Missing report shell for " + tabKey);
        wireReport(shell, entry, artifact, sourceKey);
      });

      reportsReady = true;
      syncSelectedPdf();
      document.body.classList.add("production-samples-ready");
      document.dispatchEvent(new CustomEvent("monderman:production-samples-ready", { detail: {
        engineCommit: artifact.engine_commit,
        artifactSha256: artifact.artifact_sha256,
        renderer: "MondermanReport.fromRun/fromSynthesis"
      }}));
    } catch (error) {
      console.error("Production sample rendering failed", error);
      showFailure(error);
    }
  }

  window.MondermanSampleReportShell = { mount: mountReport };

  function start() { wireSelectedPdf(); render(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
