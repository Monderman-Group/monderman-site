// Actual successor DOM and document bindings; no historical browser responses.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assertCurrentRelease} from './companies_culture_release_20261028_contract.mjs';
import {PART7_IMAGE} from './divide_rule_publication_20261025_browser_contract.mjs';

const root=new URL('../',import.meta.url);
const built=new URL('../.render-public/',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const binding=b=>({bytes:b.length,sha256:sha(b)});
export const homepageInputBindings=(source,build)=>({source:binding(source),build:binding(build)});
const currentInputs=()=>homepageInputBindings(fs.readFileSync(new URL('index.html',root)),fs.readFileSync(new URL('index.html',built)));
export function assertReleaseUnchanged(){assertCurrentRelease(decodeURIComponent(built.pathname));return 1;}
export function assertReleaseHomepageInputs(inputs){
 const release=assertCurrentRelease(decodeURIComponent(built.pathname));
 assert.equal(release.channel,'current','Functional browser observes actual current questionnaire edition');
 assert.deepEqual(inputs,currentInputs(),'Complete admitted successor source and built homepage bytes');
 return 2;
}
export function assertReleaseHomepageResponse(value){
 assert.deepEqual(binding(value),currentInputs().build,'Actual homepage response is the complete admitted successor document');
 return 1;
}
export function assertReleaseHomepageBindingControls(source,build){
 const expected=currentInputs();let checks=0;
 for(const kind of ['source','build'])for(const bad of [Buffer.concat([kind==='source'?source:build,Buffer.from('\nUNAPPROVED')]),(kind==='source'?source:build).subarray(1)]){
  const observed=homepageInputBindings(kind==='source'?bad:source,kind==='build'?bad:build);
  assert.throws(()=>assert.deepEqual(observed,expected),error=>error.name==='AssertionError','Unknown complete document bytes fail current binding');checks++;
 }
 return checks;
}

// Reviewed complete current catalogue, including all unchanged card identities.
export const CURRENT_CATALOGUE=Object.freeze([
 Object.freeze({"id":"companies-dont-have-a-culture","title":"Companies Don’t Have a Culture. They Have Habits.","coverTitle":"Companies Don’t Have a Culture.","label":"Governance and Performance · Part 8 · Insight","href":"companies-dont-have-a-culture.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"ai-wont-land-in-the-middle","title":"AI Won’t Land in the Middle. Someone Has to Put It There.","coverTitle":"AI Won’t Land in the Middle.","label":"AI and Institutions · Part 5 · Insight","href":"ai-wont-land-in-the-middle.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"divide-and-rule-inside-the-company","title":"Divide and Rule Inside the Company","coverTitle":null,"label":"Governance and Performance · Part 7","href":"divide-and-rule-inside-the-company.html","titleCount":1,"coverTitleCount":0,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"posting-has-outgrown-the-job","title":"The Posting Has Outgrown the Job","coverTitle":"The Posting Has Outgrown the Job","label":"Hiring and Work Design · Part 2","href":"posting-has-outgrown-the-job.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"hiring-blind-spot","title":"The Hiring Blind Spot","coverTitle":"The Hiring Blind Spot","label":"Hiring and Work Design · Part 1","href":"hiring-blind-spot.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"hold-collide-come-apart","title":"Hold, Collide, Come Apart","coverTitle":"Hold, Collide, Come Apart","label":"Governance and Performance · Part 6","href":"hold-collide-come-apart.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"durable-organization","title":"The Durable Organization","coverTitle":"The Durable Organization","label":"Governance and Performance · Part 5","href":"durable-organization.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":"trenches-not-silos","title":"Trenches, Not Silos","coverTitle":"Trenches, Not Silos","label":"Governance and Performance · Part 4","href":"trenches-not-silos.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Nothing Stays Tuned","coverTitle":"Nothing StaysTuned","label":"Institutional Performance · Perspective","href":"nothing-stays-tuned.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"We Gave Bureaucracy the Fastest Tools in History. It Got Slower.","coverTitle":"We Gave Bureaucracythe Fastest Toolsin History. It Got Slower.","label":"Institutional Performance · Perspective","href":"we-gave-bureaucracy-the-fastest-tools.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"The Unmeasured Layer","coverTitle":"The Unmeasured Layer","label":"Institutional Performance · Insight","href":"the-unmeasured-layer.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Built to Please","coverTitle":"Built to Please","label":"AI and Institutions · Part 4 · Insight","href":"built-to-please.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Every Node for Itself","coverTitle":"Every Node for Itself","label":"AI and Institutions · Part 3 · Insight","href":"every-node-for-itself.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Merit After the Machine","coverTitle":"Merit After the Machine","label":"AI and Institutions · Part 2 · Insight","href":"merit-after-the-machine.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Terminal Fidelity","coverTitle":"Terminal Fidelity","label":"Decision Design · Insight","href":"terminal-fidelity.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Accumulated Drag in the Department of War","coverTitle":"Accumulated Drag in the Department of War","label":"Defense · Brief","href":"accumulated-drag-department-of-war.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Quarter-Trillion Friction in U.S. Healthcare","coverTitle":"Quarter-Trillion Friction in U.S. Healthcare","label":"Healthcare · Brief","href":"quarter-trillion-friction-us-healthcare.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"From Tokens to Outcomes","coverTitle":"From Tokens to Outcomes","label":"AI and Institutions · Part 1 · Insight","href":"from-tokens-to-outcomes.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"How Workarounds Preserve Output While Masking Institutional Dysfunction","coverTitle":"How Workarounds Preserve Output While Masking Institutional Dysfunction","label":"Enterprise · Brief","href":"compensatory-systems.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"How the Collapse of Eastman Kodak Is Misunderstood","coverTitle":"How the Collapse of Eastman Kodak Is Misunderstood","label":"Enterprise · Brief","href":"when-bureaucracy-became-the-obstacle.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"The Culture Trap","coverTitle":"The Culture Trap","label":"Enterprise · Brief","href":"the-culture-trap-brief.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"The Art of Interior Reasoning","coverTitle":"The Art of Interior Reasoning","label":"Decision Design · Insight","href":"the-art-of-interior-reasoning.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Governing Complexity","coverTitle":"Governing Complexity","label":"Perspective","href":"governing-complexity.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1}),
 Object.freeze({"id":null,"title":"Designing for Decision Velocity","coverTitle":"Designing for Decision Velocity","label":"Perspective","href":"designing-for-decision-velocity.html","titleCount":1,"coverTitleCount":1,"labelCount":1,"hrefCount":1})
]);
export const CURRENT_OLD_DESTINATIONS=Object.freeze(CURRENT_CATALOGUE.filter(row=>!['companies-dont-have-a-culture','ai-wont-land-in-the-middle','divide-and-rule-inside-the-company','posting-has-outgrown-the-job','hiring-blind-spot'].includes(row.id)).map(row=>row.href));
export function assertCurrentCatalogue(rows){
 assert.deepEqual(rows,CURRENT_CATALOGUE,'Actual24 catalogue: every card, field and descending series position');
 return 1;
}
export function assertCurrentCatalogueControls(){
 let checks=assertCurrentCatalogue(structuredClone(CURRENT_CATALOGUE));
 const changes=[rows=>rows.shift(),rows=>rows.push({...rows.at(-1)}),rows=>{[rows[0],rows[1]]=[rows[1],rows[0]];},rows=>{[rows[10],rows[11]]=[rows[11],rows[10]];},rows=>rows[1].href=rows[0].href,rows=>rows[0].label='AI and Institutions · Part 4',rows=>rows[0].title='Changed title',rows=>rows[0].coverTitle=null,rows=>rows[0].titleCount=2];
 for(const mutate of changes){const rows=structuredClone(CURRENT_CATALOGUE);mutate(rows);assert.notDeepEqual(rows,CURRENT_CATALOGUE);assert.throws(()=>assertCurrentCatalogue(rows),error=>error.name==='AssertionError','Unknown actual24 catalogue mutation rejected');checks++;}
 return checks;
}
export function assertCurrent23ImageCover(current){
 const cover=current.part7ImageCover;
 assert.equal(current.cardCount,24,'Actual24 raw carousel inventory');
 assert.equal(cover.totalCards,24,'Actual24 image-cover inventory');
 assert.equal(cover.part7Cards,1,'One actual Part7 image card');
 assert.equal(cover.placeholderCards,23,'All23 actual typographic cards remain');
 assert.equal(cover.placeholderCards+cover.part7Cards,cover.totalCards,'Actual cover forms account for all24 cards');
 assert.equal(current.coverFit.length,23,'All23 actual typographic cover stacks observed');
 assert.equal(cover.images.length,1,'One actual original Part7 image');
 const image=cover.images[0];
 for(const key of ['src','alt','width','height'])assert.equal(image[key],PART7_IMAGE[key],'Current original Part7 image '+key);
 assert.equal(image.complete,true,'Actual Part7 image has loaded');
 assert.ok(image.naturalWidth>0&&image.naturalHeight>0,'Actual Part7 image has decoded');
 for(const key of ['top','bottom','left','right','imageTop','imageBottom','imageLeft','imageRight'])assert.ok(Number.isFinite(image[key]),'Finite actual Part7 image '+key);
 assert.ok(image.bottom>image.top&&image.right>image.left,'Positive actual Part7 image geometry');
 assert.ok(image.top>=image.imageTop-1&&image.bottom<=image.imageBottom+1&&image.left>=image.imageLeft-1&&image.right<=image.imageRight+1,'Actual Part7 image remains inside its cover');
 return 1;
}
export function assertCurrent23ImageCoverControls(){
 const image={...PART7_IMAGE,complete:true,naturalWidth:1672,naturalHeight:941,top:1,bottom:101,left:1,right:201,imageTop:0,imageBottom:102,imageLeft:0,imageRight:202};
 const baseline={cardCount:24,coverFit:Array.from({length:23},()=>({})),part7ImageCover:{totalCards:24,part7Cards:1,placeholderCards:23,images:[image]}};
 let checks=assertCurrent23ImageCover(baseline);
 const changes=[o=>o.cardCount=23,o=>o.part7ImageCover.totalCards=23,o=>o.part7ImageCover.part7Cards=2,o=>o.part7ImageCover.placeholderCards=21,o=>o.coverFit.pop(),o=>o.part7ImageCover.images.pop(),o=>o.part7ImageCover.images.push({...image}),o=>o.part7ImageCover.images[0].src='UNAPPROVED.png',o=>o.part7ImageCover.images[0].alt='UNAPPROVED',o=>o.part7ImageCover.images[0].width=1,o=>o.part7ImageCover.images[0].height=1,o=>o.part7ImageCover.images[0].complete=false,o=>o.part7ImageCover.images[0].naturalWidth=0,o=>o.part7ImageCover.images[0].top=NaN,o=>o.part7ImageCover.images[0].left=-10,o=>o.part7ImageCover.images[0].right=0];
 for(const mutate of changes){const o=structuredClone(baseline);mutate(o);assert.notDeepEqual(o,baseline);assert.throws(()=>assertCurrent23ImageCover(o),error=>error.name==='AssertionError','Unknown actual24 cover mutation rejected');checks++;}
 return checks;
}
export async function assertCurrentCatalogueLayout(page,width){
 await page.waitForFunction(()=>document.querySelector('#latestViewport')?.classList.contains('is-ready')&&document.querySelectorAll('#latestTrack>.latest-card:not(.is-carousel-clone)').length===24&&document.querySelectorAll('#latestTrack>.is-carousel-clone').length===48&&document.querySelectorAll('#latestDots>button').length===24&&document.fonts.status==='loaded',null,{timeout:10000});
 const card=page.locator('#latestTrack>.latest-card[data-publication="ai-wont-land-in-the-middle"]:not(.is-carousel-clone)');
 assert.equal(await card.count(),1,'One actual new AI Part5 card');
 assert.equal(await card.locator('img').count(),0,'Actual new card has no cover art');
 assert.equal(await card.locator('.placeholder-cover-title').innerText(),'AI Won’t Land in the Middle.','New heading is visible in actual typographic cover');
 assert.equal(await card.locator('.placeholder-cover-subline').innerText(),'Someone Has to Put It There.','New subtitle is visible in actual typographic cover');
 const fit=await card.locator('.placeholder-cover-stack').evaluate(stack=>{const cover=stack.closest('.latest-card-image'),t=stack.getBoundingClientRect(),c=cover.getBoundingClientRect();return{left:t.left-c.left,right:c.right-t.right,top:t.top-c.top,bottom:c.bottom-t.bottom,font:Number.parseFloat(getComputedStyle(stack.querySelector('h3')).fontSize)};});
 assert.ok(Object.values(fit).every(Number.isFinite)&&fit.left>=-1&&fit.right>=-1&&fit.top>=-1&&fit.bottom>=-1&&fit.font>=12,'Actual new long title fits its cover at '+width);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Actual24-card homepage has no horizontal overflow at '+width);
 assert.ok(await page.locator('#latestTrack>.is-carousel-clone').evaluateAll(cards=>cards.every(c=>c.inert&&c.getAttribute('aria-hidden')==='true')),'All48 actual carousel clones stay outside accessibility tree');
 if(width===1440){
  await page.emulateMedia({media:'print'});
  const titles=await page.locator('#latestTrack>.latest-card:not(.is-carousel-clone)').evaluateAll(cards=>cards.map(c=>[...c.querySelectorAll('h3')].filter(h=>h.checkVisibility()).map(h=>h.textContent.trim())));
  assert.deepEqual(titles,CURRENT_CATALOGUE.map(c=>[c.title]),'Actual24 print cards each expose one complete title');
  await page.emulateMedia({media:'screen'});
 }
 return 8;
}
export async function assertNewArticleNavigation(page){
 const card=page.locator('#latestTrack>.latest-card[data-publication="ai-wont-land-in-the-middle"]:not(.is-carousel-clone)');
 await card.locator('.latest-card-link').click();
 assert.ok(page.url().endsWith('/ai-wont-land-in-the-middle.html'),'Actual new card opens new article');
 assert.equal(await page.locator('h1').innerText(),'AI Won’t Land in the Middle.','Actual new article title');
 assert.equal(await page.locator('[data-source-paragraph]').count(),14,'All14 actual article prose paragraphs');
 assert.equal(await page.locator('[data-source-reference]').count(),18,'All18 actual article references');
 assert.equal(await page.locator('[data-article-audio]').count(),1,'Actual new article has its native Listen player');
 return 5;
}
