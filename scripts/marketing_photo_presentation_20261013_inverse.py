"""Exact five-photo inverse: no historical imports, broad edits or erased new assets."""
import hashlib
import json
from pathlib import Path
BASELINE = '5ce8817eed8af622b4c0c8eeeb48b4440e728186'
VERSION = 'marketing-photo-presentation-20261013.1'
FIXTURE_SHA256 = 'a9c2e32a7c3ce761bf885118062e01fd386e689dbd5a85253a45ec329efafca3'
_bytes = (Path(__file__).resolve().parent / 'fixtures/marketing-photo-presentation-20261013.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256
_fixture = json.loads(_bytes)
assert _fixture['baseline'] == BASELINE
assert _fixture['baselineTree'] == '4245b8bc1ff3fdcaae738620fc5f7e84224c6f12'
assert _fixture['version'] == VERSION
FILES = tuple(_fixture['files'])
ADDITIONS = tuple(_fixture['additions'])
GUARD_FILES = tuple(_fixture['guardFiles'])
def source_before_marketing_photo_presentation_20261013(file, source):
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], file + ': only exact current bytes'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256']
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_marketing_photo_presentation_baseline(file, source):
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes))
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_marketing_photo_presentation_20261013(file, source) if hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source

def photo_names_at_marketing_photo_presentation_baseline(names):
    names = list(names)
    assert all(isinstance(n, str) for n in names)
    return list(_fixture['priorPhotoNames']) if sorted(names) == sorted(_fixture['currentPhotoNames']) else names
