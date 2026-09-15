// Local generated-artifact QA only: no product account, provider or live page.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [input,output]=process.argv.slice(2),site=path.resolve(import.meta.dirname,'..');
assert.ok(input&&output);assert.ok(!fs.existsSync(output),'Preserve an earlier QA batch');
const dir=path.resolve(input),artifact=JSON.parse(fs.readFileSync(path.join(dir,'production-diagnostic-samples.json')));
fs.mkdirSync(output,{recursive:true,mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex'),rows=[];let checks=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const normalized=text=>String(text).replace(/\s+/gu,' ').trim();
const roles={operational:'People doing the work',managerial:'Managers',executive:'Senior leaders',senior_leader:'Senior leaders',not_specified:'Role not specified',authorized_workspace_staff:'Authorized workspace staff'};
const lenses={structural_clarity:'Structural Clarity',decision_velocity:'Decision Velocity',operational_systems:'Operational Systems',institutional_performance:'Institutional Performance'};
const browser=await chromium.launch({headless:true});
try{for(const [key,entry]of Object.entries(artifact.outputs)){
  const html=fs.readFileSync(path.join(dir,key+'.html'),'utf8'),source=entry.source.result||entry.source;
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://www.monderman.com'&&/^\/(55|65|75)font\.woff2$/.test(url.pathname))return route.fulfill({contentType:'font/woff2',body:fs.readFileSync(path.join(site,url.pathname.slice(1)))});
    return route.abort();
  });
  await page.setContent(html,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  ok(await page.evaluate(()=>document.fonts.check('16px "Neue Haas Grotesk"')),key+' report fonts');
  const text=await page.locator('body').innerText();ok(!/claude-opus|opus5-|About this example|fictional inputs/i.test(text),key+' customer text');
  ok(text.includes(source.ai_report.report.interpretation.summary),key+' original summary');
  for(const field of ['observations','hypotheses','recommendations','action_options'])for(const [index,item]of (source.ai_report.report.interpretation[field]||[]).entries()){
    if(field==='observations'&&(item.experiential_block||item.evidence_block)){
      // The native renderer validates the exact compiled fallback then gives a
      // typed account/question a readable heading. Check every authored/source
      // component in its own actual block, not the differently styled fallback.
      const panel=page.locator('.mr-authored-report .mr-evidence-reading').filter({has:page.getByRole('heading',{name:'What the evidence shows',exact:true})}).locator('.mr-finding').nth(index);
      if(item.experiential_block){const b=item.experiential_block;
        ok(await panel.locator('.mr-experience-evidence').count()===1,key+' native typed account');
        ok(normalized(await panel.locator('blockquote').innerText())===normalized('“'+b.text+'”'),key+' full account');
        ok(normalized(await panel.locator('.mr-experience-scope').innerText())===normalized('Scope: '+b.scope_label),key+' account scope');
        ok(normalized(await panel.locator('.mr-experience-evidence>.mr-reading-context').innerText())===roles[b.role]+' · '+lenses[b.lens],key+' exact account attribution');
        ok(normalized(await panel.locator('.mr-experience-interpretation').innerText())===normalized(item.interpretation_text),key+' full account interpretation');
      }else{const b=item.evidence_block;
        ok(await panel.locator('.mr-question-evidence').count()===1,key+' native typed question');
        ok(normalized(await panel.locator('.mr-question-text').innerText())===normalized(b.question),key+' full question');
        for(const [i,a]of b.answers.entries()){
          const row=panel.locator('.mr-question-answer').nth(i);ok(normalized(await row.locator('dt').innerText())===normalized(a.source_label),key+' question source');
          ok(normalized(await row.locator('dd').innerText())===normalized(a.answer),key+' full answer');
        }
        ok(normalized(await panel.locator('.mr-question-interpretation').innerText())===normalized(item.interpretation_text),key+' full question interpretation');
      }
    }else for(const name of ['text','action','reason','prerequisite','risk','success_check'])if(item[name])ok(normalized(text).includes(normalized(item[name])),key+' full '+field+' '+name);
  }
  const widths=[];
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const shape=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,badAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).length}));
    ok(shape.scroll<=width+1,key+' overflow at '+width);ok(shape.badAnchors===0,key+' evidence anchors at '+width);
    const full=key+'-'+width+'-full.png';await page.screenshot({path:path.join(output,full),fullPage:true});
    const panels=[];
    for(const [name,selector]of [['method','.mr-report-method'],['financial','.mr-financial-scenario']]){
      const p=page.locator(selector).first();if(await p.count()){
        if(name==='method')await p.evaluate(el=>el.open=true);
        const filename=key+'-'+width+'-'+name+'.png';await p.screenshot({path:path.join(output,filename)});panels.push(filename);
      }
    }
    widths.push({...shape,full,panels});
  }
  await page.setViewportSize({width:1440,height:1000});
  const pdf=key+'.pdf';await page.pdf({path:path.join(output,pdf),printBackground:true,preferCSSPageSize:true});
  ok(fs.readFileSync(path.join(output,pdf)).subarray(0,5).toString()==='%PDF-',key+' PDF');
  rows.push({key,html_sha256:sha(html),pdf,pdf_sha256:sha(fs.readFileSync(path.join(output,pdf))),widths});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(output,'CHECKS.json'),JSON.stringify({status:'PASS',checks,rows,providerCalls:0,productionWrites:0,actualBrowserPrintDownloadClaimed:false},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PASS',checks,pdfs:rows.length,output}));
