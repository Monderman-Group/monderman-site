#!/usr/bin/env python3
"""Regression gate for customer-facing generated report PDFs."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


LETTER = (612.0, 792.0)
TOLERANCE = 0.2
logging.getLogger("pdfminer").setLevel(logging.ERROR)
EXPECTED = (
    "authenticated-operational_systems.pdf",
    "authenticated-decision_velocity.pdf",
    "authenticated-structural_clarity.pdf",
    "authenticated-institutional_performance.pdf",
    "cross_lens.pdf",
    "depth.pdf",
)


def close(actual: float, expected: float) -> bool:
    return abs(float(actual) - expected) <= TOLERANCE


def validate(path: Path) -> None:
    reader = PdfReader(path)
    if not reader.pages:
        raise AssertionError(f"{path.name}: PDF has no pages")
    for page_number, page in enumerate(reader.pages, 1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if not (close(width, LETTER[0]) and close(height, LETTER[1])):
            raise AssertionError(
                f"{path.name}: page {page_number} is {width} x {height}, not US Letter"
            )

    if not path.name.startswith("authenticated-"):
        return

    with pdfplumber.open(path) as document:
        texts = [(page.extract_text() or "") for page in document.pages]
    remedy_titles = (
        "LOW DISRUPTION",
        "TARGETED REDESIGN",
        "FASTEST STRUCTURAL RESET",
    )
    remedy_pages: set[int] = set()
    for title in remedy_titles:
        matches = [index for index, text in enumerate(texts) if title in text]
        if len(matches) != 1:
            raise AssertionError(f"{path.name}: expected one complete {title!r}, found {matches}")
        page_index = matches[0]
        remedy_pages.add(page_index)
        if "MEASURED EVIDENCE LINK" not in texts[page_index]:
            raise AssertionError(f"{path.name}: {title!r} is separated from its evidence footer")

    for page_index, text in enumerate(texts):
        if "MEASURED EVIDENCE LINK" in text and page_index not in remedy_pages:
            raise AssertionError(
                f"{path.name}: orphaned remedy evidence fragment on page {page_index + 1}"
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    directory = parser.parse_args().directory.resolve()
    missing = [name for name in EXPECTED if not (directory / name).exists()]
    if missing:
        raise AssertionError(f"missing generated PDFs: {missing}")
    for name in EXPECTED:
        validate(directory / name)
    print(f"Generated PDF layout validated: {len(EXPECTED)} Letter outputs")


if __name__ == "__main__":
    main()
