// The token conveys invitation context, not an authenticated account or trial.
const ENDPOINT = 'https://ptkxrzgmeldalrkfruth.supabase.co/functions/v1/outreach-response';
const STORAGE_KEY = 'monderman.outreachInvitation';
const TTL = 60 * 60 * 1000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
let currentToken = '';

export function clearOutreachInvitation() {
  currentToken = '';
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* restricted storage */ }
}
function captureToken() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has('invitation')) {
    const candidate = fragment.get('invitation') || '';
    clearOutreachInvitation();
    // Invalid explicit links must not silently fall back to a previous invite.
    if (!TOKEN.test(candidate)) return { error: 'invalid_invitation_link' };
    currentToken = candidate;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: candidate, savedAt: Date.now() })); } catch { /* fragment carried to sign-in */ }
    fragment.delete('invitation');
    const rest = fragment.toString();
    history.replaceState(null, '', location.pathname + location.search + (rest ? '#' + rest : ''));
    return { token: candidate };
  }
  if (currentToken) return { token: currentToken };
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (stored && TOKEN.test(stored.token) && Number(stored.savedAt) <= Date.now() && Date.now() - Number(stored.savedAt) <= TTL) {
      currentToken = stored.token; return { token: stored.token };
    }
  } catch { /* No cached recipient details are ever trusted. */ }
  clearOutreachInvitation();
  return null;
}
export async function loadOutreachInvitation({ forSignIn = false } = {}) {
  if (forSignIn) {
    const next = new URLSearchParams(location.search).get('next') || '';
    if (next.split(/[?#]/)[0] !== 'pattern-trial.html') return null;
  }
  const context = captureToken();
  if (!context || context.error) return context;
  try {
    const response = await fetch(ENDPOINT + '/invitation', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: context.token }), credentials: 'omit', cache: 'no-store',
      referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) return { error: result.error || 'temporarily_unavailable' };
    const invite = result.invitation;
    if (!invite || typeof invite.email !== 'string' || typeof invite.organizationName !== 'string' || typeof invite.recipientName !== 'string') {
      return { error: 'temporarily_unavailable' };
    }
    return { invitation: invite };
  } catch { return { error: 'temporarily_unavailable' }; }
}
export function outreachEmailMatches(context, session) {
  return !context?.invitation || String(session?.user?.email || '').trim().toLowerCase() === context.invitation.email.trim().toLowerCase();
}
export function outreachSignInUrl(next = 'pattern-trial.html') {
  return 'signin.html?next=' + encodeURIComponent(next) + (currentToken ? '#invitation=' + currentToken : '');
}
export function outreachErrorMessage(context) {
  if (context?.error === 'temporarily_unavailable') return 'We could not check your invitation. Please refresh and try again. Nothing has been activated.';
  return 'This invitation link is invalid, expired or already used. Contact Monderman or return to the original invitation email. Nothing has been activated.';
}
