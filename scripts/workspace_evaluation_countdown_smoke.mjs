import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const out = process.env.EVALUATION_UI_OUT || '/tmp/monderman-evaluation-countdown';
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let bytes=fs.readFileSync(file);
  // Layout fixture uses actual Workspace HTML/CSS. Product execution is tested
  // separately: no real authentication, campaign or billing request is sent.
  if(file.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</head>','<style>/* Fixture: model the completed loading state without executing data modules. */#wsOverlay{display:none!important}</style></head>'));
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const snapshot={ok:true,organizationId:'controlled-layout-org',serverNow:'2026-09-19T12:00:00Z',evaluation:{status:'active',startsAt:'2026-09-19T12:00:00Z',endsAt:'2026-11-18T12:00:00Z',daysRemaining:60,autoRenews:false,cardRequired:false}};
let checks=0,states=0;
try{
 for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
   for(const width of [390,834,1440])for(const file of ['workspace.html','workspace-diagnostics.html','workspace-analysis.html','workspace-actions.html','workspace-settings.html']){
    const page=await browser.newPage({viewport:{width,height:1000}});
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(`${base}/${file}`);
    await page.evaluate(value=>{window.__mondermanEvaluationStatus=value;},snapshot);
    await page.addScriptTag({url:base+'/workspace-evaluation.js'});
    const banner=page.locator('#workspaceEvaluationStatus');
    await banner.waitFor();
    assert.match(await banner.innerText(),/60 days remaining/);checks++;
    assert.match(await banner.innerText(),/Ends November 18, 2026 \(UTC\) · No automatic renewal/);checks++;
    const box=await banner.boundingBox();
    assert.ok(box.x>=-1&&box.x+box.width<=width+1,`${engine}/${width}/${file}: banner fits`);checks++;
    assert.equal(await banner.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);checks++;
    const variants=await page.evaluate(value=>{
      const view=window.mondermanEvaluationView;
      return {
        one:view({...value,serverNow:'2026-11-18T11:59:59Z'},0),
        end:view({...value,serverNow:value.evaluation.endsAt},0),
        stopped:view({...value,evaluation:{...value.evaluation,status:'expired'}},0),
        paid:view({...value,evaluation:{status:'none'}},0),
        bad:view({...value,serverNow:'invalid'},0),
        elapsed:view(value,86400000),
        localClockIndependent:(()=>{const real=Date.now;Date.now=()=>0;const v=view(value,0);Date.now=real;return v;})()
      };
    },snapshot);
    assert.equal(variants.one.days,1);checks++;
    assert.equal(variants.end.expired,true);checks++;
    assert.equal(variants.stopped.expired,true);checks++;
    assert.equal(variants.paid,null);checks++;
    assert.equal(variants.bad,null);checks++;
    assert.equal(variants.elapsed.days,59);checks++;
    assert.equal(variants.localClockIndependent.days,60);checks++;
    await banner.scrollIntoViewIfNeeded();
    assert.ok(await banner.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`${engine}/${width}/${file}: banner is not obscured`);checks++;
    if(file==='workspace.html')await banner.screenshot({path:path.join(out,`${engine}-${width}-active.png`)});
    await page.close();states++;
   }
  }finally{await browser.close();}
 }
 // An actual ended-state render must retain a clear route to continued access.
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  await page.goto(base+'/workspace.html');
  await page.evaluate(value=>{window.__mondermanEvaluationStatus=value;},{...snapshot,evaluation:{...snapshot.evaluation,status:'expired'}});
  await page.addScriptTag({url:base+'/workspace-evaluation.js'});
  const banner=page.locator('#workspaceEvaluationStatus');
  await banner.waitFor();assert.match(await banner.innerText(),/saved reports remain available/);checks++;
  assert.equal(await banner.getByRole('link').getAttribute('href'),'connect.html');checks++;
  await banner.screenshot({path:path.join(out,'expired-390.png')});
  await page.evaluate(value=>{
    window.mondermanRefreshEvaluationStatus=async()=>({...value,serverNow:'2026-09-20T12:00:00Z'});
    document.dispatchEvent(new Event('visibilitychange'));
  },snapshot);
  await page.getByText('Free evaluation · 59 days remaining',{exact:true}).waitFor();checks++;
  await page.evaluate(()=>{
    window.mondermanRefreshEvaluationStatus=async()=>({ok:true,organizationId:'other-org',serverNow:'2026-09-20T12:00:00Z',evaluation:{status:'none'}});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.match(await banner.innerText(),/59 days remaining/);checks++;
  await page.evaluate(()=>{
    window.mondermanRefreshEvaluationStatus=async()=>({ok:true,organizationId:'controlled-layout-org',serverNow:'2026-09-20T12:00:00Z',evaluation:{status:'none'}});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await banner.waitFor({state:'detached'});checks++;
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({ok:true,checks,states,engines:['Chromium','WebKit'],widths:[390,834,1440]},null,2));
 console.log(JSON.stringify({ok:true,checks,states,out}));
}finally{await new Promise(resolve=>server.close(resolve));}
