#!/usr/bin/env python3
"""Generate the unified Monderman publication social-card system."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "research"
FONT_DIR = ROOT / "pdf-src" / "fonts"

WIDTH = 1200
HEIGHT = 630


@dataclass(frozen=True)
class Card:
    slug: str
    kind: str
    topic: str
    title: str
    subtitle: str
    date: str
    title_lines: tuple[str, ...] = ()


CARDS = (
    Card("accumulated-drag-department-of-war", "Brief", "Defense", "Accumulated Drag in the Department of War", "Administrative Overhead in the U.S. Department of War", "September 2026"),
    Card("built-to-please", "Insight", "AI and institutions", "Built to Please", "Why Consumer AI Tells You What You Want to Hear, and What Serious Users Build Around It", "September 2026"),
    Card("compensatory-systems", "Brief", "Organizational systems", "Compensatory Systems", "How Workarounds Preserve Output While Masking Institutional Dysfunction", "March 2026"),
    Card("every-node-for-itself", "Insight", "AI and institutions", "Every Node for Itself", "AI, In-Housing, and the Network That Keeps Companies Honest", "September 2026"),
    Card("from-tokens-to-outcomes", "Insight", "Enterprise AI", "From Tokens to Outcomes", "How Token Economics Will Define the Next Phase of Enterprise AI", "May 2026 · Revised August 2026"),
    Card("merit-after-the-machine", "Insight", "AI and institutions", "Merit After the Machine", "Why AI Weakens the Evidence of Being Smart and Hardworking Faster Than Institutions Can Rebuild It", "September 2026"),
    Card("quarter-trillion-friction-us-healthcare", "Brief", "Healthcare", "The Quarter-Trillion-Dollar Friction in U.S. Healthcare", "How Administrative Complexity Absorbs Capacity from Patient Care", "March 2026", ("The Quarter-Trillion-Dollar", "Friction in U.S. Healthcare")),
    Card("terminal-fidelity", "Insight", "Decision design", "Terminal Fidelity", "Why Ideas in Power Consume Themselves—and Where the Enduring Ones Learn to Stop", "July 2026"),
    Card("the-art-of-interior-reasoning", "Insight", "Decision design", "The Art of Interior Reasoning", "Why Excellent Decisions Live Off the Line", "April 2026"),
    Card("the-culture-trap-brief", "Brief", "Enterprise culture", "The Culture Trap", "Why Sentiment Measurement Can Locate Strain Without Identifying the Organizational Systems Beneath It", "August 2026"),
    Card("the-unmeasured-layer", "Insight", "Institutional performance", "The Unmeasured Layer", "Administrative Reality and the Risk Standard Reporting Misses", "September 2026"),
    Card("we-gave-bureaucracy-the-fastest-tools", "Perspective", "Public institutions", "We Gave Bureaucracy the Fastest Tools in History. It Got Slower.", "", "September 2026"),
    Card("when-bureaucracy-became-the-obstacle", "Brief", "Institutional performance", "When Bureaucracy Became the Obstacle", "The Collapse of Eastman Kodak", "March 2026"),
    Card("after-the-first-lap", "Insight", "Enterprise AI", "After the First Lap", "What the first phase of enterprise AI taught us about cost, dependency, and operational discipline", "May 2026 · Revised August 2026"),
)


PALETTES = {
    "Insight": {
        "top": (11, 58, 64),
        "bottom": (4, 29, 33),
        "text": (250, 250, 248),
        "muted": (181, 207, 210),
        "accent": (156, 196, 201),
        "motif": (169, 208, 212),
        "route": (255, 255, 255),
        "line": (50, 91, 97),
    },
    "Commentary": {
        "top": (10, 53, 58),
        "bottom": (3, 26, 30),
        "text": (250, 250, 248),
        "muted": (210, 199, 178),
        "accent": (228, 182, 111),
        "motif": (223, 178, 103),
        "route": (255, 255, 255),
        "line": (83, 76, 63),
    },
    "Perspective": {
        "top": (10, 53, 58),
        "bottom": (3, 26, 30),
        "text": (250, 250, 248),
        "muted": (210, 199, 178),
        "accent": (228, 182, 111),
        "motif": (223, 178, 103),
        "route": (255, 255, 255),
        "line": (83, 76, 63),
    },
    "Brief": {
        "top": (247, 242, 232),
        "bottom": (232, 222, 205),
        "text": (24, 25, 28),
        "muted": (93, 88, 81),
        "accent": (134, 83, 13),
        "motif": (113, 83, 45),
        "route": (7, 51, 56),
        "line": (205, 193, 175),
    },
}


def interpolate(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(HEIGHT):
        draw.line((0, y, WIDTH, y), fill=interpolate(top, bottom, y / (HEIGHT - 1)))
    return image


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    names = {
        "roman": "NeueHaasGroteskText-Roman.ttf",
        "medium": "NeueHaasGroteskText-Medium.ttf",
        "bold": "NeueHaasGroteskText-Bold.ttf",
    }
    return ImageFont.truetype(str(FONT_DIR / names[weight]), size)


def text_width(draw: ImageDraw.ImageDraw, value: str, typeface: ImageFont.FreeTypeFont) -> float:
    box = draw.textbbox((0, 0), value, font=typeface)
    return box[2] - box[0]


def wrap(draw: ImageDraw.ImageDraw, value: str, typeface: ImageFont.FreeTypeFont, maximum: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = f"{current} {word}".strip()
        if current and text_width(draw, candidate, typeface) > maximum:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def title_layout(draw: ImageDraw.ImageDraw, value: str) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    for size in range(72, 41, -2):
        typeface = font("bold", size)
        lines = wrap(draw, value, typeface, 790)
        leading = round(size * .94)
        if len(lines) <= 3 and len(lines) * leading <= 202:
            return typeface, lines, leading
    typeface = font("bold", 40)
    return typeface, wrap(draw, value, typeface, 790)[:4], 40


def tracked_text(draw: ImageDraw.ImageDraw, position: tuple[int, int], value: str, typeface: ImageFont.FreeTypeFont, fill: tuple[int, int, int], tracking: int) -> None:
    x, y = position
    for character in value:
        draw.text((x, y), character, font=typeface, fill=fill)
        x += round(text_width(draw, character, typeface)) + tracking


def map_point(x: float, y: float, origin: tuple[int, int], scale: float) -> tuple[float, float]:
    return origin[0] + (x - 12) * scale, origin[1] + (y - 11.5) * scale


def draw_mark(draw: ImageDraw.ImageDraw, origin: tuple[int, int], scale: float, color: tuple[int, int, int], width: int) -> None:
    outline = ((12, 18.4), (22, 11.5), (32, 16.6), (42, 11.5), (52, 18.4), (52, 52), (42, 46.4), (32, 52), (22, 46.4), (12, 52), (12, 18.4))
    draw.line([map_point(x, y, origin, scale) for x, y in outline], fill=color, width=width, joint="curve")
    for x, y1, y2 in ((22, 11.5, 46.4), (32, 16.6, 52), (42, 11.5, 46.4)):
        draw.line((map_point(x, y1, origin, scale), map_point(x, y2, origin, scale)), fill=color, width=width)


def draw_motif(image: Image.Image, card: Card, palette: dict[str, tuple[int, int, int]]) -> Image.Image:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    origin = (870, 196)
    scale = 8.6
    motif = (*palette["motif"], 110 if card.kind != "Brief" else 96)
    route = (*palette["route"], 224)

    outline = ((12, 18.4), (22, 11.5), (32, 16.6), (42, 11.5), (52, 18.4), (52, 52), (42, 46.4), (32, 52), (22, 46.4), (12, 52), (12, 18.4))
    draw.line([map_point(x, y, origin, scale) for x, y in outline], fill=motif, width=3, joint="curve")
    for x, y1, y2 in ((22, 11.5, 46.4), (32, 16.6, 52), (42, 11.5, 46.4)):
        draw.line((map_point(x, y1, origin, scale), map_point(x, y2, origin, scale)), fill=motif, width=2)

    guide_rgb = tuple(round(c * .62 + b * .38) for c, b in zip(palette["motif"], palette["bottom"]))
    guide = (*guide_rgb, 96)
    for y in (312, 392, 472):
        for x in range(718, 1170, 18):
            draw.line((x, y, min(x + 7, 1170), y), fill=guide, width=1)

    if card.kind in {"Commentary", "Perspective"}:
        points = [(704, 478), (792, 478), (792, 428), (888, 428), (888, 374), (983, 374), (983, 318), (1117, 318)]
    elif card.kind == "Brief":
        points = [(708, 468), (802, 468), (802, 420), (890, 420), (890, 368), (1000, 368), (1000, 315), (1126, 315)]
    else:
        points = [(704, 474), (798, 474), (798, 414), (885, 414), (932, 440), (1006, 440), (1006, 354), (1127, 354)]
    draw.line(points, fill=route, width=4, joint="curve")
    node_indexes = (1, 3, 5, 7)
    for index in node_indexes:
        x, y = points[index]
        radius = 5 if index != 5 else 8
        fill = (201, 130, 31, 255) if index == 5 else route
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def render(card: Card) -> Path:
    palette = PALETTES[card.kind]
    image = gradient(palette["top"], palette["bottom"])

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_color = (*palette["motif"], 34 if card.kind != "Brief" else 24)
    glow_draw.ellipse((760, -120, 1320, 440), fill=glow_color)
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
    image = draw_motif(image, card, palette)
    draw = ImageDraw.Draw(image)

    draw_mark(draw, (72, 51), .72, palette["text"], 3)
    draw.text((112, 50), "Monderman.", font=font("bold", 34), fill=palette["text"])

    tracked_text(draw, (76, 143), f"{card.kind} · {card.topic}".upper(), font("bold", 17), palette["accent"], 2)

    if card.title_lines:
        for size in range(64, 41, -2):
            candidate = font("bold", size)
            if all(text_width(draw, line, candidate) <= 790 for line in card.title_lines):
                title_face, title_lines, leading = candidate, list(card.title_lines), round(size * .94)
                break
        else:
            title_face, title_lines, leading = font("bold", 40), list(card.title_lines), 40
    else:
        title_face, title_lines, leading = title_layout(draw, card.title)
    title_y = 195
    for line in title_lines:
        draw.text((76, title_y), line, font=title_face, fill=palette["text"])
        title_y += leading

    subtitle_y = title_y + 16
    if card.subtitle and subtitle_y < 458:
        subtitle_face = font("roman", 25)
        for line in wrap(draw, card.subtitle, subtitle_face, 725)[:2]:
            draw.text((78, subtitle_y), line, font=subtitle_face, fill=palette["muted"])
            subtitle_y += 32

    draw.line((76, 548, 1124, 548), fill=palette["line"], width=2)
    draw.text((76, 570), card.date, font=font("medium", 18), fill=palette["muted"])
    label = "MONDERMAN.COM/RESEARCH"
    label_face = font("medium", 18)
    draw.text((1124 - text_width(draw, label, label_face), 570), label, font=label_face, fill=palette["text"])

    output = OUTPUT_DIR / f"{card.slug}-social.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG", optimize=True)
    return output


def main() -> None:
    for card in CARDS:
        print(render(card).relative_to(ROOT))


if __name__ == "__main__":
    main()
