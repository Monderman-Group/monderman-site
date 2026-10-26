// Early current-only native audio checks. Existing global matrices stay intact.
// Run in CI against its genuine loopback candidate server, after the raw gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
import{chromium,webkit}from'playwright';
import{setTimeout as hostDelay}from'node:timers/promises';
import{setTimeout as hostSetTimeout,clearTimeout as hostClearTimeout}from'node:timers';
import{audioLayer}from'./article_audio_20261026_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),layer=audioLayer();
assert.equal(layer.sourceExact(),true,'Actual closed current narration source');
const built=path.resolve(process.env.ARTICLE_AUDIO_BUILD_ROOT||path.join(root,'.render-public'));
const channel=layer.channel(built);assert.equal(channel,'current','Native playback must use the actual current questionnaire edition');assert.equal(layer.publicExact(built,channel),true,'Actual complete current public edition');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'article-audio-manifest.json')));
assert.equal(manifest.status,'passed');assert.equal(manifest.articles.length,29);assert.equal(new Set(manifest.articles.map(a=>a.path)).size,29);
const entries=[...manifest.articles].sort((a,b)=>a.path.localeCompare(b.path));
const representatives=['divide-and-rule-inside-the-company.html','decision-velocity-article.html','the-culture-trap.html'].map(p=>{const a=entries.find(a=>a.path===p);assert.ok(a);return a;});
const base=(process.env.SITE_BASE_URL||process.env.SITE_BASE||'http://127.0.0.1:8080').replace(/\/$/,'');
const origin=new URL(base).origin;assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'CI loopback candidate only');
const output=path.resolve(process.env.ARTICLE_AUDIO_OUT||'/tmp/monderman-article-audio-smoke');fs.mkdirSync(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');let checks=0;const receipts=[],browserBuilds=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};const ok=(v,label)=>{assert.ok(v,label);checks++;};
const expectedMarker=JSON.parse(fs.readFileSync(path.join(built,'.well-known/monderman-release.json')));
const maxRecords=500;
async function setup(browser,{engine,scripts=true,width=390,reduced=false,missingAudio=null}={}){
 const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:scripts,reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:'block'});
 const evidence={engine,writes:[],external:[],apiReads:[],media:[],responses:[],errors:[],overflow:false};
 const put=(key,value)=>{if(evidence[key].length>=maxRecords)evidence.overflow=true;else evidence[key].push(value);};
 await context.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};});
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());
  if(!['GET','HEAD'].includes(q.method())){put('writes',{path:u.pathname,method:q.method()});return route.abort();}
  if(u.origin!==origin){put('external',u.origin);return route.abort();}
  if(u.pathname.startsWith('/api/')){put('apiReads',u.pathname);return route.abort();}
  if(missingAudio&&u.pathname==='/'+missingAudio)return route.fulfill({status:404,contentType:'text/plain',body:'MOCK missing narration for error presentation only'});
  return route.continue();
 });
 const page=await context.newPage();
 page.on('request',q=>{const u=new URL(q.url());if(u.pathname.startsWith('/assets/audio/'))put('media',{url:q.url(),path:u.pathname,method:q.method(),resourceType:q.resourceType()});});
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/assets/audio/'))put('responses',{url:r.url(),path:u.pathname,status:r.status(),mime:r.headers()['content-type']||''});});
 page.on('pageerror',e=>put('errors',String(e)));
 return{context,page,evidence};
}
async function audioState(page){return page.locator('[data-article-audio]').evaluate(section=>{
 const audio=section.querySelector('audio'),summary=section.querySelector('summary'),speed=section.querySelector('[data-audio-speed-controls]'),select=section.querySelector('[data-audio-speed]'),box=summary.getBoundingClientRect();
 return{sections:document.querySelectorAll('[data-article-audio]').length,open:section.open,summary:summary.textContent.replace(/\s+/g,' ').trim(),preload:audio.preload,autoplay:audio.autoplay,controls:audio.controls,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null,error:audio.error?{code:audio.error.code,message:audio.error.message}:null,src:audio.querySelector('source').getAttribute('src'),type:audio.querySelector('source').getAttribute('type'),label:audio.getAttribute('aria-label'),speedHidden:speed.hidden,speedDisplay:getComputedStyle(speed).display,speed:select.value,playbackRate:audio.playbackRate,canAAC:audio.canPlayType('audio/mp4; codecs="mp4a.40.2"'),box:{x:box.x,y:box.y,width:box.width,height:box.height},viewport:document.documentElement.clientWidth,focusTag:document.activeElement?.tagName,disclosureTransition:getComputedStyle(section.querySelector('.mond-article-audio__chevron')).transitionDuration};
 });}
// Closed arrival windows: API status0 is not an HTTP response or measured wire bytes.
const arrivalWindows=[],httpLogPath=process.env.ARTICLE_AUDIO_HTTP_LOG;
assert.ok(httpLogPath&&path.isAbsolute(httpLogPath),'Explicit existing loopback HTTP log is required');
const maxLogPrefixBytes=16*1024*1024,maxLogSliceBytes=1024*1024;
function readLogBytes(fd,start,length){
 const bytes=Buffer.alloc(length);let n=0;
 while(n<length){const got=fs.readSync(fd,bytes,n,length-n,start+n);assert.ok(got>0,'Complete HTTP log range is readable');n+=got;}
 return bytes;
}
function beginOriginLogWindow(){
 const link=fs.lstatSync(httpLogPath);assert.ok(link.isFile()&&!link.isSymbolicLink(),'Origin log is a regular non-symlink file');
 const fd=fs.openSync(httpLogPath,'r');let closed=false;
 const close=()=>{if(!closed){closed=true;fs.closeSync(fd);}};
 try{
  const stat=fs.fstatSync(fd);assert.ok(stat.isFile()&&stat.dev===link.dev&&stat.ino===link.ino,'Opened exact origin log identity');assert.ok(stat.size<=maxLogPrefixBytes,'Complete origin log prefix fits its bound');
  const prefix=readLogBytes(fd,0,stat.size);assert.ok(prefix.length===0||prefix.at(-1)===10,'Start offset is a complete log-line boundary');
  const start={device:stat.dev,inode:stat.ino,offset:stat.size,prefix_sha256:sha(prefix),capturedAt:new Date().toISOString(),capturedMonotonicMs:performance.now(),beforeNavigation:true};
  return{start,close,finish(){
   const end=fs.fstatSync(fd),current=fs.lstatSync(httpLogPath);assert.ok(end.isFile()&&current.isFile()&&!current.isSymbolicLink()&&end.dev===start.device&&end.ino===start.inode&&current.dev===end.dev&&current.ino===end.ino,'Origin log identity is unchanged');
   assert.ok(end.size>=start.offset&&end.size-start.offset<=maxLogSliceBytes,'Complete origin log slice fits its bound; no truncation');eq(sha(readLogBytes(fd,0,start.offset)),start.prefix_sha256,'Origin log prefix was neither replaced nor rewritten');
   const bytes=readLogBytes(fd,start.offset,end.size-start.offset);assert.ok(bytes.length===0||bytes.at(-1)===10,'End offset is a complete log-line boundary');
   const verified=fs.fstatSync(fd);assert.ok(verified.size>=end.size&&verified.dev===end.dev&&verified.ino===end.ino,'Origin log was not truncated while reading');
   return{path:httpLogPath,start,end:{device:end.dev,inode:end.ino,offset:end.size,capturedAt:new Date().toISOString(),capturedMonotonicMs:performance.now()},bytes:bytes.length,sha256:sha(bytes),completeSliceBase64:bytes.toString('base64'),text:bytes.toString('utf8'),completeBoundedSlice:true};
  }};
 }catch(error){close();throw error;}
}
function originAudioRequests(log){
 const bytes=Buffer.from(log.completeSliceBase64,'base64');eq(bytes.length,log.bytes,'Full origin slice byte count');eq(sha(bytes),log.sha256,'Full origin slice digest');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);eq(text,log.text,'Full origin slice UTF-8 is exact');const audio=[];
 for(const line of text.split('\n').filter(Boolean)){
  const match=line.match(/^\S+ - - \[[^\]]+\] "([A-Z]+) ([^ ]+) HTTP\/\d\.\d" (\d{3}) (?:\d+|-)$/);assert.ok(match,'Every origin slice line has the expected complete HTTP access-log framing: '+line);
  const [,method,target,status]=match;const u=new URL(target,origin);let decoded;try{decoded=decodeURIComponent(u.pathname);}catch{assert.fail('Unknown encoded origin request path');}
  if(decoded.startsWith('/assets/audio/'))audio.push({method,target,status:Number(status),path:decoded});
 }
 return audio;
}
function assertDeferredWebKitEvents(data,entry){
 eq(data.overflow,false,'Complete bounded WebKit attempt census');eq(data.diagnosticErrors,[],'No unknown WebKit lifecycle records');eq(data.failed,[],'No failed or cancelled event is exempt');
 eq(data.responses.length,data.requests.length,'Every raw attempt has exactly one response');eq(data.finished.length,data.requests.length,'Every raw attempt finished with known reported metrics');
 eq(new Set(data.requests.map(q=>q.id)).size,data.requests.length,'Distinct raw attempt identifiers');
 const intended=new URL('/'+entry.audio_path,origin).href;
 for(const q of data.requests){
  eq(q.url,intended,'Only exact same-origin intended recording may have a deferred event');eq(q.method,'GET','Only native GET delegate events are exempt');eq(q.resourceType,'other','Only native other-resource delegate events are exempt');
  const responses=data.responses.filter(r=>r.id===q.id),finished=data.finished.filter(r=>r.id===q.id);eq(responses.length,1,'One correlated deferred response');eq(finished.length,1,'One correlated finished event');
  const r=responses[0],f=finished[0];eq(r.url,intended,'Exact correlated response URL');eq(r.status,0,'Only the synthetic non-HTTP status0 delegate is exempt');eq(r.reportedHeaders,{},'No reported HTTP response headers are exempt');
  eq(f.sizeStatus,'reported','Pending or unavailable metrics fail');ok(f.sizes&&Object.values(f.sizes).every(n=>Number.isSafeInteger(n)&&n>=0),'All API-reported counters must be known finite counts');eq(f.sizes.requestBodySize,0,'No reported request body');eq(f.sizes.responseBodySize,0,'API reports zero body; may be its fallback, not measured physical bytes');
 }
 return data.requests.length;
}
async function arrivalHttpGate(page,entry,evidence,navigate){
 const trace={engine:evidence.engine,article:entry.path,intendedAudioUrl:new URL('/'+entry.audio_path,origin).href,qualification:'Bounded pre-gesture arrival observation. WebKit API status0/reported body0 may be synthetic/fallback; neither is a measured wire-byte count. Origin access-log and actual HTTP responses are checked separately.'};
 arrivalWindows.push(trace);(evidence.arrivalWindows??=[]).push(trace);let log,observer;
 const rawStart=evidence.media.length,responseStart=evidence.responses.length;
 try{
  log=beginOriginLogWindow();trace.originStart=log.start;observer=evidence.engine==='webkit'?observeWebKitCensusMedia(page):null;
  await navigate();
  if(observer){const end=observer.beginWindow();await hostDelay(Math.max(0,end-performance.now()));trace.browserLifecycle=observer.stop();}else await page.waitForTimeout(100);
  trace.originLog=log.finish();trace.originAudioRequests=originAudioRequests(trace.originLog);eq(trace.originAudioRequests,[],'No origin audio GET/HEAD or other audio request in the complete arrival slice');
  trace.rawAttempts=evidence.media.slice(rawStart);trace.reportedResponses=evidence.responses.slice(responseStart);trace.actualHttpResponses=trace.reportedResponses.filter(r=>r.status>=100);
  eq(trace.actualHttpResponses,[],'No actual HTTP media response before a user gesture');
  if(evidence.engine==='webkit'){
   trace.deferredNonHttpEventCount=assertDeferredWebKitEvents(trace.browserLifecycle,entry);eq(trace.rawAttempts.length,trace.browserLifecycle.requests.length,'Every raw attempt is retained and correlated');eq(trace.reportedResponses.length,trace.browserLifecycle.responses.length,'Every reported media response is retained and correlated');
  }else{eq(evidence.media,[],'No audio GET before a user playback gesture');trace.deferredNonHttpEventCount=0;}
  trace.rawAttemptCount=trace.rawAttempts.length;trace.originAudioRequestCount=trace.originAudioRequests.length;trace.actualHttpResponseCount=trace.actualHttpResponses.length;trace.status='PASS';
 }catch(error){trace.status='FAIL';trace.error=String(error).slice(0,4000);throw error;}finally{observer?.stop();log?.close();}
}

async function arrive(page,entry,evidence){
 await arrivalHttpGate(page,entry,evidence,()=>page.goto(base+'/'+entry.path,{waitUntil:'load',timeout:30000}));
 const s=await audioState(page);eq(s.sections,1,'Exactly one actual player');eq(s.open,false,'Native disclosure starts closed');eq(s.src,entry.audio_path,'Exact article-to-recording mapping');eq(s.type,'audio/mp4','AAC container MIME');eq(s.label,'Listen to '+entry.title,'Actual accessible article name');eq(s.preload,'none','No media preload');eq(s.autoplay,false,'No autoplay');eq(s.controls,true,'Native browser controls remain');eq(s.paused,true,'Starts paused');eq(s.currentTime,0,'Starts at the beginning');eq(s.error,null,'No initial media error');ok(s.canAAC.length>0,'Required AAC-LC capability; unsupported codec fails this lane');ok(s.box.height>=44,'Disclosure has at least44px touch target');ok(s.box.x>=-1&&s.box.x+s.box.width<=s.viewport+1,'Compact disclosure stays in viewport');ok(s.summary.includes('Listen')&&s.summary.includes('AI narration'),'Visible discrete Listen/AI label');return s;
}
async function noJsHostDeadline(work,timeout,label){
 let timer;const expired=new Promise((_,reject)=>{timer=hostSetTimeout(()=>reject(new Error('No-JS '+label+' exceeded '+timeout+'ms host deadline')),timeout);});
 try{return await Promise.race([work(),expired]);}finally{hostClearTimeout(timer);}
}
async function readNoJsMedia(page,timeout){
 return noJsHostDeadline(()=>page.locator('[data-article-audio] audio').evaluate(a=>({paused:a.paused,currentTime:a.currentTime,duration:Number.isFinite(a.duration)?a.duration:null,error:a.error?{code:a.error.code,message:a.error.message.slice(0,500)}:null,readyState:a.readyState,networkState:a.networkState,currentSrc:a.currentSrc.slice(0,1000),controls:a.controls,preload:a.preload}),undefined,{timeout}),timeout,'media inspection');
}
async function waitForNoJsMedia(page,predicate,timeout,label){
 const deadline=performance.now()+timeout;let last=null;
 while(performance.now()<deadline){
  const remaining=Math.max(1,Math.floor(deadline-performance.now()));
  last=await readNoJsMedia(page,remaining);
  if(performance.now()>=deadline)break;
  if(predicate(last))return last;
  const left=deadline-performance.now();if(left>0)await hostDelay(Math.min(50,left));
 }
 throw new Error('No-JS native '+label+' did not meet the real media predicate within '+timeout+'ms: '+JSON.stringify(last));
}
async function recordNoJsFailure(test,label,error){
 try{
  await noJsHostDeadline(()=>test.page.screenshot({path:path.join(output,label+'-FAIL.png'),fullPage:false,timeout:2000}),2000,'failure screenshot').catch(()=>{});
  const state=await readNoJsMedia(test.page,2000).catch(()=>null);
  fs.writeFileSync(path.join(output,label+'-FAIL.json'),JSON.stringify({error:String(error).slice(0,4000),observer:'host-timer-synchronous-inspector',scriptsEnabled:false,state,evidence:test.evidence},null,2)+'\n');
 }finally{await test.context.close();}
}
async function nativePlay(page,entry,evidence,{scripts=true}={}){
 const audio=page.locator('[data-article-audio] audio');
 await audio.focus();await page.keyboard.press('Space');
 if(scripts)await page.waitForFunction(()=>{const a=document.querySelector('[data-article-audio] audio');return a&&!a.paused&&a.currentTime>0.15&&!a.error;},null,{timeout:10000});
 else await waitForNoJsMedia(page,s=>!s.paused&&s.currentTime>0.15&&!s.error,10000,'playback');
 const playing=await audioState(page);ok(playing.currentTime>0.15&&!playing.paused,'Native keyboard playback advances actual media');eq(playing.error,null,'Actual AAC decodes without media error');ok(playing.canAAC.length>0,'Browser advertises AAC support');
 const observed=evidence.media.filter(r=>r.path==='/'+entry.audio_path);ok(observed.length>0,'Actual browser requested this recording');ok(evidence.media.every(r=>r.path==='/'+entry.audio_path&&r.method==='GET'),'No other recording or media write requested');ok(evidence.responses.some(r=>r.path==='/'+entry.audio_path&&[200,206].includes(r.status)&&/^audio\/(?:mp4|x-m4a|aac)(?:;|$)/i.test(r.mime)),'Actual native media response has a supported audio MIME/status');
 await page.keyboard.press('Space');if(scripts)await page.waitForFunction(()=>document.querySelector('[data-article-audio] audio')?.paused,null,{timeout:3000});else await waitForNoJsMedia(page,s=>s.paused,3000,'pause');eq((await audioState(page)).paused,true,'Native keyboard pause works');return playing;
}
async function finish(context,page,evidence,label){
 eq(evidence.writes,[],label+': no application writes attempted');eq(evidence.overflow,false,label+': diagnostics bounded without lost records');
 await page.screenshot({path:path.join(output,label+'.png'),fullPage:false});
 const state=await audioState(page);receipts.push({label,state,evidence});await context.close();
}
async function recordJsFailure(test,label,error){
 try{
  await noJsHostDeadline(()=>test.page.screenshot({path:path.join(output,label+'-FAIL.png'),fullPage:false,timeout:2000}),2000,'failure screenshot').catch(()=>{});
  const state=await readNoJsMedia(test.page,2000).catch(()=>null);
  fs.writeFileSync(path.join(output,label+'-FAIL.json'),JSON.stringify({error:String(error).slice(0,4000),observer:'synchronous-inspector-js-enabled',scriptsEnabled:true,state,evidence:test.evidence},null,2)+'\n');
 }finally{await test.context.close();}
}
function observeWebKitCensusMedia(page){
 const installed=performance.now(),requests=new Map();let deadline=Infinity,stopped=false,frozen=null;
 const data={requests:[],responses:[],finished:[],failed:[],diagnosticErrors:[],overflow:false};
 const accepts=()=>!stopped&&performance.now()<=deadline;
 const put=(key,value)=>{if(!accepts())return false;if(data[key].length>=maxRecords){data.overflow=true;return false;}data[key].push(value);return true;};
 const id=q=>{if(requests.has(q))return requests.get(q);if(requests.size>=maxRecords){data.overflow=true;return null;}const n=requests.size+1;requests.set(q,n);return n;};
 const audio=q=>new URL(q.url()).pathname.startsWith('/assets/audio/');
 const stamp=()=>Math.round((performance.now()-installed)*1000)/1000;
 const guard=fn=>(...args)=>{try{fn(...args);}catch(error){put('diagnosticErrors',String(error).slice(0,1000));}};
 const onRequest=guard(q=>{if(!audio(q))return;const n=id(q);if(n===null)return;const h=q.headers();put('requests',{id:n,atMs:stamp(),url:q.url().slice(0,1200),method:q.method(),resourceType:q.resourceType(),reportedRange:h.range?.slice(0,200)??null,rangePresentInReportedHeaders:Object.hasOwn(h,'range')});});
 const onResponse=guard(r=>{const q=r.request();if(!audio(q))return;const n=id(q);if(n===null)return;const h=r.headers();if(Buffer.byteLength(JSON.stringify(h),'utf8')>8192){data.overflow=true;return;}put('responses',{id:n,atMs:stamp(),url:r.url().slice(0,1200),status:r.status(),reportedHeaders:h,mime:h['content-type']?.slice(0,200)??null,contentRange:h['content-range']?.slice(0,200)??null,contentLength:h['content-length']?.slice(0,100)??null});});
 const onFinished=guard(q=>{
  if(!audio(q)||!accepts())return;const n=id(q);if(n===null)return;
  const row={id:n,atMs:stamp(),sizes:null,sizeStatus:'pending'};if(!put('finished',row))return;
  const limit=Math.max(1,Math.min(1000,Math.floor(deadline-performance.now())));
  noJsHostDeadline(()=>q.sizes(),limit,'passive finished-request sizes').then(s=>{if(accepts()){row.sizes=Object.fromEntries(['requestBodySize','requestHeadersSize','responseBodySize','responseHeadersSize'].map(k=>[k,typeof s[k]==='number'?s[k]:null]));row.sizeStatus='reported';}},error=>{if(accepts()){row.sizeStatus='unavailable';row.sizeError=String(error).slice(0,500);}});
 });
 const onFailed=guard(q=>{if(!audio(q))return;const n=id(q);if(n!==null)put('failed',{id:n,atMs:stamp(),url:q.url().slice(0,1200),errorText:q.failure()?.errorText?.slice(0,1000)??null});});
 page.on('request',onRequest);page.on('response',onResponse);page.on('requestfinished',onFinished);page.on('requestfailed',onFailed);
 return{
  beginWindow(){const start=performance.now();deadline=start+2000;data.window={requestedMs:2000,startOffsetMs:start-installed,eventCutoffOffsetMs:deadline-installed};return deadline;},
  stop(){if(frozen)return frozen;stopped=true;page.off('request',onRequest);page.off('response',onResponse);page.off('requestfinished',onFinished);page.off('requestfailed',onFailed);for(const row of data.finished)if(row.sizeStatus==='pending')row.sizeStatus='unavailable-at-observation-cutoff';if(data.window)data.window.freezeCalledOffsetMs=performance.now()-installed;frozen=structuredClone(data);requests.clear();return frozen;}
 };
}
async function recordWebKitCensusFailure(test,entry,error,observer){
 try{
  const end=observer.beginWindow();await hostDelay(Math.max(0,end-performance.now()));
  const passive=observer.stop(); // Freeze before inspection/screenshot and teardown.
  const stateWork=noJsHostDeadline(()=>test.page.locator('[data-article-audio] audio').evaluate(a=>({paused:a.paused,currentTime:a.currentTime,duration:Number.isFinite(a.duration)?a.duration:null,networkState:a.networkState,readyState:a.readyState,preload:a.preload,autoplay:a.autoplay,controls:a.controls,elementSrc:a.getAttribute('src')?.slice(0,1000)??null,sourceSrc:a.querySelector('source')?.getAttribute('src')?.slice(0,1000)??null,currentSrc:a.currentSrc.slice(0,1000),error:a.error?{code:a.error.code,message:a.error.message.slice(0,500)}:null}),undefined,{timeout:2000}),2000,'census failure state').then(value=>({available:true,value}),failure=>({available:false,error:String(failure).slice(0,1000)}));
  const cameraWork=noJsHostDeadline(()=>test.page.screenshot({path:path.join(output,'webkit-nojs-census-FAIL.png'),fullPage:false,timeout:2000}),2000,'census failure screenshot').then(()=>({available:true}),failure=>({available:false,error:String(failure).slice(0,1000)}));
  const [state,camera]=await Promise.all([stateWork,cameraWork]);
  fs.writeFileSync(path.join(output,'webkit-nojs-census-FAIL.json'),JSON.stringify({error:String(error).slice(0,4000),scriptsEnabled:false,localBuildMarker:expectedMarker,channel,browserBuilds,entry:{path:entry.path,audio_path:entry.audio_path,expectedAudioBytes:entry.bytes},passive,state,camera,evidence:test.evidence,qualification:'Passive lifecycle only; no playback, body read or additional GET. Pending sizes are unavailable; API body0 can be a fallback and is not measured physical bytes. Local marker is not a separately fetched served marker.'},null,2)+'\n');
 }finally{observer.stop();await test.context.close();}
}
const nativeBrowsers=[{engine:'chromium',type:chromium,channel:'chrome'},{engine:'webkit',type:webkit,channel:null}];
for(const{engine,type,channel:browserChannel}of nativeBrowsers){
 eq(browserChannel,engine==='chromium'?'chrome':null,'Chromium must use official Chrome stable; no codec fallback');
 const browser=await type.launch({headless:true,...(browserChannel?{channel:browserChannel}:{})});
 eq(type.name(),engine,'Actual requested browser engine');browserBuilds.push({engine:type.name(),channel:browserChannel||'playwright-webkit',version:browser.version()});
 try{
  // All29 current mappings in both engines with JS disabled. No recordings fetched.
  const census=await setup(browser,{engine,scripts:false,width:390}),passive=engine==='webkit'?observeWebKitCensusMedia(census.page):null;
  for(const entry of entries){let s;try{s=await arrive(census.page,entry,census.evidence);}catch(error){if(passive){try{await recordWebKitCensusFailure(census,entry,error,passive);}finally{throw error;}}throw error;}eq(s.speedHidden,true,'No inert custom speed control without scripts');eq(s.speedDisplay,'none','No-JS speed controls are visually hidden');}
  if(engine==='chromium')eq(census.evidence.media,[],engine+': all29 visits performed without prefetching audio');else{eq(census.evidence.arrivalWindows.length,29,'All29 bounded WebKit origin windows');eq(census.evidence.arrivalWindows.every(w=>w.status==='PASS'),true,'All WebKit windows admitted individually');eq(census.evidence.media.length,census.evidence.arrivalWindows.reduce((n,w)=>n+w.deferredNonHttpEventCount,0),'Every raw WebKit census attempt is accounted for as a correlated non-HTTP delegate');}eq(census.evidence.writes,[],engine+': no-JS census has no writes');eq(census.evidence.overflow,false,engine+': bounded census diagnostics');receipts.push({label:engine+'-all29-nojs-census',pages:entries.map(a=>a.path),evidence:census.evidence});passive?.stop();await census.context.close();
  // A long essay, a guide with authored sidebar, and the custom evidence summary.
  for(const width of[320,1440])for(const entry of representatives){
   const label=engine+'-'+width+'-'+path.basename(entry.path,'.html'),test=await setup(browser,{engine,width,reduced:width===320});
   try{
    const initial=await arrive(test.page,entry,test.evidence);eq(initial.speedHidden,false,'Script attaches before revealing speed');
    const summary=test.page.locator('[data-article-audio] > summary');await summary.scrollIntoViewIfNeeded();await summary.focus();await test.page.keyboard.press('Enter');eq((await audioState(test.page)).open,true,'Enter opens native disclosure');await test.page.keyboard.press('Space');eq((await audioState(test.page)).open,false,'Space closes native disclosure');await test.page.keyboard.press('Enter');eq((await audioState(test.page)).open,true,'Enter reopens native disclosure');
    const played=await nativePlay(test.page,entry,test.evidence);ok(Math.abs(played.duration-entry.duration_seconds)<1,'Decoded browser duration matches reviewed recording');
    await test.page.locator('[data-article-audio] [data-audio-speed]').selectOption('1.25');eq((await audioState(test.page)).playbackRate,1.25,'Selected speed changes the real native player');
    const download=test.page.locator('.mond-article-audio__options a[download]');ok(await download.isVisible(),'Direct download remains visible');eq(await download.getAttribute('href'),entry.audio_path,'Direct fallback links to exact recording');
    await test.page.emulateMedia({media:'print'});eq(await test.page.locator('[data-article-audio]').evaluate(e=>getComputedStyle(e).display),'none','Player is absent from print');await test.page.emulateMedia({media:'screen'});
    if(width===320)eq((await audioState(test.page)).disclosureTransition,'0s','Reduced motion removes caret animation');
    await finish(test.context,test.page,test.evidence,label);
   }catch(error){await test.page.screenshot({path:path.join(output,label+'-FAIL.png'),fullPage:false}).catch(()=>{});fs.writeFileSync(path.join(output,label+'-FAIL.json'),JSON.stringify({error:String(error),state:await audioState(test.page).catch(()=>null),evidence:test.evidence},null,2)+'\n');await test.context.close();throw error;}
  }
  // Native controls and direct download still work with JavaScript disabled.
  const entry=representatives[1],plain=await setup(browser,{engine,scripts:false,width:390});
  try{await arrive(plain.page,entry,plain.evidence);const summary=plain.page.locator('[data-article-audio] > summary');await summary.focus();await plain.page.keyboard.press('Enter');eq((await audioState(plain.page)).open,true,'No-JS disclosure is keyboard operable');await nativePlay(plain.page,entry,plain.evidence,{scripts:false});eq((await audioState(plain.page)).speedDisplay,'none','No-JS avoids a dead speed widget');ok(await plain.page.locator('.mond-article-audio__options a[download]').isVisible(),'No-JS direct download visible');await finish(plain.context,plain.page,plain.evidence,engine+'-nojs-native-playback');}
  catch(error){try{await recordNoJsFailure(plain,engine+'-nojs-native-playback',error);}finally{throw error;}}
  // A targeted404 is a MOCK failure only; every success state above uses real media.
  const broken=await setup(browser,{engine,width:390,missingAudio:entry.audio_path});
  try{
   await arrive(broken.page,entry,broken.evidence);
   const target404=broken.page.waitForResponse(r=>{const u=new URL(r.url());return u.origin===origin&&u.pathname==='/'+entry.audio_path&&r.request().method()==='GET'&&r.status()===404;},{timeout:10000});target404.catch(()=>{});
   await broken.page.locator('[data-article-audio] > summary').click();const a=broken.page.locator('[data-article-audio] audio');await a.focus();await broken.page.keyboard.press('Space');
   await Promise.all([target404,broken.page.waitForFunction(()=>{const a=document.querySelector('[data-article-audio] audio');return a&&(a.error||a.networkState===a.NETWORK_NO_SOURCE);},null,{timeout:10000})]);
   ok(broken.evidence.responses.some(r=>{const u=new URL(r.url);return u.origin===origin&&r.path==='/'+entry.audio_path&&r.status===404;}),'MOCK404 browser observed the exact target404 response');
   const error=broken.page.locator('[data-audio-error]');await error.waitFor({state:'visible',timeout:3000});eq(await error.textContent(),'The recording could not load. You can try the download link.','404 yields truthful visible fallback');ok(await broken.page.locator('.mond-article-audio__options a[download]').isVisible(),'404 keeps direct fallback reachable');await finish(broken.context,broken.page,broken.evidence,engine+'-MOCK404-fallback');
  }catch(error){try{await recordJsFailure(broken,engine+'-MOCK404-fallback',error);}finally{throw error;}}
 }finally{await browser.close();}
}
// Bind the served candidate revision and representative successful response bytes.
const api=await chromium.launch({headless:true,channel:'chrome'});try{const page=await api.newPage();const marker=await page.request.get(base+'/.well-known/monderman-release.json');eq(marker.status(),200,'Served candidate marker');eq(await marker.json(),expectedMarker,'Served candidate is the actual checked revision');for(const a of representatives){const response=await page.request.get(base+'/'+a.audio_path);eq(response.status(),200,'Actual representative complete audio GET');const b=await response.body();eq(b.length,a.bytes,'Actual served media size');eq(sha(b),a.audio_sha256,'Actual served complete bytes equal reviewed asset');}}finally{await api.close();}
assert.equal(layer.sourceExact(),true,'Browser tests did not mutate frozen source');assert.equal(layer.publicExact(built,channel),true,'Browser tests did not mutate checked public artifact');
const result={status:'PASS',checkedAt:new Date().toISOString(),revision:expectedMarker.revision,channel,checks,engines:['chromium','webkit'],browserBuilds,censusPagesPerEngine:29,representativePlaybackStates:12,noJsPlaybackStates:2,mockedMissingAudioStates:2,preGestureArrivalObservation:{rawAttemptCount:arrivalWindows.reduce((n,w)=>n+w.rawAttemptCount,0),deferredNonHttpEventCount:arrivalWindows.reduce((n,w)=>n+w.deferredNonHttpEventCount,0),originAudioRequestCount:arrivalWindows.reduce((n,w)=>n+w.originAudioRequestCount,0),actualHttpMediaResponseCount:arrivalWindows.reduce((n,w)=>n+w.actualHttpResponseCount,0),webkitObservationMs:2000,chromeObservationMs:100,qualification:'Counts cover complete bounded arrival windows before gestures; API status0/reported body0 are synthetic or fallback metrics, not measured physical byte counts.',windows:arrivalWindows},providerCalls:0,actualUserRecordsTouched:false,receipts};fs.writeFileSync(path.join(output,'RECEIPT.json'),JSON.stringify(result,null,2)+'\n');console.log('ARTICLE_AUDIO_BROWSER_PASS '+JSON.stringify({checks,browserBuilds,censusPagesPerEngine:29,representativePlaybackStates:12,noJsPlaybackStates:2,mockedMissingAudioStates:2,output}));
