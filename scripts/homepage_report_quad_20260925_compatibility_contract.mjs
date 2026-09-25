// Exact presentation compatibility and mutation rejection, independent of the
// current report-content contract and browser geometry review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {HOMEPAGE_REPORT_QUAD_FILES,HOMEPAGE_REPORT_QUAD_FIXTURE_SHA256,homepageReportQuadDelta,sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
equal(homepageReportQuadDelta.prior_commit,'6bd52d91d2557902f4b090686f244ea91843eb51','Exact existing homepage baseline');
equal(sha(read('scripts/fixtures/homepage-report-quad-20260925.json')),HOMEPAGE_REPORT_QUAD_FIXTURE_SHA256,'Independent fixture digest');
const sourceBytes={};
for(const file of HOMEPAGE_REPORT_QUAD_FILES){
  const current=read(file),entry=homepageReportQuadDelta.files[file];
  const before=sourceBeforeHomepageReportQuad20260925(file,current);
  equal(sha(current),entry.after_sha256,file+': entire current source pinned');
  equal(sha(before),entry.before_sha256,file+': entire prior source pinned');
  equal(current.length,entry.after_bytes,file+': current UTF-8 byte length');
  equal(Buffer.byteLength(before),entry.before_bytes,file+': prior UTF-8 byte length');
  const original=file==='scripts/homepage_report_quad_20260925.mjs'?Buffer.from(''):
    execFileSync('git',['show',homepageReportQuadDelta.prior_commit+':'+file],{cwd:root,maxBuffer:16e6});
  equal(Buffer.from(before),original,file+': historical bytes independently recovered');
  for(const changed of [current.toString()+'\n',current.toString().replace(/./,'!'),before])
    reject(()=>sourceBeforeHomepageReportQuad20260925(file,changed),file+': unrelated edit or double inversion rejected');
  for(const [start,end,currentHunk]of entry.replacements){
    equal(current.toString().slice(start,end),currentHunk,file+': explicit finite hunk');
    reject(()=>sourceBeforeHomepageReportQuad20260925(file,current.toString().slice(0,start)+'UNAPPROVED'+current.toString().slice(end)),file+': hunk mutation rejected');
  }
  sourceBytes[file]={beforeSha256:sha(before),afterSha256:sha(current),beforeBytes:Buffer.byteLength(before),afterBytes:current.length,hunks:entry.replacements.length};
}
for(const [file,digest]of Object.entries(homepageReportQuadDelta.unchanged_files))
  equal(sha(read(file)),digest,file+': protected artifact, report renderer or historical fixture unchanged');
for(const file of ['monderman-report.js','sample-data/production-sample-release.json','sample-data/production-diagnostic-samples.json','Monderman_Platform_Brief.html','workspace.html','__proto__']){
  const value=Buffer.from('No transformation permitted.');
  equal(sourceBeforeHomepageReportQuad20260925(file,value),value,file+': outside finite presentation scope');
}
const fixture=readPublicSampleFixture({root});
equal(fixture.entries.length,6,'All six original sample and HTML/PDF bindings pass without new approval');
console.log(JSON.stringify({status:'PASS',checks,negativeControls,fixtureSha256:HOMEPAGE_REPORT_QUAD_FIXTURE_SHA256,sourceBytes,originalPublicationPinsUnchanged:true,artifactWrites:0,pdfWrites:0,providerCalls:0,publicationApprovalClaimed:false},null,2));
