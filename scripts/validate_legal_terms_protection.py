from pathlib import Path
import hashlib
import json
import re


ROOT = Path(__file__).resolve().parents[1]
TERMS_VERSION = "2026-08-26-beta"
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
        "This right continues after the relationship ends.",
        "will not use this right to identify a Customer or person",
        "Monderman does not opt Customer content into general model training",
        "Outputs are licensed for the Customer's internal business use.",
        "No person outside the Customer may rely on an Output",
        "use access to the service or its materials to build, train, evaluate, improve or inform a competing product",
        "The Customer is responsible for activity by its Admins, Analysts, Members",
        "Circumvention is a material breach",
        "The Pattern beta trial does not convert automatically.",
        "Monderman will not impose an undisclosed usage charge.",
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
        f"Version {TERMS_VERSION}",
        "AGGREGATED &amp; DE-IDENTIFIED INFORMATION",
        "cannot reasonably identify a customer or person",
        "Monderman does not opt customer content into general model training",
        "Social Security or other government identification numbers"
    ], "aligned Privacy Notice")

    if manifest["terms_version"] != TERMS_VERSION or manifest["privacy_notice_version"] != TERMS_VERSION:
        raise AssertionError("legal document manifest versions do not match the displayed documents")
    if manifest["acceptance_copy"] != (
        "I agree to the Terms of Service and acknowledge the Privacy Notice. I understand that "
        + ACKNOWLEDGEMENT + "."
    ):
        raise AssertionError("legal document manifest acceptance copy does not match the reviewed clickwrap")
    expected_hashes = {
        "terms_content_sha256": sha256(content_between_markers(terms, "Terms")),
        "privacy_notice_content_sha256": sha256(content_between_markers(privacy, "Privacy Notice")),
        "acceptance_copy_sha256": sha256(manifest["acceptance_copy"])
    }
    for key, expected in expected_hashes.items():
        if manifest.get(key) != expected:
            raise AssertionError(f"legal document manifest {key} does not match reviewed content")

    document_manifest = manifest.get("documents") or {}
    if set(document_manifest) != {"2026-08-20-beta", "2026-08-24-beta", TERMS_VERSION}:
        raise AssertionError("legal document manifest must retain every prior and current beta version")
    for version, files in document_manifest.items():
        for file_key, hash_key in [
            ("terms_file", "terms_file_sha256"),
            ("privacy_notice_file", "privacy_notice_file_sha256")
        ]:
            path = ROOT / files[file_key]
            if not path.is_file() or path.name != files[file_key]:
                raise AssertionError(f"versioned legal document missing for {version}: {files[file_key]}")
            if sha256(path.read_text(errors="strict")) != files[hash_key]:
                raise AssertionError(f"versioned legal document hash mismatch for {version}: {files[file_key]}")
            if f"Version {version}" not in path.read_text(errors="strict"):
                raise AssertionError(f"versioned legal document displays the wrong version: {files[file_key]}")
    if (ROOT / document_manifest[TERMS_VERSION]["terms_file"]).read_text(errors="strict") != terms:
        raise AssertionError("current versioned Terms must exactly match terms.html")
    if (ROOT / document_manifest[TERMS_VERSION]["privacy_notice_file"]).read_text(errors="strict") != privacy:
        raise AssertionError("current versioned Privacy Notice must exactly match privacy.html")

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
