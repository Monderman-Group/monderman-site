"""Additive finite completion inverse. No historical imports or erased new assets."""
import hashlib
import json
from pathlib import Path
BASELINE = '561439e7c5aef48db0331bbb993f0a6d9ec4ada1'
VERSION = 'marketing-completion-20261013.3'
FIXTURE_SHA256 = '6a12629e03e501742ffb3c80e84dc13d8b722e6922691c6305d42aa54635bdea'
_bytes = (Path(__file__).resolve().parent / 'fixtures/marketing-completion-20261013.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact independently reviewed completion fixture'
_fixture = json.loads(_bytes)
assert _fixture['baseline'] == BASELINE
assert _fixture['version'] == VERSION
assert _fixture['baselineTree'] == '6e000b0f2c357902e402217e6d6d94e8c79d6762'
FILES = tuple(_fixture['files'])
ADDITIONS = tuple(_fixture['additions'])
GUARD_FILES = tuple(_fixture['guardFiles'])

def source_before_marketing_completion_20261013(file, source):
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes)), file + ': source remains UTF-8 text or bytes'
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], file + ': only exact complete reviewed completion bytes'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, file + ': exact finite UTF-16 completion hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], file + ': every deployed5614 baseline byte restored'
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_marketing_completion_baseline(file, source):
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes)), file + ': source remains UTF-8 text or bytes'
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_marketing_completion_20261013(file, source) if hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source
