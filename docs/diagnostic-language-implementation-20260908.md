# Diagnostic language implementation and release status

8 September 2026. This document supersedes the broader-candidate status in `diagnostic-language-release-holds.md`. The earlier document is retained as the record of the already-deployed intake/mobile correction.

## Outcome

The approved Structural Clarity and Institutional Performance wording corrections are implemented in the candidate, along with broader question/output copy, original-version recovery, report provenance, and targeted report-integrity fixes. The new questionnaire release is **not deployed**. There is no backend-model change.

The live site was checked again by an HTTP GET of its release marker: `d0da6111bed8da710a50d50e129b764dc5cff963`. That is the previously deployed intake/mobile fix. The guided-interview health endpoint returned `enabled:false`, `mode:disabled_for_bounded_pilot`, and `model:null`.

## What changed

- Structural Clarity's change question now asks about changes to the structure over the past year, matching its existing answer scale. The answer tokens, order, signals and scoring are unchanged.
- Institutional Performance's sizing questions distinguish people per complete round, completed rounds per year, and hourly cost per person. Intake remains the sole pricing basis; optional numeric answers do not silently replace it.
- Current questionnaires have new versions: Decision Velocity 1.1.0; the other three diagnostics 1.3.0. Exact earlier banks are archived and resolved by each saved run's version.
- Client-owned optional/confidence questions are pinned too. Unknown, missing or conflicting versions block safely without deleting the draft or creating a replacement run.
- Accepted question history is rebuilt from the server's original bank and accepted answers, not cached wording. Matching unfinished input and validated optional notes remain recoverable.
- Completed anonymous assignments recover their same-run acknowledgment, not a cached or empty report.
- New reports record their questionnaire, scoring and wording versions separately. The current renderer identifies itself separately. Legacy regeneration records an explicit wording migration; completed historical reports are not rewritten.
- Contradictory known report-version pairs and migration metadata are rejected before regeneration.
- IP reports preserve zero and distinguish missing scores; they use the recorded band and do not present the 67/50 quadrant boundaries as extra score bands.
- Tied IP priorities are not described as uniquely weakest. Remedy options and the priority list are explained as separate outputs, not linked by array position.
- DV's derived Coordination density is explained as the higher of coordination and handoff burden. The unresolved elapsed-time start interpretation is disclosed.
- Direct views and exports use diagnostic-specific explanations. IP no longer uses copied Structural Clarity cost explanations.
- Currency display ranges follow one rounding rule and contain the underlying modeled value, including small amounts. This changes presentation ranges, not scoring or the modeled point estimate. These are fixed planning ranges, not confidence intervals.
- The report's Compensatory Effort caption correctly says higher values mean more extra effort, unlike condition dimensions. PDF headings, closing panels and limits have improved pagination.

No formula, scoring threshold, answer value, required flag, bank routing rule, or historical participant statement is intentionally changed. Changing wording still does not prove that people will respond identically.

## Checks actually run

These are local synthetic tests unless explicitly stated otherwise. They do not create customer accounts, send email, consume production admissions, or call a model.

| Area | Evidence |
|---|---|
| Coverage and numeric behavior | 144 generated cases across all 36 diagnostic/perspective/depth combinations; numeric fingerprints unchanged. The bank has 115 items and 292 role-specific stems. |
| Approved meaning alignment | 45 SC answer-mapping cases, 9 IP intake/no-fallback cases, 12 role-specific revised stems, and mixed-case scope preservation. |
| Questionnaire and report versions | 72 old/current cases, 1,070 served questions, 72 restored histories, 8 reused assignment starts, 8 withheld anonymous histories, both DV revision versions, 4 immutable completed reports, and 99 rejected invalid-version/provenance cases. |
| Report wording | 132 score/missingness cases; 24 actual IP threshold cases; 4 missing-evidence and 4 ranking-preservation cases; 12 DV grouping/limitation cases; 73 IP remedy cases. |
| Existing API suite | Full certification passed again on the root host after all API changes: 2,016 scoring cases, 648 prose cases and the existing synthesis, completion, authorization, billing, claims and reliability checks. Finalization and product-runtime suites also passed. The independent agent's listener restriction was not treated as a pass; these were rerun successfully on the root host. |
| Generic answer integrity | Actual OS/SC/IP handlers passed six old/current cases, 96 invalid-write rejections, 52 valid accepted answers, 36 non-mutating exact retries, 30 finalized-state checks and 30 numeric-contract checks. New post-completion, unknown/non-frontier and invalid-value writes are rejected. |
| Direct and saved outputs | 576 checks using the actual direct-screen, summary-HTML, full-HTML and shared saved-report builders. Fixtures now use the exact inputs that generated each score. Score, band, scope, version and modeled economics are checked using explicit display rules. |
| Currency presentation | 88 cases across all four pages, including low values that previously fell below the displayed lower bound. |
| Question layouts | Final integrated build: 1,968 renders in Chromium and WebKit at 390, 768 and 1440px. Checks cover overflow, text bounds, controls and touch-target height. Passed. |
| Report layouts | 432 shared-report renders at 390, 768 and 1440px, with no horizontal document overflow or browser page errors. Chromium only. |
| PDF review | Four representative Managerial/60-minute reports: DV13, SC13, OS14, IP13. All 53 preceding pages were visually inspected; final raster comparison found 45 unchanged and eight changed pages, all eight re-inspected. No blocking visual defect. This is not all PDF combinations or accessible-PDF certification. |
| DV interaction | Both engines passed both bridge and activated builds, including edits, adaptive changes, double taps, transport retries, completed-result recovery and footer containment. Unknown/conflicting versions on restore and after accepted answer/revision responses block without a replacement admission. Each synthetic journey made one start and retained the same run. |
| Generic recovery | 140 cases passed on the applied bridge source and another 140 on the activated published build. Actual assignment/self-draft callbacks cover old/current server histories, forged cache text, optional notes, confidence, missing history, reused starts and finalized anonymous acknowledgment. Exact run/assignment mutation inventories passed. |
| Release switch | Bridge/current build comparison proves only the four new-start constants change. Unknown build channels fail before changing pages. Saved-version selection is not controlled by this switch. |
| Static/security boundaries | Inline parsing, frontend validator, draft recovery, completion protection, report provenance, display currency, participant-evidence quarantine and whitespace checks passed. |

Known limits: not a physical iPhone test, human comprehension study, fresh live email/signup test, paid-provider evaluation, exhaustive adaptive-route enumeration, or live distributed rollback drill. Chart rendering is stubbed in the direct-copy parity harness; shared-report visual checks are separate.

## Safe publication and rollback

The build now separates support for a questionnaire from activation of new starts:

1. Before deployment, read only the distinct saved-session and pending-job version identifiers in production and confirm every version is supported. Deploy the dual-bank API compatibility release first, while the current live site still starts legacy questionnaires. Confirm legacy starts and saved runs.
2. Build and deploy the bridge site with the default `MONDERMAN_QUESTIONNAIRE_RELEASE=legacy`. It supports both versions but starts legacy questions. Retain its exact immutable artifact and the API compatibility revision.
3. Only after release approval and verification, build the same source with `MONDERMAN_QUESTIONNAIRE_RELEASE=current` to activate revised starts.

The build publishes its channel separately at `.well-known/monderman-questionnaire-release.json`. Current-version runs stay on their version during a bridge rollback, including generic replay. The API must not roll back below the dual-bank compatibility release after activation. The old production site/API pair is not a safe rollback target for new-version runs.

Local bridge/current journey tests are not a production deployment or rollback drill. No new production release was made in this pass.

## Remaining decisions and limitations

- DV elapsed time: decide whether the start is entry of the request, including its queue, or when active work begins. The current numeric question is unchanged; the report explicitly notes participant interpretation.
- OS answer scales: exception frequency versus acceptance, and tracking versus visibility, overlap. Making them mutually exclusive is a measurement-design change, not punctuation.
- IP optional observations remain about responsibilities, authority and handoffs. The interface now states this limitation rather than pretending they measure all institutional performance.
- IP remedy selection and the canonical priority list remain different existing rankings. The presentation qualifies them; this pass does not redesign the method.
- Canonical dimension names and some legacy/synthesis terminology remain. This is a substantial language improvement, not a claim that every historical output or technical term has been eliminated.
- Fresh-reader comprehension and actual iPhone checks remain necessary before broad promotion.
- The separately discovered generic-answer integrity gap is fixed and tested. A stale client submitting a non-current question now receives a conflict instead of changing the run; an exact already-accepted retry remains non-mutating. This is a deliberate validation change, not a change to scoring or generic Back/replay behavior.

## Release decision

The implemented candidate is ready for review and staged release preparation, not a claim of complete language or production certification. **Do not activate the broader questionnaire release yet.** The DV/OS question-definition decisions, production version census, staged deployment/compatible rollback checks, and fresh-reader/device checks remain. Existing deployed intake/mobile fixes remain live. No new customer data, emails, admissions or provider charges were created by this pass.

## Backend AI recommendation

Do not switch the production model setting on its own. Current customer reports, optional-note handling and synthesis are deterministic; the only live-provider-capable interview route is disabled. The dormant report client's code default is Sonnet 4.6, not Opus 4.6; an environment override was not inspected.

If model-generated prose is separately reintroduced, compare Sonnet 5 first and Opus 5 as the quality challenger using only synthetic cases. Current interview sampling parameters are incompatible with those models, so a name-only switch would fail. Keep independent settings, explicit token/spend limits, claims validation and deterministic fallback. The proposed comparison has a $20 cap but has not been authorized or run.

Official references: [model overview](https://platform.claude.com/docs/en/models/overview), [Sonnet 5 compatibility](https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5), [pricing](https://platform.claude.com/docs/en/about-claude/pricing). Detailed read-only findings and the bounded evaluation plan are saved in the workspace report `backend-model-upgrade-review.md`.
