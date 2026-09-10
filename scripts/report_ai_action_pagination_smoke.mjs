// Synthetic presentation regression. These examples are not AI-quality evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'..'),source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const out=fs.mkdtempSync(process.env.REPORT_ACTION_PAGINATION_PREFIX||'/tmp/report-action-pagination-');
const compact=x=>String(x).replace(/\s+/g,''),sha=x=>createHash('sha256').update(x).digest('hex');
const receipt={rendererSha256:sha(source),providerCalls:0,cases:[],errors:[],unexpectedRequests:[],passed:false};
const run=JSON.parse(fs.readFileSync(path.join(root,'test-fixtures/report-full-pagination-p19-historical.json'))).cases.find(c=>c.id==='IP-managerial-30-missing').run;
const shared={source_ids:[],evidence_ids:[],prerequisite:'The responsible owner approves the review and access to relevant material. Process or control changes need separate approval.',risk:'Use authorized work examples without personal details. Stop if the review exceeds its agreed scope.'};
const actions=[
  {...shared,action:'With the responsible owner, review an example behind the answer. Record the intended direction and the action understood by the people doing the scoped work, if both can be established.',reason:'Question: How clearly does leadership direction reach your day-to-day work?\nParticipant answer: Direction rarely reaches people intact: they have to improvise\n\nThis proposed check was developed by Monderman. It is not a validated research method.',success_check:'Record whether the direction and understood action align, differ, or cannot be compared. Do not require a mismatch to be found.'},
  {...shared,action:'With the owner, examine an example behind the extra-effort answer. Record what extra work was described and what normal arrangement was expected to support it, without assigning that work to a role not identified by the participant.',reason:'Question: Which of these are you currently seeing? Select all that apply.\nParticipant answer: Results depend on extra effort or people going well beyond what is normally expected; Personal relationships fill gaps left by official systems and processes; Work becomes fragmented: intended direction and action do not match\n\nThis proposed check was developed by Monderman. It is not a validated research method.',success_check:'Record the described extra work and expected arrangement, or that either is unclear. The result may leave the relationship unresolved and must not assign an unsupported amount or worker group.'}
];
const actionPrintLength=(action,sources)=>[action.action,action.reason,action.prerequisite,action.risk,action.success_check].reduce((n,value)=>n+String(value||'').length,0)+sources.filter(source=>(action.source_ids||[]).includes(source.id)).reduce((n,source)=>n+String(source.publisher||'').length,0);
const browser=await chromium.launch(),context=await browser.newContext(),page=await context.newPage();
page.on('pageerror',e=>receipt.errors.push(e.message));
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(u.pathname))return route.fulfill({contentType:'font/woff2',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(path.join(root,u.pathname.slice(1)))});receipt.unexpectedRequests.push(u.origin+u.pathname);return route.abort();});
try{
  for(const kind of ['uncited-consecutive','referenced-final-check','bounded-edge-wrapped-reference','over-boundary-wrapped-reference','over-page-long-action']){
    const value=structuredClone(run),recommendations=structuredClone(actions),sources=[{id:'test-reference',title:'Synthetic reference',publisher:'Synthetic publisher',url:'https://www.monderman.com/research.html',reviewed:'2026-09-09'}];
    if(kind==='referenced-final-check')recommendations[0].source_ids=['test-reference'];
    if(kind==='bounded-edge-wrapped-reference'||kind==='over-boundary-wrapped-reference'){
      sources[0].publisher='Synthetic Very Long Practice Reference Publisher Name '.repeat(3).trim();
      recommendations[0].source_ids=['test-reference'];
      const target=kind==='bounded-edge-wrapped-reference'?1300:1301,current=actionPrintLength(recommendations[0],sources),prefix='\n\n';
      assert.ok(current+prefix.length<target);
      recommendations[0].reason+=prefix+'Boundary wrapping words '.repeat(Math.ceil((target-current-prefix.length)/24)).slice(0,target-current-prefix.length);
      assert.equal(actionPrintLength(recommendations[0],sources),target);
    }
    if(kind==='over-page-long-action')recommendations[0].reason=Array.from({length:28},(_,i)=>`Layout paragraph ${i+1}. This is a synthetic paragraph used only to confirm that a long action remains readable across page boundaries without clipping its text.`).join('\n\n');
    value.ai_report={status:'complete',report:{...value.ai_report.report,composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'},interpretation:{summary:'Synthetic layout test.',observations:[],hypotheses:[],recommendations,limitations:[]},sources}};
    await page.setContent('<html><body></body></html>');await page.addScriptTag({content:source});
    const html=await page.evaluate(value=>MondermanReport.buildReportHtml(MondermanReport.fromRun(value)),value);
    const record={kind,widths:[]};receipt.cases.push(record);
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1000});await page.setContent(html);await page.emulateMedia({media:'print'});
      // Keep renderer-produced markup and CSS, but isolate consecutive action cards.
      await page.evaluate(()=>{const actions=document.querySelector('.mr-ai-actions').outerHTML;document.querySelector('.mr-page').innerHTML='<section class="mr-section mr-ai-interpretation"><h3>Suggested next steps</h3>'+actions+'</section>';});
      await page.evaluate(async()=>{await Promise.all([400,500,700].map(w=>document.fonts.load(`${w} 16px "Neue Haas Grotesk"`)));await document.fonts.ready;});
      const facts=await page.locator('.mr-ai-action').evaluateAll(es=>es.map(e=>{const box=e.getBoundingClientRect();return {text:e.innerText,header:e.querySelector('h3').innerText,tail:e.querySelector('.mr-ai-definition:last-child').innerText,reference:e.querySelector('dl+p')?.innerText||null,bounded:e.classList.contains('mr-ai-action-bounded'),display:getComputedStyle(e).display,overflowY:getComputedStyle(e).overflowY,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,escaped:[...e.querySelectorAll('*')].filter(child=>{const r=child.getBoundingClientRect();return r.left<box.left-.5||r.right>box.right+.5}).map(child=>child.tagName),after:getComputedStyle(e.querySelector('dl')).breakAfter,tailAfter:getComputedStyle(e.querySelector('.mr-ai-definition:last-child')).breakAfter,inside:getComputedStyle(e).breakInside};}));
      assert.equal(facts.length,2);for(const [index,f] of facts.entries()){const fragmentable=(kind==='over-page-long-action'||kind==='over-boundary-wrapped-reference')&&index===0;assert.equal(f.bounded,!fragmentable);assert.equal(f.inside,fragmentable?'auto':'avoid');assert.equal(f.display,'block');assert.equal(f.overflowY,'visible');assert.ok(f.scrollWidth<=f.clientWidth+1);assert.deepEqual(f.escaped,[]);assert.equal(f.after,f.reference?'avoid':'auto');assert.equal(f.tailAfter,f.reference?'avoid':'auto');}
      const pdf=path.join(out,`${kind}-${width}.pdf`);await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
      const result=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(result.status,0,result.stderr);
      const pages=JSON.parse(result.stdout),texts=pages.map(compact);assert.ok(pages.every(p=>p.trim().length>20));
      if(kind==='over-page-long-action'){assert.ok(pages.length>=3);assert.ok(!texts.some(t=>t.includes(compact(facts[0].header))&&t.includes(compact(facts[0].tail))),'Long action must be allowed to span pages');}
      else for(const f of facts)if(f.bounded)assert.ok(texts.some(t=>t.includes(compact(f.text))),`Bounded whole action split: ${kind}`);
      for(const f of facts)if(f.reference)assert.ok(texts.some(t=>t.includes(compact(f.tail))&&t.includes(compact(f.reference))),'Final check and source reference separated');
      const all=compact(pages.join('\n'));for(const a of recommendations)for(const text of [a.action,...a.reason.split('\n\n'),a.prerequisite,a.risk,a.success_check])assert.ok(all.includes(compact(text)),'Action text missing');for(const source of sources.filter(source=>recommendations.some(action=>(action.source_ids||[]).includes(source.id))))assert.ok(all.includes(compact(source.publisher)),'Reference publisher text missing');
      fs.writeFileSync(path.join(out,`${kind}-${width}-pages.json`),JSON.stringify(pages,null,2));record.widths.push({width,pages:pages.length,pdf: path.basename(pdf),sha256:sha(fs.readFileSync(pdf)),facts});
    }
  }
  assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.unexpectedRequests,[]);receipt.passed=true;
}finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));await browser.close();}
console.log(JSON.stringify({passed:receipt.passed,out,pdfs:15,providerCalls:0}));
