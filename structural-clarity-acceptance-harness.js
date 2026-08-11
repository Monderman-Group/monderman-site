document.getElementById("authStatus").textContent="Starting the acceptance harness…";
const API_BASE="https://monderman-api.onrender.com/api";
const PAGE_BASE=/^https?:$/.test(location.protocol)?location.origin:"https://www.monderman.com";
const $=(id)=>document.getElementById(id);
const clone=(value)=>JSON.parse(JSON.stringify(value));
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const PLACEHOLDER_RE=/\b(?:undefined|NaN|Infinity|\[object Object\]|headline finding will appear|priority actions will appear|remedy paths will appear|will appear once|lorem ipsum|a Other)\b/i;

const NORTHBRIDGE={
  organizationName:"Northbridge Community Health Network",
  processName:"Capital equipment procurement approvals", process_name:"Capital equipment procurement approvals",
  focus_area:"Capital equipment procurement approvals",
  businessUnit:"Procurement and Clinical Operations", business_unit:"Procurement and Clinical Operations",
  industry:"healthcare_life_sciences", regulatoryIntensity:"high", regulatory_intensity:"high",
  decisionType:"procurement", decision_type:"procurement", employeeCount:2400, organizationSize:"large",
  peopleInvolved:9, peopleAffected:9, hourlyCost:78, annualVolume:120, meetingHours:32,
  confidenceLevel:"moderate", confidence_level:"moderate", participantMode:"managerial", participant_mode:"managerial",
  diagnosticDepth:30, diagnostic_depth:30,
  description:"Routine capital equipment requests cross procurement, finance, clinical operations, IT security, and compliance. Ownership is documented but exceptions are common, approval thresholds are outdated, and managers frequently chase status or escalate stalled requests. Most decisions eventually succeed, but delays and rework are material rather than catastrophic."
};
const EXPERIENCE={
  self:"Managers spend material time interpreting thresholds, locating the next owner, and escalating exceptions so requests keep moving.",
  observedOperational:"Requestors often ask a veteran procurement coordinator which reviewer owns the next step, then chase updates through email because the workflow does not show a reliable handoff owner.",
  observedManagerial:"Managers reinterpret approval thresholds and use escalation relationships when the published pathway does not resolve an exception.",
  observedSeniorLeader:"Senior leaders generally believe the published RACI and approval policy are adequate. In practice, managers reinterpret thresholds and rely on escalation relationships, so the documented clarity overstates how predictable the pathway is.",
  observedExecutive:"Senior leaders generally believe the published RACI and approval policy are adequate. In practice, managers reinterpret thresholds and rely on escalation relationships, so the documented clarity overstates how predictable the pathway is."
};
const NORTHBRIDGE_ANSWERS={
  sc_g1_structure_type:"cross-functional", sc_g2_change_pace:"frequent_change", sc_g3_primary_concern:"multiple_concerns",
  sc_g4_compensation_level:"significant_key_people_fill_gaps", sc_d1_role_explicitness:"defined_but_interpreted_differently",
  sc_d1_ownership_visibility:"often_unclear", sc_d1_role_overlap:"meaningful_overlap_causes_gaps",
  sc_d2_authority_clarity:"situational_depends_on_who_pushes", sc_d2_authority_limits:"fuzzy_at_the_edges",
  sc_d2_decision_consistency:"inconsistent_depends_on_context", sc_d3_handoff_visibility:"often_unclear_work_stalls_at_boundaries",
  sc_d3_boundary_integrity:"frequently_lost_someone_has_to_re_establish_it", sc_d3_transfer_friction:"frequent_bouncing_or_stalling",
  sc_d4_answerability:"often_diffuse_multiple_people_half_accountable", sc_d4_diffusion:"shared_in_ways_that_create_gap_risk",
  sc_d4_escalation_pattern:"frequently_escalated_takes_time", sc_d5_review_layers:"three_plus_some_redundant",
  sc_d5_approval_redundancy:"mixed_some_add_value_some_dont", sc_d5_governance_proportionality:"noticeably_heavier",
  sc_c1_key_person_probe:"specific_person_is_essential", sc_c2_roles_vs_accountability_probe:"both_are_unclear",
  sc_c3_authority_contest_probe:"authority_boundary_unclear", sc_ctx_people_affected:9, sc_ctx_issues_per_month:12,
  sc_ctx_meetings_per_week:16
};
const PROFILE_INDEX={healthy:0,mixed:2,severe:-1};
const CASE_DEFINITIONS=[
  {id:"northbridge",name:"Northbridge healthcare",profile:"mixed",depth:30,role:"managerial",scenario:{...NORTHBRIDGE},answers:{...NORTHBRIDGE_ANSWERS},experience:EXPERIENCE},
  {id:"healthy_ops_10",name:"Healthy technology operations",profile:"healthy",depth:10,role:"operational",scenario:{organizationName:"Alder Systems",businessUnit:"Cloud Operations",industry:"technology_software",employeeCount:680,peopleInvolved:5,hourlyCost:92,annualVolume:60,meetingHours:8,processName:"Production change approvals",regulatoryIntensity:"moderate"}},
  {id:"healthy_mgr_30",name:"Healthy university administration",profile:"healthy",depth:30,role:"managerial",scenario:{organizationName:"Westbridge University",businessUnit:"Academic Administration",industry:"education_nonprofit",employeeCount:5100,peopleInvolved:7,hourlyCost:61,annualVolume:45,meetingHours:12,processName:"New program approvals",regulatoryIntensity:"moderate"}},
  {id:"healthy_exec_60",name:"Healthy defense program",profile:"healthy",depth:60,role:"senior_leader",scenario:{organizationName:"Meridian Defense Services",businessUnit:"Program Governance",industry:"government_defense",employeeCount:12000,peopleInvolved:11,hourlyCost:104,annualVolume:30,meetingHours:20,processName:"Program baseline approvals",regulatoryIntensity:"high"}},
  {id:"mixed_exec_10",name:"Mixed hospital leadership",profile:"mixed",depth:10,role:"senior_leader",scenario:{organizationName:"Harbor Regional Medical Center",businessUnit:"Clinical Governance",industry:"healthcare_life_sciences",employeeCount:3300,peopleInvolved:8,hourlyCost:84,annualVolume:80,meetingHours:18,processName:"Clinical policy exceptions",regulatoryIntensity:"high"}},
  {id:"mixed_ops_60",name:"Mixed financial operations",profile:"mixed",depth:60,role:"operational",scenario:{organizationName:"Stonewell Financial",businessUnit:"Payment Operations",industry:"financial_services",employeeCount:1900,peopleInvolved:10,hourlyCost:73,annualVolume:240,meetingHours:14,processName:"Payment exception resolution",regulatoryIntensity:"high"}},
  {id:"severe_mgr_10",name:"Severe technology scale-up",profile:"severe",depth:10,role:"managerial",scenario:{organizationName:"Kiteframe Labs",businessUnit:"Product and Engineering",industry:"technology_software",employeeCount:420,peopleInvolved:12,hourlyCost:118,annualVolume:150,meetingHours:24,processName:"Production incident decisions",regulatoryIntensity:"low"}},
  {id:"severe_ops_30",name:"Severe healthcare handoffs",profile:"severe",depth:30,role:"operational",scenario:{organizationName:"Cedar County Health",businessUnit:"Patient Access",industry:"healthcare_life_sciences",employeeCount:1700,peopleInvolved:14,hourlyCost:57,annualVolume:365,meetingHours:28,processName:"Complex referral handoffs",regulatoryIntensity:"high"}},
  {id:"severe_exec_60",name:"Severe public-sector governance",profile:"severe",depth:60,role:"senior_leader",scenario:{organizationName:"Metro Infrastructure Authority",businessUnit:"Capital Programs",industry:"government_defense",employeeCount:8600,peopleInvolved:18,hourlyCost:88,annualVolume:90,meetingHours:40,processName:"Capital change-control decisions",regulatoryIntensity:"high"}},
  {id:"contradictory",name:"Contradictory cross-role signals",profile:"contradictory",depth:30,role:"managerial",scenario:{organizationName:"Orchard Mutual",businessUnit:"Claims Transformation",industry:"financial_services",employeeCount:2800,peopleInvolved:9,hourlyCost:79,annualVolume:180,meetingHours:20,processName:"Claims policy exceptions",regulatoryIntensity:"high"}},
  {id:"unpriced_hours",name:"No coordination-hours estimate",profile:"mixed",depth:30,role:"managerial",scenario:{organizationName:"Eastport Foundation",businessUnit:"Grant Operations",industry:"education_nonprofit",employeeCount:210,peopleInvolved:6,hourlyCost:64,annualVolume:36,meetingHours:0,processName:"Grant exception approvals",regulatoryIntensity:"low"}},
  {id:"unpriced_rate",name:"No labor-rate estimate",profile:"mixed",depth:30,role:"operational",scenario:{organizationName:"Lakeside Cooperative",businessUnit:"Member Services",industry:"other",employeeCount:95,peopleInvolved:4,hourlyCost:0,annualVolume:52,meetingHours:10,processName:"Member issue escalation",regulatoryIntensity:"low"}},
  {id:"small_org",name:"Small low-volume organization",profile:"mixed",depth:30,role:"senior_leader",scenario:{organizationName:"Beacon Arts Trust",businessUnit:"Administration",industry:"education_nonprofit",employeeCount:28,peopleInvolved:3,hourlyCost:48,annualVolume:12,meetingHours:5,processName:"Program funding decisions",regulatoryIntensity:"low"}},
  {id:"capacity_ceiling",name:"High-volume capacity ceiling",profile:"severe",depth:60,role:"managerial",scenario:{organizationName:"Continental Logistics",businessUnit:"Network Operations",industry:"other",employeeCount:7600,peopleInvolved:20,hourlyCost:68,annualVolume:2200,meetingHours:80,processName:"Network disruption escalation",regulatoryIntensity:"moderate"}},
  {id:"short_unmeasured",name:"Short route with unmeasured governance",profile:"mixed",depth:10,role:"operational",scenario:{organizationName:"Pine Street Retail",businessUnit:"Store Operations",industry:"retail_consumer",employeeCount:1400,peopleInvolved:6,hourlyCost:49,annualVolume:300,meetingHours:9,processName:"Store exception handling",regulatoryIntensity:"low"}},
  {id:"long_governance",name:"Long route with governance evidence",profile:"mixed",depth:60,role:"managerial",scenario:{organizationName:"North Coast Energy",businessUnit:"Asset Governance",industry:"energy_utilities",employeeCount:4400,peopleInvolved:13,hourlyCost:96,annualVolume:72,meetingHours:34,processName:"Maintenance deferral approvals",regulatoryIntensity:"high"}},
  {id:"no_experience",name:"No experiential notes",profile:"mixed",depth:30,role:"managerial",experience:null,scenario:{organizationName:"Summit Manufacturing",businessUnit:"Plant Operations",industry:"manufacturing_industrial",employeeCount:2300,peopleInvolved:8,hourlyCost:66,annualVolume:100,meetingHours:16,processName:"Production deviation approvals",regulatoryIntensity:"moderate"}},
  {id:"partial_experience",name:"Partial experiential notes",profile:"mixed",depth:30,role:"senior_leader",experience:{observedSeniorLeader:"Leadership sees recurring exceptions but has limited visibility into how managers restore ownership after each handoff."},scenario:{organizationName:"Redwood Bioanalytics",businessUnit:"Quality and Laboratory Operations",industry:"healthcare_life_sciences",employeeCount:780,peopleInvolved:7,hourlyCost:101,annualVolume:64,meetingHours:15,processName:"Laboratory deviation review",regulatoryIntensity:"high"}}
];
const SCORE_ITEM_RE=/^sc_d[1-5]_|^sc_c[1-3]_/;
let supaClient=null,authToken=null,running=false,artifacts=null,allCaseArtifacts=[],reportFrame=null,currentCase=null;

function log(message){$("log").textContent+=`\n${new Date().toLocaleTimeString()}  ${message}`;$("log").scrollTop=1e9}
function textFor(item){return typeof item?.text==="string"?item.text:(item?.text?.managerial||item?.text?.senior_leader||item?.text?.operational||item?.id||"")}
function labelFor(item,value){const option=(item?.options||[]).find(entry=>JSON.stringify(entry.value)===JSON.stringify(value));return option?.label||String(value)}
function fileStem(testCase=currentCase){return `${testCase?.id||"structural-clarity"}-acceptance`}
function download(blobOrText,name,type="text/plain;charset=utf-8"){
  const blob=blobOrText instanceof Blob?blobOrText:new Blob([blobOrText],{type});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function freshToken(){
  const {data}=await supaClient.auth.getSession();authToken=data?.session?.access_token||null;return authToken;
}
async function postJSON(url,body,label){
  for(let attempt=1;attempt<=4;attempt++){
    await freshToken();const started=performance.now();
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${authToken}`},body:body===undefined?undefined:JSON.stringify(body)});
    const raw=await response.text();let data=null;try{data=JSON.parse(raw)}catch(_e){}
    log(`${label}: HTTP ${response.status} (${Math.round(performance.now()-started)} ms)`);
    if(response.status===429){const seconds=Number(response.headers.get("Retry-After")||data?.retry_after_seconds||30);log(`Rate limited. Retrying in ${seconds} seconds.`);await sleep((seconds+1)*1000);continue}
    if(!response.ok||!data)throw new Error(`${label}: ${data?.error||data?.message||raw.slice(0,180)||`HTTP ${response.status}`}`);
    return data;
  }
  throw new Error(`${label}: rate limit did not clear`);
}
function normalizedScenario(testCase){
  const s={...NORTHBRIDGE,...testCase.scenario};
  s.business_unit=s.businessUnit;s.process_name=s.processName;s.focus_area=s.processName;s.employee_count=s.employeeCount;
  s.peopleAffected=s.peopleInvolved;s.confidenceLevel=s.confidenceLevel||"moderate";s.confidence_level=s.confidenceLevel;
  s.participantMode=testCase.role;s.participant_mode=testCase.role;s.diagnosticDepth=testCase.depth;s.diagnostic_depth=testCase.depth;
  s.regulatory_intensity=s.regulatoryIntensity;s.decisionType=s.decisionType||"operational";s.decision_type=s.decisionType;
  s.organizationSize=s.employeeCount>=5000?"enterprise":s.employeeCount>=1000?"large":s.employeeCount>=250?"medium":"small";
  return s;
}
function optionAt(item,index){const options=item.options||[];if(!options.length)throw new Error(`Question ${item.id} has no options`);return options[index<0?options.length-1:Math.min(index,options.length-1)].value}
function answerFor(item,testCase,scenario){
  const overrides=testCase.answers||{};
  let value;
  if(Object.prototype.hasOwnProperty.call(overrides,item.id)) value=overrides[item.id];
  else if(item.id==="sc_g1_structure_type") value="cross-functional";
  else if(item.id==="sc_g2_change_pace") value=testCase.profile==="healthy"?"some_change_manageable":testCase.profile==="severe"?"continuous_reorganization":"frequent_change";
  else if(item.id==="sc_g3_primary_concern") value=testCase.profile==="healthy"?"handoffs_and_transfers":"multiple_concerns";
  else if(item.id==="sc_g4_compensation_level") value=testCase.profile==="healthy"?"minimal_occasional_clarification":testCase.profile==="severe"?"system_runs_on_informal_knowledge":"significant_key_people_fill_gaps";
  else if(item.id==="sc_ctx_people_affected") value=scenario.peopleInvolved;
  else if(item.id==="sc_ctx_issues_per_month") value=Math.max(1,Math.round(scenario.annualVolume/12));
  else if(item.id==="sc_ctx_meetings_per_week") value=Math.max(0,Math.round(scenario.meetingHours/2));
  else if(SCORE_ITEM_RE.test(item.id)){
    const index=testCase.profile==="contradictory"?(Array.from(item.id).reduce((n,c)=>n+c.charCodeAt(0),0)%2?0:-1):PROFILE_INDEX[testCase.profile];
    value=optionAt(item,index);
  } else throw new Error(`No semantic fixture policy for ${item.id}. Available options: ${(item.options||[]).map(x=>`${x.value} (${x.label})`).join(", ")}`);
  if(Array.isArray(item.options)&&item.options.length&&!item.options.some(option=>JSON.stringify(option.value)===JSON.stringify(value)))throw new Error(`Fixture value ${JSON.stringify(value)} is invalid for ${item.id}. Available: ${item.options.map(x=>JSON.stringify(x.value)).join(", ")}`);
  return value;
}
function experienceForCase(testCase,scenario=normalizedScenario(testCase)){
  if(testCase.experience!==undefined)return testCase.experience;
  const condition=testCase.profile==="healthy"?"generally clear, with occasional exceptions":testCase.profile==="severe"?"routinely unclear and dependent on escalation":"documented but interpreted differently when exceptions arise";
  return {
    self:`From the ${testCase.role.replace("_"," ")} vantage point, ${scenario.processName.toLowerCase()} is ${condition}.`,
    observedOperational:`Operational staff can usually complete routine work, but they must locate the next owner when ${scenario.processName.toLowerCase()} leaves the standard path.`,
    observedManagerial:`Managers in ${scenario.businessUnit} spend time interpreting boundaries and restoring ownership when exceptions arise.`,
    observedSeniorLeader:`Senior leaders see the published design and final outcomes more readily than the informal work used to keep ${scenario.processName.toLowerCase()} moving.`
  };
}
function experienceLayer(testCase,scenario){
  const experience=experienceForCase(testCase,scenario);
  if(!experience)return {participantPerspective:testCase.role,hasInput:false,source:"none",entries:[]};
  const definitions=[
    ["self",`Your ${testCase.role.replace("_"," ")} experience`],
    ["observedOperational","What operational staff may be experiencing"],
    ["observedManagerial","What managers may be experiencing"],
    ["observedSeniorLeader","What senior leaders may be seeing"]
  ];
  const entries=definitions.filter(([key])=>String(experience[key]||"").trim()).map(([key,label])=>({key,label,text:experience[key]}));
  return {participantPerspective:testCase.role,hasInput:Boolean(entries.length),source:"unedited_participant_input",entries};
}
async function driveApi(testCase){
  const scenario=normalizedScenario(testCase);
  const experience=experienceForCase(testCase,scenario)||{};
  const startRequest={...scenario};
  const start=await postJSON(`${API_BASE}/structural-clarity/run/start`,startRequest,"start");
  if(!start.ok)throw new Error(`start: ${start.error||start.message||"not accepted"}`);
  const trace={runId:start.runId,start:{request:clone(startRequest),response:clone(start)},answers:[],finalize:null};
  let item=start.nextItem,guard=0;
  while(item){
    if(++guard>60)throw new Error("Adaptive route exceeded 60 questions");
    const value=answerFor(item,testCase,scenario);const request={itemId:item.id,value};
    const response=await postJSON(`${API_BASE}/structural-clarity/run/${start.runId}/answer`,request,`answer ${guard}: ${item.id}`);
    trace.answers.push({sequence:guard,id:item.id,dimension:item.dimension||null,question:textFor(item),selectedValue:clone(value),selectedAnswer:labelFor(item,value),questionType:item.questionType||null,required:item.isOptional!==true,request:clone(request),response:clone(response)});
    if(!response.ok)throw new Error(`answer ${item.id}: ${response.error||response.message||"not accepted"}`);
    if(response.shouldStop)break;item=response.nextItem;
  }
  const finalizeRequest={confidenceLevel:scenario.confidenceLevel,confidence_level:scenario.confidenceLevel,rawExperience:experience};
  const finalized=await postJSON(`${API_BASE}/structural-clarity/run/${start.runId}/finalize`,finalizeRequest,"finalize");
  trace.finalize={request:clone(finalizeRequest),response:clone(finalized)};
  if(!finalized.ok)throw new Error(`finalize: ${finalized.error||finalized.message||"not accepted"}`);
  if(finalized.locked===true||(finalized.result||{}).locked===true)throw new Error(`The test account is locked: ${finalized.reason||"run limit reached"}`);
  const result=finalized.result||finalized;
  if(!Number.isFinite(Number(result.score)))throw new Error("Finalize returned no numeric score");
  const layer=experienceLayer(testCase,scenario);
  const payload={...(finalized.legacyPayload||{}),...scenario,rawExperience:experience,raw_experience:experience,experientialLayer:layer,experiential_layer:layer};
  return {case:testCase,scenario,runId:start.runId,result,payload,trace,finalized};
}
async function renderArtifacts(apiRun){
  const source=await (await fetch(`${PAGE_BASE}/structural-clarity.html`,{cache:"no-store"})).text();
  if(!source.includes("__mondermanTestHooks"))throw new Error("Production report page does not expose acceptance hooks");
  const injected={result:apiRun.result,payload:apiRun.payload,narrative:apiRun.result.interpretive_prose||apiRun.result.narrative||null};
  const inject=`<base href="${PAGE_BASE}/"><script>window.__mondermanInjectedResult=${JSON.stringify(injected).replace(/</g,"\\u003c")};<\/script>`;
  const doc=source.replace(/<head([^>]*)>/i,(match,attrs)=>`<head${attrs}>${inject}`);
  $("emptyPreview")?.remove();reportFrame=document.createElement("iframe");reportFrame.title="Rendered Structural Clarity report";$("frameWrap").replaceChildren(reportFrame);reportFrame.srcdoc=doc;
  await new Promise(resolve=>{reportFrame.onload=resolve;setTimeout(resolve,12000)});
  for(let i=0;i<80&&!reportFrame.contentWindow?.__mondermanInjectionApplied;i++)await sleep(250);
  const hooks=reportFrame.contentWindow?.__mondermanTestHooks;
  if(!hooks||!reportFrame.contentWindow?.__mondermanInjectionApplied)throw new Error("Production renderer did not accept the finalized payload");
  const summaryHtml=hooks.buildExecutiveReportHtml(apiRun.result,apiRun.payload);
  const fullHtml=hooks.buildFullReportHTML(apiRun.result,apiRun.payload,"Monderman Structural Clarity Report");
  const jsonArtifact=hooks.buildCrossDiagnosticArtifact(apiRun.result,apiRun.payload);
  log("Building PDF from the production report renderer…");
  const pdfResult=await hooks.downloadExecutiveReportPdf({returnBlob:true});
  const iframeBlob=pdfResult?.blob;
  if(!pdfResult?.ok||!iframeBlob||typeof iframeBlob.arrayBuffer!=="function"||!Number.isFinite(Number(iframeBlob.size)))throw new Error(`PDF generation failed: ${pdfResult?.error||pdfResult?.reason||"no PDF blob"}`);
  // A Blob created in the report iframe belongs to that iframe's JavaScript
  // realm, so `iframeBlob instanceof Blob` is false in the parent even when it
  // is a valid PDF. Copy its bytes into a parent-realm Blob before retaining
  // and downloading it.
  const pdfBlob=new Blob([await iframeBlob.arrayBuffer()],{type:iframeBlob.type||"application/pdf"});
  return {summaryHtml,fullHtml,jsonArtifact,pdfBlob,pdf:{size:pdfBlob.size,type:pdfBlob.type,pageCount:Number(pdfResult.pageCount||0)}};
}
function plainText(html){const doc=new DOMParser().parseFromString(html,"text/html");doc.querySelectorAll("style,script").forEach(node=>node.remove());return (doc.body?.textContent||"").replace(/\s+/g," ").trim()}
function sectionText(html,heading){const doc=new DOMParser().parseFromString(html,"text/html");const node=Array.from(doc.querySelectorAll("h1,h2,h3,h4")).find(el=>el.textContent.trim().toLowerCase()===heading.toLowerCase());return (node?.closest("section")?.textContent||node?.parentElement?.textContent||"").replace(/\s+/g," ").trim()}
function expectedBand(score){return score>=83?"High structural clarity":score>=67?"Moderate structural clarity":score>=49?"Material ambiguity":"Structural clarity breakdown"}
function runChecks(apiRun,files){
  const result=apiRun.result,ex=result.exposure||{},coverage=result.dimension_coverage||result.measurement_coverage||{},summary=plainText(files.summaryHtml),full=plainText(files.fullHtml),score=Number(result.score),band=String(result.score_band||result.band||"");
  const dimensions=Object.entries(result.dimensions||{}),unmeasured=coverage.unmeasured_dimensions||[];
  const combined=`${summary} ${full}`;const jsonText=JSON.stringify(files.jsonArtifact);const model=ex.model||{};
  const updateSection=sectionText(files.summaryHtml,"What would update this read").toLowerCase();
  const currentPerspective=apiRun.case.role.replace("_","[- ]?");
  const recommendations=files.jsonArtifact.findings?.recommendations||[];
  const composition=ex.composition||{};const compositionTotal=Object.values(composition).reduce((sum,value)=>sum+(Number(value)||0),0);
  const tolerance=(actual,expected,absolute=2)=>Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<=Math.max(absolute,Math.abs(expected)*.01);
  const quadrant=reportFrame.contentWindow.__mondermanTestHooks.getQuadrantCoordinates(apiRun.result);
  const governanceValue=result.dimensions?.duplicate_approvals_inverse;\n  const governanceMeasured=governanceValue!=null&&Number.isFinite(Number(governanceValue));
  const checks=[
    ["Nonzero score",score>0&&score<=100,`score=${score}`],
    ["Band matches score",band===expectedBand(score),`${score} → ${band}`],
    ["Scorer version present",Boolean(result.scorer_version),String(result.scorer_version||"missing")],
    ["Config version present",Boolean(result.config_version),String(result.config_version||"missing")],
    ["Organization identity in both HTML files",summary.includes(apiRun.scenario.organizationName)&&full.includes(apiRun.scenario.organizationName),apiRun.scenario.organizationName],
    ["Function identity in both HTML files",summary.includes(apiRun.scenario.businessUnit)&&full.includes(apiRun.scenario.businessUnit),apiRun.scenario.businessUnit],
    ["Coverage metadata present",Number.isFinite(Number(coverage.coverage_percent)),JSON.stringify(coverage)],
    ["Coverage counts reconcile",Number(coverage.measured_dimension_count)+unmeasured.length===dimensions.length,`${coverage.measured_dimension_count||0} measured + ${unmeasured.length} unmeasured / ${dimensions.length}`],
    ["Unmeasured dimensions remain null",unmeasured.every(key=>result.dimensions?.[key]===null),unmeasured.map(key=>`${key}=${result.dimensions?.[key]}`).join(", ")||"none"],
    ["Annual cost reconciles",ex.priceable===false?(ex.annual_cost==null&&ex.annual_hours==null):tolerance(Number(ex.annual_cost),Number(ex.annual_hours)*Number(ex.average_hourly_cost)),`${ex.annual_cost} vs ${ex.annual_hours} × ${ex.average_hourly_cost}`],
    ["Capacity drag reconciles",ex.priceable===false?ex.capacity_drag_percent==null:(Number(ex.total_capacity_hours)>0&&Math.abs((Number(ex.annual_hours)/Number(ex.total_capacity_hours)*100)-Number(ex.capacity_drag_percent))<=0.51),`${ex.capacity_drag_percent}% displayed; ${(Number(ex.annual_hours)/Number(ex.total_capacity_hours)*100).toFixed(2)}% recomputed`],
    ["Recoverable cost reconciles",ex.priceable===false?ex.recoverable_cost==null:tolerance(Number(ex.recoverable_cost),Number(ex.annual_cost)*Number(ex.recoverable_share_percent)/100,2),`${ex.recoverable_cost} at ${ex.recoverable_share_percent}%`],
    ["Recoverable is below burden",ex.priceable===false||Number(ex.recoverable_cost)<=Number(ex.annual_cost),`${ex.recoverable_cost} ≤ ${ex.annual_cost}`],
    ["Composition reconciles",!Object.keys(composition).length||tolerance(compositionTotal,Number(ex.annual_hours),2),`${compositionTotal} vs ${ex.annual_hours}`],
    ["Exposure inputs reconcile",Number(model.input_hours_per_run)===Number(apiRun.scenario.meetingHours)&&Number(model.annual_cycles)===Number(apiRun.scenario.annualVolume),`${model.input_hours_per_run} × ${model.annual_cycles}`],
    ["Attribution model disclosed",Number(model.attributable_burden_share_percent)===55&&Boolean(model.formula),`${model.attributable_burden_share_percent}% · ${model.formula||"missing formula"}`],
    ["Attributed hours reconcile",tolerance(Number(model.attributed_hours_before_capacity_limit),Number(apiRun.scenario.meetingHours)*Number(apiRun.scenario.annualVolume)*.55,2),`${model.attributed_hours_before_capacity_limit} vs ${apiRun.scenario.meetingHours} × ${apiRun.scenario.annualVolume} × 55%`],
    ["Summary HTML built",files.summaryHtml.length>20000&&/<html[\s>]/i.test(files.summaryHtml),`${files.summaryHtml.length} bytes`],
    ["Full HTML built",files.fullHtml.length>25000&&/<html[\s>]/i.test(files.fullHtml),`${files.fullHtml.length} bytes`],
    ["Neue Haas included in both HTML files",/Neue Haas Grotesk/i.test(files.summaryHtml)&&/Neue Haas Grotesk/i.test(files.fullHtml),"font declaration"],
    ["No placeholder or invalid values",!PLACEHOLDER_RE.test(`${combined} ${jsonText}`),( combined.match(PLACEHOLDER_RE)||["none"] )[0]],
    ["No cross-diagnostic language leakage",!/process, systems, control, reporting, or adaptation|faster decision pathways without weakening essential control/i.test(combined),(combined.match(/process, systems, control, reporting, or adaptation|faster decision pathways without weakening essential control/i)||["none"])[0]],
    ["Score direction language is correct",!/Rising scores would suggest drift/i.test(combined),"higher scores mean greater clarity"],
    ["No empty experiential synthesis",!/Experiential synthesis\s+(?:Leadership question|How to use this layer)/i.test(summary),"empty panels must be omitted"],
    ["Current perspective is not prescribed again",!new RegExp(`(?:a |another )?${currentPerspective}[- ]perspective run`).test(updateSection),apiRun.case.role],
    ["Priority actions are usable and distinct",recommendations.length>=2&&recommendations.every(item=>String(item).trim().length>=20)&&new Set(recommendations.map(item=>String(item).toLowerCase().replace(/\W/g,""))).size===recommendations.length,`${recommendations.length} actions`],
    ["JSON does not expose raw internal result/payload",!Object.prototype.hasOwnProperty.call(files.jsonArtifact,"result")&&!Object.prototype.hasOwnProperty.call(files.jsonArtifact,"payload"),"customer artifact only"],
    ["JSON does not expose internal pattern enums",!/ownership_blur_pattern|authority_gap_pattern|handoff_breakdown_pattern|governance_overweight_pattern/i.test(jsonText),(jsonText.match(/ownership_blur_pattern|authority_gap_pattern|handoff_breakdown_pattern|governance_overweight_pattern/i)||["none"])[0]],
    ["JSON preserves complete answer trace",Array.isArray(files.jsonArtifact.answer_trace)&&files.jsonArtifact.answer_trace.length===apiRun.trace.answers.length,`${files.jsonArtifact.answer_trace?.length||0} of ${apiRun.trace.answers.length} answers`],
    ["API trace matches browser ledger",Array.isArray(apiRun.payload.answer_trace)&&apiRun.payload.answer_trace.length===apiRun.trace.answers.length,`${apiRun.payload.answer_trace?.length||0} of ${apiRun.trace.answers.length} answers`],
    ["Evidence counts reconcile",Object.entries(coverage.evidence_counts||{}).every(([key,value])=>Number(value)===Number(apiRun.payload.measurement_evidence_counts?.[key]??value)),JSON.stringify(coverage.evidence_counts||{})],
    ["Score parity in both HTML files",summary.includes(String(Math.round(score)))&&full.includes(String(Math.round(score))),`score=${score}`],
    ["Band parity in both HTML files",summary.toLowerCase().includes(band.toLowerCase())&&full.toLowerCase().includes(band.toLowerCase()),band],
    ["JSON parity",Number(files.jsonArtifact.score)===score&&JSON.stringify(files.jsonArtifact.dimensions)===JSON.stringify(result.dimensions),`score ${files.jsonArtifact.score}; dimensions ${Object.keys(files.jsonArtifact.dimensions||{}).length}`],
    ["JSON remains synthesis-compatible",Boolean(files.jsonArtifact.tool_type&&files.jsonArtifact.band&&files.jsonArtifact.primary_driver&&files.jsonArtifact.exposure&&Array.isArray(files.jsonArtifact.priority_actions)),`${files.jsonArtifact.tool_type} · ${files.jsonArtifact.primary_driver||"missing driver"}`],
    ["Unmeasured labels rendered",!unmeasured.length||(summary.match(/Not measured/gi)||[]).length>=unmeasured.length,`${unmeasured.length} expected`],
    ["PDF built",files.pdf.size>10000&&files.pdf.type==="application/pdf"&&files.pdf.pageCount>=8,`${files.pdf.size} bytes; ${files.pdf.pageCount} pages`],
    ["Chart marker policy",governanceMeasured?(quadrant&&Number.isFinite(quadrant.left)&&Number.isFinite(quadrant.top)&&quadrant.left>=8&&quadrant.left<=92&&quadrant.top>=8&&quadrant.top<=92):quadrant===null,governanceMeasured?JSON.stringify(quadrant):"governance not measured; no coordinate"]
  ];
  return checks.map(([name,ok,detail])=>({name,ok:Boolean(ok),detail}));
}
function showLedger(apiRun){
  const trace=apiRun.trace;
  $("ledger").replaceChildren(...trace.answers.map(entry=>{const li=document.createElement("li");li.innerHTML=`<strong>${entry.sequence}. ${escapeHtml(entry.question)}</strong><br>${escapeHtml(entry.selectedAnswer)} <code>${escapeHtml(entry.id)} = ${escapeHtml(JSON.stringify(entry.selectedValue))}</code>`;return li}));
  const missing=Array.isArray(apiRun.payload.unasked_questions)?apiRun.payload.unasked_questions:[];
  $("unasked").replaceChildren(...(missing.length?missing.map(entry=>{const li=document.createElement("li");li.innerHTML=`<code>${escapeHtml(entry.item_id||entry.question_id||"")}</code> — ${escapeHtml(entry.question||"Not asked by the adaptive route")}`;return li}):[Object.assign(document.createElement("li"),{textContent:"None."})]));
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))}
function enableDownloads(enabled){["pdfBtn","summaryBtn","fullBtn","jsonBtn","bundleBtn","matrixBtn","desktopBtn","mobileBtn"].forEach(id=>$(id).disabled=!enabled)}
function renderChecks(checks){$("checks").replaceChildren(...checks.map(check=>{const li=document.createElement("li");li.innerHTML=`<span class="${check.ok?"pass":"fail"}">${check.ok?"PASS":"FAIL"}</span> — ${escapeHtml(check.name)}<small>${escapeHtml(check.detail)}</small>`;return li}))}
function selectCaseArtifact(index){
  const entry=allCaseArtifacts[index];if(!entry)return;artifacts=entry.files;currentCase=entry.apiRun.case;
  const result=entry.apiRun.result,coverage=result.dimension_coverage||result.measurement_coverage||{};
  $("score").textContent=result.score;$("band").textContent=result.score_band||result.band||"—";$("coverage").textContent=`${coverage.coverage_percent??"—"}%`;$("runId").textContent=String(entry.apiRun.runId).slice(0,12);
  showLedger(entry.apiRun);renderChecks(entry.checks);enableDownloads(true);
  if(reportFrame)reportFrame.srcdoc=entry.files.fullHtml;
}
function renderCaseTable(){
  const body=$("caseTable").querySelector("tbody");body.innerHTML="";
  allCaseArtifacts.forEach((entry,index)=>{const failed=entry.checks.filter(check=>!check.ok);const tr=document.createElement("tr");tr.innerHTML=`<td style="text-align:left"><strong>${escapeHtml(entry.apiRun.case.name)}</strong></td><td>${escapeHtml(entry.apiRun.case.profile)}</td><td>${entry.apiRun.case.depth}</td><td>${escapeHtml(entry.apiRun.case.role.replace("_"," "))}</td><td>${entry.apiRun.result.score}</td><td class="${failed.length?"fail":"pass"}">${failed.length?`${failed.length} FAIL`:"PASS"}</td><td><button class="case-link" data-case-index="${index}">View</button></td>`;body.appendChild(tr)});
  body.querySelectorAll("[data-case-index]").forEach(button=>button.addEventListener("click",()=>selectCaseArtifact(Number(button.dataset.caseIndex))));
}
async function run(){
  if(running)return;running=true;artifacts=null;allCaseArtifacts=[];enableDownloads(false);$("runBtn").disabled=true;$("runStatus").className="status warn";$("runStatus").textContent="Running 0/18…";$("checks").innerHTML="<li>Running the live diagnostic matrix…</li>";$("caseTable").querySelector("tbody").innerHTML='<tr><td colspan="7">Starting…</td></tr>';$("log").textContent="Starting.";
  try{
    for(let index=0;index<CASE_DEFINITIONS.length;index++){
      const testCase=CASE_DEFINITIONS[index];currentCase=testCase;$("runStatus").textContent=`Running ${index+1}/${CASE_DEFINITIONS.length}: ${testCase.name}`;log(`CASE ${index+1}/${CASE_DEFINITIONS.length}: ${testCase.name}`);
      const apiRun=await driveApi(testCase);log(`Finalized run ${apiRun.runId}. Rendering four production artifacts.`);
      const files=await renderArtifacts(apiRun);const checks=runChecks(apiRun,files);
      const bundle={generatedAt:new Date().toISOString(),environment:{page:location.href,apiBase:API_BASE,frontendSource:`${PAGE_BASE}/structural-clarity.html`,userAgent:navigator.userAgent},case:testCase,scenario:apiRun.scenario,trace:apiRun.trace,unaskedQuestions:apiRun.payload.unasked_questions||[],result:apiRun.result,customerJson:files.jsonArtifact,exportMetadata:{summaryHtmlBytes:files.summaryHtml.length,fullHtmlBytes:files.fullHtml.length,pdf:files.pdf},checks};
      files.bundle=bundle;allCaseArtifacts.push({apiRun,files,checks});renderCaseTable();
      log(`${testCase.name}: ${checks.filter(check=>check.ok).length}/${checks.length} checks passing.`);
    }
    selectCaseArtifact(0);
    const failedCases=allCaseArtifacts.filter(entry=>entry.checks.some(check=>!check.ok));const failedChecks=allCaseArtifacts.reduce((sum,entry)=>sum+entry.checks.filter(check=>!check.ok).length,0);
    $("runStatus").className=`status ${failedCases.length?"fail":"pass"}`;$("runStatus").textContent=failedCases.length?`FAIL — ${failedChecks} checks across ${failedCases.length} cases`:`PASS — ${CASE_DEFINITIONS.length} cases`;
    log(`Matrix complete: ${CASE_DEFINITIONS.length-failedCases.length}/${CASE_DEFINITIONS.length} cases passed every check.`);
  }catch(error){console.error(error);$("runStatus").className="status fail";$("runStatus").textContent="FAIL";$("checks").innerHTML=`<li><span class="fail">FAIL</span> — ${escapeHtml(error.message)}</li>`;log(`FAILED: ${error.message}`)}
  finally{running=false;$("runBtn").disabled=!authToken}
}

$("runBtn").addEventListener("click",run);
$("clearBtn").addEventListener("click",()=>{artifacts=null;allCaseArtifacts=[];currentCase=null;reportFrame?.remove();reportFrame=null;$("frameWrap").innerHTML='<p id="emptyPreview">Run the test to render the report.</p>';$("score").textContent=$("band").textContent=$("coverage").textContent=$("runId").textContent="—";$("checks").innerHTML="<li>No checks have run.</li>";$("ledger").innerHTML="<li>Not available.</li>";$("unasked").innerHTML="<li>Not available.</li>";$("caseTable").querySelector("tbody").innerHTML='<tr><td colspan="7">Not run.</td></tr>';$("runStatus").className="status";$("runStatus").textContent="Not run";enableDownloads(false)});
$("pdfBtn").addEventListener("click",()=>download(artifacts.pdfBlob,`${fileStem()}.pdf`));
$("summaryBtn").addEventListener("click",()=>download(artifacts.summaryHtml,`${fileStem()}-summary.html`,"text/html;charset=utf-8"));
$("fullBtn").addEventListener("click",()=>download(artifacts.fullHtml,`${fileStem()}-full.html`,"text/html;charset=utf-8"));
$("jsonBtn").addEventListener("click",()=>download(JSON.stringify(artifacts.jsonArtifact,null,2),`${fileStem()}.json`,"application/json;charset=utf-8"));
$("bundleBtn").addEventListener("click",()=>download(JSON.stringify(artifacts.bundle,null,2),`${fileStem()}-bundle.json`,"application/json;charset=utf-8"));
$("matrixBtn").addEventListener("click",()=>download(JSON.stringify({generatedAt:new Date().toISOString(),caseCount:allCaseArtifacts.length,cases:allCaseArtifacts.map(entry=>({id:entry.apiRun.case.id,name:entry.apiRun.case.name,profile:entry.apiRun.case.profile,depth:entry.apiRun.case.depth,role:entry.apiRun.case.role,runId:entry.apiRun.runId,score:entry.apiRun.result.score,band:entry.apiRun.result.score_band||entry.apiRun.result.band,coverage:entry.apiRun.result.dimension_coverage||entry.apiRun.result.measurement_coverage,checks:entry.checks,exportMetadata:entry.files.bundle.exportMetadata}))},null,2),"structural-clarity-18-case-matrix.json","application/json;charset=utf-8"));
$("desktopBtn").addEventListener("click",()=>reportFrame?.classList.remove("mobile"));$("mobileBtn").addEventListener("click",()=>reportFrame?.classList.add("mobile"));

async function loadSupabaseClientFactory(){
  const importWithTimeout=(url)=>Promise.race([
    import(url),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Timed out loading ${url}`)),8000))
  ]);
  try{return (await importWithTimeout("https://esm.sh/@supabase/supabase-js@2")).createClient}
  catch(primaryError){
    $("authStatus").textContent="The primary authentication client did not load. Trying the backup source…";
    try{return (await importWithTimeout("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")).createClient}
    catch(backupError){throw new Error(`Authentication client failed to load. ${primaryError.message}; ${backupError.message}`)}
  }
}

try{
  const createClient=await loadSupabaseClientFactory();
  if(typeof createClient!=="function")throw new Error("Authentication client loaded without createClient");
  supaClient=createClient("https://ptkxrzgmeldalrkfruth.supabase.co","sb_publishable_-4d7OaQvErf0mpdwEJhIoQ_skFiVBhz",{auth:{persistSession:true,autoRefreshToken:true}});
  await freshToken();
  if(authToken){$("authStatus").textContent="Signed in. The comprehensive test creates 18 real test runs in the current account and may pause if the API rate limit is reached. It will not purchase, promote, archive, or alter other runs.";$("authStatus").style.borderColor="#8fc79d";$("runBtn").disabled=false}
  else{$("authStatus").textContent="Sign in to the Monderman workspace in this browser, then reload this page. The harness never creates an account."}
}catch(error){$("authStatus").textContent=`Session check failed: ${error.message}`}
