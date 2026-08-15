from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "diagnostics.html"
text = PATH.read_text(encoding="utf-8")
original = text

SYNC_BLOCK = r'''    function uploadCanonicalResult(parsed) {
      if (!parsed || typeof parsed !== "object") return {};
      if (parsed.result && typeof parsed.result === "object") return parsed.result;
      if (parsed.synthesis_payload && typeof parsed.synthesis_payload === "object") return parsed.synthesis_payload;
      if (parsed.data && parsed.data.result && typeof parsed.data.result === "object") return parsed.data.result;
      if (parsed.payload && parsed.payload.result && typeof parsed.payload.result === "object") return parsed.payload.result;
      return parsed;
    }

    function uploadedSynthesisMode(validFiles) {
      const tools = new Set(validFiles.map((file) => String(uploadCanonicalResult(file.parsed).tool_type || "").trim()).filter(Boolean));
      return tools.size === 1 ? "depth" : "cross_lens";
    }

    function syncSynthesisState() {
      renderFileList();
      const validFiles = uploadedFiles.filter((file) => file.valid);
      const validCount = validFiles.length;
      synthesizeBtn.disabled = validCount < 2;
      if (!uploadedFiles.length) {
        showValidation("", "");
        return;
      }
      if (validCount >= 2) {
        const tools = new Set(validFiles.map((file) => String(uploadCanonicalResult(file.parsed).tool_type || "").trim()).filter(Boolean));
        const totalBytes = validFiles.reduce((sum, file) => sum + Number(file.bytes || 0), 0);
        if (tools.size === 1) {
          const onlyLabel = validFiles[0]?.toolLabel || "one instrument";
          showValidation(`${validCount} ${onlyLabel} files ready for a depth synthesis. The result will describe the observed median, distribution, segment evidence, and sampling limits; it will not claim population representativeness without a documented sampling frame. ${Math.round(totalBytes / 1024).toLocaleString()} KB selected.`, "ok");
        } else {
          showValidation(`${validCount} valid files across ${tools.size} instruments ready for cross-lens synthesis. The API will compare the lenses and publish one composite only if scope, versions, source identity, measurement window, respondent depth, and lens balance satisfy the coherence rules. ${Math.round(totalBytes / 1024).toLocaleString()} KB selected.`, "ok");
        }
      } else {
        showValidation("Upload 2 or more valid Monderman JSON result files to continue.", "error");
      }
    }

    function parseResultFile'''

text, count = re.subn(
    r'    function syncSynthesisState\(\) \{.*?\n    function parseResultFile',
    SYNC_BLOCK,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"syncSynthesisState block: expected one match, found {count}")

text = text.replace(
    '''              name: file.name,
              valid,
              parsed,''',
    '''              name: file.name,
              bytes: Number(file.size || text.length || 0),
              valid,
              parsed,''',
    1,
)
text = text.replace(
    '''              name: file.name,
              valid: false,
              parsed: null,''',
    '''              name: file.name,
              bytes: Number(file.size || 0),
              valid: false,
              parsed: null,''',
    1,
)
text = text.replace(
    '''            name: file.name,
            valid: false,
            parsed: null,''',
    '''            name: file.name,
            bytes: Number(file.size || 0),
            valid: false,
            parsed: null,''',
    1,
)

RUN_BLOCK = r'''    async function runCrossDiagnosticSynthesis(validFiles) {
      const mode = uploadedSynthesisMode(validFiles);
      const payload = {
        results: validFiles.map((file) => file.parsed),
        options: {
          mode,
          scopePolicy: "warn",
          includeNarrative: true,
          includeExport: true,
          includeDebug: false,
          ...(mode === "depth" ? { samplingFrame: { method: "observed_set" } } : {})
        }
      };
      const bodyText = JSON.stringify(payload);
      const bodyBytes = new TextEncoder().encode(bodyText).length;
      if (bodyBytes > 220 * 1024) {
        throw new Error("These result files exceed the safe direct-upload size. Add the runs to your workspace and build the synthesis from Analysis, which sends compact run IDs and supports cohorts of up to 5,000 runs.");
      }

      const headers = { "Content-Type": "application/json" };
      const accessToken = readSupabaseAccessToken();
      if (accessToken) headers["Authorization"] = "Bearer " + accessToken;

      const response = await fetch(SYNTHESIS_API_URL, {
        method: "POST",
        headers,
        body: bodyText
      });
      const data = await response.json().catch(() => ({}));
      if (data && data.locked && data.teaser) {
        return { kind: "locked", teaser: data.teaser, message: data.message || "", reason: data.reason || data.error || "" };
      }
      if (!response.ok || !data.ok || !data.result) {
        throw new Error((data && (data.message || data.error)) || "Meta-synthesis failed.");
      }
      return { kind: "full", result: data.result };
    }

    function renderSynthesisTeaser'''

text, count = re.subn(
    r'    async function runCrossDiagnosticSynthesis\(validFiles\) \{.*?\n    function renderSynthesisTeaser',
    RUN_BLOCK,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"runCrossDiagnosticSynthesis block: expected one match, found {count}")

TEASER_BLOCK = r'''    function renderSynthesisTeaser(outcome) {
      const prior = document.getElementById("synthesisTeaser");
      if (prior) prior.remove();
      if (!validationMessage) return;
      const t = outcome.teaser || {};
      const exposure = t.pathway_exposure || {};
      const escT = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const money = (v) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))) ? ("$" + Math.round(Number(v)).toLocaleString()) : null;
      const rows = [];
      if (t.reads_combined != null) rows.push(["Runs combined", Number(t.reads_combined).toLocaleString()]);
      if (t.lens_count != null) rows.push(["Diagnostic lenses", Number(t.lens_count).toLocaleString()]);
      if (t.evidence_label) rows.push(["Evidence band", escT(t.evidence_label)]);
      rows.push(["Composite", t.score_status === "published" && t.cross_diagnostic_score != null ? escT(t.cross_diagnostic_score) + (t.condition_band ? " · " + escT(t.condition_band) : "") : "Withheld"]);
      if (money(exposure.annual_cost)) rows.push(["Median annual labor cost", money(exposure.annual_cost)]);
      if (money(exposure.recoverable_cost)) rows.push(["Observed recoverable estimate", money(exposure.recoverable_cost)]);
      if (exposure.withheld_reason) rows.push(["Exposure status", escT(exposure.withheld_reason)]);
      const product = t.synthesis_product === "depth_synthesis" ? "Depth synthesis" : "Cross-lens synthesis";
      const card = document.createElement("div");
      card.id = "synthesisTeaser";
      card.setAttribute("role", "status");
      card.style.cssText = "margin-top:18px;padding:22px 24px;background:#FFFFFF;border:1px solid rgba(12,110,120,.28);border-left:4px solid #0C6E78;border-radius:12px;";
      card.innerHTML =
        '<p style="margin:0 0 6px;font-size:.76rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#0C6E78;">' + escT(product) + ' ready</p>' +
        '<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:10px 0 12px;font-size:.95rem;">' +
          rows.map((rw) => '<div style="color:#6E6F73;">' + rw[0] + '</div><div style="font-weight:600;color:#18191C;">' + rw[1] + "</div>").join("") + "</div>" +
        '<p style="margin:0 0 14px;font-size:.95rem;line-height:1.6;color:#18191C;">' + escT(outcome.message || "Sign in to see the full synthesis, its evidence limits, lens agreements and differences, and what would strengthen the read.") + "</p>" +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<a class="btn btn-accent" href="signin.html?next=diagnostics.html">Sign in</a>' +
          '<a class="btn" href="platform-services.html">See plans</a>' +
        "</div>";
      validationMessage.insertAdjacentElement("afterend", card);
    }

    if (synthesizeBtn)'''

text, count = re.subn(
    r'    function renderSynthesisTeaser\(outcome\) \{.*?\n    if \(synthesizeBtn\)',
    TEASER_BLOCK,
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"renderSynthesisTeaser block: expected one match, found {count}")

text = text.replace(
    'showValidation("Uploading files and generating synthesis...", "ok");',
    'showValidation("Validating files and building the appropriate depth or cross-lens synthesis...", "ok");',
    1,
)
text = text.replace(
    'showValidation("Your files combined cleanly — the summary below shows what the full synthesis holds.", "ok");',
    'showValidation("Your files passed validation — the summary below preserves the evidence band and any withheld composite.", "ok");',
    1,
)
text = text.replace(
    'showValidation("Synthesis complete. Opening combined readout...", "ok");',
    'showValidation("Synthesis complete. Opening the evidence-banded report...", "ok");',
    1,
)

for forbidden in (
    "population statistics",
    "Compounded exposure / yr",
    "Cross-diagnostic synthesis failed.",
):
    if forbidden in text:
        raise RuntimeError(f"obsolete upload-synthesis behavior remains: {forbidden}")

for required in (
    'mode,',
    'scopePolicy: "warn"',
    'samplingFrame: { method: "observed_set" }',
    'bodyBytes > 220 * 1024',
    't.evidence_label',
    't.score_status === "published"',
    't.pathway_exposure',
):
    if required not in text:
        raise RuntimeError(f"required upload-synthesis behavior missing: {required}")

if text == original:
    raise RuntimeError("diagnostics.html was not changed")
PATH.write_text(text, encoding="utf-8")
print("Patched direct-upload synthesis for depth, cross-lens, and evidence-band parity.")
