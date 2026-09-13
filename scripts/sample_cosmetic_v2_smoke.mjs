// Isolated cosmetic release: real saved v2 sources and renderer, no new report approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),built=path.join(root,'.render-public');
const base='c9432bfd7b77f929bc9a1d10b25d8a724d7398e3',origin='http://cosmetic.test';
const out=process.env.COSMETIC_OUT||fs.mkdtempSync('/tmp/monderman-cosmetic-v2-');
if(process.env.COSMETIC_OUT){assert.ok(path.isAbsolute(out)&&!fs.existsSync(out));fs.mkdirSync(out,{mode:0o700});}
const sha=b=>createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(root,f));
const original=f=>execFileSync('git',['show',base+':'+f],{cwd:root,maxBuffer:8*1024*1024});
let checks=0,blockedRemoteRequests=0;const check=(x,m)=>{assert.ok(x,m);checks++;},equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const runtimeChanges=new Set(['index.html','sample-report.html','homepage-workspace-demo.css','sample-report-production.css','public-search-index.json']);
const all=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
const protectedFiles=all.filter(f=>!f.includes('/')&&/\.(?:html|css|js|json|woff2?)$/.test(f)&&!runtimeChanges.has(f));
for(const f of [...protectedFiles,'sample-data/production-diagnostic-samples.json','assets/brand/brand-foundations-v2.css'])equal(sha(read(f)),sha(original(f)),'Production bytes unchanged: '+f);
const artifactBytes=read('sample-data/production-diagnostic-samples.json'),artifact=JSON.parse(artifactBytes);
equal(sha(artifactBytes),'76c4fdf7bebde113b4cb6504578168c9d65117d680e7ae23480b8fa3067a32ae');
equal(artifact.contract,'monderman-public-product-samples/v2');equal(artifact.synthetic,true);
equal(artifact.publication_projection.version,'monderman-public-sample-projection-20260911.2');
const releaseFile='sample-data/production-sample-release.json',oldReleaseBytes=original(releaseFile),oldRelease=JSON.parse(oldReleaseBytes),release=JSON.parse(read(releaseFile));
const cosmetic=release.cosmetic_review;
equal(cosmetic.previous_manifest_sha256,sha(oldReleaseBytes));equal(cosmetic.base_commit,base);
equal(Object.keys(cosmetic.source_files),['scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html']);
const restoredRelease=structuredClone(release);delete restoredRelease.cosmetic_review;
for(const[f,pin]of Object.entries(cosmetic.source_files)){
  equal(pin.previous_sha256,oldRelease.source_files[f]);equal(pin.current_sha256,sha(read(f)));equal(release.source_files[f],pin.current_sha256);
  restoredRelease.source_files[f]=pin.previous_sha256;
}
equal(restoredRelease,oldRelease,'Every original AI approval, output, projection and review field remains exact');
const sourceFiles=[...runtimeChanges,releaseFile,'scripts/inject-public-shell.mjs','scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html'];
const frozen=Object.fromEntries(sourceFiles.map(f=>[f,sha(read(f))]));
const oldSearch=JSON.parse(original('public-search-index.json')),newSearch=JSON.parse(read('public-search-index.json'));
equal(newSearch.map(r=>r.url),oldSearch.map(r=>r.url));
equal(newSearch.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(oldSearch[i])).map(r=>r.url),['index.html','sample-report.html'],'Only the two changed marketing records advance');
for(const [page,css]of [['index.html','homepage-workspace-demo.css'],['sample-report.html','sample-report-production.css']]){
  const html=fs.readFileSync(path.join(built,page),'utf8');
  check(html.includes(css+'?v=20260913-cosmetic1'),'Actual built CSS cache key: '+css);
  equal(sha(fs.readFileSync(path.join(built,css))),sha(read(css)));
}
const sampleHtml=fs.readFileSync(path.join(built,'sample-report.html'),'utf8');
for(const file of ['monderman-report.js','sample-report-production.js']){
  check(sampleHtml.includes(file+'?v=20260910-report22-brand3'),'Unchanged report script cache: '+file);
  equal(sha(fs.readFileSync(path.join(built,file))),sha(original(file)));
}
check(sampleHtml.includes('public-sample-model.js?v=20260911-current-output'),'Original v2 adapter reference retained');
equal(sha(fs.readFileSync(path.join(built,'public-sample-model.js'))),sha(original('public-sample-model.js')));
equal(sha(fs.readFileSync(path.join(built,'sample-data/production-diagnostic-samples.json'))),sha(artifactBytes));
check(sampleHtml.includes('href="javascript:window.print()"'),'Existing top-level print behavior retained');
check(!sampleHtml.includes('sample-selected-pdf'),'No unimplemented new PDF control');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
const rows=[],screenshots=[];
async function state(page,selector,name,{normal,hover,background=false,text}){
  const c=page.locator(selector);await c.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await c.evaluate(el=>el.blur());
  const prop=background?'backgroundColor':'color';
  await page.waitForFunction(({selector,prop,value})=>getComputedStyle(document.querySelector(selector))[prop]===value,{selector,prop,value:normal});
  if(text)equal(await c.evaluate(el=>getComputedStyle(el).color),text,name+' text contrast token');
  await c.hover();await page.waitForFunction(({selector,prop,value})=>getComputedStyle(document.querySelector(selector))[prop]===value,{selector,prop,value:hover});checks+=2;
  await page.mouse.move(0,0);await page.keyboard.press('Tab');await c.focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(selector=>{const el=document.querySelector(selector),s=getComputedStyle(el);return el.matches(':focus-visible')&&parseFloat(s.outlineWidth)>=3&&s.outlineStyle!=='none';},selector,{timeout:3000});
  const focus=await c.evaluate(el=>({visible:el.matches(':focus-visible'),width:getComputedStyle(el).outlineWidth,style:getComputedStyle(el).outlineStyle}));
  check(focus.visible&&parseFloat(focus.width)>=3&&focus.style!=='none',name+' visible focus '+JSON.stringify(focus));
  return {normal,hover,focus:true};
}
async function shot(page,selector,name){await page.locator(selector).screenshot({path:path.join(out,name)});screenshots.push(name);}
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};});
    await page.route('**/*',route=>{
      const u=new URL(route.request().url()),local=u.origin===origin,localFont=u.origin==='https://www.monderman.com'&&/^\/(55|56|65|66|75|76)font\.woff2?$/.test(u.pathname);
      const file=path.resolve(built,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
      if((local||localFont)&&!path.relative(built,file).startsWith('..')&&types[path.extname(file)]&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:types[path.extname(file)],body:fs.readFileSync(file)});
      blockedRemoteRequests++;return route.abort();
    });
    const id=engine+'-'+width;
    await page.goto(origin+'/index.html',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    equal(await page.locator('.home-preview-label span').allTextContents(),['Explore Monderman Workspace','Sample data']);
    equal((await page.locator('#home-output-title').innerText()).replace(/\s+/g,' '),'See the findings. Understand the opportunity.');
    equal(await page.locator('.home-output-copy>a').getAttribute('href'),'sample-report.html');
    equal(await page.locator('[data-demo-score]').textContent(),String(artifact.outputs.decision_velocity.source.score));
    equal(await page.locator('[data-demo-recovery]').textContent(),'$'+artifact.outputs.decision_velocity.source.exposure.recoverable_cost.toLocaleString('en-US'));
    check((await page.locator('.home-preview-method').textContent()).includes('not a measured saving'),'Financial limitation preserved');
    check(!/fictional|generated sample|illustrative interface/i.test(await page.locator('.home-workspace-preview').textContent()),'No fictional wording in marketing preview');
    const hero=await state(page,'.hero-actions .btn-accent',id+' hero',{normal:'rgb(169, 208, 212)',hover:'rgb(196, 225, 227)',background:true,text:'rgb(4, 24, 27)'});
    const link=await state(page,'.home-output-copy>a',id+' sample link',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)'});
    for(const tab of ['measure','analysis','actions','return']){await page.locator('#hwd-tab-'+tab).click();equal(await page.locator('[data-workspace-demo] [role="tabpanel"]:visible').count(),1);}
    await page.locator('#hwd-tab-measure').focus();await page.keyboard.press('ArrowLeft');equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-return');
    await page.locator('#hwd-tab-analysis').click();
    if(width!==834){await shot(page,'.home-workspace-preview',id+'-home.png');await shot(page,'#sample-output',id+'-sample-tile.png');}
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+' homepage fits');
    equal(errors,[],id+' homepage script errors');
    await page.goto(origin+'/sample-report.html',{waitUntil:'load'});await page.locator('body.production-samples-ready').waitFor();await page.evaluate(()=>document.fonts.ready);
    const headerClearance=await page.evaluate(()=>({headerBottom:document.querySelector('.header').getBoundingClientRect().bottom,introTop:document.querySelector('.sample-library-intro').getBoundingClientRect().top}));
    check(headerClearance.introTop>=headerClearance.headerBottom,id+' sample introduction clears fixed header '+JSON.stringify(headerClearance));
    equal(await page.locator('.psr-load-error').count(),0,'Real v2 samples load normally');
    equal(await page.locator('.report-shell .psr-wrap').count(),6,'All six actual v2 reports render');
    equal((await page.locator('.notice-inner p').textContent()).trim(),'These reports use realistic example responses to demonstrate Monderman’s analysis and reporting.');
    equal((await page.locator('.sample-library-heading').innerText()).replace(/\s+/g,' '),'Clear findings. Practical next steps.');
    equal(await page.locator('.sample-library-primary').getAttribute('href'),'decision-velocity.html');
    const cta=await state(page,'.sample-library-primary',id+' library CTA',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)',background:true,text:'rgb(255, 255, 255)'});
    await state(page,'.sample-library-actions>a:not(.sample-library-primary)',id+' report anchor',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)'});
    await page.evaluate(()=>{window.__cosmeticCalls=[];for(const kind of ['Pdf','Html','Json'])MondermanReport['download'+kind]=value=>__cosmeticCalls.push({kind,value});});
    for(const [tab,key]of Object.entries({os:'operational_systems',dv:'decision_velocity',sc:'structural_clarity',ip:'institutional_performance',synthesis:'cross_lens_synthesis',depth:'depth_synthesis'})){
      await page.locator('#tab-'+tab).click();equal(await page.locator('.report-shell:visible').count(),1);check(await page.locator('#report-'+tab).isVisible(),id+' '+tab+' selected');
      equal(await page.locator('#report-'+tab+' .psr-wrap').getAttribute('data-artifact-sha256'),artifact.artifact_sha256);
      equal(await page.locator('#report-'+tab+' .psr-wrap').getAttribute('data-source-key'),key);
      const pdf=await state(page,'#report-'+tab+' [data-action="print"]',id+' '+tab+' PDF',{normal:'rgb(12, 110, 120)',hover:'rgb(10, 91, 99)',background:true,text:'rgb(255, 255, 255)'});
      for(const action of ['print','html','json'])await page.locator('#report-'+tab+' [data-action="'+action+'"]').click();
      const entry=artifact.outputs[key],source={export_payload:{...entry.source,sample_provenance:{...entry.provenance,engine_commit:artifact.engine_commit,artifact_sha256:artifact.artifact_sha256}}};
      const calls=await page.evaluate(({source})=>{const c=__cosmeticCalls.splice(0);return {kinds:c.map(r=>r.kind),sameModel:c[0].value===c[1].value,exactSource:JSON.stringify(c[2].value)===JSON.stringify(source)};},{source});
      equal(calls,{kinds:['Pdf','Html','Json'],sameModel:true,exactSource:true},id+' '+tab+' original download bindings');
      check((await page.locator('#report-'+tab).textContent()).includes('About this example'),'Existing report provenance remains, not hidden');
    }
    await page.locator('#tab-os').focus();await page.keyboard.press('ArrowRight');equal(await page.locator('#tab-dv').getAttribute('aria-selected'),'true');await page.keyboard.press('End');equal(await page.locator('#tab-depth').getAttribute('aria-selected'),'true');await page.keyboard.press('Home');equal(await page.locator('#tab-os').getAttribute('aria-selected'),'true');
    if(width!==834){await shot(page,'.sample-library-intro',id+'-library.png');await shot(page,'#report-os .psr-toolbar',id+'-toolbar.png');await page.evaluate(()=>scrollTo(0,0));const name=id+'-page-top.png';await page.screenshot({path:path.join(out,name)});screenshots.push(name);}
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id+' sample page fits');equal(errors,[],id+' script errors');
    rows.push({engine,width,hero,link,cta,headerClearance,sixRealV2Reports:true});await page.close();
  }}finally{await browser.close();}
}
for(const[f,h]of Object.entries(frozen))equal(sha(read(f)),h,'Source stayed fixed: '+f);
equal(sha(read('sample-data/production-diagnostic-samples.json')),sha(artifactBytes));
const result={status:'PASS',checks,layouts:rows.length,protectedProductionFiles:protectedFiles.length,base,artifactSha256:sha(artifactBytes),sourceHashes:frozen,rows,screenshots,blockedRemoteRequests,networkCalls:0,providerCalls:0,pdfsCreated:0,newReportsPublished:false,semanticApproval:false};
fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,layouts:rows.length,screenshots:screenshots.length,out,providerCalls:0,pdfsCreated:0,newReportsPublished:false}));
