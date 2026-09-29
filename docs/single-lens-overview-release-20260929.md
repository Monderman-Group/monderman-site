# Single-lens report presentation correction

## Scope

Presentation-only correction requested and approved by Jason. Single-person reports and single-lens response comparisons use the existing four-tile overview: Overall findings, Time and money, Practical next steps (or available Change options), and Evidence. Tiles link to full sections with return navigation.

Where no financial scenario exists, the report explains that financial estimates become available with sufficient campaign data for Depth Synthesis or Cross-Lens Synthesis, subject to participation, coverage and relevant financial inputs. It no longer displays an empty three-category financial assessment. Valid saved early planning scenarios and earlier-format scenarios remain supported.

The shared renderer serves both sample and real saved reports. Four single-lens sample PDF downloads were regenerated from the unchanged saved sample data. No API, scoring, financial calculations, synthesis eligibility, diagnostic questions, or stored customer records changed. No AI provider calls were made.

## Verification before release

- Deterministic single-lens contract: 8,790 assertions across 96 report states, including actual engine fixtures and saved-report adapters.
- Chromium and WebKit: 4,307 assertions across 80 states at 320, 390, 834 and 1440 pixels. Checked two-column tablet/desktop layout, phone stacking, overflow, keyboard navigation, return focus and page errors, including both self-run formats without AI. These are synthetic browser checks, not a new authenticated customer journey.
- Independent visual PDF review: all nine contact sheets covering 73 pages, plus all four financial-explanation pages individually. No clipping, overlap, blank pages, broken tables or unreadable glyphs observed.
- Current horizontal overview: 9,595 checks across 83 documents. Historical overview: 4,366 checks across 67 documents.
- Runtime build: 4,597 checks across 86 pages, including cache-token propagation.
- Publication integrity: all six sample products validate; 123 deliberately corrupted manifest variants rejected. Existing sample JSON, historical approval records and both Synthesis PDFs are unchanged.
- Depth/Cross financial chart fragments remain identical. No financial calculations or eligibility rules changed.

Renderer edition: `diagnostic-renderer-single-lens-overview-20260929.1`.
Renderer SHA-256: `219e680e280c68bf0daeb86c4266da5dc306cf31af29efab6d1eebc81327cd65`.

## Release and rollback

Merge only after release checks pass, then manually deploy the existing Render static-site service. Verify the live release commit, shared renderer bytes, report caller cache tokens, four updated PDF hashes and rendered sample navigation. API deployment is not required.

Previous main commit for rollback: `61de1fbb0737a5b2af8cb4059bddae81226f95a2`.
Previous site deployment: `dep-datdaoek1f9s73fr1pfg`.

Live deployment results are recorded in the pull request and task after deployment; this document alone does not assert deployment completion.
