// Display-only control-font regression. Synthetic models, no AI or PDF creation.
// Default is browser-free; --browser=chromium|webkit adds actual local font checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sourceBeforeRenderer37,renderer36StyleOutput,CURRENT} from './report_dimension_review_labels_smoke.mjs';
const root=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(root,'monderman-report.js'),'utf8');
const current=CURRENT,previous='diagnostic-renderer-evidence-reading-20260913.35';
const fontRule='border-radius:7px;font-family:inherit;font-size:15px;font-weight:500';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
eq(source.split(fontRule).length-1,1,'Exactly one targeted control font declaration');
const prior=sourceBeforeRenderer37(source).replace('diagnostic-renderer-evidence-reading-20260913.36',previous).replace(fontRule,'border-radius:7px;font-size:15px;font-weight:500');
eq(sha(prior),'caf4474e16d679f1122dd39f05e9c930804d4caa99a64222b880b050173cb87c','Only approved font/version changes from exact prior renderer');
const load=code=>{const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'participant-evidence-safety.js'),'utf8'),context);vm.runInNewContext(code,context);return context.window.MondermanReport;};
const report=load(source),old=load(prior);eq(report.rendererVersion,current);
const expectedControls='<div class="actions"><button class="btn btn-accent" onclick="window.print()">Save / Print PDF</button><button class="btn" onclick="window.close()">Close report</button></div>';
const models=['operational_systems','decision_velocity','structural_clarity','institutional_performance'].map(tool_type=>({tool_type,score:51,band:'Synthetic recorded band',business_unit:'Synthetic font regression only',key_findings:['Synthetic display fixture; not an approved report.']}));
let sample;
for(const raw of models){
  const before=JSON.stringify(raw),model=report.fromRun(raw),html=report.buildReportHtml(model),oldHtml=old.buildReportHtml(old.fromRun(raw));
  eq(JSON.stringify(raw),before,'Input unchanged');
  eq(renderer36StyleOutput(html).replaceAll('diagnostic-renderer-evidence-reading-20260913.36',previous).replace(fontRule,'border-radius:7px;font-size:15px;font-weight:500'),oldHtml,'All report content and controls unchanged outside exactly inverted37 display delta and font/version');
  ok(html.includes(expectedControls),'Exact two control labels and handlers retained');
  ok(html.includes('.mr-report .btn{')&&html.includes(fontRule),'Font inheritance scoped to report buttons');
  ok(html.includes('.mr-report .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px;font-family:"Neue Haas Grotesk"'),'Control parent supplies NHG');
  ok(html.includes('.mr-report .actions{display:none!important}'),'Print media keeps controls hidden');
  sample=html;
}
const fonts={'55font.woff2':'74d5343026f2d4b94a434731a8fa2978b5b1fd350121ffcf3af966bf86e15f56','65font.woff2':'4d197d9045099e4a20903370eeb7213fd8a5b567d7aa717b398d533459c02c99','75font.woff2':'1e0502e875bc7bbfba887d4be2b1a6d542cb565ab156b3122289c2633b233e4e'};
for(const [file,hash]of Object.entries(fonts))eq(sha(fs.readFileSync(path.join(root,file))),hash,'Original font bytes retained');
const option=process.argv.slice(2);let browserName=null,blockedRequests=0;
if(option.length){eq(option.length,1);ok(/^--browser=(chromium|webkit)$/.test(option[0]));browserName=option[0].slice(10);}
if(browserName){
  const engines=await import('playwright'),browser=await engines[browserName].launch({headless:true});
  try{for(const width of [390,834,1440]){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    await page.route('**/*',async route=>{const url=new URL(route.request().url()),file=url.pathname.slice(1);if(url.origin==='https://www.monderman.com'&&Object.hasOwn(fonts,file))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(root,file))});blockedRequests++;await route.abort();});
    await page.setContent(sample,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const state=await page.locator('.mr-report .actions > button').evaluateAll(buttons=>buttons.map(button=>{
      const s=getComputedStyle(button),range=document.createRange();range.selectNodeContents(button);
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=`${s.fontWeight} ${s.fontSize} "Neue Haas Grotesk"`;const nhg=ctx.measureText(button.textContent).width;
      ctx.font=`${s.fontWeight} ${s.fontSize} Arial`;const arial=ctx.measureText(button.textContent).width;
      return {text:button.textContent,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,loaded:document.fonts.check('500 15px "Neue Haas Grotesk"'),glyphWidth:range.getBoundingClientRect().width,nhg,arial,insideReport:!!button.closest('.mr-report')};
    }));
    eq(state.length,2);eq(state.map(v=>v.text),['Save / Print PDF','Close report']);
    for(const item of state){ok(item.insideReport&&item.loaded,'Actual loaded report font');ok(item.fontFamily.startsWith('"Neue Haas Grotesk"'),'NHG computed family, not UA Arial');eq(item.fontSize,'15px');eq(item.fontWeight,'500');ok(Math.abs(item.glyphWidth-item.nhg)<1,'DOM glyph width matches NHG');ok(Math.abs(item.glyphWidth-item.arial)>.5,'DOM glyph width differs from Arial fallback');}
    await page.evaluate(()=>{window.__fontTestPrint=0;window.__fontTestClose=0;window.print=()=>window.__fontTestPrint++;window.close=()=>window.__fontTestClose++;});
    await page.getByRole('button',{name:'Save / Print PDF',exact:true}).click();await page.getByRole('button',{name:'Close report',exact:true}).click();
    eq(await page.evaluate(()=>[window.__fontTestPrint,window.__fontTestClose]),[1,1],'Unchanged control actions dispatch once; browser actions stubbed');
    await page.emulateMedia({media:'print'});eq(await page.locator('.mr-report .actions').isVisible(),false,'Controls hidden without creating a PDF');await page.close();
  }}finally{await browser.close();}
}
eq(sha(fs.readFileSync(path.join(root,'monderman-report.js'))),sha(source),'Source unchanged during regression');
console.log(JSON.stringify({status:'PASS',checks,browser:browserName||'not_run',rendererVersion:current,scope:'Synthetic control font only, not actual report approval',blockedRequests,externalNetworkCalls:0,pdfs:0}));
