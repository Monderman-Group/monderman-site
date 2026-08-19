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

# Pattern beta trial contract: no card, identity-scoped one-use, non-renewing.
trial=(r/'pattern-trial.html').read_text(errors='ignore')
for token in ['Use the full Pattern Workspace for 30 days.','No card is required to start','does not renew automatically','/api/billing/start-pattern-trial','pattern_trial_already_used','trial_requires_admin','Nothing was charged','One Pattern trial per eligible account identity','Deleting or replacing a Workspace does not reset eligibility','ackStart','starts immediately when I continue','Your saved work is retained. Standard Trial access limits apply after day 30','Pattern &middot; 30-day Beta trial']:
 if token not in trial:e.append('pattern trial contract '+token)
for stale in ['One Pattern trial per Workspace','starts immediately for this Workspace','This Workspace has already used its one-time Pattern trial']:
 if stale in trial:e.append('pattern trial stale scope '+stale)
pattern=(r/'plan-pattern.html').read_text(errors='ignore')
for token in ['href="pattern-trial.html"','Start free 30-day Beta trial','No card required','does not renew automatically','One trial per eligible account identity','Deleting or replacing a Workspace does not reset eligibility','Pattern &middot; Public Beta']:
 if token not in pattern:e.append('pattern trial entry '+token)
shell=(r/'workspace-shell.js').read_text(errors='ignore')
for token in ['subscription_status','pattern_trial_ends_at','org.subscription_status === "trialing"','Pattern trial · ${days} day']:
 if token not in shell:e.append('pattern trial shell '+token)

# Restrained Beta labeling belongs to the app shell and plan/trial pages, not outputs.
for name in ['workspace.html','workspace-diagnostics.html','workspace-analysis.html','workspace-actions.html','workspace-settings.html']:
 if 'ws-beta-release' not in (r/name).read_text(errors='ignore'):
  e.append(name+': beta badge missing')
for name in ['sample-report.html','decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 if re.search(r'>\s*Beta\s*<|Public Beta|beta release',t,re.I):e.append(name+': beta label on diagnostic/report output')

# Public beta privacy/security disclosures must match current architecture and trial rules.
privacy=(r/'privacy.html').read_text(errors='ignore')
for token in ['Last updated: August 19, 2026','currently in public beta','one-time Pattern-trial anti-abuse record','survive Workspace deletion','Anthropic\'s commercial API','not used to train its models by default','automatically deleted from its backend within 30 days','Stripe handles payment details','does not receive or store your full card number','anonymous response']:
 if token.lower() not in privacy.lower():e.append('privacy disclosure '+token)
security=(r/'security.html').read_text(errors='ignore')
for token in ['currently in public beta','Ordinary Diagnostics require a signed-in member session','Directed campaign assignment links','All public Postgres tables currently have row-level security enabled','public publishable key','service-role database credentials','Anthropic\'s commercial API','durable one-time redemption record','Deleting a Workspace therefore does not create another trial','does not currently claim SOC 2']:
 if token.lower() not in security.lower():e.append('security disclosure '+token)
for stale in ['A person can run a scored Diagnostic without signing in','an unauthenticated request holds no read or write permission on any table']:
 if stale in security:e.append('security stale claim '+stale)

# Pattern trial 30-day lifecycle UX: countdown, explicit paid conversion, and seat management.
overview=(r/'workspace.html').read_text(errors='ignore')
for token in ['subscription_status, pattern_trial_used_at, pattern_trial_ends_at','Pattern trial · ${trialDays} day','Choose paid plan →','plan-pattern.html']:
 if token not in overview:e.append('pattern lifecycle overview '+token)
settings=(r/'workspace-settings.html').read_text(errors='ignore')
for token in ['Workspace users','workspace_member_directory','billing_suspended_role','Paused by plan','pattern_trial_ends_at','renderRailPlan(org)','seat limit']:
 if token not in settings:e.append('pattern lifecycle settings '+token)
for name in ['workspace-actions.html','workspace-analysis.html','workspace-diagnostics.html']:
 t=(r/name).read_text(errors='ignore')
 for token in ['pattern_trial_ends_at','subscription_status','ws5TrialTag','trial · ${days}d left']:
  if token not in t:e.append(name+': pattern trial rail '+token)

# A staff seat paused by a plan downgrade must be explained to that user on
# every main Workspace surface rather than looking like missing/empty data.
theme=(r/'workspace-theme.js').read_text(errors='ignore')
for token in ['ws5SeatPauseNotice','billing_suspended_role','Your <b>','Workspace seat is paused','Your saved work is retained','Ask a Workspace admin','platform-services.html']:
 if token not in theme:e.append('paused seat notice '+token)

# Retired diagnostic API routes must never return as browser callers.
retired_by_page={
 'decision-velocity.html':['/api/decision-velocity-narrative','/api/decision-velocity-score'],
 'structural-clarity.html':['/api/structural-clarity-narrative','/api/structural-clarity-score'],
 'operational-systems.html':['/api/operational-systems-narrative','/api/operational-systems-score'],
 'institutional-performance.html':['/api/institutional-performance-narrative','/api/institutional-performance-score'],
}
for name,urls in retired_by_page.items():
 t=(r/name).read_text(errors='ignore')
 for url in urls:
  if url in t:e.append(name+': retired route caller '+url)
 m=re.search(r'const FINALIZE_TIMEOUT_MS = (\d+);',t)
 if not m or int(m.group(1)) < 280000:e.append(name+': finalize timeout below 280 seconds')

# Customer-facing product copy uses Diagnostic terminology. Internal wire keys
# such as assessment_scope and evidence_assessment are intentionally exempt.
for name in ['index.html','why-monderman.html']:
 t=(r/name).read_text(errors='ignore').lower()
 if 'not an assessment' in t or 'one-time assessment' in t:
  e.append(name+': stale customer-facing assessment terminology')

print('frontend release errors:',len(e))
for x in e:print('ERROR',x)
sys.exit(bool(e))