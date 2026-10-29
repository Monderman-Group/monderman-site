"""Culture publication successor admission, followed by an explicit historical projection.

Current source, media, prose and both public editions are checked as actual bytes.
Only the listed historical commands may run in the immutable a344cf9b checkout;
native/functional browser checks continue to use the real current candidate.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import stat
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASELINE = 'a344cf9ba4c263d381fb4f94c77ca16b3f6a5f8f'
FIXTURE = 'scripts/fixtures/companies-culture-release-20261028.json'
FIXTURE_SHA256='4b2e73a0146f199649873429e5f97cb4dfb4718884c20fd9170a3dfb56a9a4b8'
SCHEMA = 'companies-culture-release-20261028-v1'
GUARDS = ['scripts/companies_culture_release_20261028_contract.py', 'scripts/companies_culture_release_20261028_contract.mjs', FIXTURE]
SLUG = 'companies-dont-have-a-culture'
ARTICLE = SLUG + '.html'
HASH = re.compile(r'[a-f0-9]{64}\Z')
REVISION = re.compile(rb'\{"revision":"[a-f0-9]{40}"\}\n\Z')

# Frozen historical contracts, not current native/functional browser programs.
HISTORICAL_SCRIPTS = {
    'scripts/ai_middle_release_20261028_contract.py',
    'scripts/article_audio_20261026_contract.py',
    'scripts/book_publication_date_20261011_contract.mjs',
    'scripts/book_publication_date_20261011_contract.py',
    'scripts/brand_refresh_20261007_contract.mjs',
    'scripts/change_wording_20260925_contract.mjs',
    'scripts/divide_rule_publication_20261025_contract.py',
    'scripts/durable_organization_publication_20261007_contract.mjs',
    'scripts/evaluation_pool_compatibility_smoke.mjs',
    'scripts/executive_overview_renderer_contract.mjs',
    'scripts/governance_research_20260925_contract.mjs',
    'scripts/hiring_blind_spot_publication_20261015_contract.py',
    'scripts/hiring_work_design_series_20261017_contract.py',
    'scripts/hold_collide_publication_20261001_contract.mjs',
    'scripts/homepage_invitation_focus_20261011_contract.mjs',
    'scripts/homepage_invitation_focus_20261011_contract.py',
    'scripts/homepage_preview_anchor_20260924_contract.mjs',
    'scripts/homepage_refinement_20261014_contract.mjs',
    'scripts/homepage_refinement_20261014_contract.py',
    'scripts/homepage_report_first_20260927_contract.mjs',
    'scripts/homepage_report_quad_20260925_compatibility_contract.mjs',
    'scripts/homepage_report_quad_20260925_contract.mjs',
    'scripts/homepage_sample_discovery_contract.mjs',
    'scripts/homepage_sample_entry_20261011_contract.mjs',
    'scripts/marketing_completion_20261013_contract.mjs',
    'scripts/marketing_completion_20261013_contract.py',
    'scripts/marketing_photo_presentation_20261013_contract.mjs',
    'scripts/marketing_photo_presentation_20261013_contract.py',
    'scripts/marketing_refresh_20261012_contract.mjs',
    'scripts/marketing_refresh_20261012_contract.py',
    'scripts/outreach_image_notice_20261008_contract.mjs',
    'scripts/public_copy_clarity_smoke.mjs',
    'scripts/public_language_pass_20260924_contract.mjs',
    'scripts/public_sample_manifest_sensitivity_smoke.mjs',
    'scripts/public_sample_preview_binding_20260924_contract.mjs',
    'scripts/public_status_copy_smoke.mjs',
    'scripts/report_comparison_print_20260924_contract.mjs',
    'scripts/report_overview_contract.mjs',
    'scripts/report_overview_horizontal_contract.mjs',
    'scripts/report_overview_sankey_compact_contract.mjs',
    'scripts/report_unified_sankey_contract.mjs',
    'scripts/runtime_asset_release_build_smoke.mjs',
    'scripts/scope_beta_20261014_contract.mjs',
    'scripts/scope_beta_20261014_contract.py',
    'scripts/single_lens_overview_contract.mjs',
    'scripts/site_design_coherence_20261014_contract.mjs',
    'scripts/site_design_coherence_20261014_contract.py',
    'scripts/trenches_homepage_carousel_20260929_contract.mjs',
    'scripts/trenches_research_20260928_contract.mjs',
    'scripts/validate_durable_organization_publication.py',
    'scripts/validate_frontend_release.py',
}


def sha(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def git(root, *args):
    return subprocess.check_output(['git', '-c', 'core.fsmonitor=false', *args], cwd=root)


def source_names(root):
    names = git(root, 'ls-files', '--cached', '--others', '--exclude-standard').decode().splitlines()
    assert len(names) == len(set(names)), 'No duplicate source names'
    return sorted(names)


def public_names(root):
    names = []
    for base, dirs, files in os.walk(root, followlinks=False):
        assert not any((Path(base)/name).is_symlink() for name in dirs), 'No public directory symlinks'
        for name in files:
            path = Path(base)/name
            assert stat.S_ISREG(path.lstat().st_mode), 'Only regular public files'
            names.append(path.relative_to(root).as_posix())
    return sorted(names)


def file_row(root, name):
    path = Path(root)/name
    before = path.lstat()
    assert stat.S_ISREG(before.st_mode), 'Regular release file: ' + name
    value = path.read_bytes()
    after = path.lstat()
    key = lambda s: (s.st_dev, s.st_ino, s.st_mode, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    assert key(before) == key(after), 'Stable release read: ' + name
    return {'path': name, 'bytes': len(value), 'sha256': sha(value),
            'mode': '100755' if before.st_mode & 0o111 else '100644'}


def rows_exact(root, rows, actual_names):
    """Shared admission primitive; a census or byte change is a rejection."""
    if len(actual_names) != len(set(actual_names)) or sorted(actual_names) != sorted(r['path'] for r in rows):
        return False
    try:
        for row in rows:
            actual = file_row(root, row['path'])
            if row.get('kind') == 'release_revision':
                if not REVISION.fullmatch((Path(root)/row['path']).read_bytes()):
                    return False
            elif any(actual[k] != row[k] for k in ['bytes', 'sha256', 'mode']):
                return False
        return True
    except (OSError, AssertionError):
        return False


def normalized_guard(name, value):
    prefix = 'export const ' if name.endswith('.mjs') else ''
    pattern = re.compile(r'(?m)^' + re.escape(prefix) +
                         r"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'" +
                         (';$' if prefix else '$'))
    matches = list(pattern.finditer(value.decode()))
    assert len(matches) == 1, 'One explicit successor fixture pin'
    text = pattern.sub(prefix + "FIXTURE_SHA256='NORMALIZED_FIXTURE_PIN'" + (';' if prefix else ''), value.decode())
    return sha(text), matches[0][1]


def fixture():
    raw = (ROOT/FIXTURE).read_bytes()
    assert HASH.fullmatch(FIXTURE_SHA256) and sha(raw) == FIXTURE_SHA256, 'Pinned final successor fixture'
    data = json.loads(raw)
    assert data['schema'] == SCHEMA and data['baseline'] == BASELINE and data['guardFiles'] == GUARDS
    assert git(ROOT, 'rev-parse', BASELINE+'^{tree}').decode().strip() == data['baselineTree']
    assert set(data['publicEditions']) == {'current', 'legacy'}
    for name in GUARDS:
        info = (ROOT/name).lstat()
        assert stat.S_ISREG(info.st_mode) and not info.st_mode & 0o111, 'Regular non-executable successor guard'
    for name in GUARDS[:-1]:
        normalized, pin = normalized_guard(name, (ROOT/name).read_bytes())
        assert normalized == data['guardTemplates'][name] and pin == FIXTURE_SHA256
    return data


class Prose(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paragraphs={};self.references={};self.key=None;self.parts=[];self.metadata=[];self.images=[];self.end=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='meta':self.metadata.append(a)
        if tag=='img':self.images.append(a.get('src'))
        key=None
        if tag=='p' and 'data-source-block' in a:key=('p',a['data-source-block'])
        elif tag=='li' and 'data-source-block' in a:key=('r',a['data-source-block'])
        elif tag=='p' and 'data-source-paragraph' in a:key=('p',a['data-source-paragraph'])
        elif tag=='p' and 'data-source-reference' in a:key=('r',a['data-source-reference'])
        if key:self.key=key;self.parts=[];self.end=tag
    def handle_data(self,value):
        if self.key is not None:self.parts.append(value)
    def handle_endtag(self,tag):
        if self.key is not None and tag==self.end:
            target=self.paragraphs if self.key[0]=='p' else self.references
            assert self.key[1] not in target
            target[self.key[1]]=''.join(self.parts);self.key=None



def text(value):
    class Text(HTMLParser):
        def __init__(self): super().__init__(convert_charrefs=True); self.parts = []
        def handle_data(self, value): self.parts.append(value)
    parser = Text(); parser.feed(value); parser.close()
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()


def audit_content(root):
    model=json.loads((root/'pdf-src'/(SLUG+'.json')).read_bytes())
    source=(root/ARTICLE).read_text();parser=Prose();parser.feed(source);parser.close()
    assert model['author']=='Jason Adamson' and model['part']==8 and model['series']=='Governance and Performance'
    assert model['editorial_changes_to_main_prose']==[]
    paragraphs={b['id']:b['text'] for b in model['blocks'] if b['kind']=='paragraph'}
    refs={b['id']:b['text'] for b in model['blocks'] if b['kind']=='reference'}
    assert len(paragraphs)==32 and len(refs)==19 and len([b for b in model['blocks'] if b['kind']=='heading'])==9
    assert parser.paragraphs==paragraphs and parser.references==refs,'Exact approved prose and all19 references'
    assert sum(len(re.findall(r'\[\d+\]',s)) for s in paragraphs.values())==20
    assert not re.search(r'\bDSI\b',' '.join([*paragraphs.values(),*refs.values()]))
    assert 'Governance and Performance · Part 8' in source and 'https://www.monderman.com/'+ARTICLE in source
    assert 'next quarter. A quarter is a review period, not a promise.' in source
    social='https://www.monderman.com/assets/brand/monderman-social-card.png?v=20260907-wordmark2'
    for attribute,name,value in [('name','author','Jason Adamson'),('property','og:image',social),('property','og:image:width','1200'),('property','og:image:height','630'),('property','og:image:alt','Monderman'),('name','twitter:card','summary_large_image'),('name','twitter:image',social),('name','twitter:image:alt','Monderman')]:
        assert [m.get('content') for m in parser.metadata if m.get(attribute)==name]==[value],name
    expected=['assets/research/companies-culture-the-test.png','assets/research/companies-culture-seven-choices.png','assets/research/companies-culture-habit-holders.png']
    assert parser.images[:3]==expected and len(parser.images)==4
    assert sha(parser.images[3])=='3fad49ff103e10ccb4940485b6b889c851d64baaa1af6b3703003bc6f64d02f1','Original canonical footer; no illustrated cover'
    assert 'monderman-article-audio:' not in source
    research=(root/'research.html').read_text();assert research.count('Eight essays')==1;series={'governance-performance-title':[8,7,6,5,4,3,2,1],'ai-institutions-title':[5,4,3,2,1],'hiring-work-design-title':[2,1]}
    for label,expected_parts in series.items():
        section=re.search(r'<section class="series" aria-labelledby="'+label+r'">([\s\S]*?)</section>',research)
        assert section and [int(n) for n in re.findall(r'Part\s+(\d+)',section[1])]==expected_parts,label
    cards=re.findall(r'<article class="latest-card\b[\s\S]*?</article>',(root/'index.html').read_text())
    assert cards and 'data-publication="'+SLUG+'"' in cards[0] and '<img' not in cards[0]
    for label in ['AI and Institutions','Hiring and Work Design','Governance and Performance']:
        parts=[int(re.search(re.escape(label)+r' · Part (\d+)',c)[1]) for c in cards if label in c]
        assert parts==sorted(set(parts),reverse=True),label
    topics=json.loads((root/'research-topics.json').read_bytes());assert sum(a['path']==ARTICLE for a in topics['articles'])==1
    assert sum(a['url']==ARTICLE for a in json.loads((root/'public-search-index.json').read_bytes()))==1
    assert ARTICLE in (root/'sitemap.xml').read_text() and ARTICLE in (root/'sitemap.txt').read_text()
    assert ARTICLE in (root/'divide-and-rule-inside-the-company.html').read_text()
    assert (root/model['pdf_filename']).read_bytes().startswith(b'%PDF-')
    return {'prose_paragraphs':32,'headings':9,'references':19,'citation_markers':20,'figures':3,'research_series':series}



def mp4_duration(value):
    def atoms(start, end):
        at = start
        while at < end:
            assert at+8 <= end
            size, kind = struct.unpack_from('>I4s', value, at); header = 8
            if size == 1: size = struct.unpack_from('>Q', value, at+8)[0]; header = 16
            if size == 0: size = end-at
            assert header <= size <= end-at
            yield kind, at+header, at+size
            at += size
    for kind, start, end in atoms(0, len(value)):
        if kind == b'moov':
            assert b'mp4a' in value[start:end], 'Actual AAC audio sample entry'
            for sub, begin, finish in atoms(start, end):
                if sub == b'mvhd':
                    version = value[begin]
                    assert version in [0,1]
                    scale_at, duration_at = (begin+12, begin+16) if version == 0 else (begin+20, begin+24)
                    scale = struct.unpack_from('>I', value, scale_at)[0]
                    duration = struct.unpack_from('>I' if version == 0 else '>Q', value, duration_at)[0]
                    assert scale > 0 and duration > 0
                    return duration/scale
    raise AssertionError('Complete MP4 movie duration required')


def audit_audio(root):
    spec=importlib.util.spec_from_file_location('current_article_injector',root/'scripts/inject_article_audio.py');injector=importlib.util.module_from_spec(spec);spec.loader.exec_module(injector)
    manifest=json.loads((root/'article-audio-manifest.json').read_bytes());entries=injector.validate_manifest(manifest,root)
    assert len(entries)==31 and ARTICLE in {a['path'] for a in entries}
    assert manifest['release']=='20261028.2' and manifest['status']=='passed'
    identity=manifest['voice_identity'];assert identity['preset']=='bf_emma' and identity['engine']=='Kokoro82M MLX bf16'
    canonical=lambda v:sha(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')))
    assert canonical(identity)==manifest['voice_identity_sha256'] and canonical(manifest['voice_config'])==manifest['voice_config_sha256']
    assert manifest['reference_wav_clone'] is False
    for name,digest in manifest['runtime_sha256'].items():assert sha((root/name).read_bytes())==digest
    receipt_raw=(root/'article-audio-year-receipt.json').read_bytes();assert sha(receipt_raw)==manifest['calendar_year_receipt_sha256']
    receipt=json.loads(receipt_raw);assert receipt['normalizer_sha256']==sha((root/'scripts/spoken_years.py').read_bytes())
    assert receipt['voice_identity_sha256']==manifest['voice_identity_sha256']
    year_spec=importlib.util.spec_from_file_location('current_spoken_years',root/'scripts/spoken_years.py');normalizer=importlib.util.module_from_spec(year_spec);year_spec.loader.exec_module(normalizer)
    by={a['path']:a for a in receipt['articles']};assert len(by)==31 and set(by)=={a['path'] for a in entries}
    old_manifest=json.loads(git(root,'show',BASELINE+':article-audio-manifest.json'));prior={a['path']:a for a in old_manifest['articles']}
    old_receipt={a['path']:a for a in json.loads(git(root,'show',BASELINE+':article-audio-year-receipt.json'))['articles']}
    assert len(prior)==30 and manifest['voice_identity_sha256']==old_manifest['voice_identity_sha256'] and manifest['voice_config_sha256']==old_manifest['voice_config_sha256']
    years=0
    for entry in entries:
        row=by[entry['path']]
        assert all(row[k]==entry[k] for k in ['source_sha256','script_sha256','audio_sha256'])
        assert HASH.fullmatch(row['spoken_script_sha256'])
        if entry['path'] in prior:
            keep=lambda v:{k:x for k,x in v.items() if k!='source_sha256'}
            assert keep(entry)==keep(prior[entry['path']]),'All archived media metadata preserved; only authored-HTML hash may rebind'
            assert keep(row)==keep(old_receipt[entry['path']]),'Original archived pronunciation evidence retained, including its historical status'
        else:
            assert entry['path']==ARTICLE and row['status']=='normalized-new-recording'
            assert len(row['reviewed_calendar_years'])==6
            assert row['changed_native_chunks'] and all(c['all_ordered_words_covered'] for c in row['changed_native_chunks'])
        for year in row['reviewed_calendar_years']:
            assert year['spoken']==normalizer.spoken_year(year['written'])
            assert HASH.fullmatch(year['source_sha256']) and 0<=year['start']<year['end'] and year['end']-year['start']==len(year['written'])
            years+=1
        duration=mp4_duration((root/entry['audio_path']).read_bytes());assert math.isfinite(duration) and abs(duration-entry['duration_seconds'])<.2
    return {'articles':31,'actual_container_durations_checked':31,'reviewed_calendar_years':years,'archived_audio_metadata_preserved':30},injector,entries



def audit_source(data, require_clean=True):
    expected = sorted(r['path'] for r in data['sourceRows'])
    assert expected == sorted(set(data['sourcePaths'])-set(GUARDS))
    assert source_names(ROOT) == data['sourcePaths'], 'Exact successor source census; unknown paths rejected'
    assert rows_exact(ROOT, data['sourceRows'], expected), 'Exact successor source/media bytes and modes'
    assert set(data['sourcePaths']) == set(data['baselinePaths']) | set(data['addedSourcePaths'])
    if require_clean:
        assert not git(ROOT,'status','--porcelain','--untracked-files=all').strip(), 'Clean committed successor'
    content = audit_content(ROOT); audio, _, _ = audit_audio(ROOT)
    return {'source_paths':len(data['sourcePaths']), 'content':content, 'audio':audio}


def audit_public(data, root, channel):
    root = Path(root).resolve()
    assert channel in ['current','legacy']
    rows = data['publicEditions'][channel]
    assert rows_exact(root, rows, public_names(root)), 'Exact actual successor public bytes and census'
    marker = json.loads((root/'.well-known/monderman-release.json').read_bytes())
    assert marker == {'revision':git(ROOT,'rev-parse','HEAD').decode().strip()}, 'Truthful current revision marker'
    assert json.loads((root/'.well-known/monderman-questionnaire-release.json').read_bytes())['channel'] == channel
    _, injector, entries = audit_audio(ROOT)
    for article in entries:
        recovered = injector.recover((root/article['path']).read_text(), article)
        assert recovered.count('monderman-article-audio:') == 0
        assert (root/article['audio_path']).read_bytes() == (ROOT/article['audio_path']).read_bytes()
        before = Prose(); before.feed((ROOT/article['path']).read_text()); before.close()
        after = Prose(); after.feed(recovered); after.close()
        assert before.paragraphs == after.paragraphs and before.references == after.references, 'Compiled authored prose/reference preservation'
    assert sum((root/a['path']).read_text().count('data-article-audio') for a in entries) == 31
    return {'channel':channel,'public_paths':len(rows),'actual_native_players':31}


def projection(channel, built):
    """Physical immutable prior checkout; no current fixture is rewritten."""
    base = Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir())).resolve() / ('monderman-companies-culture-history-'+sha(str(ROOT))[:8]+'-'+FIXTURE_SHA256[:12])
    if not base.exists():
        subprocess.run(['git','clone','--quiet','--shared','--no-checkout',str(ROOT),str(base)],check=True)
        subprocess.run(['git','checkout','--quiet','--detach',BASELINE],cwd=base,check=True)
    assert not base.is_symlink() and git(base,'rev-parse','HEAD').decode().strip() == BASELINE
    assert not git(base,'status','--porcelain','--untracked-files=all').strip(), 'Clean immutable historical projection'
    env = os.environ.copy(); env['RENDER_GIT_COMMIT'] = BASELINE; env['MONDERMAN_QUESTIONNAIRE_RELEASE'] = channel
    for key in ['SCOPE_BETA_BUILD_ROOT','SITE_DESIGN_BUILD_ROOT','HIRING_PUBLICATION_BUILD_ROOT']:
        if key in env: env[key] = str(base/'.render-public')
    if built:
        subprocess.run(['bash','scripts/render-static-build.sh'],cwd=base,env=env,check=True,stdout=subprocess.DEVNULL)
    return base, env


# Exact path/API unions reviewed from immutable finite inversion maps; no source census discovery.
PRIOR_API_PATHS = {}
def _prior_paths(name,parent,added):
    PRIOR_API_PATHS[name] = frozenset((PRIOR_API_PATHS[parent] if parent else frozenset()) | set(added))
_prior_paths('isCurrentHomepageRefinementSourceAtRelease',None,['index.html'])
_prior_paths('assertSeriesPublicationSurfaceAtRelease',None,['ai-wont-land-in-the-middle.html', 'careers-privacy.html', 'careers.html', 'divide-and-rule-inside-the-company.html', 'hiring-blind-spot.html', 'posting-has-outgrown-the-job.html', 'research-topics.html'])
_prior_paths('sourceAtReleaseBaseline','isCurrentHomepageRefinementSourceAtRelease',['accumulated-drag-department-of-war.html', 'built-to-please.html', 'every-node-for-itself.html', 'from-tokens-to-outcomes.html', 'public-search-index.json', 'research-topics.html', 'research.html', 'scripts/public_sample_fixture.mjs', 'scripts/refresh_public_sample_previews.mjs', 'sitemap.xml', 'the-art-of-interior-reasoning.html', 'we-gave-bureaucracy-the-fastest-tools.html'])
_prior_paths('publicAtReleaseBaseline','isCurrentHomepageRefinementSourceAtRelease',['accumulated-drag-department-of-war.html', 'built-to-please.html', 'careers-privacy.html', 'careers.html', 'compensatory-systems.html', 'decision-velocity-article.html', 'designing-for-decision-velocity.html', 'divide-and-rule-inside-the-company.html', 'durable-organization.html', 'every-node-for-itself.html', 'fast-to-cut-slow-to-build.html', 'from-tokens-to-outcomes.html', 'governing-complexity.html', 'hiring-blind-spot.html', 'hold-collide-come-apart.html', 'institutional-performance-article.html', 'merit-after-the-machine.html', 'nothing-stays-tuned.html', 'operational-systems-article.html', 'posting-has-outgrown-the-job.html', 'quarter-trillion-friction-us-healthcare.html', 'research-topics.html', 'sitemap.xml', 'structural-clarity-article.html', 'terminal-fidelity.html', 'the-art-of-interior-reasoning.html', 'the-culture-trap-brief.html', 'the-culture-trap.html', 'the-drift-problem.html', 'the-unmeasured-layer.html', 'trenches-not-silos.html', 'we-gave-bureaucracy-the-fastest-tools.html', 'when-bureaucracy-became-the-obstacle.html'])
_prior_paths('sourceAtScopeBetaBaselineAtRelease','sourceAtReleaseBaseline',['.github/workflows/chatbot-widget-regression.yml', '.github/workflows/frontend-release.yml', '.github/workflows/pilot-retry-regression.yml', '.github/workflows/sample-report-marketing-certification.yml', '404.html', 'Monderman_Brief_The_Culture_Trap.pdf', 'Monderman_Insight_Merit_After_the_Machine_2026-09-02.pdf', 'Monderman_Insight_The_Hiring_Blind_Spot_2026-10-16.pdf', 'Monderman_Insight_The_Unmeasured_Layer.pdf', 'Monderman_Insight_The_Unmeasured_Layer_2026-09-02.pdf', 'Monderman_Platform_Brief.html', 'Terminal_Fidelity.pdf', 'about.html', 'accept-invite.html', 'after-a-reorganization.html', 'after-an-acquisition.html', 'assets/marketing/team-perspectives-1600.webp', 'assets/marketing/team-perspectives-540.webp', 'assets/marketing/team-perspectives-960.jpg', 'assets/marketing/team-perspectives-960.webp', 'assets/marketing/work-discussion-1600.webp', 'assets/marketing/work-discussion-540.webp', 'assets/marketing/work-discussion-960.jpg', 'assets/marketing/work-discussion-960.webp', 'assets/research/hiring-blind-spot-social.png', 'assets/research/the-culture-trap-brief-figure-8.png', 'assistant.js', 'campaign-analysis.js', 'canonical-site-shell.js', 'checkout-success.html', 'checkout.html', 'compensatory-systems.html', 'connect-widget.js', 'connect.html', 'cross-tool-synthesis.html', 'decision-velocity-article.html', 'decision-velocity.html', 'designing-for-decision-velocity.html', 'deterministic-ai-infrastructure.html', 'diagnostics.html', 'docs/marketing-photo-register-20261013.json', 'durable-organization.html', 'enterprise-site.css', 'fast-to-cut-slow-to-build.html', 'governing-complexity.html', 'hiring-blind-spot.html', 'hold-collide-come-apart.html', 'homepage-refinement.css', 'institutional-performance-article.html', 'institutional-performance.html', 'legal-document-manifest.json', 'merit-after-the-machine.html', 'monderman-report.js', 'new-in-the-role.html', 'nothing-stays-tuned.html', 'operational-systems-article.html', 'operational-systems.html', 'pattern-trial.html', 'pilot-feedback.html', 'pilot.html', 'plan-enterprise.html', 'plan-pattern.html', 'plan-signal.html', 'platform-services.html', 'privacy-2026-09-12-ai-source-evidence-v2.html', 'privacy-2026-09-19-invitation-access.html', 'privacy-2026-09-19-invited-evaluation.html', 'privacy.html', 'q2-sodi.html', 'quarter-trillion-friction-us-healthcare.html', 'research-topics.json', 'roi.html', 'sample-data/production-sample-release.json', 'sample-data/reports/cross_lens_synthesis.pdf', 'sample-data/reports/decision_velocity.pdf', 'sample-data/reports/depth_synthesis.pdf', 'sample-data/reports/institutional_performance.pdf', 'sample-data/reports/operational_systems.pdf', 'sample-data/reports/structural_clarity.pdf', 'sample-report-production.js', 'sample-report.html', 'scope.html', 'scripts/ai_source_privacy_notice_smoke.mjs', 'scripts/apply_publication_cover_system.py', 'scripts/brand_surface_consistency_smoke.mjs', 'scripts/build_culture_trap_pdf.py', 'scripts/build_public_search_index.py', 'scripts/build_publication_html_editions.py', 'scripts/certification_guard_sensitivity_smoke.py', 'scripts/chatbot_release_artifact_smoke.mjs', 'scripts/ci_ubuntu_apt_scope.sh', 'scripts/cosmetic_regression_smoke.mjs', 'scripts/cross_browser_public_release_smoke.mjs', 'scripts/diagnostic_authoritative_history_browser_smoke.mjs', 'scripts/diagnostic_display_language_smoke.mjs', 'scripts/divide_rule_publication_20261025_contract.py', 'scripts/divide_rule_publication_20261025_inverse.mjs', 'scripts/divide_rule_publication_20261025_inverse.py', 'scripts/durable_organization_browser_smoke.mjs', 'scripts/dv_assignment_recovery_smoke.mjs', 'scripts/dv_journey_browser_smoke.mjs', 'scripts/employer_salary_browser_smoke.mjs', 'scripts/export_synthesis_sample_pdfs.mjs', 'scripts/footer_membership_smoke.mjs', 'scripts/footer_support_smoke.mjs', 'scripts/hiring_blind_spot_publication_20261015_contract.py', 'scripts/hiring_blind_spot_publication_20261015_inverse.mjs', 'scripts/hiring_blind_spot_publication_20261015_inverse.py', 'scripts/hiring_work_design_series_20261017_contract.py', 'scripts/hiring_work_design_series_20261017_inverse.mjs', 'scripts/hiring_work_design_series_20261017_inverse.py', 'scripts/hold_collide_browser_smoke.mjs', 'scripts/homepage_assistant_smoke.mjs', 'scripts/homepage_card_rhythm_smoke.mjs', 'scripts/homepage_refinement_20261014_browser.mjs', 'scripts/homepage_report_first_20260927_contract.mjs', 'scripts/homepage_report_quad_20260925_contract.mjs', 'scripts/homepage_sample_discovery_smoke.mjs', 'scripts/homepage_workspace_demo_smoke.mjs', 'scripts/inject-public-shell.mjs', 'scripts/install_ci_browsers.sh', 'scripts/marketing_completion_20261013_contract.mjs', 'scripts/marketing_completion_20261013_contract.py', 'scripts/marketing_completion_browser_smoke.mjs', 'scripts/marketing_photo_presentation_20261013_browser.mjs', 'scripts/marketing_refresh_browser_smoke.mjs', 'scripts/methodology_business_copy_smoke.mjs', 'scripts/mobile_site_presentation_smoke.mjs', 'scripts/optional_measurement_publication_smoke.py', 'scripts/os_recovery_identity_smoke.mjs', 'scripts/os_same_session_browser_smoke.mjs', 'scripts/pilot_retry_browser_smoke.mjs', 'scripts/pricing_public_copy_smoke.mjs', 'scripts/private_source_absence_smoke.mjs', 'scripts/public_gold_accent_smoke.mjs', 'scripts/public_sample_manifest_sensitivity_smoke.mjs', 'scripts/public_sample_mixed_origin_smoke.mjs', 'scripts/public_sample_preview_binding_20260924_contract.mjs', 'scripts/public_sample_three_benefit_preview_smoke.mjs', 'scripts/public_status_copy_smoke.mjs', 'scripts/public_surface_consistency_smoke.mjs', 'scripts/render-static-build.sh', 'scripts/report_actual_text_pagination_smoke.mjs', 'scripts/report_campaign_attribution_smoke.mjs', 'scripts/report_cross_lens_extrema_smoke.mjs', 'scripts/report_cross_lens_phone_smoke.mjs', 'scripts/report_experiential_blocks_smoke.mjs', 'scripts/report_focus_label_smoke.mjs', 'scripts/report_language_provenance_smoke.mjs', 'scripts/report_overview_horizontal_contract.mjs', 'scripts/report_presentation_smoke.mjs', 'scripts/report_question_blocks_smoke.mjs', 'scripts/report_shared_action_conditions_smoke.mjs', 'scripts/report_synthesis_chart_smoke.mjs', 'scripts/report_synthesis_display_smoke.mjs', 'scripts/runtime_asset_release_build_smoke.mjs', 'scripts/sample_cosmetic_v2_smoke.mjs', 'scripts/sample_marketing_language_hover_smoke.mjs', 'scripts/sample_product_fidelity_smoke.mjs', 'scripts/sample_product_fidelity_smoke_v2.mjs', 'scripts/sample_tile_smoke.mjs', 'scripts/saved_synthesis_page_smoke.mjs', 'scripts/scope_beta_20261014_browser.mjs', 'scripts/scope_beta_20261014_contract.mjs', 'scripts/scope_beta_20261014_contract.py', 'scripts/scope_beta_20261014_inverse.mjs', 'scripts/scope_beta_20261014_inverse.py', 'scripts/single_lens_overview_20260929_inverse.mjs', 'scripts/site_consistency_copy_smoke.mjs', 'scripts/site_design_coherence_20261014_contract.mjs', 'scripts/site_design_coherence_20261014_contract.py', 'scripts/site_design_coherence_20261014_inverse.mjs', 'scripts/site_design_coherence_20261014_inverse.py', 'scripts/site_system_visual_smoke.mjs', 'scripts/validate_frontend_release.py', 'scripts/validate_legal_terms_protection.py', 'scripts/validate_ordinary_page_print.py', 'scripts/validate_production_cosmetic_certification.py', 'scripts/validate_report_presentation.py', 'scripts/validate_six_product_ecosystem.py', 'security.html', 'signin.html', 'site-shell/footer.html', 'site-shell/header.html', 'sitemap.txt', 'structural-clarity-article.html', 'structural-clarity.html', 'terminal-fidelity.html', 'the-culture-trap-brief.html', 'the-culture-trap.html', 'the-drift-problem.html', 'the-unmeasured-layer.html', 'transformation-behind-schedule.html', 'trenches-not-silos.html', 'when-bureaucracy-became-the-obstacle.html', 'why-monderman.html', 'workspace-actions.html', 'workspace-analysis.html', 'workspace-diagnostics.html', 'workspace-settings.html', 'workspace.html'])
_prior_paths('sourceAtHomepageRefinementBaselineAtRelease','sourceAtScopeBetaBaselineAtRelease',['marketing-photo-presentation.css', 'scripts/homepage_refinement_20261014_contract.mjs', 'scripts/homepage_refinement_20261014_contract.py', 'scripts/homepage_refinement_20261014_inverse.mjs', 'scripts/homepage_refinement_20261014_inverse.py', 'scripts/homepage_sample_discovery_contract.mjs', 'scripts/marketing_photo_presentation_20261013_contract.mjs', 'scripts/marketing_photo_presentation_20261013_contract.py', 'scripts/marketing_photo_presentation_20261013_inverse.mjs', 'scripts/marketing_photo_presentation_20261013_inverse.py', 'scripts/marketing_refresh_20261012_contract.mjs', 'scripts/marketing_refresh_20261012_contract.py', 'visual-polish.css'])
_prior_paths('sourceAtMarketingRefreshBaselineAtRelease','sourceAtHomepageRefinementBaselineAtRelease',['docs/marketing-completion-20261013.md', 'scripts/book_publication_date_20261011_contract.mjs', 'scripts/book_publication_date_20261011_contract.py', 'scripts/book_publication_date_20261011_inverse.mjs', 'scripts/book_publication_date_20261011_inverse.py', 'scripts/marketing_completion_20261013_inverse.mjs', 'scripts/marketing_completion_20261013_inverse.py', 'scripts/marketing_refresh_20261012_inverse.mjs', 'scripts/marketing_refresh_20261012_inverse.py'])
_prior_paths('sourceBeforePublicCopyClarityAtRelease','sourceAtMarketingRefreshBaselineAtRelease',['canonical-site-shell.css', 'homepage-workspace-demo.css', 'homepage-workspace-demo.js', 'monderman-depth-lure-tile.css', 'pdf-src/hold-collide-come-apart.json', 'pilot-waitlist.css', 'public-product-design.css', 'public-sample-model.js', 'sample-report-tile.css', 'scripts/build_hold_collide_come_apart.py', 'scripts/homepage_invitation_focus_20261011_contract.mjs', 'scripts/homepage_invitation_focus_20261011_contract.py', 'scripts/homepage_invitation_focus_20261011_inverse.mjs', 'scripts/homepage_invitation_focus_20261011_inverse.py', 'scripts/homepage_report_quad_20260925.mjs', 'scripts/homepage_sample_entry_20261011_contract.mjs', 'scripts/homepage_sample_entry_20261011_inverse.mjs', 'scripts/homepage_sample_entry_20261011_inverse.py', 'scripts/templates/home-workspace-preview.html', 'subprocessors.html'])
_prior_paths('sourceBeforeOverviewSiteCompatibilityAtRelease','sourceBeforePublicCopyClarityAtRelease',['assignment-draft.js', 'assignment-mode.js'])

# Exact culture-layer navigation preconditions, composed before the unchanged prior API.
SUCCESSOR_SOURCE_PRECONDITIONS = frozenset(['divide-and-rule-inside-the-company.html', 'nothing-stays-tuned.html', 'the-unmeasured-layer.html', 'terminal-fidelity.html'])

def baseline_public_text_paths():
    return sorted(set().union(*PRIOR_API_PATHS.values()))



def historical(data,command):
    assert len(command)>=2 and command[0] in ['python','python3','node']
    script=command[1]
    assert script in HISTORICAL_SCRIPTS and script in data['baselinePaths'],'Only explicit reviewed historical scripts; native browser contracts stay current'
    assert all(a in ['--built','.render-public','--channel','current','legacy','--deterministic-only'] for a in command[2:]) or (script=='scripts/public_sample_manifest_sensitivity_smoke.mjs' and command[2:]==['--check'])
    built='--built' in command
    channel=command[command.index('--channel')+1] if '--channel' in command else json.loads((ROOT/'.render-public/.well-known/monderman-questionnaire-release.json').read_bytes())['channel'] if built else os.environ.get('MONDERMAN_QUESTIONNAIRE_RELEASE','current')
    assert channel in ['current','legacy']
    if built:audit_public(data,ROOT/'.render-public',channel)
    base,env=projection(channel,built)
    print('CULTURE_HISTORICAL_PROJECTION '+json.dumps({'actual_candidate':git(ROOT,'rev-parse','HEAD').decode().strip(),'reviewed_baseline':BASELINE,'command':command,'built':built}),flush=True)
    if script=='scripts/ai_middle_release_20261028_contract.py':run=command
    else:run=[sys.executable,'scripts/ai_middle_release_20261028_contract.py','--historical','--',*command]
    subprocess.run(run,cwd=base,env=env,check=True)
    assert not git(base,'status','--porcelain','--untracked-files=all').strip()



def main():
    api_names=['sourceAtReleaseBaseline','sourceAtHomepageRefinementBaselineAtRelease','sourceAtMarketingRefreshBaselineAtRelease','sourceAtScopeBetaBaselineAtRelease','sourceBeforePublicCopyClarityAtRelease','sourceBeforeOverviewSiteCompatibilityAtRelease','publicAtReleaseBaseline','isCurrentHomepageRefinementSourceAtRelease','assertSeriesPublicationSurfaceAtRelease']
    parser=argparse.ArgumentParser();parser.add_argument('--worktree',action='store_true');parser.add_argument('--built',type=Path);parser.add_argument('--channel',choices=['current','legacy']);parser.add_argument('--historical',action='store_true');parser.add_argument('--browser-history',choices=['scope','design']);parser.add_argument('--source-predicate',choices=['homepage-refinement']);parser.add_argument('--read-baseline-public',choices=baseline_public_text_paths());parser.add_argument('--history-api',choices=api_names);parser.add_argument('--history-file',choices=baseline_public_text_paths());parser.add_argument('command',nargs=argparse.REMAINDER)
    args=parser.parse_args();data=fixture();result={'source':audit_source(data,not args.worktree)}
    if args.built:assert args.channel;result['public']=audit_public(data,args.built,args.channel)
    if args.history_api or args.browser_history or args.source_predicate or args.read_baseline_public:
        assert not args.historical and not args.command
        if args.history_api:
            assert args.history_file in PRIOR_API_PATHS[args.history_api] or (args.history_api=='sourceAtReleaseBaseline' and args.history_file in SUCCESSOR_SOURCE_PRECONDITIONS), 'Only the explicit reviewed prior API paths or named successor navigation preconditions'
        channel=args.channel or 'current';base,env=projection(channel,bool(args.built))
        if args.history_api:
            assert args.history_file
            fn=args.history_api;file=args.history_file;public_root=str(base/'.render-public');use_public=fn=='publicAtReleaseBaseline' or (fn=='assertSeriesPublicationSurfaceAtRelease' and bool(args.built))
            assert not use_public or args.built
            program="import fs from'node:fs';import*as old from'./scripts/ai_middle_release_20261028_contract.mjs';const fn="+json.dumps(fn)+",file="+json.dumps(file)+",root="+json.dumps(public_root)+",channel="+json.dumps(channel if args.built else None)+";const bytes=fs.readFileSync("+json.dumps(str(base/'.render-public') if use_public else str(base))+"+'/'+file);let value;if(fn==='isCurrentHomepageRefinementSourceAtRelease')value=old[fn](bytes);else if(fn==='publicAtReleaseBaseline')value=old[fn](file,bytes,root);else if(fn==='assertSeriesPublicationSurfaceAtRelease')value=old[fn](file,bytes,channel,root);else value=old[fn](file,bytes);console.log(JSON.stringify(Buffer.isBuffer(value)?{kind:'buffer',value:value.toString('base64')}:{kind:'json',value}));"
            value=subprocess.check_output(['node','--input-type=module','-e',program],cwd=base,env=env)
        else:
            command=[sys.executable,'scripts/ai_middle_release_20261028_contract.py']
            if args.built:command+=['--built',str(base/'.render-public'),'--channel',channel]
            if args.browser_history:command+=['--browser-history',args.browser_history]
            elif args.source_predicate:command+=['--source-predicate',args.source_predicate]
            else:assert args.built;command+=['--read-baseline-public',args.read_baseline_public]
            value=subprocess.check_output(command,cwd=base,env=env)
        assert len(value)<=32*1024*1024
        assert not git(base,'status','--porcelain','--untracked-files=all').strip()
        audit_source(data,not args.worktree);sys.stdout.buffer.write(value);return
    if args.historical:
        command=args.command[1:] if args.command[:1]==['--'] else args.command;historical(data,command);audit_source(data,not args.worktree)
    else:assert not args.command
    print('COMPANIES_CULTURE_CURRENT_PASS '+json.dumps(result,sort_keys=True))



if __name__ == '__main__': main()
