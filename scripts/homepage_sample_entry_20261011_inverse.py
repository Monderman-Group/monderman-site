"""Exact same finite homepage entry inverse; unknown edits stay visible."""
import hashlib
import json
from pathlib import Path
FIXTURE_SHA256 = '08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253'
_bytes = (Path(__file__).resolve().parent / 'fixtures/homepage-sample-entry-20261011.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact approved homepage sample-entry fixture'
_fixture = json.loads(_bytes)
assert _fixture['version'] == 'homepage-sample-entry-20261011.1'
assert _fixture['baseline'] == '1a11487ad9424b5011ec89d6da4aaac2e7d04c7a'

def source_before_homepage_sample_entry_20261011(file, source):
    entry = _fixture['files'].get(file)
    if entry is None:
        return source
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], 'Only exact approved homepage entry bytes may be inverted'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, 'Exact finite homepage entry hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], 'Every original homepage entry byte recovered'
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_homepage_sample_entry_baseline(file, source):
    entry = _fixture['files'].get(file)
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_homepage_sample_entry_20261011(file, source) if entry and hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source
