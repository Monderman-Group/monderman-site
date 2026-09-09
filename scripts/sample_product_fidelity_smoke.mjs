import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';
const out = process.env.SAMPLE_OUT || '/tmp/sample-product-fidelity-smoke';
fs.mkdirSync(out, { recursive: true });

const expectedEngine = '07328e2a15ee16262e98e573e97c6bfd65659260';
const expectedArtifact = '447cdd78f6fceecdecfdd8f31ef99de048b96aace73de835757ff51cc79be6d7';
const diagnostics = {
  os:{score:'44',dimensions:6}, dv:{score:'51',dimensions:4},
  sc:{score:'51',dimensions:5}, ip:{score:'48',dimensions:6},
};

function assert(ok, msg) { if (!ok) throw new Error(msg); }
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:1440, height:1100 } });
const errors = [];
// Match the newer fidelity harness: exported HTML uses absolute font URLs,
// while localhost must exercise the candidate fonts without production CORS.
await page.route(/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/, async route => {
  const filename = new URL(route.request().url()).pathname.slice(1);
  await route.fulfill({status:200,contentType:'font/woff2',body:fs.readFileSync(path.resolve(filename))});
});
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' && !/supabase|connect|assistant/i.test(message.text())) errors.push(`console: ${message.text()}`);
});

await page.goto(`${base}/sample-report.html`, { waitUntil:'networkidle', timeout:90000 });
await page.locator('body.production-samples-ready').waitFor({ state:'attached', timeout:30000 });
assert((await page.locator('body').textContent()).includes('Representative product outputs, not customer data.'), 'representative-output disclosure missing');

for (const [key, contract] of Object.entries(diagnostics)) {
  await page.locator(`#tab-${key}`).click();
  const shell = page.locator(`#report-${key}`);
  const wrapper = shell.locator('.psr-wrap');
  assert(await wrapper.getAttribute('data-engine-commit') === expectedEngine, `${key} engine provenance mismatch`);
  assert(await wrapper.getAttribute('data-artifact-sha256') === expectedArtifact, `${key} artifact provenance mismatch`);
  assert(await shell.locator('.mr-report').isVisible(), `${key} shared engine report missing`);
  assert(await shell.locator('.mr-run-decision').evaluate(el => el === el.parentElement.querySelector('.mr-section')), `${key} executive brief is not first`);
  assert((await shell.locator('.mr-run-score-stamp strong').textContent()).trim() === contract.score, `${key} score mismatch`);
  assert(await shell.locator('.mr-dimension-row').count() === contract.dimensions, `${key} dimension profile mismatch`);
  assert(await shell.locator('.mr-constraint-view').isVisible(), `${key} constraint concentration missing`);
  assert(await shell.locator('.mr-exposure-flow').isVisible(), `${key} capacity/burden view missing`);
  assert(await shell.locator('.mr-priority-matrix').isVisible(), `${key} priority matrix missing`);
  assert(await shell.locator('.mr-run-remedy').count() === 3, `${key} intervention paths changed`);
  assert(await shell.locator('.mr-run-remedy .mr-remedy-evidence').count() === 0, `${key} invents an option-to-priority evidence pairing`);
  assert((await shell.locator('.mr-run-action-board .mr-lede').textContent()).includes('do not correspond one-to-one'), `${key} independent option/priority disclosure missing`);
  assert(await shell.locator('.mr-leadership-close').evaluate(el => el === el.parentElement.querySelector('.mr-section:last-of-type')), `${key} leadership handoff is not final`);
  assert(await shell.locator('.cover').count() === 0, `${key} legacy hand-authored sample remains in the live DOM`);
  const text = await shell.textContent();
  assert(!/\[object Object\]|\bundefined\b|\bNaN\b|None of this looks like an emergency/i.test(text), `${key} invalid or rejected prose remains`);
  await page.screenshot({ path:path.join(out, `${key}.png`), fullPage:true });
}

await page.locator('#tab-synthesis').click();
const cross = page.locator('#report-synthesis');
for (const token of ['Cross-Lens Composite Score','55.5','Equal-lens mean','Lens interaction evidence','Evidence-proportionate actions','Interpretation boundary']) {
  assert((await cross.textContent()).includes(token), `Cross-Lens missing ${token}`);
}
assert(!(await cross.textContent()).includes('Source-backed remedy paths'), 'Cross-Lens rendered remedy prose that its source-prose contract withholds');
assert(await cross.locator('.mr-remedy-card').count() === 0, 'Cross-Lens rendered remedy cards without eligible source prose');
assert(await cross.locator('svg[aria-label="Four Diagnostic lenses connected to the equal-lens Cross-Lens Composite Score"]').isVisible(), 'Cross-Lens systems view missing');

await page.locator('#tab-depth').click();
const depth = page.locator('#report-depth');
for (const token of ['Median Diagnostic Score','56','Agreement, divergence, and coverage','15.8','Evidence-proportionate actions','Interpretation boundary']) {
  assert((await depth.textContent()).includes(token), `Depth missing ${token}`);
}
assert(!(await depth.textContent()).includes('Source-backed remedy paths'), 'Depth rendered remedy prose that its source-prose contract withholds');
assert(await depth.locator('.mr-remedy-card').count() === 0, 'Depth rendered remedy cards without eligible source prose');
assert(await depth.locator('svg[aria-label="Depth Synthesis score distribution"]').isVisible(), 'Depth distribution missing');

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
  ok:true, shared_single_lens_renderer:'MondermanReport.fromRun', diagnostic_products:4,
  synthesis_products:2, engine_commit:expectedEngine, artifact_sha256:expectedArtifact,
}, null, 2));
console.log('SAMPLE_PRODUCT_FIDELITY_RENDER_PASS_6_OF_6');
await browser.close();
