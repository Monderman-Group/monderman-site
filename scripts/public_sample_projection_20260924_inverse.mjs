// Exact display-format compatibility, never a new evidence/publication approval.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const PROJECTION_MODEL_BEFORE_SHA256='355ae54ffe0640a6f4a35594139adab526d46ea9bd50dc37eb862ede3b987804';
export const PROJECTION_MODEL_AFTER_SHA256='e72cbde89d77bcafdb94b8a2ed060f49be2f6a19045b6560d77f2da093fa6d14';
const prior=`    if (projection.version !== 'monderman-public-sample-projection-20260913.7' || !sha256(projection.source_sha256) || !/^[a-f0-9]{40}$/.test(projection.projection_commit || '')) throw new Error("Sample publication version is missing");`;
const current=`    const projectionVersions = ['monderman-public-sample-projection-20260913.7', 'monderman-public-sample-projection-20260924.8'];
    if (!projectionVersions.includes(projection.version) || Object.keys(projection).sort().join(',') !== 'projection_commit,source_sha256,version' || !sha256(projection.source_sha256) || !/^[a-f0-9]{40}$/.test(projection.projection_commit || '') ||
        (projection.version === projectionVersions[1] && projection.projection_commit !== artifact.engine_commit)) throw new Error("Sample publication version is missing or differs from generation");`;
export function sourceBeforePublicSampleProjection20260924(file,source){
  if(file!=='public-sample-model.js')return source;
  assert.equal(sha(source),PROJECTION_MODEL_AFTER_SHA256,file+': only the exact reviewed current source can restore projection compatibility');
  const text=String(source);
  assert.equal(text.split(current).length,2,'One exact projection format hunk');
  const restored=text.replace(current,prior);
  assert.equal(sha(restored),PROJECTION_MODEL_BEFORE_SHA256,'Exact prior adapter restored; no historical pin changed');
  return restored;
}

// Cache-only follow-up. Unwind BEFORE compact-homepage/language layers so their
// earlier exact source pins stay unchanged. Runtime code is not touched here.
export const PROJECTION_CACHE_FILES=Object.freeze(['sample-report.html','scripts/inject-public-shell.mjs']);
export const projectionCacheDelta=Object.freeze({
  'sample-report.html':{
    before_sha256:'94ca7e337b8da2c7eb2539cd5d5a3440f9f28cb84178cba813cd374eab6bc4d6',
    after_sha256:'a0f6b6743346bde4650b11f0f3200680c8cac756c154422090dbd549d92814cb',
    prior:'public-sample-model.js?v=20260924.comparisons1',current:'public-sample-model.js?v=20260924.projection8'
  },
  'scripts/inject-public-shell.mjs':{
    before_sha256:'5eb3c0cf817156e99cdc30a699d42693df6f5c0a619574dcf5d26a7134ab73ff',
    after_sha256:'6ba0a9be50ee4cb99a1d90fd4d5111d05e6836b7eb13ef6e8addd7350116e1b3',
    prior:'"public-sample-model.js": "20260924.comparisons1"',current:'"public-sample-model.js": "20260924.projection8"'
  }
});
export function sourceBeforePublicSampleProjectionCache20260924(file,source){
  if(!Object.hasOwn(projectionCacheDelta,file))return source;
  const entry=projectionCacheDelta[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed current source can restore projection cache compatibility');
  const text=String(source);
  assert.equal(text.split(entry.current).length,2,file+': one exact public model cache reference');
  const restored=text.replace(entry.current,entry.prior);
  assert.equal(sha(restored),entry.before_sha256,file+': exact pre-cache source restored');
  return restored;
}
