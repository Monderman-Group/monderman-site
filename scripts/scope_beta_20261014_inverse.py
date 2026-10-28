"""Finite current design leaf; unknown source and path sets stay visible."""
from hiring_blind_spot_publication_20261015_inverse import source_at_hiring_publication_baseline, public_source_at_hiring_publication_baseline, source_paths_at_hiring_publication_baseline, public_paths_at_hiring_publication_baseline
import hashlib,json
from pathlib import Path
BASELINE='f2a81afdd30863c68b4ae748936163a141b0edd6'
VERSION='q2-sodi-20261015.10'
FIXTURE_SHA256='323763faac9606b8dc4f0912fd251955819a3bf4ebcfe95eaf2217c91b098a7d'
ROOT=Path(__file__).resolve().parents[1]
_bytes=(Path(__file__).resolve().parent/'fixtures/scope-beta-20261014.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest()==FIXTURE_SHA256
_fixture=json.loads(_bytes)
assert _fixture['baseline']==BASELINE and _fixture['baselineTree']=='38b4396e74757fac9f90780e81ca821d41aaa785' and _fixture['version']==VERSION
FILES=tuple(_fixture['files']);ADDITIONS=tuple(_fixture['additions']);GUARD_FILES=tuple(_fixture['guardFiles'])
def _entry(entries,file,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__entry(entries,file,_scope_edition=_scope_edition)
 return entries.get(file) if isinstance(file,str) else None
def _reverse(entries,file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__reverse(entries,file,source,_scope_edition=_scope_edition)
 e=_entry(entries,file)
 if e is None:return source
 assert isinstance(source,(str,bytes))
 encoded=source.encode('utf8') if isinstance(source,str) else source
 assert hashlib.sha256(encoded).hexdigest()==e['after_sha256'],file+': exact complete approved input'
 out=encoded.decode('utf8').encode('utf-16-le')
 for start,end,now,old in reversed(e['replacements']):
  assert out[start*2:end*2].decode('utf-16-le')==now,file+': literal finite UTF16 hunk'
  out=out[:start*2]+old.encode('utf-16-le')+out[end*2:]
 result=out.decode('utf-16-le').encode('utf8');assert hashlib.sha256(result).hexdigest()==e['before_sha256']
 return result.decode('utf8') if isinstance(source,str) else result
def _at_baseline(entries,file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__at_baseline(entries,file,source,_scope_edition=_scope_edition)
 e=_entry(entries,file)
 if e is None:return source
 assert isinstance(source,(str,bytes))
 encoded=source.encode('utf8') if isinstance(source,str) else source
 return _reverse(entries,file,source) if hashlib.sha256(encoded).hexdigest()==e['after_sha256'] else source
def source_before_scope_beta_20261014(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_before_scope_beta_20261014(file,source,_scope_edition=_scope_edition)
 return _reverse(_fixture['files'],file,source_at_hiring_publication_baseline(file,source))
def source_at_scope_beta_baseline(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_at_scope_beta_baseline(file,source,_scope_edition=_scope_edition)
 return _at_baseline(_fixture['files'],file,source_at_hiring_publication_baseline(file,source))
def public_source_before_scope_beta_channel_20261014(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_before_scope_beta_channel_20261014(file,source,_scope_edition=_scope_edition)
 return _reverse(_fixture.get('channelVariants',{}),file,public_source_at_hiring_publication_baseline(file,source))
def public_source_at_scope_beta_channel_baseline(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_at_scope_beta_channel_baseline(file,source,_scope_edition=_scope_edition)
 return _at_baseline(_fixture.get('channelVariants',{}),file,public_source_at_hiring_publication_baseline(file,source))
def public_source_before_scope_beta_20261014(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_before_scope_beta_20261014(file,source,_scope_edition=_scope_edition)
 return _reverse(_fixture['publicFiles'],file,public_source_at_scope_beta_channel_baseline(file,source))
def public_source_at_scope_beta_baseline(file,source,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_source_at_scope_beta_baseline(file,source,_scope_edition=_scope_edition)
 return _at_baseline(_fixture['publicFiles'],file,public_source_at_scope_beta_channel_baseline(file,source))
def _additions_exact(*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__additions_exact(_scope_edition=_scope_edition)
 for f,e in _fixture['additions'].items():
  p=ROOT/f
  if not p.is_file():return False
  b=source_at_hiring_publication_baseline(f,p.read_bytes())
  if len(b)!=e['bytes'] or hashlib.sha256(b).hexdigest()!=e['sha256']:return False
 return True
def _names_at_baseline(names,current,prior,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap__names_at_baseline(names,current,prior,_scope_edition=_scope_edition)
 rows=list(names);assert all(isinstance(f,str) for f in rows)
 if _fixture['provisional'] is False and len(rows)==len(set(rows)) and sorted(rows)==sorted(current) and _additions_exact():return set(prior) if isinstance(names,set) else list(prior)
 return names
def source_paths_at_scope_beta_baseline(names,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_source_paths_at_scope_beta_baseline(names,_scope_edition=_scope_edition)
 return _names_at_baseline(source_paths_at_hiring_publication_baseline(names),_fixture['currentSourcePaths'],_fixture['baselineSourcePaths'])
def public_paths_at_scope_beta_baseline(names,*,_scope_edition=None):
 if _scope_edition is not None: return _scope_cap_public_paths_at_scope_beta_baseline(names,_scope_edition=_scope_edition)
 return _names_at_baseline(public_paths_at_hiring_publication_baseline(names),_fixture['currentPublicPaths'],_fixture['baselinePublicPaths'])

from article_audio_20261026_inverse import validate_scope_edition,scope_fixture_data,scope_hiring_fixture_data,scope_contract_logical_io

def _scope_private_data(edition):
 validate_scope_edition(edition,source_root=ROOT)
 return scope_fixture_data(edition,'scripts/fixtures/scope-beta-20261014.json',FIXTURE_SHA256)

# Explicit captured branches: ordinary None bodies above remain literal.
def _scope_cap__entry(entries, file, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    return entries.get(file) if isinstance(file, str) else None

def _scope_cap__reverse(entries, file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    e = _scope_cap__entry(entries, file, _scope_edition=_scope_edition)
    if e is None:
        return source
    assert isinstance(source, (str, bytes))
    encoded = source.encode('utf8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == e['after_sha256'], file + ': exact complete approved input'
    out = encoded.decode('utf8').encode('utf-16-le')
    for (start, end, now, old) in reversed(e['replacements']):
        assert out[start * 2:end * 2].decode('utf-16-le') == now, file + ': literal finite UTF16 hunk'
        out = out[:start * 2] + old.encode('utf-16-le') + out[end * 2:]
    result = out.decode('utf-16-le').encode('utf8')
    assert hashlib.sha256(result).hexdigest() == e['before_sha256']
    return result.decode('utf8') if isinstance(source, str) else result

def _scope_cap__at_baseline(entries, file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    e = _scope_cap__entry(entries, file, _scope_edition=_scope_edition)
    if e is None:
        return source
    assert isinstance(source, (str, bytes))
    encoded = source.encode('utf8') if isinstance(source, str) else source
    return _scope_cap__reverse(entries, file, source, _scope_edition=_scope_edition) if hashlib.sha256(encoded).hexdigest() == e['after_sha256'] else source

def _scope_cap_source_before_scope_beta_20261014(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__reverse(_scope_data['files'], file, source_at_hiring_publication_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_source_at_scope_beta_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__at_baseline(_scope_data['files'], file, source_at_hiring_publication_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_before_scope_beta_channel_20261014(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__reverse(_scope_data.get('channelVariants', {}), file, public_source_at_hiring_publication_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_at_scope_beta_channel_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__at_baseline(_scope_data.get('channelVariants', {}), file, public_source_at_hiring_publication_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_before_scope_beta_20261014(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__reverse(_scope_data['publicFiles'], file, _scope_cap_public_source_at_scope_beta_channel_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_at_scope_beta_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__at_baseline(_scope_data['publicFiles'], file, _scope_cap_public_source_at_scope_beta_channel_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap__additions_exact(*, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    for (f, e) in _scope_data['additions'].items():
        p = ROOT / f
        if not _scope_io.is_file(p):
            return False
        b = source_at_hiring_publication_baseline(f, _scope_io.read_bytes(p), _scope_edition=_scope_edition)
        if len(b) != e['bytes'] or hashlib.sha256(b).hexdigest() != e['sha256']:
            return False
    return True

def _scope_cap__names_at_baseline(names, current, prior, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    rows = list(names)
    assert all((isinstance(f, str) for f in rows))
    if _scope_data['provisional'] is False and len(rows) == len(set(rows)) and (sorted(rows) == sorted(current)) and _scope_cap__additions_exact(_scope_edition=_scope_edition):
        return set(prior) if isinstance(names, set) else list(prior)
    return names

def _scope_cap_source_paths_at_scope_beta_baseline(names, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap__names_at_baseline(source_paths_at_hiring_publication_baseline(names, _scope_edition=_scope_edition), _scope_data['currentSourcePaths'], _scope_data['baselineSourcePaths'], _scope_edition=_scope_edition)

def _scope_cap_public_paths_at_scope_beta_baseline(names, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap__names_at_baseline(public_paths_at_hiring_publication_baseline(names, _scope_edition=_scope_edition), _scope_data['currentPublicPaths'], _scope_data['baselinePublicPaths'], _scope_edition=_scope_edition)
