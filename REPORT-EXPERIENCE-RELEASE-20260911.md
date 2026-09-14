# Evidence and report experience release

Status: implementation and offline verification in progress. **Not deployed; not a production GO.**

This release implements the approved campaign-evidence and report-experience work. It preserves the diagnostic scoring formulas and original saved results. It does not claim independent scientific validation, intervention effectiveness or realized financial returns.

## Implemented boundaries

- Campaign definitions fix the work, population, role groups, measurement period and compatible diagnostic versions. New definitions create versions rather than rewriting prior reports.
- Readiness uses distinct recorded participant identities and bounds on missing scores, not an arbitrary response percentage or a probability of correctness. The method is explicitly provisional and independently unreviewed.
- Small-cohort comparisons retain useful observations and next steps. Full campaign Synthesis and the three action alternatives require the separate evidence checks. A preferred option additionally requires a recorded operating-evidence and safeguards review.
- The existing Trial can still combine the account owner's own saved runs. This is labeled Self-run Synthesis, not evidence from multiple people. A same-lens personal median requires compatible measurements; no Cross-Lens Composite or organizational preferred action is offered.
- Quality checks flag unusual responses without changing their answers or score. Inclusion changes require an explicit reason, a current preview and a server-recorded decision. Dissent is not treated as corrupt data.
- New individual reports retain ordinary next steps but withhold the legacy three remedy tiers. Historical issued reports are not rewritten with the new policy.
- New optional written-note processing requires the participant's specific permission under the new Privacy edition. A sponsor cannot authorize historical notes. The server rechecks ownership, exact saved content and permission before AI processing.
- Attribution describes the Monderman engine's scores, classifications, evidence limits and permitted actions first. Claude writes the interpretation and can use dated, reviewed public research within those rules.
- On-screen evidence remains expandable beside each finding. Printed reports consolidate repeated supporting facts into a numbered evidence register. Long text remains present; the goal is usable depth, not merely shorter reports.
- Reopening a saved report no longer invents a new generation date. Personal comparisons do not display organizational condition labels. Staff controls match server permissions.

## Evidence obtained locally

These are separate tests, not one end-to-end production certification.

| Area | What was actually executed |
| --- | --- |
| Report rendering | Six products from the current deterministic synthetic-input generator, with explicitly mocked authored prose; Chromium and WebKit at 320, 390, 834 and 1440 pixels: 48 passing render/navigation/overflow cases and six mock PDFs. |
| Participant permission interface | Actual four instrument question renderers in both engines at four widths: 32 passing opt-in, keyboard, saved-state and new-run reset cases. External requests intercepted. |
| Campaign analysis | Actual readiness/quality functions with mocked HTTP and the real browser module at four widths. Readiness cards, definition form, preview invalidation, explicit apply and duplicate-tap checks pass. |
| Inclusion review | Actual dialog: 16 browser cases. Actual inline handler: six mocked session/API scenarios covering confirm, cancel, changed organization, stale review, failed preview and expired session. |
| Individual/self-run presentation | 86 actual renderer/native helper assertions, including legacy/new output policy separation, original timestamps, missing dates, incompatible medians, Admin/Analyst/Member controls and actual in-script result-container hiding. Source checks additionally reject executable text after the HTML document. |
| Existing report compatibility | Five structured legacy reports rendered and exported as PDFs; 42 deterministic Synthesis cases and 48 existing browser states passed. |
| Other regressions | Participant-evidence boundary, 52 missing-estimate cases, 73 recorded-context cases, 46 Synthesis retry-state cases, 18 eligibility cases, 10 deferred-poll lifecycle cases, legal-document protection and all instrument inline-script parsing pass. |
| Independent database transactions | [Evidence concurrency CI](https://github.com/Monderman-Group/monderman-api/actions/runs/34652172846) passed 58 checks on PostgreSQL 17.11, with distinct control/worker processes and observed lock waits before release. Checked stale-source rejection, permission grants, duplicate saves/reviews and research reservation/dispatch/settlement races. This is a disposable database test, not a production migration or live customer test. |

Mock prose is **not** proof of Claude's live output quality. Screenshot capture and geometry checks are **not** the same as personally inspecting every page at full resolution. Contact-sheet inspection and targeted full-page inspection found and drove the evidence-register, action-card, number-alignment and date fixes. Final real-output visual approval remains required.

## Release gates still required

1. Complete the broader customer-release CI gate on the final candidate. Both isolated PostgreSQL concurrency lanes have passed. Local current-authored receipt tests now cover all 171 fixtures, 103 tampered receipts and eight malformed budgets. Those tests use clearly marked synthetic receipts, not live provider results. The unchanged $100 default still correctly refuses the full matrix's $131.218890 conservative reservation; an explicit synthetic planning ceiling in the test grants no spending authority.
2. Confirm the Render workspace before deployment. Target services are the existing Monderman API and website, not new infrastructure.
3. Approve the fresh paid-output test budget and verify the separate public-research provider workspace's spend limit. Native search intermediate input is not capped by the output-token limit. An internal reservation is not a vendor-enforced spending ceiling.
4. Publish and read back the immutable Privacy edition before activating it in the database. Do not create acknowledgements on behalf of participants.
5. Apply the reviewed additive migrations and deploy the API candidate. Verify actual release/model configuration, saved-run processing, consent exclusion, quota preservation and retry/recovery behavior with controlled test data. Fresh model checks must also cover personal same-lens and Cross-Lens reports and the source-paraphrase attack recorded in the API red-team audit; the existing 171-case matrix alone does not cover those new paths.
6. Generate and review the six real Claude-authored promotional reports from the approved fictional inputs, including current public-research evidence. Replace the public JSON, PDFs, previews and approval manifest together.
7. Deploy the final site and run live smoke, including authenticated saved-report recovery, campaign readiness, explicit quality review and all report exports.

The site branch's new sample adapter deliberately requires the new v3 artifact. The old public sample artifact has **not** been relabeled or falsely approved. Do not deploy this entire site branch while the public sample artifact is still v2; use a legal-only publication step first.

## Rollback

The prior production API commit is `91f049156aab136f6f0e17c81cafe3908e938e6b`; prior website commit is `b038a7413251e2be03c7811422eb5d31dc7c4935`. Keep these deployment targets available. Do not roll back by deleting participant permission, review or audit records. An older API must not process newly authorized written notes under incompatible assumptions; disable affected AI jobs before a rollback if necessary.

Both repositories use the implementation branch `codex/evidence-report-experience-20260911`. No release status in this document authorizes stronger marketing claims than the evidence supports.

The API candidate is retained in [draft PR 133](https://github.com/Monderman-Group/monderman-api/pull/133). Both implementation branches are pushed remotely. Main branches remain unchanged; no production migration or deployment has occurred in this release task.
