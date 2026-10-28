"""Reviewed successor admission, followed by an explicit historical projection.

Current source, media, prose and both public editions are checked as actual bytes.
Only the listed historical commands may run in the immutable c76fb3d0 checkout;
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
BASELINE = 'c76fb3d01606b277ec2b5e0708ee1c0de9c82f00'
FIXTURE = 'scripts/fixtures/ai-middle-release-20261028.json'
FIXTURE_SHA256='08f5d9dcf9239bd53da768c0fc684ccd7ee9d6cc369c86176a3044ea2f45ed3d'
SCHEMA = 'ai-middle-release-20261028-v1'
GUARDS = ['scripts/ai_middle_release_20261028_contract.py',
          'scripts/ai_middle_release_20261028_contract.mjs', FIXTURE]
SLUG = 'ai-wont-land-in-the-middle'
ARTICLE = SLUG + '.html'
HASH = re.compile(r'[a-f0-9]{64}\Z')
REVISION = re.compile(rb'\{"revision":"[a-f0-9]{40}"\}\n\Z')

# Frozen historical contracts, not current native/functional browser programs.
HISTORICAL_SCRIPTS = {
    'scripts/article_audio_20261026_contract.py',
    'scripts/divide_rule_publication_20261025_contract.py',
    'scripts/hiring_blind_spot_publication_20261015_contract.py',
    'scripts/hiring_work_design_series_20261017_contract.py',
    'scripts/validate_frontend_release.py',
    'scripts/evaluation_pool_compatibility_smoke.mjs',
    'scripts/public_sample_manifest_sensitivity_smoke.mjs',
    'scripts/runtime_asset_release_build_smoke.mjs',
    'scripts/public_status_copy_smoke.mjs',
    'scripts/public_copy_clarity_smoke.mjs',
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
        self.paragraphs = {}; self.references = {}; self.key = None; self.parts = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'p' and ('data-source-paragraph' in a or 'data-source-reference' in a):
            self.key = ('p', a['data-source-paragraph']) if 'data-source-paragraph' in a else ('r', a['data-source-reference'])
            self.parts = []
    def handle_data(self, value):
        if self.key is not None: self.parts.append(value)
    def handle_endtag(self, tag):
        if tag == 'p' and self.key is not None:
            target = self.paragraphs if self.key[0] == 'p' else self.references
            assert self.key[1] not in target
            target[self.key[1]] = ''.join(self.parts)
            self.key = None


def text(value):
    class Text(HTMLParser):
        def __init__(self): super().__init__(convert_charrefs=True); self.parts = []
        def handle_data(self, value): self.parts.append(value)
    parser = Text(); parser.feed(value); parser.close()
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()


def audit_content(root):
    model = json.loads((root/'pdf-src'/ (SLUG+'.json')).read_bytes())
    html = (root/ARTICLE).read_text()
    assert model['author'] == 'Jason Adamson' and int(model['part']) == 5
    assert model['editorial_changes_to_main_prose'] == []
    assert len(model['paragraphs']) == 14 and len(model['references']) == 18 and len(model['figures']) == 2
    parser = Prose(); parser.feed(html); parser.close()
    assert parser.paragraphs == {str(p['number']): text(p['html']) for p in model['paragraphs']}, 'Every authorized prose paragraph'
    assert parser.references == {str(n): text(value) for n, value in enumerate(model['references'], 1)}, 'Every authorized reference'
    assert 'AI and Institutions · Part 5' in html and 'Jason Adamson' in html
    assert 'https://www.monderman.com/'+ARTICLE in html
    assert 'og:image' not in html and 'twitter:image' not in html, 'No OBT cover/social artwork'
    assert 'monderman-article-audio:' not in html, 'Source HTML remains unnarrated'
    research = (root/'research.html').read_text()
    series = {'ai-institutions-title': [5,4,3,2,1], 'hiring-work-design-title': [2,1],
              'governance-performance-title': [7,6,5,4,3,2,1]}
    for label, expected in series.items():
        section = re.search(r'<section class="series" aria-labelledby="'+label+r'">([\s\S]*?)</section>', research)
        assert section and [int(n) for n in re.findall(r'Part\s+(\d+)', section[1])] == expected, 'Current Research series order: '+label
    homepage = (root/'index.html').read_text()
    cards = re.findall(r'<article class="latest-card\b[\s\S]*?</article>', homepage)
    assert cards and 'data-publication="'+SLUG+'"' in cards[0] and '<img' not in cards[0], 'New text-only publication card first'
    for label in ['AI and Institutions', 'Hiring and Work Design', 'Governance and Performance']:
        parts = [int(re.search(re.escape(label)+r' · Part (\d+)', card)[1]) for card in cards if label in card]
        assert parts and parts == sorted(set(parts), reverse=True), 'Current homepage series order: '+label
    topics = json.loads((root/'research-topics.json').read_bytes())
    assert sum(a['path'] == ARTICLE for a in topics['articles']) == 1
    assert sum(a['url'] == ARTICLE for a in json.loads((root/'public-search-index.json').read_bytes())) == 1
    assert ARTICLE in (root/'sitemap.xml').read_text() and ARTICLE in (root/'sitemap.txt').read_text()
    assert ARTICLE in (root/'built-to-please.html').read_text(), 'Part 4 links to Part 5'
    pdf = root/'Monderman_Insight_AI_Wont_Land_in_the_Middle_2026-10-28.pdf'
    assert pdf.read_bytes().startswith(b'%PDF-')
    return {'prose_paragraphs':14, 'references':18, 'figures':2, 'research_series':series}


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
    spec = importlib.util.spec_from_file_location('current_article_injector', root/'scripts/inject_article_audio.py')
    injector = importlib.util.module_from_spec(spec); spec.loader.exec_module(injector)
    manifest = json.loads((root/'article-audio-manifest.json').read_bytes())
    entries = injector.validate_manifest(manifest, root)
    assert len(entries) == 30 and ARTICLE in {a['path'] for a in entries}
    assert manifest['release'] == '20261028.1' and manifest['status'] == 'passed'
    identity = manifest['voice_identity']
    assert identity['preset'] == 'bf_emma' and identity['engine'] == 'Kokoro82M MLX bf16'
    canonical = lambda v: sha(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')))
    assert canonical(identity) == manifest['voice_identity_sha256']
    assert canonical(manifest['voice_config']) == manifest['voice_config_sha256']
    assert manifest['reference_wav_clone'] is False
    for name, digest in manifest['runtime_sha256'].items(): assert sha((root/name).read_bytes()) == digest
    assert manifest['calendar_year_receipt_path'] == 'article-audio-year-receipt.json'
    receipt_raw = (root/manifest['calendar_year_receipt_path']).read_bytes()
    assert sha(receipt_raw) == manifest['calendar_year_receipt_sha256']
    receipt = json.loads(receipt_raw)
    assert receipt['normalizer_sha256'] == sha((root/'scripts/spoken_years.py').read_bytes())
    assert receipt['voice_identity_sha256'] == manifest['voice_identity_sha256']
    year_spec = importlib.util.spec_from_file_location('current_spoken_years',root/'scripts/spoken_years.py')
    normalizer = importlib.util.module_from_spec(year_spec); year_spec.loader.exec_module(normalizer)
    rows = receipt['articles']
    by = rows if isinstance(rows,dict) else {a['path']:a for a in rows}
    assert len(rows) == len(by) == 30 and set(by) == {a['path'] for a in entries}
    prior = {a['path']:a for a in json.loads(git(root,'show',BASELINE+':article-audio-manifest.json'))['articles']}
    years = 0
    for article in entries:
        row = by[article['path']]
        assert all(row[k] == article[k] for k in ['source_sha256','script_sha256','audio_sha256'])
        assert HASH.fullmatch(row['spoken_script_sha256'])
        assert row['status'] in ['verified-existing-calendar-reading','normalized-new-recording','no-calendar-years']
        assert bool(row['reviewed_calendar_years']) == (row['status'] != 'no-calendar-years')
        if article['path'] in prior:
            assert article['audio_sha256'] == prior[article['path']]['audio_sha256'] == row['previous_audio_sha256'], 'Reviewed archived Emma recording retained exactly'
            assert row['status'] != 'normalized-new-recording'
        else:
            assert article['path'] == ARTICLE and row['status'] == 'normalized-new-recording'
        for year in row['reviewed_calendar_years']:
            assert year['spoken'] == normalizer.spoken_year(year['written']), 'Exact reviewed year/range reading'
            assert HASH.fullmatch(year['source_sha256']) and 0 <= year['start'] < year['end']
            assert year['end']-year['start'] == len(year['written'])
            years += 1
        duration = mp4_duration((root/article['audio_path']).read_bytes())
        assert math.isfinite(duration) and abs(duration-article['duration_seconds']) < .2, 'Actual MP4/manifest duration: '+article['path']
    assert years > 0
    return {'articles':30,'actual_container_durations_checked':30,'reviewed_calendar_years':years}, injector, entries


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
    assert sum((root/a['path']).read_text().count('data-article-audio') for a in entries) == 30
    return {'channel':channel,'public_paths':len(rows),'actual_native_players':30}


def projection(channel, built):
    """Physical immutable prior checkout; no current fixture is rewritten."""
    base = Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir())) / ('monderman-ai-middle-history-'+sha(str(ROOT))[:8]+'-'+FIXTURE_SHA256[:12])
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


def baseline_public_text_paths():
    """Only the frozen 29 articles and five existing textual preconditions."""
    articles = json.loads(git(ROOT,'show',BASELINE+':article-audio-manifest.json'))['articles']
    assert len(articles) == 29
    return ['index.html','research-topics.html','sitemap.xml','careers.html','careers-privacy.html'] + [a['path'] for a in articles]


def historical(data, command):
    assert len(command) >= 2 and command[0] in ['python','python3','node']
    script = command[1]
    allowed = script in HISTORICAL_SCRIPTS or re.fullmatch(r'scripts/[a-z0-9_]+_contract\.(?:mjs|py)',script)
    assert allowed and script in data['baselinePaths'], 'Only named baseline historical contracts'
    assert all(a in ['--built','.render-public','--channel','current','legacy','--deterministic-only'] for a in command[2:]), 'Finite historical argument shapes'
    channel = command[command.index('--channel')+1] if '--channel' in command else os.environ.get('MONDERMAN_QUESTIONNAIRE_RELEASE','current')
    assert channel in ['current','legacy']
    built = '--built' in command
    if built: audit_public(data, ROOT/'.render-public', channel)
    base, env = projection(channel,built)
    print('AI_MIDDLE_HISTORICAL_PROJECTION '+json.dumps({'actual_candidate':git(ROOT,'rev-parse','HEAD').decode().strip(),'reviewed_baseline':BASELINE,'command':command,'built':built}),flush=True)
    subprocess.run(command,cwd=base,env=env,check=True)
    assert not git(base,'status','--porcelain','--untracked-files=all').strip(), 'Historical command preserved its source'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--worktree',action='store_true')
    parser.add_argument('--built',type=Path)
    parser.add_argument('--channel',choices=['current','legacy'])
    parser.add_argument('--historical',action='store_true')
    parser.add_argument('--browser-history',choices=['scope','design'])
    parser.add_argument('--read-baseline-public',choices=baseline_public_text_paths())
    parser.add_argument('command',nargs=argparse.REMAINDER)
    args = parser.parse_args(); data = fixture()
    result = {'source':audit_source(data,not args.worktree)}
    if args.built:
        assert args.channel; result['public'] = audit_public(data,args.built,args.channel)
    if args.browser_history or args.read_baseline_public:
        assert args.built and args.channel and not args.historical and not args.command
        base, env = projection(args.channel,True)
        if args.read_baseline_public:
            # Legacy pure assertions predate narration. Apply the unchanged
            # reviewed audio inverse inside the complete physical c76 artifact.
            file = args.read_baseline_public
            program = "import fs from'node:fs';import{publicSourceAtAudioBaseline as before}from'./scripts/article_audio_20261026_inverse.mjs';const file="+json.dumps(file)+",root="+json.dumps(str(base/'.render-public'))+";process.stdout.write(before(file,fs.readFileSync(root+'/'+file),root));"
            value = subprocess.check_output(['node','--input-type=module','-e',program],cwd=base,env=env)
        else:
            module, function = ('scope_beta_20261014_inverse.mjs','historicalScopeBetaBrowserBodies') if args.browser_history == 'scope' else ('site_design_coherence_20261014_inverse.mjs','historicalSiteDesignBrowserBodies')
            program = "import{createHash}from'node:crypto';import{"+function+" as bodies}from'./scripts/"+module+"';const rows=bodies("+json.dumps(str(base/'.render-public'))+");console.log(JSON.stringify([...rows].map(([p,b])=>[p,b.toString('base64')])));"
            value = subprocess.check_output(['node','--input-type=module','-e',program],cwd=base,env=env)
        assert len(value) <= 32*1024*1024, 'Finite historical text export'
        audit_source(data,not args.worktree)
        sys.stdout.buffer.write(value)
        return
    if args.historical:
        command = args.command[1:] if args.command[:1] == ['--'] else args.command
        historical(data,command)
        audit_source(data,not args.worktree)
    else: assert not args.command
    print('AI_MIDDLE_CURRENT_PASS '+json.dumps(result,sort_keys=True))


if __name__ == '__main__': main()
