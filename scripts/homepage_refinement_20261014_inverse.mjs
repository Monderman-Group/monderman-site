// Exact homepage refinement leaf. No historical imports or broad normalization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sourceAtSiteDesignCoherenceBaseline,sourcePathsAtSiteDesignCoherenceBaseline,publicPathsAtSiteDesignCoherenceBaseline,publicSourceAtSiteDesignCoherenceBaseline} from './site_design_coherence_20261014_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const HOMEPAGE_REFINEMENT_BASELINE='94cabdfe6fdd6b15e13ed15af2f6f2398e806fa9';
export const HOMEPAGE_REFINEMENT_VERSION='homepage-refinement-20261014.1';
export const HOMEPAGE_REFINEMENT_FIXTURE_SHA256='bd2af72d1ad9363cea3d7091d265fc1ece4ab4cbbbc8a477fa4a88ad31ecbf2c';
const bytes=fs.readFileSync(new URL('./fixtures/homepage-refinement-20261014.json',import.meta.url));
assert.equal(sha(bytes),HOMEPAGE_REFINEMENT_FIXTURE_SHA256,'Exact reviewed homepage refinement fixture');
export const homepageRefinementDelta=JSON.parse(bytes);
assert.equal(homepageRefinementDelta.baseline,HOMEPAGE_REFINEMENT_BASELINE);
assert.equal(homepageRefinementDelta.baselineTree,'ec0da7e2fd54467f10e78093229931ea26f9ffb1');
assert.equal(homepageRefinementDelta.version,HOMEPAGE_REFINEMENT_VERSION);
export const HOMEPAGE_REFINEMENT_FILES=Object.freeze(Object.keys(homepageRefinementDelta.files));
export const HOMEPAGE_REFINEMENT_ADDITIONS=Object.freeze(Object.keys(homepageRefinementDelta.additions));
export const HOMEPAGE_REFINEMENT_GUARD_FILES=Object.freeze([...homepageRefinementDelta.guardFiles]);
const entryFor=file=>typeof file==='string'&&Object.hasOwn(homepageRefinementDelta.files,file)?homepageRefinementDelta.files[file]:null;
export function sourceBeforeHomepageRefinement20261014(file,source){
 source=sourceAtSiteDesignCoherenceBaseline(file,source);
 const entry=entryFor(file);if(!entry)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact source type');
 assert.equal(sha(source),entry.after_sha256,file+': only exact complete approved bytes');
 let restored=Buffer.isBuffer(source)?source.toString('utf8'):source;
 for(const [start,end,current,prior]of [...entry.replacements].reverse()){
  assert.equal(restored.slice(start,end),current,file+': exact finite UTF16 hunk');
  restored=restored.slice(0,start)+prior+restored.slice(end);
 }
 assert.equal(sha(restored),entry.before_sha256,file+': complete actual94cab bytes restored');
 return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
export function sourceAtHomepageRefinementBaseline(file,source){
 source=sourceAtSiteDesignCoherenceBaseline(file,source);
 const entry=entryFor(file);if(!entry)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact source type');
 return sha(source)===entry.after_sha256?sourceBeforeHomepageRefinement20261014(file,source):source;
}
const root=path.resolve(import.meta.dirname,'..');
function exactNames(names,current){return names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify([...current].sort());}
function additionsExact(){return HOMEPAGE_REFINEMENT_ADDITIONS.every(file=>{const p=path.join(root,file);if(!fs.existsSync(p)||!fs.statSync(p).isFile())return false;const b=sourceAtSiteDesignCoherenceBaseline(file,fs.readFileSync(p)),e=homepageRefinementDelta.additions[file];return sha(b)===e.sha256&&b.length===e.bytes;});}
export function sourcePathsAtHomepageRefinementBaseline(names){
 names=sourcePathsAtSiteDesignCoherenceBaseline(names);
 assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'),'Explicit source path list');
 return homepageRefinementDelta.provisional===false&&exactNames(names,homepageRefinementDelta.currentSourcePaths)&&additionsExact()?[...homepageRefinementDelta.baselineSourcePaths]:names;
}
export function publicPathsAtHomepageRefinementBaseline(names){
 names=publicPathsAtSiteDesignCoherenceBaseline(names);
 assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'),'Explicit compiled path list');
 return homepageRefinementDelta.provisional===false&&exactNames(names,homepageRefinementDelta.currentPublicPaths)&&additionsExact()?[...homepageRefinementDelta.baselinePublicPaths]:names;
}

export function isCurrentHomepageRefinementSource(source){
 source=sourceAtSiteDesignCoherenceBaseline('index.html',source);
 const entry=entryFor('index.html');
 return homepageRefinementDelta.provisional===false&&!!entry&&(typeof source==='string'||Buffer.isBuffer(source))&&sha(source)===entry.after_sha256&&additionsExact();
}
