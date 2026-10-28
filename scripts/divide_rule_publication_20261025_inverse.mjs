// Finite authorized Part7 publication view. Unknown complete bytes stay visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {sourceAtAudioBaseline,publicSourceAtAudioBaseline,sourcePathsAtAudioBaseline,publicPathsAtAudioBaseline,capturedAudioIO,assertCapturedAudioFixture,sourceAtCapturedAudioBaseline,publicSourceAtCapturedAudioBaseline,sourcePathsAtCapturedAudioBaseline,publicPathsAtCapturedAudioBaseline} from './article_audio_20261026_inverse.mjs';
export const FIXTURE_SHA256='73b64320951ec620302ebc13fede21ebac1303632859b3ee1f00c3820e544355';
const root=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(new URL('./fixtures/divide-rule-publication-20261025.json',import.meta.url));
assert.equal(sha(raw),FIXTURE_SHA256,'Exact reviewed Part7 fixture');
export const publicationDelta=JSON.parse(raw);
assert.equal(publicationDelta.schema,'divide-rule-publication-20261025-v1');
assert.equal(publicationDelta.baseline,'1c0ba0bd8107e9fab611ccde151007e629cad0da');

function freezeCapturedData(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeCapturedData(child);Object.freeze(value);}return value;}
const privatePublication=freezeCapturedData(JSON.parse(raw));
function publicationData(edition){if(edition===undefined)return publicationDelta;assertCapturedAudioFixture(edition,root,'scripts/fixtures/divide-rule-publication-20261025.json',FIXTURE_SHA256);return privatePublication;}
const editionIO=edition=>edition===undefined?fs:capturedAudioIO(edition,root);
function view(entries,file,value,edition){
 const publicationDelta=publicationData(edition);
 if(typeof file!=='string'||!Object.hasOwn(entries,file))return value;
 assert.ok(typeof value==='string'||Buffer.isBuffer(value));
 const e=entries[file];if(sha(value)!==e.after_sha256)return value;
 const b=Buffer.isBuffer(value)?value:Buffer.from(value);assert.equal(b.length,e.after_bytes);
 const packed=publicationDelta.beforeBlobs[e.before_sha256],compressed=Buffer.from(packed,'base64');
 assert.equal(compressed.toString('base64'),packed);
 const prior=inflateSync(compressed,{maxOutputLength:e.before_bytes});assert.equal(prior.length,e.before_bytes);assert.equal(sha(prior),e.before_sha256);
 if(typeof value==='string'){assert.ok(Buffer.from(prior.toString()).equals(prior));return prior.toString();}return prior;
}
export const sourceAtPublicationBaseline=(file,value,edition)=>view(publicationData(edition).files,file,edition===undefined?sourceAtAudioBaseline(file,value):sourceAtCapturedAudioBaseline(edition,file,value),edition);
export function publicSourceAtPublicationBaseline(file,value,publishRoot,edition){const publicationDelta=publicationData(edition);if(edition===undefined)value=publicSourceAtAudioBaseline(file,value,publishRoot);else value=publicSourceAtCapturedAudioBaseline(edition,file,value,publishRoot);for(const e of Object.values(publicationDelta.publicEditions)){const out=view(e.files,file,value,edition);if(out!==value)return out;}return value;}
function rowExact(rootPath,row,edition){const io=editionIO(edition),p=path.join(rootPath,row.path);if(!io.existsSync(p)||!io.lstatSync(p).isFile()||io.lstatSync(p).isSymbolicLink())return false;const raw=io.readFileSync(p),b=edition!==undefined?raw:path.resolve(rootPath)===path.resolve(import.meta.dirname,'..')?sourceAtAudioBaseline(row.path,raw):publicSourceAtAudioBaseline(row.path,raw,rootPath);return b.length===row.bytes&&sha(b)===row.sha256&&(!row.mode||(io.statSync(p).mode&0o111?'100755':'100644')===row.mode);}
function publicNames(rootPath,edition){const io=editionIO(edition),names=[];function visit(p){for(const d of io.readdirSync(p,{withFileTypes:true})){const f=path.join(p,d.name);if(d.isDirectory())visit(f);else if(d.isFile()||d.isSymbolicLink())names.push(path.relative(rootPath,f).split(path.sep).join('/'));}}visit(rootPath);return edition===undefined?publicPathsAtAudioBaseline(names.sort(),rootPath):names.sort();}
export function publicationSourceExact(edition){const publicationDelta=publicationData(edition),names=edition===undefined?sourcePathsAtAudioBaseline(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n')):editionIO(edition).sourceNames();return names.length===new Set(names).size&&JSON.stringify(names.sort())===JSON.stringify(publicationDelta.currentSourcePaths)&&publicationDelta.sourceRows.every(r=>rowExact(root,r,edition));}
export function publicationPublicExact(publishRoot,channel,edition){const publicationDelta=publicationData(edition),io=editionIO(edition);if(edition!==undefined){const bound=capturedAudioIO(edition,root,publishRoot);assert.equal(channel,bound.channel,'Captured exact channel binding');}if(!Object.hasOwn(publicationDelta.publicEditions,channel))return false;const e=publicationDelta.publicEditions[channel];if(JSON.stringify(publicNames(publishRoot,edition))!==JSON.stringify(e.currentPaths))return false;return e.currentMap.every(r=>{if(r.path!=='.well-known/monderman-release.json')return rowExact(publishRoot,r,edition);const f=path.join(publishRoot,r.path);if(io.lstatSync(f).isSymbolicLink())return false;try{const m=JSON.parse(io.readFileSync(f));return Object.keys(m).length===1&&/^[a-f0-9]{40}$/.test(m.revision);}catch{return false;}});}
function paths(names,current,prior,exact){assert.ok(Array.isArray(names)&&names.every(n=>typeof n==='string'));return names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify(current)&&exact?[...prior]:names;}
export const sourcePathsAtPublicationBaseline=(names,edition)=>{const publicationDelta=publicationData(edition);return paths(edition===undefined?sourcePathsAtAudioBaseline(names):sourcePathsAtCapturedAudioBaseline(edition,names),publicationDelta.currentSourcePaths,publicationDelta.baselineSourcePaths,publicationSourceExact(edition));};
export function publicPathsAtPublicationBaseline(names,publishRoot,edition){const publicationDelta=publicationData(edition),io=editionIO(edition);if(edition===undefined)names=publicPathsAtAudioBaseline(names,publishRoot);else names=publicPathsAtCapturedAudioBaseline(edition,names,publishRoot);const m=path.join(publishRoot,'.well-known/monderman-questionnaire-release.json');if(!io.existsSync(m))return names;const c=JSON.parse(io.readFileSync(m)).channel;if(!Object.hasOwn(publicationDelta.publicEditions,c))return names;const e=publicationDelta.publicEditions[c];return paths(names,e.currentPaths,e.baselinePaths,publicationPublicExact(publishRoot,c,edition));}
