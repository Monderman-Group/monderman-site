// Display-copy-only changes. Existing saved reports and AI prose remain intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
const DELTA=[
  [
    "  const RENDERER_VERSION = \"diagnostic-renderer-evidence-reading-20260914.40\";",
    "  const RENDERER_VERSION = \"diagnostic-renderer-evidence-reading-20260913.39\";"
  ],
  [
    "        ? \"Results from eligible runs of one Diagnostic, showing the median, score distribution, differences between participant perspectives and limits of the evidence.\"",
    "        ? \"A same-Diagnostic read across multiple eligible runs: reporting the observed median, distribution, differences between participant perspectives, and evidence limits.\""
  ],
  [
    "        : \"Results across Diagnostics, showing where findings agree, where they differ and whether the evidence supports a combined score.\",",
    "        : \"A multi-lens read that separates lens comparison from a coherent composite and states exactly what evidence supports each conclusion.\","
  ],
  [
    "        ? \"These results describe the submitted runs of one Diagnostic. Applying them to a wider population requires a documented sampling plan and response coverage.\"",
    "        ? \"This report describes the submitted same-Diagnostic runs. Population generalization requires a documented sampling frame and response coverage.\""
  ],
  [
    "      evidenceCard(\"Evidence strength\", m.evidenceLabel, \"\"),",
    "      evidenceCard(\"Evidence strength\", m.evidenceLabel, m.evidenceDescription),"
  ],
  [
    "      evidenceCard(\"Questionnaire and scoring versions\", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? \"Conflicting Diagnostics: \" + versions.conflicting_lenses.map(humanize).join(\", \") : \"\"),",
    "      evidenceCard(\"Diagnostic/scorer versions\", firstStr(versions.label, humanize(versions.status)), versions.conflicting_lenses?.length ? \"Conflicting Diagnostics: \" + versions.conflicting_lenses.map(humanize).join(\", \") : \"\"),"
  ],
  [
    "      evidenceCard(\"Identifiers for submitted runs\", humanize(identity.status), firstStr(identity.statement)),",
    "      evidenceCard(\"Source-run identity\", humanize(identity.status), firstStr(identity.statement)),"
  ],
  [
    "    return '<div class=\"mr-viz-panel mr-depth-distribution-panel\"><div class=\"mr-viz-title\">Distribution at a glance</div>' + svg + summary + '<p class=\"mr-copy\"><span class=\"mr-synth-wide-caption\">Box = interquartile range; dark line = median; amber dot = mean. </span>Results by participant perspective describe the submitted groups; they do not change how the Median Diagnostic Score is calculated.</p></div>';",
    "    return '<div class=\"mr-viz-panel mr-depth-distribution-panel\"><div class=\"mr-viz-title\">Distribution at a glance</div>' + svg + summary + '<p class=\"mr-copy\"><span class=\"mr-synth-wide-caption\">Box = interquartile range; dark line = median; amber dot = mean. </span>Vantage results describe observed segments and do not reweight the Median Diagnostic Score.</p></div>';"
  ],
  [
    "      '<div><div class=\"mr-lens-label\">Mean and median</div><strong>' + esc(strictFinite(meanMedianGap) ? fmt1(meanMedianGap) + \" pt mean–median gap\" : \"Not calculable\") + '</strong><p>' + esc(strictFinite(meanMedianGap) && meanMedianGap <= 2 ? \"The mean and median are closely aligned in the submitted set.\" : \"Consider the difference between the mean and median when reading the overall result.\") + '</p></div></div></section>';",
    "      '<div><div class=\"mr-lens-label\">Center stability</div><strong>' + esc(strictFinite(meanMedianGap) ? fmt1(meanMedianGap) + \" pt mean–median gap\" : \"Not calculable\") + '</strong><p>' + esc(strictFinite(meanMedianGap) && meanMedianGap <= 2 ? \"The mean and median are closely aligned in the submitted set.\" : \"The difference between mean and median should remain visible when interpreting the center.\") + '</p></div></div></section>';"
  ]
];
export function sourceBeforeRenderer40(source){
 if(!source.includes('diagnostic-renderer-evidence-reading-20260914.40'))return source;
 for(const[now,prior]of DELTA){assert.equal(source.split(now).length,2,'Exact approved renderer40 copy line');source=source.replace(now,prior);}
 assert.equal(sha(source),'6723d405f42e4b5555cf68833ce0d533fefb141c887d5bc49c0fa828cb08f9e8');return source;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(import.meta.dirname,'..'),source=fs.readFileSync(root+'/monderman-report.js','utf8'),prior=sourceBeforeRenderer40(source);
 assert.equal(sha(prior),'6723d405f42e4b5555cf68833ce0d533fefb141c887d5bc49c0fa828cb08f9e8');
 assert.throws(()=>sourceBeforeRenderer40(source+'\nUNREVIEWED'));
 const load=s=>{const c={window:{}};vm.runInNewContext(fs.readFileSync(root+'/participant-evidence-safety.js','utf8'),c);vm.runInNewContext(s,c);return c.window.MondermanReport;};
 const current=load(source),old=load(prior);
 assert.equal(current.rendererVersion,'diagnostic-renderer-evidence-reading-20260914.40');
 const original={synthesis_product:'depth_synthesis',submitted_run_count:27,score_status:'published',median_diagnostic_score:52,
 evidence_assessment:{evidence_label:'Recorded evidence',evidence_description:'UNIQUE SAVED DESCRIPTION.',versions:{label:'Compatible'},source_identity:{status:'verified',statement:'Recorded run identifiers.'}},narrative:{executive_summary:'UNCHANGED SAVED FINDING.'},sample_reads:[],
 source_groups:[{tool_type:'structural_clarity',tool_label:'Structural Clarity',submitted_runs:27,mean_score:52,median_score:52}]};
 const saved=JSON.stringify(original),html=current.buildReportHtml(current.fromSynthesis(original));
 assert.equal(JSON.stringify(original),saved);
 assert.match(html,/Results from eligible runs of one Diagnostic/);assert.match(html,/UNCHANGED SAVED FINDING/);
 assert.equal(html.split('UNIQUE SAVED DESCRIPTION.').length,2,'Description retained exactly once');
 assert.match(html,/Questionnaire and scoring versions/);assert.match(html,/Identifiers for submitted runs/);
 for(const tool_type of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const run={tool_type,score:52,band:'Saved band',key_findings:['EXACT SAVED FINDING']},savedRun=JSON.stringify(run);
  assert.equal(current.buildReportHtml(current.fromRun(run)).replaceAll(current.rendererVersion,old.rendererVersion),old.buildReportHtml(old.fromRun(run)));
  assert.equal(JSON.stringify(run),savedRun);
 }
 console.log(JSON.stringify({status:'PASS',copyChanges:DELTA.length,originalRenderer39Sha256:sha(prior),savedSourceUnchanged:true,ordinaryDiagnosticHtmlUnchangedExceptRendererVersion:true,providerCalls:0}));
}
