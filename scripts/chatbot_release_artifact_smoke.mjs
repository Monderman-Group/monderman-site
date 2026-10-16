// Read-only assertions on the generated static artifact.
import assert from "node:assert/strict";
import {sourceAtOutreachImageNoticeBaseline} from "./outreach_image_notice_20261008_inverse.mjs";
import {sourceBeforeScopeBeta20261014 as originalLegalSource,publicSourceBeforeScopeBeta20261014 as originalLegalPublicSource} from "./scope_beta_20261014_inverse.mjs";
import {readFile, readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
const root = new URL("../.render-public/", import.meta.url);
const sourceRoot = new URL("../", import.meta.url);
const readRaw = name => readFile(new URL(name, root), "utf8");
const readRawSource = name => readFile(new URL(name, sourceRoot), "utf8");

// Current physical wording and exact original acknowledged-source view are both required.
const legalPresentationFiles = ["privacy.html", "privacy-2026-09-12-ai-source-evidence-v2.html", "privacy-2026-09-19-invited-evaluation.html", "privacy-2026-09-19-invitation-access.html"];
const legalPresentationOriginalHashes = {"privacy.html": "b6425860f43039b0af638a11f3a01f3adffb94a4dc1dcfc7dd885dfdd7b2a7ec", "privacy-2026-09-12-ai-source-evidence-v2.html": "41e4ef0367e55a4bff255934c42ea14b4b4e49a69dca78e4f14357f08bc2e3cc", "privacy-2026-09-19-invited-evaluation.html": "88a0ad179c9f8d24c478789946d7d5895a7721800022aff238f1a7fc81f26bce", "privacy-2026-09-19-invitation-access.html": "c71c0cf3fb3d66b58f4aecd1f52c33dabe6a52e24332548bd7763af294fe149d"};
const legalPresentationSha = text => createHash('sha256').update(text).digest('hex');
function legalPresentationBlock(text) {
  assert.equal(text.split('<!-- CONTENT_START -->').length,2);
  assert.equal(text.split('<!-- CONTENT_END -->').length,2);
  return text.split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0];
}
function verifyLegalPresentation(rawManifestSource, rawSources) {
  const actual=JSON.parse(rawManifestSource), record=actual.presentation_copy;
  assert.deepEqual(Object.keys(record||{}).sort(),['edition','files','original_manifest_fields','original_manifest_sha256','scope']);
  assert.equal(record.edition,'question-set-terminology-20261015.1');
  assert.equal(record.scope,'Eight exact visible terminology substitutions only; legal versions, acceptance and permissions unchanged.');
  assert.equal(record.original_manifest_sha256,'da09807a311fe1084087ee7cc7187178a412916a9d3c2f0d49ae931fd5a69cc0');
  assert.deepEqual(Object.keys(record.files).sort(),[...legalPresentationFiles].sort());
  const originalManifestSource=originalLegalSource('legal-document-manifest.json',rawManifestSource);
  assert.equal(legalPresentationSha(originalManifestSource),record.original_manifest_sha256);
  const original=JSON.parse(originalManifestSource), originalFields={privacy_notice_content_sha256:original.privacy_notice_content_sha256,published_privacy_notice_content_sha256:original.published_privacy_notice_content_sha256,documents:{}};
  for(const file of legalPresentationFiles.filter(f=>f!=='privacy.html')){const version=file.slice(8,-5);originalFields.documents[version]={privacy_notice_file_sha256:original.documents[version].privacy_notice_file_sha256};assert.equal(actual.documents[version].privacy_notice_file_sha256,record.files[file].presented_source_sha256);}
  assert.deepEqual(record.original_manifest_fields,originalFields);
  for(const file of legalPresentationFiles){
    const text=rawSources[file],row=record.files[file];
    assert.deepEqual(Object.keys(row).sort(),['original_marked_content_sha256','original_source_bytes','original_source_sha256','presented_marked_content_sha256','presented_source_bytes','presented_source_sha256','replacements']);
    assert.equal(legalPresentationSha(text),row.presented_source_sha256);assert.equal(Buffer.byteLength(text),row.presented_source_bytes);
    assert.equal(row.original_source_sha256,legalPresentationOriginalHashes[file]);
    assert.equal(row.replacements.length,2);let previousEnd=0;
    for(const [a,z,now,old]of row.replacements){assert.ok(Number.isSafeInteger(a)&&Number.isSafeInteger(z)&&a>=previousEnd&&z>=a);assert.equal(now,'question-set version');assert.equal(old,'questionnaire version');assert.equal(text.slice(a,z),now);previousEnd=z;}
    let restored=text;for(const[a,z,now,old]of [...row.replacements].reverse()){assert.equal(restored.slice(a,z),now);restored=restored.slice(0,a)+old+restored.slice(z);}
    assert.equal(restored,originalLegalSource(file,text));assert.equal(legalPresentationSha(restored),row.original_source_sha256);assert.equal(Buffer.byteLength(restored),row.original_source_bytes);
    assert.equal(legalPresentationSha(legalPresentationBlock(text).replace(/^\n+|\n+$/g,'')+'\n'),row.presented_marked_content_sha256);
    assert.equal(legalPresentationSha(legalPresentationBlock(restored).replace(/^\n+|\n+$/g,'')+'\n'),row.original_marked_content_sha256);
    assert.equal((text.match(/question-set version/g)||[]).length,2);assert.ok(!/questionnaire/i.test(text));
  }
  assert.equal(actual.file_hash_scope,'repository_source_html');
  assert.equal(actual.privacy_notice_content_sha256,record.files['privacy-2026-09-19-invitation-access.html'].presented_marked_content_sha256);
  assert.equal(actual.published_privacy_notice_content_sha256,record.files['privacy.html'].presented_marked_content_sha256);
  const reconstructed=JSON.parse(JSON.stringify(actual));delete reconstructed.presentation_copy;
  for(const key of ['privacy_notice_content_sha256','published_privacy_notice_content_sha256'])reconstructed[key]=originalFields[key];
  for(const[version,fields]of Object.entries(originalFields.documents))Object.assign(reconstructed.documents[version],fields);
  assert.deepEqual(reconstructed,original,'Every legal version, acceptance, permission and unrelated manifest field remains original');
  return {edition:record.edition,currentPhysicalFiles:4,exactPresentationHunks:8,historicalManifestSha256:record.original_manifest_sha256,originalAssertionsBasis:'Exact original-source inverse, not a claim of unchanged presented bytes'};
}

const legalPresentationRawSources=Object.fromEntries(await Promise.all(legalPresentationFiles.map(async file=>[file,await readRawSource(file)])));
const legalPresentationRawManifest=await readRawSource('legal-document-manifest.json');
const legalPresentationProof=verifyLegalPresentation(legalPresentationRawManifest,legalPresentationRawSources);
assert.deepEqual(JSON.parse(await readRaw('legal-document-manifest.json')),JSON.parse(legalPresentationRawManifest),'Actual built manifest preserves truthful current physical provenance');
for(const file of legalPresentationFiles)assert.equal(legalPresentationBlock(await readRaw(file)),legalPresentationBlock(legalPresentationRawSources[file]),file+': actual presented legal content exactly equals actual presented source');
const read = async name => {const raw=await readRaw(name);return legalPresentationFiles.includes(name)||name==='legal-document-manifest.json'?originalLegalPublicSource(name,raw):raw;};
const readSource = async name => {const raw=await readRawSource(name);return legalPresentationFiles.includes(name)||name==='legal-document-manifest.json'?originalLegalSource(name,raw):raw;};
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
const archiveNames = entries => entries.filter(name => /^(?:terms|privacy)-\d{4}-\d{2}-\d{2}-(?:beta|optional-measurement-v1|ai-evidence-v1|ai-source-evidence-v2|annual-plans|invited-evaluation|invitation-access)\.html$/.test(name)).sort();
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
assert.equal(manifest.terms_version,"2026-09-19-invitation-access"); checks++;
assert.equal(manifest.privacy_notice_version,"2026-09-19-invitation-access"); checks++;
assert.deepEqual(manifest.required_acknowledgement,{terms_version:"2026-09-19-invitation-access",privacy_notice_version:"2026-09-19-invitation-access"}); checks++;
assert.equal(manifest.published_privacy_notice_version,"2026-09-19-invitation-access"); checks++;
assert.equal(manifest.published_privacy_notice_file,"privacy-2026-09-19-invitation-access.html"); checks++;
for (const page of ["index.html","privacy.html","security.html","pilot.html"]) {
  assert.match(await read(page),/src="assistant\.js\?v=20260919\.invited1"/); checks++;
}
for (const page of ["workspace.html","workspace-diagnostics.html","workspace-analysis.html","workspace-actions.html","workspace-settings.html"]) {
  assert.match(await read(page),/src="workspace-assistant\.js\?v=20260915.consistency1"/); checks++;
}
const publishedPrivacySource = await readSource("privacy.html");
assert.equal(markedContent(await read("privacy.html"),"built current Privacy"),markedContent(publishedPrivacySource,"current Privacy source"),"Built current Privacy preserves every reviewed notice-content byte"); checks++;
const originalPublishedPrivacy = sourceAtOutreachImageNoticeBaseline("privacy.html",publishedPrivacySource);
for (const [page, hashKey] of [
  ["terms.html","terms_content_sha256"],
  ["privacy-2026-09-19-invitation-access.html","privacy_notice_content_sha256"],
  ["privacy.html","published_privacy_notice_content_sha256"]
]) {
  const content=markedContent(page==="privacy.html"?originalPublishedPrivacy:await read(page), page).replace(/^\n+|\n+$/g,"")+"\n";
  assert.equal(hash(content),manifest[hashKey]); checks++;
}
assert.equal(markedContent(originalPublishedPrivacy,"published Privacy"),markedContent(await read(manifest.published_privacy_notice_file),"published archive")); checks++;
console.log(JSON.stringify({ok:true,checks,archives:recordedArchives.length,legalPresentation:legalPresentationProof,scope:"Current physical source and built legal presentation are exact; all original archive/content assertions use the finite original-source reconstruction. Public/Hans cache checks retained. Full served bytes require separate release comparison."}));
