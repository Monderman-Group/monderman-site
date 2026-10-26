"""Finite authorized Part 7 publication view; unknown bytes stay visible."""
import base64, hashlib, json, subprocess, zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='5d3c06789eb9e3579e046cd5d60363d74157e45c9886479f53c9a06e1e6b0552'
raw=(ROOT/'scripts/fixtures/divide-rule-publication-20261025.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==FIXTURE_SHA256,'Exact reviewed Part7 fixture'
publication_delta=json.loads(raw)
assert publication_delta['schema']=='divide-rule-publication-20261025-v1'
assert publication_delta['baseline']=='1c0ba0bd8107e9fab611ccde151007e629cad0da'
sha=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()

def _view(entries,file,value):
 if not isinstance(file,str) or file not in entries:return value
 assert isinstance(value,(str,bytes))
 e=entries[file]
 if sha(value)!=e['after_sha256']:return value
 b=value.encode() if isinstance(value,str) else value
 assert len(b)==e['after_bytes']
 packed=publication_delta['beforeBlobs'][e['before_sha256']]
 compressed=base64.b64decode(packed,validate=True)
 assert base64.b64encode(compressed).decode()==packed
 decoder=zlib.decompressobj();prior=decoder.decompress(compressed,e['before_bytes']+1)
 assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
 assert len(prior)==e['before_bytes'] and sha(prior)==e['before_sha256']
 return prior.decode('utf8') if isinstance(value,str) else prior

def source_at_publication_baseline(file,value):return _view(publication_delta['files'],file,value)
def public_source_at_publication_baseline(file,value):
 for edition in publication_delta['publicEditions'].values():
  out=_view(edition['files'],file,value)
  if out!=value:return out
 return value

def _names(root):
 return sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file())
def _row_exact(root,row):
 p=root/row['path']
 return p.is_file() and not p.is_symlink() and len(p.read_bytes())==row['bytes'] and sha(p.read_bytes())==row['sha256'] and ('mode' not in row or ('100755' if p.stat().st_mode&0o111 else '100644')==row['mode'])
def publication_source_exact():
 names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT).decode().splitlines()
 return len(names)==len(set(names)) and sorted(names)==publication_delta['currentSourcePaths'] and all(_row_exact(ROOT,r) for r in publication_delta['sourceRows'])
def publication_public_exact(root,channel):
 root=Path(root)
 if channel not in publication_delta['publicEditions']:return False
 edition=publication_delta['publicEditions'][channel]
 if _names(root)!=edition['currentPaths']:return False
 for row in edition['currentMap']:
  if row['path']=='.well-known/monderman-release.json':
   p=root/row['path']
   if p.is_symlink():return False
   try:m=json.loads(p.read_bytes())
   except (ValueError,OSError):return False
   if list(m)!=['revision'] or not isinstance(m['revision'],str) or len(m['revision'])!=40 or any(c not in '0123456789abcdef' for c in m['revision']):return False
  elif not _row_exact(root,row):return False
 return True
def _paths(names,current,prior,exact):
 rows=list(names)
 return (set(prior) if isinstance(names,set) else list(prior)) if len(rows)==len(set(rows)) and sorted(rows)==current and exact else names
def source_paths_at_publication_baseline(names):return _paths(names,publication_delta['currentSourcePaths'],publication_delta['baselineSourcePaths'],publication_source_exact())
def public_paths_at_publication_baseline(names,root):
 root=Path(root);marker=root/'.well-known/monderman-questionnaire-release.json'
 if not marker.is_file():return names
 channel=json.loads(marker.read_bytes()).get('channel')
 if channel not in publication_delta['publicEditions']:return names
 e=publication_delta['publicEditions'][channel]
 return _paths(names,e['currentPaths'],e['baselinePaths'],publication_public_exact(root,channel))

def publication_read(file):return source_at_publication_baseline(file,(ROOT/file).read_bytes())
def publication_text(file):return publication_read(file).decode()
def publication_git(*args):
 """Only after raw Part7 certification, expose exact base read shapes."""
 from divide_rule_publication_20261025_contract import audit_publication
 audit_publication()
 if args==('ls-files','--cached'):return ('\n'.join(publication_delta['baselineSourcePaths'])+'\n').encode()
 if args==('ls-tree','-rl','HEAD'):args=('ls-tree','-rl',publication_delta['baseline'])
 if len(args)>3 and args[-1:]==('HEAD',) and args[:2] in [('diff','--name-only'),('diff','--raw')]:args=(*args[:-1],publication_delta['baseline'])
 return subprocess.check_output(['git',*args],cwd=ROOT)
