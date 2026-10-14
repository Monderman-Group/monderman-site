"""Independent Python finite refinement/source/intent contract. No network or writes."""
import hashlib,json,re,subprocess,sys,os
from pathlib import Path
from site_design_coherence_20261014_inverse import source_at_site_design_coherence_baseline,source_paths_at_site_design_coherence_baseline,public_paths_at_site_design_coherence_baseline,public_source_at_site_design_coherence_baseline
from homepage_refinement_20261014_inverse import BASELINE,VERSION,_fixture as delta,FILES,ADDITIONS,GUARD_FILES,source_before_homepage_refinement_20261014 as strict,source_at_homepage_refinement_baseline as conditional,source_paths_at_homepage_refinement_baseline as paths_before,public_paths_at_homepage_refinement_baseline as public_before
ROOT=Path(__file__).resolve().parents[1];read=lambda f:source_at_site_design_coherence_baseline(f,(ROOT/f).read_bytes());sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT)
checks=negatives=hunks=immutable=fixtures=pdfs=0
def check(v,l):
 global checks
 assert v,l
 checks+=1
def reject(fn,l):
 global checks,negatives
 try:fn()
 except AssertionError:checks+=1;negatives+=1
 else:raise AssertionError(l)
check(BASELINE=='94cabdfe6fdd6b15e13ed15af2f6f2398e806fa9' and VERSION=='homepage-refinement-20261014.1','Exact public baseline/version')
check(delta['provisional'] is False,'Provisional cannot certify')
check(git('rev-parse',BASELINE+'^{tree}').decode().strip()=='ec0da7e2fd54467f10e78093229931ea26f9ffb1','Exact actual94cab tree')
expected=['index.html','public-search-index.json','scripts/marketing_photo_presentation_20261013_inverse.mjs','scripts/marketing_photo_presentation_20261013_inverse.py','scripts/marketing_photo_presentation_20261013_contract.mjs','scripts/marketing_photo_presentation_20261013_contract.py','scripts/marketing_completion_20261013_contract.mjs','scripts/marketing_completion_20261013_contract.py','scripts/marketing_refresh_20261012_contract.mjs','scripts/marketing_refresh_20261012_contract.py','scripts/public_sample_manifest_sensitivity_smoke.mjs','scripts/homepage_sample_discovery_smoke.mjs','scripts/sample_marketing_language_hover_smoke.mjs','scripts/sample_tile_smoke.mjs','scripts/public_sample_preview_binding_20260924_contract.mjs','scripts/homepage_report_quad_20260925_contract.mjs','scripts/refresh_public_sample_previews.mjs','scripts/homepage_sample_discovery_contract.mjs','scripts/marketing_completion_browser_smoke.mjs','scripts/marketing_refresh_browser_smoke.mjs','scripts/homepage_assistant_smoke.mjs','scripts/mobile_site_presentation_smoke.mjs','.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml']
check(list(FILES)==expected,'Only explicit index and exact historical/CI adapters')
check(list(ADDITIONS)==['homepage-refinement.css','homepage-refinement.js','scripts/homepage_refinement_20261014_browser.mjs'],'Only bounded new runtime and browser')
tracked=git('ls-tree','-r','--name-only',BASELINE).decode().splitlines();check(tracked==delta['baselineSourcePaths'],'Exact full source inventory')
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=''.join(BASELINE+':'+f+'\n' for f in tracked).encode());old={};at=0
for f in tracked:
 end=batch.index(b'\n',at);head=batch[at:end].decode();assert re.fullmatch(r'[a-f0-9]{40} blob \d+',head);n=int(head.split()[2]);at=end+1;old[f]=batch[at:at+n];at+=n;assert batch[at:at+1]==b'\n';at+=1
check(at==len(batch),'Complete exact Git blob framing')
for f in FILES:
 b=read(f);was=old[f];entry=delta['files'][f];check(sha(b)==entry['after_sha256'] and sha(was)==entry['before_sha256'],'Full current/before pins');check(bool(entry['replacements']) and sha(b)!=sha(was),'Actual finite diff only');encoded=b.decode().encode('utf-16-le');end=0
 for start,stop,now,before in entry['replacements']:
  check(isinstance(start,int) and isinstance(stop,int) and start>=end and stop>=start,'Ordered finite UTF16 hunk');check(encoded[start*2:stop*2].decode('utf-16-le')==now and isinstance(before,str),'Exact literal hunk');end=stop;hunks+=1
 for s in [b,b.decode()]:
  wanted=was if isinstance(s,bytes) else was.decode();check(strict(f,s)==wanted and type(strict(f,s)) is type(s),'Full strict baseline/type');check(conditional(f,s)==wanted and conditional(f,wanted)==wanted,'Conditional identity')
 mutants=[b+b'\n',b'!'+b[1:],was,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']+[encoded[:a*2].decode('utf-16-le').encode()+b'UNKNOWN'+encoded[z*2:].decode('utf-16-le').encode() for a,z,_,_ in entry['replacements']]
 for m in mutants:reject(lambda m=m:strict(f,m),'Unknown source/double inverse rejects');check(conditional(f,m)==m,'Unknown visible')
for f in tracked:
 if f in FILES:continue
 check(read(f)==old[f],'Every other actual94cab byte '+f);immutable+=1;fixtures+=int(f.startswith('scripts/fixtures/'));pdfs+=int(f.endswith('.pdf'))
for f in ADDITIONS:
 b=read(f);check(sha(b)==delta['additions'][f]['sha256'] and len(b)==delta['additions'][f]['bytes'],'Full raw addition pin');check(strict(f,b)==b,'Addition never erased');reject(lambda f=f,b=b: (_ for _ in ()).throw(AssertionError()) if sha(b+b'UNKNOWN')!=delta['additions'][f]['sha256'] else None,'Unknown addition edit rejects')
cached=git('ls-files','--cached').decode().splitlines();paths=set(cached+git('ls-files','--others','--exclude-standard').decode().splitlines());paths={p for p in paths if (ROOT/p).exists() and not(p=='node_modules' and p not in cached and (ROOT/p).is_symlink())}
paths=set(source_paths_at_site_design_coherence_baseline(paths))
def scope(rows):assert len(rows)==len(set(rows)) and sorted(rows)==sorted(tracked+list(ADDITIONS)+list(GUARD_FILES))
scope(paths);checks+=1;check(paths_before(paths)==set(tracked),'Only exact known source set projects')
for n in ['UNKNOWN.js','.env','assets/marketing/stock-original.jpg','font-package.zip','.render-public 2']:
 p=paths|{n};reject(lambda p=p:scope(p),'Unknown/private scope rejects');check(paths_before(p)==p,'Unknown scope remains visible')
check(paths_before(list(paths)+[next(iter(paths))])==list(paths)+[next(iter(paths))],'Duplicate scope never projected')
html=read('index.html').decode();css=read('homepage-refinement.css').decode();js=read('homepage-refinement.js').decode()
preview_wrapper='<details class="hf-hero-details"><summary class="hf-preview-toggle" aria-label="Expand or collapse sample preview"><span class="hf-preview-closed-label">Expand sample preview</span><span class="hf-preview-open-label">Collapse sample preview</span></summary><div class="hf-extra-grid">'
control='      <div class="hf-workflow-controls" aria-label="Illustration playback"><button class="hf-workflow-toggle" type="button" data-workflow-playback disabled>Static illustration</button></div>\n'
def index_intent(source):
 wanted=old['index.html'].decode();panels=''.join(re.findall(r'<section class="hrq-tile" data-quad-section="(?:money|change|evidence)"[\s\S]*?</section>',wanted));assert panels in wanted and len(re.findall(r'<section class="hrq-tile" data-quad-section="(?:money|change|evidence)"',wanted))==3
 wanted=wanted.replace(panels,preview_wrapper+panels+'</div></details>',1).replace('  <script src="marketing-photo-presentation.js?v=20261013.1" defer></script>\n','  <script src="marketing-photo-presentation.js?v=20261013.1" defer></script>\n  <link rel="stylesheet" href="homepage-refinement.css?v=20261014.1">\n  <script src="homepage-refinement.js?v=20261014.1" defer></script>\n',1).replace('<body class="canonical-green-shell homepage-enterprise marketing-refresh photo-presentation">','<body class="canonical-green-shell homepage-enterprise marketing-refresh photo-presentation homepage-refinement">',1).replace('      <div class="mr-lens-panels">\n',control+'      <div class="mr-lens-panels">\n',1)
 assert source==wanted and source.count(preview_wrapper)==1,'Only wrappers/control/token/assets; old copy and all panel/photo values exact'
index_intent(html);checks+=1
for a,b in [(control,''),(control,control+control),('data-workflow-playback disabled','data-workflow-playback'),('Static illustration','Generated result'),('View sample reports','Start evaluation'),(preview_wrapper,''),(preview_wrapper,preview_wrapper+preview_wrapper),('<details class="hf-hero-details">','<details class="hf-hero-details" open>'),('Expand or collapse sample preview','Guaranteed improvement')]:reject(lambda a=a,b=b:index_intent(html.replace(a,b,1)),'Missing/duplicate/static-open/false copy/CTA rejects')

def css_intent(source):
 for t in ['@media screen {','max-width: 640px','font-size: clamp(28px, 3.2vw, 44px)',':is(.latest-card, .latest-card-image, .hrq-tile, .hwd-app, .hwd-compact-tile) { border-radius: 2px !important; }','min-height: 44px',':focus-visible { outline: 3px solid #0C6E78','(prefers-reduced-motion: reduce)','@media print']:assert t in source,t
 assert not re.search(r'@import|@font-face|https?://|\b(?:animation|transition)\s*:[^;]*\binfinite\b',source,re.I)
 stripped=re.sub(r'/\*[\s\S]*?\*/','',source)
 for s in re.findall(r'([^{}]+)\{',stripped):
  s=s.strip()
  if s.startswith('@'):continue
  assert s.startswith('body.homepage-enterprise.homepage-refinement') and not re.search(r'\b(?:figure|picture|img)\b|\.mc-photo|\.mp-photo',s),'Every rule homepage-only; photos untouched'
css_intent(css);checks+=1
for a,b in [('max-width: 640px','max-width: 1400px'),('font-size: clamp(28px, 3.2vw, 44px)','font-size: 80px'),('border-radius: 2px !important','border-radius: 30px !important'),('min-height: 44px','min-height: 20px'),('body.homepage-enterprise.homepage-refinement','body'),('(prefers-reduced-motion: reduce)','(prefers-color-scheme: dark)')]:reject(lambda a=a,b=b:css_intent(css.replace(a,b)),'Wrong scale/corners/control scope/static CSS rejects')
trace_tokens=['paths.length !== 4','path.children.length !== 4','duration: 3000, delay: index * 3000','trace.animate(','const emphasis = step.animate([','animation?.finished?.catch?.(() => {});','emphasis?.finished?.catch?.(() => {});',"trace.setAttribute('aria-hidden', 'true')",'step.append(trace)','Promise.all(animations.map(animation => animation.finished))','animation.cancel()','animation.pause()','animation.play()','document.hidden','!visible.get(path)','manuallyPaused','!played.has(path)','visibilitychange','prefers-reduced-motion: reduce',"getPropertyValue('--mc-enhancement-style')",'beforeprint','afterprint','Pause illustration','Resume illustration','Replay illustration','Static illustration']
def motion_intent(source):
 for t in trace_tokens:assert t in source,t
 assert not re.search(r'\b(?:setInterval|setTimeout|fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|sendBeacon|localStorage|sessionStorage|document\.cookie|\.click\s*\(|dispatchEvent\s*\(|\bInfinity\b|iterations\s*:',source,re.I)
 assert len(re.findall(r'\.animate\(',source))==2 and not re.search(r'\b(?:innerHTML|outerHTML)\s*=|\.style\.[A-Za-z]+\s*=',source)
 emphasis=source[source.index('const emphasis = step.animate(['):source.index('if (!emphasis?.finished')]
 assert "backgroundColor: '#E8F0ED'" in emphasis and not re.search(r'transform|opacity',emphasis), 'Only stationary readable-copy background emphasis'
preview_tokens=["document.querySelector('body.homepage-refinement .hero .hf-hero-details')",'beforePrint = preview.open; preview.open = true','preview.open = beforePrint']
def preview_intent(source):
 hero=source[:source.index('/* A finite guide')]
 for t in preview_tokens:assert t in hero,t
 assert not re.search(r'\.hidden\s*=|setExpanded|innerHTML|outerHTML|\.remove\s*\(',hero)
preview_intent(js);checks+=1
for t in preview_tokens:reject(lambda t=t:preview_intent(js.replace(t,'REMOVED')),'Missing native print state restoration rejects')
reject(lambda:preview_intent(js.replace('if (!preview) return;','if (!preview) return; preview.hidden = true;')), 'Deferred initial hiding rejects')
motion_intent(js);checks+=1
reject(lambda:motion_intent(js.replace("{backgroundColor: '#E8F0ED', offset: .1}","{backgroundColor: '#E8F0ED', transform: 'translateY(20px)', offset: .1}")), 'Reading-copy movement in emphasis rejects')

for t in trace_tokens:reject(lambda t=t:motion_intent(js.replace(t,'REMOVED')),'Missing clock/control/offscreen/reduced/fault guard rejects')
for tail in ['setInterval(()=>{},1000);','fetch("/api/activate");','document.querySelector("[data-lens-choice]").click();','window.dispatchEvent(new Event("change"));']:reject(lambda t=tail:motion_intent(js+t),'Background/API/automatic lens injection rejects')
runtime=['marketing-refresh.css','marketing-refresh.js','marketing-completion.css','marketing-completion.js','marketing-photo-presentation.css','marketing-photo-presentation.js','homepage-refinement.css','homepage-refinement.js']
def budget(sizes):assert all(isinstance(n,int) and n>=0 for n in sizes) and sum(sizes)<=65536
budget([len(read(f)) for f in runtime]);checks+=1;reject(lambda:budget([len(read(f)) for f in runtime]+[65536]),'Runtime budget overshoot rejects')
discovery=read('scripts/homepage_sample_discovery_smoke.mjs').decode();hover=read('scripts/sample_marketing_language_hover_smoke.mjs').decode()
def current_consumers(d,h):
 action="await expandRefinedHeroForOriginalChecks(page,currentRefinement,name+'/'+width);"
 assert action in d and d.index(action)<d.index("for(const chart of await report.locator('[data-preview-kind]').all())")
 for t in ['isCurrentHomepageRefinementSource(refinementSource)','!refinementSource.toString().includes',"page.keyboard.press('Space')",'initial compact state','native expansion restores all four original sections','native summary works with or without scripts']:assert t in d,t
 for t in ["currentRefinement?['baseline','prior-current','current']",'body:priorRefinementHomepage',"expandRefinedHeroForOriginalChecks(page,currentRefinement&&edition==='current',key)",'assertRefinedOverview(geometry,width)','assertEnlargedOverview(geometry);checks++',"geometry.scoreFont,width<=600?46:52","geometry.findingFont>=21&&geometry.scoreFont>=58"]:assert t in h,t
current_consumers(discovery,hover);checks+=1
for t in ["await expandRefinedHeroForOriginalChecks(page,currentRefinement,name+'/'+width);",'isCurrentHomepageRefinementSource(refinementSource)',"page.keyboard.press('Space')"]:reject(lambda t=t:current_consumers(discovery.replace(t,'REMOVED'),hover),'Dropped native/known current identity rejects')
for t in ["currentRefinement?['baseline','prior-current','current']",'body:priorRefinementHomepage','assertEnlargedOverview(geometry);checks++',"geometry.findingFont>=21&&geometry.scoreFont>=58"]:reject(lambda t=t:current_consumers(discovery,hover.replace(t,'REMOVED')),'Dropped historical execution/assertion rejects')
tile_consumer=read('scripts/sample_tile_smoke.mjs').decode()
def tile_consumer_intent(source):
 for t in ['isCurrentHomepageRefinementSource(homepageBytes)',"currentRefinement?['baseline','prior-current','current']",'body:priorRefinementHomepage',"expandRefinedHeroForOriginalChecks(page,currentRefinement&&edition==='current'",'assertNativeRefinedPreview(geometry,viewport.width,label)','assertReadablePreview(geometry,viewport.width,label)','g.findingLeadFont>=21&&g.contentFont>=14','toggle.click()','native expansion restores all four original sections']:assert t in source,t
tile_consumer_intent(tile_consumer);checks+=1
for t in ['isCurrentHomepageRefinementSource(homepageBytes)','body:priorRefinementHomepage','assertReadablePreview(geometry,viewport.width,label)','assertNativeRefinedPreview(geometry,viewport.width,label)','g.findingLeadFont>=21&&g.contentFont>=14','toggle.click()']:reject(lambda t=t:tile_consumer_intent(tile_consumer.replace(t,'REMOVED')),'Missing native/historical tile proof rejects')
generator=read('scripts/refresh_public_sample_previews.mjs').decode()
generator_import="import {sourceAtHomepageRefinementBaseline} from './homepage_refinement_20261014_inverse.mjs';\n"
original_generator_read=" const filename=path.join(root,file), original=fs.readFileSync(filename,'utf8');"
current_generator_read=" const filename=path.join(root,file), raw=fs.readFileSync(filename,'utf8');\n // Exact native-layout compatibility applies only to the read-only check. Generation retains its original raw input/write behavior.\n const original=check?sourceAtHomepageRefinementBaseline(file,raw):raw;"
def generator_intent(source):
 wanted=old['scripts/refresh_public_sample_previews.mjs'].decode().replace("import {buildHomepageReportQuad} from './homepage_report_quad_20260925.mjs';\n","import {buildHomepageReportQuad} from './homepage_report_quad_20260925.mjs';\n"+generator_import,1).replace(original_generator_read,current_generator_read,1)
 assert source==wanted,'Only check-mode view; raw generation, pure math and artifact guards exact'
generator_intent(generator);checks+=1
for a,b in [('check?sourceAtHomepageRefinementBaseline(file,raw):raw','sourceAtHomepageRefinementBaseline(file,raw)'),('check?sourceAtHomepageRefinementBaseline(file,raw):raw','raw'),('else fs.writeFileSync(filename,next);','else fs.writeFileSync(filename,original);'),('readPublicSampleFixture({root})','readPublicSampleFixture({root:root+"/UNKNOWN"})')]:reject(lambda a=a,b=b:generator_intent(generator.replace(a,b,1)),'Removed check boundary/changed write or artifact scope rejects')
assistant=read('scripts/homepage_assistant_smoke.mjs').decode()
original_assistant_edition="const currentFivePhotoSource = sha(fs.readFileSync(path.join(root,'index.html'))) === '80364877594f6cf9e13cfe14bdfe2702838a2422680e902abc9bf613dff8c24d';"
current_assistant_edition="const currentFivePhotoSource = sha(sourceAtHomepageRefinementBaseline('index.html',fs.readFileSync(path.join(root,'index.html')))) === '80364877594f6cf9e13cfe14bdfe2702838a2422680e902abc9bf613dff8c24d';"
def assistant_edition_intent(source):
 wanted=old['scripts/homepage_assistant_smoke.mjs'].decode().replace("import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';\n","import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';\n"+generator_import,1).replace(original_assistant_edition,current_assistant_edition,1)
 assert source==wanted,'Only exact-index identity; all raw metadata/current DOM/widget/negative proof unchanged'
assistant_edition_intent(assistant);checks+=1
for a,b in [(generator_import,''),(current_assistant_edition,original_assistant_edition),(current_assistant_edition,current_assistant_edition.replace("'index.html'","'sample-report.html'")),(current_assistant_edition,current_assistant_edition.replace('sourceAtHomepageRefinementBaseline','sourceAtMarketingRefreshBaseline')),('if (currentFivePhotoSource) {','if (true) {'),('assertFivePhotoEditorialSequence(editorial.visibleSections, completionPhotos);',''),('assertCompletionEditorialSequence(editorial.visibleSections, completionPhotos);','')]:reject(lambda a=a,b=b:assistant_edition_intent(assistant.replace(a,b,1)),'Dropped/wrong/broad identity or bypassed actual/historical DOM proof rejects')
check(sha(conditional('index.html',read('index.html')))=='80364877594f6cf9e13cfe14bdfe2702838a2422680e902abc9bf613dff8c24d','Only exact raw native source recognizes canonical94cab current edition')
for raw in [read('index.html')+b'\nUNKNOWN',read('index.html').replace(b'mp-perspective-note',b'UNKNOWN',1)]:
 check(conditional('index.html',raw)==raw,'Unknown actual source remains raw');check(sha(conditional('index.html',raw))!='80364877594f6cf9e13cfe14bdfe2702838a2422680e902abc9bf613dff8c24d','Unknown raw source never selects current lane')
mobile=read('scripts/mobile_site_presentation_smoke.mjs').decode()
mobile_edits=[["import path from 'node:path';\n", "import path from 'node:path';\nimport {isCurrentHomepageRefinementSource} from './homepage_refinement_20261014_inverse.mjs';\n"], ["const sourceByPage = new Map(pages.map((name) => [name, fs.readFileSync(name, 'utf8')]));\n", "const sourceByPage = new Map(pages.map((name) => [name, fs.readFileSync(name, 'utf8')]));\nconst currentHomepageRefinement = isCurrentHomepageRefinementSource(sourceByPage.get('index.html'));\nasync function expandRefinedMobileHeroForOriginalChecks(tile) {\n  const details = tile.locator('.hf-hero-details'), summary = details.locator(':scope > summary');\n  assert.equal(await details.count(), 1, 'Exact refined hero has one native expansion');\n  assert.equal(await details.evaluate(el => el.open), false, 'Refined hero starts compact');\n  const panels = tile.locator('[data-quad-section]');\n  assert.deepEqual(await panels.evaluateAll(xs => xs.filter(el => el.checkVisibility()).map(el => el.dataset.quadSection)), ['findings'], 'Only the original finding is visible before expansion');\n  const touch = await summary.boundingBox();\n  assert.ok(touch && touch.width >= 44 && touch.height >= 44, 'Native expansion is a usable touch target');\n  await summary.click();\n  assert.equal(await details.evaluate(el => el.open), true, 'Real native summary click expands');\n  assert.deepEqual(await panels.evaluateAll(xs => xs.filter(el => el.checkVisibility()).map(el => el.dataset.quadSection)), ['findings','money','change','evidence'], 'All four original report panels are displayed for geometry checks');\n}\nasync function restoreRefinedMobileHero(tile) {\n  const details = tile.locator('.hf-hero-details');\n  await details.locator(':scope > summary').click();\n  assert.equal(await details.evaluate(el => el.open), false, 'Real native summary click restores compact state');\n  assert.deepEqual(await tile.locator('[data-quad-section]').evaluateAll(xs => xs.filter(el => el.checkVisibility()).map(el => el.dataset.quadSection)), ['findings'], 'Restored compact preview retains the visible original finding');\n}\n"], ['          const bounds = await tile.evaluate(el => {\n', '          if (currentHomepageRefinement) await expandRefinedMobileHeroForOriginalChecks(tile);\n          const bounds = await tile.evaluate((el, gridSelector) => {\n'], ["getComputedStyle(el.querySelector('.hrq-grid')).gridTemplateColumns.trim().split(/\\s+/).length", 'getComputedStyle(el.querySelector(gridSelector)).gridTemplateColumns.trim().split(/\\s+/).length'], ['          });\n          if (bounds.left < -1 || bounds.right > viewport.width + 1 || bounds.scroll > bounds.client + 1)', "          }, currentHomepageRefinement ? '.hf-extra-grid' : '.hrq-grid');\n          if (bounds.left < -1 || bounds.right > viewport.width + 1 || bounds.scroll > bounds.client + 1)"], ['          if (bounds.columns !== (viewport.width <= 600 ? 1 : 2)) failures.push(`${pageName}/${viewport.name}: hero report preview has the wrong responsive column count`);\n', '          if (bounds.columns !== (viewport.width <= 600 ? 1 : 2)) failures.push(`${pageName}/${viewport.name}: hero report preview has the wrong responsive column count`);\n          if (currentHomepageRefinement) await restoreRefinedMobileHero(tile);\n']]
def mobile_hero_intent(source):
 wanted=old['scripts/mobile_site_presentation_smoke.mjs'].decode()
 for before,after in mobile_edits:
  assert wanted.count(before)==1,'Exactly one original mobile seam'
  wanted=wanted.replace(before,after,1)
 assert source==wanted,'Only strict native expansion/actual grid selection/restoration; every original full-site and responsive bound/column check unchanged'
mobile_hero_intent(mobile);checks+=1
for a,b in [["import path from 'node:path';\nimport {isCurrentHomepageRefinementSource} from './homepage_refinement_20261014_inverse.mjs';\n", "import path from 'node:path';\n"], ["isCurrentHomepageRefinementSource(sourceByPage.get('index.html'))", 'true'], ["isCurrentHomepageRefinementSource(sourceByPage.get('index.html'))", 'false'], ["currentHomepageRefinement ? '.hf-extra-grid' : '.hrq-grid'", "currentHomepageRefinement ? '.hrq-grid' : '.hrq-grid'"], ['touch.height >= 44', 'touch.height >= 1'], ['await summary.click();', 'await details.evaluate(el => el.open = true);'], ["['findings','money','change','evidence']", "['findings']"], ['if (currentHomepageRefinement) await restoreRefinedMobileHero(tile);', ''], ['viewport.width <= 600 ? 1 : 2', 'viewport.width <= 600 ? 1 : 1'], ['bounds.scroll > bounds.client + 1', 'false']]:reject(lambda a=a,b=b:mobile_hero_intent(mobile.replace(a,b,1)),'Wrong identity/grid/control/visibility/native action or weakened original bound/column rejects')
refresh_browser=read('scripts/marketing_refresh_browser_smoke.mjs').decode()
def refresh_capture_intent(source):
 for token in ['isCurrentHomepageRefinementSource(rawHomepageSource)','Only exact approved native refinement selects current capture stability','Date.now()+3000','boxes.length!==4','Object.values(b).every(Number.isFinite)','b.width<=0||b.height<=0','scrollX,y:scrollY','Date.now()-stableSince>=200','await page.waitForTimeout(50)']:assert token in source,token
 assert source.count('if(nativeRefinedEdition)check(await savedLensFrameSettles(')==2
 assert source.index('preceding native scroll')<source.index("scrollIntoView({behavior: 'instant', block: 'center'})")<source.index('centered capture group')
refresh_capture_intent(refresh_browser);checks+=1
for t in ['Date.now()+3000','boxes.length!==4','Object.values(b).every(Number.isFinite)','b.width<=0||b.height<=0','scrollX,y:scrollY','Date.now()-stableSince>=200','if(nativeRefinedEdition)check(await savedLensFrameSettles(']:reject(lambda t=t:refresh_capture_intent(refresh_browser.replace(t,'REMOVED')),'Unbounded/dropped finite/positive/scroll stability/native gating rejects')
for f in ['.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml']:
 current=read(f).decode()
 for line in old[f].decode().splitlines():
  if re.search(r'node scripts/|python scripts/|timeout-minutes:|cancel-in-progress:',line):check(line in current,'Every original command/budget/concurrency retained')
 check('node scripts/homepage_refinement_20261014_contract.mjs' in current and 'python scripts/homepage_refinement_20261014_contract.py' in current,'Both new guards mandatory')
check('node scripts/homepage_refinement_20261014_browser.mjs' in read('.github/workflows/sample-report-marketing-certification.yml').decode(),'Actual current browser mandatory')
if '--built' in sys.argv:
 publish=ROOT/'.render-public';names=public_paths_at_site_design_coherence_baseline(sorted(str(p.relative_to(publish)) for p in publish.rglob('*') if p.is_file()));check(names==delta['currentPublicPaths'],'Full current build closure');check(public_before(names)==delta['baselinePublicPaths'],'Only exact current build projects');check(public_before(names+['UNKNOWN'])==names+['UNKNOWN'],'Unknown built name visible')
 for f in runtime:check(public_source_at_site_design_coherence_baseline(f,(publish/f).read_bytes())==read(f),'RAW current source and built runtime identity')
 check((publish/'public-search-index.json').read_bytes()==read('public-search-index.json'),'RAW current derived search source/built identity')
 check(control.strip() in (publish/'index.html').read_text() and 'homepage-refinement.js?v=20261014.1' in (publish/'index.html').read_text(),'Actual built native controls/assets')
 check(json.loads((publish/'.well-known/monderman-release.json').read_text())['revision']==os.environ.get('RENDER_GIT_COMMIT'),'Actual local/CI marker')
print(json.dumps({'ok':True,'checks':checks,'negativeControls':negatives,'finiteFiles':len(FILES),'hunks':hunks,'immutableFiles':immutable,'historicalFixtures':fixtures,'pdfs':pdfs,'runtimeBytes':sum(len(read(f)) for f in runtime),'built':'--built' in sys.argv,'networkCalls':0,'productionWrites':0}))
