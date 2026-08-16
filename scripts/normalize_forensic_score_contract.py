from pathlib import Path

p = Path(__file__).resolve().parents[1] / "monderman-report.js"
s = p.read_text(encoding="utf-8")
old = 'Number.isInteger(score) ? String(score) : fmt1(score)'
new = 'Number.isInteger(score) ? score : Math.round(score * 10) / 10'
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit("Synthesis score-contract expression not found")
p.write_text(s, encoding="utf-8")
print("FORENSIC_SCORE_CONTRACT_NORMALIZED")
