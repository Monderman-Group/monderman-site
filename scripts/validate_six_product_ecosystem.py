from pathlib import Path
import re
import json
import subprocess

ROOT=Path(__file__).resolve().parents[1]

def text(name): return (ROOT/name).read_text(encoding='utf-8')
def require(src, token, label):
    if token not in src: raise AssertionError(f'{label}: missing {token!r}')
def forbid(src, token, label):
    if token.lower() in src.lower(): raise AssertionError(f'{label}: forbidden customer term {token!r}')

def validate_synthesis_controls(analysis, campaign):
    import re
    # Validate the actual local module import by its named bindings. Extra
    # reviewed helpers, whitespace and the asset version do not change the
    # identity of the mounted campaign module.
    imports = re.findall(
        r'''(?m)^[ \t]*import\s*\{([^{}]*)\}\s*from\s*(['"])(\./campaign-analysis\.js(?:\?[^'"\r\n]*)?)\2\s*;''',
        analysis,
    )
    bindings = {name.strip() for names, _quote, _module in imports for name in names.split(',')}
    for name in ['mountCampaignAnalysis', 'campaignSalaryCostRequest']:
        assert name in bindings, f'Analysis control missing local campaign module binding: {name!r}'
        assert re.search(r'(?m)^export\s+function\s+' + name + r'\s*\(', campaign), f'Campaign module missing export: {name!r}'
    # The campaign buttons moved into the mounted module. Require both their
    # current labels and the page/module event wiring, not obsolete page copy.
    for token in [
        'id="campaignEvidence"',
        'mountCampaignAnalysis({element:$("campaignEvidence")',
        'onReport:async(evidence,financialScenarioInput,campaignSalaryCost)=>', 'campaign_scope_id:evidence.scope.id',
        'if(financialScenarioInput!==undefined)requestBody.financial_scenario_input=financialScenarioInput;',
        'const salaryCost=campaignSalaryCostRequest(evidence,financialScenarioInput,campaignSalaryCost);',
        'if(salaryCost)requestBody.campaign_salary_cost=salaryCost;',
        'Go to campaign evidence', 'Build self-run Synthesis',
        '$("synthRun")?.addEventListener(\'click\',runSynthesis)',
    ]:
        assert token in analysis, f'Analysis control missing: {token!r}'
    for token in [
        'Build Depth Synthesis', 'Build Cross-Lens Synthesis',
        'View response comparison', 'data-ca-build',
        "ready=(cross?r.crossLens:r.depth).status==='satisfied'",
        "$('[data-ca-build]').onclick=", 'const financialScenario=mountFinancialScenario(content);',
        'const scenario=financialScenario();', 'await onReport(current,scenario,financialScenario.campaignSalaryCost(scenario));',
        'catch(error){message(error.message,true);', 'notice.focus({preventScroll:true});',
    ]:
        assert token in campaign, f'Campaign control missing: {token!r}'

def validate_readiness_invitations(overview, analysis, notifier):
    # Labels now live in the shared, server-readiness-driven component. Validate
    # the real import/mount/target on both pages, not words in unrelated markup.
    for page, target, label in [
        (overview, 'wsSynthesisReadiness', 'Overview'),
        (analysis, 'wsReadyInvitations', 'Analysis'),
    ]:
        for token in [
            f'id="{target}" hidden aria-label="Ready campaign analyses"',
            "import {mountSynthesisReadiness} from './workspace-synthesis-readiness.js",
            f'mountSynthesisReadiness({{element:$("{target}")',
            'workspace-synthesis-readiness.css?v=',
            'getContext:async()=>', 'canAnalyze:',
        ]:
            require(page, token, f'{label} readiness component')
    require(overview, 'Compare your own saved runs', 'Overview personal comparison')
    require(overview, 'href="workspace-analysis.html#synthesis"', 'Overview personal comparison')
    for token in [
        "initialScopeId:new URLSearchParams(location.search).get('campaign_scope')",
        'onReview:scopeId=>campaignAnalysis?.review(scopeId)',
    ]:
        require(analysis, token, 'Analysis manual review')
    for token in [
        "const LABELS={depth:'Depth Synthesis',cross_lens:'Cross-Lens Synthesis'}",
        "node('h3',LABELS[item.kind])", 'export function mountSynthesisReadiness(',
        "['admin','analyst'].includes(context.role)", 'payload.canAnalyze!==true',
        'payload.organizationId!==organizationId', "item.status!=='satisfied'",
        'item.evaluated!==true', "'/readiness-summary'", "method:'GET'", "cache:'no-store'",
        "node('a','Review ready analysis')", "node('button','Keep collecting')",
        "review.href='workspace-analysis.html?campaign_scope='+encodeURIComponent(item.scopeId)+'#campaignEvidence'",
        'await onReview(item.scopeId)', 'window.location.assign(review.href)',
        'Nothing is generated automatically.',
    ]:
        require(notifier, token, 'Shared readiness invitation')
    for token in ["method:'POST'", 'method:"POST"', '/api/synthesis', 'onReport(']:
        assert token not in notifier, f'Readiness invitation must not generate reports: {token!r}'
    for token in ['2+ candidates', 'Review Depth candidates', 'Review Cross-Lens candidates']:
        assert token not in overview, f'Overview must not substitute counts for campaign readiness: {token!r}'

def readiness_negative_controls(overview, analysis, notifier):
    # In-memory mutations: deleting the real module, wiring, gates or labels
    # must fail. No files are modified and no customer interaction is simulated.
    cases=[
        (overview, analysis, ''),
        (overview.replace('import {mountSynthesisReadiness}', 'import {removedReadiness}'), analysis, notifier),
        (overview.replace('mountSynthesisReadiness({element:', 'removedMount({element:'), analysis, notifier),
        (overview.replace('id="wsSynthesisReadiness"', 'id="removedTarget"'), analysis, notifier),
        (overview, analysis.replace('import {mountSynthesisReadiness}', 'import {removedReadiness}'), notifier),
        (overview, analysis.replace('mountSynthesisReadiness({element:', 'removedMount({element:'), notifier),
        (overview, analysis.replace('onReview:scopeId=>campaignAnalysis?.review(scopeId)', 'onReview:()=>{}'), notifier),
        (overview, analysis, notifier.replace("depth:'Depth Synthesis'", "depth:'Wrong name'")),
        (overview, analysis, notifier.replace("cross_lens:'Cross-Lens Synthesis'", "cross_lens:'Wrong name'")),
        (overview, analysis, notifier.replace("item.status!=='satisfied'", 'false')),
        (overview, analysis, notifier.replace('payload.canAnalyze!==true', 'false')),
        (overview, analysis, notifier.replace("workspace-analysis.html?campaign_scope=", 'wrong-page.html?scope=')),
        (overview, analysis, notifier+"\nfetch('/api/synthesis',{method:'POST'});"),
    ]
    for index, values in enumerate(cases):
        try:
            validate_readiness_invitations(*values)
        except AssertionError:
            continue
        raise AssertionError(f'Readiness negative control {index+1} did not fail')
    return len(cases)

def validate_campaign_sample_contract(artifact, *, generation_commits):
    """Check current deterministic showcase data, not AI or release approval.

    The mandatory public_sample_fixture --check below independently requires
    the reviewed release and its exact source hashes. Recorded identities and
    sponsor-declared coverage must not become claims of scientific validity.
    """
    import math
    import re
    assert artifact['contract']=='monderman-public-product-samples/v3', 'current v3 samples required'
    assert re.fullmatch(r'[a-f0-9]{40}', artifact['engine_commit']), 'committed engine provenance required'
    expected={
        'depth_synthesis': ('within_lens_median', 1, 'aggregate_score'),
        'cross_lens_synthesis': ('equal_lens_mean', 4, 'cross_diagnostic_score'),
    }
    for key,(score_type,lens_count,score_field) in expected.items():
        entry=artifact['outputs'][key]
        result,provenance=entry['source'],entry['provenance']
        assert entry['kind']=='synthesis' and result['report_kind']==key, f'{key}: product identity changed'
        assert provenance['synthetic'] is True, f'{key}: synthetic provenance missing'
        # The top-level commit identifies assembly, not when each retained
        # example was generated. Compare original provenance to its separately
        # pinned release entry; do not relabel retained samples as new runs.
        assert re.fullmatch(r'[a-f0-9]{40}', provenance['engine_commit']), f'{key}: original engine provenance missing'
        assert provenance['engine_commit']==generation_commits[key], f'{key}: engine provenance differs'
        for field in ['input_sha256','result_sha256','source_manifest_sha256','campaign_handoff_sha256']:
            assert re.fullmatch(r'[a-f0-9]{64}', provenance[field]), f'{key}: {field} missing'
        assert provenance['experience_source']=='fabricated_participant_accounts'
        assert provenance['operating_review_source']=='fabricated_operational_corroboration'
        assert result['score_status']=='published', f'{key}: showcase score is withheld'
        assert result['score_type']==score_type, f'{key}: score basis changed'
        score=result[score_field]
        assert type(score) in (int,float) and math.isfinite(score) and 0<=score<=100, f'{key}: score missing or invalid'
        assert result['lens_count']==lens_count and len(provenance['questionnaire_versions'])==lens_count
        evidence=result['evidence_assessment']
        assert evidence['evidence_band']=='campaign_readiness_satisfied', f'{key}: campaign readiness not satisfied'
        assert evidence['evidence_label']=='Campaign readiness checks satisfied', f'{key}: misleading evidence-strength label'
        people=provenance['distinct_included_participants']
        population=provenance['declared_eligible_population']
        runs=provenance['submitted_run_count']
        assert type(people) is int and people>0, f'{key}: recorded distinct participants missing'
        assert type(population) is int and population>=people, f'{key}: declared population invalid'
        assert type(runs) is int and runs==people*lens_count, f'{key}: shared participants confused with runs'
        for field in ['participant_count','respondent_count']:
            assert type(result[field]) is int and result[field]==people, f'{key}: {field} differs from provenance'
        for field in ['submitted_run_count','source_result_count']:
            assert type(result[field]) is int and result[field]==runs, f'{key}: {field} differs from provenance'
        assert result['count_basis']=='server_bound_account_or_invitation_identities'
        assert 'not independent proof' in result['participant_count_note']
        campaign=result['campaign_evidence']
        assert campaign['version']=='campaign-evidence-readiness-20260911.1'
        method=campaign['method']
        assert method['policyStatus']=='provisional_product_policy', f'{key}: provisional policy disclosure missing'
        assert method['scientificallyValidated'] is False, f'{key}: false scientific-validation claim'
        assert method['independentReviewStatus']=='not_reviewed', f'{key}: false independent-review claim'
        assert campaign['counts']=={
            'selectedRuns':runs, 'declaredPopulation':population,
            'recordedEligibleParticipants':people, 'distinctParticipantsAcrossLenses':people,
        }, f'{key}: readiness counts differ from provenance'
        assert campaign['depth']['status']=='satisfied', f'{key}: Depth readiness not satisfied'
        if key=='cross_lens_synthesis':
            assert campaign['crossLens']['status']=='satisfied', 'Cross-Lens readiness not satisfied'

public_files=[
 'index.html','diagnostics.html','why-monderman.html','platform-services.html',
 'plan-signal.html','plan-pattern.html','plan-enterprise.html','checkout.html',
 'sample-report.html','Monderman_Platform_Brief.html'
]
public='\n'.join(text(f) for f in public_files)
for token in [
 'per employee','per-employee','combined read','Cross-Diagnostic Synthesis','Cross-Tool Synthesis',
 'front line against','executive seat','Executive lens','unlimited people','Insight depth',
 'Expert help','Meta-diagnostic','Meta-diagnostics','seat charge','seat-free',
 'analyst accounts','admin accounts','executive-seat'
]:
    forbid(public,token,'public truth sweep')

for token in ['Depth Synthesis','Cross-Lens Synthesis','No per-participant pricing','Operational','Managerial','Senior Leader']:
    require(public,token,'public truth sweep')

signal=text('plan-signal.html')
for token in [
    '2,400 completed participant responses a year','60 new Syntheses a year',
    'two analyst workspace users','one admin workspace user',
    'Pattern includes anonymous participant responses and a larger Synthesis allowance',
    '$24,000 for a 12-month term', '$2,000 monthly installments', '$21,600 prepaid for the year',
    'Self-runs by authorized Workspace users are unlimited',
    'available at the start of each annual term under either payment option',
]:
    require(signal,token,'Signal')
for token in ['50 completed participant responses','12 Syntheses','Unlimited Syntheses','interval=quarterly']:
    forbid(signal,token,'Signal retired offer')
pattern=text('plan-pattern.html')
for token in [
    '6,000 completed participant responses a year','300 new Syntheses a year',
    'anonymous participant responses','five analyst workspace users','two admin workspace users',
    '$54,000 for a 12-month term', '$4,500 monthly installments', '$48,600 prepaid for the year',
    'Self-runs by authorized Workspace users are unlimited',
    'available at the start of each annual term under either payment option',
]:
    require(pattern,token,'Pattern')
for token in ['500 completed participant responses','Unlimited Syntheses','interval=quarterly']:
    forbid(pattern,token,'Pattern retired paid offer')
enterprise=text('plan-enterprise.html')
for token in [
    'unlimited participant responses','unlimited Syntheses','Self-runs, participant responses, Syntheses, and Workspace users are unlimited.',
    'Unlimited analyst and admin workspace users','bespoke Diagnostic or participant-perspective design'
]:
    require(enterprise,token,'Enterprise')
for token in ['participant-response capacity is defined in the order form','workspace-user capacity defined in the order form']:
    forbid(enterprise,token,'Enterprise')

analysis=text('workspace-analysis.html')
for token in ['/api/synthesis','/api/synthesis-runs','Why the Composite was withheld','What could unlock a Composite','Latest Diagnostic snapshot','Calibration position','Before-and-after change']:
    require(analysis,token,'Analysis')
validate_synthesis_controls(analysis,text('campaign-analysis.js'))
for token in ['Analysis richness','Vs sector','Intervention impact']:
    forbid(analysis,token,'Analysis')

measure=text('workspace-diagnostics.html')
for token in ['Staged → Reviewed','Include in analysis','Remove from analysis','Diagnostic campaigns','Operational','Managerial','Senior Leader','anonymous_responses_enabled']:
    require(measure,token,'Measure')
require(measure,'["admin","owner"]','Measure owner/admin')

actions=text('workspace-actions.html')
for token in ['source_synthesis_id','remeasure_synthesis_id','ITEM_COLS','/api/synthesis-runs','Link a like-for-like Synthesis']:
    require(actions,token,'Action Plans')

overview=text('workspace.html')
for token in [
    'Unlimited self-runs','org.run_limit','org.respondent_pool','org.aggregation_limit',
    'Full annual response and Synthesis capacity is available upfront, with no monthly reset',
    'workspace-analysis.html#synthesis','workspace-diagnostics.html#campaigns',
]:
    require(overview,token,'Overview')
notifier=text('workspace-synthesis-readiness.js')
validate_readiness_invitations(overview,analysis,notifier)
readiness_negative_count=readiness_negative_controls(overview,analysis,notifier)
for token in ['Most of your organization is under strain','Your organization is holding steady','critical level']:
    forbid(overview,token,'Overview')

# The product must retain the evidence-discipline behavior: real Cross-Lens
# reports explain withholding when coherence is insufficient.
report=text('cross-tool-synthesis.html')
for token in ['/api/synthesis-runs/','Median Diagnostic Score','Cross-Lens Composite Score withheld','Print or save as PDF']:
    require(report,token,'Synthesis report')

# The flagship marketing sample demonstrates a valid published result using
# the reviewed artifact, not hand-authored scores or participant-count literals.
# Withholding remains certified on the actual product surface above.
sample=text('sample-report.html')
subprocess.run(
    ['node',str(ROOT/'scripts/public_sample_fixture.mjs'),'--check','--root',str(ROOT)],
    check=True, capture_output=True, text=True,
)
artifact=json.loads(text('sample-data/production-diagnostic-samples.json'))
for token in [
    'Cross-Lens Synthesis','Depth Synthesis',
    'Structural Clarity','Decision Velocity','Operational Systems','Institutional Performance',
    'These reports use realistic example responses to demonstrate Monderman’s analysis and reporting.',
]:
    require(sample,token,'Sample report')
for tab in ['os','dv','sc','ip','synthesis','depth']:
    require(sample,f'id="report-{tab}"','Sample report')
    require(sample,f'aria-controls="report-{tab}"','Sample report accessible tab')
release=json.loads(text('sample-data/production-sample-release.json'))
validate_campaign_sample_contract(artifact,generation_commits={key:entry['provenance']['engine_commit'] for key,entry in release['outputs'].items()})
for token in [
    'MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES',
    'Composite Score withheld','Comparison Only','insight-depth','Insight depth',
    'four-instrument composed','compounded exposure','executive-seat','one per seat',
    'per seat-year','unedited output','identical to a real run',
]:
    forbid(sample,token,'Sample report')

# Organizational-value contract. The product may identify leadership burden,
# leadership action, and Senior Leader vantage evidence. It may not frame the
# recovered value or product purpose as belonging to that layer.
value_files = [
    'about.html', 'why-monderman.html', 'roi.html', 'sample-report.html',
    'operational-systems-article.html', 'decision-velocity-article.html',
    'structural-clarity-article.html', 'institutional-performance-article.html',
    'operational-systems.html', 'decision-velocity.html',
    'structural-clarity.html', 'institutional-performance.html',
]
value_surfaces = '\n'.join(text(name) for name in value_files) + '\n' + text('monderman-report.js')
for token in [
    'absorbs leadership capacity', 'capacity leadership could reclaim',
    'Senior hours returned to mission', 'senior time returns to mission',
    'leadership-facing readout', 'concise leadership readout',
    'This summary is written for leaders', 'Monderman is built for leaders',
    'Leadership bottom line', 'Bottom line for leadership',
    'Treat senior attention as a scarce operating resource',
    'spending its scarcest resource',
]:
    forbid(value_surfaces, token, 'organizational-value contract')

role_re = re.compile(r'\b(?:senior(?:[- ]leader)?s?|leaders?|leadership|executives?)\b', re.I)
resource_re = re.compile(r'\b(?:time|hours?|money|attention|capacity|bandwidth|productivity)\b', re.I)
recovery_re = re.compile(r'\b(?:return(?:ed|ing|s)?|reclaim(?:ed|ing|s)?|recover(?:ed|ing|s)?|restore(?:d|ing|s)?|free(?:d|ing|s)?|sav(?:e|ed|es|ing)|give(?:s|n|ing)?\s+back)\b', re.I)
role = r'(?:senior(?:[- ]leader)?s?|leaders?|leadership|executives?)'
resource = r'(?:time|hours?|money|attention|capacity|bandwidth|productivity)'
recovery = r'(?:return(?:ed|ing|s)?|reclaim(?:ed|ing|s)?|recover(?:ed|ing|s)?|restore(?:d|ing|s)?|free(?:d|ing|s)?|sav(?:e|ed|es|ing)|give(?:s|n|ing)?\s+back)'
role_benefit_patterns = [
    re.compile(rf'\b{recovery}\b.{{0,80}}\b{role}\b.{{0,40}}\b{resource}\b', re.I),
    re.compile(rf'\b{role}\b.{{0,40}}\b{resource}\b.{{0,80}}\b{recovery}\b', re.I),
    re.compile(rf'\b{role}\b.{{0,40}}\b{recovery}\b.{{0,40}}\b{resource}\b', re.I),
    re.compile(rf'\b{resource}\b.{{0,30}}\b{role}\b.{{0,40}}\b{recovery}\b', re.I),
]
visible_value_surfaces = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', ' ', value_surfaces, flags=re.I | re.S)
visible_value_surfaces = re.sub(r'<[^>]+>', ' ', visible_value_surfaces)
for sentence in re.split(r'(?<=[.!?])\s+', visible_value_surfaces):
    if '?' in sentence:
        continue
    if any(pattern.search(sentence) for pattern in role_benefit_patterns):
        raise AssertionError(f'organizational-value contract: recovered value assigned to a role: {sentence.strip()[:180]!r}')

for token in [
    'Use separately declared operational measurements and assumptions for financial planning.',
    'Organizational implication',
    'Value staff time as potential capacity, not as an automatic cash reduction.',
]:
    require(value_surfaces, token, 'organizational-value contract')

print({'ok':True,'public_files':len(public_files),'workspace_contract':'pass','plan_contract':'pass','flagship_cross_lens':'published_provisional_campaign_readiness','readiness_negative_controls':readiness_negative_count})
print('Six-product ecosystem vocabulary, entitlement, workflow, evidence-discipline, and flagship-sample validation passed.')
