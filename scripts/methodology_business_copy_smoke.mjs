// Local copy/layout regression only. No model, production API, or publication claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const root=path.resolve(import.meta.dirname,'..');
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
const sourceFiles=['index.html','diagnostics.html','workspace-diagnostics.html','Monderman_Platform_Brief.html',
  'site-shell/footer.html','scripts/templates/home-workspace-preview.html',...descriptions.map(row=>row[2]),
  'roi.html','platform-services.html','plan-signal.html','plan-pattern.html'];
const protectedFiles=['structural-clarity.html','decision-velocity.html','operational-systems.html','institutional-performance.html',
  'monderman-report.js','public-sample-model.js','sample-report-production.js','sample-data/production-diagnostic-samples.json',
  'homepage-workspace-demo.js','homepage-workspace-demo.css','canonical-site-shell.js','canonical-site-shell.css','scripts/inject-public-shell.mjs'];
const hashes=Object.fromEntries([...sourceFiles,...protectedFiles].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
let checks=0,blockedRequests=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
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
eq(read('homepage-workspace-demo.css').split(staticPreviewRule).length-1,1,'Only interactive preview paragraphs suppress inherited hero-entry animation');
check(read('index.html').includes('animation: heroFadeUp 900ms cubic-bezier(0.22,1,0.36,1) forwards;'),'Other hero entrance motion remains');
eq(read('homepage-workspace-demo.js'),execFileSync('git',['show','HEAD:homepage-workspace-demo.js'],{cwd:root,encoding:'utf8'}),'Actual tab behavior is unchanged');
const priorShell=execFileSync('git',['show','f91fb07fde754dea57360ddbddc9bf742d6e6702:canonical-site-shell.js'],{cwd:root,encoding:'utf8'});
const approvedShell=priorShell.replace('tagline.textContent = "See the work clearly. Make the next move count.";','if (!tagline.textContent.trim()) tagline.textContent = "Less bureaucracy. Better performance.";')
  .replace('    document.querySelectorAll(".mond-footer .mf-copy").forEach((copy) => {\n      copy.textContent = "Monderman provides repeatable organizational diagnostics for ownership, decisions, handoffs, and administrative work.";\n    });\n','');
eq(read('canonical-site-shell.js'),approvedShell,'Only approved footer ownership and fallback copy change; header state logic is unchanged');
check(read('index.html').includes('homepage-workspace-demo.css?v=20260914-preview-static1'),'Source preview stylesheet cache advances');
check(read('scripts/inject-public-shell.mjs').includes('"homepage-workspace-demo.css": "20260914-preview-static1"'),'Built preview stylesheet cache advances');
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
// Permit only this exact negative statement. Deleting "not", adding an
// affirmative claim afterward, or changing a metadata promise still fails.
const assertArticleScope=html=>assert.doesNotMatch(articleText(html).replaceAll(singleRunFinancialBoundary,''),obsoleteArticleClaims,'No superseded whole-article financial, comparison or predictive claim');
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
function assertArticleLayout(html,prior){
  // The reviewed annual-release pages intentionally replaced invented example
  // scores with links to real saved samples. Pin that approved structure while
  // retaining the exact accessibility-region and table-style checks above.
  beforeApprovedMatrixRegion(articleMain(html));beforeApprovedMatrixStyles(html);
  assert.deepEqual(textless(articleMain(html)),textless(articleMain(prior)),
    'Body tags, classes and links match the approved saved-sample article layout');
  assert.equal(html.split(sampleLinkStyle).length-1,1,'Exactly one scoped saved-sample link contrast fix');
  assert.equal(html.split('canonical-site-shell.js?v=20260915.consistency1').length-1,1,'Exactly one current shared shell reference');
  const restored=html.replace(sampleLinkStyle,'').replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1');
  for(const tag of ['script','style'])assert.deepEqual(restored.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    prior.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    tag+' matches the approved presentation; no unrelated behavior or CSS changes');
}
for(const [name,description,article]of descriptions){
  for(const file of sourceFiles.slice(0,6).filter(file=>file!=='site-shell/footer.html'))check(read(file).includes(description),`${file}: ${name} business description`);
  check(read(article).includes(`<p class="hero-taxonomy"><em>${description}</em></p>`),article+' canonical hero');
  const table=read(article).match(/<table class="lens-matrix">[\s\S]*?<\/table>/)?.[0];
  check(table?.includes('<th>Business focus</th>'),article+' comparison header');
  for(const row of descriptions)check(table.includes(`<td>${row[1]}</td>`),article+' comparison: '+row[0]);
  const html=read(article),main=articleMain(html);
  assertArticleScope(html);checks++;
  for(const phrase of ['the participant’s selected perspective, recorded strengths and concerns','A single run does not establish organization-wide conditions or change over time.',
    singleRunFinancialBoundary,'Saved example report','Actual output from realistic example responses',
    'shows its actual score, recorded answers and report text.','they are not customer results.',
    'Recorded findings','Reported strengths','Next step'])
    check(main.includes(phrase),article+': truthful report scope '+phrase);
  const sampleKey={Structural:'sc',Decision:'dv',Operational:'os',Institutional:'ip'}[name.split(' ')[0]];
  check(main.includes('href="sample-report.html#'+sampleKey+'"'),article+': actual same-Diagnostic sample destination');
  check(!/Example score|Example band|class="score-num"/.test(main),article+': no invented score in the article illustration');
  check(html.includes('records one participant’s perspective on'),article+': matching social/search description');
  const prior=execFileSync('git',['show',`${approvedPresentationBase}:${article}`],{cwd:root,encoding:'utf8'});
  assertArticleLayout(html,prior);checks++;
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
    html.replace(main,main.replace('href="signin.html?next=','href="changed.html?next=')),
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
    assert.throws(()=>assertArticleLayout(bad,prior),article+': unrelated markup/CSS or altered approved wrapper must fail: '+index);checks++;
  }
  for(const bad of ['Approximate recoverable value','Benchmark position','Trajectory signal','Reclaimed capacity','clock speed of reality']){
    assert.throws(()=>assertArticleScope(html.replace('</main>',`<p>${bad}</p></main>`)),/No superseded whole-article/);checks++;
  }
  for(const bad of [
    html.replace(singleRunFinancialBoundary,singleRunFinancialBoundary.replace('does not establish','establishes')),
    html.replace(singleRunFinancialBoundary,singleRunFinancialBoundary+' Recoverable savings are calculated for your organization.'),
    html.replace('records one participant’s perspective on','calculates recoverable savings from'),
  ]){
    assert.notEqual(bad,html,'Each financial-language mutation changes the source');
    assert.throws(()=>assertArticleScope(bad),/No superseded whole-article/);checks++;
  }
}
for(const file of sourceFiles)check(!/What sits beneath performance\?|How much weight is it carrying\?/i.test(read(file)),file+' no superseded metaphor label');
for(const file of ['roi.html','platform-services.html','plan-signal.html','plan-pattern.html']){
  const html=read(file).replace('canonical-site-shell.js?v=20260915.consistency1','canonical-site-shell.js?v=20260915.annual1'),prior=execFileSync('git',['show',`${approvedPresentationBase}:${file}`],{cwd:root,encoding:'utf8'});
  for(const tag of ['script','style',...(file==='roi.html'?[]:['svg'])])eq(html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    prior.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),file+': existing behavior and graphics unchanged');
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
check(read('sample-report.html').includes('Learn how the evidence and separate operational scenarios should be interpreted:'),'Sample introduction uses current method');
for(const file of ['index.html','site-shell/footer.html','Monderman_Platform_Brief.html'])
  check(read(file).includes('href="diagnostics.html#methodology-and-sources"'),file+' methods link');

// Exercise the real shared-footer injector in a fresh, disposable local build.
for(const entry of fs.readdirSync(root,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.html'))
  fs.copyFileSync(path.join(root,entry.name),path.join(build,entry.name));
execFileSync(process.execPath,['scripts/inject-public-shell.mjs',build],{cwd:root,stdio:'pipe'});
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
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin){blockedRequests++;await route.abort();return;}
      const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),base=relative.endsWith('.html')?build:root;
      const file=path.resolve(base,relative||'index.html');
      if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
    });
    for(const file of ['index.html','diagnostics.html','Monderman_Platform_Brief.html','roi.html',...descriptions.map(row=>row[2])]){
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
        eq(await page.locator('.lens-matrix tbody tr td:nth-child(2)').allTextContents(),descriptions.map(row=>row[1]),'Article comparison labels rendered');
        check(await page.locator('.lens-matrix').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Comparison table fits');
        const figure=page.locator('.output-figure');await figure.scrollIntoViewIfNeeded();
        eq(await figure.locator('.output-metrics .metric strong').allTextContents(),['Perspective','Reported strengths','Next step'],'No outdated financial/comparison cards');
        check(await figure.locator('.figure-note').textContent().then(text=>text.includes('shows its actual score, recorded answers and report text.')&&text.includes('they are not customer results.')),'Actual sample provenance remains visible');
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
        const target=file.replace('-article','');
        eq(await page.locator('.cta a').getAttribute('href'),'signin.html?next='+target,'Existing diagnostic sign-in route preserved');
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
        eq(await page.locator('.hwd-diagnostic p').allTextContents(),descriptions.map(row=>row[1]),'Preview labels rendered');
        for(const id of ['measure','analysis','actions','return','measure']){
          await page.locator('#hwd-tab-'+id).click();await settledPaint(page,settledPreviewState,id);
          check(await page.locator('#hwd-panel-'+id).isVisible(),'Preview still navigates: '+id);
        }
        check(await page.locator('.hwd-diagnostic p').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),'Longer canonical labels do not overflow');
        if(width===390||width===1440){const fileName=`${name}-${width}-homepage.png`;await page.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);}
      }
      if(file==='diagnostics.html'){
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
const receipt={status:'PASS',checks,viewports:[390,834,1440],browsers:['chromium','webkit'],blockedRequests,sourceHashes:hashes,screenshots,
  proofScope:'Copy, local layout and shared-footer injection only. No authenticated workflow, new sample approval, external validation or deployment.',
  sampleManifestStatus:'Preview descriptor source hash has a separate copy-only review record; saved sample data and historical generation approval are unchanged.'};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,output:out,screenshots:screenshots.length}));
