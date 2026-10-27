"""Closed outer narration layer; unrecognized bytes/paths never project.

A final fixture pin is mandatory. This module never imports any older layer.
"""
from pathlib import Path
from collections import OrderedDict
import base64,hashlib,json,re,stat,subprocess,zlib
ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='fd167941c8da60bd483d3eae612f5af591fe58a07a9942672b49d2e792d53637'
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
def source_at_audio_baseline(file,value,*,_scope_edition=None):
 if _scope_edition is not None:return _scope_audio_view(_scope_edition,file,value)
 return layer().source_view(file,value)
def public_source_at_audio_baseline(file,value,root=None,*,_scope_edition=None):
 if _scope_edition is not None:return _scope_audio_view(_scope_edition,file,value,True,root)
 return layer().public_view(file,value,root)
def source_paths_at_audio_baseline(names,*,_scope_edition=None):
 if _scope_edition is not None:return _scope_audio_paths(_scope_edition,names)
 return layer().source_paths(names)
def public_paths_at_audio_baseline(names,root,*,_scope_edition=None):
 if _scope_edition is not None:return _scope_audio_paths(_scope_edition,names,True,root)
 return layer().public_paths(names,root)
def audio_git(*args):return layer().git_before(*args)

# Internal synchronous standalone-Scope edition. Ordinary None APIs above are unchanged.
import io as _scope_text_io
import os as _scope_os
import threading as _scope_threading
from pathlib import PosixPath as _ScopeNativePath, PurePath as _ScopePurePath
_SCOPE_FILE_LIMIT=32*1024*1024
_SCOPE_TOTAL_LIMIT=256*1024*1024
_SCOPE_ORIGINAL_UNPACK=unpack
_scope_states={}
_scope_active=False
_scope_lock=_scope_threading.Lock()

def _scope_path(value):
 if type(value) is str:return value
 assert type(value) is _ScopeNativePath,'Exact native PosixPath or str required'
 return _ScopePurePath.__str__(value)

def _scope_live(edition):
 assert type(edition) is object and edition in _scope_states,'Live internally issued Scope edition required'
 state=_scope_states[edition]
 assert state['live'],'Revoked Scope edition'
 authority=state.get('alias_authority')
 if authority is not None:
  assert _scope_os.environ.get('SCOPE_BETA_BUILD_ROOT')==authority['scope']and _scope_os.environ.get('SITE_DESIGN_BUILD_ROOT')==authority['site'],'Stable root environment during use'
  if authority['cwd']is not None:assert _scope_os.getcwd()==authority['cwd'][0],'Stable actual cwd string during use'
 return state

def validate_scope_edition(edition,source_root=None,public_root=None,channel=None):
 state=_scope_live(edition)
 if source_root is not None:assert _scope_path(source_root)==state['source_root'],'Captured source root binding'
 if public_root is not None:
  key=_scope_path(public_root)
  assert state['built'] and state['paths'].get(key)==('public',''),'Captured public root binding'
 if channel is not None:assert state['built'] and channel==state['channel'],'Captured public channel binding'
 return None

def _scope_data(edition,path,pin):
 state=_scope_live(edition)
 assert type(path) is str and type(pin) is str
 authority=state['authorities'].get(path)
 if authority is None:
  value=state['source_logical'][path]['data']
  assert type(value) is bytes and sha(value)==pin,'Exact captured same-module fixture pin'
  authority=json.loads(value);state['authorities'][path]=(pin,authority)
 else:
  assert authority[0]==pin,'Same captured fixture authority';authority=authority[1]
 return authority

def scope_fixture_data(edition,path,pin):
 """Internal cross-module selection, not a caller-owned provider or public backing-data API."""
 validate_scope_edition(edition)
 return _scope_data(edition,path,pin)

def scope_hiring_fixture_data(edition,path,pin):
 validate_scope_edition(edition)
 state=_scope_live(edition);key=('combined-hiring',path,pin)
 if key not in state['authorities']:
  combined=_scope_data(edition,path,pin);assert combined['schema']=='native267-publication-plus-owner-sodi-v1'
  stored=combined['publicationSublayer'];assert stored['bytes']==435801 and stored['sha256']=='7554155126cae721883f5a2f784116d03687dbb7922ea5bd278d6c10c1f84b59'
  raw=base64.b64decode(stored['originalFixtureBase64'],validate=True);assert base64.b64encode(raw).decode()==stored['originalFixtureBase64']and len(raw)==stored['bytes']and sha(raw)==stored['sha256']
  publication=json.loads(raw);assert publication==stored['parsedNativeDelta']and publication['baseline']=='76690a65c53794cb1e35f512221e51ddd0c6525b'and publication['version']=='hiring-blind-spot-publication-20261015.2'
  owner=combined['ownerDelta'];assert owner['baseline']=='8431a47bbc8d253a9ef6ef20de8227458f48d3b0'and owner['baselineTree']=='6890268b552f95094a595f29a6a8200ae1f62198'and owner['provisional']is False
  assert owner['files']and len(owner['nonGuardSourceRows'])==807 and owner['guardRoots']==publication['guardFiles']and owner['baselineSourcePaths']==owner['currentSourcePaths']==publication['currentSourcePaths']
  assert sorted(r['path']for r in owner['nonGuardSourceRows'])==[f for f in publication['currentSourcePaths']if f not in owner['guardRoots']]
  assert all(f in publication['currentSourcePaths']and f not in owner['guardRoots']for f in owner['files'])and sorted(owner['publicEditions'])==sorted(publication['publicEditions'])
  for e in owner['publicEditions'].values():
   assert sorted(r['path']for r in e['currentMap'])==publication['currentPublicPaths']and all(f in publication['currentPublicPaths']and f!='.well-known/monderman-release.json'for f in e['files'])
  state['authorities'][key]={'publication':publication,'owner':owner}
 return state['authorities'][key]

def _scope_io_state(reader):
 assert type(reader)is _ScopeIO,'Exact native captured reader required'
 assert type(reader._logical)is bool,'Exact native reader mode required'
 return _scope_live(reader._edition)

class _ScopeIO:
 __slots__=('_edition','_logical')
 def __init__(self,edition,logical):
  assert type(self)is _ScopeIO and type(logical)is bool,'Exact native captured reader and mode required'
  _scope_live(edition);self._edition=edition;self._logical=logical
 def _locate(self,path):
  state=_scope_io_state(self);key=_scope_path(path);answer=state['paths'].get(key)
  assert answer is not None,'Unknown captured path '+key
  namespace,relative=answer
  assert namespace!='public' or state['built'],'No physical public namespace in source-only mode'
  return state,namespace,relative
 def _record(self,path):
  _scope_io_state(self)
  state,namespace,relative=self._locate(path)
  return state,(state[namespace+'_raw'].get(relative) or state[namespace+'_dirs'].get(relative))
 def read_bytes(self,path):
  _scope_io_state(self)
  state,namespace,relative=self._locate(path);table=state[namespace+('_logical'if self._logical else'_raw')];record=table.get(relative)
  assert record is not None and 'data'in record,'Uncopied or unknown captured bytes'
  assert type(record['data']) is bytes
  return record['data']
 def read_text(self,path,encoding=None,errors=None):
  _scope_io_state(self)
  value=self.read_bytes(path)
  with _scope_text_io.TextIOWrapper(_scope_text_io.BytesIO(value),encoding=encoding,errors=errors,newline=None)as stream:return stream.read()
 def stat(self,path):
  _scope_io_state(self)
  state,record=self._record(path);assert record is not None,'Unknown captured metadata';return record['stat']
 def is_file(self,path):_scope_io_state(self);return stat.S_ISREG(self.stat(path).st_mode)
 def is_symlink(self,path):_scope_io_state(self);return stat.S_ISLNK(self.stat(path).st_mode)
 def exists(self,path):_scope_io_state(self);self.stat(path);return True
 def source_names(self):
  state=_scope_io_state(self);return list(state['source_names_logical'if self._logical else'source_names_raw'])
 def public_names(self,root):
  state=_scope_io_state(self);assert state['built']and root is not None,'Explicit physical public root required';validate_scope_edition(self._edition,public_root=root);return list(state['public_names_logical'if self._logical else'public_names_raw'])
 def public_paths(self,root):
  _scope_io_state(self)
  names=self.public_names(root);state=_scope_io_state(self)
  caller=Path(_scope_path(root))
  return [caller/p for p in names]+[caller/p for p in state['public_dirs']if p]
 def git(self,*args):
  state=_scope_io_state(self)
  if self._logical:
   assert args==('ls-files','--cached','--others','--exclude-standard'),'Only logical combined source inventory'
   return ('\n'.join(state['source_names_logical'])+'\n').encode()
  if args==('ls-files','--cached'):return state['cached']
  assert args==('ls-files','--others','--exclude-standard'),'Only the two raw current source inventories'
  return state['others']
 def is_source_root(self,root):
  state=_scope_io_state(self);key=_scope_path(root)
  assert state['paths'].get(key)in[('source',''),('public','')],'Captured namespace root binding'
  return state['paths'][key][0]=='source'
 def channel(self,root):
  state=_scope_io_state(self);assert state['built']and root is not None,'Explicit physical public root required';validate_scope_edition(self._edition,public_root=root);return state['channel']

def scope_contract_raw_io(edition):
 validate_scope_edition(edition)
 return _ScopeIO(edition,False)

def scope_contract_logical_io(edition,source_root=None,public_root=None,channel=None):
 validate_scope_edition(edition,source_root,public_root,channel)
 return _ScopeIO(edition,True)

def _scope_audio_view(edition,file,value,public=False,root=None):
 state=_scope_live(edition)
 assert type(file) is str and type(value)in(str,bytes),'Native captured value boundary'
 if public and not state['built']:
  assert root is None,'No physical public root in source-only mode'
  assert not any(file in e['files']and sha(value)==e['files'][file]['after_sha256']for e in state['audio']['publicEditions'].values()),'Unadmitted current public value in source-only operation'
  return value
 if public:
  actual_root=ROOT/'.render-public'if root is None else root
  validate_scope_edition(edition,public_root=actual_root)
 entries=state['audio']['publicEditions'][state['channel']]['files']if public else state['audio']['files']
 if file not in entries or sha(value)!=entries[file]['after_sha256']:return value
 entry=entries[file];raw=value.encode()if type(value)is str else value
 assert len(raw)==entry['after_bytes']
 table=state['public_logical'if public else'source_logical'];record=table.get(file)
 assert record is not None and type(record.get('data'))is bytes,'Admitted logical prior buffer required'
 before=record['data'];assert len(before)==entry['before_bytes']and sha(before)==entry['before_sha256']
 return before.decode('utf8')if type(value)is str else before

def _scope_audio_paths(edition,names,public=False,root=None):
 state=_scope_live(edition)
 assert type(names)in(list,set,tuple)and all(type(p)is str for p in names),'Native captured names'
 if public and not state['built']:
  assert root is None,'No physical public root in source-only paths'
  assert not any(_same_names(list(names),e['currentPaths'])for e in state['audio']['publicEditions'].values()),'Unadmitted current public names'
  return names
 if public:
  assert root is not None,'Explicit physical public root required'
  validate_scope_edition(edition,public_root=root)
 current=state['audio']['publicEditions'][state['channel']]['currentPaths']if public else state['audio']['currentSourcePaths']
 prior=state['audio']['publicEditions'][state['channel']]['baselinePaths']if public else state['audio']['baselineSourcePaths']
 if _same_names(list(names),current):return set(prior)if type(names)is set else list(prior)
 return names

def _scope_descriptor(path):
 record=path.lstat();assert stat.S_ISREG(record.st_mode)or stat.S_ISDIR(record.st_mode),'Regular captured file/directory required';return record

def _scope_public_census(root):
 names=[];dirs={}
 def visit(directory):
  before=_scope_descriptor(directory);assert stat.S_ISDIR(before.st_mode);dirs[str(directory)]=before
  with _scope_os.scandir(directory)as entries:
   for entry in entries:
    path=Path(entry.path);assert not entry.is_symlink(),'No public symlinks'
    if entry.is_dir(follow_symlinks=False):visit(path)
    elif entry.is_file(follow_symlinks=False):names.append(path.relative_to(root).as_posix())
    else:raise AssertionError('No special public entries')
  assert fingerprint(directory.lstat())==fingerprint(before),'Directory changed during capture'
 visit(root);return sorted(names),dirs

def _scope_vector(root,names):
 result={}
 for name in names:
  observed=(root/name).lstat();assert stat.S_ISREG(observed.st_mode),'Regular captured file required';result[name]=observed
 return result

def _scope_directories(source_names,public_root,public_dirs):
 result=dict(public_dirs)
 for name in source_names:
  path=(ROOT/name).parent
  while True:
   actual=path.lstat();assert stat.S_ISDIR(actual.st_mode);result[str(path)]=actual
   if path==ROOT:break
   path=path.parent
 return result

def _scope_root_signature(raw):
 assert type(raw)is str
 lookup='.'if raw==''else raw
 actual=_scope_os.stat(lookup);assert stat.S_ISDIR(actual.st_mode)
 return (_scope_os.path.realpath(lookup),actual.st_dev,actual.st_ino,actual.st_mode)

def _scope_alias_authority(context):
 if not context.built:return None
 scope=_scope_os.environ.get('SCOPE_BETA_BUILD_ROOT');site=_scope_os.environ.get('SITE_DESIGN_BUILD_ROOT');default=str(ROOT/'.render-public')
 # Derive all consumers exactly: driver env.get differs from higher truthy fallbacks.
 driver=scope if scope is not None else default;higher=scope or site or default
 literals=list(dict.fromkeys([driver,higher,default]));signatures={raw:_scope_root_signature(raw)for raw in literals};expected=_scope_root_signature(str(context.public_root));assert all(value==expected for value in signatures.values()),'Only single physical public-root geometry is supported'
 relative=any(not _scope_os.path.isabs(raw)for raw in literals)
 cwd=(_scope_os.getcwd(),_scope_root_signature('.'))if relative else None
 return {'scope':scope,'site':site,'literals':literals,'signatures':signatures,'cwd':cwd}

def _scope_alias_check(context):
 authority=context.alias
 if authority is None:return
 assert _scope_os.environ.get('SCOPE_BETA_BUILD_ROOT')==authority['scope']and _scope_os.environ.get('SITE_DESIGN_BUILD_ROOT')==authority['site'],'Stable observed root environment'
 assert {raw:_scope_root_signature(raw)for raw in authority['literals']}==authority['signatures'],'Stable literal physical root'
 if authority['cwd']is not None:assert (_scope_os.getcwd(),_scope_root_signature('.'))==authority['cwd'],'Stable actual OS cwd'

def _scope_alias_map(state,authority):
 paths={}
 for namespace in['source','public']:
  if namespace=='public'and not state['built']:continue
  root=state[namespace+'_root']
  for relative in list(state[namespace+'_raw'])+list(state[namespace+'_dirs']):paths[str(Path(root)/relative)]=(namespace,relative)
 if authority is not None:
  for raw in authority['literals']:
   paths[raw]=('public','');paths[str(Path(raw))]=('public','')
   for relative in list(state['public_raw'])+list(state['public_dirs']):paths[str(Path(raw)/relative)]=('public',relative)
 return paths

def _scope_current(context):
 layer=context.layer;assert layer.source_exact(),'Complete current source admission'
 source_names=layer.source_names();assert _same_names(source_names,layer.delta['currentSourcePaths'])and len(source_names)==888
 if context.built:
  channel=layer.channel(context.public_root);assert channel in('current','legacy')and layer.public_exact(context.public_root,channel),'Complete current public admission';public_names,public_dirs=_scope_public_census(context.public_root);assert len(public_names)==381
 else:channel=None;public_names=[];public_dirs={}
 cached=git(ROOT,'ls-files','--cached');others=git(ROOT,'ls-files','--others','--exclude-standard');assert len(cached)+len(others)<=35644;assert _same_names((cached+others).decode().splitlines(),layer.delta['currentSourcePaths'])
 result={'head':git(ROOT,'rev-parse','--verify','HEAD^{commit}').decode().strip(),'tree':git(ROOT,'rev-parse','HEAD^{tree}').decode().strip(),'source_names':sorted(source_names),'public_names':public_names,'source_vector':_scope_vector(ROOT,source_names),'public_vector':_scope_vector(context.public_root,public_names)if context.built else{},'dirs':_scope_directories(source_names,context.public_root,public_dirs),'cached':cached,'others':others,'channel':channel}
 assert re.fullmatch('[a-f0-9]{40}',result['head'])and re.fullmatch('[a-f0-9]{40}',result['tree'])
 if context.built:result['marker']=(context.public_root/'.well-known/monderman-release.json').read_bytes();assert REV.fullmatch(result['marker'])
 return result

def _scope_endpoint(context):
 current=_scope_current(context)
 if context.initial is not None:
  original=context.initial
  assert current.keys()==original.keys()
  for key in original:
   if key.endswith('_vector')or key=='dirs':assert current[key].keys()==original[key].keys()and all(fingerprint(current[key][p])==fingerprint(original[key][p])for p in original[key]),'Physical identity/directory endpoint drift'
   else:assert current[key]==original[key],'Observed endpoint drift '+key
 _scope_alias_check(context)

def _scope_read_file(path,row,observed):
 assert type(row['bytes'])is int and 0<=row['bytes']<=_SCOPE_FILE_LIMIT
 flags=[]
 for name in['O_NOFOLLOW','O_NONBLOCK']:
  flag=getattr(_scope_os,name,None);assert type(flag)is int and flag>0,'Supported nonfollowing/nonblocking flag required';flags.append(flag)
 before=path.lstat();assert stat.S_ISREG(before.st_mode)and fingerprint(before)==fingerprint(observed)
 fd=None;value=None;errors=[]
 try:
  fd=_scope_os.open(path,_scope_os.O_RDONLY|flags[0]|flags[1]);actual=_scope_os.fstat(fd);assert stat.S_ISREG(actual.st_mode)and fingerprint(actual)==fingerprint(before)
  chunks=[];remaining=row['bytes']
  while remaining:
   chunk=_scope_os.read(fd,min(65536,remaining));assert chunk,'Short captured read';chunks.append(chunk);remaining-=len(chunk)
  assert not _scope_os.read(fd,1),'Long captured read';value=b''.join(chunks)
  assert fingerprint(_scope_os.fstat(fd))==fingerprint(before)and fingerprint(path.lstat())==fingerprint(before),'Captured read identity drift'
  assert len(value)==row['bytes']
  if row.get('kind')=='release_revision':assert REV.fullmatch(value),'Observed current release marker grammar'
  else:assert sha(value)==row['sha256']
  assert 'mode'not in row or ('100755'if actual.st_mode&0o111 else'100644')==row['mode']
 except BaseException as error:errors.append(error)
 finally:
  if fd is not None:
   try:_scope_os.close(fd)
   except BaseException as error:errors.append(error)
 if errors:
  if len(errors)==1:raise errors[0]
  raise BaseExceptionGroup('Capture read and close failures',errors)
 return value

def _scope_prior(delta,entry):
 length=entry['before_bytes'];assert type(length)is int and 0<=length<=_SCOPE_FILE_LIMIT,'Captured inflation preallocation bound'
 packed=delta['beforeBlobs'][entry['before_sha256']];assert type(packed)is str and len(packed)<=((_SCOPE_FILE_LIMIT+65536+2)//3)*4,'Captured compressed frame bound'
 return _SCOPE_ORIGINAL_UNPACK(delta,entry)

def _scope_namespace(root,names,vector,selected,rows,baseline,entries,delta,dirs):
 current={row['path']:row for row in rows};prior={row['path']:row for row in baseline};raw={name:{'stat':vector[name]}for name in names};logical={};directory={(''if Path(p)==root else Path(p).relative_to(root).as_posix()):{'stat':v}for p,v in dirs.items()if Path(p)==root or root in Path(p).parents}
 for name in selected:
  value=_scope_read_file(root/name,current[name],vector[name]);raw[name]['data']=value;before=_scope_prior(delta,entries[name])if name in entries else value
  assert type(before)is bytes and len(before)<=_SCOPE_FILE_LIMIT
  expected=prior[name]
  if current[name].get('kind')=='release_revision':assert before==value and len(before)==expected['bytes']and REV.fullmatch(before),'Preserve observed marker identity'
  else:assert len(before)==expected['bytes']and sha(before)==expected['sha256']
  if 'mode'in expected:assert ('100755'if vector[name].st_mode&0o111 else'100644')==expected['mode']
  logical[name]={'data':before,'stat':vector[name]}
 return raw,logical,directory

class _ScopeContext:
 def __init__(self,built,publish_root):
  assert type(built)is bool
  self.built=built;self.public_root=Path(_scope_path(publish_root)).resolve()if built else None;self.initial=None;self.alias=None;self.state=None;self.edition=None;self.owner=False;self.attempted=False
 def __enter__(self):
  global _scope_active
  assert self.attempted is False,'One use per captured context'
  self.attempted=True
  assert _scope_lock.acquire(blocking=False),'No nested or concurrent captured operation'
  _scope_active=True;self.owner=True;errors=[]
  try:
   self.layer=FiniteAudioLayer(ROOT,ROOT/GUARDS[-1],FIXTURE_SHA256);self.initial=_scope_current(self);self.alias=_scope_alias_authority(self);d=self.layer.delta;e=d['publicEditions'][self.initial['channel']]if self.built else None;source=set(d['baselineSourcePaths']);public=set(e['baselinePaths'])if e else set();current=[r for r in d['sourceRows']if r['path']in source]+([r for r in e['currentMap']if r['path']in public]if e else[]);outputs=d['baselineSourceRows']+(e['baselineMap']if e else[]);extra=[v for k,v in d['files'].items()if k in source]+(list(e['files'].values())if e else[])
   assert len(current)==849+(350 if e else 0)and all(type(r['bytes'])is int and 0<=r['bytes']<=_SCOPE_FILE_LIMIT for r in current+outputs)and all(type(r['before_bytes'])is int and 0<=r['before_bytes']<=_SCOPE_FILE_LIMIT for r in extra)
   total=sum(r['bytes']for r in current)+sum(r['before_bytes']for r in extra)+len(self.initial['cached'])+len(self.initial['others']);assert total<=_SCOPE_TOTAL_LIMIT
   sr,sl,sd=_scope_namespace(ROOT,self.initial['source_names'],self.initial['source_vector'],d['baselineSourcePaths'],d['sourceRows'],d['baselineSourceRows'],d['files'],d,self.initial['dirs'])
   if e:pr,pl,pd=_scope_namespace(self.public_root,self.initial['public_names'],self.initial['public_vector'],e['baselinePaths'],e['currentMap'],e['baselineMap'],e['files'],d,self.initial['dirs'])
   else:pr=pl=pd={}
   self.edition=object();self.state={'live':True,'built':self.built,'source_root':str(ROOT),'public_root':str(self.public_root)if self.built else None,'source_raw':sr,'source_logical':sl,'source_dirs':sd,'public_raw':pr,'public_logical':pl,'public_dirs':pd,'source_names_raw':self.initial['source_names'],'source_names_logical':d['baselineSourcePaths'],'public_names_raw':self.initial['public_names'],'public_names_logical':e['baselinePaths']if e else[],'audio':d,'channel':self.initial['channel'],'cached':self.initial['cached'],'others':self.initial['others'],'authorities':{},'alias_authority':self.alias}
   self.state['paths']=_scope_alias_map(self.state,self.alias);_scope_states[self.edition]=self.state;return self.edition
  except BaseException as error:errors.append(error)
  finally:
   if errors:
    try:self._revoke()
    except BaseException as error:errors.append(error)
    try:
     if not hasattr(self,'layer'):self.layer=FiniteAudioLayer(ROOT,ROOT/GUARDS[-1],FIXTURE_SHA256)
     _scope_endpoint(self)
    except BaseException as error:errors.append(error)
    try:self._release()
    except BaseException as error:errors.append(error)
  if len(errors)==1:raise errors[0]
  raise BaseExceptionGroup('Scope enter and endpoint failures',errors)
 def _revoke(self):
  if self.edition is not None:_scope_states.pop(self.edition,None)
  if self.state is not None:self.state['live']=False;self.state.clear()
 def _release(self):
  global _scope_active
  assert self.owner,'Owned captured context release'
  self.owner=False;_scope_active=False;_scope_lock.release()
 def __exit__(self,kind,error,traceback):
  assert self.owner and self.edition is not None and _scope_states.get(self.edition)is self.state,'Entered live context required before exit'
  errors=[]
  if error is not None:errors.append(error)
  try:self._revoke()
  except BaseException as secondary:errors.append(secondary)
  try:_scope_endpoint(self)
  except BaseException as secondary:errors.append(secondary)
  finally:
   try:self._release()
   except BaseException as secondary:errors.append(secondary)
  if len(errors)==1 and errors[0]is error:return False
  if len(errors)==1:raise errors[0]
  if errors:raise BaseExceptionGroup('Scope body, cleanup and endpoint failures',errors)
  return False

def scope_contract_inputs(built,publish_root=None):return _ScopeContext(built,publish_root)
