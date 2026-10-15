"""Independent complete-byte Scope approval, without provider calls."""
import hashlib,json,re,subprocess,sys,os,gzip,math
import xml.etree.ElementTree as ET
from pathlib import Path
from scope_beta_20261014_inverse import BASELINE,VERSION,_fixture as delta,FILES,ADDITIONS,GUARD_FILES,source_before_scope_beta_20261014 as strict,source_at_scope_beta_baseline as conditional,public_source_before_scope_beta_20261014 as public_strict,public_source_at_scope_beta_baseline as public_conditional,source_paths_at_scope_beta_baseline as paths_before,public_paths_at_scope_beta_baseline as public_before,public_source_before_scope_beta_channel_20261014 as channel_strict,public_source_at_scope_beta_channel_baseline as channel_conditional
ROOT=Path(__file__).resolve().parents[1];read=lambda f:(ROOT/f).read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda *a:subprocess.check_output(['git',*a],cwd=ROOT)
EXPECTED_FILES=['404.html', 'Monderman_Platform_Brief.html', 'about.html', 'accept-invite.html', 'accumulated-drag-department-of-war.html', 'after-a-reorganization.html', 'after-an-acquisition.html', 'built-to-please.html', 'canonical-site-shell.js', 'checkout-success.html', 'checkout.html', 'compensatory-systems.html', 'connect.html', 'cross-tool-synthesis.html', 'decision-velocity-article.html', 'decision-velocity.html', 'designing-for-decision-velocity.html', 'deterministic-ai-infrastructure.html', 'diagnostics.html', 'durable-organization.html', 'every-node-for-itself.html', 'fast-to-cut-slow-to-build.html', 'from-tokens-to-outcomes.html', 'governing-complexity.html', 'hold-collide-come-apart.html', 'institutional-performance-article.html', 'institutional-performance.html', 'merit-after-the-machine.html', 'monderman-report.js', 'new-in-the-role.html', 'nothing-stays-tuned.html', 'operational-systems-article.html', 'operational-systems.html', 'pattern-trial.html', 'pilot-feedback.html', 'pilot.html', 'plan-enterprise.html', 'plan-pattern.html', 'plan-signal.html', 'platform-services.html', 'quarter-trillion-friction-us-healthcare.html', 'research.html', 'roi.html', 'sample-report-production.js', 'sample-report.html', 'security.html', 'signin.html', 'site-shell/footer.html', 'site-shell/header.html', 'structural-clarity-article.html', 'structural-clarity.html', 'terminal-fidelity.html', 'the-art-of-interior-reasoning.html', 'the-culture-trap-brief.html', 'the-culture-trap.html', 'the-drift-problem.html', 'the-unmeasured-layer.html', 'transformation-behind-schedule.html', 'trenches-not-silos.html', 'we-gave-bureaucracy-the-fastest-tools.html', 'when-bureaucracy-became-the-obstacle.html', 'why-monderman.html', 'workspace-actions.html', 'workspace-analysis.html', 'workspace-diagnostics.html', 'workspace-settings.html', 'workspace.html', 'index.html', 'homepage-refinement.css', 'enterprise-site.css', 'public-search-index.json', 'sitemap.txt', 'sitemap.xml', 'scripts/site_design_coherence_20261014_inverse.mjs', 'scripts/site_design_coherence_20261014_inverse.py', 'scripts/site_design_coherence_20261014_contract.mjs', 'scripts/site_design_coherence_20261014_contract.py', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/render-static-build.sh', 'scripts/inject-public-shell.mjs', 'scripts/marketing_refresh_browser_smoke.mjs', 'scripts/marketing_completion_browser_smoke.mjs', 'scripts/homepage_assistant_smoke.mjs', 'scripts/homepage_card_rhythm_smoke.mjs', 'scripts/sample_marketing_language_hover_smoke.mjs', 'scripts/sample_tile_smoke.mjs', 'scripts/homepage_sample_discovery_smoke.mjs', 'scripts/site_system_visual_smoke.mjs', 'scripts/homepage_workspace_demo_smoke.mjs', 'scripts/mobile_site_presentation_smoke.mjs', 'scripts/validate_production_cosmetic_certification.py', 'scripts/certification_guard_sensitivity_smoke.py', '.github/workflows/frontend-release.yml', '.github/workflows/sample-report-marketing-certification.yml', 'scripts/build_public_search_index.py', 'scripts/public_sample_fixture.mjs', 'scripts/site_consistency_copy_smoke.mjs', 'scripts/validate_report_presentation.py', 'scripts/public_status_copy_smoke.mjs', 'scripts/report_presentation_smoke.mjs', 'scripts/validate_frontend_release.py', 'scripts/validate_six_product_ecosystem.py', 'scripts/runtime_asset_release_build_smoke.mjs', 'scripts/sample_product_fidelity_smoke.mjs', 'scripts/footer_membership_smoke.mjs', 'scripts/footer_support_smoke.mjs', 'scripts/single_lens_overview_20260929_inverse.mjs', 'scripts/report_overview_horizontal_contract.mjs', 'scripts/marketing_photo_presentation_20261013_browser.mjs', 'scripts/employer_salary_browser_smoke.mjs', 'scripts/brand_surface_consistency_smoke.mjs', 'scripts/public_surface_consistency_smoke.mjs']
EXPECTED_ADDITIONS=['scope.html', 'scope.css', 'scope-release.json', 'scripts/scope_beta_20261014_browser.mjs', 'assets/brand/scope-symbol.svg', 'assets/brand/scope-symbol-reversed.svg', 'q2-sodi.html']
checks=negatives=hunks=immutable=0
def check(v,label):
 global checks
 assert v,label
 checks+=1
def reject(fn,label):
 global checks,negatives
 try:fn()
 except AssertionError:checks+=1;negatives+=1
 else:raise AssertionError(label)
check(BASELINE=='f2a81afdd30863c68b4ae748936163a141b0edd6' and VERSION=='q2-sodi-20261015.5','Exact baseline/version');check(delta['provisional'] is False,'Draft cannot certify');check(git('rev-parse',BASELINE+'^{tree}').decode().strip()=='38b4396e74757fac9f90780e81ca821d41aaa785','Exact baseline tree');check(list(FILES)==EXPECTED_FILES and list(ADDITIONS)==EXPECTED_ADDITIONS,'Separately reviewed finite whitelist');check(list(GUARD_FILES)==['scripts/scope_beta_20261014_inverse.mjs','scripts/scope_beta_20261014_inverse.py','scripts/scope_beta_20261014_contract.mjs','scripts/scope_beta_20261014_contract.py','scripts/fixtures/scope-beta-20261014.json'],'Five guard files')
tracked=git('ls-tree','-r','--name-only',BASELINE).decode().splitlines();check(tracked==delta['baselineSourcePaths'],'Full baseline inventory');framed=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=''.join(BASELINE+':'+f+'\n' for f in tracked).encode());old={};at=0
for f in tracked:
 end=framed.index(b'\n',at);header=framed[at:end].decode();assert re.fullmatch(r'[a-f0-9]{40} blob \d+',header);n=int(header.split()[2]);at=end+1;old[f]=framed[at:at+n];at+=n;assert framed[at:at+1]==b'\n';at+=1
check(at==len(framed),'Complete authoritative framing')
def finite(entries,now_for,old_for,inverse,view):
 global hunks
 for f,e in entries.items():
  b=now_for(f);was=old_for(f,e);check(sha(b)==e['after_sha256'] and sha(was)==e['before_sha256'],'Complete current/prior pins');check(bool(e['replacements']) and e['before_sha256']!=e['after_sha256'],'Real finite delta');encoded=b.decode().encode('utf-16-le');end=0
  for a,z,now,before in e['replacements']:check(type(a) is int and type(z) is int and a>=end and z>=a,'Finite ordered offsets');check(encoded[a*2:z*2].decode('utf-16-le')==now and isinstance(before,str),'Literal UTF16 hunk');end=z;hunks+=1
  for s in [b,b.decode()]:wanted=was if isinstance(s,bytes) else was.decode();check(inverse(f,s)==wanted and type(inverse(f,s)) is type(s),'Full-byte inverse/type');check(view(f,s)==wanted and view(f,wanted)==wanted,'Conditional exact and historical identity')
  mutants=[b+b'\n',b'!'+b[1:],was,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']+[encoded[:a*2].decode('utf-16-le').encode()+b'UNREVIEWED'+encoded[z*2:].decode('utf-16-le').encode() for a,z,_,_ in e['replacements']]
  for m in mutants:reject(lambda m=m:inverse(f,m),'Unknown/hunk/API/double inverse rejects');check(view(f,m)==m,'Unknown bytes visible')
finite(delta['files'],read,lambda f,e:old[f],strict,conditional)
for f in tracked:
 if f in FILES:continue
 check(read(f)==old[f],'Outside scope exact '+f);immutable+=1
cached=git('ls-files','--cached').decode().splitlines();names=set(cached+git('ls-files','--others','--exclude-standard').decode().splitlines());names={f for f in names if (ROOT/f).exists() and not(f=='node_modules' and f not in cached and (ROOT/f).is_symlink())}
def scope(rows):assert len(rows)==len(set(rows)) and sorted(rows)==sorted(tracked+list(ADDITIONS)+list(GUARD_FILES))
scope(names);checks+=1;check(paths_before(names)==set(tracked),'Exact full inventory projection')
for name in ['UNKNOWN.js','.env','.render-public 2','assets/marketing/original-iStock.jpg','font-package.zip']:
 rows=names|{name};reject(lambda rows=rows:scope(rows),'Private/unknown names reject');check(paths_before(rows)==rows,'Unknown remains visible')
rows=list(names);check(paths_before(rows+[rows[0]])==rows+[rows[0]],'Duplicate visible')
for f in ['__proto__','constructor','toString','unknown.js']:
 for s in ['Unknown 😀','Unknown 😀'.encode()]:check(strict(f,s)==s and conditional(f,s)==s and public_strict(f,s)==s and type(strict(f,s)) is type(s),'Unknown identity/type')
for f,e in delta['additions'].items():b=read(f);check(sha(b)==e['sha256'] and len(b)==e['bytes'] and not(ROOT/f).is_symlink(),'Exact real addition '+f)
release_expected={'product':'Monderman Q2-SODI','version':'1.0.0-beta.1','channel':'beta','descriptor':'Advanced organizational diagnostic software','productPage':'q2-sodi.html'}
def release_intent(value):assert value==release_expected
release_intent(json.loads(read('scope-release.json')));checks+=1
for k,v in [('version','1.0.0'),('channel','production'),('productPage','workspace.html'),('descriptor','Scoring system'),('product','Monderman Scope'),('productPage','scope.html')]:reject(lambda k=k,v=v:release_intent({**release_expected,k:v}),'Wrong release identity rejects')
index=read('index.html').decode();prior_index=old['index.html'].decode()
def sample(s,selector):
 a=s.index(selector);z=s.index('</aside>',a);assert z>a;return s[a:z+8]
for selector in ['<aside class="hero-report-proof has-sample-depth-tile"','<aside class="home-workspace-preview"']:check(sample(index,selector)==sample(prior_index,selector),'Whole scored sample/qualifier/binding unchanged')
check(re.search(r'data-promo-score>(\d+)<',index).group(1)=='52','Real hero52');check('data-artifact-sha256="5c351c9a7ed42f34bbbda135e1c5e57c44492246b67350bd5b00174608c0eea0"' in index,'Original artifact digest')
def qualitative_intent(s):
 a=s.index('<section class="mr-scenario"');z=s.index('<section class="measurement-loop"',a);block=s[a:z];panels=list(re.finditer(r'<section\b[^>]*data-lens-panel="([^"]+)"[\s\S]*?</section>',block));assert [p.group(1) for p in panels]==['clarity','velocity','systems','performance']
 for p in panels:assert re.findall(r'<li><strong>([^<]+)</strong>',p.group())==['Request','Review','Decision','Completion'] and not re.search(r'supplier|onboarding|\b\d+(?:\.\d+)?\s*(?:%|/\s*100)|data-preview-amount|data-promo-score',p.group(),re.I)
 assert len({re.sub(r'data-lens-panel="[^"]+"','',p.group()) for p in panels})==4
qualitative_intent(index);checks+=1
for a,z in [('<strong>Request</strong>','<strong>Supplier onboarding</strong>'),('data-lens-panel="performance"','data-lens-panel="velocity"'),('<strong>Review</strong>','<strong>Review 75%</strong>')]:m=index.replace(a,z,1);check(m!=index,'Meaningful mutant');reject(lambda m=m:qualitative_intent(m),'Non-generic/numeric/duplicate panel rejects')
# The new renderer reader recovers every original pin/VM byte with only the exact known presentation seam removed.
renderer_import="import {sourceAtScopeBetaBaseline} from './scope_beta_20261014_inverse.mjs';\n"
renderer_read="      const rawSource=fs.readFileSync(path.join(root,file));\n      const raw=file==='monderman-report.js'?sourceAtScopeBetaBaseline(file,rawSource):rawSource;"
original_renderer_read="      const raw=fs.readFileSync(path.join(root,file));"
def renderer_reader_intent(s):assert s.count(renderer_import)==1 and s.count(renderer_read)==1 and s.replace(renderer_import,'',1).replace(renderer_read,original_renderer_read,1)==old['scripts/public_sample_fixture.mjs'].decode()
renderer_reader=read('scripts/public_sample_fixture.mjs').decode();renderer_reader_intent(renderer_reader);checks+=1
for a,b in [(renderer_import,''),("file==='monderman-report.js'?sourceAtScopeBetaBaseline(file,rawSource):rawSource","sourceAtScopeBetaBaseline(file,rawSource)"),("file==='monderman-report.js'","file==='participant-evidence-safety.js'"),("assert.equal(sha(bytes),edition.source_files[file],'HTML binding source changed: '+file);",";"),("vm.runInNewContext(bytes.toString(),context,{filename:file});",";")]:
 m=renderer_reader.replace(a,b,1);check(m!=renderer_reader,'Meaningful historical reader mutant');reject(lambda m=m:renderer_reader_intent(m),'Missing/broader/wrong reader or removed pin/VM rejects')
actual_sample=read('sample-report.html').decode();baseline_sample=old['sample-report.html'].decode();current_disclosure='These reports use realistic example responses to demonstrate Q²-SODI’s analysis and reporting.'
def sample_disclosure_intent(s):
 assert s.count(current_disclosure)==1
 notice=re.search(r'<div class="notice">[\s\S]*?</div>\s*</div>',s);previous=re.search(r'<div class="notice">[\s\S]*?</div>\s*</div>',baseline_sample);assert notice and previous and notice.group().replace('Q²-SODI’s','Monderman’s',1)==previous.group()
 method=re.search(r'<details class="sample-library-method">[\s\S]*?</details>',s);old_method=re.search(r'<details class="sample-library-method">[\s\S]*?</details>',baseline_sample);assert method and old_method and method.group().replace('Q²-SODI has four diagnostics','Monderman has four diagnostics',1)==old_method.group()
sample_disclosure_intent(actual_sample);checks+=1
for a,b in [(current_disclosure,'Actual results from this organization.'),(current_disclosure,current_disclosure+current_disclosure),('Q²-SODI’s analysis','Q²-SODI’s scoring'),('responses from 15 people','responses from 16 people'),('do not present organizational savings','present organizational savings')]:
 m=actual_sample.replace(a,b,1);check(m!=actual_sample,'Meaningful current qualification mutant');reject(lambda m=m:sample_disclosure_intent(m),'Missing/duplicate/weaker qualification or changed methodology rejects')
page=read('q2-sodi.html').decode()
def page_intent(s):assert 'Q²-SODI' in s and re.search(r'\bBeta\b',s) and re.search('advanced organizational diagnostic software',s,re.I) and re.search(r'href="scope\.css(?:\?[^"]+)?"',s) and not re.search(r'<form\b|fetch\(|supabase|createClient\(|/api/',s,re.I) and re.search(r'<footer\b[\s\S]*?</footer>',s) and not s[s.lower().rfind('</html>')+7:].strip()
page_intent(page);checks+=1
for a,z in [('Q²-SODI','UNBRANDED'),('Beta','Released'),('Advanced organizational diagnostic software','Score calculator'),('</html>','</html>Stray text')]:m=page.replace(a,z);reject(lambda m=m:page_intent(m),'Missing identity/Beta or stray copy rejects') if m!=page else None
# The old Scope route remains a complete alias of the canonical Q2-SODI page.
def q2_page_intent(s):
 page_intent(s)
 assert re.search(r'<title>Q2-SODI Beta \| Advanced organizational diagnostic software</title>',s) and re.search(r'<meta property="og:title" content="Q2-SODI Beta \| Advanced organizational diagnostic software">',s)
 assert re.findall(r'<link\s+rel="canonical"\s+href="([^"]+)"\s*/?>',s)==['https://www.monderman.com/q2-sodi.html'] and re.findall(r'<meta\s+property="og:url"\s+content="([^"]+)"\s*/?>',s)==['https://www.monderman.com/q2-sodi.html']
 assert s.count('<span class="scope-product-name">Q²-SODI<sup class="scope-trademark" aria-label="trademark">&trade;</sup></span>')==1
def q2_alias_intent(primary,alias):
 assert isinstance(primary,str) and isinstance(alias,str)
 q2_page_intent(primary);q2_page_intent(alias);assert primary==alias
q2_alias_intent(page,read('scope.html').decode());checks+=1
for a,b in [('https://www.monderman.com/q2-sodi.html','https://www.monderman.com/scope.html'),('<link rel="canonical"','<link rel="alternate"'),('<meta property="og:url"','<meta property="og:unknown"'),('<title>Q2-SODI Beta','<title>Q²-SODI Beta'),('Q²-SODI<sup','Q2-SODI<sup'),('&trade;</sup>','</sup>'),('<link rel="canonical" href="https://www.monderman.com/q2-sodi.html">','<link rel="canonical" href="https://www.monderman.com/q2-sodi.html"><link rel="canonical" href="https://www.monderman.com/q2-sodi.html">')]:
 m=page.replace(a,b);check(m!=page,'Meaningful canonical/plain/display/trademark mutant');reject(lambda m=m:q2_page_intent(m),'Wrong/missing/duplicate canonical or display/plain identity rejects')
reject(lambda:q2_alias_intent(page,None),'Missing retained alias rejects');reject(lambda:q2_alias_intent(page,page.replace('Available by invitation.','Altered admission.',1)),'Divergent retained alias rejects')
# Parse the approved symbol independently as XML: four concentric strokes, three equal gaps,45-degree tail and no center dot.
def q_symbol_intent(s,reversed_symbol):
 try:svg=ET.fromstring(s)
 except ET.ParseError:raise AssertionError('Malformed symbol XML')
 tag=lambda e:e.tag.removeprefix('{http://www.w3.org/2000/svg}')
 assert svg.tag=='{http://www.w3.org/2000/svg}svg' and svg.attrib=={'viewBox':'0 0 256 256','aria-hidden':'true','focusable':'false'} and [tag(c) for c in svg]==['defs','g']
 colors=[['#C4E1E3','#A9D0D4','#57A0A8'],['#E3F1F1','#A9D0D4','#67ABB2'],['#F5F3ED','#DCEDED','#A9D0D4']] if reversed_symbol else [['#18818C','#0C6E78','#08383E'],['#6CAFBA','#248B96','#0C6E78'],['#A9D0D4','#56A4AE','#126E78']]
 gradients=list(svg[0]);assert len(gradients)==3
 for i,g in enumerate(gradients):
  assert tag(g)=='linearGradient' and g.attrib=={'id':['scope-outer','scope-middle','scope-inner'][i],'gradientUnits':'userSpaceOnUse','x1':'48','y1':'36','x2':'208','y2':'228'} and [tag(c) for c in g]==['stop','stop','stop'] and [c.attrib for c in g]==[{'offset':offset,'stop-color':colors[i][j]} for j,offset in enumerate(['0','0.48','1'])]
 group=svg[1];assert group.attrib=={'fill':'none','stroke-linecap':'butt','stroke-linejoin':'round'} and [tag(c) for c in group]==['circle','path','path','path','path']
 geometry=[c.attrib for c in group];assert geometry[0]=={'cx':'128','cy':'128','r':'100','stroke':'url(#scope-outer)','stroke-width':'20'}
 def close(actual,expected):assert math.isfinite(actual) and abs(actual-expected)<=1e-8
 def point(radius,angle):return [128+radius*math.cos(math.radians(angle)),128+radius*math.sin(math.radians(angle))]
 number=r'(\d+(?:\.\d+)?)';arc_re='M'+number+' '+number+' A'+number+' '+number+' '+number+' '+number+' '+number+' '+number+' '+number
 for i,(radius,width,start,end,paint) in enumerate([(71,18,45,225,'scope-middle'),(44,16,45,225,'scope-inner'),(19,14,45,225,'scope-inner')]):
  a=geometry[i+1];assert sorted(a)==['d','stroke','stroke-width'] and a['stroke']=='url(#'+paint+')' and a['stroke-width']==str(width)
  m=re.fullmatch(arc_re,a['d']);assert m;v=list(map(float,m.groups()));assert v[2:7]==[radius,radius,0,0,1]
  for actual,expected in zip(v[:2],point(radius,start)):close(actual,expected)
  for actual,expected in zip(v[7:],point(radius,end)):close(actual,expected)
 tail=geometry[4];assert sorted(tail)==['d','stroke','stroke-width'] and tail['stroke']=='url(#scope-outer)' and tail['stroke-width']=='16'
 m=re.fullmatch('M'+number+' '+number+' L'+number+' '+number,tail['d']);assert m;t=list(map(float,m.groups()))
 for actual,expected in zip(t[:2],point(90,45)):close(actual,expected)
 assert t[2:]==[225,225];close(t[1]-128,t[0]-128);close(t[3]-128,t[2]-128)
 radii=[100,71,44,19];widths=[int(a['stroke-width']) for a in geometry[:4]];assert [radius-widths[i]/2-(radii[i+1]+widths[i+1]/2) for i,radius in enumerate(radii[:3])]==[10,10,10]
for file,reversed_symbol in [('assets/brand/scope-symbol.svg',False),('assets/brand/scope-symbol-reversed.svg',True)]:
 s=read(file).decode();q_symbol_intent(s,reversed_symbol);checks+=1
 for a,b in [('r="100"','r="99"'),('stroke-width="20"','stroke-width="18"'),('A71 71','A70 70'),('stroke-width="18"','stroke-width="17"'),('A44 44 0 0 1','A44 44 0 1 1'),('A19 19','A18 18'),('<path d="M141.435028843 141.435028843 A19 19 0 0 1 114.564971157 114.564971157" stroke="url(#scope-inner)" stroke-width="14"/>',''),('M191.639610307 191.639610307','M190.639610307 191.639610307'),('L225 225','L224 225'),('L225 225" stroke="url(#scope-outer)" stroke-width="16"','L225 225" stroke="url(#scope-outer)" stroke-width="14"'),('</g>','<circle cx="128" cy="128" r="10" stroke="url(#scope-inner)" stroke-width="8"/></g>'),('M159.112698372 159.112698372 A44','M128.000000000 172.000000000 A44'),('M141.435028843 141.435028843 A19 19 0 0 1 114.564971157 114.564971157','M128.000000000 147.000000000 A19 19 0 0 1 109.000000000 128.000000000'),('stroke-linecap="butt"','stroke-linecap="round"'),('offset="0.48"','offset="0.5"')]:
  m=s.replace(a,b,1);check(m!=s,'Meaningful symbol profile mutant');reject(lambda m=m:q_symbol_intent(m,reversed_symbol),'Unknown radius/angle/stroke/tail/center/gap/gradient rejects')
protected=[f for f in tracked if f.startswith(('sample-data/','scripts/fixtures/','pdf-src/')) or f.endswith('.pdf') or re.match(r'^(?:terms|privacy|subprocessors|outreach-privacy)',f)]
for f in protected:check(f not in FILES and read(f)==old[f],'Scoring/data/old fixture/legal/PDF unchanged '+f)
def home_route_intent(html,sizes):assert not re.search(r'''<(?:link|script)\b[^>]*(?:href|src)=["']scope\.css(?:\?[^"']*)?["']''',html,re.I) and all(type(n) is int and n>=0 for n in sizes) and sum(sizes)<=65536
home_route_intent(index,[len(read(f)) for f in ['marketing-refresh.css','marketing-refresh.js','marketing-completion.css','marketing-completion.js','marketing-photo-presentation.css','marketing-photo-presentation.js','homepage-refinement.css','homepage-refinement.js']]);checks+=1;reject(lambda:home_route_intent(index.replace('</head>','<link rel="stylesheet" href="scope.css"></head>'),[]),'Accidental ScopeCSS homepage injection rejects');reject(lambda:home_route_intent(index,[65537]),'Same old route cap');reject(lambda:home_route_intent(index,[float('nan')]),'Invalid route sizes')
runtime=['marketing-refresh.css','marketing-refresh.js','marketing-completion.css','marketing-completion.js','marketing-photo-presentation.css','marketing-photo-presentation.js','homepage-refinement.css','homepage-refinement.js'];total=sum(len(read(f)) for f in runtime);check(total<=65536,'Same eight homepage assets64KiB cap');check(len(read('scope.css'))<=65536,'Same64KiB ceiling on separate ScopeCSS route');scope_extra_assets=['scope.css','assets/brand/scope-symbol.svg','assets/brand/scope-symbol-reversed.svg'];scope_extra_bytes=sum(len(read(f)) for f in scope_extra_assets);check(scope_extra_bytes<=65536,'Separate Scope CSS/vector64KiB ceiling');gzip_bytes=sum(len(gzip.compress(read(f),mtime=0)) for f in runtime);reject(lambda:check(total+65536<=65536,'Over budget'),'Runtime overflow rejects');check('legal-document-manifest.json public-search-index.json scope-release.json "$publish_dir/"' in read('scripts/render-static-build.sh').decode(),'Exact named public manifest allowlist');check(read('.github/workflows/pages-protected-deploy.yml')==old['.github/workflows/pages-protected-deploy.yml'],'Protected Pages exact')
for f in ['.github/workflows/frontend-release.yml','.github/workflows/sample-report-marketing-certification.yml']:
 now=read(f).decode();was=old[f].decode()
 for line in was.splitlines():
  if re.search(r'node scripts/|python scripts/|timeout-minutes:|cancel-in-progress:',line):check(line in now,'Original full command/limit retained')
 for command in ['node scripts/scope_beta_20261014_contract.mjs','python scripts/scope_beta_20261014_contract.py']:check(command in now,'Both new raw gates mandatory')
workflow=read('.github/workflows/sample-report-marketing-certification.yml').decode()
def schedule(s):
 for x in ['SCOPE_BETA_OUT=/tmp/report-presentation-smoke/scope-beta node scripts/scope_beta_20261014_browser.mjs','scope_beta_pid=$!','wait "$scope_beta_pid"','scope_beta_status=$?','cat /tmp/report-presentation-smoke/scope-beta.log','test "$scope_beta_status" -eq 0','wait "$coherence_workspace_pid"','wait "$coherence_gold_pid"','test "$coherence_workspace_status" -eq 0','test "$coherence_gold_status" -eq 0','timeout-minutes: 60']:assert s.count(x)==1
schedule(workflow);checks+=1
for x in ['wait "$scope_beta_pid"','test "$scope_beta_status" -eq 0','cat /tmp/report-presentation-smoke/scope-beta.log']:reject(lambda x=x:schedule(workflow.replace(x,'REMOVED')),'Missing independent wait/log/status rejects')
def shape(rows,names):
 assert len(rows)==len({r['path'] for r in rows}) and sorted(r['path'] for r in rows)==sorted(names)
 for r in rows:assert isinstance(r['path'],str) and not Path(r['path']).is_absolute() and '..' not in r['path'].split('/') and type(r['bytes']) is int and r['bytes']>=0 and re.fullmatch('[a-f0-9]{64}',r['sha256'])
shape(delta['baselinePublicMap'],delta['baselinePublicPaths']);shape(delta['currentPublicMap'],delta['currentPublicPaths']);checks+=2;check(len(delta['baselinePublicPaths'])==322,'Baseline public322');check(delta['currentPublicPaths']==sorted(delta['baselinePublicPaths']+list(delta['publicAdditions'])),'Only finite public additions');reject(lambda:shape(delta['currentPublicMap']+[delta['currentPublicMap'][0]],delta['currentPublicPaths']),'Duplicate map rejects');reject(lambda:shape([{**r,'path':'../private'} if not i else r for i,r in enumerate(delta['currentPublicMap'])],delta['currentPublicPaths']),'Unsafe map rejects')
if '--built' in sys.argv:
 build=Path(os.environ.get('SCOPE_BETA_BUILD_ROOT',ROOT/'.render-public'));edition=json.loads((build/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel'];check(edition in delta['publicEditions'],'Known whole channel');names=sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file());check(not any(p.is_symlink() for p in build.rglob('*')),'No compiled symlinks');check(names==delta['currentPublicPaths'],'Full compiled closure');check(public_before(names)==delta['baselinePublicPaths'],'Exact current public projection');check(public_before(names+['UNKNOWN'])==names+['UNKNOWN'],'Unknown visible');bm={r['path']:r for r in delta['baselinePublicMap']}
 finite(delta['publicFiles'],lambda f:channel_conditional(f,(build/f).read_bytes()),lambda f,e:public_strict(f,(build/f).read_bytes()),public_strict,public_conditional)
 def forward(f,b):
  e=delta['channelVariants'][f];assert sha(b)==e['before_sha256'];text=b.decode().encode('utf-16-le');shift=0;rows=[]
  for a,z,now,before in e['replacements']:
   prior=before.encode('utf-16-le');current=now.encode('utf-16-le');rows.append((a*2+shift,current,prior));shift+=len(prior)-len(current)
  for begin,current,prior in reversed(rows):assert text[begin:begin+len(prior)]==prior;text=text[:begin]+current+text[begin+len(prior):]
  out=text.decode('utf-16-le').encode();assert sha(out)==e['after_sha256'];return out
 finite(delta['channelVariants'],lambda f:forward(f,channel_conditional(f,(build/f).read_bytes())),lambda f,e:channel_conditional(f,(build/f).read_bytes()),channel_strict,channel_conditional)
 for f,e in delta['publicAdditions'].items():b=(build/f).read_bytes();check(sha(b)==e['sha256'] and len(b)==e['bytes'],'Exact approved public addition')
 for r in delta['publicEditions'][edition]:
  if r['path']=='.well-known/monderman-release.json':continue
  b=(build/r['path']).read_bytes();check(sha(b)==r['sha256'] and len(b)==r['bytes'],'Every compiled body current exact')
 for f in runtime+['scope.css']:check((build/f).read_bytes()==read(f),'Raw current route runtime/build equality')
 release_intent(json.loads((build/'scope-release.json').read_bytes()));checks+=1
 q2_alias_intent((build/'q2-sodi.html').read_text(),(build/'scope.html').read_text());checks+=1
 for file,reversed_symbol in [('assets/brand/scope-symbol.svg',False),('assets/brand/scope-symbol-reversed.svg',True)]:q_symbol_intent((build/file).read_text(),reversed_symbol);checks+=1
 check(json.loads((build/'.well-known/monderman-release.json').read_bytes())['revision']==os.environ.get('RENDER_GIT_COMMIT'),'Actual build marker revision')
print(json.dumps({'ok':True,'checks':checks,'negativeControls':negatives,'finiteFiles':len(FILES),'hunks':hunks,'immutableFiles':immutable,'protectedFiles':len(protected),'runtimeBytes':total,'runtimeGzipBytes':gzip_bytes,'scopeExtraAssetBytes':scope_extra_bytes,'scopeExtraAssetGzipBytes':sum(len(gzip.compress(read(f),mtime=0)) for f in scope_extra_assets),'scopeCssBytes':len(read('scope.css')),'scopeCssGzipBytes':len(gzip.compress(read('scope.css'),mtime=0)),'publicFiles':len(delta['currentPublicPaths']),'built':'--built' in sys.argv,'networkCalls':0,'productionWrites':0}))
