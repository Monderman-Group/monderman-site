// Historical source compatibility for exactly three preview digest attributes.
// This never rewrites evidence, validates a release or grants publication approval.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const PREVIEW_PRIOR_ARTIFACT_DIGEST='b0717a330a5fe89fcc952dda8495c699f78c67639997f9813f4dcfae6d1bf9cb';
export const PREVIEW_CURRENT_ARTIFACT_DIGEST='5c351c9a7ed42f34bbbda135e1c5e57c44492246b67350bd5b00174608c0eea0';
export const PREVIEW_CURRENT_ARTIFACT_FILE_SHA256='07aadc8baa10c5dc3ef00f6e96fed2c2955ab7ea14f2a487eea8b3283ab5b248';
export const previewBindingDelta=Object.freeze({
  'index.html':Object.freeze({count:2,before_sha256:'de67c06053d58ca6ec6b69b68398adff5f9648d9636e36c17b0c79524bb44951',after_sha256:'f3c005bb3f0cb964f1256ef9371d101eb891372ca6a8f6a3a710adc9d9f5825c'}),
  'Monderman_Platform_Brief.html':Object.freeze({count:1,before_sha256:'818440b25a61a31347b6bb7f180cb4688d86b393b7a09ec443b9cfb69cdfd640',after_sha256:'80e93be21957cde13f795a00c245f73138d5c7ad401978879b27aaf68c658886'})
});
export function sourceBeforePublicSamplePreviewBinding20260924(file,source){
  if(!Object.hasOwn(previewBindingDelta,file))return source;
  const entry=previewBindingDelta[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed current source can restore preview binding compatibility');
  const text=String(source),current='data-artifact-sha256="'+PREVIEW_CURRENT_ARTIFACT_DIGEST+'"';
  assert.equal(text.split(current).length-1,entry.count,file+': exact finite preview attribute count');
  const restored=text.replaceAll(current,'data-artifact-sha256="'+PREVIEW_PRIOR_ARTIFACT_DIGEST+'"');
  assert.equal(sha(restored),entry.before_sha256,file+': all pre-binding source bytes restored');
  return restored;
}
