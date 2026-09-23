// Render the unchanged, reviewed sample data through the same public adapter.
// Produces candidate exports only; does not approve or publish them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.argv[2]);
assert.ok(process.argv[2]&&!fs.existsSync(out),'Use a new candidate output directory');
const sha=v=>createHash('sha256').update(v).digest('hex'),read=f=>fs.readFileSync(path.join(root,f));
const bytes=read('sample-data/production-diagnostic-samples.json'),artifact=JSON.parse(bytes),manifest=JSON.parse(read('sample-data/production-sample-release.json'));
assert.equal(sha(bytes),manifest.artifact_file_sha256);
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
for(const file of ['participant-evidence-safety.js','monderman-report.js','public-sample-model.js'])vm.runInNewContext(read(file).toString(),context,{filename:file});
context.window.MondermanPublicSamples.validate(artifact);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),rows=[],unexpected=[],errors=[];
try{
  for(const key of (process.argv.includes('--all')?Object.keys(artifact.outputs):['depth_synthesis','cross_lens_synthesis'])){
    const synthesis=key.endsWith('_synthesis');
    const entry=artifact.outputs[key],before=JSON.stringify(entry),model=context.window.MondermanPublicSamples.model(entry,artifact);
    const html=context.window.MondermanReport.buildReportHtml(model);
    assert.equal(JSON.stringify(entry),before);assert.equal(JSON.stringify(model.aiReport),JSON.stringify(entry.source.ai_report));
    fs.writeFileSync(path.join(out,key+'.html'),html);
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:read(match[1]+'font.woff2')});unexpected.push(route.request().url());return route.abort();});
    await page.setContent(html);await page.evaluate(async()=>{await Promise.all([400,500,700].map(w=>document.fonts.load(`${w} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;});
    // Native screen selection must never change which case is printed.
    for(const level of synthesis?['low','central','high']:[]){
      await page.emulateMedia({media:'screen'});
      await page.locator('.mr-benefit-choice').filter({hasText:new RegExp('^'+level+'$','i')}).click();
      assert.equal(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),level);
      assert.deepEqual(await page.locator('.mr-benefit-panel:visible [data-burden-kind]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.burdenKind,n.dataset.burdenUnit])),[['money','USD'],['workload','hours']],'One money diagram and one time diagram for each selected case');
      await page.emulateMedia({media:'print'});
      assert.equal(await page.locator('.mr-benefit-panel:visible').count(),1);
      assert.equal(await page.locator('.mr-benefit-panel:visible').getAttribute('data-three-benefit-case'),'central');
      assert.equal(await page.locator('.mr-benefit-chart:visible').count(),1);
      assert.deepEqual(await page.locator('.mr-benefit-chart:visible [data-burden-kind]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.burdenKind,n.dataset.burdenUnit])),[['money','USD'],['workload','hours']],'The central printed case contains exactly two unit-separated diagrams');
      assert.equal(await page.locator('.mr-benefit-chart:visible .mr-unified-flow>svg:visible').count(),2,'Both complete diagrams print');
      assert.equal(await page.locator('.mr-report-overview:visible,.mr-section-back:visible').count(),0,'Screen overview and navigation do not duplicate printed findings');
      assert.ok(await page.locator('.mr-benefit-print-summary').evaluate(summary=>summary.compareDocumentPosition(document.querySelector('.mr-benefit-central .mr-benefit-chart'))&Node.DOCUMENT_POSITION_PRECEDING),'Comparison follows the central money/time charts');
    }
    await page.emulateMedia({media:'print'});
    const pdf=path.join(out,key+'.pdf');await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
    const pages=JSON.parse(execFileSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:16e6}));
    const compact=t=>t.normalize('NFKC').toLowerCase().replace(/\s/g,''),text=compact(pages.join(' '));
    const centralHeading='Central case: money and staff time';
    const centralPage=pages.findIndex(p=>p.includes(centralHeading));
    const comparisonPage=pages.findIndex(p=>p.includes('Three planning cases'));
    if(synthesis){
    assert.ok(centralPage>=1,'Central money/time charts follow the cover');
    assert.ok(comparisonPage>=centralPage,'Comparison follows the central money/time charts');
    if(comparisonPage===centralPage)assert.ok(pages[centralPage].indexOf(centralHeading)<pages[centralPage].indexOf('Three planning cases'));
    for(const b of Object.values(entry.source.financial_scenario.benefits))assert.ok(pages[comparisonPage].includes(b.amount.central.toLocaleString('en-US',{maximumFractionDigits:2})));
    assert.equal((pages.join(' ').match(/case: money and staff time/g)||[]).length,1,'Exactly one central planning-case heading');
    for(const heading of ['Money: current and planned spending','Staff time: allocation and retained capacity']){
      assert.equal(text.split(compact(heading)).length-1,1,'Exactly one printed diagram: '+heading);
      assert.ok(text.indexOf(compact(heading))<text.indexOf(compact('Three planning cases')),'Each complete diagram precedes the three-case comparison');
    }
    assert.ok(!/Low planning case|High planning case/.test(pages.join(' ')),'No repeated Low or High case pages');
    }else assert.equal(centralPage,-1,'No financial chart in individual reports');
    const generationDate=model.meta.find(row=>row.label==='Sample created').value;
    assert.ok(compact(pages[0]).includes(compact(generationDate)),'The original sample creation date remains on the cover: '+JSON.stringify({expected:generationDate,cover:pages[0]}));
    const authored=await page.locator('p,li,h1,h2,h3,h4,h5,td,th,.mr-unified-label>strong').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().width>0&&!n.closest('.mr-benefit-flow,.mr-toolbar')).map(n=>n.textContent.trim()).filter(Boolean));
    for(const field of authored)assert.ok(text.includes(compact(field)),'PDF missing authored text: '+field.slice(0,120));
    if(synthesis){assert.ok(pages.some(p=>p.includes('Central planning case')));assert.ok(!pages[centralPage].includes('Subscription allocation'));}
    rows.push({key,path:'sample-data/reports/'+key+'.pdf',sha256:sha(fs.readFileSync(pdf)),pages:pages.length,case_pages:synthesis?[centralPage+1]:[],comparison_page:synthesis?comparisonPage+1:null,sample_created:generationDate,html_sha256:sha(html),authored_fields:authored.length});
    await page.close();
  }
}finally{await browser.close();}
assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
const receipt={status:'PASS',artifact_file_sha256:sha(bytes),renderer_sha256:sha(read('monderman-report.js')),rows,provider_calls:0};
fs.writeFileSync(path.join(out,'EXPORT-CHECKS.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
