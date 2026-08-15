from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "workspace-analysis.html"
text = PATH.read_text(encoding="utf-8")
original = text


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '<a data-lens="synthesis">Synthesis</a>',
    '<a data-lens="synthesis">Depth &amp; cross-lens synthesis</a>',
    "synthesis tab label",
)

replace_once(
    '''        <section class="lens" data-lens="synthesis" hidden>
          <div class="view-head">
            <div><div class="eyebrow">Synthesis</div><h2>Combine reads into one executive picture</h2><p>Select two or more promoted reads — across instruments, units, or campaigns — and Monderman combines them into one cross-diagnostic read with its own executive report.</p></div>
          </div>
          <div id="synthBody"></div>
          <p class="footnote">Synthesis needs at least two promoted reads. Reads set aside by data-quality screening are excluded automatically.</p>
        </section>''',
    '''        <section class="lens" data-lens="synthesis" hidden>
          <div class="view-head">
            <div><div class="eyebrow">Meta-diagnostics</div><h2>Build a depth read or a cross-lens read</h2><p>Select two or more promoted runs. One instrument produces a depth synthesis across respondents; two or more instruments produce a cross-lens comparison, with a composite published only when the evidence is coherent enough.</p></div>
          </div>
          <div id="synthBody"></div>
          <p class="footnote">The API verifies unique source runs, organization scope, measurement window, instrument versions, respondent depth, and lens balance. A useful comparison may still withhold one composite score.</p>
        </section>''',
    "synthesis section copy",
)

CSS_ANCHOR = '    .synth-hint{font-size:12.5px;color:var(--muted)}\n'
CSS_EXTRA = r'''    .synth-dashboard{display:grid;gap:16px;margin:4px 0 18px}
    .synth-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .synth-stat{padding:14px 15px;border:1px solid var(--line);border-radius:11px;background:var(--card)}
    .synth-stat b{display:block;font-size:22px;font-weight:650;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .synth-stat span{display:block;margin-top:4px;font-size:11.5px;color:var(--muted)}
    .synth-lens-tools{display:flex;gap:8px;flex-wrap:wrap}
    .synth-chip{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--text);font-family:inherit;font-size:12.5px;cursor:pointer}
    .synth-chip:hover,.synth-chip:focus-visible{border-color:var(--accent);outline:none}
    .synth-chip b{font-variant-numeric:tabular-nums}
    .synth-chip.active{background:rgba(12,110,120,.08);border-color:rgba(12,110,120,.28);color:var(--accent-d)}
    .synth-preflight{padding:16px 18px;border:1px solid rgba(12,110,120,.16);border-radius:12px;background:rgba(12,110,120,.05)}
    .synth-preflight strong{display:block;margin-bottom:5px;font-size:14px}
    .synth-preflight p{margin:0;font-size:12.5px;line-height:1.55;color:var(--muted)}
    .synth-preflight ul{margin:9px 0 0;padding-left:18px;color:var(--muted);font-size:12.5px;line-height:1.5}
    .synth-controls{display:grid;grid-template-columns:minmax(180px,1fr) minmax(140px,.55fr);gap:10px}
    .synth-control{display:grid;gap:6px}
    .synth-control label{font-size:11.5px;color:var(--muted);font-weight:500}
    .synth-control input,.synth-control select{width:100%;min-height:40px;padding:0 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);font-family:inherit}
    .synth-sampling{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:10px;padding:14px 16px;border:1px solid var(--line);border-radius:11px;background:var(--card)}
    .synth-sampling[hidden]{display:none}
    .synth-list-note{font-size:12px;line-height:1.5;color:var(--muted-2)}
    .synth-row.is-hidden{display:none}
    .synth-row.is-disabled{opacity:.55;cursor:not-allowed}
    .synth-error{padding:14px 16px;border:1px solid rgba(176,57,47,.2);border-radius:10px;background:rgba(176,57,47,.05);color:#8A2A22;font-size:13px;line-height:1.5}
    .synth-success-note{padding:12px 14px;border:1px solid rgba(60,138,96,.22);border-radius:10px;background:rgba(60,138,96,.06);color:#2A6B45;font-size:12.5px;line-height:1.5}
    @media(max-width:760px){.synth-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.synth-controls,.synth-sampling{grid-template-columns:1fr}.synth-row{align-items:flex-start}.synth-row .sr-meta{white-space:normal;text-align:left;margin-left:0}.synth-row{flex-wrap:wrap}}
'''
if CSS_ANCHOR not in text:
    raise RuntimeError("synthesis CSS anchor not found")
text = text.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_EXTRA, 1)

NEW_BLOCK = r'''    // ---- Meta-synthesis front door -----------------------------------------
    let SYNTH_RUNS = null;
    const synthSel = new Set();
    const SYNTH_PAGE_SIZE = 1000;
    const SYNTH_MAX_LOAD = 10000;
    const SYNTH_MAX_SELECTED = 5000;
    const SYNTH_DETAIL_ROWS = 250;
    const SYNTH_STORAGE_KEY = "mondermanCrossDiagnosticSynthesis";
    function sEsc(v){ return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    function synthDate(d){ try{ return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }catch(e){ return ""; } }
    function synthLensCounts(runs){
      return (runs||[]).reduce((map,run)=>{ const key=run.tool_type||"unknown"; map[key]=(map[key]||0)+1; return map; },{});
    }
    function selectedSynthRuns(){
      const selected=synthSel;
      return (SYNTH_RUNS||[]).filter(run=>selected.has(String(run.id)));
    }
    function depthBand(n){
      if(n>=50) return {key:"large_observed_set",label:"Large observed respondent set",next:null};
      if(n>=15) return {key:"substantial_observed_set",label:"Substantial observed respondent set",next:50};
      if(n>=5) return {key:"developing_observed_set",label:"Developing observed respondent set",next:15};
      return {key:"minimal_observed_set",label:"Minimal observed respondent set",next:5};
    }
    function crossPreflight(runs){
      const counts=synthLensCounts(runs), values=Object.values(counts).sort((a,b)=>a-b), lensCount=values.length;
      const min=values[0]||0, max=values[values.length-1]||0, ratio=min?Math.round((max/min)*10)/10:null;
      const vantages=new Set(runs.map(run=>String(run.participant_mode||"").toLowerCase()).filter(Boolean));
      let key="comparison_only", label="Comparison only";
      if(min>=2){ key="directional"; label="Directional cross-lens read"; }
      if(min>=5 && ratio<=4){ key="coherent_candidate"; label="Coherent-band candidate"; }
      if(lensCount>=3 && min>=10 && ratio<=3 && vantages.size>=2){ key="strong_candidate"; label="Strong-band candidate"; }
      const requirements=[];
      if(key==="comparison_only"){
        Object.entries(counts).forEach(([tool,n])=>{ if(n<2) requirements.push(`${toolLabel(tool)} needs ${2-n} additional run${2-n===1?"":"s"} to reach the directional floor.`); });
      }else if(key==="directional"){
        const target=Math.max(5,Math.ceil(max/4));
        Object.entries(counts).forEach(([tool,n])=>{ if(n<target) requirements.push(`${toolLabel(tool)} needs ${target-n} additional run${target-n===1?"":"s"} to reach the estimated ${target}-run balance floor.`); });
      }else if(key==="coherent_candidate"){
        if(lensCount<3) requirements.push("A third diagnostic lens is required for the strong band.");
        if(vantages.size<2) requirements.push("A second participant vantage is required for the strong band.");
      }
      return {key,label,counts,min,max,ratio,lensCount,vantageCount:vantages.size,requirements};
    }
    function synthesisPreflight(){
      const runs=selectedSynthRuns();
      const tools=new Set(runs.map(run=>run.tool_type).filter(Boolean));
      if(runs.length<2) return {mode:null,label:"Select at least two runs",description:"A depth or cross-lens synthesis begins with two unique promoted runs.",requirements:[]};
      if(tools.size===1){
        const band=depthBand(runs.length), tool=toolLabel([...tools][0]);
        return {mode:"depth",label:`Depth synthesis · ${band.label}`,description:`${runs.length.toLocaleString()} ${tool} runs will be summarized by median, distribution, and observed segments. Sample size describes the submitted set; population claims require a declared sampling frame.`,requirements:band.next?[`${(band.next-runs.length).toLocaleString()} additional unique run${band.next-runs.length===1?"":"s"} would reach the next observed-set band.`]:[]};
      }
      const cross=crossPreflight(runs);
      return {mode:"cross_lens",label:`Cross-lens synthesis · ${cross.label}`,description:`${runs.length.toLocaleString()} runs across ${cross.lensCount} lenses; current strongest-to-weakest lens ratio ${cross.ratio==null?"—":cross.ratio+":1"}. This is an estimate only: the API will verify scope, source IDs, dates, versions, balance, and vantages before publishing a composite.`,requirements:cross.requirements};
    }
    function readSamplingFrame(){
      const method=$("synthSamplingMethod")?.value||"observed_set";
      const population=Number($("synthPopulation")?.value||0);
      const invited=Number($("synthInvited")?.value||0);
      return { method, populationSize:population>0?Math.floor(population):null, invitedCount:invited>0?Math.floor(invited):null };
    }
    function updateSynthesisState(){
      const runs=selectedSynthRuns(), pre=synthesisPreflight(), btn=$("synthRun"), hint=$("synthHint"), preflight=$("synthPreflight"), sampling=$("synthSampling"), count=$("synthSelectedCount");
      if(count) count.textContent=synthSel.size.toLocaleString();
      if(btn) btn.disabled=runs.length<2 || runs.length>SYNTH_MAX_SELECTED;
      if(hint) hint.textContent=runs.length>SYNTH_MAX_SELECTED?`Selection exceeds the ${SYNTH_MAX_SELECTED.toLocaleString()}-run request ceiling.`:`${runs.length.toLocaleString()} selected · ${pre.mode?pre.mode==="depth"?"one-lens depth":"multi-lens cross synthesis":"not ready"}`;
      if(preflight) preflight.innerHTML=`<strong>${sEsc(pre.label)}</strong><p>${sEsc(pre.description)}</p>${pre.requirements.length?`<ul>${pre.requirements.map(item=>`<li>${sEsc(item)}</li>`).join("")}</ul>`:""}`;
      if(sampling) sampling.hidden=pre.mode!=="depth";
      document.querySelectorAll("[data-synth-lens]").forEach(button=>{
        const selected=runs.filter(run=>run.tool_type===button.dataset.synthLens).length;
        button.classList.toggle("active",selected>0);
      });
    }

    async function loadSynthesisRuns(){
      if(SYNTH_RUNS!==null) return;
      const body=$("synthBody");
      if(body) body.innerHTML=`<p class="muted">Loading promoted reads…</p>`;
      try{
        const rows=[];
        for(let from=0; from<SYNTH_MAX_LOAD; from+=SYNTH_PAGE_SIZE){
          const to=Math.min(SYNTH_MAX_LOAD-1,from+SYNTH_PAGE_SIZE-1);
          const { data,error }=await supabase.from("diagnostic_runs")
            .select("id, tool_type, tool_label, business_unit, pathway_name, participant_mode, diagnostic_depth, score, band, created_at, status, included_in_aggregates, label, is_anonymous_response, assignment_id, config_version, scorer_version")
            .eq("status","promoted").order("created_at",{ascending:false}).range(from,to);
          if(error) throw error;
          const page=(data||[]).filter(run=>run.included_in_aggregates!==false);
          rows.push(...page);
          if((data||[]).length<SYNTH_PAGE_SIZE) break;
        }
        SYNTH_RUNS=rows.slice(0,SYNTH_MAX_LOAD);
      }catch(error){
        SYNTH_RUNS=[];
        if(body) body.innerHTML=emptyHTML("Couldn’t load reads","Refresh the workspace. Synthesis uses promoted, quality-included runs from your organization.");
        return;
      }
      synthSel.clear();
      renderSynthPicker();
    }

    function selectLens(tool, mode){
      const ids=(SYNTH_RUNS||[]).filter(run=>run.tool_type===tool).map(run=>String(run.id));
      if(mode==="clear") ids.forEach(id=>synthSel.delete(id));
      else{
        const available=Math.max(0,SYNTH_MAX_SELECTED-synthSel.size);
        ids.slice(0,available).forEach(id=>synthSel.add(id));
      }
      renderSynthPicker();
    }
    function clearSynthesisSelection(){ synthSel.clear(); renderSynthPicker(); }

    function renderSynthPicker(){
      const body=$("synthBody"); if(!body) return;
      const runs=SYNTH_RUNS||[];
      if(runs.length<2){
        body.innerHTML=emptyHTML("Not enough promoted reads yet","Promote at least two quality-included runs. One lens produces depth synthesis; two or more lenses produce cross-lens synthesis.");
        return;
      }
      const counts=synthLensCounts(runs), selectedRuns=selectedSynthRuns();
      const stats=`<div class="synth-overview"><div class="synth-stat"><b>${runs.length.toLocaleString()}</b><span>promoted runs loaded</span></div><div class="synth-stat"><b>${Object.keys(counts).length}</b><span>diagnostic lenses available</span></div><div class="synth-stat"><b id="synthSelectedCount">${synthSel.size.toLocaleString()}</b><span>runs selected</span></div><div class="synth-stat"><b>${SYNTH_MAX_SELECTED.toLocaleString()}</b><span>maximum per synthesis</span></div></div>`;
      const lensTools=`<div class="synth-lens-tools">${TOOL_ORDER.filter(tool=>counts[tool]).map(tool=>`<button class="synth-chip" type="button" data-synth-lens="${sEsc(tool)}"><span>${sEsc(toolLabel(tool))}</span><b>${counts[tool].toLocaleString()}</b></button>`).join("")}<button class="synth-chip" id="synthClear" type="button">Clear selection</button></div>`;
      const rows=runs.slice(0,SYNTH_DETAIL_ROWS).map(run=>{
        const who=run.is_anonymous_response&&run.label?run.label:"";
        const meta=[who,run.business_unit||run.pathway_name||"",synthDate(run.created_at),run.config_version?`config ${run.config_version}`:""].filter(Boolean).join(" · ");
        const checked=synthSel.has(String(run.id))?"checked":"";
        return `<label class="synth-row"><input type="checkbox" data-srun="${sEsc(run.id)}" ${checked}><span class="sr-tool">${sEsc(toolLabel(run.tool_type))}<span class="sr-score">${run.score==null?"—":sEsc(run.score)}</span></span><span class="sr-meta">${run.band?sEsc(run.band)+" · ":""}${sEsc(meta)}</span></label>`;
      }).join("");
      body.innerHTML=`<div class="synth-dashboard">${stats}${lensTools}<div id="synthPreflight" class="synth-preflight"></div><div id="synthSampling" class="synth-sampling" hidden><div class="synth-control"><label for="synthSamplingMethod">Declared sampling frame</label><select id="synthSamplingMethod"><option value="observed_set">Observed respondent set</option><option value="census">Declared census</option><option value="probability_sample">Declared probability sample</option></select></div><div class="synth-control"><label for="synthPopulation">Population size (optional)</label><input id="synthPopulation" type="number" min="1" step="1" placeholder="e.g. 2500"></div><div class="synth-control"><label for="synthInvited">Invited count (optional)</label><input id="synthInvited" type="number" min="1" step="1" placeholder="e.g. 2500"></div></div><div class="synth-controls"><div class="synth-control"><label for="synthSearch">Filter the visible run list</label><input id="synthSearch" type="search" placeholder="Tool, unit, label, or date"></div><div class="synth-control"><label for="synthScopePolicy">Scope policy</label><select id="synthScopePolicy"><option value="warn">Compare and warn</option><option value="strict">Reject scope conflict</option><option value="portfolio">Portfolio comparison</option></select></div></div><div class="synth-list-note">Showing the first ${Math.min(runs.length,SYNTH_DETAIL_ROWS).toLocaleString()} of ${runs.length.toLocaleString()} runs for individual selection. Use the lens buttons above to select large cohorts without rendering thousands of rows.</div><div class="synth-pick">${rows}</div><div class="synth-bar"><button class="synth-btn" id="synthRun" disabled type="button">Build synthesis</button><span class="synth-hint" id="synthHint"></span></div><div id="synthResult"></div></div>`;
      body.querySelectorAll("[data-srun]").forEach(checkbox=>checkbox.addEventListener("change",()=>{
        const id=String(checkbox.dataset.srun);
        if(checkbox.checked){
          if(synthSel.size>=SYNTH_MAX_SELECTED){ checkbox.checked=false; return; }
          synthSel.add(id);
        }else synthSel.delete(id);
        updateSynthesisState();
      }));
      body.querySelectorAll("[data-synth-lens]").forEach(button=>button.addEventListener("click",()=>{
        const tool=button.dataset.synthLens, selected=selectedRuns.filter(run=>run.tool_type===tool).length;
        selectLens(tool,selected?"clear":"select");
      }));
      $("synthClear")?.addEventListener("click",clearSynthesisSelection);
      $("synthRun")?.addEventListener("click",runSynthesis);
      $("synthSearch")?.addEventListener("input",event=>{
        const query=String(event.target.value||"").trim().toLowerCase();
        body.querySelectorAll("[data-srun]").forEach(checkbox=>{
          const row=checkbox.closest(".synth-row"), run=runs.find(item=>String(item.id)===String(checkbox.dataset.srun));
          const hay=[toolLabel(run?.tool_type),run?.business_unit,run?.pathway_name,run?.label,synthDate(run?.created_at)].filter(Boolean).join(" ").toLowerCase();
          row?.classList.toggle("is-hidden",Boolean(query&&!hay.includes(query)));
        });
      });
      ["synthSamplingMethod","synthPopulation","synthInvited","synthScopePolicy"].forEach(id=>$(id)?.addEventListener("change",updateSynthesisState));
      updateSynthesisState();
    }

    async function runSynthesis(){
      const ids=[...synthSel], pre=synthesisPreflight(), btn=$("synthRun"), result=$("synthResult");
      if(ids.length<2||!pre.mode) return;
      if(ids.length>SYNTH_MAX_SELECTED){ if(result) result.innerHTML=`<div class="synth-error">Select no more than ${SYNTH_MAX_SELECTED.toLocaleString()} runs.</div>`; return; }
      if(btn){btn.disabled=true;btn.textContent="Building synthesis…";}
      try{
        const {data}=await supabase.auth.getSession();
        const token=data?.session?.access_token;
        if(!token) throw new Error("Your workspace session has expired. Sign in again before synthesizing stored runs.");
        const options={mode:pre.mode,scopePolicy:$("synthScopePolicy")?.value||"warn",includeNarrative:true,includeExport:true};
        if(pre.mode==="depth") options.samplingFrame=readSamplingFrame();
        const response=await fetch(`${API_BASE}/api/cross-diagnostic-synthesis`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({run_ids:ids,options})});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok||payload.ok===false||!payload.result) throw new Error(payload.message||payload.error||`HTTP ${response.status}`);
        try{sessionStorage.setItem(SYNTH_STORAGE_KEY,JSON.stringify(payload.result));}catch(error){}
        renderSynthResult(payload.result);
      }catch(error){
        if(result) result.innerHTML=`<div class="synth-error">Couldn’t build this synthesis — ${sEsc(error.message||"please try again.")}</div>`;
        if(btn){btn.disabled=false;btn.textContent="Build synthesis";}
      }
    }

    function renderSynthResult(result){
      const body=$("synthBody"); if(!body) return;
      if(!window.MondermanReport){body.innerHTML=emptyHTML("Report module didn’t load","Refresh and try again.");return;}
      const model=window.MondermanReport.fromSynthesis(result);
      const label=result.synthesis_product==="depth_synthesis"?"Depth synthesis":"Cross-lens synthesis";
      const filename=result.export_payload?.filename_hint||model.filenameBase||"monderman-synthesis";
      body.innerHTML=`<div class="synth-success-note"><strong>${sEsc(label)} complete.</strong> ${result.score_status==="published"?`A ${sEsc(result.score_label||"condition score")} is published under the ${sEsc(result.readiness_label||"current")} evidence band.`:`The lens comparison is available, but one composite score is withheld under the ${sEsc(result.readiness_label||"current")} evidence band.`}</div><div class="synth-actions"><button class="synth-btn" id="synthPdf" type="button">Open executive report (PDF)</button><button class="synth-btn ghost" id="synthHtml" type="button">Download HTML</button><button class="synth-btn ghost" id="synthJson" type="button">Download JSON</button><a class="synth-btn ghost" href="cross-tool-synthesis.html">Open full-page report</a><button class="synth-btn ghost" id="synthBack" type="button">New synthesis</button></div><div id="synthReport"></div>`;
      window.MondermanReport.render("synthReport",model);
      $("synthPdf")?.addEventListener("click",()=>window.MondermanReport.openReport(model));
      $("synthHtml")?.addEventListener("click",()=>window.MondermanReport.downloadHtml(model));
      $("synthJson")?.addEventListener("click",()=>window.MondermanReport.downloadJson(result,String(filename).replace(/\.json$/i,"")));
      $("synthBack")?.addEventListener("click",renderSynthPicker);
    }

'''

pattern = re.compile(r'    // ---- Synthesis \(cross-diagnostic\) front door ----.*?(?=    function wireTabs\(\)\{)', re.S)
text, count = pattern.subn(NEW_BLOCK, text, count=1)
if count != 1:
    raise RuntimeError(f"synthesis JavaScript block: expected one match, found {count}")

for forbidden in (
    ".limit(200)",
    "population statistics",
    "body: JSON.stringify({ results",
    "Cross-Diagnostic Score",
):
    if forbidden in text:
        raise RuntimeError(f"obsolete synthesis behavior remains in workspace-analysis.html: {forbidden}")

for required in (
    "SYNTH_MAX_SELECTED = 5000",
    ".range(from,to)",
    "run_ids:ids",
    "samplingFrame",
    "Composite score is withheld",
    "Depth synthesis",
    "Cross-lens synthesis",
):
    if required not in text:
        raise RuntimeError(f"required workspace synthesis behavior missing: {required}")

if text == original:
    raise RuntimeError("workspace-analysis.html was not changed")
PATH.write_text(text, encoding="utf-8")
print("Patched the workspace for large depth and evidence-banded cross-lens synthesis.")
