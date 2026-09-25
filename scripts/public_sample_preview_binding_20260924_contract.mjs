// Offline source/digest parity only. No artifact/release writes or approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
import {previewBindingDelta,sourceBeforePublicSamplePreviewBinding20260924,PREVIEW_PRIOR_ARTIFACT_DIGEST,
  PREVIEW_CURRENT_ARTIFACT_DIGEST,PREVIEW_CURRENT_ARTIFACT_FILE_SHA256} from './public_sample_preview_binding_20260924_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),sha=v=>createHash('sha256').update(v).digest('hex');
const read=file=>fs.readFileSync(path.join(root,file));
const protectedFiles=['sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json'];
const protectedBefore=protectedFiles.map(file=>sha(read(file)));
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const preparation=process.env.PUBLIC_SAMPLE_PREVIEW_ARTIFACT;
if(preparation)assert.ok(path.isAbsolute(preparation),'Private preparation path must be absolute');
const bytes=preparation?fs.readFileSync(preparation):read(protectedFiles[0]);
eq(sha(bytes),PREVIEW_CURRENT_ARTIFACT_FILE_SHA256,'Exact prospective/current edition bytes');
const artifact=JSON.parse(bytes),{artifact_sha256,...content}=artifact;
eq(artifact_sha256,PREVIEW_CURRENT_ARTIFACT_DIGEST,'Expected canonical artifact digest');
eq(evidenceDigest(content),artifact_sha256,'Artifact digest is valid, not merely substituted');
const before=JSON.stringify(artifact),sections=buildPublicSamplePreviewSections(artifact,read('scripts/templates/home-workspace-preview.html').toString());
const currentAttr='data-artifact-sha256="'+PREVIEW_CURRENT_ARTIFACT_DIGEST+'"';
const priorAttr='data-artifact-sha256="'+PREVIEW_PRIOR_ARTIFACT_DIGEST+'"';
for(const [file,entry]of Object.entries(previewBindingDelta)){
  const displayed=read(file).toString(),current=sourceBeforeHomepageReportQuad20260925(file,displayed),prior=sourceBeforePublicSamplePreviewBinding20260924(file,current);
  eq(sha(current),entry.after_sha256,file+': exact new source');
  eq(sha(prior),entry.before_sha256,file+': exact prior source');
  eq(current.split(currentAttr).length-1,entry.count,file+': exact attribute count');
  eq(current,prior.replaceAll(priorAttr,currentAttr),file+': nothing except digest attributes changes');
  const depth=[...current.matchAll(/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/g)];
  eq(depth.length,1,file+': one Depth card');
  eq(displayed.match(/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/)?.[0],sections[file==='index.html'?'home':'brief'],file+': exact current pure generated report preview');
  if(file==='index.html'){
    const hero=[...current.matchAll(/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/g)];
    eq(hero.length,1,'One homepage journey');
    eq(hero[0][0],sections.hero,'Exact pure generated homepage journey');
  }
  assert.doesNotThrow(()=>sourceBeforePublicCopyClarity(file,displayed));checks++;
  for(const mutated of [current+'\n',current.replace(currentAttr,priorAttr),current.replace(currentAttr,''),current.replace(/href="/,'href="UNREVIEWED-')])
    reject(()=>sourceBeforePublicSamplePreviewBinding20260924(file,mutated),file+': unrelated, mixed, missing or executable source changes reject');
  reject(()=>sourceBeforePublicSamplePreviewBinding20260924(file,prior),file+': double inversion rejects');
}
for(const file of [...protectedFiles,'monderman-report.js','scripts/refresh_public_sample_previews.mjs','__proto__']){
  const untouched=Buffer.from('No transformation permitted');
  eq(sourceBeforePublicSamplePreviewBinding20260924(file,untouched),untouched,file+': outside source-only scope');
}
eq(JSON.stringify(artifact),before,'Preview generation leaves the artifact unmodified');
eq(protectedFiles.map(file=>sha(read(file))),protectedBefore,'Original public artifact and release remain byte-identical');
console.log(JSON.stringify({status:'PASS',checks,negativeControls,sourceFiles:Object.keys(previewBindingDelta),
  changedAttributes:3,artifactFileSha256:sha(bytes),artifactDigest:artifact_sha256,
  mode:preparation?'PRIVATE_PREPARATION_NOT_APPROVAL':'CURRENT_SOURCE_PARITY_ONLY',
  artifactWrites:0,releaseWrites:0,publicationApprovalClaimed:false,providerCalls:0},null,2));
