# Outreach responses

The two response buttons do not open an email composer. Preparing an invitation does not send email, create an account, accept legal terms, bootstrap a Workspace, or start an evaluation. Prospect delivery remains paused pending separate campaign authorization and deliverability clearance.

## Interested

The recipient-specific URL is `https://www.monderman.com/pattern-trial.html#invitation=<opaque-token>`. The token resolves invitation context through the `outreach-response` Supabase Edge Function. The frontend stores only the token and its timestamp in same-tab session storage, removes it from the address bar, and re-resolves recipient details rather than trusting cached personal data. The cached token expires after one hour; the original invitation link can be reopened while the invitation remains active.

Sign-in email and, where a new Workspace is needed, organization name are prefilled. Existing Workspace choice, signed-in email verification, account eligibility, archived legal-document links, an unchecked acknowledgement, and the final Start button remain authoritative. A wrong signed-in email is blocked; sign-out is an explicit user action. OAuth returns to the existing activation destination without putting the invitation capability in the OAuth URL. Successful activation clears the outreach context.

## Not interested

The recipient-specific URL is `https://www.monderman.com/email-preferences.html#optout=<different-opaque-token>`. Page load performs no preference request. A confirmation click sends a POST with `confirmed: true`. The database atomically saves normalized-address promotional suppression and queues one operational notification to `jason.adamson@monderman.com`, from `diagnostics@monderman.com`. The message identifies the recipient, organization, campaign, method and timestamp and states that Monderman generated it.

Repeated confirmations, including different links for the same address, do not create duplicate owner notifications. Opt-out remains usable after invitation expiry or redemption. It does not create or cancel an account, start or cancel an evaluation, or stop necessary service, security or billing mail. Notification delivery retries independently of the saved suppression.

GET and HEAD do not opt anyone out. The separate `/one-click/<token>` endpoint accepts RFC8058 form POSTs. Mailbox-native unsubscribe UI additionally requires suitable DKIM-covered email headers; the visible HTML body buttons alone do not configure native mailbox controls.

## Operator preparation and sending boundary

The service-role-only `public.prepare_outreach_invitation(email, name, organization, campaign)` function returns `interestedUrl`, `notInterestedUrl`, invitation identifiers and expiry. It rejects an already suppressed address, reuses a current invitation where appropriate and otherwise creates a 14-day invitation marked `outreach_managed`. That flag excludes the prepared record from automatic pilot-invitation dispatch. Store neither raw capability in public source nor in application logs.

Use the same recipient's returned URLs to populate the corresponding email placeholders. Review identity and organization details and HTML-escape inserted values. Do not send unresolved placeholders or another recipient's link. Create recipient links close to the separately approved send date rather than consuming the activation window while sending is paused.

`public.outreach_send_preflight(email)` must return `allowed: true` immediately before an authorized promotional send or follow-up. Missing control state or a failed lookup blocks promotional delivery. The existing application outbox applies both a database guard and a final pre-provider check. Manual Gmail sends do not pass through that outbox and must follow the same fresh suppression/pause check. Preparing templates or links is not permission to unpause delivery. Existing email-authentication and campaign-approval requirements remain separate.

## Regression and release verification

- `scripts/test-outreach-response.py`: real browser, mocked identity and API boundaries; prefill, same-tab and OAuth handoff, wrong identity, expiry, explicit legal/activation steps, scanner-safe opt-out, retry and invalid-token cases.
- `scripts/outreach_response_compatibility_smoke.mjs`: recognizes only the exact reviewed two-page change when comparing older approvals. Mutated or unrelated sources are not normalized away. Original historical fixtures and approval pins are unchanged.
- `scripts/signin_legal_documents_smoke.mjs`: executes current bridge helpers and current legal/auth/trial handlers, retaining existing acceptance, refresh and race assertions. Only ES-module import/export syntax is adapted for its isolated VM.
- The API repository contains the actual Edge Function source, SQL migration, rollback-only database tests, request-handler tests and pre-send policy tests. Production rollback-only verification must not leave test invitations or customer notifications behind.

Apply the database schema before deploying the API sender filter. Deploy the Edge Function before publishing the frontend. Require successful applicable release checks and verify the published frontend assets; a successful feature test alone is not deployment proof. Confirm that promotional delivery is still paused, no real evaluation has been started by testing, and no prospect was contacted. An explicitly labelled internal notification may be used to verify the owner inbox path.

No diagnostic scoring, evidence selection, pricing, saved-report rendering or account authorization policy is changed by this workflow.
