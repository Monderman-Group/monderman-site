// A finite, independently pinned publication transition. Unfamiliar bytes
// remain visible to every historical release guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
export const DURABLE_PUBLICATION_BASELINE = '74bcf2e86cf7829e2d4aaa5f83ade90b6b6ffaad';
export const DURABLE_PUBLICATION_VERSION = 'durable-organization-publication-20261007.1';
export const DURABLE_PUBLICATION_FIXTURE_SHA256 = '6808405eeb2672179a23c30e7f2b85610e73b1378399a09bbfd7150b6763aa33';
const bytes = fs.readFileSync(new URL('./fixtures/durable-organization-publication-20261007.json', import.meta.url));
assert.equal(sha(bytes), DURABLE_PUBLICATION_FIXTURE_SHA256, 'Exact approved Durable Organization publication fixture');
export const durablePublicationDelta = JSON.parse(bytes);
assert.equal(durablePublicationDelta.baseline, DURABLE_PUBLICATION_BASELINE);
assert.equal(durablePublicationDelta.version, DURABLE_PUBLICATION_VERSION);
export const DURABLE_PUBLICATION_FILES = Object.freeze(Object.keys(durablePublicationDelta.files));
export function sourceBeforeDurablePublication20261007(file, source) {
  const entry = Object.hasOwn(durablePublicationDelta.files, file) ? durablePublicationDelta.files[file] : null;
  if (!entry) return source;
  assert.equal(sha(source), entry.after_sha256, file + ': only exact reviewed publication bytes may be inverted');
  let restored = String(source);
  for (const [start, end, current, prior] of [...entry.replacements].reverse()) {
    assert.equal(restored.slice(start, end), current, file + ': exact finite publication hunk');
    restored = restored.slice(0, start) + prior + restored.slice(end);
  }
  assert.equal(sha(restored), entry.before_sha256, file + ': every preceding byte recovered');
  return Buffer.isBuffer(source) ? Buffer.from(restored) : restored;
}
export function sourceAtDurablePublicationBaseline(file, source) {
  const entry = Object.hasOwn(durablePublicationDelta.files, file) ? durablePublicationDelta.files[file] : null;
  return entry && sha(source) === entry.after_sha256 ? sourceBeforeDurablePublication20261007(file, source) : source;
}
