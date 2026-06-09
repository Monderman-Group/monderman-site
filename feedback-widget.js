/* ============================================================================
   Monderman feedback widget  (drop-in, self-contained)
   ----------------------------------------------------------------------------
   Same pattern as assistant.js: one file at the site root, one line per page:

       <script src="feedback-widget.js" defer></script>

   It injects its own button, panel, and styles (all namespaced under
   #mdn-fb-root so nothing clashes with the site). It collects a 1–5 rating,
   a comment, and an optional email, plus the current page URL, and POSTs to
   your Render backend at /api/feedback.

   If you ever move the backend, change API_URL below. Nothing else to wire.
   ============================================================================ */
(function () {
  "use strict";

  // The Render backend. The site is static (GitHub Pages), so this must be the
  // absolute API origin — exactly like the diagnostics and the site assistant.
  var API_URL = "https://monderman-api.onrender.com/api/feedback";

  if (window.__mondermanFeedbackLoaded) return;   // never inject twice
  window.__mondermanFeedbackLoaded = true;

  // --- styles (all scoped under #mdn-fb-root / .mdn-fb-launch) ---------------
  var CSS = [
    '#mdn-fb-root,#mdn-fb-root *{box-sizing:border-box;}',
    '#mdn-fb-root{',
    '  --fb-ink:#16191d; --fb-muted:#6b7280; --fb-surface:#ffffff; --fb-line:#e5e7eb;',
    '  --fb-accent:#16191d; --fb-accent-ink:#ffffff; --fb-ring:rgba(22,25,29,.16);',
    '  --fb-radius:14px; --fb-shadow:0 1px 2px rgba(16,19,23,.06),0 12px 32px rgba(16,19,23,.16);',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  color:var(--fb-ink); position:fixed; z-index:2147483000;',
    '}',
    '.mdn-fb-launch{',
    '  position:fixed; right:22px; bottom:22px; z-index:2147483000;',
    '  display:inline-flex; align-items:center; gap:8px;',
    '  padding:11px 15px; border:1px solid var(--fb-line); border-radius:999px;',
    '  background:var(--fb-surface); color:var(--fb-ink); cursor:pointer;',
    '  font:600 13.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  letter-spacing:.01em; box-shadow:0 1px 2px rgba(16,19,23,.06),0 6px 18px rgba(16,19,23,.10);',
    '  transition:transform .16s ease, box-shadow .16s ease;',
    '}',
    '.mdn-fb-launch:hover{transform:translateY(-1px); box-shadow:0 2px 4px rgba(16,19,23,.08),0 10px 26px rgba(16,19,23,.16);}',
    '.mdn-fb-launch:focus-visible{outline:none; box-shadow:0 0 0 4px var(--fb-ring);}',
    '.mdn-fb-launch svg{width:16px;height:16px;display:block;}',
    '.mdn-fb-launch.mdn-fb-hidden{opacity:0; pointer-events:none; transform:translateY(6px);}',

    '#mdn-fb-panel{',
    '  position:fixed; right:22px; bottom:78px; width:342px; max-width:calc(100vw - 32px);',
    '  background:var(--fb-surface); border:1px solid var(--fb-line); border-radius:var(--fb-radius);',
    '  box-shadow:var(--fb-shadow); overflow:hidden;',
    '  opacity:0; transform:translateY(8px) scale(.99); pointer-events:none;',
    '  transition:opacity .18s ease, transform .18s ease;',
    '}',
    '#mdn-fb-panel.mdn-fb-open{opacity:1; transform:translateY(0) scale(1); pointer-events:auto;}',
    '.mdn-fb-head{display:flex; align-items:flex-start; justify-content:space-between; padding:16px 16px 4px;}',
    '.mdn-fb-title{font-size:14.5px; font-weight:600; margin:0; letter-spacing:.01em;}',
    '.mdn-fb-sub{font-size:12.5px; color:var(--fb-muted); margin:3px 0 0; line-height:1.4;}',
    '.mdn-fb-x{appearance:none; border:0; background:transparent; cursor:pointer; padding:4px; margin:-4px -4px 0 8px;',
    '  color:var(--fb-muted); border-radius:8px; line-height:0;}',
    '.mdn-fb-x:hover{color:var(--fb-ink); background:#f3f4f6;}',
    '.mdn-fb-x:focus-visible{outline:none; box-shadow:0 0 0 3px var(--fb-ring);}',
    '.mdn-fb-x svg{width:16px;height:16px;display:block;}',
    '.mdn-fb-body{padding:10px 16px 16px;}',
    '.mdn-fb-stars{display:flex; gap:4px; margin:6px 0 14px;}',
    '.mdn-fb-star{appearance:none; border:0; background:transparent; padding:2px; cursor:pointer; line-height:0; border-radius:6px; color:#cbd1d8;}',
    '.mdn-fb-star svg{width:26px;height:26px;display:block; transition:transform .12s ease;}',
    '.mdn-fb-star:hover svg{transform:scale(1.08);}',
    '.mdn-fb-star:focus-visible{outline:none; box-shadow:0 0 0 3px var(--fb-ring);}',
    '.mdn-fb-star.mdn-fb-on{color:var(--fb-ink);}',
    '.mdn-fb-label{display:block; font-size:12px; font-weight:600; color:var(--fb-ink); margin:0 0 6px;}',
    '.mdn-fb-optional{font-weight:500; color:var(--fb-muted);}',
    '#mdn-fb-comment,#mdn-fb-email{',
    '  width:100%; border:1px solid var(--fb-line); border-radius:10px; background:#fff; color:var(--fb-ink);',
    '  font:14px/1.45 inherit; padding:10px 11px; transition:border-color .14s ease, box-shadow .14s ease;',
    '}',
    '#mdn-fb-comment{min-height:88px; resize:vertical;}',
    '#mdn-fb-email{margin-top:2px;}',
    '#mdn-fb-comment:focus,#mdn-fb-email:focus{outline:none; border-color:#b8bdc4; box-shadow:0 0 0 3px var(--fb-ring);}',
    '#mdn-fb-comment::placeholder,#mdn-fb-email::placeholder{color:#9ca3af;}',
    '.mdn-fb-field{margin-bottom:12px;}',
    '.mdn-fb-err{color:#b42318; font-size:12px; margin:6px 0 0; display:none;}',
    '.mdn-fb-err.mdn-fb-show{display:block;}',
    '.mdn-fb-foot{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:4px;}',
    '.mdn-fb-note{font-size:11px; color:var(--fb-muted); line-height:1.4;}',
    '.mdn-fb-send{',
    '  appearance:none; border:0; cursor:pointer; background:var(--fb-accent); color:var(--fb-accent-ink);',
    '  font:600 13px/1 inherit; letter-spacing:.01em; padding:10px 16px; border-radius:10px; white-space:nowrap;',
    '  transition:opacity .14s ease, transform .14s ease;',
    '}',
    '.mdn-fb-send:hover{opacity:.9;}',
    '.mdn-fb-send:active{transform:translateY(1px);}',
    '.mdn-fb-send:focus-visible{outline:none; box-shadow:0 0 0 4px var(--fb-ring);}',
    '.mdn-fb-send:disabled{opacity:.55; cursor:default;}',
    '.mdn-fb-done{padding:30px 20px 34px; text-align:center;}',
    '.mdn-fb-done svg{width:40px;height:40px; color:var(--fb-ink); margin:0 auto 12px; display:block;}',
    '.mdn-fb-done-t{font-size:14.5px; font-weight:600; margin:0;}',
    '.mdn-fb-done-s{font-size:12.5px; color:var(--fb-muted); margin:5px 0 0;}',
    '@media (max-width:480px){',
    '  .mdn-fb-launch{right:14px; bottom:14px;}',
    '  #mdn-fb-panel{right:14px; left:14px; bottom:68px; width:auto;}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '  .mdn-fb-launch,#mdn-fb-panel,.mdn-fb-star svg{transition:none;}',
    '}'
  ].join('');

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.3l-5.4 3.1 1.4-6.1L3 9.9l6.2-.5L12 3.7l2.8 5.7 6.2.5-5 4.4 1.4 6.1z"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/></svg>';

  var rating = 0;
  var open = false;
  var lastFocus = null;

  // --- build DOM --------------------------------------------------------------
  var root = document.createElement('div');
  root.id = 'mdn-fb-root';

  var style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'mdn-fb-launch';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-label', 'Share feedback');
  launch.innerHTML = ICON_CHAT + '<span>Feedback</span>';
  root.appendChild(launch);

  var panel = document.createElement('div');
  panel.id = 'mdn-fb-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'mdn-fb-title');
  panel.setAttribute('aria-hidden', 'true');

  var starsHtml = '';
  for (var i = 1; i <= 5; i++) {
    starsHtml += '<button type="button" class="mdn-fb-star" data-v="' + i +
      '" role="radio" aria-checked="false" aria-label="' + i + ' of 5">' + ICON_STAR + '</button>';
  }

  panel.innerHTML =
    '<div class="mdn-fb-head">' +
      '<div>' +
        '<h2 class="mdn-fb-title" id="mdn-fb-title">Share feedback</h2>' +
        '<p class="mdn-fb-sub">Tell us what\u2019s working or what\u2019s missing.</p>' +
      '</div>' +
      '<button type="button" class="mdn-fb-x" aria-label="Close">' + ICON_X + '</button>' +
    '</div>' +
    '<div class="mdn-fb-body" id="mdn-fb-form">' +
      '<div class="mdn-fb-field">' +
        '<span class="mdn-fb-label">How was your experience? <span class="mdn-fb-optional">(optional)</span></span>' +
        '<div class="mdn-fb-stars" role="radiogroup" aria-label="Rating, 1 to 5">' + starsHtml + '</div>' +
      '</div>' +
      '<div class="mdn-fb-field">' +
        '<label class="mdn-fb-label" for="mdn-fb-comment">Your feedback</label>' +
        '<textarea id="mdn-fb-comment" maxlength="4000" placeholder="What would you change, add, or keep?"></textarea>' +
        '<p class="mdn-fb-err" id="mdn-fb-err-comment">Please add a short note before sending.</p>' +
      '</div>' +
      '<div class="mdn-fb-field">' +
        '<label class="mdn-fb-label" for="mdn-fb-email">Email <span class="mdn-fb-optional">(optional, if you\u2019d like a reply)</span></label>' +
        '<input id="mdn-fb-email" type="email" maxlength="200" autocomplete="email" placeholder="you@example.com" />' +
        '<p class="mdn-fb-err" id="mdn-fb-err-email">That email doesn\u2019t look right \u2014 fix it or leave it blank.</p>' +
      '</div>' +
      '<div class="mdn-fb-foot">' +
        '<span class="mdn-fb-note">Sent in confidence. Never sold or shared.</span>' +
        '<button type="button" class="mdn-fb-send" id="mdn-fb-send">Send</button>' +
      '</div>' +
    '</div>';

  root.appendChild(panel);

  function mount() {
    document.body.appendChild(root);
    wire();
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  // --- behavior ---------------------------------------------------------------
  function wire() {
    var xBtn = panel.querySelector('.mdn-fb-x');
    var sendBtn = panel.querySelector('#mdn-fb-send');
    var comment = panel.querySelector('#mdn-fb-comment');
    var email = panel.querySelector('#mdn-fb-email');
    var errComment = panel.querySelector('#mdn-fb-err-comment');
    var errEmail = panel.querySelector('#mdn-fb-err-email');
    var starBtns = Array.prototype.slice.call(panel.querySelectorAll('.mdn-fb-star'));

    function paintStars(n) {
      starBtns.forEach(function (b) {
        var v = parseInt(b.getAttribute('data-v'), 10);
        var on = v <= n;
        b.classList.toggle('mdn-fb-on', on);
        b.setAttribute('aria-checked', v === rating ? 'true' : 'false');
      });
    }
    starBtns.forEach(function (b) {
      var v = parseInt(b.getAttribute('data-v'), 10);
      b.addEventListener('mouseenter', function () { paintStars(v); });
      b.addEventListener('mouseleave', function () { paintStars(rating); });
      b.addEventListener('click', function () { rating = (rating === v) ? 0 : v; paintStars(rating); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); rating = Math.min(5, rating + 1); paintStars(rating); focusStar(rating); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); rating = Math.max(1, rating - 1); paintStars(rating); focusStar(rating); }
      });
    });
    function focusStar(n) { if (n >= 1 && n <= 5) starBtns[n - 1].focus(); }

    function openPanel() {
      open = true;
      lastFocus = document.activeElement;
      panel.classList.add('mdn-fb-open');
      panel.setAttribute('aria-hidden', 'false');
      launch.classList.add('mdn-fb-hidden');
      launch.setAttribute('aria-expanded', 'true');
      setTimeout(function () { comment.focus(); }, 60);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('mousedown', onOutside, true);
    }
    function closePanel() {
      open = false;
      panel.classList.remove('mdn-fb-open');
      panel.setAttribute('aria-hidden', 'true');
      launch.classList.remove('mdn-fb-hidden');
      launch.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onOutside, true);
      if (lastFocus && lastFocus.focus) lastFocus.focus(); else launch.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
      if (e.key === 'Tab' && open) {
        var f = panel.querySelectorAll('button, textarea, input, a[href]');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function onOutside(e) {
      if (open && !panel.contains(e.target) && !launch.contains(e.target)) closePanel();
    }

    launch.addEventListener('click', function () { open ? closePanel() : openPanel(); });
    xBtn.addEventListener('click', closePanel);
    comment.addEventListener('input', function () { errComment.classList.remove('mdn-fb-show'); });
    email.addEventListener('input', function () { errEmail.classList.remove('mdn-fb-show'); });

    function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    sendBtn.addEventListener('click', function () {
      var text = (comment.value || '').trim();
      var mail = (email.value || '').trim();
      var bad = false;
      if (!text) { errComment.classList.add('mdn-fb-show'); comment.focus(); bad = true; }
      if (mail && !looksLikeEmail(mail)) { errEmail.classList.add('mdn-fb-show'); if (!bad) email.focus(); bad = true; }
      if (bad) return;

      sendBtn.disabled = true;
      var original = sendBtn.textContent;
      sendBtn.textContent = 'Sending\u2026';

      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 30000); // Render can cold-start

      fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rating: rating || null,
          comment: text,
          email: mail || null,
          page_url: location.href,
          user_agent: navigator.userAgent
        }),
        signal: ctrl.signal
      })
        .then(function (r) {
          clearTimeout(timer);
          if (r.status === 429) throw new Error('rate');
          if (!r.ok) throw new Error('http');
          return r.json().catch(function () { return {}; });
        })
        .then(function () { showDone(); })
        .catch(function (err) {
          clearTimeout(timer);
          sendBtn.disabled = false;
          sendBtn.textContent = original;
          errComment.textContent = (err && err.message === 'rate')
            ? 'You\u2019ve sent several notes just now \u2014 please wait a minute.'
            : 'Couldn\u2019t send just now. Please try again, or email connect@monderman.com.';
          errComment.classList.add('mdn-fb-show');
        });
    });

    function showDone() {
      var form = panel.querySelector('#mdn-fb-form');
      form.innerHTML =
        '<div class="mdn-fb-done" role="status">' + ICON_CHECK +
        '<p class="mdn-fb-done-t">Thanks \u2014 we\u2019ve got it.</p>' +
        '<p class="mdn-fb-done-s">Your feedback helps us improve Monderman.</p>' +
        '</div>';
      setTimeout(function () { if (open) closePanel(); }, 1800);
    }
  }
})();
