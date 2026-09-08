# Diagnostic language review and release status

> Historical status: the broader-candidate findings below are superseded by [the 8 September implementation update](diagnostic-language-implementation-20260908.md). Retain this document as the evidence record for the previously deployed intake/mobile correction.

8 September 2026. Two releases are deliberately separate.

## Deployed: intake and mobile corrections

Site PR [184](https://github.com/Monderman-Group/monderman-site/pull/184) was merged after all three GitHub checks passed. Production serves revision `d0da6111bed8da710a50d50e129b764dc5cff963`. The API remains `abb1b9659965e191e87030f231b79a718004cffa`.

The deployed change clarifies the setup fields for all four diagnostics, labels optional context, supplies persistent examples and units, separates the exit link from Back/Continue, gives those controls adequate space, moves support access out of their way, and contains the instrument footers. It does not change the scored question banks or scoring.

How checked:
- 136 captured intake layouts in Chromium and WebKit, including 320–1440px widths and enlarged text; all 43 field contracts.
- GitHub Frontend release gate, Decision Velocity journey regression, and Sample and Executive Report certification all succeeded on PR head `fe0a2c1`.
- Production release marker was checked after merge. HTTP 200 responses and SHA-256 hashes for the four instrument HTML files, diagnostic-intake.css, diagnostic-intake.js and feedback-widget.js match the exact approved public build.
- One fabricated live WebKit 390px run passed homepage entry, setup, answers, result display and result refresh. It produced score 70, made one start, eight answer requests, two finalization requests (including refresh recovery), one snapshot request and zero authentication mutations. The second finalization was recovery of the same run, not another admission.
- Fabricated session ID: `386d4d14-b988-4c2c-9f78-fcab770d270a`. The test did not create an account, send email or charge anything; the fabricated run was not deleted.
- The first test launch failed before opening a browser because its isolated checkout lacked Playwright. It created zero admissions. The identical script was then run from the checkout with the installed browser dependency; script hashes matched.

Rollback: revert the PR184 merge or redeploy the prior site revision `7d349ce1af2d9c4997b9aaa79f52270312d3d5c9`. No database rollback is involved.

These are browser-engine tests, not a physical iPhone test or a new live email/signup certification.

## Broader language candidate: NOT deployed

Local branches are named `codex/diagnostic-language-20260908` in the site and API checkouts. The changes are candidates, not a claim that participants will interpret old and new wording identically.

Coverage:
- Structural Clarity, Decision Velocity, Operational Systems and Institutional Performance.
- Operational, Managerial and Senior Leader perspectives.
- 10-, 30- and 60-minute eligibility and wording.
- All 115 question items, including 292 role-specific stems and answer labels.
- All 36 optional experience prompts, their labels and guidance.
- Active deterministic report narratives, four interpretive-prose builders, shared HTML/PDF report presentation and future model-prompt language. Changing only model instructions would not fix current production reports: the active path currently uses deterministic templates.
- A bounded Depth and Cross-Lens Synthesis display-copy pass is also applied: 44 static replacements across seven production files, with targeted checks in four existing tests. This corrects broken evidence-label sentences, participant-perspective terms, run-count ratio descriptions and modeled-estimate labels. It is not counted in the 144 individual-diagnostic report cases or a complete reconciliation of every synthesis term.

Applied question-bank changes:
| Diagnostic | Changed text/label fields | Items changed | Primary held proposals |
|---|---:|---:|---:|
| Decision Velocity | 91 | 32 | 1 |
| Structural Clarity | 158 | 28 | 8 |
| Operational Systems | 88 | 28 | 10 |
| Institutional Performance | 104 | 19 | 0 |
| Total | 441 | 107 | 19 |

The manifest was independently compared with every changed path and baseline `abb1b9659965e191e87030f231b79a718004cffa`. No non-display question configuration changed: IDs, response values/order, eligibility, required flags, weights, scoring signals, routing and ontology metadata remain unchanged. The old version numbers remain in the unshipped candidate; this is a release hold, not a proposed way to publish new wording.

Ten additional IP semantic alternatives and 18 DV/SC ontology label/description proposals are separate from the primary 19-held count and were not applied.

## Language standard

Use clear, professional sentences that do not require the participant to learn our internal terminology. Keep one question focused on one decision, activity, responsibility, observation or quantity. Explain a necessary technical term rather than replacing it with a different construct.

Examples:
- “Decision cycle” in setup becomes the named type of decision, with supplier and hiring examples.
- “Run context” becomes “Your focus.”
- “Operating edge” becomes people carrying out the work.
- “Managerial glue” becomes the coordination or clarification managers provide.
- “Action architecture” becomes “Priorities and options.”
- Report amounts are described as modeled time, labor cost and recovery scenarios, not actual savings.

This is not a global find-and-replace dictionary. Calendar time is not staff working time. Knowing who is responsible is not the same as responsibility being carried out. A handoff is not limited to teams. Available capacity is not only headcount. A participant's reported direction is not a measured trend.

Preserve submitted free text and historical evidence. Do not rewrite participant statements to match the new house style. Keep optional prompts explicitly optional and observational. Retain limitations on causation, generalization, uncertainty, missing inputs and modeled value.

## Evidence for the broader candidate

| Check | Actual method and result |
|---|---|
| Question configuration | Whole-bank comparison with baseline plus exact proposal-path reconciliation: 441 applied fields, 19 held fields unchanged, no non-display changes. |
| Role/depth coverage | Enumerated all 36 tool/role/depth combinations and every eligible item. |
| Routing | 1,206 paired sampled DV/SC routing cases against old/new banks: matched. This is not exhaustive path enumeration. |
| Numerical behavior | 144 synthetic best/middle/worst/alternating cases across all 36 combinations: scores, bands, numeric dimensions, burden and exposure fingerprints unchanged. |
| Existing API regressions | Full certification command passed: includes 2,016 scoring cases, 648 prose cases, synthesis, recovery, access and reliability tests. All use fixtures; this does not imply fresh production testing of those subsystems. |
| Question layouts | Actual render functions exercised in Chromium and WebKit at 390, 768 and 1440px: 1,968 layouts across all role-specific stems and optional prompts. Checks cover overflow, controls, text bounds and minimum touch targets. No admissions or external submissions. |
| Individual report layouts | Shared renderer exercised on the 144 generated report cases at three widths: 432 layouts, with no document overflow or browser page errors. Chromium only. |
| PDFs | All 52 pages of four representative 60-minute Managerial reports inspected: DV13, SC13, OS14, IP12, with chart pages inspected at full size. No remaining overlap, clipping, blank pages or orphan headings observed. Some panels continue at intact item boundaries; OS4 is notably sparse. These are not every PDF combination or accessible-PDF certification. |
| Synthesis | Eighteen API scenarios and five shared-renderer fixtures pass, including published/withheld composites, missing economics and a 2,500-run Depth fixture. Calculation and qualification assertions remain in place. This is not exhaustive synthesis comprehension or visual evidence. |
| Interaction regression | Existing DV journey passed both engines using synthetic services, including answer edits, adaptive changes, retries, recovery and result/footer presentation. |
| Static validity | All four inline scripts parse; frontend validator reports zero errors; report static contract and git whitespace checks pass. |

The new tests found and corrected 40px ordinary-question Back buttons, a tablet report-chart label extending beyond the viewport, chart-label/caption crowding and split PDF panels. Independent editorial review also caught and corrected several unintended narrowing changes before this candidate was saved.

No automated test proves comprehension or response equivalence. A small fresh-reader test should ask people to explain questions and report conclusions in their own words without coaching. Include every participant perspective and the ambiguous boundary cases below; record misunderstandings rather than merely asking whether the wording is clear.

## Release holds and proposed next work

| Priority | Finding | Required next step | Files / area |
|---|---|---|---|
| Blocker | Existing sessions preserve a version label but can resume against the deployment's current question bank. | Immutable old/current banks keyed by tool and saved version; resolve on resume, edits, prefill, finalization and persistence; pin optional prompts too. Unknown versions must not silently migrate. Test old open pages and existing assignments. | server.js; version registry and archived configs; assignment-runner-route.js; four instrument HTML files; version/regression tests |
| Blocker | Direct-run, saved-report and HTML/PDF export paths are not yet one wording implementation; only DV loads the shared report renderer directly. Some direct exports still contain copied Operational Systems framing. | Align each diagnostic's statements across all output paths, then render and compare their required text contracts. The 432 shared-renderer checks do not verify these separate direct exports. | Four instrument HTML files; monderman-report.js; export contract tests |
| Blocker | Report language has constant provenance and recovery can use newer templates. | Capture narrative-template, prose and renderer versions in completed/retry jobs; either reproduce the original version or record an explicit migration. | server.js; assignment-runner-route.js; diagnostic-completion-queue.js; report provenance and recovery tests |
| Blocker | SC change-pace stem asks about improved/eroded clarity; its answers measure change frequency/disruption. | Approve aligning the stem to the existing one-year change/disruption scale, or specify another measurement. New questionnaire version required. | configs/structuralClarityRoutingConfig.json |
| Major | DV elapsed-time start event is ambiguous; “work begins” might omit queued intake waiting. | Define the start as request entry, if that is intended, and state that waiting time counts. | configs/decisionVelocityRoutingConfig.json; timing tests |
| Major | OS exception categories mix frequency and acceptance; upkeep-visibility options overlap. | Specify the measured distinction and non-overlapping anchors before changing these scales. | configs/operationalSystemsRoutingConfig.json |
| Blocker | IP bank sizing questions and setup/prefill refer to different populations and time units. | Select one definition, then verify intake, auto-filled answers, raw-answer provenance and report labels together. Do not alter pricing by implication. | institutional-performance.html; IP config/adapter; server IP prefill; tests |
| Major | IP has inherited Structural Clarity-focused optional notes. | Decide whether these should remain structural observations or broaden to institutional performance; preserve historical labels. | institutional-performance.html; versioned prompt sets |
| Blocker | IP remedy focus can disagree with the canonical dominant dimension, and separate prose uses 78/83 stronger-condition thresholds. | Reconcile presentation with the authoritative result using targeted boundary and disagreement fixtures; do not change the scoring thresholds as a copy edit. | ipNarrativeBuilders.js; canonical descriptor consumers; report integrity tests |
| Major | Derived/canonical report vocabulary is not fully aligned, including DV “Coordination density.” | Choose one accurate label or explain the derived grouping, then align all display consumers while preserving internal keys. | dvNarrativeBuilders.js; canonical descriptors; renderer |
| Major | Synthesis canonical labels and some legacy/local report language remain unresolved after the bounded safe copy pass. | Reconcile canonical vocabulary and claims before calling the entire output system consistent. Complete rendered published/withheld, split, missing-note and partial-estimate checks. | lib/cross_diagnostic_synthesis/*; monderman-report.js; legacy/local report paths in four instrument HTMLs |
| Release condition | Human understanding has not been demonstrated. | Fresh-reader comprehension check and an actual iPhone check before broad promotion. | Test protocol and observations |

Detailed question decisions: `remaining-language-decisions.md`. Version evidence and full proposed regression matrix: `version-pinning-review.md`. Exact copy manifest: `applied-question-wording.json`. The synthesis findings are in `synthesis-language-followup.md`.

## Decision

**GO for the deployed intake/mobile correction within its tested scope. NO-GO for publishing the broader question/output rewrite as it currently stands.** The revised copy and tests are preserved separately; passing numeric and layout tests does not waive the measurement, version-continuity or report-consistency holds.
