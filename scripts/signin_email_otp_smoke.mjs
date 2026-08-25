import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const signin = readFileSync(new URL("../signin.html", import.meta.url), "utf8");

assert.match(signin, /<form class="otp-form" id="otpForm" hidden novalidate>/, "email code entry must be a distinct native form");
assert.match(signin, /id="otpInput"[^>]*inputmode="numeric"[^>]*autocomplete="one-time-code"[^>]*pattern="\[0-9\]\{8\}"[^>]*maxlength="8"/, "email code input must match the configured eight-digit OTP and expose mobile/autofill semantics");
assert.match(signin, /<button class="email-submit" id="otpSubmit" type="submit">Verify and continue<\/button>/, "email code verification must be a native submit action");
assert.match(signin, /<button class="otp-secondary" id="otpResend" type="button">Send a new code<\/button>/, "email code flow must offer bounded resend");
assert.match(signin, /<button class="otp-secondary" id="otpBack" type="button">Use a different email<\/button>/, "email code flow must offer email correction");

assert.ok(signin.includes('const OTP_STORAGE_KEY = "monderman.pendingEmailOtp"'), "pending email-code context must use a scoped session key");
assert.ok(signin.includes("const OTP_CONTEXT_TTL_MS = 15 * 60 * 1000"), "pending email-code context must expire");
assert.ok(signin.includes("Date.now() - Number(storedOtpContext.saved_at || 0) > OTP_CONTEXT_TTL_MS"), "stale email-code context must be rejected");
assert.ok(signin.includes("sessionStorage.removeItem(OTP_STORAGE_KEY)"), "email-code context must be removable after authentication or exit");

const sendFunction = signin.match(/async function sendEmailCode\(email\)\{[\s\S]*?\n    \}/)?.[0] || "";
assert.ok(sendFunction, "scanner-safe email-code request helper must exist");
assert.ok(sendFunction.includes("supabase.auth.signInWithOtp({ email })"), "email authentication must request a code without a consumable redirect link");
assert.ok(!sendFunction.includes("emailRedirectTo"), "email-code request must not emit a scanner-consumable redirect URL");
assert.ok(!signin.includes("options: { emailRedirectTo:"), "legacy email magic-link requests must be absent");
assert.ok(signin.includes('supabase.auth.verifyOtp({ email: pendingEmail, token: code, type: "email" })'), "the browser must verify the submitted email code explicitly");
assert.ok(signin.includes('ui.otpInput.value.replace(/\\D/g, "").slice(0, 8)'), "email code input must discard non-digits and cap input length");
assert.ok(signin.includes('if (!pendingEmail || !/^\\d{8}$/.test(code))'), "incomplete email codes must be rejected locally");

assert.ok(signin.includes("showOtpForm(pendingEmail, false)"), "a refresh must restore a valid interrupted email-code flow");
assert.ok(signin.includes("clearPendingOtp();\n      window.location.replace(nextTarget)"), "successful forwarding must clear transient email-code state");
assert.ok(signin.includes("authReturnUrl(provider === \"google\""), "OAuth must retain its existing callback path");
assert.ok(signin.includes("await continueAfterAuth(session)"), "verified email sessions must retain the legal acceptance gate");
assert.ok(!/sent a (?:secure )?sign-in link/i.test(signin), "customer-visible email flow must not promise a magic link");

for (const guard of [
  ".otp-secondary:hover,.otp-secondary:focus-visible",
  'aria-describedby="otpHelp"',
  'role="status" aria-live="polite"',
  "ui.otpInput.focus()",
  "ui.otpForm.reset()"
]) assert.ok(signin.includes(guard), `email code accessibility/recovery guard missing: ${guard}`);

console.log("Scanner-safe email OTP smoke passed: configured eight-digit request/verification, interrupted-flow recovery, resend/correction, expiry cleanup, OAuth compatibility, legal gating, and accessibility semantics.");
