// Exact source compatibility, never a publication approval or a general rewrite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_COMPACT_FIXTURE_SHA256='39e83ffb8abf274cf986711618f24a984c86e0b4ecef114e0c44c3386a757a15';
const bytes=fs.readFileSync(new URL('./fixtures/homepage-compact-journey-20260924.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_COMPACT_FIXTURE_SHA256,'Reviewed compact homepage fixture has its exact independent digest');
export const homepageCompactDelta=JSON.parse(bytes);
export const HOMEPAGE_COMPACT_FILES=Object.freeze(['index.html','homepage-workspace-demo.css','homepage-workspace-demo.js','scripts/templates/home-workspace-preview.html','scripts/refresh_public_sample_previews.mjs','scripts/inject-public-shell.mjs']);
assert.deepEqual(Object.keys(homepageCompactDelta.files),HOMEPAGE_COMPACT_FILES,'Finite homepage-only source whitelist');
export function sourceBeforeHomepageCompactJourney20260924(file,source){
 if(!HOMEPAGE_COMPACT_FILES.includes(file))return source;
 const entry=homepageCompactDelta.files[file];
 assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed compact-homepage source can be inverted');
 let restored=String(source);
 for(const [start,end,current,prior]of [...entry.replacements].reverse()){
  assert.equal(restored.slice(start,end),current,file+': exact finite homepage delta');
  restored=restored.slice(0,start)+prior+restored.slice(end);
 }
 assert.equal(sha(restored),entry.before_sha256,file+': entire pre-compact source recovered');
 return restored;
}
