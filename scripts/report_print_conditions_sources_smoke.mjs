// Renderer39: print-only grouping/spacing; fabricated data, no browser/PDF/provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),sha=v=>createHash('sha256').update(v).digest('hex');
export const CURRENT='diagnostic-renderer-evidence-reading-20260913.39',PREVIOUS='diagnostic-renderer-evidence-reading-20260913.38';
const METHOD_COPY_BEFORE='The separate operational scenario documents scope, inputs, assumptions, costs and sensitivity ranges, informed by selected practices in <a href="https://www.gao.gov/products/gao-20-195g">GAO’s Cost Estimating and Assessment Guide</a>. This is not GAO approval, full compliance or a validated savings method.';
const METHOD_COPY_NOW='The separate operational scenario documents scope, inputs, assumptions and costs, informed by selected practices in <a href="https://www.gao.gov/products/gao-20-195g">GAO’s Cost Estimating and Assessment Guide</a>. Customer-defined low, central and high cases compare combined assumptions. This is not GAO approval, full compliance or a validated savings method.';
// Exact separately approved copy-only successor; never replace historical hashes.
function sourceBeforeMethodCopy(source){
 if(source.includes(METHOD_COPY_NOW)){assert.equal(source.split(METHOD_COPY_NOW).length,2);assert.equal(source.split(METHOD_COPY_BEFORE).length,1);return source.replace(METHOD_COPY_NOW,METHOD_COPY_BEFORE);}
 assert.equal(source.split(METHOD_COPY_BEFORE).length,2);return source;
}
const PRINT_CSS='      .mr-authored-report .mr-shared-conditions-bounded,.mr-authored-report .mr-research-source-bounded{break-inside:avoid;page-break-inside:avoid}\n      .mr-authored-report .mr-reading-limitations{break-inside:auto;page-break-inside:auto}\n      .mr-authored-report .mr-reading-limitations>.mr-finding{padding:6px 0}\n';
const DELTA=[
 [CURRENT,PREVIOUS],
 ["const findings=(items,title,explanation,questionBlocks=false,compact=false)=>arr(items).length?'<div class=\"mr-evidence-reading'+(compact?' mr-reading-limitations':'')+'\"><h3>'", "const findings=(items,title,explanation,questionBlocks=false)=>arr(items).length?'<div class=\"mr-evidence-reading\"><h3>'"],
 ["const sharedBlock=sharedRows.length?'<aside class=\"mr-shared-action-conditions'+(boundedPrint(['For all next steps',...sharedRows.flat()].join('\\n'))?' mr-shared-conditions-bounded':'')+'\"><h4>", "const sharedBlock=sharedRows.length?'<aside class=\"mr-shared-action-conditions\"><h4>"],
 ["    const sourcePrintText=s=>String(s.title??'')+(s.publisher?' · '+s.publisher:'')+(s.published?' · Published '+s.published:'')+(s.reviewed?' · Checked '+s.reviewed:'');\n",''],
 ["],'What this report cannot establish','',false,true)+", "],'What this report cannot establish','')+"],
 ["sources.map(s=>'<li'+(boundedPrint(sourcePrintText(s))?' class=\"mr-research-source-bounded\"':'')+'><a href=\"'", "sources.map(s=>'<li><a href=\"'"],
 [PRINT_CSS,'']
];
export function sourceBeforeRenderer39(source){
 source=sourceBeforeMethodCopy(source);
 for(const[now,before]of DELTA){assert.equal(source.split(now).length,2,'Exact renderer39 delta occurs once');source=source.replace(now,before);}
 assert.equal(sha(source),'97696bc3e2f2367a7c376b4845a1282f38cdd9b785709869e1f617fb405a404a');return source;
}
export function renderer38Output(html){return html.replace(METHOD_COPY_NOW,METHOD_COPY_BEFORE).replaceAll(PRINT_CSS,'').replaceAll(' mr-shared-conditions-bounded','').replaceAll(' class="mr-research-source-bounded"','').replaceAll(' mr-reading-limitations','').replaceAll(CURRENT,PREVIOUS);}
function run(){
 let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
 const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8'),prior=sourceBeforeRenderer39(source);
 eq(sha(sourceBeforeMethodCopy(source)),'dd880bf45b4d8c368dfca2bb786c0b01af297278b7b8a1fca43cd4d0a38032ce','Exact original renderer39 bytes survive copy inversion');
 eq(renderer38Output('<p>'+METHOD_COPY_NOW+'</p>'),'<p>'+METHOD_COPY_BEFORE+'</p>');
 for(const altered of [source+'\n'+METHOD_COPY_NOW,source.replace(METHOD_COPY_NOW,METHOD_COPY_NOW.replace('combined assumptions','validated savings')),source.replace(METHOD_COPY_NOW,'')]){assert.throws(()=>sourceBeforeRenderer39(altered));checks++;}
 const load=code=>{const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),c);vm.runInNewContext(code,c);return c.window.MondermanReport;};
 const R=load(source),old=load(prior);eq(R.rendererVersion,CURRENT);eq(old.rendererVersion,PREVIOUS);
 const action=i=>({action:'MOCK check '+i,reason:'MOCK distinct reason '+i,prerequisite:'MOCK obtain permission before checking.',risk:'MOCK isolated case is not representative.',success_check:'MOCK retain the result '+i,evidence_ids:['F1'],source_ids:['S1']});
 const make=()=>({status:'complete',report:{version:'MOCK-REPORT',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-13T00:00:00Z',composition:{authorship:'provider_authored_engine_bounded'},
  sources:[{id:'S1',url:'https://example.org/original',title:'MOCK original source title',publisher:'MOCK publisher',published:'2025-05-15',reviewed:'2026-09-08'}],
  limitations:['MOCK retained first limitation.','MOCK retained second limitation.'],
  evidence:[{id:'F1',label:'MOCK question',value:'MOCK answer',provenance:'participant_structured_answer'}],experiential_evidence:[],evidence_references:{summary:['F1'],summary_sources:[]},research_context:{status:'not_started'},
  interpretation:{summary:'MOCK summary.',observations:[{text:'MOCK full observation.',evidence_ids:['F1'],source_ids:[]}],hypotheses:[],recommendations:[action(1),action(2)],action_options:[],recommended_option:null,limitations:['MOCK retained third limitation.']}
 }});
 const render=s=>{const saved=JSON.stringify(s),h=R.buildAIInterpretation(s);eq(JSON.stringify(s),saved,'No original data or metadata mutation');eq(renderer38Output(h),old.buildAIInterpretation(s),'Every original word, URL, evidence number and order remains exact38');return h;};
 let state=make(),html=render(state);
 ok(html.includes('mr-shared-action-conditions mr-shared-conditions-bounded'));
 ok(html.includes('<li class="mr-research-source-bounded"><a href="https://example.org/original"'));
 eq((html.match(/mr-reading-limitations/g)||[]).length,1,'Only limitations get compact spacing');
 const limitations=html.match(/<div class="mr-evidence-reading mr-reading-limitations">([\s\S]*?)<\/div>/)[1];
 eq([...limitations.matchAll(/<p>(.*?)<\/p>/g)].map(m=>m[1]),state.report.limitations.concat(state.report.interpretation.limitations));
 // Shared bounds include heading, both labels and complete values, not only one condition.
 const sharedLength=s=>['For all next steps','Before trying it',s.report.interpretation.recommendations[0].prerequisite,'Risk to consider',s.report.interpretation.recommendations[0].risk].join('\n').length;
 for(const total of [999,1000,1001,5000]){
  state=make();const fixed=sharedLength(state)-state.report.interpretation.recommendations[0].prerequisite.length;
  for(const a of state.report.interpretation.recommendations)a.prerequisite='x'.repeat(total-fixed);
  html=render(state);eq(sharedLength(state),total);eq(html.includes('mr-shared-conditions-bounded'),total<=1000);
 }
 for(const lines of [8,9,20]){
  state=make();for(const a of state.report.interpretation.recommendations)a.prerequisite=Array(lines-4).fill('MOCK').join('\n');
  html=render(state);eq(html.includes('mr-shared-conditions-bounded'),lines<=8);
 }
 for(const changed of ['different','missing','one action']){
  state=make();if(changed==='different')state.report.interpretation.recommendations[1].prerequisite+=' Different.';
  if(changed==='missing')delete state.report.interpretation.recommendations[1].prerequisite;
  if(changed==='one action')state.report.interpretation.recommendations.pop();
  html=render(state);if(changed==='one action')ok(!html.includes('<aside class="mr-shared-action-conditions'));else ok(html.includes('<dt>Before trying it</dt>'),'Nonshared condition stays on its own action');
 }
 // Printed source metadata contributes to the bound; URLs do not change printed length.
 for(const total of [999,1000,1001,5000]){
  state=make();const s=state.report.sources[0],suffix=' · '+s.publisher+' · Published '+s.published+' · Checked '+s.reviewed;s.title='x'.repeat(total-suffix.length);
  html=render(state);eq(html.includes('<li class="mr-research-source-bounded">'),total<=1000);
 }
 for(const lines of [8,9]){state=make();state.report.sources[0].title=Array(lines).fill('MOCK').join('\n');html=render(state);eq(html.includes('<li class="mr-research-source-bounded">'),lines<=8);}
 state=make();state.report.sources[0].publisher='x'.repeat(1200);html=render(state);ok(!html.includes('<li class="mr-research-source-bounded">'),'Long publisher cannot be hidden by short title');
 state=make();state.report.sources[0].title='<img onerror="no"> & original';state.report.sources[0].publisher='"quoted" & retained';html=render(state);ok(!html.includes('<img'));ok(html.includes('&lt;img'));ok(html.includes('&amp; retained'));
 state=make();state.report.sources.push({...state.report.sources[0],id:'S2'});html=render(state);eq((html.match(/<li class="mr-research-source-bounded">/g)||[]).length,2,'No source deduplication');
 state=make();state.report.limitations.push('Long limitation '.repeat(200));html=render(state);ok(html.includes('<article class="mr-finding"><p>Long limitation'),'Long limitations remain splittable, not omitted');
 state=make();state.report.limitations=[];state.report.interpretation.limitations=[];html=render(state);ok(!html.includes('mr-reading-limitations'),'No fabricated limitation section');
 for(const tool_type of ['operational_systems','decision_velocity','structural_clarity','institutional_performance']){
  const raw={tool_type,score:53,band:'MOCK band',ai_report:make(),key_findings:['MOCK recorded result'],priority_actions:['MOCK saved action']},saved=JSON.stringify(raw);
  eq(renderer38Output(R.buildReportHtml(R.fromRun(raw))),old.buildReportHtml(old.fromRun(raw)));eq(JSON.stringify(raw),saved);
 }
 const reading=source.slice(source.indexOf('const REPORT_READING_CSS ='),source.indexOf('function handleScreenNavigation'));
 ok(!reading.slice(0,reading.indexOf('@media print{')).includes('mr-reading-limitations'),'No screen style change');
 ok(reading.includes(PRINT_CSS));
 ok(source.includes('.mr-authored-report .mr-action-intro{break-inside:avoid;page-break-inside:avoid;break-after:avoid;page-break-after:avoid}'),'Intro keeps with following short shared block');
 ok(source.includes('.mr-shared-action-conditions{display:block!important;break-inside:auto;page-break-inside:auto}'),'Unbounded shared blocks remain splittable');
 ok(source.includes('.mr-authored-report .mr-finding,.mr-authored-report .mr-ai-action{break-inside:auto;page-break-inside:auto}'));
 eq(sha(fs.readFileSync(path.join(root,'monderman-report.js'))),sha(source));
 console.log(JSON.stringify({status:'PASS',checks,rendererVersion:CURRENT,originalRenderer38Sha256:sha(prior),browser:'not_run',pdfs:0,providerCalls:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();
