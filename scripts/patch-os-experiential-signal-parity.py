from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


page_path = Path("operational-systems.html")
page = page_path.read_text()
old_block = r'''function detectQualitativeOverride(payload = {}) {
const text = getExperienceText(payload);
const hasWorkaround = /workaround|work around|bypass|bypassed|circumvent|informal|shadow|off[-\s]?path/.test(text);
const hasManager = /manager|managerial|top cover|cover|accommodat|allow|aware|shield/.test(text);
const hasSeniorBlind = /senior|leader|executive|oblivious|unaware|do not see|don't see|visibility|blind|missing/.test(text);
const hasLegal = /legal|contract|counsel|vendor|supplier|approval|review/.test(text);
if (hasWorkaround && hasManager && (hasSeniorBlind || hasLegal)) {
return { strength: "high", type: "bypass_control_risk", label: "Experiential bypass/control-risk signal", summary: "The experiential layer suggests that the formal path may be routinely bypassed in practice, with managerial accommodation and possible senior-leader visibility gaps. This is interpretive context and does not affect the quantitative score." };
}
if (hasWorkaround) return { strength: "moderate", type: "workaround_dependence", label: "Experiential workaround-dependence signal", summary: "The experiential layer suggests that informal workarounds may be preserving movement where the formal path is too heavy. This is interpretive context and does not affect the quantitative score." };
return { strength: "low", type: "none", label: "No experiential interpretive signal", summary: "No experiential signal materially reframes the structured quantitative read." };
}'''
new_block = r'''function detectQualitativeOverride(payload = {}, result = {}) {
const authoritative = result?.qualitative_interpretive_signal || result?.qualitative_risk_signal || null;
if (authoritative && typeof authoritative === "object" && authoritative.type) {
const type = String(authoritative.type || "none");
const strength = String(authoritative.strength || (type === "none" ? "low" : "moderate"));
const label = String(authoritative.label || (type === "bypass_control_risk" ? "Qualitative bypass/control-risk signal" : type === "workaround_dependence" ? "Qualitative off-formal-path signal" : "No qualitative interpretive signal"));
const summary = type === "bypass_control_risk"
? "The qualitative layer indicates a possible bypass/control-risk condition that should be investigated alongside the structured score. This is interpretive context and does not affect the quantitative score."
: type === "workaround_dependence"
? "The qualitative layer indicates possible off-formal-path execution that should be investigated alongside the structured score. This is interpretive context and does not affect the quantitative score."
: "No qualitative signal materially reframes the structured quantitative read.";
return { strength, type, label, summary };
}
const text = getExperienceText(payload);
const hasWorkaround = /workaround|work[-\s]around|bypass(?:ed|ing)?|circumvent|off[-\s]?path|shortcut|informal route|informal process|shadow process/.test(text);
const hasManager = /(?:manager(?:s|ial)?|leadership)\s+(?:cover|accommodat|toleranc|tolerat|shield|allow|approv)|top\s+cover|tacit\s+(?:accommodat|approv|acceptance|tolerat)/.test(text);
const hasSeniorBlind = /(?:senior\s+leader|executive|leadership)(?:s)?\s+(?:are\s+|do\s+not\s+|don't\s+)?(?:unaware|oblivious|see\s+(?:this|the|that)|know(?:s|n)?\s+about)|visibility\s+gap|leadership\s+visibility|oblivious\s+to/.test(text);
const hasLegal = /compliance\s+(?:risk|exposure|gap|concern|finding)|audit\s+(?:risk|exposure|finding|gap|concern)|control\s+(?:gap|failure|exposure|breakdown)|legal\s+(?:exposure|risk)|regulatory\s+(?:exposure|risk|concern|gap)/.test(text);
if (hasWorkaround && hasManager && (hasSeniorBlind || hasLegal)) {
return { strength: "high", type: "bypass_control_risk", label: "Qualitative bypass/control-risk signal", summary: "The qualitative layer indicates a possible bypass/control-risk condition that should be investigated alongside the structured score. This is interpretive context and does not affect the quantitative score." };
}
if (hasWorkaround) return { strength: "moderate", type: "workaround_dependence", label: "Qualitative off-formal-path signal", summary: "The qualitative layer indicates possible off-formal-path execution that should be investigated alongside the structured score. This is interpretive context and does not affect the quantitative score." };
return { strength: "low", type: "none", label: "No qualitative interpretive signal", summary: "No qualitative signal materially reframes the structured quantitative read." };
}'''
count = page.count(old_block)
if count != 2:
    raise SystemExit(f"Expected two stale qualitative classifiers, found {count}")
page = page.replace(old_block, new_block)
page = page.replace("detectQualitativeOverride(payload);", "detectQualitativeOverride(payload, result);")
page = page.replace("detectQualitativeOverride(payload || {});", "detectQualitativeOverride(payload || {}, result || {});")
if "detectQualitativeOverride(payload);" in page or "detectQualitativeOverride(payload || {});" in page:
    raise SystemExit("A qualitative classifier call still omits the authoritative result")
page_path.write_text(page)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
variable_anchor = '  const qualitativeSignal=result.qualitative_risk_signal||result.qualitative_interpretive_signal||{};\n  const unsupportedClaim='
variable_replacement = '''  const qualitativeSignal=result.qualitative_interpretive_signal||result.qualitative_risk_signal||{};
  const authoritativeQualitativeType=String(qualitativeSignal.type||"none");
  const authoritativeQualitativeLabel=String(qualitativeSignal.label||"");
  const qualitativeDisplayEscalation=authoritativeQualitativeType==="workaround_dependence"&&/bypass\\/control-risk|managerial accommodation|routinely bypassed in practice/i.test(combined);
  const qualitativeDisplayOk=!qualitativeDisplayEscalation&&(authoritativeQualitativeType==="none"||!authoritativeQualitativeLabel||summary.toLowerCase().includes(authoritativeQualitativeLabel.toLowerCase()));
  const unsupportedClaim='''
harness = replace_once(harness, variable_anchor, variable_replacement, "qualitative parity variables")
check_anchor = '''    ["Experiential layer is excluded from the numeric score",score===structuredScore&&result.experiential_score_effect==="none"&&qualitativeSignal.interpretive_only===true&&Number(qualitativeSignal.score_penalty||0)===0&&qualitativeSignal.score_cap==null,`score=${score}; structured=${structuredScore}; signal=${qualitativeSignal.type||"none"}`],
    ["Config version present",Boolean(result.config_version),String(result.config_version||"missing")],'''
check_replacement = '''    ["Experiential layer is excluded from the numeric score",score===structuredScore&&result.experiential_score_effect==="none"&&qualitativeSignal.interpretive_only===true&&Number(qualitativeSignal.score_penalty||0)===0&&qualitativeSignal.score_cap==null,`score=${score}; structured=${structuredScore}; signal=${qualitativeSignal.type||"none"}`],
    ["Customer experiential signal matches API classification",qualitativeDisplayOk,`api=${authoritativeQualitativeType}; label=${authoritativeQualitativeLabel||"none"}; escalated=${qualitativeDisplayEscalation}`],
    ["Config version present",Boolean(result.config_version),String(result.config_version||"missing")],'''
harness = replace_once(harness, check_anchor, check_replacement, "qualitative parity check")
harness_path.write_text(harness)


validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text()
validator_anchor = '''assert 'displayPerspectiveLabel(mode)' in page
assert 'toLocaleString("en-US")} employees' in page'''
validator_replacement = '''assert 'displayPerspectiveLabel(mode)' in page
assert page.count('function detectQualitativeOverride(payload = {}, result = {})') == 2
assert 'detectQualitativeOverride(payload, result)' in page
assert 'detectQualitativeOverride(payload || {}, result || {})' in page
assert 'toLocaleString("en-US")} employees' in page'''
validator = replace_once(validator, validator_anchor, validator_replacement, "qualitative source regressions")
list_anchor = '''    "Experiential synthesis acknowledges supplied participant notes",
    "Experiential synthesis preserves single-participant provenance",'''
list_replacement = '''    "Experiential synthesis acknowledges supplied participant notes",
    "Customer experiential signal matches API classification",
    "Experiential synthesis preserves single-participant provenance",'''
validator = replace_once(validator, list_anchor, list_replacement, "qualitative acceptance check")
validator_path.write_text(validator)
