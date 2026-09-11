// Focused deterministic and browser display regression; no model or customer calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source=fs.readFileSync('monderman-report.js','utf8');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);
const report=sandbox.window.MondermanReport;
assert.equal(report.rendererVersion,'diagnostic-renderer-evidence-reading-20260911.26');
const base=()=>({synthesis_product:'cross_lens_synthesis',score_status:'withheld',cross_diagnostic_score:null,
  condition_band:'Composite withheld',respondent_count:2,lens_count:2,
  source_groups:[{tool_type:'structural_clarity',tool_label:'Structural Clarity',respondents:1,mean_score:60,median_score:60,score_iqr:[60,60]},
    {tool_type:'decision_velocity',tool_label:'Decision Velocity',respondents:1,mean_score:70,median_score:70,score_iqr:[70,70]}],
  priority_actions:[{label:'decision_velocity depth',text:'Review the submitted decision record.'}]});
const encode=x=>JSON.stringify(x,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v);
function render(raw,adapter='fromSynthesis'){
  const before=encode(raw),model=report[adapter](raw),html=report.buildReportHtml(model);
  assert.equal(encode(raw),before,'adapter/render must not modify saved input');
  return {model,html};
}
let deterministic=0;
for(const tool of ['depth_synthesis','cross_lens_synthesis']){
  const raw={...base(),synthesis_product:tool,submitted_run_count:2,source_result_count:2,participant_count:null,respondent_count:null,
    source_groups:base().source_groups.map(g=>({...g,submitted_runs:1,participants:null,respondents:null})),
    evidence_assessment:{evidence_label:tool==='depth_synthesis'?'Limited':'Comparison Only',source_identity:{status:'verified',statement:'Source run IDs recorded.'}}};
  const {model,html}=render(raw);
  assert.equal(model.reads,2);assert.deepEqual(Array.from(model.sourceGroups,g=>g.n),[1,1]);
  assert.match(html,/Counts refer to submitted runs, not verified distinct people/);
  assert.match(html,/Source-run identity/);
  assert.doesNotMatch(html,/participant volume|regardless of participant count|Participant depth governs/);
  if(tool==='cross_lens_synthesis'){
    assert.match(html,/regardless of submitted run count/);
    assert.match(html,/Submitted run counts affect evidence coverage, not lens weight/);
    assert.match(html,/do not establish how many distinct people responded/);
    deterministic+=3;
  }
  if(tool==='depth_synthesis')assert.match(html,/mr-evidence-step is-active[^>]*><span><\/span><b>Limited/);
  deterministic+=6;
}
for(const [key,title] of Object.entries({structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'})){
  const raw=base();raw.priority_actions[0].label=key+' depth';
  const {model,html}=render(raw);assert.equal(model.actions[0].label,title+' coverage');assert.ok(html.includes(title+' coverage'));assert.ok(!html.includes(key+' depth'));deterministic++;
}
for(const label of ['decision_velocity depth extra','Decision Velocity depth','custom depth','toString','<script>private</script>']){
  const raw=base();raw.priority_actions[0].label=label;
  const {model,html}=render(raw);assert.equal(model.actions[0].label,label);assert.ok(!html.includes('<script>private</script>'));deterministic++;
}
for(const [status,score,expected] of [['published',65,true],['published',0,true],['published',65.5,true],['published','65',true],['withheld',65,false],['published',null,false],['published',undefined,false],['published','',false],['published',NaN,false],['published',Infinity,false],['published','not measured',false]]){
  const raw=base();raw.score_status=status;raw.cross_diagnostic_score=score;
  const {html}=render(raw);
  assert.equal(html.includes('The dashed Composite line is the equal-lens mean.'),expected,`${status}/${score}: caption`);
  assert.equal(html.includes('stroke-dasharray="5 4"'),expected,`${status}/${score}: actual line`);
  deterministic++;
}
for(const score of [0,42,83.5,100]){
  const {model,html}=render({tool_type:'institutional_performance',score,band:'Recorded'},'fromRun');
  assert.equal(model.headlineScore,score);assert.ok(html.includes(`<div class="mr-cover-score">${score}</div>`));deterministic++;
}
const cases=[{id:'withheld',...render(base())},{id:'published',...render({...base(),score_status:'published',cross_diagnostic_score:65})},
  {id:'diagnostic',...render({tool_type:'institutional_performance',score:42,band:'Recorded'},'fromRun')}];
assert.ok(cases[0].html.includes('<div class="mr-cover-score mr-cover-score-status">Unavailable</div>'));
assert.match(source,/\.mr-cover-score\{[^}]*font-size:4\.6rem;line-height:\.82;[^}]*letter-spacing:-\.07em/);
assert.match(source,/\.mr-cover-score\{font-size:3\.8rem\}/);
deterministic+=3;
if(process.argv.includes('--deterministic-only')){
  console.log(JSON.stringify({passed:true,deterministicCases:deterministic,providerCalls:0,networkCalls:0}));process.exit(0);
}
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-synthesis-display-');
fs.mkdirSync(out,{recursive:true});
const records=[],errors=[],network=[];
for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{
    for(const width of [320,390,768,1440])for(const item of cases){
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      page.on('pageerror',e=>errors.push({engine,width,id:item.id,error:e.message}));
      await page.route('**/*',route=>{
        const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());
        if(match)return route.fulfill({status:200,contentType:'font/woff2',body:fs.readFileSync(path.resolve(match[1]+'font.woff2'))});
        network.push(route.request().url());return route.abort();
      });
      await page.setContent(item.html,{waitUntil:'networkidle'});
      await page.evaluate(async()=>{await document.fonts.ready;});
      assert.ok(await page.evaluate(()=>document.fonts.check('16px "Neue Haas Grotesk"')),'candidate font required');
      for(const media of ['screen','print']){
        await page.emulateMedia({media});
        const measured=await page.evaluate(()=>{
          const row=document.querySelector('.mr-cover-score-row'),r=row.getBoundingClientRect();
          const values=[...row.children].map(el=>{const b=el.getBoundingClientRect(),c=getComputedStyle(el);return {class:el.className,text:el.textContent,x:b.x,right:b.right,width:b.width,client:el.clientWidth,scroll:el.scrollWidth,fontSize:parseFloat(c.fontSize),lineHeight:parseFloat(c.lineHeight),letterSpacing:parseFloat(c.letterSpacing),minWidth:c.minWidth};});
          return {row:{x:r.x,right:r.right,width:r.width,client:row.clientWidth,scroll:row.scrollWidth},values,rootSize:parseFloat(getComputedStyle(document.documentElement).fontSize),caption:[...document.querySelectorAll('.mr-viz-panel')].find(el=>el.textContent.includes('Diagnostic lenses on one scale'))?.textContent||''};
        });
        const state=`${engine}/${width}/${item.id}/${media}`;
        assert.ok(measured.row.scroll<=measured.row.client+1,`${state}: row overflow`);
        for(const value of measured.values){
          assert.ok(value.x>=measured.row.x-1&&value.right<=measured.row.right+1,`${state}: child outside score row`);
          assert.ok(value.scroll<=value.client+1,`${state}: child text overflow`);
        }
        const numericScale=media==='screen'?(width<=760?3:3.6):(width<=760?3.8:4.6);
        const numericSize=measured.rootSize*numericScale,score=measured.values[0];
        if(item.id==='withheld'){
          const statusSize=Math.max(measured.rootSize*1.7,Math.min(width*.045,measured.rootSize*2.7));
          assert.ok(score.class.includes('mr-cover-score-status'));
          assert.ok(Math.abs(score.fontSize-statusSize)<.02,`${state}: compact status clamp changed`);
          assert.ok(score.fontSize<numericSize,`${state}: status text must be smaller than the current numeric scale`);
          assert.ok(Math.abs(score.lineHeight-statusSize*1.04)<.02,`${state}: status line height changed`);
          assert.ok(Math.abs(score.letterSpacing-statusSize*-.035)<.02,`${state}: status spacing changed`);
          assert.ok(!measured.caption.includes('dashed Composite'));
        }else{
          assert.ok(!score.class.includes('mr-cover-score-status'));
          assert.ok(Math.abs(score.fontSize-numericSize)<.02,`${state}: ${media} numeric scale changed`);
          assert.ok(Math.abs(score.lineHeight-numericSize*(media==='screen'?.95:.82))<.02,`${state}: numeric line height changed`);
          assert.ok(Math.abs(score.letterSpacing-numericSize*(media==='screen'?-.055:-.07))<.02,`${state}: numeric spacing changed`);
          if(item.id==='published')assert.ok(measured.caption.includes('dashed Composite'));
        }
        if(width<=760)assert.equal(measured.values[1].minWidth,'0px');
        const suffix=media==='screen'?'':`-${media}`;
        await page.locator('.mr-cover').screenshot({path:path.join(out,`${engine}-${width}-${item.id}${suffix}-cover.png`)});
        records.push({engine,width,id:item.id,media,...measured});
      }
      await page.close();
    }
  }finally{await browser.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(network,[],'all non-font network is forbidden');
const result={passed:true,deterministicCases:deterministic,browserStates:records.length,records,errors,networkAttempts:network,providerCalls:0};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,deterministicCases:deterministic,browserStates:records.length,output:out,providerCalls:0,networkCalls:0}));
