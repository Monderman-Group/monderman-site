// Read-only assertions on the generated static artifact.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const root = new URL("../.render-public/", import.meta.url);
const read = name => readFile(new URL(name, root), "utf8");
const manifest = JSON.parse(await read("legal-document-manifest.json"));
let checks=0;
for (const files of Object.values(manifest.documents)) {
  for (const kind of ["terms","privacy_notice"]) {
    if (!files[kind+"_file"]) continue;
    const html=await read(files[kind+"_file"]);
    assert.equal(createHash("sha256").update(html).digest("hex"),files[kind+"_file_sha256"]); checks++;
  }
}
assert.equal(manifest.terms_version,"2026-09-09-beta"); checks++;
assert.equal(manifest.privacy_notice_version,"2026-09-10-beta"); checks++;
for (const page of ["index.html","privacy.html","security.html","pilot.html"]) {
  assert.match(await read(page),/src="assistant\.js\?v=20260910-bounded-chat1"/); checks++;
}
for (const page of ["workspace.html","workspace-diagnostics.html","workspace-analysis.html","workspace-actions.html","workspace-settings.html"]) {
  assert.match(await read(page),/src="workspace-assistant\.js\?v=20260910-bounded-chat1"/); checks++;
}
for (const kind of ["terms","privacy_notice"]) {
  const html=await read(kind==="terms"?"terms.html":"privacy.html");
  const content=html.split("<!-- CONTENT_START -->")[1].split("<!-- CONTENT_END -->")[0].replace(/^\n+|\n+$/g,"")+"\n";
  assert.equal(createHash("sha256").update(content).digest("hex"),manifest[kind+"_content_sha256"]); checks++;
}
console.log(JSON.stringify({ok:true,checks,scope:"Actual build: archived legal bytes, current content hashes, public and Hans cache versions"}));
