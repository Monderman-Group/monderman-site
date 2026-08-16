from pathlib import Path

p = Path(__file__).resolve().parents[1] / "scripts/meta_synthesis_frontend_fixture.mjs"
s = p.read_text(encoding="utf-8")
old = 'assert.match(depthHtml, /Respondent distribution/);'
new = 'assert.match(depthHtml, /Observed participant distribution/);'
if old not in s and new not in s:
    raise SystemExit("Depth distribution fixture assertion not found")
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("SYNTHESIS_FIXTURE_TERMINOLOGY_ALIGNED")
