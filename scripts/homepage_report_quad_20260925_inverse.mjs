// Finite presentation compatibility only. This does not approve a new sample,
// change report evidence, or replace any original publication source pin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtChangeWordingBaseline} from './change_wording_20260925_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_REPORT_QUAD_FIXTURE_SHA256='2d2db7ce4416dfb4af93d18f46134babb4361cabf85cdf49c67ebac031aecf24';
export const HOMEPAGE_REPORT_QUAD_FILES=Object.freeze([
  'index.html','homepage-workspace-demo.css','monderman-depth-lure-tile.css',
  'scripts/refresh_public_sample_previews.mjs','scripts/inject-public-shell.mjs',
  'scripts/public_sample_fixture.mjs','scripts/homepage_report_quad_20260925.mjs',
]);
const bytes=fs.readFileSync(new URL('./fixtures/homepage-report-quad-20260925.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_REPORT_QUAD_FIXTURE_SHA256,'Exact homepage report-quad presentation fixture');
export const homepageReportQuadDelta=JSON.parse(bytes);
assert.deepEqual(Object.keys(homepageReportQuadDelta.files),HOMEPAGE_REPORT_QUAD_FILES,'Finite homepage presentation and source-reader scope');
export function sourceBeforeHomepageReportQuad20260925(file,source){
  if(!HOMEPAGE_REPORT_QUAD_FILES.includes(file))return source;
  source=sourceAtChangeWordingBaseline(file,source);
  const entry=homepageReportQuadDelta.files[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed homepage-report-quad source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite report-quad presentation hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': complete pre-quad source bytes recovered');
  return restored;
}
