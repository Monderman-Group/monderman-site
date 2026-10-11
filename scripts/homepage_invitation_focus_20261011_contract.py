"""Offline Python parity of the finite focus repair and immutable reviewed PR hero."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
from homepage_invitation_focus_20261011_inverse import (
    FIXTURE_SHA256, _fixture,
    source_before_homepage_invitation_focus_20261011,
    source_at_homepage_invitation_focus_baseline,
)

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '435fa2c87178de1bc3826f5f0ad1bba9b5f2cf54'
checks = 0
negative_controls = 0
hunks = 0

def check(condition, label):
    global checks
    assert condition, label
    checks += 1

def prior(file):
    return subprocess.check_output(['git', 'show', BASELINE + ':' + file], cwd=ROOT)

files = ['index.html', 'scripts/homepage_sample_entry_20261011_contract.mjs',
         'scripts/homepage_sample_entry_20261011_inverse.mjs', 'scripts/homepage_sample_entry_20261011_inverse.py']
check(_fixture['baseline'] == BASELINE, 'Exact reviewed PR hero baseline')
check(_fixture['version'] == 'homepage-invitation-focus-20261011.1', 'Separate finite focus version')
check(list(_fixture['files']) == files, 'Only inline repair and three historical adapters')
for file in files:
    entry = _fixture['files'][file]
    current, before = (ROOT / file).read_bytes(), prior(file)
    check(hashlib.sha256(current).hexdigest() == entry['after_sha256'], file + ': current pin')
    check(hashlib.sha256(before).hexdigest() == entry['before_sha256'], file + ': baseline pin')
    for source in (current, current.decode('utf-8')):
        expected = before if isinstance(source, bytes) else before.decode('utf-8')
        check(source_before_homepage_invitation_focus_20261011(file, source) == expected, file + ': strict inverse and type')
        check(source_at_homepage_invitation_focus_baseline(file, source) == expected, file + ': conditional inverse')
        check(source_at_homepage_invitation_focus_baseline(file, expected) == expected, file + ': reviewed PR baseline unchanged')
    mutants = [current + b'\n', b'UNREVIEWED' + current, b'!' + current[1:], before]
    utf16 = current.decode('utf-8').encode('utf-16-le')
    for start, end, now, _ in entry['replacements']:
        check(utf16[start * 2:end * 2].decode('utf-16-le') == now, file + ': exact shared UTF-16 hunk')
        mutants.append((utf16[:start * 2] + 'UNREVIEWED'.encode('utf-16-le') + utf16[end * 2:]).decode('utf-16-le').encode('utf-8'))
        hunks += 1
    for mutant in mutants:
        try:
            source_before_homepage_invitation_focus_20261011(file, mutant)
        except AssertionError:
            negative_controls += 1
            check(True, file + ': unknown source rejected')
        else:
            raise AssertionError(file + ': unknown source or double inversion accepted')
        check(source_at_homepage_invitation_focus_baseline(file, mutant) == mutant, file + ': unfamiliar source stays visible')

html = (ROOT / 'index.html').read_bytes().decode('utf-8')
declaration = ' transition-property:color,border-color;'
check(html.count(declaration) == 1, 'Exactly one limited transition-property declaration')
check(html.replace(declaration, '').encode('utf-8') == prior('index.html'), 'Every other homepage byte unchanged')
check(re.search(r'body\.homepage-enterprise \.hero-invitation-link \{[^}]* transition-property:color,border-color;[^}]*\}', html) is not None, 'Only invitation-link transition is limited')
check(re.search(r'\.hero-invitation-link:focus-visible \{ outline:3px solid var\(--mdm-focus-ring-on-dark\); outline-offset:4px; \}', html) is not None, 'Existing outline remains three pixels')
original_fixture = 'scripts/fixtures/homepage-sample-entry-20261011.json'
check((ROOT / original_fixture).read_bytes() == prior(original_fixture), 'Reviewed PR sample-entry fixture bytes unchanged')
check(hashlib.sha256((ROOT / original_fixture).read_bytes()).hexdigest() == '08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253', 'Original sample-entry fixture pin unchanged')
for file in files[2:]:
    check('08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253' in (ROOT / file).read_text(), file + ': original source pin retained')
protected_files = ['public-search-index.json', 'scripts/homepage_sample_discovery_contract.mjs',
    'scripts/homepage_sample_discovery_smoke.mjs', 'scripts/public_gold_accent_smoke.mjs',
    'scripts/pilot_retry_browser_smoke.mjs', 'enterprise-site.css', 'public-product-design.css',
    'canonical-site-shell.css', 'homepage-workspace-demo.css', 'homepage-workspace-demo.js',
    'scripts/templates/home-workspace-preview.html', 'pattern-trial.html', 'pilot.html',
    'evaluation-capacity.js', 'pilot-pool.js', 'pilot-waitlist.js', 'workspace-access-gate.js',
    'workspace-evaluation.js', 'participant-evidence-safety.js', 'monderman-report.js',
    'public-sample-model.js', 'legal-document-manifest.json', 'terms.html', 'privacy.html',
    'outreach-privacy.html', 'site-shell/header.html', 'site-shell/footer.html',
    '.github/workflows/pages-protected-deploy.yml']
historical = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASELINE, '--', 'scripts/fixtures', 'sample-data'], cwd=ROOT, text=True).strip().splitlines()
for file in protected_files + historical:
    check((ROOT / file).read_bytes() == prior(file), file + ': original product, legal, evidence and source assertions unchanged')
for file in ['unknown.js', '__proto__', 'workspace.html']:
    source = b'Outside the approved focus delta'
    check(source_before_homepage_invitation_focus_20261011(file, source) == source, file + ': unlisted strict source untouched')
    check(source_at_homepage_invitation_focus_baseline(file, source) == source, file + ': unlisted conditional source untouched')
print(json.dumps({'ok': True, 'checks': checks, 'negativeControls': negative_controls, 'files': len(files), 'hunks': hunks, 'fixtureSha256': FIXTURE_SHA256, 'historicalFiles': len(historical), 'protectedFiles': len(protected_files), 'networkCalls': 0, 'productionWrites': 0}))
