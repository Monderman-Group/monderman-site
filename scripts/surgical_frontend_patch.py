from pathlib import Path
import re

R = Path('.')

# 1) Homepage counter: keep comma and plus sign after animation.
p = R / 'index.html'
t = p.read_text(encoding='utf-8')
t, n_counter = re.subn(r'data-count-type="plain" data-target="7000"', 'data-count-type="plain-plus" data-target="7000"', t, count=1)
if n_counter != 1:
    raise SystemExit(f'expected one 7000 plain counter, found {n_counter}')
needle = 'if (type === "currency-trillion") return `$${Math.round(value)}T`;'
insert = needle + '\n      if (type === "plain-plus") return `${Math.round(value).toLocaleString("en-US")}+`;'
if 'type === "plain-plus"' not in t:
    if needle not in t:
        raise SystemExit('counter formatter anchor missing')
    t = t.replace(needle, insert, 1)

# 2) Normalize malformed lazy-load img markup introduced by prior rewrite.
t, n_imgs = re.subn(r'<img([^<>]*?)\s*/\s+loading="lazy">', r'<img\1 loading="lazy" />', t)
if n_imgs != 7:
    raise SystemExit(f'expected 7 malformed lazy image tags, found {n_imgs}')
p.write_text(t, encoding='utf-8')

# 3) Restore defer on the four diagnostic pages' SRI-protected classic libraries.
libs = (
    'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0',
)
for name in ('decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html'):
    p = R / name
    t = p.read_text(encoding='utf-8')
    for url in libs:
        pat = re.compile(r'(<script\s+src="' + re.escape(url) + r'"\s+integrity="[^"]+"\s+crossorigin="anonymous")(\s*)(></script>)', re.I)
        t, n = pat.subn(r'\1 defer\2\3', t, count=1)
        if n != 1:
            raise SystemExit(f'{name}: expected one SRI tag for {url}, found {n}')
    p.write_text(t, encoding='utf-8')

# 4) Extend release validator to lock these fixes in.
p = R / 'scripts/validate_frontend_release.py'
v = p.read_text(encoding='utf-8')
extra = r'''
# Surgical regression guards added 2026-08-13.
idx=(r/'index.html').read_text(errors='ignore')
if 'data-count-type="plain-plus" data-target="7000"' not in idx or 'type === "plain-plus"' not in idx or 'toLocaleString("en-US")' not in idx:
 e.append('homepage 7000+ counter formatting')
if re.search(r'<img[^>]*?/\s+loading="lazy">',idx,re.I):
 e.append('malformed homepage lazy-load img markup')
for name in ['decision-velocity.html','operational-systems.html','structural-clarity.html','institutional-performance.html']:
 t=(r/name).read_text(errors='ignore')
 for url in ['chart.js@4.5.1/dist/chart.umd.min.js','html2canvas/1.4.1/html2canvas.min.js','jspdf/2.5.1/jspdf.umd.min.js','@supabase/supabase-js@2.111.0']:
  tags=[m.group(0) for m in re.finditer(r'<script\s+[^>]*src="[^"]*'+re.escape(url)+r'[^"]*"[^>]*>',t,re.I)]
  if not tags or not any('integrity=' in tag and 'crossorigin=' in tag and re.search(r'\bdefer\b',tag,re.I) for tag in tags):
   e.append(name+': deferred SRI library '+url)
'''
marker = "print('frontend release errors:',len(e))"
if 'Surgical regression guards added 2026-08-13.' not in v:
    if marker not in v:
        raise SystemExit('validator print anchor missing')
    v = v.replace(marker, extra + '\n' + marker, 1)
p.write_text(v, encoding='utf-8')

print('surgical patch applied')
