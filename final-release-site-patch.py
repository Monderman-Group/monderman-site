from pathlib import Path

files = {
    'decision-velocity.html': '/api/decision-velocity-narrative',
    'structural-clarity.html': '/api/structural-clarity-narrative',
    'operational-systems.html': '/api/operational-systems-narrative',
    'institutional-performance.html': '/api/institutional-performance-narrative',
}

marker = 'if (refinedExperienceLayer?.hasInput) {'

def remove_block(text, endpoint):
    removed = 0
    pos = 0
    while True:
        start = text.find(marker, pos)
        if start < 0:
            break
        probe = text[start:start + 9000]
        if endpoint not in probe:
            pos = start + len(marker)
            continue
        brace = text.find('{', start)
        depth = 0
        end = None
        for i in range(brace, len(text)):
            c = text[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            raise RuntimeError(f'unclosed retired narrative block for {endpoint}')
        before = start
        while before > 0 and text[before - 1] in ' \t':
            before -= 1
        if before > 0 and text[before - 1] == '\n':
            before -= 1
        after = end
        while after < len(text) and text[after] in ' \t':
            after += 1
        if after < len(text) and text[after] == '\n':
            after += 1
        text = text[:before] + '\n' + text[after:]
        removed += 1
        pos = max(0, before)
    if removed == 0:
        raise RuntimeError(f'no retired narrative caller found for {endpoint}')
    if endpoint in text:
        raise RuntimeError(f'retired narrative endpoint remains after cleanup: {endpoint}')
    return text, removed

for name, endpoint in files.items():
    p = Path(name)
    text = p.read_text()
    text, removed = remove_block(text, endpoint)
    if name == 'decision-velocity.html':
        text = text.replace('const FINALIZE_TIMEOUT_MS = 90000;', 'const FINALIZE_TIMEOUT_MS = 280000;')
    p.write_text(text)
    print(name, 'retired blocks removed:', removed)

v = Path('scripts/validate_frontend_release.py')
s = v.read_text()
guard = '''\n# Retired diagnostic API routes must never return as browser callers.\nretired_by_page={\n 'decision-velocity.html':['/api/decision-velocity-narrative','/api/decision-velocity-score'],\n 'structural-clarity.html':['/api/structural-clarity-narrative','/api/structural-clarity-score'],\n 'operational-systems.html':['/api/operational-systems-narrative','/api/operational-systems-score'],\n 'institutional-performance.html':['/api/institutional-performance-narrative','/api/institutional-performance-score'],\n}\nfor name,urls in retired_by_page.items():\n t=(r/name).read_text(errors='ignore')\n for url in urls:\n  if url in t:e.append(name+': retired route caller '+url)\n m=re.search(r'const FINALIZE_TIMEOUT_MS = (\\d+);',t)\n if not m or int(m.group(1)) < 90000:e.append(name+': finalize timeout below 90 seconds')\n'''
anchor = "print('frontend release errors:',len(e))"
if 'Retired diagnostic API routes must never return as browser callers.' not in s:
    if anchor not in s:
        raise RuntimeError('frontend validator anchor changed')
    s = s.replace(anchor, guard + '\n' + anchor)
v.write_text(s)
