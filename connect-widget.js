/* ============================================================================
   Monderman connect widget  (drop-in, self-contained)
   ----------------------------------------------------------------------------
   Sibling of feedback-widget.js — same slot, same visual language, opposite
   audience: evaluation pages get an easy path to a structured conversation,
   work pages get the feedback widget instead. One line per page:
       <script src="connect-widget.js" defer></script>
   Injects its own button, panel, and styles (namespaced under #mdn-cn-root).
   No backend dependency: it routes to connect.html and offers direct email.
   ============================================================================ */
(function () {
  "use strict";
  if (window.__mondermanConnectLoaded) return;          // never inject twice
  if (window.__mondermanFeedbackLoaded) return;         // never coexist with feedback
  window.__mondermanConnectLoaded = true;

  var CSS = [
    '#mdn-cn-root,#mdn-cn-root *{box-sizing:border-box;}',
    '#mdn-cn-root{',
    '  --cn-ink:#18191C; --cn-muted:#6E6F73; --cn-surface:#FFFFFF; --cn-line:#EAE6DD;',
    '  --cn-accent:#0C6E78; --cn-accent-ink:#FFFFFF; --cn-ring:rgba(12,110,120,.20);',
    '  --cn-radius:14px; --cn-shadow:0 1px 2px rgba(16,19,23,.06),0 12px 32px rgba(16,19,23,.16);',
    '  font-family:"Neue Haas Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  color:var(--cn-ink); position:fixed; z-index:2147483000;',
    '}',
    '.mdn-cn-launch{',
    '  position:fixed; right:22px; bottom:90px; z-index:2147483000;',
    '  display:inline-flex; align-items:center; gap:8px;',
    '  padding:11px 15px; border:1px solid var(--cn-line); border-radius:7px;',
    '  background:var(--cn-surface); color:var(--cn-ink); cursor:pointer;',
    '  font:600 13.5px/1 "Neue Haas Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
    '  letter-spacing:.01em; box-shadow:0 1px 2px rgba(16,19,23,.06),0 6px 18px rgba(16,19,23,.10);',
    '  transition:transform .16s ease, box-shadow .16s ease;',
    '}',
    '.mdn-cn-launch:hover{transform:translateY(-1px); box-shadow:0 2px 4px rgba(16,19,23,.08),0 10px 26px rgba(16,19,23,.16);}',
    '.mdn-cn-launch:focus-visible{outline:none; box-shadow:0 0 0 4px var(--cn-ring);}',
    '.mdn-cn-launch svg{width:16px;height:16px;display:block;}',
    '#mdn-cn-panel{',
    '  position:fixed; right:22px; bottom:148px; width:342px; max-width:calc(100vw - 32px);',
    '  background:var(--cn-surface); border:1px solid var(--cn-line); border-radius:var(--cn-radius);',
    '  box-shadow:var(--cn-shadow); overflow:hidden;',
    '  opacity:0; transform:translateY(8px) scale(.99); pointer-events:none;',
    '  transition:opacity .18s ease, transform .18s ease;',
    '}',
    '#mdn-cn-panel.mdn-cn-open{opacity:1; transform:none; pointer-events:auto;}',
    '.mdn-cn-head{display:flex; align-items:center; justify-content:space-between; padding:14px 16px 10px;}',
    '.mdn-cn-title{font-size:14px; font-weight:700; letter-spacing:-.01em; margin:0;}',
    '.mdn-cn-close{appearance:none; border:0; background:transparent; color:var(--cn-muted); cursor:pointer; font-size:18px; line-height:1; padding:4px;}',
    '.mdn-cn-body{padding:0 16px 16px;}',
    '.mdn-cn-copy{margin:0 0 12px; font-size:13px; line-height:1.55; color:var(--cn-muted);}',
    '.mdn-cn-primary{display:block; width:100%; text-align:center; text-decoration:none;',
    '  background:var(--cn-accent); color:var(--cn-accent-ink); border-radius:9px;',
    '  padding:11px 14px; font-size:13.5px; font-weight:700; letter-spacing:.01em;}',
    '.mdn-cn-primary:hover{filter:brightness(1.05);}',
    '.mdn-cn-alt{display:block; margin-top:10px; text-align:center; font-size:12.5px; color:var(--cn-muted); text-decoration:none;}',
    '.mdn-cn-alt span{color:var(--cn-accent); font-weight:600; border-bottom:1px solid var(--cn-ring); padding-bottom:1px;}',
    '.mdn-cn-note{margin:12px 0 0; font-size:11.5px; color:var(--cn-muted); text-align:center;}',
    '@media (max-width:640px){',
    '  .mdn-cn-launch{right:14px; bottom:84px;}',
    '  #mdn-cn-panel{right:14px; bottom:142px;}',
    '}'
  ].join('\n');

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function boot() {
    var style = el('style', null, CSS);
    document.head.appendChild(style);

    var root = el('div', { id: 'mdn-cn-root' });

    var launch = el('button', { class: 'mdn-cn-launch', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6h16v10H8l-4 4V6z"></path></svg><span>Connect</span>');

    var panel = el('div', { id: 'mdn-cn-panel', role: 'dialog', 'aria-label': 'Connect with Monderman' },
      '<div class="mdn-cn-head">' +
      '  <p class="mdn-cn-title">Talk to Monderman</p>' +
      '  <button class="mdn-cn-close" type="button" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="mdn-cn-body">' +
      '  <p class="mdn-cn-copy">A structured conversation, not a sales call. Four fields open the thread; we reply within two business days.</p>' +
      '  <a class="mdn-cn-primary" href="connect.html">Start a structured conversation &rarr;</a>' +
      '  <a class="mdn-cn-alt" href="mailto:connect@monderman.com">Prefer email? <span>connect@monderman.com</span></a>' +
      '  <p class="mdn-cn-note">Questions first? The assistant in the corner knows the platform.</p>' +
      '</div>');

    root.appendChild(launch);
    root.appendChild(panel);
    document.body.appendChild(root);

    function setOpen(open) {
      panel.classList.toggle('mdn-cn-open', open);
      launch.setAttribute('aria-expanded', String(open));
    }
    launch.addEventListener('click', function () { setOpen(!panel.classList.contains('mdn-cn-open')); });
    panel.querySelector('.mdn-cn-close').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('mdn-cn-open')) return;
      if (!root.contains(e.target)) setOpen(false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
