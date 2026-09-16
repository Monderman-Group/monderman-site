# Approved site consistency release

Review baseline: `f91fb07fde754dea57360ddbddc9bf742d6e6702`.

## Scope

Jason approved the September 15 consistency audit and chose **Less bureaucracy. Better performance.** The homepage, structured-data slogan and generated footer use that language. The Platform Brief uses **Examine operating conditions. Save the results. Compare them later.**

The catalog explains individual reports, campaigns, Depth Synthesis and Cross-Lens Synthesis before the methodology. Participation is counted separately for each diagnostic, once per person. The introductory methodology is shorter; its original technical conditions and review status remain available in an expandable section.

Other corrections cover duration labels, authorized-user unlimited self-runs versus campaign/Synthesis allowances, the shared allowance row, misleading single-run metadata, consistent product descriptions, policy link labels and regenerated search content. Prices and numerical allowances are unchanged.

Appearance changes align action/hover colors, invitation branding, NHG physical font faces, primary control heights and page-title roles. Research reading layouts, semantic chart/status colors, neutral product surfaces, dark mode and print styles keep their separate purposes. Shared asset references are refreshed throughout the nonarchival source pages; the build also normalizes its generated copies.

## Evidence

- `site_consistency_copy_smoke.mjs`: exact approved copy and allowance checks; byte comparisons of instrument embedded behavior, invitation logic, key report/evidence files, current policy source and sample data against the review baseline. Hans changes are exactly two font declarations; sign-in behavior differs only in displayed policy labels.
- All **54** local executable checks from the release workflow's validation job passed. These include legal-edition integrity, pricing, campaign reliability, tenant boundaries, questionnaire versions, report provenance and cosmetic-regression guards.
- `runtime_asset_release_build_smoke.mjs`: **2,237** checks, including all **80** HTML documents and byte-identical generated copies of **61** headers and **65** footers.
- Fresh anonymous Chromium visits: **80 pages at 390, 768 and 1440 pixels**, no recorded page errors, failed local resources or document-width overflow. Phone/desktop overview sheets were inspected; long-page thumbnails are not word-by-word readability evidence. Protected-page/loading captures are not treated as authenticated UI certification.
- Settled anonymous sign-in, invitation and homepage navigation/search: **18 states** across Chromium and WebKit, at 390/768/1440. Verified normal/hover/focus styling, 48px controls, actual custom-font glyphs in Chromium, mobile-menu expansion/Escape, search results and zero state-changing requests.
- `methodology_business_copy_smoke.mjs`: **1,150** checks and **46** screenshots across Chromium/WebKit and phone/tablet/desktop. It opens the technical detail and checks retained financial conditions, source-link contrast/focus, fixed-header clearance, article figures and all homepage preview tabs. Close-up review caught and corrected an inherited first/last inset in the new team-overview grid; all four cards now have matching rules, body sizes and column/stack alignment, covered by explicit geometry assertions.
- `report_screen_experience_smoke.mjs`: six saved sample reports and four isolated direct-result layouts; navigation, mobile fit, spacing, contrast, accordion controls, immutable report inputs/body and print/export exclusions passed.
- `annual_pricing_billing_browser_smoke.mjs`: **39 synthetic states per engine**, Chromium and WebKit. No real purchase or provider mutation.
- `workspace_product_design_smoke.mjs`: synthetic populated, empty, loading, error, access-error and dark/light workspace states passed in both engines. No customer workspace or account was used.
- Independent source review found no new Blocker/Major. Independent desktop review inspected all eight desktop contact sheets and eight original screenshots, with no confirmed new overlap, clipping or alignment defect.
- The final cosmetic check caught a shared font-weight-range conflict: Chromium selected medium italic for a bold-italic request. Separate 500 and 600 face declarations corrected it. Chromium's platform-font inspection now reports `NHaasGroteskTXPro-76BdIt`; the unchanged font-download assertions and the full cosmetic suite pass in Chromium and WebKit. A source guard requires all eight explicit normal/italic face mappings.
- Five ordinary-page print layouts passed the existing pagination, clipping, sparse-page and contamination checks. Free-run entry, waitlist, 24 personalized-pilot scenarios, feedback, homepage assistant and cross-browser report/download checks passed with simulated application submissions; no real purchase or pilot was created.
- The public visual contract passed for 42 hero pages at seven widths in both engines. Its exact-size expectations distinguish the approved smaller shared/product heroes from the retained publication, research-index and cover roles; common rails, single-primary actions, footer geometry and pricing contrast checks remain intact.

Local evidence is retained outside the public checkout in the task's `output/site-consistency-audit-20260915/after` directory and the named test output directories. CI and post-deployment checks must still pass for the published revision; the evidence above is not itself a deployment assertion.

## Boundaries and rollback

No API, scoring, prices, entitlements, campaign thresholds, consent/security policy or payment/tax configuration changes. No new model calls or generated sample reports/PDFs. The sample release manifest has a separate, narrow source-copy review for the homepage diagnostic descriptor; original sample generation and historical acceptance records are retained.

The prior site revision is `f91fb07fde754dea57360ddbddc9bf742d6e6702`. Restore that exact Render release if rollback is requested. Deployment keeps the existing `current` questionnaire channel and both saved versions; it must not activate the legacy channel.
