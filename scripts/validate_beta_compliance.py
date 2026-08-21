from pathlib import Path
import re

ROOT = Path(".")

def require(text, tokens, label):
    missing = [token for token in tokens if token not in text]
    if missing:
        raise AssertionError(f"{label} missing: {', '.join(missing)}")

def validate():
    assignment = (ROOT / "assignment-mode.js").read_text(errors="ignore")
    require(assignment, [
        "sponsoring_organization_name",
        "show_results_to_assignee !== false",
        "This campaign is configured as anonymous.",
        "This campaign is attributable.",
        "The quantitative score is calculated deterministically",
        "Content needed for the Diagnostic&rsquo;s written interpretation",
        "structured Diagnostic context and results",
        "interview messages or optional written observations",
        "AI does not calculate or set the quantitative score",
        "Privacy Notice",
        "You will see the individual report after a successful submission",
        "You will not receive an individual report after submission"
    ], "participant notice")

    signin = (ROOT / "signin.html").read_text(errors="ignore")
    require(signin, [
        "I agree to the <a href=\"terms.html\"",
        "and acknowledge the <a href=\"privacy.html\"",
        "/api/legal/acceptance/status",
        "/api/legal/acceptance",
        '"google_oauth"',
        "authReturnUrl",
        "terms_version: currentDocuments.termsVersion",
        "privacy_notice_version: currentDocuments.privacyNoticeVersion"
    ], "sign-in acceptance")
    if re.search(r"accepted_at\s*:", signin):
        raise AssertionError("sign-in must not supply an acceptance timestamp")
    if "emailRedirectTo: window.location.origin + \"/\" + nextTarget" in signin:
        raise AssertionError("magic link bypasses acceptance gate")

    gate = (ROOT / "workspace-access-gate.js").read_text(errors="ignore")
    require(gate, [
        "getUser()", "/api/legal/acceptance/status?source=signup",
        "legal_acceptance_required", "mondermanWorkspaceAccessReady",
        "acceptance_source", "assignment_token"
    ], "centralized Workspace acceptance gate")
    for page in [
        "workspace.html", "workspace-diagnostics.html", "workspace-analysis.html",
        "workspace-actions.html", "workspace-settings.html", "decision-velocity.html",
        "operational-systems.html", "structural-clarity.html",
        "institutional-performance.html", "cross-tool-synthesis.html", "checkout.html"
    ]:
        if "workspace-access-gate.js" not in (ROOT / page).read_text(errors="ignore"):
            raise AssertionError(f"{page} can bypass the centralized Workspace acceptance gate")

    invite = (ROOT / "accept-invite.html").read_text(errors="ignore")
    require(invite, ["acceptance_source", '"invite"', "invite_token", "Terms of Service", "Privacy Notice"], "invite acceptance")

    trial = (ROOT / "pattern-trial.html").read_text(errors="ignore")
    require(trial, [
        "I agree to the", "and acknowledge the", 'source:\"trial\"',
        "organization_id:organizationId", "/api/legal/acceptance/status", "/api/legal/acceptance"
    ], "trial acceptance")

    privacy = (ROOT / "privacy.html").read_text(errors="ignore")
    require(privacy, [
        "Version 2026-08-20-beta", "Subprocessors and infrastructure page",
        "does not currently display a nonessential-cookie opt-in banner",
        "four-hour recovery window", "[LEGAL ENTITY AND ADDRESS TO BE CONFIRMED]",
        "[COUNSEL AND CONTRACT CONFIRMATION REQUIRED]"
    ], "Privacy Notice")
    terms = (ROOT / "terms.html").read_text(errors="ignore")
    require(terms, [
        "Version 2026-08-20-beta", "affirmative agreement", "Terms version",
        "Privacy Notice version", "server-recorded acceptance timestamp", "source/context",
        "[BUSINESS AND COUNSEL CONFIRMATION REQUIRED]"
    ], "Terms")

    subprocessors = (ROOT / "subprocessors.html").read_text(errors="ignore")
    require(subprocessors, [
        "Supabase", "Render", "Anthropic", "Resend", "Stripe", "Google", "Cloudflare",
        "Factual inventory, not a contract.", "Public-site and browser infrastructure"
    ], "subprocessor page")

    for sitemap in ["sitemap.xml", "sitemap.txt"]:
        if "subprocessors.html" not in (ROOT / sitemap).read_text(errors="ignore"):
            raise AssertionError(f"{sitemap} omits subprocessors page")

    forbidden = [
        "nothing links this response back to you",
        "not shared or distributed for any reason",
        "there’s nothing else to accept",
        "there's nothing else to accept"
    ]
    for page in ROOT.glob("*.html"):
        body = page.read_text(errors="ignore").lower()
        for phrase in forbidden:
            if phrase.lower() in body:
                raise AssertionError(f"{page.name} retains inaccurate claim: {phrase}")

    # Verify local public-page links resolve; fragments and dynamic routes are excluded.
    for page in ROOT.glob("*.html"):
        body = page.read_text(errors="ignore")
        for href in re.findall(r'href=["\']([^"\']+)["\']', body, re.I):
            target = href.split("#", 1)[0].split("?", 1)[0]
            if not target or target.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "data:", "/")):
                continue
            if target.endswith(".html") and not (ROOT / target).exists():
                raise AssertionError(f"{page.name} has broken local link {target}")

if __name__ == "__main__":
    validate()
    print("Beta compliance frontend checks passed.")
