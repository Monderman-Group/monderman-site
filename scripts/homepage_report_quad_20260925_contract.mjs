// Offline behavior and source-preservation contract for the homepage preview.
// Browser geometry and publication remain separate checks; this writes nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
import {evidenceDigest} from './public_sample_fixture.mjs';

const root=path.resolve(import.meta.dirname,'..');
const baseline='6bd52d91d2557902f4b090686f244ea91843eb51';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const prior=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:32*1024*1024});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const near=(a,b,label,tolerance=1e-7)=>ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,label+': '+a+' vs '+b);
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const decode=value=>value.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&#x27;':"'",'&nbsp;':' '})[entity]);
const has=(node,cls)=>(node.attrs.class||'').split(/\s+/).includes(cls);
const all=(node,fn)=>[...(fn(node)?[node]:[]),...node.children.flatMap(child=>all(child,fn))];
const classes=(node,cls)=>all(node,item=>has(item,cls));
const text=node=>decode(node.parts.map(part=>typeof part==='string'?part:text(part)).join('')).replace(/\s+/g,' ').trim();

// Structural reader for escaped, renderer-owned markup; scripts never execute.
function parse(html){
 const tree={tag:'root',attrs:{},children:[],parts:[],start:0,end:html.length},stack=[tree];
 const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 let last=0;
 for(const match of html.matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b([^<>]*?)>/gi)){
  stack.at(-1).parts.push(html.slice(last,match.index));last=match.index+match[0].length;
  if(match[0].startsWith('<!--')||match[1])continue;
  const tag=match[2].toLowerCase();
  if(match[0].startsWith('</')){const index=stack.findLastIndex(node=>node.tag===tag);if(index>0){stack[index].end=last;stack.length=index;}continue;}
  const attrs=Object.fromEntries([...match[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(item=>[item[1],decode(item[2]||'')]));
  const node={tag,attrs,children:[],parts:[],start:match.index,end:last};stack.at(-1).children.push(node);stack.at(-1).parts.push(node);
  if(!voids.has(tag)&&!match[0].endsWith('/>'))stack.push(node);
 }
 stack.at(-1).parts.push(html.slice(last));return tree;
}

const artifactBytes=read('sample-data/production-diagnostic-samples.json'),artifact=JSON.parse(artifactBytes);
const artifactBefore=JSON.stringify(artifact),template=read('scripts/templates/home-workspace-preview.html');
const sections=buildPublicSamplePreviewSections(artifact,template),home=sections.home,tree=parse(home);
const index=read('index.html'),brief=read('Monderman_Platform_Brief.html');
const depthAside=/<aside class="hero-report-proof has-sample-depth-tile"[^]*?<\/aside>/g;
const homeAsides=[...index.matchAll(depthAside)],briefAsides=[...brief.matchAll(depthAside)];
eq(homeAsides.length,1,'One lower homepage sample');eq(briefAsides.length,1,'One Platform Brief sample');
eq(homeAsides[0][0],home,'Homepage markup is generated exactly from current saved source');
eq(briefAsides[0][0],sections.brief,'Brief markup remains generated exactly from current saved source');
eq(brief,prior('Monderman_Platform_Brief.html').toString(),'Entire Platform Brief is unchanged');
const hero=/<aside class="home-workspace-preview"[^]*?<\/aside>/;
eq(index.match(hero)?.[0],sections.hero,'Upper homepage journey retains exact source binding');
eq(index.match(hero)?.[0],prior('index.html').toString().match(hero)?.[0],'Upper homepage journey is unchanged');
eq(JSON.stringify(artifact),artifactBefore,'Pure preview generation leaves source data untouched');

const asides=all(tree,node=>node.tag==='aside'),grids=classes(tree,'hrq-grid'),tiles=classes(tree,'hrq-tile');
eq(asides.length,1,'One generated report root');ok(Object.hasOwn(asides[0].attrs,'data-home-report-quad'),'Root identifies the new homepage preview');
eq(asides[0].attrs['data-sample-id'],'depth_synthesis','Preview identifies its own sample');
eq(asides[0].attrs['data-artifact-sha256'],artifact.artifact_sha256,'Preview binds current canonical artifact digest');
eq(grids.length,1,'One four-tile grid');
eq(tiles.map(node=>node.attrs['data-quad-section']),['findings','money','change','evidence'],'Four distinct report roles in reading order');
for(const tile of tiles){
 const links=all(tile,node=>node.tag==='a');
 eq(links.length,tile.attrs['data-quad-section']==='money'?0:1,tile.attrs['data-quad-section']+': approved compact link layout');
 for(const link of links){eq(link.attrs.href,'sample-report.html#depth','Every tile resolves to the existing Depth tab');eq(all(link,node=>node.tag==='a').length,1,'No nested report links');}
}
const footerLinks=classes(tree,'hrq-footer').flatMap(node=>all(node,item=>item.tag==='a'));
eq(footerLinks.length,1,'Footer provides access to complete planning cases');
eq(footerLinks[0].attrs.href,'sample-report.html#depth','Footer resolves to the existing Depth tab');
eq(all(tree,node=>node.tag==='a').length,4,'Three section links and one full-report footer link');
const byRole=Object.fromEntries(tiles.map(node=>[node.attrs['data-quad-section'],node]));
const entry=artifact.outputs.depth_synthesis,source=entry.source,scenario=source.financial_scenario;
const score=all(byRole.findings,node=>Object.hasOwn(node.attrs,'data-promo-score'));
eq(score.length,1,'Exactly one recorded diagnostic score');
eq(Number(text(score[0])),source.source_groups[0].median_score,'Preview keeps recorded median diagnostic score');
ok(!/About \$260,000/.test(text(tree)),'Monetized capacity is no longer the dominant headline');
ok(/central/i.test(text(byRole.money))&&/12 months/.test(text(byRole.money)),'Financial graphic identifies its case and horizon');
ok(/rounded/i.test(text(byRole.money)),'Independent display rounding is disclosed');
ok(/before costs/i.test(text(byRole.money)),'Gross benefit graphics disclose exclusion of costs');
ok(/planning/i.test(text(byRole.money)),'Graphics remain planning estimates');

const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};
for(const file of ['participant-evidence-safety.js','monderman-report.js'])vm.runInNewContext(read(file),context,{filename:file});
const renderer=context.window.MondermanReport;
const report=renderer.buildReportHtml(renderer.fromSynthesis(source)),reportTree=parse(report);
const fullCharts=classes(reportTree,'mr-overview-sankeys'),homeCharts=classes(tree,'mr-overview-sankeys');
eq(fullCharts.length,1,'Current shared report has one compact chart pair');eq(homeCharts.length,1,'Homepage has one compact chart pair');
eq(home.slice(homeCharts[0].start,homeCharts[0].end),report.slice(fullCharts[0].start,fullCharts[0].end),'Homepage reuses exact current renderer chart markup');
eq(classes(byRole.money,'mr-overview-sankeys').length,1,'Charts stay in the time-and-money tile');
const charts=classes(homeCharts[0],'mr-overview-sankey');
eq(charts.map(node=>node.attrs['data-preview-kind']),['money','time'],'Cash and time have separate diagrams');
const totals=scenario.totals;
const days=(Date.parse(scenario.inputs.capacity.measurementEnd)-Date.parse(scenario.inputs.capacity.measurementStart))/86400000;
const moneyBaseline=[...scenario.inputs.spendingReduction.items,...scenario.inputs.spendingAvoidance.items].reduce((sum,item)=>sum+item.baselineMonthlyUnits*item.unitCost*(item.endMonth-item.startMonth+1),0);
const timeBaseline=scenario.inputs.capacity.activities.reduce((sum,item)=>sum+item.measuredHours*scenario.inputs.horizonMonths*365.25/12/days,0);
const expected={money:{baseline:moneyBaseline,amounts:[totals.existingSpendingReduction.central,totals.futureSpendingAvoidance.central,moneyBaseline-totals.existingSpendingReduction.central-totals.futureSpendingAvoidance.central]},time:{baseline:timeBaseline,amounts:[totals.potentialHoursFreed.central,totals.grossPotentialHoursFreed.central-totals.potentialHoursFreed.central,timeBaseline-totals.grossPotentialHoursFreed.central]}};
for(const chart of charts){
 const kind=chart.attrs['data-preview-kind'],values=expected[kind],outcomes=classes(chart,'mr-overview-sankey-outcome');
 eq(chart.attrs['data-preview-case'],'central',kind+': central case only');
 near(Number(chart.attrs['data-preview-baseline']),values.baseline,kind+': baseline grounded in recorded operating inputs');
 eq(outcomes.map(node=>node.attrs['data-preview-role']),['0','1','2'],kind+': all three outcomes retain their distinct role');
 const amounts=outcomes.map(node=>Number(node.attrs['data-preview-amount']));
 amounts.forEach((value,i)=>near(value,values.amounts[i],kind+': saved central outcome '+i));
 near(amounts.reduce((sum,value)=>sum+value,0),values.baseline,kind+': unrounded flow conserves its baseline',.011);
 const ribbons=all(chart,node=>node.tag==='path');eq(ribbons.length,3,kind+': three populated flow ribbons');
 ribbons.forEach((node,i)=>near(Number(node.attrs['data-preview-amount']),amounts[i],kind+': flow and text preserve same exact amount'));
 const svgs=all(chart,node=>node.tag==='svg');eq(svgs.length,1,kind+': one SVG');eq(svgs[0].attrs.role,'img',kind+': accessible graphic role');
 ok(svgs[0].attrs['aria-label']?.length>30,kind+': accessible description preserves numeric context');
}
// These current central figures also catch accidental Cross-Lens substitution.
near(expected.money.baseline,409500,'Depth money baseline');near(expected.time.baseline,15653.571428571428,'Depth time baseline');
near(expected.money.amounts[0],77220,'Depth spending reduction');near(expected.money.amounts[1],54952.5,'Depth spending avoidance');
near(expected.time.amounts[0],2478.32,'Depth retained other-work capacity');near(expected.time.amounts[1],391.5,'Depth time assigned to spending changes');

// Keep sensitive prose bounded to the saved accepted option and evidence scope.
const action=source.ai_report.report.interpretation.action_options.find(option=>option.intensity==='limited').action;
ok(text(byRole.change).includes(action),'Change tile retains complete accepted limited-change action');
ok(/People doing the work report/.test(text(byRole.findings)),'Finding remains attributed to the stated participant perspective');
ok(/Views differ across the included responses/.test(text(byRole.findings)),'The reported division is not presented as one shared view');
ok(/27/.test(text(byRole.evidence))&&/30/.test(text(byRole.evidence)),'Evidence distinguishes participating people and declared population');
const roleLists=classes(byRole.evidence,'hrq-roles');eq(roleLists.length,1,'One disclosed perspective list');
eq(all(roleLists[0],node=>node.tag==='li').map(text),source.campaign_evidence.depth.lenses[0].requiredGroups.map(group=>group.participants+' '+group.label.toLowerCase()),'Role counts and labels are read from the saved campaign evidence');
ok(!/statistical confidence|representative sample|verified savings/i.test(text(tree)),'No unsupported positive confidence or savings claims');
const bad=structuredClone(artifact);bad.outputs.depth_synthesis.source.source_groups[0].median_score++;
reject(()=>buildPublicSamplePreviewSections(bad,template),'Unsealed changed evidence cannot appear in marketing');
for(const [label,change]of [
 ['withheld group',group=>{group.privacy.mayDisplayGroupStatistics=false;}],
 ['group below disclosure minimum',group=>{group.privacy.minimumDisplayedGroupSize=group.participants+1;}],
]){
 const changed=structuredClone(artifact),entry=changed.outputs.depth_synthesis;
 change(entry.source.campaign_evidence.depth.lenses[0].requiredGroups[0]);entry.provenance.public_source_sha256=evidenceDigest(entry.source);
 reject(()=>buildPublicSamplePreviewSections(changed,template),label+': generator fails closed instead of exposing role statistics');
}
const noScenario=structuredClone(artifact);delete noScenario.outputs.depth_synthesis.source.financial_scenario;
noScenario.outputs.depth_synthesis.provenance.public_source_sha256=evidenceDigest(noScenario.outputs.depth_synthesis.source);
const fallback=buildPublicSamplePreviewSections(noScenario,template);
ok(!fallback.home.includes('data-home-report-quad'),'Missing planning scenario retains generic validated fallback');
ok(!fallback.home.includes('mr-overview-sankey'),'Missing planning values never become zero-valued charts');
ok(fallback.home.includes('data-promo-median>52 / 100'),'Fallback keeps available recorded score');

const protectedPaths=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--','sample-data','sample-report.html','sample-report-production.css','sample-report-production.js','public-sample-model.js','monderman-report.js','participant-evidence-safety.js','scripts/templates/home-workspace-preview.html'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of protectedPaths)eq(sha(fs.readFileSync(path.join(root,file))),sha(prior(file)),file+': report and evidence asset unchanged');
eq(read('sample-data/production-diagnostic-samples.json'),artifactBytes,'Public artifact remains byte-identical during checks');
console.log(JSON.stringify({status:'PASS',checks,negativeControls,protectedFiles:protectedPaths.length,baseline,artifactSha256:sha(artifactBytes),networkCalls:0,providerCalls:0,artifactWrites:0,browserVerification:false,publicationApprovalClaimed:false},null,2));
