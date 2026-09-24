// Exact source compatibility and tamper rejection, independent of current
// trust_security_center_smoke.mjs. No service, account or provider requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {TRUST_SECURITY_CENTER_FILES,TRUST_SECURITY_CENTER_FIXTURE_SHA256,trustSecurityCenterDelta,sourceBeforeTrustSecurityCenter20260924} from './trust_security_center_20260924_inverse.mjs';
import {PUBLIC_COPY_BASELINE,PUBLIC_COPY_FIXTURE_SHA256,publicCopyDelta,sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,hunks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const check=(value,label)=>{assert.ok(value,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,/only the exact reviewed trust-center source/,label);checks++;};
equal(TRUST_SECURITY_CENTER_FILES,['security.html','subprocessors.html'],'Only two reviewed content pages can be inverted');
for(const file of TRUST_SECURITY_CENTER_FILES){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const entry=trustSecurityCenterDelta.files[file];
  const original=execFileSync('git',['show',PUBLIC_COPY_BASELINE+':'+file],{cwd:root,encoding:'utf8'});
  // Independently reconstruct the pre-center edition from the original
  // immutable copy fixture, not from the new inverse's expected output.
  let postCopy=original;
  for(const [start,,current,prior]of publicCopyDelta.files[file].replacements){
    equal(postCopy.slice(start,start+prior.length),prior,file+': original copy replacement input');
    postCopy=postCopy.slice(0,start)+current+postCopy.slice(start+prior.length);
  }
  equal(sha(postCopy),entry.before_sha256,file+': pre-center bytes match original approved-copy edition');
  equal(sha(source),entry.after_sha256,file+': frozen current source');
  equal(sourceBeforeTrustSecurityCenter20260924(file,source),postCopy,file+': entire before snapshot independently recovered');
  equal(sourceBeforePublicCopyClarity(file,source),original,file+': complete layered chain restores Git baseline');
  equal(sourceBeforeTrustSecurityCenter20260924(file,Buffer.from(source)),postCopy,file+': byte input has the same exact restoration');
  reject(()=>sourceBeforeTrustSecurityCenter20260924(file,postCopy),file+': cannot silently invert a prior edition twice');
  for(const mutated of [source+'\n',source.replace('<!DOCTYPE html>','<!DOCTYPE HTML>'),source.replace('</body>','<script>unapproved()</script></body>')]){
    check(mutated!==source,file+': negative control really changes input');
    reject(()=>sourceBeforeTrustSecurityCenter20260924(file,mutated),file+': changed source outside approved delta rejected');
    reject(()=>sourceBeforePublicCopyClarity(file,mutated),file+': root integration also rejects changed source');
  }
  let previousEnd=0;
  for(const [start,end,current,prior]of entry.replacements){
    check(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=previousEnd&&end>=start&&end<=source.length,file+': ordered finite offsets');
    equal(source.slice(start,end),current,file+': exact current hunk');
    check(current!==prior,file+': hunk is a real change');
    const mutation=source.slice(0,start)+(current?'!'+current.slice(1):'UNAPPROVED')+source.slice(end);
    reject(()=>sourceBeforeTrustSecurityCenter20260924(file,mutation),file+': every changed hunk rejects tampering');
    previousEnd=end;hunks++;
  }
}
const unrelated=Buffer.from('Unrelated content must retain object identity.\n');
for(const file of ['privacy.html','terms.html','legal-document-manifest.json','trust-security-center.css','monderman-report.js','unrelated.js','__proto__']){
  assert.equal(sourceBeforeTrustSecurityCenter20260924(file,unrelated),unrelated,file+': no mutation or conversion outside whitelist');checks++;
}
equal(PUBLIC_COPY_FIXTURE_SHA256,'4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb','Historical copy fixture pin remains fixed');
equal(sha(fs.readFileSync(path.join(root,'scripts/fixtures/public-copy-clarity-20260924.json'))),PUBLIC_COPY_FIXTURE_SHA256,'Historical copy fixture bytes remain fixed');
console.log(JSON.stringify({status:'PASS',checks,hunks,files:TRUST_SECURITY_CENTER_FILES,fixtureSha256:TRUST_SECURITY_CENTER_FIXTURE_SHA256,historicalCopyFixtureUnchanged:true,publicationApprovalClaimed:false,providerCalls:0}));
