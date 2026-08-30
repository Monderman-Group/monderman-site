#!/usr/bin/env python3
"""Apply the approved no-em-dash copy canon to customer-visible source."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNTIME = {
    "assistant.js",
    "interview-mode.js",
    "monderman-report.js",
    "monderman-viz.js",
    "workspace-assistant.js",
    "workspace-shell.js",
}


def edit_copy(source: str) -> str:
    # Missing-value sentinels must name the state instead of showing punctuation.
    source = source.replace('"\\u2014"', '"Unavailable"')
    source = source.replace("'\\u2014'", "'Unavailable'")
    source = source.replace('"—"', '"Unavailable"')
    source = source.replace("'—'", "'Unavailable'")
    source = source.replace(">&mdash;<", ">Not available<")
    source = source.replace(">—<", ">Not available<")

    # Work on one semantic token regardless of encoding or surrounding spaces.
    for token in ("&mdash;", "&#8212;", "&#x2014;", "\\u2014"):
        source = source.replace(token, "—")
    source = re.sub(r"[ \t]*—[ \t]*", " — ", source)

    # Recurrent, intentional editorial constructions.
    source = re.sub(r"([\w>)]) — Monderman\b", r"\1 | Monderman", source)
    source = source.replace("administrative reality — repeatedly", "administrative reality, repeatedly")
    source = source.replace("the site — both", "the site, both")
    source = source.replace("the method — both", "the method, both")
    source = source.replace("measurement — repeatedly", "measurement, repeatedly")
    source = source.replace("renders a considered judgment — once", "renders a considered judgment once")

    # Paired dashes mark a parenthetical interruption. Commas retain that
    # grammar without turning either half into an independent clause.
    paired = re.compile(r" — ([^—\n.!?]{1,240}) — ")
    while paired.search(source):
        source = paired.sub(r", \1, ", source)

    # Parenthetical or connective clauses take punctuation appropriate to their
    # grammar; explanatory noun phrases take a colon.
    source = re.sub(r" — (and|but|or|so|yet|because|while|when|where|which|who|whose|whether|not|rather than)\b", r", \1", source, flags=re.I)
    source = re.sub(r" — (already|especially|including|without|with|across|from|through|even|instead|then)\b", r", \1", source, flags=re.I)
    source = source.replace(" — ", ": ")

    # Any encoded dash left without surrounding spaces is a missing-value mark.
    source = source.replace("&mdash;", "Not available")
    source = source.replace("&#8212;", "Not available")
    source = source.replace("&#x2014;", "Not available")
    source = source.replace("—", ":")
    source = source.replace("\\u2014", "Unavailable")
    return source


def main() -> None:
    paths = [
        path for path in ROOT.glob("*.html")
        if not path.name.startswith("google")
        and not re.match(r"^(?:privacy|terms)-\d{4}-\d{2}-\d{2}-beta\.html$", path.name)
    ]
    paths.extend(ROOT / name for name in sorted(RUNTIME))
    changed = 0
    for path in paths:
        source = path.read_text(encoding="utf-8")
        updated = edit_copy(source)
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"normalized customer copy in {changed} files")


if __name__ == "__main__":
    main()
