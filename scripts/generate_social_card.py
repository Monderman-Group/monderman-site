#!/usr/bin/env python3
"""Generate the canonical 1200×630 Monderman social preview card."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "brand" / "monderman-social-card.png"
FONT_DIR = ROOT / "pdf-src" / "fonts"

WIDTH, HEIGHT = 1200, 630
TOP = (16, 59, 68)
MID = (11, 52, 61)
BOTTOM = (4, 40, 47)
CREAM = (250, 250, 248)
TEAL_LIGHT = (156, 196, 201)


def interpolate(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


image = Image.new("RGB", (WIDTH, HEIGHT))
pixels = image.load()
for y in range(HEIGHT):
    split = round(HEIGHT * 0.55)
    if y <= split:
        color = interpolate(TOP, MID, y / split)
    else:
        color = interpolate(MID, BOTTOM, (y - split) / (HEIGHT - split - 1))
    for x in range(WIDTH):
        pixels[x, y] = color

draw = ImageDraw.Draw(image)

# Folded-map M, matching the approved site mark geometry and stroke balance.
scale = 2.65
origin_x, origin_y = 74, 69


def point(x: float, y: float) -> tuple[float, float]:
    return origin_x + x * scale, origin_y + y * scale


outline = [(9.5, 15), (20.75, 8), (32, 14), (43.25, 8), (54.5, 15), (54.5, 56),
           (43.25, 49), (32, 55), (20.75, 49), (9.5, 56), (9.5, 15)]
draw.line([point(x, y) for x, y in outline], fill=CREAM, width=10, joint="curve")
for x, y1, y2 in [(20.75, 8, 49), (32, 14, 55), (43.25, 8, 49)]:
    draw.line([point(x, y1), point(x, y2)], fill=CREAM, width=8)

bold = ImageFont.truetype(str(FONT_DIR / "NeueHaasGroteskText-Bold.ttf"), 76)
roman = ImageFont.truetype(str(FONT_DIR / "NeueHaasGroteskText-Roman.ttf"), 34)
medium = ImageFont.truetype(str(FONT_DIR / "NeueHaasGroteskText-Medium.ttf"), 20)

draw.text((250, 111), "Monderman.", font=bold, fill=CREAM)
draw.text((250, 414), "Organizations deliver at the speed of", font=roman, fill=CREAM)
draw.text((250, 459), "their administrative reality.", font=roman, fill=TEAL_LIGHT)
draw.text((76, 551), "MONDERMAN.COM", font=medium, fill=TEAL_LIGHT, spacing=4)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, format="PNG", optimize=True)
print(OUTPUT)
