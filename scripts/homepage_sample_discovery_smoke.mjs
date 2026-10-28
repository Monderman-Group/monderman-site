import {historicalScopeBetaBrowserBodiesAtRelease as historicalScopeBetaBrowserBodies,isCurrentHomepageRefinementSourceAtRelease as isCurrentHomepageRefinementSource} from './companies_culture_release_20261028_contract.mjs';
// Authored for a separately authorized browser run; this script is not an
// offline contract check. Set SITE_BASE to a server serving this checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';


// Every old physical assertion runs on its exact approved f2a edition; the separate Scope matrix certifies current layout.
const scopeHistoricalBodies=historicalScopeBetaBrowserBodies(decodeURIComponent(new URL('../.render-public/',import.meta.url).pathname));
const scopeHistoricalResponse=route=>{const u=new URL(route.request().url()),b=scopeHistoricalBodies.get(u.pathname);assert.ok(b,'Exact compiled historical input');return route.fulfill({status:200,contentType:u.pathname.endsWith('.pdf')?'application/pdf':u.pathname.endsWith('.png')?'image/png':u.pathname.endsWith('.webp')?'image/webp':u.pathname.endsWith('.jpg')?'image/jpeg':u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.json')?'application/json':'application/javascript',body:b});};
if(scopeHistoricalBodies.size)console.log('SCOPE_PRESERVED_PHYSICAL_EDITION f2a81afdd30863c68b4ae748936163a141b0edd6 '+scopeHistoricalBodies.size+' exact compiled bodies');
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE||'http://127.0.0.1:4175';
const out=process.env.HOMEPAGE_DISCOVERY_OUT||fs.mkdtempSync('/tmp/homepage-discovery-');
fs.mkdirSync(out,{recursive:true});
const refinementSource=fs.readFileSync(new URL('../index.html',import.meta.url));
const currentRefinement=isCurrentHomepageRefinementSource(refinementSource);
assert.ok(!refinementSource.toString().includes('homepage-refinement.js?v=20261014.1')||currentRefinement,'Only exact approved refined edition selects its native expansion checks');
async function expandRefinedHeroForOriginalChecks(page,enabled,label){
  if(!enabled)return;
  const report=page.locator('.hero [data-home-report-quad]'),details=report.locator('.hf-hero-details'),toggle=details.locator(':scope > summary');
  assert.equal(await details.count(),1,label+': exact native preview disclosure');
  assert.equal(await details.evaluate(el=>el.open),false,label+': initial compact state without deferred hiding');
  assert.equal(await report.locator('.hrq-tile:visible').count(),1,label+': default exposes finding only');
  assert.equal(await report.locator('.hrq-tile:visible').getAttribute('data-quad-section'),'findings',label+': exact visible default section');
  assert.equal(await report.locator('.hrq-footer>a').getAttribute('href'),'sample-report.html#depth',label+': original full-report destination stays available');
  assert.equal(await toggle.isVisible(),true,label+': native summary works with or without scripts');
  assert.ok((await toggle.boundingBox()).height>=44,label+': native expansion is a usable touch target');
  await toggle.focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('.hero .hf-hero-details').open);
  assert.equal(await report.locator('.hrq-tile:visible').count(),4,label+': native expansion restores all four original sections');
  assert.equal(await details.locator('.hf-extra-grid > .hrq-tile').count(),3,label+': exact three additional native report roles');
}

// Own every navigation operation until settlement. Observability does not change
// the original assertions, inputs, operation deadlines or hosted failure history.
const navigationEventsPath=path.join(out,'NAVIGATION_EVENTS.jsonl');
const navigationEventsFd=fs.openSync(navigationEventsPath,'wx',0o600);
const navigationStarted=process.hrtime.bigint(),navigationTelemetryErrors=[],navigationTransactions=[];
const navigationError=error=>({name:error?.name,message:error?.message,stack:String(error?.stack||error)});
function navigationEvent(event){
  try{fs.writeFileSync(navigationEventsFd,JSON.stringify({atUTC:new Date().toISOString(),elapsedMs:Number(process.hrtime.bigint()-navigationStarted)/1e6,...event})+'\n');fs.fsyncSync(navigationEventsFd);}
  catch(error){navigationTelemetryErrors.push({phase:'event-persistence',error:navigationError(error)});}
}
function navigationArtifact(filename,value){
  let fd;try{fd=fs.openSync(path.join(out,filename),'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}
  catch(error){navigationTelemetryErrors.push({phase:filename,error:navigationError(error)});console.error('HOMEPAGE_NAVIGATION_ARTIFACT_ERROR '+JSON.stringify(navigationError(error)));}
  finally{if(fd!==undefined)try{fs.closeSync(fd);}catch(error){navigationTelemetryErrors.push({phase:filename+'-close',error:navigationError(error)});}}
}
function navigationValue(value){if(value===undefined)return{kind:'undefined'};if(value===null)return{kind:'null'};return{kind:value.constructor?.name||typeof value,url:typeof value.url==='function'?value.url():null,status:typeof value.status==='function'?value.status():null};}
async function ownNavigationOperations(operations,observe){
  let hasFirstRejection=false,firstRejection,hasObservationFailure=false,firstObservationFailure;
  const emit=event=>{try{observe(event);}catch(error){if(!hasObservationFailure){hasObservationFailure=true;firstObservationFailure=error;}}};
  const pending=operations.map(({operation,start})=>{
    emit({operation,status:'started'});
    let promise;try{promise=start();}catch(error){promise=Promise.reject(error);}
    return Promise.resolve(promise).then(value=>{emit({operation,status:'fulfilled',value});return value;},error=>{if(!hasFirstRejection){hasFirstRejection=true;firstRejection=error;}emit({operation,status:'rejected',error});throw error;});
  });
  const settled=await Promise.allSettled(pending);
  emit({status:'all-settled',settled});
  if(hasFirstRejection)throw firstRejection;
  if(hasObservationFailure)throw firstObservationFailure;
  return settled.map(result=>result.value);
}
process.once('exit',()=>{try{fs.fsyncSync(navigationEventsFd);fs.closeSync(navigationEventsFd);}catch(error){console.error('HOMEPAGE_NAVIGATION_LOG_CLOSE_ERROR '+JSON.stringify(navigationError(error)));if(!process.exitCode)process.exitCode=1;}});

let states=0;
let entryStates=0;
const entryViewports=[{width:375,height:667},{width:390,height:844},{width:1280,height:720}];
const entryGeometry=[];
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  let activeState={browser:name,phase:'engine-start'},activeDestination=null,activePage=null,engineFailed=false,originalEngineFailure;
  try{
    for(const width of [320,390,768,834,1440])for(const javaScriptEnabled of [false,true]){
      activeState={browser:name,phase:'geometry',width,height:1000,javaScriptEnabled};activeDestination=null;navigationEvent({kind:'state-start',state:activeState});
      const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled});activePage=page;
      // The public-page auth decoration is outside this navigation test.
      // Match the established homepage test's signed-out, memory-only fixture.
      await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};});
      await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();return scopeHistoricalBodies.has(u.pathname)?scopeHistoricalResponse(route):route.continue();});
      const failures=[];page.on('pageerror',error=>failures.push(error.message));
      await page.goto(base+'/index.html',{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      const hero=page.locator('.hero-actions .btn-secondary');
      const invitation=page.locator('.hero-invitation-link');
      const direct=page.locator('.hwd-footer .hwd-sample-link');
      const report=page.locator('.hero [data-home-report-quad]');
      assert.equal(await report.count(),1,'One report quad is in the hero');
      assert.equal(await report.isVisible(),true,name+'/'+width+': report quad is not hidden by legacy hero CSS');
      assert.equal(await page.locator('.hero [data-workspace-demo]').count(),0,'Interactive journey is not in the hero');
      assert.equal(await page.locator('#sample-output [data-workspace-demo]').count(),1,'Interactive journey is in the lower section');
      await expandRefinedHeroForOriginalChecks(page,currentRefinement,name+'/'+width);
      assert.equal(await report.locator('[data-preview-kind]').count(),2,'Money and time charts are both present');
      for(const chart of await report.locator('[data-preview-kind]').all())assert.equal(await chart.isVisible(),true,'Each hero chart is visible');
      const reportLink=report.locator('.hrq-footer>a');
      assert.equal(await reportLink.getAttribute('href'),'sample-report.html#depth');
      assert.ok((await reportLink.boundingBox()).height>=44,'Hero report link is a usable touch target');
      const geometry=await report.evaluate(el=>{
        const outer=el.getBoundingClientRect();
        const escaping=[...el.querySelectorAll('*')].filter(node=>{const r=node.getBoundingClientRect();return r.width&&r.height&&(r.left<outer.left-1||r.right>outer.right+1);}).map(node=>node.className?.baseVal??node.className);
        const tiles=[...el.querySelectorAll('.hrq-tile')].map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
        const overlaps=tiles.flatMap((a,i)=>tiles.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
        return {height:outer.height,cardWidth:outer.width,escaping,overlaps:overlaps.length};
      });
      assert.deepEqual(geometry.escaping,[],name+'/'+width+': hero report contents stay inside the card');
      assert.equal(geometry.overlaps,0,name+'/'+width+': report tiles do not overlap');
      console.log('HOMEPAGE_REPORT_FIRST_GEOMETRY '+JSON.stringify({browser:name,width,javaScriptEnabled,...geometry}));
      for(const link of [hero,direct]){
        assert.equal(await link.isVisible(),true,name+'/'+width+': sample link is visible on first load');
        assert.equal(await link.getAttribute('href'),link===direct?'sample-report.html#synthesis':'sample-report.html');
        assert.match(await link.innerText(),link===direct?/^Open sample report/:/^View sample reports/);
        const box=await link.boundingBox();assert.ok(box.height>=44,'Sample link has a usable touch target');
      }
      assert.equal(await page.locator('.hero-actions > a').count(),2,'The hero has exactly two buttons');
      assert.equal(await hero.evaluate(el=>el.previousElementSibling?.classList.contains('btn-accent')),true,'The sample button follows the request button');
      assert.equal(await page.locator('.hero-sample-link').count(),0,'The redundant standalone hero sample link is removed');
      assert.equal(await invitation.count(),1,'One invitation text link remains');
      assert.equal(await invitation.getAttribute('href'),'pattern-trial.html','Invitation activation destination stays untagged');
      assert.equal((await invitation.innerText()).replace(/\s+/g,' ').trim(),'Already invited? Activate your invitation →','Exact visible invited-user copy, independent of responsive wrapping');
      assert.equal(await invitation.evaluate(el=>el.previousElementSibling?.classList.contains('hero-access-note')),true,'Invitation activation follows the access note');
      assert.ok((await invitation.boundingBox()).height>=44,'Invitation text link has a usable touch target');
      assert.equal(await direct.evaluate(el=>el.closest('[role="tabpanel"]')===null),true,'Preview sample access is independent of the active step');
      if(javaScriptEnabled){
        for(const step of ['measure','analysis','actions','return']){
          await page.locator('#hwd-tab-'+step).click();
          assert.equal(await direct.isVisible(),true,'Direct sample access is visible in '+step);
        }
      }
      const primary=await page.locator('.hero-actions .btn-accent').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
      assert.deepEqual(primary,{background:'rgb(169, 208, 212)',color:'rgb(4, 24, 27)'});
      const secondary=await page.locator('.hero-actions .btn-secondary').evaluate(el=>getComputedStyle(el).borderTopColor);
      assert.equal(secondary,'rgb(230, 199, 101)');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No horizontal overflow');
      // Establish keyboard modality after the journey mouse clicks. Native
      // :focus-visible intentionally does not show a ring in mouse modality.
      await page.keyboard.press('Tab');await direct.focus();
      assert.equal(await direct.evaluate(el=>getComputedStyle(el).outlineStyle),'solid','Preview link has a keyboard focus ring');
      if(javaScriptEnabled)await page.screenshot({path:path.join(out,name+'-'+width+'-homepage.png'),fullPage:true});
      await page.keyboard.press('Enter');
      await page.waitForURL(url=>url.pathname.endsWith('/sample-report.html'));
      assert.deepEqual(failures,[]);
      await page.close();activePage=null;states++;navigationEvent({kind:'state-completed',state:activeState});
    }
    for(const viewport of entryViewports)for(const javaScriptEnabled of [false,true]){
      const label=name+'/'+viewport.width+'x'+viewport.height+'/'+(javaScriptEnabled?'scripts':'no-scripts');
      activeState={browser:name,phase:'entry',...viewport,javaScriptEnabled,label};activeDestination=null;navigationEvent({kind:'state-start',state:activeState});
      const page=await browser.newPage({viewport,javaScriptEnabled,reducedMotion:'reduce'});activePage=page;
      await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};});
      await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==new URL(base).origin)return route.abort();return scopeHistoricalBodies.has(u.pathname)?scopeHistoricalResponse(route):route.continue();});
      const failures=[];const collect=error=>failures.push(error.message);page.on('pageerror',collect);
      await page.goto(base+'/index.html',{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      const buttons=page.locator('.hero-actions > a');
      assert.equal(await buttons.count(),2,label+': exactly two hero buttons');
      assert.deepEqual(await buttons.evaluateAll(nodes=>nodes.map(el=>({text:el.textContent.trim(),href:el.getAttribute('href')}))),[
        {text:'Request an invitation',href:'pilot.html?source=homepage'},
        {text:'View sample reports',href:'sample-report.html'},
      ],label+': approved button order and destinations');
      const boxes=await buttons.evaluateAll(nodes=>nodes.map(el=>{
        const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,unobstructed:hit===el||el.contains(hit)};
      }));
      for(const box of boxes){
        assert.ok(box.width>0&&box.height>=44,label+': button touch target');
        assert.ok(box.left>=0&&box.right<=viewport.width+1,label+': button fully inside viewport width');
        if(javaScriptEnabled){
          assert.ok(box.top>=0&&box.bottom<=viewport.height,label+': button fully visible on first screen');
          assert.equal(box.unobstructed,true,label+': button center is clickable');
        }
      }
      assert.ok(Math.min(boxes[0].right,boxes[1].right)-Math.max(boxes[0].left,boxes[1].left)<=1||Math.min(boxes[0].bottom,boxes[1].bottom)-Math.max(boxes[0].top,boxes[1].top)<=1,label+': hero buttons do not overlap');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': no horizontal overflow');
      const invitation=page.locator('.hero-invitation-link');
      assert.equal(await invitation.count(),1,label+': one activation text link');
      assert.ok((await invitation.boundingBox()).height>=44,label+': activation touch target');
      await page.keyboard.press('Tab');await invitation.focus();
      assert.deepEqual(await invitation.evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth})),{style:'solid',width:'3px'},label+': activation has a visible keyboard focus outline');
      assert.deepEqual(failures,[],label+': homepage has no runtime errors');
      page.off('pageerror',collect);
      if(javaScriptEnabled){
        await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
        await page.screenshot({path:path.join(out,name+'-'+viewport.width+'x'+viewport.height+'-hero-entry.png')});
      }
      // Follow the real anchors to the local destination pages. Observe the
      // initial navigation request because activation may then require sign-in;
      // this test does not authenticate or activate an evaluation.
      const destinations=[
        {selector:'.hero-actions .btn-accent',path:'/pilot.html',query:'?source=homepage'},
        {selector:'.hero-actions .btn-secondary',path:'/sample-report.html',query:''},
        {selector:'.hero-invitation-link',path:'/pattern-trial.html',query:''},
      ];
      for(const destination of destinations){
        activeDestination=destination;navigationEvent({kind:'destination-home-start',state:activeState,destination,currentURL:page.url()});
        await page.goto(base+'/index.html',{waitUntil:'load'});
        navigationEvent({kind:'destination-home-loaded',state:activeState,destination,currentURL:page.url()});
        // 2026-10-13: finish each destination load before returning home;
        // observing its first request alone can leave navigation in flight.
        const transaction={state:activeState,destination,operations:[],allOperationsSettled:false};navigationTransactions.push(transaction);
        const [request,response]=await ownNavigationOperations([
          {operation:'waitForRequest',start:()=>page.waitForRequest(request=>request.isNavigationRequest()&&new URL(request.url()).pathname===destination.path)},
          {operation:'waitForNavigation',start:()=>page.waitForNavigation({waitUntil:'load'})},
          {operation:'click',start:()=>page.locator(destination.selector).click()},
        ],event=>{
          if(event.status==='all-settled'){transaction.allOperationsSettled=true;navigationEvent({kind:'transaction-all-settled',...transaction,currentURL:page.url()});return;}
          const operation=event.operation;
          let record=transaction.operations.find(record=>record.operation===operation);
          if(event.status==='started'){record={operation,status:'started',startedAtUTC:new Date().toISOString()};transaction.operations.push(record);}
          else Object.assign(record,{status:event.status,finishedAtUTC:new Date().toISOString(),...(event.status==='fulfilled'?{value:navigationValue(event.value)}:{error:navigationError(event.error)})});
          navigationEvent({kind:'operation-'+event.status,state:activeState,destination,...record,currentURL:page.url()});
        });
        assert.equal(navigationTelemetryErrors.length,0,'Navigation operation evidence is durably recorded');
        const url=new URL(request.url());
        assert.equal(url.origin,new URL(base).origin,label+': navigation stays local');
        assert.equal(url.pathname,destination.path,label+': clicked anchor reaches its approved destination');
        assert.equal(url.search,destination.query,label+': no new navigation parameters');
        assert.equal(url.hash,'',label+': no invitation or tracking capability is added');
        assert.ok(response,label+': clicked anchor completes a document navigation');
        assert.equal(response.status(),200,label+': completed destination response succeeds');
        assert.equal(new URL(response.url()).origin,new URL(base).origin,label+': completed destination remains local');
        assert.equal(await response.finished(),null,label+': destination response finishes successfully');
      }
      entryGeometry.push({browser:name,...viewport,javaScriptEnabled,buttons:boxes});
      await page.close();activePage=null;entryStates++;navigationEvent({kind:'state-completed',state:activeState});
    }
  }catch(error){
    engineFailed=true;originalEngineFailure=error;
    navigationEvent({kind:'original-engine-failure-before-cleanup',state:activeState,destination:activeDestination,currentURL:activePage?.url()||null,error:navigationError(error)});
    navigationArtifact(name+'-FAILURE_BEFORE_CLEANUP.json',{status:'FAILED_BEFORE_BROWSER_CLEANUP',state:activeState,destination:activeDestination,currentURL:activePage?.url()||null,error:navigationError(error),transactions:navigationTransactions,telemetryErrors:navigationTelemetryErrors,qualification:'All owned transaction operations have settled before this artifact. Failure cause is not inferred from the first rejected promise.'});
    throw error;
  }finally{
    navigationEvent({kind:'browser-close-start',browser:name,priorFailure:engineFailed});
    let cleanupFailed=false,cleanupError;
    try{await browser.close();navigationEvent({kind:'browser-close-fulfilled',browser:name});}
    catch(error){cleanupFailed=true;cleanupError=error;navigationEvent({kind:'browser-close-rejected',browser:name,error:navigationError(error)});}
    navigationArtifact(name+'-CLEANUP_RESULT.json',{browser:name,originalFailure:engineFailed?navigationError(originalEngineFailure):null,cleanupFailure:cleanupFailed?navigationError(cleanupError):null,telemetryErrors:navigationTelemetryErrors});
    if(cleanupFailed&&!engineFailed)throw cleanupError;
    if(engineFailed&&cleanupFailed)console.error('HOMEPAGE_BROWSER_CLEANUP_ERROR '+JSON.stringify(navigationError(cleanupError)));
  }
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=Object.fromEntries(['index.html','homepage-workspace-demo.css','scripts/templates/home-workspace-preview.html'].map(file=>[file,sha(fs.readFileSync(new URL('../'+file,import.meta.url)))]));
assert.equal(states,20,'All twenty existing browser states remain covered');
assert.equal(entryStates,12,'All twelve exact-viewport entry states are covered');
assert.equal(navigationTelemetryErrors.length,0,'All navigation and cleanup evidence is durably recorded');
const receipt={passed:true,states,entryStates,browsers:2,widths:[320,390,768,834,1440],entryViewports,entryGeometry,withAndWithoutJavaScript:true,source_files:sourceFiles};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('HOMEPAGE_SAMPLE_DISCOVERY_SMOKE '+JSON.stringify({...receipt,out}));
