"""Independent offline Python boundary for the scoped marketing approval and UTF-16 inverse."""
import hashlib
import json
from pathlib import Path
from homepage_refinement_20261014_inverse import source_paths_at_homepage_refinement_baseline
import re
import subprocess
from marketing_photo_presentation_20261013_inverse import ADDITIONS as PHOTO_PRESENTATION_ADDITIONS, GUARD_FILES as PHOTO_PRESENTATION_GUARD_FILES
from marketing_completion_20261013_inverse import source_at_marketing_completion_baseline, ADDITIONS as COMPLETION_ADDITIONS, GUARD_FILES as COMPLETION_GUARD_FILES
from marketing_refresh_20261012_inverse import (
    BASELINE, VERSION, FIXTURE_SHA256, _fixture,
    source_before_marketing_refresh_20261012 as strict,
    source_at_marketing_refresh_baseline as conditional,
)
ROOT = Path(__file__).resolve().parents[1]
sha = lambda value: hashlib.sha256(value).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args], cwd=ROOT)
read = lambda file: source_at_marketing_completion_baseline(file, (ROOT / file).read_bytes())
tracked = git('ls-tree', '-r', '--name-only', BASELINE).decode().splitlines()
batch = subprocess.check_output(['git', 'cat-file', '--batch'], cwd=ROOT,
    input=''.join(BASELINE + ':' + file + '\n' for file in tracked).encode())
baseline_bytes, offset = {}, 0
for file in tracked:
    line_end = batch.index(b'\n', offset)
    header = batch[offset:line_end].decode()
    assert re.fullmatch(r'[0-9a-f]{40} blob \d+', header), 'Exact baseline Git blob frame'
    length = int(header.split()[2])
    offset = line_end + 1
    baseline_bytes[file] = batch[offset:offset + length]
    offset += length
    assert batch[offset:offset + 1] == b'\n', 'Exact baseline blob framing'
    offset += 1
assert offset == len(batch), 'Complete baseline Git blob batch'
prior = lambda file: baseline_bytes[file]
checks = negative_controls = hunks = 0

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

existing = ['index.html', 'public-search-index.json',
    'scripts/book_publication_date_20261011_inverse.mjs', 'scripts/book_publication_date_20261011_inverse.py',
    'scripts/book_publication_date_20261011_contract.mjs', 'scripts/book_publication_date_20261011_contract.py',
    'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/homepage_card_rhythm_smoke.mjs', 'scripts/site_system_visual_smoke.mjs',
    'scripts/sample_marketing_language_hover_smoke.mjs', 'scripts/homepage_workspace_demo_smoke.mjs',
    'scripts/methodology_business_copy_smoke.mjs', 'scripts/sample_tile_smoke.mjs', '.github/workflows/frontend-release.yml',
    '.github/workflows/sample-report-marketing-certification.yml', 'scripts/homepage_assistant_smoke.mjs']
guards = ['scripts/marketing_refresh_20261012_inverse.mjs', 'scripts/marketing_refresh_20261012_inverse.py',
    'scripts/marketing_refresh_20261012_contract.mjs', 'scripts/marketing_refresh_20261012_contract.py',
    'scripts/fixtures/marketing-refresh-20261012.json']
check(BASELINE == '14e57bb9f5537cd7ed5eb581cbc7740541c593b1', 'Exact deployed public baseline')
check(VERSION == 'marketing-refresh-20261012.1', 'Independent approval version')
check(list(_fixture['files']) == existing, 'Exact sixteen existing-file whitelist')
check(_fixture.get('provisional') is False, 'Only the final reviewed source snapshot can pass this full contract')
check(_fixture['guardFiles'] == guards, 'Five new guard files only')
check(git('rev-parse', BASELINE + '^{tree}').decode().strip() == _fixture['baselineTree'], 'Authoritative baseline Git tree')
for file in existing:
    entry = _fixture['files'][file]
    current, before = read(file), prior(file)
    check(sha(current) == entry['after_sha256'], file + ': complete reviewed current pin')
    check(sha(before) == entry['before_sha256'], file + ': complete baseline pin')
    for source in (current, current.decode('utf-8')):
        expected = before if isinstance(source, bytes) else before.decode('utf-8')
        check(strict(file, source) == expected and type(strict(file, source)) is type(source), file + ': strict full inverse and type')
        check(conditional(file, source) == expected and type(conditional(file, source)) is type(source), file + ': conditional full inverse and type')
        check(conditional(file, expected) == expected, file + ': baseline never double-inverted')
    utf16 = current.decode('utf-8').encode('utf-16-le')
    mutants = [current + b'\n', b'UNREVIEWED' + current, b'!' + current[1:], before,
        current + b'<script>fetch("https://api.monderman.com/api/scoring",{method:"POST"})</script>']
    previous_end = 0
    for start, end, now, old in entry['replacements']:
        check(type(start) is int and type(end) is int and previous_end <= start <= end, file + ': ordered finite UTF-16 hunk')
        check(isinstance(now, str) and isinstance(old, str), file + ': hunk text types')
        check(utf16[start * 2:end * 2].decode('utf-16-le') == now, file + ': exact finite current hunk')
        previous_end = end
        mutants.append((utf16[:start * 2] + 'UNREVIEWED'.encode('utf-16-le') + utf16[end * 2:]).decode('utf-16-le').encode('utf-8'))
        hunks += 1
    for mutant in mutants:
        reject(lambda m=mutant: strict(file, m), file + ': unknown hunk/append/prefix/API injection/double inverse rejected')
        check(conditional(file, mutant) == mutant, file + ': unknown complete source remains visible')
immutable_files = historical_fixtures = pdfs = 0
for file in tracked:
    if file in existing:
        continue
    check(read(file) == prior(file), file + ': every other baseline source/artifact byte unchanged')
    immutable_files += 1
    historical_fixtures += int(file.startswith('scripts/fixtures/'))
    pdfs += int(file.endswith('.pdf'))
additions = _fixture['additions']

def assert_addition(file, value):
    assert sha(value) == additions[file]['sha256'], file + ': exact reviewed new file pin'
    assert len(value) == additions[file]['bytes'], file + ': exact new file size'

for file in additions:
    check(file not in tracked and file not in guards, file + ': separately visible addition')
    check(file in ['marketing-refresh.css', 'marketing-refresh.js', 'scripts/marketing_refresh_browser_smoke.mjs', 'docs/marketing-refresh-20261012.md'] or bool(re.fullmatch(r'assets/marketing/[A-Za-z0-9._/-]+\.(?:avif|webp|jpe?g|png)', file, re.I)), file + ': only scoped code/public summary/photo derivatives; no archive, release receipt, font or engine')
    check(not file.startswith('/') and '..' not in Path(file).parts, file + ': safe source path')
    value = read(file)
    assert_addition(file, value)
    checks += 2
    check(strict(file, value) == value and conditional(file, value) == value, file + ': never normalize addition to empty')
    reject(lambda f=file, v=value: assert_addition(f, v + b'UNREVIEWED'), file + ': mutated addition rejected')
for file in ['marketing-refresh.css', 'marketing-refresh.js', 'scripts/marketing_refresh_browser_smoke.mjs']:
    check(file in additions, file + ': required local presentation/browser proof')
known = set(tracked + list(additions) + guards + list(COMPLETION_ADDITIONS) + list(COMPLETION_GUARD_FILES) + list(PHOTO_PRESENTATION_ADDITIONS) + list(PHOTO_PRESENTATION_GUARD_FILES))
cached = git('ls-files', '--cached').decode().splitlines()
paths = set(cached + git('ls-files', '--others', '--exclude-standard').decode().splitlines())
paths = {p for p in paths if (ROOT / p).exists() and not (p == 'node_modules' and p not in cached and (ROOT / p).is_symlink())}
paths = source_paths_at_homepage_refinement_baseline(paths)

def assert_scope(values):
    for file in values:
        assert file in known, file + ': unknown source addition rejected'

assert_scope(paths)
checks += len(paths)
reject(lambda: assert_scope(paths | {'unexpected-publication.js'}), 'No automatically approved unknown new file')
reject(lambda: assert_scope(paths | {'node_modules'}), 'A source file named node_modules has no runtime exemption')
check(not (ROOT / '.github/workflows/marketing-visual-review.yml').exists(), 'Temporary source archive workflow removed')
check(not any(re.search(r'marketing-source\.tgz|marketing-review-source\.zip|(?:^|/)AGENTS\.md$', p) for p in paths), 'No repository archive or private instructions added')
for file in ['unknown.js', '__proto__', 'constructor', 'toString', 'workspace.html', 'pattern-trial.html', *additions]:
    for source in ('Unlisted source 😀', 'Unlisted source 😀'.encode('utf-8')):
        check(strict(file, source) == source and type(strict(file, source)) is type(source), file + ': unlisted strict identity/type')
        check(conditional(file, source) == source and type(conditional(file, source)) is type(source), file + ': unlisted conditional identity/type')

def element(source, tag, pattern):
    start, depth = None, 0
    for m in re.finditer(r'<' + tag + r'\b[^>]*>|</' + tag + r'\s*>', source, re.I):
        if start is None:
            if m[0].startswith('</') or not re.search(pattern, m[0]):
                continue
            start, depth = m.start(), 1
        elif m[0].startswith('</'):
            depth -= 1
            if depth == 0:
                return source[start:m.end()]
        else:
            depth += 1
    raise AssertionError('Required balanced protected ' + tag + ' region')

html, old = read('index.html').decode(), prior('index.html').decode()
for tag, pattern in [('header', r'id="siteHeader"'), ('footer', r'class="footer mond-footer"'),
        ('div', r'class="hero-copy"'), ('aside', r'data-home-report-quad'), ('section', r'class="measurement-loop"'), ('section', r'id="approach"'),
        ('section', r'class="first-run-moments"'), ('section', r'id="see-it"'), ('section', r'id="verify"'),
        ('section', r'class="systems-analysis-bridge"'), ('div', r'class="home-output-copy"'), ('aside', r'class="home-workspace-preview"'), ('section', r'id="book"'),
        ('section', r'id="latest"'), ('section', r'id="connect"')]:
    check(element(html, tag, pattern) == element(old, tag, pattern), pattern + ': exact protected copy/data/destinations')
hero, old_hero = element(html, 'section', r'class="hero"'), element(old, 'section', r'class="hero"')
hero_aside = element(hero, 'aside', r'data-home-report-quad')
wrapper = '<div class="mr-proof-composition">\n<p class="mr-proof-label">Sample report · Example data</p>\n'
check(hero.count(wrapper) == 1 and hero.count(hero_aside + '\n</div>') == 1, 'One exact sample-label wrapper around unchanged report')
check(hero.replace(wrapper, '').replace(hero_aside + '\n</div>', hero_aside) == old_hero, 'Every original hero byte recovered after exact wrapper only')
scripts = lambda value: re.findall(r'<script\b[^>]*>[\s\S]*?</script>', value)
new_script = '<script src="marketing-refresh.js?v=20261012.1" defer></script>'
check(scripts(html).count(new_script) == 1, 'One exact local deferred presentation script')
check([x for x in scripts(html) if x != new_script] == scripts(old), 'Original inline/external/SEO scripts unchanged')
metas = lambda value: re.findall(r'<(?:meta|link)\b[^>]*>', value)
new_style = '<link rel="stylesheet" href="marketing-refresh.css?v=20261012.1">'
check(metas(html).count(new_style) == 1, 'One exact local scoped stylesheet')
check([x for x in metas(html) if x != new_style] == metas(old), 'Original SEO/fonts/stylesheets unchanged')
check(re.search(r'<body[^>]*>', html)[0] == '<body class="canonical-green-shell homepage-enterprise marketing-refresh">', 'One homepage-scoped class')
scenario = element(html, 'section', r'data-marketing-scenario')
check('Qualitative illustration · Not a scored result or customer case' in scenario, 'Visible illustration/sample boundary')
check(not re.search(r'\d|\$|%', re.sub(r'<[^>]*>', '', scenario)), 'New lens copy invents no numerical score/saving')
check(re.findall(r'\bhref="([^"]+)"', scenario) == ['#mr-panel-clarity', '#mr-panel-velocity', '#mr-panel-systems', '#mr-panel-performance', 'structural-clarity-article.html', 'decision-velocity-article.html', 'operational-systems-article.html', 'institutional-performance-article.html'], 'Only local tab anchors and four existing explanatory destinations')
check(not re.search(r'<form\b|\bon[a-z]+\s*=|\baction\s*=|\bdata-(?:score|evaluation|campaign|engine)\b', scenario, re.I), 'No form, inline event or product engine hook added')
for key, label, terms, url in [
    ('clarity', 'Structural Clarity', ['Ownership ambiguity', 'Authority blur', 'Handoff diffusion', 'Compensatory structure'], 'structural-clarity-article.html'),
    ('velocity', 'Decision Velocity', ['Waiting for review', 'Repeated review', 'Escalation dependence', 'Decision reopening'], 'decision-velocity-article.html'),
    ('systems', 'Operational Systems', ['Duplicate entry', 'Repeated reporting', 'Coordination work', 'Administrative effort'], 'operational-systems-article.html'),
    ('performance', 'Institutional Performance', ['Reliability', 'Coherence', 'Adaptability', 'Compensatory effort'], 'institutional-performance-article.html')]:
    panel = element(scenario, 'section', r'id="mr-panel-' + key + r'"')
    check(label in panel and all(t in panel for t in terms), key + ': distinct actual operating questions')
    check('<details' in panel and '<summary>' in panel and 'href="' + url + '"' in panel, key + ': native expansion and real destination')
    check(not re.match(r'<section[^>]*\bhidden\b', panel), key + ': usable static fallback')
    check(len(re.findall(r'data-lens-choice="' + key + r'"', scenario)) == 1, key + ': one local selector')
check('It is not a score assembled from Structural Clarity, Decision Velocity and Operational Systems.' in scenario, 'Institutional Performance is not invented aggregation')
js, css = read('marketing-refresh.js').decode(), read('marketing-refresh.css').decode()

def assert_local_runtime(value):
    assert not re.search(r'\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(|\b(?:localStorage|sessionStorage)\b|document\.cookie|https?://|supabase|stripe|(?:score|scoring|evaluate|diagnostic)\s*\(', value, re.I), 'New runtime must stay presentation-only'

assert_local_runtime(js)
checks += 1
reject(lambda: assert_local_runtime(js + '\nfetch("https://api.monderman.com/api/scoring",{method:"POST"})'), 'Malicious production API runtime rejected')
check("document.querySelector('body.marketing-refresh [data-lens-demo]')" in js, 'Local scoped demo root')
for key in ['aria-selected', 'aria-controls', 'tabpanel', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'moveFocus', 'tab.hash', 'data-enhanced']:
    check(key in js, 'Keyboard/runtime boundary ' + key)
check(not re.search(r'setInterval|requestAnimationFrame|\.scrollTo\(|\.scrollIntoView\(|wheel|touchmove', js), 'No scrolling control/continuous loop')
def assert_scoped_css(source):
    source = re.sub(r'/\*[\s\S]*?\*/', '', source)
    cursor = 0
    while cursor < len(source):
        opening = source.find('{', cursor)
        if opening < 0:
            assert not source[cursor:].strip(), 'No stray CSS source'
            break
        rule = source[cursor:opening].strip()
        depth, end, quote = 1, opening + 1, None
        while end < len(source) and depth:
            c = source[end]
            if quote:
                if c == quote and source[end - 1] != '\\':
                    quote = None
            elif c in '\"\'':
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            end += 1
        assert depth == 0, 'Balanced scoped CSS rule'
        body = source[opening + 1:end - 1]
        if rule.startswith('@'):
            assert re.match(r'^@(?:media|supports)\b', rule), 'Only local conditional CSS groups'
            assert_scoped_css(body)
        else:
            parts, part, nested = [], '', 0
            for c in rule:
                if c in '([':
                    nested += 1
                if c in ')]':
                    nested -= 1
                if c == ',' and nested == 0:
                    parts.append(part)
                    part = ''
                else:
                    part += c
            parts.append(part)
            assert all(p.strip().startswith('body.homepage-enterprise.marketing-refresh') for p in parts), 'Every selector remains scoped'
        cursor = end

assert_scoped_css(css)
checks += 1
reject(lambda: assert_scoped_css(css + '\n@media (max-width:600px){button{display:none}}'), 'Global conditional CSS selector rejected')
check('prefers-reduced-motion' in css, 'Reduced-motion path')
check(not re.search(r'@import|url\(\s*["\']?https?://', css, re.I), 'No remote CSS import/image')
check(len(css.encode()) + len(js.encode()) <= _fixture['assetBudget']['cssAndJsBytesMax'], 'New CSS/JS byte budget')

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
    for match in re.finditer(r'\b(?:assert(?:\.[A-Za-z]+)?|check|equal|eq|assertCompactHeight|assertAssumptionsText|assertReadingGuide|assertReadablePreview|assertEnlargedOverview|assertExpandedHeight|assertRefreshedJourneyGeometry|assertCurrentEditorialSequence)\s*\(', text):
        depth, end = 1, match.end()
        while end < len(text) and depth:
            depth += int(text[end] == '(') - int(text[end] == ')')
            end += 1
        assert depth == 0, 'Balanced original guard call'
        out.append('\n'.join(line.strip() for line in source[match.start():end].split('\n')))
    return out

def assert_preserved_guard(file, source):
    original, current = guard_calls(prior(file).decode()), guard_calls(source)
    assert original, file + ': original assertion inventory is nonempty'
    at = 0
    for statement in original:
        expected = statement.replace('geometry.titleX - expectedRailX(geometry.clientWidth)', 'geometry.titleX - railX') if file.endswith('site_system_visual_smoke.mjs') else statement
        matches = [i for i in range(at, len(current)) if current[i] == expected]
        assert matches, file + ': every original assertion remains in order'
        at = matches[0] + 1
    assert re.search(r'\bedition\s*===\s*[\"\']baseline[\"\']', source), file + ': original homepage edition still rendered'
    assert re.search(r'\bsourceAtMarketingRefreshBaseline\s*\(\s*[\"\']index\.html[\"\']\s*,', source), file + ': original render comes from the exact homepage inverse'
    return original

original_layout_calls = 0
for file in ['scripts/homepage_card_rhythm_smoke.mjs', 'scripts/site_system_visual_smoke.mjs', 'scripts/sample_marketing_language_hover_smoke.mjs', 'scripts/homepage_workspace_demo_smoke.mjs', 'scripts/methodology_business_copy_smoke.mjs', 'scripts/sample_tile_smoke.mjs', 'scripts/homepage_assistant_smoke.mjs']:
    source = read(file).decode()
    original = assert_preserved_guard(file, source)
    checks += len(original) + 3
    original_layout_calls += len(original)
    candidates = [s.replace('geometry.titleX - expectedRailX(geometry.clientWidth)', 'geometry.titleX - railX') if file.endswith('site_system_visual_smoke.mjs') else s for s in original]
    target = next((s for s in candidates if source.count(s) == 1), None)
    check(target is not None, file + ': real original-call mutation target exists')
    reject(lambda: assert_preserved_guard(file, source.replace(target, 'void 0', 1)), file + ': removed original assertion rejected')
    reject(lambda: assert_preserved_guard(file, source.replace(target, '/* ' + target + ' */', 1)), file + ': comment cannot replace an actual assertion')
# Preserve the actual additional rejection hooks, independently of their pins.
geometry_negative_hooks = 0
for file, helper, count in [
    ('scripts/sample_tile_smoke.mjs', 'assertReadablePreview', 1),
    ('scripts/sample_marketing_language_hover_smoke.mjs', 'assertEnlargedOverview', 1),
    ('scripts/homepage_workspace_demo_smoke.mjs', 'assertExpandedHeight', 2),
    ('scripts/methodology_business_copy_smoke.mjs', 'assertRefreshedJourneyGeometry', 2),
]:
    source = read(file).decode()
    def negative_hooks(value):
        return [call for call in guard_calls(value) if call.startswith('assert.throws(') and '()=>'+helper+'(' in call]
    def require_hooks(value):
        assert len(negative_hooks(value)) == count, file + ': every current geometry rejection hook remains executable'
    require_hooks(source)
    checks += 1
    geometry_negative_hooks += count
    for hook in negative_hooks(source):
        check(source.count(hook) == 1, file + ': unique current geometry-hook mutation target')
        reject(lambda: require_hooks(source.replace(hook, 'void 0', 1)), file + ': removed current geometry negative hook rejected')
        reject(lambda: require_hooks(source.replace(hook, '/* '+hook+' */', 1)), file + ': commented current geometry negative hook rejected')
# Editorial rejection hooks are separate from the unchanged geometry inventory.
assistant_file = 'scripts/homepage_assistant_smoke.mjs'
assistant_source = read(assistant_file).decode()
assistant_proof = 'assertCurrentEditorialSequence(editorial.visibleSections, scene)'
assistant_projection = 'editorial.visibleSections = [editorial.visibleSections[0], ...editorial.visibleSections.slice(2)];'
def editorial_hooks(value):
    return [call for call in guard_calls(value) if call.startswith('assert.throws(') and re.search(r'\(\)\s*=>\s*assertCurrentEditorialSequence\(', call)]
def require_assistant_editorial_proof(source):
    assert assistant_proof in guard_calls(source), 'Assistant live current sequence proof remains an executed call'
    assert source.find(assistant_projection) >= 0 and source.find(assistant_proof) < source.find(assistant_projection), 'Assistant exact proof precedes its finite index1 projection'
    assert "for (edition of ['baseline', 'current'])" in source, 'Both exact historical and current assistant editions execute'
    assert len(editorial_hooks(source)) == 2, 'Both actual editorial rejection loops remain executable'
require_assistant_editorial_proof(assistant_source)
checks += 4
editorial_negative_hooks = len(editorial_hooks(assistant_source))
for target in [assistant_proof, *editorial_hooks(assistant_source)]:
    check(assistant_source.count(target) == 1, 'Unique assistant editorial proof/rejection mutation target')
    reject(lambda: require_assistant_editorial_proof(assistant_source.replace(target, 'void 0', 1)), 'Removed assistant editorial proof/rejection hook rejected')
    reject(lambda: require_assistant_editorial_proof(assistant_source.replace(target, '/* '+target+' */', 1)), 'Commented assistant editorial proof/rejection hook rejected')
reject(lambda: require_assistant_editorial_proof(assistant_source.replace("for (edition of ['baseline', 'current'])", "for (edition of ['current'])", 1)), 'Omitting exact historical assistant execution is rejected')
reject(lambda: require_assistant_editorial_proof(assistant_source.replace(assistant_proof, 'void 0', 1).replace(assistant_projection, assistant_projection+'\n'+assistant_proof, 1)), 'Moving the finite projection before current proof is rejected')
index, old_index = json.loads(read('public-search-index.json')), json.loads(prior('public-search-index.json'))
check(len(index) == len(old_index), 'Search inventory unchanged')
check([x for x in index if x['url'] != 'index.html'] == [x for x in old_index if x['url'] != 'index.html'], 'All unrelated search records unchanged')
current_home, old_home = [x for x in index if x['url'] == 'index.html'], [x for x in old_index if x['url'] == 'index.html']
check(len(current_home) == len(old_home) == 1, 'One current homepage search record')
check({k:v for k,v in current_home[0].items() if k not in ['text', 'headings']} == {k:v for k,v in old_home[0].items() if k not in ['text', 'headings']}, 'Search URL/title/category and other metadata unchanged')
new_headings = 'The same work. Different questions. Who owns the work between the steps? Where does the decision wait? What work does the process create? What does reliable delivery depend on?'
check(old_home[0]['headings'].count('Evidence Compare results on the same basis.') == 1, 'Unique search heading insertion anchor')
check(current_home[0]['headings'] == old_home[0]['headings'].replace('Evidence Compare results on the same basis.', 'Evidence ' + new_headings + ' Compare results on the same basis.'), 'Only five authored new headings inserted; all old headings unchanged')
photos = _fixture['photography']
photography_ready = photos.get('publicationCleared') is True and isinstance(photos.get('photos'), list) and len(photos['photos']) == 2
photography_blocked = photos.get('publicationCleared') is False and photos.get('photographyBlocked') is True and photos.get('photos') == [] and photos.get('derivatives') == [] and isinstance(photos.get('blocker'), str) and bool(photos['blocker'].strip())
check(photography_ready or photography_blocked, 'Two cleared real photos or explicit empty nonimage continuation')
if photography_blocked:
    check(not any(re.match(r'assets/marketing/.+\.(?:avif|webp|jpe?g|png)$', p, re.I) for p in additions), 'No unapproved derivative in nonimage source')
    check(not re.search(r'Illustrative photography|data-marketing-photo', html), 'No placeholder photo presented as published')
photo_bytes = 0
if photography_ready:
    check(len({p['sourceURL'] for p in photos['photos']}) == 2, 'Two distinct approved photo identities')
    derivatives = [f for p in photos['photos'] for f in p['files']]
    check(len(set(derivatives)) == len(derivatives), 'No duplicate derivative counted twice')
    check(sorted(p for p in additions if re.match(r'assets/marketing/.+\.(?:avif|webp|jpe?g|png)$', p, re.I)) == sorted(derivatives), 'Only pair derivatives are public image additions')
for photo in photos['photos']:
    for field in ['sourceURL', 'licenseURL', 'creator', 'placement', 'modelPropertyReview', 'attributionReview', 'restrictionsReview']:
        check(isinstance(photo.get(field), str) and bool(photo[field].strip()), 'Reviewed photo source/restrictions ' + field)
    check(photo['sourceURL'].startswith('https://') and photo['licenseURL'].startswith('https://'), 'Exact source/license URLs')
    for field in ['commercialUseAllowed', 'adaptationAllowed', 'humanPhotographVerified']:
        check(photo.get(field) is True, 'Reviewed affirmative clearance ' + field)
    check(isinstance(photo.get('files'), list) and bool(photo['files']), 'Pinned published derivative list')
    for file in photo['files']:
        check(file in additions and bool(re.match(r'assets/marketing/.+\.(?:avif|webp|jpe?g|png)$', file, re.I)), 'Exact approved local photo derivative')
        check(file in html, 'Photo derivative actually placed in authored homepage')
        photo_bytes += len(read(file))
check(photo_bytes <= _fixture['assetBudget']['photoBytesMax'], 'Exact two-photo total byte budget')
if photography_ready:
    check(html.count('Illustrative photography') >= 2, 'Both visible photography boundaries')
print(json.dumps({'ok':True, 'checks':checks, 'negativeControls':negative_controls, 'files':len(existing), 'hunks':hunks,
    'additions':len(additions), 'immutableFiles':immutable_files, 'historicalFixtures':historical_fixtures, 'pdfs':pdfs,
    'fixtureSha256':FIXTURE_SHA256, 'originalLayoutCalls':original_layout_calls, 'geometryNegativeHooks':geometry_negative_hooks, 'editorialNegativeHooks':editorial_negative_hooks, 'photoBytes':photo_bytes, 'photographyReady':photography_ready,
    'sourceReady':True, 'nonImagePublicationReady':True, 'photographyBlocked':photography_blocked, 'assignmentComplete':photography_ready, 'networkCalls':0, 'productionWrites':0,
    'photographyBlocker':photos['blocker'] if photography_blocked else None}))
