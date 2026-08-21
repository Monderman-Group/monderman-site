import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const invite = readFileSync(new URL("../accept-invite.html", import.meta.url), "utf8");
const signin = readFileSync(new URL("../signin.html", import.meta.url), "utf8");

for (const text of [
  "You&rsquo;ve been invited to a Monderman workspace",
  "the email address that received this invitation",
  "No purchase or separate signup is required",
  "Continue securely"
]) assert.ok(invite.includes(text), `invitation landing copy missing: ${text}`);

for (const text of [
  "Accept your Monderman workspace invitation",
  "Invited email address",
  "No purchase or separate signup is required",
  "Review the terms to join this workspace",
  "Your identity matches this invitation",
  "invitation has not been changed",
  "invitation was not accepted"
]) assert.ok(signin.includes(text), `invitation sign-in state missing: ${text}`);

assert.equal((signin.match(/createClient\(/g) || []).length, 1, "sign-in must create one shared Supabase client");
assert.ok(signin.includes('sessionStorage.setItem(INVITE_STORAGE_KEY, pendingInviteToken)'), "invitation context must survive authentication");
assert.ok(signin.includes('history.replaceState(null, ""'), "invitation material must be removed from the visible URL");
assert.ok(signin.includes('sessionStorage.removeItem(INVITE_STORAGE_KEY)'), "invitation context must be cleared after completion");
assert.ok(signin.indexOf('if (invitationMode) {') < signin.indexOf('checkExistingSession();'), "invitation copy must be applied before auth boot");
assert.ok(signin.includes('ui.sampleLine.hidden = true'), "generic acquisition path must be absent in invitation mode");
assert.ok(signin.includes('window.__mondermanConnectLoaded = true'), "invitation mode must prevent Connect-widget collision");
assert.ok(!signin.includes("Your account was not activated"), "pre-auth/legal lookup failures must not claim account activation failed");
assert.ok(invite.includes('/^[A-Za-z0-9_-]{16,240}$/.test(token)'), "missing and malformed invitation tokens must be rejected before sign-in");

const functionSource = signin.match(/function invitationStatusMessage\(code, networkFailure=false\)\{[\s\S]*?\n    \}/)?.[0];
assert.ok(functionSource, "invitation error mapper must remain testable");
const context = vm.createContext({});
vm.runInContext(`${functionSource}; globalThis.mapInvitationError = invitationStatusMessage;`, context);
assert.match(context.mapInvitationError("invite_email_mismatch"), /different email address/i);
assert.match(context.mapInvitationError("invite_expired"), /expired/i);
assert.match(context.mapInvitationError("invite_not_found"), /invalid, revoked, or incomplete/i);
assert.match(context.mapInvitationError("legal_document_versions_unavailable"), /invitation has not been changed/i);
assert.match(context.mapInvitationError("ignored", true), /reach the invitation service/i);

for (const token of [
  '@media (max-width:520px)',
  'min-height:52px',
  'role="status" aria-live="polite"',
  'overflow-wrap:anywhere',
  'ui.invitationRecovery.focus()',
  'ui.emailInput.focus()'
]) assert.ok(signin.includes(token), `mobile/accessibility guard missing: ${token}`);

console.log("Invitation experience smoke passed: invitation copy, secure context, accurate states, singleton auth, and mobile/accessibility guards.");
