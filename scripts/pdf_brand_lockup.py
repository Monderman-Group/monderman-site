#!/usr/bin/env python3
"""Apply the canonical Monderman header lockup to published PDF covers."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import argparse

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "pdf-src" / "fonts" / "NeueHaasGroteskText-Bold.ttf"
FONT_NAME = "Monderman-NHG-Bold"

TEAL = HexColor("#0C6E78")
CREAM = HexColor("#FAFAF8")
WHITE = HexColor("#FFFFFF")
DARK_CULTURE = HexColor("#0B3D43")
DARK_INSIGHT = HexColor("#0E3A44")

PAGE_W, PAGE_H = letter
WORDMARK = "Monderman"
WORDMARK_SIZE = 15.0
MARK_SIZE = WORDMARK_SIZE * 1.04
LOCKUP_GAP = WORDMARK_SIZE * (7.0 / 21.12)
LETTER_SPACE = WORDMARK_SIZE * -0.02


@dataclass(frozen=True)
class Publication:
    filename: str
    baseline: float
    old_top: float
    old_bottom: float
    old_right: float
    background: object
    contrast_field: bool
    x: float = 59.5


@dataclass(frozen=True)
class Endorsement:
    baseline: float
    old_top: float
    old_bottom: float
    old_left: float
    old_right: float


PUBLICATIONS = (
    Publication("Monderman_Brief_Accumulated_Drag_Department_of_War.pdf", 675.0, 103.0, 124.0, 277.0, WHITE, False),
    Publication("Monderman_Brief_Compensatory_Systems.pdf", 675.0, 103.0, 124.0, 277.0, WHITE, False),
    Publication("Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf", 675.0, 103.0, 124.0, 277.0, WHITE, False),
    Publication("Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf", 675.0, 103.0, 124.0, 277.0, WHITE, False),
    Publication("Monderman_Brief_The_Culture_Trap.pdf", 718.0, 55.0, 82.0, 224.0, DARK_CULTURE, True, 58.0),
    Publication("Monderman_Insight_After_the_First_Lap.pdf", 680.6, 96.0, 122.0, 270.0, DARK_INSIGHT, True, 59.5),
    Publication("Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf", 668.2, 105.0, 136.0, 291.0, DARK_INSIGHT, True, 59.0),
    Publication("Monderman_Insight_The_Art_of_Interior_Reasoning.pdf", 678.1, 97.0, 122.0, 286.0, DARK_INSIGHT, True, 59.5),
    Publication("Terminal_Fidelity.pdf", 678.1, 97.0, 122.0, 285.0, DARK_INSIGHT, True, 59.5),
)


# Eight publications finish with a legacy spaced wordmark. Replace that closing
# signature as well as the cover so the PDF never presents two brand systems.
END_ENDORSEMENTS = {
    "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf": Endorsement(493.4, 282.0, 306.0, 157.0, 445.0),
    "Monderman_Brief_Compensatory_Systems.pdf": Endorsement(493.4, 282.0, 306.0, 157.0, 445.0),
    "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf": Endorsement(493.4, 282.0, 306.0, 157.0, 445.0),
    "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf": Endorsement(493.4, 282.0, 306.0, 157.0, 445.0),
    "Monderman_Insight_After_the_First_Lap.pdf": Endorsement(363.1, 413.0, 432.0, 236.0, 370.0),
    "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf": Endorsement(429.2, 348.0, 369.0, 227.0, 379.0),
    "Monderman_Insight_The_Art_of_Interior_Reasoning.pdf": Endorsement(413.4, 363.0, 382.0, 201.0, 405.0),
    "Terminal_Fidelity.pdf": Endorsement(125.2, 651.0, 670.0, 201.0, 405.0),
}


def ensure_font() -> None:
    if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def _map_point(x: float, y: float, origin_x: float, origin_y: float, scale: float) -> tuple[float, float]:
    return origin_x + x * scale, origin_y + (64.0 - y) * scale


def draw_map_mark(canvas: Canvas, x: float, y: float, size: float, color=TEAL) -> None:
    """Draw the exact folded-map/M geometry used by the website header."""
    scale = size / 64.0
    canvas.saveState()
    canvas.setStrokeColor(color)
    canvas.setLineJoin(1)

    outer = [(9.5, 15), (20.75, 8), (32, 14), (43.25, 8), (54.5, 15),
             (54.5, 56), (43.25, 49), (32, 55), (20.75, 49), (9.5, 56)]
    path = canvas.beginPath()
    px, py = _map_point(*outer[0], x, y, scale)
    path.moveTo(px, py)
    for point in outer[1:]:
        px, py = _map_point(*point, x, y, scale)
        path.lineTo(px, py)
    path.close()
    canvas.setLineWidth(2.8 * scale)
    canvas.drawPath(path, fill=0, stroke=1)

    canvas.setLineCap(1)
    canvas.setLineWidth(2.4 * scale)
    for x_pos, top, bottom in ((20.75, 8, 49), (32, 14, 55), (43.25, 8, 49)):
        x1, y1 = _map_point(x_pos, top, x, y, scale)
        x2, y2 = _map_point(x_pos, bottom, x, y, scale)
        canvas.line(x1, y1, x2, y2)
    canvas.restoreState()


def lockup_width() -> float:
    ensure_font()
    text_width = pdfmetrics.stringWidth(WORDMARK, FONT_NAME, WORDMARK_SIZE)
    text_width += LETTER_SPACE * (len(WORDMARK) - 1)
    return MARK_SIZE + LOCKUP_GAP + text_width


def draw_header_lockup(
    canvas: Canvas,
    *,
    x: float,
    baseline: float,
    contrast_field: bool = False,
    color=TEAL,
) -> None:
    """Draw the site-header lockup at print scale, preserving its exact proportions."""
    ensure_font()
    if contrast_field:
        field_x = x - 6.0
        field_y = baseline - 8.0
        canvas.setFillColor(CREAM)
        canvas.rect(field_x, field_y, lockup_width() + 12.0, 27.0, fill=1, stroke=0)

    # In the canonical mark, visible geometry occupies y=8..56 of a 64-unit box.
    # This positions that visible height exactly on the M cap-height baseline.
    mark_y = baseline - MARK_SIZE * (8.0 / 64.0)
    draw_map_mark(canvas, x, mark_y, MARK_SIZE, color)

    text = canvas.beginText()
    text.setTextOrigin(x + MARK_SIZE + LOCKUP_GAP, baseline)
    text.setFont(FONT_NAME, WORDMARK_SIZE)
    text.setFillColor(color)
    text.setCharSpace(LETTER_SPACE)
    text.textOut(WORDMARK)
    canvas.drawText(text)


def make_overlay(publication: Publication) -> BytesIO:
    stream = BytesIO()
    canvas = Canvas(stream, pagesize=letter, pageCompression=1)

    # Restore the original cover color across the full legacy wordmark footprint.
    canvas.setFillColor(publication.background)
    canvas.rect(
        publication.x - 4.0,
        PAGE_H - publication.old_bottom,
        publication.old_right - publication.x + 8.0,
        publication.old_bottom - publication.old_top,
        fill=1,
        stroke=0,
    )
    draw_header_lockup(
        canvas,
        x=publication.x,
        baseline=publication.baseline,
        contrast_field=publication.contrast_field,
    )
    canvas.save()
    stream.seek(0)
    return stream


def make_endorsement_overlay(endorsement: Endorsement) -> BytesIO:
    stream = BytesIO()
    canvas = Canvas(stream, pagesize=letter, pageCompression=1)
    canvas.setFillColor(WHITE)
    canvas.rect(
        endorsement.old_left,
        PAGE_H - endorsement.old_bottom,
        endorsement.old_right - endorsement.old_left,
        endorsement.old_bottom - endorsement.old_top,
        fill=1,
        stroke=0,
    )
    draw_header_lockup(
        canvas,
        x=(PAGE_W - lockup_width()) / 2.0,
        baseline=endorsement.baseline,
    )
    canvas.save()
    stream.seek(0)
    return stream


def brand_pdf(source: Path, destination: Path, publication: Publication) -> None:
    reader = PdfReader(source)
    original_pages = len(reader.pages)
    overlay = PdfReader(make_overlay(publication)).pages[0]

    writer = PdfWriter(clone_from=reader)
    writer.pages[0].merge_page(overlay, over=True)
    writer.pages[0].compress_content_streams()
    if endorsement := END_ENDORSEMENTS.get(publication.filename):
        end_overlay = PdfReader(make_endorsement_overlay(endorsement)).pages[0]
        writer.pages[-1].merge_page(end_overlay, over=True)
        writer.pages[-1].compress_content_streams()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        writer.write(handle)

    check = PdfReader(destination)
    if len(check.pages) != original_pages:
        raise RuntimeError(f"Page count changed for {publication.filename}")
    if tuple(float(value) for value in check.pages[0].mediabox) != (0.0, 0.0, PAGE_W, PAGE_H):
        raise RuntimeError(f"Page size changed for {publication.filename}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output" / "pdf")
    args = parser.parse_args()

    for publication in PUBLICATIONS:
        source = args.source_dir / publication.filename
        destination = args.output_dir / publication.filename
        if not source.exists():
            raise FileNotFoundError(source)
        brand_pdf(source, destination, publication)
        print(destination)


if __name__ == "__main__":
    main()
