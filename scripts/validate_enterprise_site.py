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
BASELINE = "7bab72de03e3e6f8595b85c1a17f30b49a7deec1"
ENTERPRISE_STYLESHEET = "enterprise-site.css?v=20260906-enterprise1"
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
SCRIPT_SAFE_PAGES = {
    "index.html",
    "decision-velocity.html",
    "operational-systems.html",
    "structural-clarity.html",
    "institutional-performance.html",
    "diagnostics.html",
    "connect.html",
    "plan-enterprise.html",
    "signin.html",
    "workspace.html",
    "workspace-actions.html",
    "workspace-analysis.html",
    "workspace-diagnostics.html",
    "workspace-settings.html",
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


def inline_scripts(source: str) -> list[str]:
    scripts: list[str] = []
    pattern = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.I | re.S)
    for attrs, body in pattern.findall(source):
        if re.search(r"\bsrc\s*=", attrs, re.I):
            continue
        type_match = re.search(r"\btype\s*=\s*['\"]([^'\"]+)", attrs, re.I)
        script_type = type_match.group(1).lower() if type_match else ""
        if script_type and script_type not in {"text/javascript", "application/javascript", "module"}:
            continue
        scripts.append(body)
    return scripts


def normalize_approved_visual_script_changes(scripts: list[str]) -> list[str]:
    normalized: list[str] = []
    for script in scripts:
        script = script.replace(
            "M9.5 15L20.75 8L32 14L43.25 8L54.5 15V56L43.25 49L32 55L20.75 49L9.5 56Z",
            "[MONDERMAN-OUTER-MARK]",
        ).replace(
            "M12 18.4L22 11.5L32 16.6L42 11.5L52 18.4V52L42 46.4L32 52L22 46.4L12 52Z",
            "[MONDERMAN-OUTER-MARK]",
        ).replace(
            "M20.75 8V49M32 14V55M43.25 8V49",
            "[MONDERMAN-INNER-MARK]",
        ).replace(
            "M22 11.5V46.4M32 16.6V52M42 11.5V46.4",
            "[MONDERMAN-INNER-MARK]",
        )
        normalized.append(script)
    return normalized


def baseline_source(name: str) -> str | None:
    result = subprocess.run(
        ["git", "show", f"{BASELINE}:{name}"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return result.stdout if result.returncode == 0 else None


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

        if 'id="siteHeader"' in source and page.name not in IMMUTABLE_LEGAL_PAGES:
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

        for fragment in OLD_MARK_FRAGMENTS:
            if fragment in source:
                errors.append(f"{page.name}: retired folded-map geometry remains")

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

    for path in ROOT.glob("*.js"):
        source = path.read_text(encoding="utf-8", errors="ignore")
        for fragment in OLD_MARK_FRAGMENTS:
            if fragment in source:
                errors.append(f"{path.name}: retired folded-map geometry remains")

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

    canonical_shell = (ROOT / "canonical-site-shell.js").read_text(encoding="utf-8")
    if NEW_MARK_FRAGMENTS[0] not in canonical_shell:
        errors.append("canonical shell: new small mark missing")
    for token in (
        "Run Decision Velocity",
        "Platform Overview",
        "Solutions",
        "Research Library",
        "Plans and Pricing",
        "Trust and Security",
        "monderman-lockup__period",
    ):
        if token not in canonical_shell:
            errors.append(f"canonical shell: {token!r} missing")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for token in (
        'class="acquisition-layer"',
        "Explore the platform",
        "View sample reports",
        "Run Decision Velocity",
        "Limited pilot",
        "Four diagnostics. One operating system.",
        "Measure once to see the condition. Return to learn whether it changed.",
    ):
        if token not in index:
            errors.append(f"index.html: enterprise narrative token {token!r} missing")
    if index.find('class="acquisition-layer"') < index.find("Explore the platform"):
        errors.append("index.html: temporary acquisition layer displaced the permanent platform story")

    for name in sorted(SCRIPT_SAFE_PAGES):
        current_path = ROOT / name
        baseline = baseline_source(name)
        if baseline is None or not current_path.exists():
            continue
        current = current_path.read_text(encoding="utf-8", errors="ignore")
        if normalize_approved_visual_script_changes(inline_scripts(current)) != normalize_approved_visual_script_changes(inline_scripts(baseline)):
            errors.append(f"{name}: executable inline script changed from rollback baseline")

    if errors:
        print("Enterprise-site validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        f"Enterprise-site validation passed: {len(html_pages)} HTML pages; "
        f"{len(SCRIPT_SAFE_PAGES)} protected executable surfaces; new mark and acquisition hierarchy verified."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
