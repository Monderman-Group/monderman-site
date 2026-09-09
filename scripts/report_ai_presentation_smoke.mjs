// Synthetic layout and recovery fixtures only. This does not certify model quality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.REPORT_AI_PRESENTATION_OUT||'output/report-ai-presentation');
fs.mkdirSync(out,{recursive:true});
const corpus=JSON.parse(fs.readFileSync('../monderman-api-first-run/output/diagnostic-language/outputs.json'));
const source=fs.readFileSync('monderman-report.js','utf8');
const names={DV:'Decision Velocity',SC:'Structural Clarity',OS:'Operational Systems',IP:'Institutional Performance'};
const report={model:'claude-opus-5',version:'synthetic-layout-only',snapshot_id:'a'.repeat(64),generated_at:'2026-09-08T18:00:00Z',
 interpretation:{summary:'This is a hand-authored layout fixture, not a model interpretation. The responses describe a possible delay that needs to be checked against actual work.',
 observations:[{text:'Question: How many tools are used?\nParticipant estimate: 1'},{text:'The participant reported that requests wait for approval. This account has not been independently verified.'}],
 hypotheses:[{text:'Unclear authority is one possible explanation. Required reviews or incomplete requests could also explain the wait.'}],
 recommendations:[{action:'Review a recent request with the people involved.',reason:'Compare the reported delay with the steps that actually occurred.\n\nThis is a proposal, not proof of an outcome.',prerequisite:'Include the person responsible for required controls.',risk:'Removing review without understanding its purpose could create other problems.',success_check:'Check whether requests become clearer without bypassing required review.',source_ids:['S1']}],limitations:['One response is not a representative organizational sample.']},
 limitations:['No causal or realized-savings claim is established.'],sources:[{id:'S1',publisher:'GAO',title:'Standards for Internal Control in the Federal Government',url:'https://www.gao.gov/products/gao-25-107721',reviewed:'2026-09-08'}],benchmark:{explanation:'A comparable numerical sector benchmark is not available from the reviewed sources.'}};
const complete={status:'complete',report};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const url=new URL(route.request().url());if(/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(url.pathname.slice(1))});return route.abort();});
try{
 for(const instrument of Object.keys(names)){
  const entry=corpus.find(e=>e.instrument===instrument&&e.role==='managerial'&&e.depth===60&&e.archetype==='worst');
  assert.ok(entry);
  const result={...entry.result,tool_label:names[instrument],input_context:entry.context,narrative:entry.narrative,interpretive_prose:entry.prose,ai_report:complete};
  await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:source});
  const html=await page.evaluate(r=>MondermanReport.buildReportHtml(MondermanReport.fromRun(r)),result);
  assert.doesNotMatch(html,/\[object Object\]|\bundefined\b|\bNaN\b/);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.mr-ai-interpretation').count(),1);
   const indices=await page.locator('.mr-section-index').allTextContents();
   assert.deepEqual(indices.map(text=>Number(text.match(/^\d+/)?.[0])),indices.map((_,i)=>i+1),'AI report sections must remain consecutively numbered');
   assert.equal(await page.locator('.mr-run-action-board .mr-section-index').count(),1,'measured priorities retain their section number');
   const story=page.locator('.mr-run-decision-story');
   assert.equal(await story.locator(':scope > div').count(),1,'complete AI report must not repeat a generic first action');
   assert.ok(await story.evaluate(el=>Math.abs(el.firstElementChild.getBoundingClientRect().width-el.clientWidth)<=2),'a single meaning panel must use the available width');
   const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ai:[...document.querySelectorAll('.mr-ai-interpretation *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}).map(el=>({tag:el.tagName,text:el.textContent.slice(0,60)}))}));
   assert.ok(layout.scrollWidth<=width+1,JSON.stringify({instrument,...layout}));assert.deepEqual(layout.ai,[]);
   await page.locator('.mr-ai-interpretation').screenshot({path:path.join(out,`${instrument}-${width}.png`)});
   checks.push({instrument,...layout});
  }
  await page.emulateMedia({media:'print'});
  const units=await page.locator('.mr-ai-reading-unit').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,display:getComputedStyle(el).display,breakInside:getComputedStyle(el).breakInside,height:el.getBoundingClientRect().height})));
  assert.ok(units.some(row=>row.text.includes('Question: How many tools are used?\nParticipant estimate: 1')),'question and answer remain one print unit');
  assert.equal(await page.locator('.mr-ai-reason').count(),2,'distinct reason paragraphs retain separate print boundaries');
  for(const unit of units){assert.equal(unit.display,'inline-block');assert.equal(unit.breakInside,'avoid');assert.ok(unit.height<640,'bounded reading unit must fit within a print page');}
  assert.equal(await page.locator('.mr-run-method').evaluate(el=>getComputedStyle(el).breakAfter),'avoid','the final method explanation must stay with the interpretation boundary');
  assert.equal(await page.locator('.mr-report-boundary').evaluate(el=>getComputedStyle(el).breakBefore),'avoid','the interpretation boundary must not be forced onto a page alone');
  if(process.env.REPORT_AI_TEST_PDF==='true')await page.pdf({path:path.join(out,`${instrument}.pdf`),format:'Letter',printBackground:true,preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
 }
 // Exercise the actual mount helper, including an existing pending section.
 await page.setContent('<!doctype html><html><head></head><body><div id="host"></div></body></html>');await page.addScriptTag({content:source});
 await page.clock.install();
 await page.evaluate(({complete})=>{
  window.layoutResult={ai_report:{status:'pending',message:'Interpretation pending.'}};
  const host=document.getElementById('host');host.innerHTML=MondermanReport.buildAIInterpretation(layoutResult.ai_report);
  window.refreshCalls=0;window.stopReportPoll=MondermanReport.mountAIInterpretation(host,layoutResult,async()=>{refreshCalls++;if(refreshCalls===1)throw new Error('Synthetic transient network failure');return {ai_report:complete};});
 },{complete});
 assert.equal(await page.locator('.mr-ai-interpretation').count(),1);
 await page.clock.fastForward(15000);
 assert.equal(await page.evaluate(()=>refreshCalls),1);assert.equal(await page.locator('.mr-ai-interpretation').count(),1);
 await page.clock.fastForward(15000);
 assert.equal(await page.evaluate(()=>refreshCalls),2);
 assert.match(await page.locator('.mr-ai-interpretation').innerText(),/hand-authored layout fixture/);
 await page.clock.fastForward(60000);assert.equal(await page.evaluate(()=>refreshCalls),2);
 const escaped=await page.evaluate(complete=>{const x=structuredClone(complete);x.report.interpretation.summary='<script>window.XSS=true</script>';document.getElementById('host').innerHTML=MondermanReport.buildAIInterpretation(x);return {scripts:document.querySelectorAll('#host script').length,text:document.getElementById('host').innerText};},complete);
 assert.equal(escaped.scripts,0);assert.match(escaped.text,/<script>/);
 assert.deepEqual(errors,[]);
 console.log('PASS report AI presentation: 12 responsive renders, single pending-to-complete block, transient read recovery, stopped completed polling, escaped output; synthetic layout fixture only.');
}finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,errors,fixture:'Hand-authored synthetic layout only; not model-quality evidence.'},null,2));await browser.close();}
