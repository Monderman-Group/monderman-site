"""The same exact publication inverse for the historical Python content guard."""
import hashlib
import json
from pathlib import Path
from outreach_image_notice_20261008_inverse import source_at_outreach_image_notice_baseline

FIXTURE_SHA256 = '6808405eeb2672179a23c30e7f2b85610e73b1378399a09bbfd7150b6763aa33'
_bytes = (Path(__file__).resolve().parent / 'fixtures/durable-organization-publication-20261007.json').read_bytes()
assert hashlib.sha256(_bytes).hexdigest() == FIXTURE_SHA256, 'Exact reviewed publication fixture'
_fixture = json.loads(_bytes)
assert _fixture['baseline'] == '74bcf2e86cf7829e2d4aaa5f83ade90b6b6ffaad'
assert _fixture['version'] == 'durable-organization-publication-20261007.1'

def source_at_durable_publication_baseline(file, source):
    source = source_at_outreach_image_notice_baseline(file, source)
    entry = _fixture['files'].get(file)
    encoded = source.encode('utf-8') if isinstance(source, str) else source
    if not entry or hashlib.sha256(encoded).hexdigest() != entry['after_sha256']:
        return source
    # Fixture offsets use JavaScript UTF-16 code units. Preserve those offsets
    # even if an approved publication contains a non-BMP character.
    restored = encoded.decode('utf-8').encode('utf-16-le')
    for start, end, current, prior in reversed(entry['replacements']):
        assert restored[start * 2:end * 2].decode('utf-16-le') == current, 'Exact finite publication hunk'
        restored = restored[:start * 2] + prior.encode('utf-16-le') + restored[end * 2:]
    result = restored.decode('utf-16-le').encode('utf-8')
    assert hashlib.sha256(result).hexdigest() == entry['before_sha256'], 'Complete historical source recovered'
    return result.decode('utf-8') if isinstance(source, str) else result
