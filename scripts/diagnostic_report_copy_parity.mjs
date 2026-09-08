// Exercises the actual four direct-run builders and the shared saved-report
// builder with synthetic results. No customer records or production admissions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('.render-public');
const api = path.resolve(process.env.LANGUAGE_API_ROOT || '../monderman-api-first-run');
const out = path.resolve(process.env.LANGUAGE_PARITY_OUT || 'output/diagnostic-report-copy-parity');
fs.mkdirSync(out, {recursive:true});
const corpus = JSON.parse(fs.readFileSync(path.join(api, 'output/diagnostic-language/outputs.json')));
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
  let body = fs.readFileSync(file);
  if (file.endsWith('.html')) {
    let html = body.toString().replace(/(<script[^>]*src="[^"]*(?:@supabase|chart\.js)[^>]*?) integrity="[^"]+"/g, '$1');
    html = html.replace('function renderResults(result, payload, outputMode) {',
      "queueMicrotask(()=>{window.__copyParity={render(result,payload){state.result=result;state.renderPayload=payload;state.mode=payload.participantMode==='senior_leader'?'executive':payload.participantMode;state.depth=String(payload.diagnostic_depth);state.runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';state.configVersion=null;pinQuestionnaireVersion({configVersion:result.questionnaire_version});renderResults(result,payload);showStage(resultsStage);},full:buildFullReportHTML,summary:buildExecutiveReportHtml};});\nfunction renderResults(result, payload, outputMode) {");
    body = Buffer.from(html);
  }
  res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = 'http://127.0.0.1:'+server.address().port;
const auth = "window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};";
const gate = "window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();";
const specs = {DV:'decision-velocity',SC:'structural-clarity',OS:'operational-systems',IP:'institutional-performance'};
const names={DV:'Decision Velocity',SC:'Structural Clarity',OS:'Operational Systems',IP:'Institutional Performance'};
function containsNumber(text,value) {
  if(!Number.isFinite(value)) return true;
  const normalized=text.replaceAll(',','').replaceAll('\u00a0',' ');
  return new RegExp('(^|[^0-9.])'+String(value).replace('.', '\\.')+'(?=$|[^0-9.])').test(normalized);
}
// Independent expectations for the existing approximate direct-view format.
// Saved reports publish exact model outputs; direct views round hours and
// display a fixed scenario range. The check accepts only those explicit rules,
// not an arbitrary nearby number or an unrelated amount elsewhere in the text.
function directDisplay(exposure) {
  const hours=exposure.annual_hours, cost=exposure.annual_cost;
  const hoursStep=hours<100?10:hours<1000?50:hours<10000?100:500;
  const step=cost<1000?50:cost<5000?250:cost<50000?5000:cost<250000?10000:cost<500000?25000:50000;
  const low=Math.max(0,Math.floor(cost*.8/step)*step);
  const high=Math.max(low+step,Math.ceil(cost*1.25/step)*step);
  assert.ok(low<=cost && high>=cost,'published scenario range must contain the model point');
  return {annualHours:Math.max(hoursStep,Math.round(hours/hoursStep)*hoursStep),annualCostRange:'$'+low.toLocaleString('en-US')+'–$'+high.toLocaleString('en-US')};
}
const renderer = fs.readFileSync('monderman-report.js','utf8');
const rows=[], findings=[], errors=[], requests=[];
const browser = await chromium.launch({headless:true});
try {
  for (const [instrument, slug] of Object.entries(specs)) {
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript({content:auth});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/workspace-access-gate.js')) return route.fulfill({contentType:'application/javascript',body:gate});
      if (url.origin===base) return route.continue();
      requests.push({method:route.request().method(),path:url.pathname});
      if (url.pathname.includes('chart.js')) return route.fulfill({contentType:'application/javascript',body:'window.Chart=function Chart(){return {destroy(){},update(){}}};'});
      if (url.pathname.includes('@supabase/')) return route.fulfill({contentType:'application/javascript',body:'/* fixture */'});
      if (url.hostname==='monderman-api.onrender.com') return route.fulfill({contentType:'application/json',body:'{"ok":true,"requiresAcceptance":false}'});
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(slug+': '+e.message));
    await page.goto(base+'/'+slug+'.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__copyParity && document.getElementById('pageLoader')?.classList.contains('hidden'));
    await page.addScriptTag({content:renderer});
    for (const entry of corpus.filter(c=>c.instrument===instrument)) {
      const result = {...entry.result,narrative:entry.narrative,interpretive_prose:entry.prose};
      assert.ok(entry.payload && entry.context,entry.id+': corpus must retain actual scoring inputs');
      const payload = structuredClone(entry.payload);
      const exposure=result.exposure||{};
      assert.equal(exposure.model?.input_hours_per_run,payload.meetingHours,entry.id+': mismatched hours fixture');
      assert.equal(exposure.model?.annual_cycles,payload.annualVolume??payload.annualCycles,entry.id+': mismatched frequency fixture');
      assert.equal(exposure.average_hourly_cost,payload.hourlyCost,entry.id+': mismatched hourly-cost fixture');
      const expectedFacts={tool:names[instrument],scope:payload.processName||payload.process_name,score:result.score,band:result.score_band||result.band||result.condition_band,annualHours:exposure.annual_hours,annualCost:exposure.annual_cost,questionnaireVersion:result.questionnaire_version};
      const display=directDisplay(exposure);
      const data = await page.evaluate(({result,payload})=>{
        window.__copyParity.render(result,payload);
        const summary=window.__copyParity.summary(result,payload);
        const full=window.__copyParity.full(result,payload,'Diagnostic report');
        const saved=MondermanReport.buildReportHtml(MondermanReport.fromRun({...result,input_context:payload}));
        const text=html=>new DOMParser().parseFromString(html,'text/html').body.textContent.replace(/\s+/g,' ').trim();
        return {screen:document.getElementById('resultsStage').textContent.replace(/\s+/g,' ').trim(),summary:text(summary),full:text(full),saved:text(saved),score:document.getElementById('scoreValue')?.textContent};
      },{result,payload});
      for (const [surface,text] of Object.entries(data).filter(([key])=>key!=='score')) {
        const defects=[];
        for (const term of ['This summary shows whether the workflow is simply busy','Experiential layer','Competing readings','Your condition read is ready']) if(text.includes(term))defects.push('stale phrase: '+term);
        if (/\[object Object\]|\bundefined\b|\bNaN\b/.test(text))defects.push('visible serialization artifact');
        if (!text.includes(String(entry.result.score))) defects.push('score not found');
        if (!text.trim())defects.push('empty report');
        const displayedFacts={...expectedFacts,...(surface==='saved'?{}:{annualHours:display.annualHours,annualCost:undefined,annualCostRange:display.annualCostRange})};
        for(const [key,value] of Object.entries(displayedFacts)) {
          if(value==null) continue;
          if(typeof value==='number' ? !containsNumber(text,value) : !text.toLowerCase().includes(String(value).toLowerCase())) defects.push('missing or inconsistent '+key+': '+value);
        }
        if(instrument==='IP' && /Recoverable ambiguity cost|capacity absorbed by compensating for structural ambiguity/.test(text)) defects.push('Structural Clarity copy on Institutional Performance');
        if(/required to sustain the current operating environment|aggressive paths buy more capacity/.test(text)) defects.push('unjustified model-effect claim');
        rows.push({id:entry.id,surface,characters:text.length,expectedFacts,displayedFacts,defects});
        for (const defect of defects)findings.push({id:entry.id,surface,defect});
      }
      if(entry.archetype==='mid') {
        for(const width of [390,768,1440]){
          await page.setViewportSize({width,height:1000});
          await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
          const geometry=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
          if(geometry.documentWidth>width+1)findings.push({id:entry.id,surface:'screen',defect:'horizontal overflow',...geometry});
        }
      }
      if(entry.archetype==='mid' && entry.role==='managerial' && entry.depth===60) {
        fs.writeFileSync(path.join(out,instrument+'-copy.json'),JSON.stringify(data,null,2));
        await page.screenshot({path:path.join(out,instrument+'-screen.png'),fullPage:true});
      }
    }
    await context.close();
    console.log(instrument+': direct screen, summary HTML, full HTML, shared saved-report text checked');
  }
  assert.deepEqual(errors,[],'browser errors');
  assert.equal(requests.filter(r=>/\/run\/start|\/answer$|\/finalize$|\/otp/.test(r.path)).length,0,'no admission or auth mutations');
  assert.equal(findings.length,0,'report copy or layout defects: '+JSON.stringify(findings.slice(0,12)));
  console.log('DIAGNOSTIC_REPORT_COPY_PARITY_PASS '+rows.length+' surfaces');
}finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({rows,findings,errors,requests,limits:['Synthetic result injection using actual scoring inputs, not completed browser runs','Direct views round hours and show a fixed scenario cost range; saved reports show exact model points. Both checked against their explicit formatting rules, not asserted byte-identical.','Chart.js stubbed: text/layout contract, not chart rendering','No PDF generation in this test','Does not establish participant comprehension or resolve held measurement decisions']},null,2));
  await browser.close();await new Promise(r=>server.close(r));
}
