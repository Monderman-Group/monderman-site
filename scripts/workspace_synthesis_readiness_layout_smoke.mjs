// Actual complete Workspace markup/CSS/font fixture. Authentication/data boot
// scripts alone are removed; the exact readiness component is mounted below.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),origin='https://readiness-layout.test',out=fs.mkdtempSync('/tmp/monderman-readiness-layout-');
const context={organizationId:'11111111-1111-4111-8111-111111111111',userId:'33333333-3333-4333-8333-333333333333',role:'admin',token:'MOCK-NOT-A-CREDENTIAL'};
const common={campaignIds:['77777777-7777-4777-8777-777777777777'],status:'satisfied',evaluated:true,policyVersion:'mock-server',scopeDigest:'a'.repeat(64),evidenceDigest:'b'.repeat(64),snapshot:'c'.repeat(64)};
const items=[{...common,scopeId:'55555555-5555-4555-8555-555555555555',kind:'depth',label:'Customer support decisions'},
  {...common,scopeId:'66666666-6666-4666-8666-666666666666',kind:'cross_lens',label:'Purchasing, approvals and operational coordination'}];
let checks=0,external=0;const errors=[],screenshots=[];
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},check=(value,label)=>{assert.ok(value,label);checks++;};
const browser=await chromium.launch({headless:true});
try{for(const file of ['workspace.html','workspace-analysis.html'])for(const width of [390,834,1440])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin){external++;await route.abort();return;}
    const target=path.resolve(root,'.'+url.pathname);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){await route.fulfill({status:404,body:''});return;}
    let body=fs.readFileSync(target);if(target.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</head>','<style>#wsOverlay{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}</style></head>'));
    await route.fulfill({contentType:target.endsWith('.html')?'text/html':target.endsWith('.css')?'text/css':target.endsWith('.js')?'text/javascript':target.endsWith('.svg')?'image/svg+xml':'font/woff2',body});
  });
  await page.goto(origin+'/'+file);
  await page.evaluate(async({context,items,theme,file})=>{
    document.documentElement.dataset.theme=theme;
    const module=await import('/workspace-synthesis-readiness.js');window.readinessRequests=[];
    const element=document.getElementById(file==='workspace.html'?'wsSynthesisReadiness':'wsReadyInvitations');
    module.mountSynthesisReadiness({element,getContext:async()=>context,apiBase:location.origin,fetchImpl:async(url,options)=>{window.readinessRequests.push({url,method:options.method});return {ok:true,json:async()=>({ok:true,organizationId:context.organizationId,serverNow:new Date().toISOString(),canAnalyze:true,evaluationExpiresAt:null,items,nextCursor:null,hasMore:false})};}});
    await document.fonts.ready;
  },{context,items,theme,file});
  const host=page.locator('.ws-readiness-invitations');await host.locator('[data-ready-kind]').first().waitFor();await host.scrollIntoViewIfNeeded();
  const result=await host.evaluate(el=>{const rect=el.getBoundingClientRect();return {font:getComputedStyle(el).fontFamily,text:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,width:rect.width,x:rect.x,innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,localOverflow:el.scrollWidth>el.clientWidth+1,buttons:[...el.querySelectorAll('a,button')].map(button=>({height:button.getBoundingClientRect().height,color:getComputedStyle(button).color,background:getComputedStyle(button).backgroundColor}))};});
  check(result.font.includes('Neue Haas Grotesk'),'Actual NHG font '+file+'/'+theme+'/'+width);
  check(result.x>=-1&&result.x+result.width<=width+1,'Invitation contained in actual page '+file+'/'+theme+'/'+width);
  check(!result.localOverflow&&result.scroll<=result.client+1,'No invitation/page horizontal overflow '+file+'/'+theme+'/'+width);
  check(result.buttons.every(button=>button.height>=44),'Actual page control target size');
  check(theme!=='dark'||result.text!=='rgb(24, 63, 71)','Overview dark text uses actual dark tokens');
  eq(await host.locator('[data-ready-kind]').count(),2,'Both independent ready scopes shown');
  await host.locator('a').first().hover();const hover=await host.locator('a').first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));check(hover.fg!==hover.bg,'Hover text does not vanish');
  const shot=path.join(out,file.replace('.html','')+'-'+theme+'-'+width+'.png');await page.screenshot({path:shot});screenshots.push(shot);
  eq(await page.evaluate(()=>window.readinessRequests.every(request=>request.method==='GET')),true,'Layout fixture never posts');
  await page.close();
}}finally{await browser.close();}
eq(errors,[],'No layout errors');eq(external,0,'All fonts/assets local; no external fetch');
fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({ok:true,checks,external,errors,screenshots,scope:'Actual full HTML/CSS/NHG, application boot replaced by mock readiness transport; not live auth or data'},null,2));
console.log(JSON.stringify({ok:true,checks,external,errors,out,screenshots}));
