// Exact owner-approved October 7 copy/cache delta. Earlier approvals and
// fixture digests stay immutable; unknown source is never normalized.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtDurablePublicationBaseline} from './durable_organization_publication_20261007_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const BRAND_REFRESH_BASELINE='d4ce7246e7f2ce15e0ee01ea7f611a2199845e39';
export const BRAND_REFRESH_VERSION='brand-refresh-20261007.1';
export const BRAND_REFRESH_FIXTURE_SHA256='9b746857cd5e11366ea1dd0d4fcc288971e620d4426d01edc12ca55aaa581f08';
const bytes=fs.readFileSync(new URL('./fixtures/brand-refresh-20261007.json',import.meta.url));
assert.equal(sha(bytes),BRAND_REFRESH_FIXTURE_SHA256,'Exact approved brand refresh fixture');
export const brandRefreshDelta=JSON.parse(bytes);
assert.equal(brandRefreshDelta.baseline,BRAND_REFRESH_BASELINE);
assert.equal(brandRefreshDelta.version,BRAND_REFRESH_VERSION);
export const BRAND_REFRESH_FILES=Object.freeze(Object.keys(brandRefreshDelta.files));
export function sourceBeforeBrandRefresh20261007(file,source){
  const entry=Object.hasOwn(brandRefreshDelta.files,file)?brandRefreshDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': Only the exact reviewed brand-refresh source may be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite approved copy/cache hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': complete preceding source recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtBrandRefreshBaseline(file,source){
  source=sourceAtDurablePublicationBaseline(file,source);
  const entry=Object.hasOwn(brandRefreshDelta.files,file)?brandRefreshDelta.files[file]:null;
  // Pass every unfamiliar edit through to the existing historical guards.
  return entry&&sha(source)===entry.after_sha256?sourceBeforeBrandRefresh20261007(file,source):source;
}
