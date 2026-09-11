// Saved-report presentation only. All fixtures are synthetic; no provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const scope={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,scope);const R=scope.window.MondermanReport;
const samples=JSON.parse(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json'),'utf8'));
assert.equal(samples.contract,'monderman-public-product-samples/v2');
const fixtures=Object.entries(samples.outputs).map(([name,entry])=>({name,raw:entry.source,kind:entry.kind==='diagnostic'?'run':'synthesis'}));
assert.equal(fixtures.length,6);
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const state=(recommendations,status='complete')=>({status,message:'Synthetic '+status,report:{model:'synthetic-display-only',composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'},interpretation:{summary:'SAVED_FACTS_ONLY',observations:[{text:'Two submitted runs do not establish two distinct people.'}],recommendations},limitations:['No population conclusion.']}});
const action={action:'Review the recorded approval steps.',reason:'Check the saved responses first.',prerequisite:'Use only the recorded process.',risk:'Do not remove necessary controls.',success_check:'Check the same bounded work.'};
const emptyCases=[undefined,null,[],[null],['not an action'],[{}],[{action:null}],[{action:25}],[{action:''}],[{action:' \t\n '}],[{method:'Method without an action'}]];
const make=(fixture,ai)=>({...R[fixture.kind==='run'?'fromRun':'fromSynthesis'](fixture.raw),aiReport:ai});
const render=(fixture,ai)=>{const model=freeze(make(fixture,ai)),before=JSON.stringify(model),html=R.buildReportHtml(model);assert.equal(JSON.stringify(model),before,'render mutated saved input');return {model,html};};
const nav=html=>html.match(/<div class="mr-screen-shortcuts">([\s\S]*?)<\/div>/)?.[1]||'';
const cover=html=>html.match(/<div class="mr-screen-only mr-screen-next">([\s\S]*?)<\/section>/)?.[1]||'';
let cases=0;
for(const fixture of fixtures){
  for(const recommendations of emptyCases){
    const {html}=render(fixture,state(recommendations));
    assert.match(nav(html),/>Interpretation<\/a>/,fixture.name+' facts-only shortcut must not promise actions');
    assert.doesNotMatch(nav(html),/>Actions<\/a>/);assert.match(cover(html),/Review interpretation/);
    assert.match(cover(html),/Review the interpretation and its limits\./);assert.doesNotMatch(cover(html),/suggested changes|Explore actions/);
    assert.doesNotMatch(html,/<article class="mr-card mr-ai-action/);assert.match(html,/Claude selected reviewed explanations\./);assert.doesNotMatch(html,/Claude selected and prioritized reviewed explanations and next steps/);
    assert.equal((nav(html).match(/<a\b/g)||[]).length,5);cases++;
  }
  for(const recommendations of [[action],[{action:' '},null,action]]){
    const {html}=render(fixture,state(recommendations));
    assert.match(nav(html),/>Actions<\/a>/);assert.match(cover(html),/Explore actions/);assert.match(cover(html),/Review the recorded approval steps\./);
    assert.equal((html.match(/<article class="mr-card mr-ai-action/g)||[]).length,1);assert.match(html,/<h3>1\. Review the recorded approval steps\.<\/h3>/);
    assert.match(html,/Claude selected and prioritized reviewed explanations and next steps/);cases++;
  }
  for(const status of ['pending','processing','attention_required','rejected']){
    const {html}=render(fixture,state([{action:'STALE_UNAPPROVED_ADVICE'}],status));
    assert.doesNotMatch(html,/STALE_UNAPPROVED_ADVICE|Claude selected reviewed/);assert.doesNotMatch(nav(html),/>Interpretation<\/a>/);cases++;
  }
}
const hostile='<img src=x onerror="window.__unsafe=true"> & <script>window.__unsafe=true</script>';
const escaped=render(fixtures[0],state([{...action,action:hostile}]));
assert.doesNotMatch(escaped.html,/<img src=x|<script>window\.__unsafe/);assert.match(escaped.html,/&lt;img/);cases++;
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({passed:true,cases,products:6,providerCalls:0}));process.exit(0);}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-empty-actions-');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],unexpected=[],checks={passed:false,cases,products:6,widths:[],transitions:[],pdfs:[],providerCalls:0};
try{
  const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,match[1]+'font.woff2'))});unexpected.push(route.request().url());return route.abort();});
  const factual=render(fixtures.find(f=>f.kind==='synthesis'),state([])),withAction=render(fixtures[0],state([action]));
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});await page.setContent(factual.html);await page.evaluate(async()=>{await document.fonts.ready;});
    assert.equal(await page.locator('.mr-screen-shortcuts a').count(),5);assert.equal(await page.locator('.mr-screen-shortcuts a').filter({hasText:/^Interpretation$/}).count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.mr-screen-next a').click();assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('mr-ai-interpretation')),true);
    assert.ok(await page.evaluate(()=>document.activeElement.getBoundingClientRect().top>=document.querySelector('.mr-screen-nav').getBoundingClientRect().bottom-1));
    await page.locator('.mr-cover').screenshot({path:path.join(out,`factual-cover-${width}.png`)});checks.widths.push(width);
  }
  for(const [id,item,expected,hasAction] of [['factual',factual,'Claude selected reviewed explanations.',false],['action',withAction,action.action,true],['escaped',escaped,hostile,true]]){
    await page.setContent(item.html);await page.evaluate(async()=>{await document.fonts.ready;});
    assert.equal(await page.locator('.mr-ai-action img,.mr-ai-action script,.mr-screen-next img,.mr-screen-next script').count(),0);assert.equal(await page.evaluate(()=>window.__unsafe),undefined);
    assert.equal(await page.locator('.mr-ai-action').count(),hasAction?1:0);
    const pdf=path.join(out,`${id}.pdf`);await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
    const p=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const pages=JSON.parse(p.stdout),text=pages.join('\n'),norm=t=>t.replace(/\s+/g,'');
    assert.ok(norm(text).includes(norm(expected)));assert.ok(!text.includes('Explore actions')&&!text.includes('Review interpretation'),'screen-only CTA leaked into PDF');
    if(!hasAction)assert.doesNotMatch(text,/Suggested next steps|Changes to test|selected and prioritized reviewed explanations and next steps/);
    fs.writeFileSync(path.join(out,`${id}-pages.json`),JSON.stringify(pages,null,2));checks.pdfs.push({id,pages:pages.length});
  }
  await page.setContent('<!doctype html><html><head></head><body><div id="primary"></div><div id="peer"></div></body></html>');
  await page.addScriptTag({content:source});await page.clock.install({time:new Date('2026-09-10T18:30:00Z')});
  for(const fixture of fixtures)for(const focusedControl of ['guidance','cover','evidence','contents']){
    const initial=await page.evaluate(({fixture,focusedControl})=>{
      const R=MondermanReport,host=document.getElementById('primary'),peer=document.getElementById('peer');
      const base=R[fixture.kind==='run'?'fromRun':'fromSynthesis'](fixture.raw),pending={status:'pending',message:'Synthetic pending.'},complete={status:'complete',report:{composition:{reviewed_version:'report-reviewed-capabilities-20260909.1'},interpretation:{summary:'SAVED_FACTS_ONLY',recommendations:[null,{action:' \n\t '}]}}},model={...base,aiReport:pending},before=JSON.stringify(model);
      R.render(host,model);R.render(peer,model);const result={ai_report:pending},aiId=host.querySelector('.mr-ai-interpretation').id,reportPage=host.querySelector('.mr-page');
      const bodySnapshot=()=>{const clone=reportPage.cloneNode(true);clone.querySelectorAll('.mr-screen-only,.mr-ai-inline,.mr-ai-interpretation').forEach(n=>n.remove());return clone.innerHTML;};
      let calls=0;const stop=R.mountAIInterpretation(host,result,async()=>({ai_report:++calls===1?pending:complete}));
      const nav=host.querySelector('.mr-screen-nav'),contents=nav.querySelector('details');contents.open=true;
      const focused=focusedControl==='guidance'?nav.querySelector('[data-report-link-role="guidance"]'):focusedControl==='cover'?host.querySelector('.mr-screen-next a'):focusedControl==='evidence'?[...nav.querySelectorAll('.mr-screen-shortcuts a')].find(a=>a.textContent==='Evidence'):nav.querySelector('summary');
      focused.focus({preventScroll:true});window.testState={host,peer,model,before,aiId,reportPage,nav,focused,focusedControl,bodySnapshot,bodyBefore:bodySnapshot(),scroll:scrollY,stop,calls:()=>calls};
      return {aiId,shortcuts:nav.querySelectorAll('.mr-screen-shortcuts a').length};
    },{fixture,focusedControl});
    await page.clock.fastForward(15000);
    assert.equal(await page.evaluate(()=>document.activeElement===testState.focused&&testState.host.querySelector('.mr-screen-nav')===testState.nav),true,'unchanged poll disturbed focus');
    await page.clock.fastForward(15000);
    const result=await page.evaluate(()=>{
      const t=testState,nav=t.host.querySelector('.mr-screen-nav'),expected=t.focusedControl==='guidance'?nav.querySelector('[data-report-link-role="guidance"]'):t.focusedControl==='cover'?t.host.querySelector('.mr-screen-next a'):t.focusedControl==='evidence'?[...nav.querySelectorAll('.mr-screen-shortcuts a')].find(a=>a.textContent==='Evidence'):nav.querySelector('summary');t.stop();
      const guidance=nav.querySelector('[data-report-link-role="guidance"]');return {calls:t.calls(),focused:document.activeElement===expected,scrollSame:scrollY===t.scroll,bodySame:t.bodySnapshot()===t.bodyBefore,unmutated:JSON.stringify(t.model)===t.before,peerPending:t.peer.textContent.includes('Synthetic pending.')&&!t.peer.textContent.includes('SAVED_FACTS_ONLY'),contentsOpen:nav.querySelector('details').open,label:guidance.textContent,target:guidance.getAttribute('href'),shortcuts:nav.querySelectorAll('.mr-screen-shortcuts a').length,cards:t.host.querySelectorAll('.mr-ai-action').length,next:t.host.querySelector('.mr-screen-next p').textContent};
    });
    assert.deepEqual(result,{calls:2,focused:true,scrollSame:true,bodySame:true,unmutated:true,peerPending:true,contentsOpen:true,label:'Interpretation',target:'#'+initial.aiId,shortcuts:initial.shortcuts,cards:0,next:'Review the interpretation and its limits.'},fixture.name+'/'+focusedControl);
    checks.transitions.push({product:fixture.name,focusedControl,...result});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);checks.passed=true;
}finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({...checks,errors,unexpected},null,2));}
console.log(JSON.stringify({...checks,transitions:checks.transitions.length,out}));
