from pathlib import Path
import re, hashlib, base64, urllib.request
R=Path('.')

def edit(name,fn):
 p=R/name; old=p.read_text(encoding='utf-8'); new=fn(old)
 if new!=old: p.write_text(new,encoding='utf-8'); print('edited',name)

# 1 accessibility
def sample(t):
 t=re.sub(r'<select(?![^>]*(?:aria-label|aria-labelledby))([^>]*onchange=)',r'<select aria-label="Jump to report section"\1',t,flags=re.I)
 for k in ['os','dv','sc','ip','synthesis','depth']:
  t=re.sub(r'(<button\b[^>]*data-target="'+k+r'"[^>]*role="tab"[^>]*)(>)',lambda m:m.group(1)+((' id="tab-'+k+'"') if ' id=' not in m.group(1) else '')+((' aria-controls="report-'+k+'"') if 'aria-controls=' not in m.group(1) else '')+m.group(2),t,flags=re.I)
  t=re.sub(r'(<section\b[^>]*class="[^"]*report-shell[^"]*"[^>]*data-report="'+k+r'"[^>]*)(>)',lambda m:m.group(1)+((' id="report-'+k+'"') if ' id=' not in m.group(1) else '')+((' role="tabpanel"') if 'role="tabpanel"' not in m.group(1) else '')+((' aria-labelledby="tab-'+k+'"') if 'aria-labelledby=' not in m.group(1) else '')+m.group(2),t,flags=re.I)
 return t
edit('sample-report.html',sample)

# 2 sitemap
pub=['','about.html','advisory-services.html','after-the-first-lap.html','connect.html','decision-velocity-article.html','designing-for-decision-velocity.html','deterministic-ai-infrastructure.html','diagnostics.html','governing-complexity.html','institutional-performance-article.html','operational-systems-article.html','platform-services.html','plan-signal.html','plan-pattern.html','plan-enterprise.html','privacy.html','research.html','roi.html','sample-report.html','security.html','structural-clarity-article.html','the-drift-problem.html','why-monderman.html','Monderman_Infographic.html','Monderman_Platform_Brief.html']
for x in pub:
 assert x=='' or (R/x).exists(),x
xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']+[f'  <url><loc>https://www.monderman.com/{x}</loc></url>' for x in pub]+['</urlset>']
(R/'sitemap.xml').write_text('\n'.join(xml)+'\n')
(R/'sitemap.txt').write_text('\n'.join('https://www.monderman.com/'+x for x in pub)+'\n')

# 3 mobile nav: wrap rather than invisible horizontal scrolling
def navfix(t):
 def f(m):
  b=m.group(2); c=re.sub(r'\s+','',b).lower()
  if 'overflow-x:auto' not in c:return m.group(0)
  b=re.sub(r'flex-wrap\s*:\s*nowrap\s*;','flex-wrap: wrap;',b,flags=re.I)
  b=re.sub(r'overflow-x\s*:\s*auto\s*;','overflow-x: visible;',b,flags=re.I)
  b=re.sub(r'scrollbar-width\s*:\s*none\s*;?','',b,flags=re.I)
  b=re.sub(r'-webkit-overflow-scrolling\s*:\s*touch\s*;?','',b,flags=re.I)
  if 'row-gap:' not in b:b+='\n row-gap:10px;'
  return m.group(1)+b+m.group(3)
 t=re.sub(r'(\.nav\s*\{)([^{}]*)(\})',f,t,flags=re.I|re.S)
 t=re.sub(r'\.nav::-webkit-scrollbar\s*\{\s*display\s*:\s*none\s*;?\s*\}','',t,flags=re.I)
 return t
for p in R.glob('*.html'):
 old=p.read_text(errors='ignore'); new=navfix(old)
 if new!=old:p.write_text(new);print('nav',p.name)

# 4 pricing terminology
def pricing(t):
 reps={
 'Ask up to 50 people a year and get one resolved read, on any of the four diagnostics, as often as the work changes.':'Collect up to 50 directed campaign responses a year and get one resolved read, on any of the four diagnostics, as often as the work changes.',
 'unlimited people':'unlimited self-run diagnostic users',
 '<b>50 responses a year</b>':'<b>50 directed campaign responses a year</b>',
 '<b>500 responses a year</b>':'<b>500 directed campaign responses a year</b>',
 'People you can ask, per year':'Directed campaign responses, per year',
 'People taking diagnostics':'Self-run diagnostic users',
 'And people are never the meter: unlimited self-run diagnostic users on every tier, because more perspectives make the read better.':'Self-run diagnostic users are unlimited on every tier. Directed campaign responses are the metered deployment unit because broader campaigns consume shared analysis capacity while individual use does not.'}
 for a,b in reps.items():t=t.replace(a,b)
 return t
edit('platform-services.html',pricing)

# 6 SRI for exact pinned external libraries; consolidate Supabase to UMD so SRI covers it.
urls={
 'chart':'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
 'html2canvas':'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
 'jspdf':'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
 'supabase':'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0'}
hashv={}
for k,u in urls.items():
 with urllib.request.urlopen(u,timeout=30) as f:data=f.read()
 hashv[k]='sha384-'+base64.b64encode(hashlib.sha384(data).digest()).decode()
 print(k,hashv[k])

def sri(t):
 # remove ESM imports in favor of the SRI-protected UMD global
 t=re.sub(r'import\s*\{\s*createClient\s*\}\s*from\s*["\']https://(?:esm\.sh/@supabase/supabase-js@2\.111\.0|cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.111\.0/\+esm)["\']\s*;', 'const { createClient } = window.supabase;', t)
 specs=[('chart',urls['chart']),('html2canvas',urls['html2canvas']),('jspdf',urls['jspdf']),('supabase',urls['supabase'])]
 for key,u in specs:
  pat=r'<script\s+src="'+re.escape(u)+r'"[^>]*></script>'
  repl=f'<script src="{u}" integrity="{hashv[key]}" crossorigin="anonymous"></script>'
  t=re.sub(pat,repl,t,flags=re.I)
 if 'const { createClient } = window.supabase;' in t and urls['supabase'] not in t:
  tag=f'<script src="{urls["supabase"]}" integrity="{hashv["supabase"]}" crossorigin="anonymous"></script>\n'
  t=t.replace('<script type="module">',tag+'<script type="module">',1)
 return t
for p in R.glob('*.html'):
 old=p.read_text(errors='ignore');new=sri(old)
 if new!=old:p.write_text(new);print('sri',p.name)

# double comma + dead artifacts
edit('security.html',lambda t:t.replace('for payment,, <strong>Cloudflare</strong>','for payment, <strong>Cloudflare</strong>'))
for f in ['fonts','ABM_brief_image.png']:
 (R/f).unlink(missing_ok=True)

# expanded validator
v='''from pathlib import Path\nimport re,sys\nr=Path('.')\ne=[]\nfor f in ["decision-velocity-acceptance-harness.html","operational-systems-acceptance-harness.html","structural-clarity-acceptance-harness.html","structural-clarity-acceptance-harness.js","harness-qc-matrix.html","harness-security.html","harness-two-tenant.html"]:\n if (r/f).exists():e.append("public harness "+f)\nfor f in ["fonts","ABM_brief_image.png"]:\n if (r/f).exists():e.append("dead artifact "+f)\nfor p in r.glob("*.html"):\n t=p.read_text(errors="ignore")\n for s in ["book-jacket.jpg","collect nothing about you","agree to Monderman’s terms","Where you stand versus similar organizations","TYPICAL INDUSTRY RANGE","Similar-pathway context"]:\n  if s in t:e.append(p.name+": forbidden "+s)\n if not p.name.startswith("google") and 'rel="canonical"' not in t:e.append(p.name+": canonical")\n for m in re.finditer(r'<script\\s+src="https://(?:cdn\\.jsdelivr\\.net|cdnjs\\.cloudflare\\.com)[^"]+"[^>]*>',t,re.I):\n  tag=m.group(0)\n  if 'integrity=' not in tag or 'crossorigin=' not in tag:e.append(p.name+": external script without SRI")\n if 'esm.sh/@supabase' in t or '/@supabase/supabase-js@2.111.0/+esm' in t:e.append(p.name+": Supabase ESM import remains")\ns=(r/'sample-report.html').read_text()\nif len(re.findall(r'<h1\\b',s,re.I))!=1:e.append('sample h1')\nif s.count('aria-label="Jump to report section"')<4:e.append('sample selects')\nfor k in ['os','dv','sc','ip','synthesis','depth']:\n if f'aria-controls="report-{k}"' not in s or f'role="tabpanel"' not in s:e.append('sample tabs '+k)\nsite=(r/'sitemap.xml').read_text()\nfor x in ['roi.html','plan-signal.html','plan-pattern.html','plan-enterprise.html']:\n if x not in site:e.append('sitemap '+x)\npr=(r/'platform-services.html').read_text()\nfor x in ['unlimited people','People you can ask, per year']:\n if x in pr:e.append('pricing '+x)\nif 'payment,,' in (r/'security.html').read_text():e.append('double comma')\nprint('frontend release errors:',len(e))\nfor x in e:print('ERROR',x)\nsys.exit(bool(e))\n'''
(R/'scripts'/'validate_frontend_release.py').write_text(v)

# permanent CI release gate
(R/'.github/workflows').mkdir(parents=True,exist_ok=True)
(R/'.github/workflows/frontend-release.yml').write_text('''name: Frontend release gate\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: "3.12"\n      - run: python scripts/validate_frontend_release.py\n''')
(R/'.github/workflows/final-frontend-repair.yml').unlink(missing_ok=True)
