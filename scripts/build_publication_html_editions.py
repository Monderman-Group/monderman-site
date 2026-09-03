#!/usr/bin/env python3
"""Build faithful web editions from the canonical Monderman PDFs.

The PDF is the content authority. Text is recovered as semantic HTML while
charts, diagrams, and designed evidence panels remain visual assets with
captions and alternative text.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from html import escape
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import pdfplumber
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "research"
PDFTOPPM = shutil.which("pdftoppm") or "pdftoppm"
RENDER_DPI = 180


@dataclass(frozen=True)
class Figure:
    page: int
    top: float
    bottom: float
    alt: str
    caption: str | None = None
    left: float = 46
    right: float = 566


@dataclass(frozen=True)
class Publication:
    slug: str
    pdf: str
    pdf_query: str
    category: str
    topic: str
    title: str
    subtitle: str
    deck: str
    author: str
    date: str
    pages: int
    read_time: str
    reference_start: int
    figures: tuple[Figure, ...] = ()
    exclusions: dict[int, tuple[tuple[float, float], ...]] = field(default_factory=dict)


PUBLICATIONS = (
    Publication(
        "merit-after-the-machine", "Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf", "v=20260902-final",
        "Insight", "Artificial Intelligence", "Merit After the Machine",
        "Why AI Weakens the Evidence of Being Smart and Hardworking Faster Than Institutions Can Rebuild It",
        "The worry about artificial intelligence usually gets told as a story about jobs, or safety, or truth. This paper tells it another way: as a story about being smart and being hardworking, the two qualities modern professional life learned to prize most—and what happens when the familiar evidence of both stops being reliable.",
        "Jason Adamson", "September 2026", 15, "~17 min", 12,
        (
            Figure(3, 250, 397, "A diagram showing how AI weakens the inference from finished work to intelligence and conscientiousness."),
            Figure(5, 550, 699, "A timeline tracing the construction of modern merit-sorting rules from 1770 through the release of ChatGPT in 2022."),
            Figure(10, 258, 436, "Two conceptual curves showing familiar evidence weakening faster than institutional replacement systems are built."),
            Figure(2, 450, 590, "Three summary cards defining the pair, the evidence, and the institutional gap.", "The paper distinguishes human intelligence and conscientiousness from the visible products institutions use as evidence of those qualities, then identifies the widening gap between weakened evidence and replacement systems."),
        ),
    ),
    Publication(
        "every-node-for-itself", "Monderman_Insight_Every_Node_for_Itself_2026-09-02.pdf", "v=20260902-final",
        "Insight", "Artificial Intelligence", "Every Node for Itself",
        "AI, In-Housing, and the Network That Keeps Companies Honest",
        "Companies and public institutions form a network of organizations that sell expertise to one another. AI has given every node in that network a reason to believe it can cut the others off. This paper examines what the cut wins, what it costs, and why the better use of AI is improving the nodes rather than severing them.",
        "Jason Adamson", "September 2026", 10, "~12 min", 9,
        (
            Figure(5, 235, 404, "A bar chart of cumulative court decisions in Damien Charlotin's public AI hallucination database."),
            Figure(8, 145, 348, "The same organizational network shown first with AI strengthening each node and then with nodes severed from outside checking."),
            Figure(2, 400, 530, "Three summary cards describing the gain, hidden cost, and decision involved in bringing expert work inside an organization.", "Routine work becomes cheaper, but checking, shared learning, trust, and a responsible backstop carry through the network's connections. The decision is which work can safely move inside and which still requires independence and accountability."),
        ),
    ),
    Publication(
        "built-to-please", "Monderman_Insight_Built_to_Please_2026-09-02.pdf", "v=20260902",
        "Insight", "Artificial Intelligence", "Built to Please",
        "Why Consumer AI Tells You What You Want to Hear, and What Serious Users Build Around It",
        "A general-purpose AI assistant is trained toward several goals at once: to be helpful, to give answers people prefer, to stay safe, and to be truthful. This paper separates what is known about the lean toward the asker from what is only suspected, and describes what serious users build around a model so its answers can be trusted.",
        "Jason Adamson", "September 2026", 13, "~15 min", 11,
        (
            Figure(4, 72, 220, "A conceptual diagram showing one AI product window serving several training goals that may not always agree."),
            Figure(8, 462, 603, "A paired-prompt test in which the same question is wrapped in opposite hopes and the answers are compared."),
            Figure(9, 350, 555, "A control architecture placing an AI model inside evidence, verification, and accountability checks."),
            Figure(2, 600, 710, "Three summary cards describing the several goals behind consumer AI, the measured lean toward the asker, and the controls serious users build around models.", "Helpfulness, user preference, safety, and truthfulness usually agree, but can pull apart. The paper separates evidence of the lean from hypotheses about product pressure, then identifies six controls for reliable use."),
        ),
    ),
    Publication(
        "terminal-fidelity", "Terminal_Fidelity.pdf", "v=20260828-house5",
        "Insight", "Decision Design", "Terminal Fidelity",
        "Why Ideas in Power Consume Themselves—and Where the Enduring Ones Learn to Stop",
        "Every political, economic, and existential philosophy that takes institutional form carries the conditions of its own undoing. The traditions and companies that recognize the pattern early—and engineer stopping rules that interrupt it—are the ones that endure.",
        "Jason Adamson", "July 2026", 17, "~20 min", 16,
        (
            Figure(6, 260, 533, "The overrun curve showing a founding principle producing gains inside its domain of fit, then crossing an inversion point into negative returns."),
            Figure(8, 375, 680, "An illustrative comparison of institutional lifespans across governing regimes and traditions."),
            Figure(11, 102, 438, "The overrun loop from founding principle through success, expansion, institutional investment, inversion, and renewed demands for fidelity."),
            Figure(2, 600, 710, "Three summary cards defining principle overrun, the inversion point, and stopping rules.", "Principle overrun extends a founding principle beyond the domain where it produces its intended goods. The inversion point is where faithful application produces the opposite result. Stopping rules establish a domain, review, and honored revision."),
            Figure(12, 58, 330, "A table of organizational principles, intended goods, inversion symptoms, and stopping rules.", "Organizational archetypes show the same overrun pattern on a faster clock, including customer obsession, radical transparency, autonomy, data-driven decision making, and moving fast."),
        ),
    ),
    Publication(
        "accumulated-drag-department-of-war", "Monderman_Brief_Accumulated_Drag_Department_of_War_2026-09-02.pdf", "v=20260902-final",
        "Brief", "Defense", "Accumulated Drag in the Department of War",
        "Administrative Overhead in the U.S. Department of War",
        "How accumulated structure degrades decision velocity and absorbs institutional capacity, and why successive reform waves have diagnosed the problem without altering the architecture that produces it. The evidence is stated with its limits, and the architectural claim is stated as the paper's argument.",
        "Jason Adamson", "September 2026", 11, "~12 min", 9,
        (
            Figure(5, 75, 267, "A horizontal comparison of years from program initiation to initial operational capability for five named defense programs."),
            Figure(6, 315, 468, "A conceptual chart showing administrative structure rising faster than mission requirements, with the widening gap labeled accumulated drag."),
        ),
    ),
    Publication(
        "quarter-trillion-friction-us-healthcare", "Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf", "v=20260828-house5",
        "Brief", "Healthcare", "The Quarter-Trillion-Dollar Friction in U.S. Healthcare",
        "How Administrative Complexity Absorbs Capacity from Patient Care",
        "The United States healthcare system spent $5.3 trillion in 2024—roughly twice what comparable nations spend per person—and a substantial share of that spending is consumed by administrative complexity rather than patient care. The friction is structural, and it is a design problem.",
        "Jason Adamson", "March 2026", 11, "~13 min", 10,
        (
            Figure(3, 288, 572, "A line chart showing U.S. health spending rising from about seven percent of GDP in 1970 to more than eighteen percent in 2024."),
            Figure(4, 52, 325, "A comparison showing that the United States spends more on healthcare and administration than peer nations."),
            Figure(5, 52, 332, "A chart showing administrative complexity as the largest single category of waste in U.S. healthcare."),
            Figure(6, 288, 496, "A chart showing that less than half of physician work time is spent on direct patient care."),
            Figure(7, 220, 456, "A comparison of billing costs per inpatient claim in the United States and peer countries."),
            Figure(8, 235, 522, "Four structural pathways for reducing administrative drag in U.S. healthcare."),
        ),
    ),
    Publication(
        "from-tokens-to-outcomes", "Monderman_Insight_After_the_First_Lap.pdf", "v=20260828-house5",
        "Insight", "Enterprise", "From Tokens to Outcomes",
        "How Token Economics Will Define the Next Phase of Enterprise AI",
        "A structural dependency on early-market foundation-model pricing is forming now. The companies that recognize the exposure early, and build or buy the engineering discipline that mitigates it, will define the next decade of enterprise AI.",
        "Jason Adamson & Michael Wilson", "May 2026 · Revised August 2026", 26, "~32 min", 25,
        (
            Figure(5, 48, 285, "A comparison showing enterprise AI economics shifting from training-dominant compute in 2024 to inference-dominant compute in 2026."),
            Figure(7, 250, 472, "Two curves showing per-token prices falling while enterprise AI consumption rises."),
            Figure(9, 62, 250, "A spectrum of enterprise AI cost-discipline practices from prompt controls through deterministic architecture."),
            Figure(11, 62, 338, "Three structural tiers in the enterprise AI market: foundation labs, deterministic infrastructure providers, and end-user enterprises."),
            Figure(13, 62, 322, "A comparison of cost per workflow under naive and deterministic AI architectures."),
            Figure(2, 455, 550, "Three headline measures of the enterprise AI cost shift.", "IDC forecast $301 billion in worldwide AI spending in 2026; published estimates put inference at two-thirds to 85 percent of compute spend; and the share of organizations reporting AI as an active FinOps concern rose from 31 percent to 63 percent between 2024 and 2025."),
        ),
    ),
    Publication(
        "compensatory-systems", "Monderman_Brief_Compensatory_Systems.pdf", "v=20260828-house5",
        "Brief", "Enterprise", "Compensatory Systems",
        "How Workarounds Preserve Output While Masking Institutional Dysfunction",
        "When movement is mistaken for progress, adaptation can become a substitute for stewardship. In large, complex organizations, failure rarely announces itself clearly: work continues, reports are produced, and the system does not stop working. It stops working as a system.",
        "Jason Adamson", "March 2026", 11, "~13 min", 10,
        (
            Figure(4, 45, 337, "A conceptual diagram showing workarounds, informal networks, contractors, and parallel processes layering over a degraded formal system."),
            Figure(5, 150, 435, "Illustrative bars comparing where organizational effort goes in well-functioning and degraded systems."),
            Figure(7, 45, 328, "The Stability Trap: reported output is preserved while the formal system's contribution declines and compensatory effort rises."),
            Figure(8, 335, 610, "A diagnostic framework that connects compensatory signals to stewardship actions and intended outcomes."),
        ),
    ),
    Publication(
        "when-bureaucracy-became-the-obstacle", "Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf", "v=20260828-house5",
        "Brief", "Enterprise", "When Bureaucracy Became the Obstacle",
        "The Collapse of Eastman Kodak",
        "How unstewarded bureaucratic governance turned foresight into delay and converted a market leader into a cautionary tale. Kodak built the world's first digital camera in 1975 and filed for Chapter 11 in 2012. The popular explanation is complacency. The evidence tells a different story.",
        "Jason Adamson", "March 2026", 10, "~12 min", 9,
        (
            Figure(3, 410, 695, "A chart showing Kodak revenue collapsing after a decade of structural inaction."),
            Figure(4, 450, 648, "An interpretive timeline of how Kodak's governance mechanisms drifted across three eras."),
            Figure(5, 155, 316, "A comparison of Kodak and Fujifilm showing two companies seeing the same future but adapting governance differently."),
            Figure(6, 310, 585, "A stylized synthesis showing digital opportunity expanding while Kodak's institutional capacity to act narrowed."),
            Figure(7, 350, 600, "Four governance stewardship practices whose absence contributed to Kodak's collapse."),
        ),
    ),
    Publication(
        "the-culture-trap-brief", "Monderman_Brief_The_Culture_Trap.pdf", "v=20260828-house5",
        "Brief", "Enterprise · Culture", "The Culture Trap",
        "Why Sentiment Measurement Can Locate Strain Without Identifying the Organizational Systems Beneath It",
        "A research brief on the difference between reported experience and the mechanisms through which work is organized.",
        "Jason Adamson", "August 2026", 9, "~11 min", 8,
        (
            Figure(2, 245, 535, "A designed comparison of reported experience and operating structure, followed by Monderman's definition of Systems Measurement.", "Reported experience identifies where attention may be needed. Operating structure shows how the system is arranged. Systems Measurement examines the organizational mechanisms people work within."),
            Figure(3, 160, 295, "Two evidence cards reporting global engagement and estimated lost productivity.", "Gallup reported 20 percent of employees worldwide engaged at work in 2025 and attributed $438 billion in lost productivity to the 2024 global engagement decline."),
            Figure(3, 487, 605, "Three evidence cards summarizing controlled-trial effect sizes and the boundary of the evidence.", "Controlled trials found small positive average effects on self-reported engagement; they did not establish that higher engagement scores caused better operating results."),
            Figure(4, 230, 345, "A comparison of advertised values and employee perceptions of management integrity.", "Advertised values and operating practice are different evidence."),
            Figure(4, 475, 618, "Two evidence cards reporting productivity effects from management-practice research.", "A randomized management-practices trial reported a 17 percent first-year productivity increase and estimated that management practices accounted for roughly one quarter of measured total-factor-productivity gaps."),
            Figure(5, 165, 465, "A two-layer comparison of sentiment measurement and Systems Measurement, with five elements of the operating layer.", "Sentiment measurement reports experience. Systems Measurement examines ownership, authority, handoffs, routing, process load, and performance discipline."),
            Figure(6, 205, 318, "A four-stage measurement loop: measure, locate, act, and re-measure.", "Systems Measurement begins with a baseline and returns to the same system after action."),
            Figure(6, 405, 562, "Four Monderman measurement cards: Operational Systems, Decision Velocity, Structural Clarity, and Institutional Performance.", "The four measurement lenses examine related organizational structures."),
            Figure(7, 300, 430, "A five-part complete-read diagram spanning experience, structure, decision flow, operating load, and remeasurement.", "A complete read keeps both experience and operating structure visible."),
        ),
    ),
    Publication(
        "the-art-of-interior-reasoning", "Monderman_Insight_The_Art_of_Interior_Reasoning.pdf", "v=20260828-house5",
        "Insight", "Decision Design", "The Art of Interior Reasoning",
        "Why Excellent Decisions Live Off the Line",
        "The discipline of reasoning past both binary thinking and the compromise between: what it takes, analytically and emotionally, to find answers off the line—and what compounds when this is or is not the practice.",
        "Jason Adamson", "April 2026", 12, "~14 min", 11,
        (
            Figure(4, 78, 248, "A decision field showing available options outside the line between two familiar poles."),
            Figure(5, 78, 280, "Decision quality tiers and the reasoning approaches that reach them."),
            Figure(6, 78, 285, "Estimated rates of reaching each decision-quality tier by reasoning approach."),
            Figure(7, 245, 522, "Three traps—Pole A, Pole B, and midpoint compromise—and an escape into the interior decision field."),
            Figure(2, 200, 335, "Three summary cards defining the line, the field, and the derivative in interior reasoning.", "Binary framing collapses a multidimensional problem into apparent opposites. The field restores independent variables, and the derivative is an answer that exists outside the original framing."),
        ),
    ),
)


def normalize_text(value: str) -> str:
    value = value.replace("—", "–")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:?!])", r"\1", value)
    value = re.sub(r"([A-Za-z0-9])\s*[’']\s*(s|t|re|ve|ll|d|m)\b", r"\1’\2", value, flags=re.I)
    value = value.replace("“ ", "“").replace(" ”", "”").replace("‘ ", "‘").replace(" ’", "’")
    for broken, repaired in {
        "I nstitutions": "Institutions",
        "W hen": "When",
        "Y ears": "Years",
        "ma j or": "major",
        "te x t": "text",
        "A I": "AI",
        "paired - prompt": "paired-prompt",
        "tirelesslooking": "tireless-looking",
        "premisefollowing": "premise-following",
        "sourceentailment": "source-entailment",
        "thirdperson": "third-person",
        "percontractor": "per-contractor",
        "wastereduction": "waste-reduction",
        "quartertrillion": "quarter-trillion",
        "errorcorrection": "error-correction",
        "highdimensional": "high-dimensional",
        "decisionmaker": "decision-maker",
        "Mart í nez": "Martínez",
        "Th é odore": "Théodore",
        "M é thodes": "Méthodes",
        "Ann é e": "Année",
        "L’ Année": "L’Année",
    }.items():
        value = value.replace(broken, repaired)
    return value


def join_line_text(left: str, right: str) -> str:
    if not left:
        return right
    if left.endswith("-") and right[:1].islower():
        return left[:-1] + right
    return left + " " + right


def page_lines(page, drop_font_prefixes: tuple[str, ...] = ()) -> list[dict]:
    if hasattr(page, "dedupe_chars"):
        page = page.dedupe_chars(tolerance=1)
    words = page.extract_words(extra_attrs=["size", "fontname"], keep_blank_chars=False, use_text_flow=False)
    if drop_font_prefixes:
        words = [word for word in words if not word["fontname"].startswith(drop_font_prefixes)]
    words.sort(key=lambda word: (round(word["top"], 1), word["x0"]))
    rows: list[list[dict]] = []
    for word in words:
        if not rows or abs(rows[-1][0]["top"] - word["top"]) > 1.2:
            rows.append([word])
        else:
            rows[-1].append(word)
    lines: list[dict] = []
    for row in rows:
        row.sort(key=lambda word: word["x0"])
        segment: list[dict] = []
        for word in row:
            if segment and word["x0"] - segment[-1]["x1"] > 34:
                lines.append(line_from_words(segment))
                segment = []
            segment.append(word)
        if segment:
            lines.append(line_from_words(segment))
    lines.sort(key=lambda line: (line["top"], line["x0"]))
    return lines


def line_from_words(words: list[dict]) -> dict:
    return {
        "text": normalize_text(" ".join(word["text"] for word in words)),
        "top": min(word["top"] for word in words),
        "bottom": max(word["bottom"] for word in words),
        "x0": min(word["x0"] for word in words),
        "x1": max(word["x1"] for word in words),
        "size": max(word["size"] for word in words),
        "bold": any(
            any(marker in word["fontname"].lower() for marker in ("bold", "medium", "75bd", "65md"))
            for word in words
        ),
    }


def classify(line: dict) -> str:
    text = line["text"]
    size = line["size"]
    if re.fullmatch(r"\d{1,2}\.?", text) and size >= 10.5:
        return "number"
    if size >= 17.0:
        return "heading"
    if size >= 12.4:
        return "quote"
    if line["bold"] and size >= 11.0:
        return "subheading"
    if size >= 9.4 and text.upper() == text and any(ch.isalpha() for ch in text):
        return "label"
    return "body"


def in_ranges(y: float, ranges: list[tuple[float, float]]) -> bool:
    return any(start <= y <= end for start, end in ranges)


def dropped_font_layers(publication: Publication) -> tuple[str, ...]:
    if publication.slug == "from-tokens-to-outcomes":
        return ("KZNKAX+", "BKYKFD+", "QTTGFG+", "RILBXN+", "LOWVPA+")
    return ()


def extract_blocks(pdf, publication: Publication) -> list[dict]:
    figures_by_page: dict[int, list[tuple[int, Figure]]] = {}
    for index, figure in enumerate(publication.figures, start=1):
        figures_by_page.setdefault(figure.page, []).append((index, figure))

    blocks: list[dict] = []
    pending_number = ""
    for page_number in range(2, publication.reference_start):
        page = pdf.pages[page_number - 1]
        page_figures = figures_by_page.get(page_number, [])
        excluded = list(publication.exclusions.get(page_number, ()))
        excluded.extend((figure.top, figure.bottom + (34 if figure.caption is None else 0)) for _, figure in page_figures)
        events: list[dict] = []
        for line in page_lines(page, dropped_font_layers(publication)):
            middle = (line["top"] + line["bottom"]) / 2
            if line["top"] < 54 or line["bottom"] > 730 or line["size"] < 8.9 or in_ranges(middle, excluded):
                continue
            if re.fullmatch(r"(?:January|February|March|April|May|June|July|August|September|October|November|December) 2026", line["text"]):
                continue
            events.append({"kind": "line", "y": line["top"], "line": line})
        for index, figure in page_figures:
            events.append({"kind": "figure", "y": figure.top, "index": index, "figure": figure})
        events.sort(key=lambda event: (event["y"], 0 if event["kind"] == "line" else 1))

        current: dict | None = None
        for event in events:
            if event["kind"] == "figure":
                if current:
                    blocks.append(current)
                    current = None
                blocks.append({"type": "figure", "index": event["index"], "figure": event["figure"], "page": page_number})
                continue
            line = event["line"]
            line_type = classify(line)
            if line_type == "number":
                if current:
                    blocks.append(current)
                    current = None
                pending_number = line["text"].rstrip(".")
                continue
            if line_type == "heading" and line["x0"] > 100:
                continue
            merge_limit = {"body": 20.5 if line["size"] >= 11 else 18.4, "heading": 29, "quote": 23, "subheading": 18, "label": 17}[line_type]
            can_merge = (
                current
                and current["type"] == line_type
                and line["top"] - current["last_top"] <= merge_limit
                and (line_type != "body" or abs(line["x0"] - current["x0"]) <= 20)
            )
            if can_merge:
                current["text"] = join_line_text(current["text"], line["text"])
                current["last_top"] = line["top"]
                current["last_bottom"] = line["bottom"]
            else:
                if current:
                    blocks.append(current)
                current = {
                    "type": line_type,
                    "text": line["text"],
                    "x0": line["x0"],
                    "top": line["top"],
                    "last_top": line["top"],
                    "last_bottom": line["bottom"],
                    "size": line["size"],
                    "page": page_number,
                }
                if line_type == "heading" and pending_number:
                    current["number"] = pending_number
                    pending_number = ""
        if current:
            blocks.append(current)

    # Join paragraphs that plainly continue across a page break.
    merged: list[dict] = []
    for block in blocks:
        if (
            merged and block["type"] == "body" and merged[-1]["type"] == "body"
            and block["page"] == merged[-1]["page"] + 1
            and merged[-1].get("last_bottom", 0) > 650 and block.get("top", 999) < 145
            and not re.search(r"[.!?][’\”\"]?$", merged[-1]["text"])
        ):
            merged[-1]["text"] = join_line_text(merged[-1]["text"], block["text"])
            merged[-1]["last_bottom"] = block.get("last_bottom", merged[-1].get("last_bottom"))
        else:
            merged.append(block)
    deduped: list[dict] = []
    for block in merged:
        if block["type"] == "heading" and deduped and deduped[-1]["type"] == "heading" and block["text"] == deduped[-1]["text"]:
            if block.get("number"):
                deduped[-1] = block
            continue
        deduped.append(block)
    for block in deduped:
        if "text" in block:
            block["text"] = normalize_text(block["text"])
    return deduped


def extract_references(pdf, publication: Publication) -> list[str]:
    references: list[str] = []
    current = ""
    for page_number in range(publication.reference_start, publication.pages):
        page = pdf.pages[page_number - 1]
        previous_top: float | None = None
        for line in page_lines(page, dropped_font_layers(publication)):
            if line["top"] < 72 or line["bottom"] > 730 or line["size"] < 8.2:
                continue
            text = line["text"]
            if text.upper() in {"REFERENCES", "CONTINUED"}:
                continue
            numbered = re.match(r"^\d+\.\s*", text)
            new_unnumbered = line["x0"] < 65 and previous_top is not None and line["top"] - previous_top > 14
            if numbered or new_unnumbered:
                if current:
                    references.append(normalize_text(current))
                current = re.sub(r"^\d+\.\s*", "", text)
            else:
                current = join_line_text(current, text)
            previous_top = line["top"]
    if current:
        references.append(normalize_text(current))
    cleaned = [reference for reference in references if len(reference) > 8]
    repaired: list[str] = []
    for reference in cleaned:
        if repaired and re.match(r"^\d{4,}\)", reference):
            repaired[-1] = join_line_text(repaired[-1], reference)
        else:
            repaired.append(reference)
    return repaired


def extract_caption(pdf, publication: Publication, figure: Figure, number: int) -> str:
    if figure.caption:
        return figure.caption
    page = pdf.pages[figure.page - 1]
    lines = page_lines(page, dropped_font_layers(publication))
    start = None
    chosen: list[dict] = []
    prefix = f"Figure {number}."
    for index, line in enumerate(lines):
        if line["text"].startswith(prefix):
            start = index
            break
    if start is None:
        return prefix
    chosen.append(lines[start])
    for line in lines[start + 1:]:
        if line["top"] - chosen[-1]["top"] > 15 or line["size"] > 8.8:
            break
        if abs(line["size"] - chosen[0]["size"]) <= .7:
            chosen.append(line)
    caption = ""
    for line in chosen:
        caption = join_line_text(caption, line["text"])
    caption = normalize_text(caption)
    repeated = caption.find(prefix, len(prefix))
    if repeated > 0:
        caption = caption[repeated:]
    return caption


def crop_figures(publication: Publication) -> None:
    if not publication.figures:
        return
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="monderman-html-") as temporary:
        temporary_path = Path(temporary)
        rendered: dict[int, Path] = {}
        for index, figure in enumerate(publication.figures, start=1):
            if figure.page not in rendered:
                base = temporary_path / f"page-{figure.page}"
                subprocess.run(
                    [PDFTOPPM, "-f", str(figure.page), "-l", str(figure.page), "-r", str(RENDER_DPI), "-singlefile", "-png", str(ROOT / publication.pdf), str(base)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                rendered[figure.page] = base.with_suffix(".png")
            scale = RENDER_DPI / 72
            with Image.open(rendered[figure.page]) as source:
                crop = source.crop(tuple(round(value * scale) for value in (figure.left, figure.top, figure.right, figure.bottom)))
                target = ASSET_DIR / f"{publication.slug}-figure-{index}.png"
                crop.save(target, optimize=True)


def wrap_urls(text: str) -> str:
    safe = escape(text.replace("—", "–"))
    return re.sub(
        r"(https?://[^\s<]+)",
        lambda match: f'<a href="{match.group(1).rstrip(".,;")}" target="_blank" rel="noopener noreferrer">{match.group(1).rstrip(".,;")}</a>{match.group(1)[len(match.group(1).rstrip(".,;")):]}',
        safe,
    )


def render_blocks(blocks: list[dict], captions: dict[int, str], publication: Publication) -> str:
    output: list[str] = []
    for block in blocks:
        kind = block["type"]
        if kind == "figure":
            index = block["index"]
            figure = block["figure"]
            output.append(
                f'<figure><img src="assets/research/{publication.slug}-figure-{index}.png" alt="{escape(figure.alt.replace("—", "–"))}" loading="lazy" width="1300"><figcaption>{escape(captions[index].replace("—", "–"))}</figcaption></figure>'
            )
        elif kind == "label":
            output.append(f'<div class="publication-label">{escape(block["text"])}</div>')
        elif kind == "heading":
            number = f'<span class="section-number">{escape(block["number"])}.</span>' if block.get("number") else ""
            output.append(f'<h2>{number}{escape(block["text"])}</h2>')
        elif kind == "subheading":
            output.append(f'<h3>{escape(block["text"])}</h3>')
        elif kind == "quote":
            output.append(f'<blockquote>{escape(block["text"])}</blockquote>')
        else:
            output.append(f'<p>{escape(block["text"])}</p>')
    return "\n".join(output)


def footer_markup() -> str:
    source = (ROOT / "the-unmeasured-layer.html").read_text(encoding="utf-8")
    match = re.search(r'(<footer class="footer mond-footer">.*?</footer>)', source, re.S)
    if not match:
        raise RuntimeError("Standard footer not found in The Unmeasured Layer")
    return match.group(1)


def author_about(author: str) -> str:
    if "Michael Wilson" in author:
        return (
            "Jason Adamson is the founder of Monderman, an institutional performance research company, and the author of "
            "<i>Governance, Bureaucracy and Organization: Stewardship, Drift, and Administrative Capacity</i> (Routledge, forthcoming). "
            "This paper was written with Michael Wilson."
        )
    return (
        "Jason Adamson is the founder of Monderman, an institutional performance research company. He is the author of "
        "<i>Governance, Bureaucracy and Organization: Stewardship, Drift, and Administrative Capacity</i> (Routledge, forthcoming). "
        "His career spans more than two decades of intelligence analysis across the U.S. government, alongside private-sector experience at CrowdStrike and in startups. "
        "He holds an M.S. in Organization Development from Pepperdine University."
    )


def generate_social_card(publication: Publication) -> None:
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), "#07363b")
    draw = ImageDraw.Draw(image)
    font_dir = ROOT / "pdf-src" / "fonts"
    regular = font_dir / "NeueHaasGroteskText-Roman.ttf"
    bold = font_dir / "NeueHaasGroteskText-Bold.ttf"
    small = ImageFont.truetype(str(bold), 22)
    title_size = 70 if len(publication.title) < 34 else 58
    title_font = ImageFont.truetype(str(bold), title_size)
    subtitle_font = ImageFont.truetype(str(regular), 31)
    draw.text((78, 62), "MONDERMAN", font=small, fill="#ffffff")
    draw.line((78, 105, 180, 105), fill="#9cc4c9", width=4)
    draw.text((78, 142), f"{publication.topic.upper()} · {publication.category.upper()}", font=small, fill="#9cc4c9")
    y = 205
    for line in wrap_for_image(draw, publication.title, title_font, 1000):
        draw.text((78, y), line, font=title_font, fill="#ffffff")
        y += title_size * .98
    y += 18
    for line in wrap_for_image(draw, publication.subtitle, subtitle_font, 960)[:3]:
        draw.text((78, y), line, font=subtitle_font, fill="#b7d2d4")
        y += 39
    draw.line((78, 564, 1122, 564), fill="#315c62", width=2)
    draw.text((78, 582), publication.date, font=small, fill="#d9e4e5")
    image.save(ASSET_DIR / f"{publication.slug}-social.png", optimize=True)


def wrap_for_image(draw, text: str, font, maximum: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=font)[2] > maximum:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def build_page(publication: Publication, standard_footer: str) -> None:
    with pdfplumber.open(ROOT / publication.pdf) as pdf:
        blocks = extract_blocks(pdf, publication)
        references = extract_references(pdf, publication)
        captions = {index: extract_caption(pdf, publication, figure, index) for index, figure in enumerate(publication.figures, start=1)}
    if len(references) < 3:
        raise RuntimeError(f"Too few references extracted for {publication.slug}: {len(references)}")
    crop_figures(publication)
    generate_social_card(publication)
    body = render_blocks(blocks, captions, publication)
    refs = "\n".join(f"<li>{wrap_urls(reference)}</li>" for reference in references)
    pdf_url = f"{publication.pdf}?{publication.pdf_query}"
    title = escape(publication.title.replace("—", "–"))
    author = escape(publication.author.replace("—", "–"))
    deck = escape(publication.deck.replace("—", "–"))
    category = escape(publication.category.replace("—", "–"))
    topic = escape(publication.topic.replace("—", "–"))
    subtitle = escape(publication.subtitle.replace("—", "–"))
    date = escape(publication.date.replace("—", "–"))
    read_label = "Read the brief" if publication.category == "Brief" else "Read the article"
    download_label = "Download the brief" if publication.category == "Brief" else "Download the paper"
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | Monderman</title>
  <meta name="author" content="{author}">
  <meta name="description" content="{deck}">
  <link rel="canonical" href="https://www.monderman.com/{publication.slug}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://www.monderman.com/{publication.slug}.html">
  <meta property="og:title" content="{title} | Monderman">
  <meta property="og:description" content="{deck}">
  <meta property="og:image" content="https://www.monderman.com/assets/research/{publication.slug}-social.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{title}, a Monderman {category}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title} | Monderman">
  <meta name="twitter:description" content="{deck}">
  <meta name="twitter:image" content="https://www.monderman.com/assets/research/{publication.slug}-social.png">
  <meta name="twitter:image:alt" content="{title}, a Monderman {category}">
  <link rel="icon" type="image/svg+xml" href="favicon.svg?v=20260830-cert1">
  <link rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v=20260830-cert1">
  <link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v=20260830-cert1">
  <link rel="apple-touch-icon" href="apple-touch-icon.png?v=20260830-cert1">
  <link rel="stylesheet" href="publication-html.css?v=20260903-html1">
  <link rel="stylesheet" href="canonical-site-shell.css?v=20260830-readiness1">
</head>
<body class="canonical-green-shell">
<a class="skip-link" href="#main-content">Skip to article</a>
<header class="header" id="siteHeader">
  <div class="header-inner">
    <a href="index.html" class="brand">Monderman<span class="brand-dot"></span></a>
    <nav class="nav" aria-label="Primary navigation">
      <a href="index.html#approach">Approach</a>
      <a href="diagnostics.html">Diagnostics</a>
      <a href="research.html" class="is-active">Research</a>
      <a href="why-monderman.html">Why Monderman</a>
      <a href="about.html">About</a>
      <a href="platform-services.html">Plans &amp; Pricing</a>
      <a href="connect.html">Connect</a>
      <a class="workspace-link" href="workspace.html">Sign In</a>
    </nav>
  </div>
</header>
<section class="article-hero" aria-labelledby="article-title">
  <div class="article-hero-inner">
    <div>
      <p class="article-kicker">{category} · {topic} Research</p>
      <h1 id="article-title">{title}</h1>
      <p class="article-subtitle">{subtitle}</p>
    </div>
    <div>
      <p class="article-deck">{deck}</p>
      <p class="article-byline">{author} · {date} · {publication.pages} pages · {publication.read_time}</p>
      <div class="article-actions">
        <a class="article-action article-action-primary" href="#main-content">{read_label}</a>
        <a class="article-action" href="{escape(pdf_url)}" target="_blank" rel="noopener noreferrer">Download PDF</a>
      </div>
    </div>
  </div>
</section>
<main class="article-main" id="main-content">
  <article class="article-body">
{body}
  </article>
  <section class="article-references" aria-labelledby="references-heading">
    <h2 class="references-heading" id="references-heading">References</h2>
    <ol class="reference-list">
{refs}
    </ol>
  </section>
  <section class="article-about" aria-labelledby="about-author-heading">
    <h2 class="about-heading" id="about-author-heading">About the author</h2>
    <p>{author_about(publication.author)}</p>
    <h2 class="about-heading">About Monderman</h2>
    <p>Monderman is an institutional performance research company building Deterministic AI Infrastructure for organizational diagnostics. Its diagnostic platform produces structured operational reads for enterprises across sectors, including defense, healthcare, government, financial services, technology, manufacturing, and higher education.</p>
  </section>
  <section class="article-further" aria-label="Article links">
    <p class="article-kicker">Continue</p>
    <p><a href="{escape(pdf_url)}" target="_blank" rel="noopener noreferrer">{download_label} →</a></p>
    <p><a href="research.html">Explore the research library →</a></p>
  </section>
</main>
{standard_footer}
<script src="canonical-site-shell.js?v=20260830-readiness1"></script>
<script src="assistant.js?v=20260828-footer-dock4" defer></script>
<script src="contact-transport.js?v=20260903-contact1" defer></script>
<script src="connect-widget.js?v=20260903-contact1" defer></script>
</body>
</html>
'''
    (ROOT / f"{publication.slug}.html").write_text(html, encoding="utf-8")
    print(f"Built {publication.slug}.html: {len(blocks)} content blocks, {len(publication.figures)} figures, {len(references)} references")


def main() -> None:
    standard_footer = footer_markup()
    for publication in PUBLICATIONS:
        build_page(publication, standard_footer)


if __name__ == "__main__":
    main()
