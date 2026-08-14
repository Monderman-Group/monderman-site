from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


page_path = Path("operational-systems.html")
page = page_path.read_text()
old_signal = "Experiential bypass signals, when present, do not change the score; they provide interpretive context about how the formal process may differ from operating reality."
new_signal = "Qualitative signals, when present, do not change the score; they provide interpretive context about how the formal process may differ from operating reality."
if old_signal not in page and new_signal not in page:
    raise SystemExit("Could not locate static qualitative-signal copy")
page = page.replace(old_signal, new_signal)
old_cost = "while the operating system underneath becomes increasingly expensive to sustain."
new_cost = "while the operating system underneath may be more expensive to sustain than the visible output suggests."
if old_cost not in page and new_cost not in page:
    raise SystemExit("Could not locate static sustaining-cost copy")
page = page.replace(old_cost, new_cost)
page_path.write_text(page)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
claim_tail = r'''|\bcompounds?\s+(?:reporting|administrative|workaround|process)\s+effort\b|\bconsum(?:e|es|ing)\s+far\s+more\s+capacity\s+than\s+necessary\b/i;'''
claim_replacement = r'''|\bcompounds?\s+(?:reporting|administrative|workaround|process)\s+effort\b|\bconsum(?:e|es|ing)\s+far\s+more\s+capacity\s+than\s+necessary\b|\brecovery\s+from\s+this\s+position\s+would\s+require\b|\bjointly\s+shape\s+the\s+conditions\s+under\s+which\s+off-formal-path\s+execution\s+thrives\b|\ba\s+follow-up\s+measurement\s+would\s+confirm\s+whether\b/i;'''
harness = replace_once(harness, claim_tail, claim_replacement, "final unsupported mechanism patterns")

remedy_anchor = '  const remedyUnsupported=/\\b(?:the\\s+)?majority'
remedy_prefix = '  const remedyScopeOverclaim=/\\bacross\\s+all\\s+measured\\s+dimensions\\b|\\bconditions\\s+that\\s+currently\\s+require\\s+off-formal-path\\s+execution\\b/i;\n  const remedyUnsupported=/\\b(?:the\\s+)?majority'
harness = replace_once(harness, remedy_anchor, remedy_prefix, "remedy scope detector")

static_old = '  const staticCalibrationSlip=/\\binputs\\s+governs\\b|\\baggressive\\s+paths\\s+buy\\s+more\\s+capacity\\b/i;'
static_new = '  const staticCalibrationSlip=/\\binputs\\s+governs\\b|\\baggressive\\s+paths\\s+buy\\s+more\\s+capacity\\b|\\bexperiential\\s+bypass\\s+signals\\b|\\bbecomes\\s+increasingly\\s+expensive\\s+to\\s+sustain\\b/i;'
harness = replace_once(harness, static_old, static_new, "static calibration detector")

check_anchor = '''    ["Remedy paths make no unsupported prevalence or timing claims",!remedyUnsupported.test(remedySection),(remedySection.match(remedyUnsupported)||["none"])[0]],
    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],'''
check_replacement = '''    ["Remedy paths make no unsupported prevalence or timing claims",!remedyUnsupported.test(remedySection),(remedySection.match(remedyUnsupported)||["none"])[0]],
    ["Remedy paths keep cross-dimension effects and workaround causality directional",!remedyScopeOverclaim.test(remedySection),(remedySection.match(remedyScopeOverclaim)||["none"])[0]],
    ["Generated single-run claims avoid unsupported prevalence, causality, and forecasts",Boolean(singleRunClaimText)&&!unsupportedClaim.test(singleRunClaimText),(singleRunClaimText.match(unsupportedClaim)||[singleRunClaimText?"none":"missing generated claim text"])[0]],'''
harness = replace_once(harness, check_anchor, check_replacement, "remedy scope acceptance check")
harness_path.write_text(harness)


validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text()
validator_anchor = '''assert "inputs governs" not in page
assert "aggressive paths buy more capacity" not in page'''
validator_replacement = '''assert "inputs governs" not in page
assert "aggressive paths buy more capacity" not in page
assert "Experiential bypass signals" not in page
assert "becomes increasingly expensive to sustain" not in page
assert "Qualitative signals, when present" in page
assert "may be more expensive to sustain than the visible output suggests" in page'''
validator = replace_once(validator, validator_anchor, validator_replacement, "static copy regressions")
list_anchor = '''    "Static report copy remains mechanically and analytically calibrated",
    "Update evidence does not request measurements already supplied",'''
list_replacement = '''    "Static report copy remains mechanically and analytically calibrated",
    "Remedy paths keep cross-dimension effects and workaround causality directional",
    "Update evidence does not request measurements already supplied",'''
validator = replace_once(validator, list_anchor, list_replacement, "remedy scope check registration")
validator_path.write_text(validator)
