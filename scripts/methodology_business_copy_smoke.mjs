// Local copy/layout regression only. No model, production API, or publication claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {readPublicSampleFixture,compactPreviewBeforeSodiDisplayOrder} from './public_sample_fixture.mjs';
import {APPROVED_INTERFACE_PINS} from './invited_evaluation_source_contract.mjs';
import {sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {sourceAtBrandRefreshBaseline} from './brand_refresh_20261007_inverse.mjs';
import {sourceAtMarketingRefreshBaselineAtRelease as sourceAtMarketingRefreshBaseline,sourceAtReleaseBaseline} from './ai_middle_release_20261028_contract.mjs';
import {sourceAtMarketingPhotoPresentationBaseline} from './marketing_photo_presentation_20261013_inverse.mjs';
import {publicationDelta,sourceAtPublicationBaseline} from './divide_rule_publication_20261025_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..');
// Audit every committed current source before inspecting any historical view.
execFileSync(process.env.PYTHON||'python3',['scripts/ai_middle_release_20261028_contract.py',...(process.env.AI_MIDDLE_WORKTREE_REVIEW==='1'?['--worktree']:[]),'--historical','--','python3','scripts/hiring_work_design_series_20261017_contract.py'],{cwd:root,stdio:'pipe'});
const {artifact}=readPublicSampleFixture({root});
const previewGroups=artifact.outputs.cross_lens_synthesis.source.source_groups;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
const copyOnly=process.argv.includes('--copy-only');
const out=output?path.resolve(output):fs.mkdtempSync('/tmp/monderman-methodology-copy-');
if(output){assert.ok(path.isAbsolute(output));fs.mkdirSync(out,{mode:0o700});}
const build=path.join(out,'public');fs.mkdirSync(build,{mode:0o700});
const descriptions=[
  ['Structural Clarity','Clear responsibilities and decision authority','structural-clarity-article.html'],
  ['Decision Velocity','Delays in making decisions','decision-velocity-article.html'],
  ['Operational Systems','Unnecessary process work','operational-systems-article.html'],
  ['Institutional Performance','Reliable delivery and response to change','institutional-performance-article.html'],
];
// Existing case iteration and canonical row objects stay unchanged; this is current displayed table order only.
const currentDescriptionDisplayOrder=[descriptions[0],descriptions[2],descriptions[1],descriptions[3]];
compactPreviewBeforeSodiDisplayOrder(read('index.html')); // Require the exact current SODI strip before rendering the current lane.
const sourceFiles=['index.html','diagnostics.html','workspace-diagnostics.html','Monderman_Platform_Brief.html',
  'site-shell/footer.html','scripts/templates/home-workspace-preview.html',...descriptions.map(row=>row[2]),
  'roi.html','platform-services.html','plan-signal.html','plan-pattern.html'];
const protectedFiles=['structural-clarity.html','decision-velocity.html','operational-systems.html','institutional-performance.html',
  'monderman-report.js','public-sample-model.js','sample-report-production.js','sample-data/production-diagnostic-samples.json',
  'homepage-workspace-demo.js','homepage-workspace-demo.css','canonical-site-shell.js','canonical-site-shell.css','scripts/inject-public-shell.mjs'];
const hashes=Object.fromEntries([...sourceFiles,...protectedFiles,'marketing-refresh.css','marketing-refresh.js','scripts/methodology_business_copy_smoke.mjs'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
let checks=0,blockedRequests=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
checks++; // The complete current-source audit above returned successfully.
const marketingBaselineHomepage=sourceAtMarketingRefreshBaseline('index.html',read('index.html'));
eq(marketingBaselineHomepage,execFileSync('git',['show','14e57bb9f5537cd7ed5eb581cbc7740541c593b1:index.html'],{cwd:root,encoding:'utf8'}),'The compact homepage is the exact approved marketing baseline, not a weaker substitute');
assert.notEqual(marketingBaselineHomepage,read('index.html'),'Both exact baseline and refreshed homepage editions are required');checks++;
const refreshedJourneyHeightLimits={
  // Per-step bounds cover the measured enlarged layout and bounded font wrap;
  // they never replace the legacy 700/580 compact checks below.
  390:{measure:900,analysis:1500,actions:1100,return:900},
  834:{measure:800,analysis:1000,actions:800,return:750},
  1440:{measure:800,analysis:950,actions:750,return:700},
};
function assertRefreshedJourneyGeometry(geometry,width,id){
  assert.ok(Object.hasOwn(refreshedJourneyHeightLimits,width)&&Object.hasOwn(refreshedJourneyHeightLimits[width],id),'Known reviewed enlarged-layout viewport and step');
  assert.equal(geometry.selectedPanel,'hwd-panel-'+id,'Current geometry belongs to the selected panel');
  assert.equal(geometry.disclosureOpen,false,'Current evidence disclosure stays closed during bounded measurement');
  assert.equal(geometry.fontsStatus,'loaded','Current font geometry is measured after loaded fonts');
  for(const key of ['preview','app','panel','heading','footer','disclosure']){
    const box=geometry[key];assert.ok(box&&Number.isFinite(box.width)&&Number.isFinite(box.height)&&box.width>0&&box.height>0,'Complete finite geometry: '+key);
  }
  const limit=refreshedJourneyHeightLimits[width][id],overhead=geometry.preview.height-geometry.app.height;
  assert.ok(geometry.panel.height>=420&&geometry.app.height>=500&&geometry.app.height<=limit,'Bounded readable enlarged app height');
  assert.ok(overhead>=0&&overhead<=64&&geometry.preview.height<=limit+64,'Outer label/closed-disclosure height remains bounded');
  assert.ok(geometry.disclosure.height<=24,'Closed evidence disclosure does not become an expanded reading block');
  assert.ok(geometry.app.width<=geometry.preview.width+1&&geometry.widthFits&&geometry.contentContained,'Every enlarged step and visible content stays inside its preview');
  assert.ok(parseFloat(geometry.heading.fontSize)>=(width===390?26:30),'Enlarged selected heading remains readable');
  assert.ok(Number.isFinite(geometry.eyebrowSize)&&geometry.eyebrowSize>=12,'Selected step caption keeps its distinct readable role');
  assert.ok(Array.isArray(geometry.paragraphSizes)&&geometry.paragraphSizes.length>0&&geometry.paragraphSizes.every(size=>Number.isFinite(size)&&size>=13)&&geometry.paragraphSizes.some(size=>size>=15),'Selected prose and its smaller qualifiers keep distinct readable sizes');
  assert.ok(Array.isArray(geometry.actionProseSizes),'Action prose geometry is explicitly collected');
  if(id==='actions')assert.ok(geometry.actionProseSizes.length===3&&geometry.actionProseSizes.every(size=>Number.isFinite(size)&&size>=(width===390?14:15)),'All three Decide definition paragraphs remain readable at their approved mobile/wider sizes');
  assert.ok(Array.isArray(geometry.tabSizes)&&geometry.tabSizes.length===4&&geometry.tabSizes.every(size=>Number.isFinite(size)&&size>=13),'All four enlarged journey controls remain readable');
  assert.ok(Number.isFinite(geometry.sampleLinkSize)&&geometry.sampleLinkSize>=13,'Direct sample destination remains readable');
}
let refreshedGeometryNegativeControls=0;
const geometryFixture=()=>({selectedPanel:'hwd-panel-measure',disclosureOpen:false,fontsStatus:'loaded',preview:{width:350,height:660},app:{width:350,height:600},panel:{width:348,height:420},heading:{width:300,height:60,fontSize:'26px'},footer:{width:348,height:48},disclosure:{width:350,height:18},widthFits:true,contentContained:true,eyebrowSize:12,paragraphSizes:[15,15],actionProseSizes:[],tabSizes:[13,13,13,13],sampleLinkSize:13});
assertRefreshedJourneyGeometry(geometryFixture(),390,'measure');checks++;
for(const mutate of [g=>g.selectedPanel='hwd-panel-return',g=>g.disclosureOpen=true,g=>g.fontsStatus='loading',g=>g.app.height=901,g=>g.preview.height=665,g=>g.disclosure.height=25,g=>g.heading.fontSize='25px',g=>g.eyebrowSize=11,g=>g.paragraphSizes=[12,15],g=>g.paragraphSizes=[14],g=>g.paragraphSizes=[],g=>g.tabSizes=[13,13,13,12],g=>g.sampleLinkSize=12,g=>g.widthFits=false,g=>g.contentContained=false,g=>g.app.width=352,g=>g.panel.height=419,g=>g.footer.height=NaN]){
  const geometry=geometryFixture();mutate(geometry);assert.throws(()=>assertRefreshedJourneyGeometry(geometry,390,'measure'),{name:'AssertionError'},'Malformed, cramped, over-height, open or clipped current layout must fail');checks++;refreshedGeometryNegativeControls++;
}
for(const width of [390,834]){
  const geometry={...geometryFixture(),selectedPanel:'hwd-panel-actions',heading:{width:300,height:60,fontSize:width===390?'26px':'30px'},actionProseSizes:Array(3).fill(width===390?14:15)};
  assertRefreshedJourneyGeometry(geometry,width,'actions');checks++;
  for(const sizes of [[width===390?13:14,15,15],[]]){
    assert.throws(()=>assertRefreshedJourneyGeometry({...geometry,actionProseSizes:sizes},width,'actions'),{name:'AssertionError'},'Missing or undersized Decide definition prose must fail');checks++;refreshedGeometryNegativeControls++;
  }
}
const journeyGeometryReceipts=[];
const settledHeaderState=()=>{
  const header=document.getElementById('siteHeader');
  return Boolean(header&&scrollY>24&&header.classList.contains('scrolled')&&
    Math.abs(header.getBoundingClientRect().top)<=1&&
    getComputedStyle(header).backgroundColor==='rgba(4, 24, 27, 0.96)'&&
    header.getAnimations().every(a=>!a.pending&&['finished','idle'].includes(a.playState)));
};
const settledPreviewState=id=>{
  const app=document.querySelector('[data-workspace-demo]');if(!app)return false;
  const tabs=[...app.querySelectorAll('[role="tab"]')],panels=[...app.querySelectorAll('[role="tabpanel"]')];
  const selected=tabs.filter(t=>t.getAttribute('aria-selected')==='true');
  const visible=panels.filter(p=>!p.hidden&&getComputedStyle(p).display!=='none'&&p.getClientRects().length>0);
  if(tabs.length!==4||panels.length!==4||selected.length!==1||selected[0].id!=='hwd-tab-'+id||
    selected[0].tabIndex!==0||selected[0].getAttribute('aria-controls')!=='hwd-panel-'+id||
    visible.length!==1||visible[0].id!=='hwd-panel-'+id||
    tabs.some(t=>t!==selected[0]&&(t.getAttribute('aria-selected')!=='false'||t.tabIndex!==-1))||
    panels.some(p=>p!==visible[0]&&!p.hidden))return false;
  const paragraphs=[...visible[0].querySelectorAll('p')].filter(p=>p.getClientRects().length>0);
  return paragraphs.length>0&&paragraphs.every(p=>{
    const style=getComputedStyle(p);
    return style.opacity==='1'&&style.transform==='none'&&style.visibility==='visible'&&
      p.getAnimations().every(a=>!a.pending&&['finished','idle'].includes(a.playState));
  });
};
async function settledPaint(page,predicate,arg){
  await page.waitForFunction(predicate,arg,{timeout:10000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check(await page.evaluate(predicate,arg),'Exact settled state survives two animation frames');
}
const staticPreviewRule='body.homepage-enterprise .hwd-app p { animation:none !important; opacity:1 !important; transform:none !important; will-change:auto; }';
eq(read('homepage-workspace-demo.css').split(staticPreviewRule).length-1,1,'Existing preview paragraph stability rule is retained');
const stableGeometryRule='.hwd-app * { transition-property:color,background-color,border-color !important; animation:none !important; }';
eq(read('homepage-workspace-demo.css').split(stableGeometryRule).length-1,1,'Only the local preview suppresses geometry transitions; button/link color transitions remain');
check(read('index.html').includes('animation: heroFadeUp 900ms cubic-bezier(0.22,1,0.36,1) forwards;'),'Other hero entrance motion remains');
eq(sha(sourceBeforeHomepageCompactJourney20260924('homepage-workspace-demo.js',read('homepage-workspace-demo.js'))),APPROVED_INTERFACE_PINS['homepage-workspace-demo.js'],'The exact compact-journey delta reconstructs the historical runtime; current four-step navigation remains exercised below');
const priorShell=execFileSync('git',['show','f91fb07fde754dea57360ddbddc9bf742d6e6702:canonical-site-shell.js'],{cwd:root,encoding:'utf8'});
const approvedShell=priorShell.replace('tagline.textContent = "See the work clearly. Make the next move count.";','if (!tagline.textContent.trim()) tagline.textContent = "Less bureaucracy. Better performance.";')
  .replace('    document.querySelectorAll(".mond-footer .mf-copy").forEach((copy) => {\n      copy.textContent = "Monderman provides repeatable organizational diagnostics for ownership, decisions, handoffs, and administrative work.";\n    });\n','');
// The approved floating-widget release removes only the original header
// proxies. Pin the exact historical block before subtracting it; retain the
// complete-file comparison for every remaining header and shell behavior.
const retiredHeaderWidgets=[...approvedShell.matchAll(/      const widgetActions = document\.createElement\("div"\);\n[\s\S]*?(?=      menuButton\.addEventListener\("click",)/g)];
eq(retiredHeaderWidgets.length,1,'Exactly one historical header-widget block is identified');
eq(sha(retiredHeaderWidgets[0][0]),'347c1f4c7067bca1cd54c550498e3d0683e424e162b3fa68219b4ba7c17b1524','Only the reviewed 31-line legacy proxy block may be removed');
const approvedFloatingShell=approvedShell.replace(retiredHeaderWidgets[0][0],'');
const assertApprovedShell=candidate=>assert.equal(sourceAtBrandRefreshBaseline('canonical-site-shell.js',candidate),approvedFloatingShell,'Only approved footer copy and header-proxy removal differ; all remaining header state logic is unchanged');
assertApprovedShell(read('canonical-site-shell.js'));checks++;
for(const candidate of [
  approvedFloatingShell+retiredHeaderWidgets[0][0],
  approvedFloatingShell.replace('const opening = !header.classList.contains("mobile-nav-open");','const opening = true;'),
  read('canonical-site-shell.js').replace('const opening = !header.classList.contains("mobile-nav-open");','const opening = true;'),
]){
  assert.notEqual(candidate,approvedFloatingShell,'Header-state negative actually mutates the approved source');
  assert.throws(()=>assertApprovedShell(candidate),'Restored proxies or unrelated navigation changes must fail');checks++;
}
check(read('index.html').includes('homepage-workspace-demo.css?v=20260927-report-first-v1'),'Source preview stylesheet has the current report-quad cache ID');
check(read('scripts/inject-public-shell.mjs').includes('"homepage-workspace-demo.css": "20260927-report-first-v1"'),'Build refreshes the current report-quad stylesheet cache ID');
execFileSync(process.execPath,['scripts/refresh_public_sample_previews.mjs','--check'],{cwd:root,stdio:'pipe'});
check(read('scripts/templates/home-workspace-preview.html').split('{{compactRoles}}').length===2,'One generated Gather region retains privacy-permitted role counts');
check(read('scripts/templates/home-workspace-preview.html').split('{{compactLenses}}').length===2,'One generated Gather region identifies the four source diagnostics');
check(!read('scripts/templates/home-workspace-preview.html').includes('{{journeyOptions}}'),'The approved single-example journey does not retain obsolete analysis choices');
// Exercise the actual browser predicates offline; geometry alone cannot admit
// an unselected panel, unfinished animation, transparent header or missing text.
function predicateFixture(){
  const header={classList:{contains:()=>true},getBoundingClientRect:()=>({top:0}),getAnimations:()=>[],style:{backgroundColor:'rgba(4, 24, 27, 0.96)'}};
  const paragraphs=[{getClientRects:()=>[{}],getAnimations:()=>[],style:{opacity:'1',transform:'none',visibility:'visible'}}];
  const ids=['measure','analysis','actions','return'];
  const tabs=ids.map(id=>({id:'hwd-tab-'+id,tabIndex:id==='measure'?0:-1,attrs:{'aria-selected':String(id==='measure'),'aria-controls':'hwd-panel-'+id},getAttribute(k){return this.attrs[k];}}));
  const panels=ids.map(id=>({id:'hwd-panel-'+id,hidden:id!=='measure',style:{display:'block'},getClientRects:()=>[{}],querySelectorAll:()=>paragraphs}));
  const app={querySelectorAll:s=>s==='[role="tab"]'?tabs:panels};
  return {header,paragraphs,tabs,panels,context:{scrollY:100,getComputedStyle:n=>n.style,document:{getElementById:()=>header,querySelector:()=>app}}};
}
const runPredicate=(fn,f,arg)=>vm.runInNewContext('('+fn.toString()+')('+JSON.stringify(arg)+')',f.context);
eq(runPredicate(settledHeaderState,predicateFixture()),true);eq(runPredicate(settledPreviewState,predicateFixture(),'measure'),true);
for(const mutate of [f=>f.context.scrollY=24,f=>f.header.style.backgroundColor='rgba(4, 24, 27, 0)',f=>f.header.classList.contains=()=>false,
  f=>f.header.getAnimations=()=>[{playState:'running'}],f=>f.header.getAnimations=()=>[{playState:'finished',pending:true}]]){
  const f=predicateFixture();mutate(f);eq(runPredicate(settledHeaderState,f),false,'Premature header state rejected');
}
for(const mutate of [f=>f.tabs[3].attrs['aria-selected']='true',f=>f.tabs[0].attrs['aria-controls']='hwd-panel-return',
  f=>f.panels[1].hidden=false,f=>f.tabs[3].tabIndex=0,f=>f.paragraphs[0].style.opacity='0',
  f=>f.paragraphs[0].style.visibility='hidden',f=>f.paragraphs[0].getAnimations=()=>[{playState:'running'}],
  f=>f.paragraphs[0].getClientRects=()=>[]]){
  const f=predicateFixture();mutate(f);eq(runPredicate(settledPreviewState,f,'measure'),false,'Premature preview state rejected');
}
// Scan every visible section and metadata description, not just the hero.
// These old affirmative product promises are not part of a single-run report.
const obsoleteArticleClaims=/\b(?:recoverable|reclaim(?:ed|able)?|reclaim potential|benchmarks?|trajectory|clock speed|pathway problem|condition beneath|compensatory|coherence diagnosis|organizational readout)\b/i;
const articleText=html=>html.replace(/<(?:script|style|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|svg)>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')
  +[...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map(row=>row[1]).join(' ');
const singleRunFinancialBoundary='A single-run score does not establish organizational exposure, recoverable savings or ROI.';
const articleTopicNavigationPins=Object.freeze({
  'structural-clarity-article.html':{bytes:1068,sha256:'4dde573a97ecb955f29c2b404553a5ed6014dec205e2e0a288558f1297a84b9e'},
  'operational-systems-article.html':{bytes:1076,sha256:'95ad999316b5fd838c440c3db122d85b8465879e815123b000c79bf0c6eefdde'},
  'decision-velocity-article.html':{bytes:1103,sha256:'8c9ae54810e691f9c88912025e9f38185afd17c216020c7542904205430db35a'},
  'institutional-performance-article.html':{bytes:1100,sha256:'c4e4115ee50d36485f24acf8cdd5d1ed6eaa813ef39c24021df5e1664582adaa'},
});
const articleTopicStyle='<link rel="stylesheet" href="research-topics.css?v=20261017.1">\n';
const articleTopicStart='\n<!-- MONDERMAN RESEARCH TOPICS: START -->\n';
const articleTopicEnd='\n<!-- MONDERMAN RESEARCH TOPICS: END -->\n';
// The Part 7 publication refreshed related links in this closed article set.
// Derive its exact fragment pair from the SHA-bound complete source delta, then
// retain every original topic/style/body predicate below. No unknown block or
// unrelated source byte is normalized away.
const articleTopicPublicationViews=new Map(Object.keys(articleTopicNavigationPins).map(file=>{
  const current=read(file),prior=sourceAtPublicationBaseline(file,current);
  if(!Object.hasOwn(publicationDelta.files,file))return [file,null];
  assert.notEqual(prior,current,'Exact current Part 7 article source required');
  const block=html=>{
    assert.equal(html.split(articleTopicStart).length-1,1,'One SHA-bound Part 7 navigation start');
    assert.equal(html.split(articleTopicEnd).length-1,1,'One SHA-bound Part 7 navigation end');
    const start=html.indexOf(articleTopicStart),end=html.indexOf(articleTopicEnd,start);
    assert.ok(start>=0&&end>start,'Complete SHA-bound Part 7 navigation fragment');
    return html.slice(start,end+articleTopicEnd.length);
  };
  const currentBlock=block(current),priorBlock=block(prior);
  assert.equal(current.replace(currentBlock,''),prior.replace(priorBlock,''),'Only approved related-navigation bytes differ');
  assert.equal(Buffer.byteLength(priorBlock),articleTopicNavigationPins[file].bytes,'Prior complete navigation length preserved');
  assert.equal(sha(priorBlock),articleTopicNavigationPins[file].sha256,'Prior complete navigation SHA256 preserved');
  return [file,{current:currentBlock,prior:priorBlock}];
}));
function beforeApprovedPart7ArticleTopicNavigation(file,html){
  const approved=articleTopicPublicationViews.get(file);
  return approved&&html.includes(approved.current)?html.replace(approved.current,approved.prior):html;
}
function beforeApprovedArticleTopicNavigation(file,html){
  const label='Exact approved article topic navigation';
  assert.ok(Object.hasOwn(articleTopicNavigationPins,file),label+': closed four article paths');
  assert.equal(typeof html,'string',label+': text input');
  html=beforeApprovedPart7ArticleTopicNavigation(file,html);
  const heads=[...html.matchAll(/<head>[\s\S]*?<\/head>/g)];
  const mains=[...html.matchAll(/<main class="article">[\s\S]*?<\/main>/g)];
  assert.equal(heads.length,1,label+': unique head');assert.equal(mains.length,1,label+': unique article main');
  assert.equal(html.split('<!-- MONDERMAN RESEARCH TOPICS: START -->').length-1,1,label+': one start marker');
  assert.equal(html.split('<!-- MONDERMAN RESEARCH TOPICS: END -->').length-1,1,label+': one end marker');
  assert.equal((html.match(/\bclass=["']research-topic-nav["']/g)||[]).length,1,label+': one navigation');
  const start=html.indexOf(articleTopicStart),end=html.indexOf(articleTopicEnd,start);
  assert.ok(start>=0&&end>start,label+': literal marked block');
  const block=html.slice(start,end+articleTopicEnd.length),pin=articleTopicNavigationPins[file];
  assert.equal(Buffer.byteLength(block),pin.bytes,label+': complete UTF8 length');
  assert.equal(sha(block),pin.sha256,label+': complete SHA256');
  assert.ok(start>=mains[0].index&&start+block.length<=mains[0].index+mains[0][0].length,label+': navigation stays inside article main');
  assert.equal(html.split(articleTopicStyle).length-1,1,label+': one literal topic stylesheet');
  assert.equal((html.match(/<link\b[^>]*\bhref=["'][^"']*research-topics\.css[^"']*["'][^>]*>/g)||[]).length,1,label+': no stylesheet variants');
  assert.equal(Buffer.byteLength(articleTopicStyle),64,label+': stylesheet length');
  assert.equal(sha(articleTopicStyle),'9b7d2c04234d032e79e82e3dabe4e5a22dbfcd8c84a9e9435dad7c79889594e0',label+': stylesheet SHA256');
  const styleAt=html.indexOf(articleTopicStyle);
  assert.ok(styleAt>=heads[0].index&&styleAt+articleTopicStyle.length<=heads[0].index+heads[0][0].length,label+': stylesheet stays inside head');
  // Only these literal owner-navigation insertions are subtracted. Every other
  // byte, including changed prose, metadata, markup and CSS, survives the view.
  return html.replace(articleTopicStyle,'').replace(block,'');
}
// Permit only this exact negative statement. Deleting "not", adding an
// affirmative claim afterward, or changing a metadata promise still fails.
const assertArticleScope=(html,file)=>assert.doesNotMatch(articleText(beforeApprovedArticleTopicNavigation(file,html)).replaceAll(singleRunFinancialBoundary,''),obsoleteArticleClaims,'No superseded whole-article financial, comparison or predictive claim');
const articleBase='19bf82646048ba75799300b73caaca9366d4c387';
const approvedPresentationBase='373a14499ad29a84014c5c7ad7cfcb389953f295';
const articleMain=html=>html.match(/<main class="article">[\s\S]*?<\/main>/)?.[0];
const textless=html=>html.replace(/>[^<]*</g,'><');
// Invert only the table-accessibility changes approved in 6092c75. Keep the
// original copy-review baseline below; neither table contents nor other markup
// or CSS may disappear into this exception.
const matrixRegion='<div class="lens-matrix-region" role="region" aria-label="Compare the four diagnostics" tabindex="0">';
function beforeApprovedMatrixRegion(main){
  assert.equal(main.split(matrixRegion).length-1,1,'Exactly one approved comparison region');
  const wrapped=/<div class="lens-matrix-region" role="region" aria-label="Compare the four diagnostics" tabindex="0">\s*(<table class="lens-matrix">[\s\S]*?<\/table>)\s*<\/div>/g;
  assert.equal([...main.matchAll(wrapped)].length,1,'Approved region directly contains the complete comparison table');
  return main.replace(wrapped,'$1');
}
const matrixStyleInverses=[
  ['    .lens-matrix { width: 100%; border-collapse: collapse; table-layout: auto; margin: 1.75rem 0; font-size: 0.95rem; }\n'+
   '    .lens-matrix-region { max-width: 100%; overflow-x: auto; margin: 1.75rem 0; }\n'+
   '    .lens-matrix-region .lens-matrix { margin: 0; }',
   '    .lens-matrix { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 1.75rem 0; font-size: 0.95rem; }'],
  ['    .lens-matrix-self td:first-child strong { color: var(--accent); }',
   '    .lens-matrix-self td:first-child strong { color: #3f6ea1; }'],
  ['    /* The article column is narrow even on desktop. Keep the comparison in\n'+
   '       labelled reading rows so enlarged text does not require side-scrolling. */\n      .lens-matrix,',
   '    @media (max-width: 720px) {\n      .lens-matrix,'],
  ['      .lens-matrix td:nth-child(n) { width: 100%; }\n',''],
  ['      .lens-matrix td:last-child { border-bottom: 0; }\n\n    @media (max-width: 720px) {\n      .header-inner,',
   '      .lens-matrix td:last-child { border-bottom: 0; }\n\n      .header-inner,'],
];
function beforeApprovedMatrixStyles(html){
  for(const [current,prior]of matrixStyleInverses){
    assert.equal(html.split(current).length-1,1,'Exactly one approved table CSS hunk');
    html=html.replace(current,prior);
  }
  return html;
}
const scoreColorRule='    .score-block .score-num {\n      color: #fff;\n';
const sampleLinkStyle='    .content .score-block p,\n'+
  '    .content .score-block a,\n'+
  '    .content .score-block a:hover,\n'+
  '    .content .score-block a:focus-visible {\n'+
  '      color: #fff;\n'+
  '    }\n\n'+
  '    .content .score-block a {\n'+
  '      text-decoration: underline;\n'+
  '      text-underline-offset: 0.18em;\n'+
  '    }\n\n';
function assertArticleLayout(html,prior,file){
  html=beforeApprovedArticleTopicNavigation(file,html);
  // The reviewed annual-release pages intentionally replaced invented example
  // scores with links to real saved samples. Pin that approved structure while
  // retaining the exact accessibility-region and table-style checks above.
  beforeApprovedMatrixRegion(articleMain(html));beforeApprovedMatrixStyles(html);
  const priorEntry=articleMain(prior).match(/<div class="cta reveal">[\s\S]*?<a class="btn btn-primary" href="([^"]+)"/)?.[1];
  assert.match(priorEntry,/^signin\.html\?next=[a-z-]+\.html$/,'Historical article entry is the exact diagnostic sign-in target');
  const invitationEntry='<a class="btn btn-primary" href="pilot.html">';
  assert.equal(articleMain(html).split(invitationEntry).length-1,1,'Exactly one article-body invitation entry replaces the retired public run CTA');
  // Restore the exact reviewed copy layers only for historical structure;
  // the current prose, accessibility, styles and negative checks stay above/below.
  const historicalLayoutSource=sourceBeforePublicCopyClarity(file,html);
  const restoredMain=articleMain(historicalLayoutSource).replace(invitationEntry,`<a class="btn btn-primary" href="${priorEntry}">`);
  assert.deepEqual(textless(restoredMain),textless(articleMain(prior)),
    'Body tags, classes and links match the approved saved-sample article layout');
  assert.equal(html.split(sampleLinkStyle).length-1,1,'Exactly one scoped saved-sample link contrast fix');
  assert.equal(html.split('canonical-site-shell.js?v=20260915.consistency1').length-1,1,'Exactly one current shared shell reference');
  const restored=sourceAtMarketingPhotoPresentationBaseline(file,html).replace(sampleLinkStyle,'').replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');
  for(const tag of ['script','style'])assert.deepEqual(restored.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    prior.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    tag+' matches the approved presentation; no unrelated behavior or CSS changes');
}
for(const [name,description,article]of descriptions){
  for(const file of sourceFiles.slice(0,6).filter(file=>!['site-shell/footer.html','scripts/templates/home-workspace-preview.html'].includes(file)))check(read(file).includes(description),`${file}: ${name} business description`);
  check(read(article).includes(`<p class="hero-taxonomy"><em>${description}</em></p>`),article+' canonical hero');
  const table=read(article).match(/<table class="lens-matrix">[\s\S]*?<\/table>/)?.[0];
  check(table?.includes('<th>Business focus</th>'),article+' comparison header');
  for(const row of descriptions)check(table.includes(`<td>${row[1]}</td>`),article+' comparison: '+row[0]);
  const html=read(article),main=articleMain(html);
  const articleBeforeTopics=beforeApprovedArticleTopicNavigation(article,html);
  eq(articleBeforeTopics,execFileSync('git',['show',`1858c1bfef88e9407b7cd900fb840f230de8bed7:${article}`],{cwd:root,encoding:'utf8'}),article+': only the exact approved navigation and stylesheet differ from actual1858');
  const neutral='<p data-topic-view-neutral="true">Neutral source-only control.</p>';
  eq(beforeApprovedArticleTopicNavigation(article,html.replace('</main>',neutral+'</main>')),articleBeforeTopics.replace('</main>',neutral+'</main>'),article+': unrelated body mutation survives fragment view byte-for-byte');
  assertArticleScope(html.replace('</main>',neutral+'</main>'),article);checks++;
  const topicBlock=html.slice(html.indexOf(articleTopicStart),html.indexOf(articleTopicEnd)+articleTopicEnd.length);
  const badTopicNavigation=[
    html.replace(topicBlock,''),html.replace(topicBlock,topicBlock+topicBlock),
    html.replace(topicBlock,topicBlock.replace('research-topic-nav','research-topic-changed')),
    html.replace(topicBlock,topicBlock.replace('Related articles','Changed related articles')),
    html.replace(topicBlock,topicBlock.replace('href="research-topics.html','href="unknown.html')),
    html.replace(topicBlock,'').replace('</main>','</main>'+topicBlock),
    html.replace(articleTopicStyle,''),html.replace(articleTopicStyle,articleTopicStyle+articleTopicStyle),
    html.replace(articleTopicStyle,articleTopicStyle.replace('20261017.1','UNKNOWN')),
    html.replace(articleTopicStyle,'').replace('</main>',articleTopicStyle+'</main>'),
  ];
  for(const bad of badTopicNavigation){
    assert.notEqual(bad,html,'Each owner-navigation negative changes its intended fragment');
    assert.throws(()=>beforeApprovedArticleTopicNavigation(article,bad),/Exact approved article topic navigation/);checks++;
  }
  assert.throws(()=>beforeApprovedArticleTopicNavigation('unknown-article.html',html),/closed four article paths/);checks++;
  assertArticleScope(html,article);checks++;
  for(const phrase of ['the participant’s selected perspective, recorded strengths and concerns','A single run does not establish organization-wide conditions or change over time.',
    singleRunFinancialBoundary,'Multi-participant example','Actual output from realistic example responses',
    'compares responses from several people.','realistic example responses, not customer results.',
    'Recorded findings','Reported strengths','Next step'])
    check(main.includes(phrase),article+': truthful report scope '+phrase);
  const sampleKey={Structural:'sc',Decision:'dv',Operational:'os',Institutional:'ip'}[name.split(' ')[0]];
  check(main.includes('href="sample-report.html#'+sampleKey+'"'),article+': actual same-Diagnostic sample destination');
  check(!/Example score|Example band|class="score-num"/.test(main),article+': no invented score in the article illustration');
  check(html.includes('records one participant’s perspective on'),article+': matching social/search description');
  const prior=execFileSync('git',['show',`${approvedPresentationBase}:${article}`],{cwd:root,encoding:'utf8'});
  assertArticleLayout(html,prior,article);checks++;
  // The earlier approved canonical-copy edit also renamed the mobile table's
  // generated label. Restore only that exact text when proving layout parity.
  eq(html.split('content: "Business focus"').length-1,1,article+': mobile table label');
  eq(html.split(scoreColorRule).length-1,1,article+': exact score-only contrast fix');
  const badLayouts=[
    html.replace(matrixRegion,matrixRegion.replace('role="region"','role="group"')),
    html.replace(matrixRegion,matrixRegion.replace('Compare the four diagnostics','A different label')),
    html.replace(matrixRegion,matrixRegion.replace('tabindex="0"','tabindex="-1"')),
    html.replace(matrixRegion,matrixRegion.replace('>',' hidden>')),
    html.replace(matrixRegion,''),
    html.replace(matrixRegion,matrixRegion+'\n'+matrixRegion),
    html.replace(matrixRegion,matrixRegion+'<p>Extra content</p>'),
    html.replace('<table class="lens-matrix">','<table class="lens-matrix" aria-hidden="true">'),
    html.replace('<th>Business focus</th>','<th class="changed">Business focus</th>'),
    html.replace(main,main.replace('href="pilot.html"','href="changed.html"')),
    html.replace('overflow-x: auto; margin: 1.75rem 0;','overflow-x: hidden; margin: 1.75rem 0;'),
    html.replace('font-size: 0.95rem; }','font-size: 0.85rem; }'),
    html.replace('width: 29%;','width: 20%;'),
    html.replace(matrixStyleInverses[1][0],''),
    html.replace(matrixStyleInverses[1][0],matrixStyleInverses[1][0]+'\n'+matrixStyleInverses[1][0]),
    html.replace(sampleLinkStyle,''),
    html.replace(sampleLinkStyle,sampleLinkStyle+sampleLinkStyle),
    html.replace(sampleLinkStyle,sampleLinkStyle.replace('color: #fff;','color: #6E6F73;')),
    html.replace(sampleLinkStyle,sampleLinkStyle.replace('a:focus-visible','a:focus')),
    html.replace(sampleLinkStyle,sampleLinkStyle.replace('text-decoration: underline;','text-decoration: none;')),
    html.replace('</style>','.unrelated { display: none; }</style>'),
  ];
  for(const [index,bad]of badLayouts.entries()){
    assert.notEqual(bad,html,'Each article-layout negative must mutate the source');
    assert.doesNotThrow(()=>beforeApprovedArticleTopicNavigation(article,bad),'Every original layout mutant retains valid owner navigation before its own predicate runs');checks++;
    assert.throws(()=>assertArticleLayout(bad,prior,article),article+': unrelated markup/CSS or altered approved wrapper must fail: '+index);checks++;
  }
  for(const bad of ['Approximate recoverable value','Benchmark position','Trajectory signal','Reclaimed capacity','clock speed of reality']){
    const candidate=html.replace('</main>',`<p>${bad}</p></main>`);
    assert.doesNotThrow(()=>beforeApprovedArticleTopicNavigation(article,candidate),'Every original appended-claim mutant retains valid owner navigation');checks++;
    assert.throws(()=>assertArticleScope(candidate,article),/No superseded whole-article/);checks++;
  }
  for(const bad of [
    html.replace(singleRunFinancialBoundary,singleRunFinancialBoundary.replace('does not establish','establishes')),
    html.replace(singleRunFinancialBoundary,singleRunFinancialBoundary+' Recoverable savings are calculated for your organization.'),
    html.replace('records one participant’s perspective on','calculates recoverable savings from'),
  ]){
    assert.notEqual(bad,html,'Each financial-language mutation changes the source');
    assert.doesNotThrow(()=>beforeApprovedArticleTopicNavigation(article,bad),'Every original prose/metadata claim mutant retains valid owner navigation');checks++;
    assert.throws(()=>assertArticleScope(bad,article),/No superseded whole-article/);checks++;
  }
}
for(const file of sourceFiles)check(!/What sits beneath performance\?|How much weight is it carrying\?/i.test(read(file)),file+' no superseded metaphor label');
for(const file of ['roi.html','platform-services.html','plan-signal.html','plan-pattern.html']){
  const html=read(file).replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1'),prior=execFileSync('git',['show',`${approvedPresentationBase}:${file}`],{cwd:root,encoding:'utf8'});
  {
    const html=sourceAtMarketingPhotoPresentationBaseline(file,sourceAtReleaseBaseline(file,read(file))).replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');
  for(const tag of ['script','style',...(file==='roi.html'?[]:['svg'])])eq(html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    prior.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),file+': existing behavior and graphics unchanged');
  }
  eq(html.match(/<(?:input|select|option|button)\b[^>]*>/g),prior.match(/<(?:input|select|option|button)\b[^>]*>/g),file+': calculator and plan controls unchanged');
  check(!html.includes('How Diagnostic results inform a directional ROI scenario'),file+': no old result-to-ROI link');
}
for(const file of ['plan-signal.html','plan-pattern.html','platform-services.html'])check(read(file).includes('How separate operational inputs inform a cost scenario'),file+': separate-input explanation');
for(const phrase of ['Neither a Diagnostic score nor a participant count supplies a financial factor.',
  'They are not forecasts, confidence intervals or validated estimates of likely savings.','a Diagnostic score does not calculate savings.',
  'Implementation and subscription costs can exceed the modeled value.',
  'potential staff capacity at the entered hourly cost, not a cash saving.'])check(read('roi.html').includes(phrase),'ROI scope: '+phrase);
const roi=read('roi.html'),priorRoi=execFileSync('git',['show',`${articleBase}:roi.html`],{cwd:root,encoding:'utf8'});
const retiredRoiSvg=/<svg\b[^>]*aria-label="(?:Score in sector context|Where annual labor capacity goes)"[^>]*>[\s\S]*?<\/svg>/g;
eq([...priorRoi.matchAll(retiredRoiSvg)].length,2,'Both exact retired financial/reference diagrams are identified');
eq(roi.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g),priorRoi.replace(retiredRoiSvg,'').match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g),'Only the two retired ROI diagrams are removed');
const roiLegacy=roi.match(/<div class="roi-legacy"[\s\S]*?<!-- ── CTA/)?.[0];
const assertRoiIllustrationScope=html=>assert.doesNotMatch(html,/DESIGN REFERENCE RANGE|OPPORTUNITY RANGE|26–41%|7–12%|\$\d|\b(?:recoverable burden|dimension dollars|role-specific signal)\b/i,'No retired financial/reference illustration');
assertRoiIllustrationScope(roiLegacy);checks++;
for(const bad of ['DESIGN REFERENCE RANGE','26–41%','$437K','Dimension dollars']){
  assert.throws(()=>assertRoiIllustrationScope(roiLegacy+' '+bad),/No retired financial/);checks++;
}
eq((roi.match(/class="stats operational-scenario-map"/g)||[]).length,2,'Two nonnumeric operational explanations replace the diagrams');
check(roi.includes('<div class="roi-legacy" hidden aria-hidden="true">'),'Existing legacy visibility remains unchanged');
for(const phrase of ['Scope','Records','Overlap','Ranges','Costs','Cases'])check(roi.includes('<b>'+phrase+'</b>'),'Nonnumeric ROI explanation: '+phrase);
for(const phrase of ['A single run does not estimate organizational savings.','potential staff capacity is not cash savings.',
  'does not calculate either from Diagnostic scores.','One participant’s result does not establish organization-wide performance.'])
  check(read('platform-services.html').includes(phrase),'Platform scope: '+phrase);
const method=read('diagnostics.html').match(/<section\b[^>]*id="methodology-and-sources"[\s\S]*?<\/section>/)?.[0];
check(method,'Substantive methods section exists');
for(const phrase of ['draws on selected guidance','Monderman\'s scoring and readiness rules are its own',
  'data-method-review-status="not_reviewed"','Independent statistical review:','not reviewed',
  'excluding a response does not shrink that population','Repeated runs do not increase participation',
  'not claimed as AAPOR response rates','participation alone does not establish representativeness',
  'same instrument score band','Small-group display limits protect privacy','not independent scientific review'])
  check(method.includes(phrase),'Method boundary: '+phrase);
check(method.includes('https://aapor.org/standards-and-ethics/standard-definitions/'),'Primary AAPOR source');
check(method.includes('https://www.gao.gov/products/gao-20-195g'),'Primary GAO source');
for(const phrase of ['Our participation checks draw on','transparent accounting of participation and missing responses'])check(method.includes(phrase),'Selected AAPOR guidance only: '+phrase);
for(const phrase of ['cost scenarios draw on selected practices','defining scope and documenting activity measurements, source references, assumptions','implementation costs and subscription costs','Customer-defined low, central and high cases compare combined assumptions.','not full compliance with the guide','Potential staff capacity is shown separately from cash effects','does not independently audit the source records','not forecasts or measured savings'])check(method.includes(phrase),'Financial method boundary: '+phrase);
check(!/We follow the guidance in|low, central and high sensitivity ranges/.test(method),'No full AAPOR-method or GAO sensitivity-procedure implication');
const reportMethod=read('monderman-report.js').match(/function renderMetaMethod\(m, n\) \{[\s\S]*?(?=\n  function renderMetaSynthesis)/)?.[0];
for(const phrase of ['informed by selected published','AAPOR has not validated them.','documents scope, inputs, assumptions and costs, informed by selected practices','Customer-defined low, central and high cases compare combined assumptions.','not GAO approval, full compliance or a validated savings method.'])check(reportMethod?.includes(phrase),'Report methods share the same attribution boundary: '+phrase);
check(!/costs and sensitivity ranges/.test(reportMethod),'Report does not attribute joint scenarios to GAO sensitivity procedure');
check(!/AAPOR[- ](?:approved|compliant|certified)|GAO[- ](?:approved|compliant|certified)|scientifically validated/i.test(method),'No external approval claims');
check(read('index.html').includes('Use measured activity records and documented assumptions to compare potential staff capacity and separate cash effects.'),'Plain homepage description uses separate operational records');
const scenarioSlide=read('Monderman_Platform_Brief.html').match(/<section[^>]*id="slide-8"[\s\S]*?<\/section>/)?.[0];
for(const phrase of ['Separate operational scenarios from diagnostic scores.','No diagnostic score or participant percentage supplies a financial factor.','Cash avoided minus cash costs','not forecasts, confidence intervals, or guarantees.'])check(scenarioSlide?.includes(phrase),'Brief financial boundary: '+phrase);
check(!/\$411,840|5,280 hrs|Diagnostic result \+ disclosed sizing inputs/.test(scenarioSlide),'Old score-derived numerical graphic removed, not relabeled');
check(read('sample-report.html').includes('Explore four response comparisons and two Synthesis reports.')&&read('sample-report.html').includes('href="diagnostics.html#methodology-and-sources"'),'Sample introduction identifies the current multi-participant library and links to its method');
for(const file of ['index.html','site-shell/footer.html','Monderman_Platform_Brief.html'])
  check(read(file).includes('href="diagnostics.html#methodology-and-sources"'),file+' methods link');

// Exercise the real shared-footer injector in a fresh, disposable local build.
for(const entry of fs.readdirSync(root,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.html'))
  fs.copyFileSync(path.join(root,entry.name),path.join(build,entry.name));
execFileSync(process.execPath,['scripts/inject-public-shell.mjs',build],{cwd:root,stdio:'pipe'});
const baselineBuild=path.join(out,'baseline-public');fs.mkdirSync(baselineBuild,{mode:0o700});
fs.writeFileSync(path.join(baselineBuild,'index.html'),marketingBaselineHomepage,{mode:0o600});
execFileSync(process.execPath,['scripts/inject-public-shell.mjs',baselineBuild],{cwd:root,stdio:'pipe'});
const builtBaselineHomepage=fs.readFileSync(path.join(baselineBuild,'index.html'));
for(const file of ['index.html','diagnostics.html','sample-report.html',...protectedFiles.filter(file=>file.endsWith('.html'))]){
  const html=fs.readFileSync(path.join(build,file),'utf8');
  check(/<footer\b[\s\S]*href="diagnostics.html#methodology-and-sources"[\s\S]*<\/footer>/.test(html),file+' built shared-footer link');
}
if(copyOnly){
  for(const [file,hash]of Object.entries(hashes))eq(sha(fs.readFileSync(path.join(root,file))),hash,'Source unchanged during copy checks: '+file);
  const receipt={status:'COPY_ONLY_PASS',checks,browsers:[],viewports:[],layoutTested:false,sourceHashes:hashes,
    proofScope:'Static copy and real shared-footer injection only. Browser layout, authenticated workflows, sample approval and deployment were not tested.'};
  fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:receipt.status,checks,output:out,layoutTested:false}));
  process.exit(0);
}

const origin='http://monderman-copy.test';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml',
  '.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const screenshots=[];
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    let homepageEdition='current';
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){blockedRequests++;await route.abort();return;}
      if(homepageEdition==='baseline'&&url.pathname==='/index.html'){await route.fulfill({contentType:'text/html',body:builtBaselineHomepage});return;}
      const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),base=relative.endsWith('.html')?build:root;
      const file=path.resolve(base,relative||'index.html');
      if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
    });
    const pageEditions=['index.html','diagnostics.html','Monderman_Platform_Brief.html','roi.html',...descriptions.map(row=>row[2])].flatMap(file=>file==='index.html'?[{file,edition:'baseline'},{file,edition:'current'}]:[{file,edition:'current'}]);
    for(const {file,edition} of pageEditions){
      homepageEdition=edition;
      await page.goto(origin+'/'+file,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${width}/${file}: no page overflow`);
      check(await page.locator('footer a[href="diagnostics.html#methodology-and-sources"]').count()===1,`${file} footer link rendered`);
      if(file==='roi.html'){
        check(!await page.locator('.roi-legacy').isVisible(),'Legacy wrapper remains hidden in the real page');
        eq(await page.locator('.exposure-band input,.return-band input').count(),6,'All existing calculator inputs remain available');
        for(const [id,value]of Object.entries({roiPeople:'10',roiHours:'2',roiCycles:'12',roiRate:'50',roiRecovery:'25',roiIntervention:'5000'}))await page.locator('#'+id).fill(value);
        for(const [id,value]of Object.entries({roiAnnualHours:'240',roiAnnualCost:'$12,000',roiFte:'0.1',roiRecoveryValue:'$3,000',roiNetValue:'−$2,000',roiBenefitCost:'0.6×'}))eq(await page.locator('#'+id).textContent(),value,'Unchanged calculator output: '+id);
        await page.locator('#roiRecovery').fill('0');eq(await page.locator('#roiNetValue').textContent(),'−$5,000','Zero recovery still shows loss');
        await page.locator('#roiIntervention').fill('0');eq(await page.locator('#roiBenefitCost').textContent(),'Unavailable','Zero intervention avoids invented ratio');
        await page.locator('#roiPeople').focus();await page.keyboard.press('Tab');eq(await page.evaluate(()=>document.activeElement?.id),'roiHours','Calculator keyboard order retained');
        eq(await page.locator('.model-actions a').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('href'))),['diagnostics.html','sample-report.html'],'Both existing report/action destinations retained');
        check(await page.locator('.exposure-shell,.return-shell').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),'Visible calculator fits');
        if((name==='chromium'&&width===390)||(name==='webkit'&&width===1440)){
          const fileName=`${name}-${width}-roi-calculator.png`;await page.locator('.return-shell').screenshot({path:path.join(out,fileName)});screenshots.push(fileName);
        }
        // Test-only visibility override inspects the replacement source layouts.
        // This is not a production visibility change or new published feature.
        await page.locator('.roi-legacy').evaluate(el=>{el.hidden=false;el.removeAttribute('aria-hidden');el.style.setProperty('display','block','important');});
        eq(await page.locator('.operational-scenario-map .stat b').allTextContents(),['Scope','Records','Overlap','Ranges','Costs','Cases'],'Operational map labels are nonnumeric');
        check(await page.locator('.figgrid,.roi-legacy .stats,.axes').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),'Replacement layouts fit phone, tablet and desktop');
        check(await page.locator('.figgrid h4,.figgrid b,.figgrid span,.figgrid .cap,.axes span').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})),'All replacement text fits the viewport');
        if((name==='chromium'&&width===390)||(name==='webkit'&&width===1440)){
          const fileName=`${name}-${width}-roi-replacement-test-only.png`;await page.locator('.figgrid').screenshot({path:path.join(out,fileName)});screenshots.push(fileName);
        }
      }
      if(descriptions.some(row=>row[2]===file)){
        eq(await page.locator('.lens-matrix tbody tr td:nth-child(2)').allTextContents(),currentDescriptionDisplayOrder.map(row=>row[1]),'Article comparison labels rendered');
        check(await page.locator('.lens-matrix').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Comparison table fits');
        const figure=page.locator('.output-figure');await figure.scrollIntoViewIfNeeded();
        eq(await figure.locator('.output-metrics .metric strong').allTextContents(),['Perspective','Reported strengths','Next step'],'No outdated financial/comparison cards');
        check(await figure.locator('.figure-note').textContent().then(text=>text.includes('compares responses from several people.')&&text.includes('realistic example responses, not customer results.')),'Multi-participant sample provenance remains visible without changing the single-run guide');
        check(await figure.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Report card fits');
        eq(await figure.locator('.score-num').count(),0,'No invented score in the article figure');
        const sampleKey={Structural:'sc',Decision:'dv',Operational:'os',Institutional:'ip'}[descriptions.find(row=>row[2]===file)[0].split(' ')[0]];
        eq(await figure.locator('.score-block a').getAttribute('href'),'sample-report.html#'+sampleKey,'Figure opens the actual corresponding saved sample');
        const sampleLink=figure.locator('.score-block a');
        const sampleContrast=()=>sampleLink.evaluate(el=>{
          const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
          const luminance=values=>values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
          const foreground=getComputedStyle(el).color,background=getComputedStyle(el.closest('.score-block')).backgroundColor,a=luminance(rgb(foreground)),b=luminance(rgb(background));
          return {foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:parseFloat(getComputedStyle(el).fontSize),underline:getComputedStyle(el).textDecorationLine,focusVisible:el.matches(':focus-visible')};
        });
        await page.mouse.move(0,0);await sampleLink.evaluate(el=>el.blur());
        for(const state of ['normal','hover','focus']){
          if(state==='hover')await sampleLink.hover();
          if(state==='focus'){await page.mouse.move(0,0);await page.keyboard.press('Tab');await sampleLink.focus();await page.keyboard.press('ArrowRight');}
          const contrast=await sampleContrast();
          eq(contrast.foreground,'rgb(255, 255, 255)','Saved-sample link remains white: '+state);
          check(contrast.ratio>=4.5&&contrast.underline.includes('underline'),'Actual saved-sample link meets normal-text contrast and remains visibly identifiable: '+state+' '+JSON.stringify(contrast));
          if(state==='focus')check(contrast.focusVisible,'Saved-sample link receives keyboard-visible focus');
        }
        check(await figure.locator('h3,p,strong,span,small').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})),'All article output text stays within viewport');
        eq(await page.locator('.cta a').getAttribute('href'),'pilot.html','Article entry requests an invitation instead of offering a public diagnostic');
        eq(await page.locator('.cta a').textContent(),'Request an invitation','Article entry names the actual invitation action');
        if((name==='chromium'&&width===390)||(name==='webkit'&&width===1440)){
          const fileName=`${name}-${width}-${file.replace('.html','')}-output.png`;await figure.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);
        }
      }
      if(file==='Monderman_Platform_Brief.html'){
        await page.goto(origin+'/Monderman_Platform_Brief.html#slide-8',{waitUntil:'load'});
        const slide=page.locator('#slide-8');await slide.scrollIntoViewIfNeeded();
        check(await slide.locator('.economics-map').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Updated non-numeric economics map fits');
        check(await slide.locator('h2,h3,p,strong,b,small').evaluateAll(nodes=>nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})),'Scenario text fits phone/tablet/desktop');
        eq(await slide.locator('.actions a').getAttribute('href'),'diagnostics.html#methodology-and-sources','Brief explanation points to current method');
        const fileName=`${name}-${width}-operational-method.png`;await slide.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);
      }
      if(file==='index.html'){
        const journeyGroups=(edition==='baseline'?['structural_clarity','decision_velocity','operational_systems','institutional_performance']:['structural_clarity','operational_systems','decision_velocity','institutional_performance']).map(lens=>previewGroups.find(group=>group.tool_type===lens));
        eq(await page.locator('.hwd-compact-lenses span').allTextContents(),journeyGroups.map(group=>group.tool_label),'Gather identifies all four canonical source diagnostics');
        const roles=artifact.outputs.cross_lens_synthesis.source.campaign_evidence.depth.lenses[0].requiredGroups;
        eq(await page.locator('.hwd-compact-roles strong').allTextContents(),roles.map(group=>String(group.participants)),'Gather uses distinct source role counts, never sums across diagnostics');
        eq(await page.locator('.hwd-compact-roles span').allTextContents(),roles.map(group=>group.label),'Role labels remain source-owned');
        eq(await page.locator('input[name="hwd-journey"],.hwd-journey-choice,.hwd-choose').count(),0,'The compact four-step journey has no obsolete five-analysis selector');
        eq(await page.locator('.hwd-compact-tile h3').allTextContents(),['Overall findings','Time and money','Change options','Evidence'],'Evaluate retains the approved compact overview');
        for(const id of ['measure','analysis','actions','return','measure']){
          await page.locator('#hwd-tab-'+id).click();await settledPaint(page,settledPreviewState,id);
          check(await page.locator('#hwd-panel-'+id).isVisible(),'Preview still navigates: '+id);
          check(await page.locator('.hwd-sample-link').isVisible(),'Direct sample CTA is visible in every step');
          eq(await page.locator('.hwd-sample-link').getAttribute('href'),'sample-report.html#synthesis','Every step opens the actual Cross-Lens sample');
          const journeyGeometry=await page.locator('.home-workspace-preview').evaluate(el=>{
            const box=node=>{if(!node)return null;const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {width:r.width,height:r.height,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,margin:s.margin};};
            const panel=el.querySelector('.hwd-panel:not([hidden])');
            return {viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},selectedPanel:panel?.id,
              fontsStatus:document.fonts.status,neueHaasAvailable:document.fonts.check('12px "Neue Haas Grotesk"'),
              disclosureOpen:el.querySelector('.home-preview-method')?.open,preview:box(el),app:box(el.querySelector('[data-workspace-demo]')),
              label:box(el.querySelector('.home-preview-label')),topbar:box(el.querySelector('.hwd-topbar')),tabs:box(el.querySelector('.hwd-tabs')),
              panel:box(panel),heading:box(panel?.querySelector('h2')),quad:box(panel?.querySelector('.hwd-compact-quad')),
              footer:box(el.querySelector('.hwd-footer')),disclosure:box(el.querySelector('.home-preview-method')),
              widthFits:el.querySelector('[data-workspace-demo]').scrollWidth<=el.querySelector('[data-workspace-demo]').clientWidth+1,
              eyebrowSize:parseFloat(getComputedStyle(panel.querySelector('.hwd-eyebrow')).fontSize),
              paragraphSizes:[...panel.querySelectorAll('p:not(.hwd-eyebrow)')].filter(node=>node.getClientRects().length).map(node=>parseFloat(getComputedStyle(node).fontSize)),
              actionProseSizes:[...panel.querySelectorAll('.hwd-compact-action dd')].filter(node=>node.getClientRects().length).map(node=>parseFloat(getComputedStyle(node).fontSize)),
              tabSizes:[...el.querySelectorAll('.hwd-tabs button')].map(node=>parseFloat(getComputedStyle(node).fontSize)),
              sampleLinkSize:parseFloat(getComputedStyle(el.querySelector('.hwd-sample-link')).fontSize),
              contentContained:[...el.querySelector('[data-workspace-demo]').querySelectorAll('h2,h3,p,a,button,strong,span,dt,dd')].filter(node=>node.getClientRects().length).every(node=>{const r=node.getBoundingClientRect(),outer=el.getBoundingClientRect();return r.left>=outer.left-1&&r.right<=outer.right+1&&r.top>=outer.top-1&&r.bottom<=outer.bottom+1;})};
          });
          journeyGeometryReceipts.push({browser:name,width,edition,step:id,...journeyGeometry});
          if(edition==='baseline'){
          // The reviewed height target is the app card. The outer label and
          // closed disclosure add 60.5px in the source-bound CUA measurements.
          // CI Chromium's reviewed complete paint wraps one extra line:
          // 569.797px versus macOS 555.63px. Allow 20px over the 560px target.
          const desktopFontWrapAllowance=20;
          const appLimit=width===1440?560+desktopFontWrapAllowance:700,wrapperLimit=appLimit+64;
          const wrapperOverhead=journeyGeometry.preview.height-journeyGeometry.app.height;
          const diagnostic={browser:name,width,step:id,desktopFontWrapAllowance,appLimit,wrapperLimit,wrapperOverhead,...journeyGeometry};
          console.log(JSON.stringify({check:'compact-journey-height',...diagnostic}));
          if(journeyGeometry.app.height>appLimit||journeyGeometry.preview.height>wrapperLimit||wrapperOverhead>64){
            const failureScreenshot=`${name}-${width}-${id}-journey-height-failure.png`;
            await page.locator('.home-workspace-preview').screenshot({path:path.join(out,failureScreenshot)});screenshots.push(failureScreenshot);
          }
          check(journeyGeometry.disclosureOpen===false,'Height is measured with the evidence disclosure closed');
          check(journeyGeometry.app.height<=appLimit,'Journey app remains within the approved compact height target: '+JSON.stringify(diagnostic));
          check(wrapperOverhead>=0&&wrapperOverhead<=64,'Outer label and closed disclosure stay within their reviewed height allowance: '+JSON.stringify(diagnostic));
          check(journeyGeometry.preview.height<=wrapperLimit,'Complete preview stays within the app target plus bounded wrapper: '+JSON.stringify(diagnostic));
          }else{
            console.log(JSON.stringify({check:'refreshed-journey-height',browser:name,width,edition,step:id,...journeyGeometry}));
            assertRefreshedJourneyGeometry(journeyGeometry,width,id);checks++;
          }
          check(await page.locator('[data-workspace-demo]').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Every current step fits the preview width');
        }
        if(width===390||width===1440){const fileName=`${name}-${width}-${edition}-homepage.png`;await page.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);}
      }
      if(file==='diagnostics.html'){
        const team=page.locator('.dx-team-view-grid');
        const cards=await team.locator('.dx-step').evaluateAll(nodes=>nodes.map(el=>{
          const heading=el.querySelector('h3').getBoundingClientRect(),box=el.getBoundingClientRect(),style=getComputedStyle(el);
          return {left:heading.left,right:box.right,inset:heading.left-box.left,border:style.borderTopWidth,font:parseFloat(getComputedStyle(el.querySelector('p')).fontSize),fits:el.scrollWidth<=el.clientWidth+1};
        }));
        eq(cards.length,4,'Individual/team overview retains all four report modes');
        check(cards.every(card=>card.inset===0&&card.border==='1px'&&card.font>=16&&card.fits),'Every reading card has matching rule, inset and readable body text');
        if(width>900){eq(cards[0].left,cards[2].left,'Left-column headings align');eq(cards[1].left,cards[3].left,'Right-column headings align');}
        else check(cards.every(card=>card.left===cards[0].left),'All stacked headings align at phone/tablet widths');
        const teamFile=`${name}-${width}-team-overview.png`;await team.screenshot({path:path.join(out,teamFile)});screenshots.push(teamFile);
        await page.goto(origin+'/diagnostics.html#methodology-and-sources',{waitUntil:'load'});
        await page.evaluate(()=>document.fonts.ready);
        await settledPaint(page,settledHeaderState);
        const section=page.locator('#methodology-and-sources');
        const geometry=await section.evaluate(el=>({top:el.getBoundingClientRect().top,header:document.querySelector('#siteHeader')?.getBoundingClientRect().bottom||0,
          outside:[...el.querySelectorAll('h2,h3,p,a')].filter(node=>{const r=node.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).length,
          sizes:[...el.querySelectorAll('.dx-step p')].map(node=>parseFloat(getComputedStyle(node).fontSize))}));
        check(geometry.top>=geometry.header-1,'Anchor clears fixed header');eq(geometry.outside,0,'Method text stays within viewport');
        check(geometry.sizes.every(size=>size>=16),'Method body remains readable');
        const detail=section.locator('.dx-method-detail');
        eq(await detail.getAttribute('open'),null,'Technical detail starts collapsed beneath the plain-language introduction');
        check(!(await section.locator('[data-method-financial]').isVisible()),'Technical mapping is not duplicated in the initial reading path');
        const viewportBefore=`${name}-${width}-methodology-viewport-before-focus.png`;
        await page.screenshot({path:path.join(out,viewportBefore)});screenshots.push(viewportBefore);
        await detail.locator('summary').click();
        check(await section.locator('[data-method-financial]').isVisible(),'Implemented financial practice mapping is visible after opening the technical detail');
        const source=detail.locator('a[href="https://aapor.org/standards-and-ethics/standard-definitions/"]');
        eq(await source.evaluate(el=>getComputedStyle(el).color),'rgb(12, 110, 120)','Source link visibly teal');
        await source.hover();
        await page.waitForFunction(()=>getComputedStyle(document.querySelector('#methodology-and-sources .dx-step a')).color==='rgb(10, 91, 99)');
        eq(await source.evaluate(el=>getComputedStyle(el).color),'rgb(10, 91, 99)','Source link hover remains teal');
        await page.mouse.move(0,0);await page.keyboard.press('Tab');await source.focus();await page.keyboard.press('ArrowRight');
        await page.waitForFunction(()=>{const el=document.querySelector('#methodology-and-sources .dx-step a');return el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3;});
        check(await source.evaluate(el=>el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3),'Source link has visible keyboard focus');
        const focusedGeometry=await source.evaluate(el=>{
          const link=el.getBoundingClientRect(),header=document.querySelector('#siteHeader')?.getBoundingClientRect();
          return {linkTop:link.top,linkBottom:link.bottom,headerTop:header?.top||0,headerBottom:header?.bottom||0,height:innerHeight};
        });
        check(focusedGeometry.linkTop>=focusedGeometry.headerBottom-1&&focusedGeometry.linkBottom<=focusedGeometry.height+1,
          'Focused methodology link stays in the actual viewport without header overlap');
        check(focusedGeometry.headerTop>=-1&&focusedGeometry.headerTop<=1,'Fixed header remains at actual viewport top');
        await settledPaint(page,settledHeaderState);
        const viewportAfter=`${name}-${width}-methodology-viewport-after-focus.png`;
        await page.screenshot({path:path.join(out,viewportAfter)});screenshots.push(viewportAfter);
        const fileName=`${name}-${width}-methodology.png`;await section.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);
      }
    }
    await page.close();
  }}finally{await browser.close();}
}
for(const [file,hash]of Object.entries(hashes))eq(sha(fs.readFileSync(path.join(root,file))),hash,'Source unchanged during checks: '+file);
const receipt={status:'PASS',checks,viewports:[390,834,1440],browsers:['chromium','webkit'],blockedRequests,sourceHashes:hashes,screenshots,homepageEditions:['baseline','current'],journeyGeometryReceipts,refreshedJourneyHeightLimits,refreshedGeometryNegativeControls,
  proofScope:'Copy, local layout and shared-footer injection only. No authenticated workflow, new sample approval, external validation or deployment.',
  sampleManifestStatus:'Preview descriptor source hash has a separate copy-only review record; saved sample data and historical generation approval are unchanged.'};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,output:out,screenshots:screenshots.length}));
