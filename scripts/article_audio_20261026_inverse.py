"""Closed outer narration layer; unrecognized bytes/paths never project.

A final fixture pin is mandatory. This module never imports any older layer.
"""
from pathlib import Path
from collections import OrderedDict
import base64,hashlib,json,re,stat,subprocess,zlib
ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='fc57e2f10fc9ebb51c55aa09c58c03990762f6d9f826e3fa16abbf4cd725cfe7'
SCHEMA='article-audio-20261026-v1'
GUARDS=['scripts/article_audio_20261026_inverse.py','scripts/article_audio_20261026_inverse.mjs','scripts/fixtures/article-audio-20261026.json']
HASH=re.compile(r'[a-f0-9]{64}\Z')
REV=re.compile(rb'\{"revision":"[a-f0-9]{40}"\}\n\Z')
def sha(b):return hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def names_in(root):
 out=[]
 def walk(p):
  for n in p.iterdir():
   if n.is_symlink():out.append(n.relative_to(root).as_posix())
   elif n.is_dir():walk(n)
   elif n.is_file():out.append(n.relative_to(root).as_posix())
 walk(root);return sorted(out)
def git(root,*args):return subprocess.check_output(['git',*args],cwd=root)
def _same_names(a,b):return len(a)==len(set(a)) and sorted(a)==b
def fingerprint(s):return (s.st_dev,s.st_ino,s.st_ctime_ns,s.st_mtime_ns,s.st_size,s.st_mode)
def normalized_inverse(path,b):
 prefix='export const ' if path.endswith('.mjs') else ''
 pattern=re.compile(r"(?m)^"+re.escape(prefix)+r"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'"+(r';$' if prefix else r'$'))
 text=b.decode('utf8');matches=list(pattern.finditer(text));assert len(matches)==1,'Exactly one fixture pin literal'
 token=matches[0][1];replacement=prefix+"FIXTURE_SHA256='NORMALIZED_FIXTURE_PIN'"+(';' if prefix else '')
 return sha(pattern.sub(replacement,text)),token

def unpack(delta,entry):
 packed=delta['beforeBlobs'][entry['before_sha256']];compressed=base64.b64decode(packed,validate=True)
 assert base64.b64encode(compressed).decode()==packed
 d=zlib.decompressobj();b=d.decompress(compressed,entry['before_bytes']+1)
 assert d.eof and not d.unused_data and not d.unconsumed_tail
 assert len(b)==entry['before_bytes'] and sha(b)==entry['before_sha256']
 return b

class FiniteAudioLayer:
 def __init__(self,root,fixture,pin):
  self.root=Path(root).resolve();self.fixture=Path(fixture)
  assert isinstance(pin,str) and HASH.fullmatch(pin),'Final reviewed fixture pin required'
  self.pin=pin;self._digests=OrderedDict();self._templates=OrderedDict()
  assert self.fixture.resolve()==(self.root/GUARDS[-1]).resolve(),'Fixture must be the exact admitted source path'
  raw=self.fixture.read_bytes();assert sha(raw)==pin,'Exact reviewed narration fixture'
  self.delta=json.loads(raw);d=self.delta
  assert d['schema']==SCHEMA and d['guardFiles']==GUARDS
  assert sorted(d['guardTemplates'])==sorted(GUARDS[:-1])
  assert re.fullmatch(r'[a-f0-9]{40}',d['baseline']) and re.fullmatch(r'[a-f0-9]{40}',d['baselineTree'])
  for key in ['currentSourcePaths','baselineSourcePaths','addedSourcePaths','changedSourcePaths']:
   assert d[key]==sorted(set(d[key])) and all(isinstance(f,str) and not f.startswith('/') and '..' not in Path(f).parts for f in d[key])
  assert set(d['currentSourcePaths'])==set(d['baselineSourcePaths'])|set(d['addedSourcePaths'])
  assert not set(d['baselineSourcePaths'])&set(d['addedSourcePaths'])
  assert set(d['files'])==set(d['changedSourcePaths'])-set(d['addedSourcePaths'])
  assert sorted(r['path'] for r in d['sourceRows'])==[f for f in d['currentSourcePaths'] if f not in GUARDS]
  assert set(d['publicEditions'])=={'current','legacy'}
  assert d['review']['all29_reviewed'] is True and all(HASH.fullmatch(d['review'][k]) for k in ['manifest_sha256','voice_identity_sha256','voice_config_sha256','corpus_boundary_audit_sha256','narration_review_sha256'])
  assert len(d['articles'])==29 and len(set(a['path'] for a in d['articles']))==29
  for c,e in d['publicEditions'].items():
   assert e['currentPaths']==sorted(set(e['currentPaths'])) and e['baselinePaths']==sorted(set(e['baselinePaths']))
   assert sorted(r['path'] for r in e['currentMap'])==e['currentPaths']
   assert set(e['currentPaths'])==set(e['baselinePaths'])|set(d['addedPublicPaths'])
   assert sorted(e['files'])==sorted(a['path'] for a in d['articles'])
 def digest(self,p):
  p=Path(p)
  try:before=p.lstat()
  except OSError:return None
  if not stat.S_ISREG(before.st_mode):return None
  key=fingerprint(before);cached=self._digests.get(p)
  if cached and cached[0]==key:self._digests.move_to_end(p);return cached[1]
  try:b=p.read_bytes();after=p.lstat()
  except OSError:return None
  if not stat.S_ISREG(after.st_mode) or fingerprint(after)!=key:return None
  result={'bytes':len(b),'sha256':sha(b),'mode':'100755' if before.st_mode&0o111 else '100644'}
  self._digests[p]=(key,result)
  if len(self._digests)>4096:self._digests.popitem(last=False)
  return result
 def guards_exact(self):
  digest=self.digest(self.fixture)
  if not digest or digest['sha256']!=self.pin or digest['mode']!='100644':return False
  for f,expected in self.delta['guardTemplates'].items():
   p=self.root/f
   if not p.is_file() or p.is_symlink():return False
   s=p.stat();key=fingerprint(s);cached=self._templates.get(p)
   if cached and cached[0]==key:actual,token=cached[1]
   else:
    try:actual,token=normalized_inverse(f,p.read_bytes())
    except (AssertionError,ValueError,UnicodeError):return False
    if fingerprint(p.stat())!=key:return False
    self._templates[p]=(key,(actual,token))
    if len(self._templates)>4:self._templates.popitem(last=False)
   if actual!=expected['normalized_sha256'] or token!=self.pin or ('100755' if s.st_mode&0o111 else '100644')!=expected['mode']:return False
  return True
 def row_exact(self,root,row):
  p=Path(root)/row['path']
  if row.get('kind')=='release_revision':
   if not p.is_file() or p.is_symlink():return False
   b=p.read_bytes();return len(b)==56 and bool(REV.fullmatch(b))
  result=self.digest(p)
  return bool(result and result['bytes']==row['bytes'] and result['sha256']==row['sha256'] and ('mode' not in row or result['mode']==row['mode']))
 def source_names(self):return git(self.root,'ls-files','--cached','--others','--exclude-standard').decode().splitlines()
 def source_exact(self):
  d=self.delta
  if not _same_names(self.source_names(),d['currentSourcePaths']):return False
  if not self.guards_exact():return False
  return all(self.row_exact(self.root,r) for r in d['sourceRows'])
 def public_exact(self,root,channel):
  root=Path(root);d=self.delta
  if channel not in d['publicEditions']:return False
  e=d['publicEditions'][channel]
  return self.source_exact() and _same_names(names_in(root),e['currentPaths']) and all(self.row_exact(root,r) for r in e['currentMap'])
 def channel(self,root):
  p=Path(root)/'.well-known/monderman-questionnaire-release.json'
  if not p.is_file() or p.is_symlink():return None
  try:c=json.loads(p.read_bytes()).get('channel')
  except (OSError,ValueError):return None
  return c if c in self.delta['publicEditions'] else None
 def _view(self,entries,file,value,exact):
  if not isinstance(file,str) or file not in entries:return value
  assert isinstance(value,(str,bytes))
  e=entries[file]
  if sha(value)!=e['after_sha256'] or not exact():return value
  b=value.encode() if isinstance(value,str) else value
  assert len(b)==e['after_bytes'];prior=unpack(self.delta,e)
  return prior.decode('utf-8') if isinstance(value,str) else prior
 def source_view(self,file,value):return self._view(self.delta['files'],file,value,self.source_exact)
 def public_view(self,file,value,root=None):
  root=Path(root or self.root/'.render-public');c=self.channel(root)
  if c is None:return value
  return self._view(self.delta['publicEditions'][c]['files'],file,value,lambda:self.public_exact(root,c))
 def source_paths(self,names):
  if _same_names(list(names),self.delta['currentSourcePaths']) and self.source_exact():return set(self.delta['baselineSourcePaths']) if isinstance(names,set) else list(self.delta['baselineSourcePaths'])
  return names
 def public_paths(self,names,root):
  c=self.channel(root)
  if c is not None and _same_names(list(names),self.delta['publicEditions'][c]['currentPaths']) and self.public_exact(root,c):
   p=self.delta['publicEditions'][c]['baselinePaths'];return set(p) if isinstance(names,set) else list(p)
  return names
 def git_before(self,*args):
  # Only legacy inventory/tree/diff read shapes are projected, and only after
  # the complete physical candidate matches. Revision markers stay truthful.
  if not self.source_exact():return git(self.root,*args)
  if args in [('ls-files','--cached','--others','--exclude-standard'),('ls-files','--cached')]:return ('\n'.join(self.delta['baselineSourcePaths'])+'\n').encode()
  if args==('ls-tree','-rl','HEAD'):args=('ls-tree','-rl',self.delta['baseline'])
  if len(args)==4 and args[:2] in [('diff','--name-only'),('diff','--raw')] and args[-1]=='HEAD':args=(*args[:-1],self.delta['baseline'])
  return git(self.root,*args)

_default=None
def layer():
 global _default
 if _default is None:_default=FiniteAudioLayer(ROOT,ROOT/'scripts/fixtures/article-audio-20261026.json',FIXTURE_SHA256)
 return _default
def audio_source_exact():return layer().source_exact()
def audio_public_exact(root,channel):return layer().public_exact(root,channel)
def source_at_audio_baseline(file,value):return layer().source_view(file,value)
def public_source_at_audio_baseline(file,value,root=None):return layer().public_view(file,value,root)
def source_paths_at_audio_baseline(names):return layer().source_paths(names)
def public_paths_at_audio_baseline(names,root):return layer().public_paths(names,root)
def audio_git(*args):return layer().git_before(*args)
