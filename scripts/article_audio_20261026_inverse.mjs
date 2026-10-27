// Closed outer narration view. This module never imports an older layer.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import{createHash}from'node:crypto';import{inflateSync}from'node:zlib';import{execFileSync}from'node:child_process';
export const FIXTURE_SHA256='6cb79ad3e5cbc3b0c30129042e61cbf3a432c85f23dd0eda77c289dbca5aeea3';
export const GUARDS=['scripts/article_audio_20261026_inverse.py','scripts/article_audio_20261026_inverse.mjs','scripts/fixtures/article-audio-20261026.json'];
const ROOT=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(root,...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const sameNames=(a,b)=>a.length===new Set(a).size&&JSON.stringify([...a].sort())===JSON.stringify(b);
const fingerprint=s=>[s.dev,s.ino,s.ctimeNs,s.mtimeNs,s.size,s.mode].map(String).join('|');
function normalizedInverse(file,b){const prefix=file.endsWith('.mjs')?'export const ':'';const pattern=new RegExp('^'+prefix+"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'"+(prefix?';$':'$'),'gm');const text=b.toString('utf8');assert.ok(Buffer.from(text).equals(b));const matches=[...text.matchAll(pattern)];assert.equal(matches.length,1,'Exactly one fixture pin literal');return{sha256:sha(text.replace(pattern,prefix+"FIXTURE_SHA256='NORMALIZED_FIXTURE_PIN'"+(prefix?';':''))),token:matches[0][1]};}
function cacheSet(cache,key,value,max){cache.delete(key);cache.set(key,value);if(cache.size>max)cache.delete(cache.keys().next().value);}
function namesIn(root){const names=[];function walk(p){for(const n of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,n.name);if(n.isSymbolicLink())names.push(path.relative(root,f).split(path.sep).join('/'));else if(n.isDirectory())walk(f);else if(n.isFile())names.push(path.relative(root,f).split(path.sep).join('/'));}}walk(root);return names.sort();}
function prior(delta,e){const packed=delta.beforeBlobs[e.before_sha256],compressed=Buffer.from(packed,'base64');assert.equal(compressed.toString('base64'),packed);const b=inflateSync(compressed,{maxOutputLength:e.before_bytes});assert.equal(b.length,e.before_bytes);assert.equal(sha(b),e.before_sha256);return b;}
export class FiniteAudioLayer{
 constructor(root,fixture,pin){
  this.root=path.resolve(root);assert.match(pin,/^[a-f0-9]{64}$/,'Final reviewed fixture pin required');this.pin=pin;this.fixture=path.resolve(fixture);assert.equal(this.fixture,path.resolve(this.root,GUARDS.at(-1)),'Exact fixture source path');this.digests=new Map();this.templates=new Map();const raw=fs.readFileSync(fixture);assert.equal(sha(raw),pin,'Exact reviewed narration fixture');const d=this.delta=JSON.parse(raw);
  assert.equal(d.schema,'article-audio-20261026-v1');assert.deepEqual(d.guardFiles,GUARDS);assert.match(d.baseline,/^[a-f0-9]{40}$/);assert.match(d.baselineTree,/^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(d.guardTemplates).sort(),GUARDS.slice(0,-1).sort());
  for(const k of['currentSourcePaths','baselineSourcePaths','addedSourcePaths','changedSourcePaths']){assert.ok(Array.isArray(d[k]));assert.deepEqual(d[k],[...new Set(d[k])].sort());assert.ok(d[k].every(f=>typeof f==='string'&&!path.isAbsolute(f)&&!f.split('/').includes('..')));}
  assert.deepEqual(d.currentSourcePaths,[...new Set([...d.baselineSourcePaths,...d.addedSourcePaths])].sort());assert.ok(d.addedSourcePaths.every(f=>!d.baselineSourcePaths.includes(f)));
  assert.deepEqual(Object.keys(d.files).sort(),d.changedSourcePaths.filter(f=>!d.addedSourcePaths.includes(f)));
  assert.deepEqual(d.sourceRows.map(r=>r.path).sort(),d.currentSourcePaths.filter(f=>!GUARDS.includes(f)));
  assert.deepEqual(Object.keys(d.publicEditions).sort(),['current','legacy']);assert.equal(d.review.all29_reviewed,true);
  for(const k of['manifest_sha256','voice_identity_sha256','voice_config_sha256','corpus_boundary_audit_sha256','narration_review_sha256'])assert.match(d.review[k],/^[a-f0-9]{64}$/);
  assert.equal(d.articles.length,29);assert.equal(new Set(d.articles.map(a=>a.path)).size,29);
  for(const e of Object.values(d.publicEditions)){assert.deepEqual(e.currentPaths,[...new Set(e.currentPaths)].sort());assert.deepEqual(e.baselinePaths,[...new Set(e.baselinePaths)].sort());assert.deepEqual(e.currentMap.map(r=>r.path).sort(),e.currentPaths);assert.deepEqual(e.currentPaths,[...new Set([...e.baselinePaths,...d.addedPublicPaths])].sort());assert.deepEqual(Object.keys(e.files).sort(),d.articles.map(a=>a.path).sort());}
 }
 digest(f){if(!fs.existsSync(f)||fs.lstatSync(f).isSymbolicLink()||!fs.lstatSync(f).isFile())return null;const before=fs.statSync(f,{bigint:true}),key=fingerprint(before),cached=this.digests.get(f);if(cached?.key===key){cacheSet(this.digests,f,cached,4096);return cached.result;}const b=fs.readFileSync(f);if(fingerprint(fs.statSync(f,{bigint:true}))!==key)return null;const result={bytes:b.length,sha256:sha(b),mode:before.mode&0o111n?'100755':'100644'};cacheSet(this.digests,f,{key,result},4096);return result;}
 guardsExact(){const digest=this.digest(this.fixture);if(!digest||digest.sha256!==this.pin||digest.mode!=='100644')return false;for(const[file,expected]of Object.entries(this.delta.guardTemplates)){const f=path.join(this.root,file);if(!fs.existsSync(f)||fs.lstatSync(f).isSymbolicLink()||!fs.lstatSync(f).isFile())return false;const s=fs.statSync(f,{bigint:true}),key=fingerprint(s),cached=this.templates.get(f);let actual;if(cached?.key===key)actual=cached.actual;else{try{actual=normalizedInverse(file,fs.readFileSync(f));}catch{return false;}if(fingerprint(fs.statSync(f,{bigint:true}))!==key)return false;cacheSet(this.templates,f,{key,actual},4);}if(actual.sha256!==expected.normalized_sha256||actual.token!==this.pin||(s.mode&0o111n?'100755':'100644')!==expected.mode)return false;}return true;}
 rowExact(root,r){const f=path.join(root,r.path);if(!fs.existsSync(f)||fs.lstatSync(f).isSymbolicLink()||!fs.lstatSync(f).isFile())return false;if(r.kind==='release_revision'){const b=fs.readFileSync(f);return b.length===56&&/^\{"revision":"[a-f0-9]{40}"\}\n$/.test(b.toString());}const d=this.digest(f);return Boolean(d&&d.bytes===r.bytes&&d.sha256===r.sha256&&(!r.mode||d.mode===r.mode));}
 sourceNames(){return git(this.root,'ls-files','--cached','--others','--exclude-standard').toString().split('\n').filter(Boolean);}
 sourceExact(){const d=this.delta;return sameNames(this.sourceNames(),d.currentSourcePaths)&&this.guardsExact()&&d.sourceRows.every(r=>this.rowExact(this.root,r));}
 publicExact(root,channel){if(!Object.hasOwn(this.delta.publicEditions,channel))return false;const e=this.delta.publicEditions[channel];return this.sourceExact()&&sameNames(namesIn(root),e.currentPaths)&&e.currentMap.every(r=>this.rowExact(root,r));}
 channel(root){const f=path.join(root,'.well-known/monderman-questionnaire-release.json');if(!fs.existsSync(f)||fs.lstatSync(f).isSymbolicLink())return null;try{const c=JSON.parse(fs.readFileSync(f)).channel;return Object.hasOwn(this.delta.publicEditions,c)?c:null;}catch{return null;}}
 view(entries,file,value,exact){if(typeof file!=='string'||!Object.hasOwn(entries,file))return value;assert.ok(typeof value==='string'||Buffer.isBuffer(value));const e=entries[file];if(sha(value)!==e.after_sha256||!exact())return value;const b=Buffer.isBuffer(value)?value:Buffer.from(value);assert.equal(b.length,e.after_bytes);const p=prior(this.delta,e);if(typeof value==='string'){assert.ok(Buffer.from(p.toString()).equals(p));return p.toString();}return p;}
 sourceView(file,value){return this.view(this.delta.files,file,value,()=>this.sourceExact());}
 publicView(file,value,root=path.join(this.root,'.render-public')){const c=this.channel(root);if(c===null)return value;return this.view(this.delta.publicEditions[c].files,file,value,()=>this.publicExact(root,c));}
 sourcePaths(names){assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'));return sameNames(names,this.delta.currentSourcePaths)&&this.sourceExact()?[...this.delta.baselineSourcePaths]:names;}
 publicPaths(names,root){assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'));const c=this.channel(root);return c!==null&&sameNames(names,this.delta.publicEditions[c].currentPaths)&&this.publicExact(root,c)?[...this.delta.publicEditions[c].baselinePaths]:names;}
 gitBefore(...args){if(!this.sourceExact())return git(this.root,...args);if([['ls-files','--cached','--others','--exclude-standard'],['ls-files','--cached']].some(a=>JSON.stringify(a)===JSON.stringify(args)))return Buffer.from(this.delta.baselineSourcePaths.join('\n')+'\n');if(JSON.stringify(args)===JSON.stringify(['ls-tree','-rl','HEAD']))args=['ls-tree','-rl',this.delta.baseline];if(args.length===4&&['--name-only','--raw'].includes(args[1])&&args[0]==='diff'&&args[3]==='HEAD')args=[...args.slice(0,-1),this.delta.baseline];return git(this.root,...args);}
}
let defaultLayer;
export const audioLayer=()=>defaultLayer??=new FiniteAudioLayer(ROOT,path.join(ROOT,'scripts/fixtures/article-audio-20261026.json'),FIXTURE_SHA256);
export const audioSourceExact=()=>audioLayer().sourceExact();
export const audioPublicExact=(root,channel)=>audioLayer().publicExact(root,channel);
export const sourceAtAudioBaseline=(file,value)=>audioLayer().sourceView(file,value);
export const publicSourceAtAudioBaseline=(file,value,root)=>audioLayer().publicView(file,value,root);
export const sourcePathsAtAudioBaseline=names=>audioLayer().sourcePaths(names);
export const publicPathsAtAudioBaseline=(names,root)=>audioLayer().publicPaths(names,root);
export const audioGit=(...args)=>audioLayer().gitBefore(...args);
