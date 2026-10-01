// Verify the single added publication card without revising earlier approvals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceAtHoldCollidePublicationBaseline} from './hold_collide_publication_20261001_inverse.mjs';
import {
  TRENCHES_HOMEPAGE_BASELINE,
  TRENCHES_HOMEPAGE_BEFORE_SHA256,
  TRENCHES_HOMEPAGE_AFTER_SHA256,
  TRENCHES_HOMEPAGE_CARD,
  sourceBeforeTrenchesHomepageCarousel20260929,
  sourceAtTrenchesHomepageCarouselBaseline,
} from './trenches_homepage_carousel_20260929_inverse.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = file => sourceAtHoldCollidePublicationBaseline(file, fs.readFileSync(path.join(root, file)));
const prior = file => execFileSync('git', ['show', TRENCHES_HOMEPAGE_BASELINE + ':' + file], {cwd: root, maxBuffer: 32e6});
const sha = value => createHash('sha256').update(value).digest('hex');
const current = read('index.html').toString(), before = prior('index.html').toString();
let checks = 0, negativeControls = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = (fn, label) => { assert.throws(fn, {name: 'AssertionError'}, label); checks++; negativeControls++; };
const capture = (source, pattern) => [...source.matchAll(pattern)].map(match => match[0]);
const cards = source => capture(source, /<article class="latest-card\b[^>]*>[\s\S]*?<\/article>\n/g);

eq(sha(before), TRENCHES_HOMEPAGE_BEFORE_SHA256, 'Immutable Git baseline has the original homepage identity');
eq(sha(current), TRENCHES_HOMEPAGE_AFTER_SHA256, 'Current homepage has the exact added-card identity');
eq(sourceBeforeTrenchesHomepageCarousel20260929('index.html', current), before, 'Recover every original homepage byte');
eq(sourceAtTrenchesHomepageCarouselBaseline('index.html', Buffer.from(current)), Buffer.from(before), 'Historical adapter preserves Buffer type');
eq(cards(before).length, 16, 'Original carousel has sixteen cards');
eq(cards(current), [TRENCHES_HOMEPAGE_CARD, ...cards(before)], 'One new first card preserves every prior card and its order');
eq(capture(current, /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi), capture(before, /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi), 'All homepage scripts and styles remain byte-identical');
for (const target of ['trenches-not-silos.html', 'Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf']) {
  eq(current.split('href="' + target + '"').length - 1, 1, 'One original carousel destination for ' + target);
  eq(read(target), prior(target), 'Existing publication artifact remains byte-identical: ' + target);
}
for (const file of ['research.html', 'monderman-report.js', 'participant-evidence-safety.js', 'public-sample-model.js', 'sample-data/production-diagnostic-samples.json', 'sample-data/production-sample-release.json']) {
  eq(read(file), prior(file), 'Existing research, report or financial evidence is unchanged: ' + file);
}

const mutants = [
  current + '\n', before,
  current.replace('Trenches, Not Silos', 'Unreviewed title'),
  current.replace('href="trenches-not-silos.html"', 'href="missing.html"'),
  current.replace('The Bill for Dividing a Company', 'Unreviewed subtitle'),
  current.replace(TRENCHES_HOMEPAGE_CARD, TRENCHES_HOMEPAGE_CARD + TRENCHES_HOMEPAGE_CARD),
  current.replace('const latestCardCount = latestCards.length;', 'const latestCardCount = 1;'),
];
for (const mutant of mutants) {
  reject(() => sourceBeforeTrenchesHomepageCarousel20260929('index.html', mutant), 'Changed source and double inversion are rejected');
  eq(sourceAtTrenchesHomepageCarouselBaseline('index.html', mutant), mutant, 'Historical adapter never repairs unrecognized bytes');
  if (mutant !== before) reject(() => sourceBeforePublicCopyClarity('index.html', mutant), 'Earlier whole-source protections still reject unreviewed changes');
}
eq(sourceBeforePublicCopyClarity('index.html', current), sourceBeforePublicCopyClarity('index.html', before), 'The historical chain recovers the same approved source');
for (const file of ['research.html', 'monderman-report.js', '__proto__']) {
  const bytes = Buffer.from('Outside the one-card homepage scope');
  eq(sourceBeforeTrenchesHomepageCarousel20260929(file, bytes), bytes, 'Strict inverse leaves unrelated source untouched');
  eq(sourceAtTrenchesHomepageCarouselBaseline(file, bytes), bytes, 'Historical adapter leaves unrelated source untouched');
}
console.log(JSON.stringify({status: 'PASS', checks, negativeControls, cards: 17, baseline: TRENCHES_HOMEPAGE_BASELINE, networkCalls: 0, published: false}, null, 2));
