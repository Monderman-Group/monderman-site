// Real built page and current sample reports; local assets only. A delayed
// shared shell reproduces the tall fallback header seen before its CSS settles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
const root=path.resolve(process.env.SAMPLE_HEADER_SITE_ROOT||'.render-public');
const origin='http://sample-header.test',out=process.env.SAMPLE_HEADER_OUT||fs.mkdtempSync('/tmp/sample-header-offset-');
fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file));
const source=read('sample-report.html').toString(),sha=value=>createHash('sha256').update(value).digest('hex');
const files=['sample-report.html','canonical-site-shell.js','canonical-site-shell.css','sample-report-production.css','monderman-report.js','sample-data/production-diagnostic-samples.json'];
const sourceHashes=Object.fromEntries(files.map(file=>[file,sha(read(file))]));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const tabs=['os','dv','sc','ip','depth','synthesis'],rows=[],negativeControls=[],errors=[];
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
const settled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const geometry=page=>page.evaluate(()=>({headerHeight:document.getElementById('siteHeader').offsetHeight,pinTop:parseFloat(document.documentElement.style.getPropertyValue('--pin-top')),shellReady:document.documentElement.classList.contains('canonical-shell-js')}));
async function expectOffset(page,label){
 await page.waitForFunction(()=>parseFloat(document.documentElement.style.getPropertyValue('--pin-top'))===document.getElementById('siteHeader').offsetHeight+8);
 const state=await geometry(page);eq(state.pinTop,state.headerHeight+8,label+' exact header offset');return state;
}
const originalHandlers=/    function onHeaderLayout\(\) \{ setTop\(\); onScroll\(\); \}\n[\s\S]*?(?=    setTop\(\); paint\(\);)/;
ok(originalHandlers.test(source),'Built page includes the header layout correction');
const oldSource=source.replace(originalHandlers,"    window.addEventListener('scroll', onScroll, { passive: true });\n    window.addEventListener('resize', function () { setTop(); onScroll(); });\n");
async function loadPage(browser,width,{prior=false,noObserver=false}={}){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(10000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(noObserver=>{
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};
  if(noObserver)Object.defineProperty(window,'ResizeObserver',{value:undefined});
 },noObserver);
 let release;const pending=new Promise(resolve=>{release=resolve;});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin&&!(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname)))return route.abort();
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();
  if(url.pathname==='/canonical-site-shell.js')await pending;
  return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:url.pathname==='/sample-report.html'?(prior?oldSource:source):fs.readFileSync(file)});
 });
 await page.goto(origin+'/sample-report.html#synthesis',{waitUntil:'commit'});
 await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--pin-top'));
 const initial=await geometry(page);eq(initial.shellReady,false,'Shared header styling remains delayed');
 eq(initial.pinTop,initial.headerHeight+8,'Initial measurement records the fallback header');
 release();await page.waitForLoadState('load');await page.locator('body.production-samples-ready').waitFor();await page.evaluate(()=>document.fonts.ready);await settled(page);
 return{page,initial};
}
async function checkReports(page,engine,width,phase){
 for(const tab of tabs){
  await page.evaluate(()=>scrollTo(0,0));await page.locator('#tab-'+tab).click();
  const nav=page.locator('#report-'+tab+' .mr-screen-nav');
  const style=await nav.evaluate(node=>({position:getComputedStyle(node).position,top:getComputedStyle(node).top}));
  eq(await page.locator('.report-sheet>.dx-tabs-wrap').evaluate(node=>getComputedStyle(node).position),'relative','Product tabs remain nonsticky');
  const before=await nav.evaluate(node=>({top:node.getBoundingClientRect().top,scrollY}));
  await page.evaluate(y=>scrollTo(0,y),before.scrollY+before.top+180);await settled(page);
  const state=await nav.evaluate(node=>({top:node.getBoundingClientRect().top,scrollY,headerBottom:document.getElementById('siteHeader').getBoundingClientRect().bottom,headerHeight:document.getElementById('siteHeader').offsetHeight}));
  if(width<=480){
   eq(style.position,'relative','Phone navigation remains in normal flow');
   ok(['auto','0px'].includes(style.top),'Phone navigation has no sticky header offset');
   ok(Math.abs((before.top-state.top)-(state.scrollY-before.scrollY))<=1,'Phone navigation scrolls away instead of sticking');
  }else{
   eq(style.position,'sticky','Tablet and desktop navigation stays sticky');
   eq(parseFloat(style.top),state.headerHeight+8,'Navigation CSS uses the settled header offset');
   ok(Math.abs(state.top-(state.headerHeight+8))<=1,'Pinned navigation is exactly eight pixels below the header');
   ok(state.top>=state.headerBottom+7,'Navigation clears the visible header');
  }
  rows.push({engine,width,phase,tab,...state,position:style.position});
 }
}
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,834,1440]){
   const{page,initial}=await loadPage(browser,width);const loaded=await expectOffset(page,engine+'/'+width+' after load');
   if(width===834)ok(initial.headerHeight>loaded.headerHeight+100,'Delayed shared styling reproduces the tall tablet header');
   await checkReports(page,engine,width,'loaded');
   await page.screenshot({path:path.join(out,engine+'-'+width+'-loaded.png')});
   await page.evaluate(()=>{const header=document.getElementById('siteHeader');header.style.setProperty('height',(header.offsetHeight+24)+'px','important');});
   await expectOffset(page,engine+'/'+width+' header resized without window resize');
   await checkReports(page,engine,width,'header-resized');
   await page.evaluate(()=>document.getElementById('siteHeader').style.removeProperty('height'));await expectOffset(page,'Header size restored');
   await page.setViewportSize({width:width+20,height:1000});await expectOffset(page,'Viewport resized');
   await page.setViewportSize({width,height:1000});await expectOffset(page,'Viewport restored');await page.close();
  }
  const prior=await loadPage(browser,834,{prior:true}),old=await geometry(prior.page);
  ok(old.pinTop>old.headerHeight+100,'Negative control reproduces the stale tablet offset before any viewport resize');
  negativeControls.push({engine,...old});await prior.page.close();
  const fallback=await loadPage(browser,834,{noObserver:true});await expectOffset(fallback.page,'Load handler works without ResizeObserver');await fallback.page.close();
 }finally{await browser.close();}
}
eq(errors,[],'No browser runtime errors');
for(const file of files)eq(sha(read(file)),sourceHashes[file],'Built source remains unchanged: '+file);
const receipt={status:'PASS',checks,layouts:6,reportStates:rows.length,negativeControls,rows,sourceHashes,networkCalls:0,providerCalls:0,productionCalls:0};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks,layouts:6,reportStates:rows.length,negativeControls:negativeControls.length,out,providerCalls:0}));
