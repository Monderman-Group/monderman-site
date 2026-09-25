// Exact publication compatibility only. Older report/evidence approvals retain
// their original pins; this layer removes only the reviewed library/link edit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const GOVERNANCE_RESEARCH_BASELINE='dc9e9aba04c24896e7f00349e39d73117d129e9f';
export const GOVERNANCE_RESEARCH_FIXTURE_SHA256='da488a6892594347a00f14831b3b0d6b71c347eb26f7b82214d110b2f298514f';
export const GOVERNANCE_RESEARCH_FILES=Object.freeze(['index.html','research.html','the-unmeasured-layer.html']);
const bytes=fs.readFileSync(new URL('./fixtures/governance-research-20260925.json',import.meta.url));
assert.equal(sha(bytes),GOVERNANCE_RESEARCH_FIXTURE_SHA256,'Exact governance research publication fixture');
export const governanceResearchDelta=JSON.parse(bytes);
assert.equal(governanceResearchDelta.baseline,GOVERNANCE_RESEARCH_BASELINE);
assert.deepEqual(Object.keys(governanceResearchDelta.files),GOVERNANCE_RESEARCH_FILES,'Finite three-file publication compatibility scope');
export function sourceBeforeGovernanceResearch20260925(file,source){
  if(!GOVERNANCE_RESEARCH_FILES.includes(file))return source;
  const entry=governanceResearchDelta.files[file];
  assert.equal(sha(source),entry.after_sha256,file+': only the exact reviewed governance-research source can be inverted');
  let restored=String(source);
  for(const [start,end,current,prior]of [...entry.replacements].reverse()){
    assert.equal(restored.slice(start,end),current,file+': exact finite governance publication hunk');
    restored=restored.slice(0,start)+prior+restored.slice(end);
  }
  assert.equal(sha(restored),entry.before_sha256,file+': complete preceding publication source recovered');
  return Buffer.isBuffer(source)?Buffer.from(restored):restored;
}
// Historical chains also pass their own earlier editions through this entry.
// Only the exact new identity is transformed; all other bytes continue to the
// unchanged historical assertions, which must independently recognize them.
export function sourceAtGovernanceResearchBaseline(file,source){
  const entry=Object.hasOwn(governanceResearchDelta.files,file)?governanceResearchDelta.files[file]:null;
  return entry&&sha(source)===entry.after_sha256?sourceBeforeGovernanceResearch20260925(file,source):source;
}
