// Explicit fixture maintenance only, never a validator or publication step.
// Reconstruct the exact post-copy baseline from its immutable review fixture,
// remove the separately checked gold delta, then capture the finite library
// files and renderer cache consumers. Cache consumers must be cache-only edits.
// Prints a candidate JSON document by default. --output requires a new file;
// reviewing/pinning that candidate in the inverse remains a separate action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourceBeforePromotionalGold20260924} from './promotional_gold_20260924_inverse.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const baseline = 'dd80e27f4ee63f9ac0b2385010ab2d4f92a61cb2';
const copyBytes = fs.readFileSync(path.join(root, 'scripts/fixtures/public-copy-clarity-20260924.json'));
const copyHash = '4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb';
assert.equal(sha(copyBytes), copyHash, 'Never absorb library changes into the previous copy fixture');
const copy = JSON.parse(copyBytes);
assert.equal(copy.baseline, baseline);
const cacheFiles = ['cross-tool-synthesis.html', 'workspace-diagnostics.html', 'structural-clarity.html', 'operational-systems.html', 'workspace-actions.html', 'institutional-performance.html', 'decision-velocity.html', 'workspace-analysis.html'];
const filenames = ['Monderman_Platform_Brief.html', 'index.html', 'sample-report.html', 'public-sample-model.js', 'sample-report-production.js', 'scripts/refresh_public_sample_previews.mjs', ...cacheFiles];

function postCopyBaseline(file) {
  let source = execFileSync('git', ['show', baseline + ':' + file], {cwd:root, encoding:'utf8', maxBuffer:32e6});
  const entry = copy.files[file];
  if (!entry) return source;
  assert.equal(sha(source), entry.before_sha256, file + ': exact pre-copy baseline');
  for (const [start, end, current, prior] of entry.replacements) {
    assert.equal(end - start, current.length, file + ': copy offsets use JavaScript string units');
    assert.equal(source.slice(start, start + prior.length), prior, file + ': exact forward copy reconstruction');
    source = source.slice(0, start) + current + source.slice(start + prior.length);
  }
  assert.equal(sha(source), entry.after_sha256, file + ': exact post-copy baseline reconstructed');
  return source;
}

// Line LCS produces finite replacements in current-source UTF-16 offsets.
// Full before/after hashes independently bind the entire surrounding file.
function replacements(before, after) {
  let old = before.match(/[^\n]*\n|[^\n]+$/g) || [], current = after.match(/[^\n]*\n|[^\n]+$/g) || [];
  // Drop shared leading/trailing lines before the bounded LCS. Large runtime
  // pages with one cache-tag change do not require a page-sized matrix.
  let prefix = 0, baseOffset = 0, suffix = 0;
  while (prefix < old.length && prefix < current.length && old[prefix] === current[prefix]) {baseOffset += current[prefix].length; prefix++;}
  while (suffix < old.length-prefix && suffix < current.length-prefix && old[old.length-1-suffix] === current[current.length-1-suffix]) suffix++;
  old = old.slice(prefix, suffix ? -suffix : undefined); current = current.slice(prefix, suffix ? -suffix : undefined);
  const width = current.length + 1, cells = (old.length + 1) * width;
  assert.ok(cells <= 25e6, 'Unexpectedly large presentation file; review before expanding fixture generation');
  const lcs = new Uint32Array(cells);
  for (let i = old.length - 1; i >= 0; i--) for (let j = current.length - 1; j >= 0; j--) {
    lcs[i * width + j] = old[i] === current[j] ? 1 + lcs[(i + 1) * width + j + 1] : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
  }
  const offsets = [baseOffset]; for (const line of current) offsets.push(offsets.at(-1) + line.length);
  const result = []; let i = 0, j = 0, startOld = 0, startCurrent = 0, changed = false;
  const flush = () => {if (changed) result.push([offsets[startCurrent], offsets[j], current.slice(startCurrent, j).join(''), old.slice(startOld, i).join('')]); changed = false;};
  while (i < old.length || j < current.length) {
    if (i < old.length && j < current.length && old[i] === current[j]) {flush(); i++; j++; continue;}
    if (!changed) {startOld = i; startCurrent = j; changed = true;}
    if (i < old.length && (j === current.length || lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) i++; else j++;
  }
  flush(); return result;
}

const files = {};
for (const file of filenames) {
  const before = postCopyBaseline(file), current = sourceBeforePromotionalGold20260924(file, fs.readFileSync(path.join(root, file), 'utf8'));
  if (cacheFiles.includes(file)) {
    const oldTag = 'monderman-report.js?v=20260923.overview1', newTag = 'monderman-report.js?v=20260924.overview2';
    assert.equal(before.split(oldTag).length, 2, file + ': one exact prior renderer cache tag');
    assert.equal(current, before.replace(oldTag, newTag), file + ': cache-only consumer cannot absorb other edits');
  }
  const changes = replacements(before, current);
  let restored = current;
  for (const [start, end, value, prior] of [...changes].reverse()) {assert.equal(restored.slice(start, end), value); restored = restored.slice(0, start) + prior + restored.slice(end);}
  assert.equal(restored, before, file + ': generated candidate must restore the complete post-copy source');
  files[file] = {before_sha256:sha(before), after_sha256:sha(current), replacements:changes};
}
const candidate = JSON.stringify({version:'report-library-presentation-20260924.1', baseline, copy_fixture_sha256:copyHash, scope:'Exact source compatibility only; not sample publication approval.', files}, null, 2) + '\n';
const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0) process.stdout.write(candidate);
else {
  assert.ok(process.argv[outputIndex + 1], 'Specify a new candidate file');
  const target = path.resolve(process.argv[outputIndex + 1]);
  assert.ok(!fs.existsSync(target), 'Candidate destination must not already exist');
  fs.writeFileSync(target, candidate, {flag:'wx'});
  console.log(JSON.stringify({candidate:target, sha256:sha(candidate), files:filenames, publicationApprovalChanged:false}));
}
