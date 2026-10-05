// Exact finite presentation changes. Historical evidence and publication
// approvals retain their original bytes; unfamiliar changes are not inverted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceAtOutreachResponseBaseline} from './outreach_response_20261005_inverse.mjs';
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
