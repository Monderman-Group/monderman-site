import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {EVALUATION_POOL_BASELINE,EVALUATION_POOL_PAGES,sourceBeforeEvaluationPool20261006,sourceAtEvaluationPoolBaseline} from './single_lens_overview_20260929_inverse.mjs';
import {sourceAtBrandRefreshBaseline} from './brand_refresh_20261007_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(EVALUATION_POOL_BASELINE,'335eb03c9adfe1c4376cfe97921764c181b2052a');
assert.deepEqual(Object.keys(EVALUATION_POOL_PAGES),['pattern-trial.html','pilot.html','pilot-waitlist.js','scripts/inject-public-shell.mjs','scripts/runtime_asset_release_build_smoke.mjs']);
let checks=2;
for(const [file,entry]of Object.entries(EVALUATION_POOL_PAGES)){
 const current=fs.readFileSync(new URL('../'+file,import.meta.url));
 const source=sourceAtBrandRefreshBaseline(file,current);
 assert.equal(sha(source),entry.after);checks++;
 const prior=sourceBeforeEvaluationPool20261006(file,source);
 assert.equal(sha(prior),entry.before);checks++;
 assert.ok(Buffer.isBuffer(prior));checks++;
 assert.deepEqual(sourceAtEvaluationPoolBaseline(file,source),prior);checks++;
 assert.deepEqual(sourceAtEvaluationPoolBaseline(file,current),prior);checks++;
 assert.equal(sourceBeforeEvaluationPool20261006(file,source.toString()),prior.toString());checks++;
 for(const mutant of [Buffer.concat([source,Buffer.from('\n')]),Buffer.from(source.toString().replace('a','unreviewed_a')),prior]){
  assert.throws(()=>sourceBeforeEvaluationPool20261006(file,mutant),/Only the exact reviewed evaluation-pool source/);checks++;
  assert.deepEqual(sourceAtEvaluationPoolBaseline(file,mutant),mutant);checks++;
 }
}
for(const file of ['workspace.html','signin.html','unknown.js','__proto__']){
 const source=Buffer.from('Preserve unrelated bytes.');
 assert.equal(sourceBeforeEvaluationPool20261006(file,source),source);checks++;
 assert.equal(sourceAtEvaluationPoolBaseline(file,source),source);checks++;
}
console.log(JSON.stringify({ok:true,checks,scope:'Exact five-file finite reverse hunks; unchanged historical fixtures and unknown-edit rejection',networkCalls:0,productionWrites:0}));
