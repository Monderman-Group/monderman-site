#!/usr/bin/env python3
"""Regression gate for customer-facing generated report PDFs."""

from __future__ import annotations

import argparse
import json
import logging
import re
import unicodedata
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


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


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
    # These locked fixtures contain independent option and priority lists, not
    # per-option evidence IDs. Enforce complete cards using their actual text,
    # not the removed, invented array-position evidence footer.
    artifact = json.loads((Path(__file__).resolve().parents[1] /
        "test-fixtures/authenticated-report-engine-runs.json").read_text())
    key = path.stem.removeprefix("authenticated-")
    source = artifact["outputs"][key]
    result = source.get("result", source)
    remedies = result.get("interpretive_prose", {}).get("remedy_paths", result.get("remedy_paths", []))
    if len(remedies) != 3:
        raise AssertionError(f"{path.name}: fixture does not contain three options")
    complete_text = normalized(" ".join(texts))
    if "do not correspond one-to-one with that list" not in complete_text:
        raise AssertionError(f"{path.name}: independent option/priority disclosure missing")
    if "WHY THIS OPTION APPEARS HERE" in complete_text:
        raise AssertionError(f"{path.name}: invented option-to-priority evidence pairing returned")
    for remedy in remedies:
        title = remedy["kicker"].upper()
        matches = [index for index, text in enumerate(texts) if title in text]
        if len(matches) != 1:
            raise AssertionError(f"{path.name}: expected one complete {title!r}, found {matches}")
        page_index = matches[0]
        page_text = normalized(texts[page_index])
        retained = [remedy["label"], remedy["summary"], *remedy["actions"], remedy["risk"]]
        for field in retained:
            if normalized(field) not in page_text:
                raise AssertionError(f"{path.name}: {title!r} has missing or split card content: {field!r}")


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
