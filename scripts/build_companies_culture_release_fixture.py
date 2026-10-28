"""Seal one explicitly reviewed successor; never rewrite historical fixtures.

Run only after source/media review and both genuine public builds have settled.
The private delta spec must enumerate every changed/added source and public path.
"""
from pathlib import Path
import argparse
import json
import re
from companies_culture_release_20261028_contract import (
    ROOT, BASELINE, SCHEMA, GUARDS, FIXTURE, sha, git, source_names, public_names,
    file_row, normalized_guard, audit_content, audit_audio,
)


def seal(spec, builds):
    assert spec['baseline'] == BASELINE
    baseline_paths = sorted(git(ROOT,'ls-tree','-r','--name-only',BASELINE).decode().splitlines())
    baseline_modes = {line.split('\t')[1]:line.split()[0] for line in git(ROOT,'ls-tree','-r',BASELINE).decode().splitlines()}
    names = source_names(ROOT)
    assert set(baseline_paths) <= set(names), 'No removed baseline files'
    added = sorted(set(names)-set(baseline_paths))
    assert added == spec['addedSourcePaths']
    changed = []
    for name in names:
        row = file_row(ROOT,name)
        if name not in baseline_paths:
            changed.append(name)
        else:
            before = git(ROOT,'show',BASELINE+':'+name)
            assert row['mode'] == baseline_modes[name], 'No baseline mode changes authorized: '+name
            if sha(before) != row['sha256']:
                assert not name.startswith('scripts/fixtures/') and '_inverse.' not in name, 'Historical authority remains byte-identical: '+name
                changed.append(name)
    assert changed == spec['changedSourcePaths'], 'All changes explicitly reviewed; no discovery-based allowlist'
    content = audit_content(ROOT); audio, _, _ = audit_audio(ROOT)
    old = json.loads((ROOT/'scripts/fixtures/ai-middle-release-20261028.json').read_bytes())
    editions = {}; public_deltas = {}
    for channel, root in builds.items():
        paths = public_names(root); rows = []
        prior = {r['path']:r for r in old['publicEditions'][channel]}
        assert set(prior) <= set(paths), 'No removed historical public path'
        changed_public = []
        for name in paths:
            row = file_row(root,name)
            if name == '.well-known/monderman-release.json':
                assert json.loads((root/name).read_bytes()) == {'revision':git(ROOT,'rev-parse','HEAD').decode().strip()}
                row = {'path':name,'kind':'release_revision','bytes':56}
            elif name not in prior or row['sha256'] != prior[name]['sha256']:
                changed_public.append(name)
            rows.append(row)
        assert changed_public == spec['changedPublicPaths'][channel], 'Every current public delta reviewed: '+channel
        editions[channel] = rows; public_deltas[channel] = changed_public
    result = {'schema':SCHEMA,'baseline':BASELINE,
              'baselineTree':git(ROOT,'rev-parse',BASELINE+'^{tree}').decode().strip(),
              'guardFiles':GUARDS,'guardTemplates':{f:normalized_guard(f,(ROOT/f).read_bytes())[0] for f in GUARDS[:-1]},
              'baselinePaths':baseline_paths,'sourcePaths':names,'addedSourcePaths':added,
              'changedSourcePaths':changed,'sourceRows':[file_row(ROOT,n) for n in names if n not in GUARDS],
              'publicEditions':editions,'changedPublicPaths':public_deltas,
              'reviewedCurrentSemantics':{'content':content,'audio':audio},
              'qualification':'Exact successor bytes and named changed paths only. Historical contracts execute explicitly in immutable a344cf9b; current native/functional tests execute actual successor bytes.'}
    output = ROOT/FIXTURE
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    pin = sha(output.read_bytes())
    for name in GUARDS[:-1]:
        path = ROOT/name; value = path.read_text(); prefix = 'export const ' if name.endswith('.mjs') else ''
        pattern = re.compile(r'(?m)^'+re.escape(prefix)+r"FIXTURE_SHA256='([a-f0-9]{64}|FINAL_FIXTURE_SHA256_PENDING)'"+(';$' if prefix else '$'))
        value, count = pattern.subn(prefix+"FIXTURE_SHA256='"+pin+"'"+(';' if prefix else ''),value)
        assert count == 1
        path.write_text(value)
        assert normalized_guard(name,path.read_bytes())[0] == result['guardTemplates'][name]
    print(json.dumps({'fixture':str(output),'sha256':pin,'source_paths':len(names),
                      'public_paths':{c:len(v) for c,v in editions.items()},'reviewed_source_delta':len(changed)},indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--delta-spec',required=True,type=Path)
    parser.add_argument('--current-build',required=True,type=Path)
    parser.add_argument('--legacy-build',required=True,type=Path)
    args=parser.parse_args()
    seal(json.loads(args.delta_spec.read_bytes()),{'current':args.current_build.resolve(),'legacy':args.legacy_build.resolve()})
