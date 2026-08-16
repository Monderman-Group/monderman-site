from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'sample-report.html'
s = p.read_text(encoding='utf-8')
s = s.replace(
    '<div class="panel bench"><h3 style="margin-top:0;">Why</h3><p>The illustrative selection does not meet the Coherent evidence threshold. Withholding is a product output, not an error: the comparison remains available while the single Composite Score is suppressed.</p></div>',
    '<div class="panel bench"><h3 style="margin-top:0;">Why</h3><p><strong>Evidence strength: Comparison Only.</strong> The illustrative selection does not meet the Coherent evidence threshold. Withholding is a product output, not an error: the comparison remains available while the single Composite Score is suppressed.</p></div>'
)
s = s.replace('scope, timing, instrument versions, source identity', 'scope, timing, Diagnostic/scorer versions, source identity')
p.write_text(s, encoding='utf-8')
print('CROSS_LENS_SAMPLE_EVIDENCE_LABEL_ALIGNED')
