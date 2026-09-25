// Current-release checks, independent of the historical compatibility inverse.
// No provider, account, network or customer-data requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PUBLIC_COPY_BASELINE,PUBLIC_COPY_FILES,sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {sourceBeforePromotionalGold20260924} from './promotional_gold_20260924_inverse.mjs';
import {sourceBeforeReportLibrary20260924} from './report_library_20260924_inverse.mjs';
import {sourceBeforePublicLanguagePass20260924} from './public_language_pass_20260924_inverse.mjs';
import {sourceBeforeTrustSecurityCenter20260924} from './trust_security_center_20260924_inverse.mjs';
import {sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';
import {sourceBeforePublicSampleProjectionCache20260924} from './public_sample_projection_20260924_inverse.mjs';
import {sourceBeforePublicSamplePreviewBinding20260924} from './public_sample_preview_binding_20260924_inverse.mjs';
import {sourceBeforeHomepageReportQuad20260925} from './homepage_report_quad_20260925_inverse.mjs';
import {sourceBeforeHorizontalOverviewPresentation} from './report_overview_horizontal_inverse.mjs';
import {PUBLIC_PRODUCTS,readPublicSampleFixture} from './public_sample_fixture.mjs';
import {sampleDesktopShellPatch,sourceBeforeSampleDesktopShell} from './sample_desktop_shell_20260924_inverse.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const prior=file=>execFileSync('git',['show',PUBLIC_COPY_BASELINE+':'+file],{cwd:root,encoding:'utf8',maxBuffer:32e6});
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const blocks=(html,tag)=>[...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>[\\s\\S]*?<\\/'+tag+'>','gi'))].map(m=>m[0]);
// This later, separately reviewed desktop shell correction is not part of the
// historical copy-only release. Restore only its exact seven added lines; the
// protected-file loop below still compares the complete original CSS bytes.
equal(Buffer.byteLength(sampleDesktopShellPatch),430,'Exact desktop shell addition is 430 bytes');
equal(sampleDesktopShellPatch.split('\n').length-1,7,'Exact desktop shell addition is seven lines');
const sampleDesktopCss=read('sample-report-production.css');
equal(sourceBeforeSampleDesktopShell('sample-report-production.css',sampleDesktopCss),prior('sample-report-production.css'),'Desktop shell correction preserves every original CSS byte');
for(const mutant of [sampleDesktopCss+'\n',sampleDesktopCss.replace('min-width:1081px','min-width:1080px'),
  sampleDesktopCss.replace('.psr-toc { position:static; }','.psr-toc { display:none; }'),
  sampleDesktopCss.replace('.mr-screen-contents { display:block; }','.mr-screen-contents { display:none; }'),
  sampleDesktopCss.replaceAll(':is(#report-synthesis,#report-depth) ',''),
  sampleDesktopCss.replace(sampleDesktopShellPatch,''),sampleDesktopCss+sampleDesktopShellPatch]) {
  assert.throws(()=>sourceBeforeSampleDesktopShell('sample-report-production.css',mutant),/Only the exact reviewed sample desktop CSS/);checks++;
}
for(const file of ['monderman-report.js','sample-report.html','__proto__']) {
  const outside=Buffer.from('Outside this one-file scope');
  equal(sourceBeforeSampleDesktopShell(file,outside),outside,'Desktop shell inverse leaves '+file+' untouched');
}
const approvedScriptText={
  'workspace.html':[['Each result keeps its own pathway, unit, date, and perspective.','Each result keeps its own work context, organizational unit, date and participant perspective.']],
  'workspace-diagnostics.html':[['Add a pathway label.','Add a campaign name.']],
  'workspace-settings.html':[
    ['Ask an organization admin to invite teammates.','Ask an organization admin to invite people to this Workspace.'],
    ['Only admins can invite teammates.','Only admins can invite people to this Workspace.']
  ],
  'cross-tool-synthesis.html':[[
    'The report preserves the API’s distinction between condition and evidence strength. A withheld composite remains withheld in every export.',
    'The report distinguishes what the answers describe from how strong the supporting evidence is. Any score withheld from the report stays withheld in every export.'
  ]]
};
for(const file of PUBLIC_COPY_FILES){
  const source=read(file),before=prior(file);
  equal(sourceBeforePublicCopyClarity(file,source),before,file+': full historical recovery');
  for(const mutation of [source+'\n',source.replace('</body>','<script>unapproved()</script></body>')]){
    check(mutation!==source,file+': negative control changes source');
    assert.throws(()=>sourceBeforePublicCopyClarity(file,mutation),/only the exact reviewed (?:current|public-language|trust-center|compact-homepage|homepage-report-quad) source/);checks++;
  }
  // Independently remove only the newer, exactly pinned presentation layers.
  // The original copy review still has to preserve executable bytes itself.
  const previewEdition=sourceBeforePublicSamplePreviewBinding20260924(file,sourceBeforeHomepageReportQuad20260925(file,source));
  const copyEdition=sourceBeforeReportLibrary20260924(file,sourceBeforePromotionalGold20260924(file,sourceBeforePublicLanguagePass20260924(file,sourceBeforeTrustSecurityCenter20260924(file,sourceBeforeHomepageCompactJourney20260924(file,sourceBeforePublicSampleProjectionCache20260924(file,previewEdition))))));
  equal(blocks(copyEdition,'style'),blocks(before,'style'),file+': copy-only edition has no CSS changes');
  let scripts=blocks(copyEdition,'script').join('\n');
  for(const [oldText,newText]of approvedScriptText[file]||[]){
    equal(scripts.split(newText).length,2,file+': one exact user-message substitution');
    scripts=scripts.replace(newText,()=>oldText);
  }
  equal(scripts,blocks(before,'script').join('\n'),file+': every executable byte retained outside named display strings');
  const inlineCode=html=>[...html.matchAll(/\son[a-z]+=(?:"[^"]*"|'[^']*')|\s(?:href|src)=("javascript:[^"]*"|'javascript:[^']*')/gi)].map(m=>m[0]);
  equal(inlineCode(copyEdition),inlineCode(before),file+': copy-only inline event handlers and JavaScript URLs unchanged');
  const controls=html=>[...html.matchAll(/<(?:form|input|select|textarea|option)\b[^>]*>/gi)].map(m=>m[0].replace(/\splaceholder="[^"]*"/g,''));
  equal(controls(copyEdition),controls(before),file+': copy-only form/control identifiers, values, authorization and validation attributes retained');
}
const tracked=execFileSync('git',['ls-tree','-r','--name-only',PUBLIC_COPY_BASELINE],{cwd:root,encoding:'utf8'}).trim().split('\n');
const protectedFiles=tracked.filter(file=>(!file.includes('/')&&/\.(?:js|css|woff2?)$/.test(file))||
  /^(?:privacy|terms)(?:-[^/]*)?\.html$/.test(file)||
  /^(?:decision-velocity|structural-clarity|operational-systems|institutional-performance)\.html$/.test(file)||
  file.startsWith('sample-data/')||file==='legal-document-manifest.json');
const expectedSampleFiles=['sample-data/production-diagnostic-samples.json','sample-data/production-sample-release.json',...Object.values(PUBLIC_PRODUCTS).map(key=>'sample-data/reports/'+key+'.pdf')].sort();
equal(protectedFiles.filter(file=>file.startsWith('sample-data/')).sort(),expectedSampleFiles,'Historical sample-artifact scope remains exactly six reports and two receipts');
const currentSampleFiles=fs.readdirSync(path.join(root,'sample-data'),{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>path.relative(root,path.join(entry.parentPath??entry.path,entry.name)).split(path.sep).join('/')).sort();
equal(currentSampleFiles,expectedSampleFiles,'Current sample-artifact scope remains exactly six reports and two receipts');
for(const file of protectedFiles.filter(file=>!file.startsWith('sample-data/'))){
  const current=fs.readFileSync(path.join(root,file));
  const restored=file==='monderman-report.js'
    ?sourceBeforeHorizontalOverviewPresentation(String(current))
    :file==='sample-report-production.css'?sourceBeforeSampleDesktopShell(file,current)
    :sourceBeforePublicCopyClarity(file,current);
  equal(Buffer.from(restored),execFileSync('git',['show',PUBLIC_COPY_BASELINE+':'+file],{cwd:root,maxBuffer:32e6}),file+': exact approved presentation delta or unchanged protected bytes');
}
const expectedCopy={
  'workspace-diagnostics.html':['Campaign name','Participant perspective','Run length','Add a campaign name.','count toward Synthesis readiness'],
  'workspace.html':['evidence checks in Analysis.','You decide when to generate a report.'],
  'checkout-success.html':['We’re confirming your subscription with Stripe and updating your Workspace.','Getting started'],
  'accept-invite.html':['Sign in using <b>the email address that received this invitation</b>'],
  'subprocessors.html':['id="ai-processing"','id="provider-security"','security.html#providers','security.html#ai-processing','security.html#provider-security'],
  'security.html':['Protecting the information you share in a diagnostic is a core responsibility.','id="ai-processing"','Earlier permission does not authorize this expanded use','even if no interpretation is generated','not named participants\' individual answer records','model training, fine-tuning, provider feedback','CrowdStrike Falcon Go','not covered by this device subscription','id="administrative-device-protection"','Earlier observations are not automatically made eligible.','not a promise of physical deletion','not a zero-retention arrangement','does not currently claim SOC 2, ISO 27001, FedRAMP','only predefined sector and Diagnostic categories, not customer answers, organization names or Workspace history'],
  'index.html':['id="measurement-loop-title">Compare results on the same basis.','Less bureaucracy. Better performance.'],
  'why-monderman.html':['Keep differences in experience visible.'],
  'roi.html':['What the scenario shows','The scoring system calculates the result. AI can help explain it.']
};
for(const [file,phrases]of Object.entries(expectedCopy))for(const phrase of phrases)check(read(file).includes(phrase),file+': current approved wording/boundary: '+phrase);
check(!read('index.html').includes('aria-label="Monderman measurement cycle"'),'No second four-step cycle beneath interactive journey');
check(!read('connect.html').includes('<h3>What happens next</h3>'),'Duplicate contact follow-up card removed');
equal((read('connect.html').match(/id="connectForm"/g)||[]).length,1,'Contact form remains single and intact');
check(!read('deterministic-ai-infrastructure.html').includes('The engine does not.</strong>'),'No orphaned architecture sentence');
execFileSync('python3',['scripts/build_public_search_index.py','--check'],{cwd:root,stdio:'pipe'});checks++;
// Changed evidence/PDFs are never labeled unchanged or approved by an inverse.
// The current on-disk publication must pass its independent complete receipt.
const publication=readPublicSampleFixture({root,manifestPath:'sample-data/production-sample-release.json'});checks++;
equal(publication.entries.length,6,'Independent publication receipt validates all six current sample outputs');
console.log(JSON.stringify({status:'PASS',checks,htmlFiles:PUBLIC_COPY_FILES.length,protectedFiles:protectedFiles.length,sampleArtifacts:expectedSampleFiles.length,publicationManifestValidated:true,scope:'Current approved copy, exact finite presentation compatibility, executable preservation, historical negative controls and independent current publication validation; no live service tests'}));
