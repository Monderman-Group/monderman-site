from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


def replace_balanced_function(text: str, function_name: str, transform):
    marker = f"function {function_name}("
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"Could not locate {function_name}")
    brace = text.find("{", start)
    if brace < 0:
        raise SystemExit(f"Could not locate opening brace for {function_name}")
    depth = 0
    quote = None
    escaped = False
    i = brace
    while i < len(text):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
        else:
            if ch in {'"', "'", "`"}:
                quote = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    original = text[start:end]
                    replacement = transform(original)
                    return text[:start] + replacement + text[end:]
        i += 1
    raise SystemExit(f"Could not locate closing brace for {function_name}")


page_path = Path("operational-systems.html")
page = page_path.read_text()


def patch_capacity_function(function_text: str) -> str:
    if "const capacityComposition = calculateCapacityComposition(exposure);" in function_text:
        return function_text
    drag_start = function_text.find("const drag =")
    productive_start = function_text.find("const productive =", drag_start)
    if drag_start < 0 or productive_start < 0:
        raise SystemExit("Could not locate capacity-allocation declarations")
    productive_end = function_text.find(";", productive_start)
    if productive_end < 0:
        raise SystemExit("Could not locate end of productive allocation declaration")
    productive_end += 1
    replacement = (
        "const capacityComposition = calculateCapacityComposition(exposure);\n"
        "  const productive = capacityComposition.productive;\n"
        "  const necessaryAdminLoad = capacityComposition.admin;\n"
        "  const drag = capacityComposition.drag;"
    )
    return function_text[:drag_start] + replacement + function_text[productive_end:]


page = replace_balanced_function(page, "renderCapacityWaterfall", patch_capacity_function)
page_path.write_text(page)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
harness = harness.replace("2026-08-13.7", "2026-08-14.1")

old_ranges = '''function designReferenceRanges(text){
  const ranges=[];
  String(text||"").split(/(?<=[.!?])\\s+/).forEach(sentence=>{
    if(!/\\bdesign[- ]reference\\b/i.test(sentence))return;
    for(const match of sentence.matchAll(/\\b(\\d{1,3})\\s*[-–]\\s*(\\d{1,3})\\b/g))ranges.push({min:Number(match[1]),max:Number(match[2]),sentence});
  });
  return ranges;
}'''
new_ranges = '''function designReferenceRanges(text){
  const ranges=[];
  const source=String(text||"");
  const attachedRange=/\\b(?:design[- ]reference(?:\\s+range)?|reference\\s+(?:range|of))\\b[^0-9]{0,45}(\\d{1,3})\\s*[-–]\\s*(\\d{1,3})\\b/gi;
  for(const match of source.matchAll(attachedRange))ranges.push({min:Number(match[1]),max:Number(match[2]),sentence:match[0]});
  return ranges;
}'''
harness = replace_once(harness, old_ranges, new_ranges, "design-reference range extractor")

parser_anchor = '''  const summaryDoc=new DOMParser().parseFromString(files.summaryHtml,"text/html");
  const fullDoc=new DOMParser().parseFromString(files.fullHtml,"text/html");'''
parser_replacement = '''  const summaryDoc=new DOMParser().parseFromString(files.summaryHtml,"text/html");
  const fullDoc=new DOMParser().parseFromString(files.fullHtml,"text/html");
  const primaryReadLabel=(summaryDoc.querySelector(".primary-read strong")?.textContent||"").replace(/\\s+/g," ").trim();
  const primaryReadBody=(summaryDoc.querySelector(".primary-read p")?.textContent||"").replace(/\\s+/g," ").trim();
  const primaryReadText=`${primaryReadLabel} ${primaryReadBody}`.trim();'''
harness = replace_once(harness, parser_anchor, parser_replacement, "primary-read extraction")

old_qualitative = '''  const qualitativeDisplayEscalation=authoritativeQualitativeType==="workaround_dependence"&&/bypass\\/control-risk|managerial accommodation|routinely bypassed in practice/i.test(combined);
  const qualitativeDisplayOk=!qualitativeDisplayEscalation&&(authoritativeQualitativeType==="none"||!authoritativeQualitativeLabel||summary.toLowerCase().includes(authoritativeQualitativeLabel.toLowerCase()));'''
new_qualitative = '''  const qualitativeDisplayEscalation=authoritativeQualitativeType==="workaround_dependence"&&/bypass\\/control-risk|managerial accommodation|routinely bypassed in practice/i.test(primaryReadText);
  const qualitativeLabelMatches=authoritativeQualitativeType==="none"?!/qualitative\\s+(?:off-formal-path|bypass\\/control-risk|workaround)/i.test(primaryReadText):(!authoritativeQualitativeLabel||primaryReadText.toLowerCase().includes(authoritativeQualitativeLabel.toLowerCase()));
  const qualitativeDisplayOk=Boolean(primaryReadText)&&!qualitativeDisplayEscalation&&qualitativeLabelMatches;'''
harness = replace_once(harness, old_qualitative, new_qualitative, "qualitative primary-read parity")

old_healthy = '''    ["Healthy reports do not manufacture bypass tension",score<83||!/routinely bypassed|experiential operating-reality tension/i.test(combined),score<83?"not a healthy case":(combined.match(/routinely bypassed|experiential operating-reality tension/i)||["none"])[0]],'''
new_healthy = '''    ["Healthy reports do not manufacture bypass tension",score<83||authoritativeQualitativeType!=="none"||!/routinely bypassed|experiential operating-reality tension/i.test(primaryReadText),score<83?"not a healthy case":authoritativeQualitativeType!=="none"?`API qualitative signal=${authoritativeQualitativeType}`:(primaryReadText.match(/routinely bypassed|experiential operating-reality tension/i)||["none"])[0]],'''
harness = replace_once(harness, old_healthy, new_healthy, "healthy qualitative-signal check")

harness_path.write_text(harness)


validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text()
validator = validator.replace('assert "const necessaryAdminLoad = Math.max(0, totalDrag - drag);" in page', 'assert "const capacityComposition = calculateCapacityComposition(exposure);" in page')
validator = validator.replace('assert "Harness build 2026-08-13.7" in harness', 'assert "Harness build 2026-08-14.1" in harness')
anchor = '''assert "no sector peer factor is added" in harness
assert 'result?.config_version || result?.configVersion' in page'''
replacement = '''assert "no sector peer factor is added" in harness
assert '.primary-read strong' in harness
assert 'authoritativeQualitativeType!=="none"' in harness
assert 'reference\\\\s+(?:range|of)' in harness
assert 'result?.config_version || result?.configVersion' in page'''
validator = replace_once(validator, anchor, replacement, "matrix-gate source regressions")
validator_path.write_text(validator)
