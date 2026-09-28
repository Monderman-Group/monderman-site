// Current homepage placement plus exact preservation of all report/evidence
// sources. Geometry is checked separately in browser smoke, not inferred here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {HOMEPAGE_REPORT_FIRST_BASELINE,HOMEPAGE_REPORT_FIRST_FILES,reportFirstDelta,sourceBeforeHomepageReportFirst20260927,sourceAtHomepageReportFirstBaseline} from './homepage_report_first_20260927_inverse.mjs';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const prior=file=>execFileSync('git',['show',HOMEPAGE_REPORT_FIRST_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
eq(execFileSync('git',['cat-file','-t',HOMEPAGE_REPORT_FIRST_BASELINE],{cwd:root,encoding:'utf8'}).trim(),'tree','Baseline is the immutable tree shared by published main and local preparation');
for(const file of HOMEPAGE_REPORT_FIRST_FILES){
 const current=read(file),before=prior(file),entry=reportFirstDelta.files[file];
 eq(sha(current),entry.after_sha256,file+': exact current presentation identity');
 eq(Buffer.from(sourceBeforeHomepageReportFirst20260927(file,current)),before,file+': immutable preceding source recovered');
 for(const changed of [current.toString()+'\n',current.toString().replace(/./,'!'),before])reject(()=>sourceBeforeHomepageReportFirst20260927(file,changed),file+': unrelated edit or double inversion rejected');
 for(const [start,end]of entry.replacements)reject(()=>sourceBeforeHomepageReportFirst20260927(file,current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end)),file+': exact hunk mutation rejected');
}
for(const file of ['monderman-report.js','sample-data/production-diagnostic-samples.json','workspace.html','__proto__']){
 const value=Buffer.from('Outside this presentation scope');eq(sourceAtHomepageReportFirstBaseline(file,value),value,file+': unrelated bytes remain untouched');
}
const index=read('index.html').toString(),template=read('scripts/templates/home-workspace-preview.html').toString();
const {artifact}=readPublicSampleFixture({root});
const sections=buildPublicSamplePreviewSections(artifact,template);
const quad=/<aside class="hero-report-proof has-sample-depth-tile"[^]*?<\/aside>/g;
const journey=/<aside class="home-workspace-preview"[^]*?<\/aside>/g;
eq([...index.matchAll(quad)].map(m=>m[0]),[sections.home],'One generated Depth report preview');
eq([...index.matchAll(journey)].map(m=>m[0]),[sections.hero],'One generated interactive Cross-Lens journey');
function parentsAt(source,marker){
 const at=source.indexOf(marker);assert.ok(at>=0,'Required element is present');const stack=[];
 for(const m of source.slice(0,at).matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<\/?(section|aside|div|main)\b([^<>]*?)>/gi)){
  if(m[1]||m[0].startsWith('<!--'))continue;
  const tag=m[2].toLowerCase();if(m[0].startsWith('</')){const i=stack.findLastIndex(x=>x.tag===tag);if(i>=0)stack.length=i;}else stack.push({tag,attributes:m[3]});
 }
 return stack;
}
function placement(source){
 const reportParents=parentsAt(source,'<aside class="hero-report-proof has-sample-depth-tile"');
 const journeyParents=parentsAt(source,'<aside class="home-workspace-preview"');
 return {reportInHero:reportParents.some(p=>/class="hero"/.test(p.attributes)),reportInJourney:reportParents.some(p=>/id="sample-output"/.test(p.attributes)),journeyInHero:journeyParents.some(p=>/class="hero"/.test(p.attributes)),journeyInSection:journeyParents.some(p=>/id="sample-output"/.test(p.attributes))};
}
const target={reportInHero:true,reportInJourney:false,journeyInHero:false,journeyInSection:true};
eq(placement(index),target,'Show report value in hero and explain process further down');
reject(()=>assert.deepEqual(placement(prior('index.html').toString()),target),'Old placements are rejected');
ok(index.includes('From understanding the problem to deciding what to change.'),'Relocated journey has the approved purpose-led heading');
ok(index.includes('Gather perspectives from across your organization.'),'Journey copy describes organizational participation');
eq((sections.home.match(/data-preview-kind=/g)||[]).length,2,'Hero includes both money and time diagrams');
eq([...sections.home.matchAll(/data-quad-section="([^"]+)"/g)].map(m=>m[1]),['findings','money','change','evidence'],'Four preview roles retained');
ok(sections.home.includes('Potential spending reduction')&&!sections.home.includes('Current saved'),'Money label does not imply observed savings');
ok(sections.home.includes('sample-report.html#depth'),'Hero report can be opened directly');
ok(sections.hero.includes('sample-report.html#synthesis'),'Relocated journey keeps its own correct sample destination');
const scripts=html=>[...html.matchAll(/<script\b[^>]*>[^]*?<\/script>/gi)].map(m=>m[0]);
eq(scripts(index),scripts(prior('index.html').toString()),'All homepage executable scripts and external script identities unchanged');
const immutable=execFileSync('git',['ls-tree','-r','--name-only',HOMEPAGE_REPORT_FIRST_BASELINE,'--','sample-data','scripts/fixtures','monderman-report.js','participant-evidence-safety.js','public-sample-model.js','sample-report-production.js','sample-report.html','Monderman_Platform_Brief.html','homepage-workspace-demo.js'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of immutable)eq(read(file),prior(file),file+': evidence, reports, older fixtures and runtime remain unchanged');
const fixture=readPublicSampleFixture({root});eq(fixture.entries.length,6,'Six saved sample HTML/PDF bindings still pass their original release checks');
console.log(JSON.stringify({status:'PASS',checks,negativeControls,protectedFiles:immutable.length,baseline:HOMEPAGE_REPORT_FIRST_BASELINE,providerCalls:0,artifactWrites:0,browserVerification:false,publicationApprovalClaimed:false},null,2));
