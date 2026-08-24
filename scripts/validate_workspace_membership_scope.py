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

if errors:
    raise SystemExit("\n".join(errors))

print("Workspace active-membership queries are scoped to the signed-in user.")
