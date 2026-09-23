"""Render every candidate PDF page and audit text bounds; no approval is issued."""
import json
import subprocess
import sys
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve()
output = root / "visual-review"
output.mkdir(exist_ok=False)
receipt = {"status": "rendered_for_visual_review", "pages": 0, "pdfs": [], "contact_sheets": []}
for pdf in sorted(root.glob("*.pdf")):
    folder = output / pdf.stem
    folder.mkdir()
    subprocess.run(["pdftoppm", "-scale-to", "1500", "-png", str(pdf), str(folder / "page")], check=True)
    with pdfplumber.open(pdf) as document:
        for number, page in enumerate(document.pages, 1):
            assert page.width == 612 and page.height == 792, (pdf.name, number, "not Letter")
            assert len((page.extract_text() or "").strip()) > 20, (pdf.name, number, "blank page")
            outside = [char for char in page.chars if char["text"].strip() and
                       (char["x0"] < -1 or char["x1"] > page.width + 1 or
                        char["top"] < -1 or char["bottom"] > page.height + 1)]
            assert not outside, (pdf.name, number, "text outside page")
        count = len(document.pages)
        receipt["pages"] += count
        receipt["pdfs"].append({"name": pdf.name, "pages": count, "bounds": "passed"})
    pages = sorted(folder.glob("page-*.png"))
    for offset in range(0, len(pages), 9):
        group = pages[offset:offset + 9]
        sheet = Image.new("RGB", (1530, 2070), "#d5dcdd")
        draw = ImageDraw.Draw(sheet)
        for index, page in enumerate(group):
            with Image.open(page) as original:
                thumbnail = original.convert("RGB")
                thumbnail.thumbnail((490, 650))
                x, y = 10 + (index % 3) * 510, 30 + (index // 3) * 690
                sheet.paste(thumbnail, (x, y))
                draw.text((x, y - 22), f"{pdf.stem} | page {offset + index + 1}", fill="black")
        path = output / f"{pdf.stem}-{offset + 1:02d}-{offset + len(group):02d}.png"
        sheet.save(path)
        receipt["contact_sheets"].append(str(path))
(output / "RENDER-CHECKS.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
