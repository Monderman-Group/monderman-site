// Exact finite invitation-link focus repair. No historical inverse is imported.
// Unknown source stays visible to the existing publication and product guards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtBookPublicationDateBaseline} from './book_publication_date_20261011_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_INVITATION_FOCUS_BASELINE='435fa2c87178de1bc3826f5f0ad1bba9b5f2cf54';
export const HOMEPAGE_INVITATION_FOCUS_VERSION='homepage-invitation-focus-20261011.1';
export const HOMEPAGE_INVITATION_FOCUS_FIXTURE_SHA256='4fbcdeb2cfa4aea4b141515100c02be04d3796db89025d516f97cc6a30c75c49';
const bytes=fs.readFileSync(new URL('./fixtures/homepage-invitation-focus-20261011.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_INVITATION_FOCUS_FIXTURE_SHA256,'Exact reviewed invitation-focus fixture');
export const homepageInvitationFocusDelta=JSON.parse(bytes);
assert.equal(homepageInvitationFocusDelta.baseline,HOMEPAGE_INVITATION_FOCUS_BASELINE);
assert.equal(homepageInvitationFocusDelta.version,HOMEPAGE_INVITATION_FOCUS_VERSION);
export const HOMEPAGE_INVITATION_FOCUS_FILES=Object.freeze(Object.keys(homepageInvitationFocusDelta.files));
export function sourceBeforeHomepageInvitationFocus20261011(file,source){
  source=sourceAtBookPublicationDateBaseline(file,source);
  const entry=Object.hasOwn(homepageInvitationFocusDelta.files,file)?homepageInvitationFocusDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only exact reviewed invitation-focus source may be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite invitation-focus hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every reviewed PR baseline byte recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtHomepageInvitationFocusBaseline(file,source){
  source=sourceAtBookPublicationDateBaseline(file,source);
  const entry=Object.hasOwn(homepageInvitationFocusDelta.files,file)?homepageInvitationFocusDelta.files[file]:null;
  return entry&&sha(source)===entry.after_sha256?sourceBeforeHomepageInvitationFocus20261011(file,source):source;
}
