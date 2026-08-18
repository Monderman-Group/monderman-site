from pathlib import Path
p=Path(__file__).resolve().parent/'temporary_pattern_trial_lifecycle_site_patch.py'
s=p.read_text(encoding='utf-8')
old=''' anchor=''' + "'''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : (s||\"\"); }\\n'''" + '''\n s=one(s,anchor,anchor+PLAN_HELPER,filename+' rail helper')\n'''
new=''' if filename=="workspace-analysis.html":\n  anchor=''' + "'''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }\\n'''" + '''\n else:\n  anchor=''' + "'''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : (s||\"\"); }\\n'''" + '''\n s=one(s,anchor,anchor+PLAN_HELPER,filename+' rail helper')\n'''
if old not in s:
    raise SystemExit('site patch loop anchor not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('temporary site patch anchor repaired')
