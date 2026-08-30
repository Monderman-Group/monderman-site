#!/usr/bin/env python3
"""Normalize favicon and social-card metadata without reformatting page markup."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
CACHE_KEY = "20260830-cert1"
SOCIAL_IMAGE = f"https://www.monderman.com/assets/brand/monderman-social-card.png?v={CACHE_KEY}"

FAVICONS = f'''  <link rel="icon" type="image/svg+xml" href="favicon.svg?v={CACHE_KEY}">
  <link rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v={CACHE_KEY}">
  <link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v={CACHE_KEY}">
  <link rel="apple-touch-icon" href="apple-touch-icon.png?v={CACHE_KEY}">
'''

SOCIAL = f'''  <meta property="og:image" content="{SOCIAL_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Monderman">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{SOCIAL_IMAGE}">
  <meta name="twitter:image:alt" content="Monderman">
'''


def sitemap_pages() -> set[str]:
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    pages = set()
    for location in re.findall(r"<loc>(.*?)</loc>", sitemap):
        path = urlparse(location).path.lstrip("/") or "index.html"
        pages.add(path)
    return pages


def normalize_head(head: str, add_social: bool) -> str:
    # Remove the oldest one-line data favicon first because it contains raw SVG
    # angle brackets inside an attribute. Then remove every remaining icon link.
    head = re.sub(r"(?mi)^[^\n]*<link[^\n]*data:image/svg\+xml[^\n]*(?:\n|$)", "", head)
    head = re.sub(
        r"(?mis)^\s*&lt;svg\b.*?&lt;/svg&gt;'\s+rel=[\"']icon[\"'][^>]*>\s*",
        "\n",
        head,
    )
    head = re.sub(
        r"[ \t]*<link\b(?=[^>]*\brel=[\"'](?:icon|apple-touch-icon)[\"'])[^>]*>[ \t]*(?:\n)?",
        "",
        head,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if add_social and "property=\"og:image\"" not in head and "property='og:image'" not in head:
        head += "\n" + SOCIAL

    marker = re.search(r"(?im)^[ \t]*(?:<style\b|<link\b[^>]*rel=[\"']stylesheet[\"'])", head)
    insertion = marker.start() if marker else len(head)
    prefix = head[:insertion].rstrip() + "\n"
    return prefix + FAVICONS + head[insertion:].lstrip("\n")


def main() -> None:
    public = sitemap_pages()
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        if path.name.startswith("google") or re.match(r"^(?:privacy|terms)-\d{4}-\d{2}-\d{2}-beta\.html$", path.name):
            continue
        source = path.read_text(encoding="utf-8")
        match = re.search(r"(?is)(<head\b[^>]*>)(.*?)(</head>)", source)
        if not match:
            raise RuntimeError(f"Missing head element: {path.name}")
        normalized = normalize_head(match.group(2), path.name in public)
        updated = source[: match.start(2)] + normalized + source[match.end(2) :]
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"normalized metadata in {changed} HTML files")


if __name__ == "__main__":
    main()
