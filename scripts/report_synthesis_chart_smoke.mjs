// Synthetic, local-only Synthesis chart presentation regression. No provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source=fs.readFileSync('monderman-report.js','utf8');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);
const report=sandbox.window.MondermanReport;
const groups=[['structural_clarity','Structural Clarity',59.4,5],['decision_velocity','Decision Velocity',100,3],['operational_systems','Operational Systems',0,2],['institutional_performance','Institutional Performance',93.8,1]]
 .map(([tool_type,tool_label,mean_score,submitted_runs])=>({tool_type,tool_label,mean_score,median_score:mean_score,submitted_runs,score_iqr:[mean_score,mean_score]}));
const base={synthesis_product:'cross_lens_synthesis',score_status:'withheld',cross_diagnostic_score:null,condition_band:'Composite withheld',source_groups:groups,submitted_run_count:11,lens_count:4,
 convergence_signals:[{label:'Burden and resilience',text:'Compare the submitted accounts of workload with the available recovery time. These records do not establish a causal relationship.',tools:['operational_systems','institutional_performance']}]};
const depth={...base,synthesis_product:'depth_synthesis',source_groups:[groups[0]],lens_count:1,sample_reads:[{tool_type:'structural_clarity',tool_label:'Structural Clarity',n:5,
 score:{min:0,max:100,mean:59.4,median:60,iqr:[30,80],sd:18.5},segments:[{participant_mode:'senior_leader',n:2,mean_score:70,median_score:75},{participant_mode:'managerial',n:3,mean_score:40,median_score:45}]}]};
const zeroDepth={...depth,sample_reads:[{...depth.sample_reads[0],score:{min:0,max:0,mean:null,median:0,iqr:[0,0],sd:0},segments:[{participant_mode:'senior_leader',n:1,mean_score:0,median_score:0}]}]};
const cases=[['depth',depth,'.mr-depth-distribution-panel'],['depth-zero-null',zeroDepth,'.mr-depth-distribution-panel'],['cross-withheld',base,'.mr-system-panel'],['cross-published',{...base,score_status:'published',cross_diagnostic_score:63.3},'.mr-system-panel']].map(([id,raw,selector])=>{
 const before=JSON.stringify(raw),model=report.fromSynthesis(raw),modelBefore=JSON.stringify(model),html=report.buildReportHtml(model);
 assert.equal(JSON.stringify(raw),before,'saved source input changed');assert.equal(JSON.stringify(model),modelBefore,'render model changed');
 return {id,raw,html,selector};
});
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-synthesis-charts-');fs.mkdirSync(out,{recursive:true});
const records=[],errors=[],network=[];
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{for(const width of [320,390,768,1440])for(const item of cases){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
   if(match)return route.fulfill({status:200,contentType:'font/woff2',body:fs.readFileSync(path.resolve(match[1]+'font.woff2'))});network.push(route.request().url());return route.abort();});
  await page.setContent(item.html,{waitUntil:'networkidle'});await page.evaluate(async()=>{await Promise.all([400,500,700].map(weight=>document.fonts.load(`${weight} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;});
  assert.ok(await page.evaluate(()=>document.fonts.check('16px "Neue Haas Grotesk"')));
  for(const media of ['screen','print']){
   await page.emulateMedia({media});
   const measured=await page.locator(item.selector).evaluate(panel=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const compact=panel.querySelector('.mr-synth-compact'),svg=panel.querySelector('svg');
    const compactVisible=getComputedStyle(compact).display!=='none';
    const labels=[...compact.querySelectorAll('dt,dd,strong,span')].map(el=>({text:el.textContent,tag:el.tagName,whiteSpace:getComputedStyle(el).whiteSpace,font:parseFloat(getComputedStyle(el).fontSize),...rect(el)}));
    const values=[...panel.querySelectorAll('.mr-system-lens-value')],meta=[...panel.querySelectorAll('.mr-system-lens-meta')];
    return {compactVisible,svgVisible:getComputedStyle(svg).display!=='none',compactText:compact.textContent,labels,
     panel:rect(panel),internalOverflow:[...compact.querySelectorAll('*')].filter(el=>el.clientWidth>0&&el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,text:el.textContent,client:el.clientWidth,scroll:el.scrollWidth})),pairs:values.map((el,i)=>({value:el.textContent,meta:meta[i].textContent,valueBox:rect(el),metaBox:rect(meta[i])})),
     signalPrintBreak:getComputedStyle(document.querySelector('.mr-map-signal')||panel).breakInside,
     interactionBreaks:[...document.querySelectorAll('.mr-interaction-grid>.mr-interaction-label,.mr-interaction-grid>.mr-interaction-cell')].map(el=>getComputedStyle(el).breakInside),
     hubFill:panel.querySelector('.mr-system-hub')?getComputedStyle(panel.querySelector('.mr-system-hub')).fill:null,
     documentOverflow:document.documentElement.scrollWidth>innerWidth};
   });
   const name=`${engine}/${width}/${item.id}/${media}`;const compactExpected=media==='screen'&&width<=800;
   assert.equal(measured.compactVisible,compactExpected,`${name}: responsive summary visibility`);assert.equal(measured.svgVisible,!compactExpected,`${name}: diagram visibility`);
   if(media==='screen')assert.equal(measured.documentOverflow,false,`${name}: document overflow`);
   if(compactExpected){assert.deepEqual(measured.internalOverflow,[],`${name}: internal text overflow`);for(const label of measured.labels){assert.ok(label.font>=14,`${name}: unreadable compact label ${label.text}`);assert.ok(label.left>=measured.panel.left-1&&label.right<=measured.panel.right+1,`${name}: summary label outside panel`);if(label.tag==='DD')assert.equal(label.whiteSpace,'nowrap',`${name}: numeric/range value can wrap`);}}
   if(item.id.startsWith('depth')){
    const expected=item.id==='depth'?['60','59.4','0–100','30–80','18.5','75','45']:['Median0','MeanNotavailable','Range0–0','Interquartilerange0–0','Samplestandarddeviation0'];
    for(const value of expected)assert.ok(measured.compactText.replace(/\s+/g,'').includes(value),`${name}: missing recorded value ${value}`);
   }
   else{
    assert.equal(measured.pairs.length,4);assert.ok(measured.compactText.includes(item.id==='cross-withheld'?'Composite withheldUnavailable':'Equal-lens Composite63.3'));
    measured.pairs.forEach((pair,i)=>{assert.equal(Number(pair.value),groups[i].mean_score);assert.equal(pair.meta,`mean · n=${groups[i].submitted_runs}`);
     if(!compactExpected)assert.ok(pair.valueBox.bottom<=pair.metaBox.top,`${name}: value/metadata collision`);});
    if(media==='print'){assert.equal(measured.hubFill,'rgb(8, 56, 62)',`${name}: print hub must be opaque`);assert.equal(measured.signalPrintBreak,'avoid',`${name}: evidence heading can orphan`);assert.ok(measured.interactionBreaks.length>0);for(const value of measured.interactionBreaks)assert.equal(value,'avoid',`${name}: interaction cell can split`);}
   }
   records.push({engine,width,id:item.id,media,...measured});
   if(media==='screen')await page.locator(item.selector).screenshot({path:path.join(out,`${engine}-${width}-${item.id}.png`)});
   if(engine==='chromium'&&width===1440&&media==='print')await page.pdf({path:path.join(out,`${item.id}.pdf`),printBackground:true,preferCSSPageSize:true});
  }
  await page.close();
 }}finally{await browser.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,rendererVersion:report.rendererVersion,browserStates:records.length,providerCalls:0,networkCalls:0,errors,records},null,2)+'\n');
console.log(JSON.stringify({passed:true,browserStates:records.length,providerCalls:0,output:out}));
