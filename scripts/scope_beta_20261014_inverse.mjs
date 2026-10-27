import {capturedAudioIO,assertCapturedAudioFixture,withCapturedAudioBaselineEdition} from './article_audio_20261026_inverse.mjs';
import {seriesDelta} from './hiring_work_design_series_20261017_inverse.mjs';
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
function freezeCapturedData(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeCapturedData(child);Object.freeze(value);}return value;}
const privateScope=freezeCapturedData(JSON.parse(bytes));
function scopeData(edition){if(edition===undefined)return scopeBetaDelta;assertCapturedAudioFixture(edition,root,'scripts/fixtures/scope-beta-20261014.json',SCOPE_BETA_FIXTURE_SHA256);return privateScope;}
const editionIO=edition=>edition===undefined?fs:capturedAudioIO(edition,root);
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
export const sourceBeforeScopeBeta20261014=(file,source,edition)=>reverse(scopeData(edition).files,file,sourceAtHiringPublicationBaseline(file,source,edition));
export const sourceAtScopeBetaBaseline=(file,source,edition)=>atBaseline(scopeData(edition).files,file,sourceAtHiringPublicationBaseline(file,source,edition));
export const publicSourceBeforeScopeBetaChannel20261014=(file,source,edition)=>reverse(scopeData(edition).channelVariants||{},file,publicSourceAtHiringPublicationBaseline(file,source,edition));
export const publicSourceAtScopeBetaChannelBaseline=(file,source,edition)=>atBaseline(scopeData(edition).channelVariants||{},file,publicSourceAtHiringPublicationBaseline(file,source,edition));
export const publicSourceBeforeScopeBeta20261014=(file,source,edition)=>reverse(scopeData(edition).publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source,edition));
export const publicSourceAtScopeBetaBaseline=(file,source,edition)=>atBaseline(scopeData(edition).publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source,edition));
const root=path.resolve(import.meta.dirname,'..');
function additionsExact(edition){const scopeBetaDelta=scopeData(edition),io=editionIO(edition);return (edition===undefined?SCOPE_BETA_ADDITIONS:Object.keys(scopeBetaDelta.additions)).every(f=>{const p=path.join(root,f),e=scopeBetaDelta.additions[f];if(!io.existsSync(p)||!io.statSync(p).isFile())return false;const b=sourceAtHiringPublicationBaseline(f,io.readFileSync(p),edition);return b.length===e.bytes&&sha(b)===e.sha256;});}
function namesAtBaseline(names,current,prior,edition){
 const scopeBetaDelta=scopeData(edition);
 assert.ok(Array.isArray(names)&&names.every(f=>typeof f==='string'),'Explicit path list');
 return scopeBetaDelta.provisional===false&&names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify([...current].sort())&&additionsExact(edition)?[...prior]:names;
}
export const sourcePathsAtScopeBetaBaseline=(names,edition)=>namesAtBaseline(sourcePathsAtHiringPublicationBaseline(names,edition),scopeData(edition).currentSourcePaths,scopeData(edition).baselineSourcePaths,edition);
export const publicPathsAtScopeBetaBaseline=(names,edition)=>namesAtBaseline(publicPathsAtHiringPublicationBaseline(names,undefined,edition),scopeData(edition).currentPublicPaths,scopeData(edition).baselinePublicPaths,edition);
export function isCurrentScopeBeta(edition){const scopeBetaDelta=scopeData(edition),io=editionIO(edition);return scopeBetaDelta.provisional===false&&additionsExact(edition)&&(edition===undefined?SCOPE_BETA_FILES:Object.keys(scopeBetaDelta.files)).every(f=>{const p=path.join(root,f),e=scopeBetaDelta.files[f];return io.existsSync(p)&&sha(sourceAtHiringPublicationBaseline(f,io.readFileSync(p),edition))===e.after_sha256;});}
export function historicalScopeBetaBrowserBodies(publishRoot){publishRoot=path.resolve(publishRoot);return withCapturedAudioBaselineEdition(publishRoot,edition=>historicalScopeBetaCapturedBodies(publishRoot,edition));}
function historicalScopeBetaCapturedBodies(publishRoot,edition){
 const scopeBetaDelta=scopeData(edition),io=editionIO(edition);if(!isCurrentScopeBeta(edition))return new Map();
 const channel=assertScopeBetaBuiltEdition(publishRoot,edition);
 const rows=new Map();for(const f of Object.keys(scopeBetaDelta.publicFiles)){

  if(!/\.(?:html|css|js|json)$/.test(f))continue;
  const raw=publicSourceAtScopeBetaChannelBaseline(f,io.readFileSync(path.join(publishRoot,f)),edition);assert.equal(sha(raw),scopeBetaDelta.publicFiles[f].after_sha256,'Exact current compiled input before historical browser rendering');
  rows.set('/'+f,publicSourceBeforeScopeBeta20261014(f,raw,edition));
 }
 // Only exact owner files outside the original historical text map are added.
 const ownerFixture=JSON.parse(io.readFileSync(path.join(root,'scripts/fixtures/hiring-blind-spot-publication-20261015.json'))),seriesFixture=JSON.parse(io.readFileSync(path.join(root,'scripts/fixtures/hiring-work-design-series-20261017.json')));
 for(const f of Object.keys(ownerFixture.ownerDelta.publicEditions[channel].files)){
  if(rows.has('/'+f))continue;
  const raw=io.readFileSync(path.join(publishRoot,f));
  rows.set('/'+f,publicSourceAtScopeBetaBaseline(f,raw,edition));
 }
 for(const f of Object.keys(seriesFixture.publicEditions[channel].files)){if(rows.has('/'+f))continue;rows.set('/'+f,publicSourceAtScopeBetaBaseline(f,io.readFileSync(path.join(publishRoot,f)),edition));}
 return rows;
}

export function assertScopeBetaPublicAdditions(publishRoot,edition){const scopeBetaDelta=scopeData(edition),io=editionIO(edition);for(const[f,e]of Object.entries(scopeBetaDelta.publicAdditions)){const b=publicSourceAtHiringPublicationBaseline(f,io.readFileSync(path.join(publishRoot,f)),edition);assert.equal(sha(b),e.sha256,'Exact new public addition '+f);assert.equal(b.length,e.bytes,'Exact new public addition length '+f);}}

export function assertScopeBetaBuiltEdition(publishRoot,edition){const scopeBetaDelta=scopeData(edition),io=editionIO(edition);if(edition!==undefined)capturedAudioIO(edition,root,publishRoot);assert.equal(scopeBetaDelta.provisional,false,'Draft built editions cannot certify');const inventory=(d,prefix='')=>io.readdirSync(d,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink(),'No public symlinks');return e.isDirectory()?inventory(path.join(d,e.name),prefix+e.name+'/'):e.isFile()?[prefix+e.name]:[];});assert.deepEqual(publicPathsAtHiringPublicationBaseline(inventory(publishRoot).sort(),publishRoot,edition),scopeBetaDelta.currentPublicPaths,'Exact whole physical compiled closure');const marker=JSON.parse(io.readFileSync(path.join(publishRoot,'.well-known/monderman-questionnaire-release.json')));assert.ok(Object.hasOwn(scopeBetaDelta.publicEditions,marker.channel),'Known official questionnaire channel');for(const r of scopeBetaDelta.publicEditions[marker.channel]){if(r.path==='.well-known/monderman-release.json')continue;const b=publicSourceAtHiringPublicationBaseline(r.path,io.readFileSync(path.join(publishRoot,r.path)),edition);assert.equal(sha(b),r.sha256,'Whole single-channel compiled vector '+r.path);assert.equal(b.length,r.bytes,'Whole channel byte length '+r.path);}assert.match(JSON.parse(io.readFileSync(path.join(publishRoot,'.well-known/monderman-release.json'))).revision,/^[a-f0-9]{40}$/,'Actual source revision marker');return marker.channel;}
