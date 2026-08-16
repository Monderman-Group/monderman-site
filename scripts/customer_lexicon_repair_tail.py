from pathlib import Path
p=Path(__file__).resolve().parents[1]/'plan-enterprise.html'
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
print('ENTERPRISE_LEXICON_TAIL_COMPLETE')
