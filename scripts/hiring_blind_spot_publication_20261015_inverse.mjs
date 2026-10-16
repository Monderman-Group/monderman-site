// Exact article-only transition. Unknown complete bytes and path sets stay visible.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const sha = value => createHash('sha256').update(value).digest('hex');
export const HIRING_PUBLICATION_BASELINE = '76690a65c53794cb1e35f512221e51ddd0c6525b';
export const HIRING_PUBLICATION_FIXTURE_SHA256 = '7554155126cae721883f5a2f784116d03687dbb7922ea5bd278d6c10c1f84b59';
const raw = fs.readFileSync(new URL('./fixtures/hiring-blind-spot-publication-20261015.json', import.meta.url));
assert.equal(sha(raw), HIRING_PUBLICATION_FIXTURE_SHA256);
export const hiringPublicationDelta = JSON.parse(raw);
assert.equal(hiringPublicationDelta.baseline, HIRING_PUBLICATION_BASELINE);
assert.equal(hiringPublicationDelta.version, 'hiring-blind-spot-publication-20261015.2');

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
export const sourceAtHiringPublicationBaseline = (file, source) => view(hiringPublicationDelta.files, file, source);
export function publicSourceAtHiringPublicationBaseline(file, source) {
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
  return exact(root, hiringPublicationDelta.additions) && Object.entries(hiringPublicationDelta.files).every(([file, entry]) => {
    const filePath = path.join(root, file);
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile() && !fs.lstatSync(filePath).isSymbolicLink() && sha(fs.readFileSync(filePath)) === entry.after_sha256;
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
  const exactMatch = exact(publishRoot, edition.additions) && Object.entries(edition.files).every(([file, entry]) => {
    const filePath = path.join(publishRoot, file);
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile() && !fs.lstatSync(filePath).isSymbolicLink() && sha(fs.readFileSync(filePath)) === entry.after_sha256;
  });
  return paths(names, hiringPublicationDelta.currentPublicPaths, hiringPublicationDelta.baselinePublicPaths, exactMatch);
}
