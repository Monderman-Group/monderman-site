// Real pinned Chart.js, synthetic saved outputs and isolated local HTTP only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.CHART_PUBLIC_ROOT||'.render-public');
const out=path.resolve(process.env.CHART_BROWSER_OUT||'output/sc-ip-real-charts');
fs.mkdirSync(out,{recursive:true});
const sources={SC:'structural-clarity',IP:'institutional-performance'};
const keys={SC:['role','decision_rights','handoff','accountability','governance'],IP:['execution','confidence','adaptation','stability','compensation']};
const labels={SC:['Roles','Decision authority','Handoffs','Accountability','Approval requirements'],IP:['Execution','Confidence in formal systems','Ability to adapt','Performance stability','Extra effort']};
const corpus=JSON.parse(fs.readFileSync(path.resolve('../monderman-api-first-run/output/diagnostic-language/outputs.json')));
const html=fs.readFileSync(path.join(root,'structural-clarity.html'),'utf8');
const asset=html.match(/<script src="([^"]+chart\.umd\.min\.js)" integrity="sha384-([^"]+)"/);
assert.ok(asset,'pinned Chart.js source and integrity');
const response=await fetch(asset[1]);
assert.equal(response.status,200,'fetch exact pinned chart library');
const library=Buffer.from(await response.arrayBuffer());
assert.equal(crypto.createHash('sha384').update(library).digest('base64'),asset[2],'Chart.js integrity');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  let body=fs.readFileSync(file);
  if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/(<script[^>]*src="[^"]*@supabase[^>]*?) integrity="[^"]+"/g,'$1'));
  res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const auth="window.__fixtureAuth={auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};window.supabase={createClient:()=>window.__fixtureAuth};";
const gate="window.__mondermanSB=window.__fixtureAuth;window.mondermanGetSupabaseClient=async()=>window.__fixtureAuth;window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'public_first_run'});window.__mondermanReveal?.();";
const rows=[],errors=[];
let browser;
try{
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
    browser=await type.launch({headless:true});
    for(const [instrument,slug] of Object.entries(sources)){
      const entry=corpus.find(e=>e.instrument===instrument&&e.role==='managerial'&&e.depth===60&&e.archetype==='mid');
      assert.ok(entry,'representative real-engine fixture');
      for(const missing of [false,true]){
        const result={...structuredClone(entry.result),narrative:entry.narrative,interpretive_prose:entry.prose};
        if(missing)delete result.burden_breakdown;
        const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
        await context.addInitScript({content:auth});
        await context.addInitScript(({result,payload})=>{window.__mondermanInjectedResult={result,payload};},{result,payload:entry.payload});
        await context.route('**/*',route=>{
          const url=new URL(route.request().url());
          if(url.pathname.endsWith('/workspace-access-gate.js'))return route.fulfill({contentType:'application/javascript',body:gate});
          if(url.origin===base)return route.continue();
          if(url.href===asset[1])return route.fulfill({contentType:'application/javascript',body:library});
          if(url.pathname.includes('@supabase/'))return route.fulfill({contentType:'application/javascript',body:'/* fixture */'});
          if(/(?:html2canvas|jspdf)/.test(url.href))return route.fulfill({contentType:'application/javascript',body:'/* no export in this test */'});
          return route.abort();
        });
        const page=await context.newPage();
        page.on('pageerror',e=>errors.push(engine+'/'+slug+': '+e.message));
        await page.goto(base+'/'+slug+'.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__mondermanInjectionApplied===true);
        // Screenshot automation must not race the site's smooth scroll.
        // No layout, chart sizing or accordion styles are overridden.
        await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
        await page.evaluate(()=>document.fonts.ready);
        const accordion=page.locator('[data-accordion="detail"]');
        await accordion.locator('.accordion-header').click();
        for(const width of [390,768,1440]){
          await page.setViewportSize({width,height:1000});
          await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
          const cards=await page.locator('[data-accordion="detail"] .chart-card').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
          for(const card of cards)assert.ok(card.left>=0&&card.right<=width,'card clipped before scroll: '+JSON.stringify({engine,instrument,missing,width,card}));
          await page.evaluate(()=>{for(const id of ['gapChart','dimensionChart']){const chart=Chart.getChart(id);chart.options.animation=false;chart.resize();chart.update('none');}});
          try { await page.locator('#gapChart').scrollIntoViewIfNeeded({timeout:5000}); }
          catch(error){
            const samples=[];
            for(let i=0;i<4;i++){
              samples.push(await page.evaluate(()=>({scrollY,scrollX,documentWidth:document.documentElement.scrollWidth,rects:['#gapChart','#gapChart .none','.chart-wrap','.chart-card','[data-accordion="detail"]','.accordion-body'].flatMap(s=>[...document.querySelectorAll(s)].map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {tag:el.tagName,id:el.id,cls:el.className,rect:{x:r.x,y:r.y,width:r.width,height:r.height},css:{width:c.width,height:c.height,maxHeight:c.maxHeight,position:c.position,display:c.display,transform:c.transform,padding:c.padding},style:el.getAttribute('style')};}))})));
              await new Promise(r=>setTimeout(r,150));
            }
            fs.writeFileSync(path.join(out,'unstable-'+engine+'-'+instrument+'-'+width+'.json'),JSON.stringify(samples,null,2));
            await page.screenshot({path:path.join(out,'unstable-'+engine+'-'+instrument+'-'+width+'.png')});
            throw error;
          }
          const facts=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,charts:['gapChart','dimensionChart'].map(id=>{const canvas=document.getElementById(id),chart=Chart.getChart(id),r=canvas.getBoundingClientRect();return {id,labels:chart.data.labels,values:chart.data.datasets[0].data,width:r.width,height:r.height,left:r.left,right:r.right,nonempty:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some(v=>v!==0)};})}));
          assert.ok(facts.documentWidth<=width+1,'no document overflow');
          for(const chart of facts.charts){
            assert.deepEqual(chart.labels,labels[instrument],'correct diagnostic labels');
            assert.deepEqual(chart.values,keys[instrument].map(k=>Number.isFinite(result.burden_breakdown?.[k])?result.burden_breakdown[k]:null),'published values or null, no reverse scale');
            assert.ok(chart.left>=-1&&chart.right<=width+1&&chart.width>100&&chart.height>100&&chart.nonempty,'visible real chart: '+JSON.stringify({engine,instrument,missing,width,chart}));
            await page.locator('#'+chart.id).locator('..').locator('..').screenshot({path:path.join(out,[engine,instrument,missing?'missing':'measured',width,chart.id].join('-')+'.png')});
          }
          rows.push({engine,instrument,missing,...facts});
        }
        await context.close();
      }
    }
    await browser.close();browser=null;
  }
  assert.deepEqual(errors,[],'browser errors');
  console.log('SC_IP_REAL_CHART_BROWSER_PASS '+rows.length+' layouts; real Chart.js; no customer admissions');
}finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({rows,errors,chartUrl:asset[1],chartSha384:asset[2],limits:['Synthetic result injection, not a live run','Chromium and WebKit emulation, not physical devices']},null,2));
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
}
