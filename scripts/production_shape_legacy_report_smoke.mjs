import fs from "node:fs";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.REPORT_BASE || "http://127.0.0.1:8080";
const input = process.env.REPORT_SHAPES || "/tmp/monderman-production-report-shapes-deidentified.json";
const out = process.env.REPORT_OUT || "/tmp/monderman-production-shape-report-qa";
fs.mkdirSync(out, { recursive: true });

function assert(value, message) {
  if (!value) throw new Error(message);
}

const artifact = JSON.parse(fs.readFileSync(input, "utf8"));
assert(artifact.containsRawCustomerText === false, "QA input must be deidentified");
assert(Array.isArray(artifact.reports) && artifact.reports.length === 5, "five representative reports are required");

const browser = await chromium.launch({ headless: true });
const source = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await source.goto(`${base}/sample-report.html`, { waitUntil: "networkidle", timeout: 90_000 });

const results = [];
for (const candidate of artifact.reports) {
  const html = await source.evaluate(({ kind, result }) => {
    const report = kind === "synthesis"
      ? window.MondermanReport.fromSynthesis(result)
      : window.MondermanReport.fromRun(result);
    return window.MondermanReport.buildReportHtml(report);
  }, candidate);
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  const notice = page.locator(".mr-compatibility-notice");
  assert(await notice.isVisible(), `${candidate.key}: compatibility notice is missing`);
  assert((await notice.textContent()).includes("Earlier explanatory text is withheld"), `${candidate.key}: compatibility disclosure changed`);
  const bodyText = await page.locator("body").innerText();
  assert(bodyText.trim().length > 250, `${candidate.key}: rendered report is unexpectedly empty`);
  assert(!/undefined|nullnull|\[object Object\]/i.test(bodyText), `${candidate.key}: serialization artifact is visible`);
  const pageCount = await page.locator(".mr-page").count();
  assert(pageCount >= 1, `${candidate.key}: report page wrapper is missing`);
  const coverScore = (await page.locator(".mr-cover-score").textContent()).trim();
  assert(coverScore.length > 0, `${candidate.key}: cover score is empty`);
  if (candidate.kind === "synthesis") {
    assert((await page.locator(".mr-system-score").textContent()).trim() === "N/A", `${candidate.key}: withheld hub score must not clip`);
  }
  const screenshotPath = path.join(out, `${candidate.key}-cover.png`);
  await page.locator(".mr-page").first().screenshot({ path: screenshotPath });
  const pdfPath = path.join(out, `${candidate.key}.pdf`);
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true });
  const pdf = fs.readFileSync(pdfPath);
  assert(pdf.subarray(0, 5).toString("ascii") === "%PDF-", `${candidate.key}: invalid PDF`);
  assert(pdf.length > 18_000, `${candidate.key}: PDF unexpectedly small`);
  results.push({
    key: candidate.key,
    source_id_sha256: candidate.source_id_sha256,
    compatibility_redactions: candidate.compatibility_redactions,
    cover_score: coverScore,
    rendered_pages: pageCount,
    body_characters: bodyText.length,
    pdf_bytes: pdf.length,
    notice_visible: true
  });
  await page.close();
}

console.log(JSON.stringify({ ok: true, input_deidentified: true, reports: results }, null, 2));
await source.close();
await browser.close();
