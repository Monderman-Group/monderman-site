"""Exact finite focus inverse; shared JavaScript-code-unit offsets, no old imports."""
import hashlib
import json
from pathlib import Path
FIXTURE_SHA256 = '4fbcdeb2cfa4aea4b141515100c02be04d3796db89025d516f97cc6a30c75c49'
_bytes = (Path(__file__).resolve().parent / 'fixtures/homepage-invitation-focus-20261011.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact reviewed invitation-focus fixture'
_fixture = json.loads(_bytes)
assert _fixture['version'] == 'homepage-invitation-focus-20261011.1'
assert _fixture['baseline'] == '435fa2c87178de1bc3826f5f0ad1bba9b5f2cf54'

def source_before_homepage_invitation_focus_20261011(file, source):
    entry = _fixture['files'].get(file)
    if entry is None:
        return source
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], 'Only exact reviewed invitation-focus source may be inverted'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, 'Exact finite invitation-focus hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], 'Every reviewed PR baseline byte recovered'
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_homepage_invitation_focus_baseline(file, source):
    entry = _fixture['files'].get(file)
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_homepage_invitation_focus_20261011(file, source) if entry and hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source
