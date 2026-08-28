#!/usr/bin/env python3
"""Validate the canonical Monderman PDF house-style reference."""

from __future__ import annotations

import argparse
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "Monderman_Insight_Built_to_Please_2026-08-27.pdf"
LETTER = (612.0, 792.0)
TOLERANCE = 0.15


def close(actual: float, expected: float, tolerance: float = TOLERANCE) -> bool:
    return abs(float(actual) - expected) <= tolerance


def font_names(reader: PdfReader) -> set[str]:
    names: set[str] = set()
    for page in reader.pages:
        fonts = (page.get("/Resources") or {}).get("/Font") or {}
        for reference in fonts.values():
            base = str(reference.get_object().get("/BaseFont") or "")
            names.add(base.split("+", 1)[-1].lstrip("/"))
    return names


def words_with(page, text: str):
    return [
        word
        for word in page.extract_words(
            extra_attrs=["fontname", "size", "non_stroking_color"]
        )
        if word["text"] == text
    ]


def require_word(page, text: str, *, size: float, font_fragment: str, color=None):
    matches = words_with(page, text)
    if not matches:
        raise AssertionError(f"missing word {text!r}")
    for word in matches:
        if close(word["size"], size) and font_fragment in word["fontname"]:
            if color is None or tuple(word.get("non_stroking_color") or ()) == color:
                return word
    raise AssertionError(
        f"{text!r} does not use {font_fragment} at {size} pt"
    )


def validate(path: Path) -> None:
    reader = PdfReader(path)
    if len(reader.pages) != 13:
        raise AssertionError(f"expected 13 pages, found {len(reader.pages)}")
    for number, page in enumerate(reader.pages, 1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if not (close(width, LETTER[0]) and close(height, LETTER[1])):
            raise AssertionError(f"page {number} is {width} x {height}, not US Letter")

    required_fonts = {
        "NHGX",
        "NHGXMd",
        "NHGX-Bold",
        "NHGX-Italic",
        "NHGX-Bold-Italic",
    }
    missing = required_fonts - font_names(reader)
    if missing:
        raise AssertionError(f"missing embedded house fonts: {sorted(missing)}")

    with pdfplumber.open(path) as document:
        cover = document.pages[0]
        insight = require_word(
            cover, "INSIGHT", size=8.5, font_fragment="NHGX-Bold", color=(1.0, 1.0, 1.0)
        )
        if not close(insight["x0"], 60.0):
            raise AssertionError("cover label does not begin at the 60-point margin")
        require_word(
            cover, "Monderman", size=14.5, font_fragment="NHGX-Bold", color=(1.0, 1.0, 1.0)
        )
        require_word(
            cover, "Built", size=28.0, font_fragment="NHGX-Bold", color=(1.0, 1.0, 1.0)
        )
        require_word(
            cover, "Why", size=15.5, font_fragment="NHGXMd", color=(0.611765, 0.768627, 0.788235)
        )
        require_word(
            cover, "Jason", size=11.0, font_fragment="NHGX-Bold", color=(1.0, 1.0, 1.0)
        )

        frontmatter = document.pages[1]
        heading = require_word(
            frontmatter, "ABOUT", size=10.5, font_fragment="NHGX-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        if not close(heading["x0"], 60.0):
            raise AssertionError("interior heading does not begin at the 60-point margin")
        require_word(
            frontmatter, "This", size=10.0, font_fragment="NHGX", color=(0.137255, 0.156863, 0.172549)
        )

        figure_page = document.pages[7]
        require_word(
            figure_page, "Figure", size=8.3, font_fragment="NHGX-Bold-Italic", color=(0.290196, 0.333333, 0.352941)
        )

        references = document.pages[10]
        require_word(
            references, "REFERENCES", size=10.0, font_fragment="NHGX-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        require_word(
            references, "1.", size=8.6, font_fragment="NHGX", color=(0.227451, 0.262745, 0.282353)
        )

        back = document.pages[12]
        require_word(
            back, "ABOUT", size=9.5, font_fragment="NHGX-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        require_word(
            back, "Governance,", size=8.6, font_fragment="NHGX-Italic", color=(0.290196, 0.333333, 0.352941)
        )

        for number, page in enumerate(document.pages[1:], 2):
            body_words = [
                word
                for word in page.extract_words(extra_attrs=["size"])
                if word["top"] < 730 and word["bottom"] > 55
            ]
            if body_words:
                left = min(word["x0"] for word in body_words)
                right = max(word["x1"] for word in body_words)
                if left < 59.5 or right > 552.5:
                    raise AssertionError(
                        f"page {number} exceeds the 60-point body column: {left:.2f}–{right:.2f}"
                    )

    print(f"PDF house style validated: {path} ({len(reader.pages)} pages)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", nargs="?", type=Path, default=DEFAULT_PDF)
    validate(parser.parse_args().pdf.resolve())
