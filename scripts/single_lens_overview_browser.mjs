// Browser geometry and keyboard navigation of raw report adapters. Local saved
// engine results and current comparison sources only; all transport is blocked
// except font requests fulfilled from local bytes. No accounts or providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium, webkit} from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
assert.ok(process.argv[2], 'Provide a new browser evidence directory');
const out = path.resolve(process.argv[2]);
assert.ok(!fs.existsSync(out), 'Browser evidence directory must be new');
fs.mkdirSync(out, {recursive:true});
const read = file => fs.readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = read('monderman-report.js'), sampleBytes = read('sample-data/production-diagnostic-samples.json');
const artifact = JSON.parse(sampleBytes), runs = JSON.parse(read('test-fixtures/authenticated-report-engine-runs.json'));
const box = {window:{}, console, Intl, Date, Number, String, Array, Object, Math, JSON, WeakSet, Blob, URL, setTimeout, clearTimeout};
for (const file of ['participant-evidence-safety.js','monderman-report.js']) vm.runInNewContext(read(file).toString(), box, {filename:file});
const R = box.window.MondermanReport;
const inputs = [
  ...Object.entries(runs.outputs).map(([key, raw]) => ({key:'run-' + key, raw, adapter:'fromRun'})),
  ...Object.entries(artifact.outputs).filter(([,entry]) => entry.kind === 'response_comparison').map(([key,entry]) => ({key:'comparison-' + key, raw:entry.source, adapter:'fromSynthesis'}))
];
assert.equal(inputs.length, 8, 'Four engine runs and four campaign comparisons');
for (const kind of ['self_run_synthesis','self_run_response_comparison']) {
  const raw = structuredClone(artifact.outputs.depth_synthesis.source);
  raw.source_mode='own_saved_runs'; raw.report_kind=kind; delete raw.ai_report;
  inputs.push({key:'self-run-no-ai-' + kind, raw, adapter:'fromSynthesis', selfRun:true});
}
const reports = inputs.map(item => {
  const before = JSON.stringify(item.raw), model = R[item.adapter](item.raw), html = R.buildReportHtml(model);
  assert.equal(JSON.stringify(item.raw), before, item.key + ': raw source remains unchanged');
  return {...item, html};
});
let checks = 0;
const ok = (value, label) => {assert.ok(value, label); checks++;};
const eq = (actual, expected, label) => {assert.deepEqual(actual, expected, label); checks++;};
const states = [], errors = [], requests = [];
for (const [engine, type] of [['chromium',chromium],['webkit',webkit]]) {
  const browser = await type.launch({headless:true});
  try {
    for (const width of [320,390,834,1440]) for (const item of reports) {
      const label = engine + '-' + width + '-' + item.key;
      const page = await browser.newPage({viewport:{width,height:1000}, reducedMotion:'reduce'});
      page.on('pageerror', error => errors.push({label, message:error.message}));
      await page.route('**/*', route => {
        const font = /^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if (font) return route.fulfill({contentType:'font/woff2', body:read(font[1] + 'font.woff2')});
        requests.push({label, url:route.request().url()}); return route.abort();
      });
      await page.setContent(item.html, {waitUntil:'load'});
      await page.evaluate(() => document.fonts.ready);
      eq(await page.locator('.mr-cover').getAttribute('data-overview-first'), 'true', label + ': overview first');
      eq(await page.locator('.mr-overview-tile:visible').count(), 4, label + ': four visible tiles');
      const geometry = await page.locator('.mr-overview-grid').evaluate(grid => ({
        columns:getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length,
        overflow:document.documentElement.scrollWidth > innerWidth + 1,
        tiles:[...grid.children].map(tile => {
          const r = tile.getBoundingClientRect(), title = tile.querySelector('.mr-overview-title');
          return {x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width,
            background:getComputedStyle(tile).backgroundColor, heading:getComputedStyle(title).backgroundColor,
            content:tile.querySelector('.mr-overview-content').textContent.trim()};
        })
      }));
      eq(geometry.columns, width < 700 ? 1 : 2, label + ': responsive column count');
      eq(geometry.overflow, false, label + ': no viewport overflow');
      for (const tile of geometry.tiles) {
        eq(tile.background, 'rgb(255, 255, 255)', label + ': white tile');
        eq(tile.heading, 'rgb(9, 56, 62)', label + ': consistent dark teal heading');
        ok(tile.width > 100 && tile.content.length > 10, label + ': nonempty visible tile');
        ok(tile.x >= -1 && tile.right <= width + 1, label + ': tile fits viewport');
      }
      if (width >= 700) {
        ok(Math.abs(geometry.tiles[0].y - geometry.tiles[1].y) < 1, label + ': first row is paired');
        ok(Math.abs(geometry.tiles[2].y - geometry.tiles[3].y) < 1, label + ': second row is paired');
        ok(geometry.tiles[2].y >= geometry.tiles[0].bottom, label + ': rows do not overlap');
      } else for (let index=1; index<4; index++) ok(geometry.tiles[index].y >= geometry.tiles[index-1].bottom, label + ': phone tiles stack without overlap');
      const initial = await page.evaluate(() => {
        const overview=document.querySelector('.mr-report-overview'), detail=document.querySelector('.mr-cover-score-row');
        return {overview:overview.getBoundingClientRect().top, detail:detail.getBoundingClientRect().top,
          detailVisible:detail.getBoundingClientRect().height > 0, follows:!!(overview.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING)};
      });
      ok(initial.follows && (!initial.detailVisible || initial.overview < initial.detail), label + ': overview precedes full cover detail');
      const tiles = page.locator('.mr-overview-tile');
      if (item.selfRun) {
        const findingsTarget=await tiles.nth(0).getAttribute('href'), financialTarget=await tiles.nth(1).getAttribute('href');
        eq(await page.locator(findingsTarget).getAttribute('class'), 'mr-section mr-self-run-views', label + ': findings target recorded views');
        ok((await page.locator(financialTarget).getAttribute('class')).includes('mr-financial-availability'), label + ': finance targets its explanation');
        ok(findingsTarget !== financialTarget, label + ': findings and finance are distinct');
        eq(await tiles.nth(2).getAttribute('href'), findingsTarget, label + ': guidance without AI targets recorded views');
      }
      for (let index=0; index<4; index++) {
        const tile = tiles.nth(index), target = await tile.getAttribute('href');
        eq(await page.locator(target).count(), 1, label + ': target is unique');
        await tile.focus();
        eq(await tile.evaluate(node => getComputedStyle(node).outlineStyle), 'solid', label + ': keyboard focus visible');
        await page.keyboard.press('Enter');
        eq(await page.evaluate(() => document.activeElement.id), target.slice(1), label + ': target receives focus');
        const section=page.locator(target), ownBack=section.locator('.mr-section-back a').first();
        const back=await ownBack.count() ? ownBack : section.locator('xpath=ancestor::section').locator('.mr-section-back a').first();
        eq(await back.count(), 1, label + ': detail has overview return');
        const returnTarget=await back.getAttribute('href');
        await back.focus(); await page.keyboard.press('Enter');
        eq(await page.evaluate(() => document.activeElement.id), returnTarget.slice(1), label + ': return restores overview focus');
        eq(await page.locator(returnTarget).getAttribute('class'), 'mr-screen-only mr-report-overview', label + ': return targets overview');
      }
      eq(await page.locator('section[data-financial-state="campaign-data-needed"]').count(), 1, label + ': one financial explanation section');
      eq(await page.locator('.mr-benefit-cards,.mr-overview-sankey,.mr-benefit-panel').count(), 0, label + ': no placeholder or fabricated financial cards');
      await page.evaluate(() => {document.activeElement?.blur(); scrollTo(0,0);});
      const coverHeight=Math.ceil(await page.locator('.mr-cover').evaluate(node => node.getBoundingClientRect().bottom));
      ok(coverHeight > 0 && coverHeight < 32767, label + ': complete cover fits screenshot limit');
      await page.screenshot({path:path.join(out,label + '.png'), fullPage:true, clip:{x:0,y:0,width,height:coverHeight}});
      await page.emulateMedia({media:'print'});
      eq(await page.locator('.mr-report-overview:visible,.mr-section-back:visible').count(), 0, label + ': screen navigation hidden in print');
      eq(await page.locator('.mr-financial-availability:visible').count(), 1, label + ': financial explanation retained in print');
      states.push({engine,width,key:item.key,columns:geometry.columns});
      await page.close();
    }
  } finally {await browser.close();}
}
eq(errors, [], 'No browser exceptions');
eq(requests, [], 'No unexpected transport');
eq(sha(read('monderman-report.js')), sha(source), 'Renderer unchanged during check');
const receipt = {status:'PASS', checks, states, errors, requests, rendererSha256:sha(source), sampleSha256:sha(sampleBytes), providerCalls:0, networkCalls:0, accountWrites:0};
fs.writeFileSync(path.join(out,'RECEIPT.json'), JSON.stringify(receipt,null,2) + '\n');
console.log(JSON.stringify({...receipt,states:states.length,out}));
