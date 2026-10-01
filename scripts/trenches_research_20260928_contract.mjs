// Verify the finite fourth-part addition independently of historical approvals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sourceAtHoldCollidePublicationBaseline} from './hold_collide_publication_20261001_inverse.mjs';
import {
  TRENCHES_RESEARCH_BASELINE,
  trenchesResearchReplacements,
  sourceBeforeTrenchesResearch20260928,
  sourceAtTrenchesResearchBaseline,
} from './trenches_research_20260928_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const file = 'research.html';
const current = sourceAtHoldCollidePublicationBaseline(file, fs.readFileSync(path.join(root, file), 'utf8'));
const before = execFileSync('git', ['show', TRENCHES_RESEARCH_BASELINE + ':' + file], {cwd: root, encoding: 'utf8'});
let checks = 0;
let negativeControls = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = (fn, label) => { assert.throws(fn, {name: 'AssertionError'}, label); checks++; negativeControls++; };
const capture = (source, pattern) => [...source.matchAll(pattern)].map(match => match[0]);
const section = (source, id) => source.match(new RegExp('<section class="series" aria-labelledby="' + id + '">[\\s\\S]*?</section>'))?.[0];

eq(sourceBeforeTrenchesResearch20260928(file, current), before, 'Recover the immutable prior research page exactly');
eq(sourceAtTrenchesResearchBaseline(file, current), before, 'Historical checks receive the exact preceding edition');
eq(section(current, 'ai-institutions-title'), section(before, 'ai-institutions-title'), 'Existing AI series remains byte-identical');
eq(capture(current, /<figure class="series-pullquote">[\s\S]*?<\/figure>/g), capture(before, /<figure class="series-pullquote">[\s\S]*?<\/figure>/g), 'Existing Governance pull quote remains byte-identical');
eq(capture(current, /<script\b[^>]*>[\s\S]*?<\/script>/gi), capture(before, /<script\b[^>]*>[\s\S]*?<\/script>/gi), 'All research scripts remain byte-identical');

const governance = section(current, 'governance-performance-title');
const cards = [...governance.matchAll(/<article class="series-card">([\s\S]*?)<\/article>/g)].map(match => match[1]);
eq(cards.length, 4, 'Governance contains four parts');
eq(cards.map(card => card.match(/<span class="series-chip">(.*?)<\/span>/)?.[1]), ['Part 1', 'Part 2', 'Part 3', 'Part 4'], 'Four parts retain their reading order');
const primary = [...current.matchAll(/class="(?:series-action|paper-action) publication-primary-link" href="([^"]+)"/g)].map(match => match[1]);
eq(primary.length, 19, 'Nineteen article entries');
eq(new Set(primary).size, 19, 'No duplicate article entries');
for (const target of ['trenches-not-silos.html', 'Monderman_Insight_Trenches_Not_Silos_2026-09-28.pdf']) {
  eq(current.split('href="' + target + '"').length - 1, 1, 'One research destination for ' + target);
  eq(fs.existsSync(path.join(root, target)), true, 'Published artifact exists: ' + target);
}

for (const mutant of [current + '\n', before, current.replace('Trenches, Not Silos', 'Unreviewed title'), current.replace('governance-performance-title', 'unreviewed-series')]) {
  reject(() => sourceBeforeTrenchesResearch20260928(file, mutant), 'Changed source and double inversion are rejected');
  eq(sourceAtTrenchesResearchBaseline(file, mutant), mutant, 'Historical adapter does not repair unrecognized bytes');
}
for (const [start, end] of trenchesResearchReplacements) {
  reject(() => sourceBeforeTrenchesResearch20260928(file, current.slice(0, start) + 'UNREVIEWED' + current.slice(end)), 'Every finite change rejects mutation');
}
for (const unrelated of ['index.html', 'monderman-report.js', '__proto__']) {
  const bytes = Buffer.from('Outside the research-page scope');
  eq(sourceBeforeTrenchesResearch20260928(unrelated, bytes), bytes, 'Unrelated source is untouched');
  eq(sourceAtTrenchesResearchBaseline(unrelated, bytes), bytes, 'Historical normalization is confined to research.html');
}
console.log(JSON.stringify({status: 'PASS', checks, negativeControls, files: [file], networkCalls: 0, published: false}, null, 2));
