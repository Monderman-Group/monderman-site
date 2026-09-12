// Local display regression, not current-sample publication or AI-quality proof.
// Actual page/CSS/JS bytes are served by interception; no remote request escapes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
const origin='http://127.0.0.1:49876';
const arg=process.argv.find(value=>value.startsWith('--output='));
const out=arg?arg.slice(9):fs.mkdtempSync('/tmp/sample-marketing-hover-');
if(arg){assert.ok(path.isAbsolute(out),'Output must be a fresh absolute directory');fs.mkdirSync(out,{mode:0o700});}
const sha=value=>createHash('sha256').update(value).digest('hex');
const artifactPath=path.join(root,'sample-data/production-diagnostic-samples.json');
const artifactBytes=fs.readFileSync(artifactPath),artifact=JSON.parse(artifactBytes);
const tracked=['index.html','sample-report.html','homepage-workspace-demo.css','homepage-workspace-demo.js',
  'sample-report-production.css','sample-report-production.js','scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html'];
const sourceHashes=Object.fromEntries(tracked.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const disclosure='These reports use realistic example responses to demonstrate Monderman’s analysis and reporting.';
const caption='Based on the assumptions shown in the report, before subscription and implementation costs.';
const rows=[],screenshots=[];let checks=0,blockedRemoteRequests=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
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
    equal(await page.locator('.home-preview-label span').allTextContents(),['Explore Monderman Workspace','Sample data']);
    equal(await page.locator('.home-preview-caption').textContent(),'See how diagnostic results become clear findings, practical next steps, and a baseline for tracking change.');
    equal((await page.locator('#home-output-title').innerText()).replace(/\s+/g,' '),'See the findings. Understand the opportunity.');
    equal(await page.locator('.home-output-copy>p:not(.home-output-eyebrow)').textContent(),'Explore how Monderman connects diagnostic results with participant experience, priorities for improvement, and estimates of time and cost.');
    equal((await page.locator('.home-output-copy>a').textContent()).trim(),'Explore sample reports →');
    equal(await page.locator('.home-output-copy>a').getAttribute('href'),'sample-report.html');
    equal(await page.locator('#sample-output .hero-report-link').getAttribute('href'),'sample-report.html#depth');
    equal(await page.locator('[data-demo-score]').textContent(),String(artifact.outputs.decision_velocity.source.score));
    equal(await page.locator('[data-demo-recovery]').textContent(),'$'+artifact.outputs.decision_velocity.source.exposure.recoverable_cost.toLocaleString('en-US'));
    equal(await page.locator('.hwd-reading>p').textContent(),caption);
    equal(await page.locator('.md-opportunity>p').textContent(),caption);
    check((await page.locator('.md-basis').textContent()).includes('median of submitted estimates, not their sum'),'Median scenario method retained');
    check((await page.locator('.home-preview-method').textContent()).includes('not a measured saving'),'Financial assumption method retained');
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
    equal(await page.locator('.sample-library-primary').getAttribute('href'),'decision-velocity.html');
    equal((await page.locator('.sample-library-primary').textContent()).trim(),'Run Decision Velocity free →');
    const libraryStates=await buttonStates(page,'.sample-library-primary',key+'-sample-cta',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)',text:'rgb(255, 255, 255)'});
    const libraryLinkStates=await linkStates(page,'.sample-library-actions>a:not(.sample-library-primary)',key+' report anchor');
    await contained(page,'.sample-library-intro',key+' library intro');await shot(page.locator('.sample-library-intro'),key+'-library.png');
    // The current repository's historical v2 sample remains correctly rejected.
    // Exercise toolbar mechanics with its exact saved source in a separate,
    // explicitly local mount; never fabricate a completed v3 publication.
    if(artifact.contract!=='monderman-public-product-samples/v3')equal(await page.locator('.psr-load-error').count(),6,'Historical artifact stays fail-closed');
    const mounted=await page.evaluate(artifact=>{
      const entry=artifact.outputs.operational_systems,model=MondermanReport.fromRun(entry.source);
      model.sampleProvenance={synthetic:true,...entry.provenance};
      const calls=[];window.__marketingUI={calls,model};
      MondermanReport.downloadPdf=value=>calls.push({kind:'pdf',same:value===model});
      MondermanReport.downloadHtml=value=>calls.push({kind:'html',same:value===model});
      MondermanReport.downloadJson=value=>calls.push({kind:'json',same:value===entry.source});
      MondermanSampleReportShell.mount({shell:document.getElementById('report-os'),model,source:entry.source,
        sourceKey:'operational_systems',toolbarLabel:'Local display check',provenance:'Exact saved legacy source; no current-sample publication or AI-quality claim.'});
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
    rows.push({engine,width,heroStates,libraryStates,pdfStates,nextStates,outputLinkStates,libraryLinkStates,panels,localLegacyDisplayOnly:true});await page.close();
  }}finally{await browser.close();}
}
equal(sha(fs.readFileSync(artifactPath)),sha(artifactBytes),'Actual artifact bytes unchanged');
for(const [file,digest]of Object.entries(sourceHashes))equal(sha(fs.readFileSync(path.join(root,file))),digest,'Frozen source unchanged during test: '+file);
const result={status:'PASS',checks,layouts:rows.length,networkCalls:0,providerCalls:0,databaseCalls:0,pdfsCreated:0,
  blockedRemoteRequests,artifactContract:artifact.contract,artifactSha256:sha(artifactBytes),currentSamplePublicationApproved:false,
  sourceHashes,rows,screenshots};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:result.status,checks,layouts:rows.length,screenshots:screenshots.length,output:out,networkCalls:0,pdfsCreated:0,currentSamplePublicationApproved:false}));
