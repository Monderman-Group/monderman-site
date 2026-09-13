// Display-only regression: local pages and synthetic values, no provider or storage calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {chromium, webkit} from 'playwright';
const root=path.resolve(import.meta.dirname,'..');
const pages=['operational-systems','decision-velocity','institutional-performance','structural-clarity'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const out=fs.mkdtempSync('/tmp/monderman-single-run-financial-display-');
let checks=0; const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const fn=(s,name)=>{const start=s.indexOf('function '+name+'(');assert(start>=0,name);const end=s.indexOf('\n    }\n',start+1);assert(end>=0,name+' closing line');return s.slice(start,end+6);};
const exported=(s,name)=>s.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}\\n(?=\\nfunction )'))?.[0];
const scriptBodies=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).join('\n');
const stripExports=s=>['exportExecutiveReport','exportFullReportHTML','downloadExecutiveReportPdf'].reduce((v,n)=>v.replace(exported(v,n),'/* current report export */\n'),s);
for(const slug of pages){
  const s=read(slug+'.html'),previous=execFileSync('git',['show','HEAD:'+slug+'.html'],{cwd:root,encoding:'utf8'});
  eq(stripExports(scriptBodies(s)),stripExports(scriptBodies(previous)),slug+' scoring, answer, completion and storage code unchanged');
  eq(s.includes('<link rel="stylesheet" href="single-run-financial-display.css" />'),true);
  for(const [name,method]of [['exportExecutiveReport','downloadHtml'],['exportFullReportHTML','downloadHtml']]){
    const source=exported(s,name);assert(source,name);const calls=[],result={score:62,exposure:{annual_cost:9876543},answers:{own_hours:37.5}};
    const before=JSON.stringify(result),model={synthetic:true};
    const ctx={window:{MondermanReport:{fromRun:r=>{eq(r,result);return model;},[method]:m=>{eq(m,model);calls.push(method);}}},showToast:m=>calls.push(m)};
    vm.runInNewContext(source+';this.exportFn='+name,ctx);ctx.exportFn(result,{});eq(calls,[method]);eq(JSON.stringify(result),before);
    delete ctx.window.MondermanReport;calls.length=0;ctx.exportFn(result,{});eq(calls.length,1);eq(calls[0].includes('unavailable'),true);
    // No legacy builder, Blob, download link or storage exists in this context.
    calls.length=0;ctx.exportFn(null,{});eq(calls,[]);
  }
  const pdfCalls=[],pdfResult={score:62,exposure:{annual_cost:9876543}},pdfBefore=JSON.stringify(pdfResult);
  const pdfCtx={state:{result:pdfResult},window:{MondermanReport:{fromRun:r=>{eq(r,pdfResult);return r;},downloadPdf:r=>{eq(r,pdfResult);pdfCalls.push('pdf');}}},showToast:m=>pdfCalls.push(m)};
  vm.runInNewContext(exported(s,'downloadExecutiveReportPdf')+';this.run=downloadExecutiveReportPdf;',pdfCtx);
  await pdfCtx.run();eq(pdfCalls,['pdf']);eq(JSON.stringify(pdfResult),pdfBefore);
  pdfCalls.length=0;eq(JSON.parse(JSON.stringify(await pdfCtx.run({returnBlob:true}))),{ok:false,error:'legacy_pdf_export_unavailable'});eq(pdfCalls,[]);
  delete pdfCtx.window.MondermanReport;await pdfCtx.run();eq(pdfCalls.length,1);eq(pdfCalls[0].includes('unavailable'),true);
  pdfCalls.length=0;pdfCtx.state.result=null;await pdfCtx.run();eq(pdfCalls[0].includes('not ready'),true);
}
// Execute the actual legacy teaser and workspace result functions with financial sentinels.
let card;const teaser={pathway_exposure:{annual_cost:9876543,recoverable_cost:8765432},reads_combined:9,lens_count:3,evidence_label:'Recorded evidence',score_status:'published',cross_diagnostic_score:62};
const teaserContext={document:{getElementById:()=>null,createElement:()=>({style:{},setAttribute(){}})},validationMessage:{insertAdjacentElement:(_p,c)=>{card=c;}}};
vm.runInNewContext(fn(read('diagnostics.html'),'renderSynthesisTeaser')+';this.render=renderSynthesisTeaser;',teaserContext);
const teaserBefore=JSON.stringify(teaser);teaserContext.render({teaser});eq(/9876543|9,876,543|8765432|8,765,432|Observed recoverable/.test(card.innerHTML),false);eq(card.innerHTML.includes('Runs combined'),true);eq(card.innerHTML.includes('62'),true);eq(JSON.stringify(teaser),teaserBefore);
const workspace={esc:s=>String(s),parseMaybe:x=>x,listItems:x=>Array.isArray(x)?x:[]};
vm.runInNewContext(fn(read('workspace-diagnostics.html'),'runDetailHTML')+';this.render=runDetailHTML;',workspace);
const saved={primary_driver:'Coordination',exposure_json:{exposed:9876543},key_findings_json:['Reported 37.5 hours.'],priority_actions_json:['Check the recorded work example.']};
const savedBefore=JSON.stringify(saved),detail=workspace.render(saved);eq(detail.includes('9876543'),false);eq(detail.includes('37.5 hours'),true);eq(detail.includes('Coordination'),true);eq(JSON.stringify(saved),savedBefore);
eq(/expLine\(|exposed\/yr/.test(read('workspace-analysis.html')),false);
const financial=['economicHoursValue','economicCostValue','economicCapacityValue','reclaimValue','roiNarrativeText','tmrText','laborCompositionBody','costCompositionBody','roleClusterBody','effortFlowSankey','capacityFlow'];
const screens=[];let layouts=0;
for(const [engineName,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{const page=await browser.newPage();let stylesheetMode='loaded';
    await page.route('**/*',route=>{const u=new URL(route.request().url());
      if(u.origin==='https://display.test'&&pages.some(p=>u.pathname==='/'+p+'.html'))return route.fulfill({contentType:'text/html',body:read(u.pathname.slice(1)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')});
      if(u.origin==='https://display.test'&&u.pathname==='/single-run-financial-display.css')return stylesheetMode==='blocked'?route.abort():stylesheetMode==='missing'?route.fulfill({status:404,body:'Not found'}):route.fulfill({contentType:'text/css',body:read('single-run-financial-display.css')});
      return route.abort(); // All other scripts, APIs, external images and telemetry stay disconnected.
    });
    for(const slug of pages)for(const width of [390,1440])for(const mode of ['loaded','missing','blocked']){
      stylesheetMode=mode;
      await page.setViewportSize({width,height:1000});await page.emulateMedia({media:'screen'});await page.goto('https://display.test/'+slug+'.html');
      await page.evaluate(ids=>{
        // Page scripts are deliberately disabled; remove their initial loading mask.
        document.querySelectorAll('.loading-screen').forEach(n=>n.remove());
        document.querySelectorAll('.stage:not(#resultsStage)').forEach(n=>{n.classList.remove('active');n.style.display='none';});
        const stage=document.getElementById('resultsStage');stage.classList.add('active');
        for(let n=stage;n;n=n.parentElement){n.hidden=false;n.style.visibility='visible';n.style.display='block';}
        document.querySelectorAll('.accordion-section').forEach(n=>{n.classList.add('open');n.classList.remove('hidden');});
        document.querySelectorAll('.accordion-body').forEach(n=>{n.style.maxHeight='none';n.style.opacity='1';});
        for(const id of ids){const n=document.getElementById(id);if(n)n.innerHTML=n.tagName==='TBODY'?'<tr><td>9876543 modeled estimate</td></tr>':'9876543 modeled estimate';}
        document.getElementById('scoreNumber').textContent='62';
        document.getElementById('impactBody').innerHTML='<tr><td>Recorded consequence</td><td>3</td></tr>';
        document.getElementById('basisRows').innerHTML='<dt>Participant-reported time</dt><dd>37.5 hours</dd>';
      },financial);
      for(const media of ['screen','print']){
        await page.emulateMedia({media});for(const id of financial){const n=page.locator('#'+id);if(await n.count())eq(await n.isVisible(),false,slug+'/'+engineName+'/'+media+'/'+mode+'/'+id);}
        eq(await page.locator('.single-run-financial-notice').isVisible(),true);eq(await page.locator('#scoreNumber').isVisible(),true);
        eq(await page.locator('#basisRows').isVisible(),true);eq(await page.locator('#basisRows').textContent(),'Participant-reported time37.5 hours');
        if(await page.locator('#clarityDimensionBars').count())eq(await page.locator('#clarityDimensionBars').isVisible(),true,'Nonfinancial dimension chart retained');
        eq(await page.locator('#impactBody').isVisible(),true,'Nonfinancial impact table retained');
        eq((await page.locator('#resultsStage').innerText()).includes('9876543'),false);layouts++;
      }
      if(slug==='structural-clarity'&&width===390&&mode==='loaded'){await page.emulateMedia({media:'screen'});await page.locator('.single-run-financial-notice').scrollIntoViewIfNeeded();const file=path.join(out,engineName+'-390.png');await page.screenshot({path:file});screens.push(file);}
    }
  }finally{await browser.close();}
}
console.log(JSON.stringify({passed:true,checks,layouts,providerCalls:0,storageCalls:0,pdfs:0,screens,out}));
