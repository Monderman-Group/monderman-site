import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:8080';
const out = process.env.TILE_OUT || '/tmp/sample-tile-smoke';
fs.mkdirSync(out, { recursive: true });
const {artifact}=readPublicSampleFixture();
const root=path.resolve(import.meta.dirname,'..');
const generatedHomepage=buildPublicSamplePreviewSections(artifact,fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8')).home;
const source=artifact.outputs.depth_synthesis.source,scenario=source.financial_scenario;
const interpretation=source.ai_report.report.interpretation;
const limitedOptions=(interpretation.action_options||[]).filter(option=>option.intensity==='limited'&&option.action?.trim());
assert.equal(limitedOptions.length,1,'The tile requires one accepted limited-change option, never an unrelated first task');
assert.equal(scenario.version,'operational-planning-scenario-20260919.2');
assert.equal(scenario.method.usesDiagnosticScores,false);
assert.equal(scenario.method.isConfidenceInterval,false);
const money=value=>value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const caseMoney=value=>Math.abs(value)>0&&Math.abs(value)<1?value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumSignificantDigits:3}):money(value);
const roundedMoney=value=>Math.abs(value)>=10000?money(Math.round(value/1000)*1000):caseMoney(value);
const benefits=scenario.benefits;
const statusLabel=benefit=>({estimated:'Estimate entered',none_identified:'Reviewed: none identified',not_estimated:'Not estimated'})[benefit.status];
const exceptionalStatus=benefit=>benefit.status==='estimated'?'':' '+statusLabel(benefit)+'.';

const browser = await chromium.launch({ headless: true });
const placements = [
  { name: 'homepage', route: '/index.html' },
  { name: 'platform-brief', route: '/Monderman_Platform_Brief.html' },
];
const viewports = [
  { name: 'narrow-mobile', width: 320, height: 844 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 900 },
  { name: 'collapse-seam', width: 1120, height: 900 },
  { name: 'desktop-seam', width: 1121, height: 900 },
  { name: 'desktop-short', width: 1440, height: 835 },
  { name: 'desktop', width: 1440, height: 1000 },
];

try {
  for (const placement of placements) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await page.goto(`${base}${placement.route}`, { waitUntil: 'networkidle', timeout: 90000 });

      const tile = page.locator('.hero-report-proof.has-sample-depth-tile');
      await tile.waitFor({ state: 'attached', timeout: 10000 });
      if (await tile.isVisible()) {
        await tile.scrollIntoViewIfNeeded();
        await page.waitForFunction(el => {
          for (let node=el;node;node=node.parentElement) {
            const style=getComputedStyle(node);
            if (Number(style.opacity)<.99 || style.visibility==='hidden') return false;
          }
          return true;
        }, await tile.elementHandle());
      }
      if (placement.name === 'homepage') {
        const label=`${placement.name}/${viewport.name}`;
        assert.equal(await tile.isVisible(),true,label+': lower report preview must remain visible');
        assert.equal(await tile.getAttribute('data-artifact-sha256'),artifact.artifact_sha256,label+': current source identity');
        assert.equal(await tile.getAttribute('data-home-report-quad'),'',label+': current homepage presentation');
        assert.deepEqual(await tile.locator('.hrq-tile').evaluateAll(nodes=>nodes.map(node=>node.dataset.quadSection)),['findings','money','change','evidence'],label+': four report roles');
        assert.deepEqual(await tile.locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))),Array(4).fill('sample-report.html#depth'),label+': every report link resolves to the Depth tab');
        assert.equal(await tile.locator('[data-promo-score]').textContent(),String(source.source_groups[0].median_score),label+': recorded score');
        assert.equal(await tile.locator('[data-quad-section="change"] .hrq-lead').textContent(),limitedOptions[0].action,label+': accepted bounded change');
        assert.equal(await tile.locator('.hrq-chart-note').textContent(),'Rounded. Before costs. Planning estimates.',label+': graphic qualification');
        assert.deepEqual(await tile.locator('.mr-overview-sankey').evaluateAll(nodes=>nodes.map(node=>node.dataset.previewKind)),['money','time'],label+': separate money and time diagrams');
        assert.equal(await page.evaluate(expected=>{
          const parsed=new DOMParser().parseFromString(expected,'text/html');
          return document.querySelector('[data-home-report-quad] .mr-overview-sankeys').outerHTML===parsed.querySelector('.mr-overview-sankeys').outerHTML;
        },generatedHomepage),true,label+': exact source-rendered charts');
        const geometry=await tile.evaluate(el=>{
          const box=el.getBoundingClientRect(),band=el.closest('#sample-output'),grid=el.querySelector('.hrq-grid');
          const textNodes=[...el.querySelectorAll('h3,p,li,a,.mr-overview-sankey-source,.mr-overview-sankey-outcome')];
          const escaping=textNodes.filter(node=>{const r=node.getBoundingClientRect();return r.width&&r.height&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1);}).map(node=>node.className||node.tagName);
          return {width:box.width,height:box.height,left:box.left,right:box.right,bottom:box.bottom,bandBottom:band?.getBoundingClientRect().bottom,inOutputBand:Boolean(band),inHero:Boolean(el.closest('.hero')),columns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,documentWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),viewportWidth:document.documentElement.clientWidth,escaping};
        });
        assert.equal(geometry.inOutputBand,true,label+': dedicated output section');
        assert.equal(geometry.inHero,false,label+': report stays outside the opening hero');
        assert.equal(geometry.columns,viewport.width<=600?1:2,label+': responsive report grid');
        assert(geometry.width>0&&geometry.width<=760.5,label+': approved report width');
        assert(geometry.left>=-1&&geometry.right<=geometry.viewportWidth+1,label+': report stays within viewport');
        assert(geometry.scrollWidth<=geometry.clientWidth+1&&geometry.documentWidth<=geometry.viewportWidth+1,label+': no horizontal overflow');
        assert(geometry.bottom<=geometry.bandBottom+1,label+': report stays within output section');
        assert.deepEqual(geometry.escaping,[],label+': all report summaries and chart labels stay within the frame');
        if(viewport.width===1440){assert(geometry.width>580,label+': wide preview does not inherit the retired card width');assert(geometry.height<=680,label+': approved compact two-column height');}
        await tile.screenshot({path:path.join(out,`${placement.name}-${viewport.name}.png`)});
        await page.close();
        continue;
      }
      // The Platform Brief retains its original single linked sample card.
      assert.equal(await tile.locator('.hero-report-link').getAttribute('href'), 'sample-report.html#depth', `${placement.name}/${viewport.name}: whole-card sample route changed`);
      assert.equal(await tile.getAttribute('data-artifact-sha256'),artifact.artifact_sha256);

      const geometry = await tile.evaluate((el) => {
        const root = el.querySelector('#monderman-depth-lure-composite');
        const card = el.querySelector('.md-tile');
        const panels = [...el.querySelectorAll('.md-opportunity,.md-economics,.md-score-summary,.md-action,.md-basis')];
        const foot = el.querySelector('.md-basis');
        const slide = el.closest('.slide');
        const hero = el.closest('.hero');
        const outputBand = el.closest('#sample-output');
        const heroRouteField = hero?.querySelector('.hero-route-field');
        const tileBox = el.getBoundingClientRect();
        const rootBox = root.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const slideBox = slide?.getBoundingClientRect();
        const heroBox = hero?.getBoundingClientRect();
        const tileStyle = getComputedStyle(el);
        const link = el.querySelector('.hero-report-link');
        const linkStyle = getComputedStyle(link);
        return {
          display: getComputedStyle(el).display,
          visibility: tileStyle.visibility,
          opacity: Number(tileStyle.opacity),
          linkDisplay: linkStyle.display,
          linkVisibility: linkStyle.visibility,
          linkOpacity: Number(linkStyle.opacity),
          linkPointerEvents: linkStyle.pointerEvents,
          left: tileBox.left,
          right: tileBox.right,
          width: tileBox.width,
          height: tileBox.height,
          cardWidth: cardBox.width,
          cardHeight: cardBox.height,
          cardLeft: cardBox.left,
          cardRight: cardBox.right,
          cardTop: cardBox.top,
          cardDocumentTop: cardBox.top + window.scrollY,
          cardBottom: cardBox.bottom,
          tileBottom: tileBox.bottom,
          heroTop: heroBox?.top ?? null,
          heroBottom: heroBox?.bottom ?? null,
          heroHeight: heroBox?.height ?? null,
          inOutputBand: !!outputBand,
          outputBottom: outputBand?.getBoundingClientRect().bottom ?? null,
          hasHeroRouteField: !!heroRouteField,
          rootLeft: rootBox.left,
          rootRight: rootBox.right,
          footDisplay: getComputedStyle(foot).display,
          slideHeight: slideBox?.height ?? null,
          slideBottom: slideBox?.bottom ?? null,
          slideScrollHeight: slide?.scrollHeight ?? null,
          slideClientHeight: slide?.clientHeight ?? null,
          panelBoxes: panels.map((panel) => {
            const box = panel.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
          }),
          hasWrongRaster: !!el.querySelector('.sample-depth-tile-approved-image'),
          capacity: el.querySelector('[data-promo-capacity]')?.textContent,
          spendingReduction: el.querySelector('[data-promo-spending-reduction]')?.textContent,
          spendingAvoidance: el.querySelector('[data-promo-spending-avoidance]')?.textContent,
          netCash: el.querySelector('[data-promo-net-cash]')?.textContent,
          totalCost: el.querySelector('[data-promo-total-cost]')?.textContent,
          obsoleteFinancialFields: el.querySelectorAll('[data-promo-recovery],[data-promo-cost],[data-promo-hours]').length,
          actionText: el.querySelector('.md-action p')?.textContent,
          qualification: el.querySelector('.md-opportunity p')?.textContent,
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: document.documentElement.clientHeight,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        };
      });

      const intentionallyHidden = placement.name === 'homepage'
        ? viewport.width <= 1120
        : viewport.width <= 640;
      if (intentionallyHidden) {
        assert.equal(geometry.display, 'none', `${placement.name}/${viewport.name}: compact layout still shows the large sample tile`);
        assert.equal(geometry.height, 0, `${placement.name}/${viewport.name}: hidden sample tile still reserves vertical space`);
        await page.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`), fullPage: false });
        await page.close();
        continue;
      }

      assert.equal(geometry.display, 'block', `${placement.name}/${viewport.name}: sample tile is hidden`);
      assert.equal(geometry.linkDisplay, 'block', `${placement.name}/${viewport.name}: sample tile link is hidden`);
      assert(geometry.width > 260 && geometry.width <= 580.5, `${placement.name}/${viewport.name}: tile width is outside the approved seat: ${geometry.width}`);
      assert.equal(geometry.hasWrongRaster, false, `${placement.name}/${viewport.name}: superseded screenshot artifact returned`);
      assert.equal(geometry.capacity,'About '+roundedMoney(benefits.staffCapacity.amount.central));
      assert.equal(await tile.locator('.md-scenario-cases[data-three-benefit-cases]').count(),1,'Current tile must identify the three-benefit planning cases');
      assert.deepEqual(await tile.locator('.md-scenario-cases dt').allTextContents(),['Low','Central','High']);
      assert.deepEqual(await tile.locator('.md-scenario-cases dd').allTextContents(),['low','central','high'].map(k=>roundedMoney(benefits.staffCapacity.amount[k])));
      assert.equal(geometry.spendingReduction,caseMoney(benefits.spendingReduction.amount.central));
      assert.equal(geometry.spendingAvoidance,caseMoney(benefits.spendingAvoidance.amount.central));
      assert.equal(geometry.netCash,caseMoney(scenario.totals.netCashEffect.central));
      assert.equal(geometry.totalCost,money(scenario.totals.totalImplementationAndSubscriptionCost.central));
      assert.deepEqual(await tile.locator('.md-economics span').allTextContents(),[
        'Current spending reduced · central case'+exceptionalStatus(benefits.spendingReduction),
        'Future spending avoided · central case'+exceptionalStatus(benefits.spendingAvoidance),
        'Net spending benefit after cash costs · central case',
        'Total cost, including staff time · central case'
      ],'All three benefit categories and central-case financial meanings must remain explicit');
      assert.equal(geometry.obsoleteFinancialFields,0,'Score-derived recovery must remain absent');
      assert.equal(geometry.actionText,limitedOptions[0].action);
      assert.equal(geometry.qualification,'Staff capacity value, not cash savings.'+exceptionalStatus(benefits.staffCapacity));
      assert.deepEqual(await tile.locator('.md-opportunity>p').allTextContents(),[
        'Staff capacity value, not cash savings.'+exceptionalStatus(benefits.staffCapacity),
        'Each case uses different assumptions. Exact values are in the report.'
      ],`${placement.name}/${viewport.name}: capacity and named-case qualifications must remain visible`);
      assert.equal(await tile.locator('.md-basis').textContent(),'Illustrative planning assumptions. Capacity excludes hours counted as spending benefits. Full inputs and costs in the report.','Financial boundaries and the capacity double-counting qualification must remain complete');
      assert.notEqual(geometry.footDisplay, 'none', `${placement.name}/${viewport.name}: sample and aggregation qualification hidden`);
      assert(geometry.documentWidth <= geometry.viewportWidth + 1, `${placement.name}/${viewport.name}: page overflows horizontally`);
      assert(geometry.rootLeft >= geometry.cardLeft - 1 && geometry.rootRight <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: source component escapes the card horizontally`);
      for (const [index, panel] of geometry.panelBoxes.entries()) {
        assert(panel.left >= geometry.cardLeft - 1 && panel.right <= geometry.cardRight + 1, `${placement.name}/${viewport.name}: panel ${index + 1} escapes the card horizontally (${JSON.stringify({ panel, card: { left: geometry.cardLeft, right: geometry.cardRight } })})`);
        assert(panel.top >= geometry.cardTop - 1 && panel.bottom <= geometry.cardBottom + 1, `${placement.name}/${viewport.name}: panel ${index + 1} is clipped vertically (${JSON.stringify({ panel, card: { top: geometry.cardTop, bottom: geometry.cardBottom } })})`);
      }
      if (viewport.name === 'desktop-short') {
        assert(geometry.cardHeight <= 620, `${placement.name}/${viewport.name}: compact report card is too tall (${geometry.cardHeight}px)`);
        if (placement.name === 'homepage') {
          assert.equal(geometry.heroHeight, null, `${placement.name}/${viewport.name}: report unexpectedly returned to the product hero`);
          assert.equal(geometry.inOutputBand, true, `${placement.name}/${viewport.name}: report lost its dedicated output section`);
          assert(geometry.cardDocumentTop > geometry.viewportHeight * 0.5, `${placement.name}/${viewport.name}: report is competing with the opening product preview`);
          assert(geometry.tileBottom <= geometry.outputBottom + 1, `${placement.name}/${viewport.name}: report escapes its output section`);
        } else {
          assert(geometry.slideHeight <= geometry.viewportHeight + 2, `${placement.name}/${viewport.name}: report tile expands the snap slide (${geometry.slideHeight}px > ${geometry.viewportHeight}px)`);
          assert(geometry.slideScrollHeight <= geometry.slideClientHeight + 1, `${placement.name}/${viewport.name}: report tile creates internal slide overflow`);
          assert(geometry.tileBottom <= geometry.slideBottom + 1, `${placement.name}/${viewport.name}: report tile escapes its snap slide`);
        }
      }

      await tile.screenshot({ path: path.join(out, `${placement.name}-${viewport.name}.png`) });
      await page.close();
    }
  }
  console.log('sample report tile smoke: passed');
} finally {
  await browser.close();
}
