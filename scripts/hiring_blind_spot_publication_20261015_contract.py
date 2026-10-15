"""Article-only source and compiled closure, with exact historical projections."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from hiring_blind_spot_publication_20261015_inverse import (
    BASELINE, delta, source_at_hiring_publication_baseline as source_view,
    public_source_at_hiring_publication_baseline as public_view,
    source_paths_at_hiring_publication_baseline as source_paths,
    public_paths_at_hiring_publication_baseline as public_paths,
)

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_FILES = ['.github/workflows/frontend-release.yml', 'public-search-index.json', 'research.html', 'scripts/build_public_search_index.py', 'scripts/scope_beta_20261014_contract.mjs', 'scripts/scope_beta_20261014_contract.py', 'scripts/scope_beta_20261014_inverse.mjs', 'scripts/scope_beta_20261014_inverse.py', 'scripts/validate_frontend_release.py', 'sitemap.txt', 'sitemap.xml']
EXPECTED_ADDITIONS = ['Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf', 'assets/research/hiring-blind-spot-social.png', 'hiring-blind-spot.html']
EXPECTED_GUARDS = ['scripts/fixtures/hiring-blind-spot-publication-20261015.json', 'scripts/hiring_blind_spot_publication_20261015_contract.py', 'scripts/hiring_blind_spot_publication_20261015_inverse.mjs', 'scripts/hiring_blind_spot_publication_20261015_inverse.py']
HELPER_HASHES = {'scripts/hiring_blind_spot_publication_20261015_inverse.mjs': 'd4ce5ecc292f4d7c762a0ae1c64b4ae310e788d04e4aaa774fa27cc188d7d3ec', 'scripts/hiring_blind_spot_publication_20261015_inverse.py': '645af6d5955dc3ccb186dffc5b6c7a782f76f802acc6186849a66a8f29d0c014'}
checks = negatives = 0
parity = []
sha = lambda value: hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()
read = lambda name: (ROOT / name).read_bytes()
git = lambda *args: subprocess.check_output(['git', *args], cwd=ROOT)

def check(value, label):
    global checks
    assert value, label
    checks += 1

def pins(entries, current, view, kind):
    global negatives
    for name, entry in entries.items():
        raw = current(name)
        before = git('show', BASELINE + ':' + name) if kind == 'source' else None
        check(sha(raw) == entry['after_sha256'], 'Exact complete current body ' + name)
        for value in [raw, raw.decode()]:
            prior = view(name, value)
            check(type(prior) is type(value) and sha(prior) == entry['before_sha256'], 'Exact prior body and type ' + name)
            if before is not None:
                check((prior.encode() if isinstance(prior, str) else prior) == before, 'Authoritative main source recovered ' + name)
            check(view(name, prior) == prior, 'Historical source is not inverted twice ' + name)
            parity.append([kind, name, 'str' if isinstance(value, str) else 'bytes', base64.b64encode(raw).decode(), sha(prior)])
        for mutant in [raw + b'\n', b'UNREVIEWED' + raw, raw[1:], raw + b'<script>fetch("/api/activate",{method:"POST"})</script>']:
            check(view(name, mutant) == mutant, 'Unapproved prefix/append/deletion/API body remains visible ' + name)
            negatives += 1
            parity.append([kind, name, 'bytes', base64.b64encode(mutant).decode(), sha(mutant)])

check(BASELINE == '76690a65c53794cb1e35f512221e51ddd0c6525b', 'Actual independently observed default main')
check(git('rev-parse', BASELINE + '^{tree}').decode().strip() == 'eac4db37f700e2cbcb5040262cad01e39950609b', 'Exact main tree')
check(sorted(delta['files']) == EXPECTED_FILES, 'Eleven finite existing paths, including guard adapters')
check(sorted(delta['additions']) == EXPECTED_ADDITIONS and delta['guardFiles'] == EXPECTED_GUARDS, 'Three publication assets and four independent guard files')
check(not any(name.startswith(('sample-data/', 'pdf-src/')) or 'q2' in name for name in delta['files']), 'No sample, private source, questionnaire or Q2 feature edits')
for name, digest in HELPER_HASHES.items():
    check(sha(read(name)) == digest, 'Separately pinned exact transition implementation ' + name)
baseline = git('ls-tree', '-r', '--name-only', BASELINE).decode().splitlines()
check(baseline == delta['baselineSourcePaths'], 'Complete authoritative preceding inventory')
changed = sorted(name for name in git('diff', '--name-only', BASELINE).decode().splitlines() if name in baseline)
check(changed == EXPECTED_FILES, 'No unrelated tracked working or staged change')
for row in git('diff', '--raw', '--no-abbrev', BASELINE).decode().splitlines():
    metadata, name = row.split('\t', 1)
    old_mode, new_mode, old_object, new_object, status = metadata.split()
    if status == 'A':
        check(name in EXPECTED_ADDITIONS + EXPECTED_GUARDS and new_mode == '100644', 'Only approved regular-file additions may be staged or committed')
    else:
        check(status == 'M' and name in EXPECTED_FILES and old_mode[1:] == new_mode, 'No deletion, rename, copy, type or mode transition')
cached = git('ls-files', '--cached').decode().splitlines()
others = git('ls-files', '--others', '--exclude-standard').decode().splitlines()
names = sorted(set(cached + others))
check(names == delta['currentSourcePaths'] == sorted(baseline + EXPECTED_ADDITIONS + EXPECTED_GUARDS), 'Only the exact authorized source inventory')
pins(delta['files'], read, source_view, 'source')
for name, entry in delta['additions'].items():
    check((ROOT / name).is_file() and not (ROOT / name).is_symlink() and len(read(name)) == entry['bytes'] and sha(read(name)) == entry['sha256'], 'Exact approved public asset ' + name)
check(source_paths(names) == baseline, 'Only complete valid publication inventory projects')
for mutant in [names + ['UNKNOWN.js'], names + [names[0]], names[:-1]]:
    check(source_paths(mutant) == mutant, 'Unknown, duplicate or missing source paths remain visible')
    negatives += 1
for name in ['__proto__', 'constructor', 'toString', 'private-api.js']:
    for value in ['Unknown 😀', 'Unknown 😀'.encode()]:
        check(source_view(name, value) == value and public_view(name, value) == value, 'Prototype-safe unknown identity and Unicode type')

article = read('hiring-blind-spot.html').decode()
check(not re.search(r'\bDSI\b|Decision Sciences Institute', article, re.I), 'No DSI affiliation in article text, attributes or metadata')
for token in ['<title>The Hiring Blind Spot | Monderman</title>', 'href="https://www.monderman.com/hiring-blind-spot.html"', 'content="2026-10-16"', 'Governance and Performance · Part 7', 'Jason Adamson', '10 pages', '14-minute read', 'href="Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf"', 'assets/research/hiring-blind-spot-social.png']:
    check(token in article, 'Approved article metadata ' + token)
research = read('research.html').decode()
governance = re.search(r'<section class="series" aria-labelledby="governance-performance-title">(.*?)</section>', research, re.S).group(1)
check(re.findall(r'class="series-chip">([^<]+)', governance) == ['Part ' + str(n) for n in range(1, 8)], 'All seven Governance cards in order')
check('23 items · Updated October 2026' in research and research.count('<article class="series-card">') == 10, 'Accurate total and two-series counts')
for name in ['hiring-blind-spot.html', 'Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf']:
    check(research.count('href="' + name + '"') == 1, 'One library destination ' + name)
before_index = json.loads(git('show', BASELINE + ':public-search-index.json'))
index = json.loads(read('public-search-index.json'))
old_records = {row['url']: row for row in before_index}
new_records = {row['url']: row for row in index}
check(len(index) == len(before_index) + 1 and set(new_records) - set(old_records) == {'hiring-blind-spot.html'}, 'One additional search record')
check([name for name in old_records if old_records[name] != new_records[name]] == ['research.html'], 'Only the library search record otherwise changes')
for name in ['sitemap.txt', 'sitemap.xml']:
    check(read(name).decode().count('https://www.monderman.com/hiring-blind-spot.html') == 1, 'One canonical sitemap entry')
subprocess.run([sys.executable, 'scripts/build_public_search_index.py', '--check'], cwd=ROOT, check=True)
subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
workflow = read('.github/workflows/frontend-release.yml').decode()
check('run: python scripts/hiring_blind_spot_publication_20261015_contract.py' in workflow, 'New article gate is mandatory')

if '--built' in sys.argv:
    build = Path(os.environ.get('HIRING_PUBLICATION_BUILD_ROOT', ROOT / '.render-public')).resolve()
    built_names = sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file())
    check(not any(p.is_symlink() for p in build.rglob('*')), 'No compiled symlinks')
    check(built_names == delta['currentPublicPaths'], 'Exact physical publication closure')
    channel = json.loads((build / '.well-known/monderman-questionnaire-release.json').read_bytes())['channel']
    check(channel in delta['publicEditions'], 'Known compiled channel')
    edition = delta['publicEditions'][channel]
    pins(edition['files'], lambda name: (build / name).read_bytes(), public_view, 'public')
    for name, entry in edition['additions'].items():
        value = (build / name).read_bytes()
        check(len(value) == entry['bytes'] and sha(value) == entry['sha256'], 'Approved compiled addition ' + name)
    for row in edition['currentMap']:
        if row['path'] == '.well-known/monderman-release.json':
            continue
        value = (build / row['path']).read_bytes()
        check(len(value) == row['bytes'] and sha(value) == row['sha256'], 'Whole compiled body binding ' + row['path'])
    check(public_paths(built_names, build) == delta['baselinePublicPaths'], 'Exact compiled publication inventory projects')
    for mutant in [built_names + ['UNKNOWN.js'], built_names + [built_names[0]], built_names[:-1]]:
        check(public_paths(mutant, build) == mutant, 'Unknown/duplicate/missing compiled paths stay visible')
        negatives += 1
    check(not re.search(r'\bDSI\b|Decision Sciences Institute', (build / 'hiring-blind-spot.html').read_text(), re.I), 'No DSI affiliation introduced by shared shell injection')

node = "import fs from 'node:fs';import{createHash}from'node:crypto';import{sourceAtHiringPublicationBaseline as s,publicSourceAtHiringPublicationBaseline as p}from'./scripts/hiring_blind_spot_publication_20261015_inverse.mjs';const rows=JSON.parse(fs.readFileSync(0));for(const[k,f,t,b,h]of rows){const raw=Buffer.from(b,'base64'),v=t==='str'?raw.toString():raw,o=(k==='source'?s:p)(f,v);if((t==='str'?typeof o!=='string':!Buffer.isBuffer(o))||createHash('sha256').update(o).digest('hex')!==h)throw Error('Publication parity '+f);}console.log(rows.length);"
result = subprocess.run(['node', '--input-type=module', '-e', node], cwd=ROOT, input=json.dumps(parity), capture_output=True, text=True, check=True)
check(int(result.stdout.strip()) == len(parity), 'Every ordered independent JS/Python positive, negative, byte and text case')
print(json.dumps({'ok': True, 'checks': checks, 'negativeControls': negatives, 'parityCases': len(parity), 'existingFiles': len(EXPECTED_FILES), 'publicAssets': len(EXPECTED_ADDITIONS), 'built': '--built' in sys.argv, 'networkCalls': 0, 'productionWrites': 0}))
