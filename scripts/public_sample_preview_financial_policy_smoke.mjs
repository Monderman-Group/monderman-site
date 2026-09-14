// Synthetic generator tests only. No provider, approval, current artifact or
// promotional asset write. Optional --prepared reads private calculator output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildPublicSamplePreviewSections,refreshPublicSamplePreviews} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const option=name=>{const at=args.indexOf(name);return at<0?null:args[at+1];};
assert.ok(args.every((v,i)=>['--prepared','--browser','--out'].includes(v)||i>0&&['--prepared','--out'].includes(args[i-1])));
const protectedFiles=['index.html','Monderman_Platform_Brief.html','scripts/templates/home-workspace-preview.html','sample-report.html','sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins=Object.fromEntries(protectedFiles.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const template=fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert.ok(v);checks++;};
const seal=e=>{e.provenance.public_source_sha256=evidenceDigest(e.source);return e;};
const range=(low,central,high)=>({low,central,high});
// Explicitly synthetic display fixture. Local --prepared additionally exercises
// the real server calculator's projected result without claiming AI approval.
const scenario=()=>({version:'operational-planning-scenario-20260913.1',kind:'synthesis_planning_scenario',currency:'USD',
 publication_projection:'operational-scenario-public-20260913.1',source_identity_digest:'a'.repeat(64),
 inputs:{scopeConfirmed:true,overlapReviewed:true,horizonMonths:12,measuredPeople:30},
 method:{usesDiagnosticScores:false,isConfidenceInterval:false,measurementDays:28},
 totals:{capacityValue:range(64962.32,364989.11,556777.97),netCashEffect:range(-56000,-51000,-46000),totalImplementationAndSubscriptionCost:range(58000,69000,80000)}});
const ai=()=>({status:'complete',report:{interpretation:{recommendations:[{action:'SYNTHETIC TEST: inspect an authorized example.'}]}}});
function fixture(){return {contract:'monderman-public-product-samples/v3',synthetic:true,artifact_sha256:'b'.repeat(64),outputs:{
 decision_velocity:seal({kind:'diagnostic',provenance:{synthetic:true},source:{tool_type:'decision_velocity',process_name:'Example process',business_unit:'Example team',score:72,score_band:'Compounding',burden_breakdown:{approval:26,coordination:null,escalation:42},ai_report:ai()}}),
 depth_synthesis:seal({kind:'synthesis',provenance:{synthetic:true,submitted_run_count:27},source:{synthesis_product:'depth_synthesis',submitted_run_count:27,
  source_groups:[{tool_type:'structural_clarity',submitted_runs:27,median_score:52,score_iqr:[49,74],score_range:[49,74]}],sample_reads:[{tool_type:'structural_clarity',n:27,consensus:{read:'divided'}}],financial_scenario:scenario(),ai_report:ai()}})}};}
const build=a=>buildPublicSamplePreviewSections(a,template);
const base=fixture(),before=JSON.stringify(base),sections=build(base);eq(JSON.stringify(base),before);
ok(sections.hero.includes('data-demo-focus="escalation">42 / 100'));
ok(sections.hero.includes('Two highest recorded burden measures'));
ok(!sections.hero.includes('data-demo-burden="coordination"'));
ok(/One participant/.test(sections.hero)&&/not measure hours, organizational cost or savings/.test(sections.hero));
ok(!/data-demo-recovery|financial assumptions|recovery opportunity/.test(sections.hero));
for(const place of ['home','brief']){
 ok(sections[place].includes('$64,962 to $556,778'));
 ok(sections[place].includes('-$56,000 to -$46,000'));
 ok(sections[place].includes('$58,000 to $80,000'));
 ok(/Potential staff capacity value, not cash savings/.test(sections[place]));
 ok(/Net cash effect, after cash costs/.test(sections[place]));
 ok(/including internal staff time/.test(sections[place]));
 ok(!/median.*(?:recovery|labor-cost|time exposure)|fictional inputs|data-promo-recovery/i.test(sections[place]));
 ok(sections[place].includes('SYNTHETIC TEST: inspect an authorized example.'));
}
// Old financial graphs cannot affect the new previews, even if favorable.
const oldMoney=fixture();oldMoney.outputs.decision_velocity.source.exposure={priceable:true,recoverable_cost:999999999,model:{annual_cycles:999}};
oldMoney.outputs.depth_synthesis.source.pathway_exposure={status:'available',recoverable_cost:999999999,annual_cost:999999999};
Object.values(oldMoney.outputs).forEach(seal);eq(build(oldMoney),sections);
const absent=fixture();delete absent.outputs.depth_synthesis.source.financial_scenario;seal(absent.outputs.depth_synthesis);const fallback=build(absent);
ok(fallback.home.includes('data-promo-median>52 / 100'));ok(!/data-promo-capacity|data-promo-net-cash|\$/.test(fallback.home));
const hostile=fixture();hostile.outputs.decision_velocity.source.process_name='<img src=x onerror=alert(1)>';
hostile.outputs.depth_synthesis.source.ai_report.report.interpretation.recommendations[0].action='<script>unsafe()</script>&';
Object.values(hostile.outputs).forEach(seal);const escaped=build(hostile);ok(escaped.hero.includes('&lt;img'));ok(escaped.home.includes('&lt;script&gt;'));ok(!escaped.home.includes('<script>unsafe'));
for(const mutate of [
 a=>{a.outputs.decision_velocity.source.burden_breakdown.escalation=null;a.outputs.decision_velocity.source.burden_breakdown.approval=null;},
 a=>{a.outputs.decision_velocity.source.burden_breakdown.escalation='42';},
 a=>{a.outputs.decision_velocity.source.burden_breakdown.escalation=101;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.version='old';},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.method.usesDiagnosticScores=true;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.method.isConfidenceInterval=true;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.inputs.scopeConfirmed=false;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.inputs.overlapReviewed=false;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.currency='EUR';},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.totals.capacityValue.central=NaN;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.totals.capacityValue.low=-1;},
 a=>{a.outputs.depth_synthesis.source.financial_scenario.totals.netCashEffect.low=1;},
 a=>{delete a.outputs.depth_synthesis.source.financial_scenario.totals.totalImplementationAndSubscriptionCost;},
 a=>{a.outputs.decision_velocity.source.ai_report.status='pending';},
]){const a=fixture();mutate(a);Object.values(a.outputs).forEach(seal);assert.throws(()=>build(a));checks++;}
const changed=fixture();changed.outputs.depth_synthesis.source.financial_scenario.totals.capacityValue.high++;
assert.throws(()=>build(changed),/reviewed projection/);checks++;
// Real publication entry point still refuses v2 before any asset change.
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sample-preview-generator-MOCK-'));
fs.mkdirSync(path.join(isolated,'sample-data'));for(const n of protectedFiles.filter(n=>n.startsWith('sample-data/')))fs.copyFileSync(path.join(root,n),path.join(isolated,n));
for(const n of ['index.html','Monderman_Platform_Brief.html'])fs.writeFileSync(path.join(isolated,n),'UNCHANGED_SENTINEL');
assert.throws(()=>refreshPublicSamplePreviews({root:isolated}));checks++;
for(const n of ['index.html','Monderman_Platform_Brief.html'])eq(fs.readFileSync(path.join(isolated,n),'utf8'),'UNCHANGED_SENTINEL');

let display=sections,calculatorFixture=false;
if(option('--prepared')){
 assert.ok(path.isAbsolute(option('--prepared')));
 const prepared=JSON.parse(fs.readFileSync(option('--prepared'))),a={contract:'monderman-public-product-samples/v3',synthetic:true,artifact_sha256:'c'.repeat(64),outputs:{}};
 eq(prepared.publicDraft.status,'dry_not_for_publication');
 for(const key of ['decision_velocity','depth_synthesis']){const e=structuredClone(prepared.publicDraft.outputs[key]);e.source.ai_report=ai();a.outputs[key]=seal(e);}
 display=build(a);calculatorFixture=true;
 ok(display.home.includes('data-promo-capacity'));ok(display.home.includes('data-promo-net-cash'));ok(!display.hero.includes('data-demo-recovery'));
}
const browserRows=[];
if(args.includes('--browser')){
 const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const out=option('--out')||fs.mkdtempSync(path.join(os.tmpdir(),'sample-preview-layout-MOCK-'));assert.ok(path.isAbsolute(out));fs.mkdirSync(out,{recursive:true});
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});try{for(const width of [390,834,1440])for(const [file,place]of [['index.html','home'],['Monderman_Platform_Brief.html','brief']]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const pageSource=fs.readFileSync(path.join(root,file),'utf8'),head=pageSource.match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1].replace(/<script\b[\s\S]*?<\/script>/gi,'');
   // Isolated components in the existing maximum card seat, including at phone
   // widths where the real page may hide the larger tile. No header/animation
   // scripts are simulated and no whole-page presentation pass is claimed.
   const html='<!doctype html><html><head>'+head+'</head><body><main style="padding:20px;max-width:580px;margin:0 auto">'+(place==='home'?display.hero:'')+display[place]+'</main></body></html>';
   const mime={'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'};
   await page.route('**/*',route=>{const u=new URL(route.request().url()),p=path.resolve(root,'.'+u.pathname);if(u.origin==='http://preview.test'&&u.pathname==='/'+file)return route.fulfill({contentType:'text/html',body:html});if((u.origin==='http://preview.test'||u.origin==='https://www.monderman.com')&&p.startsWith(root+'/')&&fs.existsSync(p)&&fs.statSync(p).isFile())return route.fulfill({contentType:mime[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});return route.abort();});
   await page.goto('http://preview.test/'+file);await page.evaluate(()=>document.fonts.ready);
   const card=page.locator('.hero-report-proof.has-sample-depth-tile'),visible=await card.isVisible();
   if(visible){await card.scrollIntoViewIfNeeded();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.hero-report-proof.has-sample-depth-tile')).opacity==='1');ok(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1));ok(await card.locator('.md-opportunity').evaluate(el=>el.scrollWidth<=el.clientWidth+1));ok(await card.locator('.md-opportunity>strong').evaluate(el=>getComputedStyle(el).fontSize!=='16px'&&getComputedStyle(el).visibility==='visible'));await card.screenshot({path:path.join(out,engine+'-'+width+'-'+place+'-MOCK.png')});}
   if(place==='home'){const hero=page.locator('.home-workspace-preview');if(await hero.isVisible()){ok(await hero.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await hero.screenshot({path:path.join(out,engine+'-'+width+'-workspace-MOCK.png')});}}
   eq(errors,[]);browserRows.push({engine,width,place,visible});await page.close();
  }}finally{await browser.close();}
 }
 console.log(JSON.stringify({mockBrowserOutput:out,browserRows}));
}
for(const [n,pin]of Object.entries(pins))eq(sha(fs.readFileSync(path.join(root,n))),pin);
console.log(JSON.stringify({status:'PASS_MOCK_GENERATOR_ONLY',checks,calculatorFixture,browserStates:browserRows.length,artifactWrites:0,publicAssetWrites:0,providerCalls:0,publicationApproval:false}));
