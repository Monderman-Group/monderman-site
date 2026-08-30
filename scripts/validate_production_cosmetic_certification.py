#!/usr/bin/env python3
"""Fail the release when any approved cosmetic-audit defect returns."""

from __future__ import annotations

import re
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
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
    for token in [
        'rel="icon" type="image/svg+xml" href="favicon.svg?v=20260830-cert1"',
        'rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v=20260830-cert1"',
        'rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v=20260830-cert1"',
        'rel="apple-touch-icon" href="apple-touch-icon.png?v=20260830-cert1"',
    ]:
        require(page.count(token) == 1, f"{path.name}: favicon contract is not singular")
    require(not re.search(r"<link[^>]+data:image/svg\+xml", page.split("</head>", 1)[0], re.I), f"{path.name}: legacy inline favicon remains")

sitemap = text("sitemap.xml")
public_pages = {urlparse(url).path.lstrip("/") or "index.html" for url in re.findall(r"<loc>(.*?)</loc>", sitemap)}
for name in public_pages:
    page = text(name)
    require('property="og:image"' in page and 'name="twitter:card" content="summary_large_image"' in page, f"{name}: social-card metadata missing")

social = ROOT / "assets" / "brand" / "monderman-social-card.png"
require(social.exists(), "canonical social-card asset missing")
if social.exists():
    with social.open("rb") as stream:
        signature = stream.read(24)
    require(signature[:8] == b"\x89PNG\r\n\x1a\n", "social card is not a PNG")
    if len(signature) >= 24:
        require(struct.unpack(">II", signature[16:24]) == (1200, 630), "social card is not 1200×630")

# 6: corrected publication taxonomy on both public surfaces.
compensatory = home[home.find("How Workarounds Preserve Output While Masking Institutional Dysfunction") - 500 : home.find("How Workarounds Preserve Output While Masking Institutional Dysfunction") + 900]
require('category-brief" data-category="brief"' in compensatory and "<span class=\"placeholder-cover-type\">Brief</span>" in compensatory, "homepage Brief taxonomy missing")
research = text("research.html")
require('<span>Enterprise</span><span>Brief · PDF</span></div>\n          <h3 class="paper-title">How Workarounds Preserve Output While Masking Dysfunction</h3>' in research, "Research Brief taxonomy missing")

# 7–8: print resilience and branded not-found page.
shell_css = text("canonical-site-shell.css")
require("@media print" in shell_css and ".mond-footer" in shell_css, "shared print contract missing")
book_image = home.find('<img class="book-jacket"')
require(book_image >= 0 and 'loading="eager"' in home[book_image : book_image + 500], "homepage book image is not print-ready")
require(".latest-dots,.latest-track .is-carousel-clone{display:none!important}" in home, "homepage print duplicates looping carousel content")
not_found = text("404.html")
for token in ["This page is not here.", "canonical-site-shell.css", "monderman-map-cream.svg", 'name="robots" content="noindex, nofollow"']:
    require(token in not_found, f"branded 404 contract missing: {token}")

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

# 11: real NHG italic faces, not browser synthesis.
for token in ["56font.woff2", "66font.woff2", "76font.woff2", "font-style:italic"]:
    require(token in shell_css, f"approved italic face contract missing: {token}")

# 12: current Federal Reserve source in the canonical publication generator.
pdf_source = text("scripts/refine_built_to_please_pdf.py")
require("SR Letter 26-2" in pdf_source and "supersedes SR 11-7" in pdf_source and "excludes generative and agentic AI" in pdf_source, "Built to Please current Federal Reserve reference missing")

# 14–15: private shells stay out of search; heading levels remain sequential.
for name in ["cross-tool-synthesis.html", "workspace-actions.html", "workspace-analysis.html", "workspace-diagnostics.html", "workspace-settings.html"]:
    require('name="robots" content="noindex, nofollow"' in text(name), f"{name}: noindex contract missing")
for heading in ["Signal: platform support", "Pattern: priority + onboarding", "Enterprise: named contact", "Published, predictable pricing", "Clear data handling", "Single-vendor simplicity", "Justification, built in"]:
    require(f"<h3>{heading}</h3>" in platform, f"platform heading hierarchy missing: {heading}")

# 16–18: phone action-card flow, quiet access handoff, stable redirect harness.
actions = text("workspace-actions.html")
for token in ["white-space:normal;overflow-wrap:anywhere", "@media (max-width:560px)", 'title="${esc(memberName(it.owner_user_id)||"Assign an owner")}"']:
    require(token in actions, f"Action Plans long-content contract missing: {token}")
for name in ["checkout.html", "workspace.html", "workspace-actions.html", "workspace-analysis.html", "workspace-diagnostics.html", "workspace-settings.html", "workspace-shell.js"]:
    access_source = text(name)
    require('throw new Error("workspace_access_not_allowed")' not in access_source, f"{name}: uncaught access handoff returned")
    require("await new Promise(function () {})" in access_source, f"{name}: quiet access handoff contract missing")
mobile = text("scripts/mobile_site_presentation_smoke.mjs")
require("navigateToStableDocument" in mobile and "context was destroyed" in mobile, "mobile redirect-stability harness missing")

if errors:
    print("PRODUCTION_COSMETIC_CERTIFICATION_FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"PRODUCTION_COSMETIC_CERTIFICATION_PASS ({len(html_files)} HTML surfaces; {len(public_pages)} public metadata contracts; 18 defect guards)")
