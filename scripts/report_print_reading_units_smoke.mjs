// Print-only grouping and display-role aliases. Fabricated fixtures, no browser or PDF creation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceBeforeRenderer39,renderer38Output} from './report_print_conditions_sources_smoke.mjs';
import {sourceBeforeOverviewPresentation} from './report_overview_presentation_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),sha=v=>createHash('sha256').update(v).digest('hex');
export const CURRENT='diagnostic-renderer-evidence-reading-20260913.38',PREVIOUS='diagnostic-renderer-evidence-reading-20260913.37';
const DELTA=[
  [
    "diagnostic-renderer-evidence-reading-20260913.38",
    "diagnostic-renderer-evidence-reading-20260913.37"
  ],
  [
    "'Participant observation · '+humanize(fact.role)",
    "'Participant observation · '+fact.role"
  ],
  [
    "    // Only short visible print units stay together. Long accounts remain able\n    // to span pages; hidden evidence detail never changes this length bound.\n    const boundedPrint=text=>text.length<=1000&&text.split(/\\r\\n|\\r|\\n/).length<=8;\n    const findings=(items,title,explanation,questionBlocks=false)=>arr(items).length?'<div class=\"mr-evidence-reading\"><h3>'+title+'</h3>'+(explanation?'<p class=\"mr-reading-context\">'+explanation+'</p>':'')+arr(items).map(item=>{\n      const text=firstStr(obj(item).text,typeof item==='string'?item:''),supporting=support(obj(item));\n      const printedSupport=(supporting.match(/<p class=\"mr-print-support\">([\\s\\S]*?)<\\/p>/)||[])[1]||'';\n      return '<article class=\"mr-finding'+(boundedPrint(text+printedSupport)?' mr-finding-bounded':'')+'\">'+((questionBlocks&&sourceBlock(obj(item)))||'<p>'+esc(text)+'</p>')+supporting+'</article>';\n    }).join('')+'</div>':'';\n",
    "    const findings=(items,title,explanation,questionBlocks=false)=>arr(items).length?'<div class=\"mr-evidence-reading\"><h3>'+title+'</h3>'+(explanation?'<p class=\"mr-reading-context\">'+explanation+'</p>':'')+arr(items).map(item=>'<article class=\"mr-finding\">'+((questionBlocks&&sourceBlock(obj(item)))||'<p>'+esc(firstStr(obj(item).text,typeof item==='string'?item:''))+'</p>')+support(obj(item))+'</article>').join('')+'</div>':'';\n"
  ],
  [
    "    const methodExplanation='Monderman’s diagnostic engine produces the scores and determines which findings and recommendations the evidence supports. AI contributes research and explanation within those rules. Automated checks and a separate AI review check the interpretation against its supporting evidence before publication.';\n    const methodProvenance='Prepared '+String(report.generated_at??'')+'. Model '+String(report.model??'')+'. Report version '+String(report.version??'')+'. This report preserves the evidence and research used when it was prepared.';\n    const boundedMethod=boundedPrint('How Monderman produced this interpretation\\n'+methodExplanation+'\\n'+methodProvenance);\n",
    ""
  ],
  [
    "      '<details class=\"mr-report-method'+(boundedMethod?' mr-report-method-bounded':'')+'\"><summary>How Monderman produced this interpretation</summary><div><p>'+esc(methodExplanation)+'</p><p>'+esc(methodProvenance)+'</p></div></details></section>';",
    "      '<details class=\"mr-report-method\"><summary>How Monderman produced this interpretation</summary><div><p>Monderman’s diagnostic engine produces the scores and determines which findings and recommendations the evidence supports. AI contributes research and explanation within those rules. Automated checks and a separate AI review check the interpretation against its supporting evidence before publication.</p><p>Prepared '+esc(report.generated_at)+'. Model '+esc(report.model)+'. Report version '+esc(report.version)+'. This report preserves the evidence and research used when it was prepared.</p></div></details></section>';"
  ],
  [
    "      .mr-authored-report .mr-finding-bounded,.mr-authored-report .mr-report-method-bounded{break-inside:avoid;page-break-inside:avoid}\n      .mr-authored-report .mr-evidence-reading>h3,.mr-authored-report .mr-evidence-reading>.mr-reading-context{break-after:avoid;page-break-after:avoid}\n      .mr-authored-report p:has(+.mr-evidence-detail+.mr-print-support){break-after:avoid;page-break-after:avoid}\n      .mr-authored-report .mr-print-support{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}\n",
    ""
  ]
];
export function sourceBeforeRenderer38(source){
  source=sourceBeforeOverviewPresentation(source);
  if(/diagnostic-renderer-evidence-reading-(?:20260913\.39|20260914\.4[0123])/.test(source))source=sourceBeforeRenderer39(source);
  for(const [now,before]of DELTA){assert.equal(source.split(now).length,2,'Exact approved renderer38 delta occurrence');source=source.replace(now,before);}
  assert.equal(sha(source),'39cd55e6b542940a3979d67f9aa652adcd7fa58d6fa2e907438d1cb42bec0b82');
  return source;
}
export function renderer37Output(html){
  html=renderer38Output(html);
  html=html.replaceAll(DELTA[5][0],'').replaceAll(' mr-finding-bounded','').replaceAll(' mr-report-method-bounded','').replaceAll(CURRENT,PREVIOUS);
  for(const role of ['operational','managerial','executive','senior_leader','not_specified','authorized_workspace_staff']){
    const display=role.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    html=html.replaceAll('Participant observation · '+display,'Participant observation · '+role);
  }
  return html;
}
function run(){
 let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
 const source=sourceBeforeRenderer39(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8')),prior=sourceBeforeRenderer38(source);
 eq(sourceBeforeRenderer38(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8')),prior,'Current renderer routes through the complete exact historical inverse');
 assert.throws(()=>sourceBeforeRenderer38(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8')+'\nUNREVIEWED'));checks++;
 const load=code=>{const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),c);vm.runInNewContext(code,c);return c.window.MondermanReport;};
 const R=load(source),old=load(prior);eq(R.rendererVersion,CURRENT);eq(old.rendererVersion,PREVIOUS);
 const make=(text='MOCK short finding.',role='senior_leader')=>({status:'complete',report:{
  version:'MOCK-REPORT',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-13T00:00:00Z',
  composition:{authorship:'provider_authored_engine_bounded'},sources:[],limitations:[],
  evidence:[{id:'F1',label:'MOCK question',value:'MOCK answer',provenance:'participant_structured_answer'}],
  experiential_evidence:[{id:'X1',role,lens:'institutional_performance',scope_label:'MOCK scope',text:'MOCK full participant account.'}],
  evidence_references:{summary:['F1'],summary_sources:[]},research_context:{status:'not_started'},
  interpretation:{summary:'MOCK summary.',observations:[{text,evidence_ids:['F1','X1'],source_ids:[]}],
   hypotheses:[{text:'MOCK possible explanation to investigate, not a proven cause.',evidence_ids:['F1'],source_ids:[]}],
   recommendations:[],action_options:[],recommended_option:null,limitations:[]}
 }});
 const render=state=>{const before=JSON.stringify(state),html=R.buildAIInterpretation(state);eq(JSON.stringify(state),before,'Original metadata and evidence unchanged');return html;};
 for(const role of ['operational','managerial','executive','senior_leader','not_specified','authorized_workspace_staff']){
   const s=make(undefined,role),h=render(s),oldHtml=old.buildAIInterpretation(s);
   eq(renderer37Output(h),oldHtml,'Exact original prose/order/support/source labels except approved role fallback');
   ok(h.includes('<article class="mr-finding mr-finding-bounded">'));
   ok(h.includes('<details class="mr-report-method mr-report-method-bounded">'));
   const display=role.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
   ok(h.includes('Participant observation · '+display));ok(!h.includes('Participant observation · '+role));
 }
 for(const text of ['x'.repeat(2000),Array(10).fill('MOCK line').join('\n')]){
   const s=make(text),h=render(s);ok(h.includes('<article class="mr-finding"><p>'+text+'</p>'),'Long/multiline unit remains splittable');
   eq(renderer37Output(h),old.buildAIInterpretation(s),'Long complete text preserved');
 }
 // Exact threshold includes the printed support note, not large hidden source text.
 const s=make(),h=render(s),note=h.match(/<article class="mr-finding[^"]*">[\s\S]*?<p class="mr-print-support">([\s\S]*?)<\/p>/)[1];
 for(const total of [999,1000,1001]){
   const f=make('x'.repeat(total-note.length));f.report.evidence[0].value='Long hidden evidence '.repeat(100);
   const out=render(f),first=out.match(/<article class="([^"]+)">/)[1];eq(first.includes('mr-finding-bounded'),total<=1000);
   eq(renderer37Output(out),old.buildAIInterpretation(f));
 }
 for(const value of ['a'.repeat(1500),Array(9).fill('line').join('\n')]){
   const f=make();f.report.model=value;const out=render(f);ok(out.includes('<details class="mr-report-method">'),'Long metadata permits page breaks');eq(renderer37Output(out),old.buildAIInterpretation(f));
 }
 for(const value of [null,undefined,'<tag>&"quoted\'value']){
   const f=make();f.report.model=value;f.report.generated_at=value;const out=render(f);
   eq(renderer37Output(out),old.buildAIInterpretation(f),'Exact original null/escape behavior');
   ok(!out.includes('<tag>'));
 }
 const labelled=make();labelled.report.experiential_evidence[0].label='Explicit original role label';let out=render(labelled);
 ok(out.includes('Explicit original role label'));eq(renderer37Output(out),old.buildAIInterpretation(labelled));
 const dup=make();dup.report.experiential_evidence.push({...dup.report.experiential_evidence[0],id:'F2'});
 dup.report.interpretation.observations[0].evidence_ids.push('F2');out=render(dup);
 ok(out.includes('Supporting evidence: 1, 2, 3.'));eq((out.match(/<strong>[23]\. Participant observation/g)||[]).length,2,'Distinct F/X identities are not deduplicated');
 const unsafe=make(undefined,'<img src=x onerror=1>');out=render(unsafe);ok(!out.includes('<img'));ok(out.includes('&lt;Img'));
 // Plain output and retained values outside the authored section are unchanged.
 for(const tool_type of ['operational_systems','decision_velocity','structural_clarity','institutional_performance']){
   const raw={tool_type,score:53,band:'MOCK band',ai_report:make(),key_findings:['MOCK recorded result'],priority_actions:['MOCK saved action']};
   const before=JSON.stringify(raw),full=R.buildReportHtml(R.fromRun(raw));
   eq(JSON.stringify(raw),before);eq(renderer37Output(full),old.buildReportHtml(old.fromRun(raw)));
 }
 ok(source.includes('.mr-authored-report .mr-finding,.mr-authored-report .mr-ai-action{break-inside:auto;page-break-inside:auto}'));
 ok(source.includes('.mr-authored-report .mr-finding-bounded,.mr-authored-report .mr-report-method-bounded{break-inside:avoid;page-break-inside:avoid}'));
 ok(source.includes('.mr-authored-report p:has(+.mr-evidence-detail+.mr-print-support){break-after:avoid;page-break-after:avoid}'));
 ok(source.includes('.mr-authored-report .mr-print-support{break-before:avoid;page-break-before:avoid;break-inside:avoid;page-break-inside:avoid}'));
 eq(sha(sourceBeforeRenderer39(fs.readFileSync(path.join(root,'monderman-report.js'),'utf8'))),sha(source));
 console.log(JSON.stringify({status:'PASS',checks,rendererVersion:CURRENT,originalRenderer37Sha256:sha(prior),browser:'not_run',pdfs:0,providerCalls:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();
