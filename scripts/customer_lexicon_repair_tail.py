from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]

def replace_file(name, pairs):
    p=ROOT/name
    s=p.read_text(encoding='utf-8')
    for old,new in pairs:
        s=s.replace(old,new)
    p.write_text(s,encoding='utf-8')

# Enterprise capacities are scoped rather than advertised as unlimited.
replace_file('plan-enterprise.html',[
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
 ('Bespoke diagnostics built to your structure','Bespoke Diagnostics built to your structure'),
 ('Multi-entity measurement as scoped &mdash; subsidiaries, commands, or portfolios in comparable reads','Multi-entity measurement as scoped &mdash; subsidiaries, commands, or portfolios with comparable results'),
 ('Participant responses, Syntheses &amp; accounts','Participant responses, Syntheses &amp; workspace users'),
 ('<div><dt>The allowance</dt><dd>Capacity is defined in the order form applies. Response capacity is agreed to your size on your order form. The only other scoped quantity is bespoke Diagnostic or vantage design.</dd></div>',
  '<div><dt>Capacity</dt><dd>Participant-response, Synthesis, and workspace-user capacity are stated in the order form. Bespoke Diagnostic or vantage design is scoped separately when required.</dd></div>'),
 ('Your diagnostic inputs and reads are used only to generate and support your diagnostics.','Your Diagnostic inputs and results are used only to generate and support your Diagnostics.'),
 ('the assumption set behind every score is published with the read.','the basis behind every score is published with the Executive Report.'),
 ('where a structural edge case affects your read.','where a structural edge case affects your result.'),
])

# Signal: use the product vocabulary customers see in the workspace.
replace_file('plan-signal.html',[
 ('Four diagnostics, one ruler.','Four Diagnostics, one ruler.'),
 ('All four diagnostics are included','All four Diagnostics are included'),
 ('verified on the instrument, not asserted in a binder','verified by remeasurement, not asserted in a binder'),
 ('All four diagnostics &mdash; Structural Clarity, Decision Velocity, Operational Systems, Institutional Performance','All four Diagnostics &mdash; Structural Clarity, Decision Velocity, Operational Systems, Institutional Performance'),
 ('<span class="num">Unlimited</span> reads you run yourself &mdash; never metered, no per-run charge','<span class="num">Unlimited</span> self-runs &mdash; never metered, no per-run charge'),
 ('Every depth &mdash; the <span class="num">10</span>, <span class="num">30</span> and <span class="num">60</span> minute instruments','Every Diagnostic depth &mdash; <span class="num">10</span>, <span class="num">30</span>, and <span class="num">60</span> minutes'),
 ('The full written deliverable on every read, with the assumption set published alongside it','An Executive Report for every completed run, with the basis of the score published alongside it'),
 ('<span class="num">2</span> analyst accounts','<span class="num">3</span> workspace users &mdash; 2 analysts and 1 admin'),
 ('two analyst accounts, and one admin account','two analyst workspace users and one admin workspace user'),
 ('Two analyst accounts and one admin account.','Two analyst workspace users and one admin workspace user.'),
 ('Your diagnostic inputs and reads are used only to generate and support your diagnostics.','Your Diagnostic inputs and results are used only to generate and support your Diagnostics.'),
 ('the assumption set behind every score is published with the read.','the basis behind every score is published with the Executive Report.'),
 ('where a structural edge case affects your read.','where a structural edge case affects your result.'),
 ('You are an early customer of an instrument that is still maturing','You are an early customer of a product suite that is still maturing'),
])

# Pattern: distinguish repeated evidence from a vague "read" metaphor and use participants/workspace users.
replace_file('plan-pattern.html',[
 ('One read is a signal. Many reads are a pattern.','One result is a signal. Repeated evidence reveals a pattern.'),
 ('Every respondent, every vantage','Every participant, every vantage'),
 ('and you still get the read.','and you still get the result.'),
 ('All four diagnostics &mdash; Structural Clarity, Decision Velocity, Operational Systems, Institutional Performance','All four Diagnostics &mdash; Structural Clarity, Decision Velocity, Operational Systems, Institutional Performance'),
 ('every diagnostic, depth and vantage, unlimited reads you run yourself','every Diagnostic, depth, and vantage, with unlimited self-runs'),
 ('<span class="num">5</span> analyst accounts and <span class="num">2</span> admin accounts','<span class="num">7</span> workspace users &mdash; 5 analysts and 2 admins'),
 ('five analyst accounts, and two admin accounts','five analyst workspace users and two admin workspace users'),
 ('Five analyst accounts and two admin accounts.','Five analyst workspace users and two admin workspace users.'),
 ('Participant responses, Syntheses &amp; accounts','Participant responses, Syntheses &amp; workspace users'),
 ('Your diagnostic inputs and reads are used only to generate and support your diagnostics.','Your Diagnostic inputs and results are used only to generate and support your Diagnostics.'),
 ('the assumption set behind every score is published with the read.','the basis behind every score is published with the Executive Report.'),
 ('where a structural edge case affects your read.','where a structural edge case affects your result.'),
 ('You are an early customer of an instrument that is still maturing','You are an early customer of a product suite that is still maturing'),
])

# Platform Services: remove remaining commercial uses of instrument/read and make upgrade triggers value-based.
replace_file('platform-services.html',[
 ('with the basis stated on every read: disclosed inputs, sector calibration, and instrument version.','with the basis stated in every Executive Report: disclosed inputs, sector calibration, and instrument version.'),
 ('<li><b>Unlimited reads you run yourself</b> &mdash; never metered</li>','<li><b>Unlimited self-runs</b> &mdash; never metered</li>'),
 ('Step up to <b>Pattern</b> when 50 responses stops covering the people you need to ask.','Step up to <b>Pattern</b> when you need larger campaigns, anonymous responses, unlimited Syntheses, or a larger workspace team.'),
 ('Ten times the response capacity, no ceiling on combining, and room for a real analyst bench. One read is a signal. Many are a pattern.','Ten times the participant-response capacity, unlimited Syntheses, anonymous campaigns, and room for a larger analysis team.'),
 ('new instruments engineered to your structure, deterministic by construction','new Diagnostics designed for your structure, deterministic by construction'),
 ('You&rsquo;re an early customer of instruments that deepen on schedule','You&rsquo;re an early customer of Diagnostics and Syntheses that improve on a published cadence'),
 ('<tr><td class="rowlabel">Reads you run yourself</td><td class="num">3 readable</td><td class="num">Unlimited</td><td class="num">Unlimited</td><td class="num">Unlimited</td></tr>',''),
 ('Population reads &mdash; sample statistics, splits, vantage gaps','Cohort statistics, distributions, and vantage gaps'),
])

# Home-page metadata and common commercial phrases.
replace_file('index.html',[
 ('suite of deterministic diagnostic instruments','suite of deterministic Diagnostics'),
 ('one instrument','one Diagnostic'),
])
replace_file('diagnostics.html',[
 ('one instrument','one Diagnostic'),
])

# The four live Diagnostic pages use Run evidence for customer-visible evidence context.
for name in ['decision-velocity.html','operational-systems.html','institutional-performance.html','structural-clarity.html']:
    replace_file(name,[('Insight depth','Run evidence'),('insight depth','run evidence')])

# Representative Sample Reports: no role-as-seat language and no obsolete evidence score.
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
s=re.sub(r'\bseats\b','vantages',s,flags=re.I)
s=re.sub(r'\bseat\b','role',s,flags=re.I)
p.write_text(s,encoding='utf-8')

print('FINAL_CONTEXTUAL_LEXICON_CLEANUP_COMPLETE')
