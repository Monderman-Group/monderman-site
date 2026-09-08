#!/usr/bin/env python3
"""Generate the canonical 1200×630 Monderman wordmark preview card."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "brand" / "monderman-social-card.png"
FONT_DIR = ROOT / "pdf-src" / "fonts"

WIDTH, HEIGHT = 1200, 630
TOP_LEFT = (26, 85, 93)
TOP_RIGHT = (9, 53, 62)
BOTTOM_LEFT = (9, 59, 68)
BOTTOM_RIGHT = (2, 35, 42)
CREAM = (250, 250, 248)


def interpolate(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


image = Image.new("RGB", (WIDTH, HEIGHT))
pixels = image.load()
for y in range(HEIGHT):
    vertical = y / (HEIGHT - 1)
    left = interpolate(TOP_LEFT, BOTTOM_LEFT, vertical)
    right = interpolate(TOP_RIGHT, BOTTOM_RIGHT, vertical)
    for x in range(WIDTH):
        pixels[x, y] = interpolate(left, right, x / (WIDTH - 1))

draw = ImageDraw.Draw(image)

# Preview surfaces already supply the site title and domain. Keep the image to
# the approved wordmark alone so saved-page cards remain quiet and legible.
wordmark = "Monderman."
bold = ImageFont.truetype(str(FONT_DIR / "NeueHaasGroteskText-Bold.ttf"), 160)
bounds = draw.textbbox((0, 0), wordmark, font=bold)
text_width = bounds[2] - bounds[0]
text_height = bounds[3] - bounds[1]
x = (WIDTH - text_width) / 2 - bounds[0]
y = (HEIGHT - text_height) / 2 - bounds[1]
draw.text((x, y), wordmark, font=bold, fill=CREAM)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, format="PNG", optimize=True)
print(OUTPUT)
