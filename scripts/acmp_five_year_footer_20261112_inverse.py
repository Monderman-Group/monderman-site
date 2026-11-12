"""Restore only the hash-pinned five-year ACMP footer presentation delta.

Unknown files or bytes pass through unchanged so historical assertions still
reject unrelated edits. This helper never changes source files or Git state.
"""

from __future__ import annotations

from functools import lru_cache
import hashlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256 = "64dd48e2de31940faf5cf92e6a484eca49f00868bb9cd5e800528ac24049b66e"
ACMP_FIVE_YEAR_FOOTER_BASELINE = "ddb638257ce38b3dabf88f0c5ba1c4962d7ae912"
_fixture_bytes = (ROOT / "scripts/fixtures/acmp-five-year-footer-20261112.json").read_bytes()
assert hashlib.sha256(_fixture_bytes).hexdigest() == ACMP_FIVE_YEAR_FOOTER_FIXTURE_SHA256, (
    "Exact reviewed five-year footer fixture"
)
acmp_five_year_footer_delta = json.loads(_fixture_bytes)
assert acmp_five_year_footer_delta["version"] == "acmp-five-year-footer-20261112.1"
assert acmp_five_year_footer_delta["baseline"] == ACMP_FIVE_YEAR_FOOTER_BASELINE
assert len(acmp_five_year_footer_delta["files"]) == 86, "Exact reviewed source-file scope"


@lru_cache(maxsize=86)
def _prior_source(file: str) -> bytes:
    entry = acmp_five_year_footer_delta["files"][file]
    prior = subprocess.check_output(
        ["git", "show", f"{ACMP_FIVE_YEAR_FOOTER_BASELINE}:{file}"], cwd=ROOT
    )
    assert hashlib.sha256(prior).hexdigest() == entry["before_sha256"], (
        f"{file}: exact preceding immutable source"
    )
    return prior


def source_before_acmp_five_year_footer(file: str, source: bytes | str) -> bytes | str:
    entry = acmp_five_year_footer_delta["files"].get(file)
    raw = source.encode("utf-8") if isinstance(source, str) else source
    if entry is None or hashlib.sha256(raw).hexdigest() != entry["after_sha256"]:
        return source
    prior = _prior_source(file)
    return prior.decode("utf-8") if isinstance(source, str) else prior
