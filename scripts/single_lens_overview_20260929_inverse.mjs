// Exact finite presentation changes. Historical evidence and publication
// approvals retain their original bytes; unfamiliar changes are not inverted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const SINGLE_LENS_OVERVIEW_BASELINE='61de1fbb0737a5b2af8cb4059bddae81226f95a2';
export const SINGLE_LENS_OVERVIEW_VERSION='diagnostic-renderer-single-lens-overview-20260929.1';
export const SINGLE_LENS_OVERVIEW_FIXTURE_SHA256='a5fa167424c75821a6e022282b31b0e0c23914a41c52d9adcf9955c3a6ccffde';
const bytes=fs.readFileSync(new URL('./fixtures/single-lens-overview-20260929.json',import.meta.url));
assert.equal(sha(bytes),SINGLE_LENS_OVERVIEW_FIXTURE_SHA256,'Exact single-lens presentation fixture');
export const singleLensOverviewDelta=JSON.parse(bytes);
assert.equal(singleLensOverviewDelta.baseline,SINGLE_LENS_OVERVIEW_BASELINE);
assert.equal(singleLensOverviewDelta.version,SINGLE_LENS_OVERVIEW_VERSION);
export const SINGLE_LENS_OVERVIEW_FILES=Object.freeze(Object.keys(singleLensOverviewDelta.files));
export function sourceBeforeSingleLensOverview20260929(file,source){
  const entry=Object.hasOwn(singleLensOverviewDelta.files,file)?singleLensOverviewDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': Only the exact reviewed single-lens source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite single-lens presentation hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': complete preceding source recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtSingleLensOverviewBaseline(file,source){
  source=sourceAtOutreachResponseBaseline(file,source);
  const entry=Object.hasOwn(singleLensOverviewDelta.files,file)?singleLensOverviewDelta.files[file]:null;
  if(entry&&(sha(source)===entry.after_sha256||file==='monderman-report.js'&&String(source).includes(SINGLE_LENS_OVERVIEW_VERSION)))return sourceBeforeSingleLensOverview20260929(file,source);
  const publication=singleLensOverviewDelta.publication_files?.[file];
  if(publication&&sha(source)===publication.after_sha256){
    const before=execFileSync('git',['show',SINGLE_LENS_OVERVIEW_BASELINE+':'+file],{cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6});
    assert.equal(sha(before),publication.before_sha256,file+': immutable preceding publication bytes');
    return Buffer.isBuffer(source)?before:before.toString();
  }
  return source;
}

// Keep exact outreach identities in the already-copied compatibility module.
// Isolated historical sample tests do not acquire a new runtime dependency.
export const OUTREACH_RESPONSE_BASELINE='2be745c09058756f08e6a1f91cc18dce1f97646e';
export const OUTREACH_RESPONSE_PAGES=Object.freeze({
  'pattern-trial.html':Object.freeze({
    before:'b12786e53ae7b22b13c1e396e2f46bbf899acec45912b51b0c1cc922addef8e2',
    after:'ca09301438e7c1b1ebad1eb9c70d93e51d2a8a80ecfa80ac446574835c02be86'
  }),
  'signin.html':Object.freeze({
    before:'8cf251e2e0534f44bb34fdb4b8b25fd61b82ffead21b5d821e7d076ed9761399',
    after:'a959fefb72f0b03fd6545d54332406d902174d1484e475de79333e47bb003825'
  })
});
export function sourceBeforeOutreachResponse20261005(file,source){
  if(!Object.hasOwn(OUTREACH_RESPONSE_PAGES,file))return source;
  const entry=OUTREACH_RESPONSE_PAGES[file];
  assert.equal(sha(source),entry.after,file+': Only the exact reviewed outreach source may be inverted');
  const prior=execFileSync('git',['show',OUTREACH_RESPONSE_BASELINE+':'+file],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6
  });
  assert.equal(sha(prior),entry.before,file+': Complete preceding page identity retained');
  return Buffer.isBuffer(source)?prior:prior.toString('utf8');
}
export function sourceAtOutreachResponseBaseline(file,source){
  const entry=Object.hasOwn(OUTREACH_RESPONSE_PAGES,file)?OUTREACH_RESPONSE_PAGES[file]:null;
  // Unknown changes pass through unchanged to the historical contracts, where
  // the original byte/behavior assertions must still independently reject them.
  return entry&&sha(source)===entry.after?sourceBeforeOutreachResponse20261005(file,source):source;
}
