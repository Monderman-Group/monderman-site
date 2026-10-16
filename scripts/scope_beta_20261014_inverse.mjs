// Exact current design leaf. Unknown edits and additions are never normalized away.
import {sourceAtHiringPublicationBaseline, publicSourceAtHiringPublicationBaseline, sourcePathsAtHiringPublicationBaseline, publicPathsAtHiringPublicationBaseline, hiringOwnerDelta} from './hiring_blind_spot_publication_20261015_inverse.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const SCOPE_BETA_BASELINE='f2a81afdd30863c68b4ae748936163a141b0edd6';
export const SCOPE_BETA_VERSION='q2-sodi-20261015.10';
export const SCOPE_BETA_FIXTURE_SHA256='323763faac9606b8dc4f0912fd251955819a3bf4ebcfe95eaf2217c91b098a7d';
const bytes=fs.readFileSync(new URL('./fixtures/scope-beta-20261014.json',import.meta.url));
assert.equal(sha(bytes),SCOPE_BETA_FIXTURE_SHA256,'Exact separately reviewed design fixture');
export const scopeBetaDelta=JSON.parse(bytes);
assert.equal(scopeBetaDelta.baseline,SCOPE_BETA_BASELINE);
assert.equal(scopeBetaDelta.baselineTree,'38b4396e74757fac9f90780e81ca821d41aaa785');
assert.equal(scopeBetaDelta.version,SCOPE_BETA_VERSION);
export const SCOPE_BETA_FILES=Object.freeze(Object.keys(scopeBetaDelta.files));
export const SCOPE_BETA_ADDITIONS=Object.freeze(Object.keys(scopeBetaDelta.additions));
export const SCOPE_BETA_GUARD_FILES=Object.freeze([...scopeBetaDelta.guardFiles]);
const entryFor=(entries,file)=>typeof file==='string'&&Object.hasOwn(entries,file)?entries[file]:null;
function reverse(entries,file,source){
 const e=entryFor(entries,file);if(!e)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact text/bytes type');
 assert.equal(sha(source),e.after_sha256,file+': exact complete approved input');
 let out=Buffer.isBuffer(source)?source.toString('utf8'):source;
 for(const[start,end,now,old]of [...e.replacements].reverse()){
  assert.equal(out.slice(start,end),now,file+': literal finite UTF16 hunk');out=out.slice(0,start)+old+out.slice(end);
 }
 assert.equal(sha(out),e.before_sha256,file+': complete actualF2A81 restored');
 return Buffer.isBuffer(source)?Buffer.from(out):out;
}
function atBaseline(entries,file,source){
 const e=entryFor(entries,file);if(!e)return source;
 assert.ok(typeof source==='string'||Buffer.isBuffer(source),'Exact text/bytes type');
 return sha(source)===e.after_sha256?reverse(entries,file,source):source;
}
export const sourceBeforeScopeBeta20261014=(file,source)=>reverse(scopeBetaDelta.files,file,sourceAtHiringPublicationBaseline(file,source));
export const sourceAtScopeBetaBaseline=(file,source)=>atBaseline(scopeBetaDelta.files,file,sourceAtHiringPublicationBaseline(file,source));
export const publicSourceBeforeScopeBetaChannel20261014=(file,source)=>reverse(scopeBetaDelta.channelVariants||{},file,publicSourceAtHiringPublicationBaseline(file,source));
export const publicSourceAtScopeBetaChannelBaseline=(file,source)=>atBaseline(scopeBetaDelta.channelVariants||{},file,publicSourceAtHiringPublicationBaseline(file,source));
export const publicSourceBeforeScopeBeta20261014=(file,source)=>reverse(scopeBetaDelta.publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source));
export const publicSourceAtScopeBetaBaseline=(file,source)=>atBaseline(scopeBetaDelta.publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source));
const root=path.resolve(import.meta.dirname,'..');
function additionsExact(){return SCOPE_BETA_ADDITIONS.every(f=>{const p=path.join(root,f),e=scopeBetaDelta.additions[f];if(!fs.existsSync(p)||!fs.statSync(p).isFile())return false;const b=sourceAtHiringPublicationBaseline(f,fs.readFileSync(p));return b.length===e.bytes&&sha(b)===e.sha256;});}
function namesAtBaseline(names,current,prior){
 assert.ok(Array.isArray(names)&&names.every(f=>typeof f==='string'),'Explicit path list');
 return scopeBetaDelta.provisional===false&&names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify([...current].sort())&&additionsExact()?[...prior]:names;
}
export const sourcePathsAtScopeBetaBaseline=names=>namesAtBaseline(sourcePathsAtHiringPublicationBaseline(names),scopeBetaDelta.currentSourcePaths,scopeBetaDelta.baselineSourcePaths);
export const publicPathsAtScopeBetaBaseline=names=>namesAtBaseline(publicPathsAtHiringPublicationBaseline(names),scopeBetaDelta.currentPublicPaths,scopeBetaDelta.baselinePublicPaths);
export function isCurrentScopeBeta(){return scopeBetaDelta.provisional===false&&additionsExact()&&SCOPE_BETA_FILES.every(f=>{const p=path.join(root,f),e=scopeBetaDelta.files[f];return fs.existsSync(p)&&sha(sourceAtHiringPublicationBaseline(f,fs.readFileSync(p)))===e.after_sha256;});}
export function historicalScopeBetaBrowserBodies(publishRoot){
 if(!isCurrentScopeBeta())return new Map();
 const channel=assertScopeBetaBuiltEdition(publishRoot);
 const rows=new Map();for(const f of Object.keys(scopeBetaDelta.publicFiles)){

  if(!/\.(?:html|css|js|json)$/.test(f))continue;
  const raw=publicSourceAtScopeBetaChannelBaseline(f,fs.readFileSync(path.join(publishRoot,f)));assert.equal(sha(raw),scopeBetaDelta.publicFiles[f].after_sha256,'Exact current compiled input before historical browser rendering');
  rows.set('/'+f,publicSourceBeforeScopeBeta20261014(f,raw));
 }
 // Only exact owner files outside the original historical text map are added.
 for(const f of Object.keys(hiringOwnerDelta.publicEditions[channel].files)){
  if(rows.has('/'+f))continue;
  const raw=fs.readFileSync(path.join(publishRoot,f));
  rows.set('/'+f,publicSourceAtScopeBetaBaseline(f,raw));
 }return rows;
}

export function assertScopeBetaPublicAdditions(publishRoot){for(const[f,e]of Object.entries(scopeBetaDelta.publicAdditions)){const b=publicSourceAtHiringPublicationBaseline(f,fs.readFileSync(path.join(publishRoot,f)));assert.equal(sha(b),e.sha256,'Exact new public addition '+f);assert.equal(b.length,e.bytes,'Exact new public addition length '+f);}}

export function assertScopeBetaBuiltEdition(publishRoot){assert.equal(scopeBetaDelta.provisional,false,'Draft built editions cannot certify');const inventory=(d,prefix='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink(),'No public symlinks');return e.isDirectory()?inventory(path.join(d,e.name),prefix+e.name+'/'):e.isFile()?[prefix+e.name]:[];});assert.deepEqual(publicPathsAtHiringPublicationBaseline(inventory(publishRoot).sort(),publishRoot),scopeBetaDelta.currentPublicPaths,'Exact whole physical compiled closure');const marker=JSON.parse(fs.readFileSync(path.join(publishRoot,'.well-known/monderman-questionnaire-release.json')));assert.ok(Object.hasOwn(scopeBetaDelta.publicEditions,marker.channel),'Known official questionnaire channel');for(const r of scopeBetaDelta.publicEditions[marker.channel]){if(r.path==='.well-known/monderman-release.json')continue;const b=publicSourceAtHiringPublicationBaseline(r.path,fs.readFileSync(path.join(publishRoot,r.path)));assert.equal(sha(b),r.sha256,'Whole single-channel compiled vector '+r.path);assert.equal(b.length,r.bytes,'Whole channel byte length '+r.path);}assert.match(JSON.parse(fs.readFileSync(path.join(publishRoot,'.well-known/monderman-release.json'))).revision,/^[a-f0-9]{40}$/,'Actual source revision marker');return marker.channel;}
