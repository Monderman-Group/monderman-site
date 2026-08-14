from pathlib import Path
import re
import textwrap


def sub_once(text, pattern, replacement, label, flags=re.S):
    updated, count = re.subn(pattern, lambda _match: replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected one replacement, found {count}")
    return updated


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"{label}: anchor not found")
    return text.replace(old, new, 1)


page_path = Path("operational-systems.html")
page = page_path.read_text()

new_waterfall = textwrap.dedent(r'''
function renderCapacityWaterfall(result) {
const mount = $("capacityWaterfall");
const note = $("capacityWaterfallNote");
if (!mount) return;
const exposure = result?.exposure || {};
const annualHours = Number(exposure.annual_hours);
const totalCapacityHours = Number(exposure.total_capacity_hours);
const modeledTotalDrag = Number.isFinite(annualHours) && annualHours >= 0 && Number.isFinite(totalCapacityHours) && totalCapacityHours > 0
? (annualHours / totalCapacityHours) * 100
: Number(exposure.capacity_drag_percent || 0);
const totalDrag = Math.max(0, Math.min(100, modeledTotalDrag));
const recoverableShare = Math.max(0, Math.min(100, Number(exposure.recoverable_share_percent || 0)));
const drag = totalDrag * recoverableShare / 100;
const necessaryAdminLoad = Math.max(0, totalDrag - drag);
const productive = Math.max(0, 100 - totalDrag);
const segments = [
{ cls: "segment-productive", label: "Productive work", value: productive },
{ cls: "segment-admin", label: "Necessary administrative load", value: necessaryAdminLoad },
{ cls: "segment-drag", label: "Recoverable drag", value: drag }
];
mount.innerHTML = segments.map(seg => `<div class="capacity-segment ${seg.cls}" style="width:0%" data-final-width="${seg.value.toFixed(1)}">${seg.value >= 15 ? `${Math.round(seg.value)}%` : ""}</div>`).join("");
requestAnimationFrame(() => {
mount.querySelectorAll(".capacity-segment").forEach((el) => {
el.style.width = `${el.dataset.finalWidth}%`;
});
});
if (note) note.textContent = `${Math.round(productive)}% productive work, ${Math.round(necessaryAdminLoad)}% necessary administrative load, and ${Math.round(drag)}% recoverable drag based on the current run assumptions.`;
}

function renderBurdenTreemap''').lstrip("\n")
page = sub_once(
    page,
    r"function renderCapacityWaterfall\(result\) \{.*?\n\}\n\nfunction renderBurdenTreemap",
    new_waterfall,
    "capacity waterfall",
)

page = replace_once(
    page,
    '  return `The composition is concentrated rather than distributed. ${escapeHtml(pattern.dominant.label)} carries ${pattern.dominantPct}% of the visible burden by itself, which makes the condition more fixable: leadership can target one source first and expect a real shift in the workflow. Distributed conditions look the same from the outside but require redesigning the path itself, not just removing a layer.`;',
    '  return `The composition is concentrated rather than distributed. ${escapeHtml(pattern.dominant.label)} carries ${pattern.dominantPct}% of the visible burden by itself. That supports testing this source first; whether the workflow materially improves should be verified against the same measures after intervention.`;',
    "concentrated composition prose",
)
page = replace_once(
    page,
    '  return `The composition is distributed rather than concentrated. No single source carries more than ${pattern.dominantPct}% of the visible burden, which means the workflow is heavy in a systemic way. People inside the path are more likely to describe it as "the way things work here" than as one specific bottleneck. This pattern resists single-fix interventions; it usually requires path redesign, not layer removal.`;',
    '  return `The composition is distributed rather than concentrated. No single source carries more than ${pattern.dominantPct}% of the visible burden, so no single source explains the condition. That supports examining path-level design and sequencing several burden tests rather than assuming one layer will resolve the whole pattern.`;',
    "distributed composition prose",
)
page = replace_once(
    page,
    '  return `The composition shows ${escapeHtml(pattern.dominant.label.toLowerCase())} as the dominant visible burden source at ${pattern.dominantPct}% of the total, with the remaining burden meaningfully distributed across the other dimensions. This middle pattern usually responds to focused intervention on the dominant source while watching for compensation in the others.`;',
    '  return `The composition shows ${escapeHtml(pattern.dominant.label.toLowerCase())} as the dominant visible burden source at ${pattern.dominantPct}% of the total, with the remaining burden distributed across the other dimensions. That supports testing the dominant source first while monitoring the others for burden displacement.`;',
    "mixed composition prose",
)
page = replace_once(
    page,
    '  return "Burden composition signal is too low in this run to identify a dominant source. This usually indicates either an exceptionally light operating environment or insufficient diagnostic input depth — re-run with broader participant coverage to confirm which.";',
    '  return "Burden composition signal is too low in this run to identify a dominant source. This can reflect either a light operating environment or limited measurement coverage; use the coverage metadata and follow-up evidence to distinguish them.";',
    "low-signal composition prose",
)
page = replace_once(
    page,
    '  return "The trajectory signal indicates the burden is growing rather than holding steady. Early correction is more valuable here than late correction, because the cost of waiting compounds.";',
    '  return "The participant reported that burden has grown over the stated period. That makes a follow-up measurement timely, but it does not establish a continuing trend or the cost of delay.";',
    "trajectory prose",
)
old_alert = "This run shows rising trajectory combined with limited input depth. The pattern points toward worsening drag, but the signal underlying that pattern is thin. Treat the direction of the read seriously while treating the magnitude as provisional — a follow-up run with broader participant coverage is the right next step before committing to large interventions."
new_alert = "This run combines a self-reported rising trajectory with a single-perspective read. Treat the direction as a signal to investigate, not as a measured forecast. A cross-role follow-up is the right next step before committing to large interventions."
page = page.replace(old_alert, new_alert)
old_pdf_alert = "This run shows rising trajectory combined with limited input depth. Treat the direction seriously while treating the magnitude as provisional. A follow-up run with broader participant coverage is the right next step before committing to large interventions."
new_pdf_alert = "This run combines a self-reported rising trajectory with a single-perspective read. Treat the direction as a signal to investigate, not as a measured forecast. A cross-role follow-up is the right next step before committing to large interventions."
page = page.replace(old_pdf_alert, new_pdf_alert)
page = replace_once(
    page,
    '<p class="muted">The important signal is not only which dimension is largest. The distribution also matters. A concentrated pattern usually points to a more targeted intervention; a distributed pattern usually means the workflow has absorbed burden into its normal operating design.</p>',
    '<p class="muted">The important signal is not only which dimension is largest. The distribution also matters. A concentrated pattern supports a targeted first test; a distributed pattern supports examining how burden is embedded across the workflow.</p>',
    "PDF composition guidance",
)
page = replace_once(
    page,
    '<div class="card-row"><div class="mini-card"><b>Concentrated burden</b><p>One source dominates. Faster to fix because targeted intervention has high yield.</p></div><div class="mini-card"><b>Distributed burden</b><p>No single source dominates. Slower to fix; usually requires path-level redesign.</p></div></div>',
    '<div class="card-row"><div class="mini-card"><b>Concentrated burden</b><p>One source dominates. This supports a targeted first test whose effect should be measured.</p></div><div class="mini-card"><b>Distributed burden</b><p>No single source dominates. This supports a broader path-level assessment before selecting a remedy.</p></div></div>',
    "PDF composition cards",
)
page_path.write_text(page)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text().replace("2026-08-13.4", "2026-08-13.5")

new_claim_rules = r'''  const unsupportedClaim=/\b(?:every|each|all)\s+(?:(?:[a-z][\w-]*)\s+){0,3}(?:case|request|decision|workflow|transaction|deviation|exception|incident|referral|route|run|cycle)s?\b|\b(?:typically|commonly|usually)\b|\bmost\s+other\s+(?:friction|burden|drag|problems?)\b|\b(?:is|are)\s+(?:the\s+)?(?:primary|upstream|direct)\s+(?:driver|cause)\b|\bforces?\s+(?:staff|teams|managers|leaders|people|employees)\b|\bwill\s+(?:continue|keep|get|become|worsen|cause|remain|not\s+self-correct)\b|\bmakes?\s+recovery\s+harder\b|\bmost\s+likely\s+to\s+cause\b|\bwould\s+almost\s+certainly\b|\b(?:rising|upward)\s+trajectory\s+(?:means|proves|shows)\b|\bpaying\s+more\s+each\s+cycle\s+for\s+the\s+same\s+output\b|\bmore\s+(?:administrative\s+)?capacity\s+than[^.!?]{0,100}\bdesign[- ]reference\s+range[^.!?]{0,70}\bsuggests?\b/i;
  const remedyUnsupported=/\b(?:the\s+)?majority\s+of\s+(?:(?:[a-z][\w-]*)\s+){0,3}(?:cases|requests|decisions|workflows|transactions|deviations|exceptions|incidents|referrals|routes|runs|workarounds|transitions|points|case types)\b|\b(?:top\s+)?(?:two|three|four|five|\d+)(?:\s+to\s+(?:two|three|four|five|\d+))?\s+most\s+(?:common|frequent(?:ly\s+used)?)\b|\b(?:most[- ]used|highest[- ](?:volume|frequency))\b|\bwithin\s+(?:(?:one|two|three|four|five|several|\d+)(?:\s+to\s+(?:one|two|three|four|five|several|\d+))?\s+|a\s+few\s+)?(?:cycles?|quarters?|weeks?|months?|years?)\b/i;
  const staticOverclaim=/\bcost of waiting compounds\b|\bpattern points toward worsening drag\b|\bearly correction is more valuable here than late correction\b/i;'''
harness = sub_once(
    harness,
    r"  const unsupportedClaim=.*?;\n",
    new_claim_rules + "\n",
    "harness claim rules",
    flags=0,
)
harness = sub_once(
    harness,
    r'  const claimSectionKeys=new Set\(\[.*?\]\);',
    '  const claimSectionKeys=new Set(["executive_interpretation","tradeoff_note","time_money_resources_summary","opportunity_opening","what_this_run_indicates","how_advantage_is_built_here","opportunity_rationale","first_move_1_reason","first_move_2_reason","recommended_actions_rationale","opportunity_guidance","sector_pattern","leadership_implication","leadership_watchout","key_friction_flags","sector_dynamic"]);',
    "claim-section scope",
    flags=0,
)

extra_context = r'''const singleRunClaimText=Object.entries(rawNarrativeClaims).filter(([key])=>claimSectionKeys.has(key)).map(([,value])=>flattenClaimValue(value)).join(" ");
  const experienceSource=apiRun.case.experience||apiRun.payload?.rawExperience||apiRun.payload?.raw_experience||{};
  const experienceProvided=Object.values(experienceSource).some(value=>typeof value==="string"&&value.trim().length>5);
  const experientialSynthesis=flattenClaimValue(rawNarrativeClaims.experiential_synthesis).trim();
  const updateEvidenceText=flattenClaimValue(rawNarrativeClaims.what_would_update_this_read).trim();
  const redundantEvidenceRequests=[];
  if(Number.isFinite(Number(apiRun.payload?.systemsTouched??apiRun.payload?.systems_touched))&&/systems?-touch count|count measuring how many (?:separate )?systems|how many (?:separate )?systems or tools/i.test(updateEvidenceText))redundantEvidenceRequests.push("systems-touch count");
  if(Number.isFinite(Number(apiRun.payload?.adminHoursWeekly??apiRun.payload?.admin_hours_weekly))&&/administrative-hours measurement|measure(?:ment|) of (?:weekly )?administrative hours/i.test(updateEvidenceText))redundantEvidenceRequests.push("administrative-hours measurement");
  if(Number.isFinite(Number(apiRun.payload?.routineStepCount??apiRun.payload?.routine_step_count))&&/(?:routine |process )?step count|count of (?:approval|review|sign-off|process) steps/i.test(updateEvidenceText))redundantEvidenceRequests.push("step count");
  const governanceInputs=interpretiveState.governanceInputs||{};
  const expectedRegulatory=String(apiRun.scenario.regulatoryIntensity||apiRun.scenario.regulatory_intensity||"").toLowerCase();
  const expectedDecisionType=String(apiRun.scenario.decisionType||apiRun.scenario.decision_type||"").toLowerCase();
  const expectedEmployeeCount=Number(apiRun.scenario.employeeCount??apiRun.scenario.employee_count);
  const expectedOrgSize=String(apiRun.scenario.organizationSize||apiRun.scenario.organization_size||(expectedEmployeeCount>=5000?"enterprise":expectedEmployeeCount>=1000?"large":expectedEmployeeCount>=200?"midsize":expectedEmployeeCount>=1?"small":"unknown")).toLowerCase();
  const governanceContextOk=(!expectedRegulatory||String(governanceInputs.regulatory||"").toLowerCase()===expectedRegulatory)&&(!expectedDecisionType||String(governanceInputs.decisionType||"").toLowerCase()===expectedDecisionType)&&(!Number.isFinite(expectedEmployeeCount)||Number(governanceInputs.employeeCount)===expectedEmployeeCount)&&(!expectedOrgSize||String(governanceInputs.orgSize||"").toLowerCase()===expectedOrgSize);
  const capacityAllocationMatch=full.match(/(\d+)%\s+productive work,\s*(\d+)%\s+necessary administrative load,\s*and\s*(\d+)%\s+recoverable drag/i);
  const capacityAllocation=capacityAllocationMatch?{productive:Number(capacityAllocationMatch[1]),admin:Number(capacityAllocationMatch[2]),drag:Number(capacityAllocationMatch[3])}:null;
  const modeledTotalDrag=Number(ex.total_capacity_hours)>0?Number(ex.annual_hours)/Number(ex.total_capacity_hours)*100:Number(ex.capacity_drag_percent);
  const modeledRecoverableDrag=Number.isFinite(modeledTotalDrag)?modeledTotalDrag*Number(ex.recoverable_share_percent||0)/100:null;
  const modeledNecessaryAdmin=Number.isFinite(modeledTotalDrag)&&Number.isFinite(modeledRecoverableDrag)?Math.max(0,modeledTotalDrag-modeledRecoverableDrag):null;
  const modeledProductive=Number.isFinite(modeledTotalDrag)?Math.max(0,100-modeledTotalDrag):null;
  const capacityAllocationOk=!Number.isFinite(modeledProductive)||(capacityAllocation&&Math.abs(capacityAllocation.productive-Math.round(modeledProductive))<=1&&Math.abs(capacityAllocation.admin-Math.round(modeledNecessaryAdmin))<=1&&Math.abs(capacityAllocation.drag-Math.round(modeledRecoverableDrag))<=1&&capacityAllocation.productive+capacityAllocation.admin+capacityAllocation.drag===100);
  const highDepthHighConfidence=Number(apiRun.case.depth)>=60&&String(apiRun.scenario.confidenceLevel||apiRun.scenario.confidence_level||"").toLowerCase()==="high";
  const sectorPatternText=String(result.sector_context?.opportunityPattern||"");
  const unsupportedSectorPrevalence=/\b(?:the\s+)?(?:common|usual|typical)\s+pattern\b|\bburden\s+(?:often|usually|commonly|typically)\b|\bcomparable institutions\b/i;
  const reclaimPotential=result.reclaim_potential||{};
  const recoverableModelParity=(reclaimPotential.amount==null&&ex.recoverable_cost==null)||(Number(reclaimPotential.amount)===Number(ex.recoverable_cost)&&Number(reclaimPotential.factor)===Number(ex.recoverable_share_percent)&&!/comparable operating conditions|sector peer/i.test(String(reclaimPotential.driverText||"")));'''
harness = replace_once(
    harness,
    'const singleRunClaimText=Object.entries(rawNarrativeClaims).filter(([key])=>claimSectionKeys.has(key)).map(([,value])=>flattenClaimValue(value)).join(" ");',
    extra_context,
    "harness integrity context",
)

harness = sub_once(
    harness,
    r'^\s*\["Remedy paths make no unsupported prevalence or timing claims".*$',
    '    ["Remedy paths make no unsupported prevalence or timing claims",!remedyUnsupported.test(remedySection),(remedySection.match(remedyUnsupported)||["none"])[0]],',
    "remedy claim check",
    flags=re.M,
)

new_checks = r'''    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],
    ["Full-report capacity allocation reconciles to the exposure model",capacityAllocationOk,capacityAllocation?`${capacityAllocation.productive}/${capacityAllocation.admin}/${capacityAllocation.drag} vs ${Math.round(modeledProductive)}/${Math.round(modeledNecessaryAdmin)}/${Math.round(modeledRecoverableDrag)}`:"capacity allocation note missing"],
    ["Governance interpretation preserves the scenario context",governanceContextOk,`reg=${governanceInputs.regulatory||"missing"}; type=${governanceInputs.decisionType||"missing"}; employees=${governanceInputs.employeeCount??"missing"}; size=${governanceInputs.orgSize||"missing"}`],
    ["Experiential synthesis acknowledges supplied participant notes",!experienceProvided||(Boolean(experientialSynthesis)&&!/no participant notes were submitted|no participant notes were provided/i.test(experientialSynthesis)),experientialSynthesis||"missing synthesis"],
    ["Update evidence does not request measurements already supplied",redundantEvidenceRequests.length===0,redundantEvidenceRequests.join(", ")||"none"],
    ["High-depth high-confidence runs are not labeled limited-input reads",!highDepthHighConfidence||!/limited input depth|signal underlying that pattern is thin/i.test(combined),(combined.match(/limited input depth|signal underlying that pattern is thin/i)||["none"])[0]],
    ["Static report guidance avoids trajectory causality and certainty overclaims",!staticOverclaim.test(combined),(combined.match(staticOverclaim)||["none"])[0]],
    ["Sector context is framed as a hypothesis rather than a prevalence fact",!unsupportedSectorPrevalence.test(sectorPatternText),(sectorPatternText.match(unsupportedSectorPrevalence)||["none"])[0]],
    ["One disclosed recoverable model feeds the report",recoverableModelParity,`exposure=${ex.recoverable_cost}@${ex.recoverable_share_percent}%; reclaim=${reclaimPotential.amount}@${reclaimPotential.factor}% · ${reclaimPotential.driverText||"no driver"}`],'''
harness = replace_once(
    harness,
    '    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],',
    new_checks,
    "expanded output-integrity checks",
)
harness_path.write_text(harness)


# A small permanent regression checks the capacity arithmetic and the source
# guards without needing a signed-in live diagnostic.
Path("scripts/validate_os_output_integrity.py").write_text(textwrap.dedent(r'''
from pathlib import Path
import re

page = Path("operational-systems.html").read_text()
harness = Path("operational-systems-acceptance-harness.html").read_text()

assert "estimatedAdminLoad" not in page
assert "const necessaryAdminLoad = Math.max(0, totalDrag - drag);" in page
assert "The participant reported that burden has grown over the stated period." in page
assert "cost of waiting compounds" not in page
assert "limited input depth" not in page
assert "Harness build 2026-08-13.5" in harness
for check in [
    "Full-report capacity allocation reconciles to the exposure model",
    "Governance interpretation preserves the scenario context",
    "Experiential synthesis acknowledges supplied participant notes",
    "Update evidence does not request measurements already supplied",
    "One disclosed recoverable model feeds the report",
]:
    assert check in harness, check

annual_hours = 1980
capacity_hours = 32400
recoverable_share = 39
total_drag = annual_hours / capacity_hours * 100
recoverable = total_drag * recoverable_share / 100
admin = total_drag - recoverable
productive = 100 - total_drag
assert (round(productive), round(admin), round(recoverable)) == (94, 4, 2)
print("PASS: Operational Systems frontend output-integrity regressions.")
''').lstrip("\n"))
