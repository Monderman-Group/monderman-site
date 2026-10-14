// Exact five-photo owner-directed presentation layer. This leaf imports no older inverse.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtHomepageRefinementBaseline} from './homepage_refinement_20261014_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const PHOTO_PRESENTATION_BASELINE='5ce8817eed8af622b4c0c8eeeb48b4440e728186';
export const PHOTO_PRESENTATION_VERSION='marketing-photo-presentation-20261013.1';
export const PHOTO_PRESENTATION_FIXTURE_SHA256='cae6092b9338a499bb1a192be855b0bda4ba4399d0f39983ff2e70780a32636d';
const bytes=fs.readFileSync(new URL('./fixtures/marketing-photo-presentation-20261013.json',import.meta.url));
assert.equal(sha(bytes),PHOTO_PRESENTATION_FIXTURE_SHA256,'Exact independently reviewed five-photo fixture');
export const photoPresentationDelta=JSON.parse(bytes);
assert.equal(photoPresentationDelta.baseline,PHOTO_PRESENTATION_BASELINE);
assert.equal(photoPresentationDelta.baselineTree,'4245b8bc1ff3fdcaae738620fc5f7e84224c6f12');
assert.equal(photoPresentationDelta.version,PHOTO_PRESENTATION_VERSION);
export const PHOTO_PRESENTATION_FILES=Object.freeze(Object.keys(photoPresentationDelta.files));
export const PHOTO_PRESENTATION_ADDITIONS=Object.freeze(Object.keys(photoPresentationDelta.additions));
export const PHOTO_PRESENTATION_GUARD_FILES=Object.freeze([...photoPresentationDelta.guardFiles]);
const entryFor=file=>typeof file==='string'&&Object.hasOwn(photoPresentationDelta.files,file)?photoPresentationDelta.files[file]:null;
export function sourceBeforeMarketingPhotoPresentation20261013(file,source){
 source=sourceAtHomepageRefinementBaseline(file,source);
 const entry=entryFor(file);if(!entry)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': text/bytes type remains exact');
 assert.equal(sha(source),entry.after_sha256,file+': only exact complete owner-reviewed current bytes');
 let restored=Buffer.isBuffer(source)?source.toString('utf8'):source;
 for(const [start,end,current,prior]of [...entry.replacements].reverse()){assert.equal(restored.slice(start,end),current,file+': exact finite UTF-16 replacement');restored=restored.slice(0,start)+prior+restored.slice(end);}
 assert.equal(sha(restored),entry.before_sha256,file+': complete reviewed merged-M bytes recovered');
 return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtMarketingPhotoPresentationBaseline(file,source){
 source=sourceAtHomepageRefinementBaseline(file,source);
 const entry=entryFor(file);if(!entry)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),file+': text/bytes type remains exact');
 return sha(source)===entry.after_sha256?sourceBeforeMarketingPhotoPresentation20261013(file,source):source;
}
export function photoNamesAtMarketingPhotoPresentationBaseline(names){
 assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'),'Explicit photographic directory names');
 const actual=[...names].sort(),current=[...photoPresentationDelta.currentPhotoNames].sort();
 return JSON.stringify(actual)===JSON.stringify(current)?[...photoPresentationDelta.priorPhotoNames]:names;
}
