import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.SITE_BASE_URL || 'http://127.0.0.1:8796';
const output='tmp/hold-collide-browser';fs.mkdirSync(output,{recursive:true});
let checks=0;const ok=(v,s)=>{assert.ok(v,s);checks++;};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,820,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/hold-collide-come-apart.html');await page.evaluate(()=>document.fonts.ready);
   ok(await page.locator('h1').innerText()==='Hold, Collide, Come Apart','Article title');
   ok(await page.locator('.hold-figure').count()===5,'All figures rendered');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+' article overflow '+width);
   ok(await page.evaluate(()=>[...document.querySelectorAll('.article-body,.trench-panel,.article-references')].every(e=>e.scrollWidth<=e.clientWidth+2)),engine+' article content containment '+width);
   const rects=await page.locator('.hold-figure-5 .trench-panel').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
   ok(width>640 ? rects[0].y===rects[2].y : rects[2].y>rects[0].y,'Responsive figure columns');
   await page.screenshot({path:output+`/${engine}-${width}-hero.png`});
   await page.locator('.hold-figure-5').scrollIntoViewIfNeeded();await page.screenshot({path:output+`/${engine}-${width}-figure.png`});
   const citation=page.locator('sup a').first();await citation.click();
   ok(await page.evaluate(()=>location.hash)==='#reference-1','Clickable citation reaches note');
   ok((await page.request.get(base+'/Monderman_Insight_Hold_Collide_Come_Apart_2026-10-01.pdf')).status()===200,'PDF link 200');
   await page.goto(base+'/research.html');
   const card=page.locator('.series-card').filter({hasText:'Hold, Collide, Come Apart'});
   ok(await card.count()===1,'One Hold Part 6 card');
   ok(await card.locator('.series-chip').textContent()==='Part 6','Current Hold series label');await card.scrollIntoViewIfNeeded();
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Research overflow '+width);
   await page.screenshot({path:output+`/${engine}-${width}-research.png`});
   await card.getByRole('link',{name:'Read article'}).click();ok(page.url().endsWith('/hold-collide-come-apart.html'),'Research article link works');
   await page.goto(base+'/');
   const first=page.locator('.latest-card:not(.is-carousel-clone)').nth(1);ok((await first.innerText()).includes('Hold, Collide, Come Apart'),'Hold remains second after Durable');
   ok((await first.locator('.latest-card-kicker').textContent())==='Governance and Performance · Part 6','Homepage current Hold series label');
   await first.scrollIntoViewIfNeeded();await page.screenshot({path:output+`/${engine}-${width}-carousel.png`});
   ok(errors.length===0,engine+' page errors: '+errors.join('; '));
   await page.close();
  }
 }finally{await browser.close();}
}
console.log(JSON.stringify({passed:true,checks,engines:['chromium','webkit'],widths:[390,820,1440],base,output},null,2));
