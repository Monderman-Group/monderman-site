import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {chromium,webkit} from 'playwright';
const base=process.env.SAMPLE_BASE||'http://127.0.0.1:8784';
const out=process.env.SAMPLE_OUT||'/tmp/monderman-inclusion-review';
await mkdir(out,{recursive:true});
const digest='a'.repeat(64), run={id:'test-run',tool_label:'Decision Velocity'};
let renders=0;
for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch();
  for(const width of [320,390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await page.goto(base+'/campaign-analysis.css');
    await page.evaluate(()=>{document.body.innerHTML='<button id="launch">Review response</button>';document.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1">';});
    for(const previously_excluded of [false,true]){
      await page.evaluate(async({base,run,digest,previously_excluded})=>{const {confirmRunInclusion}=await import(base+'/run-inclusion-review.js');document.getElementById('launch').focus();window.reviewResolved=false;window.reviewPromise=confirmRunInclusion({run,preview:{review_digest:digest,previously_excluded,normalization:{normalization_flags_json:[{detail:'Unusual answers require context; disagreement alone is not an error.'}]}}}).then(result=>{window.reviewResolved=true;window.reviewResult=result;});},{base,run,digest,previously_excluded});
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      assert(await page.getByRole('textbox',{name:'Reason for including this response'}).evaluate(el=>el===document.activeElement));
      assert.equal(await dialog.getByRole('checkbox').count(),previously_excluded?1:0);
      await page.getByRole('button',{name:'Include and record review'}).click();
      assert.equal(await page.evaluate(()=>window.reviewResolved),false,'empty reason cannot apply');
      await page.getByRole('textbox').fill('Checked the saved response and confirmed it belongs in this analysis.');
      if(previously_excluded){await page.getByRole('button',{name:'Include and record review'}).click();assert.equal(await page.evaluate(()=>window.reviewResolved),false);await dialog.getByRole('checkbox').focus();await page.keyboard.press('Space');}
      assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog content overflow');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
      await page.screenshot({path:path.join(out,`${engineName}-${width}-${previously_excluded?'reinclusion':'inclusion'}.png`)});
      await page.getByRole('button',{name:'Include and record review'}).click();
      const result=await page.evaluate(async()=>{await window.reviewPromise;return window.reviewResult;});
      assert.equal(result.review_digest,digest);assert.equal(result.acknowledge_prior_exclusion,previously_excluded);assert(result.review_reason.length>=5);
      assert(await page.locator('#launch').evaluate(el=>el===document.activeElement),'focus restored');renders++;
    }
    await page.evaluate(async({base,run,digest})=>{const {confirmRunInclusion}=await import(base+'/run-inclusion-review.js');window.cancelPromise=confirmRunInclusion({run,preview:{review_digest:digest}});},{base,run,digest});
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.cancelPromise),null);
    assert.deepEqual(errors,[]);await page.close();
  }
  await browser.close();
}
const html=await readFile(new URL('../workspace-diagnostics.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('    const inclusionInFlight = new Set();'),html.indexOf('    function reserveWorkspaceReportWindow(){'));
assert(source.includes('async function setStatus'));
let routes=0;
for(const scenario of ['confirm','cancel','organization_changed','stale','preview_failed','session_expired']){
  const calls=[],record={...run,status:'staged',score:72},state={orgId:'org-one',runs:[record]};
  let resolveReview;const dialogPromise=new Promise(resolve=>resolveReview=resolve);
  const ctx=vm.createContext({Set,JSON,encodeURIComponent,state,API_BASE:'https://mock.invalid',render(){},flash(){},
    confirmRunInclusion:async()=>dialogPromise,
    supabase:{auth:{getSession:async()=>({data:{session:scenario==='session_expired'?null:{access_token:'mock'}}})}},
    fetch:async(url,options)=>{calls.push({url,options});const preview=options.method==='POST';const bad=preview?scenario==='preview_failed':scenario==='stale';return {ok:!bad,status:bad?409:200,json:async()=>bad?{ok:false,error:'Evidence changed'}:preview?{ok:true,review_digest:digest,previously_excluded:false}:{ok:true,run:{normalization_status:'included',included_in_aggregates:true}}};}});
  vm.runInContext(source,ctx);
  const first=ctx.setStatus(run.id,'promoted'),duplicate=ctx.setStatus(run.id,'promoted');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(record.status,'staged','read-only preview changed status');assert.equal(record.score,72);
  assert.equal(calls.filter(x=>x.options.method==='PATCH').length,0,'mutation before explicit decision');
  if(scenario==='organization_changed')state.orgId='org-two';
  resolveReview(scenario==='cancel'?null:{review_digest:digest,review_reason:'Reviewed original response',acknowledge_prior_exclusion:false});
  await Promise.all([first,duplicate]);
  const patches=calls.filter(x=>x.options.method==='PATCH');
  assert.equal(patches.length,['confirm','stale'].includes(scenario)?1:0,'duplicate or unauthorized write');
  if(patches.length)assert.equal(JSON.parse(patches[0].options.body).review_digest,digest);
  assert.equal(record.status,scenario==='confirm'?'promoted':'staged');assert.equal(record.score,72);routes++;
}
console.log(JSON.stringify({ok:true,renders,inlineHandlerScenarios:routes,productionCalls:0,checks:'Actual dialog in Chromium/WebKit at four widths; keyboard, required reason, explicit exclusion override, focus recovery, cancel. Actual inline handler with mocked session/API tests doubletap, cancel, scope changes, stale evidence and failures. No live authorization or database mutation tested here.'}));
