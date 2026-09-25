// Synthetic local fixtures from the production calculator. No services,
// provider calls, customer records, source modifications or publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {reportHtmlAfterReviewedPresentation} from './report_three_benefit_presentation_inverse.mjs';
import {withoutReportOverview} from './report_overview_test_normalizer.mjs';
const root=path.resolve(import.meta.dirname,'..'),prior='b06b72083442f03f7a1e2cadeb5239e4f0449515';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const source=read('monderman-report.js'),fixtureBytes=read('scripts/fixtures/three-benefit-scenarios.json'),fixtures=JSON.parse(fixtureBytes);
const historic=JSON.parse(execFileSync('git',['show',prior+':sample-data/production-diagnostic-samples.json'],{cwd:root,encoding:'utf8',maxBuffer:32e6}));
const load=text=>{const c={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};vm.runInNewContext(read('participant-evidence-safety.js'),c);vm.runInNewContext(text,c);return c.window.MondermanReport;};
const report=load(source),old=load(execFileSync('git',['show',prior+':monderman-report.js'],{cwd:root,encoding:'utf8',maxBuffer:4e6}));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const levels=['low','central','high'],keys=['spendingReduction','spendingAvoidance','staffCapacity'];
// The independent burden contract uses complete valid saved scenarios. It
// checks denominators, conserved flows and units through the public adapter.
const burdenChecks=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/report_burden_flow_smoke.mjs')],{cwd:root,encoding:'utf8'}));
eq(burdenChecks.status,'PASS','Independent baseline and released-value contract');
const build=(scenario,assessment)=>{const raw=structuredClone(historic.outputs.depth_synthesis.source);delete raw.financial_scenario;if(scenario){raw.financial_scenario=structuredClone(scenario);raw.campaign_evidence.scopeId=scenario.scope.scopeId;}if(assessment)raw.financial_benefit_assessment=structuredClone(assessment);const before=JSON.stringify(raw),model=report.fromSynthesis(raw),html=report.buildReportHtml(model);eq(JSON.stringify(raw),before,'Renderer does not mutate saved data');return {model,html,raw};};
for(const [key,entry]of Object.entries(historic.outputs)){const a=entry.kind==='diagnostic'?report.fromRun(entry.source):report.fromSynthesis(entry.source),b=entry.kind==='diagnostic'?old.fromRun(entry.source):old.fromSynthesis(entry.source),html=report.buildReportHtml(a);eq(withoutReportOverview(html),reportHtmlAfterReviewedPresentation(old.buildReportHtml(b)),'Historical HTML differs only by screen overview, exact legacy-chart retirement and gold accents: '+key);ok(!/data-(?:planning|sankey)-node="subscriptionCost"/.test(html),'No subscription node in reopened historical report: '+key);ok(html.includes('.mr-run-metric[data-tone="amber"]{border-top-color:#E6C765}'),'Category accents use gold for print: '+key);ok(html.includes('.mr-report .mr-action[data-tier="behavioral"] .mr-action-num{color:#7A6015}'),'Gold category text has a dark readable variant: '+key);}
const cases=Object.fromEntries(Object.entries(fixtures.cases).map(([key,s])=>[key,{...build(s),s}]));
const samplePath=process.env.REPORT_THREE_BENEFIT_SAMPLES||path.join(root,'sample-data/production-diagnostic-samples.json'),sampleBytes=fs.readFileSync(samplePath,'utf8'),samples=JSON.parse(sampleBytes),publicKeys=[];
for(const key of ['depth_synthesis','cross_lens_synthesis'])if(samples.outputs[key].source.financial_scenario?.version==='operational-planning-scenario-20260919.2'){
  const raw=structuredClone(samples.outputs[key].source),model=report.fromSynthesis(raw),html=report.buildReportHtml(model),name='sample-'+key;
  cases[name]={raw,model,html,s:raw.financial_scenario};publicKeys.push(name);
}
for(const [key,item]of Object.entries(cases)){
  ok(item.html.includes('data-three-benefit-version="20260919.1"'),'Valid saved case accepted: '+key);
  eq((item.html.match(/type="radio"/g)||[]).length,3,'Three native case controls');
  ok(item.html.indexOf('Choose a planning case')<item.html.indexOf('data-benefit="'),'Controls precede benefit cards');
  ok(item.html.includes('value="central" checked'),'Central selected without JavaScript');
  for(const category of keys)for(const level of levels){const b=item.s.benefits[category];if(b.amount!==null)ok(item.html.includes('data-saved-value="'+b.amount[level]+'"'),'Exact saved benefit values');}
  eq(item.html.includes('<figure class="mr-benefit-chart"'),item.s.coverage.complete&&key!=='zero','Incomplete estimates have no Sankey');
  for(const chart of item.html.match(/<figure class="mr-benefit-chart"[\s\S]*?<\/figure>/g)||[]){
    ok(!/Subscription allocation|Implementation cash|Net planning value<\/span>/.test(chart),'Chart only shows gross operational benefit flows');
    ok(chart.includes('data-flow-version="20260923.1"'),'Current two-view burden-flow presentation');
    ok(chart.includes('data-burden-unit="USD"')&&chart.includes('data-burden-unit="hours"'),'Spending and staff hours use separate diagrams');
  }
  for(const a of item.s.inputs.capacity.activities){ok(item.html.includes(a.sourceReference),'Activity source reference retained');ok(item.html.includes(a.changeBasis),'Activity proposed-change basis retained');}
  for(const category of ['spendingReduction','spendingAvoidance'])for(const a of item.s.inputs[category].items){ok(item.html.includes(a.sourceReference),'Expense source retained');ok(item.html.includes(a.resourceId),'Expense identity retained');}
  if(item.s.activities.length)ok(item.html.includes('Month-by-month capacity allocation'),'Full saved monthly allocation section');
}
ok(cases.partial.html.includes('Incomplete subtotal, not complete ROI.'),'Partial coverage explicit');
ok(cases.partial.html.includes('data-status="not_estimated"><h4>Avoided future spending</h4><strong>Not estimated</strong>'),'Unknown is not zero');
ok(cases.zero.html.includes('Reviewed: none identified'),'Explicit reviewed zero distinct from missing');
ok(!cases.zero.html.includes('data-burden-amount'),'Reviewed zero without a measured denominator produces no fabricated ribbon');
ok(fixtures.cases.nonmonotonic.totals.potentialHoursFreed.low>fixtures.cases.nonmonotonic.totals.potentialHoursFreed.high,'Nonmonotonic fixture');
ok(cases.nonmonotonic.html.includes('data-saved-value="35325"')&&cases.nonmonotonic.html.includes('data-saved-value="32925"'),'Nonmonotonic case values stay attached');
ok(cases.negative.html.includes('data-saved-value="'+fixtures.cases.negative.totals.netCapacityAndCashValue.central+'"'),'Negative net outcome remains visible outside gross-benefit diagram');
ok(cases.complete.html.includes('Months 7 to 12 - hours in each month'),'Identical contiguous months grouped, not recomputed');
const noScenario=build(null,fixtures.assessmentWithoutScenario);ok(noScenario.html.includes('Financial benefit assessment'),'New no-scenario report has assessment');ok(!noScenario.html.includes('data-burden-amount'),'No scenario no chart');
const mutations=[['wrong scope',s=>s.scope.scopeId='other-scope'],['bad currency',s=>s.currency='EUR'],['missing digest',s=>delete s.digest],['unconfirmed',s=>s.inputs.scopeConfirmed=false],['unreviewed overlap',s=>s.inputs.overlapReviewed=false],['score-derived',s=>s.method.usesDiagnosticScores=true],['confidence claim',s=>s.method.isConfidenceInterval=true],['missing benefit',s=>delete s.benefits.spendingReduction],['unknown treated as zero',s=>s.benefits.spendingReduction.status='not_estimated'],['false complete coverage',s=>s.coverage.missingCategories=['staffCapacity']],['missing monthly allocation',s=>delete s.spendingItems[1].monthlyAllocations],['missing monthly reconciliation',s=>delete s.activities[0].monthlyReconciliation],['duplicate month',s=>s.activities[0].monthlyReconciliation[1].month=1],['wrong monthly value',s=>s.activities[0].monthlyReconciliation[0].potentialHoursFreed.central+=1],['wrong monthly expense',s=>s.spendingItems[1].monthlyAllocations[0].allocatedHours.high+=1],['incorrect gross',s=>s.activities[0].grossHoursFreed.high+=1],['double capacity',s=>s.activities[0].capacityValue.high+=100],['net mismatch',s=>s.totals.netCapacityAndCashValue.central+=1],['known subtotal mismatch',s=>s.totals.knownBenefitSubtotal.low+=1],['wrong cost pairing',s=>s.totals.netKnownBenefitSubtotal.low+=100],['negative retained hours',s=>s.activities[0].potentialHoursFreed.low=-1],['NaN amount',s=>s.spendingItems[0].amount.central=NaN],['duplicate resource',s=>s.inputs.spendingAvoidance.items[0].resourceId=s.inputs.spendingReduction.items[0].resourceId],['wrong labor link',s=>s.inputs.spendingReduction.items[1].capacityActivityId='missing'],['wrong active month',s=>s.inputs.spendingReduction.items[1].startMonth=13],['missing source',s=>s.inputs.spendingReduction.items[0].sourceReference='']];
for(const value of [null,1,'invalid',[]]){
  mutations.push(['invalid monthly allocation '+JSON.stringify(value),s=>s.spendingItems[1].monthlyAllocations[0]=value]);
  mutations.push(['invalid monthly reconciliation '+JSON.stringify(value),s=>s.activities[0].monthlyReconciliation[0]=value]);
}
for(const [label,change]of mutations){const scenario=structuredClone(fixtures.cases.complete);change(scenario);const raw=structuredClone(historic.outputs.depth_synthesis.source);raw.financial_scenario=scenario;const html=report.buildReportHtml(report.fromSynthesis(raw));ok(!html.includes('data-three-benefit-version="'),'Invalid scenario withheld: '+label);ok(!html.includes('data-burden-amount'),'No chart from invalid scenario: '+label);}
const hostile=structuredClone(fixtures.cases.complete);hostile.inputs.title='<img src=x onerror=alert(1)>';hostile.title=hostile.inputs.title;ok(!build(hostile).html.includes('<img src=x'),'Title escaped');
const self=structuredClone(cases.complete.raw);self.source_mode='own_saved_runs';self.report_kind='self_run_synthesis';ok(!report.buildReportHtml(report.fromSynthesis(self)).includes('data-three-benefit-version'),'No single-account financial projection');
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({status:'PASS',checks,burdenChecks:burdenChecks.checks,rendererSha256:sha(source),fixtureSha256:sha(fixtureBytes),providerCalls:0}));process.exit(0);}
const out=process.env.REPORT_THREE_BENEFIT_OUT||fs.mkdtempSync('/tmp/report-three-benefit-');fs.mkdirSync(out,{recursive:true});
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),errors=[],unexpected=[],states=[],screenshots=[],pdfs=[];
const stylesSettled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const geometry=()=>{
  const failures=[],visible=e=>!!e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden';
  if(document.documentElement.scrollWidth>innerWidth+1)failures.push('document overflow');
  for(const node of document.querySelectorAll('.mr-unified-label strong'))if(visible(node)&&(node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1))failures.push('currency overflow: '+node.textContent);
  for(const table of document.querySelectorAll('.mr-benefit-table'))if(visible(table))for(const td of table.querySelectorAll('td'))if(getComputedStyle(td).whiteSpace!=='nowrap')failures.push('numeric table wrapping');
  for(const chart of document.querySelectorAll('.mr-unified-flow'))if(visible(chart)){const box=chart.getBoundingClientRect();for(const column of chart.querySelectorAll('.mr-unified-labels')){const bounds=column.getBoundingClientRect(),nodes=[...column.querySelectorAll('.mr-unified-label')];for(const node of nodes){const b=node.getBoundingClientRect();if(b.top<box.top-1||b.bottom>box.bottom+1||b.left<bounds.left-1||b.right>bounds.right+1)failures.push('node outside diagram');}for(let i=1;i<nodes.length;i++)if(nodes[i-1].getBoundingClientRect().bottom>nodes[i].getBoundingClientRect().top+1)failures.push('overlapping nodes');}}
  return failures;
};
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});try{
    for(const width of [320,390,834,1440])for(const name of ['complete','stress',...publicKeys]){
      const item=cases[name],page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,match[1]+'font.woff2'))});unexpected.push(route.request().url());return route.abort();});
      await page.setContent(item.html);await page.evaluate(()=>document.fonts.ready);await stylesSettled(page);
      for(const level of levels){await page.locator('.mr-benefit-choice').filter({hasText:new RegExp('^'+level+'$','i')}).click();await stylesSettled(page);eq(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),level,'Exactly selected native case visible');eq(await page.evaluate(geometry),[],engine+'/'+width+'/'+name+'/'+level+' geometry');ok(await page.locator('.mr-benefit-panel:visible svg:visible').first().isVisible(),'Actual Sankey visible including phone');states.push({engine,width,name,level});if(level==='central'){const file=path.join(out,engine+'-'+width+'-'+name+'.png');await page.locator('.mr-benefit-panel:visible').screenshot({path:file});screenshots.push(file);}}
      const central=page.locator('.mr-benefit-radio-central');await central.focus();await page.keyboard.press('ArrowRight');eq(await page.locator('.mr-benefit-radio-high').isChecked(),true,'Native radio keyboard selection');
      eq(await page.locator('.mr-overview-tile').count(),4,'Four overview tiles');
      eq(await page.locator('.mr-benefit-panel:visible .mr-burden-mobile').count(),0,'No obsolete phone-only diagram');
      const chart=page.locator('.mr-benefit-panel:visible .mr-benefit-chart'),flows=chart.locator('.mr-unified-flow'),details=chart.locator('.mr-burden-source-details');
      eq(await flows.count(),2,'Money and time each have one complete flow at every screen width');
      eq(await flows.locator('svg').count(),2,'The actual diagrams remain visible on phone, tablet and desktop');
      ok(await flows.evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1&&n.getBoundingClientRect().right<=innerWidth+1)),'Unified diagrams require no horizontal swipe');
      eq(await chart.locator('svg path[data-burden-role]').evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('fill'))).size),4,'Three distinct result colors plus neutral remaining burden');
      eq(await details.count(),2,'Money and time retain separate complete source details');
      ok(!(await chart.textContent()).includes('Subscription allocation'),'No subscription allocation inside diagram');
      for(let index=0;index<await details.count();index++){
        const detail=details.nth(index),summary=detail.locator('summary');
        await summary.scrollIntoViewIfNeeded();await summary.focus();
        eq(await summary.evaluate(n=>document.activeElement===n),true,'Each source-detail summary accepts keyboard focus');
        await page.keyboard.press('Enter');
        eq(await detail.evaluate(n=>n.open),true,'Keyboard reveals original source records');
        eq(await detail.locator('[data-burden-source]:visible').count(),index===0?item.s.inputs.spendingReduction.items.length+item.s.inputs.spendingAvoidance.items.length:item.s.inputs.capacity.activities.length,'Every source remains accessible without grouping loss');
        await page.keyboard.press('Enter');
        eq(await detail.evaluate(n=>n.open),false,'Keyboard closes source records');
      }
      // Print uses a paper-sized layout, not a 320px screen. The PDF below
      // additionally verifies actual page composition and complete values.
      await page.setViewportSize({width:1440,height:1000});
      for(const selected of levels){
        await page.emulateMedia({media:'screen'});
        await page.locator('.mr-benefit-choice').filter({hasText:new RegExp('^'+selected+'$','i')}).click();
        await page.emulateMedia({media:'print'});await stylesSettled(page);
        eq(await page.locator('.mr-benefit-panel:visible').count(),1,'Print shows one planning case');
        eq(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),'central','Print always shows Central regardless of screen choice');
        eq(await page.locator('.mr-benefit-chart:visible').count(),1,'One printed Sankey');
        eq(await page.locator('.mr-benefit-chart:visible .mr-burden-section').count(),2,'Separate money and time diagrams print');
        ok(await page.locator('.mr-benefit-chart:visible .mr-burden-section').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).breakInside==='avoid')),'Each printed diagram stays together');
        ok(await page.locator('.mr-benefit-print-summary').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.mr-benefit-central .mr-benefit-chart'))&Node.DOCUMENT_POSITION_PRECEDING)),'Three-case table follows Central chart');
        eq(await page.evaluate(geometry),[],engine+'/'+width+'/'+name+'/'+selected+' print geometry');
      }
      if(process.argv.includes('--print')&&engine==='chromium'&&width===1440&&['complete','stress'].includes(name)){
        const file=path.join(out,'QA-only-'+name+'.pdf');await page.pdf({path:file,printBackground:true,preferCSSPageSize:true});
        const pages=JSON.parse(execFileSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',file],{encoding:'utf8',maxBuffer:16e6})),compact=s=>s.replace(/\s/g,''),text=compact(pages.join(' '));
        ok(pages[1].includes('Decision brief: three sources of value'),'PDF page two has decision brief');
        for(const key of keys)ok(pages[1].includes(item.s.benefits[key].amount.central.toLocaleString('en-US',{maximumFractionDigits:0})),'PDF central benefit front-loaded');
        const chartTitle='Central case: money and staff time';
        const chartPage=pages.findIndex(p=>compact(p).includes(compact(chartTitle))),tablePage=pages.findIndex(p=>p.includes('Three planning cases'));
        ok(chartPage>=1&&tablePage>=chartPage,'Central chart precedes case comparison');
        eq(compact(pages.join(' ')).split(compact('case: money and staff time')).length-1,1,'PDF contains exactly one planning-case chart');
        ok(!/Low planning case|High planning case/.test(pages.join(' ')),'Repeated case pages removed');
        ok(compact(pages[tablePage]).includes('Lowpairslowbenefitassumptionswithhighcosts'),'Pairing note stays with comparison');
        for(const key of keys)for(const level of levels)ok(text.includes(compact(item.s.benefits[key].amount[level].toLocaleString('en-US',{maximumFractionDigits:2}))),'PDF retains every case amount');
        for(const a of item.s.inputs.capacity.activities)ok(text.includes(compact(a.label)),'PDF complete activity label');
        for(const category of ['spendingReduction','spendingAvoidance'])for(const a of item.s.inputs[category].items)ok(text.includes(compact(a.label)),'PDF complete expense label');
        ok(text.includes('Month-by-monthcapacityallocation'),'PDF month ledger');
        execFileSync(process.env.PDFTOPPM||'pdftoppm',['-f',String(chartPage+1),'-l',String(chartPage+1),'-scale-to','1400','-singlefile','-png',file,path.join(out,name+'-page-'+(chartPage+1))]);
        pdfs.push({file,pages:pages.length,sha256:sha(fs.readFileSync(file))});
      }
      if(process.argv.includes('--print')&&engine==='chromium'&&width===1440&&['complete','stress'].includes(name)){
        const pages=JSON.parse(execFileSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',path.join(out,'QA-only-'+name+'.pdf')],{encoding:'utf8',maxBuffer:16e6}));
        const ledgerPage=(pages.find(p=>p.includes('Month-by-month capacity allocation'))||'').replace(/\s/g,'');
        ok(ledgerPage.includes('Identicalconsecutivemonths')&&ledgerPage.includes(item.s.activities[0].label.replace(/\s/g,''))&&ledgerPage.includes('Grosshoursfreed'),'Monthly ledger heading, introduction and first saved ledger share one PDF page');
      }
      await page.close();
    }
    for(const name of ['partial','unknown','zero','nonmonotonic','negative']){const page=await browser.newPage({viewport:{width:390,height:1000}});await page.route('**/*',route=>route.abort());await page.setContent(cases[name].html);await stylesSettled(page);eq(await page.evaluate(geometry),[],engine+'/'+name+' special geometry');if(['partial','unknown'].includes(name))eq(await page.locator('.mr-benefit-chart').count(),0,'No incomplete chart');await page.close();}
    const mounted=await browser.newPage({viewport:{width:390,height:1000}});await mounted.route('**/*',route=>route.abort());await mounted.setContent('<div id="first"></div><div id="second"></div>');await mounted.addScriptTag({content:source});await mounted.evaluate(model=>{window.MondermanReport.render('first',model);window.MondermanReport.render('second',model);},cases.complete.model);eq(await mounted.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length===new Set(ids).size;}),true,'Two mounted reports have unique IDs');await mounted.locator('#first .mr-benefit-choice').filter({hasText:'Low'}).click();eq(await mounted.locator('#first .mr-benefit-radio-low').isChecked(),true,'First report switches');eq(await mounted.locator('#second .mr-benefit-radio-central').isChecked(),true,'Second report independent');await mounted.close();
  }finally{await browser.close();}
}
eq(errors,[],'No browser exceptions');eq(unexpected,[],'No unapproved transport');
const receipt={status:'PASS',checks,burdenChecks:burdenChecks.checks,states:states.length,rendererSha256:sha(source),fixtureSha256:sha(fixtureBytes),calculatorSha256:fixtures.calculatorSha256,publicSampleSha256:sha(sampleBytes),publicSamples:publicKeys,screenshots,pdfs,providerCalls:0,networkCalls:0,historicalHtmlExactExceptReviewedPresentation:true};fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,out,screenshots:screenshots.length}));
