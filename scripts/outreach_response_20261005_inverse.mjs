// Historical comparison only. The new outreach browser regression separately
// executes current pages; no old fixture, approval or security assertion changes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const OUTREACH_RESPONSE_BASELINE='2be745c09058756f08e6a1f91cc18dce1f97646e';
export const OUTREACH_RESPONSE_PAGES=Object.freeze({
  'pattern-trial.html':Object.freeze({
    before:'b12786e53ae7b22b13c1e396e2f46bbf899acec45912b51b0c1cc922addef8e2',
    after:'ca09301438e7c1b1ebad1eb9c70d93e51d2a8a80ecfa80ac446574835c02be86'
  }),
  'signin.html':Object.freeze({
    before:'8cf251e2e0534f44bb34fdb4b8b25fd61b82ffead21b5d821e7d076ed9761399',
    after:'a959fefb72f0b03fd6545d54332406d902174d1484e475de79333e47bb003825'
  })
});
export function sourceBeforeOutreachResponse20261005(file,source){
  if(!Object.hasOwn(OUTREACH_RESPONSE_PAGES,file))return source;
  const entry=OUTREACH_RESPONSE_PAGES[file];
  assert.equal(sha(source),entry.after,file+': Only the exact reviewed outreach source may be inverted');
  const prior=execFileSync('git',['show',OUTREACH_RESPONSE_BASELINE+':'+file],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:32e6
  });
  assert.equal(sha(prior),entry.before,file+': Complete preceding page identity retained');
  return Buffer.isBuffer(source)?prior:prior.toString('utf8');
}
export function sourceAtOutreachResponseBaseline(file,source){
  const entry=Object.hasOwn(OUTREACH_RESPONSE_PAGES,file)?OUTREACH_RESPONSE_PAGES[file]:null;
  // Unknown changes pass through unchanged to the historical contracts, where
  // the original byte/behavior assertions must still independently reject them.
  return entry&&sha(source)===entry.after?sourceBeforeOutreachResponse20261005(file,source):source;
}
