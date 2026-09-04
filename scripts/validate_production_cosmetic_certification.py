#!/usr/bin/env python3
"""Fail the release when any approved cosmetic-audit defect returns."""

from __future__ import annotations

import re
import os
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from normalize_site_metadata import normalize_head


ROOT = Path(os.environ.get("MONDERMAN_CERT_ROOT", Path(__file__).resolve().parents[1])).resolve()
errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def text(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


class VisibleCopy(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.values: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "svg", "template"}:
            self.hidden += 1
        if not self.hidden:
            for key, value in attrs:
                if value and (key in {"aria-label", "title", "alt", "placeholder"} or tag == "meta" and key == "content"):
                    self.values.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "svg", "template"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self.hidden and data.strip():
            self.values.append(data)


class DocumentFacts(VisibleCopy):
    """Parse real document nodes; comments and source-code strings never count."""

    def __init__(self) -> None:
        super().__init__()
        self.in_head = False
        self.head_tags: list[tuple[str, dict[str, str]]] = []
        self.declarations: list[str] = []

    def handle_decl(self, decl: str) -> None:
        self.declarations.append(decl.strip().lower())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.lower()
        if normalized == "head":
            self.in_head = True
        if self.in_head:
            self.head_tags.append((normalized, {key.lower(): value or "" for key, value in attrs}))
        super().handle_starttag(normalized, attrs)

    def handle_endtag(self, tag: str) -> None:
        super().handle_endtag(tag.lower())
        if tag.lower() == "head":
            self.in_head = False


def parse_document(source: str) -> DocumentFacts:
    parser = DocumentFacts()
    parser.feed(source)
    return parser


def without_html_comments(source: str) -> str:
    return re.sub(r"(?s)<!--.*?-->", "", source)


def without_code_comments(source: str) -> str:
    output: list[str] = []
    index = 0
    quote: str | None = None
    escaped = False
    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""
        if quote is not None:
            output.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            index += 1
            continue
        if char in {'"', "'", "`"}:
            quote = char
            output.append(char)
            index += 1
            continue
        if char == "/" and following == "*":
            closing = source.find("*/", index + 2)
            index = len(source) if closing < 0 else closing + 2
            output.append(" ")
            continue
        if char == "/" and following == "/":
            newline = source.find("\n", index + 2)
            if newline < 0:
                break
            output.append("\n")
            index = newline + 1
            continue
        output.append(char)
        index += 1
    return "".join(output)


def executable_source(source: str) -> str:
    scripts = re.findall(r"(?is)<script\b[^>]*>(.*?)</script>", source)
    return without_code_comments("\n".join(scripts) if scripts else source)


def has_meta(document: DocumentFacts, key: str, value: str, content: str | None = None) -> bool:
    for tag, attrs in document.head_tags:
        if tag != "meta" or attrs.get(key, "").lower() != value.lower():
            continue
        if content is None or attrs.get("content", "").lower() == content.lower():
            return True
    return False


# 1–2: targeted dark-surface legibility and approved muted tones.
platform = text("platform-services.html")
require(".canonical-green-shell .ps-roi .ps-section-label" in platform and "color:#A9CFD2" in platform, "ROI section label contrast contract missing")
require(".canonical-green-shell .ps-roi .ps-h2{color:#fff}" in platform, "ROI heading contrast contract missing")
for name, forbidden in [("signin.html", "--ink-muted:#9A9892"), ("Monderman_Platform_Brief.html", "--muted2:#8A8C88")]:
    require(forbidden not in text(name), f"low-contrast muted token returned in {name}")

# 3–4: closed utility content and compact-control touch targets.
connect = text("connect-widget.js")
for token in ["'aria-hidden': 'true'", "inert: ''", "panel.toggleAttribute('inert', !open)", "width:44px", "height:44px"]:
    require(token in connect, f"Connect accessibility contract missing: {token}")
home = text("index.html")
for token in ["width: 24px;", "height: 24px;", ".latest-dot::before"]:
    require(token in home, f"carousel dot target contract missing: {token}")

# 5 and 9: one favicon family everywhere; share cards on every sitemap page.
html_files = [
    path for path in ROOT.glob("*.html")
    if not path.name.startswith("google")
    and not re.match(r"^(?:privacy|terms)-\d{4}-\d{2}-\d{2}-beta\.html$", path.name)
]
for path in html_files:
    page = path.read_text(encoding="utf-8")
    document = parse_document(page)
    require(page.lstrip().lower().startswith("<!doctype html>"), f"{path.name}: non-document output precedes the doctype")
    require(not re.search(r"(?im)^\s*(?:warning:\s*truncated output|total output lines:)", page), f"{path.name}: tool-output warning is customer-visible")
    require(not re.search(r">\s*:\s*</(?:p|div|span)>", without_html_comments(page), re.I), f"{path.name}: isolated colon placeholder is customer-visible")
    links = [attrs for tag, attrs in document.head_tags if tag == "link"]
    favicon_cache_key = "20260830-cert1" if path.name in {"privacy.html", "terms.html"} else "20260903-optical1"
    expected_links = [
        {"rel": "icon", "type": "image/svg+xml", "href": f"favicon.svg?v={favicon_cache_key}"},
        {"rel": "icon", "type": "image/x-icon", "sizes": "any", "href": f"favicon.ico?v={favicon_cache_key}"},
        {"rel": "icon", "type": "image/png", "sizes": "192x192", "href": f"favicon-192.png?v={favicon_cache_key}"},
        {"rel": "apple-touch-icon", "href": f"apple-touch-icon.png?v={favicon_cache_key}"},
    ]
    for expected in expected_links:
        matches = [attrs for attrs in links if all(attrs.get(key) == value for key, value in expected.items())]
        require(len(matches) == 1, f"{path.name}: real favicon link is missing or duplicated: {expected['href']}")
    require(not any("data:image/svg+xml" in attrs.get("href", "").lower() for attrs in links), f"{path.name}: legacy inline favicon remains")
    require(not any(tag in {"svg", "rect", "text"} for tag, _ in document.head_tags), f"{path.name}: orphaned inline-favicon markup remains in the head")

favicon_svg = text("favicon.svg")
for token in [
    'viewBox="0 0 32 32"',
    '<linearGradient id="bg"',
    'stroke="#FFFFFF"',
    'M6 9.25L11 5.75L16 8.25L21 5.75L26 9.25',
    'M11 5.75V22.5M16 8.25V25M21 5.75V22.5',
]:
    require(token in favicon_svg, f"optically balanced favicon contract missing: {token}")

for name, expected_size in [("favicon-192.png", 192), ("apple-touch-icon.png", 180), ("assets/brand/monderman-favicon-512.png", 512)]:
    icon_path = ROOT / name
    require(icon_path.exists(), f"icon asset missing: {name}")
    if icon_path.exists():
        signature = icon_path.read_bytes()[:26]
        require(signature[:8] == b"\x89PNG\r\n\x1a\n", f"icon asset is not a PNG: {name}")
        if len(signature) >= 26:
            require(struct.unpack(">II", signature[16:24]) == (expected_size, expected_size), f"icon asset dimensions are wrong: {name}")
            require(signature[25] == 2, f"icon asset must be opaque RGB: {name}")

ico_path = ROOT / "favicon.ico"
require(ico_path.exists(), "favicon.ico is missing")
if ico_path.exists():
    ico = ico_path.read_bytes()
    require(len(ico) >= 54 and struct.unpack("<HHH", ico[:6]) == (0, 1, 3), "favicon.ico directory header is invalid")
    if len(ico) >= 54:
        sizes = {(ico[6 + index * 16] or 256, ico[7 + index * 16] or 256) for index in range(3)}
        require(sizes == {(16, 16), (32, 32), (48, 48)}, "favicon.ico optical sizes are incomplete")

legacy_favicon = """\n<title>Fixture</title>\n<link href='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">\n  <rect width=\"64\" height=\"64\"/>\n  <text x=\"17\" y=\"42\">M</text>\n</svg>' rel=\"icon\" type=\"image/svg+xml\"/>\n<style>body{color:#000}</style>\n"""
damaged_favicon_tail = """\n<title>Fixture</title>\n<rect width=\"64\" height=\"64\"/>\n<text x=\"17\" y=\"42\">M</text>\n</svg>' />\n<style>body{color:#000}</style>\n"""
for label, fixture in [("multiline data URI", legacy_favicon), ("orphaned SVG tail", damaged_favicon_tail)]:
    repaired = normalize_head(fixture, add_social=False)
    repaired_without_code = re.sub(
        r"(?is)<(?:script|style)\b.*?</(?:script|style)>", "", repaired
    )
    require(
        not re.search(r"(?is)data:image/svg\+xml|<(?:svg|rect|text)\b|</svg>\s*['\"]?\s*/?>", repaired_without_code),
        f"metadata normalizer does not repair {label}",
    )

sitemap = text("sitemap.xml")
public_pages = {urlparse(url).path.lstrip("/") or "index.html" for url in re.findall(r"<loc>(.*?)</loc>", sitemap)}
for name in public_pages:
    page = text(name)
    document = parse_document(page)
    require(has_meta(document, "property", "og:image") and has_meta(document, "name", "twitter:card", "summary_large_image"), f"{name}: real social-card metadata missing")

social = ROOT / "assets" / "brand" / "monderman-social-card.png"
require(social.exists(), "canonical social-card asset missing")
if social.exists():
    with social.open("rb") as stream:
        signature = stream.read(24)
    require(signature[:8] == b"\x89PNG\r\n\x1a\n", "social card is not a PNG")
    if len(signature) >= 24:
        require(struct.unpack(">II", signature[16:24]) == (1200, 630), "social card is not 1200×630")

# 6: corrected publication taxonomy on both public surfaces.
home_without_comments = without_html_comments(home)
compensatory_match = re.search(
    r'<article\b[^>]*class="[^"]*category-brief[^"]*"[^>]*data-category="brief"[^>]*>'
    r'(?:(?!</article>).)*How Workarounds Preserve Output While Masking Institutional Dysfunction'
    r'(?:(?!</article>).)*</article>',
    home_without_comments,
    re.S,
)
require(compensatory_match is not None and '<span class="placeholder-cover-type">Brief</span>' in compensatory_match.group(0), "homepage Brief taxonomy missing")
research = text("research.html")
require('<span>Enterprise</span><span>Brief · HTML + PDF</span></div>\n          <h3 class="paper-title">How Workarounds Preserve Output While Masking Dysfunction</h3>' in without_html_comments(research), "Research Brief taxonomy missing")

# 7–8: print resilience and branded not-found page.
shell_css = text("canonical-site-shell.css")
shell_css_without_comments = without_code_comments(shell_css)
require("@media print" in shell_css_without_comments and ".mond-footer" in shell_css_without_comments, "shared print contract missing")
require("@media(max-width:1180px)" in shell_css_without_comments, "tablet navigation breakpoint contract missing")
require('(max-width: 1180px)' in without_code_comments(text("canonical-site-shell.js")), "tablet navigation behavior breakpoint missing")
book_image = home.find('<img class="book-jacket"')
require(book_image >= 0 and 'loading="eager"' in home[book_image : book_image + 500], "homepage book image is not print-ready")
require(".latest-dots,.latest-track .is-carousel-clone{display:none!important}" in home, "homepage print duplicates looping carousel content")
not_found = text("404.html")
for token in ["This page is not here.", "canonical-site-shell.css", "monderman-map-cream.svg"]:
    require(token in not_found, f"branded 404 contract missing: {token}")
require(has_meta(parse_document(not_found), "name", "robots", "noindex, nofollow"), "branded 404 real noindex contract missing")

# 10 and 13: language canon in visible HTML and customer-visible runtime strings.
british = re.compile(r"\b(organisation(?:s|'s|’s)?|organisational|colour(?:s)?|behaviour(?:s)?|centre(?:s)?|recognis(?:e|ed|ing)|analys(?:e|ed)|licence(?:s)?|favour(?:s|ed|ing)?|labour|programme(?:s)?|modelling|authorised|summaris(?:e|ed|ing)|prioritis(?:e|ed|ing))\b", re.I)
for path in html_files:
    parser = VisibleCopy()
    parser.feed(path.read_text(encoding="utf-8"))
    require(not any("—" in value for value in parser.values), f"{path.name}: visible em dash returned")
    require(not any(british.search(value) for value in parser.values), f"{path.name}: non-US customer spelling returned")
for name in ["assistant.js", "interview-mode.js", "monderman-report.js", "monderman-viz.js", "workspace-assistant.js", "workspace-shell.js"]:
    source = text(name)
    strings = [match[1] for match in re.findall(r"(['\"])(.*?)(?<!\\)\1", source, flags=re.S)]
    require(not any("—" in value or british.search(value) for value in strings), f"{name}: runtime copy canon violation")
for malformed in ["Hi:", "Sorry:", "I’m Hans:", "signed in: unlock"]:
    require(
        not any(malformed in text(path.name) for path in html_files)
        and not any(malformed in text(name) for name in ["assistant.js", "workspace-assistant.js"]),
        f"mechanical punctuation returned: {malformed}",
    )

# 11: real NHG italic faces, not browser synthesis.
for token in ["56font.woff2", "66font.woff2", "76font.woff2", "font-style:italic"]:
    require(token in shell_css_without_comments, f"approved italic face contract missing: {token}")
for name in ["56font.woff2", "66font.woff2", "76font.woff2"]:
    font = ROOT / name
    require(font.exists() and font.stat().st_size > 1000, f"approved italic font asset missing or empty: {name}")

# 12: current Federal Reserve source in the canonical publication generator.
pdf_source = text("scripts/refine_built_to_please_pdf.py")
require("SR Letter 26-2" in pdf_source and "supersedes SR 11-7" in pdf_source and "excludes generative and agentic AI" in pdf_source, "Built to Please current Federal Reserve reference missing")

# 14–15: private shells stay out of search; heading levels remain sequential.
for name in ["cross-tool-synthesis.html", "workspace-actions.html", "workspace-analysis.html", "workspace-diagnostics.html", "workspace-settings.html"]:
    require(has_meta(parse_document(text(name)), "name", "robots", "noindex, nofollow"), f"{name}: real noindex contract missing")
for heading in ["Signal: platform support", "Pattern: priority + onboarding", "Enterprise: named contact", "Published, predictable pricing", "Clear data handling", "Single-vendor simplicity", "Justification, built in"]:
    require(f"<h3>{heading}</h3>" in platform, f"platform heading hierarchy missing: {heading}")

# 16–18: phone action-card flow, quiet access handoff, stable redirect harness.
actions = text("workspace-actions.html")
for token in ["white-space:normal;overflow-wrap:anywhere", "@media (max-width:560px)", 'title="${esc(memberName(it.owner_user_id)||"Assign an owner")}"', ">No actions</p>"]:
    require(token in actions, f"Action Plans long-content contract missing: {token}")
for name in ["checkout.html", "workspace.html", "workspace-actions.html", "workspace-analysis.html", "workspace-diagnostics.html", "workspace-settings.html", "workspace-shell.js"]:
    access_source = executable_source(text(name))
    require('throw new Error("workspace_access_not_allowed")' not in access_source, f"{name}: uncaught access handoff returned")
    require(re.search(r"if\s*\(\s*!workspaceAccess\?\.allowed\s*\)\s*await\s+new\s+Promise\s*\(\s*function\s*\(\s*\)\s*\{\s*\}\s*\)", access_source) is not None, f"{name}: executable quiet access handoff contract missing")
mobile = text("scripts/mobile_site_presentation_smoke.mjs")
require("navigateToStableDocument" in mobile and "context was destroyed" in mobile, "mobile redirect-stability harness missing")
motif_source = executable_source(home)
require('motif.setAttribute("viewBox", compactMotif ? "0 0 344 188" : "0 0 320 164")' in motif_source, "phone tile motif geometry contract missing")
require('motif.setAttribute("preserveAspectRatio", compactMotif ? "xMaxYMax meet" : "xMidYMid meet")' in motif_source, "phone tile motif alignment contract missing")

if errors:
    print("PRODUCTION_COSMETIC_CERTIFICATION_FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"PRODUCTION_COSMETIC_CERTIFICATION_PASS ({len(html_files)} HTML surfaces; {len(public_pages)} public metadata contracts; 18 defect guards)")
