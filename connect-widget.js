/* ============================================================================
   Monderman connect widget  (drop-in, self-contained mini-Connect)
   ----------------------------------------------------------------------------
   Sibling of feedback-widget.js — same slot, same visual language. This version
   is a complete miniature of connect.html: the same two-step intake, the same
   field names, the SAME payload to the SAME endpoint — so a visitor can start a
   structured conversation without leaving the page they are on. One line per page:
       <script src="connect-widget.js" defer></script>
   Injects its own button, panel, and styles (namespaced under #mdn-cn-root).
   ============================================================================ */
(function () {
  "use strict";
  if (window.__mondermanConnectLoaded) return;          // never inject twice
  if (window.__mondermanFeedbackLoaded) return;         // never coexist with feedback
  window.__mondermanConnectLoaded = true;

  var API_URL = "https://monderman-api.onrender.com/api/connect/send";

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
    '  position:fixed; right:22px; bottom:148px; width:360px; max-width:calc(100vw - 28px);',
    '  background:var(--cn-surface); border:1px solid var(--cn-line); border-radius:var(--cn-radius);',
    '  box-shadow:var(--cn-shadow); overflow:hidden; display:flex; flex-direction:column;',
    '  opacity:0; transform:translateY(8px) scale(.99); pointer-events:none;',
    '  transition:opacity .18s ease, transform .18s ease;',
    '}',
    '#mdn-cn-panel.mdn-cn-open{opacity:1; transform:none; pointer-events:auto;}',
    '.mdn-cn-head{display:flex; align-items:center; justify-content:space-between; padding:14px 16px 8px; flex:0 0 auto;}',
    '.mdn-cn-title{font-size:14px; font-weight:700; letter-spacing:-.01em; margin:0;}',
    '.mdn-cn-close{appearance:none; border:0; background:transparent; color:var(--cn-muted); cursor:pointer; font-size:18px; line-height:1; padding:4px;}',
    '.mdn-cn-progress{display:flex; align-items:center; gap:7px; padding:0 16px 8px; font-size:10.5px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--cn-muted); flex:0 0 auto;}',
    '.mdn-cn-dot{width:6px; height:6px; border-radius:50%; background:var(--cn-line);}',
    '.mdn-cn-dot.is-on{background:var(--cn-accent);}',
    '.mdn-cn-body{padding:2px 16px 14px; overflow-y:auto; max-height:min(62vh, 480px);}',
    '.mdn-cn-note{font-size:12px; color:var(--cn-muted); margin:0 0 10px; line-height:1.5;}',
    '.mdn-cn-field{margin-bottom:10px;}',
    '.mdn-cn-field label{display:block; font-size:11.5px; font-weight:600; letter-spacing:.02em; margin-bottom:4px; color:var(--cn-ink);}',
    '.mdn-cn-field label em{font-style:normal; font-weight:500; color:var(--cn-muted);}',
    '.mdn-cn-field input,.mdn-cn-field select,.mdn-cn-field textarea{',
    '  width:100%; border:1px solid var(--cn-line); border-radius:8px; background:#FCFBF8;',
    '  padding:8px 10px; font-family:inherit; font-size:13px; font-weight:400; line-height:1.45; color:var(--cn-ink);',
    '}',
    '.mdn-cn-field textarea{min-height:64px; resize:vertical;}',
    '.mdn-cn-field input::placeholder,.mdn-cn-field textarea::placeholder{color:#9A9892; opacity:1; font-family:inherit;}',
    '.mdn-cn-field input:focus,.mdn-cn-field select:focus,.mdn-cn-field textarea:focus{outline:none; border-color:var(--cn-accent); box-shadow:0 0 0 3px var(--cn-ring);}',
    '.mdn-cn-consent{display:flex; gap:8px; align-items:flex-start; font-size:11.5px; color:var(--cn-muted); line-height:1.5; margin:10px 0 4px;}',
    '.mdn-cn-consent input{margin-top:2px; accent-color:var(--cn-accent);}',
    '.mdn-cn-nav{display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:12px;}',
    '.mdn-cn-pill{appearance:none; border:1px solid var(--cn-line); background:var(--cn-surface); border-radius:999px; padding:9px 18px; font-family:inherit; font-size:13px; font-weight:600; line-height:1; cursor:pointer; color:var(--cn-ink);}',
    '.mdn-cn-pill-primary{background:var(--cn-accent); border-color:var(--cn-accent); color:var(--cn-accent-ink);}',
    '.mdn-cn-pill[disabled]{opacity:.55; cursor:default;}',
    '.mdn-cn-status{font-size:12px; margin:10px 0 0; color:var(--cn-muted); min-height:1em;}',
    '.mdn-cn-status.is-error{color:#8C3B2E;}',
    '.mdn-cn-foot{padding:0 16px 14px; flex:0 0 auto;}',
    '.mdn-cn-alt{display:block; text-align:center; font-size:11.5px; color:var(--cn-muted); text-decoration:none; margin-top:6px;}',
    '.mdn-cn-alt span{color:var(--cn-accent); font-weight:600; border-bottom:1px solid var(--cn-ring); padding-bottom:1px;}',
    '.mdn-cn-done{padding:8px 0 4px; text-align:center;}',
    '.mdn-cn-done svg{width:34px; height:34px; margin-bottom:8px;}',
    '.mdn-cn-done p{margin:0 0 6px; font-size:13px; line-height:1.55;}',
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
  function opts(list) {
    return list.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
  }

  var INQUIRY = [['', 'Select one'], ['Implementation support', 'Implementation support'], ['Diagnostic design and tailoring', 'Diagnostic design and tailoring'], ['Benchmarking and calibration support', 'Benchmarking and calibration support'], ['Integration support', 'Integration support'], ['Admin enablement and operator training', 'Admin enablement and operator training'], ['Other platform support', 'Other platform support']];
  var INSTITUTION = [['', 'Select one'], ['Private company', 'Private company'], ['Public company', 'Public company'], ['Federal government', 'Federal government'], ['State or local government', 'State or local government'], ['Defense or national security', 'Defense or national security'], ['Healthcare system', 'Healthcare system'], ['Higher education', 'Higher education'], ['Nonprofit or mission organization', 'Nonprofit or mission organization'], ['Other', 'Other']];
  var ORGSIZE = [['', 'Optional'], ['1-50', '1\u201350'], ['51-250', '51\u2013250'], ['251-1000', '251\u20131,000'], ['1001-5000', '1,001\u20135,000'], ['5001-25000', '5,001\u201325,000'], ['25000+', '25,000+']];
  var TIMELINE = [['', 'Optional'], ['Immediate', 'Immediate'], ['Within 30 days', 'Within 30 days'], ['Within 90 days', 'Within 90 days'], ['Exploratory', 'Exploratory']];

  function field(id, label, control) {
    return '<div class="mdn-cn-field"><label for="mdncn-' + id + '">' + label + '</label>' + control + '</div>';
  }
  function inp(id, type, req, ph) {
    return '<input id="mdncn-' + id + '" type="' + type + '"' + (req ? ' required' : '') + (ph ? ' placeholder="' + ph + '"' : '') + ' />';
  }
  function sel(id, list) {
    return '<select id="mdncn-' + id + '">' + opts(list) + '</select>';
  }
  function ta(id, req, ph) {
    return '<textarea id="mdncn-' + id + '"' + (req ? ' required' : '') + (ph ? ' placeholder="' + ph + '"' : '') + '></textarea>';
  }

  var STEP1 =
    '<p class="mdn-cn-note">A structured conversation, not a sales call. Four fields open the thread \u2014 everything on the next step is optional.</p>' +
    field('fullName', 'Full name', inp('fullName', 'text', true)) +
    field('workEmail', 'Work email', inp('workEmail', 'email', true)) +
    field('organization', 'Organization', inp('organization', 'text', true)) +
    field('issueSummary', 'What would you like to discuss?', ta('issueSummary', true, 'A sentence or two is plenty.')) +
    '<div class="mdn-cn-nav"><span></span><button type="button" class="mdn-cn-pill mdn-cn-pill-primary" id="mdncn-next">Continue \u2192</button></div>';

  var STEP2 =
    '<p class="mdn-cn-note">Optional context \u2014 anything here helps us prepare; none of it is required.</p>' +
    field('inquiryType', 'Support type <em>\u00b7 optional</em>', sel('inquiryType', INQUIRY)) +
    field('institutionType', 'Institution type <em>\u00b7 optional</em>', sel('institutionType', INSTITUTION)) +
    field('orgSize', 'Organization size <em>\u00b7 optional</em>', sel('orgSize', ORGSIZE)) +
    field('timeline', 'Timeline <em>\u00b7 optional</em>', sel('timeline', TIMELINE)) +
    field('roleTitle', 'Role / title <em>\u00b7 optional</em>', inp('roleTitle', 'text', false)) +
    field('subjectLine', 'Subject <em>\u00b7 optional</em>', inp('subjectLine', 'text', false)) +
    field('additionalContext', 'Additional context <em>\u00b7 optional</em>', ta('additionalContext', false)) +
    '<label class="mdn-cn-consent"><input type="checkbox" id="mdncn-consent" required /> <span>I understand Monderman does not sell, share, or distribute contact information; submissions are used only to review this inquiry. Full commitments are in the <a href="privacy.html" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">privacy policy</a>.</span></label>' +
    '<div class="mdn-cn-nav"><button type="button" class="mdn-cn-pill" id="mdncn-back">\u2190 Back</button>' +
    '<button type="button" class="mdn-cn-pill mdn-cn-pill-primary" id="mdncn-send">Submit request</button></div>' +
    '<p class="mdn-cn-status" id="mdncn-status" aria-live="polite"></p>';

  function boot() {
    document.head.appendChild(el('style', null, CSS));
    var root = el('div', { id: 'mdn-cn-root' });
    var launch = el('button', { class: 'mdn-cn-launch', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7z"></path></svg><span>Connect</span>');

    var panel = el('div', { id: 'mdn-cn-panel', role: 'dialog', 'aria-label': 'Connect with Monderman' },
      '<div class="mdn-cn-head"><p class="mdn-cn-title">Talk to Monderman</p>' +
      '<button class="mdn-cn-close" type="button" aria-label="Close">&times;</button></div>' +
      '<div class="mdn-cn-progress"><span class="mdn-cn-dot is-on" data-dot="1"></span><span class="mdn-cn-dot" data-dot="2"></span><span id="mdncn-steplabel">Step 1 of 2 \u00b7 Start the thread</span></div>' +
      '<div class="mdn-cn-body"><div id="mdncn-step1">' + STEP1 + '</div><div id="mdncn-step2" hidden>' + STEP2 + '</div></div>' +
      '<div class="mdn-cn-foot">' +
      '<a class="mdn-cn-alt" href="mailto:connect@monderman.com">Prefer email? <span>connect@monderman.com</span></a>' +
      '<a class="mdn-cn-alt" href="connect.html">Prefer the full page? <span>Open Connect \u2192</span></a>' +
      '</div>');

    root.appendChild(launch); root.appendChild(panel); document.body.appendChild(root);

    var $ = function (id) { return panel.querySelector('#' + id); };
    var step1 = $('mdncn-step1'), step2 = $('mdncn-step2'), lbl = $('mdncn-steplabel'), status = $('mdncn-status');
    var dots = panel.querySelectorAll('.mdn-cn-dot');

    function show(step) {
      step1.hidden = step !== 1; step2.hidden = step !== 2;
      dots.forEach(function (d) { d.classList.toggle('is-on', Number(d.dataset.dot) <= step); });
      lbl.textContent = step === 1 ? 'Step 1 of 2 \u00b7 Start the thread' : 'Step 2 of 2 \u00b7 Optional context';
    }
    function setOpen(open) {
      panel.classList.toggle('mdn-cn-open', open);
      launch.setAttribute('aria-expanded', String(open));
      if (open) { var f = panel.querySelector('input, textarea'); f && f.focus(); }
    }
    function v(id) { var n = $('mdncn-' + id); return n ? String(n.value || '').trim() : ''; }

    $('mdncn-next').addEventListener('click', function () {
      var fields = step1.querySelectorAll('input, textarea');
      for (var i = 0; i < fields.length; i++) {
        if (!fields[i].checkValidity()) { fields[i].reportValidity(); fields[i].focus(); return; }
      }
      show(2);
    });
    $('mdncn-back').addEventListener('click', function () { show(1); });

    $('mdncn-send').addEventListener('click', function () {
      var consent = $('mdncn-consent');
      if (!consent.checked) { consent.reportValidity(); return; }
      var btn = $('mdncn-send');
      // Identical payload, identical endpoint, identical error copy — mirrors connect.html
      var payload = {
        inquiryType: v('inquiryType'),
        institutionType: v('institutionType'),
        orgSize: v('orgSize'),
        timeline: v('timeline'),
        fullName: v('fullName'),
        workEmail: v('workEmail'),
        organization: v('organization'),
        roleTitle: v('roleTitle'),
        subjectLine: v('subjectLine') || v('issueSummary').slice(0, 60),
        issueSummary: v('issueSummary'),
        additionalContext: v('additionalContext')
      };
      btn.disabled = true; status.classList.remove('is-error'); status.textContent = 'Sending\u2026';
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('bad status');
        panel.querySelector('.mdn-cn-body').innerHTML =
          '<div class="mdn-cn-done">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="#0C6E78" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m8 12.5 2.6 2.6L16 9.5"></path></svg>' +
          '<p><strong>Request received.</strong></p>' +
          '<p style="color:#6E6F73;">Monderman reviews every submission directly and replies within two business days.</p>' +
          '</div>';
        var prog = panel.querySelector('.mdn-cn-progress');
        if (prog) prog.remove();
      }).catch(function () {
        btn.disabled = false;
        status.classList.add('is-error');
        status.textContent = 'Something went wrong. Please try again or email connect@monderman.com directly.';
      });
    });

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
