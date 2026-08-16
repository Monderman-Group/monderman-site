from pathlib import Path

p = Path('monderman-report.js')
s = p.read_text(encoding='utf-8')
original = s

old = '''    html += renderCrossLensEvidenceMap(m);
    if (signals.length) {
      html += '<h3 style="margin-top:14px">Recurring signals</h3>' + signals.map((signal) =>
        '<div class="mr-card"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +
        (signal.tools.length ? '<div>' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') +
        (signal.limit ? '<p class="mr-copy">' + esc(signal.limit) + '</p>' : '') + '</div>'
      ).join("");
    }'''
new = '''    const crossLensMapped = m.product === "cross_lens";
    html += renderCrossLensEvidenceMap(m);
    if (signals.length && !crossLensMapped) {
      html += '<h3 style="margin-top:14px">Recurring signals</h3>' + signals.map((signal) =>
        '<div class="mr-card"><h3>' + esc(signal.label) + '</h3><p>' + esc(signal.text) + '</p>' +
        (signal.tools.length ? '<div>' + signal.tools.map((tool) => '<span class="mr-pill">' + esc(humanize(tool)) + '</span>').join("") + '</div>' : '') +
        (signal.limit ? '<p class="mr-copy">' + esc(signal.limit) + '</p>' : '') + '</div>'
      ).join("");
    }'''

if old not in s:
    raise SystemExit('expected mapped-signal presentation block not found')
s = s.replace(old, new, 1)

# Explicit byte-level guard against rendering the same Cross-Lens signal detail
# twice. Depth Synthesis retains its normal recurring-signal cards.
if 'const crossLensMapped = m.product === "cross_lens";' not in s:
    raise SystemExit('cross-lens duplication guard missing')

if s == original:
    raise SystemExit('refinement made no changes')

p.write_text(s, encoding='utf-8')
print('final Cross-Lens presentation refinement applied')
