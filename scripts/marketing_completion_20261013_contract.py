"""Independent offline exact completion approval: no live or customer actions."""
import hashlib
import json
from pathlib import Path
from homepage_refinement_20261014_inverse import source_paths_at_homepage_refinement_baseline
from scope_beta_20261014_inverse import _fixture as scope_beta_delta
import re
import subprocess
import sys
from marketing_completion_20261013_inverse import (
    BASELINE, VERSION, _fixture as delta, FILES, ADDITIONS, GUARD_FILES,
    source_before_marketing_completion_20261013 as strict,
    source_at_marketing_completion_baseline as conditional,
)
ROOT = Path(__file__).resolve().parents[1]
from marketing_photo_presentation_20261013_inverse import source_at_marketing_photo_presentation_baseline, photo_names_at_marketing_photo_presentation_baseline, ADDITIONS as PHOTO_PRESENTATION_ADDITIONS, GUARD_FILES as PHOTO_PRESENTATION_GUARD_FILES
read = lambda file: source_at_marketing_photo_presentation_baseline(file, (ROOT / file).read_bytes())
sha = lambda data: hashlib.sha256(data).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args], cwd=ROOT)
checks = negative_controls = hunks = immutable_files = old_fixtures = pdfs = 0

def check(value, label):
    global checks
    assert value, label
    checks += 1

def reject(fn, label):
    global negative_controls
    try:
        fn()
    except AssertionError:
        check(True, label)
        negative_controls += 1
    else:
        raise AssertionError(label)

expected_files = ['index.html', 'public-search-index.json',
    'after-a-reorganization.html', 'after-an-acquisition.html', 'new-in-the-role.html', 'transformation-behind-schedule.html',
    'scripts/render-static-build.sh', 'scripts/marketing_refresh_20261012_inverse.mjs', 'scripts/marketing_refresh_20261012_inverse.py',
    'scripts/marketing_refresh_20261012_contract.mjs', 'scripts/marketing_refresh_20261012_contract.py',
    'scripts/public_sample_manifest_sensitivity_smoke.mjs', '.github/workflows/frontend-release.yml',
    '.github/workflows/sample-report-marketing-certification.yml', 'scripts/homepage_assistant_smoke.mjs',
    'scripts/validate_production_cosmetic_certification.py', 'scripts/certification_guard_sensitivity_smoke.py',
    'scripts/homepage_sample_discovery_smoke.mjs']
guard_files = ['scripts/marketing_completion_20261013_inverse.mjs', 'scripts/marketing_completion_20261013_inverse.py',
    'scripts/marketing_completion_20261013_contract.mjs', 'scripts/marketing_completion_20261013_contract.py',
    'scripts/fixtures/marketing-completion-20261013.json']
check(BASELINE == '561439e7c5aef48db0331bbb993f0a6d9ec4ada1', 'Actual deployed starting revision')
check(VERSION == 'marketing-completion-20261013.5', 'Separate new approval version')
check(delta.get('provisional') is False, 'Incomplete/photo-pending scaffold cannot certify publication')
check(list(FILES) == expected_files, 'Exact eighteen-file finite existing whitelist')
check(list(GUARD_FILES) == guard_files, 'Only five new approval modules/fixture')
check(git('rev-parse', BASELINE + '^{tree}').decode().strip() == delta['baselineTree'], 'Exact deployed Git tree')
tracked = git('ls-tree', '-r', '--name-only', BASELINE).decode().splitlines()
framed = subprocess.check_output(['git', 'cat-file', '--batch'], cwd=ROOT,
    input=''.join(BASELINE + ':' + file + '\n' for file in tracked).encode())
before, offset = {}, 0
for file in tracked:
    end = framed.index(b'\n', offset)
    header = framed[offset:end].decode()
    assert re.fullmatch(r'[a-f0-9]{40} blob \d+', header), 'Exact baseline Git blob frame'
    length = int(header.split()[2])
    offset = end + 1
    before[file] = framed[offset:offset + length]
    offset += length
    assert framed[offset:offset + 1] == b'\n', 'Complete blob framing'
    offset += 1
check(offset == len(framed), 'All baseline bytes consumed')
for file in expected_files:
    current, old, entry = read(file), before[file], delta['files'][file]
    check(sha(current) == entry['after_sha256'], file + ': exact complete reviewed source pin')
    check(sha(old) == entry['before_sha256'], file + ': original deployed source pin')
    for source in (current, current.decode('utf-8')):
        expected = old if isinstance(source, bytes) else old.decode('utf-8')
        check(strict(file, source) == expected and type(strict(file, source)) is type(source), file + ': exact inverse/type')
        check(conditional(file, source) == expected and type(conditional(file, source)) is type(source), file + ': conditional inverse/type')
        check(conditional(file, expected) == expected, file + ': baseline identity')
    utf16 = current.decode('utf-8').encode('utf-16-le')
    mutants = [current + b'\n', b'UNREVIEWED' + current, b'!' + current[1:], old,
        current + b'<script>fetch("https://api.monderman.com/api/scoring",{method:"POST"})</script>']
    previous_end = 0
    for start, end, now, was in entry['replacements']:
        check(type(start) is int and type(end) is int and previous_end <= start <= end, file + ': finite ordered UTF-16 hunk')
        check(isinstance(now, str) and isinstance(was, str), file + ': hunk text types')
        check(utf16[start * 2:end * 2].decode('utf-16-le') == now, file + ': actual exact hunk')
        previous_end = end
        mutants.append((utf16[:start * 2] + 'UNREVIEWED'.encode('utf-16-le') + utf16[end * 2:]).decode('utf-16-le').encode('utf-8'))
        hunks += 1
    for mutant in mutants:
        reject(lambda m=mutant: strict(file, m), file + ': unknown/double inverse/API injection rejected')
        check(conditional(file, mutant) == mutant, file + ': unknown edits visible')
for file in tracked:
    if file in expected_files:
        continue
    check(read(file) == before[file], file + ': every other baseline byte unchanged')
    immutable_files += 1
    old_fixtures += int(file.startswith('scripts/fixtures/'))
    pdfs += int(file.endswith('.pdf'))
check(sha(read('scripts/fixtures/marketing-refresh-20261012.json')) == 'fd9eebf062c33eeac2e692c5f173dfbc7cfb2752e300749d61b2d789904aff8e', 'Published marketing fixture immutable')
check(read('.github/workflows/pages-protected-deploy.yml') == before['.github/workflows/pages-protected-deploy.yml'], 'Protected Pages workflow byte-exact')
required_new = ['marketing-completion.css', 'marketing-completion.js', 'scripts/marketing_completion_browser_smoke.mjs',
    'docs/marketing-completion-20261013.md', 'docs/marketing-photo-register-20261013.json']
for file in required_new:
    check(file in ADDITIONS, file + ': required independently pinned addition')

def assert_addition(file, data):
    assert sha(data) == delta['additions'][file]['sha256'], file + ': exact new file pin'
    assert len(data) == delta['additions'][file]['bytes'], file + ': exact new file length'

for file in ADDITIONS:
    check(file not in tracked and file not in guard_files, file + ': genuine addition')
    check(file in required_new or re.fullmatch(r'assets/marketing/[A-Za-z0-9._-]+\.(?:avif|webp|jpe?g|png)', file, re.I), file + ': only public presentation/derivative/summary')
    data = read(file)
    assert_addition(file, data)
    checks += 2
    check(strict(file, data) == data and conditional(file, data) == data, file + ': addition never erased')
    reject(lambda f=file, b=data: assert_addition(f, b + b'UNREVIEWED'), file + ': altered addition rejected')
known = set(tracked + list(ADDITIONS) + guard_files + list(PHOTO_PRESENTATION_ADDITIONS) + list(PHOTO_PRESENTATION_GUARD_FILES))
cached = git('ls-files', '--cached').decode().splitlines()
paths = set(cached + git('ls-files', '--others', '--exclude-standard').decode().splitlines())
paths = {f for f in paths if (ROOT / f).exists() and not (f == 'node_modules' and f not in cached and (ROOT / f).is_symlink())}
paths = source_paths_at_homepage_refinement_baseline(paths)

def assert_scope(values):
    for file in values:
        assert file in known, file + ': unlisted source/addition rejected'

assert_scope(paths)
checks += len(paths)
reject(lambda: assert_scope(paths | {'unexpected-publication.js'}), 'Unknown publication rejected')
reject(lambda: assert_scope(paths | {'node_modules'}), 'No exemption for source file named node_modules')
check(not any(re.search(r'marketing-source\.tgz|marketing-review-source\.zip|(?:^|/)(?:AGENTS\.md|\.env(?:\.|$))', f) for f in paths), 'No archive/private instructions/credential file')
# October 15, 2026: formerly unlisted additions are now eight exact upstream finite binaries.
def reject_finite_binary_string(fn, file, label):
    global negative_controls
    try:
        fn()
    except AssertionError as error:
        check(str(error) == file + ': finite binary input stays bytes', label)
        negative_controls += 1
    else:
        raise AssertionError(label)

upstream_binary_identity_files = {file for file, entry in scope_beta_delta['files'].items() if entry.get('encoding') == 'base64'}
check(sorted(upstream_binary_identity_files.intersection(ADDITIONS)) == ['assets/marketing/team-perspectives-1600.webp', 'assets/marketing/team-perspectives-540.webp', 'assets/marketing/team-perspectives-960.jpg', 'assets/marketing/team-perspectives-960.webp', 'assets/marketing/work-discussion-1600.webp', 'assets/marketing/work-discussion-540.webp', 'assets/marketing/work-discussion-960.jpg', 'assets/marketing/work-discussion-960.webp'], 'Exactly eight upstream finite binary additions require byte input')
binary_string_cases = 0
for file in ['unknown.js', '__proto__', 'constructor', 'toString', 'workspace.html', 'pattern-trial.html', *ADDITIONS]:
    for source in ('Unlisted 😀', 'Unlisted 😀'.encode('utf-8')):
        if file in upstream_binary_identity_files and isinstance(source, str):
            reject_finite_binary_string(lambda file=file, source=source: strict(file, source), file, file + ': upstream finite binary string rejected by strict chain')
            reject_finite_binary_string(lambda file=file, source=source: conditional(file, source), file, file + ': upstream finite binary string rejected by conditional chain')
            binary_string_cases += 1
        else:
            check(strict(file, source) == source and type(strict(file, source)) is type(source), file + ': unlisted strict identity/type')
            check(conditional(file, source) == source and type(conditional(file, source)) is type(source), file + ': unlisted conditional identity/type')
check(binary_string_cases == 8, 'All eight binary string cases explicitly reject in both inverses; no case skipped')
footer_pages = expected_files[2:6]
canonical_footer = read('site-shell/footer.html').decode().rstrip('\n')
for file in footer_pages:
    old, now = before[file].decode(), read(file).decode()
    start = old.index('            <a href="https://x.com/MondermanHQ"')
    stop = old.index('    </footer>', start) + len('    </footer>')
    replacement = '          </div>\n        </div>\n      </section>\n    </main>\n' + '\n'.join('    ' + s if s else '' for s in canonical_footer.splitlines())
    check(now == old[:start] + replacement + old[stop:], file + ': exact malformed footer boundary only')
    for tag in ['main', 'section', 'footer']:
        check(len(re.findall(r'<' + tag + r'\b', now)) == len(re.findall(r'</' + tag + '>', now)), file + ': balanced ' + tag)
    check(len(re.findall(r'<footer\b', now)) == 1, file + ': one semantic footer')
    marker = '    <script src="first-run-telemetry.js"'
    check(now[now.index(marker):] == old[old.index(marker):], file + ': all original script/telemetry bytes intact')
def once(text, old, new):
    assert text.count(old) == 1, 'Exact unique adapter boundary'
    return text.replace(old, new)

for language in ['mjs', 'py']:
    file = 'scripts/marketing_refresh_20261012_inverse.' + language
    expected = before[file].decode()
    if language == 'mjs':
        expected = once(expected, "import {createHash} from 'node:crypto';\n", "import {createHash} from 'node:crypto';\nimport {sourceAtMarketingCompletionBaseline} from './marketing_completion_20261013_inverse.mjs';\n")
        for name in ['sourceBeforeMarketingRefresh20261012', 'sourceAtMarketingRefreshBaseline']:
            old = 'export function ' + name + '(file,source){\n'
            expected = once(expected, old, old + '  source=sourceAtMarketingCompletionBaseline(file,source);\n')
    else:
        expected = once(expected, 'from pathlib import Path\n', 'from pathlib import Path\nfrom marketing_completion_20261013_inverse import source_at_marketing_completion_baseline\n')
        for name in ['source_before_marketing_refresh_20261012', 'source_at_marketing_refresh_baseline']:
            old = 'def ' + name + '(file, source):\n'
            expected = once(expected, old, old + '    source = source_at_marketing_completion_baseline(file, source)\n')
    check(read(file).decode() == expected, file + ': exact precomposition only; all prior proof retained')
file = 'scripts/marketing_refresh_20261012_contract.mjs'
expected = once(before[file].decode(), "import {execFileSync} from 'node:child_process';\n", "import {execFileSync} from 'node:child_process';\nimport {sourceAtMarketingCompletionBaseline,MARKETING_COMPLETION_ADDITIONS,MARKETING_COMPLETION_GUARD_FILES} from './marketing_completion_20261013_inverse.mjs';\n")
expected = once(expected, "\nconst root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));\nconst git=", "\nconst root=path.resolve(import.meta.dirname,'..'),read=file=>sourceAtMarketingCompletionBaseline(file,fs.readFileSync(path.join(root,file)));\nconst git=")
expected = once(expected, 'const known=new Set([...tracked,...MARKETING_REFRESH_ADDITIONS,...guardFiles]);', 'const known=new Set([...tracked,...MARKETING_REFRESH_ADDITIONS,...guardFiles,...MARKETING_COMPLETION_ADDITIONS,...MARKETING_COMPLETION_GUARD_FILES]);')
check(read(file).decode() == expected, 'Exact old JS contract adapter; every original assertion retained')
file = 'scripts/marketing_refresh_20261012_contract.py'
expected = once(before[file].decode(), 'import subprocess\n', 'import subprocess\nfrom marketing_completion_20261013_inverse import source_at_marketing_completion_baseline, ADDITIONS as COMPLETION_ADDITIONS, GUARD_FILES as COMPLETION_GUARD_FILES\n')
expected = once(expected, '\nread = lambda file: (ROOT / file).read_bytes()\ntracked', '\nread = lambda file: source_at_marketing_completion_baseline(file, (ROOT / file).read_bytes())\ntracked')
expected = once(expected, 'known = set(tracked + list(additions) + guards)', 'known = set(tracked + list(additions) + guards + list(COMPLETION_ADDITIONS) + list(COMPLETION_GUARD_FILES))')
check(read(file).decode() == expected, 'Exact old Python contract adapter; every original assertion retained')
file = 'scripts/public_sample_manifest_sensitivity_smoke.mjs'
expected = once(before[file].decode(), "  'scripts/marketing_refresh_20261012_inverse.mjs','scripts/fixtures/marketing-refresh-20261012.json',\n", "  'scripts/marketing_refresh_20261012_inverse.mjs','scripts/fixtures/marketing-refresh-20261012.json',\n  'scripts/marketing_completion_20261013_inverse.mjs','scripts/fixtures/marketing-completion-20261013.json',\n")
check(read(file).decode() == expected, 'Only isolated helper dependency; all123 original mutations retained')
file = '.github/workflows/frontend-release.yml'
new_static = '          node scripts/marketing_completion_20261013_contract.mjs\n          python scripts/marketing_completion_20261013_contract.py\n'
static_anchor = '          node scripts/marketing_refresh_20261012_contract.mjs\n'
expected = once(before[file].decode(), static_anchor, new_static + static_anchor)
check(read(file).decode() == expected, 'Frontend only two new gates; unchanged jobs, thresholds and commands')
file = '.github/workflows/sample-report-marketing-certification.yml'
expected = before[file].decode()
trigger_paths = ['scripts/marketing_completion_20261013_contract.mjs', 'scripts/marketing_completion_20261013_contract.py', 'scripts/marketing_completion_20261013_inverse.mjs', 'scripts/marketing_completion_20261013_inverse.py', 'scripts/fixtures/marketing-completion-20261013.json', 'scripts/marketing_completion_browser_smoke.mjs', 'marketing-completion.css', 'marketing-completion.js', 'assets/marketing/**', 'docs/marketing-completion-20261013.md', 'docs/marketing-photo-register-20261013.json', *footer_pages]
anchor = "      - 'scripts/marketing_refresh_20261012_contract.mjs'\n"
check(expected.count(anchor) == 2, 'Two original trigger lists')
expected = expected.replace(anchor, ''.join("      - '" + p + "'\n" for p in trigger_paths) + anchor)
expected = once(expected, static_anchor, new_static + static_anchor)
anchor = '          MARKETING_REFRESH_OUT=/tmp/report-presentation-smoke/marketing-refresh node scripts/marketing_refresh_browser_smoke.mjs\n'
expected = once(expected, anchor, anchor + '          MARKETING_COMPLETION_OUT=/tmp/report-presentation-smoke/marketing-completion node scripts/marketing_completion_browser_smoke.mjs\n')
expected = once(expected, '    timeout-minutes: 50\n', '    # October 13, 2026: retain the full original and 60-state completion checks;\n    # allow bounded browser sweeps, evidence upload and cleanup to finish.\n    timeout-minutes: 60\n')
expected_certification_budget = expected
current_certification_budget = read(file).decode()
def assert_certification_budget(source):
    assert source == expected_certification_budget, "Only dated60-minute budget addition; all commands/assertions/engines/concurrency unchanged"
assert_certification_budget(current_certification_budget)
check(True, "Exact private contingency workflow budget")
for old_value, new_value in [('    timeout-minutes: 60\n', '    timeout-minutes: 50\n'), ('    timeout-minutes: 60\n', '    timeout-minutes: 61\n'), ('    timeout-minutes: 60\n', '    timeout-minutes: 0\n'), ('  cancel-in-progress: true\n', '  cancel-in-progress: false\n'), ('          MARKETING_COMPLETION_OUT=/tmp/report-presentation-smoke/marketing-completion node scripts/marketing_completion_browser_smoke.mjs\n', ''), ('          MARKETING_REFRESH_OUT=/tmp/report-presentation-smoke/marketing-refresh node scripts/marketing_refresh_browser_smoke.mjs\n', ''), ('    runs-on: ubuntu-24.04\n', '    runs-on: ubuntu-latest\n'), ('      - name: Upload rendered evidence\n', '      - name: Skipped rendered evidence\n')]:
    check(old_value in current_certification_budget, "Exact contingency negative target")
    reject(lambda old_value=old_value, new_value=new_value: assert_certification_budget(current_certification_budget.replace(old_value, new_value, 1)), "Changed budget/command/concurrency/platform/evidence rejects")
check(read(file).decode() == expected, 'Certification exact extra paths/gates/browser; every prior call retained')
file = 'scripts/render-static-build.sh'
anchor = "find assets/research -maxdepth 1 -type f -name '*.png' ! -name 'after-the-first-lap-social.png' -exec cp -- {} \"$publish_dir/assets/research/\" \\;\n"
block = "\n# Only reviewed public photographic derivatives; originals and private licensing evidence stay out.\nmkdir -p \"$publish_dir/assets/marketing\"\nfind assets/marketing -maxdepth 1 -type f \\( -name '*.avif' -o -name '*.webp' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' \\) -exec cp -- {} \"$publish_dir/assets/marketing/\" \\;\n"
expected = once(before[file].decode(), anchor, anchor + block)
check(read(file).decode() == expected, 'Build only image derivative copy; all private/identity guards preserved')
# Exact four-footer consumer amendment; preserve all prior rules and mutation cases.
original_brand_count_line = 'approved_brand_statement_counts = {"index.html": 3, "hold-collide-come-apart.html": 1, "trenches-not-silos.html": 1, "durable-organization.html": 1}\n'
repaired_footer_brand_count_line = '# October 13, 2026: these four repaired use-case pages contain the approved canonical footer once.\napproved_brand_statement_counts = {"index.html": 3, "hold-collide-come-apart.html": 1, "trenches-not-silos.html": 1, "durable-organization.html": 1, "after-a-reorganization.html": 1, "after-an-acquisition.html": 1, "new-in-the-role.html": 1, "transformation-behind-schedule.html": 1}\n'
footer_sensitivity_anchor = '    approved_brand_statement = "Understand how ownership, decisions, and everyday work operate across your organization—and where to focus improvement."\n'
footer_sensitivity_cases = '    # October 13, 2026: each approved repaired footer still rejects all other copy/count changes.\n    for footer_page in ["after-a-reorganization.html", "after-an-acquisition.html", "new-in-the-role.html", "transformation-behind-schedule.html"]:\n        expect_rejection(\n            fixture,\n            footer_page + ": changed canonical footer brand wording",\n            footer_page + ": visible em dash returned",\n            lambda: rewrite(fixture / footer_page, lambda value: value.replace(approved_brand_statement, approved_brand_statement.replace("improvement.", "improvements."), 1)),\n            [footer_page],\n        )\n        expect_rejection(\n            fixture,\n            footer_page + ": duplicate canonical footer brand statement",\n            footer_page + ": approved brand statement count changed",\n            lambda: rewrite(fixture / footer_page, lambda value: value.replace("</main>", "<p>" + approved_brand_statement + "</p></main>", 1)),\n            [footer_page],\n        )\n        expect_rejection(\n            fixture,\n            footer_page + ": missing canonical footer brand statement",\n            footer_page + ": approved brand statement count changed",\n            lambda: rewrite(fixture / footer_page, lambda value: value.replace(approved_brand_statement, "", 1)),\n            [footer_page],\n        )\n        expect_rejection(\n            fixture,\n            footer_page + ": unrelated visible footer punctuation",\n            footer_page + ": visible em dash returned",\n            lambda: rewrite(fixture / footer_page, lambda value: value.replace("</main>", "<p>Other—copy.</p></main>", 1)),\n            [footer_page],\n        )\n'
expected_cosmetic_validator = once(before['scripts/validate_production_cosmetic_certification.py'].decode(), original_brand_count_line, repaired_footer_brand_count_line)
expected_cosmetic_sensitivity = once(before['scripts/certification_guard_sensitivity_smoke.py'].decode(), footer_sensitivity_anchor, footer_sensitivity_anchor + footer_sensitivity_cases)
def assert_current_cosmetic_consumers(validator, sensitivity):
    assert validator == expected_cosmetic_validator, "Only four exact1-count footer entries/comment; all prior literals/counts/assertions/rules retained"
    assert sensitivity == expected_cosmetic_sensitivity, "Exactly16 additive real mutations; all original mutations/calls retained"
cosmetic_validator, cosmetic_sensitivity = read('scripts/validate_production_cosmetic_certification.py').decode(), read('scripts/certification_guard_sensitivity_smoke.py').decode()
assert_current_cosmetic_consumers(cosmetic_validator, cosmetic_sensitivity)
check(True, "Exact current cosmetic consumer additions")
for footer in footer_pages:
    reject(lambda footer=footer: assert_current_cosmetic_consumers(cosmetic_validator.replace(json.dumps(footer) + ": 1", json.dumps(footer) + ": 2", 1), cosmetic_sensitivity), "Wrong explicit footer count rejects")
for old_value, new_value in [('"index.html": 3', '"index.html": 4'), ('"durable-organization.html": 1', '"durable-organization.html": 0'), ('approved_count == approved_brand_statement_counts.get(path.name, 0)', 'True'), ('require(not any("—" in value', 'require(any("—" in value'), ('organization—and where', 'organization—and everywhere'), ('"after-a-reorganization.html": 1', '"after-a-reorganization.html": 1, "unapproved.html": 1')]:
    check(old_value in cosmetic_validator, "Exact consumer negative target")
    reject(lambda old_value=old_value, new_value=new_value: assert_current_cosmetic_consumers(cosmetic_validator.replace(old_value, new_value, 1), cosmetic_sensitivity), "Changed original allowance/count/literal/assertion or added page rejects")
footer_loop = '    for footer_page in ["after-a-reorganization.html", "after-an-acquisition.html", "new-in-the-role.html", "transformation-behind-schedule.html"]:\n'
for mutant in [cosmetic_sensitivity.replace(footer_loop, '    for footer_page in []:\n', 1), cosmetic_sensitivity.replace(footer_loop, footer_loop + '        continue\n', 1), cosmetic_sensitivity.replace('footer_page + ": missing canonical footer brand statement"', 'footer_page + ": missing test skipped"', 1), cosmetic_sensitivity.replace('approved_brand_statement.replace("improvement.", "improvements.")', 'approved_brand_statement', 1)]:
    reject(lambda mutant=mutant: assert_current_cosmetic_consumers(cosmetic_validator, mutant), "Added mutation skip/neutralization rejects")

def guard_calls(source):
    masked, state, escaped, in_class, i = list(source), None, False, False, 0
    while i < len(source):
        c = source[i]
        following = source[i + 1] if i + 1 < len(source) else ''
        if state:
            if c != '\n':
                masked[i] = ' '
            if state == 'line':
                if c == '\n':
                    state = None
            elif state == 'block':
                if c == '*' and following == '/':
                    i += 1
                    masked[i] = ' '
                    state = None
            elif escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif state == 'regex':
                if c == '[':
                    in_class = True
                elif c == ']':
                    in_class = False
                elif c == '/' and not in_class:
                    state = None
            elif c == state:
                state = None
        elif c in '\"\'`':
            state, masked[i] = c, ' '
        elif c == '/' and following == '/':
            state, masked[i] = 'line', ' '
            i += 1
            masked[i] = ' '
        elif c == '/' and following == '*':
            state, masked[i] = 'block', ' '
            i += 1
            masked[i] = ' '
        elif c == '/':
            previous = i - 1
            while previous >= 0 and masked[previous].isspace():
                previous -= 1
            if previous < 0 or masked[previous] in '([=:,!&|?{;':
                state, in_class, masked[i] = 'regex', False, ' '
        i += 1
    text, out = ''.join(masked), []
    for match in re.finditer(r'\b(?:assert(?:\.[A-Za-z]+)?|check|equal|eq|assertCompactHeight|assertAssumptionsText|assertReadingGuide|assertReadablePreview|assertEnlargedOverview|assertExpandedHeight|assertRefreshedJourneyGeometry|assertCurrentEditorialSequence|assertCompletionEditorialSequence)\s*\(', text):
        depth, end = 1, match.end()
        while end < len(text) and depth:
            depth += int(text[end] == '(') - int(text[end] == ')')
            end += 1
        assert depth == 0, 'Balanced original guard call'
        out.append('\n'.join(line.strip() for line in source[match.start():end].split('\n')))
    return out

assistant_file = 'scripts/homepage_assistant_smoke.mjs'
assistant_source = read(assistant_file).decode()
prior_assistant_calls = guard_calls(before[assistant_file].decode())
def assert_assistant_calls(source):
    current, at = guard_calls(source), 0
    for statement in prior_assistant_calls:
        matches = [i for i in range(at, len(current)) if current[i] == statement]
        assert matches, 'Every previous assistant assertion/call retained in order'
        at = matches[0] + 1
    assert "for (edition of ['baseline', 'current'])" in source, 'Both assistant editions execute'
assert_assistant_calls(assistant_source)
checks += len(prior_assistant_calls) + 1
target = next(call for call in prior_assistant_calls if assistant_source.count(call) == 1)
reject(lambda: assert_assistant_calls(assistant_source.replace(target, 'void 0')), 'Removed original assistant assertion rejects')
reject(lambda: assert_assistant_calls(assistant_source.replace(target, '/* ' + target + ' */')), 'Commented old assistant assertion rejects')
completion_proof = 'assertCompletionEditorialSequence(editorial.visibleSections, completionPhotos)'
completion_projection = 'editorial.visibleSections = projectApprovedCompletionSections(editorial.visibleSections);'
dom_projection = 'scene.domSections = projectApprovedCompletionSections(scene.domSections);'
old_assistant_proof = 'assertCurrentEditorialSequence(editorial.visibleSections, scene)'
fixed_projection = 'function projectApprovedCompletionSections(sections) {\n  return [sections[0], ...sections.slice(2, 9), sections[10], ...sections.slice(12)];\n}'
def completion_hooks(source):
    return [call for call in guard_calls(source) if call.startswith('assert.throws(') and re.search(r'\(\)\s*=>\s*assertCompletionEditorialSequence\(', call)]
def assert_completion_proof(source):
    assert completion_proof in guard_calls(source), 'Actual fifteen-section/photo proof executes'
    assert fixed_projection in source, 'Only fixed approved positions1/9/11 projected'
    assert source.index(completion_proof) < source.index(completion_projection) < source.index(dom_projection) < source.index(old_assistant_proof), 'Complete15 proof before projections and unchanged12 proof'
    assert len(completion_hooks(source)) == 2, 'Both actual new sequence/photo negative loops execute'
assert_completion_proof(assistant_source)
checks += 4
for target in [completion_proof, *completion_hooks(assistant_source)]:
    check(assistant_source.count(target) == 1, 'Unique completion proof/negative hook')
    reject(lambda t=target: assert_completion_proof(assistant_source.replace(t, 'void 0')), 'Removed new assistant proof/negative rejects')
    reject(lambda t=target: assert_completion_proof(assistant_source.replace(t, '/* ' + t + ' */')), 'Commented new assistant proof/negative rejects')
reject(lambda: assert_completion_proof(assistant_source.replace(fixed_projection, fixed_projection.replace('sections[0]', 'sections[1]'))), 'Changed projection position rejects')
reject(lambda: assert_completion_proof(assistant_source.replace(completion_proof, 'void 0').replace(completion_projection, completion_projection + '\n' + completion_proof)), 'Projection before strict15 proof rejects')
# Exact navigation-test lifecycle repair; all original guard sites remain executable.
discovery_file = 'scripts/homepage_sample_discovery_smoke.mjs'
discovery_before, discovery_source = before[discovery_file].decode(), read(discovery_file).decode()
original_navigation_block = '        const [request]=await Promise.all([\n          page.waitForRequest(request=>request.isNavigationRequest()&&new URL(request.url()).pathname===destination.path),\n          page.locator(destination.selector).click(),\n        ]);\n'
completed_navigation_block = "        // 2026-10-13: finish each destination load before returning home;\n        // observing its first request alone can leave navigation in flight.\n        const [request,response]=await Promise.all([\n          page.waitForRequest(request=>request.isNavigationRequest()&&new URL(request.url()).pathname===destination.path),\n          page.waitForNavigation({waitUntil:'load'}),\n          page.locator(destination.selector).click(),\n        ]);\n"
original_navigation_hash_assertion = "        assert.equal(url.hash,'',label+': no invitation or tracking capability is added');\n"
completed_navigation_response_assertions = "        assert.ok(response,label+': clicked anchor completes a document navigation');\n        assert.equal(response.status(),200,label+': completed destination response succeeds');\n        assert.equal(new URL(response.url()).origin,new URL(base).origin,label+': completed destination remains local');\n        assert.equal(await response.finished(),null,label+': destination response finishes successfully');\n"
expected_discovery_source = once(once(discovery_before, original_navigation_block, completed_navigation_block), original_navigation_hash_assertion, original_navigation_hash_assertion + completed_navigation_response_assertions)
original_discovery_calls = guard_calls(discovery_before)
def assert_discovery_original_calls(source):
    calls, cursor = guard_calls(source), 0
    for call in original_discovery_calls:
        assert call in calls[cursor:], "Every original discovery guard call retained in order"
        cursor = calls.index(call, cursor) + 1
def assert_completed_discovery_source(source):
    assert_discovery_original_calls(source)
    assert source == expected_discovery_source, "Only future load before click and four strict response checks; no URL/geometry/deadline/retry changes"
assert_completed_discovery_source(discovery_source)
check(True, "Exact stronger navigation lifecycle and all original assertions")
subprocess.run(['node', '--check', str(ROOT / discovery_file)], cwd=ROOT, check=True, capture_output=True)
check(True, "Actual JavaScript syntax parser accepts the reviewed source")
original_discovery_target = next(call for call in original_discovery_calls if discovery_source.count(call) == 1)
reject(lambda: assert_completed_discovery_source(discovery_source.replace(original_discovery_target, 'void 0', 1)), "Deleted old discovery assertion rejects")
reject(lambda: assert_completed_discovery_source(discovery_source.replace(original_discovery_target, '/* ' + original_discovery_target + ' */', 1)), "Commented old discovery assertion rejects")
reject(lambda: assert_completed_discovery_source(discovery_source.replace(original_discovery_target, original_discovery_target.replace('assert.equal(', 'assert.notEqual(', 1), 1)), "Negated original discovery equality rejects")
reject(lambda: assert_completed_discovery_source(discovery_source.replace("page.waitForNavigation({waitUntil:'load'})", "!page.waitForNavigation({waitUntil:'load'})", 1)), "Negated navigation wait rejects")
for old_value, new_value in [("          page.waitForNavigation({waitUntil:'load'}),\n", ''), ("          page.waitForNavigation({waitUntil:'load'}),\n", "          /* page.waitForNavigation({waitUntil:'load'}), */\n"), ("page.waitForNavigation({waitUntil:'load'})", "page.waitForNavigation({waitUntil:'commit'})"), ("          page.waitForNavigation({waitUntil:'load'}),\n          page.locator(destination.selector).click(),\n", "          page.locator(destination.selector).click(),\n          page.waitForNavigation({waitUntil:'load'}),\n"), ('        assert.ok(response,', '        assert.ok(!response,'), ('response.status(),200', 'response.status(),503'), ('assert.equal(new URL(response.url()).origin,new URL(base).origin', 'assert.equal(new URL(response.url()).origin,"*"'), ('assert.equal(await response.finished(),null', 'assert.equal(await response.finished(),true'), ('assert.equal(states,20', 'assert.equal(states,19'), ('assert.equal(entryStates,12', 'assert.equal(entryStates,11'), ("{waitUntil:'load'}", "{waitUntil:'load',timeout:60000}")]:
    check(old_value in discovery_source, "Exact navigation mutation target")
    reject(lambda old_value=old_value, new_value=new_value: assert_completed_discovery_source(discovery_source.replace(old_value, new_value, 1)), "Missing/negated/reordered wait/response/old count or changed deadline rejects")
for statement in completed_navigation_response_assertions.rstrip('\n').split('\n'):
    reject(lambda statement=statement: assert_completed_discovery_source(discovery_source.replace(statement + '\n', '', 1)), "Each new response assertion remains required")

old_search, now_search = json.loads(before['public-search-index.json']), json.loads(read('public-search-index.json'))
check([r['url'] for r in now_search] == [r['url'] for r in old_search], 'Every search record/order retained')
for old, now in zip(old_search, now_search):
    if old['url'] not in ['index.html', *footer_pages]:
        check(now == old, old['url'] + ': unrelated search record exact')
    else:
        for field in ['url', 'title', 'category']:
            check(now[field] == old[field], old['url'] + ': approved search identity/title/category')
html, old_html = read('index.html').decode(), before['index.html'].decode()
essential_photo_style = 'style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block"'
essential_picture_style = 'style="display:block;position:relative;aspect-ratio:var(--mc-photo-ratio)"'
photo_sizes = 'sizes="(max-width:820px) calc(100vw - 40px), (max-width:1440px) 57vw, 820px"'
def assert_photo_markup(source):
    figures = re.findall(r'<figure\b[^>]*\bdata-marketing-photo\b[^>]*>[\s\S]*?</figure>', source)
    assert len(figures) == 3, 'Three approved photographic figures'
    for index, figure in enumerate(figures):
        image = re.search(r'<img\b[^>]*>', figure)
        assert image and essential_photo_style in image[0], 'Essential sizing survives missing stylesheet'
        picture = re.findall(r'<picture\b[^>]*>', figure)
        frame = re.findall(r'<figure\b[^>]*>', figure)
        assert picture and essential_picture_style in picture[0], 'Essential ratio frame survives missing stylesheet'
        assert frame and 'style="--mc-photo-ratio:1600 / ' + str([1066, 1195, 1068][index]) + '"' in frame[0], 'Exact original full-composition ratio'
        assert 'data-stock-id="' + ['501653292', '488892667', '524156476'][index] + '"' in image[0], 'Exact approved photo identity'
        assert photo_sizes in figure, 'Actual source sizes match820px stacking breakpoint'
        assert 'Illustrative photography · Models shown' in figure, 'Neutral visible model qualification'
assert_photo_markup(html)
checks += 1
reject(lambda: assert_photo_markup(html.replace(essential_photo_style, '', 1)), 'Missing no-stylesheet sizing rejects')
reject(lambda: assert_photo_markup(html.replace(essential_picture_style, '', 1)), 'Missing no-stylesheet ratio frame rejects')
reject(lambda: assert_photo_markup(html.replace('--mc-photo-ratio:1600 / 1066', '--mc-photo-ratio:1600 / 1000', 1)), 'Changed full-composition ratio rejects')
reject(lambda: assert_photo_markup(html.replace(photo_sizes, photo_sizes.replace('820px', '760px'), 1)), 'Wrong responsive breakpoint rejects')
reject(lambda: assert_photo_markup(html.replace('data-stock-id="501653292"', 'data-stock-id="UNAPPROVED"', 1)), 'Unknown photo identity rejects')
reject(lambda: assert_photo_markup(html.replace('Illustrative photography · Models shown', 'Actual customer results', 1)), 'False/unqualified customer photo claim rejects')

def element(text, tag, pattern):
    start, depth = None, 0
    for m in re.finditer(r'<' + tag + r'\b[^>]*>|</' + tag + r'\s*>', text, re.I):
        if start is None:
            if m[0].startswith('</') or not re.search(pattern, m[0]):
                continue
            start, depth = m.start(), 1
        elif m[0].startswith('</'):
            depth -= 1
            if depth == 0:
                return text[start:m.end()]
        else:
            depth += 1
    raise AssertionError('Required balanced ' + tag)

for tag, pattern in [('header', r'id="siteHeader"'), ('footer', r'class="footer mond-footer"'),
        ('div', r'class="hero-copy"'), ('aside', r'data-home-report-quad')]:
    check(element(html, tag, pattern) == element(old_html, tag, pattern), 'Protected brand/access/sample ' + pattern)
for tag, pattern in [('section', r'class="hero"'), ('section', r'class="mr-scenario"'),
        ('section', r'class="measurement-loop"'), ('section', r'id="approach"'), ('section', r'class="first-run-moments"'),
        ('section', r'id="see-it"'), ('section', r'id="verify"'), ('section', r'class="systems-analysis-bridge"'),
        ('div', r'class="home-output-copy"'), ('aside', r'class="home-workspace-preview"'),
        ('section', r'id="book"'), ('section', r'id="latest"'), ('section', r'id="connect"')]:
    check(element(html, tag, pattern) == element(old_html, tag, pattern), 'Exact original content/evidence/learning/publication ' + pattern)
scripts = lambda text: re.findall(r'<script\b[\s\S]*?</script>', text, re.I)
check([s for s in scripts(html) if 'src="marketing-completion.js' not in s] == scripts(old_html), 'Every original executable/structured metadata script exact/order')
check(sum('src="marketing-completion.js' in s for s in scripts(html)) == 1, 'Exactly one new local enhancement script')
js, css = read('marketing-completion.js').decode(), read('marketing-completion.css').decode()
check(not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|sendBeacon\s*\(|localStorage|sessionStorage|document\.cookie|supabase|stripe', js, re.I), 'Presentation has no network/storage/identity/payment/tracking calls')
check(not re.search(r'@import\b|@font-face\b|https?://', css, re.I), 'No remote stylesheet/new font body')
# October 13, 2026: one scoped physical pixel preserves the original strict44px touch assertion.
hero_touch_margin_block = "/* Keep a real pixel of margin above the hero sample link's 44px touch minimum. */\nbody.homepage-enterprise.marketing-refresh .hero [data-home-report-quad] .hrq-footer > a { min-height: 45px; }\n"
def assert_hero_touch_margin(source):
    assert source.count(hero_touch_margin_block) == 1, 'Exactly one approved homepage hero touch-margin rule'
    assert sha(source.replace(hero_touch_margin_block, '', 1).encode()) == '34a023e0c6c5771f3ec6b243f82b3b9026ad3ede3fe1d6b4b0187e3f0ac8927e', 'Removing only the reviewed rule restores every publishedV4 CSS byte'
assert_hero_touch_margin(css)
checks += 2
for mutant in [css.replace(hero_touch_margin_block, '', 1), css.replace(hero_touch_margin_block, hero_touch_margin_block * 2, 1), *[css.replace(hero_touch_margin_block, hero_touch_margin_block.replace('45px', value), 1) for value in ['43px', '44px', '46px']], css.replace(hero_touch_margin_block, hero_touch_margin_block.replace(' .hero [data-home-report-quad]', ''), 1), css.replace(hero_touch_margin_block, hero_touch_margin_block.replace('min-height: 45px;', 'min-height: 45px; display: none;'), 1), css.replace(hero_touch_margin_block, '@media (min-width: 1440px) {\n' + hero_touch_margin_block + '}\n', 1), css.replace(hero_touch_margin_block, hero_touch_margin_block.replace('min-height: 45px;', 'min-height: 45px; transform: scale(.99);'), 1), css + 'body { color: red; }\n']:
    reject(lambda mutant=mutant: assert_hero_touch_margin(mutant), 'Deleted, duplicate, altered, broadened, conditional, hidden, scaled or unrelated CSS rejects')
check('@media (max-width: 820px)' in css, 'Source sizes match actual responsive photo breakpoint')
check(sum(len(read(f)) for f in ['marketing-refresh.css', 'marketing-refresh.js', 'marketing-completion.css', 'marketing-completion.js']) <= 64 * 1024, 'Combined local presentation CSS/JS64KiB bound')
photo_assets = [f for f in ADDITIONS if f.startswith('assets/marketing/')]
check(len(photo_assets) >= 3, 'Three separately pinned photographic derivatives')
expected_photo_names = sorted(Path(f).name for f in photo_assets)
def assert_photo_directory(names):
    assert sorted(names) == expected_photo_names, 'Only exact approved derivatives in directory, including ignored files'
assert_photo_directory(photo_names_at_marketing_photo_presentation_baseline(p.name for p in (ROOT / 'assets/marketing').iterdir()))
checks += 1
reject(lambda: assert_photo_directory(expected_photo_names + ['iStock-original.jpg']), 'Ignored/untracked stock original cannot enter the build directory')
reject(lambda: assert_photo_directory(expected_photo_names[1:]), 'Missing derivative rejects')
register = json.loads(read('docs/marketing-photo-register-20261013.json'))
def approval_boundary(value):
    assert value['status'] == 'OWNER_APPROVED_LICENSED_WEBSITE_DERIVATIVES'
    assert value['privateOriginalsPublished'] is False
    assert value['minimumHomepageGroupPhotographs'] == 3
    assert isinstance(value['photos'], list)
    assert [str(p['id']) for p in value['photos']] == ['501653292', '488892667', '524156476']
    for p in value['photos']:
        assert p['ownerApproved'] is True
        assert p['approvalDate'] == '2026-10-13'
        assert p['rightsStatus'] == 'owner-approved-licensed-site-use'
        assert isinstance(p['humanProvenanceEvidence'], dict)
approval_boundary(register)
checks += 1
def altered_register(field, value, photo=False):
    result = json.loads(json.dumps(register))
    (result['photos'][0] if photo else result)[field] = value
    return result
for field, value, photo in [('status', 'PENDING', False), ('privateOriginalsPublished', True, False),
        ('minimumHomepageGroupPhotographs', 2, False), ('id', 'UNREVIEWED', True), ('ownerApproved', False, True),
        ('approvalDate', 'UNREVIEWED', True), ('rightsStatus', 'CC0', True), ('humanProvenanceEvidence', None, True)]:
    reject(lambda f=field, v=value, p=photo: approval_boundary(altered_register(f, v, p)), 'Changed/missing approval, provenance or license basis rejects')
mutant = json.loads(json.dumps(register))
mutant['photos'].pop()
reject(lambda: approval_boundary(mutant), 'Missing selected group photograph rejects')
check(register['schemaVersion'] == 1, 'Public photo register schema')
check(register['status'] == 'OWNER_APPROVED_LICENSED_WEBSITE_DERIVATIVES', 'Actual owner-approved licensed site-use, not CC0')
check(register['privateOriginalsPublished'] is False, 'Stock originals not published')
check(register['minimumHomepageGroupPhotographs'] == 3, 'Approved minimum three group photos')
check(isinstance(register['photos'], list) and len(register['photos']) >= 3, 'At least three genuine group photos')
check(len({p['id'] for p in register['photos']}) == len(register['photos']), 'Distinct asset identities')
registered = []
for photo in register['photos']:
    check(photo['ownerApproved'] is True, 'Every exact selected photo approved by owner')
    check(photo['approvalDate'] == '2026-10-13', 'Actual owner approval date')
    check(photo['rightsStatus'] == 'owner-approved-licensed-site-use', 'Truthful licensed site-use basis')
    for field in ['sourcePage', 'creator', 'licenseURL', 'adultSourceEvidence', 'rightsBasis',
            'modelPropertyPermissionEvidence', 'repositoryUseEvidence', 'placement']:
        check(isinstance(photo[field], str) and bool(photo[field].strip()), 'Public factual evidence: ' + field)
    check(isinstance(photo['humanProvenanceEvidence'], dict), 'Factual photographic provenance object')
    check(bool(photo['humanProvenanceEvidence'].get('providerDatedUpload')), 'Exact dated provider upload evidence')
    check(bool(photo['humanProvenanceEvidence'].get('statement')), 'Qualified human-provenance statement')
    check(isinstance(photo['derivatives'], list) and len(photo['derivatives']) == 4, 'Three WebP variants plus JPEG fallback')
    for d in photo['derivatives']:
        check(d['path'] in photo_assets, 'Exact independently pinned public derivative')
        check(d['sha256'] == sha(read(d['path'])), 'Actual derivative byte identity')
        check(d['bytes'] == len(read(d['path'])), 'Actual derivative byte length')
        check(type(d['width']) is int and d['width'] > 0 and type(d['height']) is int and d['height'] > 0, 'Positive explicit dimensions')
        check(d['path'] in html, 'Each derivative in actual src/srcset')
        registered.append(d['path'])
check(sorted(set(registered)) == sorted(photo_assets), 'Every photographic addition individually registered; no collection/original')
forbidden_keys = {'password', 'accessToken', 'refreshToken', 'apiKey', 'cookie', 'accountId', 'receiptPath', 'privateRelease', 'rawOriginalPath'}
def public_keys(value):
    if isinstance(value, dict):
        for key, item in value.items():
            assert key not in forbidden_keys, 'No private credential/account/release field'
            public_keys(item)
    elif isinstance(value, list):
        for item in value:
            public_keys(item)
public_keys(register)
checks += 1
check([str(p['id']) for p in register['photos']] == ['501653292', '488892667', '524156476'], 'Only selected owner-approved group photos')
check(sorted({str(p['id']) for p in register['unusedApprovedAssets']}) == ['511990984', '541113838'], 'Remaining approved assets truthfully unused')
check('not Monderman-owned copyright' in register['licenseNotice'] and 'independent reuse' in register['licenseNotice'], 'Public copyright/reuse limitation')
check(len(photo_assets) == 12, 'Exactly twelve display derivatives; no originals')
check(all(len(read(f)) <= 200000 for f in photo_assets), 'Each derivative within200KB')
check(sum(len(read(f)) for f in photo_assets) == register['assetBudget']['totalDerivativeBytes'], 'Actual total asset byte budget')
check('assets/marketing' in read('scripts/render-static-build.sh').decode(), 'Build explicitly copies approved derivative directory')
if '--built' in sys.argv:
    publish = ROOT / '.render-public'
    assert_photo_directory(p.name for p in (publish / 'assets/marketing').iterdir())
    checks += 1
    for file in photo_assets:
        check((publish / file).read_bytes() == read(file), file + ': actual built photograph bytes')
    for file in footer_pages:
        built = (publish / file).read_text()
        check(len(re.findall(r'<footer\b', built)) == 1, file + ': actual built footer cardinality')
        check('Clearer Insight. Stronger Performance.' in built, file + ': actual canonical built footer')
    import os
    check(json.loads((publish / '.well-known/monderman-release.json').read_bytes())['revision'] == os.environ.get('RENDER_GIT_COMMIT'), 'Actual built release identity')
print(json.dumps({'ok': True, 'checks': checks, 'negativeControls': negative_controls, 'finiteFiles': len(expected_files),
    'hunks': hunks, 'immutableFiles': immutable_files, 'oldFixtures': old_fixtures, 'pdfs': pdfs,
    'photos': len(register['photos']), 'photoAssets': len(photo_assets), 'previousAssistantCalls': len(prior_assistant_calls), 'previousDiscoveryCalls': len(original_discovery_calls), 'built': '--built' in sys.argv}))
