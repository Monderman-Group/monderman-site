import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceAtOutreachResponseBaseline,sourceBeforeOutreachResponse20261005,OUTREACH_RESPONSE_PAGES} from './outreach_response_20261005_inverse.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0;
assert.deepEqual(Object.keys(OUTREACH_RESPONSE_PAGES),['pattern-trial.html','signin.html']);checks++;
for(const [file,pin] of Object.entries(OUTREACH_RESPONSE_PAGES)){
  const source=fs.readFileSync(new URL('../'+file,import.meta.url));
  assert.equal(sha(source),pin.after);checks++;
  const restored=sourceBeforeOutreachResponse20261005(file,source);
  assert.equal(sha(restored),pin.before);checks++;
  assert.ok(Buffer.isBuffer(restored));checks++;
  assert.equal(sourceBeforeOutreachResponse20261005(file,source.toString()),restored.toString());checks++;
  assert.deepEqual(sourceAtOutreachResponseBaseline(file,source),restored);checks++;
  for(const changed of [Buffer.concat([source,Buffer.from('\n')]),Buffer.from(source.toString().replace('outreach-invitation.js','unreviewed-bridge.js')),restored]){
    assert.throws(()=>sourceBeforeOutreachResponse20261005(file,changed),/Only the exact reviewed outreach source/);checks++;
    assert.deepEqual(sourceAtOutreachResponseBaseline(file,changed),changed);checks++;
  }
}
for(const file of ['workspace.html','__proto__','unknown.js']){
  const value=Buffer.from('Do not change unrelated bytes.');
  assert.equal(sourceAtOutreachResponseBaseline(file,value),value);checks++;
  assert.equal(sourceBeforeOutreachResponse20261005(file,value),value);checks++;
}
console.log(JSON.stringify({ok:true,checks,scope:'Exact two-page compatibility only; original fixtures and approvals unchanged',networkCalls:0,productionWrites:0}));
