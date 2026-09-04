#!/usr/bin/env python3
"""Restore the period to the canonical wordmark in every published PDF.

The cover treatment preserves the existing lockup and adds the final glyph at
the exact continuation point of its embedded Neue Haas Grotesk wordmark. The
closing-page lockup is redrawn as a centered unit so adding the period does not
leave the signature optically off-center.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import shutil

import pdfplumber
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from pdf_brand_lockup import draw_map_mark


ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "tmp" / "pdfs" / "brand-period-output"
FONT_PATH = ROOT / "pdf-src" / "fonts" / "NeueHaasGroteskText-Bold.ttf"
FONT_NAME = "Monderman-Wordmark-Bold"
PAGE_W, PAGE_H = letter
TEAL = HexColor("#0C6E78")

CLOSING_SIZE = 16.0
CLOSING_MARK_SIZE = CLOSING_SIZE * 1.04
CLOSING_GAP = CLOSING_SIZE * (7.0 / 21.12)
CLOSING_BASELINE = 396.0
CLOSING_WORDMARK = "Monderman."


def ensure_font() -> None:
    if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def cover_word(path: Path) -> dict | None:
    with pdfplumber.open(path) as document:
        words = document.pages[0].extract_words(
            extra_attrs=["fontname", "size", "non_stroking_color"]
        )
        matches = [
            word
            for word in words
            if word["text"] == "Monderman"
            and 14.0 <= float(word["size"]) <= 15.5
            and tuple(word.get("non_stroking_color") or ()) == (1.0, 1.0, 1.0)
        ]
    if len(matches) != 1:
        raise RuntimeError(f"{path.name}: expected one cover wordmark, found {len(matches)}")
    word = matches[0]
    existing_period = any(
        candidate["text"] == "."
        and abs(float(candidate["x0"]) - float(word["x1"])) <= 0.35
        and 14.0 <= float(candidate["size"]) <= 15.5
        and tuple(candidate.get("non_stroking_color") or ()) == (1.0, 1.0, 1.0)
        for candidate in words
    )
    return None if existing_period else word


def make_cover_overlay(word: dict) -> BytesIO:
    ensure_font()
    size = float(word["size"])
    _, descent = pdfmetrics.getAscentDescent(FONT_NAME, size)
    glyph_y0 = PAGE_H - float(word["bottom"])
    baseline = glyph_y0 - descent
    # The 15-point house-style covers use -0.02em tracking. The newer
    # 14.5-point covers use the font's natural sidebearings.
    tracking = size * -0.02 if size >= 14.75 else 0.0
    x = float(word["x1"]) + tracking

    stream = BytesIO()
    canvas = Canvas(stream, pagesize=letter, pageCompression=1, invariant=1)
    canvas.setFont(FONT_NAME, size)
    canvas.setFillColor(white)
    canvas.drawString(x, baseline, ".")
    canvas.save()
    stream.seek(0)
    return stream


def closing_lockup_width() -> float:
    text = pdfmetrics.stringWidth(CLOSING_WORDMARK, FONT_NAME, CLOSING_SIZE)
    return CLOSING_MARK_SIZE + CLOSING_GAP + text


def make_closing_overlay() -> BytesIO:
    ensure_font()
    stream = BytesIO()
    canvas = Canvas(stream, pagesize=letter, pageCompression=1, invariant=1)

    # Clear only the existing signature; the tagline directly below remains
    # untouched. The new period is therefore part of the type, never a badge.
    canvas.setFillColor(white)
    canvas.rect(242.0, 391.0, 128.0, 23.0, fill=1, stroke=0)

    x = (PAGE_W - closing_lockup_width()) / 2.0
    mark_y = CLOSING_BASELINE - CLOSING_MARK_SIZE * (8.0 / 64.0)
    draw_map_mark(canvas, x, mark_y, CLOSING_MARK_SIZE, TEAL)
    canvas.setFont(FONT_NAME, CLOSING_SIZE)
    canvas.setFillColor(TEAL)
    canvas.drawString(
        x + CLOSING_MARK_SIZE + CLOSING_GAP,
        CLOSING_BASELINE,
        CLOSING_WORDMARK,
    )
    canvas.save()
    stream.seek(0)
    return stream


def update_pdf(source: Path, destination: Path) -> None:
    word = cover_word(source)
    reader = PdfReader(source)
    original_pages = len(reader.pages)
    writer = PdfWriter(clone_from=reader)
    if word is not None:
        writer.pages[0].merge_page(PdfReader(make_cover_overlay(word)).pages[0], over=True)
    writer.pages[-1].merge_page(PdfReader(make_closing_overlay()).pages[0], over=True)
    writer.pages[0].compress_content_streams()
    writer.pages[-1].compress_content_streams()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        writer.write(handle)
    if len(PdfReader(destination).pages) != original_pages:
        raise RuntimeError(f"{source.name}: page count changed")


def main() -> None:
    publications = sorted(ROOT.glob("*.pdf"))
    if len(publications) != 16:
        raise RuntimeError(f"expected 16 published PDFs, found {len(publications)}")
    STAGING.mkdir(parents=True, exist_ok=True)
    for source in publications:
        staged = STAGING / source.name
        update_pdf(source, staged)
        shutil.copy2(staged, source)
        print(source.name)


if __name__ == "__main__":
    main()
