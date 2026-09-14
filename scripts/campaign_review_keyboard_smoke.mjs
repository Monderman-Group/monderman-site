// Public, scripted UI transport only. No readiness calculation, real login,
// provider, database mutation, or customer information is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {createCampaignUiMock,campaignCopyScenarios} from './campaign_ui_mock_fixture.mjs';

const base=process.env.SAMPLE_BASE||'http://127.0.0.1:8784';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Only an explicit local candidate is allowed');
const out=fs.mkdtempSync('/tmp/campaign-review-keyboard-');
const source=fs.readFileSync(new URL('../campaign-analysis.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../campaign-analysis.css',import.meta.url),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const scope={id:'scope-mock',label:'MOCK scope',campaignIds:['campaign-mock'],lenses:{decision_velocity:{}}};
let checks=0;const states=[],errors=[],screenshots=[];
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
for(const [engineName,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch();
  try{for(const width of [390,834,1440])for(const role of ['admin','analyst']){
    const page=await browser.newPage({viewport:{width,height:950}});
    page.on('pageerror',error=>errors.push(error.message));
    const records=[{runId:'mock-run',lens:'decision_velocity',status:'included',score:54}];
    const original=JSON.stringify(records),mock=createCampaignUiMock({scope,getRecords:()=>records});
    const options=campaignCopyScenarios().find(s=>s.id==='options-available').options;
    let failPreview=false,failApply=false,applyRequests=0,successfulApplies=0,previewRequests=0;
    const current=()=>({ok:true,scope,snapshot:'b'.repeat(64),...mock.current(),options});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.origin!=='https://mock.monderman.invalid')return route.abort();
      const body=route.request().postDataJSON();let payload,status=200;
      if(url.pathname.endsWith('/quality-preview')){
        previewRequests++;status=failPreview?409:200;
        payload=failPreview?{ok:false,message:'MOCK preview evidence changed.'}:{ok:true,preview:mock.preview(body.decisions)};
      }else if(url.pathname.endsWith('/quality-apply')){
        applyRequests++;status=failApply?409:200;
        if(!failApply)successfulApplies++;
        payload=failApply?{ok:false,message:'MOCK apply evidence changed.'}:current();
      }else if(url.pathname.includes('/scopes/'))payload=current();
      else payload={ok:true,campaigns:[{id:'campaign-mock',tool_type:'decision_velocity',name:'MOCK campaign'}],scopes:[scope]};
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
    });
    equal(await (await page.request.get(base+'/campaign-analysis.js')).text(),source,'Serve the exact candidate module');
    equal(await (await page.request.get(base+'/campaign-analysis.css')).text(),styles,'Serve the exact candidate styles');
    async function mount(){
      await page.goto(base+'/campaign-analysis.css');
      await page.evaluate(async({base,role})=>{
        document.head.innerHTML='<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="'+base+'/campaign-analysis.css"><style>@font-face{font-family:NHG;src:url('+base+'/55font.woff2)}body{font-family:NHG,Arial,sans-serif;margin:0;--text:#183f47;--muted:#53676e;--line:#dce5e8;--panel:#fff;--bg:#fff}</style>';
        document.body.innerHTML='<main style="padding:12px"><p>MOCK UI DATA: not a live campaign or readiness calculation.</p><section id="mount"></section></main>';
        const {mountCampaignAnalysis}=await import(base+'/campaign-analysis.js');window.evidenceChanges=0;
        mountCampaignAnalysis({element:document.getElementById('mount'),organizationId:'org-mock',role,
          apiBase:'https://mock.monderman.invalid',getToken:async()=>'MOCK-NO-AUTH',onReport:async()=>{},
          onEvidenceChanged:()=>window.evidenceChanges++});
      },{base,role});
      await page.locator('.ca-cards').waitFor();
    }
    const focused=locator=>locator.evaluate(el=>el===document.activeElement);
    const activate=async selector=>{const el=page.locator(selector);await el.focus();await page.keyboard.press('Enter');};
    async function choose(){
      await activate('[data-ca-quality]');
      equal(await page.locator('[data-ca-quality]').getAttribute('aria-expanded'),'true','Keyboard opens response-quality review');
      await activate('[data-ca-run] summary');
      equal(await page.locator('[data-ca-run]').evaluate(el=>el.open),true,'Keyboard opens saved response details');
      await page.locator('[data-ca-decision]').focus();
      equal(await focused(page.locator('[data-ca-decision]')),true,'Native selection is keyboard focusable');
      await page.locator('[data-ca-decision]').selectOption('exclude');
      await page.locator('[data-ca-reason]').fill('Confirmed this duplicate against the saved campaign record.');
    }
    async function preview(){
      await activate('[data-ca-quality-form] button[type=submit]');await page.locator('[data-ca-preview-title]').waitFor();
      equal(await focused(page.locator('[data-ca-preview-title]')),true,'Preview moves focus to the comparison, not Apply');
      const before=applyRequests;await page.keyboard.press('Enter');
      equal(applyRequests,before,'Enter on the reading heading does not consent or apply');
      equal(await page.locator('[data-ca-preview-title]').getAttribute('tabindex'),'-1','Reading heading does not add a permanent tab stop');
      equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Preview fits viewport');
      const separation=await page.evaluate(()=>{
        const form=document.querySelector('[data-ca-quality-form]').getBoundingClientRect();
        const preview=document.querySelector('[data-ca-preview]'),heading=preview.querySelector('h3').getBoundingClientRect(),style=getComputedStyle(preview);
        return {gap:heading.top-form.bottom,margin:parseFloat(style.marginTop),padding:parseFloat(style.paddingTop),border:parseFloat(style.borderTopWidth)};
      });
      equal(separation.margin>=24&&separation.padding>=24&&separation.border>=1&&separation.gap>=48,true,'Preview heading and its focus ring have a distinct separated section');
    }
    await mount();await choose();
    failPreview=true;await activate('[data-ca-quality-form] button[type=submit]');
    await page.getByRole('status').filter({hasText:'MOCK preview evidence changed.'}).waitFor();
    equal(await focused(page.locator('[data-ca-quality-form] button[type=submit]')),true,'Preview failure retains the retry control');
    equal(await page.locator('[data-ca-apply]').count(),0,'Failed preview cannot authorize Apply');equal(applyRequests,0,'No automatic apply');
    failPreview=false;await preview();
    await page.locator('[data-ca-reason]').fill('Rechecked the duplicate against the original saved campaign record.');
    equal(await page.locator('[data-ca-preview-title]').count(),0,'Editing a decision invalidates its preview');
    equal(await focused(page.locator('[data-ca-reason]')),true,'Editing keeps focus in the reason field');
    await preview();
    if(role==='admin'&&[390,1440].includes(width)){
      const file=engineName+'-'+width+'-preview.png';await page.screenshot({path:path.join(out,file)});screenshots.push(file);
    }
    failApply=true;await activate('[data-ca-apply]');
    await page.getByRole('status').filter({hasText:'MOCK apply evidence changed.'}).waitFor();
    equal(await focused(page.locator('[data-ca-apply]')),true,'Apply failure preserves focus and the uncommitted review');
    equal(successfulApplies,0,'Rejected Apply does not publish a review');equal(applyRequests,1,'Only the explicit failed Apply was requested');
    failApply=false;
    await activate('[data-ca-refresh]');await page.locator('[data-ca-quality-body]').waitFor({state:'hidden'});
    equal(await focused(page.locator('[data-ca-refresh]')),true,'Refresh retains its stable control');
    equal(await page.locator('[data-ca-apply]').count(),0,'Refresh discards stale preview consent');equal(applyRequests,1,'Refresh makes no Apply request');
    await choose();await preview();await activate('[data-ca-apply]');
    await page.getByRole('status').filter({hasText:'Review applied and recorded.'}).waitFor();
    equal(await focused(page.locator('[data-ca-quality]')),true,'Successful Apply returns focus to the replacement review control');
    equal(successfulApplies,1,'One explicit successful review');equal(await page.evaluate(()=>window.evidenceChanges),1,'One evidence refresh notification');
    equal(JSON.stringify(records),original,'Transport fixture leaves raw score and source unchanged');
    await activate('[data-ca-review]');await page.locator('[data-ca-operating]').waitFor({state:'visible'});
    const radio=page.locator('[data-ca-operating] input[type=radio]').first();await radio.focus();await page.keyboard.press('Space');
    equal(await radio.isChecked(),true,'Keyboard selects a presented action option');
    await activate('[data-ca-review-close]');equal(await focused(page.locator('[data-ca-review]')),true,'Operating-review cancel restores focus');
    await activate('[data-ca-quality]');await activate('[data-ca-quality-close]');
    equal(await focused(page.locator('[data-ca-quality]')),true,'Response-review close restores focus');
    // A fresh mount is a page recovery: it cannot restore pending consent.
    await mount();equal(await page.locator('[data-ca-apply]').count(),0,'Fresh page never restores Apply consent');
    equal(applyRequests,2,'No request during cancellation or fresh page recovery');
    states.push({engine:engineName,width,role,previewRequests,applyRequests,successfulApplies});await page.close();
  }}finally{await browser.close();}
}
equal(errors,[],'No browser errors');equal(sha(fs.readFileSync(new URL('../campaign-analysis.js',import.meta.url))),sha(source),'Candidate unchanged during browser checks');
equal(sha(fs.readFileSync(new URL('../campaign-analysis.css',import.meta.url))),sha(styles),'Candidate styles unchanged during browser checks');
const receipt={status:'PASS',checks,states,screenshots,sourceSha256:sha(source),styleSha256:sha(styles),harnessSha256:sha(fs.readFileSync(import.meta.filename)),
  fixture:'Public data-only transport mocks; no actual readiness calculation, login, provider or database call.',productionCalls:0,providerCalls:0,pdfsCreated:0};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({...receipt,states:states.length,output:out}));
