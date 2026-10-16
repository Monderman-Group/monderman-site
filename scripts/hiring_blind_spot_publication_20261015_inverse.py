"""Exact article-only transition; unknown bytes and paths remain visible."""
import hashlib
import base64
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '76690a65c53794cb1e35f512221e51ddd0c6525b'
# UNBOUND DATA template: None is a mandatory future fixture pin, never an execution fallback.
FIXTURE_SHA256 = 'e5adce9a0cebe668a32899ce4a7bdbc694e5d4c674a24a32a328b284ae3a3cd3'
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

def _owner_reverse(entry, file, source):
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

def _owner_view(entries, file, source, strict=False):
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    if entry['encoding'] == 'base64':
        assert isinstance(source, bytes), file + ': finite binary input stays bytes'
    return _owner_reverse(entry, file, source) if strict or _sha(source) == entry['after_sha256'] else source

def source_at_owner_delta_baseline(file, source):
    return _owner_view(owner_delta['files'], file, source)

def source_before_owner_delta(file, source):
    return _owner_view(owner_delta['files'], file, source, True)

def public_source_at_owner_delta_baseline(file, source):
    for edition in owner_delta['publicEditions'].values():
        result = _owner_view(edition['files'], file, source)
        if result != source:
            return result
    return source

def public_source_before_owner_delta(file, source, channel):
    assert channel in owner_delta['publicEditions']
    return _owner_view(owner_delta['publicEditions'][channel]['files'], file, source, True)

def owner_source_exact():
    for row in owner_delta['nonGuardSourceRows']:
        path = ROOT / row['path']
        if not path.is_file() or path.is_symlink():
            return False
        raw = path.read_bytes()
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256'] or ('100755' if path.stat().st_mode & 0o111 else '100644') != row['mode'] or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != row['gitBlobSha1']:
            return False
    return True

def owner_public_exact(root, channel):
    if channel not in owner_delta['publicEditions']:
        return False
    for row in owner_delta['publicEditions'][channel]['currentMap']:
        path = root / row['path']
        if not path.is_file() or path.is_symlink():
            return False
        raw = path.read_bytes()
        if row['path'] == '.well-known/monderman-release.json':
            marker = json.loads(raw)
            if list(marker) != ['revision'] or not isinstance(marker['revision'], str) or len(marker['revision']) != 40 or any(ch not in '0123456789abcdef' for ch in marker['revision']):
                return False
        elif len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            return False
    return True

def _sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def _reverse(entry, source):
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

def _view(entries, file, source):
    entry = entries.get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    return _reverse(entry, source) if _sha(source) == entry['after_sha256'] else source

def source_at_hiring_publication_baseline(file, source):
    return _view(delta['files'], file, source_at_owner_delta_baseline(file, source))

def public_source_at_hiring_publication_baseline(file, source):
    source = public_source_at_owner_delta_baseline(file, source)
    for edition in delta['publicEditions'].values():
        result = _view(edition['files'], file, source)
        if result != source:
            return result
    return source

def _exact(root, entries):
    for file, entry in entries.items():
        path = root / file
        if not path.is_file() or path.is_symlink():
            return False
        value = path.read_bytes()
        if len(value) != entry['bytes'] or _sha(value) != entry['sha256']:
            return False
    return True

def _source_exact():
    return owner_source_exact() and _exact(ROOT, delta['additions']) and all(
        (ROOT / file).is_file() and not (ROOT / file).is_symlink()
        and _sha(source_at_owner_delta_baseline(file, (ROOT / file).read_bytes())) == entry['after_sha256']
        for file, entry in delta['files'].items()
    )

def _paths(names, current, prior, exact):
    rows = list(names)
    assert all(isinstance(name, str) for name in rows)
    if len(rows) == len(set(rows)) and sorted(rows) == current and exact:
        return set(prior) if isinstance(names, set) else list(prior)
    return names

def source_paths_at_hiring_publication_baseline(names):
    return _paths(names, delta['currentSourcePaths'], delta['baselineSourcePaths'], _source_exact())

def public_paths_at_hiring_publication_baseline(names, publish_root=None):
    root = Path(publish_root or os.environ.get('SCOPE_BETA_BUILD_ROOT') or os.environ.get('SITE_DESIGN_BUILD_ROOT') or ROOT / '.render-public')
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
