# Outside-beta production legal release gate

This checklist is an engineering deployment control, not a substitute for authorized legal and business approval.

Before certifying an outside-beta production release:

1. Confirm that the authorized legal and business owners approved the customer-facing identity, governing law and venue, retention, international-processing limits, jurisdiction-dependent rights, paid-service refund/commercial terms, and warranty/liability terms in the release revision.
2. Confirm that public Privacy and Terms pages contain operative customer-facing text and no bracketed placeholders, unfinished values, confirmation language or other unresolved drafting markers.
3. Record the approver, approved document versions, approval date, and exact Privacy/Terms revisions in the release record.
4. Run `MONDERMAN_RELEASE_CHANNEL=production python scripts/validate_frontend_release.py`.
5. Do not certify or deploy an outside-beta production release unless that command exits successfully. The technical result does not replace the recorded approval in step 1.

Passing this technical check proves only that unresolved drafting markers are absent. It does not prove legal sufficiency, execute a DPA or transfer mechanism, or establish a certification.
