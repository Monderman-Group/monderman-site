// Screen controls must preserve the complete report and its print geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-screen-experience';
fs.mkdirSync(out, {recursive:true});
// Validate the actual built HTML boundary before testing isolated result DOM.
// A body-tag replacement inside an exported-report template can silently cut
// off the host instrument's script, leaving its loading screen in place.
for (const product of ['operational-systems','decision-velocity','structural-clarity','institutional-performance']) {
  const built=fs.readFileSync(path.join('.render-public',product+'.html'),'utf8');
  let screenLoaders=0;
  for (const [tag,attributes,code] of built.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=["']report-screen-experience\.js(?:\?[^"']*)?["']/i.test(attributes)) screenLoaders++;
    if (/\bsrc=|\btype=["'](?:module|application\/ld\+json)["']/i.test(attributes) || !code.trim()) continue;
    new vm.Script(code,{filename:product+'.html inline script'});
  }
  assert.equal(screenLoaders,1,product+' must load result navigation as a real external script');
}
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await page.route(/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/, route => route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.basename(new URL(route.request().url()).pathname))}));
await page.goto(base+'/sample-report.html',{waitUntil:'networkidle'});
await page.locator('body.production-samples-ready').waitFor();
assert.equal(await page.locator('.sample-library-method').getAttribute('open'),null);
await page.locator('.sample-library-method summary').click();
assert.ok((await page.locator('.sample-library-method').innerText()).includes('declared coherence controls pass'));
await page.locator('.sample-library-method summary').click();
for(const key of ['os','dv','sc','ip','synthesis','depth']) {
  await page.locator(`[data-target="${key}"]`).click();
  const shell=page.locator(`[data-report="${key}"]`);
  const destinations=await shell.locator('.mr-screen-shortcuts a').evaluateAll(links=>links.map(link=>({text:link.textContent,id:link.hash.slice(1),exists:!!document.getElementById(link.hash.slice(1))})));
  assert.ok(destinations.length>=4 && destinations.every(link=>link.exists),key+' missing navigation target');
  const next=shell.locator('.mr-screen-next a');
  assert.equal(await next.count(),1,key+' missing supported action destination');
  await next.click();
  assert.ok(await next.evaluate(link=>document.activeElement?.id===link.getAttribute('href').slice(1)),key+' action destination cannot be reached');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),key+' mobile overflow');
  await shell.locator('.mr-cover').screenshot({path:path.join(out,key+'-cover-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
}
const invariants=await page.evaluate(async()=>{
  const artifact=await fetch('sample-data/production-diagnostic-samples.json?v=447cdd78f6fc').then(r=>r.json());
  const models=Object.values(artifact.outputs).map(run=>MondermanReport.fromRun(run));
  models.push(MondermanReport.fromSynthesis(MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES.crossLens),MondermanReport.fromSynthesis(MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES.depth));
  return models.map(model=>{
    const before=JSON.stringify(model);
    const wrapper=document.createElement('div');document.body.append(wrapper);
    MondermanReport.render(wrapper,model);
    const printed=wrapper.querySelector('.mr-page').cloneNode(true);
    printed.querySelectorAll('.mr-screen-only').forEach(node=>node.remove());
    printed.querySelectorAll('section[id]').forEach(node=>node.removeAttribute('id'));
    const baseline=document.createElement('div');baseline.innerHTML=MondermanReport.buildReportBody(model);
    const normalizeSvg = html => html.replace(/id="mr-[^"]+-system-gradient"/g,'id="mr-system-gradient"').replace(/url\(#mr-[^)]+-system-gradient\)/g,'url(#mr-system-gradient)');
    const intact=normalizeSvg(printed.innerHTML)===baseline.innerHTML;
    const mutated=JSON.stringify(model)!==before;
    const another=document.createElement('div');document.body.append(another);MondermanReport.render(another,model);
    const ids=[...wrapper.querySelectorAll('[id]'),...another.querySelectorAll('[id]')].map(node=>node.id);
    const unique=ids.length===new Set(ids).size;
    wrapper.remove();another.remove();
    return {product:model.filenameBase,intact,mutated,unique};
  });
});
assert.ok(invariants.every(row=>row.intact&&!row.mutated&&row.unique),JSON.stringify(invariants));
await page.emulateMedia({media:'print'});
assert.equal(await page.locator('#report-depth .mr-screen-nav').isVisible(),false,'screen nav appears in print');
assert.equal(await page.locator('#report-depth .mr-screen-next').isVisible(),false,'screen action appears in print');
await page.emulateMedia({media:'screen'});
await page.setViewportSize({width:1440,height:1000});
await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0)});
await page.screenshot({path:path.join(out,'sample-library-desktop.png')});
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>scrollTo(0,0));
await page.screenshot({path:path.join(out,'sample-library-mobile.png')});
// Use each real direct-result DOM and its existing accordion/export functions
// in an isolated browser fixture. No accounts, API calls or new runs are used.
for (const product of ['operational-systems','decision-velocity','structural-clarity','institutional-performance']) {
  const source=fs.readFileSync(product+'.html','utf8');
  const direct=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const fixture=await page.evaluate(html=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {styles:[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n'),links:[...doc.querySelectorAll('link[rel=stylesheet]')].map(link=>link.outerHTML).join(''),result:doc.querySelector('#resultsStage').outerHTML};
  },source);
  await direct.setContent('<!doctype html><html><head><base href="'+base+'/">'+fixture.links+'<style>'+fixture.styles+'</style><style>'+fs.readFileSync('report-screen-experience.css','utf8')+'</style></head><body><main style="max-width:1180px;margin:30px auto;padding:0 20px">'+fixture.result+'</main></body></html>');
  await direct.evaluate(()=>document.getElementById('resultsStage').classList.add('active'));
  const start=source.indexOf('function renderAccordionBindings()');
  const binding=source.slice(start,source.indexOf('\nfunction ',start+10));
  await direct.evaluate(code=>new Function('$',code+';renderAccordionBindings();')(id=>document.getElementById(id)),binding);
  await direct.addScriptTag({content:fs.readFileSync('report-screen-experience.js','utf8')});
  const evidence=direct.locator('.rsx-nav button').filter({hasText:/^Evidence$/});
  assert.equal(await evidence.isVisible(),false,product+' unavailable evidence has a dead shortcut');
  const contrast=await direct.locator('.finding-lead,.finding-body,.score-band,.score-summary,.insight-depth-label,.insight-depth-value,.insight-depth-copy,.score-panel .score-number,.score-panel .score-kicker,.score-panel .score-badge,.score-panel .score-meta-pill').evaluateAll(nodes=>{
    const luminance=rgb=>rgb.map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    return nodes.map(node=>{
      const channels=getComputedStyle(node).color.match(/[\d.]+/g).map(Number);
      const alpha=channels[3]??1;
      const onWhite=channels.slice(0,3).map(value=>value*alpha+255*(1-alpha));
      return {selector:node.className,color:getComputedStyle(node).color,ratio:(1.05)/(luminance(onWhite)+.05)};
    });
  });
  assert.ok(contrast.length>=7 && contrast.every(item=>item.ratio>=4.5),product+' insufficient result contrast: '+JSON.stringify(contrast));
  await direct.locator('.rsx-nav button').filter({hasText:/^Actions$/}).click();
  assert.ok(await direct.locator('[data-accordion="remedy"]').evaluate(el=>el.classList.contains('open')),product+' actions shortcut did not open existing accordion');
  assert.ok(await direct.locator('[data-accordion="remedy"] .accordion-header').evaluate(el=>document.activeElement===el),product+' actions shortcut did not move focus');
  await direct.locator('.rsx-nav button').filter({hasText:/^Overview$/}).click();
  assert.ok(await direct.locator('.score-panel').evaluate(el=>document.activeElement===el),product+' overview did not move focus');
  await direct.evaluate(()=>document.getElementById('experienceAccordion').classList.remove('hidden'));
  await evidence.waitFor({state:'visible'});
  await evidence.click();
  assert.ok(await direct.locator('#experienceAccordion').evaluate(el=>el.classList.contains('open')),product+' available evidence cannot be reached');
  await direct.evaluate(()=>document.getElementById('experienceAccordion').classList.add('hidden'));
  await evidence.waitFor({state:'hidden'});
  const exportFunction = product==='operational-systems' ? 'prepareStandaloneResultsClone' : product==='institutional-performance' ? 'buildFullReportHTML' : 'buildStandaloneResultsHTML';
  const exportStart=source.indexOf('function '+exportFunction+'(');
  assert.ok(exportStart>=0,product+' export builder not found');
  const exportCode=source.slice(exportStart,source.indexOf('\nfunction ',exportStart+10));
  const exported=await direct.evaluate(({code,name})=>{
    const call = name==='prepareStandaloneResultsClone' ? 'prepareStandaloneResultsClone({score:51}).outerHTML' : name==='buildFullReportHTML' ? 'buildFullReportHTML({score:51},{processName:"Fixture"},"Fixture")' : 'buildStandaloneResultsHTML({score:51})';
    return new Function('buildStandaloneChartDataUrl','escapeHtml','getReportStyles',code+';return '+call+';')(()=>null,value=>String(value),()=>'');
  },{code:exportCode,name:exportFunction});
  assert.ok(!exported.includes('rsx-nav'),product+' screen navigation leaked into direct HTML export');
  await direct.setViewportSize({width:390,height:844});
  const overflow=await direct.evaluate(()=>({ok:document.documentElement.scrollWidth<=innerWidth+1,width:document.documentElement.scrollWidth,items:[...document.querySelectorAll('#resultsStage *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1 && el.getBoundingClientRect().width>0).map(el=>el.className).slice(0,18)}));
  assert.ok(overflow.ok,product+' direct mobile overflow '+JSON.stringify(overflow));
  if(product==='decision-velocity') {
    await direct.setViewportSize({width:1440,height:1000});
    await direct.locator('.rsx-nav').screenshot({path:path.join(out,'direct-no-participant-notes-navigation.png')});
  }
  await direct.close();
}
await browser.close();
console.log('REPORT_SCREEN_EXPERIENCE_PASS all6 navigation, originalBodyParity, uniqueMounts, immutableModels, mobile, printControls; all4 direct textContrast, availability, focus, accordion, exportExclusion');
