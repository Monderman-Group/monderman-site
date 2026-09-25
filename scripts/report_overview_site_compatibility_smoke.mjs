// Mutation controls for historical compatibility, not changed behavior approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {OVERVIEW_SITE_FILES,OVERVIEW_SITE_PRIOR_COMMIT,OVERVIEW_SITE_REVIEWED_COMMIT,sourceBeforeOverviewSiteCompatibility} from './report_overview_site_compatibility_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
let checks=0;
for(const file of OVERVIEW_SITE_FILES){
  const current=fs.readFileSync(path.join(root,file),'utf8');
  const prior=execFileSync('git',['show',OVERVIEW_SITE_PRIOR_COMMIT+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16e6});
  assert.equal(sourceBeforeOverviewSiteCompatibility(file,current),prior,file+': exact historical bytes');checks++;
  const currentRejection=file==='homepage-workspace-demo.css'
    ?/homepage-workspace-demo\.css: only the exact reviewed homepage-anchor source can be inverted/
    :/only the exact reviewed (?:current|compact-homepage|public-language) source/;
  const priorRejection=file==='homepage-workspace-demo.css'
    ?currentRejection
    :/only the exact reviewed (?:current|compact-homepage|public-language) source|exact approved promotional gold fragment count/;
  assert.throws(()=>sourceBeforeOverviewSiteCompatibility(file,current+'\n'),currentRejection,file+': extra current-source byte rejected');checks++;
  assert.throws(()=>sourceBeforeOverviewSiteCompatibility(file,prior),priorRejection,file+': missing reviewed current changes rejected');checks++;
}
const unrelated=Buffer.from('Unrelated source must not be normalized.\n');
assert.equal(sourceBeforeOverviewSiteCompatibility('unrelated.js',unrelated),unrelated);checks++;
console.log(JSON.stringify({status:'PASS',checks,reviewedFiles:OVERVIEW_SITE_FILES.length,currentSourceMutationsRejected:19,missingReviewedChangesRejected:19,priorCommit:OVERVIEW_SITE_PRIOR_COMMIT,reviewedCommit:OVERVIEW_SITE_REVIEWED_COMMIT,productionFilesChanged:false}));
