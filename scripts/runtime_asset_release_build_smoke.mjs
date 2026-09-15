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
const changed=[...annualAssets,'homepage-workspace-demo.css','campaign-analysis.js','campaign-analysis.css'];
const runtimeRelease=asset=>annualAssets.includes(asset)?'20260915.annual1':asset==='homepage-workspace-demo.css'?'20260914-preview-static1':'20260913.34';
eq(read('monderman-report.js').toString().match(/const RENDERER_VERSION = "diagnostic-renderer-evidence-reading-([^"]+)"/)?.[1],'20260914.43','Renderer version remains 43; annual metadata changes receive a separate cache identity');
for(const asset of changed){
  for(const quote of ['"',"'"])for(const prefix of ['', './'])for(const query of ['', '?v=20260913.32','?v=20260913.35','?v=20260913.39'])
    eq(versionScript(`${quote}${prefix}${asset}${query}${quote}`,asset),`${quote}${prefix}${asset}?v=${runtimeRelease(asset)}${quote}`);
  for(const prefix of ['../','/','https://example.test/']){
    const unrelated=`"${prefix}${asset}?v=external"`;
    eq(versionScript(unrelated,asset),unrelated,'Only the exact local asset path is normalized');
  }
  eq(sha(fs.readFileSync(path.join(built,asset))),hashes[asset],'Build copies the actual frozen runtime bytes');
}
for(const [asset,release]of [['brand-surfaces.css','20260913.32'],
  ['sample-report-production.css','20260913.32']])
  eq(versionScript(`"${asset}"`,asset),`"${asset}?v=${release}"`,'Unchanged asset release remains unchanged');

const pages=rootFiles.filter(file=>file.endsWith('.html'));
eq(fs.readdirSync(built).filter(file=>file.endsWith('.html')).sort(),pages);
const footerPattern=/<footer\b(?=[^>]*\bclass=["'][^"']*\bmond-footer\b[^"']*["'])[^>]*>[\s\S]*?<\/footer>/i;
const headerPattern=/<header\b(?=[^>]*\bid=["']siteHeader["'])[^>]*>[\s\S]*?<\/header>/i;
const footer=read('site-shell/footer.html').toString().trim(),header=read('site-shell/header.html').toString().trim();
const methodology='href="diagnostics.html#methodology-and-sources"';
eq(footer.split(methodology).length-1,1);
const references=Object.fromEntries(changed.map(asset=>[asset,0]));
let canonicalPages=0,footerPages=0;
for(const file of pages){
  const original=read(file).toString(),html=fs.readFileSync(path.join(built,file),'utf8');
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
    eq(after.length,before.length,file+': asset reference count unchanged');
    if([...annualAssets,'homepage-workspace-demo.css'].includes(asset)&&! /^(?:terms|privacy)(?:-|\.)/.test(file))for(const match of before)eq(match[3],`?v=${runtimeRelease(asset)}`,file+': unbuilt active source also uses current report cache identity');
    for(const match of after){eq(match[3],`?v=${runtimeRelease(asset)}`,file+': current asset URL');references[asset]++;}
  }
}
eq(canonicalPages,61);eq(footerPages,65); // One new immutable annual Terms edition.
for(const asset of changed)ok(references[asset]>0,'Actual built pages exercise '+asset);
for(const file of ['canonical-site-shell.js','workspace-theme.js']){
  const loader=fs.readFileSync(path.join(built,file),'utf8');
  ok(loader.includes('assets/brand/brand-lockup.css?v=20260915.annual1'),'Actual loader uses the current brand CSS: '+file);
}
eq(references['monderman-report.js'],9,'All nine renderer consumers are covered');
eq(references['sample-report-production.js'],1,'The real sample page uses the mixed-origin export handler');
eq(references['public-sample-model.js'],1,'The sample page loads the current public sample model');
eq(references['homepage-workspace-demo.css'],1,'Interactive preview text receives its current stylesheet');
ok(fs.readFileSync(path.join(built,'workspace-analysis.html'),'utf8').includes("from './campaign-analysis.js?v=20260913.34'"));
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
for(const file of ['terms.html','terms-2026-09-15-annual-plans.html','privacy.html','privacy-2026-09-12-ai-source-evidence-v2.html']){
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
