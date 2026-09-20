// Local display regression, not current-sample publication or AI-quality proof.
// Actual page/CSS/JS bytes are served by interception; no remote request escapes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readPublicSampleFixture} from './public_sample_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..');
const origin='http://127.0.0.1:49876';
const arg=process.argv.find(value=>value.startsWith('--output='));
const out=arg?arg.slice(9):fs.mkdtempSync('/tmp/sample-marketing-hover-');
if(arg){assert.ok(path.isAbsolute(out),'Output must be a fresh absolute directory');fs.mkdirSync(out,{mode:0o700});}
const sha=value=>createHash('sha256').update(value).digest('hex');
const artifactPath=path.join(root,'sample-data/production-diagnostic-samples.json');
const artifactBytes=fs.readFileSync(artifactPath),{artifact}=readPublicSampleFixture({root});
const tracked=['index.html','sample-report.html','homepage-workspace-demo.css','homepage-workspace-demo.js',
  'sample-report-production.css','sample-report-production.js','scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html'];
const sourceHashes=Object.fromEntries(tracked.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const disclosure='These reports use realistic example responses to demonstrate Monderman’s analysis and reporting.';
const money=value=>value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const scenario=artifact.outputs.depth_synthesis.source.financial_scenario;
const threeBenefit=scenario.version==='operational-planning-scenario-20260919.2';
assert.equal(scenario.method.usesDiagnosticScores,false);
assert.equal(scenario.method.isConfidenceInterval,false);
const range=key=>money(scenario.totals[key].low)+' to '+money(scenario.totals[key].high);
const roundedMoney=value=>money(Math.abs(value)>=10000?Math.round(value/1000)*1000:value);
const cross=artifact.outputs.cross_lens_synthesis.source;
const crossScenario=cross.financial_scenario;
const whole=value=>Math.round(value).toLocaleString('en-US');
const rows=[],screenshots=[];let checks=0,blockedRemoteRequests=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const guideRequirements=[
  'An individual report explains one participant’s result',
  'A single run does not estimate organizational exposure, recovery or ROI',
  'those responses do not become several independent participants',
  'compares eligible included responses to the same diagnostic within a defined scope',
  'keeping each result visible',
  'A combined score appears only when the inputs meet Monderman’s comparison requirements',
  'Separate cost scenarios require operational measurements, change and adoption assumptions, and explicit costs',
  'capacity value is not cash savings',
];
function assertReadingGuide(value){
  const text=value.replace(/\s+/g,' ');
  for(const phrase of guideRequirements)assert.ok(text.includes(phrase),'Reading guide preserves scope: '+phrase);
  assert.doesNotMatch(text,/preserve the current|bounded burden|declared coherence controls|fictional/i,'Reading guide avoids internal template descriptions');
}
const guideHtml=fs.readFileSync(path.join(root,'sample-report.html'),'utf8').match(/<details class="sample-library-method">[\s\S]*?<\/details>/)?.[0];
check(Boolean(guideHtml),'Actual reading guide exists');
const sourceGuide=guideHtml.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
assertReadingGuide(sourceGuide);checks++;
for(const phrase of guideRequirements){
  assert.throws(()=>assertReadingGuide(sourceGuide.replace(phrase,'removed boundary')),/Reading guide preserves scope/);checks++;
}
for(const bad of ['preserve the current','bounded burden','declared coherence controls','fictional']){
  assert.throws(()=>assertReadingGuide(sourceGuide+' '+bad),/Reading guide avoids/);checks++;
}
if(process.argv.includes('--copy-only')){
  for(const [file,hash]of Object.entries(sourceHashes))equal(sha(fs.readFileSync(path.join(root,file))),hash,'Static guide test leaves source unchanged');
  console.log(JSON.stringify({status:'COPY_ONLY_PASS',checks,readingGuideRequirements:guideRequirements.length,negativeGuideCases:12,browserStates:0,networkRequests:0}));
  process.exit(0);
}
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
globalThis.fetch=()=>{throw Error('This local-only test does not use network fetch');};

async function shot(locator,file){await locator.screenshot({path:path.join(out,file)});screenshots.push(file);}
async function linkStates(page,selector,name){
  const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await control.evaluate(el=>el.blur());
  const state=()=>control.evaluate(el=>({color:getComputedStyle(el).color,outline:getComputedStyle(el).outlineColor,outlineWidth:getComputedStyle(el).outlineWidth,focusVisible:el.matches(':focus-visible')}));
  await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).color==='rgb(12, 110, 120)',selector);
  const normal=await state();equal(normal.color,'rgb(12, 110, 120)',name+' link normal');await control.hover();
  await page.waitForFunction(selector=>getComputedStyle(document.querySelector(selector)).color==='rgb(10, 91, 99)',selector);
  const hover=await state();equal(hover.color,'rgb(10, 91, 99)',name+' link hover');
  await page.mouse.move(0,0);await page.keyboard.press('Tab');await control.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(selector=>{const el=document.querySelector(selector);return el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3;},selector);
  const focus=await state();check(focus.focusVisible&&parseFloat(focus.outlineWidth)>=3,name+' link keyboard focus');return {normal,hover,focus};
}
async function buttonStates(page,selector,name,{normal,hover,text}){
  const control=page.locator(selector);await control.scrollIntoViewIfNeeded();
  await page.mouse.move(0,0);await control.evaluate(el=>el.blur());
  const read=()=>control.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,border:s.borderTopColor,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle,focused:document.activeElement===el,focusVisible:el.matches(':focus-visible')};});
  // Transitions are presentation only; wait for their actual computed end state.
  await page.waitForFunction(({selector,color})=>getComputedStyle(document.querySelector(selector)).backgroundColor===color,{selector,color:normal});
  const base=await read();equal(base.background,normal,name+' normal background');equal(base.color,text,name+' text contrast token');
  await shot(control,name+'-normal.png');
  await control.hover();
  await page.waitForFunction(({selector,color})=>getComputedStyle(document.querySelector(selector)).backgroundColor===color,{selector,color:hover});
  const over=await read();equal(over.background,hover,name+' hover background');equal(over.color,text,name+' hover text token');
  await shot(control,name+'-hover.png');
  await page.mouse.move(0,0);await page.keyboard.press('Tab');await control.focus();await page.keyboard.press('ArrowRight');
  try{await page.waitForFunction(selector=>{const el=document.querySelector(selector);return el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3;},selector,{timeout:3000});}
  catch(error){throw new Error(name+' focus did not settle: '+JSON.stringify(await read()),{cause:error});}
  const focus=await read();check(focus.focused&&focus.focusVisible&&parseFloat(focus.outlineWidth)>=3&&focus.outlineStyle==='solid',name+' visible keyboard focus '+JSON.stringify(focus));
  await shot(control,name+'-focus.png');
  return {base,hover:over,focus};
}
async function contained(page,selector,name){
  const geometry=await page.locator(selector).evaluate(el=>{const box=el.getBoundingClientRect();return {width:box.width,
    pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    escaping:[...el.querySelectorAll('button,a,summary,h1,h2,p')].filter(node=>{const r=node.getBoundingClientRect();return r.width&&r.height&&(r.left<box.left-1||r.right>box.right+1);}).map(node=>node.tagName+'.'+node.className)};});
  check(geometry.width>0&&geometry.pageOverflow<=1,name+' fits viewport');equal(geometry.escaping,[],name+' contained controls/text');return geometry;
}
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      const local=url.origin===origin;
      const localFont=url.origin==='https://www.monderman.com'&&/^\/(?:55|56|65|66|75|76)font\.woff2?$/.test(url.pathname);
      const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if((local||localFont)&&!path.relative(root,candidate).startsWith('..')&&types[path.extname(candidate)]&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile())
        return route.fulfill({status:200,contentType:types[path.extname(candidate)],body:fs.readFileSync(candidate)});
      blockedRemoteRequests++;return route.abort();
    });
    const key=engine+'-'+width;
    await page.goto(origin+'/index.html',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    equal(await page.locator('.home-preview-label span').allTextContents(),['From organizational evidence to a business case','Illustrative example']);
    equal(await page.locator('.home-preview-caption').textContent(),'Combine organizational evidence, evaluate a practical opportunity and track the result.');
    equal((await page.locator('#home-output-title').innerText()).replace(/\s+/g,' '),'See the findings. Understand the opportunity.');
    equal(await page.locator('.home-output-copy>p:not(.home-output-eyebrow)').textContent(),'Explore diagnostic findings, participant experience, and practical next steps. Team-level examples also show time and cost scenarios built from stated operating assumptions.');
    equal((await page.locator('.home-output-copy>a').textContent()).trim(),'Explore sample reports →');
    equal(await page.locator('.home-output-copy>a').getAttribute('href'),'sample-report.html');
    equal(await page.locator('#sample-output .hero-report-link').getAttribute('href'),'sample-report.html#depth');
    equal(await page.locator('[data-demo-score]').count(),0,'No single-run score relabeled as organizational money');
    equal(await page.locator('[data-demo-recovery]').count(),0,'No score-derived recovery figure');
    for(const [journey,source]of [['structural_clarity',artifact.outputs.depth_synthesis.source],['cross_lens_synthesis',cross]]){
      const financial=page.locator('[data-demo-financial-case="'+journey+'"]'),totals=source.financial_scenario.totals;
      equal(await financial.count(),1,'One case from its own accepted report: '+journey);
      equal(await financial.locator('[data-demo-hours]').textContent(),whole(totals.potentialHoursFreed.central));
      equal(await financial.locator('[data-demo-capacity]').textContent(),money(totals.capacityValue.central));
      equal(await financial.locator('[data-demo-cost]').textContent(),money(totals.totalImplementationAndSubscriptionCost.central));
      if(source.financial_scenario.version==='operational-planning-scenario-20260919.2'){
        equal(await financial.locator('[data-demo-spending-reduction]').textContent(),money(totals.existingSpendingReduction.central));
        equal(await financial.locator('[data-demo-spending-avoidance]').textContent(),money(totals.futureSpendingAvoidance.central));
        equal(await financial.locator('[data-demo-coverage]').textContent(),'All three benefit categories have been assessed.');
        equal(await financial.locator('.hwd-financial-note').last().textContent(),'Capacity is not cash savings. Hours assigned to spending benefits are excluded from retained capacity. These estimates use operating records and assumptions, not diagnostic scores.');
      }else equal(await financial.locator('.hwd-financial-note').textContent(),'Capacity value is not cash savings. These estimates use operational inputs and change assumptions, not diagnostic scores.');
    }
    equal(await page.locator('[data-demo-financial-case]').count(),2,'No financial case invented for the other three Depth previews');
    for(const group of cross.source_groups)equal(await page.locator('[data-demo-lens="'+group.tool_type+'"]').textContent(),whole(group.median_score)+' / 100','Exact per-lens median');
    equal(await page.locator('[data-promo-capacity]').textContent(),'About '+roundedMoney(scenario.totals.capacityValue.central));
    equal(await page.locator('.md-scenario-cases dt').allTextContents(),['Low','Central','High']);
    equal(await page.locator('.md-scenario-cases dd').allTextContents(),['low','central','high'].map(k=>roundedMoney(scenario.totals.capacityValue[k])));
    if(threeBenefit){
      equal(await page.locator('[data-promo-spending-reduction]').textContent(),money(scenario.totals.existingSpendingReduction.central));
      equal(await page.locator('[data-promo-spending-avoidance]').textContent(),money(scenario.totals.futureSpendingAvoidance.central));
      equal(await page.locator('[data-promo-net-cash]').textContent(),money(scenario.totals.netCashEffect.central));
      equal(await page.locator('[data-promo-total-cost]').textContent(),money(scenario.totals.totalImplementationAndSubscriptionCost.central));
      equal(await page.locator('.md-opportunity>p').allTextContents(),['Retained staff capacity value, not cash savings. Estimate entered.','Named input cases, not ordered bounds. Full assumptions and exact values in the report.']);
      check((await page.locator('.md-basis').textContent()).includes('Capacity excludes hours assigned to spending benefits.'),'No double-counted capacity');
      const assumptions=await page.locator('[data-demo-assumptions-for="structural_clarity"]').textContent();
      for(const level of ['low','central','high'])check(assumptions.includes(money(scenario.totals.existingSpendingReduction[level])+' lower spending; '+money(scenario.totals.futureSpendingAvoidance[level])+' avoided future spending; '+money(scenario.totals.capacityValue[level])+' retained capacity.'),'Every named saved case remains discoverable');
      check(assumptions.includes('Combined value after all costs, central case: '+money(scenario.totals.netKnownBenefitSubtotal.central)),'Saved net planning value retained');
      check(assumptions.includes('not a measured bank-balance change'),'Cash baseline versus measured savings is explicit');
    }else{
      equal(await page.locator('[data-promo-net-cash]').textContent(),range('netCashEffect'));
      equal(await page.locator('[data-promo-total-cost]').textContent(),range('totalImplementationAndSubscriptionCost'));
      equal(await page.locator('.md-opportunity>p').allTextContents(),[
        'Potential staff capacity value, not cash savings.',
        'Rounded planning scenarios. See the assumptions and exact values in the report.'
      ],'Capacity is not cash and rounded cases retain their assumption reference');
      check((await page.locator('.md-basis').textContent()).includes(scenario.inputs.measuredPeople+' people over '+scenario.method.measurementDays+' measured days'),'Separate operational measurement basis retained');
      check((await page.locator('.home-preview-method').textContent()).includes('The low case shows '+money(crossScenario.totals.netCapacityAndCashValue.low)),'Saved low-case outcome remains discoverable');
      check((await page.locator('.home-preview-method').textContent()).includes('central net cash effect is '+money(crossScenario.totals.netCashEffect.central)),'Cash and capacity are not conflated');
    }
    check(!/fictional|generated sample|illustrative interface/i.test(await page.locator('.home-workspace-preview').textContent()),'Repeated preview caveats removed');
    const heroStates=await buttonStates(page,'.hero-actions .btn-accent',key+'-home-cta',{normal:'rgb(169, 208, 212)',hover:'rgb(196, 225, 227)',text:'rgb(4, 24, 27)'});
    const panels=[];
    for(const name of ['measure','analysis','actions','return']){
      await page.locator('#hwd-tab-'+name).click();equal(await page.locator('[data-workspace-demo] [role="tabpanel"]:visible').count(),1);
      check(await page.locator('#hwd-panel-'+name).isVisible(),name+' tab activates');panels.push(await contained(page,'.home-workspace-preview',key+' '+name));
    }
    await page.locator('#hwd-tab-measure').focus();await page.keyboard.press('ArrowLeft');equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-return');
    await page.keyboard.press('Home');equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-measure');
    for(const name of ['analysis','actions','return']){await page.locator('[data-demo-next="'+name+'"]').click();equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-'+name);}
    await page.locator('#hwd-tab-analysis').click();await shot(page.locator('.home-workspace-preview'),key+'-workspace.png');
    const nextStates=await linkStates(page,'[data-demo-next="actions"]',key+' preview next step');
    const outputLinkStates=await linkStates(page,'.home-output-copy>a',key+' sample report link');
    await shot(page.locator('#sample-output'),key+'-sample-tile.png');
    const homeErrors=[...errors];equal(homeErrors,[],key+' homepage script errors');errors.length=0;

    await page.goto(origin+'/sample-report.html',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    equal((await page.locator('.sample-library-heading').innerText()).replace(/\s+/g,' '),'Clear findings. Practical next steps.');
    equal(await page.locator('.sample-library-lede').textContent(),'Explore reports from Monderman’s four diagnostics, Depth Synthesis, and Cross-Lens Synthesis. See how the results help leaders identify where to focus, understand the potential value of improvement, and decide what to do next.');
    equal((await page.locator('.notice-inner p').textContent()).trim(),disclosure);
    equal(await page.locator('.sample-library-primary').getAttribute('href'),'pilot.html');
    equal((await page.locator('.sample-library-primary').textContent()).trim(),'Request an invitation →');
    const libraryStates=await buttonStates(page,'.sample-library-primary',key+'-sample-cta',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)',text:'rgb(255, 255, 255)'});
    const libraryLinkStates=await linkStates(page,'.sample-library-actions>a:not(.sample-library-primary)',key+' report anchor');
    await contained(page,'.sample-library-intro',key+' library intro');await shot(page.locator('.sample-library-intro'),key+'-library.png');
    const readingGuide=page.locator('.sample-library-method');
    await readingGuide.locator('summary').focus();await page.keyboard.press('Enter');
    check(await readingGuide.getAttribute('open')!==null,key+' reading guide opens from keyboard');
    const guideText=await readingGuide.innerText();
    assertReadingGuide(guideText);checks++;
    await contained(page,'.sample-library-method',key+' expanded reading guide');
    await shot(readingGuide,key+'-reading-guide.png');
    await readingGuide.locator('summary').focus();await page.keyboard.press('Enter');
    equal(await readingGuide.getAttribute('open'),null,key+' reading guide closes from keyboard');
    await page.waitForFunction(()=>document.querySelectorAll('.psr-wrap').length===6);
    equal(await page.locator('.psr-load-error').count(),0,'All six reviewed public reports load');
    // Intercept downloads only to check toolbar wiring against the exact
    // reviewed source/model. This does not claim a downloaded PDF was inspected.
    const mounted=await page.evaluate(artifact=>{
      const entry=artifact.outputs.operational_systems,model=MondermanReport.fromRun(entry.source);
      model.sampleProvenance={synthetic:true,...entry.provenance};
      const calls=[];window.__marketingUI={calls,model};
      MondermanReport.downloadPdf=value=>calls.push({kind:'pdf',same:value===model});
      MondermanReport.downloadHtml=value=>calls.push({kind:'html',same:value===model});
      MondermanReport.downloadJson=value=>calls.push({kind:'json',same:value===entry.source});
      MondermanSampleReportShell.mount({shell:document.getElementById('report-os'),model,source:entry.source,
        sourceKey:'operational_systems',toolbarLabel:'Local display check',provenance:'Exact reviewed source; local toolbar-wiring check only.'});
      return {sourceScore:entry.source.score,modelScore:model.score};
    },artifact);
    equal(mounted.sourceScore,mounted.modelScore,'Read-only fixture score preserved');
    const pdfStates=await buttonStates(page,'#report-os [data-action="print"]',key+'-pdf',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)',text:'rgb(255, 255, 255)'});
    equal(await page.locator('#report-os [data-action="print"]').textContent(),'Download PDF');
    await page.locator('#report-os [data-action="read"]').click();
    check(await page.evaluate(()=>document.activeElement.matches('#report-os .mr-cover')),'Read the report moves keyboard focus to overview');
    await page.locator('#report-os [data-action="print"]').click();
    await page.locator('#report-os .psr-downloads summary').click();
    await page.locator('#report-os [data-action="html"]').click();await page.locator('#report-os [data-action="json"]').click();
    equal(await page.evaluate(()=>__marketingUI.calls),[{kind:'pdf',same:true},{kind:'html',same:true},{kind:'json',same:true}],'All original download callbacks remain attached to unchanged source/model');
    await contained(page,'#report-os .psr-toolbar',key+' toolbar');await shot(page.locator('#report-os .psr-toolbar'),key+'-toolbar.png');
    equal(errors,[],key+' sample page script errors');
    rows.push({engine,width,heroStates,libraryStates,pdfStates,nextStates,outputLinkStates,libraryLinkStates,panels,localDisplayOnly:true});await page.close();
  }}finally{await browser.close();}
}
equal(sha(fs.readFileSync(artifactPath)),sha(artifactBytes),'Actual artifact bytes unchanged');
for(const [file,digest]of Object.entries(sourceHashes))equal(sha(fs.readFileSync(path.join(root,file))),digest,'Frozen source unchanged during test: '+file);
const result={status:'PASS',checks,layouts:rows.length,networkCalls:0,providerCalls:0,databaseCalls:0,pdfsCreated:0,
  blockedRemoteRequests,artifactContract:artifact.contract,artifactSha256:sha(artifactBytes),currentSamplePublicationApproved:false,
  sourceHashes,rows,screenshots};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:result.status,checks,layouts:rows.length,screenshots:screenshots.length,output:out,networkCalls:0,pdfsCreated:0,currentSamplePublicationApproved:false}));
