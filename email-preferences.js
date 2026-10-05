(() => {
  'use strict';
  const endpoint = 'https://ptkxrzgmeldalrkfruth.supabase.co/functions/v1/outreach-response/optout';
  const button = document.getElementById('confirm');
  const status = document.getElementById('status');
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('optout') || '';
  // Do not call the server on load. Even a scanner that executes JavaScript
  // cannot opt out just by opening this page. Only this explicit click posts.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = 'This link is incomplete. Open Not interested from the original invitation, or reply “No thanks” to that email.';
    return;
  }
  button.disabled = false;
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = 'Saving your preference…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, confirmed: true }), credentials: 'omit',
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || result.suppressed !== true) throw new Error(result.error || 'unavailable');
      document.getElementById('heading').textContent = 'Your preference is saved.';
      document.getElementById('explanation').textContent = 'This email address has been removed from Monderman’s promotional invitations and follow-ups.';
      button.hidden = true;
      status.textContent = 'No further action is needed. You may close this page.';
      history.replaceState(null, '', location.pathname);
    } catch (error) {
      status.textContent = error?.message === 'invalid_optout_link'
        ? 'This link could not be verified. Open the original invitation or reply “No thanks” to that email.'
        : 'We could not confirm that your preference was saved. Please try again. Repeating the request is safe; it will not send duplicate notifications.';
      button.disabled = false;
    }
  });
})();
