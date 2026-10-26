"""Current Part7 publication certification before finite historical views.

All current source/public bytes and inventories are checked directly. The
projection admits only this exact reviewed editorial change; unknown changes,
missing files, duplicate paths and mutated content are rejected or left visible.
"""
import base64, hashlib, json, os, re, subprocess, sys
from pathlib import Path
from html import unescape
from divide_rule_publication_20261025_inverse import (
 ROOT, publication_delta as D, sha, source_at_publication_baseline as source_view,
 public_source_at_publication_baseline as public_view,
 source_paths_at_publication_baseline as source_paths,
 public_paths_at_publication_baseline as public_paths,
 publication_source_exact, publication_public_exact,
)

AUDITED=False
CHECKS=0
NEGATIVES=0
BASE='1c0ba0bd8107e9fab611ccde151007e629cad0da'
TITLE='Divide and Rule Inside the Company'
SUBTITLE='How rival divisions end up serving one person instead of the market.'
ARTICLE='divide-and-rule-inside-the-company.html'
PDF='Monderman_Insight_Divide_and_Rule_Inside_the_Company_2026-10-25.pdf'
GUARDS=['scripts/divide_rule_publication_20261025_contract.py','scripts/divide_rule_publication_20261025_inverse.mjs','scripts/divide_rule_publication_20261025_inverse.py','scripts/fixtures/divide-rule-publication-20261025.json']
def check(value,label):
 global CHECKS
 assert value,label
 CHECKS+=1
def raw_git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def text(value):return re.sub(r'\s+',' ',unescape(re.sub(r'<[^>]+>','',value))).strip()
def row(path,value,mode=None):
 out={'path':path,'bytes':len(value),'sha256':sha(value)}
 if mode:out.update(mode=mode,gitBlobSha1=hashlib.sha1(b'blob '+str(len(value)).encode()+b'\0'+value).hexdigest())
 return out
def article_intent(article,model):
 assert [text(v) for v in re.findall(r'<h1\b[^>]*>(.*?)</h1>',article,re.S)]==[TITLE] and '<title>'+TITLE+' | Monderman</title>' in article and SUBTITLE in article,'Requested title/subtitle'
 assert 'Governance and Performance · Part 7' in article and 'Jason Adamson' in article,'Exact byline/category/part'
 assert 'href="https://www.monderman.com/'+ARTICLE+'"' in article,'Canonical live route'
 assert 'href="'+PDF+'"' in article,'Actual optional PDF'
 actual=[(int(n),text(v)) for _,n,v in re.findall(r'<(p|h2) data-source-paragraph="(\d+)">(.*?)</\1>',article,re.S)]
 assert actual==[(p['number'],p['text']) for p in model['paragraphs']],'Every complete finalized main paragraph in order'
 refs=re.findall(r'<li id="reference-(\d+)"[^>]*>(.*?)</li>',article,re.S)
 assert [(int(n),text(v)) for n,v in refs]==list(enumerate(model['references'],1)),'All15 actual reference bodies in order'
 assert {int(n) for n in re.findall(r'href="#reference-(\d+)"',article)}==set(range(1,16)),'Every numeric citation has a real reference target'
 assert len(re.findall(r'<figure class="divide-figure\b',article))==3,'Three complete authored diagrams'
 assert re.search(r'<figcaption>[^<]*Illustrative example: 3 novel incidents and 17 recurring disputes\. These are not observed research data\.</figcaption>',article),'Fires illustrative disclosure in actual caption'
 assert not re.search(r'Stalin\.png|g1_route_je|g2_orgcharts_je|g3_fires_je|\bDSI\b|Fact-check copy|Note to the reviewer',article,re.I),'No JohnElijah cover, affiliation, or reviewer metadata leak'
 assert not re.search(r'fbq\s*\(|connect\.facebook\.net|googletagmanager\.com',article),'No tracking added by publication'
def series_intent(research,home,prior_research,prior_home):
 current=re.search(r'<section class="series" aria-labelledby="governance-performance-title">(.*?)</section>',research,re.S)
 prior=re.search(r'<section class="series" aria-labelledby="governance-performance-title">(.*?)</section>',prior_research,re.S)
 assert current and prior,'One actual governance section'
 cards=re.findall(r'<article class="series-card"[^>]*>.*?</article>',current[1],re.S)
 old=re.findall(r'<article class="series-card">.*?</article>',prior[1],re.S)
 assert len(cards)==7 and re.findall(r'class="series-chip">([^<]+)',current[1])==['Part '+str(i) for i in range(7,0,-1)],'All seven parts in descending order'
 assert TITLE in cards[0] and ARTICLE in cards[0] and PDF in cards[0],'New Part7 first with its real formats'
 assert cards[1:]==old[::-1],'All six earlier cards preserved byte-for-byte, only reordered'
 new_carousel=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',home,re.S)
 old_carousel=re.findall(r'<article class="latest-card\b[^>]*>.*?</article>',prior_home,re.S)
 assert len(new_carousel)==len(old_carousel)+1 and ARTICLE in new_carousel[0] and TITLE in new_carousel[0],'One new leading carousel card'
 assert new_carousel[1:]==old_carousel,'All earlier carousel cards unchanged and retained'

def audit_publication():
 global AUDITED,NEGATIVES
 if AUDITED:return
 check(D['baseline']==BASE and D['guardFiles']==GUARDS,'Exactly reviewed base and four bootstrap roots')
 check(raw_git('rev-parse',BASE+'^{tree}').decode().strip()==D['baselineTree'],'Authoritative base Git tree')
 worktree='--worktree' in sys.argv
 names=raw_git('ls-files','--cached','--others','--exclude-standard').decode().splitlines()
 check(len(names)==len(set(names)) and sorted(names)==D['currentSourcePaths'],'Closed exact physical source inventory')
 check(publication_source_exact(),'Every non-bootstrap current body, length, hash and mode is exact')
 if not worktree:
  check(not raw_git('ls-files','--others','--exclude-standard').strip(),'No untracked source enters certification')
  check(not raw_git('diff','--name-only','HEAD').strip() and not raw_git('diff','--cached','--name-only','HEAD').strip(),'Clean committed source required')
  check(sorted(raw_git('diff','--name-only',BASE,'HEAD').decode().splitlines())==D['changedSourcePaths'],'Exact approved changed and added source set')
  heads={}
  for line in raw_git('ls-tree','-rl','HEAD').decode().splitlines():
   info,name=line.split('\t',1);mode,kind,blob,size=info.split();check(kind=='blob' and mode in ['100644','100755'],'Committed regular source only')
   heads[name]=(mode,blob,int(size))
  check(sorted(heads)==sorted(names),'Complete committed physical source closure')
  for name in names:
   p=ROOT/name;check(p.is_file() and not p.is_symlink(),'No source symlinks '+name)
   b=p.read_bytes();m= '100755' if p.stat().st_mode&0o111 else '100644'
   check(heads[name]==(m,hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),len(b)),'Current bytes/mode equal committed blob '+name)
 check(source_paths(names)==D['baselineSourcePaths'],'Only complete approved source inventory projects')
 for mutant in [names+['UNKNOWN.js'],names+[names[0]],names[:-1]]:
  check(source_paths(mutant)==mutant,'Unknown/missing/duplicate source stays visible');NEGATIVES+=1
 parity=[]
 for file,e in D['files'].items():
  b=(ROOT/file).read_bytes();prior=source_view(file,b)
  check(prior==raw_git('show',BASE+':'+file),'Exact authoritative prior bytes '+file)
  check(source_view(file,prior)==prior,'No double inverse '+file)
  parity.append(['source',file,base64.b64encode(b).decode(),sha(prior)])
  for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:],b+b'<script>fetch("/api/activate",{method:"POST"})</script>']:
   check(source_view(file,mutant)==mutant,'Unknown mutation remains visible '+file);NEGATIVES+=1
   parity.append(['source',file,base64.b64encode(mutant).decode(),sha(mutant)])
 for unknown in ['UNKNOWN.js','__proto__','constructor','pricing.html','billing-private.js']:
  for value in ['Unapproved Unicode 😀',b'UNAPPROVED fetch("/api/activate")']:
   check(source_view(unknown,value)==value and public_view(unknown,value)==value,'Unknown or unrelated source path remains visible '+unknown);NEGATIVES+=1
   raw=value.encode() if isinstance(value,str) else value
   parity.extend([[kind,unknown,base64.b64encode(raw).decode(),sha(raw)] for kind in ['source','public']])
 model=json.loads((ROOT/'pdf-src/divide-and-rule-inside-the-company.json').read_bytes())
 check(model['source_sha256']=='a7d5880f689feba2139d289b669e11ce5d611870100945cbe0b16098158e13bc','Finalized supplied DOCX identity')
 check(model['title']==TITLE and model['subtitle']==SUBTITLE and model['author']=='Jason Adamson' and model['part']==7,'Requested edition metadata')
 check(len(model['paragraphs'])==32 and [p['number'] for p in model['paragraphs']]==list(range(7,39)) and len(model['references'])==15 and model['editorial_changes_to_main_prose']==[],'All finalized prose/reference source units retained')
 article=(ROOT/ARTICLE).read_text();research=(ROOT/'research.html').read_text();home=(ROOT/'index.html').read_text()
 prior_research=source_view('research.html',research);prior_home=source_view('index.html',home)
 article_intent(article,model);check(True,'Current final article prose, references, metadata and figures')
 series_intent(research,home,prior_research,prior_home);check(True,'Current7→1 series and new leading carousel')
 for old,new in [(TITLE,'UNAPPROVED TITLE'),('data-source-paragraph="7"','data-source-paragraph="999"'),('id="reference-1"','id="reference-999"'),('Illustrative example','UNAPPROVED EXAMPLE'),(PDF,'MISSING.pdf')]:
  mutant=article.replace(old,new);check(mutant!=article,'Semantic negative changes intended input')
  try:article_intent(mutant,model)
  except AssertionError:NEGATIVES+=1
  else:raise AssertionError('Part7 article negative unexpectedly accepted: '+old)
 for mutant in [research.replace('class="series-chip">Part 7</span>','class="series-chip">Part 6</span>',1),research.replace(TITLE,'UNAPPROVED',1)]:
  try:series_intent(mutant,home,prior_research,prior_home)
  except AssertionError:NEGATIVES+=1
  else:raise AssertionError('Part7 series negative unexpectedly accepted')
 topics=json.loads((ROOT/'research-topics.json').read_bytes())
 check(len(topics['articles'])==29 and len({a['path'] for a in topics['articles']})==29,'All29 distinct articles in current topic directory')
 check(sum(a['path']==ARTICLE for a in topics['articles'])==1,'New article exactly once in topics')
 search=json.loads((ROOT/'public-search-index.json').read_bytes())
 check(sum(a['url']==ARTICLE for a in search)==1,'New article exactly once in search')
 for name in ['sitemap.txt','sitemap.xml']:check((ROOT/name).read_text().count('https://www.monderman.com/'+ARTICLE)==1,'One working canonical sitemap destination '+name)
 for command in [['scripts/build_research_topics.py','--check'],['scripts/build_public_search_index.py','--check']]:subprocess.run([sys.executable,*command],cwd=ROOT,check=True)
 pdf=(ROOT/PDF).read_bytes();check(pdf.startswith(b'%PDF-') and pdf.rstrip().endswith(b'%%EOF'),'Actual optional reviewed PDF envelope')
 if '--built' in sys.argv:
  build=Path(os.environ.get('HIRING_PUBLICATION_BUILD_ROOT',ROOT/'.render-public')).resolve()
  marker=json.loads((build/'.well-known/monderman-questionnaire-release.json').read_bytes());channel=marker['channel']
  check(publication_public_exact(build,channel),'Every actual current compiled body and path bound in one official channel')
  check(json.loads((build/'.well-known/monderman-release.json').read_bytes())=={'revision':raw_git('rev-parse','HEAD').decode().strip()},'Truthful exact current Git revision')
  names=sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file())
  check(public_paths(names,build)==D['publicEditions'][channel]['baselinePaths'],'Only complete compiled public inventory projects')
  for mutant in [names+['UNKNOWN.js'],names+[names[0]],names[:-1]]:
   check(public_paths(mutant,build)==mutant,'Unknown/missing/duplicate compiled paths stay visible');NEGATIVES+=1
  for file,e in D['publicEditions'][channel]['files'].items():
   b=(build/file).read_bytes();prior=public_view(file,b)
   check(len(prior)==e['before_bytes'] and sha(prior)==e['before_sha256'],'Complete exact prior compiled channel '+file)
   parity.append(['public',file,base64.b64encode(b).decode(),sha(prior)])
   for mutant in [b+b'\n',b'UNAPPROVED'+b,b[1:]]:
    check(public_view(file,mutant)==mutant,'Unknown compiled bytes remain visible '+file);NEGATIVES+=1
    parity.append(['public',file,base64.b64encode(mutant).decode(),sha(mutant)])
  article_intent((build/ARTICLE).read_text(),model)
 program="import fs from 'node:fs';import{createHash}from'node:crypto';import{sourceAtPublicationBaseline as s,publicSourceAtPublicationBaseline as p}from'./scripts/divide_rule_publication_20261025_inverse.mjs';const rows=JSON.parse(fs.readFileSync(0));for(const[k,f,b,h]of rows){const raw=Buffer.from(b,'base64'),fn=k==='source'?s:p;for(const v of [raw,...(Buffer.from(raw.toString()).equals(raw)?[raw.toString()]:[])]){const o=fn(f,v);if(typeof o!==typeof v||Buffer.isBuffer(o)!==Buffer.isBuffer(v)||createHash('sha256').update(o).digest('hex')!==h)throw Error(f);}}console.log(rows.length);"
 result=subprocess.run(['node','--input-type=module','-e',program],cwd=ROOT,input=json.dumps(parity),text=True,capture_output=True,check=True)
 check(int(result.stdout.strip())==len(parity),'Independent JS/Python finite inverse parity, Unicode and bytes')
 AUDITED=True
 print(json.dumps({'ok':True,'publication':'divide-rule-20261025','checks':CHECKS,'negativeControls':NEGATIVES,'sourceFiles':len(D['currentSourcePaths']),'articles':29,'part':7,'built':'--built' in sys.argv,'worktreeOnlyNotReleaseCertification':worktree,'networkCalls':0,'productionWrites':0}))

if __name__=='__main__':audit_publication()
