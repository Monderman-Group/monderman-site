// Offline rendering only. Historical synthetic model text is a layout stress
// fixture, not a current-model quality approval or a customer report.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
// PDF font extraction may insert spaces inside a word. Tolerate that only;
// the complete boundary must still be on the final page, never joined pages.
const compact=text=>String(text).replace(/\s+/g,'');
const boundaryOnFinalPage=(pages,boundary)=>Boolean(compact(boundary))&&compact(pages.at(-1)||'').includes(compact(boundary));
assert.equal(boundaryOnFinalPage(['The answ ers show  how assumptions apply.'],'The answers show how assumptions apply.'),true);
assert.equal(boundaryOnFinalPage(['The answers show how','assumptions apply.'],'The answers show how assumptions apply.'),false);
assert.equal(boundaryOnFinalPage(['The answers show how assumptions apply.','Other text.'],'The answers show how assumptions apply.'),false);
assert.equal(boundaryOnFinalPage(['Anything.'],''),false);
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.env.REPORT_FULL_PAGINATION_OUT||'/tmp/report-presentation-smoke/full-pagination');
fs.mkdirSync(out,{recursive:true});
const historical=JSON.parse(fs.readFileSync(path.join(root,'test-fixtures/report-full-pagination.json')));
const legacy=JSON.parse(fs.readFileSync(path.join(root,'test-fixtures/authenticated-report-engine-runs.json')));
assert.equal(historical.syntheticOnly,true);
assert.equal(historical.receiptSha256,'ec3bee343387609f09fcccaece39e7df944ec75350ec27aeb5c0ff7c07fb238b');
assert.match(historical.scope,/OS AI text was independently rejected/);
const cases=[...historical.cases,...Object.entries(legacy.outputs).map(([id,run])=>({id:'legacy-'+id,run}))];
assert.equal(cases.length,6);
const source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const evidence={scope:historical.scope,rendererSha256:createHash('sha256').update(source).digest('hex'),checks:[],errors:[],passed:false};
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage();
page.on('pageerror',e=>evidence.errors.push(e.message));
await context.route('**/*',route=>{const url=new URL(route.request().url());
  if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
  evidence.errors.push('Unexpected network request: '+url.origin+url.pathname);return route.abort();
});
try{
 for(const item of cases){
  const unchanged=JSON.stringify(item.run),dir=path.join(out,item.id);fs.mkdirSync(dir,{recursive:true});
  await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:source});
  const html=await page.evaluate(run=>MondermanReport.buildReportHtml(MondermanReport.fromRun(run)),item.run);
  assert.equal(JSON.stringify(item.run),unchanged,'Fixture mutated');
  assert.doesNotMatch(html,/\[object Object\]|\bundefined\b|\bNaN\b/);
  assert.match(html,/No written participant notes are included\./);
  assert.match(html,/measured results reflect the structured answers/);
  assert.doesNotMatch(html,/therefore makes no participant-statement|representative run/);
  const check={id:item.id,widths:[],pdfPages:0};evidence.checks.push(check);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});await page.setContent(html);
   assert.equal(await page.locator('.mr-report-boundary').count(),1,'Exactly one final boundary: '+item.id);
   await page.evaluate(async()=>{await Promise.all([400,500,700].map(w=>document.fonts.load(`${w} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;});
   assert.equal(await page.evaluate(()=>[...document.fonts].filter(f=>f.family==='Neue Haas Grotesk'&&f.status==='loaded').length),3);
   const overflow=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('.mr-page *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+1);}).map(el=>el.className)}));
   assert.ok(overflow.document<=width+1,JSON.stringify(overflow));assert.deepEqual(overflow.elements,[]);
   await page.screenshot({path:path.join(dir,`${width}.png`),fullPage:true});check.widths.push(width);
  }
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.actions').isVisible(),false);
  const pdf=path.join(dir,'report.pdf');await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
  const result=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,'PDF extraction failed: '+result.stderr);
  const pages=JSON.parse(result.stdout).map(t=>t.replace(/\s+/g,' ').trim());check.pdfPages=pages.length;
  const expectedBoundary=(await page.locator('.mr-report-boundary p:last-child').innerText()).replace(/\s+/g,' ').trim();
  assert.ok(boundaryOnFinalPage(pages,expectedBoundary),'Final boundary missing or split: '+item.id);
  assert.ok(pages.length>1&&pages.length<40);assert.ok(pages.every(t=>t.length>20),'Empty or text-orphan page');
  const scenario=pages.filter(t=>t.includes('How the time and cost estimate is built'));
  assert.equal(scenario.length,1);assert.ok(scenario[0].includes('None is an audited or realized saving.'),'Scenario paragraph split');
  assert.ok(scenario[0].replace(/\s/g,'').includes('WORKLOADENTERED'),'Scenario chart separated from introduction');
  const governance=pages.filter(t=>t.includes('What the result supports and what it does not'));
  assert.equal(governance.length,1);assert.ok(governance[0].replace(/\s/g,'').includes('DESIGNREFERENCE(NOTAPEERBENCHMARK)'),'Governance heading orphaned');
  assert.doesNotMatch(pages.join('\n'),/Save \/ Print PDF|Close report|\{\{F\d/);
  if(item.run.ai_report){assert.match(pages.join('\n'),/AI-assisted interpretation/);assert.equal(await page.locator('.mr-ai-interpretation').count(),1);}
  fs.writeFileSync(path.join(dir,'pages.json'),JSON.stringify(pages,null,2));
  await page.emulateMedia({media:'screen'});
 }
 assert.deepEqual(evidence.errors,[]);evidence.passed=true;
 console.log(JSON.stringify({passed:true,fullReports:cases.length,responsiveRenders:cases.length*3,pdfs:cases.length,scope:evidence.scope}));
}finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));await browser.close();}
