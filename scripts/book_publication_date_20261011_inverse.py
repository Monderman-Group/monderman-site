"""Exact finite dated book-copy inverse; no old module imports or broad replacements."""
import hashlib
import json
from pathlib import Path
FIXTURE_SHA256 = '91affe3977eb904868174828aab1b328292cf10f6ada61e563f4a5882f7a7a64'
_bytes = (Path(__file__).resolve().parent / 'fixtures/book-publication-date-20261011.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact approved book publication-date fixture'
_fixture = json.loads(_bytes)
assert _fixture['version'] == 'book-publication-date-20261011.1'
assert _fixture['baseline'] == 'c1574cb534f77f55fc74fd52bc66064ab9bdc464'

def source_before_book_publication_date_20261011(file, source):
    entry = _fixture['files'].get(file)
    if entry is None:
        return source
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    assert hashlib.sha256(encoded).hexdigest() == entry['after_sha256'], 'Only exact approved book-date source may be inverted'
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, 'Exact finite publication-date hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], 'Every original deployed source byte recovered'
    return result.decode('utf-8') if isinstance(source, str) else result

def source_at_book_publication_date_baseline(file, source):
    entry = _fixture['files'].get(file)
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    return source_before_book_publication_date_20261011(file, source) if entry and hashlib.sha256(encoded).hexdigest() == entry['after_sha256'] else source
