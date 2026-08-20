from pathlib import Path

p = Path('Monderman_Platform_Brief.html')
text = p.read_text(encoding='utf-8')

old_css = '.instrument-card h3{margin:0;font-size:1.04rem}.instrument-title-link{color:var(--ink);text-decoration:none;position:relative}.instrument-title-link::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:1px;background:var(--teal);transform:scaleX(0);transform-origin:left;transition:transform 180ms ease}.instrument-title-link:hover,.instrument-title-link:focus-visible{color:var(--teal);outline:none}.instrument-title-link:hover::after,.instrument-title-link:focus-visible::after{transform:scaleX(1)}.instrument-card p{margin:0;color:var(--muted);font-size:.85rem;line-height:1.45}'
new_css = '.instrument-card h3{margin:0;font-size:1.04rem}.instrument-card p{margin:0;color:var(--muted);font-size:.85rem;line-height:1.45}.instrument-inline-link{display:inline-flex;align-items:center;gap:6px;margin-top:10px;color:var(--teal);font-size:.72rem;font-weight:700;line-height:1.2}.instrument-inline-link:hover,.instrument-inline-link:focus-visible{color:var(--teal-dark);text-decoration:underline;text-underline-offset:3px}'
if text.count(old_css) != 1:
    raise SystemExit('Expected instrument title-link CSS exactly once')
text = text.replace(old_css, new_css, 1)

repls = {
    '<h3><a class="instrument-title-link" href="structural-clarity-article.html">Structural Clarity</a></h3></div><p>Is the system legible?</p>': '<h3>Structural Clarity</h3></div><p>Is the system legible?</p><a class="instrument-inline-link" href="structural-clarity-article.html">Read article →</a>',
    '<h3><a class="instrument-title-link" href="decision-velocity-article.html">Decision Velocity</a></h3></div><p>Does time move through it?</p>': '<h3>Decision Velocity</h3></div><p>Does time move through it?</p><a class="instrument-inline-link" href="decision-velocity-article.html">Read article →</a>',
    '<h3><a class="instrument-title-link" href="operational-systems-article.html">Operational Systems</a></h3></div><p>How much weight is it carrying?</p>': '<h3>Operational Systems</h3></div><p>How much weight is it carrying?</p><a class="instrument-inline-link" href="operational-systems-article.html">Read article →</a>',
    '<h3><a class="instrument-title-link" href="institutional-performance-article.html">Institutional Performance</a></h3></div><p>Does it still hold under load?</p>': '<h3>Institutional Performance</h3></div><p>Does it still hold under load?</p><a class="instrument-inline-link" href="institutional-performance-article.html">Read article →</a>',
}
for old, new in repls.items():
    if text.count(old) != 1:
        raise SystemExit(f'Expected markup exactly once: {old[:60]}')
    text = text.replace(old, new, 1)

text = text.replace('The Diagnostics remain distinct measurements. Each title opens the related instrument article.', 'The Diagnostics remain distinct measurements. Each tile links to the related instrument article.', 1)

if 'instrument-title-link' in text:
    raise SystemExit('Obsolete title-only link class remains')
if text.count('class="instrument-inline-link"') != 4:
    raise SystemExit('Expected four visible article links')
for href in ['structural-clarity-article.html','decision-velocity-article.html','operational-systems-article.html','institutional-performance-article.html']:
    if text.count(f'href="{href}"') != 1:
        raise SystemExit(f'Expected one link to {href}')

p.write_text(text, encoding='utf-8')
