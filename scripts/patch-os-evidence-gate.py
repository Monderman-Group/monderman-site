from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


path = Path("operational-systems-acceptance-harness.html")
text = path.read_text()
text = text.replace("2026-08-13.5", "2026-08-13.6")

text = replace_once(
    text,
    ',"sector_dynamic"]);',
    ',"sector_dynamic","recommended_interventions","experiential_synthesis"]);',
    "claim-section expansion",
)

old_claim_tail = r'''|\bmore\s+(?:administrative\s+)?capacity\s+than[^.!?]{0,100}\bdesign[- ]reference\s+range[^.!?]{0,70}\bsuggests?\b/i;'''
new_claim_tail = r'''|\bmore\s+(?:administrative\s+)?capacity\s+than[^.!?]{0,100}\bdesign[- ]reference\s+range[^.!?]{0,70}\bsuggests?\b|\bdelay\s+(?:increases?|will\s+increase)\s+the\s+cost\s+of\s+(?:eventual\s+)?correction\b|\b(?:the\s+)?cost\s+of\s+(?:inaction|correction)\s+(?:is\s+not\s+static|increases?|will\s+increase)\b|\bevery\s+(?:quarter|cycle|month|year)\s+of\s+delay\b|\b(?:increasingly|more)\s+expensive\s+to\s+(?:defer|delay|unwind|correct|remove)\b|\b(?:intervene|act)\s+before\s+the\s+cost\s+of\s+correction\s+increases?\b|\bwaiting[^.!?]{0,120}\b(?:harder|more\s+expensive)\s+to\s+(?:unwind|correct|remove)\b|\b(?:load|burden|cost|risk|rework|error\s+risk)[^.!?]{0,40}\bcompounds?\b|\b(?:creates?|produces?)\s+(?:a\s+)?compounding\s+effect\b|\b(?:workarounds?|burden)\s+should\s+diminish\s+naturally\b|\bis\s+likely\s+feeding\b|\bparticularly\s+susceptible\s+to\b|\btends?\s+to\s+be\s+added[^.!?]{0,80}\brarely\s+retired\b|\b(?:becomes?|is)\s+structurally\s+necessary\b|\b(?:consistent|confirmed|corroborated|validated)\s+(?:pattern\s+)?across\s+(?:all\s+)?(?:four|multiple|the)\s+(?:vantage\s+points|perspectives|roles)\b|\b(?:allows?|causes?|drives?)\s+burden\s+to\s+accumulate\b/i;'''
text = replace_once(text, old_claim_tail, new_claim_tail, "unsupported-claim expansion")

old_exp_block = '''  const experientialSynthesis=flattenClaimValue(rawNarrativeClaims.experiential_synthesis).trim();
  const updateEvidenceText=flattenClaimValue(rawNarrativeClaims.what_would_update_this_read).trim();'''
new_exp_block = r'''  const experientialSynthesis=flattenClaimValue(rawNarrativeClaims.experiential_synthesis).trim();
  const crossRoleOverclaim=/\b(?:consistent|confirmed|corroborated|validated)\s+(?:pattern\s+)?across\s+(?:all\s+)?(?:four|multiple|the)\s+(?:vantage\s+points|perspectives|roles)\b/i;
  const trajectoryCostOverclaim=/\bdelay\s+(?:increases?|will\s+increase)\s+the\s+cost\s+of\s+(?:eventual\s+)?correction\b|\b(?:the\s+)?cost\s+of\s+(?:inaction|correction)\s+(?:is\s+not\s+static|increases?|will\s+increase)\b|\bevery\s+(?:quarter|cycle|month|year)\s+of\s+delay\b|\b(?:increasingly|more)\s+expensive\s+to\s+(?:defer|delay|unwind|correct|remove)\b|\bwaiting[^.!?]{0,120}\b(?:harder|more\s+expensive)\s+to\s+(?:unwind|correct|remove)\b/i;
  const updateEvidenceText=flattenClaimValue(rawNarrativeClaims.what_would_update_this_read).trim();'''
text = replace_once(text, old_exp_block, new_exp_block, "explicit provenance regexes")

old_checks = '''    ["Experiential synthesis acknowledges supplied participant notes",!experienceProvided||(Boolean(experientialSynthesis)&&!/no participant notes were submitted|no participant notes were provided/i.test(experientialSynthesis)),experientialSynthesis||"missing synthesis"],
    ["Update evidence does not request measurements already supplied",redundantEvidenceRequests.length===0,redundantEvidenceRequests.join(", ")||"none"],'''
new_checks = '''    ["Experiential synthesis acknowledges supplied participant notes",!experienceProvided||(Boolean(experientialSynthesis)&&!/no participant notes were submitted|no participant notes were provided/i.test(experientialSynthesis)),experientialSynthesis||"missing synthesis"],
    ["Experiential synthesis preserves single-participant provenance",!experienceProvided||!crossRoleOverclaim.test(experientialSynthesis),(experientialSynthesis.match(crossRoleOverclaim)||["none"])[0]],
    ["Self-reported trajectory does not predict a rising cost of delay",!trajectoryCostOverclaim.test(singleRunClaimText),(singleRunClaimText.match(trajectoryCostOverclaim)||["none"])[0]],
    ["Update evidence does not request measurements already supplied",redundantEvidenceRequests.length===0,redundantEvidenceRequests.join(", ")||"none"],'''
text = replace_once(text, old_checks, new_checks, "new live checks")
path.write_text(text)

regression_path = Path("scripts/validate_os_output_integrity.py")
regression = regression_path.read_text()
regression = regression.replace("Harness build 2026-08-13.5", "Harness build 2026-08-13.6")
regression = replace_once(
    regression,
    '    "Experiential synthesis acknowledges supplied participant notes",\n'
    '    "Update evidence does not request measurements already supplied",',
    '    "Experiential synthesis acknowledges supplied participant notes",\n'
    '    "Experiential synthesis preserves single-participant provenance",\n'
    '    "Self-reported trajectory does not predict a rising cost of delay",\n'
    '    "Update evidence does not request measurements already supplied",',
    "frontend regression checks",
)
regression = replace_once(
    regression,
    'assert "no sector peer factor is added" in harness\n',
    'assert "no sector peer factor is added" in harness\n'
    'assert \'"recommended_interventions","experiential_synthesis"\' in harness\n'
    'assert "particularly\\\\s+susceptible" in harness\n'
    'assert "every\\\\s+(?:quarter|cycle|month|year)\\\\s+of\\\\s+delay" in harness\n',
    "frontend source assertions",
)
regression_path.write_text(regression)
