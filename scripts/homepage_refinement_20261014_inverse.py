"""Finite homepage refinement leaf; unknown edits and extra files remain visible."""
import hashlib,json
from pathlib import Path
BASELINE='94cabdfe6fdd6b15e13ed15af2f6f2398e806fa9'
VERSION='homepage-refinement-20261014.1'
FIXTURE_SHA256='bd2af72d1ad9363cea3d7091d265fc1ece4ab4cbbbc8a477fa4a88ad31ecbf2c'
ROOT=Path(__file__).resolve().parents[1]
_bytes=(Path(__file__).resolve().parent/'fixtures/homepage-refinement-20261014.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest()==FIXTURE_SHA256
_fixture=json.loads(_bytes)
assert _fixture['baseline']==BASELINE and _fixture['baselineTree']=='ec0da7e2fd54467f10e78093229931ea26f9ffb1' and _fixture['version']==VERSION
FILES=tuple(_fixture['files']);ADDITIONS=tuple(_fixture['additions']);GUARD_FILES=tuple(_fixture['guardFiles'])
def source_before_homepage_refinement_20261014(file,source):
 entry=_fixture['files'].get(file) if isinstance(file,str) else None
 if entry is None:return source
 assert isinstance(source,(str,bytes))
 encoded=source.encode('utf8') if isinstance(source,str) else source
 assert hashlib.sha256(encoded).hexdigest()==entry['after_sha256'],file+': only exact complete approved bytes'
 restored=encoded.decode('utf8').encode('utf-16-le')
 for start,end,current,prior in reversed(entry['replacements']):
  assert restored[start*2:end*2].decode('utf-16-le')==current
  restored=restored[:start*2]+prior.encode('utf-16-le')+restored[end*2:]
 result=restored.decode('utf-16-le').encode('utf8')
 assert hashlib.sha256(result).hexdigest()==entry['before_sha256']
 return result.decode('utf8') if isinstance(source,str) else result

def source_at_homepage_refinement_baseline(file,source):
 entry=_fixture['files'].get(file) if isinstance(file,str) else None
 if entry is None:return source
 assert isinstance(source,(str,bytes))
 encoded=source.encode('utf8') if isinstance(source,str) else source
 return source_before_homepage_refinement_20261014(file,source) if hashlib.sha256(encoded).hexdigest()==entry['after_sha256'] else source

def _additions_exact():
 for file,entry in _fixture['additions'].items():
  p=ROOT/file
  if not p.is_file():return False
  b=p.read_bytes()
  if hashlib.sha256(b).hexdigest()!=entry['sha256'] or len(b)!=entry['bytes']:return False
 return True

def _names_at_baseline(names,current,prior):
 rows=list(names)
 assert all(isinstance(n,str) for n in rows)
 if _fixture['provisional'] is False and len(rows)==len(set(rows)) and sorted(rows)==sorted(current) and _additions_exact():
  return set(prior) if isinstance(names,set) else list(prior)
 return names

def source_paths_at_homepage_refinement_baseline(names):
 return _names_at_baseline(names,_fixture['currentSourcePaths'],_fixture['baselineSourcePaths'])

def public_paths_at_homepage_refinement_baseline(names):
 return _names_at_baseline(names,_fixture['currentPublicPaths'],_fixture['baselinePublicPaths'])
