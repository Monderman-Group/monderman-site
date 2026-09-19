// Isolated built retirement component. Public integration is separately covered
// by first_run_browser_smoke; this checks all former choices and storage denial.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const code=fs.readFileSync('.render-public/first-run-telemetry.js','utf8');
assert.equal(code,fs.readFileSync('first-run-telemetry.js','utf8'));
const out=path.resolve(process.env.ACQUISITION_OUT||'output/acquisition-browser');fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [engine,type]of Object.entries({chromium,webkit})){
 const b=await type.launch({headless:true});
 try{for(const width of [390,768,1440])for(const mode of ['none','allow','deny','malformed','unavailable']){
  const c=await b.newContext({viewport:{width,height:844}}),p=await c.newPage(),events=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin==='http://retirement.test'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Retirement fixture</title><main><h1>Functional controls</h1><a id="functional" href="/pilot.html?source=homepage">Request an invitation</a></main><footer>Footer</footer>'});
   events.push(url.pathname);return route.abort();
  });
  await p.goto('http://retirement.test/?utm_source=email&utm_campaign=first-dv-202609');
  await p.evaluate(mode=>{
   localStorage.setItem('auth-token','preserve');sessionStorage.setItem('saved-run','preserve');
   sessionStorage.setItem('monderman_first_run_journey','previous');sessionStorage.setItem('monderman_first_run_attribution','previous');
   if(mode!=='none')localStorage.setItem('monderman_measurement_choice',mode==='malformed'?'{bad':JSON.stringify({choice:mode,version:'2026-09-10-v1'}));
   if(mode==='unavailable'){for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{configurable:true,get(){throw Error('storage unavailable')}});}
  },mode);
  await p.addScriptTag({content:code});
  await p.evaluate(()=>{MondermanFirstRun.track('primary_cta_clicked');MondermanFirstRun.trackOnce('diagnostic_started');MondermanFirstRun.openMeasurementChoices();dispatchEvent(new Event('focus'));dispatchEvent(new Event('pageshow'));});
  assert.deepEqual(await p.evaluate(()=>[MondermanFirstRun.isMeasurementAllowed(),MondermanFirstRun.measurementConsentVersion(),MondermanFirstRun.journeyId()]),[false,null,'']);
  assert.equal(await p.locator('#mnd-measurement-panel,#mnd-measurement-settings').count(),0);
  assert.equal(await p.locator('#functional').getAttribute('href'),'/pilot.html?source=homepage');
  if(mode!=='unavailable'){
   assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('monderman_measurement_choice'),sessionStorage.getItem('monderman_first_run_journey'),sessionStorage.getItem('monderman_first_run_attribution')]),[null,null,null]);
   assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('auth-token'),sessionStorage.getItem('saved-run')]),['preserve','preserve']);
  }
  assert.deepEqual(events,[]);assert.deepEqual(errors,[]);
  results.push({engine,width,mode,networkCalls:0,controlsCreated:0});await c.close();
 }}finally{await b.close();}
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,results},null,2));
console.log('ACQUISITION_RETIREMENT_BROWSER_PASS '+results.length+' isolated cases, zero tracking/UI, unrelated storage preserved');
