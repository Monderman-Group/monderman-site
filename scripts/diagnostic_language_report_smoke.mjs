import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const api=path.resolve(process.env.LANGUAGE_API_ROOT||'../monderman-api-first-run');
const out=path.resolve(process.env.LANGUAGE_REPORT_OUT||'output/diagnostic-language-reports');
fs.mkdirSync(out,{recursive:true});
const corpus=JSON.parse(fs.readFileSync(path.join(api,'output/diagnostic-language/outputs.json')));
const renderer=fs.readFileSync('monderman-report.js','utf8');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],results=[],pdfs=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.resolve(url.pathname.slice(1)))});
 return route.abort();
});
const names={DV:'Decision Velocity',SC:'Structural Clarity',OS:'Operational Systems',IP:'Institutional Performance'};
try{
 await page.setContent('<!doctype html><html><body></body></html>');
 await page.addScriptTag({content:renderer});
 for(const entry of corpus){
  const payload={...entry.result,tool_label:names[entry.instrument],input_context:entry.context||{},narrative:entry.narrative,interpretive_prose:entry.prose};
  const html=await page.evaluate(payload=>MondermanReport.buildReportHtml(MondermanReport.fromRun(payload)),payload);
  assert.doesNotMatch(html,/\[object Object\]|\bundefined\b|\bNaN\b/,entry.id);
  assert.ok(html.includes(String(entry.result.score)),entry.id+': score absent');
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
   const layout=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1,h2,h3')].map(el=>el.textContent.trim()),emptyLinks:[...document.querySelectorAll('a')].filter(el=>!el.getAttribute('href')).length}));
   if(layout.documentWidth>width+1){
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).slice(0,15).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,100),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})));
    await page.screenshot({path:path.join(out,'FAIL-'+entry.id.replaceAll('/','-')+'-'+width+'.png'),fullPage:true});
    assert.fail(entry.id+'/'+width+': report overflow '+JSON.stringify(overflow));
   }
   assert.ok(layout.headings.includes('Priorities and options'),entry.id+': plain action heading absent');
   results.push({id:entry.id,width,...layout});
   if(entry.archetype==='worst'&&entry.depth===60&&entry.role==='managerial')await page.screenshot({path:path.join(out,entry.instrument+'-'+width+'.png'),fullPage:true});
  }
  if(entry.archetype==='worst'&&entry.depth===60&&entry.role==='managerial'){
   const file=path.join(out,entry.instrument+'-managerial-60.pdf');
   await page.pdf({path:file,format:'A4',printBackground:true,preferCSSPageSize:true});
   pdfs.push(file);
  }
  await page.addScriptTag({content:renderer});
 }
 assert.deepEqual(errors,[]);
 console.log('DIAGNOSTIC_LANGUAGE_REPORT_PASS '+results.length+' responsive reports; '+pdfs.length+' representative PDFs');
}finally{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,pdfs,errors,limits:['Synthetic reports, not customer records','Chromium HTML/print export only','Four representative PDFs, not every output combination']},null,2));
 await browser.close();
}
