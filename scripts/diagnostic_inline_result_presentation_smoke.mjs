// Actual built result entrypoints with saved fabricated/synthetic results.
// All service requests are intercepted; no admission, email, DB or model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const repo=path.resolve(import.meta.dirname,'..');
const root=path.resolve(process.env.INLINE_RESULT_BUILD||path.join(repo,'.render-public'));
const out=path.resolve(process.env.INLINE_RESULT_OUT||path.join(repo,'output/diagnostic-inline-result'));
fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(path.join(repo,'test-fixtures/os-inline-result-presentation.json')));
assert.equal(fixture.syntheticOnly,true);assert.equal(fixture.providerCalls,0);
assert.equal(fixture.result.score,84);assert.equal(fixture.result.band,'Light');
assert.deepEqual(fixture.result.intervention_priority_ladder.map(r=>r.priority),['Monitor','Monitor','Monitor']);
const others=JSON.parse(fs.readFileSync(path.join(repo,'test-fixtures/authenticated-report-engine-runs.json'))).outputs;
const specs=[['operational-systems.html','operational_systems'],['decision-velocity.html','decision_velocity'],['structural-clarity.html','structural_clarity'],['institutional-performance.html','institutional_performance']];
const source=Object.fromEntries(specs.map(([file])=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
const evidence={scope:'Built inline result presentation. Actual fabricated second OS84 result plus explicitly synthetic display variants and existing sibling fixtures; not new scoring or live E2E.',startedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')])),checks:[],failures:[],errors:[],blockedRequests:[],screenshots:[],providerCalls:0,productionWrites:0,passed:false};
function check(id,fn){try{fn();evidence.checks.push(id);}catch(e){evidence.failures.push({id,message:e.message});}}
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+u.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 let body=fs.readFileSync(file);
 if(source[u.pathname.slice(1)]){
  let html=body.toString().replace(/(<script[^>]*src="[^"]*(?:@supabase|chart\.js)[^>]*?) integrity="[^"]+"/g,'$1');
  const marker='function renderResults(result, payload, outputMode) {';
  assert.equal(html.split(marker).length,2);
  html=html.replace(marker,"queueMicrotask(()=>{window.__inlineResultTest={render(result,payload){state.result=result;state.renderPayload=payload;state.mode='executive';state.depth='10';state.runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';renderResults(result,payload);showStage(resultsStage);},priority:renderPriorityPath,full:buildFullReportHTML};});\n"+marker);
  body=Buffer.from(html);
 }
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const auth="window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};";
const gate="window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();";
const actualLadder=r=>Array.isArray(r.intervention_priority_ladder)?r.intervention_priority_ladder:(r.canonical_descriptor?.priority_ladder||[]);
try{
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
   await context.addInitScript({content:auth});
   await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gate});
    if(u.origin===base)return route.continue();
    evidence.blockedRequests.push({method:route.request().method(),host:u.hostname,path:u.pathname});
    if(u.pathname.includes('chart.js'))return route.fulfill({contentType:'application/javascript',body:'window.Chart=function(){return {destroy(){},update(){}}};'});
    if(u.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* local auth fixture */'});
    if(/monderman-api\.onrender\.com|api\.monderman\.com/.test(u.hostname))return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
    return route.abort();
   });
   for(const [file,tool] of specs){
    const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(engine+'/'+file+': '+e.message));
    await page.goto(base+'/'+file,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__inlineResultTest&&document.getElementById('pageLoader')?.classList.contains('hidden'));
    const seed=structuredClone(tool==='operational_systems'?fixture.result:others[tool].result);
    const payload={...(others[tool]?.input_context||{}),processName:'Fabricated supplier onboarding',participantMode:'operational',diagnostic_depth:10};
    const cases=[{id:'saved',result:seed}];
    // These variants test display contracts only, not score calculation.
    for(const [id,score,priorities] of [['favorable',92,['Monitor','Monitor','Monitor']],['unfavorable',48,['Fix now','Fix next','Monitor']],['boundary',83,['Monitor','Monitor','Monitor']]]){
     const r=structuredClone(seed);r.score=score;r.band=r.score_band=score>=83?'Light':'Heavy';
     const ladder=actualLadder(r).map((s,i)=>({...s,priority:priorities[i]||'Monitor'}));
     if(tool==='structural_clarity')r.canonical_descriptor.priority_ladder=ladder;else{r.intervention_priority_ladder=ladder;r.canonical_descriptor.priority_ladder=ladder;}
     cases.push({id,result:r});
    }
    for(const entry of cases){
     const before=JSON.stringify(entry.result),id=engine+'/'+tool+'/'+entry.id;
     const rendered=await page.evaluate(({result,payload})=>{
      window.__inlineResultTest.render(result,payload);
      const priority=document.getElementById('priorityPathMount'),flow=document.getElementById('effortFlowSankey')||document.getElementById('capacityFlow');
      return {after:JSON.stringify(result),priority:priority?.textContent||'',titles:[...priority.querySelectorAll('svg text')].filter(e=>e.getAttribute('letter-spacing')==='.11em').map(e=>e.textContent),flow:flow?.textContent||'',flowHtml:flow?.outerHTML||'',flowCard:flow?.closest('.viz-card')?.textContent||'',cloneHtml:window.__inlineResultTest.full(result,payload,'Diagnostic report')};
     },{...entry,payload});
     check(id+'/immutable',()=>assert.equal(rendered.after,before));
     const ladder=actualLadder(entry.result).slice(0,3);
     const priorityNames={'Fix now':'FIX NOW','Fix next':'FIX NEXT','Monitor':'MONITOR'};
     check(id+'/canonical-priorities',()=>assert.deepEqual(rendered.titles,ladder.map((s,i)=>Object.hasOwn(priorityNames,s.priority)?priorityNames[s.priority]:'PRIORITY '+(i+1))));
     check(id+'/no-invented-dimension-cost',()=>assert.doesNotMatch(rendered.flow,/Systems friction|Process density|Administrative upkeep|Approval bottleneck|Dimension dollars|Modeled share:/i));
     check(id+'/not-observed-productivity',()=>assert.doesNotMatch(rendered.flowCard,/Productive (effort|work)|Necessary administrative load|Structural overhead|Where the capacity goes/i));
     check(id+'/published-scenario',()=>assert.match(rendered.flow,/Modeled annual time|Modeled annual labor cost|Not enough published/));
     if(tool==='operational_systems'){
      check(id+'/exact-published-values',()=>{assert.match(rendered.flow,/40 hours/);assert.match(rendered.flow,/\$1,800/);assert.match(rendered.flow,/\$108/);assert.match(rendered.flow,/5,400 hours/);assert.doesNotMatch(rendered.flow,/32\.4|29\.16|21\.6|12\.96|11\.88/);});
     }
     if(entry.id==='saved'){
      await page.locator('#expandAllBtn').click();
      for(const width of [390,768,1440]){
       await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
       const bad=await page.evaluate(()=>[...document.querySelectorAll('#priorityPathMount svg text')].filter(e=>{const b=e.getBBox(),v=e.ownerSVGElement.viewBox.baseVal;return b.width>0&&(b.x<-.5||b.x+b.width>v.width+.5||b.y<-.5||b.y+b.height>v.height+.5)}).map(e=>e.textContent));
       check(id+'/'+width+'/priority-bounds',()=>assert.deepEqual(bad,[]));
       // Width is checked in the browser; do not infer it from a screenshot.
       const bounds=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&(b.right>innerWidth+1||b.x< -1)&&getComputedStyle(e).position!=='fixed';}).slice(0,12).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'SVG',x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right}))}));
       check(id+'/'+width+'/no-overflow',()=>assert.ok(bounds.scrollWidth<=width+1,JSON.stringify(bounds)));
       const target=page.locator('#effortFlowSankey,#capacityFlow').first();
       const scenarioVisible=await target.isVisible();check(id+'/'+width+'/scenario-visible',()=>assert.equal(scenarioVisible,true));
       const screenshot=path.join(out,`${engine}-${tool}-${width}-scenario.png`);
       if(scenarioVisible){await target.screenshot({path:screenshot});evidence.screenshots.push(screenshot);}
       const visible=await page.locator('#priorityPathMount').isVisible();
       check(id+'/'+width+'/priority-visible',()=>assert.equal(visible,true));
       if(visible)await page.locator('#priorityPathMount').screenshot({path:path.join(out,`${engine}-${tool}-${width}-priority.png`)});
      }
      const noScriptContext=await browser.newContext({javaScriptEnabled:false}),staticPage=await noScriptContext.newPage();
      await staticPage.setContent(rendered.flowHtml);
      check(id+'/static-value-text',()=>assert.ok(rendered.flowHtml.includes('40')||tool!=='operational_systems'));
      const staticText=await staticPage.locator('body').textContent();check(id+'/no-script-retains-values',()=>assert.equal(staticText,rendered.flow));
      await staticPage.setContent(rendered.cloneHtml);
      const cloneFlow=await staticPage.locator('#effortFlowSankey,#capacityFlow').first().textContent();
      check(id+'/export-clone-values',()=>assert.equal(cloneFlow,rendered.flow));
      check(id+'/no-legacy-capacity-bars',()=>assert.doesNotMatch(rendered.cloneHtml,/id=["']capacityWaterfall["']/));
      await noScriptContext.close();
     }
    }
    // Exercise repeated redraw, missing data, measured zero and hostile labels.
    for(const [id,exposure] of [['missing',{}],['zero',{annual_hours:0,annual_cost:0,recoverable_cost:0,total_capacity_hours:5400}],['invalid',{annual_hours:null,annual_cost:'1800',recoverable_cost:-1,total_capacity_hours:Infinity}]]){
     const r=structuredClone(seed);r.exposure=exposure;r.reclaim_potential={amount:999999};r.intervention_priority_ladder=[];r.canonical_descriptor.priority_ladder=[];
     const output=await page.evaluate(({result,payload})=>{window.__inlineResultTest.render(result,payload);return {flow:(document.getElementById('effortFlowSankey')||document.getElementById('capacityFlow')).textContent,priority:document.getElementById('priorityPathMount').textContent};},{result:r,payload});
     check(engine+'/'+tool+'/'+id+'/no-stale-priority',()=>assert.equal(output.priority,'No review order is available for this result.'));
     check(engine+'/'+tool+'/'+id+'/no-stale-or-fallback-cost',()=>assert.doesNotMatch(output.flow,/\$108|999|\$1,800/));
     check(engine+'/'+tool+'/'+id+'/missing-v-zero',()=>id==='zero'?assert.match(output.flow,/0 hours[\s\S]*\$0/):assert.match(output.flow,/Not enough published/));
    }
    const hostile=structuredClone(seed),label='<img src=x onerror="window.__unsafe=true"> '+('Long label '.repeat(20));
    hostile.intervention_priority_ladder=[{focus:label,priority:'constructor',severity:27}];hostile.canonical_descriptor.priority_ladder=hostile.intervention_priority_ladder;
    const hostileResult=await page.evaluate(r=>{window.__inlineResultTest.priority(r);const p=document.getElementById('priorityPathMount');return {text:p.textContent,accessible:p.querySelector('svg')?.getAttribute('aria-label')||'',unsafe:window.__unsafe,htmlTags:p.querySelectorAll('img,script').length,clipped:[...p.querySelectorAll('svg text')].filter(e=>{const b=e.getBBox(),v=e.ownerSVGElement.viewBox.baseVal;return b.width>0&&(b.x<-.5||b.x+b.width>v.width+.5)}).map(e=>e.textContent)};},hostile);
    check(engine+'/'+tool+'/hostile-label',()=>{assert.equal(hostileResult.unsafe,undefined);assert.equal(hostileResult.htmlTags,0);assert.match(hostileResult.text,/PRIORITY 1/);assert.doesNotMatch(hostileResult.text,/FIX NOW/);assert.ok(hostileResult.accessible.includes(label));assert.deepEqual(hostileResult.clipped,[]);});
    check(engine+'/'+tool+'/versioned-viz',()=>assert.match(source[file],/monderman-viz\.js\?v=20260910-inline-scenario1/));
    const fallback=await page.evaluate(({result,payload})=>{const helper=window.MViz.timeCostScenario;delete window.MViz.timeCostScenario;window.__inlineResultTest.render(result,payload);const text=(document.getElementById('effortFlowSankey')||document.getElementById('capacityFlow')).textContent;window.MViz.timeCostScenario=helper;return text;},{result:seed,payload});
    check(engine+'/'+tool+'/mixed-cache-fallback',()=>assert.match(fallback,/details are unavailable.*saved report in Workspace/));
    if(tool==='operational_systems'){
     const held=[['input_saturation',{sizing_status:'input_saturation',hours_estimated:true}],['withheld',{sizing_status:'withheld'}],['not_estimated',{sizing_status:'not_estimated'}],['missing_hours_inputs',{sizing_status:'missing_hours_inputs'}],['insufficient_hours_inputs',{sizing_status:'insufficient_hours_inputs'}],['hours_flag',{hours_estimated:false}],['ip_missing_sizing',{priceable:false,unpriced_reason:'missing_sizing_inputs'}],['unknown_status',{sizing_status:'unexpected-status'}],['hours_only',{sizing_status:'hours_only'}],['missing_rate',{sizing_status:'hours_only_missing_labor_rate'}],['cost_flag',{cost_estimated:false}],['unpriceable',{priceable:false}]];
     for(const [name,flags] of held){
      const exposure={...fixture.result.exposure,...flags};
      const text=await page.evaluate(e=>{if(!MViz.timeCostScenario)return 'MISSING HELPER';MViz.timeCostScenario('effortFlowSankey',e);return document.getElementById('effortFlowSankey').textContent;},exposure);
      check(engine+'/withholding/'+name,()=>{assert.match(text,/5,400 hours/);assert.doesNotMatch(text,/\$1,800|\$108/);if(['hours_only','missing_rate','cost_flag','unpriceable'].includes(name)){assert.match(text,/40 hours/);assert.match(text,/Labor-cost and recovery estimates were not published/);}else{assert.doesNotMatch(text,/40 hours|Modeled share of assumed capacity/);assert.match(text,/withheld|not calculated|not published/);}});
     }
     const tiny=await page.evaluate(()=>{if(!MViz.timeCostScenario)return 'MISSING HELPER';MViz.timeCostScenario('effortFlowSankey',{annual_hours:0.001,annual_cost:0.001});return document.getElementById('effortFlowSankey').textContent;});
     check(engine+'/tiny-published-values',()=>{assert.match(tiny,/<0\.01 hours/);assert.match(tiny,/<\$0\.01/);assert.doesNotMatch(tiny,/\$<0\.01/);});
    }
    await page.close();
   }
  }finally{await browser.close();}
 }
 check('no-browser-errors',()=>assert.deepEqual(evidence.errors,[]));
 check('no-admission-or-provider-requests',()=>assert.deepEqual(evidence.blockedRequests.filter(r=>/\/run\/start|\/answer$|\/finalize$|\/otp|anthropic|resend|stripe/i.test(r.path+' '+r.host)),[]));
 evidence.passed=evidence.failures.length===0;
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify({passed:evidence.passed,checks:evidence.checks.length,failures:evidence.failures,out,providerCalls:0}));
assert.equal(evidence.passed,true,'Inline result presentation failures; see checks.json');
