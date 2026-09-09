// Historical synthetic model text tests layout only, never current AI quality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compact=text=>String(text).replace(/\s+/g,'');
function assertAtomic(pages,blocks){
  assert.ok(blocks.length,'Missing expected reading units');
  for(const block of blocks){
    assert.ok(block.parts.length&&block.parts.every(text=>typeof text==='string'&&compact(text)),'Empty reading unit');
    assert.ok(pages.some(page=>block.parts.every(text=>compact(page).includes(compact(text)))),`Split reading unit: ${block.id}`);
  }
}
for(const [id,parts] of [['summary',['Keep the full sentence together.']],['hypothesis',['This may explain the observed response.']],['card',['Decision Velocity','70 Mean score','Approval Density']]]){
  assertAtomic([parts.join('\n')],[{id,parts}]);
  const all=parts.join(' '),split=all.lastIndexOf(' ');
  assert.throws(()=>assertAtomic([all.slice(0,split),all.slice(split)],[{id,parts}]),/Split reading unit/);
}
assert.throws(()=>assertAtomic(['text'],[]),/Missing expected/);
assert.throws(()=>assertAtomic(['text'],[{id:'empty',parts:[]}]),/Empty reading unit/);
assertAtomic(['Approval Density\n70 Mean score\nDecision Velocity'],[{id:'column-order',parts:['Decision Velocity','70 Mean score','Approval Density']}]);
const bytes=fs.readFileSync(path.join(root,'test-fixtures/report-full-pagination-p19-historical.json'));
assert.equal(sha(bytes),'2d7591fbe5c247797a53eaea455e6b7ca373e476a268700e05992184d0fcff44');
const fixture=JSON.parse(bytes);
assert.equal(fixture.schemaVersion,'historical-report-pagination-fixtures-1');
assert.equal(fixture.syntheticOnly,true);assert.equal(fixture.historicalDisplayOnly,true);
assert.equal(fixture.receiptSha256,'928c4ba04c405886d63a2703911950cbd2d2b9667297fb1c5c9425c0a2b7c810');
const expected={
  'SC-managerial-10-best':['summary-0','hypothesis-0'],
  'IP-managerial-30-missing':['summary-0','hypothesis-0','hypothesis-1'],
  'synthesis-cross':['summary-0','contribution-0','contribution-1']
};
assert.deepEqual(fixture.cases.map(item=>item.id),Object.keys(expected));
const source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const prefix=process.env.REPORT_ACTUAL_PAGINATION_PREFIX||'/tmp/report-presentation-smoke/actual-text-';
fs.mkdirSync(path.dirname(prefix),{recursive:true});
const out=fs.mkdtempSync(prefix);
const receipt={scope:fixture.scope,historicalDisplayOnly:true,fixtureSha256:sha(bytes),rendererSha256:sha(source),providerCalls:0,unexpectedRequests:[],errors:[],cases:[],passed:false};
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
page.on('pageerror',error=>receipt.errors.push(error.message));
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
  receipt.unexpectedRequests.push(url.origin+url.pathname);return route.abort();
});
try{
  for(const item of fixture.cases){
    const before=JSON.stringify(item.run),dir=path.join(out,item.id);fs.mkdirSync(dir);
    await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:source});
    const html=await page.evaluate(({run,kind})=>MondermanReport.buildReportHtml(kind==='synthesis'?MondermanReport.fromSynthesis(run):MondermanReport.fromRun(run)),item);
    assert.equal(JSON.stringify(item.run),before);assert.doesNotMatch(html,/\[object Object\]|\bundefined\b|\bNaN\b/);
    const result={id:item.id,widths:[]};receipt.cases.push(result);
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1000});await page.setContent(html);
      await page.evaluate(async()=>{await Promise.all([400,500,700].map(w=>document.fonts.load(`${w} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;});
      assert.equal(await page.evaluate(()=>[...document.fonts].filter(f=>f.family==='Neue Haas Grotesk'&&f.status==='loaded').length),3);
      const bounds=await page.evaluate(()=>({document:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('.mr-page *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+1);}).map(el=>String(el.className))}));
      assert.ok(bounds.document<=width+1,JSON.stringify(bounds));assert.deepEqual(bounds.elements,[]);
      assert.equal(await page.locator('.mr-report-boundary').count(),1);assert.equal(await page.locator('.mr-ai-interpretation').count(),1);
      await page.screenshot({path:path.join(dir,`${width}.png`),fullPage:true});result.widths.push(width);
    }
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.actions').isVisible(),false);
    const blocks=await page.evaluate(()=>{
      const blocks=[...document.querySelectorAll('.mr-exec-lede')].map((el,i)=>({id:`summary-${i}`,parts:[el.innerText]}));
      const heading=[...document.querySelectorAll('.mr-ai-interpretation h3')].find(el=>el.textContent==='Possible explanations to investigate');
      if(heading&&heading.nextElementSibling?.tagName==='UL')[...heading.nextElementSibling.querySelectorAll('li')].forEach((el,i)=>blocks.push({id:`hypothesis-${i}`,parts:[el.innerText]}));
      [...document.querySelectorAll('.mr-lens-grid>.mr-lens-card')].filter(el=>el.querySelector('.mr-contributing-score')).forEach((el,i)=>blocks.push({id:`contribution-${i}`,parts:[...el.children].map(child=>child.innerText).filter(Boolean)}));
      return blocks;
    });
    assert.deepEqual(blocks.map(block=>block.id),expected[item.id]);
    for(const block of blocks.filter(b=>b.id.startsWith('contribution-')))assert.equal(block.parts.length,5);
    result.atomicBlocks=blocks;
    const pdf=path.join(dir,'report.pdf');await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
    const extraction=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:8*1024*1024});
    assert.equal(extraction.status,0,extraction.stderr);
    const pages=JSON.parse(extraction.stdout);assertAtomic(pages,blocks);result.pages=pages.length;
    assert.ok(pages.length>1&&pages.length<40);assert.ok(pages.every(text=>text.trim().length>20));
    assert.ok(compact(pages.at(-1)).includes(compact(await page.locator('.mr-report-boundary p:last-child').innerText())),'Final boundary split or absent');
    const text=compact(pages.join('\n')),report=item.run.ai_report.report,interpretation=report.interpretation;
    for(const paragraph of [interpretation.summary,...interpretation.observations.map(x=>x.text),...interpretation.hypotheses.map(x=>x.text),...interpretation.recommendations.flatMap(x=>[x.action,x.reason,x.prerequisite,x.risk,x.success_check]),...report.limitations,...interpretation.limitations,report.benchmark.explanation,...report.sources.flatMap(x=>[x.title,x.publisher])]){
      assert.ok(typeof paragraph==='string'&&compact(paragraph),'Empty expected AI text');
      assert.ok(text.includes(compact(paragraph)),'Saved AI text or caveat absent');
    }
    fs.writeFileSync(path.join(dir,'pages.json'),JSON.stringify(pages,null,2));
    await page.emulateMedia({media:'screen'});
  }
  assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.unexpectedRequests,[]);receipt.passed=true;
}finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));await browser.close();}
console.log(JSON.stringify({passed:receipt.passed,out,reports:3,responsiveRenders:9,pdfs:3,samePageBlocks:8,providerCalls:0,scope:fixture.scope}));
