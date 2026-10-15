"""Finite current design leaf; unknown source and path sets stay visible."""
import hashlib,json
from pathlib import Path
BASELINE='f2a81afdd30863c68b4ae748936163a141b0edd6'
VERSION='q2-sodi-20261015.16'
FIXTURE_SHA256='03c262b1182116c63d7a015f5750fc38f24271676f3f92a1701655e5490f053e'
ROOT=Path(__file__).resolve().parents[1]
_bytes=(Path(__file__).resolve().parent/'fixtures/scope-beta-20261014.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest()==FIXTURE_SHA256
_fixture=json.loads(_bytes)
assert _fixture['baseline']==BASELINE and _fixture['baselineTree']=='38b4396e74757fac9f90780e81ca821d41aaa785' and _fixture['version']==VERSION
FILES=tuple(_fixture['files']);ADDITIONS=tuple(_fixture['additions']);GUARD_FILES=tuple(_fixture['guardFiles'])
def _entry(entries,file):return entries.get(file) if isinstance(file,str) else None
def _reverse(entries,file,source):
 e=_entry(entries,file)
 if e is None:return source
 assert isinstance(source,(str,bytes))
 if 'encoding' in e:assert e['encoding']=='base64',file+': known finite binary encoding'
 if e.get('encoding')=='base64':assert isinstance(source,bytes),file+': finite binary input stays bytes'
 encoded=source.encode('utf8') if isinstance(source,str) else source
 assert hashlib.sha256(encoded).hexdigest()==e['after_sha256'],file+': exact complete approved input'
 if e.get('encoding')=='base64':
  import base64,binascii
  assert type(e['before_bytes']) is int and e['before_bytes']>=0 and type(e['after_bytes']) is int and e['after_bytes']==len(source),file+': finite binary byte sizes'
  assert isinstance(e['replacements'],list) and e['replacements'],file+': nonempty literal binary hunks'
  def decode(value):
   assert isinstance(value,str),file+': literal base64 type'
   try:b=base64.b64decode(value,validate=True)
   except (ValueError,binascii.Error) as error:raise AssertionError(file+': invalid literal base64') from error
   assert base64.b64encode(b).decode()==value,file+': canonical literal base64'
   return b
  previous_end=0;rows=[]
  for row in e['replacements']:
   assert isinstance(row,list) and len(row)==4,file+': exact binary hunk tuple'
   start,end,now,prior=row
   assert type(start) is int and type(end) is int and previous_end<=start<=end<=len(source),file+': finite ordered nonoverlapping byte offsets'
   current=decode(now);original=decode(prior);assert end-start==len(current) and source[start:end]==current,file+': exact finite binary hunk/length'
   rows.append((start,end,original));previous_end=end
  out=source
  for start,end,prior in reversed(rows):out=out[:start]+prior+out[end:]
  assert len(out)==e['before_bytes'] and hashlib.sha256(out).hexdigest()==e['before_sha256'],file+': complete actualF2A81 binary restored'
  return out
 out=encoded.decode('utf8').encode('utf-16-le')
 for start,end,now,old in reversed(e['replacements']):
  assert out[start*2:end*2].decode('utf-16-le')==now,file+': literal finite UTF16 hunk'
  out=out[:start*2]+old.encode('utf-16-le')+out[end*2:]
 result=out.decode('utf-16-le').encode('utf8');assert hashlib.sha256(result).hexdigest()==e['before_sha256']
 return result.decode('utf8') if isinstance(source,str) else result
def _at_baseline(entries,file,source):
 e=_entry(entries,file)
 if e is None:return source
 assert isinstance(source,(str,bytes))
 if 'encoding' in e:assert e['encoding']=='base64',file+': known finite binary encoding'
 if e.get('encoding')=='base64':assert isinstance(source,bytes),file+': finite binary input stays bytes'
 encoded=source.encode('utf8') if isinstance(source,str) else source
 return _reverse(entries,file,source) if hashlib.sha256(encoded).hexdigest()==e['after_sha256'] else source
def source_before_scope_beta_20261014(file,source):return _reverse(_fixture['files'],file,source)
def source_at_scope_beta_baseline(file,source):return _at_baseline(_fixture['files'],file,source)
def public_source_before_scope_beta_channel_20261014(file,source):return _reverse(_fixture.get('channelVariants',{}),file,source)
def public_source_at_scope_beta_channel_baseline(file,source):return _at_baseline(_fixture.get('channelVariants',{}),file,source)
def public_source_before_scope_beta_20261014(file,source):return _reverse(_fixture['publicFiles'],file,public_source_at_scope_beta_channel_baseline(file,source))
def public_source_at_scope_beta_baseline(file,source):return _at_baseline(_fixture['publicFiles'],file,public_source_at_scope_beta_channel_baseline(file,source))
def _additions_exact():
 for f,e in _fixture['additions'].items():
  p=ROOT/f
  if not p.is_file():return False
  b=p.read_bytes()
  if len(b)!=e['bytes'] or hashlib.sha256(b).hexdigest()!=e['sha256']:return False
 return True
def _names_at_baseline(names,current,prior):
 rows=list(names);assert all(isinstance(f,str) for f in rows)
 if _fixture['provisional'] is False and len(rows)==len(set(rows)) and sorted(rows)==sorted(current) and _additions_exact():return set(prior) if isinstance(names,set) else list(prior)
 return names
def source_paths_at_scope_beta_baseline(names):return _names_at_baseline(names,_fixture['currentSourcePaths'],_fixture['baselineSourcePaths'])
def public_paths_at_scope_beta_baseline(names):return _names_at_baseline(names,_fixture['currentPublicPaths'],_fixture['baselinePublicPaths'])
