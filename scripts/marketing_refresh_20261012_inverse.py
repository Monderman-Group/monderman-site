"""Independent exact marketing delta. New files are never normalized to empty."""
import hashlib
import json
from pathlib import Path
from marketing_completion_20261013_inverse import source_at_marketing_completion_baseline
BASELINE = '14e57bb9f5537cd7ed5eb581cbc7740541c593b1'
VERSION = 'marketing-refresh-20261012.1'
FIXTURE_SHA256 = 'fd9eebf062c33eeac2e692c5f173dfbc7cfb2752e300749d61b2d789904aff8e'
_bytes = (Path(__file__).resolve().parent / 'fixtures/marketing-refresh-20261012.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact independently reviewed marketing refresh fixture'
_fixture = json.loads(_bytes)
assert _fixture['baseline'] == BASELINE
assert _fixture['version'] == VERSION
assert _fixture['baselineTree'] == '42d78704e37603bf19f5a1c5ddc0d7897e7119d8'

def source_before_marketing_refresh_20261012(file, source):
    source = source_at_marketing_completion_baseline(file, source)
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes)), file + ': source must remain text or bytes'
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], file + ': only complete reviewed source may be inverted'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, file + ': exact finite UTF-16 marketing hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], file + ': every approved baseline byte recovered'
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_marketing_refresh_baseline(file, source):
    source = source_at_marketing_completion_baseline(file, source)
    entry = _fixture['files'].get(file) if isinstance(file, str) else None
    if entry is None:
        return source
    assert isinstance(source, (str, bytes)), file + ': source must remain text or bytes'
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_marketing_refresh_20261012(file, source) if hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source
