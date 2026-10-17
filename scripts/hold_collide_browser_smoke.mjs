import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.SITE_BASE_URL || 'http://127.0.0.1:8796';
const output='tmp/hold-collide-browser';fs.mkdirSync(output,{recursive:true});
let checks=0;const ok=(v,s)=>{assert.ok(v,s);checks++;};
// Clearly fabricated pure census controls are separate from real DOM observations.
const originalCatalogueDestinations=Object.freeze(["durable-organization.html", "hold-collide-come-apart.html", "trenches-not-silos.html", "nothing-stays-tuned.html", "we-gave-bureaucracy-the-fastest-tools.html", "the-unmeasured-layer.html", "merit-after-the-machine.html", "every-node-for-itself.html", "built-to-please.html", "terminal-fidelity.html", "accumulated-drag-department-of-war.html", "quarter-trillion-friction-us-healthcare.html", "from-tokens-to-outcomes.html", "compensatory-systems.html", "when-bureaucracy-became-the-obstacle.html", "the-culture-trap-brief.html", "the-art-of-interior-reasoning.html", "governing-complexity.html", "designing-for-decision-velocity.html"]);
const expectedCurrentNewCards=Object.freeze([{"id": "posting-has-outgrown-the-job", "title": "The Posting Has Outgrown the Job", "coverTitle": "The Posting Has Outgrown the Job", "label": "Hiring and Work Design · Part 2", "href": "posting-has-outgrown-the-job.html"}, {"id": "hiring-blind-spot", "title": "The Hiring Blind Spot", "coverTitle": "The Hiring Blind Spot", "label": "Hiring and Work Design · Part 1", "href": "hiring-blind-spot.html"}]);
const approvedHomepageInputs=Object.freeze({"source": {"bytes": 299569, "sha256": "8eb87496d02b333d33e9570d239307a03d8ebcc620cc1260254abfbd26feaf69"}, "build": {"bytes": 299715, "sha256": "4035a4004c79c0e8f31fd657eb677395773c470413bc56783d60b34038f42631"}});
const actualCatalogueObservations=[];
function assertCurrentHiringCatalogue(rows){
 let passed=0;
 const exact=(actual,expected,label)=>{assert.deepEqual(actual,expected,'Current21 catalogue: '+label);passed++;};
 exact(Array.isArray(rows),true,'record array');exact(rows.length,21,'exact count');
 for(const [index,expected] of expectedCurrentNewCards.entries()){
  for(const key of ['id','title','coverTitle','label','href'])exact(rows[index][key],expected[key],'row'+index+' '+key);
  for(const key of ['titleCount','coverTitleCount','labelCount','hrefCount'])exact(rows[index][key],1,'row'+index+' '+key);
  exact(rows.filter(row=>row.id===expected.id).length,1,'unique '+expected.id+' ID');
  exact(rows.filter(row=>row.href===expected.href).length,1,'unique '+expected.id+' href');
 }
 exact(rows.filter(row=>!expectedCurrentNewCards.some(expected=>row.id===expected.id)).map(row=>row.href),originalCatalogueDestinations,'unchanged original19 href order');
 return passed;
}
const syntheticCatalogueBaseline=[...expectedCurrentNewCards.map(row=>({...row,titleCount:1,coverTitleCount:1,labelCount:1,hrefCount:1})),...originalCatalogueDestinations.map((href,index)=>({id:null,title:'SYNTHETIC OLD TITLE '+index,coverTitle:'SYNTHETIC OLD COVER '+index,label:'SYNTHETIC OLD LABEL',href,titleCount:1,coverTitleCount:1,labelCount:1,hrefCount:1}))];
checks+=assertCurrentHiringCatalogue(syntheticCatalogueBaseline);
const syntheticCatalogueCases=[
 {name:'missing',mutate:rows=>rows.pop(),expected:'exact count'},
 {name:'extra',mutate:rows=>rows.push({...rows.at(-1)}),expected:'exact count'},
 {name:'duplicate-known-ID',mutate:rows=>rows[2].id=rows[0].id,expected:'unique posting-has-outgrown-the-job ID'},
 {name:'reordered-new-pair',mutate:rows=>{[rows[0],rows[1]]=[rows[1],rows[0]];},expected:'row0 id'},
];
for(const index of [0,1])for(const key of ['id','title','coverTitle','label','href'])syntheticCatalogueCases.push({name:'row'+index+'-wrong-'+key,mutate:rows=>rows[index][key]='SYNTHETIC WRONG '+key,expected:'row'+index+' '+key});
syntheticCatalogueCases.push(
 {name:'reordered-original19',mutate:rows=>{[rows[2],rows[3]]=[rows[3],rows[2]];},expected:'unchanged original19 href order'},
 {name:'duplicate-known-destination',mutate:rows=>rows[2].href=rows[0].href,expected:'unique posting-has-outgrown-the-job href'},
);
assert.equal(syntheticCatalogueCases.length,16);
for(const test of syntheticCatalogueCases){
 const mutant=structuredClone(syntheticCatalogueBaseline);test.mutate(mutant);
 assert.notDeepEqual(mutant,syntheticCatalogueBaseline,'Synthetic case must mutate its named target: '+test.name);
 assert.throws(()=>assertCurrentHiringCatalogue(mutant),error=>error.name==='AssertionError'&&error.message.includes('Current21 catalogue: '+test.expected),'Synthetic census case must fail its own predicate: '+test.name);checks++;
}
console.log('SYNTHETIC_CURRENT21_CATALOGUE_CONTROLS '+JSON.stringify({passed:true,negativeControls:16,scope:'Fabricated pure arrays only; no observed browser or production data.'}));
const homepageSha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceHomepageBytes=fs.readFileSync(new URL('../index.html',import.meta.url));
const buildHomepageBytes=fs.readFileSync(new URL('../.render-public/index.html',import.meta.url));
const actualHomepageInputs={source:{bytes:sourceHomepageBytes.length,sha256:homepageSha(sourceHomepageBytes)},build:{bytes:buildHomepageBytes.length,sha256:homepageSha(buildHomepageBytes)}};
assert.deepEqual(actualHomepageInputs,approvedHomepageInputs,'Source/build homepage inputs are the exact separately approved bytes');checks++;

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
   const homepageResponse=await page.goto(base+'/');
   // Observe the actual current21 catalogue; no routed historical homepage.
   const currentCards=page.locator('.latest-card:not(.is-carousel-clone)');
   const currentRows=await currentCards.evaluateAll(nodes=>nodes.map(node=>({
    id:node.getAttribute('data-publication'),
    title:node.querySelector('.latest-card-title')?.textContent.trim()??null,
    coverTitle:node.querySelector('.placeholder-cover-title')?.textContent.trim()??null,
    label:node.querySelector('.latest-card-kicker')?.textContent.trim()??null,
    href:node.querySelector('.latest-card-link')?.getAttribute('href')??null,
    titleCount:node.querySelectorAll('.latest-card-title').length,
    coverTitleCount:node.querySelectorAll('.placeholder-cover-title').length,
    labelCount:node.querySelectorAll('.latest-card-kicker').length,
    hrefCount:node.querySelectorAll('.latest-card-link').length,
   })));
   const homepageResponseBytes=await homepageResponse.body();
   const actualHomepageResponse={url:homepageResponse.url(),status:homepageResponse.status(),bytes:homepageResponseBytes.length,sha256:homepageSha(homepageResponseBytes)};
   const currentObservation={engine,width,rowCount:currentRows.length,rows:currentRows,homepageResponse:actualHomepageResponse,inputBindings:actualHomepageInputs};
   actualCatalogueObservations.push(currentObservation);
   console.log('ACTUAL_CURRENT21_CATALOGUE_OBSERVATION '+JSON.stringify(currentObservation));
   assert.equal(actualHomepageResponse.status,200,'Actual current homepage document response is HTTP200');checks++;
   assert.deepEqual({bytes:actualHomepageResponse.bytes,sha256:actualHomepageResponse.sha256},approvedHomepageInputs.build,'Actual homepage document is the approved complete built body');checks++;
   checks+=assertCurrentHiringCatalogue(currentRows);
   const previousCards = page.locator('.latest-card:not(.is-carousel-clone):not([data-publication="hiring-blind-spot"]):not([data-publication="posting-has-outgrown-the-job"])');
   ok(await previousCards.count()===19,'Every original homepage publication remains');
   ok(JSON.stringify(await previousCards.locator('.latest-card-link').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href'))))===JSON.stringify(["durable-organization.html","hold-collide-come-apart.html","trenches-not-silos.html","nothing-stays-tuned.html","we-gave-bureaucracy-the-fastest-tools.html","the-unmeasured-layer.html","merit-after-the-machine.html","every-node-for-itself.html","built-to-please.html","terminal-fidelity.html","accumulated-drag-department-of-war.html","quarter-trillion-friction-us-healthcare.html","from-tokens-to-outcomes.html","compensatory-systems.html","when-bureaucracy-became-the-obstacle.html","the-culture-trap-brief.html","the-art-of-interior-reasoning.html","governing-complexity.html","designing-for-decision-velocity.html"]),'All original19 destinations and relative order remain');
   const first=previousCards.nth(1);ok((await first.innerText()).includes('Hold, Collide, Come Apart'),'Hold remains second after Durable');
   ok((await first.locator('.latest-card-kicker').textContent())==='Governance and Performance · Part 6','Homepage current Hold series label');
   await first.scrollIntoViewIfNeeded();await page.screenshot({path:output+`/${engine}-${width}-carousel.png`});
   ok(errors.length===0,engine+' page errors: '+errors.join('; '));
   await page.close();
  }
 }finally{await browser.close();}
}
console.log('ACTUAL_CURRENT21_CATALOGUE_SUCCESS '+JSON.stringify({passed:true,syntheticNegativeControls:16,observations:actualCatalogueObservations}));
console.log(JSON.stringify({passed:true,checks,engines:['chromium','webkit'],widths:[390,820,1440],base,output},null,2));
