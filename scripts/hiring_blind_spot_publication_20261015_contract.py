"""Preserved article-only assertions on exact recovered1858 historical inputs.

The mandatory post1858 guard first audits every actual current source and
compiled body, plus all new article/series/topic behavior. The read adapters
below are exact finite historical views; they are not current-byte fallback.
"""
from hiring_work_design_series_20261017_contract import audit_current_release,historical_read,historical_git,historical_public_read,historical_public_names
audit_current_release()
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from html.parser import HTMLParser
from hiring_blind_spot_publication_20261015_inverse import (
    BASELINE, delta, source_at_hiring_publication_baseline as source_view,
    OWNER_BASELINE, owner_delta, owner_source_exact, owner_public_exact,
    source_at_owner_delta_baseline as owner_source_view,
    public_source_at_owner_delta_baseline as owner_public_view,
    source_before_owner_delta as owner_source_before,
    public_source_before_owner_delta as owner_public_before,
    public_source_at_hiring_publication_baseline as public_view,
    source_paths_at_hiring_publication_baseline as source_paths,
    public_paths_at_hiring_publication_baseline as public_paths,
)

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_FILES = ['.github/workflows/frontend-release.yml', 'public-search-index.json', 'research.html', 'scripts/brand_surface_consistency_smoke.mjs', 'scripts/build_public_search_index.py', 'scripts/certification_guard_sensitivity_smoke.py', 'scripts/footer_membership_smoke.mjs', 'scripts/footer_support_smoke.mjs', 'scripts/mobile_site_presentation_smoke.mjs', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/scope_beta_20261014_contract.mjs', 'scripts/scope_beta_20261014_contract.py', 'scripts/scope_beta_20261014_inverse.mjs', 'scripts/scope_beta_20261014_inverse.py', 'scripts/site_system_visual_smoke.mjs', 'scripts/validate_frontend_release.py', 'scripts/validate_production_cosmetic_certification.py', 'sitemap.txt', 'sitemap.xml']
EXPECTED_ADDITIONS = ['Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf', 'assets/research/hiring-blind-spot-social.png', 'hiring-blind-spot.html']
EXPECTED_GUARDS = ['scripts/fixtures/hiring-blind-spot-publication-20261015.json', 'scripts/hiring_blind_spot_publication_20261015_contract.py', 'scripts/hiring_blind_spot_publication_20261015_inverse.mjs', 'scripts/hiring_blind_spot_publication_20261015_inverse.py']
HELPER_HASHES = {'scripts/hiring_blind_spot_publication_20261015_inverse.mjs': '416501d93e41fa263c6d4488d487261ca35ca2e950ad98cc42a2d46e91f556df', 'scripts/hiring_blind_spot_publication_20261015_inverse.py': 'c5d0c7370bb0ae2ef0b45ef1a11fc93dda9c2ea962f37fc46e9904e752b6103e'}
checks = negatives = 0
parity = []
sha = lambda value: hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()
raw_read = historical_read
raw_git = historical_git
# UNBOUND DATA: these independently reviewed finite constants are mandatory.
EXPECTED_OWNER_FILES = ['.github/workflows/sample-report-marketing-certification.yml', 'Monderman_Brief_The_Culture_Trap.pdf', 'Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf', 'Monderman_Insight_The_Unmeasured_Layer.pdf', 'Monderman_Insight_The_Unmeasured_Layer_2026-09-02.pdf', 'Monderman_Platform_Brief.html', 'Terminal_Fidelity.pdf', 'assets/marketing/team-perspectives-1600.webp', 'assets/marketing/team-perspectives-540.webp', 'assets/marketing/team-perspectives-960.jpg', 'assets/marketing/team-perspectives-960.webp', 'assets/marketing/work-discussion-1600.webp', 'assets/marketing/work-discussion-540.webp', 'assets/marketing/work-discussion-960.jpg', 'assets/marketing/work-discussion-960.webp', 'assets/research/the-culture-trap-brief-figure-8.png', 'campaign-analysis.js', 'cross-tool-synthesis.html', 'decision-velocity-article.html', 'decision-velocity.html', 'diagnostics.html', 'docs/marketing-photo-register-20261013.json', 'homepage-refinement.css', 'index.html', 'institutional-performance-article.html', 'institutional-performance.html', 'legal-document-manifest.json', 'merit-after-the-machine.html', 'monderman-report.js', 'operational-systems-article.html', 'operational-systems.html', 'pilot.html', 'plan-pattern.html', 'plan-signal.html', 'privacy-2026-09-12-ai-source-evidence-v2.html', 'privacy-2026-09-19-invitation-access.html', 'privacy-2026-09-19-invited-evaluation.html', 'privacy.html', 'public-search-index.json', 'q2-sodi.html', 'research.html', 'sample-data/production-sample-release.json', 'sample-data/reports/cross_lens_synthesis.pdf', 'sample-data/reports/decision_velocity.pdf', 'sample-data/reports/depth_synthesis.pdf', 'sample-data/reports/institutional_performance.pdf', 'sample-data/reports/operational_systems.pdf', 'sample-data/reports/structural_clarity.pdf', 'sample-report.html', 'scope.html', 'scripts/ai_source_privacy_notice_smoke.mjs', 'scripts/apply_publication_cover_system.py', 'scripts/build_culture_trap_pdf.py', 'scripts/build_publication_html_editions.py', 'scripts/chatbot_release_artifact_smoke.mjs', 'scripts/cross_browser_public_release_smoke.mjs', 'scripts/diagnostic_authoritative_history_browser_smoke.mjs', 'scripts/diagnostic_display_language_smoke.mjs', 'scripts/durable_organization_browser_smoke.mjs', 'scripts/dv_assignment_recovery_smoke.mjs', 'scripts/dv_journey_browser_smoke.mjs', 'scripts/export_synthesis_sample_pdfs.mjs', 'scripts/hold_collide_browser_smoke.mjs', 'scripts/homepage_assistant_smoke.mjs', 'scripts/homepage_card_rhythm_smoke.mjs', 'scripts/homepage_refinement_20261014_browser.mjs', 'scripts/homepage_report_first_20260927_contract.mjs', 'scripts/homepage_report_quad_20260925_contract.mjs', 'scripts/homepage_sample_discovery_smoke.mjs', 'scripts/homepage_workspace_demo_smoke.mjs', 'scripts/inject-public-shell.mjs', 'scripts/marketing_completion_20261013_contract.mjs', 'scripts/marketing_completion_20261013_contract.py', 'scripts/marketing_completion_browser_smoke.mjs', 'scripts/marketing_photo_presentation_20261013_browser.mjs', 'scripts/marketing_refresh_browser_smoke.mjs', 'scripts/methodology_business_copy_smoke.mjs', 'scripts/mobile_site_presentation_smoke.mjs', 'scripts/optional_measurement_publication_smoke.py', 'scripts/os_recovery_identity_smoke.mjs', 'scripts/os_same_session_browser_smoke.mjs', 'scripts/pricing_public_copy_smoke.mjs', 'scripts/public_sample_fixture.mjs', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/public_sample_mixed_origin_smoke.mjs', 'scripts/public_sample_preview_binding_20260924_contract.mjs', 'scripts/public_sample_three_benefit_preview_smoke.mjs', 'scripts/refresh_public_sample_previews.mjs', 'scripts/report_actual_text_pagination_smoke.mjs', 'scripts/report_campaign_attribution_smoke.mjs', 'scripts/report_cross_lens_extrema_smoke.mjs', 'scripts/report_cross_lens_phone_smoke.mjs', 'scripts/report_experiential_blocks_smoke.mjs', 'scripts/report_focus_label_smoke.mjs', 'scripts/report_language_provenance_smoke.mjs', 'scripts/report_presentation_smoke.mjs', 'scripts/report_question_blocks_smoke.mjs', 'scripts/report_shared_action_conditions_smoke.mjs', 'scripts/report_synthesis_chart_smoke.mjs', 'scripts/report_synthesis_display_smoke.mjs', 'scripts/sample_cosmetic_v2_smoke.mjs', 'scripts/sample_marketing_language_hover_smoke.mjs', 'scripts/sample_product_fidelity_smoke_v2.mjs', 'scripts/sample_tile_smoke.mjs', 'scripts/saved_synthesis_page_smoke.mjs', 'scripts/scope_beta_20261014_browser.mjs', 'scripts/scope_beta_20261014_contract.mjs', 'scripts/scope_beta_20261014_contract.py', 'scripts/scope_beta_20261014_inverse.mjs', 'scripts/scope_beta_20261014_inverse.py', 'scripts/site_system_visual_smoke.mjs', 'scripts/validate_frontend_release.py', 'scripts/validate_legal_terms_protection.py', 'security.html', 'structural-clarity-article.html', 'structural-clarity.html', 'terminal-fidelity.html', 'the-culture-trap-brief.html', 'the-culture-trap.html', 'the-unmeasured-layer.html', 'workspace-actions.html', 'workspace-analysis.html', 'workspace-diagnostics.html', 'workspace.html']
OWNER_HELPER_HASHES = {
    'scripts/hiring_blind_spot_publication_20261015_inverse.mjs': 'eb3e17d429c0579f4dbe3a40aba2568e0ee72fa9bf0cd458664cc2a9fc5d0899',
    'scripts/hiring_blind_spot_publication_20261015_inverse.py': '053d768b54d92c932d03ff2b77cc25a3232bcedcfdde32426ecd70554c0aa988',
}

def read(name):
    # The complete post1858 raw-current guard has already run. These preserved
    # owner assertions use its exact recovered1858 bodies; the original four
    # bootstrap roots retain their authoritative native owner-baseline bytes.
    if name in EXPECTED_GUARDS:
        return raw_git('show', OWNER_BASELINE + ':' + name)
    return owner_source_view(name, raw_read(name))

def git(*args):
    # Exactly the old two publication diff reads obtain the exact original
    # 7669->8431 native diff, while raw owner->HEAD has its own complete audit.
    if args == ('diff', '--name-only', BASELINE):
        return raw_git('diff', '--name-only', BASELINE, OWNER_BASELINE)
    if args == ('diff', '--raw', '--no-abbrev', BASELINE):
        return raw_git('diff', '--raw', '--no-abbrev', BASELINE, OWNER_BASELINE)
    return raw_git(*args)


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

def owner_raw_source_audit():
    check(EXPECTED_OWNER_FILES is not None and sorted(owner_delta['files']) == EXPECTED_OWNER_FILES, 'Independently closed owner existing-file set')
    check(owner_delta['guardRoots'] == EXPECTED_GUARDS and not set(EXPECTED_GUARDS).intersection(EXPECTED_OWNER_FILES), 'Four explicit self-pin roots outside owner entries')
    check(raw_git('rev-parse', OWNER_BASELINE + '^{tree}').decode().strip() == '6890268b552f95094a595f29a6a8200ae1f62198', 'Exact native267 base tree')
    baseline_rows = []
    for line in raw_git('ls-tree', '-rl', OWNER_BASELINE).decode().splitlines():
        info, name = line.split('\t', 1)
        mode, kind, blob, size = info.split()
        check(kind == 'blob' and mode in ('100644', '100755'), 'Native source contains regular blobs only')
        baseline_rows.append({'path': name, 'mode': mode, 'bytes': int(size), 'gitBlobSha1': blob})
    baseline_rows.sort(key=lambda row: row['path'])
    check(len(baseline_rows) == 811 and [{key: row[key] for key in ('path', 'mode', 'bytes', 'gitBlobSha1')} for row in owner_delta['baselineSourceRows']] == baseline_rows, 'Complete authoritative native811 path/mode/blob/size closure')
    names = raw_git('ls-files', '--cached').decode().splitlines()
    check(not raw_git('ls-files', '--others', '--exclude-standard').strip(), 'No untracked source enters owner closure')
    check(sorted(names) == owner_delta['currentSourcePaths'] == delta['currentSourcePaths'] and len(names) == len(set(names)) == 811, 'Complete current811 source inventory')
    check(not raw_git('diff', '--name-only', 'HEAD').strip(), 'Only a clean committed complete source can certify')
    check(not raw_git('diff', '--cached', '--name-only', 'HEAD').strip(), 'No staged source divergence')
    head_rows = {}
    for line in raw_git('ls-tree', '-rl', 'HEAD').decode().splitlines():
        info, name = line.split('\t', 1)
        mode, kind, blob, size = info.split()
        check(kind == 'blob' and mode in ('100644', '100755'), 'Current source contains regular blobs only')
        head_rows[name] = (mode, blob, int(size))
    check(sorted(head_rows) == sorted(names), 'Current committed source inventory is complete')
    for name in names:
        path = ROOT / name
        check(path.is_file() and not path.is_symlink(), 'Every current source row is a regular file ' + name)
        value = raw_read(name)
        mode = '100755' if path.stat().st_mode & 0o111 else '100644'
        blob = hashlib.sha1(b'blob ' + str(len(value)).encode() + b'\0' + value).hexdigest()
        check((mode, blob, len(value)) == head_rows[name], 'Complete physical source equals committed HEAD ' + name)
    check(owner_source_exact(), 'All807 non-bootstrap current mode/bytes/SHA256/Git blobs match exact frozen owner rows')
    for name, digest in OWNER_HELPER_HASHES.items():
        check(isinstance(digest, str) and len(digest) == 64 and sha(raw_read(name)) == digest, 'Separately pinned new composed implementation ' + name)
    changed = raw_git('diff', '--name-only', OWNER_BASELINE, 'HEAD').decode().splitlines()
    check(sorted(changed) == sorted(EXPECTED_OWNER_FILES + EXPECTED_GUARDS), 'Exact raw owner delta independently checked before projection')
    for line in raw_git('diff', '--raw', '--no-abbrev', OWNER_BASELINE, 'HEAD').decode().splitlines():
        metadata, name = line.split('\t', 1)
        old_mode, new_mode, old_object, new_object, status = metadata.split()
        check(status == 'M' and old_mode[1:] == new_mode and name in EXPECTED_OWNER_FILES + EXPECTED_GUARDS, 'No owner additions/deletions/renames/types/mode changes')

class OwnerVisibleCopy(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skipped = 0
        self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() in ('script', 'style'):
            self.skipped += 1
        if not self.skipped:
            self.parts.extend(value for key, value in attrs if key in ('alt', 'title', 'aria-label') and value)
    def handle_endtag(self, tag):
        if tag.lower() in ('script', 'style') and self.skipped:
            self.skipped -= 1
    def handle_data(self, value):
        if not self.skipped:
            self.parts.append(value)

def owner_business_intent():
    for name in EXPECTED_OWNER_FILES:
        if name.endswith('.html'):
            parser = OwnerVisibleCopy()
            parser.feed(raw_read(name).decode('utf8'))
            check(not re.search(r'\bquestionnaire\b', ' '.join(parser.parts), re.I), 'No authored visible questionnaire wording ' + name)
    report = raw_read('monderman-report.js').decode()
    check('const SODI_DIAGNOSTIC_ORDER = Object.freeze(["structural_clarity", "operational_systems", "decision_velocity", "institutional_performance"]);' in report, 'Four exact current SODI diagnostic keys in requested order')
    check('const SODI_DIAGNOSTIC_LABELS = Object.freeze(["Structural Clarity", "Operational Systems", "Decision Velocity", "Institutional Performance"]);' in report, 'Four exact paired SODI display labels')
    index = raw_read('index.html').decode()
    check(re.findall(r'data-stock-id="([^"]+)"', index) == ['2193823408', '639637650'], 'Exact first and second owner-supplied homepage photos')
    check('<div class="hwd-compact-lenses"><span>Structural Clarity</span><span>Operational Systems</span><span>Decision Velocity</span><span>Institutional Performance</span></div>' in index, 'Current compact report strip preserves SODI order')
    check('.latest-card .latest-card-link::after {' in index and '\n    .latest-card-link::after {' not in index, 'Stretched article link is scoped to its own card')
    cards = re.findall(r'<article class="latest-card\b[^>]*>.*?</article>', index, re.S)
    native_cards = re.findall(r'<article class="latest-card\b[^>]*>.*?</article>', raw_git('show', OWNER_BASELINE + ':index.html').decode(), re.S)
    check(len(native_cards) == 19 and len(cards) == 20 and cards[1:] == native_cards, 'All19 native carousel cards and their complete strings/order retained')
    check('data-publication="hiring-blind-spot"' in cards[0] and index.count('data-publication="hiring-blind-spot"') == 1, 'One Part7 card precedes the exact old19 cohort')
    q2 = raw_read('q2-sodi.html').decode()
    check('<title>Q2-SODI Beta | Advanced organizational diagnostic software</title>' in q2 and '<link rel="canonical" href="https://www.monderman.com/q2-sodi.html">' in q2, 'Canonical Q2-SODI Beta product identity')
    check(raw_read('scope.html') == raw_read('q2-sodi.html'), 'Legacy Scope route remains exact canonical product alias')

def owner_pins(entries, current, view, strict, kind):
    global negatives
    for name, entry in entries.items():
        value = current(name)
        check(len(value) == entry['after_bytes'] and sha(value) == entry['after_sha256'], 'Exact complete raw owner input ' + name)
        forms = [value] if entry['encoding'] == 'base64' else [value, value.decode('utf8')]
        for form in forms:
            prior = strict(name, form)
            check(type(prior) is type(form) and sha(prior) == entry['before_sha256'], 'Exact strict owner inverse and type ' + name)
            check(view(name, form) == prior and view(name, prior) == prior, 'Exact conditional owner inverse without double projection ' + name)
            if kind == 'ownerSource':
                check((prior.encode() if isinstance(prior, str) else prior) == raw_git('show', OWNER_BASELINE + ':' + name), 'Owner restores authoritative native8431 source ' + name)
            parity.append([kind, name, 'str' if isinstance(form, str) else 'bytes', base64.b64encode(value).decode(), sha(prior)])
        if entry['encoding'] == 'base64':
            for fn in (view, strict):
                try:
                    fn(name, 'Unknown 😀')
                except AssertionError as error:
                    check(str(error) == name + ': finite binary input stays bytes', 'Known binary string rejected with exact bounded type predicate ' + name)
                else:
                    raise AssertionError('Known binary string was accepted ' + name)
                negatives += 1
            parity.append([kind + 'Reject', name, 'str', base64.b64encode('Unknown 😀'.encode()).decode(), name + ': finite binary input stays bytes'])
        for mutant in (value + b'\n', b'UNREVIEWED' + value, value[1:], value + b'<script>fetch("/api/activate",{method:"POST"})</script>'):
            check(view(name, mutant) == mutant, 'Unknown owner body remains visible ' + name)
            negatives += 1
            parity.append([kind, name, 'bytes', base64.b64encode(mutant).decode(), sha(mutant)])

owner_raw_source_audit()
owner_business_intent()
owner_pins(owner_delta['files'], raw_read, owner_source_view, owner_source_before, 'ownerSource')

check(BASELINE == '76690a65c53794cb1e35f512221e51ddd0c6525b', 'Actual independently observed default main')
check(git('rev-parse', BASELINE + '^{tree}').decode().strip() == 'eac4db37f700e2cbcb5040262cad01e39950609b', 'Exact main tree')
check(sorted(delta['files']) == EXPECTED_FILES, 'Nineteen finite existing paths, including guard adapters')
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
    built_names = historical_public_names(sorted(p.relative_to(build).as_posix() for p in build.rglob('*') if p.is_file()),build)
    check(not any(p.is_symlink() for p in build.rglob('*')), 'No compiled symlinks')
    check(built_names == delta['currentPublicPaths'], 'Exact physical publication closure')
    channel = json.loads((build / '.well-known/monderman-questionnaire-release.json').read_bytes())['channel']
    check(channel in delta['publicEditions'], 'Known compiled channel')
    edition = delta['publicEditions'][channel]
    check(owner_public_exact(build, channel), 'All331 physical owner compiled rows are exact')
    marker = json.loads((build / '.well-known/monderman-release.json').read_bytes())
    check(marker == {'revision': raw_git('rev-parse', 'HEAD').decode().strip()}, 'Truthful final compiled marker equals actual committed source HEAD')
    owner_pins(owner_delta['publicEditions'][channel]['files'], lambda name: historical_public_read(build,name), owner_public_view, lambda name, value: owner_public_before(name, value, channel), 'ownerPublic')
    pins(edition['files'], lambda name: owner_public_view(name, historical_public_read(build,name)), public_view, 'public')
    for name, entry in edition['additions'].items():
        value = historical_public_read(build,name)
        check(len(value) == entry['bytes'] and sha(value) == entry['sha256'], 'Approved compiled addition ' + name)
    for row in edition['currentMap']:
        if row['path'] == '.well-known/monderman-release.json':
            continue
        value = owner_public_view(row['path'], historical_public_read(build,row['path']))
        check(len(value) == row['bytes'] and sha(value) == row['sha256'], 'Whole compiled body binding ' + row['path'])
    check(public_paths(built_names, build) == delta['baselinePublicPaths'], 'Exact compiled publication inventory projects')
    for mutant in [built_names + ['UNKNOWN.js'], built_names + [built_names[0]], built_names[:-1]]:
        check(public_paths(mutant, build) == mutant, 'Unknown/duplicate/missing compiled paths stay visible')
        negatives += 1
    check(not re.search(r'\bDSI\b|Decision Sciences Institute', (build / 'hiring-blind-spot.html').read_text(), re.I), 'No DSI affiliation introduced by shared shell injection')

node = "import fs from 'node:fs';import{createHash}from'node:crypto';import{sourceAtHiringPublicationBaseline as s,publicSourceAtHiringPublicationBaseline as p,sourceAtOwnerDeltaBaseline as os,publicSourceAtOwnerDeltaBaseline as op,sourceBeforeOwnerDelta as bs,publicSourceBeforeOwnerDelta as bp}from'./scripts/hiring_blind_spot_publication_20261015_inverse.mjs';const rows=JSON.parse(fs.readFileSync(0));for(const[k,f,t,b,h]of rows){const raw=Buffer.from(b,'base64'),v=t==='str'?raw.toString():raw;if(k==='ownerSourceReject'||k==='ownerPublicReject'){for(const fn of k==='ownerSourceReject'?[os,bs]:[op,(f,v)=>bp(f,v,'legacy'),(f,v)=>bp(f,v,'current')]){let rejected=false;try{fn(f,v);}catch(e){if(e?.name!=='AssertionError'||e.message!==h)throw e;rejected=true;}if(!rejected)throw Error('Missing binary type rejection '+f);}continue;}const o=(k==='source'?s:k==='public'?p:k==='ownerSource'?os:op)(f,v);if((t==='str'?typeof o!=='string':!Buffer.isBuffer(o))||createHash('sha256').update(o).digest('hex')!==h)throw Error('Publication parity '+f);}console.log(rows.length);"
result = subprocess.run(['node', '--input-type=module', '-e', node], cwd=ROOT, input=json.dumps(parity), capture_output=True, text=True, check=True)
check(int(result.stdout.strip()) == len(parity), 'Every ordered independent JS/Python positive, negative, byte and text case')
print(json.dumps({'ok': True, 'checks': checks, 'negativeControls': negatives, 'parityCases': len(parity), 'existingFiles': len(EXPECTED_FILES), 'publicAssets': len(EXPECTED_ADDITIONS), 'built': '--built' in sys.argv, 'networkCalls': 0, 'productionWrites': 0}))
