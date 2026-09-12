// Presentation regression only. Legacy public inputs and explicitly mock prose
// do not certify the current engine or replace fresh sample-output approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,context);
const R=context.window.MondermanReport;
const artifact=JSON.parse(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'),'utf8'));
const disclosure='Sample report · Example data';
const attribution='Monderman’s diagnostic engine produces the scores and determines which findings and recommendations the evidence supports.';
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
let assertions=0;
const check=(value,message)=>{assert.ok(value,message);assertions++;};
const mock={status:'complete',report:{model:'MOCK-DISPLAY-ONLY',version:'MOCK',generated_at:'2026-09-12T12:00:00Z',
  composition:{authorship:'provider_authored_engine_bounded'},sources:[],evidence:[],evidence_references:{summary:[],summary_sources:[]},
  interpretation:{summary:'Display-only example.',observations:[],hypotheses:[],recommendations:[],action_options:[],recommended_option:null}}};
for(const [key,entry] of Object.entries(artifact.outputs)){
  const model=R[entry.kind==='diagnostic'?'fromRun':'fromSynthesis'](entry.source);
  for(const example of [false,true]){
    const value=freeze({...model,aiReport:structuredClone(mock),sampleProvenance:example?{synthetic:true}:undefined});
    const before=JSON.stringify(value),html=R.buildReportHtml(value);
    check(JSON.stringify(value)===before,key+': saved report is not mutated');
    check((html.match(/class="mr-sample-disclosure"/g)||[]).length===(example?1:0),key+': one example label, none on real runs');
    check(html.includes(disclosure)===example,key+': approved standalone disclosure');
    check(!html.includes('fictional inputs')&&!html.includes('About this example'),key+': no duplicate sample warnings');
    check(html.includes(attribution),key+': engine leads the authorship description');
    check(html.includes('AI contributes research and explanation within those rules.'),key+': AI role is retained');
    check(!html.includes('Neither review establishes scientific validity or guarantees a result.'),key+': generic caution does not dominate methods');
    check(html.includes('mr-report-method'),key+': methods remain available');
  }
  const historical=R.buildReportHtml({...model,sampleProvenance:undefined,aiReport:{...structuredClone(mock),report:{...structuredClone(mock.report),composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'}}}});
  check(historical.includes('This saved edition uses reviewed explanations selected by Claude and inserted by Monderman.'),key+': historical authorship is not rewritten');
  check(!historical.includes(attribution),key+': old selection-only edition does not claim new authored output');
}
console.log(JSON.stringify({status:'PASS',assertions,products:Object.keys(artifact.outputs).length,providerCalls:0,fixture:'legacy public inputs, mock prose; display only'}));
