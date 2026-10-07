// Verify the finite fifth-part publication independently of historical approvals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  HOLD_COLLIDE_PUBLICATION_BASELINE,
  HOLD_COLLIDE_PUBLICATION_FILES,
  holdCollidePublicationDelta,
  sourceBeforeHoldCollidePublication20261001,
  sourceAtHoldCollidePublicationBaseline,
} from './hold_collide_publication_20261001_inverse.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {RESEARCH_PRINT_BASELINE, RESEARCH_PRINT_STYLE, sourceBeforeResearchPrintPagination20261001, sourceAtResearchPrintPaginationBaseline} from './research_print_pagination_20261001_inverse.mjs';
import {sourceAtBrandRefreshBaseline} from './brand_refresh_20261007_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = file => sourceAtResearchPrintPaginationBaseline(file, sourceAtBrandRefreshBaseline(file, fs.readFileSync(path.join(root, file))));
const prior = file => execFileSync('git', ['show', HOLD_COLLIDE_PUBLICATION_BASELINE + ':' + file], {cwd: root, maxBuffer: 32e6});
const sha = value => createHash('sha256').update(value).digest('hex');
let checks = 0, negativeControls = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
const reject = (fn, label) => { assert.throws(fn, {name: 'AssertionError'}, label); checks++; negativeControls++; };
const capture = (source, pattern) => [...source.matchAll(pattern)].map(match => match[0]);
const scriptsAndStyles = source => capture(source, /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi);
const series = source => source.match(/<section class="series" aria-labelledby="governance-performance-title">[\s\S]*?<\/section>/)?.[0] ?? '';
const seriesCards = source => capture(series(source), /<article class="series-card">[\s\S]*?<\/article>/g);
const carouselCards = source => capture(source, /<article class="latest-card\b[^>]*>[\s\S]*?<\/article>\n/g);
const title = 'Hold, Collide, Come Apart';
const slug = 'hold-collide-come-apart.html';
const pdf = 'Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf';
const social = 'assets/research/hold-collide-come-apart-social.png';
const description = 'How divisions hold in parallel, collide over shared ground, or grow apart, and why each pattern calls for a different response.';

const rawResearch = fs.readFileSync(path.join(root, 'research.html'), 'utf8');
const priorPrintSource = execFileSync('git', ['show', RESEARCH_PRINT_BASELINE + ':research.html'], {cwd: root, encoding: 'utf8'});
eq(rawResearch.split(RESEARCH_PRINT_STYLE).length - 1, 1, 'One exact print-restricted style keeps the final quote and essays together');
eq(sourceBeforeResearchPrintPagination20261001('research.html', rawResearch), priorPrintSource, 'Print change preserves every preceding screen/style/script/content byte');
eq(sourceAtResearchPrintPaginationBaseline('research.html', Buffer.from(rawResearch)), Buffer.from(priorPrintSource), 'Print normalization preserves Buffer type');
for (const mutant of [rawResearch + '\n', priorPrintSource,
  rawResearch.replace('id="research-print-flow-20261001" media="print"', 'id="research-print-flow-20261001"'),
  rawResearch.replace('id="research-print-flow-20261001" media="print"', 'id="research-print-flow-20261001" media="screen"'),
  rawResearch.replace('break-after: avoid;', 'break-after: auto;'),
  rawResearch.replace(RESEARCH_PRINT_STYLE, RESEARCH_PRINT_STYLE + RESEARCH_PRINT_STYLE),
]) {
  reject(() => sourceBeforeResearchPrintPagination20261001('research.html', mutant), 'Print inverse rejects changed rules, media, unrelated source, and double inversion');
  eq(sourceAtResearchPrintPaginationBaseline('research.html', mutant), mutant, 'Print adapter does not repair unknown bytes');
}
for (const file of ['index.html', 'monderman-report.js', '__proto__']) {
  const bytes = Buffer.from('Outside the Research print scope');
  eq(sourceBeforeResearchPrintPagination20261001(file, bytes), bytes, 'Print inverse leaves unrelated source untouched');
  eq(sourceAtResearchPrintPaginationBaseline(file, bytes), bytes, 'Print adapter leaves unrelated source untouched');
}

eq(Object.keys(holdCollidePublicationDelta), HOLD_COLLIDE_PUBLICATION_FILES, 'Compatibility is confined to the two publication listings');
for (const file of HOLD_COLLIDE_PUBLICATION_FILES) {
  const current = read(file), before = prior(file), entry = holdCollidePublicationDelta[file];
  eq(sha(before), entry.before_sha256, file + ': immutable Git baseline identity');
  eq(sha(current), entry.after_sha256, file + ': exact current publication identity');
  eq(sourceBeforeHoldCollidePublication20261001(file, current), before, file + ': recover the complete preceding source and Buffer type');
  eq(sourceAtHoldCollidePublicationBaseline(file, current.toString()), before.toString(), file + ': historical adapter preserves string type');
  eq(scriptsAndStyles(current.toString()), scriptsAndStyles(before.toString()), file + ': executable scripts and styles stay byte-identical');
  eq(sourceBeforePublicCopyClarity(file, current), sourceBeforePublicCopyClarity(file, before), file + ': older approvals recover the same pinned edition');
  const mutants = [current.toString() + '\n', before, current.toString().replace(title, 'Unreviewed title')];
  for (const [start, end] of entry.replacements) mutants.push(current.toString().slice(0, start) + 'UNREVIEWED' + current.toString().slice(end));
  for (const mutant of mutants) {
    reject(() => sourceBeforeHoldCollidePublication20261001(file, mutant), file + ': reject changed source and double inversion');
    eq(sourceAtHoldCollidePublicationBaseline(file, mutant), mutant, file + ': never repair unrecognized source');
    if (mutant !== before) reject(() => sourceBeforePublicCopyClarity(file, mutant), file + ': historical whole-source protections reject changed source');
  }
}
for (const file of ['monderman-report.js', 'sample-report.html', 'unrelated.html', '__proto__']) {
  const bytes = Buffer.from('Outside the finite publication scope');
  eq(sourceBeforeHoldCollidePublication20261001(file, bytes), bytes, file + ': strict inverse leaves unrelated source untouched');
  eq(sourceAtHoldCollidePublicationBaseline(file, bytes), bytes, file + ': historical adapter leaves unrelated source untouched');
}

const research = read('research.html').toString(), oldResearch = prior('research.html').toString();
const homepage = read('index.html').toString(), oldHomepage = prior('index.html').toString();
const currentSeriesCards = seriesCards(research), oldSeriesCards = seriesCards(oldResearch);
eq(currentSeriesCards.length, 5, 'Governance has five parts');
eq(currentSeriesCards.slice(0, 4), oldSeriesCards, 'All four earlier Governance cards remain byte-identical and in order');
eq(currentSeriesCards.map(card => card.match(/<span class="series-chip">(.*?)<\/span>/)?.[1]), ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5'], 'Five-part reading order');
for (const token of [title, description, 'October 2026', '16 pages · ~25 min', `href="${slug}"`, `href="${pdf}"`]) ok(currentSeriesCards[4].includes(token), 'New library card contains ' + token);
ok(research.includes('21 items · Updated October 2026'), 'Current library count and publication month');
const primary = [...research.matchAll(/class="(?:series-action|paper-action) publication-primary-link" href="([^"]+)"/g)].map(match => match[1]);
eq(primary.length, 20, 'Twenty articles accompany the book entry');
eq(new Set(primary).size, 20, 'All article entries are unique');

const currentCarouselCards = carouselCards(homepage), oldCarouselCards = carouselCards(oldHomepage);
eq(currentCarouselCards.length, 18, 'Homepage contains eighteen publication cards');
eq(currentCarouselCards.slice(1), oldCarouselCards, 'Every earlier homepage card remains byte-identical and in order');
for (const token of [title, 'The three forms the trenches take.', description, 'Governance and Performance · Part 5', 'Series, Part 5', `href="${slug}"`, `href="${pdf}"`]) ok(currentCarouselCards[0].includes(token), 'First homepage card contains ' + token);
for (const [file, source] of [['index.html', homepage], ['research.html', research]]) {
  for (const target of [slug, pdf]) eq(source.split('href="' + target + '"').length - 1, 1, file + ': one destination for ' + target);
}
for (const file of [slug, pdf, social]) ok(read(file).length > 0, 'Published artifact exists: ' + file);

const oldTargets = new Set([...oldResearch.matchAll(/class="(?:series-action|paper-action) publication-(?:primary|secondary)-link" href="([^"]+)"/g)].map(match => match[1].split('?')[0]));
for (const file of oldTargets) eq(read(file), prior(file), 'Earlier publication remains byte-identical: ' + file);
for (const file of ['monderman-report.js', 'participant-evidence-safety.js', 'public-sample-model.js', 'sample-report-production.js', 'sample-report.html', 'sample-data/production-diagnostic-samples.json', 'sample-data/production-sample-release.json']) eq(read(file), prior(file), 'Report and sample evidence remain byte-identical: ' + file);

for (const file of ['sitemap.txt', 'sitemap.xml']) {
  const current = read(file).toString(), before = prior(file).toString();
  const line = file.endsWith('.xml') ? `  <url><loc>https://www.monderman.com/${slug}</loc></url>\n` : `https://www.monderman.com/${slug}\n`;
  eq(current.split(line).length - 1, 1, file + ': one exact canonical article entry');
  eq(current.replace(line, ''), before, file + ': all previous sitemap entries are unchanged');
}
const currentIndex = JSON.parse(read('public-search-index.json'));
const oldIndex = JSON.parse(prior('public-search-index.json'));
eq(currentIndex.length, oldIndex.length + 1, 'Search adds exactly one article');
eq(currentIndex.filter(record => record.url !== slug).map(record => record.url), oldIndex.map(record => record.url), 'Previous search URLs and order are preserved');
for (const record of oldIndex.filter(record => !HOLD_COLLIDE_PUBLICATION_FILES.includes(record.url))) eq(currentIndex.find(current => current.url === record.url), record, 'Existing search copy is preserved: ' + record.url);
const newRecord = currentIndex.find(record => record.url === slug);
eq(newRecord?.title, title, 'New article search title');
eq(newRecord?.category, 'Research', 'New article search category');
ok(newRecord?.headings.includes('Reading the three forms'), 'New article search includes its comparison figure');
for (const file of HOLD_COLLIDE_PUBLICATION_FILES) ok(currentIndex.find(record => record.url === file)?.text.includes(title), file + ': public search reflects the new card');
console.log(JSON.stringify({status: 'PASS', checks, negativeControls, files: HOLD_COLLIDE_PUBLICATION_FILES, baseline: HOLD_COLLIDE_PUBLICATION_BASELINE, networkCalls: 0, published: false}, null, 2));
