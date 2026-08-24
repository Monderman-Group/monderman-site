from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def text(name): return (ROOT/name).read_text(encoding='utf-8')
def require(src, token, label):
    if token not in src: raise AssertionError(f'{label}: missing {token!r}')
def forbid(src, token, label):
    if token.lower() in src.lower(): raise AssertionError(f'{label}: forbidden customer term {token!r}')

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
for token in ['50 completed participant responses','12 Syntheses','two analyst workspace users','one admin workspace user','Anonymous participant responses and unlimited Syntheses are part of Pattern']:
    require(signal,token,'Signal')
pattern=text('plan-pattern.html')
for token in ['500 completed participant responses','Unlimited Syntheses','anonymous participant responses','five analyst workspace users','two admin workspace users']:
    require(pattern,token,'Pattern')
enterprise=text('plan-enterprise.html')
for token in [
    'unlimited participant responses','unlimited Syntheses','unlimited self-runs',
    'Unlimited analyst and admin workspace users','bespoke Diagnostic or participant-perspective design'
]:
    require(enterprise,token,'Enterprise')
for token in ['participant-response capacity is defined in the order form','workspace-user capacity defined in the order form']:
    forbid(enterprise,token,'Enterprise')

analysis=text('workspace-analysis.html')
for token in ['/api/synthesis','/api/synthesis-runs','Build Depth Synthesis','Build Cross-Lens Synthesis','Why the Composite was withheld','What could unlock a Composite','Latest Diagnostic snapshot','Calibration position','Before-and-after change']:
    require(analysis,token,'Analysis')
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
for token in ['No per-participant pricing','Depth Synthesis','Cross-Lens Synthesis','workspace-analysis.html#synthesis','workspace-diagnostics.html#campaigns']:
    require(overview,token,'Overview')
for token in ['Most of your organization is under strain','Your organization is holding steady','critical level']:
    forbid(overview,token,'Overview')

# The product must retain the evidence-discipline behavior: real Cross-Lens
# reports explain withholding when coherence is insufficient.
report=text('cross-tool-synthesis.html')
for token in ['/api/synthesis-runs/','Median Diagnostic Score','Cross-Lens Composite Score withheld','Print or save as PDF']:
    require(report,token,'Synthesis report')

# The flagship marketing sample should demonstrate the strongest valid outcome,
# not default to a withholding case. Withholding remains certified above.
sample=text('sample-report.html')
for token in [
    'Cross-Lens Synthesis','Median Diagnostic Score','Cross-Lens Composite Score',
    'score_status: "published"','evidence_label: "Strong"','cross_diagnostic_score: 55.5',
    'Structural Clarity','Decision Velocity','Operational Systems','Institutional Performance',
    'evidence_label: "Substantial"','respondent_count: 18',
    'Representative sample','Directional single-run evidence','Evidence status.','What the participant added'
]:
    require(sample,token,'Sample report')
for token in [
    'Composite Score withheld','Comparison Only','insight-depth','Insight depth',
    'four-instrument composed','compounded exposure','executive-seat','one per seat',
    'per seat-year','unedited output','identical to a real run'
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
    'return time, money, and productive capacity to the organization',
    'Organizational implication',
    'Hours returned to mission across the measured unit, per week.',
]:
    require(value_surfaces, token, 'organizational-value contract')

print({'ok':True,'public_files':len(public_files),'workspace_contract':'pass','plan_contract':'pass','flagship_cross_lens':'published_strong'})
print('Six-product ecosystem vocabulary, entitlement, workflow, evidence-discipline, and flagship-sample validation passed.')
