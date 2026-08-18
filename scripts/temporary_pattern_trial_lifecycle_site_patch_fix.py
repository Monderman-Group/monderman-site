from pathlib import Path
p=Path(__file__).resolve().parent/'temporary_pattern_trial_lifecycle_site_patch.py'
s=p.read_text(encoding='utf-8')

# Actions/Analysis use slightly different cap() helpers.
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
s=s[:start]+''.join(out)+s[end:]

# Diagnostics has two independent module scripts with the same org query and cap helper.
old="s=one(s,q,'organizations(name, plan, anonymous_responses_enabled, campaigns_enabled, respondent_pool, respondents_used, subscription_status, pattern_trial_ends_at)','diagnostics trial fields first query')\n"
new="""if s.count(q)!=2:\n raise SystemExit(f'diagnostics organization query count changed: {s.count(q)}')\ns=s.replace(q,'organizations(name, plan, anonymous_responses_enabled, campaigns_enabled, respondent_pool, respondents_used, subscription_status, pattern_trial_ends_at)',2)\n"""
if old not in s:
    raise SystemExit('diagnostics query patch line not found')
s=s.replace(old,new,1)
old2="s=one(s,anchor,anchor+PLAN_HELPER,'diagnostics rail helper')\n"
new2="""if s.count(anchor)!=2:\n raise SystemExit(f'diagnostics cap helper count changed: {s.count(anchor)}')\ns=s.replace(anchor,anchor+PLAN_HELPER,2)\n"""
if old2 not in s:
    raise SystemExit('diagnostics helper patch line not found')
s=s.replace(old2,new2,1)

p.write_text(s,encoding='utf-8')
print('temporary site patch anchors repaired')
