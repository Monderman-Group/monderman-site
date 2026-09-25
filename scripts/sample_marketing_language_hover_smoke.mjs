// Local display regression, not current-sample publication or AI-quality proof.
// Actual page/CSS/JS bytes are served by interception; no remote request escapes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';

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
assert.equal(scenario.version,'operational-planning-scenario-20260919.2');
assert.equal(scenario.method.usesDiagnosticScores,false);
assert.equal(scenario.method.isConfidenceInterval,false);
const generatedHome=buildPublicSamplePreviewSections(artifact,fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8')).home;
const cross=artifact.outputs.cross_lens_synthesis.source;
const crossScenario=cross.financial_scenario;
const whole=value=>Math.round(value).toLocaleString('en-US');
const rows=[],screenshots=[];let checks=0,blockedRemoteRequests=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const guideRequirements=[
  'One run produces an individual report',
  'each compares responses from 15 people in an organization with 30 eligible participants',
  'These examples are not yet eligible for Depth Synthesis and do not present organizational savings',
  'examines responses to one diagnostic once the campaign meets its evidence requirements',
  'brings eligible results from multiple diagnostics together, keeping differences visible',
  'One person is counted once within each lens and once across the campaign, even if they complete all four diagnostics',
  'include separate operating records and change assumptions to estimate time, spending and capacity benefits',
  'Staff capacity is time available for other work, not automatically cash savings',
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
    equal(await page.locator('.home-preview-label span').allTextContents(),['See what the report tells you.','Illustrative example']);
    equal(await page.locator('.home-preview-caption').count(),0,'Compact journey has no redundant caption');
    equal((await page.locator('#home-output-title').innerText()).replace(/\s+/g,' '),'See the findings. Understand the opportunity.');
    equal(await page.locator('.home-output-copy>p:not(.home-output-eyebrow)').textContent(),'Explore what participants reported, the changes worth considering, and the potential time and spending benefits.');
    equal((await page.locator('.home-output-copy>a').textContent()).trim(),'Explore sample reports →');
    equal(await page.locator('.home-output-copy>a').getAttribute('href'),'sample-report.html');
    equal(await page.locator('#sample-output .hrq-footer>a').getAttribute('href'),'sample-report.html#depth');
    equal(await page.locator('[data-demo-score]').count(),0,'No single-run score relabeled as organizational money');
    equal(await page.locator('[data-demo-recovery]').count(),0,'No score-derived recovery figure');
    const financial=page.locator('.hwd-compact-values'),totals=crossScenario.totals;
    equal(await financial.count(),1,'Compact journey uses one accepted Cross-Lens planning case');
    for(const [attribute,values,format]of [
      ['data-demo-hours',totals.potentialHoursFreed,value=>whole(value)+' h'],
      ['data-demo-spending-reduction',totals.existingSpendingReduction,money],
      ['data-demo-spending-avoidance',totals.futureSpendingAvoidance,money],
    ]){
      const metric=financial.locator('['+attribute+']');
      equal(await metric.textContent(),format(values.central),'Exact rounded central display: '+attribute);
      equal(await metric.getAttribute('data-exact-value'),String(values.central),'Underlying exact value: '+attribute);
    }
    equal(await page.locator('[data-demo-financial-case]').count(),0,'Superseded expanded cases are not duplicated in the compact preview');
    equal(await page.locator('.hwd-compact-lenses span').allTextContents(),['structural_clarity','decision_velocity','operational_systems','institutional_performance'].map(tool=>cross.source_groups.find(group=>group.tool_type===tool).tool_label),'All four canonical diagnostic names remain visible in the approved order');
    equal(await page.locator('.hwd-compact-boundary').textContent(),'Capacity is not cash savings. Planning inputs are separate from scores.');
    equal(await page.locator('.hwd-sample-link').getAttribute('href'),'sample-report.html#synthesis','Full report remains one click away');
    equal(await page.locator('.hwd-sample-link').locator('xpath=ancestor::*[@role="tabpanel"]').count(),0,'Report link is independent of selected step');
    const quad=page.locator('[data-home-report-quad]');
    equal(await quad.count(),1,'One current Depth overview replaces the older financial tile');
    check(await quad.isVisible(),'Depth preview remains available at this viewport');
    equal(await quad.getAttribute('data-artifact-sha256'),artifact.artifact_sha256,'Depth preview retains current source identity');
    equal(await quad.locator('.hrq-tile').evaluateAll(nodes=>nodes.map(node=>node.dataset.quadSection)),['findings','money','change','evidence'],'Four separate report roles');
    equal(await quad.locator('.hrq-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length),width<=600?1:2,'Preview uses two readable columns on larger screens and one on phones');
    if(width>=834){
      const previewBox=await quad.boundingBox();
      check(previewBox.width>580,'New report preview is not constrained to the retired narrow tile width');
      check(previewBox.height<=680,'Two-column report preview retains the approved compact height');
    }
    equal(await quad.locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),Array(4).fill('sample-report.html#depth'),'Three section links and footer retain supported Depth routing');
    equal(await quad.locator('[data-promo-score]').textContent(),String(artifact.outputs.depth_synthesis.source.source_groups[0].median_score),'Recorded Depth score retained');
    equal(await quad.locator('.hrq-case').textContent(),'Central planning case · '+scenario.inputs.horizonMonths+' months','Case and period stay visible');
    equal(await quad.locator('.hrq-chart-note').textContent(),'Rounded. Before costs. Planning estimates.','Financial boundaries remain adjacent to graphics');
    equal(await quad.locator('.mr-overview-sankey').evaluateAll(nodes=>nodes.map(node=>node.dataset.previewKind)),['money','time'],'Dollars and hours retain separate chart scales');
    check(await page.evaluate(expected=>{
      const parsed=new DOMParser().parseFromString(expected,'text/html');
      return document.querySelector('[data-home-report-quad] .mr-overview-sankeys').outerHTML===parsed.querySelector('.mr-overview-sankeys').outerHTML;
    },generatedHome),'Browser charts preserve exact source-generated renderer markup');
    for(const kind of ['money','time']){
      const chart=quad.locator('[data-preview-kind="'+kind+'"]');
      equal(await chart.getAttribute('data-preview-case'),'central','Only central '+kind+' case in the overview');
      const svg=chart.locator('svg');equal(await svg.getAttribute('role'),'img',kind+' accessible graphic');
      check((await svg.getAttribute('aria-label')).includes('baseline.'),kind+' full numeric context stays accessible');
    }
    await contained(page,'[data-home-report-quad]',key+' Depth preview');
    const assumptions=await page.locator('[data-demo-assumptions-for="cross_lens_synthesis"]').textContent();
    equal(await page.locator('[data-demo-assumptions-for]').count(),1,'Assumptions match the single compact journey');
    for(const level of ['low','central','high'])check(assumptions.includes(money(crossScenario.totals.existingSpendingReduction[level])+' lower spending; '+money(crossScenario.totals.futureSpendingAvoidance[level])+' avoided future spending; '+money(crossScenario.totals.capacityValue[level])+' retained capacity.'),'Every named saved Cross-Lens case remains discoverable');
    check(assumptions.includes('Combined value after all costs, central case: '+money(crossScenario.totals.netKnownBenefitSubtotal.central)),'Saved net planning value retained');
    check(assumptions.includes('not a measured bank-balance change'),'Cash baseline versus measured savings is explicit');
    check(!/fictional|generated sample|illustrative interface/i.test(await page.locator('.home-workspace-preview').textContent()),'Repeated preview caveats removed');
    const heroStates=await buttonStates(page,'.hero-actions .btn-accent',key+'-home-cta',{normal:'rgb(169, 208, 212)',hover:'rgb(196, 225, 227)',text:'rgb(4, 24, 27)'});
    const panels=[];
    for(const name of ['measure','analysis','actions','return']){
      await page.locator('#hwd-tab-'+name).click();equal(await page.locator('[data-workspace-demo] [role="tabpanel"]:visible').count(),1);
      check(await page.locator('#hwd-panel-'+name).isVisible(),name+' tab activates');panels.push(await contained(page,'.home-workspace-preview',key+' '+name));
    }
    await page.locator('#hwd-tab-measure').focus();await page.keyboard.press('ArrowLeft');equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-return');
    await page.keyboard.press('Home');equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-measure');
    await page.locator('[data-demo-next="analysis"]').click();equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-analysis');
    await shot(page.locator('.home-workspace-preview'),key+'-workspace.png');
    await page.locator('#hwd-tab-actions').click();
    const nextStates=await linkStates(page,'[data-demo-next="return"]',key+' preview next step');
    await page.locator('[data-demo-next="return"]').click();equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-return');
    await page.locator('[data-demo-next="measure"]').click();equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-measure');
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
      const entry=artifact.outputs.operational_systems,model=MondermanPublicSamples.model(entry,artifact);
      const calls=[];window.__marketingUI={calls,model};
      MondermanReport.downloadPdf=value=>calls.push({kind:'pdf',same:value===model});
      MondermanReport.downloadHtml=value=>calls.push({kind:'html',same:value===model});
      MondermanReport.downloadJson=value=>calls.push({kind:'json',same:value===entry.source});
      MondermanSampleReportShell.mount({shell:document.getElementById('report-os'),model,source:entry.source,
        sourceKey:'operational_systems',toolbarLabel:'Local display check',provenance:'Exact reviewed source; local toolbar-wiring check only.'});
      return {sourceScore:entry.source.aggregate_score,modelScore:model.score,comparisonOnly:model.comparisonOnly,reads:model.reads};
    },artifact);
    equal(mounted.sourceScore,mounted.modelScore,'Read-only fixture score preserved');
    equal(mounted.comparisonOnly,true,'Toolbar uses the actual below-threshold response-comparison model');
    equal(mounted.reads,15,'Toolbar retains all15 included participant responses');
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
