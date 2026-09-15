// Exact customer-metadata display delta; historical renderer proofs stay unchanged.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const DELTAS=[
  ['  // remain visible even when AI selects different observations/actions.\n','  // remain visible even when Claude selects different observations/actions.\n'],
  [
    "      '<p class=\"mr-method-copy\">The Monderman diagnostic engine produced this report’s scores, classifications and evidence limits. '+(reviewedSelection?'This saved edition uses reviewed explanations selected with AI assistance and inserted by Monderman. ':'AI assisted with the interpretation within the saved report’s evidence limits. ')+'It did not determine the score.'+[[\"Interpretation version\",customerReportVersion(report.version)],[\"Prepared\",report.generated_at],[\"Evidence reference\",report.snapshot_id]].filter(row=>firstStr(row[1])).map(row=>' '+row[0]+': '+esc(row[1])+'.').join('')+'</p></section>';\n",
    "      '<p class=\"mr-method-copy\">The Monderman diagnostic engine produced this report’s scores, classifications and evidence limits. '+(reviewedSelection?'This saved edition uses reviewed explanations selected by Claude and inserted by Monderman. ':'Claude assisted with the interpretation within the saved report’s evidence limits. ')+'It did not determine the score.'+[[\"Interpretation version\",report.version],[\"Prepared\",report.generated_at],[\"Evidence reference\",report.snapshot_id]].filter(row=>firstStr(row[1])).map(row=>' '+row[0]+': '+esc(row[1])+'.').join('')+'</p></section>';\n"
  ],
  [
    "    const methodProvenance='Prepared '+String(report.generated_at??'')+'. Report version '+String(customerReportVersion(report.version)??'')+'. This report preserves the evidence and research used when it was prepared.';\n",
    "    const methodProvenance='Prepared '+String(report.generated_at??'')+'. Model '+String(report.model??'')+'. Report version '+String(report.version??'')+'. This report preserves the evidence and research used when it was prepared.';\n"
  ],
  [
    "  // Public metadata aliases retain the original edition number. Provider/model\n  // and usage identifiers stay in the private audit, not customer downloads.\n  function customerReportVersion(value) {\n    return typeof value === 'string' ? value.replace(/^[a-z]+\\d+-(?:engine-bounded-)?report-/, 'monderman-interpretation-')\n      .replace(/^report-interpretation-[a-z]+\\d+-/, 'monderman-interpretation-prompt-') : value;\n  }\n  function customerReportJson(value) {\n    const copy = JSON.parse(safeStringify(value));\n    const state = ai => {\n      if (!ai || typeof ai !== 'object') return;\n      if (Object.prototype.hasOwnProperty.call(ai, 'version')) ai.version = customerReportVersion(ai.version);\n      const report = ai.report;\n      if (!report || typeof report !== 'object') return;\n      delete report.model; delete report.provider; delete report.usage;\n      for (const key of ['version', 'prompt_version']) if (Object.prototype.hasOwnProperty.call(report, key)) report[key] = customerReportVersion(report[key]);\n      if (report.automated_review) report.automated_review = {verdict: report.automated_review.verdict};\n      report.customer_metadata_version = 'customer-report-metadata-20260915.1';\n    };\n    const visit = node => {\n      if (!node || typeof node !== 'object') return;\n      if (Array.isArray(node)) { node.forEach(visit); return; }\n      for (const key of ['ai_report', 'aiReport']) if (Object.prototype.hasOwnProperty.call(node, key)) state(node[key]);\n      for (const key of ['result', 'run', 'result_json', 'full_result_json', 'render_payload', 'renderPayload', 'report_payload', 'export_payload', 'runs', 'syntheses']) if (Object.prototype.hasOwnProperty.call(node, key)) visit(node[key]);\n    };\n    visit(copy); return copy;\n  }\n\n",
    ""
  ],
  [
    "    const blob = new Blob([safeStringify(customerReportJson(data))], { type: \"application/json;charset=utf-8\" });\n",
    "    const blob = new Blob([safeStringify(data)], { type: \"application/json;charset=utf-8\" });\n"
  ],
  [
    "    customerReportJson: customerReportJson,\n",
    ""
  ]
];
export function sourceBeforeCustomerMetadata(source){
  if(!source.includes('  function customerReportJson(value) {'))return source;
  assert.equal(sha(source),'6bb158554f0eaf66515f2447328e30b59a885fd4a70e3739739a0431740f1f4c','Only the reviewed customer-metadata renderer can be inverted');
  for(const [current,prior]of DELTAS){assert.equal(source.split(current).length,2);source=source.replace(current,prior);}
  assert.equal(sha(source),'3161aa937bf8b619e0ccfe58c19cb8f9315ea00d65a09bb94eefe6fe933dffa4');return source;
}
