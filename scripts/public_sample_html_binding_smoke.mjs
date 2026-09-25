// Read-only HTML binding checks. Test-only hash records are not publication
// receipts; no reviewed status, generated evidence or public files are written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {assertPublicSampleHtmlBindings,PUBLIC_PRODUCTS,publicResult} from './public_sample_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..'),sha=value=>createHash('sha256').update(value).digest('hex');
const bytes=fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'));
const artifact=JSON.parse(bytes),original=JSON.stringify(artifact);
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
const sources={};
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js']){
  const source=fs.readFileSync(path.join(root,file));sources[file]=sha(source);
  vm.runInNewContext(source.toString(),context,{filename:file});
}
// This independently follows the candidate export's exact generation path.
context.window.MondermanPublicSamples.validate(artifact);
const html=Object.fromEntries(Object.entries(artifact.outputs).map(([key,entry])=>[key,
  context.window.MondermanReport.buildReportHtml(context.window.MondermanPublicSamples.model(entry,artifact))]));
const binding={source_files:sources,renderer_sha256:sources['monderman-report.js'],
  renderer_version:context.window.MondermanReport.rendererVersion,
  pdf_outputs:Object.fromEntries(Object.entries(html).map(([key,value])=>[key,{html_sha256:sha(value)}]))};
let checks=0;
const reject=(value,source=artifact,pattern=/reviewed HTML|HTML binding/)=>{assert.throws(()=>assertPublicSampleHtmlBindings(source,value,{root}),pattern);checks++;};
assert.equal(assertPublicSampleHtmlBindings(artifact,binding,{root}).products,6);checks++;
for(const key of Object.values(PUBLIC_PRODUCTS)){
  const changed=structuredClone(binding);changed.pdf_outputs[key].html_sha256='0'.repeat(64);reject(changed);
  const missing=structuredClone(binding);delete missing.pdf_outputs[key].html_sha256;reject(missing);
  const modified=structuredClone(artifact);publicResult(modified.outputs[key]).ai_report.report.interpretation.summary+=' UNREVIEWED_HTML_TEXT';reject(binding,modified);
}
for(const file of Object.keys(sources)){
  const changed=structuredClone(binding);changed.source_files[file]='0'.repeat(64);reject(changed);
}
const wrongEdition=structuredClone(binding);wrongEdition.renderer_version='unreviewed-renderer';reject(wrongEdition);
const wrongRenderer=structuredClone(binding);wrongRenderer.renderer_sha256='0'.repeat(64);reject(wrongRenderer);
const missingProduct=structuredClone(binding);delete missingProduct.pdf_outputs.operational_systems;reject(missingProduct);
const extraProduct=structuredClone(binding);extraProduct.pdf_outputs.unreviewed={html_sha256:'0'.repeat(64)};reject(extraProduct);
assert.equal(JSON.stringify(artifact),original,'HTML binding must not mutate evidence');checks++;
assert.equal(sha(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'))),sha(bytes),'No artifact write');checks++;
const candidatesAt=process.argv.indexOf('--candidate-dir');
if(candidatesAt>=0){
  assert.ok(process.argv[candidatesAt+1],'Specify existing candidate directory');
  const directory=path.resolve(process.argv[candidatesAt+1]),receipt=JSON.parse(fs.readFileSync(path.join(directory,'CANDIDATE.json')));
  assert.equal(receipt.status,'candidate_unreviewed');assert.equal(receipt.renderer_sha256,binding.renderer_sha256);
  assert.equal(receipt.artifact_file_sha256,sha(bytes));checks+=3;
  for(const row of receipt.outputs){
    assert.equal(row.path,row.product+'.html');
    assert.equal(fs.readFileSync(path.join(directory,row.path),'utf8'),html[row.product],row.product+' exact prior exported candidate HTML');
    assert.equal(row.sha256,binding.pdf_outputs[row.product].html_sha256);checks+=3;
  }
}
console.log(JSON.stringify({status:'PASS',checks,products:6,rendererSha256:binding.renderer_sha256,publicHtmlFilesRequired:false,publicationApprovalClaimed:false,providerCalls:0,networkCalls:0}));
