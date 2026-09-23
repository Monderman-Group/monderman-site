// Exact reviewed overview, two-unit diagrams and protected-cost explanation.
// Preserve earlier source guards and receipts; reject every unreviewed byte.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const delta=JSON.parse(fs.readFileSync(new URL('./fixtures/report-overview-reviewed-delta.json',import.meta.url),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
export const OVERVIEW_RENDERER_SHA256='21a8f8e08ecfd9bcecc90dd77ef2b062f2eb28b81158d5a7f0511c5c3611621f';
export const PRIOR_OVERVIEW_RENDERER_SHA256='73c939fac58d0d2f7020207e6e1f869ec30e7f6ff745dbbfa6b76984b663ef98';
export function sourceBeforeOverviewPresentation(source){
  if(!source.includes('diagnostic-renderer-report-overview-20260923.1'))return source;
  assert.equal(sha(source),OVERVIEW_RENDERER_SHA256,'Only the reviewed overview renderer can be inverted');
  assert.equal(delta.renderer_sha256,OVERVIEW_RENDERER_SHA256);
  assert.equal(delta.prior_renderer_sha256,PRIOR_OVERVIEW_RENDERER_SHA256);
  for(const [current,prior] of delta.replacements){
    assert.equal(source.split(current).length,2,'Exactly one reviewed overview delta');
    source=source.replace(current,()=>prior);
  }
  assert.equal(sha(source),PRIOR_OVERVIEW_RENDERER_SHA256,'Restore the complete preceding renderer byte for byte');
  return source;
}
