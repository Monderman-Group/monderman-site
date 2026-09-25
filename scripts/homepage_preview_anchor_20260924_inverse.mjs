// Explicit presentation-only addendum. This never changes sample approvals,
// renderer output, publication files or the original source-pin dictionaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_PREVIEW_ANCHOR_FIXTURE_SHA256='c9691f487abf71c319ec891d188ed07b9b07549e824a12288a45846d28fc3a11';
const bytes=fs.readFileSync(new URL('./fixtures/homepage-preview-anchor-20260924.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_PREVIEW_ANCHOR_FIXTURE_SHA256,'Exact independently reviewed homepage-anchor addendum');
export const homepagePreviewAnchorDelta=JSON.parse(bytes);
export const HOMEPAGE_PREVIEW_ANCHOR_FILES=Object.freeze(['homepage-workspace-demo.css','scripts/public_sample_fixture.mjs']);
assert.deepEqual(Object.keys(homepagePreviewAnchorDelta.files),HOMEPAGE_PREVIEW_ANCHOR_FILES,'Only desktop CSS and its source-reader integration');
export function sourceBeforeHomepagePreviewAnchor20260924(file,source){
  if(!HOMEPAGE_PREVIEW_ANCHOR_FILES.includes(file))return source;
  const entry=homepagePreviewAnchorDelta.files[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed homepage-anchor source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite anchor addendum');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': original publication-bound bytes recovered');
  return restored;
}
