#!/usr/bin/env python3
"""Release gate for every public Monderman publication PDF.

This deliberately checks the defect classes that escaped visual review before:
page geometry, reference-page starts, canonical interior hierarchy, genuine NHG
italic on closing pages, and the Terminal Fidelity opening-section reflow.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

from apply_publication_house_style import PUBLICATIONS


ROOT = Path(__file__).resolve().parents[1]
LETTER = (612.0, 792.0)
TOLERANCE = 0.2


@dataclass(frozen=True)
class TypeCheck:
    filename: str
    page_number: int
    text: str
    size: float
    font_fragment: str


TYPE_CHECKS = (
    TypeCheck(
        "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf",
        3,
        "structurally",
        20.5,
        "Bold",
    ),
    TypeCheck(
        "Monderman_Brief_Compensatory_Systems.pdf",
        3,
        "movement",
        20.5,
        "Bold",
    ),
    TypeCheck(
        "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf",
        3,
        "largest",
        20.5,
        "Bold",
    ),
    TypeCheck(
        "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf",
        3,
        "Kodak",
        20.5,
        "Bold",
    ),
    TypeCheck(
        "Monderman_Brief_The_Culture_Trap.pdf",
        3,
        "Global",
        20.5,
        "75Bd",
    ),
    TypeCheck(
        "Monderman_Brief_The_Culture_Trap.pdf",
        3,
        "Organizations",
        10.0,
        "55Rg",
    ),
    TypeCheck(
        "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf",
        3,
        "network",
        20.5,
        "75Bd",
    ),
    TypeCheck(
        "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf",
        3,
        "Every",
        10.0,
        "55Rg",
    ),
    TypeCheck(
        "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf",
        2,
        "Same",
        20.5,
        "Bold",
    ),
)


EXPECTED_PAGES = {
    "Monderman_Brief_Accumulated_Drag_Department_of_War.pdf": 10,
    "Monderman_Brief_Compensatory_Systems.pdf": 11,
    "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf": 11,
    "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf": 10,
    "Monderman_Brief_The_Culture_Trap.pdf": 9,
    "Monderman_Insight_After_the_First_Lap.pdf": 26,
    "Monderman_Insight_Built_to_Please_2026-08-27.pdf": 13,
    "Monderman_Insight_Every_Node_for_Itself_Aug2026.pdf": 11,
    "Monderman_Insight_Merit_After_the_Machine_2026-08-11.pdf": 14,
    "Monderman_Insight_The_Art_of_Interior_Reasoning.pdf": 12,
    "Terminal_Fidelity.pdf": 17,
}


def close(actual: float, expected: float) -> bool:
    return abs(float(actual) - expected) <= TOLERANCE


def words(page):
    return page.extract_words(extra_attrs=["fontname", "size"])


def require_type(check: TypeCheck) -> None:
    with pdfplumber.open(ROOT / check.filename) as document:
        page = document.pages[check.page_number - 1]
        matches = [
            word
            for word in words(page)
            if word["text"].strip(".,:;()") == check.text
            and close(word["size"], check.size)
            and check.font_fragment in word["fontname"]
        ]
        if not matches:
            raise AssertionError(
                f"{check.filename} page {check.page_number}: {check.text!r} "
                f"is not {check.font_fragment} at {check.size} pt"
            )


def first_reference_page(document) -> int:
    for index, page in enumerate(document.pages, 1):
        candidates = [
            word
            for word in words(page)
            if word["text"] == "REFERENCES" and word["top"] < 110
        ]
        if candidates:
            return index
    raise AssertionError("missing REFERENCES page")


def validate_publication(filename: str, category: str) -> None:
    expected_from_filename = "BRIEF" if filename.startswith("Monderman_Brief_") else "INSIGHT"
    if category != expected_from_filename:
        raise AssertionError(
            f"{filename}: configured category {category!r} conflicts with filename taxonomy "
            f"{expected_from_filename!r}"
        )
    path = ROOT / filename
    reader = PdfReader(path)
    expected_pages = EXPECTED_PAGES[filename]
    if len(reader.pages) != expected_pages:
        raise AssertionError(
            f"{filename}: expected {expected_pages} pages, found {len(reader.pages)}"
        )
    for page_number, page in enumerate(reader.pages, 1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if not (close(width, LETTER[0]) and close(height, LETTER[1])):
            raise AssertionError(
                f"{filename} page {page_number}: {width} x {height}, not US Letter"
            )

    with pdfplumber.open(path) as document:
        cover_words = words(document.pages[0])
        label_words = sorted(
            (
                word
                for word in cover_words
                if word["top"] < 70
                and close(word["size"], 8.5)
                and ("75Bd" in word["fontname"] or "Bold" in word["fontname"])
            ),
            key=lambda word: word["x0"],
        )
        extracted_category = "".join(word["text"] for word in label_words).replace(" ", "")
        if extracted_category != category:
            raise AssertionError(f"{filename}: cover category {category!r} is incorrect")

        reference_page = first_reference_page(document)
        reference_words = words(document.pages[reference_page - 1])
        visible_before_heading = [
            word
            for word in reference_words
            if word["top"] < 59 and word["text"].strip()
        ]
        if visible_before_heading:
            raise AssertionError(
                f"{filename}: REFERENCES does not begin on a clean page"
            )
        reference_heading = [
            word
            for word in reference_words
            if word["text"] == "REFERENCES"
            and close(word["size"], 10.0)
            and ("75Bd" in word["fontname"] or "Bold" in word["fontname"])
        ]
        if len(reference_heading) != 1:
            raise AssertionError(
                f"{filename}: expected one canonical REFERENCES heading"
            )
        entries_below_heading = [
            word
            for word in reference_words
            if 78 <= word["top"] < 700 and close(word["size"], 8.6)
        ]
        if not entries_below_heading:
            raise AssertionError(
                f"{filename}: first reference entry is missing or clipped"
            )

        back_words = words(document.pages[-1])
        italic = [
            word
            for word in back_words
            if word["text"] == "Governance,"
            and close(word["size"], 8.6)
            and "Italic" in word["fontname"]
        ]
        if not italic:
            raise AssertionError(
                f"{filename}: closing-page book title is not genuine NHG Italic"
            )
        closing_folios = [
            word["text"]
            for word in back_words
            if word["top"] > 730
            and word["x0"] > 530
            and word["text"].isdigit()
        ]
        if closing_folios != [str(expected_pages)]:
            raise AssertionError(
                f"{filename}: closing page contains hidden or incorrect folios "
                f"{closing_folios!r}"
            )

        for page_number, page in enumerate(document.pages[1:], 2):
            display_words = [
                word
                for word in words(page)
                if word["top"] < 730
                and word["bottom"] > 55
                and word["size"] >= 18.0
            ]
            if display_words:
                left = min(word["x0"] for word in display_words)
                right = max(word["x1"] for word in display_words)
                # Legacy source grids resolve at 58–553 points after PDF unit
                # conversion; this is the approved 60/492 optical column.
                if left < 57.5 or right > 553.0:
                    raise AssertionError(
                        f"{filename} page {page_number}: display copy escapes the publication column"
                    )


def validate_terminal_reflow() -> None:
    path = ROOT / "Terminal_Fidelity.pdf"
    with pdfplumber.open(path) as document:
        page_three = document.pages[2]
        page_four = document.pages[3]
        text_three = page_three.extract_text() or ""
        text_four = page_four.extract_text() or ""
        if "The Pattern Nobody Designs For" not in text_three:
            raise AssertionError("Terminal Fidelity: section 1 remains orphaned on page 4")
        visible_three = [
            word for word in words(page_three) if word["top"] >= 55 and word["bottom"] <= 730
        ]
        visible_four = [
            word for word in words(page_four) if word["top"] >= 55 and word["bottom"] <= 730
        ]
        if len(visible_three) < 210:
            raise AssertionError("Terminal Fidelity: page 3 remains visibly under-filled")
        if len(visible_four) < 180:
            raise AssertionError("Terminal Fidelity: page 4 continuation is incomplete")
        if any(
            word["text"] == "Pattern" and 0 <= word["top"] < 730
            for word in words(page_four)
        ):
            raise AssertionError("Terminal Fidelity: section heading was duplicated during reflow")
        complete_text = "\n".join(page.extract_text() or "" for page in document.pages)
        unique_passages = (
            "The Pattern Nobody Designs For",
            "The observation itself has a long pedigree.",
        )
        for passage in unique_passages:
            if complete_text.count(passage) != 1:
                raise AssertionError(
                    "Terminal Fidelity: reflow left hidden duplicate text for "
                    f"{passage!r}"
                )


def main() -> None:
    for publication in PUBLICATIONS:
        validate_publication(publication.filename, publication.category)
    for check in TYPE_CHECKS:
        require_type(check)
    validate_terminal_reflow()
    print(
        "PUBLICATION_SUITE_PASS "
        f"({len(PUBLICATIONS)} PDFs; Letter, references, typography, italics, reflow)"
    )


if __name__ == "__main__":
    main()
