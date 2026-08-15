# Meta-synthesis frontend customer-release audit

Base: `2bbb67116c349861618cc1cb31aed5e729de85bf`

Scope: shared synthesis report rendering, workspace selection, direct JSON upload, and the saved synthesis report page. The four certified diagnostic pages and their report contracts remain unchanged.

## Repairs

- separates Depth Synthesis from Cross-Lens Synthesis in customer copy and exports
- preserves a withheld composite as withheld in screen, HTML, JSON, and print/PDF output
- renders same-lens median, range, IQR, sample standard deviation, consensus state, and measured vantage segments
- renders evidence band, scope, source identity, version compatibility, measurement window, representativeness, and lens balance separately from condition
- replaces unsupported compensation, compounding, cascade, root-cause, and intervention-horizon presentation
- supports up to 5,000 selected workspace runs using compact authenticated run IDs
- pages up to 10,000 promoted workspace records while rendering only 250 individual rows
- keeps direct JSON uploads under a 220 KB preflight ceiling and directs larger cohorts to the workspace path
- uses one shared report renderer on the workspace and full-page report; the report page does not recalculate synthesis results

## Permanent release fixtures

- 2,500-run same-lens depth synthesis
- divided same-lens respondent distribution
- imbalanced cross-lens comparison with composite withheld and exact run requirements
- coherent equal-lens composite
- missing economic inputs with exposure withheld

This file records implementation status, not production certification. No API or site branch should be merged or deployed until both regression workflows pass and the paired diffs are reviewed.
