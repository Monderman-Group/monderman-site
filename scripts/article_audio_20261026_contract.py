"""Raw current narration admission before any finite historical projection."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,math,re,sys
from article_audio_20261026_inverse import layer,sha,git,names_in,unpack,GUARDS

ARTICLES=(
 'accumulated-drag-department-of-war.html','built-to-please.html','compensatory-systems.html','decision-velocity-article.html','designing-for-decision-velocity.html','divide-and-rule-inside-the-company.html','durable-organization.html','every-node-for-itself.html','fast-to-cut-slow-to-build.html','from-tokens-to-outcomes.html','governing-complexity.html','hiring-blind-spot.html','hold-collide-come-apart.html','institutional-performance-article.html','merit-after-the-machine.html','nothing-stays-tuned.html','operational-systems-article.html','posting-has-outgrown-the-job.html','quarter-trillion-friction-us-healthcare.html','structural-clarity-article.html','terminal-fidelity.html','the-art-of-interior-reasoning.html','the-culture-trap-brief.html','the-culture-trap.html','the-drift-problem.html','the-unmeasured-layer.html','trenches-not-silos.html','we-gave-bureaucracy-the-fastest-tools.html','when-bureaucracy-became-the-obstacle.html',
)
BLOCK=re.compile(r'\n<!-- monderman-article-audio:(head|player|script):start -->\n([\s\S]*?)\n<!-- monderman-article-audio:\1:end -->\n')
class Player(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.details=[];self.audios=[];self.sources=[];self.downloads=[];self.speed=[];self.scripts=[];self.styles=[];self.text=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='details' and 'data-article-audio' in a:self.details.append(a)
  if tag=='audio':self.audios.append(a)
  if tag=='source':self.sources.append(a)
  if tag=='a' and 'download' in a:self.downloads.append(a)
  if 'data-audio-speed-controls' in a:self.speed.append(a)
  if tag=='script' and a.get('src','').startswith('article-audio.js'):self.scripts.append(a)
  if tag=='link' and a.get('href','').startswith('article-audio.css'):self.styles.append(a)
 def handle_data(self,s):self.text.append(s)

def native_player(html,article):
 blocks=list(BLOCK.finditer(html));assert [m[1] for m in blocks]==['head','player','script'],'Exactly three ordered emitted blocks'
 assert html.count('<!-- monderman-article-audio:')==6,'Unknown or duplicate audio marker'
 p=Player();p.feed(html);p.close();assert len(p.details)==1 and 'open' not in p.details[0]
 assert len(p.audios)==len(p.sources)==len(p.speed)==len(p.scripts)==len(p.styles)==1
 audio=p.audios[0];assert 'controls' in audio and audio.get('preload')=='none' and 'autoplay' not in audio
 assert audio.get('aria-label')=='Listen to '+article['title']
 assert p.sources[0]=={'src':article['audio_path'],'type':'audio/mp4'}
 assert len(p.downloads)==2 and all(a['href']==article['audio_path'] for a in p.downloads)
 assert 'hidden' in p.speed[0],'No inert speed control without JavaScript'
 assert p.styles[0]=={'rel':'stylesheet','href':'article-audio.css?v=20261026.1'}
 assert p.scripts[0]=={'src':'article-audio.js?v=20261026.1','defer':None}
 text=' '.join(' '.join(p.text).split());seconds=math.ceil(article['duration_seconds']);stamp=f'{seconds//60}:{seconds%60:02d}'
 assert stamp+' · AI narration' in text and 'AI narration of the article’s prose.' in text
 return BLOCK.sub('',html)

def audit_source(l,require_clean=True):
 d=l.delta;r=l.root
 assert l.source_exact(),'Every actual candidate source path/byte/mode matches closed fixture'
 assert git(r,'rev-parse',d['baseline']+'^{tree}').decode().strip()==d['baselineTree'],'Immutable prior tree'
 prior_rows={}
 for line in git(r,'ls-tree','-rl',d['baseline']).decode().splitlines():
  info,path=line.split('\t');mode,kind,oid,size=info.split();assert kind=='blob' and mode in {'100644','100755'};prior_rows[path]=(mode,oid,int(size))
 assert sorted(prior_rows)==d['baselineSourcePaths']
 for row in d['baselineSourceRows']:
  assert prior_rows[row['path']]==(row['mode'],row['gitBlobSha1'],row['bytes'])
 assert sorted(row['path'] for row in d['baselineSourceRows'])==d['baselineSourcePaths']
 if require_clean:
  assert not git(r,'ls-files','--others','--exclude-standard').strip() and not git(r,'diff','--name-only','HEAD').strip() and not git(r,'diff','--cached','--name-only','HEAD').strip(),'Clean committed candidate'
  assert sorted(git(r,'diff','--name-only',d['baseline'],'HEAD').decode().splitlines())==d['changedSourcePaths'],'Exact committed candidate delta'
  current={}
  for line in git(r,'ls-tree','-rl','HEAD').decode().splitlines():
   info,path=line.split('\t');mode,kind,oid,size=info.split();assert kind=='blob' and mode in {'100644','100755'};current[path]=(mode,oid,int(size))
  assert sorted(current)==d['currentSourcePaths']
  for f in d['currentSourcePaths']:
   p=r/f;b=p.read_bytes();mode='100755' if p.stat().st_mode&0o111 else '100644'
   assert current[f]==(mode,hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),len(b))
 for f,e in d['files'].items():assert unpack(d,e)==git(r,'show',d['baseline']+':'+f)
 prior_path='scripts/fixtures/divide-rule-publication-20261025.json';prior_raw=git(r,'show',d['baseline']+':'+prior_path)
 assert sha(prior_raw)==d['priorPublicationFixtureSha256'] and (r/prior_path).read_bytes()==prior_raw
 assert sorted(a['path'] for a in d['articles'])==list(ARTICLES)
 manifest=json.loads((r/'article-audio-manifest.json').read_bytes())
 assert sha((r/'article-audio-manifest.json').read_bytes())==d['review']['manifest_sha256']
 assert manifest['articles']==d['articles'] and manifest['runtime_sha256']==d['runtime_sha256']
 assert manifest['status']=='passed' and manifest['total_audio_bytes']==sum(a['bytes'] for a in d['articles'])
 assert manifest['extraction_version']==2 and manifest['additional_plaintext_citation_markers_omitted']==83
 assert re.fullmatch('[a-f0-9]{64}',manifest['source_omission_ledger_sha256'])
 identity=manifest['voice_identity'];config=manifest['voice_config']
 canonical=lambda v:sha(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')))
 assert canonical(identity)==manifest['voice_identity_sha256'] and canonical(config)==manifest['voice_config_sha256']
 assert identity['preset']=='bf_emma' and identity['engine']=='Kokoro82M MLX bf16'
 assert identity['voice_pack_sha256']=='8878a75a6661305849eeb1d6293a7177250193616e161b4c3100636434dfe69f'
 assert config['language']=='b' and config['native_speed']==1.0 and config['native_sample_rate']==24000
 assert config['publication_codec']=='AAC-LC' and config['publication_sample_rate']==48000 and config['publication_channels']==1
 assert manifest['reference_wav_clone'] is False and 'Qwen' not in json.dumps(manifest) and 'voice_reference_sha256' not in manifest
 for k in ['voice_identity_sha256','voice_config_sha256','corpus_boundary_audit_sha256','narration_review_sha256']:assert manifest[k]==d['review'][k]
 assert not re.search(r'/Users/|native/|reference.*\.wav|model.*cache',json.dumps(manifest),re.I),'No private absolute/model/native paths in tracked manifest'
 for a in d['articles']:
  assert a['review_status']=='passed' and a['ai_generated'] is True and a['codec']=='aac' and a['mime']=='audio/mp4'
  assert math.isfinite(a['duration_seconds']) and a['duration_seconds']>0 and a['bytes']>0
  assert a['audio_path']=='assets/audio/'+Path(a['path']).stem+'.m4a'
  assert sha((r/a['path']).read_bytes())==a['source_sha256']==sha(git(r,'show',d['baseline']+':'+a['path'])),'Authored source HTML unchanged'
  b=(r/a['audio_path']).read_bytes();assert len(b)==a['bytes'] and sha(b)==a['audio_sha256']
 for f,h in d['runtime_sha256'].items():assert sha((r/f).read_bytes())==h
 js=(r/'article-audio.js').read_text();css=(r/'article-audio.css').read_text()
 assert len(js.encode())+len(css.encode())<=8192,'Dedicated small article runtime'
 assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|\.play\s*\(|AudioContext|https?://',js)
 assert not re.search(r'@import|url\(',css)
 assert '@media print' in css and '.mond-article-audio { display: none !important; }' in css
 return {'source_paths':len(d['currentSourcePaths']),'articles':29,'source_prose_changed':0,'audio_bytes':manifest['total_audio_bytes']}

def audit_public(l,root,channel,revision=None):
 root=Path(root);d=l.delta;e=d['publicEditions'][channel]
 assert l.public_exact(root,channel),'Every actual public byte/path equals closed current edition'
 assert l.channel(root)==channel
 revision=revision or git(l.root,'rev-parse','HEAD').decode().strip()
 assert json.loads((root/'.well-known/monderman-release.json').read_bytes())=={'revision':revision}
 assert len(d['addedPublicPaths'])==31 and len(set(d['addedPublicPaths']))==31
 assert sorted(d['addedPublicPaths'])==sorted([a['audio_path'] for a in d['articles']]+['article-audio.css','article-audio.js'])
 assert len(e['currentPaths'])==len(e['baselinePaths'])+31
 assert len(e['files'])==29 and set(e['files'])==set(ARTICLES)
 old_fixture=json.loads(git(l.root,'show',d['baseline']+':scripts/fixtures/divide-rule-publication-20261025.json'))
 old=old_fixture['publicEditions'][channel];assert old['currentPaths']==e['baselinePaths']
 old_rows={r['path']:r for r in old['currentMap']};baseline_rows={r['path']:r for r in e['baselineMap']}
 assert sorted(baseline_rows)==e['baselinePaths']
 for f,r in baseline_rows.items():
  if f!='.well-known/monderman-release.json':assert (r['bytes'],r['sha256'])==(old_rows[f]['bytes'],old_rows[f]['sha256'])
 for a in d['articles']:
  b=(root/a['path']).read_bytes();recovered=native_player(b.decode(),a).encode();entry=e['files'][a['path']]
  assert recovered==unpack(d,entry),'Whole actual compiled body unchanged outside exact audio blocks'
  assert sha(recovered)==old_rows[a['path']]['sha256'] and len(recovered)==old_rows[a['path']]['bytes']
  media=(root/a['audio_path']).read_bytes();assert len(media)==a['bytes'] and sha(media)==a['audio_sha256']
 for f in d['addedPublicPaths']:assert (root/f).read_bytes()==(l.root/f).read_bytes()
 for f in set(e['baselinePaths'])-set(ARTICLES)-{'.well-known/monderman-release.json'}:
  b=(root/f).read_bytes();assert len(b)==old_rows[f]['bytes'] and sha(b)==old_rows[f]['sha256'],'Unrelated public body changed '+f
 return {'channel':channel,'public_paths':len(e['currentPaths']),'native_players':29,'new_assets':31,'unchanged_other_public_bodies':len(e['baselinePaths'])-30}

def main():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--worktree',action='store_true');p.add_argument('--built',type=Path);p.add_argument('--channel',choices=['current','legacy']);a=p.parse_args();l=layer();result={'source':audit_source(l,not a.worktree)}
 if a.built:assert a.channel;result['public']=audit_public(l,a.built,a.channel)
 print('ARTICLE_AUDIO_CURRENT_PASS '+json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
