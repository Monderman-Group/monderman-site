# Report overview and salary release verification — 2026-09-23

Current status: restored access allowed actual local Chromium/WebKit and PDF verification. The report presentation passed; see [the presentation review](report-overview-visual-review.md) for exact source hashes, screenshots, 141 inspected PDF pages and the new separate approval record. This document remains a release checklist, not a deployment or salary activation receipt.

### Historical blocked attempts (superseded by restored-access evidence)

The root task subsequently reported restored access and a successful local-server bind. On this existing presentation worker, the authorized `report_three_benefit_smoke.mjs --print` retry still failed before rendering: Chromium's `bootstrap_check_in` for `MachPortRendezvousServer` returned `Permission denied (1100)`; cleanup also reported `kill EPERM`. This worker's policy context had not acquired the restored access. The PDF skill was read and its operation marker completed once before that attempt. No new screenshot or PDF was produced, and no alternate browser/transport was attempted. This is a worker-permission failure, not a report-layout result.

## Current evidence and holds

- All six current-candidate reports passed browser/PDF presentation review; the exact renderer and public PDFs have a new separate presentation receipt.
- Actual salary SQL passed **204 assertions in isolated PGlite 0.5.8 / PostgreSQL 18.3 WASM**, including a saved salary-backed Synthesis and transactional rollback. That is not native PostgreSQL 17.6 or independent-session concurrency evidence. Mocked API/DOM tests are a separate layer.
- `EMPLOYER_SALARY_RELEASE_READY` is still `false`. Keep it false until the native database, privacy, participant and authorization checks below pass. There is no live salary-feature sign-off.
- The six legacy locking replacements and role-exit grant revocation are implemented locally. Role restoration/rejoining requires fresh Admin delegation. Remaining native concurrency concerns include completion replay/worker run/job versus job/run locking and membership-update member/organization versus organization/member locking. See the API staging document and native-test handoff for the current native test plan.
- Saved sample data, historical fixtures and earlier review records remain unchanged. The new presentation review records current renderer/template/public asset pins and six reviewed PDF bindings, preserving prior pins and the earlier receipt digest. Exact historical source inversion and publication sensitivity checks pass.

The checked paths below are the current candidate repositories. Results are evidence only where explicitly recorded in the presentation review or the separate API/salary handoff; a command appearing here is not proof that it ran.

## 1. Repeat offline checks after the final source change

```sh
cd /Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/work/monderman-site-report-overview-20260923
node scripts/report_overview_contract.mjs
node scripts/report_unified_sankey_contract.mjs
node scripts/report_burden_flow_smoke.mjs
node scripts/report_three_benefit_smoke.mjs --deterministic-only
node scripts/report_operational_sankey_smoke.mjs --deterministic-only
node scripts/report_presentation_provenance_smoke.mjs --deterministic-only
node scripts/homepage_sample_discovery_contract.mjs
node scripts/campaign_salary_cost_contract.mjs
node scripts/employer_salary_frontend_contract.mjs
node scripts/employer_salary_settings_contract.mjs
git diff --check
```

```sh
cd /Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/work/monderman-api-report-overview-20260923
npm run test:employer-salary
npm run test:employer-salary-sql
```

The last command uses the installed PGlite dependency; it does not start a native database. Preserve its engine version and assertion count in the receipt. Do not install or fetch dependencies implicitly if the existing local dependency is unavailable.

## 2. Browser and print verification (completed for the reviewed presentation)

These scripts use local fixtures and intercepted transport, not production accounts. Actual browsers and PDF exports now passed under restored access. Prerequisites are the installed Playwright browsers, the local Neue Haas Grotesk fonts, Python with `pypdf`, and `pdftoppm`; use the scripts' existing environment overrides if those runtimes are outside the default path.

```sh
cd /Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/work/monderman-site-report-overview-20260923
node scripts/report_three_benefit_smoke.mjs --print
node scripts/report_operational_sankey_smoke.mjs --print
node scripts/report_presentation_provenance_smoke.mjs
FINANCIAL_SCENARIO_MODULE=/Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/work/monderman-api-report-overview-20260923/financial-planning-scenario.js node scripts/campaign_financial_scenario_smoke.mjs
node scripts/export_synthesis_sample_pdfs.mjs /Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/output/report-overview-20260923/pdf-review-restored-access --all
```

The exporter requires a new output directory. If that directory already exists, choose another new directory; do not delete historical evidence. It checks the reviewed sample-data hash and public adapter, writes candidate HTML/PDFs plus `EXPORT-CHECKS.json`, and does not approve or publish them. Historical operational-Sankey fixtures intentionally retain their former three-case chart assertions; current reports must have only the two unit-separated money/time diagrams per selected case.

Inspect the resulting screenshots and every page of all six candidate PDFs, not just extracted text:

- Phone (including 320 and 390 px), tablet (768 or 834 px) and desktop (1440 px): no clipped amounts, label/ribbon collisions, overlapping controls or horizontal page overflow. Confirm the colors, readable translucent flows, equal endpoint extents, full amounts and source details.
- Low, Central and High each show one USD diagram and one hours diagram with the saved values. No subscription-allocation chart node, mixed units, invented values or omitted original source. Test maximum inputs of 24 expenses and 12 activities, long titles, absent values and zero denominators.
- Four overview tiles point to the correct long-report sections; return links restore easy navigation. Inspect keyboard focus, touch targets and the no-script case controls.
- Printing always shows the Central money/time diagrams before the three-case comparison, regardless of the selected screen case. Screen-only overview/navigation must not duplicate the PDF findings. All three cases, detailed values, assumptions and original sample-creation dates remain present. No cut-off diagrams or orphaned headings.
- The protected whole-group cost explanation appears only for its exact saved source marker. It describes capacity value without claiming salary-based cash savings. Render hostile text safely and confirm ordinary reports are unchanged.

Save browser errors, test output, screenshots, PDF hashes and a human visual-review note with the candidate source hash. Automatic PDF extraction alone is not visual approval.

## 3. Site build and publication checks after candidate review

The current Render build command is `bash scripts/render-static-build.sh`, with output `.render-public`. It requires an immutable 40-character `RENDER_GIT_COMMIT` and replaces that generated output directory. Use the actual approved committed candidate revision, never a fabricated revision or the old production SHA attached to an uncommitted tree. Publication checks must retain their reviewed-source and sample-template approval gates.

After an authorized local server is serving that exact reviewed build at `http://127.0.0.1:8080`:

```sh
cd /Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/work/monderman-site-report-overview-20260923
SITE_BASE=http://127.0.0.1:8080 node scripts/homepage_sample_discovery_smoke.mjs
REPORT_BASE=http://127.0.0.1:8080 node scripts/report_presentation_smoke.mjs
SITE_BASE=http://127.0.0.1:8080 node scripts/report_screen_experience_smoke.mjs
```

Homepage coverage uses Chromium and WebKit at 390, 768 and 1440 px with JavaScript both enabled and disabled. Confirm direct sample-report access without completing the journey, a sea-glass primary CTA and `#C9A227` secondary outline.

After the separately reviewed presentation revision records the exact approved renderer change, rerun the preserved inverse guard and its browser/PDF checks:

```sh
node scripts/report_financial_bluf_smoke.mjs --print
```

The preserved inverse guard now passes the exact reviewed renderer and still rejects unreviewed bytes. It restores the preceding renderer byte-for-byte before applying earlier historical inverses. Do not suppress the guard, replace historical fixtures or repin prior receipts. The new local PDF bindings were recorded only after complete layout/source review.

## 4. Separate salary activation checks

Use a disposable native database with the deployed PostgreSQL version and reviewed production-shaped migrations. Do not point destructive fixtures at production. Generate/register the migration using the approved CLI workflow; the checked-in SQL design draft is not an applied migration. Native test commands belong in the API handoff once that harness and target have been validated; do not substitute the PGlite command for them.

Required database evidence:

- Independent-session ordinary/protected completions, imports, cross-scope Synthesis saves, retries, deletion and authority revocation. Resolve the documented lock-order risks and record rollback/idempotency behavior under real waits and contention.
- Actual service/browser grants, RLS, private-schema access, transaction rollback, foreign-key cleanup and applicable advisors. Confirm source/ACL preservation for all six legacy replacements.
- Complete population and role coverage, five-person minimum, one person counted once across lenses, immutable campaign settings, overlapping-population and changed-pay disclosure guards, and retained privacy-protection tombstones after report/scope deletion.

Required controlled browser/API evidence after native checks:

- Admin enters hours and overhead explicitly; zero is deliberate, and no default appears. Test new-campaign and existing-unopened-campaign imports, preview invalidation, all-or-none errors and memory-only retries.
- Delegated Analysts use saved settings only. Revocation, leaving Analyst, role restoration, deletion/rejoining and stale sessions must fail closed until fresh Admin delegation. Anonymous campaigns must reject salary imports.
- Participants never see salary or a replacement rate. The question is omitted correctly through initial entry, back, refresh, required validation, completion and saved-report recovery at phone/tablet/desktop widths. Inspect actual DOM, requests, responses, browser storage, logs, provider packets and exports for individual pay, identities and private fingerprints.
- The Analysis choice appears only for exact authorized readiness, complete matched population and a ready saved Synthesis. The unchecked whole-population/typical-work-mix attestation is required. Selected mode omits all manual activity rates; switching back restores manual values. Cash expense inputs remain separate. Reject previews, unsaved comparisons and malformed/stale options server-side.
- Open and export the resulting real controlled saved report. Confirm only the authorized whole-group average and stable basis explanation are public, with unchanged scores and no invented cash savings.

Retain `EMPLOYER_SALARY_RELEASE_READY = false` unless all required evidence passes and activation is explicitly approved. Report-layout approval alone does not authorize salary activation. After an authorized deployment, match immutable source/release markers and repeat permitted live smoke checks; do not call this complete before that evidence exists.
