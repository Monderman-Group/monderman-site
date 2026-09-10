// Display-only tie regression. Synthetic inputs, no provider or customer calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source=fs.readFileSync('monderman-report.js','utf8');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);
const report=sandbox.window.MondermanReport;
assert.equal(report.rendererVersion,'diagnostic-renderer-ai-screen-20260910.22');
const labels=['Structural Clarity','Decision Velocity','Operational Systems','Institutional Performance'];
const types=['structural_clarity','decision_velocity','operational_systems','institutional_performance'];
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const encoded=value=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&!Number.isFinite(item)?String(item):item);
function raw(values,order=[0,1,2,3]){
  return freeze({synthesis_product:'cross_lens_synthesis',score_status:'withheld',cross_diagnostic_score:null,
    condition_band:'Composite withheld',source_groups:order.map(index=>({tool_type:types[index],tool_label:labels[index],
      submitted_runs:1,mean_score:values[index],median_score:values[index],score_iqr:[],score_range:[]}))});
}
function render(input){
  const before=encoded(input),model=report.fromSynthesis(input),modelBefore=encoded(model);
  const html=report.buildReportHtml(model);
  assert.equal(encoded(input),before,'saved input changed');
  assert.equal(encoded(model),modelBefore,'report model changed');
  const block=html.split('<div class="mr-system-metrics">')[1]?.split('<div class="mr-system-decision">')[0];
  assert.ok(block,'Cross metric block missing');
  assert.doesNotMatch(block,/Strongest|Weakest/,'mean rank must not imply construct strength');
  const metrics=[...block.matchAll(/<div class="mr-lens-label">([^<]*)<\/div><div class="mr-run-metric-value">([^<]*)<\/div>(?:<p class="mr-copy">([^<]*)<\/p>)?/g)].map(match=>({label:match[1],value:match[2],detail:match[3]||''}));
  assert.equal(metrics.length,4);
  return {html,metrics};
}
const permutations=items=>items.length?items.flatMap((item,index)=>permutations(items.filter((_x,i)=>i!==index)).map(rest=>[item,...rest])):[[]];
const fixtures=[
  {id:'top-tie',values:[70,74,74,69],high:[1,2],low:[3],range:'5 pts'},
  {id:'bottom-tie',values:[70,74,69,69],high:[1],low:[2,3],range:'5 pts'},
  {id:'all-tied',values:[74,74,74,74],high:[0,1,2,3],low:[0,1,2,3],range:'0 pts'},
  {id:'unique',values:[70,74,65,69],high:[1],low:[2],range:'9 pts'},
  {id:'zero-and-missing',values:[0,null,10,undefined],high:[2],low:[0],range:'10 pts'},
  {id:'all-missing',values:[null,undefined,'',NaN],high:[],low:[],range:'Unavailable'},
  {id:'numeric-strings',values:['0','10','10',null],high:[1,2],low:[0],range:'10 pts'},
  {id:'invalid-means',values:[Infinity,'unavailable',null,0],high:[3],low:[3],range:'0 pts'}
];
let deterministicCases=0;
for(const fixture of fixtures)for(const order of permutations([0,1,2,3])){
  const {metrics}=render(raw(fixture.values,order));
  for(const [index,expected,direction] of [[1,fixture.high,'highest'],[2,fixture.low,'lowest']]){
    const expectedLabel=expected.length>1?'Joint '+direction+' mean':direction[0].toUpperCase()+direction.slice(1)+' mean';
    assert.equal(metrics[index].label,expectedLabel,fixture.id+': label');
    assert.equal(metrics[index].value,expected.map(i=>labels[i]).sort().join(', ')||'Unavailable',fixture.id+': complete joint set');
    assert.equal(metrics[index].detail,expected.length?Number(fixture.values[expected[0]])+' mean':'',fixture.id+': mean detail');
  }
  assert.equal(metrics[3].value,fixture.range);deterministicCases++;
}
const mutation=source.replace('const highestLabels = groups.filter((lens) => Number(lens.mean) === highest).map((lens) => lens.toolLabel).sort();','const highestLabels = groups.filter((lens) => Number(lens.mean) === highest).slice(0, 1).map((lens) => lens.toolLabel).sort();');
assert.notEqual(source,mutation,'negative first-winner mutation must apply');
const bad={window:{}};vm.runInNewContext(mutation,bad);
const badHtml=bad.window.MondermanReport.buildReportHtml(bad.window.MondermanReport.fromSynthesis(raw([70,74,74,69])));
assert.ok(!badHtml.includes('Joint highest mean'),'regression must distinguish old arbitrary selection');
if(process.argv.includes('--deterministic-only')){
  console.log(JSON.stringify({passed:true,deterministicCases,negativeMutations:1,providerCalls:0,networkCalls:0}));
  process.exit(0);
}
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-cross-extrema-');
fs.mkdirSync(out,{recursive:true});
const records=[],errors=[],network=[];
for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [320,390,768,1440])for(const fixture of fixtures.slice(0,4)){
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.resolve(match[1]+'font.woff2'))});
        network.push(route.request().url());return route.abort();
      });
      await page.setContent(render(raw(fixture.values)).html);
      await page.evaluate(async()=>{await document.fonts.ready;});
      for(const media of ['screen','print']){
        await page.emulateMedia({media});
        const facts=await page.locator('.mr-system-metrics').evaluate(element=>({
          client:element.clientWidth,scroll:element.scrollWidth,
          metrics:[...element.querySelectorAll('.mr-run-metric')].map(metric=>{
            const box=metric.getBoundingClientRect();return {text:metric.innerText,client:metric.clientWidth,scroll:metric.scrollWidth,
              children:[...metric.children].map(child=>{const rect=child.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(child);const glyph=range.getBoundingClientRect();return {client:child.clientWidth,scroll:child.scrollWidth,
                contained:rect.left>=box.left-.5&&rect.right<=box.right+.5,glyphContained:glyph.left>=box.left-.5&&glyph.right<=box.right+.5};})};
          })}));
        assert.ok(facts.scroll<=facts.client+1,engine+'/'+width+'/'+fixture.id+'/'+media+': grid overflow');
        for(const metric of facts.metrics){assert.ok(metric.scroll<=metric.client+1);for(const child of metric.children){assert.ok(child.scroll<=child.client+1);assert.equal(child.contained,true);assert.equal(child.glyphContained,true);}}
        const file=`${engine}-${width}-${fixture.id}-${media}.png`;
        await page.locator('.mr-system-metrics').screenshot({path:path.join(out,file)});
        records.push({engine,width,id:fixture.id,media,file,...facts});
      }
      await page.close();
    }
  }finally{await browser.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,deterministicCases,negativeMutations:1,browserStates:records.length,records,errors,network,providerCalls:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,deterministicCases,negativeMutations:1,browserStates:records.length,out,providerCalls:0,networkCalls:0}));
