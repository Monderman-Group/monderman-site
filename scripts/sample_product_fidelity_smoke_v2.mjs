import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';
const out = process.env.SAMPLE_OUT || '/tmp/sample-product-fidelity-smoke';
fs.mkdirSync(out, { recursive: true });

const expectedEngine = '379ff62eee8157efe0115ee825933adbefc493d2';
const expectedArtifact = '611188e3ab10e20c62a3229604f03dbf39d6fa02f2ed14ffa2d787a55681b982';
const expected = {
  os: { source: 'operational_systems', score: '44', dimensions: 6 },
  dv: { source: 'decision_velocity', score: '51', dimensions: 4 },
  sc: { source: 'structural_clarity', score: '51', dimensions: 5 },
  ip: { source: 'institutional_performance', score: '48', dimensions: 6 },
};

function assert(value, message) {
  if (!value) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' && !/supabase|connect|assistant/i.test(message.text())) errors.push(`console: ${message.text()}`);
});

await page.goto(`${base}/sample-report.html#os`, { waitUntil: 'networkidle', timeout: 90000 });
await page.locator('body.production-samples-ready').waitFor({ state: 'attached', timeout: 30000 });

for (const [key, contract] of Object.entries(expected)) {
  await page.locator(`#tab-${key}`).click();
  const shell = page.locator(`#report-${key}`);
  assert(await shell.isVisible(), `${key} report shell is not visible`);
  const report = shell.locator('.psr-wrap');
  assert(await report.count() === 1, `${key} production-contract report is missing or duplicated`);
  assert(await report.getAttribute('data-engine-commit') === expectedEngine, `${key} engine revision mismatch`);
  assert(await report.getAttribute('data-artifact-sha256') === expectedArtifact, `${key} artifact digest mismatch`);
  assert(await report.getAttribute('data-source-key') === contract.source, `${key} source identity mismatch`);
  assert((await shell.locator('.psr-score strong').innerText()).trim() === contract.score, `${key} generated score mismatch`);
  assert(await shell.locator('.psr-dimension').count() === contract.dimensions, `${key} generated dimension count mismatch`);
  assert(await shell.locator('.psr-remedy').count() === 3, `${key} must show three engine-generated remedy paths`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy hand-authored report remains in the live DOM`);
  const text = await shell.innerText();
  for (const token of [
    'Production-engine-generated representative output', 'Executive headline', 'What this run returned',
    'The scored condition, dimension by dimension', 'How the disclosed scenario becomes exposure',
    'What leadership should—and should not—take from the read', 'What evidence is—and is not—in this run',
    'Priorities and remedy paths returned by the engine', 'Basis of this read', 'Interpretation boundary',
    'No participant notes were supplied', 'no invented participant statements',
  ]) assert(text.includes(token), `${key} missing production-equivalent content: ${token}`);
  for (const stale of ['Competing readings', 'What would update this read', 'Sample Depth Synthesis Report']) {
    assert(!text.includes(stale), `${key} still renders outdated content: ${stale}`);
  }
  assert(await shell.getByRole('button', { name: 'Download representative JSON' }).isVisible(), `${key} JSON control missing`);
  assert(await shell.getByRole('button', { name: 'Print or save PDF' }).isVisible(), `${key} print/PDF control missing`);
  await page.screenshot({ path: path.join(out, `${key}-desktop.png`), fullPage: true });
}

await page.locator('#tab-synthesis').click();
const cross = page.locator('#report-synthesis');
const crossText = await cross.innerText();
for (const token of ['Cross-Lens Composite Score', '55.5', 'Strong', 'Equal-lens mean', 'Source-backed remedy paths', 'Interpretation boundary']) {
  assert(crossText.includes(token), `Cross-Lens sample missing ${token}`);
}
assert(await cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]').isVisible(), 'Cross-Lens comparison visual is not visible');

await page.locator('#tab-depth').click();
const depth = page.locator('#report-depth');
const depthText = await depth.innerText();
for (const token of ['Median Diagnostic Score', '56', 'Substantial', '18', 'Observed participant distribution', 'Interpretation boundary']) {
  assert(depthText.includes(token), `Depth sample missing ${token}`);
}
assert(await depth.locator('svg[aria-label="Depth Synthesis score distribution"]').isVisible(), 'Depth distribution visual is not visible');

await page.setViewportSize({ width: 390, height: 844 });
for (const key of ['os', 'dv', 'sc', 'ip', 'synthesis', 'depth']) {
  await page.locator(`#tab-${key}`).click();
  const fit = await page.locator(`#report-${key}`).evaluate((shell) => ({
    shellClient: shell.clientWidth,
    shellScroll: shell.scrollWidth,
    rootClient: document.documentElement.clientWidth,
    rootScroll: document.documentElement.scrollWidth,
  }));
  assert(fit.shellScroll <= fit.shellClient, `${key} report overflows its 390px shell`);
  assert(fit.rootScroll <= fit.rootClient, `${key} creates horizontal page overflow at 390px`);
}
await page.locator('#tab-os').click();
await page.screenshot({ path: path.join(out, 'os-390px.png'), fullPage: true });

await page.emulateMedia({ media: 'print' });
assert(await page.locator('#report-os .psr-report').isVisible(), 'Diagnostic report disappears in print media');
assert(await page.locator('#report-os .psr-toolbar').isVisible() === false, 'interactive toolbar remains visible in print media');
await page.emulateMedia({ media: 'screen' });

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
  ok: true,
  engine_commit: expectedEngine,
  artifact_sha256: expectedArtifact,
  diagnostic_products: 4,
  synthesis_products: 2,
  responsive_width: 390,
  console_errors: errors,
}, null, 2));
console.log('PRODUCTION_SAMPLE_PRODUCT_FIDELITY_PASS_6_OF_6');
await browser.close();
