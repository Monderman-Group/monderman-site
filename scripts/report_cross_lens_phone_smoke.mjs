// Cross-Lens phone readability: real browsers, no model or external network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),sandbox);
const report=sandbox.window.MondermanReport;
assert.equal(report.rendererVersion,'diagnostic-renderer-ai-screen-20260910.23');
const groups=[
  {tool_type:'structural_clarity',tool_label:'Structural Clarity',respondents:1,mean_score:0,median_score:0,score_iqr:[0,0],score_range:[0,0]},
  {tool_type:'decision_velocity',tool_label:'Decision Velocity',respondents:2,mean_score:70,median_score:69,score_iqr:[65,75],score_range:[60,80]},
  {tool_type:'operational_systems',tool_label:'Operational Systems',respondents:3,mean_score:65.5,median_score:66.5,score_iqr:[60.5,70.5],score_range:[50.5,80.5]},
  {tool_type:'institutional_performance',tool_label:'Institutional Performance',respondents:0,mean_score:null,median_score:null,score_iqr:[],score_range:[]}
];
const cases=['published','withheld'].map(status=>{
  const raw={synthesis_product:'cross_lens_synthesis',score_status:status,cross_diagnostic_score:status==='published'?45.2:null,condition_band:status==='published'?'Recorded':'Composite withheld',source_groups:structuredClone(groups)};
  const before=JSON.stringify(raw),model=report.fromSynthesis(raw),html=report.buildReportHtml(model);
  assert.equal(JSON.stringify(raw),before,'saved evidence cannot be changed');
  assert.equal(model.scorePublished,status==='published');assert.equal(model.sourceGroups.length,4);
  assert.ok(html.includes('role="list" aria-label="Contributing Diagnostic lenses"'));
  assert.equal((html.match(/role="listitem"/g)||[]).length,4);
  assert.equal((html.match(/role="heading" aria-level="3"/g)||[]).length,4);
  return {status,html};
});
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-cross-lens-phone-');fs.mkdirSync(out,{recursive:true});
const records=[],errors=[],network=[];
for(const [name,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [320,390,600,601,768,1440])for(const item of cases){
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{
        const m=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if(m)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.resolve(m[1]+'font.woff2'))});
        network.push(route.request().url());return route.abort();
      });
      await page.setContent(item.html,{waitUntil:'networkidle'});await page.evaluate(async()=>{await document.fonts.ready;});
      assert.ok(await page.evaluate(()=>document.fonts.check('16px "Neue Haas Grotesk"')));
      const section=page.locator('.mr-cross-lens-summary'),chart=section.locator('.mr-cross-lens-comparison'),list=section.getByRole('list');
      assert.equal(await chart.isVisible(),width>600,'phone-only alternative must not affect wider screen');
      assert.equal(await list.getByRole('listitem').count(),4);assert.equal(await list.getByRole('heading',{level:3}).count(),4);
      const values=await list.getByRole('listitem').allInnerTexts();
      const expected=[['Structural Clarity','0','Median score: 0','Submitted runs: 1','Middle half of scores: 0 – 0','Full score range: 0 – 0'],['Decision Velocity','70','Median score: 69','Submitted runs: 2','Middle half of scores: 65 – 75','Full score range: 60 – 80'],['Operational Systems','65.5','Median score: 66.5','Submitted runs: 3','Middle half of scores: 60.5 – 70.5','Full score range: 50.5 – 80.5'],['Institutional Performance','Unavailable','Median score: Unavailable','Submitted runs: 0','Middle half of scores: Unavailable','Full score range: Unavailable']];
      for(let i=0;i<4;i++)for(const value of expected[i])assert.ok(values[i].toLowerCase().includes(value.toLowerCase()),`${name}/${width}: ${value} missing`);
      const scoreStyles=await list.locator('.mr-contributing-score').evaluateAll(nodes=>nodes.map(node=>({missing:node.classList.contains('is-unavailable'),fontSize:parseFloat(getComputedStyle(node).fontSize),weight:getComputedStyle(node).fontWeight,attributes:[...node.attributes].map(a=>a.name)})));
      assert.equal(scoreStyles.length,4);for(const style of scoreStyles){assert.ok(style.missing?style.fontSize>=14&&style.fontSize<=20:style.fontSize>=24,'numeric and unavailable typography must actually apply');assert.equal(style.weight,style.missing?'600':'700');assert.deepEqual(style.attributes,['class']);}
      const geometry=await section.evaluate(section=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
        nodes:[...section.querySelectorAll('.mr-lens-grid .mr-lens-card,.mr-lens-grid .mr-lens-label,.mr-lens-grid .mr-copy')].map(el=>{const r=el.getBoundingClientRect();return {class:el.className,x:r.x,right:r.right,client:el.clientWidth,scroll:el.scrollWidth,fontSize:parseFloat(getComputedStyle(el).fontSize)};})}));
      assert.ok(geometry.documentWidth<=width+1);
      for(const node of geometry.nodes){assert.ok(node.x>=-.5&&node.right<=width+1);assert.ok(node.scroll<=node.client+1);if(width<=600&&(node.class==='mr-lens-label'||node.class==='mr-copy'))assert.ok(node.fontSize>=14);}
      if(width<=600){assert.ok(await section.getByRole('heading',{level:2}).isVisible());await section.screenshot({path:path.join(out,`${name}-${width}-${item.status}.png`)});}
      const textBeforePrint=await list.textContent();
      await page.emulateMedia({media:'print'});
      assert.ok(await chart.isVisible(),'the original SVG must remain available in print at every originating width');
      assert.equal(await list.textContent(),textBeforePrint,'print must keep identical card facts');
      assert.equal(await chart.locator('line[stroke-dasharray="5 4"]').count(),item.status==='published'?1:0);
      assert.equal((await chart.innerText()).includes('dashed Composite'),item.status==='published');
      records.push({engine:name,width,status:item.status,geometry,screenChartVisible:width>600,printChartVisible:true});await page.close();
    }
  }finally{await browser.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,browserStates:records.length,records,errors,network,providerCalls:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,browserStates:records.length,printMediaChecks:records.length,output:out,providerCalls:0,networkCalls:0}));
