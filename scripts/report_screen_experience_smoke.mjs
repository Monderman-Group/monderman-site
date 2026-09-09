// Screen controls must preserve the complete report and its print geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-screen-experience';
const aiRefreshOnly = process.argv.includes('--ai-refresh-only');
fs.mkdirSync(out, {recursive:true});

async function verifyAIScreenRefresh(browser) {
  const artifact = JSON.parse(fs.readFileSync('sample-data/production-diagnostic-samples.json','utf8'));
  const sample = fs.readFileSync('sample-report.html','utf8');
  const fixtureStart = sample.indexOf('window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES =');
  const fixtureEnd = sample.indexOf('(function renderRepresentativeSyntheses()',fixtureStart);
  assert.ok(fixtureStart >= 0 && fixtureEnd > fixtureStart);
  const fixtureScope = {window:{}};
  vm.runInNewContext(sample.slice(fixtureStart,fixtureEnd),fixtureScope);
  const fixtures = Object.entries(artifact.outputs).map(([name,source])=>({name,source,kind:'run'}));
  fixtures.push(...Object.entries(fixtureScope.window.MONDERMAN_REPRESENTATIVE_SYNTHESIS_FIXTURES).map(([name,source])=>({name,source,kind:'synthesis'})));
  assert.equal(fixtures.length,6);
  const lifecycle = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors = [], rows = [];
  lifecycle.on('pageerror',error=>errors.push(error.message));
  // Synthetic display data only: never visit a service or a customer account.
  await lifecycle.route('**/*',route=>route.abort());
  await lifecycle.setContent('<!doctype html><html><head></head><body><div id="refresh-primary"></div><div id="refresh-peer"></div></body></html>');
  await lifecycle.addScriptTag({content:fs.readFileSync('monderman-report.js','utf8')});
  await lifecycle.clock.install({time:new Date('2026-09-09T12:00:00Z')});
  try {
    for (const fixture of fixtures) {
      const initial = await lifecycle.evaluate(fixture=>{
        const R=MondermanReport,host=document.getElementById('refresh-primary'),peer=document.getElementById('refresh-peer');
        const base=fixture.kind==='run'?R.fromRun(fixture.source):R.fromSynthesis(fixture.source);
        const complete={status:'complete',report:{model:'synthetic-display-only',interpretation:{summary:'Synthetic screen refresh fixture.',recommendations:[{action:'CURRENT_AI_ACTION '+fixture.name,reason:'Review the supplied evidence first.',prerequisite:'REQUIRED_CONTEXT '+fixture.name,risk:'REQUIRED_RISK '+fixture.name,success_check:'Check the same bounded work.'}]}}};
        const pending={status:'pending',message:'Synthetic interpretation pending.',report:{interpretation:{recommendations:[{action:'STALE_AI_ACTION'}]}}};
        const model={...base,aiReport:structuredClone(pending)},before=JSON.stringify(model);
        R.render(host,model);R.render(peer,model);
        const initialAI=host.querySelector('.mr-ai-interpretation'),aiId=initialAI.id;
        const result={ai_report:structuredClone(pending)};
        let calls=0;
        const stop=R.mountAIInterpretation(host,result,async()=>({ai_report:structuredClone(++calls===1?pending:complete)}));
        const reportPage=host.querySelector('.mr-page'),nav=host.querySelector('.mr-screen-nav'),contents=nav.querySelector('details'),summary=contents.querySelector('summary');
        contents.open=true;summary.focus({preventScroll:true});
        const nonAI=Array.from(reportPage.children).filter(node=>!node.matches('.mr-screen-only,.mr-ai-inline'));
        const bodySnapshot=()=>{const clone=reportPage.cloneNode(true);clone.querySelectorAll('.mr-screen-only,.mr-ai-inline').forEach(node=>node.remove());return clone.innerHTML;};
        window.screenRefresh={base,model,before,complete,pending,result,stop,host,peer,aiId,nav,contents,summary,reportPage,nonAI,bodySnapshot,bodyBefore:bodySnapshot(),calls:()=>calls,scrollY};
        const ids=Array.from(document.querySelectorAll('[id]')).map(node=>node.id);
        return {aiId,liveAttribute:host.querySelector('.mr-ai-interpretation').getAttribute('aria-live'),allSectionsIncludesAI:!!Array.from(nav.querySelectorAll('a')).find(link=>link.getAttribute('href')==='#'+aiId),noStale:!host.textContent.includes('STALE_AI_ACTION'),unique:ids.length===new Set(ids).size,unmutated:JSON.stringify(model)===before};
      },fixture);
      assert.ok(initial.aiId && initial.allSectionsIncludesAI,fixture.name+' pending AI is missing its stable navigation target');
      assert.equal(initial.liveAttribute,'polite');
      assert.ok(initial.noStale && initial.unique && initial.unmutated,JSON.stringify({name:fixture.name,...initial}));
      await lifecycle.clock.fastForward(15000);
      const unchanged = await lifecycle.evaluate(()=>{const x=screenRefresh;return {calls:x.calls(),navSame:x.nav===x.host.querySelector('.mr-screen-nav'),contentsSame:x.contents===x.host.querySelector('.mr-screen-contents'),open:x.contents.open,focus:document.activeElement===x.summary,bodySame:x.bodySnapshot()===x.bodyBefore};});
      assert.deepEqual(unchanged,{calls:1,navSame:true,contentsSame:true,open:true,focus:true,bodySame:true},fixture.name+' unchanged pending poll replaced controls or report content');
      await lifecycle.clock.fastForward(15000);
      const completed = await lifecycle.evaluate(()=>{
        const x=screenRefresh,host=x.host,nav=host.querySelector('.mr-screen-nav'),action=Array.from(nav.querySelectorAll('.mr-screen-shortcuts a')).find(link=>link.textContent==='Actions');
        return {calls:x.calls(),aiId:host.querySelector('.mr-ai-inline').id,actionTarget:action?.getAttribute('href'),coverTarget:host.querySelector('.mr-screen-next a')?.getAttribute('href'),coverText:host.querySelector('.mr-screen-next')?.textContent,mainContext:host.querySelector('.mr-ai-interpretation').textContent,peerPending:x.peer.textContent.includes('Synthetic interpretation pending.')&&!x.peer.textContent.includes('CURRENT_AI_ACTION'),pageSame:x.reportPage===host.querySelector('.mr-page'),nodesSame:x.nonAI.every(node=>node.isConnected&&x.reportPage.contains(node)),bodySame:x.bodySnapshot()===x.bodyBefore,unmutated:JSON.stringify(x.model)===x.before,contentsOpen:nav.querySelector('details').open,summaryFocused:document.activeElement===nav.querySelector('summary'),scrollSame:scrollY===x.scrollY};
      });
      assert.equal(completed.calls,2);assert.equal(completed.aiId,initial.aiId);
      assert.equal(completed.actionTarget,'#'+initial.aiId);assert.equal(completed.coverTarget,'#'+initial.aiId);
      assert.ok(completed.coverText.includes('CURRENT_AI_ACTION '+fixture.name));
      assert.ok(completed.mainContext.includes('REQUIRED_CONTEXT '+fixture.name)&&completed.mainContext.includes('REQUIRED_RISK '+fixture.name));
      for(const key of ['peerPending','pageSame','nodesSame','bodySame','unmutated','contentsOpen','summaryFocused','scrollSame'])assert.equal(completed[key],true,fixture.name+' completion changed '+key);
      await lifecycle.locator('#refresh-primary .mr-screen-shortcuts a').filter({hasText:/^Actions$/}).click();
      assert.equal(await lifecycle.evaluate(()=>document.activeElement.id),initial.aiId,fixture.name+' completed action shortcut has the wrong focus target');
      const remount = await lifecycle.evaluate(()=>{const x=screenRefresh;x.stop();const stop=MondermanReport.mountAIInterpretation(x.host,x.result);stop();return {wrappers:x.host.querySelectorAll('.mr-ai-inline').length,sections:x.host.querySelectorAll('.mr-ai-interpretation').length,id:x.host.querySelector('.mr-ai-inline').id,inside:x.reportPage.contains(x.host.querySelector('.mr-ai-inline'))};});
      assert.deepEqual(remount,{wrappers:1,sections:1,id:initial.aiId,inside:true},fixture.name+' remount detached or duplicated the AI section');
      await lifecycle.emulateMedia({media:'print'});
      assert.equal(await lifecycle.locator('#refresh-primary .mr-screen-nav').isVisible(),false);
      assert.equal(await lifecycle.locator('#refresh-primary .mr-screen-next').isVisible(),false);
      assert.equal(await lifecycle.locator('#refresh-primary .mr-ai-interpretation').isVisible(),true);
      await lifecycle.emulateMedia({media:'screen'});
      await lifecycle.setViewportSize({width:390,height:844});
      await lifecycle.locator('#refresh-primary .mr-cover').screenshot({path:path.join(out,fixture.name+'-ai-refreshed-cover-mobile.png')});
      await lifecycle.setViewportSize({width:1440,height:1000});
      const terminalStates=[];
      for(const status of ['pending','processing','attention_required','rejected']) {
        await lifecycle.evaluate(status=>{
          const x=screenRefresh,model={...x.base,aiReport:structuredClone(x.pending)},result={ai_report:structuredClone(x.pending)};
          MondermanReport.render(x.host,model);
          const before=JSON.stringify(model);
          const next={status,message:'Synthetic '+status,report:{interpretation:{recommendations:[{action:'STALE_AI_ACTION'}]}}};
          let calls=0;
          x.stateTest={model,before,calls:()=>calls,stop:MondermanReport.mountAIInterpretation(x.host,result,async()=>{calls++;return {ai_report:next};})};
        },status);
        await lifecycle.clock.fastForward(15000);
        const state=await lifecycle.evaluate(()=>{const x=screenRefresh,t=x.stateTest;t.stop();const ids=Array.from(document.querySelectorAll('[id]')).map(node=>node.id);return {calls:t.calls(),noStale:!x.host.textContent.includes('STALE_AI_ACTION'),unmutated:JSON.stringify(t.model)===t.before,unique:ids.length===new Set(ids).size,allTargetsLocal:Array.from(x.host.querySelectorAll('.mr-screen-nav a,.mr-screen-next a')).every(link=>x.host.contains(document.getElementById(link.getAttribute('href').slice(1))))};});
        assert.deepEqual(state,{calls:1,noStale:true,unmutated:true,unique:true,allTargetsLocal:true},fixture.name+' '+status+' exposed stale action or invalid target');
        terminalStates.push(status);
      }
      rows.push({product:fixture.name,initial,unchanged,completed,remount,terminalStates});
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'ai-refresh-checks.json'),JSON.stringify({syntheticOnly:true,networkBlocked:true,products:rows.length,rows,errors},null,2));
    return rows;
  } finally { await lifecycle.close(); }
}

// Validate the actual built HTML boundary before testing isolated result DOM.
// A body-tag replacement inside an exported-report template can silently cut
// off the host instrument's script, leaving its loading screen in place.
if (!aiRefreshOnly) for (const product of ['operational-systems','decision-velocity','structural-clarity','institutional-performance']) {
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
if (aiRefreshOnly) {
  await verifyAIScreenRefresh(browser);
  await browser.close();
  console.log('REPORT_SCREEN_AI_REFRESH_PASS all6 pending/complete/attention/rejected, stableTargets, isolatedMounts, unchangedModelAndBody, focus, printControls; network blocked');
  process.exit(0);
}
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
await verifyAIScreenRefresh(browser);
await browser.close();
console.log('REPORT_SCREEN_EXPERIENCE_PASS all6 navigation, originalBodyParity, uniqueMounts, immutableModels, mobile, printControls; all4 direct textContrast, availability, focus, accordion, exportExclusion');
