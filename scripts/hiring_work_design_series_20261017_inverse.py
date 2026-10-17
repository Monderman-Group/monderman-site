"""Exact post1858 series layer; unknown complete bytes and inventories stay visible."""
import base64, hashlib, json, os, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='1ab65dfc18132dc0d7a9f765f51845b09ba220be1da3b45bb4ed2a3b037ae170'
raw=(ROOT/'scripts/fixtures/hiring-work-design-series-20261017.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==FIXTURE_SHA256, 'Exact finite post1858 fixture'
series_delta=json.loads(raw)
assert series_delta['schema']=='hiring-work-design-post1858-v1'
assert series_delta['baseline']=='1858c1bfef88e9407b7cd900fb840f230de8bed7'
assert series_delta['baselineTree']=='52ff88a9b2ee877fa9c8afc75b2a11cf3b112a78'
sha=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def _before(entry,file,value):
 assert isinstance(value,(str,bytes))
 b=value.encode() if isinstance(value,str) else value
 assert len(b)==entry['after_bytes'] and sha(b)==entry['after_sha256'], file+': complete current bytes'
 packed=series_delta['beforeBlobs'][entry['before_sha256']]
 compressed=base64.b64decode(packed,validate=True)
 assert base64.b64encode(compressed).decode()==packed
 decoder=zlib.decompressobj();prior=decoder.decompress(compressed,entry['before_bytes']+1)
 assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail and len(prior)==entry['before_bytes'] and sha(prior)==entry['before_sha256']
 return prior.decode('utf8') if isinstance(value,str) else prior
def _view(entries,file,value):
 if not isinstance(file,str) or file not in entries:return value
 assert isinstance(value,(str,bytes))
 return _before(entries[file],file,value) if sha(value)==entries[file]['after_sha256'] else value
def source_at_series_baseline(file,value):return _view(series_delta['files'],file,value)
def public_source_at_series_baseline(file,value):
 for edition in series_delta['publicEditions'].values():
  out=_view(edition['files'],file,value)
  if out!=value:return out
 return value
def source_before_series(file,value):return _before(series_delta['files'][file],file,value) if file in series_delta['files'] else value
def series_source_exact():
 for row in series_delta['nonGuardSourceRows']:
  p=ROOT/row['path']
  if not p.is_file() or p.is_symlink():return False
  b=p.read_bytes()
  if len(b)!=row['bytes'] or sha(b)!=row['sha256'] or ('100755' if p.stat().st_mode&0o111 else '100644')!=row['mode'] or hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()!=row['gitBlobSha1']:return False
 return True
def series_public_exact(root,channel):
 if channel not in series_delta['publicEditions']:return False
 for row in series_delta['publicEditions'][channel]['currentMap']:
  p=Path(root)/row['path']
  if not p.is_file() or p.is_symlink():return False
  b=p.read_bytes()
  if row['path']=='.well-known/monderman-release.json':
   marker=json.loads(b)
   if list(marker)!=['revision'] or not isinstance(marker['revision'],str) or len(marker['revision'])!=40 or any(c not in '0123456789abcdef' for c in marker['revision']):return False
  elif len(b)!=row['bytes'] or sha(b)!=row['sha256']:return False
 return True
def _paths(names,current,prior,exact):
 rows=list(names)
 assert all(isinstance(f,str) for f in rows)
 return (set(prior) if isinstance(names,set) else list(prior)) if len(rows)==len(set(rows)) and sorted(rows)==current and exact else names
def source_paths_at_series_baseline(names):return _paths(names,series_delta['currentSourcePaths'],series_delta['baselineSourcePaths'],series_source_exact())
def public_paths_at_series_baseline(names,root=None):
 root=Path(root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT/'.render-public')
 marker=root/'.well-known/monderman-questionnaire-release.json'
 if not marker.is_file():return names
 channel=json.loads(marker.read_bytes()).get('channel')
 return _paths(names,series_delta['currentPublicPaths'],series_delta['baselinePublicPaths'],series_public_exact(root,channel))
