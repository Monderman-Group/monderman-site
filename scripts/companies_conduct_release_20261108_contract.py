"""Admit Governance and Performance Part 9 and preserve older release contracts.

The current publication is checked from the actual candidate bytes. Historical
contracts execute in the last admitted Part 8 checkout, whose own frozen
successor contract then projects each older release into its reviewed context.
"""

from __future__ import annotations

import argparse
import functools
import hashlib
from html.parser import HTMLParser
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading


ROOT = Path(__file__).resolve().parents[1]
PRIOR_RELEASE = "a76ad4ff80562a69dcff5bce6ce0551855ec4631"
PRIOR_CONTRACT = "scripts/companies_culture_release_20261028_contract.py"
AI_MIDDLE_RELEASE = "d06ef7f3e77f9e904900be2d8007f6875e4951f7"
AI_MIDDLE_CONTRACT = "scripts/ai_middle_release_20261028_contract.py"
COSMETIC_RELEASE = "a344cf9ba4c263d381fb4f94c77ca16b3f6a5f8f"
ARTICLE = "companies-cant-buy-a-culture.html"
PDF = "Monderman_Insight_Companies_Cant_Buy_a_Culture_2026-11-08.pdf"
FIGURES = [
    "assets/research/companies-culture-page-and-plan.png",
    "assets/research/companies-culture-who-pays.png",
    "assets/research/companies-culture-four-questions.png",
]
HISTORICAL_BROWSER_SCRIPTS = {
    "scripts/authored_report_experience_smoke.mjs",
    "scripts/brand_surface_consistency_smoke.mjs",
    "scripts/cosmetic_regression_smoke.mjs",
    "scripts/durable_organization_browser_smoke.mjs",
    "scripts/hold_collide_browser_smoke.mjs",
    "scripts/homepage_assistant_smoke.mjs",
    "scripts/homepage_card_rhythm_smoke.mjs",
    "scripts/homepage_refinement_20261014_browser.mjs",
    "scripts/homepage_sample_discovery_smoke.mjs",
    "scripts/homepage_workspace_demo_smoke.mjs",
    "scripts/marketing_completion_browser_smoke.mjs",
    "scripts/marketing_photo_presentation_20261013_browser.mjs",
    "scripts/marketing_refresh_browser_smoke.mjs",
    "scripts/methodology_business_copy_smoke.mjs",
    "scripts/mobile_site_presentation_smoke.mjs",
    "scripts/report_presentation_smoke.mjs",
    "scripts/report_screen_experience_smoke.mjs",
    "scripts/sample_marketing_language_hover_smoke.mjs",
    "scripts/sample_product_fidelity_smoke_v2.mjs",
    "scripts/sample_tile_smoke.mjs",
    "scripts/scope_beta_20261014_browser.mjs",
    "scripts/site_system_visual_smoke.mjs",
}
RELEASE_FILES = {
    ARTICLE: "e6e7afc1dea88e3ccd9514709927e36681cf381096d97ebc86eda2f09e2a0081",
    PDF: "890f48d16665103134b9fbbc6be2da30312df9b1c1f72006dd6b41d24fc1667f",
    "assets/research/companies-culture-page-and-plan.png": "d898296dd6b4bf6923a4e7810d4d75c97330b71c85bd6f9e1de304f1112b1cb4",
    "assets/research/companies-culture-page-and-plan.svg": "2acfc5533c7673eee7232943af1e39d4056799f8a152517981c113b8179cb97a",
    "assets/research/companies-culture-who-pays.png": "603285e6f2d2b0f112c797b833a382ccb09453dfe42bfaa78e0cf07f2540556b",
    "assets/research/companies-culture-who-pays.svg": "85ce5844c9a266fd538e7ae6e96f6b2e4f7689839a8bf7d6e38bf78be7fb0a9f",
    "assets/research/companies-culture-four-questions.png": "69b9481acb2e866220a7f527530c5d05937ac4c7c01933999891097bd4f6ba9c",
    "assets/research/companies-culture-four-questions.svg": "2b7e1b03e52f654f51234ac533eb907bf129ec753e8ac583cdb9c975a52dfff3",
}


class QuietStaticHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-c", "core.fsmonitor=false", *args], cwd=root, text=True
    ).strip()


class ArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: dict[str, str] = {}
        self.references: dict[str, str] = {}
        self.images: list[str] = []
        self._kind: str | None = None
        self._key: str | None = None
        self._end: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "img" and values.get("src"):
            self.images.append(values["src"] or "")
        if tag == "p" and values.get("data-source-block"):
            self._kind, self._key, self._end, self._parts = (
                "paragraph",
                values["data-source-block"],
                tag,
                [],
            )
        elif tag == "li" and values.get("data-source-block"):
            self._kind, self._key, self._end, self._parts = (
                "reference",
                values["data-source-block"],
                tag,
                [],
            )

    def handle_data(self, data: str) -> None:
        if self._kind:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._kind and tag == self._end:
            target = self.paragraphs if self._kind == "paragraph" else self.references
            assert self._key and self._key not in target
            target[self._key] = "".join(self._parts)
            self._kind = self._key = self._end = None
            self._parts = []


def parse_article(path: Path) -> ArticleParser:
    parser = ArticleParser()
    parser.feed(path.read_text())
    parser.close()
    return parser


def audit_source(require_clean: bool) -> dict[str, object]:
    for name, expected in RELEASE_FILES.items():
        path = ROOT / name
        assert path.is_file() and not path.is_symlink(), f"Regular release file: {name}"
        assert sha256(path) == expected, f"Reviewed release bytes: {name}"
        git(ROOT, "ls-files", "--error-unmatch", name)

    if require_clean:
        assert not git(ROOT, "status", "--porcelain", "--untracked-files=all"), (
            "Clean committed Part 9 candidate"
        )

    source = (ROOT / ARTICLE).read_text()
    parsed = parse_article(ROOT / ARTICLE)
    assert len(parsed.paragraphs) == 58 and len(parsed.references) == 12
    assert parsed.images[:3] == FIGURES and len(parsed.images) == 4
    assert "Governance and Performance · Part 9" in source
    assert '<meta name="author" content="Jason Adamson">' in source
    assert "https://www.monderman.com/" + ARTICLE in source
    assert 'href="companies-dont-have-a-culture.html"' in source
    assert "linkedin.com/pulse" not in source.lower()
    assert "monderman-article-audio:" not in source and "data-article-audio" not in source
    hero = source.split('<main class="article-main"', 1)[0]
    assert "<img" not in hero, "No Part 9 cover art"

    pdf = (ROOT / PDF).read_bytes()
    assert pdf.startswith(b"%PDF-") and b"%%EOF" in pdf[-2048:]

    manifest = json.loads((ROOT / "article-audio-manifest.json").read_bytes())
    audio_paths = [entry["path"] for entry in manifest["articles"]]
    assert manifest["status"] == "passed" and len(audio_paths) == 31
    assert ARTICLE not in audio_paths, "No unrequested Part 9 narration"

    research = (ROOT / "research.html").read_text()
    section = re.search(
        r'<section class="series" aria-labelledby="governance-performance-title">([\s\S]*?)</section>',
        research,
    )
    assert section and [int(n) for n in re.findall(r"Part\s+(\d+)", section[1])] == list(
        range(9, 0, -1)
    )

    homepage = (ROOT / "index.html").read_text()
    cards = re.findall(r'<article class="latest-card\b[\s\S]*?</article>', homepage)
    assert cards and f'data-publication="{ARTICLE.removesuffix(".html")}"' in cards[0]
    assert "<img" not in cards[0]

    topics = json.loads((ROOT / "research-topics.json").read_bytes())
    assert sum(row.get("path") == ARTICLE for row in topics["articles"]) == 1
    search = json.loads((ROOT / "public-search-index.json").read_bytes())
    assert sum(row.get("url") == ARTICLE for row in search) == 1
    assert ARTICLE in (ROOT / "sitemap.xml").read_text()
    assert ARTICLE in (ROOT / "sitemap.txt").read_text()

    return {
        "article": ARTICLE,
        "part": 9,
        "paragraphs": 58,
        "references": 12,
        "figures": 3,
        "audio_articles_preserved": 31,
    }


def audit_public(root: Path, channel: str) -> dict[str, object]:
    root = root.resolve()
    assert channel in {"current", "legacy"}
    assert root.is_dir() and not root.is_symlink()

    for name in [PDF, *FIGURES]:
        assert sha256(root / name) == RELEASE_FILES[name], f"Public release bytes: {name}"

    authored = parse_article(ROOT / ARTICLE)
    public = parse_article(root / ARTICLE)
    assert public.paragraphs == authored.paragraphs and public.references == authored.references
    assert public.images[:3] == FIGURES
    public_source = (root / ARTICLE).read_text()
    assert "data-article-audio" not in public_source

    marker = json.loads((root / ".well-known/monderman-release.json").read_bytes())
    assert marker == {"revision": git(ROOT, "rev-parse", "HEAD")}
    questionnaire = json.loads(
        (root / ".well-known/monderman-questionnaire-release.json").read_bytes()
    )
    assert questionnaire["channel"] == channel

    manifest = json.loads((ROOT / "article-audio-manifest.json").read_bytes())
    entries = manifest["articles"]
    assert len(entries) == 31 and ARTICLE not in {row["path"] for row in entries}
    assert sum((root / row["path"]).read_text().count("data-article-audio") for row in entries) == 31

    return {"channel": channel, "native_audio_players": 31, "part_9_audio_player": False}


def prior_checkout(
    channel: str,
    built: bool,
    revision: str = PRIOR_RELEASE,
    context: str = "default",
) -> tuple[Path, dict[str, str]]:
    suffix = hashlib.sha256(str(ROOT).encode()).hexdigest()[:8]
    base = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())).resolve() / (
        "monderman-companies-conduct-history-"
        + revision[:8]
        + "-"
        + context
        + "-"
        + suffix
    )
    if not base.exists():
        subprocess.run(
            ["git", "clone", "--quiet", "--shared", "--no-checkout", str(ROOT), str(base)],
            check=True,
        )
        subprocess.run(
            ["git", "checkout", "--quiet", "--detach", revision], cwd=base, check=True
        )
    assert git(base, "rev-parse", "HEAD") == revision
    assert not git(base, "status", "--porcelain", "--untracked-files=all")

    env = os.environ.copy()
    env["RENDER_GIT_COMMIT"] = revision
    env["MONDERMAN_QUESTIONNAIRE_RELEASE"] = channel
    if built:
        questionnaire = base / ".render-public/.well-known/monderman-questionnaire-release.json"
        built_channel = None
        if questionnaire.exists():
            built_channel = json.loads(questionnaire.read_bytes()).get("channel")
        if built_channel != channel:
            subprocess.run(
                ["bash", "scripts/render-static-build.sh"],
                cwd=base,
                env=env,
                check=True,
                stdout=subprocess.DEVNULL,
            )
    return base, env


def delegate_prior(argv: list[str], channel: str) -> None:
    argv = list(argv)
    if "--" in argv:
        command_at = argv.index("--") + 1
        if command_at < len(argv) and argv[command_at] == "python":
            argv[command_at] = "python3"
    command = argv[argv.index("--") + 1 :] if "--" in argv else []
    script_name = command[1] if len(command) > 1 else ""
    ai_middle_scripts = {
        "scripts/hold_collide_browser_smoke.mjs",
        "scripts/durable_organization_browser_smoke.mjs",
        "scripts/cosmetic_regression_smoke.mjs",
    }
    reviewed_release = AI_MIDDLE_RELEASE if script_name in ai_middle_scripts else PRIOR_RELEASE
    reviewed_contract = AI_MIDDLE_CONTRACT if script_name in ai_middle_scripts else PRIOR_CONTRACT
    built = "--built" in argv or (
        len(command) >= 2
        and command[0] == "node"
        and command[1] in HISTORICAL_BROWSER_SCRIPTS
    )
    checkout_context = hashlib.sha256("\0".join(command).encode()).hexdigest()[:8]
    base, env = prior_checkout(channel, built, reviewed_release, checkout_context)
    print(
        "COMPANIES_CONDUCT_HISTORICAL_PROJECTION "
        + json.dumps(
            {
                "candidate": git(ROOT, "rev-parse", "HEAD"),
                "reviewed_release": reviewed_release,
                "arguments": argv,
            },
            sort_keys=True,
        ),
        flush=True,
    )
    direct_prior_commands = {
        ("node", "scripts/public_sample_fixture.mjs", "--check"),
        ("node", "scripts/refresh_public_sample_previews.mjs", "--check"),
        ("node", "scripts/public_sample_three_benefit_preview_smoke.mjs"),
        ("node", "scripts/report_overview_site_compatibility_smoke.mjs"),
        ("node", "scripts/site_consistency_copy_smoke.mjs"),
        ("node", "scripts/organization_scope_copy_smoke.mjs"),
        ("node", "scripts/sample_marketing_language_hover_smoke.mjs"),
        ("python3", "scripts/validate_report_presentation.py"),
        ("python3", "scripts/validate_sample_product_fidelity.py"),
        ("python3", "scripts/validate_six_product_ecosystem.py"),
    }
    direct_prior_commands.update(
        ("node", script) for script in HISTORICAL_BROWSER_SCRIPTS
    )
    cosmetic_commands = {
        ("python3", "scripts/validate_production_cosmetic_certification.py"),
        ("python3", "scripts/certification_guard_sensitivity_smoke.py"),
    }
    direct_prior_prefixes = {
        ("node", "scripts/methodology_business_copy_smoke.mjs"),
    }
    if tuple(command) in cosmetic_commands:
        suffix = hashlib.sha256(str(ROOT).encode()).hexdigest()[:8]
        cosmetic_base = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())).resolve() / (
            "monderman-companies-conduct-cosmetic-history-" + suffix
        )
        if not cosmetic_base.exists():
            subprocess.run(
                ["git", "clone", "--quiet", "--shared", "--no-checkout", str(ROOT), str(cosmetic_base)],
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "--detach", COSMETIC_RELEASE],
                cwd=cosmetic_base,
                check=True,
            )
        assert git(cosmetic_base, "rev-parse", "HEAD") == COSMETIC_RELEASE
        assert not git(cosmetic_base, "status", "--porcelain", "--untracked-files=all")
        cosmetic_env = os.environ.copy()
        cosmetic_env["RENDER_GIT_COMMIT"] = COSMETIC_RELEASE
        subprocess.run(command, cwd=cosmetic_base, env=cosmetic_env, check=True)
        assert not git(cosmetic_base, "status", "--porcelain", "--untracked-files=all")
    elif tuple(command) in direct_prior_commands or tuple(command[:2]) in direct_prior_prefixes:
        subprocess.run([sys.executable, reviewed_contract], cwd=base, env=env, check=True)
        loader: Path | None = None
        projected_command = list(command)
        playwright = ROOT / "node_modules/playwright/index.mjs"
        if command[:1] == ["node"] and playwright.is_file():
            loader = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / (
                "monderman-historical-playwright-loader-"
                + checkout_context
                + "-"
                + hashlib.sha256(str(ROOT).encode()).hexdigest()[:8]
                + ".mjs"
            )
            loader.write_text(
                "import {pathToFileURL} from 'node:url';\n"
                + "const entry=" + json.dumps(playwright.as_uri()) + ";\n"
                + "export async function resolve(specifier,context,nextResolve){"
                + "if(specifier==='playwright')return {url:entry,shortCircuit:true};"
                + "return nextResolve(specifier,context);}\n"
            )
            projected_command = ["node", "--experimental-loader=" + str(loader), *command[1:]]
        research_artifacts = {
            "scripts/hold_collide_browser_smoke.mjs": "hold-collide-browser",
            "scripts/durable_organization_browser_smoke.mjs": "durable-organization-browser",
        }
        historical_server_env = {
            "scripts/hold_collide_browser_smoke.mjs": "SITE_BASE_URL",
            "scripts/durable_organization_browser_smoke.mjs": "SITE_BASE_URL",
            "scripts/cosmetic_regression_smoke.mjs": "SITE_BASE",
            "scripts/marketing_refresh_browser_smoke.mjs": "SITE_BASE",
            "scripts/marketing_photo_presentation_20261013_browser.mjs": "SITE_BASE",
            "scripts/marketing_completion_browser_smoke.mjs": "SITE_BASE",
        }
        server: http.server.ThreadingHTTPServer | None = None
        server_thread: threading.Thread | None = None
        exclude_path: Path | None = None
        exclude_bytes: bytes | None = None
        command_env = env.copy()
        if script_name in research_artifacts:
            raw_exclude_path = Path(git(base, "rev-parse", "--git-path", "info/exclude"))
            exclude_path = raw_exclude_path if raw_exclude_path.is_absolute() else base / raw_exclude_path
            exclude_bytes = exclude_path.read_bytes()
            if b"tmp/\n" not in exclude_bytes.splitlines(keepends=True):
                exclude_path.write_bytes(exclude_bytes + b"\ntmp/\n")
        server_env_name = historical_server_env.get(script_name)
        if server_env_name:
            handler = functools.partial(
                QuietStaticHandler,
                directory=str(base / ".render-public"),
            )
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()
            command_env[server_env_name] = f"http://127.0.0.1:{server.server_port}"
        try:
            subprocess.run(projected_command, cwd=base, env=command_env, check=True)
            artifact_name = research_artifacts.get(script_name)
            if artifact_name:
                source = base / "tmp" / artifact_name
                destination_parent = ROOT / "tmp"
                destination = destination_parent / artifact_name
                assert source.is_dir() and not source.is_symlink()
                assert not destination.exists() and not destination.is_symlink()
                destination_parent.mkdir(exist_ok=True)
                assert destination_parent.is_dir() and not destination_parent.is_symlink()
                shutil.move(str(source), str(destination))
                source.parent.rmdir()
        finally:
            if server:
                server.shutdown()
                server.server_close()
            if server_thread:
                server_thread.join()
            if exclude_path is not None and exclude_bytes is not None:
                exclude_path.write_bytes(exclude_bytes)
            if loader:
                loader.unlink(missing_ok=True)
    else:
        subprocess.run([sys.executable, reviewed_contract, *argv], cwd=base, env=env, check=True)
    assert not git(base, "status", "--porcelain", "--untracked-files=all")


def main() -> None:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--worktree", action="store_true")
    parser.add_argument("--built", type=Path)
    parser.add_argument("--channel", choices=["current", "legacy"])
    parser.add_argument("--historical", action="store_true")
    known, _ = parser.parse_known_args()

    result: dict[str, object] = {"source": audit_source(not known.worktree)}
    if known.built and not known.historical:
        assert known.channel
        result["public"] = audit_public(known.built, known.channel)

    historical_api = any(
        flag in sys.argv[1:]
        for flag in [
            "--historical",
            "--browser-history",
            "--source-predicate",
            "--read-baseline-public",
            "--history-api",
            "--history-file",
        ]
    )
    if historical_api:
        channel = known.channel or os.environ.get("MONDERMAN_QUESTIONNAIRE_RELEASE", "current")
        if known.historical and "--channel" in sys.argv:
            channel = sys.argv[sys.argv.index("--channel") + 1]
        delegate_prior(sys.argv[1:], channel)
        audit_source(not known.worktree)
        return

    assert not any(arg == "--" for arg in sys.argv[1:])
    print("COMPANIES_CONDUCT_CURRENT_PASS " + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
