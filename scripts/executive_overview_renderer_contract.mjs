// No network/provider calls. Both sample and real adapters must show the same
// complete reviewed summary units; historical/failure states retain full text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {sourceBeforeExecutiveOverview} from './executive_overview_renderer_inverse.mjs';
import {restoreComparisonPrint20260924Html} from './report_comparison_print_20260924_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const source=read('monderman-report.js');
const ctx={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInNewContext(read(file),ctx,{filename:file});
const prior={...ctx,window:{}};
vm.runInNewContext(read('participant-evidence-safety.js'),prior);
vm.runInNewContext(sourceBeforeExecutiveOverview(source),prior);
const R=ctx.window.MondermanReport,old=prior.window.MondermanReport;
const artifact=JSON.parse(read('sample-data/production-diagnostic-samples.json'));
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const ok=(a,msg)=>{assert.ok(a,msg);checks++;};
for(const key of ['depth_synthesis','cross_lens_synthesis']){
  const entry=structuredClone(artifact.outputs[key]);
  const raw=entry.source,report=raw.ai_report.report,interpretation=report.interpretation;
  const unit=text=>({text,evidence_ids:[report.evidence[0].id],source_ids:[]});
  const overview={version:'executive-overview-20260924.1',headline:unit('Review the reported delays before choosing a change.'),findings:[unit('Participants describe different experiences of the same work.'),unit('Check those differences against examples from the measurement period.')],option_summaries:interpretation.action_options.map((option,i)=>({option_id:option.option_id,...unit(['Test one recurring decision with the people responsible.','Review related handoffs before expanding the change.','Agree the scope before changing responsibilities across the organization.'][i])})),preferred:null};
  const before=R.fromSynthesis(raw);
  eq(restoreComparisonPrint20260924Html(R.buildReportHtml(before)),old.buildReportHtml(before),key+': historical report renders identically except separately reviewed PDF presentation');
  interpretation.executive_overview=overview;
  for(const [name,model]of [['real',R.fromSynthesis(raw)],['sample',ctx.window.MondermanPublicSamples.model(entry,artifact)]]){
    const original=JSON.stringify(model),html=R.buildReportHtml(model);
    eq(JSON.stringify(model),original,key+'/'+name+': caller data retained');
    for(const row of [overview.headline,...overview.findings,...overview.option_summaries])ok(html.includes(row.text),key+'/'+name+': complete summary unit retained');
    eq(restoreComparisonPrint20260924Html(R.buildReportBody(model)),old.buildReportBody(model),key+'/'+name+': long report and print body bytes unchanged except separately reviewed PDF presentation');
    for(const mutate of [
      x=>x.version='unknown',x=>x.findings[0].evidence_ids=['missing'],x=>x.findings[0].source_ids=['missing'],
      x=>x.findings[0].text='long '.repeat(31),x=>x.findings.length=1,
      x=>x.option_summaries[0].option_id='unavailable',x=>x.option_summaries[1].option_id=x.option_summaries[0].option_id,
      x=>x.preferred={option_id:'unavailable',...unit('Use this option.')},x=>delete x.preferred,
      x=>x.headline.text='long '.repeat(13),x=>x.findings[0].evidence_ids=[],x=>x.option_summaries.pop()
    ]){
      const changed=structuredClone(model);mutate(changed.aiReport.report.interpretation.executive_overview);
      eq(restoreComparisonPrint20260924Html(R.buildReportHtml(changed)),old.buildReportHtml(changed),key+'/'+name+': malformed edition falls back intact');
    }
    for(const variant of [{comparisonOnly:true},{selfRun:true},{aiReport:{status:'pending'}},{aiReport:{status:'failed'}}]){
      const changed={...model,...variant};
      eq(restoreComparisonPrint20260924Html(R.buildReportHtml(changed)),old.buildReportHtml(changed),key+'/'+name+': no upgraded summary outside ready synthesis');
    }
    const preferred=interpretation.recommended_option;
    if(preferred?.option_id&&model.campaignEvidence?.recommendedPath?.status==='satisfied'){
      const chosen=structuredClone(model);
      chosen.aiReport.report.interpretation.executive_overview.preferred={option_id:preferred.option_id,...unit('Begin with the approved option, then review the outcome.')};
      ok(R.buildReportHtml(chosen).includes('Begin with the approved option, then review the outcome.'),key+'/'+name+': preferred summary matches full approved choice');
      chosen.campaignEvidence.recommendedPath.status='in_progress';
      ok(!R.buildReportHtml(chosen).includes('Begin with the approved option, then review the outcome.'),key+'/'+name+': readiness still gates preferred recommendation');
    }
  }
}
assert.throws(()=>sourceBeforeExecutiveOverview(source+'\n'));checks++;
console.log(JSON.stringify({status:'PASS',checks,providerCalls:0,scope:'Exact summary transport, shared sample/real rendering, unchanged print detail, malformed/legacy/state fallbacks and source mutation control'}));
