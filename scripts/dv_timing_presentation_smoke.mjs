// Real built DV page and legacy export builder; synthetic saved-result injection.
// All service requests are intercepted. No signup, admission, provider or DB use.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('.render-public');
const out = path.resolve(process.env.DV_TIMING_PRESENTATION_OUT || 'output/dv-timing-presentation');
fs.mkdirSync(out, {recursive:true});
const source = fs.readFileSync(path.join(root, 'decision-velocity.html'), 'utf8');
const fixture = JSON.parse(fs.readFileSync('test-fixtures/authenticated-report-engine-runs.json')).outputs.decision_velocity;
const cases = [];
for (const [id, score, value, status] of [['measured-zero',51,0,'measured'],['missing',78,null,'not_measured'],['high-missing',90,null,'not_measured'],['unavailable',78,null,'measured']]) {
  const result = structuredClone(fixture.result);
  result.score = score;
  result.dimensions.cycle_velocity = value;
  result.measurement_coverage.dimensions.cycle_velocity = {status,evidence_count:status==='measured'?1:0};
  cases.push({id,result,payload:{...fixture.input_context,participantMode:'senior_leader',diagnostic_depth:30},syntheticAvailabilityVariant:true});
}
if (process.env.DV_TIMING_MEASURED_FIXTURE) {
  const fresh = JSON.parse(fs.readFileSync(process.env.DV_TIMING_MEASURED_FIXTURE));
  assert.equal(fresh.syntheticOnly,true);
  const entry = fresh.cases.find(c=>c.id==='DV-senior_leader-30-missing');
  assert.ok(entry?.rendererInput?.value&&entry?.context&&entry.packetMatch===true, 'Source-bound reconstructed DV fixture required');
  // Rendering needs these names, not the answers used for scoring. Preserve the
  // reconstructed result; only alias its explicitly recorded display context.
  const payload={...entry.context,processName:entry.context.process_name,participantMode:entry.context.participant_mode};
  cases.push({id:'current-dv-missing',result:{...entry.result,narrative:entry.narrative,interpretive_prose:entry.prose},payload,syntheticAvailabilityVariant:false});
}
const evidence = {scope:'Actual built DV page and legacy PDF builder, synthetic input injection; no live journey or model approval. Chart.js is stubbed; native SVGs and full layout are rendered.',startedAt:new Date().toISOString(),pageSha256:createHash('sha256').update(source).digest('hex'),buildBaseRevision:JSON.parse(fs.readFileSync(path.join(root,'.well-known/monderman-release.json'))).revision,sourceDirty:spawnSync('git',['status','--porcelain','--','decision-velocity.html'],{encoding:'utf8'}).stdout.trim()!=='',cases:[],errors:[],blockedServiceRequests:[],passed:false};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.resolve(root,'.'+pathname);
  if (!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) return res.writeHead(404).end();
  let body = fs.readFileSync(file);
  if (pathname==='/decision-velocity.html') {
    let html=body.toString().replace(/(<script[^>]*src="[^"]*(?:@supabase|chart\.js)[^>]*?) integrity="[^"]+"/g,'$1');
    const marker='function renderResults(result, payload, outputMode) {';
    assert.equal(html.split(marker).length,2);
    html=html.replace(marker,"queueMicrotask(()=>{window.__timingTest={render(result,payload){state.result=result;state.renderPayload=payload;state.mode='executive';state.depth='30';state.runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';renderResults(result,payload);showStage(resultsStage);},summary:buildExecutiveReportHtml,full:buildFullReportHTML};});\n"+marker);
    body=Buffer.from(html);
  }
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const auth="window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};";
const gate="window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();";
try {
  for (const [name,type] of [['chromium',chromium],['webkit',webkit]]) {
    const browser=await type.launch({headless:true});
    try {
      const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
      await context.addInitScript({content:auth});
      await context.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gate});
        if(u.origin===base)return route.continue();
        evidence.blockedServiceRequests.push({method:route.request().method(),host:u.hostname,path:u.pathname});
        if(u.pathname.includes('chart.js'))return route.fulfill({contentType:'application/javascript',body:'window.Chart=function(){return {destroy(){},update(){}}};'});
        if(u.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* local auth fixture */'});
        if(u.hostname==='monderman-api.onrender.com')return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
        return route.abort();
      });
      const page=await context.newPage();
      page.on('pageerror',e=>evidence.errors.push(name+': '+e.message));
      await page.goto(base+'/decision-velocity.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__timingTest&&document.getElementById('pageLoader')?.classList.contains('hidden'));
      for(const entry of cases) {
        const original=JSON.stringify(entry.result);
        const rendered=await page.evaluate(({result,payload})=>{
          window.__timingTest.render(result,payload);
          const text=html=>new DOMParser().parseFromString(html,'text/html').body.textContent.replace(/\s+/g,' ').trim();
          const summary=window.__timingTest.summary(result,payload);
          return {summary,summaryText:text(summary),fullText:text(window.__timingTest.full(result,payload,'Diagnostic report')),diagnosis:document.querySelector('#cycleConditionSub').textContent,dimensions:document.querySelector('#measurementDimensionsGrid').textContent,resultAfter:JSON.stringify(result)};
        },entry);
        assert.equal(rendered.resultAfter,original,'Rendering mutated input');
        const expected=entry.id==='measured-zero'?'not independently observed speed':entry.id==='unavailable'?'Decision timing is unavailable':'Decision timing was not measured';
        if(entry.id==='measured-zero') {
          assert.equal(rendered.diagnosis,entry.result.interpretive_prose.harmonized_narrative.diagnosisReads.burdenRead,'Measured timing preserves the supplied diagnosis');
          assert.match(rendered.dimensions,/Decision timing0 \/ 100/,'Measured zero remains visible');
        } else assert.ok(rendered.diagnosis.includes(expected),entry.id+' screen qualification');
        assert.ok(rendered.summaryText.includes(expected),entry.id+' legacy summary qualification');
        if(entry.id!=='measured-zero')assert.ok(rendered.fullText.includes(expected),entry.id+' cloned full-report qualification');
        assert.doesNotMatch(rendered.summaryText,/Fast movement|Slow movement|otherwise healthy pathway|no clear easing signal|remove surgically|need to admit/);
        await page.locator('#expandAllBtn').click();
        for(const width of [390,768,1440]) {
          await page.setViewportSize({width,height:1000});
          await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+'/'+entry.id+'/'+width+' page overflow');
          const ancestors=await page.locator('.diagnosis-grid').evaluate(el=>{const rows=[];for(let e=el;e;e=e.parentElement){const r=e.getBoundingClientRect(),c=getComputedStyle(e);rows.push({tag:e.tagName,id:e.id,class:e.className,x:r.x,right:r.right,width:r.width,minWidth:c.minWidth,padding:c.padding,overflow:c.overflow,transform:c.transform});}return rows;});
          fs.writeFileSync(path.join(out,`${name}-${entry.id}-${width}-ancestors.json`),JSON.stringify(ancestors,null,2));
          assert.ok(ancestors[0].x>=-1&&ancestors[0].right<=width+1,name+'/'+entry.id+'/'+width+' clipped diagnosis '+JSON.stringify(ancestors));
          const clippedQualifications=await page.locator('#resultsStage .summary-sub.tight').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height>0&&(e.scrollHeight>e.clientHeight+1||!['none','unset'].includes(getComputedStyle(e).webkitLineClamp))).map(e=>e.id));
          assert.deepEqual(clippedQualifications,[],name+'/'+entry.id+'/'+width+' truncated qualification');
          await page.locator('#measurementDimensionsGrid').screenshot({path:path.join(out,`${name}-${entry.id}-${width}-dimensions.png`)});
          await page.locator('.diagnosis-grid').screenshot({path:path.join(out,`${name}-${entry.id}-${width}-diagnosis.png`)});
          evidence.cases.push({browser:name,id:entry.id,width,qualification:rendered.diagnosis,dimensions:rendered.dimensions});
        }
        if(name==='chromium') {
          const print=await context.newPage();
          await print.setContent(rendered.summary,{waitUntil:'domcontentloaded'});
          await print.evaluate(()=>document.fonts.ready);
          const filename=path.join(out,entry.id+'-legacy.pdf');
          await print.pdf({path:filename,format:'Letter',preferCSSPageSize:true,printBackground:true});
          const extracted=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',filename],{encoding:'utf8',maxBuffer:4000000});
          assert.equal(extracted.status,0,extracted.stderr);
          const pages=JSON.parse(extracted.stdout).map(t=>t.replace(/\s+/g,' ').trim());
          assert.ok(pages.join(' ').includes(expected),entry.id+' PDF qualification');
          assert.ok(pages.every(t=>t.length>20),'blank PDF page');
          fs.writeFileSync(path.join(out,entry.id+'-pdf-text.json'),JSON.stringify(pages,null,2));
          await print.close();
        }
      }
    } finally {await browser.close();}
  }
  assert.deepEqual(evidence.errors,[],'Browser runtime errors');
  assert.equal(evidence.blockedServiceRequests.filter(r=>/\/run\/start|\/answer$|\/finalize$|\/otp/.test(r.path)).length,0);
  evidence.passed=true;
  console.log(JSON.stringify({passed:true,states:evidence.cases.length,out,providerCalls:0}));
} finally {evidence.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
