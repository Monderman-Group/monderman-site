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
 'sample-report.html','Monderman_Infographic.html','Monderman_Platform_Brief.html'
]
public='\n'.join(text(f) for f in public_files)
for token in ['per employee','per-employee','combined read','Cross-Diagnostic Synthesis','Cross-Tool Synthesis','front line against','executive seat','Executive lens','unlimited people']:
    forbid(public,token,'public truth sweep')

for token in ['Depth Synthesis','Cross-Lens Synthesis','No per-participant pricing','Operational','Managerial','Senior Leader']:
    require(public,token,'public truth sweep')

signal=text('plan-signal.html')
for token in ['50 completed participant responses','12 Syntheses','two analyst accounts','one admin account','Anonymous participant responses and unlimited Syntheses are part of Pattern']:
    require(signal,token,'Signal')
pattern=text('plan-pattern.html')
for token in ['500 completed participant responses','Unlimited Syntheses','anonymous participant responses','five analyst accounts','two admin accounts']:
    require(pattern,token,'Pattern')
enterprise=text('plan-enterprise.html')
for token in ['unlimited participant responses','unlimited analyst and admin accounts','bespoke Diagnostic or vantage design']:
    require(enterprise,token,'Enterprise')

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

report=text('cross-tool-synthesis.html')
for token in ['/api/synthesis-runs/','Median Diagnostic Score','Cross-Lens Composite Score withheld','Print or save as PDF']:
    require(report,token,'Synthesis report')

sample=text('sample-report.html')
for token in ['Cross-Lens Synthesis','Median Diagnostic Score','Composite Score withheld','What would unlock a Composite Score']:
    require(sample,token,'Sample report')
for token in ['insight-depth','four-instrument composed','compounded exposure']:
    forbid(sample,token,'Sample report')

print({'ok':True,'public_files':len(public_files),'workspace_contract':'pass','plan_contract':'pass'})
print('Six-product ecosystem vocabulary, entitlement, workflow, and truth-sweep validation passed.')
