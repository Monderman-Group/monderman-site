// Finite authorized Part7 publication view. Unknown complete bytes stay visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
export const FIXTURE_SHA256='3fea24042a4a3b936977d4af0dead7aa02457b9f09167e4682519153396df47a';
const root=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(new URL('./fixtures/divide-rule-publication-20261025.json',import.meta.url));
assert.equal(sha(raw),FIXTURE_SHA256,'Exact reviewed Part7 fixture');
export const publicationDelta=JSON.parse(raw);
assert.equal(publicationDelta.schema,'divide-rule-publication-20261025-v1');
assert.equal(publicationDelta.baseline,'1c0ba0bd8107e9fab611ccde151007e629cad0da');
function view(entries,file,value){
 if(typeof file!=='string'||!Object.hasOwn(entries,file))return value;
 assert.ok(typeof value==='string'||Buffer.isBuffer(value));
 const e=entries[file];if(sha(value)!==e.after_sha256)return value;
 const b=Buffer.isBuffer(value)?value:Buffer.from(value);assert.equal(b.length,e.after_bytes);
 const packed=publicationDelta.beforeBlobs[e.before_sha256],compressed=Buffer.from(packed,'base64');
 assert.equal(compressed.toString('base64'),packed);
 const prior=inflateSync(compressed,{maxOutputLength:e.before_bytes});assert.equal(prior.length,e.before_bytes);assert.equal(sha(prior),e.before_sha256);
 if(typeof value==='string'){assert.ok(Buffer.from(prior.toString()).equals(prior));return prior.toString();}return prior;
}
export const sourceAtPublicationBaseline=(file,value)=>view(publicationDelta.files,file,value);
export function publicSourceAtPublicationBaseline(file,value){for(const e of Object.values(publicationDelta.publicEditions)){const out=view(e.files,file,value);if(out!==value)return out;}return value;}
function rowExact(root,row){const p=path.join(root,row.path);if(!fs.existsSync(p)||!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink())return false;const b=fs.readFileSync(p);return b.length===row.bytes&&sha(b)===row.sha256&&(!row.mode||(fs.statSync(p).mode&0o111?'100755':'100644')===row.mode);}
function publicNames(root){const names=[];function visit(p){for(const d of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,d.name);if(d.isDirectory())visit(f);else if(d.isFile()||d.isSymbolicLink())names.push(path.relative(root,f).split(path.sep).join('/'));}}visit(root);return names.sort();}
export function publicationSourceExact(){const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n');return names.length===new Set(names).size&&JSON.stringify(names.sort())===JSON.stringify(publicationDelta.currentSourcePaths)&&publicationDelta.sourceRows.every(r=>rowExact(root,r));}
export function publicationPublicExact(root,channel){if(!Object.hasOwn(publicationDelta.publicEditions,channel))return false;const e=publicationDelta.publicEditions[channel];if(JSON.stringify(publicNames(root))!==JSON.stringify(e.currentPaths))return false;return e.currentMap.every(r=>{if(r.path!=='.well-known/monderman-release.json')return rowExact(root,r);const f=path.join(root,r.path);if(fs.lstatSync(f).isSymbolicLink())return false;try{const m=JSON.parse(fs.readFileSync(f));return Object.keys(m).length===1&&/^[a-f0-9]{40}$/.test(m.revision);}catch{return false;}});}
function paths(names,current,prior,exact){assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'));return names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify(current)&&exact?[...prior]:names;}
export const sourcePathsAtPublicationBaseline=names=>paths(names,publicationDelta.currentSourcePaths,publicationDelta.baselineSourcePaths,publicationSourceExact());
export function publicPathsAtPublicationBaseline(names,root){const m=path.join(root,'.well-known/monderman-questionnaire-release.json');if(!fs.existsSync(m))return names;const c=JSON.parse(fs.readFileSync(m)).channel;if(!Object.hasOwn(publicationDelta.publicEditions,c))return names;const e=publicationDelta.publicEditions[c];return paths(names,e.currentPaths,e.baselinePaths,publicationPublicExact(root,c));}
