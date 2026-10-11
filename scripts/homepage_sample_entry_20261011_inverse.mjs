// Exact owner-approved October 11 homepage hero entry delta. Historical
// fixtures remain immutable; unfamiliar source is never normalized.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_SAMPLE_ENTRY_BASELINE='1a11487ad9424b5011ec89d6da4aaac2e7d04c7a';
export const HOMEPAGE_SAMPLE_ENTRY_VERSION='homepage-sample-entry-20261011.1';
export const HOMEPAGE_SAMPLE_ENTRY_FIXTURE_SHA256='08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253';
const bytes=fs.readFileSync(new URL('./fixtures/homepage-sample-entry-20261011.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_SAMPLE_ENTRY_FIXTURE_SHA256,'Exact approved homepage sample-entry fixture');
export const homepageSampleEntryDelta=JSON.parse(bytes);
assert.equal(homepageSampleEntryDelta.baseline,HOMEPAGE_SAMPLE_ENTRY_BASELINE);
assert.equal(homepageSampleEntryDelta.version,HOMEPAGE_SAMPLE_ENTRY_VERSION);
export const HOMEPAGE_SAMPLE_ENTRY_FILES=Object.freeze(Object.keys(homepageSampleEntryDelta.files));
export function sourceBeforeHomepageSampleEntry20261011(file,source){
  const entry=Object.hasOwn(homepageSampleEntryDelta.files,file)?homepageSampleEntryDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only exact approved homepage entry bytes may be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite approved homepage entry hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every preceding source byte recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtHomepageSampleEntryBaseline(file,source){
  const entry=Object.hasOwn(homepageSampleEntryDelta.files,file)?homepageSampleEntryDelta.files[file]:null;
  // Unknown metadata, executable, copy or styling edits stay visible to guards.
  return entry&&sha(source)===entry.after_sha256?sourceBeforeHomepageSampleEntry20261011(file,source):source;
}
