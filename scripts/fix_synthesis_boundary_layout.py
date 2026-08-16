from pathlib import Path
p = Path(__file__).resolve().parents[1] / "monderman-report.js"
s = p.read_text(encoding="utf-8")
old = '.mr-report .mr-report-boundary{margin:-18px 0 46px;padding:20px 22px;background:#F6F3EC;border:1px solid rgba(12,110,120,.18);border-left:4px solid #0C6E78;border-radius:0 12px 12px 0}'
new = '.mr-report .mr-report-boundary{display:block!important;grid-template-columns:none!important;margin:-18px 0 46px;padding:20px 22px;background:#F6F3EC;border:1px solid rgba(12,110,120,.18);border-left:4px solid #0C6E78;border-radius:0 12px 12px 0}'
if old not in s and new not in s:
    raise SystemExit('Synthesis boundary presentation rule not found')
if old in s:
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
print('SYNTHESIS_BOUNDARY_LAYOUT_FIXED')
