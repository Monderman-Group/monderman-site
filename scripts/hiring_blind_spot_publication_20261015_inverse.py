"""Exact article-only transition; unknown bytes and paths remain visible."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '76690a65c53794cb1e35f512221e51ddd0c6525b'
FIXTURE_SHA256 = '7554155126cae721883f5a2f784116d03687dbb7922ea5bd278d6c10c1f84b59'
_raw = (ROOT / 'scripts/fixtures/hiring-blind-spot-publication-20261015.json').read_bytes()
assert hashlib.sha256(_raw).hexdigest() == FIXTURE_SHA256
delta = json.loads(_raw)
assert delta['baseline'] == BASELINE and delta['version'] == 'hiring-blind-spot-publication-20261015.2'

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
    return _view(delta['files'], file, source)

def public_source_at_hiring_publication_baseline(file, source):
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
    return _exact(ROOT, delta['additions']) and all(
        (ROOT / file).is_file() and not (ROOT / file).is_symlink()
        and _sha((ROOT / file).read_bytes()) == entry['after_sha256']
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
    exact = _exact(root, edition['additions']) and all(
        (root / file).is_file() and not (root / file).is_symlink()
        and _sha((root / file).read_bytes()) == entry['after_sha256']
        for file, entry in edition['files'].items()
    )
    return _paths(names, delta['currentPublicPaths'], delta['baselinePublicPaths'], exact)
