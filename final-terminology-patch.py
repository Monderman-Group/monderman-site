from pathlib import Path

changes={
 'index.html':[
  ('An instrument, not an assessment.','A diagnostic instrument built for repeated measurement.'),
  ('Not one-time assessment.','Not a one-time read.'),
 ],
 'why-monderman.html':[
  ('Why Monderman: an instrument, not an assessment.','Why Monderman: a diagnostic instrument built for repeated measurement.'),
  ('One-time assessment is insufficient. Repeated measurement is the unit of value.','One-time diagnosis is insufficient. Repeated measurement is the unit of value.'),
  ('Designed for repeated measurement, not one-time assessment.','Designed for repeated diagnostic measurement.'),
 ],
}
for name,pairs in changes.items():
 p=Path(name); s=p.read_text()
 for old,new in pairs:
  if old not in s: raise SystemExit(f'terminology anchor missing: {name}: {old}')
  s=s.replace(old,new)
 p.write_text(s)

v=Path('scripts/validate_frontend_release.py')
s=v.read_text()
anchor="print('frontend release errors:',len(e))"
guard='''\n# Customer-facing product copy uses Diagnostic terminology. Internal wire keys\n# such as assessment_scope and evidence_assessment are intentionally exempt.\nfor name in ['index.html','why-monderman.html']:\n t=(r/name).read_text(errors='ignore').lower()\n if 'not an assessment' in t or 'one-time assessment' in t:\n  e.append(name+': stale customer-facing assessment terminology')\n'''
if 'stale customer-facing assessment terminology' not in s:
 if anchor not in s: raise SystemExit('validator anchor changed')
 s=s.replace(anchor,guard+'\n'+anchor)
v.write_text(s)
