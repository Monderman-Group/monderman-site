import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.SAMPLE_BASE || 'http://127.0.0.1:8080';
const out = process.env.SAMPLE_OUT || '/tmp/sample-product-fidelity-smoke';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

function assert(ok, msg) { if (!ok) throw new Error(msg); }
async function openTab(key) {
  await page.locator(`[data-target="${key}"]`).click();
  await page.waitForTimeout(300);
  const shell = page.locator(`[data-report="${key}"]`);
  assert(await shell.isVisible(), `${key} shell not visible`);
  return shell;
}

async function verifyCanonicalCapacityGraphic(shell, key, expected) {
  const canonical = shell.locator(`#${key}-headline .sample-exposure-bridge[role="img"]`);
  assert(await canonical.count() === 1, `${key} canonical capacity-allocation graphic missing or ambiguous`);
  assert(await canonical.isVisible(), `${key} canonical capacity-allocation graphic not visible`);
  const label = await canonical.getAttribute('aria-label');
  assert(label?.startsWith('Source-backed exposure bridge:'), `${key} canonical capacity-allocation graphic lacks its semantic label`);
  const text = await canonical.textContent();
  assert(text.includes('Source-backed exposure bridge'), `${key} canonical capacity-allocation title missing`);
  for (const token of expected) assert(text.includes(token), `${key} canonical capacity-allocation content missing: ${token}`);

  const superseded = shell.locator(
    `#${key}-headline .panel[hidden][aria-hidden="true"]:has(svg[aria-label="Capacity allocation"])`
  );
  assert(await superseded.count() === 1, `${key} superseded capacity panel is not uniquely hidden from users and assistive technology`);
  assert(!(await superseded.isVisible()), `${key} superseded capacity panel is exposed`);
}

await page.goto(`${base}/sample-report.html`, { waitUntil: 'networkidle', timeout: 90000 });
const bodyText = await page.locator('body').textContent();
assert(bodyText.includes('Representative product outputs — not customer data.'), 'representative-output disclosure missing');
assert(!/\bseat(?:s|-year)?\b/i.test(bodyText), 'seat vocabulary remains');
assert(!/Insight depth/i.test(bodyText), 'Insight depth remains');
assert(!bodyText.includes('Against comparable institutions'), 'empirical peer-comparison claim remains in sample');
assert(!bodyText.includes('likely to continue accumulating'), 'single-run predictive trajectory claim remains in sample');
assert(bodyText.includes('return time, money, and productive capacity to the organization'), 'canonical organizational value statement missing');
for (const stale of ['Operational creep is rising', 'Rising drag pressure', 'Rising strain']) {
  assert(!bodyText.includes(stale), `condition-direction wording remains in sample: ${stale}`);
}
for (const stale of ['Senior hours returned to mission', 'senior time returns to mission', 'Treat senior attention as a scarce operating resource', 'spending its scarcest resource', 'Leadership bottom line', 'Bottom line for leadership']) {
  assert(!bodyText.toLowerCase().includes(stale.toLowerCase()), `role-centric value framing remains: ${stale}`);
}

const diagnostics = [
  ['os', 'Governance weight × execution responsiveness', 'Burden composition', 'Self-reported change.', 'Worsening', '5,280 annual burden hours', 'Productive work 76%', 'Recoverable drag 8%', '$485,760 / yr measured burden'],
  ['dv', 'Governance weight × execution responsiveness', 'Drag composition', 'Self-reported change.', 'Worsening', '3,128 annual burden hours', 'Productive work 78%', 'Recoverable drag 5%', '$344,080 / yr measured burden'],
  ['sc', 'Governance weight × structural legibility', 'Clarity readings', 'Change-pressure risk.', 'No elevated change-pressure signal.', '960 annual burden hours', 'Productive work 93%', 'Recoverable drag 2%', '$74,880 / yr measured burden'],
  ['ip', 'Institutional condition × compensatory dependence', 'Burden composition', 'Self-reported change.', 'Worsening', '8,448 annual burden hours', 'Productive work 74%', 'Recoverable drag 9%', '$844,800 / yr measured burden'],
];
for (const [key, quadrantHeading, compositionHeading, changeLabel, changeState, hoursToken, productiveToken, recoverableToken, coverCostToken] of diagnostics) {
  const shell = await openTab(key);
  const txt = await shell.textContent();
  assert(txt.includes(quadrantHeading), `${key} quadrant heading mismatch`);
  assert(txt.includes(compositionHeading), `${key} missing ${compositionHeading}`);
  assert(txt.includes('Where to focus first'), `${key} missing Where to focus first`);
  assert(txt.includes(changeLabel), `${key} missing bounded single-run change label`);
  assert(txt.includes(changeState), `${key} change-state language mismatch: ${changeState}`);
  assert(txt.includes(hoursToken), `${key} sample economics not current: ${hoursToken}`);
  assert(txt.includes(productiveToken), `${key} capacity allocation not current: ${productiveToken}`);
  assert(txt.includes(recoverableToken), `${key} recoverable capacity allocation not current: ${recoverableToken}`);
  const coverText = await shell.locator(`#${key}-cover`).textContent();
  assert(coverText.includes(coverCostToken), `${key} cover economics disagree with the report body: ${coverCostToken}`);
  const quadrant = shell.locator(`#${key}-quadrant .sample-quadrant`);
  assert(await quadrant.isVisible(), `${key} quadrant graphic not visible`);
  assert(await quadrant.locator('.sample-quadrant-dot').isVisible(), `${key} quadrant dot not visible`);
  assert(await shell.locator('svg[aria-label="Burden composition — share of total"]').first().isVisible(), `${key} share graphic not visible`);
  assert(await shell.locator('svg[aria-label="Burden severity by dimension"]').first().isVisible(), `${key} severity graphic not visible`);
  assert(await shell.locator('svg[aria-label="Intervention order"]').first().isVisible(), `${key} intervention graphic not visible`);
  assert(await shell.locator('svg[aria-label="Score in sector context"]').first().isVisible(), `${key} score-context graphic not visible`);
  const canonicalCapacity = {
    os: ['5,280 hrs', '$485,760', '24%', 'Directional scenario—not an audited time study.'],
    dv: ['3,128 hrs', '$344,080', '22%', 'Directional scenario—not an audited time study.'],
    sc: ['960 hrs', '$74,880', '7%', 'Directional scenario—not an audited time study.'],
    ip: ['8,448 hrs', '$844,800', '26%', 'Directional scenario—not an audited time study.'],
  };
  await verifyCanonicalCapacityGraphic(shell, key, canonicalCapacity[key]);
  await page.screenshot({ path: path.join(out, `${key}.png`), fullPage: true });
}

const osShell = await openTab('os');
const osCanonical = osShell.locator('#os-headline .sample-exposure-bridge[role="img"]');
await osCanonical.evaluate(node => { node.hidden = true; });
let hiddenCanonicalRejected = false;
try {
  await verifyCanonicalCapacityGraphic(osShell, 'os', ['5,280 hrs', '$485,760', '24%', 'Directional scenario—not an audited time study.']);
} catch (error) {
  hiddenCanonicalRejected = /canonical capacity-allocation graphic not visible/.test(error.message);
}
await osCanonical.evaluate(node => { node.hidden = false; });
assert(hiddenCanonicalRejected, 'deliberately hidden canonical capacity-allocation graphic was not rejected');
await verifyCanonicalCapacityGraphic(osShell, 'os', ['5,280 hrs', '$485,760', '24%', 'Directional scenario—not an audited time study.']);

const ipText = await (await openTab('ip')).textContent();
assert(ipText.includes('Degraded institutional condition'), 'IP score 47 is not using current certified band');
assert(ipText.includes('Against the Monderman instrument design reference'), 'IP sample design-reference language missing');

const cross = await openTab('synthesis');
const crossText = await cross.textContent();
for (const token of ['Cross-Lens Composite Score','Strong','55.5','Structural Clarity','Decision Velocity','Operational Systems','Institutional Performance','Executive synthesis','Agreements and differences','Evidence-proportionate actions','What to watch next','Equal-lens mean','Organizational implication','return time, money, and productive capacity to the organization']) assert(crossText.includes(token), `Cross-Lens missing ${token}`);
const crossScoreLabel = await cross.locator('.mr-cover-score-label').first().textContent();
assert(crossScoreLabel.includes('Cross-Lens Composite Score'), 'Cross-Lens cover does not show the published Composite Score label');
const crossCondition = await cross.locator('.mr-cover-score-band').first().textContent();
assert(!/withheld/i.test(crossCondition), 'Cross-Lens cover still shows a withheld Composite Score');
assert(await cross.locator('svg[aria-label="Cross-Lens Diagnostic score comparison"]').isVisible(), 'Cross-Lens comparison visual not visible');
await page.screenshot({ path: path.join(out, 'synthesis.png'), fullPage: true });

const depth = await openTab('depth');
const depthText = await depth.textContent();
for (const token of ['Median Diagnostic Score','Substantial','18','56','Observed participant distribution','Operational','Managerial','Senior Leader','15.8','Executive synthesis','Agreements and differences','Evidence-proportionate actions','What to watch next','32 additional unique runs']) assert(depthText.includes(token), `Depth missing ${token}`);
assert(await depth.locator('svg[aria-label="Depth Synthesis score distribution"]').isVisible(), 'Depth distribution visual not visible');
await page.screenshot({ path: path.join(out, 'depth.png'), fullPage: true });

assert(errors.length === 0, errors.join('\n'));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ ok: true, diagnostic_tabs: 4, synthesis_tabs: 2, current_capacity_allocation: true, hidden_canonical_regression_rejected: true, bounded_single_run_change: true, cover_body_economics_parity: true, console_errors: errors }, null, 2));
console.log('SAMPLE_PRODUCT_FIDELITY_RENDER_PASS_6_OF_6');
await browser.close();
