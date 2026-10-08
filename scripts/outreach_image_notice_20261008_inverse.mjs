// Only exact owner-approved prospective email-notice bytes may be inverted.
// Unfamiliar edits stay visible to the original product/legal guards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const OUTREACH_IMAGE_NOTICE_FIXTURE_SHA256='efe982180182409bd52dc99b820b173fbaa12c12a343a4dfd3589828a62a0a2f';
const bytes=fs.readFileSync(new URL('./fixtures/outreach-image-notice-20261008.json',import.meta.url));
assert.equal(sha(bytes),OUTREACH_IMAGE_NOTICE_FIXTURE_SHA256,'Exact reviewed outreach notice fixture');
export const outreachImageNoticeDelta=JSON.parse(bytes);
assert.equal(outreachImageNoticeDelta.version,'outreach-image-notice-20261008.1');
assert.equal(outreachImageNoticeDelta.baseline,'08944880293e9c034470ead88035d48320f7b6fc');
export function sourceBeforeOutreachImageNotice20261008(file,source){
  const entry=Object.hasOwn(outreachImageNoticeDelta.files,file)?outreachImageNoticeDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only exact approved notice bytes may be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite notice hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every original byte recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtOutreachImageNoticeBaseline(file,source){
  const entry=Object.hasOwn(outreachImageNoticeDelta.files,file)?outreachImageNoticeDelta.files[file]:null;
  return entry&&sha(source)===entry.after_sha256?sourceBeforeOutreachImageNotice20261008(file,source):source;
}
