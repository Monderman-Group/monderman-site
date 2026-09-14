# Public presentation CI and private engine release gate

**This SITE repository is public. Never put API source, source packs or their
manifests in it, including ignored files or GitHub artifacts.** The helper code
here contains no private engine implementation. It does not authorize copying
the implementation into this repository. Private tests run locally or in the
private API's controlled environment, never in public SITE CI.

## Public CI: presentation only

`private_source_absence_smoke.mjs` checks working files, the actual Git index
(including index-only/renamed payloads), and optionally the built site. It
rejects known private pack filenames and the packed data/manifest signature.
Its mutation tests use fabricated marker data, not real API source.
Run this check after staging and **before committing**. Public CI is only a
backstop; it cannot undo a source disclosure already committed to a public repo.

The default authored-report browser test uses only the actual reviewed public
sample artifact. It requires its exact current contract, provenance and approval
hashes before rendering six reports in Chromium and WebKit at four widths:
48 public render states and six PDFs. It must fail on a superseded artifact;
it never substitutes a mock or skips the current-artifact requirement.

The default campaign UI test uses explicitly MOCK, data-only HTTP responses.
Its scripted statuses are not readiness calculations. Screenshots and receipts
identify this limitation. It checks presentation, review interactions, request
handling and responsive layout, not server correctness or persistence.

```sh
node scripts/private_source_absence_smoke.mjs --publish-dir .render-public
node scripts/authored_report_experience_smoke.mjs
SAMPLE_BASE=http://127.0.0.1:8080 node scripts/campaign_report_experience_smoke.mjs
```

## Separate mandatory private release gate

Public presentation CI does **not** replace the exact-source private gate.
For each release candidate, an authorized operator must record a passing
private fixture guard, engine-backed campaign UI run, and private/public
projection run against the exact committed API candidate. Retain those
receipts outside this repository. A missing or failing private gate is an
unresolved release gate, not a silently skipped check or a public CI pass.

Build to a new private directory outside **both** checkouts:

```sh
node scripts/build_private_evidence_api_fixture.mjs --write --api-root /absolute/private/API/checkout --commit FULL_COMMIT --out /absolute/private/release-fixture
MONDERMAN_EVIDENCE_FIXTURE_DIR=/absolute/private/release-fixture node scripts/evidence_api_fixture_smoke.mjs --publish-dir .render-public
MONDERMAN_EVIDENCE_FIXTURE_DIR=/absolute/private/release-fixture SAMPLE_OUT=/absolute/private/authored-layout node scripts/authored_report_experience_smoke.mjs
MONDERMAN_EVIDENCE_FIXTURE_DIR=/absolute/private/release-fixture SAMPLE_OUT=/absolute/private/campaign-layout SAMPLE_BASE=http://127.0.0.1:8080 node scripts/campaign_report_experience_smoke.mjs
```

The builder verifies clean, committed API source and refuses output inside
either checkout. An explicit `--historical` can package an older exact commit
for a negative control, also outside both checkouts. It is not a current release
approval. `--replace` is explicit; prefer a new directory to preserve old proof.
Changes to the builder or loader require rebuilding because their hashes are
bound into the private manifest. Unpinned sibling imports are rejected.

The exact-byte pack is parsed as data, not executed as a CJS wrapper. Original
dynamic imports and source reads use one verified temporary source tree so
module and capability identity remain stable. The loader verifies paths,
source hashes, exports and identity, then blocks ordinary Node network entry
points. This is regression safety, not an adversarial JavaScript sandbox.
Public SITE GitHub Actions cannot load the private engine even if an environment
variable is accidentally supplied.

The private authored suite generates current deterministic examples and MOCK
prose, then renders actual private/public projections: 96 states and 12 MOCK
PDFs. These are not live AI output quality receipts. Private transport tests
likewise do not establish live API/database persistence. Exact private-source
hashes are checked against the built public site in this private gate.

## Gates still required for genuine sample publication

Fresh approved AI outputs, source pins, public projection and human fidelity
review remain necessary. The public sensitivity suite's 61 mutations require
an approved current v3 baseline first. Then run all 48 public render states,
HTML/PDF exports and visual page review. Passing the private MOCK suite cannot
approve a v2 artifact, substitute sample data, or stand in for live AI review.
