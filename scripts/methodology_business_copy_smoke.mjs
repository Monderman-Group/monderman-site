// Local copy/layout regression only. No model, production API, or publication claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  ['Institutional Performance','Consistent delivery and adaptation','institutional-performance-article.html'],
];
const sourceFiles=['index.html','diagnostics.html','workspace-diagnostics.html','Monderman_Platform_Brief.html',
  'site-shell/footer.html','scripts/templates/home-workspace-preview.html',...descriptions.map(row=>row[2]),
  'roi.html','platform-services.html','plan-signal.html','plan-pattern.html'];
const protectedFiles=['structural-clarity.html','decision-velocity.html','operational-systems.html','institutional-performance.html',
  'monderman-report.js','public-sample-model.js','sample-report-production.js','sample-data/production-diagnostic-samples.json'];
const hashes=Object.fromEntries([...sourceFiles,...protectedFiles].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
let checks=0,blockedRequests=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const eq=(value,expected,message)=>{assert.deepEqual(value,expected,message);checks++;};
// Scan every visible section and metadata description, not just the hero.
// These old affirmative product promises are not part of a single-run report.
const obsoleteArticleClaims=/\b(?:recoverable|reclaim(?:ed|able)?|reclaim potential|benchmarks?|trajectory|clock speed|pathway problem|condition beneath|compensatory|coherence diagnosis|organizational readout)\b/i;
const articleText=html=>html.replace(/<(?:script|style|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|svg)>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')
  +[...html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)].map(row=>row[1]).join(' ');
const assertArticleScope=html=>assert.doesNotMatch(articleText(html),obsoleteArticleClaims,'No superseded whole-article financial, comparison or predictive claim');
const articleBase='19bf82646048ba75799300b73caaca9366d4c387';
const articleMain=html=>html.match(/<main class="article">[\s\S]*?<\/main>/)?.[0];
const textless=html=>html.replace(/>[^<]*</g,'><');
for(const [name,description,article]of descriptions){
  for(const file of sourceFiles.slice(0,6).filter(file=>file!=='site-shell/footer.html'))check(read(file).includes(description),`${file}: ${name} business description`);
  check(read(article).includes(`<p class="hero-taxonomy"><em>${description}</em></p>`),article+' canonical hero');
  const table=read(article).match(/<table class="lens-matrix">[\s\S]*?<\/table>/)?.[0];
  check(table?.includes('<th>Business focus</th>'),article+' comparison header');
  for(const row of descriptions)check(table.includes(`<td>${row[1]}</td>`),article+' comparison: '+row[0]);
  const html=read(article),main=articleMain(html);
  assertArticleScope(html);checks++;
  for(const phrase of ['the participant’s selected perspective, recorded strengths and concerns','A single run does not establish organization-wide conditions or change over time.',
    'Illustrative report layout','Example score','Example band','the score and band above are not an assessed result.',
    'Recorded findings','Reported strengths','Next step'])
    check(main.includes(phrase),article+': truthful report scope '+phrase);
  check(html.includes('records one participant’s perspective on'),article+': matching social/search description');
  const prior=execFileSync('git',['show',`${articleBase}:${article}`],{cwd:root,encoding:'utf8'});
  eq(textless(main),textless(articleMain(prior)),article+': body tags, classes and links unchanged');
  // The earlier approved canonical-copy edit also renamed the mobile table's
  // generated label. Restore only that exact text when proving layout parity.
  eq(html.split('content: "Business focus"').length-1,1,article+': mobile table label');
  const scoreColorRule='    .score-block .score-num {\n      color: #fff;\n';
  eq(html.split(scoreColorRule).length-1,1,article+': exact score-only contrast fix');
  for(const tag of ['script','style'])eq(html.replace(scoreColorRule,'    .score-block .score-num {\n').match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),
    prior.replace('content: "The question it answers"','content: "Business focus"').match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'g')),article+': '+tag+' unchanged except approved table label');
  for(const bad of ['Approximate recoverable value','Benchmark position','Trajectory signal','Reclaimed capacity','clock speed of reality']){
    assert.throws(()=>assertArticleScope(html.replace('</main>',`<p>${bad}</p></main>`)),/No superseded whole-article/);checks++;
  }
}
for(const file of sourceFiles)check(!/What sits beneath performance\?|How much weight is it carrying\?/i.test(read(file)),file+' no superseded metaphor label');
for(const file of ['roi.html','platform-services.html','plan-signal.html','plan-pattern.html']){
  const html=read(file),prior=execFileSync('git',['show',`${articleBase}:${file}`],{cwd:root,encoding:'utf8'});
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
for(const phrase of ['draws on selected published guidance','campaign-readiness rules are Monderman\'s own methods',
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
        check(await figure.locator('.figure-note').textContent().then(text=>text.includes('not an assessed result')),'Illustrative card disclosure remains visible');
        check(await figure.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Report card fits');
        const scoreContrast=await figure.locator('.score-num').evaluate(el=>{
          const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
          const luminance=values=>values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
          const foreground=getComputedStyle(el).color,background=getComputedStyle(el.closest('.score-block')).backgroundColor,a=luminance(rgb(foreground)),b=luminance(rgb(background));
          return {foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:parseFloat(getComputedStyle(el).fontSize)};
        });
        eq(scoreContrast.foreground,'rgb(255, 255, 255)','Example score uses explicit light brand color');
        check(scoreContrast.size>=24&&scoreContrast.ratio>=3,'Large example score meets 3:1 contrast in all four articles');
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
        for(const id of ['measure','analysis','actions','return']){await page.locator('#hwd-tab-'+id).click();check(await page.locator('#hwd-panel-'+id).isVisible(),'Preview still navigates: '+id);}
        await page.locator('#hwd-tab-measure').click();
        check(await page.locator('.hwd-diagnostic p').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),'Longer canonical labels do not overflow');
        if(width===390||width===1440){const fileName=`${name}-${width}-homepage.png`;await page.screenshot({path:path.join(out,fileName)});screenshots.push(fileName);}
      }
      if(file==='diagnostics.html'){
        await page.goto(origin+'/diagnostics.html#methodology-and-sources',{waitUntil:'load'});
        await page.waitForFunction(()=>scrollY<=24||document.querySelector('#siteHeader')?.classList.contains('scrolled'));
        const section=page.locator('#methodology-and-sources');
        const geometry=await section.evaluate(el=>({top:el.getBoundingClientRect().top,header:document.querySelector('#siteHeader')?.getBoundingClientRect().bottom||0,
          outside:[...el.querySelectorAll('h2,h3,p,a')].filter(node=>{const r=node.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).length,
          sizes:[...el.querySelectorAll('.dx-step p')].map(node=>parseFloat(getComputedStyle(node).fontSize))}));
        check(geometry.top>=geometry.header-1,'Anchor clears fixed header');eq(geometry.outside,0,'Method text stays within viewport');
        check(geometry.sizes.every(size=>size>=16),'Method body remains readable');
        check(await section.locator('[data-method-financial]').isVisible(),'Implemented financial practice mapping is visible');
        const viewportBefore=`${name}-${width}-methodology-viewport-before-focus.png`;
        await page.screenshot({path:path.join(out,viewportBefore)});screenshots.push(viewportBefore);
        const source=section.locator('a[href="https://aapor.org/standards-and-ethics/standard-definitions/"]');
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
  sampleManifestStatus:'Changed preview template awaits the genuine next six-sample release manifest; historical approval was not rewritten.'};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,output:out,screenshots:screenshots.length}));
