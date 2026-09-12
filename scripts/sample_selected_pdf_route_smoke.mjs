// Transport/display regression only. The six existing historical synthetic
// sources are wrapped in a transient mock publication envelope in this browser.
// No current sample publication, provider approval, PDF or live request occurs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),origin='http://127.0.0.1:49878';
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=['sample-report.html','sample-report-production.js','monderman-report.js','public-sample-model.js','sample-data/production-diagnostic-samples.json'];
const pins=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const artifact=JSON.parse(fs.readFileSync(path.join(root,files[4]),'utf8'));
artifact.contract='monderman-public-product-samples/v3';artifact.synthetic=true;
artifact.publication_projection={version:'monderman-public-sample-projection-20260912.5',source_sha256:'a'.repeat(64),projection_commit:'b'.repeat(40)};
const outputArg=process.argv.find(arg=>arg.startsWith('--output='));
const out=outputArg?outputArg.slice(9):fs.mkdtempSync('/tmp/sample-selected-pdf-MOCK-');
if(outputArg){assert.ok(path.isAbsolute(out));fs.mkdirSync(out,{mode:0o700});}
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
let checks=0;const rows=[];const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const hook=`
window.__pdfRoute={calls:[],models:new WeakMap(),next:0,windowPrintCalls:0};
window.print=()=>{window.__pdfRoute.windowPrintCalls++;};
MondermanReport.downloadPdf=model=>{
 const state=window.__pdfRoute;if(!state.models.has(model))state.models.set(model,++state.next);
 state.calls.push({modelId:state.models.get(model),html:MondermanReport.buildReportHtml(model)});
};`;
for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true});
 try{for(const width of [390,834,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};});
  let mode='loading',release;const pending=new Promise(resolve=>{release=resolve;});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin&&!(/^https:\/\/www\.monderman\.com$/.test(url.origin)&&/^\/(55|65|75)font\.woff2$/.test(url.pathname)))return route.abort();
   if(url.pathname==='/sample-data/production-diagnostic-samples.json'){
    if(mode==='loading')await pending;
    if(mode==='failed')return route.fulfill({status:503,body:'Unavailable'});
    const body=structuredClone(artifact);if(mode==='invalid')body.publication_projection.version='not-approved';
    return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   }
   const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return route.abort();
   const body=fs.readFileSync(filename);
   const failureHook=mode==='mount-failed'?';const originalRender=MondermanReport.render;let mounts=0;MondermanReport.render=(...args)=>{if(++mounts===4)throw Error("MOCK mount failure");return originalRender(...args);};':'';
   return route.fulfill({contentType:types[path.extname(filename)]||'application/octet-stream',body:url.pathname==='/monderman-report.js'?body.toString()+hook+failureHook:body});
  });
  await page.goto(origin+'/sample-report.html',{waitUntil:'domcontentloaded'});
  const top=page.locator('#sample-selected-pdf');
  ok(await top.isVisible(),`${engine}/${width}: top PDF visible while loading`);
  ok(await top.isDisabled(),'Disabled until all reports validated and mounted');
  await top.evaluate(el=>el.click());eq(await page.evaluate(()=>__pdfRoute.calls.length),0,'Loading cannot export');
  mode='ready';release();await page.waitForFunction(()=>!document.getElementById('sample-selected-pdf').disabled);
  eq(await page.locator('.psr-wrap').count(),6,'All six reports mounted');
  for(const tab of ['os','dv','sc','ip','depth','synthesis']){
   await page.locator('#tab-'+tab).click();await page.waitForFunction(()=>!document.getElementById('sample-selected-pdf').disabled);
   try{await top.click();}catch(error){throw new Error(`${engine}/${width}/${tab}: `+JSON.stringify(await page.evaluate(()=>({scrollY,button:document.getElementById('sample-selected-pdf').getBoundingClientRect().toJSON(),header:document.getElementById('siteHeader').getBoundingClientRect().toJSON()}))),{cause:error});}
   await page.locator('#report-'+tab+' [data-action="print"]').click();
   const pair=await page.evaluate(()=>__pdfRoute.calls.slice(-2));
   eq(pair[0],pair[1],`${engine}/${width}/${tab}: identical model and standalone HTML`);
   ok(pair[0].html.startsWith('<!DOCTYPE html>'),'Standalone document, not library print');
   rows.push({engine,width,tab,modelId:pair[0].modelId,htmlSha256:sha(pair[0].html)});
  }
  await page.evaluate(()=>scrollTo(0,0));await top.focus();await page.keyboard.press('ArrowRight');
  ok(await top.evaluate(el=>el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3),'Keyboard focus visible');
  await page.mouse.move(0,0);eq(await top.evaluate(el=>getComputedStyle(el).color),'rgb(12, 110, 120)','Brand normal link color');
  await top.hover();eq(await top.evaluate(el=>getComputedStyle(el).color),'rgb(10, 91, 99)','Brand hover link color');
  const before=await page.evaluate(()=>__pdfRoute.calls.length);await page.keyboard.press('Enter');await page.keyboard.press('Space');
  eq(await page.evaluate(()=>__pdfRoute.calls.length),before+2,'Native Enter and Space both export selected model');
  if(width!==834)await page.locator('.meta-bar').screenshot({path:path.join(out,`${engine}-${width}-top-PDF.png`)});
  await page.evaluate(()=>document.getElementById('report-synthesis').hidden=true);await page.waitForFunction(()=>document.getElementById('sample-selected-pdf').disabled);
  await top.evaluate(el=>el.click());eq(await page.evaluate(()=>__pdfRoute.calls.length),before+2,'No selection cannot export');
  await page.evaluate(()=>{document.getElementById('report-os').hidden=false;document.getElementById('report-dv').hidden=false;});
  ok(await top.isDisabled(),'Ambiguous selection stays disabled');
  await top.evaluate(el=>el.click());eq(await page.evaluate(()=>__pdfRoute.calls.length),before+2,'Two selected reports cannot export');
  await page.evaluate(()=>{document.getElementById('report-dv').hidden=true;document.querySelector('#report-os [data-action="print"]').remove();});
  ok(await top.isDisabled(),'Removed mounted handler cannot export');
  eq(await page.evaluate(()=>__pdfRoute.windowPrintCalls),0,'Library window.print is never used');
  eq(errors,[],'No uncaught page errors');
  for(const failure of ['failed','invalid','mount-failed']){
   mode=failure;await page.reload({waitUntil:'load'});await page.waitForSelector('.psr-load-error',{state:'attached'});
   eq(await page.locator('.psr-load-error').count(),6,'Failure replaces all six reports');
   ok(await top.isDisabled(),failure+' leaves PDF disabled');await top.evaluate(el=>el.click());
   eq(await page.evaluate(()=>__pdfRoute.calls.length),0,failure+' cannot export blank report');
  }
  await page.close();
 }}finally{await browser.close();}
}
for(const file of files)eq(sha(fs.readFileSync(path.join(root,file))),pins[file],'Source unchanged during test: '+file);
const result={status:'PASS',checks,layouts:6,selectedReports:rows.length,sourceHashes:pins,rows,networkCalls:0,providerCalls:0,pdfsCreated:0,
 fixture:'Transient mock publication envelope with historical synthetic report sources; real page, validation, model and standalone HTML renderer.',currentSamplePublicationApproved:false};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,layouts:6,selectedReports:rows.length,pdfsCreated:0,providerCalls:0,output:out,currentSamplePublicationApproved:false}));
