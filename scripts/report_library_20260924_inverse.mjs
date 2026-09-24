// Exact library presentation compatibility. Call after the gold inverse and
// before the immutable copy inverse; never use this as publication approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBeforePublicSampleProjection20260924} from './public_sample_projection_20260924_inverse.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
export const REPORT_LIBRARY_CACHE_FILES = Object.freeze(['cross-tool-synthesis.html', 'workspace-diagnostics.html', 'structural-clarity.html', 'operational-systems.html', 'workspace-actions.html', 'institutional-performance.html', 'decision-velocity.html', 'workspace-analysis.html']);
export const REPORT_LIBRARY_FILES = Object.freeze(['Monderman_Platform_Brief.html', 'index.html', 'sample-report.html', 'public-sample-model.js', 'sample-report-production.js', 'scripts/refresh_public_sample_previews.mjs', ...REPORT_LIBRARY_CACHE_FILES]);
export const REPORT_LIBRARY_FIXTURE_SHA256 = '1a9abbfe2868961ecc8db9e6b290e94b1f9d09600eb71cd286c5daa8525a0a74';
const bytes = fs.readFileSync(new URL('./fixtures/report-library-presentation-20260924.json', import.meta.url));
assert.equal(sha(bytes), REPORT_LIBRARY_FIXTURE_SHA256, 'Exact separate report-library presentation fixture');
export const reportLibraryDelta = JSON.parse(bytes);
assert.equal(reportLibraryDelta.version, 'report-library-presentation-20260924.1');
assert.equal(reportLibraryDelta.baseline, 'dd80e27f4ee63f9ac0b2385010ab2d4f92a61cb2');
assert.equal(reportLibraryDelta.copy_fixture_sha256, '4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb');
assert.deepEqual(Object.keys(reportLibraryDelta.files), REPORT_LIBRARY_FILES, 'Finite library source whitelist');
export function sourceBeforeReportLibrary20260924(file, source) {
  source = sourceBeforePublicSampleProjection20260924(file, source);
  const entry = reportLibraryDelta.files[file];
  if (!entry) return source;
  assert.equal(sha(source), entry.after_sha256, file + ': only the exact reviewed current source can be inverted after gold inversion');
  let restored = String(source);
  for (const [start, end, current, prior] of [...entry.replacements].reverse()) {
    assert.equal(restored.slice(start, end), current, file + ': exact finite library presentation delta');
    restored = restored.slice(0, start) + prior + restored.slice(end);
  }
  assert.equal(sha(restored), entry.before_sha256, file + ': entire post-copy source restored byte for byte');
  return restored;
}
