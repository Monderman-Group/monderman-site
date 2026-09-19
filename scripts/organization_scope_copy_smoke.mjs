// Offline regression for the organization-scope copy amendment. No browser,
// account, model, API, or network requests; all negative controls stay in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assertInvitedEvaluationSourceContract,EVALUATION_BASELINE} from './invited_evaluation_source_contract.mjs';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const baseline = '80bf58384c641f1614280a34532bfcd8ec03d951';
const copyRelease = 'c6455b863d27e9ad6983d8ed878927734b1de97c';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const priorBytes = file => execFileSync('git', ['show', `${baseline}:${file}`], {cwd: root, maxBuffer: 16 * 1024 * 1024});
const prior = file => priorBytes(file).toString('utf8');
const currentPrior=file=>execFileSync('git',['show',EVALUATION_BASELINE+':'+file],{cwd:root,maxBuffer:16*1024*1024,encoding:'utf8'});
const historicalCopy=file=>execFileSync('git',['show',copyRelease+':'+file],{cwd:root,maxBuffer:16*1024*1024,encoding:'utf8'});
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
  check(!/\b500\b|30-day/.test(text)&&/60.day|60 days/i.test(text),file+': retired pilot cap and term removed');
  check(/unlimited/i.test(text)&&/no (?:per-run charge|per-run charges|card|credit card)/i.test(text),file+': value-first evaluation is stated');
  check(/abuse protections|automated or bulk use/i.test(text),file+': ordinary-use boundary retained');
  check(/\b(?:organizational scope|or the organization)\b/i.test(text), `${file}: broader defined scope remains available`);
}
const pilotOptions = html => html.match(/<select\b[^>]*\bid="participantGroupSize"[^>]*>[\s\S]*?<\/select>/)?.[0];
equal(pilotOptions(read('pilot.html')), pilotOptions(prior('pilot.html')), 'Pilot group-size form options and values unchanged');
check(pilotOptions(read('pilot.html')).includes('value="13-plus"'), 'Pilot form still accepts more than twelve people');

// The new evaluation replaces the former free tier; paid offers stay exact.
const numbers = html => publicText(html).match(/\$?\b\d[\d,]*(?:\.\d+)?%?/g) || [];
const withoutEntryForm=html=>html.replace(/<div class="pl-form">[\s\S]*?<\/div>\s*<style>/,'<style>');
for (const file of ['plan-signal.html','plan-pattern.html','plan-enterprise.html']) {
  equal(numbers(withoutEntryForm(read(file))),numbers(withoutEntryForm(currentPrior(file))),file+': paid prices, terms, seats and allowances unchanged outside replaced invitation entry');
}
const pricingCards=html=>html.match(/<div class="ps-tiers">[\s\S]*?<div class="ps-free">/)?.[0];
check(Boolean(pricingCards(read('platform-services.html'))),'Paid pricing cards exist');
equal(numbers(pricingCards(read('platform-services.html'))),numbers(pricingCards(currentPrior('platform-services.html'))),'All paid-card figures stay exact');
const entitlementCells=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .filter(row=>!row[0].includes('class="cta-row"'))
  .map(row=>[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>clean(cell[1])))
  .filter(cells=>cells.length===5).map(cells=>cells.slice(2));
check(entitlementCells(currentPrior('platform-services.html')).flat().length>40,'All three paid comparison columns are covered');
equal(entitlementCells(read('platform-services.html')),entitlementCells(currentPrior('platform-services.html')),'Every paid entitlement cell stays exact, including nonnumeric limits');

function descriptionsOnly(value) {
  if (Array.isArray(value)) return value.map(descriptionsOnly);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'description' && typeof item === 'string' ? '[copy description]' : descriptionsOnly(item)]));
}
function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(([, attrs, body]) => ({
    attrs: attrs.replace('homepage-workspace-demo.js?v=20260919.invitation1','homepage-workspace-demo.js?v=20260909-workspace1'),
    body: /\btype=["']application\/ld\+json["']/i.test(attrs) ? descriptionsOnly(JSON.parse(body)) : body,
  }));
}
const styles = html => [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(match => match[0]);
for (const file of marketing) {
  if(file!=='pattern-trial.html')equal(scripts(read(file)),scripts(currentPrior(file)),file+': executable scripts unchanged; only JSON-LD descriptions may vary');
  if(file!=='pattern-trial.html')equal(styles(read(file)),styles(currentPrior(file)),file+': embedded styles unchanged');
}

const currentProtection=assertInvitedEvaluationSourceContract(root);
readPublicSampleFixture({root});checks++;
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
equal(historicalCopy(template).split(newPreview).length - 1,1,'Historical copy release had one organization-scope preview sentence');
check(read(template).includes('See the work from more than one position.')&&read(template).includes('organizational evaluation'),'Current preview retains organizational scope throughout its new business-case story');
equal(historicalCopy(template).replace(newPreview, oldPreview), prior(template), 'Only approved preview-template copy differs from baseline');
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(historicalCopy('sample-data/production-sample-release.json'));
const priorManifest = JSON.parse(prior('sample-data/production-sample-release.json'));
equal(manifest.source_files[template], digest(historicalCopy(template)), 'Historical template pin matches the reviewed copy');
equal(manifest.organization_scope_copy_review.prior_template_sha256, digest(prior(template)), 'Copy amendment preserves the previous template identity');
equal(manifest.organization_scope_copy_review.current_template_sha256, digest(historicalCopy(template)), 'Copy amendment records the new template identity');
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
console.log(JSON.stringify({passed: true, checks, protectedFiles: protectedFiles.length, currentProtection, baseline, copyRelease, scope: 'Current public copy and commercial limits; historical copy-release behavior boundary.'}));
