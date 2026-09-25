// Actual static build in a private copy. No publication, browser, API or sample regeneration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'monderman-runtime-build-'));
const stage=path.join(out,'source'),built=path.join(stage,'.render-public');
fs.mkdirSync(stage,{mode:0o700});
const read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const explicit=['CNAME','robots.txt','sitemap.txt','sitemap.xml','legal-document-manifest.json','public-search-index.json',
  'favicon.ico','favicon.svg','favicon-192.png','apple-touch-icon.png','Hero-Image.jpg','founder-jason-adamson.jpg','founder-elizabeth-neiford.jpg'];
const rootFiles=fs.readdirSync(root,{withFileTypes:true}).filter(row=>row.isFile()
  &&(/\.(?:html|css|js|woff2?|pdf)$/.test(row.name)||explicit.includes(row.name))).map(row=>row.name).sort();
const samplePdfs=['operational_systems','decision_velocity','structural_clarity','institutional_performance','depth_synthesis','cross_lens_synthesis'].map(name=>'sample-data/reports/'+name+'.pdf');
const protectedFiles=[...rootFiles,'sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json',...samplePdfs];
const hashes=Object.fromEntries(protectedFiles.map(file=>[file,sha(read(file))]));
for(const file of rootFiles)fs.copyFileSync(path.join(root,file),path.join(stage,file));
for(const directory of ['assets','site-shell','sample-data'])fs.cpSync(path.join(root,directory),path.join(stage,directory),{recursive:true});
fs.mkdirSync(path.join(stage,'scripts'));
for(const file of ['render-static-build.sh','inject-public-shell.mjs','configure_questionnaire_release.mjs','validate_diagnostic_inline_js.py'])
  fs.copyFileSync(path.join(root,'scripts',file),path.join(stage,'scripts',file));
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
ok(/^[a-f0-9]{40}$/.test(revision));
const buildLog=execFileSync('bash',['scripts/render-static-build.sh'],{cwd:stage,encoding:'utf8',
  env:{...process.env,RENDER_GIT_COMMIT:revision,MONDERMAN_QUESTIONNAIRE_RELEASE:'legacy'}});
ok(buildLog.includes('DIAGNOSTIC_INLINE_JS_PASS_4_OF_4'));
eq(JSON.parse(fs.readFileSync(path.join(built,'.well-known/monderman-release.json'))).revision,revision);

const injector=read('scripts/inject-public-shell.mjs').toString();
eq(injector.match(/const shellRelease = "([^"]+)";/)?.[1],'20260913.32');
const versionStart=injector.indexOf('const shellRelease ='),versionEnd=injector.indexOf('const motif =',versionStart);
ok(versionStart>=0&&versionEnd>versionStart);
const versionScript=vm.runInNewContext(injector.slice(versionStart,versionEnd)+'\nversionScript');
const annualAssets=['monderman-report.js','sample-report-production.js','public-sample-model.js','canonical-site-shell.js','workspace-theme.js'];
const consistencyAssets=['canonical-site-shell.js','workspace-assistant.js','public-product-design.css','workspace-product-design.css','report-screen-experience.css','diagnostic-intake.css','visual-polish.css','sample-report-production.css'];
const footerSupportAssets=['canonical-site-shell.js','canonical-site-shell.css','connect-widget.js','assistant.js'];
const evaluationAssets=['homepage-workspace-demo.css','homepage-workspace-demo.js','workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','first-run-telemetry.js','pilot-waitlist.js'];
const salaryAssets=['assignment-mode.js','assignment-draft.js','employer-salary-import.js','employer-salary-settings.js'];
const changed=[...new Set([...annualAssets,...consistencyAssets,...footerSupportAssets,...evaluationAssets,...salaryAssets,'sample-report-tile.css','pilot-waitlist.css','monderman-depth-lure-tile.css','campaign-analysis.js','campaign-analysis.css','workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'])];
const priorRuntimeRelease=asset=>['campaign-analysis.js','campaign-analysis.css','monderman-report.js','monderman-depth-lure-tile.css'].includes(asset)?'20260919.benefits1':['workspace-synthesis-readiness.js','workspace-synthesis-readiness.css'].includes(asset)?'20260919.ready1':['homepage-workspace-demo.js','homepage-workspace-demo.css'].includes(asset)?'20260919.journey3':['workspace-access-gate.js','workspace-evaluation.js','feedback-widget.js','assistant.js'].includes(asset)?'20260919.invited1':evaluationAssets.includes(asset)?'20260919.invitation1':asset==='connect-widget.js'?'20260917.widget-visible1':asset==='canonical-site-shell.css'?'20260916.widget-anchor1':footerSupportAssets.includes(asset)?'20260916.floating-support1':consistencyAssets.includes(asset)?'20260915.consistency1':annualAssets.includes(asset)?'20260915.annual1':'20260913.34';
const runtimeRelease=asset=>({'sample-report-production.js':'20260924.comparisons1','public-sample-model.js':'20260924.projection8','monderman-report.js':'20260925.changewording1','report-screen-experience.css':'20260921.gold1','monderman-depth-lure-tile.css':'20260925.deepteal1','homepage-workspace-demo.js':'20260924.compact1','homepage-workspace-demo.css':'20260925.reportquad1','sample-report-tile.css':'20260924.gold1','pilot-waitlist.css':'20260924.gold1','canonical-site-shell.css':'20260924.gold1','public-product-design.css':'20260924.gold1','campaign-analysis.js':'20260923.salary1','assignment-mode.js':'20260923.salary1','assignment-draft.js':'20260923.salary1','employer-salary-import.js':'20260923.1','employer-salary-settings.js':'20260923.2'}[asset])||priorRuntimeRelease(asset);
eq(read('monderman-report.js').toString().match(/const RENDERER_VERSION = "([^"]+)"/)?.[1],'diagnostic-renderer-change-wording-20260925.1','Current renderer edition has a matching build cache identity');
for(const asset of changed){
  for(const quote of ['"',"'"])for(const prefix of ['', './'])for(const query of ['', '?v=20260913.32','?v=20260913.35','?v=20260913.39'])
    eq(versionScript(`${quote}${prefix}${asset}${query}${quote}`,asset),`${quote}${prefix}${asset}?v=${runtimeRelease(asset)}${quote}`);
  for(const prefix of ['../','/','https://example.test/']){
    const unrelated=`"${prefix}${asset}?v=external"`;
    eq(versionScript(unrelated,asset),unrelated,'Only the exact local asset path is normalized');
  }
  const expectedBytes=asset.endsWith('.css')?changed.reduce((css,dependency)=>versionScript(css,dependency),read(asset).toString()):read(asset);
  eq(sha(fs.readFileSync(path.join(built,asset))),sha(expectedBytes),'Build copies runtime bytes with only declared CSS import-version updates');
}
for(const [asset,release]of [['brand-surfaces.css','20260913.32']])
  eq(versionScript(`"${asset}"`,asset),`"${asset}?v=${release}"`,'Unchanged asset release remains unchanged');

const pages=rootFiles.filter(file=>file.endsWith('.html'));
eq(fs.readdirSync(built).filter(file=>file.endsWith('.html')).sort(),pages);
const footerPattern=/<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/i;
const headerPattern=/<header\b(?=[^>]*\bid=["']siteHeader["'])[^>]*>[\s\S]*?<\/header>/i;
const footer=read('site-shell/footer.html').toString().trim(),header=read('site-shell/header.html').toString().trim();
const brandStatement='Monderman reveals where decisions stall, unnecessary work accumulates and performance falls short. See what needs attention, decide what to change and measure the results.';
ok(footer.includes(`<p class="mf-copy">${brandStatement}</p>`),'The shared footer contains the approved brand statement');
const methodology='href="diagnostics.html#methodology-and-sources"';
eq(footer.split(methodology).length-1,1);
const references=Object.fromEntries(changed.map(asset=>[asset,0]));
// These presentation layers are deliberately injected by the public build.
const injectedProductPages=new Set(['index.html','diagnostics.html','platform-services.html','plan-signal.html','plan-pattern.html','plan-enterprise.html','new-in-the-role.html','after-an-acquisition.html','after-a-reorganization.html','transformation-behind-schedule.html','pilot.html','roi.html','connect.html','why-monderman.html','security.html','subprocessors.html','Monderman_Platform_Brief.html']);
const instrumentPages=new Set(['decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html']);
let canonicalPages=0,footerPages=0;
for(const file of pages){
  const original=read(file).toString(),html=fs.readFileSync(path.join(built,file),'utf8');
  for(const reference of html.matchAll(/enterprise-site\.css\?v=([^"']+)/g))eq(reference[1],'20260924.gold1',file+': current primary/secondary CTA stylesheet');
  ok(!html.replace(/\s+/g,' ').includes('Monderman helps you examine responsibilities, decisions, processes and performance.'),file+': retired sub-hero is absent from the published page');
  const canonical=/<body\b[^>]*\bclass=["'][^"']*\bcanonical-green-shell\b/i.test(original)&&/canonical-site-shell\.js/.test(original);
  if(canonical){canonicalPages++;eq(html.match(headerPattern)?.[0],header,file+': canonical header');}
  if(canonical||footerPattern.test(original)){
    footerPages++;const injected=html.match(footerPattern)?.[0];
    eq(injected,footer,file+': exact shared footer');
    eq(injected.split(methodology).length-1,1,file+': one canonical methodology link');
  }
  for(const asset of changed){
    const pattern=new RegExp(`(["'])((?:\\./)?${asset.replace('.', '\\.')})([^"']*)\\1`,'g');
    const before=[...original.matchAll(pattern)],after=[...html.matchAll(pattern)];
    const injected=before.length===0&&((asset==='public-product-design.css'&&injectedProductPages.has(file))||(asset==='report-screen-experience.css'&&instrumentPages.has(file)));
    const expectedCount=['connect-widget.js','assistant.js'].includes(asset)&&canonical?1:before.length+(injected?1:0);
    eq(after.length,expectedCount,file+': exact existing or explicitly injected asset reference count');
    // The build refreshes the shared support assets without touching dozens of
    // page sources. Report assets retain their established source-key checks.
    if([...annualAssets,'homepage-workspace-demo.css'].includes(asset)&&! /^(?:terms|privacy)(?:-|\.)/.test(file))for(const match of before)eq(match[3],`?v=${asset==='canonical-site-shell.js'?'20260915.consistency1':runtimeRelease(asset)}`,file+': expected source cache identity; the build normalizes unchanged consumer markup');
    for(const match of after){eq(match[3],`?v=${runtimeRelease(asset)}`,file+': current asset URL');references[asset]++;}
  }
}
eq(canonicalPages,66);eq(footerPages,70); // Includes the Governance article and immutable invitation-access editions.
for(const asset of changed.filter(asset=>asset!=='workspace-evaluation.js'))ok(references[asset]>0,'Actual built pages exercise '+asset);
eq(references['workspace-evaluation.js'],0,'Evaluation display is loaded only after an authenticated status check');
ok(fs.readFileSync(path.join(built,'workspace-access-gate.js'),'utf8').includes('evaluationScript.src = "workspace-evaluation.js?v=20260919.invited1"'),'Authenticated loader uses the exact countdown cache identity');
for(const file of ['canonical-site-shell.js','workspace-theme.js']){
  const loader=fs.readFileSync(path.join(built,file),'utf8');
  ok(loader.includes('assets/brand/brand-lockup.css?v=20260915.annual1'),'Actual loader uses the current brand CSS: '+file);
}
eq(references['monderman-report.js'],9,'All nine renderer consumers are covered');
eq(references['sample-report-production.js'],1,'The real sample page uses the mixed-origin export handler');
eq(references['public-sample-model.js'],1,'The sample page loads the current public sample model');
eq(references['homepage-workspace-demo.css'],1,'Interactive preview text receives its current stylesheet');
ok(fs.readFileSync(path.join(built,'workspace-analysis.html'),'utf8').includes("from './campaign-analysis.js?v=20260923.salary1'"));
eq(references['assignment-mode.js'],4,'All four participant pages receive current assignment routing');
eq(references['assignment-draft.js'],4,'All four participant pages receive current salary-safe draft recovery');
eq(references['employer-salary-import.js'],2,'Composer and Settings receive the salary CSV module');
eq(references['employer-salary-settings.js'],1,'Settings receives the controlled salary settings module');
ok(fs.readFileSync(path.join(built,'diagnostics.html'),'utf8').includes('id="methodology-and-sources"'));
eq(sha(fs.readFileSync(path.join(built,'single-run-financial-display.css'))),hashes['single-run-financial-display.css']);
for(const tool of ['structural-clarity','decision-velocity','operational-systems','institutional-performance']){
  const html=fs.readFileSync(path.join(built,tool+'.html'),'utf8');
  eq(html.split('href="single-run-financial-display.css"').length-1,1,'New first-use stylesheet copied and linked');
}
eq(sha(fs.readFileSync(path.join(built,'sample-data/production-diagnostic-samples.json'))),hashes['sample-data/production-diagnostic-samples.json']);
ok(!fs.existsSync(path.join(built,'sample-data/production-sample-release.json')),'Private release approval manifest is not newly published');
eq(fs.readdirSync(path.join(built,'sample-data')).sort(),['production-diagnostic-samples.json','reports'],'No extra sample/provenance files are published');
eq(fs.readdirSync(path.join(built,'sample-data/reports')).sort(),samplePdfs.map(file=>path.basename(file)).sort(),'Only the six approved public PDF paths are copied');
for(const file of samplePdfs)eq(sha(fs.readFileSync(path.join(built,file))),hashes[file],'Exact reviewed PDF copy: '+file);
for(const privatePath of ['scripts','site-shell','.github','docs','pdf-src','test-fixtures','node_modules','output'])ok(!fs.existsSync(path.join(built,privatePath)),'Private path stays excluded: '+privatePath);
const legalContent=html=>html.split('<!-- CONTENT_START -->')[1].split('<!-- CONTENT_END -->')[0].replace(/^\n+|\n+$/g,'')+'\n';
for(const file of ['terms.html','terms-2026-09-15-annual-plans.html','terms-2026-09-19-invited-evaluation.html','privacy.html','privacy-2026-09-12-ai-source-evidence-v2.html','privacy-2026-09-19-invited-evaluation.html','terms-2026-09-19-invitation-access.html','privacy-2026-09-19-invitation-access.html']){
  eq(legalContent(fs.readFileSync(path.join(built,file),'utf8')),legalContent(read(file).toString()),'Shell injection preserves exact legal content: '+file);
}
const inventory=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/mobile_site_presentation_smoke.mjs'),'--inventory-only'],{cwd:stage,encoding:'utf8'}));
eq(inventory.canonicalPages,canonicalPages);eq(inventory.footerPages,footerPages);eq(inventory.browserLaunched,false);
for(const file of protectedFiles)eq(sha(read(file)),hashes[file],'Original source, runtime and sample bytes unchanged: '+file);
const receipt={status:'PASS',checks,pages:pages.length,canonicalPages,footerPages,references,buildLog,inventory,
  sourceRevision:revision,sourceBasis:'Current local working-tree bytes; not a committed or publication-approved artifact',
  questionnaireChannel:'legacy',injectorSha256:sha(read('scripts/inject-public-shell.mjs')),runtimeSha256:Object.fromEntries(changed.map(file=>[file,hashes[file]])),
  protectedSampleSha256:hashes['sample-data/production-diagnostic-samples.json'],protectedManifestSha256:hashes['sample-data/production-sample-release.json'],
  providerCalls:0,networkCalls:0,published:false};
fs.writeFileSync(path.join(out,'RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,pages:pages.length,canonicalPages,footerPages,references,output:out,providerCalls:0,networkCalls:0,published:false}));
