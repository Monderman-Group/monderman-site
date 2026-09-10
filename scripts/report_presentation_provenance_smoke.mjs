// Presentation provenance only. Synthetic fixtures, no provider/customer calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(process.env.REPORT_RENDERER_SOURCE||path.join(root,'monderman-report.js'),'utf8');
const sandbox={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
vm.runInNewContext(source,sandbox);const renderer=sandbox.window.MondermanReport;
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const marker=()=>({version:'os-presentation-2026-09-10.1',status:'known_legacy_text_corrected',corrected_fields:['canonical_descriptor.dominant_burden_note'],notice:'Deterministic display wording was corrected. The saved measurements, original report record, and approved AI interpretation are unchanged.'});
const make=extra=>({tool_type:'operational_systems',score:84,band:'Light',questionnaire_version:'1.3.1',scorer_version:'original-scorer',report_language:{origin_version:'original-language',generation_version:'original-language'},...extra});
const render=raw=>{freeze(raw);const before=JSON.stringify(raw),model=renderer.fromRun(raw),html=renderer.buildReportHtml(model);assert.equal(JSON.stringify(raw),before);return {model,html};};
const method=html=>html.match(/<section[^>]*class="mr-section mr-run-method[\s\S]*?<\/section>/)?.[0]||'';
let cases=0;
const ordinary=render(make({}));assert.doesNotMatch(method(ordinary.html),/Presentation correction/);cases++;
const valid=render(make({_presentation_compatibility:marker()}));
assert.match(method(valid.html),/Presentation correction version<\/dt><dd>os-presentation-2026-09-10\.1/);
assert.match(method(valid.html),/Presentation correction notice<\/dt><dd>Deterministic display wording was corrected\./);
assert.equal(valid.model.score,84);assert.equal(valid.model.reportLanguage.generation_version,'original-language');cases++;
const invalid=[null,{}, {...marker(),status:'applied'}, {...marker(),status:'unknown'}, {...marker(),version:''}, {...marker(),version:'<script>alert(1)</script>'}, {...marker(),version:{}}, {...marker(),corrected_fields:[]}, {...marker(),corrected_fields:'path'}, {...marker(),corrected_fields:[' ']}, {...marker(),corrected_fields:[{}]}, {...marker(),corrected_fields:['x'.repeat(257)]}, {...marker(),corrected_fields:Array(65).fill('path')}, {...marker(),notice:{}}, {...marker(),notice:' '}];
for(const value of invalid){const rendered=render(make({_presentation_compatibility:value})).html;assert.doesNotMatch(method(rendered),/Presentation correction/);assert.equal(rendered,ordinary.html,'invalid marker must not alter the ordinary report');cases++;}
for(const tool_type of ['structural_clarity','decision_velocity','institutional_performance']){assert.doesNotMatch(method(render(make({tool_type,_presentation_compatibility:marker()})).html),/Presentation correction/);cases++;}
const hostileNotice='<img src=x onerror="window.__unsafe=true"> & <script>window.__unsafe=true</script>';
const hostile=render(make({_presentation_compatibility:{...marker(),notice:hostileNotice}}));
assert.doesNotMatch(method(hostile.html),/<img|<script>/);assert.match(method(hostile.html),/&lt;img/);assert.match(method(hostile.html),/&amp;/);cases++;
const long=render(make({_presentation_compatibility:{...marker(),notice:'N'.repeat(600)}}));
assert.ok(method(long.html).includes('N'.repeat(512)));assert.ok(!method(long.html).includes('N'.repeat(513)));cases++;
const nearBoundary=make({process_name:'Q'.repeat(1550)});
assert.match(method(render(nearBoundary).html),/mr-run-method-bounded/);
assert.doesNotMatch(method(render({...nearBoundary,_presentation_compatibility:{...marker(),notice:'N'.repeat(512)}}).html),/mr-run-method-bounded/,'notice text must count toward the method pagination budget');cases++;
const ai={status:'complete',version:'issued-version',report:{version:'issued-version',snapshot_id:'recorded-snapshot',interpretation:{summary:'Recorded approved interpretation.',observations:[],hypotheses:[],recommendations:[],limitations:[]}}};
const withAI=make({_presentation_compatibility:marker(),ai_report:ai});const aiBefore=JSON.stringify(ai),aiRender=render(withAI);
assert.equal(JSON.stringify(aiRender.model.aiReport),aiBefore);assert.match(aiRender.html,/Recorded approved interpretation\./);assert.match(method(aiRender.html),/original-language/);cases++;
if(process.argv.includes('--deterministic-only')){console.log(JSON.stringify({passed:true,cases,providerCalls:0}));process.exit(0);}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.REPORT_OUT||fs.mkdtempSync('/tmp/report-presentation-provenance-');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],unexpected=[];const checks={passed:false,cases,providerCalls:0,widths:[],pdfs:[]};
try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const match=/^https:\/\/www\.monderman\.com\/(55|65|75)font\.woff2$/.exec(route.request().url());if(match)return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,match[1]+'font.woff2'))});unexpected.push(route.request().url());return route.abort();});
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});await page.setContent(valid.html);await page.evaluate(async()=>{await document.fonts.ready;});
    assert.ok(await page.locator('.mr-run-method').innerText().then(t=>t.includes(marker().notice)));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.mr-run-method').screenshot({path:path.join(out,`method-${width}.png`)});checks.widths.push(width);
  }
  for(const [id,item,expected] of [['corrected',valid,marker().notice],['escaped',hostile,hostileNotice]]){
    await page.setContent(item.html);await page.evaluate(async()=>{await document.fonts.ready;});
    assert.equal(await page.locator('.mr-run-method img,.mr-run-method script').count(),0);assert.equal(await page.evaluate(()=>window.__unsafe),undefined);
    assert.ok((await page.locator('.mr-run-method').innerText()).includes(expected));
    const pdf=path.join(out,`${id}.pdf`);await page.pdf({path:pdf,format:'Letter',preferCSSPageSize:true,printBackground:true});
    const p=spawnSync(process.env.PDF_PYTHON||'python3',['-c','import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',pdf],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const pages=JSON.parse(p.stdout),norm=t=>t.replace(/\s+/g,'');
    assert.ok(pages.some(text=>norm(text).includes(norm(expected))&&text.includes(marker().version)),'version and notice must remain visible together in PDF');
    fs.writeFileSync(path.join(out,`${id}-pages.json`),JSON.stringify(pages,null,2));checks.pdfs.push({id,pages:pages.length});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);checks.passed=true;
}finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({...checks,errors,unexpected},null,2));}
console.log(JSON.stringify({...checks,out}));
