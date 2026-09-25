// Finite copy/display compatibility. Historical evidence, approvals and source
// pins keep their original values; this layer restores only named exact bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceAtGovernanceResearchBaseline} from './governance_research_20260925_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const CHANGE_WORDING_BASELINE='4ca0253f3a5ce45607b32577e74c28f97f2cf934';
export const CHANGE_WORDING_VERSION='diagnostic-renderer-change-wording-20260925.1';
export const CHANGE_WORDING_FIXTURE_SHA256='0b9bc5ff74a0ea271cbd77084a1296a9f520fbd5f09e9b4ea735b3310bded37e';
const bytes=fs.readFileSync(new URL('./fixtures/change-wording-20260925.json',import.meta.url));
assert.equal(sha(bytes),CHANGE_WORDING_FIXTURE_SHA256,'Exact change-wording compatibility fixture');
export const changeWordingDelta=JSON.parse(bytes);
assert.equal(changeWordingDelta.prior_commit,CHANGE_WORDING_BASELINE);
export const CHANGE_WORDING_FILES=Object.freeze(Object.keys(changeWordingDelta.files));
export function sourceBeforeChangeWording20260925(file,source){
  if(!CHANGE_WORDING_FILES.includes(file))return source;
  const entry=changeWordingDelta.files[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed current source can be inverted (change wording)');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite wording hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': entire pre-wording source recovered');
  return restored;
}
// Older independent contracts sometimes pass the exact preceding edition to
// another historical layer. Only that pinned byte identity may bypass inversion.
export function sourceAtChangeWordingBaseline(file,source){
  source=sourceAtGovernanceResearchBaseline(file,source);
  const publication=changeWordingDelta.publication_files?.[file];
  if(publication){
    if(sha(source)===publication.before_sha256)return source;
    assert.equal(sha(source),publication.after_sha256,file+': exact appended wording publication bytes');
    const before=execFileSync('git',['show',CHANGE_WORDING_BASELINE+':'+file],{cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6});
    assert.equal(sha(before),publication.before_sha256,file+': immutable preceding publication bytes');
    return Buffer.isBuffer(source)?before:before.toString();
  }
  if(CHANGE_WORDING_FILES.includes(file)&&sha(source)===changeWordingDelta.files[file].before_sha256)return source;
  return sourceBeforeChangeWording20260925(file,source);
}
