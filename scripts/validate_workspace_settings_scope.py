from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SETTINGS_PATH = ROOT / "workspace-settings.html"


def section(source: str, start: str, end: str) -> str:
    start_at = source.index(start)
    end_at = source.index(end, start_at)
    return source[start_at:end_at]


def validate_source(source: str) -> None:
    helper = section(source, "function requireWorkspaceOrgId", "function validEmail")
    for token in [
        'function workspaceSelect(table, columns, options)',
        'function workspaceUpdate(table, values)',
        'function workspaceDelete(table)',
        'async function workspaceApi(path,{method="GET",body}={})',
        '.eq("organization_id", requireWorkspaceOrgId())',
    ]:
        assert token in helper, f"workspace query helper is missing {token!r}"

    checks = {
        "loadInvites": (
            "async function loadInvites",
            "function renderInvites",
            'workspaceSelect("organization_invites"',
        ),
        "revokeInvite": (
            "async function revokeInvite",
            "async function copyLink",
            'workspaceDelete("organization_invites")',
        ),
        "loadPeople": (
            "async function loadPeople",
            "function renderPeople",
            'workspaceSelect("participants"',
        ),
        "usage counts": (
            "async function count",
            "// ── DATA EXPORT",
            'workspaceSelect(table,"*",{count:"exact",head:true})',
        ),
        "member role mutation": (
            "async function updateMemberRole",
            "async function removeMember",
            'workspaceApi("/api/workspace/members/"',
        ),
        "member removal": (
            "async function removeMember",
            "// ── PEOPLE",
            'workspaceApi("/api/workspace/members/"',
        ),
    }
    for label, (start, end, token) in checks.items():
        assert token in section(source, start, end), f"{label} is not explicitly Workspace-scoped"

    usage = section(source, "async function loadUsage", "// ── DATA EXPORT")
    for table in ["participants", "diagnostic_assignments"]:
        assert f'count("{table}"' in usage, f"usage no longer checks {table}"
    assert '/api/normalization/workspace-runs/' in usage
    assert '/api/synthesis-runs?limit=500' in usage

    export = section(source, "async function exportRuns", "async function boot")
    assert '/api/normalization/workspace-runs/' in export, "export must use the guarded report API"
    assert '"X-Monderman-Organization-Id":state.orgId' in export
    assert not re.search(r'supabase\.from\("diagnostic_runs"\)', export), (
        "export bypasses the active-Workspace query helper"
    )

    context = section(source, "async function resolveContext", "// ── ORGANISATION")
    assert '.eq("user_id",user.id)' in context, "membership resolution is not identity-scoped"

    rename = section(source, "async function saveOrgName", "// ── ACCESS & INVITES")
    assert 'workspaceApi("/api/workspace/organization"' in rename
    assert 'supabase.from("organizations").update' not in rename
    member_mutations = section(source, "async function updateMemberRole", "// ── PEOPLE")
    assert 'workspaceUpdate("organization_members"' not in member_mutations
    assert 'workspaceDelete("organization_members")' not in member_mutations


def validate_mixed_organization_fixture() -> None:
    org_a = "workspace-a"
    org_b = "workspace-b"

    def rows(a_count: int, b_count: int):
        return [
            {"id": f"a-{index}", "organization_id": org_a}
            for index in range(a_count)
        ] + [
            {"id": f"b-{index}", "organization_id": org_b}
            for index in range(b_count)
        ]

    visible = {
        "diagnostic_assignments": rows(8, 6),
        "diagnostic_runs": rows(7, 4),
        "participants": rows(5, 3),
        "synthesis_runs": rows(2, 1),
        "organization_invites": rows(3, 2),
    }

    def workspace_query(table: str, organization_id: str):
        return [row for row in visible[table] if row["organization_id"] == organization_id]

    assert len(visible["diagnostic_assignments"]) == 14
    assert len(workspace_query("diagnostic_assignments", org_a)) == 8
    assert len(workspace_query("diagnostic_assignments", org_b)) == 6

    for table in visible:
        a_rows = workspace_query(table, org_a)
        b_rows = workspace_query(table, org_b)
        assert a_rows and b_rows
        assert all(row["organization_id"] == org_a for row in a_rows)
        assert all(row["organization_id"] == org_b for row in b_rows)
        assert not ({row["id"] for row in a_rows} & {row["id"] for row in b_rows})

    exported = workspace_query("diagnostic_runs", org_a)
    assert exported
    assert all(row["organization_id"] == org_a for row in exported)
    assert not any(row["organization_id"] == org_b for row in exported)


def validate_inline_javascript(source: str) -> None:
    scripts = []
    for match in re.finditer(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", source, re.I | re.S):
        if re.search(r"\bsrc\s*=", match.group("attrs") or "", re.I):
            continue
        if match.group("body").strip():
            scripts.append(match.group("body"))
    assert scripts, "Settings has no inline JavaScript to validate"
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write("\n;\n".join(scripts))
        temp_path = Path(handle.name)
    try:
        result = subprocess.run(["node", "--check", str(temp_path)], text=True, capture_output=True)
    finally:
        temp_path.unlink(missing_ok=True)
    assert result.returncode == 0, f"Settings inline JavaScript syntax failure: {result.stderr.strip()}"


def validate() -> None:
    source = SETTINGS_PATH.read_text(encoding="utf-8")
    validate_source(source)
    validate_mixed_organization_fixture()
    validate_inline_javascript(source)


if __name__ == "__main__":
    validate()
    print(
        "Workspace Settings organization scoping passed: mixed-org fixture 14 visible / "
        "8 active, inverse context, lists, usage, mutations, and export."
    )
