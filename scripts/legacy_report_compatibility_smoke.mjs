import fs from "node:fs";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.REPORT_BASE || "http://127.0.0.1:8080";
const out = process.env.REPORT_OUT || "/tmp/monderman-legacy-report-compatibility";
fs.mkdirSync(out, { recursive: true });

function assert(value, message) {
  if (!value) throw new Error(message);
}

const notice = "This pre-policy report is shown as a structured legacy view. Earlier explanatory text is withheld; scores and structured measurements are unchanged.";
const tools = [
  ["structural_clarity", "Structural Clarity", 63],
  ["decision_velocity", "Decision Velocity", 58],
  ["operational_systems", "Operational Systems", 61],
  ["institutional_performance", "Institutional Performance", 56],
];

const browser = await chromium.launch({ headless: true });
const source = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await source.goto(`${base}/sample-report.html`, { waitUntil: "networkidle", timeout: 90_000 });

const candidates = await source.evaluate(({ tools, notice }) => {
  const compatibility = { status: "legacy_structured_view", redacted_fields: 12, notice };
  const reports = tools.map(([tool_type, tool_label, score]) => {
    const result = {
      tool_type,
      tool_label,
      score,
      score_band: "Mixed",
      dimensions: { authority: 62, routing: 54, rework: 58 },
      measurement_coverage: { measured_dimension_count: 3, total_dimension_count: 3 },
      _claims_compatibility: compatibility,
    };
    return {
      key: tool_type,
      score: String(score),
      html: window.MondermanReport.buildReportHtml(window.MondermanReport.fromRun(result)),
    };
  });
  const synthesis = {
    synthesis_product: "cross_lens_synthesis",
    synthesis_mode: "cross_lens",
    score_status: "withheld",
    cross_diagnostic_score: null,
    condition_band: "Composite withheld",
    source_result_count: 4,
    lens_count: 4,
    source_groups: [],
    _claims_compatibility: compatibility,
  };
  reports.push({
    key: "cross_lens_synthesis",
    score: "Unavailable",
    html: window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(synthesis)),
  });
  return reports;
}, { tools, notice });

const results = [];
for (const candidate of candidates) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.setContent(candidate.html, { waitUntil: "networkidle" });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  const banner = page.locator(".mr-compatibility-notice");
  assert(await banner.isVisible(), `${candidate.key}: compatibility notice is missing`);
  assert((await banner.textContent()).includes("Earlier explanatory text is withheld"), `${candidate.key}: compatibility disclosure changed`);
  assert((await page.locator(".mr-cover-score").textContent()).trim() === candidate.score, `${candidate.key}: structured score changed`);
  const pdfPath = path.join(out, `${candidate.key}.pdf`);
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  const pdf = fs.readFileSync(pdfPath);
  assert(pdf.subarray(0, 5).toString("ascii") === "%PDF-", `${candidate.key}: invalid PDF`);
  assert(pdf.length > 18_000, `${candidate.key}: PDF unexpectedly small`);
  results.push({ key: candidate.key, pdf_bytes: pdf.length, notice_visible: true });
  await page.close();
}

console.log(JSON.stringify({ ok: true, reports: results }, null, 2));
await source.close();
await browser.close();
