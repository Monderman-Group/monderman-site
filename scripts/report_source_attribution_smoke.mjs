// Public synthetic renderer regression only. No private engine, AI, DB or PDF.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
const rendererPath=process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js');
const renderer=fs.readFileSync(rendererPath,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const screenshotArgument=process.argv.find(value=>value.startsWith('--screenshot-dir='));
const screenshotDirectory=screenshotArgument?path.resolve(screenshotArgument.slice('--screenshot-dir='.length)):null;
if(screenshotArgument){
  assert.ok(screenshotArgument.slice('--screenshot-dir='.length).trim(),'A fresh screenshot directory is required');
  // Optional local visual evidence only; never replace earlier receipts/images.
  fs.mkdirSync(screenshotDirectory,{recursive:false,mode:0o700});
}
let assertions=0;const layouts=[],negativeCases=[],errors=[],network=[],screenshots=[];
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);assertions++;};
globalThis.fetch=()=>{throw Error('External fetch is forbidden in this synthetic renderer test');};
const first='Selected run A · Decision Velocity · Perspective: Managers · 30-minute depth';
const second='Selected run B · Operational Systems · Perspective: People doing the work · 10-minute depth';
const fixture=()=>({synthesis_product:'cross_lens_synthesis',report_kind:'self_run_synthesis',score_status:'withheld',
  source_mode:'own_saved_runs',source_result_count:2,lens_count:2,participant_count:1,readiness_label:'One account’s selected runs',
  score_label:'No combined score',participant_count_note:'MOCK: Both selected runs belong to one account; they are not independent participants.',
  source_groups:[
    {tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:1,mean_score:61,median_score:61,config_versions:['1.0.0']},
    {tool_type:'operational_systems',tool_label:'Operational Systems',submitted_runs:1,mean_score:68,median_score:68,config_versions:['1.0.0']},
  ],
  generated_at:'2026-09-12T12:00:00Z',ai_report:{status:'complete',report:{
    version:'MOCK-SOURCE-ATTRIBUTION',model:'MOCK-NO-PROVIDER',generated_at:'2026-09-12T12:00:00Z',
    composition:{authorship:'provider_authored_engine_bounded'},sources:[],
    evidence:[
      {id:'F1',label:'Synthetic question: Is ownership clear?',value:'Usually clear',provenance:'participant_structured_answer',source_ref:'R1',source_label:'Selected run A',interpretation:'PRIVATE-INSTRUCTION-MUST-NOT-RENDER'},
      {id:'F2',label:'Synthetic question: Is ownership clear?',value:'Sometimes unclear',provenance:'participant_structured_answer',source_ref:'R2',source_label:'Selected run B'},
      {id:'F3',label:'Synthetic selected-score value',value:61,provenance:'deterministic_sample_summary'},
    ],
    source_evidence:{version:'personal-source-evidence-20260912.1',
      coverage:{selected_sources:2,available_sources:2,included_sources:2,available_fact_count:2,included_fact_count:2,status:'included',reason:null},
      sources:[
        {source_ref:'R1',label:'Selected run A',status:'available',tool:'decision_velocity',role:'managerial',depth:30,sector:'other',questionnaire_version:'1.0.0',fact_ids:['F1']},
        {source_ref:'R2',label:'Selected run B',status:'available',tool:'operational_systems',role:'operational',depth:10,sector:'other',questionnaire_version:'1.0.0',fact_ids:['F2']},
      ]},
    evidence_references:{summary:['F1','F2']},
    interpretation:{summary:'MOCK: Two different answers from selected saved reports. This is a synthetic display fixture, not an AI-quality claim.',
      observations:[{text:'MOCK: This is a recorded value, not a population estimate.',evidence_ids:['F3','F1'],source_ids:[]}],
      hypotheses:[],recommendations:[],action_options:[],recommended_option:null,limitations:[]},
  }}});
const variants=[
  ['unknown channel version',r=>{r.source_evidence.version='unknown';}],
  ['wrong source label',r=>{r.source_evidence.sources[0].label='Selected run B';}],
  ['duplicate source reference',r=>{r.source_evidence.sources[1].source_ref='R1';}],
  ['duplicate fact within source',r=>{r.source_evidence.sources[0].fact_ids.push('F1');}],
  ['fact assigned to both sources',r=>{r.source_evidence.sources[1].fact_ids=['F1'];}],
  ['wrong evidence reference',r=>{r.evidence[0].source_ref='R2';}],
  ['wrong evidence label',r=>{r.evidence[0].source_label='Selected run B';}],
  ['missing evidence attribution',r=>{delete r.evidence[0].source_ref;}],
  ['wrong perspective',r=>{r.source_evidence.sources[0].role='administrator';}],
  ['wrong depth type',r=>{r.source_evidence.sources[0].depth='30';}],
  ['wrong diagnostic',r=>{r.source_evidence.sources[0].tool='other';}],
  ['missing source fact',r=>{r.source_evidence.sources[0].fact_ids=['F9'];}],
  ['opaque fact ID',r=>{r.source_evidence.sources[0].fact_ids=['10000000-0000-4000-8000-000000000001'];}],
  ['wrong fact provenance',r=>{r.evidence[0].provenance='one_participant_untrusted_observation';}],
  ['duplicate evidence row',r=>{r.evidence.push({...r.evidence[0]});}],
  ['unavailable source carrying facts',r=>{r.source_evidence.sources[0].status='unavailable';r.source_evidence.sources[0].reason='not_recorded';}],
  ['source label injection',r=>{r.source_evidence.sources[0].label='<img src=x onerror="window.attributionInjection=true">';}],
  ['prototype-name diagnostic',r=>{r.source_evidence.sources[0].tool='constructor';}],
];

for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();
    page.on('pageerror',error=>errors.push({engineName,message:error.message}));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))
        return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,url.pathname.slice(1)))});
      network.push(url.origin+url.pathname);return route.abort();
    });
    const render=async raw=>{
      await page.setContent('<!doctype html><html><body></body></html>');
      await page.addScriptTag({content:renderer});
      return page.evaluate(raw=>{
        const before=JSON.stringify(raw),html=MondermanReport.buildReportHtml(MondermanReport.fromSynthesis(raw));
        if(JSON.stringify(raw)!==before)throw Error('Renderer changed saved input');return html;
      },raw);
    };
    const raw=fixture(),before=JSON.stringify(raw),html=await render(raw);
    eq(JSON.stringify(raw),before,'Saved synthetic fixture stays unchanged');
    eq(html.includes('PRIVATE-INSTRUCTION-MUST-NOT-RENDER'),false,'Model instructions stay private');
    eq(await page.evaluate(raw=>{const model=MondermanReport.fromSynthesis(raw);return {selfRun:model.selfRun,runs:model.reads,lenses:model.lensCount};},raw),
      {selfRun:true,runs:2,lenses:2},'The synthetic full-page fixture exercises the actual personal saved-run branch');
    eq(html.includes('When the Coherent or Strong evidence threshold is met'),false,'Personal reports do not use the historical population/composite method');
    const personalBoundary='All selected runs belong to one account. This report supports reflection and further checks, not population conclusions, a Cross-Lens Composite Score, combined savings or an organization-wide preferred action.';
    const personalMethod='Review each original report before interpreting a difference. Compare scores only when the diagnostic version, operating scope, perspective and measurement window are compatible. A difference between your answers is not evidence of disagreement between people or a measured organizational trend.';
    for(const reportKind of ['self_run_synthesis','self_run_response_comparison']){
      const withheld=fixture();withheld.report_kind=reportKind;delete withheld.score_label;
      await page.setContent(await render(withheld));
      eq(await page.locator('.mr-cover-score').textContent(),'Your comparison','Both personal products retain a useful cover when no score is published');
      eq(await page.locator('.mr-cover-score-label').textContent(),'No combined score','A missing source label cannot turn a withheld personal score into a Composite claim');
      eq(await page.locator('.mr-cover-boundary p').textContent(),personalBoundary,'Full personal scope remains on the cover');
      eq(await page.locator('.mr-report-boundary').count(),0,'Only the duplicate personal closing boundary is omitted');
    }
    const median=fixture();Object.assign(median,{synthesis_product:'depth_synthesis',score_status:'published',aggregate_score:69,
      score_label:'Median of your selected scores',lens_count:1,source_groups:[{tool_type:'decision_velocity',tool_label:'Decision Velocity',submitted_runs:2,mean_score:69,median_score:69,config_versions:['1.0.0']}]});
    await page.setContent(await render(median));
    eq(await page.locator('.mr-cover-score').textContent(),'69','Published personal median stays numeric');
    eq(await page.locator('.mr-cover-score-label').textContent(),'Median of your selected scores','Published personal median keeps its explicit scope label');
    eq(await page.locator('.mr-cover-score-band').textContent(),'Your selected scores only','Personal median is not recast as a population score');
    const campaign=fixture();delete campaign.source_mode;delete campaign.ai_report;campaign.report_kind='response_comparison';
    await page.setContent(await render(campaign));
    eq(await page.locator('.mr-cover-score').textContent(),'Unavailable','Non-personal withheld cover is unchanged');
    eq(await page.locator('.mr-cover-boundary').count(),1,'Non-personal cover boundary is unchanged');
    eq(await page.locator('.mr-report-boundary').count(),1,'Non-personal closing boundary is unchanged');
    for(const width of [390,834,1440]){
      await page.setViewportSize({width,height:1000});await page.setContent(html);await page.emulateMedia({media:'screen'});await page.evaluate(()=>document.fonts.ready);
      eq(await page.locator('.mr-cover-score').textContent(),'Your comparison','A usable personal comparison is not labelled unavailable');
      eq(await page.locator('.mr-cover-score-label').textContent(),'No combined score','Withheld personal score remains explicit');
      eq(await page.locator('.mr-cover-score-band').textContent(),'','No duplicated no-score subtitle');
      eq(await page.locator('.mr-cover-sub').textContent(),'A comparison of your own recorded views.','Subtitle does not repeat the full boundary');
      eq(await page.locator('.mr-report-boundary').count(),0,'Personal closing boundary is not repeated');
      eq(await page.locator('.mr-cover-boundary p').textContent(),personalBoundary,'The full cover interpretation boundary is preserved');
      eq(await page.locator('.mr-ai-interpretation').innerText().then(text=>text.includes(raw.ai_report.report.interpretation.summary)),true,'Actual interpretation text is unchanged');
      const details=page.locator('.mr-evidence-detail').first();await details.locator('summary').focus();await page.keyboard.press('Enter');
      eq(await details.getAttribute('open')!==null,true,'Evidence remains keyboard accessible');
      eq(await details.locator('.mr-evidence-attribution').allTextContents(),[first,second],'Screen labels identify each selected report');
      eq(await details.locator('.mr-evidence-entry p').allTextContents(),['Usually clear','Sometimes unclear'],'Identical questions keep distinct saved answers');
      eq(await page.locator('.mr-print-evidence').isVisible(),false,'Print register stays out of screen view');
      eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No screen horizontal overflow');
      eq(await details.locator('.mr-evidence-attribution').evaluateAll(nodes=>nodes.every(n=>{const a=n.getBoundingClientRect(),b=n.nextElementSibling.getBoundingClientRect();return a.width>0&&a.bottom<=b.top+1&&a.right<=innerWidth+1;})),true,'Wrapped labels do not overlap question text');
      layouts.push({engine:engineName,width,media:'screen',sourceLabels:true,keyboard:true,overflow:false});
      if(screenshotDirectory&&[390,1440].includes(width)){
        for(const [view,target]of [['report',page],['evidence',details]]){
          const screenshotPath=path.join(screenshotDirectory,`MOCK-source-attribution-${engineName}-${width}-${view}.png`);
          const bytes=await target.screenshot({path:screenshotPath,...(view==='report'?{fullPage:true}:{})});
          screenshots.push({engine:engineName,width,view,path:screenshotPath,sha256:sha(bytes),mockOnly:true});
        }
      }
      await page.emulateMedia({media:'print'});
      eq(await page.locator('.mr-cover-boundary').isVisible(),true,'Personal scope boundary remains visible in print');
      eq(await page.locator('.mr-cover-boundary p').textContent(),personalBoundary,'Print preserves every personal scope limitation');
      eq(await page.locator('.mr-section').allTextContents().then(sections=>sections.some(text=>text.includes(personalMethod))),true,'Personal comparison methods remain intact in print');
      const register=page.locator('.mr-print-evidence');
      eq(await register.isVisible(),true,'Print evidence register is visible');
      eq(await register.locator('.mr-evidence-attribution').allTextContents(),[first,second],'Print register preserves the same attribution');
      eq(await register.locator('dt strong').allTextContents(),['1. Synthetic question: Is ownership clear?','2. Synthetic question: Is ownership clear?','3. Synthetic selected-score value'],'Print numbering/deduplication preserved');
      eq(await page.locator('.mr-evidence-detail').first().isVisible(),false,'Print does not duplicate screen evidence');
      eq(await register.locator('.mr-evidence-attribution').evaluateAll(nodes=>nodes.every(n=>{const a=n.getBoundingClientRect(),b=n.nextElementSibling.getBoundingClientRect();return a.bottom<=b.top+1&&a.right<=n.closest('.mr-evidence-entry').getBoundingClientRect().right+1;})),true,'Print attribution remains contained');
      layouts.push({engine:engineName,width,media:'print',sourceLabels:true,numbering:true,contained:true});
    }
    await page.emulateMedia({media:'screen'});
    for(const [label,mutate]of variants){
      const value=fixture();mutate(value.ai_report.report);const rendered=await render(value);
      eq(rendered.includes('<span class="mr-evidence-attribution">'),false,label+' must not invent attribution');
      await page.setContent(rendered);
      eq(await page.evaluate(()=>Boolean(window.attributionInjection)),false,'Metadata cannot execute script');
      negativeCases.push({engine:engineName,label,rejected:true});
    }
    const legacy=fixture();delete legacy.ai_report.report.source_evidence;
    const legacyHtml=await render(legacy);
    eq(legacyHtml.includes('<span class="mr-evidence-attribution">'),false,'Legacy rows do not gain invented sources');
    eq(legacyHtml.includes('Usually clear'),true,'Legacy answer display is preserved');
    const unavailable=fixture();
    unavailable.ai_report.report.source_evidence.sources[0]={source_ref:'R1',label:'Selected run A',status:'unavailable',reason:'not_recorded'};
    const partialHtml=await render(unavailable);await page.setContent(partialHtml);
    eq(await page.locator('.mr-print-evidence .mr-evidence-attribution').allTextContents(),[second],'Missing detail never shifts the remaining source label');
    const escaped=fixture();escaped.ai_report.report.evidence[0].label='<img src=x onerror="window.attributionInjection=true">';
    escaped.ai_report.report.evidence[0].value='<script>window.attributionInjection=true</script>';
    escaped.ai_report.report.source_evidence.sources[0].private_hash='PRIVATE-HASH-MUST-NOT-RENDER';
    const escapedHtml=await render(escaped);await page.setContent(escapedHtml);
    eq(await page.evaluate(()=>Boolean(window.attributionInjection)),false,'Question and answer HTML is escaped');
    eq(await page.locator('.mr-evidence-entry img,.mr-evidence-entry script').count(),0,'Recorded text is never interpreted as HTML');
    eq(escapedHtml.includes('PRIVATE-HASH-MUST-NOT-RENDER'),false,'Unselected private fields do not render');
  }finally{await browser.close();}
}
eq(errors,[],'No browser runtime errors');eq(network,[],'No external requests');
eq(sha(fs.readFileSync(rendererPath)),sha(renderer),'Renderer source stayed fixed through testing');
const receipt={status:'PASS',assertions,rendererSha256:sha(renderer),harnessSha256:sha(fs.readFileSync(import.meta.filename)),
  fixtureSha256:sha(JSON.stringify(fixture())),layouts,negativeCases,screenshots,mockOnly:true,providerCalls:0,databaseCalls:0,pdfsGenerated:0};
if(screenshotDirectory)fs.writeFileSync(path.join(screenshotDirectory,'MOCK-source-attribution-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(receipt));
