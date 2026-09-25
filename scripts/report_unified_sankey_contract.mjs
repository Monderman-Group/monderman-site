// Offline checks of the two-view presentation, using saved public scenarios
// and clearly synthetic edge cases. No browser or publication approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const levels=['low','central','high'],costCase={low:'high',central:'central',high:'low'};
const fixtures=JSON.parse(read('scripts/fixtures/three-benefit-scenarios.json'));
const sampleBytes=read('sample-data/production-diagnostic-samples.json'),artifact=JSON.parse(sampleBytes);
const load=source=>{
  const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
  vm.runInNewContext(read('participant-evidence-safety.js'),context);
  vm.runInNewContext(source.replace('  window.MondermanReport = {','  window.__flowForContract = renderThreeBenefitFlow;\n  window.MondermanReport = {'),context);
  return {report:context.window.MondermanReport,flow:context.window.__flowForContract};
};
const renderer=read('monderman-report.js'),{report,flow}=load(renderer);
const old=load(execFileSync('git',['show','31c87d9944d58cd58a48e389a680e0e909536329:monderman-report.js'],{cwd:root,encoding:'utf8',maxBuffer:4e6})).report;
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const decode=value=>value.replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));
const sections=html=>[...html.matchAll(/<section\b([^>]*data-burden-kind="[^"]+"[^>]*)>([\s\S]*?)<\/section>/g)].map(match=>({a:attrs(match[1]),html:match[2]}));
const close=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7+1e-10*Math.max(a,b),label+': '+a+' != '+b);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
let scenarios=0,sourceRows=0,pathsChecked=0;
function expected(s,kind,k){
  if(kind==='money')return ['spendingReduction','spendingAvoidance'].flatMap(category=>s.inputs[category].items.map(item=>{
    const row=s.spendingItems.find(r=>r.id===item.id),baseline=item.baselineMonthlyUnits*item.unitCost*(item.endMonth-item.startMonth+1);
    return {id:item.id,category,label:item.label,baseline,released:row.amount[k],flows:{[category]:row.amount[k],[category==='spendingReduction'?'currentRemaining':'plannedRemaining']:baseline-row.amount[k]}};
  }));
  const cap=s.inputs.capacity,days=(Date.parse(cap.measurementEnd)-Date.parse(cap.measurementStart))/86400000;
  return cap.activities.map(item=>{
    const row=s.activities.find(r=>r.id===item.id),baseline=item.measuredHours*s.inputs.horizonMonths*365.25/12/days;
    return {id:item.id,category:'staffCapacity',label:item.label,baseline,released:row.grossHoursFreed[k],flows:{remaining:baseline-row.grossHoursFreed[k],spendingReduction:row.hoursUsedForSpendingReduction[k],spendingAvoidance:row.hoursUsedForSpendingAvoidance[k],staffCapacity:row.potentialHoursFreed[k]}};
  });
}
function inspect(s,html,label){
  const charts=sections(html),scales=new Map(),heights=new Map();
  if(!s.coverage.complete){assert.equal(charts.length,0,label+': partial estimates create no complete flow');return;}
  for(const k of levels){
    const current=charts.filter(section=>section.a['data-burden-case']===k);
    const kinds=['money','workload'].filter(kind=>expected(s,kind,k).some(row=>row.baseline>0));
    assert.deepEqual(current.map(section=>section.a['data-burden-kind']),kinds,label+': exactly the two supported nonempty views');
    for(const section of current){
      const kind=section.a['data-burden-kind'],rows=expected(s,kind,k),baseline=rows.reduce((sum,row)=>sum+row.baseline,0),released=rows.reduce((sum,row)=>sum+row.released,0),scale=Number(section.a['data-burden-scale']);
      close(Number(section.a['data-baseline-value']),baseline,label+': baseline');
      close(Number(section.a['data-released-value']),released,label+': saved released value');
      close(Number(section.a['data-residual-value']),baseline-released,label+': conservation');
      close(scale,180/baseline,label+': baseline scale');
      if(scales.has(kind))assert.equal(scale,scales.get(kind),label+': scale fixed across all cases');else scales.set(kind,scale);
      assert.equal(section.a['data-burden-unit'],kind==='money'?'USD':'hours');
      const svg=section.html.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/);assert.ok(svg);
      const box=attrs(svg[1]).viewBox.split(' ').map(Number);assert.deepEqual(box.slice(0,3),[0,0,200]);
      if(heights.has(kind))assert.equal(box[3],heights.get(kind),label+': chart height fixed across all cases');else heights.set(kind,box[3]);
      assert.doesNotMatch(svg[2],/<text\b|<foreignObject\b/,'Labels remain outside the SVG');
      assert.equal((section.html.match(/class="mr-unified-labels"/g)||[]).length,2);
      assert.match(section.html,/data-flow-direction="left-to-right"/);
      const titles=[...section.html.matchAll(/data-label-kind="(source|outcome)"[^>]*><span class="mr-unified-title" title="([^"]*)"><span class="mr-unified-short-title" aria-hidden="true">([^<]*)<\/span><span class="mr-unified-full-title">([^<]*)<\/span>/g)];
      assert.equal(titles.filter(title=>title[1]==='source').length,Math.min(rows.length,6),'Every displayed source retains its full accessible title');
      assert.equal(titles.filter(title=>title[1]==='outcome').length,4,'Every outcome retains its full accessible definition');
      for(const [,kind,title,short,full]of titles){
        assert.equal(title,full,'Full tooltip and accessible title agree');
        if(kind==='source'){
          assert.ok(decode(short).length<=28,'Source title has a bounded visible length');
          if(short!==full)assert.ok(short.endsWith('…'),'Partial source titles end in a deliberate ellipsis');
        }
      }
      const detail=[...section.html.matchAll(/<li\b([^>]*data-burden-source="[^"]+"[^>]*)>/g)].map(match=>attrs(match[1]));
      assert.deepEqual(detail.map(row=>row['data-burden-source']).sort(),rows.map(row=>row.id).sort(),label+': all sources retained');
      for(const row of rows){
        const item=detail.find(item=>item['data-burden-source']===row.id);
        assert.equal(item['data-burden-category'],row.category);
        close(Number(item['data-baseline-value']),row.baseline,label+': full source baseline');
        close(Number(item['data-released-value']),row.released,label+': exact source release');
        close(Number(item['data-residual-value']),row.baseline-row.released,label+': full source remainder');
        assert.ok(section.html.includes('<strong>'+escape(row.label)+'</strong>'),'Full source name remains in the detailed breakdown');
        sourceRows++;
      }
      const paths=[...svg[2].matchAll(/<path\b([^>]*)>/g)].map(match=>attrs(match[1])),amounts={};let drawn=0;
      for(const item of paths){
        const amount=Number(item['data-burden-amount']),width=Number(item['data-burden-drawn-amount']);
        assert.ok(amount>0&&width>0);assert.equal(item['fill-opacity'],'.34');
        assert.ok(['#09383E','#187783','#A9D0D4','#E6C765'].includes(item.fill));
        assert.match(item.d,/^M6 [\d.e+-]+ C70 /);assert.match(item.d,/,194 /);
        for(const id of item['data-burden-source-ids'].split(' '))assert.ok(rows.some(row=>row.id===id));
        amounts[item['data-burden-role']]=(amounts[item['data-burden-role']]||0)+amount;drawn+=width;pathsChecked++;
      }
      close(drawn,baseline,label+': every source unit reaches one outcome');
      for(const role of new Set(rows.flatMap(row=>Object.keys(row.flows))))close(amounts[role]||0,rows.reduce((sum,row)=>sum+(row.flows[role]||0),0),label+': exact saved '+role);
      if(kind==='money')assert.ok(!Object.hasOwn(amounts,'staffCapacity'),'Salary-valued retained time never becomes money');
      assert.doesNotMatch(section.html,/data-burden-role="(?:subscription|implementation)/);
      const rects=[...svg[2].matchAll(/<rect\b([^>]*)>/g)].map(match=>attrs(match[1]));
      for(const rect of rects){assert.equal(rect.width,'6');assert.ok(Number(rect.height)>=0);close(Number(rect.height),Number(rect['data-node-amount'])*scale,'Node width uses same unit scale');}
      const bounds=side=>{const nodes=rects.filter(rect=>rect['data-node-side']===side);return [Math.min(...nodes.map(node=>Number(node.y))),Math.max(...nodes.map(node=>Number(node.y)+Number(node.height)))];};
      const left=bounds('source'),right=bounds('outcome');close(left[0],right[0],label+': matching upper extent');close(left[1],right[1],label+': matching lower extent');
      if(rows.length>6){assert.match(section.html,/Other combines /);assert.match(section.html,/Every source and its full amount is listed below/);}
    }
  }
}
function build(s,label){
  const raw=structuredClone(artifact.outputs.depth_synthesis.source);raw.financial_scenario=structuredClone(s);raw.campaign_evidence.scopeId=s.scope.scopeId;
  delete raw.financial_benefit_assessment;
  const before=JSON.stringify(raw);freeze(raw);
  const model=report.fromSynthesis(raw),html=report.buildReportHtml(model);
  assert.match(html,/data-three-benefit-version="20260919.1"/,label+': production validator accepts fixture');
  assert.equal(JSON.stringify(raw),before,label+': saved source is unchanged');
  const tables=body=>[...body.matchAll(/<table class="mr-benefit-table">[\s\S]*?<\/table>/g)].map(match=>match[0]);
  assert.deepEqual(tables(html),tables(old.buildReportHtml(old.fromSynthesis(raw))),label+': all detailed financial tables remain exact');
  inspect(s,html,label);scenarios++;
}
for(const [name,s]of Object.entries(fixtures.cases))build(s,name);
const sampleHeights=[];
for(const key of ['depth_synthesis','cross_lens_synthesis']){
  const s=artifact.outputs[key].source.financial_scenario;build(s,key);
  for(const section of sections(flow(s,'central'))){
    const match=section.html.match(/--burden-height:([\d.]+)px;--burden-mobile-height:([\d.]+)px/),desktop=Number(match[1]),phone=Number(match[2]);
    assert.ok(desktop<=450,key+': current-example desktop diagram stays compact');
    assert.ok(phone<=600,key+': current-example phone diagram stays compact');
    sampleHeights.push({sample:key,kind:section.a['data-burden-kind'],desktop,phone});
  }
}
function zeroEstimated(){
  const s=structuredClone(fixtures.cases.complete),zero=()=>({low:0,central:0,high:0});
  for(const input of s.inputs.capacity.activities)input.reductionPercent=zero();
  for(const category of ['spendingReduction','spendingAvoidance'])for(const input of s.inputs[category].items)input.reductionPercent=zero();
  for(const row of s.activities){for(const key of ['grossHoursFreed','hoursUsedForSpendingReduction','hoursUsedForSpendingAvoidance','potentialHoursFreed','capacityValue'])row[key]=zero();for(const month of row.monthlyReconciliation)for(const key of Object.keys(month))if(key!=='month')month[key]=zero();}
  for(const row of s.spendingItems){row.amount=zero();row.allocatedHours=zero();for(const month of row.monthlyAllocations)month.allocatedHours=zero();}
  for(const b of Object.values(s.benefits)){b.amount=zero();if(b.hours)b.hours=zero();}
  for(const key of ['grossPotentialHoursFreed','potentialHoursFreed','capacityValue','existingSpendingReduction','futureSpendingAvoidance','knownBenefitSubtotal'])s.totals[key]=zero();
  for(const k of levels){s.totals.netExistingCashEffect[k]=-s.totals.cashInvestment[costCase[k]];s.totals.netCashEffect[k]=s.totals.netExistingCashEffect[k];s.totals.netCapacityAndCashValue[k]=-s.totals.totalImplementationAndSubscriptionCost[costCase[k]];s.totals.netKnownBenefitSubtotal[k]=s.totals.netCapacityAndCashValue[k];}
  return s;
}
build(zeroEstimated(),'estimated zero benefits with measured baselines');
const maximum=zeroEstimated(),activityInput=maximum.inputs.capacity.activities[0],activityResult=maximum.activities[0];
maximum.inputs.capacity.measuredPeople=10000;
maximum.inputs.capacity.activities=Array.from({length:12},(_,i)=>({...structuredClone(activityInput),id:'activity_'+i,label:('Activity '+i+' full source label ').padEnd(120,'X')}));
maximum.activities=maximum.inputs.capacity.activities.map(input=>({...structuredClone(activityResult),id:input.id,label:input.label}));
const expenseInput=maximum.inputs.spendingReduction.items.find(item=>item.kind==='non_labor');
const expenseResult=maximum.spendingItems.find(item=>item.id===expenseInput.id);
maximum.spendingItems=[];
for(const category of ['spendingReduction','spendingAvoidance']){
  maximum.inputs[category].items=Array.from({length:12},(_,i)=>({...structuredClone(expenseInput),id:category+'_'+i,resourceId:category+'_resource_'+i,label:(category+' source '+i+' ').padEnd(120,'Y')}));
  maximum.spendingItems.push(...maximum.inputs[category].items.map(input=>({...structuredClone(expenseResult),id:input.id,resourceId:input.resourceId,label:input.label,category})));
}
build(maximum,'API maximum: 24 expenses, 12 activities, 120-character labels');
const missing=structuredClone(fixtures.cases.complete);delete missing.inputs.spendingAvoidance.items;
assert.ok(!sections(flow(missing,'central')).some(section=>section.a['data-burden-kind']==='money'),'Missing baseline is never inferred as zero');
assert.match(flow(missing,'central'),/baseline cannot be drawn reliably/);
assert.equal(flow({},'central'),'','Legacy inputs without the three-benefit coverage contract create no estimates');
assert.equal(flow(fixtures.cases.partial,'central'),'','Unknown benefits are not drawn as zero');
assert.equal(flow(fixtures.cases.zero,'central'),'','Known zero without a measured denominator creates no ribbon');
const hostile=structuredClone(fixtures.cases.complete);hostile.inputs.capacity.activities[0].label='<img src=x onerror=alert(1)>';
assert.doesNotMatch(flow(hostile,'central'),/<img src=x/,'Source labels are escaped');
const huge=zeroEstimated();huge.inputs.spendingReduction.items[0].baselineMonthlyUnits=1e9;huge.inputs.spendingReduction.items[0].unitCost=1e9;
assert.ok(!sections(flow(huge,'central')).some(section=>section.a['data-burden-kind']==='money'),'Unsafe baseline geometry is withheld');
// A saved cent-rounded release can slightly exceed its exact denominator.
// Preserve the preexisting explicit fallback instead of inventing a baseline
// or silently replacing the saved monetary amount to force a ribbon.
const rounded=structuredClone(fixtures.cases.complete),roundingInput=rounded.inputs.spendingReduction.items.find(item=>item.kind==='non_labor');
Object.assign(roundingInput,{baselineMonthlyUnits:100.01,unitCost:29.99,startMonth:1,endMonth:1});
rounded.spendingItems.find(row=>row.id===roundingInput.id).amount={low:2999.30,central:2999.30,high:2999.30};
assert.ok(!sections(flow(rounded,'central')).some(section=>section.a['data-burden-kind']==='money'),'Rounded negative remainder uses the established fallback');
assert.match(flow(rounded,'central'),/baseline cannot be drawn reliably/);
const flowSource=renderer.slice(renderer.indexOf('  function renderThreeBenefitFlow'),renderer.indexOf('  function renderThreeBenefitBrief'));
assert.doesNotMatch(flowSource,/mr-burden-mobile|rotate\(/,'No vertical phone replacement');
assert.match(flowSource,/\.mr-unified-short-title\{[^}]*-webkit-line-clamp:2[^}]*text-overflow:ellipsis/,'Only the deliberate short title has a two-line ellipsis treatment');
assert.doesNotMatch(flowSource,/\.mr-unified-label>strong\{[^}]*(?:line-clamp|overflow:hidden|text-overflow:ellipsis)/,'Full monetary and hour amounts are never clipped');
// A grouped selector can hide clipping from a single-selector expression.
// Check each rule containing the outer title or amount, including shared rules.
const checkFullLabels=source=>{
  for(const [,selectors,styles]of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(selectors.split(',').some(selector=>/^\.mr-unified-label>(?:span|strong)$/.test(selector.trim())))assert.doesNotMatch(styles,/line-clamp|overflow\s*:\s*hidden|text-overflow\s*:\s*ellipsis|display\s*:\s*-webkit-box/,'Only deliberately shortened titles may be clipped, never their container or amount');
  }
};
checkFullLabels(flowSource);
assert.throws(()=>checkFullLabels('.mr-unified-label>span,.mr-unified-label>strong,.mr-unified-short-title{display:-webkit-box;-webkit-line-clamp:2;overflow:hidden}'),/Only deliberately shortened/,'Negative control catches the grouped-selector regression');
assert.equal(read('sample-data/production-diagnostic-samples.json'),sampleBytes,'No sample artifact changed');
console.log(JSON.stringify({status:'PASS',scenarios,sourceRows,pathsChecked,twoUnifiedViews:true,sourceCoverage:'12 activities and 24 expenses',fixedCaseScales:true,financialTablesUnchanged:true,sampleHeights,browserVerification:false,publicationApprovalClaimed:false}));
