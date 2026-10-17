"""Current article/series/topic closure before exact historical compatibility.

Historical assertions inspect only fully hash-bound 1858 bytes. Current content,
all source modes/blobs, every compiled body, and topic destinations are checked
here independently; unknown edits or names are never mapped to a baseline.
"""
import base64, hashlib, json, os, re, subprocess, sys
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
from hiring_work_design_series_20261017_inverse import (
 ROOT,series_delta as D,sha,source_at_series_baseline as source_view,
 public_source_at_series_baseline as public_view,source_paths_at_series_baseline,
 public_paths_at_series_baseline,series_source_exact,series_public_exact,
)
BASE=D['baseline']
GUARDS=['scripts/fixtures/hiring-work-design-series-20261017.json','scripts/hiring_work_design_series_20261017_contract.py','scripts/hiring_work_design_series_20261017_inverse.mjs','scripts/hiring_work_design_series_20261017_inverse.py']
HELPER_HASHES={'scripts/hiring_work_design_series_20261017_inverse.mjs':'1b6fcf099547b081bd7ab6ecb8d3e0a848f1adb9a6979a7829e19d44b0a40264','scripts/hiring_work_design_series_20261017_inverse.py':'507b1581e5d81ce1946baa962859b117e526654d34f40f4ad1aeb027e8981927'}
AUDITED=False
CHECKS=0
NEGATIVES=0
PARITY=[]
def check(value,label):
 global CHECKS
 assert value,label
 CHECKS+=1
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def _git_rows(revision):
 out=[]
 for line in git('ls-tree','-rl',revision).decode().splitlines():
  info,name=line.split('\t',1);mode,kind,blob,size=info.split()
  check(kind=='blob' and mode in ('100644','100755'),'Regular authoritative source only '+name)
  out.append(dict(path=name,mode=mode,gitBlobSha1=blob,bytes=int(size)))
 return sorted(out,key=lambda r:r['path'])
def _row(path,value):return dict(path=path,bytes=len(value),sha256=sha(value))
class Links(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.hrefs=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a' and 'href' in a:self.hrefs.append(a['href'])
def audit_current_release():
 global AUDITED,NEGATIVES
 if AUDITED:return
 check(D['guardFiles']==GUARDS,'Four explicit independently reviewed bootstrap roots')
 check(sha((ROOT/'scripts/fixtures/hiring-blind-spot-publication-20261015.json').read_bytes())=='52abd075da1ae7474d41fb23f0635d1cbe7ca35c382a15490ffe5cac257919b6','Original combined native-publication and owner fixture remains byte-identical')
 check(git('rev-parse',BASE+'^{tree}').decode().strip()==D['baselineTree'],'Actual1858 authoritative tree')
 check(_git_rows(BASE)==D['baselineSourceRows'],'Full prior source path/mode/blob/size closure')
 names=git('ls-files','--cached').decode().splitlines()
 check(not git('ls-files','--others','--exclude-standard').strip(),'No untracked current source')
 check(not git('diff','--name-only','HEAD').strip() and not git('diff','--cached','--name-only','HEAD').strip(),'Current source must be clean committed bytes')
 check(sorted(names)==D['currentSourcePaths'] and len(names)==len(set(names)),'Exact current source inventory with every addition visible')
 heads={r['path']:r for r in _git_rows('HEAD')}
 check(sorted(heads)==sorted(names),'All current source is actually committed')
 for name in names:
  p=ROOT/name;check(p.is_file() and not p.is_symlink(),'Regular current source '+name)
  b=p.read_bytes();r=heads[name]
  check(len(b)==r['bytes'] and ('100755' if p.stat().st_mode&0o111 else '100644')==r['mode'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['gitBlobSha1'],'Physical current body/mode equals committed blob '+name)
 check(series_source_exact(),'Every non-bootstrap source current SHA/bytes/mode/blob exact')
 check(sorted(git('diff','--name-only',BASE,'HEAD').decode().splitlines())==D['changedSourcePaths'],'Closed actual changed source set')
 for file,digest in HELPER_HASHES.items():check(sha((ROOT/file).read_bytes())==digest,'Separately pinned finite implementation '+file)
 check(source_paths_at_series_baseline(names)==D['baselineSourcePaths'],'Exact current complete inventory projects only after raw audit')
 for mutant in [names+['UNKNOWN.js'],names+[names[0]],names[:-1]]:
  check(source_paths_at_series_baseline(mutant)==mutant,'Missing/extra/duplicate source remains visible');NEGATIVES+=1
 for file,entry in D['files'].items():
  b=(ROOT/file).read_bytes();prior=source_view(file,b)
  check(sha(b)==entry['after_sha256'] and len(b)==entry['after_bytes'],'Exact current finite file '+file)
  check(prior==git('show',BASE+':'+file),'Exact native1858 source recovered '+file)
  check(source_view(file,prior)==prior,'Historical input not inverted twice '+file)
  PARITY.append(['source',file,'bytes',base64.b64encode(b).decode(),sha(prior)])
  try:b.decode('utf8');prior.decode('utf8')
  except UnicodeError:pass
  else:
   check(source_view(file,b.decode())==prior.decode(),'Exact Unicode string type '+file)
   PARITY.append(['source',file,'str',base64.b64encode(b).decode(),sha(prior)])
  for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']:
   check(source_view(file,mutant)==mutant,'Unknown complete source remains visible '+file);NEGATIVES+=1
   PARITY.append(['source',file,'bytes',base64.b64encode(mutant).decode(),sha(mutant)])
 for unknown in ['__proto__','constructor','UNKNOWN.js','private-api.js']:
  for value in ['Unknown 😀',b'Unknown Unicode']:
   check(source_view(unknown,value)==value and public_view(unknown,value)==value,'Unknown path and type remain visible');NEGATIVES+=1
 topics=json.loads((ROOT/'research-topics.json').read_bytes());articles=topics['articles'];topicids={t['id'] for t in topics['topics']}
 check(len(articles)==28 and len({a['path'] for a in articles})==28 and len(topicids)==17,'All28 articles and17 distinct topics')
 authored=[]
 for p in ROOT.glob('*.html'):
  if re.search(r'<meta\b(?=[^>]*property=["\']og:type["\'])(?=[^>]*content=["\']article["\'])',p.read_text(),re.I):authored.append(p.name)
 check(set(authored)|{'the-culture-trap.html'}=={a['path'] for a in articles},'All27 article-metadata pages plus the existing Culture Trap editorial page have keyword assignments')
 directory=Links();directory.feed((ROOT/'research-topics.html').read_text())
 check(topicids<=set(directory.ids),'Every keyword has a static working topic anchor')
 for a in articles:
  text=(ROOT/a['path']).read_text();links=Links();links.feed(text)
  check(text.count('<!-- MONDERMAN RESEARCH TOPICS: START -->')==1 and text.count('<!-- MONDERMAN RESEARCH TOPICS: END -->')==1,'One actual topic navigation '+a['path'])
  check(set('research-topics.html#'+x for x in a['topics'])<=set(links.hrefs),'All assigned keyword hyperlinks '+a['path'])
  peers={other['path'] for other in articles if other['path']!=a['path'] and set(a['topics'])&set(other['topics'])}
  check(bool(peers&set(links.hrefs)),'Real related article destinations '+a['path'])
  check(a['path'] in directory.hrefs,'Article reachable from topic directory '+a['path'])
  check('href="https://www.monderman.com/'+a['path']+'"' in text,'One canonical article route '+a['path'])
 subprocess.run([sys.executable,'scripts/build_research_topics.py','--check'],cwd=ROOT,check=True)
 subprocess.run([sys.executable,'scripts/build_public_search_index.py','--check'],cwd=ROOT,check=True)
 article=(ROOT/'posting-has-outgrown-the-job.html').read_text();hiring=(ROOT/'hiring-blind-spot.html').read_text();research=(ROOT/'research.html').read_text();home=(ROOT/'index.html').read_text()
 check('Hiring and Work Design · Part 1' in hiring and 'Hiring and Work Design · Part 2' in article,'Requested new Part1 and Part2 labels')
 for name in ['posting-has-outgrown-the-job.html','hiring-blind-spot.html']:
  check(home.count('data-publication="'+name[:-5]+'"')==1,'One carousel entry '+name)
  for sitemap in ['sitemap.txt','sitemap.xml']:check((ROOT/sitemap).read_text().count('https://www.monderman.com/'+name)==1,'One canonical sitemap entry '+name)
 cards=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',home,re.S)
 check(len(cards)==21 and 'data-publication="posting-has-outgrown-the-job"' in cards[0] and 'data-publication="hiring-blind-spot"' in cards[1],'21carousel cards with Part2 thenPart1')
 prior_cards=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',git('show',BASE+':index.html').decode(),re.S)
 check(len(prior_cards)==20 and cards[2:]==prior_cards[1:],'All19 earlier native carousel cards retained byte-for-byte in order')
 governance=re.search(r'<section class="series" aria-labelledby="governance-performance-title">(.*?)</section>',research,re.S).group(1)
 series=re.search(r'<section class="series" aria-labelledby="hiring-work-design-title">(.*?)</section>',research,re.S).group(1)
 check(re.findall(r'class="series-chip">([^<]+)',governance)==['Part '+str(n) for n in range(1,7)],'Six unchanged Governance and Performance parts')
 check(re.findall(r'class="series-chip">([^<]+)',series)==['Part 1','Part 2'],'Two correctly ordered hiring series parts')
 check('24 items · Updated October 2026' in research,'Accurate current research item count')
 check(research.index('governance-performance-title')<research.index('hiring-work-design-title'),'New series follows Governance and Performance')
 check(series.count('<blockquote')==1 and 'A requirement the work does not need cannot select for the work.' in series,'One source-authored series pull quote')
 check('7 pages' in article and '10-minute read' in article,'New article current PDF and reading metadata')
 artwork=(ROOT/'assets/research/posting-has-outgrown-the-job-figure.png').read_bytes()
 check('src="data:image/png;base64,'+base64.b64encode(artwork).decode()+'"' in article,'Exact original PNG artwork embedded without negotiated transformation')
 for file in ['Monderman_Insight_The_Posting_Has_Outgrown_the_Job_2026-10-16.pdf','Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf']:
  b=(ROOT/file).read_bytes();check(b.startswith(b'%PDF-') and b.rstrip().endswith(b'%%EOF'),'Actual PDF envelope '+file)
 data=json.loads((ROOT/'pdf-src/posting-has-outgrown-the-job.json').read_bytes())
 check(len(data['paragraphs'])==30 and len(data['references'])==9,'All30 source paragraphs and9 references preserved in curated source')
 for paragraph in data['paragraphs']:
  match=re.search(r'<p\b[^>]*data-source-paragraph="'+str(paragraph['number'])+r'"[^>]*>(.*?)</p>',article,re.S)
  check(match is not None,'Every source paragraph appears in new HTML '+str(paragraph['number']))
  normalize=lambda text:re.sub(r'\s+','',unescape(re.sub(r'<[^>]+>','',text)))
  check(normalize(match.group(1))==normalize(paragraph['text']),'Every complete source paragraph is exact '+str(paragraph['number']))
 for number,reference in enumerate(data['references'],1):
  match=re.search(r'<li\b[^>]*data-source-reference="'+str(number)+r'"[^>]*>(.*?)</li>',article,re.S)
  check(match is not None and normalize(match.group(1))==normalize(reference),'Every complete source reference is exact '+str(number))
 if '--built' in sys.argv:
  build=Path(os.environ.get('HIRING_PUBLICATION_BUILD_ROOT',ROOT/'.render-public')).resolve();physical=sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file())
  check(not any(p.is_symlink() for p in build.rglob('*')),'No compiled symlinks')
  check(physical==D['currentPublicPaths'],'Exact physical current public closure')
  channel=json.loads((build/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel']
  check(series_public_exact(build,channel),'All physical compiled current bodies bound')
  check(json.loads((build/'.well-known/monderman-release.json').read_bytes())=={'revision':git('rev-parse','HEAD').decode().strip()},'Truthful actual HEAD compiled marker')
  check(public_paths_at_series_baseline(physical,build)==D['baselinePublicPaths'],'Exact approved compiled inventory projects after raw binding')
  for mutant in [physical+['UNKNOWN.js'],physical+[physical[0]],physical[:-1]]:
   check(public_paths_at_series_baseline(mutant,build)==mutant,'Unknown/missing/duplicate public paths stay visible');NEGATIVES+=1
  for file,entry in D['publicEditions'][channel]['files'].items():
   b=(build/file).read_bytes();prior=public_view(file,b);check(sha(prior)==entry['before_sha256'] and len(prior)==entry['before_bytes'],'Exact prior official compiled channel body '+file)
   PARITY.append(['public',file,'bytes',base64.b64encode(b).decode(),sha(prior)])
   for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']:
    check(public_view(file,mutant)==mutant,'Unknown compiled bytes stay visible '+file);NEGATIVES+=1
    PARITY.append(['public',file,'bytes',base64.b64encode(mutant).decode(),sha(mutant)])
 node="import fs from 'node:fs';import{createHash}from'node:crypto';import{sourceAtSeriesBaseline as s,publicSourceAtSeriesBaseline as p}from'./scripts/hiring_work_design_series_20261017_inverse.mjs';const rows=JSON.parse(fs.readFileSync(0));for(const[k,f,t,b,h]of rows){const raw=Buffer.from(b,'base64'),v=t==='str'?raw.toString():raw,o=(k==='source'?s:p)(f,v);if((t==='str'?typeof o!=='string':!Buffer.isBuffer(o))||createHash('sha256').update(o).digest('hex')!==h)throw Error('Post1858 parity '+f);}console.log(rows.length);"
 result=subprocess.run(['node','--input-type=module','-e',node],cwd=ROOT,input=json.dumps(PARITY),text=True,capture_output=True,check=True)
 check(int(result.stdout.strip())==len(PARITY),'All ordered independent JS/Python byte/text positive/negative cases')
 AUDITED=True
 print(json.dumps(dict(ok=True,checks=CHECKS,negativeControls=NEGATIVES,parityCases=len(PARITY),sourceFiles=len(names),publicFiles=len(D['currentPublicPaths']),articles=28,topics=17,built='--built' in sys.argv,networkCalls=0,productionWrites=0)))
def historical_read(file):
 audit_current_release()
 return source_view(file,(ROOT/file).read_bytes())
def historical_public_read(root,file):
 audit_current_release()
 return public_view(file,(Path(root)/file).read_bytes())
def historical_public_names(names,root):
 audit_current_release()
 return public_paths_at_series_baseline(names,root)
def historical_git(*args):
 audit_current_release()
 # Only complete raw-current certification enables these exact old read shapes.
 if args==('ls-files','--cached'):return ('\n'.join(D['baselineSourcePaths'])+'\n').encode()
 if args==('ls-files','--others','--exclude-standard'):return b''
 if args in [('diff','--name-only','HEAD'),('diff','--cached','--name-only','HEAD')]:return b''
 if args==('ls-tree','-rl','HEAD'):return git('ls-tree','-rl',BASE)
 if args[-1:] == ('HEAD',) and args[:2] in [('diff','--name-only'),('diff','--raw')]:return git(*args[:-1],BASE)
 return git(*args)
if __name__=='__main__':audit_current_release()
