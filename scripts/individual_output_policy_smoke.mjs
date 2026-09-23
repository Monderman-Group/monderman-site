import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('monderman-report.js','utf8'),context);
const R=context.window.MondermanReport;
const policy={version:'individual-report-action-policy-20260911.1',individual_next_steps_only:true,cohort_action_options:false,preferred_path:false};
let checks=0;
for(const tool of ['structural_clarity','decision_velocity','operational_systems','institutional_performance']){
  const source={tool_type:tool,score:67,band:'Directional',priority_actions:['Check the reported approval delay against operating records.'],interpretive_prose:{remedy_paths:[{label:'Legacy tier retained in historical report',actions:['Legacy action'],summary:'Saved historical interpretation'}]}};
  for(const status of [undefined,'pending','failed']){
    const old={...source,...(status?{ai_report:{status}}:{})},oldBefore=JSON.stringify(old);
    const oldHtml=R.buildReportHtml(R.fromRun(old));assert(oldHtml.includes('Legacy tier retained in historical report'));assert.equal(JSON.stringify(old),oldBefore);checks++;
    const current={...old,output_policy:policy},before=JSON.stringify(current),html=R.buildReportHtml(R.fromRun(current));
    assert(!html.includes('Legacy tier retained in historical report'));assert(html.includes('Priorities and next steps'));assert(html.includes(source.priority_actions[0]));assert.equal(JSON.stringify(current),before);checks++;
  }
  const html=fs.readFileSync(tool.replaceAll('_','-')+'.html','utf8');
  const start=html.indexOf('function individualNextStepsOnly(result) {'),end=html.indexOf('\nfunction ',html.indexOf('function buildRemedyPaths',start)+1);
  assert(start>=0&&end>start);const c=vm.createContext({});vm.runInContext(html.slice(start,end),c);
  assert.equal(c.buildRemedyPaths({...source,output_policy:policy},{}).length,0);assert.equal(c.buildRemedyPaths(source,{}).length,1);
  assert.equal(html.slice(html.lastIndexOf('</html>')+7).trim(),'','No executable text may follow the document');
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).join('\n');
  const renderStart=scripts.indexOf('const remedies = buildRemedyPaths(result, payload);'),renderEnd=scripts.indexOf('\n}\n',renderStart)+2;
  assert(renderStart>=0&&renderEnd>renderStart);
  const renderFragment=scripts.slice(renderStart,renderEnd);
  const checkRemedyDisplay=fragment=>{
    const section={hidden:false},wrap={hidden:false,closest:selector=>{assert.equal(selector,'[data-accordion="remedy"]');return section;}},grid={innerHTML:''};
    const path={label:'Saved option',kicker:'Saved category',summary:'Saved summary',actions:['Saved action'],benefit:'Saved benefit',risk:'Saved risk'};
    // Reuse the same display nodes: current policy, empty legacy list, genuine
    // legacy content and a later empty render must not leave a stale heading.
    for(const [result,expectedHidden] of [
      [{...source,output_policy:policy},true],
      [{...source,interpretive_prose:{remedy_paths:[]}},true],
      [{...source,interpretive_prose:{remedy_paths:[path]}},false],
      [{...source,output_policy:{...policy,version:'unknown-policy'},interpretive_prose:{remedy_paths:[path]}},false],
      [{...source,output_policy:policy},true],
    ]){
      const before=JSON.stringify(result);
      vm.runInNewContext(fragment,{$:id=>id==='remedyTreeWrap'?wrap:grid,result,payload:{},buildRemedyPaths:c.buildRemedyPaths,individualNextStepsOnly:c.individualNextStepsOnly,escapeHtml:s=>s});
      assert.equal(wrap.hidden,expectedHidden);assert.equal(section.hidden,expectedHidden,'The whole empty/remedy accordion, including its button, must be hidden');
      assert.equal(grid.innerHTML.length>0,!expectedHidden);assert.equal(JSON.stringify(result),before);checks+=4;
    }
  };
  checkRemedyDisplay(renderFragment);
  for(const [before,after] of [
    ['if (remedySection) remedySection.hidden = individualNextStepsOnly(result) || remedies.length === 0;',''],
    ['if (remedySection) remedySection.hidden = individualNextStepsOnly(result) || remedies.length === 0;','if (remedySection) remedySection.hidden = individualNextStepsOnly(result);'],
  ]){const bad=renderFragment.replace(before,after);assert.notEqual(bad,renderFragment);assert.throws(()=>checkRemedyDisplay(bad));checks++;}
  const footer=html.match(/const bottomDisclaimer = "([^"]+)";/)?.[1];
  assert.equal(footer,'This report describes the answers supplied for one run. It does not estimate organizational savings, recoverable time, or financial returns.');checks++;
  assert.doesNotMatch(html,/class="accordion-sub">[^<]*(?:modeled exposure|cost of drag)/);checks++;
  const priorityCell=html.match(/`<td>\$\{escapeHtml\(row\.priority[^\n]+/g);
  assert.equal(priorityCell?.length,1);
  for(const [priority,label]of [['Fix now','Review first'],['Fix next','Review next'],['Monitor','Monitor'],['Fix now pending','Fix now pending'],['constructor','constructor'],[null,'Priority']]){
    const row={priority,focus:'UNCHANGED',severity:31,pct:40},before=JSON.stringify(row);
    const output=vm.runInNewContext(priorityCell[0].replace(/,$/,''),{row,escapeHtml:String});
    assert.equal(output,'<td>'+label+'</td>');assert.equal(JSON.stringify(row),before);checks+=2;
  }
  // Current exports unconditionally use the shared policy projection, including
  // legacy results without an AI sidecar. Exercise the actual three handlers.
  const handlers=['exportExecutiveReport','exportFullReportHTML','downloadExecutiveReportPdf'].map(name=>{
    const match=scripts.match(new RegExp('(?:async )?function '+name+'\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}'));
    assert(match,'Actual export handler missing: '+name);return match[0];
  });
  for(const aiStatus of [undefined,'complete','failed']){
    const raw={...source,...(aiStatus?{ai_report:{status:aiStatus}}:{})},before=JSON.stringify(raw),calls=[],toasts=[];
    const shared={fromRun:value=>{assert.equal(value,raw);calls.push('project');return {exact:value};},downloadHtml:model=>{assert.equal(model.exact,raw);calls.push('html');},downloadPdf:model=>{assert.equal(model.exact,raw);calls.push('pdf');}};
    const c=vm.createContext({window:{MondermanReport:shared},state:{result:raw},showToast:message=>toasts.push(message)});
    vm.runInContext(handlers.join('\n'),c);
    c.exportExecutiveReport(raw,{});c.exportFullReportHTML(raw,{});await c.downloadExecutiveReportPdf();
    assert.deepEqual(calls,['project','html','project','html','project','pdf']);assert.equal(JSON.stringify(raw),before);assert.equal(toasts.length,0);checks+=3;
    calls.length=0;assert.equal((await c.downloadExecutiveReportPdf({returnBlob:true})).error,'legacy_pdf_export_unavailable');assert.equal(calls.length,0);checks+=2;
    c.window.MondermanReport=null;c.exportExecutiveReport(raw,{});c.exportFullReportHTML(raw,{});await c.downloadExecutiveReportPdf();
    assert.equal(toasts.length,3);assert.equal(calls.length,0);checks+=2;
  }
}
// Execute the native visualization's actual function with a tiny SVG recorder.
// This verifies both visual and accessible labels without a browser or network.
const viz=fs.readFileSync('monderman-viz.js','utf8');
const priorityStart=viz.indexOf('  function priorityPath(el, data) {'),priorityEnd=viz.indexOf('\n  /*',priorityStart);
assert(priorityStart>=0&&priorityEnd>priorityStart);
const priorityFunction=viz.slice(priorityStart,priorityEnd);
const checkPriorityDisplay=fn=>{
  for(const suppliedPriorities of [true,false]){
    const texts=[],attributes={},rows=[];
    const steps=[{label:'Saved focus A',priority:'Fix now',severity:31},{label:'Saved focus B',priority:'Fix next',severity:21},{label:'Saved focus C',priority:'Monitor',severity:0}],before=JSON.stringify(steps);
    const ctx=vm.createContext({T:{},mount:()=>({setAttribute:(k,v)=>attributes[k]=v}),S:()=>({}),txt:(_p,x,y,text,options)=>texts.push({x,y,text,options}),num:Number,compactRows:(_svg,value)=>rows.push(...value)});
    vm.runInContext(fn,ctx);ctx.priorityPath({}, {steps,suppliedPriorities});
    assert.deepEqual(texts.filter(t=>t.options.spacing==='.11em').map(t=>t.text),suppliedPriorities?['REVIEW FIRST','REVIEW NEXT','MONITOR']:['FIX NOW','FIX NEXT','MONITOR']);
    assert.equal(JSON.stringify(steps),before);checks+=2;
    if(suppliedPriorities){
      assert.equal(attributes['aria-label'],'Suggested review order. 1. Review first: Saved focus A. 2. Review next: Saved focus B. 3. Monitor: Saved focus C');
      assert.deepEqual(rows.map(r=>r.label),['1. Review first: Saved focus A','2. Review next: Saved focus B','3. Monitor: Saved focus C']);
      assert.deepEqual(rows.map(r=>r.value),['Difficulty 31','Difficulty 21','Difficulty 0']);checks+=3;
    }
  }
};
checkPriorityDisplay(priorityFunction);
for(const [from,to]of [
  ['"Fix now": "Review first"','"Fix now": "FIX NOW"'],
  ['? allowedPriorities[s.priority] : "Priority"','? s.priority : "Priority"'],
  ['? allowedPriorities[s.priority] : "Priority"','? "Review first" : "Priority"'],
]){const bad=priorityFunction.replace(from,to);assert.notEqual(bad,priorityFunction);assert.throws(()=>checkPriorityDisplay(bad));checks++;}
for(const report_kind of ['self_run_synthesis','self_run_response_comparison']){
  const source={report_kind,source_mode:'own_saved_runs',synthesis_product:'cross_lens_synthesis',score_status:'withheld',submitted_run_count:3,lens_count:3,source_groups:[{tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:1,median_score:72}],priority_actions:[],participant_count_note:'All selected runs are from one account.'};
  const model=R.fromSynthesis(source),html=R.buildReportHtml(model);
  assert(model.selfRun);assert.equal(model.comparisonOnly,report_kind==='self_run_response_comparison');
  assert(html.includes('Your saved runs, considered together'));assert(html.includes('Your recorded views'));assert(!html.includes('Distribution at a glance'));assert(!html.includes('Results by participant perspective'));checks+=4;
}
for(const tool_type of ['decision_velocity','structural_clarity','operational_systems','institutional_performance']){
  const original={tool_type,score:70,generated_at:'2020-01-02T00:00:00Z'},before=JSON.stringify(original),model=R.fromRun(original);
  assert.equal(model.meta.find(row=>row.label==='Recorded').value,'January 2, 2020');assert.equal(JSON.stringify(original),before);
  assert.equal(R.fromRun({tool_type,score:70}).meta.find(row=>row.label==='Recorded').value,'Not recorded');checks+=3;
}
const incompatible={report_kind:'self_run_synthesis',source_mode:'own_saved_runs',synthesis_product:'depth_synthesis',score_status:'withheld',generated_at:'2020-01-02T00:00:00Z',source_groups:[{tool_label:'Decision Velocity',submitted_runs:2,median_score:55,modal_driver_pattern:'approval_density'}]};
const incompatibleModel=R.fromSynthesis(incompatible),incompatibleHtml=R.buildReportHtml(incompatibleModel);
assert.equal(incompatibleModel.meta.find(row=>row.label==='Recorded').value,'January 2, 2020');
assert(!incompatibleHtml.includes('approval_density'));assert(incompatibleHtml.includes('Not shown: compatible measurements are required'));checks+=3;
const personal=R.fromSynthesis({...incompatible,score_status:'published',cross_diagnostic_score:90,condition_band:'Strong observed condition',score_label:'Median of your selected scores',source_groups:[{tool_label:'Decision Velocity',submitted_runs:2,median_score:90}]});
assert.equal(personal.headlineBand,'Your selected scores only');assert(!R.buildReportHtml(personal).includes('Strong observed condition'));checks+=2;
const checkSelfRunBands=renderer=>{
  for(const report_kind of ['self_run_synthesis','self_run_response_comparison'])for(const score_status of ['published','withheld']){
    const source={...incompatible,report_kind,score_status,cross_diagnostic_score:90,condition_band:'Strong observed condition',score_label:'Median of your selected scores'},before=JSON.stringify(source);
    const model=renderer.fromSynthesis(source),html=renderer.buildReportHtml(model);
    assert.equal(model.headlineBand,score_status==='published'?'Your selected scores only':'No combined score');
    assert(!html.includes('Strong observed condition'),'No organizational band anywhere in a self-run document');
    const overview=html.match(/data-report-link-role="overview-findings"[\s\S]*?<\/a>/)?.[0];
    assert(overview?.includes(model.headlineBand),'Overview preserves the same self-run qualification as the complete report');
    assert.equal(JSON.stringify(source),before);checks+=4;
  }
};
checkSelfRunBands(R);
const currentRenderer=fs.readFileSync('monderman-report.js','utf8'),wrongBand=currentRenderer.replace("m.kind === 'run' || m.selfRun ? firstStr(m.headlineBand) : firstStr(m.conditionBand)","m.kind === 'run' ? firstStr(m.headlineBand) : firstStr(m.conditionBand)");
assert.notEqual(wrongBand,currentRenderer);const wrongContext={window:{}};vm.runInNewContext(wrongBand,wrongContext);
assert.throws(()=>checkSelfRunBands(wrongContext.window.MondermanReport));checks++;
const workspace=fs.readFileSync('workspace-diagnostics.html','utf8'),actions=workspace.slice(workspace.indexOf('    function actionsFor(r){'),workspace.indexOf('    function runRowHTML(r){'));
for(const role of ['admin','analyst','member']){const context=vm.createContext({state:{role}});vm.runInContext(actions,context);for(const status of ['staged','promoted','archived']){const html=context.actionsFor({id:'r',status});if(role==='member')assert.equal(html,'');if(role==='analyst'){assert(!/Archive|Restore|Remove from analysis/.test(html));assert.equal(html.includes('Review & include'),status==='staged');}if(role==='admin')assert(html.length>0);checks++;}}
console.log(`PASS individual output policy: ${checks} actual renderer/native helper checks. New individual fallback paths preserve next steps and withhold cohort tiers; historical measurements/dates unchanged; self-run reports explicitly one-account; staff actions match server authority.`);
