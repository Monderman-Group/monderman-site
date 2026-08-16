from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# Customer-facing vocabulary only. Technical implementation identifiers are not rewritten.
GLOBAL = [
    ("Executive perspective", "Senior Leader perspective"),
    ("executive perspective", "Senior Leader perspective"),
    ("the executive seat", "the Senior Leader vantage"),
    ("executive seat", "Senior Leader vantage"),
    ("executive-seat", "Senior Leader"),
    ("one per seat", "one per participant vantage"),
    ("Cross-diagnostic synthesis", "Cross-Lens Synthesis"),
    ("cross-diagnostic synthesis", "Cross-Lens Synthesis"),
    ("Meta-diagnostics", "Synthesis"),
    ("meta-diagnostics", "Synthesis"),
    ("Meta-diagnostic", "Synthesis"),
    ("meta-diagnostic", "Synthesis"),
    ("Expert help", "Expert support"),
    ("expert help", "expert support"),
]

for path in ROOT.glob("*.html"):
    s = path.read_text(encoding="utf-8")
    for old, new in GLOBAL:
        s = s.replace(old, new)
    path.write_text(s, encoding="utf-8")

# ---- Platform Services: one commercial vocabulary + locked entitlements ----
p = ROOT / "platform-services.html"
s = p.read_text(encoding="utf-8")
repls = {
    "Built for a team, a division, or an organization. Same instruments, different scale.":
        "Built for a team, a division, or an organization. Same Diagnostics, different scale.",
    "Every tier runs all four diagnostics. What changes is how many people you can ask, and how much of the organization the answer speaks for. Prices are published in full below, which almost nobody in this category does.":
        "Every paid tier includes all four Diagnostics. What changes is campaign capacity, Synthesis allowance, anonymity, and the number of workspace users who can manage the work. Prices are published in full below.",
    "Every diagnostic estimates the fully-burdened cost of administrative drag at your own baseline":
        "Each Diagnostic estimates the fully-burdened cost of administrative drag at your own baseline",
    "of the burden a diagnostic measures that the instrument estimates as recoverable":
        "of the burden a Diagnostic measures that the model estimates as recoverable",
    "The instruments never change. The number of people you can ask does.":
        "The Diagnostics do not change. Your deployment capacity does.",
    "All four diagnostics": "All four Diagnostics",
    "no instrument locked": "all four included",
    "bespoke instruments": "bespoke Diagnostics",
    "Bespoke diagnostics": "Bespoke Diagnostics",
    "instruments built for your organization": "Diagnostics built for your organization",
    "bespoke diagnostics": "bespoke Diagnostics",
    "standard instruments": "standard Diagnostics",
    "standard four Diagnostics": "four standard Diagnostics",
    "owning an instrument": "using a Diagnostic",
    "Self-run diagnostic users": "Self-run Diagnostics",
    "self-run diagnostic users": "self-runs",
    "Platform support and analyst help are different things.": "Platform support and expert support are different things.",
    "Signal &mdash; platform help": "Signal &mdash; platform support",
    "Any analyst services are scoped up front": "Any expert advisory services are scoped up front",
    "Every read estimates": "Every Diagnostic estimates",
    "Your diagnostic inputs and reads": "Your Diagnostic inputs and results",
    "your diagnostics, never sold": "your Diagnostics, never sold",
}
for old, new in repls.items():
    s = s.replace(old, new)

s = s.replace(
    '<tr><td class="rowlabel">Self-run Diagnostics</td><td class="num" colspan="4">Unlimited on every tier &mdash; never a seat charge</td></tr>',
    '<tr><td class="rowlabel">Self-run Diagnostics</td><td class="num">3 total</td><td class="num">Unlimited</td><td class="num">Unlimited</td><td class="num">Unlimited</td></tr>'
)
s = s.replace(
    '<div class="ps-tier-for"><b>For an organization.</b> Unlimited platform response capacity and workspace users, with bespoke Diagnostic or vantage design available as separately scoped work when the standard product does not fit.</div>',
    '<div class="ps-tier-for"><b>For an organization.</b> Participant-response, Synthesis, and workspace-user capacity are defined in the order form, with bespoke Diagnostic or vantage design available as separately scoped work when the standard product does not fit.</div>'
)
s = s.replace('<li><b>Response capacity to match your size</b> &mdash; no annual ceiling</li>', '<li><b>Participant-response capacity</b> &mdash; defined in the order form</li>')
s = s.replace('<li><b>Unlimited analysts and admins</b></li>', '<li><b>Workspace-user capacity</b> &mdash; defined in the order form</li>')
s = s.replace('<li><b>A dedicated analyst team</b> &mdash; not a single advisor, sized to the engagement</li>', '<li><b>Named enterprise contact</b> &mdash; priority platform support and procurement coordination</li>')
s = s.replace('<li><b>Bespoke diagnostics on DAII</b> &mdash; new instruments engineered to your structure, deterministic by construction</li>', '<li><b>Bespoke Diagnostic or vantage design</b> &mdash; available as separately scoped work when the standard product does not adequately represent your organization</li>')
s = s.replace('<tr><td class="rowlabel">Analyst accounts</td><td class="num">1</td><td class="num">2</td><td class="num">5</td><td class="num">Unlimited</td></tr>', '<tr><td class="rowlabel">Analyst workspace users</td><td class="num">1</td><td class="num">2</td><td class="num">5</td><td>Scoped in order form</td></tr>')
s = s.replace('<tr><td class="rowlabel">Admin accounts</td><td class="num">1</td><td class="num">1</td><td class="num">2</td><td class="num">Unlimited</td></tr>', '<tr><td class="rowlabel">Admin workspace users</td><td class="num">1</td><td class="num">1</td><td class="num">2</td><td>Scoped in order form</td></tr>')
s = s.replace('<tr><td class="rowlabel">Syntheses, per year</td><td class="num">1 total</td><td class="num">12</td><td class="num">Unlimited</td><td class="num">Unlimited</td></tr>', '<tr><td class="rowlabel">Syntheses, per year</td><td class="num">1 total</td><td class="num">12</td><td class="num">Unlimited</td><td>Scoped in order form</td></tr>')
s = s.replace('<tr><td class="rowlabel">Depth Synthesis &amp; Cross-Lens Synthesis</td><td class="num">1 Synthesis</td><td class="num">12 / year</td><td class="yes">Unlimited</td><td class="yes">Unlimited</td></tr>', '<tr><td class="rowlabel">Depth Synthesis &amp; Cross-Lens Synthesis</td><td class="num">1 Synthesis</td><td class="num">12 / year</td><td class="yes">Unlimited</td><td>Scoped in order form</td></tr>')
s = s.replace('<tr><td class="rowlabel">Expert support</td><td class="no">&mdash;</td><td class="no">&mdash;</td><td class="svc">Sold separately</td><td class="svc">Sold separately</td></tr>', '<tr><td class="rowlabel">Expert support</td><td class="no">&mdash;</td><td class="no">&mdash;</td><td class="svc">Available separately</td><td class="svc">Available separately</td></tr>')
s = s.replace('<li><b>2 analyst accounts</b> &mdash; results are not trapped with one person</li>', '<li><b>3 workspace users</b> &mdash; 2 analysts and 1 admin</li>')
s = s.replace('<li><b>5 analysts and 2 admins</b>, across as many business units as you need</li>', '<li><b>7 workspace users</b> &mdash; 5 analysts and 2 admins</li>')
s = s.replace('Enterprise has no platform response ceiling.', 'Enterprise participant-response, Synthesis, and workspace-user capacity are defined in the order form.')
s = s.replace('Pattern and Enterprise include unlimited Depth Synthesis and Cross-Lens Synthesis.', 'Pattern includes unlimited Depth Synthesis and Cross-Lens Synthesis; Enterprise Synthesis capacity is defined in the order form.')
p.write_text(s, encoding="utf-8")

# ---- Enterprise: capacities are scoped; bespoke design and expert support are separate ----
p = ROOT / "plan-enterprise.html"
s = p.read_text(encoding="utf-8")
enterprise = {
    "No platform ceilings": "Capacity defined with you",
    "Unlimited participant responses, unlimited Depth Synthesis and Cross-Lens Synthesis, and unlimited analyst and admin accounts under the Enterprise platform entitlement. Bespoke design work is scoped and agreed separately.":
        "Participant-response, Synthesis, and workspace-user capacity are defined in the order form. Bespoke Diagnostic or vantage design is scoped and agreed separately.",
    "Everything in <a href=\"plan-pattern.html\">Pattern</a>, with unlimited participant responses and workspace users under the Enterprise platform entitlement":
        "Everything in <a href=\"plan-pattern.html\">Pattern</a>, with participant-response, Synthesis, and workspace-user capacity defined in the Enterprise order form",
    "<span class=\"num\">Unlimited</span> analyst and admin accounts &mdash; where Pattern has five and two":
        "Workspace-user capacity defined in the order form &mdash; where Pattern includes five analyst and two admin workspace users",
    "Unlimited participant responses under the Enterprise platform entitlement &mdash; no fixed annual response pool, where Pattern includes 500 completed participant responses a year":
        "Participant-response capacity defined in the order form &mdash; where Pattern includes 500 completed participant responses a year",
    "Signal includes 50 completed participant responses a year and Pattern includes 500. Enterprise removes that platform response ceiling.":
        "Signal includes 50 completed participant responses a year and Pattern includes 500. Enterprise participant-response capacity is defined in the order form.",
    "No platform ceiling applies at this tier: response capacity is agreed to your size rather than capped at a number.":
        "Enterprise capacity is defined in the order form rather than implied by a fixed public ceiling.",
    "bespoke instrument work": "bespoke Diagnostic or vantage design",
    "unlimited participant responses and workspace users": "participant-response, Synthesis, and workspace-user capacity defined in the order form",
    "Unlimited participant responses, unlimited self-runs, unlimited Depth Synthesis and Cross-Lens Synthesis, and unlimited analyst and admin accounts under the Enterprise platform entitlement.":
        "Unlimited self-runs are included. Participant-response, Synthesis, and workspace-user capacity are defined in the Enterprise order form.",
    "No fixed ceiling applies. Response capacity is agreed to your size on your order form. The only other scoped quantity is bespoke instrument work.":
        "Participant-response, Synthesis, and workspace-user capacity are stated in the order form. Bespoke Diagnostic or vantage design is scoped separately when required.",
    "an instrument that is still maturing": "a product that is still maturing",
}
for old, new in enterprise.items(): s = s.replace(old, new)
p.write_text(s, encoding="utf-8")

# ---- Sample Reports: representative, faithful, no obsolete customer vocabulary ----
p = ROOT / "sample-report.html"
s = p.read_text(encoding="utf-8")
s = s.replace("One instrument &middot;", "One Diagnostic &middot;")
s = s.replace("one instrument &middot;", "one Diagnostic &middot;")
s = s.replace("one per participant vantage", "one per participant vantage")
s = s.replace(">Senior</p>", ">Senior Leader</p>")
s = s.replace("executive-seat run", "Senior Leader run")
s = s.replace("one executive-seat run", "one Senior Leader run")
s = s.replace("instrument design reference", "Monderman design reference")
s = s.replace("the instrument design reference", "the Monderman design reference")
s = s.replace("instrument&rsquo;s published formula", "Diagnostic&rsquo;s deterministic scoring model")
s = s.replace("same instrument", "same Diagnostic version")
s = s.replace("instrument/scorer versions", "Diagnostic/scorer versions")
s = s.replace("observed respondent set", "observed participant set")
s = s.replace("respondent-weighted", "participant-weighted")

# Remove obsolete numeric Insight Depth construct; retain the evidence metadata customers actually use.
s = re.sub(
    r'<div class="ring-row">\s*<svg class="ring".*?</svg>\s*<div>\s*<div style="font-size:1\.6rem;font-weight:700;line-height:1;">[67]</div>\s*<p class="muted" style="margin-top:6px;font-size:0\.9rem;"><strong>Insight depth score.*?</p>\s*</div>\s*</div>',
    '<div class="method-box"><p class="muted" style="margin:0;font-size:.9rem;"><strong>Run evidence.</strong> 30-minute Diagnostic &middot; Senior Leader vantage. Evidence context describes the run; it is not a second score.</p></div>',
    s, flags=re.S
)

# Correct internal arithmetic / classification inconsistencies in the representative examples.
s = s.replace(
    "The measured burden is modest in dollars — about $84,000 a year across roughly 1,100 hours — because this instrument prices the coordination hours themselves, not their downstream consequences.",
    "The measured burden is modest relative to the size of the operation — about $153,894 a year across roughly 2,000 hours — because this Diagnostic prices the coordination hours themselves, not their downstream consequences."
)
s = s.replace("The reading sits within design reference, with handoff clarity", "The reading sits below the Monderman design reference, with handoff clarity")
s = s.replace("roughly 58,800 hours a year — about $6.9 million in labor", "roughly 58,800 hours a year — about $5.9 million in labor")

# External comparisons were marketing context, not product outputs. Replace them with product-faithful reading guidance.
s = re.sub(r'<p class="muted" style="margin:12px 0 0;font-size:\.85rem;">For scale: APQC.*?</p>', '<p class="muted" style="margin:12px 0 0;font-size:.85rem;">The measured-burden estimate and recoverable-burden estimate answer different questions. The first prices the modeled burden in the pathway; the second is the bounded share the Diagnostic identifies as potentially recoverable. Neither is an audited savings claim.</p>', s, flags=re.S)
s = re.sub(r'<p class="muted" style="margin:12px 0 0;font-size:\.85rem;">Across roughly 1,150 hires.*?</p>', '<p class="muted" style="margin:12px 0 0;font-size:.85rem;">The labor estimate prices coordination effort inside this decision pathway. It does not price downstream recruiting outcomes, candidate loss, or vacancy cost. Those remain outside the Diagnostic arithmetic unless separately supplied and modeled.</p>', s, flags=re.S)
s = re.sub(r'<p class="muted" style="margin:12px 0 0;font-size:\.85rem;">For scale: a published VA.*?</p>', '<p class="muted" style="margin:12px 0 0;font-size:.85rem;">The modeled burden prices coordination hours consumed by structural ambiguity. It intentionally excludes downstream clinical, payer, or patient consequences that are not directly measured in this run.</p>', s, flags=re.S)
s = re.sub(r'<p class="muted" style="margin:12px 0 0;font-size:\.85rem;">That is about \$28,800 per seat-year.*?</p>', '<p class="muted" style="margin:12px 0 0;font-size:.85rem;">The modeled burden prices the extra effort required to sustain output. It does not convert that burden into a claim about employee value, productivity, or downstream mission impact.</p>', s, flags=re.S)

# Replace misleading provenance claims. Samples are representative, not live customer runs.
s = re.sub(
    r'<div class="method-box"><p class="muted" style="margin:0;font-size:\.85rem;"><sup>\*</sup>This is a complete, illustrative sample\. The organization is hypothetical; every score, statistic, dollar figure, and classification on these pages is the unedited output of the (.*?) scoring engine run on the disclosed inputs, and the narrative was produced under the engine&rsquo;s writing contract\. Structure, depth, and format are identical to a real run\.</p></div>',
    r'<div class="method-box"><p class="muted" style="margin:0;font-size:.85rem;"><sup>*</sup><strong>Representative sample.</strong> The organization and scenario are hypothetical and are not customer data. The values are illustrative of the kinds of scores, burden estimates, classifications, evidence notes, and action paths the current \1 Diagnostic can return. A customer Executive Report reflects only the answers and context supplied for that run, under the same deterministic scoring and claim-bounding rules.</p></div>',
    s, flags=re.S
)

# Stronger, fully honest library notice.
s = s.replace(
    '<strong>These are illustrative samples.</strong> The organizations, populations, and scenarios are hypothetical. The examples show the current report structure and evidence discipline; they are not claims about a real customer or population.',
    '<strong>These are representative samples, not customer reports.</strong> The organizations, populations, scenarios, and values are illustrative. They show the kinds of outputs, evidence limits, visuals, and recommendations the current products can present; actual customer results depend on the answers, context, eligible run set, and evidence available at the time.'
)

# Turn the two Synthesis tabs into actual marketing demonstrations, not methodology stubs.
s = s.replace(
    '<section class="section" id="synthesis-headline"><p class="section-eyebrow">What Cross-Lens Synthesis does</p><h2>Compare different Diagnostic lenses without forcing unlike evidence into one number.</h2><p class="lede">Cross-Lens Synthesis compares eligible runs from two or more different Monderman Diagnostics. The four Diagnostic scores remain visible separately. A Cross-Lens Composite Score is published only when scope, timing, Diagnostic/scorer versions, source identity, participant depth, and lens balance support a coherent reading.</p></section>',
    '<section class="section" id="synthesis-headline"><p class="section-eyebrow">What Cross-Lens Synthesis does</p><h2>Compare different Diagnostic lenses without forcing unlike evidence into one number.</h2><p class="lede">Cross-Lens Synthesis compares eligible Included runs from two or more Monderman Diagnostics. Each Diagnostic remains visible on its own terms. A Cross-Lens Composite Score is published only when scope, timing, Diagnostic/scorer versions, source identity, participant depth, and lens balance support a coherent reading.</p><div class="syn-lens-grid"><div class="syn-lens-card"><div class="syn-lens-card-head"><span class="syn-lens-card-tool">Structural Clarity</span><span class="syn-lens-card-score">53</span></div><p class="syn-lens-card-band">Moderate structural ambiguity</p><p class="syn-lens-card-driver">Ownership and handoff clarity are the principal constraints in this representative bounded scope.</p></div><div class="syn-lens-card"><div class="syn-lens-card-head"><span class="syn-lens-card-tool">Decision Velocity</span><span class="syn-lens-card-score">78</span></div><p class="syn-lens-card-band">Lighter decision drag</p><p class="syn-lens-card-driver">The decision pathway is materially healthier than the structural-clarity reading, so the disagreement itself is useful evidence.</p></div></div><div class="panel bench"><p style="margin:0;"><strong>Evidence status: Comparison Only.</strong> The two lenses can be compared, but one Composite Score would imply more coherence than the evidence supports. Monderman therefore withholds it.</p></div></section>'
)
s = s.replace(
    '<section class="section" id="depth-headline"><p class="section-eyebrow">What Depth Synthesis does</p><h2>Summarize repeated evidence from one Diagnostic.</h2><p class="lede">Depth Synthesis requires two or more eligible unique runs from exactly one Diagnostic. It reports the <strong>Median Diagnostic Score</strong>, distribution, range, interquartile range, sample standard deviation, consensus pattern, and participant-vantage segments when those segments were measured.</p></section>',
    '<section class="section" id="depth-headline"><p class="section-eyebrow">What Depth Synthesis does</p><h2>Turn repeated evidence from one Diagnostic into a distribution, not a louder anecdote.</h2><p class="lede">Depth Synthesis requires two or more eligible unique runs from exactly one Diagnostic. It reports the <strong>Median Diagnostic Score</strong>, distribution, range, interquartile range, sample standard deviation, consensus pattern, and participant-vantage segments when those segments were measured.</p><div class="syn-gauge-panel"><svg class="syn-gauge-svg" viewBox="0 0 200 200" role="img" aria-label="Illustrative Median Diagnostic Score 56"><circle cx="100" cy="100" r="78" fill="none" stroke="#EAE6DD" stroke-width="14"/><circle cx="100" cy="100" r="78" fill="none" stroke="#0C6E78" stroke-width="14" stroke-linecap="round" stroke-dasharray="274 490" transform="rotate(-90 100 100)"/><text x="100" y="95" text-anchor="middle" font-size="44" font-weight="700" fill="#18191C">56</text><text x="100" y="120" text-anchor="middle" font-size="11" font-weight="700" fill="#6E6F73" letter-spacing="1.2">MEDIAN</text></svg><div class="syn-gauge-caption"><p class="syn-gauge-band">Developing evidence · 7 eligible runs</p><p class="syn-gauge-desc">Representative scores: 48, 51, 53, 56, 61, 64, 67. Median 56; range 48–67. The distribution shows that the condition is shared but not uniform.</p><p class="syn-gauge-context">Illustrative vantage pattern: Operational median 51, Managerial 58, Senior Leader 64. Vantage differences are displayed as evidence; they do not reweight the Median Diagnostic Score.</p></div></div></section>'
)
p.write_text(s, encoding="utf-8")

# Customer-visible 'seat' cleanup in the few remaining files where it survives.
for name in ["workspace.html", "checkout.html"]:
    p = ROOT / name
    if not p.exists(): continue
    s = p.read_text(encoding="utf-8")
    s = s.replace("seat-free", "not priced per workspace user")
    s = s.replace("seat charge", "workspace-user charge")
    s = s.replace("seat charges", "workspace-user charges")
    p.write_text(s, encoding="utf-8")

print("CUSTOMER_LEXICON_REPAIR_COMPLETE")
