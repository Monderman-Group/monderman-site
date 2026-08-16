from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]

p=ROOT/'plan-enterprise.html'
s=p.read_text(encoding='utf-8')
for old,new in [
 ('Unlimited participant responses','Participant-response capacity defined in the order form'),
 ('unlimited participant responses','participant-response capacity defined in the order form'),
 ('unlimited analyst and admin accounts','workspace-user capacity defined in the order form'),
 ('Unlimited analyst and admin accounts','Workspace-user capacity defined in the order form'),
 ('unlimited workspace users','workspace-user capacity defined in the order form'),
 ('Unlimited workspace users','Workspace-user capacity defined in the order form'),
 ('No platform ceiling','Capacity is defined in the order form'),
 ('no platform ceiling','capacity is defined in the order form'),
 ('No fixed ceiling','Capacity is defined in the order form'),
 ('no fixed ceiling','capacity is defined in the order form'),
 ('bespoke instrument work','bespoke Diagnostic or vantage design'),
 ('Bespoke instrument work','Bespoke Diagnostic or vantage design'),
]:
    s=s.replace(old,new)
p.write_text(s,encoding='utf-8')

for name in ['decision-velocity.html','operational-systems.html','institutional-performance.html','structural-clarity.html']:
    p=ROOT/name
    s=p.read_text(encoding='utf-8')
    s=s.replace('Insight depth','Run evidence').replace('insight depth','run evidence')
    p.write_text(s,encoding='utf-8')

p=ROOT/'sample-report.html'
s=p.read_text(encoding='utf-8')
for old,new in [
    ('transfers with the seat instead of leaving with the person','transfers with the role instead of leaving with the person'),
    ('All three seats describe','All three vantages describe'),
    ('all three seats describe','all three vantages describe'),
    ('three seats describe','three vantages describe'),
    ('three seats','three vantages'),
    ('seat-year','person-year'),
    ('seat year','person-year'),
]:
    s=s.replace(old,new)
# In this report library, any residual use of seat refers to an organizational role/vantage, never physical seating.
s=re.sub(r'\bseats\b','vantages',s,flags=re.I)
s=re.sub(r'\bseat\b','role',s,flags=re.I)
p.write_text(s,encoding='utf-8')

print('FINAL_VISIBLE_LEXICON_CLEANUP_COMPLETE')
