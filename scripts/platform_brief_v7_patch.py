from pathlib import Path

p = Path('Monderman_Platform_Brief.html')
text = p.read_text(encoding='utf-8')
old = 'coherence<br/>requirements'
new = 'Composite<br/>threshold'
if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one {old!r}, found {text.count(old)}')
text = text.replace(old, new, 1)
if old in text:
    raise SystemExit('Old Cross-Lens label remains')
if text.count(new) != 1:
    raise SystemExit('New Cross-Lens label not present exactly once')
p.write_text(text, encoding='utf-8')
