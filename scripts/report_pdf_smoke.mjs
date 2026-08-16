import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-presentation-smoke';
fs.mkdirSync(out, { recursive: true });

function assert(ok, msg) { if (!ok) throw new Error(msg); }
function isMondermanFont(font) { return /Neue Haas Grotesk/i.test(font); }

const browser = await chromium.launch({ headless: true });
const source = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await source.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });

const html = await source.evaluate(() => {
  const fixtures = window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES;
  return {
    cross: window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(fixtures.crossLens)),
    depth: window.MondermanReport.buildReportHtml(window.MondermanReport.fromSynthesis(fixtures.depth)),
  };
});

async function certifyPdf({ key, reportHtml, chartLabel, expectedScore, expectedVisual }) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  await page.setContent(reportHtml, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  const reportFont = await page.locator('.mr-report').evaluate(el => getComputedStyle(el).fontFamily);
  assert(isMondermanFont(reportFont), `${key} standalone report is not using Neue Haas Grotesk: ${reportFont}`);
  const fontLoaded = await page.evaluate(() => document.fonts ? document.fonts.check('16px "Neue Haas Grotesk"') : true);
  assert(fontLoaded, `${key} Neue Haas Grotesk face did not load before PDF render`);

  assert((await page.locator('.mr-cover-score').textContent()).trim() === expectedScore, `${key} PDF source score changed`);
  const chart = page.locator(`svg[aria-label="${chartLabel}"]`);
  assert(await chart.isVisible(), `${key} evidence chart is not visible before PDF render`);
  const chartFont = await chart.evaluate(el => getComputedStyle(el).fontFamily);
  assert(isMondermanFont(chartFont), `${key} evidence chart is not using Neue Haas Grotesk before PDF render: ${chartFont}`);
  assert(await page.locator(expectedVisual).isVisible(), `${key} expected report visual ${expectedVisual} is not visible before PDF render`);
  assert(await page.locator('.mr-cover .mr-cover-boundary').isVisible(), `${key} cover interpretation boundary missing before PDF render`);
  assert(await page.locator('.mr-report-boundary').isVisible(), `${key} end interpretation boundary missing before PDF render`);

  const pdfPath = path.join(out, `${key}-executive-report.pdf`);
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.3in', right: '0.3in', bottom: '0.3in', left: '0.3in' },
  });
  const bytes = fs.readFileSync(pdfPath);
  assert(bytes.subarray(0, 5).toString('ascii') === '%PDF-', `${key} output is not a valid PDF header`);
  assert(bytes.length > 50000, `${key} PDF is unexpectedly small (${bytes.length} bytes); visual content may be missing`);

  await page.close();
  return { bytes: bytes.length, font: reportFont, chartFont };
}

const cross = await certifyPdf({
  key: 'cross-lens',
  reportHtml: html.cross,
  chartLabel: 'Cross-Lens Diagnostic score comparison',
  expectedScore: '55.5',
  expectedVisual: '.mr-cross-lens-map',
});
const depth = await certifyPdf({
  key: 'depth',
  reportHtml: html.depth,
  chartLabel: 'Depth Synthesis score distribution',
  expectedScore: '56',
  expectedVisual: '.mr-viz-panel',
});

fs.writeFileSync(path.join(out, 'pdf-result.json'), JSON.stringify({
  ok: true,
  cross,
  depth,
  pdfChartsCertified: true,
  neueHaasLoadedBeforePdf: true,
}, null, 2));

console.log('REPORT_PDF_RENDER_PASS');
await source.close();
await browser.close();
