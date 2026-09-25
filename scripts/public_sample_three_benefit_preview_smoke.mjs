// Historical v2 preview/calculator and isolated browser checks. The exact
// pre-quad generator retains these expanded-case assertions; current hero and
// Brief parity are independently required on every synthetic calculator case.
// No publication approval is granted and no current public asset is written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildPublicSamplePreviewSections as buildCurrentPublicSamplePreviewSections,refreshPublicSamplePreviews} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const deterministicOnly=args.includes('--deterministic-only'),candidateArgs=args.filter(arg=>arg!=='--deterministic-only');
assert.ok(args.filter(arg=>arg==='--deterministic-only').length<=1&&(candidateArgs.length===0||candidateArgs.length===2&&candidateArgs[0]==='--candidate'&&path.isAbsolute(candidateArgs[1])),'Optional --candidate must be an absolute JSON path; --deterministic-only skips browser coverage');
const modulePath=process.env.FINANCIAL_SCENARIO_MODULE?path.resolve(process.env.FINANCIAL_SCENARIO_MODULE):null;
const calculateFinancialPlanningScenario=modulePath?(await import(pathToFileURL(modulePath))).calculateFinancialPlanningScenario:null;
const fixtureBytes=fs.readFileSync(new URL('./fixtures/three-benefit-scenarios.json',import.meta.url)),fixtureCases=JSON.parse(fixtureBytes);
const template=fs.readFileSync(path.join(root,'scripts/templates/home-workspace-preview.html'),'utf8');
const artifactBase=JSON.parse(fs.readFileSync(path.join(root,'sample-data/production-diagnostic-samples.json')));
const out=fs.mkdtempSync('/tmp/monderman-three-benefit-preview-');
const protectedFiles=['index.html','Monderman_Platform_Brief.html','scripts/templates/home-workspace-preview.html','sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const generatorUrl=new URL('./refresh_public_sample_previews.mjs',import.meta.url);
const currentGenerator=fs.readFileSync(generatorUrl,'utf8');
const historicalGenerator=sourceBeforeHomepageReportQuad20260925('scripts/refresh_public_sample_previews.mjs',currentGenerator);
// Resolve only this exactly pinned historical module's relative dependencies
// and import.meta URL so it can execute from an in-memory test module.
const executableHistorical=historicalGenerator.replace(/from '(\.[^']+)'/g,(_,specifier)=>'from '+JSON.stringify(new URL(specifier,generatorUrl).href)).replaceAll('import.meta.url',JSON.stringify(generatorUrl.href));
const {buildPublicSamplePreviewSections}=await import('data:text/javascript;base64,'+Buffer.from(executableHistorical).toString('base64'));
const sourceBytes={currentGeneratorSha256:hash(currentGenerator),historicalGeneratorSha256:hash(historicalGenerator)};
const pins=Object.fromEntries(protectedFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
const clone=value=>structuredClone(value),levels=['low','central','high'];
let checks=0;const ok=(value,message)=>{assert.ok(value,message);checks++;},eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const seal=entry=>{entry.provenance.public_source_sha256=evidenceDigest(entry.source);return entry;};
function fixture(key='complete'){
 const artifact=clone(artifactBase);artifact.status='dry_not_for_publication';
 const raw=fixtureCases.cases[key];assert.ok(raw,'Recorded calculator fixture '+key);
 if(calculateFinancialPlanningScenario){
  const scope={id:raw.scope.scopeId,organizationId:raw.scope.organizationId,label:raw.scope.label,population:{size:Math.max(30,raw.inputs.capacity.measuredPeople||0)},window:{start:'2026-09-01T00:00:00Z',end:'2026-09-15T00:00:00Z'},lenses:{structural_clarity:{}}};
  const readiness={scopeId:scope.id,scope:{organizationId:scope.organizationId},scopeDigest:raw.scope.scopeDigest,evidenceDigest:raw.scope.evidenceDigest,depth:{status:'satisfied'},crossLens:{status:'satisfied'}};
  const replay=calculateFinancialPlanningScenario(clone(raw.inputs),{scope,readiness,snapshot:raw.scope.snapshot,actorId:raw.preparedBy,createdAt:raw.createdAt});
  for(const field of ['totals','benefits','coverage','activities','spendingItems'])eq(replay[field],raw[field],'Production calculator replays '+key+' '+field);
 }
 for(const key of ['depth_synthesis','cross_lens_synthesis']){
  const entry=artifact.outputs[key];
  const projected=clone(raw);projected.scope={scopeId:raw.scope.scopeId,label:raw.scope.label};delete projected.preparedBy;delete projected.digest;
  projected.publication_projection='three-benefit-scenario-public-20260919.1';projected.source_identity_digest=raw.digest;
  entry.source.financial_scenario=projected;seal(entry);
 }
 return artifact;
}
const render=artifact=>{
 const historical=buildPublicSamplePreviewSections(artifact,template),current=buildCurrentPublicSamplePreviewSections(artifact,template);
 eq(current.hero,historical.hero,'Current hero is unchanged for each calculator fixture');
 eq(current.brief,historical.brief,'Current Brief is unchanged for each calculator fixture');
 return historical;
};
const money=value=>value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const complete=fixture(),before=JSON.stringify(complete),sections=render(complete);eq(JSON.stringify(complete),before,'Pure preview retains source inputs');
for(const [place,html]of Object.entries(sections)){
 ok(html.includes('spending-reduction')&&html.includes('spending-avoidance')&&html.includes('capacity'),place+' presents all three categories');
 ok(!html.includes('no cash saving is assumed'),place+' does not assert nonexistent zero cash');
 ok(html.includes('current and planned baselines')||(html.includes('Current spending reduced · central case')&&html.includes('Future spending avoided · central case')),place+' describes separate current and future spending');
 ok(html.includes('not a measured bank-balance change')||(html.includes('Illustrative planning assumptions.')&&html.includes('Staff capacity value, not cash savings.')),place+' distinguishes assumptions and staff capacity from cash results');
}
// The compact hero uses Cross-Lens only; the separate Depth card remains below.
const compactMetrics=[['hours','potentialHoursFreed',value=>value.toLocaleString('en-US',{maximumFractionDigits:0})+' h'],['spending-reduction','existingSpendingReduction',money],['spending-avoidance','futureSpendingAvoidance',money]];
const crossTotals=complete.outputs.cross_lens_synthesis.source.financial_scenario.totals;
eq([...sections.hero.matchAll(/data-demo-assumptions-for="([^"]+)"/g)].map(match=>match[1]),['cross_lens_synthesis'],'Compact hero retains only its own Cross-Lens assumptions');
for(const [attr,metric,format]of compactMetrics){const value=crossTotals[metric].central;ok(new RegExp('<dd data-demo-'+attr+' data-exact-value="'+value+'" title="[^"]+">'+format(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</dd>').test(sections.hero),'Central '+metric+' keeps saved exact value and display rounding');}
ok(sections.hero.includes(money(crossTotals.capacityValue.central)+' retained capacity.'),'Cross-Lens retained capacity value remains in the full planning assumptions');
for(const place of ['home','brief']){
 const t=complete.outputs.depth_synthesis.source.financial_scenario.totals;
 for(const [attr,metric]of [['spending-reduction','existingSpendingReduction'],['spending-avoidance','futureSpendingAvoidance']])ok(sections[place].includes('data-promo-'+attr+'>'+money(t[metric].central)),'Separate Depth '+place+' preserves '+metric);
 ok(sections[place].includes('data-promo-capacity>About '+money(Math.round(t.capacityValue.central/1000)*1000)),'Separate Depth '+place+' preserves rounded retained capacity');
}
const partial=fixture('partial');
const partialSections=render(partial);
ok(partialSections.hero.includes('<dd data-demo-spending-avoidance>Not estimated</dd>'),'Missing future spending is not a zero-valued headline');
for(const html of Object.values(partialSections))ok(html.includes('Partial assessment:'),'Partial coverage accompanies every preview');
ok(partialSections.hero.includes('Entered-benefit subtotal after all costs'),'Partial subtotal is clearly limited');
ok(!partialSections.hero.includes('0 measured people'),'No fabricated measurement population');
const unknown=fixture('unknown');
const unknownSections=render(unknown);
for(const attr of ['spending-reduction','spending-avoidance','hours'])ok(unknownSections.hero.includes('data-demo-'+attr+'>Not estimated'),'Unknown '+attr+' is not zero');
ok(unknownSections.hero.includes('Not estimated retained capacity.'),'Unknown retained capacity is not zero in the full assumptions');
for(const place of ['home','brief'])ok(unknownSections[place].includes('data-promo-capacity>Not estimated'),'Unknown Depth capacity is not zero in '+place);
const zero=fixture('zero');
const zeroSections=render(zero);
for(const [attr,,format]of compactMetrics)ok(new RegExp('data-demo-'+attr+' data-exact-value="0" title="[^"]+">'+format(0).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</dd>').test(zeroSections.hero),'Reviewed '+attr+' zero remains numeric zero');
ok(zeroSections.hero.includes('Staff capacity: reviewed: none identified.'),'Reviewed zero status is explicit in the source assumptions');
for(const place of ['home','brief'])ok(zeroSections[place].includes('Future spending avoided · central case Reviewed: none identified.'),'Reviewed future spending zero is explicit in '+place);
const nonmonotonic=fixture('nonmonotonic');
const nonmonotonicSections=render(nonmonotonic),nonmonotonicTotals=nonmonotonic.outputs.depth_synthesis.source.financial_scenario.totals.capacityValue;
ok(nonmonotonicTotals.low>nonmonotonicTotals.central&&nonmonotonicTotals.central>nonmonotonicTotals.high,'Fixture proves declining retained capacity');
for(const [k,label]of [['low','Low'],['central','Central'],['high','High']]){const benefits=nonmonotonic.outputs.depth_synthesis.source.financial_scenario.benefits;ok(nonmonotonicSections.hero.includes('<dt>'+label+' case</dt><dd>'+money(benefits.spendingReduction.amount[k])+' lower spending; '+money(benefits.spendingAvoidance.amount[k])+' avoided future spending; '+money(nonmonotonicTotals[k])+' retained capacity.</dd>'),'Saved case value remains under its own label');}
ok(nonmonotonicSections.home.includes('Each case uses different assumptions. Exact values are in the report.'),'Preview identifies assumption cases without presenting ordered bounds');
const negative=[
 ['unknown projection',s=>s.publication_projection='old'],['missing category',s=>delete s.benefits.spendingAvoidance],
 ['missing-as-zero',s=>s.benefits.spendingReduction.status='not_estimated'],['zero-as-positive',s=>{s.benefits.spendingReduction.status=s.inputs.spendingReduction.status='none_identified';}],
 ['false complete coverage',s=>s.coverage.complete=false],['missing category coverage',s=>s.coverage.estimatedCategories.pop()],
 ['null estimated amount',s=>s.benefits.staffCapacity.amount=null],['bad numeric case',s=>s.totals.netCashEffect.central=NaN],
 ['mismatched saved total',s=>s.totals.existingSpendingReduction.central++],['incorrect baseline cash net',s=>s.totals.netExistingCashEffect.central++],
 ['missing monetary total',s=>delete s.totals.knownBenefitSubtotal],['score-derived claim',s=>s.method.usesDiagnosticScores=true],
];
for(const [label,change]of negative){const a=clone(complete);change(a.outputs.depth_synthesis.source.financial_scenario);seal(a.outputs.depth_synthesis);assert.throws(()=>render(a),undefined,label);checks++;}
const changed=clone(complete);changed.outputs.depth_synthesis.source.financial_scenario.totals.capacityValue.central++;assert.throws(()=>render(changed),/reviewed projection/);checks++;
// Calling the only public-asset writer without a matching reviewed manifest
// must fail before touching either generated page.
const isolated=fs.mkdtempSync('/tmp/monderman-preview-unapproved-');fs.mkdirSync(path.join(isolated,'sample-data'));
fs.writeFileSync(path.join(isolated,'sample-data/production-diagnostic-samples.json'),JSON.stringify(complete));
fs.copyFileSync(path.join(root,'sample-data/production-sample-release.json'),path.join(isolated,'sample-data/production-sample-release.json'));
for(const file of ['index.html','Monderman_Platform_Brief.html'])fs.writeFileSync(path.join(isolated,file),'UNCHANGED_SENTINEL');
assert.throws(()=>refreshPublicSamplePreviews({root:isolated}));checks++;
for(const file of ['index.html','Monderman_Platform_Brief.html'])eq(fs.readFileSync(path.join(isolated,file),'utf8'),'UNCHANGED_SENTINEL','Publication still requires independent approval');

const candidate=candidateArgs.length?JSON.parse(fs.readFileSync(candidateArgs[1])):complete,display=render(candidate);
ok(display.hero.includes('Low case: net existing-spending effect after cash costs '+money(candidate.outputs.cross_lens_synthesis.source.financial_scenario.totals.netExistingCashEffect.low)),'Low existing-spend cash result stays visible separately from avoided future spending');
if(deterministicOnly){
 for(const [file,pin]of Object.entries(pins))eq(hash(fs.readFileSync(path.join(root,file))),pin,'Public source unchanged: '+file);
 console.log(JSON.stringify({status:'PASS_MOCK_DETERMINISTIC_ONLY',checks,browserStates:[],browserCoverage:'NOT_RUN',historicalExpandedDepthPreview:true,currentHeroAndBriefParity:true,sourceBytes,candidate:candidateArgs[1]||null,fixtureSha256:hash(fixtureBytes),actualCalculator:modulePath?hash(fs.readFileSync(modulePath)):null,publicAssetWrites:0,providerCalls:0,publicationApproval:false}));
 process.exit(0);
}
const {chromium,webkit}=await import('playwright'),browserStates=[],screenshots=[],browserErrors=[];
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const width of [320,390,834,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>browserErrors.push(e.message));
  const head=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1].replace(/<script\b[\s\S]*?<\/script>/gi,'');
  const html='<!doctype html><html><head>'+head+'<style>.hero-report-proof.has-sample-depth-tile{display:block!important;opacity:1!important;transform:none!important}main{padding:12px;max-width:580px;margin:auto}</style></head><body><main>'+display.hero+display.home+'</main><script src="/homepage-workspace-demo.js"></script></body></html>';
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='http://preview.test'&&u.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:html});const file=path.resolve(root,'.'+u.pathname),mime={'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'};if((u.origin==='http://preview.test'||u.origin==='https://www.monderman.com')&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});return route.abort();});
  await page.goto('http://preview.test/fixture');await page.evaluate(()=>document.fonts.ready);
  eq(await page.locator('#hwd-tab-measure').getAttribute('aria-selected'),'true','A fresh journey starts at Gather');
  eq(await page.locator('.hwd-compact-participation').isVisible(),true,'Gather participation is visible on arrival');
  await page.locator('#hwd-tab-analysis').click();
  const financial=page.locator('#hwd-panel-analysis .hwd-compact-values');await financial.waitFor({state:'visible'});
  eq(await page.locator('.hwd-compact-participation').isVisible(),false,'Gather participation stays hidden in Evaluate');
  for(const [attr,metric,format]of compactMetrics){const range=candidate.outputs.cross_lens_synthesis.source.financial_scenario.totals[metric],cell=financial.locator('[data-demo-'+attr+']');eq(await cell.textContent(),range===null?'Not estimated':format(range.central),'Browser shows saved '+metric);eq(await cell.getAttribute('data-exact-value'),range===null?null:String(range.central),'Exact saved '+metric+' remains available independently of display rounding');}
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Preview page fits '+engine+' '+width);
  for(const selector of ['.home-workspace-preview','.hero-report-proof.has-sample-depth-tile','.hwd-compact-values','.md-economics'])ok(await page.locator(selector).first().evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Component fits '+selector);
  eq(await financial.locator('dd').evaluateAll(nodes=>nodes.filter(el=>{const range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();return text.left<box.left-1||text.right>box.right+1;}).map(el=>el.textContent)),[],'Complete financial figures stay within their own grid cells');
  eq(await page.locator('[data-three-benefit-cases] dd').evaluateAll(nodes=>nodes.filter(el=>{const range=document.createRange();range.selectNodeContents(el);const boxes=[...range.getClientRects()],cell=el.parentElement.getBoundingClientRect();return boxes.length!==1||boxes[0].right>cell.right+1;}).map(el=>el.textContent)),[],'Every Depth case amount stays intact and within its case row');
  const shot=engine+'-'+width+'-workspace.png';await page.locator('.home-workspace-preview').screenshot({path:path.join(out,shot)});screenshots.push(shot);
  const tile=engine+'-'+width+'-depth.png';await page.locator('.hero-report-proof.has-sample-depth-tile').screenshot({path:path.join(out,tile)});screenshots.push(tile);
  await page.locator('#hwd-tab-measure').click();eq(await page.locator('.hwd-compact-participation').isVisible(),true,'Gather still contains recorded participation');
  await page.locator('#hwd-tab-analysis').click();eq(await page.locator('.hwd-compact-participation').isVisible(),false,'Evaluate does not inherit Gather participation');
  browserStates.push({engine,width});await page.close();
 }}finally{await browser.close();}
}
eq(browserErrors,[],'No browser errors');for(const [file,pin]of Object.entries(pins))eq(hash(fs.readFileSync(path.join(root,file))),pin,'Public source unchanged: '+file);
const receipt={status:'PASS_MOCK_PREVIEW_ONLY',checks,browserStates,screenshots,output:out,historicalExpandedDepthPreview:true,currentHeroAndBriefParity:true,sourceBytes,actualCalculator:modulePath?hash(fs.readFileSync(modulePath)):null,fixtureSha256:hash(fixtureBytes),fixtureCalculatorSha256:fixtureCases.calculatorSha256,candidate:candidateArgs[1]||null,source:hash(fs.readFileSync(new URL('./refresh_public_sample_previews.mjs',import.meta.url))),tileStyles:hash(fs.readFileSync(path.join(root,'monderman-depth-lure-tile.css'))),publicAssetWrites:0,providerCalls:0,publicationApproval:false};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
