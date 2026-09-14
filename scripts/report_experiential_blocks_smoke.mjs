// Fabricated display fixtures only: no provider, approval claim or public sample rewrite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'monderman-report.js');
const source=fs.readFileSync(file,'utf8'),out=fs.mkdtempSync('/tmp/monderman-experience-block-display-');
const sha=value=>createHash('sha256').update(value).digest('hex');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);const Report=sandbox.window.MondermanReport;
const roles={operational:'People doing the work',managerial:'Managers',executive:'Senior leaders',senior_leader:'Senior leaders',not_specified:'Role not specified',authorized_workspace_staff:'Authorized workspace staff'};
const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
const account='MOCK: Corrections can mean updating both places. Some requests may need approval or sign-off.\nA different request can move without another review.';
const reading='MOCK: Compare a recent request with this participant’s account before deciding what needs investigation.';
const format=(block,interpretation='')=>'Participant account · '+roles[block.role]+' · '+lenses[block.lens]+'\nScope: '+block.scope_label+'\n“'+block.text+'”'+(interpretation?'\n\n'+interpretation:'');
function fixture({kind='ordinary',empty=false,long=false,escaped=false}={}){
  const note=long?Array.from({length:32},(_,i)=>`MOCK sentence ${i+1}: review or sign-off may be needed for this request.`).join('\n'):escaped?'<img id="account-injection" src=x onerror="window.injected=true"> & "quoted"\n<script>window.injected=true</script>':account;
  assert.ok(note.length<=2400);
  const record={id:'X1',role:'managerial',lens:'operational_systems',scope_label:escaped?'MOCK <scope> & "work"':'MOCK request handling',text:note};
  const {id,...fields}=record,block={version:'experiential-prose-block-20260913.1',...fields},interpretation_text=empty?'':reading;
  const report={version:'MOCK-EXPERIENCE-BLOCK',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-13T00:00:00Z',
    composition:{authorship:'provider_authored_engine_bounded'},sources:[],limitations:[],research_context:{status:'not_started'},
    evidence:[{id:'F1',label:'Synthetic score',value:61,provenance:'deterministic_result'}],
    experiential_evidence:[record,{id:'F2',role:'managerial',lens:'operational_systems',scope_label:'Participant observation',text:note}],
    evidence_references:{summary:['F1'],summary_sources:[]},
    interpretation:{summary:'MOCK layout example, not a customer report.',observations:[{text:format(block,interpretation_text),evidence_ids:['F1','X1'],source_ids:[],experiential_block:block,interpretation_text}],hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]}};
  const value={tool_type:'operational_systems',score:61,score_band:'Moderate',process_name:'Synthetic display example',generated_at:'2026-09-13T00:00:00Z',ai_report:{status:'complete',report}};
  if(kind!=='ordinary')Object.assign(value,{synthesis_product:kind==='campaign'?'cross_lens_synthesis':'depth_synthesis',report_kind:kind==='campaign'?'campaign_synthesis':'self_run_synthesis',source_mode:kind==='campaign'?'campaign':'own_saved_runs',source_result_count:2,lens_count:1,participant_count:kind==='campaign'?8:1,score_status:'published',aggregate_score:61,score_label:'Synthetic score',source_groups:[]});
  return value;
}
let checks=0;const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const render=value=>{const before=JSON.stringify(value),model=value.synthesis_product?Report.fromSynthesis(value):Report.fromRun(value),html=Report.buildReportHtml(model);equal(JSON.stringify(value),before,'Source input unchanged');return html;};
equal(Report.rendererVersion,'diagnostic-renderer-evidence-reading-20260914.43');
const cases=[['ordinary',{}],['no-interpretation',{empty:true}],['long',{long:true}],['escaped',{escaped:true}],['campaign',{kind:'campaign'}],['personal',{kind:'personal'}]]
  .map(([name,options])=>{const value=fixture(options);return {name,options,value,html:render(value)};});
const invalid=[
  ['wrong account',r=>{r.interpretation.observations[0].experiential_block.text='Shortened account';}],
  ['wrong role',r=>{r.interpretation.observations[0].experiential_block.role='operational';}],
  ['wrong lens',r=>{r.interpretation.observations[0].experiential_block.lens='decision_velocity';}],
  ['wrong scope',r=>{r.interpretation.observations[0].experiential_block.scope_label='Other scope';}],
  ['unknown version',r=>{r.interpretation.observations[0].experiential_block.version='other';}],
  ['private block metadata',r=>{r.interpretation.observations[0].experiential_block.id='X1';}],
  ['private source metadata',r=>{r.experiential_evidence[0].email='PRIVATE';}],
  ['missing partner',r=>{delete r.interpretation.observations[0].interpretation_text;}],
  ['changed interpretation',r=>{r.interpretation.observations[0].interpretation_text='Changed';}],
  ['changed saved text',r=>{r.interpretation.observations[0].text='Saved legacy text remains unchanged.';}],
  ['missing source',r=>{r.experiential_evidence=[];}],
  ['missing citation',r=>{r.interpretation.observations[0].evidence_ids=['F1'];}],
  ['duplicate citation',r=>{r.interpretation.observations[0].evidence_ids=['X1','X1'];}],
  ['unknown citation',r=>{r.interpretation.observations[0].evidence_ids=['X1','F99'];}],
  ['duplicate source',r=>{r.experiential_evidence.push({...r.experiential_evidence[0]});}],
  ['two cited accounts',r=>{r.experiential_evidence.push({...r.experiential_evidence[0],id:'X2'});r.interpretation.observations[0].evidence_ids.push('X2');}],
  ['uncanonicalized alias',r=>{r.interpretation.observations[0].evidence_ids.push('F2');}],
  ['alias only',r=>{r.interpretation.observations[0].evidence_ids=['F2'];}],
  ['mixed block kinds',r=>{r.interpretation.observations[0].evidence_block={};}],
  ['invalid role',r=>{r.experiential_evidence[0].role=r.interpretation.observations[0].experiential_block.role='invented';}],
  ['oversized account',r=>{r.experiential_evidence[0].text=r.interpretation.observations[0].experiential_block.text='x'.repeat(2401);}],
  ['oversized scope',r=>{r.experiential_evidence[0].scope_label=r.interpretation.observations[0].experiential_block.scope_label='x'.repeat(201);}],
  ['oversized reading',r=>{r.interpretation.observations[0].interpretation_text='x'.repeat(901);}],
  ['untrimmed account',r=>{r.experiential_evidence[0].text=r.interpretation.observations[0].experiential_block.text=' '+account;}],
];
const negative=invalid.map(([name,change])=>{const value=fixture();change(value.ai_report.report);return {name,text:value.ai_report.report.interpretation.observations[0].text,html:render(value)};});
const legacy=fixture();delete legacy.ai_report.report.interpretation.observations[0].experiential_block;delete legacy.ai_report.report.interpretation.observations[0].interpretation_text;
negative.push({name:'legacy text-only',text:legacy.ai_report.report.interpretation.observations[0].text,html:render(legacy)});
const hypothesis=fixture(),observation=hypothesis.ai_report.report.interpretation.observations.pop();hypothesis.ai_report.report.interpretation.hypotheses.push(observation);
negative.push({name:'hypothesis not an observation block',text:observation.text,html:render(hypothesis)});
for(const role of Object.keys(roles))for(const lens of Object.keys(lenses)){
  const value=fixture(),report=value.ai_report.report,row=report.interpretation.observations[0];
  Object.assign(row.experiential_block,{role,lens});Object.assign(report.experiential_evidence[0],{role,lens});row.text=format(row.experiential_block,row.interpretation_text);
  assert.ok(render(value).includes('class="mr-experience-evidence"'));checks++;
}
const receipt={mockOnly:true,providerCalls:0,databaseWrites:0,rendererSha256:sha(source),layouts:[],screens:[],pdfs:[],errors:[],passed:false};
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{const page=await browser.newPage();page.on('pageerror',e=>receipt.errors.push(e.message));
    await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(u.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,u.pathname.slice(1)))});receipt.errors.push('Unexpected request '+u.origin+u.pathname);return route.abort();});
    for(const row of cases){
      const item=row.value.ai_report.report.interpretation.observations[0],account=item.experiential_block;
      for(const width of [320,390,834,1440])for(const media of ['screen','print']){
        await page.setViewportSize({width,height:1050});await page.emulateMedia({media});await page.setContent(row.html);await page.evaluate(()=>document.fonts.ready);
        const block=page.locator('.mr-experience-evidence');equal(await block.count(),1,`${name}/${row.name}/${width}/${media}`);equal(await block.isVisible(),true);
        equal(await block.locator('.mr-experience-label').textContent(),'Reported experience');
        equal(await block.locator('.mr-reading-context').textContent(),roles[account.role]+' · '+lenses[account.lens]);
        equal(await block.locator('.mr-experience-scope').textContent(),'Scope: '+account.scope_label);
        equal(await block.locator('blockquote').textContent(),'“'+account.text+'”','Full exact account including line breaks');
        equal(await page.locator('.mr-experience-interpretation').count(),row.options.empty?0:1);
        if(!row.options.empty)equal(await page.locator('.mr-experience-interpretation').textContent(),reading);
        equal(await block.locator('details').count(),0,'Account remains visible without an accordion');
        equal(await page.locator('#account-injection').count(),0);equal(await page.evaluate(()=>Boolean(window.injected)),false);
        equal(await block.evaluate(node=>{const children=[...node.children];return children.every((x,i)=>!i||children[i-1].getBoundingClientRect().bottom<=x.getBoundingClientRect().top+1);}),true,'Labels and quote do not overlap');
        if(!row.options.empty)equal(await page.locator('.mr-finding').first().evaluate(node=>node.querySelector('.mr-experience-evidence').getBoundingClientRect().bottom<=node.querySelector('.mr-experience-interpretation').getBoundingClientRect().top),true,'Account and authored reading remain separate');
        if(media==='screen')equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow');
        if(media==='screen'&&row.name==='ordinary'){
          const details=page.locator('.mr-evidence-detail').last();await details.locator('summary').focus();await page.keyboard.press('Enter');equal(await details.getAttribute('open')!==null,true,'Supporting evidence keyboard access retained');await page.keyboard.press('Enter');
          await page.locator('.mr-finding').first().evaluate(node=>window.scrollBy(0,node.getBoundingClientRect().top-120));
          const png=path.join(out,`${name}-${row.name}-${width}.png`);await page.locator('.mr-finding').first().screenshot({path:png});receipt.screens.push({path:png,sha256:sha(fs.readFileSync(png))});
        }
        receipt.layouts.push({engine:name,case:row.name,width,media});
      }
      if(name==='chromium'&&['ordinary','long'].includes(row.name)){
        await page.emulateMedia({media:'print'});await page.setContent(row.html);await page.evaluate(()=>document.fonts.ready);
        const pdf=path.join(out,row.name+'.pdf');await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
        const parsed=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8',maxBuffer:8*1024*1024});
        assert.equal(parsed.status,0,parsed.stderr);const pages=JSON.parse(parsed.stdout),compact=t=>t.replace(/\s+/g,''),all=compact(pages.join('\n'));
        assert.ok(pages.every(p=>p.trim()),'No blank pages');checks++;
        for(const text of ['Reported experience',roles[account.role]+' · '+lenses[account.lens],'Scope: '+account.scope_label,account.text,reading]){assert.ok(all.includes(compact(text)),'PDF lost exact account/context/reading');checks++;}
        const blockPage=pages.find(p=>p.includes('Reported experience'));assert.ok(blockPage&&compact(blockPage).includes(compact(account.text.slice(0,65))),'Label stays with account start');checks++;
        receipt.pdfs.push({path:pdf,kind:row.name,pages:pages.length,sha256:sha(fs.readFileSync(pdf)),textPreserved:true});
      }
    }
    await page.emulateMedia({media:'screen'});
    for(const row of negative){await page.setContent(row.html);equal(await page.locator('.mr-experience-evidence,.mr-question-evidence').count(),0,row.name);equal(await page.locator('.mr-finding>p:not(.mr-print-support)').textContent(),row.text,row.name+' keeps saved prose');}
  }finally{await browser.close();}
}
equal(receipt.errors,[]);equal(sha(fs.readFileSync(file)),receipt.rendererSha256,'Renderer unchanged throughout tests');receipt.checks=checks;receipt.passed=true;
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({passed:true,mockOnly:true,checks,layouts:receipt.layouts.length,screens:receipt.screens.length,pdfs:receipt.pdfs.length,out}));
