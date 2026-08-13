from pathlib import Path
import re
r=Path('.')
url='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0'
hashv='sha384-fPWur1rx/DE6YtXP/x0MD6dd90RgnVsz5yX/DIg7CcVAnTBZsENWuIcpvVTM39ti'
for p in r.glob('*.html'):
    t=p.read_text(encoding='utf-8',errors='ignore')
    n=re.sub(r'import\s*\{\s*createClient\s*\}\s*from\s*["\']https://esm\.sh/@supabase/supabase-js@2\.111\.0[^"\']*["\']\s*;', 'const { createClient } = window.supabase;', t)
    if n!=t and url not in n:
        tag=f'<script src="{url}" integrity="{hashv}" crossorigin="anonymous"></script>\n'
        n=n.replace('<script type="module">',tag+'<script type="module">',1)
    if n!=t:
        p.write_text(n,encoding='utf-8')
        print('fixed supabase esm',p.name)
