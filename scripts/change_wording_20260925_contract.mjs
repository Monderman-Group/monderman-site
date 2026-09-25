// Current copy and immutable report semantics, independently of older release
// contracts. This does not generate AI content, PDFs or publication approvals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CHANGE_WORDING_BASELINE,CHANGE_WORDING_FILES,CHANGE_WORDING_VERSION,CHANGE_WORDING_FIXTURE_SHA256,changeWordingDelta,sourceBeforeChangeWording20260925,sourceAtChangeWordingBaseline} from './change_wording_20260925_inverse.mjs';
import {readPublicSampleFixture,currentSynthesisPdfReview,evidenceDigest} from './public_sample_fixture.mjs';
import {sourceAtGovernanceResearchBaseline} from './governance_research_20260925_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..'),read=file=>Buffer.from(sourceAtGovernanceResearchBaseline(file,fs.readFileSync(path.join(root,file))));
const prior=file=>execFileSync('git',['show',CHANGE_WORDING_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0,documents=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const textFiles=['monderman-report.js','sample-report.html','index.html','scripts/templates/home-workspace-preview.html','scripts/refresh_public_sample_previews.mjs','workspace.html','pattern-trial.html','decision-velocity-article.html','decision-velocity.html','structural-clarity.html','operational-systems.html','institutional-performance.html','workspace-diagnostics.html','workspace-analysis.html','workspace-actions.html','cross-tool-synthesis.html','scripts/inject-public-shell.mjs','scripts/public_sample_fixture.mjs'];
eq(CHANGE_WORDING_FILES,textFiles,'Finite exact source scope');
eq(sha(read('scripts/fixtures/change-wording-20260925.json')),CHANGE_WORDING_FIXTURE_SHA256,'Independent complete wording fixture pin');
const uncached=value=>value.replaceAll('monderman-report.js?v=20260925.changewording1','monderman-report.js?v=20260924.overview2');
const captures=(value,pattern)=>[...value.matchAll(pattern)].map(match=>match[0]);
// Node ships this parser for its own REPL. Use its token boundaries to compare
// all executable bytes outside string/template text without adding a package.
const parserModule={exports:{}};
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{module:parserModule,exports:parserModule.exports});
const acorn=parserModule.exports;
function executableBytes(html){
 return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(([,attrs,code])=>{
  if(/type=["'](?:application\/ld\+json|application\/json)["']/.test(attrs))return code;
  acorn.parse(code,{ecmaVersion:'latest',sourceType:/type=["']module["']/.test(attrs)?'module':'script'});
  let result='',position=0;
  for(const token of acorn.tokenizer(code,{ecmaVersion:'latest'})){
   result+=code.slice(position,token.start);
   result+=['string','template'].includes(token.type.label)?'DISPLAY_LITERAL':code.slice(token.start,token.end);
   position=token.end;
  }
  return result+code.slice(position);
 });
}
for(const file of CHANGE_WORDING_FILES){
 const current=read(file),before=prior(file),restored=sourceBeforeChangeWording20260925(file,current),entry=changeWordingDelta.files[file];
 eq(Buffer.from(restored),before,file+': complete historical bytes independently recovered');
 eq(current.length,entry.after_bytes,file+': exact current byte length');eq(before.length,entry.before_bytes,file+': exact prior byte length');
 for(const changed of [current.toString()+'\n',current.toString().replace(/./,'!'),before])reject(()=>sourceBeforeChangeWording20260925(file,changed),file+': unrelated source or double inversion rejected');
 for(const [start,end]of entry.replacements)reject(()=>sourceBeforeChangeWording20260925(file,current.toString().slice(0,start)+'UNAPPROVED'+current.toString().slice(end)),file+': each finite hunk rejects mutation');
 if(file.endsWith('.html')){
  const now=uncached(current.toString()).replace("'Link later evidence to the change it helps evaluate.'","'Link later evidence to the action it tests.'"),old=before.toString();
  for(const [label,pattern]of [['markup and attributes',/<[^>]*>/g],['styles',/<style\b[^>]*>[\s\S]*?<\/style>/g],['numbers',/\d+(?:[,.]\d+)*/g]])eq(captures(now,pattern),captures(old,pattern),file+': '+label+' unchanged except named renderer cache query');
  eq(executableBytes(now),executableBytes(old),file+': all executable bytes outside display literals remain identical');
 }
}
for(const file of ['unrelated.js','sample-data/production-diagnostic-samples.json','__proto__']){
 const untouched=Buffer.from('Outside the finite source scope');eq(sourceBeforeChangeWording20260925(file,untouched),untouched,file+': no arbitrary rewriting');
}
// Independently enumerate the renderer's display literals: exact source equality
// after these substitutions proves its branches, calculations and data access
// remain byte-identical. The intentionally repeated conditional is retained.
const rendererCopy=[
 ['diagnostic-renderer-report-overview-20260924.1',CHANGE_WORDING_VERSION,1],
 ['and what to test next.','and how to decide what to change.',1],
 ['changes to test.','changes to consider.',1],
 ['First thing to test','Decide what to change',3],
 ['choose a bounded test','decide what to change',1],
 ['Test earlier','Review earlier',1],
 ['suggested testing order','suggested review order',1],
 ['What to test next','Decide what to change',1],
 ['Turn the result into a small, measurable test','Decide what to change',1],
 ['Run the first test.','Make the first change.',1],
 ['Select the smallest returned action that can test the diagnosis without adding new operating burden.','Select the smallest suggested change supported by the evidence without adding new operating burden.',1],
 ['Changes to test','Decide what to change',1],
 ['How to judge the test','How to judge the change',1],
 ['before deciding what to test.','before deciding what to change.',1],
 ['before choosing a test.','before deciding what to change.',1],
];
const beforeRenderer=prior('monderman-report.js').toString(),currentRenderer=read('monderman-report.js').toString();
let expectedRenderer=beforeRenderer;
for(const [before,after,count]of rendererCopy){eq(expectedRenderer.split(before).length-1,count,'Exact renderer literal count: '+before);expectedRenderer=expectedRenderer.replaceAll(before,after);}
eq(currentRenderer,expectedRenderer,'Only independently named display literals and display edition changed in renderer');
eq(read('scripts/refresh_public_sample_previews.mjs').toString(),prior('scripts/refresh_public_sample_previews.mjs').toString().replace('Test the scale of a proposed change','Check the scale of a proposed change'),'Preview generator changes one display literal only');
eq(read('scripts/inject-public-shell.mjs').toString(),prior('scripts/inject-public-shell.mjs').toString().replace('"monderman-report.js": "20260924.overview2"','"monderman-report.js": "20260925.changewording1"'),'Build integration changes one renderer cache identity only');

const load=source=>{const context={window:{},console,Intl,Date,Number,String,Array,Object,Math,JSON,WeakSet,Blob,URL,setTimeout,clearTimeout};for(const code of [read('participant-evidence-safety.js').toString(),source,read('public-sample-model.js').toString()])vm.runInNewContext(code,context);return {R:context.window.MondermanReport,P:context.window.MondermanPublicSamples};};
const current=load(currentRenderer),old=load(beforeRenderer),artifactBytes=read('sample-data/production-diagnostic-samples.json'),artifact=JSON.parse(artifactBytes);
eq(artifactBytes,prior('sample-data/production-diagnostic-samples.json'),'All saved evidence, accepted AI prose, inputs and monetary amounts remain byte-identical');
const renderCopy=html=>rendererCopy.reduce((result,[before,after])=>result.replaceAll(before,after),html);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function compare(label,make){
 const model=freeze(make(current)),beforeModel=make(old),identity=JSON.stringify(model);
 const html=current.R.buildReportHtml(model),expected=renderCopy(old.R.buildReportHtml(beforeModel));
 eq(html,expected,label+': every generated HTML byte preserved outside named display literals');
 eq(JSON.stringify(model),identity,label+': immutable model retained during rendering');
 for(const key of ['source','aiReport','financialScenario','campaignEvidence','evidenceAssessment','score','dimensions','dimensionEntries','priorityLadder'])eq(JSON.stringify(model[key]),JSON.stringify(beforeModel[key]),label+': '+key+' retains exact saved values');
 ok(!/Choose a test|First thing to test|How to judge the test|Run the first test|What to test next/.test(html),label+': generic action labels corrected');documents++;
}
for(const [key,entry]of Object.entries(artifact.outputs))compare(key,({P})=>P.model(entry,artifact));
const savedRuns=JSON.parse(read('test-fixtures/authenticated-report-engine-runs.json'));
for(const [key,input]of Object.entries(savedRuns.outputs)){
 compare(key+'/individual',({R})=>R.fromRun(input));
 for(const status of ['pending','failed','complete'])compare(key+'/'+status,({R})=>({...R.fromRun(input),aiReport:{status,report:{interpretation:{summary:'Synthetic unchanged facts.',recommendations:[]}}}}));
}
eq(read('sample-data/production-diagnostic-samples.json'),artifactBytes,'Rendering never edits saved artifact');
const oldFixtures=execFileSync('git',['ls-tree','-r','--name-only',CHANGE_WORDING_BASELINE,'--','scripts/fixtures'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of oldFixtures)eq(sha(read(file)),sha(prior(file)),file+': historical fixture remains byte-identical');

const fixture=readPublicSampleFixture({root}),manifest=fixture.manifest,review=currentSynthesisPdfReview(manifest,artifact);
eq(review.version,'change-wording-presentation-20260925.1','Current PDFs have a separate appended wording review');
const historical=structuredClone(manifest);delete historical.change_wording_presentation_review;
eq(historical,JSON.parse(prior('sample-data/production-sample-release.json')),'Every earlier release field and approval preserved exactly');
eq(review.prior_review.sha256,evidenceDigest(historical.response_comparison_publication_review),'New review binds complete prior review');
const publicationFiles=['sample-data/production-sample-release.json',...Object.values(review.pdf_outputs).map(pin=>pin.path)];
eq(Object.keys(changeWordingDelta.publication_files||{}).sort(),publicationFiles.sort(),'Finite refreshed publication byte pins');
for(const file of publicationFiles){
 const currentBytes=read(file);eq(sha(currentBytes),changeWordingDelta.publication_files[file].after_sha256,file+': exact refreshed publication');
 eq(Buffer.from(sourceAtChangeWordingBaseline(file,currentBytes)),prior(file),file+': original publication remains independently recoverable');
 reject(()=>sourceAtChangeWordingBaseline(file,Buffer.concat([currentBytes,Buffer.from('\n')])),file+': mutated publication rejected');
}
console.log(JSON.stringify({status:'PASS',checks,negativeControls,documents,sourceFiles:CHANGE_WORDING_FILES.length,fixtureSha256:CHANGE_WORDING_FIXTURE_SHA256,rendererVersion:current.R.rendererVersion,historicalApprovalsUnchanged:true,artifactWrites:0,providerCalls:0,networkCalls:0},null,2));
