import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';

// The exact reviewed copy delta retired the four measurement-loop cards, not
// the three proof cards or four diagnostic cards exercised below. Preserve the
// historical bytes and independently check the current section's complete DOM.
const homepageSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const historicalHomepage = sourceBeforePublicCopyClarity('index.html', homepageSource);
const classElements = (html, name) => [...html.matchAll(/<[a-z][^>]*\bclass="([^"]*)"[^>]*>/gi)]
  .filter(match => match[1].split(/\s+/).includes(name)).length;
assert.equal(classElements(historicalHomepage, 'loop-flow'), 1);
assert.equal(classElements(historicalHomepage, 'loop-step'), 4);
const measurementSection = homepageSource.match(/<section class="measurement-loop" aria-labelledby="measurement-loop-title">[\s\S]*?<\/section>/)?.[0];
assert.ok(measurementSection, 'The current labelled measurement section remains');
function assertCurrentMeasurementMarkup(html) {
  assert.equal(classElements(html, 'loop-flow'), 0, 'The retired flow is not current DOM');
  assert.equal(classElements(html, 'loop-step'), 0, 'The retired cards are not current DOM');
  assert.match(html, /<h2 id="measurement-loop-title">Compare results on the same basis\.<\/h2>/);
  assert.match(html, /<a href="Monderman_Platform_Brief\.html#slide-6">See how Synthesis works &rarr;<\/a>/);
}
assertCurrentMeasurementMarkup(measurementSection);
assert.equal(classElements(homepageSource, 'proof-card'), 3);
assert.equal(classElements(homepageSource, 'approach-card'), 4);
const invalidMeasurements = [
  measurementSection.replace('</section>', '<div class="loop-flow"></div></section>'),
  measurementSection.replace('</section>', '<article class="loop-step"></article></section>'),
  measurementSection.replace('Compare results on the same basis.', 'Missing reviewed heading'),
  measurementSection.replace('Monderman_Platform_Brief.html#slide-6', 'missing.html'),
];
for (const invalid of invalidMeasurements) {
  assert.notEqual(invalid, measurementSection);
  assert.throws(() => assertCurrentMeasurementMarkup(invalid));
}
assert.throws(() => sourceBeforePublicCopyClarity('index.html', homepageSource.replace(measurementSection, invalidMeasurements[0])),
  'The historical inverse must not accept an unrelated or restored current section');
if (process.argv.includes('--deterministic-only')) {
  console.log(JSON.stringify({status:'PASS',historicalLoopCards:4,currentLoopCards:0,proofCards:3,diagnosticCards:4,negativeCases:5,browserCoverage:'NOT_RUN'}));
  process.exit(0);
}

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const browsers = [['chromium', chromium], ['webkit', webkit]]
  .filter(([name]) => !process.env.CARD_RHYTHM_BROWSER || process.env.CARD_RHYTHM_BROWSER === name);
const viewports = [390, 640, 641, 760, 761, 768, 1024, 1120, 1121, 1180, 1181, 1440];

const closeTo = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance;
async function waitForCarouselReady(page, label, pageErrors, failedScripts) {
  try {
    // Phone startup CSS intentionally exposes only the first card. Its visibility
    // is not evidence that the inline carousel bootstrap completed successfully.
    await page.waitForFunction(() => {
      if (!document.querySelector('#latestViewport')?.classList.contains('is-ready') ||
        document.querySelectorAll('#latestTrack>.is-carousel-clone').length !== 32 ||
        document.querySelectorAll('#latestDots>button').length !== 16 ||
        document.fonts.status !== 'loaded') return false;
      // WebKit can expose the ready DOM before applying the phone visibility
      // rule to every card. Poll rendered state; do not exempt offscreen items.
      const headings=[...document.querySelectorAll('#latestTrack>.latest-card:not(.is-carousel-clone) .placeholder-cover-title')];
      return headings.length===16 && headings.every(node=>{
        const box=node.getBoundingClientRect();
        if(!box.width||!box.height) return false;
        for(let ancestor=node;ancestor;ancestor=ancestor.parentElement) {
          const style=getComputedStyle(ancestor);
          if(ancestor.getAttribute('aria-hidden')==='true'||ancestor.hasAttribute('inert')||style.display==='none'||style.visibility==='hidden') return false;
        }
        return true;
      });
    }, null, {timeout:10000});
  } catch (error) {
    const state=await page.evaluate(() => ({
      readyState:document.readyState,
      viewportClass:document.querySelector('#latestViewport')?.className,
      originals:document.querySelectorAll('#latestTrack>.latest-card:not(.is-carousel-clone)').length,
      clones:document.querySelectorAll('#latestTrack>.is-carousel-clone').length,
      dots:document.querySelectorAll('#latestDots>button').length,
      transform:document.querySelector('#latestTrack')?.style.transform,
      fonts:document.fonts.status,
      titleVisibility:[...document.querySelectorAll('#latestTrack>.latest-card:not(.is-carousel-clone) .placeholder-cover-title')].map(node=>{
        const box=node.getBoundingClientRect();
        const ancestors=[];
        for(let ancestor=node;ancestor;ancestor=ancestor.parentElement) {
          const style=getComputedStyle(ancestor);
          if(style.visibility!=='visible'||style.display==='none'||ancestor.hasAttribute('inert')||ancestor.getAttribute('aria-hidden')==='true') ancestors.push({tag:ancestor.tagName,class:ancestor.className,visibility:style.visibility,display:style.display,inert:ancestor.inert,ariaHidden:ancestor.getAttribute('aria-hidden')});
        }
        return {title:node.textContent,width:box.width,height:box.height,ancestors};
      })
    }));
    throw new Error(`${label}: carousel bootstrap did not become ready: ${JSON.stringify({state,pageErrors,failedScripts})}`,{cause:error});
  }
}
// Covers and print fallbacks must expose the title exactly once in each medium.
const readCarouselTitles = () => {
  const isExposed = node => {
    for (let ancestor=node; ancestor; ancestor=ancestor.parentElement) {
      const style=getComputedStyle(ancestor);
      if (ancestor.getAttribute('aria-hidden')==='true'||ancestor.hasAttribute('inert')||style.display==='none'||style.visibility==='hidden') return false;
    }
    return true;
  };
  return [...document.querySelectorAll('#latestTrack>.latest-card:not(.is-carousel-clone)')].map(card=>({
    title:card.querySelector('.latest-card-title--print')?.textContent.trim(),
    headings:[...card.querySelectorAll('h3')].filter(isExposed).map(node=>node.className),
    linkNames:[...card.querySelectorAll('a')].map(node=>node.getAttribute('aria-label'))
  }));
};

for (const [browserName, browserType] of browsers) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const width of viewports) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const pageErrors=[];
      const failedScripts=[];
      page.on('pageerror',error=>pageErrors.push(error.message));
      page.on('requestfailed',request=>{
        if(request.resourceType()==='script') failedScripts.push({url:request.url(),failure:request.failure()?.errorText});
      });
      await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => document.fonts?.ready);
      await waitForCarouselReady(page,`${browserName}/${width}`,pageErrors,failedScripts);

      const carouselTitles=await page.evaluate(readCarouselTitles);
      assert.equal(carouselTitles.length,16,`${browserName}/${width}: original carousel items were lost or cloned into the title audit`);
      for (const card of carouselTitles) {
        assert.equal(card.headings.length,1,`${browserName}/${width}/${card.title}: duplicate or missing accessible title on screen; runtime=${JSON.stringify({pageErrors,failedScripts})}`);
        assert.ok(card.headings[0].includes('placeholder-cover-title'),`${browserName}/${width}/${card.title}: cover is not the visible title`);
        assert.ok(card.linkNames.every(name=>name?.includes(card.title)),`${browserName}/${width}/${card.title}: link names do not identify their article`);
      }
      const clones=page.locator('#latestTrack>.is-carousel-clone');
      assert.equal(await clones.count(),32,`${browserName}/${width}: carousel clone setup is incomplete`);
      assert.ok(await clones.evaluateAll(cards=>cards.every(card=>card.inert&&card.getAttribute('aria-hidden')==='true')),`${browserName}/${width}: repeated carousel items entered the accessibility tree`);

      const result = await page.evaluate(expectedMeasurement => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        const px = (value) => Number.parseFloat(value);
        const proofGrid = document.querySelector('.proof-grid');
        const proof = [...document.querySelectorAll('.proof-card')].map((card) => {
          const cardBox = rect(card);
          const icon = card.querySelector('.proof-card-icon');
          const title = card.querySelector(':scope > strong');
          const body = card.querySelector('.proof-card-text');
          const cta = card.querySelector('.proof-arrow');
          const iconBox = rect(icon);
          const titleBox = rect(title);
          const bodyBox = rect(body);
          const ctaBox = rect(cta);
          const style = getComputedStyle(card);
          return {
            display: style.display,
            height: cardBox.height,
            padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px),
            iconLeft: iconBox.left - cardBox.left,
            contentLeft: titleBox.left - cardBox.left,
            contentRight: cardBox.right - bodyBox.right,
            titleSize: px(getComputedStyle(title).fontSize),
            bodySize: px(getComputedStyle(body).fontSize),
            ctaSize: px(getComputedStyle(cta).fontSize),
            bodyBottom: bodyBox.bottom,
            ctaTop: ctaBox.top,
            ctaBottom: ctaBox.bottom,
            cardBottom: cardBox.bottom,
          };
        });
        const approach = [...document.querySelectorAll('.approach-card')].map((card) => {
          const cardBox = rect(card);
          const headBox = rect(card.querySelector('.approach-card-head'));
          const marker = getComputedStyle(card, '::before');
          return {
            markerContent: marker.content,
            markerPosition: marker.position,
            markerWidth: px(marker.width),
            markerBackground: marker.backgroundColor,
            cardLeft: cardBox.left,
            cardTop: cardBox.top,
            headLeft: headBox.left - cardBox.left,
            headTop: headBox.top - cardBox.top,
          };
        });
        const expected = document.createElement('template');
        expected.innerHTML = expectedMeasurement;
        const normalized = element => element?.outerHTML.replace(/\s+/g, ' ').trim();
        return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          proofColumns: getComputedStyle(proofGrid).gridTemplateColumns.split(' ').length,
          approachColumns: getComputedStyle(document.querySelector('.approach-grid')).gridTemplateColumns.split(' ').length,
          retiredLoopElements: document.querySelectorAll('.loop-flow, .loop-step').length,
          measurementSections: document.querySelectorAll('.measurement-loop').length,
          exactMeasurementMarkup: normalized(document.querySelector('.measurement-loop')) === normalized(expected.content.firstElementChild),
          proof,
          approach,
        };
      }, measurementSection);

      const label = `${browserName}/${width}`;
      assert.ok(result.overflow <= 1, `${label}: homepage overflows by ${result.overflow}px`);
      assert.equal(result.proof.length, 3, `${label}: expected three proof cards`);
      assert.equal(result.approach.length, 4, `${label}: expected four diagnostic cards`);
      assert.equal(result.retiredLoopElements, 0, `${label}: retired measurement-loop cards returned`);
      assert.equal(result.measurementSections, 1, `${label}: expected one current measurement section`);
      assert.equal(result.exactMeasurementMarkup, true, `${label}: current measurement copy, scope or Synthesis link changed`);

      for (const [index, card] of result.approach.entries()) {
        assert.equal(card.markerPosition, 'static', `${label}/diagnostic-${index + 1}: marker is corner-positioned`);
        assert.ok(card.markerWidth > 100, `${label}/diagnostic-${index + 1}: marker retained the old zero-width bar`);
        assert.equal(card.markerBackground, 'rgba(0, 0, 0, 0)', `${label}/diagnostic-${index + 1}: marker retained accent-bar fill`);
        assert.equal(card.markerContent, `"0${index + 1}"`, `${label}/diagnostic-${index + 1}: wrong marker`);
        assert.ok(card.headLeft >= 24, `${label}/diagnostic-${index + 1}: content is too close to the left edge`);
        assert.ok(card.headTop >= 56, `${label}/diagnostic-${index + 1}: marker/head rhythm collapsed`);
      }

      const expectedApproachColumns = width <= 640 ? 1 : width <= 1120 ? 2 : 4;
      assert.equal(result.approachColumns, expectedApproachColumns,
        `${label}: diagnostic card grid changed at a responsive seam`);

      await page.locator('.approach-card').first().hover();
      const hoveredMarker = await page.locator('.approach-card').first().evaluate((card) => {
        const marker = getComputedStyle(card, '::before');
        return {
          position: marker.position,
          width: Number.parseFloat(marker.width),
          background: marker.backgroundColor,
        };
      });
      assert.equal(hoveredMarker.position, 'static', `${label}: hover corner-positioned the diagnostic marker`);
      assert.ok(hoveredMarker.width > 100, `${label}: hover collapsed the diagnostic marker width`);
      assert.equal(hoveredMarker.background, 'rgba(0, 0, 0, 0)', `${label}: hover restored the old accent bar`);

      if (width >= 1181) {
        assert.equal(result.proofColumns, 3, `${label}: desktop proof cards should be three columns`);
        for (const [index, card] of result.proof.entries()) {
          assert.ok(closeTo(card.iconLeft, 28), `${label}/proof-${index + 1}: left inset is ${card.iconLeft}px`);
          assert.ok(card.contentRight >= 28, `${label}/proof-${index + 1}: right inset is ${card.contentRight}px`);
          assert.ok(card.titleSize >= 18 && card.bodySize >= 15 && card.ctaSize >= 14,
            `${label}/proof-${index + 1}: inherited UI-scale type remains`);
        }
        const ctaBaselines = result.proof.map((card) => card.ctaBottom);
        assert.ok(Math.max(...ctaBaselines) - Math.min(...ctaBaselines) <= 1,
          `${label}: desktop proof CTAs do not share a baseline`);
      } else {
        assert.equal(result.proofColumns, 1, `${label}: proof cards should use the full rail`);
        for (const [index, card] of result.proof.entries()) {
          assert.ok(card.iconLeft >= 20, `${label}/proof-${index + 1}: icon is too close to the edge`);
          assert.ok(card.contentRight >= 20, `${label}/proof-${index + 1}: copy is too close to the edge`);
          if (width >= 761) {
            assert.ok(card.height <= 160, `${label}/proof-${index + 1}: resource row is too tall (${card.height}px)`);
            assert.ok(card.ctaTop < card.bodyBottom, `${label}/proof-${index + 1}: tablet CTA did not occupy the side column`);
          } else {
            assert.ok(card.ctaTop >= card.bodyBottom + 15, `${label}/proof-${index + 1}: phone CTA spacing collapsed`);
          }
        }
      }

      if(width===1440) {
        await page.emulateMedia({media:'print'});
        const printTitles=await page.evaluate(readCarouselTitles);
        for(const card of printTitles) {
          assert.equal(card.headings.length,1,`${browserName}/print/${card.title}: title lost or duplicated in print`);
          assert.ok(card.headings[0].includes('latest-card-title--print'),`${browserName}/print/${card.title}: hidden cover did not yield to the print title`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

console.log(`Homepage card rhythm smoke passed in ${browsers.map(([name]) => name).join(' + ')}.`);
