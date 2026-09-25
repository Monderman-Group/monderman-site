// Offline current behavior/data checks plus exact historical compatibility.
// Browser geometry is independently inspected through CUA, not inferred here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';
import {HOMEPAGE_COMPACT_FILES,HOMEPAGE_COMPACT_FIXTURE_SHA256,homepageCompactDelta,sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicSampleProjectionCache20260924} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforePublicSamplePreviewBinding20260924,PREVIEW_CURRENT_ARTIFACT_FILE_SHA256} from './public_sample_preview_binding_20260924_inverse.mjs';
import {sourceBeforeHomepagePreviewAnchor20260924} from './homepage_preview_anchor_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
import {sourceAtChangeWordingBaseline} from './change_wording_20260925_inverse.mjs';
// The later single model-cache substitution has its own exact-byte contract;
// restore it before testing this unchanged compact-homepage edition.
const root=path.resolve(import.meta.dirname,'..'),raw=f=>fs.readFileSync(path.join(root,f),'utf8');
const read=f=>sourceBeforePublicSampleProjectionCache20260924(f,sourceBeforePublicSamplePreviewBinding20260924(f,sourceBeforeHomepagePreviewAnchor20260924(f,sourceBeforeHomepageReportQuad20260925(f,sourceAtChangeWordingBaseline(f,raw(f))))));
const sha=v=>createHash('sha256').update(v).digest('hex');
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},ok=(v,label)=>{assert.ok(v,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const before={};
for(const file of HOMEPAGE_COMPACT_FILES){
 const source=read(file),entry=homepageCompactDelta.files[file];before[file]=sourceBeforeHomepageCompactJourney20260924(file,source);
 eq(sha(source),entry.after_sha256,file+': exact current identity');eq(sha(before[file]),entry.before_sha256,file+': exact prior identity');
 for(const mutation of [source+'\n',source.replace(/./,'!')])reject(()=>sourceBeforeHomepageCompactJourney20260924(file,mutation),file+': unrelated bytes rejected');
 reject(()=>sourceBeforeHomepageCompactJourney20260924(file,before[file]),file+': double inversion rejected');
 for(const [start,end,current]of entry.replacements)reject(()=>sourceBeforeHomepageCompactJourney20260924(file,source.slice(0,start)+(current?'!'+current.slice(1):'UNAPPROVED')+source.slice(end)),file+': changed hunk rejected');
}
for(const file of ['monderman-report.js','sample-data/production-diagnostic-samples.json','Monderman_Platform_Brief.html','public-sample-model.js','workspace.html','__proto__']){const value=Buffer.from('Outside scope');assert.equal(sourceBeforeHomepageCompactJourney20260924(file,value),value);checks++;}
eq(sha(read('scripts/fixtures/public-copy-clarity-20260924.json')),homepageCompactDelta.prior_copy_fixture_sha256,'Original copy fixture unchanged');
eq(sha(read('scripts/fixtures/report-library-presentation-20260924.json')),homepageCompactDelta.prior_library_fixture_sha256,'Original library fixture unchanged');
// Explicit private preparation input is exact-byte pinned, not a publication
// override. Default remains the actual current public artifact.
const preparation=process.env.PUBLIC_SAMPLE_PREVIEW_ARTIFACT;
if(preparation)assert.ok(path.isAbsolute(preparation),'Private preparation path must be absolute');
const artifactBytes=preparation?fs.readFileSync(preparation):raw('sample-data/production-diagnostic-samples.json');
if(preparation)eq(sha(artifactBytes),PREVIEW_CURRENT_ARTIFACT_FILE_SHA256,'Only the exact prospective artifact may exercise preparation');
const artifact=JSON.parse(artifactBytes),source=artifact.outputs.cross_lens_synthesis.source;
const template=raw('scripts/templates/home-workspace-preview.html'),html=raw('index.html'),css=read('homepage-workspace-demo.css'),runtime=read('homepage-workspace-demo.js');
const sections=buildPublicSamplePreviewSections(artifact,template),priorSections=buildPublicSamplePreviewSections(artifact,before['scripts/templates/home-workspace-preview.html']);
const journey=/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/;
eq(html.match(journey)?.[0],sections.hero,'Current homepage is exactly generated from saved source');
eq(html.match(/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/)?.[0],sections.home,'Current lower homepage presentation is exactly generated');eq(sections.brief,priorSections.brief,'Platform Brief card unchanged');
eq(read('index.html').replace(journey,'JOURNEY').replaceAll('homepage-workspace-demo.css?v=20260924.compact1','homepage-workspace-demo.css?v=20260924.gold1').replaceAll('homepage-workspace-demo.js?v=20260924.compact1','homepage-workspace-demo.js?v=20260919.journey3'),before['index.html'].replace(journey,'JOURNEY'),'All unrelated homepage bytes preserved');
eq(read('scripts/inject-public-shell.mjs'),before['scripts/inject-public-shell.mjs'].replace('"homepage-workspace-demo.css": "20260924.gold1"','"homepage-workspace-demo.css": "20260924.compact1"').replace('"homepage-workspace-demo.js": "20260920.gather1"','"homepage-workspace-demo.js": "20260924.compact1"'),'Only two injector cache entries changed');
ok(css.startsWith(before['homepage-workspace-demo.css']),'All prior page hierarchy, semantic palette and CSS retained');
eq((sections.hero.match(/class="hwd-compact-tile"/g)||[]).length,4,'Exactly four overview tiles');
eq([...sections.hero.matchAll(/<section class="hwd-compact-tile"><h3>([^<]+)/g)].map(m=>m[1]),['Overall findings','Time and money','Change options','Evidence'],'Approved quad order');
ok(!/<svg\b|<canvas\b|hwd-journey-choice|hwd-choose/.test(sections.hero),'No charts or five-analysis chooser in compact hero');
ok(sections.hero.includes('data-demo-composite>'+source.cross_diagnostic_score+'</strong>'),'Exact recorded composite');
ok(sections.hero.includes(source.condition_band),'Source-owned condition band');
for(const [attr,key]of [['hours','potentialHoursFreed'],['spending-reduction','existingSpendingReduction'],['spending-avoidance','futureSpendingAvoidance']]){
 const match=sections.hero.match(new RegExp('<dd data-demo-'+attr+' data-exact-value="([^"]+)" title="([^"]+)">([^<]+)</dd>'));
 ok(match,'Source-bound financial field '+attr);eq(Number(match[1]),source.financial_scenario.totals[key].central,'Exact central value '+key);ok(match[2].includes(match[1]),'Exact accessible value '+key);
 const value=source.financial_scenario.totals[key].central;eq(match[3],attr==='hours'?value.toLocaleString('en-US',{maximumFractionDigits:0})+' h':value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),'Rounded display '+key);
}
const oldAssumptions=priorSections.hero.match(/<div data-demo-assumptions-for="cross_lens_synthesis">[\s\S]*?<\/details>/)?.[0];
ok(oldAssumptions&&sections.hero.includes(oldAssumptions),'Full existing Cross-Lens low/central/high/cost/allocation disclosure preserved verbatim');
for(const phrase of ['Capacity is not cash savings.','Planning inputs are separate from scores.','Reported conditions are not proven causes.','Role-specific questions remain distinct.','Example, not customer results','No later result in this sample.','before costs'])ok(sections.hero.includes(phrase),'Material boundary: '+phrase);
const option=source.campaign_action_options.find(a=>a.id==='campaign_moderate'),action=option.action.match(/^[^]*?\.(?:\s|$)/)[0].trim();
eq(sections.hero.split(action).length-1,2,'One complete source action in Evaluate and Act');ok(sections.hero.includes(option.prerequisite)&&sections.hero.includes(option.success_check),'Full source prerequisite and success check');
ok(!sections.hero.includes('Operations director'),'No invented accountable owner');
ok(/<\/section>\s*<\/div>\s*<div class="hwd-footer">[\s\S]*href="sample-report.html#synthesis"/.test(sections.hero),'Sample CTA outside every panel');
eq((sections.hero.match(/class="hwd-sample-link"/g)||[]).length,1,'One persistent preview link');
for(const kind of ['roles','lenses','values','quad'])ok(css.includes('.hwd-compact-'+kind),'Scoped compact layout '+kind);
ok(!/\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\b/.test(runtime),'Local-only controller');
function mutated(fn){const copy=structuredClone(artifact);fn(copy.outputs.cross_lens_synthesis.source);copy.outputs.cross_lens_synthesis.provenance.public_source_sha256=evidenceDigest(copy.outputs.cross_lens_synthesis.source);return copy;}
for(const [name,fn]of [
 ['different primary pattern',s=>s.primary_pattern='An unsupported causal claim.'],['withheld composite',s=>s.score_status='withheld'],['participants replaced by runs',s=>s.campaign_evidence.counts.distinctParticipantsAcrossLenses=s.submitted_run_count],['missing moderate option',s=>s.campaign_action_options=s.campaign_action_options.filter(a=>a.id!=='campaign_moderate')],['AI-only changed option',s=>s.ai_report.report.interpretation.action_options.find(a=>a.option_id==='campaign_moderate').action='Invented action.'],['privacy permission missing',s=>delete s.campaign_evidence.depth.lenses[0].requiredGroups[0].privacy.mayDisplayGroupStatistics],['null privacy minimum',s=>s.campaign_evidence.depth.lenses[0].requiredGroups[0].privacy.minimumDisplayedGroupSize=null],['zero privacy minimum',s=>s.campaign_evidence.depth.lenses[0].requiredGroups[0].privacy.minimumDisplayedGroupSize=0],['string privacy minimum',s=>s.campaign_evidence.depth.lenses[0].requiredGroups[0].privacy.minimumDisplayedGroupSize='5'],['different cross-lens role count',s=>s.campaign_evidence.depth.lenses[1].requiredGroups[0].participants++],['negative money',s=>s.financial_scenario.totals.existingSpendingReduction.central=-1]
])reject(()=>buildPublicSamplePreviewSections(mutated(fn),template),'Reject '+name);
// Real local controller exercised in a bounded DOM stub, including keyboard and
// next-step behavior. Browser containment is independently measured through CUA.
const ids=['measure','analysis','actions','return'];let active=null,scrollCall=null,rowTop=200;
const tabs=ids.map(id=>({id:'hwd-tab-'+id,attrs:{'aria-controls':'hwd-panel-'+id},handlers:{},tabIndex:-1,setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},addEventListener(k,v){this.handlers[k]=v},focus(){active=this.id}}));
const panels=ids.map(id=>({id:'hwd-panel-'+id,hidden:false}));
const row={style:{},getBoundingClientRect:()=>({top:rowTop}),scrollIntoView:options=>{scrollCall=options}};
const buttons=['analysis','return','measure'].map(id=>({dataset:{demoNext:id},handlers:{},addEventListener(k,v){this.handlers[k]=v}}));
const app={querySelectorAll:s=>s==='[role="tab"]'?tabs:s==='[role="tabpanel"]'?panels:buttons,querySelector:s=>s==='[role="tablist"]'?row:tabs.find(t=>'#'+t.id===s)};
vm.runInNewContext(runtime,{document:{querySelector:s=>s==='[data-workspace-demo]'?app:{getBoundingClientRect:()=>({bottom:70})}}});
function state(id){eq(tabs.filter(t=>t.attrs['aria-selected']==='true').map(t=>t.id),['hwd-tab-'+id],'Single selected step '+id);eq(panels.filter(p=>!p.hidden).map(p=>p.id),['hwd-panel-'+id],'Single visible panel '+id);eq(tabs.map(t=>t.tabIndex),ids.map(x=>x===id?0:-1),'Roving focus '+id);}
state('measure');for(const tab of tabs){tab.handlers.click();state(tab.id.slice(8));}
for(const [from,key,to]of [[0,'ArrowRight','analysis'],[0,'ArrowLeft','return'],[2,'Home','measure'],[1,'End','return']]){let prevented=false;tabs[from].handlers.keydown({key,preventDefault(){prevented=true}});state(to);ok(prevented,'Keyboard default prevented');eq(active,'hwd-tab-'+to,'Keyboard focus transferred');}
for(const button of buttons){rowTop=0;button.handlers.click();state(button.dataset.demoNext);eq(scrollCall.behavior,'instant','No moving target during next-step navigation');}
console.log(JSON.stringify({status:'PASS',checks,negativeControls,fixtureSha256:HOMEPAGE_COMPACT_FIXTURE_SHA256,files:HOMEPAGE_COMPACT_FILES,sourceArtifactSha256:sha(artifactBytes),preparationOnly:Boolean(preparation),historicalPinsUnchanged:true,publicationApprovalClaimed:false,providerCalls:0},null,2));
