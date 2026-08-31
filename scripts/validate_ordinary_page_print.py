#!/usr/bin/env python3
"""Reject sparse, clipped, duplicated, or contaminated ordinary-page print output."""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

logging.getLogger("pdfminer").setLevel(logging.ERROR)


ROOT = Path(os.environ.get("ORDINARY_PRINT_OUT", "/tmp/monderman-ordinary-print"))
MANIFEST = ROOT / "manifest.json"
PAGE_CEILINGS = {
    "index.html": 11,
    "about.html": 3,
    "research.html": 8,
    "platform-services.html": 11,
    "after-the-first-lap.html": 2,
}
errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


require(MANIFEST.exists(), "ordinary-page print manifest is missing")
manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}

for page_name, ceiling in PAGE_CEILINGS.items():
    record = manifest.get(page_name, {})
    pdf_path = ROOT / record.get("pdf", page_name.replace(".html", ".pdf"))
    require(pdf_path.exists() and pdf_path.stat().st_size > 1000, f"{page_name}: rendered PDF is missing or empty")
    if not pdf_path.exists():
        continue
    reader = PdfReader(pdf_path)
    require(1 <= len(reader.pages) <= ceiling, f"{page_name}: print pagination expanded to {len(reader.pages)} pages (maximum {ceiling})")
    combined = "\n".join((page.extract_text() or "") for page in reader.pages)
    require("Warning: truncated output" not in combined and "Total output lines:" not in combined, f"{page_name}: tool-output warning entered the PDF")
    require(not re.search(r"(?m)^\s*:\s*$", combined), f"{page_name}: isolated colon placeholder entered the PDF")

    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
            text_value = " ".join(word["text"] for word in words).strip()
            character_count = len(re.sub(r"\s+", "", text_value))
            require(character_count >= 80, f"{page_name} page {index}: nearly empty print page ({character_count} characters)")
            if words:
                first_top = min(float(word["top"]) for word in words)
                last_bottom = max(float(word["bottom"]) for word in words)
                require(last_bottom - first_top >= 90, f"{page_name} page {index}: content occupies an unprofessional sliver ({last_bottom - first_top:.1f} pt)")

if errors:
    print("ORDINARY_PAGE_PRINT_VALIDATION_FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"ORDINARY_PAGE_PRINT_VALIDATION_PASS ({len(PAGE_CEILINGS)} surfaces; no sparse or contaminated pages)")
