from pathlib import Path


def one(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if s.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, found {s.count(old)}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

one('pattern-trial.html',
    '.confirm input{margin-top:3px;flex:0 0 auto}',
    '.confirm input{margin-top:3px;flex:0 0 auto}.confirm a{color:var(--accent-d);font-weight:600}')
one('pattern-trial.html',
    '<label class="confirm"><input type="checkbox" id="ackStart" disabled><span>I understand this one-time 30-day beta evaluation starts immediately when I continue and remains used for this account identity even if the Workspace is later deleted or replaced.</span></label>',
    '<label class="confirm"><input type="checkbox" id="ackStart" disabled><span>I understand this one-time 30-day beta evaluation starts immediately when I continue, remains used for this account identity even if the Workspace is later deleted or replaced, and I agree to the <a href="terms.html" target="_blank" rel="noopener">Public Beta Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a>.</span></label>')

one('signin.html',
    'We use your sign-in to identify and secure your workspace. See the <a href="privacy.html">privacy policy</a>.',
    'By signing in, you agree to the <a href="terms.html">Public Beta Terms</a>. We use your sign-in to identify and secure your workspace. See the <a href="privacy.html">Privacy notice</a>.')

one('privacy.html',
    '<p><em>See also: <a href="security.html">Security &amp; data handling</a> &mdash; the technical posture in plain terms.</em></p>',
    '<p><em>See also: <a href="security.html">Security &amp; data handling</a> for the technical posture and <a href="terms.html">Public Beta Terms</a> for the rules of use.</em></p>')

one('security.html',
    '<p><em>See also: <a href="privacy.html">Privacy</a> for what Monderman collects and why.</em></p>',
    '<p><em>See also: <a href="privacy.html">Privacy</a> for what Monderman collects and why, and <a href="terms.html">Public Beta Terms</a> for the rules of use.</em></p>')

# Sitemap XML and text.
p=Path('sitemap.xml'); s=p.read_text(encoding='utf-8')
if 'https://www.monderman.com/terms.html' not in s:
    marker='</urlset>'
    entry='  <url><loc>https://www.monderman.com/terms.html</loc></url>\n'
    if marker not in s: raise SystemExit('sitemap.xml close missing')
    s=s.replace(marker,entry+marker,1); p.write_text(s,encoding='utf-8')
p=Path('sitemap.txt'); s=p.read_text(encoding='utf-8')
if 'https://www.monderman.com/terms.html' not in s:
    if not s.endswith('\n'): s+='\n'
    s+='https://www.monderman.com/terms.html\n'; p.write_text(s,encoding='utf-8')

# Permanent release guards.
p=Path('scripts/validate_frontend_release.py'); s=p.read_text(encoding='utf-8')
anchor="print('frontend release errors:',len(e))"
guard='''# Public beta Terms must exist and remain wired at acceptance points.\nterms=(r/'terms.html').read_text(errors='ignore')\nfor token in ['Public Beta Terms of Use','does not auto-renew','once per eligible account identity','not legal, medical, accounting, investment, safety, employment','connect@monderman.com','privacy.html','security.html']:\n if token not in terms:e.append('public beta terms '+token)\ntrial=(r/'pattern-trial.html').read_text(errors='ignore')\nfor token in ['href="terms.html"','href="privacy.html"','I agree to the']:\n if token not in trial:e.append('pattern trial legal acceptance '+token)\nsignin=(r/'signin.html').read_text(errors='ignore')\nfor token in ['href="terms.html"','href="privacy.html"','By signing in']:\n if token not in signin:e.append('signin terms '+token)\nfor name in ['privacy.html','security.html']:\n if 'href="terms.html"' not in (r/name).read_text(errors='ignore'):e.append(name+': terms link')\n\n'''
if guard.strip() not in s:
    if anchor not in s: raise SystemExit('validator print anchor missing')
    s=s.replace(anchor,guard+anchor,1)
    p.write_text(s,encoding='utf-8')

print('PUBLIC_BETA_TERMS_PATCH=PASS')
