// Restore only the exact, independently pinned five-year footer presentation.
// Unknown files and unknown edits pass through to the historical assertions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256 = '811134a2998dd82c2d15aafaea2070742794348c776699f90f60d1fcc246b7eb';
export const ACMP_FIVE_YEAR_FOOTER_BASELINE = 'ddb638257ce38b3dabf88f0c5ba1c4962d7ae912';
const sha = value => createHash('sha256').update(value).digest('hex');
const fixtureBytes = fs.readFileSync(new URL('./fixtures/acmp-five-year-footer-20261112.json', import.meta.url));
assert.equal(sha(fixtureBytes), ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256, 'Exact reviewed five-year footer fixture');
const delta = JSON.parse(fixtureBytes);
assert.equal(delta.version, 'acmp-five-year-footer-20261112.1');
assert.equal(delta.baseline, ACMP_FIVE_YEAR_FOOTER_BASELINE);
assert.equal(Object.keys(delta.files).length, 86, 'Exact reviewed source-file scope');
assert.equal(Object.keys(delta.prior_footers).length, 16, 'Deduplicated exact preceding footer texts');
assert.deepEqual(Object.keys(delta.prior_sources).sort(), ['footer-membership.css', 'scripts/render-static-build.sh']);
for (const [digest, text] of Object.entries(delta.prior_footers)) {
  assert.equal(sha(text), digest, 'Every preceding footer matches its independent identity');
}
for (const [file, text] of Object.entries(delta.prior_sources)) {
  assert.equal(sha(text), delta.files[file].before_sha256, file + ': pinned preceding source text');
}
for (const entry of Object.values(delta.files)) Object.freeze(entry);
Object.freeze(delta.files);
Object.freeze(delta.prior_footers);
Object.freeze(delta.prior_sources);
export const acmpFiveYearFooterDelta = Object.freeze(delta);
const footerPattern = /<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/g;

export function sourceBeforeAcmpFiveYearFooter(file, source) {
  const entry = Object.hasOwn(delta.files, file) ? delta.files[file] : null;
  if (!entry || sha(source) !== entry.after_sha256) return source;
  let restored;
  if (Object.hasOwn(delta.prior_sources, file)) {
    restored = delta.prior_sources[file];
  } else {
    assert.ok(file.endsWith('.html'), file + ': only the finite HTML footer scope may be restored');
    const current = Buffer.isBuffer(source) ? source.toString('utf8') : source;
    const matches = [...current.matchAll(footerPattern)];
    assert.equal(matches.length, 1, file + ': one exact current shared footer');
    const match = matches[0];
    assert.equal(sha(match[0]), delta.new_footer_sha256, file + ': exact reviewed current footer');
    assert.ok(Object.hasOwn(delta.prior_footers, entry.prior_footer_sha256), file + ': registered preceding footer');
    restored = current.slice(0, match.index) + delta.prior_footers[entry.prior_footer_sha256]
      + current.slice(match.index + match[0].length);
  }
  assert.equal(sha(restored), entry.before_sha256, file + ': complete preceding source recovered without Git');
  return Buffer.isBuffer(source) ? Buffer.from(restored, 'utf8') : restored;
}
