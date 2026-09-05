from pathlib import Path
import hashlib,os,re,runpy,subprocess,sys
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
 for m in re.finditer(r'<a\b[^>]*\baria-label=["\']Monderman on LinkedIn["\'][^>]*>',t,re.I):
  href=re.search(r'\bhref=["\']([^"\']+)["\']',m.group(0),re.I)
  if not href or href.group(1)!='https://www.linkedin.com/company/monderman':e.append(p.name+": footer LinkedIn target")
 if 'class="footer mond-footer"' in t and '<a href="https://www.linkedin.com/company/monderman" target="_blank" rel="noopener">LinkedIn</a>' not in t:e.append(p.name+": visible footer LinkedIn link")

about=(r/'about.html').read_text(errors='ignore')
if '<a href="https://www.linkedin.com/company/monderman" target="_blank" rel="noopener">Follow Monderman on LinkedIn</a>' not in about:e.append('about LinkedIn follow link')

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
if re.search(r'<h1\b',s,re.I):e.append('sample static h1 competes with generated report title')
if 'class="sample-library-heading" role="heading" aria-level="2"' not in s:e.append('sample library heading hierarchy')
if '<h1 class="mr-cover-title">' not in (r/'monderman-report.js').read_text(errors='ignore'):e.append('generated report h1')
if s.count('aria-label="Jump to report section"')<4:e.append('sample selects')
for k in ['os','dv','sc','ip','synthesis','depth']:
 if f'aria-controls="report-{k}"' not in s or f'role="tabpanel"' not in s:e.append('sample tabs '+k)
for token in ["t.tabIndex = on ? 0 : -1", "event.key === 'ArrowRight'", "event.key === 'ArrowLeft'", "event.key === 'Home'", "event.key === 'End'", 'nextTab.focus()']:
 if token not in s:e.append('sample roving tab behavior '+token)

for name in ['index.html','sample-report.html','roi.html','privacy.html','security.html']:
 t=(r/name).read_text(errors='ignore')
 if len(re.findall(r'<main\b',t,re.I))!=1 or len(re.findall(r'</main>',t,re.I))!=1:e.append(name+': single main landmark')
 if 'class="skip-link" href="#main-content"' not in t or 'id="main-content"' not in t:e.append(name+': keyboard skip link')
site=(r/'sitemap.xml').read_text()
for x in ['roi.html','plan-signal.html','plan-pattern.html','plan-enterprise.html']:
 if x not in site:e.append('sitemap '+x)
pr=(r/'platform-services.html').read_text()
for x in ['unlimited people','People you can ask, per year']:
 if x in pr:e.append('pricing '+x)
if 'payment,,' in (r/'security.html').read_text():e.append('double comma')

# Every participant-visible Diagnostic report must disclose the exact sizing
# inputs, attribution share, capacity treatment, and recoverable-share logic.
for name in ['structural-clarity.html','decision-velocity.html','operational-systems.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 for token in [
  'function buildExposureMethodDisclosure(exposure)',
  'function exposureAssumptionRows(exposure)',
  '${buildExposureMethodDisclosure(result?.exposure)}',
  '...exposureAssumptionRows(result?.exposure)',
  'Burden attribution*',
  'Capacity assumption*',
  'Recoverable share*',
 ]:
  if token not in t:e.append(name+': complete exposure-method disclosure '+token)
 # Keep the final methodology disclosure from overflowing into the fixed PDF
 # footer. The closing product-fit copy owns a separate fixed-size PDF page.
 for token in [
  '${footer(methodPageNumber + 1)}',
  '<p class="eyebrow">How Monderman fits</p><h2>Where Monderman fits</h2>',
 ]:
  if token not in t:e.append(name+': executive PDF final-page pagination '+token)

# Surgical regression guards added 2026-08-13.
idx=(r/'index.html').read_text(errors='ignore')
if '<body class="canonical-green-shell">' not in idx:
 e.append('homepage canonical shell scope missing')

# Canonical publishing system: the homepage rail uses one editorial language
# with four publication surfaces, and Research keeps the Book before the series.
latest_match=re.search(r'<div class="latest-track" id="latestTrack">(.*?)</div>\s*</div>\s*<div aria-label="Latest content position"',idx,re.I|re.S)
if not latest_match:
 e.append('homepage research carousel boundary missing')
else:
 latest=latest_match.group(1)
 if len(re.findall(r'<article class="latest-card category-(?:research|insight|brief|perspective)"',latest))!=15:e.append('homepage research carousel card count')
 if latest.count('latest-card-image latest-card-image--placeholder')!=15:e.append('homepage research carousel canonical cover count')
 if latest.count('placeholder-cover-type')!=15:e.append('homepage research carousel category label count')
 if latest.count('latest-card-link')!=15:e.append('homepage research carousel full-card link count')
 if latest.count('latest-card-secondary-link')!=13:e.append('homepage research carousel PDF action count')
 for href in re.findall(r'class="latest-card-link" href="([^"]+)"',latest):
  clean_href=href.split('?',1)[0]
  if not clean_href.endswith('.html'):e.append('homepage carousel primary route is not HTML '+href)
  elif not (r/clean_href).exists():e.append('homepage carousel primary route missing '+href)
 if 'latest-card-image"><img' in latest:e.append('homepage research carousel legacy image tile remains')
 for token in ['Built to Please','Why Consumer AI Tells You What You Want to Hear','Series, Part 3','Monderman_Insight_Built_to_Please_2026-09-02.pdf']:
  if token not in latest:e.append('homepage Built to Please card '+token)
 new_perspective_pos=latest.find('<h3 class="latest-card-title">We Gave Bureaucracy the Fastest Tools in History. It Got Slower.</h3>')
 unmeasured_pos=latest.find('<h3 class="latest-card-title">The Unmeasured Layer</h3>')
 if not (0<=new_perspective_pos<unmeasured_pos):e.append('homepage new perspective placement')
 series_cards=['Merit After the Machine','Every Node for Itself','Built to Please']
 series_positions=[latest.find('<h3 class="latest-card-title">'+title+'</h3>') for title in series_cards]
 if not (all(pos>=0 for pos in series_positions) and series_positions==sorted(series_positions)):
  e.append('homepage series carousel reading order')
 for part in ['Series, Part 1','Series, Part 2','Series, Part 3']:
  if latest.count(part)!=1:e.append('homepage series carousel chip '+part)
 for category,expected in [('insight',7),('brief',5),('perspective',3)]:
  count=latest.count(f'data-category="{category}"')
  if count!=expected:e.append(f'homepage {category} category count {count}, expected {expected}')
 if 'data-category="research"' in latest:e.append('homepage current work falsely classified as Research')
for token in ['linear-gradient(180deg, #103B44 0%, #0B343D 55%, #04282F 100%)','color: #9CC4C9;','background: #0E3A44;']:
 if token not in idx:e.append('homepage canonical research tile style '+token)
for token in ['.latest-card.category-insight {','.latest-card.category-brief {','.latest-card.category-perspective {','.latest-card.category-research {','Research, insights, briefs, and perspectives']:
 if token not in idx:e.append('homepage publication taxonomy '+token)
for token in ['.latest-card-link::after {','position: absolute;','inset: 0;','.latest-card:focus-within {']:
 if token not in idx:e.append('homepage full-card carousel interaction '+token)
for forbidden in [
 '.latest-track .latest-card:nth-child(n+4){display:none;}',
 '.latest-controls,.latest-dots{display:none!important;}',
 'grid-template-columns:repeat(3,minmax(0,1fr))!important;',
]:
 if forbidden in idx:e.append('homepage research carousel disabled by '+forbidden)
if 'justify-items: start;' not in idx or 'text-align: left;' not in idx:
 e.append('homepage research tile top-left editorial alignment')
for token in [
 'clone.classList.add("is-carousel-clone");',
 'latestTrack.prepend(leading);',
 'latestTrack.append(trailing);',
 'latestIndex = (latestIndex + direction + latestCardCount) % latestCardCount;',
 'latestTrack?.addEventListener("transitionend"',
]:
 if token not in idx:e.append('homepage continuous research carousel '+token)
for token in [
 '.latest-track .latest-card { visibility: hidden; }',
 '.latest-track .latest-card:first-child { visibility: visible; }',
 '.latest-viewport.is-ready .latest-card { visibility: visible; }',
]:
 if token not in idx:e.append('homepage research carousel no-script phone guard '+token)

research=(r/'research.html').read_text(errors='ignore')
for token in ['We Gave Bureaucracy the Fastest Tools in History. It Got Slower.','The Unmeasured Layer','AI and Institutions','Three papers, one story.','Part 1','Part 2','Part 3','17 items · Updated September 2026','HTML + PDF · 8 documents']:
 if token not in research:e.append('research series contract '+token)
if research.count('<article class="series-card">')!=3:e.append('research series card count')
book_pos=research.find('<section class="book-feature">')
series_pos=research.find('<section class="series"')
library_pos=research.find('<section class="library">')
if not (0<=book_pos<series_pos<library_pos):e.append('research Book/series/library order')
commentary_pos=research.find('id="bureaucracy-tools-title"')
unmeasured_pos=research.find('id="unmeasured-layer-title"')
if not (0<=commentary_pos<unmeasured_pos<series_pos):e.append('research commentary/Unmeasured Layer/AI order')
series_quote='Fluency becomes evidence, outside checking becomes overhead, and agreement begins to look like truth.'
series_quote_pos=research.find(series_quote)
if not (series_pos<series_quote_pos<library_pos):e.append('research series pull quote placement')
if 'aria-label="AI and Institutions series pull quote"' not in research:e.append('research series pull quote semantics')
series_titles=['Merit After the Machine','Every Node for Itself','Built to Please']
series_title_positions=[research.find('<h3 class="series-card-title">'+title+'</h3>') for title in series_titles]
if not (all(pos>=0 for pos in series_title_positions) and series_title_positions==sorted(series_title_positions)):
 e.append('research series reading order')
for token in ['border-left: 4px solid #0E3A44;','linear-gradient(90deg, #103B44 0%, #0B343D 55%, #04282F 100%)']:
 if token not in research:e.append('research series visual grouping '+token)
if '<span>Enterprise</span><span>Brief · HTML + PDF</span></div>\n          <h3 class="paper-title">How Workarounds Preserve Output While Masking Dysfunction</h3>' not in research:
 e.append('research Compensatory Systems Brief label')
if research.count('<span>Perspective</span><span>HTML')!=3:
 e.append('research Perspective label count')
for forbidden in ['.paper-card.category-insight {','.paper-card.category-brief {','.essay-card.category-perspective {','.paper-card.category-research {','data-category="insight"','data-category="brief"','data-category="perspective"']:
 if forbidden in research:e.append('research page presentation must remain canonical '+forbidden)
research_primary_hrefs=re.findall(r'class="(?:series-action|paper-action) publication-primary-link" href="([^"]+)"',research)
research_secondary_hrefs=re.findall(r'class="(?:series-action|paper-action) publication-secondary-link" href="([^"]+)"',research)
if len(research_primary_hrefs)!=16:e.append('research full-card HTML link count')
if len(research_secondary_hrefs)!=14:e.append('research independent secondary link count')
for href in research_primary_hrefs:
 clean_href=href.split('?',1)[0]
 if not clean_href.endswith('.html'):e.append('research primary route is not HTML '+href)
 elif not (r/clean_href).exists():e.append('research primary route missing '+href)
for token in ['.publication-primary-link::after {','inset: 0;','z-index: 2;','.publication-secondary-link {','z-index: 4;']:
 if token not in research:e.append('research full-card interaction '+token)

publication_editions={
 'merit-after-the-machine.html':('Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf',4),
 'every-node-for-itself.html':('Monderman_Insight_Every_Node_for_Itself_2026-09-02.pdf',3),
 'built-to-please.html':('Monderman_Insight_Built_to_Please_2026-09-02.pdf',4),
 'terminal-fidelity.html':('Terminal_Fidelity.pdf',5),
 'accumulated-drag-department-of-war.html':('Monderman_Brief_Accumulated_Drag_Department_of_War_2026-09-02.pdf',2),
 'quarter-trillion-friction-us-healthcare.html':('Monderman_Brief_Quarter_Trillion_Dollar_Friction_US_Healthcare.pdf',6),
 'from-tokens-to-outcomes.html':('Monderman_Insight_After_the_First_Lap.pdf',6),
 'compensatory-systems.html':('Monderman_Brief_Compensatory_Systems.pdf',4),
 'when-bureaucracy-became-the-obstacle.html':('Monderman_Brief_The_Collapse_of_Eastman_Kodak.pdf',5),
 'the-culture-trap-brief.html':('Monderman_Brief_The_Culture_Trap.pdf',9),
 'the-art-of-interior-reasoning.html':('Monderman_Insight_The_Art_of_Interior_Reasoning.pdf',5),
}
search_index=(r/'public-search-index.json').read_text(errors='ignore')
sitemap_text=(r/'sitemap.txt').read_text(errors='ignore')
publication_css=(r/'publication-html.css').read_text(errors='ignore') if (r/'publication-html.css').exists() else ''
if 'font-size: 64px;' not in publication_css:e.append('publication hero desktop type scale')
for name,(pdf_name,figure_count) in publication_editions.items():
 t=(r/name).read_text(errors='ignore') if (r/name).exists() else ''
 if not t:
  e.append('publication HTML edition missing '+name)
  continue
 for token in [
  f'rel="canonical" href="https://www.monderman.com/{name}"',
  'class="article-body"','id="references-heading">References</h2>',
  'class="footer mond-footer"','aria-label="Monderman on LinkedIn"',
  'aria-label="Monderman on X"','aria-label="Monderman on Facebook"',
  '<script src="assistant.js?v=20260828-footer-dock4" defer></script>',
  '<script src="contact-transport.js?v=20260903-contact1" defer></script>',
  '<script src="connect-widget.js?v=20260903-contact1" defer></script>',
  f'href="{pdf_name}?',
 ]:
  if token not in t:e.append(name+': complete web-edition contract '+token)
 if t.count('<figure>')!=figure_count:e.append(name+': figure count')
 if t.count('<li>')<3:e.append(name+': reference count')
 if name not in site or name not in sitemap_text:e.append(name+': sitemap coverage')
 if f'"url":"{name}"' not in search_index:e.append(name+': search coverage')
for name in ['we-gave-bureaucracy-the-fastest-tools.html','the-unmeasured-layer.html']:
 t=(r/name).read_text(errors='ignore')
 for script in ['assistant.js?v=20260828-footer-dock4','contact-transport.js?v=20260903-contact1','connect-widget.js?v=20260903-contact1']:
  if f'<script src="{script}" defer></script>' not in t:e.append(name+': publication widget '+script)
built_pdf=r/'Monderman_Insight_Built_to_Please_2026-09-02.pdf'
if not built_pdf.exists():
 e.append('Built to Please PDF missing')
elif hashlib.sha256(built_pdf.read_bytes()).hexdigest()!='bf112b264e0978df9fd12b9c20b3d933942794911d7b25e3fec22304f1a1f7d8':
 e.append('Built to Please canonical PDF bytes changed')
for stale in ['exactly as the engine renders it','Every read returns the result in your numbers','Monderman is the instrument that surfaces where these losses originate']:
 if stale in idx:e.append('homepage unsupported claim '+stale)
for required in ['measured operating conditions associated with observed administrative burden','when supported by disclosed sizing inputs','When the required sizing inputs are present and valid']:
 if required not in idx:e.append('homepage bounded claim '+required)
signal=(r/'plan-signal.html').read_text(errors='ignore')
enterprise=(r/'plan-enterprise.html').read_text(errors='ignore')
for stale in ['What no study and no chatbot can do','A cadence no study can match']:
 if stale in signal:e.append('Signal competitive absolute '+stale)
if 'calibration, validation, and comparability requirements defined explicitly' not in enterprise:
 e.append('Enterprise bespoke-instrument qualification')
diagnostics=(r/'diagnostics.html').read_text(errors='ignore')
for stale in ['Under Development','Privacy Policy']:
 if stale in diagnostics:e.append('Diagnostics stale public state '+stale)

# The two compact promotional report placements must remain a defensible
# composite of generated Depth output. Keep the data contract, the responsive
# layout, and the whole-card route aligned while keeping the dense preview
# off phone screens, where the architectural hero is the clearer lure.
brief=(r/'Monderman_Platform_Brief.html').read_text(errors='ignore')
sample_tile_css=(r/'sample-report-tile.css').read_text(errors='ignore') if (r/'sample-report-tile.css').exists() else ''
lure_tile_css=(r/'monderman-depth-lure-tile.css').read_text(errors='ignore') if (r/'monderman-depth-lure-tile.css').exists() else ''
tile_required=[
 'sample-report-tile.css?v=20260824-depth4',
 'monderman-depth-lure-tile.css?v=20260825-mobile4',
 'class="hero-report-proof has-sample-depth-tile"',
 'id="monderman-depth-lure-composite"',
 'class="md-tile"',
 'class="md-opening"',
 'class="md-exposure-track"',
 'class="md-vantage-row"',
 'href="sample-report.html"',
 'Depth Synthesis',
 'Observed exposure ranges',
 '4,800','7,900','6,100',
 '$432,000','$711,000','$549,000','$120,000','$210,000',
 '49.5','56.8','65.3',
 'Fix the ownership transfer point.',
]
for name,text in [('index.html',idx),('Monderman_Platform_Brief.html',brief)]:
 for token in tile_required:
  if token not in text:e.append(name+': generated-output sample tile '+token)
 tile_match=re.search(r'<aside class="hero-report-proof has-sample-depth-tile".*?</aside>',text,re.I|re.S)
 if not tile_match:
  e.append(name+': generated-output sample tile boundary missing')
 else:
  tile=tile_match.group(0)
  for stale in ['5,280 hrs','$411,840','$123,552','hrp-recovery-ring','hrp-composition-bars','sample-depth-tile-approved-image','sample-depth-synthesis-composite-approved.png']:
   if stale in tile:e.append(name+': stale promotional sample tile value '+stale)
if not sample_tile_css:
 e.append('generated-output sample tile stylesheet missing')
else:
 if r'\n' in sample_tile_css:
  e.append('generated-output sample tile stylesheet contains escaped newline corruption')
 for token in [
  '.hero-report-proof.has-sample-depth-tile',
  '.hero-report-proof.has-sample-depth-tile .hero-report-link{display:block;}',
 ]:
  if token not in sample_tile_css:e.append('generated-output sample tile responsive contract '+token)
if not lure_tile_css:
 e.append('in-chat source sample tile stylesheet missing')
else:
 for token in [
  '#monderman-depth-lure-composite',
  'width:min(100%,580px)',
  'grid-template-columns:112px minmax(0,1fr)',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  'left:60.76%',
  'left:77.22%',
  'grid-template-columns:92px minmax(130px,1fr) 136px',
  '.md-foot{',
  'display:none',
  'min-height:calc(100svh - 128px)',
  '@media (max-width:640px)',
  'object-position:48.75% 50%!important',
  '@container monderman-composite (max-width:520px)',
 ]:
  if token not in lure_tile_css:e.append('in-chat source sample tile contract '+token)
if '<script src="assistant.js?v=20260828-footer-dock4" defer></script>' not in idx:
 e.append('homepage assistant loader missing')
if re.search(r'^\s*#mnd-launcher\s*\{[^}]*display\s*:\s*none',idx,re.I|re.M):
 e.append('homepage assistant launcher hidden')
for token in ['body:has(#mnd-panel.mnd-open) .mdn-cn-launch','body:has(#mdn-cn-panel.mdn-cn-open) #mnd-launcher']:
 if token not in idx:e.append('homepage assistant/Connect collision guard '+token)
canonical_shell=(r/'canonical-site-shell.js').read_text(errors='ignore')
canonical_css=(r/'canonical-site-shell.css').read_text(errors='ignore')
assistant_source=(r/'assistant.js').read_text(errors='ignore')
public_header_pages=[]
public_header_css_versions=set()
public_header_js_versions=set()
for page in r.glob('*.html'):
 t=page.read_text(errors='ignore')
 if 'id="siteHeader"' in t:
  public_header_pages.append(page.name)
  if '<body class="canonical-green-shell' not in t:e.append(page.name+': canonical header shell scope missing')
  css_version=re.search(r'canonical-site-shell\.css\?v=([^"\']+)',t)
  js_version=re.search(r'canonical-site-shell\.js\?v=([^"\']+)',t)
  if not css_version:e.append(page.name+': versioned canonical header styles missing')
  elif not re.match(r'^(?:privacy|terms)(?:-\d{4}-\d{2}-\d{2}-beta)?\.html$',page.name):public_header_css_versions.add(css_version.group(1))
  if not js_version:e.append(page.name+': versioned canonical header behavior missing')
  elif not re.match(r'^(?:privacy|terms)(?:-\d{4}-\d{2}-\d{2}-beta)?\.html$',page.name):public_header_js_versions.add(js_version.group(1))
if not public_header_pages:e.append('canonical public headers missing')
if len(public_header_css_versions)!=1:e.append('canonical public header style versions diverge: '+str(sorted(public_header_css_versions)))
if len(public_header_js_versions)!=1:e.append('canonical public header behavior versions diverge: '+str(sorted(public_header_js_versions)))
if 'past-hero' in idx or 'past-hero' in canonical_css or 'past-hero' in canonical_shell:
 e.append('homepage-only past-hero header state remains')
for token in ['font-size:.975rem;line-height:1.2;font-weight:500','font-size:.9375rem;line-height:1.2;font-weight:500']:
 if token not in canonical_css:e.append('canonical header type scale '+token)
compact_header_contract={
 'cross-tool-synthesis.html':'font-size:.975rem;line-height:1.2;font-weight:500',
 'checkout.html':'font-size:.9375rem;line-height:1.2',
 'pattern-trial.html':'font-size:.9375rem;line-height:1.2',
 'workspace.html':'text-decoration:none;font-size:15px;font-weight:450',
 'workspace-actions.html':'text-decoration:none;font-size:15px',
 'workspace-analysis.html':'text-decoration:none;font-size:15px',
 'workspace-diagnostics.html':'text-decoration:none;font-size:15px',
 'workspace-settings.html':'text-decoration:none;font-size:15px',
}
for name,token in compact_header_contract.items():
 if token not in (r/name).read_text(errors='ignore'):e.append(name+': readable compact header type scale missing')
if 'if (!document.body.classList.contains("canonical-green-shell"))' not in assistant_source:
 e.append('assistant legacy header fallback overrides canonical mobile navigation')
for token in ['site-menu-button','aria-label", "Open navigation','mobile-nav-open','closeMobileNav','event.key === "Escape"']:
 if token not in canonical_shell:e.append('public mobile navigation behavior '+token)
for token in ['@media(max-width:1180px)','header.mobile-nav-open .nav','width:44px;height:44px','display:none;width:100%','nav .nav-menu.is-open .nav-dropdown']:
 if token not in canonical_css:e.append('public mobile navigation layout '+token)
if 'data-count-type="plain-plus" data-target="7000"' not in idx or 'type === "plain-plus"' not in idx or 'toLocaleString("en-US")' not in idx:
 e.append('homepage 7000+ counter formatting')
if re.search(r'<img[^>]*?/\s+loading="lazy">',idx,re.I):
 e.append('malformed homepage lazy-load img markup')
for name in ['decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 for token in ['cover-motif','stroke-dasharray="5,9"']:
  if token in t:e.append(name+': retired concentric-ring motif '+token)
 if 'This usually takes about one to two minutes.' not in t or 'Please allow up to two minutes and keep this window open.' not in t:
  e.append(name+': truthful finalization expectation')
 if 'takes just a few seconds' in t or 'This usually takes a few seconds' in t:
  e.append(name+': stale finalization expectation')
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
if (r/'Monderman_Report_Motif.png').exists():
 e.append('retired concentric-ring motif asset remains public')
for name in ['index.html','roi.html','why-monderman.html','connect.html','diagnostics.html']:
 if re.search(r'\.footer-motif\s*\{',(r/name).read_text(errors='ignore')):
  e.append(name+': retired footer motif styling remains')

# Pattern beta trial contract: no card, identity-scoped one-use, non-renewing.
trial=(r/'pattern-trial.html').read_text(errors='ignore')
for token in ['Use the full Pattern Workspace for 30 days.','No card is required to start','does not renew automatically','/api/billing/start-pattern-trial','/api/billing/pattern-pilot-invitation','pattern_trial_already_used','trial_requires_admin','Nothing was charged','One Pattern pilot per eligible account identity','Deleting or replacing a Workspace does not reset eligibility','ackStart','starts immediately when I continue','Your saved work is retained. Standard Trial access limits apply after day 30','Pattern &middot; Private 30-day pilot','id="pilotInvitation"','id="workspaceName"','sb.rpc("bootstrap_my_workspace"','JSON.stringify({organization_id:organizationId})','pattern_pilot_invitation_required','email-bound invitation']:
 if token not in trial:e.append('pattern trial contract '+token)
for stale in ['One Pattern trial per Workspace','starts immediately for this Workspace','This Workspace has already used its one-time Pattern trial','id="pilotInvitationCode"','invitation_code:invitationCode','reusable invitation code']:
 if stale in trial:e.append('pattern trial stale scope '+stale)
pattern=(r/'plan-pattern.html').read_text(errors='ignore')
for token in ['href="pattern-trial.html"','Accept pilot invitation','personalized Monderman invitation at their work email','no organization is assigned in advance','No card required','does not renew automatically','One pilot per eligible account identity','Deleting or replacing a Workspace does not reset eligibility','Pattern &middot; Public Beta']:
 if token not in pattern:e.append('pattern trial entry '+token)
shell=(r/'workspace-shell.js').read_text(errors='ignore')
for token in ['subscription_status','pattern_trial_ends_at','org.subscription_status === "trialing"','Pattern trial · ${days} day']:
 if token not in shell:e.append('pattern trial shell '+token)

# Private pilot feedback must remain identity-scoped, optional, context-light,
# and visibly distinct from the public/general feedback channel.
pilot_feedback=(r/'pilot-feedback.html').read_text(errors='ignore') if (r/'pilot-feedback.html').exists() else ''
feedback_widget=(r/'feedback-widget.js').read_text(errors='ignore')
if not pilot_feedback:
 e.append('private pilot feedback page missing')
else:
 for token in [
  'name="robots" content="noindex,nofollow,noarchive"',
  '/api/pilot-feedback/access',
  '/api/pilot-feedback',
  'sb.auth.getUser()',
  'sb.auth.getSession()',
  'location.replace("signin.html?next="',
  'id="feedbackForm" hidden',
  'Pilot feedback is not available for this account.',
  'is available only to verified Pattern pilot Workspace members',
  'Diagnostic answers, scores, reports, billing information, and authentication data are never attached.',
  'source_path:location.pathname',
  'idempotency_key:idempotencyKey',
 ]:
  if token not in pilot_feedback:e.append('private pilot feedback contract '+token)
 for forbidden in ['name="email"','access_token:','session_id:','diagnostic_answers:','report_content:','billing_details:']:
  if forbidden in pilot_feedback:e.append('private pilot feedback forbidden browser field '+forbidden)
 if 'pilot-feedback.html' in site:e.append('private pilot feedback page leaked into public sitemap')
for token in [
 'https://monderman-api.onrender.com/api/feedback',
 'https://monderman-api.onrender.com/api/pilot-feedback/access',
 'function isWorkspaceSurface()',
 'function markPilotFeedbackEntry()',
 "label.textContent = 'Pilot feedback'",
 "location.href = 'pilot-feedback.html?surface='",
 'window.mondermanOpenFeedback = openFeedbackExperience',
]:
 if token not in feedback_widget:e.append('pilot feedback Workspace entry '+token)

# Restrained Beta labeling belongs to the app shell and plan/trial pages, not outputs.
for name in ['workspace.html','workspace-diagnostics.html','workspace-analysis.html','workspace-actions.html','workspace-settings.html']:
 if 'ws-beta-release' not in (r/name).read_text(errors='ignore'):
  e.append(name+': beta badge missing')
for name in ['sample-report.html','decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 if re.search(r'>\s*Beta\s*<|Public Beta|beta release',t,re.I):e.append(name+': beta label on diagnostic/report output')

# Contact submissions prefer a first-party hostname, probe before the single
# POST, and retain the Render hostname only as a reachability fallback.
contact_transport=(r/'contact-transport.js').read_text(errors='ignore') if (r/'contact-transport.js').exists() else ''
for token in ['https://api.monderman.com','https://monderman-api.onrender.com','/api/health','/api/connect/send','requestId','AbortController']:
 if token not in contact_transport:e.append('contact transport contract '+token)
connect_widget=(r/'connect-widget.js').read_text(errors='ignore')
for token in ['function getTransport()','contact-transport.js?v=20260903-contact1','MondermanContactTransport']:
 if token not in connect_widget:e.append('connect widget transport contract '+token)
for name in ['connect.html','plan-enterprise.html']:
 t=(r/name).read_text(errors='ignore')
 if 'MondermanContactTransport.submit' not in t:e.append(name+': resilient contact transport missing')
 if 'fetch("https://monderman-api.onrender.com/api/connect/send"' in t:e.append(name+': direct third-party contact POST remains')

# Public beta privacy/security disclosures must match current architecture and trial rules.
privacy=(r/'privacy.html').read_text(errors='ignore')
for token in ['Last updated: August 26, 2026','currently in public beta','one-time Pattern-trial anti-abuse record','survive Workspace deletion','Anthropic\'s commercial API','not used to train its models by default','automatically deleted from its backend within 30 days','Stripe handles payment details','does not receive or store your full card number','anonymous campaign responses','authorized Monderman personnel','first-party browser storage for Supabase authentication','not directed to children','a South Dakota limited liability company','41 W Highway 14, Unit #1225','Spearfish, SD 57783']:
 if token.lower() not in privacy.lower():e.append('privacy disclosure '+token)
security=(r/'security.html').read_text(errors='ignore')
for token in ['currently in public beta','Ordinary Diagnostics require a signed-in member session','Directed campaign assignment links','All public Postgres tables currently have row-level security enabled','public publishable key','service-role database credentials','Anthropic\'s commercial API','durable one-time redemption record','Deleting a Workspace therefore does not create another trial','does not currently claim SOC 2','four-hour cutoff','durable Supabase snapshot','plan, usage, billing and stored Diagnostic result fields remain server-managed','request-size and rate limits','Controlled release checks currently cover current Chrome/Chromium and automated WebKit rendering','Native Safari and browser-managed print dialogs remain beta and best-effort']:
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
for token in ['Public Beta Terms of Use','Version 2026-08-26-beta','does not auto-renew','once per eligible account identity','not legal, medical, accounting, investment, safety, employment','not designed, validated or offered as employee-selection procedures','must not attempt to identify an anonymous Participant','The Customer will defend, indemnify and hold harmless Monderman','a South Dakota limited liability company','41 W Highway 14, Unit #1225','Spearfish, SD 57783','connect@monderman.com','privacy.html','security.html']:
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

try:
 runpy.run_path(str(r/'scripts/validate_legal_terms_protection.py'))['validate']()
except Exception as exc:
 e.append('legal terms protection: '+str(exc))

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
