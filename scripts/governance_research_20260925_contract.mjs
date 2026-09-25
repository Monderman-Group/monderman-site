// Independent current-source verification for the finite library/link changes.
// No rendering, publication, model request, or customer-data operation occurs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {GOVERNANCE_RESEARCH_BASELINE,GOVERNANCE_RESEARCH_FILES,governanceResearchDelta,sourceBeforeGovernanceResearch20260925,sourceAtGovernanceResearchBaseline} from './governance_research_20260925_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const prior=file=>execFileSync('git',['show',GOVERNANCE_RESEARCH_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
const captures=(text,pattern)=>[...text.matchAll(pattern)].map(match=>match[0]);
const oldPdf='Monderman_Insight_The_Unmeasured_Layer.pdf';
const newPdf='Monderman_Insight_The_Unmeasured_Layer_2026-09-02.pdf';
for(const file of GOVERNANCE_RESEARCH_FILES){
  const current=read(file),before=prior(file),entry=governanceResearchDelta.files[file];
  eq(sha(current),entry.after_sha256,file+': entire current source has the reviewed identity');
  eq(Buffer.from(sourceBeforeGovernanceResearch20260925(file,current)),before,file+': independently recover immutable Git baseline');
  eq(captures(current.toString(),/<script\b[^>]*>[\s\S]*?<\/script>/gi),captures(before.toString(),/<script\b[^>]*>[\s\S]*?<\/script>/gi),file+': all executable scripts unchanged');
  if(file!=='research.html')eq(current.toString(),before.toString().replaceAll(oldPdf,newPdf),file+': only the existing PDF destination changes');
  for(const mutant of [current.toString()+'\n',current.toString().replace(/href="[^"]+"/,'href="unreviewed.html"'),before]){
    reject(()=>sourceBeforeGovernanceResearch20260925(file,mutant),file+': unrelated source and double inversion reject');
  }
  for(const [start,end]of entry.replacements)reject(()=>sourceBeforeGovernanceResearch20260925(file,current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end)),file+': every finite changed hunk rejects mutation');
}
for(const file of ['unrelated.html','__proto__','monderman-report.js']){
  const bytes=Buffer.from('Outside this finite source scope');
  eq(sourceBeforeGovernanceResearch20260925(file,bytes),bytes,file+': no arbitrary source rewriting');
  eq(sourceAtGovernanceResearchBaseline(file,bytes),bytes,file+': historical adapter leaves unrelated bytes alone');
}
eq(sha(read(oldPdf)),'9ad87ec1182abe5c09d20f61e1e4fe8ee9bb7f26cd54450555c32a1407595a70','Existing Unmeasured PDF edition is unchanged');
eq(read(newPdf),read(oldPdf),'Dated download is a byte-identical alias, not a rewritten edition');
eq(read(oldPdf),prior(oldPdf),'Legacy download remains available unchanged');
const research=read('research.html').toString(),oldResearch=prior('research.html').toString();
const section=(source,label)=>source.match(new RegExp('<section class="'+label+'"[^>]*>[\\s\\S]*?<\\/section>'))?.[0];
eq(section(research,'book-feature'),section(oldResearch,'book-feature'),'Entire book entry remains unchanged');
eq(section(research,'series" aria-labelledby="ai-institutions-title'),section(oldResearch,'series" aria-labelledby="ai-institutions-title'),'Entire AI series remains unchanged');
const pullquoteText='“The goal is to make change safer and cheaper, so it can happen when it is needed.”';
const pullquoteAttribution='Jason Adamson, <cite>Fast to Cut, Slow to Build</cite>';
const pullquotePattern=/<figure class="series-pullquote"[^>]*>[\s\S]*?<\/figure>/g;
const pullquoteContract=source=>{
  const governance=section(source,'series" aria-labelledby="governance-performance-title')??'';
  const figure=captures(governance,pullquotePattern)[0];
  const content=figure?.match(/^<figure class="series-pullquote"[^>]*>\s*<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>$/);
  const head=governance.match(/<div class="series-head">[\s\S]*?<p class="series-deck">[\s\S]*?<\/p>\s*<\/div>/);
  const grid=governance.indexOf('<div class="series-grid">');
  return {
    figures:captures(source,pullquotePattern).length,
    text:content?.[1].trim(),
    attribution:content?.[2].replace(/\s+/g,' ').trim(),
    immediatelyBetweenHeadAndGrid:!!head&&grid>head.index&&governance.slice(head.index+head[0].length,grid).trim()===figure,
  };
};
const expectedPullquote={figures:1,text:pullquoteText,attribution:pullquoteAttribution,immediatelyBetweenHeadAndGrid:true};
eq(pullquoteContract(research),expectedPullquote,'Governance series has the exact selected quote and citation immediately above its articles');
const pullquote=captures(research,pullquotePattern)[0];
for(const [label,mutant]of [
  ['missing quote',research.replace(pullquote,'')],
  ['altered quote',research.replace(pullquoteText,pullquoteText.replace('safer and cheaper','faster and cheaper'))],
  ['altered citation',research.replace(pullquote,pullquote.replace(pullquoteAttribution,'Jason Adamson, <cite>Nothing Stays Tuned</cite>'))],
  ['misplaced quote',research.replace(pullquote,'').replace('<div class="series-grid">','<div class="series-grid">'+pullquote)],
])reject(()=>assert.deepEqual(pullquoteContract(mutant),expectedPullquote),'Governance pull quote contract rejects '+label);
const libraryStart='<section class="library">';
eq(research.slice(research.indexOf(libraryStart)),oldResearch.slice(oldResearch.indexOf(libraryStart)),'Every later article, essay, footer and search script remains unchanged');
const primary=[...research.matchAll(/class="(?:series-action|paper-action) publication-primary-link" href="([^"]+)"/g)].map(match=>match[1]);
eq(primary.length,18,'Eighteen article entries');eq(new Set(primary).size,18,'No duplicated article entries');
for(const file of ['monderman-report.js','sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json'])eq(read(file),prior(file),file+': report engine, examples and approval records untouched');
console.log(JSON.stringify({status:'PASS',checks,negativeControls,files:GOVERNANCE_RESEARCH_FILES,providerCalls:0,networkCalls:0,published:false},null,2));
