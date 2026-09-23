// Screen controls must preserve the complete report and its print geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
import {LEGACY_PLANNING_NOTE_HTML} from './report_three_benefit_presentation_inverse.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || process.env.REPORT_BASE || 'http://127.0.0.1:8080';
const out = process.env.REPORT_OUT || '/tmp/report-screen-experience';
const aiRefreshOnly = process.argv.includes('--ai-refresh-only');
fs.mkdirSync(out, {recursive:true});
async function emulateMediaAndSettle(page, media) {
  await page.emulateMedia({media});
  await page.waitForFunction(mode=>matchMedia(mode).matches,media);
  // Emulation can update matchMedia before computed styles leave the previous
  // medium. Let rendering settle before measuring either screen or print;
  // the exact style assertions below still reject persistent regressions.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function verifyAIScreenRefresh(browser) {
  const {artifact}=readPublicSampleFixture();
  const fixtures = Object.entries(artifact.outputs).map(([name,entry])=>({name,source:entry.source,kind:entry.kind==='diagnostic'?'run':'synthesis'}));
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
        // Each fixture starts at the overview. Do not inherit scroll from
        // the preceding product's mobile screenshot or action navigation.
        window.scrollTo(0,0);
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
        return {aiId,liveAttribute:host.querySelector('.mr-ai-interpretation').getAttribute('aria-live'),allSectionsIncludesAI:!!Array.from(nav.querySelectorAll('a')).find(link=>link.getAttribute('href')==='#'+aiId),noStale:!host.textContent.includes('STALE_AI_ACTION'),unique:ids.length===new Set(ids).size,unmutated:JSON.stringify(model)===before,pendingNextStep:host.querySelector('.mr-screen-next p')?.textContent};
      },fixture);
      assert.ok(initial.aiId && initial.allSectionsIncludesAI,fixture.name+' pending AI is missing its stable navigation target');
      assert.equal(initial.liveAttribute,'polite');
      assert.equal(initial.pendingNextStep,'Review the suggested changes and their evidence before choosing a test.',fixture.name+' must not present a category label as a task');
      assert.ok(initial.noStale && initial.unique && initial.unmutated,JSON.stringify({name:fixture.name,...initial}));
      await lifecycle.clock.fastForward(15000);
      const unchanged = await lifecycle.evaluate(()=>{const x=screenRefresh;return {calls:x.calls(),navSame:x.nav===x.host.querySelector('.mr-screen-nav'),contentsSame:x.contents===x.host.querySelector('.mr-screen-contents'),open:x.contents.open,focus:document.activeElement===x.summary,bodySame:x.bodySnapshot()===x.bodyBefore};});
      assert.deepEqual(unchanged,{calls:1,navSame:true,contentsSame:true,open:true,focus:true,bodySame:true},fixture.name+' unchanged pending poll replaced controls or report content');
      await lifecycle.clock.fastForward(15000);
      const completed = await lifecycle.evaluate(()=>{
        const x=screenRefresh,host=x.host,nav=host.querySelector('.mr-screen-nav'),action=Array.from(nav.querySelectorAll('.mr-screen-shortcuts a')).find(link=>link.textContent==='Actions');
        return {calls:x.calls(),aiId:host.querySelector('.mr-ai-inline').id,actionTarget:action?.getAttribute('href'),coverTarget:host.querySelector('.mr-screen-next a')?.getAttribute('href'),coverText:host.querySelector('.mr-screen-next')?.textContent,mainContext:host.querySelector('.mr-ai-interpretation').textContent,peerPending:x.peer.textContent.includes('Synthetic interpretation pending.')&&!x.peer.textContent.includes('CURRENT_AI_ACTION'),pageSame:x.reportPage===host.querySelector('.mr-page'),nodesSame:x.nonAI.every(node=>node.isConnected&&x.reportPage.contains(node)),bodySame:x.bodySnapshot()===x.bodyBefore,unmutated:JSON.stringify(x.model)===x.before,contentsOpen:nav.querySelector('details').open,summaryFocused:document.activeElement===nav.querySelector('summary'),scrollSame:scrollY===x.scrollY,scroll:{before:x.scrollY,after:scrollY},overviewTarget:host.querySelector('[data-report-link-role="overview-actions"]')?.getAttribute('href'),overviewText:host.querySelector('[data-report-link-role="overview-actions"]')?.textContent};
      });
      assert.equal(completed.calls,2);assert.equal(completed.aiId,initial.aiId);
      assert.equal(completed.actionTarget,'#'+initial.aiId);assert.equal(completed.coverTarget,'#'+initial.aiId);
      assert.equal(completed.overviewTarget,'#'+initial.aiId,'Updated overview targets the completed interpretation');
      assert.ok(completed.overviewText.includes('CURRENT_AI_ACTION '+fixture.name),'Updated overview shows the completed action');
      assert.ok(completed.coverText.includes('CURRENT_AI_ACTION '+fixture.name));
      assert.ok(completed.mainContext.includes('REQUIRED_CONTEXT '+fixture.name)&&completed.mainContext.includes('REQUIRED_RISK '+fixture.name));
      for(const key of ['peerPending','pageSame','nodesSame','bodySame','unmutated','contentsOpen','summaryFocused','scrollSame'])assert.equal(completed[key],true,fixture.name+' completion changed '+key+' '+JSON.stringify(completed.scroll));
      await lifecycle.locator('#refresh-primary .mr-screen-shortcuts a').filter({hasText:/^Actions$/}).click();
      assert.equal(await lifecycle.evaluate(()=>document.activeElement.id),initial.aiId,fixture.name+' completed action shortcut has the wrong focus target');
      const remount = await lifecycle.evaluate(()=>{const x=screenRefresh;x.stop();const stop=MondermanReport.mountAIInterpretation(x.host,x.result);stop();return {wrappers:x.host.querySelectorAll('.mr-ai-inline').length,sections:x.host.querySelectorAll('.mr-ai-interpretation').length,id:x.host.querySelector('.mr-ai-inline').id,inside:x.reportPage.contains(x.host.querySelector('.mr-ai-inline'))};});
      assert.deepEqual(remount,{wrappers:1,sections:1,id:initial.aiId,inside:true},fixture.name+' remount detached or duplicated the AI section');
      await emulateMediaAndSettle(lifecycle,'print');
      assert.equal(await lifecycle.locator('#refresh-primary .mr-screen-nav').isVisible(),false);
      assert.equal(await lifecycle.locator('#refresh-primary .mr-screen-next').isVisible(),false);
      assert.equal(await lifecycle.locator('#refresh-primary .mr-ai-interpretation').isVisible(),true);
      await emulateMediaAndSettle(lifecycle,'screen');
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
assert.ok((await page.locator('.sample-library-method').innerText()).includes('A combined score appears only when the inputs meet Monderman’s comparison requirements'));
await page.locator('.sample-library-method summary').click();
for(const key of ['os','dv','sc','ip','synthesis','depth']) {
  await page.locator(`[data-target="${key}"]`).click();
  const shell=page.locator(`[data-report="${key}"]`);
  const surface=await shell.evaluate(root=>{
    const css=selector=>getComputedStyle(root.querySelector(selector));
    const method=css('.mr-run-method,.mr-meta-method');
    return {
      titleMargin:css('.mr-cover-title').marginTop,
      headingWidth:css('.mr-section h2').maxWidth,
      methodHeadingTop:css('.mr-run-method>h2,.mr-meta-method>h2').marginTop,
      methodPadding:parseFloat(method.paddingLeft),
      methodBackground:method.backgroundColor,
      categories:[...root.querySelectorAll('.mr-run-metric[data-tone="amber"],.mr-action-step[data-tier="behavioral"]')].map(node=>getComputedStyle(node).borderTopColor)
    };
  });
  assert.equal(surface.titleMargin,'0px',key+' cover heading gained editorial top spacing');
  assert.equal(surface.headingWidth,'none',key+' compact heading kept oversized-type line restriction');
  assert.equal(surface.methodHeadingTop,'0px',key+' section heading doubles its parent spacing');
  assert.ok(surface.methodPadding>=18,key+' method panel has no inner horizontal spacing');
  assert.equal(surface.methodBackground,'rgb(244, 247, 248)',key+' method panel uses a legacy paper surface');
  assert.ok(surface.categories.length && surface.categories.every(color=>color==='rgb(201, 162, 39)'),key+' category accents must use the approved gold');
  const destinations=await shell.locator('.mr-screen-shortcuts a').evaluateAll(links=>links.map(link=>({text:link.textContent,id:link.hash.slice(1),exists:!!document.getElementById(link.hash.slice(1))})));
  assert.ok(destinations.length>=4 && destinations.every(link=>link.exists),key+' missing navigation target');
  const legacyNext=shell.locator('.mr-screen-next a');
  assert.equal(await legacyNext.isVisible(),false,key+' prior cover guidance stays replaced by overview');
  const next=shell.locator('.mr-overview-tile[data-report-link-role="overview-actions"]');
  assert.equal(await next.count(),1,key+' missing supported action destination');
  assert.ok(await next.evaluate((link,legacyTarget)=>document.getElementById(link.hash.slice(1))?.contains(document.getElementById(legacyTarget.slice(1))),await legacyNext.getAttribute('href')),key+' overview guidance section contains the complete supported action destination');
  await next.click();
  assert.ok(await next.evaluate(link=>document.activeElement?.id===link.getAttribute('href').slice(1)),key+' action destination cannot be reached');
  assert.equal(await page.locator('.report-sheet>.dx-tabs-wrap').evaluate(node=>getComputedStyle(node).position),'relative','product tabs compete with report navigation for the same sticky position');
  assert.ok(await shell.locator('.mr-screen-nav').evaluate(node=>node.getBoundingClientRect().top>=document.querySelector('.header').getBoundingClientRect().bottom),key+' sticky navigation overlaps the fixed site header');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),key+' mobile overflow');
  assert.equal(await shell.locator('.mr-screen-contents').isVisible(),false,key+' duplicates the mobile section selector');
  await shell.locator('.mr-cover').screenshot({path:path.join(out,key+'-cover-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
}
// Earlier saved reports preserve their explanation and complete tables without
// the retired graphic; current publications exercise the v2 three-benefit UI.
const legacyArtifact=JSON.parse(execFileSync('git',['show','b06b72083442f03f7a1e2cadeb5239e4f0449515:sample-data/production-diagnostic-samples.json'],{encoding:'utf8',maxBuffer:32e6}));
const legacySources=['depth_synthesis','cross_lens_synthesis'].map(key=>legacyArtifact.outputs[key].source);
const invariants=await page.evaluate(async ({legacySources,legacyNoteHtml})=>{
  const artifact=await fetch('sample-data/production-diagnostic-samples.json').then(r=>r.json());
  MondermanPublicSamples.validate(artifact);
  const models=[...Object.values(artifact.outputs).map(entry=>({model:MondermanPublicSamples.model(entry,artifact),fixture:'current'})),
    ...legacySources.map(source=>({model:MondermanReport.fromSynthesis(source),fixture:'historical-v1'}))];
  // Planning controls intentionally use the same unique per-mount prefix as
  // section navigation. Validate every binding before removing only this
  // presentation namespace; never discard control attributes or report text.
  const normalizePlanningCaseNamespace=(root,prefix)=>{
    const require=(condition,message)=>{if(!condition)throw new Error(message);};
    const groups=[...root.querySelectorAll('.mr-planning-controls')];
    require(groups.length<=1,'Unexpected planning control group');
    for(const group of groups){
      require(group.querySelectorAll('input').length===3&&group.querySelectorAll('label').length===3&&group.querySelectorAll('.mr-planning-panel').length===3,'Incomplete planning case controls');
      for(const [attribute,count]of [['id',6],['name',3],['for',3],['aria-labelledby',3]])require(group.querySelectorAll('['+attribute+']').length===count,'Unexpected planning '+attribute+' attributes');
      const ids=[...group.querySelectorAll('[id]')].map(node=>node.id);
      require(ids.length===new Set(ids).size,'Duplicate planning control ID');
      for(const level of ['low','central','high']){
        const input=group.querySelector('.mr-planning-choice-'+level);
        const panel=group.querySelector('.mr-planning-panel-'+level);
        const title=panel?.querySelector('h4');
        const label=input?.nextElementSibling;
        const inputId=prefix+'-planning-choice-'+level,titleId=prefix+'-planning-title-'+level;
        require(input?.type==='radio'&&input.value===level&&input.id===inputId&&input.name===prefix+'-planning-case','Invalid planning radio binding');
        require(label?.tagName==='LABEL'&&label.getAttribute('for')===inputId,'Invalid planning label binding');
        require(panel?.getAttribute('aria-labelledby')===titleId&&title?.id===titleId,'Invalid planning panel heading binding');
        input.setAttribute('id','mr-planning-choice-'+level);input.setAttribute('name','mr-planning-case');
        label.setAttribute('for','mr-planning-choice-'+level);
        panel.setAttribute('aria-labelledby','mr-planning-title-'+level);title.setAttribute('id','mr-planning-title-'+level);
      }
    }
    return groups.length;
  };
  const normalizeThreeBenefitNamespace=(root,prefix,scenario)=>{
    const require=(condition,message)=>{if(!condition)throw new Error(message);};
    const groups=[...root.querySelectorAll('.mr-financial-brief.mr-three-benefit>fieldset')];
    require(groups.length<=1,'Unexpected three-benefit control group');
    const levels=['low','central','high'],costCase={low:'high',central:'central',high:'low'};
    const labels={spendingReduction:'Lower current spending',spendingAvoidance:'Avoided future spending',staffCapacity:'Retained staff capacity'};
    const headline=value=>(value<0?'-$':'$')+Math.abs(value).toLocaleString('en-US',{maximumFractionDigits:0});
    for(const group of groups){
      require(scenario?.version==='operational-planning-scenario-20260919.2','Three-benefit controls require saved v2 source');
      require(group.querySelectorAll('input').length===3&&group.querySelectorAll('label').length===3&&group.querySelectorAll('.mr-benefit-panel').length===3,'Incomplete three-benefit case controls');
      for(const [attribute,count]of [['id',3],['name',3],['for',3],['aria-labelledby',0]])require(group.querySelectorAll('['+attribute+']').length===count,'Unexpected three-benefit '+attribute+' attributes');
      require(group.querySelectorAll('input[checked]').length===1&&group.querySelector('.mr-benefit-radio-central')?.hasAttribute('checked'),'Central three-benefit case must remain selected');
      for(const level of levels){
        const input=group.querySelector('.mr-benefit-radio-'+level),label=input?.nextElementSibling;
        const panel=group.querySelector('.mr-benefit-'+level),inputId=prefix+'-planning-benefit-'+level;
        require(input?.type==='radio'&&input.value===level&&input.id===inputId&&input.name===prefix+'-planning-benefit','Invalid three-benefit radio binding');
        require(label?.tagName==='LABEL'&&label.getAttribute('for')===inputId,'Invalid three-benefit label binding');
        require(panel?.getAttribute('data-three-benefit-case')===level&&panel.querySelector('h3')?.textContent===level[0].toUpperCase()+level.slice(1)+' planning case','Invalid three-benefit case panel');
        require(panel.querySelectorAll('.mr-benefit-card').length===3,'Missing benefit category');
        for(const [key,title]of Object.entries(labels)){
          const card=panel.querySelector('[data-benefit="'+key+'"]'),benefit=scenario.benefits[key],value=benefit.amount[level],amount=card?.querySelector('strong');
          require(card?.getAttribute('data-status')===benefit.status&&card.querySelector('h4')?.textContent===title,'Invalid benefit category or status');
          require(amount?.getAttribute('data-saved-value')===String(value)&&amount.textContent===headline(value),'Three-benefit amount differs from saved case');
        }
        const net=[...panel.querySelectorAll('.mr-benefit-net strong')],expected=[scenario.totals.totalImplementationAndSubscriptionCost[costCase[level]],scenario.totals.netKnownBenefitSubtotal[level]];
        require(net.length===2&&net.every((node,index)=>node.getAttribute('data-saved-value')===String(expected[index])&&node.textContent===headline(expected[index])),'Three-benefit cost pairing or net value differs from saved case');
        input.setAttribute('id','mr-planning-benefit-'+level);input.setAttribute('name','mr-planning-benefit');
        label.setAttribute('for','mr-planning-benefit-'+level);
      }
    }
    return groups.length;
  };
  const normalizeSvg = html => html.replace(/id="mr-[^"]+-system-gradient"/g,'id="mr-system-gradient"').replace(/url\(#mr-[^)]+-system-gradient\)/g,'url(#mr-system-gradient)');
  const validateLegacyPlanning=(root,scenario)=>{
    const require=(condition,message)=>{if(!condition)throw new Error(message);};
    const figure=root.querySelector('.mr-operational-sankey');
    require(root.querySelectorAll('.mr-operational-sankey').length===1,'Missing or repeated saved-planning figure');
    require(figure.querySelector('.mr-legacy-planning-note')?.outerHTML===legacyNoteHtml,'Changed saved-planning explanation');
    require(!figure.querySelector('.mr-planning-controls,.mr-planning-panel,svg,[data-sankey-node],[data-planning-node]'),'Retired chart or controls reintroduced');
    const copies=[figure.querySelector('details.mr-planning-breakdown'),figure.querySelector('.mr-planning-print-breakdown')];
    const number=value=>Number(value).toLocaleString('en-US',Math.abs(value)>0&&Math.abs(value)<1?{maximumSignificantDigits:3}:{maximumFractionDigits:0});
    const money=value=>(value<0?'-$':'$')+number(Math.abs(value));
    for(const copy of copies){
      require(copy&&copy.querySelectorAll('table').length===2,'Missing saved activity or cost table');
      const cells=[...copy.querySelectorAll('[data-planning-activity]')],costs=[...copy.querySelectorAll('[data-planning-cost]')];
      require(cells.length===scenario.activities.length*9&&costs.length===9,'Missing saved planning cells');
      for(const cell of cells){
        const activity=scenario.activities.find(row=>row.id===cell.dataset.planningActivity),key=cell.dataset.planningMeasure,level=cell.dataset.planningLevel;
        const value=activity?.[key]?.[level];
        require(typeof value==='number'&&cell.dataset.savedValue===String(value)&&cell.textContent===(key==='potentialHoursFreed'?number(value):money(value)),'Changed saved activity amount');
        require(cell.closest('tr').querySelector('th').textContent.includes(activity.label),'Changed saved activity label');
      }
      for(const cell of costs){
        const key=cell.dataset.planningCost,level=cell.dataset.planningLevel,costCase={low:'high',central:'central',high:'low'};
        const value=key==='subscriptionCost'?scenario.inputs[key]:scenario.inputs[key]?.[costCase[level]];
        require(typeof value==='number'&&cell.dataset.savedValue===String(value)&&cell.textContent===money(value),'Changed saved cost amount or pairing');
      }
    }
    return true;
  };
  return models.map(({model,fixture})=>{
    const before=JSON.stringify(model);
    const wrapper=document.createElement('div');document.body.append(wrapper);
    MondermanReport.render(wrapper,model);
    const prefix=wrapper.querySelector('section[id]').id.replace(/-section-\d+$/,'');
    const printed=wrapper.querySelector('.mr-page').cloneNode(true);
    const overviewCovers=printed.querySelectorAll('.mr-cover-white.mr-has-overview');
    if(overviewCovers.length!==1)throw new Error('One exact screen-overview cover modifier required');
    overviewCovers[0].classList.remove('mr-has-overview');
    printed.querySelectorAll('.mr-screen-only').forEach(node=>node.remove());
    printed.querySelectorAll('section[id]').forEach(node=>node.removeAttribute('id'));
    // Current action navigation also targets the existing guidance divs.
    // Strip only its generated navigation ID, never its report contents.
    printed.querySelectorAll('.mr-report-nextsteps[id],.mr-report-options[id]').forEach(node=>{
      if (!/^mr-.+-guidance-\d+$/.test(node.id)) throw new Error('Unexpected guidance navigation ID');
      node.removeAttribute('id');
    });
    const baseline=document.createElement('div');baseline.innerHTML=MondermanReport.buildReportBody(model);
    const legacyNegativeControls=[];
    let legacyTablesPreserved=false;
    if(fixture==='historical-v1'){
      legacyTablesPreserved=validateLegacyPlanning(printed,model.financialScenario);
      for(const [name,mutate]of [
        ['explanation',root=>root.querySelector('.mr-legacy-planning-note').textContent='CHANGED'],
        ['saved activity',root=>root.querySelector('[data-planning-activity]').setAttribute('data-saved-value','-1')],
        ['visible activity',root=>root.querySelector('[data-planning-activity]').textContent='CHANGED'],
        ['saved cost',root=>root.querySelector('[data-planning-cost]').setAttribute('data-saved-value','-1')],
        ['print table',root=>root.querySelector('.mr-planning-print-breakdown table').remove()],
        ['retired chart',root=>root.querySelector('.mr-operational-sankey').insertAdjacentHTML('beforeend','<svg></svg>')],
      ]){
        const changed=printed.cloneNode(true);mutate(changed);let rejected=false;
        try{validateLegacyPlanning(changed,model.financialScenario);}catch{rejected=true;}
        if(!rejected)throw new Error('Saved-planning preservation accepted changed '+name);
        legacyNegativeControls.push(name);
      }
    }
    const negativeControls=[];
    if(printed.querySelector('.mr-planning-controls')){
      for(const [name,mutate]of [
        ['label target',root=>root.querySelector('.mr-planning-choice-low+label').setAttribute('for',prefix+'-planning-choice-high')],
        ['radio group',root=>root.querySelector('.mr-planning-choice-low').setAttribute('name','mr-planning-case')],
        ['panel heading target',root=>root.querySelector('.mr-planning-panel-low').setAttribute('aria-labelledby',prefix+'-planning-title-high')],
        ['heading ID',root=>root.querySelector('.mr-planning-panel-low h4').id=prefix+'-planning-title-high'],
      ]){
        const changed=printed.cloneNode(true);mutate(changed);let rejected=false;
        try{normalizePlanningCaseNamespace(changed,prefix);}catch{rejected=true;}
        if(!rejected)throw new Error('Planning namespace guard accepted changed '+name);
        negativeControls.push(name);
      }
      for(const [name,mutate]of [
        ['financial metric',root=>root.querySelector('.mr-planning-metrics dd').textContent='UNAPPROVED FINANCIAL VALUE'],
        ['selected case',root=>root.querySelector('.mr-planning-choice-central').removeAttribute('checked')],
      ]){
        const changed=printed.cloneNode(true);mutate(changed);normalizePlanningCaseNamespace(changed,prefix);
        if(normalizeSvg(changed.innerHTML)===baseline.innerHTML)throw new Error('Report preservation accepted changed '+name);
        negativeControls.push(name);
      }
    }
    const threeBenefitNegativeControls=[];
    if(printed.querySelector('.mr-benefit-radio')){
      for(const [name,mutate]of [
        ['label target',root=>root.querySelector('.mr-benefit-radio-low+label').setAttribute('for',prefix+'-planning-benefit-high')],
        ['radio group',root=>root.querySelector('.mr-benefit-radio-low').setAttribute('name','mr-planning-benefit')],
        ['radio ID',root=>root.querySelector('.mr-benefit-radio-low').id=prefix+'-planning-benefit-high'],
        ['case panel',root=>root.querySelector('.mr-benefit-low').setAttribute('data-three-benefit-case','high')],
        ['saved benefit value',root=>root.querySelector('.mr-benefit-card strong').setAttribute('data-saved-value','-1')],
        ['visible benefit value',root=>root.querySelector('.mr-benefit-card strong').textContent='UNAPPROVED FINANCIAL VALUE'],
        ['selected case',root=>root.querySelector('.mr-benefit-radio-central').removeAttribute('checked')],
        ['cost pairing',root=>root.querySelector('.mr-benefit-low .mr-benefit-net strong').setAttribute('data-saved-value',String(model.financialScenario.totals.totalImplementationAndSubscriptionCost.low))],
      ]){
        const changed=printed.cloneNode(true);mutate(changed);let rejected=false;
        try{normalizeThreeBenefitNamespace(changed,prefix,model.financialScenario);}catch{rejected=true;}
        if(!rejected)throw new Error('Three-benefit preservation guard accepted changed '+name);
        threeBenefitNegativeControls.push(name);
      }
    }
    const planningGroups=normalizePlanningCaseNamespace(printed,prefix);
    const threeBenefitGroups=normalizeThreeBenefitNamespace(printed,prefix,model.financialScenario);
    const intact=normalizeSvg(printed.innerHTML)===baseline.innerHTML;
    const mutated=JSON.stringify(model)!==before;
    const another=document.createElement('div');document.body.append(another);MondermanReport.render(another,model);
    const ids=[...wrapper.querySelectorAll('[id]'),...another.querySelectorAll('[id]')].map(node=>node.id);
    const unique=ids.length===new Set(ids).size;
    wrapper.remove();another.remove();
    return {product:model.filenameBase,fixture,intact,mutated,unique,planningGroups,negativeControls,legacyTablesPreserved,legacyNegativeControls,threeBenefitGroups,threeBenefitNegativeControls};
  });
},{legacySources,legacyNoteHtml:LEGACY_PLANNING_NOTE_HTML});
assert.ok(invariants.every(row=>row.intact&&!row.mutated&&row.unique),JSON.stringify(invariants));
assert.equal(invariants.filter(row=>row.fixture==='current').length,6,'All six current publications must retain their complete report bodies');
assert.equal(invariants.filter(row=>row.fixture==='historical-v1'&&row.planningGroups===0&&row.legacyTablesPreserved).length,2,'Both historical synthesis products must preserve complete saved tables without the retired chart');
assert.ok(invariants.every(row=>row.planningGroups===0),'Retired v1 controls reappeared');
assert.ok(invariants.filter(row=>row.fixture==='historical-v1').every(row=>row.legacyNegativeControls.length===6),'Missing saved-planning preservation negative control');
assert.equal(invariants.filter(row=>row.fixture==='current'&&row.threeBenefitGroups===1).length,2,'Both current synthesis products must exercise three-benefit control preservation');
assert.ok(invariants.filter(row=>row.threeBenefitGroups).every(row=>row.threeBenefitNegativeControls.length===8),'Missing three-benefit preservation negative control');
fs.writeFileSync(path.join(out,'body-preservation-checks.json'),JSON.stringify({products:6,historicalProducts:2,rows:invariants},null,2));
const legacyScreenPrint=[];
for(const [index,source]of legacySources.entries())for(const width of [390,1440]){
  const saved=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  await saved.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.hostname==='www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname)?route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.basename(url.pathname))}):route.abort();
  });
  const html=await page.evaluate(source=>{const before=JSON.stringify(source),html=MondermanReport.buildReportHtml(MondermanReport.fromSynthesis(source));if(JSON.stringify(source)!==before)throw Error('Saved source mutated');return html;},source);
  await saved.setContent(html,{waitUntil:'load'});await saved.evaluate(()=>document.fonts.ready);
  assert.equal(await saved.locator('.mr-legacy-planning-note').isVisible(),true);
  assert.equal(await saved.locator('.mr-operational-sankey svg,.mr-planning-controls').count(),0);
  await saved.locator('details.mr-planning-breakdown summary').focus();await saved.keyboard.press('Enter');
  const regions=saved.locator('.mr-planning-table-scroll');assert.equal(await regions.count(),2);
  for(let i=0;i<2;i++){
    assert.equal(await regions.nth(i).getAttribute('role'),'region');
    assert.equal(await regions.nth(i).getAttribute('tabindex'),'0');
    assert.ok(await regions.nth(i).getAttribute('aria-label'));
    assert.equal(await regions.nth(i).isVisible(),true);
  }
  const screenCells=await saved.locator('details.mr-planning-breakdown td[data-saved-value]').evaluateAll(nodes=>nodes.map(node=>({value:node.dataset.savedValue,text:node.textContent})));
  assert.equal(screenCells.length,source.financial_scenario.activities.length*9+9);
  assert.ok(await saved.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Saved planning tables overflow the screen');
  await saved.screenshot({path:path.join(out,'historical-'+index+'-'+width+'-tables.png')});
  await emulateMediaAndSettle(saved,'print');
  assert.equal(await saved.locator('details.mr-planning-breakdown').isVisible(),false);
  assert.equal(await saved.locator('.mr-planning-print-breakdown').isVisible(),true);
  assert.equal(await saved.locator('.mr-legacy-planning-note').isVisible(),true);
  const printCells=await saved.locator('.mr-planning-print-breakdown td[data-saved-value]').evaluateAll(nodes=>nodes.map(node=>({value:node.dataset.savedValue,text:node.textContent})));
  assert.deepEqual(printCells,screenCells,'Print loses or changes saved activity/cost figures');
  legacyScreenPrint.push({product:index,width,screenCells:screenCells.length,printCells:printCells.length});await saved.close();
}
fs.writeFileSync(path.join(out,'legacy-screen-print-checks.json'),JSON.stringify(legacyScreenPrint,null,2));
await emulateMediaAndSettle(page,'print');
assert.equal(await page.locator('#report-depth .mr-screen-nav').isVisible(),false,'screen nav appears in print');
assert.equal(await page.locator('#report-depth .mr-screen-next').isVisible(),false,'screen action appears in print');
await emulateMediaAndSettle(page,'screen');
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
  if(product==='structural-clarity'||product==='institutional-performance') {
    const chartStart=source.indexOf('function renderClarityDimensionBars(');
    const chartCode=source.slice(chartStart,source.indexOf('\nfunction ',chartStart+10));
    const result=JSON.parse(fs.readFileSync('test-fixtures/authenticated-report-engine-runs.json','utf8')).outputs[product.replaceAll('-','_')].result;
    await direct.evaluate(({code,result})=>new Function('$','result',code+'\nrenderClarityDimensionBars(result);')(id=>document.getElementById(id),result),{code:chartCode,result});
    const bars=direct.locator('#clarityDimensionBars .bar-fill');
    assert.equal(await bars.count(),5,product+' fixture did not render the actual dimension chart');
    assert.ok((await bars.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor))).every(color=>color==='rgb(12, 110, 120)'),product+' dimension categories must use canonical teal, not decorative warning colors');
    await emulateMediaAndSettle(direct,'print');
    assert.ok((await bars.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor))).every(color=>color==='rgb(12, 110, 120)'),product+' print dimension categories must match the canonical teal screen chart');
    await emulateMediaAndSettle(direct,'screen');
  }
  const spacing=await direct.evaluate(()=>{
    const css=selector=>getComputedStyle(document.querySelector(selector));
    return {
      findingTop:css('.finding-lead').marginTop,
      findingBottom:css('.finding-lead').marginBottom,
      contextTop:css('.score-meta-strip').marginTop,
      closedBodyPadding:css('.accordion-section:not(.open) .accordion-body').paddingBottom,
      reference:css('.industry-range').backgroundColor
    };
  });
  assert.equal(spacing.findingTop,'0px',product+' finding has inherited paragraph top margin');
  assert.equal(spacing.findingBottom,'0px',product+' finding has inherited paragraph bottom margin');
  assert.equal(spacing.contextTop,'0px',product+' context strip doubles the grid gap');
  assert.equal(spacing.closedBodyPadding,'0px',product+' collapsed accordion has phantom body spacing');
  assert.equal(spacing.reference,'rgba(94, 127, 152, 0.18)',product+' reference range looks like a warning');
  if(product==='decision-velocity') {
    const pilot=await direct.locator('.pilot-result-invitation').evaluate(node=>({margin:getComputedStyle(node).marginTop,background:getComputedStyle(node).backgroundColor,buttonBackground:getComputedStyle(node.querySelector('.btn')).backgroundColor,buttonColor:getComputedStyle(node.querySelector('.btn')).color}));
    assert.deepEqual(pilot,{margin:'0px',background:'rgb(244, 247, 248)',buttonBackground:'rgb(12, 110, 120)',buttonColor:'rgb(255, 255, 255)'},'pilot invitation spacing or canonical teal primary contrast regressed');
  }
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
  assert.equal(await direct.locator('[data-accordion="remedy"] .accordion-body').evaluate(el=>getComputedStyle(el).paddingBottom),'22px',product+' open accordion lost inner spacing');
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
console.log('REPORT_SCREEN_EXPERIENCE_PASS all6 navigation, spacing, coolCategoryColors, originalBodyParity, uniqueMounts, immutableModels, mobile, printControls; all4 direct spacing, textContrast, availability, focus, accordion, exportExclusion');
