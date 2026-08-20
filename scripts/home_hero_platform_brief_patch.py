from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')

old = '<a class="btn btn-secondary" href="connect.html">Discuss a diagnostic</a>'
new = '<a class="btn btn-secondary" href="Monderman_Platform_Brief.html">View Platform Brief</a>'

if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one old hero CTA, found {text.count(old)}')
text = text.replace(old, new, 1)

if old in text:
    raise SystemExit('Old hero CTA remains')
if text.count(new) != 1:
    raise SystemExit('New Platform Brief CTA not present exactly once')
if text.count('Run one yourself — free') != 1:
    raise SystemExit('Primary free-run CTA changed unexpectedly')

p.write_text(text, encoding='utf-8')
