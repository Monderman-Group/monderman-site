// Synthetic local fixtures from the production calculator. No services,
// provider calls, customer records, source modifications or publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),prior='b06b72083442f03f7a1e2cadeb5239e4f0449515';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const source=read('monderman-report.js'),fixtureBytes=read('scripts/fixtures/three-benefit-scenarios.json'),fixtures=JSON.parse(fixtureBytes);
const historic=JSON.parse(execFileSync('git',['show',prior+':sample-data/production-diagnostic-samples.json'],{cwd:root,encoding:'utf8',maxBuffer:32e6}));
const load=text=>{const c={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};vm.runInNewContext(read('participant-evidence-safety.js'),c);vm.runInNewContext(text,c);return c.window.MondermanReport;};
const report=load(source),old=load(execFileSync('git',['show',prior+':monderman-report.js'],{cwd:root,encoding:'utf8',maxBuffer:4e6}));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const levels=['low','central','high'],keys=['spendingReduction','spendingAvoidance','staffCapacity'];
const build=(scenario,assessment)=>{const raw=structuredClone(historic.outputs.depth_synthesis.source);delete raw.financial_scenario;if(scenario){raw.financial_scenario=structuredClone(scenario);raw.campaign_evidence.scopeId=scenario.scope.scopeId;}if(assessment)raw.financial_benefit_assessment=structuredClone(assessment);const before=JSON.stringify(raw),model=report.fromSynthesis(raw),html=report.buildReportHtml(model);eq(JSON.stringify(raw),before,'Renderer does not mutate saved data');return {model,html,raw};};
for(const [key,entry]of Object.entries(historic.outputs)){const a=entry.kind==='diagnostic'?report.fromRun(entry.source):report.fromSynthesis(entry.source),b=entry.kind==='diagnostic'?old.fromRun(entry.source):old.fromSynthesis(entry.source);eq(report.buildReportHtml(a),old.buildReportHtml(b),'Historical HTML exactly unchanged: '+key);}
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
  eq(item.html.includes('<figure class="mr-benefit-chart">'),item.s.coverage.complete&&key!=='zero','Incomplete estimates have no Sankey');
  for(const a of item.s.inputs.capacity.activities){ok(item.html.includes(a.sourceReference),'Activity source reference retained');ok(item.html.includes(a.changeBasis),'Activity proposed-change basis retained');}
  for(const category of ['spendingReduction','spendingAvoidance'])for(const a of item.s.inputs[category].items){ok(item.html.includes(a.sourceReference),'Expense source retained');ok(item.html.includes(a.resourceId),'Expense identity retained');}
  if(item.s.activities.length)ok(item.html.includes('Month-by-month capacity allocation'),'Full saved monthly allocation section');
}
ok(cases.partial.html.includes('Incomplete subtotal, not complete ROI.'),'Partial coverage explicit');
ok(cases.partial.html.includes('data-status="not_estimated"><h4>Avoided future spending</h4><strong>Not estimated</strong>'),'Unknown is not zero');
ok(cases.zero.html.includes('Reviewed: none identified'),'Explicit reviewed zero distinct from missing');
ok(!cases.zero.html.includes('data-three-benefit-flow-value'),'Zero produces no fabricated ribbon');
ok(fixtures.cases.nonmonotonic.totals.potentialHoursFreed.low>fixtures.cases.nonmonotonic.totals.potentialHoursFreed.high,'Nonmonotonic fixture');
ok(cases.nonmonotonic.html.includes('data-saved-value="35325"')&&cases.nonmonotonic.html.includes('data-saved-value="32925"'),'Nonmonotonic case values stay attached');
ok(cases.negative.html.includes('Value shortfall'),'Negative outcome shown honestly');
ok(cases.complete.html.includes('Months 7 to 12 - hours in each month'),'Identical contiguous months grouped, not recomputed');
const noScenario=build(null,fixtures.assessmentWithoutScenario);ok(noScenario.html.includes('Financial benefit assessment'),'New no-scenario report has assessment');ok(!noScenario.html.includes('data-three-benefit-flow-value'),'No scenario no chart');
const mutations=[['wrong scope',s=>s.scope.scopeId='other-scope'],['bad currency',s=>s.currency='EUR'],['missing digest',s=>delete s.digest],['unconfirmed',s=>s.inputs.scopeConfirmed=false],['unreviewed overlap',s=>s.inputs.overlapReviewed=false],['score-derived',s=>s.method.usesDiagnosticScores=true],['confidence claim',s=>s.method.isConfidenceInterval=true],['missing benefit',s=>delete s.benefits.spendingReduction],['unknown treated as zero',s=>s.benefits.spendingReduction.status='not_estimated'],['false complete coverage',s=>s.coverage.missingCategories=['staffCapacity']],['missing monthly allocation',s=>delete s.spendingItems[1].monthlyAllocations],['missing monthly reconciliation',s=>delete s.activities[0].monthlyReconciliation],['duplicate month',s=>s.activities[0].monthlyReconciliation[1].month=1],['wrong monthly value',s=>s.activities[0].monthlyReconciliation[0].potentialHoursFreed.central+=1],['wrong monthly expense',s=>s.spendingItems[1].monthlyAllocations[0].allocatedHours.high+=1],['incorrect gross',s=>s.activities[0].grossHoursFreed.high+=1],['double capacity',s=>s.activities[0].capacityValue.high+=100],['net mismatch',s=>s.totals.netCapacityAndCashValue.central+=1],['known subtotal mismatch',s=>s.totals.knownBenefitSubtotal.low+=1],['wrong cost pairing',s=>s.totals.netKnownBenefitSubtotal.low+=100],['negative retained hours',s=>s.activities[0].potentialHoursFreed.low=-1],['NaN amount',s=>s.spendingItems[0].amount.central=NaN],['duplicate resource',s=>s.inputs.spendingAvoidance.items[0].resourceId=s.inputs.spendingReduction.items[0].resourceId],['wrong labor link',s=>s.inputs.spendingReduction.items[1].capacityActivityId='missing'],['wrong active month',s=>s.inputs.spendingReduction.items[1].startMonth=13],['missing source',s=>s.inputs.spendingReduction.items[0].sourceReference='']];
for(const value of [null,1,'invalid',[]]){
  mutations.push(['invalid monthly allocation '+JSON.stringify(value),s=>s.spendingItems[1].monthlyAllocations[0]=value]);
  mutations.push(['invalid monthly reconciliation '+JSON.stringify(value),s=>s.activities[0].monthlyReconciliation[0]=value]);
}
for(const [label,change]of mutations){const scenario=structuredClone(fixtures.cases.complete);change(scenario);const raw=structuredClone(historic.outputs.depth_synthesis.source);raw.financial_scenario=scenario;const html=report.buildReportHtml(report.fromSynthesis(raw));ok(!html.includes('data-three-benefit-version="'),'Invalid scenario withheld: '+label);ok(!html.includes('data-three-benefit-flow-value'),'No chart from invalid scenario: '+label);}
const hostile=structuredClone(fixtures.cases.complete);hostile.inputs.title='<img src=x onerror=alert(1)>';hostile.title=hostile.inputs.title;ok(!build(hostile).html.includes('<img src=x'),'Title escaped');
const self=structuredClone(cases.complete.raw);self.source_mode='own_saved_runs';self.report_kind='self_run_synthesis';ok(!report.buildReportHtml(report.fromSynthesis(self)).includes('data-three-benefit-version'),'No single-account financial projection');
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({status:'PASS',checks,rendererSha256:sha(source),fixtureSha256:sha(fixtureBytes),providerCalls:0}));process.exit(0);}
const out=process.env.REPORT_THREE_BENEFIT_OUT||fs.mkdtempSync('/tmp/report-three-benefit-');fs.mkdirSync(out,{recursive:true});
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),errors=[],unexpected=[],states=[],screenshots=[],pdfs=[];
const stylesSettled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const geometry=()=>{
  const failures=[],visible=e=>!!e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden';
  if(document.documentElement.scrollWidth>innerWidth+1)failures.push('document overflow');
  for(const node of document.querySelectorAll('.mr-benefit-flow-node strong'))if(visible(node)&&node.scrollWidth>node.clientWidth+1)failures.push('currency overflow: '+node.textContent);
  for(const table of document.querySelectorAll('.mr-benefit-table'))if(visible(table))for(const td of table.querySelectorAll('td'))if(getComputedStyle(td).whiteSpace!=='nowrap')failures.push('numeric table wrapping');
  for(const chart of document.querySelectorAll('.mr-benefit-flow'))if(visible(chart)){const box=chart.getBoundingClientRect();for(const node of chart.querySelectorAll('.mr-benefit-flow-node')){const b=node.getBoundingClientRect();if(b.bottom>box.bottom+1||b.left<box.left-1||b.right>box.right+1)failures.push('node outside diagram');}const nodes=[...chart.querySelectorAll('.mr-benefit-flow-node:not(.is-right)')];for(let i=1;i<nodes.length;i++)if(nodes[i-1].getBoundingClientRect().bottom>nodes[i].getBoundingClientRect().top+1)failures.push('overlapping nodes');}
  return failures;
};
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});try{
    for(const width of [320,390,834,1440])for(const name of ['complete','stress',...publicKeys]){
      const item=cases[name],page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,match[1]+'font.woff2'))});unexpected.push(route.request().url());return route.abort();});
      await page.setContent(item.html);await page.evaluate(()=>document.fonts.ready);await stylesSettled(page);
      for(const level of levels){await page.locator('.mr-benefit-choice').filter({hasText:new RegExp('^'+level+'$','i')}).click();await stylesSettled(page);eq(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),level,'Exactly selected native case visible');eq(await page.evaluate(geometry),[],engine+'/'+width+'/'+name+'/'+level+' geometry');ok(await page.locator('.mr-benefit-panel:visible svg').isVisible(),'Actual Sankey visible including phone');states.push({engine,width,name,level});if(level==='central'){const file=path.join(out,engine+'-'+width+'-'+name+'.png');await page.locator('.mr-benefit-panel:visible').screenshot({path:file});screenshots.push(file);}}
      const central=page.locator('.mr-benefit-radio-central');await central.focus();await page.keyboard.press('ArrowRight');eq(await page.locator('.mr-benefit-radio-high').isChecked(),true,'Native radio keyboard selection');
      // Print uses a paper-sized layout, not a 320px screen. The PDF below
      // additionally verifies actual page composition and complete values.
      await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({media:'print'});await stylesSettled(page);eq(await page.locator('.mr-benefit-panel:visible').count(),3,'Print shows all cases');eq(await page.evaluate(geometry),[],engine+'/'+width+'/'+name+' print geometry');
      if(process.argv.includes('--print')&&engine==='chromium'&&width===1440&&['complete','stress'].includes(name)){const file=path.join(out,'QA-only-'+name+'.pdf');await page.pdf({path:file,printBackground:true,preferCSSPageSize:true});const pages=JSON.parse(execFileSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))',file],{encoding:'utf8',maxBuffer:16e6})),compact=s=>s.replace(/\s/g,''),text=compact(pages.join(' '));ok(pages[1].includes('Decision brief: three sources of value')&&pages[1].includes('Three planning cases'),'PDF page two has decision brief and full financial table');for(const key of keys)ok(pages[1].includes(item.s.benefits[key].amount.central.toLocaleString('en-US',{maximumFractionDigits:2})),'PDF central benefit front-loaded');ok(compact(pages[1]).includes('Lowpairslowbenefitassumptionswithhighcosts'),'Printed case-pairing note stays with front summary');if(name==='complete')for(const level of levels){const label=level[0].toUpperCase()+level.slice(1);ok(pages.some(p=>p.includes(label+' planning case')&&p.includes(label+' case: how the value adds up')),'Ordinary case cards and Sankey share a page');}for(const level of levels)ok(text.includes(compact(level[0].toUpperCase()+level.slice(1)+' planning case')),'PDF all cases');for(const a of item.s.inputs.capacity.activities)ok(text.includes(compact(a.label)),'PDF complete activity label');for(const category of ['spendingReduction','spendingAvoidance'])for(const a of item.s.inputs[category].items)ok(text.includes(compact(a.label)),'PDF complete expense label');ok(text.includes('Month-by-monthcapacityallocation'),'PDF month ledger');for(const pageNumber of pages.map((p,index)=>({p,index})).filter(x=>/case: how the value adds up/.test(x.p)).map(x=>x.index+1))execFileSync(process.env.PDFTOPPM||'pdftoppm',['-f',String(pageNumber),'-l',String(pageNumber),'-scale-to','1400','-singlefile','-png',file,path.join(out,name+'-page-'+pageNumber)]);pdfs.push({file,pages:pages.length,sha256:sha(fs.readFileSync(file))});}
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
const receipt={status:'PASS',checks,states:states.length,rendererSha256:sha(source),fixtureSha256:sha(fixtureBytes),calculatorSha256:fixtures.calculatorSha256,publicSampleSha256:sha(sampleBytes),publicSamples:publicKeys,screenshots,pdfs,providerCalls:0,networkCalls:0,historicalHtmlExact:true};fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,out,screenshots:screenshots.length}));
