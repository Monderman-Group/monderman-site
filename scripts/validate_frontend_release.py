from pathlib import Path
import os,re,runpy,subprocess,sys
r=Path('.')
e=[]
release_channel=os.environ.get('MONDERMAN_RELEASE_CHANNEL','beta').strip().lower()
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

# Public Privacy and Terms must be operative text before production. Draft
# branches may still be checked under the beta channel, but the production
# channel treats any common unresolved drafting marker as a hard failure.
if release_channel in {'production','outside-beta'}:
 placeholder_patterns=[
  re.compile(r'\[[^\]]*(?:TBD|TO BE CONFIRMED|CONFIRMATION REQUIRED|DECISION REQUIRED|COUNSEL REVIEW)[^\]]*\]',re.I),
  re.compile(r'\bTBD\b',re.I),
  re.compile(r'\bto be confirmed\b',re.I),
  re.compile(r'\bcounsel review\b',re.I),
  re.compile(r'\b(?:business|legal|counsel|contract|product) confirmation required\b',re.I),
  re.compile(r'\b(?:business|legal|counsel|product) decision required\b',re.I),
  re.compile(r'\bunresolved (?:legal |production )?(?:drafting )?(?:marker|placeholder)s?\b',re.I),
 ]
 for name in ['privacy.html','terms.html']:
  public_text=(r/name).read_text(errors='ignore')
  for pattern in placeholder_patterns:
   for match in pattern.finditer(public_text):
    e.append(name+': unresolved production legal drafting marker '+match.group(0))
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
if '<script src="assistant.js" defer></script>' not in idx:
 e.append('homepage assistant loader missing')
if re.search(r'^\s*#mnd-launcher\s*\{[^}]*display\s*:\s*none',idx,re.I|re.M):
 e.append('homepage assistant launcher hidden')
for token in ['body:has(#mnd-panel.mnd-open) .mdn-cn-launch','body:has(#mdn-cn-panel.mdn-cn-open) #mnd-launcher']:
 if token not in idx:e.append('homepage assistant/Connect collision guard '+token)
canonical_shell=(r/'canonical-site-shell.js').read_text(errors='ignore')
canonical_css=(r/'canonical-site-shell.css').read_text(errors='ignore')
for token in ['site-menu-button','aria-label", "Open navigation','mobile-nav-open','closeMobileNav','event.key === "Escape"']:
 if token not in canonical_shell:e.append('public mobile navigation behavior '+token)
for token in ['@media(max-width:760px)','header.mobile-nav-open .nav','width:44px;height:44px','display:none;width:100%','nav .nav-menu.is-open .nav-dropdown']:
 if token not in canonical_css:e.append('public mobile navigation layout '+token)
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
 navigation_contract={
  'questionFooter':r'<footer\s+class="env-foot"\s+id="questionFooter"',
  'progressCopy':r'id="progressCopy"',
  'pathHint':r'id="pathHint"',
  'progressBar':r'id="progressBar"',
  'backBtn':r'id="backBtn"[^>]*>Back</button>',
  'skipBtn':r'id="skipBtn"[^>]*>Skip</button>',
  'restartBtn':r'id="restartBtn"[^>]*>Start over</button>',
  'continueBtn':r'id="continueBtn"[^>]*>Continue</button>',
 }
 for control,pattern in navigation_contract.items():
  if len(re.findall(pattern,t,re.I))!=1:
   e.append(name+': diagnostic navigation control '+control)
 for control in ['continueBtn','backBtn','skipBtn','restartBtn']:
  if not re.search(re.escape(control)+r'\.addEventListener\("click"',t):
   e.append(name+': disconnected diagnostic navigation handler '+control)
 if not re.search(r'@media\s*\(max-width:760px\).*?\.env-foot',t,re.I|re.S):
  e.append(name+': diagnostic navigation mobile layout')
 if not re.search(r'questionFooter\.style\.display\s*=\s*stage\s*===\s*questionStage\s*\?\s*"grid"\s*:\s*"none"',t):
  e.append(name+': diagnostic navigation stage visibility')
 if 'if (!continueBtn || continueBtn.style.display === "none" || continueBtn.disabled) return;' not in t or 'continueBtn.click();' not in t:
  e.append(name+': diagnostic keyboard activation guard')

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
for token in ['Last updated: August 20, 2026','currently in public beta','one-time Pattern-trial anti-abuse record','survive Workspace deletion','Anthropic\'s commercial API','not used to train its models by default','automatically deleted from its backend within 30 days','Stripe handles payment details','does not receive or store your full card number','anonymous campaign responses','authorized Monderman personnel','first-party browser storage for Supabase authentication','not directed to children']:
 if token.lower() not in privacy.lower():e.append('privacy disclosure '+token)
security=(r/'security.html').read_text(errors='ignore')
for token in ['currently in public beta','Ordinary Diagnostics require a signed-in member session','Directed campaign assignment links','All public Postgres tables currently have row-level security enabled','public publishable key','service-role database credentials','Anthropic\'s commercial API','durable one-time redemption record','Deleting a Workspace therefore does not create another trial','does not currently claim SOC 2','four-hour cutoff','durable Supabase snapshot','plan, usage, billing and stored Diagnostic result fields remain server-managed','request-size and rate limits']:
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

# Saved reports linked from Overview must reopen even when the run is older
# than the Measure page's capped 200-row history. RLS on diagnostic_runs is the
# ownership boundary for exportRun's direct query.
measure=(r/'workspace-diagnostics.html').read_text(errors='ignore')
report_module=(r/'monderman-report.js').read_text(errors='ignore')
for token in ['reserveReportWindow: reserveReportWindow', 'closeReservedReportWindow: closeReservedReportWindow', 'openReport(model, reportWindow)', 'reportWindow.location.replace(url)']:
 if token not in report_module:e.append('popup-safe report delivery '+token)
for token in ['function reserveWorkspaceReportWindow()', 'const reportWindow=reserveWorkspaceReportWindow()', 'exportRun(b.dataset.report, "report", b, reportWindow)', 'exportAssignmentRun(b.dataset.report, b.dataset.tt, "report", b, reportWindow)']:
 if token not in measure:e.append('workspace synchronous report reservation '+token)
if 'if(reportId){' not in measure or 'exportRun(reportId,"report",null)' not in measure:
 e.append('workspace diagnostics direct report reopen')
if 'reportId && state.runs.some' in measure:
 e.append('workspace diagnostics direct report depends on capped history')

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

# Public beta Terms must exist and remain wired at acceptance points.
terms=(r/'terms.html').read_text(errors='ignore')
for token in ['Public Beta Terms of Use','does not auto-renew','once per eligible account identity','not legal, medical, accounting, investment, safety, employment','connect@monderman.com','privacy.html','security.html']:
 if token not in terms:e.append('public beta terms '+token)
trial=(r/'pattern-trial.html').read_text(errors='ignore')
for token in ['href="terms.html"','href="privacy.html"','I agree to the']:
 if token not in trial:e.append('pattern trial legal acceptance '+token)
signin=(r/'signin.html').read_text(errors='ignore')
for token in ['href="terms.html"','href="privacy.html"','I agree to the','and acknowledge the','/api/legal/acceptance']:
 if token not in signin:e.append('signin terms '+token)
gate=(r/'workspace-access-gate.js').read_text(errors='ignore')
for token in ['getUser()','/api/legal/acceptance/status?source=signup','legal_acceptance_required','acceptance_source','mondermanWorkspaceAccessReady']:
 if token not in gate:e.append('workspace legal gate '+token)
for name in ['workspace.html','workspace-diagnostics.html','workspace-analysis.html','workspace-actions.html','workspace-settings.html','decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html','cross-tool-synthesis.html','checkout.html']:
 if 'workspace-access-gate.js' not in (r/name).read_text(errors='ignore'):
  e.append(name+': centralized legal-access gate missing')
for name in ['privacy.html','security.html']:
 if 'href="terms.html"' not in (r/name).read_text(errors='ignore'):e.append(name+': terms link')

# Saved Synthesis reports/history are RLS-readable customer records. Keep a
# direct database fallback so report reopening and Actions do not inherit the
# compute budget or availability of the Synthesis build endpoint.
for name in ['cross-tool-synthesis.html','workspace-actions.html','workspace-analysis.html']:
 t=(r/name).read_text(errors='ignore')
 if '.from("synthesis_runs")' not in t:e.append(name+': saved Synthesis RLS fallback missing')

# Analysis trust must count the canonical participant_mode field returned by
# the normalization workspace-runs endpoint.
analysis=(r/'workspace-analysis.html').read_text(errors='ignore')
if 'normalizeVantage(r.vantage||r.participant_lens||r.participant_mode)' not in analysis:
 e.append('workspace-analysis.html: participant_mode trust mapping missing')

# Settings is narrower than RLS visibility: lists, usage, export, and mutations
# must remain explicitly constrained to the active Workspace organization.
try:
 runpy.run_path(str(r/'scripts/validate_workspace_settings_scope.py'))['validate']()
except Exception as exc:
 e.append('workspace Settings organization scoping: '+str(exc))

try:
 runpy.run_path(str(r/'scripts/validate_beta_compliance.py'))['validate']()
except Exception as exc:
 e.append('beta compliance implementation: '+str(exc))

invite=(r/'accept-invite.html').read_text(errors='ignore')
signin=(r/'signin.html').read_text(errors='ignore')
for token in ['You&rsquo;ve been invited to a Monderman workspace','No purchase or separate signup is required','Continue securely']:
 if token not in invite:e.append('signed-out invitation landing '+token)
for token in ['Accept your Monderman workspace invitation','Invited email address','Review the terms to join this workspace','invitationStatusMessage','invite_email_mismatch','invite_expired','invite_not_found','history.replaceState(null, ""','sessionStorage.removeItem(INVITE_STORAGE_KEY)']:
 if token not in signin:e.append('signed-out invitation sign-in '+token)
if 'Your account was not activated' in signin:e.append('signed-out invitation false activation error')
if signin.count('createClient(')!=1:e.append('sign-in shared Supabase client count')

try:
 subprocess.run(['node','scripts/diagnostic_completion_reliability_smoke.mjs'],cwd=r,check=True,capture_output=True,text=True)
except Exception as exc:
 e.append('diagnostic completion reliability: '+str(exc))

print('frontend release errors:',len(e))
for x in e:print('ERROR',x)
sys.exit(bool(e))
