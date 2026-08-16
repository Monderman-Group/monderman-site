from pathlib import Path
p = Path(__file__).resolve().parents[1] / "monderman-report.js"
s = p.read_text(encoding="utf-8")
old = '  function renderLensSummary(m, n) {\n    if (!arr(m.sourceGroups).length) return "";'
new = '  function renderLensSummary(m, n) {\n    if (m.product === "depth") return "";\n    if (!arr(m.sourceGroups).length) return "";'
if new not in s:
    if old not in s:
        raise SystemExit('renderLensSummary anchor not found')
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('REDUNDANT_DEPTH_LENS_SECTION_REMOVED')
