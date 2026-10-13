"""Independent Python raw-current owner photo contract; exact M reconstruction first."""
import hashlib,json,re,subprocess,sys,os
from pathlib import Path
from marketing_photo_presentation_20261013_inverse import BASELINE,VERSION,_fixture as delta,FILES,ADDITIONS,GUARD_FILES,source_before_marketing_photo_presentation_20261013 as strict,source_at_marketing_photo_presentation_baseline as conditional,photo_names_at_marketing_photo_presentation_baseline as names_before
ROOT=Path(__file__).resolve().parents[1]
read=lambda f:(ROOT/f).read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT)
checks=negative_controls=hunks=immutable=fixtures=pdfs=0
def check(v,label):
 global checks
 assert v,label
 checks+=1
def reject(fn,label):
 global checks,negative_controls
 try:fn()
 except AssertionError:checks+=1;negative_controls+=1
 else:raise AssertionError(label)
assert BASELINE=='5ce8817eed8af622b4c0c8eeeb48b4440e728186' and VERSION=='marketing-photo-presentation-20261013.1'
check(delta['provisional'] is False,'Provisional cannot certify')
check(git('rev-parse',BASELINE+'^{tree}').decode().strip()=='4245b8bc1ff3fdcaae738620fc5f7e84224c6f12','ExactM tree')
expected_files=['index.html', 'public-search-index.json', 'why-monderman.html', 'platform-services.html', 'operational-systems-article.html', 'docs/marketing-completion-20261013.md', 'docs/marketing-photo-register-20261013.json', 'scripts/marketing_completion_20261013_inverse.mjs', 'scripts/marketing_completion_20261013_inverse.py', 'scripts/marketing_completion_20261013_contract.mjs', 'scripts/marketing_completion_20261013_contract.py', 'scripts/marketing_refresh_20261012_contract.mjs', 'scripts/marketing_refresh_20261012_contract.py', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/homepage_assistant_smoke.mjs', 'scripts/marketing_completion_browser_smoke.mjs', '.github/workflows/frontend-release.yml', '.github/workflows/sample-report-marketing-certification.yml', 'scripts/methodology_business_copy_smoke.mjs']
check(list(FILES)==expected_files,'Only explicit19 product/consumer paths')
tracked=git('ls-tree','-r','--name-only',BASELINE).decode().splitlines()
prior=lambda f:git('show',BASELINE+':'+f)
for file in FILES:
 current=read(file);old=prior(file);entry=delta['files'][file]
 check(sha(old)==entry['before_sha256'] and sha(current)==entry['after_sha256'],'Complete before/after source identity')
 encoded=current.decode().encode('utf-16-le');end=0
 for start,stop,now,was in entry['replacements']:
  check(isinstance(start,int) and isinstance(stop,int) and start>=end and stop>=start,'Ordered finite replacement')
  check(encoded[start*2:stop*2].decode('utf-16-le')==now and isinstance(was,str),'Exact source replacement')
  end=stop;hunks+=1
 for source in [current,current.decode()]:
  expected=old if isinstance(source,bytes) else old.decode()
  check(strict(file,source)==expected and type(strict(file,source)) is type(source),'Independent completeM inverse/type')
  check(conditional(file,source)==expected and conditional(file,expected)==expected,'Exact conditionalM identity')
 mutants=[current+b'\n',b'!'+current[1:],old,current+b'<script>fetch("/api/activate",{method:"POST"})</script>']+[encoded[:start*2].decode('utf-16-le').encode()+b'UNKNOWN'+encoded[stop*2:].decode('utf-16-le').encode() for start,stop,_,_ in entry['replacements']]
 for mutant in mutants:
  reject(lambda m=mutant:strict(file,m),'Unknown edit/doubleinverse rejects')
  check(conditional(file,mutant)==mutant,'Unknown bytes never masked')
for file in tracked:
 if file in FILES:continue
 check(read(file)==prior(file),'Every otherM byte unchanged '+file);immutable+=1;fixtures+=int(file.startswith('scripts/fixtures/'));pdfs+=int(file.endswith('.pdf'))
check(sha(read('scripts/fixtures/marketing-completion-20261013.json'))=='256fbebee65475e8ae963b6a000e060be25ec37a3489e14ce17c721ad919742c','Immutable .5fixture18/48')
for file in ADDITIONS:
 b=read(file);check(sha(b)==delta['additions'][file]['sha256'] and len(b)==delta['additions'][file]['bytes'],'Exact raw addition')
 check(strict(file,b)==b,'Newasset never erased')
 reject(lambda f=file,b=b:(_ for _ in ()).throw(AssertionError()) if sha(b+b'UNKNOWN')!=delta['additions'][f]['sha256'] else None,'Unknown asset changes reject')
known=set(tracked)|set(ADDITIONS)|set(GUARD_FILES)
cached=git('ls-files','--cached').decode().splitlines();paths=set(cached+git('ls-files','--others','--exclude-standard').decode().splitlines());paths={p for p in paths if (ROOT/p).exists() and not(p=='node_modules' and p not in cached and (ROOT/p).is_symlink())}
def scope(rows):assert set(rows)<=known,'Only explicit currentsource/additions'
scope(paths);checks+=len(paths)
for file in ['unknown.js','AGENTS.md','.env','assets/marketing/iStock-original.jpg','font-package.zip']:reject(lambda f=file:scope(paths|{f}),'Unregistered/private addition rejects')
page_ids={'index.html':['501653292','524156476'],'why-monderman.html':['511990984'],'platform-services.html':['541113838'],'operational-systems-article.html':['488892667']}
def figures(s):return re.findall(r'<figure\b[^>]*\b(?:data-marketing-photo|data-site-photo)\b[^>]*>[\s\S]*?</figure>',s)
def photo_documents(docs):
 assert set(docs)==set(page_ids)
 for file,ids in page_ids.items():
  rows=figures(docs[file]);assert len(rows)==len(ids)
  assert [re.search(r'data-stock-id="(\d+)"',f).group(1) for f in rows]==ids
  for f in rows:
   assert not re.search(r'<figcaption\b|Models shown|Illustrative photography|Actual customer',f,re.I)
   assert not re.search(r'display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;"\s]|$)',f,re.I)
   assert re.search(r'width="\d+" height="\d+"',f) and re.search(r'object-fit:\s*contain',f) and re.search(r'alt="[^"]+"',f)
docs={f:read(f).decode() for f in page_ids};photo_documents(docs);checks+=1
for file in page_ids:
 photo=figures(docs[file])[0]
 for replacement in ['',photo+photo,re.sub(r'data-stock-id="\d+"','data-stock-id="0"',photo),photo.replace('</figure>','<figcaption>Models shown</figcaption></figure>'),photo.replace('<figure','<figure style="display:none;"')]:
  mutant={**docs,file:docs[file].replace(photo,replacement,1)};reject(lambda m=mutant:photo_documents(m),'Missing/duplicate/wrong/labelled/hidden currentasset rejects')
r=json.loads(read('docs/marketing-photo-register-20261013.json'))
def rights(value):
 assert value['schemaVersion']==2 and value['status']=='OWNER_APPROVED_LICENSED_WEBSITE_DERIVATIVES'
 assert value['homepageGroupPhotographs']==2 and value['usedSitePhotographs']==5 and value['unusedApprovedAssets']==[]
 assert value['privateOriginalsPublished'] is False and value['noPurchase'] is True
 assert [str(p['id']) for p in value['photos']]==['501653292','488892667','524156476','541113838','511990984']
 for p in value['photos']:assert p['ownerApproved'] is True and p['rightsStatus']=='owner-approved-licensed-site-use' and p['humanProvenanceEvidence'] and p['modelPropertyPermissionEvidence'] and p['repositoryUseEvidence'] and len(p['derivatives'])==4
 assert 'not Monderman-owned copyright' in value['licenseNotice'] and 'independent reuse' in value['licenseNotice']
rights(r);checks+=1
for field,value in [('usedSitePhotographs',4),('homepageGroupPhotographs',3),('privateOriginalsPublished',True),('unusedApprovedAssets',[{'id':'541113838'}]),('licenseNotice','CC0')]:
 m=json.loads(json.dumps(r));m[field]=value;reject(lambda m=m:rights(m),'Unknown rights/currentaccounting rejects')
derivatives=[d for p in r['photos'] for d in p['derivatives']];asset_names=sorted(Path(d['path']).name for d in derivatives)
check(len(derivatives)==20 and asset_names==delta['currentPhotoNames'],'Exact20assets inventory')
def inventory(names):assert sorted(names)==asset_names
inventory(p.name for p in (ROOT/'assets/marketing').iterdir());checks+=1
for names in [asset_names[:-1],asset_names+['iStock-original.jpg'],delta['priorPhotoNames']]:reject(lambda n=names:inventory(n),'Missing/private/currentinventory rejects')
check(names_before(asset_names)==delta['priorPhotoNames'],'Only exact current directory projects')
check(names_before(asset_names+['UNREVIEWED'])==asset_names+['UNREVIEWED'],'Unknown directory never hidden')
for d in derivatives:
 b=read(d['path']);check(sha(b)==d['sha256'] and len(b)==d['bytes'] and d['bytes']<=200000 and d['width']>0 and d['height']>0,'Actual bounded registered derivative')
check(sum(d['bytes'] for d in derivatives)==r['assetBudget']['totalDerivativeBytes']==1786772,'Truthful newallfive size')
css=read('marketing-photo-presentation.css').decode();js=read('marketing-photo-presentation.js').decode()
check(not re.search(r'@import|@font-face|https?://',css,re.I),'No new remote stylesheet/font')
check(not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|sendBeacon|localStorage|sessionStorage|document\.cookie|supabase|stripe',js,re.I),'Only localpresentation no network/storage/API')
check('border-radius: clamp(18px, 2vw, 28px)' in css and 'object-fit: contain' in css and 'duration: 450' in js and 'prefers-reduced-motion' in js,'Rounded fullcomposition and native450/reduced branch')
presentation_files=['marketing-refresh.css','marketing-refresh.js','marketing-completion.css','marketing-completion.js','marketing-photo-presentation.css','marketing-photo-presentation.js']
check(sum(len(read(f)) for f in presentation_files)<=65536,'Sixlocalruntime64KiB')
for file in ['marketing-completion.css','marketing-completion.js','.github/workflows/pages-protected-deploy.yml']:check(read(file)==prior(file),'Protected oldcontrols/Pages exact')
browser=read('scripts/marketing_completion_browser_smoke.mjs').decode();assistant=read('scripts/homepage_assistant_smoke.mjs').decode()
def guard_calls(source):
    masked, state, escaped, in_class, i = list(source), None, False, False, 0
    while i < len(source):
        c = source[i]
        following = source[i + 1] if i + 1 < len(source) else ''
        if state:
            if c != '\n':
                masked[i] = ' '
            if state == 'line':
                if c == '\n':
                    state = None
            elif state == 'block':
                if c == '*' and following == '/':
                    i += 1
                    masked[i] = ' '
                    state = None
            elif escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif state == 'regex':
                if c == '[':
                    in_class = True
                elif c == ']':
                    in_class = False
                elif c == '/' and not in_class:
                    state = None
            elif c == state:
                state = None
        elif c in '\"\'`':
            state, masked[i] = c, ' '
        elif c == '/' and following == '/':
            state, masked[i] = 'line', ' '
            i += 1
            masked[i] = ' '
        elif c == '/' and following == '*':
            state, masked[i] = 'block', ' '
            i += 1
            masked[i] = ' '
        elif c == '/':
            previous = i - 1
            while previous >= 0 and masked[previous].isspace():
                previous -= 1
            if previous < 0 or masked[previous] in '([=:,!&|?{;':
                state, in_class, masked[i] = 'regex', False, ' '
        i += 1
    text, out = ''.join(masked), []
    for match in re.finditer(r'\b(?:assert(?:\.[A-Za-z]+)?|check|equal|eq|assertCompactHeight|assertAssumptionsText|assertReadingGuide|assertReadablePreview|assertEnlargedOverview|assertExpandedHeight|assertRefreshedJourneyGeometry|assertSafety|target|settled|assertCurrentEditorialSequence|assertCompletionEditorialSequence)\s*\(', text):
        depth, end = 1, match.end()
        while end < len(text) and depth:
            depth += int(text[end] == '(') - int(text[end] == ')')
            end += 1
        assert depth == 0, 'Balanced original guard call'
        out.append('\n'.join(line.strip() for line in source[match.start():end].split('\n')))
    return out

permitted_photo_calls={
 "assert.equal(approvedDerivatives.size, 12, 'Exactly twelve owner-approved photographic derivatives')",
 "equal(await page.locator('[data-marketing-photo]').count(), 3, label + ': three approved group photographs')",
 "equal(new Set(expectedRatio.map(photo => photo.source)).size, 3, label + ': three distinct group images')",
 "equal(photoDurations, [450, 450, 450], label + ': all photo entrances measured in350–550ms interval')",
 "equal(await printed.page.locator('[data-marketing-photo] img').evaluateAll(images => images.map(image => image.loading)), ['eager', 'eager', 'eager'], engine + ': print alone loads all three lazy photographs')",
}
old_browser_calls=guard_calls(prior('scripts/marketing_completion_browser_smoke.mjs').decode())
old_assistant_calls=guard_calls(prior('scripts/homepage_assistant_smoke.mjs').decode())
check(sum(c in permitted_photo_calls for c in old_browser_calls)==5,'Only five owner-superseded photo cardinality calls')
preserved_browser_calls=[c for c in old_browser_calls if c not in permitted_photo_calls]
def assert_call_subsequence(expected,source):
 actual=guard_calls(source);i=0
 for c in actual:
  if i<len(expected) and c==expected[i]:i+=1
 assert i==len(expected),'Every original non-photo call retained exact and ordered'
assert_call_subsequence(preserved_browser_calls,browser);checks+=len(preserved_browser_calls)
assert_call_subsequence(old_assistant_calls,assistant);checks+=len(old_assistant_calls)
method_file='scripts/methodology_business_copy_smoke.mjs';old_method=prior(method_file).decode();current_method=read(method_file).decode()
method_import="import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';\n"
old_method_view="  const restored=html.replace(sampleLinkStyle,'').replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');"
new_method_view="  const restored=sourceAtMarketingPhotoPresentationBaseline(file,html).replace(sampleLinkStyle,'').replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');"
old_graphics_loop="  for(const tag of ['script','style',...(file==='roi.html'?[]:['svg'])])eq(html.match(new RegExp(`<${tag}\\\\b[^>]*>[\\\\s\\\\S]*?<\\\\/${tag}>`,'g')),\n    prior.match(new RegExp(`<${tag}\\\\b[^>]*>[\\\\s\\\\S]*?<\\\\/${tag}>`,'g')),file+': existing behavior and graphics unchanged');"
new_graphics_loop="  {\n    const html=sourceAtMarketingPhotoPresentationBaseline(file,read(file)).replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');\n  for(const tag of ['script','style',...(file==='roi.html'?[]:['svg'])])eq(html.match(new RegExp(`<${tag}\\\\b[^>]*>[\\\\s\\\\S]*?<\\\\/${tag}>`,'g')),\n    prior.match(new RegExp(`<${tag}\\\\b[^>]*>[\\\\s\\\\S]*?<\\\\/${tag}>`,'g')),file+': existing behavior and graphics unchanged');\n  }"
def method_consumer(source):
 expected=old_method.replace(method_import,method_import+"import {sourceAtMarketingPhotoPresentationBaseline} from './marketing_photo_presentation_20261013_inverse.mjs';\n",1).replace(old_method_view,new_method_view,1).replace(old_graphics_loop,new_graphics_loop,1)
 assert source==expected,'Only finite import and historical script/style view; raw prose/current DOM unchanged'
method_consumer(current_method);checks+=1;assert_call_subsequence(guard_calls(old_method),current_method);checks+=len(guard_calls(old_method))
for token,replacement in [("sourceAtMarketingPhotoPresentationBaseline(file,html).replace(sampleLinkStyle","html.replace(sampleLinkStyle"),("for(const tag of ['script','style'])assert.deepEqual","for(const tag of ['style'])assert.deepEqual"),("const read=file=>fs.readFileSync(path.join(root,file),'utf8');","const read=file=>sourceAtMarketingPhotoPresentationBaseline(file,fs.readFileSync(path.join(root,file),'utf8'));"),("fs.copyFileSync(path.join(root,entry.name),path.join(build,entry.name));","fs.writeFileSync(path.join(build,entry.name),sourceAtMarketingPhotoPresentationBaseline(entry.name,read(entry.name)));"),("tag+' matches the approved presentation; no unrelated behavior or CSS changes'","'Waived script/style comparison'")]:
 check(token in current_method,'Actual methodology regression target')
 reject(lambda t=token,r=replacement:method_consumer(current_method.replace(t,r,1)),'Dropped comparison/global normalization/current DOM projection rejects')

for token,replacement in [('assertSafety(state, options, label);','void state;'),("check(box && Object.values(box).every(Number.isFinite)","check(true || box && Object.values(box).every(Number.isFinite)"),("equal(state.writes, []","equal([], []")]:
 check(token in browser,'Original actual regression target')
 reject(lambda t=token,r=replacement:assert_call_subsequence(preserved_browser_calls,browser.replace(t,r,1)),'Valid skipped/neutralized original safety/geometry rejects')
def runtime_consumer(b,a):
 assert "ids: ['501653292','524156476'], derivativeCount: 20, captioned: false" in b and "name: 'merged-M'" in b
 for token in ['box.height >= minimum','no obstruction or forced click','assertSafety(state, options, label);','beforeprint synchronously closes expansion','scripts: false','style-and-photo-failure','dialog-throws','deviceScaleFactor: options.dpr || 1','2750']:assert token in b
 assert 'assertFivePhotoEditorialSequence(editorial.visibleSections, completionPhotos);' in a and 'assertCompletionEditorialSequence(editorial.visibleSections, completionPhotos);' in a and 'Only exact current positions1/9/11 project after complete proof' in a
runtime_consumer(browser,assistant);checks+=1
def current_editorial_consumer(source):
 match=re.search(r'const fivePhotoEditorialSequence = (\[[^\n]+\]);',source)
 assert match,'Explicit complete current direct-main sequence'
 assert json.loads(match[1].replace("'",'"'))==['hero','mc-human-section','mr-scenario','measurement-loop','approach','first-run-moments','proof-band','mxidx-band','systems-analysis-bridge','mp-perspective-note','home-output-band','mc-human-section','book-band','latest','connect']
 assert "{position: 11, headingId: 'mc-judgment-title', stockId: '524156476'" in source
 assert 'function projectFivePhotoSections(sections) { return [sections[0], ...sections.slice(2, 9), sections[10], ...sections.slice(12)]; }' in source
current_assistant_block=assistant[assistant.index("// Owner-directed current edition:"):assistant.index("const currentFivePhotoSource")]
current_editorial_consumer(current_assistant_block);checks+=1
for token,replacement in [("'systems-analysis-bridge','mp-perspective-note'","'systems-analysis-bridge'"),("'mp-perspective-note','home-output-band'","'home-output-band','mp-perspective-note'"),("{position: 11, headingId: 'mc-judgment-title'","{position: 10, headingId: 'mc-judgment-title'"),('...sections.slice(2, 9), sections[10], ...sections.slice(12)','...sections.slice(2,10),...sections.slice(11)')]:
 reject(lambda t=token,r=replacement:current_editorial_consumer(current_assistant_block.replace(t,r,1)),'Omitted/moved compact note or incorrect fixed projection rejects')

for token in ['assertSafety(state, options, label);','box.height >= minimum','beforeprint synchronously closes expansion','style-and-photo-failure']:reject(lambda t=token:runtime_consumer(browser.replace(t,'REMOVED'),assistant),'Droppedgeometry/safety/fault rejects')
reject(lambda:runtime_consumer(browser,assistant.replace('assertFivePhotoEditorialSequence(editorial.visibleSections, completionPhotos);','')),'Currentproof cannot skip')
for file in ['.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml']:
 current=read(file).decode()
 for line in prior(file).decode().splitlines():
  if re.search(r'node scripts/|python scripts/|timeout-minutes:|cancel-in-progress:',line):check(line in current,'Everyoldcommand/budget/concurrency retained')
 check('node scripts/marketing_photo_presentation_20261013_contract.mjs' in current and 'python scripts/marketing_photo_presentation_20261013_contract.py' in current,'Mandatory independent newguards')
check('MARKETING_PHOTO_PRESENTATION_OUT=/tmp/report-presentation-smoke/photo-presentation node scripts/marketing_photo_presentation_20261013_browser.mjs' in read('.github/workflows/sample-report-marketing-certification.yml').decode(),'Mandatory actualcurrent five-site browser')
if '--built' in sys.argv:
 publish=ROOT/'.render-public';actual=sorted(str(p.relative_to(publish)) for p in publish.rglob('*') if p.is_file())
 check(actual==delta['publicInventory'],'Complete actualcanonicalbuildclosure no duplicates/privatefiles')
 for d in derivatives:check((publish/d['path']).read_bytes()==read(d['path']),'Actualbuiltphotographicbytes')
 check(json.loads((publish/'.well-known/monderman-release.json').read_bytes())['revision']==os.environ.get('RENDER_GIT_COMMIT'),'Actualbuildidentity')
 for file in page_ids:photo_documents({**docs,file:(publish/file).read_text()});checks+=1
 for file in presentation_files:check((publish/file).read_bytes()==read(file),'Actualsixruntimebodyidentities')
print(json.dumps({'ok':True,'checks':checks,'negativeControls':negative_controls,'finiteFiles':len(FILES),'hunks':hunks,'immutableFiles':immutable,'historicalFixtures':fixtures,'pdfs':pdfs,'homepagePhotos':2,'sitePhotos':5,'photoAssets':20,'historicalCompletionFixtureUnchanged':True,'built':'--built' in sys.argv,'networkCalls':0,'productionWrites':0}))
