#!/usr/bin/env python3
"""Release gate for the canonical Monderman. wordmark."""

from __future__ import annotations

from pathlib import Path
import re

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
WHITE = (1.0, 1.0, 1.0)
TEAL = (0.047059, 0.431373, 0.470588)


def close(actual: float, expected: float, tolerance: float = 0.35) -> bool:
    return abs(float(actual) - expected) <= tolerance


def validate_markup() -> None:
    stale = (
        r'Monderman<span class="[^"]*dot',
        r'<span class="mf-name">Monderman</span>',
        r'class="monderman-lockup__name">Monderman</',
        r'class="intake-brand-kicker">Monderman</',
        r'class="(?:report-)?wordmark">Monderman</',
        r'class="md-wordmark">Monderman</',
        r'class="close-wordmark[^>]*>Monderman(?:<|$)',
    )
    failures: list[str] = []
    display_signatures = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8", errors="ignore")
        for pattern in stale:
            if re.search(pattern, source):
                failures.append(f"{path.name}: stale periodless wordmark")
                break
        display_signatures += len(re.findall(r"Monderman\.</(?:span|b|div|p|a)>", source))
    if display_signatures < 70:
        failures.append(f"only {display_signatures} explicit wordmark signatures found")

    report_source = (ROOT / "monderman-report.js").read_text(encoding="utf-8")
    for token in ("Monderman. ", "MONDERMAN. ", ">Monderman.</p>"):
        if token not in report_source:
            failures.append(f"monderman-report.js: missing {token!r}")

    social_source = (ROOT / "scripts" / "generate_social_card.py").read_text(encoding="utf-8")
    if '"Monderman."' not in social_source:
        failures.append("canonical social-card generator is periodless")
    if "draw.rectangle((252, 217" in social_source:
        failures.append("canonical social card still uses the detached square accent")

    for path in sorted((ROOT / "assets" / "research").glob("*-social.svg")):
        source = path.read_text(encoding="utf-8")
        if "MONDERMAN." not in source:
            failures.append(f"{path.name}: periodless social-card masthead")

    if failures:
        raise AssertionError("\n".join(failures))


def validate_pdfs() -> None:
    publications = sorted(ROOT.glob("*.pdf"))
    if len(publications) != 16:
        raise AssertionError(f"expected 16 published PDFs, found {len(publications)}")
    for path in publications:
        with pdfplumber.open(path) as document:
            cover = document.pages[0].extract_words(
                extra_attrs=["fontname", "size", "non_stroking_color"]
            )
            names = [
                word for word in cover
                if word["text"] == "Monderman"
                and 14.0 <= float(word["size"]) <= 15.5
                and tuple(word.get("non_stroking_color") or ()) == WHITE
            ]
            periods = [
                word for word in cover
                if word["text"] == "."
                and 14.0 <= float(word["size"]) <= 15.5
                and tuple(word.get("non_stroking_color") or ()) == WHITE
            ]
            if len(names) != 1 or not any(
                close(period["x0"], names[0]["x1"]) for period in periods
            ):
                raise AssertionError(f"{path.name}: cover wordmark period is missing or mis-spaced")

            closing = [
                word
                for word in document.pages[-1].extract_words(
                    extra_attrs=["fontname", "size", "non_stroking_color"]
                )
                if word["text"] == "Monderman."
                and close(word["size"], 16.0)
                and tuple(word.get("non_stroking_color") or ()) == TEAL
                and close(word["x0"], 268.33)
                and close(word["x1"], 365.61)
            ]
            if len(closing) != 1:
                raise AssertionError(f"{path.name}: closing wordmark is missing or off-center")


def main() -> None:
    validate_markup()
    validate_pdfs()
    print("Wordmark period validated across site signatures, report output, social cards, and 16 PDFs")


if __name__ == "__main__":
    main()
