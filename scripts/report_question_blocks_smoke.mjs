// Fabricated display fixtures only; not evidence of live AI or source validation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const out=fs.mkdtempSync('/tmp/monderman-question-block-display-');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const question='Are extra reviewers or additional review requirements added after this process has started?';
const context={tool:'decision_velocity',role:'managerial',depth:30,questionnaire_version:'1.1.0'};
const contextText='Decision Velocity · Managers · 30-minute depth · Questionnaire 1.1.0';
const explanation='MOCK: The saved answers differ on added review requirements. A recent request can help clarify what each answer describes.';
function fixture({long=false,subset=false,empty=false}={}){
  const answers=long?[Array.from({length:50},(_,i)=>`MOCK answer sentence ${i+1} checks that long recorded text remains complete.`).join(' '),'Another complete synthetic recorded answer.']:['Rarely','Sometimes'];
  const block={question,context:structuredClone(context),answers:answers.map((answer,index)=>({source_label:'Selected run '+(index?'B':'A'),answer})),selection_scope:subset?'selected_sources':'all_matching_sources'};
  const interpretation_text=empty?'':explanation;
  const text='Question: '+question+'\n'+contextText+'\n'+(subset?'Selected source reports\n':'')+block.answers.map(a=>a.source_label+': “'+a.answer+'”').join('\n')+(interpretation_text?'\n\n'+interpretation_text:'');
  return {synthesis_product:'depth_synthesis',report_kind:'self_run_synthesis',source_mode:'own_saved_runs',source_result_count:2,lens_count:1,participant_count:1,
    score_status:'published',aggregate_score:69,score_label:'Median of your selected scores',source_groups:[],generated_at:'2026-09-12T12:00:00Z',
    ai_report:{status:'complete',report:{version:'MOCK-QUESTION-BLOCK',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-12T12:00:00Z',
      composition:{authorship:'provider_authored_engine_bounded'},sources:[],limitations:[],research_context:{status:'not_started',checked_at:null},
      evidence:answers.map((value,index)=>({id:'F'+(index+1),label:question,value,provenance:'participant_structured_answer',source_ref:'R'+(index+1),source_label:'Selected run '+(index?'B':'A')})),
      source_evidence:{version:'personal-source-evidence-20260912.1',sources:answers.map((_,index)=>({source_ref:'R'+(index+1),label:'Selected run '+(index?'B':'A'),status:'available',...context,fact_ids:['F'+(index+1)]})),
        coverage:{selected_sources:2,available_sources:2,included_sources:2,available_fact_count:2,included_fact_count:2,status:'included',reason:null}},
      evidence_references:{summary:['F1','F2'],summary_sources:[]},
      interpretation:{summary:'MOCK display example using saved answers from one account.',observations:[{text,evidence_ids:['F1','F2'],source_ids:[],evidence_block:block,interpretation_text}],
        hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]}}}};
}
let checks=0;const equal=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const receipt={mockOnly:true,providerCalls:0,databaseWrites:0,rendererSha256:sha(source),screens:[],pdfs:[],rejections:[],errors:[],passed:false};
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();page.on('pageerror',e=>receipt.errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
      receipt.errors.push('Unexpected request '+url.origin+url.pathname);return route.abort();
    });
    const render=async value=>{
      await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:source});
      return page.evaluate(value=>{const before=JSON.stringify(value),html=MondermanReport.buildReportHtml(MondermanReport.fromSynthesis(value));if(before!==JSON.stringify(value))throw Error('Saved source mutated');return html;},value);
    };
    for(const [kind,options]of [['ordinary',{}],['subset',{subset:true}],['no-interpretation',{empty:true}],['long',{long:true}]]){
      const value=fixture(options),html=await render(value),answers=value.ai_report.report.interpretation.observations[0].evidence_block.answers;
      for(const width of [320,390,834,1440]){
        await page.setViewportSize({width,height:1050});await page.emulateMedia({media:'screen'});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
        const block=page.locator('.mr-question-evidence');equal(await block.count(),1,`${name}/${kind}/${width}: exact evidence block missing`);
        equal(await block.locator('.mr-question-text').innerText(),question);
        equal(await block.locator('dt').allTextContents(),['Selected run A','Selected run B']);
        equal(await block.locator('dd').allTextContents(),answers.map(a=>a.answer));
        equal(await page.locator('.mr-question-interpretation').count(),options.empty?0:1);
        equal(await block.locator('.mr-question-subset').count(),options.subset?1:0);
        equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow');
        equal(await block.locator('.mr-question-answer').evaluateAll(nodes=>nodes.every(n=>n.querySelector('dt').getBoundingClientRect().bottom<=n.querySelector('dd').getBoundingClientRect().top+1)),true,'Answer label and text do not overlap');
        if(!options.empty)equal(await page.locator('.mr-question-interpretation').innerText(),explanation);
        const details=page.locator('.mr-evidence-detail').last();await details.locator('summary').focus();await page.keyboard.press('Enter');equal(await details.getAttribute('open')!==null,true);
        if(kind==='ordinary'||kind==='long'&&width===390){const file=path.join(out,`${name}-${kind}-${width}.png`);await page.locator('.mr-finding').screenshot({path:file});receipt.screens.push({name,kind,width,path:file,sha256:sha(fs.readFileSync(file))});}
      }
      if(name==='chromium'&&(kind==='ordinary'||kind==='long')){
        await page.emulateMedia({media:'print'});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
        equal(await page.locator('.mr-question-evidence').isVisible(),true);
        const file=path.join(out,`${kind}.pdf`);await page.pdf({path:file,format:'Letter',preferCSSPageSize:true,printBackground:true});
        const parsed=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import json,sys;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',file],{encoding:'utf8',maxBuffer:8*1024*1024});
        assert.equal(parsed.status,0,parsed.stderr);const pages=JSON.parse(parsed.stdout),compact=t=>t.replace(/\s+/g,''),all=compact(pages.join('\n'));
        assert.ok(pages.every(p=>p.trim()),'No blank pages');checks++;
        for(const text of [question,contextText,...answers.flatMap(a=>[a.source_label,a.answer]),explanation]){assert.ok(all.includes(compact(text)),'PDF lost exact question, answer or interpretation');checks++;}
        const registerPage=pages.find(p=>p.includes('Supporting evidence register'));assert.ok(registerPage&&registerPage.includes('1. '+question.slice(0,24)),'Evidence register heading stays with its first entry');checks++;
        equal(await page.locator('.mr-print-evidence>dl').evaluate(node=>getComputedStyle(node).display),kind==='long'?'block':'grid','Long evidence gets the full print width');
        receipt.pdfs.push({kind,path:file,pages:pages.length,sha256:sha(fs.readFileSync(file)),textPreserved:true});
      }
    }
    await page.emulateMedia({media:'screen'});
    const invalid=[
      ['wrong question',r=>{r.interpretation.observations[0].evidence_block.question='How often is a decision referred to a higher level?';}],
      ['wrong answer',r=>{r.interpretation.observations[0].evidence_block.answers[0].answer='Always';}],
      ['wrong context',r=>{r.interpretation.observations[0].evidence_block.context.depth=10;}],
      ['duplicate source',r=>{r.interpretation.observations[0].evidence_block.answers[1].source_label='Selected run A';}],
      ['wrong citation',r=>{r.interpretation.observations[0].evidence_ids=['F1'];}],
      ['private metadata',r=>{r.interpretation.observations[0].evidence_block.question_id='PRIVATE';}],
      ['rewritten interpretation',r=>{r.interpretation.observations[0].interpretation_text='Changed';}],
      ['no metadata partner',r=>{delete r.interpretation.observations[0].interpretation_text;}],
      ['wrong source graph',r=>{r.source_evidence.sources[0].source_ref='R9';}],
      ['injected source',r=>{r.interpretation.observations[0].evidence_block.answers[0].source_label='<img src=x onerror=alert(1)>'; }],
    ];
    for(const [label,change]of invalid){const value=fixture();change(value.ai_report.report);const text=value.ai_report.report.interpretation.observations[0].text;await page.setContent(await render(value));equal(await page.locator('.mr-question-evidence').count(),0,label);equal(await page.locator('.mr-finding>p:not(.mr-print-support)').textContent(),text,label+' preserves old text');receipt.rejections.push({name,label});}
    const legacy=fixture();delete legacy.ai_report.report.interpretation.observations[0].evidence_block;delete legacy.ai_report.report.interpretation.observations[0].interpretation_text;
    await page.setContent(await render(legacy));equal(await page.locator('.mr-question-evidence').count(),0);equal(await page.locator('.mr-finding>p:not(.mr-print-support)').textContent(),legacy.ai_report.report.interpretation.observations[0].text);
  }finally{await browser.close();}
}
equal(receipt.errors,[]);equal(sha(fs.readFileSync(path.join(root,'monderman-report.js'))),receipt.rendererSha256,'Renderer unchanged throughout tests');
receipt.passed=true;receipt.checks=checks;fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({passed:true,mockOnly:true,checks,screens:receipt.screens.length,pdfs:receipt.pdfs.length,rejections:receipt.rejections.length,out}));
