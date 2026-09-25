// Read-only, offline protection of the finite public language follow-up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PUBLIC_LANGUAGE_PASS_FILES,PUBLIC_LANGUAGE_PASS_FIXTURE_SHA256,publicLanguagePassDelta,sourceBeforePublicLanguagePass20260924} from './public_language_pass_20260924_inverse.mjs';
import {sourceBeforePublicSampleProjectionCache20260924} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforePublicSamplePreviewBinding20260924} from './public_sample_preview_binding_20260924_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>sourceBeforePublicSampleProjectionCache20260924(file,sourceBeforePublicSamplePreviewBinding20260924(file,fs.readFileSync(path.join(root,file),'utf8')));
const sha=value=>createHash('sha256').update(value).digest('hex');
const captures=(source,pattern)=>[...source.matchAll(pattern)].map(match=>match[0]);
let checks=0,negativeControls=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=(file,source,label)=>{assert.throws(()=>sourceBeforePublicLanguagePass20260924(file,source),/only the exact reviewed public-language source can be inverted/,label);negativeControls++;checks++;};
equal(sha(read('scripts/fixtures/public-copy-clarity-20260924.json')),publicLanguagePassDelta.prior_copy_fixture_sha256,'Original reviewed copy fixture unchanged');
equal(sha(read('scripts/fixtures/report-library-presentation-20260924.json')),publicLanguagePassDelta.prior_library_fixture_sha256,'Separate prior library fixture unchanged');
equal(PUBLIC_LANGUAGE_PASS_FILES.length,6,'Only six named public HTML files');
equal(Object.values(publicLanguagePassDelta.files).reduce((sum,entry)=>sum+entry.replacements.length,0),31,'Exactly thirty-one finite text replacements');
for(const file of PUBLIC_LANGUAGE_PASS_FILES){
  const current=read(file),entry=publicLanguagePassDelta.files[file],before=sourceBeforePublicLanguagePass20260924(file,current);
  equal(sha(current),entry.after_sha256,file+': exact current identity');
  equal(sha(before),entry.before_sha256,file+': exact prior identity');
  for(const [label,pattern]of [
    ['element markup/attributes',/<[^>]*>/g],
    ['script bodies',/<script\b[^>]*>[\s\S]*?<\/script>/g],
    ['inline styles',/<style\b[^>]*>[\s\S]*?<\/style>/g],
    ['CTA/resource destinations',/\b(?:href|src|action|formaction)="[^"]*"/g],
    ['numeric facts',/\d+(?:[,.]\d+)*/g]
  ])equal(captures(current,pattern),captures(before,pattern),file+': '+label+' unchanged');
  rejects(file,current+'\n',file+': unrelated appended bytes reject');
  rejects(file,before,file+': no double inversion or historical-source laundering');
  rejects(file,current.replace(/href="[^"]+"/,'href="unexpected-target.html"'),file+': changed link target rejects');
  rejects(file,current.replace(/\d/,digit=>digit==='8'?'9':'8'),file+': changed unrelated numeric fact rejects');
  for(const [after]of entry.replacements){
    rejects(file,current.replace(after,after+' unreviewed wording'),file+': every reviewed phrase rejects an extra qualification/change');
  }
  if(file.endsWith('-article.html')){
    for(const phrase of ['This guide describes an individual report.','Multi-participant example','compares responses from several people.','not customer results.'])equal(current.includes(phrase),true,file+': explicit report/example boundary');
  }
}
for(const file of ['index.html','security.html','subprocessors.html','diagnostics.html','monderman-report.js','workspace.html','unrelated.html']){
  const value='<p>Unrelated content must not be transformed.</p>';
  equal(sourceBeforePublicLanguagePass20260924(file,value),value,file+': outside finite scope');
}
console.log(JSON.stringify({status:'PASS',checks,negativeControls,files:PUBLIC_LANGUAGE_PASS_FILES,fixtureSha256:PUBLIC_LANGUAGE_PASS_FIXTURE_SHA256,olderFixturesUnchanged:true,publicationApprovalClaimed:false,networkCalls:0,providerCalls:0},null,2));
