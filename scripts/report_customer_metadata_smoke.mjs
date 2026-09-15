import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sourceBeforeCustomerMetadata} from './report_customer_metadata_inverse.mjs';
import {sourceBeforeFinancialPresentation} from './report_financial_presentation_inverse.mjs';
const source=fs.readFileSync(new URL('../monderman-report.js',import.meta.url),'utf8');
const load=body=>{const c={window:{},Blob,URL,console};vm.runInNewContext(fs.readFileSync(new URL('../participant-evidence-safety.js',import.meta.url),'utf8'),c);vm.runInNewContext(body,c);return c.window.MondermanReport;};
// The exact hash-checked inverse preserves this historical metadata review.
// The actual financial presentation is independently exercised by the BLUF suite.
const historicalSource=sourceBeforeFinancialPresentation(source);
const R=load(source),historical=load(historicalSource),prior=load(sourceBeforeCustomerMetadata(source));
const priorPublishedSource=historicalSource.replace('/^[a-z]+\\d+-(?:engine-bounded-)?report-/','/^opus5-engine-bounded-report-/')
  .replace('/^report-interpretation-[a-z]+\\d+-/','/^report-interpretation-opus5-/')
  .replace('// remain visible even when AI selects','// remain visible even when Claude selects');
assert.equal(createHash('sha256').update(priorPublishedSource).digest('hex'),'00c7282e6d91a301f77dd5b691caf49eec4b834da28bb8015f29af13125d1080');
const priorPublished=load(priorPublishedSource);
const artifact=JSON.parse(fs.readFileSync(new URL('../sample-data/production-diagnostic-samples.json',import.meta.url)));
let checks=0;const eq=(a,b,msg)=>{assert.equal(JSON.stringify(a),JSON.stringify(b),msg);checks++;};
for(const [key,entry]of Object.entries(artifact.outputs)){
  const value=structuredClone(entry.source),json=JSON.stringify(value),method=entry.kind==='synthesis'?'fromSynthesis':'fromRun';
  const model=R[method](value),before=prior.buildReportHtml(prior[method](value)),after=historical.buildReportHtml(historical[method](value));
  // Only the method's private model/edition display changes; every report
  // section, authored clause, evidence link, table and chart stays exact.
  const withoutMethod=s=>s.replace(/<details class="mr-report-method[^\"]*">[\s\S]*?<\/details>/g,'METHOD');
  eq(withoutMethod(after),withoutMethod(before),key+' content/layout outside method is exact');
  eq(after,priorPublished.buildReportHtml(priorPublished[method](value)),key+' complete reviewed PDF/HTML input unchanged by generic metadata matcher');
  assert.doesNotMatch(R.buildReportHtml(model),/claude-opus|opus5-/i);checks++;
  eq(JSON.stringify(value),json,key+' source immutable');
  const exported=R.customerReportJson(value),oldReport=(value.result||value).ai_report.report,report=(exported.result||exported).ai_report.report;
  eq(report.interpretation,oldReport.interpretation);eq(report.evidence,oldReport.evidence);eq(report.sources,oldReport.sources);
  eq(report.model,undefined);eq(report.usage,undefined);eq(R.customerReportJson(exported),exported);
  assert.doesNotMatch(JSON.stringify(exported),/claude-opus|opus5-/i);checks++;
}
for(const envelope of ['result','run','result_json','full_result_json','render_payload','renderPayload','report_payload','export_payload']){
  const raw={[envelope]:{score:77,answers:{model:'Participant wording'},ai_report:{status:'complete',version:'opus5-engine-bounded-report-20260915.66',report:{
    version:'opus5-engine-bounded-report-20260915.66',prompt_version:'report-interpretation-opus5-20260915.66',model:'claude-opus-5',usage:{private:'usage'},
    automated_review:{verdict:'approve',model:'claude-opus-5',usage:{private:'review'}}}}}},before=JSON.stringify(raw),out=R.customerReportJson(raw)[envelope];
  eq(JSON.stringify(raw),before);eq(out.score,77);eq(out.answers,raw[envelope].answers);eq(out.ai_report.report.automated_review,{verdict:'approve'});
  assert.doesNotMatch(JSON.stringify(out),/claude-opus|opus5-|private/);checks++;
}
assert.throws(()=>sourceBeforeCustomerMetadata(source+'\nUNREVIEWED'));checks++;
assert.doesNotMatch(source,/claude|anthropic|opus5/i);checks++;
for(const version of ['opus5-report-20260909.4','opus5-report-20260909.10','opus5-engine-bounded-report-20260915.66']){
  const edition=version.match(/\d{8}\.\d+$/)[0];
  const input={ai_report:{status:'complete',version,report:{version,prompt_version:'report-interpretation-opus5-'+edition,
    model:'claude-opus-5',interpretation:{summary:'The participant said Claude was named in the original account.'}}}};
  const before=JSON.stringify(input),out=R.customerReportJson(input);
  eq(out.ai_report.version,'monderman-interpretation-'+edition);eq(out.ai_report.report.version,out.ai_report.version);
  eq(out.ai_report.report.prompt_version,'monderman-interpretation-prompt-'+edition);
  eq(out.ai_report.report.interpretation,input.ai_report.report.interpretation);eq(JSON.stringify(input),before);
}
console.log(JSON.stringify({status:'PASS',checks,products:6,privateInputsUnchanged:true,providerCalls:0}));
