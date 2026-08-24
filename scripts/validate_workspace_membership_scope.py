#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "workspace-analysis.html": 1,
    "workspace-actions.html": 1,
    "workspace-diagnostics.html": 2,
}

needle = '.eq("user_id",user.id).eq("organization_id",window.__mondermanActiveOrganizationId).maybeSingle()'

errors = []
for name, expected in FILES.items():
    source = (ROOT / name).read_text(errors="ignore")
    actual = source.count(needle)
    if actual != expected:
        errors.append(f"{name}: expected {expected} user-scoped active-membership queries, found {actual}")

actions_source = (ROOT / "workspace-actions.html").read_text(errors="ignore")
if "[hidden]{display:none!important}" not in actions_source:
    errors.append("workspace-actions.html: hidden Analyst-restricted controls must not be visually exposed by button display rules")

if errors:
    raise SystemExit("\n".join(errors))

print("Workspace active-membership queries are scoped to the signed-in user.")
