from pathlib import Path
import re

p = Path('Monderman_Platform_Brief.html')
text = p.read_text(encoding='utf-8')


def sub_once(pattern, repl, label, flags=re.S):
    global text
    updated, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    text = updated


# 1) Instrument section: eliminate expanding link rows and card-selection motion.
static_instrument_css = r'''.instrument-stage{display:grid;grid-template-columns:1fr 190px 1fr;grid-template-rows:auto auto;gap:16px 24px;align-items:center;margin-top:30px}.instrument-card{width:100%;border:1px solid var(--line);background:#fff;border-radius:14px;padding:19px 20px 18px;transition:transform 220ms var(--ease),border-color 220ms var(--ease),box-shadow 220ms var(--ease)}.instrument-card.sc{grid-column:1;grid-row:1}.instrument-card.dv{grid-column:3;grid-row:1}.instrument-card.os{grid-column:1;grid-row:2}.instrument-card.ip{grid-column:3;grid-row:2}.instrument-card:hover{transform:translateY(-2px);border-color:rgba(12,110,120,.28);box-shadow:0 12px 28px rgba(24,25,28,.055)}.instrument-head{display:flex;align-items:center;gap:12px;margin-bottom:11px}.instrument-card h3{margin:0;font-size:1.04rem}.instrument-title-link{color:var(--ink);text-decoration:none;position:relative}.instrument-title-link::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:1px;background:var(--teal);transform:scaleX(0);transform-origin:left;transition:transform 180ms ease}.instrument-title-link:hover,.instrument-title-link:focus-visible{color:var(--teal);outline:none}.instrument-title-link:hover::after,.instrument-title-link:focus-visible::after{transform:scaleX(1)}.instrument-card p{margin:0;color:var(--muted);font-size:.85rem;line-height:1.45}.instrument-center{grid-column:2;grid-row:1/3;align-self:stretch;border:1px solid rgba(12,110,120,.20);border-radius:999px;background:linear-gradient(180deg,rgba(12,110,120,.055),rgba(12,110,120,.02));display:flex;align-items:center;justify-content:center;text-align:center;padding:16px}.instrument-center strong{font-size:.98rem;line-height:1.25}
'''
sub_once(
    r'\.instrument-stage\{.*?\.instrument-readout span\{font-size:\.82rem;color:var\(--muted\);text-align:right\}\n',
    static_instrument_css,
    'static instrument CSS',
)

instrument_markup = r'''<section class="slide white" id="slide-3" data-title="The instruments"><div class="slide-inner"><p class="eyebrow reveal">The product</p><h2 class="reveal delay-1">Four instruments. Four different questions about the same institution.</h2><p class="lede reveal delay-2">The Diagnostics remain distinct measurements. Each title opens the related instrument article.</p><div class="instrument-stage reveal delay-2"><article class="instrument-card sc"><div class="instrument-head"><svg class="glyph" viewBox="0 0 32 32" aria-hidden="true"><path class="glyph-stroke" d="M7 9h9M7 16h18M7 23h13"/></svg><h3><a class="instrument-title-link" href="structural-clarity-article.html">Structural Clarity</a></h3></div><p>Is the system legible?</p></article><article class="instrument-card dv"><div class="instrument-head"><svg class="glyph" viewBox="0 0 32 32" aria-hidden="true"><path class="glyph-stroke" d="M8 24 24 8M15 8h9v9"/></svg><h3><a class="instrument-title-link" href="decision-velocity-article.html">Decision Velocity</a></h3></div><p>Does time move through it?</p></article><div class="instrument-center"><strong>Administrative<br/>reality</strong></div><article class="instrument-card os"><div class="instrument-head"><svg class="glyph" viewBox="0 0 32 32" aria-hidden="true"><rect class="glyph-stroke" x="6" y="7" width="20" height="18" rx="3"/><path class="glyph-stroke" d="M10 12h12M10 17h12M10 22h7"/></svg><h3><a class="instrument-title-link" href="operational-systems-article.html">Operational Systems</a></h3></div><p>How much weight is it carrying?</p></article><article class="instrument-card ip"><div class="instrument-head"><svg class="glyph" viewBox="0 0 32 32" aria-hidden="true"><path class="glyph-stroke" d="M6 26h21M9 24V15M16 24V8M23 24v-6"/></svg><h3><a class="instrument-title-link" href="institutional-performance-article.html">Institutional Performance</a></h3></div><p>Does it still hold under load?</p></article></div></div></section>'''
sub_once(
    r'<section class="slide white" id="slide-3" data-title="The instruments">.*?</section>',
    instrument_markup,
    'instrument section markup',
)

# Remove obsolete instrument-card interaction code now that the titles are ordinary links.
sub_once(
    r";const cards=\[\.\.\.document\.querySelectorAll\('\.instrument-card'\)\];const name=document\.getElementById\('instrumentName'\);const copy=document\.getElementById\('instrumentCopy'\);cards\.forEach\(card=>card\.addEventListener\('click',\(\)=>\{cards\.forEach\(c=>c\.classList\.toggle\('is-active',c===card\)\);name\.textContent=card\.dataset\.name;copy\.textContent=card\.dataset\.copy\+' Each completed Diagnostic produces its own scored Result and Executive Report\.'\}\)\)",
    '',
    'obsolete instrument JS',
)

# Responsive grid rules for static instrument cards.
sub_once(
    r'\.instrument-stage\{grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto\}\.instrument-shell\.sc\{grid-column:1;grid-row:1\}\.instrument-shell\.dv\{grid-column:2;grid-row:1\}\.instrument-center\{grid-column:1/3;grid-row:2;border-radius:16px;min-height:88px\}\.instrument-shell\.os\{grid-column:1;grid-row:3\}\.instrument-shell\.ip\{grid-column:2;grid-row:3\}',
    '.instrument-stage{grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto}.instrument-card.sc{grid-column:1;grid-row:1}.instrument-card.dv{grid-column:2;grid-row:1}.instrument-center{grid-column:1/3;grid-row:2;border-radius:16px;min-height:88px}.instrument-card.os{grid-column:1;grid-row:3}.instrument-card.ip{grid-column:2;grid-row:3}',
    'tablet instrument CSS',
)
sub_once(
    r'\.instrument-shell\.sc,\.instrument-shell\.dv,\.instrument-shell\.os,\.instrument-shell\.ip,\.instrument-center\{grid-column:1;grid-row:auto\}\.instrument-center\{min-height:76px\}\.instrument-readout\{display:block\}\.instrument-readout span\{display:block;margin-top:8px;text-align:left\}',
    '.instrument-card.sc,.instrument-card.dv,.instrument-card.os,.instrument-card.ip,.instrument-center{grid-column:1;grid-row:auto}.instrument-center{min-height:76px}',
    'mobile instrument CSS',
)

# 2) Cross-Lens: put all four Diagnostics in one vertical stack and use canonical product terminology.
cross_css = r'''.cross-viz{height:82px}.cross-viz svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.cross-path{fill:none;stroke:rgba(169,207,210,.44);stroke-width:1.2;stroke-dasharray:4 5;animation:crossFlow 6s linear infinite}.cross-path:nth-child(2){animation-delay:-1.5s}.cross-path:nth-child(3){animation-delay:-3s}.cross-path:nth-child(4){animation-delay:-4.5s}@keyframes crossFlow{to{stroke-dashoffset:-36}}.cross-source{position:absolute;left:0;width:28px;height:18px;border:1px solid rgba(169,207,210,.28);border-radius:6px;display:grid;place-items:center;font-size:.53rem;font-weight:700;color:var(--teal-light);background:rgba(255,255,255,.035)}.cross-source.sc{top:1px}.cross-source.dv{top:21px}.cross-source.os{top:41px}.cross-source.ip{top:61px}.cross-gate{position:absolute;right:2px;top:18px;width:76px;height:46px;border:1px solid rgba(201,130,31,.55);border-radius:8px;display:grid;place-items:center;text-align:center;font-size:.5rem;line-height:1.15;letter-spacing:.045em;text-transform:uppercase;color:#E5B15F;background:rgba(201,130,31,.07);padding:4px}
'''
sub_once(
    r'\.cross-viz\{height:66px\}.*?\.cross-gate\{position:absolute;right:5px;top:16px;width:58px;height:38px;border:1px solid rgba\(201,130,31,\.55\);border-radius:8px;display:grid;place-items:center;text-align:center;font-size:\.54rem;line-height:1\.15;letter-spacing:\.05em;text-transform:uppercase;color:#E5B15F;background:rgba\(201,130,31,\.07\)\}',
    cross_css.rstrip(),
    'Cross-Lens CSS',
)

cross_markup = r'''<div class="cross-viz" aria-hidden="true"><span class="cross-source sc">SC</span><span class="cross-source dv">DV</span><span class="cross-source os">OS</span><span class="cross-source ip">IP</span><svg viewBox="0 0 200 82" preserveAspectRatio="none"><path class="cross-path" d="M30 10 C76 10 96 28 126 41"/><path class="cross-path" d="M30 30 C76 30 98 35 126 41"/><path class="cross-path" d="M30 50 C76 50 98 47 126 41"/><path class="cross-path" d="M30 70 C76 70 96 54 126 41"/></svg><span class="cross-gate">coherence<br/>requirements</span></div>'''
sub_once(
    r'<div class="cross-viz" aria-hidden="true">.*?<span class="cross-gate">evidence<br/>gate</span></div>',
    cross_markup,
    'Cross-Lens markup',
)

# 3) Economics: show actual representative directional figures for time and dollars.
sub_once(
    r'\.econ-output-row b\{display:block;font-size:\.82rem;color:var\(--ink\)\}\.econ-output-row small\{display:block;margin-top:3px;font-size:\.66rem;color:var\(--muted\)\}',
    '.econ-output-row b{display:block;margin-top:3px;font-size:1.08rem;line-height:1.05;color:var(--ink);letter-spacing:-.025em}.econ-output-row small{display:block;margin-top:5px;font-size:.64rem;line-height:1.35;color:var(--muted)}.econ-output-label{display:block;font-size:.64rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}.econ-footnote{grid-column:1/-1;margin:-4px 0 0;font-size:.66rem;line-height:1.45;color:var(--muted2);text-align:center}',
    'economics figure CSS',
)
sub_once(
    r'<div class="econ-output-row"><div><b>Time</b><small>annual hours</small></div><div><b>Labor cost</b><small>annual dollars</small></div></div>',
    '<div class="econ-output-row"><div><span class="econ-output-label">Time</span><b>5,280 hrs*</b><small>directional annual exposure</small></div><div><span class="econ-output-label">Labor cost</span><b>$411,840*</b><small>directional annual exposure</small></div></div>',
    'economics directional figures',
)
sub_once(
    r'<p class="econ-formula">Measured condition \+ disclosed inputs → directional exposure → separately labeled recovery scenario\.</p>',
    '<p class="econ-formula">Measured condition + disclosed inputs → directional exposure → separately labeled recovery scenario.</p><p class="econ-footnote">*Directional numbers only, from the representative sample organization; not a benchmark or guarantee.</p>',
    'economics directional footnote',
)

# Final guards.
for href in [
    'structural-clarity-article.html',
    'decision-velocity-article.html',
    'operational-systems-article.html',
    'institutional-performance-article.html',
]:
    if text.count(f'href="{href}"') != 1:
        raise SystemExit(f'Expected one title link to {href}')

for forbidden in ['instrument-article', 'instrumentName', 'instrumentCopy', 'evidence<br/>gate']:
    if forbidden in text:
        raise SystemExit(f'Obsolete token remains: {forbidden}')

required = [
    'coherence<br/>requirements',
    '.cross-source.ip{top:61px}',
    '5,280 hrs*',
    '$411,840*',
    '*Directional numbers only, from the representative sample organization; not a benchmark or guarantee.',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required token: {token}')

p.write_text(text, encoding='utf-8')
