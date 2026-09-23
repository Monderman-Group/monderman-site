# Report overview presentation review - 2026-09-23

Status: local presentation review passed. This is not a deployment receipt or employer-salary activation approval.

## Reviewed bytes and scope

Renderer: `diagnostic-renderer-report-overview-20260923.1`, SHA-256 `21a8f8e08ecfd9bcecc90dd77ef2b062f2eb28b81158d5a7f0511c5c3611621f`.

Saved sample JSON is unchanged: `35a929949e31f24bace415d0b38f1fe513d19e8f01fec091d2cccdaf7593bd03`. Scores, financial calculations, saved assumptions, authored prose, generation identities and original September 13/14 sample dates remain unchanged. No paid provider calls occurred.

Reviewed presentation includes the four white overview tiles with teal header bands, correct long-report destinations and return links, two left-to-right unit-separated money/time diagrams, equal endpoint extents, translucent core-palette ribbons, native Low/Central/High controls and complete source lists. No subscription allocation was added. Homepage sample links are visible independently of the walkthrough; the primary button is sea-glass and secondary border gold `#C9A227`.

## Actual browser and PDF evidence

Evidence root: `/Users/jasonadamson/Documents/Codex/2026-09-01/i-x20/output/report-overview-20260923/`.

| Evidence | Result |
| --- | --- |
| `browser-review-20260923-final/RECEIPT.json` | Chromium/WebKit, 320/390/834/1440 px, 96 flow states; 2,020 presentation and 11,932 burden checks; maximum 24 expenses/12 activities and long labels; native keyboard controls and source disclosure; Central-only print regardless of selected screen case |
| `overview-browser-review-viewport/RECEIPT.json` | 3,586 checks, 96 states covering all six reports, both browsers, four widths and JavaScript on/off; every tile target, return link and native no-script navigation; top-viewport navigation clearance |
| `homepage-browser-review-final/RECEIPT.json` | 12 states, Chromium/WebKit at 390/768/1440 px, JavaScript on/off; persistent direct sample links, touch targets, visible keyboard focus and approved button colors |
| `pdf-review-restored-access/EXPORT-CHECKS.json` | All six current PDFs exported; 1,337 authored fields retained, original dates retained, full comparison and source detail retained |
| `pdf-review-restored-access/visual-review/RENDER-CHECKS.json` | All 141 pages rendered at 1,500 px and checked for nonblank Letter bounds |
| `historical-bluf-review/RECEIPT.json` | 746 checks, 12 states and two PDFs; exact preceding financial presentation source recovered |
| `historical-sankey-review/RECEIPT.json` | 4,714 checks, 96 historical chart states plus 32 current legacy-report states, three QA PDFs; immutable legacy values and source guards retained |

All 17 contact sheets covering every page of the six public PDFs were visually inspected, along with full-size synthesis chart pages. No clipped diagrams, hidden numbers, missing sources, text outside page bounds or blank pages were found. Existing long-report pagination remains; the ordinary chart-caption continuation onto the comparison page was retained. The screen overview and return links are absent from print. The Central diagrams occupy synthesis page 3, following their heading on page 2 and preceding the three-case comparison on page 4.

| Public PDF | Pages |
| --- | ---: |
| Operational Systems | 16 |
| Decision Velocity | 14 |
| Structural Clarity | 17 |
| Institutional Performance | 16 |
| Depth Synthesis | 35 |
| Cross-Lens Synthesis | 43 |

## Defects found and fixed during actual review

The SVG's intrinsic aspect ratio could stretch its CSS grid row in print, leaving labels outside the chart. Adding an explicit `minmax(0,1fr)` row fixed that measured defect; all six PDFs and the flow suite were regenerated from the final renderer.

An earlier tall-cover locator screenshot centered the cover and composited the sticky navigation across its middle. Initial and returned viewport checks prove this was a capture artifact: at tablet/desktop the navigation ends at y85 and the cover begins at y109; phone clearance is also positive. The overview suite now captures initial viewports and full documents instead of a centered tall-cover locator.

WebKit needed a paint after table focus before its native ArrowRight scrolling default action. The current legacy-table test now uses the same 500 ms focus-settle interval as its preserved historical counterpart. Both browsers pass without changing the production keyboard behavior.

## Publication and regression protection

`sample-data/production-sample-release.json` adds a separate `report_overview_presentation_review` with current source/PDF hashes, preserved prior source pins, the canonical digest of the untouched prior benefit-flow receipt, and the evidence above. Six reviewed PDF bytes were copied into `sample-data/reports/`. No old approval was reissued.

`report_overview_presentation_inverse.mjs` accepts only the exact reviewed current renderer, reverses 12 finite reviewed hunks, and must recover the complete preceding renderer SHA `73c939fac58d0d2f7020207e6e1f869ec30e7f6ff745dbbfa6b76984b663ef98`. Earlier inverse fixtures and their hashes remain untouched. Current-version assertions were advanced; exact historical HTML checks remove only the separately tested overview additions.

Publication fixture and preview checks pass. The sensitivity suite rejects 91 mutations, including unapproved presentation sources, altered historical review, missing browser/PDF review, changed saved evidence and mismatched PDFs. Certification CI now watches the new files and runs overview/unified-flow/homepage contracts and actual browser checks. The installed local dependency symlink is unchanged and must not be committed.

The static shell injector now assigns fresh cache identities to all changed presentation assets and the changed salary/assignment modules. A read-only 22-case mapping check passed. The matching runtime-build expectations cover all four participant-page assignment imports and the new Composer/Settings modules. No dirty-tree build or release marker was created for this check.

Remaining release work belongs to the root task: build the actual committed revision, run built-site checks, complete the independent salary security/native-database acceptance, and verify any explicitly authorized deployment. This presentation review does not enable the salary feature.

## Committed-build follow-up

The actual local candidate `bd5948aa32bb738c10eef2f9261d5d580bdc91e2` (tree `06adbe1c37528efe4e0398226b49a2824512c1ed`) was built with its exact release marker and served locally on port 8080. That tree also identifies remote candidate `eb24ec05c3c47432aadf5fa41c35379122056cb0`; the local commit is not a deployable GitHub identity.

- Runtime build: 4,504 checks, 84 pages; all nine renderer consumers, four participant assignment consumers and new salary modules use the intended fresh cache identities. Receipt: `/var/folders/vs/fswl29sn6vz8xrss77w4r3mw0000gn/T/monderman-runtime-build-tgXCCy/RECEIPT.json`.
- Built report presentation and all six generated Letter PDF layout checks passed. Evidence: `built-report-bd5948/result.json`.
- Built screen experience passed all six report navigations and all four direct instrument surfaces, original print-body parity, immutable models, pending/completed/error AI refresh, unchanged focus and strict unchanged scroll position at the overview. Evidence: `built-screen-bd5948-final/`, including `ai-refresh-checks.json` and `body-preservation-checks.json`.
- Built homepage discovery passed 12 states. Evidence: `built-homepage-bd5948/RECEIPT.json`.
- Built cosmetic review passed 854 checks, six Chromium/WebKit layouts and 20 screenshots. Evidence: `built-cosmetic-bd5948-final/RESULT.json`.

Older tests were updated only for known presentation boundaries: use the visible overview guidance tile; remove its single additive cover class before historical print-body comparison; reset each synthetic AI lifecycle fixture to the overview so a previous product's screenshot scroll does not leak into the next case. The strict scroll/focus/model/body checks remain. The new overview action itself is verified after AI completion.

Historical site guards now use a separate exact compatibility inverse for 19 whitelisted files and 75 finite reviewed changes, preserving every older approval constant. The complete inverse fixture is pinned, all restored files must match their preceding SHA, and 58 mutation checks reject altered or missing current changes. Earlier palette-only PDF approval is checked against the historical PDF bytes, while current exports remain bound to the separate overview review.

Executable baseline references now use published commit `31c87d9944d58cd58a48e389a680e0e909536329`, whose tree is byte-identical to the local baseline. This avoids unresolvable local-only commit IDs in remote CI. A stale generated homepage entry in `public-search-index.json` was regenerated; only that entry changed, and the index check passes. This generated asset and the test-only follow-ups require the root's next commit/build before deployment. Renderer, public PDFs and saved sample JSON were not changed during this follow-up.
