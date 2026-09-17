// Offline regression for the organization-scope copy amendment. No browser,
// account, model, API, or network requests; all negative controls stay in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const baseline = '80bf58384c641f1614280a34532bfcd8ec03d951';
const copyRelease = 'c6455b863d27e9ad6983d8ed878927734b1de97c';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const priorBytes = file => execFileSync('git', ['show', `${baseline}:${file}`], {cwd: root, maxBuffer: 16 * 1024 * 1024});
const prior = file => priorBytes(file).toString('utf8');
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const check = (value, label) => { assert.ok(value, label); checks++; };
const marketing = [
  'index.html', 'diagnostics.html', 'Monderman_Platform_Brief.html',
  'platform-services.html', 'plan-signal.html', 'plan-pattern.html', 'plan-enterprise.html',
  'pilot.html', 'pattern-trial.html', 'connect.html', 'why-monderman.html', 'roi.html',
  'sample-report.html', 'new-in-the-role.html', 'after-an-acquisition.html',
  'after-a-reorganization.html', 'transformation-behind-schedule.html',
  'research.html', 'checkout-success.html',
];
const entities = {'&nbsp;': ' ', '&amp;': '&', '&middot;': '·', '&rsquo;': "'", '&#39;': "'", '&quot;': '"', '&ndash;': '–', '&mdash;': '—'};
const clean = value => value.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|middot|rsquo|quot|ndash|mdash);|&#39;/g, match => entities[match]).replace(/\s+/g, ' ').trim();
function publicText(html) {
  // The source footer is replaced by site-shell/footer.html in the build.
  const body = html.replace(/<(script|style|footer|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const metadata = [...body.matchAll(/<meta\b[^>]*\bcontent=(["'])([\s\S]*?)\1[^>]*>/gi)].map(match => match[2]);
  return clean(body) + ' ' + metadata.map(clean).join(' ');
}
// Target obsolete general product claims, while allowing real teams in examples,
// respondent context, support, legal review, Workspace seats and sample reports.
const retiredClaims = /\b(?:individual and team (?:views|reports)|from one report to a team view|(?:a|one) team campaign|team (?:campaigns|reports|responses|synthesis)|structured for teams|team-level features|run Monderman across one team|choose by team size|Signal\s*·\s*for a team|start with one organizational question and a small team|invite the right team)\b/i;
function assertScopeCopy(html, label) {
  assert.doesNotMatch(publicText(html), retiredClaims, `${label}: retired general team-only positioning`);
}
for (const file of marketing) { assertScopeCopy(read(file), file); checks++; }
assertScopeCopy(read('site-shell/footer.html').replace(/<\/?footer\b[^>]*>/gi, ''), 'canonical footer'); checks++;
for (const file of ['index.html', 'diagnostics.html', 'Monderman_Platform_Brief.html']) {
  const text = publicText(read(file));
  check(/\b(?:across (?:your |the |an )?organization|organizational view|whole organization)\b/i.test(text), `${file}: explicit organization-wide positioning`);
  check(/\bdepartments?\b/i.test(text) && /\bdivisions?\b/i.test(text), `${file}: organizational scale includes departments and divisions`);
}
for (const file of ['pilot.html', 'pattern-trial.html']) {
  const text = publicText(read(file));
  check(!/\bsmall team\b/i.test(text), `${file}: pilot is not positioned as small-team use`);
  check(/\b(?:six to twelve|6 to 12)\b/i.test(text), `${file}: starting-group example retained`);
  check(/\bnot a (?:hard cap|participant limit|limit)\b/i.test(text), `${file}: suggested headcount is not a cap`);
  check(/\b500\b/.test(text) && /\bshared allowance\b/i.test(text), `${file}: actual shared pilot response allowance retained`);
  check(/\b(?:organizational scope|or the organization)\b/i.test(text), `${file}: broader defined scope remains available`);
}
const pilotOptions = html => html.match(/<select\b[^>]*\bid="participantGroupSize"[^>]*>[\s\S]*?<\/select>/)?.[0];
equal(pilotOptions(read('pilot.html')), pilotOptions(prior('pilot.html')), 'Pilot group-size form options and values unchanged');
check(pilotOptions(read('pilot.html')).includes('value="13-plus"'), 'Pilot form still accepts more than twelve people');

// Preserve every displayed number and currency amount on the paid plan pages.
// Also pin each comparison-table entitlement cell, including nonnumeric limits.
const numbers = html => publicText(html).match(/\$?\b\d[\d,]*(?:\.\d+)?%?/g) || [];
for (const file of ['platform-services.html', 'plan-signal.html', 'plan-pattern.html', 'plan-enterprise.html']) {
  equal(numbers(read(file)), numbers(prior(file)), `${file}: prices, terms, seat counts and numerical allowances unchanged`);
}
const entitlementCells = html => [...html.replace(/<tr><td class="rowlabel">Best for<\/td>[\s\S]*?<\/tr>/g, '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
  .filter(match => !/\browlabel\b/.test(match[1])).map(match => clean(match[2]));
check(entitlementCells(prior('platform-services.html')).length > 40, 'Full plan comparison table is covered');
equal(entitlementCells(read('platform-services.html')), entitlementCells(prior('platform-services.html')), 'Every paid comparison-table entitlement unchanged');

function descriptionsOnly(value) {
  if (Array.isArray(value)) return value.map(descriptionsOnly);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'description' && typeof item === 'string' ? '[copy description]' : descriptionsOnly(item)]));
}
function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(([, attrs, body]) => ({
    attrs,
    body: /\btype=["']application\/ld\+json["']/i.test(attrs) ? descriptionsOnly(JSON.parse(body)) : body,
  }));
}
const styles = html => [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => match[0]);
for (const file of marketing) {
  equal(scripts(read(file)), scripts(prior(file)), `${file}: executable scripts unchanged; only JSON-LD descriptions may vary`);
  equal(styles(read(file)), styles(prior(file)), `${file}: embedded styles unchanged`);
}

const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline], {cwd: root, encoding: 'utf8'}).trim().split('\n');
const instruments = ['decision-velocity.html', 'structural-clarity.html', 'operational-systems.html', 'institutional-performance.html'];
const protectedFiles = tracked.filter(file =>
  (!file.includes('/') && /\.(?:js|css)$/.test(file)) || instruments.includes(file) ||
  /^workspace[^/]*\.html$/.test(file) || /^(?:privacy|terms)(?:-[^/]*)?\.html$/.test(file) ||
  file.startsWith('sample-data/reports/') || file === 'sample-data/production-diagnostic-samples.json' ||
  ['scripts/refresh_public_sample_previews.mjs', 'scripts/public_sample_fixture.mjs', 'scripts/inject-public-shell.mjs', 'checkout.html', 'legal-document-manifest.json'].includes(file));
// This assertion certifies the completed copy-only transaction, not a permanent
// ban on future reviewed runtime fixes. Current copy and commercial checks above
// still run against HEAD; behavior has its own dedicated regression suites.
for (const file of protectedFiles) equal(execFileSync('git', ['show', `${copyRelease}:${file}`], {cwd: root, maxBuffer: 16 * 1024 * 1024}), priorBytes(file), `${file}: copy release preserved diagnostic, Workspace, report, sample, policy or style bytes`);
const template = 'scripts/templates/home-workspace-preview.html';
const oldPreview = 'Choose a diagnostic for a team, unit, or decision path.';
const newPreview = 'Choose a diagnostic for a defined part of your organization.';
equal(read(template).split(newPreview).length - 1, 1, 'One organization-scope preview sentence');
equal(read(template).replace(newPreview, oldPreview), prior(template), 'Only approved preview-template copy differs from baseline');
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(read('sample-data/production-sample-release.json'));
const priorManifest = JSON.parse(prior('sample-data/production-sample-release.json'));
equal(manifest.source_files[template], digest(read(template)), 'Current template pin matches the reviewed copy');
equal(manifest.organization_scope_copy_review.prior_template_sha256, digest(prior(template)), 'Copy amendment preserves the previous template identity');
equal(manifest.organization_scope_copy_review.current_template_sha256, digest(read(template)), 'Copy amendment records the new template identity');
delete manifest.organization_scope_copy_review;
manifest.source_files[template] = priorManifest.source_files[template];
equal(manifest, priorManifest, 'Sample generation, original acceptance, figures and all other reviewed source pins are preserved');

// Exercise the guard against restored product narrowing in visible copy and
// metadata, without changing any repository file or approved sample evidence.
const accepted = read('index.html');
for (const [label, mutation] of [
  ['visible heading', accepted.replace('</main>', '<h2>Structured for teams</h2></main>')],
  ['metadata', accepted.replace('</head>', '<meta name="description" content="Individual and team reports"></head>')],
]) {
  check(mutation !== accepted, `${label}: negative control changes the actual page`);
  assert.throws(() => assertScopeCopy(mutation, label), /retired general team-only positioning/); checks++;
}
assertScopeCopy('<p>Compare teams, departments and divisions. Your legal team can review the terms. Team-level examples use stated assumptions.</p>', 'specific-team positive control'); checks++;
console.log(JSON.stringify({passed: true, checks, protectedFiles: protectedFiles.length, baseline, copyRelease, scope: 'Current public copy and commercial limits; historical copy-release behavior boundary.'}));
