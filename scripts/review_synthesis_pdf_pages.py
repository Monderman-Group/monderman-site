"""Render every candidate PDF page and retain readable review contact sheets."""
import json
import math
import pathlib
import sys

import fitz
from PIL import Image, ImageDraw

folder = pathlib.Path(sys.argv[1]).resolve()
output = folder / "page-review"
output.mkdir(exist_ok=True)
receipts = []
for key in ("depth_synthesis", "cross_lens_synthesis"):
    document = fitz.open(folder / (key + ".pdf"))
    thumbnails = []
    chart_pages = []
    for index, page in enumerate(document):
        text = page.get_text()
        assert text.strip(), (key, index + 1, "blank page")
        assert abs(page.rect.width - 612) < 1 and abs(page.rect.height - 792) < 1
        for word in page.get_text("words"):
            assert word[0] >= -1 and word[1] >= -1 and word[2] <= 613 and word[3] <= 793, (key, index + 1, "text outside paper", word)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(output / f"{key}-{index + 1:02}.png")
        thumb = image.copy()
        thumb.thumbnail((275, 356))
        tile = Image.new("RGB", (295, 386), "#e8eded")
        tile.paste(thumb, ((295 - thumb.width) // 2, 20))
        ImageDraw.Draw(tile).text((10, 4), f"{key} · {index + 1}", fill="black")
        thumbnails.append(tile)
        if "Central case: how the value adds up" in text:
            chart_pages.append(index + 1)
        assert "Low case: how the value adds up" not in text
        assert "High case: how the value adds up" not in text
    assert len(chart_pages) == 1, (key, chart_pages)
    sheets = []
    for start in range(0, len(thumbnails), 12):
        batch = thumbnails[start:start + 12]
        sheet = Image.new("RGB", (4 * 295, math.ceil(len(batch) / 4) * 386), "#e8eded")
        for index, tile in enumerate(batch):
            sheet.paste(tile, ((index % 4) * 295, (index // 4) * 386))
        name = f"{key}-contact-{start // 12 + 1}.png"
        sheet.save(output / name)
        sheets.append(name)
    receipts.append({"product": key, "pages": len(document), "central_chart_pages": chart_pages, "contact_sheets": sheets, "nonblank_letter_pages_and_text_bounds": "PASS"})
(output / "PDF-CHECKS.json").write_text(json.dumps({"status": "PASS", "documents": receipts}, indent=2) + "\n")
print(json.dumps(receipts))
