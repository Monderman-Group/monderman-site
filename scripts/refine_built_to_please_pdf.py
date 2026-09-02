#!/usr/bin/env python3
"""Apply the final production refinements to Built to Please."""

from __future__ import annotations

import io
import shutil
from pathlib import Path
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Monderman_Insight_Built_to_Please_2026-09-02.pdf"
OUTPUT = ROOT / "output" / "pdf" / SOURCE.name
TEMP = ROOT / "tmp" / "pdfs" / "built-professional-audit" / "refined.pdf"
FONT_DIR = ROOT / "pdf-src" / "fonts"

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 60.0
BODY_WIDTH = 492.0

ROMAN = "NHGX-Roman-Refined"
BOLD = "NHGX-Bold-Refined"

REFERENCES = [
    "On preference training, see Paul F. Christiano et al., “Deep Reinforcement Learning from Human Preferences” (2017), and Long Ouyang et al., “Training Language Models to Follow Instructions with Human Feedback” (2022). On the choosers favoring agreeable answers, Mrinank Sharma et al., “Towards Understanding Sycophancy in Language Models” (Anthropic, 2023; ICLR 2024), which finds that a response matching the user's views is more likely to be preferred, and that both humans and preference models prefer convincingly written sycophantic responses over correct ones a non-negligible fraction of the time.",
    "Sharma et al. (note 1) demonstrate the behavior across five AI assistants and four free-form tasks. Earlier, Ethan Perez et al., “Discovering Language Model Behaviors with Model-Written Evaluations” (2022), documented sycophancy in models trained with human feedback.",
    "The exchange took place in 2026 and is preserved in the author's records. The institution and the model are deliberately not named; the exhibit stands for the pattern, not the parties.",
    "OpenAI, “Sycophancy in GPT-4o: What Happened and What We're Doing About It,” April 29, 2025, and “Expanding on What We Missed with Sycophancy,” May 2, 2025. The update was released on April 25, 2025 and rolled back within days. The second post states that the update added a reward signal built on thumbs-up and thumbs-down data from users. The user examples and the sequence are documented in contemporaneous coverage, including TechCrunch, April 29, 2025.",
    "OpenAI announced memory for ChatGPT on February 13, 2024, and expanded it on April 10, 2025 to reference a user's past chats. Anthropic added past-chat referencing to Claude in August 2025, with broader memory following later that year. Google added memory to Gemini in February 2025 and continuous personalization in August 2025. Each company documents controls for switching the features off.",
    "Jason Adamson, “Merit After the Machine,” Monderman Insight, August 2026, available at www.monderman.com/research.html, and “Every Node for Itself,” August 2026, available on the author's LinkedIn profile.",
    "After the April 2025 episode, OpenAI adjusted the system prompt of the model that remained in production, and later noted that system prompts have a more limited effect on model behavior than changes made in training (OpenAI, GPT-5 System Card, 2025). Prompt-based mitigation is studied directly in the research literature (for example, Hong et al., 2025). Fine-tuning approaches report the same direction, reduced but not removed; see Jerry Wei et al., “Simple Synthetic Data Reduces Sycophancy in Large Language Models” (2023).",
    "Damien Charlotin's database tracks court decisions involving hallucinated AI output, most often invented citations; it recorded more than nineteen hundred decisions at its July 2026 count, a figure to be re-checked at publication. The best-known early case is Mata v. Avianca, Inc. (S.D.N.Y. 2023), in which lawyers were sanctioned for filing invented citations.",
    "The trial is standard in the research. Sharma et al. (note 1) measure whether models change answers when the user states a preference or pushes back; Fanous et al., “SycEval: Evaluating LLM Sycophancy” (2025), formalizes rebuttal-based measurement.",
    "Board of Governors of the Federal Reserve System, Office of the Comptroller of the Currency, and Federal Deposit Insurance Corporation, SR Letter 26-2, “Revised Guidance on Model Risk Management,” April 17, 2026. SR 26-2 supersedes SR 11-7 and emphasizes a tailored, risk-based approach. It excludes generative and agentic AI from its scope, while stating that broader risk-management and governance practices should determine appropriate controls for tools outside the guidance. For covered models, it defines effective challenge as critical analysis by objective experts with sufficient independence to maintain objectivity.",
    "New aircraft designs are certified under Federal Aviation Regulations, 14 C.F.R. Part 21, against airworthiness standards the applicant does not write, including Part 25 for transport-category airplanes. Much of the compliance showing is performed by the manufacturer under FAA delegation and oversight, a system with well-known critics; the standards themselves remain the regulator's.",
    "Sarbanes-Oxley Act of 2002, Section 201, and the SEC auditor-independence rules under Rule 2-01 of Regulation S-X, which bar auditors from auditing their own work. The bar applies to auditors of public companies and to services that would impair independence.",
]


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(ROMAN, str(FONT_DIR / "NeueHaasGroteskText-Roman.ttf")))
    pdfmetrics.registerFont(TTFont(BOLD, str(FONT_DIR / "NeueHaasGroteskText-Bold.ttf")))


def draw_tracked(c: canvas.Canvas, text: str, x: float, y: float, font: str, size: float, tracking: float) -> None:
    c.setFont(font, size)
    c.setFillColor(HexColor("#14181B"))
    cursor = x
    for char in text:
        c.drawString(cursor, y, char)
        cursor += pdfmetrics.stringWidth(char, font, size) + tracking


def cover_overlay() -> bytes:
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=letter)

    # Complete the full bleed that stopped 2.16 points above the media box.
    c.setFillColor(HexColor("#04282F"))
    c.rect(0, 0, PAGE_WIDTH, 2.25, stroke=0, fill=1)

    # Match the written cover specification exactly.
    c.setStrokeColor(white)
    c.setLineCap(0)
    c.setLineWidth(2.0)
    c.line(59.976, 720.438, 111.747, 720.438)

    c.setStrokeColor(HexColor("#3E5F67"))
    c.setLineWidth(1.0)
    c.line(59.976, 67.254, 552.024, 67.254)

    c.showPage()
    c.save()
    return stream.getvalue()


def draw_footer(c: canvas.Canvas, page_number: int) -> None:
    c.setFillColor(HexColor("#6C7A80"))
    c.setFont(ROMAN, 8.0)
    c.drawString(MARGIN, 45.0, "August 2026")
    c.setFillColor(HexColor("#14181B"))
    c.setFont(BOLD, 8.0)
    c.drawRightString(PAGE_WIDTH - MARGIN, 45.0, str(page_number))


def reference_page(page_number: int, start: int, end: int) -> bytes:
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=letter)
    c.setFillColor(white)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    draw_tracked(c, "REFERENCES", MARGIN, 710.0, BOLD, 10.0, 1.2)
    if page_number == 12:
        draw_tracked(c, "CONTINUED", 154.0, 710.4, BOLD, 7.4, 0.8)

    style = ParagraphStyle(
        "reference",
        fontName=ROMAN,
        fontSize=8.6,
        leading=11.2,
        textColor=HexColor("#3A4348"),
        leftIndent=14.0,
        firstLineIndent=-14.0,
        rightIndent=0,
        alignment=TA_LEFT,
        splitLongWords=False,
        spaceAfter=7.0,
    )

    y = 686.0
    for number in range(start, end + 1):
        paragraph = Paragraph(f"{number}. {escape(REFERENCES[number - 1])}", style)
        _, height = paragraph.wrap(BODY_WIDTH, y - 70.0)
        y -= height
        paragraph.drawOn(c, MARGIN, y)
        y -= style.spaceAfter

    if y < 80:
        raise RuntimeError(f"reference page {page_number} overflows the footer")

    draw_footer(c, page_number)
    c.showPage()
    c.save()
    return stream.getvalue()


def build() -> None:
    register_fonts()
    source = PdfReader(str(SOURCE))
    if len(source.pages) != 13:
        raise RuntimeError("Built to Please must remain a 13-page publication")

    source.pages[0].merge_page(PdfReader(io.BytesIO(cover_overlay())).pages[0])
    page_11 = PdfReader(io.BytesIO(reference_page(11, 1, 6))).pages[0]
    page_12 = PdfReader(io.BytesIO(reference_page(12, 7, 12))).pages[0]

    writer = PdfWriter()
    for index, page in enumerate(source.pages):
        if index == 10:
            writer.add_page(page_11)
        elif index == 11:
            writer.add_page(page_12)
        else:
            writer.add_page(page)
    writer.add_metadata(source.metadata or {})

    TEMP.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with TEMP.open("wb") as stream:
        writer.write(stream)

    shutil.copyfile(TEMP, SOURCE)
    shutil.copyfile(TEMP, OUTPUT)
    print(f"Refined PDF written to {OUTPUT}")


if __name__ == "__main__":
    build()
