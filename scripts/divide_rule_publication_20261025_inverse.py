"""Finite authorized Part 7 publication view; unknown bytes stay visible."""
import base64, hashlib, json, subprocess, zlib
from pathlib import Path
from article_audio_20261026_inverse import source_at_audio_baseline,public_source_at_audio_baseline,source_paths_at_audio_baseline,public_paths_at_audio_baseline

ROOT=Path(__file__).resolve().parents[1]
FIXTURE_SHA256='73b64320951ec620302ebc13fede21ebac1303632859b3ee1f00c3820e544355'
raw=(ROOT/'scripts/fixtures/divide-rule-publication-20261025.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==FIXTURE_SHA256,'Exact reviewed Part7 fixture'
publication_delta=json.loads(raw)
assert publication_delta['schema']=='divide-rule-publication-20261025-v1'
assert publication_delta['baseline']=='1c0ba0bd8107e9fab611ccde151007e629cad0da'
sha=lambda b:hashlib.sha256(b.encode() if isinstance(b,str) else b).hexdigest()

def _view(entries,file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__view(entries,file,value,_scope_edition=_scope_edition)
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

def source_at_publication_baseline(file,value,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_at_publication_baseline(file,value,_scope_edition=_scope_edition)
 return _view(publication_delta['files'],file,source_at_audio_baseline(file,value))
def public_source_at_publication_baseline(file,value,root=None,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_at_publication_baseline(file,value,root,_scope_edition=_scope_edition)
 value=public_source_at_audio_baseline(file,value,root)
 for edition in publication_delta['publicEditions'].values():
  out=_view(edition['files'],file,value)
  if out!=value:return out
 return value

def _names(root,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__names(root,_scope_edition=_scope_edition)
 return sorted(public_paths_at_audio_baseline(sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()),root))
def _row_exact(root,row,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__row_exact(root,row,_scope_edition=_scope_edition)
 p=root/row['path']
 if not p.is_file() or p.is_symlink():return False
 b=source_at_audio_baseline(row['path'],p.read_bytes()) if Path(root).resolve()==ROOT.resolve() else public_source_at_audio_baseline(row['path'],p.read_bytes(),root)
 return len(b)==row['bytes'] and sha(b)==row['sha256'] and ('mode' not in row or ('100755' if p.stat().st_mode&0o111 else '100644')==row['mode'])
def publication_source_exact(*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_publication_source_exact(_scope_edition=_scope_edition)
 names=source_paths_at_audio_baseline(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT).decode().splitlines())
 return len(names)==len(set(names)) and sorted(names)==publication_delta['currentSourcePaths'] and all(_row_exact(ROOT,r) for r in publication_delta['sourceRows'])
def publication_public_exact(root,channel,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_publication_public_exact(root,channel,_scope_edition=_scope_edition)
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
def _paths(names,current,prior,exact,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__paths(names,current,prior,exact,_scope_edition=_scope_edition)
 rows=list(names)
 return (set(prior) if isinstance(names,set) else list(prior)) if len(rows)==len(set(rows)) and sorted(rows)==current and exact else names
def source_paths_at_publication_baseline(names,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_paths_at_publication_baseline(names,_scope_edition=_scope_edition)
 return _paths(source_paths_at_audio_baseline(names),publication_delta['currentSourcePaths'],publication_delta['baselineSourcePaths'],publication_source_exact())
def public_paths_at_publication_baseline(names,root,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_paths_at_publication_baseline(names,root,_scope_edition=_scope_edition)
 names=public_paths_at_audio_baseline(names,root)
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

from article_audio_20261026_inverse import validate_scope_edition,scope_fixture_data,scope_hiring_fixture_data,scope_contract_logical_io

def _scope_private_data(edition):
 validate_scope_edition(edition,source_root=ROOT)
 return scope_fixture_data(edition,'scripts/fixtures/divide-rule-publication-20261025.json',FIXTURE_SHA256)

# Explicit captured branches: ordinary None bodies above remain literal.
def _scope_cap__view(entries, file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    if not isinstance(file, str) or file not in entries:
        return value
    assert isinstance(value, (str, bytes))
    e = entries[file]
    if sha(value) != e['after_sha256']:
        return value
    b = value.encode() if isinstance(value, str) else value
    assert len(b) == e['after_bytes']
    packed = _scope_data['beforeBlobs'][e['before_sha256']]
    compressed = base64.b64decode(packed, validate=True)
    assert base64.b64encode(compressed).decode() == packed
    decoder = zlib.decompressobj()
    prior = decoder.decompress(compressed, e['before_bytes'] + 1)
    assert decoder.eof and (not decoder.unused_data) and (not decoder.unconsumed_tail)
    assert len(prior) == e['before_bytes'] and sha(prior) == e['before_sha256']
    return prior.decode('utf8') if isinstance(value, str) else prior

def _scope_cap_source_at_publication_baseline(file, value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    return _scope_cap__view(_scope_data['files'], file, source_at_audio_baseline(file, value, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_at_publication_baseline(file, value, root=None, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(value) in (str, bytes), 'Native captured value'
    value = public_source_at_audio_baseline(file, value, root, _scope_edition=_scope_edition)
    for edition in _scope_data['publicEditions'].values():
        out = _scope_cap__view(edition['files'], file, value, _scope_edition=_scope_edition)
        if out != value:
            return out
    return value

def _scope_cap__names(root, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return sorted(public_paths_at_audio_baseline(sorted((p.relative_to(root).as_posix() for p in _scope_io.public_paths(root) if _scope_io.is_file(p))), root, _scope_edition=_scope_edition))

def _scope_cap__row_exact(root, row, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    _scope_io.is_source_root(root)
    p = root / row['path']
    if not _scope_io.is_file(p) or _scope_io.is_symlink(p):
        return False
    b = source_at_audio_baseline(row['path'], _scope_io.read_bytes(p), _scope_edition=_scope_edition) if _scope_io.is_source_root(root) else public_source_at_audio_baseline(row['path'], _scope_io.read_bytes(p), root, _scope_edition=_scope_edition)
    return len(b) == row['bytes'] and sha(b) == row['sha256'] and ('mode' not in row or ('100755' if _scope_io.stat(p).st_mode & 73 else '100644') == row['mode'])

def _scope_cap_publication_source_exact(*, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    names = source_paths_at_audio_baseline(_scope_io.git('ls-files', '--cached', '--others', '--exclude-standard').decode().splitlines(), _scope_edition=_scope_edition)
    return len(names) == len(set(names)) and sorted(names) == _scope_data['currentSourcePaths'] and all((_scope_cap__row_exact(ROOT, r, _scope_edition=_scope_edition) for r in _scope_data['sourceRows']))

def _scope_cap_publication_public_exact(root, channel, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if root is not None:
        validate_scope_edition(_scope_edition, public_root=root)
    validate_scope_edition(_scope_edition, channel=channel)
    root = Path(root)
    if channel not in _scope_data['publicEditions']:
        return False
    edition = _scope_data['publicEditions'][channel]
    if _scope_cap__names(root, _scope_edition=_scope_edition) != edition['currentPaths']:
        return False
    for row in edition['currentMap']:
        if row['path'] == '.well-known/monderman-release.json':
            p = root / row['path']
            if _scope_io.is_symlink(p):
                return False
            try:
                m = json.loads(_scope_io.read_bytes(p))
            except (ValueError, OSError):
                return False
            if list(m) != ['revision'] or not isinstance(m['revision'], str) or len(m['revision']) != 40 or any((c not in '0123456789abcdef' for c in m['revision'])):
                return False
        elif not _scope_cap__row_exact(root, row, _scope_edition=_scope_edition):
            return False
    return True

def _scope_cap__paths(names, current, prior, exact, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    rows = list(names)
    return (set(prior) if isinstance(names, set) else list(prior)) if len(rows) == len(set(rows)) and sorted(rows) == current and exact else names

def _scope_cap_source_paths_at_publication_baseline(names, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap__paths(source_paths_at_audio_baseline(names, _scope_edition=_scope_edition), _scope_data['currentSourcePaths'], _scope_data['baselineSourcePaths'], _scope_cap_publication_source_exact(_scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_paths_at_publication_baseline(names, root, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if root is not None:
        validate_scope_edition(_scope_edition, public_root=root)
    names = public_paths_at_audio_baseline(names, root, _scope_edition=_scope_edition)
    root = Path(root)
    marker = root / '.well-known/monderman-questionnaire-release.json'
    if not _scope_io.is_file(marker):
        return names
    channel = json.loads(_scope_io.read_bytes(marker)).get('channel')
    if channel not in _scope_data['publicEditions']:
        return names
    e = _scope_data['publicEditions'][channel]
    return _scope_cap__paths(names, e['currentPaths'], e['baselinePaths'], _scope_cap_publication_public_exact(root, channel, _scope_edition=_scope_edition), _scope_edition=_scope_edition)
