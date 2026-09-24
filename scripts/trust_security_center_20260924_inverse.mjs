// Historical compatibility only. Restore the exact two-page consolidation
// before the language/gold/library/original-copy layers. Current disclosures
// are tested separately; this never approves a publication or deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
export const TRUST_SECURITY_CENTER_FILES=Object.freeze(['security.html','subprocessors.html']);
export const TRUST_SECURITY_CENTER_FIXTURE_SHA256='3122527a6fa881ddbc457b3ca59daee794e1f1badaeabd42916b186feee19aee';
const bytes=fs.readFileSync(new URL('./fixtures/trust-security-center-20260924.json',import.meta.url));
assert.equal(sha(bytes),TRUST_SECURITY_CENTER_FIXTURE_SHA256,'Exact separate Trust Center fixture');
export const trustSecurityCenterDelta=JSON.parse(bytes);
assert.equal(trustSecurityCenterDelta.version,'trust-security-center-20260924.1');
assert.equal(trustSecurityCenterDelta.baseline,'dd80e27f4ee63f9ac0b2385010ab2d4f92a61cb2');
assert.equal(trustSecurityCenterDelta.copy_fixture_sha256,'4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb');
assert.deepEqual(Object.keys(trustSecurityCenterDelta.files),TRUST_SECURITY_CENTER_FILES,'Finite two-page Trust Center whitelist');

export function sourceBeforeTrustSecurityCenter20260924(file,source){
  if(!Object.hasOwn(trustSecurityCenterDelta.files,file))return source;
  const entry=trustSecurityCenterDelta.files[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed trust-center source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite Trust Center delta');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': entire pre-center source restored byte for byte');
  return restored;
}
