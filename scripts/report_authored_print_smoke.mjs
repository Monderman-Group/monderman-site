// PUBLIC, synthetic print-layout regression. No private engine or live AI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const out=process.env.REPORT_PRINT_OUT||fs.mkdtempSync('/tmp/report-authored-print-');
fs.mkdirSync(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const compact=value=>String(value).replace(/\s+/g,'');
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
const receipt={passed:false,mockOnly:true,rendererSha256:sha(source),sourceUnchanged:true,screenChecks:[],printChecks:[],cssMutationsRejected:0,errors:[],providerCalls:0};
page.on('pageerror',error=>receipt.errors.push(error.message));
await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
  receipt.errors.push('Unexpected request: '+url.origin+url.pathname);return route.abort();
});
try{
  for(const kind of ['bounded','long']){
    const reason=kind==='bounded'?'MOCK: Check one authorized work example with its owner before changing anything. The test may confirm the current arrangement.':Array.from({length:32},(_,i)=>`MOCK paragraph ${i+1}. This deliberately long layout fixture checks that report text remains complete when a callout needs more than one printed page.`).join('\n\n');
    const action='MOCK: Review the recorded decision with its owner and record what can and cannot be established.';
    const report={version:'MOCK-PRINT-ONLY',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-11T12:00:00Z',
      composition:{authorship:'provider_authored_engine_bounded'},
      evidence:[{id:'F1',label:'Synthetic first evidence item',value:54},{id:'F2',label:'Synthetic second evidence item',value:'Recorded synthetic answer'},{id:'F3',label:'Synthetic third evidence item',value:'Another synthetic answer'}],
      evidence_references:{summary:['F1','F2']},sources:[],
      interpretation:{summary:'MOCK layout fixture, not a product claim or customer report.',observations:[],hypotheses:[],recommendations:[],
        action_options:[{option_id:'mock-limited',intensity:'limited',action,reason:'MOCK option explanation.',evidence_ids:['F3']}],
        recommended_option:{option_id:'mock-limited',reason,evidence_ids:['F1','F2']},limitations:[]}};
    const raw={synthesis_product:'cross_lens_synthesis',score_status:'withheld',source_groups:[],generated_at:'2026-09-11T12:00:00Z',ai_report:{status:'complete',report}};
    await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:source});
    const html=await page.evaluate(raw=>{
      const before=JSON.stringify(raw),html=MondermanReport.buildReportHtml(MondermanReport.fromSynthesis(raw));
      if(JSON.stringify(raw)!==before)throw Error('Renderer changed saved input');return html;
    },raw);
    for(const width of [320,390,834,1440]){
      await page.setViewportSize({width,height:1000});await page.emulateMedia({media:'screen'});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
      const facts=await page.locator('.mr-recommended-path').evaluate(e=>({bounded:e.classList.contains('mr-recommended-path-bounded'),breakInside:getComputedStyle(e).breakInside,overflow:document.documentElement.scrollWidth>innerWidth+1}));
      assert.equal(facts.bounded,kind==='bounded');assert.equal(facts.breakInside,'auto','Print-only keep-together must not alter screen fragmentation');assert.equal(facts.overflow,false);
      assert.equal(await page.locator('.mr-print-evidence').isVisible(),false);
      const screenEvidence=await page.locator('.mr-evidence-detail').first().evaluate(e=>{e.open=true;return [...e.querySelectorAll('.mr-evidence-entry')].map(row=>getComputedStyle(row).marginTop);});
      assert.deepEqual(screenEvidence,['0px','12px'],'Existing screen evidence spacing must not change');
      receipt.screenChecks.push({kind,width,...facts});
    }
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:1000});await page.setContent(html);await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
      const register=await page.locator('.mr-print-evidence').evaluate(e=>[...e.querySelectorAll('.mr-evidence-entry')].map(row=>({text:row.innerText,top:row.querySelector('dt').getBoundingClientRect().top,marginTop:getComputedStyle(row).marginTop,paddingTop:getComputedStyle(row).paddingTop})));
      assert.equal(register.length,3);assert.ok(Math.abs(register[0].top-register[1].top)<0.5,'First print row labels must share a baseline');
      for(const row of register){assert.equal(row.marginTop,'0px');assert.equal(row.paddingTop,'10px');}
      assert.ok(register[0].text.startsWith('1. Synthetic first'));assert.ok(register[1].text.startsWith('2. Synthetic second'));assert.ok(register[2].text.startsWith('3. Synthetic third'),'Evidence register order must remain unchanged');
      const preferred=await page.locator('.mr-recommended-path').evaluate(e=>({text:e.innerText,header:e.querySelector('h3').innerText,tail:e.querySelector('.mr-reading-context').innerText,breakInside:getComputedStyle(e).breakInside}));
      assert.equal(preferred.breakInside,kind==='bounded'?'avoid':'auto');
      if(kind==='bounded'&&width===390){
        // Independently remove each new rule from this actual rendered page.
        // Restore it before PDF output; a missing fix must fail its own check.
        const styles=await page.locator('style').allTextContents();
        const withoutRule=async rule=>page.locator('style').evaluateAll((nodes,rule)=>{let changed=0;for(const node of nodes){if(node.textContent.includes(rule)){node.textContent=node.textContent.replace(rule,'');changed++;}}if(changed!==1)throw Error('Exact print rule missing from mutation fixture');},rule);
        const restore=()=>page.locator('style').evaluateAll((nodes,values)=>nodes.forEach((node,i)=>node.textContent=values[i]),styles);
        await withoutRule('.mr-print-evidence .mr-evidence-entry{margin:0;padding:10px 0 0;border-top:1px solid #DCE5E8}');
        const tops=await page.locator('.mr-print-evidence dt').evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.getBoundingClientRect().top));
        assert.throws(()=>assert.ok(Math.abs(tops[0]-tops[1])<0.5),'Register-alignment check did not reject the old spacing');receipt.cssMutationsRejected++;await restore();
        await withoutRule('.mr-recommended-path-bounded{break-inside:avoid;page-break-inside:avoid}');
        const split=await page.locator('.mr-recommended-path').evaluate(node=>getComputedStyle(node).breakInside);
        assert.throws(()=>assert.equal(split,'avoid'),'Callout check did not reject the old fragmentation rule');receipt.cssMutationsRejected++;await restore();
      }
      // Force a real page-boundary challenge with the actual rendered callout
      // and register, not a hand-written reproduction of the print markup.
      await page.evaluate(()=>{const aside=document.querySelector('.mr-recommended-path').outerHTML,register=document.querySelector('.mr-print-evidence').outerHTML;document.querySelector('.mr-page').innerHTML='<h1>MOCK PRINT REGRESSION</h1><div style="height:430px"></div><section class="mr-section mr-ai-interpretation mr-authored-report">'+aside+register+'</section>';});
      const pdf=path.join(out,`${kind}-${width}-MOCK.pdf`);await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
      const extracted=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:8*1024*1024});
      assert.equal(extracted.status,0,extracted.stderr);const pages=JSON.parse(extracted.stdout),text=compact(pages.join('\n'));
      assert.ok(pages.every(p=>p.trim()),'No blank PDF page');
      for(const snippet of [action,...reason.split('\n\n'),preferred.tail,...register.map(row=>row.text)])assert.ok(text.includes(compact(snippet)),'Printed text missing');
      if(kind==='bounded')assert.ok(pages.some(p=>compact(p).includes(compact(preferred.text))),'Short recommended path split across PDF pages');
      else assert.ok(!pages.some(p=>compact(p).includes(compact(preferred.header))&&compact(p).includes(compact(preferred.tail))),'Long recommended path must be allowed to paginate');
      receipt.printChecks.push({kind,width,pdf:path.basename(pdf),sha256:sha(fs.readFileSync(pdf)),pages:pages.length,registerAligned:true,calloutFragmentation:preferred.breakInside,textPreserved:true});
    }
  }
  assert.deepEqual(receipt.errors,[]);receipt.passed=true;
}finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));}
console.log(JSON.stringify({passed:receipt.passed,screenChecks:receipt.screenChecks.length,pdfs:receipt.printChecks.length,cssMutationsRejected:receipt.cssMutationsRejected,mockOnly:true,providerCalls:0,out}));
