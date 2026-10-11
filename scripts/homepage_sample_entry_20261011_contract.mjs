// Verify the exact owner-approved homepage hero delta and reject unfamiliar
// edits. This offline contract never submits forms or touches production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {sourceAtHomepageInvitationFocusBaseline} from './homepage_invitation_focus_20261011_inverse.mjs';
import {HOMEPAGE_SAMPLE_ENTRY_BASELINE,HOMEPAGE_SAMPLE_ENTRY_VERSION,HOMEPAGE_SAMPLE_ENTRY_FILES,homepageSampleEntryDelta,sourceBeforeHomepageSampleEntry20261011,sourceAtHomepageSampleEntryBaseline} from './homepage_sample_entry_20261011_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>sourceAtHomepageInvitationFocusBaseline(file,fs.readFileSync(path.join(root,file)));
const prior=file=>execFileSync('git',['show',HOMEPAGE_SAMPLE_ENTRY_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0,hunks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
eq(HOMEPAGE_SAMPLE_ENTRY_BASELINE,'1a11487ad9424b5011ec89d6da4aaac2e7d04c7a','Exact current deployed source baseline');
eq(HOMEPAGE_SAMPLE_ENTRY_VERSION,'homepage-sample-entry-20261011.1','Independent approved hero entry delta');
eq(HOMEPAGE_SAMPLE_ENTRY_FILES,['index.html','public-search-index.json','scripts/homepage_sample_discovery_contract.mjs','scripts/homepage_sample_discovery_smoke.mjs','scripts/public_gold_accent_smoke.mjs','scripts/pilot_retry_browser_smoke.mjs'],'Finite approved product/search and four corresponding layout-check files');
for(const file of HOMEPAGE_SAMPLE_ENTRY_FILES){
  const current=read(file),before=prior(file),entry=homepageSampleEntryDelta.files[file];
  eq(sha(before),entry.before_sha256,file+': original source pin remains exact');
  eq(sha(current),entry.after_sha256,file+': exact approved current source pin');
  eq(sourceBeforeHomepageSampleEntry20261011(file,current),before,file+': all original bytes reconstructed');
  eq(sourceBeforeHomepageSampleEntry20261011(file,current.toString()),before.toString(),file+': original text type retained');
  eq(sourceAtHomepageSampleEntryBaseline(file,current),before,file+': conditional known-source adapter');
  eq(sourceAtHomepageSampleEntryBaseline(file,before),before,file+': original source is not double-inverted');
  for(const [start,end,now]of entry.replacements){
    eq(current.toString().slice(start,end),now,file+': exact finite approved hunk');
    const mutant=Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
    reject(()=>sourceBeforeHomepageSampleEntry20261011(file,mutant),file+': mutation of approved hunk rejected');
    eq(sourceAtHomepageSampleEntryBaseline(file,mutant),mutant,file+': unknown hunk remains visible to historical guards');
    hunks++;
  }
  for(const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),Buffer.from(current.toString().replace(/./,'!')),before]){
    reject(()=>sourceBeforeHomepageSampleEntry20261011(file,mutant),file+': unrelated source edit or double inversion rejected');
    eq(sourceAtHomepageSampleEntryBaseline(file,mutant),mutant,file+': unknown complete source is never normalized');
  }
}
const html=read('index.html').toString(),old=prior('index.html').toString();
const unique=(value,expression,label)=>{const matches=[...value.matchAll(expression)];eq(matches.length,1,label+': exactly one occurrence');return matches[0][0];};
for(const [label,expression]of [
  ['eyebrow',/<p class="hero-eyebrow">[\s\S]*?<\/p>/g],
  ['headline',/<h1 class="hero-title" id="hero-title">[\s\S]*?<\/h1>/g],
  ['supporting statement',/<p class="hero-dek">[\s\S]*?<\/p>/g],
  ['access note',/<p class="hero-access-note">[\s\S]*?<\/p>/g],
  ['methodology link',/<a class="hero-enterprise-link" href="diagnostics\.html#methodology-and-sources">[\s\S]*?<\/a>/g],
])eq(unique(html,expression,label),unique(old,expression,label+' baseline'),label+': every original byte retained');
for(const expression of [/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/g,/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/g])eq(unique(html,expression,'sample preview'),unique(old,expression,'sample preview baseline'),'Complete sample preview and its footer retained byte-for-byte');
eq([...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]),[...old.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]),'All external and embedded scripts remain byte-identical');
assert.match(html,/<a class="btn btn-secondary" href="sample-report\.html">View sample reports<\/a>/);checks++;
assert.doesNotMatch(html,/class="hero-enterprise-link hero-sample-link"/);checks++;
assert.match(html,/<p class="hero-access-note">Available by invitation\. Evaluate Monderman free for 60 days\. No credit card\. No automatic renewal\.<\/p>\s*<a class="hero-enterprise-link hero-invitation-link" href="pattern-trial\.html">Already invited\? Activate your invitation <span aria-hidden="true">&rarr;<\/span><\/a>/);checks++;
const indexed=JSON.parse(read('public-search-index.json')),indexedBefore=JSON.parse(prior('public-search-index.json'));
eq(indexed.filter(entry=>entry.url!=='index.html'),indexedBefore.filter(entry=>entry.url!=='index.html'),'Every other search entry remains byte-equivalent data');
for(const entry of indexed.filter(entry=>entry.url==='index.html'))assert.match(entry.text,/Request an invitation View sample reports Available by invitation\.[\s\S]*Already invited\? Activate your invitation/);checks++;
const historicalFixtures=execFileSync('git',['ls-tree','-r','--name-only',HOMEPAGE_SAMPLE_ENTRY_BASELINE,'--','scripts/fixtures','sample-data'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const protectedFiles=['pattern-trial.html','signin.html','pilot.html','pilot-waitlist.js','pilot-pool.js','evaluation-capacity.js','workspace-access-gate.js','workspace-evaluation.js','participant-evidence-safety.js','monderman-report.js','public-sample-model.js','homepage-workspace-demo.css','homepage-workspace-demo.js','scripts/templates/home-workspace-preview.html','scripts/build_public_search_index.py','legal-document-manifest.json','terms.html','privacy.html','outreach-privacy.html','security.html','subprocessors.html','site-shell/header.html','site-shell/footer.html','.github/workflows/pages-protected-deploy.yml'];
for(const file of [...historicalFixtures,...protectedFiles])eq(read(file),prior(file),file+': original evidence, legal, identity, admissions, preview, workflow and shared styling untouched');
for(const file of ['unknown.js','__proto__','workspace.html']){
  const source=Buffer.from('Outside the approved hero entry delta');
  eq(sourceBeforeHomepageSampleEntry20261011(file,source),source,file+': strict inverse does not touch unrelated source');
  eq(sourceAtHomepageSampleEntryBaseline(file,source),source,file+': conditional inverse does not touch unrelated source');
}
console.log(JSON.stringify({ok:true,checks,negativeControls,files:HOMEPAGE_SAMPLE_ENTRY_FILES.length,hunks,historicalFixtures:historicalFixtures.length,protectedFiles:protectedFiles.length,networkCalls:0,productionWrites:0,scope:'Exact approved homepage hero sample/activation entry delta; unknown edits rejected; all previous fixture and product boundaries retained'}));
