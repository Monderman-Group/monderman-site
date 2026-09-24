#!/usr/bin/env python3
"""Capture only the reviewed September 24 HTML-copy delta for historical guards.

Explicit maintenance command, never run by CI. Changing the generated fixture
requires reviewing the diff and updating the independent digest in the inverse.
It does not authorize runtime, pricing, policy or scoring changes.
"""
import difflib
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "dd80e27f4ee63f9ac0b2385010ab2d4f92a61cb2"
FILES = """Monderman_Platform_Brief.html accept-invite.html
accumulated-drag-department-of-war.html built-to-please.html checkout-success.html
connect.html cross-tool-synthesis.html decision-velocity-article.html
designing-for-decision-velocity.html deterministic-ai-infrastructure.html
from-tokens-to-outcomes.html governing-complexity.html index.html
institutional-performance-article.html merit-after-the-machine.html
operational-systems-article.html plan-pattern.html plan-signal.html
platform-services.html research.html roi.html security.html structural-clarity-article.html
subprocessors.html the-art-of-interior-reasoning.html the-culture-trap-brief.html
the-culture-trap.html the-drift-problem.html quarter-trillion-friction-us-healthcare.html
when-bureaucracy-became-the-obstacle.html why-monderman.html workspace-actions.html
workspace-diagnostics.html workspace-settings.html workspace.html""".split()
digest = lambda data: hashlib.sha256(data.encode()).hexdigest()
entries = {}
changed_html = set(subprocess.check_output(
    ["git", "diff", BASE, "--name-only", "--", "*.html"], cwd=ROOT
).decode().splitlines())
assert not (changed_html - set(FILES)), f"Unreviewed HTML files: {sorted(changed_html - set(FILES))}"
for file in sorted(FILES):
    before = subprocess.check_output(["git", "show", f"{BASE}:{file}"], cwd=ROOT).decode()
    after = (ROOT / file).read_text()
    if before == after:
        continue
    old, new = before.splitlines(keepends=True), after.splitlines(keepends=True)
    offsets = [0]
    # JavaScript slices use UTF-16 code units, including in supplementary text.
    for line in new:
        offsets.append(offsets[-1] + len(line.encode("utf-16-le")) // 2)
    replacements = []
    for kind, a, b, c, d in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
        if kind != "equal":
            replacements.append([offsets[c], offsets[d], "".join(new[c:d]), "".join(old[a:b])])
    entries[file] = {"before_sha256": digest(before), "after_sha256": digest(after), "replacements": replacements}
payload = json.dumps({"baseline": BASE, "files": entries}, indent=2, ensure_ascii=False) + "\n"
target = ROOT / "scripts/fixtures/public-copy-clarity-20260924.json"
target.write_text(payload)
print(f"{len(entries)} reviewed HTML files; fixture SHA256 {digest(payload)}")
