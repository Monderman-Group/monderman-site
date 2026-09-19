#!/usr/bin/env python3
"""Release guard for the Monderman enterprise-site presentation system."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / ".render-public"
ENTERPRISE_STYLESHEET = "enterprise-site.css?v=20260915.consistency1"
OLD_MARK_FRAGMENTS = (
    "M9.5 15L20.75 8L32 14L43.25 8L54.5 15",
    "M20.75 8V49M32 14V55M43.25 8V49",
)
NEW_MARK_FRAGMENTS = (
    "M6 9.2 11 5.75 16 8.3 21 5.75 26 9.2V26",
    "M12 18.4L22 11.5L32 16.6L42 11.5L52 18.4V52",
)
COMMERCIAL_PAGES = {
    "index.html",
    "Monderman_Platform_Brief.html",
    "diagnostics.html",
    "platform-services.html",
    "why-monderman.html",
    "roi.html",
    "plan-signal.html",
    "plan-pattern.html",
    "plan-enterprise.html",
    "pilot.html",
    "new-in-the-role.html",
    "after-an-acquisition.html",
    "transformation-behind-schedule.html",
    "after-a-reorganization.html",
}
IMMUTABLE_LEGAL_PAGES = {
    "privacy.html",
    "terms.html",
    "privacy-2026-08-20-beta.html",
    "privacy-2026-08-24-beta.html",
    "privacy-2026-08-26-beta.html",
    "terms-2026-08-20-beta.html",
    "terms-2026-08-24-beta.html",
    "terms-2026-08-26-beta.html",
}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.refs: list[tuple[str, str]] = []
        self.h1_count = 0
        self.title_depth = 0
        self.title_text: list[str] = []
        self.meta_description = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.title_depth += 1
        if tag == "meta" and values.get("name", "").lower() == "description":
            self.meta_description = values.get("content", "").strip()
        for attr in ("href", "src", "poster"):
            if values.get(attr):
                self.refs.append((attr, values[attr]))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self.title_depth:
            self.title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.title_depth:
            self.title_text.append(data)


def local_target(page: Path, raw: str) -> Path | None:
    if not raw or raw.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc or "${" in raw or "{{" in raw:
        return None
    route = unquote(parsed.path)
    if not route:
        return None
    target = (page.parent / route).resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        return None
    if route.endswith("/"):
        target = target / "index.html"
    return target


def main() -> int:
    errors: list[str] = []
    html_pages = sorted(ROOT.glob("*.html"))

    for page in html_pages:
        source = page.read_text(encoding="utf-8", errors="ignore")
        parser = PageParser()
        parser.feed(source)

        duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
        if duplicates:
            errors.append(f"{page.name}: duplicate ids {', '.join(duplicates)}")

        if 'id="siteHeader"' in source and page.name not in IMMUTABLE_LEGAL_PAGES and not re.match(r"(?:privacy|terms)-\d{4}-", page.name):
            if source.count(f'href="{ENTERPRISE_STYLESHEET}"') != 1:
                errors.append(f"{page.name}: enterprise stylesheet must be loaded exactly once")
            if not re.search(r"<body\b[^>]*\bcanonical-green-shell\b", source, re.I):
                errors.append(f"{page.name}: canonical body scope missing")

        title = " ".join(parser.title_text).strip()
        if not page.name.startswith("google") and not title:
            errors.append(f"{page.name}: title missing")
        if page.name in COMMERCIAL_PAGES and len(parser.meta_description) < 50:
            errors.append(f"{page.name}: useful meta description missing")
        if page.name in COMMERCIAL_PAGES and parser.h1_count != 1:
            errors.append(f"{page.name}: expected one h1, found {parser.h1_count}")

        for _, raw in parser.refs:
            target = local_target(page, raw)
            if target is not None and not target.exists():
                errors.append(f"{page.name}: missing local target {raw}")

        if page.name in COMMERCIAL_PAGES:
            visible = re.sub(r"<script\b.*?</script>|<style\b.*?</style>", " ", source, flags=re.I | re.S)
            visible = re.sub(r"<[^>]+>", " ", visible)
            for forbidden_pattern in (
                r"\bMonderman (?:survey|assessment)\b",
                r"\b(?:take|start|run) (?:the |a )?(?:survey|assessment)\b",
                r"\bself-guided\b",
            ):
                if re.search(forbidden_pattern, visible, re.I):
                    errors.append(f"{page.name}: product language matches {forbidden_pattern!r}")

    for path in (ROOT / "assets" / "brand").glob("*.svg"):
        source = path.read_text(encoding="utf-8", errors="ignore")
        for fragment in OLD_MARK_FRAGMENTS:
            if fragment in source:
                errors.append(f"{path.relative_to(ROOT)}: retired folded-map geometry remains")

    small_mark = (ROOT / "assets/brand/monderman-mark-v2-small.svg").read_text(encoding="utf-8")
    if NEW_MARK_FRAGMENTS[0] not in small_mark:
        errors.append("small optical master: canonical geometry missing")
    if 'stroke="#FFFFFF"' not in small_mark:
        errors.append("small optical master: pure-white linework missing")
    if "16 26" not in small_mark or "6 26Z" not in small_mark:
        errors.append("small optical master: bottom-point baseline contract missing")

    canonical_shell = "\n".join(
        (ROOT / "site-shell" / name).read_text(encoding="utf-8")
        for name in ("header.html", "footer.html")
    )
    if NEW_MARK_FRAGMENTS[0] not in canonical_shell:
        errors.append("canonical shell: new small mark missing")
    for token in (
        "Request an invitation",
        "Platform Brief",
        "Solutions",
        "Research Library",
        "Pricing",
        "Trust and Security",
        "monderman-lockup__period",
    ):
        if token not in canonical_shell:
            errors.append(f"canonical shell: {token!r} missing")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for token in (
        "View sample reports",
        "Request an invitation",
        "Activate your invitation",
        "Four diagnostics for how your organization works.",
        "Measure once to see the condition. Return to learn whether it changed.",
    ):
        if token not in index:
            errors.append(f"index.html: enterprise narrative token {token!r} missing")
    if not 0 <= index.find("Request an invitation") < index.find("Four diagnostics for how your organization works."):
        errors.append("index.html: invitation entry point must precede the permanent platform story")
    for retired in ("Run Decision Velocity free", "Join the pilot waitlist", "Measurement choices"):
        if retired in canonical_shell or retired in index:
            errors.append(f"Public entry: retired offer/control {retired!r} remains")

    # Reviewed invitation/countdown changes are explicit, not broad exclusions.
    # The shared contract locks unchanged evidence/scoring interfaces and
    # reconstructs the complete old renderer from the exact Sankey-only delta.
    protection = subprocess.run(
        ["node", "scripts/invited_evaluation_source_contract.mjs"],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    if protection.returncode:
        errors.append("Protected source contract failed: " + protection.stderr.strip())

    if not PUBLIC_ROOT.is_dir():
        errors.append("public build missing; run scripts/render-static-build.sh first")
    else:
        public_pages = sorted(PUBLIC_ROOT.glob("*.html"))
        rejected_motif_tokens = (
            "data-construction",
            "data-secondary",
            "data-node",
            "hero-route-field",
            "publication-hero__motif",
            "placeholder-cover-motif",
        )
        for page in public_pages:
            source = page.read_text(encoding="utf-8", errors="ignore")
            for token in rejected_motif_tokens:
                if token in source:
                    errors.append(f"{page.name}: retired decorative motif token {token!r} reached public build")

        expected_header = (ROOT / "site-shell" / "header.html").read_text(encoding="utf-8").strip()
        expected_footer = (ROOT / "site-shell" / "footer.html").read_text(encoding="utf-8").strip()
        header_pattern = re.compile(r'<header\b(?=[^>]*\bid=["\']siteHeader["\'])[^>]*>[\s\S]*?</header>', re.I)
        footer_pattern = re.compile(r'<footer\b(?=[^>]*\bclass=["\'][^"\']*\bmond-footer\b[^"\']*["\'])[^>]*>[\s\S]*?</footer>', re.I)
        for page in public_pages:
            source = page.read_text(encoding="utf-8", errors="ignore")
            if "canonical-green-shell" not in source:
                continue
            header_match = header_pattern.search(source)
            footer_match = footer_pattern.search(source)
            if not header_match or header_match.group(0).strip() != expected_header:
                errors.append(f"{page.name}: public header differs from canonical shell")
            if not footer_match or footer_match.group(0).strip() != expected_footer:
                errors.append(f"{page.name}: public footer differs from canonical shell")

    if errors:
        print("Enterprise-site validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        f"Enterprise-site validation passed: {len(html_pages)} HTML pages; "
        "exact invitation source contract, local links, canonical public shell and entry hierarchy verified."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
