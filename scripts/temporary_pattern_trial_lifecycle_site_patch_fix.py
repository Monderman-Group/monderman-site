from pathlib import Path
p=Path(__file__).resolve().parent/'temporary_pattern_trial_lifecycle_site_patch.py'
s=p.read_text(encoding='utf-8')
start=s.index('# Action Plans and Analysis rail chips.')
end=s.index('# Diagnostics: first module owns shell chrome.')
segment=s[start:end]
lines=segment.splitlines(keepends=True)
found=0
out=[]
i=0
while i < len(lines):
    line=lines[i]
    if line.startswith(" anchor='''    function cap(s){"):
        if i+1>=len(lines) or lines[i+1].strip()!="'''":
            raise SystemExit('unexpected cap anchor shape')
        out.extend([
            ' if filename=="workspace-analysis.html":\n',
            "  anchor='''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }\n",
            "'''\n",
            ' else:\n',
            "  anchor='''    function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : (s||\"\"); }\n",
            "'''\n",
        ])
        found+=1
        i+=2
        continue
    out.append(line); i+=1
if found!=1:
    raise SystemExit(f'expected one Analysis/actions cap anchor, found {found}')
newseg=''.join(out)
p.write_text(s[:start]+newseg+s[end:],encoding='utf-8')
print('temporary site patch anchor repaired')
