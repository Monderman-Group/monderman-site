#!/usr/bin/env python3
"""Prove the production cosmetic guard rejects real regressions, not just missing tokens."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts" / "validate_production_cosmetic_certification.py"


def copy_fixture(target: Path) -> None:
    for source in ROOT.iterdir():
        if source.is_file() and source.suffix.lower() != ".pdf":
            shutil.copy2(source, target / source.name)
    shutil.copytree(ROOT / "scripts", target / "scripts", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    brand = target / "assets" / "brand"
    brand.mkdir(parents=True)
    shutil.copy2(ROOT / "assets" / "brand" / "monderman-social-card.png", brand / "monderman-social-card.png")
    shutil.copy2(ROOT / "assets" / "brand" / "monderman-favicon-512.png", brand / "monderman-favicon-512.png")


def validate(fixture: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["MONDERMAN_CERT_ROOT"] = str(fixture)
    return subprocess.run(
        [sys.executable, str(VALIDATOR)],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def rewrite(path: Path, transform) -> None:
    source = path.read_text(encoding="utf-8")
    updated = transform(source)
    if updated == source:
        raise AssertionError(f"mutation did not change {path.name}")
    path.write_text(updated, encoding="utf-8")


def expect_rejection(fixture: Path, label: str, expected: str, mutate, restore: list[str]) -> None:
    mutate()
    result = validate(fixture)
    output = result.stdout + result.stderr
    if result.returncode == 0 or expected not in output:
        raise AssertionError(
            f"guard failed sensitivity case {label!r}; exit={result.returncode}; "
            f"expected={expected!r}\n{output}"
        )
    for relative in restore:
        source = ROOT / relative
        target = fixture / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    print(f"GUARD_SENSITIVITY_REJECTED {label}")


with tempfile.TemporaryDirectory(prefix="monderman-cert-sensitivity-") as temp:
    fixture = Path(temp)
    copy_fixture(fixture)
    baseline = validate(fixture)
    if baseline.returncode:
        raise AssertionError(f"fixture baseline does not certify\n{baseline.stdout}{baseline.stderr}")

    expect_rejection(
        fixture,
        "commented social metadata",
        "real social-card metadata missing",
        lambda: rewrite(
            fixture / "about.html",
            lambda value: re.sub(
                r'(<meta (?:property="og:image"|name="twitter:card")[^>]*>)',
                r'<!-- \1 -->',
                value,
            ),
        ),
        ["about.html"],
    )
    expect_rejection(
        fixture,
        "commented favicon links",
        "real favicon link is missing",
        lambda: rewrite(
            fixture / "about.html",
            lambda value: re.sub(r'(<link[^>]+(?:favicon|apple-touch-icon)[^>]*>)', r'<!-- \1 -->', value),
        ),
        ["about.html"],
    )
    expect_rejection(
        fixture,
        "commented print contract",
        "shared print contract missing",
        lambda: rewrite(
            fixture / "canonical-site-shell.css",
            lambda value: re.sub(r"(@media print\{.*?\n\})", r"/* \1 */", value, count=1, flags=re.S),
        ),
        ["canonical-site-shell.css"],
    )
    expect_rejection(
        fixture,
        "commented noindex",
        "real noindex contract missing",
        lambda: rewrite(
            fixture / "workspace-actions.html",
            lambda value: value.replace(
                '<meta name="robots" content="noindex, nofollow">',
                '<!-- <meta name="robots" content="noindex, nofollow"> -->',
                1,
            ),
        ),
        ["workspace-actions.html"],
    )
    expect_rejection(
        fixture,
        "comment-only taxonomy",
        "homepage Brief taxonomy missing",
        lambda: rewrite(
            fixture / "index.html",
            lambda value: re.sub(
                r'category-brief" data-category="brief"(?=[\s\S]{0,700}How Workarounds Preserve Output While Masking Institutional Dysfunction)',
                'category-perspective" data-category="perspective"<!-- category-brief" data-category="brief" -->',
                value,
                count=1,
            ),
        ),
        ["index.html"],
    )
    expect_rejection(
        fixture,
        "throwing access handoff with comment decoy",
        "uncaught access handoff returned",
        lambda: rewrite(
            fixture / "workspace.html",
            lambda value: value.replace(
                'if (!workspaceAccess?.allowed) await new Promise(function () {});',
                'if (!workspaceAccess?.allowed) throw new Error("workspace_access_not_allowed"); '
                '/* if (!workspaceAccess?.allowed) await new Promise(function () {}); */',
                1,
            ),
        ),
        ["workspace.html"],
    )
    expect_rejection(
        fixture,
        "cropped phone motif with comment decoy",
        "phone tile motif geometry contract missing",
        lambda: rewrite(
            fixture / "index.html",
            lambda value: value.replace(
                'motif.setAttribute("viewBox", compactMotif ? "0 0 344 188" : "0 0 320 164");',
                'motif.setAttribute("viewBox", compactMotif ? "0 0 300 150" : "0 0 320 164"); '
                '/* motif.setAttribute("viewBox", compactMotif ? "0 0 344 188" : "0 0 320 164"); */',
                1,
            ),
        ),
        ["index.html"],
    )
    expect_rejection(
        fixture,
        "missing italic font file",
        "approved italic font asset missing or empty",
        lambda: (fixture / "56font.woff2").unlink(),
        ["56font.woff2"],
    )
    expect_rejection(
        fixture,
        "tool output before document",
        "non-document output precedes the doctype",
        lambda: rewrite(
            fixture / "after-the-first-lap.html",
            lambda value: "Warning: truncated output (original token count: 100094)\nTotal output lines: 395\n\n" + value,
        ),
        ["after-the-first-lap.html"],
    )
    expect_rejection(
        fixture,
        "isolated Action Plan colon",
        "isolated colon placeholder is customer-visible",
        lambda: rewrite(
            fixture / "workspace-actions.html",
            lambda value: value.replace(">No actions</p>", ">: </p>", 1),
        ),
        ["workspace-actions.html"],
    )
    expect_rejection(
        fixture,
        "regressed tablet breakpoint with comment decoy",
        "tablet navigation breakpoint contract missing",
        lambda: rewrite(
            fixture / "canonical-site-shell.css",
            lambda value: value.replace(
                "@media(max-width:1180px)",
                "/* @media(max-width:1180px) */ @media(max-width:760px)",
                1,
            ),
        ),
        ["canonical-site-shell.css"],
    )

    final = validate(fixture)
    if final.returncode:
        raise AssertionError(f"fixture did not return to certified baseline\n{final.stdout}{final.stderr}")

print("CERTIFICATION_GUARD_SENSITIVITY_PASS (11 deliberate regressions rejected)")
