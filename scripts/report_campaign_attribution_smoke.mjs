// Public synthetic rendering gate. Optional --api-dir explicitly tests actual
// local deterministic fixtures/compiler; it never makes provider or DB calls.
// No private engine code or current-sample publication is bundled into SITE.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..'),rendererPath=path.join(root,'monderman-report.js');
const renderer=fs.readFileSync(rendererPath,'utf8'),sha=value=>createHash('sha256').update(value).digest('hex');
const apiArgument=process.argv.find(v=>v.startsWith('--api-dir='));
const outputArgument=process.argv.find(v=>v.startsWith('--output='));
const out=outputArgument?outputArgument.slice(9):fs.mkdtempSync('/tmp/campaign-attribution-');
if(outputArgument){assert.ok(path.isAbsolute(out));fs.mkdirSync(out,{mode:0o700});}
globalThis.fetch=()=>{throw Error('No external fetch in campaign display tests');};
const clone=value=>structuredClone(value),eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
let checks=0;const layouts=[],negatives=[],errors=[],screenshots=[],compiledSources=[];
const numericQuestion='During the past month, how many calendar days passed from a request entering your process to its final decision? Include waiting time.';
const categoricalQuestion='Which steps did the team use during the past month? Select all that apply.';
const baseResult=()=>({synthesis_product:'depth_synthesis',source_mode:'campaign',submitted_run_count:10,source_result_count:10,
  participant_count:10,lens_count:1,median_score:61,score:61,score_status:'published',score_label:'Median Diagnostic Score',
  generated_at:'2026-09-12T12:00:00Z',readiness_label:'MOCK campaign display',
  source_groups:[{tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:10,median_score:61,mean_score:61,score_range:[52,70],score_iqr:[58,64],config_versions:['1.4.0']}],
  ai_report:{status:'complete',report:{version:'MOCK-CAMPAIGN-ATTRIBUTION',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-12T12:00:00Z',
    composition:{authorship:'provider_authored_engine_bounded'},sources:[],evidence:[],
    interpretation:{summary:'MOCK: The saved counts describe answers to these exact questions, not the wider population.',observations:[],hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]},
    evidence_references:{summary:[]}}}});
function fixture(){
  const raw=baseResult(),report=raw.ai_report.report;
  const groups=[
    {group_ref:'G1',label:'Recorded answers: Decision Velocity / Managers',tool:'decision_velocity',role:'managerial',depth:30,questionnaire_version:'1.4.0',
      question:numericQuestion,response_format:'numeric',unit:null,unit_and_condition_basis:'exact_original_question',denominator_basis:'recorded_answers_to_this_exact_question',
      matching_source_packets:10,measures:{answered_responses:'F1',median:'F3',lower_quartile:'F4',upper_quartile:'F5'}},
    {group_ref:'G3',label:'Recorded answers: Decision Velocity / Managers',tool:'decision_velocity',role:'managerial',depth:30,questionnaire_version:'1.4.0',
      question:categoricalQuestion,response_format:'selected_option_combination',unit:null,unit_and_condition_basis:'exact_original_question',denominator_basis:'recorded_answers_to_this_exact_question',
      matching_source_packets:10,measures:{answered_responses:'F6',category_1:'F8',category_2:'F9'}},
  ];
  const labels={answered_responses:'Recorded answers',median:'Median reported estimate',lower_quartile:'Lower quartile of reported estimates',upper_quartile:'Upper quartile of reported estimates',category_1:'Recorded selection: Approval; Coordination',category_2:'Recorded selection: Review'};
  const values=[10,10,14,10,18,10,10,5,5];
  for(const group of groups)for(const [measure,id]of Object.entries(group.measures))report.evidence.push({id,
    label:labels[measure],value:values[Number(id.slice(1))-1],
    provenance:'deterministic_campaign_answer_summary',group_ref:group.group_ref,group_label:group.label});
  report.campaign_answer_evidence={version:'campaign-recorded-answer-summary-20260912.1',coverage:{selected_sources:10,original_packets_available:10,
    source_detail_status:'available',available_question_groups:3,included_question_groups:3,detail_status:'included'},groups};
  report.evidence_references.summary=Object.values(groups[0].measures);
  report.interpretation.observations=[{text:'MOCK: These counts concern whole recorded selections.',evidence_ids:Object.values(groups[1].measures),source_ids:[]},
    {text:'MOCK: Repeated citations should not duplicate the printed register.',evidence_ids:['F1','F3'],source_ids:[]}];
  return raw;
}
const cases=[{name:'mock-filtered-groups',raw:fixture(),mockOnly:true}];
if(apiArgument){
  const api=apiArgument.slice(10);assert.ok(path.isAbsolute(api),'Explicit private API path must be absolute');
  const files=['certification/campaign-source-fixtures.mjs','synthesis-evidence-packet.js','report-ai-composition.js'];
  const loaded=[];for(const file of files){const full=path.join(api,file);compiledSources.push({file,sha256:sha(fs.readFileSync(full))});loaded.push(await import(pathToFileURL(full).href));}
  const [{buildCampaignSourceFixture,campaignSourceFixtureWire},{buildSynthesisEvidencePacket},{buildReportAIComposition}]=loaded;
  for(const tools of [['DV'],['DV','OS']]){
    const state=await buildCampaignSourceFixture({tools}),packet=buildSynthesisEvidencePacket(state.result),wire=campaignSourceFixtureWire(packet),composition=buildReportAIComposition(wire,packet);
    const groupFor=new Map(packet.campaign_source_evidence.groups.flatMap(group=>Object.values(group.measures).map(id=>[id,group])));
    const report={version:'MOCK-ACTUAL-COMPILED-CAMPAIGN',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-12T12:00:00Z',
      composition:{authorship:composition.authorship},interpretation:composition.interpretation,
      evidence:packet.facts.map(({id,label,value,provenance,unit})=>({id,label,value,provenance,...(unit===undefined?{}:{unit}),
        ...(groupFor.has(id)?{group_ref:groupFor.get(id).group_ref,group_label:groupFor.get(id).label}:{})})),
      evidence_references:{summary:composition.summaryEvidence.evidence_ids,summary_sources:composition.summaryEvidence.source_ids},
      campaign_answer_evidence:packet.campaign_source_evidence,sources:packet.research.sources,limitations:packet.limitations};
    cases.push({name:'actual-compiled-'+tools.join('-'),raw:{...state.result,ai_report:{status:'complete',report}},mockOnly:true,
      packetSha256:packet.snapshot_id,compiledSha256:sha(JSON.stringify(composition.interpretation)),actualAdaptiveRuns:state.rows.length});
  }
}
const first=r=>r.campaign_answer_evidence.groups[0],second=r=>r.campaign_answer_evidence.groups[1];
const fact=(r,id)=>r.evidence.find(f=>f.id===id);
const variants=[
  ['unknown graph version',r=>{r.campaign_answer_evidence.version='unknown';}],
  ['mixed personal and campaign graph',r=>{r.source_evidence={};}],
  ['duplicate G reference',r=>{second(r).group_ref='G1';}],
  ['out-of-order G reference',r=>{r.campaign_answer_evidence.groups.reverse();}],
  ['noncanonical G reference',r=>{first(r).group_ref='G01';}],
  ['G exceeds original included count',r=>{second(r).group_ref='G4';}],
  ['missing graph denominator',r=>{delete first(r).measures.answered_responses;}],
  ['duplicate fact mapping',r=>{first(r).measures.median='F4';}],
  ['absent mapped fact',r=>{r.evidence=r.evidence.filter(f=>f.id!=='F3');}],
  ['cross-group fact assignment',r=>{first(r).measures.median='F8';}],
  ['wrong fact G reference',r=>{r.evidence[2].group_ref='G3';}],
  ['wrong fact group label',r=>{r.evidence[2].group_label='Recorded answers: Decision Velocity / Senior leaders';}],
  ['wrong provenance',r=>{r.evidence[2].provenance='participant_numeric_answer';}],
  ['duplicate public evidence ID',r=>{r.evidence.push({...r.evidence[0]});}],
  ['unmapped campaign fact',r=>{r.evidence.push({...r.evidence[0],id:'F999'});}],
  // Original registered context is authenticated on the API. This public-only
  // renderer checks shape and graph links; it does not contain the private bank.
  ['missing original question',r=>{first(r).question='';}],
  ['wrong role',r=>{first(r).role='operational';}],
  ['wrong depth type',r=>{first(r).depth='30';}],
  ['malformed questionnaire version',r=>{first(r).questionnaire_version='PRIVATE-QUESTION-ID';}],
  ['wrong diagnostic',r=>{first(r).tool='operational_systems';}],
  ['unknown role',r=>{first(r).role='administrator';}],
  ['prototype diagnostic',r=>{first(r).tool='constructor';}],
  ['opaque private group label',r=>{first(r).label='SECRET-ORGANIZATION-ID';}],
  ['missing original units',r=>{delete first(r).unit_and_condition_basis;}],
  ['replacement currency unit',r=>{first(r).unit='USD';}],
  ['fact unit override',r=>{r.evidence[2].unit='USD';}],
  ['wrong denominator basis',r=>{first(r).denominator_basis='all_invited_people';}],
  ['small recorded-answer group',r=>{r.evidence[0].value=4;}],
  ['answer count exceeds matching packets',r=>{r.evidence[0].value=11;}],
  ['matching packets exceed available originals',r=>{first(r).matching_source_packets=11;}],
  ['missing matching packet metadata',r=>{delete first(r).matching_source_packets;}],
  ['matching packet metadata is not a fact reference',r=>{first(r).matching_source_packets='F1';}],
  ['retired matching packet fact measure',r=>{first(r).measures.matching_source_packets='F2';}],
  ['nonfinite estimate',r=>{r.evidence[2].value=Infinity;}],
  ['unordered quartiles',r=>{fact(r,'F4').value=20;}],
  ['invented measure',r=>{first(r).measures.mean='F10';}],
  ['string count',r=>{r.evidence[0].value='10';}],
  ['small categorical cell',r=>{fact(r,'F8').value=4;fact(r,'F9').value=6;}],
  ['category counts do not total answers',r=>{fact(r,'F8').value=6;}],
  ['wrong measure label',r=>{fact(r,'F3').label='Annual savings';}],
  ['cross-measure label swap',r=>{fact(r,'F3').label='Lower quartile of reported estimates';}],
  ['unavailable channel has groups',r=>{r.campaign_answer_evidence.coverage.source_detail_status='unavailable';}],
  ['withheld capacity channel has groups',r=>{r.campaign_answer_evidence.coverage.detail_status='not_included_limit';}],
  ['incomplete original count marked available',r=>{r.campaign_answer_evidence.coverage.original_packets_available=9;}],
];
function expectedAttribution(report,id){
  const group=report.campaign_answer_evidence.groups.find(g=>Object.values(g.measures).includes(id));if(!group)return null;
  const get=key=>report.evidence.find(f=>f.id===group.measures[key]).value.toLocaleString('en-US');
  return group.label+' · '+group.depth+'-minute depth · Questionnaire '+group.questionnaire_version+' · '+get('answered_responses')+' recorded answers · '+group.matching_source_packets.toLocaleString('en-US')+' matching saved reports';
}
for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{const url=new URL(route.request().url());
      if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
      return route.abort();});
    async function render(raw){await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:renderer});
      return page.evaluate(raw=>{const before=JSON.stringify(raw),html=MondermanReport.buildReportHtml(MondermanReport.fromSynthesis(raw));
        if(JSON.stringify(raw)!==before)throw Error('Renderer mutated saved fixture');return html;},raw);}
    for(const item of cases){
      const raw=item.raw,report=raw.ai_report.report,before=JSON.stringify(raw),html=await render(raw);
      eq(JSON.stringify(raw),before,'Fixture remains unchanged');
      for(const width of [390,834,1440]){
        await page.setViewportSize({width,height:1000});await page.emulateMedia({media:'screen'});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
        const details=page.locator('.mr-evidence-detail');
        for(let i=0;i<await details.count();i++)await details.nth(i).evaluate(el=>{el.open=true;});
        const supportSets=[report.evidence_references.summary||[],...(report.interpretation.observations||[]).map(x=>x.evidence_ids||[]),
          ...(report.interpretation.hypotheses||[]).map(x=>x.evidence_ids||[]),...(report.interpretation.recommendations||[]).map(x=>x.evidence_ids||[]),
          ...(report.interpretation.action_options||[]).map(x=>x.evidence_ids||[])];
        // Each support block follows saved evidence order, then the register
        // deduplicates in first-use order (not the wire's arbitrary ID order).
        const cited=[...new Set(supportSets.flatMap(ids=>report.evidence.filter(f=>ids.includes(f.id)).map(f=>f.id)))];
        const expected=cited.filter(id=>report.evidence.some(f=>f.id===id)).map(id=>expectedAttribution(report,id)).filter(Boolean);
        const observed=await page.locator('.mr-print-evidence .mr-evidence-attribution').allTextContents();
        eq(observed,expected,item.name+' exact print-register group mapping and citation order');
        eq(await page.locator('.mr-evidence-detail .mr-evidence-attribution').count()>0,true,item.name+' screen group attribution present');
        const expectedLabels=cited.filter(id=>report.evidence.some(f=>f.id===id)).map((id,index)=>{
          const group=report.campaign_answer_evidence.groups.find(g=>Object.values(g.measures).includes(id)),row=report.evidence.find(f=>f.id===id);
          return (index+1)+'. '+(group?group.question+' · ':'')+row.label;
        });
        eq(await page.locator('.mr-print-evidence .mr-evidence-entry strong').allTextContents(),expectedLabels,'Print labels restore exact questions with compact measure names only');
        eq(await page.locator('.mr-evidence-detail .mr-evidence-entry').evaluateAll(entries=>entries.every(entry=>{
          const attribution=entry.querySelector('.mr-evidence-attribution');if(!attribution)return true;
          const label=entry.querySelector('strong').textContent;
          return !label.startsWith(attribution.textContent.split(' · ')[0])&&!label.includes('; questionnaire ');
        })),true,'Screen evidence does not repeat full context inside the question label');
        for(const group of report.campaign_answer_evidence.groups.filter(g=>Object.values(g.measures).some(id=>cited.includes(id))))
          eq((await details.allTextContents()).some(text=>text.includes(group.question)),true,'Exact actor/work/period/unit conditions remain visible');
        const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          overlap:[...document.querySelectorAll('.mr-evidence-detail .mr-evidence-attribution')].some(el=>{const a=el.getBoundingClientRect(),b=el.nextElementSibling.getBoundingClientRect();return a.bottom>b.top+1;})}));
        eq(geometry,{overflow:0,overlap:false},item.name+' screen wrapping/containment');
        await details.first().evaluate(el=>{el.open=false;});await details.first().locator('summary').focus();await page.keyboard.press('Enter');
        eq(await details.first().evaluate(el=>el.open),true,'Supporting evidence opens by keyboard');
        if([390,1440].includes(width)){const file=item.name+'-'+engineName+'-'+width+'.png';await details.first().screenshot({path:path.join(out,file)});screenshots.push(file);}
        await page.emulateMedia({media:'print'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        eq(await page.locator('.mr-print-evidence').isVisible(),true,'Print register visible');eq(await details.first().isVisible(),false,'Print omits duplicated screen controls');
        eq(await page.locator('.mr-print-evidence .mr-evidence-attribution').allTextContents(),expected,'Print uses identical group context and counts');
        eq(await page.locator('.mr-print-evidence .mr-evidence-attribution').evaluateAll(nodes=>nodes.every(el=>{const a=el.getBoundingClientRect(),b=el.nextElementSibling.getBoundingClientRect();return a.bottom<=b.top+1&&a.right<=el.closest('.mr-evidence-entry').getBoundingClientRect().right+1;})),true,'Print group labels stay contained');
        layouts.push({case:item.name,engine:engineName,width,screen:true,print:true,sourceGroups:true});
      }
    }
    await page.emulateMedia({media:'screen'});
    for(const [name,change]of variants){const raw=fixture();change(raw.ai_report.report);const html=await render(raw);
      eq(html.includes('<span class="mr-evidence-attribution">'),false,name+' rejects attribution');negatives.push({engine:engineName,name});}
    const filtered=fixture();filtered.ai_report.report.campaign_answer_evidence.groups.shift();filtered.ai_report.report.evidence=filtered.ai_report.report.evidence.filter(f=>Number(f.id.slice(1))>5);
    await page.setContent(await render(filtered));eq(await page.locator('.mr-print-evidence .mr-evidence-attribution').count(),3,'Projected G3 retains label and full denominator graph without reindexing');
    const escaped=fixture(),report=escaped.ai_report.report,question='<img src=x onerror="window.campaignInjection=true"> Which steps?';
    first(report).question=question;
    first(report).private_hash='PRIVATE-GROUP-HASH';report.evidence[0].interpretation='PRIVATE-PROMPT-INSTRUCTION';
    const escapedHtml=await render(escaped);await page.setContent(escapedHtml);
    eq(await page.locator('.mr-evidence-entry img,.mr-evidence-entry script').count(),0,'Original question text is escaped');
    eq(await page.evaluate(()=>Boolean(window.campaignInjection)),false,'Escaped metadata cannot execute');
    eq(/PRIVATE-GROUP-HASH|PRIVATE-PROMPT-INSTRUCTION/.test(escapedHtml),false,'Private metadata is never displayed');
    const legacy=fixture();delete legacy.ai_report.report.campaign_answer_evidence;eq((await render(legacy)).includes('<span class="mr-evidence-attribution">'),false,'No invented group attribution for historical rows');
    const personal=baseResult();personal.source_mode='own_saved_runs';personal.ai_report.report.evidence=[{id:'F1',label:'Synthetic original answer',value:'Clear',provenance:'participant_structured_answer',source_ref:'R2',source_label:'Selected run B'}];
    personal.ai_report.report.evidence_references.summary=['F1'];personal.ai_report.report.source_evidence={version:'personal-source-evidence-20260912.1',sources:[
      {source_ref:'R1',label:'Selected run A',status:'available',tool:'decision_velocity',role:'managerial',depth:30,fact_ids:[]},
      {source_ref:'R2',label:'Selected run B',status:'available',tool:'decision_velocity',role:'managerial',depth:30,fact_ids:['F1']}]};
    await page.setContent(await render(personal));eq(await page.locator('.mr-print-evidence .mr-evidence-attribution').allTextContents(),['Selected run B · Decision Velocity · Perspective: Managers · 30-minute depth'],'Empty filtered personal source preserves later R2 identity');
  }finally{await browser.close();}
}
eq(errors,[],'No browser errors');eq(sha(fs.readFileSync(rendererPath)),sha(renderer),'Renderer remained fixed');
const receipt={status:'PASS',checks,layouts,negativeCases:negatives,screenshots,rendererSha256:sha(renderer),harnessSha256:sha(fs.readFileSync(import.meta.filename)),compiledSources,
  cases:cases.map(({raw,...meta})=>({...meta,fixtureSha256:sha(JSON.stringify(raw))})),mockOnly:true,providerCalls:0,databaseCalls:0,networkCalls:0,pdfsCreated:0,currentPublicationClaimed:false};
fs.writeFileSync(path.join(out,'MOCK-campaign-attribution-receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,layouts:layouts.length,negativeCases:negatives.length,output:out,actualCompiledCases:cases.length-1,providerCalls:0,pdfsCreated:0}));
