import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const success = readFileSync("checkout-success.html", "utf8");
const checkout = readFileSync("checkout.html", "utf8");
const workspace = readFileSync("workspace.html", "utf8");

for (const token of [
  "Secure purchase confirmation",
  "/api/billing/confirm-checkout-session",
  'params.get("organization_id")',
  "organization_id: checkoutOrganizationId",
  "entitlementConfirmed",
  "purchase.amountFormatted",
  "result.invoice?.hostedUrl",
  "history.replaceState",
  "Open your Workspace",
  "Manage billing",
  "First operating sequence",
  "Your invoice is delivered two ways",
  "billing contact entered at Checkout"
]) {
  assert.ok(success.includes(token), `checkout confirmation contract missing: ${token}`);
}

assert.ok(!success.includes("Stripe has confirmed your payment and emailed your receipt"), "static unverified purchase claim returned");
assert.ok(success.includes("@media(max-width:760px)"), "tablet purchase-confirmation layout missing");
assert.ok(success.includes("@media(max-width:430px)"), "phone purchase-confirmation layout missing");
assert.ok(success.includes("role=\"status\" aria-live=\"polite\""), "purchase reconciliation lacks an accessible live status");

for (const token of [
  'id="billingContactName"',
  'id="billingEmail"',
  'type="email"',
  'id="purchaseOrderReference"',
  "billing_contact_name:",
  "billing_email:",
  "purchase_order_reference:",
  "Stripe collects the required billing address and any applicable business tax ID"
]) {
  assert.ok(checkout.includes(token), `checkout billing-record contract missing: ${token}`);
}

for (const token of [
  "id=\"wsOnboarding\"",
  "renderOnboardingProgress",
  "Workspace confirmed",
  "Team configured",
  "Baseline recorded",
  "Evidence synthesized",
  "Action Plan established",
  "Remeasurement linked",
  "monderman_setup_hidden_"
]) {
  assert.ok(workspace.includes(token), `Workspace onboarding contract missing: ${token}`);
}

for (const query of ["organization_members", "synthesis_runs", "action_plans", "action_items"]) {
  assert.ok(workspace.includes(`count('${query}'`), `Workspace onboarding is not progress-aware for ${query}`);
}

console.log("Professional signup package frontend checks passed.");
