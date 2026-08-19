from pathlib import Path


def load(name):
    return Path(name).read_text(encoding='utf-8')

def save(name, text):
    Path(name).write_text(text, encoding='utf-8')

def insert_before(text, marker, block, label):
    if block.strip() in text:
        return text
    at = text.find(marker)
    if at < 0:
        raise SystemExit(f'{label}: marker missing')
    return text[:at] + block + '\n' + text[at:]

privacy = load('privacy.html')
advisory = '''<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">AUTHORIZED REVIEW</p>
    <h2>Support and advisory access is limited to the work you ask us to do</h2>
    <p>When your organization asks Monderman for support, troubleshooting or advisory work, authorized Monderman personnel may need to review relevant Workspace settings, Diagnostic results or related records to provide that service or investigate an issue. That access is for operating and supporting Monderman or delivering the engagement, not for advertising or sale.</p>
  </div>
</section>'''
privacy = insert_before(
    privacy,
    '<section class="section">\n  <div class="section-inner">\n    <p class="section-eyebrow">AI PROCESSING</p>',
    advisory,
    'privacy advisory'
)

technical_old = '<p>Contact forms, feedback and support requests store the information you submit so we can respond and investigate issues.</p>'
technical_new = technical_old + '\n    <p>The signed-in product uses browser storage needed to maintain authentication and Workspace state. Security, payment and other service providers can also use essential cookies or storage on their own domains when providing their part of the service. Monderman does not intentionally place advertising cookies.</p>'
if technical_old not in privacy:
    raise SystemExit('privacy technical-data anchor missing')
privacy = privacy.replace(technical_old, technical_new, 1)

children = '''<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">CHILDREN</p>
    <h2>Monderman is designed for organizational use by adults</h2>
    <p>Monderman is not directed to children or intended for use by people under 18. If we learn that personal information from a child has been submitted without appropriate authorization, contact us so we can review and address it.</p>
  </div>
</section>'''
privacy = insert_before(
    privacy,
    '<section class="section">\n  <div class="section-inner">\n    <p class="section-eyebrow">LOCATION</p>',
    children,
    'privacy children'
)
save('privacy.html', privacy)

security = load('security.html')
db_old = '<p>Policies and authorization helpers restrict signed-in users to the Workspace operations their role allows. Service-only tables can have RLS enabled with no customer policies, which means browser roles cannot read or write those rows. Privileged server operations use server-side credentials.</p>'
db_new = db_old + '\n    <p>Client write privileges are also narrowed at the grant layer. Workspace administrators can change the Workspace name and review status through the customer interface, while plan, usage, billing and stored Diagnostic result fields remain server-managed.</p>'
if db_old not in security:
    raise SystemExit('security database-access anchor missing')
security = security.replace(db_old, db_new, 1)

sessions = '''<section class="section">
  <div class="section-inner">
    <p class="section-eyebrow">IN-PROGRESS SESSIONS</p>
    <h2>Long Diagnostics survive deploys without becoming permanent active sessions</h2>
    <p>While a Diagnostic is in progress, Monderman keeps temporary run state so a 30- or 60-minute Diagnostic can survive a service restart or deploy. The API keeps a local copy and a durable Supabase snapshot.</p>
    <p>For all four Diagnostics, active run state has a four-hour cutoff. Restore logic ignores a session once it is older than that cutoff. The durable snapshot can remain until it is overwritten, so four hours is the active-use and restore boundary, not a promise of physical deletion from every stored snapshot at exactly four hours.</p>
  </div>
</section>'''
security = insert_before(
    security,
    '<section class="section">\n  <div class="section-inner">\n    <p class="section-eyebrow">DIAGNOSTIC INTEGRITY</p>',
    sessions,
    'security session continuity'
)

secrets_old = '<p>The browser necessarily contains public configuration such as the Supabase project URL, publishable key and public bot-verification site key. Those values are not treated as secrets. Privileged database, payment, AI and email credentials stay on the server.</p>'
secrets_new = secrets_old + '\n    <p>AI-backed API endpoints also apply request-size and rate limits to reduce automated abuse and unexpected model spend.</p>'
if secrets_old not in security:
    raise SystemExit('security secrets anchor missing')
security = security.replace(secrets_old, secrets_new, 1)
save('security.html', security)

validator = load('scripts/validate_frontend_release.py')
privacy_anchor = "'anonymous response']"
privacy_repl = "'anonymous response','authorized Monderman personnel','browser storage needed to maintain authentication','not directed to children']"
if privacy_anchor not in validator:
    raise SystemExit('validator privacy token anchor missing')
validator = validator.replace(privacy_anchor, privacy_repl, 1)
security_anchor = "'does not currently claim SOC 2']"
security_repl = "'does not currently claim SOC 2','four-hour cutoff','durable Supabase snapshot','plan, usage, billing and stored Diagnostic result fields remain server-managed','request-size and rate limits']"
if security_anchor not in validator:
    raise SystemExit('validator security token anchor missing')
validator = validator.replace(security_anchor, security_repl, 1)
save('scripts/validate_frontend_release.py', validator)

print('FINAL_PUBLIC_BETA_DISCLOSURES=PASS')
