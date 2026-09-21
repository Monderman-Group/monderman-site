import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const root = path.resolve(import.meta.dirname, '..');
const {artifact} = readPublicSampleFixture({root});
const cross = artifact.outputs.cross_lens_synthesis.source;
const depth = artifact.outputs.depth_synthesis.source;
const whole = n=>n.toLocaleString('en-US',{maximumFractionDigits:0});
const money = n=>n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const keys = ['structural_clarity','decision_velocity','operational_systems','institutional_performance','cross_lens_synthesis'];
const stepIds = ['measure','analysis','actions','return'];
const names = Object.fromEntries(cross.source_groups.map(g=>[g.tool_type,g.tool_label]));
const out = process.env.HOME_DEMO_OUT;
const baseline=process.env.HOME_DEMO_BASELINE?JSON.parse(fs.readFileSync(process.env.HOME_DEMO_BASELINE,'utf8')):null;
const compactMeasurements=[];
const assertGatherStart=async(page,label)=>{
  const app=page.locator('[data-workspace-demo]');
  assert.equal(await app.locator('[role="tab"][aria-selected="true"]').count(),1,label+': exactly one initial selected step');
  assert.equal(await app.locator('[role="tab"][aria-selected="true"]').textContent(),'01Gather',label+': fresh loads start at 01 Gather');
  assert.deepEqual(await app.locator('[role="tab"]').evaluateAll(tabs=>tabs.map(tab=>tab.tabIndex)),[0,-1,-1,-1],label+': Gather is the initial keyboard entry point');
  assert.equal(await app.locator('[role="tabpanel"]:visible').count(),1,label+': exactly one initial visible panel');
  assert.equal(await app.locator('#hwd-panel-measure').isVisible(),true,label+': Gather content is initially visible');
};
if (out) fs.mkdirSync(out,{recursive:true});
assert.doesNotMatch(fs.readFileSync(path.join(root,'homepage-workspace-demo.js'),'utf8'), /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\b/, 'The public journey must remain local-only');
let states=0, screenshots=0, resizeStates=0;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes=Object.fromEntries(['homepage-workspace-demo.js','homepage-workspace-demo.css','scripts/homepage_workspace_demo_smoke.mjs','scripts/refresh_public_sample_previews.mjs','scripts/templates/home-workspace-preview.html'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
for(const file of ['homepage-workspace-demo.js','homepage-workspace-demo.css']){
  const response=await fetch(base+'/'+file);assert.equal(response.status,200);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),hashes[file],'Browser server must serve the exact reviewed '+file);
}
for (const [name,type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await type.launch({headless:true});
  try {
    for(const width of [390,768,1440]){
      const noScript=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:false});
      await noScript.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
      await noScript.goto(base+'/index.html',{waitUntil:'load'});
      await assertGatherStart(noScript,name+'/'+width+'/no-script');
      assert.equal(await noScript.locator('.hwd-journey-choice').isVisible(),false,'Without scripts do not offer radios that cannot change the displayed journey');
      assert.equal(await noScript.locator('.hwd-choose:visible').count(),0,'No-script view must not offer inactive Choose controls');
      assert.equal(await noScript.locator('[data-demo-evaluation]:visible').count(),0,'Later-step evidence must not appear before Gather');
      await noScript.close();
    }
    for (const width of [320,390,768,1120,1121,1440]) {
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
      const failures=[], remote=[];
      // The unrelated homepage sign-in label expects its remote SDK. Stub only
      // an anonymous session so blocked external assets cannot obscure genuine
      // preview exceptions; no account or authentication service is contacted.
      await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};});
      page.on('pageerror',error=>failures.push(error.message));
      await page.route('**/*',route=>{
        if(new URL(route.request().url()).origin===new URL(base).origin)return route.continue();
        remote.push(route.request().url());return route.abort();
      });
      await page.goto(base+'/index.html',{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      const app=page.locator('[data-workspace-demo]');
      assert.equal(await app.count(),1);
      await assertGatherStart(page,name+'/'+width+'/fresh-load');
      await app.locator('#hwd-tab-measure').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await app.locator('#hwd-tab-analysis').getAttribute('aria-selected'),'true','Keyboard navigation starts from Gather');
      assert.equal(await app.locator('#hwd-panel-analysis').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-analysis');
      await page.reload({waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      await assertGatherStart(page,name+'/'+width+'/reload-after-Evaluate');
      assert.equal(await app.getAttribute('data-demo-selected-journey'),'cross_lens_synthesis');
      assert.equal(await app.locator('input[name="hwd-journey"]').count(),5);
      assert.deepEqual(await app.locator('input[name="hwd-journey"]').evaluateAll(items=>items.map(i=>i.value)),keys);
      assert.equal(await app.locator('.hwd-journey-tile small').filter({hasText:/^Depth Synthesis$/}).count(),4);
      assert.equal(await app.locator('.hwd-journey-cross strong').textContent(),'Cross-Lens Synthesis');
      assert.equal(await app.locator('.hwd-diagnostic,.hwd-diagnostic-grid').count(),0,'Passive cards must be replaced, not duplicated');
      assert.equal(await app.locator('#hwd-panel-measure .hwd-journey-choice').count(),1,'Choices belong only to Gather');
      assert.equal(await app.locator('.hwd-journey-choice').isVisible(),true,'Gather immediately offers all five journeys');
      assert.equal(await app.locator('.hwd-journey-tile:visible').count(),5);
      const initialHeight=await app.evaluate(el=>el.getBoundingClientRect().height);
      const compact={engine:name,width,height:initialHeight};
      if(baseline){
        const old=baseline.find(row=>row.engine===name&&row.width===width);
        assert.ok(old,'Missing measured original homepage height');
        compact.previousHeight=old.height;compact.reduction=old.height-initialHeight;
        assert.ok(compact.reduction>=180,name+'/'+width+': default preview must be materially smaller: '+compact.reduction);
      }
      compactMeasurements.push(compact);
      const openChoices=async()=>{
        if(await app.locator('#hwd-tab-measure').getAttribute('aria-selected')!=='true'){
          const chooser=app.locator('.hwd-choose:visible');
          assert.equal(await chooser.count(),1,'Each non-Gather view offers one clear path to choose');
          assert.equal(await chooser.textContent(),'Choose an analysis');
          assert.ok((await chooser.boundingBox()).height>=44,'Choose action must have a phone-sized target');
          await chooser.click();
          assert.equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-measure');
        }
        assert.equal(await app.locator('.hwd-journey-choice').isVisible(),true);
        assert.equal(await app.locator('#hwd-panel-measure h2').textContent(),'Choose an analysis to explore.');
      };
      await openChoices();
      const tiles=await app.locator('.hwd-journey-tile').evaluateAll(items=>items.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
      assert.ok(tiles.every(r=>r.height>=44&&r.width>=44),name+'/'+width+': selectable tile target too small');
      assert.ok(Math.abs(tiles[0].y-tiles[1].y)<=1&&Math.abs(tiles[2].y-tiles[3].y)<=1&&tiles[2].y>tiles[0].y,name+'/'+width+': four Depth tiles must form two rows');
      assert.ok(Math.abs(tiles[4].x-tiles[0].x)<=1&&Math.abs(tiles[4].x+tiles[4].width-tiles[1].x-tiles[1].width)<=1&&tiles[4].y>tiles[2].y,name+'/'+width+': Cross-Lens tile must span the full next row');
      assert.equal(await page.locator('.home-workspace-preview').getAttribute('data-artifact-sha256'),artifact.artifact_sha256);
      assert.equal(await page.locator('.home-preview-label span:last-child').textContent(),'Illustrative example');
      assert.equal(await page.locator('.home-preview-caption').textContent(),'Combine organizational evidence, evaluate a practical opportunity and track the result.');
      const distinctActions=new Set();
      const heroPositions=()=>page.evaluate(()=>Object.fromEntries(['.hero-copy','.hero h1','.hero-actions','.home-workspace-preview'].map(selector=>[selector,document.querySelector(selector).getBoundingClientRect().top+scrollY])));
      const topAnchors=()=>app.evaluate(el=>Object.fromEntries(['.hwd-topbar','.hwd-tabs'].map(selector=>[selector,el.querySelector(selector).getBoundingClientRect().top+scrollY])));
      const fixedHero=await heroPositions();
      const fixedAnchors=await topAnchors();
      if(width>1120)assert.ok(Math.abs(fixedHero['.hero-copy']-fixedHero['.home-workspace-preview'])<=1,name+'/'+width+': hero copy must align with preview top');
      for(const key of keys){
        await openChoices();
        const heldStep=await app.locator('[role="tab"][aria-selected="true"]').getAttribute('id');
        await app.locator('.hwd-journey-tile:has(input[value="'+key+'"])').click();
        assert.equal(await app.getAttribute('data-demo-selected-journey'),key);
        assert.equal(await app.locator('input[name="hwd-journey"]:checked').count(),1);
        assert.equal(await app.locator('[role="tab"][aria-selected="true"]').getAttribute('id'),heldStep,'Changing journey must preserve current step');
        assert.equal(await app.getAttribute('data-demo-journey-type'),key==='cross_lens_synthesis'?'cross':'depth');
        const group=key==='structural_clarity'?depth.source_groups[0]:cross.source_groups.find(g=>g.tool_type===key);
        const evidence=app.locator('[data-demo-evaluation="'+key+'"]');
        const scenario=key==='structural_clarity'?depth.financial_scenario:key==='cross_lens_synthesis'?cross.financial_scenario:null;
        for(const step of stepIds){
          await app.locator('#hwd-tab-'+step).click();
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const panel=app.locator('#hwd-panel-'+step);
          assert.equal(await panel.isVisible(),true);
          assert.equal(await app.locator('[role="tabpanel"]:visible').count(),1);
          assert.equal(await app.locator('[role="tab"][aria-selected="true"]').count(),1);
          assert.equal(await app.locator('[role="tab"][tabindex="0"]').count(),1);
          assert.equal(await app.locator('.hwd-journey-choice').isVisible(),step==='measure','Choices must only be visible in Gather');
          assert.equal(await app.locator('.hwd-choose:visible').count(),step==='measure'?0:1);
          if(step==='measure'){
            assert.equal(await app.locator('.hwd-journey-tile:visible').count(),5);
            if(group)assert.match(await panel.textContent(),new RegExp(group.participants+' people completed '+names[key]));
            else assert.match(await panel.textContent(),/108 runs, not 108 people/);
            for(const g of cross.source_groups){
              const choice=app.locator('[data-demo-group="'+g.tool_type+'"]');
              assert.equal(await choice.getAttribute('data-participants'),String(g.participants));
              assert.match(await choice.locator('.hwd-journey-facts').textContent(),new RegExp(g.participants+' participants'));
              assert.equal(await choice.locator('[data-demo-lens]').textContent(),whole(g.median_score)+' / 100');
            }
          }
          if(step==='analysis'){
            assert.equal(await app.locator('[data-demo-evaluation]:visible').count(),1);
            if(group){
              assert.equal(await evidence.locator('[data-demo-depth-median]').textContent(),whole(group.median_score)+' / 100');
              assert.equal(await evidence.locator('[data-demo-depth-spread]').textContent(),group.score_iqr.map(whole).join('–'));
              assert.match(await evidence.textContent(),new RegExp('Example campaign · '+group.participants+' participants'));
              const read=(key==='structural_clarity'?depth:cross).sample_reads.find(r=>r.tool_type===key);
              for(const segment of read.segments){
                const row=evidence.locator('[data-demo-perspective="'+segment.participant_mode+'"]');
                assert.equal(await row.locator('strong').textContent(),whole(segment.median_score));
                assert.equal(await row.locator('small').textContent(),whole(segment.n)+' participants');
                assert.equal(await row.locator('.hwd-track i').evaluate(el=>el.style.width),segment.median_score+'%');
              }
              assert.equal(await evidence.locator('.hwd-score-direction').textContent(),'Higher scores describe better conditions.');
              assert.match(await evidence.locator('.hwd-perspective-finding').textContent(),key==='institutional_performance'?/less dependable performance/:key==='structural_clarity'?/clearer responsibilities/:key==='decision_velocity'?/fewer decision barriers/:/less process burden/);
            }
            if(scenario){
              assert.equal(await evidence.locator('[data-demo-hours]').textContent(),whole(scenario.totals.potentialHoursFreed.central));
              assert.equal(await evidence.locator('[data-demo-capacity]').textContent(),money(scenario.totals.capacityValue.central));
              assert.equal(await evidence.locator('[data-demo-cost]').textContent(),money(scenario.totals.totalImplementationAndSubscriptionCost.central));
              const threeBenefit=scenario.version==='operational-planning-scenario-20260919.2';
              assert.match(await evidence.textContent(),threeBenefit?/Capacity is not cash savings/:/Capacity value is not cash savings/);
              if(threeBenefit){
                assert.equal(await evidence.locator('[data-demo-spending-reduction]').textContent(),money(scenario.totals.existingSpendingReduction.central));
                assert.equal(await evidence.locator('[data-demo-spending-avoidance]').textContent(),money(scenario.totals.futureSpendingAvoidance.central));
                assert.match(await evidence.textContent(),/Hours assigned to spending benefits are excluded from retained capacity/);
              }
              assert.equal(await page.locator('.home-preview-method').isVisible(),true);
              await page.locator('.home-preview-method').evaluate(el=>el.open=true);
              const assumptions=page.locator('[data-demo-assumptions-for="'+key+'"]');
              assert.equal(await assumptions.isVisible(),true);
              if(threeBenefit){
                const text=await assumptions.textContent();
                for(const level of ['low','central','high'])assert.ok(text.includes(money(scenario.totals.existingSpendingReduction[level])+' lower spending; '+money(scenario.totals.futureSpendingAvoidance[level])+' avoided future spending; '+money(scenario.totals.capacityValue[level])+' retained capacity.'),'All three saved benefits stay attached to '+level+' case');
                assert.ok(text.includes('Combined value after all costs, central case: '+money(scenario.totals.netKnownBenefitSubtotal.central)));
                assert.match(text,/not a measured bank-balance change/);
                assert.doesNotMatch(text,/no cash saving is assumed/);
              }else{
                assert.match(await assumptions.textContent(),new RegExp('The low case shows '+money(scenario.totals.netCapacityAndCashValue.low).replace(/[$]/g,'\\$')));
                assert.match(await assumptions.textContent(),/no cash saving is assumed/);
              }
              await page.locator('.home-preview-method').evaluate(el=>el.open=false);
            } else {
              assert.equal(await evidence.locator('[data-demo-financial-case]').count(),0,'No borrowed financial case on '+key);
              assert.doesNotMatch(await evidence.textContent(),/\$|potential hours released/);
              assert.equal(await page.locator('.home-preview-method').isVisible(),false);
            }
          }
          if(step==='actions'){
            assert.equal(await panel.locator('.hwd-action-steps li').count(),3);
            assert.equal(await panel.locator('.hwd-status').textContent(),'Proposed');
            const action=await panel.locator('.hwd-action-card h3').textContent();distinctActions.add(action);
            assert.ok((await panel.locator('[data-demo-copy="actionOwner"]').textContent()).length>5);
            assert.ok((await panel.locator('[data-demo-copy="actionMeasure"]').textContent()).length>30);
            assert.doesNotMatch(await panel.textContent(),/Illustrative proposal: one named decision owner|\$|achieved savings|saved \d/i);
          }
          if(step==='return'){
            assert.match(await panel.textContent(),/No later result in this sample/);
            assert.equal(await panel.locator('[data-demo-baseline-value]').textContent(),group?whole(group.median_score)+' / 100':whole(cross.submitted_run_count));
            const link=panel.locator('[data-demo-report-link]');
            assert.equal(await link.getAttribute('href'),key==='structural_clarity'?'sample-report.html#depth':key==='cross_lens_synthesis'?'sample-report.html#synthesis':'diagnostics.html#methodology-and-sources');
            if(group&&key!=='structural_clarity')assert.match(await link.textContent(),/See how Depth Synthesis works/);
          }
          const geometry=await panel.evaluate(el=>{
            const app=el.closest('[data-workspace-demo]').getBoundingClientRect();
            const bounds=el.getBoundingClientRect();
            return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,trailing:bounds.bottom-el.lastElementChild.getBoundingClientRect().bottom,escaping:[...el.querySelectorAll('*')].filter(item=>{const r=item.getBoundingClientRect();return r.width&&r.height&&(r.left<app.left-1||r.right>app.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1);}).map(item=>item.className)};
          });
          assert.ok(geometry.overflow<=1,name+'/'+width+'/'+key+'/'+step+': horizontal overflow');
          assert.deepEqual(geometry.escaping,[],name+'/'+width+'/'+key+'/'+step+': content escapes card');
          assert.ok(geometry.trailing>=0&&geometry.trailing<=32,name+'/'+width+'/'+key+'/'+step+': excessive trailing empty space: '+geometry.trailing);
          const currentAnchors=await topAnchors();
          for(const selector of Object.keys(fixedAnchors))assert.ok(Math.abs(currentAnchors[selector]-fixedAnchors[selector])<=1,name+'/'+width+'/'+key+'/'+step+': changing step moves '+selector);
          if(width>1120){
            const currentHero=await heroPositions();
            for(const selector of ['.hero h1','.hero-actions'])assert.ok(Math.abs(currentHero[selector]-fixedHero[selector])<=1,name+'/'+width+'/'+key+'/'+step+': journey changes move '+selector);
          }
          const sizes=await panel.locator('.hwd-description,.hwd-action-steps li,.hwd-action-measure p,.hwd-perspective-finding,.hwd-participation-note,.hwd-case-basis').evaluateAll(items=>items.map(el=>parseFloat(getComputedStyle(el).fontSize)));
          assert.ok(sizes.every(size=>size>=12),name+'/'+width+'/'+key+'/'+step+': substantive copy below12px');
          states++;
          if(out&&[390,768,1440].includes(width)){await page.locator('.home-workspace-preview').screenshot({path:path.join(out,name+'-'+width+'-'+key+'-'+step+'.png')});screenshots++;}
        }
        await app.locator('#hwd-tab-measure').focus();await page.keyboard.press('ArrowLeft');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-return');
        await page.keyboard.press('Home');assert.equal(await app.locator('#hwd-tab-measure').getAttribute('aria-selected'),'true');
        await page.keyboard.press('ArrowRight');assert.equal(await app.locator('#hwd-tab-analysis').getAttribute('aria-selected'),'true');
        await page.keyboard.press('End');assert.equal(await app.locator('#hwd-tab-return').getAttribute('aria-selected'),'true');
        await app.locator('#hwd-tab-measure').click();
        for(const step of ['analysis','actions','return']){
          await app.locator('[data-demo-next="'+step+'"]').click();
          assert.equal(await page.evaluate(()=>document.activeElement.id),'hwd-tab-'+step);
          const pos=await page.evaluate(()=>({top:document.activeElement.getBoundingClientRect().top,header:document.querySelector('#siteHeader')?.getBoundingClientRect().bottom||0}));
          assert.ok(pos.top>=pos.header-1,'Next-step focus must remain clear of fixed header');
        }
      }
      assert.equal(distinctActions.size,5,'All five journeys need distinct business actions');
      // Native radios wrap in Chromium but stop at the boundary in WebKit.
      // Start from an actually selected radio and verify every option plus all
      // four arrow directions without imposing one browser's boundary policy.
      await openChoices();
      await app.locator('.hwd-journey-tile:has(input[value="structural_clarity"])').click();
      await app.locator('input[value="structural_clarity"]').focus();
      const assertRadio=async(key,label)=>{
        assert.equal(await app.getAttribute('data-demo-selected-journey'),key,name+'/'+width+'/'+label+': displayed journey');
        assert.equal(await app.locator('input[name="hwd-journey"]:checked').inputValue(),key,name+'/'+width+'/'+label+': checked radio');
        assert.equal(await page.evaluate(()=>document.activeElement.value),key,name+'/'+width+'/'+label+': focused radio');
      };
      for(const key of keys.slice(1)){await page.keyboard.press('ArrowRight');await assertRadio(key,'forward');}
      for(const key of keys.slice(0,-1).reverse()){await page.keyboard.press('ArrowLeft');await assertRadio(key,'backward');}
      await page.keyboard.press('ArrowDown');await assertRadio('decision_velocity','down');
      await page.keyboard.press('ArrowUp');await assertRadio('structural_clarity','up');
      const cta=await page.locator('.hero-actions .btn-accent').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
      assert.equal(cta.bg,'rgb(169, 208, 212)');assert.equal(cta.color,'rgb(4, 24, 27)');
      assert.equal(await page.locator('.hero .hero-report-proof').count(),0);
      assert.equal(await page.locator('#sample-output .hero-report-link').getAttribute('href'),'sample-report.html#depth');
      if(width===1440){
        await app.locator('.hwd-journey-tile:has(input[value="structural_clarity"])').click();
        for(const resizedWidth of [390,768,1440]){
          await page.setViewportSize({width:resizedWidth,height:1000});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const resizedAnchors=await topAnchors();
          for(const step of stepIds){
            await app.locator('#hwd-tab-'+step).click();
            const panel=app.locator('#hwd-panel-'+step);
            const trailing=await panel.evaluate(el=>el.getBoundingClientRect().bottom-el.lastElementChild.getBoundingClientRect().bottom);
            assert.ok(trailing>=0&&trailing<=32,name+'/'+resizedWidth+'/'+step+': resized panel has excessive trailing empty space');
            const currentAnchors=await topAnchors();
            for(const selector of Object.keys(resizedAnchors))assert.ok(Math.abs(currentAnchors[selector]-resizedAnchors[selector])<=1,name+'/'+resizedWidth+'/'+step+': resized top anchor moves');
            assert.equal(await app.getAttribute('data-demo-selected-journey'),'structural_clarity');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth<=1),name+'/'+resizedWidth+': resize overflow');
            resizeStates++;
          }
        }
        await page.setViewportSize({width:1541,height:830});
        for(const key of keys){
          await openChoices();
          await app.locator('.hwd-journey-tile:has(input[value="'+key+'"])').click();
          await page.evaluate(()=>window.scrollTo(0,0));
          const cta=await page.locator('.hero-actions .btn-accent').boundingBox();
          assert.ok(cta.y>=0&&cta.y+cta.height<=830,name+'/'+key+': invitation CTA must remain visible at1541×830');
        }
      }
      assert.deepEqual(failures,[],name+'/'+width+': page exception');
      assert.ok(remote.every(url=>new URL(url).origin!==new URL(base).origin),'All external requests must be aborted');
      await page.close();
      console.log('HOMEPAGE_WORKSPACE_DEMO_PROGRESS '+name+'/'+width+' states='+states);
    }
  } finally {await browser.close();}
}
const receipt={status:'PASS',checkedAt:new Date().toISOString(),base,states,resizeStates,screenshots,journeys:5,steps:4,widths:6,browsers:2,artifactSha256:artifact.artifact_sha256,hashes,compactMeasurements,checks:'01 Gather on fresh load and reload, Gather without scripts on phone/tablet/desktop, Gather-only selection without duplicate cards, discoverable change control, source medians/spreads/perspectives, distinct actions, no borrowed money, current-step persistence, native radio + tab keyboard, stable layout including live resize, no external calls'};
if(process.env.HOME_DEMO_RECEIPT)fs.writeFileSync(process.env.HOME_DEMO_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
console.log('HOMEPAGE_WORKSPACE_DEMO_PASS '+JSON.stringify(receipt));
