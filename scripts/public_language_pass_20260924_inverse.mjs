// Exact, separate follow-up language layer. Call before the existing
// gold/library/copy chain; do not absorb this delta into an older fixture.
// This is historical compatibility only, never publication approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const PUBLIC_LANGUAGE_PASS_FILES=Object.freeze(['Monderman_Platform_Brief.html','operational-systems-article.html','decision-velocity-article.html','structural-clarity-article.html','institutional-performance-article.html','sample-report.html']);
export const PUBLIC_LANGUAGE_PASS_FIXTURE_SHA256='54272281e9806cc53e5d3c7eb329776b405ff3b6223402ac4e7020fe89971ab0';
const bytes=fs.readFileSync(new URL('./fixtures/public-language-pass-20260924.json',import.meta.url));
assert.equal(sha(bytes),PUBLIC_LANGUAGE_PASS_FIXTURE_SHA256,'Exact separate public-language follow-up fixture');
export const publicLanguagePassDelta=JSON.parse(bytes);
assert.equal(publicLanguagePassDelta.version,'public-language-pass-20260924.1');
assert.deepEqual(Object.keys(publicLanguagePassDelta.files),PUBLIC_LANGUAGE_PASS_FILES,'Finite six-page language whitelist');
export function sourceBeforePublicLanguagePass20260924(file,source){
  const entry=publicLanguagePassDelta.files[file];
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed public-language source can be inverted');
  let restored=String(source);
  for(const [current,prior]of entry.replacements){
    assert.equal(restored.split(current).length,2,file+': one exact language replacement');
    restored=restored.replace(current,()=>prior);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': entire pre-language-pass source restored byte for byte');
  return restored;
}
