from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text(encoding="utf-8")
harness = harness.replace("2026-08-14.2", "2026-08-14.3")

old = '''  if(Number.isFinite(Number(apiRun.payload?.routineStepCount??apiRun.payload?.routine_step_count))&&/(?:routine |process )?step count|count of (?:approval|review|sign-off|process) steps/i.test(updateEvidenceText))redundantEvidenceRequests.push("step count");'''
new = '''  const updateEvidenceItems=Array.isArray(rawNarrativeClaims.what_would_update_this_read)?rawNarrativeClaims.what_would_update_this_read.map(flattenClaimValue).filter(Boolean):[updateEvidenceText];
  const requestsRedundantStepCount=updateEvidenceItems.some(item=>{
    const mentionsStepCount=/(?:routine |process )?step[- ]count|count of (?:approval|review|sign-off|process|routine) steps|how many (?:approval|review|sign-off|process|routine) steps/i.test(item);
    const addsEmpiricalDistribution=/\\b(?:audit|categor(?:ize|izes|ized|izing|ization)|compare|comparison|distribution|variation|variance|segment|break down|breakdown|historical|recent quarter|across (?:cases|runs|cycles|categories))\\b/i.test(item);
    return mentionsStepCount&&!addsEmpiricalDistribution;
  });
  if(Number.isFinite(Number(apiRun.payload?.routineStepCount??apiRun.payload?.routine_step_count))&&requestsRedundantStepCount)redundantEvidenceRequests.push("step count");'''
harness = replace_once(harness, old, new, "broad step-count evidence assertion")
harness_path.write_text(harness, encoding="utf-8")

validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text(encoding="utf-8")
validator = validator.replace("Harness build 2026-08-14.2", "Harness build 2026-08-14.3")
anchor = '''assert 'PDF generation timed out after 120 seconds' in harness
assert 'result?.config_version || result?.configVersion' in page'''
replacement = '''assert 'PDF generation timed out after 120 seconds' in harness
assert "const requestsRedundantStepCount=" in harness
assert "const addsEmpiricalDistribution=" in harness
assert "recent quarter" in harness
assert '&&/(?:routine |process )?step count' not in harness
assert 'result?.config_version || result?.configVersion' in page'''
validator = replace_once(validator, anchor, replacement, "current validator assertions")
validator_path.write_text(validator, encoding="utf-8")
