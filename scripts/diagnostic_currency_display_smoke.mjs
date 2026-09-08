// Display-only checks. These functions do not change scoring or model output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const files=['decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html'];
const values=[1,45,198,999,1008,4999,5000,15000,32000,49999,50000,99000,100000,145800,249999,250000,437400,500000,567000,664200,891000,16200000];
let reference;
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const begin=source.indexOf('function formatCurrency(value) {');
  const end=source.indexOf('function buildExposureMethodDisclosure(exposure) {',begin);
  assert.ok(begin>=0 && end>begin,file+': display functions missing');
  const box={Intl,Number,Math};
  vm.runInNewContext(source.slice(begin,end)+';this.range=buildCurrencyConfidenceBand;',box);
  const rows=values.map(value=>{
    const band=box.range(value);
    assert.ok(band.low<=value && band.high>=value,file+': displayed range excludes '+value);
    assert.ok(band.high>band.low,file+': collapsed range');
    return [value,band.low,band.high,band.label];
  });
  if(reference)assert.deepEqual(rows,reference,file+': inconsistent currency presentation');
  reference=rows;
}
console.log('DIAGNOSTIC_CURRENCY_DISPLAY_PASS: '+(values.length*files.length)+' displayed ranges; common rounding and underlying model points retained.');
