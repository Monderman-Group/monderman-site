from pathlib import Path
import re

ROOT = Path(".")

def require(text, tokens, label):
    missing = [token for token in tokens if token not in text]
    if missing:
        raise AssertionError(f"{label} missing: {', '.join(missing)}")

UNRESOLVED_LEGAL_MARKERS = [
    re.compile(r"\[[^\]]*(?:TBD|TO BE CONFIRMED|CONFIRMATION REQUIRED|DECISION REQUIRED|COUNSEL REVIEW)[^\]]*\]", re.I),
    re.compile(r"\bTBD\b", re.I),
    re.compile(r"\bto be confirmed\b", re.I),
    re.compile(r"\bcounsel review\b", re.I),
    re.compile(r"\b(?:business|legal|counsel|contract|product) confirmation required\b", re.I),
    re.compile(r"\b(?:business|legal|counsel|product) decision required\b", re.I),
    re.compile(r"\bunresolved (?:legal |production )?(?:drafting )?(?:marker|placeholder)s?\b", re.I),
]

def assert_no_drafting_markers(text, label):
    for pattern in UNRESOLVED_LEGAL_MARKERS:
        match = pattern.search(text)
        if match:
            raise AssertionError(f"{label} contains unresolved drafting marker: {match.group(0)}")

PROVIDER_REFERENCES = {
    "Supabase": "https://supabase.com/security",
    "Render": "https://render.com/docs/ddos-protection",
    "Anthropic": "https://trust.anthropic.com/",
    "Resend": "https://resend.com/legal/subprocessors",
    "Stripe": "https://stripe.com/legal/dpa",
    "Google": "https://safety.google/safety/",
    "Cloudflare": "https://www.cloudflare.com/trust-hub/",
}

def assert_provider_inventory(center, legacy):
    # The current inventory is canonical; historical legal links still resolve
    # through the compatibility page. This changes no legal or approval pins.
    sections = re.findall(r'<section\b[^>]*aria-labelledby="providers"[^>]*>[\s\S]*?</section>', center)
    if len(sections) != 1:
        raise AssertionError("canonical provider inventory must have one providers section")
    inventory = sections[0]
    require(inventory, [
        '<h2 id="providers">', "Public-site and browser infrastructure",
        "This inventory describes current providers, not a separate contract.",
        "they do not certify Monderman.", "applicable signed organizational data-processing terms",
    ], "canonical provider inventory")
    cards = re.findall(r'<article class="trust-provider">[\s\S]*?</article>', inventory)
    if len(cards) != len(PROVIDER_REFERENCES):
        raise AssertionError("canonical provider inventory must retain all seven provider cards")
    for name, url in PROVIDER_REFERENCES.items():
        matching = [card for card in cards if f'<a href="{url}">{name}</a>' in card]
        if len(matching) != 1:
            raise AssertionError(f"canonical provider inventory missing or duplicating provider: {name}")
        require(matching[0], ['<dt>Purpose</dt>', '<dt>Information received</dt>'], f"provider {name}")
    require(legacy, ['<link rel="canonical" href="https://www.monderman.com/security.html">'], "legacy provider canonical destination")
    for anchor in ["providers", "ai-processing", "provider-security"]:
        if center.count(f'id="{anchor}"') != 1 or legacy.count(f'id="{anchor}"') != 1:
            raise AssertionError(f"provider anchor must resolve exactly once on each page: {anchor}")
        legacy_sections = re.findall(r'<section\b[^>]*aria-labelledby="' + anchor + r'"[^>]*>[\s\S]*?</section>', legacy)
        if len(legacy_sections) != 1 or legacy_sections[0].count(f'href="security.html#{anchor}"') != 1:
            raise AssertionError(f"legacy provider anchor must link to its exact canonical destination: {anchor}")
    if re.search(r'<meta[^>]+http-equiv\s*=\s*["\']?refresh', legacy, re.I):
        raise AssertionError("legacy provider page must preserve anchors, not force a timed redirect")
    assert_no_drafting_markers(center, "Trust and Security Center")
    assert_no_drafting_markers(legacy, "Subprocessor compatibility page")

def assert_provider_inventory_negative_controls(center, legacy):
    mutations = []
    for name, url in PROVIDER_REFERENCES.items():
        mutations.append((center.replace(f'<a href="{url}">{name}</a>', f'<a href="{url}">Missing provider</a>'), legacy))
    for anchor in ["providers", "ai-processing", "provider-security"]:
        mutations.append((center, legacy.replace(f'href="security.html#{anchor}"', 'href="security.html#wrong-section"')))
        mutations.append((center, legacy.replace(f'id="{anchor}"', f'id="retired-{anchor}"')))
    mutations.append((center, legacy.replace('href="https://www.monderman.com/security.html"', 'href="https://www.monderman.com/subprocessors.html"')))
    mutations.append((center, legacy.replace('</head>', '<meta http-equiv="refresh" content="0;url=security.html"></head>')))
    for changed_center, changed_legacy in mutations:
        if (changed_center, changed_legacy) == (center, legacy):
            raise AssertionError("provider negative control must change the reviewed source")
        try:
            assert_provider_inventory(changed_center, changed_legacy)
        except AssertionError:
            continue
        raise AssertionError("provider inventory admitted a missing provider or invalid legacy destination")

def validate():
    assignment = (ROOT / "assignment-mode.js").read_text(errors="ignore")
    require(assignment, [
        "sponsoring_organization_name",
        "show_results_to_assignee !== false",
        "This campaign is configured as anonymous.",
        "This campaign is attributable.",
        "The quantitative score is calculated by versioned application code from structured answers; AI does not calculate or set it.",
        "When AI-assisted reporting is enabled",
        "Anthropic's commercial API for a separate written interpretation",
        "That interpretation can contain errors and must be reviewed before use.",
        "Optional written observations are displayed separately and do not change the score.",
        "They are included in AI interpretation only when that separate feature is enabled",
        "the report states when they were not incorporated",
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
        "const agreedDocuments = { termsVersion: currentDocuments.termsVersion, privacyNoticeVersion: currentDocuments.privacyNoticeVersion };",
        "terms_version: agreedDocuments.termsVersion",
        "privacy_notice_version: agreedDocuments.privacyNoticeVersion",
        'id="legalDecline"',
        'supabase.auth.signOut({ scope: "local" })',
        'window.location.replace("index.html")',
        "No agreement was recorded"
    ], "sign-in acceptance")
    if re.search(r"accepted_at\s*:", signin):
        raise AssertionError("sign-in must not supply an acceptance timestamp")
    if "emailRedirectTo: window.location.origin + \"/\" + nextTarget" in signin:
        raise AssertionError("magic link bypasses acceptance gate")
    decline_handler = signin.split('ui.legalDecline.addEventListener("click", async () => {', 1)[1].split(
        'ui.legalSubmit.addEventListener("click", async () => {', 1
    )[0]
    if "/api/legal/acceptance" in decline_handler or "agreed: true" in decline_handler:
        raise AssertionError("declining Terms records legal acceptance")

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
    require(invite, ["acceptance_source", '"invite"', "invite_token", "Terms of Use", "Privacy Notice"], "invite acceptance")

    trial = (ROOT / "pattern-trial.html").read_text(errors="ignore")
    require(trial, [
        "I agree to the", "and acknowledge the", 'source:\"trial\"',
        "const activationOrganizationId=organizationId;", "organization_id:activationOrganizationId", "/api/legal/acceptance/status", "/api/legal/acceptance"
    ], "trial acceptance")

    privacy = (ROOT / "privacy.html").read_text(errors="ignore")
    require(privacy, [
        "Version 2026-09-19-invitation-access", "Subprocessors and infrastructure page",
        'id="optional-measurement"',
        "Optional website measurement has been retired as described below.",
        "Tracking does not resume for browsers that previously opted in.",
        "Monderman, LLC", "a South Dakota limited liability company", "41 W Highway 14, Unit #1225", "Spearfish, SD 57783", "generally acts as the controller or business",
        "generally acts as the customer's processor or service provider",
        "performance of a contract", "legitimate interests", "does not treat a participant's acknowledgement",
        "In-progress Diagnostic recovery sessions expire after four hours",
        "campaign plus 12 months", "24 months after the last substantive interaction",
        "Billing and tax records are retained for seven years",
        "Legal-acceptance records are retained for seven years after the relationship ends",
        "evaluation anti-abuse record is retained for three years",
        "removed from active systems within 30 days", "provider's controlled deletion schedule",
        "EU Standard Contractual Clauses", "must not submit that information through the self-service product",
        "Anthropic does not calculate or set those scores", "Monderman does not use customer content for model training or fine-tuning",
        "Monderman does not pool this content across customers", "add it to a shared research or benchmark library",
        "De-identifying customer content does not create an exception to this restriction",
        "subject to its stated safety, legal and contractual exceptions", "This is not a zero-retention arrangement",
        "Social Security or other government identification numbers", "lodge a complaint"
    ], "Privacy Notice")
    assert_no_drafting_markers(privacy, "Privacy Notice")
    terms = (ROOT / "terms.html").read_text(errors="ignore")
    require(terms, [
        "Version 2026-09-19-invitation-access", "affirmative agreement", "Terms version",
        "Privacy Notice version", "database-server timestamp", "source/context",
        "normalized account email verified at acceptance", "organization name verified at acceptance",
        "seven-year legal-acceptance retention period",
        "Monderman, LLC", "a South Dakota limited liability company", "41 W Highway 14, Unit #1225", "Spearfish, SD 57783", "requires no payment card, ends automatically",
        "does not convert to a paid subscription", "non-refundable except where applicable law requires",
        "Cancellation stops future renewal, not installments owed for the current annual commitment", "“as is” and “as available”",
        "12 months immediately preceding", "US $100 if the claim relates only to free use",
        "courts serving Madison County, Alabama", "do not require mandatory arbitration",
        "payment-card data into Diagnostic fields", "biometric identifiers", "children's data",
        "self-service product is offered only to U.S.-based organizations and adult Participants located in the United States",
        "must not invite a Participant located outside the United States",
        "knowingly submit personal information subject to a non-U.S. processing or transfer arrangement",
        "Public informational pages may remain accessible globally",
        "not designed, validated or offered as employee-selection procedures",
        "must not attempt to identify an anonymous Participant",
        "Monderman does not use Customer content for model training or fine-tuning",
        "The Customer will defend, indemnify and hold harmless Monderman",
        "must be filed within 12 months after the claim accrued",
        "requires fresh affirmative acceptance"
    ], "Terms")
    assert_no_drafting_markers(terms, "Terms")

    campaign = (ROOT / "workspace-diagnostics.html").read_text(errors="ignore")
    require(campaign, [
        'id="usBetaCampaignRestriction"', "U.S.-only product access",
        "self-service campaigns are for U.S.-based organizations and adult participants located in the United States",
        "confirm that every invited participant is located in the United States",
        "requires a non-U.S. processing or transfer arrangement Monderman has not separately established"
    ], "campaign-admin U.S. access warning")
    if campaign.index('id="usBetaCampaignRestriction"') > campaign.index('id="btnSend"'):
        raise AssertionError("campaign-admin U.S. access warning must appear before the send control")

    subprocessors = (ROOT / "subprocessors.html").read_text(errors="ignore")
    security = (ROOT / "security.html").read_text(errors="ignore")
    assert_provider_inventory(security, subprocessors)
    assert_provider_inventory_negative_controls(security, subprocessors)

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
