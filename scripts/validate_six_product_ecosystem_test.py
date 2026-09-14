"""Offline, data-only regression of the exact ecosystem campaign check.

An explicitly SHA-pinned current deterministic public draft may be supplied;
it is never written into the SITE or treated as an approved AI/release result.
No API source is imported or copied. Full release approval remains a separate,
mandatory public_sample_fixture --check in validate_six_product_ecosystem.py.
"""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--artifact', required=True, type=Path)
parser.add_argument('--sha256', required=True)
args=parser.parse_args()
original=args.artifact.read_bytes()
assert hashlib.sha256(original).hexdigest()==args.sha256, 'independently pinned fixture bytes differ'
artifact=json.loads(original)

# Compile the exact pure production validator function without running the
# separate public-release gate against this intentionally unapproved draft.
validator=ROOT/'scripts/validate_six_product_ecosystem.py'
tree=ast.parse(validator.read_text(encoding='utf-8'), filename=str(validator))
functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in ['validate_campaign_sample_contract','validate_synthesis_controls']]
assert len(functions)==2
namespace={}
exec(compile(ast.Module(body=functions,type_ignores=[]),str(validator),'exec'),namespace)
generation_commits={key:entry['provenance']['engine_commit'] for key,entry in artifact['outputs'].items()}
def validate(value):
    return namespace['validate_campaign_sample_contract'](value,generation_commits=generation_commits)
validate(artifact)
checked=1
controls=namespace['validate_synthesis_controls']
analysis=(ROOT/'workspace-analysis.html').read_text(encoding='utf-8')
campaign=(ROOT/'campaign-analysis.js').read_text(encoding='utf-8')
controls(analysis,campaign)
control_checks=1
for surface,token in [
    ('analysis','id="campaignEvidence"'),
    ('analysis',"import {mountCampaignAnalysis} from './campaign-analysis.js"),
    ('analysis','mountCampaignAnalysis({element:$("campaignEvidence")'),
    ('analysis','onReport:async(evidence,financialScenarioInput)=>'),
    ('analysis','if(financialScenarioInput!==undefined)requestBody.financial_scenario_input=financialScenarioInput;'),
    ('analysis','campaign_scope_id:evidence.scope.id'),
    ('analysis','Go to campaign evidence'),
    ('analysis','Build self-run Synthesis'),
    ('analysis','$("synthRun")?.addEventListener(\'click\',runSynthesis)'),
    ('campaign','Build Depth Synthesis'),
    ('campaign','Build Cross-Lens Synthesis'),
    ('campaign','View response comparison'),
    ('campaign','data-ca-build'),
    ('campaign',"ready=(cross?r.crossLens:r.depth).status==='satisfied'"),
    ('campaign',"$('[data-ca-build]').onclick="),
    ('campaign','const financialScenario=mountFinancialScenario(content);'),
    ('campaign','await onReport(current,financialScenario())'),
]:
    changed=(analysis if surface=='analysis' else campaign).replace(token,'removed-control')
    try:
        controls(changed if surface=='analysis' else analysis, changed if surface=='campaign' else campaign)
    except AssertionError:
        control_checks+=1
        continue
    raise AssertionError(f'validator accepted missing {surface} control {token!r}')

def rejects(label, change):
    global checked
    altered=copy.deepcopy(artifact)
    change(altered)
    try:
        validate(altered)
    except (AssertionError,KeyError,TypeError):
        checked+=1
        return
    raise AssertionError(f'validator accepted {label}')

rejects('v2 fallback', lambda a:a.update(contract='monderman-public-product-samples/v2'))
rejects('missing committed engine', lambda a:a.pop('engine_commit'))
for key in ['depth_synthesis','cross_lens_synthesis']:
    def source(a): return a['outputs'][key]['source']
    def provenance(a): return a['outputs'][key]['provenance']
    mutations=[
        ('missing product',lambda a:a['outputs'].pop(key)),
        ('different engine provenance',lambda a:provenance(a).update(engine_commit='0'*40)),
        ('missing campaign handoff',lambda a:provenance(a).pop('campaign_handoff_sha256')),
        ('missing source digest',lambda a:provenance(a).pop('source_manifest_sha256')),
        ('real customer provenance',lambda a:provenance(a).update(synthetic=False)),
        ('undisclosed fabricated notes',lambda a:provenance(a).update(experience_source='customer_data')),
        ('withheld score',lambda a:source(a).update(score_status='withheld')),
        ('different score basis',lambda a:source(a).update(score_type='unbounded_mean')),
        ('missing distinct people',lambda a:provenance(a).pop('distinct_included_participants')),
        ('null participants',lambda a:source(a).update(participant_count=None)),
        ('fractional people',lambda a:provenance(a).update(distinct_included_participants=26.5)),
        ('boolean people',lambda a:provenance(a).update(distinct_included_participants=True)),
        ('inflated people',lambda a:source(a).update(participant_count=source(a)['participant_count']+1)),
        ('inflated respondents',lambda a:source(a).update(respondent_count=source(a)['respondent_count']+1)),
        ('runs counted as people',lambda a:source(a).update(participant_count=source(a)['submitted_run_count']+1)),
        ('missing population',lambda a:provenance(a).pop('declared_eligible_population')),
        ('undersized population',lambda a:provenance(a).update(declared_eligible_population=1)),
        ('changed source run count',lambda a:source(a).update(source_result_count=1)),
        ('changed provenance run count',lambda a:provenance(a).update(submitted_run_count=1)),
        ('untrusted count basis',lambda a:source(a).update(count_basis='submitted_runs')),
        ('independence caveat removed',lambda a:source(a).update(participant_count_note='Unique verified people.')),
        ('Strong confidence claim',lambda a:source(a)['evidence_assessment'].update(evidence_label='Strong')),
        ('Substantial confidence claim',lambda a:source(a)['evidence_assessment'].update(evidence_label='Substantial')),
        ('different evidence band',lambda a:source(a)['evidence_assessment'].update(evidence_band='strong')),
        ('missing readiness',lambda a:source(a).pop('campaign_evidence')),
        ('unfinished Depth readiness',lambda a:source(a)['campaign_evidence']['depth'].update(status='in_progress')),
        ('missing policy disclosure',lambda a:source(a)['campaign_evidence']['method'].pop('policyStatus')),
        ('scientific-validation claim',lambda a:source(a)['campaign_evidence']['method'].update(scientificallyValidated=True)),
        ('independent-review claim',lambda a:source(a)['campaign_evidence']['method'].update(independentReviewStatus='approved')),
        ('inflated readiness population',lambda a:source(a)['campaign_evidence']['counts'].update(declaredPopulation=100)),
        ('inflated readiness people',lambda a:source(a)['campaign_evidence']['counts'].update(distinctParticipantsAcrossLenses=100)),
    ]
    score_field='aggregate_score' if key=='depth_synthesis' else 'cross_diagnostic_score'
    for invalid in [None,True,float('nan'),float('inf'),-1,101]:
        rejects(f'{key}: invalid score {invalid}',lambda a,v=invalid:source(a).update({score_field:v}))
    for label,change in mutations:
        rejects(f'{key}: {label}',change)
rejects('unfinished Cross-Lens readiness',lambda a:a['outputs']['cross_lens_synthesis']['source']['campaign_evidence']['crossLens'].update(status='in_progress'))

# Exercise the existing shared source/coverage guard on the same actual public
# deterministic data, including its own adversarial mutants. This path never
# stamps approval or skips the enclosing artifact/AI release validator.
script="""
import fs from 'node:fs';
import {assertPublicCampaignEvidenceGuards} from './scripts/public_sample_fixture.mjs';
const artifact=JSON.parse(fs.readFileSync(0,'utf8'));
const results={};
for(const key of ['depth_synthesis','cross_lens_synthesis']){
  const entry=artifact.outputs[key];
  results[key]=assertPublicCampaignEvidenceGuards(entry.source,entry.provenance,key);
}
console.log(JSON.stringify(results));
"""
shared=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,input=original.decode(),check=True,capture_output=True,text=True)
assert args.artifact.read_bytes()==original, 'the original fixture changed'
print(json.dumps({'passed':True,'campaignChecks':checked,'controlChecks':control_checks,'sharedGuards':json.loads(shared.stdout),
    'sourceCommit':artifact['engine_commit'],'fixtureSha256':args.sha256,
    'providerCalls':0,'privateApiCopies':0,'releaseApproved':False,
    'limitation':'Deterministic contract regression only; full reviewed public release remains separately required.'}))
