#!/usr/bin/env python3
"""Validate the canonical Monderman PDF house-style reference."""

from __future__ import annotations

import argparse
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "Monderman_Insight_Built_to_Please_2026-09-02.pdf"
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
        "NHG55",
        "NHGX55",
        "NHG65-Medium",
        "NHG75-Bold",
        "NHGX75-Bold",
        "NHG56-Italic",
        "NHG76-Bold-Italic",
    }
    missing = required_fonts - font_names(reader)
    if missing:
        raise AssertionError(f"missing embedded house fonts: {sorted(missing)}")

    with pdfplumber.open(path) as document:
        cover = document.pages[0]
        insight = require_word(
            cover, "INSIGHT", size=8.5, font_fragment="75-Bold", color=(1.0, 1.0, 1.0)
        )
        if not close(insight["x0"], 60.0):
            raise AssertionError("cover label does not begin at the 60-point margin")
        # WeasyPrint encodes the September canonical's decorated text and
        # footer rule as paired clipping rectangles. Their delta is the
        # visible rule weight: 2 points for INSIGHT and 1 point for the footer.
        insight_rule_rects = [
            rect for rect in cover.rects
            if close(rect["x0"], 60.0)
            and close(rect["x1"], 111.77124)
            and tuple(rect.get("non_stroking_color") or ()) == (1.0, 1.0, 1.0)
        ]
        if len(insight_rule_rects) != 2 or not close(
            abs(insight_rule_rects[0]["bottom"] - insight_rule_rects[1]["bottom"]),
            2.0,
        ):
            raise AssertionError("cover INSIGHT underline is not the specified 2-point white rule")
        footer_rule_rects = [
            rect for rect in cover.rects
            if close(rect["x0"], 60.0)
            and close(rect["x1"], 552.0)
            and tuple(rect.get("non_stroking_color") or ()) == (0.243137, 0.372549, 0.403922)
        ]
        if len(footer_rule_rects) != 2 or not close(
            abs(footer_rule_rects[0]["top"] - footer_rule_rects[1]["top"]),
            1.0,
        ):
            raise AssertionError("cover footer rule is not the specified 1 point")
        bleed_fixes = [
            rect for rect in cover.rects
            if close(rect["x0"], 0.0)
            and close(rect["x1"], 612.0)
            and close(rect["bottom"], 792.0)
            and rect.get("fill") is True
        ]
        if not bleed_fixes:
            raise AssertionError("cover background does not reach the bottom media-box edge")
        require_word(
            cover, "Monderman", size=14.5, font_fragment="75-Bold", color=(1.0, 1.0, 1.0)
        )
        require_word(
            cover, "Built", size=28.0, font_fragment="75-Bold", color=(1.0, 1.0, 1.0)
        )
        require_word(
            cover, "Why", size=15.5, font_fragment="65-Medium", color=(0.611765, 0.768627, 0.788235)
        )
        require_word(
            cover, "Jason", size=11.0, font_fragment="75-Bold", color=(1.0, 1.0, 1.0)
        )

        frontmatter = document.pages[1]
        heading = require_word(
            frontmatter, "ABOUT", size=10.5, font_fragment="75-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        if not close(heading["x0"], 60.0):
            raise AssertionError("interior heading does not begin at the 60-point margin")
        require_word(
            frontmatter, "This", size=10.0, font_fragment="NHG55", color=(0.137255, 0.156863, 0.172549)
        )

        figure_page = document.pages[7]
        require_word(
            figure_page, "Figure", size=8.3, font_fragment="76-Bold-Italic", color=(0.290196, 0.333333, 0.352941)
        )

        references = document.pages[10]
        require_word(
            references, "REFERENCES", size=10.5, font_fragment="75-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        require_word(
            references, "1.", size=8.6, font_fragment="NHG55", color=(0.227451, 0.262745, 0.282353)
        )
        require_word(
            references, "6.", size=8.6, font_fragment="NHG55", color=(0.227451, 0.262745, 0.282353)
        )
        references_continued = document.pages[11]
        require_word(
            references_continued, "REFERENCES", size=10.5, font_fragment="75-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        require_word(
            references_continued, "7.", size=8.6, font_fragment="NHG55", color=(0.227451, 0.262745, 0.282353)
        )
        require_word(
            references_continued, "12.", size=8.6, font_fragment="NHG55", color=(0.227451, 0.262745, 0.282353)
        )

        back = document.pages[12]
        require_word(
            back, "ABOUT", size=9.5, font_fragment="75-Bold", color=(0.078431, 0.094118, 0.105882)
        )
        require_word(
            back, "Governance,", size=8.6, font_fragment="56-Italic", color=(0.290196, 0.333333, 0.352941)
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
