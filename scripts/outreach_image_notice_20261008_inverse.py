"""Exact same finite notice inverse; unknown edits remain visible to old guards."""
import hashlib
import json
from pathlib import Path
FIXTURE_SHA256 = '7045feb933960e4771fa53aea7a119f8d6d24e2a8267bd957e2d5922b77cee5b'
_bytes = (Path(__file__).resolve().parent / 'fixtures/outreach-image-notice-20261008.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact approved outreach notice fixture'
_fixture = json.loads(_bytes)
assert _fixture['version'] == 'outreach-image-notice-20261008.1'
assert _fixture['baseline'] == '08944880293e9c034470ead88035d48320f7b6fc'

def source_at_outreach_image_notice_baseline(file, source):
    entry = _fixture['files'].get(file)
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    if not entry or hashlib.sha256(encoded).hexdigest() != entry['after_sha256']:
        return source
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, 'Exact finite notice hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], 'Every original notice byte recovered'
    return result.decode('utf-8') if isinstance(source, str) else result
