# Homepage and unified Sankey handoff — 2026-09-23

Update: actual restored-access browser and PDF review is complete for renderer SHA `21a8f8e08ecfd9bcecc90dd77ef2b062f2eb28b81158d5a7f0511c5c3611621f`. See [the presentation review](report-overview-visual-review.md) for all 96 overview states, 96 flow states, 12 homepage states, 141 inspected public PDF pages and the separate publication receipt. The earlier permission-denied and deferred notes below are historical, not current blockers. Salary activation and deployment remain separate decisions.

## Implemented scope

- `index.html`: permanent **View sample reports** link immediately after the two invitation buttons; persistent direct link in the preview footer; reviewed decorative inline accents use gold.
- `scripts/templates/home-workspace-preview.html`: same persistent footer link, so regeneration retains it. No journey JavaScript changed.
- `homepage-workspace-demo.css`: visible, focusable 44 px targets for both new links.
- `sample-report-tile.css`, `pilot-waitlist.css`, `canonical-site-shell.css`: bounded decorative gold corrections. Score bands, error/warning styles and semantic amber tokens are unchanged.
- `public-product-design.css`: scoped gold overrides for promotional service bullets/tags and the diagnostics shared-context feature. The static build already injects this stylesheet into the applicable public pages.
- `monderman-report.js`: unified money/time diagrams and their styles, the separately reviewed four-tile screen overview, and the conditional whole-group salary cost-basis explanation share the same renderer. The renderer version remains the candidate `diagnostic-renderer-report-overview-20260923.1`.

The existing primary sea-glass/teal CTA and secondary `#C9A227` gold-outline rules already met the request. `enterprise-site.css`, brand foundations and `homepage-workspace-demo.js` remain unchanged.

## Two-chart presentation contract

The new flow version is `20260923.1`. For complete scenarios with entered positive denominators, each planning case has:

1. `data-burden-kind="money"`, unit `USD`: current and planned expense sources combined, with separate `spendingReduction`, `spendingAvoidance`, `currentRemaining` and `plannedRemaining` outcomes. Salary-valued retained capacity is absent.
2. `data-burden-kind="workload"`, unit `hours`: `staffCapacity`, `spendingReduction`, `spendingAvoidance` and `remaining` outcomes. Allocated hours are excluded from retained capacity.

Both use `data-burden-scale="180 / complete baseline"`, unchanged across Low/Central/High. The SVG width is 200 coordinate units, node widths are 6, ribbon opacity is .34, and labels occupy equal-width HTML rails outside the SVG. The same left-to-right chart remains on phones. Source and outcome outer extents are balanced; a single source uses aligned outgoing ports. Heights vary with source count and label length while remaining stable across cases.

The follow-up compact-label revision bounds visible source titles to two lines, with deliberate ellipsis for partial names. Full titles remain in accessible text, hover titles and the complete source list. Outcome labels are concise while their full definitions remain accessible and in the SVG description. Repeated type labels are shortened to Current, Planned, Staff time or Mixed. Amounts wrap in full and are never clamped.

Up to six source labels are shown. Larger inputs show the five largest sources plus explicitly labeled **Other**. Every original source, category, baseline, saved release, residual and change rationale remains in the expandable source list and the existing report assumptions. Full-API-size inputs (24 expenses, 12 activities) are covered by the offline test.

Minor independently rounded hour components are reconciled only for ribbon widths. Saved values and all financial tables remain exact. Missing, legacy, partial, unsafe and zero-denominator inputs do not acquire invented estimates. The preexisting fallback when a rounded saved release exceeds its exact baseline remains intentional and tested.

## Verification completed

Passed locally, with no browser or network calls:

```text
node scripts/homepage_sample_discovery_contract.mjs
node scripts/public_sample_preview_data_smoke.mjs
node scripts/report_unified_sankey_contract.mjs
node --check scripts/homepage_sample_discovery_smoke.mjs
node --check monderman-report.js
git diff --check
```

The unified contract passes 11 validated scenarios, 303 source rows and 298 ribbons, including maximum source counts and 120-character labels. It checks conservation, source coverage, fixed scales and heights, equal endpoint extents, unit separation, unchanged detailed financial tables, and source immutability. A separate read-only subagent found no additional confirmed numerical or source-coverage defect.

The subsequent amount-label check found and corrected a real grouped-selector defect: only `.mr-unified-short-title` now gets the two-line clamp; outer label spans and numeric amounts use normal block layout. A negative control proves that restoring the old grouped selector is rejected. The overview, unified numerical, burden-flow, three-benefit, historical operational-flow, provenance and salary-disclosure contracts passed offline after their respective changes. Candidate HTML was regenerated without publishing PDFs or altering approval pins; its renderer SHA-256 is `423db39ca9988d3564ed96a5574fac6a556d321671d97578f26e6d6abfd0328c`.

The homepage contract exports `homepagePreviewBeforeDiscoverability(template)`, an exact one-footer replacement inverse. It can support a later narrowly recorded presentation revision. Avoid importing that module directly into `public_sample_fixture.mjs`, because its renderer import would create a circular dependency; separate the inverse first if needed.

## Historical deferred verification and continuing release boundaries

- Browser and PDF layout verification have not run. The later authorized bounded local-server recheck returned `EPERM` and the permissions request returned no grant; no alternate browser/network workaround was attempted. `homepage_sample_discovery_smoke.mjs` is authored and syntax-checked only.
- Label spacing reserves deterministic two-line title budgets and full value wrapping. Actual text bounds, especially at 320 px, still need permitted browser verification. After the compact-label follow-up, both current saved examples specify approximately **416/477 px desktop/phone for money** and **424/486 px for hours**. The offline contract enforces current-example limits of 450 px desktop and 600 px phone; these are computed dimensions, not visually verified browser measurements.
- Current-flow contracts were updated from three sections and separate phone SVGs to two money/time diagrams, while preserving arithmetic, source coverage, escaping and immutable historical fixtures. Historical operational-Sankey tests intentionally retain their historical three-case charts. The final current-renderer PDF caption assertion was corrected from `Central case: from current demands to potential savings` to `Central case: money and staff time`, including its one-heading count. It was syntax-checked and the deterministic three-benefit stage rerun; no PDF was produced. The exporter and financial-BLUF browser expectations are prepared for the two-chart/four-tile display, but the latter's reviewed-source inverse pin still deliberately blocks the unreviewed renderer.
- The existing preview publication check flags the changed homepage template hash. Publication manifests, artifact approval pins, sample source data and PDFs were not changed. Keep that gate intact until actual browser/PDF verification and the reviewed presentation revision are recorded.
- This homepage/chart work did not commit, push or deploy changes, and did not alter API contracts. The separate salary backend candidate and its disabled activation state are documented in the API staging handoff.

Browser/PDF commands, their prerequisites and the separate salary activation hold are recorded in [the release verification checklist](report-overview-release-verification.md). The actual presentation evidence supersedes the historical deferrals above. Presentation approval is not native database or deployment sign-off.

Executable contracts use published baseline `31c87d9944d58cd58a48e389a680e0e909536329`, available to remote CI. Its tree `c160aeeddd876bf08280d970a8ecc6cd7318d83d` was verified byte-identical to the local working baseline `27ef3b10008cd8f34f7b215007921905cfca686f`.
