#!/usr/bin/env python3
"""Replace only page one of each public publication with the unified cover."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
import shutil
import tempfile

from pypdf import PdfReader, PdfWriter

from apply_publication_house_style import Publication, make_cover, register_fonts


ROOT = Path(__file__).resolve().parents[1]
BACKUP_DIR = ROOT / "tmp" / "pdfs" / "cover-system-originals"
OUTPUT_DIR = ROOT / "output" / "pdf"


PUBLICATIONS = (
    Publication(
        "Monderman_Brief_Accumulated_Drag_Department_of_War_2026-09-02.pdf",
        "BRIEF",
        "Accumulated Drag in the Department of War",
        "Administrative Overhead in the U.S. Department of War",
        "A review of public evidence on administrative overhead, acquisition timelines, and why repeated defense reform has struggled to change the structures behind delay.",
        "September 2026", 0, (),
    ),
    Publication(
        "Monderman_Brief_Compensatory_Systems.pdf",
        "BRIEF",
        "Compensatory Systems",
        "How Workarounds Preserve Output While Masking Institutional Dysfunction",
        "An examination of how workarounds preserve visible output while hiding structural problems, and why activity alone is a poor measure of institutional health.",
        "March 2026", 0, (),
    ),
    Publication(
        "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf",
        "BRIEF",
        "The Quarter-Trillion-Dollar Friction in U.S. Healthcare",
        "How Administrative Complexity Absorbs Capacity from Patient Care",
        "A review of evidence on the administrative costs of U.S. healthcare and the structural conditions that divert time and capacity from patient care.",
        "March 2026", 0, (),
    ),
    Publication(
        "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf",
        "BRIEF",
        "When Bureaucracy Became the Obstacle",
        "The Collapse of Eastman Kodak",
        "A review of Kodak's long decline and the governance, authority, and decision-making problems that kept foresight from becoming action.",
        "March 2026", 0, (),
    ),
    Publication(
        "Monderman_Brief_The_Culture_Trap.pdf",
        "BRIEF",
        "The Culture Trap",
        "Why Sentiment Measurement Can Locate Strain Without Identifying the Organizational Systems Beneath It",
        "A research brief on the difference between reported experience and the mechanisms through which work is organized.",
        "August 2026", 0, (),
    ),
    Publication(
        "Monderman_Commentary_We_Gave_Bureaucracy_the_Fastest_Tools_2026-09-03.pdf",
        "PERSPECTIVE",
        "We Gave Bureaucracy the Fastest Tools in History. It Got Slower.",
        "",
        "A nonpartisan argument for measuring how long public institutions take to decide and act, and reviewing procedures whose delay no longer protects the public.",
        "September 2026", 0, (),
    ),
    Publication(
        "Monderman_Insight_After_the_First_Lap.pdf",
        "INSIGHT",
        "From Tokens to Outcomes",
        "How Token Economics Will Define the Next Phase of Enterprise AI",
        "A structural dependency on early-market foundation model pricing is forming now. The companies that recognize the exposure early, and build or buy the engineering discipline that mitigates it, will define the next decade of enterprise AI.",
        "May 2026 · Revised August 2026", 0, (), author="Jason Adamson & Michael Wilson",
    ),
    Publication(
        "Monderman_Insight_Built_to_Please_2026-09-02.pdf",
        "INSIGHT",
        "Built to Please",
        "Why Consumer AI Tells You What You Want to Hear, and What Serious Users Build Around It",
        "Why general-purpose AI can lean toward the person asking, what the evidence supports, and what serious users add around a model to improve reliability.",
        "September 2026", 0, (),
    ),
    Publication(
        "Monderman_Insight_Every_Node_for_Itself_2026-09-02.pdf",
        "INSIGHT",
        "Every Node for Itself",
        "AI, In-Housing, and the Network That Keeps Companies Honest",
        "What organizations may gain and lose when AI prompts them to bring more expertise in-house, and why independent scrutiny still matters.",
        "September 2026", 0, (),
    ),
    Publication(
        "Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf",
        "INSIGHT",
        "Merit After the Machine",
        "Why AI Weakens the Evidence of Being Smart and Hardworking Faster Than Institutions Can Rebuild It",
        "An argument that AI is weakening familiar signals of skill and effort, with implications for how institutions recognize merit.",
        "September 2026", 0, (),
    ),
    Publication(
        "Monderman_Insight_The_Art_of_Interior_Reasoning.pdf",
        "INSIGHT",
        "The Art of Interior Reasoning",
        "Why Excellent Decisions Live Off the Line",
        "A practical argument for moving beyond false binaries and weak compromise to examine choices that sit outside the usual line of debate.",
        "April 2026", 0, (),
    ),
    Publication(
        "Monderman_Insight_The_Unmeasured_Layer.pdf",
        "INSIGHT",
        "The Unmeasured Layer",
        "Administrative Reality and the Risk Standard Reporting Misses",
        "An argument for measuring structural clarity, decision velocity, operational systems, and institutional performance as one continuing view.",
        "September 2026", 0, (),
    ),
    Publication(
        "Terminal_Fidelity.pdf",
        "INSIGHT",
        "Terminal Fidelity",
        "Why Ideas in Power Consume Themselves, and Where the Enduring Ones Learn to Stop",
        "Why ideas, movements, and companies can undermine their founding aims when rules outlive their purpose, and how stopping rules can preserve intent.",
        "July 2026", 0, (),
    ),
)


def preserve_metadata(reader: PdfReader, writer: PdfWriter) -> None:
    if reader.metadata:
        metadata = {str(key): str(value) for key, value in reader.metadata.items() if value is not None}
        if metadata:
            writer.add_metadata(metadata)


def replace_cover(publication: Publication) -> tuple[int, Path]:
    source = ROOT / publication.filename
    if not source.exists():
        raise FileNotFoundError(source)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    backup = BACKUP_DIR / publication.filename
    if not backup.exists():
        shutil.copy2(source, backup)

    reader = PdfReader(source)
    page_count = len(reader.pages)
    cover_reader = PdfReader(BytesIO(make_cover(publication)))
    writer = PdfWriter()
    writer.add_page(cover_reader.pages[0])
    for page in reader.pages[1:]:
        writer.add_page(page)
    preserve_metadata(reader, writer)

    with tempfile.NamedTemporaryFile(prefix=f".{source.stem}-", suffix=".pdf", dir=ROOT, delete=False) as handle:
        temporary = Path(handle.name)
        writer.write(handle)
    temporary.replace(source)
    shutil.copy2(source, OUTPUT_DIR / source.name)

    written = PdfReader(source)
    if len(written.pages) != page_count:
        raise RuntimeError(f"Page count changed for {source.name}: {page_count} -> {len(written.pages)}")
    return page_count, source


def main() -> None:
    register_fonts()
    for publication in PUBLICATIONS:
        pages, output = replace_cover(publication)
        print(f"{output.name}: {pages} pages")


if __name__ == "__main__":
    main()
