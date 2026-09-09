// Exercise the actual direct-result chart builders without a network or DOM.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const specs = {
  'structural-clarity.html': {
    keys: ['role','decision_rights','handoff','accountability','governance'],
    labels: ['Roles','Decision authority','Handoffs','Accountability','Approval requirements']
  },
  'institutional-performance.html': {
    keys: ['execution','confidence','adaptation','stability','compensation'],
    labels: ['Execution','Confidence in formal systems','Ability to adapt','Performance stability','Extra effort']
  }
};
let datasets = 0;
for (const [file,spec] of Object.entries(specs)) {
  const source = fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const declaration = name => {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ',start+1);
    assert.ok(start>=0&&end>start,`${file}: ${name} missing`);
    return source.slice(start,end);
  };
  const configs = [];
  const sandbox = {
    asObject:value => value&&typeof value==='object'?value:{},
    destroyCharts(){configs.length=0;},chartOptions:()=>({}),
    $:id=>({getContext:()=>id}),
    Chart:function(context,config){configs.push({context,config});}
  };
  vm.runInNewContext(`let gapChart,dimensionChart;${declaration('chartLabelLines')}\n${declaration('getOperationalDimensions')}\n${declaration('renderCharts')}\nglobalThis.draw=renderCharts;`,sandbox);
  for (const values of [[0,25,50,75,100],[null,undefined,NaN,false,'42'],[Infinity,-Infinity,0,null,1],[]]) {
    const result = {burden_breakdown:Object.fromEntries(spec.keys.map((key,i)=>[key,values[i]])),dimensions:Object.fromEntries(spec.keys.map(key=>[key,99]))};
    // These belong to another diagnostic and must never populate these charts.
    Object.assign(result.burden_breakdown,{approval:98,coordination:97,escalation:96,rework:95,key_person:94});
    const before = structuredClone(result);
    sandbox.draw(result);
    assert.equal(configs.length,2,`${file}: bar and radar required`);
    assert.deepEqual(configs.map(c=>c.config.type),['bar','radar']);
    for (const {config} of configs) {
      assert.deepEqual(Array.from(config.data.labels),spec.labels,`${file}: copied axes`);
      assert.deepEqual(Array.from(config.data.datasets[0].data),spec.keys.map((_,i)=>Number.isFinite(values[i])?values[i]:null),`${file}: invalid values or reversed polarity`);
      datasets++;
    }
    assert.deepEqual(result,before,`${file}: chart mutated stored values`);
  }
  assert.match(source,/Higher values show more reported difficulty/);
  assert.match(source,/Unmeasured areas are left blank/);
  if (file==='institutional-performance.html') assert.doesNotMatch(source,/<h3>Structural gaps<\/h3>/);
}
console.log(`SC_IP_CHART_BINDING_PASS pages=2 datasets=${datasets} unchangedValues=true missingNotZero=true liveCalls=0`);
