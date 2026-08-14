from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


page_path = Path("operational-systems.html")
page = page_path.read_text()

page = replace_once(
    page,
    '  const orgN = num(p.employeeCount); if (orgN != null) inputs.push(`organization of ${orgN}`);',
    '  const orgN = num(p.employeeCount); if (orgN != null) inputs.push(`${Number(orgN).toLocaleString("en-US")} employees`);',
    "organization display metadata",
)
page = replace_once(
    page,
    '  const laneLabel = (typeof laneConfigs !== "undefined" && laneConfigs[mode] && laneConfigs[mode].label) || (mode ? String(mode) : "\\u2014");',
    '  const laneLabel = mode ? (typeof displayPerspectiveLabel === "function" ? displayPerspectiveLabel(mode) : String(mode).replace(/_/g, " ")) : "\\u2014";',
    "perspective display metadata",
)
page = replace_once(
    page,
    '  const cfg = (typeof state !== "undefined" && state.configVersion) ? state.configVersion : "\\u2014";',
    '  const cfg = result?.config_version || result?.configVersion || p.config_version || p.configVersion || p.routing_meta?.configVersion || ((typeof state !== "undefined" && state.configVersion) ? state.configVersion : "\\u2014");',
    "config version display metadata",
)
if "the breadth, depth, and cross-validation of inputs governs" not in page and "the breadth, depth, and cross-validation of inputs govern" not in page:
    raise SystemExit("Could not locate remedy calibration grammar")
page = page.replace("the breadth, depth, and cross-validation of inputs governs", "the breadth, depth, and cross-validation of inputs govern")
page = replace_once(
    page,
    "Light paths preserve continuity; aggressive paths buy more capacity but require a stronger mandate.",
    "Light paths preserve continuity; more ambitious paths offer greater recovery potential but require a stronger mandate.",
    "remedy trade-space calibration",
)
page_path.write_text(page)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
harness = harness.replace("2026-08-13.6", "2026-08-13.7")

old_claim_tail = r'|\b(?:allows?|causes?|drives?)\s+burden\s+to\s+accumulate\b/i;'
new_claim_tail = r'''|\b(?:allows?|causes?|drives?)\s+burden\s+to\s+accumulate\b|\b(?:appear(?:s)?\s+to\s+be\s+|are\s+|is\s+)?absorbing\s+(?:substantially|materially|far)\s+more\s+(?:administrative\s+)?capacity\s+than\s+(?:a\s+)?well[- ]designed[^.!?]{0,80}\bwould\s+require\b|\b(?:reporting|process|control|systems?|workaround|upkeep)(?:\s+[a-z][\w-]*){0,4}\s+(?:may\s+be\s+)?consuming\s+(?:hundreds|thousands)\s+of\s+hours\b|\b(?:that|the)\s+outcome\s+is\s+achievable\b|\bshould\s+expect\s+measurable\s+recovery\b|\bwould\s+likely\s+make\s+(?:this|the)\s+condition\s+worse\b|\bcompounds?\s+(?:reporting|administrative|workaround|process)\s+effort\b|\bconsum(?:e|es|ing)\s+far\s+more\s+capacity\s+than\s+necessary\b/i;'''
harness = replace_once(harness, old_claim_tail, new_claim_tail, "expanded single-run claim detector")

variable_anchor = '  const recoverableModelParity=(reclaimPotential.amount==null&&ex.recoverable_cost==null)||(Number(reclaimPotential.amount)===Number(ex.recoverable_cost)&&Number(reclaimPotential.factor)===Number(ex.recoverable_share_percent)&&!/comparable operating conditions/i.test(String(reclaimPotential.driverText||""))&&/no sector peer factor is added/i.test(String(reclaimPotential.driverText||"")));\n  const governanceMeasured='
variable_replacement = '''  const recoverableModelParity=(reclaimPotential.amount==null&&ex.recoverable_cost==null)||(Number(reclaimPotential.amount)===Number(ex.recoverable_cost)&&Number(reclaimPotential.factor)===Number(ex.recoverable_share_percent)&&!/comparable operating conditions/i.test(String(reclaimPotential.driverText||""))&&/no sector peer factor is added/i.test(String(reclaimPotential.driverText||"")));
  const idealCapacityOverclaim=/\b(?:appear(?:s)?\s+to\s+be\s+|are\s+|is\s+)?absorbing\s+(?:substantially|materially|far)\s+more\s+(?:administrative\s+)?capacity\s+than\s+(?:a\s+)?well[- ]designed[^.!?]{0,80}\bwould\s+require\b/i;
  const dimensionHourOverclaim=/\b(?:reporting|process|control|systems?|workaround|upkeep)(?:\s+[a-z][\w-]*){0,4}\s+(?:may\s+be\s+)?consuming\s+(?:hundreds|thousands)\s+of\s+hours\b/i;
  const outcomeCertaintyOverclaim=/\b(?:that|the)\s+outcome\s+is\s+achievable\b|\bshould\s+expect\s+measurable\s+recovery\b|\bwould\s+likely\s+make\s+(?:this|the)\s+condition\s+worse\b|\bcompounds?\s+(?:reporting|administrative|workaround|process)\s+effort\b|\bconsum(?:e|es|ing)\s+far\s+more\s+capacity\s+than\s+necessary\b/i;
  const burdenSeverities=Object.values(result.burden_breakdown||{}).map(Number).filter(Number.isFinite);
  const everyMeasuredDimensionIsHigh=burdenSeverities.length>0&&burdenSeverities.every(value=>value>=67);
  const allDimensionSeverityOverclaim=/\bheavy\s+administrative\s+load\s+across\s+every\s+measured\s+dimension\b|\bdistributed\s+burden\s+at\s+high\s+severity\s+across\s+all\s+major\s+dimensions\b/i;
  const expectedConfig=String(result.config_version||result.configVersion||"");
  const expectedEmployees=Number(apiRun.scenario.employeeCount??apiRun.scenario.employee_count);
  const basisMetadataOk=(!expectedConfig||full.includes(`config ${expectedConfig}`))&&!/config\s+[—-]\s*[·|]/i.test(full)&&!/\bsenior_leader\b/i.test(full)&&(!Number.isFinite(expectedEmployees)||full.includes(`${expectedEmployees.toLocaleString("en-US")} employees`));
  const staticCalibrationSlip=/\binputs\s+governs\b|\baggressive\s+paths\s+buy\s+more\s+capacity\b/i;
  const governanceMeasured='''
harness = replace_once(harness, variable_anchor, variable_replacement, "final customer-belief check variables")

check_anchor = '''    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],
    ["Full-report capacity allocation reconciles to the exposure model",capacityAllocationOk,capacityAllocation?`${capacityAllocation.productive}/${capacityAllocation.admin}/${capacityAllocation.drag} vs ${Math.round(modeledProductive)}/${Math.round(modeledNecessaryAdmin)}/${Math.round(modeledRecoverableDrag)}`:"capacity allocation note missing"],'''
check_replacement = '''    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],
    ["Basis of read preserves version and display metadata",basisMetadataOk,`config=${expectedConfig||"missing"}; employees=${Number.isFinite(expectedEmployees)?expectedEmployees:"missing"}; raw-role=${/\\bsenior_leader\\b/i.test(full)}`],
    ["Generated claims do not invent an ideal capacity benchmark",!idealCapacityOverclaim.test(singleRunClaimText),(singleRunClaimText.match(idealCapacityOverclaim)||["none"])[0]],
    ["Generated claims do not assign unsupported hours to a burden source",!dimensionHourOverclaim.test(singleRunClaimText),(singleRunClaimText.match(dimensionHourOverclaim)||["none"])[0]],
    ["Generated claims avoid outcome certainty and intervention forecasts",!outcomeCertaintyOverclaim.test(`${singleRunClaimText} ${combined}`),(String(`${singleRunClaimText} ${combined}`).match(outcomeCertaintyOverclaim)||["none"])[0]],
    ["Generated burden scope matches measured severities",everyMeasuredDimensionIsHigh||!allDimensionSeverityOverclaim.test(singleRunClaimText),(singleRunClaimText.match(allDimensionSeverityOverclaim)||["none"])[0]],
    ["Static report copy remains mechanically and analytically calibrated",!staticCalibrationSlip.test(combined),(combined.match(staticCalibrationSlip)||["none"])[0]],
    ["Full-report capacity allocation reconciles to the exposure model",capacityAllocationOk,capacityAllocation?`${capacityAllocation.productive}/${capacityAllocation.admin}/${capacityAllocation.drag} vs ${Math.round(modeledProductive)}/${Math.round(modeledNecessaryAdmin)}/${Math.round(modeledRecoverableDrag)}`:"capacity allocation note missing"],'''
harness = replace_once(harness, check_anchor, check_replacement, "expanded final customer-belief checks")
harness_path.write_text(harness)


validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text()
validator = validator.replace('Harness build 2026-08-13.6', 'Harness build 2026-08-13.7')
validator_anchor = '''assert "no sector peer factor is added" in harness
assert '\"recommended_interventions\",\"experiential_synthesis\"' in harness'''
validator_replacement = '''assert "no sector peer factor is added" in harness
assert 'result?.config_version || result?.configVersion' in page
assert 'displayPerspectiveLabel(mode)' in page
assert 'toLocaleString("en-US")} employees' in page
assert "inputs governs" not in page
assert "aggressive paths buy more capacity" not in page
assert '\"recommended_interventions\",\"experiential_synthesis\"' in harness'''
validator = replace_once(validator, validator_anchor, validator_replacement, "metadata and static-copy regressions")
check_list_anchor = '''    "Self-reported trajectory does not predict a rising cost of delay",
    "Update evidence does not request measurements already supplied",'''
check_list_replacement = '''    "Self-reported trajectory does not predict a rising cost of delay",
    "Basis of read preserves version and display metadata",
    "Generated claims do not invent an ideal capacity benchmark",
    "Generated claims do not assign unsupported hours to a burden source",
    "Generated claims avoid outcome certainty and intervention forecasts",
    "Generated burden scope matches measured severities",
    "Static report copy remains mechanically and analytically calibrated",
    "Update evidence does not request measurements already supplied",'''
validator = replace_once(validator, check_list_anchor, check_list_replacement, "new acceptance checks")
validator_path.write_text(validator)
