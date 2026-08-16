from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / 'sample-report.html'
s = p.read_text(encoding='utf-8')

# Cross-Lens sample must visibly identify its contributing Diagnostics, not merely describe the method.
if 'Representative contributing Diagnostics' not in s:
    pattern = r'(<section class="section" id="synthesis-headline">.*?<p class="lede">.*?</p>)(</section>)'
    cards = '''<div class="panel bench" style="margin-top:18px;"><h3 style="margin-top:0;">Representative contributing Diagnostics</h3><p><strong>Structural Clarity — 53.</strong> Ownership and handoff clarity are the principal constraints in this illustrative bounded scope.</p><p style="margin-top:10px;"><strong>Decision Velocity — 78.</strong> The decision pathway is materially healthier than the Structural Clarity result; that disagreement is itself useful evidence and is preserved rather than averaged away.</p></div>'''
    s, n = re.subn(pattern, lambda m: m.group(1) + cards + m.group(2), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('Could not locate Cross-Lens synthesis headline section')

s = s.replace(
    '<div class="panel bench"><h3 style="margin-top:0;">Why</h3><p>The illustrative selection does not meet the Coherent evidence threshold. Withholding is a product output, not an error: the comparison remains available while the single Composite Score is suppressed.</p></div>',
    '<div class="panel bench"><h3 style="margin-top:0;">Why</h3><p><strong>Evidence strength: Comparison Only.</strong> The illustrative selection does not meet the Coherent evidence threshold. Withholding is a product output, not an error: the comparison remains available while the single Composite Score is suppressed.</p></div>'
)
s = s.replace('scope, timing, instrument versions, source identity', 'scope, timing, Diagnostic/scorer versions, source identity')

p.write_text(s, encoding='utf-8')
print('CROSS_LENS_SAMPLE_MARKETING_ALIGNMENT_COMPLETE')
