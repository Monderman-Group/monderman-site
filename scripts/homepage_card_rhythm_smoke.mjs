import assert from 'node:assert/strict';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE || 'http://127.0.0.1:4175';
const browsers = [['chromium', chromium], ['webkit', webkit]]
  .filter(([name]) => !process.env.CARD_RHYTHM_BROWSER || process.env.CARD_RHYTHM_BROWSER === name);
const viewports = [390, 640, 641, 760, 761, 768, 1024, 1120, 1121, 1180, 1181, 1440];

const closeTo = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance;
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
      await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => document.fonts?.ready);
      await page.locator('#latestTrack>.latest-card:not(.is-carousel-clone) .placeholder-cover-title').first().waitFor({state:'visible'});

      const carouselTitles=await page.evaluate(readCarouselTitles);
      assert.equal(carouselTitles.length,16,`${browserName}/${width}: original carousel items were lost or cloned into the title audit`);
      for (const card of carouselTitles) {
        assert.equal(card.headings.length,1,`${browserName}/${width}/${card.title}: duplicate or missing accessible title on screen`);
        assert.ok(card.headings[0].includes('placeholder-cover-title'),`${browserName}/${width}/${card.title}: cover is not the visible title`);
        assert.ok(card.linkNames.every(name=>name?.includes(card.title)),`${browserName}/${width}/${card.title}: link names do not identify their article`);
      }
      assert.ok(await page.locator('#latestTrack>.is-carousel-clone').evaluateAll(cards=>cards.every(card=>card.inert&&card.getAttribute('aria-hidden')==='true')),`${browserName}/${width}: repeated carousel items entered the accessibility tree`);

      const result = await page.evaluate(() => {
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
        const loop = [...document.querySelectorAll('.loop-step')].map((card) => {
          const cardBox = rect(card);
          const numberBox = rect(card.querySelector('.loop-step-no'));
          const style = getComputedStyle(card);
          return {
            padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px),
            numberLeft: numberBox.left - cardBox.left,
            numberTop: numberBox.top - cardBox.top,
            borderRight: style.borderRightWidth,
            borderBottom: style.borderBottomWidth,
          };
        });
        return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          proofColumns: getComputedStyle(proofGrid).gridTemplateColumns.split(' ').length,
          approachColumns: getComputedStyle(document.querySelector('.approach-grid')).gridTemplateColumns.split(' ').length,
          loopColumns: getComputedStyle(document.querySelector('.loop-flow')).gridTemplateColumns.split(' ').length,
          proof,
          approach,
          loop,
        };
      });

      const label = `${browserName}/${width}`;
      assert.ok(result.overflow <= 1, `${label}: homepage overflows by ${result.overflow}px`);
      assert.equal(result.proof.length, 3, `${label}: expected three proof cards`);
      assert.equal(result.approach.length, 4, `${label}: expected four diagnostic cards`);
      assert.equal(result.loop.length, 4, `${label}: expected four measurement-loop cards`);

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

      if (width <= 1120) {
        assert.equal(result.loopColumns, 1, `${label}: measurement loop should be one column`);
        for (const [index, card] of result.loop.entries()) {
          assert.deepEqual(card.padding, [22, 22, 22, 22], `${label}/loop-${index + 1}: sibling padding differs`);
          assert.ok(closeTo(card.numberLeft, 22) && closeTo(card.numberTop, 22),
            `${label}/loop-${index + 1}: number is not aligned to the card inset`);
          assert.equal(card.borderRight, '0px', `${label}/loop-${index + 1}: one-column card retained a side divider`);
          assert.equal(card.borderBottom, index === 3 ? '0px' : '1px',
            `${label}/loop-${index + 1}: one-column dividers are inconsistent`);
        }
      } else {
        assert.equal(result.loopColumns, 4, `${label}: measurement loop should be four columns`);
        for (const [index, card] of result.loop.entries()) {
          assert.deepEqual(card.padding, [22, 22, 22, 22], `${label}/loop-${index + 1}: desktop sibling padding differs`);
          assert.ok(closeTo(card.numberLeft, 22) && closeTo(card.numberTop, 22),
            `${label}/loop-${index + 1}: desktop number is not aligned to the card inset`);
          assert.equal(card.borderRight, index === 3 ? '0px' : '1px',
            `${label}/loop-${index + 1}: four-column dividers are inconsistent`);
          assert.equal(card.borderBottom, '0px', `${label}/loop-${index + 1}: desktop card retained a bottom divider`);
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
