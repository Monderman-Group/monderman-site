// Authored for a separately authorized browser run; this script is not an
// offline contract check. Set SITE_BASE to a server serving this checkout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE||'http://127.0.0.1:4175';
const out=process.env.HOMEPAGE_DISCOVERY_OUT||fs.mkdtempSync('/tmp/homepage-discovery-');
fs.mkdirSync(out,{recursive:true});
let states=0;
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [390,768,1440])for(const javaScriptEnabled of [false,true]){
      const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled});
      // The public-page auth decoration is outside this navigation test.
      // Match the established homepage test's signed-out, memory-only fixture.
      await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})};});
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
      const failures=[];page.on('pageerror',error=>failures.push(error.message));
      await page.goto(base+'/index.html',{waitUntil:'load'});
      const hero=page.locator('.hero-sample-link');
      const direct=page.locator('.hwd-footer .hwd-sample-link');
      for(const link of [hero,direct]){
        assert.equal(await link.isVisible(),true,name+'/'+width+': sample link is visible on first load');
        assert.equal(await link.getAttribute('href'),link===direct?'sample-report.html#synthesis':'sample-report.html');
        assert.match(await link.innerText(),link===direct?/^Open sample report/:/^View sample reports/);
        const box=await link.boundingBox();assert.ok(box.height>=44,'Sample link has a usable touch target');
      }
      assert.equal(await hero.evaluate(el=>el.previousElementSibling?.classList.contains('hero-actions')),true,'Hero sample access immediately follows the invitation buttons');
      assert.equal(await direct.evaluate(el=>el.closest('[role="tabpanel"]')===null),true,'Preview sample access is independent of the active step');
      if(javaScriptEnabled){
        for(const step of ['measure','analysis','actions','return']){
          await page.locator('#hwd-tab-'+step).click();
          assert.equal(await direct.isVisible(),true,'Direct sample access is visible in '+step);
        }
      }
      const primary=await page.locator('.hero-actions .btn-accent').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
      assert.deepEqual(primary,{background:'rgb(169, 208, 212)',color:'rgb(4, 24, 27)'});
      const secondary=await page.locator('.hero-actions .btn-secondary').evaluate(el=>getComputedStyle(el).borderTopColor);
      assert.equal(secondary,'rgb(230, 199, 101)');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No horizontal overflow');
      // Establish keyboard modality after the journey mouse clicks. Native
      // :focus-visible intentionally does not show a ring in mouse modality.
      await page.keyboard.press('Tab');await direct.focus();
      assert.equal(await direct.evaluate(el=>getComputedStyle(el).outlineStyle),'solid','Preview link has a keyboard focus ring');
      if(javaScriptEnabled)await page.screenshot({path:path.join(out,name+'-'+width+'-homepage.png'),fullPage:true});
      await page.keyboard.press('Enter');
      await page.waitForURL(url=>url.pathname.endsWith('/sample-report.html'));
      assert.deepEqual(failures,[]);
      await page.close();states++;
    }
  }finally{await browser.close();}
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=Object.fromEntries(['index.html','homepage-workspace-demo.css','scripts/templates/home-workspace-preview.html'].map(file=>[file,sha(fs.readFileSync(new URL('../'+file,import.meta.url)))]));
const receipt={passed:true,states,browsers:2,widths:[390,768,1440],withAndWithoutJavaScript:true,source_files:sourceFiles};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('HOMEPAGE_SAMPLE_DISCOVERY_SMOKE '+JSON.stringify({...receipt,out}));
