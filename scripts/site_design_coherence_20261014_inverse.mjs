// Exact current design leaf. Unknown edits and additions are never normalized away.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const SITE_DESIGN_COHERENCE_BASELINE='16935688e0b4c6e177c81bdcaefb5727894d7a11';
export const SITE_DESIGN_COHERENCE_VERSION='site-design-coherence-20261014.1';
export const SITE_DESIGN_COHERENCE_FIXTURE_SHA256='e0458a298b60b6a27c3177c9060477424530114790841826efb3956fd385c3f4';
const bytes=fs.readFileSync(new URL('./fixtures/site-design-coherence-20261014.json',import.meta.url));
assert.equal(sha(bytes),SITE_DESIGN_COHERENCE_FIXTURE_SHA256,'Exact separately reviewed design fixture');
export const siteDesignCoherenceDelta=JSON.parse(bytes);
assert.equal(siteDesignCoherenceDelta.baseline,SITE_DESIGN_COHERENCE_BASELINE);
assert.equal(siteDesignCoherenceDelta.baselineTree,'366c71c2dde3a6adbefcc068a88e9ad9e714be90');
assert.equal(siteDesignCoherenceDelta.version,SITE_DESIGN_COHERENCE_VERSION);
export const SITE_DESIGN_COHERENCE_FILES=Object.freeze(Object.keys(siteDesignCoherenceDelta.files));
export const SITE_DESIGN_COHERENCE_ADDITIONS=Object.freeze(Object.keys(siteDesignCoherenceDelta.additions));
export const SITE_DESIGN_COHERENCE_GUARD_FILES=Object.freeze([...siteDesignCoherenceDelta.guardFiles]);
const entryFor=(entries,file)=>typeof file==='string'&&Object.hasOwn(entries,file)?entries[file]:null;
function reverse(entries,file,source){
 const e=entryFor(entries,file);if(!e)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact text/bytes type');
 assert.equal(sha(source),e.after_sha256,file+': exact complete approved input');
 let out=Buffer.isBuffer(source)?source.toString('utf8'):source;
 for(const[start,end,now,old]of [...e.replacements].reverse()){
  assert.equal(out.slice(start,end),now,file+': literal finite UTF16 hunk');out=out.slice(0,start)+old+out.slice(end);
 }
 assert.equal(sha(out),e.before_sha256,file+': complete actualM169 restored');
 return Buffer.isBuffer(source)?Buffer.from(out):out;
}
function atBaseline(entries,file,source){
 const e=entryFor(entries,file);if(!e)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact text/bytes type');
 return sha(source)===e.after_sha256?reverse(entries,file,source):source;
}
export const sourceBeforeSiteDesignCoherence20261014=(file,source)=>reverse(siteDesignCoherenceDelta.files,file,source);
export const sourceAtSiteDesignCoherenceBaseline=(file,source)=>atBaseline(siteDesignCoherenceDelta.files,file,source);
export const publicSourceBeforeSiteDesignCoherence20261014=(file,source)=>reverse(siteDesignCoherenceDelta.publicFiles,file,source);
export const publicSourceAtSiteDesignCoherenceBaseline=(file,source)=>atBaseline(siteDesignCoherenceDelta.publicFiles,file,source);
const root=path.resolve(import.meta.dirname,'..');
function additionsExact(){return SITE_DESIGN_COHERENCE_ADDITIONS.every(f=>{const p=path.join(root,f),e=siteDesignCoherenceDelta.additions[f];return fs.existsSync(p)&&fs.statSync(p).isFile()&&fs.statSync(p).size===e.bytes&&sha(fs.readFileSync(p))===e.sha256;});}
function namesAtBaseline(names,current,prior){
 assert.ok(Array.isArray(names)&&names.every(f=>typeof f==='string'),'Explicit path list');
 return siteDesignCoherenceDelta.provisional===false&&names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify([...current].sort())&&additionsExact()?[...prior]:names;
}
export const sourcePathsAtSiteDesignCoherenceBaseline=names=>namesAtBaseline(names,siteDesignCoherenceDelta.currentSourcePaths,siteDesignCoherenceDelta.baselineSourcePaths);
export const publicPathsAtSiteDesignCoherenceBaseline=names=>namesAtBaseline(names,siteDesignCoherenceDelta.currentPublicPaths,siteDesignCoherenceDelta.baselinePublicPaths);
export function isCurrentSiteDesignCoherence(){return siteDesignCoherenceDelta.provisional===false&&additionsExact()&&SITE_DESIGN_COHERENCE_FILES.every(f=>{const p=path.join(root,f),e=siteDesignCoherenceDelta.files[f];return fs.existsSync(p)&&sha(fs.readFileSync(p))===e.after_sha256;});}
export function historicalSiteDesignBrowserBodies(publishRoot){
 if(!isCurrentSiteDesignCoherence())return new Map();
 const rows=new Map();for(const f of Object.keys(siteDesignCoherenceDelta.publicFiles)){
  if(!/\.(?:html|css|js|json)$/.test(f))continue;
  const raw=fs.readFileSync(path.join(publishRoot,f));assert.equal(sha(raw),siteDesignCoherenceDelta.publicFiles[f].after_sha256,'Exact current compiled input before historical browser rendering');
  rows.set('/'+f,publicSourceBeforeSiteDesignCoherence20261014(f,raw));
 }return rows;
}
