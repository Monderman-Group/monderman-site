// Local transformed-site display only; no account, API, provider or publication assertion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SITE_BASE||'http://127.0.0.1:8080',origin=new URL(base).origin;
assert.ok(['127.0.0.1','localhost','::1'].includes(new URL(base).hostname),'Local candidate only');
const out=fs.mkdtempSync('/tmp/monderman-header-entry-'),results=[];
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [390,834,1440])for(const file of ['index.html','sample-report.html']){
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
      await page.addInitScript(()=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};});
      await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await page.goto(base+'/'+file,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
      if(width<1181)await page.locator('.site-menu-button').click();
      const link=page.locator('.site-entry-link');
      assert.equal(await link.innerText(),'Request an invitation');
      assert.equal(await link.getAttribute('href'),'pilot.html');
      for(const state of ['normal','hover','focus',...(width>1180?['scrolled','return-top']:[])]){
        let returnPaint;
        if(state==='normal')await page.mouse.move(0,0);
        if(state==='hover')await link.hover();
        if(state==='focus'){await page.mouse.move(0,0);await page.keyboard.press('Tab');await link.focus();}
        if(state==='scrolled'){await link.evaluate(e=>e.blur());await page.evaluate(()=>scrollTo(0,400));await page.waitForFunction(()=>document.querySelector('.header').classList.contains('scrolled'));}
        if(state==='return-top'){await page.evaluate(()=>scrollTo(0,0));returnPaint=await link.screenshot();}
        const measured=await link.evaluate(el=>{
          const s=getComputedStyle(el),r=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);const t=range.getBoundingClientRect();
          const rgba=v=>v.match(/[\d.]+/g).map(Number),fg=rgba(s.webkitTextFillColor||s.color);
          let opacity=1,visible=true;
          for(let n=el;n;n=n.parentElement){const c=getComputedStyle(n);opacity*=Number(c.opacity);visible&&=c.visibility==='visible'&&c.display!=='none';}
          return {color:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor,transition:s.transitionProperty,opacity,visible,
            textPaint:fg.length===3||fg[3]>0,font:parseFloat(s.fontSize),contained:t.width>0&&t.height>0&&t.left>=r.left&&t.right<=r.right+1&&t.top>=r.top&&t.bottom<=r.bottom+1,
            inViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,outline:s.outlineWidth};
        });
        const label=name+'/'+width+'/'+file+'/'+state;
        assert.ok(measured.visible&&measured.opacity===1&&measured.textPaint&&measured.font>=12,label+' text paint hidden');
        assert.ok(measured.contained&&measured.inViewport,label+' text clipped');
        if(file==='index.html')assert.equal(measured.transition,'none',label+' text paint must switch with header fill');
        if(state==='focus')assert.ok(parseFloat(measured.outline)>0,label+' keyboard focus invisible');
        // Same element/background before and after suppressing only glyph paint.
        // A byte-identical screenshot would mean the text was not visibly painted.
        const before=returnPaint||await link.screenshot({animations:'disabled'});
        const previous=await link.getAttribute('style');
        await link.evaluate(e=>{e.style.setProperty('-webkit-text-fill-color','transparent','important');e.style.setProperty('text-shadow','none','important');});
        const hidden=await link.screenshot({animations:'disabled'});
        await link.evaluate((e,v)=>v===null?e.removeAttribute('style'):e.setAttribute('style',v),previous);
        assert.ok(!before.equals(hidden),label+' DOM text has no visible glyph paint');
        const glyphPixels=await page.evaluate(async images=>{
          const pixels=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,c.width,c.height).data;};
          const [paint,backdrop]=await Promise.all(images.map(pixels));
          const lum=(a,i)=>[0,1,2].reduce((sum,j)=>{let v=a[i+j]/255;v=v<=.04045?v/12.92:((v+.055)/1.055)**2.4;return sum+v*[.2126,.7152,.0722][j];},0);
          let count=0;for(let i=0;i<paint.length;i+=4){const a=lum(paint,i),b=lum(backdrop,i);if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5)count++;}return count;
        },[before,hidden].map(bytes=>'data:image/png;base64,'+bytes.toString('base64')));
        assert.ok(glyphPixels>=20,label+' lacks visibly painted text pixels with 4.5:1 contrast');
        if(state==='normal')fs.writeFileSync(path.join(out,name+'-'+width+'-'+file+'.png'),before,{flag:'wx'});
        results.push({engine:name,width,file,state,...measured,glyphPaintVerified:true,glyphPixelsAbove4point5Contrast:glyphPixels});
      }
      await page.close();
    }
  }finally{await browser.close();}
}
fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify({passed:true,results,publicCalls:0,pdfs:0,publicationApproved:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,states:results.length,browsers:2,widths:3,pages:2,out,publicCalls:0,pdfs:0}));
