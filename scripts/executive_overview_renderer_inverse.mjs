import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceBeforeComparisonPrint20260924} from './report_comparison_print_20260924_inverse.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const bytes=fs.readFileSync(new URL('./fixtures/executive-overview-renderer-20260924.json',import.meta.url));
assert.equal(sha(bytes),'8770336b5c5f70639f2a2c3a6aa6dc29e49b231842a36248b5343c2922a0a4b4');
const delta=JSON.parse(bytes);
export function sourceBeforeExecutiveOverview(source){
  source=sourceBeforeComparisonPrint20260924(source);
  if(!source.includes('function reviewedExecutiveOverview('))return source;
  assert.equal(sha(source),delta.after_sha256,'Only the exact reviewed executive overview renderer can be inverted');
  assert.equal(source.slice(delta.start,delta.start+delta.current.length),delta.current);
  const prior=source.slice(0,delta.start)+delta.prior+source.slice(delta.start+delta.current.length);
  assert.equal(sha(prior),delta.before_sha256,'Full pre-overview renderer restored');
  return prior;
}
