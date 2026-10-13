"""Offline Python parity of the exact dated book-copy delta; all old pins remain."""
import hashlib
import json
from pathlib import Path
import subprocess
from marketing_refresh_20261012_inverse import source_at_marketing_refresh_baseline
from book_publication_date_20261011_inverse import (
    FIXTURE_SHA256, _fixture, source_before_book_publication_date_20261011,
    source_at_book_publication_date_baseline,
)
ROOT = Path(__file__).resolve().parents[1]

def read(file):
    return source_at_marketing_refresh_baseline(file, (ROOT / file).read_bytes())
BASELINE = 'c1574cb534f77f55fc74fd52bc66064ab9bdc464'
checks = negative_controls = hunks = 0

def check(value, label):
    global checks
    assert value, label
    checks += 1

def prior(file):
    return subprocess.check_output(['git', 'show', BASELINE + ':' + file], cwd=ROOT)

files = ['index.html', 'about.html', 'roi.html', 'research.html', 'public-search-index.json',
    'scripts/homepage_invitation_focus_20261011_inverse.mjs', 'scripts/homepage_invitation_focus_20261011_inverse.py',
    'scripts/homepage_invitation_focus_20261011_contract.mjs', 'scripts/homepage_invitation_focus_20261011_contract.py',
    'scripts/public_sample_manifest_sensitivity_smoke.mjs', '.github/workflows/frontend-release.yml',
    '.github/workflows/sample-report-marketing-certification.yml']
check(_fixture['baseline'] == BASELINE, 'Exact deployed homepage/focus baseline')
check(_fixture['version'] == 'book-publication-date-20261011.1', 'Independent dated-copy version')
check(list(_fixture['files']) == files, 'Exact finite public/adapter/workflow file whitelist')
for file in files:
    entry = _fixture['files'][file]
    current, before = read(file), prior(file)
    check(hashlib.sha256(current).hexdigest() == entry['after_sha256'], file + ': full current pin')
    check(hashlib.sha256(before).hexdigest() == entry['before_sha256'], file + ': deployed source pin')
    for source in (current, current.decode('utf-8')):
        expected = before if isinstance(source, bytes) else before.decode('utf-8')
        check(source_before_book_publication_date_20261011(file, source) == expected, file + ': complete strict inverse/type')
        check(source_at_book_publication_date_baseline(file, source) == expected, file + ': exact conditional inverse')
        check(source_at_book_publication_date_baseline(file, expected) == expected, file + ': original source unchanged')
    mutants = [current + b'\n', b'UNREVIEWED' + current, b'!' + current[1:], before]
    utf16 = current.decode('utf-8').encode('utf-16-le')
    for start, end, now, _ in entry['replacements']:
        check(utf16[start * 2:end * 2].decode('utf-16-le') == now, file + ': shared UTF-16 finite hunk')
        mutants.append((utf16[:start * 2] + 'UNREVIEWED'.encode('utf-16-le') + utf16[end * 2:]).decode('utf-16-le').encode('utf-8'))
        hunks += 1
    for mutant in mutants:
        try:
            source_before_book_publication_date_20261011(file, mutant)
        except AssertionError:
            negative_controls += 1
            check(True, file + ': unknown source/double inverse rejected')
        else:
            raise AssertionError(file + ': unknown source accepted')
        check(source_at_book_publication_date_baseline(file, mutant) == mutant, file + ': unknown bytes not hidden')
public_replacements = {
    'index.html': [('Forthcoming October 12, 2026', 'Publication date: 21 October 2026')],
    'about.html': [('forthcoming October 12, 2026', 'publication date: 21 October 2026')],
    'roi.html': [('forthcoming October 12, 2026', 'publication date: 21 October 2026')],
    'research.html': [('Forthcoming October 12, 2026', 'Publication date: 21 October 2026'),
        ('<strong>October 12, 2026</strong><span>Forthcoming</span>', '<strong>21 October 2026</strong><span>Publication date</span>')],
}
for file, replacements in public_replacements.items():
    expected = prior(file).decode('utf-8')
    for old, new in replacements:
        check(expected.count(old) == 1, file + ': unique dated book copy')
        expected = expected.replace(old, new)
    check(read(file).decode('utf-8') == expected, file + ': only named date/status replacements')
index = json.loads(read('public-search-index.json'))
expected_index = json.loads(prior('public-search-index.json'))
for row in expected_index:
    if row['url'] in public_replacements:
        row['text'] = row['text'].replace('Forthcoming October 12, 2026', 'Publication date: 21 October 2026').replace('forthcoming October 12, 2026', 'publication date: 21 October 2026').replace('October 12, 2026 Forthcoming', '21 October 2026 Publication date')
check(index == expected_index, 'Only exact indexed date/status text changes')
original_index = json.loads(prior('public-search-index.json'))
changed_urls = sorted(row['url'] for row, old in zip(index, original_index) if row != old)
check(changed_urls == ['about.html', 'index.html', 'research.html'], 'Exactly three search records change')
check(sum(row['text'].count('October 12, 2026') for row in original_index if row['url'] in changed_urls) == 4, 'Four old date occurrences across three search records')
check(next(row for row in index if row['url'] == 'roi.html') == next(row for row in original_index if row['url'] == 'roi.html'), 'ROI indexed excerpt stays unchanged')
tracked = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASELINE], cwd=ROOT, text=True).strip().splitlines()
immutable_files = historical_fixtures = pdfs = 0
for file in tracked:
    if file in files:
        continue
    check(read(file) == prior(file), file + ': all other baseline source/artifact bytes unchanged')
    immutable_files += 1
    historical_fixtures += int(file.startswith('scripts/fixtures/'))
    pdfs += int(file.endswith('.pdf'))
for file, pin in [('scripts/fixtures/homepage-invitation-focus-20261011.json', '4fbcdeb2cfa4aea4b141515100c02be04d3796db89025d516f97cc6a30c75c49'), ('scripts/fixtures/homepage-sample-entry-20261011.json', '08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253')]:
    check(hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == pin, 'Prior completed hero fixture pin immutable')
for file in ['unknown.js', '__proto__', 'workspace.html', 'pattern-trial.html', 'legal-document-manifest.json']:
    source = b'Outside the approved dated book-copy delta'
    check(source_before_book_publication_date_20261011(file, source) == source, file + ': unlisted strict source unchanged')
    check(source_at_book_publication_date_baseline(file, source) == source, file + ': unlisted conditional source unchanged')
print(json.dumps({'ok': True, 'checks': checks, 'negativeControls': negative_controls, 'files': len(files), 'hunks': hunks, 'immutableFiles': immutable_files, 'historicalFixtures': historical_fixtures, 'pdfs': pdfs, 'fixtureSha256': FIXTURE_SHA256, 'networkCalls': 0, 'productionWrites': 0}))
