// Read-only assertions on the generated static artifact.
import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
const root = new URL("../.render-public/", import.meta.url);
const sourceRoot = new URL("../", import.meta.url);
const read = name => readFile(new URL(name, root), "utf8");
const readSource = name => readFile(new URL(name, sourceRoot), "utf8");
const manifest = JSON.parse(await read("legal-document-manifest.json"));
let checks=0;
const hash = text => createHash("sha256").update(text).digest("hex");
const startMarker = "<!-- CONTENT_START -->";
const endMarker = "<!-- CONTENT_END -->";
const markedContent = (html, label) => {
  assert.equal(html.split(startMarker).length, 2, `${label}: exactly one content start marker`);
  assert.equal(html.split(endMarker).length, 2, `${label}: exactly one content end marker`);
  const start = html.indexOf(startMarker) + startMarker.length;
  const end = html.indexOf(endMarker);
  assert.ok(end > start, `${label}: content markers must be ordered`);
  return html.slice(start, end);
};
const archivedContent = (html, name) => {
  if (name !== "terms-2026-08-20-beta.html") return markedContent(html, name);
  // This first Terms edition predates content markers. Pin its entire main
  // element, without allowing a fallback for any newer or malformed edition.
  const blocks = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/gi) || [];
  assert.equal(blocks.length, 1, `${name}: exactly one legacy legal main block`);
  return blocks[0];
};
assert.deepEqual(manifest, JSON.parse(await readSource("legal-document-manifest.json")), "built manifest matches repository manifest"); checks++;
assert.equal(manifest.file_hash_scope, "repository_source_html"); checks++;
const recordedArchives = Object.values(manifest.documents).flatMap(files =>
  [files.terms_file, files.privacy_notice_file].filter(Boolean)).sort();
const archiveNames = entries => entries.filter(name => /^(?:terms|privacy)-\d{4}-\d{2}-\d{2}-(?:beta|optional-measurement-v1|ai-evidence-v1)\.html$/.test(name)).sort();
assert.deepEqual(recordedArchives, archiveNames(await readdir(sourceRoot)), "every source legal edition is pinned"); checks++;
assert.deepEqual(recordedArchives, archiveNames(await readdir(root)), "every pinned legal edition is built"); checks++;
for (const files of Object.values(manifest.documents)) {
  for (const kind of ["terms","privacy_notice"]) {
    if (!files[kind+"_file"]) continue;
    const name=files[kind+"_file"];
    const source=await readSource(name);
    const html=await read(name);
    // Historical full-file hashes describe the immutable repository sources.
    // The build still normalizes presentation, as it did before this release.
    assert.equal(hash(source),files[kind+"_file_sha256"], `${name}: immutable source fingerprint`); checks++;
    assert.equal(archivedContent(html, name),archivedContent(source, name), `${name}: built legal content is byte-for-byte unchanged`); checks++;
  }
}
assert.equal(manifest.terms_version,"2026-09-09-beta"); checks++;
assert.equal(manifest.privacy_notice_version,"2026-09-11-ai-evidence-v1"); checks++;
assert.deepEqual(manifest.required_acknowledgement,{terms_version:"2026-09-09-beta",privacy_notice_version:"2026-09-11-ai-evidence-v1"}); checks++;
assert.equal(manifest.published_privacy_notice_version,"2026-09-11-ai-evidence-v1"); checks++;
assert.equal(manifest.published_privacy_notice_file,"privacy-2026-09-11-ai-evidence-v1.html"); checks++;
for (const page of ["index.html","privacy.html","security.html","pilot.html"]) {
  assert.match(await read(page),/src="assistant\.js\?v=20260910-bounded-chat1"/); checks++;
}
for (const page of ["workspace.html","workspace-diagnostics.html","workspace-analysis.html","workspace-actions.html","workspace-settings.html"]) {
  assert.match(await read(page),/src="workspace-assistant\.js\?v=20260910-bounded-chat1"/); checks++;
}
for (const [page, hashKey] of [
  ["terms.html","terms_content_sha256"],
  ["privacy-2026-09-11-ai-evidence-v1.html","privacy_notice_content_sha256"],
  ["privacy.html","published_privacy_notice_content_sha256"]
]) {
  const content=markedContent(await read(page), page).replace(/^\n+|\n+$/g,"")+"\n";
  assert.equal(hash(content),manifest[hashKey]); checks++;
}
assert.equal(markedContent(await read("privacy.html"),"published Privacy"),markedContent(await read(manifest.published_privacy_notice_file),"published archive")); checks++;
console.log(JSON.stringify({ok:true,checks,archives:recordedArchives.length,scope:"Repository: immutable legal source fingerprints. Build: exact archived legal content, current content hashes, public and Hans cache versions. Full served-artifact bytes require the separate release comparison."}));
