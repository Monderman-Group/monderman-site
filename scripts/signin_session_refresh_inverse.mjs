// Historical comparison only. The separately reviewed September 24 session fix
// is exercised by signin_legal_documents_smoke; older interface pins stay intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const SIGNIN_SESSION_REVIEWED_SHA256='8cf251e2e0534f44bb34fdb4b8b25fd61b82ffead21b5d821e7d076ed9761399';
export const SIGNIN_SESSION_PRIOR_SHA256='f0240d14bb0b707d64fa2d5f422fb6c82f7d82e91ed0a4774b2f30dd9832bd63';
const bytes=fs.readFileSync(new URL('./fixtures/signin-session-refresh-reviewed-delta.json',import.meta.url));
assert.equal(sha(bytes),'e1f85bd21fe7e6aeddf94b871aeae98e2f525fafeb30bbd04686326184248fa5','Exact reviewed sign-in delta fixture');
const delta=JSON.parse(bytes);
assert.equal(delta.currentSha,SIGNIN_SESSION_REVIEWED_SHA256);
assert.equal(delta.priorSha,SIGNIN_SESSION_PRIOR_SHA256);
assert.equal(delta.replacements.length,8,'Finite reviewed sign-in changes only');
export function sourceBeforeSigninSessionRefresh(file,source){
  if(file!=='signin.html')return source;
  assert.equal(sha(source),SIGNIN_SESSION_REVIEWED_SHA256,'Only the exact reviewed sign-in source may be inverted');
  let restored=String(source);
  for(const [current,prior]of delta.replacements){
    assert.equal(restored.split(current).length,2,'Exactly one reviewed sign-in replacement');
    restored=restored.replace(current,()=>prior);
  }
  assert.equal(sha(restored),SIGNIN_SESSION_PRIOR_SHA256,'Complete prior sign-in source restored byte for byte');
  return restored;
}
