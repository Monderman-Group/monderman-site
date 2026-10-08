import {chromium, webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8796';
const output = 'tmp/durable-organization-browser';
fs.mkdirSync(output, {recursive:true});
let checks = 0;
const ok = (value, label) => {assert.ok(value,label); checks++;};
for (const [engine,type] of Object.entries({chromium,webkit})) {
  const browser = await type.launch({headless:true});
  try {
    for (const width of [390,820,1440]) {
      const page = await browser.newPage({viewport:{width,height:900}}), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(base+'/durable-organization.html');
      await page.evaluate(()=>document.fonts.ready);
      ok(await page.locator('h1').innerText()==='The Durable Organization','Exact article title');
      ok((await page.locator('.article-hero .article-kicker').textContent())==='Governance and Performance · Part 5' && await page.locator('.article-hero .article-kicker').isVisible(),'Actual Part 5 hero');
      ok((await page.locator('.article-byline').textContent()).includes('15 pages · 35-minute read'),'Actual PDF page/read metadata');
      ok(await page.locator('[data-source-paragraph]').count()===100,'All source paragraphs rendered');
      ok(await page.locator('[data-source-reference]').count()===19,'All complete references rendered');
      ok(await page.locator('.section-number').count()===6,'All source sections rendered');
      ok(await page.locator('.durable-figure').count()===1,'One original qualitative figure');
      ok((await page.locator('.durable-figure figcaption').innerText())==='An illustration of this paper’s argument. It is not drawn from data.','Figure caveat visible');
      ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+' article no horizontal overflow '+width);
      ok(await page.evaluate(()=>[...document.querySelectorAll('.article-body,.durable-figure,.article-references')].every(node=>node.scrollWidth<=node.clientWidth+2)),engine+' article containment '+width);
      ok(await page.locator('.durable-figure-legend').isVisible()===(width<=540),'Mobile labels preserve readable source chart legend');
      await page.screenshot({path:output+`/${engine}-${width}-hero.png`});
      await page.locator('.durable-figure').scrollIntoViewIfNeeded();
      await page.screenshot({path:output+`/${engine}-${width}-figure.png`});
      const download = await page.request.get(base+'/Monderman_Insight_The_Durable_Organization_2026-10-07.pdf');
      ok(download.status()===200 && (await download.body()).subarray(0,5).toString()==='%PDF-','Real publication PDF download');
      ok(await page.locator('.article-further a[href="trenches-not-silos.html"]').count()===1,'Previous Part 4 route');
      await page.locator('.article-further a[href="hold-collide-come-apart.html"]').click();
      ok(page.url().endsWith('/hold-collide-come-apart.html'),'Next Part 6 route works');
      ok((await page.locator('.article-hero .article-kicker').textContent())==='Governance and Performance · Part 6','Actual Hold Part 6 after navigation');
      await page.goto(base+'/research.html');
      const card = page.locator('.series-card').filter({hasText:'The Durable Organization'});
      ok(await card.count()===1 && await card.locator('.series-chip').textContent()==='Part 5','Unique fifth Research card');
      await card.getByRole('link',{name:'Read article'}).click();
      ok(page.url().endsWith('/durable-organization.html'),'Research article link works');
      await page.goto(base+'/');
      await page.waitForSelector('#latestViewport.is-ready');
      const first = page.locator('.latest-card:not(.is-carousel-clone)').first();
      ok((await first.innerText()).includes('The Durable Organization'),'Newest homepage publication');
      ok((await first.locator('.latest-card-kicker').textContent())==='Governance and Performance · Part 5','Current homepage Part 5');
      ok(errors.length===0,engine+' browser errors: '+errors.join('; '));
      await page.close();
    }
  } finally {await browser.close();}
}
console.log(JSON.stringify({passed:true,checks,engines:['chromium','webkit'],widths:[390,820,1440],base,output},null,2));
