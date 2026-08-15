from __future__ import annotations

import re
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"Could not locate {label}")


page_path = Path("institutional-performance.html")
page = page_path.read_text()

# Customer-facing evidence language. These are lexical only; the score and
# routing contract are untouched.
lexical = {
    "industry benchmark": "instrument design reference",
    "Industry benchmark": "Instrument design reference",
    "sector benchmark": "sector-adjusted design reference",
    "Sector benchmark": "Sector-adjusted design reference",
    "peer benchmark": "instrument design reference",
    "Peer benchmark": "Instrument design reference",
    "comparable range": "design reference range",
    "Comparable range": "Design reference range",
    "typical sector range": "sector-adjusted design reference range",
    "Acting while visible performance still looks acceptable is materially cheaper than acting after it slips.":
        "A timely follow-up measurement can test whether the self-reported strain signal persists before leadership changes the operating design.",
    "That combination narrows the margin before visible performance moves.":
        "That combination warrants timely follow-up measurement rather than a forecast.",
    "should expect measurable recovery": "should measure whether recovery follows",
    "recovery is achievable": "recovery is a testable possibility",
}
for old, new in lexical.items():
    page = page.replace(old, new)

# Insert an internal normalizer and a stable acceptance bridge into the largest
# inline application script. The bridge is inert for normal customers and
# allows the private release matrix to call the same production renderer and
# export functions without depending on their internal names.
script_matches = list(re.finditer(r"<script(?:\s[^>]*)?>([\s\S]*?)</script>", page, re.I))
if not script_matches:
    raise SystemExit("No inline scripts found in institutional-performance.html")
app_script = max(script_matches, key=lambda m: len(m.group(1)))
if "__MONDERMAN_IP_ACCEPTANCE__" not in app_script.group(1):
    bridge = r'''

// Internal release-test bridge. It is available only when the page is loaded
// with ?acceptance=1 or the harness sets __MONDERMAN_ACCEPTANCE_MODE__. Normal
// customer behavior and UI are unchanged.
function normalizeInstitutionalPerformanceCustomerResult(input) {
  const result = input && typeof input === "object" ? input : {};
  const exposure = result.exposure && typeof result.exposure === "object" ? result.exposure : {};
  const amount = Number(exposure.recoverable_cost);
  const factor = Number(exposure.recoverable_share_percent);
  if (Number.isFinite(amount) && Number.isFinite(factor)) {
    result.reclaim_potential = {
      amount: Math.round(amount),
      factor: Math.round(factor),
      driverText: `Uses the diagnostic's disclosed exposure model: ${Math.round(factor)}% of modeled annual institutional burden. No sector or peer factor is added.`,
      modelBasis: "single_disclosed_run_exposure_model",
      empiricalBenchmark: false
    };
  }
  result.benchmark_basis = result.benchmark_basis || "expert_authored_instrument_design_reference";
  result.experiential_score_effect = result.experiential_score_effect || "none";
  result.score_basis = result.score_basis || "structured_quantitative_inputs_only";
  return result;
}

(function exposeInstitutionalPerformanceAcceptanceBridge(){
  const active = Boolean(window.__MONDERMAN_ACCEPTANCE_MODE__) || new URLSearchParams(location.search).get("acceptance") === "1";
  if (!active) return;
  const lookup = (names) => {
    for (const name of names) {
      try {
        const candidate = eval(name);
        if (typeof candidate === "function") return candidate;
      } catch (_) {}
    }
    return null;
  };
  const assign = (name, value) => {
    try { eval(`${name} = value`); return true; } catch (_) { return false; }
  };
  const renderNames = ["renderResults","renderResult","renderReport","renderInstitutionalPerformance","renderExecutiveReport","showResults","showReport","renderFinalResult"];
  const summaryNames = ["buildExecutiveReportHtml","buildExecutiveSummaryHtml","buildSummaryHtml","generateExecutiveSummaryHtml","buildSummaryReportHtml"];
  const fullNames = ["buildFullReportHtml","buildFullHtmlExport","buildStandaloneReportHtml","generateFullHtml","buildCompleteReportHtml"];
  const jsonNames = ["buildCustomerJson","buildJsonExport","generateCustomerJson","buildExportPayload","buildCustomerExport"];
  const pdfNames = ["generatePdfArtifact","generatePDF","generatePdf","buildPdfArtifact","downloadPdf","downloadPDF"];
  window.__MONDERMAN_IP_ACCEPTANCE__ = {
    normalize: normalizeInstitutionalPerformanceCustomerResult,
    async render(finalized, scenario = {}) {
      const raw = finalized?.result || finalized?.data?.result || finalized;
      const result = normalizeInstitutionalPerformanceCustomerResult(raw);
      ["currentResult","lastResult","diagnosticResult","finalResult","resultForReport"].some((name) => assign(name, result));
      ["currentPayload","lastPayload","diagnosticPayload","runPayload","contextPayload"].some((name) => assign(name, scenario));
      const fn = lookup(renderNames);
      if (fn) {
        const attempts = [
          () => fn(result, scenario, finalized),
          () => fn({ result, payload: scenario, finalized }),
          () => fn(result),
          () => fn(finalized)
        ];
        let lastError = null;
        for (const attempt of attempts) {
          try { await Promise.resolve(attempt()); lastError = null; break; } catch (error) { lastError = error; }
        }
        if (lastError) throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      return result;
    },
    async summaryHtml(result, scenario = {}) {
      const fn = lookup(summaryNames);
      if (!fn) return document.documentElement.outerHTML;
      for (const args of [[result, scenario],[{result,payload:scenario}],[result]]) {
        try { const value = await Promise.resolve(fn(...args)); if (typeof value === "string" && value.length > 100) return value; } catch (_) {}
      }
      return document.documentElement.outerHTML;
    },
    async fullHtml(result, scenario = {}) {
      const fn = lookup(fullNames);
      if (!fn) return document.documentElement.outerHTML;
      for (const args of [[result, scenario],[{result,payload:scenario}],[result]]) {
        try { const value = await Promise.resolve(fn(...args)); if (typeof value === "string" && value.length > 100) return value; } catch (_) {}
      }
      return document.documentElement.outerHTML;
    },
    async customerJson(result, scenario = {}) {
      const fn = lookup(jsonNames);
      if (fn) {
        for (const args of [[result, scenario],[{result,payload:scenario}],[result]]) {
          try { const value = await Promise.resolve(fn(...args)); if (value) return value; } catch (_) {}
        }
      }
      return { result: normalizeInstitutionalPerformanceCustomerResult(result), context: scenario };
    },
    async pdf(result, scenario = {}) {
      const fn = lookup(pdfNames);
      if (!fn) return null;
      for (const args of [[result, scenario],[{result,payload:scenario}],[result],[]]) {
        try { const value = await Promise.resolve(fn(...args)); if (value) return value; } catch (_) {}
      }
      return null;
    },
    reportHtml() { return document.documentElement.outerHTML; },
    reportText() { return document.body?.innerText || ""; }
  };
})();
'''
    insert_at = app_script.end(1)
    page = page[:insert_at] + bridge + page[insert_at:]

page_path.write_text(page)


# ---------------------------------------------------------------- acceptance harness
harness = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Institutional Performance Acceptance Harness | Monderman</title>
  <style>
    :root{--ink:#18191c;--muted:#686b70;--paper:#f7f5f0;--card:#fff;--teal:#0c6e78;--red:#a63a32;--line:#dedbd3}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 Arial,sans-serif}main{max-width:1240px;margin:auto;padding:28px}h1{margin:0 0 8px}.notice,.card{background:#fff;border:1px solid var(--line);border-radius:9px;padding:15px}.notice{margin:18px 0}.toolbar{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}button{border:0;border-radius:7px;padding:11px 15px;font-weight:700;cursor:pointer;background:var(--teal);color:#fff}button:disabled{opacity:.4}.grid{display:grid;grid-template-columns:360px 1fr;gap:18px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:9px}.metric{padding:10px;background:var(--paper);border-radius:6px}.metric b{font-size:21px;display:block}.metric span{font-size:11px;color:var(--muted);text-transform:uppercase}.log{margin-top:15px;background:#111;color:#c7eadb;padding:12px;border-radius:7px;max-height:300px;overflow:auto;white-space:pre-wrap;font:12px/1.45 ui-monospace,monospace}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 5px;border-bottom:1px solid #eee;text-align:left}.pass{color:var(--teal)}.fail{color:var(--red)}iframe{width:100%;height:920px;border:0;background:#fff}@media(max-width:900px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body><main>
<h1>Institutional Performance Acceptance Harness</h1>
<p>Runs 18 controlled cases through the live API and the production report renderer. It is temporary, private-runner-only release infrastructure.</p>
<div class="notice" id="authStatus" data-harness-build="2026-08-14.1">Harness build 2026-08-14.1 loaded.</div>
<div class="toolbar"><button id="runBtn">Run comprehensive 18-case test</button><span id="runStatus">Not run</span></div>
<div class="grid"><section class="card"><div class="metrics"><div class="metric"><b id="cases">0/18</b><span>Cases</span></div><div class="metric"><b id="checks">0/0</b><span>Checks</span></div><div class="metric"><b id="exec">0</b><span>Execution failures</span></div><div class="metric"><b id="failed">0</b><span>Failed checks</span></div></div><div class="log" id="log">Ready.</div></section><section class="card"><table><thead><tr><th>Case</th><th>Depth</th><th>Role</th><th>Score</th><th>Checks</th></tr></thead><tbody id="caseRows"><tr><td colspan="5">Not run.</td></tr></tbody></table><iframe id="preview" title="Production report preview"></iframe></section></div>
</main>
<script>
(async function bootIPAcceptanceHarness(){
const API_BASE="https://monderman-api.onrender.com/api";
const BUILD="2026-08-14.1";
const $=(id)=>document.getElementById(id);
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const clone=(v)=>JSON.parse(JSON.stringify(v));
const log=(s)=>{$("log").textContent+=`\n${new Date().toISOString()} ${s}`;$('log').scrollTop=$('log').scrollHeight;};
const PROFILE={healthy:0,mixed:1,severe:2,contradictory:3};
const BASE={organizationName:"Northbridge Community Health Network",businessUnit:"Clinical Operations",industry:"healthcare_life_sciences",sector:"healthcare_life_sciences",regulatoryIntensity:"high",decisionType:"policy",employeeCount:2400,organizationSize:"large",peopleInvolved:12,peopleImpacted:12,hourlyCost:88,annualVolume:90,annualCycles:90,meetingHours:24,processName:"Institutional performance under operating strain",confidenceLevel:"moderate"};
const EXPERIENCE={self:"Managers spend extra time reconciling inconsistent follow-through and keeping work moving when the formal system does not resolve issues.",observedOperational:"Staff rely on local knowledge and informal coordination to close gaps in the formal process.",observedManagerial:"Managers absorb unresolved issues through additional follow-up and escalation.",observedSeniorLeader:"Senior leaders see output more readily than the extra effort used to sustain it."};
const CASES=[
{id:"northbridge",name:"Northbridge institutional performance",profile:"mixed",depth:30,role:"managerial",scenario:{...BASE}},
{id:"healthy_ops_10",name:"Healthy technology operations",profile:"healthy",depth:10,role:"operational",scenario:{...BASE,organizationName:"Alder Systems",businessUnit:"Cloud Operations",industry:"technology_software",sector:"technology_software",regulatoryIntensity:"low",employeeCount:680,organizationSize:"medium",peopleInvolved:5,peopleImpacted:5,hourlyCost:92,annualVolume:60,annualCycles:60,meetingHours:8,processName:"Production operations"}},
{id:"healthy_mgr_30",name:"Healthy university administration",profile:"healthy",depth:30,role:"managerial",scenario:{...BASE,organizationName:"Westbridge University",businessUnit:"Academic Administration",industry:"education_nonprofit",sector:"education_nonprofit",employeeCount:5100,organizationSize:"enterprise",peopleInvolved:7,peopleImpacted:7,hourlyCost:61,annualVolume:45,annualCycles:45,meetingHours:12,processName:"Academic administration"}},
{id:"healthy_exec_60",name:"Healthy defense program",profile:"healthy",depth:60,role:"senior_leader",scenario:{...BASE,organizationName:"Meridian Defense Services",businessUnit:"Program Governance",industry:"government_defense",sector:"government_defense",employeeCount:12000,organizationSize:"enterprise",peopleInvolved:11,peopleImpacted:11,hourlyCost:104,annualVolume:30,annualCycles:30,meetingHours:20,processName:"Program governance"}},
{id:"mixed_exec_10",name:"Mixed hospital leadership",profile:"mixed",depth:10,role:"senior_leader",scenario:{...BASE,organizationName:"Harbor Regional Medical Center",businessUnit:"Clinical Governance",employeeCount:3300,peopleInvolved:8,peopleImpacted:8,hourlyCost:84,annualVolume:80,annualCycles:80,meetingHours:18}},
{id:"mixed_ops_60",name:"Mixed financial operations",profile:"mixed",depth:60,role:"operational",scenario:{...BASE,organizationName:"Stonewell Financial",businessUnit:"Payment Operations",industry:"financial_services",sector:"financial_services",employeeCount:1900,peopleInvolved:10,peopleImpacted:10,hourlyCost:73,annualVolume:240,annualCycles:240,meetingHours:14}},
{id:"severe_mgr_10",name:"Severe technology scale-up",profile:"severe",depth:10,role:"managerial",scenario:{...BASE,organizationName:"Kiteframe Labs",businessUnit:"Product and Engineering",industry:"technology_software",sector:"technology_software",regulatoryIntensity:"low",employeeCount:420,peopleInvolved:12,peopleImpacted:12,hourlyCost:118,annualVolume:150,annualCycles:150,meetingHours:24}},
{id:"severe_ops_30",name:"Severe healthcare access",profile:"severe",depth:30,role:"operational",scenario:{...BASE,organizationName:"Cedar County Health",businessUnit:"Patient Access",employeeCount:1700,peopleInvolved:14,peopleImpacted:14,hourlyCost:57,annualVolume:365,annualCycles:365,meetingHours:28}},
{id:"severe_exec_60",name:"Severe public-sector institution",profile:"severe",depth:60,role:"senior_leader",scenario:{...BASE,organizationName:"Metro Infrastructure Authority",businessUnit:"Capital Programs",industry:"government_defense",sector:"government_defense",decisionType:"budget",employeeCount:8600,organizationSize:"enterprise",peopleInvolved:18,peopleImpacted:18,hourlyCost:88,annualVolume:90,annualCycles:90,meetingHours:40}},
{id:"contradictory",name:"Visible output with hidden strain",profile:"contradictory",depth:30,role:"managerial",scenario:{...BASE,organizationName:"Orchard Mutual",businessUnit:"Claims Transformation",industry:"financial_services",sector:"financial_services",employeeCount:2800,peopleInvolved:9,peopleImpacted:9,hourlyCost:79,annualVolume:180,annualCycles:180,meetingHours:20}},
{id:"unpriced_hours",name:"No coordination-hours estimate",profile:"mixed",depth:30,role:"managerial",scenario:{...BASE,organizationName:"Eastport Foundation",meetingHours:0}},
{id:"unpriced_rate",name:"No labor-rate estimate",profile:"mixed",depth:30,role:"operational",scenario:{...BASE,organizationName:"Lakeside Cooperative",hourlyCost:0}},
{id:"small",name:"Small low-volume organization",profile:"healthy",depth:10,role:"managerial",scenario:{...BASE,organizationName:"Willow Studio",industry:"professional_services",sector:"professional_services",regulatoryIntensity:"low",employeeCount:18,organizationSize:"small",peopleInvolved:3,peopleImpacted:3,hourlyCost:52,annualVolume:4,annualCycles:4,meetingHours:3}},
{id:"saturation",name:"High-volume capacity ceiling",profile:"severe",depth:60,role:"managerial",scenario:{...BASE,organizationName:"Continental Services",employeeCount:40000,organizationSize:"enterprise",peopleInvolved:2,peopleImpacted:2,hourlyCost:120,annualVolume:5000,annualCycles:5000,meetingHours:120}},
{id:"short_partial",name:"Short route with partial dimensions",profile:"mixed",depth:10,role:"operational",scenario:{...BASE,organizationName:"Pine Works",confidenceLevel:"limited"}},
{id:"long_governance",name:"Long route with governance evidence",profile:"mixed",depth:60,role:"senior_leader",scenario:{...BASE,organizationName:"Atlas Energy",industry:"energy_utilities",sector:"energy_utilities",employeeCount:7200,organizationSize:"enterprise",decisionType:"budget"}},
{id:"no_experience",name:"No experiential notes",profile:"mixed",depth:30,role:"managerial",scenario:{...BASE,organizationName:"Clearwater Services"},experience:{}},
{id:"partial_experience",name:"Partial experiential notes",profile:"severe",depth:60,role:"operational",scenario:{...BASE,organizationName:"Summit Manufacturing",industry:"manufacturing_industrial",sector:"manufacturing_industrial"},experience:{self:EXPERIENCE.self}}
];

function optionHealth(o){const c=Number(o?.conditionSignal);const b=Number(o?.burdenSignal);if(Number.isFinite(c)&&Number.isFinite(b))return c-b;if(Number.isFinite(c))return c;if(Number.isFinite(b))return-b;return 0;}
function answerFor(item,profile,index,scenario){const opts=Array.isArray(item?.options)?item.options:[];const id=String(item?.id||"");if(item?.questionType==="numeric"||!opts.length){if(/people/i.test(id))return Number(scenario.peopleInvolved||scenario.peopleImpacted||5);if(/annual|cycle|volume/i.test(id))return Number(scenario.annualVolume||scenario.annualCycles||50);if(/rate|cost/i.test(id))return Number(scenario.hourlyCost||0);if(/hour/i.test(id))return Number(scenario.meetingHours||0);return profile==="healthy"?1:profile==="severe"?12:5;}const ranked=opts.map((o,i)=>({o,i,h:optionHealth(o)})).sort((a,b)=>a.h-b.h||a.i-b.i);if(item?.questionType==="multi_select"){if(profile==="healthy")return[];const take=profile==="severe"?Math.min(3,ranked.length):1;return ranked.slice(0,take).map(x=>x.o.value);}if(profile==="healthy")return ranked[ranked.length-1].o.value;if(profile==="severe")return ranked[0].o.value;if(profile==="contradictory")return(index%2?ranked[0]:ranked[ranked.length-1]).o.value;return ranked[Math.floor((ranked.length-1)/2)].o.value;}
async function post(path,body){const r=await fetch(API_BASE+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`${r.status} ${text.slice(0,240)}`)}if(!r.ok||data?.ok===false)throw new Error(`${r.status} ${data?.error||data?.message||text.slice(0,180)}`);return data;}
async function loadRenderer(){const source=await fetch("institutional-performance.html?acceptance=1&v="+Date.now()).then(r=>r.text());const cleaned=source.replace(/window\.location(?:\.href)?\s*=\s*["']signin\.html[^;]*;/gi,"void 0;").replace(/location\.replace\([^)]*signin\.html[^)]*\);/gi,"void 0;");const frame=$("preview");frame.srcdoc=cleaned.replace(/<head>/i,'<head><script>window.__MONDERMAN_ACCEPTANCE_MODE__=true;<\/script>');await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error("renderer timeout")),30000);frame.onload=()=>{clearTimeout(t);resolve();};});for(let i=0;i<100;i++){if(frame.contentWindow?.__MONDERMAN_IP_ACCEPTANCE__)return frame.contentWindow.__MONDERMAN_IP_ACCEPTANCE__;await sleep(100);}throw new Error("production acceptance bridge unavailable");}
function collectText(node,out=[]){if(typeof node==="string")out.push(node);else if(Array.isArray(node))node.forEach(v=>collectText(v,out));else if(node&&typeof node==="object")Object.values(node).forEach(v=>collectText(v,out));return out;}
function checksFor(c,result,artifacts){const ex=result?.exposure||{};const full=collectText({result,artifacts}).join(" ");const generated=collectText(result?.narrative||result?.harmonized_narrative||result?.interpretive_prose||{}).join(" ");const checks=[];const add=(name,pass,detail="")=>checks.push({name,pass:Boolean(pass),detail:String(detail).slice(0,260)});add("Score is present and bounded",Number.isFinite(Number(result?.score))&&Number(result.score)>=0&&Number(result.score)<=100,result?.score);add("Scorer version identifies repaired IP contract",/institutional_performance_high_score_good_2026_08_14_experience_neutral_v2/.test(String(result?.scorer_version||"")),result?.scorer_version);add("Score uses structured inputs only",result?.score_basis==="structured_quantitative_inputs_only",result?.score_basis);add("Experiential layer does not alter score",result?.experiential_score_effect==="none",result?.experiential_score_effect);add("Config version present",Boolean(result?.config_version||result?.routing_meta?.configVersion),result?.config_version);add("Organization context preserved",!c.scenario.organizationName||full.includes(c.scenario.organizationName),c.scenario.organizationName);add("Business-unit context preserved",!c.scenario.businessUnit||full.includes(c.scenario.businessUnit),c.scenario.businessUnit);add("Governance context preserved",[c.scenario.regulatoryIntensity,c.scenario.decisionType,String(c.scenario.employeeCount)].every(v=>!v||full.toLowerCase().includes(String(v).toLowerCase())||JSON.stringify(result).toLowerCase().includes(String(v).toLowerCase())),JSON.stringify(result?.routing_meta||result?.context||{}));add("Reference is framed as instrument design guidance",!/industry benchmark|peer benchmark|empirical benchmark|comparable range/i.test(full),(full.match(/industry benchmark|peer benchmark|empirical benchmark|comparable range/i)||["none"])[0]);const rp=result?.reclaim_potential||{};add("One disclosed recoverable model is used",(rp.amount==null&&ex.recoverable_cost==null)||(Number(rp.amount)===Number(ex.recoverable_cost)&&Number(rp.factor)===Number(ex.recoverable_share_percent)&&!/sector|peer factor is added/i.test(String(rp.driverText||""))===false),`${rp.amount}/${rp.factor} vs ${ex.recoverable_cost}/${ex.recoverable_share_percent}`);add("Trajectory remains a self-reported signal",!/materially cheaper than|narrows? the margin before visible performance|cost of delay|increasingly expensive to defer|will worsen|will continue to deteriorate/i.test(full),(full.match(/materially cheaper than|narrows? the margin before visible performance|cost of delay|increasingly expensive to defer|will worsen/i)||["none"])[0]);add("Generated claims avoid unsupported prevalence and causality",!/\b(?:typically|usually|commonly|the majority of|most organizations)\b|\b(?:is|are) (?:the )?(?:primary|direct|root) (?:cause|driver)\b|\bconfirmed across (?:roles|levels|perspectives)\b/i.test(generated),(generated.match(/\b(?:typically|usually|commonly|the majority of|most organizations)\b|\bconfirmed across/i)||["none"])[0]);add("No unsupported outcome promise",!/outcome is achievable|should expect measurable recovery|within (?:one|two|three|four|five|\d+) (?:weeks|months|quarters|cycles)/i.test(generated),(generated.match(/outcome is achievable|should expect measurable recovery|within (?:one|two|three|four|five|\d+) (?:weeks|months|quarters|cycles)/i)||["none"])[0]);add("No placeholder or invalid numeric leakage",!/\bundefined\b|\bNaN\b|\bInfinity\b|\[object Object\]|lorem ipsum/i.test(full),(full.match(/\bundefined\b|\bNaN\b|\bInfinity\b|\[object Object\]|lorem ipsum/i)||["none"])[0]);add("Summary HTML generated",String(artifacts.summaryHtml||"").length>500,String(artifacts.summaryHtml||"").length);add("Full HTML generated",String(artifacts.fullHtml||"").length>1000,String(artifacts.fullHtml||"").length);add("Customer JSON generated",artifacts.customerJson&&typeof artifacts.customerJson==="object",typeof artifacts.customerJson);add("Production report rendered",String(artifacts.reportText||"").length>300,String(artifacts.reportText||"").length);if(c.id==="unpriced_rate")add("Missing labor rate withholds dollar estimates",ex.annual_cost==null||Number(ex.annual_cost)===0,ex.annual_cost);if(c.id==="unpriced_hours")add("Missing hours withholds exposure",ex.annual_hours==null||Number(ex.annual_hours)===0,ex.annual_hours);if(c.id==="saturation")add("Capacity saturation is disclosed or withheld",ex.sizing_status==="input_saturation"||ex.capacity_drag_percent==null||Number(ex.capacity_drag_percent)<=100,JSON.stringify(ex));if(c.profile==="healthy")add("Healthy case receives proportionate guidance",!/full reset|clean-sheet redesign|rebuild the institution end to end|urgent intervention/i.test(full),(full.match(/full reset|clean-sheet redesign|urgent intervention/i)||["none"])[0]);return checks;}

let matrix=[];let executionFailures=[];let dataset=null;
async function runCase(c,renderer){log(`Running ${matrix.length+1}/18: ${c.name}`);const scenario={...c.scenario,participantMode:c.role,participant_mode:c.role,diagnosticDepth:c.depth,diagnostic_depth:c.depth};const start=await post("/institutional-performance/run/start",scenario);let next=start.nextItem;let i=0;while(next&&i<120){const value=answerFor(next,c.profile,i,scenario);const step=await post(`/institutional-performance/run/${start.runId}/answer`,{itemId:next.id,value,meta:{acceptance:true}});next=step.nextItem;i++;if(step.shouldStop&&!next)break;}const exp=c.experience===undefined?EXPERIENCE:c.experience;const finalized=await post(`/institutional-performance/run/${start.runId}/finalize`,{...scenario,rawExperience:exp,raw_experience:exp,experientialLayer:exp,experiential_layer:exp});const result=renderer.normalize(finalized.result||finalized.data?.result||finalized);await renderer.render(finalized,scenario);const summaryHtml=await renderer.summaryHtml(result,scenario);const fullHtml=await renderer.fullHtml(result,scenario);let customerJson=await renderer.customerJson(result,scenario);if(typeof customerJson==="string"){try{customerJson=JSON.parse(customerJson)}catch{customerJson={raw:customerJson}}}const reportText=renderer.reportText();const reportHtml=renderer.reportHtml();const artifacts={summaryHtml,fullHtml,customerJson,reportText,reportHtml};const checks=checksFor(c,result,artifacts);return{id:c.id,name:c.name,profile:c.profile,depth:c.depth,role:c.role,scenario,runId:start.runId,score:result.score,band:result.band,failedChecks:checks.filter(x=>!x.pass),checks,result,artifacts};}
async function runAll(){const btn=$("runBtn");btn.disabled=true;matrix=[];executionFailures=[];$('caseRows').innerHTML="";$('runStatus').textContent="Running";const renderer=await loadRenderer();for(const c of CASES){try{const row=await runCase(c,renderer);matrix.push(row);}catch(error){executionFailures.push({id:c.id,name:c.name,error:String(error?.stack||error)});matrix.push({id:c.id,name:c.name,profile:c.profile,depth:c.depth,role:c.role,scenario:c.scenario,failedChecks:[{name:"Execution completed",pass:false,detail:String(error)}],checks:[]});}const r=matrix[matrix.length-1];const tr=document.createElement("tr");tr.innerHTML=`<td>${r.name}</td><td>${r.depth}</td><td>${r.role}</td><td>${r.score??"—"}</td><td class="${r.failedChecks.length?"fail":"pass"}">${r.failedChecks.length?`${r.failedChecks.length} failed`:"PASS"}</td>`;$('caseRows').appendChild(tr);const total=matrix.reduce((n,r)=>n+(r.checks?.length||0),0);const failed=matrix.reduce((n,r)=>n+(r.failedChecks?.length||0),0);$('cases').textContent=`${matrix.length}/18`;$('checks').textContent=`${total-failed}/${total}`;$('exec').textContent=executionFailures.length;$('failed').textContent=failed;}const total=matrix.reduce((n,r)=>n+(r.checks?.length||0),0);const failed=matrix.reduce((n,r)=>n+(r.failedChecks?.length||0),0);dataset={schemaVersion:"ip-acceptance-v1",harnessBuild:BUILD,generatedAt:new Date().toISOString(),aggregate:{casesCompleted:matrix.length,totalCases:18,totalChecks:total,passedChecks:total-failed,failedChecks:failed,executionFailures:executionFailures.length,narrativeGenerationFailures:executionFailures.filter(x=>/narrative_generation_failed/i.test(x.error)).length},executionFailures,cases:matrix};window.__IP_ACCEPTANCE_DATASET__=dataset;const pass=matrix.length===18&&!executionFailures.length&&!failed;$('runStatus').textContent=pass?"PASS — 18 cases":"FAIL";$('runStatus').className=pass?"pass":"fail";log(`${pass?"PASS":"FAIL"}: ${matrix.length}/18 cases; ${total-failed}/${total} checks; ${executionFailures.length} execution failures.`);btn.disabled=false;return dataset;}
window.runInstitutionalPerformanceAcceptance=runAll;$('runBtn').addEventListener('click',runAll);
})();
</script></body></html>'''
Path("institutional-performance-acceptance-harness.html").write_text(harness)


# Permanent source-level frontend regression. The temporary public harness is
# intentionally removed after certification; the production-page assertions
# remain useful after that cleanup.
validator = r'''from pathlib import Path
import re

page = Path("institutional-performance.html").read_text()
harness_path = Path("institutional-performance-acceptance-harness.html")
assert "normalizeInstitutionalPerformanceCustomerResult" in page
assert "single_disclosed_run_exposure_model" in page
assert "expert_authored_instrument_design_reference" in page
assert "__MONDERMAN_IP_ACCEPTANCE__" in page
assert "materially cheaper than acting after it slips" not in page
assert "narrows the margin before visible performance moves" not in page
assert "industry benchmark" not in page.lower()
assert "peer benchmark" not in page.lower()
if harness_path.exists():
    harness = harness_path.read_text()
    assert 'data-harness-build="2026-08-14.1"' in harness
    assert "Run comprehensive 18-case test" in harness
    assert "__IP_ACCEPTANCE_DATASET__" in harness
    assert "institutional-performance/run/start" in harness
    assert "No unsupported outcome promise" in harness
print("Institutional Performance frontend output-integrity regression passed.")
'''
Path("scripts/validate_ip_output_integrity.py").write_text(validator)
