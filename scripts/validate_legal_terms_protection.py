from pathlib import Path
import hashlib
import json
import re


ROOT = Path(__file__).resolve().parents[1]
TERMS_VERSION = "2026-09-19-invitation-access"
PRIVACY_VERSION = "2026-09-19-invitation-access"
PUBLISHED_PRIVACY_VERSION = "2026-09-19-invitation-access"
PUBLISHED_PRIVACY_SHA256 = "c71c0cf3fb3d66b58f4aecd1f52c33dabe6a52e24332548bd7763af294fe149d"
# Accepted historical editions are immutable, even if someone edits the manifest.
HISTORICAL_DOCUMENTS = {
    "2026-09-19-invited-evaluation": {
        "terms_file": "terms-2026-09-19-invited-evaluation.html",
        "terms_file_sha256": "116aecc53dba343d9f03dc0962c5d7f06cd9398220ed5e12cc238c7c12059ab9",
        "privacy_notice_file": "privacy-2026-09-19-invited-evaluation.html",
        "privacy_notice_file_sha256": "88a0ad179c9f8d24c478789946d7d5895a7721800022aff238f1a7fc81f26bce"
    },
    "2026-09-12-ai-source-evidence-v2": {
        "privacy_notice_file": "privacy-2026-09-12-ai-source-evidence-v2.html",
        "privacy_notice_file_sha256": "41e4ef0367e55a4bff255934c42ea14b4b4e49a69dca78e4f14357f08bc2e3cc"
    },
    "2026-09-15-annual-plans": {
        "terms_file": "terms-2026-09-15-annual-plans.html",
        "terms_file_sha256": "ec9820dda61b53bfc90a145ad9c0a2e1887cde1d7f46fac4943d1c1587de90bf"
    },
    "2026-09-11-ai-evidence-v1": {
        "privacy_notice_file": "privacy-2026-09-11-ai-evidence-v1.html",
        "privacy_notice_file_sha256": "9286991d6f104c50a401fb4f987bdd751523e74d3fda713ceab17b5fdf49f460"
    },
    "2026-08-20-beta": {
        "terms_file": "terms-2026-08-20-beta.html",
        "terms_file_sha256": "7d7ed07a7904e897f624a3edb73ec5eb322ac5c49523655fa4e11840a2bfae68",
        "privacy_notice_file": "privacy-2026-08-20-beta.html",
        "privacy_notice_file_sha256": "80f313b0e486ec855993ed10a4a57a15c452e9c65ce7e308eddce65754004066"
    },
    "2026-08-24-beta": {
        "terms_file": "terms-2026-08-24-beta.html",
        "terms_file_sha256": "756e909580be2d10477f2318689f5d99c39f19a53e5231b4d865a676d0750135",
        "privacy_notice_file": "privacy-2026-08-24-beta.html",
        "privacy_notice_file_sha256": "fe905ab7fa7aa214d71a5c266ba4e2a09eada459ee9a93c75de8d8f5a9d355f9"
    },
    "2026-08-26-beta": {
        "terms_file": "terms-2026-08-26-beta.html",
        "terms_file_sha256": "e3919457bca412da2b97c21fc5e6d5176b5db9a57523155e3b6cbe90bb8c9512",
        "privacy_notice_file": "privacy-2026-08-26-beta.html",
        "privacy_notice_file_sha256": "1b6f44df91d4b9e74ca964a624291790c3ed649fd24e746021661cd48b493d38"
    },
    "2026-09-08-beta": {
        "terms_file": "terms-2026-09-08-beta.html",
        "terms_file_sha256": "cfc6a93958590cbe20cf1c8cf4c241027ad6e9f0d9ab4d2de9ebecd01b7f3662",
        "privacy_notice_file": "privacy-2026-09-08-beta.html",
        "privacy_notice_file_sha256": "65e8da04c5dabee9800afec4732bba0ed278182639ed995c95fa748d69d19b42"
    },
    "2026-09-09-beta": {
        "terms_file": "terms-2026-09-09-beta.html",
        "terms_file_sha256": "8653646c8e9b3a27a457be8b1026d3859814b48bf784b209fb51811e5b5494a6",
        "privacy_notice_file": "privacy-2026-09-09-beta.html",
        "privacy_notice_file_sha256": "3eff91338e588a4cc74d5ec801d50c810fb06b9f272becee40f6731d20dca639"
    },
    "2026-09-10-optional-measurement-v1": { "privacy_notice_file": "privacy-2026-09-10-optional-measurement-v1.html", "privacy_notice_file_sha256": "3f080b978419e5ed4d6e20776322db7962b512254febcfcc6db34d97933b45d0" },
    "2026-09-10-beta": {
        "privacy_notice_file": "privacy-2026-09-10-beta.html",
        "privacy_notice_file_sha256": "b8d0279861a5ab30f9e1c2875d8237c9fb6df92abf02982e309092c3fc138185"
    }
}
ACKNOWLEDGEMENT = (
    "financial, time, capacity, productivity and recovery figures are directional estimates, "
    "not guaranteed outcomes, and that my organization is responsible for its data, decisions, "
    "implementation and results"
)


def require(text, tokens, label):
    missing = [token for token in tokens if token not in text]
    if missing:
        raise AssertionError(f"{label} missing: {', '.join(missing)}")


def content_between_markers(text, label):
    start_marker = "<!-- CONTENT_START -->"
    end_marker = "<!-- CONTENT_END -->"
    if text.count(start_marker) != 1 or text.count(end_marker) != 1:
        raise AssertionError(f"{label} must contain exactly one canonical content marker pair")
    return text.split(start_marker, 1)[1].split(end_marker, 1)[0].strip("\n") + "\n"


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def validate():
    terms = (ROOT / "terms.html").read_text(errors="strict")
    signin = (ROOT / "signin.html").read_text(errors="strict")
    trial = (ROOT / "pattern-trial.html").read_text(errors="strict")
    privacy = (ROOT / "privacy.html").read_text(errors="strict")
    acknowledged_privacy = (ROOT / f"privacy-{PRIVACY_VERSION}.html").read_text(errors="strict")
    manifest = json.loads((ROOT / "legal-document-manifest.json").read_text(errors="strict"))
    checkout = (ROOT / "checkout.html").read_text(errors="strict")
    workspace_gate = (ROOT / "workspace-access-gate.js").read_text(errors="strict")

    require(terms, [
        f"Version {TERMS_VERSION}",
        "Outputs are decision-support tools, not promised results.",
        "An identified opportunity is not the same as an achieved result.",
        "even when a Customer believes it followed a suggested Action Plan",
        "not designed, validated or offered as employee-selection procedures",
        "Participants are not customers and are not third-party beneficiaries",
        "must not attempt to identify an anonymous Participant",
        "These restrictions apply even if the content could be aggregated or de-identified.",
        "Customer content is for that Customer, not a shared training or benchmark resource.",
        "Monderman does not use Customer content for model training or fine-tuning",
        "Outputs are licensed for the Customer's internal business use.",
        "No person outside the Customer may rely on an Output",
        "use access to the service or its materials to build, train, evaluate, improve or inform a competing product",
        "The Customer is responsible for activity by its Admins, Analysts, Members",
        "Circumvention is a material breach",
        "The free evaluation does not convert automatically.",
        "These safeguards do not create an undisclosed usage charge.",
        "For 30 days after termination of a paid subscription",
        "The Customer will defend, indemnify and hold harmless Monderman",
        "This obligation does not apply to the extent a claim is caused by Monderman's breach",
        "any difference between an estimated and actual result",
        "must be filed within 12 months after the claim accrued",
        "courts serving Madison County, Alabama",
        "These Terms do not require mandatory arbitration.",
        "including a statement in marketing material, sample Output, published research, presentation or sales conversation",
        "These Terms create no partnership, agency, fiduciary relationship or third-party beneficiary.",
        "requires fresh affirmative acceptance"
    ], "protective Terms")
    require(terms, [
        "Your invitation includes 60 days to evaluate Monderman.",
        "An invitation does not start the clock.",
        "requires no payment card, ends automatically and does not auto-renew",
        "two Admins and five Analysts",
        "Ordinary use is not capped by a campaign-response or Synthesis allowance",
        "Existing evaluations retain their recorded end dates",
        "new Diagnostic runs, campaign activity and Syntheses stop",
        "continue to read and export saved reports",
        "Expiry does not itself delete saved work"
    ], "invited evaluation access and expiry")
    old_paid = re.search(r'<section[^>]*><p class="kicker">Paid subscriptions</p>[\s\S]*?</section>', (ROOT / "terms-2026-09-15-annual-plans.html").read_text()).group()
    new_paid = re.search(r'<section[^>]*><p class="kicker">Paid subscriptions</p>[\s\S]*?</section>', terms).group()
    if new_paid != old_paid.replace("The Pattern beta trial does not convert automatically.", "The free evaluation does not convert automatically."):
        raise AssertionError("evaluation update must not change paid prices, allowances or contract terms")

    require(terms, [
        "a South Dakota limited liability company",
        "41 W Highway 14, Unit #1225",
        "Spearfish, SD 57783",
        "laws of the State of Alabama",
        "courts serving Madison County, Alabama"
    ], "entity identity and unchanged governing-law choice")
    if re.search(r"<input[^>]+(?:checked|value=[\"']?true)", signin, re.I):
        raise AssertionError("sign-in legal acceptance must not be preselected")
    require(signin, [
        '<input id="legalAgree" type="checkbox" />',
        '<button class="legal-decline" id="legalDecline" type="button">Decline and exit</button>',
        "If you decline, you will be signed out and cannot enter Workspace.",
        ".signin-card [hidden]{display:none!important}",
        'href="terms.html"',
        'href="privacy.html"',
        ACKNOWLEDGEMENT,
        'ui.legalDecline.addEventListener("click", async () => {',
        'supabase.auth.signOut({ scope: "local" })',
        "sessionStorage.removeItem(INVITE_STORAGE_KEY)",
        "sessionStorage.removeItem(AUTH_CONTEXT_STORAGE_KEY)",
        'window.location.replace("index.html")',
        "No agreement was recorded; please try again."
    ], "sign-in clickwrap")
    require(signin, [
        'id="legalTermsLink"',
        'id="legalPrivacyLink"',
        "setExactLegalDocumentLinks(result)",
        'legalDocumentPath("terms", documents?.termsVersion)',
        'legalDocumentPath("privacy", documents?.privacyNoticeVersion)'
    ], "version-bound sign-in legal documents")
    decline_handler = signin.split('ui.legalDecline.addEventListener("click", async () => {', 1)[1].split(
        'ui.legalSubmit.addEventListener("click", async () => {', 1
    )[0]
    if "/api/legal/acceptance" in decline_handler or "agreed: true" in decline_handler:
        raise AssertionError("decline path must not record legal acceptance")
    if re.search(r"(?:deleteUser|admin\.delete|/api/.+delete)", decline_handler, re.I):
        raise AssertionError("decline path must not delete an account")
    require(trial, [
        'input type="checkbox" id="ackStart" disabled',
        'id="trialTermsLink"',
        'id="trialPrivacyLink"',
        ACKNOWLEDGEMENT,
        'setExactLegalDocumentLinks(legalStatus)',
        'status.termsVersion!==currentDocuments?.termsVersion',
        'status.privacyNoticeVersion!==currentDocuments?.privacyNoticeVersion',
        'legal_documents_changed'
    ], "trial clickwrap")
    require(privacy, [
        f"Version {PUBLISHED_PRIVACY_VERSION}",
        "ORGANIZATION DATA &amp; RESEARCH",
        "De-identifying customer content does not create an exception",
        "Monderman does not use customer content for model training or fine-tuning",
        "Social Security or other government identification numbers"
    ], "aligned Privacy Notice")
    for label, notice in [("current Privacy Notice", privacy), ("new Privacy edition", acknowledged_privacy)]:
        require(notice, [
            "Publishing this notice does not change an earlier acknowledgement",
            "Where a new acknowledgement is required, Monderman asks for it",
            "Permission to use optional written observations is a separate choice",
            "publication of this notice does not activate a feature or regenerate an earlier report",
            "Reports using this research process identify its date and limitations"
        ], label + " activation boundary")
        if "does not change the Terms or require a new account acknowledgement" in notice:
            raise AssertionError(label + " retains the superseded optional-measurement transition")
        if "The account acknowledgement currently refers to" in notice:
            raise AssertionError(label + " hard-codes an obsolete active acknowledgement")

    if manifest["terms_version"] != TERMS_VERSION or manifest["privacy_notice_version"] != PRIVACY_VERSION:
        raise AssertionError("required legal versions must match the invitation-only evaluation edition")
    if manifest.get("required_acknowledgement") != {
        "terms_version": TERMS_VERSION, "privacy_notice_version": PRIVACY_VERSION
    }:
        raise AssertionError("manifest must explicitly record the required account acknowledgement versions")
    if manifest.get("published_privacy_notice_version") != PUBLISHED_PRIVACY_VERSION or manifest.get("published_privacy_notice_file") != f"privacy-{PUBLISHED_PRIVACY_VERSION}.html":
        raise AssertionError("published Privacy Notice must have its own explicit edition and archive")
    if manifest["acceptance_copy"] != (
        "I agree to the Terms of Service and acknowledge the Privacy Notice. I understand that "
        + ACKNOWLEDGEMENT + "."
    ):
        raise AssertionError("legal document manifest acceptance copy does not match the reviewed clickwrap")
    expected_hashes = {
        "terms_content_sha256": sha256(content_between_markers(terms, "Terms")),
        "privacy_notice_content_sha256": sha256(content_between_markers(acknowledged_privacy, "Acknowledged Privacy Notice")),
        "published_privacy_notice_content_sha256": sha256(content_between_markers(privacy, "Published Privacy Notice")),
        "acceptance_copy_sha256": sha256(manifest["acceptance_copy"])
    }
    for key, expected in expected_hashes.items():
        if manifest.get(key) != expected:
            raise AssertionError(f"legal document manifest {key} does not match reviewed content")

    document_manifest = manifest.get("documents") or {}
    if set(document_manifest) != set(HISTORICAL_DOCUMENTS) | {TERMS_VERSION, PRIVACY_VERSION, PUBLISHED_PRIVACY_VERSION}:
        raise AssertionError("legal document manifest must retain every acknowledged and published version")
    for version, files in HISTORICAL_DOCUMENTS.items():
        if document_manifest.get(version) != files:
            raise AssertionError(f"historical legal manifest changed for {version}")
    for version, files in document_manifest.items():
        for file_key, hash_key in [
            ("terms_file", "terms_file_sha256"),
            ("privacy_notice_file", "privacy_notice_file_sha256")
        ]:
            if version in HISTORICAL_DOCUMENTS and file_key not in HISTORICAL_DOCUMENTS[version]:
                continue
            path = ROOT / files[file_key]
            if not path.is_file() or path.name != files[file_key]:
                raise AssertionError(f"versioned legal document missing for {version}: {files[file_key]}")
            if sha256(path.read_text(errors="strict")) != files[hash_key]:
                raise AssertionError(f"versioned legal document hash mismatch for {version}: {files[file_key]}")
            if f"Version {version}" not in path.read_text(errors="strict"):
                raise AssertionError(f"versioned legal document displays the wrong version: {files[file_key]}")
    if (ROOT / document_manifest[TERMS_VERSION]["terms_file"]).read_text(errors="strict") != terms:
        raise AssertionError("current versioned Terms must exactly match terms.html")
    if (ROOT / document_manifest[PUBLISHED_PRIVACY_VERSION]["privacy_notice_file"]).read_text(errors="strict") != privacy:
        raise AssertionError("published versioned Privacy Notice must exactly match privacy.html")
    if sha256(privacy) != PUBLISHED_PRIVACY_SHA256:
        raise AssertionError("published Privacy Notice must match its separately reviewed fingerprint")
    require(privacy, [
        'id="optional-measurement"',
        "Optional visitor tracking has been retired",
        "Tracking does not resume for browsers that previously opted in.",
        "the retired server endpoint no longer accepts new measurement events",
        "Scheduled service maintenance performs this cleanup without relying on new visitor events",
        "a failed maintenance run can delay removal",
        "Historical outreach labels already stored with an application remain under that application's existing retention and verified-deletion policy",
        "They are not subject to the event table's 90-day cleanup and are not used to restart visitor tracking.",
        "records of requested service activity, not anonymous visitor tracking or a complete browsing history",
        "Normal hosting and security systems can still receive request and network metadata",
        "Retiring measurement does not remove account Terms acceptance, Privacy Notice acknowledgement or the separate permission",
        "No advertising pixels, session replay or device fingerprinting have been added.",
        "without clearing your sign-in or saved work"
    ], "retired measurement disclosure and unchanged evidence permissions")
    if "does not currently display a nonessential-cookie opt-in banner" in privacy:
        raise AssertionError("published Privacy Notice must not describe optional measurement as essential storage")

    require(privacy, [
        "AI-assisted reports use Anthropic's commercial API when enabled",
        "a bounded selection of participant observations",
        "Earlier observations are not automatically made eligible for this new processing.",
        "For Synthesis of your own saved runs",
        "selected original structured answers and their questions",
        "descriptive distributions of recorded answers to the same question",
        "not named participants' individual answer records",
        "Small or insufficiently supported groups are withheld.",
        "Permission recorded before the September 12 source-evidence edition does not authorize that expanded use.",
        "Leaving the optional choice unchecked does not change the structured score",
        "check request size before drafting or review",
        "This check can occur even when no interpretation is generated.",
        "The Monderman diagnostic engine determines scores, classifications, evidence limits and available action options.",
        "Customer answers, observations, organization names and Workspace history are not sent to that search",
        "The public assistant and Hans, the Workspace assistant, use Anthropic's commercial API",
        "do not automatically retrieve Diagnostic answers, saved reports, participant records",
        "does not store chat transcripts in its database",
        "New chat clears that local conversation; it does not recall requests already processed by Anthropic.",
        "without a model-provider call",
        "Interview mode is not currently available.",
        "This is not a zero-retention arrangement.",
        "Standard API content can remain with Anthropic for up to 30 days",
        "subject to its stated safety, legal and contractual exceptions",
        "No-training and no-retention are different commitments."
    ], "current AI processing and retention boundaries")
    require(privacy, [
        "selected original structured answers and their questions",
        "each selected run's Diagnostic, chosen perspective, run length and questionnaire version",
        "not evidence from independent participants",
        "descriptive distributions of recorded answers to the same question",
        "units, answer conditions and response counts",
        "Small or insufficiently supported groups are withheld",
        "does not establish anonymity, representativeness or a peer benchmark",
        "recorded permission under the September 12, 2026 source-evidence permission for those saved observations",
        "This September 19 notice does not expand the permitted report evidence or replace the separate per-run permission.",
        "Leaving the optional choice unchecked does not change the structured score",
        "The same permitted report evidence and proposed report text",
        "This check can occur even when no interpretation is generated"
    ], "v2 source evidence, separate permission and request-size disclosure")
    require(terms, [
        "AI-assisted Diagnostic and Synthesis interpretation uses Anthropic as a third-party model provider when enabled.",
        "Automated validation is not expert review.",
        "The Customer must review it before relying on or sharing it",
        "no-training does not mean zero retention."
    ], "AI review responsibility")
    if "including intellectual property, aggregated and de-identified information" in terms:
        raise AssertionError("removed aggregated-content permission must not survive termination")
    security = (ROOT / "security.html").read_text(errors="strict")
    # Full-feature release: these disclosures ship with API activation.
    # The separate Privacy publication did not activate authored reporting.
    require(security, [
        "When AI-assisted reporting is enabled",
        "The interpretation does not change the saved score.",
        "Monderman's diagnostic engine produces the scores, classifications, evidence limits and available action options.",
        "Anthropic’s AI supports research and writes the explanation from authorized evidence within those rules.",
        "they do not establish scientific validity or guarantee an outcome.",
        "A bounded selection of permitted participant observations",
        "Synthesis of your own saved runs can include selected original structured answers",
        "Campaign Synthesis can include descriptive answer distributions for each exact question and context",
        "new per-run permission under the September 12 notice",
        "request-size checks before drafting or review",
        "Reports show the research date or disclose that no newly checked research is included.",
        "This is not a zero-retention arrangement.",
        "row-level security and server-side authorization"
    ], "conditional AI and layered access controls")
    if "All public Postgres tables currently have row-level security enabled" in security:
        raise AssertionError("unverified universal live RLS claim must not return")
    subprocessors = (ROOT / "subprocessors.html").read_text(errors="strict")
    require(subprocessors, [
        "Research support, authored explanations and review within Monderman's engine-defined evidence and action limits.",
        "Anthropic does not calculate scores.",
        "for Synthesis of your own saved runs, selected original structured answers and exact questions",
        "for campaign Synthesis, descriptive answer distributions grouped by exact question and context",
        "written observations only with the participant's recorded permission under the September 12 notice for those saved observations",
        "Earlier permission does not authorize this expanded use.",
        "request-size checks before drafting or review",
        "Earlier observations are not automatically made eligible.",
        "Public research uses predefined sector and Diagnostic categories without customer content.",
        "Standard API retention is not zero"
    ], "Anthropic purpose and retention disclosure")
    require(subprocessors, [
        "Conversational product guidance through the public assistant and Hans is a separate use.",
        "For chat: submitted messages and limited recent replies",
        "server-checked plan and role"
    ], "assistant processing disclosure")
    if "assistants currently use rule-based replies" in privacy:
        raise AssertionError("current Privacy Notice must disclose restored AI chat processing")
    capability_pages = [
        "index.html", "deterministic-ai-infrastructure.html", "platform-services.html",
        "roi.html", "plan-signal.html", "why-monderman.html", "Monderman_Platform_Brief.html"
    ]
    for name in capability_pages:
        text = (ROOT / name).read_text(errors="strict")
        require(text, ["When enabled", "interpretation", "review"], f"conditional AI on {name}")
        if not re.search(r"[Ii]nterview mode is not (?:currently )?available", text):
            raise AssertionError(f"{name} must state the current interview boundary")
    if "precise narrative inside locked computed facts" in (ROOT / "roi.html").read_text(errors="strict"):
        raise AssertionError("selected evidence must not be described as a guarantee of precise AI prose")

    require(checkout, [
        '<script src="workspace-access-gate.js"></script>',
        '/api/billing/create-checkout-session',
        'id="payBtn" disabled'
    ], "checkout legal-gate dependency")
    require(workspace_gate, [
        "/api/legal/acceptance/status?source=signup",
        "legal_acceptance_required",
        "redirectToSignIn"
    ], "checkout pre-access legal gate")


if __name__ == "__main__":
    validate()
    print("Legal Terms protection checks passed.")
