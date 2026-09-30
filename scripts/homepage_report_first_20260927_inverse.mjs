// Exact homepage presentation compatibility. The old report, evidence and
// publication approvals keep their original pins; no financial data is changed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtTrenchesHomepageCarouselBaseline} from './trenches_homepage_carousel_20260929_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
// The published main commit and local preparation commit share this exact tree.
// Pin content identity, not the local-only preparation commit's history.
export const HOMEPAGE_REPORT_FIRST_BASELINE='907ebdb3ae8267f1d1c5a82313684ca45f68b78c';
export const HOMEPAGE_REPORT_FIRST_FIXTURE_SHA256='c0a087f0701a1efece74e6bc0fe25e12fe0fcc568fdb03a160dd3279fed6b32c';
export const HOMEPAGE_REPORT_FIRST_FILES=Object.freeze(['index.html','homepage-workspace-demo.css','scripts/homepage_report_quad_20260925.mjs','scripts/templates/home-workspace-preview.html','scripts/inject-public-shell.mjs']);
const bytes=fs.readFileSync(new URL('./fixtures/homepage-report-first-20260927.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_REPORT_FIRST_FIXTURE_SHA256,'Exact report-first presentation fixture');
export const reportFirstDelta=JSON.parse(bytes);
assert.equal(reportFirstDelta.baseline,HOMEPAGE_REPORT_FIRST_BASELINE);
assert.equal(reportFirstDelta.baseline_kind,'tree');
assert.deepEqual(Object.keys(reportFirstDelta.files),HOMEPAGE_REPORT_FIRST_FILES,'Finite homepage-only presentation scope');
export function sourceBeforeHomepageReportFirst20260927(file,source){
 if(!HOMEPAGE_REPORT_FIRST_FILES.includes(file))return source;
 const entry=reportFirstDelta.files[file];
 assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed report-first source can be inverted');
 let restored=String(source);
 for(const[start,end,current,prior]of[...entry.replacements].reverse()){
  assert.equal(restored.slice(start,end),current,file+': exact finite report-first hunk');
  restored=restored.slice(0,start)+prior+restored.slice(end);
 }
 assert.equal(sha(restored),entry.before_sha256,file+': complete prior homepage source recovered');
 return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
// Historical assertions pass their own pinned editions through this boundary.
// Only the exact newly reviewed identity is stripped. Other bytes still reach
// the pre-existing independent digest assertions and cannot bypass them.
export function sourceAtHomepageReportFirstBaseline(file,source){
 source=sourceAtTrenchesHomepageCarouselBaseline(file,source);
 const entry=Object.hasOwn(reportFirstDelta.files,file)?reportFirstDelta.files[file]:null;
 return entry&&sha(source)===entry.after_sha256?sourceBeforeHomepageReportFirst20260927(file,source):source;
}
