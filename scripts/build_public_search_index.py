#!/usr/bin/env python3
"""Build the browser search index from explicitly public HTML copy."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public-search-index.json"

PAGES = {
    "index.html": "Overview",
    "Monderman_Platform_Brief.html": "Platform",
    "diagnostics.html": "Diagnostics",
    "operational-systems-article.html": "Diagnostics",
    "decision-velocity-article.html": "Diagnostics",
    "structural-clarity-article.html": "Diagnostics",
    "institutional-performance-article.html": "Diagnostics",
    "sample-report.html": "Sample reports",
    "roi.html": "Platform",
    "deterministic-ai-infrastructure.html": "Platform",
    "research.html": "Research",
    "the-culture-trap.html": "Research",
    "governing-complexity.html": "Research",
    "designing-for-decision-velocity.html": "Research",
    "the-drift-problem.html": "Research",
    "after-the-first-lap.html": "Research",
    "decision-velocity-article.html": "Research",
    "institutional-performance-article.html": "Research",
    "operational-systems-article.html": "Research",
    "structural-clarity-article.html": "Research",
    "platform-services.html": "Plans & services",
    "plan-signal.html": "Plans & services",
    "plan-pattern.html": "Plans & services",
    "plan-enterprise.html": "Plans & services",
    "why-monderman.html": "Company",
    "about.html": "Company",
    "security.html": "Company",
    "connect.html": "Company",
    "privacy.html": "Policies",
    "subprocessors.html": "Policies",
    "terms.html": "Policies",
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


class PublicCopyParser(HTMLParser):
    SKIP = {"script", "style", "noscript", "header", "footer", "nav", "form", "button", "template", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.in_main = False
        self.has_main = False
        self.in_title = False
        self.heading_depth = 0
        self.h1_depth = 0
        self.title_parts: list[str] = []
        self.heading_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.main_parts: list[str] = []
        self.body_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        classes = set((attrs_dict.get("class") or "").split())
        inline_hidden = "display:none" in (attrs_dict.get("style") or "").replace(" ", "").lower()
        if self.skip_depth or tag in self.SKIP or "hidden" in attrs_dict or attrs_dict.get("aria-hidden") == "true" or inline_hidden or classes.intersection({"differentiators-compact", "visually-hidden"}):
            self.skip_depth += 1
            return
        if tag == "main":
            self.in_main = True
            self.has_main = True
        if tag == "title":
            self.in_title = True
        if tag in {"h1", "h2", "h3"}:
            self.heading_depth += 1
        if tag == "h1":
            self.h1_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag == "main":
            self.in_main = False
        if tag == "title":
            self.in_title = False
        if tag in {"h1", "h2", "h3"} and self.heading_depth:
            self.heading_depth -= 1
        if tag == "h1" and self.h1_depth:
            self.h1_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.skip_depth or not data.strip():
            return
        if self.in_title:
            self.title_parts.append(data)
        if self.heading_depth:
            self.heading_parts.append(data)
        if self.h1_depth:
            self.h1_parts.append(data)
        self.body_parts.append(data)
        if self.in_main:
            self.main_parts.append(data)


def build() -> list[dict[str, str]]:
    records = []
    for filename, category in PAGES.items():
        path = ROOT / filename
        parser = PublicCopyParser()
        parser.feed(path.read_text(encoding="utf-8"))
        headings = clean(" ".join(parser.heading_parts))
        text = clean(" ".join(parser.main_parts if parser.has_main else parser.body_parts))
        document_title = clean(" ".join(parser.title_parts).split("|")[0])
        heading_title = clean(" ".join(parser.h1_parts))
        title = heading_title or document_title or filename.removesuffix(".html").replace("-", " ").title()
        records.append({"url": filename, "title": title, "category": category, "headings": headings, "text": text})
    return records


if __name__ == "__main__":
    OUTPUT.write_text(json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
