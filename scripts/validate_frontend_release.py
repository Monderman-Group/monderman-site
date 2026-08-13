from pathlib import Path
import sys
r=Path('.')
errors=[]
for f in ["decision-velocity-acceptance-harness.html","operational-systems-acceptance-harness.html","structural-clarity-acceptance-harness.html","structural-clarity-acceptance-harness.js","harness-qc-matrix.html","harness-security.html","harness-two-tenant.html"]:
    if (r/f).exists(): errors.append("public harness: "+f)
for p in r.glob("*.html"):
    t=p.read_text(errors="ignore")
    for s in ["book-jacket.jpg","collect nothing about you","agree to Monderman’s terms","Where you stand versus similar organizations","TYPICAL INDUSTRY RANGE","Similar-pathway context"]:
        if s in t: errors.append(f"{p.name}: forbidden release string: {s}")
    if not p.name.startswith("google") and 'rel="canonical"' not in t: errors.append(f"{p.name}: missing canonical")
if not (r/'robots.txt').exists(): errors.append('missing robots.txt')
if not (r/'sitemap.xml').exists(): errors.append('missing sitemap.xml')
print('frontend release errors:',len(errors))
for e in errors: print('ERROR',e)
sys.exit(1 if errors else 0)
