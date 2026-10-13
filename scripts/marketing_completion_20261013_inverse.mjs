// Additive completion approval. Only complete reviewed bytes can restore the deployed5614 baseline.
// This module imports no historical inverse; additions remain visible and separately pinned.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const MARKETING_COMPLETION_BASELINE='561439e7c5aef48db0331bbb993f0a6d9ec4ada1';
export const MARKETING_COMPLETION_VERSION='marketing-completion-20261013.1';
export const MARKETING_COMPLETION_FIXTURE_SHA256='c78b7a1b8088987e4b9261a35c1e2ef1952500077c5b8f0ae9b32a8c845579d3';
const bytes=fs.readFileSync(new URL('./fixtures/marketing-completion-20261013.json',import.meta.url));
assert.equal(sha(bytes),MARKETING_COMPLETION_FIXTURE_SHA256,'Exact independently reviewed completion fixture');
export const marketingCompletionDelta=JSON.parse(bytes);
assert.equal(marketingCompletionDelta.baseline,MARKETING_COMPLETION_BASELINE);
assert.equal(marketingCompletionDelta.version,MARKETING_COMPLETION_VERSION);
assert.equal(marketingCompletionDelta.baselineTree,'6e000b0f2c357902e402217e6d6d94e8c79d6762');
export const MARKETING_COMPLETION_FILES=Object.freeze(Object.keys(marketingCompletionDelta.files));
export const MARKETING_COMPLETION_ADDITIONS=Object.freeze(Object.keys(marketingCompletionDelta.additions));
export const MARKETING_COMPLETION_GUARD_FILES=Object.freeze([...marketingCompletionDelta.guardFiles]);
const entryFor=file=>typeof file==='string'&&Object.hasOwn(marketingCompletionDelta.files,file)?marketingCompletionDelta.files[file]:null;
export function sourceBeforeMarketingCompletion20261013(file,source){
  const entry=entryFor(file);
  if(!entry)return source;
  assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': source remains UTF-8 text or bytes');
  assert.equal(sha(source),entry.after_sha256,file+': only exact complete reviewed completion bytes');
  let restored=Buffer.isBuffer(source)?source.toString('utf8'):source;
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite UTF-16 completion hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every deployed5614 baseline byte restored');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtMarketingCompletionBaseline(file,source){
  const entry=entryFor(file);
  if(!entry)return source;
  assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': source remains UTF-8 text or bytes');
  return sha(source)===entry.after_sha256?sourceBeforeMarketingCompletion20261013(file,source):source;
}
