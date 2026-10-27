"""Exact post1858 series layer; unknown complete bytes and inventories stay visible."""
import base64, hashlib, json, os, zlib
from pathlib import Path
from divide_rule_publication_20261025_inverse import source_at_publication_baseline,public_source_at_publication_baseline,source_paths_at_publication_baseline,public_paths_at_publication_baseline,publication_source_exact,publication_public_exact
ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='c0fcf2c9f87e6562dc43fd30ee033200e78bb7f37bd0fb3e88a67306004bff7a'
raw=(ROOT/'scripts/fixtures/hiring-work-design-series-20261017.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==FIXTURE_SHA256, 'Exact finite post1858 fixture'
series_delta=json.loads(raw)
assert series_delta['schema']=='hiring-work-design-post1858-v1'
assert series_delta['baseline']=='1858c1bfef88e9407b7cd900fb840f230de8bed7'
assert series_delta['baselineTree']=='52ff88a9b2ee877fa9c8afc75b2a11cf3b112a78'
sha=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()
def _before(entry,file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__before(entry,file,value,_scope_edition=_scope_edition)
 assert isinstance(value,(str,bytes))
 b=value.encode() if isinstance(value,str) else value
 assert len(b)==entry['after_bytes'] and sha(b)==entry['after_sha256'], file+': complete current bytes'
 packed=series_delta['beforeBlobs'][entry['before_sha256']]
 compressed=base64.b64decode(packed,validate=True)
 assert base64.b64encode(compressed).decode()==packed
 decoder=zlib.decompressobj();prior=decoder.decompress(compressed,entry['before_bytes']+1)
 assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail and len(prior)==entry['before_bytes'] and sha(prior)==entry['before_sha256']
 return prior.decode('utf8') if isinstance(value,str) else prior
def _view(entries,file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__view(entries,file,value,_scope_edition=_scope_edition)
 if not isinstance(file,str) or file not in entries:return value
 assert isinstance(value,(str,bytes))
 return _before(entries[file],file,value) if sha(value)==entries[file]['after_sha256'] else value
def source_at_series_baseline(file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_at_series_baseline(file,value,_scope_edition=_scope_edition)
 return _view(series_delta['files'],file,source_at_publication_baseline(file,value))
def public_source_at_series_baseline(file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_at_series_baseline(file,value,_scope_edition=_scope_edition)
 value=public_source_at_publication_baseline(file,value)
 for edition in series_delta['publicEditions'].values():
  out=_view(edition['files'],file,value)
  if out!=value:return out
 return value
def source_before_series(file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_before_series(file,value,_scope_edition=_scope_edition)
 value=source_at_publication_baseline(file,value)
 return _before(series_delta['files'][file],file,value) if file in series_delta['files'] else value
def series_source_exact(*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_series_source_exact(_scope_edition=_scope_edition)
 if not publication_source_exact():return False
 for row in series_delta['nonGuardSourceRows']:
  p=ROOT/row['path']
  if not p.is_file() or p.is_symlink():return False
  b=source_at_publication_baseline(row['path'],p.read_bytes())
  if len(b)!=row['bytes'] or sha(b)!=row['sha256'] or ('100755' if p.stat().st_mode&0o111 else '100644')!=row['mode'] or hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()!=row['gitBlobSha1']:return False
 return True
def series_public_exact(root,channel,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_series_public_exact(root,channel,_scope_edition=_scope_edition)
 if not publication_public_exact(root,channel):return False
 if channel not in series_delta['publicEditions']:return False
 for row in series_delta['publicEditions'][channel]['currentMap']:
  p=Path(root)/row['path']
  if not p.is_file() or p.is_symlink():return False
  b=public_source_at_publication_baseline(row['path'],p.read_bytes())
  if row['path']=='.well-known/monderman-release.json':
   marker=json.loads(b)
   if list(marker)!=['revision'] or not isinstance(marker['revision'],str) or len(marker['revision'])!=40 or any(c not in '0123456789abcdef' for c in marker['revision']):return False
  elif len(b)!=row['bytes'] or sha(b)!=row['sha256']:return False
 return True
def _paths(names,current,prior,exact,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__paths(names,current,prior,exact,_scope_edition=_scope_edition)
 rows=list(names)
 assert all(isinstance(f,str) for f in rows)
 return (set(prior) if isinstance(names,set) else list(prior)) if len(rows)==len(set(rows)) and sorted(rows)==current and exact else names
def source_paths_at_series_baseline(names,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_paths_at_series_baseline(names,_scope_edition=_scope_edition)
 return _paths(source_paths_at_publication_baseline(names),series_delta['currentSourcePaths'],series_delta['baselineSourcePaths'],series_source_exact())
def public_paths_at_series_baseline(names,root=None,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_paths_at_series_baseline(names,root,_scope_edition=_scope_edition)
 root=Path(root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT/'.render-public')
 names=public_paths_at_publication_baseline(names,root)
 marker=root/'.well-known/monderman-questionnaire-release.json'
 if not marker.is_file():return names
 channel=json.loads(marker.read_bytes()).get('channel')
 return _paths(names,series_delta['currentPublicPaths'],series_delta['baselinePublicPaths'],series_public_exact(root,channel))

from article_audio_20261026_inverse import validate_scope_edition,scope_fixture_data,scope_hiring_fixture_data,scope_contract_logical_io

def _scope_private_data(edition):
 validate_scope_edition(edition,source_root=ROOT)
 return scope_fixture_data(edition,'scripts/fixtures/hiring-work-design-series-20261017.json',FIXTURE_SHA256)

# Explicit captured branches: ordinary None bodies above remain literal.
def _scope_cap__before(entry, file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    assert isinstance(value, (str, bytes))
    b = value.encode() if isinstance(value, str) else value
    assert len(b) == entry['after_bytes'] and sha(b) == entry['after_sha256'], file + ': complete current bytes'
    packed = _scope_data['beforeBlobs'][entry['before_sha256']]
    compressed = base64.b64decode(packed, validate=True)
    assert base64.b64encode(compressed).decode() == packed
    decoder = zlib.decompressobj()
    prior = decoder.decompress(compressed, entry['before_bytes'] + 1)
    assert decoder.eof and (not decoder.unused_data) and (not decoder.unconsumed_tail) and (len(prior) == entry['before_bytes']) and (sha(prior) == entry['before_sha256'])
    return prior.decode('utf8') if isinstance(value, str) else prior

def _scope_cap__view(entries, file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    if not isinstance(file, str) or file not in entries:
        return value
    assert isinstance(value, (str, bytes))
    return _scope_cap__before(entries[file], file, value, _scope_edition=_scope_edition) if sha(value) == entries[file]['after_sha256'] else value

def _scope_cap_source_at_series_baseline(file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    return _scope_cap__view(_scope_data['files'], file, source_at_publication_baseline(file, value, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_at_series_baseline(file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    value = public_source_at_publication_baseline(file, value, _scope_edition=_scope_edition)
    for edition in _scope_data['publicEditions'].values():
        out = _scope_cap__view(edition['files'], file, value, _scope_edition=_scope_edition)
        if out != value:
            return out
    return value

def _scope_cap_source_before_series(file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    value = source_at_publication_baseline(file, value, _scope_edition=_scope_edition)
    return _scope_cap__before(_scope_data['files'][file], file, value, _scope_edition=_scope_edition) if file in _scope_data['files'] else value

def _scope_cap_series_source_exact(*, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if not publication_source_exact(_scope_edition=_scope_edition):
        return False
    for row in _scope_data['nonGuardSourceRows']:
        p = ROOT / row['path']
        if not _scope_io.is_file(p) or _scope_io.is_symlink(p):
            return False
        b = source_at_publication_baseline(row['path'], _scope_io.read_bytes(p), _scope_edition=_scope_edition)
        if len(b) != row['bytes'] or sha(b) != row['sha256'] or ('100755' if _scope_io.stat(p).st_mode & 73 else '100644') != row['mode'] or (hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\x00' + b).hexdigest() != row['gitBlobSha1']):
            return False
    return True

def _scope_cap_series_public_exact(root, channel, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if root is not None:
        validate_scope_edition(_scope_edition, public_root=root)
    validate_scope_edition(_scope_edition, channel=channel)
    if not publication_public_exact(root, channel, _scope_edition=_scope_edition):
        return False
    if channel not in _scope_data['publicEditions']:
        return False
    for row in _scope_data['publicEditions'][channel]['currentMap']:
        p = Path(root) / row['path']
        if not _scope_io.is_file(p) or _scope_io.is_symlink(p):
            return False
        b = public_source_at_publication_baseline(row['path'], _scope_io.read_bytes(p), _scope_edition=_scope_edition)
        if row['path'] == '.well-known/monderman-release.json':
            marker = json.loads(b)
            if list(marker) != ['revision'] or not isinstance(marker['revision'], str) or len(marker['revision']) != 40 or any((c not in '0123456789abcdef' for c in marker['revision'])):
                return False
        elif len(b) != row['bytes'] or sha(b) != row['sha256']:
            return False
    return True

def _scope_cap__paths(names, current, prior, exact, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    rows = list(names)
    assert all((isinstance(f, str) for f in rows))
    return (set(prior) if isinstance(names, set) else list(prior)) if len(rows) == len(set(rows)) and sorted(rows) == current and exact else names

def _scope_cap_source_paths_at_series_baseline(names, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap__paths(source_paths_at_publication_baseline(names, _scope_edition=_scope_edition), _scope_data['currentSourcePaths'], _scope_data['baselineSourcePaths'], _scope_cap_series_source_exact(_scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_paths_at_series_baseline(names, root=None, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if root is not None:
        validate_scope_edition(_scope_edition, public_root=root)
    root = Path(root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT / '.render-public')
    names = public_paths_at_publication_baseline(names, root, _scope_edition=_scope_edition)
    marker = root / '.well-known/monderman-questionnaire-release.json'
    if not _scope_io.is_file(marker):
        return names
    channel = json.loads(_scope_io.read_bytes(marker)).get('channel')
    return _scope_cap__paths(names, _scope_data['currentPublicPaths'], _scope_data['baselinePublicPaths'], _scope_cap_series_public_exact(root, channel, _scope_edition=_scope_edition), _scope_edition=_scope_edition)
