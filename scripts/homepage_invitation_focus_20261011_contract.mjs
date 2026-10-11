// Exact focus-transition repair, preserving the reviewed PR hero and every older pin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {HOMEPAGE_INVITATION_FOCUS_BASELINE,HOMEPAGE_INVITATION_FOCUS_VERSION,HOMEPAGE_INVITATION_FOCUS_FILES,homepageInvitationFocusDelta,sourceBeforeHomepageInvitationFocus20261011,sourceAtHomepageInvitationFocusBaseline} from './homepage_invitation_focus_20261011_inverse.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const prior=file=>execFileSync('git',['show',HOMEPAGE_INVITATION_FOCUS_BASELINE+':'+file],{cwd:root,maxBuffer:32e6});
const sha=value=>createHash('sha256').update(value).digest('hex');
let checks=0,negativeControls=0,hunks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const reject=(fn,label)=>{assert.throws(fn,{name:'AssertionError'},label);checks++;negativeControls++;};
eq(HOMEPAGE_INVITATION_FOCUS_BASELINE,'435fa2c87178de1bc3826f5f0ad1bba9b5f2cf54','Exact reviewed and reviewed PR hero baseline');
eq(HOMEPAGE_INVITATION_FOCUS_VERSION,'homepage-invitation-focus-20261011.1','Separate finite focus repair');
eq(HOMEPAGE_INVITATION_FOCUS_FILES,['index.html','scripts/homepage_sample_entry_20261011_contract.mjs','scripts/homepage_sample_entry_20261011_inverse.mjs','scripts/homepage_sample_entry_20261011_inverse.py'],'Only inline repair and three exact historical adapters');
for(const file of HOMEPAGE_INVITATION_FOCUS_FILES){
  const current=read(file),before=prior(file),entry=homepageInvitationFocusDelta.files[file];
  eq(sha(before),entry.before_sha256,file+': reviewed PR source pin');
  eq(sha(current),entry.after_sha256,file+': exact current source pin');
  for(const source of [current,current.toString()]){
    const expected=Buffer.isBuffer(source)?before:before.toString();
    eq(sourceBeforeHomepageInvitationFocus20261011(file,source),expected,file+': strict complete-byte inverse and type');
    eq(sourceAtHomepageInvitationFocusBaseline(file,source),expected,file+': exact conditional inverse');
    eq(sourceAtHomepageInvitationFocusBaseline(file,expected),expected,file+': baseline remains unchanged');
  }
  for(const [start,end,now]of entry.replacements){
    eq(current.toString().slice(start,end),now,file+': exact finite hunk');
    const mutant=Buffer.from(current.toString().slice(0,start)+'UNREVIEWED'+current.toString().slice(end));
    reject(()=>sourceBeforeHomepageInvitationFocus20261011(file,mutant),file+': changed repair hunk rejected');
    eq(sourceAtHomepageInvitationFocusBaseline(file,mutant),mutant,file+': unfamiliar hunk stays visible');
    hunks++;
  }
  for(const mutant of [Buffer.concat([current,Buffer.from('\n')]),Buffer.from('UNREVIEWED'+current),Buffer.from(current.toString().replace(/./,'!')),before]){
    reject(()=>sourceBeforeHomepageInvitationFocus20261011(file,mutant),file+': unknown source or double inversion rejected');
    eq(sourceAtHomepageInvitationFocusBaseline(file,mutant),mutant,file+': unfamiliar complete source stays visible');
  }
}
const html=read('index.html').toString(),old=prior('index.html').toString();
const declaration=' transition-property:color,border-color;';
eq(html.split(declaration).length,2,'Exactly one limited transition-property declaration');
eq(html.replace(declaration,''),old,'Every other homepage byte, copy, script, hero preview and footer unchanged');
assert.match(html,/body\.homepage-enterprise \.hero-invitation-link \{[^}]* transition-property:color,border-color;[^}]*\}/);checks++;
assert.match(html,/\.hero-invitation-link:focus-visible \{ outline:3px solid var\(--mdm-focus-ring-on-dark\); outline-offset:4px; \}/);checks++;
const originalFixture='scripts/fixtures/homepage-sample-entry-20261011.json';
eq(read(originalFixture),prior(originalFixture),'Reviewed PR sample-entry fixture remains byte-identical');
eq(sha(read(originalFixture)),'08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253','Reviewed PR initial fixture pin is immutable');
for(const file of ['scripts/homepage_sample_entry_20261011_inverse.mjs','scripts/homepage_sample_entry_20261011_inverse.py'])assert.match(read(file).toString(),/08ea78334ab895c29d9bd057aa21194421e2aac7e11aa2a5f8efe3c24d49f253/);checks+=2;
const protectedFiles=['public-search-index.json','scripts/homepage_sample_discovery_contract.mjs','scripts/homepage_sample_discovery_smoke.mjs','scripts/public_gold_accent_smoke.mjs','scripts/pilot_retry_browser_smoke.mjs','enterprise-site.css','public-product-design.css','canonical-site-shell.css','homepage-workspace-demo.css','homepage-workspace-demo.js','scripts/templates/home-workspace-preview.html','pattern-trial.html','pilot.html','evaluation-capacity.js','pilot-pool.js','pilot-waitlist.js','workspace-access-gate.js','workspace-evaluation.js','participant-evidence-safety.js','monderman-report.js','public-sample-model.js','legal-document-manifest.json','terms.html','privacy.html','outreach-privacy.html','site-shell/header.html','site-shell/footer.html','.github/workflows/pages-protected-deploy.yml'];
const historical=execFileSync('git',['ls-tree','-r','--name-only',HOMEPAGE_INVITATION_FOCUS_BASELINE,'--','scripts/fixtures','sample-data'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const file of [...protectedFiles,...historical])eq(read(file),prior(file),file+': reviewed PR product, legal, evidence and source assertions unchanged');
for(const file of ['unknown.js','__proto__','workspace.html']){
  const source=Buffer.from('Outside the approved focus delta');
  eq(sourceBeforeHomepageInvitationFocus20261011(file,source),source,file+': unlisted strict source untouched');
  eq(sourceAtHomepageInvitationFocusBaseline(file,source),source,file+': unlisted conditional source untouched');
}
console.log(JSON.stringify({ok:true,checks,negativeControls,files:HOMEPAGE_INVITATION_FOCUS_FILES.length,hunks,historicalFiles:historical.length,protectedFiles:protectedFiles.length,networkCalls:0,productionWrites:0,scope:'One exact inline focus-transition repair; prior reviewed PR hero fixture, assertions and all other homepage bytes preserved'}));
