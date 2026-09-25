// Exact deterministic Depth copy compatibility; no provider, browser, or artifact writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {restoreFinancialPresentationStyles} from './report_financial_presentation_inverse.mjs';
import {sourceBeforeRenderer42,restoreRenderer42PrintSpacing} from './report_focus_label_smoke.mjs';
import {reportHtmlAfterReviewedPresentation} from './report_three_benefit_presentation_inverse.mjs';
import {withoutReportOverview} from './report_overview_test_normalizer.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const DELTA=[
  [
    "  const RENDERER_VERSION = \"diagnostic-renderer-evidence-reading-20260914.41\";",
    "  const RENDERER_VERSION = \"diagnostic-renderer-evidence-reading-20260914.40\";"
  ],
  [
    "  // Display compatibility for three exact deterministic identity caveats only.\n  // Never traverse saved source, participant accounts, or AI-authored prose.\n  function displayDepthIdentityCopy(value) {\n    if (typeof value !== \"string\") return value;\n    return value\n      .replaceAll(\"This is not independent proof of unique physical people, a representative sample or an accurate population declaration.\", \"This is not independent proof of distinct people, a representative sample or an accurate population declaration.\")\n      .replaceAll(\"These are recorded account or invitation identities, not independently verified physical people.\", \"These are recorded account or invitation identities, not independently verified distinct people.\")\n      .replaceAll(\"Account and invitation records are not independent proof of unique physical people or of the declared population.\", \"Account and invitation records are not independent proof of distinct people or of the declared population.\");\n  }\n\n  function fromSynthesis(result) {",
    "  function fromSynthesis(result) {"
  ],
  [
    "    const identityCopy = r.synthesis_product === \"depth_synthesis\" && obj(r.report_language).generation_version === \"synthesis-report-language-20260910.3\"\n      ? displayDepthIdentityCopy : value => value;\n    const representative = { ...obj(evidence.representativeness), statement: identityCopy(obj(evidence.representativeness).statement) };",
    "    const representative = obj(evidence.representativeness);"
  ],
  [
    "    const experiential = { ...obj(r.experiential) };\n    for (const role of [\"operational\", \"managerial\", \"senior_leader\"]) {\n      const detail = obj(obj(experiential.detail)[role]);\n      if (experiential.participant_reports_available === false && detail.basis === \"segment_statistics_only\" && detail.text === experiential[role]) experiential[role] = identityCopy(experiential[role]);\n    }\n    const briefParagraphs = arr(briefing.paragraphs).map(firstStr).filter(Boolean).map(identityCopy);",
    "    const experiential = obj(r.experiential);\n    const briefParagraphs = arr(briefing.paragraphs).map(firstStr).filter(Boolean);"
  ],
  [
    "    const coverBody = firstStr(identityCopy(narrative.executive_summary), briefing.lede, diagnosis.body, r.primary_pattern);",
    "    const coverBody = firstStr(narrative.executive_summary, briefing.lede, diagnosis.body, r.primary_pattern);"
  ],
  [
    "      runCountNote: firstStr(identityCopy(r.participant_count_note), \"Counts refer to submitted runs, not verified distinct people. One person may contribute more than one run.\"),",
    "      runCountNote: firstStr(r.participant_count_note, \"Counts refer to submitted runs, not verified distinct people. One person may contribute more than one run.\"),"
  ]
];
export function sourceBeforeRenderer41(source){
 source=sourceBeforeRenderer42(source);
 if(!source.includes('diagnostic-renderer-evidence-reading-20260914.41'))return source;
 for(const[now,before]of DELTA){assert.equal(source.split(now).length,2,'Exact renderer41 display-only delta');source=source.replace(now,before);}
 assert.equal(sha(source),'24d109f68941e62a40bfcfd1c33e17f2c7481d713b9e464a471dd1073cefa2cf');return source;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(import.meta.dirname,'..'),source=fs.readFileSync(root+'/monderman-report.js','utf8'),prior=sourceBeforeRenderer41(source);
 let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
 const load=s=>{const c={window:{}};vm.runInNewContext(fs.readFileSync(root+'/participant-evidence-safety.js','utf8'),c);vm.runInNewContext(s,c);return c.window.MondermanReport;};
 const R=load(source),old=load(prior),freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
 eq(R.rendererVersion,'diagnostic-renderer-report-overview-20260924.1');
 assert.throws(()=>sourceBeforeRenderer41(source+'\nUNREVIEWED'));checks++;
 const caveat='This is not independent proof of unique physical people, a representative sample or an accurate population declaration.';
 const stats='These are recorded account or invitation identities, not independently verified physical people.';
 const note='Account and invitation records are not independent proof of unique physical people or of the declared population.';
 const make=()=>({synthesis_product:'depth_synthesis',report_language:{generation_version:'synthesis-report-language-20260910.3'},submitted_run_count:27,score_status:'published',median_diagnostic_score:52,
 evidence_assessment:{representativeness:{statement:caveat}},narrative:{executive_summary:'Saved score. '+caveat},executive_briefing:{paragraphs:['Saved distribution. '+caveat]},participant_count_note:note,
 experiential:{operational:stats,managerial:stats,senior_leader:stats,participant_reports_available:false,detail:Object.fromEntries(['operational','managerial','senior_leader'].map(role=>[role,{text:stats,basis:'segment_statistics_only'}]))},
 ai_report:{status:'complete',report:{interpretation:{summary:caveat,observations:[{text:stats}],recommendations:[],hypotheses:[],limitations:[note]}}}});
 const check=input=>{
  freeze(input);const before=JSON.stringify(input),m=R.fromSynthesis(input);
  eq(m.source,input);eq(m.aiReport,input.ai_report,'AI prose untouched');eq(JSON.stringify(input),before,'Frozen input immutable');
  eq(m.evidence,input.evidence_assessment);eq(m.narrative,input.narrative);eq(m.experiential.detail,input.experiential.detail,'Raw detail/account copy untouched');
  for(const value of [m.coverBody,m.representativeness.statement,m.briefing.paragraphs[0],m.runCountNote,m.experiential.operational,m.experiential.managerial,m.experiential.senior_leader]){assert.match(value,/distinct people/);assert.doesNotMatch(value,/physical people/);checks+=2;}
  eq(m.score,old.fromSynthesis(input).score);return m;
 };
 check(make());
 for(const change of [x=>x.synthesis_product='cross_lens_synthesis',x=>delete x.report_language,x=>x.report_language.generation_version='unknown']){
  const x=make();change(x);const m=R.fromSynthesis(freeze(x));eq(m.coverBody,x.narrative.executive_summary);eq(m.runCountNote,x.participant_count_note);eq(m.experiential.operational,stats);
 }
 for(const change of [x=>x.experiential.participant_reports_available=true,x=>x.experiential.detail.operational.basis='participant_account',x=>x.experiential.detail.operational.text='Different source']){
  const x=make();change(x);eq(R.fromSynthesis(freeze(x)).experiential.operational,stats,'Never rewrite participant accounts or unmatched detail');
 }
 const custom=make();custom.narrative.executive_summary='A participant said physical people; keep this exact prose.';eq(R.fromSynthesis(freeze(custom)).coverBody,custom.narrative.executive_summary);
 for(const tool_type of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const x=freeze({tool_type,score:52,band:'Saved',key_findings:[caveat]});
  eq(restoreRenderer42PrintSpacing(restoreFinancialPresentationStyles(withoutReportOverview(R.buildReportHtml(R.fromRun(x)),{preserveVersion:true}))).replaceAll(R.rendererVersion,old.rendererVersion),reportHtmlAfterReviewedPresentation(old.buildReportHtml(old.fromRun(x))),'Ordinary reports differ only by screen overview, renderer stamp, exact print spacing, financial CSS and reviewed category colors');
 }
 const actualArg=process.argv.indexOf('--original');
 if(actualArg>=0){
  const x=JSON.parse(fs.readFileSync(process.argv[actualArg+1],'utf8')).candidate.outputs.depth_synthesis.source;
  eq(sha(JSON.stringify(canonical(x))),'2dc400b53e73e77130e184b2717efdb59bb51d657208c4fa1169fac8d07c339e');
  check(x);const html=R.buildReportHtml(R.fromSynthesis(x)),oldHtml=old.buildReportHtml(old.fromSynthesis(x));
  eq(restoreRenderer42PrintSpacing(restoreFinancialPresentationStyles(withoutReportOverview(html,{preserveVersion:true}))),reportHtmlAfterReviewedPresentation(oldHtml.replaceAll(old.rendererVersion,R.rendererVersion).replaceAll('unique physical people','distinct people').replaceAll('verified physical people','verified distinct people')),'Historical nonfinancial Depth HTML has only screen overview, known copy, version, print spacing, financial CSS and reviewed category-color differences');
 }
 console.log(JSON.stringify({status:'PASS',checks,renderer40Sha256:sha(prior),immutableInputs:true,authoredProseUnchanged:true,providerCalls:0}));
}
