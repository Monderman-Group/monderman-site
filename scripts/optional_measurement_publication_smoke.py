"""Offline proof of current AI-evidence pins and immutable optional-notice history."""
import hashlib
import json
import re
from pathlib import Path
from unittest.mock import patch

import validate_legal_terms_protection as legal

root = legal.ROOT
read_text = Path.read_text
manifest_path = root / "legal-document-manifest.json"
manifest = json.loads(read_text(manifest_path))
published_path = root / "privacy.html"
archive_path = root / manifest["published_privacy_notice_file"]
ack_path = root / "privacy-2026-09-10-beta.html"
optional_path = root / "privacy-2026-09-10-optional-measurement-v1.html"
published = read_text(published_path)
ack = read_text(ack_path)
checks = 0
mutations = 0


def check(condition, message):
    global checks
    assert condition, message
    checks += 1


legal.validate()
check(True, "full protective legal validation")
check(published == read_text(archive_path), "published edition has an exact archive")
check(hashlib.sha256(ack.encode()).hexdigest() == "b8d0279861a5ab30f9e1c2875d8237c9fb6df92abf02982e309092c3fc138185", "mandatory acknowledged edition remains byte-identical")
check(manifest["privacy_notice_content_sha256"] == manifest["published_privacy_notice_content_sha256"], "approved AI-evidence edition is both the publication and next required notice")
check(manifest["required_acknowledgement"] == {"terms_version": "2026-09-09-beta", "privacy_notice_version": "2026-09-11-ai-evidence-v1"}, "Terms unchanged; next Privacy version explicitly pinned, not a fabricated acceptance")


def sections(text):
    result = {}
    for section in re.findall(r'<section\b[^>]*>[\s\S]*?</section>', legal.content_between_markers(text, "Privacy")):
        label = re.search(r'<p class="section-eyebrow">([^<]+)</p>', section)
        assert label and label[1] not in result
        result[label[1]] = section
    return result


old_sections, new_sections = sections(ack), sections(read_text(optional_path))
check(set(new_sections) == set(old_sections) | {"OPTIONAL MEASUREMENT"}, "only one narrowly scoped section is added")
for label, old in old_sections.items():
    if label not in {"OUR ROLE", "TECHNICAL DATA", "RETENTION &amp; DELETION"}:
        check(new_sections[label] == old, f"existing substantive {label} section is unchanged")
check(published.count('id="optional-measurement"') == 1, "consent-details destination is unambiguous")


def rejects(label, replacements):
    global mutations
    def altered(path, *args, **kwargs):
        return replacements.get(path, read_text(path, *args, **kwargs))
    with patch.object(Path, "read_text", altered):
        try:
            legal.validate()
        except AssertionError:
            check(True, label)
            mutations += 1
        else:
            raise AssertionError(f"mutation was not rejected: {label}")


def changed_manifest(**changes):
    return json.dumps({**manifest, **changes})


rejects("new processing cannot retain the older required acknowledgement", {
    manifest_path: changed_manifest(required_acknowledgement={"terms_version": "2026-09-09-beta", "privacy_notice_version": "2026-09-10-beta"})
})
rejects("legacy required-version field must agree with the reviewed edition", {
    manifest_path: changed_manifest(privacy_notice_version="2026-09-10-beta")
})
rejects("required-edition content fingerprint cannot change", {
    manifest_path: changed_manifest(privacy_notice_content_sha256="0" * 64)
})
rejects("published fingerprint cannot change", {
    manifest_path: changed_manifest(published_privacy_notice_content_sha256="0" * 64)
})
rejects("earlier archived bytes remain immutable", {ack_path: ack + "\n"})
rejects("earlier optional-publication archive remains immutable", {optional_path: read_text(optional_path) + "\n"})
changed_ack = ack.replace("This is not a zero-retention arrangement.", "This is a zero-retention arrangement.")
documents = json.loads(json.dumps(manifest["documents"]))
documents["2026-09-10-beta"]["privacy_notice_file_sha256"] = hashlib.sha256(changed_ack.encode()).hexdigest()
rejects("editing both an old archive and its manifest pin cannot pass", {ack_path: changed_ack, manifest_path: changed_manifest(documents=documents)})
rejects("published wording cannot change without separate review", {published_path: published.replace("does not recall a request already sent", "recalls every request already sent")})
rejects("new published edition cannot be relabeled as the old acknowledged edition", {published_path: published.replace("Version " + legal.PUBLISHED_PRIVACY_VERSION, "Version 2026-09-10-beta")})
rejects("archive must be byte-identical to its published alias", {archive_path: published + "\n"})

print(json.dumps({"ok": True, "checks": checks, "mutationsRejected": mutations, "requiredPrivacy": legal.PRIVACY_VERSION, "publishedPrivacy": legal.PUBLISHED_PRIVACY_VERSION, "scope": "Offline source and mutation checks, including the prior optional-publication scope; no legal acceptance, customer record, browser choice, or network request changed."}))
