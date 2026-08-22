#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

GATED_PAGES = [
    "workspace.html",
    "workspace-diagnostics.html",
    "workspace-analysis.html",
    "workspace-actions.html",
    "workspace-settings.html",
    "decision-velocity.html",
    "operational-systems.html",
    "structural-clarity.html",
    "institutional-performance.html",
    "cross-tool-synthesis.html",
    "checkout.html",
]

for name in GATED_PAGES:
    text = (ROOT / name).read_text()
    assert 'workspace-access-gate.js' in text, f"{name} must load the central access gate"
    assert "createClient(" not in text, f"{name} must not create a second Supabase client"

gate = (ROOT / "workspace-access-gate.js").read_text()
assert gate.count("createClient(") == 1
for token in [
    "window.__mondermanSB",
    "window.mondermanWorkspaceAccessReady",
    "window.mondermanGetSupabaseClient",
    'persistSession: true',
    'autoRefreshToken: true',
    'detectSessionInUrl: true',
    'flowType: "pkce"',
    "Choose a Workspace",
    "monderman_active_organization_id",
]:
    assert token in gate, f"access-gate singleton/Workspace contract missing {token}"

for name in ["workspace-notes.js", "workspace-theme.js", "workspace-assistant.js", "workspace-shell.js"]:
    text = (ROOT / name).read_text()
    assert "createClient(" not in text, f"{name} must reuse the gated singleton"
    assert "mondermanGetSupabaseClient" in text, f"{name} must obtain the gated singleton"

for html in ROOT.glob("*.html"):
    assert html.read_text().count("createClient(") <= 1, f"{html.name} creates more than one Supabase client"

trial = (ROOT / "pattern-trial.html").read_text()
for token in [
    "/api/billing/organizations",
    'purpose:"trial"',
    "organization_selection_required",
    "Workspace for this trial",
    "This Pattern trial will start for",
    "JSON.stringify({organization_id:organizationId})",
    'source:"trial",organization_id:organizationId',
]:
    assert token in trial, f"Pattern organization selection contract missing {token}"
assert ".limit(1)" not in trial

checkout = (ROOT / "checkout.html").read_text()
for token in [
    "/api/billing/organizations",
    'purpose: "checkout"',
    "Workspace for this subscription",
    "This subscription will apply to",
    "organization_id: organizationId",
]:
    assert token in checkout, f"checkout organization selection contract missing {token}"

workspace = (ROOT / "workspace.html").read_text()
assert "activeMembership" in workspace
assert "memberships?.length===1" in workspace
assert "workspace_selection_required" in workspace
assert "organization_id:org.id||null" in workspace
assert ".eq(\"user_id\", user.id).limit(1)" not in workspace

for name in ["plan-pattern.html", "plan-signal.html", "platform-services.html"]:
    text = (ROOT / name).read_text()
    assert "monderman_active_organization_id" in text, f"{name} must carry the active Workspace"
    assert "organization_id" in text, f"{name} must propagate explicit organization_id"

for name in [
    "plan-pattern.html", "plan-signal.html", "plan-enterprise.html",
    "diagnostics.html"
]:
    assert (ROOT / name).read_text().count("createClient(") == 1, f"{name} must have one public-page auth client"

for name in ["decision-velocity.html", "operational-systems.html", "structural-clarity.html", "institutional-performance.html"]:
    text = (ROOT / name).read_text()
    assert "onAuthStateChange" not in text, f"{name} must not register a duplicate auth callback"
    assert "assignment_token" in gate, "assignment exemption must remain in the centralized gate"

print("Stabilization site regression passed: explicit Workspace billing selection and one Supabase auth client per page.")
