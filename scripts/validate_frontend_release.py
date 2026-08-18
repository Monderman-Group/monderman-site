from pathlib import Path
import re,sys
r=Path('.')
e=[]
for f in ["decision-velocity-acceptance-harness.html","operational-systems-acceptance-harness.html","structural-clarity-acceptance-harness.html","structural-clarity-acceptance-harness.js","harness-qc-matrix.html","harness-security.html","harness-two-tenant.html"]:
 if (r/f).exists():e.append("public harness "+f)
for f in ["fonts","ABM_brief_image.png"]:
 if (r/f).exists():e.append("dead artifact "+f)
for p in r.glob("*.html"):
 t=p.read_text(errors="ignore")
 for s in ["book-jacket.jpg","collect nothing about you","agree to Monderman’s terms","Where you stand versus similar organizations","TYPICAL INDUSTRY RANGE","Similar-pathway context"]:
  if s in t:e.append(p.name+": forbidden "+s)
 if not p.name.startswith("google") and 'rel="canonical"' not in t:e.append(p.name+": canonical")
 for m in re.finditer(r'<script\s+src="https://(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)[^"]+"[^>]*>',t,re.I):
  tag=m.group(0)
  if 'integrity=' not in tag or 'crossorigin=' not in tag:e.append(p.name+": external script without SRI")
 if 'esm.sh/@supabase' in t or '/@supabase/supabase-js@2.111.0/+esm' in t:e.append(p.name+": Supabase ESM import remains")
s=(r/'sample-report.html').read_text()
if len(re.findall(r'<h1\b',s,re.I))!=1:e.append('sample h1')
if s.count('aria-label="Jump to report section"')<4:e.append('sample selects')
for k in ['os','dv','sc','ip','synthesis','depth']:
 if f'aria-controls="report-{k}"' not in s or f'role="tabpanel"' not in s:e.append('sample tabs '+k)
site=(r/'sitemap.xml').read_text()
for x in ['roi.html','plan-signal.html','plan-pattern.html','plan-enterprise.html']:
 if x not in site:e.append('sitemap '+x)
pr=(r/'platform-services.html').read_text()
for x in ['unlimited people','People you can ask, per year']:
 if x in pr:e.append('pricing '+x)
if 'payment,,' in (r/'security.html').read_text():e.append('double comma')

# Surgical regression guards added 2026-08-13.
idx=(r/'index.html').read_text(errors='ignore')
if 'data-count-type="plain-plus" data-target="7000"' not in idx or 'type === "plain-plus"' not in idx or 'toLocaleString("en-US")' not in idx:
 e.append('homepage 7000+ counter formatting')
if re.search(r'<img[^>]*?/\s+loading="lazy">',idx,re.I):
 e.append('malformed homepage lazy-load img markup')
for name in ['decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 for url in ['chart.js@4.5.1/dist/chart.umd.min.js','html2canvas/1.4.1/html2canvas.min.js','jspdf/2.5.1/jspdf.umd.min.js','@supabase/supabase-js@2.111.0']:
  tags=[m.group(0) for m in re.finditer(r'<script\s+[^>]*src="[^"]*'+re.escape(url)+r'[^"]*"[^>]*>',t,re.I)]
  if not tags or not any('integrity=' in tag and 'crossorigin=' in tag and re.search(r'\bdefer\b',tag,re.I) for tag in tags):
   e.append(name+': deferred SRI library '+url)

# Pattern trial contract: explicit, no-card, one-use and non-renewing.
trial=(r/'pattern-trial.html').read_text(errors='ignore')
for token in ['Use the full Pattern Workspace for 30 days.','No card is required to start','does not renew automatically','/api/billing/start-pattern-trial','pattern_trial_already_used','trial_requires_admin','Nothing was charged','One Pattern trial per Workspace']:
 if token not in trial:e.append('pattern trial contract '+token)
pattern=(r/'plan-pattern.html').read_text(errors='ignore')
for token in ['href="pattern-trial.html"','Start free 30-day trial','No card required','does not renew automatically']:
 if token not in pattern:e.append('pattern trial entry '+token)
shell=(r/'workspace-shell.js').read_text(errors='ignore')
for token in ['subscription_status','pattern_trial_ends_at','org.subscription_status === "trialing"','Pattern trial · ${days} day']:
 if token not in shell:e.append('pattern trial shell '+token)

print('frontend release errors:',len(e))
for x in e:print('ERROR',x)
sys.exit(bool(e))