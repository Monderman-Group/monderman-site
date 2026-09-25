// Source compatibility and negative controls only. This never refreshes sample
// evidence, creates reviewed status or substitutes for publication validation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PUBLIC_COPY_BASELINE,PUBLIC_COPY_FIXTURE_SHA256,publicCopyDelta,sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {REPORT_LIBRARY_FILES,REPORT_LIBRARY_CACHE_FILES,REPORT_LIBRARY_FIXTURE_SHA256,reportLibraryDelta,sourceBeforeReportLibrary20260924} from './report_library_20260924_inverse.mjs';
import {sourceBeforePromotionalGold20260924} from './promotional_gold_20260924_inverse.mjs';
import {sourceBeforePublicLanguagePass20260924} from './public_language_pass_20260924_inverse.mjs';
import {sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicSampleProjectionCache20260924} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforePublicSamplePreviewBinding20260924} from './public_sample_preview_binding_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
import {sourceAtChangeWordingBaseline} from './change_wording_20260925_inverse.mjs';
const root = path.resolve(import.meta.dirname, '..'), sha = value => createHash('sha256').update(value).digest('hex');
let checks = 0;
const equal = (a,b,label) => {assert.deepEqual(a,b,label); checks++;};
const reject = (callback,label) => {assert.throws(callback, undefined, label); checks++;};
for (const file of REPORT_LIBRARY_FILES) {
  const source = sourceAtChangeWordingBaseline(file,fs.readFileSync(path.join(root,file),'utf8'));
  const original = execFileSync('git',['show',PUBLIC_COPY_BASELINE+':'+file],{cwd:root,encoding:'utf8',maxBuffer:32e6});
  let postCopy = original;
  for (const [start,,current,prior] of publicCopyDelta.files[file]?.replacements || []) {
    equal(postCopy.slice(start,start+prior.length),prior,file+': immutable copy baseline reconstruction');
    postCopy = postCopy.slice(0,start)+current+postCopy.slice(start+prior.length);
  }
  equal(sha(postCopy),reportLibraryDelta.files[file].before_sha256,file+': library delta begins after the original approved copy');
  const beforeCompact = sourceBeforeHomepageCompactJourney20260924(file,sourceBeforePublicSampleProjectionCache20260924(file,sourceBeforePublicSamplePreviewBinding20260924(file,sourceBeforeHomepageReportQuad20260925(file,source))));
  const beforeLanguage = sourceBeforePublicLanguagePass20260924(file,beforeCompact);
  const beforeGold = sourceBeforePromotionalGold20260924(file,beforeLanguage);
  if (beforeLanguage !== beforeCompact) reject(()=>sourceBeforeReportLibrary20260924(file,sourceBeforePromotionalGold20260924(file,beforeCompact)),file+': skipping the newer language layer remains a hard failure');
  if (REPORT_LIBRARY_CACHE_FILES.includes(file)) {
    equal(postCopy.split('monderman-report.js?v=20260923.overview1').length,2,file+': one prior renderer cache tag');
    equal(beforeGold,postCopy.replace('monderman-report.js?v=20260923.overview1','monderman-report.js?v=20260924.overview2'),file+': no changes beyond the single renderer cache tag');
  }
  equal(sourceBeforeReportLibrary20260924(file,beforeGold),postCopy,file+': exact library-only restoration');
  equal(sourceBeforePublicCopyClarity(file,source),original,file+': full language/gold/library/copy chain restores baseline');
  reject(()=>sourceBeforePublicCopyClarity(file,source+'\n'),file+': extra source byte rejected');
  reject(()=>sourceBeforePublicCopyClarity(file,source.replace(/./,'!')),file+': unrelated leading source byte rejected');
  for (const [start,end,current] of reportLibraryDelta.files[file].replacements) {
    const changed = beforeGold.slice(0,start)+(current?'!'+current.slice(1):'UNAPPROVED')+beforeGold.slice(end);
    reject(()=>sourceBeforeReportLibrary20260924(file,changed),file+': each changed presentation hunk rejects tampering');
  }
}
const unrelated = Buffer.from('Unrelated source stays exact.\n');
equal(sourceBeforeReportLibrary20260924('unrelated.js',unrelated),unrelated,'No inversion outside finite approved library files and cache consumers');
equal(PUBLIC_COPY_FIXTURE_SHA256,'4d874cc80e9180341deadc0a976e660a87c8fcf34606fc67003605bffe5bfbdb','Prior copy fixture digest remains unchanged');
equal(sha(fs.readFileSync(path.join(root,'scripts/fixtures/public-copy-clarity-20260924.json'))),PUBLIC_COPY_FIXTURE_SHA256,'Prior copy fixture bytes remain unchanged');
console.log(JSON.stringify({status:'PASS',checks,files:REPORT_LIBRARY_FILES,fixtureSha256:REPORT_LIBRARY_FIXTURE_SHA256,copyFixtureUnchanged:true,publicationApprovalClaimed:false,providerCalls:0}));
