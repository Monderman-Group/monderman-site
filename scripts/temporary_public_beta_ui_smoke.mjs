import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const BASE='https://www.monderman.com';
const publicPages=['/','/privacy.html','/security.html','/terms.html','/pattern-trial.html','/plan-pattern.html','/signin.html'];
const workspacePages=['/workspace.html','/workspace-diagnostics.html','/workspace-analysis.html','/workspace-actions.html','/workspace-settings.html'];

async function smoke(browserType,name){
  const browser=await browserType.launch({headless:true});
  try{
    for(const width of [390,768,1440]){
      const page=await browser.newPage({viewport:{width,height:844}});
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e.message||e)));
      for(const path of publicPages){
        const res=await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
        assert.ok(res && res.status()<400,`${name} ${width} ${path} HTTP ${res?.status()}`);
        const title=await page.title(); assert.ok(title.trim(),`${name} ${path} title empty`);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        assert.ok(overflow<=4,`${name} ${width} ${path} horizontal overflow ${overflow}px`);
        await page.keyboard.press('Tab');
        const active=await page.evaluate(()=>{const e=document.activeElement;return e&&e!==document.body&&e!==document.documentElement;});
        assert.ok(active,`${name} ${path} first Tab produced no focus target`);
      }
      assert.equal(errors.length,0,`${name} ${width} public page errors: ${errors.join(' | ')}`);
      await page.close();
    }

    // Workspace shell geometry with JavaScript disabled avoids auth redirect while
    // still testing the exact shipped HTML/CSS at the mobile breakpoint.
    const ctx=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
    for(const path of workspacePages){
      const page=await ctx.newPage();
      const res=await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
      assert.ok(res&&res.status()<400,`${name} workspace ${path} HTTP ${res?.status()}`);
      const geom=await page.evaluate(()=>({
        vw:document.documentElement.clientWidth,
        sw:document.documentElement.scrollWidth,
        rail:document.querySelector('.ws5-rail')?.getBoundingClientRect().toJSON?.()||null,
        brand:document.querySelector('.ws5-brand')?.textContent||''
      }));
      assert.ok(geom.sw-geom.vw<=4,`${name} ${path} workspace horizontal page overflow ${geom.sw-geom.vw}px`);
      assert.match(geom.brand,/Monderman/i,`${name} ${path} workspace brand missing`);
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>document.activeElement?.tagName||'');
      assert.notEqual(focus,'BODY',`${name} ${path} no keyboard focus target`);
      await page.close();
    }
    await ctx.close();
  } finally { await browser.close(); }
  console.log(`UI_SMOKE_${name}=PASS`);
}

await smoke(chromium,'CHROMIUM');
await smoke(webkit,'WEBKIT');
