// Saved public data -> candidate HTML only. No browser, PDF export, network,
// provider call, approval receipt or production artifact is changed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
assert.ok(process.argv[2],'Specify a new candidate output directory.');
const out=path.resolve(process.argv[2]);
assert.ok(!fs.existsSync(out),'Candidate output directory must not already exist.');
const read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=read('sample-data/production-diagnostic-samples.json');
const artifact=JSON.parse(bytes),release=JSON.parse(read('sample-data/production-sample-release.json'));
assert.equal(sha(bytes),release.artifact_file_sha256,'Do not change saved sample evidence.');
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInNewContext(read(file).toString(),context,{filename:file});
context.window.MondermanPublicSamples.validate(artifact);
const rows=[];
for(const [product,entry]of Object.entries(artifact.outputs)){
  assert.match(product,/^[a-z_]+$/);
  const before=JSON.stringify(entry),model=context.window.MondermanPublicSamples.model(entry,artifact);
  const html=context.window.MondermanReport.buildReportHtml(model);
  assert.equal(JSON.stringify(entry),before,'Rendering must not change saved source.');
  assert.equal((html.match(/class="mr-overview-tile"/g)||[]).length,4);
  rows.push({product,html,sha256:sha(html)});
}
fs.mkdirSync(out,{recursive:true});
for(const row of rows)fs.writeFileSync(path.join(out,row.product+'.html'),row.html);
const receipt={status:'candidate_unreviewed',artifact_file_sha256:sha(bytes),renderer_sha256:sha(read('monderman-report.js')),browser_review:'not_run',pdf_review:'not_run',provider_calls:0,source_mutations:0,outputs:rows.map(({product,sha256})=>({product,path:product+'.html',sha256}))};
fs.writeFileSync(path.join(out,'CANDIDATE.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
