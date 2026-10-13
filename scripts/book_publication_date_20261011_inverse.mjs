// Exact owner-approved dated book-copy delta; no earlier inverse is imported.
// Unknown source remains visible to all historical product and legal guards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const BOOK_PUBLICATION_DATE_BASELINE='c1574cb534f77f55fc74fd52bc66064ab9bdc464';
export const BOOK_PUBLICATION_DATE_VERSION='book-publication-date-20261011.1';
export const BOOK_PUBLICATION_DATE_FIXTURE_SHA256='91affe3977eb904868174828aab1b328292cf10f6ada61e563f4a5882f7a7a64';
const bytes=fs.readFileSync(new URL('./fixtures/book-publication-date-20261011.json',import.meta.url));
assert.equal(sha(bytes),BOOK_PUBLICATION_DATE_FIXTURE_SHA256,'Exact approved book publication-date fixture');
export const bookPublicationDateDelta=JSON.parse(bytes);
assert.equal(bookPublicationDateDelta.baseline,BOOK_PUBLICATION_DATE_BASELINE);
assert.equal(bookPublicationDateDelta.version,BOOK_PUBLICATION_DATE_VERSION);
export const BOOK_PUBLICATION_DATE_FILES=Object.freeze(Object.keys(bookPublicationDateDelta.files));
export function sourceBeforeBookPublicationDate20261011(file,source){
  source=sourceAtMarketingRefreshBaseline(file,source);
  const entry=Object.hasOwn(bookPublicationDateDelta.files,file)?bookPublicationDateDelta.files[file]:null;
  if(!entry)return source;
  assert.equal(sha(source),entry.after_sha256,file+': only exact approved book-date source may be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite publication-date hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': every original deployed source byte recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtBookPublicationDateBaseline(file,source){
  source=sourceAtMarketingRefreshBaseline(file,source);
  const entry=Object.hasOwn(bookPublicationDateDelta.files,file)?bookPublicationDateDelta.files[file]:null;
  return entry&&sha(source)===entry.after_sha256?sourceBeforeBookPublicationDate20261011(file,source):source;
}
