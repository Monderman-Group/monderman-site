"""Build-time article-audio insertion; source HTML is never rewritten.

Private release candidate. A final reviewed manifest and encoded assets are
required before this can publish anything. Every affected HTML document can be
recovered byte-for-byte by removing the three exact emitted blocks.
"""
from __future__ import annotations
import argparse, hashlib, html, json, math, re, shutil
from html.parser import HTMLParser
from pathlib import Path

RELEASE='20261028.2'
SCHEMA='monderman-article-audio-v1'
EXPECTED_ARTICLES=(
 'accumulated-drag-department-of-war.html','ai-wont-land-in-the-middle.html','built-to-please.html','companies-dont-have-a-culture.html','compensatory-systems.html',
 'decision-velocity-article.html','designing-for-decision-velocity.html','divide-and-rule-inside-the-company.html',
 'durable-organization.html','every-node-for-itself.html','fast-to-cut-slow-to-build.html',
 'from-tokens-to-outcomes.html','governing-complexity.html','hiring-blind-spot.html',
 'hold-collide-come-apart.html','institutional-performance-article.html','merit-after-the-machine.html',
 'nothing-stays-tuned.html','operational-systems-article.html','posting-has-outgrown-the-job.html',
 'quarter-trillion-friction-us-healthcare.html','structural-clarity-article.html','terminal-fidelity.html',
 'the-art-of-interior-reasoning.html','the-culture-trap-brief.html','the-culture-trap.html','the-drift-problem.html',
 'the-unmeasured-layer.html','trenches-not-silos.html','we-gave-bureaucracy-the-fastest-tools.html',
 'when-bureaucracy-became-the-obstacle.html',
)
HASH=re.compile(r'[a-f0-9]{64}\Z')
MARKER='<!-- monderman-article-audio:'
def sha(b):return hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def check(v,label):
 if not v:raise ValueError(label)
def duration_text(seconds):
 seconds=math.ceil(seconds)
 return f'{seconds//60}:{seconds%60:02d}'
def block(kind,content):return f'\n{MARKER}{kind}:start -->\n{content}\n{MARKER}{kind}:end -->\n'

class Bounds(HTMLParser):
 """Locate true tokens without parsing HTML strings inside script content."""
 def __init__(self,source):
  super().__init__(convert_charrefs=False);self.lines=[0];self.source=source
  for m in re.finditer('\n',source):self.lines.append(m.end())
  self.hero_depth=None;self.section_depth=0;self.heroes=[];self.heads=[];self.bodies=[]
  self.in_head=False;self.head_styles=[];self.brands=[]
 def at(self):
  line,col=self.getpos();return self.lines[line-1]+col
 def handle_starttag(self,tag,attrs):
  if tag=='head':
   check(not self.in_head,'Nested head is forbidden');self.in_head=True
  a=dict(attrs)
  if self.in_head and (tag=='style' or tag=='link' and a.get('rel')=='stylesheet'):
   self.head_styles.append(self.at())
  if tag=='link' and any(k=='href' and isinstance(v,str) and v.startswith('brand-surfaces.css') for k,v in attrs):
   check(self.in_head,'Shared brand stylesheet must be inside the head')
   check(len(attrs)==2 and set(a)=={'rel','href'} and a.get('rel')=='stylesheet' and re.fullmatch(r'brand-surfaces\.css(?:\?v=[0-9.]+)?',a.get('href','')),'Unexpected shared brand stylesheet anchor')
   self.brands.append(self.at())
  if tag=='section':
   if 'publication-hero' in dict(attrs).get('class','').split():
    check(self.hero_depth is None,'Nested publication hero is forbidden')
    self.hero_depth=self.section_depth
   self.section_depth+=1
 def handle_endtag(self,tag):
  if tag=='section':
   self.section_depth-=1
   if self.hero_depth==self.section_depth:
    end=self.source.index('>',self.at())+1;self.heroes.append(end);self.hero_depth=None
  if tag=='head':self.heads.append(self.at());self.in_head=False
  if tag=='body':self.bodies.append(self.at())

HEAD=block('head',f'<link rel="stylesheet" href="article-audio.css?v={RELEASE}">')
SCRIPT=block('script',f'<script src="article-audio.js?v={RELEASE}" defer></script>')

def player(entry):
 title=html.escape(entry['title'],quote=True);slug=Path(entry['path']).stem
 audio=html.escape(entry['audio_path'],quote=True);time=duration_text(entry['duration_seconds'])
 return block('player',f'''<details class="mond-article-audio" data-article-audio>
<summary class="mond-article-audio__summary"><svg class="mond-article-audio__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z"/></svg><span>Listen</span><span class="mond-article-audio__meta">{time} · AI narration</span><span class="mond-article-audio__chevron" aria-hidden="true">⌄</span></summary>
<div class="mond-article-audio__body"><audio controls preload="none" aria-label="Listen to {title}"><source src="{audio}" type="audio/mp4">Your browser cannot play this recording. <a href="{audio}" download>Download the audio</a>.</audio>
<div class="mond-article-audio__options"><span class="mond-article-audio__speed" data-audio-speed-controls hidden><label for="article-audio-speed-{slug}">Speed</label><select id="article-audio-speed-{slug}" data-audio-speed><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></span><a href="{audio}" download>Download audio</a></div>
<div class="mond-article-audio__note">AI narration of the article’s prose. Figures and references remain on the page.</div><div class="mond-article-audio__error" data-audio-error role="status" hidden>The recording could not load. You can try the download link.</div></div></details>''')

def transform(source,entry):
 check(MARKER not in source,'Audio already inserted or unknown audio marker')
 p=Bounds(source);p.feed(source);p.close()
 check(len(p.heroes)==len(p.heads)==len(p.bodies)==1,'Exactly one complete hero/head/body required')
 check(p.heads[0]<p.heroes[0]<p.bodies[0],'Expected document reading order')
 check(len(p.brands)==1 and p.head_styles and p.brands[0]==p.head_styles[-1],'Exactly one shared brand stylesheet must be last in the head')
 check(p.brands[0]<p.heads[0],'Shared brand stylesheet must precede the head end')
 additions=[(p.brands[0],HEAD),(p.heroes[0],player(entry)),(p.bodies[0],SCRIPT)]
 result=source
 for offset,value in sorted(additions,reverse=True):result=result[:offset]+value+result[offset:]
 check(recover(result,entry)==source,'Insertion must preserve every original byte')
 return result

def recover(source,entry):
 for exact in [HEAD,player(entry),SCRIPT]:
  check(source.count(exact)==1,'Only the exact single reviewed audio block can be removed')
  source=source.replace(exact,'',1)
 check(MARKER not in source,'Unknown or duplicate audio blocks remain visible')
 return source

def validate_manifest(manifest,source_root):
 check(manifest['schema']==SCHEMA and manifest['release']==RELEASE,'Exact manifest schema/release')
 check(manifest.get('status')=='passed','Final complete narration review required')
 entries=manifest['articles'];paths=[e['path'] for e in entries]
 check(len(paths)==len(set(paths))==len(EXPECTED_ARTICLES) and tuple(sorted(paths))==EXPECTED_ARTICLES,'Exact31 closed article inventory')
 receipt_path=source_root/'article-audio-year-receipt.json'
 check(manifest.get('calendar_year_receipt_path')==receipt_path.name and receipt_path.is_file() and not receipt_path.is_symlink(),'Tracked calendar pronunciation receipt')
 check(sha(receipt_path.read_bytes())==manifest.get('calendar_year_receipt_sha256'),'Exact calendar pronunciation receipt')
 receipt=json.loads(receipt_path.read_text())
 check(receipt.get('release')==RELEASE and receipt.get('voice_identity_sha256')==manifest['voice_identity_sha256'],'Calendar receipt release and approved voice')
 check(receipt.get('normalizer_path')=='scripts/spoken_years.py' and sha((source_root/'scripts/spoken_years.py').read_bytes())==receipt.get('normalizer_sha256'),'Exact source-bound calendar normalizer')
 reviewed={a['path']:a for a in receipt['articles']}
 check(len(reviewed)==len(entries) and tuple(sorted(reviewed))==EXPECTED_ARTICLES,'Calendar receipt covers all31 articles')
 for entry in entries:
  path=entry['path'];slug=Path(path).stem
  check(entry['audio_path']==f'assets/audio/{slug}.m4a','Exact matching encoded audio path')
  check(entry['mime']=='audio/mp4' and entry['codec']=='aac','AAC/MP4 media type')
  check(entry['review_status']=='passed' and entry['ai_generated'] is True,'Only reviewed AI narration is publishable')
  for key in ['source_sha256','script_sha256','audio_sha256']:check(isinstance(entry[key],str) and HASH.fullmatch(entry[key]),'Complete SHA256 '+key)
  check(type(entry['bytes']) is int and entry['bytes']>0,'Positive encoded media size')
  check(type(entry['duration_seconds']) in {int,float} and math.isfinite(entry['duration_seconds']) and entry['duration_seconds']>0,'Finite positive decoded duration')
  check(type(entry['title']) is str and bool(entry['title'].strip()),'Actual article title')
  page=source_root/path;asset=source_root/entry['audio_path']
  check(page.is_file() and not page.is_symlink() and sha(page.read_bytes())==entry['source_sha256'],'Exact authored source '+path)
  check(asset.is_file() and not asset.is_symlink(),'Exact regular audio asset '+path)
  raw=asset.read_bytes();check(len(raw)==entry['bytes'] and sha(raw)==entry['audio_sha256'],'Exact reviewed encoded media '+path)
  evidence=reviewed[path]
  check(all(evidence.get(k)==entry[k] for k in ['source_sha256','script_sha256','audio_sha256']),'Source/script/audio-bound calendar evidence '+path)
  check(evidence.get('status') in {'verified-existing-calendar-reading','no-calendar-years','normalized-new-recording'},'Truthful calendar verification status '+path)
  if evidence['status']!='normalized-new-recording':
   check(evidence.get('audio_reused_byte_exact') is True and evidence.get('previous_audio_sha256')==entry['audio_sha256'] and not evidence.get('changed_native_chunks'),'Existing correctly pronounced recording retained '+path)
   check(all(y.get('existing_calendar_reading_verified') is True for y in evidence['reviewed_calendar_years']),'Actual existing native year pronunciation verified '+path)
 check(manifest['total_audio_bytes']==sum(e['bytes'] for e in entries),'Exact aggregate encoded size')
 return entries

def inject_site(source_root,publish_root,manifest):
 source_root=source_root.resolve();publish_root=publish_root.resolve()
 check(source_root!=publish_root and publish_root not in source_root.parents,'Build output cannot be the source directory or its ancestor')
 entries=validate_manifest(manifest,source_root)
 assets={'article-audio.css','article-audio.js'}
 for asset in assets:
  p=source_root/asset;check(p.is_file() and not p.is_symlink(),'Approved regular runtime '+asset)
  check(sha(p.read_bytes())==manifest['runtime_sha256'][asset],'Exact reviewed runtime '+asset)
 # Prepare every transformed page and validate all assets before the first write.
 prepared={}
 for entry in entries:
  p=publish_root/entry['path'];check(p.is_file() and not p.is_symlink(),'Built article exists '+entry['path'])
  prepared[entry['path']]=transform(p.read_text(),entry)
 audio_dir=publish_root/'assets/audio';check(not audio_dir.is_symlink(),'Audio output directory cannot be a symlink')
 if audio_dir.exists():check(not any(audio_dir.iterdir()),'No unknown audio files may enter the build')
 audio_dir.mkdir(parents=True,exist_ok=True)
 for entry in entries:
  shutil.copyfile(source_root/entry['audio_path'],publish_root/entry['audio_path'])
  (publish_root/entry['path']).write_text(prepared[entry['path']])
 for asset in assets:shutil.copyfile(source_root/asset,publish_root/asset)
 return {'articles':len(entries),'source_pages_rewritten':0,'encoded_media_files':len(entries),'encoded_media_bytes':manifest['total_audio_bytes']}

def main():
 p=argparse.ArgumentParser();p.add_argument('publish_root',type=Path);p.add_argument('--source-root',type=Path,default=Path.cwd());p.add_argument('--manifest',type=Path,default=Path('article-audio-manifest.json'));args=p.parse_args()
 result=inject_site(args.source_root,args.publish_root,json.loads(args.manifest.read_text()))
 print('ARTICLE_AUDIO_BUILD_PASS '+json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
