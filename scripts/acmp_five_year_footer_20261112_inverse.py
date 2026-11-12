"""Restore only the hash-pinned five-year ACMP footer presentation delta.

Unknown files or bytes pass through unchanged so historical assertions still
reject unrelated edits. All prior text is pinned here; no Git runtime is needed.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256 = "811134a2998dd82c2d15aafaea2070742794348c776699f90f60d1fcc246b7eb"
ACMP_FIVE_YEAR_FOOTER_BASELINE = "ddb638257ce38b3dabf88f0c5ba1c4962d7ae912"
_fixture_bytes = (ROOT / "scripts/fixtures/acmp-five-year-footer-20261112.json").read_bytes()
assert hashlib.sha256(_fixture_bytes).hexdigest() == ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256, (
    "Exact reviewed five-year footer fixture"
)
acmp_five_year_footer_delta = json.loads(_fixture_bytes)
assert acmp_five_year_footer_delta["version"] == "acmp-five-year-footer-20261112.1"
assert acmp_five_year_footer_delta["baseline"] == ACMP_FIVE_YEAR_FOOTER_BASELINE
assert len(acmp_five_year_footer_delta["files"]) == 86, "Exact reviewed source-file scope"
assert len(acmp_five_year_footer_delta["prior_footers"]) == 16, "Deduplicated exact preceding footer texts"
assert set(acmp_five_year_footer_delta["prior_sources"]) == {
    "footer-membership.css", "scripts/render-static-build.sh"
}
for digest, text in acmp_five_year_footer_delta["prior_footers"].items():
    assert hashlib.sha256(text.encode("utf-8")).hexdigest() == digest, (
        "Every preceding footer matches its independent identity"
    )
for file, text in acmp_five_year_footer_delta["prior_sources"].items():
    assert hashlib.sha256(text.encode("utf-8")).hexdigest() == acmp_five_year_footer_delta["files"][file]["before_sha256"], (
        f"{file}: pinned preceding source text"
    )
_footer_pattern = re.compile(
    r'<footer\b(?=[^>]*\bclass=["\'][^"\']*\bmond-footer\b[^"\']*["\'])[^>]*>[\s\S]*?</footer>'
)


def source_before_acmp_five_year_footer(file: str, source: bytes | str) -> bytes | str:
    entry = acmp_five_year_footer_delta["files"].get(file)
    raw = source.encode("utf-8") if isinstance(source, str) else source
    if entry is None or hashlib.sha256(raw).hexdigest() != entry["after_sha256"]:
        return source
    if file in acmp_five_year_footer_delta["prior_sources"]:
        restored = acmp_five_year_footer_delta["prior_sources"][file]
    else:
        assert file.endswith(".html"), f"{file}: only the finite HTML footer scope may be restored"
        current = source if isinstance(source, str) else source.decode("utf-8")
        matches = list(_footer_pattern.finditer(current))
        assert len(matches) == 1, f"{file}: one exact current shared footer"
        match = matches[0]
        assert hashlib.sha256(match[0].encode("utf-8")).hexdigest() == acmp_five_year_footer_delta["new_footer_sha256"], (
            f"{file}: exact reviewed current footer"
        )
        prior_footer = acmp_five_year_footer_delta["prior_footers"][entry["prior_footer_sha256"]]
        restored = current[:match.start()] + prior_footer + current[match.end():]
    restored_bytes = restored.encode("utf-8")
    assert hashlib.sha256(restored_bytes).hexdigest() == entry["before_sha256"], (
        f"{file}: complete preceding source recovered without Git"
    )
    return restored if isinstance(source, str) else restored_bytes
