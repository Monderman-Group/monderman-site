// Independent finite approval layer. New assets are verified separately, never erased.
// Conditional inversion recognizes only complete reviewed bytes; every other edit remains visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const MARKETING_REFRESH_BASELINE='14e57bb9f5537cd7ed5eb581cbc7740541c593b1';
export const MARKETING_REFRESH_VERSION='marketing-refresh-20261012.1';
export const MARKETING_REFRESH_FIXTURE_SHA256='720608f700036a3150d1d831f8a6c4fc6e904a88a97b765ed4dca0d83c052d1e';
const bytes=fs.readFileSync(new URL('./fixtures/marketing-refresh-20261012.json',import.meta.url));
assert.equal(sha(bytes),MARKETING_REFRESH_FIXTURE_SHA256,'Exact independently reviewed marketing refresh fixture');
export const marketingRefreshDelta=JSON.parse(bytes);
assert.equal(marketingRefreshDelta.baseline,MARKETING_REFRESH_BASELINE);
assert.equal(marketingRefreshDelta.version,MARKETING_REFRESH_VERSION);
assert.equal(marketingRefreshDelta.baselineTree,'42d78704e37603bf19f5a1c5ddc0d7897e7119d8');
export const MARKETING_REFRESH_FILES=Object.freeze(Object.keys(marketingRefreshDelta.files));
export const MARKETING_REFRESH_ADDITIONS=Object.freeze(Object.keys(marketingRefreshDelta.additions));
function entryFor(file){return typeof file==='string'&&Object.hasOwn(marketingRefreshDelta.files,file)?marketingRefreshDelta.files[file]:null;}
export function sourceBeforeMarketingRefresh20261012(file,source){
  const entry=entryFor(file);
  if(!entry)return source;
  assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': source must remain text or bytes');
  assert.equal(sha(source),entry.after_sha256,file+': only the complete reviewed marketing source may be inverted');
  let restored=Buffer.isBuffer(source)?source.toString('utf8'):source;
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite UTF-16 marketing hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every approved baseline byte recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtMarketingRefreshBaseline(file,source){
  const entry=entryFor(file);
  if(!entry)return source;
  assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': source must remain text or bytes');
  return sha(source)===entry.after_sha256?sourceBeforeMarketingRefresh20261012(file,source):source;
}
