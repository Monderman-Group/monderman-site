from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


harness_path = Path("operational-systems-acceptance-harness.html")
harness = harness_path.read_text()
harness = harness.replace("2026-08-14.1", "2026-08-14.2")

old_source = '''async function renderArtifacts(apiRun){
  const source=await (await fetch(`${PAGE_BASE}/operational-systems.html`,{cache:"no-store"})).text();
  if(!source.includes("__mondermanTestHooks"))throw new Error("Production report page does not expose acceptance hooks");
  const injected={result:apiRun.result,payload:apiRun.payload,narrative:apiRun.result.interpretive_prose||apiRun.result.narrative||null};
  const inject=`<base href="${PAGE_BASE}/"><script>window.__mondermanInjectedResult=${JSON.stringify(injected).replace(/</g,"\\\\u003c")};<\\/script>`;
  const doc=source.replace(/<head([^>]*)>/i,(match,attrs)=>`<head${attrs}>${inject}`);'''
new_source = '''async function renderArtifacts(apiRun){
  const source=await (await fetch(`${PAGE_BASE}/operational-systems.html`,{cache:"no-store"})).text();
  if(!source.includes("__mondermanTestHooks"))throw new Error("Production report page does not expose acceptance hooks");
  // The report is loaded as srcdoc for an unsaved internal acceptance run. Strip
  // only the customer-session redirect block from that in-memory copy; otherwise
  // it navigates the iframe to signin.html while html2canvas is rendering and the
  // PDF promise never settles. The production page served to customers is not
  // modified, and all API-side authentication and authorization remain active.
  const renderSource=source.replace(/<!-- ===== Monderman access guard:[\\s\\S]*?<!-- ===== end access guard ===== -->/i,"");
  if(renderSource===source)throw new Error("Production report access guard was not isolated for acceptance rendering");
  const injected={result:apiRun.result,payload:apiRun.payload,narrative:apiRun.result.interpretive_prose||apiRun.result.narrative||null};
  const inject=`<base href="${PAGE_BASE}/"><script>window.__mondermanInjectedResult=${JSON.stringify(injected).replace(/</g,"\\\\u003c")};<\\/script>`;
  const doc=renderSource.replace(/<head([^>]*)>/i,(match,attrs)=>`<head${attrs}>${inject}`);'''
harness = replace_once(harness, old_source, new_source, "headless report source preparation")

old_pdf = '''  log("Building PDF from the production report renderer…");
  const pdfResult=await hooks.downloadExecutiveReportPdf({returnBlob:true});'''
new_pdf = '''  log("Building PDF from the production report renderer…");
  const pdfResult=await Promise.race([
    hooks.downloadExecutiveReportPdf({returnBlob:true}),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("PDF generation timed out after 120 seconds")),120000))
  ]);'''
harness = replace_once(harness, old_pdf, new_pdf, "bounded PDF generation")
harness_path.write_text(harness)

validator_path = Path("scripts/validate_os_output_integrity.py")
validator = validator_path.read_text()
validator = validator.replace("Harness build 2026-08-14.1", "Harness build 2026-08-14.2")
anchor = '''assert 'reference\\\\s+(?:range|of)' in harness
assert 'result?.config_version || result?.configVersion' in page'''
replacement = '''assert 'reference\\\\s+(?:range|of)' in harness
assert 'const renderSource=source.replace' in harness
assert 'Production report access guard was not isolated for acceptance rendering' in harness
assert 'PDF generation timed out after 120 seconds' in harness
assert 'result?.config_version || result?.configVersion' in page'''
validator = replace_once(validator, anchor, replacement, "headless-render regression assertions")
validator_path.write_text(validator)
