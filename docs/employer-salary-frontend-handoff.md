# Salary frontend local handoff — 2026-09-23

Implemented in this isolated candidate site. The salary feature remains disabled and undeployed. The local checks below made no paid AI calls or production mutations; browser-to-database verification is still outstanding.

## Implemented

- Admin campaign composer: optional CSV salary input, unchecked sensitive-data/company-policy authority attestation, strict all-or-none salary validation, redacted preview, memory-only salary values and retry identity. Salary does not enter campaign drafts or persistent browser storage.
- Settings: server-authorized upload for Admin or expressly delegated Analyst, explicit Admin grant/revoke controls, eligible unstarted campaign selection, preview before applying.
- Backend authority policy now revokes delegation when a user leaves the Analyst role. Restoring that role or deleting/rejoining does not restore salary access without fresh Admin delegation.
- All four diagnostics: server boolean `omit_hourly_cost_question` controls omission from question rendering, reading, required-field checks and paging. Old draft hourly values are cleared. No supplied salary values or salary notice is added to employee pages. Existing diagnostic scoring is untouched.
- CSV: USD only, positive annual base salary up to 10,000,000, maximum two decimal places, no symbols/separators/exponents/duplicate emails/malformed quotes. Client requires explicit uppercase `USD` and reports errors without echoing amounts.
- Approved campaign calculation: Admin supplies annual working hours and benefits/overhead percentage explicitly, with no preset values. Hours must be greater than 0 and at most 8,784; overhead is 0–300%; both allow at most two decimals. These are validation bounds, not recommended assumptions. The UI explains: annual base salary × (1 + percentage ÷ 100) ÷ annual working hours.
- New campaigns include both settings in preview/send and in the memory-only retry identity; changing a setting invalidates the preview. Existing campaigns have an Admin-only, save-once calculation action before any participant starts. Delegated Analysts may use saved settings but cannot edit or override them. Zero overhead is explicitly displayed and transmitted as zero.
- Salary import is unavailable for anonymous campaigns, since matching salary to an individual response would conflict with anonymity. Switching a new campaign to anonymous clears the salary file values and settings. Existing eligible campaigns are filtered server-side.
- Dedicated salary imports clear consent and selected data when the campaign changes, and ignore late file reads for the old campaign. Preview/send failure messages and row messages do not echo arbitrary server strings from salary requests.

## Release state

Frontend stays hidden unless the backend capability explicitly returns `enabled:true`, `can_upload:true` (or `can_delegate` for Settings), USD, and notice version `employer-salary-20260923.1`. New campaign configuration additionally requires `can_configure:true`. Backend release remains gated. The user approved Admin-supplied campaign working hours and benefits/overhead; no salary feature should be enabled before the end-to-end calculation and privacy boundary are verified.

The candidate backend now implements `omit_hourly_cost_question` behind its hard-disabled release gate. Mocked backend handler tests cover protected start, answers, refresh, finalize and recovery. Separately, 204 assertions execute actual candidate SQL in isolated PGlite 0.5.8 (PostgreSQL 18.3/WASM), including salary-backed Synthesis save and deletion; that is not native PostgreSQL 17.6, independent-session concurrency, or a browser-to-database result. Participant omission must remain off until the remaining native storage/concurrency and complete browser/output privacy checks pass. Existing assignment script URLs are unchanged; version their asset URLs together at any future authorized release.

Release-cache update: the static build now versions both assignment modules together as `20260923.salary1`, matching `campaign-analysis.js`, and retains `20260923.1` for the two new salary modules. This supersedes the earlier unchanged-URL note above. The mapping passed a read-only check; the root release task must verify the committed build.

Backend API contract: `GET /api/assignments/salary-capability?organization_id=…`; `POST /api/assignments/salary-delegation`; multipart `POST /api/assignments/import-salaries` with `organization_id`, `batch_id`, CSV file, consent/version and `preview_only`. Capability includes eligible batches and Admin-only delegation IDs. New batch preview/send receive salary CSV columns, consent/version, `salary_annual_working_hours` and `salary_benefits_overhead_percent`. Existing campaign settings use `POST /api/assignments/salary-settings` with JSON `organization_id`, `batch_id`, `annual_working_hours`, `benefits_overhead_percent`. Capability `eligible_batches[].salary_settings` is null or `{annual_working_hours, benefits_overhead_percent, locked:true}`. Existing salary imports never submit calculation settings; they use the campaign's saved values.

## Validation completed

Run from this site directory:

```sh
node scripts/employer_salary_frontend_contract.mjs
node scripts/employer_salary_settings_contract.mjs
node scripts/campaign_salary_cost_contract.mjs
node scripts/campaign_button_state_smoke.mjs
node scripts/campaign_participant_reliability_smoke.mjs
node scripts/diagnostic_workspace_selection_smoke.mjs
python3 scripts/validate_diagnostic_inline_js.py
node --check employer-salary-settings.js
node --check employer-salary-import.js
node --check assignment-mode.js
node --check assignment-draft.js
git diff --check
```

Passed previously: strict parser and 48 tool/role/depth combinations; 8 campaign state cases and 26 snapshot cases; salary consent, redacted preview, memory-only retry identity, cleanup and all-or-none checks; participant reliability (209 and 1010 checks); four diagnostic inline scripts; selected Workspace header contract; standalone syntax and whitespace checks.

Rerun after approved campaign-settings changes: frontend contract; campaign state/snapshot checks; new DOM/API-mocked salary settings interaction test; selected Workspace header contract; four diagnostic inline scripts; standalone syntax; whitespace checks. Added checks cover missing/invalid values, explicit zero, immutable saved values, Admin/Analyst separation, request payloads, conversion changes invalidating preview/retry identity, anonymity exclusion, redacted errors and stale file-read protection. All execution used local mocks or static checks, with zero production requests. Browser tests were not run.

At that earlier checkpoint, browser rendering, keyboard flow, screenshots, responsive layout, native server/database integration, and complete employee network privacy checks remained unexecuted. The then-authorized bounded local-server recheck returned `EPERM`; the permissions request returned no grant. No alternate browser/network workaround was attempted at that checkpoint. The later browser evidence below supersedes the UI portion only. See [the release verification checklist](report-overview-release-verification.md) for remaining release gates.

## Protected whole-group cost option in Analysis

- The operational-planning form remains manual by default. Its uploaded-salary choice is visible only when the saved scope response has exact boolean `readiness.salary_cost_available === true` and that scope's applicable Depth or Cross-Lens Synthesis readiness is satisfied. It cannot be selected for an unsaved response comparison.
- The explanatory text states that the average uses uploaded annual base salaries and saved campaign hours/overhead, requires complete group coverage, and counts each person once across lenses. No salary or calculated individual rate is requested or displayed by the Analysis UI.
- Selecting this cost source reveals an unchecked, required confirmation that measured activities cover the entire named campaign population and its typical work mix, not a subset. `measuredPeople` must equal the declared population. Subsets retain the manual activity-cost path.
- Every activity's `loadedHourlyCost` control is disabled and omitted from submitted scenario data while selected; manually entered values remain only in memory and are restored on opting out. Expense `unitCost` fields are unchanged because cash spending remains separately evidenced, not inferred from employee salary.
- The actual Workspace callback adds a separately validated root `campaign_salary_cost: {use:true, scope_match_confirmed:true}` before preparing the request identity. The financial input contains no salary mode field, individual amount, calculated average, or replacement zero. Backend authorization, matching, coverage and deduplication remain authoritative.
- `scripts/campaign_salary_cost_contract.mjs` now passes 124 offline checks (the earlier UI-only checkpoint had 75). It executes the actual scenario reader, cost-source controls, Workspace callback and shared report renderer. Coverage includes strict exact-true gating, partial groups, consent, malformed request fields, all 12 activity rates, manual restoration, Depth/Cross-Lens readiness and omission from manual/cash-only requests. No network or browser was used.
- The shared HTML/print renderer shows a stable, renderer-owned cost-basis explanation only for `method.capacityCostSource === 'matched_campaign_population'`: the whole group's annual base pay is converted using saved campaign hours/overhead, each person is counted once, and the average assumes the activities represent the group's typical work mix. It values capacity, not cash savings. Tests cover ordinary reports remaining unchanged and hostile metadata not becoming report HTML; PDF layout itself remains untested.
- Updated only the callback adapter in the existing browser scenario regression to accept the third argument and use the real exported request validator. Its pre-existing assertions remain intact; the browser regression was syntax-checked, not executed.

## Implementation files

`employer-salary-import.js`, `employer-salary-settings.js`, `workspace-diagnostics.html`, `workspace-settings.html`, `assignment-mode.js`, `assignment-draft.js`, `decision-velocity.html`, `structural-clarity.html`, `operational-systems.html`, `institutional-performance.html`, `scripts/employer_salary_frontend_contract.mjs`, `scripts/employer_salary_settings_contract.mjs`, and the fixture additions in `scripts/campaign_button_state_smoke.mjs`.

Whole-group Analysis additions: `campaign-analysis.js`, `workspace-analysis.html`, the conditional explanation in `monderman-report.js`, `scripts/campaign_salary_cost_contract.mjs`, and the callback adapter in `scripts/campaign_financial_scenario_smoke.mjs`.

## Actual browser verification — 2026-09-23

`scripts/employer_salary_browser_smoke.mjs` now exercises the actual candidate pages in Chromium and WebKit with synthetic local auth/API fixtures. Every browser request is intercepted; no accounts, invitations, email deliveries, provider calls, remote database writes, commits, or deployments occur. The backend release gate is unchanged. This is browser-to-mocked-API evidence, not a continuous browser-to-native-database test.

The final run passed 46 cases / 1,742 assertions at `output/employer-salary-browser-final-20260923/RECEIPT.json`. Its receipt records source hashes and the intercepted request-path inventory. Screenshots in the same directory show real viewports; Settings navigation is keyboard reachable at every tested width. The earlier expanded run also passed 46 cases / 1,694 assertions at `output/employer-salary-browser-20260923/RECEIPT.json`.

- Settings: Admin, delegated Analyst, member, and disabled capability states at 390, 834, and 1440 px in both engines. Blank calculation settings produce no request; explicit zero survives save/display; saved settings have no editor; Analyst cannot configure or delegate; authority must be checked after every file selection; preview precedes apply; apply clears file/consent; changing the campaign clears the selection; server-provided salary text in an error remains redacted. Admin grant and revoke use the intended user and organization.
- Composer: actual new-campaign salary CSV flow at all three widths in both engines. Consent and explicit hours/overhead are required. Changing overhead invalidates preview. The intercepted preview/send contain the selected values and notice version. The preview, browser storage, and captured `campaign_drafts` writes contain no salary amounts. Switching to anonymous clears the selected salaries and hides the controls.
- Participants: all four actual diagnostic pages with omission enabled and disabled in both engines. Every remaining intake field is traversed in the original order with real controls; only the hourly-cost intake field is removed. Start and ordinary-answer requests carry no supplied pay/calculation fields. Participant visible text and storage contain no supplied salary or upload notice. Ordinary campaigns retain the manually entered hourly cost. Each path also checks phone/tablet/desktop intake layout.
- Browser inspection exposed a 21 px Settings file-picker target. The candidate now applies salary-scoped 44 px styling to that control. No scoring, report/chart, release-gate, or publication logic changed.
- The four salary/composer contract scripts, syntax checks, and whitespace checks pass. `.github/workflows/employer-salary-ui.yml` adds focused path-triggered Chromium/WebKit coverage and uploads the receipt/screenshots.

Remaining scope for release: this browser harness does not exercise a continuous real API/database campaign lifecycle, protected IP server questionnaire routing, actual native-session concurrency, or completed report/AI/PDF output privacy. Those require the corresponding backend and report evidence; passing these browser fixtures alone must not enable the feature. The fixture intercepts native `fetch` FormData entries because WebKit's request inspector omits uploaded file bytes. It never substitutes a salary value into participant fixtures or infers a passed transport/database test from that browser capture.
