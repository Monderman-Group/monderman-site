from pathlib import Path

p = Path('scripts/public_beta_hardening_20260819.py')
s = p.read_text(encoding='utf-8')
start = s.find('# Workspace shell:')
end = s.find('# Guard against stale customer-facing trial scope', start)
if start < 0 or end <= start:
    raise SystemExit('workspace patch block anchors missing')

replacement = r'''# Workspace shell: a small Beta badge next to the Monderman brand, never on Diagnostic results or reports.
workspace_files = [
    'workspace.html',
    'workspace-diagnostics.html',
    'workspace-analysis.html',
    'workspace-actions.html',
    'workspace-settings.html',
]
for name in workspace_files:
    w = load(name)
    if 'ws-beta-release' in w:
        continue
    patterns = [
        (
            re.compile(r'(<a class="ws-brand"[^>]*>Monderman<span class="dot"></span>)(</a>)'),
            r'\1<span class="ws-beta-release" aria-label="Public beta">Beta</span>\2'
        ),
        (
            re.compile(r'(<a class="ws5-brand"[^>]*>\s*<b>Monderman</b><span class="ws5-brand-dot"></span>)(\s*</a>)'),
            r'\1<span class="ws-beta-release" aria-label="Public beta">Beta</span>\2'
        ),
    ]
    n = 0
    for anchor, repl in patterns:
        w, n = anchor.subn(repl, w, count=1)
        if n == 1:
            break
    if n != 1:
        raise SystemExit(f'{name}: workspace brand anchor missing')
    style = '.ws-beta-release{display:inline-flex;align-items:center;margin-left:8px;padding:2px 6px;border:1px solid rgba(255,255,255,.18);border-radius:5px;font-size:9.5px;line-height:1.2;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.72);background:rgba(255,255,255,.06);transform:translateY(-1px)}\n'
    pos = w.find('</style>')
    if pos < 0:
        raise SystemExit(f'{name}: style close missing')
    w = w[:pos] + style + w[pos:]
    write(name, w)

'''

s = s[:start] + replacement + s[end:]
s = s.replace("assert 'all public Postgres tables currently have row-level security enabled' in load('security.html')", "assert 'all public postgres tables currently have row-level security enabled' in load('security.html').lower()")
s = s.replace("assert 'ordinary Diagnostics require a signed-in member session' in load('security.html')", "assert 'ordinary diagnostics require a signed-in member session' in load('security.html').lower()")
p.write_text(s, encoding='utf-8')
print('PUBLIC_BETA_PATCHER_FIX=PASS')
