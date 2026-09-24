// Real saved page and renderer, fabricated auth/API only. No account, provider,
// database, PDF generation or private engine imports. Exports remain real HTML/JSON.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {sourceBeforeOverviewPresentation} from './report_overview_presentation_inverse.mjs';
import {sourceBeforeOverviewSiteCompatibility} from './report_overview_site_compatibility_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const out=process.env.SAVED_SYNTHESIS_OUT||fs.mkdtempSync('/tmp/saved-synthesis-page-');
if(process.env.SAVED_SYNTHESIS_OUT)fs.mkdirSync(out,{recursive:false,mode:0o700});
const pageSource=fs.readFileSync(path.join(root,'cross-tool-synthesis.html'),'utf8');
const rendererSource=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
assert.match(rendererSource,/RENDERER_VERSION = "diagnostic-renderer-report-overview-20260924\.1"/);
assert.match(pageSource,/monderman-report\.js\?v=20260924\.overview2/);
// Preserve the exact historical identifiers after the reviewed, hash-pinned
// presentation inverse; the browser still executes the current candidate.
assert.match(sourceBeforeOverviewPresentation(rendererSource),/RENDERER_VERSION = "diagnostic-renderer-evidence-reading-20260914\.43"/);
assert.match(sourceBeforeOverviewSiteCompatibility('cross-tool-synthesis.html',pageSource),/monderman-report\.js\?v=20260915\.financial1/);
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({passed:true,checks:4,scope:'Current and historical source preconditions only; browser checks not run',providerCalls:0,networkCalls:0}));process.exit(0);}
const ORG='22222222-2222-4222-8222-222222222222',ID='33333333-3333-4333-8333-333333333333';
const SOURCE_IDS=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
function fixture({personal,depth,published}){
  const result={synthesis_id:ID,source_run_ids:SOURCE_IDS,source_mode:personal?'own_saved_runs':'campaign',
    report_kind:personal?'self_run_synthesis':'campaign_synthesis',synthesis_product:depth?'depth_synthesis':'cross_lens_synthesis',
    score_status:published?'published':'withheld',cross_diagnostic_score:published?61:null,condition_band:published?'Heavy':'Composite withheld',
    score_label:personal?'Median of your selected scores':depth?'Median Diagnostic Score':'Cross-Lens Composite Score',
    source_result_count:2,submitted_run_count:2,participant_count:personal?1:2,lens_count:depth?1:2,
    generated_at:'2026-09-12T12:00:00.000Z',readiness_label:personal?'One account’s selected runs':'MOCK campaign checks',
    source_groups:[{tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:depth?2:1,median_score:61,mean_score:61,config_versions:['MOCK-current']}],
    ai_report:{status:'complete',report:{version:'MOCK-SAVED-PAGE',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-12T12:00:00.000Z',
      composition:{authorship:'provider_authored_engine_bounded'},evidence:[],sources:[],
      interpretation:{summary:'MOCK display fixture: review these recorded answers before deciding what needs clarification.',observations:[],hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]}}}};
  if(!depth)result.source_groups.push({tool_type:'operational_systems',tool_label:'Operational Systems',submitted_runs:1,median_score:68,mean_score:68,config_versions:['MOCK-current']});
  result.export_payload={filename_hint:'mock-saved-synthesis.json',synthesis_payload:JSON.parse(JSON.stringify(result))};
  return result;
}
const variants=[
  {name:'personal-depth-median',personal:true,depth:true,published:true},
  {name:'personal-depth-withheld',personal:true,depth:true,published:false},
  {name:'personal-cross',personal:true,depth:false,published:false},
  {name:'campaign-depth',personal:false,depth:true,published:true},
  {name:'campaign-cross',personal:false,depth:false,published:true},
  {name:'campaign-cross-withheld',personal:false,depth:false,published:false},
];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const gate=`window.__mondermanActiveOrganizationId=${JSON.stringify(ORG)};
window.mondermanWorkspaceAccessReady=Promise.resolve({allowed:true,context:'MOCK'});
window.mondermanGetSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{access_token:'MOCK-NO-AUTH',user:{id:'MOCK-ACCOUNT'}}}})}});
window.__savedPageCalls=[];
for(const name of ['fromSynthesis','render','openReport','downloadHtml','downloadJson']){
 const original=window.MondermanReport[name];
 window.MondermanReport[name]=function(...args){const before=JSON.stringify(args);const value=original.apply(this,args);
 window.__savedPageCalls.push({name,args:JSON.parse(before),unchanged:before===JSON.stringify(args)});return value;};
}`;
let checks=4;const results=[],errors=[],unexpected=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try{for(const [engineName,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch();
  try{for(const width of [390,834,1440])for(const variant of variants){
    const raw=fixture(variant),initial=JSON.stringify(raw),requests=[];
    const context=await browser.newContext({viewport:{width,height:960},acceptDownloads:true});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base&&url.pathname==='/workspace-access-gate.js')return route.fulfill({contentType:'application/javascript',body:gate});
      if(url.origin===base)return route.continue();
      if(url.origin==='https://monderman-api.onrender.com'&&url.pathname===`/api/synthesis-runs/${ID}`){
        requests.push({method:request.method(),path:url.pathname,authorization:request.headers().authorization,organization:request.headers()['x-monderman-organization-id']});
        if(request.method()!=='GET'){unexpected.push(request.url());return route.abort();}
        return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,result:raw})});
      }
      // The page's unused CDN client is blocked; the explicit gate above owns
      // mock authentication. Export fonts use the same candidate font bytes.
      const font=/^\/(55|65|75)font\.woff2$/.exec(url.pathname);
      if(url.origin==='https://www.monderman.com'&&font)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,font[0].slice(1)))});
      if(url.hostname==='cdn.jsdelivr.net')return route.abort();
      unexpected.push(request.url());return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push({variant:variant.name,engineName,error:error.message}));
    await page.goto(`${base}/cross-tool-synthesis.html?id=${ID}&organization_id=${ORG}`,{waitUntil:'domcontentloaded'});
    async function verify(){
      await page.locator('#reportHost .mr-report').waitFor();
      const title=(variant.personal?'Personal ':'')+(variant.depth?'Depth Synthesis':'Cross-Lens Synthesis');
      eq(await page.locator('#pageTitle').textContent(),title,'saved-page type');
      const score=variant.personal?(variant.depth&&variant.published?'Median of your selected scores 61':'No combined score'):
        variant.depth?'Median Diagnostic Score 61':variant.published?'Cross-Lens Composite Score 61':'Cross-Lens Composite Score withheld';
      eq(await page.locator('#resultBadge').textContent(),`${title} · ${raw.readiness_label} · ${score}`,'exact score boundary');
      const dek=await page.locator('#pageDek').textContent(),method=await page.locator('#methodNote').textContent();
      if(variant.personal){
        eq(method,'Scores and supporting answers are preserved from your selected runs. The report explains what can be compared and which conclusions the evidence supports.');
        eq(dek,variant.depth?(variant.published?'Compare your selected runs from one Diagnostic and review the median of their scores.':'Compare your saved runs from one Diagnostic, with each result kept separate.'):'Compare your own saved runs across Diagnostics, with each lens kept separate.');
      }else{
        eq(method,'The report preserves the API’s distinction between condition and evidence strength. A withheld composite remains withheld in every export.');
        eq(dek,variant.depth?'A same-Diagnostic Synthesis reporting the Median Diagnostic Score, distribution, participant-perspective evidence, and limits of the observed set.':'A multi-Diagnostic Synthesis that keeps each lens visible and publishes a Cross-Lens Composite Score only when the evidence meets the coherence requirements.');
      }
      const calls=await page.evaluate(()=>window.__savedPageCalls);
      eq(calls.find(c=>c.name==='fromSynthesis').args[0],raw,'exact saved result reaches real adapter');
      eq(calls.every(c=>c.unchanged),true,'renderer does not mutate original engine data');
      eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
      const header=await page.locator('.topbar-inner').evaluate(el=>{
        const brand=el.querySelector('.brand'),text=brand.querySelector('.monderman-lockup__name'),nav=el.querySelector('.top-links');
        return {brandRight:brand.getBoundingClientRect().right,textRight:text.getBoundingClientRect().right,navLeft:nav.getBoundingClientRect().left,navRight:nav.getBoundingClientRect().right,viewport:innerWidth,brandShrink:getComputedStyle(brand).flexShrink};
      });
      eq(header.brandShrink,'0','wordmark must not shrink below its visible text');
      eq(Math.max(header.brandRight,header.textRight)<=header.navLeft,true,'wordmark and navigation do not overlap');
      eq(header.navRight<=header.viewport,true,'navigation remains within viewport');
      const hero=await page.locator('.hero').evaluate(el=>{const copy=el.firstElementChild,badge=el.lastElementChild;return {copyWidth:copy.clientWidth,badgeWidth:badge.clientWidth,copyOverflow:copy.scrollWidth>copy.clientWidth,badgeOverflow:badge.scrollWidth>badge.clientWidth,copyMinWidth:getComputedStyle(copy).minWidth,badgeMinWidth:getComputedStyle(badge).minWidth};});
      eq(hero.copyOverflow||hero.badgeOverflow,false,'hero and badge contents stay within their columns');
      eq(hero.copyMinWidth,'0px');eq(hero.badgeMinWidth,'0px');
      if(width>=834)eq(hero.copyWidth>=hero.badgeWidth,true,'long badge must not squeeze report title into a narrow column');
      eq(await page.locator('#reportHost').innerText().then(t=>t.includes('MOCK display fixture')),true,'synthetic provenance visible');
    }
    await verify();
    await page.reload({waitUntil:'domcontentloaded'});await verify();
    eq(requests.length,2,'refresh reads same saved ID, never creates another report');
    eq(requests.every(r=>r.method==='GET'&&r.path===`/api/synthesis-runs/${ID}`&&r.authorization==='Bearer MOCK-NO-AUTH'&&r.organization===ORG),true,'source and organization binding');
    const jsonDownload=page.waitForEvent('download');await page.locator('#downloadJson').click();
    const json=await jsonDownload;eq(JSON.parse(fs.readFileSync(await json.path(),'utf8')),raw.export_payload,'JSON uses exact saved export payload');
    const htmlDownload=page.waitForEvent('download');await page.locator('#downloadHtml').click();
    const html=fs.readFileSync(await (await htmlDownload).path(),'utf8');
    eq(html.includes('MOCK display fixture'),true,'HTML uses saved report');
    const popupPromise=context.waitForEvent('page');await page.locator('#openPdf').click();const popup=await popupPromise;
    await popup.waitForLoadState('domcontentloaded');eq(await popup.locator('body').innerText().then(t=>t.includes('MOCK display fixture')),true,'print window contains saved report (no PDF generated)');
    await popup.close();
    const calls=await page.evaluate(()=>window.__savedPageCalls),renderModel=calls.find(c=>c.name==='render').args[1];
    for(const name of ['downloadHtml','openReport'])eq(calls.find(c=>c.name===name).args[0],renderModel,`${name} retains rendered model`);
    eq(calls.find(c=>c.name==='downloadJson').args[0],raw,'JSON handler retains selected saved report');
    eq(JSON.stringify(raw),initial,'fixture/source never rewritten');
    eq(requests.length,2,'exports do not request new generation');
    const screenshot=path.join(out,`${engineName}-${width}-${variant.name}.png`);await page.screenshot({path:screenshot,fullPage:false});
    results.push({engine:engineName,width,case:variant.name,sourceResultSha256:sha(initial),savedId:ID,sourceRunIds:SOURCE_IDS,reads:requests.length,screenshot,mockOnly:true});
    await context.close();
  }}finally{await browser.close();}
}}finally{await new Promise(r=>server.close(r));}
eq(errors,[],'no page errors');eq(unexpected,[],'no unexpected external requests');
const receipt={status:'PASS_MOCK_ONLY',checks,layouts:results.length,productionRequests:0,providerCalls:0,pdfsGenerated:0,
  sourceHashes:{page:sha(pageSource),renderer:sha(rendererSource),harness:sha(fs.readFileSync(import.meta.filename))},results};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({...receipt,results:undefined,out}));
