// Synthetic display-only checks. No provider, customer data or PDF generation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'monderman-report.js'),source=fs.readFileSync(file,'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex'),out=fs.mkdtempSync('/tmp/monderman-shared-action-conditions-');
const sourceHash=sha(source),sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);const Report=sandbox.window.MondermanReport;
const prerequisite='The responsible owner approves the review and access to relevant material. Process or control changes need separate approval.';
const risk='Use authorized work examples without personal details. Stop if the review exceeds its agreed scope.';
const makeActions=()=>[1,2,3].map(i=>({action:'MOCK next step '+i+'. Review the supplied work example.',reason:'MOCK reason '+i+'. This example supports a bounded check.',prerequisite,risk,success_check:'MOCK distinct success check '+i+'. Record what the example establishes.',evidence_ids:['F1'],source_ids:[]}));
function fixture(actions,{legacy=false,options=false}={}){
  return {tool_type:'operational_systems',score:61,score_band:'Moderate',process_name:'Synthetic display example',generated_at:'2026-09-13T00:00:00Z',
    ai_report:{status:'complete',report:{version:'MOCK-DISPLAY-ONLY',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-13T00:00:00Z',
      composition:legacy?{reviewed_version:'report-reviewed-capabilities-20260909.1'}:{authorship:'provider_authored_engine_bounded'},
      evidence:[{id:'F1',label:'Synthetic recorded value',value:61}],sources:[],limitations:[],research_context:{status:'not_started'},
      interpretation:{summary:'MOCK layout example, not a customer report.',observations:[],hypotheses:[],recommendations:actions,
        action_options:options?makeActions().map((a,i)=>({...a,option_id:'O'+i,intensity:['limited','moderate','structural'][i]})):[],recommended_option:null,limitations:[]}}}};
}
const cases=[];
function add(name,change=()=>{},shared=[],options={}){const actions=makeActions();change(actions);cases.push({name,value:fixture(actions,options),shared,legacy:Boolean(options.legacy)});}
add('all-shared',()=>{},['prerequisite','risk'],{options:true});
add('prerequisite-only',a=>a.forEach((x,i)=>x.risk+=' Distinct '+i),['prerequisite']);
add('risk-only',a=>a.forEach((x,i)=>x.prerequisite+=' Distinct '+i),['risk']);
add('mixed',a=>a.forEach((x,i)=>{x.prerequisite+=' '+i;x.risk+=' '+i;}));
add('missing',a=>{delete a[1].prerequisite;a[1].risk=null;});
add('single',a=>a.splice(1));
add('empty',a=>a.splice(0));
add('blank',a=>a.forEach(x=>{x.prerequisite=' ';x.risk='';}));
add('whitespace-and-case',a=>{a[1].prerequisite+=' ';a[2].risk=risk.toLowerCase();});
add('html-escaping',a=>a.forEach(x=>{x.prerequisite='<img id="condition-injection" src=x onerror="window.conditionInjected=true"> & "approval"';x.risk='<script>window.conditionInjected=true</script>'; }),['prerequisite','risk']);
add('long',a=>a.forEach(x=>{x.prerequisite='MOCK long condition. '.repeat(150);x.risk='MOCK long risk. '.repeat(120);}),['prerequisite','risk']);
add('legacy',()=>{},[],{legacy:true});
let assertions=0;const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
equal(Report.rendererVersion,'diagnostic-renderer-evidence-reading-20260913.32');
for(const row of cases){const before=JSON.stringify(row.value);row.html=Report.buildReportHtml(Report.fromRun(row.value));equal(JSON.stringify(row.value),before,'Saved input unchanged');}
// Exact rendered .30 baselines independently captured from committed SITE
// a91f72d97691779281615b0630f6454b0cdd2c7e. No historical Git checkout is needed in CI.
const legacy=cases.find(c=>c.legacy).value.ai_report;
equal(sha(Report.buildAIInterpretation(legacy)),'d8c5268946d1ad73add35d9d15a54cc5f369b3061ac04bb4dbbf1ac40c287166','Historical path byte-identical');
const withOptions=cases[0].value.ai_report,optionMarkup=html=>html.match(/<div class="mr-report-options">([\s\S]*?)<\/div><p class="mr-not-yet">/)[1];
equal(sha(optionMarkup(Report.buildAIInterpretation(withOptions))),'3aaa1e8e0ed0ab6bb167c1c09df84788c4c1d75e221c421c65de0a8bdea2ed91','Action options byte-identical');
const receipt={mockOnly:true,rendererSha256:sourceHash,layouts:[],screens:[],errors:[],providerCalls:0,pdfs:0,passed:false};
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{const page=await browser.newPage();page.on('pageerror',e=>receipt.errors.push(e.message));
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(u.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,u.pathname.slice(1)))});receipt.errors.push('Unexpected request '+u.origin+u.pathname);return route.abort();});
    for(const row of cases)for(const width of [390,834,1440])for(const media of ['screen','print']){
      await page.setViewportSize({width,height:1000});await page.emulateMedia({media});await page.setContent(row.html);await page.evaluate(()=>document.fonts.ready);
      const actions=row.value.ai_report.report.interpretation.recommendations,section=page.locator(row.legacy?'.mr-ai-actions':'.mr-report-nextsteps');
      const shared=page.locator('.mr-shared-action-conditions');equal(await shared.count(),row.shared.length?1:0,row.name);
      if(row.shared.length){equal(await shared.isVisible(),true,'Shared conditions visible '+media);equal(await shared.locator('h4').textContent(),'For all next steps');equal(await shared.locator('dd').allTextContents(),row.shared.map(key=>actions[0][key]));equal(await shared.locator('details').count(),0);}
      const cards=section.locator('.mr-ai-action');equal(await cards.count(),actions.length);
      for(const [i,a]of actions.entries()){
        const expected=['prerequisite','risk','success_check'].filter(key=>!row.shared.includes(key)&&(row.legacy||a[key])).map(key=>a[key]??'');
        equal(await cards.nth(i).locator('dd').allTextContents(),expected,row.name+' retains local conditions and success check');
      }
      equal(await page.locator('#condition-injection').count(),0);equal(await page.evaluate(()=>Boolean(window.conditionInjected)),false);
      if(media==='screen')equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow');
      const overlap=await section.locator('.mr-ai-definition').evaluateAll(nodes=>nodes.some(n=>n.querySelector('dt').getBoundingClientRect().bottom>n.querySelector('dd').getBoundingClientRect().top+1));equal(overlap,false,'Condition labels do not overlap text');
      if(row.name==='all-shared'&&media==='screen'&&width===390){const png=path.join(out,name+'-shared-390.png');await section.screenshot({path:png});receipt.screens.push({path:png,sha256:sha(fs.readFileSync(png))});}
      receipt.layouts.push({engine:name,case:row.name,width,media,sharedConditions:row.shared.length});
    }
  }finally{await browser.close();}
}
equal(receipt.errors,[]);equal(sha(fs.readFileSync(file)),sourceHash,'Renderer remained frozen');receipt.passed=true;receipt.assertions=assertions;
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({passed:true,assertions,layouts:receipt.layouts.length,screens:receipt.screens.length,pdfs:0,providerCalls:0,out}));
