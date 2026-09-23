// Historical compatibility only, not approval of changed production behavior.
// These finite committed presentation/salary-UI deltas have independent checks.
// Keep all older source constants and assertions unchanged after exact inversion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const OVERVIEW_SITE_PRIOR_COMMIT='31c87d9944d58cd58a48e389a680e0e909536329';
export const OVERVIEW_SITE_REVIEWED_COMMIT='bd5948aa32bb738c10eef2f9261d5d580bdc91e2';
export const OVERVIEW_SITE_DELTA_SHA256='19ca030f899437e6c76ef95927951fe01987657f88cec1db57aa659f02e99f52';
export const OVERVIEW_SITE_FILES=Object.freeze([
  'assignment-draft.js','assignment-mode.js','campaign-analysis.js',
  'canonical-site-shell.css','cross-tool-synthesis.html','decision-velocity.html',
  'homepage-workspace-demo.css','index.html','institutional-performance.html',
  'operational-systems.html','pilot-waitlist.css','public-product-design.css',
  'sample-report-tile.css','sample-report.html','structural-clarity.html',
  'workspace-actions.html','workspace-analysis.html','workspace-diagnostics.html',
  'workspace-settings.html'
]);
const sha=value=>createHash('sha256').update(value).digest('hex');
const bytes=fs.readFileSync(new URL('./fixtures/report-overview-reviewed-site-delta.json',import.meta.url));
assert.equal(sha(bytes),OVERVIEW_SITE_DELTA_SHA256,'Exact reviewed site compatibility fixture');
const delta=JSON.parse(bytes);
assert.equal(delta.prior_commit,OVERVIEW_SITE_PRIOR_COMMIT);
assert.equal(delta.reviewed_commit,OVERVIEW_SITE_REVIEWED_COMMIT);
assert.deepEqual(Object.keys(delta.files),OVERVIEW_SITE_FILES,'Finite reviewed site filename whitelist');

export function sourceBeforeOverviewSiteCompatibility(file,source){
  if(!OVERVIEW_SITE_FILES.includes(file))return source;
  const entry=delta.files[file];
  assert.equal(sha(source),entry.current_sha256,file+': only the exact reviewed current source can be inverted');
  let restored=String(source);
  for(const [current,prior]of entry.replacements){
    assert.equal(restored.split(current).length,2,file+': exactly one finite reviewed site delta');
    restored=restored.replace(current,()=>prior);
  }
  assert.equal(sha(restored),entry.prior_sha256,file+': complete pre-overview/salary source restored byte for byte');
  return restored;
}
