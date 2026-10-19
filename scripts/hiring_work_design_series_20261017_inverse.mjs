// Exact post-1858 article-series layer. Only complete approved bytes project.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
export const SERIES_FIXTURE_SHA256 = 'c0fcf2c9f87e6562dc43fd30ee033200e78bb7f37bd0fb3e88a67306004bff7a';
const root = path.resolve(import.meta.dirname, '..');
const sha = b => createHash('sha256').update(b).digest('hex');
const raw = fs.readFileSync(new URL('./fixtures/hiring-work-design-series-20261017.json', import.meta.url));
assert.equal(sha(raw), SERIES_FIXTURE_SHA256, 'Exact finite post1858 fixture');
export const seriesDelta = JSON.parse(raw);
assert.equal(seriesDelta.schema, 'hiring-work-design-post1858-v1');
assert.equal(seriesDelta.baseline, '1858c1bfef88e9407b7cd900fb840f230de8bed7');
assert.equal(seriesDelta.baselineTree, '52ff88a9b2ee877fa9c8afc75b2a11cf3b112a78');
export const seriesPublicationPages = Object.freeze(['hiring-blind-spot.html', 'posting-has-outgrown-the-job.html', 'research-topics.html', 'careers.html', 'careers-privacy.html']);
function before(entry, file, value) {
 assert.ok(typeof value === 'string' || Buffer.isBuffer(value), 'Exact text/bytes type');
 const b = Buffer.isBuffer(value) ? value : Buffer.from(value);
 assert.equal(b.length, entry.after_bytes, file + ': complete current length');
 assert.equal(sha(b), entry.after_sha256, file + ': complete current hash');
 const packed = seriesDelta.beforeBlobs[entry.before_sha256];
 assert.ok(typeof packed==='string','Closed exact prior blob');
 const compressed=Buffer.from(packed,'base64');assert.equal(compressed.toString('base64'),packed,'Canonical exact compressed prior bytes');
 const prior=inflateSync(compressed,{maxOutputLength:entry.before_bytes});
 assert.equal(prior.length, entry.before_bytes); assert.equal(sha(prior), entry.before_sha256);
 if (typeof value === 'string') { assert.ok(Buffer.from(prior.toString('utf8')).equals(prior), 'Lossless prior UTF8'); return prior.toString('utf8'); }
 return prior;
}
function view(entries, file, value) {
 if (typeof file !== 'string' || !Object.hasOwn(entries, file)) return value;
 assert.ok(typeof value === 'string' || Buffer.isBuffer(value), 'Exact text/bytes type');
 const entry = entries[file];
 return sha(value) === entry.after_sha256 ? before(entry, file, value) : value;
}
export const sourceAtSeriesBaseline = (file, value) => view(seriesDelta.files, file, value);
export function publicSourceAtSeriesBaseline(file, value) {
 for (const edition of Object.values(seriesDelta.publicEditions)) {const out = view(edition.files, file, value); if (out !== value) return out;}
 return value;
}
export const sourceBeforeSeries = (file, value) => Object.hasOwn(seriesDelta.files,file) ? before(seriesDelta.files[file],file,value) : value;
function rowExact(file, row, value) {return value.length === row.bytes && sha(value) === row.sha256;}
export function seriesSourceExact() {
 return seriesDelta.nonGuardSourceRows.every(row => {const file=path.join(root,row.path); if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())return false;const b=fs.readFileSync(file);return rowExact(file,row,b)&&(fs.statSync(file).mode&0o111?'100755':'100644')===row.mode&&createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')===row.gitBlobSha1;});
}
export function seriesPublicExact(publishRoot, channel) {
 if(!Object.hasOwn(seriesDelta.publicEditions,channel))return false;
 return seriesDelta.publicEditions[channel].currentMap.every(row=>{const file=path.join(publishRoot,row.path);if(!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())return false;const b=fs.readFileSync(file);if(row.path==='.well-known/monderman-release.json'){const m=JSON.parse(b);return Object.keys(m).length===1&&/^[a-f0-9]{40}$/.test(m.revision);}return rowExact(file,row,b);});
}
function paths(names,current,prior,exact){assert.ok(Array.isArray(names)&&names.every(f=>typeof f==='string'));return names.length===new Set(names).size&&JSON.stringify([...names].sort())===JSON.stringify(current)&&exact?[...prior]:names;}
export const sourcePathsAtSeriesBaseline = names => paths(names,seriesDelta.currentSourcePaths,seriesDelta.baselineSourcePaths,seriesSourceExact());
export function publicPathsAtSeriesBaseline(names,publishRoot) {const file=path.join(publishRoot,'.well-known/monderman-questionnaire-release.json');if(!fs.existsSync(file))return names;const c=JSON.parse(fs.readFileSync(file)).channel;return paths(names,seriesDelta.currentPublicPaths,seriesDelta.baselinePublicPaths,seriesPublicExact(publishRoot,c));}
export function assertSeriesPublicationSurface(file, bytes, channel=null) {
 assert.ok(seriesPublicationPages.includes(file), 'Closed series surface');
 const rows=channel===null?seriesDelta.nonGuardSourceRows:seriesDelta.publicEditions[channel]?.currentMap;
 assert.ok(rows,'Known channel');const row=rows.find(r=>r.path===file);assert.ok(row&&rowExact(file,row,bytes),file+': complete current publication surface');return row;
}
