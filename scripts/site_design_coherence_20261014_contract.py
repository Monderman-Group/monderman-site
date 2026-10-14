"""Independent raw/source/compiled design approval; no provider calls or writes."""
import hashlib,json,re,subprocess,sys,os
from pathlib import Path
from site_design_coherence_20261014_inverse import BASELINE,VERSION,_fixture as delta,FILES,ADDITIONS,GUARD_FILES,source_before_site_design_coherence_20261014 as strict,source_at_site_design_coherence_baseline as conditional,public_source_before_site_design_coherence_20261014 as public_strict,public_source_at_site_design_coherence_baseline as public_conditional,source_paths_at_site_design_coherence_baseline as paths_before,public_paths_at_site_design_coherence_baseline as public_before
ROOT=Path(__file__).resolve().parents[1];read=lambda f:(ROOT/f).read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT)
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
check(BASELINE=='16935688e0b4c6e177c81bdcaefb5727894d7a11' and VERSION=='site-design-coherence-20261014.1','Actual preceding release/version')
check(delta['provisional'] is False,'Provisional draft cannot certify')
check(git('rev-parse',BASELINE+'^{tree}').decode().strip()=='366c71c2dde3a6adbefcc068a88e9ad9e714be90','Actual baseline tree')
expected=['Monderman_Platform_Brief.html', 'operational-systems-article.html', 'docs/marketing-photo-register-20261013.json', 'enterprise-site.css', 'visual-polish.css', 'homepage-refinement.css', 'marketing-photo-presentation.css', 'scripts/homepage_refinement_20261014_inverse.mjs', 'scripts/homepage_refinement_20261014_inverse.py', 'scripts/homepage_refinement_20261014_contract.mjs', 'scripts/homepage_refinement_20261014_contract.py', 'scripts/marketing_photo_presentation_20261013_contract.mjs', 'scripts/marketing_photo_presentation_20261013_contract.py', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/homepage_refinement_20261014_browser.mjs', 'scripts/marketing_photo_presentation_20261013_browser.mjs', 'scripts/mobile_site_presentation_smoke.mjs', '.github/workflows/frontend-release.yml', '.github/workflows/sample-report-marketing-certification.yml', 'scripts/homepage_report_quad_20260925_contract.mjs']
check(list(FILES)==expected and list(ADDITIONS)==[],'Only exact product/consumer whitelist; no new runtime/provider/photo assets')
check(list(GUARD_FILES)==['scripts/site_design_coherence_20261014_inverse.mjs','scripts/site_design_coherence_20261014_inverse.py','scripts/site_design_coherence_20261014_contract.mjs','scripts/site_design_coherence_20261014_contract.py','scripts/fixtures/site-design-coherence-20261014.json'],'Only five new approval files')
def map_shape(rows,names):
 assert len(rows)==322 and len({r['path'] for r in rows})==len(rows) and sorted(r['path'] for r in rows)==sorted(names)
 for r in rows:assert isinstance(r['path'],str) and not Path(r['path']).is_absolute() and '..' not in r['path'].split('/') and type(r['bytes']) is int and r['bytes']>=0 and re.fullmatch('[a-f0-9]{64}',r['sha256'])
map_shape(delta['baselinePublicMap'],delta['baselinePublicPaths']);map_shape(delta['currentPublicMap'],delta['currentPublicPaths']);checks+=2
reject(lambda:map_shape(delta['currentPublicMap']+[delta['currentPublicMap'][0]],delta['currentPublicPaths']),'Duplicated compiled map rejects')
reject(lambda:map_shape([{**r,'path':'../private.jpg'} if i==0 else r for i,r in enumerate(delta['currentPublicMap'])],delta['currentPublicPaths']),'Unknown/unsafe compiled path rejects')

tracked=git('ls-tree','-r','--name-only',BASELINE).decode().splitlines();check(tracked==delta['baselineSourcePaths'],'Complete baseline source inventory')
batch=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=''.join(BASELINE+':'+f+'\n' for f in tracked).encode());old={};at=0
for f in tracked:
 end=batch.index(b'\n',at);head=batch[at:end].decode();assert re.fullmatch(r'[a-f0-9]{40} blob \d+',head);n=int(head.split()[2]);at=end+1;old[f]=batch[at:at+n];at+=n;assert batch[at:at+1]==b'\n';at+=1
check(at==len(batch),'Full authoritative Git blob framing')
def finite(entries,bytes_for,before_for,inverse,at_baseline):
 global hunks
 for f,e in entries.items():
  b=bytes_for(f);was=before_for(f,e);check(sha(b)==e['after_sha256'] and sha(was)==e['before_sha256'],'Whole current/original pins');check(bool(e['replacements']) and e['before_sha256']!=e['after_sha256'],'Actual finite differences');encoded=b.decode().encode('utf-16-le');end=0
  for start,stop,now,before in e['replacements']:
   check(isinstance(start,int) and isinstance(stop,int) and start>=end and stop>=start,'Finite ordered UTF16 hunk');check(encoded[start*2:stop*2].decode('utf-16-le')==now and isinstance(before,str),'Actual literal hunk');end=stop;hunks+=1
  for s in [b,b.decode()]:
   wanted=was if isinstance(s,bytes) else was.decode();check(inverse(f,s)==wanted and type(inverse(f,s)) is type(s),'Complete inverse/type');check(at_baseline(f,s)==wanted and at_baseline(f,wanted)==wanted,'Conditional and historic identity')
  mutants=[b+b'\n',b'!'+b[1:],was,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']+[encoded[:a*2].decode('utf-16-le').encode()+b'UNREVIEWED'+encoded[z*2:].decode('utf-16-le').encode() for a,z,_,_ in e['replacements']]
  for m in mutants:reject(lambda m=m:inverse(f,m),'Unknown/prefix/append/hunk/API/double inverse rejects');check(at_baseline(f,m)==m,'Unknown full bytes stay visible')
finite(delta['files'],read,lambda f,e:old[f],strict,conditional)
for f in tracked:
 if f in FILES:continue
 check(read(f)==old[f],'Every other actualM source byte '+f);immutable+=1;fixtures+=int(f.startswith('scripts/fixtures/'));pdfs+=int(f.endswith('.pdf'))
cached=git('ls-files','--cached').decode().splitlines();paths=set(cached+git('ls-files','--others','--exclude-standard').decode().splitlines());paths={p for p in paths if (ROOT/p).exists() and not(p=='node_modules' and p not in cached and (ROOT/p).is_symlink())}
def scope(rows):assert len(rows)==len(set(rows)) and sorted(rows)==sorted(tracked+list(ADDITIONS)+list(GUARD_FILES))
scope(paths);checks+=1;check(paths_before(paths)==set(tracked),'Only complete known source set projects')
for n in ['UNKNOWN.js','.env','assets/marketing/iStock-original.jpg','font-package.zip','.render-public 2']:
 rows=paths|{n};reject(lambda rows=rows:scope(rows),'Private/unknown additions reject');check(paths_before(rows)==rows,'Unknown paths remain visible')
rows=list(paths);check(paths_before(rows+[rows[0]])==rows+[rows[0]],'Duplicate paths stay visible')
for f in ['__proto__','constructor','toString','unknown.js']:
 for s in ['Unknown 😀','Unknown 😀'.encode()]:check(strict(f,s)==s and type(strict(f,s)) is type(s) and conditional(f,s)==s and public_strict(f,s)==s,'Unlisted identity/type; no prototype aliases')
def visible(s):return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',re.sub(r'<!--[\s\S]*?-->','',re.sub(r'<(script|style|svg|template)\b[^>]*>[\s\S]*?</\1>','',s,flags=re.I)))).strip()
for f in ['Monderman_Platform_Brief.html','operational-systems-article.html']:check(visible(read(f).decode())==visible(old[f].decode()),'Every original product/scoring/qualifier/footer word retained')
photo_ids={'index.html':['501653292','524156476'],'why-monderman.html':['511990984'],'platform-services.html':['541113838'],'Monderman_Platform_Brief.html':['488892667'],'operational-systems-article.html':[]}
def photo_intent(docs):
 assert list(docs)==list(photo_ids)
 for f,ids in photo_ids.items():
  rows=re.findall(r'<figure\b[^>]*(?:data-marketing-photo|data-site-photo)[^>]*>[\s\S]*?</figure>',docs[f]);assert [re.search(r'data-stock-id="(\d+)"',s).group(1) for s in rows]==ids
  for s in rows:
   assert not re.search(r'<figcaption|Models shown|Illustrative photography|Actual customer',s,re.I)
   assert 'object-fit:contain' in s and re.search(r'aspect-ratio:var\(--m(?:c|p)-photo-ratio\)',s) and re.search(r'width="\d+" height="\d+"',s) and re.search(r'alt="[^\"]+"',s)
   assert not re.search(r'display\s*:\s*none|visibility\s*:\s*hidden',s)
 assert 'mp-platform-visual' in docs['Monderman_Platform_Brief.html'] and len(re.findall(r'class="layer (?:one|two|three)"',docs['Monderman_Platform_Brief.html']))==3
docs={f:read(f).decode() for f in photo_ids};photo_intent(docs);checks+=1
moved=re.search(r'<figure\b[^>]*data-site-photo[^>]*>[\s\S]*?</figure>',docs['Monderman_Platform_Brief.html']).group()
for m in ['',moved+moved,moved.replace('488892667','0'),moved.replace('</figure>','<figcaption>Models shown</figcaption></figure>'),moved.replace('object-fit:contain','object-fit:cover'),moved.replace('<figure','<figure style="display:none"')]:reject(lambda m=m:photo_intent({**docs,'Monderman_Platform_Brief.html':docs['Monderman_Platform_Brief.html'].replace(moved,m,1)}),'Missing/duplicate/unknown/labelled/cropped/hidden moved photo rejects')
reject(lambda:photo_intent({**docs,'operational-systems-article.html':docs['operational-systems-article.html']+moved}),'Old article actually has zero photos')
register=json.loads(read('docs/marketing-photo-register-20261013.json'));was_register=json.loads(old['docs/marketing-photo-register-20261013.json']);placement=next(p for p in register['photos'] if p['id']=='488892667');check(placement['page']=='Monderman_Platform_Brief.html','Actual rights-register destination');normalized=json.loads(json.dumps(register));old_placement=next(p for p in was_register['photos'] if p['id']=='488892667');next(p for p in normalized['photos'] if p['id']=='488892667').update(page=old_placement['page'],placement=old_placement['placement']);check(normalized==was_register,'Only page/placement changes; all provenance/rights/20 derivatives unchanged')
assets=[a for p in register['photos'] for a in p['derivatives']];check(len(assets)==20,'Twenty exact optimized derivatives')
for a in assets:b=read(a['path']);check(sha(b)==a['sha256'] and len(b)==a['bytes'] and len(b)<=200000,'Actual physical approved image hash/size/budget')
runtime=['marketing-refresh.css','marketing-refresh.js','marketing-completion.css','marketing-completion.js','marketing-photo-presentation.css','marketing-photo-presentation.js','homepage-refinement.css','homepage-refinement.js']
def budget(sizes):assert all(type(n) is int and n>=0 for n in sizes) and sum(sizes)<=65536
budget([len(read(f)) for f in runtime]);checks+=1;reject(lambda:budget([len(read(f)) for f in runtime]+[65536]),'64KiB runtime overshoot rejects')
hf,enterprise,polish,photo_css=[read(f).decode() for f in ['homepage-refinement.css','enterprise-site.css','visual-polish.css','marketing-photo-presentation.css']]
def corners(a,b,c):
 assert '.latest-card-image { border-radius: var(--mond-radius-card, 16px) var(--mond-radius-card, 16px) 0 0 !important; }' in a
 assert ':is(.latest-card, .hrq-tile, .hwd-app, .hwd-compact-tile) { border-radius: var(--mond-radius-card, 16px) !important; }' in a and 'border-radius: var(--mond-radius-control, 7px)' in a
 assert '.series-card, .essay-card, .research-card, .proof-card, .loop-step' in b and ') { border-radius: var(--mond-radius-card, 16px) !important; }' in b
 assert '--mond-radius-card:16px' in c or '--mond-radius-card: 16px' in c
 assert '.instrument-center' not in b[b.rfind('/* Explicit surface families'):]
corners(hf,enterprise,polish);checks+=1
radius_only_edits=[('  body.homepage-enterprise.homepage-refinement .hero .hero-report-proof[data-home-report-quad] { max-width: 640px; border-radius: 2px; box-shadow: 0 16px 42px rgba(0,0,0,.16); }', '  body.homepage-enterprise.homepage-refinement .hero .hero-report-proof[data-home-report-quad] { max-width: 640px; border-radius: var(--mond-radius-card, 16px); box-shadow: 0 16px 42px rgba(0,0,0,.16); }'), ('  body.homepage-enterprise.homepage-refinement :is(.latest-card, .latest-card-image, .hrq-tile, .hwd-app, .hwd-compact-tile) { border-radius: 2px !important; }', '  body.homepage-enterprise.homepage-refinement :is(.latest-card, .hrq-tile, .hwd-app, .hwd-compact-tile) { border-radius: var(--mond-radius-card, 16px) !important; }'), ('  body.homepage-enterprise.homepage-refinement .latest-card-image { border-radius: 0 !important; }', '  body.homepage-enterprise.homepage-refinement .latest-card-image { border-radius: var(--mond-radius-card, 16px) var(--mond-radius-card, 16px) 0 0 !important; }'), ('  body.homepage-enterprise.homepage-refinement .hf-workflow-toggle { min-height: 44px; min-width: 170px; padding: 10px 16px; border: 1px solid #0C6E78; border-radius: 2px; background: transparent; color: #08383E; font: 600 14px/1.4 "Neue Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif; cursor: pointer; }', '  body.homepage-enterprise.homepage-refinement .hf-workflow-toggle { min-height: 44px; min-width: 170px; padding: 10px 16px; border: 1px solid #0C6E78; border-radius: var(--mond-radius-control, 7px); background: transparent; color: #08383E; font: 600 14px/1.4 "Neue Haas Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif; cursor: pointer; }')]
phone_note_anchor='@media screen and (max-width: 600px) {\n';phone_note_rule='  body.homepage-enterprise.homepage-refinement .hero .hero-access-note { box-sizing: border-box; padding-right: 132px; }\n'
def radius_only_intent(source):
 wanted=old['homepage-refinement.css'].decode()
 for a,b in radius_only_edits:
  assert wanted.count(a)==1;wanted=wanted.replace(a,b,1)
 assert wanted.count(phone_note_anchor)==1;wanted=wanted.replace(phone_note_anchor,phone_note_anchor+phone_note_rule,1)
 assert source==wanted,'Only four corner changes and exact phone note clearance; all other native/type/motion/print CSS exact'
radius_only_intent(hf);checks+=1
for m in [hf.replace(phone_note_rule,'',1),hf.replace(phone_note_rule,phone_note_rule+phone_note_rule,1),hf.replace(phone_note_rule,phone_note_rule.replace('132px','0px'),1),hf.replace(phone_note_rule,phone_note_rule.replace('.hero-access-note','.hero'),1),hf.replace(phone_note_anchor,'@media screen and (min-width: 600px) {\n',1)]:reject(lambda m=m:radius_only_intent(m),'Missing/duplicated/wrong phone clearance/selector/media rejects')
reject(lambda:radius_only_intent(hf.replace('min-height: 48px','min-height: 20px')),'Original native target cannot weaken')
reject(lambda:radius_only_intent(hf.replace('font-size: 52px','font-size: 90px')),'Original report scale cannot drift')

for i,a,b in [(0,'var(--mond-radius-card, 16px)','2px'),(0,'var(--mond-radius-control, 7px)','2px'),(1,'.series-card, .essay-card, .research-card, .proof-card, .loop-step','.essay-card, .research-card, .proof-card, .loop-step'),(2,'--mond-radius-card:16px','--mond-radius-card:0px')]:
 rows=[hf,enterprise,polish];rows[i]=rows[i].replace(a,b);reject(lambda rows=rows:corners(*rows),'Wrong/omitted corner token/family rejects')
check('body.page-platform-brief .mp-platform-visual .mp-photo { width: 100%; max-width: 430px;' in photo_css and 'body.page-platform-brief .mp-platform-visual .mp-photo { display: none; }' in photo_css,'Current proportional screen and deliberate print-only exclusion')
for f in tracked:
 if not f.endswith('.html'):continue
 s=read(f).decode();pattern=r'<footer\b[^>]*class="[^"]*\bmond-footer\b[^>]*>[\s\S]*?</footer>'
 if re.findall(pattern,s):check(re.findall(pattern,s)==re.findall(pattern,old[f].decode()),'Every canonical authored footer remains exact')
 end=s.lower().rfind('</html>')
 if end>=0:check(not s[end+7:].strip(),'No text after document closure')
def ordered_calls(before,now):
 pattern=r'\b(?:assert\.(?:ok|equal|deepEqual|deepStrictEqual|match|throws|strictEqual|notEqual)|eq\(|equal\(|check\(|reject\(|ok\()';a=[l.strip() for l in before.splitlines() if re.search(pattern,l)];b=[l.strip() for l in now.splitlines() if re.search(pattern,l)];at=0
 for l in a:
  while at<len(b) and b[at]!=l:at+=1
  assert at<len(b),'Original ordered assertion retained: '+l[:100];at+=1
for f in FILES:
 if f.endswith('_browser.mjs') or f.endswith('_smoke.mjs'):ordered_calls(old[f].decode(),read(f).decode());checks+=1
for f in ['.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml']:
 s=read(f).decode()
 for line in old[f].decode().splitlines():
  if re.search(r'node scripts/|python scripts/|timeout-minutes:|cancel-in-progress:',line):check(line in s,'Every original command/budget/concurrency retained')
 check('node scripts/site_design_coherence_20261014_contract.mjs' in s and 'python scripts/site_design_coherence_20261014_contract.py' in s,'Both current source approvals mandatory')
check(read('.github/workflows/pages-protected-deploy.yml')==old['.github/workflows/pages-protected-deploy.yml'],'Pages workflow exact')

# The standalone leaf changes only the two approved historical Brief reader seams.
quad_file='scripts/homepage_report_quad_20260925_contract.mjs'
quad_import="import {sourceAtHomepageRefinementBaseline} from './homepage_refinement_20261014_inverse.mjs';\n"
quad_added_import="import {sourceAtSiteDesignCoherenceBaseline} from './site_design_coherence_20261014_inverse.mjs';\n"
quad_raw_read="brief=read('Monderman_Platform_Brief.html');"
quad_approved_read="brief=sourceAtSiteDesignCoherenceBaseline('Monderman_Platform_Brief.html',read('Monderman_Platform_Brief.html'));"
def quad_reader_intent(source):
 before=old[quad_file].decode();assert before.count(quad_import)==1 and before.count(quad_raw_read)==1
 assert source==before.replace(quad_import,quad_import+quad_added_import,1).replace(quad_raw_read,quad_approved_read,1),'Every old comparison/math/mutant exact outside the two reader seams'
quad_source=read(quad_file).decode();quad_reader_intent(quad_source);checks+=1
for before,after in [(quad_added_import,''),(quad_approved_read,quad_raw_read),(quad_approved_read,quad_approved_read.replace("'Monderman_Platform_Brief.html',read","'index.html',read")),("eq(brief,prior('Monderman_Platform_Brief.html').toString(),'Entire Platform Brief is unchanged');",''),('reject(()=>buildPublicSamplePreviewSections(bad,template)','ok(true)')]:
 reject(lambda before=before,after=after:quad_reader_intent(quad_source.replace(before,after,1)),'Missing leaf/raw reader/wrong identity/dropped original assertion or negative rejects')



# Every quiet preference viewport retains a strict, source-bound actual heading test.
quiet_mobile_helper="// The opt-out page deliberately remains the exact quiet functional M169 edition.\nfunction assertQuietPreferencesTypography(source, snapshot) {\n  assert.equal(Buffer.byteLength(source), 2737, 'Exact original quiet preference source size');\n  assert.equal(createHash('sha256').update(source).digest('hex'), 'dfbda546df97a666905976e6db9cf8a9b04c754792af3e0dc59dfa8e8a6e3ddc', 'Exact original quiet preference source bytes');\n  assert.deepEqual(snapshot.headingTags, ['H1'], 'One visible original quiet preference heading');\n  assert.deepEqual(snapshot.headingFonts.map(f => f.split(',').map(name => name.trim())), [['Arial', 'Helvetica', 'sans-serif']], 'Exact original quiet functional type family');\n}\n\n";quiet_mobile_import="import {createHash} from 'node:crypto';\n";quiet_mobile_branch="        if(pageName==='email-preferences.html') {\n          assertQuietPreferencesTypography(sourceByPage.get(pageName), design);\n        } else {\n        if(design.headingFonts.some(f=>!f.includes('Neue Haas Grotesk'))) failures.push(`${pageName}/${viewport.name}: heading typography diverges from shared family`);\n        }";quiet_mobile_old_line="        if(design.headingFonts.some(f=>!f.includes('Neue Haas Grotesk'))) failures.push(`${pageName}/${viewport.name}: heading typography diverges from shared family`);";quiet_mobile_collection="return {tiles,images,footerLoose,headingTags:[...document.querySelectorAll('h1,h2,h3,h4')].filter(e=>e.checkVisibility()).map(e=>e.tagName),headingFonts:";quiet_mobile_old_collection='return {tiles,images,footerLoose,headingFonts:'
def quiet_mobile_intent(source):
 for t in [quiet_mobile_helper,quiet_mobile_import,quiet_mobile_branch,quiet_mobile_collection]:assert source.count(t)==1
 recovered=source.replace(quiet_mobile_import,'',1).replace(quiet_mobile_helper,'',1).replace(quiet_mobile_branch,quiet_mobile_old_line,1).replace(quiet_mobile_collection,quiet_mobile_old_collection,1)
 assert sha(recovered.encode())=='bae40b58ade0cfa3de10a9a2cf39068c5b286189261d3c36082439514063e058','Complete prior50 checker source remains exact outside the four new finite seams'
quiet_mobile_source=read('scripts/mobile_site_presentation_smoke.mjs').decode();quiet_mobile_intent(quiet_mobile_source);checks+=1
for a,b in [(quiet_mobile_import,''),(quiet_mobile_helper,''),(quiet_mobile_branch,quiet_mobile_old_line),("pageName==='email-preferences.html'",'true'),("snapshot.headingTags, ['H1']","snapshot.headingTags, []"),("['Arial', 'Helvetica', 'sans-serif']","['system-ui']"),('2737','2736'),('dfbda546df97a666905976e6db9cf8a9b04c754792af3e0dc59dfa8e8a6e3ddc','0'*64),(quiet_mobile_old_line,''),('const viewports = [','const viewports = []; /*')]:reject(lambda a=a,b=b:quiet_mobile_intent(quiet_mobile_source.replace(a,b,1)),'Missing/broadened quiet-only proof or dropped regular typography/source/old cases rejects')
def quiet_validate(raw,snapshot):
 assert len(raw.encode())==2737 and sha(raw.encode())=='dfbda546df97a666905976e6db9cf8a9b04c754792af3e0dc59dfa8e8a6e3ddc'
 assert snapshot['headingTags']==['H1'] and [[v.strip() for v in f.split(',')]for f in snapshot['headingFonts']]==[['Arial','Helvetica','sans-serif']]
quiet_raw=read('email-preferences.html').decode();quiet_positive={'headingTags':['H1'],'headingFonts':['Arial, Helvetica, sans-serif']};quiet_validate(quiet_raw,quiet_positive);checks+=1
for raw,snapshot in [(quiet_raw+' ',quiet_positive),(quiet_raw.replace('Arial','Times'),quiet_positive),(quiet_raw,{'headingTags':[],'headingFonts':[]}),(quiet_raw,{'headingTags':['H1','H2'],'headingFonts':['Arial, Helvetica, sans-serif','Arial, Helvetica, sans-serif']}),(quiet_raw,{'headingTags':['H2'],'headingFonts':['Arial, Helvetica, sans-serif']}),(quiet_raw,{'headingTags':['H1'],'headingFonts':['system-ui']}),(quiet_raw,{'headingTags':['H1'],'headingFonts':['Arial, sans-serif']}),(quiet_raw,{'headingTags':['H1'],'headingFonts':['Arial, Helvetica, sans-serif, serif']})]:reject(lambda raw=raw,snapshot=snapshot:quiet_validate(raw,snapshot),'Independent quiet predicate rejects source/visibility/tag/family drift')

# Exact current full-print canvas, with every historical96 case kept executable.
platform_print_helper="// The unchanged authored16in×9in print sheet is1536×864 CSS pixels.\nfunction assertPlatformPrintCanvas(snapshot) {\n  assert.deepEqual(snapshot.viewport, {width: 1536, height: 864}, 'Exact original print canvas');\n  assert.equal(snapshot.slides.length, 12, 'Every original print slide remains');\n  assert.equal(new Set(snapshot.slides.map(row => row.id)).size, 12, 'Every printed slide has its original unique identity');\n  const inside = (outer, inner) => inner[0] >= outer[0] - .5 && inner[1] >= outer[1] - .5 && inner[2] <= outer[2] + .5 && inner[3] <= outer[3] + .5;\n  for (const row of snapshot.slides) {\n    assert.ok([...row.box, ...row.inner, row.width, row.height, row.scrollWidth, row.clientWidth, row.scrollHeight, row.clientHeight].every(Number.isFinite), 'Printed dimensions and content geometry are finite');\n    assert.ok(Math.abs(row.width - 1536) <= .5 && Math.abs(row.height - 864) <= .5, 'Every full original16in×9in slide has exact physical dimensions');\n    assert.ok(row.scrollWidth <= row.clientWidth + 1 && row.scrollHeight <= row.clientHeight + 1, 'No printed slide content overflows its full page');\n    assert.ok(inside(row.box, row.inner), 'Every original slide inner content stays within its full print page');\n    for (const layer of row.layers) {\n      assert.ok(layer.visible && layer.box.every(Number.isFinite) && inside(row.box, layer.box), 'Every original printed platform layer remains visible and contained');\n    }\n  }\n}\nfunction collectPlatformPrintCanvas() {\n  const box = e => {const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom];};\n  return {viewport: {width: innerWidth, height: innerHeight}, slides: [...document.querySelectorAll('.deck > .slide')].map(e => ({id: e.id, box: box(e), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight, inner: box(e.querySelector('.slide-inner')), layers: [...e.querySelectorAll('.layer-stack .layer')].map(layer => ({visible: layer.checkVisibility(), box: box(layer)}))}))};\n}\nfunction negativePrintCanvasProof(snapshot) {\n  for (const mutate of [\n    row => row.viewport.width = 1440, row => row.slides.pop(),\n    row => row.slides[0].box[0] = NaN, row => row.slides[0].width = 1534,\n    row => row.slides[0].height = 862, row => row.slides[0].inner[2] = row.slides[0].box[2] + 2,\n    row => row.slides[0].scrollWidth = row.slides[0].clientWidth + 2,\n    row => row.slides[0].scrollHeight = row.slides[0].clientHeight + 2,\n    row => row.slides.find(slide => slide.layers.length).layers[0].visible = false,\n    row => row.slides[1].id = row.slides[0].id,\n  ]) {\n    const invalid = structuredClone(snapshot); mutate(invalid); negativeControls++;\n    assert.throws(() => assertPlatformPrintCanvas(invalid), undefined, 'Actual print validation rejects wrong canvas, missing/duplicate slides, nonfinite/undersized page, clipped content or hidden layer');\n  }\n}\n\n";platform_print_case="{name:'actual-print',viewport:{width:1536,height:864},print:true}";platform_print_proof='            printCanvas = await page.evaluate(collectPlatformPrintCanvas);\n            assertPlatformPrintCanvas(printCanvas);checks++;\n            negativePrintCanvasProof(printCanvas);\n'
def platform_print_intent(source):
 for literal in [platform_print_helper,platform_print_case,platform_print_proof]:assert source.count(literal)==1
 assert "check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': current brief has no overflow');" in source
platform_print_source=read('scripts/marketing_photo_presentation_20261013_browser.mjs').decode();platform_print_intent(platform_print_source);checks+=1
for a,b in [(platform_print_case,platform_print_case.replace('1536','1440')),('snapshot.slides.length, 12','snapshot.slides.length, 1'),('row.scrollWidth <= row.clientWidth + 1','true'),('inside(row.box, row.inner)','true'),('layer.visible &&',''),('row.clientHeight].every(Number.isFinite)',''),('assertPlatformPrintCanvas(printCanvas);checks++;',''),('negativePrintCanvasProof(printCanvas);',''),("check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': current brief has no overflow');",'check(True)')]:reject(lambda a=a,b=b:platform_print_intent(platform_print_source.replace(a,b,1)),'Wrong print context or dropped full-page/containment/finite/layer/negative/overflow proof rejects')
def print_validate(d):
 import math
 assert d['viewport']=={'width':1536,'height':864} and len(d['slides'])==12 and len({r['id'] for r in d['slides']})==12
 inside=lambda o,i:i[0]>=o[0]-.5 and i[1]>=o[1]-.5 and i[2]<=o[2]+.5 and i[3]<=o[3]+.5
 for r in d['slides']:
  assert all(type(v) in (int,float) and math.isfinite(v) for v in r['box']+r['inner']+[r[k] for k in ['width','height','scrollWidth','clientWidth','scrollHeight','clientHeight']])
  assert abs(r['width']-1536)<=.5 and abs(r['height']-864)<=.5 and r['scrollWidth']<=r['clientWidth']+1 and r['scrollHeight']<=r['clientHeight']+1 and inside(r['box'],r['inner'])
  for layer in r['layers']:assert layer['visible'] and all(math.isfinite(v) for v in layer['box']) and inside(r['box'],layer['box'])
print_positive={'viewport':{'width':1536,'height':864},'slides':[{'id':'slide-'+str(i),'box':[0,i*864,1536,(i+1)*864],'width':1536,'height':864,'scrollWidth':1536,'clientWidth':1536,'scrollHeight':864,'clientHeight':864,'inner':[72,i*864+60,1464,(i+1)*864-60],'layers':[{'visible':True,'box':[800,i*864+150,1200,i*864+600]}] if i==1 else []} for i in range(12)]};print_validate(print_positive);checks+=1
for kind in range(10):
 m=json.loads(json.dumps(print_positive))
 if kind==0:m['viewport']['width']=1440
 elif kind==1:m['slides'].pop()
 elif kind==2:m['slides'][0]['box'][0]=float('nan')
 elif kind==3:m['slides'][0]['width']=1534
 elif kind==4:m['slides'][0]['height']=862
 elif kind==5:m['slides'][0]['inner'][2]=1538
 elif kind==6:m['slides'][0]['scrollWidth']=1538
 elif kind==7:m['slides'][0]['scrollHeight']=866
 elif kind==8:m['slides'][1]['layers'][0]['visible']=False
 else:m['slides'][1]['id']=m['slides'][0]['id']
 reject(lambda m=m:print_validate(m),'Independent executable print geometry rejects malformed canvas/content')

sequential_pair='          node scripts/homepage_workspace_demo_smoke.mjs\n          GOLD_ACCENT_OUT=/tmp/report-presentation-smoke/gold-accents node scripts/public_gold_accent_smoke.mjs\n'
parallel_pair='          # The independent workspace and accent suites retain their own full commands,\n          # logs and exit statuses; both finish before this unchanged 60-minute job advances.\n          (\n          node scripts/homepage_workspace_demo_smoke.mjs\n          ) >/tmp/report-presentation-smoke/coherence-workspace.log 2>&1 &\n          coherence_workspace_pid=$!\n          (\n          GOLD_ACCENT_OUT=/tmp/report-presentation-smoke/gold-accents node scripts/public_gold_accent_smoke.mjs\n          ) >/tmp/report-presentation-smoke/coherence-gold.log 2>&1 &\n          coherence_gold_pid=$!\n          set +e\n          wait "$coherence_workspace_pid"\n          coherence_workspace_status=$?\n          wait "$coherence_gold_pid"\n          coherence_gold_status=$?\n          set -e\n          cat /tmp/report-presentation-smoke/coherence-workspace.log\n          cat /tmp/report-presentation-smoke/coherence-gold.log\n          echo "COHERENCE_PARALLEL_RESULT workspace=$coherence_workspace_status gold=$coherence_gold_status"\n          test "$coherence_workspace_status" -eq 0\n          test "$coherence_gold_status" -eq 0\n'
def parallel_intent(source):
 assert source.count(parallel_pair)==1 and sequential_pair not in source
 for t in ['wait "$coherence_workspace_pid"','wait "$coherence_gold_pid"','test "$coherence_workspace_status" -eq 0','test "$coherence_gold_status" -eq 0','cat /tmp/report-presentation-smoke/coherence-workspace.log','cat /tmp/report-presentation-smoke/coherence-gold.log']:assert t in source
certification=read('.github/workflows/sample-report-marketing-certification.yml').decode();parallel_intent(certification);checks+=1
for t in ['wait "$coherence_workspace_pid"','wait "$coherence_gold_pid"','test "$coherence_workspace_status" -eq 0','test "$coherence_gold_status" -eq 0']:reject(lambda t=t:parallel_intent(certification.replace(t,'REMOVED')),'Missing independent wait or failure status rejects')

# Preserve exact completed QA artifacts outside the unchanged strict source inventory.
research_artifact_commands='          node scripts/hold_collide_browser_smoke.mjs\n          node scripts/durable_organization_browser_smoke.mjs\n'
research_artifact_relocation="          # Preserve the exact36 completed research screenshots outside the frozen source tree.\n          python - <<'PY_RESEARCH_ARTIFACTS'\n          from pathlib import Path\n          import hashlib, json, shutil\n          \n          RESEARCH_SCREENSHOT_NAMES = {'hold-collide-browser': ['chromium-390-hero.png', 'chromium-390-figure.png', 'chromium-390-research.png', 'chromium-390-carousel.png', 'chromium-820-hero.png', 'chromium-820-figure.png', 'chromium-820-research.png', 'chromium-820-carousel.png', 'chromium-1440-hero.png', 'chromium-1440-figure.png', 'chromium-1440-research.png', 'chromium-1440-carousel.png', 'webkit-390-hero.png', 'webkit-390-figure.png', 'webkit-390-research.png', 'webkit-390-carousel.png', 'webkit-820-hero.png', 'webkit-820-figure.png', 'webkit-820-research.png', 'webkit-820-carousel.png', 'webkit-1440-hero.png', 'webkit-1440-figure.png', 'webkit-1440-research.png', 'webkit-1440-carousel.png'], 'durable-organization-browser': ['chromium-390-hero.png', 'chromium-390-figure.png', 'chromium-820-hero.png', 'chromium-820-figure.png', 'chromium-1440-hero.png', 'chromium-1440-figure.png', 'webkit-390-hero.png', 'webkit-390-figure.png', 'webkit-820-hero.png', 'webkit-820-figure.png', 'webkit-1440-hero.png', 'webkit-1440-figure.png']}\n          PNG_SIGNATURE = b'\\x89PNG\\r\\n\\x1a\\n'\n          \n          def relocate_research_artifacts(source_root, destination_root):\n              assert source_root.is_dir() and not source_root.is_symlink(), 'Original QA output root must be a real directory'\n              assert {p.name for p in source_root.iterdir()} == set(RESEARCH_SCREENSHOT_NAMES), 'Only the two completed research QA directories may exist'\n              assert not destination_root.exists() and not destination_root.is_symlink(), 'Never overwrite an existing artifact destination'\n              assert destination_root.parent.is_dir() and not destination_root.parent.is_symlink(), 'Existing report artifact parent must be a real directory'\n              manifest = []\n              for folder, expected in RESEARCH_SCREENSHOT_NAMES.items():\n                  directory = source_root / folder\n                  assert directory.is_dir() and not directory.is_symlink(), 'Research QA directory must be real'\n                  assert {p.name for p in directory.iterdir()} == set(expected), 'Every exact authored screenshot and no unexpected file must exist'\n                  for name in expected:\n                      image = directory / name\n                      assert image.is_file() and not image.is_symlink(), 'Only regular authored PNG files may move'\n                      data = image.read_bytes()\n                      assert len(data) > 32 and data.startswith(PNG_SIGNATURE) and data[12:16] == b'IHDR', 'Every moved artifact must be a PNG image'\n                      manifest.append({'path': folder + '/' + name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})\n              assert len(manifest) == 36 and len({row['path'] for row in manifest}) == 36, 'Exact36 authored screenshots required'\n              destination_root.mkdir()\n              for folder in RESEARCH_SCREENSHOT_NAMES:\n                  shutil.move(str(source_root / folder), str(destination_root / folder))\n              for row in manifest:\n                  image = destination_root / row['path']\n                  assert image.is_file() and not image.is_symlink(), 'Moved PNG remains a regular file'\n                  data = image.read_bytes()\n                  assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], 'Every screenshot byte and SHA256 must survive relocation'\n              source_root.rmdir()\n              return manifest\n          \n          manifest = relocate_research_artifacts(Path.cwd() / 'tmp', Path('/tmp/report-presentation-smoke/research-publication-screenshots'))\n          print('COHERENCE_RESEARCH_ARTIFACT_RELOCATION_PASS ' + json.dumps({'files': 36, 'rows': manifest}))\n          PY_RESEARCH_ARTIFACTS\n"
def research_artifact_relocation_intent(source):
 assert source.count(research_artifact_commands+research_artifact_relocation)==1,'Exact relocation follows both unchanged completed browser commands'
 recovered=source.replace(research_artifact_commands+research_artifact_relocation,research_artifact_commands,1)
 assert sha(recovered.encode())=='51481ab9dc8066e16f8745568cc7d375ee9d52535f66388a4e20983087579b68','All previous509 workflow commands/assertions/engines/budget/parallel statuses/artifact paths remain byte-exact'
research_artifact_relocation_intent(certification);checks+=1
research_artifact_mutants=[(research_artifact_relocation,''),(research_artifact_commands,research_artifact_commands.replace('hold_collide_browser_smoke','REMOVED')),('== set(RESEARCH_SCREENSHOT_NAMES)','== set()'),('== set(expected)','== set()'),('not destination_root.exists()','True'),('not image.is_symlink()','True'),('data.startswith(PNG_SIGNATURE)','True'),('len(manifest) == 36','len(manifest) == 35'),('shutil.move(str(source_root / folder), str(destination_root / folder))','pass'),("hashlib.sha256(data).hexdigest() == row['sha256']",'True'),('source_root.rmdir()','pass'),('/tmp/report-presentation-smoke/research-publication-screenshots','/tmp/UNREVIEWED'),('timeout-minutes: 60','timeout-minutes: 61')]
for a,b in research_artifact_mutants:
 mutant=certification.replace(a,b,1);check(mutant!=certification,'Meaningful relocation source mutant');reject(lambda mutant=mutant:research_artifact_relocation_intent(mutant),'Dropped/moved/unknown/overwriting/symlink/nonPNG/hash/move/budget relocation guard rejects')
reject(lambda:research_artifact_relocation_intent(certification.replace(research_artifact_relocation,'',1)+research_artifact_relocation),'Late relocation cannot evade strict inventory')
research_relocation_filesystem_controls="from pathlib import Path\nimport hashlib, json, shutil\n\nRESEARCH_SCREENSHOT_NAMES = {'hold-collide-browser': ['chromium-390-hero.png', 'chromium-390-figure.png', 'chromium-390-research.png', 'chromium-390-carousel.png', 'chromium-820-hero.png', 'chromium-820-figure.png', 'chromium-820-research.png', 'chromium-820-carousel.png', 'chromium-1440-hero.png', 'chromium-1440-figure.png', 'chromium-1440-research.png', 'chromium-1440-carousel.png', 'webkit-390-hero.png', 'webkit-390-figure.png', 'webkit-390-research.png', 'webkit-390-carousel.png', 'webkit-820-hero.png', 'webkit-820-figure.png', 'webkit-820-research.png', 'webkit-820-carousel.png', 'webkit-1440-hero.png', 'webkit-1440-figure.png', 'webkit-1440-research.png', 'webkit-1440-carousel.png'], 'durable-organization-browser': ['chromium-390-hero.png', 'chromium-390-figure.png', 'chromium-820-hero.png', 'chromium-820-figure.png', 'chromium-1440-hero.png', 'chromium-1440-figure.png', 'webkit-390-hero.png', 'webkit-390-figure.png', 'webkit-820-hero.png', 'webkit-820-figure.png', 'webkit-1440-hero.png', 'webkit-1440-figure.png']}\nPNG_SIGNATURE = b'\\x89PNG\\r\\n\\x1a\\n'\n\ndef relocate_research_artifacts(source_root, destination_root):\n    assert source_root.is_dir() and not source_root.is_symlink(), 'Original QA output root must be a real directory'\n    assert {p.name for p in source_root.iterdir()} == set(RESEARCH_SCREENSHOT_NAMES), 'Only the two completed research QA directories may exist'\n    assert not destination_root.exists() and not destination_root.is_symlink(), 'Never overwrite an existing artifact destination'\n    assert destination_root.parent.is_dir() and not destination_root.parent.is_symlink(), 'Existing report artifact parent must be a real directory'\n    manifest = []\n    for folder, expected in RESEARCH_SCREENSHOT_NAMES.items():\n        directory = source_root / folder\n        assert directory.is_dir() and not directory.is_symlink(), 'Research QA directory must be real'\n        assert {p.name for p in directory.iterdir()} == set(expected), 'Every exact authored screenshot and no unexpected file must exist'\n        for name in expected:\n            image = directory / name\n            assert image.is_file() and not image.is_symlink(), 'Only regular authored PNG files may move'\n            data = image.read_bytes()\n            assert len(data) > 32 and data.startswith(PNG_SIGNATURE) and data[12:16] == b'IHDR', 'Every moved artifact must be a PNG image'\n            manifest.append({'path': folder + '/' + name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})\n    assert len(manifest) == 36 and len({row['path'] for row in manifest}) == 36, 'Exact36 authored screenshots required'\n    destination_root.mkdir()\n    for folder in RESEARCH_SCREENSHOT_NAMES:\n        shutil.move(str(source_root / folder), str(destination_root / folder))\n    for row in manifest:\n        image = destination_root / row['path']\n        assert image.is_file() and not image.is_symlink(), 'Moved PNG remains a regular file'\n        data = image.read_bytes()\n        assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], 'Every screenshot byte and SHA256 must survive relocation'\n    source_root.rmdir()\n    return manifest\n\nimport base64, tempfile\npositive_count = negative_count = 0\npng = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=')\n\ndef prepared(parent):\n    source = parent / 'tmp'\n    source.mkdir()\n    for folder, names in RESEARCH_SCREENSHOT_NAMES.items():\n        directory = source / folder\n        directory.mkdir()\n        for name in names:\n            (directory / name).write_bytes(png)\n    artifact_parent = parent / 'artifact'\n    artifact_parent.mkdir()\n    return source, artifact_parent / 'research-publication-screenshots'\n\nwith tempfile.TemporaryDirectory(prefix='coherence-relocation-positive-') as temporary:\n    source, destination = prepared(Path(temporary))\n    rows = relocate_research_artifacts(source, destination)\n    assert len(rows) == 36 and not source.exists()\n    assert {p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file()} == {row['path'] for row in rows}\n    assert all((destination / row['path']).read_bytes() == png for row in rows)\n    positive_count += 1\n\nnegative_names = ['missing screenshot', 'unexpected file', 'unexpected nested directory', 'symlink image', 'symlink source directory', 'symlink source root', 'invalid PNG bytes', 'existing destination', 'symlink destination', 'symlink artifact parent', 'unknown sibling source output', 'changed bytes during relocation']\nfor kind in range(len(negative_names)):\n    with tempfile.TemporaryDirectory(prefix='coherence-relocation-negative-') as temporary:\n        parent = Path(temporary)\n        source, destination = prepared(parent)\n        first = source / 'hold-collide-browser' / RESEARCH_SCREENSHOT_NAMES['hold-collide-browser'][0]\n        real_move = shutil.move\n        if kind == 0: first.unlink()\n        elif kind == 1: (first.parent / 'UNKNOWN.png').write_bytes(png)\n        elif kind == 2: (first.parent / 'unknown-directory').mkdir()\n        elif kind == 3:\n            first.unlink(); first.symlink_to(parent / 'other.png'); (parent / 'other.png').write_bytes(png)\n        elif kind == 4:\n            directory = source / 'hold-collide-browser'; directory.rename(parent / 'elsewhere'); directory.symlink_to(parent / 'elsewhere', target_is_directory=True)\n        elif kind == 5:\n            source.rename(parent / 'elsewhere'); source.symlink_to(parent / 'elsewhere', target_is_directory=True)\n        elif kind == 6: first.write_bytes(b'NOT A PNG')\n        elif kind == 7: destination.mkdir()\n        elif kind == 8: destination.symlink_to(parent / 'missing-destination', target_is_directory=True)\n        elif kind == 9:\n            destination.parent.rename(parent / 'real-artifact'); (parent / 'artifact').symlink_to(parent / 'real-artifact', target_is_directory=True)\n        elif kind == 10: (source / 'unknown-output').mkdir()\n        elif kind == 11:\n            def corrupt_move(before, after):\n                result = real_move(before, after)\n                image = next(Path(after).glob('*.png'))\n                image.write_bytes(image.read_bytes() + b'CHANGED')\n                return result\n            shutil.move = corrupt_move\n        try:\n            try: relocate_research_artifacts(source, destination)\n            except AssertionError: negative_count += 1\n            else: raise AssertionError('Relocation accepted ' + negative_names[kind])\n        finally: shutil.move = real_move\nassert positive_count == 1 and negative_count == 12\nprint(json.dumps({'ok': True, 'positiveCount': positive_count, 'negativeCount': negative_count, 'files': 36}))\n"
check(json.loads(subprocess.check_output([sys.executable,'-c',research_relocation_filesystem_controls],cwd=ROOT))=={'ok':True,'positiveCount':1,'negativeCount':12,'files':36},'Executable exact36 preservation/twelve actual filesystem rejections');checks+=13;negatives+=12

# The raw phone fallback matches the already-settled native launcher position.
launcher_corner_anchor='@media(max-width:480px){\n  #mnd-launcher,\n  .mdn-cn-launch{right:max(16px,env(safe-area-inset-right))!important}\n'
launcher_corner_rule='  #mnd-launcher{bottom:max(16px,env(safe-area-inset-bottom))!important}\n'
def launcher_corner_fallback_intent(source):
 assert source.count(launcher_corner_rule)==1,'One separate launcher-only fallback'
 assert source.count(launcher_corner_anchor+launcher_corner_rule)==1,'Fallback remains inside the exact existing max480 block'
 recovered=source.replace(launcher_corner_anchor+launcher_corner_rule,launcher_corner_anchor,1)
 assert sha(recovered.encode())=='6cc72528c6b242aa3aaf4ea304f476b001545326f262493e9003719fa0448226','Every preexisting F56 CSS byte remains exact outside one launcher bottom declaration'
launcher_corner_fallback_intent(polish);checks+=1
launcher_corner_mutants=[
 polish.replace(launcher_corner_rule,'',1),
 polish.replace(launcher_corner_rule,launcher_corner_rule+launcher_corner_rule,1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('16px','14px'),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('16px','20px'),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('!important',''),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('#mnd-launcher','#mnd-launcher,.mdn-cn-launch'),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('#mnd-launcher','#mnd-panel'),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('env(safe-area-inset-bottom)','0px'),1),
 polish.replace(launcher_corner_anchor,launcher_corner_anchor.replace('max-width:480px','max-width:481px'),1),
 polish.replace(launcher_corner_anchor,launcher_corner_anchor.replace('right:max(16px','right:max(14px',1),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('bottom:','top:'),1),
 polish.replace(launcher_corner_rule,launcher_corner_rule.replace('!important}','!important;display:none}'),1),
 polish.replace(launcher_corner_rule,'',1)+launcher_corner_rule,
 polish+'\n#mnd-launcher{transform:scale(.5)}\n'
]
for mutant in launcher_corner_mutants:
 check(mutant!=polish,'Meaningful launcher fallback mutant');reject(lambda mutant=mutant:launcher_corner_fallback_intent(mutant),'Missing/duplicate/wrong edge/importance/group/selector/inset/media/right/hiding/late/scale change rejects')

if '--built' in sys.argv:
 build=Path(os.environ['SITE_DESIGN_BUILD_ROOT']).resolve() if os.environ.get('SITE_DESIGN_BUILD_ROOT') else ROOT/'.render-public';names=sorted(str(p.relative_to(build)) for p in build.rglob('*') if p.is_file());check(names==delta['currentPublicPaths'],'Complete current unique compiled closure');check(public_before(names)==delta['baselinePublicPaths'],'Known complete public set projects');check(public_before(names+['UNKNOWN'])==names+['UNKNOWN'],'Unknown compiled addition stays visible')
 bm={r['path']:r for r in delta['baselinePublicMap']}
 def public_prior(f,e):
  b=public_strict(f,(build/f).read_bytes());check(sha(b)==bm[f]['sha256'],'Authoritative deployed compiled baseline');return b
 finite(delta['publicFiles'],lambda f:(build/f).read_bytes(),public_prior,public_strict,public_conditional)
 for row in delta['currentPublicMap']:
  if row['path']=='.well-known/monderman-release.json':continue
  b=(build/row['path']).read_bytes();check(sha(b)==row['sha256'] and len(b)==row['bytes'],'Every compiled full hash/size')
 for f in runtime:check((build/f).read_bytes()==read(f),'RAW actual source/built runtime equality')
 for f in photo_ids:photo_intent({**docs,f:(build/f).read_text()});checks+=1
 check(json.loads((build/'.well-known/monderman-release.json').read_bytes())['revision']==os.environ.get('RENDER_GIT_COMMIT'),'Actual build revision')
print(json.dumps({'ok':True,'checks':checks,'negativeControls':negatives,'finiteFiles':len(FILES),'hunks':hunks,'immutableFiles':immutable,'historicalFixtures':fixtures,'pdfs':pdfs,'runtimeBytes':sum(len(read(f)) for f in runtime),'publicFiles':len(delta['currentPublicPaths']),'built':'--built' in sys.argv,'networkCalls':0,'productionWrites':0}))
