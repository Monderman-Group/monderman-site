// Exact article-only transition. Unknown complete bytes and path sets stay visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
export const HIRING_PUBLICATION_BASELINE = '76690a65c53794cb1e35f512221e51ddd0c6525b';
// UNBOUND DATA template: null is a required future whole-fixture pin, never an execution fallback.
export const HIRING_PUBLICATION_FIXTURE_SHA256 = 'e5adce9a0cebe668a32899ce4a7bdbc694e5d4c674a24a32a328b284ae3a3cd3';
assert.ok(typeof HIRING_PUBLICATION_FIXTURE_SHA256 === 'string' && /^[a-f0-9]{64}$/.test(HIRING_PUBLICATION_FIXTURE_SHA256), 'Final combined fixture pin is required');
const raw = fs.readFileSync(new URL('./fixtures/hiring-blind-spot-publication-20261015.json', import.meta.url));
assert.equal(sha(raw), HIRING_PUBLICATION_FIXTURE_SHA256);
const combined = JSON.parse(raw);
assert.equal(combined.schema, 'native267-publication-plus-owner-sodi-v1');
const stored = combined.publicationSublayer;
assert.equal(stored.bytes, 435801);assert.equal(stored.sha256, '7554155126cae721883f5a2f784116d03687dbb7922ea5bd278d6c10c1f84b59');
const nativeRaw = Buffer.from(stored.originalFixtureBase64, 'base64');
assert.equal(nativeRaw.toString('base64'), stored.originalFixtureBase64, 'Canonical original native fixture encoding');assert.equal(nativeRaw.length, stored.bytes);assert.equal(sha(nativeRaw), stored.sha256);
export const hiringPublicationDelta = JSON.parse(nativeRaw);
assert.ok(isDeepStrictEqual(hiringPublicationDelta, stored.parsedNativeDelta), 'Parsed native publication sublayer is unchanged');
assert.equal(hiringPublicationDelta.baseline, HIRING_PUBLICATION_BASELINE);
assert.equal(hiringPublicationDelta.version, 'hiring-blind-spot-publication-20261015.2');
export const hiringOwnerDelta = combined.ownerDelta;
export const OWNER_BASELINE = '8431a47bbc8d253a9ef6ef20de8227458f48d3b0';
assert.equal(hiringOwnerDelta.baseline, OWNER_BASELINE);assert.equal(hiringOwnerDelta.baselineTree, '6890268b552f95094a595f29a6a8200ae1f62198');assert.equal(hiringOwnerDelta.provisional, false, 'Final owner scope is required');
assert.ok(hiringOwnerDelta.files && Object.keys(hiringOwnerDelta.files).length > 0 && Array.isArray(hiringOwnerDelta.nonGuardSourceRows));
assert.ok(isDeepStrictEqual(hiringOwnerDelta.guardRoots, hiringPublicationDelta.guardFiles), 'Same four bootstrap guard roots');
assert.ok(isDeepStrictEqual(hiringOwnerDelta.baselineSourcePaths, hiringPublicationDelta.currentSourcePaths) && isDeepStrictEqual(hiringOwnerDelta.currentSourcePaths, hiringPublicationDelta.currentSourcePaths), 'No source additions are hidden');
assert.equal(hiringOwnerDelta.nonGuardSourceRows.length, 807);
assert.ok(isDeepStrictEqual(hiringOwnerDelta.nonGuardSourceRows.map(row=>row.path).sort(),hiringPublicationDelta.currentSourcePaths.filter(file=>!hiringOwnerDelta.guardRoots.includes(file))), 'Exact unique807 non-bootstrap rows');
assert.ok(Object.keys(hiringOwnerDelta.files).every(file=>hiringPublicationDelta.currentSourcePaths.includes(file)&&!hiringOwnerDelta.guardRoots.includes(file)), 'Only closed existing non-bootstrap owner entries');
assert.ok(isDeepStrictEqual(Object.keys(hiringOwnerDelta.publicEditions).sort(),Object.keys(hiringPublicationDelta.publicEditions).sort()), 'Exactly the original two official public channels');
for(const edition of Object.values(hiringOwnerDelta.publicEditions)){
 assert.ok(isDeepStrictEqual(edition.currentMap.map(row=>row.path).sort(),hiringPublicationDelta.currentPublicPaths), 'Exact unique331 public map rows');
 assert.ok(Object.keys(edition.files).every(file=>hiringPublicationDelta.currentPublicPaths.includes(file)&&file!=='.well-known/monderman-release.json'), 'Only closed non-marker owner public entries');
}

function ownerReverse(entry, file, source) {
  assert.ok(typeof source === 'string' || Buffer.isBuffer(source), 'Owner exact text/bytes type');
  if (entry.encoding === 'base64') assert.ok(Buffer.isBuffer(source), file + ': finite binary input stays bytes');
  const raw = typeof source === 'string' ? Buffer.from(source) : source;
  assert.equal(raw.length, entry.after_bytes, file + ': complete current owner byte length');assert.equal(sha(raw), entry.after_sha256, file + ': complete current owner hash');
  if (entry.encoding === 'base64') {
    const before = Buffer.from(entry.before_base64, 'base64');assert.equal(before.toString('base64'), entry.before_base64, file + ': canonical binary inverse');assert.equal(before.length, entry.before_bytes);assert.equal(sha(before), entry.before_sha256);return before;
  }
  assert.equal(entry.encoding, 'utf8');assert.ok(Buffer.from(raw.toString('utf8')).equals(raw), file + ': lossless UTF8 owner input');
  let value = raw.toString('utf8');
  for (const [start, end, current, prior] of [...entry.replacements].reverse()) {assert.ok(value.slice(start, end) === current, file + ': owner literal inverse mismatch');value = value.slice(0, start) + prior + value.slice(end);}
  const before = Buffer.from(value);assert.equal(before.length, entry.before_bytes);assert.equal(sha(before), entry.before_sha256);return typeof source === 'string' ? value : before;
}
function ownerView(entries, file, source, strict = false) {
  const entry = typeof file === 'string' && Object.hasOwn(entries, file) ? entries[file] : null;
  if (!entry) return source;
  assert.ok(typeof source === 'string' || Buffer.isBuffer(source), 'Owner exact text/bytes type');
  if (entry.encoding === 'base64') assert.ok(Buffer.isBuffer(source), file + ': finite binary input stays bytes');
  return strict || sha(source) === entry.after_sha256 ? ownerReverse(entry, file, source) : source;
}
export const sourceAtOwnerDeltaBaseline = (file, source) => ownerView(hiringOwnerDelta.files, file, source);
export const sourceBeforeOwnerDelta = (file, source) => ownerView(hiringOwnerDelta.files, file, source, true);
export function publicSourceAtOwnerDeltaBaseline(file, source) {
  for (const edition of Object.values(hiringOwnerDelta.publicEditions)) {const result = ownerView(edition.files, file, source);if (result !== source) return result;}
  return source;
}
export function publicSourceBeforeOwnerDelta(file, source, channel) {assert.ok(Object.hasOwn(hiringOwnerDelta.publicEditions, channel), 'Known exact owner channel');return ownerView(hiringOwnerDelta.publicEditions[channel].files, file, source, true);}
export function ownerSourceExact() {
  return hiringOwnerDelta.nonGuardSourceRows.every(row => {const p = path.join(root, row.path);if (!fs.existsSync(p) || !fs.lstatSync(p).isFile() || fs.lstatSync(p).isSymbolicLink()) return false;const stat = fs.lstatSync(p), b = fs.readFileSync(p);return b.length === row.bytes && sha(b) === row.sha256 && (stat.mode & 0o111 ? '100755' : '100644') === row.mode && createHash('sha1').update(Buffer.from('blob ' + b.length + '\0')).update(b).digest('hex') === row.gitBlobSha1;});
}
export function ownerPublicExact(publishRoot, channel) {
  if (!Object.hasOwn(hiringOwnerDelta.publicEditions, channel)) return false;
  return hiringOwnerDelta.publicEditions[channel].currentMap.every(row => {const p = path.join(publishRoot, row.path);if (!fs.existsSync(p) || !fs.lstatSync(p).isFile() || fs.lstatSync(p).isSymbolicLink()) return false;const b = fs.readFileSync(p);if (row.path === '.well-known/monderman-release.json') {const marker = JSON.parse(b);return Object.keys(marker).length === 1 && /^[a-f0-9]{40}$/.test(marker.revision);}return b.length === row.bytes && sha(b) === row.sha256;});
}

function reverse(entry, source) {
  assert.ok(typeof source === 'string' || Buffer.isBuffer(source));
  assert.equal(sha(source), entry.after_sha256, 'Only complete approved publication bytes may project');
  let value = Buffer.isBuffer(source) ? source.toString('utf8') : source;
  for (const [start, end, current, prior] of [...entry.replacements].reverse()) {
    assert.equal(value.slice(start, end), current);
    value = value.slice(0, start) + prior + value.slice(end);
  }
  assert.equal(sha(value), entry.before_sha256);
  return Buffer.isBuffer(source) ? Buffer.from(value) : value;
}
function view(entries, file, source) {
  const entry = typeof file === 'string' && Object.hasOwn(entries, file) ? entries[file] : null;
  if (!entry) return source;
  assert.ok(typeof source === 'string' || Buffer.isBuffer(source));
  return sha(source) === entry.after_sha256 ? reverse(entry, source) : source;
}
export const sourceAtHiringPublicationBaseline = (file, source) => view(hiringPublicationDelta.files, file, sourceAtOwnerDeltaBaseline(file, source));
export function publicSourceAtHiringPublicationBaseline(file, source) {
  source = publicSourceAtOwnerDeltaBaseline(file, source);
  for (const edition of Object.values(hiringPublicationDelta.publicEditions)) {
    const result = view(edition.files, file, source);
    if (result !== source) return result;
  }
  return source;
}
function exact(rootPath, entries) {
  return Object.entries(entries).every(([file, entry]) => {
    const filePath = path.join(rootPath, file);
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile() || fs.lstatSync(filePath).isSymbolicLink()) return false;
    const bytes = fs.readFileSync(filePath);
    return bytes.length === entry.bytes && sha(bytes) === entry.sha256;
  });
}
function sourceExact() {
  return ownerSourceExact() && exact(root, hiringPublicationDelta.additions) && Object.entries(hiringPublicationDelta.files).every(([file, entry]) => {
    const filePath = path.join(root, file);
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile() && !fs.lstatSync(filePath).isSymbolicLink() && sha(sourceAtOwnerDeltaBaseline(file, fs.readFileSync(filePath))) === entry.after_sha256;
  });
}
function paths(names, current, prior, exactMatch) {
  assert.ok(Array.isArray(names) && names.every(name => typeof name === 'string'));
  return names.length === new Set(names).size && JSON.stringify([...names].sort()) === JSON.stringify(current) && exactMatch ? [...prior] : names;
}
export const sourcePathsAtHiringPublicationBaseline = names => paths(names, hiringPublicationDelta.currentSourcePaths, hiringPublicationDelta.baselineSourcePaths, sourceExact());
export function publicPathsAtHiringPublicationBaseline(names, publishRoot = process.env.SCOPE_BETA_BUILD_ROOT || process.env.SITE_DESIGN_BUILD_ROOT || path.join(root, '.render-public')) {
  const marker = path.join(publishRoot, '.well-known/monderman-questionnaire-release.json');
  if (!fs.existsSync(marker)) return names;
  const channel = JSON.parse(fs.readFileSync(marker)).channel;
  if (!Object.hasOwn(hiringPublicationDelta.publicEditions, channel)) return names;
  const edition = hiringPublicationDelta.publicEditions[channel];
  const exactMatch = ownerPublicExact(publishRoot, channel) && exact(publishRoot, edition.additions) && Object.entries(edition.files).every(([file, entry]) => {
    const filePath = path.join(publishRoot, file);
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile() && !fs.lstatSync(filePath).isSymbolicLink() && sha(publicSourceAtOwnerDeltaBaseline(file, fs.readFileSync(filePath))) === entry.after_sha256;
  });
  return paths(names, hiringPublicationDelta.currentPublicPaths, hiringPublicationDelta.baselinePublicPaths, exactMatch);
}
