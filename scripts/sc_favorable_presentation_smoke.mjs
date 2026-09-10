// Offline presentation regression. This is a synthetic scored run, not a
// live customer journey or an approval of model-generated report text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const browsers=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.SC_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const root=path.resolve(import.meta.dirname,'..');
const out=process.env.SC_PRESENTATION_OUT||('/tmp/sc-favorable-presentation'+(engine==='webkit'?'/webkit':''));
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'structural-clarity.html'),'utf8');
const dv=fs.readFileSync(path.join(root,'decision-velocity.html'),'utf8');
const viz=fs.readFileSync(path.join(root,'monderman-viz.js'),'utf8');
const renderer=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'test-fixtures/sc-favorable-presentation.json')));
assert.equal(fixture.syntheticOnly,true);assert.equal(fixture.paidCalls,0);
const run=fixture.rendererInput.value,unchanged=JSON.stringify(run);
assert.equal(run.score,92);assert.equal(run.canonical_composition,undefined);
assert.deepEqual(run.canonical_descriptor.priority_ladder.map(s=>s.priority),['Monitor','Monitor','Monitor']);
function block(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const helpers=block('function getBurdenCompositionPattern(', 'function applyCompositionConsistency(');
const draw=block('function renderShareBar(', 'function renderBurdenDonut(');
const flow=block('function renderEffortFlow(', '\nfunction ');
const operational=block('function getOperationalDimensions(', '\nfunction ');
const context={asObject:v=>v&&typeof v==='object'?v:{}};
vm.runInNewContext(helpers+operational+'\nglobalThis.getPattern=getBurdenCompositionPattern;globalThis.getAxes=getOperationalDimensions;',context);
const pattern=JSON.parse(JSON.stringify(context.getPattern(run)));
assert.deepEqual(JSON.parse(JSON.stringify(context.getAxes(run))),{role:9,decision_rights:8,handoff:8,accountability:8,governance:8});
assert.deepEqual(pattern.segments.map(s=>s.value),[9,8,8,8,8]);
assert.deepEqual(pattern.segments.map(s=>s.pct),[22,20,20,20,18]);
assert.deepEqual(pattern.segments.map(s=>s.key),run.canonical_descriptor.composition.segments.map(s=>s.key));
assert.equal(pattern.total,41);
assert.equal(JSON.stringify(run),unchanged,'Display must not mutate saved results');
const legacy={canonical_composition:{segments:[{key:'role',label:'Role clarity',value:12,pct:100}],total:12,dominant:{label:'Role clarity',value:12,pct:100},dominant_pct:100,shape:'concentrated'}};
assert.equal(context.getPattern(legacy).segments[0].value,12);
const bare=context.getPattern({burden_breakdown:{role:9,decision_rights:8,handoff:7,accountability:6,governance:5,approval:99}});
assert.deepEqual(Array.from(bare.segments,s=>s.label),['Role clarity','Decision rights clarity','Handoff integrity','Accountability clarity','Governance proportionality']);
assert.ok(!bare.segments.some(s=>s.value===99),'DV fallback axis leaked into SC');
assert.match(dv,/Higher values show more reported difficulty with approvals, coordination, handoffs, escalation, repeated work, or reliance on key people\./);
assert.match(dv,/higher overall scores mean stronger decision velocity/);
assert.doesNotMatch(dv,/Higher values indicate stronger decision velocity/);
assert.match(source,/Modeled annual hours as a share of the stated annual participant capacity/);
assert.match(source,/This is not observed or guaranteed savings/);
assert.doesNotMatch(source,/Recoverable ambiguity cost\*|Legibility recovery potential\*|Compensation hours\*/);
const zero=structuredClone(run);zero.canonical_descriptor.composition.segments.forEach(s=>{s.weakness=0;s.pct=0;});zero.canonical_descriptor.priority_ladder=[];
const missing={canonical_descriptor:{composition:{segments:[]},priority_ladder:[]}};
const evidence={scope:'Offline synthetic SC92 charts and full HTML; Chromium also prints PDF. Not live E2E or AI approval',browser:engine,hashes:Object.fromEntries([['page',source],['viz',viz],['renderer',renderer],['fixture',unchanged]].map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')])),widths:[],errors:[],passed:false};
const browser=await browsers[engine].launch({headless:true});
const browserContext=await browser.newContext(),page=await browserContext.newPage();
page.on('pageerror',e=>evidence.errors.push(e.message));
await browserContext.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(u.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,u.pathname.slice(1)))});
 evidence.errors.push('Unexpected network: '+u.origin+u.pathname);return route.abort();
});
async function checkBounds(label){const invalid=await page.evaluate(()=>[...document.querySelectorAll('svg text')].filter(e=>{const b=e.getBBox(),v=e.ownerSVGElement.viewBox.baseVal;return b.width>0&&(b.x<-.5||b.x+b.width>v.width+.5||b.y<-.5||b.y+b.height>v.height+.5)}).map(e=>e.textContent));assert.deepEqual(invalid,[],label+' SVG clipping');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' page overflow');}
try{
 // Only active document-head styles, not CSS inside old export JS strings.
 const styles=[...source.slice(0,source.indexOf('</head>')).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const font='@font-face{font-family:"Neue Haas Grotesk";src:url(https://www.monderman.com/55font.woff2);font-weight:400}@font-face{font-family:"Neue Haas Grotesk";src:url(https://www.monderman.com/65font.woff2);font-weight:500}@font-face{font-family:"Neue Haas Grotesk";src:url(https://www.monderman.com/75font.woff2);font-weight:700}';
 await page.setContent('<html><head><style>'+font+styles+'</style></head><body><main style="max-width:1120px;padding:24px;margin:auto;font-family:Neue Haas Grotesk,sans-serif"><div class="viz-card"><h4>Reported difficulty by dimension</h4><div id="severityDotsMount"></div></div><div class="viz-card"><h4>Difficulty indicator distribution</h4><div id="shareBarMount"></div></div><div class="viz-card"><h4>Suggested review order</h4><div id="priorityPathMount"></div></div></main></body></html>');
 await page.evaluate(()=>{const card=document.createElement('div');card.className='viz-card';card.innerHTML='<h4>Modeled capacity context</h4><div id="effortFlowSankey"></div>';document.querySelector('main').appendChild(card)});
 await page.addScriptTag({content:viz});await page.addScriptTag({content:'function asObject(v){return v&&typeof v==="object"?v:{}}\n'+helpers+draw+flow});
 await page.evaluate(r=>{renderShareBar(r);renderSeverityDots(r);renderPriorityPath(r);renderEffortFlow(r)},run);
 assert.equal(await page.locator('#severityDotsMount svg').count(),1);assert.equal(await page.locator('#shareBarMount svg').count(),1);
 assert.deepEqual(await page.locator('#priorityPathMount svg text').allTextContents(),['1','MONITOR','Role clarity','difficulty 9','2','MONITOR','Decision rights','clarity','difficulty 8','3','MONITOR','Handoff integrity','difficulty 8']);
 assert.equal(await page.locator('#shareBarMount svg').getAttribute('aria-label'),'Difficulty indicator distribution');
 assert.equal(await page.locator('#severityDotsMount svg').getAttribute('aria-label'),'Reported difficulty by dimension');
 assert.equal(await page.locator('#effortFlowSankey .mvg-scenario').getAttribute('aria-label'),'Published time and cost scenario','Rounded 0% must not hide published nonzero modeled amounts');
 assert.match(await page.locator('#effortFlowSankey').innerText(),/Modeled annual time/);
 assert.doesNotMatch(await page.locator('#effortFlowSankey').innerText(),/Modeled share:|Role clarity|Decision rights|Remaining capacity/,'Scores must not allocate time or dollars');
 assert.doesNotMatch(await page.locator('main').innerText(),/FIX NOW|FIX NEXT|total burden|STRAINED|SEVERE/);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready});await checkBounds('SC charts '+width);if(width===390){assert.equal(await page.locator('.mvg-compact:visible').count(),3);assert.equal(await page.locator('.mvg-scenario:visible').count(),1);assert.ok(await page.locator('.mvg-compact-row span').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=14));}await page.screenshot({path:path.join(out,'charts-'+width+'.png'),fullPage:true});}
 await page.evaluate(r=>{renderShareBar(r);renderSeverityDots(r);renderPriorityPath(r)},zero);
 assert.equal(await page.locator('#shareBarMount').textContent(),'No reported difficulty to distribute.');
 assert.equal(await page.locator('#severityDotsMount svg').count(),1,'Measured zero indicators must remain visible');
 assert.equal(await page.locator('#priorityPathMount svg').count(),0,'No stale priorities');
 await page.evaluate(r=>{renderShareBar(r);renderSeverityDots(r);renderPriorityPath(r);renderEffortFlow(r)},missing);
 assert.equal(await page.locator('main svg').count(),0,'No stale charts or missing-as-zero');
 await page.evaluate(()=>MViz.priorityPath('priorityPathMount',{steps:[{label:'Unknown priority',severity:3,priority:'constructor'}],suppliedPriorities:true}));
 assert.match(await page.locator('#priorityPathMount').textContent(),/PRIORITY 1/);
 await page.evaluate(()=>MViz.priorityPath('priorityPathMount',{steps:[{label:'A',severity:30},{label:'B',severity:20},{label:'C',severity:10}]}));
 assert.deepEqual(await page.locator('#priorityPathMount svg text').allTextContents(),['1','FIX NOW','A','severity 30','2','FIX NEXT','B','severity 20','3','MONITOR','C','severity 10']);
 await page.addScriptTag({content:renderer});
 const html=await page.evaluate(r=>MondermanReport.buildReportHtml(MondermanReport.fromRun(r)),run);
 assert.match(html,/Clarity indicator distribution/);assert.match(html,/Review order and clarity indicators/);assert.match(html,/Monitoring priorities/);
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.setContent(html);await page.evaluate(async()=>{await document.fonts.ready});
  assert.equal(await page.locator('.mr-report-boundary').count(),1,'Exactly one final boundary must remain');
  assert.equal(await page.locator('.mr-run-close-group > .mr-report-boundary').count(),1,'Closing and boundary must be one print unit');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Full report overflow '+width);
  await page.screenshot({path:path.join(out,'full-'+width+'.png'),fullPage:true});evidence.widths.push(width);
 }
 if(engine==='chromium'){
 const expectedBoundary=(await page.locator('.mr-report-boundary p:last-child').innerText()).replace(/\s+/g,' ').trim();
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,'report.pdf'),format:'Letter',preferCSSPageSize:true,printBackground:true});
 const pdf=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',path.join(out,'report.pdf')],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(pdf.status,0,pdf.stderr);
 const pages=JSON.parse(pdf.stdout).map(t=>t.replace(/\s+/g,' ').trim());assert.ok(pages.length>1&&pages.length<40);assert.ok(pages.every(t=>t.length>20));
 assert.match(pages.join('\n'),/Clarity indicator distribution/i);assert.match(pages.join('\n'),/Monitoring priorities/i);
 assert.equal(pages.filter(t=>/Monitoring priorities and options/i.test(t)).length,1);
 assert.ok(pages.some(t=>/Monitoring priorities and options/i.test(t)&&/Review order and clarity indicators/i.test(t)),'Priority introduction separated from its chart');
 assert.doesNotMatch(pages.join('\n'),/Who has the authority to change|Name one accountable owner for Role|suggests issues to investigate/);
 assert.match(pages.at(-1),/Next decision/i,'Interpretation boundary orphaned on a separate page');
 assert.ok(pages.at(-1).includes(expectedBoundary),'Final interpretation boundary is missing or split');
 fs.writeFileSync(path.join(out,'pages.json'),JSON.stringify(pages,null,2));evidence.pdfPages=pages.length;
 }
 assert.equal(JSON.stringify(run),unchanged);assert.deepEqual(evidence.errors,[]);evidence.passed=true;console.log(JSON.stringify(evidence));
}finally{fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));await browser.close();}
