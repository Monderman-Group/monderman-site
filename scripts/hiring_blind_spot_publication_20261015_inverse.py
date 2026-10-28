from hiring_work_design_series_20261017_inverse import source_at_series_baseline,public_source_at_series_baseline,source_paths_at_series_baseline,public_paths_at_series_baseline
"""Exact article-only transition; unknown bytes and paths remain visible."""
import hashlib
import base64
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '76690a65c53794cb1e35f512221e51ddd0c6525b'
# UNBOUND DATA template: None is a mandatory future fixture pin, never an execution fallback.
FIXTURE_SHA256 = '52abd075da1ae7474d41fb23f0635d1cbe7ca35c382a15490ffe5cac257919b6'
assert isinstance(FIXTURE_SHA256, str) and len(FIXTURE_SHA256) == 64, 'Final combined fixture pin is required'
_raw = (ROOT / 'scripts/fixtures/hiring-blind-spot-publication-20261015.json').read_bytes()
assert hashlib.sha256(_raw).hexdigest() == FIXTURE_SHA256
_combined = json.loads(_raw)
assert _combined['schema'] == 'native267-publication-plus-owner-sodi-v1'
_stored = _combined['publicationSublayer']
assert _stored['bytes'] == 435801 and _stored['sha256'] == '7554155126cae721883f5a2f784116d03687dbb7922ea5bd278d6c10c1f84b59'
_native_raw = base64.b64decode(_stored['originalFixtureBase64'], validate=True)
assert base64.b64encode(_native_raw).decode() == _stored['originalFixtureBase64']
assert len(_native_raw) == _stored['bytes'] and hashlib.sha256(_native_raw).hexdigest() == _stored['sha256']
delta = json.loads(_native_raw)
assert delta == _stored['parsedNativeDelta']
assert delta['baseline'] == BASELINE and delta['version'] == 'hiring-blind-spot-publication-20261015.2'
owner_delta = _combined['ownerDelta']
OWNER_BASELINE = '8431a47bbc8d253a9ef6ef20de8227458f48d3b0'
assert owner_delta['baseline'] == OWNER_BASELINE and owner_delta['baselineTree'] == '6890268b552f95094a595f29a6a8200ae1f62198' and owner_delta['provisional'] is False
assert owner_delta['files'] and len(owner_delta['nonGuardSourceRows']) == 807
assert owner_delta['guardRoots'] == delta['guardFiles']
assert owner_delta['baselineSourcePaths'] == owner_delta['currentSourcePaths'] == delta['currentSourcePaths']
assert sorted(row['path'] for row in owner_delta['nonGuardSourceRows']) == [file for file in delta['currentSourcePaths'] if file not in owner_delta['guardRoots']], 'Exact unique807 non-bootstrap rows'
assert all(file in delta['currentSourcePaths'] and file not in owner_delta['guardRoots'] for file in owner_delta['files']), 'Only closed existing non-bootstrap owner entries'
assert sorted(owner_delta['publicEditions']) == sorted(delta['publicEditions']), 'Exactly the original two official public channels'
for _edition in owner_delta['publicEditions'].values():
    assert sorted(row['path'] for row in _edition['currentMap']) == delta['currentPublicPaths'], 'Exact unique331 public map rows'
    assert all(file in delta['currentPublicPaths'] and file != '.well-known/monderman-release.json' for file in _edition['files']), 'Only closed non-marker owner public entries'

def _owner_reverse(entry, file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__owner_reverse(entry,file,source,_scope_edition=_scope_edition)
    assert isinstance(source, (str, bytes))
    if entry['encoding'] == 'base64':
        assert isinstance(source, bytes), file + ': finite binary input stays bytes'
    raw = source.encode() if isinstance(source, str) else source
    assert len(raw) == entry['after_bytes'] and hashlib.sha256(raw).hexdigest() == entry['after_sha256']
    if entry['encoding'] == 'base64':
        before = base64.b64decode(entry['before_base64'], validate=True)
        assert base64.b64encode(before).decode() == entry['before_base64']
        assert len(before) == entry['before_bytes'] and hashlib.sha256(before).hexdigest() == entry['before_sha256']
        return before
    assert entry['encoding'] == 'utf8'
    value = raw.decode('utf8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert value[start * 2:end * 2] == current.encode('utf-16-le'), file + ': owner literal inverse mismatch'
        value = value[:start * 2] + prior.encode('utf-16-le') + value[end * 2:]
    before = value.decode('utf-16-le').encode('utf8')
    assert len(before) == entry['before_bytes'] and hashlib.sha256(before).hexdigest() == entry['before_sha256']
    return before.decode() if isinstance(source, str) else before

def _owner_view(entries, file, source, strict=False,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__owner_view(entries,file,source,strict,_scope_edition=_scope_edition)
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    if entry['encoding'] == 'base64':
        assert isinstance(source, bytes), file + ': finite binary input stays bytes'
    return _owner_reverse(entry, file, source) if strict or _sha(source) == entry['after_sha256'] else source

def source_at_owner_delta_baseline(file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_source_at_owner_delta_baseline(file,source,_scope_edition=_scope_edition)
    return _owner_view(owner_delta['files'], file, source_at_series_baseline(file,source))

def source_before_owner_delta(file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_source_before_owner_delta(file,source,_scope_edition=_scope_edition)
    return _owner_view(owner_delta['files'], file, source_at_series_baseline(file,source), True)

def public_source_at_owner_delta_baseline(file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_public_source_at_owner_delta_baseline(file,source,_scope_edition=_scope_edition)
    source=public_source_at_series_baseline(file,source)
    for edition in owner_delta['publicEditions'].values():
        result = _owner_view(edition['files'], file, source)
        if result != source:
            return result
    return source

def public_source_before_owner_delta(file, source, channel,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_public_source_before_owner_delta(file,source,channel,_scope_edition=_scope_edition)
    assert channel in owner_delta['publicEditions']
    return _owner_view(owner_delta['publicEditions'][channel]['files'], file, public_source_at_series_baseline(file,source), True)

def owner_source_exact(*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_owner_source_exact(_scope_edition=_scope_edition)
    for row in owner_delta['nonGuardSourceRows']:
        path = ROOT / row['path']
        if not path.is_file() or path.is_symlink():
            return False
        raw = source_at_series_baseline(row['path'],path.read_bytes())
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256'] or ('100755' if path.stat().st_mode & 0o111 else '100644') != row['mode'] or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != row['gitBlobSha1']:
            return False
    return True

def owner_public_exact(root, channel,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_owner_public_exact(root,channel,_scope_edition=_scope_edition)
    if channel not in owner_delta['publicEditions']:
        return False
    for row in owner_delta['publicEditions'][channel]['currentMap']:
        path = root / row['path']
        if not path.is_file() or path.is_symlink():
            return False
        raw = public_source_at_series_baseline(row['path'],path.read_bytes())
        if row['path'] == '.well-known/monderman-release.json':
            marker = json.loads(raw)
            if list(marker) != ['revision'] or not isinstance(marker['revision'], str) or len(marker['revision']) != 40 or any(ch not in '0123456789abcdef' for ch in marker['revision']):
                return False
        elif len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            return False
    return True

def _sha(value,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__sha(value,_scope_edition=_scope_edition)
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def _reverse(entry, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__reverse(entry,source,_scope_edition=_scope_edition)
    assert isinstance(source, (str, bytes))
    assert _sha(source) == entry['after_sha256'], 'Only complete approved publication bytes may project'
    value = source.encode() if isinstance(source, str) else source
    value = value.decode().encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert value[start * 2:end * 2].decode('utf-16-le') == current
        value = value[:start * 2] + prior.encode('utf-16-le') + value[end * 2:]
    result = value.decode('utf-16-le').encode()
    assert _sha(result) == entry['before_sha256']
    return result.decode() if isinstance(source, str) else result

def _view(entries, file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__view(entries,file,source,_scope_edition=_scope_edition)
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    return _reverse(entry, source) if _sha(source) == entry['after_sha256'] else source

def source_at_hiring_publication_baseline(file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_source_at_hiring_publication_baseline(file,source,_scope_edition=_scope_edition)
    return _view(delta['files'], file, source_at_owner_delta_baseline(file, source))

def public_source_at_hiring_publication_baseline(file, source,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_public_source_at_hiring_publication_baseline(file,source,_scope_edition=_scope_edition)
    source = public_source_at_owner_delta_baseline(file, source)
    for edition in delta['publicEditions'].values():
        result = _view(edition['files'], file, source)
        if result != source:
            return result
    return source

def _exact(root, entries,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__exact(root,entries,_scope_edition=_scope_edition)
    for file, entry in entries.items():
        path = root / file
        if not path.is_file() or path.is_symlink():
            return False
        value = public_source_at_series_baseline(file,source_at_series_baseline(file,path.read_bytes()))
        if len(value) != entry['bytes'] or _sha(value) != entry['sha256']:
            return False
    return True

def _source_exact(*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__source_exact(_scope_edition=_scope_edition)
    return owner_source_exact() and _exact(ROOT, delta['additions']) and all(
        (ROOT / file).is_file() and not (ROOT / file).is_symlink()
        and _sha(source_at_owner_delta_baseline(file, (ROOT / file).read_bytes())) == entry['after_sha256']
        for file, entry in delta['files'].items()
    )

def _paths(names, current, prior, exact,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap__paths(names,current,prior,exact,_scope_edition=_scope_edition)
    rows = list(names)
    assert all(isinstance(name, str) for name in rows)
    if len(rows) == len(set(rows)) and sorted(rows) == current and exact:
        return set(prior) if isinstance(names, set) else list(prior)
    return names

def source_paths_at_hiring_publication_baseline(names,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_source_paths_at_hiring_publication_baseline(names,_scope_edition=_scope_edition)
    return _paths(source_paths_at_series_baseline(names), delta['currentSourcePaths'], delta['baselineSourcePaths'], _source_exact())

def public_paths_at_hiring_publication_baseline(names, publish_root=None,*,_scope_edition=None):
    if _scope_edition is not None: return _scope_cap_public_paths_at_hiring_publication_baseline(names,publish_root,_scope_edition=_scope_edition)
    root = Path(publish_root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT / '.render-public')
    names=public_paths_at_series_baseline(names,root)
    marker = root / '.well-known/monderman-questionnaire-release.json'
    if not marker.is_file():
        return names
    edition = delta['publicEditions'].get(json.loads(marker.read_bytes()).get('channel'))
    if edition is None:
        return names
    exact = owner_public_exact(root, json.loads(marker.read_bytes()).get('channel')) and _exact(root, edition['additions']) and all(
        (root / file).is_file() and not (root / file).is_symlink()
        and _sha(public_source_at_owner_delta_baseline(file, (root / file).read_bytes())) == entry['after_sha256']
        for file, entry in edition['files'].items()
    )
    return _paths(names, delta['currentPublicPaths'], delta['baselinePublicPaths'], exact)

from article_audio_20261026_inverse import validate_scope_edition,scope_fixture_data,scope_hiring_fixture_data,scope_contract_logical_io

def _scope_private_data(edition):
 validate_scope_edition(edition,source_root=ROOT)
 return scope_hiring_fixture_data(edition,'scripts/fixtures/hiring-blind-spot-publication-20261015.json',FIXTURE_SHA256)

# Explicit captured branches: ordinary None bodies above remain literal.
def _scope_cap__owner_reverse(entry, file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    assert isinstance(source, (str, bytes))
    if entry['encoding'] == 'base64':
        assert isinstance(source, bytes), file + ': finite binary input stays bytes'
    raw = source.encode() if isinstance(source, str) else source
    assert len(raw) == entry['after_bytes'] and hashlib.sha256(raw).hexdigest() == entry['after_sha256']
    if entry['encoding'] == 'base64':
        before = base64.b64decode(entry['before_base64'], validate=True)
        assert base64.b64encode(before).decode() == entry['before_base64']
        assert len(before) == entry['before_bytes'] and hashlib.sha256(before).hexdigest() == entry['before_sha256']
        return before
    assert entry['encoding'] == 'utf8'
    value = raw.decode('utf8').encode('utf-16-le')
    for (start, end, current, prior) in reversed(entry['replacements']):
        assert value[start * 2:end * 2] == current.encode('utf-16-le'), file + ': owner literal inverse mismatch'
        value = value[:start * 2] + prior.encode('utf-16-le') + value[end * 2:]
    before = value.decode('utf-16-le').encode('utf8')
    assert len(before) == entry['before_bytes'] and hashlib.sha256(before).hexdigest() == entry['before_sha256']
    return before.decode() if isinstance(source, str) else before

def _scope_cap__owner_view(entries, file, source, strict=False, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    if entry['encoding'] == 'base64':
        assert isinstance(source, bytes), file + ': finite binary input stays bytes'
    return _scope_cap__owner_reverse(entry, file, source, _scope_edition=_scope_edition) if strict or _scope_cap__sha(source, _scope_edition=_scope_edition) == entry['after_sha256'] else source

def _scope_cap_source_at_owner_delta_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__owner_view(_scope_data['owner']['files'], file, source_at_series_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_source_before_owner_delta(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__owner_view(_scope_data['owner']['files'], file, source_at_series_baseline(file, source, _scope_edition=_scope_edition), True, _scope_edition=_scope_edition)

def _scope_cap_public_source_at_owner_delta_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    source = public_source_at_series_baseline(file, source, _scope_edition=_scope_edition)
    for edition in _scope_data['owner']['publicEditions'].values():
        result = _scope_cap__owner_view(edition['files'], file, source, _scope_edition=_scope_edition)
        if result != source:
            return result
    return source

def _scope_cap_public_source_before_owner_delta(file, source, channel, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    validate_scope_edition(_scope_edition, channel=channel)
    assert channel in _scope_data['owner']['publicEditions']
    return _scope_cap__owner_view(_scope_data['owner']['publicEditions'][channel]['files'], file, public_source_at_series_baseline(file, source, _scope_edition=_scope_edition), True, _scope_edition=_scope_edition)

def _scope_cap_owner_source_exact(*, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    for row in _scope_data['owner']['nonGuardSourceRows']:
        path = ROOT / row['path']
        if not _scope_io.is_file(path) or _scope_io.is_symlink(path):
            return False
        raw = source_at_series_baseline(row['path'], _scope_io.read_bytes(path), _scope_edition=_scope_edition)
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256'] or ('100755' if _scope_io.stat(path).st_mode & 73 else '100644') != row['mode'] or (hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\x00' + raw).hexdigest() != row['gitBlobSha1']):
            return False
    return True

def _scope_cap_owner_public_exact(root, channel, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    if root is not None:
        validate_scope_edition(_scope_edition, public_root=root)
    validate_scope_edition(_scope_edition, channel=channel)
    if channel not in _scope_data['owner']['publicEditions']:
        return False
    for row in _scope_data['owner']['publicEditions'][channel]['currentMap']:
        path = root / row['path']
        if not _scope_io.is_file(path) or _scope_io.is_symlink(path):
            return False
        raw = public_source_at_series_baseline(row['path'], _scope_io.read_bytes(path), _scope_edition=_scope_edition)
        if row['path'] == '.well-known/monderman-release.json':
            marker = json.loads(raw)
            if list(marker) != ['revision'] or not isinstance(marker['revision'], str) or len(marker['revision']) != 40 or any((ch not in '0123456789abcdef' for ch in marker['revision'])):
                return False
        elif len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            return False
    return True

def _scope_cap__sha(value, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(value) in (str, bytes), 'Native captured value'
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def _scope_cap__reverse(entry, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(source) in (str, bytes), 'Native captured value'
    assert isinstance(source, (str, bytes))
    assert _scope_cap__sha(source, _scope_edition=_scope_edition) == entry['after_sha256'], 'Only complete approved publication bytes may project'
    value = source.encode() if isinstance(source, str) else source
    value = value.decode().encode('utf-16-le')
    for (start, end, current, prior) in reversed(entry['replacements']):
        assert value[start * 2:end * 2].decode('utf-16-le') == current
        value = value[:start * 2] + prior.encode('utf-16-le') + value[end * 2:]
    result = value.decode('utf-16-le').encode()
    assert _scope_cap__sha(result, _scope_edition=_scope_edition) == entry['before_sha256']
    return result.decode() if isinstance(source, str) else result

def _scope_cap__view(entries, file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    return _scope_cap__reverse(entry, source, _scope_edition=_scope_edition) if _scope_cap__sha(source, _scope_edition=_scope_edition) == entry['after_sha256'] else source

def _scope_cap_source_at_hiring_publication_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    return _scope_cap__view(_scope_data['publication']['files'], file, _scope_cap_source_at_owner_delta_baseline(file, source, _scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_source_at_hiring_publication_baseline(file, source, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    assert type(file) is str, 'Native captured file key'
    assert type(source) in (str, bytes), 'Native captured value'
    source = _scope_cap_public_source_at_owner_delta_baseline(file, source, _scope_edition=_scope_edition)
    for edition in _scope_data['publication']['publicEditions'].values():
        result = _scope_cap__view(edition['files'], file, source, _scope_edition=_scope_edition)
        if result != source:
            return result
    return source

def _scope_cap__exact(root, entries, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    _scope_io.is_source_root(root)
    for (file, entry) in entries.items():
        path = root / file
        if not _scope_io.is_file(path) or _scope_io.is_symlink(path):
            return False
        value = public_source_at_series_baseline(file, source_at_series_baseline(file, _scope_io.read_bytes(path), _scope_edition=_scope_edition), _scope_edition=_scope_edition)
        if len(value) != entry['bytes'] or _scope_cap__sha(value, _scope_edition=_scope_edition) != entry['sha256']:
            return False
    return True

def _scope_cap__source_exact(*, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap_owner_source_exact(_scope_edition=_scope_edition) and _scope_cap__exact(ROOT, _scope_data['publication']['additions'], _scope_edition=_scope_edition) and all((_scope_io.is_file(ROOT / file) and (not _scope_io.is_symlink(ROOT / file)) and (_scope_cap__sha(_scope_cap_source_at_owner_delta_baseline(file, _scope_io.read_bytes(ROOT / file), _scope_edition=_scope_edition), _scope_edition=_scope_edition) == entry['after_sha256']) for (file, entry) in _scope_data['publication']['files'].items()))

def _scope_cap__paths(names, current, prior, exact, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    rows = list(names)
    assert all((isinstance(name, str) for name in rows))
    if len(rows) == len(set(rows)) and sorted(rows) == current and exact:
        return set(prior) if isinstance(names, set) else list(prior)
    return names

def _scope_cap_source_paths_at_hiring_publication_baseline(names, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    return _scope_cap__paths(source_paths_at_series_baseline(names, _scope_edition=_scope_edition), _scope_data['publication']['currentSourcePaths'], _scope_data['publication']['baselineSourcePaths'], _scope_cap__source_exact(_scope_edition=_scope_edition), _scope_edition=_scope_edition)

def _scope_cap_public_paths_at_hiring_publication_baseline(names, publish_root=None, *, _scope_edition):
    validate_scope_edition(_scope_edition, source_root=ROOT)
    _scope_io = scope_contract_logical_io(_scope_edition, source_root=ROOT)
    _scope_data = _scope_private_data(_scope_edition)
    root = Path(publish_root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT / '.render-public')
    names = public_paths_at_series_baseline(names, root, _scope_edition=_scope_edition)
    marker = root / '.well-known/monderman-questionnaire-release.json'
    if not _scope_io.is_file(marker):
        return names
    edition = _scope_data['publication']['publicEditions'].get(json.loads(_scope_io.read_bytes(marker)).get('channel'))
    if edition is None:
        return names
    exact = _scope_cap_owner_public_exact(root, json.loads(_scope_io.read_bytes(marker)).get('channel'), _scope_edition=_scope_edition) and _scope_cap__exact(root, edition['additions'], _scope_edition=_scope_edition) and all((_scope_io.is_file(root / file) and (not _scope_io.is_symlink(root / file)) and (_scope_cap__sha(_scope_cap_public_source_at_owner_delta_baseline(file, _scope_io.read_bytes(root / file), _scope_edition=_scope_edition), _scope_edition=_scope_edition) == entry['after_sha256']) for (file, entry) in edition['files'].items()))
    return _scope_cap__paths(names, _scope_data['publication']['currentPublicPaths'], _scope_data['publication']['baselinePublicPaths'], exact, _scope_edition=_scope_edition)
