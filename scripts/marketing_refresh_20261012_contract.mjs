// Offline source/approval boundary. This never runs scoring, sends, provider calls or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PHOTO_PRESENTATION_ADDITIONS,PHOTO_PRESENTATION_GUARD_FILES} from './marketing_photo_presentation_20261013_inverse.mjs';
import {sourceAtMarketingCompletionBaseline,MARKETING_COMPLETION_ADDITIONS,MARKETING_COMPLETION_GUARD_FILES} from './marketing_completion_20261013_inverse.mjs';
import {MARKETING_REFRESH_BASELINE,MARKETING_REFRESH_VERSION,MARKETING_REFRESH_FILES,MARKETING_REFRESH_ADDITIONS,marketingRefreshDelta,sourceBeforeMarketingRefresh20261012,sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..'),read=file=>sourceAtMarketingCompletionBaseline(file,fs.readFileSync(path.join(root,file)));
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64e6});
const tracked=git('ls-tree','-r','--name-only',MARKETING_REFRESH_BASELINE).toString().trim().split('\n').filter(Boolean);
const baselineBatch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:tracked.map(file=>MARKETING_REFRESH_BASELINE+':'+file+'\n').join(''),maxBuffer:128e6});
const baselineBytes=new Map();let batchOffset=0;
for(const file of tracked){const lineEnd=baselineBatch.indexOf(10,batchOffset),header=baselineBatch.subarray(batchOffset,lineEnd).toString(),parts=header.split(' ');assert.match(header,/^[0-9a-f]{40} blob \d+$/,'Exact baseline blob frame');const length=Number(parts[2]);batchOffset=lineEnd+1;baselineBytes.set(file,baselineBatch.subarray(batchOffset,batchOffset+length));batchOffset+=length;assert.equal(baselineBatch[batchOffset++],10,'Baseline blob framing');}
assert.equal(batchOffset,baselineBatch.length,'Complete baseline Git blob batch');
const prior=file=>{assert.ok(baselineBytes.has(file),'Known baseline file '+file);return baselineBytes.get(file);};
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0,hunks=0,immutableFiles=0,historicalFixtures=0,pdfs=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const existing=['index.html','public-search-index.json',
  'scripts/book_publication_date_20261011_inverse.mjs','scripts/book_publication_date_20261011_inverse.py',
  'scripts/book_publication_date_20261011_contract.mjs','scripts/book_publication_date_20261011_contract.py',
  'scripts/public_sample_manifest_sensitivity_smoke.mjs','scripts/homepage_card_rhythm_smoke.mjs','scripts/site_system_visual_smoke.mjs',
  'scripts/sample_marketing_language_hover_smoke.mjs','scripts/homepage_workspace_demo_smoke.mjs',
  'scripts/methodology_business_copy_smoke.mjs','scripts/sample_tile_smoke.mjs','.github/workflows/frontend-release.yml',
  '.github/workflows/sample-report-marketing-certification.yml','scripts/homepage_assistant_smoke.mjs'];
const guardFiles=['scripts/marketing_refresh_20261012_inverse.mjs','scripts/marketing_refresh_20261012_inverse.py',
  'scripts/marketing_refresh_20261012_contract.mjs','scripts/marketing_refresh_20261012_contract.py','scripts/fixtures/marketing-refresh-20261012.json'];
eq(MARKETING_REFRESH_BASELINE,'14e57bb9f5537cd7ed5eb581cbc7740541c593b1','Exact deployed book/homepage baseline');
eq(MARKETING_REFRESH_VERSION,'marketing-refresh-20261012.1','Independent marketing approval version');
eq(MARKETING_REFRESH_FILES,existing,'Only explicit public/adapter/workflow existing-file whitelist');
eq(marketingRefreshDelta.provisional,false,'Only the final reviewed source snapshot can pass this full contract');
eq(marketingRefreshDelta.guardFiles,guardFiles,'Five independent guard files; no historical fixture repinning');
eq(git('rev-parse',MARKETING_REFRESH_BASELINE+'^{tree}').toString().trim(),marketingRefreshDelta.baselineTree,'Verified baseline Git tree identity');
const parityCases=[];
for(const file of existing){
  const current=read(file),before=prior(file),entry=marketingRefreshDelta.files[file];
  eq(sha(before),entry.before_sha256,file+': original baseline pin');
  eq(sha(current),entry.after_sha256,file+': complete reviewed current pin');
  let end=0;
  for(const [start,stop,now,old]of entry.replacements){
    ok(Number.isSafeInteger(start)&&Number.isSafeInteger(stop)&&start>=end&&stop>=start,file+': finite ordered UTF-16 hunk');
    ok(typeof now==='string'&&typeof old==='string',file+': hunk text types');
    eq(current.toString().slice(start,stop),now,file+': exact finite current hunk');end=stop;hunks++;
  }
  for(const source of [current,current.toString()]){
    const expected=Buffer.isBuffer(source)?before:before.toString();
    eq(sourceBeforeMarketingRefresh20261012(file,source),expected,file+': complete strict inverse and type');
    eq(sourceAtMarketingRefreshBaseline(file,source),expected,file+': complete conditional inverse and type');
    eq(sourceAtMarketingRefreshBaseline(file,expected),expected,file+': baseline never double-inverted');
    parityCases.push({file,source:Buffer.from(source).toString('base64'),type:Buffer.isBuffer(source)?'bytes':'str',expected:before.toString('base64'),strict:true});
  }
  const mutants=[Buffer.concat([current,Buffer.from('\n')]),Buffer.concat([Buffer.from('UNREVIEWED'),current]),Buffer.from('!'+current.toString().slice(1)),before,
    Buffer.concat([current,Buffer.from('<script>fetch("https://api.monderman.com/api/scoring",{method:"POST"})</script>')])];
  for(const [start,stop]of entry.replacements)mutants.push(Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(stop)));
  for(const mutant of mutants){
    reject(()=>sourceBeforeMarketingRefresh20261012(file,mutant),file+': altered hunk, append, prefix, API injection or double inverse rejected');
    eq(sourceAtMarketingRefreshBaseline(file,mutant),mutant,file+': unknown complete source remains visible');
    parityCases.push({file,source:mutant.toString('base64'),type:'bytes',expected:mutant.toString('base64'),strict:false});
  }
}
for(const file of tracked){
  if(existing.includes(file))continue;
  eq(read(file),prior(file),file+': all other original source/artifact bytes preserved');immutableFiles++;
  historicalFixtures+=Number(file.startsWith('scripts/fixtures/'));pdfs+=Number(file.endsWith('.pdf'));
}
function assertAddition(file,bytes){assert.equal(sha(bytes),marketingRefreshDelta.additions[file].sha256,file+': exact separately reviewed new file');assert.equal(bytes.length,marketingRefreshDelta.additions[file].bytes,file+': exact new file size');}
for(const file of MARKETING_REFRESH_ADDITIONS){
  ok(!tracked.includes(file)&&!guardFiles.includes(file),file+': genuinely new separately pinned presentation/asset source');
  ok(file==='marketing-refresh.css'||file==='marketing-refresh.js'||file==='scripts/marketing_refresh_browser_smoke.mjs'||file==='docs/marketing-refresh-20261012.md'||/^assets\/marketing\/[A-Za-z0-9._/-]+\.(?:avif|webp|jpe?g|png)$/i.test(file),file+': only explicit scoped code/public summary and photo derivatives; no archive, release receipt, font or extra engine');
  ok(!file.includes('..')&&!/^\//.test(file),file+': safe repository path');
  const bytes=read(file);assertAddition(file,bytes);checks+=2;
  eq(sourceBeforeMarketingRefresh20261012(file,bytes),bytes,file+': new file is never erased by strict inverse');
  eq(sourceAtMarketingRefreshBaseline(file,bytes),bytes,file+': new file is never erased by conditional inverse');
  reject(()=>assertAddition(file,Buffer.concat([bytes,Buffer.from('UNREVIEWED')])),file+': unknown new-file append rejected');
}
for(const file of ['marketing-refresh.css','marketing-refresh.js','scripts/marketing_refresh_browser_smoke.mjs'])ok(MARKETING_REFRESH_ADDITIONS.includes(file),file+': required local presentation and browser proof present');
const known=new Set([...tracked,...MARKETING_REFRESH_ADDITIONS,...guardFiles,...MARKETING_COMPLETION_ADDITIONS,...MARKETING_COMPLETION_GUARD_FILES,...PHOTO_PRESENTATION_ADDITIONS,...PHOTO_PRESENTATION_GUARD_FILES]);
const cached=git('ls-files','--cached').toString().split('\n');
const paths=[...new Set([...cached,...git('ls-files','--others','--exclude-standard').toString().split('\n')])].filter(file=>file&&fs.existsSync(path.join(root,file))&&!(file==='node_modules'&&!cached.includes(file)&&fs.lstatSync(path.join(root,file)).isSymbolicLink()));
function assertScope(files){for(const file of files)assert.ok(known.has(file),file+': no unreviewed source/artifact addition');}
assertScope(paths);checks+=paths.length;
reject(()=>assertScope([...paths,'unexpected-publication.js']),'Unlisted new source is rejected rather than hidden');
reject(()=>assertScope([...paths,'node_modules']),'A source file named node_modules receives no runtime exemption');
ok(!fs.existsSync(path.join(root,'.github/workflows/marketing-visual-review.yml')),'Temporary archive workflow removed from final source');
ok(!paths.some(file=>/marketing-source\.tgz|marketing-review-source\.zip|(?:^|\/)AGENTS\.md$/.test(file)),'No snapshot archive or private instruction artifact added');
for(const file of ['unknown.js','__proto__','constructor','toString','workspace.html','pattern-trial.html',...MARKETING_REFRESH_ADDITIONS]){
  for(const source of ['Unlisted source 😀',Buffer.from('Unlisted source 😀')]){
    eq(sourceBeforeMarketingRefresh20261012(file,source),source,file+': unlisted strict source and type unchanged');
    eq(sourceAtMarketingRefreshBaseline(file,source),source,file+': unlisted conditional source and type unchanged');
    parityCases.push({file,source:Buffer.from(source).toString('base64'),type:Buffer.isBuffer(source)?'bytes':'str',expected:Buffer.from(source).toString('base64'),strict:true});
  }
}
const parityCode=`import base64,json,sys\nsys.path.insert(0,'scripts')\nfrom marketing_refresh_20261012_inverse import source_before_marketing_refresh_20261012 as strict,source_at_marketing_refresh_baseline as conditional\nrows=json.load(sys.stdin)\nfor r in rows:\n b=base64.b64decode(r['source']); s=b.decode('utf-8') if r['type']=='str' else b; expected=base64.b64decode(r['expected'])\n out=conditional(r['file'],s)\n assert type(out) is type(s)\n assert (out.encode('utf-8') if isinstance(out,str) else out)==expected\n try:\n  out=strict(r['file'],s)\n except AssertionError:\n  assert not r['strict']\n else:\n  assert r['strict'] and type(out) is type(s) and (out.encode('utf-8') if isinstance(out,str) else out)==expected\nprint(json.dumps({'ok':True,'cases':len(rows)}))\n`;
const parity=JSON.parse(execFileSync(process.env.PYTHON||'python3',['-c',parityCode],{cwd:root,input:JSON.stringify(parityCases),maxBuffer:2e6}).toString());
eq(parity,{ok:true,cases:parityCases.length},'JavaScript/Python parity for all exact, Unicode, mutated, new and prototype-name sources');

function element(source,tag,test){
  const re=new RegExp('<'+tag+'\\b[^>]*>|</'+tag+'\\s*>','gi');let m,start=-1,depth=0;
  while((m=re.exec(source))){if(start<0){if(m[0].startsWith('</')||!test.test(m[0]))continue;start=m.index;depth=1;}else if(m[0].startsWith('</')){if(--depth===0)return source.slice(start,re.lastIndex);}else depth++;}
  assert.fail('Required unique balanced '+tag+' region');
}
const html=read('index.html').toString(),old=prior('index.html').toString();
for(const [tag,test]of [['header',/id="siteHeader"/],['footer',/class="footer mond-footer"/],['div',/class="hero-copy"/],['aside',/data-home-report-quad/],['section',/class="measurement-loop"/],['section',/id="approach"/],['section',/class="first-run-moments"/],['section',/id="see-it"/],['section',/id="verify"/],['section',/class="systems-analysis-bridge"/],['div',/class="home-output-copy"/],['aside',/class="home-workspace-preview"/],['section',/id="book"/],['section',/id="latest"/],['section',/id="connect"/]])eq(element(html,tag,test),element(old,tag,test),'Original '+test+': content, links, data and evidence bytes intact');
const hero=element(html,'section',/class="hero"/),oldHero=element(old,'section',/class="hero"/),heroAside=element(hero,'aside',/data-home-report-quad/);
const wrapper='<div class="mr-proof-composition">\n<p class="mr-proof-label">Sample report · Example data</p>\n';
eq(hero.split(wrapper).length-1,1,'Exactly one truthful sample qualifier around unchanged preview');
eq(hero.split(heroAside+'\n</div>').length-1,1,'Exact one wrapper closing after unchanged report');
eq(hero.replace(wrapper,'').replace(heroAside+'\n</div>',heroAside),oldHero,'Every original hero byte recovered after only the exact sample-label wrapper');
const scripts=value=>[...value.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(x=>x[0]);
const newScript='<script src="marketing-refresh.js?v=20261012.1" defer></script>';
eq(scripts(html).filter(x=>x===newScript).length,1,'One exact new local deferred presentation script');
eq(scripts(html).filter(x=>x!==newScript),scripts(old),'All original inline scripts, external script versions and structured SEO unchanged');
const metas=value=>[...value.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(x=>x[0]);
const newStyle='<link rel="stylesheet" href="marketing-refresh.css?v=20261012.1">';
eq(metas(html).filter(x=>x===newStyle).length,1,'One exact new local scoped stylesheet');
eq(metas(html).filter(x=>x!==newStyle),metas(old),'All original SEO, fonts, stylesheet tags and canonical destinations unchanged');
eq((html.match(/<body[^>]*>/)||[])[0],'<body class="canonical-green-shell homepage-enterprise marketing-refresh">','One scoped homepage class added');
const scenario=element(html,'section',/data-marketing-scenario/);
ok(scenario.includes('Qualitative illustration · Not a scored result or customer case'),'Example boundary visible in authored source');
ok(!/\d|\$|%/.test(scenario.replace(/<[^>]*>/g,'')),'New illustrative lens copy has no invented numbers, scores, savings or percentages');
eq([...scenario.matchAll(/\bhref="([^"]+)"/g)].map(x=>x[1]),['#mr-panel-clarity','#mr-panel-velocity','#mr-panel-systems','#mr-panel-performance','structural-clarity-article.html','decision-velocity-article.html','operational-systems-article.html','institutional-performance-article.html'],'New illustration has only local tab anchors and four existing explanatory destinations');
ok(!/<form\b|\bon[a-z]+\s*=|\baction\s*=|\bdata-(?:score|evaluation|campaign|engine)\b/i.test(scenario),'Qualitative illustration adds no form, inline event or product engine hook');
for(const [key,label,terms,url]of [
  ['clarity','Structural Clarity',['Ownership ambiguity','Authority blur','Handoff diffusion','Compensatory structure'],'structural-clarity-article.html'],
  ['velocity','Decision Velocity',['Waiting for review','Repeated review','Escalation dependence','Decision reopening'],'decision-velocity-article.html'],
  ['systems','Operational Systems',['Duplicate entry','Repeated reporting','Coordination work','Administrative effort'],'operational-systems-article.html'],
  ['performance','Institutional Performance',['Reliability','Coherence','Adaptability','Compensatory effort'],'institutional-performance-article.html']]){
  const panel=element(scenario,'section',new RegExp('id="mr-panel-'+key+'"'));
  ok(panel.includes(label),key+': distinct lens named');for(const term of terms)ok(panel.includes(term),key+': specific operating question '+term);
  ok(panel.includes('<details')&&panel.includes('<summary>')&&panel.includes('href="'+url+'"'),key+': native usable expanded explanation and real destination');
  ok(!/^<section[^>]*\bhidden\b/.test(panel),key+': no-script illustration remains readable');
  eq((scenario.match(new RegExp('data-lens-choice="'+key+'"','g'))||[]).length,1,key+': one local selector');
}
ok(scenario.includes('It is not a score assembled from Structural Clarity, Decision Velocity and Operational Systems.'),'Institutional Performance remains distinct, not an invented aggregate');
const js=read('marketing-refresh.js').toString(),css=read('marketing-refresh.css').toString();
function assertLocalRuntime(source){assert.doesNotMatch(source,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(|\b(?:localStorage|sessionStorage)\b|document\.cookie|https?:\/\/|supabase|stripe|(?:score|scoring|evaluate|diagnostic)\s*\(/i,'New marketing runtime is presentation only');}
assertLocalRuntime(js);checks++;
reject(()=>assertLocalRuntime(js+'\nfetch("https://api.monderman.com/api/scoring",{method:"POST"})'),'Production API injection rejected independently of the pin');
ok(js.includes("document.querySelector('body.marketing-refresh [data-lens-demo]')"),'Runtime begins at its scoped authored local demo');
for(const key of ['aria-selected','aria-controls','tabpanel','ArrowRight','ArrowLeft','Home','End','moveFocus','tab.hash','data-enhanced'])ok(js.includes(key),'Keyboard/accessibility/runtime boundary '+key);
ok(!/setInterval|requestAnimationFrame|\.scrollTo\(|\.scrollIntoView\(|wheel|touchmove/.test(js),'No scrolling control or continuous animation loop');
function assertScopedCSS(source){
  source=source.replace(/\/\*[\s\S]*?\*\//g,'');let cursor=0;
  while(cursor<source.length){const open=source.indexOf('{',cursor);if(open<0){assert.ok(!source.slice(cursor).trim(),'No stray CSS source');break;}const rule=source.slice(cursor,open).trim();let depth=1,end=open+1,quote=null;
    for(;end<source.length&&depth;end++){const c=source[end];if(quote){if(c===quote&&source[end-1]!=='\\')quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}')depth--;}
    assert.equal(depth,0,'Balanced scoped CSS rule');const body=source.slice(open+1,end-1);
    if(rule.startsWith('@')){assert.match(rule,/^@(?:media|supports)\b/,'Only local conditional CSS groups');assertScopedCSS(body);}else{let part='',nest=0;const selectors=[];for(const c of rule){if(c==='('||c==='[')nest++;if(c===')'||c===']')nest--;if(c===','&&nest===0){selectors.push(part);part='';}else part+=c;}selectors.push(part);for(const selector of selectors)assert.ok(selector.trim().startsWith('body.homepage-enterprise.marketing-refresh'),'CSS rule stays scoped: '+selector.trim());}
    cursor=end;
  }
}
assertScopedCSS(css);checks++;
reject(()=>assertScopedCSS(css+'\n@media (max-width:600px){button{display:none}}'),'Global selector in conditional CSS rejected');
ok(css.includes('prefers-reduced-motion'),'Reduced-motion presentation path exists');
ok(!/@import|url\(\s*["']?https?:\/\//i.test(css),'No new remote CSS import or remotely loaded image');
ok(Buffer.byteLength(css)+Buffer.byteLength(js)<=marketingRefreshDelta.assetBudget.cssAndJsBytesMax,'Pinned new CSS/JS asset budget');

// Proof of additive compatibility: no old command, negative control, workflow job or pin disappears.
function replaceExact(source,from,to,count=1){eq(source.split(from).length-1,count,'Exact additive compatibility occurrence count');return source.split(from).join(to);}
const imp="import {sourceAtMarketingRefreshBaseline} from './marketing_refresh_20261012_inverse.mjs';\n",pyImp='from marketing_refresh_20261012_inverse import source_at_marketing_refresh_baseline\n';
for(const language of ['mjs','py']){
  const file='scripts/book_publication_date_20261011_inverse.'+language;let expected=prior(file).toString();
  if(language==='mjs'){expected=replaceExact(expected,"import {createHash} from 'node:crypto';\n","import {createHash} from 'node:crypto';\n"+imp);for(const name of ['sourceBeforeBookPublicationDate20261011','sourceAtBookPublicationDateBaseline']){const line=`export function ${name}(file,source){\n`;expected=replaceExact(expected,line,line+'  source=sourceAtMarketingRefreshBaseline(file,source);\n');}}
  else{expected=replaceExact(expected,'from pathlib import Path\n','from pathlib import Path\n'+pyImp);for(const name of ['source_before_book_publication_date_20261011','source_at_book_publication_date_baseline']){const line=`def ${name}(file, source):\n`;expected=replaceExact(expected,line,line+'    source = source_at_marketing_refresh_baseline(file, source)\n');}}
  eq(read(file).toString(),expected,file+': only independent finite-layer composition');
}
let file='scripts/book_publication_date_20261011_contract.mjs',expected=replaceExact(prior(file).toString(),"import {execFileSync} from 'node:child_process';\n","import {execFileSync} from 'node:child_process';\n"+imp);
expected=replaceExact(expected,"const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));","const root=path.resolve(import.meta.dirname,'..'),read=file=>sourceAtMarketingRefreshBaseline(file,fs.readFileSync(path.join(root,file)));");
eq(read(file).toString(),expected,'Every old JavaScript dated-copy assertion and negative control preserved');
file='scripts/book_publication_date_20261011_contract.py';expected=replaceExact(prior(file).toString(),'import subprocess\n','import subprocess\n'+pyImp);
for(const [from,to,count]of [['ROOT = Path(__file__).resolve().parents[1]\n','ROOT = Path(__file__).resolve().parents[1]\n\ndef read(file):\n    return source_at_marketing_refresh_baseline(file, (ROOT / file).read_bytes())\n',1],['current, before = (ROOT / file).read_bytes(), prior(file)','current, before = read(file), prior(file)',1],['(ROOT / file).read_text()',"read(file).decode('utf-8')",1],["(ROOT / 'public-search-index.json').read_bytes()","read('public-search-index.json')",1],['(ROOT / file).read_bytes() == prior(file)','read(file) == prior(file)',1]])expected=replaceExact(expected,from,to,count);
eq(read(file).toString(),expected,'Every old Python dated-copy assertion and negative control preserved');
file='scripts/public_sample_manifest_sensitivity_smoke.mjs';const dependency="  'scripts/book_publication_date_20261011_inverse.mjs','scripts/fixtures/book-publication-date-20261011.json',\n";
expected=replaceExact(prior(file).toString(),dependency,dependency+"  'scripts/marketing_refresh_20261012_inverse.mjs','scripts/fixtures/marketing-refresh-20261012.json',\n");eq(read(file).toString(),expected,'Sensitivity dependencies only appended; old negative checks intact');
const oldCall='          node scripts/book_publication_date_20261011_contract.mjs\n',calls='          node scripts/marketing_refresh_20261012_contract.mjs\n          python scripts/marketing_refresh_20261012_contract.py\n';
file='.github/workflows/frontend-release.yml';expected=replaceExact(prior(file).toString(),oldCall,calls+oldCall);eq(read(file).toString(),expected,'Frontend workflow adds only new guard calls before every old test');
file='.github/workflows/sample-report-marketing-certification.yml';const oldPath="      - 'scripts/book_publication_date_20261011_contract.mjs'\n",pathsAdded=[...guardFiles.slice(2,4),...guardFiles.slice(0,2),guardFiles[4],'scripts/marketing_refresh_browser_smoke.mjs','marketing-refresh.css','marketing-refresh.js','assets/marketing/**'].map(p=>`      - '${p}'\n`).join('');
expected=replaceExact(prior(file).toString(),oldPath,pathsAdded+oldPath,2);expected=replaceExact(expected,oldCall,calls+oldCall);
expected=replaceExact(expected,'          node scripts/homepage_workspace_demo_smoke.mjs\n','          MARKETING_REFRESH_OUT=/tmp/report-presentation-smoke/marketing-refresh node scripts/marketing_refresh_browser_smoke.mjs\n          node scripts/homepage_workspace_demo_smoke.mjs\n');eq(read(file).toString(),expected,'Certification adds only exact paths/guards/browser call; all old jobs, timeouts and assertions intact');
function guardCalls(source){
  const masked=source.split('');let state=null,escaped=false,inClass=false;
  for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];
    if(state){if(c!=='\n')masked[i]=' ';if(state==='line'){if(c==='\n')state=null;}else if(state==='block'){if(c==='*'&&next==='/'){masked[++i]=' ';state=null;}}else if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(state==='regex'){if(c==='[')inClass=true;else if(c===']')inClass=false;else if(c==='/'&&!inClass)state=null;}else if(c===state)state=null;continue;}
    if(c==='"'||c==="'"||c==='`'){state=c;masked[i]=' ';}else if(c==='/'&&next==='/'){state='line';masked[i]=' ';masked[++i]=' ';}else if(c==='/'&&next==='*'){state='block';masked[i]=' ';masked[++i]=' ';}else if(c==='/'){let previous=i-1;while(previous>=0&&/\s/.test(masked[previous]))previous--;if(previous<0||/[([=:,!&|?{;]/.test(masked[previous])){state='regex';inClass=false;masked[i]=' ';}}
  }
  const text=masked.join(''),re=/\b(?:assert(?:\.[A-Za-z]+)?|check|equal|eq|assertCompactHeight|assertAssumptionsText|assertReadingGuide|assertReadablePreview|assertEnlargedOverview|assertExpandedHeight|assertRefreshedJourneyGeometry|assertCurrentEditorialSequence)\s*\(/g,out=[];let match;
  while((match=re.exec(text))){let depth=1,end=re.lastIndex;while(end<text.length&&depth){if(text[end]==='(')depth++;else if(text[end]===')')depth--;end++;}assert.equal(depth,0,'Balanced original guard call');out.push(source.slice(match.index,end).split('\n').map(line=>line.trim()).join('\n'));}
  return out;
}
function assertPreservedGuard(file,source){
  const original=guardCalls(prior(file).toString()),current=guardCalls(source);let at=0;
  assert.ok(original.length>0,file+': original assertion inventory is nonempty');
  for(const statement of original){const expected=file.endsWith('site_system_visual_smoke.mjs')?statement.replace('geometry.titleX - expectedRailX(geometry.clientWidth)','geometry.titleX - railX'):statement;const found=current.indexOf(expected,at);assert.ok(found>=at,file+': each original assertion remains in order');at=found+1;}
  assert.match(source,/\bedition\s*===\s*['"]baseline['"]/,file+': exact original homepage edition remains rendered');
  assert.match(source,/\bsourceAtMarketingRefreshBaseline\s*\(\s*['"]index\.html['"]\s*,/,file+': original rendering derives from the exact approved homepage inverse, never a weaker synthetic fixture');
  return original;
}
let originalLayoutCalls=0;
for(const file of ['scripts/homepage_card_rhythm_smoke.mjs','scripts/site_system_visual_smoke.mjs','scripts/sample_marketing_language_hover_smoke.mjs','scripts/homepage_workspace_demo_smoke.mjs','scripts/methodology_business_copy_smoke.mjs','scripts/sample_tile_smoke.mjs','scripts/homepage_assistant_smoke.mjs']){
  const source=read(file).toString(),original=assertPreservedGuard(file,source);checks+=original.length+3;originalLayoutCalls+=original.length;
  const target=original.map(call=>file.endsWith('site_system_visual_smoke.mjs')?call.replace('geometry.titleX - expectedRailX(geometry.clientWidth)','geometry.titleX - railX'):call).find(call=>source.split(call).length===2);
  ok(Boolean(target),file+': actual original-call mutation target exists');
  reject(()=>assertPreservedGuard(file,source.replace(target,'void 0')),file+': removal of an original assertion is rejected');
  reject(()=>assertPreservedGuard(file,source.replace(target,'/* '+target+' */')),file+': a comment cannot stand in for an executed original assertion');
}
// These are the actual additional geometry rejection hooks in the four reviewed
// adapters, rather than comments or a count copied from a browser receipt.
let geometryNegativeHooks=0;
for(const [file,helper,count]of [
  ['scripts/sample_tile_smoke.mjs','assertReadablePreview',1],
  ['scripts/sample_marketing_language_hover_smoke.mjs','assertEnlargedOverview',1],
  ['scripts/homepage_workspace_demo_smoke.mjs','assertExpandedHeight',2],
  ['scripts/methodology_business_copy_smoke.mjs','assertRefreshedJourneyGeometry',2]]){
  const source=read(file).toString();
  const negativeHooks=value=>guardCalls(value).filter(call=>call.startsWith('assert.throws(')&&call.includes('()=>'+helper+'('));
  const requireHooks=value=>assert.equal(negativeHooks(value).length,count,file+': every current geometry rejection hook remains executable');
  requireHooks(source);checks++;geometryNegativeHooks+=count;
  for(const hook of negativeHooks(source)){
    eq(source.split(hook).length-1,1,file+': unique real geometry-hook mutation target');
    reject(()=>requireHooks(source.replace(hook,'void 0')),file+': removal of a current geometry negative hook rejected');
    reject(()=>requireHooks(source.replace(hook,'/* '+hook+' */')),file+': commenting out a current geometry negative hook rejected');
  }
}
// Keep the assistant's current editorial proof separate from geometry checks.
// Its exact twelve-section proof must run before the one known addition is
// projected into the verbatim eleven-section historical assertion.
const assistantFile='scripts/homepage_assistant_smoke.mjs',assistantSource=read(assistantFile).toString();
const assistantProof='assertCurrentEditorialSequence(editorial.visibleSections, scene)';
const assistantProjection='editorial.visibleSections = [editorial.visibleSections[0], ...editorial.visibleSections.slice(2)];';
const editorialHooks=value=>guardCalls(value).filter(call=>call.startsWith('assert.throws(')&&/\(\)\s*=>\s*assertCurrentEditorialSequence\(/.test(call));
function requireAssistantEditorialProof(source){
  assert.ok(guardCalls(source).includes(assistantProof),'Assistant live current sequence proof remains an executed call');
  assert.ok(source.indexOf(assistantProof)<source.indexOf(assistantProjection)&&source.indexOf(assistantProjection)>=0,'Assistant exact current proof precedes its finite index1 projection');
  assert.ok(source.includes("for (edition of ['baseline', 'current'])"),'Both exact historical and current assistant editions execute');
  assert.equal(editorialHooks(source).length,2,'Both actual editorial rejection loops remain executable');
}
requireAssistantEditorialProof(assistantSource);checks+=4;
const editorialNegativeHooks=editorialHooks(assistantSource).length;
for(const target of [assistantProof,...editorialHooks(assistantSource)]){
  eq(assistantSource.split(target).length-1,1,'Unique assistant editorial proof/rejection mutation target');
  reject(()=>requireAssistantEditorialProof(assistantSource.replace(target,'void 0')),'Removed assistant editorial proof/rejection hook rejected');
  reject(()=>requireAssistantEditorialProof(assistantSource.replace(target,'/* '+target+' */')),'Commented assistant editorial proof/rejection hook rejected');
}
reject(()=>requireAssistantEditorialProof(assistantSource.replace("for (edition of ['baseline', 'current'])","for (edition of ['current'])")),'Omitting the exact historical assistant execution is rejected');
reject(()=>requireAssistantEditorialProof(assistantSource.replace(assistantProof,'void 0').replace(assistantProjection,assistantProjection+'\n'+assistantProof)),'Moving the finite projection before the current proof is rejected');
const index=JSON.parse(read('public-search-index.json')),oldIndex=JSON.parse(prior('public-search-index.json'));
eq(index.length,oldIndex.length,'Search inventory count unchanged');eq(index.filter(x=>x.url!=='index.html'),oldIndex.filter(x=>x.url!=='index.html'),'Every non-homepage search record unchanged');
const currentHome=index.filter(x=>x.url==='index.html'),oldHome=oldIndex.filter(x=>x.url==='index.html');eq(currentHome.length,1,'One updated homepage search record');
eq(Object.fromEntries(Object.entries(currentHome[0]).filter(([k])=>!['text','headings'].includes(k))),Object.fromEntries(Object.entries(oldHome[0]).filter(([k])=>!['text','headings'].includes(k))),'Homepage search URL/title/category and other metadata unchanged');
const newHeadings='The same work. Different questions. Who owns the work between the steps? Where does the decision wait? What work does the process create? What does reliable delivery depend on?';
eq(currentHome[0].headings,replaceExact(oldHome[0].headings,'Evidence Compare results on the same basis.','Evidence '+newHeadings+' Compare results on the same basis.'),'Only the five authored qualitative illustration headings added; every old search heading unchanged');

const photos=marketingRefreshDelta.photography;
const photographyReady=photos.publicationCleared===true&&Array.isArray(photos.photos)&&photos.photos.length===2;
const photographyBlocked=photos.publicationCleared===false&&photos.photographyBlocked===true&&Array.isArray(photos.photos)&&photos.photos.length===0&&Array.isArray(photos.derivatives)&&photos.derivatives.length===0&&typeof photos.blocker==='string'&&photos.blocker.trim().length>0;
ok(photographyReady||photographyBlocked,'Exactly two cleared genuine photographs or explicit empty nonimage continuation; never invent clearance');
if(photographyBlocked){ok(!MARKETING_REFRESH_ADDITIONS.some(p=>/^assets\/marketing\/.+\.(?:avif|webp|jpe?g|png)$/i.test(p)),'No unapproved photography derivative enters the nonimage source');ok(!/Illustrative photography|data-marketing-photo/.test(html),'No placeholder photograph represented as published');}
let photoBytes=0;
if(photographyReady){eq(new Set(photos.photos.map(p=>p.sourceURL)).size,2,'Two distinct cleared photo identities');const derivatives=photos.photos.flatMap(p=>p.files);eq(new Set(derivatives).size,derivatives.length,'No duplicate derivative counted toward two photos');eq(MARKETING_REFRESH_ADDITIONS.filter(p=>/^assets\/marketing\/.+\.(?:avif|webp|jpe?g|png)$/i.test(p)).sort(),[...derivatives].sort(),'Only the reviewed pair derivatives enter public assets');}
for(const photo of photos.photos){
  for(const field of ['sourceURL','licenseURL','creator','placement','modelPropertyReview','attributionReview','restrictionsReview'])ok(typeof photo[field]==='string'&&photo[field].trim().length>0,'Photography approved source/review '+field);
  ok(/^https:\/\//.test(photo.sourceURL)&&/^https:\/\//.test(photo.licenseURL),'Exact professional image source and license URLs');
  for(const field of ['commercialUseAllowed','adaptationAllowed','humanPhotographVerified'])ok(photo[field]===true,'Independently reviewed image clearance '+field);
  ok(Array.isArray(photo.files)&&photo.files.length>0,'Pinned published derivatives only');
  for(const p of photo.files){ok(MARKETING_REFRESH_ADDITIONS.includes(p)&&/^assets\/marketing\/.+\.(?:avif|webp|jpe?g|png)$/i.test(p),'Published derivative is an exact approved local photo asset');photoBytes+=read(p).length;ok(html.includes(p),'Authored photo asset placed in homepage');}
}
ok(photoBytes<=marketingRefreshDelta.assetBudget.photoBytesMax,'Exact two-photo derivative byte budget');
if(photographyReady)ok((html.match(/Illustrative photography/g)||[]).length>=2,'Visible illustrative-photography boundary for both placements');
console.log(JSON.stringify({ok:true,checks,negativeControls,files:existing.length,hunks,additions:MARKETING_REFRESH_ADDITIONS.length,immutableFiles,historicalFixtures,pdfs,parityCases:parityCases.length,originalLayoutCalls,geometryNegativeHooks,editorialNegativeHooks,photoBytes,sourceReady:true,nonImagePublicationReady:true,photographyReady,photographyBlocked,assignmentComplete:photographyReady,networkCalls:0,productionWrites:0,scope:'Exact homepage presentation/qualitative demo; all baseline product/evidence/legal/admission/research bytes and prior checks preserved',photographyBlocker:photographyBlocked?photos.blocker:null}));
