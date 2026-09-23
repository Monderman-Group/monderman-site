// Actual browser verification of portable report navigation and native controls.
// All source data stays local; this produces evidence, not publication approval.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.argv[2]);
assert.ok(process.argv[2]&&!fs.existsSync(out),'Choose a new browser evidence directory');
fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const artifactBytes=read('sample-data/production-diagnostic-samples.json');
const artifact=JSON.parse(artifactBytes),manifest=JSON.parse(read('sample-data/production-sample-release.json'));
assert.equal(sha(artifactBytes),manifest.artifact_file_sha256);
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInNewContext(read(file).toString(),context,{filename:file});
const htmls=Object.fromEntries(Object.entries(artifact.outputs).map(([key,entry])=>{
  const before=JSON.stringify(entry),model=context.window.MondermanPublicSamples.model(entry,artifact);
  const html=context.window.MondermanReport.buildReportHtml(model);
  assert.equal(JSON.stringify(entry),before);
  return [key,html];
}));
const rows=[],selfRunRows=[],errors=[],requests=[];
let assertions=0;
const ok=(condition,label)=>{assert.ok(condition,label);assertions++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try {
    for(const width of [320,390,834,1440])for(const [key,html] of Object.entries(htmls))for(const javaScriptEnabled of [true,false]){
      const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled,reducedMotion:'reduce'});
      page.on('pageerror',error=>errors.push({engine,width,key,error:error.message}));
      await page.route('**/*',route=>{
        const font=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if(font)return route.fulfill({contentType:'font/woff2',body:read(font[1]+'font.woff2')});
        requests.push(route.request().url());return route.abort();
      });
      await page.setContent(html);
      // A disabled-script context does not run animation-frame callbacks.
      // Load-event completion plus a short paint settle works in both modes.
      await page.waitForTimeout(80);
      const tag=[engine,width,key,javaScriptEnabled?'script':'noscript'].join('-');
      const clearance=await page.evaluate(()=>({navigation:document.querySelector('.mr-screen-nav').getBoundingClientRect().bottom,cover:document.querySelector('.mr-cover').getBoundingClientRect().top}));
      ok(clearance.cover>=clearance.navigation,tag+' initial overview clears navigation');
      if(javaScriptEnabled)await page.screenshot({path:path.join(out,tag+'-initial-viewport.png')});
      eq(await page.locator('.mr-overview-tile:visible').count(),4,tag+' four overview tiles');
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tag+' no overflow');
      const tiles=page.locator('.mr-overview-tile');
      for(let index=0;index<4;index++){
        const tile=tiles.nth(index),target=await tile.getAttribute('href');
        ok(await page.locator(target).count()===1,tag+' unique target');
        const styles=await tile.evaluate(node=>({background:getComputedStyle(node).backgroundColor,band:getComputedStyle(node.querySelector('.mr-overview-title')).backgroundColor,height:node.getBoundingClientRect().height}));
        eq(styles.background,'rgb(255, 255, 255)',tag+' white tile');
        eq(styles.band,'rgb(24, 119, 131)',tag+' teal header');
        ok(styles.height>=44,tag+' touch target');
        await tile.focus();
        eq(await tile.evaluate(node=>getComputedStyle(node).outlineStyle),'solid',tag+' visible keyboard focus');
        await page.keyboard.press('Enter');
        if(javaScriptEnabled)eq(await page.evaluate(()=>document.activeElement.id),target.slice(1),tag+' target receives focus');
        else eq(await page.evaluate(()=>location.hash),target,tag+' native anchor works without script');
        const section=page.locator(target),back=section.locator('.mr-section-back a').first();
        // Guidance tiles target a subsection of the interpretation section.
        const returnLink=await back.count()?back:section.locator('xpath=ancestor::section').locator('.mr-section-back a').first();
        eq(await returnLink.count(),1,tag+' destination has overview return');
        const returnTarget=await returnLink.getAttribute('href');
        await returnLink.focus();await page.keyboard.press('Enter');
        if(javaScriptEnabled)eq(await page.evaluate(()=>document.activeElement.id),returnTarget.slice(1),tag+' return restores overview focus');
        else eq(await page.evaluate(()=>location.hash),returnTarget,tag+' native return works without script');
      }
      if(key.endsWith('_synthesis')){
        for(const level of ['low','central','high']){
          await page.locator('.mr-benefit-choice').filter({hasText:new RegExp('^'+level+'$','i')}).click();
          eq(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),level,tag+' native case selection');
        }
      }
      if(javaScriptEnabled){
        // Capture the entire overview at its real top-of-page position rather
        // than centering a locator under the sticky nav. Linux WebKit cannot
        // screenshot a whole long report above 32767px; the overview evidence
        // needs the full cover, not the unrelated detailed-report pages.
        await page.evaluate(()=>scrollTo(0,0));
        const coverHeight=Math.ceil(await page.locator('.mr-cover').evaluate(node=>node.getBoundingClientRect().bottom));
        ok(coverHeight>0&&coverHeight<32767,tag+' complete overview fits the browser screenshot limit');
        await page.screenshot({path:path.join(out,tag+'-overview.png'),fullPage:true,clip:{x:0,y:0,width,height:coverHeight}});
      }
      await page.emulateMedia({media:'print'});
      await page.waitForTimeout(80);
      eq(await page.locator('.mr-report-overview:visible,.mr-section-back:visible').count(),0,tag+' no screen navigation in print');
      if(key.endsWith('_synthesis'))eq(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),'central',tag+' print always central');
      rows.push({engine,width,key,javaScriptEnabled});
      await page.close();
    }
    for(const width of [390,1440])for(const score_status of ['published','withheld']){
      const source={report_kind:'self_run_synthesis',source_mode:'own_saved_runs',synthesis_product:'depth_synthesis',score_status,cross_diagnostic_score:90,condition_band:'Strong observed condition',score_label:'Median of your selected scores',source_groups:[{tool_label:'Decision Velocity',submitted_runs:2,median_score:90}]};
      const before=JSON.stringify(source),model=context.window.MondermanReport.fromSynthesis(source),html=context.window.MondermanReport.buildReportHtml(model);
      eq(JSON.stringify(source),before,'Self-run source remains unchanged');
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
      page.on('pageerror',error=>errors.push({engine,width,key:'self-run',error:error.message}));
      await page.route('**/*',route=>{
        const font=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if(font)return route.fulfill({contentType:'font/woff2',body:read(font[1]+'font.woff2')});
        requests.push(route.request().url());return route.abort();
      });
      await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
      const qualification=score_status==='published'?'Your selected scores only':'No combined score';
      ok(!(await page.locator('body').textContent()).includes('Strong observed condition'),'Self-run page never exposes organizational band');
      ok((await page.locator('[data-report-link-role="overview-findings"] .mr-overview-label').innerText()).includes(qualification),'Visible overview follows self-run policy');
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Self-run overview has no overflow');
      await page.screenshot({path:path.join(out,`${engine}-${width}-self-run-${score_status}.png`)});
      await page.emulateMedia({media:'print'});
      eq(await page.locator('.mr-report-overview:visible').count(),0,'Self-run overview remains screen-only');
      ok(!(await page.locator('body').textContent()).includes('Strong observed condition'),'Print DOM preserves self-run policy');
      selfRunRows.push({engine,width,score_status});await page.close();
    }
  } finally {await browser.close();}
}
eq(errors,[],'No browser exceptions');eq(requests,[],'No unexpected transport');
const receipt={status:'PASS',assertions,states:rows.length,self_run_states:selfRunRows.length,renderer_sha256:sha(read('monderman-report.js')),artifact_file_sha256:sha(artifactBytes),rows,selfRunRows,errors,provider_calls:0,network_calls:0};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({...receipt,rows:rows.length,out}));
