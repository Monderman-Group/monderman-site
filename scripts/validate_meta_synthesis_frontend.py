from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
WORKSPACE = (ROOT / "workspace-analysis.html").read_text(encoding="utf-8")
DIAGNOSTICS = (ROOT / "diagnostics.html").read_text(encoding="utf-8")
FULL_PAGE = (ROOT / "cross-tool-synthesis.html").read_text(encoding="utf-8")


def require(source: str, token: str, label: str) -> None:
    if token not in source:
        raise AssertionError(f"{label}: missing {token!r}")


def forbid(source: str, token: str, label: str) -> None:
    if token in source:
        raise AssertionError(f"{label}: forbidden token remains: {token!r}")


def node_check(path: Path) -> None:
    subprocess.run(["node", "--check", str(path)], cwd=ROOT, check=True)


def check_inline_scripts(path: Path) -> int:
    html = path.read_text(encoding="utf-8")
    count = 0
    for index, match in enumerate(re.finditer(r"<script\b([^>]*)>([\s\S]*?)</script>", html, flags=re.I), start=1):
        attrs = match.group(1) or ""
        script = match.group(2) or ""
        if re.search(r"\bsrc\s*=", attrs, flags=re.I):
            continue
        type_match = re.search(r"\btype\s*=\s*['\"]([^'\"]+)['\"]", attrs, flags=re.I)
        script_type = (type_match.group(1).lower() if type_match else "")
        if script_type in {"application/ld+json", "application/json"} or not script.strip():
            continue
        suffix = ".mjs" if script_type == "module" else ".js"
        with tempfile.NamedTemporaryFile("w", suffix=suffix, encoding="utf-8", delete=False) as handle:
            handle.write(script)
            temp_path = Path(handle.name)
        try:
            subprocess.run(["node", "--check", str(temp_path)], cwd=ROOT, check=True)
        finally:
            temp_path.unlink(missing_ok=True)
        count += 1
    if count == 0:
        raise AssertionError(f"{path.name}: no executable inline scripts found")
    return count


# Shared report contract.
for token in (
    'kind: "meta-synthesis"',
    'product: product',
    'scorePublished: scorePublished',
    'headlineBand: scorePublished ? (firstStr(r.score_label, conditionBand) + " · " + conditionBand) : "Composite withheld"',
    "function renderMetaSynthesis",
    "function renderDepthDistribution",
    "function renderRequirements",
    "function renderMetaExposure",
    "each diagnostic lens receives one vote regardless of respondent count",
    "Population generalization requires a documented sampling frame",
):
    require(REPORT, token, "monderman-report.js")

for token in (
    "function svgHeroMap",
    "function svgCascade",
    "function renderComposite",
    "function renderSampleDepth",
    'm.kind === "synthesis"',
    "population statistics",
    "poll_grade",
    "compensation_hours",
    "correction_horizon_weeks",
    "total_labor_exposure_low",
    "Structural corrections must precede behavioral ones",
    "Reversing the order regenerates",
    "Visible operating performance is intact",
):
    forbid(REPORT, token, "monderman-report.js")

# Workspace large-cohort and mode-aware request contract.
for token in (
    "SYNTH_PAGE_SIZE = 1000",
    "SYNTH_MAX_LOAD = 10000",
    "SYNTH_MAX_SELECTED = 5000",
    "SYNTH_DETAIL_ROWS = 250",
    '.range(from,to)',
    'run_ids:ids',
    'scopePolicy:',
    'samplingFrame',
    'mode:"depth"',
    'mode:"cross_lens"',
    'mondermanCrossDiagnosticSynthesis',
    'If a Cross-Lens Composite Score is withheld, the report states why and what actions could unlock one.',
    '/api/synthesis',
    '/api/synthesis-runs',
    'Build Depth Synthesis',
    'Build Cross-Lens Synthesis',
):
    require(WORKSPACE, token, "workspace-analysis.html")

for token in (
    ".limit(200)",
    "population statistics",
    "body: JSON.stringify({ results",
    "Compounded exposure",
    "Cross-Diagnostic Score",
):
    forbid(WORKSPACE, token, "workspace-analysis.html")

# Direct-upload parity and body-size guard.
for token in (
    "function uploadedSynthesisMode",
    'scopePolicy: "warn"',
    'samplingFrame: { method: "observed_set" }',
    "bodyBytes > 220 * 1024",
    "These result files exceed the safe direct-upload size",
    "t.evidence_label",
    't.score_status === "published"',
    "t.pathway_exposure",
):
    require(DIAGNOSTICS, token, "diagnostics.html")
for token in (
    "population statistics",
    "Compounded exposure / yr",
    "Cross-diagnostic synthesis failed.",
):
    forbid(DIAGNOSTICS, token, "diagnostics.html")

# Full-page report is a pure shared renderer, not a second synthesis engine.
for token in (
    'const STORAGE_KEY="mondermanCrossDiagnosticSynthesis"',
    "MondermanReport.fromSynthesis(result)",
    'result.score_status==="published"',
    "This page renders the API result; it does not recalculate scores",
    '/api/synthesis-runs/',
    'Cross-Lens Composite Score withheld',
):
    require(FULL_PAGE, token, "cross-tool-synthesis.html")
for token in (
    "/api/cross-diagnostic-synthesis",
    "compensation",
    "correction horizon",
    "poll-grade",
    "population statistics",
    "Structural Compensation Pattern",
):
    forbid(FULL_PAGE, token, "cross-tool-synthesis.html")

# Mechanical cleanliness. Source may contain defensive checks for placeholders;
# the fixture corpus below verifies that no placeholder reaches rendered output.
for name, source in (
    ("monderman-report.js", REPORT),
    ("workspace-analysis.html", WORKSPACE),
    ("diagnostics.html", DIAGNOSTICS),
    ("cross-tool-synthesis.html", FULL_PAGE),
):
    if re.search(r"\b(?:undefined|NaN)\b", source):
        for literal in ('>undefined<', '"undefined"', '>NaN<', '"NaN"'):
            if literal in source:
                raise AssertionError(f"{name}: customer-visible placeholder literal remains: {literal}")

node_check(ROOT / "monderman-report.js")
node_check(ROOT / "scripts/meta_synthesis_frontend_fixture.mjs")
inline_counts = {
    "workspace-analysis.html": check_inline_scripts(ROOT / "workspace-analysis.html"),
    "diagnostics.html": check_inline_scripts(ROOT / "diagnostics.html"),
    "cross-tool-synthesis.html": check_inline_scripts(ROOT / "cross-tool-synthesis.html"),
}
subprocess.run(["node", "scripts/meta_synthesis_frontend_fixture.mjs"], cwd=ROOT, check=True)

print({
    "ok": True,
    "shared_report_fixture": "pass",
    "inline_script_counts": inline_counts,
    "large_workspace_selection": 5000,
    "visible_detail_rows": 250,
    "direct_upload_guard_kb": 220,
})
print("Meta-synthesis frontend contract, syntax, fixture, and claim-discipline validation passed.")
