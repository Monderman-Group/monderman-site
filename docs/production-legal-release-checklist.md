# Outside-beta production legal release gate

This checklist is an engineering deployment control, not legal approval. Draft and controlled-beta branches may retain conspicuous placeholders while counsel and the business make the underlying decisions.

Before certifying an outside-beta production release:

1. Counsel and the authorized business owner must approve bounded customer-facing language for the legal entity and address, governing law and venue, retention, international transfers, EU/UK representative status, jurisdiction-specific rights, paid-service refund/commercial terms, and warranty/liability terms.
2. Replace public markers including `[LEGAL ENTITY AND ADDRESS TO BE CONFIRMED]`, `[COUNSEL CONFIRMATION REQUIRED]`, `[BUSINESS AND COUNSEL CONFIRMATION REQUIRED]`, and equivalent bracketed confirmation markers with the approved language.
3. Record the approver, approved document versions, approval date, and exact Privacy/Terms revisions in the release record.
4. Run `MONDERMAN_RELEASE_CHANNEL=production python scripts/validate_frontend_release.py`.
5. Do not certify or deploy an outside-beta production release unless that command exits successfully. The normal beta/PR validator intentionally permits the visible placeholders and does not constitute production legal approval.

Passing this technical check proves only that unresolved drafting markers are absent. It does not prove legal sufficiency, execute a DPA or transfer mechanism, or establish a certification.
