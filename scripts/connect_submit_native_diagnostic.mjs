// Temporary offline CI camera for the unchanged native Connect 429/retry case.
// The test fragment is loaded byte-for-byte from the frozen full regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {webkit}=await import('playwright');
const source=fs.readFileSync('scripts/cosmetic_regression_smoke.mjs','utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),'af0c890e60330d9f6fb07e8820b1c300ce18090aea6d40fa5c6baa8bde60f93f','Diagnostic runs the exact failed full-suite source');
const start=source.indexOf('    {\n      let requestCount = 0;');
const stop=source.indexOf('\n    {',start+1);
assert.ok(start>0&&stop>start);
const originalCase=source.slice(start,stop);
assert.equal((originalCase.match(/await page\.locator\('#submitButton'\)\.click\(\);/g)||[]).length,2);
assert.equal((originalCase.match(/timeout: 5000/g)||[]).length,2);
const base=process.env.SITE_BASE||'http://127.0.0.1:8080',origin=new URL(base).origin;
const out=process.env.CONNECT_DIAGNOSTIC_OUT||'output/connect-native-diagnostic';fs.mkdirSync(out,{recursive:true});
const evidence={scope:'Single exact original WebKit Connect429/native retry case; mocked endpoints only; diagnostic observation is not cause proof by itself.',sourceSha256:createHash('sha256').update(source).digest('hex'),caseSha256:createHash('sha256').update(originalCase).digest('hex'),requests:[],responses:[],failures:[],pageErrors:[],nativeEvents:[],overflow:0};
const add=(key,value)=>{if(evidence[key].length<64)evidence[key].push(value);else evidence.overflow++;};
let currentPage;
async function newLocalPage(browser,options={}){
 const page=await browser.newPage({serviceWorkers:'block',...options});currentPage=page;
 page.on('request',request=>{if(/\/api\/(health|connect\/send)$/.test(new URL(request.url()).pathname))add('requests',{url:request.url(),method:request.method(),at:Date.now()});});
 page.on('response',response=>{if(/\/api\/(health|connect\/send)$/.test(new URL(response.url()).pathname))add('responses',{url:response.url(),status:response.status(),at:Date.now()});});
 page.on('requestfailed',request=>{if(/\/api\/(health|connect\/send)$/.test(new URL(request.url()).pathname))add('failures',{url:request.url(),failure:request.failure(),at:Date.now()});});
 page.on('pageerror',error=>add('pageErrors',String(error).slice(0,1000)));
 page.on('console',message=>{if(message.text().startsWith('CONNECT_NATIVE_EVENT ')){try{add('nativeEvents',JSON.parse(message.text().slice('CONNECT_NATIVE_EVENT '.length)));}catch{add('pageErrors','Could not parse bounded passive event');}}});
 await page.addInitScript(()=>{
  let count=0;
  function snapshot(event,phase){
   if(count++>=48)return;
   const button=document.querySelector('#submitButton'),consent=document.querySelector('#privacyConsent'),step1=document.querySelector('#cnStep1'),step2=document.querySelector('#cnStep2');
   const box=button?.getBoundingClientRect();
   const target=event.target instanceof Element?event.target:null;
   const hit=typeof event.clientX==='number'?document.elementFromPoint(event.clientX,event.clientY):null;
   const row={type:event.type,phase,time:performance.now(),trusted:event.isTrusted,defaultPrevented:event.defaultPrevented,target:target?{tag:target.tagName,id:target.id,className:String(target.className).slice(0,150)}:null,hit:hit?{tag:hit.tagName,id:hit.id,className:String(hit.className).slice(0,150)}:null,x:event.clientX,y:event.clientY,scrollY,active:document.activeElement?.id||'',step1Hidden:step1?.hidden,step2Hidden:step2?.hidden,consent:consent?{checked:consent.checked,valid:consent.validity.valid}:null,submit:button?{disabled:button.disabled,text:button.textContent.trim(),box:box?.toJSON()}:null};
   if(event.type==='invalid'&&target)row.invalid={id:target.id,message:target.validationMessage,validity:{valueMissing:target.validity.valueMissing,typeMismatch:target.validity.typeMismatch,patternMismatch:target.validity.patternMismatch}};
   console.log('CONNECT_NATIVE_EVENT '+JSON.stringify(row));
  }
  for(const type of ['click','submit','invalid','change'])document.addEventListener(type,event=>snapshot(event,'capture'),{capture:true,passive:true});
  document.addEventListener('submit',event=>snapshot(event,'bubble'),{passive:true});
 });
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))await route.continue();else await route.abort();});
 return page;
}
const cameraStart=source.indexOf('async function captureConnectConsentFailure('),cameraStop=source.indexOf('\nfor (const [browserName, browserType]',cameraStart);
const captureConnectConsentFailure=new Function('fs','path','createHash',source.slice(cameraStart,cameraStop)+';return captureConnectConsentFailure;')(fs,path,createHash);
const browser=await webkit.launch({headless:true});
try{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('browser','newLocalPage','base','captureConnectConsentFailure','browserName','out','assert',originalCase)(browser,newLocalPage,base,captureConnectConsentFailure,'webkit',out,assert);
 evidence.result='PASS';
}catch(originalError){
 evidence.result='FAIL';evidence.originalError={name:originalError.name,message:originalError.message};
 try{evidence.failureDOM=await Promise.race([currentPage.evaluate(()=>{
  const box=node=>node?.getBoundingClientRect().toJSON()||null;
  const summary=selector=>{const node=document.querySelector(selector);if(!node)return null;const rect=node.getBoundingClientRect(),style=getComputedStyle(node),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return{tag:node.tagName,id:node.id,hidden:node.hidden,disabled:node.disabled,checked:node.checked,text:node.textContent.trim().slice(0,500),className:String(node.className),box:rect.toJSON(),display:style.display,visibility:style.visibility,opacity:style.opacity,transform:style.transform,hit:hit?{tag:hit.tagName,id:hit.id,className:String(hit.className).slice(0,150)}:null};};
  return{url:location.href,scrollY,innerWidth,innerHeight,activeElement:{id:document.activeElement?.id,tag:document.activeElement?.tagName},step1:summary('#cnStep1'),step2:summary('#cnStep2'),consent:summary('#privacyConsent'),submit:summary('#submitButton'),status:summary('#statusNote'),confirmation:summary('#confirmationScreen'),invalid:[...document.querySelectorAll('#connectForm :invalid')].map(node=>({tag:node.tagName,id:node.id,message:node.validationMessage})),transport:typeof window.MondermanContactTransport?.submit};
 }),new Promise(resolve=>setTimeout(()=>resolve({unavailableWithinMs:2000}),2000))]);}catch(error){evidence.cameraError=String(error);}
 try{await currentPage.screenshot({path:path.join(out,'failed-native-submit.png'),fullPage:false,timeout:2000});}catch(error){evidence.screenshotError=String(error);}
 throw originalError;
}finally{
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log('CONNECT_NATIVE_DIAGNOSTIC '+JSON.stringify(evidence));await browser.close();
}
