// Exact current Part 7 browser observations, followed only by finite historical views.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicationDelta,sourceAtPublicationBaseline,publicSourceAtPublicationBaseline} from './divide_rule_publication_20261025_inverse.mjs';
export const PART7_CARD=Object.freeze({id:'divide-and-rule-inside-the-company',title:'Divide and Rule Inside the Company',coverTitle:null,label:'Governance and Performance · Part 7',href:'divide-and-rule-inside-the-company.html',titleCount:1,coverTitleCount:0,labelCount:1,hrefCount:1});
export const PART7_IMAGE=Object.freeze({src:'assets/research/divide-and-rule-inside-the-company-figure-2.png',alt:'Illustrative organizational charts showing overlapping authority accumulating beneath a chief',width:1672,height:941});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const binding=bytes=>({bytes:bytes.length,sha256:sha(bytes)});
export const homepageInputBindings=(source,build)=>({source:binding(source),build:binding(build)});
export const homepageInputsBeforePart7=(source,build)=>homepageInputBindings(sourceAtPublicationBaseline('index.html',source),publicSourceAtPublicationBaseline('index.html',build));
export const homepageResponseBeforePart7=bytes=>binding(publicSourceAtPublicationBaseline('index.html',bytes));
export function assertPart7HomepageInputs(inputs){
 const source=publicationDelta.sourceRows.find(row=>row.path==='index.html');
 assert.deepEqual(inputs.source,{bytes:source.bytes,sha256:source.sha256},'Current Part7 complete source homepage bytes');
 const builds=Object.values(publicationDelta.publicEditions).map(edition=>edition.currentMap.find(row=>row.path==='index.html'));
 assert.ok(builds.some(row=>inputs.build.bytes===row.bytes&&inputs.build.sha256===row.sha256),'Current Part7 complete built homepage bytes');
 return 2;
}
export function assertPart7HomepageBindingControls(source,build,prior){
 let checks=0;
 for(const kind of ['source','build'])for(const bytes of [Buffer.concat([kind==='source'?source:build,Buffer.from('\nUNAPPROVED')]),(kind==='source'?source:build).subarray(1)]){
  const s=kind==='source'?bytes:source,b=kind==='build'?bytes:build;
  assert.throws(()=>assertPart7HomepageInputs(homepageInputBindings(s,b)),error=>error.name==='AssertionError','Unknown homepage bytes fail current binding');checks++;
  assert.notDeepEqual(homepageInputsBeforePart7(s,b),prior,'Unknown homepage bytes do not project to approved prior pins');checks++;
 }
 return checks;
}
export function assertCurrentPart7Catalogue(rows,priorPredicate){
 let checks=0;
 const exact=(a,b,label)=>{assert.deepEqual(a,b,'Current22 Part7 catalogue: '+label);checks++;};
 exact(Array.isArray(rows),true,'record array');exact(rows.length,22,'exact count');exact(rows[0],PART7_CARD,'exact new leading row');
 exact(rows.filter(row=>row.id===PART7_CARD.id).length,1,'unique new ID');exact(rows.filter(row=>row.href===PART7_CARD.href).length,1,'unique new destination');
 checks+=priorPredicate(rows.slice(1));
 return checks;
}
export function assertPart7CatalogueControls(priorRows,priorPredicate){
 const baseline=[{...PART7_CARD},...structuredClone(priorRows)];
 let checks=assertCurrentPart7Catalogue(baseline,priorPredicate);
 const cases=[rows=>rows.shift(),rows=>rows.push({...rows.at(-1)}),rows=>rows[2].id=PART7_CARD.id,rows=>rows[2].href=PART7_CARD.href,rows=>{[rows[0],rows[1]]=[rows[1],rows[0]];}];
 for(const key of Object.keys(PART7_CARD))cases.push(rows=>rows[0][key]='UNAPPROVED '+key);
 cases.push(rows=>{[rows[1],rows[2]]=[rows[2],rows[1]];},rows=>{[rows[3],rows[4]]=[rows[4],rows[3]];});
 assert.equal(cases.length,16);
 for(const mutate of cases){const rows=structuredClone(baseline);mutate(rows);assert.notDeepEqual(rows,baseline);assert.throws(()=>assertCurrentPart7Catalogue(rows,priorPredicate),error=>error.name==='AssertionError'&&/Current22 Part7 catalogue|Current21 catalogue/.test(error.message),'Unknown current catalogue mutation fails its real predicate');checks++;}
 console.log('SYNTHETIC_CURRENT22_PART7_CONTROLS '+JSON.stringify({passed:true,negativeControls:16,scope:'Fabricated arrays only; original21 predicates retained on exact prior-row view.'}));
 return checks;
}
export function assertPart7ImageCover(observation){
 assert.equal(observation.totalCards,22,'Current22 image-cover card inventory');assert.equal(observation.part7Cards,1,'Exactly one Part7 image card');assert.equal(observation.placeholderCards,21,'All original21 placeholder cards remain');
 assert.equal(observation.placeholderCards+observation.part7Cards,observation.totalCards,'Closed two cover forms account for every card');
 assert.equal(observation.images.length,1,'Exactly one image in Part7 cover');
 const image=observation.images[0];
 for(const key of ['src','alt','width','height'])assert.equal(image[key],PART7_IMAGE[key],'Exact Part7 cover '+key);
 assert.equal(image.complete,true,'Part7 cover image loaded');assert.ok(image.naturalWidth>0&&image.naturalHeight>0,'Part7 cover image decoded');
 for(const key of ['top','bottom','left','right','imageTop','imageBottom','imageLeft','imageRight'])assert.ok(Number.isFinite(image[key]),'Finite image geometry '+key);
 assert.ok(image.bottom>image.top&&image.right>image.left,'Visible positive Part7 image geometry');
 assert.ok(image.top>=image.imageTop-1&&image.bottom<=image.imageBottom+1&&image.left>=image.imageLeft-1&&image.right<=image.imageRight+1,'Part7 image remains contained by cover');
 return 21;
}
export function assertPart7ImageControls(){
 const image={...PART7_IMAGE,complete:true,naturalWidth:1672,naturalHeight:941,top:1,bottom:101,left:1,right:201,imageTop:0,imageBottom:102,imageLeft:0,imageRight:202};
 const baseline={totalCards:22,part7Cards:1,placeholderCards:21,images:[image]};let checks=assertPart7ImageCover(baseline);
 const cases=[o=>o.images.pop(),o=>o.images.push({...o.images[0]}),o=>o.part7Cards=0,o=>o.part7Cards=2,o=>o.placeholderCards=20,o=>o.totalCards=23,o=>o.images[0].src='UNAPPROVED.png',o=>o.images[0].alt='UNAPPROVED',o=>o.images[0].width=1,o=>o.images[0].height=1,o=>o.images[0].complete=false,o=>o.images[0].naturalWidth=0,o=>o.images[0].left=-10,o=>o.images[0].bottom=200,o=>o.images[0].right=o.images[0].left];
 for(const mutate of cases){const o=structuredClone(baseline);mutate(o);assert.notDeepEqual(o,baseline);assert.throws(()=>assertPart7ImageCover(o),error=>error.name==='AssertionError','Unknown Part7 image mutation rejected');checks++;}
 console.log('SYNTHETIC_PART7_IMAGE_CONTROLS '+JSON.stringify({passed:true,negativeControls:cases.length,scope:'Fabricated pure geometry/image observations only.'}));return checks;
}

export function placeholderCoverBeforePart7(current){
 assertPart7ImageCover(current.part7ImageCover);
 assert.equal(current.cardCount,current.part7ImageCover.totalCards,'Raw carousel total retained');
 assert.equal(current.coverFit.length,current.part7ImageCover.placeholderCards,'All original21 cover stacks observed');
 return {...current,cardCount:current.part7ImageCover.placeholderCards};
}
