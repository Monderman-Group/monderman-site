// Focused offline checks for homepage sample access and decorative accents.
// This does not grant publication approval or substitute for browser review.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildPublicSamplePreviewSections} from './refresh_public_sample_previews.mjs';
import {sourceBeforePublicCopyClarity} from './public_copy_clarity_inverse.mjs';
import {readPublicSampleFixture} from './public_sample_fixture.mjs';
import {sourceBeforeHomepageCompactJourney20260924} from './homepage_compact_journey_20260924_inverse.mjs';

export const HOMEPAGE_DISCOVERY_BASELINE='31c87d9944d58cd58a48e389a680e0e909536329';
export const PREVIEW_FOOTER_BEFORE='<div class="hwd-footer"><span><i aria-hidden="true"></i>Illustrative organizational evaluation</span><span>Evidence. Action. Follow-up.</span></div>';
export const PREVIEW_FOOTER_AFTER='<div class="hwd-footer"><span><i aria-hidden="true"></i>Illustrative organizational evaluation</span><a class="hwd-sample-link" href="sample-report.html">View sample reports <span aria-hidden="true">&rarr;</span></a></div>';

// Publication callers can prove the precise presentation-only template delta
// against their already-reviewed bytes without repinning historical approval.
export function homepagePreviewBeforeDiscoverability(template){
  assert.equal(template.split(PREVIEW_FOOTER_AFTER).length,2,'Exactly one persistent sample link is added to the preview footer');
  return template.replace(PREVIEW_FOOTER_AFTER,PREVIEW_FOOTER_BEFORE);
}

export function assertHomepageSampleDiscovery(root=path.resolve(import.meta.dirname,'..')){
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const prior=file=>execFileSync('git',['show',HOMEPAGE_DISCOVERY_BASELINE+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16e6});
  const html=read('index.html'),css=read('homepage-workspace-demo.css');
  const template=read('scripts/templates/home-workspace-preview.html');
  assert.equal(homepagePreviewBeforeDiscoverability(sourceBeforeHomepageCompactJourney20260924('scripts/templates/home-workspace-preview.html',template)),prior('scripts/templates/home-workspace-preview.html'),'The historical template changes only the permanent sample link after exact compact-journey inversion');
  assert.match(html,/<div class="hero-actions">\s*<a class="btn btn-accent" href="pilot\.html\?source=homepage">Request an invitation<\/a>\s*<a class="btn btn-secondary" href="pattern-trial\.html">Activate your invitation<\/a>\s*<\/div>\s*<a class="hero-enterprise-link hero-sample-link" href="sample-report\.html">View sample reports <span aria-hidden="true">&rarr;<\/span><\/a>\s*<p class="hero-access-note">/,'Sample access immediately follows both unchanged invitation CTAs');
  assert.equal((html.match(/class="hero-enterprise-link hero-sample-link"/g)||[]).length,1);
  const preview=html.match(/<aside class="home-workspace-preview"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(preview,'Homepage has its generated preview');
  assert.match(preview,/<\/section>\s*<\/div>\s*<div class="hwd-footer">[\s\S]*class="hwd-sample-link" href="sample-report\.html#synthesis"/,'The direct synthesis link is outside every journey panel');
  assert.equal((preview.match(/class="hwd-sample-link"/g)||[]).length,1);
  assert.ok(fs.existsSync(path.join(root,'sample-report.html')),'Both sample links resolve to the public sample page');
  const artifact=JSON.parse(read('sample-data/production-diagnostic-samples.json'));
  const generated=buildPublicSamplePreviewSections(artifact,template);
  assert.equal(preview,generated.hero,'Displayed preview matches the current saved sample data and current template');
  assert.equal(html.match(/<aside class="hero-report-proof has-sample-depth-tile"[\s\S]*?<\/aside>/)?.[0],generated.home,'Existing lower-page sample tile stays generated and directly linked');
  assert.match(css,/\.hero-sample-link\s*\{[^}]*min-height:44px/,'Hero sample link has a usable touch target');
  assert.match(css,/\.hwd-footer \.hwd-sample-link\s*\{[^}]*min-height:44px/,'Preview sample link has a usable touch target');
  assert.match(css,/\.hero-sample-link:focus-visible\s*\{[^}]*outline:3px/,'Hero link has keyboard focus treatment');
  assert.match(css,/\.hwd-app a:focus-visible[^}]*outline:3px/,'Preview link inherits keyboard focus treatment');
  assert.doesNotMatch(css,/\.(?:hero-sample-link|hwd-sample-link)[^{]*\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)/,'Sample links stay available across responsive and motion states');
  for(const file of ['homepage-workspace-demo.js','scripts/refresh_public_sample_previews.mjs','enterprise-site.css','assets/brand/brand-foundations-v2.css','monderman-shell.css','dv-result-dialog.css']){
    assert.equal(sourceBeforePublicCopyClarity(file,read(file)),prior(file),file+': journeys, palette roles, semantic states and generator preserve exact historical bytes outside the separately pinned presentation deltas');
  }
  const inlineScripts=value=>[...value.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
  assert.deepEqual(inlineScripts(html),inlineScripts(prior('index.html')),'Homepage navigation and embedded behavior are unchanged');
  const scoreBand=value=>value.match(/\.hwd-score-band\s*\{[^}]*\}/)?.[0];
  assert.equal(scoreBand(css),scoreBand(prior('homepage-workspace-demo.css')),'Semantic score-band colors are preserved');
  const shared=read('enterprise-site.css');
  assert.match(shared,/--mdm-gold:\s*#E6C765/);
  assert.match(css,/\.hero-actions \.btn-accent\s*\{[^}]*background:var\(--mdm-action-on-dark-bg\)/);
  assert.match(read('assets/brand/brand-foundations-v2.css'),/--mdm-color-sea-glass:\s*#A9D0D4/);
  assert.match(shared,/a\.btn-secondary[\s\S]*?border-color: var\(--mdm-gold\) !important/);
  assert.match(shared,/a\.btn-secondary[^\n]*:focus-visible,[\s\S]*?outline: 3px solid currentColor !important/,'Secondary calls to action retain a visible keyboard focus outline');
  for(const file of ['index.html','sample-report-tile.css','pilot-waitlist.css']){
    assert.doesNotMatch(read(file),/#C9821F|#F0C47D|#FFD99B|rgba\(201,\s*130,\s*31/ig,file+': reviewed decorative accents use gold');
  }
  // Source compatibility cannot approve changed sample evidence or PDFs. Check
  // the actual current release receipt independently after exact preview parity.
  readPublicSampleFixture({root,manifestPath:'sample-data/production-sample-release.json'});
  return {passed:true,currentPublicationReceiptValidated:true,journeyRuntimeExactApprovedDelta:true,semanticColorsUnchanged:true,generatedPreviewMatches:true,browserVerification:false,publicationApprovalClaimed:false};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
  console.log('HOMEPAGE_SAMPLE_DISCOVERY_CONTRACT '+JSON.stringify(assertHomepageSampleDiscovery()));
}
