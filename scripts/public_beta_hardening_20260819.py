from pathlib import Path
import re

ROOT = Path('.')

PRIVACY_BODY = r'''
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">PUBLIC BETA</p>
    <h2>What this notice covers</h2>
    <p>Monderman Workspace is currently in public beta. This notice describes the data the service uses today, including the 30-day Pattern beta trial, Diagnostics, campaigns, Synthesis, Action Plans, billing and support.</p>
    <p>Monderman does not sell personal information and does not use customer data for advertising profiles.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">WHAT WE COLLECT</p>
    <h2>Account and Workspace information</h2>
    <p>When you create or use an account, we receive information such as your email address, name, sign-in identifiers and basic account metadata. A Workspace also stores its name, members, roles, plan, usage allowances and settings.</p>
    <p>We use this information to authenticate you, operate the Workspace, enforce permissions, provide the plan you selected and support the service.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">DIAGNOSTICS</p>
    <h2>What a Diagnostic stores</h2>
    <p>A saved Diagnostic may include the context you provide, structured answers, optional narrative observations, derived scores and bands, charts, findings, generated interpretation, and related run metadata. Included runs can also be used to create Analysis, Depth Synthesis, Cross-Lens Synthesis, Executive Reports and Action Plans inside the same Workspace.</p>
    <p>The scoring result is calculated by Monderman server-side. Optional narrative material is used for interpretation and does not change the structured score.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">CAMPAIGNS</p>
    <h2>Recipient and participation data</h2>
    <p>If a Workspace administrator sends a Diagnostic campaign, Monderman may store the recipient's email address, name, business unit, team, assignment settings, delivery status and participation status so the campaign can be delivered and managed.</p>
    <p>A directed assignment link can be completed without the recipient creating a Monderman member account. The Diagnostic response is still processed by the Monderman API and stored in the sponsoring Workspace according to the campaign settings.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">ANONYMITY</p>
    <h2>Anonymous campaign responses</h2>
    <p>When a campaign is configured as anonymous, Monderman does not save a link from the completed Diagnostic run back to the named recipient assignment. The Workspace can still retain organizational context such as business unit or team, which may make a person inferable in a small group.</p>
    <p>Because the identity link is not retained, Monderman cannot later identify and delete one specific anonymous response on behalf of the person who submitted it.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">AI PROCESSING</p>
    <h2>Written interpretation uses Anthropic's API</h2>
    <p>Diagnostic content needed for written interpretation is sent from the Monderman API to Anthropic's commercial API. Monderman does not send Stripe card details or Monderman service credentials with that content.</p>
    <p>Anthropic states that inputs and outputs from its commercial products are not used to train its models by default unless the commercial customer explicitly opts in or submits qualifying feedback. Anthropic also states that standard API inputs and outputs are automatically deleted from its backend within 30 days, subject to its stated safety, legal and contractual exceptions.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">BILLING &amp; TRIALS</p>
    <h2>Stripe and the one-time Pattern trial</h2>
    <p>Stripe handles payment details through Stripe-hosted payment systems. Monderman stores billing identifiers and subscription state needed to provide access, such as Stripe customer and subscription identifiers, plan, billing interval and status. Monderman does not receive or store your full card number.</p>
    <p>The 30-day Pattern beta trial is one-time per eligible account identity, not merely per Workspace. To enforce that rule, Monderman retains a small anti-abuse record containing the user identifier, normalized email address, associated Workspace identifier and trial dates. This record is designed to survive Workspace deletion so deleting and recreating a Workspace does not create another trial.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">TECHNICAL DATA</p>
    <h2>Service, security and delivery records</h2>
    <p>Operating the service creates technical records such as request times, delivery events, authentication events, error logs, browser or network information supplied to service providers, and security or bot-verification signals. We use these records to operate, secure, troubleshoot and improve the service.</p>
    <p>Contact forms, feedback and support requests store the information you submit so we can respond and investigate issues.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">SERVICE PROVIDERS</p>
    <h2>Who processes data for Monderman</h2>
    <p>Core providers currently include Supabase for database and authentication, Render for the API, Anthropic for generated interpretation, Resend for email delivery, Stripe for billing, Cloudflare for bot verification, GitHub for the static site repository and hosting workflow, and public content-delivery networks for versioned browser libraries used by the site.</p>
    <p>Each provider receives only the information needed for the function it performs, subject to its own terms and the agreements applicable to Monderman's use of that service.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">RETENTION &amp; DELETION</p>
    <h2>We retain data for the service and its safeguards</h2>
    <p>Saved Workspace content remains available until it is deleted, the Workspace is deleted, or retention is otherwise required for service operation, security, fraud prevention, billing, dispute handling or law. Provider-side copies can remain for their documented backup, security or legal retention periods.</p>
    <p>Deleting a Workspace is not a promise that every operational record disappears immediately. In particular, the one-time Pattern-trial anti-abuse record is intentionally retained after Workspace deletion. Billing, security, audit and legal records may also be retained when reasonably necessary for those purposes.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">YOUR CHOICES</p>
    <h2>Access, correction and deletion requests</h2>
    <p>You can update ordinary Workspace information through the product where controls are available. You may also contact Monderman to request access to, correction of or deletion of personal information, subject to identity verification and legal, security, billing, anti-abuse and technical limitations.</p>
    <p>Anonymous campaign responses have a special limitation: because the identity link is deliberately not stored, we cannot identify a particular anonymous response later in order to delete it for one respondent.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">LOCATION</p>
    <h2>Data can be processed across service-provider regions</h2>
    <p>Monderman and its service providers may process data in the United States and other locations where those providers operate. If your organization requires a specific residency, contractual or regulated-data arrangement, contact us before submitting that data.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">CONTACT</p>
    <h2>Questions about privacy</h2>
    <p>For privacy requests or questions, use the <a href="connect.html">Connect form</a> or email <a href="mailto:connect@monderman.com">connect@monderman.com</a>.</p>
    <p>This notice will change as the public beta changes. The date at the top tells you which version is current.</p>
  </div>
</section>
'''.strip()

SECURITY_BODY = r'''
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">PUBLIC BETA</p>
    <h2>Current security posture</h2>
    <p>Monderman Workspace is currently in public beta. This page describes controls that are operating today and avoids claiming certifications or controls that Monderman has not completed.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">ARCHITECTURE</p>
    <h2>One path from browser to result</h2>
    <p>The Monderman site is served as static pages over HTTPS. Ordinary Diagnostics require a signed-in member session. Directed campaign assignment links are the limited exception and can be completed without the recipient becoming a Workspace member.</p>
    <p>Diagnostics call a single API service on Render. The API performs authoritative scoring, calls Anthropic's commercial API for written interpretation, and writes results to Supabase Postgres. Service-role database credentials, Stripe secret keys, Anthropic credentials and email-provider credentials stay server-side and are not shipped to the browser.</p>
    <p>Core outside services currently include Supabase for database and authentication, Render for the API, Anthropic for generated interpretation, Resend for email delivery, Stripe for billing, Cloudflare for bot verification, GitHub for the static site repository and hosting workflow, and public content-delivery networks for versioned browser libraries.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">TRANSPORT</p>
    <h2>Encrypted in transit</h2>
    <p>Browser traffic to the Monderman site, API and core hosted services uses HTTPS/TLS. Payment details are entered on Stripe-hosted payment systems rather than into Monderman's own application.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">DATABASE ACCESS</p>
    <h2>Row-level security is the customer boundary</h2>
    <p>All public Postgres tables currently have row-level security enabled. Customer browser access uses Supabase's public publishable key plus the signed-in user's session. The publishable key is intentionally visible in browser code; it is not a service-role secret.</p>
    <p>Policies and authorization helpers restrict signed-in users to the Workspace operations their role allows. Service-only tables can have RLS enabled with no customer policies, which means browser roles cannot read or write those rows. Privileged server operations use server-side credentials.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">AUTHENTICATION</p>
    <h2>Workspace pages require a valid session</h2>
    <p>Supabase Auth manages member sessions. Protected Workspace pages check for a valid session and redirect signed-out users to sign in. Authorization is then enforced again at the database or API boundary instead of trusting a hidden button or browser-only check.</p>
    <p>Directed campaign recipients receive scoped assignment links. Those links authorize only the assigned Diagnostic flow and do not turn the recipient into a Workspace member.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">DIAGNOSTIC INTEGRITY</p>
    <h2>Scoring is authoritative on the server</h2>
    <p>The browser does not supply the authoritative score for a saved Diagnostic. The API builds the scoring payload, applies the locked scoring logic and persists the result. Directed assignment completion also writes through the authoritative server path rather than accepting a browser-manufactured result.</p>
    <p>Optional experiential narrative can inform written interpretation but does not change the structured score.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">ANONYMITY</p>
    <h2>Anonymous responses remove the saved identity link</h2>
    <p>When a campaign is sent as anonymous, the completed Diagnostic run is not saved with a join back to the named recipient assignment. The person is told about the anonymity setting before responding.</p>
    <p>Business unit and team can still be retained because they are part of the organizational analysis. In a small group, that context can make a person inferable. Because the direct identity link is not retained, Monderman also cannot later identify and delete one specific anonymous response.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">AI PROCESSING</p>
    <h2>Anthropic receives interpretation inputs, not Monderman secrets</h2>
    <p>Content needed to produce written interpretation is sent from the API to Anthropic's commercial API. Anthropic states that commercial-product inputs and outputs are not used to train its models by default unless the customer explicitly opts in or submits qualifying feedback.</p>
    <p>Anthropic states that standard API inputs and outputs are automatically deleted from its backend within 30 days, subject to its documented safety, legal and contractual exceptions. Monderman does not send Stripe card details or Monderman service credentials with Diagnostic interpretation requests.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">TRIAL &amp; BILLING BOUNDARIES</p>
    <h2>Trial eligibility survives Workspace deletion</h2>
    <p>The 30-day Pattern beta trial is enforced by a durable one-time redemption record tied to the account identity and normalized email, not only to a Workspace. Deleting a Workspace therefore does not create another trial.</p>
    <p>The trial has an independent database expiry boundary and a Stripe trial end/cancellation boundary. Delayed Stripe trial events are not allowed to restore Pattern access after the database has already expired the evaluation.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">SECRETS</p>
    <h2>Public configuration is separated from privileged credentials</h2>
    <p>The browser necessarily contains public configuration such as the Supabase project URL, publishable key and public bot-verification site key. Those values are not treated as secrets. Privileged database, payment, AI and email credentials stay on the server.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">WHAT WE HAVE NOT DONE</p>
    <h2>No certification is claimed</h2>
    <p>Monderman does not currently claim SOC 2, ISO 27001, FedRAMP or another formal security certification, and does not represent that the public beta has completed an independent penetration test. We will not describe those controls as complete before they are complete.</p>
    <p>If your organization has regulated-data, residency, contractual or formal assurance requirements, contact us before using Monderman for that data.</p>
  </div>
</section>
<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">REPORTING</p>
    <h2>Security questions and responsible reporting</h2>
    <p>For a security questionnaire, architecture review, suspected vulnerability or security concern, use the <a href="connect.html">Connect form</a> or email <a href="mailto:connect@monderman.com">connect@monderman.com</a>.</p>
    <p><em>See also: <a href="privacy.html">Privacy</a> for what Monderman collects and why.</em></p>
  </div>
</section>
'''.strip()


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def load(path):
    return Path(path).read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

# Privacy: retain the existing shell and replace the disclosure body.
p = load('privacy.html')
p = p.replace('Last updated: June 2026', 'Last updated: August 19, 2026')
start = p.find('<!-- CONTENT_START -->')
end = p.find('<!-- CONTENT_END -->')
if start < 0 or end <= start:
    raise SystemExit('privacy content markers missing')
p = p[:start + len('<!-- CONTENT_START -->')] + '\n' + PRIVACY_BODY + '\n' + p[end:]
write('privacy.html', p)

# Security: retain hero/nav/footer and replace the factual disclosure body.
s = load('security.html')
s = s.replace('Last updated: June 2026', 'Last updated: August 19, 2026')
first = s.find('<section class="section">')
footer = s.find('<footer class="footer mond-footer">')
if first < 0 or footer <= first:
    raise SystemExit('security section/footer anchors missing')
s = s[:first] + SECURITY_BODY + '\n' + s[footer:]
write('security.html', s)

# Pattern beta trial: accurate one-time identity rule and restrained Beta label.
t = load('pattern-trial.html')
t = t.replace('<title>30-day Pattern trial | Monderman</title>', '<title>30-day Pattern beta trial | Monderman</title>')
t = t.replace('<p class="eyebrow">Pattern evaluation</p>', '<p class="eyebrow">Pattern &middot; 30-day Beta trial</p>')
t = t.replace('A one-time evaluation for a Workspace currently on the standard Trial level. No card is required to start, and the trial does not renew automatically.', 'A one-time beta evaluation for an eligible account whose Workspace is currently on the standard Trial level. No card is required to start, and the trial does not renew automatically.')
t = t.replace('I understand this one-time 30-day evaluation starts immediately for this Workspace when I continue.', 'I understand this one-time 30-day beta evaluation starts immediately when I continue and remains used for this account identity even if the Workspace is later deleted or replaced.')
t = t.replace('One Pattern trial per Workspace. An organization admin must start the trial.', 'One Pattern trial per eligible account identity. Deleting or replacing a Workspace does not reset eligibility. An organization admin must start the trial.')
t = t.replace('This Workspace has already used its one-time Pattern trial.', 'This account identity has already used its one-time Pattern trial.')
t = t.replace('This Workspace has already used its Pattern trial.', 'This account identity has already used its Pattern trial.')
write('pattern-trial.html', t)

# Pattern plan page: identify the service/trial as beta and correct one-time scope.
pp = load('plan-pattern.html')
pp = pp.replace('<span class="pl-eyebrow">Pattern &middot; for a division</span>', '<span class="pl-eyebrow">Pattern &middot; Public Beta &middot; for a division</span>')
pp = pp.replace('<strong>Evaluate Pattern for 30 days.</strong>', '<strong>Evaluate Pattern Beta for 30 days.</strong>')
pp = pp.replace('Full Pattern Workspace access. No card required. One trial per Workspace, and it does not renew automatically.', 'Full Pattern Workspace beta access. No card required. One trial per eligible account identity, and it does not renew automatically. Deleting or replacing a Workspace does not reset eligibility.')
pp = pp.replace('Start free 30-day trial', 'Start free 30-day Beta trial')
write('plan-pattern.html', pp)

# Workspace shell: a small Beta badge next to the Monderman brand, never on Diagnostic results or reports.
workspace_files = [
    'workspace.html',
    'workspace-diagnostics.html',
    'workspace-analysis.html',
    'workspace-actions.html',
    'workspace-settings.html',
]
for name in workspace_files:
    w = load(name)
    if 'ws-beta-release' in w:
        continue
    anchor = re.compile(r'(<a class="ws-brand"[^>]*>Monderman<span class="dot"></span>)(</a>)')
    w, n = anchor.subn(r'\1<span class="ws-beta-release" aria-label="Public beta">Beta</span>\2', w, count=1)
    if n != 1:
        raise SystemExit(f'{name}: workspace brand anchor missing')
    style = '.ws-beta-release{display:inline-flex;align-items:center;margin-left:9px;padding:2px 6px;border:1px solid var(--line);border-radius:5px;font-size:9.5px;line-height:1.2;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--panel);transform:translateY(-1px)}\n'
    pos = w.find('</style>')
    if pos < 0:
        raise SystemExit(f'{name}: style close missing')
    w = w[:pos] + style + w[pos:]
    write(name, w)

# Guard against stale customer-facing trial scope after the repair.
for name in ['pattern-trial.html', 'plan-pattern.html']:
    body = load(name)
    if re.search(r'one (?:Pattern )?trial per Workspace', body, flags=re.I):
        raise SystemExit(f'{name}: stale per-Workspace trial wording remains')

# Release-copy invariants.
assert '30-day Pattern beta trial' in load('pattern-trial.html')
assert 'one-time Pattern-trial anti-abuse record' in load('privacy.html')
assert 'all public Postgres tables currently have row-level security enabled' in load('security.html')
assert 'ordinary Diagnostics require a signed-in member session' in load('security.html')
assert 'public beta' in load('privacy.html').lower()
assert 'public beta' in load('security.html').lower()
for name in workspace_files:
    assert 'ws-beta-release' in load(name)

print('PUBLIC_BETA_HARDENING=PASS')
