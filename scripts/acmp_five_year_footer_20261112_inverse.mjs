// Restore only the exact, independently pinned five-year footer presentation.
// Unknown files and unknown edits pass through to the historical assertions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256 = '64dd48e2de31940faf5cf92e6a484eca49f00868bb9cd5e800528ac24049b66e';
export const ACMP_FIVE_YEAR_FOOTER_BASELINE = 'ddb638257ce38b3dabf88f0c5ba1c4962d7ae912';
const sha = value => createHash('sha256').update(value).digest('hex');
const fixtureBytes = fs.readFileSync(new URL('./fixtures/acmp-five-year-footer-20261112.json', import.meta.url));
assert.equal(sha(fixtureBytes), ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256, 'Exact reviewed five-year footer fixture');
const delta = JSON.parse(fixtureBytes);
assert.equal(delta.version, 'acmp-five-year-footer-20261112.1');
assert.equal(delta.baseline, ACMP_FIVE_YEAR_FOOTER_BASELINE);
assert.equal(Object.keys(delta.files).length, 86, 'Exact reviewed source-file scope');
for (const entry of Object.values(delta.files)) Object.freeze(entry);
Object.freeze(delta.files);
export const acmpFiveYearFooterDelta = Object.freeze(delta);
const root = fileURLToPath(new URL('../', import.meta.url));
const priorFiles = new Map();

export function sourceBeforeAcmpFiveYearFooter(file, source) {
  const entry = Object.hasOwn(delta.files, file) ? delta.files[file] : null;
  if (!entry || sha(source) !== entry.after_sha256) return source;
  if (!priorFiles.has(file)) {
    const prior = execFileSync('git', ['show', `${ACMP_FIVE_YEAR_FOOTER_BASELINE}:${file}`], {
      cwd: root,
      maxBuffer: 32e6,
    });
    assert.equal(sha(prior), entry.before_sha256, file + ': exact preceding immutable source');
    priorFiles.set(file, prior);
  }
  const prior = priorFiles.get(file);
  return Buffer.isBuffer(source) ? Buffer.from(prior) : prior.toString('utf8');
}
