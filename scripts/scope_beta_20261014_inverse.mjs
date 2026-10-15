// Exact current design leaf. Unknown edits and additions are never normalized away.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const SCOPE_BETA_BASELINE='f2a81afdd30863c68b4ae748936163a141b0edd6';
export const SCOPE_BETA_VERSION='q2-sodi-20261015.16';
export const SCOPE_BETA_FIXTURE_SHA256='03c262b1182116c63d7a015f5750fc38f24271676f3f92a1701655e5490f053e';
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
 if(e.encoding!==undefined)assert.equal(e.encoding,'base64',file+': known finite binary encoding');
 if(e.encoding==='base64')assert.ok(Buffer.isBuffer(source),file+': finite binary input stays bytes');
 assert.equal(sha(source),e.after_sha256,file+': exact complete approved input');
 if(e.encoding==='base64'){
  assert.ok(Number.isSafeInteger(e.before_bytes)&&e.before_bytes>=0&&Number.isSafeInteger(e.after_bytes)&&e.after_bytes===source.length,file+': finite binary byte sizes');
  assert.ok(Array.isArray(e.replacements)&&e.replacements.length>0,file+': nonempty literal binary hunks');
  const decode=value=>{assert.equal(typeof value,'string',file+': literal base64 type');const b=Buffer.from(value,'base64');assert.equal(b.toString('base64'),value,file+': canonical literal base64');return b;};
  let previousEnd=0;const rows=[];
  for(const row of e.replacements){
   assert.ok(Array.isArray(row)&&row.length===4,file+': exact binary hunk tuple');const[start,end,now,old]=row;
   assert.ok(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=previousEnd&&end>=start&&end<=source.length,file+': finite ordered nonoverlapping byte offsets');
   const current=decode(now),prior=decode(old);assert.equal(end-start,current.length,file+': binary hunk byte length');assert.deepEqual(source.subarray(start,end),current,file+': exact finite binary hunk');rows.push([start,end,prior]);previousEnd=end;
  }
  let out=Buffer.from(source);for(const[start,end,prior]of rows.reverse())out=Buffer.concat([out.subarray(0,start),prior,out.subarray(end)]);
  assert.equal(out.length,e.before_bytes,file+': complete original binary size');assert.equal(sha(out),e.before_sha256,file+': complete actualF2A81 binary restored');return out;
 }
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
 if(e.encoding!==undefined)assert.equal(e.encoding,'base64',file+': known finite binary encoding');
 if(e.encoding==='base64')assert.ok(Buffer.isBuffer(source),file+': finite binary input stays bytes');
 return sha(source)===e.after_sha256?reverse(entries,file,source):source;
}
export const sourceBeforeScopeBeta20261014=(file,source)=>reverse(scopeBetaDelta.files,file,source);
export const sourceAtScopeBetaBaseline=(file,source)=>atBaseline(scopeBetaDelta.files,file,source);
export const publicSourceBeforeScopeBetaChannel20261014=(file,source)=>reverse(scopeBetaDelta.channelVariants||{},file,source);
export const publicSourceAtScopeBetaChannelBaseline=(file,source)=>atBaseline(scopeBetaDelta.channelVariants||{},file,source);
export const publicSourceBeforeScopeBeta20261014=(file,source)=>reverse(scopeBetaDelta.publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source));
export const publicSourceAtScopeBetaBaseline=(file,source)=>atBaseline(scopeBetaDelta.publicFiles,file,publicSourceAtScopeBetaChannelBaseline(file,source));
const root=path.resolve(import.meta.dirname,'..');
function additionsExact(){return SCOPE_BETA_ADDITIONS.every(f=>{const p=path.join(root,f),e=scopeBetaDelta.additions[f];return fs.existsSync(p)&&fs.statSync(p).isFile()&&fs.statSync(p).size===e.bytes&&sha(fs.readFileSync(p))===e.sha256;});}
function namesAtBaseline(names,current,prior){
 assert.ok(Array.isArray(names)&&names.every(f=>typeof f==='string'),'Explicit path list');
 return scopeBetaDelta.provisional===false&&names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify([...current].sort())&&additionsExact()?[...prior]:names;
}
export const sourcePathsAtScopeBetaBaseline=names=>namesAtBaseline(names,scopeBetaDelta.currentSourcePaths,scopeBetaDelta.baselineSourcePaths);
export const publicPathsAtScopeBetaBaseline=names=>namesAtBaseline(names,scopeBetaDelta.currentPublicPaths,scopeBetaDelta.baselinePublicPaths);
export function isCurrentScopeBeta(){return scopeBetaDelta.provisional===false&&additionsExact()&&SCOPE_BETA_FILES.every(f=>{const p=path.join(root,f),e=scopeBetaDelta.files[f];return fs.existsSync(p)&&sha(fs.readFileSync(p))===e.after_sha256;});}
export function historicalScopeBetaBrowserBodies(publishRoot){
 if(!isCurrentScopeBeta())return new Map();
 assertScopeBetaBuiltEdition(publishRoot);
 const rows=new Map();for(const f of Object.keys(scopeBetaDelta.publicFiles)){

  const historicalPhotoPaths=["assets/marketing/work-discussion-540.webp","assets/marketing/work-discussion-960.webp","assets/marketing/work-discussion-1600.webp","assets/marketing/work-discussion-960.jpg","assets/marketing/team-perspectives-540.webp","assets/marketing/team-perspectives-960.webp","assets/marketing/team-perspectives-1600.webp","assets/marketing/team-perspectives-960.jpg"];
  if(!/\.(?:html|css|js|json)$/.test(f)&&!historicalPhotoPaths.includes(f))continue;
  if(historicalPhotoPaths.includes(f))assert.equal(scopeBetaDelta.publicFiles[f].encoding,'base64','Only eight named exact photographic byte inverses join historical browser rendering');
  const raw=publicSourceAtScopeBetaChannelBaseline(f,fs.readFileSync(path.join(publishRoot,f)));assert.equal(sha(raw),scopeBetaDelta.publicFiles[f].after_sha256,'Exact current compiled input before historical browser rendering');
  rows.set('/'+f,publicSourceBeforeScopeBeta20261014(f,raw));
 }return rows;
}

export function assertScopeBetaPublicAdditions(publishRoot){for(const[f,e]of Object.entries(scopeBetaDelta.publicAdditions)){const b=fs.readFileSync(path.join(publishRoot,f));assert.equal(sha(b),e.sha256,'Exact new public addition '+f);assert.equal(b.length,e.bytes,'Exact new public addition length '+f);}}

export function assertScopeBetaBuiltEdition(publishRoot){assert.equal(scopeBetaDelta.provisional,false,'Draft built editions cannot certify');const inventory=(d,prefix='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{assert.ok(!e.isSymbolicLink(),'No public symlinks');return e.isDirectory()?inventory(path.join(d,e.name),prefix+e.name+'/'):e.isFile()?[prefix+e.name]:[];});assert.deepEqual(inventory(publishRoot).sort(),scopeBetaDelta.currentPublicPaths,'Exact whole physical compiled closure');const marker=JSON.parse(fs.readFileSync(path.join(publishRoot,'.well-known/monderman-questionnaire-release.json')));assert.ok(Object.hasOwn(scopeBetaDelta.publicEditions,marker.channel),'Known official questionnaire channel');for(const r of scopeBetaDelta.publicEditions[marker.channel]){if(r.path==='.well-known/monderman-release.json')continue;const b=fs.readFileSync(path.join(publishRoot,r.path));assert.equal(sha(b),r.sha256,'Whole single-channel compiled vector '+r.path);assert.equal(b.length,r.bytes,'Whole channel byte length '+r.path);}assert.match(JSON.parse(fs.readFileSync(path.join(publishRoot,'.well-known/monderman-release.json'))).revision,/^[a-f0-9]{40}$/,'Actual source revision marker');return marker.channel;}
