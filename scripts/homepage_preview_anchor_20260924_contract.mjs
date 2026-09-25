// Exact offline addendum checks. Actual geometry is independently measured in
// the browser; this is not a replacement publication or PDF approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {HOMEPAGE_PREVIEW_ANCHOR_FILES,HOMEPAGE_PREVIEW_ANCHOR_FIXTURE_SHA256,homepagePreviewAnchorDelta,sourceBeforeHomepagePreviewAnchor20260924} from './homepage_preview_anchor_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),raw=file=>fs.readFileSync(path.join(root,file),'utf8');
const read=file=>sourceBeforeHomepageReportQuad20260925(file,raw(file));
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const manifest=JSON.parse(read('sample-data/production-sample-release.json'));
const priorPins=manifest.response_comparison_publication_review.source_files;
const before={};
for(const file of HOMEPAGE_PREVIEW_ANCHOR_FILES){
  const current=read(file),entry=homepagePreviewAnchorDelta.files[file];
  before[file]=sourceBeforeHomepagePreviewAnchor20260924(file,current);
  eq(sha(current),entry.after_sha256,file+': exact corrected source');
  eq(sha(before[file]),priorPins[file],file+': original publication pin remains unchanged');
  for(const mutant of [current+'\n',current.replace(/./,'!'),current.replace('align-self:start','align-self:center')]){
    if(mutant===current)continue;
    reject(()=>sourceBeforeHomepagePreviewAnchor20260924(file,mutant),file+': unrelated bytes or wrong correction rejected');
  }
  reject(()=>sourceBeforeHomepagePreviewAnchor20260924(file,before[file]),file+': old edition cannot masquerade as the corrected source');
  for(const [start,end]of entry.replacements)
    reject(()=>sourceBeforeHomepagePreviewAnchor20260924(file,current.slice(0,start)+'UNREVIEWED'+current.slice(end)),file+': each compatibility hunk is exact');
}
const cssRule='  body.homepage-enterprise .home-workspace-preview { align-self:start; }\n';
const cssBefore=before['homepage-workspace-demo.css'];
const desktopRule='@media (min-width:1121px) {\n  body.homepage-enterprise .hero-copy { align-self:start; }\n';
eq(cssBefore.split(desktopRule).length,2,'One existing desktop-only alignment scope');
eq(read('homepage-workspace-demo.css'),cssBefore.replace(desktopRule,desktopRule+cssRule),'Only the preview desktop alignment changes; mobile, fonts, sizes and content stay exact');
const readerImport="import {sourceBeforeHomepagePreviewAnchor20260924} from './homepage_preview_anchor_20260924_inverse.mjs';\n";
const oldAssertion="      assert.equal(sha(fs.readFileSync(path.join(root,filename))),digest,'reviewed comparison source changed: '+filename);";
const newAssertion="      // The separately reviewed desktop-only anchor addendum reconstructs the\n      // original CSS and this reader exactly; publication pins remain intact.\n      assert.equal(sha(sourceBeforeHomepagePreviewAnchor20260924(filename,fs.readFileSync(path.join(root,filename)))),digest,'reviewed comparison source changed: '+filename);";
eq(read('scripts/public_sample_fixture.mjs'),before['scripts/public_sample_fixture.mjs'].replace("import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';\n",value=>value+readerImport).replace(oldAssertion,newAssertion),'Reader changes only its import and exact presentation compatibility call');
for(const [file,digest]of Object.entries(homepagePreviewAnchorDelta.unchanged_files))
  eq(sha(fs.readFileSync(path.join(root,file))),digest,file+': publication asset or historical fixture remains byte-identical');
for(const file of ['index.html','monderman-report.js','sample-data/production-sample-release.json','workspace.html','__proto__']){
  const value=Buffer.from('No transformation allowed');
  eq(sourceBeforeHomepagePreviewAnchor20260924(file,value),value,file+': outside finite addendum scope');
}
assert.doesNotThrow(()=>sourceBeforePublicCopyClarity('homepage-workspace-demo.css',raw('homepage-workspace-demo.css')));checks++;
const fixture=readPublicSampleFixture({root});
eq(fixture.entries.length,6,'All six actual samples pass the unchanged publication predicates and HTML/PDF bindings');
const browserTest=read('scripts/homepage_workspace_demo_smoke.mjs');
assert.match(browserTest,/Math\.abs\(now\[key\]-initialAnchors\[key\]\)<=1/,'Original 1px browser anchor tolerance is retained');checks++;
console.log(JSON.stringify({status:'PASS',checks,negativeControls,fixtureSha256:HOMEPAGE_PREVIEW_ANCHOR_FIXTURE_SHA256,files:HOMEPAGE_PREVIEW_ANCHOR_FILES,originalPublicationPinsUnchanged:true,artifactWrites:0,pdfWrites:0,publicationApprovalClaimed:false,browserCoverage:'NOT_RUN',providerCalls:0},null,2));
